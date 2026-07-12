import { Router, Response } from "express";
import { z } from "zod";
import db from "../config/db";
import { authenticateJWT, AuthenticatedRequest } from "../middleware/auth";
import { logActivity, createNotification } from "../utils/activity";

const router = Router();

// Zod schema for input validation
const bookingSchema = z.object({
  asset_id: z.number().int(),
  start_time: z.string().datetime("Start time must be a valid ISO datetime string"),
  end_time: z.string().datetime("End time must be a valid ISO datetime string"),
});

// GET all bookings (with optional filters)
router.get("/", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { asset_id, status, start, end } = req.query;

    let query = db("resource_bookings")
      .select(
        "resource_bookings.*",
        "assets.name as asset_name",
        "assets.asset_tag",
        "assets.location as asset_location",
        "employees.name as booked_by_name",
        "employees.email as booked_by_email",
        "employees.department_id as booked_by_department_id"
      )
      .leftJoin("assets", "resource_bookings.asset_id", "assets.id")
      .leftJoin("employees", "resource_bookings.booked_by_employee_id", "employees.id");

    if (asset_id) {
      query = query.where("resource_bookings.asset_id", Number(asset_id));
    }

    if (status) {
      query = query.where("resource_bookings.status", String(status));
    }

    // Filter by calendar range if provided
    if (start && end) {
      query = query.where(function () {
        this.where("resource_bookings.start_time", ">=", String(start))
          .andWhere("resource_bookings.end_time", "<=", String(end));
      });
    }

    // Role-based filtering for standard Employees
    if (req.user!.role === "Employee") {
      query = query.where("resource_bookings.booked_by_employee_id", req.user!.id);
    } else if (req.user!.role === "DepartmentHead") {
      // Dept Head sees department bookings or own bookings
      query = query.where(function () {
        this.where("employees.department_id", req.user!.department_id)
          .orWhere("resource_bookings.booked_by_employee_id", req.user!.id);
      });
    }

    const bookings = await query.orderBy("resource_bookings.start_time", "asc");
    return res.json({ bookings });
  } catch (error) {
    console.error("Fetch bookings error:", error);
    return res.status(500).json({ error: "Internal server error fetching bookings" });
  }
});

// POST create booking
router.post("/", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const data = bookingSchema.parse(req.body);
    const start = new Date(data.start_time);
    const end = new Date(data.end_time);

    // Validate times
    if (start >= end) {
      return res.status(400).json({ error: "Start time must be before end time" });
    }

    const now = new Date();
    if (start < now) {
      return res.status(400).json({ error: "Booking start time cannot be in the past" });
    }

    const result = await db.transaction(async (trx) => {
      // 1. Lock the asset to serialize bookings on the same resource
      const asset = await trx("assets").where({ id: data.asset_id }).forUpdate().first();

      if (!asset) {
        return { status: 404, error: "Asset not found" };
      }

      // 2. Validate asset is bookable
      if (!asset.is_bookable) {
        return { status: 400, error: `Asset '${asset.name}' is not designated as a bookable resource.` };
      }

      // 3. Validate status
      const forbiddenStatuses = ["Retired", "Disposed", "Lost", "UnderMaintenance"];
      if (forbiddenStatuses.includes(asset.status)) {
        return { status: 400, error: `Asset is currently ${asset.status.toLowerCase()} and cannot be booked.` };
      }

      // 4. Check for overlap bookings (status != Cancelled)
      // An overlap occurs if start_time < existing.end_time AND end_time > existing.start_time
      const overlap = await trx("resource_bookings")
        .select(
          "resource_bookings.id",
          "resource_bookings.start_time",
          "resource_bookings.end_time",
          "employees.name as booked_by_name"
        )
        .leftJoin("employees", "resource_bookings.booked_by_employee_id", "employees.id")
        .where("resource_bookings.asset_id", data.asset_id)
        .whereNot("resource_bookings.status", "Cancelled")
        .where("resource_bookings.start_time", "<", end.toISOString())
        .where("resource_bookings.end_time", ">", start.toISOString())
        .first();

      if (overlap) {
        const fmtStart = new Date(overlap.start_time).toLocaleString();
        const fmtEnd = new Date(overlap.end_time).toLocaleString();
        return {
          status: 400,
          error: `Resource is already booked during this period. Overlapping booking exists from ${fmtStart} to ${fmtEnd} by ${overlap.booked_by_name}.`,
        };
      }

      // 5. Insert booking
      const [newBooking] = await trx("resource_bookings")
        .insert({
          asset_id: data.asset_id,
          booked_by_employee_id: req.user!.id,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: "Upcoming",
        })
        .returning("*");

      await logActivity(
        req.user!.id,
        `Booked asset ${asset.asset_tag} from ${start.toISOString()} to ${end.toISOString()}`,
        "ResourceBooking",
        newBooking.id
      );

      return { status: 201, booking: newBooking };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(201).json({ message: "Booking created successfully", booking: result.booking });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Create booking error:", error);
    return res.status(500).json({ error: "Internal server error creating booking" });
  }
});

// POST cancel booking
router.post("/:id/cancel", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await db.transaction(async (trx) => {
      const booking = await trx("resource_bookings").where({ id }).forUpdate().first();
      if (!booking) {
        return { status: 404, error: "Booking not found" };
      }

      if (booking.status === "Cancelled") {
        return { status: 400, error: "Booking is already cancelled" };
      }

      if (booking.status === "Completed") {
        return { status: 400, error: "Cannot cancel a completed booking" };
      }

      // Role check for cancellation
      const isOwner = booking.booked_by_employee_id === req.user!.id;
      const isManager = req.user!.role === "AssetManager" || req.user!.role === "Admin";
      
      let isDeptHeadOfOwner = false;
      if (req.user!.role === "DepartmentHead") {
        const owner = await trx("employees").where({ id: booking.booked_by_employee_id }).first();
        if (owner && owner.department_id === req.user!.department_id) {
          isDeptHeadOfOwner = true;
        }
      }

      if (!isOwner && !isManager && !isDeptHeadOfOwner) {
        return { status: 403, error: "You do not have permission to cancel this booking." };
      }

      // Update status
      const [updatedBooking] = await trx("resource_bookings")
        .where({ id })
        .update({
          status: "Cancelled",
          updated_at: trx.fn.now(),
        })
        .returning("*");

      // Notify owner if cancelled by manager or dept head
      if (!isOwner) {
        await createNotification(
          booking.booked_by_employee_id,
          "Booking",
          `Your booking for asset ID ${booking.asset_id} was cancelled by ${req.user!.name}.`
        );
      }

      await logActivity(req.user!.id, `Cancelled booking ${id}`, "ResourceBooking", Number(id));

      return { status: 200, booking: updatedBooking };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({ message: "Booking cancelled successfully", booking: result.booking });
  } catch (error) {
    console.error("Cancel booking error:", error);
    return res.status(500).json({ error: "Internal server error cancelling booking" });
  }
});

export default router;

import { Router, Response } from "express";
import { z } from "zod";
import db from "../config/db";
import { authenticateJWT, requireRole, AuthenticatedRequest } from "../middleware/auth";
import { logActivity } from "../utils/activity";

const router = Router();

// Zod schema for validation
const assetSchema = z.object({
  name: z.string().min(2, "Asset name must be at least 2 characters"),
  category_id: z.number().int("Category ID must be a valid integer"),
  serial_number: z.string().min(1, "Serial number is required").nullable().optional(),
  acquisition_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Acquisition date must be YYYY-MM-DD"),
  acquisition_cost: z.number().nonnegative("Acquisition cost cannot be negative"),
  condition: z.enum(["New", "Good", "Fair", "Poor", "Damaged"]),
  location: z.string().min(2, "Location must be at least 2 characters"),
  is_bookable: z.boolean().default(false),
  status: z.enum(["Available", "Allocated", "Reserved", "UnderMaintenance", "Lost", "Retired", "Disposed"]).optional(),
  photo_url: z.string().url("Invalid photo URL").or(z.string().length(0)).nullable().optional(),
});

// GET list of assets (Filtered & Searched)
router.get("/", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { search, category_id, status, location, is_bookable } = req.query;

    let query = db("assets")
      .select(
        "assets.*",
        "asset_categories.name as category_name"
      )
      .leftJoin("asset_categories", "assets.category_id", "asset_categories.id");

    // Apply Search (tag, name, serial number)
    if (search) {
      const searchStr = `%${String(search).toLowerCase()}%`;
      query = query.where(function () {
        this.whereRaw("LOWER(assets.name) LIKE ?", [searchStr])
          .orWhereRaw("LOWER(assets.asset_tag) LIKE ?", [searchStr])
          .orWhereRaw("LOWER(assets.serial_number) LIKE ?", [searchStr])
          .orWhereRaw("LOWER(assets.location) LIKE ?", [searchStr]);
      });
    }

    // Apply Category Filter
    if (category_id) {
      query = query.where("assets.category_id", Number(category_id));
    }

    // Apply Status Filter
    if (status) {
      query = query.where("assets.status", String(status));
    }

    // Apply Location Filter
    if (location) {
      query = query.where("assets.location", String(location));
    }

    // Apply Bookable Filter
    if (is_bookable) {
      query = query.where("assets.is_bookable", is_bookable === "true");
    }

    const assets = await query.orderBy("assets.id", "desc");
    return res.json({ assets });
  } catch (error) {
    console.error("Fetch assets error:", error);
    return res.status(500).json({ error: "Internal server error fetching assets" });
  }
});

// GET single asset details
router.get("/:id", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const asset = await db("assets")
      .select("assets.*", "asset_categories.name as category_name")
      .leftJoin("asset_categories", "assets.category_id", "asset_categories.id")
      .where("assets.id", id)
      .first();

    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }

    return res.json({ asset });
  } catch (error) {
    console.error("Fetch single asset error:", error);
    return res.status(500).json({ error: "Internal server error fetching asset details" });
  }
});

// GET asset history (Allocations, Bookings, Maintenances, Audits)
router.get("/:id/history", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const assetExists = await db("assets").where({ id }).first();
    if (!assetExists) {
      return res.status(404).json({ error: "Asset not found" });
    }

    // 1. Allocations History
    const allocations = await db("asset_allocations")
      .select(
        "asset_allocations.*",
        "employees.name as employee_name",
        "employees.email as employee_email",
        "departments.name as department_name"
      )
      .leftJoin("employees", "asset_allocations.employee_id", "employees.id")
      .leftJoin("departments", "asset_allocations.department_id", "departments.id")
      .where("asset_allocations.asset_id", id)
      .orderBy("asset_allocations.created_at", "desc");

    // 2. Bookings History
    const bookings = await db("resource_bookings")
      .select("resource_bookings.*", "employees.name as booked_by_name", "employees.email as booked_by_email")
      .leftJoin("employees", "resource_bookings.booked_by_employee_id", "employees.id")
      .where("resource_bookings.asset_id", id)
      .orderBy("resource_bookings.start_time", "desc");

    // 3. Maintenance History
    const maintenance = await db("maintenance_requests")
      .select(
        "maintenance_requests.*",
        "employees.name as raised_by_name",
        "approver.name as approved_by_name"
      )
      .leftJoin("employees", "maintenance_requests.raised_by_employee_id", "employees.id")
      .leftJoin("employees as approver", "maintenance_requests.approved_by", "approver.id")
      .where("maintenance_requests.asset_id", id)
      .orderBy("maintenance_requests.created_at", "desc");

    // 4. Audit History
    const audits = await db("audit_results")
      .select("audit_results.*", "audit_cycles.start_date", "audit_cycles.end_date", "audit_cycles.status as cycle_status")
      .leftJoin("audit_cycles", "audit_results.audit_cycle_id", "audit_cycles.id")
      .where("audit_results.asset_id", id)
      .orderBy("audit_results.created_at", "desc");

    return res.json({
      allocations,
      bookings,
      maintenance,
      audits,
    });
  } catch (error) {
    console.error("Fetch asset history error:", error);
    return res.status(500).json({ error: "Internal server error fetching asset history" });
  }
});

// POST register new asset (Asset Manager only)
router.post(
  "/",
  authenticateJWT,
  requireRole(["AssetManager"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = assetSchema.parse(req.body);

      // Validate category exists
      const category = await db("asset_categories").where({ id: data.category_id }).first();
      if (!category) {
        return res.status(400).json({ error: "Specified asset category does not exist" });
      }

      // Check unique serial number if provided
      if (data.serial_number) {
        const existingSerial = await db("assets").where({ serial_number: data.serial_number }).first();
        if (existingSerial) {
          return res.status(400).json({ error: "An asset with this serial number is already registered" });
        }
      }

      // Generate unique asset tag using the DB sequence
      let assetTag = "";
      await db.transaction(async (trx) => {
        const [{ nextval }] = await trx.raw("SELECT nextval('seq_asset_tags')");
        assetTag = `AF-${String(nextval).padStart(4, "0")}`;

        const [newAsset] = await trx("assets")
          .insert({
            name: data.name,
            category_id: data.category_id,
            asset_tag: assetTag,
            serial_number: data.serial_number || null,
            acquisition_date: data.acquisition_date,
            acquisition_cost: data.acquisition_cost,
            condition: data.condition,
            location: data.location,
            is_bookable: data.is_bookable,
            status: data.status || "Available",
            photo_url: data.photo_url || null,
          })
          .returning("*");

        await logActivity(req.user!.id, `Registered asset: ${newAsset.name} (${newAsset.asset_tag})`, "Asset", newAsset.id);

        return res.status(201).json({
          message: "Asset registered successfully",
          asset: newAsset,
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Register asset error:", error);
      return res.status(500).json({ error: "Internal server error registering asset" });
    }
  }
);

// PUT update asset details (Asset Manager only)
router.put(
  "/:id",
  authenticateJWT,
  requireRole(["AssetManager"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const data = assetSchema.parse(req.body);

      const asset = await db("assets").where({ id }).first();
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }

      // Check serial number duplicate
      if (data.serial_number) {
        const duplicateSerial = await db("assets")
          .where({ serial_number: data.serial_number })
          .whereNot({ id })
          .first();
        if (duplicateSerial) {
          return res.status(400).json({ error: "Another asset already uses this serial number" });
        }
      }

      // Validate category exists
      const category = await db("asset_categories").where({ id: data.category_id }).first();
      if (!category) {
        return res.status(400).json({ error: "Specified asset category does not exist" });
      }

      const [updatedAsset] = await db("assets")
        .where({ id })
        .update({
          name: data.name,
          category_id: data.category_id,
          serial_number: data.serial_number || null,
          acquisition_date: data.acquisition_date,
          acquisition_cost: data.acquisition_cost,
          condition: data.condition,
          location: data.location,
          is_bookable: data.is_bookable,
          status: data.status || asset.status, // preserve status if not supplied
          photo_url: data.photo_url || null,
          updated_at: db.fn.now(),
        })
        .returning("*");

      await logActivity(
        req.user!.id,
        `Updated asset: ${updatedAsset.name} (${updatedAsset.asset_tag})`,
        "Asset",
        updatedAsset.id
      );

      return res.json({
        message: "Asset updated successfully",
        asset: updatedAsset,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Update asset error:", error);
      return res.status(500).json({ error: "Internal server error updating asset" });
    }
  }
);

export default router;

import db from "../config/db";
import { logActivity, createNotification } from "../utils/activity";

export class BookingService {
  static async listBookings(
    userRole: string,
    userId: number,
    userDeptId: number | null,
    filters: { asset_id?: any; status?: any; start?: any; end?: any }
  ) {
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

    if (filters.asset_id) {
      query = query.where("resource_bookings.asset_id", Number(filters.asset_id));
    }

    if (filters.status) {
      query = query.where("resource_bookings.status", String(filters.status));
    }

    if (filters.start && filters.end) {
      query = query.where(function () {
        this.where("resource_bookings.start_time", ">=", String(filters.start))
          .andWhere("resource_bookings.end_time", "<=", String(filters.end));
      });
    }

    if (userRole === "Employee") {
      query = query.where("resource_bookings.booked_by_employee_id", userId);
    } else if (userRole === "DepartmentHead") {
      query = query.where(function () {
        this.where("employees.department_id", userDeptId)
          .orWhere("resource_bookings.booked_by_employee_id", userId);
      });
    }

    return query.orderBy("resource_bookings.start_time", "asc");
  }

  static async createBooking(data: any, user: { id: number; name: string }) {
    const start = new Date(data.start_time);
    const end = new Date(data.end_time);

    if (start >= end) {
      throw new Error("Start time must be before end time");
    }

    const now = new Date();
    if (start < now) {
      throw new Error("Booking start time cannot be in the past");
    }

    return db.transaction(async (trx) => {
      const asset = await trx("assets").where({ id: data.asset_id }).forUpdate().first();
      if (!asset) {
        throw new Error("Asset not found");
      }

      if (!asset.is_bookable) {
        throw new Error(`Asset '${asset.name}' is not designated as a bookable resource.`);
      }

      const forbiddenStatuses = ["Retired", "Disposed", "Lost", "UnderMaintenance"];
      if (forbiddenStatuses.includes(asset.status)) {
        throw new Error(`Asset is currently ${asset.status.toLowerCase()} and cannot be booked.`);
      }

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
        throw new Error(`Resource is already booked during this period. Overlapping booking exists from ${fmtStart} to ${fmtEnd} by ${overlap.booked_by_name}.`);
      }

      const [newBooking] = await trx("resource_bookings")
        .insert({
          asset_id: data.asset_id,
          booked_by_employee_id: user.id,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: "Upcoming",
        })
        .returning("*");

      await logActivity(
        user.id,
        `Booked asset ${asset.asset_tag} from ${start.toISOString()} to ${end.toISOString()}`,
        "ResourceBooking",
        newBooking.id
      );

      return newBooking;
    });
  }

  static async cancelBooking(id: number | string, user: { id: number; name: string; role: string; department_id: number | null }) {
    return db.transaction(async (trx) => {
      const booking = await trx("resource_bookings").where({ id }).forUpdate().first();
      if (!booking) {
        throw new Error("Booking not found");
      }

      if (booking.status === "Cancelled") {
        throw new Error("Booking is already cancelled");
      }

      if (booking.status === "Completed") {
        throw new Error("Cannot cancel a completed booking");
      }

      const isOwner = booking.booked_by_employee_id === user.id;
      const isManager = user.role === "AssetManager" || user.role === "Admin";
      
      let isDeptHeadOfOwner = false;
      if (user.role === "DepartmentHead") {
        const owner = await trx("employees").where({ id: booking.booked_by_employee_id }).first();
        if (owner && owner.department_id === user.department_id) {
          isDeptHeadOfOwner = true;
        }
      }

      if (!isOwner && !isManager && !isDeptHeadOfOwner) {
        throw new Error("You do not have permission to cancel this booking.");
      }

      const [updatedBooking] = await trx("resource_bookings")
        .where({ id })
        .update({
          status: "Cancelled",
          updated_at: trx.fn.now(),
        })
        .returning("*");

      if (!isOwner) {
        await createNotification(
          booking.booked_by_employee_id,
          "Booking",
          `Your booking for asset ID ${booking.asset_id} was cancelled by ${user.name}.`
        );
      }

      await logActivity(user.id, `Cancelled booking ${id}`, "ResourceBooking", Number(id));
      return updatedBooking;
    });
  }
}
export default BookingService;

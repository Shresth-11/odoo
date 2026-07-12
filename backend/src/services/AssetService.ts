import db from "../config/db";
import { logActivity } from "../utils/activity";

export class AssetService {
  static async listAssets(filters: {
    search?: any;
    category_id?: any;
    status?: any;
    location?: any;
    is_bookable?: any;
  }) {
    let query = db("assets")
      .select("assets.*", "asset_categories.name as category_name")
      .leftJoin("asset_categories", "assets.category_id", "asset_categories.id");

    if (filters.search) {
      const searchStr = `%${String(filters.search).toLowerCase()}%`;
      query = query.where(function () {
        this.whereRaw("LOWER(assets.name) LIKE ?", [searchStr])
          .orWhereRaw("LOWER(assets.asset_tag) LIKE ?", [searchStr])
          .orWhereRaw("LOWER(assets.serial_number) LIKE ?", [searchStr])
          .orWhereRaw("LOWER(assets.location) LIKE ?", [searchStr]);
      });
    }

    if (filters.category_id) {
      query = query.where("assets.category_id", Number(filters.category_id));
    }

    if (filters.status) {
      query = query.where("assets.status", String(filters.status));
    }

    if (filters.location) {
      query = query.where("assets.location", String(filters.location));
    }

    if (filters.is_bookable) {
      query = query.where("assets.is_bookable", filters.is_bookable === "true");
    }

    return query.orderBy("assets.id", "desc");
  }

  static async getAssetById(id: number | string) {
    return db("assets")
      .select("assets.*", "asset_categories.name as category_name")
      .leftJoin("asset_categories", "assets.category_id", "asset_categories.id")
      .where("assets.id", id)
      .first();
  }

  static async getAssetHistory(id: number | string) {
    const assetExists = await db("assets").where({ id }).first();
    if (!assetExists) {
      throw new Error("Asset not found");
    }

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

    const bookings = await db("resource_bookings")
      .select("resource_bookings.*", "employees.name as booked_by_name", "employees.email as booked_by_email")
      .leftJoin("employees", "resource_bookings.booked_by_employee_id", "employees.id")
      .where("resource_bookings.asset_id", id)
      .orderBy("resource_bookings.start_time", "desc");

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

    const audits = await db("audit_results")
      .select("audit_results.*", "audit_cycles.start_date", "audit_cycles.end_date", "audit_cycles.status as cycle_status")
      .leftJoin("audit_cycles", "audit_results.audit_cycle_id", "audit_cycles.id")
      .where("audit_results.asset_id", id)
      .orderBy("audit_results.created_at", "desc");

    return { allocations, bookings, maintenance, audits };
  }

  static async registerAsset(data: any, userId: number) {
    const category = await db("asset_categories").where({ id: data.category_id }).first();
    if (!category) {
      throw new Error("Specified asset category does not exist");
    }

    if (data.serial_number) {
      const existingSerial = await db("assets").where({ serial_number: data.serial_number }).first();
      if (existingSerial) {
        throw new Error("An asset with this serial number is already registered");
      }
    }

    let assetTag = "";
    return db.transaction(async (trx) => {
      const rawResult = await trx.raw("SELECT nextval('seq_asset_tags')");
      const nextval = rawResult.rows[0].nextval;
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

      await logActivity(userId, `Registered asset: ${newAsset.name} (${newAsset.asset_tag})`, "Asset", newAsset.id);
      return newAsset;
    });
  }

  static async updateAsset(id: number | string, data: any, userId: number) {
    const asset = await db("assets").where({ id }).first();
    if (!asset) {
      throw new Error("Asset not found");
    }

    if (data.serial_number) {
      const duplicateSerial = await db("assets")
        .where({ serial_number: data.serial_number })
        .whereNot({ id })
        .first();
      if (duplicateSerial) {
        throw new Error("Another asset already uses this serial number");
      }
    }

    const category = await db("asset_categories").where({ id: data.category_id }).first();
    if (!category) {
      throw new Error("Specified asset category does not exist");
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
        status: data.status || asset.status,
        photo_url: data.photo_url || null,
        updated_at: db.fn.now(),
      })
      .returning("*");

    await logActivity(userId, `Updated asset: ${updatedAsset.name} (${updatedAsset.asset_tag})`, "Asset", updatedAsset.id);
    return updatedAsset;
  }
}
export default AssetService;

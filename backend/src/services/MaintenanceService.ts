import db from "../config/db";
import { logActivity, createNotification } from "../utils/activity";

export class MaintenanceService {
  static async listRequests(
    userRole: string,
    userId: number,
    userDeptId: number | null,
    filters: { status?: any; priority?: any; asset_id?: any }
  ) {
    let query = db("maintenance_requests")
      .select(
        "maintenance_requests.*",
        "assets.name as asset_name",
        "assets.asset_tag",
        "assets.location as asset_location",
        "employees.name as raised_by_name",
        "employees.email as raised_by_email",
        "approver.name as approved_by_name"
      )
      .leftJoin("assets", "maintenance_requests.asset_id", "assets.id")
      .leftJoin("employees", "maintenance_requests.raised_by_employee_id", "employees.id")
      .leftJoin("employees as approver", "maintenance_requests.approved_by", "approver.id");

    if (filters.status) {
      query = query.where("maintenance_requests.status", String(filters.status));
    }

    if (filters.priority) {
      query = query.where("maintenance_requests.priority", String(filters.priority));
    }

    if (filters.asset_id) {
      query = query.where("maintenance_requests.asset_id", Number(filters.asset_id));
    }

    if (userRole === "Employee") {
      query = query.where("maintenance_requests.raised_by_employee_id", userId);
    } else if (userRole === "DepartmentHead") {
      query = query.where(function () {
        this.where("employees.department_id", userDeptId)
          .orWhere("maintenance_requests.raised_by_employee_id", userId);
      });
    }

    return query.orderBy("maintenance_requests.id", "desc");
  }

  static async raiseRequest(data: any, user: { id: number; name: string }) {
    const asset = await db("assets").where({ id: data.asset_id }).first();
    if (!asset) {
      throw new Error("Asset not found");
    }

    const [newRequest] = await db("maintenance_requests")
      .insert({
        asset_id: data.asset_id,
        raised_by_employee_id: user.id,
        issue_description: data.issue_description,
        priority: data.priority,
        photo_url: data.photo_url || null,
        status: "Pending",
      })
      .returning("*");

    const assetManagers = await db("employees").where({ role: "AssetManager", status: "Active" }).select("id");
    for (const mgr of assetManagers) {
      await createNotification(
        mgr.id,
        "Maintenance",
        `New maintenance request raised for ${asset.asset_tag} (${data.priority} priority) by ${user.name}.`
      );
    }

    await logActivity(user.id, `Raised maintenance request for asset ${asset.asset_tag}`, "MaintenanceRequest", newRequest.id);
    return newRequest;
  }

  static async approveRequest(id: number | string, userId: number) {
    return db.transaction(async (trx) => {
      const request = await trx("maintenance_requests").where({ id }).forUpdate().first();
      if (!request) {
        throw new Error("Maintenance request not found");
      }

      if (request.status !== "Pending") {
        throw new Error(`Request has already been ${request.status.toLowerCase()}`);
      }

      const asset = await trx("assets").where({ id: request.asset_id }).forUpdate().first();
      if (!asset) {
        throw new Error("Asset not found");
      }

      await trx("assets").where({ id: asset.id }).update({
        status: "UnderMaintenance",
        updated_at: trx.fn.now(),
      });

      const [updatedRequest] = await trx("maintenance_requests")
        .where({ id })
        .update({
          status: "Approved",
          approved_by: userId,
          updated_at: trx.fn.now(),
        })
        .returning("*");

      await createNotification(
        request.raised_by_employee_id,
        "Maintenance",
        `Your maintenance request for asset ${asset.asset_tag} has been approved. Status is now Under Maintenance.`
      );

      await logActivity(userId, `Approved maintenance request ${id} for asset ${asset.asset_tag}`, "MaintenanceRequest", Number(id));
      return updatedRequest;
    });
  }

  static async assignTechnician(id: number | string, data: { technician_name: string; status?: string }, userId: number) {
    return db.transaction(async (trx) => {
      const request = await trx("maintenance_requests").where({ id }).forUpdate().first();
      if (!request) {
        throw new Error("Maintenance request not found");
      }

      const forbiddenStatuses = ["Pending", "Rejected", "Resolved"];
      if (forbiddenStatuses.includes(request.status)) {
        throw new Error(`Cannot assign technician to a request that is ${request.status.toLowerCase()}`);
      }

      const [updatedRequest] = await trx("maintenance_requests")
        .where({ id })
        .update({
          status: data.status || "TechnicianAssigned",
          technician_name: data.technician_name,
          updated_at: trx.fn.now(),
        })
        .returning("*");

      await logActivity(userId, `Assigned technician '${data.technician_name}' to request ${id}`, "MaintenanceRequest", Number(id));
      return updatedRequest;
    });
  }

  static async resolveRequest(id: number | string, userId: number) {
    return db.transaction(async (trx) => {
      const request = await trx("maintenance_requests").where({ id }).forUpdate().first();
      if (!request) {
        throw new Error("Maintenance request not found");
      }

      const activeStatuses = ["Approved", "TechnicianAssigned", "InProgress"];
      if (!activeStatuses.includes(request.status)) {
        throw new Error(`Cannot resolve a maintenance request that is ${request.status.toLowerCase()}`);
      }

      const asset = await trx("assets").where({ id: request.asset_id }).forUpdate().first();
      if (!asset) {
        throw new Error("Asset not found");
      }

      await trx("assets").where({ id: asset.id }).update({
        status: "Available",
        updated_at: trx.fn.now(),
      });

      const [updatedRequest] = await trx("maintenance_requests")
        .where({ id })
        .update({
          status: "Resolved",
          updated_at: trx.fn.now(),
        })
        .returning("*");

      await createNotification(
        request.raised_by_employee_id,
        "Maintenance",
        `Maintenance completed for asset '${asset.name}' (${asset.asset_tag}). Status is now back to Available.`
      );

      await logActivity(userId, `Resolved maintenance request ${id} for asset ${asset.asset_tag}`, "MaintenanceRequest", Number(id));
      return updatedRequest;
    });
  }

  static async rejectRequest(id: number | string, userId: number) {
    return db.transaction(async (trx) => {
      const request = await trx("maintenance_requests").where({ id }).forUpdate().first();
      if (!request) {
        throw new Error("Maintenance request not found");
      }

      if (request.status !== "Pending") {
        throw new Error(`Cannot reject a request that is already ${request.status.toLowerCase()}`);
      }

      const [updatedRequest] = await trx("maintenance_requests")
        .where({ id })
        .update({
          status: "Rejected",
          approved_by: userId,
          updated_at: trx.fn.now(),
        })
        .returning("*");

      await createNotification(
        request.raised_by_employee_id,
        "Maintenance",
        `Your maintenance request for asset ID ${request.asset_id} has been rejected.`
      );

      await logActivity(userId, `Rejected maintenance request ${id}`, "MaintenanceRequest", Number(id));
      return updatedRequest;
    });
  }
}
export default MaintenanceService;

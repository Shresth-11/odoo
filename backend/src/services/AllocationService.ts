import db from "../config/db";
import { logActivity, createNotification } from "../utils/activity";

export class AllocationService {
  static async listAllocations(userRole: string, userId: number, userDeptId: number | null, filters: { status?: any; employee_id?: any; department_id?: any }) {
    let query = db("asset_allocations")
      .select(
        "asset_allocations.*",
        "assets.name as asset_name",
        "assets.asset_tag",
        "assets.location as asset_location",
        "employees.name as employee_name",
        "employees.email as employee_email",
        "departments.name as department_name"
      )
      .leftJoin("assets", "asset_allocations.asset_id", "assets.id")
      .leftJoin("employees", "asset_allocations.employee_id", "employees.id")
      .leftJoin("departments", "asset_allocations.department_id", "departments.id");

    if (filters.status) {
      query = query.where("asset_allocations.status", String(filters.status));
    }

    if (userRole === "Employee") {
      query = query.where("asset_allocations.employee_id", userId);
    } else if (userRole === "DepartmentHead") {
      query = query.where(function () {
        this.where("asset_allocations.department_id", userDeptId)
          .orWhere("asset_allocations.employee_id", userId)
          .orWhere("employees.department_id", userDeptId);
      });
    } else {
      if (filters.employee_id) {
        query = query.where("asset_allocations.employee_id", Number(filters.employee_id));
      }
      if (filters.department_id) {
        query = query.where("asset_allocations.department_id", Number(filters.department_id));
      }
    }

    return query.orderBy("asset_allocations.id", "desc");
  }

  static async allocateAsset(data: any, user: { id: number; name: string }) {
    const todayStr = new Date().toISOString().split("T")[0];
    if (data.expected_return_date < todayStr) {
      throw new Error("Expected return date cannot be in the past");
    }

    return db.transaction(async (trx) => {
      const asset = await trx("assets").where({ id: data.asset_id }).forUpdate().first();
      if (!asset) {
        throw new Error("Asset not found");
      }

      if (asset.status !== "Available") {
        const currentHolder = await trx("asset_allocations")
          .select(
            "asset_allocations.employee_id",
            "asset_allocations.department_id",
            "employees.name as employee_name",
            "employees.email as employee_email",
            "departments.name as department_name"
          )
          .leftJoin("employees", "asset_allocations.employee_id", "employees.id")
          .leftJoin("departments", "asset_allocations.department_id", "departments.id")
          .where("asset_allocations.asset_id", data.asset_id)
          .where("asset_allocations.status", "Active")
          .first();

        let holderName = "another process";
        if (currentHolder) {
          if (currentHolder.employee_name) {
            holderName = `${currentHolder.employee_name} (${currentHolder.employee_email})`;
          } else if (currentHolder.department_name) {
            holderName = `Department: ${currentHolder.department_name}`;
          }
        }
        throw new Error(`Asset ${asset.asset_tag} already Allocated. Currently held by: ${holderName}. Please request a Transfer Request instead.`);
      }

      if (data.employee_id) {
        const emp = await trx("employees").where({ id: data.employee_id }).first();
        if (!emp) throw new Error("Specified employee does not exist");
      } else if (data.department_id) {
        const dept = await trx("departments").where({ id: data.department_id }).first();
        if (!dept) throw new Error("Specified department does not exist");
      }

      await trx("assets").where({ id: data.asset_id }).update({ status: "Allocated", updated_at: trx.fn.now() });

      const [newAllocation] = await trx("asset_allocations")
        .insert({
          asset_id: data.asset_id,
          employee_id: data.employee_id || null,
          department_id: data.department_id || null,
          expected_return_date: data.expected_return_date,
          condition_notes: data.condition_notes || null,
          status: "Active",
        })
        .returning("*");

      if (data.employee_id) {
        await createNotification(
          data.employee_id,
          "Allocation",
          `Physical asset '${asset.name}' (${asset.asset_tag}) has been allocated to you. Expected return: ${data.expected_return_date}.`
        );
      } else if (data.department_id) {
        const dept = await trx("departments").where({ id: data.department_id }).first();
        if (dept && dept.department_head_id) {
          await createNotification(
            dept.department_head_id,
            "Allocation",
            `Physical asset '${asset.name}' (${asset.asset_tag}) has been allocated to your department (${dept.name}).`
          );
        }
      }

      await logActivity(
        user.id,
        `Allocated asset ${asset.asset_tag} to ${data.employee_id ? "employee " + data.employee_id : "department " + data.department_id}`,
        "AssetAllocation",
        newAllocation.id
      );

      return newAllocation;
    });
  }

  static async returnAsset(id: number | string, data: any, userId: number) {
    return db.transaction(async (trx) => {
      const allocation = await trx("asset_allocations").where({ id }).forUpdate().first();
      if (!allocation) {
        throw new Error("Allocation record not found");
      }

      if (allocation.status !== "Active" && allocation.status !== "Overdue") {
        throw new Error("Asset has already been returned");
      }

      const asset = await trx("assets").where({ id: allocation.asset_id }).forUpdate().first();
      if (!asset) {
        throw new Error("Asset not found");
      }

      await trx("assets").where({ id: asset.id }).update({ status: "Available", updated_at: trx.fn.now() });

      const [updatedAllocation] = await trx("asset_allocations")
        .where({ id })
        .update({
          status: "Returned",
          actual_return_date: trx.fn.now(),
          condition_notes: data.condition_notes || allocation.condition_notes,
          updated_at: trx.fn.now(),
        })
        .returning("*");

      if (allocation.employee_id) {
        await createNotification(
          allocation.employee_id,
          "Allocation",
          `Your return of asset '${asset.name}' (${asset.asset_tag}) has been confirmed by the Asset Manager.`
        );
      }

      await logActivity(userId, `Returned asset: ${asset.asset_tag}`, "AssetAllocation", Number(id));
      return updatedAllocation;
    });
  }

  static async listTransfers(userRole: string, userId: number, userDeptId: number | null) {
    let query = db("transfer_requests")
      .select(
        "transfer_requests.*",
        "assets.name as asset_name",
        "assets.asset_tag",
        "from_emp.name as from_employee_name",
        "from_emp.email as from_employee_email",
        "to_emp.name as to_employee_name",
        "to_emp.email as to_employee_email"
      )
      .leftJoin("assets", "transfer_requests.asset_id", "assets.id")
      .leftJoin("employees as from_emp", "transfer_requests.from_employee_id", "from_emp.id")
      .leftJoin("employees as to_emp", "transfer_requests.to_employee_id", "to_emp.id");

    if (userRole === "Employee") {
      query = query.where(function () {
        this.where("transfer_requests.from_employee_id", userId).orWhere(
          "transfer_requests.to_employee_id",
          userId
        );
      });
    } else if (userRole === "DepartmentHead") {
      query = query.where(function () {
        this.where("from_emp.department_id", userDeptId)
          .orWhere("to_emp.department_id", userDeptId)
          .orWhere("transfer_requests.from_employee_id", userId)
          .orWhere("transfer_requests.to_employee_id", userId);
      });
    }

    return query.orderBy("transfer_requests.id", "desc");
  }

  static async raiseTransfer(data: any, user: { id: number; name: string; role: string; department_id: number | null }) {
    return db.transaction(async (trx) => {
      const asset = await trx("assets").where({ id: data.asset_id }).first();
      if (!asset) {
        throw new Error("Asset not found");
      }

      const activeAllocation = await trx("asset_allocations")
        .where({ asset_id: data.asset_id, status: "Active" })
        .first();

      if (!activeAllocation || !activeAllocation.employee_id) {
        throw new Error("Asset must be currently allocated to an individual employee to initiate a transfer.");
      }

      const targetEmp = await trx("employees").where({ id: data.to_employee_id }).first();
      if (!targetEmp) {
        throw new Error("Target employee does not exist");
      }

      if (user.role === "Employee" && activeAllocation.employee_id !== user.id && data.to_employee_id !== user.id) {
        throw new Error("You can only request transfers for assets allocated to you, or to request an asset be transferred to you.");
      }

      if (activeAllocation.employee_id === data.to_employee_id) {
        throw new Error("Asset is already allocated to the target employee.");
      }

      const [newRequest] = await trx("transfer_requests")
        .insert({
          asset_id: data.asset_id,
          from_employee_id: activeAllocation.employee_id,
          to_employee_id: data.to_employee_id,
          status: "Requested",
        })
        .returning("*");

      const assetManagers = await trx("employees").where({ role: "AssetManager", status: "Active" }).select("id");
      for (const mgr of assetManagers) {
        await createNotification(
          mgr.id,
          "Transfer",
          `Transfer request raised for asset ${asset.asset_tag} from ${user.name} to ${targetEmp.name}.`
        );
      }

      if (activeAllocation.employee_id !== user.id) {
        await createNotification(
          activeAllocation.employee_id,
          "Transfer",
          `A transfer request has been raised to move your allocated asset ${asset.asset_tag} to ${targetEmp.name}.`
        );
      }

      await logActivity(user.id, `Requested transfer of asset ${asset.asset_tag} to employee ${data.to_employee_id}`, "TransferRequest", newRequest.id);
      return newRequest;
    });
  }

  static async approveTransfer(id: number | string, userId: number) {
    return db.transaction(async (trx) => {
      const transfer = await trx("transfer_requests").where({ id }).forUpdate().first();
      if (!transfer) {
        throw new Error("Transfer request not found");
      }

      if (transfer.status !== "Requested") {
        throw new Error(`Transfer request is already ${transfer.status.toLowerCase()}`);
      }

      const asset = await trx("assets").where({ id: transfer.asset_id }).forUpdate().first();
      if (!asset) {
        throw new Error("Asset not found");
      }

      const activeAllocation = await trx("asset_allocations")
        .where({ asset_id: transfer.asset_id, status: "Active" })
        .first();

      if (activeAllocation) {
        await trx("asset_allocations")
          .where({ id: activeAllocation.id })
          .update({
            status: "Returned",
            actual_return_date: trx.fn.now(),
            condition_notes: `Transferred to employee ${transfer.to_employee_id}. Approved by Asset Manager ${userId}`,
            updated_at: trx.fn.now(),
          });
      }

      const expectedReturn = activeAllocation 
        ? activeAllocation.expected_return_date 
        : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      await trx("asset_allocations").insert({
        asset_id: transfer.asset_id,
        employee_id: transfer.to_employee_id,
        expected_return_date: expectedReturn,
        condition_notes: "Allocation transferred from former employee.",
        status: "Active",
      });

      const [updatedTransfer] = await trx("transfer_requests")
        .where({ id })
        .update({
          status: "Completed",
          approved_by: userId,
          updated_at: trx.fn.now(),
        })
        .returning("*");

      if (transfer.from_employee_id) {
        await createNotification(
          transfer.from_employee_id,
          "Transfer",
          `Your allocated asset '${asset.name}' (${asset.asset_tag}) has been transferred to another employee.`
        );
      }

      await createNotification(
        transfer.to_employee_id,
        "Transfer",
        `Physical asset '${asset.name}' (${asset.asset_tag}) has been successfully transferred and allocated to you.`
      );

      await logActivity(userId, `Approved asset transfer ${id} for asset ${asset.asset_tag}`, "TransferRequest", Number(id));
      return updatedTransfer;
    });
  }

  static async rejectTransfer(id: number | string, userId: number) {
    return db.transaction(async (trx) => {
      const transfer = await trx("transfer_requests").where({ id }).forUpdate().first();
      if (!transfer) {
        throw new Error("Transfer request not found");
      }

      if (transfer.status !== "Requested") {
        throw new Error(`Transfer request is already ${transfer.status.toLowerCase()}`);
      }

      const [updatedTransfer] = await trx("transfer_requests")
        .where({ id })
        .update({
          status: "Rejected",
          approved_by: userId,
          updated_at: trx.fn.now(),
        })
        .returning("*");

      await createNotification(
        transfer.to_employee_id,
        "Transfer",
        `Your transfer request for asset ID ${transfer.asset_id} was rejected by the Asset Manager.`
      );

      await logActivity(userId, `Rejected asset transfer request ${id}`, "TransferRequest", Number(id));
      return updatedTransfer;
    });
  }
}
export default AllocationService;

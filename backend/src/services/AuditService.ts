import db from "../config/db";
import { logActivity, createNotification } from "../utils/activity";

export class AuditService {
  static async listCycles() {
    const list = await db("audit_cycles")
      .select("audit_cycles.*", "departments.name as department_name")
      .leftJoin("departments", "audit_cycles.scope_department_id", "departments.id")
      .orderBy("audit_cycles.start_date", "desc");

    return Promise.all(
      list.map(async (cycle) => {
        const auditors = await db("audit_assignments")
          .select("employees.id", "employees.name", "employees.email")
          .join("employees", "audit_assignments.auditor_employee_id", "employees.id")
          .where("audit_assignments.audit_cycle_id", cycle.id);
        return { ...cycle, auditors };
      })
    );
  }

  static async getCycleDetails(id: number | string) {
    const cycle = await db("audit_cycles")
      .select("audit_cycles.*", "departments.name as department_name")
      .leftJoin("departments", "audit_cycles.scope_department_id", "departments.id")
      .where("audit_cycles.id", id)
      .first();

    if (!cycle) {
      throw new Error("Audit cycle not found");
    }

    const auditors = await db("audit_assignments")
      .select("employees.id", "employees.name", "employees.email")
      .join("employees", "audit_assignments.auditor_employee_id", "employees.id")
      .where("audit_assignments.audit_cycle_id", id);

    const results = await db("audit_results")
      .select("audit_results.*", "assets.name as asset_name", "assets.asset_tag", "assets.serial_number")
      .join("assets", "audit_results.asset_id", "assets.id")
      .where("audit_results.audit_cycle_id", id);

    return { cycle, auditors, results };
  }

  static async createCycle(data: any, userId: number) {
    if (data.start_date > data.end_date) {
      throw new Error("Start date must be before or equal to end date");
    }

    if (data.scope_department_id) {
      const dept = await db("departments").where({ id: data.scope_department_id }).first();
      if (!dept) {
        throw new Error("Scope department does not exist");
      }
    }

    return db.transaction(async (trx) => {
      const [newCycle] = await trx("audit_cycles")
        .insert({
          scope_department_id: data.scope_department_id || null,
          scope_location: data.scope_location || null,
          start_date: data.start_date,
          end_date: data.end_date,
          status: "Open",
        })
        .returning("*");

      const assignments = data.auditor_ids.map((auditorId: number) => ({
        audit_cycle_id: newCycle.id,
        auditor_employee_id: auditorId,
      }));

      await trx("audit_assignments").insert(assignments);

      for (const auditorId of data.auditor_ids) {
        await createNotification(
          auditorId,
          "Audit",
          `You have been assigned as an auditor for Audit Cycle ID ${newCycle.id} starting on ${data.start_date}.`
        );
      }

      await logActivity(userId, `Created audit cycle ${newCycle.id}`, "AuditCycle", newCycle.id);
      return newCycle;
    });
  }

  static async submitResult(id: number | string, data: any, userId: number, userRole: string) {
    return db.transaction(async (trx) => {
      const cycle = await trx("audit_cycles").where({ id }).forUpdate().first();
      if (!cycle) {
        throw new Error("Audit cycle not found");
      }

      if (cycle.status !== "Open") {
        throw new Error("Audit cycle is closed. Results are locked and cannot be modified.");
      }

      const isAssigned = await trx("audit_assignments")
        .where({ audit_cycle_id: id, auditor_employee_id: userId })
        .first();

      if (!isAssigned && userRole !== "Admin") {
        throw new Error("You are not assigned as an auditor for this audit cycle.");
      }

      const asset = await trx("assets").where({ id: data.asset_id }).first();
      if (!asset) {
        throw new Error("Asset not found");
      }

      const existingResult = await trx("audit_results")
        .where({ audit_cycle_id: id, asset_id: data.asset_id })
        .first();

      let auditResult;
      if (existingResult) {
        [auditResult] = await trx("audit_results")
          .where({ id: existingResult.id })
          .update({
            result: data.result,
            notes: data.notes || null,
            updated_at: trx.fn.now(),
          })
          .returning("*");
      } else {
        [auditResult] = await trx("audit_results")
          .insert({
            audit_cycle_id: id,
            asset_id: data.asset_id,
            result: data.result,
            notes: data.notes || null,
          })
          .returning("*");
      }

      await logActivity(
        userId,
        `Recorded audit result '${data.result}' for asset ${asset.asset_tag} in cycle ${id}`,
        "AuditResult",
        auditResult.id
      );

      return auditResult;
    });
  }

  static async closeCycle(id: number | string, userId: number) {
    return db.transaction(async (trx) => {
      const cycle = await trx("audit_cycles").where({ id }).forUpdate().first();
      if (!cycle) {
        throw new Error("Audit cycle not found");
      }

      if (cycle.status === "Closed") {
        throw new Error("Audit cycle is already closed.");
      }

      const [closedCycle] = await trx("audit_cycles")
        .where({ id })
        .update({
          status: "Closed",
          updated_at: trx.fn.now(),
        })
        .returning("*");

      const results = await trx("audit_results").where({ audit_cycle_id: id });

      for (const resItem of results) {
        const asset = await trx("assets").where({ id: resItem.asset_id }).first();
        if (!asset) continue;

        if (resItem.result === "Missing") {
          await trx("assets").where({ id: asset.id }).update({
            status: "Lost",
            updated_at: trx.fn.now(),
          });

          const managers = await trx("employees").where({ role: "AssetManager", status: "Active" }).select("id");
          for (const mgr of managers) {
            await createNotification(
              mgr.id,
              "System",
              `Asset ${asset.asset_tag} (${asset.name}) was confirmed MISSING in Audit Cycle ${id} and is now flagged as Lost.`
            );
          }
        } else if (resItem.result === "Damaged") {
          await trx("assets").where({ id: asset.id }).update({
            status: "UnderMaintenance",
            condition: "Damaged",
            updated_at: trx.fn.now(),
          });

          await trx("maintenance_requests").insert({
            asset_id: asset.id,
            raised_by_employee_id: userId,
            issue_description: `Flagged as Damaged in Audit Cycle ${id}. Notes: ${resItem.notes || "None"}`,
            priority: "High",
            status: "Pending",
          });

          const managers = await trx("employees").where({ role: "AssetManager", status: "Active" }).select("id");
          for (const mgr of managers) {
            await createNotification(
              mgr.id,
              "System",
              `Asset ${asset.asset_tag} (${asset.name}) was marked DAMAGED in Audit Cycle ${id}. Maintenance request auto-created.`
            );
          }
        }
      }

      await logActivity(userId, `Closed audit cycle ${id}`, "AuditCycle", Number(id));
      return closedCycle;
    });
  }

  static async getCycleReport(id: number | string) {
    const cycle = await db("audit_cycles").where({ id }).first();
    if (!cycle) {
      throw new Error("Audit cycle not found");
    }

    let scopedAssetsQuery = db("assets")
      .select("assets.*", "asset_categories.name as category_name")
      .leftJoin("asset_categories", "assets.category_id", "asset_categories.id");

    if (cycle.scope_department_id) {
      scopedAssetsQuery = scopedAssetsQuery.whereIn("assets.id", function () {
        this.select("asset_allocations.asset_id")
          .from("asset_allocations")
          .leftJoin("employees", "asset_allocations.employee_id", "employees.id")
          .where("asset_allocations.status", "Active")
          .where(function () {
            this.where("asset_allocations.department_id", cycle.scope_department_id)
              .orWhere("employees.department_id", cycle.scope_department_id);
          });
      });
    }

    if (cycle.scope_location) {
      scopedAssetsQuery = scopedAssetsQuery.where("assets.location", cycle.scope_location);
    }

    const scopedAssets = await scopedAssetsQuery;

    const results = await db("audit_results")
      .select("audit_results.*")
      .where("audit_results.audit_cycle_id", id);

    const resultsMap = new Map(results.map((r) => [r.asset_id, r]));

    const verified: any[] = [];
    const missing: any[] = [];
    const damaged: any[] = [];
    const unaudited: any[] = [];

    for (const asset of scopedAssets) {
      const result = resultsMap.get(asset.id);
      if (!result) {
        unaudited.push(asset);
      } else if (result.result === "Verified") {
        verified.push({ ...asset, audit_notes: result.notes });
      } else if (result.result === "Missing") {
        missing.push({ ...asset, audit_notes: result.notes });
      } else if (result.result === "Damaged") {
        damaged.push({ ...asset, audit_notes: result.notes });
      }
    }

    const summary = {
      total_scoped: scopedAssets.length,
      total_audited: results.length,
      verified_count: verified.length,
      missing_count: missing.length,
      damaged_count: damaged.length,
      unaudited_count: unaudited.length,
      discrepancy_rate: scopedAssets.length > 0 
        ? Math.round(((missing.length + damaged.length) / scopedAssets.length) * 100) 
        : 0,
    };

    return {
      summary,
      report: { verified, missing, damaged, unaudited }
    };
  }
}
export default AuditService;

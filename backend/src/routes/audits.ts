import { Router, Response } from "express";
import { z } from "zod";
import db from "../config/db";
import { authenticateJWT, requireRole, AuthenticatedRequest } from "../middleware/auth";
import { logActivity, createNotification } from "../utils/activity";

const router = Router();

// Zod schemas
const createCycleSchema = z.object({
  scope_department_id: z.number().int().nullable().optional(),
  scope_location: z.string().nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
  auditor_ids: z.array(z.number().int()).min(1, "Must assign at least one auditor"),
});

const submitResultSchema = z.object({
  asset_id: z.number().int(),
  result: z.enum(["Verified", "Missing", "Damaged"]),
  notes: z.string().optional().nullable(),
});

// GET all audit cycles
router.get("/cycles", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const list = await db("audit_cycles")
      .select(
        "audit_cycles.*",
        "departments.name as department_name"
      )
      .leftJoin("departments", "audit_cycles.scope_department_id", "departments.id")
      .orderBy("audit_cycles.start_date", "desc");

    // Fetch auditors for each cycle
    const cyclesWithAuditors = await Promise.all(
      list.map(async (cycle) => {
        const auditors = await db("audit_assignments")
          .select("employees.id", "employees.name", "employees.email")
          .join("employees", "audit_assignments.auditor_employee_id", "employees.id")
          .where("audit_assignments.audit_cycle_id", cycle.id);
        return { ...cycle, auditors };
      })
    );

    return res.json({ cycles: cyclesWithAuditors });
  } catch (error) {
    console.error("Fetch audit cycles error:", error);
    return res.status(500).json({ error: "Internal server error fetching audit cycles" });
  }
});

// GET single audit cycle details with results
router.get("/cycles/:id", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const cycle = await db("audit_cycles")
      .select("audit_cycles.*", "departments.name as department_name")
      .leftJoin("departments", "audit_cycles.scope_department_id", "departments.id")
      .where("audit_cycles.id", id)
      .first();

    if (!cycle) {
      return res.status(404).json({ error: "Audit cycle not found" });
    }

    const auditors = await db("audit_assignments")
      .select("employees.id", "employees.name", "employees.email")
      .join("employees", "audit_assignments.auditor_employee_id", "employees.id")
      .where("audit_assignments.audit_cycle_id", id);

    const results = await db("audit_results")
      .select("audit_results.*", "assets.name as asset_name", "assets.asset_tag", "assets.serial_number")
      .join("assets", "audit_results.asset_id", "assets.id")
      .where("audit_results.audit_cycle_id", id);

    return res.json({ cycle, auditors, results });
  } catch (error) {
    console.error("Fetch single audit cycle error:", error);
    return res.status(500).json({ error: "Internal server error fetching audit cycle details" });
  }
});

// POST create audit cycle (Admin only)
router.post("/cycles", authenticateJWT, requireRole(["Admin"]), async (req: AuthenticatedRequest, res) => {
  try {
    const data = createCycleSchema.parse(req.body);

    if (data.start_date > data.end_date) {
      return res.status(400).json({ error: "Start date must be before or equal to end date" });
    }

    if (data.scope_department_id) {
      const dept = await db("departments").where({ id: data.scope_department_id }).first();
      if (!dept) {
        return res.status(400).json({ error: "Scope department does not exist" });
      }
    }

    // Insert cycle & auditors inside transaction
    const result = await db.transaction(async (trx) => {
      const [newCycle] = await trx("audit_cycles")
        .insert({
          scope_department_id: data.scope_department_id || null,
          scope_location: data.scope_location || null,
          start_date: data.start_date,
          end_date: data.end_date,
          status: "Open",
        })
        .returning("*");

      // Insert assignments
      const assignments = data.auditor_ids.map((auditorId) => ({
        audit_cycle_id: newCycle.id,
        auditor_employee_id: auditorId,
      }));

      await trx("audit_assignments").insert(assignments);

      // Notify auditors
      for (const auditorId of data.auditor_ids) {
        await createNotification(
          auditorId,
          "Audit",
          `You have been assigned as an auditor for Audit Cycle ID ${newCycle.id} starting on ${data.start_date}.`
        );
      }

      await logActivity(req.user!.id, `Created audit cycle ${newCycle.id}`, "AuditCycle", newCycle.id);

      return newCycle;
    });

    return res.status(201).json({ message: "Audit cycle created and auditors assigned successfully", cycle: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Create audit cycle error:", error);
    return res.status(500).json({ error: "Internal server error creating audit cycle" });
  }
});

// POST submit audit result for asset (Auditors only)
router.post("/cycles/:id/results", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const data = submitResultSchema.parse(req.body);

    const result = await db.transaction(async (trx) => {
      const cycle = await trx("audit_cycles").where({ id }).forUpdate().first();
      if (!cycle) {
        return { status: 404, error: "Audit cycle not found" };
      }

      if (cycle.status !== "Open") {
        return { status: 400, error: "Audit cycle is closed. Results are locked and cannot be modified." };
      }

      // Check if employee is assigned auditor, or is Admin
      const isAssigned = await trx("audit_assignments")
        .where({ audit_cycle_id: id, auditor_employee_id: req.user!.id })
        .first();

      if (!isAssigned && req.user!.role !== "Admin") {
        return { status: 403, error: "You are not assigned as an auditor for this audit cycle." };
      }

      const asset = await trx("assets").where({ id: data.asset_id }).first();
      if (!asset) {
        return { status: 404, error: "Asset not found" };
      }

      // Upsert result
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
        req.user!.id,
        `Recorded audit result '${data.result}' for asset ${asset.asset_tag} in cycle ${id}`,
        "AuditResult",
        auditResult.id
      );

      return { status: 200, auditResult };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({ message: "Audit result recorded successfully", result: result.auditResult });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Submit audit result error:", error);
    return res.status(500).json({ error: "Internal server error saving audit result" });
  }
});

// POST close audit cycle (Admin only) - updates asset statuses automatically
router.post("/cycles/:id/close", authenticateJWT, requireRole(["Admin"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await db.transaction(async (trx) => {
      const cycle = await trx("audit_cycles").where({ id }).forUpdate().first();
      if (!cycle) {
        return { status: 404, error: "Audit cycle not found" };
      }

      if (cycle.status === "Closed") {
        return { status: 400, error: "Audit cycle is already closed." };
      }

      // Close cycle
      const [closedCycle] = await trx("audit_cycles")
        .where({ id })
        .update({
          status: "Closed",
          updated_at: trx.fn.now(),
        })
        .returning("*");

      // Fetch all results
      const results = await trx("audit_results").where({ audit_cycle_id: id });

      // Auto update asset status based on results
      for (const resItem of results) {
        const asset = await trx("assets").where({ id: resItem.asset_id }).first();
        if (!asset) continue;

        if (resItem.result === "Missing") {
          // Flag asset as Lost
          await trx("assets").where({ id: asset.id }).update({
            status: "Lost",
            updated_at: trx.fn.now(),
          });

          // Log and raise notification for managers
          const managers = await trx("employees").where({ role: "AssetManager", status: "Active" }).select("id");
          for (const mgr of managers) {
            await createNotification(
              mgr.id,
              "System",
              `Asset ${asset.asset_tag} (${asset.name}) was confirmed MISSING in Audit Cycle ${id} and is now flagged as Lost.`
            );
          }
        } else if (resItem.result === "Damaged") {
          // Flag asset as UnderMaintenance & condition to Damaged
          await trx("assets").where({ id: asset.id }).update({
            status: "UnderMaintenance",
            condition: "Damaged",
            updated_at: trx.fn.now(),
          });

          // Create a draft maintenance request
          await trx("maintenance_requests").insert({
            asset_id: asset.id,
            raised_by_employee_id: req.user!.id,
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

      await logActivity(req.user!.id, `Closed audit cycle ${id}`, "AuditCycle", Number(id));

      return { status: 200, cycle: closedCycle };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({ message: "Audit cycle closed successfully. Asset statuses updated.", cycle: result.cycle });
  } catch (error) {
    console.error("Close audit cycle error:", error);
    return res.status(500).json({ error: "Internal server error closing audit cycle" });
  }
});

// GET dynamic discrepancy report for audit cycle
router.get("/cycles/:id/report", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const cycle = await db("audit_cycles").where({ id }).first();
    if (!cycle) {
      return res.status(404).json({ error: "Audit cycle not found" });
    }

    // 1. Determine assets in scope
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

    // 2. Fetch results for this cycle
    const results = await db("audit_results")
      .select("audit_results.*", "employees.name as auditor_name")
      .leftJoin("employees", "audit_results.created_at", "employees.name") // Note: actually just raw join
      .where("audit_results.audit_cycle_id", id);

    // Group results by asset_id
    const resultsMap = new Map(results.map((r) => [r.asset_id, r]));

    // 3. Compile report
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

    // Summary statistics
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

    return res.json({
      summary,
      report: {
        verified,
        missing,
        damaged,
        unaudited,
      },
    });
  } catch (error) {
    console.error("Fetch audit report error:", error);
    return res.status(500).json({ error: "Internal server error generating audit report" });
  }
});

export default router;

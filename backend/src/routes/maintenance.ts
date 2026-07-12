import { Router, Response } from "express";
import { z } from "zod";
import db from "../config/db";
import { authenticateJWT, requireRole, AuthenticatedRequest } from "../middleware/auth";
import { logActivity, createNotification } from "../utils/activity";

const router = Router();

// Zod schemas
const createRequestSchema = z.object({
  asset_id: z.number().int(),
  issue_description: z.string().min(5, "Issue description must be at least 5 characters"),
  priority: z.enum(["Low", "Medium", "High", "Critical"]),
  photo_url: z.string().url("Invalid photo URL").or(z.string().length(0)).nullable().optional(),
});

const assignTechSchema = z.object({
  technician_name: z.string().min(2, "Technician name is required"),
  status: z.enum(["TechnicianAssigned", "InProgress"]).optional().default("TechnicianAssigned"),
});

// GET all maintenance requests
router.get("/", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, priority, asset_id } = req.query;

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

    if (status) {
      query = query.where("maintenance_requests.status", String(status));
    }

    if (priority) {
      query = query.where("maintenance_requests.priority", String(priority));
    }

    if (asset_id) {
      query = query.where("maintenance_requests.asset_id", Number(asset_id));
    }

    // Standard employee only sees requests they raised
    if (req.user!.role === "Employee") {
      query = query.where("maintenance_requests.raised_by_employee_id", req.user!.id);
    } else if (req.user!.role === "DepartmentHead") {
      // Dept Head sees department requests
      query = query.where(function () {
        this.where("employees.department_id", req.user!.department_id)
          .orWhere("maintenance_requests.raised_by_employee_id", req.user!.id);
      });
    }

    const requests = await query.orderBy("maintenance_requests.id", "desc");
    return res.json({ requests });
  } catch (error) {
    console.error("Fetch maintenance error:", error);
    return res.status(500).json({ error: "Internal server error fetching maintenance requests" });
  }
});

// POST raise a maintenance request
router.post("/", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const data = createRequestSchema.parse(req.body);

    const asset = await db("assets").where({ id: data.asset_id }).first();
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }

    const [newRequest] = await db("maintenance_requests")
      .insert({
        asset_id: data.asset_id,
        raised_by_employee_id: req.user!.id,
        issue_description: data.issue_description,
        priority: data.priority,
        photo_url: data.photo_url || null,
        status: "Pending",
      })
      .returning("*");

    // Notify Asset Managers
    const assetManagers = await db("employees").where({ role: "AssetManager", status: "Active" }).select("id");
    for (const mgr of assetManagers) {
      await createNotification(
        mgr.id,
        "Maintenance",
        `New maintenance request raised for ${asset.asset_tag} (${data.priority} priority) by ${req.user!.name}.`
      );
    }

    await logActivity(req.user!.id, `Raised maintenance request for asset ${asset.asset_tag}`, "MaintenanceRequest", newRequest.id);

    return res.status(201).json({ message: "Maintenance request raised successfully", request: newRequest });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Raise maintenance error:", error);
    return res.status(500).json({ error: "Internal server error raising maintenance request" });
  }
});

// POST approve request (Asset Manager only) - flips asset status to UnderMaintenance
router.post("/:id/approve", authenticateJWT, requireRole(["AssetManager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await db.transaction(async (trx) => {
      const request = await trx("maintenance_requests").where({ id }).forUpdate().first();
      if (!request) {
        return { status: 404, error: "Maintenance request not found" };
      }

      if (request.status !== "Pending") {
        return { status: 400, error: `Request has already been ${request.status.toLowerCase()}` };
      }

      const asset = await trx("assets").where({ id: request.asset_id }).forUpdate().first();
      if (!asset) {
        return { status: 404, error: "Asset not found" };
      }

      // Flip asset status to UnderMaintenance
      await trx("assets").where({ id: asset.id }).update({
        status: "UnderMaintenance",
        updated_at: trx.fn.now(),
      });

      // Update request status
      const [updatedRequest] = await trx("maintenance_requests")
        .where({ id })
        .update({
          status: "Approved",
          approved_by: req.user!.id,
          updated_at: trx.fn.now(),
        })
        .returning("*");

      // Notify requester
      await createNotification(
        request.raised_by_employee_id,
        "Maintenance",
        `Your maintenance request for asset ${asset.asset_tag} has been approved. Status is now Under Maintenance.`
      );

      await logActivity(req.user!.id, `Approved maintenance request ${id} for asset ${asset.asset_tag}`, "MaintenanceRequest", Number(id));

      return { status: 200, request: updatedRequest };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({ message: "Maintenance request approved. Asset status set to Under Maintenance.", request: result.request });
  } catch (error) {
    console.error("Approve maintenance error:", error);
    return res.status(500).json({ error: "Internal server error approving maintenance request" });
  }
});

// POST assign technician (Asset Manager only)
router.post("/:id/assign", authenticateJWT, requireRole(["AssetManager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const data = assignTechSchema.parse(req.body);

    const result = await db.transaction(async (trx) => {
      const request = await trx("maintenance_requests").where({ id }).forUpdate().first();
      if (!request) {
        return { status: 404, error: "Maintenance request not found" };
      }

      const forbiddenStatuses = ["Pending", "Rejected", "Resolved"];
      if (forbiddenStatuses.includes(request.status)) {
        return { status: 400, error: `Cannot assign technician to a request that is ${request.status.toLowerCase()}` };
      }

      const [updatedRequest] = await trx("maintenance_requests")
        .where({ id })
        .update({
          status: data.status,
          technician_name: data.technician_name,
          updated_at: trx.fn.now(),
        })
        .returning("*");

      await logActivity(req.user!.id, `Assigned technician '${data.technician_name}' to request ${id}`, "MaintenanceRequest", Number(id));

      return { status: 200, request: updatedRequest };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({ message: "Technician assigned successfully", request: result.request });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Assign technician error:", error);
    return res.status(500).json({ error: "Internal server error assigning technician" });
  }
});

// POST resolve request (Asset Manager only) - flips asset status back to Available
router.post("/:id/resolve", authenticateJWT, requireRole(["AssetManager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await db.transaction(async (trx) => {
      const request = await trx("maintenance_requests").where({ id }).forUpdate().first();
      if (!request) {
        return { status: 404, error: "Maintenance request not found" };
      }

      const activeStatuses = ["Approved", "TechnicianAssigned", "InProgress"];
      if (!activeStatuses.includes(request.status)) {
        return { status: 400, error: `Cannot resolve a maintenance request that is ${request.status.toLowerCase()}` };
      }

      const asset = await trx("assets").where({ id: request.asset_id }).forUpdate().first();
      if (!asset) {
        return { status: 404, error: "Asset not found" };
      }

      // Flip asset status back to Available
      await trx("assets").where({ id: asset.id }).update({
        status: "Available",
        updated_at: trx.fn.now(),
      });

      // Close request
      const [updatedRequest] = await trx("maintenance_requests")
        .where({ id })
        .update({
          status: "Resolved",
          updated_at: trx.fn.now(),
        })
        .returning("*");

      // Notify requester
      await createNotification(
        request.raised_by_employee_id,
        "Maintenance",
        `Maintenance completed for asset '${asset.name}' (${asset.asset_tag}). Status is now back to Available.`
      );

      await logActivity(req.user!.id, `Resolved maintenance request ${id} for asset ${asset.asset_tag}`, "MaintenanceRequest", Number(id));

      return { status: 200, request: updatedRequest };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({ message: "Maintenance request resolved. Asset returned to Available status.", request: result.request });
  } catch (error) {
    console.error("Resolve maintenance error:", error);
    return res.status(500).json({ error: "Internal server error resolving maintenance request" });
  }
});

// POST reject request (Asset Manager only)
router.post("/:id/reject", authenticateJWT, requireRole(["AssetManager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await db.transaction(async (trx) => {
      const request = await trx("maintenance_requests").where({ id }).forUpdate().first();
      if (!request) {
        return { status: 404, error: "Maintenance request not found" };
      }

      if (request.status !== "Pending") {
        return { status: 400, error: `Cannot reject a request that is already ${request.status.toLowerCase()}` };
      }

      const [updatedRequest] = await trx("maintenance_requests")
        .where({ id })
        .update({
          status: "Rejected",
          approved_by: req.user!.id,
          updated_at: trx.fn.now(),
        })
        .returning("*");

      // Notify requester
      await createNotification(
        request.raised_by_employee_id,
        "Maintenance",
        `Your maintenance request for asset ID ${request.asset_id} has been rejected.`
      );

      await logActivity(req.user!.id, `Rejected maintenance request ${id}`, "MaintenanceRequest", Number(id));

      return { status: 200, request: updatedRequest };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({ message: "Maintenance request rejected", request: result.request });
  } catch (error) {
    console.error("Reject maintenance error:", error);
    return res.status(500).json({ error: "Internal server error rejecting maintenance request" });
  }
});

export default router;

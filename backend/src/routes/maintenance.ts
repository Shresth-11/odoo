import { Router } from "express";
import { z } from "zod";
import { authenticateJWT, requireRole, AuthenticatedRequest } from "../middleware/auth";
import MaintenanceService from "../services/MaintenanceService";

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
    const requests = await MaintenanceService.listRequests(
      req.user!.role,
      req.user!.id,
      req.user!.department_id,
      { status, priority, asset_id }
    );
    return res.json({ requests });
  } catch (error) {
    console.error("Fetch maintenance route error:", error);
    return res.status(500).json({ error: "Internal server error fetching maintenance requests" });
  }
});

// POST raise a maintenance request
router.post("/", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const data = createRequestSchema.parse(req.body);
    const request = await MaintenanceService.raiseRequest(data, { id: req.user!.id, name: req.user!.name });
    return res.status(201).json({ message: "Maintenance request raised successfully", request });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.message === "Asset not found") {
      return res.status(404).json({ error: error.message });
    }
    console.error("Raise maintenance route error:", error);
    return res.status(500).json({ error: "Internal server error raising maintenance request" });
  }
});

// POST approve request (Asset Manager only) - flips asset status to UnderMaintenance
router.post("/:id/approve", authenticateJWT, requireRole(["AssetManager", "Admin"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const request = await MaintenanceService.approveRequest(id, req.user!.id);
    return res.json({ message: "Maintenance request approved. Asset status set to Under Maintenance.", request });
  } catch (error: any) {
    if (error.message === "Maintenance request not found" || error.message === "Asset not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("already")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Approve maintenance route error:", error);
    return res.status(500).json({ error: "Internal server error approving maintenance request" });
  }
});

// POST assign technician (Asset Manager only)
router.post("/:id/assign", authenticateJWT, requireRole(["AssetManager", "Admin"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const data = assignTechSchema.parse(req.body);
    const request = await MaintenanceService.assignTechnician(id, data, req.user!.id);
    return res.json({ message: "Technician assigned successfully", request });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.message === "Maintenance request not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Cannot assign")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Assign technician route error:", error);
    return res.status(500).json({ error: "Internal server error assigning technician" });
  }
});

// POST resolve request (Asset Manager only) - flips asset status back to Available
router.post("/:id/resolve", authenticateJWT, requireRole(["AssetManager", "Admin"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const request = await MaintenanceService.resolveRequest(id, req.user!.id);
    return res.json({ message: "Maintenance request resolved. Asset returned to Available status.", request });
  } catch (error: any) {
    if (error.message === "Maintenance request not found" || error.message === "Asset not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Cannot resolve")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Resolve maintenance route error:", error);
    return res.status(500).json({ error: "Internal server error resolving maintenance request" });
  }
});

// POST reject request (Asset Manager only)
router.post("/:id/reject", authenticateJWT, requireRole(["AssetManager", "Admin"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const request = await MaintenanceService.rejectRequest(id, req.user!.id);
    return res.json({ message: "Maintenance request rejected", request });
  } catch (error: any) {
    if (error.message === "Maintenance request not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Cannot reject")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Reject maintenance route error:", error);
    return res.status(500).json({ error: "Internal server error rejecting maintenance request" });
  }
});

export default router;

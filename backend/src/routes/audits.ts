import { Router } from "express";
import { z } from "zod";
import { authenticateJWT, requireRole, AuthenticatedRequest } from "../middleware/auth";
import AuditService from "../services/AuditService";

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
    const cycles = await AuditService.listCycles();
    return res.json({ cycles });
  } catch (error) {
    console.error("Fetch audit cycles route error:", error);
    return res.status(500).json({ error: "Internal server error fetching audit cycles" });
  }
});

// GET single audit cycle details with results
router.get("/cycles/:id", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const details = await AuditService.getCycleDetails(id);
    return res.json(details);
  } catch (error: any) {
    if (error.message === "Audit cycle not found") {
      return res.status(404).json({ error: error.message });
    }
    console.error("Fetch single audit cycle route error:", error);
    return res.status(500).json({ error: "Internal server error fetching audit cycle details" });
  }
});

// POST create audit cycle (Admin only)
router.post("/cycles", authenticateJWT, requireRole(["Admin"]), async (req: AuthenticatedRequest, res) => {
  try {
    const data = createCycleSchema.parse(req.body);
    const cycle = await AuditService.createCycle(data, req.user!.id);
    return res.status(201).json({ message: "Audit cycle created and auditors assigned successfully", cycle });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (
      error.message === "Start date must be before or equal to end date" ||
      error.message === "Scope department does not exist"
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Create audit cycle route error:", error);
    return res.status(500).json({ error: "Internal server error creating audit cycle" });
  }
});

// POST submit audit result for asset (Auditors only)
router.post("/cycles/:id/results", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const data = submitResultSchema.parse(req.body);
    const result = await AuditService.submitResult(id, data, req.user!.id, req.user!.role);
    return res.json({ message: "Audit result recorded successfully", result });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.message === "Audit cycle not found" || error.message === "Asset not found") {
      return res.status(404).json({ error: error.message });
    }
    if (
      error.message.includes("is closed") ||
      error.message.includes("already")
    ) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes("not assigned as an auditor")) {
      return res.status(403).json({ error: error.message });
    }
    console.error("Submit audit result route error:", error);
    return res.status(500).json({ error: "Internal server error saving audit result" });
  }
});

// POST close audit cycle (Admin only) - updates asset statuses automatically
router.post("/cycles/:id/close", authenticateJWT, requireRole(["Admin"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const cycle = await AuditService.closeCycle(id, req.user!.id);
    return res.json({ message: "Audit cycle closed successfully. Asset statuses updated.", cycle });
  } catch (error: any) {
    if (error.message === "Audit cycle not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("already")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Close audit cycle route error:", error);
    return res.status(500).json({ error: "Internal server error closing audit cycle" });
  }
});

// GET dynamic discrepancy report for audit cycle
router.get("/cycles/:id/report", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const reportData = await AuditService.getCycleReport(id);
    return res.json(reportData);
  } catch (error: any) {
    if (error.message === "Audit cycle not found") {
      return res.status(404).json({ error: error.message });
    }
    console.error("Fetch audit report route error:", error);
    return res.status(500).json({ error: "Internal server error generating audit report" });
  }
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { authenticateJWT, requireRole, AuthenticatedRequest } from "../middleware/auth";
import AllocationService from "../services/AllocationService";

const router = Router();

// Zod schemas
const allocateSchema = z.object({
  asset_id: z.number().int(),
  employee_id: z.number().int().nullable().optional(),
  department_id: z.number().int().nullable().optional(),
  expected_return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected return date must be YYYY-MM-DD"),
  condition_notes: z.string().optional(),
}).refine(
  (data) => (data.employee_id && !data.department_id) || (!data.employee_id && data.department_id),
  { message: "Must allocate to exactly one target (either employee_id or department_id)" }
);

const returnSchema = z.object({
  condition_notes: z.string().optional(),
});

const transferRequestSchema = z.object({
  asset_id: z.number().int(),
  to_employee_id: z.number().int(),
});

// GET all allocations
router.get("/", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, employee_id, department_id } = req.query;
    const allocations = await AllocationService.listAllocations(
      req.user!.role,
      req.user!.id,
      req.user!.department_id,
      { status, employee_id, department_id }
    );
    return res.json({ allocations });
  } catch (error) {
    console.error("Fetch allocations route error:", error);
    return res.status(500).json({ error: "Internal server error fetching allocations" });
  }
});

// POST allocate an asset (Asset Manager only)
router.post("/", authenticateJWT, requireRole(["AssetManager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const data = allocateSchema.parse(req.body);
    const allocation = await AllocationService.allocateAsset(data, { id: req.user!.id, name: req.user!.name });
    return res.status(201).json({ message: "Asset allocated successfully", allocation });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.message.includes("already Allocated") || error.message === "Expected return date cannot be in the past" || error.message.includes("does not exist")) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === "Asset not found") {
      return res.status(404).json({ error: error.message });
    }
    console.error("Create allocation route error:", error);
    return res.status(500).json({ error: "Internal server error creating allocation" });
  }
});

// POST return allocated asset (Asset Manager only)
router.post("/:id/return", authenticateJWT, requireRole(["AssetManager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const data = returnSchema.parse(req.body);
    const allocation = await AllocationService.returnAsset(id, data, req.user!.id);
    return res.json({ message: "Asset returned successfully", allocation });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.message === "Allocation record not found" || error.message === "Asset not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === "Asset has already been returned") {
      return res.status(400).json({ error: error.message });
    }
    console.error("Return allocation route error:", error);
    return res.status(500).json({ error: "Internal server error returning asset" });
  }
});

// ================= TRANSFERS =================

// GET all transfer requests
router.get("/transfers", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const transfers = await AllocationService.listTransfers(req.user!.role, req.user!.id, req.user!.department_id);
    return res.json({ transfers });
  } catch (error) {
    console.error("Fetch transfers route error:", error);
    return res.status(500).json({ error: "Internal server error fetching transfer requests" });
  }
});

// POST raise a transfer request
router.post("/transfers", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const data = transferRequestSchema.parse(req.body);
    const transfer = await AllocationService.raiseTransfer(data, {
      id: req.user!.id,
      name: req.user!.name,
      role: req.user!.role,
      department_id: req.user!.department_id,
    });
    return res.status(201).json({ message: "Transfer request raised successfully", transfer });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.message === "Asset not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("must be currently allocated") || error.message.includes("does not exist") || error.message.includes("already allocated")) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes("You can only request transfers")) {
      return res.status(403).json({ error: error.message });
    }
    console.error("Create transfer route error:", error);
    return res.status(500).json({ error: "Internal server error creating transfer request" });
  }
});

// POST approve transfer request (Asset Manager only)
router.post("/transfers/:id/approve", authenticateJWT, requireRole(["AssetManager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const transfer = await AllocationService.approveTransfer(id, req.user!.id);
    return res.json({ message: "Transfer request approved and asset reallocated", transfer });
  } catch (error: any) {
    if (error.message === "Transfer request not found" || error.message === "Asset not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("already")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Approve transfer route error:", error);
    return res.status(500).json({ error: "Internal server error approving transfer request" });
  }
});

// POST reject transfer request (Asset Manager only)
router.post("/transfers/:id/reject", authenticateJWT, requireRole(["AssetManager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const transfer = await AllocationService.rejectTransfer(id, req.user!.id);
    return res.json({ message: "Transfer request rejected", transfer });
  } catch (error: any) {
    if (error.message === "Transfer request not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("already")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Reject transfer route error:", error);
    return res.status(500).json({ error: "Internal server error rejecting transfer request" });
  }
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { authenticateJWT, requireRole, AuthenticatedRequest } from "../middleware/auth";
import AssetService from "../services/AssetService";

const router = Router();

// Zod schema for validation
const assetSchema = z.object({
  name: z.string().min(2, "Asset name must be at least 2 characters"),
  category_id: z.number().int("Category ID must be a valid integer"),
  serial_number: z.string().min(1, "Serial number is required").nullable().optional(),
  acquisition_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Acquisition date must be YYYY-MM-DD"),
  acquisition_cost: z.number().nonnegative("Acquisition cost cannot be negative"),
  condition: z.enum(["New", "Good", "Fair", "Poor", "Damaged"]),
  location: z.string().min(2, "Location must be at least 2 characters"),
  is_bookable: z.boolean().default(false),
  status: z.enum(["Available", "Allocated", "Reserved", "UnderMaintenance", "Lost", "Retired", "Disposed"]).optional(),
  photo_url: z.string().url("Invalid photo URL").or(z.string().length(0)).nullable().optional(),
});

// GET list of assets (Filtered & Searched)
router.get("/", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { search, category_id, status, location, is_bookable } = req.query;
    const assets = await AssetService.listAssets({ search, category_id, status, location, is_bookable });
    return res.json({ assets });
  } catch (error) {
    console.error("Fetch assets route error:", error);
    return res.status(500).json({ error: "Internal server error fetching assets" });
  }
});

// GET single asset details
router.get("/:id", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const asset = await AssetService.getAssetById(id);
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }
    return res.json({ asset });
  } catch (error) {
    console.error("Fetch single asset route error:", error);
    return res.status(500).json({ error: "Internal server error fetching asset details" });
  }
});

// GET asset history (Allocations, Bookings, Maintenances, Audits)
router.get("/:id/history", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const history = await AssetService.getAssetHistory(id);
    return res.json(history);
  } catch (error: any) {
    if (error.message === "Asset not found") {
      return res.status(404).json({ error: error.message });
    }
    console.error("Fetch asset history route error:", error);
    return res.status(500).json({ error: "Internal server error fetching asset history" });
  }
});

// POST register new asset (Asset Manager only)
router.post(
  "/",
  authenticateJWT,
  requireRole(["AssetManager", "Admin", "DepartmentHead", "Employee"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = assetSchema.parse(req.body);
      const newAsset = await AssetService.registerAsset(data, req.user!.id);
      return res.status(201).json({
        message: "Asset registered successfully",
        asset: newAsset,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      if (
        error.message === "Specified asset category does not exist" ||
        error.message === "An asset with this serial number is already registered"
      ) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Register asset route error:", error);
      return res.status(500).json({
        error: "Internal server error registering asset",
        message: error.message,
        stack: error.stack
      });
    }
  }
);

// PUT update asset details (Asset Manager only)
router.put(
  "/:id",
  authenticateJWT,
  requireRole(["AssetManager", "Admin"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const data = assetSchema.parse(req.body);
      const updatedAsset = await AssetService.updateAsset(id, data, req.user!.id);
      return res.json({
        message: "Asset updated successfully",
        asset: updatedAsset,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      if (error.message === "Asset not found") {
        return res.status(404).json({ error: error.message });
      }
      if (
        error.message === "Another asset already uses this serial number" ||
        error.message === "Specified asset category does not exist"
      ) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Update asset route error:", error);
      return res.status(500).json({ error: "Internal server error updating asset" });
    }
  }
);

export default router;

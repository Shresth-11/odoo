import { Router, Response } from "express";
import { z } from "zod";
import db from "../config/db";
import { authenticateJWT, requireRole, AuthenticatedRequest } from "../middleware/auth";
import { logActivity, createNotification } from "../utils/activity";

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

    if (status) {
      query = query.where("asset_allocations.status", String(status));
    }

    // Role-based scoping for standard Employees
    if (req.user!.role === "Employee") {
      query = query.where("asset_allocations.employee_id", req.user!.id);
    } else if (req.user!.role === "DepartmentHead") {
      // Dept head sees all department allocations or own allocations
      query = query.where(function () {
        this.where("asset_allocations.department_id", req.user!.department_id)
          .orWhere("asset_allocations.employee_id", req.user!.id)
          .orWhere("employees.department_id", req.user!.department_id);
      });
    } else {
      // Admin and Asset Manager can filter as requested
      if (employee_id) {
        query = query.where("asset_allocations.employee_id", Number(employee_id));
      }
      if (department_id) {
        query = query.where("asset_allocations.department_id", Number(department_id));
      }
    }

    const allocations = await query.orderBy("asset_allocations.id", "desc");
    return res.json({ allocations });
  } catch (error) {
    console.error("Fetch allocations error:", error);
    return res.status(500).json({ error: "Internal server error fetching allocations" });
  }
});

// POST allocate an asset (Asset Manager only)
router.post("/", authenticateJWT, requireRole(["AssetManager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const data = allocateSchema.parse(req.body);

    // Validate expected return date is today or in the future
    const todayStr = new Date().toISOString().split("T")[0];
    if (data.expected_return_date < todayStr) {
      return res.status(400).json({ error: "Expected return date cannot be in the past" });
    }

    // Use a transaction and database lock to prevent race conditions (double allocation)
    const result = await db.transaction(async (trx) => {
      // Lock asset
      const asset = await trx("assets").where({ id: data.asset_id }).forUpdate().first();

      if (!asset) {
        return { status: 404, error: "Asset not found" };
      }

      // Check if not Available
      if (asset.status !== "Available") {
        // Fetch current active allocation to display who holds it
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

        return {
          status: 400,
          error: `Asset ${asset.asset_tag} already Allocated. Currently held by: ${holderName}. Please request a Transfer Request instead.`,
        };
      }

      // Validate targets
      if (data.employee_id) {
        const emp = await trx("employees").where({ id: data.employee_id }).first();
        if (!emp) return { status: 400, error: "Specified employee does not exist" };
      } else if (data.department_id) {
        const dept = await trx("departments").where({ id: data.department_id }).first();
        if (!dept) return { status: 400, error: "Specified department does not exist" };
      }

      // Update asset status
      await trx("assets").where({ id: data.asset_id }).update({ status: "Allocated", updated_at: trx.fn.now() });

      // Create allocation record
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

      // Notify employee if allocated to specific employee
      if (data.employee_id) {
        await createNotification(
          data.employee_id,
          "Allocation",
          `Physical asset '${asset.name}' (${asset.asset_tag}) has been allocated to you. Expected return: ${data.expected_return_date}.`
        );
      } else if (data.department_id) {
        // Notify Department Head if allocated to a department
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
        req.user!.id,
        `Allocated asset ${asset.asset_tag} to ${data.employee_id ? "employee " + data.employee_id : "department " + data.department_id}`,
        "AssetAllocation",
        newAllocation.id
      );

      return { status: 201, allocation: newAllocation };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(201).json({ message: "Asset allocated successfully", allocation: result.allocation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Create allocation error:", error);
    return res.status(500).json({ error: "Internal server error creating allocation" });
  }
});

// POST return allocated asset (Asset Manager only)
router.post("/:id/return", authenticateJWT, requireRole(["AssetManager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const data = returnSchema.parse(req.body);

    const result = await db.transaction(async (trx) => {
      const allocation = await trx("asset_allocations").where({ id }).forUpdate().first();
      if (!allocation) {
        return { status: 404, error: "Allocation record not found" };
      }

      if (allocation.status !== "Active" && allocation.status !== "Overdue") {
        return { status: 400, error: "Asset has already been returned" };
      }

      // Lock asset
      const asset = await trx("assets").where({ id: allocation.asset_id }).forUpdate().first();
      if (!asset) {
        return { status: 404, error: "Asset not found" };
      }

      // Update asset status to Available
      await trx("assets").where({ id: asset.id }).update({ status: "Available", updated_at: trx.fn.now() });

      // Close allocation
      const [updatedAllocation] = await trx("asset_allocations")
        .where({ id })
        .update({
          status: "Returned",
          actual_return_date: trx.fn.now(),
          condition_notes: data.condition_notes || allocation.condition_notes,
          updated_at: trx.fn.now(),
        })
        .returning("*");

      // Notify user
      if (allocation.employee_id) {
        await createNotification(
          allocation.employee_id,
          "Allocation",
          `Your return of asset '${asset.name}' (${asset.asset_tag}) has been confirmed by the Asset Manager.`
        );
      }

      await logActivity(req.user!.id, `Returned asset: ${asset.asset_tag}`, "AssetAllocation", Number(id));

      return { status: 200, allocation: updatedAllocation };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({ message: "Asset returned successfully", allocation: result.allocation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Return allocation error:", error);
    return res.status(500).json({ error: "Internal server error returning asset" });
  }
});

// ================= TRANSFERS =================

// GET all transfer requests
router.get("/transfers", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
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

    if (req.user!.role === "Employee") {
      // Employees see transfers involving them
      query = query.where(function () {
        this.where("transfer_requests.from_employee_id", req.user!.id).orWhere(
          "transfer_requests.to_employee_id",
          req.user!.id
        );
      });
    } else if (req.user!.role === "DepartmentHead") {
      // Dept heads see their department's transfers
      query = query.where(function () {
        this.where("from_emp.department_id", req.user!.department_id)
          .orWhere("to_emp.department_id", req.user!.department_id)
          .orWhere("transfer_requests.from_employee_id", req.user!.id)
          .orWhere("transfer_requests.to_employee_id", req.user!.id);
      });
    }

    const transfers = await query.orderBy("transfer_requests.id", "desc");
    return res.json({ transfers });
  } catch (error) {
    console.error("Fetch transfers error:", error);
    return res.status(500).json({ error: "Internal server error fetching transfer requests" });
  }
});

// POST raise a transfer request
router.post("/transfers", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const data = transferRequestSchema.parse(req.body);

    const result = await db.transaction(async (trx) => {
      // Check asset is currently allocated
      const asset = await trx("assets").where({ id: data.asset_id }).first();
      if (!asset) {
        return { status: 404, error: "Asset not found" };
      }

      const activeAllocation = await trx("asset_allocations")
        .where({ asset_id: data.asset_id, status: "Active" })
        .first();

      if (!activeAllocation || !activeAllocation.employee_id) {
        return { status: 400, error: "Asset must be currently allocated to an individual employee to initiate a transfer." };
      }

      // Check target employee exists
      const targetEmp = await trx("employees").where({ id: data.to_employee_id }).first();
      if (!targetEmp) {
        return { status: 400, error: "Target employee does not exist" };
      }

      // Standard user can only request transfers FOR assets they own, or to themselves
      if (req.user!.role === "Employee" && activeAllocation.employee_id !== req.user!.id && data.to_employee_id !== req.user!.id) {
        return { status: 403, error: "You can only request transfers for assets allocated to you, or to request an asset be transferred to you." };
      }

      if (activeAllocation.employee_id === data.to_employee_id) {
        return { status: 400, error: "Asset is already allocated to the target employee." };
      }

      // Insert transfer request
      const [newRequest] = await trx("transfer_requests")
        .insert({
          asset_id: data.asset_id,
          from_employee_id: activeAllocation.employee_id,
          to_employee_id: data.to_employee_id,
          status: "Requested",
        })
        .returning("*");

      // Notify the Asset Managers and the current holder
      const assetManagers = await trx("employees").where({ role: "AssetManager", status: "Active" }).select("id");
      for (const mgr of assetManagers) {
        await createNotification(
          mgr.id,
          "Transfer",
          `Transfer request raised for asset ${asset.asset_tag} from ${req.user!.name} to ${targetEmp.name}.`
        );
      }

      if (activeAllocation.employee_id !== req.user!.id) {
        await createNotification(
          activeAllocation.employee_id,
          "Transfer",
          `A transfer request has been raised to move your allocated asset ${asset.asset_tag} to ${targetEmp.name}.`
        );
      }

      await logActivity(req.user!.id, `Requested transfer of asset ${asset.asset_tag} to employee ${data.to_employee_id}`, "TransferRequest", newRequest.id);

      return { status: 201, transfer: newRequest };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(201).json({ message: "Transfer request raised successfully", transfer: result.transfer });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Create transfer error:", error);
    return res.status(500).json({ error: "Internal server error creating transfer request" });
  }
});

// POST approve transfer request (Asset Manager only)
router.post("/transfers/:id/approve", authenticateJWT, requireRole(["AssetManager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await db.transaction(async (trx) => {
      const transfer = await trx("transfer_requests").where({ id }).forUpdate().first();
      if (!transfer) {
        return { status: 404, error: "Transfer request not found" };
      }

      if (transfer.status !== "Requested") {
        return { status: 400, error: `Transfer request is already ${transfer.status.toLowerCase()}` };
      }

      const asset = await trx("assets").where({ id: transfer.asset_id }).forUpdate().first();
      if (!asset) {
        return { status: 404, error: "Asset not found" };
      }

      // Close the active allocation
      const activeAllocation = await trx("asset_allocations")
        .where({ asset_id: transfer.asset_id, status: "Active" })
        .first();

      if (activeAllocation) {
        await trx("asset_allocations")
          .where({ id: activeAllocation.id })
          .update({
            status: "Returned",
            actual_return_date: trx.fn.now(),
            condition_notes: `Transferred to employee ${transfer.to_employee_id}. Approved by Asset Manager ${req.user!.id}`,
            updated_at: trx.fn.now(),
          });
      }

      // Create new active allocation for target employee (defaulting expected return to 6 months from now or keeping old allocation target)
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

      // Update transfer status
      const [updatedTransfer] = await trx("transfer_requests")
        .where({ id })
        .update({
          status: "Completed",
          approved_by: req.user!.id,
          updated_at: trx.fn.now(),
        })
        .returning("*");

      // Notify both parties
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

      await logActivity(req.user!.id, `Approved asset transfer ${id} for asset ${asset.asset_tag}`, "TransferRequest", Number(id));

      return { status: 200, transfer: updatedTransfer };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({ message: "Transfer request approved and asset reallocated", transfer: result.transfer });
  } catch (error) {
    console.error("Approve transfer error:", error);
    return res.status(500).json({ error: "Internal server error approving transfer request" });
  }
});

// POST reject transfer request (Asset Manager only)
router.post("/transfers/:id/reject", authenticateJWT, requireRole(["AssetManager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await db.transaction(async (trx) => {
      const transfer = await trx("transfer_requests").where({ id }).forUpdate().first();
      if (!transfer) {
        return { status: 404, error: "Transfer request not found" };
      }

      if (transfer.status !== "Requested") {
        return { status: 400, error: `Transfer request is already ${transfer.status.toLowerCase()}` };
      }

      const [updatedTransfer] = await trx("transfer_requests")
        .where({ id })
        .update({
          status: "Rejected",
          approved_by: req.user!.id,
          updated_at: trx.fn.now(),
        })
        .returning("*");

      // Notify requester
      await createNotification(
        transfer.to_employee_id,
        "Transfer",
        `Your transfer request for asset ID ${transfer.asset_id} was rejected by the Asset Manager.`
      );

      await logActivity(req.user!.id, `Rejected asset transfer request ${id}`, "TransferRequest", Number(id));

      return { status: 200, transfer: updatedTransfer };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({ message: "Transfer request rejected", transfer: result.transfer });
  } catch (error) {
    console.error("Reject transfer error:", error);
    return res.status(500).json({ error: "Internal server error rejecting transfer request" });
  }
});

export default router;

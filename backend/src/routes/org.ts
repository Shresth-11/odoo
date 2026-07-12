import { Router, Response } from "express";
import { z } from "zod";
import db from "../config/db";
import { authenticateJWT, requireRole, AuthenticatedRequest } from "../middleware/auth";
import { logActivity } from "../utils/activity";

const router = Router();

// Zod schemas
const departmentSchema = z.object({
  name: z.string().min(2, "Department name must be at least 2 characters"),
  parent_department_id: z.number().optional().nullable(),
  department_head_id: z.number().optional().nullable(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

const categorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters"),
  custom_fields: z.record(z.any()).optional().default({}),
});

const roleUpdateSchema = z.object({
  role: z.enum(["Admin", "AssetManager", "DepartmentHead", "Employee"]),
});

const statusUpdateSchema = z.object({
  status: z.enum(["Active", "Inactive", "Suspended"]),
});

// ================= DEPARTMENTS =================

// GET all departments
router.get("/departments", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const list = await db("departments")
      .select(
        "departments.*",
        "parent.name as parent_department_name",
        "employees.name as department_head_name",
        "employees.email as department_head_email"
      )
      .leftJoin("departments as parent", "departments.parent_department_id", "parent.id")
      .leftJoin("employees", "departments.department_head_id", "employees.id")
      .orderBy("departments.name", "asc");

    return res.json({ departments: list });
  } catch (error) {
    console.error("Fetch departments error:", error);
    return res.status(500).json({ error: "Internal server error fetching departments" });
  }
});

// POST create department (Admin only)
router.post(
  "/departments",
  authenticateJWT,
  requireRole(["Admin"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = departmentSchema.parse(req.body);

      // Check duplicate name
      const existing = await db("departments").where({ name: data.name }).first();
      if (existing) {
        return res.status(400).json({ error: "A department with this name already exists" });
      }

      // Check parent department
      if (data.parent_department_id) {
        const parent = await db("departments").where({ id: data.parent_department_id }).first();
        if (!parent) {
          return res.status(400).json({ error: "Parent department does not exist" });
        }
      }

      // Check department head
      if (data.department_head_id) {
        const head = await db("employees").where({ id: data.department_head_id }).first();
        if (!head) {
          return res.status(400).json({ error: "Employee assigned as head does not exist" });
        }
      }

      const [newDept] = await db("departments")
        .insert({
          name: data.name,
          parent_department_id: data.parent_department_id || null,
          department_head_id: data.department_head_id || null,
          status: data.status || "Active",
        })
        .returning("*");

      await logActivity(req.user!.id, `Created department: ${newDept.name}`, "Department", newDept.id);

      return res.status(201).json({ message: "Department created successfully", department: newDept });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Create department error:", error);
      return res.status(500).json({ error: "Internal server error creating department" });
    }
  }
);

// PUT update department (Admin only)
router.put(
  "/departments/:id",
  authenticateJWT,
  requireRole(["Admin"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const data = departmentSchema.parse(req.body);

      const dept = await db("departments").where({ id }).first();
      if (!dept) {
        return res.status(404).json({ error: "Department not found" });
      }

      // Check duplicate name
      const duplicate = await db("departments").where({ name: data.name }).whereNot({ id }).first();
      if (duplicate) {
        return res.status(400).json({ error: "A department with this name already exists" });
      }

      // Prevent circular parent dependency
      if (data.parent_department_id === Number(id)) {
        return res.status(400).json({ error: "A department cannot be its own parent" });
      }

      if (data.parent_department_id) {
        // Validate parent exists
        const parent = await db("departments").where({ id: data.parent_department_id }).first();
        if (!parent) {
          return res.status(400).json({ error: "Parent department does not exist" });
        }
      }

      // Check department head
      if (data.department_head_id) {
        const head = await db("employees").where({ id: data.department_head_id }).first();
        if (!head) {
          return res.status(400).json({ error: "Employee assigned as head does not exist" });
        }
      }

      const [updatedDept] = await db("departments")
        .where({ id })
        .update({
          name: data.name,
          parent_department_id: data.parent_department_id || null,
          department_head_id: data.department_head_id || null,
          status: data.status || "Active",
          updated_at: db.fn.now(),
        })
        .returning("*");

      await logActivity(req.user!.id, `Updated department: ${updatedDept.name}`, "Department", updatedDept.id);

      return res.json({ message: "Department updated successfully", department: updatedDept });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Update department error:", error);
      return res.status(500).json({ error: "Internal server error updating department" });
    }
  }
);

// DELETE department (Admin only)
router.delete(
  "/departments/:id",
  authenticateJWT,
  requireRole(["Admin"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const dept = await db("departments").where({ id }).first();
      if (!dept) {
        return res.status(404).json({ error: "Department not found" });
      }

      // Check sub-departments
      const children = await db("departments").where({ parent_department_id: id }).first();
      if (children) {
        return res.status(400).json({ error: "Cannot delete department with sub-departments" });
      }

      await db("departments").where({ id }).del();
      await logActivity(req.user!.id, `Deleted department: ${dept.name}`, "Department", Number(id));

      return res.json({ message: "Department deleted successfully" });
    } catch (error) {
      console.error("Delete department error:", error);
      return res.status(500).json({ error: "Internal server error deleting department" });
    }
  }
);

// ================= ASSET CATEGORIES =================

// GET all asset categories
router.get("/categories", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const list = await db("asset_categories").select("*").orderBy("name", "asc");
    return res.json({ categories: list });
  } catch (error) {
    console.error("Fetch categories error:", error);
    return res.status(500).json({ error: "Internal server error fetching asset categories" });
  }
});

// POST create asset category (Admin only)
router.post(
  "/categories",
  authenticateJWT,
  requireRole(["Admin"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = categorySchema.parse(req.body);

      const existing = await db("asset_categories").where({ name: data.name }).first();
      if (existing) {
        return res.status(400).json({ error: "An asset category with this name already exists" });
      }

      const [newCat] = await db("asset_categories")
        .insert({
          name: data.name,
          custom_fields: JSON.stringify(data.custom_fields),
        })
        .returning("*");

      await logActivity(req.user!.id, `Created asset category: ${newCat.name}`, "AssetCategory", newCat.id);

      return res.status(201).json({ message: "Category created successfully", category: newCat });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Create category error:", error);
      return res.status(500).json({ error: "Internal server error creating category" });
    }
  }
);

// PUT update asset category (Admin only)
router.put(
  "/categories/:id",
  authenticateJWT,
  requireRole(["Admin"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const data = categorySchema.parse(req.body);

      const cat = await db("asset_categories").where({ id }).first();
      if (!cat) {
        return res.status(404).json({ error: "Category not found" });
      }

      const duplicate = await db("asset_categories").where({ name: data.name }).whereNot({ id }).first();
      if (duplicate) {
        return res.status(400).json({ error: "An asset category with this name already exists" });
      }

      const [updatedCat] = await db("asset_categories")
        .where({ id })
        .update({
          name: data.name,
          custom_fields: JSON.stringify(data.custom_fields),
          updated_at: db.fn.now(),
        })
        .returning("*");

      await logActivity(req.user!.id, `Updated asset category: ${updatedCat.name}`, "AssetCategory", updatedCat.id);

      return res.json({ message: "Category updated successfully", category: updatedCat });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Update category error:", error);
      return res.status(500).json({ error: "Internal server error updating category" });
    }
  }
);

// DELETE asset category (Admin only)
router.delete(
  "/categories/:id",
  authenticateJWT,
  requireRole(["Admin"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const cat = await db("asset_categories").where({ id }).first();
      if (!cat) {
        return res.status(404).json({ error: "Category not found" });
      }

      // Will fail with FK restriction check if assets exist in this category
      await db("asset_categories").where({ id }).del();
      await logActivity(req.user!.id, `Deleted asset category: ${cat.name}`, "AssetCategory", Number(id));

      return res.json({ message: "Category deleted successfully" });
    } catch (error: any) {
      // Catch foreign key violations
      if (error.code === "23503") {
        return res.status(400).json({
          error: "Cannot delete category: physical assets are currently registered under this category.",
        });
      }
      console.error("Delete category error:", error);
      return res.status(500).json({ error: "Internal server error deleting category" });
    }
  }
);

// ================= EMPLOYEE DIRECTORY =================

// GET all employees
router.get("/employees", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const list = await db("employees")
      .select(
        "employees.id",
        "employees.name",
        "employees.email",
        "employees.role",
        "employees.status",
        "employees.department_id",
        "departments.name as department_name"
      )
      .leftJoin("departments", "employees.department_id", "departments.id")
      .orderBy("employees.name", "asc");

    return res.json({ employees: list });
  } catch (error) {
    console.error("Fetch employees error:", error);
    return res.status(500).json({ error: "Internal server error fetching employees" });
  }
});

// PUT promote/demote employee role (Admin only)
router.put(
  "/employees/:id/role",
  authenticateJWT,
  requireRole(["Admin"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const data = roleUpdateSchema.parse(req.body);

      // Prevent self promotion or demotion
      if (Number(id) === req.user!.id) {
        return res.status(400).json({ error: "You cannot change your own role. Please ask another Administrator." });
      }

      const target = await db("employees").where({ id }).first();
      if (!target) {
        return res.status(404).json({ error: "Employee not found" });
      }

      const [updatedEmp] = await db("employees")
        .where({ id })
        .update({
          role: data.role,
          updated_at: db.fn.now(),
        })
        .returning(["id", "name", "email", "role", "status", "department_id"]);

      await logActivity(
        req.user!.id,
        `Promoted role of ${updatedEmp.name} to ${data.role}`,
        "Employee",
        updatedEmp.id
      );

      return res.json({ message: "Employee role updated successfully", employee: updatedEmp });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Update employee role error:", error);
      return res.status(500).json({ error: "Internal server error updating role" });
    }
  }
);

// PUT change employee status (Admin only)
router.put(
  "/employees/:id/status",
  authenticateJWT,
  requireRole(["Admin"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const data = statusUpdateSchema.parse(req.body);

      // Prevent self deactivation
      if (Number(id) === req.user!.id) {
        return res.status(400).json({ error: "You cannot suspend or deactivate your own account." });
      }

      const target = await db("employees").where({ id }).first();
      if (!target) {
        return res.status(404).json({ error: "Employee not found" });
      }

      const [updatedEmp] = await db("employees")
        .where({ id })
        .update({
          status: data.status,
          updated_at: db.fn.now(),
        })
        .returning(["id", "name", "email", "role", "status", "department_id"]);

      await logActivity(
        req.user!.id,
        `Updated status of ${updatedEmp.name} to ${data.status}`,
        "Employee",
        updatedEmp.id
      );

      return res.json({ message: "Employee status updated successfully", employee: updatedEmp });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Update employee status error:", error);
      return res.status(500).json({ error: "Internal server error updating status" });
    }
  }
);

export default router;

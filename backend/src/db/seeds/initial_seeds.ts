import { Knex } from "knex";
import bcrypt from "bcryptjs";

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries in reverse order
  await knex.raw("TRUNCATE TABLE activity_logs CASCADE;");
  await knex.raw("TRUNCATE TABLE notifications CASCADE;");
  await knex.raw("TRUNCATE TABLE audit_results CASCADE;");
  await knex.raw("TRUNCATE TABLE audit_assignments CASCADE;");
  await knex.raw("TRUNCATE TABLE audit_cycles CASCADE;");
  await knex.raw("TRUNCATE TABLE maintenance_requests CASCADE;");
  await knex.raw("TRUNCATE TABLE resource_bookings CASCADE;");
  await knex.raw("TRUNCATE TABLE transfer_requests CASCADE;");
  await knex.raw("TRUNCATE TABLE asset_allocations CASCADE;");
  await knex.raw("TRUNCATE TABLE assets CASCADE;");
  await knex.raw("TRUNCATE TABLE asset_categories CASCADE;");
  await knex.raw("TRUNCATE TABLE employees CASCADE;");
  await knex.raw("TRUNCATE TABLE departments CASCADE;");

  // Reset tag sequence
  await knex.raw("ALTER SEQUENCE seq_asset_tags RESTART WITH 1;");

  // 1. Insert Departments
  const [executiveDept] = await knex("departments")
    .insert({
      name: "Executive",
      status: "Active",
    })
    .returning("id");

  const [engineeringDept] = await knex("departments")
    .insert({
      name: "Engineering",
      parent_department_id: executiveDept.id,
      status: "Active",
    })
    .returning("id");

  const [hrDept] = await knex("departments")
    .insert({
      name: "Human Resources",
      parent_department_id: executiveDept.id,
      status: "Active",
    })
    .returning("id");

  const [facilitiesDept] = await knex("departments")
    .insert({
      name: "Facilities & Operations",
      parent_department_id: executiveDept.id,
      status: "Active",
    })
    .returning("id");

  // 2. Insert Default Admin Employee
  const adminPasswordHash = await bcrypt.hash("adminpassword", 10);
  const [adminEmployee] = await knex("employees")
    .insert({
      name: "System Admin",
      email: "admin@assetflow.com",
      password_hash: adminPasswordHash,
      department_id: executiveDept.id,
      role: "Admin",
      status: "Active",
    })
    .returning("id");

  // Update executive department head
  await knex("departments")
    .where({ id: executiveDept.id })
    .update({ department_head_id: adminEmployee.id });

  // 3. Insert some other default employees for testing roles
  const employeePasswordHash = await bcrypt.hash("employeepassword", 10);

  // Asset Manager
  const [managerEmployee] = await knex("employees")
    .insert({
      name: "Jane AssetMgr",
      email: "manager@assetflow.com",
      password_hash: employeePasswordHash,
      department_id: facilitiesDept.id,
      role: "AssetManager",
      status: "Active",
    })
    .returning("id");

  // Update facilities department head to asset manager for demonstration
  await knex("departments")
    .where({ id: facilitiesDept.id })
    .update({ department_head_id: managerEmployee.id });

  // Department Head of Engineering
  const [engHeadEmployee] = await knex("employees")
    .insert({
      name: "John EngHead",
      email: "head@assetflow.com",
      password_hash: employeePasswordHash,
      department_id: engineeringDept.id,
      role: "DepartmentHead",
      status: "Active",
    })
    .returning("id");

  await knex("departments")
    .where({ id: engineeringDept.id })
    .update({ department_head_id: engHeadEmployee.id });

  // Standard employee in engineering
  await knex("employees").insert({
    name: "Alice Developer",
    email: "employee@assetflow.com",
    password_hash: employeePasswordHash,
    department_id: engineeringDept.id,
    role: "Employee",
    status: "Active",
  });

  // 4. Insert Asset Categories
  await knex("asset_categories").insert([
    {
      name: "Electronics",
      custom_fields: JSON.stringify({
        warranty_months: 24,
        manufacturer: "Apple, Dell, Lenovo",
      }),
    },
    {
      name: "Furniture",
      custom_fields: JSON.stringify({
        material: "Wood, Steel",
        dimensions: "Standard desk/chair",
      }),
    },
    {
      name: "Vehicles",
      custom_fields: JSON.stringify({
        mileage_limit: 150000,
        fuel_type: "Electric, Hybrid, Petrol",
      }),
    },
    {
      name: "Office Supplies",
      custom_fields: JSON.stringify({
        consumable: true,
      }),
    },
  ]);
}

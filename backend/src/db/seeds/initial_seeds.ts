import { Knex } from "knex";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

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
  await knex.raw("ALTER SEQUENCE seq_asset_tags RESTART WITH 100;");

  // 1. Insert Departments (Screen 3)
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

  const [facilitiesDept] = await knex("departments")
    .insert({
      name: "Facilities",
      parent_department_id: executiveDept.id,
      status: "Active",
    })
    .returning("id");

  const [fieldOpsDept] = await knex("departments")
    .insert({
      name: "Field Ops",
      parent_department_id: executiveDept.id,
      status: "Active",
    })
    .returning("id");

  const [fieldOpsEastDept] = await knex("departments")
    .insert({
      name: "Field ops (east)",
      parent_department_id: fieldOpsDept.id,
      status: "Inactive",
    })
    .returning("id");

  // 2. Insert Employees (Aditi Rao, Rohan Mehta, Sana Iqbal, Priya Shah, Arjun Nair)
  const rawPassword = process.env.SEED_USER_PASSWORD || "AssetFlowSecure2026!";
  const empPasswordHash = await bcrypt.hash(rawPassword, 10);

  // System Admin (Jane AssetMgr as Admin/Manager)
  const [adminEmployee] = await knex("employees")
    .insert({
      name: "System Admin",
      email: "admin@assetflow.com",
      password_hash: empPasswordHash,
      department_id: executiveDept.id,
      role: "Admin",
      status: "Active",
    })
    .returning("id");

  // Set Executive head
  await knex("departments").where({ id: executiveDept.id }).update({ department_head_id: adminEmployee.id });

  // Aditi Rao (Engineering Head)
  const [aditiEmployee] = await knex("employees")
    .insert({
      name: "aditi rao",
      email: "aditi@assetflow.com",
      password_hash: empPasswordHash,
      department_id: engineeringDept.id,
      role: "DepartmentHead",
      status: "Active",
    })
    .returning("id");

  await knex("departments").where({ id: engineeringDept.id }).update({ department_head_id: aditiEmployee.id });

  // Rohan Mehta (Facilities Head)
  const [rohanEmployee] = await knex("employees")
    .insert({
      name: "rohan mehta",
      email: "rohan@assetflow.com",
      password_hash: empPasswordHash,
      department_id: facilitiesDept.id,
      role: "DepartmentHead",
      status: "Active",
    })
    .returning("id");

  await knex("departments").where({ id: facilitiesDept.id }).update({ department_head_id: rohanEmployee.id });

  // Sana Iqbal (Field ops Head)
  const [sanaEmployee] = await knex("employees")
    .insert({
      name: "sana iqbal",
      email: "sana@assetflow.com",
      password_hash: empPasswordHash,
      department_id: fieldOpsEastDept.id,
      role: "Employee",
      status: "Active",
    })
    .returning("id");

  await knex("departments").where({ id: fieldOpsEastDept.id }).update({ department_head_id: sanaEmployee.id });

  // Priya Shah (Engineering Staff)
  const [priyaEmployee] = await knex("employees")
    .insert({
      name: "Priya shah",
      email: "priya@assetflow.com",
      password_hash: empPasswordHash,
      department_id: engineeringDept.id,
      role: "Employee",
      status: "Active",
    })
    .returning("id");

  // Arjun Nair (Engineering Staff)
  const [arjunEmployee] = await knex("employees")
    .insert({
      name: "Arjun Nair",
      email: "arjun@assetflow.com",
      password_hash: empPasswordHash,
      department_id: engineeringDept.id,
      role: "Employee",
      status: "Active",
    })
    .returning("id");

  // Auditors: A Rao, S Iqbal
  const [aRaoEmployee] = await knex("employees")
    .insert({
      name: "A Rao",
      email: "arao@assetflow.com",
      password_hash: empPasswordHash,
      department_id: engineeringDept.id,
      role: "Employee",
      status: "Active",
    })
    .returning("id");

  const [sIqbalEmployee] = await knex("employees")
    .insert({
      name: "S Iqbal",
      email: "siqbal@assetflow.com",
      password_hash: empPasswordHash,
      department_id: engineeringDept.id,
      role: "Employee",
      status: "Active",
    })
    .returning("id");

  // Asset Manager
  const [managerEmployee] = await knex("employees")
    .insert({
      name: "Jane AssetMgr",
      email: "manager@assetflow.com",
      password_hash: empPasswordHash,
      department_id: facilitiesDept.id,
      role: "AssetManager",
      status: "Active",
    })
    .returning("id");

  // 3. Insert Asset Categories
  const [electronicsCat] = await knex("asset_categories")
    .insert({
      name: "Electronics",
      custom_fields: JSON.stringify({ warranty_months: 24, manufacturer: "Dell, Apple" }),
    })
    .returning("id");

  const [furnitureCat] = await knex("asset_categories")
    .insert({
      name: "Furniture",
      custom_fields: JSON.stringify({ material: "Wood, Metal" }),
    })
    .returning("id");

  const [vehiclesCat] = await knex("asset_categories")
    .insert({
      name: "Vehicles",
      custom_fields: JSON.stringify({ fuel_type: "Electric" }),
    })
    .returning("id");

  // 4. Insert Assets (Screen 4 & 5 & 7 & 8 & 9)
  const [laptop12] = await knex("assets")
    .insert({
      name: "Dell Laptop",
      category_id: electronicsCat.id,
      asset_tag: "AF-0012",
      serial_number: "SN-DELL-1200",
      acquisition_date: "2024-03-12",
      acquisition_cost: 1200.0,
      condition: "Good",
      location: "bengaluru",
      status: "Allocated",
    })
    .returning("id");

  const [projector62] = await knex("assets")
    .insert({
      name: "Projector",
      category_id: electronicsCat.id,
      asset_tag: "AF-0062",
      serial_number: "SN-PROJ-6200",
      acquisition_date: "2024-01-10",
      acquisition_cost: 850.0,
      condition: "Poor",
      location: "HQ Floor 2",
      status: "UnderMaintenance",
    })
    .returning("id");

  const [chair201] = await knex("assets")
    .insert({
      name: "Office chair",
      category_id: furnitureCat.id,
      asset_tag: "AF-0201",
      serial_number: "SN-CHAIR-2010",
      acquisition_date: "2024-05-18",
      acquisition_cost: 150.0,
      condition: "New",
      location: "Warehouse",
      status: "Available",
    })
    .returning("id");

  const [laptop114] = await knex("assets")
    .insert({
      name: "Dell laptop",
      category_id: electronicsCat.id,
      asset_tag: "AF-0114",
      serial_number: "SN-DELL-1140",
      acquisition_date: "2023-11-20",
      acquisition_cost: 1100.0,
      condition: "Good",
      location: "Desk 212",
      status: "Allocated",
    })
    .returning("id");

  const [acUnit03] = await knex("assets")
    .insert({
      name: "ac unit",
      category_id: electronicsCat.id,
      asset_tag: "AF-003",
      serial_number: "SN-AC-0030",
      acquisition_date: "2022-06-15",
      acquisition_cost: 650.0,
      condition: "Good",
      location: "HQ Floor 2",
      status: "UnderMaintenance",
    })
    .returning("id");

  const [forklift78] = await knex("assets")
    .insert({
      name: "Forklift",
      category_id: vehiclesCat.id,
      asset_tag: "AF-0078",
      serial_number: "SN-FORK-7800",
      acquisition_date: "2021-08-20",
      acquisition_cost: 12000.0,
      condition: "Good",
      location: "Warehouse",
      status: "UnderMaintenance",
    })
    .returning("id");

  const [printer297] = await knex("assets")
    .insert({
      name: "Printer Jam",
      category_id: electronicsCat.id,
      asset_tag: "AF-297",
      serial_number: "SN-PRNT-2970",
      acquisition_date: "2023-04-10",
      acquisition_cost: 400.0,
      condition: "Good",
      location: "HQ Floor 2",
      status: "UnderMaintenance",
    })
    .returning("id");

  const [chair873] = await knex("assets")
    .insert({
      name: "Chair repair",
      category_id: furnitureCat.id,
      asset_tag: "AF-873",
      serial_number: "SN-CHAIR-8730",
      acquisition_date: "2024-02-12",
      acquisition_cost: 160.0,
      condition: "Good",
      location: "Warehouse",
      status: "Available",
    })
    .returning("id");

  const [laptop05] = await knex("assets")
    .insert({
      name: "Dell laptop",
      category_id: electronicsCat.id,
      asset_tag: "AF-0005",
      serial_number: "SN-DELL-0005",
      acquisition_date: "2024-01-05",
      acquisition_cost: 950.0,
      condition: "Good",
      location: "Desk 212",
      status: "Available",
    })
    .returning("id");

  const [chair9921] = await knex("assets")
    .insert({
      name: "Office chair",
      category_id: furnitureCat.id,
      asset_tag: "AF-9921",
      serial_number: "SN-CHAIR-9921",
      acquisition_date: "2024-02-10",
      acquisition_cost: 130.0,
      condition: "Good",
      location: "Desk 214",
      status: "Available",
    })
    .returning("id");

  const [monitor9838] = await knex("assets")
    .insert({
      name: "Monitor",
      category_id: electronicsCat.id,
      asset_tag: "AF-9838",
      serial_number: "SN-MON-9838",
      acquisition_date: "2024-03-01",
      acquisition_cost: 250.0,
      condition: "Good",
      location: "Desk 215",
      status: "Available",
    })
    .returning("id");

  // Bookable resources
  const [roomB2] = await knex("assets")
    .insert({
      name: "Room B2",
      category_id: furnitureCat.id,
      asset_tag: "AF-1002",
      serial_number: "ROOM-B2",
      acquisition_date: "2020-01-01",
      acquisition_cost: 0.0,
      condition: "Good",
      location: "HQ Floor 2",
      is_bookable: true,
      status: "Available",
    })
    .returning("id");

  const [van343] = await knex("assets")
    .insert({
      name: "Van AF-343",
      category_id: vehiclesCat.id,
      asset_tag: "AF-0343",
      serial_number: "VAN-343",
      acquisition_date: "2021-02-10",
      acquisition_cost: 25000.0,
      condition: "Good",
      location: "Warehouse",
      is_bookable: true,
      status: "Available",
    })
    .returning("id");

  const [proj335] = await knex("assets")
    .insert({
      name: "Projector AF-335",
      category_id: electronicsCat.id,
      asset_tag: "AF-0335",
      serial_number: "PROJ-335",
      acquisition_date: "2023-05-15",
      acquisition_cost: 500.0,
      condition: "Good",
      location: "HQ Floor 2",
      is_bookable: true,
      status: "Available",
    })
    .returning("id");

  const [camera301] = await knex("assets")
    .insert({
      name: "Camera AF-0301",
      category_id: electronicsCat.id,
      asset_tag: "AF-0301",
      serial_number: "CAM-301",
      acquisition_date: "2023-08-01",
      acquisition_cost: 800.0,
      condition: "Good",
      location: "HQ Floor 2",
      is_bookable: true,
      status: "Available",
    })
    .returning("id");

  const [chair910] = await knex("assets")
    .insert({
      name: "chair AF-0910",
      category_id: furnitureCat.id,
      asset_tag: "AF-0910",
      serial_number: "CH-910",
      acquisition_date: "2024-01-20",
      acquisition_cost: 110.0,
      condition: "Good",
      location: "Warehouse",
      is_bookable: true,
      status: "Available",
    })
    .returning("id");

  // Other references
  await knex("assets").insert([
    {
      name: "Forklift AF-0087",
      category_id: vehiclesCat.id,
      asset_tag: "AF-0087",
      serial_number: "FORK-0087",
      acquisition_date: "2022-09-01",
      acquisition_cost: 15000.0,
      condition: "Good",
      location: "Warehouse",
      status: "Available",
    },
    {
      name: "Laptop AF-0020",
      category_id: electronicsCat.id,
      asset_tag: "AF-0020",
      serial_number: "LAP-0020",
      acquisition_date: "2020-03-01",
      acquisition_cost: 1200.0,
      condition: "Poor",
      location: "bengaluru",
      status: "Available",
    },
    {
      name: "Laptop AF-0014",
      category_id: electronicsCat.id,
      asset_tag: "AF-0014",
      serial_number: "LAP-0014",
      acquisition_date: "2023-01-10",
      acquisition_cost: 1150.0,
      condition: "Good",
      location: "bengaluru",
      status: "Allocated",
    },
    {
      name: "AF-0033 Asset",
      category_id: electronicsCat.id,
      asset_tag: "AF-0033",
      serial_number: "LAP-0033",
      acquisition_date: "2024-05-15",
      acquisition_cost: 900.0,
      condition: "Good",
      location: "bengaluru",
      status: "Available",
    },
    {
      name: "AF-0021 Asset",
      category_id: electronicsCat.id,
      asset_tag: "AF-0021",
      serial_number: "LAP-0021",
      acquisition_date: "2023-12-01",
      acquisition_cost: 950.0,
      condition: "Good",
      location: "bengaluru",
      status: "Available",
    },
    {
      name: "AF-0088 Asset",
      category_id: electronicsCat.id,
      asset_tag: "AF-0088",
      serial_number: "LAP-0088",
      acquisition_date: "2024-06-01",
      acquisition_cost: 980.0,
      condition: "Good",
      location: "bengaluru",
      status: "Available",
    }
  ]);

  // 5. Insert Asset Allocations (Screen 5 active & history)
  await knex("asset_allocations").insert([
    {
      asset_id: laptop12.id,
      employee_id: aditiEmployee.id,
      allocated_date: "2024-03-15",
      expected_return_date: "2025-03-15",
      condition_notes: "Initial deployment",
      status: "Active",
    },
    {
      asset_id: laptop114.id,
      employee_id: priyaEmployee.id,
      allocated_date: "2026-03-12",
      expected_return_date: "2027-03-12",
      condition_notes: "Prior custodian Arjun returned in good shape",
      status: "Active",
    },
    {
      asset_id: laptop114.id,
      employee_id: arjunEmployee.id,
      allocated_date: "2026-01-04",
      expected_return_date: "2026-03-10",
      actual_return_date: "2026-03-10",
      condition_notes: "Returned by Arjun Nair - condition good",
      status: "Returned",
    }
  ]);

  // 6. Insert Resource Bookings
  const today = new Date().toISOString().split("T")[0];
  await knex("resource_bookings").insert([
    {
      asset_id: roomB2.id,
      booked_by_employee_id: priyaEmployee.id,
      start_time: `${today}T14:00:00Z`,
      end_time: `${today}T15:00:00Z`,
      status: "Upcoming",
    },
    {
      asset_id: van343.id,
      booked_by_employee_id: arjunEmployee.id,
      start_time: `${today}T10:00:00Z`,
      end_time: `${today}T12:00:00Z`,
      status: "Ongoing",
    },
    {
      asset_id: proj335.id,
      booked_by_employee_id: aditiEmployee.id,
      start_time: `${today}T16:00:00Z`,
      end_time: `${today}T17:00:00Z`,
      status: "Upcoming",
    }
  ]);

  // 7. Insert Maintenance Requests (Screen 7 Kanban board)
  await knex("maintenance_requests").insert([
    {
      asset_id: projector62.id,
      raised_by_employee_id: aditiEmployee.id,
      issue_description: "Projector bulb not turning on",
      priority: "High",
      status: "Pending",
    },
    {
      asset_id: acUnit03.id,
      raised_by_employee_id: rohanEmployee.id,
      issue_description: "ac unit noisy compressor",
      priority: "Medium",
      status: "Approved",
    },
    {
      asset_id: forklift78.id,
      raised_by_employee_id: managerEmployee.id,
      issue_description: "Forklift steering drift",
      priority: "High",
      status: "TechnicianAssigned",
      technician_name: "R verma",
    },
    {
      asset_id: printer297.id,
      raised_by_employee_id: aditiEmployee.id,
      issue_description: "Printer Jam parts ordered",
      priority: "Low",
      status: "InProgress",
      technician_name: "R verma",
    },
    {
      asset_id: chair873.id,
      raised_by_employee_id: sanaEmployee.id,
      issue_description: "Chair repair resolved 7 Jul",
      priority: "Low",
      status: "Resolved",
      technician_name: "R verma",
      created_at: "2026-07-07T09:00:00Z",
    }
  ]);

  // 8. Insert Audit Cycles & Results (Screen 8)
  const [auditCycle] = await knex("audit_cycles")
    .insert({
      scope_department_id: engineeringDept.id,
      scope_location: "Desk 212, 214, 215",
      start_date: "2026-07-01",
      end_date: "2026-07-15",
      status: "Open",
    })
    .returning("id");

  // Auditor Assignments
  await knex("audit_assignments").insert([
    { audit_cycle_id: auditCycle.id, auditor_employee_id: aRaoEmployee.id },
    { audit_cycle_id: auditCycle.id, auditor_employee_id: sIqbalEmployee.id }
  ]);

  // Audit Results
  await knex("audit_results").insert([
    {
      audit_cycle_id: auditCycle.id,
      asset_id: laptop05.id,
      result: "Verified",
      notes: "Verified",
    },
    {
      audit_cycle_id: auditCycle.id,
      asset_id: chair9921.id,
      result: "Missing",
      notes: "Missing",
    },
    {
      audit_cycle_id: auditCycle.id,
      asset_id: monitor9838.id,
      result: "Damaged",
      notes: "Damaged",
    }
  ]);

  // 9. Insert Notifications (Screen 10 typewriter logs)
  await knex("notifications").insert([
    {
      employee_id: adminEmployee.id,
      type: "info",
      message: "Laptop AF-0014 assigned to Priya shah",
      is_read: false,
      created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2m ago
    },
    {
      employee_id: adminEmployee.id,
      type: "info",
      message: "Maintenance request AF-0055 approved",
      is_read: false,
      created_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(), // 18m ago
    },
    {
      employee_id: adminEmployee.id,
      type: "info",
      message: "Booking confirmed: Room B2 : 2:00 to 3:00 PM",
      is_read: false,
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h ago
    },
    {
      employee_id: adminEmployee.id,
      type: "info",
      message: "Transfer approved: AF-0033 to facilities dept",
      is_read: false,
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3h ago
    },
    {
      employee_id: adminEmployee.id,
      type: "alert",
      message: "Overdue return: AF-0021 was due 3 days ago",
      is_read: false,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1d ago
    },
    {
      employee_id: adminEmployee.id,
      type: "warning",
      message: "audit discrepancy flagged: AF-0088 damaged",
      is_read: false,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2d ago
    }
  ]);
}

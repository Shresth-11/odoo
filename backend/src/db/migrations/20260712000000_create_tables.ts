import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Create custom enums and tables sequentially
  await knex.raw(`
    -- Create Enums
    CREATE TYPE employee_role AS ENUM ('Admin', 'AssetManager', 'DepartmentHead', 'Employee');
    CREATE TYPE employee_status AS ENUM ('Active', 'Inactive', 'Suspended');
    CREATE TYPE department_status AS ENUM ('Active', 'Inactive');
    CREATE TYPE asset_condition AS ENUM ('New', 'Good', 'Fair', 'Poor', 'Damaged');
    CREATE TYPE asset_status AS ENUM ('Available', 'Allocated', 'Reserved', 'UnderMaintenance', 'Lost', 'Retired', 'Disposed');
    CREATE TYPE allocation_status AS ENUM ('Active', 'Returned', 'Overdue');
    CREATE TYPE transfer_status AS ENUM ('Requested', 'Approved', 'Rejected', 'Completed');
    CREATE TYPE booking_status AS ENUM ('Upcoming', 'Ongoing', 'Completed', 'Cancelled');
    CREATE TYPE maintenance_priority AS ENUM ('Low', 'Medium', 'High', 'Critical');
    CREATE TYPE maintenance_status AS ENUM ('Pending', 'Approved', 'Rejected', 'TechnicianAssigned', 'InProgress', 'Resolved');
    CREATE TYPE audit_cycle_status AS ENUM ('Open', 'Closed');
    CREATE TYPE audit_result_status AS ENUM ('Verified', 'Missing', 'Damaged');

    -- Create Departments Table (without circular FK initially)
    CREATE TABLE departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        parent_department_id INT REFERENCES departments(id) ON DELETE SET NULL,
        department_head_id INT,
        status department_status DEFAULT 'Active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create Employees Table
    CREATE TABLE employees (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        department_id INT REFERENCES departments(id) ON DELETE SET NULL,
        role employee_role DEFAULT 'Employee' NOT NULL,
        status employee_status DEFAULT 'Active' NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Add Circular Constraint to Departments
    ALTER TABLE departments 
    ADD CONSTRAINT fk_departments_head 
    FOREIGN KEY (department_head_id) REFERENCES employees(id) ON DELETE SET NULL;

    -- Create Asset Categories Table
    CREATE TABLE asset_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        custom_fields JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create Assets Table
    CREATE TABLE assets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category_id INT NOT NULL REFERENCES asset_categories(id) ON DELETE RESTRICT,
        asset_tag VARCHAR(20) NOT NULL UNIQUE,
        serial_number VARCHAR(100) UNIQUE,
        acquisition_date DATE NOT NULL,
        acquisition_cost DECIMAL(12, 2) NOT NULL CHECK (acquisition_cost >= 0),
        condition asset_condition DEFAULT 'New' NOT NULL,
        location VARCHAR(100) NOT NULL,
        is_bookable BOOLEAN DEFAULT FALSE NOT NULL,
        status asset_status DEFAULT 'Available' NOT NULL,
        photo_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create Asset Allocations Table
    CREATE TABLE asset_allocations (
        id SERIAL PRIMARY KEY,
        asset_id INT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
        employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
        department_id INT REFERENCES departments(id) ON DELETE SET NULL,
        allocated_date DATE NOT NULL DEFAULT CURRENT_DATE,
        expected_return_date DATE NOT NULL,
        actual_return_date DATE,
        condition_notes TEXT,
        status allocation_status DEFAULT 'Active' NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_only_one_target CHECK (
            (employee_id IS NOT NULL AND department_id IS NULL) OR
            (employee_id IS NULL AND department_id IS NOT NULL)
        ),
        CONSTRAINT check_return_dates CHECK (allocated_date <= expected_return_date)
    );

    -- Create Transfer Requests Table
    CREATE TABLE transfer_requests (
        id SERIAL PRIMARY KEY,
        asset_id INT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
        from_employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
        to_employee_id INT NOT NULL REFERENCES employees(id) ON DELETE SET NULL,
        status transfer_status DEFAULT 'Requested' NOT NULL,
        approved_by INT REFERENCES employees(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_different_employees CHECK (from_employee_id <> to_employee_id)
    );

    -- Create Resource Bookings Table
    CREATE TABLE resource_bookings (
        id SERIAL PRIMARY KEY,
        asset_id INT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
        booked_by_employee_id INT NOT NULL REFERENCES employees(id) ON DELETE SET NULL,
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        status booking_status DEFAULT 'Upcoming' NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_booking_times CHECK (start_time < end_time)
    );

    -- Create Maintenance Requests Table
    CREATE TABLE maintenance_requests (
        id SERIAL PRIMARY KEY,
        asset_id INT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
        raised_by_employee_id INT NOT NULL REFERENCES employees(id) ON DELETE SET NULL,
        issue_description TEXT NOT NULL,
        priority maintenance_priority DEFAULT 'Medium' NOT NULL,
        photo_url TEXT,
        status maintenance_status DEFAULT 'Pending' NOT NULL,
        approved_by INT REFERENCES employees(id) ON DELETE SET NULL,
        technician_name VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create Audit Cycles Table
    CREATE TABLE audit_cycles (
        id SERIAL PRIMARY KEY,
        scope_department_id INT REFERENCES departments(id) ON DELETE SET NULL,
        scope_location VARCHAR(100),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status audit_cycle_status DEFAULT 'Open' NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_audit_dates CHECK (start_date <= end_date)
    );

    -- Create Audit Assignments Table
    CREATE TABLE audit_assignments (
        id SERIAL PRIMARY KEY,
        audit_cycle_id INT NOT NULL REFERENCES audit_cycles(id) ON DELETE CASCADE,
        auditor_employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_assignment UNIQUE (audit_cycle_id, auditor_employee_id)
    );

    -- Create Audit Results Table
    CREATE TABLE audit_results (
        id SERIAL PRIMARY KEY,
        audit_cycle_id INT NOT NULL REFERENCES audit_cycles(id) ON DELETE CASCADE,
        asset_id INT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        result audit_result_status NOT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_cycle_asset UNIQUE (audit_cycle_id, asset_id)
    );

    -- Create Notifications Table
    CREATE TABLE notifications (
        id SERIAL PRIMARY KEY,
        employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create Activity Logs Table
    CREATE TABLE activity_logs (
        id SERIAL PRIMARY KEY,
        employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create Indexes
    CREATE INDEX idx_assets_tag ON assets(asset_tag);
    CREATE INDEX idx_assets_status ON assets(status);
    CREATE INDEX idx_assets_location ON assets(location);
    CREATE INDEX idx_assets_category_id ON assets(category_id);
    CREATE INDEX idx_employees_department_id ON employees(department_id);
    CREATE INDEX idx_employees_role ON employees(role);
    CREATE INDEX idx_asset_allocations_employee_id ON asset_allocations(employee_id);
    CREATE INDEX idx_asset_allocations_department_id ON asset_allocations(department_id);
    CREATE INDEX idx_asset_allocations_status ON asset_allocations(status);
    CREATE INDEX idx_resource_bookings_asset_id ON resource_bookings(asset_id);
    CREATE INDEX idx_resource_bookings_time ON resource_bookings(start_time, end_time);
    CREATE INDEX idx_maintenance_requests_status ON maintenance_requests(status);
    CREATE INDEX idx_audit_results_cycle ON audit_results(audit_cycle_id);

    -- Create Asset Tag Sequence (for AF-XXXX auto generation helper)
    CREATE SEQUENCE seq_asset_tags START 1;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP SEQUENCE IF EXISTS seq_asset_tags;
    
    DROP TABLE IF EXISTS activity_logs;
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS audit_results;
    DROP TABLE IF EXISTS audit_assignments;
    DROP TABLE IF EXISTS audit_cycles;
    DROP TABLE IF EXISTS maintenance_requests;
    DROP TABLE IF EXISTS resource_bookings;
    DROP TABLE IF EXISTS transfer_requests;
    DROP TABLE IF EXISTS asset_allocations;
    DROP TABLE IF EXISTS assets;
    DROP TABLE IF EXISTS asset_categories;

    ALTER TABLE departments DROP CONSTRAINT IF EXISTS fk_departments_head;
    DROP TABLE IF EXISTS employees;
    DROP TABLE IF EXISTS departments;

    DROP TYPE IF EXISTS audit_result_status;
    DROP TYPE IF EXISTS audit_cycle_status;
    DROP TYPE IF EXISTS maintenance_status;
    DROP TYPE IF EXISTS maintenance_priority;
    DROP TYPE IF EXISTS booking_status;
    DROP TYPE IF EXISTS transfer_status;
    DROP TYPE IF EXISTS allocation_status;
    DROP TYPE IF EXISTS asset_status;
    DROP TYPE IF EXISTS asset_condition;
    DROP TYPE IF EXISTS department_status;
    DROP TYPE IF EXISTS employee_status;
    DROP TYPE IF EXISTS employee_role;
  `);
}

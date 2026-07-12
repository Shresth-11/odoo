import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Settings, Plus, Save, Trash2, ArrowUpCircle, UserMinus } from "lucide-react";

interface Department {
  id: number;
  name: string;
  parent_department_id: number | null;
  parent_department_name?: string | null;
  department_head_id: number | null;
  department_head_name?: string | null;
  status: "Active" | "Inactive";
}

interface Category {
  id: number;
  name: string;
  custom_fields: Record<string, any>;
}

interface Employee {
  id: number;
  name: string;
  email: string;
  role: "Admin" | "AssetManager" | "DepartmentHead" | "Employee";
  status: "Active" | "Inactive" | "Suspended";
  department_name: string | null;
}

export const OrgSetup: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"depts" | "categories" | "employees">("depts");
  const [loading, setLoading] = useState(true);

  // Lists
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Forms
  const [deptName, setDeptName] = useState("");
  const [parentDeptId, setParentDeptId] = useState<number | "">("");
  const [deptHeadId, setDeptHeadId] = useState<number | "">("");
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);

  const [catName, setCatName] = useState("");
  const [customFieldKey, setCustomFieldKey] = useState("");
  const [customFieldType, setCustomFieldType] = useState("string");
  const [tempFields, setTempFields] = useState<Record<string, string>>({});
  const [editingCatId, setEditingCatId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const deptsData = await apiFetch("/org/departments");
      setDepartments(deptsData.departments);

      const catsData = await apiFetch("/org/categories");
      setCategories(catsData.categories);

      const empsData = await apiFetch("/org/employees");
      setEmployees(empsData.employees);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load organization settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Department Actions
  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: deptName,
        parent_department_id: parentDeptId === "" ? null : parentDeptId,
        department_head_id: deptHeadId === "" ? null : deptHeadId,
      };

      if (editingDeptId) {
        await apiFetch(`/org/departments/${editingDeptId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        showToast("success", "Department updated successfully");
      } else {
        await apiFetch("/org/departments", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("success", "Department created successfully");
      }

      setDeptName("");
      setParentDeptId("");
      setDeptHeadId("");
      setEditingDeptId(null);
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const handleEditDept = (dept: Department) => {
    setEditingDeptId(dept.id);
    setDeptName(dept.name);
    setParentDeptId(dept.parent_department_id || "");
    setDeptHeadId(dept.department_head_id || "");
  };

  const handleDeleteDept = async (id: number) => {
    if (!confirm("Are you sure you want to delete this department?")) return;
    try {
      await apiFetch(`/org/departments/${id}`, { method: "DELETE" });
      showToast("success", "Department deleted successfully");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  // Category Actions
  const handleAddTempField = () => {
    if (!customFieldKey) return;
    setTempFields((prev) => ({ ...prev, [customFieldKey]: customFieldType }));
    setCustomFieldKey("");
  };

  const handleRemoveTempField = (key: string) => {
    setTempFields((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: catName,
        custom_fields: tempFields,
      };

      if (editingCatId) {
        await apiFetch(`/org/categories/${editingCatId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        showToast("success", "Category updated successfully");
      } else {
        await apiFetch("/org/categories", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("success", "Asset category created successfully");
      }

      setCatName("");
      setTempFields({});
      setEditingCatId(null);
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCatId(cat.id);
    setCatName(cat.name);
    setTempFields(cat.custom_fields || {});
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await apiFetch(`/org/categories/${id}`, { method: "DELETE" });
      showToast("success", "Category deleted successfully");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  // Employee Role Promotion & Status Lock Actions
  const handleRolePromotion = async (empId: number, targetRole: any) => {
    if (empId === user?.id) {
      showToast("error", "You cannot change your own role!");
      return;
    }
    try {
      await apiFetch(`/org/employees/${empId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: targetRole }),
      });
      showToast("success", `Employee role updated to ${targetRole}`);
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const handleStatusToggle = async (empId: number, targetStatus: any) => {
    if (empId === user?.id) {
      showToast("error", "You cannot suspend yourself!");
      return;
    }
    try {
      await apiFetch(`/org/employees/${empId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: targetStatus }),
      });
      showToast("success", `Employee status updated to ${targetStatus}`);
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", fontSize: "16px", color: "var(--text-secondary)" }}>Loading configurations...</div>;
  }

  return (
    <div className="animate-fade">
      {/* Tab bar header */}
      <div className="tabs-container">
        <ul className="tabs-list">
          <li>
            <button className={`tab-trigger ${activeTab === "depts" ? "active" : ""}`} onClick={() => setActiveTab("depts")}>
              Departments
            </button>
          </li>
          <li>
            <button className={`tab-trigger ${activeTab === "categories" ? "active" : ""}`} onClick={() => setActiveTab("categories")}>
              Asset Categories
            </button>
          </li>
          <li>
            <button className={`tab-trigger ${activeTab === "employees" ? "active" : ""}`} onClick={() => setActiveTab("employees")}>
              Employee Directory & Promotion
            </button>
          </li>
        </ul>
      </div>

      {/* TABS 1: DEPARTMENTS */}
      {activeTab === "depts" && (
        <div className="grid-cols-2">
          {/* Create Form */}
          <div className="card">
            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>
              {editingDeptId ? "Edit Department" : "Create New Department"}
            </h3>
            <form onSubmit={handleSaveDept}>
              <div className="form-group">
                <label className="form-label">Department Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Sales, Quality Assurance"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Parent Department</label>
                <select
                  className="form-control"
                  value={parentDeptId}
                  onChange={(e) => setParentDeptId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">No Parent (Top-level)</option>
                  {departments
                    .filter((d) => d.id !== editingDeptId) // prevent self parent circular reference
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Department Head (Custodian)</label>
                <select
                  className="form-control"
                  value={deptHeadId}
                  onChange={(e) => setDeptHeadId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">No assigned head</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.email})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="submit" className="btn btn-primary">
                  <Save size={16} /> Save Department
                </button>
                {editingDeptId && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditingDeptId(null);
                      setDeptName("");
                      setParentDeptId("");
                      setDeptHeadId("");
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Departments Directory */}
          <div className="card" style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "16px", color: "var(--text-primary)" }}>Registered Hierarchy</h3>
            {departments.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                No departments registered yet. Set up your organization's hierarchy using the form on the left.
              </div>
            ) : (
              <div className="table-container">
                <table className="table-el">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Parent</th>
                      <th>Dept Head</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept) => (
                      <tr key={dept.id}>
                        <td style={{ fontWeight: 600 }}>{dept.name}</td>
                        <td>{dept.parent_department_name || <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>—</span>}</td>
                        <td>{dept.department_head_name || <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Unassigned</span>}</td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleEditDept(dept)}>
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ padding: "6px" }}
                            onClick={() => handleDeleteDept(dept.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}

      {/* TABS 2: ASSET CATEGORIES */}
      {activeTab === "categories" && (
        <div className="grid-cols-2">
          {/* Create Form */}
          <div className="card">
            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>
              {editingCatId ? "Edit Category Schema" : "Add Asset Category"}
            </h3>
            <form onSubmit={handleSaveCategory}>
              <div className="form-group">
                <label className="form-label">Category Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Laptops, Heavy Machinery"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  required
                />
              </div>

              {/* Dynamic JSON Fields section */}
              <div
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-sm)",
                  padding: "16px",
                  marginBottom: "20px",
                }}
              >
                <label className="form-label" style={{ marginBottom: "12px" }}>Define Custom Schema Attributes</label>
                <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Field Name (e.g. RAM, Warranty)"
                    value={customFieldKey}
                    onChange={(e) => setCustomFieldKey(e.target.value)}
                  />
                  <select
                    className="form-control"
                    style={{ maxWidth: "120px" }}
                    value={customFieldType}
                    onChange={(e) => setCustomFieldType(e.target.value)}
                  >
                    <option value="string">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                  </select>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddTempField}>
                    Add
                  </button>
                </div>

                {/* Display added fields */}
                {Object.keys(tempFields).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {Object.entries(tempFields).map(([k, t]) => (
                      <span
                        key={k}
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.05)",
                          border: "1px solid var(--border-color)",
                          padding: "4px 10px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        {k} ({t})
                        <button
                          type="button"
                          style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "14px" }}
                          onClick={() => handleRemoveTempField(k)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="submit" className="btn btn-primary">
                  <Save size={16} /> Save Category
                </button>
                {editingCatId && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditingCatId(null);
                      setCatName("");
                      setTempFields({});
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Categories directory */}
          <div className="card" style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "16px", color: "var(--text-primary)" }}>Asset Categories Schema</h3>
            {categories.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                No custom categories defined. Add your first category schema on the left to get started.
              </div>
            ) : (
              <div className="table-container">
                <table className="table-el">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Custom Fields Schema</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id}>
                      <td style={{ fontWeight: 600 }}>{cat.name}</td>
                      <td>
                        {Object.keys(cat.custom_fields || {}).length === 0 ? (
                          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Standard</span>
                        ) : (
                          Object.entries(cat.custom_fields || {}).map(([k, t]) => (
                            <span
                              key={k}
                              style={{
                                fontSize: "11px",
                                backgroundColor: "rgba(99, 102, 241, 0.08)",
                                border: "1px solid rgba(99, 102, 241, 0.2)",
                                padding: "2px 6px",
                                borderRadius: "3px",
                                marginRight: "4px",
                                display: "inline-block",
                                marginBlock: "2px",
                              }}
                            >
                              {k} ({t})
                            </span>
                          ))
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleEditCategory(cat)}>
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ padding: "6px" }}
                            onClick={() => handleDeleteCategory(cat.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}

      {/* TABS 3: EMPLOYEE DIRECTORY & PROMOTION */}
      {activeTab === "employees" && (
        <div className="card animate-fade" style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "16px", color: "var(--text-primary)" }}>Employee Administration Directory</h3>
          {employees.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No staff members registered in the database yet.
            </div>
          ) : (
            <div className="table-container">
              <table className="table-el">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Current Role</th>
                    <th>Status</th>
                    <th>Role Promotion Controls</th>
                    <th>Status Action</th>
                  </tr>
                </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td style={{ fontWeight: 600 }}>{emp.name} {emp.id === user?.id && <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>(You)</span>}</td>
                    <td>{emp.email}</td>
                    <td>{emp.department_name || <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>—</span>}</td>
                    <td>
                      <span
                        className={`badge ${
                          emp.role === "Admin"
                            ? "badge-danger"
                            : emp.role === "AssetManager"
                            ? "badge-success"
                            : emp.role === "DepartmentHead"
                            ? "badge-info"
                            : "badge-muted"
                        }`}
                      >
                        {emp.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${emp.status === "Active" ? "badge-success" : "badge-danger"}`}>{emp.status}</span>
                    </td>
                    <td>
                      {emp.id !== user?.id ? (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <select
                            className="form-control"
                            style={{ padding: "4px 8px", fontSize: "12px", width: "140px" }}
                            value={emp.role}
                            onChange={(e) => handleRolePromotion(emp.id, e.target.value as any)}
                          >
                            <option value="Employee">Employee</option>
                            <option value="DepartmentHead">Dept Head</option>
                            <option value="AssetManager">Asset Mgr</option>
                            <option value="Admin">Admin</option>
                          </select>
                        </div>
                      ) : (
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Locks Self</span>
                      )}
                    </td>
                    <td>
                      {emp.id !== user?.id ? (
                        emp.status === "Active" ? (
                          <button className="btn btn-danger btn-sm" onClick={() => handleStatusToggle(emp.id, "Suspended")}>
                            <UserMinus size={12} /> Suspend
                          </button>
                        ) : (
                          <button className="btn btn-primary btn-sm" onClick={() => handleStatusToggle(emp.id, "Active")}>
                            Activate
                          </button>
                        )
                      ) : (
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Locks Self</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

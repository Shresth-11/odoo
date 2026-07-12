import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Share2, Plus, Calendar, RotateCcw, AlertTriangle, ArrowRightLeft } from "lucide-react";

interface Allocation {
  id: number;
  asset_id: number;
  asset_name: string;
  asset_tag: string;
  employee_id: number | null;
  employee_name: string | null;
  employee_email: string | null;
  department_id: number | null;
  department_name: string | null;
  allocated_date: string;
  expected_return_date: string;
  actual_return_date: string | null;
  condition_notes: string | null;
  status: "Active" | "Returned" | "Overdue";
}

interface Transfer {
  id: number;
  asset_id: number;
  asset_name: string;
  asset_tag: string;
  from_employee_id: number;
  from_employee_name: string;
  to_employee_id: number;
  to_employee_name: string;
  to_employee_email: string;
  status: "Requested" | "Approved" | "Rejected" | "Completed";
  created_at: string;
}

interface Asset {
  id: number;
  name: string;
  asset_tag: string;
  status: string;
}

interface Employee {
  id: number;
  name: string;
  email: string;
}

interface Department {
  id: number;
  name: string;
}

export const Allocations: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const { showToast } = useToast();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms State
  const [targetType, setTargetType] = useState<"employee" | "department">("employee");
  const [assetId, setAssetId] = useState<number | "">("");
  const [employeeId, setEmployeeId] = useState<number | "">("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");

  const [transferAssetId, setTransferAssetId] = useState<number | "">("");
  const [transferToEmployeeId, setTransferToEmployeeId] = useState<number | "">("");

  // Return Modal State
  const [returningAlloc, setReturningAlloc] = useState<Allocation | null>(null);
  const [returnNotes, setReturnNotes] = useState("");
  const [transferReason, setTransferReason] = useState("");

  const getActiveHolder = (aId: number) => {
    const activeAlloc = allocations.find(
      (al) => al.asset_id === aId && al.status === "Active"
    );
    if (!activeAlloc) return "unknown custodian";
    if (activeAlloc.employee_name) return `${activeAlloc.employee_name} (${activeAlloc.employee_email})`;
    if (activeAlloc.department_name) return `Department: ${activeAlloc.department_name}`;
    return "another custodian";
  };

  const triggerTransferRequest = async (aId: number) => {
    try {
      const activeAlloc = allocations.find(al => al.asset_id === aId && al.status === "Active");
      if (!activeAlloc || !activeAlloc.employee_id) {
        showToast("error", "Asset must be currently allocated to an employee to initiate a transfer.");
        return;
      }
      
      await apiFetch("/allocations/transfers", {
        method: "POST",
        body: JSON.stringify({
          asset_id: aId,
          to_employee_id: transferToEmployeeId || user?.id,
        }),
      });

      showToast("success", `Custody transfer request raised successfully to ${activeAlloc.employee_name}`);
      setAssetId("");
      setTransferToEmployeeId("");
      setTransferReason("");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const allocData = await apiFetch("/allocations");
      setAllocations(allocData.allocations);

      const transData = await apiFetch("/allocations/transfers");
      setTransfers(transData.transfers);

      // Fetch assets, employees, departments for dropdowns
      const assetsData = await apiFetch("/assets");
      setAssets(assetsData.assets);

      const empsData = await apiFetch("/org/employees");
      setEmployees(empsData.employees);

      const deptsData = await apiFetch("/org/departments");
      setDepartments(deptsData.departments);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load allocation data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        asset_id: Number(assetId),
        employee_id: targetType === "employee" ? Number(employeeId) : null,
        department_id: targetType === "department" ? Number(departmentId) : null,
        expected_return_date: expectedReturnDate,
        condition_notes: conditionNotes,
      };

      await apiFetch("/allocations", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showToast("success", "Asset allocated successfully!");
      setAssetId("");
      setEmployeeId("");
      setDepartmentId("");
      setExpectedReturnDate("");
      setConditionNotes("");
      fetchData();
    } catch (err: any) {
      // Highlight exact error message returned by backend
      showToast("error", err.message);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningAlloc) return;
    try {
      await apiFetch(`/allocations/${returningAlloc.id}/return`, {
        method: "POST",
        body: JSON.stringify({ condition_notes: returnNotes }),
      });

      showToast("success", "Asset return processed successfully");
      setReturningAlloc(null);
      setReturnNotes("");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/allocations/transfers", {
        method: "POST",
        body: JSON.stringify({
          asset_id: Number(transferAssetId),
          to_employee_id: Number(transferToEmployeeId),
        }),
      });

      showToast("success", "Transfer request submitted successfully");
      setTransferAssetId("");
      setTransferToEmployeeId("");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const handleApproveTransfer = async (id: number) => {
    try {
      await apiFetch(`/allocations/transfers/${id}/approve`, { method: "POST" });
      showToast("success", "Asset transfer approved and recorded");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const handleRejectTransfer = async (id: number) => {
    try {
      await apiFetch(`/allocations/transfers/${id}/reject`, { method: "POST" });
      showToast("success", "Transfer request rejected");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", fontSize: "16px", color: "var(--text-secondary)" }}>Loading allocations...</div>;
  }

  return (
    <div className="animate-fade">
      {/* 1. Allocation & Transfer Requests Forms grid */}
      <div className="grid-cols-2">
        {/* Allocation Form (Asset Managers Only) */}
        {user?.role === "AssetManager" ? (
          <div className="card">
            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Plus size={18} color="var(--accent-primary)" />
              Allocate Physical Asset
            </h3>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Asset to Allocate</label>
              <select className="form-control" value={assetId} onChange={(e) => setAssetId(e.target.value ? Number(e.target.value) : "")} required>
                <option value="">Select Asset to Allocate</option>
                <optgroup label="Available Assets (Ready)">
                  {assets
                    .filter((a) => a.status === "Available")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.asset_tag})
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Allocated Assets (Conflicts)">
                  {assets
                    .filter((a) => a.status === "Allocated")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        🚨 [Conflict] {a.name} ({a.asset_tag})
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            {(() => {
              const selectedAsset = assets.find((a) => a.id === assetId);
              if (selectedAsset && selectedAsset.status === "Allocated") {
                const holder = getActiveHolder(selectedAsset.id);
                const selectedAssetAllocations = allocations
                  .filter((a) => a.asset_id === assetId)
                  .sort((a, b) => new Date(b.allocated_date).getTime() - new Date(a.allocated_date).getTime());
                
                const getHistoryText = (alloc: Allocation) => {
                  const dateStr = new Date(alloc.allocated_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  const targetName = alloc.employee_name || alloc.department_name || "Custodian";
                  const deptInfo = alloc.department_name ? ` - ${alloc.department_name}` : "";
                  
                  if (alloc.status === "Active" || alloc.status === "Overdue") {
                    return `${dateStr} - Allocated to ${targetName}${deptInfo}`;
                  } else {
                    const returnDateStr = alloc.actual_return_date ? new Date(alloc.actual_return_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
                    return `${returnDateStr || dateStr} - Returned by ${targetName} - condition ${alloc.condition_notes || "good"}`;
                  }
                };

                return (
                  <div className="animate-fade">
                    <div style={{
                      backgroundColor: "#FEF2F2",
                      border: "2px solid #EF4444",
                      color: "#991B1B",
                      padding: "14px",
                      borderRadius: "var(--radius-sm)",
                      marginBottom: "20px",
                      fontSize: "12.5px"
                    }}>
                      <div style={{ fontWeight: 700 }}>Already Allocated to {holder}</div>
                      <div style={{ marginTop: "4px" }}>Direct re-allocation is blocked - submit a transfer request below</div>
                    </div>

                    <form onSubmit={(e) => {
                      e.preventDefault();
                      triggerTransferRequest(selectedAsset.id);
                    }}>
                      <h4 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", color: "var(--text-primary)" }}>Transfer Request</h4>
                      
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">From</label>
                          <input type="text" className="form-control" value={holder} disabled style={{ backgroundColor: "#F9FAFB", cursor: "not-allowed" }} />
                        </div>

                        <div className="form-group">
                          <label className="form-label">To</label>
                          <select className="form-control" value={transferToEmployeeId} onChange={(e) => setTransferToEmployeeId(e.target.value ? Number(e.target.value) : "")} required>
                            <option value="">Select Employee...</option>
                            {employees.map((e) => (
                              <option key={e.id} value={e.id}>{e.name} ({e.email})</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Reason</label>
                        <textarea className="form-control" rows={3} placeholder="Reason..." value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />
                      </div>

                      <button type="submit" className="btn btn-primary" style={{ backgroundColor: "#15803d", borderColor: "#15803d", color: "#ffffff", fontWeight: 700 }}>
                        Submit Request
                      </button>
                    </form>

                    <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "2px solid var(--border-color)" }}>
                      <h4 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", color: "var(--text-primary)" }}>Allocation history</h4>
                      {selectedAssetAllocations.length === 0 ? (
                        <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", fontStyle: "italic" }}>No prior history logs.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: "var(--text-primary)" }}>
                          {selectedAssetAllocations.map((alloc) => (
                            <div key={alloc.id} style={{ fontFamily: "var(--font-mono)" }}>
                              {getHistoryText(alloc)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <form onSubmit={handleAllocateSubmit}>
                  <div className="form-group">
                    <label className="form-label">Custodian Target Type</label>
                    <div style={{ display: "flex", gap: "16px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", cursor: "pointer" }}>
                        <input type="radio" name="targetType" checked={targetType === "employee"} onChange={() => setTargetType("employee")} style={{ accentColor: "var(--accent-primary)" }} />
                        Individual Employee
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", cursor: "pointer" }}>
                        <input type="radio" name="targetType" checked={targetType === "department"} onChange={() => setTargetType("department")} style={{ accentColor: "var(--accent-primary)" }} />
                        Department Office
                      </label>
                    </div>
                  </div>

                  {targetType === "employee" ? (
                    <div className="form-group">
                      <label className="form-label">Target Employee</label>
                      <select className="form-control" value={employeeId} onChange={(e) => setEmployeeId(e.target.value ? Number(e.target.value) : "")} required={targetType === "employee"}>
                        <option value="">Select Employee</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>{e.name} ({e.email})</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Target Department</label>
                      <select className="form-control" value={departmentId} onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : "")} required={targetType === "department"}>
                        <option value="">Select Department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Expected Return Date</label>
                    <input type="date" className="form-control" value={expectedReturnDate} onChange={(e) => setExpectedReturnDate(e.target.value)} required />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Allocation Condition Notes</label>
                    <textarea className="form-control" rows={2} placeholder="Physical state comments..." value={conditionNotes} onChange={(e) => setConditionNotes(e.target.value)} />
                  </div>

                  <button type="submit" className="btn btn-primary">Allocate Asset</button>
                </form>
              );
            })()}
          </div>
        ) : (
          <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <div>
              <AlertTriangle size={32} color="var(--warning)" style={{ marginBottom: "12px" }} />
              <h3 style={{ fontSize: "15px", fontWeight: 600 }}>Allocation Lock</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", maxWidth: "280px", marginTop: "4px" }}>
                Only designated **Asset Managers** can issue physical assets to staff or offices.
              </p>
            </div>
          </div>
        )}

        {/* Transfer Request Form (Everyone) */}
        <div className="card">
          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <ArrowRightLeft size={18} color="var(--accent-primary)" />
            Raise Transfer Request
          </h3>
          <form onSubmit={handleTransferSubmit}>
            <div className="form-group">
              <label className="form-label">Asset to Transfer</label>
              <select className="form-control" value={transferAssetId} onChange={(e) => setTransferAssetId(e.target.value ? Number(e.target.value) : "")} required>
                <option value="">Select Allocated Asset</option>
                {assets
                  .filter((a) => a.status === "Allocated")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.asset_tag})
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Transfer Target Employee</label>
              <select className="form-control" value={transferToEmployeeId} onChange={(e) => setTransferToEmployeeId(e.target.value ? Number(e.target.value) : "")} required>
                <option value="">Select Recipient</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.email})</option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn btn-secondary">Submit Transfer Request</button>
          </form>
        </div>
      </div>

      {/* 2. Active Allocations Directory */}
      <div className="card" style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Active custody Directory</h3>
        <div className="table-container">
          <table className="table-el">
            <thead>
              <tr>
                <th>Asset Tag</th>
                <th>Asset Name</th>
                <th>Custodian Target</th>
                <th>Allocated Date</th>
                <th>Expected Return</th>
                <th>Status</th>
                <th>Notes</th>
                {user?.role === "AssetManager" && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {allocations
                .filter((a) => a.status === "Active" || a.status === "Overdue")
                .map((alloc) => (
                  <tr key={alloc.id}>
                    <td style={{ fontWeight: 600, color: "var(--accent-primary)" }}>{alloc.asset_tag}</td>
                    <td style={{ fontWeight: 600 }}>{alloc.asset_name}</td>
                    <td>
                      {alloc.employee_name ? (
                        <div>
                          <strong>{alloc.employee_name}</strong>
                          <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>{alloc.employee_email}</span>
                        </div>
                      ) : (
                        <strong>Dept Office: {alloc.department_name}</strong>
                      )}
                    </td>
                    <td>{new Date(alloc.allocated_date).toLocaleDateString()}</td>
                    <td>{new Date(alloc.expected_return_date).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${alloc.status === "Overdue" ? "badge-danger" : "badge-info"}`}>{alloc.status}</span>
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>{alloc.condition_notes || "—"}</td>
                    {user?.role === "AssetManager" && (
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => setReturningAlloc(alloc)}>
                          <RotateCcw size={12} style={{ marginRight: "4px" }} /> Return
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Pending Transfer Requests Directory */}
      <div className="card">
        <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Relocation Transfer Requests</h3>
        <div className="table-container">
          <table className="table-el">
            <thead>
              <tr>
                <th>Asset Tag</th>
                <th>Asset Name</th>
                <th>From Custodian</th>
                <th>To Recipient</th>
                <th>Raised Date</th>
                <th>Status</th>
                {user?.role === "AssetManager" && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {transfers.map((trans) => (
                <tr key={trans.id}>
                  <td style={{ fontWeight: 600, color: "var(--accent-primary)" }}>{trans.asset_tag}</td>
                  <td style={{ fontWeight: 600 }}>{trans.asset_name}</td>
                  <td>{trans.from_employee_name}</td>
                  <td>
                    <div>
                      <strong>{trans.to_employee_name}</strong>
                      <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>{trans.to_employee_email}</span>
                    </div>
                  </td>
                  <td>{new Date(trans.created_at).toLocaleDateString()}</td>
                  <td>
                    <span
                      className={`badge ${
                        trans.status === "Completed"
                          ? "badge-success"
                          : trans.status === "Rejected"
                          ? "badge-danger"
                          : "badge-warning"
                      }`}
                    >
                      {trans.status}
                    </span>
                  </td>
                  {user?.role === "AssetManager" && (
                    <td>
                      {trans.status === "Requested" ? (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button className="btn btn-primary btn-sm" onClick={() => handleApproveTransfer(trans.id)}>
                            Approve
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleRejectTransfer(trans.id)}>
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Closed</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. RETURN CONFIRMATION MODAL */}
      {returningAlloc && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: 700 }}>Process Asset Return</h3>
              <button
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px" }}
                onClick={() => setReturningAlloc(null)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleReturnSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: "14px", marginBottom: "16px" }}>
                  Please verify the state of asset **{returningAlloc.asset_name} ({returningAlloc.asset_tag})** before confirming its return.
                </p>
                <div className="form-group">
                  <label className="form-label">Return Condition Notes</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Describe condition details (e.g. Scratches on lid, missing power supply, perfect condition)..."
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setReturningAlloc(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

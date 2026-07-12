import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ClipboardCheck, Plus, Check, X, ShieldAlert, FileText, ChevronRight, CheckCircle2 } from "lucide-react";

interface AuditCycle {
  id: number;
  scope_department_id: number | null;
  department_name: string | null;
  scope_location: string | null;
  start_date: string;
  end_date: string;
  status: "Open" | "Closed";
  auditors: { id: number; name: string; email: string }[];
}

interface AuditResult {
  id: number;
  audit_cycle_id: number;
  asset_id: number;
  asset_name: string;
  asset_tag: string;
  result: "Verified" | "Missing" | "Damaged";
  notes: string | null;
}

interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Department {
  id: number;
  name: string;
}

interface Asset {
  id: number;
  name: string;
  asset_tag: string;
  location: string;
  status: string;
}

export const Audits: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const { showToast } = useToast();
  const [cycles, setCycles] = useState<AuditCycle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Cycle Creation Form State
  const [scopeDeptId, setScopeDeptId] = useState<number | "">("");
  const [scopeLocation, setScopeLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedAuditors, setSelectedAuditors] = useState<number[]>([]);

  // Active Selected Cycle for Auditing or Reports
  const [activeCycle, setActiveCycle] = useState<AuditCycle | null>(null);
  const [scopedAssets, setScopedAssets] = useState<Asset[]>([]);
  const [submittedResults, setSubmittedResults] = useState<Record<number, any>>({}); // asset_id -> result record
  
  // Discrepancy report preview state
  const [discrepancyReport, setDiscrepancyReport] = useState<any | null>(null);

  // Form input for auditing an asset
  const [auditingAsset, setAuditingAsset] = useState<Asset | null>(null);
  const [auditOutcome, setAuditOutcome] = useState<"Verified" | "Missing" | "Damaged">("Verified");
  const [auditNotes, setAuditNotes] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const cyclesData = await apiFetch("/audits/cycles");
      setCycles(cyclesData.cycles);

      const empsData = await apiFetch("/org/employees");
      setEmployees(empsData.employees);

      const deptsData = await apiFetch("/org/departments");
      setDepartments(deptsData.departments);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load audit modules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAuditors.length === 0) {
      showToast("error", "Must assign at least one auditor");
      return;
    }

    try {
      await apiFetch("/audits/cycles", {
        method: "POST",
        body: JSON.stringify({
          scope_department_id: scopeDeptId === "" ? null : scopeDeptId,
          scope_location: scopeLocation || null,
          start_date: startDate,
          end_date: endDate,
          auditor_ids: selectedAuditors,
        }),
      });

      showToast("success", "Audit Cycle created and auditors notified!");
      setScopeDeptId("");
      setScopeLocation("");
      setStartDate("");
      setEndDate("");
      setSelectedAuditors([]);
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const handleAuditorSelectToggle = (id: number) => {
    setSelectedAuditors((prev) =>
      prev.includes(id) ? prev.filter((aId) => aId !== id) : [...prev, id]
    );
  };

  // Open Cycle auditing view
  const handleSelectCycle = async (cycle: AuditCycle) => {
    setActiveCycle(cycle);
    setAuditingAsset(null);
    setDiscrepancyReport(null);

    try {
      // 1. Fetch discrepancy report (which evaluates scoped assets + submitted results)
      const reportData = await apiFetch(`/audits/cycles/${cycle.id}/report`);
      setDiscrepancyReport(reportData.summary);
      
      // Combine all assets in scope for list
      const allAssets = [
        ...reportData.report.verified,
        ...reportData.report.missing,
        ...reportData.report.damaged,
        ...reportData.report.unaudited,
      ].sort((a, b) => a.id - b.id);
      
      setScopedAssets(allAssets);

      // Map submitted results by asset ID
      const resultsMap: Record<number, any> = {};
      reportData.report.verified.forEach((a: any) => (resultsMap[a.id] = { result: "Verified", notes: a.audit_notes }));
      reportData.report.missing.forEach((a: any) => (resultsMap[a.id] = { result: "Missing", notes: a.audit_notes }));
      reportData.report.damaged.forEach((a: any) => (resultsMap[a.id] = { result: "Damaged", notes: a.audit_notes }));
      setSubmittedResults(resultsMap);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load audit assets");
    }
  };

  // Submit single asset audit outcome
  const handleAuditOutcomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCycle || !auditingAsset) return;

    try {
      await apiFetch(`/audits/cycles/${activeCycle.id}/results`, {
        method: "POST",
        body: JSON.stringify({
          asset_id: auditingAsset.id,
          result: auditOutcome,
          notes: auditNotes,
        }),
      });

      showToast("success", `Outcome recorded for ${auditingAsset.asset_tag}`);
      setAuditingAsset(null);
      setAuditNotes("");
      setAuditOutcome("Verified");
      
      // Refresh active cycle list
      handleSelectCycle(activeCycle);
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const handleCloseCycle = async () => {
    if (!activeCycle) return;
    if (!confirm("Are you sure you want to CLOSE this cycle? This is FINAL, will lock all outcomes, and update physical asset statuses immediately (Missing -> Lost, Damaged -> UnderMaintenance).")) return;

    try {
      await apiFetch(`/audits/cycles/${activeCycle.id}/close`, { method: "POST" });
      showToast("success", "Audit Cycle closed successfully. Asset statuses updated.");
      setActiveCycle(null);
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", fontSize: "16px", color: "var(--text-secondary)" }}>Loading audits...</div>;
  }

  const isAdmin = user?.role === "Admin";

  return (
    <div className="animate-fade">
      {/* Dynamic View split: if no cycle selected, show Admin cycle creator + cycle listing */}
      {!activeCycle ? (
        <div className="grid-cols-2">
          {/* Admin Create Cycle Form */}
          {isAdmin ? (
            <div className="card">
              <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Plus size={18} color="var(--accent-primary)" />
                Schedule Audit Cycle
              </h3>
              <form onSubmit={handleCreateCycle}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Scope Department</label>
                    <select className="form-control" value={scopeDeptId} onChange={(e) => setScopeDeptId(e.target.value ? Number(e.target.value) : "")}>
                      <option value="">Global (All Departments)</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Scope Location</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Warehouse A"
                      value={scopeLocation}
                      onChange={(e) => setScopeLocation(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                  </div>
                </div>

                {/* Auditor Multi-select checklist */}
                <div className="form-group">
                  <label className="form-label">Assign Auditors</label>
                  <div
                    style={{
                      maxHeight: "130px",
                      overflowY: "auto",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-sm)",
                      padding: "10px 16px",
                      backgroundColor: "var(--bg-primary)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {employees.map((emp) => (
                      <label key={emp.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={selectedAuditors.includes(emp.id)}
                          onChange={() => handleAuditorSelectToggle(emp.id)}
                          style={{ accentColor: "var(--accent-primary)" }}
                        />
                        {emp.name} ({emp.role})
                      </label>
                    ))}
                  </div>
                </div>

                <button type="submit" className="btn btn-primary">Create Audit Cycle</button>
              </form>
            </div>
          ) : (
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <div>
                <ShieldAlert size={32} color="var(--warning)" style={{ marginBottom: "12px" }} />
                <h3 style={{ fontSize: "15px", fontWeight: 600 }}>Administrative Lock</h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", maxWidth: "280px", marginTop: "4px" }}>
                  Only system **Administrators** can initialize, schedule, or close physical asset audits.
                </p>
              </div>
            </div>
          )}

          {/* Audit Cycles listing */}
          <div className="card">
            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Scheduled Audit Cycles</h3>
            <div className="table-container">
              <table className="table-el">
                <thead>
                  <tr>
                    <th>Cycle ID</th>
                    <th>Scope</th>
                    <th>Date Range</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>
                        No audit cycles scheduled.
                      </td>
                    </tr>
                  ) : (
                    cycles.map((cyc) => (
                      <tr key={cyc.id}>
                        <td style={{ fontWeight: 600 }}>Cycle #{cyc.id}</td>
                        <td>
                          {cyc.department_name ? `Dept: ${cyc.department_name}` : "Global"}
                          {cyc.scope_location && ` • Loc: ${cyc.scope_location}`}
                        </td>
                        <td style={{ fontSize: "12px" }}>
                          {new Date(cyc.start_date).toLocaleDateString()} - {new Date(cyc.end_date).toLocaleDateString()}
                        </td>
                        <td>
                          <span className={`badge ${cyc.status === "Open" ? "badge-info" : "badge-success"}`}>{cyc.status}</span>
                        </td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleSelectCycle(cyc)}>
                            Open <ChevronRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Cycle Auditing / Summary Report View */
        <div className="animate-fade">
          {/* Header Controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveCycle(null)} style={{ marginBottom: "8px" }}>
                ← Back to List
              </button>
              <h2 style={{ fontSize: "20px", fontWeight: 700 }}>
                Audit Cycle #{activeCycle.id} Configuration
              </h2>
              <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Scope: {activeCycle.department_name ? `Department ${activeCycle.department_name}` : "Global Inventory"}
                {activeCycle.scope_location && ` • Location ${activeCycle.scope_location}`}
              </span>
            </div>

            {isAdmin && activeCycle.status === "Open" && (
              <button className="btn btn-danger" onClick={handleCloseCycle}>
                <CheckCircle2 size={16} /> Close & Lock Cycle
              </button>
            )}
          </div>

          {/* Report summary card */}
          {discrepancyReport && (
            <div className="card" style={{ marginBottom: "24px", display: "flex", flexWrap: "wrap", gap: "24px", justifyContent: "space-between" }}>
              <div>
                <span className="card-title" style={{ fontSize: "12px" }}>Audited Rate</span>
                <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "4px" }}>
                  {discrepancyReport.total_scoped > 0
                    ? Math.round((discrepancyReport.total_audited / discrepancyReport.total_scoped) * 100)
                    : 0}
                  %
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {discrepancyReport.total_audited} of {discrepancyReport.total_scoped} assets check-in
                </span>
              </div>
              <div>
                <span className="card-title" style={{ fontSize: "12px", color: "var(--success)" }}>Verified</span>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--success)", marginTop: "4px" }}>
                  {discrepancyReport.verified_count}
                </div>
              </div>
              <div>
                <span className="card-title" style={{ fontSize: "12px", color: "var(--danger)" }}>Missing Discrepancy</span>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--danger)", marginTop: "4px" }}>
                  {discrepancyReport.missing_count}
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Auto-Lost flag on close</span>
              </div>
              <div>
                <span className="card-title" style={{ fontSize: "12px", color: "var(--warning)" }}>Damaged Discrepancy</span>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--warning)", marginTop: "4px" }}>
                  {discrepancyReport.damaged_count}
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Auto-Maintenance trigger</span>
              </div>
              <div>
                <span className="card-title" style={{ fontSize: "12px" }}>Un-audited</span>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-muted)", marginTop: "4px" }}>
                  {discrepancyReport.unaudited_count}
                </div>
              </div>
            </div>
          )}

          {/* Two Pane split: Left shows scoped assets list, Right shows single auditing card */}
          <div className="grid-cols-3">
            {/* Scoped Assets List */}
            <div className="card" style={{ gridColumn: "span 2" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Scoped Assets Checklist</h3>
              <div className="table-container">
                <table className="table-el">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Location</th>
                      <th>Audit Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedAssets.map((asset) => {
                      const resItem = submittedResults[asset.id];
                      return (
                        <tr key={asset.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{asset.name}</div>
                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{asset.asset_tag}</span>
                          </td>
                          <td>{asset.location}</td>
                          <td>
                            {resItem ? (
                              <span
                                className={`badge ${
                                  resItem.result === "Verified"
                                    ? "badge-success"
                                    : resItem.result === "Damaged"
                                    ? "badge-warning"
                                    : "badge-danger"
                                }`}
                              >
                                {resItem.result}
                              </span>
                            ) : (
                              <span className="badge badge-muted">Un-audited</span>
                            )}
                          </td>
                          <td>
                            {activeCycle.status === "Open" ? (
                              <button className="btn btn-secondary btn-sm" onClick={() => setAuditingAsset(asset)}>
                                Record Result
                              </button>
                            ) : (
                              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Locked</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit record card */}
            <div className="card" style={{ gridColumn: "span 1" }}>
              {auditingAsset ? (
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>
                    Verify Asset {auditingAsset.asset_tag}
                  </h3>
                  <form onSubmit={handleAuditOutcomeSubmit}>
                    <div className="form-group">
                      <label className="form-label">Asset Name</label>
                      <input type="text" className="form-control" value={auditingAsset.name} disabled />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Audit Outcome</label>
                      <select
                        className="form-control"
                        value={auditOutcome}
                        onChange={(e) => setAuditOutcome(e.target.value as any)}
                      >
                        <option value="Verified">Verified & Correct</option>
                        <option value="Missing">Missing / Lost</option>
                        <option value="Damaged">Damaged / Broken</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Outcome Notes / Remarks</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        placeholder="Add details, notes, serial number checks..."
                        value={auditNotes}
                        onChange={(e) => setAuditNotes(e.target.value)}
                      ></textarea>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <button type="submit" className="btn btn-primary">Save Outcome</button>
                      <button type="button" className="btn btn-secondary" onClick={() => setAuditingAsset(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                  <FileText size={32} style={{ marginBottom: "12px", opacity: 0.5 }} />
                  <div>Select an asset from the checklist to log its current outcome.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

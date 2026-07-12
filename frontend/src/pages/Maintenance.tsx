import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Wrench, Plus, Check, X, ShieldAlert, UserCheck, Play, CheckCircle } from "lucide-react";

interface MaintenanceRequest {
  id: number;
  asset_id: number;
  asset_name: string;
  asset_tag: string;
  asset_location: string;
  raised_by_employee_id: number;
  raised_by_name: string;
  raised_by_email: string;
  issue_description: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Pending" | "Approved" | "Rejected" | "TechnicianAssigned" | "InProgress" | "Resolved";
  approved_by: number | null;
  approved_by_name: string | null;
  technician_name: string | null;
  created_at: string;
}

interface Asset {
  id: number;
  name: string;
  asset_tag: string;
}

export const Maintenance: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showAddModal, setShowAddModal] = useState(false);
  const [assetId, setAssetId] = useState<number | "">("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<any>("Medium");

  // Technician Dialog state
  const [assigningReqId, setAssigningReqId] = useState<number | null>(null);
  const [techName, setTechName] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const maintData = await apiFetch("/maintenance");
      setRequests(maintData.requests);

      const assetsData = await apiFetch("/assets");
      setAssets(assetsData.assets);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load maintenance requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRaiseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/maintenance", {
        method: "POST",
        body: JSON.stringify({
          asset_id: Number(assetId),
          issue_description: desc,
          priority,
        }),
      });

      showToast("success", "Maintenance ticket raised on Kanban board");
      setAssetId("");
      setDesc("");
      setPriority("Medium");
      setShowAddModal(false);
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await apiFetch(`/maintenance/${id}/approve`, { method: "POST" });
      showToast("success", "Ticket Approved. Relocated to Scheduled column.");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const handleReject = async (id: number) => {
    try {
      await apiFetch(`/maintenance/${id}/reject`, { method: "POST" });
      showToast("success", "Ticket rejected");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const handleAssignTechSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningReqId) return;
    try {
      await apiFetch(`/maintenance/${assigningReqId}/assign`, {
        method: "POST",
        body: JSON.stringify({
          technician_name: techName,
          status: "InProgress",
        }),
      });

      showToast("success", "Technician assigned. Ticket moved to In Progress.");
      setAssigningReqId(null);
      setTechName("");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await apiFetch(`/maintenance/${id}/resolve`, { method: "POST" });
      showToast("success", "Ticket resolved. Asset set back to Available.");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", fontSize: "16px", color: "var(--text-secondary)" }}>Loading maintenance board...</div>;
  }

  const isManager = user?.role === "AssetManager" || user?.role === "Admin";

  // Filter requests into Kanban columns
  const getColTickets = (statusGroup: "Pending" | "Scheduled" | "InProgress" | "Resolved") => {
    return requests.filter((r) => {
      if (statusGroup === "Pending") return r.status === "Pending";
      if (statusGroup === "Scheduled") return r.status === "Approved" || r.status === "TechnicianAssigned";
      if (statusGroup === "InProgress") return r.status === "InProgress";
      return r.status === "Resolved" || r.status === "Rejected";
    });
  };

  const columns = [
    { id: "Pending" as const, title: "Pending Review", count: getColTickets("Pending").length },
    { id: "Scheduled" as const, title: "Scheduled / Approved", count: getColTickets("Scheduled").length },
    { id: "InProgress" as const, title: "In Progress", count: getColTickets("InProgress").length },
    { id: "Resolved" as const, title: "Resolved / Closed", count: getColTickets("Resolved").length },
  ];

  return (
    <div className="animate-fade" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Board Header Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Kanban dashboard of physical asset breakdowns, priority tickets, and repair schedules.
          </span>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> File Bug / Incident Ticket
        </button>
      </div>

      {/* Kanban Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          overflowX: "auto",
          alignItems: "flex-start",
          minHeight: "65vh",
        }}
      >
        {columns.map((col) => (
          <div
            key={col.id}
            style={{
              backgroundColor: "rgba(241, 245, 249, 0.6)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-lg)",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              maxHeight: "75vh",
              overflowY: "auto",
            }}
          >
            {/* Column Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text-primary)" }}>{col.title}</h4>
              <span className="badge badge-muted" style={{ padding: "2px 6px", fontSize: "11px", fontWeight: 700 }}>
                {col.count}
              </span>
            </div>

            {/* Column Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {getColTickets(col.id).length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: "12px", border: "1px dashed var(--border-color)", borderRadius: "var(--radius-sm)" }}>
                  No tickets
                </div>
              ) : (
                getColTickets(col.id).map((req) => (
                  <div
                    key={req.id}
                    className="card"
                    style={{
                      padding: "14px",
                      borderRadius: "var(--radius-sm)",
                      borderLeft: `3px solid ${
                        req.priority === "Critical"
                          ? "var(--danger)"
                          : req.priority === "High"
                          ? "var(--warning)"
                          : "var(--accent-primary)"
                      }`,
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    {/* Priority & Tag */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-primary)" }}>
                        {req.asset_tag}
                      </span>
                      <span
                        className={`badge ${
                          req.priority === "Critical"
                            ? "badge-danger"
                            : req.priority === "High"
                            ? "badge-warning"
                            : "badge-muted"
                        }`}
                        style={{ fontSize: "9px", padding: "1px 4px" }}
                      >
                        {req.priority}
                      </span>
                    </div>

                    {/* Ticket Title / Info */}
                    <strong style={{ fontSize: "13.5px", color: "var(--text-primary)" }}>{req.asset_name}</strong>
                    
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.4, wordBreak: "break-word" }}>
                      {req.issue_description}
                    </p>

                    {/* Step-based workflow progress tracker */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "6px 0", padding: "4px 0" }}>
                      {["Pending", "Approved", "InProgress", "Resolved"].map((stepStatus, sIdx) => {
                        const statuses = ["Pending", "Approved", "InProgress", "Resolved"];
                        const isRejected = req.status === "Rejected";
                        const currentStatus = req.status === "TechnicianAssigned" ? "InProgress" : req.status;
                        const currentIdx = statuses.indexOf(currentStatus);
                        const isActive = isRejected ? (stepStatus === "Pending") : (sIdx <= currentIdx);
                        return (
                          <React.Fragment key={stepStatus}>
                            <div 
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                backgroundColor: isRejected && stepStatus === "Approved" ? "var(--danger)" : (isActive ? "var(--accent-primary)" : "var(--border-color)"),
                                border: isActive ? "2px solid rgba(49, 46, 129, 0.15)" : "none",
                              }} 
                              title={`${stepStatus} state`} 
                            />
                            {sIdx < 3 && <div style={{
                              flex: 1,
                              height: "2px",
                              backgroundColor: !isRejected && isActive && sIdx < currentIdx ? "var(--accent-primary)" : "var(--border-color)",
                              margin: "0 4px"
                            }} />}
                          </React.Fragment>
                        );
                      })}
                    </div>

                    <div style={{ fontSize: "10px", color: "var(--text-muted)", borderTop: "1px solid var(--border-color)", paddingTop: "6px", marginTop: "2px" }}>
                      Opened by: {req.raised_by_name} <br />
                      {req.technician_name ? `Tech: ${req.technician_name}` : "Unassigned"}
                    </div>

                    {/* Action Panel based on state */}
                    {isManager && (
                      <div style={{ display: "flex", gap: "6px", marginTop: "6px", borderTop: "1px solid var(--border-color)", paddingTop: "8px" }}>
                        {req.status === "Pending" && (
                          <>
                            <button className="btn btn-primary btn-sm" style={{ padding: "4px 8px", fontSize: "11px", flex: 1 }} onClick={() => handleApprove(req.id)}>
                              Approve
                            </button>
                            <button className="btn btn-danger btn-sm" style={{ padding: "4px" }} onClick={() => handleReject(req.id)}>
                              <X size={12} />
                            </button>
                          </>
                        )}
                        {(req.status === "Approved" || req.status === "TechnicianAssigned") && (
                          <button className="btn btn-secondary btn-sm" style={{ padding: "4px 8px", fontSize: "11px", flex: 1 }} onClick={() => setAssigningReqId(req.id)}>
                            <UserCheck size={12} style={{ marginRight: "4px" }} /> Assign Tech
                          </button>
                        )}
                        {req.status === "InProgress" && (
                          <button className="btn btn-primary btn-sm" style={{ padding: "4px 8px", fontSize: "11px", flex: 1, backgroundColor: "var(--success)" }} onClick={() => handleResolve(req.id)}>
                            <CheckCircle size={12} style={{ marginRight: "4px" }} /> Resolve Ticket
                          </button>
                        )}
                        {req.status === "Resolved" && (
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>Closed Ledger</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Raised Modal Popup */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: 700 }}>File Maintenance incident</h3>
              <button
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px" }}
                onClick={() => setShowAddModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleRaiseSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Asset Tag / Resource</label>
                  <select className="form-control" value={assetId} onChange={(e) => setAssetId(e.target.value ? Number(e.target.value) : "")} required>
                    <option value="">Select Asset</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.asset_tag})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Priority Level</label>
                  <select className="form-control" value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Malfunction / Damage Symptoms</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Provide details on physical issues, error tags, or broken structures..."
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Technician Assignment */}
      {assigningReqId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: 700 }}>Assign Field Technician</h3>
              <button
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px" }}
                onClick={() => setAssigningReqId(null)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAssignTechSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Technician Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Robert Martin, Alex Repairman"
                    value={techName}
                    onChange={(e) => setTechName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAssigningReqId(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Start Incident Repair
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

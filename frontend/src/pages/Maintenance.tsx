import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Wrench, Plus, Check, X, ShieldAlert, UserCheck, Play, CheckCircle, Sparkles } from "lucide-react";

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
  status: string;
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
      showToast("success", "Ticket Approved and moved to Scheduled.");
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
          status: "TechnicianAssigned",
        }),
      });

      showToast("success", "Technician assigned. Ticket moved to Technician Assigned column.");
      setAssigningReqId(null);
      setTechName("");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const handleStartWork = async (req: MaintenanceRequest) => {
    try {
      await apiFetch(`/maintenance/${req.id}/assign`, {
        method: "POST",
        body: JSON.stringify({
          technician_name: req.technician_name,
          status: "InProgress",
        }),
      });

      showToast("success", "Work started. Ticket moved to In Progress column.");
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

  // Filter requests into Kanban columns (Screen 7 columns: Pending, Approved, TechnicianAssigned, InProgress, Resolved)
  const getColTickets = (colId: "Pending" | "Approved" | "TechnicianAssigned" | "InProgress" | "Resolved") => {
    return requests.filter((r) => {
      if (colId === "Pending") return r.status === "Pending";
      if (colId === "Approved") return r.status === "Approved";
      if (colId === "TechnicianAssigned") return r.status === "TechnicianAssigned";
      if (colId === "InProgress") return r.status === "InProgress";
      return r.status === "Resolved" || r.status === "Rejected"; // group rejected in resolved column to keep board tidy
    });
  };

  const columns = [
    { id: "Pending" as const, title: "Pending", count: getColTickets("Pending").length },
    { id: "Approved" as const, title: "Approved", count: getColTickets("Approved").length },
    { id: "TechnicianAssigned" as const, title: "Technician assigned", count: getColTickets("TechnicianAssigned").length },
    { id: "InProgress" as const, title: "in progress", count: getColTickets("InProgress").length },
    { id: "Resolved" as const, title: "Resolved", count: getColTickets("Resolved").length },
  ];

  return (
    <div className="animate-fade" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Board Header Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Incident workflow</h3>
          <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Kanban workflow board of asset breakdowns, priority checklists, and repair schedules.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> File incident ticket
        </button>
      </div>

      {/* Kanban Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "14px",
          overflowX: "auto",
          alignItems: "flex-start",
          minHeight: "60vh",
          paddingBottom: "20px"
        }}
      >
        {columns.map((col) => (
          <div
            key={col.id}
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.4)",
              border: "2px solid var(--border-color)",
              borderRadius: "var(--radius-sm)",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              minHeight: "50vh",
              maxHeight: "70vh",
              overflowY: "auto"
            }}
          >
            {/* Column Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid var(--border-color)", paddingBottom: "6px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", textTransform: "capitalize" }}>{col.title}</h4>
              <span className="badge badge-muted" style={{ padding: "1px 6px", fontSize: "10.5px" }}>
                {col.count}
              </span>
            </div>

            {/* Column Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {getColTickets(col.id).length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)", fontSize: "11.5px", fontStyle: "italic" }}>
                  Empty column
                </div>
              ) : (
                getColTickets(col.id).map((req) => {
                  const isResolved = req.status === "Resolved";
                  const formattedDate = new Date(req.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short" });

                  return (
                    <div
                      key={req.id}
                      style={{
                        padding: "14px",
                        borderRadius: "var(--radius-sm)",
                        border: isResolved ? "2px solid #14532d" : "2px solid var(--border-color)",
                        backgroundColor: isResolved ? "#14532d" : "var(--bg-secondary)",
                        color: isResolved ? "#ffffff" : "var(--text-primary)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        boxShadow: isResolved ? "none" : "var(--shadow-sm)"
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "12.5px", fontFamily: "var(--font-mono)", color: isResolved ? "#bbf2d6" : "var(--accent-primary)" }}>
                        {req.asset_tag}
                      </div>
                      
                      <div style={{ fontSize: "12px", lineHeight: 1.3, wordBreak: "break-word" }}>
                        <span style={{ fontWeight: 600 }}>{req.asset_name}</span> {req.issue_description}
                      </div>

                      {/* Display status details */}
                      {req.status === "TechnicianAssigned" && (
                        <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
                          tech: {req.technician_name}
                        </div>
                      )}

                      {req.status === "InProgress" && (
                        <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
                          parts ordered (in progress)
                        </div>
                      )}

                      {isResolved && (
                        <div style={{ fontSize: "11px", color: "#caffbf", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
                          resolved {formattedDate}
                        </div>
                      )}

                      {/* Action buttons */}
                      {isManager && !isResolved && (
                        <div style={{ display: "flex", gap: "4px", marginTop: "6px", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: "8px" }}>
                          {req.status === "Pending" && (
                            <>
                              <button className="btn btn-secondary btn-sm" style={{ padding: "4px 8px", fontSize: "10.5px", flex: 1 }} onClick={() => handleApprove(req.id)}>
                                Approve
                              </button>
                              <button className="btn btn-danger btn-sm" style={{ padding: "4px" }} onClick={() => handleReject(req.id)}>
                                <X size={12} />
                              </button>
                            </>
                          )}
                          {req.status === "Approved" && (
                            <button className="btn btn-secondary btn-sm" style={{ padding: "4px 8px", fontSize: "10.5px", flex: 1 }} onClick={() => setAssigningReqId(req.id)}>
                              <UserCheck size={12} style={{ marginRight: "4px" }} /> Assign Tech
                            </button>
                          )}
                          {req.status === "TechnicianAssigned" && (
                            <button className="btn btn-secondary btn-sm" style={{ padding: "4px 8px", fontSize: "10.5px", flex: 1, backgroundColor: "#fffbeb" }} onClick={() => handleStartWork(req)}>
                              <Play size={12} style={{ marginRight: "4px" }} /> Start Work
                            </button>
                          )}
                          {req.status === "InProgress" && (
                            <button className="btn btn-primary btn-sm" style={{ padding: "4px 8px", fontSize: "10.5px", flex: 1, backgroundColor: "var(--success)" }} onClick={() => handleResolve(req.id)}>
                              <CheckCircle size={12} style={{ marginRight: "4px" }} /> Resolve
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer Message bottom footer matching Screen 7 */}
      <div style={{ padding: "12px 16px", backgroundColor: "#f5f2eb", border: "2px solid var(--border-color)", borderRadius: "var(--radius-sm)", fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "16px" }}>
        Approving a card moves the asset to under maintenance, resolving return it to available
      </div>

      {/* Raised Modal Popup */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: 700 }}>
                <Sparkles size={16} color="var(--accent-primary)" style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }} />
                File Maintenance incident
              </h3>
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
                  <label className="form-label">Asset to Service</label>
                  <select className="form-control" value={assetId} onChange={(e) => setAssetId(e.target.value ? Number(e.target.value) : "")} required>
                    <option value="">Select Asset...</option>
                    {assets
                      .filter((a) => !["Retired", "Disposed", "Lost"].includes(a.status))
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.asset_tag})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Incident Description</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Provide details about the issue or physical damages..."
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-control" value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  File Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Technician Assignment Modal */}
      {assigningReqId && (
        <div className="modal-overlay" onClick={() => setAssigningReqId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: 700 }}>Assign Repair Technician</h3>
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
                    placeholder="e.g. R verma, John Doe"
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
                  Assign Technician
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

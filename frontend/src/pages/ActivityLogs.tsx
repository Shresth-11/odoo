import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { History, Search, RefreshCw } from "lucide-react";

interface ActivityLog {
  id: number;
  employee_name: string | null;
  employee_email: string | null;
  action: string;
  entity_type: string;
  entity_id: number;
  timestamp: string;
}

export const ActivityLogs: React.FC = () => {
  const { apiFetch } = useAuth();
  const { showToast } = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/analytics/activity-logs");
      setLogs(data.logs);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    return (
      (log.employee_name && log.employee_name.toLowerCase().includes(term)) ||
      (log.employee_email && log.employee_email.toLowerCase().includes(term)) ||
      log.action.toLowerCase().includes(term) ||
      log.entity_type.toLowerCase().includes(term)
    );
  });

  return (
    <div className="card animate-fade">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: 1, maxWidth: "400px" }}>
          <Search size={18} style={{ position: "absolute", left: "14px", top: "14px", color: "var(--text-muted)" }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: "42px" }}
            placeholder="Search activity records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button className="btn btn-secondary btn-sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw size={12} style={{ marginRight: "4px" }} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>Loading logs...</div>
      ) : filteredLogs.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          No activity logs match your search.
        </div>
      ) : (
        <div className="table-container">
          <table className="table-el">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Operator</th>
                <th>Action details</th>
                <th>Entity Impacted</th>
                <th>Record ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{log.employee_name || "System"}</div>
                    {log.employee_email && (
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>
                        {log.employee_email}
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight: 500 }}>{log.action}</td>
                  <td>
                    <span className="badge badge-info">{log.entity_type}</span>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>#{log.entity_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

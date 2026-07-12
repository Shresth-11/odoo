import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Link } from "react-router-dom";
import {
  ShieldAlert,
  CalendarCheck,
  CheckCircle,
  FileSpreadsheet,
  PlusCircle,
  Clock,
  History,
  Activity,
  X,
  Sparkles,
} from "lucide-react";

interface KPIs {
  assetsAvailable: number;
  assetsAllocated: number;
  assetsUnderMaintenance: number;
  activeBookings: number;
  pendingTransfers: number;
  overdueAllocations: number;
  pendingMaintenance: number;
}

interface OverdueItem {
  id: number;
  asset_id: number;
  asset_name: string;
  asset_tag: string;
  employee_name: string | null;
  employee_email: string | null;
  expected_return_date: string;
}

interface ActivityLog {
  id: number;
  employee_name: string | null;
  action: string;
  entity_type: string;
  timestamp: string;
}

export const Dashboard: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const { showToast } = useToast();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [overdueItems, setOverdueItems] = useState<OverdueItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [animateKpis, setAnimateKpis] = useState({
    assetsAvailable: 0,
    assetsAllocated: 0,
    overdueAllocations: 0,
    activeBookings: 0,
    pendingMaintenance: 0,
    assetsUnderMaintenance: 0
  });

  useEffect(() => {
    if (!kpis) return;
    
    const duration = 400; // ms
    const startTime = performance.now();
    
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      setAnimateKpis({
        assetsAvailable: Math.round(progress * (kpis.assetsAvailable || 0)),
        assetsAllocated: Math.round(progress * (kpis.assetsAllocated || 0)),
        overdueAllocations: Math.round(progress * (kpis.overdueAllocations || 0)),
        activeBookings: Math.round(progress * (kpis.activeBookings || 0)),
        pendingMaintenance: Math.round(progress * (kpis.pendingMaintenance || 0)),
        assetsUnderMaintenance: Math.round(progress * (kpis.assetsUnderMaintenance || 0)),
      });
      
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    
    requestAnimationFrame(step);
  }, [kpis]);

  const fetchDashboardData = async () => {
    try {
      const data = await apiFetch("/analytics/dashboard");
      setKpis(data.kpis);
      setOverdueItems(data.overdueItems);
      setActivityLogs(data.recentActivity);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", fontSize: "16px", color: "var(--text-secondary)" }}>Loading metrics...</div>;
  }

  return (
    <div className="animate-fade">
      {/* Interactive Onboarding */}
      {showOnboarding && (
        <div
          className="card animate-fade"
          style={{
            marginBottom: "24px",
            background: "#FFFFFF",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-sm)",
            position: "relative",
            padding: "24px",
          }}
        >
          <button
            style={{
              position: "absolute",
              right: "16px",
              top: "16px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
            onClick={() => setShowOnboarding(false)}
          >
            <X size={18} />
          </button>
          
          <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ flex: 1, minWidth: "280px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                <Sparkles size={18} color="var(--accent-primary)" />
                Welcome to AssetFlow: Your Onboarding Checklist
              </h3>
              <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "6px", marginBottom: "16px", maxWidth: "600px", lineHeight: "1.4" }}>
                Follow these interactive steps to get familiar with our enterprise resources and checkout processes.
              </p>
              
              {/* Checklist steps */}
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {[
                  { title: "Explore Catalog", desc: "Browse items", done: true },
                  { title: "Book a Resource", desc: "Schedule a room", done: false },
                  { title: "Review Profile", desc: "Verify custody", done: false },
                ].map((step, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "10px 14px",
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-sm)",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flex: "1 1 170px",
                      minWidth: "160px",
                    }}
                  >
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        border: `2px solid ${step.done ? "var(--success)" : "var(--border-color)"}`,
                        backgroundColor: step.done ? "var(--success)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: "9px",
                        fontWeight: "bold"
                      }}
                    >
                      {step.done && "✓"}
                    </div>
                    <div>
                      <div style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-primary)" }}>{step.title}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Circular Progress Ring */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingRight: "10px", alignSelf: "center" }}>
              <div style={{ position: "relative", width: "64px", height: "64px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="64" height="64" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="var(--border-color)"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="var(--accent-primary)"
                    strokeWidth="3"
                    strokeDasharray="33, 100"
                    strokeLinecap="round"
                  />
                </svg>
                <div style={{ position: "absolute", fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>33%</div>
              </div>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-secondary)", marginTop: "6px" }}>1 of 3 complete</span>
            </div>
          </div>
        </div>
      )}

      {/* 1. KPI Panel */}
      <div className="grid-cols-3" style={{ gap: "20px" }}>
        <div className="card animate-fade" style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-color)", padding: "24px", backgroundColor: "#FFFFFF" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span className="card-title" style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)" }}>Assets Available</span>
            <CheckCircle color="var(--success)" size={18} />
          </div>
          <div className="kpi-value" style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{animateKpis.assetsAvailable}</div>
          <div className="kpi-desc" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Physical resources ready for allocation or booking</div>
        </div>

        <div className="card animate-fade" style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-color)", padding: "24px", backgroundColor: "#FFFFFF" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span className="card-title" style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)" }}>Allocated Assets</span>
            <FileSpreadsheet color="var(--info)" size={18} />
          </div>
          <div className="kpi-value" style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{animateKpis.assetsAllocated}</div>
          <div className="kpi-desc" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Assets currently held by employees or departments</div>
        </div>

        <div className="card animate-fade" style={{ 
          borderRadius: "var(--radius-md)", 
          boxShadow: "var(--shadow-sm)", 
          border: (kpis?.overdueAllocations || 0) > 0 ? "1px solid rgba(244, 63, 94, 0.25)" : "1px solid var(--border-color)", 
          padding: "24px", 
          backgroundColor: (kpis?.overdueAllocations || 0) > 0 ? "rgba(244, 63, 94, 0.01)" : "#FFFFFF" 
        }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span className="card-title" style={{ fontSize: "14px", fontWeight: 500, color: (kpis?.overdueAllocations || 0) > 0 ? "var(--danger)" : "var(--text-secondary)" }}>Overdue Items</span>
            <ShieldAlert color="var(--danger)" size={18} />
          </div>
          <div className="kpi-value" style={{ fontSize: "28px", fontWeight: 700, color: (kpis?.overdueAllocations || 0) > 0 ? "var(--danger)" : "var(--text-primary)" }}>{animateKpis.overdueAllocations}</div>
          <div className="kpi-desc" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Allocations past their expected return dates</div>
        </div>

        <div className="card animate-fade" style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-color)", padding: "24px", backgroundColor: "#FFFFFF" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span className="card-title" style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)" }}>Active Bookings</span>
            <CalendarCheck color="var(--accent-primary)" size={18} />
          </div>
          <div className="kpi-value" style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{animateKpis.activeBookings}</div>
          <div className="kpi-desc" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Upcoming and ongoing room or resource reservations</div>
        </div>

        <div className="card animate-fade" style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-color)", padding: "24px", backgroundColor: "#FFFFFF" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span className="card-title" style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)" }}>Pending Maintenance</span>
            <PlusCircle color="var(--warning)" size={18} />
          </div>
          <div className="kpi-value" style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{animateKpis.pendingMaintenance}</div>
          <div className="kpi-desc" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Assets queued for technicians or under repair</div>
        </div>

        <div className="card animate-fade" style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-color)", padding: "24px", backgroundColor: "#FFFFFF" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span className="card-title" style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)" }}>Under Maintenance</span>
            <Clock color="var(--text-muted)" size={18} />
          </div>
          <div className="kpi-value" style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{animateKpis.assetsUnderMaintenance}</div>
          <div className="kpi-desc" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Assets currently out-of-service for maintenance</div>
        </div>
      </div>

      {/* AI Copilot Insights Card */}
      <div
        className="card animate-fade"
        style={{
          marginBottom: "24px",
          background: "linear-gradient(90deg, rgba(91, 92, 235, 0.04) 0%, rgba(0, 194, 168, 0.04) 100%)",
          border: "1px solid rgba(91, 92, 235, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              backgroundColor: "rgba(91, 92, 235, 0.1)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-primary)",
            }}
          >
            <Activity size={20} />
          </div>
          <div>
            <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
              AI Copilot Insights
            </h4>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
              {kpis && kpis.overdueAllocations > 0
                ? `System flag: There are ${kpis.overdueAllocations} overdue checkout items in the ledger. Ask the AI: "Show overdue returns".`
                : "Ledger status: All allocations are within due dates. Projectors and conference rooms are available for reservation."}
            </p>
          </div>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const toggleBtn = document.querySelector(".ai-copilot-toggle-btn") as HTMLButtonElement;
            if (toggleBtn) toggleBtn.click();
          }}
        >
          Ask AI Copilot
        </button>
      </div>

      {/* 2. Quick Actions Panel */}
      <div className="card animate-fade" style={{ marginBottom: "32px", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-color)", padding: "24px", backgroundColor: "#FFFFFF" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "16px", color: "var(--text-primary)" }}>Quick Administration Actions</h3>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {user?.role === "AssetManager" && (
            <Link to="/assets" className="btn btn-primary">
              <PlusCircle size={16} /> Register Physical Asset
            </Link>
          )}
          {user?.role === "AssetManager" && (
            <Link to="/allocations" className="btn btn-secondary">
              Allocate New Asset
            </Link>
          )}
          <Link to="/bookings" className="btn btn-secondary">
            Book Meeting Room / Resource
          </Link>
          <Link to="/maintenance" className="btn btn-secondary">
            Raise Maintenance Request
          </Link>
          {user?.role === "Admin" && (
            <Link to="/org-setup" className="btn btn-secondary">
              Promote Employee Roles
            </Link>
          )}
        </div>
      </div>

      {/* 3. Bottom Grid: Overdue list & Activity log */}
      <div className="grid-cols-2">
        {/* Overdue Items list */}
        <div className="card animate-fade" style={{ 
          display: "flex", 
          flexDirection: "column",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-sm)",
          backgroundColor: overdueItems.length > 0 ? "rgba(244, 63, 94, 0.015)" : "#FFFFFF",
          border: overdueItems.length > 0 ? "1px solid rgba(244, 63, 94, 0.2)" : "1px solid var(--border-color)",
          padding: "24px"
        }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", color: overdueItems.length > 0 ? "var(--danger)" : "var(--text-primary)" }}>
            <ShieldAlert size={18} color={overdueItems.length > 0 ? "var(--danger)" : "var(--text-secondary)"} />
            Overdue Returns Ledger
          </h3>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {overdueItems.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                Excellent! There are no overdue allocations in the system.
              </div>
            ) : (
              <div className="table-container" style={{ border: "none" }}>
                <table className="table-el">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Custodian</th>
                      <th>Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.asset_name}</div>
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{item.asset_tag}</span>
                        </td>
                        <td>
                          <div>{item.employee_name || "Department"}</div>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.employee_email || ""}</span>
                        </td>
                        <td style={{ color: "var(--danger)", fontWeight: 600 }}>
                          {new Date(item.expected_return_date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* System Activity Feed */}
        <div className="card animate-fade" style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-color)", padding: "24px", backgroundColor: "#FFFFFF" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)" }}>
            <Activity size={18} color="var(--accent-primary)" />
            System Audit Trail Feed
          </h3>
          <div>
            {activityLogs.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                No recent system logs.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {activityLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      paddingBottom: "12px",
                      borderBottom: "1px solid var(--border-color)",
                    }}
                  >
                    <div
                      style={{
                        padding: "6px",
                        borderRadius: "50%",
                        backgroundColor: "rgba(255, 255, 255, 0.04)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <History size={14} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px" }}>
                        <span style={{ fontWeight: 600 }}>{log.employee_name || "System"}</span> {log.action}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {new Date(log.timestamp).toLocaleString()} • Scope: {log.entity_type}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

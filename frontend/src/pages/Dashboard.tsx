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
  availableResources: number;
  upcomingReturns: number;
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

  // Quick Action Modals State
  const [showRegModal, setShowRegModal] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Preloaded data for modals
  const [categories, setCategories] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);

  // Reg form states
  const [regName, setRegName] = useState("");
  const [regCatId, setRegCatId] = useState<number | "">("");
  const [regSerial, setRegSerial] = useState("");
  const [regAcqDate, setRegAcqDate] = useState(new Date().toISOString().split("T")[0]);
  const [regAcqCost, setRegAcqCost] = useState<number | "">("");
  const [regCondition, setRegCondition] = useState<any>("New");
  const [regLocation, setRegLocation] = useState("");
  const [regIsBookable, setRegIsBookable] = useState(false);

  // Booking form states
  const [bookAssetId, setBookAssetId] = useState<number | "">("");
  const [bookStartDate, setBookStartDate] = useState("");
  const [bookStartTime, setBookStartTime] = useState("");
  const [bookEndDate, setBookEndDate] = useState("");
  const [bookEndTime, setBookEndTime] = useState("");
  const [bookError, setBookError] = useState<string | null>(null);

  // Request form states
  const [reqAssetId, setReqAssetId] = useState<number | "">("");
  const [reqIssue, setReqIssue] = useState("");
  const [reqPriority, setReqPriority] = useState<any>("Medium");

  const [animateKpis, setAnimateKpis] = useState({
    assetsAvailable: 0,
    assetsAllocated: 0,
    overdueAllocations: 0,
    activeBookings: 0,
    pendingMaintenance: 0,
    assetsUnderMaintenance: 0,
    availableResources: 0,
    upcomingReturns: 0,
    pendingTransfers: 0
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
        availableResources: Math.round(progress * (kpis.availableResources || 0)),
        upcomingReturns: Math.round(progress * (kpis.upcomingReturns || 0)),
        pendingTransfers: Math.round(progress * (kpis.pendingTransfers || 0)),
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

      // Preload categories and assets for modals
      const catsData = await apiFetch("/org/categories");
      setCategories(catsData.categories || []);
      const assetsData = await apiFetch("/assets");
      setAssets(assetsData.assets || []);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: regName,
        category_id: Number(regCatId),
        serial_number: regSerial || null,
        acquisition_date: regAcqDate,
        acquisition_cost: Number(regAcqCost),
        condition: regCondition,
        location: regLocation,
        is_bookable: regIsBookable,
      };

      await apiFetch("/assets", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showToast("success", "Asset registered successfully!");
      setShowRegModal(false);
      resetRegForm();
      fetchDashboardData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const resetRegForm = () => {
    setRegName("");
    setRegCatId("");
    setRegSerial("");
    setRegAcqDate(new Date().toISOString().split("T")[0]);
    setRegAcqCost("");
    setRegCondition("New");
    setRegLocation("");
    setRegIsBookable(false);
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookError(null);
    if (!bookAssetId || !bookStartDate || !bookStartTime || !bookEndDate || !bookEndTime) {
      showToast("error", "All fields are required");
      return;
    }

    const startISO = new Date(`${bookStartDate}T${bookStartTime}`).toISOString();
    const endISO = new Date(`${bookEndDate}T${bookEndTime}`).toISOString();

    try {
      await apiFetch("/bookings", {
        method: "POST",
        body: JSON.stringify({
          asset_id: Number(bookAssetId),
          start_time: startISO,
          end_time: endISO,
        }),
      });

      showToast("success", "Resource booked successfully!");
      setShowBookModal(false);
      setBookAssetId("");
      setBookStartDate("");
      setBookStartTime("");
      setBookEndDate("");
      setBookEndTime("");
      fetchDashboardData();
    } catch (err: any) {
      setBookError(err.message || "Overlap conflict or database lock error occurred.");
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqAssetId || !reqIssue) {
      showToast("error", "Asset and Issue Description are required");
      return;
    }

    try {
      await apiFetch("/maintenance", {
        method: "POST",
        body: JSON.stringify({
          asset_id: Number(reqAssetId),
          issue_description: reqIssue,
          priority: reqPriority,
        }),
      });

      showToast("success", "Maintenance request raised successfully!");
      setShowRequestModal(false);
      setReqAssetId("");
      setReqIssue("");
      setReqPriority("Medium");
      fetchDashboardData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

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

      {/* Today's Overview Grid */}
      <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px", color: "var(--text-primary)" }}>Today's Overview</h3>
      <div className="grid-cols-3" style={{ gap: "20px", marginBottom: "20px" }}>
        {/* Row 1 */}
        <div className="card animate-fade" style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-color)", padding: "24px", backgroundColor: "#FFFFFF" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span className="card-title" style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)" }}>Available</span>
            <CheckCircle color="var(--success)" size={18} />
          </div>
          <div className="kpi-value" style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{animateKpis.assetsAvailable}</div>
          <div className="kpi-desc" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Physical resources ready for allocation</div>
        </div>

        <div className="card animate-fade" style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-color)", padding: "24px", backgroundColor: "#FFFFFF" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span className="card-title" style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)" }}>Allocated</span>
            <FileSpreadsheet color="var(--info)" size={18} />
          </div>
          <div className="kpi-value" style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{animateKpis.assetsAllocated}</div>
          <div className="kpi-desc" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Assets currently held by custodians</div>
        </div>

        <div className="card animate-fade" style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-color)", padding: "24px", backgroundColor: "#FFFFFF" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span className="card-title" style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)" }}>Available</span>
            <PlusCircle color="var(--accent-primary)" size={18} />
          </div>
          <div className="kpi-value" style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{animateKpis.availableResources}</div>
          <div className="kpi-desc" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Bookable slots / shared resources ready</div>
        </div>

        {/* Row 2 */}
        <div className="card animate-fade" style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-color)", padding: "24px", backgroundColor: "#FFFFFF" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span className="card-title" style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)" }}>Active Bookings</span>
            <CalendarCheck color="var(--accent-primary)" size={18} />
          </div>
          <div className="kpi-value" style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{animateKpis.activeBookings}</div>
          <div className="kpi-desc" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Shared items currently reserved</div>
        </div>

        <div className="card animate-fade" style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-color)", padding: "24px", backgroundColor: "#FFFFFF" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span className="card-title" style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)" }}>Pending Transfers</span>
            <PlusCircle color="var(--warning)" size={18} />
          </div>
          <div className="kpi-value" style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{animateKpis.pendingTransfers}</div>
          <div className="kpi-desc" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Transfer requests awaiting approval</div>
        </div>

        <div className="card animate-fade" style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-color)", padding: "24px", backgroundColor: "#FFFFFF" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span className="card-title" style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)" }}>Upcoming returns</span>
            <Clock color="var(--text-muted)" size={18} />
          </div>
          <div className="kpi-value" style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{animateKpis.upcomingReturns}</div>
          <div className="kpi-desc" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Allocations due for return shortly</div>
        </div>
      </div>

      {/* Overdue alert notice */}
      {kpis && kpis.overdueAllocations > 0 && (
        <div
          className="animate-fade"
          style={{
            backgroundColor: "#FDF2F2",
            border: "1px solid #FDE8E8",
            color: "#9B1C1C",
            borderRadius: "var(--radius-md)",
            padding: "14px 18px",
            fontSize: "14px",
            fontWeight: 600,
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <ShieldAlert size={16} color="#9B1C1C" />
          <span>{kpis.overdueAllocations} assets overdue for return - flagged for follow-up</span>
        </div>
      )}

      {/* Dynamic Action Buttons directly on Dashboard */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "28px", flexWrap: "wrap" }}>
        {(user?.role === "Admin" || user?.role === "AssetManager") && (
          <button className="btn btn-primary" onClick={() => setShowRegModal(true)}>
            + register asset
          </button>
        )}
        <button
          className="btn"
          style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", fontWeight: 600 }}
          onClick={() => setShowBookModal(true)}
        >
          Book resource
        </button>
        <button
          className="btn"
          style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", fontWeight: 600 }}
          onClick={() => setShowRequestModal(true)}
        >
          Raise requests
        </button>
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

      {/* REGISTER ASSET MODAL */}
      {showRegModal && (
        <div className="modal-overlay" onClick={() => setShowRegModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: 700 }}>Register Physical Asset</h3>
              <button
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px" }}
                onClick={() => setShowRegModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleRegisterSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Asset Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. MacBook Pro 16-inch, Height-Adjustable Desk"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Asset Category</label>
                    <select
                      className="form-control"
                      value={regCatId}
                      onChange={(e) => setRegCatId(e.target.value ? Number(e.target.value) : "")}
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Serial Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. C02F5XX1MD6M"
                      value={regSerial}
                      onChange={(e) => setRegSerial(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Acquisition Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={regAcqDate}
                      onChange={(e) => setRegAcqDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Acquisition Cost (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="e.g. 2499.00"
                      value={regAcqCost}
                      onChange={(e) => setRegAcqCost(e.target.value ? Number(e.target.value) : "")}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Physical Condition</label>
                    <select className="form-control" value={regCondition} onChange={(e) => setRegCondition(e.target.value as any)}>
                      <option value="New">New</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                      <option value="Damaged">Damaged</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. London Office, Room B2"
                      value={regLocation}
                      onChange={(e) => setRegLocation(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
                  <input
                    type="checkbox"
                    id="regIsBookable"
                    checked={regIsBookable}
                    onChange={(e) => setRegIsBookable(e.target.checked)}
                  />
                  <label htmlFor="regIsBookable" className="form-label" style={{ margin: 0, cursor: "pointer", fontSize: "12.5px" }}>
                    Designate as Bookable Resource (for Scheduler/Reservations)
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRegModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Register Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOOK RESOURCE MODAL */}
      {showBookModal && (
        <div className="modal-overlay" onClick={() => setShowBookModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: 700 }}>Book Resource</h3>
              <button
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px" }}
                onClick={() => setShowBookModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleBookingSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Resource</label>
                  <select
                    className="form-control"
                    value={bookAssetId}
                    onChange={(e) => setBookAssetId(e.target.value ? Number(e.target.value) : "")}
                    required
                  >
                    <option value="">Select Resource</option>
                    {assets
                      .filter((a) => a.is_bookable && !["Retired", "Disposed", "Lost", "UnderMaintenance"].includes(a.status))
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.asset_tag}) - {a.location}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={bookStartDate}
                      onChange={(e) => setBookStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input
                      type="time"
                      className="form-control"
                      value={bookStartTime}
                      onChange={(e) => setBookStartTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={bookEndDate}
                      onChange={(e) => setBookEndDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time</label>
                    <input
                      type="time"
                      className="form-control"
                      value={bookEndTime}
                      onChange={(e) => setBookEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {bookError && (
                  <div style={{ color: "var(--danger)", fontSize: "13px", marginTop: "10px", padding: "10px", backgroundColor: "#FDF2F2", border: "1px solid #FDE8E8", borderRadius: "var(--radius-sm)" }}>
                    {bookError}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBookModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Book Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RAISE MAINTENANCE REQUEST MODAL */}
      {showRequestModal && (
        <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: 700 }}>Raise Maintenance Request</h3>
              <button
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px" }}
                onClick={() => setShowRequestModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleRequestSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Asset</label>
                  <select
                    className="form-control"
                    value={reqAssetId}
                    onChange={(e) => setReqAssetId(e.target.value ? Number(e.target.value) : "")}
                    required
                  >
                    <option value="">Select Asset</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.asset_tag}) - {a.location}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Issue Description</label>
                  <textarea
                    className="form-control"
                    placeholder="Describe the problem in detail (minimum 5 characters)..."
                    value={reqIssue}
                    onChange={(e) => setReqIssue(e.target.value)}
                    rows={4}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-control"
                    value={reqPriority}
                    onChange={(e) => setReqPriority(e.target.value as any)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRequestModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Raise Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

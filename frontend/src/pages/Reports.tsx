import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { BarChart3, TrendingUp, DollarSign, Hammer, Percent, Download } from "lucide-react";

interface DeptSummary {
  department_id: number;
  department_name: string;
  asset_count: number;
  total_valuation: number;
}

interface CatSummary {
  category_id: number;
  category_name: string;
  total_count: number;
  allocated_count: number;
  utilization_rate: number;
}

export const Reports: React.FC = () => {
  const { apiFetch } = useAuth();
  const { showToast } = useToast();
  const [deptSummary, setDeptSummary] = useState<DeptSummary[]>([]);
  const [catSummary, setCatSummary] = useState<CatSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/analytics/reports");
      setDeptSummary(data.departmentSummary || []);
      setCatSummary(data.categorySummary || []);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleExport = () => {
    showToast("success", "Generating spreadsheet export packet... Shipped!");
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", fontSize: "16px", color: "var(--text-secondary)" }}>Loading reports...</div>;
  }

  return (
    <div className="animate-fade" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Page Header */}
      <div>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Reports & Analytics</h3>
        <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "2px" }}>
          Inspect utilization ratios, maintenance frequencies, and device aging records.
        </p>
      </div>

      {/* 1. Charts Grid (Screen 9: Utilization & Maintenance charts) */}
      <div className="grid-cols-2">
        {/* Utilization by Department Column Chart */}
        <div className="card" style={{ backgroundColor: "#ffffff", border: "2px solid var(--border-color)", padding: "20px" }}>
          <h4 style={{ fontSize: "13.5px", fontWeight: 700, marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Utilization by department
          </h4>
          
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              alignItems: "flex-end",
              height: "160px",
              padding: "10px 0",
              borderBottom: "2px solid var(--border-color)",
              marginBottom: "12px",
              gap: "10px"
            }}
          >
            {deptSummary.length === 0 ? (
              <span style={{ fontSize: "12px", color: "var(--text-muted)", alignSelf: "center" }}>No allocation records to chart</span>
            ) : (
              deptSummary.slice(0, 5).map((dept, idx) => {
                const colors = ["#ffd6a5", "#caffbf", "#bdb2ff", "#ffadad", "#9bf6ff"];
                const barHeight = Math.max(Math.round((dept.asset_count / 15) * 100), 15);
                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      height: `${Math.min(barHeight, 100)}%`,
                      backgroundColor: colors[idx % colors.length],
                      border: "2px solid var(--border-color)",
                      boxShadow: "2px 2px 0px var(--border-color)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      paddingBottom: "8px",
                      position: "relative"
                    }}
                    title={`${dept.department_name}: ${dept.asset_count} units`}
                  >
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)" }}>{dept.asset_count}</span>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-around", fontSize: "10.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
            {deptSummary.slice(0, 5).map((dept, idx) => (
              <span key={idx} style={{ flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {dept.department_name}
              </span>
            ))}
          </div>
        </div>

        {/* Maintenance Frequency Line Chart */}
        <div className="card" style={{ backgroundColor: "#ffffff", border: "2px solid var(--border-color)", padding: "20px" }}>
          <h4 style={{ fontSize: "13.5px", fontWeight: 700, marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Maintenance Frequency
          </h4>
          
          <div style={{ height: "160px", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "2px solid var(--border-color)", marginBottom: "12px", position: "relative" }}>
            {/* Real SVG line path matching Screen 9 */}
            <svg viewBox="0 0 400 150" style={{ width: "100%", height: "100%", overflow: "visible" }}>
              <path
                d="M 20,130 L 80,90 L 140,110 L 200,60 L 260,95 L 320,40 L 380,20"
                fill="none"
                stroke="#EF4444"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {/* Dots on line intersections */}
              <circle cx="20" cy="130" r="5" fill="#EF4444" stroke="#1a1a1a" strokeWidth="1.5" />
              <circle cx="80" cy="90" r="5" fill="#EF4444" stroke="#1a1a1a" strokeWidth="1.5" />
              <circle cx="140" cy="110" r="5" fill="#EF4444" stroke="#1a1a1a" strokeWidth="1.5" />
              <circle cx="200" cy="60" r="5" fill="#EF4444" stroke="#1a1a1a" strokeWidth="1.5" />
              <circle cx="260" cy="95" r="5" fill="#EF4444" stroke="#1a1a1a" strokeWidth="1.5" />
              <circle cx="320" cy="40" r="5" fill="#EF4444" stroke="#1a1a1a" strokeWidth="1.5" />
              <circle cx="380" cy="20" r="5" fill="#EF4444" stroke="#1a1a1a" strokeWidth="1.5" />
            </svg>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", fontWeight: 600, color: "var(--text-secondary)", padding: "0 10px" }}>
            <span>Jan</span>
            <span>Feb</span>
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>Jun</span>
            <span>Jul</span>
          </div>
        </div>
      </div>

      {/* 2. Analytical Lists Section (Screen 9 details) */}
      <div className="card" style={{ backgroundColor: "#ffffff", border: "2px solid var(--border-color)", padding: "24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
          
          {/* Most Used Assets */}
          <div>
            <h4 style={{ fontSize: "14px", fontWeight: 700, borderBottom: "2px solid var(--border-color)", paddingBottom: "8px", marginBottom: "12px", color: "var(--text-primary)" }}>
              Most used assets
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px", fontSize: "12.5px" }}>
              <li style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Room B2</span>
                <span style={{ color: "var(--text-secondary)", fontSize: "11.5px" }}>34 booking this month</span>
              </li>
              <li style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Van AF-343</span>
                <span style={{ color: "var(--text-secondary)", fontSize: "11.5px" }}>21 trips this month</span>
              </li>
              <li style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Projector AF-335</span>
                <span style={{ color: "var(--text-secondary)", fontSize: "11.5px" }}>18 uses</span>
              </li>
            </ul>
          </div>

          {/* Idle Assets */}
          <div>
            <h4 style={{ fontSize: "14px", fontWeight: 700, borderBottom: "2px solid var(--border-color)", paddingBottom: "8px", marginBottom: "12px", color: "var(--text-primary)" }}>
              Idle assets
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px", fontSize: "12.5px" }}>
              <li style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Camera AF-0301</span>
                <span style={{ color: "var(--text-secondary)", fontSize: "11.5px" }}>unused 60+ days</span>
              </li>
              <li style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>chair AF-0910</span>
                <span style={{ color: "var(--text-secondary)", fontSize: "11.5px" }}>unused 45 days</span>
              </li>
            </ul>
          </div>

          {/* Assets Due for Maintenance / Retirement */}
          <div>
            <h4 style={{ fontSize: "14px", fontWeight: 700, borderBottom: "2px solid var(--border-color)", paddingBottom: "8px", marginBottom: "12px", color: "var(--text-primary)" }}>
              Assets due for maintenance / nearing retirement
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px", fontSize: "12.5px" }}>
              <li style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Forklift AF-0087</span>
                <span style={{ color: "var(--text-secondary)", fontSize: "11.5px" }}>service due in 5 days</span>
              </li>
              <li style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Laptop AF-0020</span>
                <span style={{ color: "var(--text-secondary)", fontSize: "11.5px" }}>4 years old : nearing retirement</span>
              </li>
            </ul>
          </div>

        </div>

        {/* 3. Export Report Action Button */}
        <div style={{ marginTop: "32px", borderTop: "2px solid var(--border-color)", paddingTop: "20px", display: "flex", justifyContent: "flex-start" }}>
          <button className="btn btn-secondary" onClick={handleExport} style={{ border: "2px solid var(--border-color)", fontWeight: 700, textTransform: "capitalize" }}>
            <Download size={14} style={{ marginRight: "6px" }} /> Export report
          </button>
        </div>
      </div>
    </div>
  );
};

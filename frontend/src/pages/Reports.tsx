import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { BarChart3, TrendingUp, DollarSign, Hammer, Percent } from "lucide-react";

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

interface MaintSummary {
  category_name: string;
  request_count: number;
}

interface AcqTrend {
  month: string;
  count: number;
  total_cost: number;
}

export const Reports: React.FC = () => {
  const { apiFetch } = useAuth();
  const { showToast } = useToast();
  const [deptSummary, setDeptSummary] = useState<DeptSummary[]>([]);
  const [catSummary, setCatSummary] = useState<CatSummary[]>([]);
  const [maintSummary, setMaintSummary] = useState<MaintSummary[]>([]);
  const [acqTrends, setAcqTrends] = useState<AcqTrend[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/analytics/reports");
      setDeptSummary(data.departmentSummary);
      setCatSummary(data.categorySummary);
      setMaintSummary(data.maintenanceSummary);
      setAcqTrends(data.acquisitionTrends);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", fontSize: "16px", color: "var(--text-secondary)" }}>Loading reports...</div>;
  }

  // Find max valuation and counts to scale bars
  const maxValuation = Math.max(...deptSummary.map((d) => Number(d.total_valuation || 0)), 1);
  const maxMaintRequests = Math.max(...maintSummary.map((m) => Number(m.request_count || 0)), 1);
  const maxAcqCost = Math.max(...acqTrends.map((t) => Number(t.total_cost || 0)), 1);

  return (
    <div className="animate-fade">
      {/* 1. Top Section - Custom Bar Charts Grid */}
      <div className="grid-cols-2">
        {/* Dept Valuation Bar Chart */}
        <div className="card">
          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <DollarSign size={18} color="var(--success)" />
            Departmental Asset Valuation Breakdown (USD)
          </h3>
          {deptSummary.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>No assets allocated to departments yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {deptSummary.map((dept) => {
                const percent = Math.max(Math.round((Number(dept.total_valuation) / maxValuation) * 100), 5);
                return (
                  <div key={dept.department_id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 600 }}>{dept.department_name}</span>
                      <span>
                        ${Number(dept.total_valuation).toLocaleString()} ({dept.asset_count} units)
                      </span>
                    </div>
                    <div style={{ width: "100%", height: "12px", backgroundColor: "var(--bg-primary)", borderRadius: "6px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${percent}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, var(--accent-primary) 0%, var(--success) 100%)",
                          borderRadius: "6px",
                          transition: "width 0.8s ease-out",
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Maintenance Frequency by Category */}
        <div className="card">
          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Hammer size={18} color="var(--danger)" />
            Repair & Maintenance Incidence Rates by Category
          </h3>
          {maintSummary.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>No repairs logged yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {maintSummary.map((maint, idx) => {
                const percent = Math.max(Math.round((Number(maint.request_count) / maxMaintRequests) * 100), 5);
                return (
                  <div key={idx}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 600 }}>{maint.category_name}</span>
                      <span>{maint.request_count} service requests</span>
                    </div>
                    <div style={{ width: "100%", height: "12px", backgroundColor: "var(--bg-primary)", borderRadius: "6px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${percent}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, var(--warning) 0%, var(--danger) 100%)",
                          borderRadius: "6px",
                          transition: "width 0.8s ease-out",
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Bottom Section - Heatmaps and Trends */}
      <div className="grid-cols-2">
        {/* Category Utilization Grid */}
        <div className="card">
          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Percent size={18} color="var(--accent-primary)" />
            Asset Utilization Index & Density
          </h3>
          <div className="table-container" style={{ border: "none" }}>
            <table className="table-el">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Total Units</th>
                  <th>In Custody</th>
                  <th>Utilization Rate</th>
                </tr>
              </thead>
              <tbody>
                {catSummary.map((cat) => (
                  <tr key={cat.category_id}>
                    <td style={{ fontWeight: 600 }}>{cat.category_name}</td>
                    <td>{cat.total_count}</td>
                    <td>{cat.allocated_count}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "80px", height: "6px", backgroundColor: "var(--bg-primary)", borderRadius: "3px", overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${cat.utilization_rate}%`,
                              height: "100%",
                              backgroundColor:
                                cat.utilization_rate > 70
                                  ? "var(--success)"
                                  : cat.utilization_rate > 35
                                  ? "var(--info)"
                                  : "var(--text-muted)",
                              borderRadius: "3px",
                            }}
                          ></div>
                        </div>
                        <span style={{ fontWeight: 600, fontSize: "13px" }}>{cat.utilization_rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Acquisition Trends */}
        <div className="card">
          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <TrendingUp size={18} color="var(--accent-primary)" />
            Capital Expenditure & Acquisition Trends (6 Months)
          </h3>
          {acqTrends.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>No purchases logged recently.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {acqTrends.map((trend, idx) => {
                const percent = Math.max(Math.round((Number(trend.total_cost) / maxAcqCost) * 100), 5);
                return (
                  <div key={idx}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 600 }}>{trend.month}</span>
                      <span>
                        ${Number(trend.total_cost).toLocaleString()} ({trend.count} units)
                      </span>
                    </div>
                    <div style={{ width: "100%", height: "12px", backgroundColor: "var(--bg-primary)", borderRadius: "6px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${percent}%`,
                          height: "100%",
                          background: "var(--accent-gradient)",
                          borderRadius: "6px",
                          transition: "width 0.8s ease-out",
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

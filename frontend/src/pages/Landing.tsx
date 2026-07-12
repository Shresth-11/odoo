import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Shield, Sparkles, Zap, Box, Compass, BarChart, ArrowRight } from "lucide-react";

export const Landing: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLaunch = () => {
    if (isAuthenticated) {
      navigate("/");
    } else {
      navigate("/login");
    }
  };

  return (
    <div style={{ backgroundColor: "var(--bg-primary)", minHeight: "100vh" }}>
      {/* 1. Navbar */}
      <nav className="landing-navbar">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="logo-icon">AF</div>
          <span className="logo-text" style={{ color: "var(--text-primary)" }}>AssetFlow</span>
        </div>
        <button onClick={handleLaunch} className="btn btn-primary btn-sm">
          {isAuthenticated ? "Go to Dashboard" : "Launch ERP Platform"}
        </button>
      </nav>

      {/* 2. Hero Section */}
      <header className="landing-hero animate-fade">
        <div className="landing-badge">
          <Sparkles size={12} style={{ marginRight: "6px" }} />
          Introducing AI-Powered Enterprise Resource Operations
        </div>
        <h1 className="landing-h1">
          Modern operations.<br />
          Built for speed.
        </h1>
        <p className="landing-sub">
          AssetFlow is the command center for your physical assets, shared resources, and employee logistics. Real-time custody checkouts, AI-backed auditing, and robust conflict prevention.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "14px" }}>
          <button onClick={handleLaunch} className="btn btn-primary">
            Get Started Free <ArrowRight size={16} />
          </button>
          <a href="#features" className="btn btn-secondary">
            Explore Features
          </a>
        </div>

        {/* 3. Product Preview Mockup */}
        <div className="landing-preview-wrapper">
          <div
            style={{
              padding: "16px 20px",
              backgroundColor: "#1E293B",
              borderTopLeftRadius: "var(--radius-md)",
              borderTopRightRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ width: "10px", height: "10px", backgroundColor: "#EF4444", borderRadius: "50%" }}></span>
            <span style={{ width: "10px", height: "10px", backgroundColor: "#F59E0B", borderRadius: "50%" }}></span>
            <span style={{ width: "10px", height: "10px", backgroundColor: "#22C55E", borderRadius: "50%" }}></span>
            <span style={{ marginLeft: "12px", fontSize: "11px", color: "#64748B", fontFamily: "monospace" }}>assetflow.app/dashboard</span>
          </div>
          {/* Simple premium mock representation */}
          <div style={{ backgroundColor: "#0F172A", padding: "40px 30px", textAlign: "left", color: "#E2E8F0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <span style={{ fontSize: "11px", color: "var(--accent-secondary)", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>Dashboard Preview</span>
                <h3 style={{ fontSize: "22px", fontWeight: 700, color: "white", marginTop: "4px" }}>Asset Logistics Ledger</h3>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <span className="badge badge-success">Available: 84 units</span>
                <span className="badge badge-info">Issued: 14 units</span>
              </div>
            </div>
            {/* Visual rows representing assets */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { tag: "AF-0012", name: "Dell UltraSharp Monitor 27\"", loc: "Room 402", status: "Available" },
                { tag: "AF-0104", name: "Apple MacBook Pro 16\"", loc: "Engineering Dept", status: "Allocated" },
                { tag: "AF-0142", name: "Conference Room Projector", loc: "Warehouse B", status: "Available" },
              ].map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255,255,255,0.03)", padding: "14px 20px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <span style={{ color: "#5B5CEB", fontWeight: 600, fontSize: "13px" }}>{item.tag}</span>
                    <span style={{ fontWeight: 500, fontSize: "14px" }}>{item.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", color: "#64748B" }}>{item.loc}</span>
                    <span className={`badge ${item.status === "Available" ? "badge-success" : "badge-info"}`}>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* 4. Features Section */}
      <section id="features" className="landing-section" style={{ borderTop: "1px solid var(--border-color)" }}>
        <div style={{ textAlign: "center", marginBottom: "60px" }}>
          <div className="section-label">Features</div>
          <h2 className="section-title">Built to replace spreadsheets.</h2>
        </div>

        <div className="grid-cols-3">
          <div className="card">
            <Zap size={28} color="var(--accent-primary)" style={{ marginBottom: "16px" }} />
            <h4 style={{ fontWeight: 700, fontSize: "16px", marginBottom: "8px" }}>Conflict Blocking</h4>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)" }}>
              Relational double-booking locks prevent overlapping reservations or multiple active allocations on identical equipment.
            </p>
          </div>

          <div className="card">
            <Compass size={28} color="var(--accent-secondary)" style={{ marginBottom: "16px" }} />
            <h4 style={{ fontWeight: 700, fontSize: "16px", marginBottom: "8px" }}>AI Copilot</h4>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)" }}>
              Query custodian logs, identify overdue returns, and locate available conference projectors using natural, conversational prompts.
            </p>
          </div>

          <div className="card">
            <Shield size={28} color="var(--success)" style={{ marginBottom: "16px" }} />
            <h4 style={{ fontWeight: 700, fontSize: "16px", marginBottom: "8px" }}>Audit Trail Feed</h4>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)" }}>
              Track logins, promotions, custody transfers, and repair approvals with a fully serialized, system-wide historical activity log.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Pricing Section */}
      <section className="landing-section" style={{ borderTop: "1px solid var(--border-color)" }}>
        <div style={{ textAlign: "center", marginBottom: "60px" }}>
          <div className="section-label">Pricing</div>
          <h2 className="section-title">Simple plans for teams of all sizes.</h2>
        </div>

        <div className="landing-pricing-grid">
          <div className="pricing-card">
            <h4 style={{ fontWeight: 700, fontSize: "18px" }}>Starter Plan</h4>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginTop: "4px" }}>For small offices and startups</p>
            <div className="pricing-price">$0 <span>/ forever</span></div>
            <ul style={{ listStyle: "none", fontSize: "13.5px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "10px", marginBlock: "24px" }}>
              <li>✓ Manage up to 50 active assets</li>
              <li>✓ Standard resource booking</li>
              <li>✓ Basic dashboard & statistics</li>
              <li>✓ Employee directory list</li>
            </ul>
            <button onClick={handleLaunch} className="btn btn-secondary btn-full">Get Started Free</button>
          </div>

          <div className="pricing-card popular">
            <h4 style={{ fontWeight: 700, fontSize: "18px" }}>Enterprise ERP</h4>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginTop: "4px" }}>For schools, factories, and corporate offices</p>
            <div className="pricing-price">$79 <span>/ month billed annually</span></div>
            <ul style={{ listStyle: "none", fontSize: "13.5px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "10px", marginBlock: "24px" }}>
              <li>✓ **Unlimited** physical assets catalog</li>
              <li>✓ Real-time AI Copilot panel</li>
              <li>✓ Multi-level department hierarchies</li>
              <li>✓ Dynamic inventory audit cycle scheduler</li>
              <li>✓ Priority ticket-based maintenance pipeline</li>
            </ul>
            <button onClick={handleLaunch} className="btn btn-primary btn-full">Launch Enterprise Free Trial</button>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer style={{ borderTop: "1px solid var(--border-color)", padding: "40px 80px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", fontSize: "13px", color: "var(--text-muted)" }}>
        <div>© 2026 AssetFlow Technologies Inc. All rights reserved.</div>
        <div style={{ display: "flex", gap: "20px" }}>
          <a href="#" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Security</a>
          <a href="#" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Terms of Service</a>
          <a href="#" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Privacy</a>
        </div>
      </footer>
    </div>
  );
};

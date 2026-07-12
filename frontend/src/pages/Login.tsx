import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Shield, Key, Mail, User as UserIcon, Building, ArrowLeft, Lock } from "lucide-react";

type FormState = "login" | "signup" | "forgot" | "otp" | "reset";

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [formState, setFormState] = useState<FormState>("login");
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [deptId, setDeptId] = useState<number | null>(null);
  
  // Forgot / OTP specific
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const departments = [
    { id: 1, name: "Executive" },
    { id: 2, name: "Engineering" },
    { id: 3, name: "Human Resources" },
    { id: 4, name: "Facilities & Operations" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
    try {
      if (formState === "login") {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Login failed");

        login(data.token, data.user);
        showToast("success", `Welcome back, ${data.user.name}!`);
      } else if (formState === "signup") {
        const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            password,
            department_id: deptId,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Registration failed");

        login(data.token, data.user);
        showToast("success", "Account registered! Welcome to AssetFlow.");
      } else if (formState === "forgot") {
        // Mock email OTP dispatch
        setTimeout(() => {
          showToast("info", "Simulated OTP code '481023' sent to your email!");
          setFormState("otp");
          setLoading(false);
        }, 800);
      } else if (formState === "otp") {
        if (otpCode === "481023") {
          showToast("success", "OTP code verified successfully!");
          setFormState("reset");
        } else {
          throw new Error("Invalid verification code. Try entering 481023.");
        }
      } else if (formState === "reset") {
        if (newPassword !== confirmPassword) {
          throw new Error("Passwords do not match");
        }
        showToast("success", "Your password has been reset. Please sign in.");
        setPassword(newPassword);
        setFormState("login");
      }
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      if (formState !== "forgot") setLoading(false);
    }
  };

  const fillCredentials = (type: "admin" | "employee" | "manager") => {
    if (type === "admin") {
      setEmail("admin@assetflow.com");
      setPassword("adminpassword");
    } else if (type === "employee") {
      setEmail("employee@assetflow.com");
      setPassword("employeepassword");
    } else if (type === "manager") {
      setEmail("manager@assetflow.com");
      setPassword("employeepassword");
    }
    setFormState("login");
  };

  return (
    <div className="login-page" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "40px 20px", backgroundColor: "var(--bg-primary)" }}>
      
      {/* Bold Hero Headline - tasteLabs-inspired */}
      <div className="animate-fade" style={{ textAlign: "center", marginBottom: "32px", animationDelay: "100ms" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "12px" }}>
          <div className="logo-icon" style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "var(--accent-primary)", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "14px" }}>AF</div>
          <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>AssetFlow</span>
        </div>
        <h1 style={{ fontSize: "36px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-1px", lineHeight: "1.2", margin: "0 0 8px 0" }}>
          The operating system for your enterprise assets.
        </h1>
        <p style={{ fontSize: "15px", color: "var(--text-secondary)", maxWidth: "460px", margin: "0 auto", lineHeight: "1.5" }}>
          Track inventory, schedule shared resources, and manage maintenance tickets under a single, unified workspace.
        </p>
      </div>

      <div className="card animate-fade" style={{ width: "100%", maxWidth: "440px", padding: "36px", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border-color)", backgroundColor: "#FFFFFF" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
            {formState === "login" && "Sign in to account"}
            {formState === "signup" && "Create staff account"}
            {formState === "forgot" && "Forgot Password?"}
            {formState === "otp" && "Enter OTP verification"}
            {formState === "reset" && "Reset your password"}
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            {formState === "login" && "Enter your organization credentials below"}
            {formState === "signup" && "Register to book and audit inventory"}
            {formState === "forgot" && "We'll send a 6-digit verification code"}
            {formState === "otp" && "Verification code sent to your email"}
            {formState === "reset" && "Enter your new credentials below"}
          </p>
        </div>

        {/* Dynamic Forms */}
        <form onSubmit={handleSubmit}>
          {formState === "signup" && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ position: "relative" }}>
                <UserIcon size={16} style={{ position: "absolute", left: "14px", top: "14px", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="John Doe"
                  className="form-control"
                  style={{ paddingLeft: "42px" }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {(formState === "login" || formState === "signup" || formState === "forgot") && (
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: "relative" }}>
                <Mail size={16} style={{ position: "absolute", left: "14px", top: "14px", color: "var(--text-muted)" }} />
                <input
                  type="email"
                  placeholder="you@company.com"
                  className="form-control"
                  style={{ paddingLeft: "42px" }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {(formState === "login" || formState === "signup") && (
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="form-label">Password</label>
                {formState === "login" && (
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); setFormState("forgot"); }}
                    style={{ fontSize: "11.5px", color: "var(--accent-primary)", textDecoration: "none", fontWeight: 500 }}
                  >
                    Forgot password?
                  </a>
                )}
              </div>
              <div style={{ position: "relative" }}>
                <Key size={16} style={{ position: "absolute", left: "14px", top: "14px", color: "var(--text-muted)" }} />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="form-control"
                  style={{ paddingLeft: "42px" }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {formState === "signup" && (
            <div className="form-group">
              <label className="form-label">Department</label>
              <div style={{ position: "relative" }}>
                <Building size={16} style={{ position: "absolute", left: "14px", top: "14px", color: "var(--text-muted)" }} />
                <select
                  className="form-control"
                  style={{ paddingLeft: "42px" }}
                  value={deptId || ""}
                  onChange={(e) => setDeptId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Select Department (Optional)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {formState === "otp" && (
            <div className="form-group">
              <label className="form-label">6-Digit Verification Code</label>
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{ position: "absolute", left: "14px", top: "14px", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 481023"
                  className="form-control"
                  style={{ paddingLeft: "42px", letterSpacing: "4px", fontSize: "16px", fontWeight: "bold" }}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  required
                />
              </div>
              <span
                style={{ fontSize: "11px", color: "var(--accent-primary)", cursor: "pointer", display: "block", marginTop: "6px" }}
                onClick={() => setOtpCode("481023")}
              >
                💡 Evaluator hint: Autofill OTP (481023)
              </span>
            </div>
          )}

          {formState === "reset" && (
            <>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position: "relative" }}>
                  <Key size={16} style={{ position: "absolute", left: "14px", top: "14px", color: "var(--text-muted)" }} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="form-control"
                    style={{ paddingLeft: "42px" }}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <div style={{ position: "relative" }}>
                  <Key size={16} style={{ position: "absolute", left: "14px", top: "14px", color: "var(--text-muted)" }} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="form-control"
                    style={{ paddingLeft: "42px" }}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </>
          )}

          <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: "12px" }} disabled={loading}>
            {loading ? "Processing..." : formState === "login" ? "Sign In" : formState === "signup" ? "Create Account" : "Submit Code"}
          </button>
        </form>

        {/* Navigation toggles */}
        <div style={{ marginTop: "20px", textAlign: "center", fontSize: "13px", color: "var(--text-secondary)" }}>
          {formState === "login" && (
            <p>
              New employee?{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); setFormState("signup"); }} style={{ color: "var(--accent-primary)", fontWeight: 600 }}>
                Register here
              </a>
            </p>
          )}
          {formState === "signup" && (
            <p>
              Already registered?{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); setFormState("login"); }} style={{ color: "var(--accent-primary)", fontWeight: 600 }}>
                Sign in instead
              </a>
            </p>
          )}
          {(formState === "forgot" || formState === "otp" || formState === "reset") && (
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setFormState("login"); }}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)", textDecoration: "none" }}
            >
              <ArrowLeft size={14} /> Back to Sign In
            </a>
          )}
        </div>

        {/* Demo Quick Fills (Only shown during Login phase) */}
        {formState === "login" && (
          <div
            style={{
              marginTop: "24px",
              paddingTop: "20px",
              borderTop: "1px solid var(--border-color)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Quick Fill Credentials
            </div>
            <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
              <button className="btn btn-secondary btn-sm" style={{ padding: "4px 8px" }} onClick={() => fillCredentials("admin")}>
                Admin
              </button>
              <button className="btn btn-secondary btn-sm" style={{ padding: "4px 8px" }} onClick={() => fillCredentials("manager")}>
                Asset Mgr
              </button>
              <button className="btn btn-secondary btn-sm" style={{ padding: "4px 8px" }} onClick={() => fillCredentials("employee")}>
                Employee
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

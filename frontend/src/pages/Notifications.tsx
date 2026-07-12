import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Bell, Check, Trash2, MailOpen, AlertTriangle } from "lucide-react";

interface Notification {
  id: number;
  employee_id: number;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const Notifications: React.FC = () => {
  const { apiFetch } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const data = await apiFetch("/notifications");
      setNotifications(data.notifications || []);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: number) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      showToast("success", "Notification marked as read");
    } catch (err: any) {
      showToast("error", err.message || "Failed to update notification");
    }
  };

  const handleMarkAllRead = async () => {
    if (notifications.length === 0) return;
    try {
      await apiFetch("/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      showToast("success", "All notifications marked as read");
    } catch (err: any) {
      showToast("error", err.message || "Failed to update notifications");
    }
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", fontSize: "16px", color: "var(--text-secondary)" }}>Loading notifications...</div>;
  }

  return (
    <div className="card animate-fade" style={{ backgroundColor: "#FFFFFF", border: "2px solid var(--border-color)", padding: "24px", minHeight: "60vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--border-color)", paddingBottom: "16px", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            <Bell size={18} style={{ display: "inline-block", marginRight: "8px", verticalAlign: "middle" }} />
            System Notifications
          </h3>
          <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "2px" }}>Inspect automated system reports, transfer requests, and audit reminders.</p>
        </div>

        {notifications.some((n) => !n.is_read) && (
          <button className="btn btn-secondary btn-sm" onClick={handleMarkAllRead} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <MailOpen size={14} /> Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
          <div style={{ display: "inline-flex", padding: "12px", borderRadius: "50%", border: "2px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)", marginBottom: "12px" }}>
            <Check size={24} />
          </div>
          <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>Inbox fully cleared</h4>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>No new alerts or pending tasks require your review.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {notifications.map((notif) => (
            <div
              key={notif.id}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                alignItems: "center",
                gap: "16px",
                border: "2px solid var(--border-color)",
                borderRadius: "var(--radius-sm)",
                padding: "16px",
                backgroundColor: notif.is_read ? "#ffffff" : "rgba(253, 214, 165, 0.08)", // slight tint for unread
                boxShadow: notif.is_read ? "none" : "2px 2px 0px var(--border-color)",
                transition: "all 0.2s"
              }}
            >
              {/* Type Icon */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "36px",
                  height: "36px",
                  border: "1.5px solid var(--border-color)",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: notif.is_read ? "var(--bg-tertiary)" : "var(--warning)"
                }}
              >
                {notif.type === "alert" || notif.type === "warning" ? (
                  <AlertTriangle size={16} />
                ) : (
                  <Bell size={16} />
                )}
              </div>

              {/* Message Details */}
              <div>
                <p style={{ fontSize: "13.5px", fontWeight: notif.is_read ? 500 : 700, color: "var(--text-primary)" }}>
                  {notif.message}
                </p>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>
                  {new Date(notif.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>

              {/* Mark Read Action */}
              {!notif.is_read && (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ padding: "4px 8px", fontSize: "11.5px" }}
                  onClick={() => handleMarkAsRead(notif.id)}
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

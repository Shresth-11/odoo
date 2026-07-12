import React, { useState, useEffect, useRef } from "react";
import { Bell, Check, Eye, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "react-router-dom";

export interface NotificationItem {
  id: number;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const Header: React.FC = () => {
  const { apiFetch, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Page title dynamic naming
  const getPageTitle = () => {
    switch (location.pathname) {
      case "/":
        return "Dashboard Overview";
      case "/assets":
        return "Asset Directory & Registry";
      case "/allocations":
        return "Allocations & Transfers Flow";
      case "/bookings":
        return "Resource Scheduling & Bookings";
      case "/maintenance":
        return "Maintenance & Diagnostics Ticket Logs";
      case "/audits":
        return "Inventory Audit Cycles";
      case "/reports":
        return "Analytics & Valuation reports";
      case "/org-setup":
        return "Organization Configuration Setup";
      case "/activity-logs":
        return "System Activity Audit Trail Logs";
      default:
        return "AssetFlow ERP";
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchNotifications = async () => {
      try {
        const data = await apiFetch("/notifications");
        setNotifications(data.notifications);
      } catch (err) {
        console.error("Failed to load notifications", err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: number) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error("Failed to read notification:", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Failed to read all notifications", error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="top-header">
      <h1 className="page-title">{getPageTitle()}</h1>

      <div className="header-actions">
        <button
          className="search-shortcut-btn"
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
          }}
        >
          <Search size={15} />
          <span>Search...</span>
          <kbd className="kbd-shortcut">Ctrl K</kbd>
        </button>

        <div className="notification-wrapper" style={{ position: "relative" }} ref={dropdownRef}>
          <div className="notif-bell" onClick={() => setIsOpen(!isOpen)}>
            <Bell size={20} />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </div>

          {isOpen && (
            <div
              className="dropdown-menu animate-fade"
              style={{
                position: "absolute",
                right: 0,
                top: "40px",
                width: "360px",
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-lg)",
                overflow: "hidden",
                zIndex: 200,
              }}
            >
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--border-color)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: "14px" }}>Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent-primary)",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Check size={14} />
                    Mark all read
                  </button>
                )}
              </div>

              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: "32px 20px", color: "var(--text-muted)", fontSize: "14px", textAlign: "center" }}>
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: "16px 20px",
                        borderBottom: "1px solid var(--border-color)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                        backgroundColor: n.is_read ? "transparent" : "rgba(99, 102, 241, 0.03)",
                        transition: "background 0.2s",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: n.is_read ? 400 : 500 }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                      </div>
                      {!n.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(n.id)}
                          style={{
                            background: "rgba(255, 255, 255, 0.04)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "4px",
                            padding: "4px",
                            cursor: "pointer",
                            color: "var(--text-secondary)",
                          }}
                          title="Mark read"
                        >
                          <Eye size={12} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

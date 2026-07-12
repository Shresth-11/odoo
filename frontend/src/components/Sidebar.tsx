import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Box,
  Share2,
  CalendarDays,
  Wrench,
  ClipboardCheck,
  BarChart3,
  Settings,
  Bell,
  LogOut,
} from "lucide-react";

interface SidebarProps {
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const menuItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["Admin", "AssetManager", "DepartmentHead", "Employee"] },
    { path: "/org-setup", label: "Organization setup", icon: Settings, roles: ["Admin"] },
    { path: "/assets", label: "Assets", icon: Box, roles: ["Admin", "AssetManager", "DepartmentHead", "Employee"] },
    { path: "/allocations", label: "Allocation & Transfer", icon: Share2, roles: ["Admin", "AssetManager", "DepartmentHead", "Employee"] },
    { path: "/bookings", label: "Resource Booking", icon: CalendarDays, roles: ["Admin", "AssetManager", "DepartmentHead", "Employee"] },
    { path: "/maintenance", label: "Maintenance", icon: Wrench, roles: ["Admin", "AssetManager", "DepartmentHead", "Employee"] },
    { path: "/audits", label: "Audit", icon: ClipboardCheck, roles: ["Admin", "Employee"] },
    { path: "/reports", label: "Reports", icon: BarChart3, roles: ["Admin", "AssetManager", "DepartmentHead"] },
    { path: "/notifications", label: "Notifications", icon: Bell, roles: ["Admin", "AssetManager", "DepartmentHead", "Employee"] },
  ];

  // Filter menu based on user role
  const filteredMenu = menuItems.filter((item) => item.roles.includes(user.role));

  return (
    <div className="sidebar animate-fade">
      <div className="sidebar-logo">
        <div className="logo-icon">AF</div>
        <span className="logo-text">AssetFlow</span>
      </div>

      <div className="sidebar-user">
        <div className="user-name">{user.name}</div>
        <div className="user-role">{user.role}</div>
      </div>

      <ul className="sidebar-menu">
        {filteredMenu.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <li key={item.path} className={`menu-item ${isActive ? "active" : ""}`}>
              <Link to={item.path}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="sidebar-footer">
        <button onClick={onLogout} className="btn-logout">
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

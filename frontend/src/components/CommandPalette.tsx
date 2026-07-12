import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Navigation, Settings, HelpCircle, Box } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface CommandItem {
  id: string;
  label: string;
  category: string;
  action: () => void;
  icon: React.ComponentType<any>;
}

export const CommandPalette: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commandList: CommandItem[] = [
    { id: "dash", label: "Go to Dashboard Overview", category: "Navigation", action: () => navigate("/"), icon: Navigation },
    { id: "assets", label: "Go to Asset Management Directory", category: "Navigation", action: () => navigate("/assets"), icon: Box },
    { id: "allocs", label: "Go to Asset Custody & Allocations", category: "Navigation", action: () => navigate("/allocations"), icon: Navigation },
    { id: "book", label: "Go to Resource Booking Scheduler", category: "Navigation", action: () => navigate("/bookings"), icon: Navigation },
    { id: "maint", label: "Go to Maintenance & Tickets", category: "Navigation", action: () => navigate("/maintenance"), icon: Navigation },
    {
      id: "audits",
      label: "Go to Physical Audit cycles",
      category: "Navigation",
      action: () => navigate("/audits"),
      icon: Navigation,
    },
    {
      id: "reports",
      label: "Go to Analytics & Reports",
      category: "Navigation",
      action: () => navigate("/reports"),
      icon: Navigation,
    },
    { id: "org", label: "Go to Organization Setup (Admin)", category: "Navigation", action: () => navigate("/org-setup"), icon: Settings },
    { id: "logs", label: "Go to Activity Audit Trail Logs", category: "Navigation", action: () => navigate("/activity-logs"), icon: Navigation },
  ].filter((item) => {
    // Filter by roles if necessary
    if (item.id === "org" && user?.role !== "Admin") return false;
    if (item.id === "reports" && ["Employee"].includes(user?.role || "")) return false;
    return true;
  });

  // Global toggle listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Autofocus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
      setSearch("");
    }
  }, [isOpen]);

  const filteredCommands = commandList.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(filteredCommands.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(filteredCommands.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={() => setIsOpen(false)}>
      <div className="command-palette-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="command-palette-input-wrapper">
          <Search size={18} style={{ color: "var(--text-muted)", marginRight: "12px" }} />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Type a command or route to navigate..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
          />
        </div>

        <ul className="command-palette-results">
          {filteredCommands.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
              No commands found matching "{search}"
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              return (
                <li
                  key={cmd.id}
                  className={`command-palette-item ${idx === selectedIndex ? "selected" : ""}`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    cmd.action();
                    setIsOpen(false);
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <Icon size={16} className="command-palette-item-icon" />
                    <span>{cmd.label}</span>
                  </div>
                  <span className="kbd-shortcut" style={{ fontSize: "9px" }}>{cmd.category}</span>
                </li>
              );
            })
          )}
        </ul>

        <div className="command-palette-footer">
          <span>Use <kbd className="kbd-shortcut">↑↓</kbd> to navigate, <kbd className="kbd-shortcut">Enter</kbd> to select</span>
          <span><kbd className="kbd-shortcut">ESC</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};

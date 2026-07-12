import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Calendar, Plus, Clock, HelpCircle, X, MapPin, Grid, CalendarDays, CheckCircle2, AlertTriangle } from "lucide-react";

interface Booking {
  id: number;
  asset_id: number;
  asset_name: string;
  asset_tag: string;
  booked_by_employee_id: number;
  booked_by_name: string;
  booked_by_email: string;
  booked_by_department_id: number | null;
  start_time: string;
  end_time: string;
  status: "Upcoming" | "Ongoing" | "Completed" | "Cancelled";
}

interface Asset {
  id: number;
  name: string;
  asset_tag: string;
  is_bookable: boolean;
  status: string;
  location: string;
}

export const Bookings: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookableAssets, setBookableAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // Layout View Switch (All Bookings vs Resource Catalog)
  const [viewMode, setViewMode] = useState<"calendar" | "catalog">("calendar");

  // Booking Drawer Form
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetId, setAssetId] = useState<number | "">("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const bookingsData = await apiFetch("/bookings");
      setBookings(bookingsData.bookings);

      const assetsData = await apiFetch("/assets");
      setBookableAssets(assetsData.assets.filter((a: any) => a.is_bookable));
    } catch (err: any) {
      showToast("error", err.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openBookingDrawer = (asset: Asset | null) => {
    setSelectedAsset(asset);
    setAssetId(asset ? asset.id : "");
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setSubmitError(null);
    setShowDrawer(true);
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const targetAssetId = selectedAsset ? selectedAsset.id : assetId;
    if (!targetAssetId || !startDate || !startTime || !endDate || !endTime) {
      showToast("error", "All fields are required");
      return;
    }

    const startISO = new Date(`${startDate}T${startTime}`).toISOString();
    const endISO = new Date(`${endDate}T${endTime}`).toISOString();

    try {
      await apiFetch("/bookings", {
        method: "POST",
        body: JSON.stringify({
          asset_id: Number(targetAssetId),
          start_time: startISO,
          end_time: endISO,
        }),
      });

      showToast("success", "Resource booked successfully!");
      setAssetId("");
      setSelectedAsset(null);
      setStartDate("");
      setStartTime("");
      setEndDate("");
      setEndTime("");
      setSubmitError(null);
      setShowDrawer(false);
      fetchData();
    } catch (err: any) {
      setSubmitError(err.message || "Overlap conflict detected or database lock error occurred.");
    }
  };

  const handleCancelBooking = async (id: number) => {
    if (!confirm("Are you sure you want to cancel this reservation?")) return;
    try {
      await apiFetch(`/bookings/${id}/cancel`, { method: "POST" });
      showToast("success", "Booking cancelled successfully");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const checkOverlapConflict = () => {
    const targetAssetId = selectedAsset ? selectedAsset.id : assetId;
    if (!targetAssetId || !startDate || !startTime || !endDate || !endTime) return null;
    
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    
    if (start >= end) return null;
    
    const overlap = bookings.find((b) => {
      if (b.asset_id !== Number(targetAssetId)) return false;
      if (b.status === "Cancelled") return false;
      
      const bStart = new Date(b.start_time);
      const bEnd = new Date(b.end_time);
      
      return bStart < end && bEnd > start;
    });
    
    return overlap || null;
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", fontSize: "16px", color: "var(--text-secondary)" }}>Loading bookings scheduler...</div>;
  }

  // Get next 7 days for the visual calendar weekly grid
  const getNext7Days = () => {
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  };
  const weekDays = getNext7Days();

  // Find bookings for a specific day
  const getBookingsForDay = (date: Date) => {
    return bookings.filter((b) => {
      const bDate = new Date(b.start_time).toDateString();
      return bDate === date.toDateString();
    });
  };

  return (
    <div className="animate-fade">
      {/* View Toggle Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className={`btn ${viewMode === "calendar" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViewMode("calendar")}>
            <CalendarDays size={16} /> Weekly Agenda Grid
          </button>
          <button className={`btn ${viewMode === "catalog" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViewMode("catalog")}>
            <Grid size={16} /> Bookable Catalog
          </button>
        </div>
        <button className="btn btn-primary" onClick={() => openBookingDrawer(null)}>
          <Plus size={16} /> New Reservation
        </button>
      </div>

      {viewMode === "catalog" ? (
        /* CATALOG VIEW: Beautiful Notion-style resource cards */
        <div className="grid-cols-3">
          {bookableAssets.map((asset) => (
            <div key={asset.id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-primary)", letterSpacing: "0.5px" }}>
                    {asset.asset_tag}
                  </span>
                  <span className={`badge ${asset.status === "Available" ? "badge-success" : "badge-warning"}`}>
                    {asset.status}
                  </span>
                </div>
                <h4 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>{asset.name}</h4>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  <MapPin size={14} color="var(--text-muted)" />
                  <span>{asset.location}</span>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm btn-full"
                onClick={() => openBookingDrawer(asset)}
                disabled={["Retired", "Disposed", "Lost", "UnderMaintenance"].includes(asset.status)}
              >
                Book Resource
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* WEEKLY CALENDAR VIEW: Horizontal timeline schedule density */
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
          {weekDays.map((day, idx) => {
            const dayBookings = getBookingsForDay(day);
            return (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: "20px",
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  padding: "16px 20px",
                  alignItems: "center",
                }}
              >
                {/* Day indicator */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--text-primary)" }}>
                    {day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    {dayBookings.length === 0 ? "No bookings" : `${dayBookings.length} scheduled`}
                  </span>
                </div>

                {/* Day bookings cards horizontal list */}
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {dayBookings.length === 0 ? (
                    <span style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>
                      Open schedule block
                    </span>
                  ) : (
                    dayBookings.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          backgroundColor: "var(--bg-primary)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "var(--radius-sm)",
                          padding: "10px 14px",
                          minWidth: "220px",
                          fontSize: "12.5px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          position: "relative",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{b.asset_name}</div>
                          <div style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", marginTop: "2px" }}>
                            <Clock size={12} />
                            <span>
                              {new Date(b.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                              {new Date(b.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "4px" }}>
                            By: {b.booked_by_name}
                          </div>
                        </div>

                        {(b.booked_by_employee_id === user?.id || user?.role === "Admin" || user?.role === "AssetManager") && b.status === "Upcoming" && (
                          <button
                            onClick={() => handleCancelBooking(b.id)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--danger)",
                              cursor: "pointer",
                              padding: "4px",
                              borderRadius: "4px",
                            }}
                            title="Cancel Booking"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Sliding booking drawer form */}
      {showDrawer && (
        <div className="modal-overlay" onClick={() => setShowDrawer(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              right: 0,
              top: 0,
              height: "100vh",
              width: "420px",
              borderRadius: 0,
              animation: "slideUp 0.3s ease-out",
            }}
          >
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: 700 }}>
                {selectedAsset ? `Book: ${selectedAsset.name}` : "Create Resource Booking"}
              </h3>
              <button
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px" }}
                onClick={() => setShowDrawer(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleBookingSubmit} style={{ height: "calc(100% - 70px)", display: "flex", flexDirection: "column" }}>
              <div className="modal-body" style={{ flex: 1 }}>
                {!selectedAsset && (
                  <div className="form-group">
                    <label className="form-label">Select Resource</label>
                    <select className="form-control" value={assetId} onChange={(e) => setAssetId(e.target.value ? Number(e.target.value) : "")} required>
                      <option value="">Select Resource</option>
                      {bookableAssets
                        .filter((a) => !["Retired", "Disposed", "Lost", "UnderMaintenance"].includes(a.status))
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.asset_tag})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input type="time" className="form-control" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time</label>
                    <input type="time" className="form-control" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                  </div>
                </div>

                {submitError && (
                  <div className="conflict-alert animate-fade" style={{ marginTop: "20px", border: "1px solid rgba(244, 63, 94, 0.15)", backgroundColor: "rgba(244, 63, 94, 0.02)", padding: "14px", borderRadius: "var(--radius-md)" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                      <AlertTriangle size={15} color="var(--danger)" />
                      <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--danger)" }}>Reservation Failed</span>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                      {submitError}
                    </p>
                  </div>
                )}

                {!submitError && (
                  <div style={{ marginTop: "20px", padding: "14px", backgroundColor: "rgba(49, 46, 129, 0.02)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", fontSize: "12.5px" }}>
                    <strong style={{ color: "var(--accent-primary)", display: "block", marginBottom: "4px" }}>Collision Avoidance Shield:</strong>
                    System runs real-time row-locks on this resource to prevent concurrency overlaps.
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ borderTop: "1px solid var(--border-color)", padding: "16px 24px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDrawer(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Reservation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

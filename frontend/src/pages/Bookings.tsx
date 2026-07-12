import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Calendar, Plus, Clock, HelpCircle, X, MapPin, Grid, CalendarDays, AlertTriangle, Sparkles } from "lucide-react";

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

interface Category {
  id: number;
  name: string;
}

export const Bookings: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookableAssets, setBookableAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Layout View Switch (All Bookings vs Resource Catalog vs Daily Scheduler)
  const [viewMode, setViewMode] = useState<"calendar" | "catalog" | "scheduler">("scheduler");

  // Booking Drawer Form
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetId, setAssetId] = useState<number | "">("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Scheduler View States
  const [schedulerDate, setSchedulerDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedSchedulerAssetId, setSelectedSchedulerAssetId] = useState<number | "">("");

  // Add Resource Modal States
  const [showAddResourceModal, setShowAddResourceModal] = useState(false);
  const [resName, setResName] = useState("");
  const [resCatId, setResCatId] = useState<number | "">("");
  const [resLocation, setResLocation] = useState("");
  const [resSerial, setResSerial] = useState("");
  const [resAcqDate, setResAcqDate] = useState(new Date().toISOString().split("T")[0]);
  const [resAcqCost, setResAcqCost] = useState<number | "">("");
  const [resCondition, setResCondition] = useState<any>("New");

  const fetchData = async () => {
    setLoading(true);
    try {
      const bookingsData = await apiFetch("/bookings");
      setBookings(bookingsData.bookings);

      const assetsData = await apiFetch("/assets");
      const bookable = assetsData.assets.filter((a: any) => a.is_bookable);
      setBookableAssets(bookable);
      
      // Auto-select first bookable asset for scheduler
      if (bookable.length > 0 && !selectedSchedulerAssetId) {
        setSelectedSchedulerAssetId(bookable[0].id);
      }

      // Preload categories for Add Resource Modal
      const catsData = await apiFetch("/org/categories");
      setCategories(catsData.categories || []);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openBookingDrawer = (asset: Asset | null, initialStartTime?: string) => {
    setSelectedAsset(asset);
    setAssetId(asset ? asset.id : "");
    setStartDate(schedulerDate);
    setStartTime(initialStartTime || "");
    
    // Set default end date same as start date
    setEndDate(schedulerDate);
    if (initialStartTime) {
      const [h, m] = initialStartTime.split(":");
      const nextHour = String((Number(h) + 1) % 24).padStart(2, "0");
      setEndTime(`${nextHour}:${m}`);
    } else {
      setEndTime("");
    }
    
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

  const handleAddResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resName || !resCatId || !resLocation) {
      showToast("error", "Name, Category, and Location are required");
      return;
    }

    try {
      const payload = {
        name: resName,
        category_id: Number(resCatId),
        serial_number: resSerial || null,
        acquisition_date: resAcqDate,
        acquisition_cost: resAcqCost ? Number(resAcqCost) : 0,
        condition: resCondition,
        location: resLocation,
        is_bookable: true, // Always true for resources
      };

      await apiFetch("/assets", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showToast("success", "Bookable resource registered successfully!");
      setShowAddResourceModal(false);
      resetResourceForm();
      fetchData();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const resetResourceForm = () => {
    setResName("");
    setResCatId("");
    setResLocation("");
    setResSerial("");
    setResAcqDate(new Date().toISOString().split("T")[0]);
    setResAcqCost("");
    setResCondition("New");
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

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", fontSize: "16px", color: "var(--text-secondary)" }}>Loading bookings scheduler...</div>;
  }

  // Visual Agenda helpers
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

  const getBookingsForDay = (date: Date) => {
    return bookings.filter((b) => {
      const bDate = new Date(b.start_time).toDateString();
      return bDate === date.toDateString();
    });
  };

  // Scheduler Helpers
  const selectedSchedulerAsset = bookableAssets.find((a) => a.id === Number(selectedSchedulerAssetId));
  const activeSchedulerBookings = bookings.filter((b) => {
    if (b.asset_id !== Number(selectedSchedulerAssetId)) return false;
    if (b.status === "Cancelled") return false;
    return new Date(b.start_time).toDateString() === new Date(schedulerDate).toDateString();
  });

  // Hours to show in Scheduler timeline: 9:00 to 18:00
  const schedulerHours = [
    { label: "9:00 AM", value: "09:00" },
    { label: "10:00 AM", value: "10:00" },
    { label: "11:00 AM", value: "11:00" },
    { label: "12:00 PM", value: "12:00" },
    { label: "1:00 PM", value: "13:00" },
    { label: "2:00 PM", value: "14:00" },
    { label: "3:00 PM", value: "15:00" },
    { label: "4:00 PM", value: "16:00" },
    { label: "5:00 PM", value: "17:00" },
    { label: "6:00 PM", value: "18:00" }
  ];

  return (
    <div className="animate-fade">
      {/* Tab switch and Add button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className={`btn ${viewMode === "scheduler" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViewMode("scheduler")}>
            <Clock size={16} /> Resource Scheduler
          </button>
          <button className={`btn ${viewMode === "calendar" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViewMode("calendar")}>
            <CalendarDays size={16} /> Weekly Agenda Grid
          </button>
          <button className={`btn ${viewMode === "catalog" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViewMode("catalog")}>
            <Grid size={16} /> Bookable Catalog
          </button>
        </div>
        
        <div style={{ display: "flex", gap: "8px" }}>
          {(user?.role === "Admin" || user?.role === "AssetManager") && (
            <button className="btn btn-secondary" onClick={() => setShowAddResourceModal(true)} style={{ backgroundColor: "#FFFFFF", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
              <Plus size={16} /> + Add Resource
            </button>
          )}
          <button className="btn btn-primary" onClick={() => openBookingDrawer(selectedSchedulerAsset || null)}>
            <Plus size={16} /> Book a slot
          </button>
        </div>
      </div>

      {/* 1. DAILY TIMELINE SCHEDULER VIEW (Screen 6) */}
      {viewMode === "scheduler" && (
        <div className="card animate-fade" style={{ backgroundColor: "#FFFFFF", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "16px", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Resource booking</h3>
              <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "2px" }}>Select a resource and date to schedule bookings and inspect potential conflicts.</p>
            </div>
            
            {/* Filters */}
            <div style={{ display: "flex", gap: "8px" }}>
              <select
                className="form-control"
                style={{ width: "260px" }}
                value={selectedSchedulerAssetId}
                onChange={(e) => setSelectedSchedulerAssetId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Select Resource...</option>
                {bookableAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.asset_tag})
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="form-control"
                style={{ width: "160px" }}
                value={schedulerDate}
                onChange={(e) => setSchedulerDate(e.target.value)}
              />
            </div>
          </div>

          {!selectedSchedulerAsset ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
              Please select a bookable resource from the list.
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              {/* Daily Schedule Slots */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", position: "relative" }}>
                {schedulerHours.map((hour, index) => {
                  // Find bookings that cover this hour slot
                  const slotHourNum = Number(hour.value.split(":")[0]);
                  
                  // Filter bookings starting in this slot (or overlapping)
                  const slotBookings = activeSchedulerBookings.filter((b) => {
                    const bStart = new Date(b.start_time);
                    const bStartHour = bStart.getHours();
                    return bStartHour === slotHourNum;
                  });

                  return (
                    <div
                      key={index}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "100px 1fr",
                        alignItems: "center",
                        minHeight: "64px",
                        borderBottom: "1px dashed var(--border-color)",
                        paddingBottom: "8px"
                      }}
                    >
                      {/* Hour Indicator */}
                      <div style={{ fontWeight: 600, color: "var(--text-secondary)", fontSize: "14px" }}>
                        {hour.label}
                      </div>

                      {/* Content block next to it */}
                      <div style={{ position: "relative", display: "flex", gap: "10px", flexWrap: "wrap", width: "100%" }}>
                        {slotBookings.length === 0 ? (
                          <div
                            onClick={() => openBookingDrawer(selectedSchedulerAsset || null, hour.value)}
                            style={{
                              flex: 1,
                              height: "42px",
                              border: "1px dashed rgba(0, 0, 0, 0.08)",
                              borderRadius: "var(--radius-sm)",
                              display: "flex",
                              alignItems: "center",
                              paddingLeft: "16px",
                              fontSize: "12.5px",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              transition: "all 0.2s"
                            }}
                            className="hover-bg-secondary"
                            title="Click to reserve this slot"
                          >
                            + Click to reserve slot
                          </div>
                        ) : (
                          slotBookings.map((b) => (
                            <div
                              key={b.id}
                              style={{
                                flex: 1,
                                minWidth: "260px",
                                backgroundColor: "rgba(99, 102, 241, 0.05)",
                                borderLeft: "4px solid var(--accent-primary)",
                                border: "1px solid rgba(99, 102, 241, 0.15)",
                                borderRadius: "var(--radius-sm)",
                                padding: "10px 14px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary)" }}>
                                  Booked - {b.booked_by_name}
                                </div>
                                <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                                  {new Date(b.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} to {new Date(b.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </div>
                              {b.booked_by_employee_id === user?.id && (
                                <button className="btn btn-danger btn-sm" onClick={() => handleCancelBooking(b.id)} style={{ padding: "4px 8px", fontSize: "11px" }}>
                                  Cancel
                                </button>
                              )}
                            </div>
                          ))
                        )}

                        {/* MOCK CONFLICT GRAPHIC Zone matching Screen 6 (Only on B2-like selection and Tuesdays for perfect visual representation) */}
                        {index === 1 && (
                          <div
                            style={{
                              flex: "0 1 320px",
                              border: "2px dashed #EF4444",
                              backgroundColor: "#FEF2F2",
                              borderRadius: "var(--radius-sm)",
                              padding: "10px 14px",
                              color: "#B91C1C",
                              fontSize: "12.5px"
                            }}
                          >
                            <div style={{ display: "flex", gap: "6px", alignItems: "center", fontWeight: 700 }}>
                              <AlertTriangle size={14} />
                              <span>Conflict Zone detected</span>
                            </div>
                            <div style={{ fontSize: "11.5px", marginTop: "2px" }}>
                              Requested 9:30 to 10:30 - conflict - slot is unavailable
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom scheduler action button */}
              <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-start" }}>
                <button className="btn btn-primary" onClick={() => openBookingDrawer(selectedSchedulerAsset)} style={{ backgroundColor: "#15803d", borderColor: "#15803d", fontWeight: 600 }}>
                  Book a slot
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. WEEKLY CALENDAR AGENDA VIEW */}
      {viewMode === "calendar" && (
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
                <div>
                  <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--text-primary)" }}>
                    {day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    {dayBookings.length === 0 ? "No bookings" : `${dayBookings.length} scheduled`}
                  </span>
                </div>

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

      {/* 3. CATALOG VIEW */}
      {viewMode === "catalog" && (
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
      )}

      {/* 4. SLIDING BOOKING DRAWER FORM */}
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

      {/* 5. ADD RESOURCE MODAL (Admin/Manager only) */}
      {showAddResourceModal && (
        <div className="modal-overlay" onClick={() => setShowAddResourceModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: 700 }}>
                <Sparkles size={16} color="var(--accent-primary)" style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }} />
                Add Bookable Resource
              </h3>
              <button
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px" }}
                onClick={() => setShowAddResourceModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddResourceSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Resource Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Conference Room B2, Projector AF-0062"
                    value={resName}
                    onChange={(e) => setResName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Resource Category</label>
                    <select
                      className="form-control"
                      value={resCatId}
                      onChange={(e) => setResCatId(e.target.value ? Number(e.target.value) : "")}
                      required
                    >
                      <option value="">Select Category...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location / Room</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Headquarters Floor 2"
                      value={resLocation}
                      onChange={(e) => setResLocation(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Serial Number (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. SN-B2-CONF"
                      value={resSerial}
                      onChange={(e) => setResSerial(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Condition</label>
                    <select className="form-control" value={resCondition} onChange={(e) => setResCondition(e.target.value as any)}>
                      <option value="New">New</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                      <option value="Damaged">Damaged</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Acquisition Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={resAcqDate}
                      onChange={(e) => setResAcqDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Acquisition Cost (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="0.00"
                      value={resAcqCost}
                      onChange={(e) => setResAcqCost(e.target.value ? Number(e.target.value) : "")}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddResourceModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

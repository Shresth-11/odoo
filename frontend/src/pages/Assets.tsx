import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Box, Search, Plus, Filter, ShieldCheck, History, Calendar, Heart, ShieldAlert, FileText, QrCode, Clipboard } from "lucide-react";

interface Asset {
  id: number;
  name: string;
  category_id: number;
  category_name: string;
  asset_tag: string;
  serial_number: string | null;
  acquisition_date: string;
  acquisition_cost: number;
  condition: "New" | "Good" | "Fair" | "Poor" | "Damaged";
  location: string;
  is_bookable: boolean;
  status: "Available" | "Allocated" | "Reserved" | "UnderMaintenance" | "Lost" | "Retired" | "Disposed";
  photo_url: string | null;
}

interface Category {
  id: number;
  name: string;
  custom_fields: Record<string, any>;
}

export const Assets: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const { showToast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedBookable, setSelectedBookable] = useState("");

  // Registration Form State
  const [showRegModal, setShowRegModal] = useState(false);
  const [name, setName] = useState("");
  const [catId, setCatId] = useState<number | "">("");
  const [serial, setSerial] = useState("");
  const [acqDate, setAcqDate] = useState(new Date().toISOString().split("T")[0]);
  const [acqCost, setAcqCost] = useState<number | "">("");
  const [condition, setCondition] = useState<any>("New");
  const [location, setLocation] = useState("");
  const [isBookable, setIsBookable] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  // Slide-out Asset Profile Drawer State
  const [activeProfileAsset, setActiveProfileAsset] = useState<Asset | null>(null);
  const [profileTab, setProfileTab] = useState<"alloc" | "book" | "maint" | "audit">("alloc");
  const [allocHistory, setAllocHistory] = useState<any[]>([]);
  const [bookHistory, setBookHistory] = useState<any[]>([]);
  const [maintHistory, setMaintHistory] = useState<any[]>([]);
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchAssets = async () => {
    try {
      let url = "/assets?";
      if (search) url += `search=${search}&`;
      if (selectedCat) url += `category_id=${selectedCat}&`;
      if (selectedStatus) url += `status=${selectedStatus}&`;
      if (selectedLocation) url += `location=${selectedLocation}&`;
      if (selectedBookable) url += `is_bookable=${selectedBookable}&`;

      const data = await apiFetch(url);
      setAssets(data.assets);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load assets");
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      await fetchAssets();
      const catsData = await apiFetch("/org/categories");
      setCategories(catsData.categories);
    } catch (err: any) {
      showToast("error", err.message || "Initialization failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [search, selectedCat, selectedStatus, selectedLocation, selectedBookable]);

  const activeCategory = categories.find((c) => c.id === catId);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name,
        category_id: Number(catId),
        serial_number: serial || null,
        acquisition_date: acqDate,
        acquisition_cost: Number(acqCost),
        condition,
        location,
        is_bookable: isBookable,
        photo_url: photoUrl || null,
      };

      await apiFetch("/assets", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showToast("success", "Asset registered successfully!");
      setShowRegModal(false);
      resetForm();
      fetchAssets();
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const resetForm = () => {
    setName("");
    setCatId("");
    setSerial("");
    setAcqDate(new Date().toISOString().split("T")[0]);
    setAcqCost("");
    setCondition("New");
    setLocation("");
    setIsBookable(false);
    setPhotoUrl("");
    setCustomFieldValues({});
  };

  // Open asset profile drawer & load details
  const handleOpenProfile = async (asset: Asset) => {
    setActiveProfileAsset(asset);
    setHistoryLoading(true);
    try {
      const history = await apiFetch(`/assets/${asset.id}/history`);
      setAllocHistory(history.allocations);
      setBookHistory(history.bookings);
      setMaintHistory(history.maintenance);
      setAuditHistory(history.audits);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Available":
        return <span className="badge badge-success" style={{ borderRadius: "12px", padding: "3px 10px" }}>Available</span>;
      case "Allocated":
        return <span className="badge badge-info" style={{ borderRadius: "12px", padding: "3px 10px" }}>Allocated</span>;
      case "Reserved":
        return <span className="badge badge-warning" style={{ borderRadius: "12px", padding: "3px 10px" }}>Reserved</span>;
      case "UnderMaintenance":
        return <span className="badge badge-danger" style={{ borderRadius: "12px", padding: "3px 10px" }}>Maintenance</span>;
      case "Lost":
        return <span className="badge badge-danger" style={{ borderRadius: "12px", padding: "3px 10px", backgroundColor: "#FFE4E6", color: "#9F1239", border: "1px solid #FDA4AF" }}>Lost</span>;
      case "Retired":
        return <span className="badge badge-muted" style={{ borderRadius: "12px", padding: "3px 10px" }}>Retired</span>;
      case "Disposed":
        return <span className="badge badge-muted" style={{ borderRadius: "12px", padding: "3px 10px", backgroundColor: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB" }}>Disposed</span>;
      default:
        return <span className="badge badge-muted" style={{ borderRadius: "12px", padding: "3px 10px" }}>{status}</span>;
    }
  };

  return (
    <div className="animate-fade">
      {/* 1. Filtering & Registration Action Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "10px", width: "100%", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
            <Search size={18} style={{ position: "absolute", left: "14px", top: "14px", color: "var(--text-muted)" }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: "42px" }}
              placeholder="Search by tag, serial, or QR code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" onClick={() => setShowRegModal(true)}>
            <Plus size={16} /> Register Asset
          </button>
        </div>

        {/* Filters Row */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <select className="form-control" style={{ width: "160px", fontWeight: 600 }} value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)}>
            <option value="">Category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select className="form-control" style={{ width: "140px", fontWeight: 600 }} value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="">Status</option>
            <option value="Available">Available</option>
            <option value="Allocated">Allocated</option>
            <option value="Reserved">Reserved</option>
            <option value="UnderMaintenance">Maintenance</option>
            <option value="Lost">Lost</option>
            <option value="Retired">Retired</option>
            <option value="Disposed">Disposed</option>
          </select>

          <select className="form-control" style={{ width: "160px", fontWeight: 600 }} value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}>
            <option value="">Department</option>
            <option value="bengaluru">bengaluru</option>
            <option value="HQ Floor 2">HQ Floor 2</option>
            <option value="Warehouse">Warehouse</option>
          </select>
        </div>
      </div>

      {/* 2. Directory Listing */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>Loading inventory...</div>
      ) : assets.length === 0 ? (
        <div className="card" style={{ padding: "80px", textAlign: "center", color: "var(--text-muted)" }}>
          <Box size={48} style={{ marginBottom: "16px", opacity: 0.5 }} />
          <div>No physical assets match the search query.</div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table-el">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Name</th>
                <th>Category</th>
                <th>Status</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id} style={{ cursor: "pointer" }} onClick={() => handleOpenProfile(asset)}>
                  <td style={{ fontWeight: 600, color: "var(--accent-primary)" }}>
                    {asset.asset_tag}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{asset.name}</div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>S/N: {asset.serial_number || "None"}</span>
                  </td>
                  <td>{asset.category_name}</td>
                  <td>{getStatusBadge(asset.status)}</td>
                  <td>{asset.location}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenProfile(asset);
                      }}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. REGISTRATION MODAL */}
      {showRegModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: "16px", fontWeight: 700 }}>Register Physical Asset</h3>
              <button
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px" }}
                onClick={() => setShowRegModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleRegisterSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Asset Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. MacBook Pro 16-inch, Height-Adjustable Desk"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Asset Category</label>
                    <select
                      className="form-control"
                      value={catId}
                      onChange={(e) => setCatId(e.target.value ? Number(e.target.value) : "")}
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Serial Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. C02F5XX1MD6M"
                      value={serial}
                      onChange={(e) => setSerial(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Acquisition Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={acqDate}
                      onChange={(e) => setAcqDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Acquisition Cost (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="e.g. 2499.00"
                      value={acqCost}
                      onChange={(e) => setAcqCost(e.target.value ? Number(e.target.value) : "")}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Physical Condition</label>
                    <select className="form-control" value={condition} onChange={(e) => setCondition(e.target.value as any)}>
                      <option value="New">New</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                      <option value="Damaged">Damaged</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Current Storage Location</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Warehouse A, Room 302"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px" }}>
                  <input
                    id="is_bookable"
                    type="checkbox"
                    style={{ width: "18px", height: "18px", accentColor: "var(--accent-primary)" }}
                    checked={isBookable}
                    onChange={(e) => setIsBookable(e.target.checked)}
                  />
                  <label htmlFor="is_bookable" className="form-label" style={{ margin: 0, cursor: "pointer" }}>
                    Designate this asset as a bookable resource
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRegModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. SLIDING ASSET PROFILE DRAWER */}
      {activeProfileAsset && (
        <div className="modal-overlay" onClick={() => setActiveProfileAsset(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              right: 0,
              top: 0,
              height: "100vh",
              width: "520px",
              borderRadius: 0,
              animation: "slideUp 0.3s ease-out",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Drawer Header */}
            <div className="modal-header" style={{ padding: "20px 24px" }}>
              <div>
                <h3 style={{ fontSize: "17px", fontWeight: 700 }}>Asset Profile Ledger</h3>
                <span style={{ fontSize: "12px", color: "var(--accent-primary)", fontWeight: 700 }}>
                  {activeProfileAsset.asset_tag}
                </span>
              </div>
              <button
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px" }}
                onClick={() => setActiveProfileAsset(null)}
              >
                ×
              </button>
            </div>

            {/* Drawer Body */}
            <div className="modal-body" style={{ flex: 1, padding: "24px" }}>
              {/* Photo & QR Code visual card row */}
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  padding: "16px",
                  marginBottom: "20px",
                  alignItems: "center",
                }}
              >
                {/* Visual Mock Photo */}
                <div
                  style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "6px",
                    backgroundColor: "var(--border-color)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-secondary)",
                    fontSize: "24px",
                    fontWeight: 700,
                  }}
                >
                  <Box size={36} color="var(--accent-primary)" />
                </div>

                {/* QR Code mock representation */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>{activeProfileAsset.name}</div>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    Value: ${Number(activeProfileAsset.acquisition_cost).toLocaleString()}
                  </span>
                  <div style={{ marginTop: "6px" }}>{getStatusBadge(activeProfileAsset.status)}</div>
                </div>

                {/* Simulated interactive QR block */}
                <div
                  style={{
                    padding: "8px",
                    backgroundColor: "white",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "2px",
                  }}
                  onClick={() => alert(`Simulated scanning QR code: ${activeProfileAsset.asset_tag}`)}
                  title="Click to download mock QR"
                >
                  <QrCode size={36} color="var(--text-primary)" />
                  <span style={{ fontSize: "8px", fontWeight: 700, color: "var(--text-secondary)" }}>QR SCAN</span>
                </div>
              </div>

              {/* Details table list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--bg-tertiary)", paddingBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Location:</span>
                  <strong style={{ color: "var(--text-primary)" }}>{activeProfileAsset.location}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--bg-tertiary)", paddingBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Serial Number:</span>
                  <strong style={{ color: "var(--text-primary)" }}>{activeProfileAsset.serial_number || "None"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--bg-tertiary)", paddingBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Acquisition Date:</span>
                  <strong style={{ color: "var(--text-primary)" }}>{new Date(activeProfileAsset.acquisition_date).toLocaleDateString()}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--bg-tertiary)", paddingBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Condition:</span>
                  <strong style={{ color: "var(--text-primary)" }}>{activeProfileAsset.condition}</strong>
                </div>
              </div>

              {/* Documents Mock list */}
              <div style={{ marginBottom: "24px" }}>
                <h4 style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "10px" }}>Attachments & Documentation</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    { file: "acquisition_invoice.pdf", size: "484 KB" },
                    { file: "device_user_manual.pdf", size: "1.2 MB" },
                  ].map((doc, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: "12.5px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)" }}>
                        <FileText size={14} color="var(--accent-primary)" />
                        <span>{doc.file}</span>
                      </div>
                      <span style={{ color: "var(--text-muted)" }}>{doc.size}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs trigger for timelines */}
              <div className="tabs-container" style={{ marginBottom: "14px" }}>
                <ul className="tabs-list" style={{ display: "flex", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px", gap: "10px", listStyle: "none" }}>
                  <li>
                    <button className={`tab-trigger ${profileTab === "alloc" ? "active" : ""}`} onClick={() => setProfileTab("alloc")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12.5px", fontWeight: 600, color: profileTab === "alloc" ? "var(--accent-primary)" : "var(--text-secondary)" }}>
                      Custody
                    </button>
                  </li>
                  <li>
                    <button className={`tab-trigger ${profileTab === "book" ? "active" : ""}`} onClick={() => setProfileTab("book")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12.5px", fontWeight: 600, color: profileTab === "book" ? "var(--accent-primary)" : "var(--text-secondary)" }}>
                      Bookings
                    </button>
                  </li>
                  <li>
                    <button className={`tab-trigger ${profileTab === "maint" ? "active" : ""}`} onClick={() => setProfileTab("maint")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12.5px", fontWeight: 600, color: profileTab === "maint" ? "var(--accent-primary)" : "var(--text-secondary)" }}>
                      Repairs
                    </button>
                  </li>
                </ul>
              </div>

              {/* Tab views content */}
              {historyLoading ? (
                <div style={{ textAlign: "center", padding: "20px", fontSize: "12.5px", color: "var(--text-secondary)" }}>Loading history...</div>
              ) : (
                <div style={{ overflowY: "auto", maxHeight: "180px", fontSize: "12.5px" }}>
                  {profileTab === "alloc" && (
                    allocHistory.length === 0 ? (
                      <div style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "16px" }}>No checkouts logged.</div>
                    ) : (
                      allocHistory.map((h) => (
                        <div key={h.id} style={{ borderBottom: "1px solid var(--bg-tertiary)", paddingBottom: "6px", marginBottom: "6px" }}>
                          <strong>Custodian:</strong> {h.employee_name || `Dept: ${h.department_name}`} <br />
                          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                            Allocated: {new Date(h.allocated_date).toLocaleDateString()}
                            {h.actual_return_date ? ` • Returned: ${new Date(h.actual_return_date).toLocaleDateString()}` : " (Active)"}
                          </span>
                        </div>
                      ))
                    )
                  )}

                  {profileTab === "book" && (
                    bookHistory.length === 0 ? (
                      <div style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "16px" }}>No booking records found.</div>
                    ) : (
                      bookHistory.map((h) => (
                        <div key={h.id} style={{ borderBottom: "1px solid var(--bg-tertiary)", paddingBottom: "6px", marginBottom: "6px" }}>
                          <strong>Reserved by:</strong> {h.booked_by_name} <br />
                          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                            Range: {new Date(h.start_time).toLocaleString([], { dateStyle: "short", timeStyle: "short" })} - {new Date(h.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      ))
                    )
                  )}

                  {profileTab === "maint" && (
                    maintHistory.length === 0 ? (
                      <div style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "16px" }}>No incident tickets logged.</div>
                    ) : (
                      maintHistory.map((h) => (
                        <div key={h.id} style={{ borderBottom: "1px solid var(--bg-tertiary)", paddingBottom: "6px", marginBottom: "6px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <strong>{h.issue_description}</strong>
                            <span className="badge badge-muted" style={{ fontSize: "9px" }}>{h.status}</span>
                          </div>
                          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                            Tech Assigned: {h.technician_name || "Unassigned"}
                          </span>
                        </div>
                      ))
                    )
                  )}
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="modal-footer" style={{ borderTop: "1px solid var(--border-color)" }}>
              <button className="btn btn-secondary btn-full" onClick={() => setActiveProfileAsset(null)}>
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

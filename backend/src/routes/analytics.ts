import { Router, Response } from "express";
import db from "../config/db";
import { authenticateJWT, AuthenticatedRequest } from "../middleware/auth";
import { createNotification } from "../utils/activity";

const router = Router();

/**
 * Sweeper function to auto-detect and flag overdue allocations and bookings.
 * This runs dynamically on dashboard loading to ensure data integrity without relying on manual cron triggers.
 */
async function sweepOverdueRecords() {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const now = new Date().toISOString();

  try {
    await db.transaction(async (trx) => {
      // 1. Identify active allocations that are past expected return date
      const overdueAllocations = await trx("asset_allocations")
        .select("asset_allocations.id", "asset_allocations.employee_id", "assets.name as asset_name", "assets.asset_tag")
        .join("assets", "asset_allocations.asset_id", "assets.id")
        .where("asset_allocations.status", "Active")
        .where("asset_allocations.expected_return_date", "<", today);

      if (overdueAllocations.length > 0) {
        const ids = overdueAllocations.map((a) => a.id);
        
        // Update allocation statuses to Overdue
        await trx("asset_allocations")
          .whereIn("id", ids)
          .update({ status: "Overdue", updated_at: trx.fn.now() });

        // Notify each employee
        for (const alloc of overdueAllocations) {
          if (alloc.employee_id) {
            await createNotification(
              alloc.employee_id,
              "Allocation",
              `ALERT: Your allocation for asset '${alloc.asset_name}' (${alloc.asset_tag}) is OVERDUE! Please return it immediately.`
            );
          }
        }
      }

      // 2. Identify bookings that have passed their end time and set them to Completed
      // (Optionally flag Ongoing bookings whose start_time has passed)
      await trx("resource_bookings")
        .whereIn("status", ["Upcoming", "Ongoing"])
        .where("end_time", "<", now)
        .update({ status: "Completed", updated_at: trx.fn.now() });

      // Auto-start upcoming bookings (if start_time < now and end_time > now)
      await trx("resource_bookings")
        .where("status", "Upcoming")
        .where("start_time", "<=", now)
        .where("end_time", ">", now)
        .update({ status: "Ongoing", updated_at: trx.fn.now() });
    });
  } catch (error) {
    console.error("Error sweeping overdue records:", error);
  }
}

// GET dashboard KPIs & general overview
router.get("/dashboard", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    // 1. Sweep database for overdue states first
    await sweepOverdueRecords();

    // 2. Query KPIs
    const assetStats = await db("assets")
      .select("status")
      .count("id as count")
      .groupBy("status");

    // Format stats list to key-value pairs
    const stats: Record<string, number> = {
      Available: 0,
      Allocated: 0,
      Reserved: 0,
      UnderMaintenance: 0,
      Lost: 0,
      Retired: 0,
      Disposed: 0,
    };
    assetStats.forEach((row: any) => {
      stats[row.status] = parseInt(row.count);
    });

    const activeBookings = await db("resource_bookings")
      .whereIn("status", ["Upcoming", "Ongoing"])
      .count("id as count")
      .first();

    const pendingTransfers = await db("transfer_requests")
      .where("status", "Requested")
      .count("id as count")
      .first();

    const overdueAllocationsCount = await db("asset_allocations")
      .where("status", "Overdue")
      .count("id as count")
      .first();

    const pendingMaintenanceCount = await db("maintenance_requests")
      .whereIn("status", ["Pending", "Approved", "TechnicianAssigned", "InProgress"])
      .count("id as count")
      .first();

    // 3. Fetch overdue items details
    const overdueItems = await db("asset_allocations")
      .select(
        "asset_allocations.*",
        "assets.name as asset_name",
        "assets.asset_tag",
        "employees.name as employee_name",
        "employees.email as employee_email"
      )
      .join("assets", "asset_allocations.asset_id", "assets.id")
      .leftJoin("employees", "asset_allocations.employee_id", "employees.id")
      .where("asset_allocations.status", "Overdue")
      .orderBy("asset_allocations.expected_return_date", "asc")
      .limit(10);

    // 4. Fetch recent activity log
    const recentActivity = await db("activity_logs")
      .select(
        "activity_logs.*",
        "employees.name as employee_name"
      )
      .leftJoin("employees", "activity_logs.employee_id", "employees.id")
      .orderBy("activity_logs.timestamp", "desc")
      .limit(8);

    return res.json({
      kpis: {
        assetsAvailable: stats.Available,
        assetsAllocated: stats.Allocated,
        assetsUnderMaintenance: stats.UnderMaintenance,
        activeBookings: parseInt(String(activeBookings?.count || 0)),
        pendingTransfers: parseInt(String(pendingTransfers?.count || 0)),
        overdueAllocations: parseInt(String(overdueAllocationsCount?.count || 0)),
        pendingMaintenance: parseInt(String(pendingMaintenanceCount?.count || 0)),
      },
      overdueItems,
      recentActivity,
    });
  } catch (error) {
    console.error("Dashboard analytics error:", error);
    return res.status(500).json({ error: "Internal server error calculating dashboard metrics" });
  }
});

// GET advanced utilization trends and metrics (Reports page)
router.get("/reports", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    // 1. Department Allocation Breakdown (valuation & count)
    const departmentSummary = await db("asset_allocations")
      .select(
        "departments.id as department_id",
        "departments.name as department_name"
      )
      .count("assets.id as asset_count")
      .sum("assets.acquisition_cost as total_valuation")
      .join("assets", "asset_allocations.asset_id", "assets.id")
      .join("departments", "asset_allocations.department_id", "departments.id")
      .where("asset_allocations.status", "Active")
      .groupBy("departments.id", "departments.name");

    // 2. Category allocation rate
    const categorySummary = await db("assets")
      .select(
        "asset_categories.id as category_id",
        "asset_categories.name as category_name"
      )
      .count("assets.id as total_count")
      .select(db.raw("COUNT(CASE WHEN assets.status IN ('Allocated', 'Reserved') THEN 1 END) as allocated_count"))
      .join("asset_categories", "assets.category_id", "asset_categories.id")
      .groupBy("asset_categories.id", "asset_categories.name");

    // 3. Maintenance frequency by category
    const maintenanceSummary = await db("maintenance_requests")
      .select(
        "asset_categories.name as category_name"
      )
      .count("maintenance_requests.id as request_count")
      .join("assets", "maintenance_requests.asset_id", "assets.id")
      .join("asset_categories", "assets.category_id", "asset_categories.id")
      .groupBy("asset_categories.name");

    // 4. Monthly acquisition trends (past 6 months)
    const acquisitionTrends = await db("assets")
      .select(db.raw("TO_CHAR(acquisition_date, 'YYYY-MM') as month"))
      .count("id as count")
      .sum("acquisition_cost as total_cost")
      .groupBy(db.raw("TO_CHAR(acquisition_date, 'YYYY-MM')"))
      .orderBy(db.raw("TO_CHAR(acquisition_date, 'YYYY-MM')"), "desc")
      .limit(6);

    return res.json({
      departmentSummary,
      categorySummary: categorySummary.map((c: any) => ({
        ...c,
        utilization_rate: c.total_count > 0 
          ? Math.round((parseInt(c.allocated_count) / parseInt(c.total_count)) * 100) 
          : 0,
      })),
      maintenanceSummary,
      acquisitionTrends,
    });
  } catch (error) {
    console.error("Fetch reports error:", error);
    return res.status(500).json({ error: "Internal server error generating analytics reports" });
  }
});

// GET activity log trail
router.get("/activity-logs", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const list = await db("activity_logs")
      .select(
        "activity_logs.*",
        "employees.name as employee_name",
        "employees.email as employee_email"
      )
      .leftJoin("employees", "activity_logs.employee_id", "employees.id")
      .orderBy("activity_logs.timestamp", "desc")
      .limit(100); // return recent 100 logs

    return res.json({ logs: list });
  } catch (error) {
    console.error("Fetch activity logs error:", error);
    return res.status(500).json({ error: "Internal server error fetching activity logs" });
  }
});

// POST AI Copilot conversational queries
router.post("/copilot", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const text = prompt.toLowerCase().trim();

    // 1. "Who has asset/laptop AF-XXXX?"
    const assetTagMatch = text.match(/af-\d+/i);
    if (assetTagMatch && (text.includes("who has") || text.includes("custodian") || text.includes("owner") || text.includes("find"))) {
      const tag = assetTagMatch[0].toUpperCase();

      const asset = await db("assets")
        .select(
          "assets.name",
          "assets.asset_tag",
          "assets.status",
          "assets.location",
          "employees.name as employee_name",
          "employees.email as employee_email",
          "departments.name as department_name",
          "asset_allocations.allocated_date"
        )
        .leftJoin("asset_allocations", function () {
          this.on("assets.id", "asset_allocations.asset_id").andOn(
            "asset_allocations.status",
            db.raw("'Active'")
          );
        })
        .leftJoin("employees", "asset_allocations.employee_id", "employees.id")
        .leftJoin("departments", "asset_allocations.department_id", "departments.id")
        .whereRaw("UPPER(assets.asset_tag) = ?", [tag])
        .first();

      if (!asset) {
        return res.json({ reply: `I searched the registry but couldn't find any asset with the tag **${tag}**.` });
      }

      if (asset.status === "Allocated") {
        if (asset.employee_name) {
          const dateStr = new Date(asset.allocated_date).toLocaleDateString();
          return res.json({
            reply: `Asset **${asset.name} (${asset.asset_tag})** is currently allocated to **${asset.employee_name}** (${asset.employee_email}) since **${dateStr}**.`
          });
        } else if (asset.department_name) {
          const dateStr = new Date(asset.allocated_date).toLocaleDateString();
          return res.json({
            reply: `Asset **${asset.name} (${asset.asset_tag})** is allocated to the **${asset.department_name}** department since **${dateStr}**.`
          });
        }
      }

      return res.json({
        reply: `Asset **${asset.name} (${asset.asset_tag})** is currently **${asset.status}** and stored at **${asset.location}**.`
      });
    }

    // 2. "Show overdue returns" / "overdue"
    if (text.includes("overdue") || text.includes("late")) {
      const overdue = await db("asset_allocations")
        .select(
          "assets.name",
          "assets.asset_tag",
          "employees.name as employee_name",
          "asset_allocations.expected_return_date"
        )
        .join("assets", "asset_allocations.asset_id", "assets.id")
        .leftJoin("employees", "asset_allocations.employee_id", "employees.id")
        .where("asset_allocations.status", "Overdue")
        .limit(10);

      if (overdue.length === 0) {
        return res.json({ reply: "Great news! There are currently **no overdue asset allocations** registered in the system." });
      }

      const listStr = overdue
        .map(
          (o) =>
            `- **${o.name} (${o.asset_tag})** held by *${o.employee_name || "Department"}* (Due: ${new Date(o.expected_return_date).toLocaleDateString()})`
        )
        .join("\n");

      return res.json({
        reply: `Found **${overdue.length}** overdue returns:\n\n${listStr}`
      });
    }

    // 3. "Find available projectors" / "available bookable"
    if (text.includes("available") || text.includes("bookable") || text.includes("projector") || text.includes("room")) {
      const available = await db("assets")
        .select("name", "asset_tag", "location", "status")
        .where("status", "Available")
        .andWhere("is_bookable", true)
        .limit(8);

      if (available.length === 0) {
        return res.json({ reply: "I searched the registry but there are **no available bookable resources** (like projectors or meeting rooms) right now." });
      }

      const listStr = available.map((a) => `- **${a.name} (${a.asset_tag})** located at *${a.location}*`).join("\n");

      return res.json({
        reply: `Here are the available bookable resources I found:\n\n${listStr}`
      });
    }

    // 4. "Assets needing maintenance" / "maintenance"
    if (text.includes("maintenance") || text.includes("repair") || text.includes("broken")) {
      const repairs = await db("maintenance_requests")
        .select(
          "assets.name",
          "assets.asset_tag",
          "maintenance_requests.issue_description",
          "maintenance_requests.priority",
          "maintenance_requests.status"
        )
        .join("assets", "maintenance_requests.asset_id", "assets.id")
        .whereNotIn("maintenance_requests.status", ["Resolved", "Rejected"])
        .limit(8);

      if (repairs.length === 0) {
        return res.json({ reply: "There are currently **no active maintenance tickets** in the queue. All assets are operating normally!" });
      }

      const listStr = repairs
        .map(
          (r) =>
            `- **${r.name} (${r.asset_tag})**: *${r.issue_description}* [Priority: **${r.priority}**, Status: *${r.status}*]`
        )
        .join("\n");

      return res.json({
        reply: `There are **${repairs.length}** active maintenance requests:\n\n${listStr}`
      });
    }

    // Default conversational helper response
    return res.json({
      reply: `I am the **AssetFlow AI Copilot**. I can fetch real-time database results using natural language. Try asking me:

1. 🔍 *'Who has Laptop AF-0001?'*
2. ⚠️ *'Show overdue returns'*
3. 🗓️ *'Find available bookable resources'*
4. 🔧 *'List assets needing maintenance'*`
    });
  } catch (error) {
    console.error("Copilot error:", error);
    return res.status(500).json({ error: "Internal server error in AI Copilot" });
  }
});

export default router;
export { sweepOverdueRecords };


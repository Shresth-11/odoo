import { Router, Response } from "express";
import db from "../config/db";
import { authenticateJWT, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

// GET all notifications for current employee
router.get("/", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const list = await db("notifications")
      .where({ employee_id: req.user!.id })
      .orderBy("created_at", "desc")
      .limit(50); // limit to recent 50

    return res.json({ notifications: list });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return res.status(500).json({ error: "Internal server error fetching notifications" });
  }
});

// POST mark single notification as read
router.post("/:id/read", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const notification = await db("notifications")
      .where({ id, employee_id: req.user!.id })
      .first();

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    await db("notifications")
      .where({ id })
      .update({ is_read: true });

    return res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Read notification error:", error);
    return res.status(500).json({ error: "Internal server error marking notification as read" });
  }
});

// POST mark all notifications as read
router.post("/read-all", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    await db("notifications")
      .where({ employee_id: req.user!.id, is_read: false })
      .update({ is_read: true });

    return res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Read all notifications error:", error);
    return res.status(500).json({ error: "Internal server error marking all notifications as read" });
  }
});

export default router;

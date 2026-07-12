import db from "../config/db";

/**
 * Logs an action in the system activity trail
 */
export async function logActivity(
  employeeId: number | null,
  action: string,
  entityType: string,
  entityId: number
): Promise<void> {
  try {
    await db("activity_logs").insert({
      employee_id: employeeId,
      action,
      entity_type: entityType,
      entity_id: entityId,
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

/**
 * Creates a system notification for a specific employee
 */
export async function createNotification(
  employeeId: number,
  type: string,
  message: string
): Promise<void> {
  try {
    await db("notifications").insert({
      employee_id: employeeId,
      type,
      message,
      is_read: false,
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

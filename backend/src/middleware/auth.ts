import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import db from "../config/db";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretjwtkeyforassetflowerp2026";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    name: string;
    email: string;
    role: "Admin" | "AssetManager" | "DepartmentHead" | "Employee";
    department_id: number | null;
  };
}

export async function authenticateJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access token is missing or invalid" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };

    // Fetch employee from database to ensure they still exist and are active
    const employee = await db("employees")
      .where({ id: decoded.id })
      .first();

    if (!employee) {
      return res.status(401).json({ error: "User no longer exists" });
    }

    if (employee.status !== "Active") {
      return res.status(403).json({ error: `Account is ${employee.status.toLowerCase()}` });
    }

    req.user = {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      department_id: employee.department_id,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "Session expired or invalid token" });
  }
}

export function requireRole(allowedRoles: ("Admin" | "AssetManager" | "DepartmentHead" | "Employee")[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Role '${req.user.role}' does not have permission to perform this action.`,
      });
    }

    next();
  };
}

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

import db from "./config/db";

// Run database migrations and seeds automatically on startup
const runDbInitialization = async () => {
  try {
    console.log("[Database] Running migrations...");
    await db.migrate.latest({
      directory: path.join(__dirname, "./db/migrations"),
    });
    console.log("[Database] Running seeds...");
    await db.seed.run({
      directory: path.join(__dirname, "./db/seeds"),
    });
    console.log("[Database] Initialization and mock seeding completed!");
  } catch (error) {
    console.error("[Database] Failed to migrate or seed on startup:", error);
  }
};

runDbInitialization();

// Import routes
import authRouter from "./routes/auth";
import orgRouter from "./routes/org";
import assetsRouter from "./routes/assets";
import allocationsRouter from "./routes/allocations";
import bookingsRouter from "./routes/bookings";
import maintenanceRouter from "./routes/maintenance";
import auditsRouter from "./routes/audits";
import analyticsRouter from "./routes/analytics";
import notificationsRouter from "./routes/notifications";

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(
  cors({
    origin: "*", // Adjust for specific production domains if necessary
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body Parser Middleware
app.use(express.json());

// Bind REST routes
app.use("/api/auth", authRouter);
app.use("/api/org", orgRouter);
app.use("/api/assets", assetsRouter);
app.use("/api/allocations", allocationsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/maintenance", maintenanceRouter);
app.use("/api/audits", auditsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/notifications", notificationsRouter);

// Base route for connectivity checks
app.get("/", (req: Request, res: Response) => {
  return res.json({
    name: "AssetFlow ERP API",
    version: "1.0.0",
    status: "Healthy",
  });
});

// 404 Route handler
app.use((req: Request, res: Response) => {
  return res.status(404).json({ error: `Endpoint ${req.method} ${req.url} not found` });
});

// Global Error-Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled server error:", err);
  
  // Clean JSON response for client errors
  const statusCode = err.status || 500;
  return res.status(statusCode).json({
    error: err.message || "An unexpected system error occurred on the server.",
  });
});

// Launch Express Server
app.listen(PORT, () => {
  console.log(`[Server] AssetFlow ERP Backend is active on http://localhost:${PORT}`);
});

export default app;

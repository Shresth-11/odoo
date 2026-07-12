import { Router } from "express";
import { z } from "zod";
import { authenticateJWT, AuthenticatedRequest } from "../middleware/auth";
import BookingService from "../services/BookingService";

const router = Router();

// Zod schema for input validation
const bookingSchema = z.object({
  asset_id: z.number().int(),
  start_time: z.string().datetime("Start time must be a valid ISO datetime string"),
  end_time: z.string().datetime("End time must be a valid ISO datetime string"),
});

// GET all bookings (with optional filters)
router.get("/", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { asset_id, status, start, end } = req.query;
    const bookings = await BookingService.listBookings(
      req.user!.role,
      req.user!.id,
      req.user!.department_id,
      { asset_id, status, start, end }
    );
    return res.json({ bookings });
  } catch (error) {
    console.error("Fetch bookings route error:", error);
    return res.status(500).json({ error: "Internal server error fetching bookings" });
  }
});

// POST create booking
router.post("/", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const data = bookingSchema.parse(req.body);
    const booking = await BookingService.createBooking(data, { id: req.user!.id, name: req.user!.name });
    return res.status(201).json({ message: "Booking created successfully", booking });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (
      error.message === "Start time must be before end time" ||
      error.message === "Booking start time cannot be in the past" ||
      error.message.includes("is not designated") ||
      error.message.includes("and cannot be booked") ||
      error.message.includes("already booked")
    ) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === "Asset not found") {
      return res.status(404).json({ error: error.message });
    }
    console.error("Create booking route error:", error);
    return res.status(500).json({ error: "Internal server error creating booking" });
  }
});

// POST cancel booking
router.post("/:id/cancel", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const booking = await BookingService.cancelBooking(id, {
      id: req.user!.id,
      name: req.user!.name,
      role: req.user!.role,
      department_id: req.user!.department_id,
    });
    return res.json({ message: "Booking cancelled successfully", booking });
  } catch (error: any) {
    if (error.message === "Booking not found") {
      return res.status(404).json({ error: error.message });
    }
    if (
      error.message === "Booking is already cancelled" ||
      error.message === "Cannot cancel a completed booking"
    ) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes("permission to cancel")) {
      return res.status(403).json({ error: error.message });
    }
    console.error("Cancel booking route error:", error);
    return res.status(500).json({ error: "Internal server error cancelling booking" });
  }
});

export default router;

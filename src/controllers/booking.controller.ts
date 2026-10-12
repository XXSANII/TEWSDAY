import { Request, Response, NextFunction } from 'express';
import { bookingService } from '../services/booking.service';

export async function createBookingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = req.actor.userId;
    const result = await bookingService.createBooking(studentId, req.body);
    return res.status(201).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function getUserBookingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.actor.userId;
    const result = await bookingService.getUserBookings(userId);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function getBookingByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await bookingService.getBookingById(id);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function uploadContractHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await bookingService.uploadContract(id, req.body);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function confirmBookingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await bookingService.confirmBooking(id);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function cancelBookingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await bookingService.cancelBooking(id, req.body);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

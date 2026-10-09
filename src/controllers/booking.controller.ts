import { Request, Response, NextFunction } from 'express';
import { bookingService } from '../services/booking.service';

export async function createBookingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = req.actor as { user_id?: string } | undefined;
    const studentId = actor?.user_id ?? 'std_mock_user';
    const result = await bookingService.createBooking(studentId, req.body);
    return res.status(201).json({ data: result });
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

export async function updateBookingStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await bookingService.updateBookingStatus(id, req.body);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

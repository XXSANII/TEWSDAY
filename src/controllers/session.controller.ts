import { Request, Response, NextFunction } from 'express';
import { sessionService } from '../services/session.service';

export async function createSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await sessionService.createSession(req.body);
    return res.status(201).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function getSessionsByBookingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const bookingId = req.query.booking_id as string;
    if (!bookingId) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Query parameter booking_id is required',
          timestamp: new Date().toISOString(),
        },
      });
    }
    const result = await sessionService.getSessionsByBooking(bookingId);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function updateSessionStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await sessionService.updateSessionStatus(id, req.body);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

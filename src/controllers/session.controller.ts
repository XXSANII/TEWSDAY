import { Request, Response, NextFunction } from 'express';
import { sessionService } from '../services/session.service';

export async function getSessionsByBookingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const bookingId = req.params.id as string;
    const result = await sessionService.getSessionsByBooking(bookingId);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function createSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const bookingId = req.params.id as string;
    const result = await sessionService.createSession(bookingId, req.body);
    return res.status(201).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function getSessionByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await sessionService.getSessionById(id);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function startSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await sessionService.startSession(id);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function completeSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await sessionService.completeSession(id, req.body);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function confirmAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await sessionService.confirmAttendance(id);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

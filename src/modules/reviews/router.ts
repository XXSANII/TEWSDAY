import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validate';
import {
  createReviewSchema,
  updateReviewSchema,
  getMyReviewsQuerySchema,
  getTutorReviewsQuerySchema,
} from './schemas';
import { ReviewService } from './service';

const router = Router();

// 1. POST /api/v1/sessions/:sessionId/reviews -> เขียนรีวิวคลาสเรียน (STUDENT / TUTOR)
router.post(
  '/sessions/:sessionId/reviews',
  authenticate,
  validateRequest(createReviewSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.params.sessionId as string;
      const review = await ReviewService.createSessionReview(sessionId, req.actor.userId, req.body);
      res.status(201).json({ success: true, data: review });
    } catch (err) {
      next(err);
    }
  },
);

// 2. GET /api/v1/sessions/:sessionId/my-review -> ดูรีวิวของตัวเองในคลาสนี้
router.get(
  '/sessions/:sessionId/my-review',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.params.sessionId as string;
      const result = await ReviewService.getMyReviewForSession(sessionId, req.actor.userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// 3. GET /api/v1/tutors/:tutorId/reviews -> ดึงรีวิวของติวเตอร์
router.get(
  '/tutors/:tutorId/reviews',
  validateRequest(getTutorReviewsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tutorId = req.params.tutorId as string;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const result = await ReviewService.getTutorReviews(tutorId, page, limit);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
);

// 4. GET /api/v1/reviews/my -> ดึงรีวิวของฉัน (?type=written | ?type=received)
router.get(
  '/reviews/my',
  authenticate,
  validateRequest(getMyReviewsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = (req.query.type as 'written' | 'received') || 'written';
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const result = await ReviewService.getMyReviews(req.actor.userId, type, page, limit);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
);

// 5. PATCH /api/v1/reviews/:id -> แก้ไขรีวิว
router.patch(
  '/reviews/:id',
  authenticate,
  validateRequest(updateReviewSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const review = await ReviewService.updateReview(id, req.actor.userId, req.body);
      res.json({ success: true, data: review });
    } catch (err) {
      next(err);
    }
  },
);

// 6. DELETE /api/v1/reviews/:id -> ลบรีวิว (Soft Delete)
router.delete(
  '/reviews/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const result = await ReviewService.deleteReview(id, req.actor.userId);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
);

export const reviewsRouter = router;
export default router;

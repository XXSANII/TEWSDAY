import crypto from 'crypto';
import { db } from '../../db';
import { guard } from '../../common/errors';
import { ReviewRepository } from './repository';
import type { CreateReviewInput, UpdateReviewInput } from './schemas';

export class ReviewService {
  /**
   * 1. เขียนรีวิวคลาสเรียน (รองรับทั้ง Student และ Tutor)
   */
  static async createSessionReview(
    sessionId: string,
    reviewerUserId: string,
    input: CreateReviewInput,
  ) {
    const session = await db.class_sessions.findUnique({
      where: { id: sessionId },
      include: {
        student_profiles: true,
        tutor_profiles: true,
      },
    });

    guard(Boolean(session && session.is_active), 404, 'NOT_FOUND', 'Class session not found');
    guard(
      session!.status === 'COMPLETED',
      400,
      'BAD_REQUEST',
      'Reviews can only be submitted for completed class sessions',
    );

    let reviewType: 'STUDENT_TO_TUTOR' | 'TUTOR_TO_STUDENT';
    let revieweeUserId: string;

    if (session!.student_profiles.user_id === reviewerUserId) {
      reviewType = 'STUDENT_TO_TUTOR';
      revieweeUserId = session!.tutor_profiles.user_id;
    } else if (session!.tutor_profiles.user_id === reviewerUserId) {
      reviewType = 'TUTOR_TO_STUDENT';
      revieweeUserId = session!.student_profiles.user_id;
    } else {
      guard(false, 403, 'FORBIDDEN', 'You are not a participant in this class session');
      reviewType = 'STUDENT_TO_TUTOR';
      revieweeUserId = '';
    }

    const existingReview = await ReviewRepository.findBySessionAndReviewer(
      sessionId,
      reviewerUserId,
    );
    guard(
      !existingReview,
      400,
      'BAD_REQUEST',
      'You have already submitted a review for this class session',
    );

    const reviewId = `rev_${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`;

    return ReviewRepository.create({
      id: reviewId,
      class_session_id: sessionId,
      reviewer_user_id: reviewerUserId,
      reviewee_user_id: revieweeUserId,
      review_type: reviewType,
      tutor_id: session!.tutor_id,
      rating_score: input.rating_score,
      comment: input.comment,
      created_by: reviewerUserId,
      updated_by: reviewerUserId,
    });
  }

  /**
   * 2. ดูรีวิวของตัวเองในคลาสนี้
   */
  static async getMyReviewForSession(sessionId: string, reviewerUserId: string) {
    const review = await ReviewRepository.findBySessionAndReviewer(sessionId, reviewerUserId);
    return {
      has_reviewed: !!review,
      review: review || null,
    };
  }

  /**
   * 3. ดึงรายการรีวิวของติวเตอร์
   */
  static async getTutorReviews(tutorId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [reviews, total, aggregate] = await ReviewRepository.findByTutorId(tutorId, skip, limit);

    return {
      reviews,
      summary: {
        average_rating: aggregate._avg.rating_score ?? 0,
        total_reviews: aggregate._count.rating_score ?? 0,
      },
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 4. ดึงรีวิวของฉัน (written / received)
   */
  static async getMyReviews(userId: string, type: 'written' | 'received', page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [reviews, total] =
      type === 'written'
        ? await ReviewRepository.findByReviewerUserId(userId, skip, limit)
        : await ReviewRepository.findByRevieweeUserId(userId, skip, limit);

    return {
      reviews,
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 5. แก้ไขรีวิว
   */
  static async updateReview(reviewId: string, userId: string, input: UpdateReviewInput) {
    const review = await ReviewRepository.findById(reviewId);

    guard(Boolean(review), 404, 'NOT_FOUND', 'Review not found');
    guard(
      review!.reviewer_user_id === userId,
      403,
      'FORBIDDEN',
      'You can only edit your own review',
    );

    return ReviewRepository.update(reviewId, {
      ...input,
      updated_by: userId,
    });
  }

  /**
   * 6. ลบรีวิว (Soft Delete)
   */
  static async deleteReview(reviewId: string, userId: string) {
    const review = await ReviewRepository.findById(reviewId);

    guard(Boolean(review), 404, 'NOT_FOUND', 'Review not found');
    guard(
      review!.reviewer_user_id === userId,
      403,
      'FORBIDDEN',
      'You can only delete your own review',
    );

    await ReviewRepository.softDelete(reviewId, userId);
    return { message: 'Review deleted successfully' };
  }
}

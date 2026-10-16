import { Prisma } from '@prisma/client';
import { db } from '../../db';

export class ReviewRepository {
  /**
   * สร้าง Record รีวิวใหม่
   */
  static async create(data: Prisma.reviewsUncheckedCreateInput) {
    return db.reviews.create({ data });
  }

  /**
   * ค้นหารีวิวตาม ID (เฉพาะรายการที่ active)
   */
  static async findById(id: string) {
    return db.reviews.findFirst({
      where: { id, is_active: true },
    });
  }

  /**
   * ตรวจสอบรีวิวเฉพาะรอบการสอนและผู้เขียน
   */
  static async findBySessionAndReviewer(classSessionId: string, reviewerUserId: string) {
    return db.reviews.findFirst({
      where: {
        class_session_id: classSessionId,
        reviewer_user_id: reviewerUserId,
        is_active: true,
      },
    });
  }

  /**
   * ดึงรายการรีวิวของติวเตอร์ (เฉพาะฝั่ง STUDENT_TO_TUTOR ที่ publishes และ active)
   */
  static async findByTutorId(tutorId: string, skip: number, take: number) {
    const whereCondition: Prisma.reviewsWhereInput = {
      tutor_id: tutorId,
      review_type: 'STUDENT_TO_TUTOR',
      is_published: true,
      is_active: true,
    };

    return Promise.all([
      db.reviews.findMany({
        where: whereCondition,
        include: {
          users_reviews_reviewer_user_idTousers: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
      db.reviews.count({ where: whereCondition }),
      db.reviews.aggregate({
        where: whereCondition,
        _avg: { rating_score: true },
        _count: { rating_score: true },
      }),
    ]);
  }

  /**
   * ดึงรีวิวที่ตนเองเป็นผู้เขียน (written)
   */
  static async findByReviewerUserId(reviewerUserId: string, skip: number, take: number) {
    const whereCondition: Prisma.reviewsWhereInput = {
      reviewer_user_id: reviewerUserId,
      is_active: true,
    };

    return Promise.all([
      db.reviews.findMany({
        where: whereCondition,
        include: {
          users_reviews_reviewee_user_idTousers: {
            select: { id: true, email: true },
          },
          class_sessions: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
      db.reviews.count({ where: whereCondition }),
    ]);
  }

  /**
   * ดึงรีวิวที่ตนเองเป็นผู้ได้รับ (received)
   */
  static async findByRevieweeUserId(revieweeUserId: string, skip: number, take: number) {
    const whereCondition: Prisma.reviewsWhereInput = {
      reviewee_user_id: revieweeUserId,
      is_published: true,
      is_active: true,
    };

    return Promise.all([
      db.reviews.findMany({
        where: whereCondition,
        include: {
          users_reviews_reviewer_user_idTousers: {
            select: { id: true, email: true },
          },
          class_sessions: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
      db.reviews.count({ where: whereCondition }),
    ]);
  }

  /**
   * อัปเดตข้อมูลรีวิว
   */
  static async update(id: string, data: Prisma.reviewsUncheckedUpdateInput) {
    return db.reviews.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft Delete รีวิว
   */
  static async softDelete(id: string, updatedBy: string) {
    return db.reviews.update({
      where: { id },
      data: {
        is_active: false,
        updated_by: updatedBy,
      },
    });
  }
}

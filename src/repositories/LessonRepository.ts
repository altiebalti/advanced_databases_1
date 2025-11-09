import { UnitOfWork } from '@/lib/unitOfWork';

export class LessonRepository {
  private uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async completeLesson(userId: number, lessonId: number): Promise<void> {
    await this.uow.query('CALL sp_complete_lesson($1,$2)', [userId, lessonId]);
  }
}



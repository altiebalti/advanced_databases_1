import { QueryResult } from 'pg';
import { UnitOfWork } from '@/lib/unitOfWork';

export class UserRepository {
  private uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async enrollUser(userId: number, courseId: number): Promise<void> {
    await this.uow.query('CALL sp_enroll_user($1,$2)', [userId, courseId]);
  }

  async getUserEnrollments(userId: number): Promise<QueryResult<any>> {
    return this.uow.query('SELECT * FROM v_user_enrollments WHERE user_id = $1', [userId]);
  }
}



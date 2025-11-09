import { QueryResult } from 'pg';
import { UnitOfWork } from '@/lib/unitOfWork';

export class CourseRepository {
  private uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async getActiveCourses(): Promise<QueryResult<any>> {
    return this.uow.query('SELECT * FROM v_active_courses');
  }

  async getCourseStats(): Promise<QueryResult<any>> {
    return this.uow.query('SELECT * FROM v_course_stats');
  }
}



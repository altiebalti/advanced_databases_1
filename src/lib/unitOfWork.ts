import { PoolClient, QueryResult, QueryResultRow } from 'pg';

export class UnitOfWork {
  private client: PoolClient | null = null;
  private inTransaction = false;

  constructor(client: PoolClient) {
    this.client = client;
  }

  async begin(): Promise<void> {
    if (!this.client) throw new Error('Client not available');
    if (this.inTransaction) return;
    await this.client.query('BEGIN');
    this.inTransaction = true;
  }

  async commit(): Promise<void> {
    if (!this.client || !this.inTransaction) return;
    await this.client.query('COMMIT');
    this.inTransaction = false;
  }

  async rollback(): Promise<void> {
    if (!this.client || !this.inTransaction) return;
    await this.client.query('ROLLBACK');
    this.inTransaction = false;
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.client) throw new Error('Client not available');
    return this.client.query<T>(text, params);
  }
}



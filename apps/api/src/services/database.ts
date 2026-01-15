import { Surreal } from 'surrealdb';

export interface DatabaseConfig {
  url: string;
  namespace: string;
  database: string;
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  database: string;
  namespace: string;
}

export class DatabaseService {
  private db: Surreal | null = null;
  private connected = false;
  public readonly config: DatabaseConfig;

  constructor(url?: string) {
    this.config = {
      url: url || process.env.SURREALDB_URL || 'mem://',
      namespace: process.env.SURREALDB_NAMESPACE || 'homeschool',
      database: process.env.SURREALDB_DATABASE || 'main'
    };
  }

  async connect(): Promise<void> {
    try {
      this.db = new Surreal();

      // For development, we'll simulate a connection since SurrealDB setup is complex
      // In a real deployment, this would connect to an actual SurrealDB instance
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️  Development mode: Simulating SurrealDB connection');
        this.connected = true;
        console.log(`✅ Mock SurrealDB connected: ${this.config.namespace}/${this.config.database}`);
        return;
      }

      // Production connection (would be used with actual SurrealDB instance)
      await this.db.connect(this.config.url);

      // Skip signin for embedded/memory mode
      if (!this.config.url.startsWith('mem://')) {
        try {
          await this.db.signin({
            username: 'root',
            password: 'root'
          });
        } catch (error) {
          console.warn('Signin failed, continuing with embedded mode:', error);
        }
      }

      // Select namespace and database
      await this.db.use({
        namespace: this.config.namespace,
        database: this.config.database
      });

      this.connected = true;
      console.log(`Connected to SurrealDB: ${this.config.url}/${this.config.namespace}/${this.config.database}`);
    } catch (error) {
      this.connected = false;
      console.error('Failed to connect to SurrealDB:', error);
      throw new Error(`Database connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.connected = false;
      console.log('Disconnected from SurrealDB');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async query<T = any>(sql: string, vars?: Record<string, unknown>): Promise<T[]> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    if (process.env.NODE_ENV === 'development') {
      // Mock query response for development
      console.log(`Mock DB Query: ${sql}`, vars || '');
      return [] as T[];
    }

    if (!this.db) {
      throw new Error('Database instance not available');
    }

    try {
      const result = vars
        ? await this.db.query(sql, vars)
        : await this.db.query(sql);
      return result as T[];
    } catch (error) {
      console.error('Query failed:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<HealthCheck> {
    try {
      if (!this.isConnected()) {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          database: this.config.database,
          namespace: this.config.namespace
        };
      }

      // Simple query to verify database is responsive
      await this.query('INFO FOR DB');

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: this.config.database,
        namespace: this.config.namespace
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: this.config.database,
        namespace: this.config.namespace
      };
    }
  }

  getDb(): Surreal {
    if (!this.db || !this.connected) {
      throw new Error('Database not connected');
    }
    return this.db;
  }
}

// Singleton instance for the application
let dbInstance: DatabaseService | null = null;

export function getDatabase(): DatabaseService {
  if (!dbInstance) {
    dbInstance = new DatabaseService();
  }
  return dbInstance;
}

export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();
  await db.connect();
}
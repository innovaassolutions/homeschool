import { DatabaseService, getDatabase } from './database';
import { ConversationContext, ConversationMessage, AgeGroup } from './chatgpt';
import winston from 'winston';

// Conversation memory data structures for SurrealDB
export interface ConversationSession {
  id?: string;
  child_id: string;
  session_id: string;
  subject: string;
  topic: string;
  age_group: AgeGroup;
  learning_style?: string;
  interests?: string[];
  accessibility_needs?: string[];
  created_at: Date;
  updated_at: Date;
  last_activity: Date;
  message_count: number;
  total_tokens_used: number;
  privacy_compliant: boolean;
}

export interface ConversationMessageRecord {
  id?: string;
  session_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  token_count?: number;
  filtered: boolean;
  age_appropriate: boolean;
  model_used?: string;
  response_time_ms?: number;
}

export interface ConversationStats {
  session_id: string;
  total_messages: number;
  total_tokens: number;
  avg_response_time: number;
  last_activity: Date;
  engagement_score: number;
}

export class ConversationMemoryService {
  private db: DatabaseService;
  private logger: winston.Logger;

  constructor(database: DatabaseService, logger: winston.Logger) {
    this.db = database;
    this.logger = logger;
  }

  /**
   * Initialize conversation memory tables in SurrealDB
   */
  async initializeTables(): Promise<void> {
    try {
      // Define conversation_sessions table
      await this.db.query(`
        DEFINE TABLE conversation_sessions SCHEMAFULL;
        DEFINE FIELD child_id ON conversation_sessions TYPE string ASSERT $value != NONE;
        DEFINE FIELD session_id ON conversation_sessions TYPE string ASSERT $value != NONE;
        DEFINE FIELD subject ON conversation_sessions TYPE string;
        DEFINE FIELD topic ON conversation_sessions TYPE string;
        DEFINE FIELD age_group ON conversation_sessions TYPE string ASSERT $value IN ['ages6to9', 'ages10to13', 'ages14to16'];
        DEFINE FIELD learning_style ON conversation_sessions TYPE option<string>;
        DEFINE FIELD interests ON conversation_sessions TYPE option<array<string>>;
        DEFINE FIELD accessibility_needs ON conversation_sessions TYPE option<array<string>>;
        DEFINE FIELD created_at ON conversation_sessions TYPE datetime DEFAULT time::now();
        DEFINE FIELD updated_at ON conversation_sessions TYPE datetime DEFAULT time::now();
        DEFINE FIELD last_activity ON conversation_sessions TYPE datetime DEFAULT time::now();
        DEFINE FIELD message_count ON conversation_sessions TYPE int DEFAULT 0;
        DEFINE FIELD total_tokens_used ON conversation_sessions TYPE int DEFAULT 0;
        DEFINE FIELD privacy_compliant ON conversation_sessions TYPE bool DEFAULT true;

        DEFINE INDEX session_idx ON conversation_sessions FIELDS session_id UNIQUE;
        DEFINE INDEX child_sessions_idx ON conversation_sessions FIELDS child_id, created_at;
      `);

      // Define conversation_messages table
      await this.db.query(`
        DEFINE TABLE conversation_messages SCHEMAFULL;
        DEFINE FIELD session_id ON conversation_messages TYPE string ASSERT $value != NONE;
        DEFINE FIELD role ON conversation_messages TYPE string ASSERT $value IN ['system', 'user', 'assistant'];
        DEFINE FIELD content ON conversation_messages TYPE string ASSERT $value != NONE;
        DEFINE FIELD timestamp ON conversation_messages TYPE datetime DEFAULT time::now();
        DEFINE FIELD token_count ON conversation_messages TYPE option<int>;
        DEFINE FIELD filtered ON conversation_messages TYPE bool DEFAULT false;
        DEFINE FIELD age_appropriate ON conversation_messages TYPE bool DEFAULT true;
        DEFINE FIELD model_used ON conversation_messages TYPE option<string>;
        DEFINE FIELD response_time_ms ON conversation_messages TYPE option<int>;

        DEFINE INDEX message_session_idx ON conversation_messages FIELDS session_id, timestamp;
        DEFINE INDEX message_role_idx ON conversation_messages FIELDS role;
      `);

      this.logger.info('Conversation memory tables initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize conversation memory tables:', error);
      throw error;
    }
  }

  /**
   * Create a new conversation session
   */
  async createSession(context: ConversationContext): Promise<ConversationSession> {
    try {
      const sessionData: Partial<ConversationSession> = {
        child_id: context.childId,
        session_id: context.sessionId,
        subject: context.subject,
        topic: context.topic,
        age_group: context.ageGroup,
        learning_style: context.learningStyle,
        interests: context.interests,
        accessibility_needs: context.accessibilityNeeds,
        created_at: new Date(),
        updated_at: new Date(),
        last_activity: new Date(),
        message_count: 0,
        total_tokens_used: 0,
        privacy_compliant: true
      };

      const result = await this.db.query(`
        CREATE conversation_sessions CONTENT $data
      `, { data: sessionData });

      const session = result[0] as ConversationSession;
      this.logger.info(`Created conversation session: ${context.sessionId}`);
      return session;
    } catch (error) {
      this.logger.error('Failed to create conversation session:', error);
      throw error;
    }
  }

  /**
   * Get conversation session by session ID
   */
  async getSession(sessionId: string): Promise<ConversationSession | null> {
    try {
      const result = await this.db.query(`
        SELECT * FROM conversation_sessions WHERE session_id = $sessionId
      `, { sessionId });

      return result.length > 0 ? result[0] as ConversationSession : null;
    } catch (error) {
      this.logger.error('Failed to get conversation session:', error);
      throw error;
    }
  }

  /**
   * Update session activity and stats
   */
  async updateSessionActivity(sessionId: string, tokensUsed: number = 0): Promise<void> {
    try {
      await this.db.query(`
        UPDATE conversation_sessions SET
          last_activity = time::now(),
          updated_at = time::now(),
          message_count = message_count + 1,
          total_tokens_used = total_tokens_used + $tokensUsed
        WHERE session_id = $sessionId
      `, { sessionId, tokensUsed });

      this.logger.debug(`Updated session activity: ${sessionId}`);
    } catch (error) {
      this.logger.error('Failed to update session activity:', error);
      throw error;
    }
  }

  /**
   * Store a conversation message
   */
  async storeMessage(
    sessionId: string,
    role: 'system' | 'user' | 'assistant',
    content: string,
    metadata?: {
      tokenCount?: number;
      filtered?: boolean;
      ageAppropriate?: boolean;
      modelUsed?: string;
      responseTimeMs?: number;
    }
  ): Promise<ConversationMessageRecord> {
    try {
      const messageData: Partial<ConversationMessageRecord> = {
        session_id: sessionId,
        role,
        content,
        timestamp: new Date(),
        token_count: metadata?.tokenCount,
        filtered: metadata?.filtered || false,
        age_appropriate: metadata?.ageAppropriate !== false,
        model_used: metadata?.modelUsed,
        response_time_ms: metadata?.responseTimeMs
      };

      const result = await this.db.query(`
        CREATE conversation_messages CONTENT $data
      `, { data: messageData });

      const message = result[0] as ConversationMessageRecord;

      // Update session activity
      await this.updateSessionActivity(sessionId, metadata?.tokenCount || 0);

      this.logger.debug(`Stored ${role} message for session: ${sessionId}`);
      return message;
    } catch (error) {
      this.logger.error('Failed to store conversation message:', error);
      throw error;
    }
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(
    sessionId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ConversationMessage[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM conversation_messages
        WHERE session_id = $sessionId
        ORDER BY timestamp ASC
        LIMIT $limit START $offset
      `, { sessionId, limit, offset });

      return result.map(record => ({
        role: record.role,
        content: record.content,
        timestamp: new Date(record.timestamp),
        tokenCount: record.token_count
      }));
    } catch (error) {
      this.logger.error('Failed to get conversation history:', error);
      throw error;
    }
  }

  /**
   * Get recent conversation history for context (last N messages)
   */
  async getRecentHistory(sessionId: string, maxMessages: number = 10): Promise<ConversationMessage[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM conversation_messages
        WHERE session_id = $sessionId
        AND role != 'system'
        ORDER BY timestamp DESC
        LIMIT $maxMessages
      `, { sessionId, maxMessages });

      // Reverse to get chronological order
      return result.reverse().map(record => ({
        role: record.role,
        content: record.content,
        timestamp: new Date(record.timestamp),
        tokenCount: record.token_count
      }));
    } catch (error) {
      this.logger.error('Failed to get recent conversation history:', error);
      throw error;
    }
  }

  /**
   * Build conversation context from stored session
   */
  async buildConversationContext(sessionId: string): Promise<ConversationContext | null> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return null;
      }

      const conversationHistory = await this.getRecentHistory(sessionId, 10);

      return {
        childId: session.child_id,
        ageGroup: session.age_group,
        subject: session.subject,
        topic: session.topic,
        learningStyle: session.learning_style,
        interests: session.interests,
        accessibilityNeeds: session.accessibility_needs,
        sessionId: session.session_id,
        conversationHistory
      };
    } catch (error) {
      this.logger.error('Failed to build conversation context:', error);
      throw error;
    }
  }

  /**
   * Get conversation statistics for a session
   */
  async getSessionStats(sessionId: string): Promise<ConversationStats | null> {
    try {
      const result = await this.db.query(`
        SELECT
          session_id,
          count() as total_messages,
          math::sum(token_count) as total_tokens,
          math::mean(response_time_ms) as avg_response_time,
          math::max(timestamp) as last_activity
        FROM conversation_messages
        WHERE session_id = $sessionId
        GROUP BY session_id
      `, { sessionId });

      if (result.length === 0) {
        return null;
      }

      const stats = result[0];
      return {
        session_id: sessionId,
        total_messages: stats.total_messages || 0,
        total_tokens: stats.total_tokens || 0,
        avg_response_time: stats.avg_response_time || 0,
        last_activity: new Date(stats.last_activity),
        engagement_score: this.calculateEngagementScore(stats)
      };
    } catch (error) {
      this.logger.error('Failed to get session stats:', error);
      throw error;
    }
  }

  /**
   * Get all sessions for a child
   */
  async getChildSessions(
    childId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ConversationSession[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM conversation_sessions
        WHERE child_id = $childId
        ORDER BY last_activity DESC
        LIMIT $limit START $offset
      `, { childId, limit, offset });

      return result as ConversationSession[];
    } catch (error) {
      this.logger.error('Failed to get child sessions:', error);
      throw error;
    }
  }

  /**
   * Delete old conversation sessions (privacy compliance)
   */
  async cleanupOldSessions(retentionDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // First delete associated messages
      await this.db.query(`
        DELETE FROM conversation_messages
        WHERE session_id IN (
          SELECT session_id FROM conversation_sessions
          WHERE last_activity < $cutoffDate
        )
      `, { cutoffDate: cutoffDate.toISOString() });

      // Then delete sessions
      const result = await this.db.query(`
        DELETE FROM conversation_sessions
        WHERE last_activity < $cutoffDate
        RETURN BEFORE
      `, { cutoffDate: cutoffDate.toISOString() });

      const deletedCount = result.length;
      this.logger.info(`Cleaned up ${deletedCount} old conversation sessions`);
      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup old sessions:', error);
      throw error;
    }
  }

  /**
   * Calculate engagement score based on conversation metrics
   */
  private calculateEngagementScore(stats: any): number {
    const messageCount = stats.total_messages || 0;
    const avgResponseTime = stats.avg_response_time || 0;

    // Simple engagement scoring algorithm
    // More messages = higher engagement
    // Faster responses = higher engagement
    let score = Math.min(messageCount * 10, 100); // Cap at 100 for message count

    // Bonus for quick responses (under 2 seconds)
    if (avgResponseTime > 0 && avgResponseTime < 2000) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  /**
   * Serialize conversation context for storage
   */
  serializeContext(context: ConversationContext): string {
    try {
      return JSON.stringify({
        childId: context.childId,
        ageGroup: context.ageGroup,
        subject: context.subject,
        topic: context.topic,
        learningStyle: context.learningStyle,
        interests: context.interests,
        accessibilityNeeds: context.accessibilityNeeds,
        sessionId: context.sessionId,
        conversationHistory: context.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp.toISOString(),
          tokenCount: msg.tokenCount
        }))
      });
    } catch (error) {
      this.logger.error('Failed to serialize conversation context:', error);
      throw error;
    }
  }

  /**
   * Deserialize conversation context from storage
   */
  deserializeContext(serializedContext: string): ConversationContext {
    try {
      const data = JSON.parse(serializedContext);
      return {
        childId: data.childId,
        ageGroup: data.ageGroup,
        subject: data.subject,
        topic: data.topic,
        learningStyle: data.learningStyle,
        interests: data.interests,
        accessibilityNeeds: data.accessibilityNeeds,
        sessionId: data.sessionId,
        conversationHistory: data.conversationHistory.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          tokenCount: msg.tokenCount
        }))
      };
    } catch (error) {
      this.logger.error('Failed to deserialize conversation context:', error);
      throw error;
    }
  }
}

// Factory function to create conversation memory service
export function createConversationMemoryService(logger: winston.Logger): ConversationMemoryService {
  const database = getDatabase();
  return new ConversationMemoryService(database, logger);
}
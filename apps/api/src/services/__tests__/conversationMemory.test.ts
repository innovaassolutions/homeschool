import { ConversationMemoryService, ConversationSession, ConversationMessageRecord } from '../conversationMemory';
import { DatabaseService } from '../database';
import { ConversationContext, AgeGroup } from '../chatgpt';
import winston from 'winston';

// Mock DatabaseService
jest.mock('../database');

describe('ConversationMemoryService', () => {
  let service: ConversationMemoryService;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;

    // Setup mock database
    mockDb = {
      query: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
      connect: jest.fn(),
      disconnect: jest.fn(),
      healthCheck: jest.fn(),
      getDb: jest.fn(),
      config: {
        url: 'mem://',
        namespace: 'test',
        database: 'test'
      }
    } as any;

    service = new ConversationMemoryService(mockDb, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeTables', () => {
    it('should initialize conversation memory tables', async () => {
      mockDb.query.mockResolvedValue([]);

      await service.initializeTables();

      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('DEFINE TABLE conversation_sessions'));
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('DEFINE TABLE conversation_messages'));
      expect(mockLogger.info).toHaveBeenCalledWith('Conversation memory tables initialized successfully');
    });

    it('should handle initialization errors', async () => {
      const error = new Error('DB Error');
      mockDb.query.mockRejectedValue(error);

      await expect(service.initializeTables()).rejects.toThrow('DB Error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize conversation memory tables:', error);
    });
  });

  describe('createSession', () => {
    const mockContext: ConversationContext = {
      childId: 'child-123',
      ageGroup: 'ages6to9',
      subject: 'Math',
      topic: 'Addition',
      sessionId: 'session-456',
      conversationHistory: []
    };

    it('should create a new conversation session', async () => {
      const mockSession: ConversationSession = {
        id: 'session_record_1',
        child_id: 'child-123',
        session_id: 'session-456',
        subject: 'Math',
        topic: 'Addition',
        age_group: 'ages6to9',
        created_at: new Date(),
        updated_at: new Date(),
        last_activity: new Date(),
        message_count: 0,
        total_tokens_used: 0,
        privacy_compliant: true
      };

      mockDb.query.mockResolvedValue([mockSession]);

      const result = await service.createSession(mockContext);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE conversation_sessions CONTENT'),
        expect.objectContaining({
          data: expect.objectContaining({
            child_id: 'child-123',
            session_id: 'session-456',
            subject: 'Math',
            topic: 'Addition',
            age_group: 'ages6to9'
          })
        })
      );
      expect(result).toEqual(mockSession);
      expect(mockLogger.info).toHaveBeenCalledWith('Created conversation session: session-456');
    });

    it('should create session with learning preferences', async () => {
      const contextWithPreferences = {
        ...mockContext,
        learningStyle: 'visual',
        interests: ['dinosaurs', 'space'],
        accessibilityNeeds: ['large-text']
      };

      const mockSession: ConversationSession = {
        id: 'session_record_1',
        child_id: 'child-123',
        session_id: 'session-456',
        subject: 'Math',
        topic: 'Addition',
        age_group: 'ages6to9',
        learning_style: 'visual',
        interests: ['dinosaurs', 'space'],
        accessibility_needs: ['large-text'],
        created_at: new Date(),
        updated_at: new Date(),
        last_activity: new Date(),
        message_count: 0,
        total_tokens_used: 0,
        privacy_compliant: true
      };

      mockDb.query.mockResolvedValue([mockSession]);

      const result = await service.createSession(contextWithPreferences);

      expect(result.learning_style).toBe('visual');
      expect(result.interests).toEqual(['dinosaurs', 'space']);
      expect(result.accessibility_needs).toEqual(['large-text']);
    });
  });

  describe('getSession', () => {
    it('should retrieve existing session', async () => {
      const mockSession: ConversationSession = {
        id: 'session_record_1',
        child_id: 'child-123',
        session_id: 'session-456',
        subject: 'Math',
        topic: 'Addition',
        age_group: 'ages6to9',
        created_at: new Date(),
        updated_at: new Date(),
        last_activity: new Date(),
        message_count: 5,
        total_tokens_used: 150,
        privacy_compliant: true
      };

      mockDb.query.mockResolvedValue([mockSession]);

      const result = await service.getSession('session-456');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM conversation_sessions WHERE session_id = $sessionId'),
        { sessionId: 'session-456' }
      );
      expect(result).toEqual(mockSession);
    });

    it('should return null for non-existent session', async () => {
      mockDb.query.mockResolvedValue([]);

      const result = await service.getSession('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('storeMessage', () => {
    it('should store user message', async () => {
      const mockMessage: ConversationMessageRecord = {
        id: 'msg_1',
        session_id: 'session-456',
        role: 'user',
        content: 'What is 2 + 2?',
        timestamp: new Date(),
        token_count: 8,
        filtered: false,
        age_appropriate: true
      };

      mockDb.query.mockResolvedValue([mockMessage]);

      const result = await service.storeMessage(
        'session-456',
        'user',
        'What is 2 + 2?',
        { tokenCount: 8 }
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE conversation_messages CONTENT'),
        expect.objectContaining({
          data: expect.objectContaining({
            session_id: 'session-456',
            role: 'user',
            content: 'What is 2 + 2?',
            token_count: 8
          })
        })
      );
      expect(result).toEqual(mockMessage);
    });

    it('should store assistant message with metadata', async () => {
      const mockMessage: ConversationMessageRecord = {
        id: 'msg_2',
        session_id: 'session-456',
        role: 'assistant',
        content: '2 + 2 equals 4!',
        timestamp: new Date(),
        token_count: 12,
        filtered: false,
        age_appropriate: true,
        model_used: 'gpt-3.5-turbo',
        response_time_ms: 1500
      };

      mockDb.query.mockResolvedValue([mockMessage]);

      const result = await service.storeMessage(
        'session-456',
        'assistant',
        '2 + 2 equals 4!',
        {
          tokenCount: 12,
          filtered: false,
          ageAppropriate: true,
          modelUsed: 'gpt-3.5-turbo',
          responseTimeMs: 1500
        }
      );

      expect(result.model_used).toBe('gpt-3.5-turbo');
      expect(result.response_time_ms).toBe(1500);
    });
  });

  describe('getConversationHistory', () => {
    it('should retrieve conversation history', async () => {
      const mockMessages = [
        {
          role: 'user',
          content: 'Hello',
          timestamp: '2024-01-01T10:00:00Z',
          token_count: 3
        },
        {
          role: 'assistant',
          content: 'Hi there!',
          timestamp: '2024-01-01T10:01:00Z',
          token_count: 4
        }
      ];

      mockDb.query.mockResolvedValue(mockMessages);

      const result = await service.getConversationHistory('session-456', 10, 0);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM conversation_messages'),
        { sessionId: 'session-456', limit: 10, offset: 0 }
      );
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('Hello');
    });
  });

  describe('getRecentHistory', () => {
    it('should retrieve recent conversation history excluding system messages', async () => {
      const mockMessages = [
        {
          role: 'assistant',
          content: 'Hi there!',
          timestamp: '2024-01-01T10:01:00Z',
          token_count: 4
        },
        {
          role: 'user',
          content: 'Hello',
          timestamp: '2024-01-01T10:00:00Z',
          token_count: 3
        }
      ];

      mockDb.query.mockResolvedValue(mockMessages);

      const result = await service.getRecentHistory('session-456', 5);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("role != 'system'"),
        { sessionId: 'session-456', maxMessages: 5 }
      );
      expect(result).toHaveLength(2);
      // Should be reversed to chronological order
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
    });
  });

  describe('buildConversationContext', () => {
    it('should build conversation context from stored session', async () => {
      const mockSession: ConversationSession = {
        id: 'session_record_1',
        child_id: 'child-123',
        session_id: 'session-456',
        subject: 'Math',
        topic: 'Addition',
        age_group: 'ages10to13',
        learning_style: 'kinesthetic',
        interests: ['sports'],
        accessibility_needs: [],
        created_at: new Date(),
        updated_at: new Date(),
        last_activity: new Date(),
        message_count: 3,
        total_tokens_used: 75,
        privacy_compliant: true
      };

      const mockHistory = [
        {
          role: 'user',
          content: 'Help with math',
          timestamp: '2024-01-01T10:00:00Z',
          token_count: 5
        }
      ];

      mockDb.query
        .mockResolvedValueOnce([mockSession]) // getSession call
        .mockResolvedValueOnce(mockHistory); // getRecentHistory call

      const result = await service.buildConversationContext('session-456');

      expect(result).not.toBeNull();
      expect(result!.childId).toBe('child-123');
      expect(result!.ageGroup).toBe('ages10to13');
      expect(result!.subject).toBe('Math');
      expect(result!.learningStyle).toBe('kinesthetic');
      expect(result!.conversationHistory).toHaveLength(1);
    });

    it('should return null for non-existent session', async () => {
      mockDb.query.mockResolvedValue([]); // No session found

      const result = await service.buildConversationContext('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getSessionStats', () => {
    it('should calculate session statistics', async () => {
      const mockStatsResult = [
        {
          total_messages: 10,
          total_tokens: 200,
          avg_response_time: 1800,
          last_activity: '2024-01-01T12:00:00Z'
        }
      ];

      mockDb.query.mockResolvedValue(mockStatsResult);

      const result = await service.getSessionStats('session-456');

      expect(result).not.toBeNull();
      expect(result!.total_messages).toBe(10);
      expect(result!.total_tokens).toBe(200);
      expect(result!.avg_response_time).toBe(1800);
      expect(result!.engagement_score).toBeGreaterThan(0);
    });

    it('should return null for session with no messages', async () => {
      mockDb.query.mockResolvedValue([]);

      const result = await service.getSessionStats('empty-session');

      expect(result).toBeNull();
    });
  });

  describe('cleanupOldSessions', () => {
    it('should delete old sessions and their messages', async () => {
      const mockDeletedSessions = [
        { id: 'old_session_1' },
        { id: 'old_session_2' }
      ];

      mockDb.query
        .mockResolvedValueOnce([]) // Delete messages
        .mockResolvedValueOnce(mockDeletedSessions); // Delete sessions

      const result = await service.cleanupOldSessions(30);

      expect(result).toBe(2);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaned up 2 old conversation sessions');
    });
  });

  describe('serialization', () => {
    const mockContext: ConversationContext = {
      childId: 'child-123',
      ageGroup: 'ages6to9',
      subject: 'Math',
      topic: 'Addition',
      sessionId: 'session-456',
      conversationHistory: [
        {
          role: 'user',
          content: 'Hello',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          tokenCount: 3
        }
      ]
    };

    it('should serialize conversation context', () => {
      const serialized = service.serializeContext(mockContext);
      const parsed = JSON.parse(serialized);

      expect(parsed.childId).toBe('child-123');
      expect(parsed.ageGroup).toBe('ages6to9');
      expect(parsed.conversationHistory).toHaveLength(1);
      expect(parsed.conversationHistory[0].timestamp).toBe('2024-01-01T10:00:00.000Z');
    });

    it('should deserialize conversation context', () => {
      const serialized = service.serializeContext(mockContext);
      const deserialized = service.deserializeContext(serialized);

      expect(deserialized.childId).toBe(mockContext.childId);
      expect(deserialized.ageGroup).toBe(mockContext.ageGroup);
      expect(deserialized.conversationHistory).toHaveLength(1);
      expect(deserialized.conversationHistory[0].timestamp).toBeInstanceOf(Date);
    });

    it('should handle serialization errors', () => {
      const invalidContext = { ...mockContext } as any;
      invalidContext.conversationHistory = [{ circular: invalidContext }];

      expect(() => service.serializeContext(invalidContext)).toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle deserialization errors', () => {
      const invalidJson = '{ invalid json }';

      expect(() => service.deserializeContext(invalidJson)).toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('updateSessionActivity', () => {
    it('should update session activity and token usage', async () => {
      mockDb.query.mockResolvedValue([]);

      await service.updateSessionActivity('session-456', 25);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE conversation_sessions SET'),
        { sessionId: 'session-456', tokensUsed: 25 }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('Updated session activity: session-456');
    });
  });

  describe('getChildSessions', () => {
    it('should retrieve all sessions for a child', async () => {
      const mockSessions = [
        {
          id: 'session_1',
          child_id: 'child-123',
          session_id: 'session-001',
          subject: 'Math',
          last_activity: '2024-01-02T10:00:00Z'
        },
        {
          id: 'session_2',
          child_id: 'child-123',
          session_id: 'session-002',
          subject: 'Science',
          last_activity: '2024-01-01T10:00:00Z'
        }
      ];

      mockDb.query.mockResolvedValue(mockSessions);

      const result = await service.getChildSessions('child-123', 10, 0);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE child_id = $childId'),
        { childId: 'child-123', limit: 10, offset: 0 }
      );
      expect(result).toHaveLength(2);
      expect(result[0].child_id).toBe('child-123');
    });
  });
});
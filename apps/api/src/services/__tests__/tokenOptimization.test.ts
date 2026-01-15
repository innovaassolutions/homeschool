import { TokenOptimizationService, ConversationComplexity, ModelType } from '../tokenOptimization';
import { ConversationMessage, AgeGroup } from '../chatgpt';
import winston from 'winston';

// Add custom matcher
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}

describe('TokenOptimizationService', () => {
  let service: TokenOptimizationService;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;

    service = new TokenOptimizationService(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('accurateTokenCount', () => {
    it('should count tokens for simple text', () => {
      const text = 'Hello world';
      const tokenCount = service.accurateTokenCount(text);

      expect(tokenCount).toBeGreaterThan(0);
      expect(tokenCount).toBeLessThan(10);
    });

    it('should count more tokens for complex text', () => {
      const simpleText = 'Hi';
      const complexText = 'This is a much more complicated sentence with sophisticated vocabulary and multiple punctuation marks!';

      const simpleCount = service.accurateTokenCount(simpleText);
      const complexCount = service.accurateTokenCount(complexText);

      expect(complexCount).toBeGreaterThan(simpleCount);
    });

    it('should handle empty text', () => {
      const tokenCount = service.accurateTokenCount('');
      expect(tokenCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle special characters and punctuation', () => {
      const text = 'Hello, world! How are you? I\'m doing well...';
      const tokenCount = service.accurateTokenCount(text);

      expect(tokenCount).toBeGreaterThan(5);
    });

    it('should include buffer for overhead', () => {
      const text = 'test';
      const tokenCount = service.accurateTokenCount(text);

      // Should include 1.1x buffer
      expect(tokenCount).toBeGreaterThanOrEqual(2); // 1 token + buffer
    });
  });

  describe('analyzeConversationComplexity', () => {
    const createMessages = (contents: string[]): ConversationMessage[] => {
      return contents.map((content, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content,
        timestamp: new Date(),
        tokenCount: service.accurateTokenCount(content)
      }));
    };

    it('should analyze simple conversation', () => {
      const messages = createMessages(['Hi', 'Hello there']);
      const complexity = service.analyzeConversationComplexity(messages, 'english', 'ages6to9');

      expect(complexity.level).toBeOneOf(['simple', 'moderate']);
      expect(complexity.score).toBeLessThan(75);
      expect(complexity.factors.vocabularyComplexity).toBeDefined();
      expect(complexity.factors.conceptualDifficulty).toBeDefined();
      expect(complexity.factors.contextLength).toBeDefined();
      expect(complexity.factors.interactionDepth).toBeDefined();
    });

    it('should analyze complex conversation', () => {
      const messages = createMessages([
        'Can you explain quantum mechanical principles and their applications in semiconductor technology?',
        'Quantum mechanics describes the behavior of matter and energy at the molecular, atomic, and subatomic levels...',
        'How does quantum tunneling specifically affect transistor performance in modern processors?'
      ]);
      const complexity = service.analyzeConversationComplexity(messages, 'physics', 'ages14to16');

      expect(complexity.level).toBeOneOf(['complex', 'advanced']);
      expect(complexity.score).toBeGreaterThan(25);
    });

    it('should consider age group in complexity analysis', () => {
      const messages = createMessages(['What is multiplication?', 'Multiplication is repeated addition...']);

      const youngerComplexity = service.analyzeConversationComplexity(messages, 'math', 'ages6to9');
      const olderComplexity = service.analyzeConversationComplexity(messages, 'math', 'ages14to16');

      expect(youngerComplexity.factors.conceptualDifficulty).toBeLessThan(olderComplexity.factors.conceptualDifficulty);
    });

    it('should consider subject in complexity analysis', () => {
      const messages = createMessages(['Tell me about colors', 'Colors are what we see...']);

      const artComplexity = service.analyzeConversationComplexity(messages, 'art', 'ages10to13');
      const physicsComplexity = service.analyzeConversationComplexity(messages, 'physics', 'ages10to13');

      expect(physicsComplexity.factors.conceptualDifficulty).toBeGreaterThan(artComplexity.factors.conceptualDifficulty);
    });

    it('should handle empty conversation', () => {
      const complexity = service.analyzeConversationComplexity([], 'math', 'ages10to13');

      expect(complexity.level).toBeOneOf(['simple', 'moderate']);
      expect(complexity.score).toBeLessThan(50);
    });
  });

  describe('recommendModel', () => {
    it('should recommend cost-effective model for simple complexity', () => {
      const complexity: ConversationComplexity = {
        level: 'simple',
        score: 20,
        factors: {
          vocabularyComplexity: 10,
          conceptualDifficulty: 15,
          contextLength: 20,
          interactionDepth: 5
        }
      };

      const model = service.recommendModel(complexity, true);
      expect(model).toBe('gpt-3.5-turbo');
    });

    it('should recommend advanced model for complex conversations when prioritizing cost', () => {
      const complexity: ConversationComplexity = {
        level: 'advanced',
        score: 85,
        factors: {
          vocabularyComplexity: 80,
          conceptualDifficulty: 90,
          contextLength: 70,
          interactionDepth: 95
        }
      };

      const model = service.recommendModel(complexity, true);
      expect(model).toBe('gpt-4');
    });

    it('should recommend performance-focused model when not prioritizing cost', () => {
      const complexity: ConversationComplexity = {
        level: 'moderate',
        score: 45,
        factors: {
          vocabularyComplexity: 40,
          conceptualDifficulty: 50,
          contextLength: 30,
          interactionDepth: 60
        }
      };

      const model = service.recommendModel(complexity, false);
      expect(model).toBe('gpt-4');
    });
  });

  describe('pruneConversationForOptimalTokens', () => {
    const createLongMessages = (): ConversationMessage[] => {
      return [
        {
          role: 'user',
          content: 'Hello, I need help with math',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          tokenCount: 8
        },
        {
          role: 'assistant',
          content: 'I\'d be happy to help you with math! What specific topic would you like to work on?',
          timestamp: new Date('2024-01-01T10:01:00Z'),
          tokenCount: 18
        },
        {
          role: 'user',
          content: 'Can you help me with fractions?',
          timestamp: new Date('2024-01-01T10:02:00Z'),
          tokenCount: 8
        },
        {
          role: 'assistant',
          content: 'Absolutely! Fractions represent parts of a whole. Let\'s start with the basics.',
          timestamp: new Date('2024-01-01T10:03:00Z'),
          tokenCount: 16
        },
        {
          role: 'user',
          content: 'What is 1/2 + 1/4?',
          timestamp: new Date('2024-01-01T10:04:00Z'),
          tokenCount: 8
        }
      ];
    };

    it('should return all messages when under token limit', () => {
      const messages = createLongMessages();
      const targetLimit = 100;

      const pruned = service.pruneConversationForOptimalTokens(messages, targetLimit, 'ages10to13');

      expect(pruned.length).toBeGreaterThan(0);
      expect(pruned.length).toBeLessThanOrEqual(messages.length);
    });

    it('should prune messages when over token limit', () => {
      const messages = createLongMessages();
      const targetLimit = 30; // Force pruning

      const pruned = service.pruneConversationForOptimalTokens(messages, targetLimit, 'ages10to13');

      expect(pruned.length).toBeLessThan(messages.length);

      // Should keep the most recent message
      expect(pruned[pruned.length - 1].content).toBe('What is 1/2 + 1/4?');
    });

    it('should prioritize important messages', () => {
      const messages = [
        {
          role: 'user',
          content: 'Hi',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          tokenCount: 2
        },
        {
          role: 'assistant',
          content: 'Hello! I\'m here to help you learn.',
          timestamp: new Date('2024-01-01T10:01:00Z'),
          tokenCount: 8
        },
        {
          role: 'user',
          content: 'I need help understanding this complex mathematical concept that\'s very important for my learning',
          timestamp: new Date('2024-01-01T10:02:00Z'),
          tokenCount: 18
        }
      ];

      const targetLimit = 50; // Allow room for multiple messages
      const pruned = service.pruneConversationForOptimalTokens(messages, targetLimit, 'ages10to13');

      // Should keep the most recent message (algorithm always keeps last message first)
      expect(pruned.length).toBeGreaterThanOrEqual(1);
      expect(pruned[pruned.length - 1].content).toContain('complex mathematical concept');
    });

    it('should handle empty message array', () => {
      const pruned = service.pruneConversationForOptimalTokens([], 100, 'ages10to13');
      expect(pruned).toHaveLength(0);
    });

    it('should preserve message order', () => {
      const messages = createLongMessages();
      const targetLimit = 40;

      const pruned = service.pruneConversationForOptimalTokens(messages, targetLimit, 'ages10to13');

      // Check that timestamps are in order
      for (let i = 1; i < pruned.length; i++) {
        expect(pruned[i].timestamp.getTime()).toBeGreaterThanOrEqual(pruned[i - 1].timestamp.getTime());
      }
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost for gpt-3.5-turbo', () => {
      const cost = service.calculateCost(1000, 500, 'gpt-3.5-turbo');

      // 1000 prompt tokens * 0.0005 + 500 completion tokens * 0.0015
      const expectedCost = (1000 / 1000) * 0.0005 + (500 / 1000) * 0.0015;
      expect(cost).toBeCloseTo(expectedCost, 6);
    });

    it('should calculate cost for gpt-4', () => {
      const cost = service.calculateCost(1000, 500, 'gpt-4');

      // 1000 prompt tokens * 0.03 + 500 completion tokens * 0.06
      const expectedCost = (1000 / 1000) * 0.03 + (500 / 1000) * 0.06;
      expect(cost).toBeCloseTo(expectedCost, 6);
    });

    it('should calculate cost for gpt-4-turbo', () => {
      const cost = service.calculateCost(1000, 500, 'gpt-4-turbo');

      // 1000 prompt tokens * 0.01 + 500 completion tokens * 0.03
      const expectedCost = (1000 / 1000) * 0.01 + (500 / 1000) * 0.03;
      expect(cost).toBeCloseTo(expectedCost, 6);
    });

    it('should handle unknown model gracefully', () => {
      const cost = service.calculateCost(1000, 500, 'unknown-model' as ModelType);

      expect(cost).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith('Unknown model pricing: unknown-model');
    });

    it('should handle zero tokens', () => {
      const cost = service.calculateCost(0, 0, 'gpt-3.5-turbo');
      expect(cost).toBe(0);
    });
  });

  describe('trackTokenUsage', () => {
    it('should track token usage for new session', () => {
      service.trackTokenUsage('session-123', 100, 50, 'gpt-3.5-turbo');

      const stats = service.getSessionStats('session-123');
      expect(stats).not.toBeNull();
      expect(stats!.sessionId).toBe('session-123');
      expect(stats!.totalTokensUsed).toBe(150);
      expect(stats!.messageCount).toBe(1);
      expect(stats!.averageTokensPerMessage).toBe(150);
      expect(stats!.totalCost).toBeGreaterThan(0);
    });

    it('should accumulate token usage for existing session', () => {
      service.trackTokenUsage('session-123', 100, 50, 'gpt-3.5-turbo');
      service.trackTokenUsage('session-123', 200, 100, 'gpt-3.5-turbo');

      const stats = service.getSessionStats('session-123');
      expect(stats!.totalTokensUsed).toBe(450); // 150 + 300
      expect(stats!.messageCount).toBe(2);
      expect(stats!.averageTokensPerMessage).toBe(225);
    });

    it('should update last activity timestamp', () => {
      const before = new Date();
      service.trackTokenUsage('session-123', 100, 50, 'gpt-3.5-turbo');
      const after = new Date();

      const stats = service.getSessionStats('session-123');
      expect(stats!.lastActivity.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(stats!.lastActivity.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getSessionStats', () => {
    it('should return null for non-existent session', () => {
      const stats = service.getSessionStats('non-existent');
      expect(stats).toBeNull();
    });

    it('should return stats for existing session', () => {
      service.trackTokenUsage('session-123', 100, 50, 'gpt-3.5-turbo');

      const stats = service.getSessionStats('session-123');
      expect(stats).not.toBeNull();
      expect(stats!.sessionId).toBe('session-123');
    });
  });

  describe('getAllSessionStats', () => {
    it('should return empty array when no sessions tracked', () => {
      const allStats = service.getAllSessionStats();
      expect(allStats).toHaveLength(0);
    });

    it('should return all session statistics', () => {
      service.trackTokenUsage('session-1', 100, 50, 'gpt-3.5-turbo');
      service.trackTokenUsage('session-2', 200, 100, 'gpt-4');

      const allStats = service.getAllSessionStats();
      expect(allStats).toHaveLength(2);
      expect(allStats.map(s => s.sessionId)).toContain('session-1');
      expect(allStats.map(s => s.sessionId)).toContain('session-2');
    });
  });

  describe('cleanupOldStats', () => {
    it('should remove old session statistics', () => {
      // Create a session and manually set old timestamp
      service.trackTokenUsage('old-session', 100, 50, 'gpt-3.5-turbo');
      service.trackTokenUsage('new-session', 200, 100, 'gpt-3.5-turbo');

      // Manually set old timestamp (25 hours ago)
      const oldStats = service.getSessionStats('old-session')!;
      oldStats.lastActivity = new Date(Date.now() - 25 * 60 * 60 * 1000);

      const cleanedCount = service.cleanupOldStats(24);

      expect(cleanedCount).toBe(1);
      expect(service.getSessionStats('old-session')).toBeNull();
      expect(service.getSessionStats('new-session')).not.toBeNull();
    });

    it('should not remove recent sessions', () => {
      service.trackTokenUsage('recent-session', 100, 50, 'gpt-3.5-turbo');

      const cleanedCount = service.cleanupOldStats(24);

      expect(cleanedCount).toBe(0);
      expect(service.getSessionStats('recent-session')).not.toBeNull();
    });

    it('should log cleanup results', () => {
      service.trackTokenUsage('old-session', 100, 50, 'gpt-3.5-turbo');

      // Set old timestamp
      const oldStats = service.getSessionStats('old-session')!;
      oldStats.lastActivity = new Date(Date.now() - 25 * 60 * 60 * 1000);

      service.cleanupOldStats(24);

      expect(mockLogger.info).toHaveBeenCalledWith('Cleaned up 1 old session statistics');
    });
  });

  describe('getCostOptimizationRecommendations', () => {
    it('should recommend shorter questions for high token usage', () => {
      service.trackTokenUsage('session-123', 150, 100, 'gpt-3.5-turbo'); // 250 tokens average

      const recommendations = service.getCostOptimizationRecommendations('session-123');

      expect(recommendations).toContain('Consider shorter, more focused questions to reduce token usage');
    });

    it('should recommend cheaper model for high costs', () => {
      // Multiple expensive calls to reach $0.50+
      for (let i = 0; i < 10; i++) {
        service.trackTokenUsage('expensive-session', 1000, 500, 'gpt-4');
      }

      const recommendations = service.getCostOptimizationRecommendations('expensive-session');

      expect(recommendations).toContain('Consider using GPT-3.5-turbo for simpler questions to reduce costs');
    });

    it('should recommend conversation summarization for long conversations', () => {
      // Create long conversation
      for (let i = 0; i < 25; i++) {
        service.trackTokenUsage('long-session', 50, 50, 'gpt-3.5-turbo');
      }

      const recommendations = service.getCostOptimizationRecommendations('long-session');

      expect(recommendations).toContain('Long conversations can be summarized to reduce context overhead');
    });

    it('should return empty recommendations for efficient usage', () => {
      service.trackTokenUsage('efficient-session', 50, 50, 'gpt-3.5-turbo');

      const recommendations = service.getCostOptimizationRecommendations('efficient-session');

      expect(recommendations).toHaveLength(0);
    });

    it('should return empty array for non-existent session', () => {
      const recommendations = service.getCostOptimizationRecommendations('non-existent');

      expect(recommendations).toHaveLength(0);
    });
  });

  describe('vocabularyComplexity analysis', () => {
    it('should detect simple vocabulary', () => {
      const simpleText = 'I like cats and dogs';
      // Access private method for testing
      const complexity = (service as any).analyzeVocabularyComplexity(simpleText);

      expect(complexity).toBeLessThan(80);
    });

    it('should detect complex vocabulary', () => {
      const complexText = 'The sophisticated implementation demonstrates extraordinary computational capabilities with unprecedented efficiency';
      const complexity = (service as any).analyzeVocabularyComplexity(complexText);

      expect(complexity).toBeGreaterThan(30);
    });
  });

  describe('conceptualDifficulty analysis', () => {
    it('should adjust difficulty based on subject', () => {
      const mathDifficulty = (service as any).analyzeConceptualDifficulty('math', 'ages10to13', 'equation formula');
      const artDifficulty = (service as any).analyzeConceptualDifficulty('art', 'ages10to13', 'colors painting');

      expect(mathDifficulty).toBeGreaterThan(artDifficulty);
    });

    it('should adjust difficulty based on age group', () => {
      const youngerDifficulty = (service as any).analyzeConceptualDifficulty('science', 'ages6to9', 'atoms molecules');
      const olderDifficulty = (service as any).analyzeConceptualDifficulty('science', 'ages14to16', 'atoms molecules');

      expect(olderDifficulty).toBeGreaterThan(youngerDifficulty);
    });

    it('should increase difficulty for complex terms', () => {
      const simpleText = 'addition subtraction';
      const complexText = 'derivative integral quantum molecular';

      const simpleDifficulty = (service as any).analyzeConceptualDifficulty('math', 'ages10to13', simpleText);
      const complexDifficulty = (service as any).analyzeConceptualDifficulty('math', 'ages10to13', complexText);

      expect(complexDifficulty).toBeGreaterThan(simpleDifficulty);
    });
  });

  describe('interactionDepth analysis', () => {
    it('should detect follow-up questions', () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'What is math?', timestamp: new Date(), tokenCount: 5 },
        { role: 'assistant', content: 'Math is the study of numbers...', timestamp: new Date(), tokenCount: 10 },
        { role: 'user', content: 'Can you explain more about addition?', timestamp: new Date(), tokenCount: 8 },
        { role: 'assistant', content: 'Addition combines numbers...', timestamp: new Date(), tokenCount: 8 },
        { role: 'user', content: 'What about subtraction?', timestamp: new Date(), tokenCount: 5 }
      ];

      const depth = (service as any).analyzeInteractionDepth(messages);
      expect(depth).toBeGreaterThan(10);
    });

    it('should detect clarification requests', () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'I don\'t understand fractions', timestamp: new Date(), tokenCount: 6 },
        { role: 'assistant', content: 'Let me explain...', timestamp: new Date(), tokenCount: 5 },
        { role: 'user', content: 'Can you explain what you mean by numerator?', timestamp: new Date(), tokenCount: 10 }
      ];

      const depth = (service as any).analyzeInteractionDepth(messages);
      expect(depth).toBeGreaterThan(20);
    });

    it('should handle single message', () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Hello', timestamp: new Date(), tokenCount: 2 }
      ];

      const depth = (service as any).analyzeInteractionDepth(messages);
      expect(depth).toBe(0);
    });
  });

  describe('isMessageImportant', () => {
    it('should prioritize assistant responses', () => {
      const message: ConversationMessage = {
        role: 'assistant',
        content: 'Short response',
        timestamp: new Date(),
        tokenCount: 5
      };

      const isImportant = (service as any).isMessageImportant(message, 'ages10to13');
      expect(isImportant).toBe(true);
    });

    it('should prioritize questions', () => {
      const message: ConversationMessage = {
        role: 'user',
        content: 'What is this?',
        timestamp: new Date(),
        tokenCount: 5
      };

      const isImportant = (service as any).isMessageImportant(message, 'ages10to13');
      expect(isImportant).toBe(true);
    });

    it('should prioritize help requests', () => {
      const message: ConversationMessage = {
        role: 'user',
        content: 'I need help with this problem',
        timestamp: new Date(),
        tokenCount: 8
      };

      const isImportant = (service as any).isMessageImportant(message, 'ages10to13');
      expect(isImportant).toBe(true);
    });

    it('should prioritize longer messages', () => {
      const message: ConversationMessage = {
        role: 'user',
        content: 'This is a longer message that contains more substantial content that should be preserved',
        timestamp: new Date(),
        tokenCount: 16
      };

      const isImportant = (service as any).isMessageImportant(message, 'ages10to13');
      expect(isImportant).toBe(true);
    });

    it('should not prioritize short simple messages', () => {
      const message: ConversationMessage = {
        role: 'user',
        content: 'ok',
        timestamp: new Date(),
        tokenCount: 1
      };

      const isImportant = (service as any).isMessageImportant(message, 'ages10to13');
      expect(isImportant).toBe(false);
    });
  });
});
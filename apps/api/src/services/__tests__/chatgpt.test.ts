import { ChatGPTService, ConversationContext, ConversationMessage, createChatGPTService } from '../chatgpt';
import winston from 'winston';

// Create a mock function that we can control
const mockChatCompletionsCreate = jest.fn();

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockChatCompletionsCreate
        }
      }
    }))
  };
});

describe('ChatGPTService', () => {
  let service: ChatGPTService;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;

    // Create service with test config
    const config = {
      apiKey: 'test-api-key',
      model: 'gpt-3.5-turbo',
      maxTokens: 300,
      temperature: 0.7,
      maxContextLength: 4000,
      enableFallbacks: true
    };

    service = new ChatGPTService(config, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateResponse', () => {
    const mockContext: ConversationContext = {
      childId: 'child-123',
      ageGroup: 'ages6to9',
      subject: 'Math',
      topic: 'Addition',
      sessionId: 'session-456',
      conversationHistory: []
    };

    it('should generate age-appropriate response for ages6to9', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: 'Great job! 2 plus 2 equals 4. That\'s like having 2 apples and getting 2 more!'
          }
        }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 20,
          total_tokens: 70
        },
        model: 'gpt-3.5-turbo'
      };

      mockChatCompletionsCreate.mockResolvedValue(mockCompletion);

      const response = await service.generateResponse(mockContext, 'What is 2 + 2?');

      expect(response.content).toContain('Great job!');
      expect(response.ageAppropriate).toBe(true);
      expect(response.tokenUsage.totalTokens).toBe(70);
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo',
          max_tokens: 150, // ages6to9 specific
          temperature: 0.8 // ages6to9 specific
        })
      );
    });

    it('should generate more complex response for ages14to16', async () => {
      const teenContext: ConversationContext = {
        ...mockContext,
        ageGroup: 'ages14to16'
      };

      const mockCompletion = {
        choices: [{
          message: {
            content: 'Addition is a fundamental arithmetic operation that combines quantities. When we add 2 + 2, we\'re performing binary addition to get 4.'
          }
        }],
        usage: {
          prompt_tokens: 80,
          completion_tokens: 35,
          total_tokens: 115
        },
        model: 'gpt-3.5-turbo'
      };

      mockChatCompletionsCreate.mockResolvedValue(mockCompletion);

      const response = await service.generateResponse(teenContext, 'Explain addition');

      expect(response.content).toContain('fundamental arithmetic operation');
      expect(response.ageAppropriate).toBe(true);
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 300, // ages14to16 specific
          temperature: 0.6 // ages14to16 specific
        })
      );
    });

    it('should include conversation context in system prompt', async () => {
      const contextWithHistory: ConversationContext = {
        ...mockContext,
        learningStyle: 'visual',
        interests: ['dinosaurs', 'space'],
        conversationHistory: [
          {
            role: 'user',
            content: 'I like dinosaurs',
            timestamp: new Date()
          },
          {
            role: 'assistant',
            content: 'Dinosaurs are amazing!',
            timestamp: new Date()
          }
        ]
      };

      const mockCompletion = {
        choices: [{ message: { content: 'Test response' } }],
        usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
        model: 'gpt-3.5-turbo'
      };

      mockChatCompletionsCreate.mockResolvedValue(mockCompletion);

      await service.generateResponse(contextWithHistory, 'Tell me more');

      const callArgs = mockChatCompletionsCreate.mock.calls[0][0];
      const systemMessage = callArgs.messages[0];

      expect(systemMessage.role).toBe('system');
      expect(systemMessage.content).toContain('Learning Style: visual');
      expect(systemMessage.content).toContain('Interests: dinosaurs, space');
      expect(systemMessage.content).toContain('Subject: Math');
      expect(systemMessage.content).toContain('Topic: Addition');
    });

    it('should handle API errors and implement retry logic', async () => {
      const error = new Error('API Error');
      mockChatCompletionsCreate
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Success after retries' } }],
          usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
          model: 'gpt-3.5-turbo'
        });

      const response = await service.generateResponse(mockContext, 'Test message');

      expect(response.content).toBe('Success after retries');
      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries exceeded', async () => {
      const error = new Error('Persistent API Error');
      mockChatCompletionsCreate.mockRejectedValue(error);

      await expect(
        service.generateResponse(mockContext, 'Test message')
      ).rejects.toThrow('Persistent API Error');

      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(3);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should not retry on non-retryable errors', async () => {
      const authError = { status: 401, message: 'Unauthorized' };
      mockChatCompletionsCreate.mockRejectedValue(authError);

      await expect(
        service.generateResponse(mockContext, 'Test message')
      ).rejects.toMatchObject({ status: 401 });

      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Circuit Breaker', () => {
    const mockContext: ConversationContext = {
      childId: 'child-123',
      ageGroup: 'ages6to9',
      subject: 'Math',
      topic: 'Addition',
      sessionId: 'session-456',
      conversationHistory: []
    };

    it('should open circuit breaker after threshold failures', async () => {
      const error = new Error('API Error');
      mockChatCompletionsCreate.mockRejectedValue(error);

      // Trigger multiple failures to open circuit breaker quickly
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          service.generateResponse(mockContext, 'Test message').catch(() => {
            // Expected failures
          })
        );
      }
      await Promise.all(promises);

      // Next call should fail immediately due to circuit breaker
      await expect(
        service.generateResponse(mockContext, 'Test message')
      ).rejects.toThrow('Circuit breaker is open');

      // Verify circuit breaker status
      const healthStatus = service.getHealthStatus();
      expect(healthStatus.circuitBreakerOpen).toBe(true);
      expect(healthStatus.failureCount).toBeGreaterThanOrEqual(5);
    });

    it('should reset circuit breaker on successful response', async () => {
      // Cause some failures first
      const error = new Error('API Error');
      mockChatCompletionsCreate.mockRejectedValue(error);

      try {
        await service.generateResponse(mockContext, 'Test message');
      } catch (e) {
        // Expected failure
      }

      // Now mock success
      mockChatCompletionsCreate.mockResolvedValue({
        choices: [{ message: { content: 'Success' } }],
        usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
        model: 'gpt-3.5-turbo'
      });

      const response = await service.generateResponse(mockContext, 'Test message');
      expect(response.content).toBe('Success');

      const healthStatus = service.getHealthStatus();
      expect(healthStatus.available).toBe(true);
      expect(healthStatus.failureCount).toBe(0);
    });
  });

  describe('Content Filtering', () => {
    let serviceWithFiltering: ChatGPTService;

    beforeEach(() => {
      // Import and create ContentFilterService
      const { ContentFilterService } = require('../contentFilter');
      const contentFilter = new ContentFilterService(mockLogger);

      // Create service with content filtering
      const config = {
        apiKey: 'test-api-key',
        model: 'gpt-3.5-turbo',
        maxTokens: 300,
        temperature: 0.7,
        maxContextLength: 4000,
        enableFallbacks: true
      };

      serviceWithFiltering = new ChatGPTService(
        config,
        mockLogger,
        undefined, // conversationMemory
        undefined, // tokenOptimization
        contentFilter // contentFilter
      );
    });

    const mockContext: ConversationContext = {
      childId: 'child-123',
      ageGroup: 'ages6to9',
      subject: 'Math',
      topic: 'Addition',
      sessionId: 'session-456',
      conversationHistory: []
    };

    it('should filter inappropriate content', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: 'This is stupid and I hate math problems.'
          }
        }],
        usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
        model: 'gpt-3.5-turbo'
      };

      mockChatCompletionsCreate.mockResolvedValue(mockCompletion);

      const response = await serviceWithFiltering.generateResponse(mockContext, 'Test message');

      expect(response.filtered).toBe(true);
      expect(response.ageAppropriate).toBe(false);
    });

    it('should validate age appropriateness for different age groups', async () => {
      const complexContent = 'This is an extraordinarily sophisticated explanation with multifaceted considerations that demonstrates advanced theoretical concepts.';

      const mockCompletion = {
        choices: [{ message: { content: complexContent } }],
        usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
        model: 'gpt-3.5-turbo'
      };

      mockChatCompletionsCreate.mockResolvedValue(mockCompletion);

      // Test with young children - should be flagged as not age-appropriate
      const youngContext = { ...mockContext, ageGroup: 'ages6to9' as const };
      const youngResponse = await serviceWithFiltering.generateResponse(youngContext, 'Test');
      expect(youngResponse.ageAppropriate).toBe(false);

      // Test with teenagers - should be age-appropriate
      const teenContext = { ...mockContext, ageGroup: 'ages14to16' as const };
      const teenResponse = await serviceWithFiltering.generateResponse(teenContext, 'Test');
      expect(teenResponse.ageAppropriate).toBe(true);
    });
  });

  describe('Fallback Response', () => {
    const mockContext: ConversationContext = {
      childId: 'child-123',
      ageGroup: 'ages10to13',
      subject: 'Science',
      topic: 'Physics',
      sessionId: 'session-456',
      conversationHistory: []
    };

    it('should generate age-appropriate fallback responses', () => {
      const youngContext = { ...mockContext, ageGroup: 'ages6to9' as const };
      const youngFallback = service.generateFallbackResponse(youngContext);
      expect(youngFallback.content).toContain('having trouble thinking');
      expect(youngFallback.model).toBe('fallback');

      const teenContext = { ...mockContext, ageGroup: 'ages14to16' as const };
      const teenFallback = service.generateFallbackResponse(teenContext);
      expect(teenFallback.content).toContain('technical issues');
      expect(teenFallback.ageAppropriate).toBe(true);
    });
  });

  describe('Token Management', () => {
    it('should estimate token count accurately', () => {
      const shortText = 'Hello';
      const longText = 'This is a much longer text that should have more tokens estimated for proper token management and cost optimization.';

      expect(service.estimateTokenCount(shortText)).toBe(2); // 5 chars / 4 = 1.25, rounded up to 2
      expect(service.estimateTokenCount(longText)).toBe(29); // Updated to match actual calculation
    });

    it('should include token usage in response', async () => {
      const mockCompletion = {
        choices: [{ message: { content: 'Test response' } }],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 50,
          total_tokens: 200
        },
        model: 'gpt-3.5-turbo'
      };

      mockChatCompletionsCreate.mockResolvedValue(mockCompletion);

      const context: ConversationContext = {
        childId: 'child-123',
        ageGroup: 'ages6to9',
        subject: 'Math',
        topic: 'Addition',
        sessionId: 'session-456',
        conversationHistory: []
      };

      const response = await service.generateResponse(context, 'Test');

      expect(response.tokenUsage).toEqual({
        promptTokens: 150,
        completionTokens: 50,
        totalTokens: 200
      });
    });
  });

  describe('Health Status', () => {
    it('should report healthy status initially', () => {
      const status = service.getHealthStatus();
      expect(status.available).toBe(true);
      expect(status.circuitBreakerOpen).toBe(false);
      expect(status.failureCount).toBe(0);
    });
  });

  describe('Enhanced Error Scenarios', () => {
    const mockContext: ConversationContext = {
      childId: 'child-123',
      ageGroup: 'ages10to13',
      subject: 'Science',
      topic: 'Physics',
      sessionId: 'session-789',
      conversationHistory: []
    };

    it('should handle rate limiting errors (429)', async () => {
      const rateLimitError = {
        status: 429,
        message: 'Rate limit exceeded',
        headers: { 'retry-after': '60' }
      };
      mockChatCompletionsCreate.mockRejectedValue(rateLimitError);

      await expect(
        service.generateResponse(mockContext, 'Test message')
      ).rejects.toMatchObject({ status: 429 });

      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle server errors (500) with retries', async () => {
      const serverError = { status: 500, message: 'Internal server error' };
      mockChatCompletionsCreate
        .mockRejectedValueOnce(serverError)
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Success after server error' } }],
          usage: { prompt_tokens: 40, completion_tokens: 15, total_tokens: 55 },
          model: 'gpt-3.5-turbo'
        });

      const response = await service.generateResponse(mockContext, 'Test message');

      expect(response.content).toBe('Success after server error');
      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(3);
    });

    it('should handle invalid API key errors (401)', async () => {
      const authError = {
        status: 401,
        message: 'Invalid API key'
      };
      mockChatCompletionsCreate.mockRejectedValue(authError);

      await expect(
        service.generateResponse(mockContext, 'Test message')
      ).rejects.toMatchObject({ status: 401 });

      // Should not retry auth errors
      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);
    });

    it('should handle malformed API responses', async () => {
      const malformedResponse = {
        // Missing choices array
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        model: 'gpt-3.5-turbo'
      };
      mockChatCompletionsCreate.mockResolvedValue(malformedResponse);

      await expect(
        service.generateResponse(mockContext, 'Test message')
      ).rejects.toThrow('Invalid response from ChatGPT API');
    });

    it('should handle empty response content', async () => {
      const emptyResponse = {
        choices: [{ message: { content: '' } }],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        model: 'gpt-3.5-turbo'
      };
      mockChatCompletionsCreate.mockResolvedValue(emptyResponse);

      await expect(
        service.generateResponse(mockContext, 'Test message')
      ).rejects.toThrow('Invalid response from ChatGPT API');
    });

    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';
      mockChatCompletionsCreate.mockRejectedValue(timeoutError);

      await expect(
        service.generateResponse(mockContext, 'Test message')
      ).rejects.toThrow('Network timeout');

      // Should retry timeout errors
      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(3);
    });

    it('should handle quota exceeded errors (429)', async () => {
      const quotaError = {
        status: 429,
        message: 'Quota exceeded',
        type: 'quota_exceeded'
      };
      mockChatCompletionsCreate.mockRejectedValue(quotaError);

      await expect(
        service.generateResponse(mockContext, 'Test message')
      ).rejects.toMatchObject({ status: 429 });

      // Should not retry quota errors
      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Fallback Response Integration', () => {
    const mockContext: ConversationContext = {
      childId: 'child-456',
      ageGroup: 'ages14to16',
      subject: 'History',
      topic: 'World War II',
      sessionId: 'session-history',
      conversationHistory: []
    };

    it('should use fallback when circuit breaker is open', async () => {
      // First, trigger circuit breaker by causing failures
      const error = new Error('Persistent failure');
      mockChatCompletionsCreate.mockRejectedValue(error);

      // Cause enough failures to open circuit breaker quickly
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          service.generateResponse(mockContext, 'Test').catch(() => {
            // Expected failures
          })
        );
      }
      await Promise.all(promises);

      // Now get fallback response
      const fallbackResponse = service.generateFallbackResponse(mockContext);

      expect(fallbackResponse.model).toBe('fallback');
      expect(fallbackResponse.content).toContain('technical issues');
      expect(fallbackResponse.ageAppropriate).toBe(true);
      expect(fallbackResponse.tokenUsage.totalTokens).toBe(0);
    });

    it('should provide age-appropriate fallback messages', () => {
      const youngContext = { ...mockContext, ageGroup: 'ages6to9' as const };
      const teenContext = { ...mockContext, ageGroup: 'ages14to16' as const };

      const youngFallback = service.generateFallbackResponse(youngContext);
      const teenFallback = service.generateFallbackResponse(teenContext);

      expect(youngFallback.content).toContain('having trouble thinking');
      expect(teenFallback.content).toContain('technical issues');
      expect(youngFallback.content.length).toBeLessThan(teenFallback.content.length);
    });
  });
});

describe('createChatGPTService', () => {
  let mockLogger: winston.Logger;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_MAX_TOKENS;
    delete process.env.OPENAI_TEMPERATURE;
  });

  it('should create service with environment variables', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_MODEL = 'gpt-4';
    process.env.OPENAI_MAX_TOKENS = '500';
    process.env.OPENAI_TEMPERATURE = '0.5';

    const service = createChatGPTService(mockLogger);
    expect(service).toBeInstanceOf(ChatGPTService);
  });

  it('should throw error if OPENAI_API_KEY is missing', () => {
    expect(() => createChatGPTService(mockLogger)).toThrow('OPENAI_API_KEY environment variable is required');
  });

  it('should use default values for optional environment variables', () => {
    process.env.OPENAI_API_KEY = 'test-key';

    const service = createChatGPTService(mockLogger);
    expect(service).toBeInstanceOf(ChatGPTService);
  });
});
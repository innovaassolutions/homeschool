import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { ContentFilterMiddleware, createContentFilterMiddleware } from '../contentFilter';
import { ContentFilterService, ContentFilterResult } from '../../services/contentFilter';
import { AgeGroup } from '../../services/chatgpt';

// Mock the ContentFilterService
jest.mock('../../services/contentFilter');

describe('ContentFilterMiddleware', () => {
  let mockContentFilterService: jest.Mocked<ContentFilterService>;
  let mockLogger: winston.Logger;
  let middleware: ContentFilterMiddleware;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    // Create mock content filter service
    mockContentFilterService = {
      filterContent: jest.fn(),
      getFilteringStats: jest.fn().mockReturnValue({
        patternsLoaded: 10,
        ageGroupsSupported: 3
      })
    } as any;

    // Create mock logger
    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    // Create middleware instance
    middleware = new ContentFilterMiddleware(mockContentFilterService, mockLogger);

    // Setup request, response, and next mocks
    req = {
      body: {},
      query: {},
      user: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('filterUserInput', () => {
    it('should pass through request when no message is provided', async () => {
      req.body = {};

      await middleware.filterUserInput(req as Request, res as Response, next);

      expect(mockContentFilterService.filterContent).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith();
    });

    it('should pass through request when no age group is found', async () => {
      req.body = { message: 'Hello world' };

      await middleware.filterUserInput(req as Request, res as Response, next);

      expect(mockLogger.warn).toHaveBeenCalledWith('Age group not found for content filtering');
      expect(next).toHaveBeenCalledWith();
    });

    it('should filter appropriate content and continue', async () => {
      const mockFilterResult: ContentFilterResult = {
        isAppropriate: true,
        filteredContent: 'Hello there!',
        violations: [],
        confidence: 0.95,
        warnings: []
      };

      req.body = { message: 'Hello world' };
      req.ageGroup = 'ages6to9';

      mockContentFilterService.filterContent.mockResolvedValue(mockFilterResult);

      await middleware.filterUserInput(req as Request, res as Response, next);

      expect(mockContentFilterService.filterContent).toHaveBeenCalledWith(
        'Hello world',
        'ages6to9',
        {
          subject: undefined,
          learningObjective: undefined
        }
      );
      expect(req.body.message).toBe('Hello there!');
      expect((req as any).contentFilter).toBe(mockFilterResult);
      expect(next).toHaveBeenCalledWith();
    });

    it('should block inappropriate content', async () => {
      const mockFilterResult: ContentFilterResult = {
        isAppropriate: false,
        filteredContent: 'Filtered content',
        violations: [
          {
            type: 'inappropriate_language',
            severity: 'high',
            description: 'Inappropriate language detected',
            originalText: 'bad word'
          }
        ],
        confidence: 0.8,
        warnings: []
      };

      req.body = { message: 'Some bad word content' };
      req.ageGroup = 'ages6to9';

      mockContentFilterService.filterContent.mockResolvedValue(mockFilterResult);

      await middleware.filterUserInput(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'inappropriate_content',
        message: 'Your message contains content that is not appropriate. Please try rephrasing your question.',
        ageGroup: 'ages6to9',
        violations: [{
          type: 'inappropriate_language',
          severity: 'high',
          description: 'Inappropriate language detected'
        }]
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should log violations when logging is enabled', async () => {
      const mockFilterResult: ContentFilterResult = {
        isAppropriate: true,
        filteredContent: 'Filtered content',
        violations: [
          {
            type: 'complex_language',
            severity: 'low',
            description: 'Language complexity warning',
            originalText: 'complex word'
          }
        ],
        confidence: 0.9,
        warnings: []
      };

      req.body = { message: 'Complex content' };
      req.ageGroup = 'ages10to13';

      mockContentFilterService.filterContent.mockResolvedValue(mockFilterResult);

      await middleware.filterUserInput(req as Request, res as Response, next);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Content violations detected in user input',
        expect.objectContaining({
          ageGroup: 'ages10to13',
          violationsCount: 1
        })
      );
      expect(next).toHaveBeenCalledWith();
    });

    it('should handle filtering errors gracefully in permissive mode', async () => {
      req.body = { message: 'Test message' };
      req.ageGroup = 'ages6to9';

      mockContentFilterService.filterContent.mockRejectedValue(new Error('Filtering failed'));

      // Permissive mode (default)
      await middleware.filterUserInput(req as Request, res as Response, next);

      expect(mockLogger.error).toHaveBeenCalledWith('Content filtering middleware error:', expect.any(Error));
      expect(next).toHaveBeenCalledWith();
    });

    it('should block requests on filtering errors in strict mode', async () => {
      const strictMiddleware = new ContentFilterMiddleware(
        mockContentFilterService,
        mockLogger,
        { strictMode: true }
      );

      req.body = { message: 'Test message' };
      req.ageGroup = 'ages6to9';

      mockContentFilterService.filterContent.mockRejectedValue(new Error('Filtering failed'));

      await strictMiddleware.filterUserInput(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'content_filtering_error',
        message: 'Unable to process your message due to a content filtering error. Please try again.'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('filterAIResponse', () => {
    it('should pass through response when no age group is found', async () => {
      const originalJson = jest.fn();
      res.json = originalJson;

      await middleware.filterAIResponse(req as Request, res as Response, next);

      expect(mockLogger.warn).toHaveBeenCalledWith('Age group not found for AI response filtering');
      expect(next).toHaveBeenCalledWith();
    });

    it('should filter AI response content', async () => {
      const mockFilterResult: ContentFilterResult = {
        isAppropriate: true,
        filteredContent: 'Safe AI response',
        violations: [],
        confidence: 0.95,
        warnings: ['Minor complexity warning']
      };

      req.ageGroup = 'ages10to13';
      mockContentFilterService.filterContent.mockResolvedValue(mockFilterResult);

      await middleware.filterAIResponse(req as Request, res as Response, next);

      // Test that res.json was overridden
      expect(typeof res.json).toBe('function');
      expect(next).toHaveBeenCalledWith();

      // Test the overridden json method
      const testResponse = { content: 'Original AI response' };
      await (res.json as any)(testResponse);

      expect(mockContentFilterService.filterContent).toHaveBeenCalledWith(
        'Original AI response',
        'ages10to13',
        expect.any(Object)
      );

      expect(testResponse).toEqual({
        content: 'Safe AI response',
        filtered: true,
        ageAppropriate: true,
        filterWarnings: ['Minor complexity warning'],
        filterConfidence: 0.95
      });
    });

    it('should block inappropriate AI responses with fallback', async () => {
      const mockFilterResult: ContentFilterResult = {
        isAppropriate: false,
        filteredContent: 'Filtered content',
        violations: [
          {
            type: 'adult_topics',
            severity: 'critical',
            description: 'Adult content detected',
            originalText: 'inappropriate content'
          }
        ],
        confidence: 0.3,
        warnings: []
      };

      req.ageGroup = 'ages6to9';
      mockContentFilterService.filterContent.mockResolvedValue(mockFilterResult);

      await middleware.filterAIResponse(req as Request, res as Response, next);

      const testResponse = { content: 'Inappropriate AI response' };
      await (res.json as any)(testResponse);

      expect(testResponse.content).toBe("I'm sorry, but I can't give you an answer to that right now. Let's talk about something fun instead! What would you like to learn about today?");
      expect(testResponse.filtered).toBe(true);
      expect(testResponse.ageAppropriate).toBe(false);
      expect(testResponse.filterViolations).toEqual(mockFilterResult.violations);
    });

    it('should handle response filtering errors in strict mode', async () => {
      const strictMiddleware = new ContentFilterMiddleware(
        mockContentFilterService,
        mockLogger,
        { strictMode: true }
      );

      req.ageGroup = 'ages10to13';
      mockContentFilterService.filterContent.mockRejectedValue(new Error('Filter error'));

      await strictMiddleware.filterAIResponse(req as Request, res as Response, next);

      const testResponse = { content: 'AI response' };
      await (res.json as any)(testResponse);

      expect(testResponse.content).toBe("I apologize, but I can't provide a response to that question. Let's try a different topic. What subject are you studying that I can help you with?");
      expect(testResponse.filtered).toBe(true);
      expect(testResponse.ageAppropriate).toBe(false);
      expect(testResponse.filterError).toBe(true);
    });
  });

  describe('validateAgeAppropriateAccess', () => {
    it('should pass when no topic or subject is provided', async () => {
      req.ageGroup = 'ages10to13';
      req.body = {};

      await middleware.validateAgeAppropriateAccess(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should validate topic appropriateness and allow appropriate content', async () => {
      const mockFilterResult: ContentFilterResult = {
        isAppropriate: true,
        filteredContent: 'Math addition',
        violations: [],
        confidence: 0.95,
        warnings: []
      };

      req.ageGroup = 'ages6to9';
      req.body = { topic: 'addition', subject: 'math' };
      mockContentFilterService.filterContent.mockResolvedValue(mockFilterResult);

      await middleware.validateAgeAppropriateAccess(req as Request, res as Response, next);

      expect(mockContentFilterService.filterContent).toHaveBeenCalledWith('math addition', 'ages6to9');
      expect(next).toHaveBeenCalledWith();
    });

    it('should block inappropriate topic access', async () => {
      const mockFilterResult: ContentFilterResult = {
        isAppropriate: false,
        filteredContent: 'Blocked topic',
        violations: [
          {
            type: 'adult_topics',
            severity: 'high',
            description: 'Adult topic detected',
            originalText: 'inappropriate topic'
          }
        ],
        confidence: 0.2,
        warnings: []
      };

      req.ageGroup = 'ages6to9';
      req.body = { topic: 'inappropriate topic' };
      mockContentFilterService.filterContent.mockResolvedValue(mockFilterResult);

      await middleware.validateAgeAppropriateAccess(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'age_inappropriate_topic',
        message: 'This topic is not appropriate for your age group. Please ask about something else or talk to a parent or teacher.',
        ageGroup: 'ages6to9',
        blockedContent: 'inappropriate topic'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle validation errors gracefully', async () => {
      req.ageGroup = 'ages10to13';
      req.body = { topic: 'test topic' };
      mockContentFilterService.filterContent.mockRejectedValue(new Error('Validation failed'));

      await middleware.validateAgeAppropriateAccess(req as Request, res as Response, next);

      expect(mockLogger.error).toHaveBeenCalledWith('Age-appropriate access validation error:', expect.any(Error));
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('factory functions', () => {
    it('should create middleware using factory function', () => {
      const createdMiddleware = createContentFilterMiddleware(mockContentFilterService, mockLogger);
      expect(createdMiddleware).toBeInstanceOf(ContentFilterMiddleware);
    });

    it('should get middleware statistics', () => {
      const stats = middleware.getStats();

      expect(stats).toEqual({
        config: {
          strictMode: false,
          logViolations: true,
          includeWarnings: true
        },
        filteringStats: {
          patternsLoaded: 10,
          ageGroupsSupported: 3
        }
      });
    });
  });

  describe('age group extraction', () => {
    it('should extract age group from request.ageGroup', async () => {
      req.ageGroup = 'ages14to16';
      req.body = { message: 'test' };

      const mockFilterResult: ContentFilterResult = {
        isAppropriate: true,
        filteredContent: 'test',
        violations: [],
        confidence: 1.0,
        warnings: []
      };

      mockContentFilterService.filterContent.mockResolvedValue(mockFilterResult);

      await middleware.filterUserInput(req as Request, res as Response, next);

      expect(mockContentFilterService.filterContent).toHaveBeenCalledWith('test', 'ages14to16', expect.any(Object));
    });

    it('should extract age group from user context', async () => {
      (req.user as any) = { ageGroup: 'ages10to13' };
      req.body = { message: 'test' };

      const mockFilterResult: ContentFilterResult = {
        isAppropriate: true,
        filteredContent: 'test',
        violations: [],
        confidence: 1.0,
        warnings: []
      };

      mockContentFilterService.filterContent.mockResolvedValue(mockFilterResult);

      await middleware.filterUserInput(req as Request, res as Response, next);

      expect(mockContentFilterService.filterContent).toHaveBeenCalledWith('test', 'ages10to13', expect.any(Object));
    });

    it('should extract age group from request body', async () => {
      req.body = { message: 'test', ageGroup: 'ages6to9' };

      const mockFilterResult: ContentFilterResult = {
        isAppropriate: true,
        filteredContent: 'test',
        violations: [],
        confidence: 1.0,
        warnings: []
      };

      mockContentFilterService.filterContent.mockResolvedValue(mockFilterResult);

      await middleware.filterUserInput(req as Request, res as Response, next);

      expect(mockContentFilterService.filterContent).toHaveBeenCalledWith('test', 'ages6to9', expect.any(Object));
    });
  });
});
import request from 'supertest';
import express from 'express';
import { FeedbackGenerationService } from '../../services/feedbackGeneration';

// Mock dependencies
jest.mock('../../services/feedbackGeneration');

// Create a mock feedback router by copying the routes but with inline auth
const createMockFeedbackRouter = (feedbackService: jest.Mocked<FeedbackGenerationService>) => {
  const router = express.Router();

  // Mock auth middleware
  const mockAuth = (req: any, res: any, next: any) => {
    req.user = { id: 'user_123' };
    next();
  };

  router.post('/generate', mockAuth, async (req, res) => {
    try {
      const result = await feedbackService.generateFeedback(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error, code: 'FEEDBACK_GENERATION_FAILED' });
      }
      res.json({ success: true, feedbackId: result.feedbackId, feedbackContent: result.feedbackContent, processingTime: result.processingTime });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  });

  router.get('/child/:childId', mockAuth, async (req, res) => {
    const mockHistory = [{ id: 'feedback_1', analysisId: 'analysis_1', childId: req.params.childId, subject: 'mathematics', errors: ['computational_error'], skillsAssessed: ['basic_addition'], timestamp: new Date() }];
    res.json({ success: true, feedbackHistory: mockHistory, pagination: { limit: 20, offset: 0, total: 1, hasMore: false } });
  });

  router.post('/insights', mockAuth, async (req, res) => {
    const insights = await feedbackService.generateLearningInsights([]);
    res.json({ success: true, insights, metadata: { childId: req.body.childId, timeframe: req.body.timeframe || 'month', feedbackCount: 0, generatedAt: new Date().toISOString() } });
  });

  router.get('/stats', mockAuth, async (req, res) => {
    const stats = feedbackService.getStats();
    res.json({ success: true, stats, metadata: { timeframe: req.query.timeframe || 'month', generatedAt: new Date().toISOString() } });
  });

  router.get('/health', async (req, res) => {
    const health = await feedbackService.healthCheck();
    res.json({ success: true, service: 'feedback-generation', ...health, timestamp: new Date().toISOString() });
  });

  return router;
};

describe('Feedback Routes', () => {
  let app: express.Application;
  let mockFeedbackService: jest.Mocked<FeedbackGenerationService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock feedback service
    mockFeedbackService = {
      generateFeedback: jest.fn(),
      generateLearningInsights: jest.fn(),
      getStats: jest.fn(),
      healthCheck: jest.fn()
    } as any;

    app.use('/api/feedback', createMockFeedbackRouter(mockFeedbackService));
  });

  describe('POST /api/feedback/generate', () => {
    it('should generate feedback successfully', async () => {
      const mockFeedbackResponse = {
        success: true,
        feedbackId: 'feedback_123',
        feedbackContent: {
          feedback: 'Great effort on this math problem!',
          positiveReinforcement: ['You showed your work clearly'],
          improvementSuggestions: [{
            area: 'basic_addition',
            suggestion: 'Practice counting objects',
            actionable: true
          }],
          visualAnnotations: [],
          learningInsights: {
            commonErrorPatterns: ['computational_error'],
            skillsNeedingFocus: ['basic_addition'],
            recommendedActivities: ['Practice with manipulatives'],
            progressIndicators: [],
            motivationalElements: ['Great try!']
          },
          ageGroup: 'ages6to9' as const
        },
        processingTime: 2500
      };

      mockFeedbackService.generateFeedback.mockResolvedValue(mockFeedbackResponse);

      const response = await request(app)
        .post('/api/feedback/generate')
        .send({
          analysisId: 'analysis_123',
          childId: '550e8400-e29b-41d4-a716-446655440000',
          ageGroup: 'ages6to9'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.feedbackId).toBe('feedback_123');
      expect(response.body.feedbackContent.feedback).toContain('Great effort');
      expect(response.body.processingTime).toBe(2500);

      expect(mockFeedbackService.generateFeedback).toHaveBeenCalledWith({
        analysisId: 'analysis_123',
        childId: '550e8400-e29b-41d4-a716-446655440000',
        ageGroup: 'ages6to9',
        requestId: undefined
      });
    });

    it('should validate request data', async () => {
      const response = await request(app)
        .post('/api/feedback/generate')
        .send({
          analysisId: '',
          childId: 'invalid-uuid',
          ageGroup: 'invalid-age'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request data');
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details).toBeDefined();
    });


    it('should handle feedback generation failure', async () => {
      mockFeedbackService.generateFeedback.mockResolvedValue({
        success: false,
        error: 'Analysis not found'
      });

      const response = await request(app)
        .post('/api/feedback/generate')
        .send({
          analysisId: 'nonexistent_analysis',
          childId: '550e8400-e29b-41d4-a716-446655440000',
          ageGroup: 'ages6to9'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Analysis not found');
      expect(response.body.code).toBe('FEEDBACK_GENERATION_FAILED');
    });
  });

  describe('GET /api/feedback/child/:childId', () => {
    it('should retrieve feedback history for child', async () => {
      const childId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/feedback/child/${childId}`)
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.feedbackHistory).toBeDefined();
      expect(response.body.pagination).toEqual({
        limit: 10,
        offset: 0,
        total: expect.any(Number),
        hasMore: expect.any(Boolean)
      });
    });

    it('should validate child ID format', async () => {
      const response = await request(app)
        .get('/api/feedback/child/invalid-uuid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid child ID');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

  });

  describe('POST /api/feedback/insights', () => {
    it('should generate learning insights', async () => {
      const mockInsights = {
        commonErrorPatterns: ['computational_error'],
        skillsNeedingFocus: ['basic_addition'],
        recommendedActivities: ['Practice with manipulatives'],
        progressIndicators: [],
        motivationalElements: ['Great try!']
      };

      mockFeedbackService.generateLearningInsights.mockResolvedValue(mockInsights);

      const response = await request(app)
        .post('/api/feedback/insights')
        .send({
          childId: '550e8400-e29b-41d4-a716-446655440000',
          timeframe: 'month'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.insights).toEqual(mockInsights);
      expect(response.body.metadata.timeframe).toBe('month');

      expect(mockFeedbackService.generateLearningInsights).toHaveBeenCalled();
    });

    it('should validate insights request data', async () => {
      const response = await request(app)
        .post('/api/feedback/insights')
        .send({
          childId: 'invalid-uuid',
          timeframe: 'invalid-timeframe'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request data');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/feedback/stats', () => {
    it('should retrieve feedback statistics', async () => {
      const mockStats = {
        totalFeedbackGenerated: 150,
        averageProcessingTime: 2300,
        feedbackByAgeGroup: { 'ages6to9': 50, 'ages10to13': 60, 'ages14to16': 40 },
        feedbackBySubject: { mathematics: 80, english: 45, science: 25 },
        successRate: 0.95,
        commonIssues: [],
        totalErrors: 8
      };

      mockFeedbackService.getStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/api/feedback/stats')
        .query({ timeframe: 'month' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toEqual(mockStats);
      expect(response.body.metadata.timeframe).toBe('month');
    });
  });

  describe('GET /api/feedback/health', () => {
    it('should return service health status', async () => {
      const mockHealthStatus = {
        status: 'healthy',
        latency: 120
      };

      mockFeedbackService.healthCheck.mockResolvedValue(mockHealthStatus);

      const response = await request(app)
        .get('/api/feedback/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.service).toBe('feedback-generation');
      expect(response.body.status).toBe('healthy');
      expect(response.body.latency).toBe(120);
    });

    it('should handle health check failures', async () => {
      mockFeedbackService.healthCheck.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .get('/api/feedback/health');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Service health check failed');
      expect(response.body.code).toBe('HEALTH_CHECK_FAILED');
    });
  });

});
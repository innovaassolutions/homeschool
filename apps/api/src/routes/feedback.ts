import express from 'express';
import { z } from 'zod';
import { authenticateUser } from '../middleware/auth';
import {
  FeedbackGenerationService,
  FeedbackRequest,
  FeedbackHistory,
  FeedbackStats
} from '../services/feedbackGeneration';

const router = express.Router();

// Feedback service instance (will be initialized by app.ts)
let feedbackService: FeedbackGenerationService;

// Initialize the feedback service
export const initializeFeedbackService = (service: FeedbackGenerationService) => {
  feedbackService = service;
};

// Request validation schemas
const generateFeedbackSchema = z.object({
  analysisId: z.string().min(1, 'Analysis ID is required'),
  childId: z.string().uuid('Invalid child ID format'),
  ageGroup: z.enum(['ages6to9', 'ages10to13', 'ages14to16']),
  requestId: z.string().optional()
});

const childIdParamSchema = z.object({
  childId: z.string().uuid('Invalid child ID format')
});

const feedbackIdParamSchema = z.object({
  feedbackId: z.string().min(1, 'Feedback ID is required')
});

/**
 * POST /api/feedback/generate
 * Generate feedback from analysis results
 *
 * Request Body:
 * - analysisId: string - Analysis result ID to generate feedback for
 * - childId: string (UUID) - Child profile ID for age-appropriate feedback
 * - ageGroup: 'ages6to9'|'ages10to13'|'ages14to16' - Age group for feedback adaptation
 * - requestId?: string - Optional request ID for tracking
 *
 * Response:
 * - Success: FeedbackResponse with feedbackContent and processing metadata
 * - Error: { error: string, details?: any }
 */
router.post('/generate', authenticateUser, async (req, res) => {
  try {
    const validatedData = generateFeedbackSchema.parse(req.body);

    // Note: Child access validation would be implemented here
    // For now, assuming all authenticated users have access

    const feedbackRequest: FeedbackRequest = {
      analysisId: validatedData.analysisId,
      childId: validatedData.childId,
      ageGroup: validatedData.ageGroup,
      requestId: validatedData.requestId
    };

    const result = await feedbackService.generateFeedback(feedbackRequest);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        code: 'FEEDBACK_GENERATION_FAILED'
      });
    }

    res.json({
      success: true,
      feedbackId: result.feedbackId,
      feedbackContent: result.feedbackContent,
      processingTime: result.processingTime
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Error generating feedback:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/feedback/:feedbackId
 * Retrieve detailed feedback information
 *
 * Parameters:
 * - feedbackId: string - Feedback record ID
 *
 * Response:
 * - Success: Complete feedback record with content and metadata
 * - Error: { error: string, code: string }
 */
router.get('/:feedbackId', authenticateUser, async (req, res) => {
  try {
    const { feedbackId } = feedbackIdParamSchema.parse(req.params);

    // TODO: Implement feedback retrieval from SurrealDB
    // For now, return a placeholder response
    res.status(501).json({
      error: 'Feedback retrieval not yet implemented',
      code: 'NOT_IMPLEMENTED',
      message: 'This endpoint will be implemented with SurrealDB integration'
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid feedback ID',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Error retrieving feedback:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/feedback/child/:childId
 * Get feedback history for a specific child
 *
 * Parameters:
 * - childId: string (UUID) - Child profile ID
 *
 * Query Parameters:
 * - limit?: number - Maximum number of feedback records (default: 20, max: 100)
 * - offset?: number - Number of records to skip (default: 0)
 * - subject?: string - Filter by subject (mathematics, english, science, etc.)
 * - startDate?: string - Filter feedback from this date (ISO format)
 * - endDate?: string - Filter feedback until this date (ISO format)
 *
 * Response:
 * - Success: Array of feedback history records with pagination metadata
 * - Error: { error: string, code: string }
 */
router.get('/child/:childId', authenticateUser, async (req, res) => {
  try {
    const { childId } = childIdParamSchema.parse(req.params);

    // Note: Child access validation would be implemented here
    // For now, assuming all authenticated users have access

    // Parse query parameters
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const subject = req.query.subject as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // TODO: Implement feedback history retrieval from SurrealDB
    // For now, return mock data for development
    const mockFeedbackHistory: FeedbackHistory[] = [
      {
        id: 'feedback_1',
        analysisId: 'analysis_1',
        childId,
        subject: 'mathematics',
        errors: ['computational_error'],
        skillsAssessed: ['basic_addition'],
        timestamp: new Date(Date.now() - 86400000) // 1 day ago
      },
      {
        id: 'feedback_2',
        analysisId: 'analysis_2',
        childId,
        subject: 'mathematics',
        errors: ['computational_error'],
        skillsAssessed: ['basic_addition'],
        timestamp: new Date()
      }
    ];

    // Apply filters (mock implementation)
    let filteredHistory = mockFeedbackHistory;
    if (subject) {
      filteredHistory = filteredHistory.filter(f => f.subject === subject);
    }

    // Apply pagination
    const paginatedHistory = filteredHistory.slice(offset, offset + limit);

    res.json({
      success: true,
      feedbackHistory: paginatedHistory,
      pagination: {
        limit,
        offset,
        total: filteredHistory.length,
        hasMore: (offset + limit) < filteredHistory.length
      },
      filters: {
        subject,
        startDate,
        endDate
      }
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid child ID',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Error retrieving feedback history:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/feedback/insights
 * Generate learning insights from feedback history
 *
 * Request Body:
 * - childId: string (UUID) - Child profile ID
 * - timeframe?: string - Time period for analysis ('week', 'month', 'quarter', 'all')
 * - subjects?: string[] - Specific subjects to analyze
 *
 * Response:
 * - Success: LearningInsight object with patterns and recommendations
 * - Error: { error: string, code: string }
 */
router.post('/insights', authenticateUser, async (req, res) => {
  try {
    const insightsSchema = z.object({
      childId: z.string().uuid('Invalid child ID format'),
      timeframe: z.enum(['week', 'month', 'quarter', 'all']).optional().default('month'),
      subjects: z.array(z.string()).optional()
    });

    const { childId, timeframe, subjects } = insightsSchema.parse(req.body);

    // Note: Child access validation would be implemented here
    // For now, assuming all authenticated users have access

    // TODO: Implement feedback history retrieval based on timeframe and subjects
    // For now, use mock data
    const mockFeedbackHistory: FeedbackHistory[] = [
      {
        id: 'feedback_1',
        analysisId: 'analysis_1',
        childId,
        subject: 'mathematics',
        errors: ['computational_error'],
        skillsAssessed: ['basic_addition'],
        timestamp: new Date(Date.now() - 86400000)
      }
    ];

    const insights = await feedbackService.generateLearningInsights(mockFeedbackHistory);

    res.json({
      success: true,
      insights,
      metadata: {
        childId,
        timeframe,
        subjects,
        feedbackCount: mockFeedbackHistory.length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Error generating insights:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/feedback/stats
 * Get feedback generation statistics
 *
 * Query Parameters:
 * - timeframe?: string - Time period for stats ('day', 'week', 'month', 'year', 'all')
 *
 * Response:
 * - Success: FeedbackStats object with generation metrics
 * - Error: { error: string, code: string }
 */
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    const timeframe = req.query.timeframe as string || 'month';

    const stats = feedbackService.getStats();

    res.json({
      success: true,
      stats,
      metadata: {
        timeframe,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Error retrieving feedback stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/feedback/health
 * Health check endpoint for feedback service
 *
 * Response:
 * - Success: Service health status and performance metrics
 * - Error: { error: string, code: string }
 */
router.get('/health', async (req, res) => {
  try {
    const healthStatus = await feedbackService.healthCheck();

    res.json({
      success: true,
      service: 'feedback-generation',
      ...healthStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error checking feedback service health:', error);
    res.status(500).json({
      error: 'Service health check failed',
      code: 'HEALTH_CHECK_FAILED',
      details: error.message
    });
  }
});

export default router;
import express from 'express';
import { z } from 'zod';
import { authenticateUser } from '../middleware/auth';
import { validateChildAccess } from '../middleware/childAccess';
import {
  LearningSessionService,
  CreateSessionRequest,
  UpdateSessionRequest,
  SessionSearchCriteria,
  SessionType,
  SessionState
} from '../services/learningSession';

const router = express.Router();

// Learning session service instance (will be initialized by app.ts)
let sessionService: LearningSessionService;

// Initialize the session service
export const initializeSessionService = (service: LearningSessionService) => {
  sessionService = service;
};

// Request validation schemas
const createSessionSchema = z.object({
  childId: z.string().uuid('Invalid child ID format'),
  sessionType: z.enum(['assessment', 'lesson', 'practice', 'review']),
  title: z.string().min(1).max(200, 'Title must be between 1 and 200 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  subject: z.string().min(1).max(100, 'Subject must be between 1 and 100 characters'),
  topic: z.string().max(100, 'Topic must be less than 100 characters').optional(),
  estimatedDuration: z.number().min(5).max(180, 'Duration must be between 5 and 180 minutes').optional(),
  learningObjectives: z.array(z.object({
    subject: z.string().optional(),
    topic: z.string().optional(),
    description: z.string(),
    targetLevel: z.number().min(1).max(10).optional()
  })).optional(),
  settings: z.object({
    voiceEnabled: z.boolean().optional(),
    ttsEnabled: z.boolean().optional(),
    breakRemindersEnabled: z.boolean().optional(),
    autoSave: z.boolean().optional(),
    autoResume: z.boolean().optional()
  }).optional()
});

const updateSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  parentNotes: z.string().max(2000).optional(),
  settings: z.object({
    voiceEnabled: z.boolean().optional(),
    ttsEnabled: z.boolean().optional(),
    breakRemindersEnabled: z.boolean().optional(),
    autoSave: z.boolean().optional(),
    autoResume: z.boolean().optional()
  }).optional()
});

const searchSessionsSchema = z.object({
  childId: z.string().uuid().optional(),
  sessionType: z.enum(['assessment', 'lesson', 'practice', 'review']).optional(),
  state: z.enum(['not_started', 'active', 'paused', 'break', 'completed', 'abandoned']).optional(),
  subject: z.string().optional(),
  topic: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional()
});

const updateObjectiveSchema = z.object({
  completed: z.boolean().optional(),
  attempts: z.number().min(0).optional(),
  successRate: z.number().min(0).max(1).optional()
});

/**
 * POST /api/sessions
 * Create a new learning session
 *
 * Request Body:
 * - childId: string (UUID) - Child profile ID
 * - sessionType: 'assessment'|'lesson'|'practice'|'review'
 * - title: string - Session title
 * - description?: string - Optional session description
 * - subject: string - Learning subject
 * - topic?: string - Specific topic within subject
 * - estimatedDuration?: number - Expected duration in minutes
 * - learningObjectives?: array - Learning goals for the session
 * - settings?: object - Session preference settings
 *
 * Response:
 * - Success: LearningSession object
 * - Error: { error: string, details?: any }
 */
router.post('/', authenticateUser, async (req, res) => {
  try {
    if (!sessionService) {
      return res.status(503).json({
        error: 'Session service not available',
        details: 'Service initialization pending'
      });
    }

    // Validate request body
    const validation = createSessionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const sessionRequest = validation.data as CreateSessionRequest;

    // Validate child access
    const childAccess = await validateChildAccess(req.user.id, sessionRequest.childId);
    if (!childAccess.hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'No permission to access this child profile'
      });
    }

    // Create session
    const session = await sessionService.createSession(sessionRequest);

    res.status(201).json({
      success: true,
      session,
      message: 'Learning session created successfully'
    });

  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({
      error: 'Failed to create session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/sessions/:sessionId
 * Get session by ID
 *
 * Path Parameters:
 * - sessionId: string - Session ID
 *
 * Response:
 * - Success: LearningSession object
 * - Error: { error: string, details?: any }
 */
router.get('/:sessionId', authenticateUser, async (req, res) => {
  try {
    if (!sessionService) {
      return res.status(503).json({
        error: 'Session service not available',
        details: 'Service initialization pending'
      });
    }

    const { sessionId } = req.params;
    const session = sessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        details: 'The specified session does not exist'
      });
    }

    // Validate child access
    const childAccess = await validateChildAccess(req.user.id, session.childId);
    if (!childAccess.hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'No permission to access this session'
      });
    }

    res.json({
      success: true,
      session
    });

  } catch (error) {
    console.error('Session retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/sessions/:sessionId
 * Update session details
 *
 * Path Parameters:
 * - sessionId: string - Session ID
 *
 * Request Body:
 * - title?: string - Updated title
 * - description?: string - Updated description
 * - notes?: string - Session notes
 * - parentNotes?: string - Parent notes
 * - settings?: object - Updated settings
 *
 * Response:
 * - Success: { success: true, message: string }
 * - Error: { error: string, details?: any }
 */
router.put('/:sessionId', authenticateUser, async (req, res) => {
  try {
    if (!sessionService) {
      return res.status(503).json({
        error: 'Session service not available',
        details: 'Service initialization pending'
      });
    }

    const { sessionId } = req.params;
    const session = sessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        details: 'The specified session does not exist'
      });
    }

    // Validate child access
    const childAccess = await validateChildAccess(req.user.id, session.childId);
    if (!childAccess.hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'No permission to access this session'
      });
    }

    // Validate request body
    const validation = updateSessionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const updates = validation.data;

    // Apply updates
    if (updates.title) session.title = updates.title;
    if (updates.description !== undefined) session.description = updates.description;
    if (updates.notes !== undefined) session.notes = updates.notes;
    if (updates.parentNotes !== undefined) session.parentNotes = updates.parentNotes;
    if (updates.settings) {
      session.settings = { ...session.settings, ...updates.settings };
    }

    session.lastActivity = new Date();

    res.json({
      success: true,
      session,
      message: 'Session updated successfully'
    });

  } catch (error) {
    console.error('Session update error:', error);
    res.status(500).json({
      error: 'Failed to update session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/sessions/:sessionId/start
 * Start a session
 *
 * Path Parameters:
 * - sessionId: string - Session ID
 *
 * Response:
 * - Success: LearningSession object
 * - Error: { error: string, details?: any }
 */
router.post('/:sessionId/start', authenticateUser, async (req, res) => {
  try {
    if (!sessionService) {
      return res.status(503).json({
        error: 'Session service not available',
        details: 'Service initialization pending'
      });
    }

    const { sessionId } = req.params;
    const session = sessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        details: 'The specified session does not exist'
      });
    }

    // Validate child access
    const childAccess = await validateChildAccess(req.user.id, session.childId);
    if (!childAccess.hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'No permission to access this session'
      });
    }

    const updatedSession = await sessionService.startSession(sessionId);

    res.json({
      success: true,
      session: updatedSession,
      message: 'Session started successfully'
    });

  } catch (error) {
    console.error('Session start error:', error);
    res.status(500).json({
      error: 'Failed to start session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/sessions/:sessionId/pause
 * Pause an active session
 *
 * Path Parameters:
 * - sessionId: string - Session ID
 *
 * Request Body:
 * - reason?: string - Optional reason for pausing
 *
 * Response:
 * - Success: LearningSession object
 * - Error: { error: string, details?: any }
 */
router.post('/:sessionId/pause', authenticateUser, async (req, res) => {
  try {
    if (!sessionService) {
      return res.status(503).json({
        error: 'Session service not available',
        details: 'Service initialization pending'
      });
    }

    const { sessionId } = req.params;
    const { reason } = req.body;
    const session = sessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        details: 'The specified session does not exist'
      });
    }

    // Validate child access
    const childAccess = await validateChildAccess(req.user.id, session.childId);
    if (!childAccess.hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'No permission to access this session'
      });
    }

    const updatedSession = await sessionService.pauseSession(sessionId, reason);

    res.json({
      success: true,
      session: updatedSession,
      message: 'Session paused successfully'
    });

  } catch (error) {
    console.error('Session pause error:', error);
    res.status(500).json({
      error: 'Failed to pause session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/sessions/:sessionId/resume
 * Resume a paused session
 *
 * Path Parameters:
 * - sessionId: string - Session ID
 *
 * Response:
 * - Success: LearningSession object
 * - Error: { error: string, details?: any }
 */
router.post('/:sessionId/resume', authenticateUser, async (req, res) => {
  try {
    if (!sessionService) {
      return res.status(503).json({
        error: 'Session service not available',
        details: 'Service initialization pending'
      });
    }

    const { sessionId } = req.params;
    const session = sessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        details: 'The specified session does not exist'
      });
    }

    // Validate child access
    const childAccess = await validateChildAccess(req.user.id, session.childId);
    if (!childAccess.hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'No permission to access this session'
      });
    }

    const updatedSession = await sessionService.resumeSession(sessionId);

    res.json({
      success: true,
      session: updatedSession,
      message: 'Session resumed successfully'
    });

  } catch (error) {
    console.error('Session resume error:', error);
    res.status(500).json({
      error: 'Failed to resume session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/sessions/:sessionId/break
 * Start a break for an active session
 *
 * Path Parameters:
 * - sessionId: string - Session ID
 *
 * Request Body:
 * - breakType?: 'gentle'|'suggested'|'required' - Type of break
 *
 * Response:
 * - Success: LearningSession object
 * - Error: { error: string, details?: any }
 */
router.post('/:sessionId/break', authenticateUser, async (req, res) => {
  try {
    if (!sessionService) {
      return res.status(503).json({
        error: 'Session service not available',
        details: 'Service initialization pending'
      });
    }

    const { sessionId } = req.params;
    const { breakType = 'suggested' } = req.body;
    const session = sessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        details: 'The specified session does not exist'
      });
    }

    // Validate child access
    const childAccess = await validateChildAccess(req.user.id, session.childId);
    if (!childAccess.hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'No permission to access this session'
      });
    }

    const updatedSession = await sessionService.startBreak(sessionId, breakType);

    res.json({
      success: true,
      session: updatedSession,
      message: 'Break started successfully'
    });

  } catch (error) {
    console.error('Session break error:', error);
    res.status(500).json({
      error: 'Failed to start break',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/sessions/:sessionId/complete
 * Complete a session
 *
 * Path Parameters:
 * - sessionId: string - Session ID
 *
 * Request Body:
 * - completionNotes?: string - Optional completion notes
 *
 * Response:
 * - Success: LearningSession object
 * - Error: { error: string, details?: any }
 */
router.post('/:sessionId/complete', authenticateUser, async (req, res) => {
  try {
    if (!sessionService) {
      return res.status(503).json({
        error: 'Session service not available',
        details: 'Service initialization pending'
      });
    }

    const { sessionId } = req.params;
    const { completionNotes } = req.body;
    const session = sessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        details: 'The specified session does not exist'
      });
    }

    // Validate child access
    const childAccess = await validateChildAccess(req.user.id, session.childId);
    if (!childAccess.hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'No permission to access this session'
      });
    }

    const completedSession = await sessionService.completeSession(sessionId, completionNotes);

    res.json({
      success: true,
      session: completedSession,
      message: 'Session completed successfully'
    });

  } catch (error) {
    console.error('Session completion error:', error);
    res.status(500).json({
      error: 'Failed to complete session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/sessions/:sessionId/objectives/:objectiveId
 * Update learning objective progress
 *
 * Path Parameters:
 * - sessionId: string - Session ID
 * - objectiveId: string - Learning objective ID
 *
 * Request Body:
 * - completed?: boolean - Mark objective as completed
 * - attempts?: number - Number of attempts
 * - successRate?: number - Success rate (0-1)
 *
 * Response:
 * - Success: LearningSession object
 * - Error: { error: string, details?: any }
 */
router.post('/:sessionId/objectives/:objectiveId', authenticateUser, async (req, res) => {
  try {
    if (!sessionService) {
      return res.status(503).json({
        error: 'Session service not available',
        details: 'Service initialization pending'
      });
    }

    const { sessionId, objectiveId } = req.params;
    const session = sessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        details: 'The specified session does not exist'
      });
    }

    // Validate child access
    const childAccess = await validateChildAccess(req.user.id, session.childId);
    if (!childAccess.hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'No permission to access this session'
      });
    }

    // Validate request body
    const validation = updateObjectiveSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const progress = validation.data;
    const updatedSession = await sessionService.updateObjectiveProgress(sessionId, objectiveId, progress);

    res.json({
      success: true,
      session: updatedSession,
      message: 'Objective progress updated successfully'
    });

  } catch (error) {
    console.error('Objective update error:', error);
    res.status(500).json({
      error: 'Failed to update objective progress',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/sessions
 * Search sessions by criteria
 *
 * Query Parameters:
 * - childId?: string (UUID) - Filter by child ID
 * - sessionType?: string - Filter by session type
 * - state?: string - Filter by session state
 * - subject?: string - Filter by subject
 * - topic?: string - Filter by topic
 * - dateFrom?: string (ISO date) - Filter by start date
 * - dateTo?: string (ISO date) - Filter by end date
 * - limit?: number - Limit results (default: 50, max: 100)
 * - offset?: number - Offset for pagination
 *
 * Response:
 * - Success: { sessions: LearningSession[], count: number }
 * - Error: { error: string, details?: any }
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    if (!sessionService) {
      return res.status(503).json({
        error: 'Session service not available',
        details: 'Service initialization pending'
      });
    }

    // Validate query parameters
    const validation = searchSessionsSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.issues
      });
    }

    const criteria = validation.data as SessionSearchCriteria;

    // Convert date strings to Date objects
    if (criteria.dateFrom) {
      criteria.dateFrom = new Date(criteria.dateFrom);
    }
    if (criteria.dateTo) {
      criteria.dateTo = new Date(criteria.dateTo);
    }

    // If childId is specified, validate access
    if (criteria.childId) {
      const childAccess = await validateChildAccess(req.user.id, criteria.childId);
      if (!childAccess.hasAccess) {
        return res.status(403).json({
          error: 'Access denied',
          details: 'No permission to access sessions for this child'
        });
      }
    }

    const sessions = await sessionService.searchSessions(criteria);

    res.json({
      success: true,
      sessions,
      count: sessions.length,
      criteria
    });

  } catch (error) {
    console.error('Session search error:', error);
    res.status(500).json({
      error: 'Failed to search sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/sessions/child/:childId/active
 * Get all active sessions for a child
 *
 * Path Parameters:
 * - childId: string (UUID) - Child profile ID
 *
 * Response:
 * - Success: { sessions: LearningSession[], count: number }
 * - Error: { error: string, details?: any }
 */
router.get('/child/:childId/active', authenticateUser, async (req, res) => {
  try {
    if (!sessionService) {
      return res.status(503).json({
        error: 'Session service not available',
        details: 'Service initialization pending'
      });
    }

    const { childId } = req.params;

    // Validate child access
    const childAccess = await validateChildAccess(req.user.id, childId);
    if (!childAccess.hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'No permission to access sessions for this child'
      });
    }

    const sessions = sessionService.getChildActiveSessions(childId);

    res.json({
      success: true,
      sessions,
      count: sessions.length,
      childId
    });

  } catch (error) {
    console.error('Active sessions retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve active sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/sessions/:sessionId/voice-interaction
 * Record a voice interaction in the session
 *
 * Path Parameters:
 * - sessionId: string - Session ID
 *
 * Request Body:
 * - responseTime?: number - Response time in milliseconds
 * - confidence?: number - Confidence level (0-1)
 *
 * Response:
 * - Success: { success: true, message: string }
 * - Error: { error: string, details?: any }
 */
router.post('/:sessionId/voice-interaction', authenticateUser, async (req, res) => {
  try {
    if (!sessionService) {
      return res.status(503).json({
        error: 'Session service not available',
        details: 'Service initialization pending'
      });
    }

    const { sessionId } = req.params;
    const { responseTime, confidence } = req.body;

    // Validate session exists and user has access
    const session = sessionService.getSession(sessionId);
    if (session) {
      const childAccess = await validateChildAccess(req.user.id, session.childId);
      if (!childAccess.hasAccess) {
        return res.status(403).json({
          error: 'Access denied',
          details: 'No permission to access this session'
        });
      }
    }

    await sessionService.recordVoiceInteraction(sessionId, { responseTime, confidence });

    res.json({
      success: true,
      message: 'Voice interaction recorded successfully'
    });

  } catch (error) {
    console.error('Voice interaction recording error:', error);
    res.status(500).json({
      error: 'Failed to record voice interaction',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
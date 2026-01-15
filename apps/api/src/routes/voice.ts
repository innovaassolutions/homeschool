import express from 'express';
import winston from 'winston';
import { authenticateToken, validateFamilyAccess, ageAppropriateContent } from '../middleware/auth';
import {
  VoiceProcessingMiddleware,
  createVoiceProcessingMiddleware,
  defaultVoiceProcessingConfig,
  VoiceProcessingRequest
} from '../middleware/voiceProcessing';
import {
  VoiceConversationIntegrationService,
  VoiceConversationRequest,
  createVoiceConversationIntegrationService
} from '../services/voiceConversationIntegration';
import {
  VoiceRecognitionService,
  createVoiceRecognitionService,
  defaultVoiceRecognitionConfig,
  VoiceRecognitionConfig
} from '../services/voiceRecognition';
import {
  AudioProcessingService,
  createAudioProcessingService,
  defaultAudioProcessingConfig
} from '../services/audioProcessing';
import { ChatGPTService } from '../services/chatgpt';
import { TextToSpeechService } from '../services/textToSpeech';
import { AgeGroup, ConversationContext } from '../services/chatgpt';

const router = express.Router();

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

// Initialize services
let voiceIntegrationService: VoiceConversationIntegrationService;
let voiceProcessingMiddleware: VoiceProcessingMiddleware;

// Service initialization with dependency injection
export function initializeVoiceServices(chatGPTService: ChatGPTService, ttsService?: TextToSpeechService): void {
  // Voice recognition configuration
  const voiceConfig: VoiceRecognitionConfig = {
    ...defaultVoiceRecognitionConfig,
    openaiApiKey: process.env.OPENAI_API_KEY || '',
  };

  // Initialize services
  const voiceRecognitionService = createVoiceRecognitionService(voiceConfig, logger);
  const audioProcessingService = createAudioProcessingService(defaultAudioProcessingConfig, logger);

  // For backward compatibility, create a default TTS service if none provided
  if (!ttsService) {
    const { createTextToSpeechService } = require('../services/textToSpeech');
    ttsService = createTextToSpeechService();
  }

  voiceIntegrationService = createVoiceConversationIntegrationService(
    chatGPTService,
    voiceRecognitionService,
    audioProcessingService,
    ttsService,
    logger
  );

  // Initialize middleware
  const voiceProcessingConfig = {
    ...defaultVoiceProcessingConfig,
    encryptionKey: process.env.AUDIO_ENCRYPTION_KEY || undefined
  };

  voiceProcessingMiddleware = createVoiceProcessingMiddleware(voiceProcessingConfig, logger);

  logger.info('Voice services initialized successfully');
}

/**
 * POST /api/voice/conversation
 *
 * Process voice input and return ChatGPT response
 * Handles complete voice-to-text-to-ChatGPT-to-response pipeline
 */
router.post('/conversation',
  authenticateToken,
  validateFamilyAccess,
  ageAppropriateContent,
  voiceProcessingMiddleware.addSecurityHeaders,
  voiceProcessingMiddleware.handleAudioUpload,
  voiceProcessingMiddleware.verifyCOPPACompliance,
  voiceProcessingMiddleware.encryptAudioData,
  voiceProcessingMiddleware.ensureDataDisposal,
  async (req: VoiceProcessingRequest, res: express.Response) => {
    try {
      const user = (req as any).user;
      const childProfile = (req as any).childProfile;

      if (!req.audioFile || !req.audioMetadata || !req.coppaCompliance) {
        return res.status(400).json({
          error: 'invalid_request',
          message: 'Missing required audio data or compliance verification'
        });
      }

      // Extract conversation context from request
      const conversationContext: ConversationContext = {
        childId: childProfile.id,
        ageGroup: childProfile.age_group as AgeGroup,
        subject: req.body.subject || 'general',
        topic: req.body.topic || '',
        learningStyle: childProfile.learning_style,
        interests: childProfile.interests,
        accessibilityNeeds: childProfile.accessibility_needs,
        sessionId: req.body.sessionId || `session_${Date.now()}`,
        conversationHistory: req.body.conversationHistory || []
      };

      // Prepare voice conversation request
      const voiceRequest: VoiceConversationRequest = {
        sessionId: conversationContext.sessionId,
        audioBuffer: req.audioFile.buffer,
        audioMetadata: {
          format: req.audioMetadata.format,
          sampleRate: 16000, // Standard for speech recognition
          channels: 1,
          duration: 0, // Will be calculated during processing
          size: req.audioMetadata.size,
          quality: 'medium'
        },
        conversationContext,
        options: {
          skipAudioProcessing: req.body.skipAudioProcessing === true,
          requireHighConfidence: req.body.requireHighConfidence === true,
          enableFallback: true
        }
      };

      // Process voice conversation
      const response = await voiceIntegrationService.processVoiceConversation(voiceRequest);

      if (!response.success) {
        logger.warn('Voice conversation processing failed', {
          sessionId: conversationContext.sessionId,
          error: response.error,
          childId: childProfile.id
        });

        return res.status(500).json({
          error: 'processing_failed',
          message: response.error || 'Voice processing failed',
          clarificationNeeded: response.clarificationNeeded,
          clarificationMessage: response.clarificationMessage
        });
      }

      // Handle clarification needed
      if (response.clarificationNeeded) {
        return res.status(200).json({
          success: true,
          clarificationNeeded: true,
          clarificationMessage: response.clarificationMessage,
          processingTime: response.processingTime,
          session: {
            sessionId: response.sessionUpdated.sessionId,
            totalInteractions: response.sessionUpdated.totalInteractions,
            qualityMetrics: response.sessionUpdated.qualityMetrics
          }
        });
      }

      // Return successful response
      res.status(200).json({
        success: true,
        transcription: {
          text: response.transcription?.text,
          confidence: response.transcription?.confidence,
          ageGroup: response.transcription?.ageGroup
        },
        chatGPTResponse: {
          content: response.chatGPTResponse?.content,
          filtered: response.chatGPTResponse?.filtered,
          ageAppropriate: response.chatGPTResponse?.ageAppropriate,
          tokenUsage: response.chatGPTResponse?.tokenUsage
        },
        audioQuality: response.audioQuality ? {
          overallScore: response.audioQuality.overallScore,
          recommendations: response.audioQuality.processingApplied
        } : undefined,
        session: {
          sessionId: response.sessionUpdated.sessionId,
          totalInteractions: response.sessionUpdated.totalInteractions,
          qualityMetrics: response.sessionUpdated.qualityMetrics
        },
        processingTime: response.processingTime,
        coppaCompliant: true
      });

    } catch (error) {
      logger.error('Voice conversation API error', {
        error: error instanceof Error ? error.message : error,
        childId: (req as any).childProfile?.id,
        sessionId: req.body.sessionId
      });

      res.status(500).json({
        error: 'internal_server_error',
        message: 'An unexpected error occurred while processing your voice input'
      });
    }
  }
);

/**
 * GET /api/voice/session/:sessionId
 *
 * Get voice conversation session details
 */
router.get('/session/:sessionId',
  authenticateToken,
  validateFamilyAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      const sessionId = req.params.sessionId;
      const session = voiceIntegrationService.getSession(sessionId);

      if (!session) {
        return res.status(404).json({
          error: 'session_not_found',
          message: 'Voice conversation session not found'
        });
      }

      // Verify session belongs to authenticated user
      const childProfile = (req as any).childProfile;
      if (session.childId !== childProfile.id) {
        return res.status(403).json({
          error: 'access_denied',
          message: 'You can only access your own conversation sessions'
        });
      }

      res.status(200).json({
        sessionId: session.sessionId,
        ageGroup: session.ageGroup,
        startTime: session.startTime,
        lastActivity: session.lastActivity,
        totalInteractions: session.totalInteractions,
        averageResponseTime: session.averageResponseTime,
        qualityMetrics: session.qualityMetrics,
        isActive: session.isActive
      });

    } catch (error) {
      logger.error('Session retrieval error', {
        error: error instanceof Error ? error.message : error,
        sessionId: req.params.sessionId
      });

      res.status(500).json({
        error: 'internal_server_error',
        message: 'Unable to retrieve session information'
      });
    }
  }
);

/**
 * DELETE /api/voice/session/:sessionId
 *
 * End voice conversation session
 */
router.delete('/session/:sessionId',
  authenticateToken,
  validateFamilyAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      const sessionId = req.params.sessionId;
      const session = voiceIntegrationService.getSession(sessionId);

      if (!session) {
        return res.status(404).json({
          error: 'session_not_found',
          message: 'Voice conversation session not found'
        });
      }

      // Verify session belongs to authenticated user
      const childProfile = (req as any).childProfile;
      if (session.childId !== childProfile.id) {
        return res.status(403).json({
          error: 'access_denied',
          message: 'You can only manage your own conversation sessions'
        });
      }

      await voiceIntegrationService.endSession(sessionId);

      res.status(200).json({
        success: true,
        message: 'Voice conversation session ended successfully',
        sessionId
      });

    } catch (error) {
      logger.error('Session termination error', {
        error: error instanceof Error ? error.message : error,
        sessionId: req.params.sessionId
      });

      res.status(500).json({
        error: 'internal_server_error',
        message: 'Unable to end session'
      });
    }
  }
);

/**
 * GET /api/voice/stats
 *
 * Get voice processing statistics (for parents/administrators)
 */
router.get('/stats',
  authenticateToken,
  validateFamilyAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      const user = (req as any).user;

      // Only parents can access comprehensive stats
      if (user.userType !== 'parent') {
        return res.status(403).json({
          error: 'parent_access_required',
          message: 'Only parents can access voice processing statistics'
        });
      }

      const integrationStats = voiceIntegrationService.getStats();
      const complianceStats = voiceProcessingMiddleware.getComplianceStats();

      res.status(200).json({
        integration: integrationStats,
        compliance: {
          totalProcessingRequests: complianceStats.totalProcessingRequests,
          consentVerificationRate: complianceStats.consentVerificationRate,
          dataRetentionRate: complianceStats.dataRetentionRate, // Should be 0 for COPPA compliance
          errorRate: complianceStats.errorRate,
          ageGroupBreakdown: complianceStats.ageGroupBreakdown
        },
        coppaCompliant: complianceStats.dataRetentionRate === 0
      });

    } catch (error) {
      logger.error('Stats retrieval error', {
        error: error instanceof Error ? error.message : error,
        userId: (req as any).user?.id
      });

      res.status(500).json({
        error: 'internal_server_error',
        message: 'Unable to retrieve voice processing statistics'
      });
    }
  }
);

/**
 * GET /api/voice/capabilities
 *
 * Get voice processing capabilities and requirements
 */
router.get('/capabilities',
  authenticateToken,
  async (req: express.Request, res: express.Response) => {
    try {
      const childProfile = (req as any).childProfile;
      const ageGroup = childProfile?.age_group as AgeGroup || 'ages10to13';

      // Get capabilities from services
      const audioProcessingService = createAudioProcessingService(defaultAudioProcessingConfig, logger);
      const voiceRecognitionService = createVoiceRecognitionService({
        ...defaultVoiceRecognitionConfig,
        openaiApiKey: process.env.OPENAI_API_KEY || ''
      }, logger);

      const processingCapabilities = audioProcessingService.getProcessingCapabilities();
      const recommendedSettings = voiceRecognitionService.getRecommendedSettings(ageGroup);
      const audioSettings = audioProcessingService.getRecommendedCaptureSettings(ageGroup);

      res.status(200).json({
        ageGroup,
        audioProcessing: {
          supportedFormats: processingCapabilities.supportedFormats,
          maxProcessingTime: processingCapabilities.maxProcessingTime,
          featuresEnabled: processingCapabilities.featuresEnabled
        },
        voiceRecognition: {
          recommendedSettings,
          supportedLanguages: ['en'], // Expandable
          confidenceThresholds: {
            ages6to9: 0.6,
            ages10to13: 0.7,
            ages14to16: 0.8
          }
        },
        audioCapture: audioSettings,
        coppaRequirements: {
          parentalConsentRequired: true,
          noDataRetention: true,
          immediateDisposal: true,
          auditLogging: true
        }
      });

    } catch (error) {
      logger.error('Capabilities retrieval error', {
        error: error instanceof Error ? error.message : error
      });

      res.status(500).json({
        error: 'internal_server_error',
        message: 'Unable to retrieve voice processing capabilities'
      });
    }
  }
);

/**
 * POST /api/voice/test-audio
 *
 * Test audio quality without full processing (for setup/debugging)
 */
router.post('/test-audio',
  authenticateToken,
  validateFamilyAccess,
  voiceProcessingMiddleware.addSecurityHeaders,
  voiceProcessingMiddleware.handleAudioUpload,
  voiceProcessingMiddleware.verifyCOPPACompliance,
  voiceProcessingMiddleware.ensureDataDisposal,
  async (req: VoiceProcessingRequest, res: express.Response) => {
    try {
      if (!req.audioFile || !req.audioMetadata) {
        return res.status(400).json({
          error: 'no_audio_data',
          message: 'No audio file provided for testing'
        });
      }

      const childProfile = (req as any).childProfile;
      const ageGroup = childProfile.age_group as AgeGroup;

      // Quick audio quality assessment
      const audioProcessingService = createAudioProcessingService(defaultAudioProcessingConfig, logger);

      const qualityResult = await audioProcessingService.processAudio(
        req.audioFile.buffer,
        {
          format: req.audioMetadata.format,
          sampleRate: 16000,
          channels: 1,
          duration: req.body.duration || 0,
          size: req.audioMetadata.size,
          quality: 'medium'
        },
        ageGroup,
        { skipQualityCheck: false }
      );

      res.status(200).json({
        audioQuality: {
          overallScore: qualityResult.quality.overallScore,
          issues: qualityResult.quality.issues,
          recommendations: qualityResult.recommendations
        },
        processingRecommended: audioProcessingService.isProcessingRequired(qualityResult.quality),
        ageGroup,
        coppaCompliant: true
      });

    } catch (error) {
      logger.error('Audio test error', {
        error: error instanceof Error ? error.message : error
      });

      res.status(500).json({
        error: 'audio_test_failed',
        message: 'Unable to test audio quality'
      });
    }
  }
);

/**
 * POST /api/voice/session/:sessionId/link-learning-session
 *
 * Link a voice conversation session with a learning session
 */
router.post('/session/:sessionId/link-learning-session',
  authenticateToken,
  validateFamilyAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      const sessionId = req.params.sessionId;
      const { learningSessionId } = req.body;

      if (!learningSessionId) {
        return res.status(400).json({
          error: 'missing_learning_session_id',
          message: 'Learning session ID is required'
        });
      }

      const session = voiceIntegrationService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          error: 'session_not_found',
          message: 'Voice conversation session not found'
        });
      }

      // Verify session belongs to authenticated user
      const childProfile = (req as any).childProfile;
      if (session.childId !== childProfile.id) {
        return res.status(403).json({
          error: 'access_denied',
          message: 'You can only link your own conversation sessions'
        });
      }

      const linkedSession = await voiceIntegrationService.linkLearningSession(sessionId, learningSessionId);

      res.status(200).json({
        success: true,
        message: 'Voice session linked to learning session successfully',
        sessionId: linkedSession.sessionId,
        learningSessionId: linkedSession.learningSessionId
      });

    } catch (error) {
      logger.error('Session linking error', {
        error: error instanceof Error ? error.message : error,
        sessionId: req.params.sessionId,
        learningSessionId: req.body.learningSessionId
      });

      res.status(500).json({
        error: 'internal_server_error',
        message: 'Unable to link voice session to learning session'
      });
    }
  }
);

export default router;
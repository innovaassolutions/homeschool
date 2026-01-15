import winston from 'winston';
import { LearningSession, LearningSessionService } from './learningSession';
import { ProgressTrackingService, VoiceInteractionData, PhotoAssessmentResult } from './progressTracking';

/**
 * Session Progress Integration Service
 *
 * Orchestrates automatic progress tracking when learning sessions complete
 * and integrates data from voice interactions and photo assessments.
 */
export class SessionProgressIntegrationService {
  private logger: winston.Logger;
  private progressTrackingService: ProgressTrackingService;
  private learningSessionService: LearningSessionService;

  // Cache for pending session data before completion
  private pendingVoiceData: Map<string, VoiceInteractionData[]> = new Map();
  private pendingPhotoAssessments: Map<string, PhotoAssessmentResult[]> = new Map();

  constructor(
    progressTrackingService: ProgressTrackingService,
    learningSessionService: LearningSessionService,
    logger: winston.Logger
  ) {
    this.progressTrackingService = progressTrackingService;
    this.learningSessionService = learningSessionService;
    this.logger = logger;

    this.logger.info('SessionProgressIntegrationService initialized');
  }

  /**
   * Automatically track progress when a session is completed
   */
  async onSessionCompleted(sessionId: string): Promise<void> {
    try {
      const session = this.learningSessionService.getSession(sessionId);
      if (!session) {
        this.logger.warn('Session not found for progress tracking', { sessionId });
        return;
      }

      // Get any pending voice and photo data for this session
      const voiceData = this.pendingVoiceData.get(sessionId) || [];
      const photoAssessments = this.pendingPhotoAssessments.get(sessionId) || [];

      // Track the complete session progress
      const progress = await this.progressTrackingService.trackSessionProgress(
        session,
        voiceData,
        photoAssessments
      );

      // Clean up pending data
      this.pendingVoiceData.delete(sessionId);
      this.pendingPhotoAssessments.delete(sessionId);

      this.logger.info('Session completion progress tracked', {
        sessionId,
        childId: session.childId,
        subject: session.subject,
        overallProgress: progress.overallProgress,
        voiceInteractions: voiceData.length,
        photoAssessments: photoAssessments.length,
        skillUpdates: progress.skillMasteryUpdates.length
      });

    } catch (error) {
      this.logger.error('Failed to track session completion progress', {
        error: error instanceof Error ? error.message : error,
        sessionId
      });
    }
  }

  /**
   * Record voice interaction during an active session
   */
  async recordVoiceInteraction(
    sessionId: string,
    interactionData: {
      interactionCount: number;
      averageResponseTime: number;
      confidenceLevel: number;
      topicsDiscussed: string[];
      skillsDemonstrated: string[];
      languageComplexity: number;
    }
  ): Promise<void> {
    try {
      const session = this.learningSessionService.getSession(sessionId);
      if (!session) {
        this.logger.warn('Session not found for voice interaction recording', { sessionId });
        return;
      }

      const voiceData: VoiceInteractionData = {
        sessionId,
        ...interactionData
      };

      // If session is still active, store as pending data
      if (session.state !== 'completed') {
        const existing = this.pendingVoiceData.get(sessionId) || [];
        existing.push(voiceData);
        this.pendingVoiceData.set(sessionId, existing);

        // Also update progress tracking in real-time
        await this.progressTrackingService.addVoiceInteractionData(sessionId, voiceData);
      } else {
        // Session already completed, directly add to progress
        await this.progressTrackingService.addVoiceInteractionData(sessionId, voiceData);
      }

      this.logger.debug('Voice interaction recorded for session', {
        sessionId,
        skillsDemonstrated: interactionData.skillsDemonstrated.length,
        confidenceLevel: interactionData.confidenceLevel
      });

    } catch (error) {
      this.logger.error('Failed to record voice interaction', {
        error: error instanceof Error ? error.message : error,
        sessionId
      });
    }
  }

  /**
   * Record photo assessment result during an active session
   */
  async recordPhotoAssessment(
    sessionId: string,
    assessmentResult: PhotoAssessmentResult
  ): Promise<void> {
    try {
      const session = this.learningSessionService.getSession(sessionId);
      if (!session) {
        this.logger.warn('Session not found for photo assessment recording', { sessionId });
        return;
      }

      // If session is still active, store as pending data
      if (session.state !== 'completed') {
        const existing = this.pendingPhotoAssessments.get(sessionId) || [];
        existing.push(assessmentResult);
        this.pendingPhotoAssessments.set(sessionId, existing);

        // Also update progress tracking in real-time
        await this.progressTrackingService.addPhotoAssessmentResult(sessionId, assessmentResult);
      } else {
        // Session already completed, directly add to progress
        await this.progressTrackingService.addPhotoAssessmentResult(sessionId, assessmentResult);
      }

      this.logger.debug('Photo assessment recorded for session', {
        sessionId,
        subject: assessmentResult.subject,
        correctnessScore: assessmentResult.correctnessScore,
        skillsAssessed: assessmentResult.skillsAssessed.length
      });

    } catch (error) {
      this.logger.error('Failed to record photo assessment', {
        error: error instanceof Error ? error.message : error,
        sessionId
      });
    }
  }

  /**
   * Get comprehensive progress data for a session
   */
  async getSessionProgressData(sessionId: string) {
    try {
      const session = this.learningSessionService.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const progressData = this.progressTrackingService.getSessionProgress(sessionId);
      const pendingVoice = this.pendingVoiceData.get(sessionId) || [];
      const pendingPhotos = this.pendingPhotoAssessments.get(sessionId) || [];

      return {
        session,
        progressData,
        pendingVoiceInteractions: pendingVoice.length,
        pendingPhotoAssessments: pendingPhotos.length,
        isComplete: session.state === 'completed'
      };

    } catch (error) {
      this.logger.error('Failed to get session progress data', {
        error: error instanceof Error ? error.message : error,
        sessionId
      });
      throw error;
    }
  }

  /**
   * Get progress analytics for a child across all sessions
   */
  async getChildProgressAnalytics(
    childId: string,
    timeRange?: { start: Date; end: Date }
  ) {
    try {
      const defaultTimeRange = timeRange || {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        end: new Date()
      };

      const analytics = await this.progressTrackingService.generateProgressAnalytics(
        childId,
        defaultTimeRange
      );

      this.logger.debug('Child progress analytics generated', {
        childId,
        sessionsAnalyzed: analytics.totalSessions,
        timeRange: `${defaultTimeRange.start.toISOString()} to ${defaultTimeRange.end.toISOString()}`
      });

      return analytics;

    } catch (error) {
      this.logger.error('Failed to get child progress analytics', {
        error: error instanceof Error ? error.message : error,
        childId
      });
      throw error;
    }
  }

  /**
   * Manual sync for ensuring all session data is properly tracked
   */
  async syncSessionProgress(sessionId: string): Promise<void> {
    try {
      const session = this.learningSessionService.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Force update progress tracking with current session state
      const voiceData = this.pendingVoiceData.get(sessionId) || [];
      const photoAssessments = this.pendingPhotoAssessments.get(sessionId) || [];

      await this.progressTrackingService.trackSessionProgress(
        session,
        voiceData,
        photoAssessments
      );

      this.logger.info('Session progress manually synced', {
        sessionId,
        state: session.state
      });

    } catch (error) {
      this.logger.error('Failed to sync session progress', {
        error: error instanceof Error ? error.message : error,
        sessionId
      });
      throw error;
    }
  }

  /**
   * Hook into learning session completion event
   */
  setupSessionCompletionHook(): void {
    // This would integrate with the learning session service's completion event
    // For now, it's designed to be called manually when sessions complete
    this.logger.info('Session completion hook setup complete');
  }

  /**
   * Get pending data summary for debugging/monitoring
   */
  getPendingDataSummary(): {
    sessionsWithPendingVoiceData: number;
    sessionsWithPendingPhotoData: number;
    totalPendingVoiceInteractions: number;
    totalPendingPhotoAssessments: number;
  } {
    const totalVoiceInteractions = Array.from(this.pendingVoiceData.values())
      .reduce((total, interactions) => total + interactions.length, 0);

    const totalPhotoAssessments = Array.from(this.pendingPhotoAssessments.values())
      .reduce((total, assessments) => total + assessments.length, 0);

    return {
      sessionsWithPendingVoiceData: this.pendingVoiceData.size,
      sessionsWithPendingPhotoData: this.pendingPhotoAssessments.size,
      totalPendingVoiceInteractions: totalVoiceInteractions,
      totalPendingPhotoAssessments: totalPhotoAssessments
    };
  }

  /**
   * Clean up old pending data for abandoned sessions
   */
  cleanupAbandonedSessions(maxAgeHours: number = 24): void {
    const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    let cleaned = 0;

    // Check each session in pending data
    const allSessionIds = new Set([
      ...this.pendingVoiceData.keys(),
      ...this.pendingPhotoAssessments.keys()
    ]);

    allSessionIds.forEach(sessionId => {
      const session = this.learningSessionService.getSession(sessionId);

      // If session doesn't exist or is very old and not completed, clean up
      if (!session || (session.lastActivity.getTime() < cutoff && session.state !== 'completed')) {
        this.pendingVoiceData.delete(sessionId);
        this.pendingPhotoAssessments.delete(sessionId);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      this.logger.info('Cleaned up abandoned session data', {
        sessionsCleanedUp: cleaned,
        maxAgeHours
      });
    }
  }
}

/**
 * Factory function to create SessionProgressIntegrationService
 */
export function createSessionProgressIntegrationService(
  progressTrackingService: ProgressTrackingService,
  learningSessionService: LearningSessionService,
  logger: winston.Logger
): SessionProgressIntegrationService {
  return new SessionProgressIntegrationService(
    progressTrackingService,
    learningSessionService,
    logger
  );
}
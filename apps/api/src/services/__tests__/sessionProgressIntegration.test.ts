import winston from 'winston';
import { SessionProgressIntegrationService } from '../sessionProgressIntegration';
import { ProgressTrackingService } from '../progressTracking';
import { LearningSessionService, LearningSession } from '../learningSession';

// Mock the dependencies
jest.mock('../progressTracking');
jest.mock('../learningSession');

describe('SessionProgressIntegrationService', () => {
  let integrationService: SessionProgressIntegrationService;
  let mockProgressTrackingService: jest.Mocked<ProgressTrackingService>;
  let mockLearningSessionService: jest.Mocked<LearningSessionService>;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    // Create mock services
    mockProgressTrackingService = {
      trackSessionProgress: jest.fn(),
      addVoiceInteractionData: jest.fn(),
      addPhotoAssessmentResult: jest.fn(),
      getSessionProgress: jest.fn(),
      generateProgressAnalytics: jest.fn(),
    } as any;

    mockLearningSessionService = {
      getSession: jest.fn(),
    } as any;

    integrationService = new SessionProgressIntegrationService(
      mockProgressTrackingService,
      mockLearningSessionService,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onSessionCompleted', () => {
    const mockSession: LearningSession = {
      sessionId: 'test-session-1',
      childId: 'child-123',
      ageGroup: 'ages10to13',
      sessionType: 'lesson',
      state: 'completed',
      title: 'Math Lesson',
      subject: 'mathematics',
      topic: 'algebra',
      createdAt: new Date(),
      startedAt: new Date(),
      lastActivity: new Date(),
      completedAt: new Date(),
      timingConfig: {
        recommendedDuration: 30,
        maxDuration: 45,
        breakInterval: 20,
        breakDuration: 5,
        warningBeforeBreak: 3
      },
      learningObjectives: [],
      progressMarkers: [],
      breakReminders: [],
      totalBreakTime: 0,
      statistics: {
        totalDuration: 1800000,
        activeDuration: 1800000,
        breakDuration: 0,
        interactionCount: 10,
        objectivesCompleted: 1,
        objectivesAttempted: 1,
        averageResponseTime: 2000,
        engagementScore: 85,
        completionRate: 1.0
      },
      settings: {
        voiceEnabled: true,
        ttsEnabled: true,
        breakRemindersEnabled: true,
        autoSave: true,
        autoResume: true
      }
    };

    const mockProgress = {
      sessionId: 'test-session-1',
      childId: 'child-123',
      subject: 'mathematics',
      overallProgress: 0.85,
      skillMasteryUpdates: [
        {
          skillId: 'math-algebra',
          skillName: 'Algebra',
          previousLevel: 5,
          newLevel: 7,
          evidenceSource: 'objective_completion',
          confidence: 0.9,
          timestamp: new Date()
        }
      ]
    };

    it('should track progress when session is completed', async () => {
      mockLearningSessionService.getSession.mockReturnValue(mockSession);
      mockProgressTrackingService.trackSessionProgress.mockResolvedValue(mockProgress as any);

      await integrationService.onSessionCompleted('test-session-1');

      expect(mockLearningSessionService.getSession).toHaveBeenCalledWith('test-session-1');
      expect(mockProgressTrackingService.trackSessionProgress).toHaveBeenCalledWith(
        mockSession,
        [],
        []
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Session completion progress tracked',
        expect.objectContaining({
          sessionId: 'test-session-1',
          childId: 'child-123',
          subject: 'mathematics',
          overallProgress: 0.85,
          voiceInteractions: 0,
          photoAssessments: 0,
          skillUpdates: 1
        })
      );
    });

    it('should handle missing session gracefully', async () => {
      mockLearningSessionService.getSession.mockReturnValue(undefined);

      await integrationService.onSessionCompleted('nonexistent-session');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Session not found for progress tracking',
        { sessionId: 'nonexistent-session' }
      );
      expect(mockProgressTrackingService.trackSessionProgress).not.toHaveBeenCalled();
    });

    it('should handle progress tracking errors gracefully', async () => {
      mockLearningSessionService.getSession.mockReturnValue(mockSession);
      mockProgressTrackingService.trackSessionProgress.mockRejectedValue(
        new Error('Progress tracking failed')
      );

      await integrationService.onSessionCompleted('test-session-1');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to track session completion progress',
        expect.objectContaining({
          sessionId: 'test-session-1',
          error: 'Progress tracking failed'
        })
      );
    });

    it('should include pending voice and photo data', async () => {
      // First record some voice interaction
      mockLearningSessionService.getSession.mockReturnValue({
        ...mockSession,
        state: 'active'
      });

      await integrationService.recordVoiceInteraction('test-session-1', {
        interactionCount: 5,
        averageResponseTime: 1800,
        confidenceLevel: 0.85,
        topicsDiscussed: ['algebra'],
        skillsDemonstrated: ['equation_solving'],
        languageComplexity: 7
      });

      // Then record photo assessment
      await integrationService.recordPhotoAssessment('test-session-1', {
        assessmentId: 'photo-123',
        subject: 'mathematics',
        topic: 'algebra',
        correctnessScore: 0.8,
        completionLevel: 0.9,
        skillsAssessed: ['linear_equations'],
        improvementAreas: ['complex_expressions'],
        strengths: ['basic_operations'],
        timestamp: new Date()
      });

      // Now complete the session
      mockLearningSessionService.getSession.mockReturnValue(mockSession);
      mockProgressTrackingService.trackSessionProgress.mockResolvedValue(mockProgress as any);

      await integrationService.onSessionCompleted('test-session-1');

      expect(mockProgressTrackingService.trackSessionProgress).toHaveBeenCalledWith(
        mockSession,
        expect.arrayContaining([
          expect.objectContaining({
            sessionId: 'test-session-1',
            interactionCount: 5,
            skillsDemonstrated: ['equation_solving']
          })
        ]),
        expect.arrayContaining([
          expect.objectContaining({
            assessmentId: 'photo-123',
            subject: 'mathematics',
            correctnessScore: 0.8
          })
        ])
      );
    });
  });

  describe('recordVoiceInteraction', () => {
    const voiceInteractionData = {
      interactionCount: 8,
      averageResponseTime: 2200,
      confidenceLevel: 0.75,
      topicsDiscussed: ['fractions', 'decimals'],
      skillsDemonstrated: ['fraction_division', 'decimal_conversion'],
      languageComplexity: 6
    };

    it('should record voice interaction for active session', async () => {
      const mockSession = {
        sessionId: 'test-session-1',
        childId: 'child-123',
        state: 'active'
      };

      mockLearningSessionService.getSession.mockReturnValue(mockSession as any);
      mockProgressTrackingService.addVoiceInteractionData.mockResolvedValue(undefined);

      await integrationService.recordVoiceInteraction('test-session-1', voiceInteractionData);

      expect(mockProgressTrackingService.addVoiceInteractionData).toHaveBeenCalledWith(
        'test-session-1',
        expect.objectContaining({
          sessionId: 'test-session-1',
          ...voiceInteractionData
        })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Voice interaction recorded for session',
        expect.objectContaining({
          sessionId: 'test-session-1',
          skillsDemonstrated: 2,
          confidenceLevel: 0.75
        })
      );
    });

    it('should handle completed session by updating progress directly', async () => {
      const mockSession = {
        sessionId: 'test-session-1',
        childId: 'child-123',
        state: 'completed'
      };

      mockLearningSessionService.getSession.mockReturnValue(mockSession as any);
      mockProgressTrackingService.addVoiceInteractionData.mockResolvedValue(undefined);

      await integrationService.recordVoiceInteraction('test-session-1', voiceInteractionData);

      expect(mockProgressTrackingService.addVoiceInteractionData).toHaveBeenCalledWith(
        'test-session-1',
        expect.objectContaining({
          sessionId: 'test-session-1',
          ...voiceInteractionData
        })
      );
    });

    it('should handle missing session gracefully', async () => {
      mockLearningSessionService.getSession.mockReturnValue(undefined);

      await integrationService.recordVoiceInteraction('nonexistent-session', voiceInteractionData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Session not found for voice interaction recording',
        { sessionId: 'nonexistent-session' }
      );
      expect(mockProgressTrackingService.addVoiceInteractionData).not.toHaveBeenCalled();
    });

    it('should handle progress tracking errors gracefully', async () => {
      const mockSession = {
        sessionId: 'test-session-1',
        state: 'active'
      };

      mockLearningSessionService.getSession.mockReturnValue(mockSession as any);
      mockProgressTrackingService.addVoiceInteractionData.mockRejectedValue(
        new Error('Voice tracking failed')
      );

      await integrationService.recordVoiceInteraction('test-session-1', voiceInteractionData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to record voice interaction',
        expect.objectContaining({
          sessionId: 'test-session-1',
          error: 'Voice tracking failed'
        })
      );
    });
  });

  describe('recordPhotoAssessment', () => {
    const photoAssessment = {
      assessmentId: 'photo-456',
      subject: 'science',
      topic: 'biology',
      correctnessScore: 0.75,
      completionLevel: 0.85,
      skillsAssessed: ['cell_structure', 'mitosis'],
      improvementAreas: ['cellular_processes'],
      strengths: ['diagram_labeling'],
      timestamp: new Date()
    };

    it('should record photo assessment for active session', async () => {
      const mockSession = {
        sessionId: 'test-session-1',
        childId: 'child-123',
        state: 'active'
      };

      mockLearningSessionService.getSession.mockReturnValue(mockSession as any);
      mockProgressTrackingService.addPhotoAssessmentResult.mockResolvedValue(undefined);

      await integrationService.recordPhotoAssessment('test-session-1', photoAssessment);

      expect(mockProgressTrackingService.addPhotoAssessmentResult).toHaveBeenCalledWith(
        'test-session-1',
        photoAssessment
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Photo assessment recorded for session',
        expect.objectContaining({
          sessionId: 'test-session-1',
          subject: 'science',
          correctnessScore: 0.75,
          skillsAssessed: 2
        })
      );
    });

    it('should handle missing session gracefully', async () => {
      mockLearningSessionService.getSession.mockReturnValue(undefined);

      await integrationService.recordPhotoAssessment('nonexistent-session', photoAssessment);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Session not found for photo assessment recording',
        { sessionId: 'nonexistent-session' }
      );
      expect(mockProgressTrackingService.addPhotoAssessmentResult).not.toHaveBeenCalled();
    });
  });

  describe('getSessionProgressData', () => {
    it('should return comprehensive session progress data', async () => {
      const mockSession = {
        sessionId: 'test-session-1',
        childId: 'child-123',
        state: 'active'
      };

      const mockProgressData = {
        sessionId: 'test-session-1',
        overallProgress: 0.7
      };

      mockLearningSessionService.getSession.mockReturnValue(mockSession as any);
      mockProgressTrackingService.getSessionProgress.mockResolvedValue(mockProgressData as any);

      const result = await integrationService.getSessionProgressData('test-session-1');

      expect(result).toEqual({
        session: mockSession,
        progressData: mockProgressData,
        pendingVoiceInteractions: 0,
        pendingPhotoAssessments: 0,
        isComplete: false
      });
    });

    it('should handle missing session', async () => {
      mockLearningSessionService.getSession.mockReturnValue(undefined);

      await expect(integrationService.getSessionProgressData('nonexistent-session'))
        .rejects.toThrow('Session not found: nonexistent-session');
    });
  });

  describe('getChildProgressAnalytics', () => {
    it('should generate analytics with default time range', async () => {
      const mockAnalytics = {
        childId: 'child-123',
        totalSessions: 5,
        completedSessions: 4,
        overallEngagement: 85
      };

      mockProgressTrackingService.generateProgressAnalytics.mockResolvedValue(mockAnalytics as any);

      const result = await integrationService.getChildProgressAnalytics('child-123');

      expect(result).toEqual(mockAnalytics);
      expect(mockProgressTrackingService.generateProgressAnalytics).toHaveBeenCalledWith(
        'child-123',
        expect.objectContaining({
          start: expect.any(Date),
          end: expect.any(Date)
        })
      );

      // Verify the time range is about 30 days
      const call = mockProgressTrackingService.generateProgressAnalytics.mock.calls[0];
      const timeRange = call[1];
      const daysDifference = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDifference).toBeCloseTo(30, 1);
    });

    it('should use custom time range when provided', async () => {
      const customTimeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-15')
      };

      const mockAnalytics = {
        childId: 'child-123',
        totalSessions: 2
      };

      mockProgressTrackingService.generateProgressAnalytics.mockResolvedValue(mockAnalytics as any);

      const result = await integrationService.getChildProgressAnalytics('child-123', customTimeRange);

      expect(mockProgressTrackingService.generateProgressAnalytics).toHaveBeenCalledWith(
        'child-123',
        customTimeRange
      );
    });

    it('should handle analytics generation errors', async () => {
      mockProgressTrackingService.generateProgressAnalytics.mockRejectedValue(
        new Error('Analytics failed')
      );

      await expect(integrationService.getChildProgressAnalytics('child-123'))
        .rejects.toThrow('Analytics failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get child progress analytics',
        expect.objectContaining({
          childId: 'child-123',
          error: 'Analytics failed'
        })
      );
    });
  });

  describe('syncSessionProgress', () => {
    it('should manually sync session progress', async () => {
      const mockSession = {
        sessionId: 'test-session-1',
        childId: 'child-123',
        state: 'active'
      };

      mockLearningSessionService.getSession.mockReturnValue(mockSession as any);
      mockProgressTrackingService.trackSessionProgress.mockResolvedValue({} as any);

      await integrationService.syncSessionProgress('test-session-1');

      expect(mockProgressTrackingService.trackSessionProgress).toHaveBeenCalledWith(
        mockSession,
        [],
        []
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Session progress manually synced',
        expect.objectContaining({
          sessionId: 'test-session-1',
          state: 'active'
        })
      );
    });

    it('should handle missing session', async () => {
      mockLearningSessionService.getSession.mockReturnValue(undefined);

      await expect(integrationService.syncSessionProgress('nonexistent-session'))
        .rejects.toThrow('Session not found: nonexistent-session');
    });
  });

  describe('getPendingDataSummary', () => {
    it('should return summary of pending data', async () => {
      // Set up some pending data by recording interactions for active sessions
      const mockSession = { sessionId: 'test-session-1', state: 'active' };
      mockLearningSessionService.getSession.mockReturnValue(mockSession as any);

      await integrationService.recordVoiceInteraction('test-session-1', {
        interactionCount: 3,
        averageResponseTime: 2000,
        confidenceLevel: 0.8,
        topicsDiscussed: ['math'],
        skillsDemonstrated: ['addition'],
        languageComplexity: 5
      });

      await integrationService.recordPhotoAssessment('test-session-1', {
        assessmentId: 'photo-123',
        subject: 'math',
        topic: 'addition',
        correctnessScore: 0.9,
        completionLevel: 1.0,
        skillsAssessed: ['basic_addition'],
        improvementAreas: [],
        strengths: ['accuracy'],
        timestamp: new Date()
      });

      const summary = integrationService.getPendingDataSummary();

      expect(summary.sessionsWithPendingVoiceData).toBe(1);
      expect(summary.sessionsWithPendingPhotoData).toBe(1);
      expect(summary.totalPendingVoiceInteractions).toBe(1);
      expect(summary.totalPendingPhotoAssessments).toBe(1);
    });
  });

  describe('cleanupAbandonedSessions', () => {
    it('should clean up old sessions', async () => {
      // Mock an old session
      const oldSession = {
        sessionId: 'old-session',
        lastActivity: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
        state: 'active'
      };

      mockLearningSessionService.getSession.mockReturnValue(oldSession as any);

      // Add some pending data for the old session
      await integrationService.recordVoiceInteraction('old-session', {
        interactionCount: 1,
        averageResponseTime: 2000,
        confidenceLevel: 0.5,
        topicsDiscussed: ['test'],
        skillsDemonstrated: ['test'],
        languageComplexity: 5
      });

      // Clean up with 24 hour threshold
      integrationService.cleanupAbandonedSessions(24);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleaned up abandoned session data',
        expect.objectContaining({
          sessionsCleanedUp: 1,
          maxAgeHours: 24
        })
      );
    });
  });
});
import winston from 'winston';
import { ProgressTrackingService, LearningSessionProgress, VoiceInteractionData, PhotoAssessmentResult } from '../progressTracking';
import { ProgressRepository } from '../progressRepository';
import { LearningSession, SessionState } from '../learningSession';

// Mock the progress repository
jest.mock('../progressRepository');

describe('ProgressTrackingService', () => {
  let progressTrackingService: ProgressTrackingService;
  let mockRepository: jest.Mocked<ProgressRepository>;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    // Create mock repository
    mockRepository = {
      saveSessionProgress: jest.fn(),
      updateSessionProgress: jest.fn(),
      getSessionProgress: jest.fn(),
      getChildSessionProgresses: jest.fn(),
      getSessionProgressByDateRange: jest.fn(),
      saveSkillMasteryUpdates: jest.fn(),
      getChildSkillMastery: jest.fn(),
      saveLearningPatterns: jest.fn(),
      getChildLearningPatterns: jest.fn(),
      generateAnalyticsData: jest.fn(),
    } as any;

    progressTrackingService = new ProgressTrackingService(mockRepository, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('trackSessionProgress', () => {
    const mockSession: LearningSession = {
      sessionId: 'test-session-1',
      childId: 'child-123',
      ageGroup: 'ages10to13',
      sessionType: 'lesson',
      state: 'completed' as SessionState,
      title: 'Math Lesson',
      subject: 'mathematics',
      topic: 'algebra',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      startedAt: new Date('2024-01-01T10:00:00Z'),
      lastActivity: new Date('2024-01-01T10:30:00Z'),
      completedAt: new Date('2024-01-01T10:30:00Z'),
      timingConfig: {
        recommendedDuration: 30,
        maxDuration: 45,
        breakInterval: 20,
        breakDuration: 5,
        warningBeforeBreak: 3
      },
      learningObjectives: [
        {
          id: 'obj-1',
          subject: 'mathematics',
          topic: 'algebra',
          description: 'Solve linear equations',
          targetLevel: 7,
          completed: true,
          completedAt: new Date('2024-01-01T10:25:00Z'),
          attempts: 3,
          successRate: 0.85
        }
      ],
      progressMarkers: [],
      breakReminders: [],
      totalBreakTime: 0,
      statistics: {
        totalDuration: 1800000, // 30 minutes
        activeDuration: 1800000,
        breakDuration: 0,
        interactionCount: 15,
        objectivesCompleted: 1,
        objectivesAttempted: 1,
        averageResponseTime: 2500,
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

    it('should track session progress successfully', async () => {
      mockRepository.getSessionProgress.mockResolvedValue(null);
      mockRepository.saveSessionProgress.mockResolvedValue(undefined);
      mockRepository.saveSkillMasteryUpdates.mockResolvedValue(undefined);

      const result = await progressTrackingService.trackSessionProgress(mockSession);

      expect(result.sessionId).toBe('test-session-1');
      expect(result.childId).toBe('child-123');
      expect(result.subject).toBe('mathematics');
      expect(result.overallProgress).toBeGreaterThan(0);
      expect(result.skillMasteryUpdates).toHaveLength(1);
      expect(result.skillMasteryUpdates[0].skillName).toBe('algebra');
      expect(result.skillMasteryUpdates[0].evidenceSource).toBe('objective_completion');

      expect(mockRepository.saveSessionProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session-1',
          childId: 'child-123'
        })
      );
      expect(mockRepository.saveSkillMasteryUpdates).toHaveBeenCalledWith(
        'child-123',
        expect.arrayContaining([
          expect.objectContaining({
            skillName: 'algebra',
            evidenceSource: 'objective_completion'
          })
        ])
      );
    });

    it('should update existing session progress', async () => {
      const existingProgress: LearningSessionProgress = {
        sessionId: 'test-session-1',
        childId: 'child-123',
        subject: 'mathematics',
        topic: 'algebra',
        startTime: new Date('2024-01-01T10:00:00Z'),
        state: 'active',
        attentionMetrics: {
          focusLevel: 75,
          distractionEvents: 2,
          sessionDuration: 1500000,
          effectiveLearningTime: 1500000,
          breakFrequency: 1,
          engagementScore: 80
        },
        voiceInteractions: [],
        photoAssessments: [],
        objectivesProgress: [],
        overallProgress: 0.5,
        skillMasteryUpdates: [],
        learningPatterns: [],
        recommendations: [],
        createdAt: new Date('2024-01-01T09:55:00Z'),
        updatedAt: new Date('2024-01-01T10:15:00Z')
      };

      mockRepository.getSessionProgress.mockResolvedValue(existingProgress);
      mockRepository.updateSessionProgress.mockResolvedValue(undefined);
      mockRepository.saveSkillMasteryUpdates.mockResolvedValue(undefined);

      const result = await progressTrackingService.trackSessionProgress(mockSession);

      expect(result.createdAt).toEqual(existingProgress.createdAt);
      expect(result.updatedAt).not.toEqual(existingProgress.updatedAt);
      expect(mockRepository.updateSessionProgress).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockRepository.getSessionProgress.mockRejectedValue(new Error('Database error'));

      const result = await progressTrackingService.trackSessionProgress(mockSession);

      expect(result).toBeDefined();
      expect(result.sessionId).toBe('test-session-1');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to persist session progress to database',
        expect.objectContaining({
          sessionId: 'test-session-1',
          error: 'Database error'
        })
      );
    });

    it('should calculate attention metrics correctly', async () => {
      mockRepository.getSessionProgress.mockResolvedValue(null);
      mockRepository.saveSessionProgress.mockResolvedValue(undefined);

      const result = await progressTrackingService.trackSessionProgress(mockSession);

      expect(result.attentionMetrics.focusLevel).toBe(100); // Perfect focus (no breaks)
      expect(result.attentionMetrics.sessionDuration).toBe(1800000);
      expect(result.attentionMetrics.effectiveLearningTime).toBe(1800000);
      expect(result.attentionMetrics.engagementScore).toBe(85);
    });

    it('should generate learning patterns', async () => {
      mockRepository.getSessionProgress.mockResolvedValue(null);
      mockRepository.saveSessionProgress.mockResolvedValue(undefined);

      const result = await progressTrackingService.trackSessionProgress(mockSession);

      expect(result.learningPatterns).toContain('high_focus_learner');
      expect(result.learningPatterns).toContain('highly_engaged');
      expect(result.learningPatterns).toContain('sustained_learner');
      expect(result.learningPatterns).toContain('morning_learner');
    });

    it('should generate appropriate recommendations', async () => {
      mockRepository.getSessionProgress.mockResolvedValue(null);
      mockRepository.saveSessionProgress.mockResolvedValue(undefined);

      const result = await progressTrackingService.trackSessionProgress(mockSession);

      expect(result.recommendations).toContain('Consider more challenging learning objectives');
    });
  });

  describe('addVoiceInteractionData', () => {
    const voiceData: VoiceInteractionData = {
      sessionId: 'test-session-1',
      interactionCount: 10,
      averageResponseTime: 2000,
      confidenceLevel: 0.9,
      topicsDiscussed: ['algebra', 'equations'],
      skillsDemonstrated: ['linear_equations', 'problem_solving'],
      languageComplexity: 7
    };

    it('should add voice interaction data to existing progress', async () => {
      const existingProgress: LearningSessionProgress = {
        sessionId: 'test-session-1',
        childId: 'child-123',
        subject: 'mathematics',
        topic: 'algebra',
        startTime: new Date(),
        state: 'active',
        attentionMetrics: {} as any,
        voiceInteractions: [],
        photoAssessments: [],
        objectivesProgress: [],
        overallProgress: 0.5,
        skillMasteryUpdates: [],
        learningPatterns: [],
        recommendations: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Set up cache with existing progress
      await progressTrackingService.trackSessionProgress({
        sessionId: 'test-session-1',
        childId: 'child-123',
      } as any);

      // Mock the cache get
      jest.spyOn(progressTrackingService as any, 'progressCache', 'get')
        .mockReturnValue(new Map([['test-session-1', existingProgress]]));

      await progressTrackingService.addVoiceInteractionData('test-session-1', voiceData);

      // The voice data should be added to the progress
      expect(existingProgress.voiceInteractions).toHaveLength(1);
      expect(existingProgress.voiceInteractions[0]).toEqual(voiceData);
      expect(existingProgress.skillMasteryUpdates.length).toBeGreaterThan(0);
    });

    it('should handle missing session gracefully', async () => {
      await progressTrackingService.addVoiceInteractionData('nonexistent-session', voiceData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No progress record found for voice interaction',
        { sessionId: 'nonexistent-session' }
      );
    });
  });

  describe('addPhotoAssessmentResult', () => {
    const photoAssessment: PhotoAssessmentResult = {
      assessmentId: 'photo-123',
      subject: 'mathematics',
      topic: 'algebra',
      correctnessScore: 0.8,
      completionLevel: 0.9,
      skillsAssessed: ['linear_equations', 'graphing'],
      improvementAreas: ['complex_equations'],
      strengths: ['basic_algebra'],
      timestamp: new Date()
    };

    it('should add photo assessment data to existing progress', async () => {
      const existingProgress: LearningSessionProgress = {
        sessionId: 'test-session-1',
        childId: 'child-123',
        subject: 'mathematics',
        topic: 'algebra',
        startTime: new Date(),
        state: 'active',
        attentionMetrics: {} as any,
        voiceInteractions: [],
        photoAssessments: [],
        objectivesProgress: [],
        overallProgress: 0.5,
        skillMasteryUpdates: [],
        learningPatterns: [],
        recommendations: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Set up cache with existing progress
      jest.spyOn(progressTrackingService as any, 'progressCache', 'get')
        .mockReturnValue(new Map([['test-session-1', existingProgress]]));

      await progressTrackingService.addPhotoAssessmentResult('test-session-1', photoAssessment);

      expect(existingProgress.photoAssessments).toHaveLength(1);
      expect(existingProgress.photoAssessments[0]).toEqual(photoAssessment);
      expect(existingProgress.skillMasteryUpdates.length).toBeGreaterThan(0);
    });
  });

  describe('generateProgressAnalytics', () => {
    const childId = 'child-123';
    const timeRange = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31')
    };

    it('should generate comprehensive analytics', async () => {
      const mockProgressData: LearningSessionProgress[] = [
        {
          sessionId: 'session-1',
          childId,
          subject: 'mathematics',
          topic: 'algebra',
          startTime: new Date('2024-01-15'),
          state: 'completed',
          attentionMetrics: {
            focusLevel: 85,
            distractionEvents: 1,
            sessionDuration: 1800000,
            effectiveLearningTime: 1800000,
            breakFrequency: 1,
            engagementScore: 90
          },
          voiceInteractions: [],
          photoAssessments: [],
          objectivesProgress: [],
          overallProgress: 0.9,
          skillMasteryUpdates: [
            {
              skillId: 'math-algebra',
              skillName: 'Algebra',
              previousLevel: 5,
              newLevel: 7,
              evidenceSource: 'objective_completion',
              confidence: 0.85,
              timestamp: new Date('2024-01-15')
            }
          ],
          learningPatterns: ['high_focus_learner'],
          recommendations: ['Consider advanced topics'],
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        }
      ];

      // Mock the cache to return our test data
      jest.spyOn(progressTrackingService as any, 'progressCache', 'get')
        .mockReturnValue(new Map([
          ['session-1', mockProgressData[0]]
        ]));

      const analytics = await progressTrackingService.generateProgressAnalytics(childId, timeRange);

      expect(analytics.childId).toBe(childId);
      expect(analytics.totalSessions).toBe(1);
      expect(analytics.completedSessions).toBe(1);
      expect(analytics.overallEngagement).toBe(90);
      expect(analytics.skillProgressions).toHaveLength(1);
      expect(analytics.skillProgressions[0].skillName).toBe('Algebra');
      expect(analytics.masteredSkills).toHaveLength(0); // Level 7 is not >= 8
      expect(analytics.adaptiveRecommendations.length).toBeGreaterThan(0);
    });

    it('should return empty analytics for no data', async () => {
      jest.spyOn(progressTrackingService as any, 'progressCache', 'get')
        .mockReturnValue(new Map());

      const analytics = await progressTrackingService.generateProgressAnalytics(childId, timeRange);

      expect(analytics.totalSessions).toBe(0);
      expect(analytics.completedSessions).toBe(0);
      expect(analytics.skillProgressions).toHaveLength(0);
      expect(analytics.adaptiveRecommendations).toContain('Start with short learning sessions to establish routine');
    });
  });

  describe('getSessionProgress', () => {
    it('should return cached progress if available', async () => {
      const mockProgress: LearningSessionProgress = {
        sessionId: 'test-session-1',
        childId: 'child-123',
        subject: 'mathematics',
        topic: 'algebra',
        startTime: new Date(),
        state: 'completed',
        attentionMetrics: {} as any,
        voiceInteractions: [],
        photoAssessments: [],
        objectivesProgress: [],
        overallProgress: 0.8,
        skillMasteryUpdates: [],
        learningPatterns: [],
        recommendations: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Set up cache
      jest.spyOn(progressTrackingService as any, 'progressCache', 'get')
        .mockReturnValue(new Map([['test-session-1', mockProgress]]));

      const result = await progressTrackingService.getSessionProgress('test-session-1');

      expect(result).toEqual(mockProgress);
      expect(mockRepository.getSessionProgress).not.toHaveBeenCalled();
    });

    it('should fetch from database if not cached', async () => {
      const mockProgress: LearningSessionProgress = {
        sessionId: 'test-session-1',
        childId: 'child-123',
        subject: 'mathematics',
        topic: 'algebra',
        startTime: new Date(),
        state: 'completed',
        attentionMetrics: {} as any,
        voiceInteractions: [],
        photoAssessments: [],
        objectivesProgress: [],
        overallProgress: 0.8,
        skillMasteryUpdates: [],
        learningPatterns: [],
        recommendations: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(progressTrackingService as any, 'progressCache', 'get')
        .mockReturnValue(new Map());
      mockRepository.getSessionProgress.mockResolvedValue(mockProgress);

      const result = await progressTrackingService.getSessionProgress('test-session-1');

      expect(result).toEqual(mockProgress);
      expect(mockRepository.getSessionProgress).toHaveBeenCalledWith('test-session-1');
    });

    it('should return undefined if not found', async () => {
      jest.spyOn(progressTrackingService as any, 'progressCache', 'get')
        .mockReturnValue(new Map());
      mockRepository.getSessionProgress.mockResolvedValue(null);

      const result = await progressTrackingService.getSessionProgress('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      jest.spyOn(progressTrackingService as any, 'progressCache', 'get')
        .mockReturnValue(new Map());
      mockRepository.getSessionProgress.mockRejectedValue(new Error('Database error'));

      const result = await progressTrackingService.getSessionProgress('test-session-1');

      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to get session progress from database',
        expect.objectContaining({
          sessionId: 'test-session-1',
          error: 'Database error'
        })
      );
    });
  });

  describe('getChildSessionProgresses', () => {
    it('should fetch from database and cache results', async () => {
      const mockProgresses: LearningSessionProgress[] = [
        {
          sessionId: 'session-1',
          childId: 'child-123',
          subject: 'mathematics',
          topic: 'algebra',
          startTime: new Date('2024-01-15'),
          state: 'completed',
          attentionMetrics: {} as any,
          voiceInteractions: [],
          photoAssessments: [],
          objectivesProgress: [],
          overallProgress: 0.8,
          skillMasteryUpdates: [],
          learningPatterns: [],
          recommendations: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRepository.getChildSessionProgresses.mockResolvedValue(mockProgresses);

      const result = await progressTrackingService.getChildSessionProgresses('child-123');

      expect(result).toEqual(mockProgresses);
      expect(mockRepository.getChildSessionProgresses).toHaveBeenCalledWith('child-123', 50);
    });

    it('should fallback to cache on database error', async () => {
      const mockProgress: LearningSessionProgress = {
        sessionId: 'session-1',
        childId: 'child-123',
        subject: 'mathematics',
        topic: 'algebra',
        startTime: new Date(),
        state: 'completed',
        attentionMetrics: {} as any,
        voiceInteractions: [],
        photoAssessments: [],
        objectivesProgress: [],
        overallProgress: 0.8,
        skillMasteryUpdates: [],
        learningPatterns: [],
        recommendations: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(progressTrackingService as any, 'progressCache', 'get')
        .mockReturnValue(new Map([['session-1', mockProgress]]));
      mockRepository.getChildSessionProgresses.mockRejectedValue(new Error('Database error'));

      const result = await progressTrackingService.getChildSessionProgresses('child-123');

      expect(result).toEqual([mockProgress]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to get child session progresses from database, falling back to cache',
        expect.objectContaining({
          childId: 'child-123',
          error: 'Database error'
        })
      );
    });
  });

  describe('skill mastery updates', () => {
    it('should generate skill updates from objectives', async () => {
      const mockSession: LearningSession = {
        sessionId: 'test-session-1',
        childId: 'child-123',
        learningObjectives: [
          {
            id: 'obj-1',
            subject: 'mathematics',
            topic: 'algebra',
            description: 'Solve equations',
            targetLevel: 6,
            completed: true,
            completedAt: new Date(),
            attempts: 2,
            successRate: 0.9
          }
        ],
        statistics: {
          completionRate: 1.0,
          engagementScore: 85
        }
      } as any;

      mockRepository.getSessionProgress.mockResolvedValue(null);
      mockRepository.saveSessionProgress.mockResolvedValue(undefined);

      const result = await progressTrackingService.trackSessionProgress(mockSession);

      expect(result.skillMasteryUpdates).toHaveLength(1);
      expect(result.skillMasteryUpdates[0]).toMatchObject({
        skillId: 'mathematics-algebra',
        skillName: 'algebra',
        evidenceSource: 'objective_completion',
        confidence: 0.9
      });
    });

    it('should generate skill updates from voice interactions', async () => {
      const voiceData: VoiceInteractionData = {
        sessionId: 'test-session-1',
        interactionCount: 5,
        averageResponseTime: 2000,
        confidenceLevel: 0.8,
        topicsDiscussed: ['fractions'],
        skillsDemonstrated: ['fraction_operations', 'decimal_conversion'],
        languageComplexity: 6
      };

      // Create a simple session first
      const mockSession = {
        sessionId: 'test-session-1',
        childId: 'child-123',
        learningObjectives: [],
        statistics: { completionRate: 0.5, engagementScore: 70 }
      } as any;

      mockRepository.getSessionProgress.mockResolvedValue(null);
      mockRepository.saveSessionProgress.mockResolvedValue(undefined);

      const progress = await progressTrackingService.trackSessionProgress(mockSession, [voiceData]);

      const voiceSkillUpdates = progress.skillMasteryUpdates.filter(
        update => update.evidenceSource === 'voice'
      );

      expect(voiceSkillUpdates).toHaveLength(2);
      expect(voiceSkillUpdates.map(u => u.skillName)).toContain('fraction_operations');
      expect(voiceSkillUpdates.map(u => u.skillName)).toContain('decimal_conversion');
    });
  });
});
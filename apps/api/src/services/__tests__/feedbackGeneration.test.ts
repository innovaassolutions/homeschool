import winston from 'winston';
import {
  FeedbackGenerationService,
  FeedbackRequest,
  FeedbackResponse,
  VisualAnnotation,
  LearningInsight
} from '../feedbackGeneration';
import { ChatGPTService } from '../chatgpt';
import { TextToSpeechService } from '../textToSpeech';

// Mock dependencies
jest.mock('../chatgpt');
jest.mock('../textToSpeech');

describe('FeedbackGenerationService', () => {
  let service: FeedbackGenerationService;
  let mockLogger: winston.Logger;
  let mockChatGPT: jest.Mocked<ChatGPTService>;
  let mockTTSService: jest.Mocked<TextToSpeechService>;

  const mockAnalysisResult = {
    id: 'analysis_123',
    childId: 'child_123',
    photoId: 'photo_123',
    subject: 'mathematics',
    contentType: 'mathematical_problem',
    extractedContent: '2 + 2 = 5',
    accuracy: 0.2,
    errors: [
      {
        type: 'computational_error',
        location: { x: 100, y: 50, width: 20, height: 15 },
        description: 'Incorrect sum: 2 + 2 = 4, not 5',
        severity: 'high'
      }
    ],
    correctSolutions: ['2 + 2 = 4'],
    skillsAssessed: ['basic_addition'],
    confidenceScore: 0.95,
    processingTime: 1234,
    timestamp: new Date(),
    ageGroup: 'ages6to9' as const,
    learningInsights: {
      skillLevel: 'beginner',
      commonMistakes: ['basic_arithmetic'],
      recommendedPractice: ['addition_drills']
    }
  };

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    // Mock ChatGPT service
    mockChatGPT = {
      generateResponse: jest.fn().mockResolvedValue({
        content: 'Great effort on this addition problem! I notice you wrote 2 + 2 = 5. Let me help you with that - when we add 2 + 2, we get 4. Try counting on your fingers: start with 2, then count up 2 more!'
      })
    } as any;

    // Mock TTS service
    mockTTSService = {
      synthesizeByAge: jest.fn().mockResolvedValue({
        success: true,
        audioUrl: 'https://example.com/audio/feedback.mp3',
        processingTime: 1500
      })
    } as any;

    service = new FeedbackGenerationService(mockLogger, mockChatGPT, mockTTSService);
  });

  describe('generateFeedback', () => {
    it('should generate comprehensive feedback for mathematics error', async () => {
      const request: FeedbackRequest = {
        analysisId: 'test_analysis',
        childId: 'child_123',
        ageGroup: 'ages6to9'
      };

      const result = await service.generateFeedback(request);

      expect(result.success).toBe(true);
      expect(result.feedbackContent?.feedback).toContain('Great effort');
      expect(result.feedbackContent?.positiveReinforcement).toContain('Good effort on attempting this problem!');
      expect(result.feedbackContent?.improvementSuggestions).toHaveLength(1);
      expect(result.feedbackContent?.voiceFeedbackUrl).toBe('https://example.com/audio/feedback.mp3');
      expect(mockChatGPT.generateResponse).toHaveBeenCalled();
      expect(mockTTSService.synthesizeByAge).toHaveBeenCalledWith(
        expect.objectContaining({
          ageGroup: 'ages6to9',
          enableCache: true,
          metadata: expect.objectContaining({
            childId: 'child_123',
            conversationContext: true
          })
        })
      );
    });

    it('should handle analysis not found', async () => {
      const request: FeedbackRequest = {
        analysisId: 'nonexistent_analysis',
        childId: 'child_123',
        ageGroup: 'ages6to9'
      };

      const result = await service.generateFeedback(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Analysis not found');
    });

    it('should handle ChatGPT service errors gracefully', async () => {
      mockChatGPT.generateResponse.mockRejectedValue(new Error('ChatGPT API error'));

      const request: FeedbackRequest = {
        analysisId: 'test_analysis',
        childId: 'child_123',
        ageGroup: 'ages6to9'
      };

      const result = await service.generateFeedback(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to generate feedback');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle TTS service failures gracefully', async () => {
      mockTTSService.synthesizeByAge.mockRejectedValue(new Error('TTS API error'));

      const request: FeedbackRequest = {
        analysisId: 'test_analysis',
        childId: 'child_123',
        ageGroup: 'ages6to9'
      };

      const result = await service.generateFeedback(request);

      expect(result.success).toBe(true);
      expect(result.feedbackContent?.voiceFeedbackUrl).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to generate voice feedback', {
        error: 'TTS API error'
      });
    });
  });

  describe('generateLearningInsights', () => {
    it('should extract learning patterns from feedback history', async () => {
      const feedbackHistory = [
        {
          id: 'feedback_1',
          analysisId: 'analysis_1',
          childId: 'child_123',
          subject: 'mathematics',
          errors: ['computational_error'],
          skillsAssessed: ['basic_addition'],
          timestamp: new Date(Date.now() - 86400000) // 1 day ago
        },
        {
          id: 'feedback_2',
          analysisId: 'analysis_2',
          childId: 'child_123',
          subject: 'mathematics',
          errors: ['computational_error'],
          skillsAssessed: ['basic_addition'],
          timestamp: new Date()
        }
      ];

      const insights = await service.generateLearningInsights(feedbackHistory);

      expect(insights.commonErrorPatterns).toContain('computational_error');
      expect(insights.skillsNeedingFocus).toContain('basic_addition');
      expect(insights.recommendedActivities).toBeDefined();
      expect(insights.progressIndicators.length).toBeGreaterThan(0);
    });
  });

  describe('performance metrics', () => {
    it('should track feedback generation statistics', () => {
      const stats = service.getStats();
      expect(stats).toHaveProperty('totalFeedbackGenerated');
      expect(stats).toHaveProperty('averageProcessingTime');
      expect(stats).toHaveProperty('feedbackByAgeGroup');
      expect(stats).toHaveProperty('successRate');
    });
  });
});
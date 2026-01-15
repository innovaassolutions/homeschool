import winston from 'winston';
import { ChatGPTService, ConversationContext } from './chatgpt';
import { TextToSpeechService, TTSRequestByAge } from './textToSpeech';

export interface FeedbackRequest {
  analysisId: string;
  childId: string;
  ageGroup: 'ages6to9' | 'ages10to13' | 'ages14to16';
  requestId?: string;
}

export interface VisualAnnotation {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'error' | 'correction' | 'highlight' | 'praise';
  message: string;
  severity: 'low' | 'medium' | 'high';
  color?: string;
}

export interface ImprovementSuggestion {
  area: string;
  suggestion: string;
  actionable: boolean;
  priority?: 'low' | 'medium' | 'high';
  resources?: string[];
}

export interface FeedbackContent {
  feedback: string;
  positiveReinforcement: string[];
  improvementSuggestions: ImprovementSuggestion[];
  visualAnnotations: VisualAnnotation[];
  learningInsights: LearningInsight;
  ageGroup: 'ages6to9' | 'ages10to13' | 'ages14to16';
  voiceFeedbackUrl?: string;
}

export interface LearningInsight {
  commonErrorPatterns: string[];
  skillsNeedingFocus: string[];
  recommendedActivities: string[];
  progressIndicators: {
    area: string;
    currentLevel: string;
    targetLevel: string;
    timeframe: string;
  }[];
  motivationalElements: string[];
}

export interface FeedbackResponse {
  success: boolean;
  feedbackId?: string;
  feedbackContent?: FeedbackContent;
  processingTime?: number;
  error?: string;
}

export interface FeedbackStats {
  totalFeedbackGenerated: number;
  averageProcessingTime: number;
  feedbackByAgeGroup: Record<string, number>;
  feedbackBySubject: Record<string, number>;
  successRate: number;
  commonIssues: string[];
  totalErrors: number;
}

export interface FeedbackHistory {
  id: string;
  analysisId: string;
  childId: string;
  subject: string;
  errors: string[];
  skillsAssessed: string[];
  timestamp: Date;
}

// Mock analysis result interface for development
interface MockAnalysisResult {
  id: string;
  childId: string;
  subject: string;
  content: string;
  accuracy: number;
  errors: Array<{
    type: string;
    description: string;
    severity: string;
    location?: { x: number; y: number; width: number; height: number };
  }>;
  correctSolutions: string[];
  skillsAssessed: string[];
  ageGroup: 'ages6to9' | 'ages10to13' | 'ages14to16';
}

export class FeedbackGenerationService {
  private stats: FeedbackStats = {
    totalFeedbackGenerated: 0,
    averageProcessingTime: 0,
    feedbackByAgeGroup: {},
    feedbackBySubject: {},
    successRate: 0,
    commonIssues: [],
    totalErrors: 0
  };

  private processingTimes: number[] = [];

  constructor(
    private logger: winston.Logger,
    private chatgptService: ChatGPTService,
    private ttsService?: TextToSpeechService
  ) {
    this.logger.info('FeedbackGenerationService initialized');
  }

  async generateFeedback(request: FeedbackRequest): Promise<FeedbackResponse> {
    const startTime = Date.now();

    try {
      this.logger.info('Generating feedback', {
        analysisId: request.analysisId,
        childId: request.childId,
        ageGroup: request.ageGroup
      });

      // Fetch analysis result from storage (mock for now)
      const analysisResult = await this.fetchAnalysisResult(request.analysisId);

      if (!analysisResult) {
        return {
          success: false,
          error: `Analysis not found for ID: ${request.analysisId}`
        };
      }

      // Generate age-appropriate feedback using ChatGPT
      const feedbackData = await this.generateAgeAdaptiveFeedback(analysisResult, request.ageGroup);

      // Create visual annotations from error locations
      const visualAnnotations = this.createVisualAnnotations(analysisResult);

      // Generate learning insights
      const learningInsights = await this.generateLearningInsightsFromAnalysis(analysisResult);

      // Generate voice feedback if TTS service is available
      let voiceFeedbackUrl: string | undefined;
      if (this.ttsService) {
        try {
          voiceFeedbackUrl = await this.generateVoiceFeedback(
            feedbackData.feedback,
            request.childId,
            request.ageGroup
          );
        } catch (error) {
          this.logger.warn('Failed to generate voice feedback', {
            error: error instanceof Error ? error.message : error
          });
        }
      }

      const feedbackContent: FeedbackContent = {
        feedback: feedbackData.feedback,
        positiveReinforcement: feedbackData.positiveReinforcement,
        improvementSuggestions: feedbackData.improvementSuggestions,
        visualAnnotations,
        learningInsights,
        ageGroup: request.ageGroup,
        voiceFeedbackUrl
      };

      const processingTime = Date.now() - startTime;
      this.updateStats(request.ageGroup, analysisResult.subject, processingTime, true);

      this.logger.info('Feedback generated successfully', {
        analysisId: request.analysisId,
        processingTime,
        feedbackLength: feedbackContent.feedback.length
      });

      return {
        success: true,
        feedbackId: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        feedbackContent,
        processingTime
      };

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      this.updateStats(request.ageGroup, 'unknown', processingTime, false);

      this.logger.error('Failed to generate feedback', {
        analysisId: request.analysisId,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        error: `Failed to generate feedback: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime
      };
    }
  }

  private async fetchAnalysisResult(analysisId: string): Promise<MockAnalysisResult | null> {
    this.logger.debug('Fetching analysis result', { analysisId });

    // Mock result for development - this would integrate with SurrealDB
    if (analysisId === 'test_analysis') {
      return {
        id: analysisId,
        childId: 'child_123',
        subject: 'mathematics',
        content: '2 + 2 = 5',
        accuracy: 0.2,
        errors: [{
          type: 'computational_error',
          description: 'Incorrect sum: 2 + 2 = 4, not 5',
          severity: 'high',
          location: { x: 100, y: 50, width: 20, height: 15 }
        }],
        correctSolutions: ['2 + 2 = 4'],
        skillsAssessed: ['basic_addition'],
        ageGroup: 'ages6to9' as const
      };
    }

    return null;
  }

  private async generateAgeAdaptiveFeedback(
    analysis: MockAnalysisResult,
    ageGroup: 'ages6to9' | 'ages10to13' | 'ages14to16'
  ) {
    const context: ConversationContext = {
      childId: analysis.childId,
      ageGroup,
      subject: analysis.subject,
      topic: 'work_feedback',
      sessionId: `feedback_${Date.now()}`,
      conversationHistory: []
    };

    const feedbackPrompt = this.buildAgeAdaptivePrompt(analysis, ageGroup);
    const response = await this.chatgptService.generateResponse(context, feedbackPrompt);

    return this.parseFeedbackResponse(response.content, analysis);
  }

  private buildAgeAdaptivePrompt(analysis: MockAnalysisResult, ageGroup: string): string {
    const ageProfiles = {
      'ages6to9': {
        vocabulary: 'simple, encouraging',
        explanations: 'concrete examples, visual aids',
        tone: 'playful, supportive',
        motivation: 'stickers, praise, games'
      },
      'ages10to13': {
        vocabulary: 'clear, building confidence',
        explanations: 'step-by-step reasoning',
        tone: 'encouraging, respectful',
        motivation: 'achievement, progress tracking'
      },
      'ages14to16': {
        vocabulary: 'mature, analytical',
        explanations: 'detailed reasoning, connections',
        tone: 'respectful, collaborative',
        motivation: 'mastery, real-world applications'
      }
    };

    const profile = ageProfiles[ageGroup as keyof typeof ageProfiles];

    return `
      Provide educational feedback for a ${ageGroup.replace('ages', '').replace('to', '-')} year old child.

      Content analyzed: ${analysis.content}
      Subject: ${analysis.subject}
      Accuracy: ${(analysis.accuracy * 100).toFixed(1)}%
      Errors found: ${analysis.errors.length}

      Use ${profile.vocabulary} vocabulary and ${profile.tone} tone.
      Provide ${profile.explanations} and include ${profile.motivation} elements.

      Focus on:
      1. Positive reinforcement for effort and correct parts
      2. Gentle correction with clear explanations
      3. Actionable next steps for improvement
      4. Age-appropriate encouragement

      Please respond with constructive feedback in a warm, educational tone.
    `;
  }

  private parseFeedbackResponse(responseContent: string, analysis: MockAnalysisResult) {
    // Basic parsing - in a real implementation this would be more sophisticated
    return {
      feedback: responseContent,
      positiveReinforcement: this.extractPositiveElements(analysis),
      improvementSuggestions: this.generateImprovementSuggestions(analysis),
      visualAnnotations: []
    };
  }

  private extractPositiveElements(analysis: MockAnalysisResult): string[] {
    const elements = ['Good effort on attempting this problem!'];

    if (analysis.accuracy > 0.5) {
      elements.push('You got some parts right!');
    }

    elements.push('Your handwriting is clear and easy to read');

    return elements;
  }

  private generateImprovementSuggestions(analysis: MockAnalysisResult): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];

    analysis.errors.forEach((error: any) => {
      suggestions.push({
        area: error.type.replace('_', ' '),
        suggestion: this.getSubjectSpecificSuggestion(analysis.subject, error.type),
        actionable: true,
        priority: error.severity === 'high' ? 'high' : 'medium'
      });
    });

    return suggestions;
  }

  private getSubjectSpecificSuggestion(subject: string, errorType: string): string {
    const suggestions: Record<string, Record<string, string>> = {
      mathematics: {
        computational_error: 'Double-check your arithmetic by counting or using visual aids',
        conceptual_error: 'Review the basic concepts and try some practice problems'
      },
      english: {
        spelling_error: 'Try sounding out the word or using a dictionary',
        grammar_error: 'Read your sentence aloud to check if it sounds right'
      }
    };

    return suggestions[subject]?.[errorType] || 'Keep practicing to improve your skills';
  }

  private createVisualAnnotations(analysis: MockAnalysisResult): VisualAnnotation[] {
    const annotations: VisualAnnotation[] = [];

    analysis.errors.forEach((error: any) => {
      if (error.location) {
        annotations.push({
          x: error.location.x,
          y: error.location.y,
          width: error.location.width,
          height: error.location.height,
          type: 'error',
          message: error.description,
          severity: error.severity as 'low' | 'medium' | 'high',
          color: this.getSeverityColor(error.severity)
        });
      }
    });

    return annotations;
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#3b82f6';
      default: return '#6b7280';
    }
  }

  private async generateLearningInsightsFromAnalysis(analysis: MockAnalysisResult): Promise<LearningInsight> {
    const errorPatterns = analysis.errors.map((error: any) => error.type);
    const skillsNeedingFocus = analysis.skillsAssessed.filter((_skill: any) => analysis.accuracy < 0.8);

    return {
      commonErrorPatterns: errorPatterns,
      skillsNeedingFocus,
      recommendedActivities: this.getRecommendedActivities(analysis.subject, skillsNeedingFocus),
      progressIndicators: this.createProgressIndicators(analysis),
      motivationalElements: this.getMotivationalElements(analysis.ageGroup, analysis.accuracy)
    };
  }

  async generateLearningInsights(feedbackHistory: FeedbackHistory[]): Promise<LearningInsight> {
    if (feedbackHistory.length === 0) {
      return {
        commonErrorPatterns: [],
        skillsNeedingFocus: [],
        recommendedActivities: [],
        progressIndicators: [],
        motivationalElements: []
      };
    }

    const errorCounts = new Map<string, number>();
    const skillCounts = new Map<string, number>();

    feedbackHistory.forEach(feedback => {
      feedback.errors.forEach(error => {
        errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
      });
      feedback.skillsAssessed.forEach(skill => {
        skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
      });
    });

    const commonErrors = Array.from(errorCounts.entries())
      .filter(([, count]) => count >= 2)
      .map(([error]) => error);

    const frequentSkills = Array.from(skillCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([skill]) => skill);

    return {
      commonErrorPatterns: commonErrors,
      skillsNeedingFocus: frequentSkills,
      recommendedActivities: this.getRecommendedActivities('mixed', frequentSkills),
      progressIndicators: [{
        area: 'overall_progress',
        currentLevel: 'developing',
        targetLevel: 'proficient',
        timeframe: '2-4 weeks'
      }],
      motivationalElements: ['Keep practicing!', 'You\'re making great progress!']
    };
  }

  private getRecommendedActivities(subject: string, skills: string[]): string[] {
    const activityMap: Record<string, string[]> = {
      mathematics: [
        'Practice with manipulatives',
        'Use online math games',
        'Work through step-by-step examples',
        'Try real-world math problems'
      ],
      english: [
        'Read age-appropriate books',
        'Practice writing exercises',
        'Use grammar games',
        'Keep a learning journal'
      ],
      science: [
        'Conduct simple experiments',
        'Watch educational videos',
        'Create science diagrams',
        'Explore nature connections'
      ]
    };

    return activityMap[subject] || activityMap.mathematics;
  }

  private createProgressIndicators(analysis: MockAnalysisResult) {
    return analysis.skillsAssessed.map((skill: any) => ({
      area: skill,
      currentLevel: analysis.accuracy > 0.8 ? 'proficient' : 'developing',
      targetLevel: 'mastery',
      timeframe: analysis.accuracy > 0.8 ? '1-2 weeks' : '3-4 weeks'
    }));
  }

  private getMotivationalElements(ageGroup: string, accuracy: number): string[] {
    if (accuracy > 0.8) {
      return ['Excellent work!', 'You\'re mastering this!', 'Keep it up!'];
    } else if (accuracy > 0.5) {
      return ['Good effort!', 'You\'re getting there!', 'Practice makes perfect!'];
    } else {
      return ['Great try!', 'Learning takes time!', 'You can do this!'];
    }
  }

  /**
   * Generate voice feedback using the TTS service
   */
  private async generateVoiceFeedback(
    feedbackText: string,
    childId: string,
    ageGroup: 'ages6to9' | 'ages10to13' | 'ages14to16'
  ): Promise<string> {
    if (!this.ttsService) {
      throw new Error('TTS service not available');
    }

    this.logger.debug('Generating voice feedback', {
      childId,
      ageGroup,
      textLength: feedbackText.length
    });

    // Prepare age-appropriate voice feedback
    const voiceFeedbackText = this.prepareVoiceFeedbackText(feedbackText, ageGroup);

    const ttsRequest: TTSRequestByAge = {
      text: voiceFeedbackText,
      ageGroup,
      enableCache: true,
      metadata: {
        childId,
        timestamp: new Date(),
        conversationContext: true
      }
    };

    const ttsResult = await this.ttsService.synthesizeByAge(ttsRequest);

    if (!ttsResult.success || !ttsResult.audioUrl) {
      throw new Error(`TTS synthesis failed: ${ttsResult.error || 'Unknown error'}`);
    }

    this.logger.info('Voice feedback generated successfully', {
      childId,
      ageGroup,
      audioUrl: ttsResult.audioUrl,
      processingTime: ttsResult.processingTime
    });

    return ttsResult.audioUrl;
  }

  /**
   * Prepare feedback text for voice synthesis with age-appropriate pacing
   */
  private prepareVoiceFeedbackText(
    feedbackText: string,
    ageGroup: 'ages6to9' | 'ages10to13' | 'ages14to16'
  ): string {
    // Add natural pauses for younger children
    let processedText = feedbackText;

    if (ageGroup === 'ages6to9') {
      // Add longer pauses for younger children
      processedText = processedText
        .replace(/\. /g, '. <break time="800ms"/> ')
        .replace(/\! /g, '! <break time="600ms"/> ')
        .replace(/\? /g, '? <break time="700ms"/> ');
    } else if (ageGroup === 'ages10to13') {
      // Moderate pauses for middle age group
      processedText = processedText
        .replace(/\. /g, '. <break time="500ms"/> ')
        .replace(/\! /g, '! <break time="400ms"/> ')
        .replace(/\? /g, '? <break time="450ms"/> ');
    }
    // ages14to16 gets natural pacing without additional breaks

    return processedText;
  }

  private updateStats(
    ageGroup: string,
    subject: string,
    processingTime: number,
    success: boolean
  ): void {
    this.stats.totalFeedbackGenerated++;

    if (success) {
      this.processingTimes.push(processingTime);
      this.stats.averageProcessingTime =
        this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    } else {
      this.stats.totalErrors++;
    }

    this.stats.feedbackByAgeGroup[ageGroup] = (this.stats.feedbackByAgeGroup[ageGroup] || 0) + 1;
    this.stats.feedbackBySubject[subject] = (this.stats.feedbackBySubject[subject] || 0) + 1;

    this.stats.successRate = (this.stats.totalFeedbackGenerated - this.stats.totalErrors) /
                           this.stats.totalFeedbackGenerated;
  }

  getStats(): FeedbackStats {
    return { ...this.stats };
  }

  async healthCheck(): Promise<{ status: string; latency: number; lastError?: string }> {
    const startTime = Date.now();

    try {
      await this.fetchAnalysisResult('health_check');

      return {
        status: 'healthy',
        latency: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const createFeedbackGenerationService = (
  logger: winston.Logger,
  chatgptService: ChatGPTService,
  ttsService?: TextToSpeechService
): FeedbackGenerationService => {
  return new FeedbackGenerationService(logger, chatgptService, ttsService);
};
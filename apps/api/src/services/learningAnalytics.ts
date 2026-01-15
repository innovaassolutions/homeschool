import winston from 'winston';
import { ProgressRepository } from './progressRepository';
import { LearningSessionProgress, AttentionMetrics, VoiceInteractionData, PhotoAssessmentResult } from './progressTracking';
import { SkillMasteryRecord, SkillMasteryService } from './skillMastery';
import { AgeGroup } from './chatgpt';

// Analytics pattern types
export interface AttentionPattern {
  patternId: string;
  childId: string;
  patternType: 'focus_duration' | 'distraction_frequency' | 'break_timing' | 'attention_decay';
  description: string;
  confidence: number; // 0-1
  strength: number; // 0-1
  timeRange: {
    start: Date;
    end: Date;
  };
  recommendations: string[];
  metadata: {
    averageFocusLevel: number;
    sessionsAnalyzed: number;
    consistencyScore: number;
  };
}

export interface EngagementPattern {
  patternId: string;
  childId: string;
  patternType: 'subject_preference' | 'time_of_day' | 'activity_type' | 'interaction_style';
  description: string;
  confidence: number; // 0-1
  strength: number; // 0-1
  timeRange: {
    start: Date;
    end: Date;
  };
  recommendations: string[];
  metadata: {
    averageEngagement: number;
    peakPerformanceTime: string;
    preferredActivities: string[];
    engagementTriggers: string[];
  };
}

export interface ComprehensionPattern {
  patternId: string;
  childId: string;
  patternType: 'skill_acquisition' | 'difficulty_threshold' | 'learning_style' | 'retention_rate';
  description: string;
  confidence: number; // 0-1
  strength: number; // 0-1
  timeRange: {
    start: Date;
    end: Date;
  };
  recommendations: string[];
  metadata: {
    averageSuccessRate: number;
    learningVelocity: number; // Skills per week
    retentionScore: number;
    optimalDifficulty: number; // 1-10
  };
}

export interface LearningInsight {
  insightId: string;
  childId: string;
  category: 'attention' | 'engagement' | 'comprehension' | 'progress' | 'behavior';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  recommendations: string[];
  evidence: string[];
  timestamp: Date;
  relevanceScore: number; // 0-1
}

export interface LearningAnalyticsReport {
  childId: string;
  reportId: string;
  generatedAt: Date;
  timeRange: {
    start: Date;
    end: Date;
  };
  summary: {
    totalSessions: number;
    totalLearningTime: number; // minutes
    averageEngagement: number; // 0-100
    averageFocus: number; // 0-100
    skillsProgressed: number;
    overallTrend: 'improving' | 'stable' | 'declining';
  };
  attentionPatterns: AttentionPattern[];
  engagementPatterns: EngagementPattern[];
  comprehensionPatterns: ComprehensionPattern[];
  insights: LearningInsight[];
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

/**
 * Learning Analytics Engine
 *
 * Analyzes learning data to identify patterns in attention, engagement, and comprehension.
 * Provides actionable insights and recommendations for personalized learning.
 */
export class LearningAnalyticsService {
  private logger: winston.Logger;
  private repository: ProgressRepository;
  private skillMasteryService: SkillMasteryService;

  constructor(
    repository: ProgressRepository,
    skillMasteryService: SkillMasteryService,
    logger: winston.Logger
  ) {
    this.repository = repository;
    this.skillMasteryService = skillMasteryService;
    this.logger = logger;
    this.logger.info('LearningAnalyticsService initialized');
  }

  /**
   * Generate comprehensive learning analytics report
   */
  async generateAnalyticsReport(
    childId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<LearningAnalyticsReport> {
    try {
      const reportId = `analytics-${childId}-${Date.now()}`;

      // Get session progress data for analysis
      const sessionData = await this.repository.getSessionProgressByDateRange(
        childId,
        timeRange.start,
        timeRange.end
      );

      if (sessionData.length === 0) {
        return this.createEmptyReport(childId, reportId, timeRange);
      }

      // Generate summary statistics
      const summary = this.generateSummaryStatistics(sessionData);

      // Analyze patterns
      const [attentionPatterns, engagementPatterns, comprehensionPatterns] = await Promise.all([
        this.analyzeAttentionPatterns(childId, sessionData, timeRange),
        this.analyzeEngagementPatterns(childId, sessionData, timeRange),
        this.analyzeComprehensionPatterns(childId, sessionData, timeRange)
      ]);

      // Generate insights
      const insights = await this.generateLearningInsights(
        childId,
        sessionData,
        attentionPatterns,
        engagementPatterns,
        comprehensionPatterns
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        attentionPatterns,
        engagementPatterns,
        comprehensionPatterns,
        insights
      );

      const report: LearningAnalyticsReport = {
        childId,
        reportId,
        generatedAt: new Date(),
        timeRange,
        summary,
        attentionPatterns,
        engagementPatterns,
        comprehensionPatterns,
        insights,
        recommendations
      };

      this.logger.info('Learning analytics report generated', {
        childId,
        reportId,
        sessionsAnalyzed: sessionData.length,
        insightsGenerated: insights.length,
        patternsFound: attentionPatterns.length + engagementPatterns.length + comprehensionPatterns.length
      });

      return report;

    } catch (error) {
      this.logger.error('Failed to generate analytics report', {
        error: error instanceof Error ? error.message : error,
        childId
      });
      throw error;
    }
  }

  /**
   * Analyze attention patterns from session data
   */
  async analyzeAttentionPatterns(
    childId: string,
    sessionData: LearningSessionProgress[],
    timeRange: { start: Date; end: Date }
  ): Promise<AttentionPattern[]> {
    const patterns: AttentionPattern[] = [];

    try {
      // Analyze focus duration patterns
      const focusDurationPattern = this.analyzeFocusDuration(childId, sessionData, timeRange);
      if (focusDurationPattern) patterns.push(focusDurationPattern);

      // Analyze distraction frequency patterns
      const distractionPattern = this.analyzeDistractionFrequency(childId, sessionData, timeRange);
      if (distractionPattern) patterns.push(distractionPattern);

      // Analyze break timing patterns
      const breakTimingPattern = this.analyzeBreakTiming(childId, sessionData, timeRange);
      if (breakTimingPattern) patterns.push(breakTimingPattern);

      // Analyze attention decay patterns
      const attentionDecayPattern = this.analyzeAttentionDecay(childId, sessionData, timeRange);
      if (attentionDecayPattern) patterns.push(attentionDecayPattern);

      return patterns;

    } catch (error) {
      this.logger.error('Failed to analyze attention patterns', {
        error: error instanceof Error ? error.message : error,
        childId
      });
      return [];
    }
  }

  /**
   * Analyze engagement patterns from session data
   */
  async analyzeEngagementPatterns(
    childId: string,
    sessionData: LearningSessionProgress[],
    timeRange: { start: Date; end: Date }
  ): Promise<EngagementPattern[]> {
    const patterns: EngagementPattern[] = [];

    try {
      // Analyze subject preferences
      const subjectPreferencePattern = this.analyzeSubjectPreferences(childId, sessionData, timeRange);
      if (subjectPreferencePattern) patterns.push(subjectPreferencePattern);

      // Analyze time-of-day patterns
      const timeOfDayPattern = this.analyzeTimeOfDayEngagement(childId, sessionData, timeRange);
      if (timeOfDayPattern) patterns.push(timeOfDayPattern);

      // Analyze activity type preferences
      const activityTypePattern = this.analyzeActivityTypeEngagement(childId, sessionData, timeRange);
      if (activityTypePattern) patterns.push(activityTypePattern);

      // Analyze interaction style preferences
      const interactionStylePattern = this.analyzeInteractionStyles(childId, sessionData, timeRange);
      if (interactionStylePattern) patterns.push(interactionStylePattern);

      return patterns;

    } catch (error) {
      this.logger.error('Failed to analyze engagement patterns', {
        error: error instanceof Error ? error.message : error,
        childId
      });
      return [];
    }
  }

  /**
   * Analyze comprehension patterns from session data
   */
  async analyzeComprehensionPatterns(
    childId: string,
    sessionData: LearningSessionProgress[],
    timeRange: { start: Date; end: Date }
  ): Promise<ComprehensionPattern[]> {
    const patterns: ComprehensionPattern[] = [];

    try {
      // Analyze skill acquisition patterns
      const skillAcquisitionPattern = await this.analyzeSkillAcquisition(childId, sessionData, timeRange);
      if (skillAcquisitionPattern) patterns.push(skillAcquisitionPattern);

      // Analyze difficulty threshold patterns
      const difficultyThresholdPattern = this.analyzeDifficultyThresholds(childId, sessionData, timeRange);
      if (difficultyThresholdPattern) patterns.push(difficultyThresholdPattern);

      // Analyze learning style patterns
      const learningStylePattern = this.analyzeLearningStyles(childId, sessionData, timeRange);
      if (learningStylePattern) patterns.push(learningStylePattern);

      // Analyze retention rate patterns
      const retentionPattern = await this.analyzeRetentionRates(childId, sessionData, timeRange);
      if (retentionPattern) patterns.push(retentionPattern);

      return patterns;

    } catch (error) {
      this.logger.error('Failed to analyze comprehension patterns', {
        error: error instanceof Error ? error.message : error,
        childId
      });
      return [];
    }
  }

  /**
   * Generate actionable learning insights
   */
  async generateLearningInsights(
    childId: string,
    sessionData: LearningSessionProgress[],
    attentionPatterns: AttentionPattern[],
    engagementPatterns: EngagementPattern[],
    comprehensionPatterns: ComprehensionPattern[]
  ): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];

    try {
      // Generate attention insights
      attentionPatterns.forEach(pattern => {
        if (pattern.confidence > 0.7) {
          insights.push(this.createInsightFromAttentionPattern(pattern));
        }
      });

      // Generate engagement insights
      engagementPatterns.forEach(pattern => {
        if (pattern.confidence > 0.7) {
          insights.push(this.createInsightFromEngagementPattern(pattern));
        }
      });

      // Generate comprehension insights
      comprehensionPatterns.forEach(pattern => {
        if (pattern.confidence > 0.7) {
          insights.push(this.createInsightFromComprehensionPattern(pattern));
        }
      });

      // Generate cross-pattern insights
      const crossPatternInsights = this.generateCrossPatternInsights(
        childId,
        attentionPatterns,
        engagementPatterns,
        comprehensionPatterns
      );
      insights.push(...crossPatternInsights);

      // Sort insights by relevance and impact
      return insights
        .sort((a, b) => {
          const impactOrder = { high: 3, medium: 2, low: 1 };
          return (impactOrder[b.impact] - impactOrder[a.impact]) ||
                 (b.relevanceScore - a.relevanceScore);
        })
        .slice(0, 10); // Top 10 insights

    } catch (error) {
      this.logger.error('Failed to generate learning insights', {
        error: error instanceof Error ? error.message : error,
        childId
      });
      return [];
    }
  }

  /**
   * Private helper methods for pattern analysis
   */

  private generateSummaryStatistics(sessionData: LearningSessionProgress[]): LearningAnalyticsReport['summary'] {
    const totalSessions = sessionData.length;
    const totalLearningTime = sessionData.reduce((sum, session) =>
      sum + (session.attentionMetrics.effectiveLearningTime / (1000 * 60)), 0);

    const averageEngagement = sessionData.reduce((sum, session) =>
      sum + session.attentionMetrics.engagementScore, 0) / totalSessions || 0;

    const averageFocus = sessionData.reduce((sum, session) =>
      sum + session.attentionMetrics.focusLevel, 0) / totalSessions || 0;

    const skillsProgressed = new Set(
      sessionData.flatMap(session => session.skillMasteryUpdates.map(update => update.skillId))
    ).size;

    // Calculate trend (simplified)
    const firstHalf = sessionData.slice(0, Math.floor(sessionData.length / 2));
    const secondHalf = sessionData.slice(Math.floor(sessionData.length / 2));

    const firstHalfAvg = firstHalf.reduce((sum, s) => sum + s.overallProgress, 0) / (firstHalf.length || 1);
    const secondHalfAvg = secondHalf.reduce((sum, s) => sum + s.overallProgress, 0) / (secondHalf.length || 1);

    let overallTrend: 'improving' | 'stable' | 'declining';
    if (secondHalfAvg > firstHalfAvg + 0.1) {
      overallTrend = 'improving';
    } else if (secondHalfAvg < firstHalfAvg - 0.1) {
      overallTrend = 'declining';
    } else {
      overallTrend = 'stable';
    }

    return {
      totalSessions,
      totalLearningTime: Math.round(totalLearningTime),
      averageEngagement: Math.round(averageEngagement),
      averageFocus: Math.round(averageFocus),
      skillsProgressed,
      overallTrend
    };
  }

  private analyzeFocusDuration(
    childId: string,
    sessionData: LearningSessionProgress[],
    timeRange: { start: Date; end: Date }
  ): AttentionPattern | null {
    const focusLevels = sessionData.map(session => session.attentionMetrics.focusLevel);
    const averageFocusLevel = focusLevels.reduce((sum, level) => sum + level, 0) / focusLevels.length;

    if (focusLevels.length < 3) return null;

    const consistencyScore = this.calculateConsistency(focusLevels);
    const confidence = Math.min(0.9, consistencyScore + (sessionData.length / 20)); // More sessions = higher confidence

    let description: string;
    let recommendations: string[];

    if (averageFocusLevel > 80) {
      description = 'Demonstrates excellent sustained attention and focus during learning sessions';
      recommendations = [
        'Continue with current session lengths',
        'Consider introducing more challenging content',
        'Maintain consistent learning environment'
      ];
    } else if (averageFocusLevel > 60) {
      description = 'Shows moderate focus levels with room for improvement';
      recommendations = [
        'Try shorter learning sessions with breaks',
        'Minimize distractions in learning environment',
        'Use engaging, interactive activities'
      ];
    } else {
      description = 'Struggles with maintaining focus during learning sessions';
      recommendations = [
        'Break sessions into 10-15 minute segments',
        'Use movement and hands-on activities',
        'Check for underlying attention challenges'
      ];
    }

    return {
      patternId: `focus-duration-${childId}-${Date.now()}`,
      childId,
      patternType: 'focus_duration',
      description,
      confidence,
      strength: averageFocusLevel / 100,
      timeRange,
      recommendations,
      metadata: {
        averageFocusLevel,
        sessionsAnalyzed: sessionData.length,
        consistencyScore
      }
    };
  }

  private analyzeDistractionFrequency(
    childId: string,
    sessionData: LearningSessionProgress[],
    timeRange: { start: Date; end: Date }
  ): AttentionPattern | null {
    const distractionEvents = sessionData.map(session => session.attentionMetrics.distractionEvents);
    const averageDistractions = distractionEvents.reduce((sum, events) => sum + events, 0) / distractionEvents.length;

    if (sessionData.length < 3) return null;

    const consistency = this.calculateConsistency(distractionEvents);
    const confidence = Math.min(0.9, consistency + (sessionData.length / 30));

    let description: string;
    let recommendations: string[];

    if (averageDistractions < 2) {
      description = 'Rarely gets distracted during learning sessions';
      recommendations = [
        'Maintain current learning environment',
        'Can handle longer sessions',
        'Good candidate for independent learning'
      ];
    } else if (averageDistractions < 5) {
      description = 'Experiences moderate distraction during learning';
      recommendations = [
        'Remove potential distractions from environment',
        'Use timer to track focus periods',
        'Provide clear transitions between activities'
      ];
    } else {
      description = 'Frequently gets distracted during learning sessions';
      recommendations = [
        'Create highly structured environment',
        'Use very short activity segments',
        'Consider fidget tools or movement breaks'
      ];
    }

    return {
      patternId: `distraction-freq-${childId}-${Date.now()}`,
      childId,
      patternType: 'distraction_frequency',
      description,
      confidence,
      strength: Math.max(0, 1 - (averageDistractions / 10)), // Lower distractions = higher strength
      timeRange,
      recommendations,
      metadata: {
        averageFocusLevel: sessionData.reduce((sum, s) => sum + s.attentionMetrics.focusLevel, 0) / sessionData.length,
        sessionsAnalyzed: sessionData.length,
        consistencyScore: consistency
      }
    };
  }

  private analyzeBreakTiming(
    childId: string,
    sessionData: LearningSessionProgress[],
    timeRange: { start: Date; end: Date }
  ): AttentionPattern | null {
    const breakFrequencies = sessionData.map(session => session.attentionMetrics.breakFrequency);
    const averageBreakFreq = breakFrequencies.reduce((sum, freq) => sum + freq, 0) / breakFrequencies.length;

    if (sessionData.length < 3) return null;

    const confidence = Math.min(0.8, sessionData.length / 20);

    let description: string;
    let recommendations: string[];

    if (averageBreakFreq < 1) {
      description = 'Can sustain learning for extended periods without breaks';
      recommendations = [
        'Monitor for signs of fatigue',
        'Introduce optional movement breaks',
        'Can handle longer learning sessions'
      ];
    } else if (averageBreakFreq < 3) {
      description = 'Benefits from moderate break frequency during learning';
      recommendations = [
        'Continue current break schedule',
        'Use breaks for physical movement',
        'Keep breaks short and structured'
      ];
    } else {
      description = 'Requires frequent breaks to maintain learning effectiveness';
      recommendations = [
        'Plan breaks every 10-15 minutes',
        'Make breaks active and engaging',
        'Consider shorter overall session lengths'
      ];
    }

    return {
      patternId: `break-timing-${childId}-${Date.now()}`,
      childId,
      patternType: 'break_timing',
      description,
      confidence,
      strength: averageBreakFreq > 0 ? Math.min(1, 3 / averageBreakFreq) : 1,
      timeRange,
      recommendations,
      metadata: {
        averageFocusLevel: sessionData.reduce((sum, s) => sum + s.attentionMetrics.focusLevel, 0) / sessionData.length,
        sessionsAnalyzed: sessionData.length,
        consistencyScore: this.calculateConsistency(breakFrequencies)
      }
    };
  }

  private analyzeAttentionDecay(
    childId: string,
    sessionData: LearningSessionProgress[],
    timeRange: { start: Date; end: Date }
  ): AttentionPattern | null {
    // Analyze if attention decreases over session duration
    const sessionDurations = sessionData.map(session => session.attentionMetrics.sessionDuration / (1000 * 60)); // Convert to minutes
    const focusLevels = sessionData.map(session => session.attentionMetrics.focusLevel);

    if (sessionData.length < 5) return null;

    // Calculate correlation between session duration and focus level
    const correlation = this.calculateCorrelation(sessionDurations, focusLevels);
    const confidence = Math.min(0.9, Math.abs(correlation) * (sessionData.length / 10));

    let description: string;
    let recommendations: string[];

    if (correlation < -0.3) {
      description = 'Attention tends to decrease as session length increases';
      recommendations = [
        'Keep sessions shorter than average duration',
        'Front-load important concepts early in session',
        'Use attention-grabbing activities later in session'
      ];
    } else if (correlation > 0.3) {
      description = 'Maintains or improves focus as session progresses';
      recommendations = [
        'Can handle longer learning sessions',
        'Consider warm-up activities at start',
        'Save challenging content for mid-session'
      ];
    } else {
      description = 'Attention level remains consistent throughout sessions';
      recommendations = [
        'Current session structure works well',
        'Maintain consistent pacing',
        'Can vary activity placement within session'
      ];
    }

    return {
      patternId: `attention-decay-${childId}-${Date.now()}`,
      childId,
      patternType: 'attention_decay',
      description,
      confidence,
      strength: Math.abs(correlation),
      timeRange,
      recommendations,
      metadata: {
        averageFocusLevel: focusLevels.reduce((sum, level) => sum + level, 0) / focusLevels.length,
        sessionsAnalyzed: sessionData.length,
        consistencyScore: this.calculateConsistency(focusLevels)
      }
    };
  }

  private analyzeSubjectPreferences(
    childId: string,
    sessionData: LearningSessionProgress[],
    timeRange: { start: Date; end: Date }
  ): EngagementPattern | null {
    const subjectEngagement: Record<string, number[]> = {};

    sessionData.forEach(session => {
      if (!subjectEngagement[session.subject]) {
        subjectEngagement[session.subject] = [];
      }
      subjectEngagement[session.subject].push(session.attentionMetrics.engagementScore);
    });

    if (Object.keys(subjectEngagement).length < 2) return null;

    const subjectAverages = Object.entries(subjectEngagement).map(([subject, scores]) => ({
      subject,
      average: scores.reduce((sum, score) => sum + score, 0) / scores.length
    }));

    const sortedSubjects = subjectAverages.sort((a, b) => b.average - a.average);
    const topSubject = sortedSubjects[0];
    const overallAverage = subjectAverages.reduce((sum, subj) => sum + subj.average, 0) / subjectAverages.length;

    const confidence = Math.min(0.9, sessionData.length / 15);
    const strength = (topSubject.average - overallAverage) / 100;

    let description: string;
    let recommendations: string[];

    if (strength > 0.15) {
      description = `Shows strong preference and engagement with ${topSubject.subject}`;
      recommendations = [
        `Use ${topSubject.subject} as a motivator for other subjects`,
        `Consider advanced content in ${topSubject.subject}`,
        `Integrate preferred subject into other learning areas`
      ];
    } else {
      description = 'Shows relatively balanced engagement across subjects';
      recommendations = [
        'Continue varied subject exposure',
        'Watch for emerging preferences',
        'Use cross-curricular connections'
      ];
    }

    return {
      patternId: `subject-pref-${childId}-${Date.now()}`,
      childId,
      patternType: 'subject_preference',
      description,
      confidence,
      strength,
      timeRange,
      recommendations,
      metadata: {
        averageEngagement: overallAverage,
        peakPerformanceTime: topSubject.subject,
        preferredActivities: [topSubject.subject],
        engagementTriggers: [`${topSubject.subject} content`]
      }
    };
  }

  private analyzeTimeOfDayEngagement(
    childId: string,
    sessionData: LearningSessionProgress[],
    timeRange: { start: Date; end: Date }
  ): EngagementPattern | null {
    const hourlyEngagement: Record<number, number[]> = {};

    sessionData.forEach(session => {
      const hour = session.startTime.getHours();
      if (!hourlyEngagement[hour]) {
        hourlyEngagement[hour] = [];
      }
      hourlyEngagement[hour].push(session.attentionMetrics.engagementScore);
    });

    if (Object.keys(hourlyEngagement).length < 3) return null;

    const hourlyAverages = Object.entries(hourlyEngagement).map(([hour, scores]) => ({
      hour: parseInt(hour),
      average: scores.reduce((sum, score) => sum + score, 0) / scores.length
    }));

    const sortedHours = hourlyAverages.sort((a, b) => b.average - a.average);
    const peakHour = sortedHours[0];
    const overallAverage = hourlyAverages.reduce((sum, hourData) => sum + hourData.average, 0) / hourlyAverages.length;

    const confidence = Math.min(0.8, sessionData.length / 20);
    const strength = (peakHour.average - overallAverage) / 100;

    let timeDescription: string;
    if (peakHour.hour < 10) {
      timeDescription = 'morning';
    } else if (peakHour.hour < 14) {
      timeDescription = 'late morning';
    } else if (peakHour.hour < 17) {
      timeDescription = 'afternoon';
    } else {
      timeDescription = 'evening';
    }

    return {
      patternId: `time-of-day-${childId}-${Date.now()}`,
      childId,
      patternType: 'time_of_day',
      description: `Shows highest engagement during ${timeDescription} hours`,
      confidence,
      strength,
      timeRange,
      recommendations: [
        `Schedule important learning during ${timeDescription}`,
        `Use peak time for challenging subjects`,
        `Consider lighter activities during low-engagement times`
      ],
      metadata: {
        averageEngagement: overallAverage,
        peakPerformanceTime: `${peakHour.hour}:00`,
        preferredActivities: [`${timeDescription} learning`],
        engagementTriggers: [`${timeDescription} schedule`]
      }
    };
  }

  private analyzeActivityTypeEngagement(
    childId: string,
    sessionData: LearningSessionProgress[],
    timeRange: { start: Date; end: Date }
  ): EngagementPattern | null {
    // Analyze engagement based on voice vs photo activities
    const voiceEngagement: number[] = [];
    const photoEngagement: number[] = [];

    sessionData.forEach(session => {
      if (session.voiceInteractions.length > 0) {
        voiceEngagement.push(session.attentionMetrics.engagementScore);
      }
      if (session.photoAssessments.length > 0) {
        photoEngagement.push(session.attentionMetrics.engagementScore);
      }
    });

    if (voiceEngagement.length === 0 && photoEngagement.length === 0) return null;

    const voiceAvg = voiceEngagement.length > 0 ?
      voiceEngagement.reduce((sum, score) => sum + score, 0) / voiceEngagement.length : 0;
    const photoAvg = photoEngagement.length > 0 ?
      photoEngagement.reduce((sum, score) => sum + score, 0) / photoEngagement.length : 0;

    const confidence = Math.min(0.7, (voiceEngagement.length + photoEngagement.length) / 10);

    let description: string;
    let recommendations: string[];
    let preferredActivities: string[];

    if (voiceAvg > photoAvg + 10) {
      description = 'Shows higher engagement with voice-based interactive learning';
      recommendations = [
        'Emphasize discussion and verbal activities',
        'Use voice commands and responses',
        'Incorporate storytelling and conversation'
      ];
      preferredActivities = ['voice interaction', 'discussion', 'verbal activities'];
    } else if (photoAvg > voiceAvg + 10) {
      description = 'Shows higher engagement with visual and hands-on activities';
      recommendations = [
        'Emphasize visual learning materials',
        'Use photo-based assessments',
        'Incorporate drawing and visual projects'
      ];
      preferredActivities = ['photo activities', 'visual learning', 'hands-on work'];
    } else {
      description = 'Benefits from a balanced mix of activity types';
      recommendations = [
        'Continue using varied activity types',
        'Alternate between voice and visual activities',
        'Use multi-modal learning approaches'
      ];
      preferredActivities = ['mixed activities', 'multi-modal learning'];
    }

    return {
      patternId: `activity-type-${childId}-${Date.now()}`,
      childId,
      patternType: 'activity_type',
      description,
      confidence,
      strength: Math.abs(voiceAvg - photoAvg) / 100,
      timeRange,
      recommendations,
      metadata: {
        averageEngagement: (voiceAvg + photoAvg) / 2,
        peakPerformanceTime: voiceAvg > photoAvg ? 'voice activities' : 'photo activities',
        preferredActivities,
        engagementTriggers: preferredActivities
      }
    };
  }

  private analyzeInteractionStyles(
    childId: string,
    sessionData: LearningSessionProgress[],
    timeRange: { start: Date; end: Date }
  ): EngagementPattern | null {
    // Analyze based on interaction frequency and response times
    const interactions = sessionData.flatMap(session => session.voiceInteractions);

    if (interactions.length < 5) return null;

    const averageResponseTime = interactions.reduce((sum, interaction) =>
      sum + interaction.averageResponseTime, 0) / interactions.length;

    const totalInteractions = interactions.reduce((sum, interaction) =>
      sum + interaction.interactionCount, 0);

    const averageInteractionsPerSession = totalInteractions / sessionData.length;

    const confidence = Math.min(0.8, interactions.length / 20);

    let description: string;
    let recommendations: string[];

    if (averageInteractionsPerSession > 8 && averageResponseTime < 3000) {
      description = 'Prefers quick, frequent interactions during learning';
      recommendations = [
        'Use rapid-fire question formats',
        'Provide immediate feedback',
        'Keep individual interactions short and focused'
      ];
    } else if (averageInteractionsPerSession < 4 && averageResponseTime > 5000) {
      description = 'Prefers thoughtful, deliberate interactions with time to process';
      recommendations = [
        'Allow processing time between questions',
        'Use open-ended discussion formats',
        'Encourage detailed responses'
      ];
    } else {
      description = 'Shows balanced interaction style with moderate pacing';
      recommendations = [
        'Continue current interaction pacing',
        'Vary question types and timing',
        'Match interaction style to content complexity'
      ];
    }

    return {
      patternId: `interaction-style-${childId}-${Date.now()}`,
      childId,
      patternType: 'interaction_style',
      description,
      confidence,
      strength: 0.7, // Base strength for interaction patterns
      timeRange,
      recommendations,
      metadata: {
        averageEngagement: sessionData.reduce((sum, s) => sum + s.attentionMetrics.engagementScore, 0) / sessionData.length,
        peakPerformanceTime: 'interactive sessions',
        preferredActivities: ['interactive learning'],
        engagementTriggers: ['questions', 'discussions', 'feedback']
      }
    };
  }

  private async analyzeSkillAcquisition(
    childId: string,
    sessionData: LearningSessionProgress[],
    timeRange: { start: Date; end: Date }
  ): Promise<ComprehensionPattern | null> {
    const skillUpdates = sessionData.flatMap(session => session.skillMasteryUpdates);

    if (skillUpdates.length < 3) return null;

    const averageSuccessRate = skillUpdates.reduce((sum, update) =>
      sum + update.confidence, 0) / skillUpdates.length;

    // Calculate learning velocity (skills progressed per week)
    const timeSpanWeeks = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24 * 7);
    const uniqueSkills = new Set(skillUpdates.map(update => update.skillId)).size;
    const learningVelocity = uniqueSkills / Math.max(timeSpanWeeks, 1);

    const confidence = Math.min(0.9, skillUpdates.length / 15);

    let description: string;
    let recommendations: string[];

    if (learningVelocity > 2 && averageSuccessRate > 0.8) {
      description = 'Shows rapid skill acquisition with high success rates';
      recommendations = [
        'Consider accelerated learning paths',
        'Introduce more challenging content',
        'Explore advanced topics in strong areas'
      ];
    } else if (learningVelocity < 0.5 || averageSuccessRate < 0.6) {
      description = 'Benefits from slower, more reinforced skill development';
      recommendations = [
        'Focus on mastery before moving to new skills',
        'Provide additional practice opportunities',
        'Break skills into smaller components'
      ];
    } else {
      description = 'Shows steady, consistent skill acquisition';
      recommendations = [
        'Continue current learning pace',
        'Maintain balance of challenge and support',
        'Regular review and reinforcement'
      ];
    }

    return {
      patternId: `skill-acquisition-${childId}-${Date.now()}`,
      childId,
      patternType: 'skill_acquisition',
      description,
      confidence,
      strength: Math.min(1, (learningVelocity + averageSuccessRate) / 2),
      timeRange,
      recommendations,
      metadata: {
        averageSuccessRate,
        learningVelocity,
        retentionScore: averageSuccessRate, // Simplified
        optimalDifficulty: Math.min(10, Math.round(averageSuccessRate * 12))
      }
    };
  }

  private analyzeDifficultyThresholds(
    childId: string,
    sessionData: LearningSessionProgress[],
    timeRange: { start: Date; end: Date }
  ): ComprehensionPattern | null {
    // Analyze success rates across different difficulty levels
    const photoAssessments = sessionData.flatMap(session => session.photoAssessments);

    if (photoAssessments.length < 3) return null;

    const averageCorrectness = photoAssessments.reduce((sum, assessment) =>
      sum + assessment.correctnessScore, 0) / photoAssessments.length;

    const averageCompletion = photoAssessments.reduce((sum, assessment) =>
      sum + assessment.completionLevel, 0) / photoAssessments.length;

    const confidence = Math.min(0.8, photoAssessments.length / 10);

    // Estimate optimal difficulty based on performance
    const optimalDifficulty = Math.round((averageCorrectness + averageCompletion) * 5) + 2;

    let description: string;
    let recommendations: string[];

    if (averageCorrectness > 0.9 && averageCompletion > 0.9) {
      description = 'Handles current difficulty level very well, ready for more challenge';
      recommendations = [
        'Increase content difficulty gradually',
        'Introduce more complex problems',
        'Add multi-step challenges'
      ];
    } else if (averageCorrectness < 0.6 || averageCompletion < 0.6) {
      description = 'Struggles with current difficulty level, needs more support';
      recommendations = [
        'Reduce difficulty temporarily',
        'Provide more scaffolding',
        'Focus on foundational concepts'
      ];
    } else {
      description = 'Working at appropriate difficulty level';
      recommendations = [
        'Maintain current difficulty range',
        'Provide varied challenge levels',
        'Adjust based on topic complexity'
      ];
    }

    return {
      patternId: `difficulty-threshold-${childId}-${Date.now()}`,
      childId,
      patternType: 'difficulty_threshold',
      description,
      confidence,
      strength: averageCorrectness,
      timeRange,
      recommendations,
      metadata: {
        averageSuccessRate: averageCorrectness,
        learningVelocity: 1, // Simplified
        retentionScore: averageCompletion,
        optimalDifficulty
      }
    };
  }

  private analyzeLearningStyles(
    childId: string,
    sessionData: LearningSessionProgress[],
    timeRange: { start: Date; end: Date }
  ): ComprehensionPattern | null {
    // Analyze learning style preferences based on activity success
    const voiceSuccessRate = this.calculateVoiceSuccessRate(sessionData);
    const visualSuccessRate = this.calculateVisualSuccessRate(sessionData);

    if (sessionData.length < 5) return null;

    const confidence = Math.min(0.7, sessionData.length / 15);

    let description: string;
    let recommendations: string[];
    let dominantStyle: string;

    if (voiceSuccessRate > visualSuccessRate + 0.15) {
      dominantStyle = 'auditory';
      description = 'Shows preference for auditory and verbal learning approaches';
      recommendations = [
        'Emphasize verbal instructions and discussions',
        'Use audio materials and music',
        'Encourage verbal expression of ideas'
      ];
    } else if (visualSuccessRate > voiceSuccessRate + 0.15) {
      dominantStyle = 'visual';
      description = 'Shows preference for visual and hands-on learning approaches';
      recommendations = [
        'Use visual aids and diagrams',
        'Provide written instructions',
        'Incorporate drawing and visual projects'
      ];
    } else {
      dominantStyle = 'multimodal';
      description = 'Benefits from multiple learning modalities';
      recommendations = [
        'Continue using varied teaching methods',
        'Combine visual and auditory elements',
        'Use kinesthetic activities'
      ];
    }

    return {
      patternId: `learning-style-${childId}-${Date.now()}`,
      childId,
      patternType: 'learning_style',
      description,
      confidence,
      strength: Math.abs(voiceSuccessRate - visualSuccessRate),
      timeRange,
      recommendations,
      metadata: {
        averageSuccessRate: (voiceSuccessRate + visualSuccessRate) / 2,
        learningVelocity: 1, // Simplified
        retentionScore: 0.8, // Simplified
        optimalDifficulty: 5 // Simplified
      }
    };
  }

  private async analyzeRetentionRates(
    childId: string,
    sessionData: LearningSessionProgress[],
    timeRange: { start: Date; end: Date }
  ): Promise<ComprehensionPattern | null> {
    // Analyze how well skills are retained over time
    const skillUpdates = sessionData.flatMap(session => session.skillMasteryUpdates);

    if (skillUpdates.length < 5) return null;

    // Group by skill and analyze progression over time
    const skillProgressions: Record<string, SkillMasteryUpdate[]> = {};
    skillUpdates.forEach(update => {
      if (!skillProgressions[update.skillId]) {
        skillProgressions[update.skillId] = [];
      }
      skillProgressions[update.skillId].push(update);
    });

    let totalRetentionScore = 0;
    let skillsAnalyzed = 0;

    Object.values(skillProgressions).forEach(progression => {
      if (progression.length >= 2) {
        // Sort by timestamp
        progression.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Calculate if skill level improved or was maintained
        const firstLevel = progression[0].newLevel;
        const lastLevel = progression[progression.length - 1].newLevel;
        const retentionScore = lastLevel >= firstLevel ? 1 : lastLevel / firstLevel;

        totalRetentionScore += retentionScore;
        skillsAnalyzed++;
      }
    });

    if (skillsAnalyzed === 0) return null;

    const averageRetention = totalRetentionScore / skillsAnalyzed;
    const confidence = Math.min(0.8, skillsAnalyzed / 10);

    let description: string;
    let recommendations: string[];

    if (averageRetention > 0.9) {
      description = 'Excellent retention of learned skills over time';
      recommendations = [
        'Can move to new topics more quickly',
        'Minimal review needed for mastered skills',
        'Focus on building complexity'
      ];
    } else if (averageRetention > 0.7) {
      description = 'Good retention with occasional review needed';
      recommendations = [
        'Include periodic skill review',
        'Use spaced repetition techniques',
        'Connect new learning to previous knowledge'
      ];
    } else {
      description = 'Needs frequent review and reinforcement for retention';
      recommendations = [
        'Implement daily review of key concepts',
        'Use multiple practice opportunities',
        'Slow down introduction of new material'
      ];
    }

    return {
      patternId: `retention-rate-${childId}-${Date.now()}`,
      childId,
      patternType: 'retention_rate',
      description,
      confidence,
      strength: averageRetention,
      timeRange,
      recommendations,
      metadata: {
        averageSuccessRate: averageRetention,
        learningVelocity: skillsAnalyzed / ((timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24 * 7)),
        retentionScore: averageRetention,
        optimalDifficulty: Math.round(averageRetention * 8) + 2
      }
    };
  }

  private createInsightFromAttentionPattern(pattern: AttentionPattern): LearningInsight {
    return {
      insightId: `insight-attention-${Date.now()}`,
      childId: pattern.childId,
      category: 'attention',
      title: `Attention Pattern: ${pattern.patternType.replace('_', ' ')}`,
      description: pattern.description,
      impact: pattern.strength > 0.7 ? 'high' : pattern.strength > 0.4 ? 'medium' : 'low',
      actionable: true,
      recommendations: pattern.recommendations,
      evidence: [`Based on ${pattern.metadata.sessionsAnalyzed} learning sessions`],
      timestamp: new Date(),
      relevanceScore: pattern.confidence * pattern.strength
    };
  }

  private createInsightFromEngagementPattern(pattern: EngagementPattern): LearningInsight {
    return {
      insightId: `insight-engagement-${Date.now()}`,
      childId: pattern.childId,
      category: 'engagement',
      title: `Engagement Pattern: ${pattern.patternType.replace('_', ' ')}`,
      description: pattern.description,
      impact: pattern.strength > 0.7 ? 'high' : pattern.strength > 0.4 ? 'medium' : 'low',
      actionable: true,
      recommendations: pattern.recommendations,
      evidence: [`Average engagement: ${pattern.metadata.averageEngagement}%`],
      timestamp: new Date(),
      relevanceScore: pattern.confidence * pattern.strength
    };
  }

  private createInsightFromComprehensionPattern(pattern: ComprehensionPattern): LearningInsight {
    return {
      insightId: `insight-comprehension-${Date.now()}`,
      childId: pattern.childId,
      category: 'comprehension',
      title: `Comprehension Pattern: ${pattern.patternType.replace('_', ' ')}`,
      description: pattern.description,
      impact: pattern.strength > 0.7 ? 'high' : pattern.strength > 0.4 ? 'medium' : 'low',
      actionable: true,
      recommendations: pattern.recommendations,
      evidence: [`Success rate: ${Math.round(pattern.metadata.averageSuccessRate * 100)}%`],
      timestamp: new Date(),
      relevanceScore: pattern.confidence * pattern.strength
    };
  }

  private generateCrossPatternInsights(
    childId: string,
    attentionPatterns: AttentionPattern[],
    engagementPatterns: EngagementPattern[],
    comprehensionPatterns: ComprehensionPattern[]
  ): LearningInsight[] {
    const insights: LearningInsight[] = [];

    // Look for correlations between attention and engagement
    const highFocusPattern = attentionPatterns.find(p => p.patternType === 'focus_duration' && p.strength > 0.8);
    const subjectPreferencePattern = engagementPatterns.find(p => p.patternType === 'subject_preference' && p.strength > 0.6);

    if (highFocusPattern && subjectPreferencePattern) {
      insights.push({
        insightId: `cross-pattern-focus-preference-${Date.now()}`,
        childId,
        category: 'behavior',
        title: 'Strong Focus in Preferred Subjects',
        description: 'Shows excellent focus particularly in preferred subject areas',
        impact: 'high',
        actionable: true,
        recommendations: [
          'Use preferred subjects to introduce challenging concepts',
          'Leverage strong focus areas for skill transfer',
          'Consider subject integration strategies'
        ],
        evidence: ['High focus levels', 'Clear subject preferences'],
        timestamp: new Date(),
        relevanceScore: 0.9
      });
    }

    return insights;
  }

  private generateRecommendations(
    attentionPatterns: AttentionPattern[],
    engagementPatterns: EngagementPattern[],
    comprehensionPatterns: ComprehensionPattern[],
    insights: LearningInsight[]
  ): LearningAnalyticsReport['recommendations'] {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // Collect recommendations from high-impact patterns
    const allPatterns = [...attentionPatterns, ...engagementPatterns, ...comprehensionPatterns];

    allPatterns.forEach(pattern => {
      if (pattern.strength > 0.7 && pattern.confidence > 0.6) {
        immediate.push(...pattern.recommendations.slice(0, 1));
        shortTerm.push(...pattern.recommendations.slice(1, 2));
        longTerm.push(...pattern.recommendations.slice(2));
      }
    });

    // Add insights-based recommendations
    insights.forEach(insight => {
      if (insight.impact === 'high' && insight.actionable) {
        immediate.push(insight.recommendations[0]);
        if (insight.recommendations.length > 1) {
          shortTerm.push(insight.recommendations[1]);
        }
      }
    });

    return {
      immediate: [...new Set(immediate)].slice(0, 5),
      shortTerm: [...new Set(shortTerm)].slice(0, 5),
      longTerm: [...new Set(longTerm)].slice(0, 5)
    };
  }

  private createEmptyReport(
    childId: string,
    reportId: string,
    timeRange: { start: Date; end: Date }
  ): LearningAnalyticsReport {
    return {
      childId,
      reportId,
      generatedAt: new Date(),
      timeRange,
      summary: {
        totalSessions: 0,
        totalLearningTime: 0,
        averageEngagement: 0,
        averageFocus: 0,
        skillsProgressed: 0,
        overallTrend: 'stable'
      },
      attentionPatterns: [],
      engagementPatterns: [],
      comprehensionPatterns: [],
      insights: [{
        insightId: `empty-report-${Date.now()}`,
        childId,
        category: 'progress',
        title: 'Getting Started',
        description: 'Begin learning sessions to generate personalized analytics',
        impact: 'medium',
        actionable: true,
        recommendations: [
          'Complete 5-10 learning sessions for initial patterns',
          'Try different subjects and activity types',
          'Maintain consistent learning schedule'
        ],
        evidence: ['No session data available yet'],
        timestamp: new Date(),
        relevanceScore: 0.8
      }],
      recommendations: {
        immediate: ['Begin regular learning sessions', 'Try different activity types'],
        shortTerm: ['Establish learning routine', 'Track engagement patterns'],
        longTerm: ['Develop personalized learning plan']
      }
    };
  }

  // Utility methods

  private calculateConsistency(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);

    // Return consistency as 1 - (coefficient of variation)
    return Math.max(0, 1 - (standardDeviation / Math.max(mean, 1)));
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;

    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateVoiceSuccessRate(sessionData: LearningSessionProgress[]): number {
    const voiceInteractions = sessionData.flatMap(session => session.voiceInteractions);
    if (voiceInteractions.length === 0) return 0;

    return voiceInteractions.reduce((sum, interaction) =>
      sum + interaction.confidenceLevel, 0) / voiceInteractions.length;
  }

  private calculateVisualSuccessRate(sessionData: LearningSessionProgress[]): number {
    const photoAssessments = sessionData.flatMap(session => session.photoAssessments);
    if (photoAssessments.length === 0) return 0;

    return photoAssessments.reduce((sum, assessment) =>
      sum + assessment.correctnessScore, 0) / photoAssessments.length;
  }
}

/**
 * Factory function to create LearningAnalyticsService
 */
export function createLearningAnalyticsService(
  repository: ProgressRepository,
  skillMasteryService: SkillMasteryService,
  logger: winston.Logger
): LearningAnalyticsService {
  return new LearningAnalyticsService(repository, skillMasteryService, logger);
}
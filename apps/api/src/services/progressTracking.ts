import winston from 'winston';
import { LearningSession, SessionState, LearningObjective, ProgressMarker } from './learningSession';
import { AgeGroup } from './chatgpt';
import { ProgressRepository } from './progressRepository';

// Core progress tracking types
export interface AttentionMetrics {
  focusLevel: number; // 0-100
  distractionEvents: number;
  sessionDuration: number; // milliseconds
  effectiveLearningTime: number; // milliseconds
  breakFrequency: number;
  engagementScore: number; // 0-100
}

export interface VoiceInteractionData {
  sessionId: string;
  interactionCount: number;
  averageResponseTime: number;
  confidenceLevel: number; // 0-1
  topicsDiscussed: string[];
  skillsDemonstrated: string[];
  languageComplexity: number; // 0-10
}

export interface PhotoAssessmentResult {
  assessmentId: string;
  subject: string;
  topic: string;
  correctnessScore: number; // 0-1
  completionLevel: number; // 0-1
  skillsAssessed: string[];
  improvementAreas: string[];
  strengths: string[];
  timestamp: Date;
}

export interface LearningSessionProgress {
  sessionId: string;
  childId: string;
  subject: string;
  topic: string;
  startTime: Date;
  endTime?: Date;
  state: SessionState;

  // Progress metrics
  attentionMetrics: AttentionMetrics;
  voiceInteractions: VoiceInteractionData[];
  photoAssessments: PhotoAssessmentResult[];
  objectivesProgress: LearningObjective[];

  // Computed insights
  overallProgress: number; // 0-1
  skillMasteryUpdates: SkillMasteryUpdate[];
  learningPatterns: string[];
  recommendations: string[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillMasteryUpdate {
  skillId: string;
  skillName: string;
  previousLevel: number; // 0-10
  newLevel: number; // 0-10
  evidenceSource: 'voice' | 'photo' | 'session_completion' | 'objective_completion';
  confidence: number; // 0-1
  timestamp: Date;
}

export interface LearningPattern {
  patternType: 'attention_span' | 'learning_pace' | 'skill_preference' | 'time_of_day' | 'subject_affinity';
  description: string;
  strength: number; // 0-1
  insights: string[];
  recommendations: string[];
  firstObserved: Date;
  lastObserved: Date;
  frequency: number; // How often this pattern appears
}

export interface ProgressAnalytics {
  childId: string;
  timeRange: {
    start: Date;
    end: Date;
  };

  // Session analytics
  totalSessions: number;
  completedSessions: number;
  averageSessionDuration: number;
  totalLearningTime: number;

  // Skill progression
  skillProgressions: SkillMasteryUpdate[];
  masteredSkills: string[];
  strugglingAreas: string[];

  // Learning patterns
  identifiedPatterns: LearningPattern[];
  attentionTrends: AttentionMetrics[];

  // Engagement metrics
  overallEngagement: number; // 0-100
  subjectEngagement: Record<string, number>;
  timeBasedEngagement: Record<string, number>; // By hour of day

  // Recommendations
  adaptiveRecommendations: string[];
  nextLearningGoals: string[];
}

/**
 * Progress Tracking Service
 *
 * Aggregates learning data from multiple sources (voice, photo, sessions)
 * and provides comprehensive progress analytics and insights.
 * Now with SurrealDB persistence and cross-device synchronization.
 */
export class ProgressTrackingService {
  private logger: winston.Logger;
  private repository: ProgressRepository;
  private progressCache: Map<string, LearningSessionProgress> = new Map();
  private analyticsCache: Map<string, ProgressAnalytics> = new Map();

  constructor(repository: ProgressRepository, logger: winston.Logger) {
    this.repository = repository;
    this.logger = logger;
    this.logger.info('ProgressTrackingService initialized with database persistence');
  }

  /**
   * Create or update progress tracking for a learning session
   */
  async trackSessionProgress(
    session: LearningSession,
    voiceData?: VoiceInteractionData[],
    photoAssessments?: PhotoAssessmentResult[]
  ): Promise<LearningSessionProgress> {
    try {
      const sessionId = session.sessionId;
      const existingProgress = this.progressCache.get(sessionId);

      // Calculate attention metrics from session data
      const attentionMetrics = this.calculateAttentionMetrics(session);

      // Create or update progress record
      const progress: LearningSessionProgress = {
        sessionId,
        childId: session.childId,
        subject: session.subject,
        topic: session.topic || '',
        startTime: session.startedAt || session.createdAt,
        endTime: session.completedAt,
        state: session.state,

        attentionMetrics,
        voiceInteractions: voiceData || existingProgress?.voiceInteractions || [],
        photoAssessments: photoAssessments || existingProgress?.photoAssessments || [],
        objectivesProgress: session.learningObjectives,

        overallProgress: this.calculateOverallProgress(session),
        skillMasteryUpdates: await this.generateSkillMasteryUpdates(session, voiceData, photoAssessments),
        learningPatterns: this.identifyLearningPatterns(session, attentionMetrics),
        recommendations: this.generateRecommendations(session, attentionMetrics),

        createdAt: existingProgress?.createdAt || new Date(),
        updatedAt: new Date()
      };

      // Cache the progress
      this.progressCache.set(sessionId, progress);

      // Persist to database
      try {
        const existing = await this.repository.getSessionProgress(sessionId);
        if (existing) {
          await this.repository.updateSessionProgress(progress);
        } else {
          await this.repository.saveSessionProgress(progress);
        }

        // Save skill mastery updates
        if (progress.skillMasteryUpdates.length > 0) {
          await this.repository.saveSkillMasteryUpdates(session.childId, progress.skillMasteryUpdates);
        }

      } catch (dbError) {
        this.logger.warn('Failed to persist session progress to database', {
          sessionId,
          error: dbError instanceof Error ? dbError.message : dbError
        });
        // Continue with cached data even if database save fails
      }

      this.logger.info('Session progress tracked', {
        sessionId,
        childId: session.childId,
        subject: session.subject,
        overallProgress: progress.overallProgress,
        skillUpdates: progress.skillMasteryUpdates.length
      });

      return progress;

    } catch (error) {
      this.logger.error('Failed to track session progress', {
        error: error instanceof Error ? error.message : error,
        sessionId: session.sessionId
      });
      throw new Error(`Progress tracking failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add voice interaction data to session progress
   */
  async addVoiceInteractionData(sessionId: string, voiceData: VoiceInteractionData): Promise<void> {
    try {
      const progress = this.progressCache.get(sessionId);
      if (!progress) {
        this.logger.warn('No progress record found for voice interaction', { sessionId });
        return;
      }

      progress.voiceInteractions.push(voiceData);
      progress.updatedAt = new Date();

      // Update skill mastery based on voice interaction
      const skillUpdates = await this.analyzeVoiceSkillDemonstration(voiceData);
      progress.skillMasteryUpdates.push(...skillUpdates);

      this.logger.debug('Voice interaction data added to progress', {
        sessionId,
        interactionCount: voiceData.interactionCount,
        skillsUpdated: skillUpdates.length
      });

    } catch (error) {
      this.logger.error('Failed to add voice interaction data', {
        error: error instanceof Error ? error.message : error,
        sessionId
      });
    }
  }

  /**
   * Add photo assessment result to session progress
   */
  async addPhotoAssessmentResult(sessionId: string, assessment: PhotoAssessmentResult): Promise<void> {
    try {
      const progress = this.progressCache.get(sessionId);
      if (!progress) {
        this.logger.warn('No progress record found for photo assessment', { sessionId });
        return;
      }

      progress.photoAssessments.push(assessment);
      progress.updatedAt = new Date();

      // Update skill mastery based on photo assessment
      const skillUpdates = await this.analyzePhotoSkillDemonstration(assessment);
      progress.skillMasteryUpdates.push(...skillUpdates);

      // Recalculate overall progress
      progress.overallProgress = this.recalculateProgressWithAssessments(progress);

      this.logger.debug('Photo assessment data added to progress', {
        sessionId,
        subject: assessment.subject,
        correctnessScore: assessment.correctnessScore,
        skillsUpdated: skillUpdates.length
      });

    } catch (error) {
      this.logger.error('Failed to add photo assessment data', {
        error: error instanceof Error ? error.message : error,
        sessionId
      });
    }
  }

  /**
   * Generate comprehensive progress analytics for a child
   */
  async generateProgressAnalytics(
    childId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<ProgressAnalytics> {
    try {
      const cacheKey = `${childId}-${timeRange.start.getTime()}-${timeRange.end.getTime()}`;
      const cached = this.analyticsCache.get(cacheKey);

      if (cached && this.isCacheValid(cached, timeRange)) {
        return cached;
      }

      // Get all session progress records for child in time range
      const sessionProgresses = Array.from(this.progressCache.values())
        .filter(progress =>
          progress.childId === childId &&
          progress.startTime >= timeRange.start &&
          progress.startTime <= timeRange.end
        );

      if (sessionProgresses.length === 0) {
        return this.createEmptyAnalytics(childId, timeRange);
      }

      // Calculate session analytics
      const totalSessions = sessionProgresses.length;
      const completedSessions = sessionProgresses.filter(p => p.state === 'completed').length;
      const totalLearningTime = sessionProgresses.reduce((sum, p) =>
        sum + p.attentionMetrics.effectiveLearningTime, 0);
      const averageSessionDuration = totalLearningTime / Math.max(totalSessions, 1);

      // Aggregate skill progressions
      const allSkillUpdates = sessionProgresses.flatMap(p => p.skillMasteryUpdates);
      const skillProgressions = this.consolidateSkillProgressions(allSkillUpdates);

      // Identify learning patterns
      const identifiedPatterns = await this.analyzeOverallLearningPatterns(sessionProgresses);

      // Calculate engagement metrics
      const overallEngagement = this.calculateOverallEngagement(sessionProgresses);
      const subjectEngagement = this.calculateSubjectEngagement(sessionProgresses);
      const timeBasedEngagement = this.calculateTimeBasedEngagement(sessionProgresses);

      // Generate adaptive recommendations
      const adaptiveRecommendations = this.generateAdaptiveRecommendations(
        sessionProgresses,
        identifiedPatterns
      );

      const analytics: ProgressAnalytics = {
        childId,
        timeRange,
        totalSessions,
        completedSessions,
        averageSessionDuration,
        totalLearningTime,
        skillProgressions,
        masteredSkills: skillProgressions.filter(s => s.newLevel >= 8).map(s => s.skillName),
        strugglingAreas: this.identifyStrugglingAreas(skillProgressions),
        identifiedPatterns,
        attentionTrends: sessionProgresses.map(p => p.attentionMetrics),
        overallEngagement,
        subjectEngagement,
        timeBasedEngagement,
        adaptiveRecommendations,
        nextLearningGoals: this.generateNextLearningGoals(skillProgressions, identifiedPatterns)
      };

      this.analyticsCache.set(cacheKey, analytics);

      this.logger.info('Progress analytics generated', {
        childId,
        sessionsAnalyzed: totalSessions,
        patternsIdentified: identifiedPatterns.length,
        skillProgressions: skillProgressions.length
      });

      return analytics;

    } catch (error) {
      this.logger.error('Failed to generate progress analytics', {
        error: error instanceof Error ? error.message : error,
        childId
      });
      throw new Error(`Analytics generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get session progress by ID
   */
  async getSessionProgress(sessionId: string): Promise<LearningSessionProgress | undefined> {
    // Check cache first
    const cached = this.progressCache.get(sessionId);
    if (cached) {
      return cached;
    }

    // Check database
    try {
      const fromDb = await this.repository.getSessionProgress(sessionId);
      if (fromDb) {
        // Cache the result
        this.progressCache.set(sessionId, fromDb);
        return fromDb;
      }
    } catch (error) {
      this.logger.warn('Failed to get session progress from database', {
        sessionId,
        error: error instanceof Error ? error.message : error
      });
    }

    return undefined;
  }

  /**
   * Get all session progress records for a child
   */
  async getChildSessionProgresses(childId: string, limit: number = 50): Promise<LearningSessionProgress[]> {
    try {
      // Get from database first (primary source of truth)
      const fromDb = await this.repository.getChildSessionProgresses(childId, limit);

      // Cache the results
      fromDb.forEach(progress => {
        this.progressCache.set(progress.sessionId, progress);
      });

      return fromDb;

    } catch (error) {
      this.logger.warn('Failed to get child session progresses from database, falling back to cache', {
        childId,
        error: error instanceof Error ? error.message : error
      });

      // Fallback to cache
      return Array.from(this.progressCache.values())
        .filter(progress => progress.childId === childId)
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
        .slice(0, limit);
    }
  }

  /**
   * Private helper methods
   */

  private calculateAttentionMetrics(session: LearningSession): AttentionMetrics {
    const totalDuration = session.statistics.totalDuration || 0;
    const activeDuration = session.statistics.activeDuration || 0;
    const breakDuration = session.statistics.breakDuration || 0;

    // Calculate focus level based on active vs total time ratio
    const focusLevel = activeDuration > 0 ? Math.min((activeDuration / Math.max(totalDuration, 1)) * 100, 100) : 0;

    // Estimate distraction events from break frequency and interaction patterns
    const targetInteractions = activeDuration / (60 * 1000) * 2; // 2 per minute expected
    const interactionRatio = session.statistics.interactionCount / Math.max(targetInteractions, 1);
    const distractionEvents = Math.max(0, Math.round((1 - interactionRatio) * 10));

    // Break frequency (breaks per hour)
    const breakFrequency = activeDuration > 0 ? (session.breakReminders.length / (activeDuration / (60 * 60 * 1000))) : 0;

    return {
      focusLevel: Math.round(focusLevel),
      distractionEvents,
      sessionDuration: totalDuration,
      effectiveLearningTime: activeDuration,
      breakFrequency: Math.round(breakFrequency * 100) / 100,
      engagementScore: session.statistics.engagementScore || 0
    };
  }

  private calculateOverallProgress(session: LearningSession): number {
    const completionRate = session.statistics.completionRate || 0;
    const engagementScore = (session.statistics.engagementScore || 0) / 100;

    // Weight completion more heavily than engagement
    return Math.round((completionRate * 0.7 + engagementScore * 0.3) * 100) / 100;
  }

  private async generateSkillMasteryUpdates(
    session: LearningSession,
    voiceData?: VoiceInteractionData[],
    photoAssessments?: PhotoAssessmentResult[]
  ): Promise<SkillMasteryUpdate[]> {
    const updates: SkillMasteryUpdate[] = [];

    // From completed learning objectives
    session.learningObjectives
      .filter(obj => obj.completed)
      .forEach(obj => {
        updates.push({
          skillId: `${obj.subject}-${obj.topic}`,
          skillName: obj.topic || obj.description,
          previousLevel: Math.max(0, obj.targetLevel - 1),
          newLevel: Math.min(10, obj.targetLevel + Math.round(obj.successRate * 2)),
          evidenceSource: 'objective_completion',
          confidence: obj.successRate,
          timestamp: obj.completedAt || new Date()
        });
      });

    // From voice interactions
    if (voiceData) {
      voiceData.forEach(voice => {
        voice.skillsDemonstrated.forEach(skill => {
          updates.push({
            skillId: `voice-${skill}`,
            skillName: skill,
            previousLevel: 5, // Default baseline
            newLevel: Math.min(10, 5 + Math.round(voice.confidenceLevel * 3)),
            evidenceSource: 'voice',
            confidence: voice.confidenceLevel,
            timestamp: new Date()
          });
        });
      });
    }

    // From photo assessments
    if (photoAssessments) {
      photoAssessments.forEach(assessment => {
        assessment.skillsAssessed.forEach(skill => {
          updates.push({
            skillId: `${assessment.subject}-${skill}`,
            skillName: skill,
            previousLevel: 5, // Default baseline
            newLevel: Math.min(10, Math.round(assessment.correctnessScore * 10)),
            evidenceSource: 'photo',
            confidence: assessment.correctnessScore,
            timestamp: assessment.timestamp
          });
        });
      });
    }

    return updates;
  }

  private identifyLearningPatterns(session: LearningSession, attention: AttentionMetrics): string[] {
    const patterns: string[] = [];

    // Attention span patterns
    if (attention.focusLevel > 80) {
      patterns.push('high_focus_learner');
    } else if (attention.focusLevel < 50) {
      patterns.push('needs_attention_support');
    }

    // Break patterns
    if (attention.breakFrequency > 3) {
      patterns.push('frequent_break_taker');
    } else if (attention.breakFrequency < 1) {
      patterns.push('sustained_learner');
    }

    // Engagement patterns
    if (attention.engagementScore > 85) {
      patterns.push('highly_engaged');
    } else if (attention.engagementScore < 60) {
      patterns.push('engagement_challenges');
    }

    // Time-based patterns (based on session start time)
    const hour = session.startedAt?.getHours() || 12;
    if (hour >= 6 && hour < 10) {
      patterns.push('morning_learner');
    } else if (hour >= 14 && hour < 18) {
      patterns.push('afternoon_learner');
    } else if (hour >= 18 && hour < 22) {
      patterns.push('evening_learner');
    }

    return patterns;
  }

  private generateRecommendations(session: LearningSession, attention: AttentionMetrics): string[] {
    const recommendations: string[] = [];

    // Focus-based recommendations
    if (attention.focusLevel < 60) {
      recommendations.push('Consider shorter learning sessions with more frequent breaks');
      recommendations.push('Try using interactive activities to maintain engagement');
    }

    // Break pattern recommendations
    if (attention.breakFrequency > 4) {
      recommendations.push('Current break pattern works well - maintain regular short breaks');
    } else if (attention.breakFrequency < 1) {
      recommendations.push('Consider adding scheduled breaks to prevent fatigue');
    }

    // Objective completion recommendations
    const completionRate = session.statistics.completionRate || 0;
    if (completionRate < 0.5) {
      recommendations.push('Break down learning objectives into smaller, achievable steps');
    } else if (completionRate > 0.9) {
      recommendations.push('Consider more challenging learning objectives');
    }

    // Engagement recommendations
    if (attention.engagementScore < 70) {
      recommendations.push('Incorporate more voice interaction and hands-on activities');
      recommendations.push('Adjust content difficulty to match learning pace');
    }

    return recommendations;
  }

  private async analyzeVoiceSkillDemonstration(voiceData: VoiceInteractionData): Promise<SkillMasteryUpdate[]> {
    return voiceData.skillsDemonstrated.map(skill => ({
      skillId: `voice-${skill}`,
      skillName: skill,
      previousLevel: 5,
      newLevel: Math.min(10, 5 + Math.round(voiceData.confidenceLevel * 4)),
      evidenceSource: 'voice' as const,
      confidence: voiceData.confidenceLevel,
      timestamp: new Date()
    }));
  }

  private async analyzePhotoSkillDemonstration(assessment: PhotoAssessmentResult): Promise<SkillMasteryUpdate[]> {
    return assessment.skillsAssessed.map(skill => ({
      skillId: `${assessment.subject}-${skill}`,
      skillName: skill,
      previousLevel: 5,
      newLevel: Math.min(10, Math.round(assessment.correctnessScore * 10)),
      evidenceSource: 'photo' as const,
      confidence: assessment.correctnessScore,
      timestamp: assessment.timestamp
    }));
  }

  private recalculateProgressWithAssessments(progress: LearningSessionProgress): number {
    const baseProgress = progress.objectivesProgress.filter(obj => obj.completed).length /
                        Math.max(progress.objectivesProgress.length, 1);

    const assessmentScore = progress.photoAssessments.length > 0 ?
      progress.photoAssessments.reduce((sum, a) => sum + a.correctnessScore, 0) / progress.photoAssessments.length :
      0;

    return Math.round((baseProgress * 0.6 + assessmentScore * 0.4) * 100) / 100;
  }

  private createEmptyAnalytics(childId: string, timeRange: { start: Date; end: Date }): ProgressAnalytics {
    return {
      childId,
      timeRange,
      totalSessions: 0,
      completedSessions: 0,
      averageSessionDuration: 0,
      totalLearningTime: 0,
      skillProgressions: [],
      masteredSkills: [],
      strugglingAreas: [],
      identifiedPatterns: [],
      attentionTrends: [],
      overallEngagement: 0,
      subjectEngagement: {},
      timeBasedEngagement: {},
      adaptiveRecommendations: ['Start with short learning sessions to establish routine'],
      nextLearningGoals: ['Complete first learning assessment']
    };
  }

  private consolidateSkillProgressions(updates: SkillMasteryUpdate[]): SkillMasteryUpdate[] {
    const skillMap = new Map<string, SkillMasteryUpdate>();

    updates.forEach(update => {
      const existing = skillMap.get(update.skillId);
      if (!existing || update.timestamp > existing.timestamp) {
        skillMap.set(update.skillId, update);
      }
    });

    return Array.from(skillMap.values());
  }

  private async analyzeOverallLearningPatterns(progresses: LearningSessionProgress[]): Promise<LearningPattern[]> {
    const patterns: LearningPattern[] = [];

    if (progresses.length === 0) return patterns;

    // Analyze attention span patterns
    const avgFocusLevel = progresses.reduce((sum, p) => sum + p.attentionMetrics.focusLevel, 0) / progresses.length;
    if (avgFocusLevel > 80) {
      patterns.push({
        patternType: 'attention_span',
        description: 'Demonstrates excellent sustained attention during learning sessions',
        strength: avgFocusLevel / 100,
        insights: ['Can handle longer learning sessions', 'Rarely gets distracted'],
        recommendations: ['Increase session complexity', 'Add challenging objectives'],
        firstObserved: progresses[progresses.length - 1].startTime,
        lastObserved: progresses[0].startTime,
        frequency: progresses.length
      });
    }

    // Analyze learning pace patterns
    const avgProgress = progresses.reduce((sum, p) => sum + p.overallProgress, 0) / progresses.length;
    if (avgProgress > 0.8) {
      patterns.push({
        patternType: 'learning_pace',
        description: 'Learns quickly and completes objectives efficiently',
        strength: avgProgress,
        insights: ['Fast learner', 'High completion rates'],
        recommendations: ['Provide advanced materials', 'Introduce new topics regularly'],
        firstObserved: progresses[progresses.length - 1].startTime,
        lastObserved: progresses[0].startTime,
        frequency: progresses.length
      });
    }

    return patterns;
  }

  private calculateOverallEngagement(progresses: LearningSessionProgress[]): number {
    if (progresses.length === 0) return 0;

    return Math.round(
      progresses.reduce((sum, p) => sum + p.attentionMetrics.engagementScore, 0) / progresses.length
    );
  }

  private calculateSubjectEngagement(progresses: LearningSessionProgress[]): Record<string, number> {
    const subjectScores: Record<string, number[]> = {};

    progresses.forEach(progress => {
      if (!subjectScores[progress.subject]) {
        subjectScores[progress.subject] = [];
      }
      subjectScores[progress.subject].push(progress.attentionMetrics.engagementScore);
    });

    const result: Record<string, number> = {};
    Object.entries(subjectScores).forEach(([subject, scores]) => {
      result[subject] = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    });

    return result;
  }

  private calculateTimeBasedEngagement(progresses: LearningSessionProgress[]): Record<string, number> {
    const hourlyScores: Record<string, number[]> = {};

    progresses.forEach(progress => {
      const hour = progress.startTime.getHours();
      const timeSlot = `${hour}:00`;
      if (!hourlyScores[timeSlot]) {
        hourlyScores[timeSlot] = [];
      }
      hourlyScores[timeSlot].push(progress.attentionMetrics.engagementScore);
    });

    const result: Record<string, number> = {};
    Object.entries(hourlyScores).forEach(([time, scores]) => {
      result[time] = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    });

    return result;
  }

  private identifyStrugglingAreas(skillProgressions: SkillMasteryUpdate[]): string[] {
    return skillProgressions
      .filter(skill => skill.newLevel < 5 || skill.confidence < 0.6)
      .map(skill => skill.skillName);
  }

  private generateAdaptiveRecommendations(
    progresses: LearningSessionProgress[],
    patterns: LearningPattern[]
  ): string[] {
    const recommendations: string[] = [];

    if (progresses.length === 0) {
      return ['Begin with short, engaging learning sessions to establish routine'];
    }

    // Pattern-based recommendations
    patterns.forEach(pattern => {
      recommendations.push(...pattern.recommendations);
    });

    // Progress-based recommendations
    const avgProgress = progresses.reduce((sum, p) => sum + p.overallProgress, 0) / progresses.length;
    if (avgProgress < 0.6) {
      recommendations.push('Focus on building confidence with achievable goals');
      recommendations.push('Increase use of interactive and visual learning methods');
    } else if (avgProgress > 0.85) {
      recommendations.push('Introduce more advanced topics and challenges');
      recommendations.push('Consider accelerated learning paths');
    }

    // Engagement-based recommendations
    const avgEngagement = this.calculateOverallEngagement(progresses);
    if (avgEngagement < 70) {
      recommendations.push('Incorporate more hands-on activities and voice interaction');
      recommendations.push('Adjust session length based on attention patterns');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private generateNextLearningGoals(
    skillProgressions: SkillMasteryUpdate[],
    patterns: LearningPattern[]
  ): string[] {
    const goals: string[] = [];

    if (skillProgressions.length === 0) {
      return ['Complete initial skill assessment', 'Establish regular learning routine'];
    }

    // Skill-based goals
    const strugglingSkills = skillProgressions.filter(s => s.newLevel < 6);
    if (strugglingSkills.length > 0) {
      goals.push(`Improve proficiency in ${strugglingSkills[0].skillName}`);
    }

    const advancedSkills = skillProgressions.filter(s => s.newLevel >= 8);
    if (advancedSkills.length > 0) {
      goals.push(`Explore advanced concepts in ${advancedSkills[0].skillName}`);
    }

    // Pattern-based goals
    const highFocusPattern = patterns.find(p => p.patternType === 'attention_span' && p.strength > 0.8);
    if (highFocusPattern) {
      goals.push('Take on longer, more complex learning projects');
    }

    const fastLearnerPattern = patterns.find(p => p.patternType === 'learning_pace' && p.strength > 0.8);
    if (fastLearnerPattern) {
      goals.push('Explore new subject areas and interdisciplinary topics');
    }

    return goals.slice(0, 3); // Return top 3 goals
  }

  private isCacheValid(analytics: ProgressAnalytics, timeRange: { start: Date; end: Date }): boolean {
    // Cache is valid if it's for the same time range and was generated recently
    const cacheAge = Date.now() - analytics.timeRange.end.getTime();
    return cacheAge < 5 * 60 * 1000; // 5 minutes
  }
}

/**
 * Factory function to create ProgressTrackingService
 */
export function createProgressTrackingService(repository: ProgressRepository, logger: winston.Logger): ProgressTrackingService {
  return new ProgressTrackingService(repository, logger);
}
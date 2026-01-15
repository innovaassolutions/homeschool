import winston from 'winston';
import { DatabaseService } from './database';
import { LearningSessionProgress, ProgressAnalytics, SkillMasteryUpdate, LearningPattern } from './progressTracking';

/**
 * SurrealDB repository for progress tracking data
 *
 * Implements the data storage layer as defined in Story 4.1 specifications
 */
export class ProgressRepository {
  private logger: winston.Logger;
  private db: DatabaseService;

  constructor(db: DatabaseService, logger: winston.Logger) {
    this.db = db;
    this.logger = logger;
    this.logger.info('ProgressRepository initialized');
  }

  /**
   * Initialize database schema for progress tracking
   */
  async initializeSchema(): Promise<void> {
    try {
      // Learning sessions table with real-time capabilities
      await this.db.query(`
        DEFINE TABLE learning_sessions SCHEMAFULL;
        DEFINE FIELD child_id ON learning_sessions TYPE record<child_profiles>;
        DEFINE FIELD subject ON learning_sessions TYPE string;
        DEFINE FIELD topic ON learning_sessions TYPE string;
        DEFINE FIELD duration_minutes ON learning_sessions TYPE int;
        DEFINE FIELD attention_metrics ON learning_sessions TYPE object;
        DEFINE FIELD voice_interactions ON learning_sessions TYPE array<object>;
        DEFINE FIELD completed_activities ON learning_sessions TYPE array<string>;
        DEFINE FIELD struggle_points ON learning_sessions TYPE array<object>;
        DEFINE FIELD session_state ON learning_sessions TYPE string;
        DEFINE FIELD start_time ON learning_sessions TYPE datetime;
        DEFINE FIELD end_time ON learning_sessions TYPE datetime;
        DEFINE FIELD created_at ON learning_sessions TYPE datetime DEFAULT time::now();
        DEFINE FIELD updated_at ON learning_sessions TYPE datetime DEFAULT time::now();
      `);

      // Progress tracking for individual skills
      await this.db.query(`
        DEFINE TABLE skill_mastery SCHEMAFULL;
        DEFINE FIELD child_id ON skill_mastery TYPE record<child_profiles>;
        DEFINE FIELD skill_id ON skill_mastery TYPE string;
        DEFINE FIELD skill_name ON skill_mastery TYPE string;
        DEFINE FIELD mastery_level ON skill_mastery TYPE string DEFAULT 'not_started';
        DEFINE FIELD practice_count ON skill_mastery TYPE int DEFAULT 0;
        DEFINE FIELD success_rate ON skill_mastery TYPE float DEFAULT 0.0;
        DEFINE FIELD skill_embedding ON skill_mastery TYPE array<float>;
        DEFINE FIELD evidence_source ON skill_mastery TYPE string;
        DEFINE FIELD confidence ON skill_mastery TYPE float;
        DEFINE FIELD previous_level ON skill_mastery TYPE int DEFAULT 0;
        DEFINE FIELD current_level ON skill_mastery TYPE int DEFAULT 0;
        DEFINE FIELD last_updated ON skill_mastery TYPE datetime DEFAULT time::now();
      `);

      // Graph relationships for skill dependencies
      await this.db.query(`
        DEFINE TABLE requires SCHEMAFULL;
        DEFINE FIELD dependency_strength ON requires TYPE float DEFAULT 1.0;
        DEFINE FIELD skill_type ON requires TYPE string;
      `);

      // Learning patterns tracking
      await this.db.query(`
        DEFINE TABLE learning_patterns SCHEMAFULL;
        DEFINE FIELD child_id ON learning_patterns TYPE record<child_profiles>;
        DEFINE FIELD pattern_type ON learning_patterns TYPE string;
        DEFINE FIELD description ON learning_patterns TYPE string;
        DEFINE FIELD strength ON learning_patterns TYPE float;
        DEFINE FIELD insights ON learning_patterns TYPE array<string>;
        DEFINE FIELD recommendations ON learning_patterns TYPE array<string>;
        DEFINE FIELD first_observed ON learning_patterns TYPE datetime;
        DEFINE FIELD last_observed ON learning_patterns TYPE datetime;
        DEFINE FIELD frequency ON learning_patterns TYPE int DEFAULT 1;
      `);

      // Session progress aggregation table
      await this.db.query(`
        DEFINE TABLE session_progress SCHEMAFULL;
        DEFINE FIELD session_id ON session_progress TYPE string;
        DEFINE FIELD child_id ON session_progress TYPE record<child_profiles>;
        DEFINE FIELD subject ON session_progress TYPE string;
        DEFINE FIELD topic ON session_progress TYPE string;
        DEFINE FIELD start_time ON session_progress TYPE datetime;
        DEFINE FIELD end_time ON session_progress TYPE datetime;
        DEFINE FIELD session_state ON session_progress TYPE string;
        DEFINE FIELD attention_metrics ON session_progress TYPE object;
        DEFINE FIELD voice_interactions ON session_progress TYPE array<object>;
        DEFINE FIELD photo_assessments ON session_progress TYPE array<object>;
        DEFINE FIELD objectives_progress ON session_progress TYPE array<object>;
        DEFINE FIELD overall_progress ON session_progress TYPE float;
        DEFINE FIELD skill_mastery_updates ON session_progress TYPE array<object>;
        DEFINE FIELD learning_patterns ON session_progress TYPE array<string>;
        DEFINE FIELD recommendations ON session_progress TYPE array<string>;
        DEFINE FIELD created_at ON session_progress TYPE datetime DEFAULT time::now();
        DEFINE FIELD updated_at ON session_progress TYPE datetime DEFAULT time::now();
      `);

      // Indexes for performance
      await this.db.query(`
        DEFINE INDEX child_sessions ON learning_sessions FIELDS child_id;
        DEFINE INDEX session_dates ON learning_sessions FIELDS start_time, end_time;
        DEFINE INDEX child_skills ON skill_mastery FIELDS child_id, skill_id;
        DEFINE INDEX child_patterns ON learning_patterns FIELDS child_id, pattern_type;
        DEFINE INDEX session_progress_child ON session_progress FIELDS child_id, start_time;
      `);

      this.logger.info('Progress tracking database schema initialized');

    } catch (error) {
      this.logger.error('Failed to initialize progress tracking schema', {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Save session progress data
   */
  async saveSessionProgress(progress: LearningSessionProgress): Promise<void> {
    try {
      const query = `
        CREATE session_progress CONTENT {
          session_id: $session_id,
          child_id: type::record('child_profiles', $child_id),
          subject: $subject,
          topic: $topic,
          start_time: $start_time,
          end_time: $end_time,
          session_state: $session_state,
          attention_metrics: $attention_metrics,
          voice_interactions: $voice_interactions,
          photo_assessments: $photo_assessments,
          objectives_progress: $objectives_progress,
          overall_progress: $overall_progress,
          skill_mastery_updates: $skill_mastery_updates,
          learning_patterns: $learning_patterns,
          recommendations: $recommendations,
          created_at: $created_at,
          updated_at: $updated_at
        };
      `;

      await this.db.query(query, {
        session_id: progress.sessionId,
        child_id: progress.childId,
        subject: progress.subject,
        topic: progress.topic,
        start_time: progress.startTime.toISOString(),
        end_time: progress.endTime?.toISOString(),
        session_state: progress.state,
        attention_metrics: progress.attentionMetrics,
        voice_interactions: progress.voiceInteractions,
        photo_assessments: progress.photoAssessments,
        objectives_progress: progress.objectivesProgress,
        overall_progress: progress.overallProgress,
        skill_mastery_updates: progress.skillMasteryUpdates,
        learning_patterns: progress.learningPatterns,
        recommendations: progress.recommendations,
        created_at: progress.createdAt.toISOString(),
        updated_at: progress.updatedAt.toISOString()
      });

      this.logger.debug('Session progress saved to database', {
        sessionId: progress.sessionId,
        childId: progress.childId
      });

    } catch (error) {
      this.logger.error('Failed to save session progress', {
        error: error instanceof Error ? error.message : error,
        sessionId: progress.sessionId
      });
      throw error;
    }
  }

  /**
   * Update existing session progress
   */
  async updateSessionProgress(progress: LearningSessionProgress): Promise<void> {
    try {
      const query = `
        UPDATE session_progress SET
          end_time = $end_time,
          session_state = $session_state,
          attention_metrics = $attention_metrics,
          voice_interactions = $voice_interactions,
          photo_assessments = $photo_assessments,
          objectives_progress = $objectives_progress,
          overall_progress = $overall_progress,
          skill_mastery_updates = $skill_mastery_updates,
          learning_patterns = $learning_patterns,
          recommendations = $recommendations,
          updated_at = $updated_at
        WHERE session_id = $session_id;
      `;

      await this.db.query(query, {
        session_id: progress.sessionId,
        end_time: progress.endTime?.toISOString(),
        session_state: progress.state,
        attention_metrics: progress.attentionMetrics,
        voice_interactions: progress.voiceInteractions,
        photo_assessments: progress.photoAssessments,
        objectives_progress: progress.objectivesProgress,
        overall_progress: progress.overallProgress,
        skill_mastery_updates: progress.skillMasteryUpdates,
        learning_patterns: progress.learningPatterns,
        recommendations: progress.recommendations,
        updated_at: progress.updatedAt.toISOString()
      });

      this.logger.debug('Session progress updated in database', {
        sessionId: progress.sessionId
      });

    } catch (error) {
      this.logger.error('Failed to update session progress', {
        error: error instanceof Error ? error.message : error,
        sessionId: progress.sessionId
      });
      throw error;
    }
  }

  /**
   * Get session progress by session ID
   */
  async getSessionProgress(sessionId: string): Promise<LearningSessionProgress | null> {
    try {
      const query = `
        SELECT * FROM session_progress WHERE session_id = $session_id;
      `;

      const results = await this.db.query<any>(query, { session_id: sessionId });

      if (results.length === 0) {
        return null;
      }

      return this.convertToSessionProgress(results[0]);

    } catch (error) {
      this.logger.error('Failed to get session progress', {
        error: error instanceof Error ? error.message : error,
        sessionId
      });
      throw error;
    }
  }

  /**
   * Get all session progress records for a child
   */
  async getChildSessionProgresses(
    childId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<LearningSessionProgress[]> {
    try {
      const query = `
        SELECT * FROM session_progress
        WHERE child_id = type::record('child_profiles', $child_id)
        ORDER BY start_time DESC
        LIMIT $limit
        START $offset;
      `;

      const results = await this.db.query<any>(query, {
        child_id: childId,
        limit,
        offset
      });

      return results.map(result => this.convertToSessionProgress(result));

    } catch (error) {
      this.logger.error('Failed to get child session progresses', {
        error: error instanceof Error ? error.message : error,
        childId
      });
      throw error;
    }
  }

  /**
   * Get session progress records within date range
   */
  async getSessionProgressByDateRange(
    childId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LearningSessionProgress[]> {
    try {
      const query = `
        SELECT * FROM session_progress
        WHERE child_id = type::record('child_profiles', $child_id)
        AND start_time >= $start_date
        AND start_time <= $end_date
        ORDER BY start_time DESC;
      `;

      const results = await this.db.query<any>(query, {
        child_id: childId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      });

      return results.map(result => this.convertToSessionProgress(result));

    } catch (error) {
      this.logger.error('Failed to get session progress by date range', {
        error: error instanceof Error ? error.message : error,
        childId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      throw error;
    }
  }

  /**
   * Save skill mastery updates
   */
  async saveSkillMasteryUpdates(childId: string, updates: SkillMasteryUpdate[]): Promise<void> {
    try {
      for (const update of updates) {
        const query = `
          CREATE skill_mastery CONTENT {
            child_id: type::record('child_profiles', $child_id),
            skill_id: $skill_id,
            skill_name: $skill_name,
            evidence_source: $evidence_source,
            confidence: $confidence,
            previous_level: $previous_level,
            current_level: $current_level,
            last_updated: $last_updated
          };
        `;

        await this.db.query(query, {
          child_id: childId,
          skill_id: update.skillId,
          skill_name: update.skillName,
          evidence_source: update.evidenceSource,
          confidence: update.confidence,
          previous_level: update.previousLevel,
          current_level: update.newLevel,
          last_updated: update.timestamp.toISOString()
        });
      }

      this.logger.debug('Skill mastery updates saved', {
        childId,
        updateCount: updates.length
      });

    } catch (error) {
      this.logger.error('Failed to save skill mastery updates', {
        error: error instanceof Error ? error.message : error,
        childId
      });
      throw error;
    }
  }

  /**
   * Get skill mastery data for a child
   */
  async getChildSkillMastery(childId: string, subject?: string): Promise<SkillMasteryUpdate[]> {
    try {
      let query = `
        SELECT * FROM skill_mastery
        WHERE child_id = type::record('child_profiles', $child_id)
      `;

      const params: any = { child_id: childId };

      if (subject) {
        query += ` AND skill_id CONTAINS $subject`;
        params.subject = subject;
      }

      query += ` ORDER BY last_updated DESC;`;

      const results = await this.db.query<any>(query, params);

      return results.map(result => ({
        skillId: result.skill_id,
        skillName: result.skill_name,
        previousLevel: result.previous_level,
        newLevel: result.current_level,
        evidenceSource: result.evidence_source,
        confidence: result.confidence,
        timestamp: new Date(result.last_updated)
      }));

    } catch (error) {
      this.logger.error('Failed to get child skill mastery', {
        error: error instanceof Error ? error.message : error,
        childId,
        subject
      });
      throw error;
    }
  }

  /**
   * Save learning patterns
   */
  async saveLearningPatterns(childId: string, patterns: LearningPattern[]): Promise<void> {
    try {
      for (const pattern of patterns) {
        const query = `
          CREATE learning_patterns CONTENT {
            child_id: type::record('child_profiles', $child_id),
            pattern_type: $pattern_type,
            description: $description,
            strength: $strength,
            insights: $insights,
            recommendations: $recommendations,
            first_observed: $first_observed,
            last_observed: $last_observed,
            frequency: $frequency
          };
        `;

        await this.db.query(query, {
          child_id: childId,
          pattern_type: pattern.patternType,
          description: pattern.description,
          strength: pattern.strength,
          insights: pattern.insights,
          recommendations: pattern.recommendations,
          first_observed: pattern.firstObserved.toISOString(),
          last_observed: pattern.lastObserved.toISOString(),
          frequency: pattern.frequency
        });
      }

      this.logger.debug('Learning patterns saved', {
        childId,
        patternCount: patterns.length
      });

    } catch (error) {
      this.logger.error('Failed to save learning patterns', {
        error: error instanceof Error ? error.message : error,
        childId
      });
      throw error;
    }
  }

  /**
   * Get learning patterns for a child
   */
  async getChildLearningPatterns(childId: string): Promise<LearningPattern[]> {
    try {
      const query = `
        SELECT * FROM learning_patterns
        WHERE child_id = type::record('child_profiles', $child_id)
        ORDER BY strength DESC, last_observed DESC;
      `;

      const results = await this.db.query<any>(query, { child_id: childId });

      return results.map(result => ({
        patternType: result.pattern_type,
        description: result.description,
        strength: result.strength,
        insights: result.insights,
        recommendations: result.recommendations,
        firstObserved: new Date(result.first_observed),
        lastObserved: new Date(result.last_observed),
        frequency: result.frequency
      }));

    } catch (error) {
      this.logger.error('Failed to get child learning patterns', {
        error: error instanceof Error ? error.message : error,
        childId
      });
      throw error;
    }
  }

  /**
   * Generate analytics aggregation using SurrealDB queries
   */
  async generateAnalyticsData(
    childId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalSessions: number;
    completedSessions: number;
    totalLearningTime: number;
    averageEngagement: number;
    subjectBreakdown: Record<string, number>;
  }> {
    try {
      // Get session statistics
      const sessionStatsQuery = `
        SELECT
          count() AS total_sessions,
          count(session_state = 'completed') AS completed_sessions,
          math::sum(attention_metrics.effectiveLearningTime) AS total_learning_time,
          math::avg(attention_metrics.engagementScore) AS average_engagement
        FROM session_progress
        WHERE child_id = type::record('child_profiles', $child_id)
        AND start_time >= $start_date
        AND start_time <= $end_date
        GROUP ALL;
      `;

      const subjectBreakdownQuery = `
        SELECT
          subject,
          count() AS session_count
        FROM session_progress
        WHERE child_id = type::record('child_profiles', $child_id)
        AND start_time >= $start_date
        AND start_time <= $end_date
        GROUP BY subject;
      `;

      const [sessionStats, subjectBreakdown] = await Promise.all([
        this.db.query<any>(sessionStatsQuery, {
          child_id: childId,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        }),
        this.db.query<any>(subjectBreakdownQuery, {
          child_id: childId,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        })
      ]);

      const stats = sessionStats[0] || {
        total_sessions: 0,
        completed_sessions: 0,
        total_learning_time: 0,
        average_engagement: 0
      };

      const breakdown: Record<string, number> = {};
      subjectBreakdown.forEach(item => {
        breakdown[item.subject] = item.session_count;
      });

      return {
        totalSessions: stats.total_sessions,
        completedSessions: stats.completed_sessions,
        totalLearningTime: stats.total_learning_time || 0,
        averageEngagement: stats.average_engagement || 0,
        subjectBreakdown: breakdown
      };

    } catch (error) {
      this.logger.error('Failed to generate analytics data', {
        error: error instanceof Error ? error.message : error,
        childId
      });
      throw error;
    }
  }

  /**
   * Delete old session progress data for cleanup
   */
  async cleanupOldData(beforeDate: Date): Promise<number> {
    try {
      const query = `
        DELETE session_progress WHERE start_time < $before_date;
      `;

      const result = await this.db.query<any>(query, {
        before_date: beforeDate.toISOString()
      });

      const deletedCount = Array.isArray(result) ? result.length : 0;

      this.logger.info('Old session progress data cleaned up', {
        deletedCount,
        beforeDate: beforeDate.toISOString()
      });

      return deletedCount;

    } catch (error) {
      this.logger.error('Failed to cleanup old data', {
        error: error instanceof Error ? error.message : error,
        beforeDate: beforeDate.toISOString()
      });
      throw error;
    }
  }

  /**
   * Private helper to convert database result to LearningSessionProgress
   */
  private convertToSessionProgress(dbResult: any): LearningSessionProgress {
    return {
      sessionId: dbResult.session_id,
      childId: dbResult.child_id.replace('child_profiles:', ''), // Remove record prefix
      subject: dbResult.subject,
      topic: dbResult.topic,
      startTime: new Date(dbResult.start_time),
      endTime: dbResult.end_time ? new Date(dbResult.end_time) : undefined,
      state: dbResult.session_state,
      attentionMetrics: dbResult.attention_metrics,
      voiceInteractions: dbResult.voice_interactions || [],
      photoAssessments: dbResult.photo_assessments || [],
      objectivesProgress: dbResult.objectives_progress || [],
      overallProgress: dbResult.overall_progress,
      skillMasteryUpdates: dbResult.skill_mastery_updates || [],
      learningPatterns: dbResult.learning_patterns || [],
      recommendations: dbResult.recommendations || [],
      createdAt: new Date(dbResult.created_at),
      updatedAt: new Date(dbResult.updated_at)
    };
  }
}

/**
 * Factory function to create ProgressRepository
 */
export function createProgressRepository(db: DatabaseService, logger: winston.Logger): ProgressRepository {
  return new ProgressRepository(db, logger);
}
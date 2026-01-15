import winston from 'winston';
import { AgeGroup, ConversationContext, ConversationMessage } from './chatgpt';
import { VoiceConversationSession } from './voiceConversationIntegration';

// Learning session types
export type SessionType = 'assessment' | 'lesson' | 'practice' | 'review';

// Session states for lifecycle management
export type SessionState = 'not_started' | 'active' | 'paused' | 'break' | 'completed' | 'abandoned';

// Learning objectives for session tracking
export interface LearningObjective {
  id: string;
  subject: string;
  topic: string;
  description: string;
  targetLevel: number; // 1-10 skill level
  completed: boolean;
  completedAt?: Date;
  attempts: number;
  successRate: number;
}

// Progress marker for tracking advancement through session
export interface ProgressMarker {
  id: string;
  timestamp: Date;
  description: string;
  objectiveId?: string; // Related learning objective
  metadata?: {
    interactionCount?: number;
    confidenceLevel?: number;
    skillDemonstrated?: string;
    needsReview?: boolean;
  };
}

// Session timing configuration based on age group
export interface SessionTimingConfig {
  recommendedDuration: number; // minutes
  maxDuration: number; // minutes
  breakInterval: number; // minutes
  breakDuration: number; // minutes
  warningBeforeBreak: number; // minutes
}

// Break reminder configuration
export interface BreakReminder {
  triggerTime: Date;
  reminderType: 'gentle' | 'suggested' | 'required';
  message: string;
  acknowledged: boolean;
  acknowledgedAt?: Date;
}

// Session statistics for analysis
export interface SessionStatistics {
  totalDuration: number; // milliseconds
  activeDuration: number; // milliseconds (excluding breaks)
  breakDuration: number; // milliseconds
  interactionCount: number;
  objectivesCompleted: number;
  objectivesAttempted: number;
  averageResponseTime: number;
  engagementScore: number; // 0-100
  completionRate: number; // 0-1
}

// Core learning session interface
export interface LearningSession {
  sessionId: string;
  childId: string;
  ageGroup: AgeGroup;
  sessionType: SessionType;
  state: SessionState;

  // Session metadata
  title: string;
  description?: string;
  subject: string;
  topic?: string;

  // Timing information
  createdAt: Date;
  startedAt?: Date;
  lastActivity: Date;
  completedAt?: Date;
  estimatedDuration?: number; // minutes
  timingConfig: SessionTimingConfig;

  // Learning content
  learningObjectives: LearningObjective[];
  progressMarkers: ProgressMarker[];
  conversationContext?: ConversationContext;
  voiceSessionId?: string; // Link to voice conversation session

  // Break and timing management
  breakReminders: BreakReminder[];
  currentBreakStart?: Date;
  totalBreakTime: number; // milliseconds

  // Session analytics
  statistics: SessionStatistics;

  // Settings and preferences
  settings: {
    voiceEnabled: boolean;
    ttsEnabled: boolean;
    breakRemindersEnabled: boolean;
    autoSave: boolean;
    autoResume: boolean;
  };

  // Metadata
  tags?: string[];
  notes?: string;
  parentNotes?: string;
}

// Session creation request
export interface CreateSessionRequest {
  childId: string;
  sessionType: SessionType;
  title: string;
  description?: string;
  subject: string;
  topic?: string;
  learningObjectives?: Partial<LearningObjective>[];
  estimatedDuration?: number;
  settings?: Partial<LearningSession['settings']>;
}

// Session update request
export interface UpdateSessionRequest {
  title?: string;
  description?: string;
  learningObjectives?: Partial<LearningObjective>[];
  settings?: Partial<LearningSession['settings']>;
  notes?: string;
  parentNotes?: string;
}

// Session search criteria
export interface SessionSearchCriteria {
  childId?: string;
  sessionType?: SessionType;
  state?: SessionState;
  subject?: string;
  topic?: string;
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  limit?: number;
  offset?: number;
}

// Age-appropriate timing configurations
const AGE_TIMING_CONFIGS: Record<AgeGroup, SessionTimingConfig> = {
  ages6to9: {
    recommendedDuration: 20,
    maxDuration: 30,
    breakInterval: 15,
    breakDuration: 5,
    warningBeforeBreak: 2
  },
  ages10to13: {
    recommendedDuration: 30,
    maxDuration: 45,
    breakInterval: 20,
    breakDuration: 5,
    warningBeforeBreak: 3
  },
  ages14to16: {
    recommendedDuration: 40,
    maxDuration: 60,
    breakInterval: 25,
    breakDuration: 10,
    warningBeforeBreak: 5
  }
};

/**
 * Learning Session Service
 *
 * Manages comprehensive learning session lifecycle including:
 * - Session creation, pause, resume, and completion
 * - Learning objective tracking and progress markers
 * - Age-appropriate timing and break management
 * - Integration with voice conversation system
 * - Session analytics and progress tracking
 */
export class LearningSessionService {
  private logger: winston.Logger;
  private activeSessions: Map<string, LearningSession> = new Map();
  private sessionTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(logger: winston.Logger) {
    this.logger = logger;

    this.logger.info('LearningSessionService initialized', {
      ageTimingConfigs: Object.keys(AGE_TIMING_CONFIGS).length
    });
  }

  /**
   * Create a new learning session
   */
  async createSession(request: CreateSessionRequest): Promise<LearningSession> {
    try {
      // Get age group from child profile (mock implementation)
      const ageGroup = await this.getChildAgeGroup(request.childId);
      const sessionId = this.generateSessionId();

      // Initialize learning objectives
      const learningObjectives: LearningObjective[] = (request.learningObjectives || []).map((obj, index) => ({
        id: `${sessionId}-obj-${index}`,
        subject: obj.subject || request.subject,
        topic: obj.topic || request.topic || '',
        description: obj.description || '',
        targetLevel: obj.targetLevel || 5,
        completed: false,
        attempts: 0,
        successRate: 0
      }));

      // Create session with defaults
      const session: LearningSession = {
        sessionId,
        childId: request.childId,
        ageGroup,
        sessionType: request.sessionType,
        state: 'not_started',

        title: request.title,
        description: request.description,
        subject: request.subject,
        topic: request.topic,

        createdAt: new Date(),
        lastActivity: new Date(),
        estimatedDuration: request.estimatedDuration,
        timingConfig: { ...AGE_TIMING_CONFIGS[ageGroup] },

        learningObjectives,
        progressMarkers: [],
        breakReminders: [],
        totalBreakTime: 0,

        statistics: {
          totalDuration: 0,
          activeDuration: 0,
          breakDuration: 0,
          interactionCount: 0,
          objectivesCompleted: 0,
          objectivesAttempted: 0,
          averageResponseTime: 0,
          engagementScore: 0,
          completionRate: 0
        },

        settings: {
          voiceEnabled: true,
          ttsEnabled: true,
          breakRemindersEnabled: true,
          autoSave: true,
          autoResume: true,
          ...request.settings
        }
      };

      this.activeSessions.set(sessionId, session);

      this.logger.info('Learning session created', {
        sessionId,
        childId: request.childId,
        sessionType: request.sessionType,
        subject: request.subject,
        objectiveCount: learningObjectives.length
      });

      return session;

    } catch (error) {
      this.logger.error('Failed to create learning session', {
        error: error instanceof Error ? error.message : error,
        childId: request.childId,
        sessionType: request.sessionType
      });
      throw new Error(`Session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start an existing session
   */
  async startSession(sessionId: string): Promise<LearningSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.state !== 'not_started') {
      throw new Error(`Cannot start session in state: ${session.state}`);
    }

    try {
      session.state = 'active';
      session.startedAt = new Date();
      session.lastActivity = new Date();

      // Set up break reminders
      this.scheduleBreakReminder(session);

      this.logger.info('Learning session started', {
        sessionId,
        childId: session.childId,
        sessionType: session.sessionType
      });

      return session;

    } catch (error) {
      this.logger.error('Failed to start learning session', {
        error: error instanceof Error ? error.message : error,
        sessionId
      });
      throw new Error(`Session start failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Pause an active session
   */
  async pauseSession(sessionId: string, reason?: string): Promise<LearningSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.state !== 'active') {
      throw new Error(`Cannot pause session in state: ${session.state}`);
    }

    try {
      session.state = 'paused';
      session.lastActivity = new Date();

      // Clear any active timers
      this.clearSessionTimers(sessionId);

      // Update statistics
      this.updateSessionStatistics(session);

      // Add progress marker for pause
      this.addProgressMarker(session, {
        description: `Session paused${reason ? ': ' + reason : ''}`,
        metadata: { needsReview: false }
      });

      this.logger.info('Learning session paused', {
        sessionId,
        reason,
        duration: session.statistics.activeDuration
      });

      return session;

    } catch (error) {
      this.logger.error('Failed to pause learning session', {
        error: error instanceof Error ? error.message : error,
        sessionId
      });
      throw new Error(`Session pause failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resume a paused session
   */
  async resumeSession(sessionId: string): Promise<LearningSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.state !== 'paused' && session.state !== 'break') {
      throw new Error(`Cannot resume session in state: ${session.state}`);
    }

    try {
      const wasOnBreak = session.state === 'break';

      session.state = 'active';
      session.lastActivity = new Date();

      // If resuming from break, update break statistics
      if (wasOnBreak && session.currentBreakStart) {
        const breakDuration = Date.now() - session.currentBreakStart.getTime();
        session.totalBreakTime += breakDuration;
        session.statistics.breakDuration += breakDuration;
        session.currentBreakStart = undefined;
      }

      // Reschedule break reminders
      this.scheduleBreakReminder(session);

      // Add progress marker for resume
      this.addProgressMarker(session, {
        description: `Session resumed${wasOnBreak ? ' from break' : ''}`,
        metadata: { needsReview: false }
      });

      this.logger.info('Learning session resumed', {
        sessionId,
        wasOnBreak,
        totalBreakTime: session.totalBreakTime
      });

      return session;

    } catch (error) {
      this.logger.error('Failed to resume learning session', {
        error: error instanceof Error ? error.message : error,
        sessionId
      });
      throw new Error(`Session resume failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start a break for an active session
   */
  async startBreak(sessionId: string, breakType: 'gentle' | 'suggested' | 'required' = 'suggested'): Promise<LearningSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.state !== 'active') {
      throw new Error(`Cannot start break for session in state: ${session.state}`);
    }

    try {
      session.state = 'break';
      session.currentBreakStart = new Date();
      session.lastActivity = new Date();

      // Clear active timers
      this.clearSessionTimers(sessionId);

      // Schedule break end reminder
      this.scheduleBreakEndReminder(session);

      // Add progress marker for break
      this.addProgressMarker(session, {
        description: `Break started (${breakType})`,
        metadata: { needsReview: false }
      });

      this.logger.info('Learning session break started', {
        sessionId,
        breakType,
        sessionDuration: session.statistics.activeDuration
      });

      return session;

    } catch (error) {
      this.logger.error('Failed to start break for learning session', {
        error: error instanceof Error ? error.message : error,
        sessionId
      });
      throw new Error(`Break start failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Complete a session
   */
  async completeSession(sessionId: string, completionNotes?: string): Promise<LearningSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.state === 'completed' || session.state === 'abandoned') {
      throw new Error(`Session already in final state: ${session.state}`);
    }

    try {
      session.state = 'completed';
      session.completedAt = new Date();
      session.lastActivity = new Date();

      // Clear all timers
      this.clearSessionTimers(sessionId);

      // Final statistics update
      this.updateSessionStatistics(session);

      // Calculate completion metrics
      session.statistics.completionRate = this.calculateCompletionRate(session);
      session.statistics.engagementScore = this.calculateEngagementScore(session);

      // Add completion notes if provided
      if (completionNotes) {
        session.notes = completionNotes;
      }

      // Add final progress marker
      this.addProgressMarker(session, {
        description: 'Session completed successfully',
        metadata: {
          interactionCount: session.statistics.interactionCount,
          skillDemonstrated: 'session_completion',
          needsReview: false
        }
      });

      this.logger.info('Learning session completed', {
        sessionId,
        duration: session.statistics.totalDuration,
        objectivesCompleted: session.statistics.objectivesCompleted,
        completionRate: session.statistics.completionRate,
        engagementScore: session.statistics.engagementScore
      });

      // Remove from active sessions (but keep in storage for history)
      this.activeSessions.delete(sessionId);

      return session;

    } catch (error) {
      this.logger.error('Failed to complete learning session', {
        error: error instanceof Error ? error.message : error,
        sessionId
      });
      throw new Error(`Session completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update learning objective progress
   */
  async updateObjectiveProgress(
    sessionId: string,
    objectiveId: string,
    progress: { completed?: boolean; attempts?: number; successRate?: number }
  ): Promise<LearningSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const objective = session.learningObjectives.find(obj => obj.id === objectiveId);
    if (!objective) {
      throw new Error(`Learning objective not found: ${objectiveId}`);
    }

    try {
      if (progress.completed !== undefined) {
        objective.completed = progress.completed;
        if (progress.completed) {
          objective.completedAt = new Date();
          session.statistics.objectivesCompleted++;
        }
      }

      if (progress.attempts !== undefined) {
        objective.attempts = progress.attempts;
        if (objective.attempts > 0) {
          session.statistics.objectivesAttempted = Math.max(
            session.statistics.objectivesAttempted,
            session.learningObjectives.filter(obj => obj.attempts > 0).length
          );
        }
      }

      if (progress.successRate !== undefined) {
        objective.successRate = progress.successRate;
      }

      session.lastActivity = new Date();

      // Add progress marker
      this.addProgressMarker(session, {
        description: `Objective updated: ${objective.topic || objective.description}`,
        objectiveId,
        metadata: {
          skillDemonstrated: objective.completed ? objective.topic : undefined,
          needsReview: progress.successRate !== undefined && progress.successRate < 0.7
        }
      });

      this.logger.debug('Learning objective progress updated', {
        sessionId,
        objectiveId,
        completed: objective.completed,
        attempts: objective.attempts,
        successRate: objective.successRate
      });

      return session;

    } catch (error) {
      this.logger.error('Failed to update learning objective progress', {
        error: error instanceof Error ? error.message : error,
        sessionId,
        objectiveId
      });
      throw new Error(`Objective update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add a progress marker to the session
   */
  addProgressMarker(session: LearningSession, marker: Omit<ProgressMarker, 'id' | 'timestamp'>): void {
    const progressMarker: ProgressMarker = {
      id: `${session.sessionId}-marker-${Date.now()}`,
      timestamp: new Date(),
      ...marker
    };

    session.progressMarkers.push(progressMarker);
    session.lastActivity = new Date();

    this.logger.debug('Progress marker added', {
      sessionId: session.sessionId,
      markerId: progressMarker.id,
      description: progressMarker.description
    });
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): LearningSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions for a child
   */
  getChildActiveSessions(childId: string): LearningSession[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.childId === childId);
  }

  /**
   * Search sessions by criteria
   */
  async searchSessions(criteria: SessionSearchCriteria): Promise<LearningSession[]> {
    let results = Array.from(this.activeSessions.values());

    if (criteria.childId) {
      results = results.filter(session => session.childId === criteria.childId);
    }

    if (criteria.sessionType) {
      results = results.filter(session => session.sessionType === criteria.sessionType);
    }

    if (criteria.state) {
      results = results.filter(session => session.state === criteria.state);
    }

    if (criteria.subject) {
      results = results.filter(session => session.subject === criteria.subject);
    }

    if (criteria.topic) {
      results = results.filter(session => session.topic === criteria.topic);
    }

    if (criteria.dateFrom) {
      results = results.filter(session => session.createdAt >= criteria.dateFrom!);
    }

    if (criteria.dateTo) {
      results = results.filter(session => session.createdAt <= criteria.dateTo!);
    }

    if (criteria.tags) {
      results = results.filter(session =>
        session.tags && criteria.tags!.some(tag => session.tags!.includes(tag))
      );
    }

    // Apply pagination
    const offset = criteria.offset || 0;
    const limit = criteria.limit || 50;
    return results.slice(offset, offset + limit);
  }

  /**
   * Link session with voice conversation
   */
  async linkVoiceSession(sessionId: string, voiceSessionId: string, conversationContext: ConversationContext): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.voiceSessionId = voiceSessionId;
    session.conversationContext = conversationContext;
    session.lastActivity = new Date();

    this.logger.debug('Voice session linked to learning session', {
      sessionId,
      voiceSessionId,
      subject: conversationContext.subject
    });
  }

  /**
   * Record voice interaction in session
   */
  async recordVoiceInteraction(sessionId: string, metadata: { responseTime?: number; confidence?: number }): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return; // Silently ignore if session not found
    }

    session.statistics.interactionCount++;
    session.lastActivity = new Date();

    if (metadata.responseTime) {
      session.statistics.averageResponseTime =
        (session.statistics.averageResponseTime * (session.statistics.interactionCount - 1) + metadata.responseTime) /
        session.statistics.interactionCount;
    }

    this.logger.debug('Voice interaction recorded', {
      sessionId,
      interactionCount: session.statistics.interactionCount,
      responseTime: metadata.responseTime,
      confidence: metadata.confidence
    });
  }

  /**
   * Private helper methods
   */

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getChildAgeGroup(childId: string): Promise<AgeGroup> {
    // TODO: Integrate with actual child profile service
    // For now, return a default based on childId pattern or mock data
    return 'ages10to13'; // Default age group
  }

  private scheduleBreakReminder(session: LearningSession): void {
    if (!session.settings.breakRemindersEnabled) {
      return;
    }

    const reminderTime = session.timingConfig.breakInterval * 60 * 1000; // Convert to milliseconds
    const warningTime = (session.timingConfig.breakInterval - session.timingConfig.warningBeforeBreak) * 60 * 1000;

    // Schedule warning reminder
    const warningTimer = setTimeout(() => {
      this.sendBreakWarning(session);
    }, warningTime);

    // Schedule break reminder
    const breakTimer = setTimeout(() => {
      this.sendBreakReminder(session);
    }, reminderTime);

    // Store timers for cleanup
    this.sessionTimers.set(`${session.sessionId}-warning`, warningTimer);
    this.sessionTimers.set(`${session.sessionId}-break`, breakTimer);
  }

  private scheduleBreakEndReminder(session: LearningSession): void {
    const breakEndTime = session.timingConfig.breakDuration * 60 * 1000;

    const timer = setTimeout(() => {
      this.sendBreakEndReminder(session);
    }, breakEndTime);

    this.sessionTimers.set(`${session.sessionId}-break-end`, timer);
  }

  private sendBreakWarning(session: LearningSession): void {
    if (session.state !== 'active') {
      return;
    }

    const reminder: BreakReminder = {
      triggerTime: new Date(),
      reminderType: 'gentle',
      message: this.getBreakWarningMessage(session.ageGroup),
      acknowledged: false
    };

    session.breakReminders.push(reminder);

    this.logger.info('Break warning sent', {
      sessionId: session.sessionId,
      ageGroup: session.ageGroup
    });
  }

  private sendBreakReminder(session: LearningSession): void {
    if (session.state !== 'active') {
      return;
    }

    const reminder: BreakReminder = {
      triggerTime: new Date(),
      reminderType: 'suggested',
      message: this.getBreakReminderMessage(session.ageGroup),
      acknowledged: false
    };

    session.breakReminders.push(reminder);

    this.logger.info('Break reminder sent', {
      sessionId: session.sessionId,
      ageGroup: session.ageGroup
    });
  }

  private sendBreakEndReminder(session: LearningSession): void {
    if (session.state !== 'break') {
      return;
    }

    const reminder: BreakReminder = {
      triggerTime: new Date(),
      reminderType: 'gentle',
      message: this.getBreakEndMessage(session.ageGroup),
      acknowledged: false
    };

    session.breakReminders.push(reminder);

    this.logger.info('Break end reminder sent', {
      sessionId: session.sessionId,
      ageGroup: session.ageGroup
    });
  }

  private getBreakWarningMessage(ageGroup: AgeGroup): string {
    const messages = {
      ages6to9: "We've been learning for a while! In a few minutes, it might be time for a little break.",
      ages10to13: "You've been working hard! A break is coming up soon to help you stay focused.",
      ages14to16: "Great progress! Consider taking a break in a few minutes to keep your mind fresh."
    };
    return messages[ageGroup];
  }

  private getBreakReminderMessage(ageGroup: AgeGroup): string {
    const messages = {
      ages6to9: "Time for a fun break! Let's pause our learning and do something active for a few minutes.",
      ages10to13: "Break time! Step away from your studies for a bit and give your brain a rest.",
      ages14to16: "It's time for a break. Taking regular breaks helps improve focus and retention."
    };
    return messages[ageGroup];
  }

  private getBreakEndMessage(ageGroup: AgeGroup): string {
    const messages = {
      ages6to9: "Break time is over! Ready to continue our fun learning adventure?",
      ages10to13: "Hope you enjoyed your break! Ready to get back to learning?",
      ages14to16: "Break's over! Time to get back to your studies with renewed focus."
    };
    return messages[ageGroup];
  }

  private clearSessionTimers(sessionId: string): void {
    const timerKeys = Array.from(this.sessionTimers.keys()).filter(key => key.startsWith(sessionId));

    timerKeys.forEach(key => {
      const timer = this.sessionTimers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.sessionTimers.delete(key);
      }
    });
  }

  private updateSessionStatistics(session: LearningSession): void {
    const now = Date.now();

    if (session.startedAt) {
      session.statistics.totalDuration = now - session.startedAt.getTime();
      session.statistics.activeDuration = session.statistics.totalDuration - session.totalBreakTime;
    }

    // Update objective completion count
    session.statistics.objectivesCompleted = session.learningObjectives.filter(obj => obj.completed).length;
  }

  private calculateCompletionRate(session: LearningSession): number {
    if (session.learningObjectives.length === 0) {
      return 1.0; // No objectives means full completion
    }

    return session.statistics.objectivesCompleted / session.learningObjectives.length;
  }

  private calculateEngagementScore(session: LearningSession): number {
    let score = 0;

    // Base score from completion rate
    score += this.calculateCompletionRate(session) * 40;

    // Interaction engagement (up to 30 points)
    const targetInteractions = session.statistics.activeDuration / (60 * 1000) * 2; // 2 interactions per minute target
    const interactionScore = Math.min(session.statistics.interactionCount / Math.max(targetInteractions, 1), 1) * 30;
    score += interactionScore;

    // Break compliance (up to 20 points)
    const breakCompliance = session.breakReminders.filter(r => r.acknowledged).length / Math.max(session.breakReminders.length, 1);
    score += breakCompliance * 20;

    // Session completion bonus (10 points)
    if (session.state === 'completed') {
      score += 10;
    }

    return Math.round(Math.min(score, 100));
  }
}

/**
 * Factory function to create LearningSessionService
 */
export function createLearningSessionService(logger: winston.Logger): LearningSessionService {
  return new LearningSessionService(logger);
}

/**
 * Default session timing configurations export
 */
export { AGE_TIMING_CONFIGS };
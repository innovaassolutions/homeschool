import winston from 'winston';
import { ChatGPTService, ConversationContext, ChatGPTResponse, AgeGroup } from './chatgpt';
import { VoiceRecognitionService, VoiceRecognitionResult, AudioMetadata } from './voiceRecognition';
import { AudioProcessingService, AudioQualityResult } from './audioProcessing';
import { TextToSpeechService, TTSRequest, TTSResponse } from './textToSpeech';
import { LearningSessionService } from './learningSession';

// Voice conversation session interface
export interface VoiceConversationSession {
  sessionId: string;
  childId: string;
  ageGroup: AgeGroup;
  startTime: Date;
  lastActivity: Date;
  totalInteractions: number;
  averageResponseTime: number;
  qualityMetrics: VoiceQualityMetrics;
  conversationContext: ConversationContext;
  isActive: boolean;
  learningSessionId?: string; // Link to learning session
}

// Voice quality metrics for session tracking
export interface VoiceQualityMetrics {
  averageConfidence: number;
  clarificationRequests: number;
  processingErrors: number;
  audioQualityScore: number;
  successfulTranscriptions: number;
  totalAttempts: number;
}

// Voice conversation request
export interface VoiceConversationRequest {
  sessionId: string;
  audioBuffer: Buffer;
  audioMetadata: AudioMetadata;
  conversationContext: ConversationContext;
  options?: {
    skipAudioProcessing?: boolean;
    requireHighConfidence?: boolean;
    enableFallback?: boolean;
  };
}

// Voice conversation response
export interface VoiceConversationResponse {
  success: boolean;
  transcription?: VoiceRecognitionResult;
  chatGPTResponse?: ChatGPTResponse;
  ttsResponse?: TTSResponse;
  audioQuality?: AudioQualityResult;
  sessionUpdated: VoiceConversationSession;
  clarificationNeeded: boolean;
  clarificationMessage?: string;
  processingTime: number;
  error?: string;
}

// Integration statistics
export interface VoiceIntegrationStats {
  totalSessions: number;
  activeSessions: number;
  totalInteractions: number;
  successRate: number;
  averageProcessingTime: number;
  averageConfidence: number;
  clarificationRate: number;
  ageGroupBreakdown: Record<AgeGroup, {
    sessions: number;
    interactions: number;
    successRate: number;
  }>;
}

/**
 * Voice Conversation Integration Service
 *
 * Orchestrates the complete voice conversation flow by integrating:
 * - Audio processing and quality assessment
 * - Speech-to-text conversion with child optimization
 * - ChatGPT conversation processing
 * - Session management and analytics
 * - COPPA-compliant data handling
 *
 * This service provides the seamless voice-to-ChatGPT-to-response pipeline
 * required for natural voice conversations in the learning environment.
 */
export class VoiceConversationIntegrationService {
  private logger: winston.Logger;
  private chatGPTService: ChatGPTService;
  private voiceRecognitionService: VoiceRecognitionService;
  private audioProcessingService: AudioProcessingService;
  private ttsService: TextToSpeechService;
  private sessionService?: LearningSessionService;
  private activeSessions: Map<string, VoiceConversationSession> = new Map();
  private stats: VoiceIntegrationStats;

  constructor(
    chatGPTService: ChatGPTService,
    voiceRecognitionService: VoiceRecognitionService,
    audioProcessingService: AudioProcessingService,
    ttsService: TextToSpeechService,
    logger: winston.Logger,
    sessionService?: LearningSessionService
  ) {
    this.chatGPTService = chatGPTService;
    this.voiceRecognitionService = voiceRecognitionService;
    this.audioProcessingService = audioProcessingService;
    this.ttsService = ttsService;
    this.sessionService = sessionService;
    this.logger = logger;

    // Initialize statistics
    this.stats = {
      totalSessions: 0,
      activeSessions: 0,
      totalInteractions: 0,
      successRate: 0,
      averageProcessingTime: 0,
      averageConfidence: 0,
      clarificationRate: 0,
      ageGroupBreakdown: {
        ages6to9: { sessions: 0, interactions: 0, successRate: 0 },
        ages10to13: { sessions: 0, interactions: 0, successRate: 0 },
        ages14to16: { sessions: 0, interactions: 0, successRate: 0 }
      }
    };

    this.logger.info('VoiceConversationIntegrationService initialized', {
      servicesConnected: {
        chatGPT: !!this.chatGPTService,
        voiceRecognition: !!this.voiceRecognitionService,
        audioProcessing: !!this.audioProcessingService,
        textToSpeech: !!this.ttsService
      }
    });
  }

  /**
   * Process a complete voice conversation interaction
   */
  async processVoiceConversation(request: VoiceConversationRequest): Promise<VoiceConversationResponse> {
    const startTime = Date.now();
    let session = this.activeSessions.get(request.sessionId);

    try {
      this.logger.debug('Processing voice conversation', {
        sessionId: request.sessionId,
        audioSize: request.audioBuffer.length,
        ageGroup: request.conversationContext.ageGroup
      });

      // Initialize or update session
      if (!session) {
        session = await this.createSession(request.sessionId, request.conversationContext);
      } else {
        session = await this.updateSession(session, request.conversationContext);
      }

      const response: VoiceConversationResponse = {
        success: false,
        sessionUpdated: session,
        clarificationNeeded: false,
        processingTime: 0
      };

      // Step 1: Audio Processing and Quality Assessment
      let processedAudioBuffer = request.audioBuffer;
      let audioQuality: AudioQualityResult | undefined;

      if (!request.options?.skipAudioProcessing) {
        try {
          const audioProcessResult = await this.audioProcessingService.processAudio(
            request.audioBuffer,
            request.audioMetadata,
            request.conversationContext.ageGroup,
            { forceProcessing: false }
          );

          processedAudioBuffer = audioProcessResult.processedAudio;
          audioQuality = audioProcessResult.quality;
          response.audioQuality = audioQuality;

          this.logger.debug('Audio processing completed', {
            qualityScore: audioQuality.overallScore,
            processingApplied: audioQuality.processingApplied
          });

        } catch (error) {
          this.logger.warn('Audio processing failed, using original audio', {
            error: error instanceof Error ? error.message : error
          });
          // Continue with original audio if processing fails
        }
      }

      // Step 2: Speech-to-Text Conversion
      let transcriptionResult: VoiceRecognitionResult;

      try {
        const voiceOptions = {
          ageGroup: request.conversationContext.ageGroup,
          enableChildOptimization: true,
          language: 'en',
          prompt: this.buildRecognitionPrompt(request.conversationContext)
        };

        transcriptionResult = await this.voiceRecognitionService.processAudio(
          processedAudioBuffer,
          request.audioMetadata,
          voiceOptions
        );

        response.transcription = transcriptionResult;

        this.logger.debug('Speech recognition completed', {
          confidence: transcriptionResult.confidence,
          textLength: transcriptionResult.text.length,
          clarificationNeeded: transcriptionResult.clarificationNeeded
        });

      } catch (error) {
        const errorMessage = `Speech recognition failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        this.logger.error('Voice recognition failed', { error: errorMessage });

        session.qualityMetrics.processingErrors++;
        this.updateSessionInMap(session);

        return {
          ...response,
          error: errorMessage,
          processingTime: Date.now() - startTime
        };
      }

      // Step 3: Handle Low Confidence or Clarification Needed
      if (transcriptionResult.clarificationNeeded ||
          (request.options?.requireHighConfidence && transcriptionResult.confidence < 0.8)) {

        const clarificationMessage = this.voiceRecognitionService.generateClarificationMessage(
          request.conversationContext.ageGroup,
          transcriptionResult.text
        );

        session.qualityMetrics.clarificationRequests++;
        this.updateSessionInMap(session);

        return {
          ...response,
          clarificationNeeded: true,
          clarificationMessage,
          processingTime: Date.now() - startTime
        };
      }

      // Step 4: ChatGPT Conversation Processing
      let chatGPTResponse: ChatGPTResponse;

      try {
        // Add voice interaction metadata to conversation context
        const enhancedContext = {
          ...request.conversationContext,
          conversationHistory: [
            ...request.conversationContext.conversationHistory,
            {
              role: 'user' as const,
              content: transcriptionResult.text,
              timestamp: new Date(),
              metadata: {
                voiceInput: true,
                confidence: transcriptionResult.confidence,
                processingTime: transcriptionResult.processingTime,
                audioQuality: audioQuality?.overallScore
              }
            }
          ]
        };

        chatGPTResponse = await this.chatGPTService.generateResponse(
          transcriptionResult.text,
          enhancedContext
        );

        response.chatGPTResponse = chatGPTResponse;

        this.logger.debug('ChatGPT response generated', {
          responseLength: chatGPTResponse.content.length,
          tokenUsage: chatGPTResponse.tokenUsage.totalTokens,
          filtered: chatGPTResponse.filtered
        });

      } catch (error) {
        const errorMessage = `ChatGPT processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        this.logger.error('ChatGPT processing failed', { error: errorMessage });

        // Try fallback response if enabled
        if (request.options?.enableFallback) {
          const fallbackMessage = this.generateFallbackResponse(
            request.conversationContext.ageGroup,
            transcriptionResult.text
          );

          response.chatGPTResponse = {
            content: fallbackMessage,
            tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            model: 'fallback',
            timestamp: new Date(),
            filtered: false,
            ageAppropriate: true
          };
        } else {
          return {
            ...response,
            error: errorMessage,
            processingTime: Date.now() - startTime
          };
        }
      }

      // Step 5: Generate Text-to-Speech Audio Response
      let ttsResponse: TTSResponse | undefined;

      if (response.chatGPTResponse) {
        try {
          const voiceProfile = this.ttsService.getDefaultVoiceProfile(session.ageGroup);

          const ttsRequest: TTSRequest = {
            text: response.chatGPTResponse.content,
            voiceProfile: voiceProfile,
            options: {
              format: 'mp3',
              quality: 'medium'
            }
          };

          ttsResponse = await this.ttsService.synthesizeSpeech(ttsRequest);
          response.ttsResponse = ttsResponse;

          this.logger.debug('TTS response generated', {
            sessionId: session.sessionId,
            voiceProfile: ttsResponse.metadata.voiceProfile.id,
            processingTime: ttsResponse.metadata.processingTime,
            fromCache: ttsResponse.metadata.cacheHit,
            duration: ttsResponse.metadata.duration
          });

        } catch (error) {
          const errorMessage = `TTS processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.logger.warn('TTS processing failed, conversation will continue without audio', {
            error: errorMessage,
            sessionId: session.sessionId
          });

          // TTS failure is not critical - the text response is still available
          // We continue the conversation without the audio component
        }
      }

      // Step 6: Update Session Statistics
      const processingTime = Date.now() - startTime;
      session.totalInteractions++;
      session.lastActivity = new Date();
      session.qualityMetrics.successfulTranscriptions++;
      session.qualityMetrics.totalAttempts++;

      // Record interaction in learning session if connected
      if (session.learningSessionId && this.sessionService) {
        try {
          await this.sessionService.recordVoiceInteraction(session.learningSessionId, {
            responseTime: processingTime,
            confidence: transcriptionResult.confidence
          });
        } catch (error) {
          this.logger.debug('Failed to record voice interaction in learning session', {
            learningSessionId: session.learningSessionId,
            error: error instanceof Error ? error.message : error
          });
        }
      }
      session.qualityMetrics.averageConfidence = this.updateAverage(
        session.qualityMetrics.averageConfidence,
        transcriptionResult.confidence,
        session.qualityMetrics.successfulTranscriptions
      );

      if (audioQuality) {
        session.qualityMetrics.audioQualityScore = this.updateAverage(
          session.qualityMetrics.audioQualityScore,
          audioQuality.overallScore,
          session.qualityMetrics.successfulTranscriptions
        );
      }

      session.averageResponseTime = this.updateAverage(
        session.averageResponseTime,
        processingTime,
        session.totalInteractions
      );

      this.updateSessionInMap(session);
      this.updateGlobalStats(session.ageGroup, true, processingTime, transcriptionResult.confidence);

      // Return successful response
      return {
        ...response,
        success: true,
        processingTime
      };

    } catch (error) {
      const errorMessage = `Voice conversation processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error('Voice conversation integration failed', {
        sessionId: request.sessionId,
        error: errorMessage
      });

      if (session) {
        session.qualityMetrics.processingErrors++;
        this.updateSessionInMap(session);
      }

      this.updateGlobalStats(
        request.conversationContext.ageGroup,
        false,
        Date.now() - startTime,
        0
      );

      return {
        success: false,
        sessionUpdated: session || await this.createSession(request.sessionId, request.conversationContext),
        clarificationNeeded: false,
        processingTime: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  /**
   * Create new conversation session
   */
  private async createSession(
    sessionId: string,
    context: ConversationContext
  ): Promise<VoiceConversationSession> {
    const session: VoiceConversationSession = {
      sessionId,
      childId: context.childId,
      ageGroup: context.ageGroup,
      startTime: new Date(),
      lastActivity: new Date(),
      totalInteractions: 0,
      averageResponseTime: 0,
      qualityMetrics: {
        averageConfidence: 0,
        clarificationRequests: 0,
        processingErrors: 0,
        audioQualityScore: 0,
        successfulTranscriptions: 0,
        totalAttempts: 0
      },
      conversationContext: context,
      isActive: true
    };

    this.activeSessions.set(sessionId, session);
    this.stats.totalSessions++;
    this.stats.activeSessions++;
    this.stats.ageGroupBreakdown[context.ageGroup].sessions++;

    this.logger.info('Created new voice conversation session', {
      sessionId,
      childId: context.childId,
      ageGroup: context.ageGroup
    });

    return session;
  }

  /**
   * Update existing session
   */
  private async updateSession(
    session: VoiceConversationSession,
    context: ConversationContext
  ): Promise<VoiceConversationSession> {
    session.conversationContext = context;
    session.lastActivity = new Date();
    return session;
  }

  /**
   * Update session in map
   */
  private updateSessionInMap(session: VoiceConversationSession): void {
    this.activeSessions.set(session.sessionId, session);
  }

  /**
   * Build recognition prompt with conversation context
   */
  private buildRecognitionPrompt(context: ConversationContext): string {
    const basePrompt = `Learning conversation about ${context.subject}`;

    if (context.topic) {
      return `${basePrompt}, specifically focusing on ${context.topic}`;
    }

    return basePrompt;
  }

  /**
   * Generate fallback response for failed ChatGPT processing
   */
  private generateFallbackResponse(ageGroup: AgeGroup, userInput: string): string {
    const fallbacks = {
      ages6to9: [
        "That's a great question! Let me think about that for a moment. Can you ask me again?",
        "I want to help you learn! Could you tell me more about what you're working on?",
        "You're doing great! Let's try talking about something else for now."
      ],
      ages10to13: [
        "I'm having trouble understanding right now. Could you rephrase your question?",
        "That's an interesting topic! Let me gather my thoughts and you can ask again.",
        "I want to make sure I give you the best answer. Can you try asking in a different way?"
      ],
      ages14to16: [
        "I'm experiencing some technical difficulties. Please try rephrasing your question.",
        "I want to provide you with an accurate response. Could you ask your question again?",
        "Let me reset and try again. Please restate what you'd like to know."
      ]
    };

    const responses = fallbacks[ageGroup];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Update running average
   */
  private updateAverage(currentAverage: number, newValue: number, count: number): number {
    return (currentAverage * (count - 1) + newValue) / count;
  }

  /**
   * Update global statistics
   */
  private updateGlobalStats(
    ageGroup: AgeGroup,
    success: boolean,
    processingTime: number,
    confidence: number
  ): void {
    this.stats.totalInteractions++;
    this.stats.ageGroupBreakdown[ageGroup].interactions++;

    if (success) {
      this.stats.ageGroupBreakdown[ageGroup].successRate =
        (this.stats.ageGroupBreakdown[ageGroup].successRate *
         (this.stats.ageGroupBreakdown[ageGroup].interactions - 1) + 1) /
         this.stats.ageGroupBreakdown[ageGroup].interactions;
    }

    // Update global averages
    this.stats.successRate = Object.values(this.stats.ageGroupBreakdown)
      .reduce((sum, group) => sum + group.successRate * group.interactions, 0) /
      this.stats.totalInteractions;

    this.stats.averageProcessingTime = this.updateAverage(
      this.stats.averageProcessingTime,
      processingTime,
      this.stats.totalInteractions
    );

    if (confidence > 0) {
      this.stats.averageConfidence = this.updateAverage(
        this.stats.averageConfidence,
        confidence,
        this.stats.totalInteractions
      );
    }
  }

  /**
   * Get active session
   */
  getSession(sessionId: string): VoiceConversationSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Link voice session with learning session
   */
  async linkLearningSession(voiceSessionId: string, learningSessionId: string): Promise<void> {
    const voiceSession = this.activeSessions.get(voiceSessionId);
    if (!voiceSession) {
      throw new Error(`Voice session not found: ${voiceSessionId}`);
    }

    voiceSession.learningSessionId = learningSessionId;

    // Also link in the learning session service
    if (this.sessionService) {
      try {
        await this.sessionService.linkVoiceSession(
          learningSessionId,
          voiceSessionId,
          voiceSession.conversationContext
        );
      } catch (error) {
        this.logger.warn('Failed to link voice session in learning session service', {
          voiceSessionId,
          learningSessionId,
          error: error instanceof Error ? error.message : error
        });
      }
    }

    this.logger.info('Voice session linked to learning session', {
      voiceSessionId,
      learningSessionId
    });
  }

  /**
   * End conversation session
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.activeSessions.delete(sessionId);
      this.stats.activeSessions--;

      this.logger.info('Ended voice conversation session', {
        sessionId,
        duration: Date.now() - session.startTime.getTime(),
        totalInteractions: session.totalInteractions,
        successRate: session.qualityMetrics.successfulTranscriptions / session.qualityMetrics.totalAttempts
      });
    }
  }

  /**
   * Get integration statistics
   */
  getStats(): VoiceIntegrationStats {
    return { ...this.stats };
  }

  /**
   * Get all active sessions (for monitoring)
   */
  getActiveSessions(): VoiceConversationSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Clean up inactive sessions
   */
  async cleanupInactiveSessions(maxIdleTime: number = 30 * 60 * 1000): Promise<number> {
    const cutoffTime = new Date(Date.now() - maxIdleTime);
    let cleanedCount = 0;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.lastActivity < cutoffTime) {
        await this.endSession(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(`Cleaned up ${cleanedCount} inactive voice sessions`);
    }

    return cleanedCount;
  }

  /**
   * Reset statistics (for testing or maintenance)
   */
  resetStats(): void {
    this.stats = {
      totalSessions: 0,
      activeSessions: this.activeSessions.size,
      totalInteractions: 0,
      successRate: 0,
      averageProcessingTime: 0,
      averageConfidence: 0,
      clarificationRate: 0,
      ageGroupBreakdown: {
        ages6to9: { sessions: 0, interactions: 0, successRate: 0 },
        ages10to13: { sessions: 0, interactions: 0, successRate: 0 },
        ages14to16: { sessions: 0, interactions: 0, successRate: 0 }
      }
    };

    this.logger.info('Voice integration statistics reset');
  }

  /**
   * Link a voice conversation session with a learning session
   */
  async linkLearningSession(sessionId: string, learningSessionId: string): Promise<VoiceConversationSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Voice conversation session ${sessionId} not found`);
    }

    session.learningSessionId = learningSessionId;
    this.logger.info('Voice conversation session linked to learning session', {
      voiceSessionId: sessionId,
      learningSessionId,
      timestamp: new Date().toISOString()
    });

    return session;
  }

  /**
   * Get learning session ID for a voice conversation session
   */
  getLearningSessionId(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    return session?.learningSessionId;
  }
}

/**
 * Factory function to create VoiceConversationIntegrationService
 */
export function createVoiceConversationIntegrationService(
  chatGPTService: ChatGPTService,
  voiceRecognitionService: VoiceRecognitionService,
  audioProcessingService: AudioProcessingService,
  ttsService: TextToSpeechService,
  logger: winston.Logger
): VoiceConversationIntegrationService {
  return new VoiceConversationIntegrationService(
    chatGPTService,
    voiceRecognitionService,
    audioProcessingService,
    ttsService,
    logger
  );
}
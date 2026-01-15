import OpenAI from 'openai';
import winston from 'winston';
import { ConversationMemoryService } from './conversationMemory';
import { TokenOptimizationService, ModelType } from './tokenOptimization';
import { ContentFilterService, ContentFilterResult } from './contentFilter';
import { PromptEngineeringService, PromptPersonalization } from './promptEngineering';
import { ResponseSanitizationService, SafetyCheckConfig } from './responseSanitization';

// Age group type definition from Story 1.3
export type AgeGroup = 'ages6to9' | 'ages10to13' | 'ages14to16';

// Conversation context interface
export interface ConversationContext {
  childId: string;
  ageGroup: AgeGroup;
  subject: string;
  topic: string;
  learningStyle?: string;
  interests?: string[];
  accessibilityNeeds?: string[];
  sessionId: string;
  conversationHistory: ConversationMessage[];
}

// Message interface for conversation history
export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokenCount?: number;
}

// ChatGPT response interface
export interface ChatGPTResponse {
  content: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  timestamp: Date;
  filtered: boolean;
  ageAppropriate: boolean;
}

// Configuration interface
export interface ChatGPTConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  maxContextLength: number;
  enableFallbacks: boolean;
}

// Age-specific prompt configurations
const AGE_PROMPT_CONFIGS = {
  ages6to9: {
    systemPrompt: `You are a friendly, patient AI tutor for young children aged 6-9. Use simple language, encouraging tone, and explain concepts with fun examples and analogies. Keep responses short (2-3 sentences) and always be positive and supportive.`,
    temperature: 0.8,
    maxTokens: 150,
    complexity: 'simple'
  },
  ages10to13: {
    systemPrompt: `You are an enthusiastic AI tutor for pre-teens aged 10-13. Use clear, engaging language with relevant examples. You can introduce more detailed explanations but keep them accessible. Encourage curiosity and critical thinking.`,
    temperature: 0.7,
    maxTokens: 200,
    complexity: 'balanced'
  },
  ages14to16: {
    systemPrompt: `You are a knowledgeable AI tutor for teenagers aged 14-16. Use mature language and provide thorough explanations. Encourage independent thinking, analysis, and deeper exploration of topics. You can discuss complex concepts with appropriate depth.`,
    temperature: 0.6,
    maxTokens: 300,
    complexity: 'advanced'
  }
};

export class ChatGPTService {
  private openai: OpenAI;
  private config: ChatGPTConfig;
  private logger: winston.Logger;
  private conversationMemory: ConversationMemoryService | null = null;
  private tokenOptimization: TokenOptimizationService | null = null;
  private contentFilter: ContentFilterService | null = null;
  private promptEngineering: PromptEngineeringService | null = null;
  private responseSanitization: ResponseSanitizationService | null = null;
  private circuitBreakerFailures: number = 0;
  private circuitBreakerLastFailure: Date | null = null;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

  constructor(
    config: ChatGPTConfig,
    logger: winston.Logger,
    conversationMemory?: ConversationMemoryService,
    tokenOptimization?: TokenOptimizationService,
    contentFilter?: ContentFilterService,
    promptEngineering?: PromptEngineeringService,
    responseSanitization?: ResponseSanitizationService
  ) {
    this.config = config;
    this.logger = logger;
    this.conversationMemory = conversationMemory || null;
    this.tokenOptimization = tokenOptimization || null;
    this.contentFilter = contentFilter || null;
    this.promptEngineering = promptEngineering || null;
    this.responseSanitization = responseSanitization || null;
    this.openai = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  /**
   * Generate a tutoring response based on conversation context
   */
  async generateResponse(
    context: ConversationContext,
    userMessage: string
  ): Promise<ChatGPTResponse> {
    const startTime = Date.now();

    try {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen()) {
        throw new Error('Circuit breaker is open - ChatGPT service temporarily unavailable');
      }

      // If conversation memory is available, ensure session exists and store user message
      if (this.conversationMemory) {
        await this.ensureSessionExists(context);
        await this.conversationMemory.storeMessage(
          context.sessionId,
          'user',
          userMessage,
          { tokenCount: this.estimateTokenCount(userMessage) }
        );
      }

      // Get age-appropriate configuration
      const ageConfig = AGE_PROMPT_CONFIGS[context.ageGroup];

      // Build conversation messages (with memory if available)
      const messages = await this.buildConversationMessagesWithMemory(context, userMessage, ageConfig.systemPrompt);

      // Make API call with retry logic
      const completion = await this.makeApiCallWithRetry(messages, ageConfig);

      // Process and validate response
      const response = await this.processResponse(completion, context);

      // Store assistant response in memory if available
      if (this.conversationMemory) {
        const responseTime = Date.now() - startTime;
        await this.conversationMemory.storeMessage(
          context.sessionId,
          'assistant',
          response.content,
          {
            tokenCount: response.tokenUsage.completionTokens,
            filtered: response.filtered,
            ageAppropriate: response.ageAppropriate,
            modelUsed: response.model,
            responseTimeMs: responseTime
          }
        );
      }

      // Reset circuit breaker on success
      this.resetCircuitBreaker();

      return response;
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Ensure conversation session exists in memory
   */
  private async ensureSessionExists(context: ConversationContext): Promise<void> {
    if (!this.conversationMemory) return;

    try {
      const existingSession = await this.conversationMemory.getSession(context.sessionId);
      if (!existingSession) {
        await this.conversationMemory.createSession(context);
      }
    } catch (error) {
      this.logger.warn('Failed to ensure session exists:', error);
    }
  }

  /**
   * Build conversation messages with memory integration
   */
  private async buildConversationMessagesWithMemory(
    context: ConversationContext,
    userMessage: string,
    systemPrompt: string
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(context, systemPrompt)
      }
    ];

    // Get conversation history from memory if available
    let conversationHistory: ConversationMessage[] = context.conversationHistory;

    if (this.conversationMemory) {
      try {
        conversationHistory = await this.conversationMemory.getRecentHistory(context.sessionId, 10);
      } catch (error) {
        this.logger.warn('Failed to get conversation history from memory:', error);
        // Fall back to context history
      }
    }

    // Add conversation history (pruned if necessary)
    const prunedHistory = this.pruneConversationHistory(conversationHistory);
    prunedHistory.forEach(msg => {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      });
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    return messages;
  }

  /**
   * Build conversation messages array for OpenAI API (legacy method)
   */
  private buildConversationMessages(
    context: ConversationContext,
    userMessage: string,
    systemPrompt: string
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(context, systemPrompt)
      }
    ];

    // Add conversation history (pruned if necessary)
    const prunedHistory = this.pruneConversationHistory(context.conversationHistory);
    prunedHistory.forEach(msg => {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      });
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    return messages;
  }

  /**
   * Build comprehensive system prompt with context
   */
  private buildSystemPrompt(context: ConversationContext, basePrompt: string): string {
    // Use enhanced prompt engineering if available
    if (this.promptEngineering) {
      const personalization: PromptPersonalization = {
        ageGroup: context.ageGroup,
        learningStyle: context.learningStyle as any,
        interests: context.interests,
        accessibilityNeeds: context.accessibilityNeeds as any,
        subject: context.subject,
        topic: context.topic
      };

      // Validate personalization
      const validation = this.promptEngineering.validatePersonalization(personalization);
      if (validation.isValid) {
        const enhancedConfig = this.promptEngineering.generatePersonalizedPrompt(personalization);
        return enhancedConfig.systemPrompt;
      } else {
        this.logger.warn('Invalid prompt personalization, falling back to base prompt:', validation.errors);
      }
    }

    // Fallback to simple prompt building
    let prompt = basePrompt;

    prompt += `\n\nContext:\n`;
    prompt += `- Subject: ${context.subject}\n`;
    prompt += `- Topic: ${context.topic}\n`;

    if (context.learningStyle) {
      prompt += `- Learning Style: ${context.learningStyle}\n`;
    }

    if (context.interests && context.interests.length > 0) {
      prompt += `- Interests: ${context.interests.join(', ')}\n`;
    }

    if (context.accessibilityNeeds && context.accessibilityNeeds.length > 0) {
      prompt += `- Accessibility Needs: ${context.accessibilityNeeds.join(', ')}\n`;
    }

    prompt += `\nEnsure all responses are age-appropriate and educationally valuable.`;

    return prompt;
  }

  /**
   * Make API call with exponential backoff retry logic
   */
  private async makeApiCallWithRetry(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    ageConfig: typeof AGE_PROMPT_CONFIGS[AgeGroup],
    maxRetries: number = 3
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: this.config.model,
          messages,
          max_tokens: ageConfig.maxTokens,
          temperature: ageConfig.temperature,
          user: `child_session_${Date.now()}` // For OpenAI usage tracking
        });

        return completion;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        // Wait with exponential backoff
        if (attempt < maxRetries - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Process and validate API response
   */
  private async processResponse(
    completion: OpenAI.Chat.Completions.ChatCompletion,
    context: ConversationContext
  ): Promise<ChatGPTResponse> {
    if (!completion?.choices || !Array.isArray(completion.choices) || completion.choices.length === 0) {
      throw new Error('Invalid response from ChatGPT API');
    }

    const choice = completion.choices[0];
    if (!choice?.message?.content) {
      throw new Error('Invalid response from ChatGPT API');
    }

    const content = choice.message.content;

    // Enhanced content filtering and age-appropriateness validation
    let filtered: ContentFilterResult;
    if (this.contentFilter) {
      filtered = await this.contentFilter.filterContent(content, context.ageGroup, {
        subject: context.subject,
        learningObjective: context.topic
      });

      // Log filtering results for monitoring
      if (filtered.violations.length > 0) {
        this.logger.warn('Content filtering violations detected:', {
          ageGroup: context.ageGroup,
          violationsCount: filtered.violations.length,
          confidence: filtered.confidence,
          isAppropriate: filtered.isAppropriate
        });
      }

      // If content is inappropriate, return fallback
      if (!filtered.isAppropriate) {
        this.logger.warn('Inappropriate content blocked:', {
          ageGroup: context.ageGroup,
          violations: filtered.violations.map(v => ({ type: v.type, severity: v.severity }))
        });

        return {
          content: this.generateAgeSafetyFallback(context.ageGroup),
          tokenUsage: {
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0
          },
          model: completion.model,
          timestamp: new Date(),
          filtered: true,
          ageAppropriate: false
        };
      }
    } else {
      // Fallback to simple filtering
      const simpleFiltered = await this.applyContentFiltering(content);
      const ageAppropriate = await this.validateAgeAppropriateness(content, context.ageGroup);

      filtered = {
        isAppropriate: ageAppropriate,
        filteredContent: simpleFiltered.content,
        violations: [],
        confidence: 0.8,
        warnings: []
      };
    }

    // Additional response sanitization
    if (this.responseSanitization && filtered.isAppropriate) {
      const safetyConfig: SafetyCheckConfig = {
        ageGroup: context.ageGroup,
        strictMode: context.ageGroup === 'ages6to9',
        allowEducationalExceptions: true,
        parentalControls: {
          blockSensitiveTopics: context.ageGroup === 'ages6to9',
          requireApprovalForComplexTopics: false,
          monitorEmotionalContent: true
        }
      };

      const sanitizationResult = await this.responseSanitization.sanitizeResponse(
        filtered.filteredContent,
        safetyConfig
      );

      // Log sanitization results
      if (sanitizationResult.modifications.length > 0) {
        this.logger.info('Response sanitization applied:', {
          ageGroup: context.ageGroup,
          modificationsCount: sanitizationResult.modifications.length,
          safetyScore: sanitizationResult.safetyScore,
          blocked: sanitizationResult.blocked
        });
      }

      // If sanitization blocked the response, return safety fallback
      if (sanitizationResult.blocked) {
        return {
          content: sanitizationResult.sanitizedContent,
          tokenUsage: {
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0
          },
          model: completion.model,
          timestamp: new Date(),
          filtered: true,
          ageAppropriate: false
        };
      }

      // Use sanitized content
      filtered.filteredContent = sanitizationResult.sanitizedContent;
      filtered.warnings.push(...sanitizationResult.warnings);
    }

    return {
      content: filtered.filteredContent,
      tokenUsage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0
      },
      model: completion.model,
      timestamp: new Date(),
      filtered: filtered.violations.length > 0,
      ageAppropriate: filtered.isAppropriate
    };
  }

  /**
   * Apply content filtering to response
   */
  private async applyContentFiltering(content: string): Promise<{content: string, wasFiltered: boolean}> {
    // Placeholder for content filtering logic
    // In a real implementation, this would use content moderation APIs
    const inappropriatePatterns = [
      /\b(inappropriate|harmful|dangerous)\b/gi,
      // Add more patterns as needed
    ];

    let filteredContent = content;
    let wasFiltered = false;

    for (const pattern of inappropriatePatterns) {
      if (pattern.test(filteredContent)) {
        filteredContent = filteredContent.replace(pattern, '[content filtered]');
        wasFiltered = true;
      }
    }

    return { content: filteredContent, wasFiltered };
  }

  /**
   * Validate age-appropriateness of content
   */
  private async validateAgeAppropriateness(content: string, ageGroup: AgeGroup): Promise<boolean> {
    // Placeholder for age-appropriateness validation
    // In a real implementation, this would use more sophisticated NLP analysis
    const complexWords = content.split(' ').filter(word => word.length > 12).length;
    const avgSentenceLength = content.split('.').reduce((sum, sentence) =>
      sum + sentence.split(' ').length, 0) / content.split('.').length;

    switch (ageGroup) {
      case 'ages6to9':
        return complexWords < 3 && avgSentenceLength < 15;
      case 'ages10to13':
        return complexWords < 8 && avgSentenceLength < 25;
      case 'ages14to16':
        return true; // Most content is appropriate for this age group
      default:
        return false;
    }
  }

  /**
   * Generate age-appropriate safety fallback message
   */
  private generateAgeSafetyFallback(ageGroup: AgeGroup): string {
    const fallbackMessages = {
      'ages6to9': "I want to make sure I give you the best answer for learning! Could you ask your question in a different way? Maybe your teacher or parent can help you ask it too!",
      'ages10to13': "I need to be careful about the topics we discuss to make sure they're appropriate for your learning. Could you try asking your question differently, or maybe focus on a specific part you'd like to understand?",
      'ages14to16': "I want to ensure our conversation stays focused on educational topics that are appropriate for your learning goals. Could you rephrase your question or be more specific about what you'd like to learn?"
    };

    return fallbackMessages[ageGroup];
  }

  /**
   * Prune conversation history to manage token limits
   */
  private pruneConversationHistory(history: ConversationMessage[]): ConversationMessage[] {
    // Simple pruning strategy: keep last 10 messages
    // In a real implementation, this would be more sophisticated
    const maxMessages = 10;
    return history.slice(-maxMessages);
  }

  /**
   * Circuit breaker pattern implementation
   */
  private isCircuitBreakerOpen(): boolean {
    if (this.circuitBreakerFailures < this.CIRCUIT_BREAKER_THRESHOLD) {
      return false;
    }

    if (!this.circuitBreakerLastFailure) {
      return false;
    }

    const timeSinceLastFailure = Date.now() - this.circuitBreakerLastFailure.getTime();
    return timeSinceLastFailure < this.CIRCUIT_BREAKER_TIMEOUT;
  }

  private resetCircuitBreaker(): void {
    this.circuitBreakerFailures = 0;
    this.circuitBreakerLastFailure = null;
  }

  private handleApiError(error: any): void {
    this.circuitBreakerFailures++;
    this.circuitBreakerLastFailure = new Date();

    this.logger.error('ChatGPT API error:', {
      error: error.message,
      failures: this.circuitBreakerFailures,
      timestamp: new Date()
    });
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: any): boolean {
    // Don't retry on authentication errors, invalid requests, rate limits, quota exceeded
    return error.status === 401 ||
           error.status === 400 ||
           error.status === 403 ||
           error.status === 429; // Rate limiting and quota errors
  }

  /**
   * Generate fallback response when ChatGPT is unavailable
   */
  public generateFallbackResponse(context: ConversationContext): ChatGPTResponse {
    const ageConfig = AGE_PROMPT_CONFIGS[context.ageGroup];

    const fallbackMessages = {
      ages6to9: "I'm having trouble thinking right now, but let's keep learning! Can you tell me more about what you'd like to know?",
      ages10to13: "I'm experiencing some technical difficulties. While I work on that, why don't you try exploring this topic a bit more on your own?",
      ages14to16: "I'm currently unable to process your request due to technical issues. Please try again in a few moments, or consider researching this topic independently."
    };

    return {
      content: fallbackMessages[context.ageGroup],
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      model: 'fallback',
      timestamp: new Date(),
      filtered: false,
      ageAppropriate: true
    };
  }

  /**
   * Count tokens in text (approximate)
   */
  public estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Get service health status
   */
  public getHealthStatus(): {
    available: boolean;
    circuitBreakerOpen: boolean;
    failureCount: number;
  } {
    return {
      available: !this.isCircuitBreakerOpen(),
      circuitBreakerOpen: this.isCircuitBreakerOpen(),
      failureCount: this.circuitBreakerFailures
    };
  }
}

// Factory function to create ChatGPT service
export function createChatGPTService(
  logger: winston.Logger,
  conversationMemory?: ConversationMemoryService,
  tokenOptimization?: TokenOptimizationService,
  contentFilter?: ContentFilterService,
  promptEngineering?: PromptEngineeringService,
  responseSanitization?: ResponseSanitizationService
): ChatGPTService {
  const config: ChatGPTConfig = {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '300'),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    maxContextLength: parseInt(process.env.OPENAI_MAX_CONTEXT || '4000'),
    enableFallbacks: process.env.ENABLE_CHATGPT_FALLBACKS !== 'false'
  };

  if (!config.apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  return new ChatGPTService(config, logger, conversationMemory, tokenOptimization, contentFilter, promptEngineering, responseSanitization);
}
import { ConversationMessage, AgeGroup } from './chatgpt';
import winston from 'winston';

// Token usage tracking interfaces
export interface TokenUsageMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number; // Estimated cost in USD
  timestamp: Date;
}

export interface SessionTokenStats {
  sessionId: string;
  totalTokensUsed: number;
  totalCost: number;
  averageTokensPerMessage: number;
  messageCount: number;
  startTime: Date;
  lastActivity: Date;
}

export interface ConversationComplexity {
  level: 'simple' | 'moderate' | 'complex' | 'advanced';
  score: number; // 0-100
  factors: {
    vocabularyComplexity: number;
    conceptualDifficulty: number;
    contextLength: number;
    interactionDepth: number;
  };
}

// Model pricing (per 1K tokens) - as of 2024
const MODEL_PRICING = {
  'gpt-3.5-turbo': {
    input: 0.0005,
    output: 0.0015
  },
  'gpt-4': {
    input: 0.03,
    output: 0.06
  },
  'gpt-4-turbo': {
    input: 0.01,
    output: 0.03
  }
} as const;

export type ModelType = keyof typeof MODEL_PRICING;

export class TokenOptimizationService {
  private logger: winston.Logger;
  private sessionStats: Map<string, SessionTokenStats> = new Map();

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  /**
   * Enhanced token counting using OpenAI's tiktoken-like algorithm
   */
  public accurateTokenCount(text: string): number {
    // More accurate token estimation based on OpenAI's tokenization patterns
    // This is a simplified version - in production, use tiktoken library

    // Handle special tokens and patterns
    let tokenCount = 0;

    // Split by common word boundaries
    const words = text.split(/\s+/);

    for (const word of words) {
      if (word.length === 0) continue;

      // Simple word-based estimation with adjustments
      if (word.length <= 3) {
        tokenCount += 1;
      } else if (word.length <= 6) {
        tokenCount += Math.ceil(word.length / 3);
      } else {
        // Longer words tend to be split more
        tokenCount += Math.ceil(word.length / 2.5);
      }

      // Additional tokens for punctuation and special characters
      const specialChars = word.match(/[^\w\s]/g);
      if (specialChars) {
        tokenCount += Math.ceil(specialChars.length / 2);
      }
    }

    // Add buffer for overhead (system tokens, formatting, etc.)
    return Math.ceil(tokenCount * 1.1);
  }

  /**
   * Calculate conversation complexity to determine optimal model
   */
  public analyzeConversationComplexity(
    messages: ConversationMessage[],
    subject: string,
    ageGroup: AgeGroup
  ): ConversationComplexity {
    const recentMessages = messages.slice(-5); // Last 5 messages for analysis
    const combinedText = recentMessages.map(m => m.content).join(' ');

    // Vocabulary complexity analysis
    const vocabularyComplexity = this.analyzeVocabularyComplexity(combinedText);

    // Conceptual difficulty based on subject and age group
    const conceptualDifficulty = this.analyzeConceptualDifficulty(subject, ageGroup, combinedText);

    // Context length factor
    const contextLength = Math.min(messages.length * 10, 100); // Cap at 100

    // Interaction depth (how nested/complex the conversation is)
    const interactionDepth = this.analyzeInteractionDepth(messages);

    const factors = {
      vocabularyComplexity,
      conceptualDifficulty,
      contextLength,
      interactionDepth
    };

    // Calculate overall complexity score
    const score = (
      vocabularyComplexity * 0.3 +
      conceptualDifficulty * 0.4 +
      contextLength * 0.2 +
      interactionDepth * 0.1
    );

    let level: ConversationComplexity['level'];
    if (score < 25) level = 'simple';
    else if (score < 50) level = 'moderate';
    else if (score < 75) level = 'complex';
    else level = 'advanced';

    return { level, score, factors };
  }

  /**
   * Recommend optimal model based on complexity and cost considerations
   */
  public recommendModel(complexity: ConversationComplexity, prioritizeCost: boolean = true): ModelType {
    if (prioritizeCost) {
      // Cost-conscious selection
      if (complexity.level === 'simple' || complexity.level === 'moderate') {
        return 'gpt-3.5-turbo';
      } else if (complexity.level === 'complex') {
        return 'gpt-4-turbo'; // Better cost/performance ratio than gpt-4
      } else {
        return 'gpt-4'; // Use full GPT-4 for most advanced cases
      }
    } else {
      // Performance-focused selection
      if (complexity.level === 'simple') {
        return 'gpt-3.5-turbo';
      } else {
        return 'gpt-4'; // Use GPT-4 for anything complex
      }
    }
  }

  /**
   * Intelligent conversation pruning strategy
   */
  public pruneConversationForOptimalTokens(
    messages: ConversationMessage[],
    targetTokenLimit: number,
    ageGroup: AgeGroup
  ): ConversationMessage[] {
    if (messages.length === 0) return [];

    // Calculate current token usage
    const currentTokens = messages.reduce((total, msg) =>
      total + this.accurateTokenCount(msg.content), 0);

    if (currentTokens <= targetTokenLimit) {
      return messages;
    }

    // Pruning strategy: preserve important messages
    const prunedMessages: ConversationMessage[] = [];
    let runningTokenCount = 0;

    // Always keep the most recent message (user's current question)
    const lastMessage = messages[messages.length - 1];
    const lastMessageTokens = this.accurateTokenCount(lastMessage.content);

    if (lastMessageTokens <= targetTokenLimit) {
      prunedMessages.unshift(lastMessage);
      runningTokenCount += lastMessageTokens;
    }

    // Work backwards, prioritizing recent and important messages
    for (let i = messages.length - 2; i >= 0; i--) {
      const message = messages[i];
      const messageTokens = this.accurateTokenCount(message.content);

      // Skip if adding this message would exceed limit
      if (runningTokenCount + messageTokens > targetTokenLimit) {
        continue;
      }

      // Prioritize assistant responses and questions
      const isImportant = this.isMessageImportant(message, ageGroup);

      if (isImportant || runningTokenCount + messageTokens <= targetTokenLimit * 0.8) {
        prunedMessages.unshift(message);
        runningTokenCount += messageTokens;
      }
    }

    this.logger.debug(`Pruned conversation from ${messages.length} to ${prunedMessages.length} messages, ${currentTokens} to ${runningTokenCount} tokens`);

    return prunedMessages;
  }

  /**
   * Calculate estimated cost for token usage
   */
  public calculateCost(
    promptTokens: number,
    completionTokens: number,
    model: ModelType
  ): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      this.logger.warn(`Unknown model pricing: ${model}`);
      return 0;
    }

    const promptCost = (promptTokens / 1000) * pricing.input;
    const completionCost = (completionTokens / 1000) * pricing.output;

    return promptCost + completionCost;
  }

  /**
   * Track token usage for a session
   */
  public trackTokenUsage(
    sessionId: string,
    promptTokens: number,
    completionTokens: number,
    model: ModelType
  ): void {
    const cost = this.calculateCost(promptTokens, completionTokens, model);
    const totalTokens = promptTokens + completionTokens;

    let stats = this.sessionStats.get(sessionId);

    if (!stats) {
      stats = {
        sessionId,
        totalTokensUsed: 0,
        totalCost: 0,
        averageTokensPerMessage: 0,
        messageCount: 0,
        startTime: new Date(),
        lastActivity: new Date()
      };
      this.sessionStats.set(sessionId, stats);
    }

    stats.totalTokensUsed += totalTokens;
    stats.totalCost += cost;
    stats.messageCount += 1;
    stats.averageTokensPerMessage = stats.totalTokensUsed / stats.messageCount;
    stats.lastActivity = new Date();

    this.logger.debug(`Session ${sessionId}: +${totalTokens} tokens, +$${cost.toFixed(4)} cost`);
  }

  /**
   * Get token usage statistics for a session
   */
  public getSessionStats(sessionId: string): SessionTokenStats | null {
    return this.sessionStats.get(sessionId) || null;
  }

  /**
   * Get token usage statistics for all sessions
   */
  public getAllSessionStats(): SessionTokenStats[] {
    return Array.from(this.sessionStats.values());
  }

  /**
   * Clean up old session statistics
   */
  public cleanupOldStats(retentionHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [sessionId, stats] of this.sessionStats.entries()) {
      if (stats.lastActivity < cutoffTime) {
        this.sessionStats.delete(sessionId);
        cleanedCount++;
      }
    }

    this.logger.info(`Cleaned up ${cleanedCount} old session statistics`);
    return cleanedCount;
  }

  /**
   * Get cost-optimization recommendations
   */
  public getCostOptimizationRecommendations(sessionId: string): string[] {
    const stats = this.getSessionStats(sessionId);
    if (!stats) return [];

    const recommendations: string[] = [];

    if (stats.averageTokensPerMessage > 200) {
      recommendations.push('Consider shorter, more focused questions to reduce token usage');
    }

    if (stats.totalCost > 0.50) {
      recommendations.push('Consider using GPT-3.5-turbo for simpler questions to reduce costs');
    }

    if (stats.messageCount > 20) {
      recommendations.push('Long conversations can be summarized to reduce context overhead');
    }

    return recommendations;
  }

  /**
   * Analyze vocabulary complexity of text
   */
  private analyzeVocabularyComplexity(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    if (words.length === 0) return 0;

    // Simple metrics for vocabulary complexity
    const averageWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const uniqueWords = new Set(words).size;
    const vocabularyDiversity = uniqueWords / words.length;

    // Complex words (longer than 7 characters)
    const complexWords = words.filter(word => word.length > 7).length;
    const complexityRatio = complexWords / words.length;

    // Combine metrics into score 0-100
    const score = (
      Math.min(averageWordLength * 10, 50) +
      Math.min(vocabularyDiversity * 100, 30) +
      Math.min(complexityRatio * 100, 20)
    );

    return Math.min(score, 100);
  }

  /**
   * Analyze conceptual difficulty based on subject and content
   */
  private analyzeConceptualDifficulty(subject: string, ageGroup: AgeGroup, text: string): number {
    let baseComplexity = 0;

    // Subject-based complexity
    const subjectComplexity = {
      'math': 60,
      'science': 70,
      'physics': 80,
      'chemistry': 75,
      'biology': 65,
      'history': 50,
      'english': 40,
      'art': 30,
      'music': 35
    };

    baseComplexity = subjectComplexity[subject.toLowerCase()] || 50;

    // Age group adjustment
    const ageAdjustment = {
      'ages6to9': -20,
      'ages10to13': 0,
      'ages14to16': +15
    };

    baseComplexity += ageAdjustment[ageGroup];

    // Content-based adjustments
    const complexTerms = [
      'equation', 'formula', 'theorem', 'hypothesis', 'analysis',
      'synthesis', 'derivative', 'integral', 'molecular', 'quantum'
    ];

    const complexTermCount = complexTerms.filter(term =>
      text.toLowerCase().includes(term)
    ).length;

    baseComplexity += complexTermCount * 5;

    return Math.max(0, Math.min(baseComplexity, 100));
  }

  /**
   * Analyze interaction depth of conversation
   */
  private analyzeInteractionDepth(messages: ConversationMessage[]): number {
    if (messages.length < 2) return 0;

    let depth = 0;
    let consecutiveQuestions = 0;
    let followUpDepth = 0;

    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const previous = messages[i - 1];

      // Detect follow-up questions
      if (current.role === 'user' && previous.role === 'assistant') {
        if (current.content.includes('?')) {
          consecutiveQuestions++;
          followUpDepth += consecutiveQuestions;
        } else {
          consecutiveQuestions = 0;
        }
      }

      // Detect clarification requests
      if (current.content.toLowerCase().includes('what do you mean') ||
          current.content.toLowerCase().includes('can you explain') ||
          current.content.toLowerCase().includes('i don\'t understand')) {
        depth += 15;
      }
    }

    // Calculate final depth score
    depth += followUpDepth * 2;
    depth += Math.min(messages.length * 2, 40); // Conversation length factor

    return Math.min(depth, 100);
  }

  /**
   * Determine if a message is important for context preservation
   */
  private isMessageImportant(message: ConversationMessage, ageGroup: AgeGroup): boolean {
    const content = message.content.toLowerCase();

    // Always keep assistant responses (they contain valuable context)
    if (message.role === 'assistant') {
      return true;
    }

    // Keep questions and important statements
    if (content.includes('?') ||
        content.includes('help') ||
        content.includes('explain') ||
        content.includes('understand') ||
        content.includes('confused')) {
      return true;
    }

    // Keep longer, more substantive messages
    if (message.content.length > 50) {
      return true;
    }

    return false;
  }
}

// Factory function to create token optimization service
export function createTokenOptimizationService(logger: winston.Logger): TokenOptimizationService {
  return new TokenOptimizationService(logger);
}
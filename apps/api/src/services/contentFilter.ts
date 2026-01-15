import winston from 'winston';
import { AgeGroup } from './chatgpt';

// Content filtering interfaces
export interface ContentFilterResult {
  isAppropriate: boolean;
  filteredContent: string;
  violations: ContentViolation[];
  confidence: number; // 0-1, how confident we are in the filtering decision
  warnings: string[];
}

export interface ContentViolation {
  type: ViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  originalText: string;
  suggestedReplacement?: string;
  position?: {
    start: number;
    end: number;
  };
}

export type ViolationType =
  | 'inappropriate_language'
  | 'violence'
  | 'sexual_content'
  | 'hate_speech'
  | 'bullying'
  | 'dangerous_activities'
  | 'personal_information'
  | 'adult_topics'
  | 'complex_language'
  | 'emotional_content'
  | 'commercial_content'
  | 'medical_advice'
  | 'legal_advice';

export interface AgeAppropriatenessConfig {
  ageGroup: AgeGroup;
  maxComplexityScore: number;
  allowedTopics: string[];
  blockedTopics: string[];
  maxSentenceLength: number;
  maxSyllablesPerWord: number;
  requireSimpleLanguage: boolean;
  allowMetaphors: boolean;
  allowAbstractConcepts: boolean;
}

// Age-specific filtering configurations
const AGE_FILTERING_CONFIGS: Record<AgeGroup, AgeAppropriatenessConfig> = {
  'ages6to9': {
    ageGroup: 'ages6to9',
    maxComplexityScore: 30,
    allowedTopics: [
      'basic math', 'simple science', 'animals', 'nature', 'colors', 'shapes',
      'family', 'friends', 'school', 'playground', 'books', 'art', 'music',
      'food', 'weather', 'seasons', 'community helpers', 'transportation'
    ],
    blockedTopics: [
      'death', 'violence', 'adult relationships', 'politics', 'religion',
      'finances', 'complex emotions', 'war', 'disease', 'disasters'
    ],
    maxSentenceLength: 15,
    maxSyllablesPerWord: 3,
    requireSimpleLanguage: true,
    allowMetaphors: false,
    allowAbstractConcepts: false
  },
  'ages10to13': {
    ageGroup: 'ages10to13',
    maxComplexityScore: 60,
    allowedTopics: [
      'math', 'science', 'history', 'geography', 'literature', 'art', 'music',
      'sports', 'technology', 'environment', 'space', 'cultures', 'languages',
      'basic economics', 'friendship', 'teamwork', 'problem solving'
    ],
    blockedTopics: [
      'graphic violence', 'sexual content', 'substance abuse', 'extreme politics',
      'adult financial topics', 'mature relationships', 'conspiracy theories'
    ],
    maxSentenceLength: 25,
    maxSyllablesPerWord: 4,
    requireSimpleLanguage: false,
    allowMetaphors: true,
    allowAbstractConcepts: true
  },
  'ages14to16': {
    ageGroup: 'ages14to16',
    maxComplexityScore: 85,
    allowedTopics: [
      'advanced math', 'sciences', 'history', 'literature', 'philosophy',
      'psychology', 'sociology', 'economics', 'politics', 'current events',
      'career planning', 'college preparation', 'critical thinking',
      'ethics', 'global issues', 'technology', 'innovation'
    ],
    blockedTopics: [
      'graphic violence', 'explicit sexual content', 'substance abuse details',
      'self-harm', 'extreme ideologies', 'illegal activities'
    ],
    maxSentenceLength: 35,
    maxSyllablesPerWord: 6,
    requireSimpleLanguage: false,
    allowMetaphors: true,
    allowAbstractConcepts: true
  }
};

export class ContentFilterService {
  private logger: winston.Logger;
  private profanityPatterns: RegExp[];
  private violencePatterns: RegExp[];
  private adultContentPatterns: RegExp[];
  private personalInfoPatterns: RegExp[];

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.initializeFilteringPatterns();
  }

  /**
   * Initialize regex patterns for content filtering
   */
  private initializeFilteringPatterns(): void {
    // Profanity and inappropriate language patterns
    this.profanityPatterns = [
      /\b(?:damn|hell|stupid|idiot|dumb|shut\s+up)\b/gi,
      /\b(?:hate|sucks|stupid|lame|boring)\b/gi,
      // Add more patterns as needed - keeping family-friendly for educational context
    ];

    // Violence and aggressive content patterns
    this.violencePatterns = [
      /\b(?:kill|murder|death|die|violence|fight|hurt|pain|blood|weapon|gun|knife|bomb)\b/gi,
      /\b(?:attack|assault|beat|punch|kick|hit|strike|wound|injure)\b/gi,
      /\b(?:war|battle|conflict|destroy|annihilate|eliminate)\b/gi
    ];

    // Adult content patterns
    this.adultContentPatterns = [
      /\b(?:sex|sexual|romantic|dating|relationship|love|marriage|divorce)\b/gi,
      /\b(?:alcohol|beer|wine|drunk|drug|cigarette|smoke|gambling)\b/gi,
      /\b(?:money|salary|debt|mortgage|loan|credit|investment|stock)\b/gi
    ];

    // Personal information patterns
    this.personalInfoPatterns = [
      /\b\d{3}-\d{3}-\d{4}\b/g, // 10-digit phone numbers (555-123-4567)
      /\b\d{3}-\d{4}\b/g, // 7-digit phone numbers (555-1234)
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
      /\b\d{1,5}\s\w+\s(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|court|ct|place|pl)\b/gi, // Addresses
      /\b(?:ssn|social\s+security|passport|license)\b/gi // ID documents
    ];
  }

  /**
   * Filter content for age-appropriateness and safety
   */
  async filterContent(
    content: string,
    ageGroup: AgeGroup,
    context?: {
      subject?: string;
      learningObjective?: string;
    }
  ): Promise<ContentFilterResult> {
    const startTime = Date.now();
    const config = AGE_FILTERING_CONFIGS[ageGroup];
    let filteredContent = content;
    const violations: ContentViolation[] = [];
    const warnings: string[] = [];

    try {
      // 1. Check for inappropriate language
      const profanityResult = this.checkProfanity(filteredContent);
      if (profanityResult.violations.length > 0) {
        violations.push(...profanityResult.violations);
        filteredContent = profanityResult.filteredContent;
      }

      // 2. Check for violence and aggressive content
      const violenceResult = this.checkViolence(filteredContent, ageGroup);
      if (violenceResult.violations.length > 0) {
        violations.push(...violenceResult.violations);
        filteredContent = violenceResult.filteredContent;
      }

      // 3. Check for adult content
      const adultContentResult = this.checkAdultContent(filteredContent, ageGroup);
      if (adultContentResult.violations.length > 0) {
        violations.push(...adultContentResult.violations);
        filteredContent = adultContentResult.filteredContent;
      }

      // 4. Check for personal information
      const personalInfoResult = this.checkPersonalInformation(filteredContent);
      if (personalInfoResult.violations.length > 0) {
        violations.push(...personalInfoResult.violations);
        filteredContent = personalInfoResult.filteredContent;
      }

      // 5. Check language complexity
      const complexityResult = this.checkLanguageComplexity(filteredContent, config);
      if (complexityResult.violations.length > 0) {
        violations.push(...complexityResult.violations);
        // Always add warning for complexity issues
        warnings.push(`Content may be too complex for ${ageGroup}`);
        // Only filter content for critical complexity issues
        if (complexityResult.severity === 'critical') {
          filteredContent = complexityResult.filteredContent;
        }
      }

      // 6. Check topic appropriateness
      const topicResult = this.checkTopicAppropriateness(filteredContent, config, context);
      if (topicResult.violations.length > 0) {
        violations.push(...topicResult.violations);
      }

      // 7. Check emotional content
      const emotionalResult = this.checkEmotionalContent(filteredContent, ageGroup);
      if (emotionalResult.violations.length > 0) {
        violations.push(...emotionalResult.violations);
        warnings.push(...emotionalResult.warnings);
      }

      // Calculate overall appropriateness
      const criticalViolations = violations.filter(v => v.severity === 'critical').length;
      const highViolations = violations.filter(v => v.severity === 'high').length;
      const isAppropriate = criticalViolations === 0 && highViolations === 0;

      // Calculate confidence score
      const confidence = this.calculateConfidence(content, violations, ageGroup);

      const processingTime = Date.now() - startTime;
      this.logger.debug(`Content filtering completed in ${processingTime}ms for ${ageGroup}`, {
        originalLength: content.length,
        filteredLength: filteredContent.length,
        violationsCount: violations.length,
        isAppropriate,
        confidence
      });

      return {
        isAppropriate,
        filteredContent,
        violations,
        confidence,
        warnings
      };

    } catch (error) {
      this.logger.error('Content filtering failed:', error);

      // Fail-safe: mark as inappropriate if filtering fails
      return {
        isAppropriate: false,
        filteredContent: "I'm sorry, but I can't provide a response right now. Please try asking your question in a different way.",
        violations: [{
          type: 'adult_topics',
          severity: 'critical',
          description: 'Content filtering error - response blocked for safety',
          originalText: content
        }],
        confidence: 0,
        warnings: ['Content filtering service encountered an error']
      };
    }
  }

  /**
   * Check for profanity and inappropriate language
   */
  private checkProfanity(content: string): {
    violations: ContentViolation[];
    filteredContent: string;
  } {
    const violations: ContentViolation[] = [];
    let filteredContent = content;

    for (const pattern of this.profanityPatterns) {
      const matches = Array.from(content.matchAll(pattern));

      for (const match of matches) {
        violations.push({
          type: 'inappropriate_language',
          severity: 'medium',
          description: 'Inappropriate language detected',
          originalText: match[0],
          suggestedReplacement: '[inappropriate word]',
          position: {
            start: match.index!,
            end: match.index! + match[0].length
          }
        });

        // Replace with more appropriate alternatives
        filteredContent = filteredContent.replace(match[0], this.getAlternativeWord(match[0]));
      }
    }

    return { violations, filteredContent };
  }

  /**
   * Check for violence and aggressive content
   */
  private checkViolence(content: string, ageGroup: AgeGroup): {
    violations: ContentViolation[];
    filteredContent: string;
  } {
    const violations: ContentViolation[] = [];
    let filteredContent = content;

    for (const pattern of this.violencePatterns) {
      const matches = Array.from(content.matchAll(pattern));

      for (const match of matches) {
        const severity = this.getViolenceSeverity(match[0], ageGroup);

        violations.push({
          type: 'violence',
          severity,
          description: `Violence-related content: "${match[0]}"`,
          originalText: match[0],
          position: {
            start: match.index!,
            end: match.index! + match[0].length
          }
        });

        if (severity === 'high' || severity === 'critical') {
          filteredContent = filteredContent.replace(match[0], '[removed]');
        }
      }
    }

    return { violations, filteredContent };
  }

  /**
   * Check for adult content
   */
  private checkAdultContent(content: string, ageGroup: AgeGroup): {
    violations: ContentViolation[];
    filteredContent: string;
  } {
    const violations: ContentViolation[] = [];
    let filteredContent = content;

    for (const pattern of this.adultContentPatterns) {
      const matches = Array.from(content.matchAll(pattern));

      for (const match of matches) {
        const severity = this.getAdultContentSeverity(match[0], ageGroup);

        violations.push({
          type: 'adult_topics',
          severity,
          description: `Adult content detected: "${match[0]}"`,
          originalText: match[0],
          position: {
            start: match.index!,
            end: match.index! + match[0].length
          }
        });

        if (severity === 'high' || severity === 'critical') {
          filteredContent = filteredContent.replace(match[0], '[removed]');
        }
      }
    }

    return { violations, filteredContent };
  }

  /**
   * Check for personal information
   */
  private checkPersonalInformation(content: string): {
    violations: ContentViolation[];
    filteredContent: string;
  } {
    const violations: ContentViolation[] = [];
    let filteredContent = content;

    for (const pattern of this.personalInfoPatterns) {
      const matches = Array.from(content.matchAll(pattern));

      for (const match of matches) {
        violations.push({
          type: 'personal_information',
          severity: 'critical',
          description: 'Personal information detected and removed',
          originalText: match[0],
          suggestedReplacement: '[personal information removed]',
          position: {
            start: match.index!,
            end: match.index! + match[0].length
          }
        });

        filteredContent = filteredContent.replace(match[0], '[personal information removed]');
      }
    }

    return { violations, filteredContent };
  }

  /**
   * Check language complexity against age-appropriate standards
   */
  private checkLanguageComplexity(content: string, config: AgeAppropriatenessConfig): {
    violations: ContentViolation[];
    filteredContent: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  } {
    const violations: ContentViolation[] = [];
    let filteredContent = content;

    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);

    let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check sentence length
    for (const sentence of sentences) {
      const wordCount = sentence.trim().split(/\s+/).length;
      if (wordCount > config.maxSentenceLength) {
        const severity = wordCount > config.maxSentenceLength * 1.5 ? 'high' : 'medium';
        maxSeverity = this.getMaxSeverity(maxSeverity, severity);

        violations.push({
          type: 'complex_language',
          severity,
          description: `Sentence too long for ${config.ageGroup}: ${wordCount} words (max: ${config.maxSentenceLength})`,
          originalText: sentence.trim()
        });
      }
    }

    // Check word complexity
    for (const word of words) {
      const syllableCount = this.countSyllables(word);
      if (syllableCount > config.maxSyllablesPerWord) {
        // Adjust severity thresholds to be less aggressive
        let severity: 'low' | 'medium' | 'high' | 'critical';
        if (syllableCount > config.maxSyllablesPerWord * 2.5) {
          severity = 'critical'; // Only extreme cases (7+ syllables for ages6to9)
        } else if (syllableCount > config.maxSyllablesPerWord * 2) {
          severity = 'high'; // 6+ syllables for ages6to9
        } else if (syllableCount > config.maxSyllablesPerWord * 1.5) {
          severity = 'medium'; // 4-5 syllables for ages6to9
        } else {
          severity = 'low'; // 4 syllables for ages6to9
        }
        maxSeverity = this.getMaxSeverity(maxSeverity, severity);

        violations.push({
          type: 'complex_language',
          severity,
          description: `Word too complex for ${config.ageGroup}: "${word}" (${syllableCount} syllables, max: ${config.maxSyllablesPerWord})`,
          originalText: word
        });
      }
    }

    return { violations, filteredContent, severity: maxSeverity };
  }

  /**
   * Check topic appropriateness
   */
  private checkTopicAppropriateness(
    content: string,
    config: AgeAppropriatenessConfig,
    context?: { subject?: string; learningObjective?: string; }
  ): {
    violations: ContentViolation[];
  } {
    const violations: ContentViolation[] = [];
    const contentLower = content.toLowerCase();

    // Check for blocked topics
    for (const blockedTopic of config.blockedTopics) {
      if (contentLower.includes(blockedTopic.toLowerCase())) {
        violations.push({
          type: 'adult_topics',
          severity: 'high',
          description: `Blocked topic detected for ${config.ageGroup}: "${blockedTopic}"`,
          originalText: blockedTopic
        });
      }
    }

    return { violations };
  }

  /**
   * Check emotional content appropriateness
   */
  private checkEmotionalContent(content: string, ageGroup: AgeGroup): {
    violations: ContentViolation[];
    warnings: string[];
  } {
    const violations: ContentViolation[] = [];
    const warnings: string[] = [];

    const emotionalPatterns = {
      fear: /\b(?:scared|afraid|terrified|frightened|panic|terror|nightmare)\b/gi,
      sadness: /\b(?:sad|depressed|crying|tears|grief|mourning|devastated)\b/gi,
      anger: /\b(?:angry|furious|rage|mad|hate|annoyed|frustrated)\b/gi,
      anxiety: /\b(?:worried|anxious|nervous|stress|overwhelmed|panic)\b/gi
    };

    for (const [emotion, pattern] of Object.entries(emotionalPatterns)) {
      const matches = Array.from(content.matchAll(pattern));

      if (matches.length > 0) {
        if (ageGroup === 'ages6to9' && matches.length > 1) {
          violations.push({
            type: 'emotional_content',
            severity: 'medium',
            description: `Multiple instances of ${emotion}-related content may be inappropriate for young children`,
            originalText: matches.map(m => m[0]).join(', ')
          });
        } else if (matches.length > 2) {
          warnings.push(`Content contains significant ${emotion}-related themes`);
        }
      }
    }

    return { violations, warnings };
  }

  /**
   * Get alternative word for inappropriate content
   */
  private getAlternativeWord(word: string): string {
    const alternatives: Record<string, string> = {
      'stupid': 'silly',
      'dumb': 'confused',
      'idiot': 'person',
      'hate': 'dislike',
      'sucks': 'is not great',
      'shut up': 'please be quiet',
      'damn': 'oh no',
      'hell': 'heck'
    };

    return alternatives[word.toLowerCase()] || '[inappropriate word]';
  }

  /**
   * Determine violence severity based on age group
   */
  private getViolenceSeverity(word: string, ageGroup: AgeGroup): 'low' | 'medium' | 'high' | 'critical' {
    const wordLower = word.toLowerCase();

    const highViolenceWords = ['kill', 'murder', 'death', 'blood', 'weapon', 'gun', 'knife', 'bomb'];
    const mediumViolenceWords = ['fight', 'hurt', 'pain', 'attack', 'assault', 'battle'];
    const warRelatedWords = ['war', 'conflict']; // Special handling for war-related topics

    if (highViolenceWords.includes(wordLower)) {
      return ageGroup === 'ages6to9' ? 'critical' : ageGroup === 'ages10to13' ? 'high' : 'medium';
    }

    if (mediumViolenceWords.includes(wordLower)) {
      return ageGroup === 'ages6to9' ? 'high' : 'medium';
    }

    // War-related content is more sensitive for younger ages
    if (warRelatedWords.includes(wordLower)) {
      return ageGroup === 'ages6to9' ? 'high' : ageGroup === 'ages10to13' ? 'high' : 'medium';
    }

    return 'low';
  }

  /**
   * Determine adult content severity based on age group
   */
  private getAdultContentSeverity(word: string, ageGroup: AgeGroup): 'low' | 'medium' | 'high' | 'critical' {
    const wordLower = word.toLowerCase();

    const criticalWords = ['sex', 'sexual', 'drug', 'alcohol', 'gambling'];
    const highWords = ['romantic', 'dating', 'marriage', 'divorce'];
    const basicEconomicsWords = ['money', 'debt', 'credit', 'investment']; // Educational financial terms

    if (criticalWords.includes(wordLower)) {
      return ageGroup === 'ages6to9' ? 'critical' : ageGroup === 'ages10to13' ? 'high' : 'medium';
    }

    if (highWords.includes(wordLower)) {
      return ageGroup === 'ages6to9' ? 'high' : ageGroup === 'ages10to13' ? 'medium' : 'low';
    }

    // Basic economics terms are more lenient for ages10to13 and up
    if (basicEconomicsWords.includes(wordLower)) {
      return ageGroup === 'ages6to9' ? 'high' : 'low'; // Skip medium for ages10to13+
    }

    return 'low';
  }

  /**
   * Count syllables in a word (approximate)
   */
  private countSyllables(word: string): number {
    if (word.length <= 3) return 1;

    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length === 0) return 0;

    // Count vowel groups
    const vowelGroups = word.match(/[aeiouy]+/g);
    let syllables = vowelGroups ? vowelGroups.length : 0;

    // Adjust for silent e
    if (word.endsWith('e') && syllables > 1) {
      syllables--;
    }

    // Minimum of 1 syllable
    return Math.max(1, syllables);
  }

  /**
   * Get the maximum severity level
   */
  private getMaxSeverity(
    current: 'low' | 'medium' | 'high' | 'critical',
    newSeverity: 'low' | 'medium' | 'high' | 'critical'
  ): 'low' | 'medium' | 'high' | 'critical' {
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const currentIndex = severityOrder.indexOf(current);
    const newIndex = severityOrder.indexOf(newSeverity);

    return severityOrder[Math.max(currentIndex, newIndex)] as 'low' | 'medium' | 'high' | 'critical';
  }

  /**
   * Calculate confidence score for filtering decision
   */
  private calculateConfidence(
    content: string,
    violations: ContentViolation[],
    ageGroup: AgeGroup
  ): number {
    let confidence = 1.0;

    // Reduce confidence based on content length (harder to analyze very short/long content)
    if (content.length < 20) confidence -= 0.1;
    if (content.length > 1000) confidence -= 0.1;

    // Reduce confidence based on violation counts and severity
    const criticalViolations = violations.filter(v => v.severity === 'critical').length;
    const highViolations = violations.filter(v => v.severity === 'high').length;
    const mediumViolations = violations.filter(v => v.severity === 'medium').length;
    const lowViolations = violations.filter(v => v.severity === 'low').length;

    confidence -= criticalViolations * 0.3;
    confidence -= highViolations * 0.2;
    confidence -= mediumViolations * 0.1;
    confidence -= lowViolations * 0.05;

    // Additional penalty for multiple violations of any type
    if (violations.length > 3) confidence -= 0.1;
    if (violations.length > 6) confidence -= 0.1;

    // Increase confidence for clear content
    if (violations.length === 0) confidence = Math.min(1.0, confidence + 0.1);

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Get filtering statistics
   */
  public getFilteringStats(): {
    patternsLoaded: number;
    ageGroupsSupported: number;
  } {
    return {
      patternsLoaded: this.profanityPatterns.length +
                     this.violencePatterns.length +
                     this.adultContentPatterns.length +
                     this.personalInfoPatterns.length,
      ageGroupsSupported: Object.keys(AGE_FILTERING_CONFIGS).length
    };
  }
}

// Factory function to create content filter service
export function createContentFilterService(logger: winston.Logger): ContentFilterService {
  return new ContentFilterService(logger);
}
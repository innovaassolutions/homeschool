import winston from 'winston';
import { AgeGroup } from './chatgpt';

export interface SanitizationResult {
  sanitizedContent: string;
  warnings: string[];
  blocked: boolean;
  modifications: SanitizationModification[];
  safetyScore: number; // 0-1, higher is safer
}

export interface SanitizationModification {
  type: 'removal' | 'replacement' | 'warning_added';
  originalText: string;
  newText: string;
  reason: string;
  position?: {
    start: number;
    end: number;
  };
}

export interface SafetyCheckConfig {
  ageGroup: AgeGroup;
  strictMode: boolean;
  allowEducationalExceptions: boolean;
  parentalControls: {
    blockSensitiveTopics: boolean;
    requireApprovalForComplexTopics: boolean;
    monitorEmotionalContent: boolean;
  };
}

export class ResponseSanitizationService {
  private logger: winston.Logger;
  private emergencyContactPatterns: RegExp[];
  private webUrlPatterns: RegExp[];
  private harmfulInstructionPatterns: RegExp[];
  private medicalAdvicePatterns: RegExp[];
  private legalAdvicePatterns: RegExp[];

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.initializeSanitizationPatterns();
  }

  /**
   * Initialize patterns for response sanitization
   */
  private initializeSanitizationPatterns(): void {
    // Emergency contact information patterns
    this.emergencyContactPatterns = [
      /\b(call\s+)?911\b/gi,
      /\bemergency\s+services?\b/gi,
      /\bpolice\s+(station|department)?\b/gi,
      /\bfire\s+(department|station)?\b/gi,
      /\bambulance\b/gi,
      /\bpoison\s+control\b/gi
    ];

    // Web URL patterns (to control external links)
    this.webUrlPatterns = [
      /https?:\/\/[^\s]+/gi,
      /www\.[^\s]+/gi,
      /\b[a-zA-Z0-9.-]+\.(com|org|net|edu|gov|mil)\b/gi
    ];

    // Harmful instruction patterns
    this.harmfulInstructionPatterns = [
      /\bhow\s+to\s+(make|build|create).*(weapon|bomb|explosive|poison|drug)\b/gi,
      /\bdo\s+not\s+tell\s+(anyone|parents|teachers|adults)\b/gi,
      /\bkeep\s+(this\s+)?(secret|private)\s+(from|between)\b/gi,
      /\bmeet\s+(me|us)\s+(somewhere|anywhere|privately)\b/gi,
      /\bshare\s+your\s+(address|location|personal|private)\b/gi
    ];

    // Medical advice patterns (only allow general health education)
    this.medicalAdvicePatterns = [
      /\byou\s+(should|need\s+to|must)\s+(take|stop\s+taking|increase|decrease).*(medicine|medication|pill|drug)\b/gi,
      /\bdiagnosis\s+is\b/gi,
      /\byou\s+(have|might\s+have|probably\s+have).*(disease|illness|condition|disorder)\b/gi,
      /\bseek\s+immediate\s+medical\s+attention\b/gi,
      /\bgo\s+to\s+the\s+(hospital|emergency\s+room|er)\b/gi
    ];

    // Legal advice patterns
    this.legalAdvicePatterns = [
      /\byou\s+(should|need\s+to|must)\s+(sue|file\s+a\s+lawsuit|press\s+charges)\b/gi,
      /\bthis\s+is\s+(illegal|against\s+the\s+law|a\s+crime)\b/gi,
      /\byour\s+legal\s+rights?\s+(are|include)\b/gi,
      /\bconsult\s+a\s+lawyer\b/gi
    ];
  }

  /**
   * Sanitize response content for safety and appropriateness
   */
  public async sanitizeResponse(
    content: string,
    config: SafetyCheckConfig
  ): Promise<SanitizationResult> {
    const modifications: SanitizationModification[] = [];
    const warnings: string[] = [];
    let sanitizedContent = content;
    let blocked = false;

    try {
      // 1. Remove emergency contact information (except educational context)
      const emergencyResult = this.checkEmergencyContent(sanitizedContent, config);
      if (emergencyResult.modifications.length > 0) {
        modifications.push(...emergencyResult.modifications);
        sanitizedContent = emergencyResult.content;
        if (emergencyResult.shouldBlock) {
          blocked = true;
        }
      }

      // 2. Handle web URLs and external links
      const urlResult = this.sanitizeUrls(sanitizedContent, config);
      if (urlResult.modifications.length > 0) {
        modifications.push(...urlResult.modifications);
        sanitizedContent = urlResult.content;
        warnings.push(...urlResult.warnings);
      }

      // 3. Check for harmful instructions
      const harmfulResult = this.checkHarmfulInstructions(sanitizedContent, config);
      if (harmfulResult.modifications.length > 0) {
        modifications.push(...harmfulResult.modifications);
        sanitizedContent = harmfulResult.content;
        if (harmfulResult.shouldBlock) {
          blocked = true;
        }
      }

      // 4. Sanitize medical advice
      const medicalResult = this.sanitizeMedicalAdvice(sanitizedContent, config);
      if (medicalResult.modifications.length > 0) {
        modifications.push(...medicalResult.modifications);
        sanitizedContent = medicalResult.content;
        warnings.push(...medicalResult.warnings);
      }

      // 5. Sanitize legal advice
      const legalResult = this.sanitizeLegalAdvice(sanitizedContent, config);
      if (legalResult.modifications.length > 0) {
        modifications.push(...legalResult.modifications);
        sanitizedContent = legalResult.content;
        warnings.push(...legalResult.warnings);
      }

      // 6. Check for age-inappropriate complexity
      const complexityResult = this.checkResponseComplexity(sanitizedContent, config);
      if (complexityResult.modifications.length > 0) {
        modifications.push(...complexityResult.modifications);
        warnings.push(...complexityResult.warnings);
      }

      // 7. Add educational disclaimers if needed
      const disclaimerResult = this.addEducationalDisclaimers(sanitizedContent, config, modifications);
      sanitizedContent = disclaimerResult.content;
      if (disclaimerResult.modifications.length > 0) {
        modifications.push(...disclaimerResult.modifications);
      }

      // Calculate safety score
      const safetyScore = this.calculateSafetyScore(content, sanitizedContent, modifications, config);

      // Final safety check
      if (safetyScore < 0.5) {
        blocked = true;
        this.logger.warn('Response blocked due to low safety score', {
          safetyScore,
          modificationsCount: modifications.length,
          ageGroup: config.ageGroup
        });
      }

      return {
        sanitizedContent: blocked ? this.generateSafetyFallback(config.ageGroup) : sanitizedContent,
        warnings,
        blocked,
        modifications,
        safetyScore
      };

    } catch (error) {
      this.logger.error('Response sanitization failed:', error);

      return {
        sanitizedContent: this.generateSafetyFallback(config.ageGroup),
        warnings: ['Content sanitization error'],
        blocked: true,
        modifications: [{
          type: 'replacement',
          originalText: content,
          newText: this.generateSafetyFallback(config.ageGroup),
          reason: 'Sanitization service error - blocked for safety'
        }],
        safetyScore: 0
      };
    }
  }

  /**
   * Check for emergency contact information
   */
  private checkEmergencyContent(content: string, config: SafetyCheckConfig): {
    content: string;
    modifications: SanitizationModification[];
    shouldBlock: boolean;
  } {
    const modifications: SanitizationModification[] = [];
    let sanitizedContent = content;
    let shouldBlock = false;

    for (const pattern of this.emergencyContactPatterns) {
      const matches = Array.from(content.matchAll(pattern));

      for (const match of matches) {
        // Allow educational mentions in appropriate contexts
        const context = content.substring(Math.max(0, match.index! - 50), match.index! + match[0].length + 50);
        const isEducational = /\b(learn|know|emergency|safety|important|remember)\b/i.test(context);

        if (!isEducational || config.ageGroup === 'ages6to9') {
          modifications.push({
            type: 'replacement',
            originalText: match[0],
            newText: '[emergency contact information]',
            reason: 'Emergency contact information removed for safety',
            position: {
              start: match.index!,
              end: match.index! + match[0].length
            }
          });

          sanitizedContent = sanitizedContent.replace(match[0], '[emergency contact information]');

          if (config.ageGroup === 'ages6to9') {
            shouldBlock = true;
          }
        }
      }
    }

    return { content: sanitizedContent, modifications, shouldBlock };
  }

  /**
   * Sanitize URLs and external links
   */
  private sanitizeUrls(content: string, config: SafetyCheckConfig): {
    content: string;
    modifications: SanitizationModification[];
    warnings: string[];
  } {
    const modifications: SanitizationModification[] = [];
    const warnings: string[] = [];
    let sanitizedContent = content;

    for (const pattern of this.webUrlPatterns) {
      const matches = Array.from(content.matchAll(pattern));

      for (const match of matches) {
        // For younger children, remove all URLs
        if (config.ageGroup === 'ages6to9' || config.parentalControls.blockSensitiveTopics) {
          modifications.push({
            type: 'replacement',
            originalText: match[0],
            newText: '[website link removed]',
            reason: 'External links removed for safety',
            position: {
              start: match.index!,
              end: match.index! + match[0].length
            }
          });

          sanitizedContent = sanitizedContent.replace(match[0], '[website link removed]');
        } else {
          // For older children, add warning
          warnings.push('Response contains external links - parental guidance recommended');
        }
      }
    }

    return { content: sanitizedContent, modifications, warnings };
  }

  /**
   * Check for harmful instructions
   */
  private checkHarmfulInstructions(content: string, config: SafetyCheckConfig): {
    content: string;
    modifications: SanitizationModification[];
    shouldBlock: boolean;
  } {
    const modifications: SanitizationModification[] = [];
    let sanitizedContent = content;
    let shouldBlock = false;

    for (const pattern of this.harmfulInstructionPatterns) {
      const matches = Array.from(content.matchAll(pattern));

      for (const match of matches) {
        modifications.push({
          type: 'removal',
          originalText: match[0],
          newText: '',
          reason: 'Harmful instruction removed',
          position: {
            start: match.index!,
            end: match.index! + match[0].length
          }
        });

        sanitizedContent = sanitizedContent.replace(match[0], '');
        shouldBlock = true;
      }
    }

    return { content: sanitizedContent, modifications, shouldBlock };
  }

  /**
   * Sanitize medical advice
   */
  private sanitizeMedicalAdvice(content: string, config: SafetyCheckConfig): {
    content: string;
    modifications: SanitizationModification[];
    warnings: string[];
  } {
    const modifications: SanitizationModification[] = [];
    const warnings: string[] = [];
    let sanitizedContent = content;

    for (const pattern of this.medicalAdvicePatterns) {
      const matches = Array.from(content.matchAll(pattern));

      for (const match of matches) {
        modifications.push({
          type: 'replacement',
          originalText: match[0],
          newText: '[medical information - consult healthcare provider]',
          reason: 'Medical advice replaced with general guidance',
          position: {
            start: match.index!,
            end: match.index! + match[0].length
          }
        });

        sanitizedContent = sanitizedContent.replace(match[0], '[medical information - consult healthcare provider]');
        warnings.push('Medical advice detected and sanitized');
      }
    }

    return { content: sanitizedContent, modifications, warnings };
  }

  /**
   * Sanitize legal advice
   */
  private sanitizeLegalAdvice(content: string, config: SafetyCheckConfig): {
    content: string;
    modifications: SanitizationModification[];
    warnings: string[];
  } {
    const modifications: SanitizationModification[] = [];
    const warnings: string[] = [];
    let sanitizedContent = content;

    for (const pattern of this.legalAdvicePatterns) {
      const matches = Array.from(content.matchAll(pattern));

      for (const match of matches) {
        modifications.push({
          type: 'replacement',
          originalText: match[0],
          newText: '[legal information - consult legal professional]',
          reason: 'Legal advice replaced with general guidance',
          position: {
            start: match.index!,
            end: match.index! + match[0].length
          }
        });

        sanitizedContent = sanitizedContent.replace(match[0], '[legal information - consult legal professional]');
        warnings.push('Legal advice detected and sanitized');
      }
    }

    return { content: sanitizedContent, modifications, warnings };
  }

  /**
   * Check response complexity for age appropriateness
   */
  private checkResponseComplexity(content: string, config: SafetyCheckConfig): {
    modifications: SanitizationModification[];
    warnings: string[];
  } {
    const modifications: SanitizationModification[] = [];
    const warnings: string[] = [];

    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);

    // Check sentence length
    const longSentences = sentences.filter(s => {
      const wordCount = s.trim().split(/\s+/).length;
      const maxWords = config.ageGroup === 'ages6to9' ? 15 : config.ageGroup === 'ages10to13' ? 25 : 35;
      return wordCount > maxWords;
    });

    if (longSentences.length > 0) {
      warnings.push(`Response contains ${longSentences.length} complex sentences for ${config.ageGroup}`);
    }

    // Check vocabulary complexity
    const complexWords = words.filter(word => {
      const maxSyllables = config.ageGroup === 'ages6to9' ? 3 : config.ageGroup === 'ages10to13' ? 4 : 6;
      return this.countSyllables(word) > maxSyllables;
    });

    if (complexWords.length > words.length * 0.1) {
      warnings.push(`Response may contain vocabulary too complex for ${config.ageGroup}`);
    }

    return { modifications, warnings };
  }

  /**
   * Add educational disclaimers where appropriate
   */
  private addEducationalDisclaimers(
    content: string,
    config: SafetyCheckConfig,
    existingModifications: SanitizationModification[]
  ): {
    content: string;
    modifications: SanitizationModification[];
  } {
    const modifications: SanitizationModification[] = [];
    let disclaimerContent = content;

    // Add disclaimer if medical or legal content was sanitized
    const hasMedicalSanitization = existingModifications.some(m => m.reason.includes('medical'));
    const hasLegalSanitization = existingModifications.some(m => m.reason.includes('legal'));

    if (hasMedicalSanitization) {
      const disclaimer = '\n\nRemember: This is for learning only. Always ask a doctor or nurse about health questions!';
      disclaimerContent += disclaimer;
      modifications.push({
        type: 'warning_added',
        originalText: '',
        newText: disclaimer,
        reason: 'Medical disclaimer added for safety'
      });
    }

    if (hasLegalSanitization) {
      const disclaimer = '\n\nRemember: This is for learning only. Always ask a grown-up about legal questions!';
      disclaimerContent += disclaimer;
      modifications.push({
        type: 'warning_added',
        originalText: '',
        newText: disclaimer,
        reason: 'Legal disclaimer added for safety'
      });
    }

    return { content: disclaimerContent, modifications };
  }

  /**
   * Calculate safety score for the response
   */
  private calculateSafetyScore(
    originalContent: string,
    sanitizedContent: string,
    modifications: SanitizationModification[],
    config: SafetyCheckConfig
  ): number {
    let score = 1.0;

    // Reduce score based on modifications
    const criticalModifications = modifications.filter(m =>
      m.reason.includes('harmful') || m.reason.includes('emergency')
    ).length;

    const warningModifications = modifications.filter(m =>
      m.reason.includes('medical') || m.reason.includes('legal')
    ).length;

    score -= criticalModifications * 0.3;
    score -= warningModifications * 0.1;

    // Reduce score if significant content was removed
    const contentReduction = (originalContent.length - sanitizedContent.length) / originalContent.length;
    if (contentReduction > 0.2) {
      score -= contentReduction * 0.5;
    }

    // Age-specific adjustments
    if (config.ageGroup === 'ages6to9' && modifications.length > 0) {
      score -= 0.2; // More strict for younger children
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Generate safety fallback message
   */
  private generateSafetyFallback(ageGroup: AgeGroup): string {
    const fallbacks = {
      'ages6to9': "I want to make sure my answer is perfect for you! Let's try a different question about learning. What would you like to know?",
      'ages10to13': "I need to be extra careful about my responses to keep our conversation safe and educational. Could you ask your question in a different way?",
      'ages14to16': "I want to ensure our conversation stays focused on safe, educational topics. Please rephrase your question or try a different approach."
    };

    return fallbacks[ageGroup];
  }

  /**
   * Count syllables in a word (simplified)
   */
  private countSyllables(word: string): number {
    if (word.length <= 3) return 1;

    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length === 0) return 0;

    const vowelGroups = word.match(/[aeiouy]+/g);
    let syllables = vowelGroups ? vowelGroups.length : 0;

    if (word.endsWith('e') && syllables > 1) {
      syllables--;
    }

    return Math.max(1, syllables);
  }

  /**
   * Get sanitization statistics
   */
  public getSanitizationStats(): {
    patternsLoaded: number;
  } {
    return {
      patternsLoaded: this.emergencyContactPatterns.length +
                     this.webUrlPatterns.length +
                     this.harmfulInstructionPatterns.length +
                     this.medicalAdvicePatterns.length +
                     this.legalAdvicePatterns.length
    };
  }
}

// Factory function
export function createResponseSanitizationService(logger: winston.Logger): ResponseSanitizationService {
  return new ResponseSanitizationService(logger);
}
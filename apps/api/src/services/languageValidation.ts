import winston from 'winston';
import { AgeGroup } from './chatgpt';

export interface LanguageValidationResult {
  isAppropriate: boolean;
  readabilityScore: number;
  complexityLevel: 'very_easy' | 'easy' | 'medium' | 'hard' | 'very_hard';
  adjustedContent: string;
  suggestions: LanguageSuggestion[];
  metrics: LanguageMetrics;
}

export interface LanguageSuggestion {
  type: 'vocabulary' | 'sentence_structure' | 'concept_simplification' | 'tone_adjustment';
  description: string;
  originalText: string;
  suggestedText: string;
  priority: 'low' | 'medium' | 'high';
}

export interface LanguageMetrics {
  averageWordsPerSentence: number;
  averageSyllablesPerWord: number;
  vocabularyComplexity: number;
  sentenceComplexity: number;
  conceptualComplexity: number;
  readingLevel: string;
  timeToReadSeconds: number;
}

export interface AgeLanguageStandards {
  ageGroup: AgeGroup;
  maxWordsPerSentence: number;
  maxSyllablesPerWord: number;
  preferredVocabulary: string[];
  avoidVocabulary: string[];
  complexConceptsAllowed: boolean;
  abstractThinkingAllowed: boolean;
  targetReadingLevel: string;
  maxParagraphLength: number;
}

// Age-specific language standards
const AGE_LANGUAGE_STANDARDS: Record<AgeGroup, AgeLanguageStandards> = {
  'ages6to9': {
    ageGroup: 'ages6to9',
    maxWordsPerSentence: 10,
    maxSyllablesPerWord: 2,
    preferredVocabulary: [
      'big', 'small', 'happy', 'sad', 'fun', 'easy', 'hard', 'good', 'bad', 'nice',
      'help', 'play', 'learn', 'try', 'make', 'do', 'see', 'look', 'find', 'know',
      'like', 'love', 'want', 'need', 'get', 'give', 'take', 'put', 'come', 'go'
    ],
    avoidVocabulary: [
      'analyze', 'synthesize', 'hypothesize', 'contemplate', 'elaborate', 'distinguish',
      'fundamental', 'comprehensive', 'simultaneously', 'consequently', 'nevertheless',
      'furthermore', 'specifically', 'particularly', 'approximately', 'significantly'
    ],
    complexConceptsAllowed: false,
    abstractThinkingAllowed: false,
    targetReadingLevel: '1st-3rd Grade',
    maxParagraphLength: 3
  },
  'ages10to13': {
    ageGroup: 'ages10to13',
    maxWordsPerSentence: 15,
    maxSyllablesPerWord: 3,
    preferredVocabulary: [
      'understand', 'explain', 'describe', 'compare', 'different', 'similar',
      'important', 'interesting', 'problem', 'solution', 'reason', 'because',
      'example', 'idea', 'thought', 'opinion', 'fact', 'true', 'false', 'correct'
    ],
    avoidVocabulary: [
      'synthesize', 'hypothesize', 'paradigm', 'comprehensive', 'simultaneously',
      'fundamental', 'sophisticated', 'consequently', 'nevertheless', 'furthermore'
    ],
    complexConceptsAllowed: true,
    abstractThinkingAllowed: true,
    targetReadingLevel: '4th-6th Grade',
    maxParagraphLength: 5
  },
  'ages14to16': {
    ageGroup: 'ages14to16',
    maxWordsPerSentence: 20,
    maxSyllablesPerWord: 4,
    preferredVocabulary: [
      'analyze', 'evaluate', 'synthesize', 'interpret', 'demonstrate', 'illustrate',
      'examine', 'investigate', 'determine', 'establish', 'construct', 'develop',
      'significant', 'relevant', 'appropriate', 'effective', 'efficient', 'logical'
    ],
    avoidVocabulary: [
      // Fewer restrictions, but still avoid overly academic jargon
      'paradigmatic', 'epistemological', 'ontological', 'phenomenological',
      'heuristic', 'dialectical', 'hermeneutic', 'teleological'
    ],
    complexConceptsAllowed: true,
    abstractThinkingAllowed: true,
    targetReadingLevel: '7th-9th Grade',
    maxParagraphLength: 8
  }
};

export class LanguageValidationService {
  private logger: winston.Logger;
  private commonWords: Set<string>;
  private academicWords: Set<string>;
  private simpleWords: Set<string>;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.initializeWordLists();
  }

  /**
   * Initialize word lists for vocabulary complexity analysis
   */
  private initializeWordLists(): void {
    // Most common English words (simple vocabulary)
    this.simpleWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
      'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will',
      'with', 'you', 'your', 'have', 'they', 'we', 'she', 'her', 'his', 'him',
      'me', 'my', 'our', 'us', 'them', 'their', 'this', 'these', 'those', 'what',
      'where', 'when', 'why', 'how', 'can', 'could', 'would', 'should', 'may',
      'might', 'must', 'do', 'does', 'did', 'go', 'goes', 'went', 'get', 'got',
      'make', 'made', 'take', 'took', 'come', 'came', 'see', 'saw', 'know', 'knew',
      'think', 'thought', 'say', 'said', 'tell', 'told', 'ask', 'asked', 'work',
      'worked', 'play', 'played', 'help', 'helped', 'want', 'wanted', 'need',
      'needed', 'like', 'liked', 'love', 'loved', 'big', 'small', 'good', 'bad',
      'happy', 'sad', 'fun', 'easy', 'hard', 'new', 'old', 'young', 'fast', 'slow'
    ]);

    // Common words for general use
    this.commonWords = new Set([
      'about', 'above', 'across', 'after', 'again', 'against', 'all', 'almost',
      'alone', 'along', 'already', 'also', 'although', 'always', 'among', 'another',
      'any', 'anyone', 'anything', 'anywhere', 'around', 'because', 'become', 'before',
      'began', 'begin', 'being', 'below', 'between', 'both', 'bring', 'brought',
      'called', 'change', 'children', 'complete', 'country', 'course', 'during',
      'each', 'early', 'every', 'example', 'family', 'feel', 'find', 'first',
      'found', 'friend', 'give', 'great', 'group', 'hand', 'head', 'high',
      'home', 'house', 'however', 'important', 'information', 'interest', 'large',
      'last', 'later', 'learn', 'least', 'leave', 'left', 'less', 'let',
      'life', 'line', 'little', 'long', 'look', 'made', 'many', 'member',
      'might', 'money', 'month', 'more', 'most', 'move', 'much', 'name',
      'never', 'next', 'night', 'nothing', 'now', 'number', 'often', 'once',
      'only', 'open', 'order', 'other', 'over', 'own', 'part', 'people',
      'place', 'point', 'problem', 'program', 'public', 'question', 'really',
      'right', 'room', 'same', 'school', 'second', 'seem', 'several', 'show',
      'since', 'small', 'social', 'some', 'something', 'sometimes', 'still',
      'study', 'system', 'table', 'than', 'then', 'there', 'thing', 'think',
      'three', 'through', 'time', 'today', 'together', 'turn', 'under', 'until',
      'upon', 'use', 'used', 'using', 'very', 'water', 'way', 'well', 'were',
      'while', 'white', 'without', 'word', 'words', 'world', 'write', 'written',
      'year', 'years', 'young'
    ]);

    // Academic/complex words
    this.academicWords = new Set([
      'analyze', 'analysis', 'analytical', 'synthesize', 'synthesis', 'evaluate',
      'evaluation', 'interpret', 'interpretation', 'demonstrate', 'illustration',
      'examine', 'examination', 'investigate', 'investigation', 'determine',
      'establish', 'construct', 'construction', 'develop', 'development',
      'significant', 'significance', 'relevant', 'relevance', 'appropriate',
      'effectiveness', 'efficient', 'efficiency', 'logical', 'methodology',
      'hypothesis', 'theoretical', 'empirical', 'fundamental', 'comprehensive',
      'simultaneously', 'consequently', 'nevertheless', 'furthermore',
      'specifically', 'particularly', 'approximately', 'significantly',
      'contribute', 'contribution', 'indicate', 'indication', 'represent',
      'representation', 'require', 'requirement', 'substantial', 'considerable',
      'alternative', 'implement', 'implementation', 'strategy', 'strategic'
    ]);
  }

  /**
   * Validate language appropriateness for age group
   */
  async validateLanguage(
    content: string,
    ageGroup: AgeGroup,
    context?: {
      subject?: string;
      learningObjective?: string;
    }
  ): Promise<LanguageValidationResult> {
    const startTime = Date.now();

    try {
      const standards = AGE_LANGUAGE_STANDARDS[ageGroup];
      const metrics = this.calculateLanguageMetrics(content);
      const readabilityScore = this.calculateReadabilityScore(content);
      const complexityLevel = this.determineComplexityLevel(readabilityScore, ageGroup);

      // Generate suggestions for improvement
      const suggestions = this.generateLanguageSuggestions(content, standards, metrics);

      // Create adjusted content based on suggestions
      const adjustedContent = this.adjustContentForAge(content, standards, suggestions);

      // Determine if content is appropriate
      const isAppropriate = this.isLanguageAppropriate(metrics, standards, readabilityScore);

      const processingTime = Date.now() - startTime;
      this.logger.debug(`Language validation completed in ${processingTime}ms for ${ageGroup}`, {
        contentLength: content.length,
        readabilityScore,
        complexityLevel,
        isAppropriate,
        suggestionsCount: suggestions.length
      });

      return {
        isAppropriate,
        readabilityScore,
        complexityLevel,
        adjustedContent,
        suggestions,
        metrics
      };

    } catch (error) {
      this.logger.error('Language validation failed:', error);

      return {
        isAppropriate: false,
        readabilityScore: 0,
        complexityLevel: 'very_hard',
        adjustedContent: content,
        suggestions: [],
        metrics: this.calculateLanguageMetrics(content)
      };
    }
  }

  /**
   * Calculate comprehensive language metrics
   */
  private calculateLanguageMetrics(content: string): LanguageMetrics {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);

    if (sentences.length === 0 || words.length === 0) {
      return {
        averageWordsPerSentence: 0,
        averageSyllablesPerWord: 0,
        vocabularyComplexity: 0,
        sentenceComplexity: 0,
        conceptualComplexity: 0,
        readingLevel: 'Unknown',
        timeToReadSeconds: 0
      };
    }

    const averageWordsPerSentence = words.length / sentences.length;
    const totalSyllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);
    const averageSyllablesPerWord = totalSyllables / words.length;

    const vocabularyComplexity = this.calculateVocabularyComplexity(words);
    const sentenceComplexity = this.calculateSentenceComplexity(sentences);
    const conceptualComplexity = this.calculateConceptualComplexity(content);

    const readingLevel = this.calculateReadingLevel(averageWordsPerSentence, averageSyllablesPerWord);
    const timeToReadSeconds = Math.ceil(words.length / 200 * 60); // Assuming 200 words per minute

    return {
      averageWordsPerSentence,
      averageSyllablesPerWord,
      vocabularyComplexity,
      sentenceComplexity,
      conceptualComplexity,
      readingLevel,
      timeToReadSeconds
    };
  }

  /**
   * Calculate readability score (Flesch Reading Ease)
   */
  private calculateReadabilityScore(content: string): number {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);

    if (sentences.length === 0 || words.length === 0) return 0;

    const totalSyllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);
    const averageWordsPerSentence = words.length / sentences.length;
    const averageSyllablesPerWord = totalSyllables / words.length;

    // Flesch Reading Ease formula
    const score = 206.835 - (1.015 * averageWordsPerSentence) - (84.6 * averageSyllablesPerWord);
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine complexity level based on readability score and age group
   */
  private determineComplexityLevel(
    readabilityScore: number,
    ageGroup: AgeGroup
  ): 'very_easy' | 'easy' | 'medium' | 'hard' | 'very_hard' {
    // Age-adjusted thresholds
    const thresholds = {
      ages6to9: { veryEasy: 90, easy: 80, medium: 70, hard: 60 },
      ages10to13: { veryEasy: 80, easy: 70, medium: 60, hard: 50 },
      ages14to16: { veryEasy: 70, easy: 60, medium: 50, hard: 40 }
    };

    const threshold = thresholds[ageGroup];

    if (readabilityScore >= threshold.veryEasy) return 'very_easy';
    if (readabilityScore >= threshold.easy) return 'easy';
    if (readabilityScore >= threshold.medium) return 'medium';
    if (readabilityScore >= threshold.hard) return 'hard';
    return 'very_hard';
  }

  /**
   * Calculate vocabulary complexity based on word difficulty
   */
  private calculateVocabularyComplexity(words: string[]): number {
    let complexityScore = 0;
    let totalWords = 0;

    for (const word of words) {
      const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
      if (cleanWord.length === 0) continue;

      totalWords++;

      if (this.simpleWords.has(cleanWord)) {
        complexityScore += 1;
      } else if (this.commonWords.has(cleanWord)) {
        complexityScore += 2;
      } else if (this.academicWords.has(cleanWord)) {
        complexityScore += 4;
      } else {
        // Unknown word - score based on syllable count
        const syllables = this.countSyllables(word);
        complexityScore += Math.min(5, syllables);
      }
    }

    return totalWords > 0 ? complexityScore / totalWords : 0;
  }

  /**
   * Calculate sentence complexity
   */
  private calculateSentenceComplexity(sentences: string[]): number {
    let totalComplexity = 0;

    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/).length;
      const commas = (sentence.match(/,/g) || []).length;
      const conjunctions = (sentence.match(/\b(and|or|but|because|although|however|therefore|moreover|furthermore)\b/gi) || []).length;
      const clauses = commas + conjunctions + 1;

      // Complexity increases with word count and clause count
      const complexity = (words * 0.1) + (clauses * 0.5);
      totalComplexity += complexity;
    }

    return sentences.length > 0 ? totalComplexity / sentences.length : 0;
  }

  /**
   * Calculate conceptual complexity
   */
  private calculateConceptualComplexity(content: string): number {
    let complexity = 0;

    // Abstract concept indicators
    const abstractPatterns = [
      /\b(concept|theory|principle|philosophy|ideology|methodology)\b/gi,
      /\b(analyze|synthesize|evaluate|interpret|hypothesize)\b/gi,
      /\b(therefore|consequently|nevertheless|furthermore|moreover)\b/gi,
      /\b(abstract|theoretical|empirical|fundamental|comprehensive)\b/gi
    ];

    // Count abstract concept usage
    for (const pattern of abstractPatterns) {
      const matches = content.match(pattern) || [];
      complexity += matches.length * 0.5;
    }

    return Math.min(10, complexity); // Cap at 10
  }

  /**
   * Calculate reading level
   */
  private calculateReadingLevel(averageWordsPerSentence: number, averageSyllablesPerWord: number): string {
    // Automated Readability Index (ARI)
    const ari = 4.71 * averageSyllablesPerWord + 0.5 * averageWordsPerSentence - 21.43;

    if (ari < 1) return 'Kindergarten';
    if (ari < 2) return '1st Grade';
    if (ari < 3) return '2nd Grade';
    if (ari < 4) return '3rd Grade';
    if (ari < 5) return '4th Grade';
    if (ari < 6) return '5th Grade';
    if (ari < 7) return '6th Grade';
    if (ari < 8) return '7th Grade';
    if (ari < 9) return '8th Grade';
    if (ari < 10) return '9th Grade';
    if (ari < 11) return '10th Grade';
    if (ari < 12) return '11th Grade';
    if (ari < 13) return '12th Grade';
    return 'College Level';
  }

  /**
   * Count syllables in a word
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
   * Generate language improvement suggestions
   */
  private generateLanguageSuggestions(
    content: string,
    standards: AgeLanguageStandards,
    metrics: LanguageMetrics
  ): LanguageSuggestion[] {
    const suggestions: LanguageSuggestion[] = [];

    // Check sentence length
    if (metrics.averageWordsPerSentence > standards.maxWordsPerSentence) {
      suggestions.push({
        type: 'sentence_structure',
        description: `Sentences are too long for ${standards.ageGroup}. Break them into shorter, simpler sentences.`,
        originalText: `Average ${Math.round(metrics.averageWordsPerSentence)} words per sentence`,
        suggestedText: `Target ${standards.maxWordsPerSentence} words per sentence`,
        priority: 'high'
      });
    }

    // Check vocabulary complexity
    if (metrics.vocabularyComplexity > 2.5) {
      suggestions.push({
        type: 'vocabulary',
        description: `Use simpler, more familiar words for ${standards.ageGroup}.`,
        originalText: 'Complex vocabulary detected',
        suggestedText: 'Use simpler alternatives',
        priority: 'medium'
      });
    }

    // Check reading level
    if (metrics.readingLevel && this.isReadingLevelTooHigh(metrics.readingLevel, standards.targetReadingLevel)) {
      suggestions.push({
        type: 'concept_simplification',
        description: `Content reading level (${metrics.readingLevel}) is above target (${standards.targetReadingLevel}).`,
        originalText: metrics.readingLevel,
        suggestedText: standards.targetReadingLevel,
        priority: 'high'
      });
    }

    return suggestions;
  }

  /**
   * Adjust content for age appropriateness
   */
  private adjustContentForAge(
    content: string,
    standards: AgeLanguageStandards,
    suggestions: LanguageSuggestion[]
  ): string {
    let adjustedContent = content;

    // Apply vocabulary simplifications
    for (const word of standards.avoidVocabulary) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(adjustedContent)) {
        const simpleAlternative = this.getSimpleAlternative(word, standards.ageGroup);
        adjustedContent = adjustedContent.replace(regex, simpleAlternative);
      }
    }

    // Split overly long sentences
    adjustedContent = this.splitLongSentences(adjustedContent, standards.maxWordsPerSentence);

    return adjustedContent;
  }

  /**
   * Check if language is appropriate for age group
   */
  private isLanguageAppropriate(
    metrics: LanguageMetrics,
    standards: AgeLanguageStandards,
    readabilityScore: number
  ): boolean {
    // Check basic metrics
    if (metrics.averageWordsPerSentence > standards.maxWordsPerSentence * 1.5) return false;
    if (metrics.averageSyllablesPerWord > standards.maxSyllablesPerWord * 1.2) return false;
    if (metrics.vocabularyComplexity > 3.5) return false;

    // Check readability thresholds
    const minReadabilityScore = standards.ageGroup === 'ages6to9' ? 70 :
                               standards.ageGroup === 'ages10to13' ? 50 : 30;
    if (readabilityScore < minReadabilityScore) return false;

    return true;
  }

  /**
   * Get simple alternative for complex word
   */
  private getSimpleAlternative(word: string, ageGroup: AgeGroup): string {
    const alternatives: Record<string, Record<AgeGroup, string>> = {
      'analyze': {
        'ages6to9': 'look at',
        'ages10to13': 'study',
        'ages14to16': 'examine'
      },
      'synthesize': {
        'ages6to9': 'put together',
        'ages10to13': 'combine',
        'ages14to16': 'bring together'
      },
      'evaluate': {
        'ages6to9': 'decide if good',
        'ages10to13': 'judge',
        'ages14to16': 'assess'
      },
      'comprehensive': {
        'ages6to9': 'complete',
        'ages10to13': 'thorough',
        'ages14to16': 'detailed'
      },
      'simultaneously': {
        'ages6to9': 'at the same time',
        'ages10to13': 'at once',
        'ages14to16': 'together'
      },
      'fundamental': {
        'ages6to9': 'basic',
        'ages10to13': 'important',
        'ages14to16': 'essential'
      }
    };

    return alternatives[word.toLowerCase()]?.[ageGroup] || word;
  }

  /**
   * Split long sentences into shorter ones
   */
  private splitLongSentences(content: string, maxWords: number): string {
    const sentences = content.split(/([.!?]+)/);
    let result = '';

    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i]?.trim();
      const punctuation = sentences[i + 1] || '';

      if (!sentence) continue;

      const words = sentence.split(/\s+/);
      if (words.length <= maxWords) {
        result += sentence + punctuation + ' ';
      } else {
        // Split at conjunctions or commas
        const parts = sentence.split(/,|\s+(?:and|but|because|so)\s+/);
        for (let j = 0; j < parts.length; j++) {
          result += parts[j].trim();
          if (j < parts.length - 1) {
            result += '. ';
          } else {
            result += punctuation + ' ';
          }
        }
      }
    }

    return result.trim();
  }

  /**
   * Check if reading level is too high
   */
  private isReadingLevelTooHigh(currentLevel: string, targetLevel: string): boolean {
    const levels = [
      'Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade',
      '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade',
      '10th Grade', '11th Grade', '12th Grade', 'College Level'
    ];

    const currentIndex = levels.indexOf(currentLevel);
    const targetIndex = levels.findIndex(level => targetLevel.includes(level.split(' ')[0]));

    return currentIndex > targetIndex + 2; // Allow 2 levels above target
  }
}

// Factory function
export function createLanguageValidationService(logger: winston.Logger): LanguageValidationService {
  return new LanguageValidationService(logger);
}
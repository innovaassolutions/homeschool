import winston from 'winston';
import { LanguageValidationService, createLanguageValidationService } from '../languageValidation';
import { AgeGroup } from '../chatgpt';

describe('LanguageValidationService', () => {
  let service: LanguageValidationService;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    } as any;

    service = new LanguageValidationService(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateLanguage', () => {
    it('should validate simple content for ages 6-9', async () => {
      const content = 'The cat sat on the mat. It was a big cat.';
      const result = await service.validateLanguage(content, 'ages6to9');

      expect(result.isAppropriate).toBe(true);
      expect(result.complexityLevel).toMatch(/easy|very_easy/);
      expect(result.readabilityScore).toBeGreaterThan(70);
      expect(result.metrics.averageWordsPerSentence).toBeLessThanOrEqual(10);
      expect(result.metrics.averageSyllablesPerWord).toBeLessThanOrEqual(2);
    });

    it('should validate balanced content for ages 10-13', async () => {
      const content = 'Scientists study different animals in their natural habitats. They observe behavior patterns and record important discoveries.';
      const result = await service.validateLanguage(content, 'ages10to13');

      expect(result.isAppropriate).toBe(true);
      expect(result.complexityLevel).toMatch(/easy|medium/);
      expect(result.readabilityScore).toBeGreaterThan(50);
      expect(result.metrics.averageWordsPerSentence).toBeLessThanOrEqual(15);
    });

    it('should validate advanced content for ages 14-16', async () => {
      const content = 'The Renaissance period represented a significant cultural transformation in European history. Artists and intellectuals explored new philosophical concepts while developing innovative techniques.';
      const result = await service.validateLanguage(content, 'ages14to16');

      expect(result.isAppropriate).toBe(true);
      expect(result.readabilityScore).toBeGreaterThan(30);
      expect(result.metrics.averageWordsPerSentence).toBeLessThanOrEqual(20);
    });

    it('should flag overly complex content for young children', async () => {
      const content = 'The epistemological paradigm necessitates comprehensive analytical methodologies to synthesize multifaceted theoretical frameworks.';
      const result = await service.validateLanguage(content, 'ages6to9');

      expect(result.isAppropriate).toBe(false);
      expect(result.complexityLevel).toMatch(/hard|very_hard/);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.type === 'vocabulary' || s.type === 'concept_simplification')).toBe(true);
    });

    it('should provide adjusted content for overly complex language', async () => {
      const content = 'The fundamental methodology requires comprehensive analysis of simultaneously occurring phenomena.';
      const result = await service.validateLanguage(content, 'ages6to9');

      expect(result.adjustedContent).not.toBe(content);
      expect(result.adjustedContent).toContain('basic'); // 'fundamental' should be replaced with 'basic'
    });

    it('should split overly long sentences', async () => {
      const content = 'This is a very long sentence that has many words and keeps going on and on without any breaks or pauses which makes it hard to read.';
      const result = await service.validateLanguage(content, 'ages6to9');

      expect(result.adjustedContent.split('.')).toHaveLength(2); // Should be split into multiple sentences
    });

    it('should handle empty or very short content', async () => {
      const result1 = await service.validateLanguage('', 'ages6to9');
      expect(result1.isAppropriate).toBe(true);
      expect(result1.metrics.averageWordsPerSentence).toBe(0);

      const result2 = await service.validateLanguage('Hi!', 'ages6to9');
      expect(result2.isAppropriate).toBe(true);
      expect(result2.readabilityScore).toBeDefined();
    });

    it('should provide context-aware suggestions', async () => {
      const content = 'We need to analyze the complex mathematical equations systematically.';
      const result = await service.validateLanguage(content, 'ages6to9', {
        subject: 'math',
        learningObjective: 'basic addition'
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      const vocabularySuggestion = result.suggestions.find(s => s.type === 'vocabulary');
      expect(vocabularySuggestion).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      // Test with malformed content or edge cases
      const malformedContent = 'Test\u0000content\u001Fwith\u007Fcontrol\u009Fcharacters';
      const result = await service.validateLanguage(malformedContent, 'ages6to9');

      expect(result).toBeDefined();
      expect(result.isAppropriate).toBeDefined();
    });
  });

  describe('calculateLanguageMetrics', () => {
    it('should calculate metrics for normal content', async () => {
      const content = 'The quick brown fox jumps over the lazy dog. This is a test sentence.';
      const result = await service.validateLanguage(content, 'ages10to13');

      expect(result.metrics.averageWordsPerSentence).toBeGreaterThan(0);
      expect(result.metrics.averageSyllablesPerWord).toBeGreaterThan(0);
      expect(result.metrics.vocabularyComplexity).toBeGreaterThan(0);
      expect(result.metrics.timeToReadSeconds).toBeGreaterThan(0);
      expect(result.metrics.readingLevel).toBeDefined();
    });

    it('should handle single word content', async () => {
      const result = await service.validateLanguage('Hello', 'ages6to9');

      expect(result.metrics.averageWordsPerSentence).toBe(1);
      expect(result.metrics.averageSyllablesPerWord).toBeGreaterThan(0);
    });
  });

  describe('readability calculations', () => {
    it('should calculate appropriate readability scores', async () => {
      const simpleContent = 'I like cats. Cats are fun.';
      const complexContent = 'The multifaceted implications of contemporary socioeconomic paradigms necessitate comprehensive analytical frameworks.';

      const simpleResult = await service.validateLanguage(simpleContent, 'ages6to9');
      const complexResult = await service.validateLanguage(complexContent, 'ages14to16');

      expect(simpleResult.readabilityScore).toBeGreaterThan(complexResult.readabilityScore);
    });

    it('should assign reading levels appropriately', async () => {
      const kindergartenContent = 'I see a cat.';
      const collegeContent = 'The philosophical implications of existentialism require sophisticated analytical methodologies.';

      const kindergartenResult = await service.validateLanguage(kindergartenContent, 'ages6to9');
      const collegeResult = await service.validateLanguage(collegeContent, 'ages14to16');

      expect(kindergartenResult.metrics.readingLevel).toMatch(/Kindergarten|1st Grade|2nd Grade|3rd Grade/);
      expect(collegeResult.metrics.readingLevel).toMatch(/Grade|College/);
    });
  });

  describe('suggestion generation', () => {
    it('should suggest vocabulary improvements', async () => {
      const content = 'We must analyze and synthesize the comprehensive data.';
      const result = await service.validateLanguage(content, 'ages6to9');

      const vocabularySuggestions = result.suggestions.filter(s => s.type === 'vocabulary');
      expect(vocabularySuggestions.length).toBeGreaterThan(0);
    });

    it('should suggest sentence structure improvements', async () => {
      const content = 'This is a very long and complex sentence that contains many different ideas and concepts which should probably be broken down into smaller, more manageable pieces for better comprehension.';
      const result = await service.validateLanguage(content, 'ages6to9');

      const structureSuggestions = result.suggestions.filter(s => s.type === 'sentence_structure');
      expect(structureSuggestions.length).toBeGreaterThan(0);
    });

    it('should prioritize suggestions correctly', async () => {
      const content = 'The comprehensive methodological framework necessitates simultaneous analysis of multifaceted theoretical paradigms while synthesizing complex interdisciplinary perspectives.';
      const result = await service.validateLanguage(content, 'ages6to9');

      const highPrioritySuggestions = result.suggestions.filter(s => s.priority === 'high');
      expect(highPrioritySuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('age-appropriate adjustments', () => {
    it('should make different adjustments for different age groups', async () => {
      const content = 'Scientists analyze complex data to understand theoretical frameworks.';

      const youngResult = await service.validateLanguage(content, 'ages6to9');
      const oldResult = await service.validateLanguage(content, 'ages14to16');

      expect(youngResult.suggestions.length).toBeGreaterThan(oldResult.suggestions.length);
      expect(youngResult.isAppropriate).toBe(false);
      expect(oldResult.isAppropriate).toBe(true);
    });

    it('should preserve educational content appropriately', async () => {
      const content = 'Mathematics helps us solve problems and understand patterns.';

      const result = await service.validateLanguage(content, 'ages6to9', {
        subject: 'mathematics'
      });

      expect(result.isAppropriate).toBe(true);
      expect(result.suggestions.length).toBe(0);
    });
  });

  describe('word complexity analysis', () => {
    it('should identify simple vs complex words', async () => {
      const simpleContent = 'The cat ran home.';
      const complexContent = 'The feline expeditiously traversed to its domicile.';

      const simpleResult = await service.validateLanguage(simpleContent, 'ages6to9');
      const complexResult = await service.validateLanguage(complexContent, 'ages6to9');

      expect(simpleResult.metrics.vocabularyComplexity).toBeLessThan(complexResult.metrics.vocabularyComplexity);
      expect(complexResult.suggestions.length).toBeGreaterThan(simpleResult.suggestions.length);
    });

    it('should count syllables accurately', async () => {
      const content = 'Cat elephant systematically.'; // 1, 3, 5 syllables respectively
      const result = await service.validateLanguage(content, 'ages10to13');

      expect(result.metrics.averageSyllablesPerWord).toBeCloseTo(3, 1);
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      // Simulate an error by passing extremely malformed input
      const result = await service.validateLanguage('', 'ages6to9');

      expect(result).toBeDefined();
      expect(result.isAppropriate).toBeDefined();
      expect(result.adjustedContent).toBeDefined();
    });

    it('should log debug information appropriately', async () => {
      const content = 'Test content for logging';
      await service.validateLanguage(content, 'ages10to13');

      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe('factory function', () => {
    it('should create service using factory function', () => {
      const createdService = createLanguageValidationService(mockLogger);
      expect(createdService).toBeInstanceOf(LanguageValidationService);
    });
  });

  describe('edge cases', () => {
    it('should handle content with only punctuation', async () => {
      const result = await service.validateLanguage('!!! ... ???', 'ages6to9');

      expect(result.isAppropriate).toBe(true);
      expect(result.metrics.averageWordsPerSentence).toBe(0);
    });

    it('should handle content with numbers and symbols', async () => {
      const content = 'The equation is 2 + 2 = 4. Use symbols like $ and %.';
      const result = await service.validateLanguage(content, 'ages10to13');

      expect(result.isAppropriate).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    it('should handle very long content', async () => {
      const longContent = 'This is a test. '.repeat(100);
      const result = await service.validateLanguage(longContent, 'ages10to13');

      expect(result.isAppropriate).toBeDefined();
      expect(result.metrics.timeToReadSeconds).toBeGreaterThan(10);
    });

    it('should handle mixed case and formatting', async () => {
      const content = 'THIS IS UPPERCASE. this is lowercase. This Is Title Case.';
      const result = await service.validateLanguage(content, 'ages10to13');

      expect(result.isAppropriate).toBeDefined();
      expect(result.metrics.averageWordsPerSentence).toBeGreaterThan(0);
    });
  });

  describe('content adjustment', () => {
    it('should replace complex words with simpler alternatives', async () => {
      const content = 'We need to analyze the comprehensive data systematically.';
      const result = await service.validateLanguage(content, 'ages6to9');

      expect(result.adjustedContent).toContain('look at'); // 'analyze' should be replaced
      expect(result.adjustedContent).toContain('complete'); // 'comprehensive' should be replaced
    });

    it('should maintain meaning while simplifying', async () => {
      const content = 'Scientists evaluate hypotheses using fundamental methodologies.';
      const result = await service.validateLanguage(content, 'ages6to9');

      // Check that core meaning is preserved while language is simplified
      expect(result.adjustedContent).toContain('judge'); // 'evaluate' simplified
      expect(result.adjustedContent).toContain('basic'); // 'fundamental' simplified
    });
  });
});
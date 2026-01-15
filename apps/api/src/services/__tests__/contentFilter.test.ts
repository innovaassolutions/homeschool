import { ContentFilterService, ContentFilterResult, ViolationType } from '../contentFilter';
import { AgeGroup } from '../chatgpt';
import winston from 'winston';

describe('ContentFilterService', () => {
  let service: ContentFilterService;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;

    service = new ContentFilterService(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('filterContent', () => {
    it('should pass appropriate content for ages 6-9', async () => {
      const content = 'Let\'s learn about adding numbers! 2 + 2 equals 4. That\'s fun!';
      const result = await service.filterContent(content, 'ages6to9');

      expect(result.isAppropriate).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.filteredContent).toBe(content);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should filter inappropriate language', async () => {
      const content = 'Math is stupid and boring. I hate it!';
      const result = await service.filterContent(content, 'ages6to9');

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.type === 'inappropriate_language')).toBe(true);
      expect(result.filteredContent).not.toContain('stupid');
      expect(result.filteredContent).not.toContain('hate');
    });

    it('should detect violent content', async () => {
      const content = 'If you don\'t understand, I will hurt you and fight you!';
      const result = await service.filterContent(content, 'ages6to9');

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.type === 'violence')).toBe(true);
      expect(result.isAppropriate).toBe(false);
    });

    it('should remove personal information', async () => {
      const content = 'Call me at 555-123-4567 or email test@example.com';
      const result = await service.filterContent(content, 'ages10to13');

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.type === 'personal_information')).toBe(true);
      expect(result.filteredContent).toContain('[personal information removed]');
      expect(result.filteredContent).not.toContain('555-123-4567');
      expect(result.filteredContent).not.toContain('test@example.com');
    });

    it('should detect complex language for young children', async () => {
      const content = 'The multifaceted computational algorithms demonstrate extraordinary sophisticated implementation methodologies.';
      const result = await service.filterContent(content, 'ages6to9');

      expect(result.violations.some(v => v.type === 'complex_language')).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should allow more complex content for teenagers', async () => {
      const content = 'The sophisticated mathematical framework demonstrates advanced computational methodologies.';
      const result = await service.filterContent(content, 'ages14to16');

      // Should have fewer or no violations compared to younger age groups
      const complexityViolations = result.violations.filter(v => v.type === 'complex_language');
      expect(complexityViolations.length).toBeLessThan(3);
    });

    it('should check topic appropriateness', async () => {
      const content = 'Let\'s learn about romantic relationships and dating in high school.';
      const result = await service.filterContent(content, 'ages6to9');

      expect(result.violations.some(v => v.type === 'adult_topics')).toBe(true);
      expect(result.isAppropriate).toBe(false);
    });

    it('should handle emotional content appropriately', async () => {
      const content = 'I feel so scared and terrified and anxious about this math problem.';
      const result = await service.filterContent(content, 'ages6to9');

      expect(result.violations.some(v => v.type === 'emotional_content')).toBe(true);
    });

    it('should be more lenient with emotional content for older children', async () => {
      const content = 'I feel worried about understanding this concept.';
      const result = await service.filterContent(content, 'ages14to16');

      const emotionalViolations = result.violations.filter(v => v.type === 'emotional_content');
      expect(emotionalViolations.length).toBe(0);
    });

    it('should handle context for subject-specific content', async () => {
      const content = 'In biology, we study how animals reproduce and create offspring.';
      const context = { subject: 'science', learningObjective: 'animal life cycles' };
      const result = await service.filterContent(content, 'ages10to13', context);

      // Should be appropriate in educational context
      expect(result.isAppropriate).toBe(true);
    });

    it('should provide confidence scores', async () => {
      const simpleContent = 'Two plus two equals four.';
      const complexContent = 'This is a very complex sentence with multiple clauses and difficult vocabulary that might be inappropriate.';

      const simpleResult = await service.filterContent(simpleContent, 'ages6to9');
      const complexResult = await service.filterContent(complexContent, 'ages6to9');

      expect(simpleResult.confidence).toBeGreaterThan(complexResult.confidence);
      expect(simpleResult.confidence).toBeGreaterThan(0.8);
    });

    it('should handle empty content', async () => {
      const result = await service.filterContent('', 'ages10to13');

      expect(result.isAppropriate).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.filteredContent).toBe('');
    });

    it('should handle filtering errors gracefully', async () => {
      // Mock an error in the filtering process
      const originalMethod = service['checkProfanity'];
      service['checkProfanity'] = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await service.filterContent('test content', 'ages6to9');

      expect(result.isAppropriate).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.confidence).toBe(0);
      expect(mockLogger.error).toHaveBeenCalled();

      // Restore original method
      service['checkProfanity'] = originalMethod;
    });
  });

  describe('age-specific filtering', () => {
    const testCases = [
      {
        content: 'Let\'s learn about money and financial planning for your future career.',
        ages6to9: false, // Should be inappropriate
        ages10to13: true, // Should be appropriate
        ages14to16: true  // Should be appropriate
      },
      {
        content: 'War is a serious topic that affects many countries around the world.',
        ages6to9: false, // Should be inappropriate
        ages10to13: false, // Should be inappropriate
        ages14to16: true  // Should be appropriate in educational context
      },
      {
        content: 'Adding numbers is fun! Let\'s try 5 + 3.',
        ages6to9: true,  // Should be appropriate
        ages10to13: true, // Should be appropriate
        ages14to16: true  // Should be appropriate
      }
    ];

    testCases.forEach(({ content, ages6to9, ages10to13, ages14to16 }, index) => {
      it(`should handle age-appropriate filtering for test case ${index + 1}`, async () => {
        const result6to9 = await service.filterContent(content, 'ages6to9');
        const result10to13 = await service.filterContent(content, 'ages10to13');
        const result14to16 = await service.filterContent(content, 'ages14to16');

        expect(result6to9.isAppropriate).toBe(ages6to9);
        expect(result10to13.isAppropriate).toBe(ages10to13);
        expect(result14to16.isAppropriate).toBe(ages14to16);
      });
    });
  });

  describe('violation types', () => {
    it('should correctly identify violation types', async () => {
      const testCases = [
        { content: 'This is stupid', expectedType: 'inappropriate_language' },
        { content: 'I will fight you', expectedType: 'violence' },
        { content: 'Call 555-1234', expectedType: 'personal_information' },
        { content: 'Let\'s talk about alcohol and drinking', expectedType: 'adult_topics' }
      ];

      for (const { content, expectedType } of testCases) {
        const result = await service.filterContent(content, 'ages6to9');
        expect(result.violations.some(v => v.type === expectedType as ViolationType)).toBe(true);
      }
    });

    it('should provide violation details', async () => {
      const content = 'Math is stupid and I hate it!';
      const result = await service.filterContent(content, 'ages6to9');

      const violation = result.violations[0];
      expect(violation).toHaveProperty('type');
      expect(violation).toHaveProperty('severity');
      expect(violation).toHaveProperty('description');
      expect(violation).toHaveProperty('originalText');
    });
  });

  describe('getFilteringStats', () => {
    it('should return filtering statistics', () => {
      const stats = service.getFilteringStats();

      expect(stats).toHaveProperty('patternsLoaded');
      expect(stats).toHaveProperty('ageGroupsSupported');
      expect(stats.patternsLoaded).toBeGreaterThan(0);
      expect(stats.ageGroupsSupported).toBe(3);
    });
  });

  describe('alternative word suggestions', () => {
    it('should suggest appropriate alternatives for inappropriate words', async () => {
      const content = 'This math problem is stupid.';
      const result = await service.filterContent(content, 'ages6to9');

      expect(result.filteredContent).toContain('silly');
      expect(result.filteredContent).not.toContain('stupid');
    });

    it('should handle multiple inappropriate words', async () => {
      const content = 'I hate this stupid math because it sucks.';
      const result = await service.filterContent(content, 'ages6to9');

      expect(result.filteredContent).toContain('dislike');
      expect(result.filteredContent).toContain('silly');
      expect(result.filteredContent).toContain('is not great');
      expect(result.violations.length).toBeGreaterThan(2);
    });
  });

  describe('complexity analysis', () => {
    it('should analyze vocabulary complexity correctly', async () => {
      const simpleContent = 'I like cats and dogs.';
      const complexContent = 'The sophisticated implementation demonstrates extraordinary computational capabilities.';

      const simpleResult = await service.filterContent(simpleContent, 'ages6to9');
      const complexResult = await service.filterContent(complexContent, 'ages6to9');

      const simpleComplexityViolations = simpleResult.violations.filter(v => v.type === 'complex_language');
      const complexComplexityViolations = complexResult.violations.filter(v => v.type === 'complex_language');

      expect(complexComplexityViolations.length).toBeGreaterThan(simpleComplexityViolations.length);
    });

    it('should consider sentence length in complexity', async () => {
      const shortSentence = 'Math is fun.';
      const longSentence = 'Mathematics is an incredibly fascinating subject that involves numerous complex concepts and sophisticated problem-solving techniques.';

      const shortResult = await service.filterContent(shortSentence, 'ages6to9');
      const longResult = await service.filterContent(longSentence, 'ages6to9');

      const longComplexityViolations = longResult.violations.filter(v => v.type === 'complex_language');
      expect(longComplexityViolations.length).toBeGreaterThan(0);
    });
  });

  describe('confidence calculation', () => {
    it('should calculate confidence based on content characteristics', async () => {
      const clearContent = 'Two plus two equals four.';
      const ambiguousContent = 'This might be something that could potentially be considered inappropriate maybe.';

      const clearResult = await service.filterContent(clearContent, 'ages6to9');
      const ambiguousResult = await service.filterContent(ambiguousContent, 'ages6to9');

      expect(clearResult.confidence).toBeGreaterThan(ambiguousResult.confidence);
    });

    it('should have lower confidence for very short content', async () => {
      const shortContent = 'Hi';
      const normalContent = 'Hello! Let\'s learn about addition today. It\'s really fun!';

      const shortResult = await service.filterContent(shortContent, 'ages6to9');
      const normalResult = await service.filterContent(normalContent, 'ages6to9');

      expect(normalResult.confidence).toBeGreaterThanOrEqual(shortResult.confidence);
    });
  });

  describe('warning system', () => {
    it('should generate appropriate warnings', async () => {
      const content = 'This is a moderately complex explanation that might be challenging.';
      const result = await service.filterContent(content, 'ages6to9');

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('complex'))).toBe(true);
    });

    it('should distinguish between violations and warnings', async () => {
      const content = 'This sentence has some big words like extraordinary and magnificent.';
      const result = await service.filterContent(content, 'ages6to9');

      // Should have warnings about complexity but still be appropriate
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.isAppropriate).toBe(true);
    });
  });
});
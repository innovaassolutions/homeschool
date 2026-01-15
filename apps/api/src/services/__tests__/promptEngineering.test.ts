import { PromptEngineeringService, PromptPersonalization, LearningStyle, AccessibilityNeed } from '../promptEngineering';
import { AgeGroup } from '../chatgpt';

describe('PromptEngineeringService', () => {
  let service: PromptEngineeringService;

  beforeEach(() => {
    service = new PromptEngineeringService();
  });

  describe('generatePersonalizedPrompt', () => {
    it('should generate basic prompt for ages 6-9', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages6to9',
        subject: 'math',
        topic: 'addition'
      };

      const result = service.generatePersonalizedPrompt(personalization);

      expect(result.systemPrompt).toContain('friendly, patient AI tutor');
      expect(result.systemPrompt).toContain('simple words');
      expect(result.systemPrompt).toContain('math');
      expect(result.systemPrompt).toContain('addition');
      expect(result.temperature).toBe(0.8);
      expect(result.maxTokens).toBe(150);
      expect(result.complexity).toBe('simple');
      expect(result.safetyLevel).toBe('high');
    });

    it('should generate appropriate prompt for ages 10-13', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages10to13',
        subject: 'science',
        topic: 'photosynthesis'
      };

      const result = service.generatePersonalizedPrompt(personalization);

      expect(result.systemPrompt).toContain('enthusiastic AI tutor');
      expect(result.systemPrompt).toContain('pre-teens');
      expect(result.systemPrompt).toContain('science');
      expect(result.systemPrompt).toContain('photosynthesis');
      expect(result.temperature).toBe(0.7);
      expect(result.maxTokens).toBe(200);
      expect(result.complexity).toBe('balanced');
      expect(result.safetyLevel).toBe('medium');
    });

    it('should generate sophisticated prompt for ages 14-16', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages14to16',
        subject: 'history',
        topic: 'world war 2'
      };

      const result = service.generatePersonalizedPrompt(personalization);

      expect(result.systemPrompt).toContain('knowledgeable AI tutor');
      expect(result.systemPrompt).toContain('teenagers');
      expect(result.systemPrompt).toContain('history');
      expect(result.systemPrompt).toContain('world war 2');
      expect(result.temperature).toBe(0.6);
      expect(result.maxTokens).toBe(300);
      expect(result.complexity).toBe('advanced');
      expect(result.safetyLevel).toBe('standard');
    });

    it('should include learning style adaptations', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages10to13',
        subject: 'art',
        topic: 'color theory',
        learningStyle: 'visual'
      };

      const result = service.generatePersonalizedPrompt(personalization);

      expect(result.systemPrompt).toContain('LEARNING STYLE ADAPTATION');
      expect(result.systemPrompt).toContain('visual descriptions');
      expect(result.systemPrompt).toContain('colors, shapes, diagrams');
      expect(result.systemPrompt).toContain('visual aids');
    });

    it('should handle auditory learning style', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages6to9',
        subject: 'music',
        topic: 'rhythm',
        learningStyle: 'auditory'
      };

      const result = service.generatePersonalizedPrompt(personalization);

      expect(result.systemPrompt).toContain('verbal explanations');
      expect(result.systemPrompt).toContain('sound patterns');
      expect(result.systemPrompt).toContain('reading aloud');
    });

    it('should handle kinesthetic learning style', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages10to13',
        subject: 'science',
        topic: 'chemistry',
        learningStyle: 'kinesthetic'
      };

      const result = service.generatePersonalizedPrompt(personalization);

      expect(result.systemPrompt).toContain('hands-on activities');
      expect(result.systemPrompt).toContain('movement');
      expect(result.systemPrompt).toContain('experimentation');
    });

    it('should include accessibility needs', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages6to9',
        subject: 'reading',
        topic: 'phonics',
        accessibilityNeeds: ['simple-language', 'step-by-step']
      };

      const result = service.generatePersonalizedPrompt(personalization);

      expect(result.systemPrompt).toContain('ACCESSIBILITY REQUIREMENTS');
      expect(result.systemPrompt).toContain('simplest possible language');
      expect(result.systemPrompt).toContain('numbered steps');
      expect(result.systemPrompt).toContain('First, Then, Next, Finally');
    });

    it('should handle multiple accessibility needs', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages10to13',
        subject: 'math',
        topic: 'algebra',
        accessibilityNeeds: ['repetition', 'attention-support', 'processing-time']
      };

      const result = service.generatePersonalizedPrompt(personalization);

      expect(result.systemPrompt).toContain('Repeat key concepts');
      expect(result.systemPrompt).toContain('focused and well-organized');
      expect(result.systemPrompt).toContain('small, digestible chunks');
    });

    it('should connect to student interests', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages6to9',
        subject: 'math',
        topic: 'counting',
        interests: ['animals', 'sports']
      };

      const result = service.generatePersonalizedPrompt(personalization);

      expect(result.systemPrompt).toContain('STUDENT INTERESTS');
      expect(result.systemPrompt).toContain('animals: Use animal examples');
      expect(result.systemPrompt).toContain('sports: Use sports statistics');
    });

    it('should handle unknown interests gracefully', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages10to13',
        subject: 'science',
        topic: 'plants',
        interests: ['unknowninterest', 'nature']
      };

      const result = service.generatePersonalizedPrompt(personalization);

      expect(result.systemPrompt).toContain('nature: Use outdoor examples');
      // Should not crash on unknown interest
      expect(result.systemPrompt).toBeDefined();
    });

    it('should include safety guidelines for young children', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages6to9',
        subject: 'reading',
        topic: 'stories'
      };

      const result = service.generatePersonalizedPrompt(personalization);

      expect(result.systemPrompt).toContain('SAFETY GUIDELINES');
      expect(result.systemPrompt).toContain('educational topics appropriate for young children');
      expect(result.systemPrompt).toContain('Avoid any mention of violence');
      expect(result.systemPrompt).toContain('nurturing, safe environment');
    });

    it('should include appropriate safety guidelines for teenagers', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages14to16',
        subject: 'social studies',
        topic: 'government'
      };

      const result = service.generatePersonalizedPrompt(personalization);

      expect(result.systemPrompt).toContain('SAFETY GUIDELINES');
      expect(result.systemPrompt).toContain('educational content appropriate for teenagers');
      expect(result.systemPrompt).toContain('Avoid explicit content');
      expect(result.systemPrompt).toContain('Support academic and personal growth');
    });

    it('should include response structure guidelines', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages6to9',
        subject: 'math',
        topic: 'shapes'
      };

      const result = service.generatePersonalizedPrompt(personalization);

      expect(result.systemPrompt).toContain('RESPONSE STRUCTURE');
      expect(result.systemPrompt).toContain('Start with encouragement');
      expect(result.systemPrompt).toContain('1-3 short sentences');
    });

    it('should adjust max tokens for accessibility needs', () => {
      const basePersonalization: PromptPersonalization = {
        ageGroup: 'ages6to9',
        subject: 'math',
        topic: 'addition'
      };

      const withSimpleLanguage: PromptPersonalization = {
        ...basePersonalization,
        accessibilityNeeds: ['simple-language']
      };

      const withStepByStep: PromptPersonalization = {
        ...basePersonalization,
        accessibilityNeeds: ['step-by-step']
      };

      const withRepetition: PromptPersonalization = {
        ...basePersonalization,
        accessibilityNeeds: ['repetition']
      };

      const baseResult = service.generatePersonalizedPrompt(basePersonalization);
      const simpleResult = service.generatePersonalizedPrompt(withSimpleLanguage);
      const stepResult = service.generatePersonalizedPrompt(withStepByStep);
      const repetitionResult = service.generatePersonalizedPrompt(withRepetition);

      expect(simpleResult.maxTokens).toBeGreaterThan(baseResult.maxTokens);
      expect(stepResult.maxTokens).toBeGreaterThan(baseResult.maxTokens);
      expect(repetitionResult.maxTokens).toBeGreaterThan(baseResult.maxTokens);
    });

    it('should cap max tokens at reasonable maximum', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages14to16',
        subject: 'literature',
        topic: 'analysis',
        accessibilityNeeds: ['simple-language', 'step-by-step', 'repetition']
      };

      const result = service.generatePersonalizedPrompt(personalization);

      expect(result.maxTokens).toBeLessThanOrEqual(500);
    });

    it('should reduce tokens for processing-time accessibility need', () => {
      const basePersonalization: PromptPersonalization = {
        ageGroup: 'ages10to13',
        subject: 'science',
        topic: 'biology'
      };

      const withProcessingTime: PromptPersonalization = {
        ...basePersonalization,
        accessibilityNeeds: ['processing-time']
      };

      const baseResult = service.generatePersonalizedPrompt(basePersonalization);
      const processingResult = service.generatePersonalizedPrompt(withProcessingTime);

      expect(processingResult.maxTokens).toBeLessThan(baseResult.maxTokens);
    });
  });

  describe('getAvailableLearningStyles', () => {
    it('should return all learning style options', () => {
      const styles = service.getAvailableLearningStyles();

      expect(styles).toContain('visual');
      expect(styles).toContain('auditory');
      expect(styles).toContain('kinesthetic');
      expect(styles).toContain('reading_writing');
      expect(styles).toContain('multimodal');
      expect(styles.length).toBe(5);
    });
  });

  describe('getAvailableAccessibilityNeeds', () => {
    it('should return all accessibility need options', () => {
      const needs = service.getAvailableAccessibilityNeeds();

      expect(needs).toContain('large-text');
      expect(needs).toContain('simple-language');
      expect(needs).toContain('step-by-step');
      expect(needs).toContain('repetition');
      expect(needs).toContain('visual-descriptions');
      expect(needs).toContain('attention-support');
      expect(needs).toContain('processing-time');
      expect(needs.length).toBe(7);
    });
  });

  describe('getAvailableInterests', () => {
    it('should return all interest options', () => {
      const interests = service.getAvailableInterests();

      expect(interests).toContain('animals');
      expect(interests).toContain('sports');
      expect(interests).toContain('music');
      expect(interests).toContain('art');
      expect(interests).toContain('technology');
      expect(interests).toContain('nature');
      expect(interests).toContain('space');
      expect(interests).toContain('cooking');
      expect(interests).toContain('books');
      expect(interests).toContain('games');
      expect(interests.length).toBe(10);
    });
  });

  describe('validatePersonalization', () => {
    it('should validate correct personalization', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages6to9',
        subject: 'math',
        topic: 'addition',
        learningStyle: 'visual',
        interests: ['animals'],
        accessibilityNeeds: ['simple-language']
      };

      const result = service.validatePersonalization(personalization);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid age group', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'invalid' as AgeGroup,
        subject: 'math',
        topic: 'addition'
      };

      const result = service.validatePersonalization(personalization);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid age group');
    });

    it('should reject invalid learning style', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages6to9',
        subject: 'math',
        topic: 'addition',
        learningStyle: 'invalid' as LearningStyle
      };

      const result = service.validatePersonalization(personalization);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid learning style');
    });

    it('should reject invalid accessibility needs', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages6to9',
        subject: 'math',
        topic: 'addition',
        accessibilityNeeds: ['invalid' as AccessibilityNeed]
      };

      const result = service.validatePersonalization(personalization);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid accessibility need: invalid');
    });

    it('should require subject field', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages6to9',
        subject: '',
        topic: 'addition'
      };

      const result = service.validatePersonalization(personalization);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Subject is required');
    });

    it('should require topic field', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages6to9',
        subject: 'math',
        topic: '   '
      };

      const result = service.validatePersonalization(personalization);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Topic is required');
    });

    it('should accumulate multiple validation errors', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'invalid' as AgeGroup,
        subject: '',
        topic: '',
        learningStyle: 'invalid' as LearningStyle
      };

      const result = service.validatePersonalization(personalization);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Invalid age group');
      expect(result.errors).toContain('Subject is required');
      expect(result.errors).toContain('Topic is required');
      expect(result.errors).toContain('Invalid learning style');
    });
  });

  describe('complex combinations', () => {
    it('should handle all options together', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages10to13',
        subject: 'science',
        topic: 'chemistry experiments',
        learningStyle: 'multimodal',
        interests: ['technology', 'games'],
        accessibilityNeeds: ['step-by-step', 'attention-support']
      };

      const result = service.generatePersonalizedPrompt(personalization);

      expect(result.systemPrompt).toContain('science');
      expect(result.systemPrompt).toContain('chemistry experiments');
      expect(result.systemPrompt).toContain('multiple learning approaches');
      expect(result.systemPrompt).toContain('technology');
      expect(result.systemPrompt).toContain('games');
      expect(result.systemPrompt).toContain('numbered steps');
      expect(result.systemPrompt).toContain('focused and well-organized');
      expect(result.complexity).toBe('balanced');
      expect(result.safetyLevel).toBe('medium');
    });

    it('should maintain age-appropriate safety regardless of other options', () => {
      const personalization: PromptPersonalization = {
        ageGroup: 'ages6to9',
        subject: 'social studies',
        topic: 'community helpers',
        learningStyle: 'kinesthetic',
        interests: ['technology'],
        accessibilityNeeds: ['processing-time']
      };

      const result = service.generatePersonalizedPrompt(personalization);

      expect(result.safetyLevel).toBe('high');
      expect(result.systemPrompt).toContain('nurturing, safe environment');
      expect(result.systemPrompt).toContain('Avoid any mention of violence');
    });
  });
});
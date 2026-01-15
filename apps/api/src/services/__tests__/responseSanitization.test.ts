import { ResponseSanitizationService, SafetyCheckConfig, SanitizationResult, ModificationType } from '../responseSanitization';
import { AgeGroup } from '../chatgpt';
import winston from 'winston';

describe('ResponseSanitizationService', () => {
  let service: ResponseSanitizationService;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;

    service = new ResponseSanitizationService(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sanitizeResponse', () => {
    it('should pass safe content unchanged', async () => {
      const content = 'Let\'s learn about addition! 2 + 2 = 4. Math is fun!';
      const config: SafetyCheckConfig = {
        ageGroup: 'ages6to9',
        strictMode: true
      };

      const result = await service.sanitizeResponse(content, config);

      expect(result.isClean).toBe(true);
      expect(result.sanitizedContent).toBe(content);
      expect(result.modifications).toHaveLength(0);
      expect(result.safetyScore).toBeGreaterThan(0.8);
    });

    it('should remove URLs from content', async () => {
      const content = 'Check out this website: https://example.com for more information.';
      const config: SafetyCheckConfig = {
        ageGroup: 'ages10to13',
        strictMode: true
      };

      const result = await service.sanitizeResponse(content, config);

      expect(result.isClean).toBe(false);
      expect(result.sanitizedContent).not.toContain('https://example.com');
      expect(result.sanitizedContent).toContain('[URL removed for safety]');
      expect(result.modifications.length).toBeGreaterThan(0);
      expect(result.modifications.some(m => m.type === 'url_removal')).toBe(true);
    });

    it('should detect and sanitize harmful instructions', async () => {
      const content = 'To solve this problem, first delete all your files and then restart your computer.';
      const config: SafetyCheckConfig = {
        ageGroup: 'ages6to9',
        strictMode: true
      };

      const result = await service.sanitizeResponse(content, config);

      expect(result.isClean).toBe(false);
      expect(result.modifications.some(m => m.type === 'harmful_instruction')).toBe(true);
      expect(result.safetyScore).toBeLessThan(0.5);
    });

    it('should detect medical advice attempts', async () => {
      const content = 'If you have a headache, you should take aspirin and see if it helps.';
      const config: SafetyCheckConfig = {
        ageGroup: 'ages10to13',
        strictMode: true
      };

      const result = await service.sanitizeResponse(content, config);

      expect(result.isClean).toBe(false);
      expect(result.modifications.some(m => m.type === 'medical_advice')).toBe(true);
      expect(result.sanitizedContent).toContain('ask a doctor');
    });

    it('should detect legal advice attempts', async () => {
      const content = 'In this situation, you should definitely sue them and represent yourself in court.';
      const config: SafetyCheckConfig = {
        ageGroup: 'ages14to16',
        strictMode: true
      };

      const result = await service.sanitizeResponse(content, config);

      expect(result.isClean).toBe(false);
      expect(result.modifications.some(m => m.type === 'legal_advice')).toBe(true);
      expect(result.sanitizedContent).toContain('consult with a qualified attorney');
    });

    it('should provide emergency contact information when appropriate', async () => {
      const content = 'I understand you\'re feeling really sad and hopeless about this math problem.';
      const config: SafetyCheckConfig = {
        ageGroup: 'ages14to16',
        strictMode: true
      };

      const result = await service.sanitizeResponse(content, config);

      expect(result.modifications.some(m => m.type === 'emergency_contact')).toBe(true);
      expect(result.sanitizedContent).toContain('988 Suicide & Crisis Lifeline');
    });

    it('should be more lenient in non-strict mode', async () => {
      const content = 'Check out this educational website: https://khanacademy.org for more math practice.';
      const config: SafetyCheckConfig = {
        ageGroup: 'ages10to13',
        strictMode: false
      };

      const result = await service.sanitizeResponse(content, config);

      // In non-strict mode, educational URLs might be allowed
      expect(result.safetyScore).toBeGreaterThan(0.6);
    });

    it('should handle different age groups appropriately', async () => {
      const content = 'This is a moderately complex explanation with some sophisticated vocabulary.';

      const youngerConfig: SafetyCheckConfig = {
        ageGroup: 'ages6to9',
        strictMode: true
      };

      const olderConfig: SafetyCheckConfig = {
        ageGroup: 'ages14to16',
        strictMode: true
      };

      const youngerResult = await service.sanitizeResponse(content, youngerConfig);
      const olderResult = await service.sanitizeResponse(content, olderConfig);

      // Younger children should have stricter safety checks
      expect(youngerResult.safetyScore).toBeLessThanOrEqual(olderResult.safetyScore);
    });

    it('should detect social media references', async () => {
      const content = 'You can find more information on Facebook, Instagram, or TikTok.';
      const config: SafetyCheckConfig = {
        ageGroup: 'ages6to9',
        strictMode: true
      };

      const result = await service.sanitizeResponse(content, config);

      expect(result.isClean).toBe(false);
      expect(result.modifications.some(m => m.type === 'social_media')).toBe(true);
      expect(result.sanitizedContent).not.toContain('Facebook');
      expect(result.sanitizedContent).not.toContain('Instagram');
      expect(result.sanitizedContent).not.toContain('TikTok');
    });

    it('should handle personal information requests', async () => {
      const content = 'To help you better, please tell me your full name, address, and phone number.';
      const config: SafetyCheckConfig = {
        ageGroup: 'ages10to13',
        strictMode: true
      };

      const result = await service.sanitizeResponse(content, config);

      expect(result.isClean).toBe(false);
      expect(result.modifications.some(m => m.type === 'personal_info_request')).toBe(true);
      expect(result.sanitizedContent).toContain('never share personal information');
    });

    it('should detect inappropriate contact suggestions', async () => {
      const content = 'If you need more help, you can email me directly at teacher@example.com or call me at 555-1234.';
      const config: SafetyCheckConfig = {
        ageGroup: 'ages6to9',
        strictMode: true
      };

      const result = await service.sanitizeResponse(content, config);

      expect(result.isClean).toBe(false);
      expect(result.modifications.some(m => m.type === 'inappropriate_contact')).toBe(true);
      expect(result.sanitizedContent).not.toContain('teacher@example.com');
      expect(result.sanitizedContent).not.toContain('555-1234');
    });

    it('should handle financial advice attempts', async () => {
      const content = 'You should invest your allowance money in cryptocurrency or stocks.';
      const config: SafetyCheckConfig = {
        ageGroup: 'ages14to16',
        strictMode: true
      };

      const result = await service.sanitizeResponse(content, config);

      expect(result.isClean).toBe(false);
      expect(result.modifications.some(m => m.type === 'financial_advice')).toBe(true);
      expect(result.sanitizedContent).toContain('consult with a financial advisor');
    });

    it('should provide modification details', async () => {
      const content = 'Visit https://example.com and also check out Facebook for more info.';
      const config: SafetyCheckConfig = {
        ageGroup: 'ages10to13',
        strictMode: true
      };

      const result = await service.sanitizeResponse(content, config);

      expect(result.modifications.length).toBeGreaterThan(0);

      const urlModification = result.modifications.find(m => m.type === 'url_removal');
      expect(urlModification).toBeDefined();
      expect(urlModification?.originalText).toContain('https://example.com');
      expect(urlModification?.reason).toContain('safety');

      const socialModification = result.modifications.find(m => m.type === 'social_media');
      expect(socialModification).toBeDefined();
      expect(socialModification?.originalText).toContain('Facebook');
    });

    it('should calculate appropriate safety scores', async () => {
      const safeContent = 'Let\'s practice multiplication tables. What is 7 x 8?';
      const riskyContent = 'Visit this website https://random.com and give them your personal information.';

      const config: SafetyCheckConfig = {
        ageGroup: 'ages10to13',
        strictMode: true
      };

      const safeResult = await service.sanitizeResponse(safeContent, config);
      const riskyResult = await service.sanitizeResponse(riskyContent, config);

      expect(safeResult.safetyScore).toBeGreaterThan(0.8);
      expect(riskyResult.safetyScore).toBeLessThan(0.3);
      expect(safeResult.safetyScore).toBeGreaterThan(riskyResult.safetyScore);
    });

    it('should handle empty content', async () => {
      const config: SafetyCheckConfig = {
        ageGroup: 'ages6to9',
        strictMode: true
      };

      const result = await service.sanitizeResponse('', config);

      expect(result.isClean).toBe(true);
      expect(result.sanitizedContent).toBe('');
      expect(result.modifications).toHaveLength(0);
      expect(result.safetyScore).toBe(1.0);
    });

    it('should handle very long content', async () => {
      const longContent = 'This is a very long content. '.repeat(100) + 'Visit https://example.com for more.';
      const config: SafetyCheckConfig = {
        ageGroup: 'ages10to13',
        strictMode: true
      };

      const result = await service.sanitizeResponse(longContent, config);

      expect(result.sanitizedContent).toBeDefined();
      expect(result.modifications.some(m => m.type === 'url_removal')).toBe(true);
    });

    it('should handle content with multiple violations', async () => {
      const content = `Visit https://example.com and https://another.com.
                      If you feel sad, take some medicine.
                      Also, you should sue someone if they hurt you.
                      Check out Facebook and Instagram too.`;

      const config: SafetyCheckConfig = {
        ageGroup: 'ages6to9',
        strictMode: true
      };

      const result = await service.sanitizeResponse(content, config);

      expect(result.isClean).toBe(false);
      expect(result.modifications.length).toBeGreaterThan(3);
      expect(result.modifications.some(m => m.type === 'url_removal')).toBe(true);
      expect(result.modifications.some(m => m.type === 'medical_advice')).toBe(true);
      expect(result.modifications.some(m => m.type === 'legal_advice')).toBe(true);
      expect(result.modifications.some(m => m.type === 'social_media')).toBe(true);
      expect(result.safetyScore).toBeLessThan(0.3);
    });

    it('should handle sanitization errors gracefully', async () => {
      // Mock an error in the sanitization process
      const originalMethod = service['checkForHarmfulInstructions'];
      service['checkForHarmfulInstructions'] = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      const content = 'Test content for error handling';
      const config: SafetyCheckConfig = {
        ageGroup: 'ages10to13',
        strictMode: true
      };

      const result = await service.sanitizeResponse(content, config);

      expect(result.isClean).toBe(false);
      expect(result.safetyScore).toBe(0);
      expect(result.sanitizedContent).toContain('content review required');
      expect(mockLogger.error).toHaveBeenCalled();

      // Restore original method
      service['checkForHarmfulInstructions'] = originalMethod;
    });
  });

  describe('age-specific safety thresholds', () => {
    const testCases = [
      {
        content: 'This involves some complex financial concepts that might be confusing.',
        ages6to9: { expectClean: false, maxSafetyScore: 0.6 },
        ages10to13: { expectClean: true, minSafetyScore: 0.7 },
        ages14to16: { expectClean: true, minSafetyScore: 0.8 }
      },
      {
        content: 'Let\'s count to ten: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10!',
        ages6to9: { expectClean: true, minSafetyScore: 0.9 },
        ages10to13: { expectClean: true, minSafetyScore: 0.9 },
        ages14to16: { expectClean: true, minSafetyScore: 0.9 }
      }
    ];

    testCases.forEach((testCase, index) => {
      it(`should handle age-appropriate safety for test case ${index + 1}`, async () => {
        const config6to9: SafetyCheckConfig = { ageGroup: 'ages6to9', strictMode: true };
        const config10to13: SafetyCheckConfig = { ageGroup: 'ages10to13', strictMode: true };
        const config14to16: SafetyCheckConfig = { ageGroup: 'ages14to16', strictMode: true };

        const result6to9 = await service.sanitizeResponse(testCase.content, config6to9);
        const result10to13 = await service.sanitizeResponse(testCase.content, config10to13);
        const result14to16 = await service.sanitizeResponse(testCase.content, config14to16);

        if (testCase.ages6to9.expectClean !== undefined) {
          expect(result6to9.isClean).toBe(testCase.ages6to9.expectClean);
        }
        if (testCase.ages6to9.minSafetyScore !== undefined) {
          expect(result6to9.safetyScore).toBeGreaterThanOrEqual(testCase.ages6to9.minSafetyScore);
        }
        if (testCase.ages6to9.maxSafetyScore !== undefined) {
          expect(result6to9.safetyScore).toBeLessThanOrEqual(testCase.ages6to9.maxSafetyScore);
        }

        if (testCase.ages10to13.expectClean !== undefined) {
          expect(result10to13.isClean).toBe(testCase.ages10to13.expectClean);
        }
        if (testCase.ages10to13.minSafetyScore !== undefined) {
          expect(result10to13.safetyScore).toBeGreaterThanOrEqual(testCase.ages10to13.minSafetyScore);
        }

        if (testCase.ages14to16.expectClean !== undefined) {
          expect(result14to16.isClean).toBe(testCase.ages14to16.expectClean);
        }
        if (testCase.ages14to16.minSafetyScore !== undefined) {
          expect(result14to16.safetyScore).toBeGreaterThanOrEqual(testCase.ages14to16.minSafetyScore);
        }
      });
    });
  });

  describe('modification types coverage', () => {
    it('should properly categorize all modification types', async () => {
      const testCases = [
        { content: 'Visit https://example.com', expectedType: 'url_removal' },
        { content: 'Delete your files', expectedType: 'harmful_instruction' },
        { content: 'Take some aspirin', expectedType: 'medical_advice' },
        { content: 'You should sue them', expectedType: 'legal_advice' },
        { content: 'Check Facebook', expectedType: 'social_media' },
        { content: 'What is your address?', expectedType: 'personal_info_request' },
        { content: 'Email me at test@test.com', expectedType: 'inappropriate_contact' },
        { content: 'I want to hurt myself', expectedType: 'emergency_contact' },
        { content: 'Buy stocks', expectedType: 'financial_advice' }
      ];

      const config: SafetyCheckConfig = {
        ageGroup: 'ages10to13',
        strictMode: true
      };

      for (const { content, expectedType } of testCases) {
        const result = await service.sanitizeResponse(content, config);
        expect(result.modifications.some(m => m.type === expectedType as ModificationType)).toBe(true);
      }
    });
  });

  describe('strict mode vs non-strict mode', () => {
    it('should be more permissive in non-strict mode', async () => {
      const borderlineContent = 'You might want to check out this educational website for more practice.';

      const strictConfig: SafetyCheckConfig = {
        ageGroup: 'ages10to13',
        strictMode: true
      };

      const nonStrictConfig: SafetyCheckConfig = {
        ageGroup: 'ages10to13',
        strictMode: false
      };

      const strictResult = await service.sanitizeResponse(borderlineContent, strictConfig);
      const nonStrictResult = await service.sanitizeResponse(borderlineContent, nonStrictConfig);

      expect(nonStrictResult.safetyScore).toBeGreaterThanOrEqual(strictResult.safetyScore);
    });
  });

  describe('getStatistics', () => {
    it('should return sanitization statistics', () => {
      const stats = service.getStatistics();

      expect(stats).toHaveProperty('checksLoaded');
      expect(stats).toHaveProperty('ageGroupsSupported');
      expect(stats.checksLoaded).toBeGreaterThan(0);
      expect(stats.ageGroupsSupported).toBe(3);
    });
  });
});
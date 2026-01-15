import winston from 'winston';
import {
  TextToSpeechService,
  createTextToSpeechService,
  defaultTTSConfig,
  TTSConfig,
  TTSRequest,
  VoiceProfile
} from '../textToSpeech';
import { AgeGroup } from '../chatgpt';

// Mock OpenAI
const mockAudioCreate = jest.fn();
const mockOpenAI = {
  audio: {
    speech: {
      create: mockAudioCreate
    }
  }
};

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockOpenAI)
  };
});

describe('TextToSpeechService', () => {
  let service: TextToSpeechService;
  let mockLogger: winston.Logger;
  let testConfig: TTSConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock successful OpenAI response
    mockAudioCreate.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    // Test configuration
    testConfig = {
      openaiApiKey: 'test-api-key',
      defaultVoice: 'nova',
      cacheEnabled: true,
      maxCacheSize: 100,
      compressionEnabled: true,
      maxTextLength: 4000,
      timeoutMs: 30000
    };

    // Create service instance
    service = new TextToSpeechService(testConfig, mockLogger);

    // Mock successful audio response
    const mockAudioBuffer = Buffer.from('mock-audio-data');
    mockAudioCreate.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(service).toBeInstanceOf(TextToSpeechService);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'TextToSpeechService initialized',
        expect.objectContaining({
          cacheEnabled: true,
          maxCacheSize: 100
        })
      );
    });

    it('should load voice profiles for all age groups', () => {
      const ageGroups: AgeGroup[] = ['ages6to9', 'ages10to13', 'ages14to16'];

      ageGroups.forEach(ageGroup => {
        const profiles = service.getVoiceProfiles(ageGroup);
        expect(profiles.length).toBeGreaterThan(0);
        expect(profiles[0].ageGroup).toBe(ageGroup);
      });
    });
  });

  describe('Speech Synthesis', () => {
    const testVoiceProfile: VoiceProfile = {
      id: 'test-voice',
      name: 'Test Voice',
      ageGroup: 'ages10to13',
      engine: 'openai',
      voiceId: 'nova',
      characteristics: {
        gender: 'female',
        tone: 'friendly',
        speed: 1.0,
        pitch: 1.0
      },
      description: 'Test voice for unit testing'
    };

    it('should synthesize speech successfully', async () => {
      const request: TTSRequest = {
        text: 'Hello, this is a test message.',
        voiceProfile: testVoiceProfile
      };

      const response = await service.synthesizeSpeech(request);

      expect(response.audioBuffer).toBeInstanceOf(Buffer);
      expect(response.metadata.voiceProfile.id).toBe('test-voice');
      expect(response.metadata.processingTime).toBeGreaterThan(0);
      expect(response.metadata.cacheHit).toBe(false);
    });

    it('should call OpenAI TTS with correct parameters', async () => {
      const request: TTSRequest = {
        text: 'Test synthesis',
        voiceProfile: testVoiceProfile,
        options: {
          speed: 1.2,
          format: 'wav',
          quality: 'high'
        }
      };

      await service.synthesizeSpeech(request);

      expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith({
        model: 'tts-1-hd',
        voice: 'nova',
        input: 'Test synthesis',
        response_format: 'wav',
        speed: 1.2
      });
    });

    it('should use voice profile speed when no override provided', async () => {
      const customProfile: VoiceProfile = {
        ...testVoiceProfile,
        characteristics: {
          ...testVoiceProfile.characteristics,
          speed: 0.8
        }
      };

      const request: TTSRequest = {
        text: 'Test with profile speed',
        voiceProfile: customProfile
      };

      await service.synthesizeSpeech(request);

      expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith(
        expect.objectContaining({
          speed: 0.8
        })
      );
    });

    it('should handle different age groups appropriately', async () => {
      const youngProfile = service.getDefaultVoiceProfile('ages6to9');
      const teenProfile = service.getDefaultVoiceProfile('ages14to16');

      const youngRequest: TTSRequest = {
        text: 'Hello young learner!',
        voiceProfile: youngProfile
      };

      const teenRequest: TTSRequest = {
        text: 'Hello advanced student!',
        voiceProfile: teenProfile
      };

      const youngResponse = await service.synthesizeSpeech(youngRequest);
      const teenResponse = await service.synthesizeSpeech(teenRequest);

      expect(youngResponse.metadata.voiceProfile.ageGroup).toBe('ages6to9');
      expect(teenResponse.metadata.voiceProfile.ageGroup).toBe('ages14to16');
    });
  });

  describe('Content Processing', () => {
    it('should process mathematical expressions correctly', async () => {
      const mathText = 'The equation is 2 + 3 = 5 and 10 / 2 = 5.';
      const request: TTSRequest = {
        text: mathText,
        voiceProfile: service.getDefaultVoiceProfile('ages10to13')
      };

      await service.synthesizeSpeech(request);

      const processedCall = mockOpenAI.audio.speech.create.mock.calls[0][0];
      expect(processedCall.input).toContain('plus');
      expect(processedCall.input).toContain('equals');
      expect(processedCall.input).toContain('divided by');
    });

    it('should handle fractions properly', async () => {
      const fractionText = 'One half is 1/2 and three quarters is 3/4.';
      const request: TTSRequest = {
        text: fractionText,
        voiceProfile: service.getDefaultVoiceProfile('ages6to9')
      };

      await service.synthesizeSpeech(request);

      const processedCall = mockOpenAI.audio.speech.create.mock.calls[0][0];
      expect(processedCall.input).toContain('one half');
      expect(processedCall.input).toContain('three quarters');
    });

    it('should process powers and exponents', async () => {
      const powerText = 'x^2 means x squared and 2^3 equals 8.';
      const request: TTSRequest = {
        text: powerText,
        voiceProfile: service.getDefaultVoiceProfile('ages14to16')
      };

      await service.synthesizeSpeech(request);

      const processedCall = mockOpenAI.audio.speech.create.mock.calls[0][0];
      expect(processedCall.input).toContain('x squared');
      expect(processedCall.input).toContain('2 to the power of 3');
    });

    it('should handle percentages and square roots', async () => {
      const mathText = '50% of students know that √16 = 4.';
      const request: TTSRequest = {
        text: mathText,
        voiceProfile: service.getDefaultVoiceProfile('ages10to13')
      };

      await service.synthesizeSpeech(request);

      const processedCall = mockOpenAI.audio.speech.create.mock.calls[0][0];
      expect(processedCall.input).toContain('percent');
      expect(processedCall.input).toContain('square root');
    });

    it('should remove formatting markup', async () => {
      const formattedText = 'This is **bold** and *italic* text with `code`.';
      const request: TTSRequest = {
        text: formattedText,
        voiceProfile: service.getDefaultVoiceProfile('ages10to13')
      };

      await service.synthesizeSpeech(request);

      const processedCall = mockOpenAI.audio.speech.create.mock.calls[0][0];
      expect(processedCall.input).not.toContain('**');
      expect(processedCall.input).not.toContain('*');
      expect(processedCall.input).not.toContain('`');
      expect(processedCall.input).toContain('bold');
      expect(processedCall.input).toContain('italic');
    });

    it('should expand abbreviations', async () => {
      const abbreviatedText = 'Dr. Smith and Prof. Johnson discussed AI and HTML.';
      const request: TTSRequest = {
        text: abbreviatedText,
        voiceProfile: service.getDefaultVoiceProfile('ages14to16')
      };

      await service.synthesizeSpeech(request);

      const processedCall = mockOpenAI.audio.speech.create.mock.calls[0][0];
      expect(processedCall.input).toContain('Doctor');
      expect(processedCall.input).toContain('Professor');
      expect(processedCall.input).toContain('A I');
      expect(processedCall.input).toContain('H T M L');
    });

    it('should handle URLs and email addresses', async () => {
      const urlText = 'Visit https://example.com or email test@example.com.';
      const request: TTSRequest = {
        text: urlText,
        voiceProfile: service.getDefaultVoiceProfile('ages10to13')
      };

      await service.synthesizeSpeech(request);

      const processedCall = mockOpenAI.audio.speech.create.mock.calls[0][0];
      expect(processedCall.input).toContain('web link');
      expect(processedCall.input).toContain('email address');
      expect(processedCall.input).not.toContain('https://');
      expect(processedCall.input).not.toContain('@');
    });
  });

  describe('Caching', () => {
    it('should cache audio responses', async () => {
      const request: TTSRequest = {
        text: 'Cacheable test message',
        voiceProfile: service.getDefaultVoiceProfile('ages10to13')
      };

      // First request
      const response1 = await service.synthesizeSpeech(request);
      expect(response1.metadata.cacheHit).toBe(false);

      // Second identical request should hit cache
      const response2 = await service.synthesizeSpeech(request);
      expect(response2.metadata.cacheHit).toBe(true);

      // OpenAI should only be called once
      expect(mockOpenAI.audio.speech.create).toHaveBeenCalledTimes(1);
    });

    it('should respect cache size limits', async () => {
      const smallCacheConfig = { ...testConfig, maxCacheSize: 2 };
      const smallCacheService = new TextToSpeechService(smallCacheConfig, mockLogger);

      const requests = [
        { text: 'First message', voiceProfile: service.getDefaultVoiceProfile('ages10to13') },
        { text: 'Second message', voiceProfile: service.getDefaultVoiceProfile('ages10to13') },
        { text: 'Third message', voiceProfile: service.getDefaultVoiceProfile('ages10to13') }
      ];

      // Fill cache beyond limit
      for (const request of requests) {
        await smallCacheService.synthesizeSpeech(request);
      }

      const cacheInfo = smallCacheService.getCacheInfo();
      expect(cacheInfo.size).toBeLessThanOrEqual(2);
    });

    it('should provide cache information', async () => {
      const cacheInfo = service.getCacheInfo();
      expect(cacheInfo).toHaveProperty('size');
      expect(cacheInfo).toHaveProperty('maxSize');
      expect(cacheInfo).toHaveProperty('hitRate');
    });

    it('should clear cache when requested', async () => {
      // Add something to cache first
      await service.synthesizeSpeech({
        text: 'Cache test',
        voiceProfile: service.getDefaultVoiceProfile('ages10to13')
      });

      const clearedCount = service.clearCache();
      expect(clearedCount).toBeGreaterThan(0);

      const cacheInfo = service.getCacheInfo();
      expect(cacheInfo.size).toBe(0);
    });
  });

  describe('Voice Profile Management', () => {
    it('should return voice profiles for each age group', () => {
      const youngProfiles = service.getVoiceProfiles('ages6to9');
      const middleProfiles = service.getVoiceProfiles('ages10to13');
      const teenProfiles = service.getVoiceProfiles('ages14to16');

      expect(youngProfiles.length).toBeGreaterThan(0);
      expect(middleProfiles.length).toBeGreaterThan(0);
      expect(teenProfiles.length).toBeGreaterThan(0);

      // Each profile should have appropriate characteristics for its age group
      expect(youngProfiles[0].characteristics.speed).toBeLessThanOrEqual(1.0);
      expect(teenProfiles[0].characteristics.speed).toBeGreaterThanOrEqual(1.0);
    });

    it('should return default voice profiles', () => {
      const defaultYoung = service.getDefaultVoiceProfile('ages6to9');
      const defaultMiddle = service.getDefaultVoiceProfile('ages10to13');
      const defaultTeen = service.getDefaultVoiceProfile('ages14to16');

      expect(defaultYoung.ageGroup).toBe('ages6to9');
      expect(defaultMiddle.ageGroup).toBe('ages10to13');
      expect(defaultTeen.ageGroup).toBe('ages14to16');
    });

    it('should find voice profiles by ID', () => {
      const allProfiles = [
        ...service.getVoiceProfiles('ages6to9'),
        ...service.getVoiceProfiles('ages10to13'),
        ...service.getVoiceProfiles('ages14to16')
      ];

      const firstProfile = allProfiles[0];
      const foundProfile = service.getVoiceProfileById(firstProfile.id);

      expect(foundProfile).toEqual(firstProfile);
    });

    it('should return undefined for unknown voice profile ID', () => {
      const unknownProfile = service.getVoiceProfileById('unknown-voice-id');
      expect(unknownProfile).toBeUndefined();
    });
  });

  describe('Input Validation', () => {
    it('should reject empty text', async () => {
      const request: TTSRequest = {
        text: '',
        voiceProfile: service.getDefaultVoiceProfile('ages10to13')
      };

      await expect(service.synthesizeSpeech(request)).rejects.toThrow('Text content is required');
    });

    it('should reject text that is too long', async () => {
      const longText = 'a'.repeat(5000); // Exceeds maxTextLength of 4000
      const request: TTSRequest = {
        text: longText,
        voiceProfile: service.getDefaultVoiceProfile('ages10to13')
      };

      await expect(service.synthesizeSpeech(request)).rejects.toThrow('Text length');
    });

    it('should reject invalid speed values', async () => {
      const request: TTSRequest = {
        text: 'Test message',
        voiceProfile: service.getDefaultVoiceProfile('ages10to13'),
        options: { speed: 3.0 } // Too high
      };

      await expect(service.synthesizeSpeech(request)).rejects.toThrow('Speed must be between');
    });

    it('should reject missing voice profile', async () => {
      const request: TTSRequest = {
        text: 'Test message',
        voiceProfile: null as any
      };

      await expect(service.synthesizeSpeech(request)).rejects.toThrow('Valid voice profile is required');
    });
  });

  describe('Error Handling', () => {
    it('should handle OpenAI API errors gracefully', async () => {
      const apiError = new Error('OpenAI API error');
      mockOpenAI.audio.speech.create.mockRejectedValue(apiError);

      const request: TTSRequest = {
        text: 'Test message',
        voiceProfile: service.getDefaultVoiceProfile('ages10to13')
      };

      await expect(service.synthesizeSpeech(request)).rejects.toThrow('Text-to-speech synthesis failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'TTS synthesis failed',
        expect.objectContaining({
          error: 'OpenAI API error'
        })
      );
    });

    it('should update error statistics on failures', async () => {
      mockOpenAI.audio.speech.create.mockRejectedValue(new Error('Test error'));

      const request: TTSRequest = {
        text: 'Test message',
        voiceProfile: service.getDefaultVoiceProfile('ages10to13')
      };

      try {
        await service.synthesizeSpeech(request);
      } catch (error) {
        // Expected error
      }

      const stats = service.getStats();
      expect(stats.errorRate).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should track processing statistics', async () => {
      const requests = [
        { text: 'Simple text', voiceProfile: service.getDefaultVoiceProfile('ages6to9') },
        { text: '2 + 2 = 4', voiceProfile: service.getDefaultVoiceProfile('ages10to13') },
        { text: 'This is **bold** text', voiceProfile: service.getDefaultVoiceProfile('ages14to16') }
      ];

      for (const request of requests) {
        await service.synthesizeSpeech(request);
      }

      const stats = service.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.ageGroupUsage.ages6to9).toBe(1);
      expect(stats.ageGroupUsage.ages10to13).toBe(1);
      expect(stats.ageGroupUsage.ages14to16).toBe(1);
      expect(stats.contentTypes.simple).toBeGreaterThan(0);
      expect(stats.contentTypes.mathematical).toBeGreaterThan(0);
      expect(stats.contentTypes.formatted).toBeGreaterThan(0);
    });

    it('should classify content types correctly', async () => {
      const mathRequest: TTSRequest = {
        text: 'Calculate 5 + 3 = 8',
        voiceProfile: service.getDefaultVoiceProfile('ages10to13')
      };

      const formattedRequest: TTSRequest = {
        text: 'This has **bold** formatting',
        voiceProfile: service.getDefaultVoiceProfile('ages10to13')
      };

      const mixedRequest: TTSRequest = {
        text: '**Bold** equation: 2 + 2 = 4',
        voiceProfile: service.getDefaultVoiceProfile('ages10to13')
      };

      await service.synthesizeSpeech(mathRequest);
      await service.synthesizeSpeech(formattedRequest);
      await service.synthesizeSpeech(mixedRequest);

      const stats = service.getStats();
      expect(stats.contentTypes.mathematical).toBeGreaterThan(0);
      expect(stats.contentTypes.formatted).toBeGreaterThan(0);
      expect(stats.contentTypes.mixed).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should estimate audio duration accurately', async () => {
      const shortText = 'Hello.';
      const longText = 'This is a much longer text that should take more time to speak when converted to audio using text-to-speech technology.';

      const shortRequest: TTSRequest = {
        text: shortText,
        voiceProfile: service.getDefaultVoiceProfile('ages10to13')
      };

      const longRequest: TTSRequest = {
        text: longText,
        voiceProfile: service.getDefaultVoiceProfile('ages10to13')
      };

      const shortResponse = await service.synthesizeSpeech(shortRequest);
      const longResponse = await service.synthesizeSpeech(longRequest);

      expect(longResponse.metadata.duration).toBeGreaterThan(shortResponse.metadata.duration);
    });

    it('should track average processing time', async () => {
      const request: TTSRequest = {
        text: 'Performance test message',
        voiceProfile: service.getDefaultVoiceProfile('ages10to13')
      };

      await service.synthesizeSpeech(request);

      const stats = service.getStats();
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });
  });

  describe('Health Check', () => {
    it('should perform successful health check', async () => {
      const health = await service.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.latency).toBeGreaterThan(0);
      expect(health.cacheStatus).toBe('enabled');
      expect(health.voiceProfilesLoaded).toBeGreaterThan(0);
    });

    it('should report unhealthy status on API failure', async () => {
      mockOpenAI.audio.speech.create.mockRejectedValue(new Error('API down'));

      const health = await service.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.voiceProfilesLoaded).toBeGreaterThan(0);
    });
  });

  describe('Factory Function', () => {
    it('should create service instance using factory', () => {
      const factoryService = createTextToSpeechService(testConfig, mockLogger);
      expect(factoryService).toBeInstanceOf(TextToSpeechService);
    });
  });

  describe('Default Configuration', () => {
    it('should provide sensible defaults', () => {
      expect(defaultTTSConfig.defaultVoice).toBe('nova');
      expect(defaultTTSConfig.cacheEnabled).toBe(true);
      expect(defaultTTSConfig.maxCacheSize).toBe(1000);
      expect(defaultTTSConfig.maxTextLength).toBe(4000);
      expect(defaultTTSConfig.timeoutMs).toBe(30000);
    });
  });
});
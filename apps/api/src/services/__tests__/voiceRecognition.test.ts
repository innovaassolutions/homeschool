import winston from 'winston';
import { Readable } from 'stream';
import {
  VoiceRecognitionService,
  createVoiceRecognitionService,
  defaultVoiceRecognitionConfig,
  VoiceRecognitionConfig,
  VoiceRecognitionOptions,
  AudioMetadata,
  VoiceRecognitionResult
} from '../voiceRecognition';
import { AgeGroup } from '../chatgpt';

// Mock OpenAI
const mockTranscriptionCreate = jest.fn();
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: mockTranscriptionCreate
        }
      }
    }))
  };
});

describe('VoiceRecognitionService', () => {
  let service: VoiceRecognitionService;
  let mockLogger: winston.Logger;
  let testConfig: VoiceRecognitionConfig;
  let originalDateNow: typeof Date.now;

  // Test audio data
  const testAudioBuffer = Buffer.from('mock-audio-data');
  const testAudioMetadata: AudioMetadata = {
    format: 'wav',
    sampleRate: 16000,
    channels: 1,
    duration: 5.2,
    size: testAudioBuffer.length,
    quality: 'high'
  };

  beforeEach(() => {
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
      model: 'whisper-1',
      maxAudioSize: 25 * 1024 * 1024,
      confidenceThreshold: 0.7,
      childSpeechPrompts: {},
      supportedFormats: ['wav', 'mp3', 'ogg', 'webm'],
      processingTimeout: 30000
    };

    // Mock Date.now to provide predictable timing
    originalDateNow = Date.now;
    let currentTime = 1000;
    Date.now = jest.fn(() => {
      currentTime += 100; // Each call adds 100ms
      return currentTime;
    });

    // Clear all mocks before creating service
    jest.clearAllMocks();

    // Create service instance after clearing mocks
    service = new VoiceRecognitionService(testConfig, mockLogger);
  });

  afterEach(() => {
    // Restore original Date.now
    Date.now = originalDateNow;
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(service).toBeInstanceOf(VoiceRecognitionService);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'VoiceRecognitionService initialized',
        expect.objectContaining({
          model: 'whisper-1',
          maxAudioSize: 25 * 1024 * 1024,
          supportedFormats: testConfig.supportedFormats
        })
      );
    });

    it('should use default child speech prompts', () => {
      const stats = service.getStats();
      expect(stats.totalProcessed).toBe(0);
      expect(stats.ageGroupBreakdown).toEqual({
        ages6to9: 0,
        ages10to13: 0,
        ages14to16: 0
      });
    });
  });

  describe('Audio Processing', () => {
    const mockTranscription = {
      text: 'Hello, I need help with my math homework',
      language: 'en',
      duration: 5.2
    };

    beforeEach(() => {
      mockTranscriptionCreate.mockResolvedValue(mockTranscription);
    });

    it('should process audio successfully for ages6to9', async () => {
      const options: VoiceRecognitionOptions = {
        ageGroup: 'ages6to9',
        enableChildOptimization: true
      };

      const result = await service.processAudio(testAudioBuffer, testAudioMetadata, options);

      expect(result).toEqual(expect.objectContaining({
        text: mockTranscription.text,
        ageGroup: 'ages6to9',
        duration: 5.2,
        language: 'en'
      }));

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(typeof result.clarificationNeeded).toBe('boolean');
    });

    it('should process audio successfully for ages10to13', async () => {
      const options: VoiceRecognitionOptions = {
        ageGroup: 'ages10to13',
        language: 'en'
      };

      const result = await service.processAudio(testAudioBuffer, testAudioMetadata, options);

      expect(result.ageGroup).toBe('ages10to13');
      expect(result.text).toBe(mockTranscription.text);
    });

    it('should process audio successfully for ages14to16', async () => {
      const options: VoiceRecognitionOptions = {
        ageGroup: 'ages14to16',
        temperature: 0.1
      };

      const result = await service.processAudio(testAudioBuffer, testAudioMetadata, options);

      expect(result.ageGroup).toBe('ages14to16');
      expect(result.text).toBe(mockTranscription.text);
    });

    it('should call Whisper API with correct parameters for child speech', async () => {
      const options: VoiceRecognitionOptions = {
        ageGroup: 'ages6to9',
        prompt: 'Math lesson context'
      };

      await service.processAudio(testAudioBuffer, testAudioMetadata, options);

      expect(mockTranscriptionCreate).toHaveBeenCalledWith({
        file: expect.any(Object), // Readable stream
        model: 'whisper-1',
        prompt: expect.stringContaining('young child aged 6-9'),
        language: 'en',
        temperature: 0.2,
        response_format: 'verbose_json'
      });
    });

    it('should include context prompt when provided', async () => {
      const options: VoiceRecognitionOptions = {
        ageGroup: 'ages10to13',
        prompt: 'Science lesson about planets'
      };

      await service.processAudio(testAudioBuffer, testAudioMetadata, options);

      const callArgs = mockTranscriptionCreate.mock.calls[0][0];
      expect(callArgs.prompt).toContain('Science lesson about planets');
    });

    it('should update statistics after processing', async () => {
      const options: VoiceRecognitionOptions = {
        ageGroup: 'ages6to9'
      };

      await service.processAudio(testAudioBuffer, testAudioMetadata, options);

      const stats = service.getStats();
      expect(stats.totalProcessed).toBe(1);
      expect(stats.ageGroupBreakdown.ages6to9).toBe(1);
      expect(stats.averageConfidence).toBeGreaterThan(0);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });
  });

  describe('Audio Validation', () => {
    it('should reject audio that is too large', async () => {
      const largeBuffer = Buffer.alloc(30 * 1024 * 1024); // 30MB
      const options: VoiceRecognitionOptions = { ageGroup: 'ages10to13' };

      await expect(
        service.processAudio(largeBuffer, testAudioMetadata, options)
      ).rejects.toThrow('Audio file too large');
    });

    it('should reject unsupported audio formats', async () => {
      const unsupportedMetadata: AudioMetadata = {
        ...testAudioMetadata,
        format: 'xyz'
      };
      const options: VoiceRecognitionOptions = { ageGroup: 'ages10to13' };

      await expect(
        service.processAudio(testAudioBuffer, unsupportedMetadata, options)
      ).rejects.toThrow('Unsupported audio format');
    });

    it('should reject audio that exceeds maximum duration', async () => {
      const longAudioMetadata: AudioMetadata = {
        ...testAudioMetadata,
        duration: 60 // 60 seconds
      };
      const options: VoiceRecognitionOptions = {
        ageGroup: 'ages10to13',
        maxDuration: 30
      };

      await expect(
        service.processAudio(testAudioBuffer, longAudioMetadata, options)
      ).rejects.toThrow('Audio duration');
    });

    it('should reject invalid age groups', async () => {
      const options: VoiceRecognitionOptions = {
        ageGroup: 'invalid' as AgeGroup
      };

      await expect(
        service.processAudio(testAudioBuffer, testAudioMetadata, options)
      ).rejects.toThrow('Invalid age group');
    });
  });

  describe('Confidence Calculation', () => {
    it('should return low confidence for empty transcription', async () => {
      mockTranscriptionCreate.mockResolvedValue({
        text: '',
        language: 'en',
        duration: 1.0
      });

      const options: VoiceRecognitionOptions = { ageGroup: 'ages10to13' };
      const result = await service.processAudio(testAudioBuffer, testAudioMetadata, options);

      expect(result.confidence).toBe(0);
      expect(result.clarificationNeeded).toBe(true);
    });

    it('should return low confidence for very short responses', async () => {
      mockTranscriptionCreate.mockResolvedValue({
        text: 'Um',
        language: 'en',
        duration: 1.0
      });

      const options: VoiceRecognitionOptions = { ageGroup: 'ages10to13' };
      const result = await service.processAudio(testAudioBuffer, testAudioMetadata, options);

      expect(result.confidence).toBeLessThan(0.7);
      expect(result.clarificationNeeded).toBe(true);
    });

    it('should return low confidence for unclear audio indicators', async () => {
      mockTranscriptionCreate.mockResolvedValue({
        text: 'I need help with [inaudible] homework',
        language: 'en',
        duration: 3.0
      });

      const options: VoiceRecognitionOptions = { ageGroup: 'ages10to13' };
      const result = await service.processAudio(testAudioBuffer, testAudioMetadata, options);

      expect(result.confidence).toBeLessThan(0.5);
      expect(result.clarificationNeeded).toBe(true);
    });

    it('should adjust confidence based on age group', async () => {
      mockTranscriptionCreate.mockResolvedValue({
        text: 'I want to learn about dinosaurs',
        language: 'en',
        duration: 3.0
      });

      // Test younger child (lower threshold)
      const youngOptions: VoiceRecognitionOptions = { ageGroup: 'ages6to9' };
      const youngResult = await service.processAudio(testAudioBuffer, testAudioMetadata, youngOptions);

      // Test older child (higher threshold)
      const olderOptions: VoiceRecognitionOptions = { ageGroup: 'ages14to16' };
      const olderResult = await service.processAudio(testAudioBuffer, testAudioMetadata, olderOptions);

      // Older children have higher confidence threshold
      expect(olderResult.confidence).toBeGreaterThan(youngResult.confidence);
    });
  });

  describe('Error Handling', () => {
    it('should handle OpenAI API errors gracefully', async () => {
      const apiError = new Error('OpenAI API error');
      mockTranscriptionCreate.mockRejectedValue(apiError);

      const options: VoiceRecognitionOptions = { ageGroup: 'ages10to13' };

      await expect(
        service.processAudio(testAudioBuffer, testAudioMetadata, options)
      ).rejects.toThrow('Voice recognition failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Voice recognition processing failed',
        expect.objectContaining({
          error: 'OpenAI API error',
          ageGroup: 'ages10to13'
        })
      );

      const stats = service.getStats();
      expect(stats.errorCount).toBe(1);
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      mockTranscriptionCreate.mockRejectedValue(timeoutError);

      const options: VoiceRecognitionOptions = { ageGroup: 'ages10to13' };

      await expect(
        service.processAudio(testAudioBuffer, testAudioMetadata, options)
      ).rejects.toThrow('Voice recognition failed');
    });
  });

  describe('Statistics and Analytics', () => {
    it('should track processing statistics across multiple calls', async () => {
      mockTranscriptionCreate.mockResolvedValue({
        text: 'Test transcription',
        language: 'en',
        duration: 2.5
      });

      // Process multiple audio samples
      await service.processAudio(testAudioBuffer, testAudioMetadata, { ageGroup: 'ages6to9' });
      await service.processAudio(testAudioBuffer, testAudioMetadata, { ageGroup: 'ages10to13' });
      await service.processAudio(testAudioBuffer, testAudioMetadata, { ageGroup: 'ages14to16' });

      const stats = service.getStats();
      expect(stats.totalProcessed).toBe(3);
      expect(stats.ageGroupBreakdown.ages6to9).toBe(1);
      expect(stats.ageGroupBreakdown.ages10to13).toBe(1);
      expect(stats.ageGroupBreakdown.ages14to16).toBe(1);
      expect(stats.averageConfidence).toBeGreaterThan(0);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });

    it('should track clarification requests', async () => {
      // Mock low confidence response
      mockTranscriptionCreate.mockResolvedValue({
        text: 'Um',
        language: 'en',
        duration: 1.0
      });

      const options: VoiceRecognitionOptions = { ageGroup: 'ages10to13' };
      await service.processAudio(testAudioBuffer, testAudioMetadata, options);

      const stats = service.getStats();
      expect(stats.clarificationRequests).toBe(1);
    });

    it('should reset statistics when requested', async () => {
      // Process some audio first
      mockTranscriptionCreate.mockResolvedValue({
        text: 'Test',
        language: 'en',
        duration: 1.0
      });

      await service.processAudio(testAudioBuffer, testAudioMetadata, { ageGroup: 'ages10to13' });

      // Reset stats
      service.resetStats();

      const stats = service.getStats();
      expect(stats.totalProcessed).toBe(0);
      expect(stats.averageConfidence).toBe(0);
      expect(stats.clarificationRequests).toBe(0);
    });
  });

  describe('Clarification Messages', () => {
    it('should generate age-appropriate clarification messages', () => {
      const youngMessage = service.generateClarificationMessage('ages6to9');
      expect(youngMessage).toContain('little louder');

      const middleMessage = service.generateClarificationMessage('ages10to13');
      expect(middleMessage).toContain('repeat');

      const olderMessage = service.generateClarificationMessage('ages14to16');
      expect(olderMessage).toContain('please repeat');
    });
  });

  describe('Format Support', () => {
    it('should correctly identify supported formats', () => {
      expect(service.isFormatSupported('wav')).toBe(true);
      expect(service.isFormatSupported('mp3')).toBe(true);
      expect(service.isFormatSupported('xyz')).toBe(false);
      expect(service.isFormatSupported('WAV')).toBe(true); // Case insensitive
    });

    it('should provide recommended settings for different age groups', () => {
      const youngSettings = service.getRecommendedSettings('ages6to9');
      expect(youngSettings.maxDuration).toBe(15); // Shorter for younger children

      const olderSettings = service.getRecommendedSettings('ages10to13');
      expect(olderSettings.maxDuration).toBe(30); // Standard duration

      expect(youngSettings.sampleRate).toBe(16000);
      expect(youngSettings.channels).toBe(1);
      expect(youngSettings.format).toBe('wav');
    });
  });

  describe('Child Speech Optimization', () => {
    it('should use age-specific prompts for Whisper', async () => {
      mockTranscriptionCreate.mockResolvedValue({
        text: 'I wanna learn about animals',
        language: 'en',
        duration: 2.0
      });

      const options: VoiceRecognitionOptions = {
        ageGroup: 'ages6to9',
        enableChildOptimization: true
      };

      await service.processAudio(testAudioBuffer, testAudioMetadata, options);

      const callArgs = mockTranscriptionCreate.mock.calls[0][0];
      expect(callArgs.prompt).toContain('young child aged 6-9');
      expect(callArgs.prompt).toContain('mispronunciations');
      expect(callArgs.prompt).toContain('incomplete sentences');
    });

    it('should use teenager-appropriate prompts for older children', async () => {
      mockTranscriptionCreate.mockResolvedValue({
        text: 'So like, I totally need help with this assignment',
        language: 'en',
        duration: 3.0
      });

      const options: VoiceRecognitionOptions = {
        ageGroup: 'ages14to16'
      };

      await service.processAudio(testAudioBuffer, testAudioMetadata, options);

      const callArgs = mockTranscriptionCreate.mock.calls[0][0];
      expect(callArgs.prompt).toContain('teenager aged 14-16');
      expect(callArgs.prompt).toContain('teen slang');
    });
  });

  describe('Performance Requirements', () => {
    it('should process audio within reasonable time limits', async () => {
      mockTranscriptionCreate.mockResolvedValue({
        text: 'Quick response test',
        language: 'en',
        duration: 1.0
      });

      const startTime = Date.now();
      const options: VoiceRecognitionOptions = { ageGroup: 'ages10to13' };

      const result = await service.processAudio(testAudioBuffer, testAudioMetadata, options);

      const totalTime = Date.now() - startTime;

      // Should complete within reasonable time (allowing for test overhead)
      expect(totalTime).toBeLessThan(5000); // 5 seconds max for test
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Factory Function', () => {
    it('should create service instance using factory', () => {
      const factoryService = createVoiceRecognitionService(testConfig, mockLogger);
      expect(factoryService).toBeInstanceOf(VoiceRecognitionService);
    });
  });

  describe('Default Configuration', () => {
    it('should provide sensible default configuration', () => {
      expect(defaultVoiceRecognitionConfig.model).toBe('whisper-1');
      expect(defaultVoiceRecognitionConfig.maxAudioSize).toBe(25 * 1024 * 1024);
      expect(defaultVoiceRecognitionConfig.supportedFormats).toContain('wav');
      expect(defaultVoiceRecognitionConfig.supportedFormats).toContain('mp3');
      expect(defaultVoiceRecognitionConfig.processingTimeout).toBe(30000);
    });
  });

  describe('COPPA Compliance', () => {
    it('should not store audio data permanently', async () => {
      mockTranscriptionCreate.mockResolvedValue({
        text: 'Privacy test',
        language: 'en',
        duration: 2.0
      });

      const options: VoiceRecognitionOptions = { ageGroup: 'ages6to9' };
      await service.processAudio(testAudioBuffer, testAudioMetadata, options);

      // Verify that no permanent storage is attempted
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('storing audio')
      );
    });

    it('should log processing events for audit trail', async () => {
      mockTranscriptionCreate.mockResolvedValue({
        text: 'Audit test',
        language: 'en',
        duration: 1.5
      });

      const options: VoiceRecognitionOptions = { ageGroup: 'ages10to13' };
      await service.processAudio(testAudioBuffer, testAudioMetadata, options);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Audio processing completed',
        expect.objectContaining({
          ageGroup: 'ages10to13',
          processingTime: expect.any(Number)
        })
      );
    });
  });
});
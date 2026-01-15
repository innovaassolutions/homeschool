import OpenAI from 'openai';
import winston from 'winston';
import { Readable } from 'stream';
import { AgeGroup } from './chatgpt';

// Voice recognition result interface
export interface VoiceRecognitionResult {
  text: string;
  confidence: number;
  language?: string;
  duration: number;
  processingTime: number;
  ageGroup: AgeGroup;
  clarificationNeeded: boolean;
  alternativeTranscriptions?: string[];
}

// Voice recognition options
export interface VoiceRecognitionOptions {
  ageGroup: AgeGroup;
  language?: string;
  enableChildOptimization?: boolean;
  maxDuration?: number; // Maximum audio duration in seconds
  temperature?: number; // Controls randomness in Whisper output (0-1)
  prompt?: string; // Context prompt to improve accuracy
}

// Audio processing metadata
export interface AudioMetadata {
  format: string;
  sampleRate?: number;
  channels?: number;
  duration?: number;
  size: number;
  quality: 'low' | 'medium' | 'high';
}

// Voice processing statistics
export interface VoiceProcessingStats {
  totalProcessed: number;
  averageConfidence: number;
  averageProcessingTime: number;
  clarificationRequests: number;
  errorCount: number;
  ageGroupBreakdown: Record<AgeGroup, number>;
}

// Configuration interface
export interface VoiceRecognitionConfig {
  openaiApiKey: string;
  model: 'whisper-1';
  maxAudioSize: number; // Maximum file size in bytes (25MB for Whisper)
  confidenceThreshold: number; // Threshold below which clarification is needed
  childSpeechPrompts: Record<AgeGroup, string>;
  supportedFormats: string[];
  processingTimeout: number; // Maximum processing time in milliseconds
}

/**
 * Voice Recognition Service
 *
 * Handles speech-to-text conversion optimized for child speech patterns
 * using OpenAI Whisper API with COPPA-compliant processing.
 *
 * Key Features:
 * - Child speech pattern optimization
 * - Multiple audio format support
 * - Confidence scoring and clarification requests
 * - COPPA-compliant processing (no audio storage)
 * - Integration with ChatGPT conversation context
 */
export class VoiceRecognitionService {
  private openai: OpenAI;
  private logger: winston.Logger;
  private config: VoiceRecognitionConfig;
  private stats: VoiceProcessingStats;

  // Child-optimized prompts for different age groups
  private readonly childSpeechPrompts: Record<AgeGroup, string> = {
    ages6to9: "This is a conversation with a young child aged 6-9. The child may speak with simple vocabulary, mispronunciations, incomplete sentences, and may use fillers like 'um', 'uh', or repeat words. Please transcribe exactly what is said including any childlike speech patterns.",
    ages10to13: "This is a conversation with a child aged 10-13. The child may speak more clearly but might still have some pronunciation variations, use casual language, slang appropriate for their age, and speak at varying speeds. Please transcribe accurately including any age-appropriate expressions.",
    ages14to16: "This is a conversation with a teenager aged 14-16. They may speak quickly, use teen slang, have varying volume levels, and express complex thoughts. Please transcribe accurately including their natural speech patterns and expressions."
  };

  // Confidence thresholds by age group (younger children need more lenient thresholds)
  private readonly confidenceThresholds: Record<AgeGroup, number> = {
    ages6to9: 0.6,  // Lower threshold due to speech development
    ages10to13: 0.7, // Medium threshold
    ages14to16: 0.8  // Higher threshold for clearer speech
  };

  constructor(config: VoiceRecognitionConfig, logger: winston.Logger) {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });

    this.config = {
      ...config,
      childSpeechPrompts: { ...this.childSpeechPrompts, ...config.childSpeechPrompts }
    };

    this.logger = logger;

    this.stats = {
      totalProcessed: 0,
      averageConfidence: 0,
      averageProcessingTime: 0,
      clarificationRequests: 0,
      errorCount: 0,
      ageGroupBreakdown: {
        ages6to9: 0,
        ages10to13: 0,
        ages14to16: 0
      }
    };

    this.logger.info('VoiceRecognitionService initialized', {
      model: this.config.model,
      maxAudioSize: this.config.maxAudioSize,
      supportedFormats: this.config.supportedFormats
    });
  }

  /**
   * Process audio data and convert to text
   */
  async processAudio(
    audioBuffer: Buffer,
    metadata: AudioMetadata,
    options: VoiceRecognitionOptions
  ): Promise<VoiceRecognitionResult> {
    const startTime = Date.now();

    try {
      this.logger.debug('Processing audio', {
        size: audioBuffer.length,
        format: metadata.format,
        ageGroup: options.ageGroup,
        duration: metadata.duration
      });

      // Validate audio input
      this.validateAudioInput(audioBuffer, metadata, options);

      // Create audio stream for Whisper API
      const audioStream = this.createAudioStream(audioBuffer, metadata);

      // Prepare Whisper API call with child-optimized parameters
      const transcription = await this.transcribeWithWhisper(audioStream, metadata, options);

      // Calculate confidence and determine if clarification is needed
      const confidence = this.calculateConfidence(transcription, options);
      const clarificationNeeded = confidence < this.confidenceThresholds[options.ageGroup];

      const processingTime = Date.now() - startTime;

      // Update statistics
      this.updateStats(options.ageGroup, confidence, processingTime, clarificationNeeded);

      const result: VoiceRecognitionResult = {
        text: transcription.text,
        confidence,
        language: transcription.language,
        duration: metadata.duration || 0,
        processingTime,
        ageGroup: options.ageGroup,
        clarificationNeeded,
        alternativeTranscriptions: [] // Whisper doesn't provide alternatives, but we keep for future enhancement
      };

      this.logger.info('Audio processing completed', {
        textLength: result.text.length,
        confidence: result.confidence,
        processingTime: result.processingTime,
        clarificationNeeded: result.clarificationNeeded,
        ageGroup: options.ageGroup
      });

      return result;

    } catch (error) {
      this.stats.errorCount++;
      this.logger.error('Voice recognition processing failed', {
        error: error instanceof Error ? error.message : error,
        ageGroup: options.ageGroup,
        audioSize: audioBuffer.length,
        format: metadata.format
      });

      throw new Error(`Voice recognition failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate audio input before processing
   */
  private validateAudioInput(
    audioBuffer: Buffer,
    metadata: AudioMetadata,
    options: VoiceRecognitionOptions
  ): void {
    // Check file size
    if (audioBuffer.length > this.config.maxAudioSize) {
      throw new Error(`Audio file too large: ${audioBuffer.length} bytes exceeds ${this.config.maxAudioSize} bytes`);
    }

    // Check format support
    if (!this.config.supportedFormats.includes(metadata.format.toLowerCase())) {
      throw new Error(`Unsupported audio format: ${metadata.format}. Supported formats: ${this.config.supportedFormats.join(', ')}`);
    }

    // Check duration if specified
    if (options.maxDuration && metadata.duration && metadata.duration > options.maxDuration) {
      throw new Error(`Audio duration ${metadata.duration}s exceeds maximum ${options.maxDuration}s`);
    }

    // Validate age group
    if (!['ages6to9', 'ages10to13', 'ages14to16'].includes(options.ageGroup)) {
      throw new Error(`Invalid age group: ${options.ageGroup}`);
    }
  }

  /**
   * Create audio stream for Whisper API
   */
  private createAudioStream(audioBuffer: Buffer, metadata: AudioMetadata): Readable {
    const stream = new Readable({
      read() {}
    });

    stream.push(audioBuffer);
    stream.push(null); // End stream

    return stream;
  }

  /**
   * Transcribe audio using OpenAI Whisper with child-optimized parameters
   */
  private async transcribeWithWhisper(
    audioStream: Readable,
    metadata: AudioMetadata,
    options: VoiceRecognitionOptions
  ): Promise<OpenAI.Audio.Transcriptions.Transcription> {
    const childPrompt = this.config.childSpeechPrompts[options.ageGroup];
    const contextPrompt = options.prompt ? `${childPrompt} Context: ${options.prompt}` : childPrompt;

    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioStream as any, // Whisper accepts stream
        model: this.config.model,
        prompt: contextPrompt,
        language: options.language || 'en',
        temperature: options.temperature || 0.2, // Low temperature for consistent results
        response_format: 'verbose_json' // Get detailed response with confidence info
      });

      return transcription;
    } catch (error) {
      this.logger.error('Whisper API transcription failed', {
        error: error instanceof Error ? error.message : error,
        ageGroup: options.ageGroup
      });
      throw error;
    }
  }

  /**
   * Calculate confidence score based on transcription results
   * Note: Whisper doesn't provide explicit confidence scores, so we estimate based on output characteristics
   */
  private calculateConfidence(
    transcription: OpenAI.Audio.Transcriptions.Transcription,
    options: VoiceRecognitionOptions
  ): number {
    const text = transcription.text.trim();

    // Base confidence score
    let confidence = 0.8; // Default for Whisper

    // Adjust confidence based on text characteristics
    if (text.length === 0) {
      confidence = 0.0;
    } else if (text.length < 5) {
      confidence = 0.5; // Very short responses might be unclear
    } else if (text.includes('[inaudible]') || text.includes('[unclear]')) {
      confidence = 0.3; // Contains unclear sections
    } else if (text.match(/\b\w{15,}\b/)) {
      confidence = 0.6; // Contains very long words (might be misrecognized)
    } else if (text.split(' ').length > 50) {
      confidence = 0.7; // Very long responses might have errors
    }

    // Age-specific adjustments
    if (options.ageGroup === 'ages6to9') {
      // Younger children might have more variation
      confidence = Math.max(0.1, confidence - 0.1);
    } else if (options.ageGroup === 'ages14to16') {
      // Older children typically speak more clearly
      confidence = Math.min(1.0, confidence + 0.1);
    }

    // Duration-based adjustment (if available)
    if (transcription.duration) {
      const wordsPerSecond = text.split(' ').length / transcription.duration;
      if (wordsPerSecond < 0.5 || wordsPerSecond > 5) {
        confidence = Math.max(0.1, confidence - 0.2); // Unusually fast or slow speech
      }
    }

    return Math.round(confidence * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Update processing statistics
   */
  private updateStats(
    ageGroup: AgeGroup,
    confidence: number,
    processingTime: number,
    clarificationNeeded: boolean
  ): void {
    this.stats.totalProcessed++;
    this.stats.ageGroupBreakdown[ageGroup]++;

    // Update averages
    const total = this.stats.totalProcessed;
    this.stats.averageConfidence = (this.stats.averageConfidence * (total - 1) + confidence) / total;
    this.stats.averageProcessingTime = (this.stats.averageProcessingTime * (total - 1) + processingTime) / total;

    if (clarificationNeeded) {
      this.stats.clarificationRequests++;
    }
  }

  /**
   * Get processing statistics
   */
  getStats(): VoiceProcessingStats {
    return { ...this.stats };
  }

  /**
   * Generate clarification message based on age group
   */
  generateClarificationMessage(ageGroup: AgeGroup, originalText?: string): string {
    const messages = {
      ages6to9: "I couldn't hear you very well. Can you say that again a little louder?",
      ages10to13: "I'm not sure I understood that. Could you repeat what you said?",
      ages14to16: "Sorry, I didn't catch that clearly. Could you please repeat your question?"
    };

    return messages[ageGroup];
  }

  /**
   * Check if audio format is supported
   */
  isFormatSupported(format: string): boolean {
    return this.config.supportedFormats.includes(format.toLowerCase());
  }

  /**
   * Get recommended audio settings for age group
   */
  getRecommendedSettings(ageGroup: AgeGroup): {
    sampleRate: number;
    channels: number;
    format: string;
    maxDuration: number;
  } {
    const baseSettings = {
      sampleRate: 16000, // Standard for speech recognition
      channels: 1, // Mono is sufficient for speech
      format: 'wav',
      maxDuration: 30 // 30 seconds max per audio clip
    };

    // Age-specific adjustments
    if (ageGroup === 'ages6to9') {
      return {
        ...baseSettings,
        maxDuration: 15 // Shorter clips for younger children
      };
    }

    return baseSettings;
  }

  /**
   * Reset statistics (for testing or maintenance)
   */
  resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      averageConfidence: 0,
      averageProcessingTime: 0,
      clarificationRequests: 0,
      errorCount: 0,
      ageGroupBreakdown: {
        ages6to9: 0,
        ages10to13: 0,
        ages14to16: 0
      }
    };

    this.logger.info('Voice recognition statistics reset');
  }
}

/**
 * Factory function to create VoiceRecognitionService
 */
export function createVoiceRecognitionService(
  config: VoiceRecognitionConfig,
  logger: winston.Logger
): VoiceRecognitionService {
  return new VoiceRecognitionService(config, logger);
}

/**
 * Default configuration for voice recognition
 */
export const defaultVoiceRecognitionConfig: Partial<VoiceRecognitionConfig> = {
  model: 'whisper-1',
  maxAudioSize: 25 * 1024 * 1024, // 25MB (Whisper limit)
  confidenceThreshold: 0.7,
  supportedFormats: ['wav', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm'],
  processingTimeout: 30000, // 30 seconds
  childSpeechPrompts: {}
};
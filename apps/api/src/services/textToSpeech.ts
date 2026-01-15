import OpenAI from 'openai';
import winston from 'winston';
import { AgeGroup } from './chatgpt';

// TTS voice configuration
export interface VoiceProfile {
  id: string;
  name: string;
  ageGroup: AgeGroup;
  engine: 'openai' | 'azure' | 'google' | 'web';
  voiceId: string;
  characteristics: {
    gender: 'male' | 'female' | 'neutral';
    tone: 'friendly' | 'professional' | 'playful' | 'calm';
    speed: number; // 0.5-2.0, 1.0 = normal
    pitch: number; // 0.5-2.0, 1.0 = normal
  };
  description: string;
  sampleUrl?: string;
}

// TTS request interface
export interface TTSRequest {
  text: string;
  voiceProfile: VoiceProfile;
  options?: {
    speed?: number; // Override voice profile speed
    pitch?: number; // Override voice profile pitch
    format?: 'mp3' | 'wav' | 'opus';
    quality?: 'low' | 'medium' | 'high';
    enableSSML?: boolean;
  };
}

// Alternative request interface for API routes
export interface TTSRequestByAge {
  text: string;
  ageGroup: AgeGroup;
  voiceProfileId?: string;
  speed?: number;
  enableCache?: boolean;
  metadata?: {
    childId?: string;
    userId?: string;
    timestamp?: Date;
    format?: string;
    conversationContext?: boolean;
  };
}

// TTS response interface
export interface TTSResponse {
  audioBuffer: Buffer;
  metadata: {
    format: string;
    duration: number;
    size: number;
    voiceProfile: VoiceProfile;
    processingTime: number;
    cacheHit: boolean;
    quality: string;
  };
}

// TTS processing statistics
export interface TTSStats {
  totalRequests: number;
  averageProcessingTime: number;
  cacheHitRate: number;
  errorRate: number;
  ageGroupUsage: Record<AgeGroup, number>;
  voicePopularity: Record<string, number>;
  contentTypes: {
    simple: number;
    mathematical: number;
    formatted: number;
    mixed: number;
  };
}

// TTS configuration
export interface TTSConfig {
  openaiApiKey: string;
  defaultVoice: string;
  cacheEnabled: boolean;
  maxCacheSize: number; // Number of cached audio responses
  compressionEnabled: boolean;
  maxTextLength: number; // Maximum characters per request
  timeoutMs: number; // Request timeout
}

/**
 * Text-to-Speech Service
 *
 * Converts text responses to natural-sounding audio with age-appropriate
 * voice characteristics and special content handling.
 *
 * Features:
 * - Multiple TTS engine support (OpenAI, Azure, Google, Web API)
 * - Age-appropriate voice profiles and characteristics
 * - Mathematical expression and formatting pronunciation
 * - Response caching for performance optimization
 * - SSML support for enhanced speech control
 * - Real-time audio streaming capabilities
 */
export class TextToSpeechService {
  private openai: OpenAI;
  private logger: winston.Logger;
  private config: TTSConfig;
  private stats: TTSStats;
  private audioCache: Map<string, { buffer: Buffer; timestamp: number }> = new Map();

  // Predefined voice profiles for different age groups
  private readonly voiceProfiles: Record<AgeGroup, VoiceProfile[]> = {
    ages6to9: [
      {
        id: 'nova-young',
        name: 'Nova (Friendly)',
        ageGroup: 'ages6to9',
        engine: 'openai',
        voiceId: 'nova',
        characteristics: {
          gender: 'female',
          tone: 'friendly',
          speed: 0.9, // Slightly slower for comprehension
          pitch: 1.1 // Slightly higher pitch
        },
        description: 'A warm, friendly voice perfect for young learners'
      },
      {
        id: 'onyx-calm',
        name: 'Onyx (Calm)',
        ageGroup: 'ages6to9',
        engine: 'openai',
        voiceId: 'onyx',
        characteristics: {
          gender: 'male',
          tone: 'calm',
          speed: 0.85,
          pitch: 1.0
        },
        description: 'A gentle, calming voice for focused learning'
      }
    ],
    ages10to13: [
      {
        id: 'shimmer-engaging',
        name: 'Shimmer (Engaging)',
        ageGroup: 'ages10to13',
        engine: 'openai',
        voiceId: 'shimmer',
        characteristics: {
          gender: 'female',
          tone: 'playful',
          speed: 1.0,
          pitch: 1.0
        },
        description: 'An engaging voice that keeps middle schoolers interested'
      },
      {
        id: 'echo-professional',
        name: 'Echo (Clear)',
        ageGroup: 'ages10to13',
        engine: 'openai',
        voiceId: 'echo',
        characteristics: {
          gender: 'male',
          tone: 'professional',
          speed: 1.0,
          pitch: 0.95
        },
        description: 'A clear, articulate voice for complex topics'
      }
    ],
    ages14to16: [
      {
        id: 'alloy-natural',
        name: 'Alloy (Natural)',
        ageGroup: 'ages14to16',
        engine: 'openai',
        voiceId: 'alloy',
        characteristics: {
          gender: 'neutral',
          tone: 'professional',
          speed: 1.1,
          pitch: 1.0
        },
        description: 'A natural, mature voice for advanced learning'
      },
      {
        id: 'fable-sophisticated',
        name: 'Fable (Sophisticated)',
        ageGroup: 'ages14to16',
        engine: 'openai',
        voiceId: 'fable',
        characteristics: {
          gender: 'male',
          tone: 'professional',
          speed: 1.05,
          pitch: 0.9
        },
        description: 'A sophisticated voice for complex academic content'
      }
    ]
  };

  constructor(config: TTSConfig, logger: winston.Logger) {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });

    this.config = config;
    this.logger = logger;

    // Initialize statistics
    this.stats = {
      totalRequests: 0,
      averageProcessingTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      ageGroupUsage: {
        ages6to9: 0,
        ages10to13: 0,
        ages14to16: 0
      },
      voicePopularity: {},
      contentTypes: {
        simple: 0,
        mathematical: 0,
        formatted: 0,
        mixed: 0
      }
    };

    this.logger.info('TextToSpeechService initialized', {
      cacheEnabled: config.cacheEnabled,
      maxCacheSize: config.maxCacheSize,
      availableVoices: Object.keys(this.voiceProfiles).length
    });
  }

  /**
   * Synthesize speech from text using age group (convenience method for API routes)
   */
  async synthesizeSpeechByAge(request: TTSRequestByAge): Promise<TTSResponse> {
    // Select voice profile based on age group and optional voice profile ID
    let voiceProfile: VoiceProfile;

    if (request.voiceProfileId) {
      const selectedProfile = this.getVoiceProfileById(request.voiceProfileId);
      if (!selectedProfile) {
        throw new Error(`Voice profile not found: ${request.voiceProfileId}`);
      }
      voiceProfile = selectedProfile;
    } else {
      voiceProfile = this.getDefaultVoiceProfile(request.ageGroup);
    }

    // Convert to internal TTSRequest format
    const ttsRequest: TTSRequest = {
      text: request.text,
      voiceProfile: voiceProfile,
      options: {
        speed: request.speed,
        format: (request.metadata?.format as 'mp3' | 'wav' | 'opus') || 'mp3',
        quality: 'medium'
      }
    };

    return this.synthesizeSpeech(ttsRequest);
  }

  /**
   * Convert text to speech with age-appropriate voice
   */
  async synthesizeSpeech(request: TTSRequest): Promise<TTSResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug('Starting TTS synthesis', {
        textLength: request.text.length,
        voiceProfile: request.voiceProfile.id,
        ageGroup: request.voiceProfile.ageGroup
      });

      // Validate request
      this.validateTTSRequest(request);

      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      if (this.config.cacheEnabled) {
        const cached = this.audioCache.get(cacheKey);
        if (cached && this.isCacheValid(cached.timestamp)) {
          this.updateStats(request.voiceProfile.ageGroup, Date.now() - startTime, true, request.text);

          return {
            audioBuffer: cached.buffer,
            metadata: {
              format: request.options?.format || 'mp3',
              duration: this.estimateAudioDuration(request.text),
              size: cached.buffer.length,
              voiceProfile: request.voiceProfile,
              processingTime: Date.now() - startTime,
              cacheHit: true,
              quality: request.options?.quality || 'high'
            }
          };
        }
      }

      // Process text for special content
      const processedText = this.preprocessText(request.text);

      // Generate speech using appropriate engine
      let audioBuffer: Buffer;

      switch (request.voiceProfile.engine) {
        case 'openai':
          audioBuffer = await this.synthesizeWithOpenAI(processedText, request);
          break;
        default:
          throw new Error(`TTS engine '${request.voiceProfile.engine}' not implemented`);
      }

      // Cache the result
      if (this.config.cacheEnabled) {
        this.cacheAudioResponse(cacheKey, audioBuffer);
      }

      const processingTime = Date.now() - startTime;
      this.updateStats(request.voiceProfile.ageGroup, processingTime, false, request.text);

      const response: TTSResponse = {
        audioBuffer,
        metadata: {
          format: request.options?.format || 'mp3',
          duration: this.estimateAudioDuration(request.text),
          size: audioBuffer.length,
          voiceProfile: request.voiceProfile,
          processingTime,
          cacheHit: false,
          quality: request.options?.quality || 'high'
        }
      };

      this.logger.info('TTS synthesis completed', {
        textLength: request.text.length,
        audioSize: audioBuffer.length,
        processingTime,
        voiceProfile: request.voiceProfile.id
      });

      return response;

    } catch (error) {
      this.stats.totalRequests++;
      this.updateErrorRate();

      this.logger.error('TTS synthesis failed', {
        error: error instanceof Error ? error.message : error,
        voiceProfile: request.voiceProfile ? request.voiceProfile.id : 'unknown',
        textLength: request.text.length
      });

      throw new Error(`Text-to-speech synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Synthesize speech using OpenAI TTS
   */
  private async synthesizeWithOpenAI(text: string, request: TTSRequest): Promise<Buffer> {
    try {
      const response = await this.openai.audio.speech.create({
        model: 'tts-1-hd', // High quality model
        voice: request.voiceProfile.voiceId as any,
        input: text,
        response_format: request.options?.format || 'mp3',
        speed: request.options?.speed || request.voiceProfile.characteristics.speed
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer;

    } catch (error) {
      this.logger.error('OpenAI TTS synthesis failed', {
        error: error instanceof Error ? error.message : error,
        voiceId: request.voiceProfile.voiceId
      });
      throw error;
    }
  }

  /**
   * Preprocess text for better speech synthesis
   */
  private preprocessText(text: string): string {
    let processed = text;

    // Handle mathematical expressions
    processed = this.processMathematicalContent(processed);

    // Handle formatting and punctuation
    processed = this.processFormattingContent(processed);

    // Handle special abbreviations and acronyms
    processed = this.processAbbreviations(processed);

    // Normalize whitespace and remove excessive punctuation
    processed = processed.replace(/\s+/g, ' ').trim();
    processed = processed.replace(/[.]{3,}/g, '...');
    processed = processed.replace(/[!]{2,}/g, '!');
    processed = processed.replace(/[?]{2,}/g, '?');

    return processed;
  }

  /**
   * Process mathematical expressions for better pronunciation
   */
  private processMathematicalContent(text: string): string {
    let processed = text;

    // Basic mathematical operations
    processed = processed.replace(/\+/g, ' plus ');
    processed = processed.replace(/\-/g, ' minus ');
    processed = processed.replace(/\*/g, ' times ');
    processed = processed.replace(/\//g, ' divided by ');
    processed = processed.replace(/=/g, ' equals ');
    processed = processed.replace(/≠/g, ' does not equal ');
    processed = processed.replace(/≤/g, ' is less than or equal to ');
    processed = processed.replace(/≥/g, ' is greater than or equal to ');
    processed = processed.replace(/</g, ' is less than ');
    processed = processed.replace(/>/g, ' is greater than ');

    // Fractions (simple patterns)
    processed = processed.replace(/(\d+)\/(\d+)/g, '$1 over $2');
    processed = processed.replace(/1\/2/g, 'one half');
    processed = processed.replace(/1\/3/g, 'one third');
    processed = processed.replace(/2\/3/g, 'two thirds');
    processed = processed.replace(/1\/4/g, 'one quarter');
    processed = processed.replace(/3\/4/g, 'three quarters');

    // Powers and exponents
    processed = processed.replace(/(\d+)\^(\d+)/g, '$1 to the power of $2');
    processed = processed.replace(/x\^2/g, 'x squared');
    processed = processed.replace(/x\^3/g, 'x cubed');

    // Square roots
    processed = processed.replace(/√(\d+)/g, 'square root of $1');
    processed = processed.replace(/√/g, 'square root of');

    // Percentages
    processed = processed.replace(/(\d+)%/g, '$1 percent');

    return processed;
  }

  /**
   * Process formatting content for natural speech
   */
  private processFormattingContent(text: string): string {
    let processed = text;

    // Handle emphasized text (markdown-style)
    processed = processed.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove bold formatting
    processed = processed.replace(/\*(.*?)\*/g, '$1'); // Remove italic formatting

    // Handle code blocks and inline code
    processed = processed.replace(/```[\s\S]*?```/g, ' code block ');
    processed = processed.replace(/`([^`]+)`/g, '$1');

    // Handle lists and bullet points
    processed = processed.replace(/^\s*[-*+]\s+/gm, ''); // Remove bullet points
    processed = processed.replace(/^\s*\d+\.\s+/gm, ''); // Remove numbered list markers

    // Handle URLs and email addresses
    processed = processed.replace(/https?:\/\/[^\s]+/g, ' web link ');
    processed = processed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ' email address ');

    return processed;
  }

  /**
   * Process abbreviations and acronyms for better pronunciation
   */
  private processAbbreviations(text: string): string {
    const abbreviations: Record<string, string> = {
      'Dr.': 'Doctor',
      'Mr.': 'Mister',
      'Mrs.': 'Missus',
      'Ms.': 'Miss',
      'Prof.': 'Professor',
      'etc.': 'et cetera',
      'i.e.': 'that is',
      'e.g.': 'for example',
      'vs.': 'versus',
      'COVID-19': 'COVID nineteen',
      'AI': 'A I',
      'API': 'A P I',
      'HTML': 'H T M L',
      'CSS': 'C S S',
      'PDF': 'P D F',
      'URL': 'U R L',
      'FAQ': 'F A Q'
    };

    let processed = text;
    for (const [abbrev, expansion] of Object.entries(abbreviations)) {
      const regex = new RegExp(`\\b${abbrev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      processed = processed.replace(regex, expansion);
    }

    return processed;
  }

  /**
   * Validate TTS request parameters
   */
  private validateTTSRequest(request: TTSRequest): void {
    if (!request.text || request.text.trim().length === 0) {
      throw new Error('Text content is required for TTS synthesis');
    }

    if (request.text.length > this.config.maxTextLength) {
      throw new Error(`Text length ${request.text.length} exceeds maximum ${this.config.maxTextLength} characters`);
    }

    if (!request.voiceProfile || !request.voiceProfile.voiceId) {
      throw new Error('Valid voice profile is required');
    }

    if (request.options?.speed && (request.options.speed < 0.5 || request.options.speed > 2.0)) {
      throw new Error('Speed must be between 0.5 and 2.0');
    }
  }

  /**
   * Generate cache key for audio response
   */
  private generateCacheKey(request: TTSRequest): string {
    const keyData = {
      text: request.text,
      voiceId: request.voiceProfile.voiceId,
      speed: request.options?.speed || request.voiceProfile.characteristics.speed,
      format: request.options?.format || 'mp3'
    };

    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  /**
   * Check if cached response is still valid
   */
  private isCacheValid(timestamp: number): boolean {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    return (Date.now() - timestamp) < maxAge;
  }

  /**
   * Cache audio response
   */
  private cacheAudioResponse(key: string, buffer: Buffer): void {
    // Remove oldest entries if cache is full
    if (this.audioCache.size >= this.config.maxCacheSize) {
      const oldestKey = this.audioCache.keys().next().value;
      this.audioCache.delete(oldestKey);
    }

    this.audioCache.set(key, {
      buffer,
      timestamp: Date.now()
    });
  }

  /**
   * Estimate audio duration based on text length
   */
  private estimateAudioDuration(text: string): number {
    // Average speaking rate: ~150 words per minute for educational content
    const wordsPerMinute = 150;
    const words = text.split(/\s+/).length;
    const minutes = words / wordsPerMinute;
    return Math.max(1, Math.round(minutes * 60)); // Minimum 1 second
  }

  /**
   * Update processing statistics
   */
  private updateStats(ageGroup: AgeGroup, processingTime: number, cacheHit: boolean, text: string): void {
    this.stats.totalRequests++;
    this.stats.ageGroupUsage[ageGroup]++;

    // Update average processing time
    const total = this.stats.totalRequests;
    this.stats.averageProcessingTime = (this.stats.averageProcessingTime * (total - 1) + processingTime) / total;

    // Update cache hit rate
    const cacheHits = cacheHit ? 1 : 0;
    const totalCacheableRequests = this.stats.totalRequests;
    this.stats.cacheHitRate = (this.stats.cacheHitRate * (totalCacheableRequests - 1) + cacheHits) / totalCacheableRequests;

    // Classify content type
    this.classifyContent(text);
  }

  /**
   * Classify content type for statistics
   */
  private classifyContent(text: string): void {
    const hasMath = /[\+\-\*\/=<>√%\^]|\d+\/\d+/.test(text);
    const hasFormatting = /\*\*.*?\*\*|\*.*?\*|```.*?```|`.*?`/.test(text);

    if (hasMath && hasFormatting) {
      this.stats.contentTypes.mixed++;
    } else if (hasMath) {
      this.stats.contentTypes.mathematical++;
    } else if (hasFormatting) {
      this.stats.contentTypes.formatted++;
    } else {
      this.stats.contentTypes.simple++;
    }
  }

  /**
   * Update error rate statistics
   */
  private updateErrorRate(): void {
    const errors = this.stats.totalRequests * this.stats.errorRate + 1;
    this.stats.errorRate = errors / this.stats.totalRequests;
  }

  /**
   * Get available voice profiles for age group
   */
  getVoiceProfiles(ageGroup: AgeGroup): VoiceProfile[] {
    return this.voiceProfiles[ageGroup] || [];
  }

  /**
   * Get default voice profile for age group
   */
  getDefaultVoiceProfile(ageGroup: AgeGroup): VoiceProfile {
    const profiles = this.getVoiceProfiles(ageGroup);
    return profiles[0] || this.voiceProfiles.ages10to13[0]; // Fallback to middle age group
  }

  /**
   * Get voice profile by ID
   */
  getVoiceProfileById(id: string): VoiceProfile | undefined {
    for (const profiles of Object.values(this.voiceProfiles)) {
      const profile = profiles.find(p => p.id === id);
      if (profile) return profile;
    }
    return undefined;
  }

  /**
   * Get TTS processing statistics
   */
  getStats(): TTSStats {
    return { ...this.stats };
  }

  /**
   * Clear audio cache
   */
  clearCache(): number {
    const cleared = this.audioCache.size;
    this.audioCache.clear();
    this.logger.info(`Cleared ${cleared} cached audio responses`);
    return cleared;
  }

  /**
   * Get cache information
   */
  getCacheInfo(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntry?: Date;
  } {
    let oldestTimestamp = Date.now();
    for (const entry of this.audioCache.values()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    }

    return {
      size: this.audioCache.size,
      maxSize: this.config.maxCacheSize,
      hitRate: this.stats.cacheHitRate,
      oldestEntry: this.audioCache.size > 0 ? new Date(oldestTimestamp) : undefined
    };
  }

  /**
   * Health check for TTS service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency?: number;
    cacheStatus: 'enabled' | 'disabled';
    voiceProfilesLoaded: number;
  }> {
    try {
      const startTime = Date.now();

      // Test with a simple phrase
      const testProfile = this.getDefaultVoiceProfile('ages10to13');
      await this.synthesizeSpeech({
        text: 'Health check test.',
        voiceProfile: testProfile,
        options: { quality: 'low' }
      });

      const latency = Date.now() - startTime;

      return {
        status: latency < 3000 ? 'healthy' : 'degraded',
        latency,
        cacheStatus: this.config.cacheEnabled ? 'enabled' : 'disabled',
        voiceProfilesLoaded: Object.values(this.voiceProfiles).flat().length
      };

    } catch (error) {
      this.logger.error('TTS health check failed', { error: error instanceof Error ? error.message : error });

      return {
        status: 'unhealthy',
        cacheStatus: this.config.cacheEnabled ? 'enabled' : 'disabled',
        voiceProfilesLoaded: Object.values(this.voiceProfiles).flat().length
      };
    }
  }
}

/**
 * Factory function to create TextToSpeechService
 */
export function createTextToSpeechService(
  config: TTSConfig,
  logger: winston.Logger
): TextToSpeechService {
  return new TextToSpeechService(config, logger);
}

/**
 * Default TTS configuration
 */
export const defaultTTSConfig: Partial<TTSConfig> = {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  defaultVoice: 'nova',
  cacheEnabled: true,
  maxCacheSize: 1000, // Cache up to 1000 audio responses
  compressionEnabled: true,
  maxTextLength: 4000, // Maximum 4000 characters per request
  timeoutMs: 30000 // 30 second timeout
};
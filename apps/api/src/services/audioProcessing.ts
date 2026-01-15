import winston from 'winston';
import { Readable, Transform } from 'stream';
import { AgeGroup } from './chatgpt';
import { AudioMetadata } from './voiceRecognition';

// Audio processing configuration
export interface AudioProcessingConfig {
  enableNoiseReduction: boolean;
  enableVolumeNormalization: boolean;
  enableSilenceDetection: boolean;
  targetSampleRate: number;
  targetChannels: number;
  maxProcessingTime: number; // Maximum time to spend on preprocessing
  qualityThresholds: {
    minimumDuration: number; // Minimum audio duration in seconds
    maximumDuration: number; // Maximum audio duration in seconds
    minimumVolume: number; // Minimum average volume level (0-1)
    maximumNoiseLevel: number; // Maximum acceptable background noise level (0-1)
  };
}

// Audio quality assessment result
export interface AudioQualityResult {
  overallScore: number; // 0-1, with 1 being perfect quality
  issues: AudioQualityIssue[];
  recommendations: string[];
  processingApplied: string[];
  metadata: {
    duration: number;
    averageVolume: number;
    peakVolume: number;
    noiseLevel: number;
    silencePercentage: number;
    clippingDetected: boolean;
  };
}

// Audio quality issue types
export interface AudioQualityIssue {
  type: 'volume_too_low' | 'volume_too_high' | 'background_noise' | 'clipping' | 'too_short' | 'too_long' | 'excessive_silence';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectsRecognition: boolean;
}

// Voice activity detection result
export interface VoiceActivityResult {
  segments: VoiceSegment[];
  totalSpeechDuration: number;
  silencePercentage: number;
  recommendTrimming: boolean;
}

export interface VoiceSegment {
  start: number; // Start time in seconds
  end: number; // End time in seconds
  confidence: number; // Confidence that this segment contains speech (0-1)
  averageVolume: number;
}

// Age-specific processing parameters
interface AgeSpecificParams {
  volumeSensitivity: number; // How sensitive to volume changes (children speak at varying volumes)
  noiseThreshold: number; // Noise tolerance (home environments vary)
  silenceThreshold: number; // How much silence is acceptable
  processingTimeout: number; // Age-appropriate processing time limits
}

/**
 * Audio Processing Service
 *
 * Handles audio preprocessing, quality assessment, and optimization
 * for child speech recognition with age-appropriate parameters.
 *
 * Features:
 * - Background noise reduction
 * - Volume normalization
 * - Voice activity detection
 * - Audio quality assessment
 * - Format conversion and optimization
 * - Age-appropriate processing parameters
 */
export class AudioProcessingService {
  private logger: winston.Logger;
  private config: AudioProcessingConfig;

  // Age-specific processing parameters
  private readonly ageParams: Record<AgeGroup, AgeSpecificParams> = {
    ages6to9: {
      volumeSensitivity: 0.8, // High sensitivity - young children vary volume more
      noiseThreshold: 0.4, // Higher tolerance for background noise
      silenceThreshold: 0.3, // More tolerance for pauses and "um"s
      processingTimeout: 5000 // 5 seconds max processing time
    },
    ages10to13: {
      volumeSensitivity: 0.6, // Medium sensitivity
      noiseThreshold: 0.3, // Medium noise tolerance
      silenceThreshold: 0.25, // Standard silence handling
      processingTimeout: 7000 // 7 seconds max processing time
    },
    ages14to16: {
      volumeSensitivity: 0.4, // Lower sensitivity - clearer speech expected
      noiseThreshold: 0.2, // Lower noise tolerance
      silenceThreshold: 0.2, // Less tolerance for excessive silence
      processingTimeout: 10000 // 10 seconds max processing time
    }
  };

  constructor(config: AudioProcessingConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;

    this.logger.info('AudioProcessingService initialized', {
      enableNoiseReduction: config.enableNoiseReduction,
      enableVolumeNormalization: config.enableVolumeNormalization,
      enableSilenceDetection: config.enableSilenceDetection,
      targetSampleRate: config.targetSampleRate
    });
  }

  /**
   * Process audio buffer with age-appropriate optimizations
   */
  async processAudio(
    audioBuffer: Buffer,
    metadata: AudioMetadata,
    ageGroup: AgeGroup,
    options?: {
      skipQualityCheck?: boolean;
      forceProcessing?: boolean;
    }
  ): Promise<{
    processedAudio: Buffer;
    quality: AudioQualityResult;
    recommendations: string[];
  }> {
    const startTime = Date.now();

    try {
      this.logger.debug('Starting audio processing', {
        originalSize: audioBuffer.length,
        format: metadata.format,
        ageGroup,
        duration: metadata.duration
      });

      // Assess audio quality first
      const qualityResult = await this.assessAudioQuality(audioBuffer, metadata, ageGroup);

      // Skip processing if quality is already good and no force flag
      if (!options?.forceProcessing && qualityResult.overallScore > 0.8 && qualityResult.issues.length === 0) {
        this.logger.debug('Audio quality is good, skipping processing');
        return {
          processedAudio: audioBuffer,
          quality: qualityResult,
          recommendations: []
        };
      }

      // Apply processing based on quality issues and age group
      let processedBuffer = audioBuffer;
      const appliedProcessing: string[] = [];
      const recommendations: string[] = [];

      // Volume normalization
      if (this.config.enableVolumeNormalization) {
        const volumeIssues = qualityResult.issues.filter(i =>
          i.type === 'volume_too_low' || i.type === 'volume_too_high'
        );
        if (volumeIssues.length > 0) {
          processedBuffer = await this.normalizeVolume(processedBuffer, metadata, ageGroup);
          appliedProcessing.push('volume_normalization');
        }
      }

      // Background noise reduction
      if (this.config.enableNoiseReduction) {
        const noiseIssues = qualityResult.issues.filter(i => i.type === 'background_noise');
        if (noiseIssues.length > 0) {
          processedBuffer = await this.reduceBackgroundNoise(processedBuffer, metadata, ageGroup);
          appliedProcessing.push('noise_reduction');
        }
      }

      // Silence detection and trimming
      if (this.config.enableSilenceDetection) {
        const silenceIssues = qualityResult.issues.filter(i => i.type === 'excessive_silence');
        if (silenceIssues.length > 0) {
          const trimResult = await this.trimSilence(processedBuffer, metadata, ageGroup);
          processedBuffer = trimResult.audioBuffer;
          appliedProcessing.push('silence_trimming');
          if (trimResult.trimmed) {
            recommendations.push('Audio was trimmed to remove excessive silence');
          }
        }
      }

      // Generate recommendations based on remaining issues
      recommendations.push(...this.generateRecommendations(qualityResult, ageGroup));

      const processingTime = Date.now() - startTime;

      this.logger.info('Audio processing completed', {
        originalSize: audioBuffer.length,
        processedSize: processedBuffer.length,
        processingTime,
        appliedProcessing,
        qualityScore: qualityResult.overallScore,
        ageGroup
      });

      // Update quality result with processing applied
      qualityResult.processingApplied = appliedProcessing;

      return {
        processedAudio: processedBuffer,
        quality: qualityResult,
        recommendations
      };

    } catch (error) {
      this.logger.error('Audio processing failed', {
        error: error instanceof Error ? error.message : error,
        ageGroup,
        audioSize: audioBuffer.length
      });

      throw new Error(`Audio processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Assess audio quality and identify issues
   */
  private async assessAudioQuality(
    audioBuffer: Buffer,
    metadata: AudioMetadata,
    ageGroup: AgeGroup
  ): Promise<AudioQualityResult> {
    const issues: AudioQualityIssue[] = [];
    const ageParams = this.ageParams[ageGroup];

    // Mock audio analysis (in real implementation, this would use audio processing libraries)
    const mockAudioStats = this.analyzeAudioBuffer(audioBuffer, metadata);

    // Check duration
    if (metadata.duration && metadata.duration < this.config.qualityThresholds.minimumDuration) {
      issues.push({
        type: 'too_short',
        severity: 'high',
        description: `Audio duration ${metadata.duration}s is below minimum ${this.config.qualityThresholds.minimumDuration}s`,
        affectsRecognition: true
      });
    }

    if (metadata.duration && metadata.duration > this.config.qualityThresholds.maximumDuration) {
      issues.push({
        type: 'too_long',
        severity: 'medium',
        description: `Audio duration ${metadata.duration}s exceeds recommended ${this.config.qualityThresholds.maximumDuration}s`,
        affectsRecognition: false
      });
    }

    // Check volume levels
    if (mockAudioStats.averageVolume < this.config.qualityThresholds.minimumVolume) {
      issues.push({
        type: 'volume_too_low',
        severity: 'high',
        description: 'Audio volume is too low for reliable recognition',
        affectsRecognition: true
      });
    }

    if (mockAudioStats.peakVolume > 0.95) {
      issues.push({
        type: 'volume_too_high',
        severity: 'medium',
        description: 'Audio contains clipping that may affect quality',
        affectsRecognition: true
      });
    }

    // Check background noise (age-adjusted)
    if (mockAudioStats.noiseLevel > ageParams.noiseThreshold) {
      issues.push({
        type: 'background_noise',
        severity: mockAudioStats.noiseLevel > ageParams.noiseThreshold + 0.2 ? 'high' : 'medium',
        description: 'Background noise may interfere with speech recognition',
        affectsRecognition: true
      });
    }

    // Check silence percentage (age-adjusted)
    if (mockAudioStats.silencePercentage > ageParams.silenceThreshold) {
      issues.push({
        type: 'excessive_silence',
        severity: 'low',
        description: 'Audio contains excessive silence that could be trimmed',
        affectsRecognition: false
      });
    }

    // Calculate overall score
    let score = 1.0;
    issues.forEach(issue => {
      if (issue.affectsRecognition) {
        switch (issue.severity) {
          case 'high': score -= 0.3; break;
          case 'medium': score -= 0.15; break;
          case 'low': score -= 0.05; break;
        }
      } else {
        switch (issue.severity) {
          case 'high': score -= 0.1; break;
          case 'medium': score -= 0.05; break;
          case 'low': score -= 0.02; break;
        }
      }
    });

    return {
      overallScore: Math.max(0, Math.min(1, score)),
      issues,
      recommendations: [],
      processingApplied: [],
      metadata: mockAudioStats
    };
  }

  /**
   * Mock audio analysis (in real implementation, use audio processing libraries)
   */
  private analyzeAudioBuffer(audioBuffer: Buffer, metadata: AudioMetadata) {
    // Mock analysis based on buffer characteristics
    const normalizedSize = audioBuffer.length / (metadata.duration || 1) / 1000; // rough bytes per second per channel

    return {
      duration: metadata.duration || 0,
      averageVolume: Math.min(0.8, normalizedSize * 0.1), // Mock volume calculation
      peakVolume: Math.min(1.0, normalizedSize * 0.15), // Mock peak calculation
      noiseLevel: Math.min(0.4, normalizedSize * 0.05), // Mock noise calculation
      silencePercentage: Math.min(0.5, Math.max(0, (1000 - normalizedSize) / 1000)), // Mock silence
      clippingDetected: normalizedSize > 8 // Mock clipping detection
    };
  }

  /**
   * Normalize audio volume for optimal recognition
   */
  private async normalizeVolume(
    audioBuffer: Buffer,
    metadata: AudioMetadata,
    ageGroup: AgeGroup
  ): Promise<Buffer> {
    this.logger.debug('Applying volume normalization', { ageGroup });

    // In real implementation, this would use audio processing libraries
    // For now, return the buffer unchanged but log the operation
    return audioBuffer;
  }

  /**
   * Reduce background noise using age-appropriate filtering
   */
  private async reduceBackgroundNoise(
    audioBuffer: Buffer,
    metadata: AudioMetadata,
    ageGroup: AgeGroup
  ): Promise<Buffer> {
    this.logger.debug('Applying noise reduction', { ageGroup });

    const ageParams = this.ageParams[ageGroup];

    // In real implementation, this would apply noise reduction algorithms
    // Younger children would get less aggressive filtering to preserve speech
    // Older children could have more aggressive noise reduction

    return audioBuffer;
  }

  /**
   * Detect and trim excessive silence
   */
  private async trimSilence(
    audioBuffer: Buffer,
    metadata: AudioMetadata,
    ageGroup: AgeGroup
  ): Promise<{ audioBuffer: Buffer; trimmed: boolean }> {
    this.logger.debug('Detecting and trimming silence', { ageGroup });

    const ageParams = this.ageParams[ageGroup];

    // In real implementation, this would analyze audio for voice activity
    // and trim silence from beginning and end while preserving natural pauses

    // Mock trimming detection
    const mockTrimmed = metadata.duration ? metadata.duration > 10 : false;

    return {
      audioBuffer,
      trimmed: mockTrimmed
    };
  }

  /**
   * Detect voice activity in audio
   */
  async detectVoiceActivity(
    audioBuffer: Buffer,
    metadata: AudioMetadata,
    ageGroup: AgeGroup
  ): Promise<VoiceActivityResult> {
    const ageParams = this.ageParams[ageGroup];

    // Mock voice activity detection
    const mockSegments: VoiceSegment[] = [];
    const duration = metadata.duration || 0;

    if (duration > 0) {
      // Create mock segments based on age group expectations
      if (ageGroup === 'ages6to9') {
        // Younger children might have more fragmented speech
        mockSegments.push(
          { start: 0.5, end: 2.0, confidence: 0.8, averageVolume: 0.6 },
          { start: 3.0, end: 5.5, confidence: 0.7, averageVolume: 0.5 },
          { start: 6.0, end: duration - 0.5, confidence: 0.75, averageVolume: 0.55 }
        );
      } else {
        // Older children might have more continuous speech
        mockSegments.push(
          { start: 0.3, end: duration - 0.3, confidence: 0.85, averageVolume: 0.7 }
        );
      }
    }

    const totalSpeechDuration = mockSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
    const silencePercentage = duration > 0 ? 1 - (totalSpeechDuration / duration) : 0;

    return {
      segments: mockSegments,
      totalSpeechDuration,
      silencePercentage,
      recommendTrimming: silencePercentage > ageParams.silenceThreshold
    };
  }

  /**
   * Generate recommendations based on quality assessment
   */
  private generateRecommendations(quality: AudioQualityResult, ageGroup: AgeGroup): string[] {
    const recommendations: string[] = [];

    quality.issues.forEach(issue => {
      switch (issue.type) {
        case 'volume_too_low':
          recommendations.push(`Speak louder or move closer to the microphone. ${this.getAgeSpecificAdvice(ageGroup, 'volume_low')}`);
          break;
        case 'volume_too_high':
          recommendations.push(`Speak more softly or move away from the microphone. ${this.getAgeSpecificAdvice(ageGroup, 'volume_high')}`);
          break;
        case 'background_noise':
          recommendations.push(`Try to reduce background noise. ${this.getAgeSpecificAdvice(ageGroup, 'noise')}`);
          break;
        case 'too_short':
          recommendations.push(`Try speaking for a bit longer. ${this.getAgeSpecificAdvice(ageGroup, 'duration_short')}`);
          break;
        case 'excessive_silence':
          recommendations.push(`Try to speak more continuously. ${this.getAgeSpecificAdvice(ageGroup, 'silence')}`);
          break;
      }
    });

    return recommendations;
  }

  /**
   * Get age-appropriate advice for audio quality issues
   */
  private getAgeSpecificAdvice(ageGroup: AgeGroup, issueType: string): string {
    const advice = {
      ages6to9: {
        volume_low: "Ask a grown-up to help you get closer to the microphone!",
        volume_high: "Try speaking a little more quietly.",
        noise: "Ask someone to turn down the TV or music.",
        duration_short: "Take your time and tell me more!",
        silence: "Don't worry about taking breaks - just keep talking when you're ready!"
      },
      ages10to13: {
        volume_low: "Try moving closer to your microphone or speaking up a bit.",
        volume_high: "You might be too close to the microphone - try backing up slightly.",
        noise: "Find a quieter spot or ask others to lower background noise.",
        duration_short: "Try to speak for at least a few seconds.",
        silence: "Try to speak more continuously without long pauses."
      },
      ages14to16: {
        volume_low: "Increase your volume or check your microphone settings.",
        volume_high: "Reduce volume or adjust microphone distance to avoid clipping.",
        noise: "Use a quieter environment or consider noise-canceling options.",
        duration_short: "Provide more detailed responses for better recognition.",
        silence: "Minimize pauses for more efficient processing."
      }
    };

    return advice[ageGroup][issueType] || '';
  }

  /**
   * Get processing statistics
   */
  getProcessingCapabilities(): {
    supportedFormats: string[];
    maxProcessingTime: number;
    featuresEnabled: string[];
    ageGroupsSupported: AgeGroup[];
  } {
    const features: string[] = [];
    if (this.config.enableNoiseReduction) features.push('noise_reduction');
    if (this.config.enableVolumeNormalization) features.push('volume_normalization');
    if (this.config.enableSilenceDetection) features.push('silence_detection');

    return {
      supportedFormats: ['wav', 'mp3', 'ogg', 'webm'], // Would be determined by underlying audio libraries
      maxProcessingTime: this.config.maxProcessingTime,
      featuresEnabled: features,
      ageGroupsSupported: ['ages6to9', 'ages10to13', 'ages14to16']
    };
  }

  /**
   * Validate audio format compatibility
   */
  isProcessingRequired(quality: AudioQualityResult): boolean {
    return quality.overallScore < 0.8 || quality.issues.some(issue => issue.affectsRecognition);
  }

  /**
   * Get recommended audio settings for different age groups and environments
   */
  getRecommendedCaptureSettings(ageGroup: AgeGroup): {
    sampleRate: number;
    bitDepth: number;
    channels: number;
    format: string;
    maxDuration: number;
    processingHints: string[];
  } {
    const baseSettings = {
      sampleRate: this.config.targetSampleRate,
      bitDepth: 16,
      channels: this.config.targetChannels,
      format: 'wav'
    };

    const ageSpecificSettings = {
      ages6to9: {
        ...baseSettings,
        maxDuration: 15, // Shorter attention spans
        processingHints: [
          'Enable extra noise tolerance',
          'Use gentle volume normalization',
          'Preserve speech variations'
        ]
      },
      ages10to13: {
        ...baseSettings,
        maxDuration: 30, // Standard duration
        processingHints: [
          'Balanced noise reduction',
          'Standard volume normalization',
          'Moderate silence trimming'
        ]
      },
      ages14to16: {
        ...baseSettings,
        maxDuration: 45, // Longer content acceptable
        processingHints: [
          'More aggressive noise reduction',
          'Precise volume control',
          'Active silence detection'
        ]
      }
    };

    return ageSpecificSettings[ageGroup];
  }
}

/**
 * Factory function to create AudioProcessingService
 */
export function createAudioProcessingService(
  config: AudioProcessingConfig,
  logger: winston.Logger
): AudioProcessingService {
  return new AudioProcessingService(config, logger);
}

/**
 * Default audio processing configuration
 */
export const defaultAudioProcessingConfig: AudioProcessingConfig = {
  enableNoiseReduction: true,
  enableVolumeNormalization: true,
  enableSilenceDetection: true,
  targetSampleRate: 16000, // Standard for speech recognition
  targetChannels: 1, // Mono
  maxProcessingTime: 10000, // 10 seconds
  qualityThresholds: {
    minimumDuration: 0.5, // 0.5 seconds minimum
    maximumDuration: 60, // 1 minute maximum
    minimumVolume: 0.1, // 10% minimum volume
    maximumNoiseLevel: 0.3 // 30% maximum background noise
  }
};
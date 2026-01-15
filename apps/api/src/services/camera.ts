import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

// Photo capture types
export type PhotoCaptureState = 'idle' | 'requesting_permission' | 'ready' | 'capturing' | 'processing' | 'uploading' | 'completed' | 'error';
export type PhotoQuality = 'low' | 'medium' | 'high' | 'ultra';
export type PhotoFormat = 'jpeg' | 'png' | 'webp';
export type CameraType = 'builtin' | 'external' | 'bluetooth';
export type AgeGroup = 'ages6to9' | 'ages10to13' | 'ages14to16';

// Photo metadata interface
export interface PhotoMetadata {
  id: string;
  sessionId?: string;
  childId: string;
  ageGroup: AgeGroup;
  filename: string;
  originalFilename?: string;
  format: PhotoFormat;
  size: number;
  width: number;
  height: number;
  quality: PhotoQuality;
  cameraType: CameraType;
  timestamp: Date;
  uploadProgress: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  analysisReady: boolean;
  expiresAt: Date;

  // Image processing metadata
  originalSize: number;
  compressionRatio: number;
  cropped: boolean;
  enhanced: boolean;

  // Analysis preparation
  textDetected: boolean;
  mathContentDetected: boolean;
  qualityScore: number;
  readabilityScore: number;

  // COPPA compliance
  retentionPolicy: 'session' | 'temporary' | 'analysis_only';
  autoDeleteAt: Date;
}

// Photo capture configuration
export interface PhotoCaptureConfig {
  maxFileSize: number; // in bytes
  allowedFormats: PhotoFormat[];
  defaultQuality: PhotoQuality;
  compressionEnabled: boolean;
  autoEnhancement: boolean;
  autoCropping: boolean;
  maxWidth: number;
  maxHeight: number;
  qualityThreshold: number;

  // Age-specific settings
  ageGroupSettings: Record<AgeGroup, {
    maxPhotos: number;
    autoCapture: boolean;
    qualityAssurance: boolean;
    guidanceEnabled: boolean;
  }>;

  // COPPA compliance
  maxRetentionHours: number;
  requireParentalConsent: boolean;
  autoCleanup: boolean;
}

// Photo analysis results
export interface PhotoAnalysisPrep {
  id: string;
  photoId: string;
  textRegions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    text?: string;
  }>;
  mathElements: Array<{
    type: 'equation' | 'number' | 'symbol' | 'diagram' | 'graph' | 'table';
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    content?: string;
  }>;
  qualityMetrics: {
    sharpness: number;
    lighting: number;
    contrast: number;
    orientation: number;
    overall: number;
  };
  suggestions: string[];
  readyForAnalysis: boolean;
  processingTime: number;
}

// Camera device information
export interface CameraDevice {
  deviceId: string;
  label: string;
  type: CameraType;
  capabilities: {
    maxWidth: number;
    maxHeight: number;
    facingMode: string[];
    focusMode: string[];
    flashMode: string[];
  };
  isDefault: boolean;
  isAvailable: boolean;
}

// Photo upload progress
export interface PhotoUploadProgress {
  photoId: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  stage: 'uploading' | 'processing' | 'analyzing' | 'completed';
  estimatedTimeRemaining?: number;
  error?: string;
}

// Age-specific photo capture settings
const AGE_CAPTURE_CONFIGS: Record<AgeGroup, PhotoCaptureConfig['ageGroupSettings'][AgeGroup]> = {
  ages6to9: {
    maxPhotos: 3,
    autoCapture: true,
    qualityAssurance: true,
    guidanceEnabled: true
  },
  ages10to13: {
    maxPhotos: 5,
    autoCapture: false,
    qualityAssurance: true,
    guidanceEnabled: true
  },
  ages14to16: {
    maxPhotos: 10,
    autoCapture: false,
    qualityAssurance: false,
    guidanceEnabled: false
  }
};

// Default photo capture configuration
export const defaultPhotoCaptureConfig: PhotoCaptureConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFormats: ['jpeg', 'png', 'webp'],
  defaultQuality: 'medium',
  compressionEnabled: true,
  autoEnhancement: true,
  autoCropping: true,
  maxWidth: 2048,
  maxHeight: 2048,
  qualityThreshold: 0.7,
  ageGroupSettings: AGE_CAPTURE_CONFIGS,
  maxRetentionHours: 24,
  requireParentalConsent: true,
  autoCleanup: true
};

/**
 * Camera Service for photo capture and processing
 * Handles camera access, photo capture, image processing, and analysis preparation
 */
export class CameraService {
  private config: PhotoCaptureConfig;
  private logger: winston.Logger;
  private photoStorage: Map<string, PhotoMetadata> = new Map();
  private uploadProgress: Map<string, PhotoUploadProgress> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: PhotoCaptureConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
    this.startCleanupTimer();
  }

  /**
   * Create a new photo metadata entry
   */
  async createPhotoMetadata(
    childId: string,
    ageGroup: AgeGroup,
    filename: string,
    sessionId?: string
  ): Promise<PhotoMetadata> {
    const photoId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.maxRetentionHours * 60 * 60 * 1000);
    const autoDeleteAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours for COPPA

    // Create base metadata object
    const baseMetadata = {
      id: photoId,
      childId,
      ageGroup,
      filename,
      originalFilename: filename,
      format: 'jpeg' as const,
      size: 0,
      width: 0,
      height: 0,
      quality: this.config.defaultQuality,
      cameraType: 'builtin' as const,
      timestamp: now,
      uploadProgress: 0,
      processingStatus: 'pending' as const,
      analysisReady: false,
      expiresAt,
      originalSize: 0,
      compressionRatio: 1,
      cropped: false,
      enhanced: false,
      textDetected: false,
      mathContentDetected: false,
      qualityScore: 0,
      readabilityScore: 0,
      retentionPolicy: 'session' as const,
      autoDeleteAt
    };

    // Add sessionId conditionally to match interface requirements
    const metadata: PhotoMetadata = sessionId
      ? { ...baseMetadata, sessionId }
      : baseMetadata;

    this.photoStorage.set(photoId, metadata);

    this.logger.info('Photo metadata created', {
      photoId,
      childId,
      ageGroup,
      sessionId,
      expiresAt: expiresAt.toISOString()
    });

    return metadata;
  }

  /**
   * Update photo upload progress
   */
  updateUploadProgress(
    photoId: string,
    bytesUploaded: number,
    totalBytes: number,
    stage: PhotoUploadProgress['stage']
  ): void {
    const percentage = Math.round((bytesUploaded / totalBytes) * 100);

    const progress: PhotoUploadProgress = {
      photoId,
      bytesUploaded,
      totalBytes,
      percentage,
      stage
    };

    this.uploadProgress.set(photoId, progress);

    // Update metadata
    const metadata = this.photoStorage.get(photoId);
    if (metadata) {
      metadata.uploadProgress = percentage;
      if (stage === 'completed') {
        metadata.processingStatus = 'completed';
      }
    }

    this.logger.debug('Upload progress updated', {
      photoId,
      percentage,
      stage,
      bytesUploaded,
      totalBytes
    });
  }

  /**
   * Process uploaded photo (resize, compress, enhance)
   */
  async processPhoto(
    photoId: string,
    imageBuffer: Buffer,
    originalFormat: PhotoFormat
  ): Promise<PhotoMetadata> {
    const metadata = this.photoStorage.get(photoId);
    if (!metadata) {
      throw new Error(`Photo metadata not found: ${photoId}`);
    }

    try {
      metadata.processingStatus = 'processing';
      metadata.originalSize = imageBuffer.length;
      metadata.format = originalFormat;

      this.logger.info('Starting photo processing', {
        photoId,
        originalSize: imageBuffer.length,
        format: originalFormat
      });

      // For now, simulate processing - in production this would use image processing libraries
      // like Sharp or Canvas API for actual image manipulation
      const processedBuffer = await this.simulateImageProcessing(imageBuffer, metadata);

      // Update metadata with processing results
      metadata.size = processedBuffer.length;
      metadata.compressionRatio = metadata.originalSize / metadata.size;
      metadata.enhanced = this.config.autoEnhancement;
      metadata.cropped = this.config.autoCropping;
      metadata.qualityScore = this.calculateQualityScore(metadata);
      metadata.readabilityScore = this.calculateReadabilityScore(metadata);
      metadata.processingStatus = 'completed';

      // Detect content types for analysis
      await this.detectContentTypes(metadata);

      this.logger.info('Photo processing completed', {
        photoId,
        originalSize: metadata.originalSize,
        processedSize: metadata.size,
        compressionRatio: metadata.compressionRatio,
        qualityScore: metadata.qualityScore
      });

      return metadata;
    } catch (error) {
      metadata.processingStatus = 'failed';
      this.logger.error('Photo processing failed', {
        photoId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Simulate image processing (placeholder for actual implementation)
   */
  private async simulateImageProcessing(buffer: Buffer, metadata: PhotoMetadata): Promise<Buffer> {
    // In production, this would use libraries like Sharp for actual image processing:
    // - Resize to optimal dimensions
    // - Compress based on quality setting
    // - Auto-crop to focus on content
    // - Enhance contrast and lighting
    // - Correct rotation if needed

    // For now, simulate compression by reducing buffer size
    const compressionRatio = metadata.quality === 'high' ? 0.9 :
                            metadata.quality === 'medium' ? 0.7 : 0.5;

    const compressedSize = Math.floor(buffer.length * compressionRatio);
    return Buffer.alloc(compressedSize, buffer.subarray(0, compressedSize));
  }

  /**
   * Calculate image quality score
   */
  private calculateQualityScore(metadata: PhotoMetadata): number {
    // Placeholder quality calculation
    // In production, this would analyze actual image properties
    let score = 0.8; // Base score

    if (metadata.size < 100 * 1024) score -= 0.2; // Very small file
    if (metadata.compressionRatio > 5) score -= 0.3; // Over-compressed
    if (metadata.enhanced) score += 0.1; // Enhanced images get bonus

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate readability score for text content
   */
  private calculateReadabilityScore(metadata: PhotoMetadata): number {
    // Placeholder readability calculation
    // In production, this would analyze text clarity and legibility
    const baseScore = metadata.qualityScore * 0.9;

    if (metadata.cropped) return baseScore + 0.1;
    return baseScore;
  }

  /**
   * Detect content types in the image
   */
  private async detectContentTypes(metadata: PhotoMetadata): Promise<void> {
    // Placeholder content detection
    // In production, this would use OCR and ML models to detect:
    // - Text presence and quality
    // - Mathematical content (equations, numbers, diagrams)
    // - Document structure

    // For now, simulate based on file characteristics
    if (metadata.size > 500 * 1024) {
      metadata.textDetected = true;
      metadata.mathContentDetected = Math.random() > 0.5;
    }

    metadata.analysisReady = metadata.qualityScore > this.config.qualityThreshold;
  }

  /**
   * Get photo metadata by ID
   */
  getPhotoMetadata(photoId: string): PhotoMetadata | null {
    return this.photoStorage.get(photoId) || null;
  }

  /**
   * Get photos for a session
   */
  getSessionPhotos(sessionId: string): PhotoMetadata[] {
    return Array.from(this.photoStorage.values()).filter(
      photo => photo.sessionId === sessionId
    );
  }

  /**
   * Get photos for a child
   */
  getChildPhotos(childId: string, limit?: number): PhotoMetadata[] {
    const photos = Array.from(this.photoStorage.values())
      .filter(photo => photo.childId === childId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? photos.slice(0, limit) : photos;
  }

  /**
   * Get upload progress for a photo
   */
  getUploadProgress(photoId: string): PhotoUploadProgress | null {
    return this.uploadProgress.get(photoId) || null;
  }

  /**
   * Delete photo and cleanup
   */
  async deletePhoto(photoId: string): Promise<boolean> {
    const metadata = this.photoStorage.get(photoId);
    if (!metadata) {
      return false;
    }

    // Remove from storage
    this.photoStorage.delete(photoId);
    this.uploadProgress.delete(photoId);

    this.logger.info('Photo deleted', {
      photoId,
      childId: metadata.childId,
      sessionId: metadata.sessionId
    });

    return true;
  }

  /**
   * Cleanup expired photos
   */
  private async cleanupExpiredPhotos(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [photoId, metadata] of this.photoStorage.entries()) {
      if (metadata.autoDeleteAt <= now || metadata.expiresAt <= now) {
        await this.deletePhoto(photoId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(`Cleaned up ${cleanedCount} expired photos`);
    }

    return cleanedCount;
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Run cleanup every 30 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredPhotos().catch(error => {
        this.logger.error('Photo cleanup failed', {
          error: error instanceof Error ? error.message : error
        });
      });
    }, 30 * 60 * 1000);
  }

  /**
   * Get camera service statistics
   */
  getStats(): {
    totalPhotos: number;
    photosByAge: Record<AgeGroup, number>;
    photosByFormat: Record<PhotoFormat, number>;
    averageQualityScore: number;
    averageSize: number;
    totalStorage: number;
  } {
    const photos = Array.from(this.photoStorage.values());

    const photosByAge = photos.reduce((acc, photo) => {
      acc[photo.ageGroup] = (acc[photo.ageGroup] || 0) + 1;
      return acc;
    }, {} as Record<AgeGroup, number>);

    const photosByFormat = photos.reduce((acc, photo) => {
      acc[photo.format] = (acc[photo.format] || 0) + 1;
      return acc;
    }, {} as Record<PhotoFormat, number>);

    const averageQualityScore = photos.length > 0
      ? photos.reduce((sum, photo) => sum + photo.qualityScore, 0) / photos.length
      : 0;

    const averageSize = photos.length > 0
      ? photos.reduce((sum, photo) => sum + photo.size, 0) / photos.length
      : 0;

    const totalStorage = photos.reduce((sum, photo) => sum + photo.size, 0);

    return {
      totalPhotos: photos.length,
      photosByAge,
      photosByFormat,
      averageQualityScore,
      averageSize,
      totalStorage
    };
  }

  /**
   * Cleanup and destroy service
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.photoStorage.clear();
    this.uploadProgress.clear();

    this.logger.info('Camera service destroyed');
  }
}

/**
 * Factory function to create CameraService
 */
export function createCameraService(
  config?: Partial<PhotoCaptureConfig>,
  logger?: winston.Logger
): CameraService {
  const finalConfig = { ...defaultPhotoCaptureConfig, ...config };
  const finalLogger = logger || winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [new winston.transports.Console()]
  });

  return new CameraService(finalConfig, finalLogger);
}
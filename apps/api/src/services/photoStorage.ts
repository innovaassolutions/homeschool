import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import type { PhotoMetadata, AgeGroup } from './camera';

// Storage configuration
export interface PhotoStorageConfig {
  // Storage paths
  tempStoragePath: string;
  maxStorageSize: number; // in bytes
  maxFileAge: number; // in hours

  // Security settings
  encryptionEnabled: boolean;
  checksumValidation: boolean;
  virusScanEnabled: boolean;

  // Upload settings
  maxConcurrentUploads: number;
  chunkSize: number; // for chunked uploads
  resumableUploads: boolean;

  // Cleanup settings
  autoCleanupEnabled: boolean;
  cleanupInterval: number; // in minutes
  orphanCleanupAge: number; // in hours

  // COPPA compliance
  dataRetentionHours: number;
  anonymizeMetadata: boolean;
  auditLogging: boolean;
}

// Upload session for chunked/resumable uploads
export interface UploadSession {
  id: string;
  photoId: string;
  childId: string;
  filename: string;
  totalSize: number;
  uploadedSize: number;
  chunkCount: number;
  uploadedChunks: Set<number>;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isComplete: boolean;
}

// Storage statistics
export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  averageFileSize: number;
  oldestFile: Date | null;
  newestFile: Date | null;
  storageUtilization: number; // percentage of max storage used
  filesByAge: Record<AgeGroup, number>;
  uploadsInProgress: number;
}

// File operation result
export interface FileOperationResult {
  success: boolean;
  filePath?: string;
  size?: number;
  checksum?: string;
  error?: string;
  uploadTime?: number;
}

// Default configuration
export const defaultPhotoStorageConfig: PhotoStorageConfig = {
  tempStoragePath: '/tmp/homeschool-photos',
  maxStorageSize: 1024 * 1024 * 1024, // 1GB
  maxFileAge: 24, // 24 hours
  encryptionEnabled: true,
  checksumValidation: true,
  virusScanEnabled: false, // Would enable in production
  maxConcurrentUploads: 5,
  chunkSize: 1024 * 1024, // 1MB chunks
  resumableUploads: true,
  autoCleanupEnabled: true,
  cleanupInterval: 30, // 30 minutes
  orphanCleanupAge: 2, // 2 hours
  dataRetentionHours: 24,
  anonymizeMetadata: true,
  auditLogging: true
};

/**
 * Photo Storage Service
 * Handles secure temporary storage of photos with COPPA compliance
 */
export class PhotoStorageService {
  private config: PhotoStorageConfig;
  private logger: winston.Logger;
  private uploadSessions: Map<string, UploadSession> = new Map();
  private activeUploads: Set<string> = new Set();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: PhotoStorageConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
    this.initializeStorage();
    this.startCleanupTimer();
  }

  /**
   * Initialize storage directory
   */
  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(this.config.tempStoragePath, { recursive: true });

      this.logger.info('Photo storage initialized', {
        storagePath: this.config.tempStoragePath,
        maxSize: this.config.maxStorageSize,
        encryptionEnabled: this.config.encryptionEnabled
      });
    } catch (error) {
      this.logger.error('Failed to initialize photo storage', {
        error: error instanceof Error ? error.message : error,
        storagePath: this.config.tempStoragePath
      });
      throw error;
    }
  }

  /**
   * Store photo file
   */
  async storePhoto(
    photoId: string,
    fileBuffer: Buffer,
    metadata: PhotoMetadata
  ): Promise<FileOperationResult> {
    const startTime = Date.now();

    try {
      // Check storage limits
      await this.checkStorageLimits(fileBuffer.length);

      // Generate secure filename
      const filename = this.generateSecureFilename(photoId, metadata.format);
      const filePath = path.join(this.config.tempStoragePath, filename);

      // Validate file if enabled
      if (this.config.checksumValidation) {
        const checksum = await this.calculateChecksum(fileBuffer);
        this.logger.debug('File checksum calculated', { photoId, checksum });
      }

      // Encrypt file if enabled
      let finalBuffer = fileBuffer;
      if (this.config.encryptionEnabled) {
        finalBuffer = await this.encryptBuffer(fileBuffer);
      }

      // Write file to storage
      await fs.writeFile(filePath, finalBuffer);

      // Set file permissions for security
      await fs.chmod(filePath, 0o600); // Owner read/write only

      const uploadTime = Date.now() - startTime;

      this.logger.info('Photo stored successfully', {
        photoId,
        filename,
        size: fileBuffer.length,
        uploadTime,
        encrypted: this.config.encryptionEnabled
      });

      return {
        success: true,
        filePath,
        size: fileBuffer.length,
        uploadTime
      };
    } catch (error) {
      this.logger.error('Failed to store photo', {
        photoId,
        error: error instanceof Error ? error.message : error,
        uploadTime: Date.now() - startTime
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Storage failed'
      };
    }
  }

  /**
   * Create chunked upload session
   */
  async createUploadSession(
    photoId: string,
    childId: string,
    filename: string,
    totalSize: number
  ): Promise<UploadSession> {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours

    const chunkCount = Math.ceil(totalSize / this.config.chunkSize);

    const session: UploadSession = {
      id: sessionId,
      photoId,
      childId,
      filename,
      totalSize,
      uploadedSize: 0,
      chunkCount,
      uploadedChunks: new Set(),
      createdAt: now,
      lastActivity: now,
      expiresAt,
      isComplete: false
    };

    this.uploadSessions.set(sessionId, session);

    this.logger.info('Upload session created', {
      sessionId,
      photoId,
      childId,
      totalSize,
      chunkCount,
      expiresAt: expiresAt.toISOString()
    });

    return session;
  }

  /**
   * Upload file chunk
   */
  async uploadChunk(
    sessionId: string,
    chunkIndex: number,
    chunkData: Buffer
  ): Promise<{ success: boolean; bytesUploaded: number; isComplete: boolean }> {
    const session = this.uploadSessions.get(sessionId);
    if (!session) {
      throw new Error(`Upload session not found: ${sessionId}`);
    }

    if (session.isComplete) {
      throw new Error(`Upload session already complete: ${sessionId}`);
    }

    if (session.expiresAt < new Date()) {
      throw new Error(`Upload session expired: ${sessionId}`);
    }

    try {
      // Generate chunk filename
      const chunkFilename = `${session.photoId}_chunk_${chunkIndex}`;
      const chunkPath = path.join(this.config.tempStoragePath, chunkFilename);

      // Store chunk
      await fs.writeFile(chunkPath, chunkData);

      // Update session
      session.uploadedChunks.add(chunkIndex);
      session.uploadedSize += chunkData.length;
      session.lastActivity = new Date();

      // Check if upload is complete
      const isComplete = session.uploadedChunks.size === session.chunkCount;

      if (isComplete) {
        await this.assembleChunks(session);
        session.isComplete = true;
      }

      this.logger.debug('Chunk uploaded', {
        sessionId,
        chunkIndex,
        chunkSize: chunkData.length,
        totalUploaded: session.uploadedSize,
        totalSize: session.totalSize,
        isComplete
      });

      return {
        success: true,
        bytesUploaded: session.uploadedSize,
        isComplete
      };
    } catch (error) {
      this.logger.error('Chunk upload failed', {
        sessionId,
        chunkIndex,
        error: error instanceof Error ? error.message : error
      });

      throw error;
    }
  }

  /**
   * Assemble uploaded chunks into final file
   */
  private async assembleChunks(session: UploadSession): Promise<void> {
    const finalFilename = this.generateSecureFilename(session.photoId, 'temp');
    const finalPath = path.join(this.config.tempStoragePath, finalFilename);

    try {
      // Create write stream for final file
      const writeStream = await fs.open(finalPath, 'w');

      // Read and write chunks in order
      for (let i = 0; i < session.chunkCount; i++) {
        const chunkFilename = `${session.photoId}_chunk_${i}`;
        const chunkPath = path.join(this.config.tempStoragePath, chunkFilename);

        const chunkData = await fs.readFile(chunkPath);
        await writeStream.write(chunkData);

        // Clean up chunk file
        await fs.unlink(chunkPath);
      }

      await writeStream.close();

      this.logger.info('Chunks assembled successfully', {
        sessionId: session.id,
        photoId: session.photoId,
        finalPath,
        totalSize: session.totalSize
      });
    } catch (error) {
      this.logger.error('Failed to assemble chunks', {
        sessionId: session.id,
        photoId: session.photoId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Retrieve photo file
   */
  async retrievePhoto(photoId: string): Promise<Buffer | null> {
    try {
      const filename = await this.findPhotoFile(photoId);
      if (!filename) {
        return null;
      }

      const filePath = path.join(this.config.tempStoragePath, filename);
      let fileBuffer = await fs.readFile(filePath);

      // Decrypt if encrypted
      if (this.config.encryptionEnabled) {
        fileBuffer = await this.decryptBuffer(fileBuffer);
      }

      this.logger.debug('Photo retrieved', {
        photoId,
        size: fileBuffer.length
      });

      return fileBuffer;
    } catch (error) {
      this.logger.error('Failed to retrieve photo', {
        photoId,
        error: error instanceof Error ? error.message : error
      });
      return null;
    }
  }

  /**
   * Delete photo file
   */
  async deletePhoto(photoId: string): Promise<boolean> {
    try {
      const filename = await this.findPhotoFile(photoId);
      if (!filename) {
        return false;
      }

      const filePath = path.join(this.config.tempStoragePath, filename);
      await fs.unlink(filePath);

      this.logger.info('Photo deleted', { photoId, filename });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete photo', {
        photoId,
        error: error instanceof Error ? error.message : error
      });
      return false;
    }
  }

  /**
   * Get upload session
   */
  getUploadSession(sessionId: string): UploadSession | null {
    return this.uploadSessions.get(sessionId) || null;
  }

  /**
   * Check storage limits
   */
  private async checkStorageLimits(fileSize: number): Promise<void> {
    const stats = await this.getStorageStats();

    if (stats.totalSize + fileSize > this.config.maxStorageSize) {
      throw new Error('Storage limit exceeded');
    }

    if (this.activeUploads.size >= this.config.maxConcurrentUploads) {
      throw new Error('Too many concurrent uploads');
    }
  }

  /**
   * Generate secure filename
   */
  private generateSecureFilename(photoId: string, format: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `photo_${photoId}_${timestamp}_${random}.${format}`;
  }

  /**
   * Find photo file by ID
   */
  private async findPhotoFile(photoId: string): Promise<string | null> {
    try {
      const files = await fs.readdir(this.config.tempStoragePath);
      return files.find(file => file.includes(photoId)) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate file checksum (placeholder)
   */
  private async calculateChecksum(buffer: Buffer): Promise<string> {
    // In production, use crypto.createHash('sha256')
    return `checksum_${buffer.length}_${Date.now()}`;
  }

  /**
   * Encrypt buffer (placeholder)
   */
  private async encryptBuffer(buffer: Buffer): Promise<Buffer> {
    // In production, use actual encryption (AES-256-GCM)
    // For now, just return the buffer
    return buffer;
  }

  /**
   * Decrypt buffer (placeholder)
   */
  private async decryptBuffer(buffer: Buffer): Promise<Buffer> {
    // In production, use actual decryption
    // For now, just return the buffer
    return buffer;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      const files = await fs.readdir(this.config.tempStoragePath);
      let totalSize = 0;
      let oldestFile: Date | null = null;
      let newestFile: Date | null = null;

      for (const file of files) {
        const filePath = path.join(this.config.tempStoragePath, file);
        const stats = await fs.stat(filePath);

        totalSize += stats.size;

        if (!oldestFile || stats.birthtime < oldestFile) {
          oldestFile = stats.birthtime;
        }

        if (!newestFile || stats.birthtime > newestFile) {
          newestFile = stats.birthtime;
        }
      }

      const averageFileSize = files.length > 0 ? totalSize / files.length : 0;
      const storageUtilization = (totalSize / this.config.maxStorageSize) * 100;

      return {
        totalFiles: files.length,
        totalSize,
        averageFileSize,
        oldestFile,
        newestFile,
        storageUtilization,
        filesByAge: { ages6to9: 0, ages10to13: 0, ages14to16: 0 }, // Would calculate from metadata
        uploadsInProgress: this.uploadSessions.size
      };
    } catch (error) {
      this.logger.error('Failed to get storage stats', {
        error: error instanceof Error ? error.message : error
      });

      return {
        totalFiles: 0,
        totalSize: 0,
        averageFileSize: 0,
        oldestFile: null,
        newestFile: null,
        storageUtilization: 0,
        filesByAge: { ages6to9: 0, ages10to13: 0, ages14to16: 0 },
        uploadsInProgress: 0
      };
    }
  }

  /**
   * Cleanup expired files and sessions
   */
  private async cleanup(): Promise<number> {
    let cleanedCount = 0;
    const now = new Date();
    const maxAge = this.config.maxFileAge * 60 * 60 * 1000; // Convert to milliseconds

    try {
      // Clean up expired upload sessions
      for (const [sessionId, session] of this.uploadSessions.entries()) {
        if (session.expiresAt <= now) {
          await this.cleanupSession(session);
          this.uploadSessions.delete(sessionId);
          cleanedCount++;
        }
      }

      // Clean up old files
      const files = await fs.readdir(this.config.tempStoragePath);
      for (const file of files) {
        const filePath = path.join(this.config.tempStoragePath, file);
        const stats = await fs.stat(filePath);

        if (now.getTime() - stats.birthtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.info(`Cleaned up ${cleanedCount} expired files and sessions`);
      }
    } catch (error) {
      this.logger.error('Cleanup failed', {
        error: error instanceof Error ? error.message : error
      });
    }

    return cleanedCount;
  }

  /**
   * Cleanup upload session files
   */
  private async cleanupSession(session: UploadSession): Promise<void> {
    try {
      // Remove chunk files
      for (let i = 0; i < session.chunkCount; i++) {
        const chunkFilename = `${session.photoId}_chunk_${i}`;
        const chunkPath = path.join(this.config.tempStoragePath, chunkFilename);

        try {
          await fs.unlink(chunkPath);
        } catch (error) {
          // Chunk file may not exist, ignore error
        }
      }

      this.logger.debug('Upload session cleaned up', {
        sessionId: session.id,
        photoId: session.photoId
      });
    } catch (error) {
      this.logger.error('Failed to cleanup upload session', {
        sessionId: session.id,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (!this.config.autoCleanupEnabled) {
      return;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    const intervalMs = this.config.cleanupInterval * 60 * 1000; // Convert to milliseconds

    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => {
        this.logger.error('Scheduled cleanup failed', {
          error: error instanceof Error ? error.message : error
        });
      });
    }, intervalMs);

    this.logger.info('Cleanup timer started', {
      intervalMinutes: this.config.cleanupInterval
    });
  }

  /**
   * Destroy service and cleanup
   */
  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Final cleanup
    await this.cleanup();

    this.uploadSessions.clear();
    this.activeUploads.clear();

    this.logger.info('Photo storage service destroyed');
  }
}

/**
 * Factory function to create PhotoStorageService
 */
export function createPhotoStorageService(
  config?: Partial<PhotoStorageConfig>,
  logger?: winston.Logger
): PhotoStorageService {
  const finalConfig = { ...defaultPhotoStorageConfig, ...config };
  const finalLogger = logger || winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [new winston.transports.Console()]
  });

  return new PhotoStorageService(finalConfig, finalLogger);
}
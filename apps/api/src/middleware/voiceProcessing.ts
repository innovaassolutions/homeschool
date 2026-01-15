import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import multer from 'multer';
import crypto from 'crypto';

// COPPA compliance audit log entry
export interface COPPAAuditLogEntry {
  timestamp: Date;
  sessionId: string;
  childId: string;
  ageGroup: string;
  action: 'audio_received' | 'audio_processed' | 'audio_discarded' | 'consent_verified' | 'error_occurred';
  details: {
    audioSize?: number;
    processingTime?: number;
    consentVerified: boolean;
    dataRetained: boolean;
    errorMessage?: string;
  };
  requestId: string;
  ipAddress?: string;
}

// Voice processing configuration
export interface VoiceProcessingConfig {
  maxAudioSize: number; // Maximum audio file size in bytes
  allowedFormats: string[]; // Allowed audio formats
  maxProcessingTime: number; // Maximum processing time before timeout
  requireParentalConsent: boolean; // Require explicit parental consent
  auditLogRetention: number; // Days to retain audit logs
  enableSecurityHeaders: boolean; // Add security headers to responses
  encryptionKey?: string; // Key for encrypting temporary audio data
}

// Extended request interface for voice processing
export interface VoiceProcessingRequest extends Request {
  audioFile?: Express.Multer.File;
  audioMetadata?: {
    originalName: string;
    size: number;
    format: string;
    uploadTime: Date;
    processingId: string;
  };
  coppaCompliance?: {
    consentVerified: boolean;
    consentDate?: Date;
    parentalApproval: boolean;
    ageGroup: string;
    dataHandlingPreferences: {
      allowProcessing: boolean;
      allowTemporaryStorage: boolean;
      requireImmediateDisposal: boolean;
    };
  };
}

/**
 * COPPA-Compliant Voice Processing Middleware
 *
 * Ensures all voice data processing complies with COPPA regulations:
 * - No permanent storage of child audio data
 * - Parental consent verification
 * - Comprehensive audit logging
 * - Secure data handling and immediate disposal
 * - Privacy-first processing pipeline
 */
export class VoiceProcessingMiddleware {
  private logger: winston.Logger;
  private config: VoiceProcessingConfig;
  private auditLog: COPPAAuditLogEntry[] = [];
  private uploadHandler: multer.Multer;

  constructor(config: VoiceProcessingConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;

    // Configure multer for secure audio file handling
    this.uploadHandler = multer({
      storage: multer.memoryStorage(), // Store in memory only (no disk storage)
      limits: {
        fileSize: config.maxAudioSize,
        files: 1, // Only one audio file at a time
      },
      fileFilter: this.audioFileFilter.bind(this),
    });

    this.logger.info('VoiceProcessingMiddleware initialized', {
      maxAudioSize: config.maxAudioSize,
      allowedFormats: config.allowedFormats,
      requireParentalConsent: config.requireParentalConsent
    });
  }

  /**
   * Multer file filter for audio validation
   */
  private audioFileFilter(
    req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ): void {
    // Extract format from mimetype
    const format = file.mimetype.split('/')[1];

    if (this.config.allowedFormats.includes(format)) {
      cb(null, true);
    } else {
      cb(new Error(`Audio format '${format}' not allowed. Supported formats: ${this.config.allowedFormats.join(', ')}`));
    }
  }

  /**
   * Middleware to handle audio upload with COPPA compliance
   */
  handleAudioUpload = (req: VoiceProcessingRequest, res: Response, next: NextFunction): void => {
    const processingId = this.generateProcessingId();
    req.headers['processing-id'] = processingId;

    this.uploadHandler.single('audio')(req, res, (err) => {
      if (err) {
        this.logAuditEntry(req, 'error_occurred', {
          consentVerified: false,
          dataRetained: false,
          errorMessage: err.message
        }, processingId);

        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
              error: 'audio_too_large',
              message: `Audio file exceeds maximum size of ${this.config.maxAudioSize / 1024 / 1024}MB`,
              maxSize: this.config.maxAudioSize
            });
          }
        }

        return res.status(400).json({
          error: 'audio_upload_failed',
          message: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'no_audio_file',
          message: 'No audio file provided'
        });
      }

      // Set audio metadata
      req.audioFile = req.file;
      req.audioMetadata = {
        originalName: req.file.originalname,
        size: req.file.size,
        format: req.file.mimetype.split('/')[1],
        uploadTime: new Date(),
        processingId
      };

      this.logAuditEntry(req, 'audio_received', {
        audioSize: req.file.size,
        consentVerified: false, // Will be verified in next middleware
        dataRetained: false
      }, processingId);

      next();
    });
  };

  /**
   * Verify COPPA compliance and parental consent
   */
  verifyCOPPACompliance = (req: VoiceProcessingRequest, res: Response, next: NextFunction): void => {
    const processingId = req.headers['processing-id'] as string;

    try {
      // Extract child information from authenticated user context
      const user = (req as any).user;
      const childProfile = (req as any).childProfile;

      if (!user || !childProfile) {
        this.logAuditEntry(req, 'error_occurred', {
          consentVerified: false,
          dataRetained: false,
          errorMessage: 'Missing user or child profile information'
        }, processingId);

        return res.status(401).json({
          error: 'authentication_required',
          message: 'Valid authentication required for voice processing'
        });
      }

      // Verify parental consent for voice processing
      const hasVoiceConsent = this.verifyVoiceConsent(user, childProfile);
      const ageGroup = childProfile.age_group || 'unknown';

      if (this.config.requireParentalConsent && !hasVoiceConsent) {
        this.logAuditEntry(req, 'error_occurred', {
          consentVerified: false,
          dataRetained: false,
          errorMessage: 'Parental consent not found for voice processing'
        }, processingId);

        return res.status(403).json({
          error: 'consent_required',
          message: 'Parental consent required for voice processing features',
          ageGroup,
          consentRequired: true
        });
      }

      // Set COPPA compliance context
      req.coppaCompliance = {
        consentVerified: hasVoiceConsent,
        consentDate: user.coppaConsentDate || user.createdAt,
        parentalApproval: true,
        ageGroup,
        dataHandlingPreferences: {
          allowProcessing: true,
          allowTemporaryStorage: false, // Never allow persistent storage
          requireImmediateDisposal: true
        }
      };

      this.logAuditEntry(req, 'consent_verified', {
        consentVerified: hasVoiceConsent,
        dataRetained: false
      }, processingId);

      next();

    } catch (error) {
      this.logAuditEntry(req, 'error_occurred', {
        consentVerified: false,
        dataRetained: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }, processingId);

      this.logger.error('COPPA compliance verification failed', {
        error: error instanceof Error ? error.message : error,
        processingId
      });

      res.status(500).json({
        error: 'compliance_verification_failed',
        message: 'Unable to verify COPPA compliance'
      });
    }
  };

  /**
   * Encrypt audio data for temporary processing
   */
  encryptAudioData = (req: VoiceProcessingRequest, res: Response, next: NextFunction): void => {
    const processingId = req.headers['processing-id'] as string;

    if (!req.audioFile || !this.config.encryptionKey) {
      return next(); // Skip encryption if no key provided
    }

    try {
      const cipher = crypto.createCipher('aes-256-cbc', this.config.encryptionKey);
      let encrypted = cipher.update(req.audioFile.buffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // Replace buffer with encrypted version
      req.audioFile.buffer = encrypted;

      this.logger.debug('Audio data encrypted for processing', {
        processingId,
        originalSize: req.audioFile.size,
        encryptedSize: encrypted.length
      });

      next();

    } catch (error) {
      this.logAuditEntry(req, 'error_occurred', {
        consentVerified: req.coppaCompliance?.consentVerified || false,
        dataRetained: false,
        errorMessage: 'Audio encryption failed'
      }, processingId);

      this.logger.error('Audio encryption failed', {
        error: error instanceof Error ? error.message : error,
        processingId
      });

      res.status(500).json({
        error: 'encryption_failed',
        message: 'Unable to securely process audio data'
      });
    }
  };

  /**
   * Ensure immediate audio data disposal after processing
   */
  ensureDataDisposal = (req: VoiceProcessingRequest, res: Response, next: NextFunction): void => {
    const processingId = req.headers['processing-id'] as string;

    // Override res.end to ensure cleanup
    const originalEnd = res.end.bind(res);
    res.end = (...args: any[]) => {
      this.disposeAudioData(req, processingId);
      return originalEnd(...args);
    };

    // Also clean up on response finish
    res.on('finish', () => {
      this.disposeAudioData(req, processingId);
    });

    // Set timeout to force cleanup
    setTimeout(() => {
      this.disposeAudioData(req, processingId);
    }, this.config.maxProcessingTime);

    next();
  };

  /**
   * Add security headers for voice processing responses
   */
  addSecurityHeaders = (req: VoiceProcessingRequest, res: Response, next: NextFunction): void => {
    if (this.config.enableSecurityHeaders) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Content-Security-Policy', "default-src 'none'");

      // COPPA-specific headers
      res.setHeader('X-COPPA-Compliant', 'true');
      res.setHeader('X-Data-Retention', 'none');
      res.setHeader('X-Processing-Mode', 'temporary-only');
    }

    next();
  };

  /**
   * Verify voice processing consent
   */
  private verifyVoiceConsent(user: any, childProfile: any): boolean {
    // Check for explicit voice processing consent
    if (user.voiceProcessingConsent && user.voiceConsentDate) {
      const consentAge = Date.now() - new Date(user.voiceConsentDate).getTime();
      const maxConsentAge = 365 * 24 * 60 * 60 * 1000; // 1 year

      return consentAge < maxConsentAge;
    }

    // Fallback to general COPPA consent if voice-specific consent not found
    return user.coppaConsent && user.coppaConsentDate;
  }

  /**
   * Generate unique processing ID
   */
  private generateProcessingId(): string {
    return `voice_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Log audit entry for COPPA compliance
   */
  private logAuditEntry(
    req: VoiceProcessingRequest,
    action: COPPAAuditLogEntry['action'],
    details: COPPAAuditLogEntry['details'],
    processingId: string
  ): void {
    const user = (req as any).user;
    const childProfile = (req as any).childProfile;

    const auditEntry: COPPAAuditLogEntry = {
      timestamp: new Date(),
      sessionId: req.headers['session-id'] as string || 'unknown',
      childId: childProfile?.id || 'unknown',
      ageGroup: childProfile?.age_group || 'unknown',
      action,
      details,
      requestId: processingId,
      ipAddress: req.ip
    };

    this.auditLog.push(auditEntry);

    // Keep audit log within reasonable size
    if (this.auditLog.length > 10000) {
      this.auditLog.splice(0, 5000); // Remove oldest 5000 entries
    }

    this.logger.info('COPPA audit log entry', auditEntry);
  }

  /**
   * Dispose of audio data immediately after processing
   */
  private disposeAudioData(req: VoiceProcessingRequest, processingId: string): void {
    if (req.audioFile) {
      // Overwrite buffer with zeros for security
      if (req.audioFile.buffer) {
        req.audioFile.buffer.fill(0);
      }

      // Clear all references
      delete req.audioFile;
      delete req.audioMetadata;

      this.logAuditEntry(req, 'audio_discarded', {
        consentVerified: req.coppaCompliance?.consentVerified || false,
        dataRetained: false
      }, processingId);

      this.logger.debug('Audio data disposed', { processingId });
    }
  }

  /**
   * Get COPPA audit logs (for compliance reporting)
   */
  getAuditLogs(childId?: string, startDate?: Date, endDate?: Date): COPPAAuditLogEntry[] {
    let logs = this.auditLog;

    if (childId) {
      logs = logs.filter(entry => entry.childId === childId);
    }

    if (startDate) {
      logs = logs.filter(entry => entry.timestamp >= startDate);
    }

    if (endDate) {
      logs = logs.filter(entry => entry.timestamp <= endDate);
    }

    return logs;
  }

  /**
   * Export audit logs for compliance reporting
   */
  exportAuditLogs(): {
    totalEntries: number;
    dateRange: { start: Date; end: Date };
    summary: Record<string, number>;
    logs: COPPAAuditLogEntry[];
  } {
    const summary: Record<string, number> = {};
    this.auditLog.forEach(entry => {
      summary[entry.action] = (summary[entry.action] || 0) + 1;
    });

    const dates = this.auditLog.map(entry => entry.timestamp);
    const startDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : new Date();
    const endDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();

    return {
      totalEntries: this.auditLog.length,
      dateRange: { start: startDate, end: endDate },
      summary,
      logs: this.auditLog
    };
  }

  /**
   * Clear old audit logs based on retention policy
   */
  cleanupAuditLogs(): number {
    const cutoffDate = new Date(Date.now() - (this.config.auditLogRetention * 24 * 60 * 60 * 1000));
    const initialLength = this.auditLog.length;

    this.auditLog = this.auditLog.filter(entry => entry.timestamp > cutoffDate);

    const removedCount = initialLength - this.auditLog.length;

    if (removedCount > 0) {
      this.logger.info(`Cleaned up ${removedCount} old audit log entries`);
    }

    return removedCount;
  }

  /**
   * Get compliance statistics
   */
  getComplianceStats(): {
    totalProcessingRequests: number;
    consentVerificationRate: number;
    dataRetentionRate: number; // Should always be 0% for COPPA compliance
    errorRate: number;
    ageGroupBreakdown: Record<string, number>;
  } {
    const total = this.auditLog.length;
    const consentVerified = this.auditLog.filter(entry => entry.details.consentVerified).length;
    const dataRetained = this.auditLog.filter(entry => entry.details.dataRetained).length;
    const errors = this.auditLog.filter(entry => entry.action === 'error_occurred').length;

    const ageGroups: Record<string, number> = {};
    this.auditLog.forEach(entry => {
      ageGroups[entry.ageGroup] = (ageGroups[entry.ageGroup] || 0) + 1;
    });

    return {
      totalProcessingRequests: total,
      consentVerificationRate: total > 0 ? consentVerified / total : 0,
      dataRetentionRate: total > 0 ? dataRetained / total : 0, // Should be 0 for COPPA compliance
      errorRate: total > 0 ? errors / total : 0,
      ageGroupBreakdown: ageGroups
    };
  }
}

/**
 * Factory function to create VoiceProcessingMiddleware
 */
export function createVoiceProcessingMiddleware(
  config: VoiceProcessingConfig,
  logger: winston.Logger
): VoiceProcessingMiddleware {
  return new VoiceProcessingMiddleware(config, logger);
}

/**
 * Default voice processing configuration
 */
export const defaultVoiceProcessingConfig: VoiceProcessingConfig = {
  maxAudioSize: 10 * 1024 * 1024, // 10MB max
  allowedFormats: ['webm', 'wav', 'mp3', 'ogg', 'm4a'],
  maxProcessingTime: 30000, // 30 seconds
  requireParentalConsent: true,
  auditLogRetention: 30, // 30 days
  enableSecurityHeaders: true
};
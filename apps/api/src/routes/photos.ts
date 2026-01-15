import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import winston from 'winston';
import { authenticateToken, validateFamilyAccess } from '../middleware/auth';
import {
  CameraService,
  createCameraService,
  defaultPhotoCaptureConfig,
  type PhotoFormat
} from '../services/camera';
import {
  ImageProcessingService,
  createImageProcessingService,
  defaultImageProcessingConfig
} from '../services/imageProcessing';
import {
  PhotoStorageService,
  createPhotoStorageService,
  defaultPhotoStorageConfig
} from '../services/photoStorage';
import {
  WorkAnalysisService,
  createWorkAnalysisService
} from '../services/workAnalysis';

const router = express.Router();

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

// Initialize services
let cameraService: CameraService;
let imageProcessingService: ImageProcessingService;
let photoStorageService: PhotoStorageService;
let workAnalysisService: WorkAnalysisService;

// Service initialization function
export function initializePhotoServices(): void {
  cameraService = createCameraService(defaultPhotoCaptureConfig, logger);
  imageProcessingService = createImageProcessingService(defaultImageProcessingConfig, logger);
  photoStorageService = createPhotoStorageService(defaultPhotoStorageConfig, logger);
  workAnalysisService = createWorkAnalysisService();

  logger.info('Photo services initialized');
}

// Multer configuration for photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

// Validation schemas
const CreatePhotoSchema = z.object({
  sessionId: z.string().uuid().optional(),
  ageGroup: z.enum(['ages6to9', 'ages10to13', 'ages14to16']),
  quality: z.enum(['low', 'medium', 'high', 'ultra']).optional(),
  autoProcess: z.boolean().optional().default(true),
  autoAnalyze: z.boolean().optional().default(true)
});

const UploadSessionSchema = z.object({
  filename: z.string().min(1).max(255),
  totalSize: z.number().min(1).max(10 * 1024 * 1024), // 10MB max
  ageGroup: z.enum(['ages6to9', 'ages10to13', 'ages14to16']),
  sessionId: z.string().uuid().optional()
});

const ChunkUploadSchema = z.object({
  chunkIndex: z.number().min(0),
  sessionId: z.string().uuid()
});

/**
 * POST /api/photos
 *
 * Upload a photo directly (single upload)
 */
router.post('/',
  authenticateToken,
  validateFamilyAccess,
  upload.single('photo'),
  async (req: express.Request, res: express.Response) => {
    try {
      if (!cameraService) {
        return res.status(500).json({
          error: 'service_unavailable',
          message: 'Photo services not initialized'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'no_file',
          message: 'No photo file provided'
        });
      }

      // Validate request body
      const validationResult = CreatePhotoSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Invalid request data',
          details: validationResult.error.issues
        });
      }

      const { sessionId, ageGroup, autoProcess, autoAnalyze } = validationResult.data;
      const childProfile = (req as any).childProfile;

      // Determine photo format
      const format: PhotoFormat = req.file.mimetype === 'image/png' ? 'png' :
                                  req.file.mimetype === 'image/webp' ? 'webp' : 'jpeg';

      // Create photo metadata
      const metadata = await cameraService.createPhotoMetadata(
        childProfile.id,
        ageGroup,
        req.file.originalname,
        sessionId
      );

      // Store photo
      const storageResult = await photoStorageService.storePhoto(
        metadata.id,
        req.file.buffer,
        metadata
      );

      if (!storageResult.success) {
        return res.status(500).json({
          error: 'storage_failed',
          message: storageResult.error || 'Failed to store photo'
        });
      }

      // Process image if auto-processing is enabled
      let processedMetadata = metadata;
      if (autoProcess) {
        try {
          processedMetadata = await cameraService.processPhoto(
            metadata.id,
            req.file.buffer,
            format
          );

          // Prepare for analysis
          const analysisPrep = await imageProcessingService.prepareForAnalysis(
            req.file.buffer,
            processedMetadata
          );

          logger.info('Photo processed and prepared for analysis', {
            photoId: metadata.id,
            childId: childProfile.id,
            readyForAnalysis: analysisPrep.readyForAnalysis,
            qualityScore: analysisPrep.qualityMetrics.overall
          });

          // Trigger automatic analysis if enabled and photo is ready
          if (autoAnalyze && workAnalysisService && analysisPrep.readyForAnalysis) {
            try {
              // Convert ageGroup to analysis format
              const analysisAgeGroup = ageGroup;

              // Start analysis in background (don't wait for completion)
              setImmediate(async () => {
                try {
                  const analysisResult = await workAnalysisService.analyzeWork(
                    processedMetadata.id,
                    req.file!.buffer,
                    childProfile.id,
                    analysisAgeGroup,
                    sessionId
                  );

                  logger.info('Photo analysis completed automatically', {
                    photoId: processedMetadata.id,
                    analysisId: analysisResult.id,
                    contentItemsFound: analysisResult.identifiedProblems.length,
                    subjectsDetected: Array.from(new Set(analysisResult.identifiedProblems.map(c => c.subject))),
                    overallAccuracy: analysisResult.skillAssessment.overallAccuracy
                  });
                } catch (analysisError) {
                  logger.error('Automatic photo analysis failed', {
                    photoId: processedMetadata.id,
                    error: analysisError instanceof Error ? analysisError.message : analysisError
                  });
                }
              });

              logger.info('Automatic analysis triggered for photo', {
                photoId: processedMetadata.id,
                childId: childProfile.id
              });
            } catch (analysisError) {
              logger.error('Failed to trigger automatic analysis', {
                photoId: processedMetadata.id,
                error: analysisError instanceof Error ? analysisError.message : analysisError
              });
            }
          }
        } catch (processingError) {
          logger.error('Photo processing failed, but upload succeeded', {
            photoId: metadata.id,
            error: processingError instanceof Error ? processingError.message : processingError
          });
        }
      }

      res.status(201).json({
        success: true,
        photo: {
          id: processedMetadata.id,
          filename: processedMetadata.filename,
          format: processedMetadata.format,
          size: processedMetadata.size,
          qualityScore: processedMetadata.qualityScore,
          readabilityScore: processedMetadata.readabilityScore,
          analysisReady: processedMetadata.analysisReady,
          timestamp: processedMetadata.timestamp,
          sessionId: processedMetadata.sessionId,
          autoAnalysisTriggered: autoAnalyze && processedMetadata.analysisReady
        },
        message: autoAnalyze && processedMetadata.analysisReady
          ? 'Photo uploaded, processed, and automatic analysis started'
          : 'Photo uploaded and processed successfully'
      });

    } catch (error) {
      logger.error('Photo upload failed', {
        error: error instanceof Error ? error.message : error,
        childId: (req as any).childProfile?.id,
        sessionId: req.body.sessionId
      });

      res.status(500).json({
        error: 'upload_failed',
        message: 'An unexpected error occurred during photo upload'
      });
    }
  }
);

/**
 * POST /api/photos/upload-session
 *
 * Create a chunked upload session for large photos
 */
router.post('/upload-session',
  authenticateToken,
  validateFamilyAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      if (!photoStorageService) {
        return res.status(500).json({
          error: 'service_unavailable',
          message: 'Photo storage service not initialized'
        });
      }

      // Validate request body
      const validationResult = UploadSessionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Invalid request data',
          details: validationResult.error.issues
        });
      }

      const { filename, totalSize, ageGroup, sessionId } = validationResult.data;
      const childProfile = (req as any).childProfile;

      // Create photo metadata first
      const metadata = await cameraService.createPhotoMetadata(
        childProfile.id,
        ageGroup,
        filename,
        sessionId
      );

      // Create upload session
      const uploadSession = await photoStorageService.createUploadSession(
        metadata.id,
        childProfile.id,
        filename,
        totalSize
      );

      res.status(201).json({
        success: true,
        uploadSession: {
          id: uploadSession.id,
          photoId: uploadSession.photoId,
          totalSize: uploadSession.totalSize,
          chunkSize: defaultPhotoStorageConfig.chunkSize,
          chunkCount: uploadSession.chunkCount,
          expiresAt: uploadSession.expiresAt
        },
        message: 'Upload session created successfully'
      });

    } catch (error) {
      logger.error('Upload session creation failed', {
        error: error instanceof Error ? error.message : error,
        childId: (req as any).childProfile?.id
      });

      res.status(500).json({
        error: 'session_creation_failed',
        message: 'Failed to create upload session'
      });
    }
  }
);

/**
 * POST /api/photos/upload-chunk
 *
 * Upload a file chunk for a chunked upload session
 */
router.post('/upload-chunk',
  authenticateToken,
  validateFamilyAccess,
  upload.single('chunk'),
  async (req: express.Request, res: express.Response) => {
    try {
      if (!photoStorageService) {
        return res.status(500).json({
          error: 'service_unavailable',
          message: 'Photo storage service not initialized'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'no_chunk',
          message: 'No chunk data provided'
        });
      }

      // Validate request body
      const validationResult = ChunkUploadSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Invalid request data',
          details: validationResult.error.issues
        });
      }

      const { chunkIndex, sessionId } = validationResult.data;

      // Upload chunk
      const result = await photoStorageService.uploadChunk(
        sessionId,
        chunkIndex,
        req.file.buffer
      );

      res.status(200).json({
        success: result.success,
        bytesUploaded: result.bytesUploaded,
        isComplete: result.isComplete,
        message: result.isComplete
          ? 'Upload completed successfully'
          : `Chunk ${chunkIndex} uploaded successfully`
      });

    } catch (error) {
      logger.error('Chunk upload failed', {
        error: error instanceof Error ? error.message : error,
        sessionId: req.body.sessionId,
        chunkIndex: req.body.chunkIndex
      });

      res.status(500).json({
        error: 'chunk_upload_failed',
        message: 'Failed to upload chunk'
      });
    }
  }
);

/**
 * GET /api/photos/:photoId
 *
 * Get photo metadata
 */
router.get('/:photoId',
  authenticateToken,
  validateFamilyAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      if (!cameraService) {
        return res.status(500).json({
          error: 'service_unavailable',
          message: 'Camera service not initialized'
        });
      }

      const photoId = req.params.photoId;
      const metadata = cameraService.getPhotoMetadata(photoId);

      if (!metadata) {
        return res.status(404).json({
          error: 'photo_not_found',
          message: 'Photo not found'
        });
      }

      // Verify photo belongs to authenticated user
      const childProfile = (req as any).childProfile;
      if (metadata.childId !== childProfile.id) {
        return res.status(403).json({
          error: 'access_denied',
          message: 'You can only access your own photos'
        });
      }

      res.status(200).json({
        id: metadata.id,
        filename: metadata.filename,
        format: metadata.format,
        size: metadata.size,
        width: metadata.width,
        height: metadata.height,
        quality: metadata.quality,
        qualityScore: metadata.qualityScore,
        readabilityScore: metadata.readabilityScore,
        analysisReady: metadata.analysisReady,
        processingStatus: metadata.processingStatus,
        timestamp: metadata.timestamp,
        sessionId: metadata.sessionId,
        textDetected: metadata.textDetected,
        mathContentDetected: metadata.mathContentDetected
      });

    } catch (error) {
      logger.error('Photo retrieval failed', {
        error: error instanceof Error ? error.message : error,
        photoId: req.params.photoId
      });

      res.status(500).json({
        error: 'retrieval_failed',
        message: 'Failed to retrieve photo information'
      });
    }
  }
);

/**
 * GET /api/photos/session/:sessionId
 *
 * Get all photos for a learning session
 */
router.get('/session/:sessionId',
  authenticateToken,
  validateFamilyAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      if (!cameraService) {
        return res.status(500).json({
          error: 'service_unavailable',
          message: 'Camera service not initialized'
        });
      }

      const sessionId = req.params.sessionId;
      const photos = cameraService.getSessionPhotos(sessionId);

      // Filter photos to only include those belonging to the authenticated user
      const childProfile = (req as any).childProfile;
      const userPhotos = photos.filter(photo => photo.childId === childProfile.id);

      const photoList = userPhotos.map(photo => ({
        id: photo.id,
        filename: photo.filename,
        format: photo.format,
        size: photo.size,
        qualityScore: photo.qualityScore,
        analysisReady: photo.analysisReady,
        processingStatus: photo.processingStatus,
        timestamp: photo.timestamp,
        textDetected: photo.textDetected,
        mathContentDetected: photo.mathContentDetected
      }));

      res.status(200).json({
        sessionId,
        photos: photoList,
        totalPhotos: photoList.length
      });

    } catch (error) {
      logger.error('Session photos retrieval failed', {
        error: error instanceof Error ? error.message : error,
        sessionId: req.params.sessionId
      });

      res.status(500).json({
        error: 'retrieval_failed',
        message: 'Failed to retrieve session photos'
      });
    }
  }
);

/**
 * GET /api/photos/upload-progress/:sessionId
 *
 * Get upload progress for a chunked upload session
 */
router.get('/upload-progress/:sessionId',
  authenticateToken,
  validateFamilyAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      if (!photoStorageService) {
        return res.status(500).json({
          error: 'service_unavailable',
          message: 'Photo storage service not initialized'
        });
      }

      const sessionId = req.params.sessionId;
      const uploadSession = photoStorageService.getUploadSession(sessionId);

      if (!uploadSession) {
        return res.status(404).json({
          error: 'session_not_found',
          message: 'Upload session not found'
        });
      }

      // Verify session belongs to authenticated user
      const childProfile = (req as any).childProfile;
      if (uploadSession.childId !== childProfile.id) {
        return res.status(403).json({
          error: 'access_denied',
          message: 'You can only access your own upload sessions'
        });
      }

      const progress = (uploadSession.uploadedSize / uploadSession.totalSize) * 100;

      res.status(200).json({
        sessionId: uploadSession.id,
        photoId: uploadSession.photoId,
        progress: Math.round(progress),
        uploadedSize: uploadSession.uploadedSize,
        totalSize: uploadSession.totalSize,
        uploadedChunks: uploadSession.uploadedChunks.size,
        totalChunks: uploadSession.chunkCount,
        isComplete: uploadSession.isComplete,
        lastActivity: uploadSession.lastActivity,
        expiresAt: uploadSession.expiresAt
      });

    } catch (error) {
      logger.error('Upload progress retrieval failed', {
        error: error instanceof Error ? error.message : error,
        sessionId: req.params.sessionId
      });

      res.status(500).json({
        error: 'progress_retrieval_failed',
        message: 'Failed to retrieve upload progress'
      });
    }
  }
);

/**
 * DELETE /api/photos/:photoId
 *
 * Delete a photo
 */
router.delete('/:photoId',
  authenticateToken,
  validateFamilyAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      if (!cameraService || !photoStorageService) {
        return res.status(500).json({
          error: 'service_unavailable',
          message: 'Photo services not initialized'
        });
      }

      const photoId = req.params.photoId;
      const metadata = cameraService.getPhotoMetadata(photoId);

      if (!metadata) {
        return res.status(404).json({
          error: 'photo_not_found',
          message: 'Photo not found'
        });
      }

      // Verify photo belongs to authenticated user
      const childProfile = (req as any).childProfile;
      if (metadata.childId !== childProfile.id) {
        return res.status(403).json({
          error: 'access_denied',
          message: 'You can only delete your own photos'
        });
      }

      // Delete from storage and metadata
      const storageDeleted = await photoStorageService.deletePhoto(photoId);
      const metadataDeleted = await cameraService.deletePhoto(photoId);

      if (storageDeleted && metadataDeleted) {
        res.status(200).json({
          success: true,
          message: 'Photo deleted successfully',
          photoId
        });
      } else {
        res.status(500).json({
          error: 'deletion_failed',
          message: 'Failed to completely delete photo'
        });
      }

    } catch (error) {
      logger.error('Photo deletion failed', {
        error: error instanceof Error ? error.message : error,
        photoId: req.params.photoId
      });

      res.status(500).json({
        error: 'deletion_failed',
        message: 'Failed to delete photo'
      });
    }
  }
);

/**
 * GET /api/photos/stats
 *
 * Get photo service statistics (for parents/administrators)
 */
router.get('/stats',
  authenticateToken,
  validateFamilyAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      if (!cameraService || !photoStorageService) {
        return res.status(500).json({
          error: 'service_unavailable',
          message: 'Photo services not initialized'
        });
      }

      const user = (req as any).user;

      // Only parents can access comprehensive stats
      if (user.userType !== 'parent') {
        return res.status(403).json({
          error: 'parent_access_required',
          message: 'Only parents can access photo statistics'
        });
      }

      const cameraStats = cameraService.getStats();
      const storageStats = await photoStorageService.getStorageStats();

      res.status(200).json({
        camera: {
          totalPhotos: cameraStats.totalPhotos,
          photosByAge: cameraStats.photosByAge,
          photosByFormat: cameraStats.photosByFormat,
          averageQualityScore: cameraStats.averageQualityScore,
          averageSize: cameraStats.averageSize
        },
        storage: {
          totalFiles: storageStats.totalFiles,
          totalSize: storageStats.totalSize,
          storageUtilization: storageStats.storageUtilization,
          uploadsInProgress: storageStats.uploadsInProgress
        },
        coppaCompliant: true
      });

    } catch (error) {
      logger.error('Stats retrieval error', {
        error: error instanceof Error ? error.message : error,
        userId: (req as any).user?.id
      });

      res.status(500).json({
        error: 'stats_retrieval_failed',
        message: 'Unable to retrieve photo statistics'
      });
    }
  }
);

export default router;
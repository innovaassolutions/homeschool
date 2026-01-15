import express from 'express';
import { z } from 'zod';
import { workAnalysisService, type WorkAnalysisResult } from '../services/workAnalysis';
import { cameraService } from '../services/camera';
import { authenticateToken } from '../middleware/auth';
import { validateFamilyAccess } from '../middleware/childProfileAccess';
import { logger } from '../services/logger';
import type { AgeGroup } from '../services/camera';

const router = express.Router();

// Validation schemas
const subjectTypeSchema = z.enum(['mathematics', 'english', 'science', 'history', 'geography', 'art', 'general']);

const contentTypeSchema = z.enum([
  'mathematical_problem', 'writing_sample', 'science_experiment',
  'historical_analysis', 'creative_writing', 'reading_comprehension',
  'vocabulary_exercise', 'science_diagram', 'timeline', 'map_work',
  'art_critique', 'general_notes'
]);

const analyzePhotoSchema = z.object({
  photoId: z.string().min(1, 'Photo ID is required'),
  sessionId: z.string().optional(),
  analysisConfig: z.object({
    expectedSubjects: z.array(subjectTypeSchema).optional(),
    primarySubject: subjectTypeSchema.optional(),
    contentTypes: z.array(contentTypeSchema).optional(),
    difficultySensitivity: z.number().min(0).max(1).optional(),
    feedbackDetailLevel: z.enum(['basic', 'detailed', 'comprehensive']).optional(),
    focusAreas: z.array(z.string()).optional(),
    subjectSpecificSettings: z.record(z.object({
      enabled: z.boolean(),
      analysisDepth: z.enum(['surface', 'moderate', 'deep']),
      feedbackStyle: z.enum(['encouraging', 'analytical', 'creative']),
      specificCriteria: z.array(z.string())
    })).optional(),
    timeoutSeconds: z.number().min(5).max(120).optional()
  }).optional()
});

const getAnalysisSchema = z.object({
  analysisId: z.string().min(1, 'Analysis ID is required')
});

const reanalyzePhotoSchema = z.object({
  photoId: z.string().min(1, 'Photo ID is required'),
  analysisConfig: z.object({
    expectedSubjects: z.array(subjectTypeSchema).optional(),
    primarySubject: subjectTypeSchema.optional(),
    contentTypes: z.array(contentTypeSchema).optional(),
    difficultySensitivity: z.number().min(0).max(1).optional(),
    feedbackDetailLevel: z.enum(['basic', 'detailed', 'comprehensive']).optional(),
    focusAreas: z.array(z.string()).optional(),
    subjectSpecificSettings: z.record(z.object({
      enabled: z.boolean(),
      analysisDepth: z.enum(['surface', 'moderate', 'deep']),
      feedbackStyle: z.enum(['encouraging', 'analytical', 'creative']),
      specificCriteria: z.array(z.string())
    })).optional(),
    timeoutSeconds: z.number().min(5).max(120).optional()
  }).optional()
});

// In-memory storage for demo (replace with database in production)
const analysisResults = new Map<string, WorkAnalysisResult>();
const photoAnalysisMapping = new Map<string, string[]>(); // photoId -> analysisId[]

/**
 * POST /api/analysis/analyze
 *
 * Analyze a previously captured photo for academic content across all subjects
 */
router.post('/analyze',
  authenticateToken,
  validateFamilyAccess,
  async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();

    try {
      // Validate request body
      const validationResult = analyzePhotoSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Invalid request parameters',
          details: validationResult.error.errors
        });
      }

      const { photoId, sessionId, analysisConfig } = validationResult.data;
      const user = (req as any).user;
      const childProfile = (req as any).childProfile;

      logger.info('Starting photo analysis', {
        photoId,
        sessionId,
        childId: childProfile.id,
        ageGroup: childProfile.ageGroup,
        userId: user.id
      });

      // Retrieve photo metadata and image data
      const photoMetadata = cameraService.getPhotoMetadata(photoId);
      if (!photoMetadata) {
        return res.status(404).json({
          error: 'photo_not_found',
          message: 'Photo not found or has been deleted'
        });
      }

      // Verify photo belongs to the current child
      if (photoMetadata.childId !== childProfile.id) {
        return res.status(403).json({
          error: 'access_denied',
          message: 'Photo does not belong to the current child profile'
        });
      }

      // Get photo file data (in production, this would retrieve from storage)
      const photoFilePath = `temp/photos/${photoId}.jpg`;

      // For demo, create a dummy image buffer
      // In production, retrieve actual image from storage service
      const dummyImageBuffer = Buffer.from('dummy image data');

      // Perform work analysis
      const analysisResult = await workAnalysisService.analyzeWork(
        photoId,
        dummyImageBuffer,
        childProfile.id,
        childProfile.ageGroup as AgeGroup,
        sessionId,
        analysisConfig
      );

      // Store analysis result
      analysisResults.set(analysisResult.id, analysisResult);

      // Update photo-to-analysis mapping
      const existingAnalyses = photoAnalysisMapping.get(photoId) || [];
      existingAnalyses.push(analysisResult.id);
      photoAnalysisMapping.set(photoId, existingAnalyses);

      // Update photo metadata with analysis status
      cameraService.updatePhotoAnalysis(photoId, {
        analysisReady: analysisResult.status === 'completed',
        analysisId: analysisResult.id,
        analysisTimestamp: analysisResult.analysisTimestamp,
        confidence: analysisResult.confidence
      });

      const processingTime = Date.now() - startTime;

      logger.info('Photo analysis completed', {
        photoId,
        analysisId: analysisResult.id,
        status: analysisResult.status,
        confidence: analysisResult.confidence,
        processingTime: analysisResult.processingDuration,
        totalTime: processingTime
      });

      // Return analysis result with appropriate detail level
      const responseData = {
        analysisId: analysisResult.id,
        photoId: analysisResult.photoId,
        sessionId: analysisResult.sessionId,
        status: analysisResult.status,
        confidence: analysisResult.confidence,
        analysisTimestamp: analysisResult.analysisTimestamp,
        processingDuration: analysisResult.processingDuration,

        // OCR Results
        extractedText: analysisResult.ocrResult.extractedText,
        textConfidence: analysisResult.ocrResult.confidence,

        // Academic Content Analysis Summary
        contentItemsFound: analysisResult.identifiedProblems.length,
        contentAnalyzed: analysisResult.contentAnalysis.length,
        overallAccuracy: analysisResult.contentAnalysis.length > 0
          ? analysisResult.contentAnalysis.reduce((sum, s) => sum + s.accuracy, 0) / analysisResult.contentAnalysis.length
          : 0,

        // Educational Feedback
        feedback: {
          overall: analysisResult.feedback.overallAssessment,
          encouragement: analysisResult.feedback.encouragement,
          nextSteps: analysisResult.feedback.nextSteps,
          questionsForStudent: analysisResult.feedback.questionsForStudent,
          ageAdaptive: analysisResult.feedback.ageAdaptivePresentation
        },

        // Skill Assessment
        skillAssessment: {
          demonstratedSkills: analysisResult.skillAssessment.overallSkills,
          strengthAreas: analysisResult.skillAssessment.strengthAreas,
          improvementAreas: analysisResult.skillAssessment.improvementAreas,
          gradeEquivalency: analysisResult.skillAssessment.gradeEquivalency,
          readinessForAdvancement: analysisResult.skillAssessment.readinessForAdvancement
        },

        // Error Analysis (simplified for student consumption)
        errorSummary: {
          severity: analysisResult.errorAnalysis.severity,
          mainErrorTypes: analysisResult.errorAnalysis.errorTypes.map(e => ({
            category: e.category,
            description: e.description,
            impact: e.impact
          }))
        }
      };

      res.status(200).json({
        success: true,
        message: 'Photo analysis completed successfully',
        analysis: responseData
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error('Photo analysis failed', {
        error: error instanceof Error ? error.message : error,
        photoId: req.body.photoId,
        childId: (req as any).childProfile?.id,
        processingTime
      });

      res.status(500).json({
        error: 'analysis_failed',
        message: 'Failed to analyze photo. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * GET /api/analysis/:analysisId
 *
 * Retrieve detailed analysis results
 */
router.get('/:analysisId',
  authenticateToken,
  validateFamilyAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      const { analysisId } = req.params;
      const childProfile = (req as any).childProfile;

      // Validate analysis ID
      const validationResult = getAnalysisSchema.safeParse({ analysisId });
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Invalid analysis ID format'
        });
      }

      // Retrieve analysis result
      const analysisResult = analysisResults.get(analysisId);
      if (!analysisResult) {
        return res.status(404).json({
          error: 'analysis_not_found',
          message: 'Analysis result not found'
        });
      }

      // Verify analysis belongs to current child
      if (analysisResult.childId !== childProfile.id) {
        return res.status(403).json({
          error: 'access_denied',
          message: 'Analysis does not belong to the current child profile'
        });
      }

      logger.info('Analysis result retrieved', {
        analysisId,
        photoId: analysisResult.photoId,
        childId: childProfile.id,
        status: analysisResult.status
      });

      // Return complete analysis details
      res.status(200).json({
        success: true,
        analysis: {
          ...analysisResult,
          // Include detailed results for comprehensive view
          detailedProblems: analysisResult.identifiedProblems,
          detailedSolutions: analysisResult.contentAnalysis,
          detailedErrorAnalysis: analysisResult.errorAnalysis,
          ocrDetails: analysisResult.ocrResult
        }
      });

    } catch (error) {
      logger.error('Failed to retrieve analysis', {
        error: error instanceof Error ? error.message : error,
        analysisId: req.params.analysisId,
        childId: (req as any).childProfile?.id
      });

      res.status(500).json({
        error: 'retrieval_failed',
        message: 'Failed to retrieve analysis results'
      });
    }
  }
);

/**
 * GET /api/analysis/photo/:photoId
 *
 * Get all analyses for a specific photo
 */
router.get('/photo/:photoId',
  authenticateToken,
  validateFamilyAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      const { photoId } = req.params;
      const childProfile = (req as any).childProfile;

      // Get analysis IDs for this photo
      const analysisIds = photoAnalysisMapping.get(photoId) || [];

      // Retrieve all analyses for this photo
      const analyses = analysisIds
        .map(id => analysisResults.get(id))
        .filter(analysis => analysis && analysis.childId === childProfile.id)
        .map(analysis => ({
          id: analysis!.id,
          status: analysis!.status,
          confidence: analysis!.confidence,
          analysisTimestamp: analysis!.analysisTimestamp,
          processingDuration: analysis!.processingDuration,
          overallAssessment: analysis!.feedback.overallAssessment,
          contentItemsFound: analysis!.identifiedProblems.length,
          overallAccuracy: analysis!.contentAnalysis.length > 0
            ? analysis!.contentAnalysis.reduce((sum, s) => sum + s.accuracy, 0) / analysis!.contentAnalysis.length
            : 0
        }));

      logger.info('Photo analyses retrieved', {
        photoId,
        analysisCount: analyses.length,
        childId: childProfile.id
      });

      res.status(200).json({
        success: true,
        photoId,
        analyses
      });

    } catch (error) {
      logger.error('Failed to retrieve photo analyses', {
        error: error instanceof Error ? error.message : error,
        photoId: req.params.photoId,
        childId: (req as any).childProfile?.id
      });

      res.status(500).json({
        error: 'retrieval_failed',
        message: 'Failed to retrieve photo analyses'
      });
    }
  }
);

/**
 * POST /api/analysis/reanalyze
 *
 * Re-analyze a photo with different parameters
 */
router.post('/reanalyze',
  authenticateToken,
  validateFamilyAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      // Validate request body
      const validationResult = reanalyzePhotoSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Invalid request parameters',
          details: validationResult.error.errors
        });
      }

      const { photoId, analysisConfig } = validationResult.data;
      const childProfile = (req as any).childProfile;

      // Verify photo exists and belongs to child
      const photoMetadata = cameraService.getPhotoMetadata(photoId);
      if (!photoMetadata || photoMetadata.childId !== childProfile.id) {
        return res.status(404).json({
          error: 'photo_not_found',
          message: 'Photo not found or access denied'
        });
      }

      logger.info('Starting photo re-analysis', {
        photoId,
        childId: childProfile.id,
        previousAnalyses: photoAnalysisMapping.get(photoId)?.length || 0
      });

      // Perform new analysis
      const dummyImageBuffer = Buffer.from('dummy image data for reanalysis');

      const analysisResult = await workAnalysisService.analyzeWork(
        photoId,
        dummyImageBuffer,
        childProfile.id,
        childProfile.ageGroup as AgeGroup,
        undefined, // No session ID for re-analysis
        analysisConfig
      );

      // Store new analysis result
      analysisResults.set(analysisResult.id, analysisResult);

      // Update mapping
      const existingAnalyses = photoAnalysisMapping.get(photoId) || [];
      existingAnalyses.push(analysisResult.id);
      photoAnalysisMapping.set(photoId, existingAnalyses);

      logger.info('Photo re-analysis completed', {
        photoId,
        newAnalysisId: analysisResult.id,
        status: analysisResult.status,
        confidence: analysisResult.confidence
      });

      res.status(200).json({
        success: true,
        message: 'Photo re-analysis completed',
        analysisId: analysisResult.id,
        status: analysisResult.status,
        confidence: analysisResult.confidence
      });

    } catch (error) {
      logger.error('Photo re-analysis failed', {
        error: error instanceof Error ? error.message : error,
        photoId: req.body.photoId,
        childId: (req as any).childProfile?.id
      });

      res.status(500).json({
        error: 'reanalysis_failed',
        message: 'Failed to re-analyze photo'
      });
    }
  }
);

/**
 * GET /api/analysis/session/:sessionId
 *
 * Get all analyses for photos in a specific session
 */
router.get('/session/:sessionId',
  authenticateToken,
  validateFamilyAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      const { sessionId } = req.params;
      const childProfile = (req as any).childProfile;

      // Find all analyses for this session
      const sessionAnalyses = Array.from(analysisResults.values())
        .filter(analysis =>
          analysis.sessionId === sessionId &&
          analysis.childId === childProfile.id
        )
        .map(analysis => ({
          id: analysis.id,
          photoId: analysis.photoId,
          status: analysis.status,
          confidence: analysis.confidence,
          analysisTimestamp: analysis.analysisTimestamp,
          overallAssessment: analysis.feedback.overallAssessment,
          contentItemsFound: analysis.identifiedProblems.length,
          overallAccuracy: analysis.contentAnalysis.length > 0
            ? analysis.contentAnalysis.reduce((sum, s) => sum + s.accuracy, 0) / analysis.contentAnalysis.length
            : 0,
          skillsAssessed: analysis.skillAssessment.overallSkills.length
        }))
        .sort((a, b) => new Date(b.analysisTimestamp).getTime() - new Date(a.analysisTimestamp).getTime());

      // Calculate session statistics
      const sessionStats = {
        totalAnalyses: sessionAnalyses.length,
        completedAnalyses: sessionAnalyses.filter(a => a.status === 'completed').length,
        averageConfidence: sessionAnalyses.length > 0
          ? sessionAnalyses.reduce((sum, a) => sum + a.confidence, 0) / sessionAnalyses.length
          : 0,
        averageAccuracy: sessionAnalyses.length > 0
          ? sessionAnalyses.reduce((sum, a) => sum + a.overallAccuracy, 0) / sessionAnalyses.length
          : 0,
        totalContentItems: sessionAnalyses.reduce((sum, a) => sum + a.contentItemsFound, 0)
      };

      logger.info('Session analyses retrieved', {
        sessionId,
        childId: childProfile.id,
        analysisCount: sessionAnalyses.length
      });

      res.status(200).json({
        success: true,
        sessionId,
        statistics: sessionStats,
        analyses: sessionAnalyses
      });

    } catch (error) {
      logger.error('Failed to retrieve session analyses', {
        error: error instanceof Error ? error.message : error,
        sessionId: req.params.sessionId,
        childId: (req as any).childProfile?.id
      });

      res.status(500).json({
        error: 'retrieval_failed',
        message: 'Failed to retrieve session analyses'
      });
    }
  }
);

/**
 * DELETE /api/analysis/:analysisId
 *
 * Delete an analysis result
 */
router.delete('/:analysisId',
  authenticateToken,
  validateFamilyAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      const { analysisId } = req.params;
      const childProfile = (req as any).childProfile;

      // Check if analysis exists and belongs to child
      const analysisResult = analysisResults.get(analysisId);
      if (!analysisResult) {
        return res.status(404).json({
          error: 'analysis_not_found',
          message: 'Analysis not found'
        });
      }

      if (analysisResult.childId !== childProfile.id) {
        return res.status(403).json({
          error: 'access_denied',
          message: 'Cannot delete analysis belonging to another child'
        });
      }

      // Remove from storage
      analysisResults.delete(analysisId);

      // Update photo mapping
      const photoId = analysisResult.photoId;
      const analysisIds = photoAnalysisMapping.get(photoId) || [];
      const updatedIds = analysisIds.filter(id => id !== analysisId);

      if (updatedIds.length > 0) {
        photoAnalysisMapping.set(photoId, updatedIds);
      } else {
        photoAnalysisMapping.delete(photoId);

        // Update photo metadata if no analyses remain
        cameraService.updatePhotoAnalysis(photoId, {
          analysisReady: false,
          analysisId: undefined,
          analysisTimestamp: undefined,
          confidence: 0
        });
      }

      logger.info('Analysis deleted', {
        analysisId,
        photoId,
        childId: childProfile.id
      });

      res.status(200).json({
        success: true,
        message: 'Analysis deleted successfully'
      });

    } catch (error) {
      logger.error('Failed to delete analysis', {
        error: error instanceof Error ? error.message : error,
        analysisId: req.params.analysisId,
        childId: (req as any).childProfile?.id
      });

      res.status(500).json({
        error: 'deletion_failed',
        message: 'Failed to delete analysis'
      });
    }
  }
);

export default router;
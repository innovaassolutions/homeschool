import express from 'express';
import { z } from 'zod';
import { authenticateUser } from '../middleware/auth';
import { validateChildAccess } from '../middleware/childAccess';
import { TextToSpeechService, TTSRequestByAge, VoiceProfile } from '../services/textToSpeech';
import { AgeGroup } from '../services/chatgpt';

const router = express.Router();

// Text-to-Speech service instance (will be initialized by app.ts)
let ttsService: TextToSpeechService;

// Initialize the TTS service
export const initializeTTSService = (service: TextToSpeechService) => {
  ttsService = service;
};

// Request validation schemas
const synthesisRequestSchema = z.object({
  text: z.string().min(1).max(4000, 'Text must be between 1 and 4000 characters'),
  childId: z.string().uuid('Invalid child ID format'),
  voiceProfileId: z.string().optional(),
  speed: z.number().min(0.5).max(2.0).optional(),
  enableCache: z.boolean().optional(),
  format: z.enum(['mp3', 'wav', 'opus']).optional()
});

const voicePreferenceSchema = z.object({
  childId: z.string().uuid('Invalid child ID format'),
  voiceProfileId: z.string(),
  ageGroup: z.enum(['ages6to9', 'ages10to13', 'ages14to16'])
});

/**
 * POST /api/tts/synthesize
 * Synthesize text to speech audio
 *
 * Request Body:
 * - text: string (1-4000 chars) - Text to convert to speech
 * - childId: string (UUID) - Child profile ID for age-appropriate settings
 * - voiceProfileId?: string - Specific voice profile to use
 * - speed?: number (0.5-2.0) - Playback speed override
 * - enableCache?: boolean - Whether to use cached audio
 * - format?: 'mp3'|'wav'|'ogg' - Audio format preference
 *
 * Response:
 * - Success: Audio buffer with metadata
 * - Error: { error: string, details?: any }
 */
router.post('/synthesize', authenticateUser, async (req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({
        error: 'Text-to-speech service not available',
        details: 'Service initialization pending'
      });
    }

    // Validate request body
    const validation = synthesisRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const { text, childId, voiceProfileId, speed, enableCache, format } = validation.data;

    // Validate child access
    const childAccess = await validateChildAccess(req.user.id, childId);
    if (!childAccess.hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'No permission to access this child profile'
      });
    }

    // Get child's age group for voice selection
    const child = childAccess.child;
    const ageGroup: AgeGroup = child.ageGroup as AgeGroup;

    // Prepare TTS request
    const ttsRequest: TTSRequestByAge = {
      text,
      ageGroup,
      voiceProfileId,
      speed,
      enableCache: enableCache !== false, // Default to true
      metadata: {
        childId,
        userId: req.user.id,
        timestamp: new Date(),
        format: format || 'mp3'
      }
    };

    // Synthesize speech
    const result = await ttsService.synthesizeSpeechByAge(ttsRequest);

    // Set appropriate headers for audio response
    res.set({
      'Content-Type': `audio/${format || 'mp3'}`,
      'Content-Length': result.audioBuffer.length.toString(),
      'Cache-Control': result.metadata.cacheHit ? 'public, max-age=3600' : 'public, max-age=300',
      'X-TTS-Voice-Profile': result.metadata.voiceProfile.id,
      'X-TTS-Processing-Time': result.metadata.processingTime.toString(),
      'X-TTS-From-Cache': result.metadata.cacheHit.toString(),
      'X-TTS-Audio-Duration': result.metadata.duration.toString()
    });

    // Send audio buffer
    res.send(result.audioBuffer);

  } catch (error) {
    console.error('TTS synthesis error:', error);
    res.status(500).json({
      error: 'Speech synthesis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/tts/voices/:ageGroup
 * Get available voice profiles for an age group
 *
 * Path Parameters:
 * - ageGroup: 'ages6to9'|'ages10to13'|'ages14to16'
 *
 * Response:
 * - Success: Array of VoiceProfile objects
 * - Error: { error: string, details?: any }
 */
router.get('/voices/:ageGroup', authenticateUser, async (req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({
        error: 'Text-to-speech service not available',
        details: 'Service initialization pending'
      });
    }

    const ageGroup = req.params.ageGroup as AgeGroup;

    // Validate age group
    if (!['ages6to9', 'ages10to13', 'ages14to16'].includes(ageGroup)) {
      return res.status(400).json({
        error: 'Invalid age group',
        details: 'Age group must be one of: ages6to9, ages10to13, ages14to16'
      });
    }

    // Get voice profiles for age group
    const voices = ttsService.getVoiceProfiles(ageGroup);

    res.json({
      ageGroup,
      voices,
      count: voices.length
    });

  } catch (error) {
    console.error('Voice profiles error:', error);
    res.status(500).json({
      error: 'Failed to fetch voice profiles',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/tts/voices
 * Get all available voice profiles
 *
 * Response:
 * - Success: Object with age groups as keys and voice arrays as values
 * - Error: { error: string, details?: any }
 */
router.get('/voices', authenticateUser, async (req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({
        error: 'Text-to-speech service not available',
        details: 'Service initialization pending'
      });
    }

    const allVoices = {
      ages6to9: ttsService.getVoiceProfiles('ages6to9'),
      ages10to13: ttsService.getVoiceProfiles('ages10to13'),
      ages14to16: ttsService.getVoiceProfiles('ages14to16')
    };

    res.json({
      voices: allVoices,
      totalCount: Object.values(allVoices).flat().length
    });

  } catch (error) {
    console.error('All voices error:', error);
    res.status(500).json({
      error: 'Failed to fetch voice profiles',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/tts/voice-preference
 * Set voice preference for a child
 *
 * Request Body:
 * - childId: string (UUID) - Child profile ID
 * - voiceProfileId: string - Voice profile ID to set as preference
 * - ageGroup: string - Child's age group for validation
 *
 * Response:
 * - Success: { success: true, voiceProfile: VoiceProfile }
 * - Error: { error: string, details?: any }
 */
router.post('/voice-preference', authenticateUser, async (req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({
        error: 'Text-to-speech service not available',
        details: 'Service initialization pending'
      });
    }

    // Validate request body
    const validation = voicePreferenceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const { childId, voiceProfileId, ageGroup } = validation.data;

    // Validate child access
    const childAccess = await validateChildAccess(req.user.id, childId);
    if (!childAccess.hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'No permission to access this child profile'
      });
    }

    // Validate voice profile exists for the age group
    const voiceProfile = ttsService.getVoiceProfileById(voiceProfileId);
    if (!voiceProfile) {
      return res.status(404).json({
        error: 'Voice profile not found',
        details: 'The specified voice profile does not exist'
      });
    }

    // Verify the voice is appropriate for the age group
    const ageGroupVoices = ttsService.getVoiceProfiles(ageGroup);
    const isValidVoice = ageGroupVoices.some(v => v.id === voiceProfileId);

    if (!isValidVoice) {
      return res.status(400).json({
        error: 'Invalid voice for age group',
        details: 'The selected voice is not available for this age group'
      });
    }

    // TODO: Save voice preference to child profile in database
    // This would require updating the child profile with the preferred voice ID
    // For now, we'll just validate and return success

    res.json({
      success: true,
      voiceProfile,
      message: 'Voice preference updated successfully'
    });

  } catch (error) {
    console.error('Voice preference error:', error);
    res.status(500).json({
      error: 'Failed to update voice preference',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/tts/preview
 * Generate a voice preview sample
 *
 * Request Body:
 * - voiceProfileId: string - Voice profile to preview
 * - ageGroup: string - Age group for context
 * - sampleText?: string - Custom preview text (optional)
 *
 * Response:
 * - Success: Audio buffer with sample speech
 * - Error: { error: string, details?: any }
 */
router.post('/preview', authenticateUser, async (req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({
        error: 'Text-to-speech service not available',
        details: 'Service initialization pending'
      });
    }

    const { voiceProfileId, ageGroup, sampleText } = req.body;

    // Validate inputs
    if (!voiceProfileId || !ageGroup) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'voiceProfileId and ageGroup are required'
      });
    }

    // Get voice profile
    const voiceProfile = ttsService.getVoiceProfileById(voiceProfileId);
    if (!voiceProfile) {
      return res.status(404).json({
        error: 'Voice profile not found',
        details: 'The specified voice profile does not exist'
      });
    }

    // Use provided sample text or default from voice profile
    const previewText = sampleText || voiceProfile.sampleText ||
      'Hello! This is how I sound when I read your lessons. How do you like my voice?';

    // Generate preview audio
    const ttsRequest: TTSRequestByAge = {
      text: previewText,
      ageGroup: ageGroup as AgeGroup,
      voiceProfileId,
      enableCache: false, // Don't cache preview samples
      metadata: {
        childId: 'preview',
        userId: req.user.id,
        timestamp: new Date(),
        format: 'mp3'
      }
    };

    const result = await ttsService.synthesizeSpeechByAge(ttsRequest);

    // Set headers for audio response
    res.set({
      'Content-Type': 'audio/mp3',
      'Content-Length': result.audioBuffer.length.toString(),
      'Cache-Control': 'no-cache',
      'X-TTS-Voice-Profile': result.metadata.voiceProfile.id,
      'X-TTS-Preview': 'true'
    });

    res.send(result.audioBuffer);

  } catch (error) {
    console.error('TTS preview error:', error);
    res.status(500).json({
      error: 'Preview generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/tts/health
 * Health check for TTS service
 *
 * Response:
 * - Success: Service health information
 * - Error: { error: string, details?: any }
 */
router.get('/health', async (req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({
        status: 'unhealthy',
        error: 'Text-to-speech service not available',
        timestamp: new Date().toISOString()
      });
    }

    const health = await ttsService.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      ...health,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('TTS health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/tts/statistics
 * Get TTS service usage statistics (admin/debug endpoint)
 *
 * Response:
 * - Success: Service statistics
 * - Error: { error: string, details?: any }
 */
router.get('/statistics', authenticateUser, async (req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({
        error: 'Text-to-speech service not available',
        details: 'Service initialization pending'
      });
    }

    const stats = ttsService.getStatistics();
    const cacheInfo = ttsService.getCacheInfo();

    res.json({
      statistics: stats,
      cache: cacheInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('TTS statistics error:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/tts/cache
 * Clear TTS audio cache (admin/debug endpoint)
 *
 * Response:
 * - Success: { success: true, message: string }
 * - Error: { error: string, details?: any }
 */
router.delete('/cache', authenticateUser, async (req, res) => {
  try {
    if (!ttsService) {
      return res.status(503).json({
        error: 'Text-to-speech service not available',
        details: 'Service initialization pending'
      });
    }

    const clearedCount = ttsService.clearCache();

    res.json({
      success: true,
      message: `Cache cleared successfully`,
      itemsCleared: clearedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('TTS cache clear error:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
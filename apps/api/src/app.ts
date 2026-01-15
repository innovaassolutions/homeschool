import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { getDatabase } from './services/database';
// import authRoutes from './routes/auth';
// import childrenRoutes from './routes/children';
// import voiceRoutes, { initializeVoiceServices } from './routes/voice';
// import ttsRoutes, { initializeTTSService } from './routes/tts';
// import sessionsRoutes, { initializeSessionService } from './routes/sessions';
import photosRoutes, { initializePhotoServices } from './routes/photos';
import analysisRoutes from './routes/analysis';
// import { createChatGPTService } from './services/chatgpt';
// import { createTextToSpeechService, defaultTTSConfig } from './services/textToSpeech';
// import { createLearningSessionService } from './services/learningSession';
// import winston from 'winston';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    const db = getDatabase();
    const dbHealth = await db.healthCheck();

    res.json({
      status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'homeschool-api',
      database: dbHealth
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'homeschool-api',
      error: 'Database health check failed'
    });
  }
});

// API routes
app.get('/api/hello', (_req, res) => {
  res.json({
    message: 'Hello World from Homeschool API!',
    timestamp: new Date().toISOString()
  });
});

// Initialize logger
// const logger = winston.createLogger({
//   level: 'info',
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.json()
//   ),
//   transports: [new winston.transports.Console()]
// });

// Initialize services
// const chatGPTService = createChatGPTService(logger);

// TTS configuration - ensure all required fields are provided
// const ttsConfig = {
//   ...defaultTTSConfig,
//   openaiApiKey: process.env.OPENAI_API_KEY || '',
//   defaultVoice: defaultTTSConfig.defaultVoice || 'nova',
//   cacheEnabled: defaultTTSConfig.cacheEnabled ?? true,
//   maxCacheSize: defaultTTSConfig.maxCacheSize ?? 1000,
//   compressionEnabled: defaultTTSConfig.compressionEnabled ?? true,
//   maxTextLength: defaultTTSConfig.maxTextLength ?? 4000,
//   timeoutMs: defaultTTSConfig.timeoutMs ?? 30000
// };
// const ttsService = createTextToSpeechService(ttsConfig, logger);
// const sessionService = createLearningSessionService(logger);

// Initialize voice services with ChatGPT and TTS integration
// initializeVoiceServices(chatGPTService, ttsService);

// Initialize services
// initializeTTSService(ttsService);
// initializeSessionService(sessionService);
initializePhotoServices();

// API routes
// app.use('/api/auth', authRoutes);
// app.use('/api/family/child-profiles', childrenRoutes);
// app.use('/api/voice', voiceRoutes);
// app.use('/api/tts', ttsRoutes);
// app.use('/api/sessions', sessionsRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/analysis', analysisRoutes);

// Future route structure (placeholder for now)
// app.use('/api/learning', learningRoutes);
// app.use('/api/assessment', assessmentRoutes);
// app.use('/api/family', familyRoutes);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
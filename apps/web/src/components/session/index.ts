// Session management components
export { SessionManager } from './SessionManager';
export { SessionTimer } from './SessionTimer';
export { SessionControls } from './SessionControls';
export { BreakReminder } from './BreakReminder';
export { SessionComplete } from './SessionComplete';
export { SessionHistory } from './SessionHistory';

// Store exports
export { useSessionStore } from '../../stores/sessionStore';
export type {
  LearningSession,
  SessionType,
  SessionState,
  AgeGroup,
  LearningObjective,
  ProgressMarker,
  SessionTimingConfig,
  SessionStats,
  CreateSessionRequest,
  SessionApiResponse
} from '../../stores/sessionStore';
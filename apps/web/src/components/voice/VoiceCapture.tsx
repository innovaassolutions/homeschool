import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';

// Voice capture state types
type VoiceCaptureState = 'idle' | 'requesting_permission' | 'ready' | 'recording' | 'processing' | 'error';

// Voice capture mode types
type CaptureMode = 'push_to_talk' | 'continuous' | 'voice_activity';

// Audio quality indicators
interface AudioQuality {
  volume: number; // 0-1
  noise: number; // 0-1
  clarity: 'poor' | 'fair' | 'good' | 'excellent';
}

// Component props
interface VoiceCaptureProps {
  ageGroup: 'ages6to9' | 'ages10to13' | 'ages14to16';
  mode?: CaptureMode;
  maxDuration?: number; // Maximum recording duration in seconds
  onAudioCapture: (audioBlob: Blob, metadata: AudioMetadata) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: VoiceCaptureState) => void;
  onQualityUpdate?: (quality: AudioQuality) => void;
  disabled?: boolean;
  className?: string;
}

// Audio metadata interface
interface AudioMetadata {
  format: string;
  sampleRate: number;
  channels: number;
  duration: number;
  size: number;
  quality: 'low' | 'medium' | 'high';
  timestamp: Date;
}

// Voice capture component with age-adaptive UI
export const VoiceCapture: React.FC<VoiceCaptureProps> = ({
  ageGroup,
  mode = 'push_to_talk',
  maxDuration = 30,
  onAudioCapture,
  onError,
  onStateChange,
  onQualityUpdate,
  disabled = false,
  className = ''
}) => {
  // State management
  const [state, setState] = useState<VoiceCaptureState>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioQuality, setAudioQuality] = useState<AudioQuality>({
    volume: 0,
    noise: 0,
    clarity: 'good'
  });

  // Refs for media handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const qualityCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Age-adaptive UI configuration
  const ageAdaptive = useAgeAdaptive(ageGroup);

  // Update state and notify parent
  const updateState = useCallback((newState: VoiceCaptureState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Handle errors
  const handleError = useCallback((error: string) => {
    console.error('VoiceCapture error:', error);
    updateState('error');
    onError?.(error);
  }, [onError, updateState]);

  // Initialize microphone access
  const initializeMicrophone = useCallback(async () => {
    try {
      updateState('requesting_permission');

      // Request microphone access with age-appropriate constraints
      const constraints: MediaStreamConstraints = {
        audio: {
          channelCount: 1, // Mono audio
          sampleRate: 16000, // Standard for speech recognition
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Set up audio context for real-time analysis
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioContext = audioContextRef.current;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      source.connect(analyser);
      analyserRef.current = analyser;

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus', // Best quality and compression
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        handleRecordingStop();
      };

      updateState('ready');

      // Start quality monitoring if in continuous mode
      if (mode === 'continuous' || mode === 'voice_activity') {
        startQualityMonitoring();
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        handleError('Microphone permission denied. Please allow microphone access to use voice features.');
      } else if (error instanceof Error && error.name === 'NotFoundError') {
        handleError('No microphone found. Please connect a microphone to use voice features.');
      } else {
        handleError('Failed to initialize microphone. Please check your audio settings.');
      }
    }
  }, [mode, updateState, handleError]);

  // Start quality monitoring
  const startQualityMonitoring = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkQuality = () => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate volume level
      const sum = dataArray.reduce((acc, value) => acc + value, 0);
      const volume = sum / (bufferLength * 255); // Normalize to 0-1

      // Estimate noise level (simplified)
      const noiseThreshold = 0.1;
      const lowFreqSum = dataArray.slice(0, Math.floor(bufferLength * 0.3)).reduce((acc, val) => acc + val, 0);
      const noise = (lowFreqSum / (bufferLength * 0.3 * 255)) > noiseThreshold ? 0.3 : 0.1;

      // Determine clarity based on volume and noise
      let clarity: AudioQuality['clarity'] = 'good';
      if (volume < 0.1) clarity = 'poor';
      else if (volume < 0.2 || noise > 0.25) clarity = 'fair';
      else if (volume > 0.6 && noise < 0.15) clarity = 'excellent';

      const quality: AudioQuality = { volume, noise, clarity };
      setAudioQuality(quality);
      onQualityUpdate?.(quality);
    };

    qualityCheckIntervalRef.current = setInterval(checkQuality, 100); // Check every 100ms
  }, [onQualityUpdate]);

  // Stop quality monitoring
  const stopQualityMonitoring = useCallback(() => {
    if (qualityCheckIntervalRef.current) {
      clearInterval(qualityCheckIntervalRef.current);
      qualityCheckIntervalRef.current = null;
    }
  }, []);

  // Start recording
  const startRecording = useCallback(() => {
    if (!mediaRecorderRef.current || state !== 'ready') return;

    try {
      audioChunksRef.current = [];
      setRecordingTime(0);
      setIsRecording(true);
      updateState('recording');

      mediaRecorderRef.current.start(100); // Collect data every 100ms

      // Start recording timer
      const startTime = Date.now();
      recordingTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setRecordingTime(elapsed);

        // Auto-stop at max duration
        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 100);

      // Start quality monitoring during recording
      startQualityMonitoring();

    } catch (error) {
      handleError('Failed to start recording. Please try again.');
    }
  }, [state, updateState, handleError, startQualityMonitoring, maxDuration]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || state !== 'recording') return;

    try {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      updateState('processing');

      // Clear timers
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      stopQualityMonitoring();

    } catch (error) {
      handleError('Failed to stop recording. Please try again.');
    }
  }, [state, updateState, handleError, stopQualityMonitoring]);

  // Handle recording stop and create audio blob
  const handleRecordingStop = useCallback(() => {
    if (audioChunksRef.current.length === 0) {
      handleError('No audio data recorded. Please try again.');
      return;
    }

    try {
      // Create audio blob
      const audioBlob = new Blob(audioChunksRef.current, {
        type: 'audio/webm;codecs=opus'
      });

      // Create metadata
      const metadata: AudioMetadata = {
        format: 'webm',
        sampleRate: 16000, // Assumed based on our constraints
        channels: 1,
        duration: recordingTime,
        size: audioBlob.size,
        quality: audioQuality.clarity === 'excellent' ? 'high' :
                audioQuality.clarity === 'good' ? 'medium' : 'low',
        timestamp: new Date()
      };

      // Reset state
      updateState('ready');
      setRecordingTime(0);
      audioChunksRef.current = [];

      // Notify parent
      onAudioCapture(audioBlob, metadata);

    } catch (error) {
      handleError('Failed to process recording. Please try again.');
    }
  }, [recordingTime, audioQuality, updateState, handleError, onAudioCapture]);

  // Toggle recording for push-to-talk mode
  const toggleRecording = useCallback(() => {
    if (disabled) return;

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, disabled, startRecording, stopRecording]);

  // Initialize on mount
  useEffect(() => {
    initializeMicrophone();

    // Cleanup on unmount
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }

      stopQualityMonitoring();

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [initializeMicrophone, stopQualityMonitoring]);

  // Age-adaptive UI configuration
  const getUIConfig = () => {
    const baseConfig = ageAdaptive.getComponentConfig('button');

    return {
      ...baseConfig,
      colors: {
        idle: ageAdaptive.theme.colors.primary,
        ready: ageAdaptive.theme.colors.success,
        recording: '#ef4444', // Red for recording
        processing: ageAdaptive.theme.colors.warning,
        error: ageAdaptive.theme.colors.error
      },
      sizes: {
        ages6to9: { width: '120px', height: '120px', fontSize: '14px' },
        ages10to13: { width: '100px', height: '100px', fontSize: '16px' },
        ages14to16: { width: '80px', height: '80px', fontSize: '18px' }
      }
    };
  };

  const uiConfig = getUIConfig();
  const sizeConfig = uiConfig.sizes[ageGroup];

  // State-specific messages
  const getStateMessage = () => {
    const messages = {
      ages6to9: {
        idle: 'Getting ready...',
        requesting_permission: 'Asking to use your microphone...',
        ready: mode === 'push_to_talk' ? 'Press and hold to talk!' : 'Ready to listen!',
        recording: 'I\'m listening! Keep talking!',
        processing: 'Thinking about what you said...',
        error: 'Oops! Something went wrong. Let\'s try again!'
      },
      ages10to13: {
        idle: 'Initializing...',
        requesting_permission: 'Requesting microphone access...',
        ready: mode === 'push_to_talk' ? 'Hold button to record' : 'Ready to record',
        recording: `Recording... (${Math.floor(recordingTime)}s)`,
        processing: 'Processing audio...',
        error: 'Error occurred. Please try again.'
      },
      ages14to16: {
        idle: 'Initializing voice capture...',
        requesting_permission: 'Please allow microphone access',
        ready: mode === 'push_to_talk' ? 'Press to record' : 'Voice detection active',
        recording: `Recording: ${Math.floor(recordingTime)}/${maxDuration}s`,
        processing: 'Processing recording...',
        error: 'Recording failed. Check microphone settings.'
      }
    };

    return messages[ageGroup][state];
  };

  // Quality indicator component
  const QualityIndicator = () => {
    if (state !== 'recording' && state !== 'ready') return null;

    const qualityColor = {
      poor: '#ef4444',
      fair: '#f59e0b',
      good: '#10b981',
      excellent: '#3b82f6'
    }[audioQuality.clarity];

    return (
      <div className="quality-indicator" style={{ marginTop: '8px' }}>
        <div className="volume-bar" style={{
          width: '100%',
          height: '4px',
          backgroundColor: '#e5e7eb',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div
            style={{
              width: `${audioQuality.volume * 100}%`,
              height: '100%',
              backgroundColor: qualityColor,
              transition: 'width 0.1s ease'
            }}
          />
        </div>
        {ageGroup !== 'ages6to9' && (
          <div className="text-xs mt-1" style={{ color: qualityColor }}>
            Audio: {audioQuality.clarity}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`voice-capture ${className}`}>
      <div className="voice-capture-container" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: ageAdaptive.spacing.medium
      }}>

        {/* Main recording button */}
        <button
          onClick={mode === 'push_to_talk' ? toggleRecording : undefined}
          onMouseDown={mode === 'push_to_talk' ? startRecording : undefined}
          onMouseUp={mode === 'push_to_talk' ? stopRecording : undefined}
          onTouchStart={mode === 'push_to_talk' ? startRecording : undefined}
          onTouchEnd={mode === 'push_to_talk' ? stopRecording : undefined}
          disabled={disabled || state === 'processing' || state === 'requesting_permission'}
          className="voice-record-button"
          style={{
            width: sizeConfig.width,
            height: sizeConfig.height,
            borderRadius: '50%',
            border: 'none',
            backgroundColor: uiConfig.colors[state] || uiConfig.colors.idle,
            color: 'white',
            fontSize: sizeConfig.fontSize,
            fontWeight: 'bold',
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: isRecording ? '0 0 20px rgba(239, 68, 68, 0.5)' : '0 4px 8px rgba(0, 0, 0, 0.1)',
            transform: isRecording ? 'scale(1.05)' : 'scale(1)',
            transition: 'all 0.2s ease',
            ...ageAdaptive.getComponentStyle('button')
          }}
        >
          {/* Recording icon or state indicator */}
          {state === 'recording' ? '🎤' :
           state === 'processing' ? '⏳' :
           state === 'error' ? '❌' :
           state === 'ready' ? '🎙️' : '⏸️'}
        </button>

        {/* State message */}
        <div
          className="voice-state-message"
          style={{
            fontSize: ageAdaptive.typography.body.fontSize,
            color: ageAdaptive.theme.colors.text.primary,
            textAlign: 'center',
            minHeight: '1.5em'
          }}
        >
          {getStateMessage()}
        </div>

        {/* Quality indicator */}
        <QualityIndicator />

        {/* Recording controls for non-push-to-talk modes */}
        {mode !== 'push_to_talk' && state === 'ready' && (
          <div className="recording-controls" style={{
            display: 'flex',
            gap: ageAdaptive.spacing.small
          }}>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={disabled}
              style={{
                padding: `${ageAdaptive.spacing.small} ${ageAdaptive.spacing.medium}`,
                backgroundColor: isRecording ? '#ef4444' : ageAdaptive.theme.colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: ageAdaptive.borderRadius.medium,
                cursor: 'pointer',
                fontSize: ageAdaptive.typography.button.fontSize
              }}
            >
              {isRecording ? 'Stop' : 'Start'} Recording
            </button>
          </div>
        )}

        {/* Instructions for younger children */}
        {ageGroup === 'ages6to9' && state === 'ready' && (
          <div
            className="voice-instructions"
            style={{
              fontSize: ageAdaptive.typography.caption.fontSize,
              color: ageAdaptive.theme.colors.text.secondary,
              textAlign: 'center',
              maxWidth: '200px'
            }}
          >
            {mode === 'push_to_talk'
              ? "Hold the button down while you talk, then let go when you're done!"
              : "Click Start to begin talking!"}
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceCapture;
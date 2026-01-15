import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';

// Audio player state types
type AudioPlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error' | 'ended';

// Voice profile types for TTS
interface VoiceProfile {
  id: string;
  name: string;
  description: string;
  ageAppropriate: boolean;
  sampleText?: string;
}

// Audio playback controls
interface PlaybackControls {
  volume: number; // 0-1
  speed: number; // 0.5-2.0
  currentTime: number; // seconds
  duration: number; // seconds
}

// Component props
interface AudioPlayerProps {
  ageGroup: 'ages6to9' | 'ages10to13' | 'ages14to16';
  audioSrc?: string; // URL or blob URL for audio
  audioBuffer?: ArrayBuffer; // Direct audio buffer
  text?: string; // Original text being spoken
  voiceProfile?: VoiceProfile;
  availableVoices?: VoiceProfile[];
  autoPlay?: boolean;
  showTranscript?: boolean;
  onVoiceChange?: (voiceId: string) => void;
  onPlaybackComplete?: () => void;
  onError?: (error: string) => void;
  onStateChange?: (state: AudioPlayerState) => void;
  disabled?: boolean;
  className?: string;
}

// Loading states for different operations
interface LoadingStates {
  audio: boolean;
  voiceChange: boolean;
  generation: boolean;
}

/**
 * AudioPlayer Component for Text-to-Speech Playback
 *
 * Age-adaptive audio player with child-friendly controls for TTS audio.
 * Features volume control, playback speed adjustment, voice selection,
 * and visual feedback optimized for different age groups.
 */
export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  ageGroup,
  audioSrc,
  audioBuffer,
  text,
  voiceProfile,
  availableVoices = [],
  autoPlay = false,
  showTranscript = false,
  onVoiceChange,
  onPlaybackComplete,
  onError,
  onStateChange,
  disabled = false,
  className = ''
}) => {
  // Age-adaptive configuration
  const { getComponentConfig } = useAgeAdaptive();
  const config = getComponentConfig('audioPlayer', ageGroup);

  // Audio player state
  const [state, setState] = useState<AudioPlayerState>('idle');
  const [controls, setControls] = useState<PlaybackControls>({
    volume: config.defaultVolume || 0.8,
    speed: config.defaultSpeed || 1.0,
    currentTime: 0,
    duration: 0
  });
  const [loading, setLoading] = useState<LoadingStates>({
    audio: false,
    voiceChange: false,
    generation: false
  });
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLInputElement>(null);
  const speedRef = useRef<HTMLInputElement>(null);

  // Update state and notify parent
  const updateState = useCallback((newState: AudioPlayerState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Handle errors
  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    updateState('error');
    onError?.(errorMessage);
  }, [onError, updateState]);

  // Load audio source
  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;

    if (audioSrc) {
      setLoading(prev => ({ ...prev, audio: true }));
      audio.src = audioSrc;
    } else if (audioBuffer) {
      try {
        const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        setLoading(prev => ({ ...prev, audio: true }));
        audio.src = url;
      } catch (err) {
        handleError('Failed to load audio buffer');
        return;
      }
    }

    const handleLoadStart = () => {
      updateState('loading');
    };

    const handleLoadedData = () => {
      setLoading(prev => ({ ...prev, audio: false }));
      setControls(prev => ({ ...prev, duration: audio.duration }));
      updateState('idle');

      if (autoPlay && !disabled) {
        handlePlay();
      }
    };

    const handleLoadError = () => {
      setLoading(prev => ({ ...prev, audio: false }));
      handleError('Failed to load audio');
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('error', handleLoadError);

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('error', handleLoadError);
      if (audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
      }
    };
  }, [audioSrc, audioBuffer, autoPlay, disabled, handleError, updateState]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setControls(prev => ({ ...prev, currentTime: audio.currentTime }));
    };

    const handlePlay = () => {
      updateState('playing');
    };

    const handlePause = () => {
      updateState('paused');
    };

    const handleEnded = () => {
      updateState('ended');
      onPlaybackComplete?.();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [updateState, onPlaybackComplete]);

  // Playback control functions
  const handlePlay = useCallback(async () => {
    if (!audioRef.current || disabled) return;

    try {
      await audioRef.current.play();
    } catch (err) {
      handleError('Playback failed');
    }
  }, [disabled, handleError]);

  const handlePause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
  }, []);

  const handleStop = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    updateState('idle');
  }, [updateState]);

  const handleSeek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(time, controls.duration));
  }, [controls.duration]);

  const handleVolumeChange = useCallback((volume: number) => {
    if (!audioRef.current) return;
    const clampedVolume = Math.max(0, Math.min(1, volume));
    audioRef.current.volume = clampedVolume;
    setControls(prev => ({ ...prev, volume: clampedVolume }));
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    if (!audioRef.current) return;
    const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
    audioRef.current.playbackRate = clampedSpeed;
    setControls(prev => ({ ...prev, speed: clampedSpeed }));
  }, []);

  const handleVoiceSelect = useCallback((voiceId: string) => {
    if (!onVoiceChange) return;

    setLoading(prev => ({ ...prev, voiceChange: true }));
    setShowVoiceSelector(false);
    onVoiceChange(voiceId);

    // Loading state will be cleared when new audio loads
  }, [onVoiceChange]);

  // Progress bar click handler
  const handleProgressClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || controls.duration === 0) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const progressWidth = rect.width;
    const clickRatio = clickX / progressWidth;
    const newTime = clickRatio * controls.duration;

    handleSeek(newTime);
  }, [controls.duration, handleSeek]);

  // Format time display
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Age-adaptive styling
  const getAgeAdaptiveClasses = () => {
    const baseClasses = 'audio-player bg-white rounded-lg shadow-sm border border-gray-200 p-4';

    switch (ageGroup) {
      case 'ages6to9':
        return `${baseClasses} text-lg space-y-4`;
      case 'ages10to13':
        return `${baseClasses} text-base space-y-3`;
      case 'ages14to16':
        return `${baseClasses} text-sm space-y-2`;
      default:
        return `${baseClasses} text-base space-y-3`;
    }
  };

  // Get button size based on age group
  const getButtonSize = () => {
    switch (ageGroup) {
      case 'ages6to9': return 'w-12 h-12 text-xl';
      case 'ages10to13': return 'w-10 h-10 text-lg';
      case 'ages14to16': return 'w-8 h-8 text-base';
      default: return 'w-10 h-10 text-lg';
    }
  };

  return (
    <div className={`${getAgeAdaptiveClasses()} ${className}`}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        volume={controls.volume}
        playbackRate={controls.speed}
        preload="metadata"
      />

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Transcript display */}
      {showTranscript && text && (
        <div className="bg-gray-50 rounded-md p-3 mb-4">
          <p className="text-gray-700 text-sm font-medium mb-1">Speaking:</p>
          <p className="text-gray-600">{text}</p>
        </div>
      )}

      {/* Main controls */}
      <div className="flex items-center space-x-4">
        {/* Play/Pause/Stop buttons */}
        <div className="flex items-center space-x-2">
          {state === 'playing' ? (
            <button
              onClick={handlePause}
              disabled={disabled || loading.audio}
              className={`${getButtonSize()} bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-full flex items-center justify-center transition-colors`}
              aria-label="Pause audio"
            >
              <svg className="w-1/2 h-1/2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
            </button>
          ) : (
            <button
              onClick={handlePlay}
              disabled={disabled || loading.audio || !audioSrc && !audioBuffer}
              className={`${getButtonSize()} bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-full flex items-center justify-center transition-colors`}
              aria-label="Play audio"
            >
              {loading.audio ? (
                <svg className="w-1/2 h-1/2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              ) : (
                <svg className="w-1/2 h-1/2 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
          )}

          {(state === 'playing' || state === 'paused') && (
            <button
              onClick={handleStop}
              disabled={disabled}
              className={`${getButtonSize()} bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded-full flex items-center justify-center transition-colors`}
              aria-label="Stop audio"
            >
              <svg className="w-1/2 h-1/2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h12v12H6z"/>
              </svg>
            </button>
          )}
        </div>

        {/* Progress bar and time */}
        <div className="flex-1">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span className="w-12 text-right">{formatTime(controls.currentTime)}</span>
            <div
              ref={progressRef}
              className="flex-1 h-2 bg-gray-200 rounded-full cursor-pointer"
              onClick={handleProgressClick}
              role="slider"
              aria-label="Audio progress"
            >
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-100"
                style={{
                  width: controls.duration > 0 ? `${(controls.currentTime / controls.duration) * 100}%` : '0%'
                }}
              />
            </div>
            <span className="w-12">{formatTime(controls.duration)}</span>
          </div>
        </div>

        {/* Voice selector button */}
        {availableVoices.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowVoiceSelector(!showVoiceSelector)}
              disabled={disabled || loading.voiceChange}
              className={`${getButtonSize()} bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 rounded-full flex items-center justify-center transition-colors`}
              aria-label="Select voice"
            >
              {loading.voiceChange ? (
                <svg className="w-1/2 h-1/2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              ) : (
                <svg className="w-1/2 h-1/2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2a10 10 0 0110 10 10 10 0 01-10 10A10 10 0 012 12 10 10 0 0112 2zm0 18a8 8 0 100-16 8 8 0 000 16zm-1-13h2v6h-2V7zm0 8h2v2h-2v-2z"/>
                </svg>
              )}
            </button>

            {/* Voice selector dropdown */}
            {showVoiceSelector && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                <div className="p-3">
                  <h3 className="font-medium text-gray-900 mb-2">Choose Voice</h3>
                  <div className="space-y-2">
                    {availableVoices.map((voice) => (
                      <button
                        key={voice.id}
                        onClick={() => handleVoiceSelect(voice.id)}
                        className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                          voiceProfile?.id === voice.id
                            ? 'bg-blue-100 text-blue-700'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <div className="font-medium">{voice.name}</div>
                        {voice.description && (
                          <div className="text-xs text-gray-500 mt-1">{voice.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Advanced controls (for older age groups) */}
      {ageGroup !== 'ages6to9' && (
        <div className="flex items-center space-x-6 pt-2 border-t border-gray-100">
          {/* Volume control */}
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
            <input
              ref={volumeRef}
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={controls.volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              disabled={disabled}
              className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              aria-label="Volume"
            />
            <span className="text-xs text-gray-500 w-8 text-right">
              {Math.round(controls.volume * 100)}%
            </span>
          </div>

          {/* Speed control */}
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 8V2H9v6H2l7 7 7-7h-3zM7 19h10v2H7z"/>
            </svg>
            <input
              ref={speedRef}
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={controls.speed}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              disabled={disabled}
              className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              aria-label="Playback speed"
            />
            <span className="text-xs text-gray-500 w-8 text-right">
              {controls.speed}×
            </span>
          </div>

          {/* Audio state indicator */}
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${
              state === 'playing' ? 'bg-green-500' :
              state === 'loading' ? 'bg-yellow-500' :
              state === 'error' ? 'bg-red-500' :
              'bg-gray-300'
            }`} />
            <span className="text-xs text-gray-500 capitalize">{state}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;
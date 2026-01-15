import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';

// Camera capture state types
type CameraCaptureState = 'idle' | 'requesting_permission' | 'ready' | 'capturing' | 'processing' | 'uploading' | 'completed' | 'error';

// Camera device types
type CameraType = 'builtin' | 'external' | 'bluetooth';
type PhotoFormat = 'jpeg' | 'png' | 'webp';
type PhotoQuality = 'low' | 'medium' | 'high' | 'ultra';
type AgeGroup = 'ages6to9' | 'ages10to13' | 'ages14to16';

// Photo metadata interface
interface PhotoMetadata {
  id: string;
  filename: string;
  format: PhotoFormat;
  size: number;
  width: number;
  height: number;
  quality: PhotoQuality;
  qualityScore: number;
  readabilityScore: number;
  analysisReady: boolean;
  timestamp: Date;
  sessionId?: string;
}

// Component props
interface CameraCaptureProps {
  ageGroup: AgeGroup;
  sessionId?: string;
  onPhotoCapture: (photo: PhotoMetadata, imageBlob: Blob) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: CameraCaptureState) => void;
  maxPhotos?: number;
  autoProcess?: boolean;
  disabled?: boolean;
  className?: string;
}

// Camera constraints for different age groups
const getCameraConstraints = (ageGroup: AgeGroup): MediaStreamConstraints => {
  const baseConstraints = {
    video: {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      facingMode: 'environment', // Prefer back camera for document capture
      frameRate: { ideal: 30 }
    },
    audio: false
  };

  // Age-specific optimizations
  switch (ageGroup) {
    case 'ages6to9':
      return {
        video: {
          ...baseConstraints.video,
          width: { ideal: 800, max: 1280 },
          height: { ideal: 600, max: 720 }
        },
        audio: false
      };
    case 'ages10to13':
      return baseConstraints;
    case 'ages14to16':
      return {
        video: {
          ...baseConstraints.video,
          width: { ideal: 1920, max: 2560 },
          height: { ideal: 1080, max: 1440 }
        },
        audio: false
      };
    default:
      return baseConstraints;
  }
};

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  ageGroup,
  sessionId,
  onPhotoCapture,
  onError,
  onStateChange,
  maxPhotos = 5,
  autoProcess = true,
  disabled = false,
  className = ''
}) => {
  // State management
  const [state, setState] = useState<CameraCaptureState>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<PhotoMetadata[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Age-adaptive configuration
  const { getAgeAdaptiveStyles, getAgeAdaptiveText } = useAgeAdaptive();
  const styles = getAgeAdaptiveStyles(ageGroup);
  const text = getAgeAdaptiveText(ageGroup);

  // Update state and notify parent
  const updateState = useCallback((newState: CameraCaptureState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Handle errors
  const handleError = useCallback((error: string) => {
    console.error('CameraCapture error:', error);
    updateState('error');
    onError?.(error);
  }, [onError, updateState]);

  // Initialize camera
  const initializeCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      handleError('Camera not supported in this browser');
      return;
    }

    try {
      updateState('requesting_permission');

      const constraints = getCameraConstraints(ageGroup);
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      updateState('ready');
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          handleError('Camera permission denied. Please allow camera access to take photos.');
        } else if (error.name === 'NotFoundError') {
          handleError('No camera found. Please connect a camera and try again.');
        } else {
          handleError(`Camera access failed: ${error.message}`);
        }
      } else {
        handleError('Unknown camera error occurred');
      }
    }
  }, [ageGroup, handleError, updateState]);

  // Capture photo
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || state !== 'ready') {
      return;
    }

    try {
      updateState('capturing');

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Canvas context not available');
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create image blob'));
          }
        }, 'image/jpeg', 0.85);
      });

      // Create preview URL
      const previewUrl = URL.createObjectURL(blob);
      setPreviewImage(previewUrl);
      setShowPreview(true);

      // Store blob for upload if user approves
      (canvas as any).capturedBlob = blob;

      updateState('processing');
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Photo capture failed');
    }
  }, [state, updateState, handleError]);

  // Upload photo
  const uploadPhoto = useCallback(async (blob: Blob, filename: string) => {
    try {
      updateState('uploading');
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('photo', blob, filename);
      formData.append('ageGroup', ageGroup);
      formData.append('autoProcess', autoProcess.toString());
      if (sessionId) {
        formData.append('sessionId', sessionId);
      }

      const response = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Upload failed`);
      }

      const result = await response.json();
      const photoMetadata: PhotoMetadata = result.photo;

      // Add to captured photos
      setCapturedPhotos(prev => [...prev, photoMetadata]);

      // Notify parent
      onPhotoCapture(photoMetadata, blob);

      updateState('completed');
      setUploadProgress(100);

      // Reset for next photo
      setTimeout(() => {
        setShowPreview(false);
        setPreviewImage(null);
        updateState('ready');
      }, 2000);

    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Photo upload failed');
    }
  }, [ageGroup, sessionId, autoProcess, onPhotoCapture, updateState, handleError]);

  // Confirm photo and upload
  const confirmPhoto = useCallback(async () => {
    const canvas = canvasRef.current;
    const blob = (canvas as any)?.capturedBlob;

    if (!blob) {
      handleError('No photo data to upload');
      return;
    }

    const filename = `photo_${Date.now()}.jpg`;
    await uploadPhoto(blob, filename);
  }, [uploadPhoto, handleError]);

  // Retake photo
  const retakePhoto = useCallback(() => {
    setShowPreview(false);
    setPreviewImage(null);
    updateState('ready');

    // Clean up preview URL
    if (previewImage) {
      URL.revokeObjectURL(previewImage);
    }
  }, [previewImage, updateState]);

  // Handle file input (fallback for devices without camera)
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      handleError('Please select a JPEG, PNG, or WebP image file');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      handleError('File size must be less than 10MB');
      return;
    }

    try {
      await uploadPhoto(file, file.name);
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'File upload failed');
    }
  }, [uploadPhoto, handleError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (previewImage) {
        URL.revokeObjectURL(previewImage);
      }
    };
  }, [stream, previewImage]);

  // Age-adaptive button sizing and layout
  const buttonBaseClass = `
    transition-all duration-200 font-medium rounded-lg
    ${text.simple ? 'text-lg py-4 px-6' : 'text-base py-3 px-4'}
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
  `;

  const primaryButtonClass = `
    ${buttonBaseClass} ${styles.button.primary}
    ${text.simple ? 'shadow-lg' : ''}
  `;

  const secondaryButtonClass = `
    ${buttonBaseClass} ${styles.button.secondary}
  `;

  const canTakeMorePhotos = capturedPhotos.length < maxPhotos;

  return (
    <div className={`camera-capture ${className}`}>
      <div className={`
        bg-white rounded-lg border border-gray-200 p-6
        ${styles.spacing.comfortable}
      `}>
        {/* Header */}
        <div className="mb-6">
          <h2 className={`${styles.text.heading} mb-2`}>
            {text.simple ? '📸 Take a Photo' : '📸 Capture Your Work'}
          </h2>
          <p className={`${styles.text.body} text-gray-600`}>
            {text.simple
              ? 'Take a picture of your work so I can help you!'
              : 'Take a clear photo of your written work for AI analysis and feedback.'
            }
          </p>
          {capturedPhotos.length > 0 && (
            <p className={`${styles.text.small} text-blue-600 mt-2`}>
              {capturedPhotos.length} of {maxPhotos} photos captured
            </p>
          )}
        </div>

        {/* Camera preview or initial state */}
        {state === 'idle' && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📷</div>
            <button
              onClick={initializeCamera}
              disabled={disabled || !canTakeMorePhotos}
              className={primaryButtonClass}
            >
              {text.simple ? '📸 Start Camera' : '📸 Open Camera'}
            </button>

            {/* File upload fallback */}
            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                disabled={disabled || !canTakeMorePhotos}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || !canTakeMorePhotos}
                className={`${secondaryButtonClass} ml-3`}
              >
                {text.simple ? '📁 Pick Photo' : '📁 Choose File'}
              </button>
            </div>
          </div>
        )}

        {/* Camera permission request */}
        {state === 'requesting_permission' && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🔐</div>
            <h3 className={`${styles.text.subheading} mb-2`}>
              {text.simple ? 'Camera Permission' : 'Camera Access Required'}
            </h3>
            <p className={`${styles.text.body} text-gray-600`}>
              {text.simple
                ? 'Please allow camera access to take photos'
                : 'Allow camera access in your browser to capture photos'
              }
            </p>
          </div>
        )}

        {/* Camera preview */}
        {(state === 'ready' || state === 'capturing') && !showPreview && (
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-auto"
                style={{ maxHeight: '400px' }}
              />
              {state === 'capturing' && (
                <div className="absolute inset-0 bg-white bg-opacity-30 flex items-center justify-center">
                  <div className="text-white text-2xl font-bold">📸</div>
                </div>
              )}
            </div>

            {/* Camera controls */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={capturePhoto}
                disabled={state !== 'ready' || !canTakeMorePhotos}
                className={`
                  ${primaryButtonClass}
                  ${text.simple ? 'w-20 h-20 rounded-full text-2xl' : 'px-8'}
                `}
              >
                {text.simple ? '📸' : '📸 Capture'}
              </button>
            </div>

            {/* Guidance for younger kids */}
            {text.simple && (
              <div className={`
                bg-blue-50 rounded-lg p-4 text-center
                ${styles.text.body} text-blue-800
              `}>
                💡 Hold your camera steady and make sure your work is clearly visible!
              </div>
            )}
          </div>
        )}

        {/* Photo preview */}
        {showPreview && previewImage && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className={`${styles.text.subheading} mb-4`}>
                {text.simple ? 'How does this look?' : 'Review Your Photo'}
              </h3>
              <img
                src={previewImage}
                alt="Photo preview"
                className="max-w-full h-auto rounded-lg border border-gray-300"
                style={{ maxHeight: '400px' }}
              />
            </div>

            {/* Preview controls */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={retakePhoto}
                disabled={state === 'uploading'}
                className={secondaryButtonClass}
              >
                {text.simple ? '🔄 Try Again' : '🔄 Retake'}
              </button>
              <button
                onClick={confirmPhoto}
                disabled={state === 'uploading'}
                className={primaryButtonClass}
              >
                {state === 'uploading'
                  ? (text.simple ? '📤 Sending...' : '📤 Uploading...')
                  : (text.simple ? '✅ Looks Good!' : '✅ Use This Photo')
                }
              </button>
            </div>

            {/* Upload progress */}
            {state === 'uploading' && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className={`${styles.text.small} text-gray-600`}>
                    {text.simple ? 'Sending photo...' : 'Uploading photo...'}
                  </span>
                  <span className={`${styles.text.small} text-gray-600`}>
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Success state */}
        {state === 'completed' && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">✅</div>
            <h3 className={`${styles.text.subheading} mb-2 text-green-600`}>
              {text.simple ? 'Photo Saved!' : 'Photo Uploaded Successfully!'}
            </h3>
            <p className={`${styles.text.body} text-gray-600`}>
              {text.simple
                ? 'Great job! I can see your work now.'
                : 'Your photo has been processed and is ready for analysis.'
              }
            </p>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">❌</div>
            <h3 className={`${styles.text.subheading} mb-2 text-red-600`}>
              {text.simple ? 'Oops!' : 'Camera Error'}
            </h3>
            <p className={`${styles.text.body} text-gray-600 mb-4`}>
              {text.simple
                ? 'Something went wrong. Let\'s try again!'
                : 'There was a problem with the camera. Please try again.'
              }
            </p>
            <button
              onClick={() => {
                updateState('idle');
                if (stream) {
                  stream.getTracks().forEach(track => track.stop());
                  setStream(null);
                }
              }}
              className={primaryButtonClass}
            >
              {text.simple ? '🔄 Try Again' : '🔄 Try Again'}
            </button>
          </div>
        )}

        {/* Hidden canvas for photo capture */}
        <canvas
          ref={canvasRef}
          className="hidden"
        />
      </div>
    </div>
  );
};
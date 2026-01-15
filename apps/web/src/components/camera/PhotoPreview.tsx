import React, { useState, useCallback } from 'react';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';

// Types from camera service
type AgeGroup = 'ages6to9' | 'ages10to13' | 'ages14to16';
type PhotoFormat = 'jpeg' | 'png' | 'webp';

interface PhotoMetadata {
  id: string;
  filename: string;
  format: PhotoFormat;
  size: number;
  width: number;
  height: number;
  qualityScore: number;
  readabilityScore: number;
  analysisReady: boolean;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  timestamp: Date;
  sessionId?: string;
  textDetected: boolean;
  mathContentDetected: boolean;
}

interface PhotoPreviewProps {
  ageGroup: AgeGroup;
  photo: PhotoMetadata;
  imageUrl?: string;
  onRetake?: () => void;
  onConfirm?: (photo: PhotoMetadata) => void;
  onDelete?: (photoId: string) => void;
  showAnalysisInfo?: boolean;
  readonly?: boolean;
  className?: string;
}

export const PhotoPreview: React.FC<PhotoPreviewProps> = ({
  ageGroup,
  photo,
  imageUrl,
  onRetake,
  onConfirm,
  onDelete,
  showAnalysisInfo = true,
  readonly = false,
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { getAgeAdaptiveStyles, getAgeAdaptiveText } = useAgeAdaptive();
  const styles = getAgeAdaptiveStyles(ageGroup);
  const text = getAgeAdaptiveText(ageGroup);

  // Handle confirm photo
  const handleConfirm = useCallback(async () => {
    if (!onConfirm || isLoading) return;

    setIsLoading(true);
    try {
      await onConfirm(photo);
    } finally {
      setIsLoading(false);
    }
  }, [onConfirm, photo, isLoading]);

  // Handle delete photo
  const handleDelete = useCallback(async () => {
    if (!onDelete || isLoading) return;

    setIsLoading(true);
    try {
      await onDelete(photo.id);
      setShowDeleteConfirm(false);
    } finally {
      setIsLoading(false);
    }
  }, [onDelete, photo.id, isLoading]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format timestamp
  const formatTimestamp = (timestamp: Date): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return text.simple ? 'Just now' : 'Just now';
    if (diffMinutes < 60) return text.simple ? `${diffMinutes}m ago` : `${diffMinutes} minutes ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return text.simple ? `${diffHours}h ago` : `${diffHours} hours ago`;

    return date.toLocaleDateString();
  };

  // Get quality indicator
  const getQualityIndicator = (score: number) => {
    if (score >= 0.8) return { emoji: '✅', label: text.simple ? 'Great!' : 'Excellent', color: 'text-green-600' };
    if (score >= 0.6) return { emoji: '👍', label: text.simple ? 'Good' : 'Good', color: 'text-blue-600' };
    if (score >= 0.4) return { emoji: '⚠️', label: text.simple ? 'OK' : 'Fair', color: 'text-yellow-600' };
    return { emoji: '❌', label: text.simple ? 'Try again' : 'Poor', color: 'text-red-600' };
  };

  // Get analysis status
  const getAnalysisStatus = () => {
    if (photo.processingStatus === 'processing') {
      return { emoji: '⏳', label: text.simple ? 'Processing...' : 'Processing...', color: 'text-blue-600' };
    }
    if (photo.processingStatus === 'failed') {
      return { emoji: '❌', label: text.simple ? 'Failed' : 'Processing failed', color: 'text-red-600' };
    }
    if (photo.analysisReady) {
      return { emoji: '🔍', label: text.simple ? 'Ready!' : 'Ready for analysis', color: 'text-green-600' };
    }
    return { emoji: '📝', label: text.simple ? 'Needs work' : 'Quality too low', color: 'text-yellow-600' };
  };

  const qualityIndicator = getQualityIndicator(photo.qualityScore);
  const analysisStatus = getAnalysisStatus();

  // Age-adaptive button styling
  const buttonBaseClass = `
    transition-all duration-200 font-medium rounded-lg
    ${text.simple ? 'text-lg py-3 px-5' : 'text-base py-2 px-4'}
    ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
  `;

  const primaryButtonClass = `${buttonBaseClass} ${styles.button.primary}`;
  const secondaryButtonClass = `${buttonBaseClass} ${styles.button.secondary}`;
  const dangerButtonClass = `${buttonBaseClass} bg-red-500 text-white hover:bg-red-600`;

  return (
    <div className={`photo-preview ${className}`}>
      <div className={`
        bg-white rounded-lg border border-gray-200 overflow-hidden
        ${styles.spacing.comfortable}
      `}>
        {/* Photo display */}
        <div className="relative">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Photo: ${photo.filename}`}
              className="w-full h-auto max-h-96 object-contain bg-gray-50"
            />
          ) : (
            <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-2">📷</div>
                <p className={styles.text.body}>
                  {text.simple ? 'Photo not available' : 'Image not available'}
                </p>
              </div>
            </div>
          )}

          {/* Processing overlay */}
          {photo.processingStatus === 'processing' && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="text-white text-center">
                <div className="animate-spin text-3xl mb-2">⚙️</div>
                <p className={styles.text.body}>
                  {text.simple ? 'Processing...' : 'Processing image...'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Photo information */}
        <div className="p-4 space-y-4">
          {/* Basic info */}
          <div>
            <h3 className={`${styles.text.subheading} mb-2`}>
              {text.simple ? '📸 Photo Info' : photo.filename}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className={`${styles.text.small} text-gray-500`}>
                  {text.simple ? 'Size:' : 'File size:'}
                </span>
                <p className={`${styles.text.body}`}>
                  {formatFileSize(photo.size)}
                </p>
              </div>

              <div>
                <span className={`${styles.text.small} text-gray-500`}>
                  {text.simple ? 'When:' : 'Captured:'}
                </span>
                <p className={`${styles.text.body}`}>
                  {formatTimestamp(photo.timestamp)}
                </p>
              </div>
            </div>
          </div>

          {/* Quality and analysis info */}
          {showAnalysisInfo && (
            <div className="space-y-3">
              {/* Quality score */}
              <div className="flex items-center justify-between">
                <span className={`${styles.text.body} text-gray-700`}>
                  {text.simple ? 'Photo Quality:' : 'Image Quality:'}
                </span>
                <div className={`flex items-center ${qualityIndicator.color}`}>
                  <span className="mr-1">{qualityIndicator.emoji}</span>
                  <span className={`${styles.text.body} font-medium`}>
                    {qualityIndicator.label}
                  </span>
                  {!text.simple && (
                    <span className={`${styles.text.small} ml-2 text-gray-500`}>
                      ({Math.round(photo.qualityScore * 100)}%)
                    </span>
                  )}
                </div>
              </div>

              {/* Readability score */}
              {photo.readabilityScore > 0 && (
                <div className="flex items-center justify-between">
                  <span className={`${styles.text.body} text-gray-700`}>
                    {text.simple ? 'Can I read it?' : 'Text Readability:'}
                  </span>
                  <div className={`flex items-center ${
                    photo.readabilityScore >= 0.7 ? 'text-green-600' :
                    photo.readabilityScore >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    <span className="mr-1">
                      {photo.readabilityScore >= 0.7 ? '✅' :
                       photo.readabilityScore >= 0.5 ? '⚠️' : '❌'}
                    </span>
                    <span className={`${styles.text.body} font-medium`}>
                      {photo.readabilityScore >= 0.7 ? (text.simple ? 'Yes!' : 'Good') :
                       photo.readabilityScore >= 0.5 ? (text.simple ? 'Maybe' : 'Fair') :
                       (text.simple ? 'Hard to read' : 'Poor')}
                    </span>
                  </div>
                </div>
              )}

              {/* Analysis readiness */}
              <div className="flex items-center justify-between">
                <span className={`${styles.text.body} text-gray-700`}>
                  {text.simple ? 'Ready for help?' : 'Analysis Status:'}
                </span>
                <div className={`flex items-center ${analysisStatus.color}`}>
                  <span className="mr-1">{analysisStatus.emoji}</span>
                  <span className={`${styles.text.body} font-medium`}>
                    {analysisStatus.label}
                  </span>
                </div>
              </div>

              {/* Content detection */}
              {(photo.textDetected || photo.mathContentDetected) && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className={`${styles.text.small} text-blue-800 font-medium mb-1`}>
                    {text.simple ? 'I found:' : 'Content detected:'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {photo.textDetected && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                        📝 {text.simple ? 'Writing' : 'Text'}
                      </span>
                    )}
                    {photo.mathContentDetected && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                        🔢 {text.simple ? 'Numbers' : 'Math'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          {!readonly && (
            <div className="flex gap-3 pt-2">
              {onRetake && (
                <button
                  onClick={onRetake}
                  disabled={isLoading}
                  className={secondaryButtonClass}
                >
                  {text.simple ? '🔄 New Photo' : '🔄 Retake'}
                </button>
              )}

              {onConfirm && !photo.analysisReady && (
                <button
                  onClick={handleConfirm}
                  disabled={isLoading}
                  className={primaryButtonClass}
                >
                  {isLoading
                    ? (text.simple ? '⏳ Saving...' : '⏳ Processing...')
                    : (text.simple ? '✅ Use Anyway' : '✅ Use This Photo')
                  }
                </button>
              )}

              {onConfirm && photo.analysisReady && (
                <button
                  onClick={handleConfirm}
                  disabled={isLoading}
                  className={primaryButtonClass}
                >
                  {isLoading
                    ? (text.simple ? '⏳ Saving...' : '⏳ Processing...')
                    : (text.simple ? '🚀 Let\'s Go!' : '🚀 Start Analysis')
                  }
                </button>
              )}

              {onDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isLoading}
                  className={`${buttonBaseClass} bg-gray-200 text-gray-700 hover:bg-gray-300`}
                >
                  {text.simple ? '🗑️ Delete' : '🗑️ Delete'}
                </button>
              )}
            </div>
          )}

          {/* Suggestions for improvement */}
          {!photo.analysisReady && !readonly && (
            <div className="bg-yellow-50 rounded-lg p-3 mt-4">
              <p className={`${styles.text.small} text-yellow-800 font-medium mb-2`}>
                {text.simple ? '💡 Tips for better photos:' : '💡 Suggestions for improvement:'}
              </p>
              <ul className={`${styles.text.small} text-yellow-700 space-y-1`}>
                {photo.qualityScore < 0.6 && (
                  <li>• {text.simple ? 'Take photo in brighter light' : 'Improve lighting conditions'}</li>
                )}
                {photo.readabilityScore < 0.7 && (
                  <li>• {text.simple ? 'Make sure writing is clear and big' : 'Ensure text is clearly visible'}</li>
                )}
                <li>• {text.simple ? 'Hold camera steady' : 'Keep camera steady when capturing'}</li>
              </ul>
            </div>
          )}
        </div>

        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`
              bg-white rounded-lg p-6 max-w-md mx-4
              ${styles.spacing.comfortable}
            `}>
              <h3 className={`${styles.text.heading} mb-4`}>
                {text.simple ? 'Delete this photo?' : 'Confirm Delete'}
              </h3>
              <p className={`${styles.text.body} text-gray-600 mb-6`}>
                {text.simple
                  ? 'Are you sure you want to delete this photo? You can\'t get it back.'
                  : 'Are you sure you want to delete this photo? This action cannot be undone.'
                }
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className={dangerButtonClass}
                >
                  {isLoading ? '⏳ Deleting...' : (text.simple ? '🗑️ Yes, delete' : '🗑️ Delete Photo')}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isLoading}
                  className={secondaryButtonClass}
                >
                  {text.simple ? 'Keep it' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
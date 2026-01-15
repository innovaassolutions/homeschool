import React, { useState, useEffect, useCallback } from 'react';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';

// Types from camera service
type AgeGroup = 'ages6to9' | 'ages10to13' | 'ages14to16';
type PhotoFormat = 'jpeg' | 'png' | 'webp';

interface PhotoMetadata {
  id: string;
  filename: string;
  format: PhotoFormat;
  size: number;
  qualityScore: number;
  analysisReady: boolean;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  timestamp: Date;
  textDetected: boolean;
  mathContentDetected: boolean;
}

interface PhotoGalleryProps {
  ageGroup: AgeGroup;
  sessionId?: string;
  photos?: PhotoMetadata[];
  onPhotoSelect?: (photo: PhotoMetadata) => void;
  onPhotoDelete?: (photoId: string) => void;
  showAnalysisInfo?: boolean;
  maxPhotosToShow?: number;
  className?: string;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  ageGroup,
  sessionId,
  photos: propPhotos,
  onPhotoSelect,
  onPhotoDelete,
  showAnalysisInfo = true,
  maxPhotosToShow,
  className = ''
}) => {
  const [photos, setPhotos] = useState<PhotoMetadata[]>(propPhotos || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const { getAgeAdaptiveStyles, getAgeAdaptiveText } = useAgeAdaptive();
  const styles = getAgeAdaptiveStyles(ageGroup);
  const text = getAgeAdaptiveText(ageGroup);

  // Fetch photos for session if sessionId provided and no photos prop
  const fetchSessionPhotos = useCallback(async () => {
    if (!sessionId || propPhotos) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/photos/session/${sessionId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch photos: ${response.status}`);
      }

      const data = await response.json();
      setPhotos(data.photos || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load photos');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, propPhotos]);

  // Load photos on mount
  useEffect(() => {
    fetchSessionPhotos();
  }, [fetchSessionPhotos]);

  // Update photos when prop changes
  useEffect(() => {
    if (propPhotos) {
      setPhotos(propPhotos);
    }
  }, [propPhotos]);

  // Handle photo selection
  const handlePhotoSelect = useCallback((photo: PhotoMetadata) => {
    setSelectedPhoto(photo.id);
    onPhotoSelect?.(photo);
  }, [onPhotoSelect]);

  // Handle photo deletion
  const handlePhotoDelete = useCallback(async (photoId: string) => {
    if (!onPhotoDelete) return;

    try {
      await onPhotoDelete(photoId);

      // Remove from local state
      setPhotos(prev => prev.filter(p => p.id !== photoId));

      // Clear selection if deleted photo was selected
      if (selectedPhoto === photoId) {
        setSelectedPhoto(null);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete photo');
    }
  }, [onPhotoDelete, selectedPhoto]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // Format timestamp
  const formatTimestamp = (timestamp: Date): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return text.simple ? 'Now' : 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Get status indicator
  const getStatusIndicator = (photo: PhotoMetadata) => {
    if (photo.processingStatus === 'processing') {
      return { emoji: '⏳', color: 'text-blue-600', bg: 'bg-blue-50' };
    }
    if (photo.processingStatus === 'failed') {
      return { emoji: '❌', color: 'text-red-600', bg: 'bg-red-50' };
    }
    if (photo.analysisReady) {
      return { emoji: '✅', color: 'text-green-600', bg: 'bg-green-50' };
    }
    return { emoji: '⚠️', color: 'text-yellow-600', bg: 'bg-yellow-50' };
  };

  // Limit photos if specified
  const displayPhotos = maxPhotosToShow
    ? photos.slice(0, maxPhotosToShow)
    : photos;

  if (isLoading) {
    return (
      <div className={`photo-gallery ${className}`}>
        <div className="text-center py-8">
          <div className="animate-spin text-4xl mb-4">📷</div>
          <p className={`${styles.text.body} text-gray-500`}>
            {text.simple ? 'Loading photos...' : 'Loading your photos...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`photo-gallery ${className}`}>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">❌</div>
          <p className={`${styles.text.body} text-red-600 mb-4`}>
            {text.simple ? 'Could not load photos' : error}
          </p>
          <button
            onClick={fetchSessionPhotos}
            className={`${styles.button.secondary} ${styles.text.body} py-2 px-4 rounded-lg`}
          >
            {text.simple ? 'Try again' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  if (displayPhotos.length === 0) {
    return (
      <div className={`photo-gallery ${className}`}>
        <div className={`
          bg-white rounded-lg border border-gray-200 p-6 text-center
          ${styles.spacing.comfortable}
        `}>
          <div className="text-6xl mb-4">📸</div>
          <h3 className={`${styles.text.subheading} mb-2`}>
            {text.simple ? 'No photos yet!' : 'No photos found'}
          </h3>
          <p className={`${styles.text.body} text-gray-600`}>
            {text.simple
              ? 'Take your first photo to see it here!'
              : 'Photos you capture will appear here for review and analysis.'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`photo-gallery ${className}`}>
      <div className={`
        bg-white rounded-lg border border-gray-200 p-4
        ${styles.spacing.comfortable}
      `}>
        {/* Header */}
        <div className="mb-4">
          <h3 className={`${styles.text.subheading} mb-2`}>
            {text.simple ? '📸 Your Photos' : '📸 Captured Photos'}
          </h3>
          <p className={`${styles.text.small} text-gray-500`}>
            {displayPhotos.length === 1
              ? (text.simple ? '1 photo' : '1 photo captured')
              : (text.simple ? `${displayPhotos.length} photos` : `${displayPhotos.length} photos captured`)
            }
            {maxPhotosToShow && photos.length > maxPhotosToShow && (
              <span className="ml-2">
                ({photos.length - maxPhotosToShow} more)
              </span>
            )}
          </p>
        </div>

        {/* Photo grid */}
        <div className={`
          grid gap-4
          ${text.simple ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}
        `}>
          {displayPhotos.map((photo) => {
            const statusIndicator = getStatusIndicator(photo);
            const isSelected = selectedPhoto === photo.id;

            return (
              <div
                key={photo.id}
                className={`
                  relative group cursor-pointer rounded-lg border transition-all duration-200
                  ${isSelected
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }
                `}
                onClick={() => handlePhotoSelect(photo)}
              >
                {/* Photo placeholder/thumbnail */}
                <div className="aspect-video bg-gray-100 rounded-t-lg flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <div className="text-3xl mb-1">📷</div>
                    <p className={`${styles.text.small}`}>
                      {photo.format.toUpperCase()}
                    </p>
                  </div>
                </div>

                {/* Status indicator overlay */}
                <div className={`
                  absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-sm
                  ${statusIndicator.bg} ${statusIndicator.color}
                `}>
                  {statusIndicator.emoji}
                </div>

                {/* Photo info */}
                <div className="p-3 space-y-2">
                  {/* Filename and timestamp */}
                  <div>
                    <p className={`${styles.text.body} font-medium truncate`}>
                      {text.simple ? `Photo ${displayPhotos.indexOf(photo) + 1}` : photo.filename}
                    </p>
                    <p className={`${styles.text.small} text-gray-500`}>
                      {formatTimestamp(photo.timestamp)}
                    </p>
                  </div>

                  {/* Quality and size info */}
                  <div className="flex items-center justify-between">
                    <span className={`${styles.text.small} text-gray-500`}>
                      {formatFileSize(photo.size)}
                    </span>
                    {showAnalysisInfo && (
                      <div className="flex items-center space-x-1">
                        {photo.qualityScore >= 0.7 ? (
                          <span className="text-green-600 text-xs">✅</span>
                        ) : photo.qualityScore >= 0.5 ? (
                          <span className="text-yellow-600 text-xs">⚠️</span>
                        ) : (
                          <span className="text-red-600 text-xs">❌</span>
                        )}
                        {!text.simple && (
                          <span className={`${styles.text.small} text-gray-500`}>
                            {Math.round(photo.qualityScore * 100)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Content indicators */}
                  {showAnalysisInfo && (photo.textDetected || photo.mathContentDetected) && (
                    <div className="flex space-x-1">
                      {photo.textDetected && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                          📝 {text.simple ? 'Text' : 'Text'}
                        </span>
                      )}
                      {photo.mathContentDetected && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                          🔢 {text.simple ? 'Math' : 'Math'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Analysis status */}
                  {showAnalysisInfo && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className={`flex items-center ${statusIndicator.color}`}>
                        <span className="mr-1">{statusIndicator.emoji}</span>
                        <span className={`${styles.text.small} font-medium`}>
                          {photo.processingStatus === 'processing' ? (text.simple ? 'Processing...' : 'Processing...') :
                           photo.processingStatus === 'failed' ? (text.simple ? 'Failed' : 'Failed') :
                           photo.analysisReady ? (text.simple ? 'Ready!' : 'Ready for analysis') :
                           (text.simple ? 'Needs work' : 'Quality too low')
                          }
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Delete button (appears on hover for older kids) */}
                {onPhotoDelete && !text.simple && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePhotoDelete(photo.id);
                    }}
                    className="
                      absolute top-2 left-2 w-6 h-6 bg-red-500 text-white rounded-full
                      opacity-0 group-hover:opacity-100 transition-opacity duration-200
                      flex items-center justify-center text-xs hover:bg-red-600
                    "
                    title="Delete photo"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Show more button */}
        {maxPhotosToShow && photos.length > maxPhotosToShow && (
          <div className="text-center mt-4">
            <button
              onClick={() => {
                // This would typically expand the view or navigate to full gallery
                console.log('Show more photos');
              }}
              className={`${styles.button.ghost} ${styles.text.body} py-2 px-4 rounded-lg`}
            >
              {text.simple
                ? `See ${photos.length - maxPhotosToShow} more`
                : `View all ${photos.length} photos`
              }
            </button>
          </div>
        )}

        {/* Action buttons */}
        {selectedPhoto && onPhotoSelect && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const photo = photos.find(p => p.id === selectedPhoto);
                  if (photo) onPhotoSelect(photo);
                }}
                className={`${styles.button.primary} ${styles.text.body} py-2 px-4 rounded-lg flex-1`}
              >
                {text.simple ? '👁️ View Photo' : '👁️ View Details'}
              </button>

              {onPhotoDelete && text.simple && (
                <button
                  onClick={() => handlePhotoDelete(selectedPhoto)}
                  className={`${styles.button.secondary} ${styles.text.body} py-2 px-4 rounded-lg`}
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
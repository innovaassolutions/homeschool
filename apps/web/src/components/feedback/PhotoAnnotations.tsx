import React, { useState } from 'react';

export interface VisualAnnotation {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'error' | 'correction' | 'highlight' | 'praise';
  message: string;
  severity: 'low' | 'medium' | 'high';
  color?: string;
}

export interface PhotoAnnotationProps {
  imageUrl: string;
  annotations: VisualAnnotation[];
  interactive: boolean;
  ageGroup: 'ages6to9' | 'ages10to13' | 'ages14to16';
  onAnnotationClick?: (annotation: VisualAnnotation) => void;
  className?: string;
  imageScale?: number;
}

const getAnnotationIcon = (type: VisualAnnotation['type']): string => {
  switch (type) {
    case 'error':
      return '⚠️';
    case 'correction':
      return '✓';
    case 'praise':
      return '⭐';
    case 'highlight':
      return '💡';
    default:
      return '📌';
  }
};

export const PhotoAnnotations: React.FC<PhotoAnnotationProps> = ({
  imageUrl,
  annotations,
  interactive,
  ageGroup,
  onAnnotationClick,
  className = '',
  imageScale = 1.0
}) => {
  const [hoveredAnnotation, setHoveredAnnotation] = useState<string | null>(null);

  const handleAnnotationClick = (annotation: VisualAnnotation) => {
    if (interactive && onAnnotationClick) {
      onAnnotationClick(annotation);
    }
  };

  const handleAnnotationKeyDown = (
    event: React.KeyboardEvent,
    annotation: VisualAnnotation
  ) => {
    if (event.key === 'Enter') {
      handleAnnotationClick(annotation);
    }
  };

  const handleMouseEnter = (annotationId: string) => {
    if (interactive) {
      setHoveredAnnotation(annotationId);
    }
  };

  const handleMouseLeave = () => {
    setHoveredAnnotation(null);
  };

  return (
    <div className={`photo-annotations-container ${className}`}>
      <div className="relative inline-block">
        <img
          src={imageUrl}
          alt="Work submission"
          className="max-w-full h-auto"
        />

        <div
          className={`absolute inset-0 annotations-${ageGroup}`}
          data-testid="annotations-container"
          style={{ transform: `scale(${imageScale})` }}
        >
          {annotations.map((annotation) => (
            <div key={annotation.id}>
              <div
                data-testid={`annotation-${annotation.id}`}
                className={`absolute cursor-pointer annotation-marker severity-${annotation.severity} ${
                  interactive ? 'interactive' : ''
                }`}
                style={{
                  left: `${annotation.x}px`,
                  top: `${annotation.y}px`,
                  width: `${annotation.width}px`,
                  height: `${annotation.height}px`,
                  backgroundColor: annotation.color || '#ef4444',
                  opacity: 0.3,
                  border: '2px solid',
                  borderColor: annotation.color || '#ef4444',
                  borderRadius: '4px',
                  transform: `scale(${imageScale})`
                }}
                onClick={() => handleAnnotationClick(annotation)}
                onKeyDown={(e) => handleAnnotationKeyDown(e, annotation)}
                onMouseEnter={() => handleMouseEnter(annotation.id)}
                onMouseLeave={handleMouseLeave}
                tabIndex={interactive ? 0 : -1}
              >
                <span
                  className="annotation-icon absolute -top-6 -left-1 text-lg bg-white rounded-full w-6 h-6 flex items-center justify-center shadow-md"
                  style={{ fontSize: ageGroup === 'ages6to9' ? '16px' : '14px' }}
                >
                  {getAnnotationIcon(annotation.type)}
                </span>
              </div>

              {interactive && hoveredAnnotation === annotation.id && (
                <div
                  role="tooltip"
                  className="absolute z-10 bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg max-w-xs"
                  style={{
                    left: `${annotation.x + annotation.width + 10}px`,
                    top: `${annotation.y}px`,
                    fontSize: ageGroup === 'ages6to9' ? '14px' : '12px'
                  }}
                >
                  {annotation.message}
                  <div
                    className="absolute top-2 -left-1 w-2 h-2 bg-gray-900 transform rotate-45"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
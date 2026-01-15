import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PhotoAnnotations, PhotoAnnotationProps, VisualAnnotation } from '../PhotoAnnotations';

const mockAnnotations: VisualAnnotation[] = [
  {
    id: '1',
    x: 100,
    y: 50,
    width: 120,
    height: 20,
    type: 'error',
    message: 'This should be 4',
    severity: 'high',
    color: '#ef4444'
  },
  {
    id: '2',
    x: 150,
    y: 80,
    width: 100,
    height: 15,
    type: 'correction',
    message: 'Correct: 2 + 2 = 4',
    severity: 'medium',
    color: '#22c55e'
  },
  {
    id: '3',
    x: 200,
    y: 100,
    width: 80,
    height: 15,
    type: 'praise',
    message: 'Great handwriting!',
    severity: 'low',
    color: '#3b82f6'
  }
];

const defaultProps: PhotoAnnotationProps = {
  imageUrl: '/test-image.jpg',
  annotations: mockAnnotations,
  interactive: true,
  ageGroup: 'ages6to9',
  onAnnotationClick: vi.fn(),
  className: 'test-photo-annotations'
};

describe('PhotoAnnotations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render photo with annotations overlay', () => {
    render(<PhotoAnnotations {...defaultProps} />);

    const image = screen.getByRole('img');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/test-image.jpg');

    const annotationContainer = screen.getByTestId('annotations-container');
    expect(annotationContainer).toBeInTheDocument();
  });

  it('should display all annotations with correct positioning', () => {
    render(<PhotoAnnotations {...defaultProps} />);

    const errorAnnotation = screen.getByTestId('annotation-1');
    expect(errorAnnotation).toBeInTheDocument();
    expect(errorAnnotation).toHaveStyle({
      left: '100px',
      top: '50px',
      width: '120px',
      height: '20px'
    });

    const correctionAnnotation = screen.getByTestId('annotation-2');
    expect(correctionAnnotation).toBeInTheDocument();

    const praiseAnnotation = screen.getByTestId('annotation-3');
    expect(praiseAnnotation).toBeInTheDocument();
  });

  it('should show annotation tooltips on hover for interactive mode', async () => {
    render(<PhotoAnnotations {...defaultProps} />);

    const errorAnnotation = screen.getByTestId('annotation-1');
    fireEvent.mouseEnter(errorAnnotation);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('This should be 4');
  });

  it('should call onAnnotationClick when annotation is clicked', () => {
    const onClickMock = vi.fn();
    render(<PhotoAnnotations {...defaultProps} onAnnotationClick={onClickMock} />);

    const errorAnnotation = screen.getByTestId('annotation-1');
    fireEvent.click(errorAnnotation);

    expect(onClickMock).toHaveBeenCalledWith(mockAnnotations[0]);
  });

  it('should not show tooltips in non-interactive mode', () => {
    render(<PhotoAnnotations {...defaultProps} interactive={false} />);

    const errorAnnotation = screen.getByTestId('annotation-1');
    fireEvent.mouseEnter(errorAnnotation);

    const tooltip = screen.queryByRole('tooltip');
    expect(tooltip).not.toBeInTheDocument();
  });

  it('should apply age-appropriate styling for ages6to9', () => {
    render(<PhotoAnnotations {...defaultProps} ageGroup="ages6to9" />);

    const container = screen.getByTestId('annotations-container');
    expect(container).toHaveClass('annotations-ages6to9');
  });

  it('should apply age-appropriate styling for ages10to13', () => {
    render(<PhotoAnnotations {...defaultProps} ageGroup="ages10to13" />);

    const container = screen.getByTestId('annotations-container');
    expect(container).toHaveClass('annotations-ages10to13');
  });

  it('should apply age-appropriate styling for ages14to16', () => {
    render(<PhotoAnnotations {...defaultProps} ageGroup="ages14to16" />);

    const container = screen.getByTestId('annotations-container');
    expect(container).toHaveClass('annotations-ages14to16');
  });

  it('should display different icon types for different annotation types', () => {
    render(<PhotoAnnotations {...defaultProps} />);

    const errorIcon = screen.getByTestId('annotation-1').querySelector('.annotation-icon');
    expect(errorIcon).toHaveTextContent('⚠️');

    const correctionIcon = screen.getByTestId('annotation-2').querySelector('.annotation-icon');
    expect(correctionIcon).toHaveTextContent('✓');

    const praiseIcon = screen.getByTestId('annotation-3').querySelector('.annotation-icon');
    expect(praiseIcon).toHaveTextContent('⭐');
  });

  it('should handle empty annotations gracefully', () => {
    render(<PhotoAnnotations {...defaultProps} annotations={[]} />);

    const image = screen.getByRole('img');
    expect(image).toBeInTheDocument();

    const annotationContainer = screen.getByTestId('annotations-container');
    expect(annotationContainer).toBeInTheDocument();
    expect(annotationContainer.children).toHaveLength(0);
  });

  it('should apply severity-based styling', () => {
    render(<PhotoAnnotations {...defaultProps} />);

    const highSeverity = screen.getByTestId('annotation-1');
    expect(highSeverity).toHaveClass('severity-high');

    const mediumSeverity = screen.getByTestId('annotation-2');
    expect(mediumSeverity).toHaveClass('severity-medium');

    const lowSeverity = screen.getByTestId('annotation-3');
    expect(lowSeverity).toHaveClass('severity-low');
  });

  it('should support keyboard navigation for interactive annotations', () => {
    const onClickMock = vi.fn();
    render(<PhotoAnnotations {...defaultProps} onAnnotationClick={onClickMock} />);

    const errorAnnotation = screen.getByTestId('annotation-1');
    errorAnnotation.focus();
    fireEvent.keyDown(errorAnnotation, { key: 'Enter' });

    expect(onClickMock).toHaveBeenCalledWith(mockAnnotations[0]);
  });

  it('should scale annotations when image is resized', () => {
    const { rerender } = render(
      <PhotoAnnotations {...defaultProps} imageScale={1.0} />
    );

    let errorAnnotation = screen.getByTestId('annotation-1');
    expect(errorAnnotation).toHaveStyle({ transform: 'scale(1)' });

    rerender(<PhotoAnnotations {...defaultProps} imageScale={0.5} />);

    errorAnnotation = screen.getByTestId('annotation-1');
    expect(errorAnnotation).toHaveStyle({ transform: 'scale(0.5)' });
  });
});
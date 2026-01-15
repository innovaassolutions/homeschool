import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { AgeAdaptiveWrapper } from './AgeAdaptiveWrapper';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';

jest.mock('../../hooks/useAgeAdaptive');

const mockUseAgeAdaptive = useAgeAdaptive as jest.MockedFunction<typeof useAgeAdaptive>;

describe('AgeAdaptiveWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.className = '';
    document.documentElement.style.cssText = '';
  });

  afterEach(() => {
    cleanup();
    document.body.className = '';
    document.documentElement.style.cssText = '';
  });

  it('should render children correctly', () => {
    mockUseAgeAdaptive.mockReturnValue({
      ageGroup: 'ages10to13',
      theme: {
        colors: { primary: '#3B82F6', secondary: '#8B5CF6', background: '#F8FAFC', text: '#1E293B', accent: '#06B6D4' },
        typography: {
          fontSize: { sm: '0.875rem', base: '1rem', lg: '1.25rem', xl: '1.5rem' },
          fontWeight: { normal: '400', medium: '500', bold: '600' }
        },
        spacing: { buttonPadding: '0.75rem 1.5rem', containerPadding: '1.5rem', elementSpacing: '1rem' },
        layout: { buttonMinHeight: '48px', buttonMinWidth: '100px', touchTarget: '44px' }
      },
      interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
      navigation: { complexity: 'balanced', showBreadcrumbs: true, maxNavigationDepth: 3 }
    });

    const { getByText } = render(
      <AgeAdaptiveWrapper>
        <div>Test content</div>
      </AgeAdaptiveWrapper>
    );

    expect(getByText('Test content')).toBeInTheDocument();
  });

  it('should apply age-adaptive-container class', () => {
    mockUseAgeAdaptive.mockReturnValue({
      ageGroup: 'ages10to13',
      theme: {
        colors: { primary: '#3B82F6', secondary: '#8B5CF6', background: '#F8FAFC', text: '#1E293B', accent: '#06B6D4' },
        typography: {
          fontSize: { sm: '0.875rem', base: '1rem', lg: '1.25rem', xl: '1.5rem' },
          fontWeight: { normal: '400', medium: '500', bold: '600' }
        },
        spacing: { buttonPadding: '0.75rem 1.5rem', containerPadding: '1.5rem', elementSpacing: '1rem' },
        layout: { buttonMinHeight: '48px', buttonMinWidth: '100px', touchTarget: '44px' }
      },
      interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
      navigation: { complexity: 'balanced', showBreadcrumbs: true, maxNavigationDepth: 3 }
    });

    const { container } = render(
      <AgeAdaptiveWrapper>
        <div>Test content</div>
      </AgeAdaptiveWrapper>
    );

    expect(container.firstChild).toHaveClass('age-adaptive-container');
  });

  it('should apply custom className alongside age-adaptive-container', () => {
    mockUseAgeAdaptive.mockReturnValue({
      ageGroup: 'ages10to13',
      theme: {
        colors: { primary: '#3B82F6', secondary: '#8B5CF6', background: '#F8FAFC', text: '#1E293B', accent: '#06B6D4' },
        typography: {
          fontSize: { sm: '0.875rem', base: '1rem', lg: '1.25rem', xl: '1.5rem' },
          fontWeight: { normal: '400', medium: '500', bold: '600' }
        },
        spacing: { buttonPadding: '0.75rem 1.5rem', containerPadding: '1.5rem', elementSpacing: '1rem' },
        layout: { buttonMinHeight: '48px', buttonMinWidth: '100px', touchTarget: '44px' }
      },
      interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
      navigation: { complexity: 'balanced', showBreadcrumbs: true, maxNavigationDepth: 3 }
    });

    const { container } = render(
      <AgeAdaptiveWrapper className="custom-class">
        <div>Test content</div>
      </AgeAdaptiveWrapper>
    );

    expect(container.firstChild).toHaveClass('age-adaptive-container', 'custom-class');
  });

  it('should set CSS custom properties for theme values', () => {
    mockUseAgeAdaptive.mockReturnValue({
      ageGroup: 'ages6to9',
      theme: {
        colors: { primary: '#10B981', secondary: '#F59E0B', background: '#F0FDF4', text: '#1F2937', accent: '#EC4899' },
        typography: {
          fontSize: { sm: '1rem', base: '1.25rem', lg: '1.5rem', xl: '2rem' },
          fontWeight: { normal: '500', medium: '600', bold: '700' }
        },
        spacing: { buttonPadding: '1rem 2rem', containerPadding: '2rem', elementSpacing: '1.5rem' },
        layout: { buttonMinHeight: '60px', buttonMinWidth: '120px', touchTarget: '48px' }
      },
      interactions: { showHoverStates: false, enableAdvancedGestures: false, animationDuration: '300ms' },
      navigation: { complexity: 'simple', showBreadcrumbs: false, maxNavigationDepth: 2 }
    });

    render(
      <AgeAdaptiveWrapper>
        <div>Test content</div>
      </AgeAdaptiveWrapper>
    );

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary')).toBe('#10B981');
    expect(root.style.getPropertyValue('--font-size-base')).toBe('1.25rem');
    expect(root.style.getPropertyValue('--font-weight-medium')).toBe('600');
    expect(root.style.getPropertyValue('--button-padding')).toBe('1rem 2rem');
    expect(root.style.getPropertyValue('--button-min-height')).toBe('60px');
  });

  it('should add age group class to body', () => {
    mockUseAgeAdaptive.mockReturnValue({
      ageGroup: 'ages14to16',
      theme: {
        colors: { primary: '#6366F1', secondary: '#64748B', background: '#FFFFFF', text: '#0F172A', accent: '#EF4444' },
        typography: {
          fontSize: { sm: '0.75rem', base: '0.875rem', lg: '1rem', xl: '1.25rem' },
          fontWeight: { normal: '400', medium: '500', bold: '600' }
        },
        spacing: { buttonPadding: '0.5rem 1rem', containerPadding: '1rem', elementSpacing: '0.75rem' },
        layout: { buttonMinHeight: '40px', buttonMinWidth: '80px', touchTarget: '40px' }
      },
      interactions: { showHoverStates: true, enableAdvancedGestures: true, animationDuration: '200ms' },
      navigation: { complexity: 'advanced', showBreadcrumbs: true, maxNavigationDepth: 5 }
    });

    render(
      <AgeAdaptiveWrapper>
        <div>Test content</div>
      </AgeAdaptiveWrapper>
    );

    expect(document.body).toHaveClass('age-theme-14to16');
  });

  it('should clean up age group class on unmount', () => {
    mockUseAgeAdaptive.mockReturnValue({
      ageGroup: 'ages6to9',
      theme: {
        colors: { primary: '#10B981', secondary: '#F59E0B', background: '#F0FDF4', text: '#1F2937', accent: '#EC4899' },
        typography: {
          fontSize: { sm: '1rem', base: '1.25rem', lg: '1.5rem', xl: '2rem' },
          fontWeight: { normal: '500', medium: '600', bold: '700' }
        },
        spacing: { buttonPadding: '1rem 2rem', containerPadding: '2rem', elementSpacing: '1.5rem' },
        layout: { buttonMinHeight: '60px', buttonMinWidth: '120px', touchTarget: '48px' }
      },
      interactions: { showHoverStates: false, enableAdvancedGestures: false, animationDuration: '300ms' },
      navigation: { complexity: 'simple', showBreadcrumbs: false, maxNavigationDepth: 2 }
    });

    const { unmount } = render(
      <AgeAdaptiveWrapper>
        <div>Test content</div>
      </AgeAdaptiveWrapper>
    );

    expect(document.body).toHaveClass('age-theme-6to9');

    unmount();

    expect(document.body).not.toHaveClass('age-theme-6to9');
  });

  it('should pass overrideAgeGroup to useAgeAdaptive hook', () => {
    mockUseAgeAdaptive.mockReturnValue({
      ageGroup: 'ages14to16',
      theme: {
        colors: { primary: '#6366F1', secondary: '#64748B', background: '#FFFFFF', text: '#0F172A', accent: '#EF4444' },
        typography: {
          fontSize: { sm: '0.75rem', base: '0.875rem', lg: '1rem', xl: '1.25rem' },
          fontWeight: { normal: '400', medium: '500', bold: '600' }
        },
        spacing: { buttonPadding: '0.5rem 1rem', containerPadding: '1rem', elementSpacing: '0.75rem' },
        layout: { buttonMinHeight: '40px', buttonMinWidth: '80px', touchTarget: '40px' }
      },
      interactions: { showHoverStates: true, enableAdvancedGestures: true, animationDuration: '200ms' },
      navigation: { complexity: 'advanced', showBreadcrumbs: true, maxNavigationDepth: 5 }
    });

    render(
      <AgeAdaptiveWrapper overrideAgeGroup="ages14to16">
        <div>Test content</div>
      </AgeAdaptiveWrapper>
    );

    expect(mockUseAgeAdaptive).toHaveBeenCalledWith('ages14to16');
  });

  it('should replace existing age theme classes on body', () => {
    document.body.className = 'existing-class age-theme-6to9 another-class';

    mockUseAgeAdaptive.mockReturnValue({
      ageGroup: 'ages10to13',
      theme: {
        colors: { primary: '#3B82F6', secondary: '#8B5CF6', background: '#F8FAFC', text: '#1E293B', accent: '#06B6D4' },
        typography: {
          fontSize: { sm: '0.875rem', base: '1rem', lg: '1.25rem', xl: '1.5rem' },
          fontWeight: { normal: '400', medium: '500', bold: '600' }
        },
        spacing: { buttonPadding: '0.75rem 1.5rem', containerPadding: '1.5rem', elementSpacing: '1rem' },
        layout: { buttonMinHeight: '48px', buttonMinWidth: '100px', touchTarget: '44px' }
      },
      interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
      navigation: { complexity: 'balanced', showBreadcrumbs: true, maxNavigationDepth: 3 }
    });

    render(
      <AgeAdaptiveWrapper>
        <div>Test content</div>
      </AgeAdaptiveWrapper>
    );

    expect(document.body).toHaveClass('existing-class', 'another-class', 'age-theme-10to13');
    expect(document.body).not.toHaveClass('age-theme-6to9');
  });
});
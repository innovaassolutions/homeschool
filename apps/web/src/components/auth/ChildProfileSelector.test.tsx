import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChildProfileSelector } from './ChildProfileSelector';
import { ChildProfile } from '../../hooks/useSurrealAuth';

// Mock the authentication hook
const mockSwitchToChild = vi.fn();
const mockSwitchToParent = vi.fn();

const mockChildProfiles: ChildProfile[] = [
  {
    id: 'child:1',
    family_id: 'family:123',
    child_name: 'Emma',
    age_group: 'ages6to9',
    privacy_level: 'strict',
    parental_controls: {
      screen_time_limit: 60,
      content_filters: ['educational_only'],
      communication_allowed: false,
    },
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  },
  {
    id: 'child:2',
    family_id: 'family:123',
    child_name: 'Sam',
    age_group: 'ages10to13',
    privacy_level: 'standard',
    parental_controls: {
      screen_time_limit: 120,
      content_filters: ['age_appropriate'],
      communication_allowed: false,
    },
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  },
];

vi.mock('../../hooks/useSurrealAuth', () => ({
  useSurrealAuth: () => ({
    user: {
      familyId: 'family:123',
      userType: 'parent',
      userId: 'family:123',
    },
    childProfiles: mockChildProfiles,
    isParent: true,
    isChild: false,
    switchToChild: mockSwitchToChild,
    switchToParent: mockSwitchToParent,
  }),
}));

describe('ChildProfileSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all child profiles when user is parent', () => {
    render(<ChildProfileSelector />);

    // Check that both child profiles are displayed
    expect(screen.getByText('Emma')).toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();

    // Check age group badges
    expect(screen.getByText('Ages 6-9')).toBeInTheDocument();
    expect(screen.getByText('Ages 10-13')).toBeInTheDocument();

    // Check screen time limits
    expect(screen.getByText('60 min/day')).toBeInTheDocument();
    expect(screen.getByText('120 min/day')).toBeInTheDocument();

    // Should show switch buttons for each child
    const switchButtons = screen.getAllByText(/switch to/i);
    expect(switchButtons).toHaveLength(2);
  });

  it('should switch to child profile when switch button is clicked', () => {
    mockSwitchToChild.mockReturnValue({ success: true });

    render(<ChildProfileSelector />);

    const emmaButton = screen.getByRole('button', { name: /switch to emma/i });
    fireEvent.click(emmaButton);

    expect(mockSwitchToChild).toHaveBeenCalledWith(mockChildProfiles[0]);
  });

  it('should handle switch failure', () => {
    mockSwitchToChild.mockReturnValue({ success: false, error: 'Switch failed' });

    render(<ChildProfileSelector />);

    const emmaButton = screen.getByRole('button', { name: /switch to emma/i });
    fireEvent.click(emmaButton);

    expect(mockSwitchToChild).toHaveBeenCalledWith(mockChildProfiles[0]);
    // The component should handle the error gracefully
  });

  it('should display age group badges correctly', () => {
    render(<ChildProfileSelector />);

    // Check that age groups are formatted correctly
    expect(screen.getByText('Ages 6-9')).toBeInTheDocument();
    expect(screen.getByText('Ages 10-13')).toBeInTheDocument();
  });

  it('should display privacy level indicators', () => {
    render(<ChildProfileSelector />);

    // Check privacy level badges
    expect(screen.getByText('Strict Privacy')).toBeInTheDocument();
    expect(screen.getByText('Standard Privacy')).toBeInTheDocument();
  });

  it('should show content filter information', () => {
    render(<ChildProfileSelector />);

    // Check content filter badges
    expect(screen.getByText('Educational Only')).toBeInTheDocument();
    expect(screen.getByText('Age Appropriate')).toBeInTheDocument();
  });

  it('should show add new child profile button', () => {
    render(<ChildProfileSelector />);

    expect(screen.getByRole('button', { name: /add new child profile/i })).toBeInTheDocument();
  });
});
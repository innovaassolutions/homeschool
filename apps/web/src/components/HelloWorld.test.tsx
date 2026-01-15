import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HelloWorld from './HelloWorld';

describe('HelloWorld Component', () => {
  it('renders hello world message', () => {
    render(<HelloWorld />);
    const element = screen.getByText(/hello world/i);
    expect(element).toBeInTheDocument();
  });

  it('renders with proper styling', () => {
    render(<HelloWorld />);
    const element = screen.getByRole('heading');
    expect(element).toHaveClass('text-primary-600');
  });
});
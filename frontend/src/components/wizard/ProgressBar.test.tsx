import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('renders step text showing current position', () => {
    render(<ProgressBar current={2} total={9} />);
    expect(screen.getByText('Passo 3 de 9')).toBeInTheDocument();
  });

  it('renders percentage text', () => {
    render(<ProgressBar current={2} total={9} />);
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('renders correct number of segments', () => {
    const { container } = render(<ProgressBar current={0} total={9} />);
    const segments = container.querySelectorAll('.rounded-full');
    expect(segments).toHaveLength(9);
  });

  it('fills segments up to and including current step', () => {
    const { container } = render(<ProgressBar current={3} total={9} />);
    const segments = container.querySelectorAll('.rounded-full');

    // First 4 segments (indices 0-3) should be filled
    for (let i = 0; i <= 3; i++) {
      expect(segments[i]).toHaveClass('bg-slate-800');
    }
    // Remaining segments should be unfilled
    for (let i = 4; i < 9; i++) {
      expect(segments[i]).toHaveClass('bg-slate-200');
    }
  });

  it('fills all segments on the last step', () => {
    const { container } = render(<ProgressBar current={8} total={9} />);
    const segments = container.querySelectorAll('.rounded-full');

    for (let i = 0; i < 9; i++) {
      expect(segments[i]).toHaveClass('bg-slate-800');
    }
  });

  it('has correct ARIA attributes', () => {
    render(<ProgressBar current={4} total={9} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '5');
    expect(progressbar).toHaveAttribute('aria-valuemin', '1');
    expect(progressbar).toHaveAttribute('aria-valuemax', '9');
  });

  it('shows 100% on the last step', () => {
    render(<ProgressBar current={8} total={9} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows first step correctly', () => {
    render(<ProgressBar current={0} total={9} />);
    expect(screen.getByText('Passo 1 de 9')).toBeInTheDocument();
    expect(screen.getByText('11%')).toBeInTheDocument();
  });
});

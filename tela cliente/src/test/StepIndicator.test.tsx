import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StepIndicator from '../components/StepIndicator';

describe('StepIndicator Component (StepIndicator.tsx)', () => {
  it('deve renderizar a quantidade correta de barras de progresso e o texto do passo', () => {
    const { container } = render(<StepIndicator total={4} current={1} />);
    const bars = container.querySelectorAll('.h-1\\.5');
    expect(bars.length).toBe(4);
    expect(screen.getByText('Passo 2 de 4')).toBeInTheDocument();
    expect(screen.getByText('Horário')).toBeInTheDocument();
  });
});

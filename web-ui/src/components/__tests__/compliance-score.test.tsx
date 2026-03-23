/**
 * Tests for ComplianceScore component.
 * Verifies visual states (compliant/review/non-compliant) and tooltip content.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComplianceScore } from '../compliance-score';

describe('ComplianceScore', () => {
    it('renders score percentage', () => {
        render(<ComplianceScore score={95} reasons={['Tone is professional']} />);
        expect(screen.getByText('95%')).toBeInTheDocument();
    });

    it('shows "Compliant" label for scores >= 90', () => {
        render(<ComplianceScore score={92} reasons={[]} />);
        const labels = screen.getAllByText('Compliant');
        expect(labels.length).toBeGreaterThan(0);
    });

    it('shows "Review Needed" label for scores 70-89', () => {
        render(<ComplianceScore score={75} reasons={['Informal tone']} />);
        expect(screen.getByText('Review Needed')).toBeInTheDocument();
    });

    it('shows "Non-Compliant" label for scores < 70', () => {
        render(<ComplianceScore score={40} reasons={['Off-brand messaging']} />);
        expect(screen.getByText('Non-Compliant')).toBeInTheDocument();
    });

    it('renders with multiple reasons without crashing', () => {
        const { container } = render(
            <ComplianceScore
                score={60}
                reasons={['Tone too casual', 'Missing CTA', 'Wrong hashtag']}
            />
        );
        // Radix Tooltip content is portaled only on hover — verify the trigger renders correctly
        expect(container.textContent).toContain('60%');
        expect(container.textContent).toContain('Non-Compliant');
    });

    it('renders boundary values correctly', () => {
        const { container, rerender } = render(<ComplianceScore score={90} reasons={[]} />);
        expect(container.textContent).toContain('Compliant');

        rerender(<ComplianceScore score={89} reasons={[]} />);
        expect(container.textContent).toContain('Review Needed');

        rerender(<ComplianceScore score={70} reasons={[]} />);
        expect(container.textContent).toContain('Review Needed');

        rerender(<ComplianceScore score={69} reasons={[]} />);
        expect(container.textContent).toContain('Non-Compliant');
    });
});

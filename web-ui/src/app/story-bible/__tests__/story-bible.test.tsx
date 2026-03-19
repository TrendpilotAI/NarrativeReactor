import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StoryBiblePage from '../page';

// Mock the actions
vi.mock('@/app/actions', () => ({
    osintResearchAction: vi.fn(),
}));

import { osintResearchAction } from '@/app/actions';

describe('Story Bible Workflow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('binary test: passes end-to-end rendering and character research flow', async () => {
        // Arrange
        (osintResearchAction as any).mockResolvedValue({
            response: 'Maya is a senior wealth advisor with a strong focus on AI.'
        });

        // Act
        render(<StoryBiblePage />);
        
        // Assert characters are rendered
        expect(screen.getByText('Maya Chen')).not.toBeNull();
        expect(screen.getByText('Protagonist / Senior Wealth Advisor')).not.toBeNull();
        expect(screen.getByText('Marcus Thompson')).not.toBeNull();

        // Check tabs
        expect(screen.getByText('Characters')).not.toBeNull();
        expect(screen.getByText('Brand Guidelines')).not.toBeNull();

        // Perform research on the first character
        const researchBtns = screen.getAllByText('Research Persona');
        fireEvent.click(researchBtns[0]); // Click Maya's research button

        // Verify action is called
        expect(osintResearchAction).toHaveBeenCalledWith(
            'Maya Chen persona wealth advisor financial services AI technology',
            'persona'
        );

        // Await research modal presentation
        await waitFor(() => {
            expect(screen.getByText('OSINT Research: Maya Chen')).not.toBeNull();
            expect(screen.getByText('Maya is a senior wealth advisor with a strong focus on AI.')).not.toBeNull();
        });

        // Close modal
        // Find the button with X inside the modal using query selector since it might be icon only
        const modal = screen.getByText('OSINT Research: Maya Chen').closest('div')?.parentElement;
        const closeBtn = modal?.querySelector('button');
        if (closeBtn) {
            fireEvent.click(closeBtn);
        }

        await waitFor(() => {
            expect(screen.queryByText('OSINT Research: Maya Chen')).toBeNull();
        });
    });
});

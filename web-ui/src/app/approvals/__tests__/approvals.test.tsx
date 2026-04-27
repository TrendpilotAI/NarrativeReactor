import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ApprovalsPage from '../page';

// Mock components that might be complex
vi.mock('@/components/compliance-score', () => ({
    ComplianceScore: ({ score }: { score: number }) => <div data-testid="compliance-score">{score}</div>
}));

describe('Approvals Workflow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('binary test: passes end-to-end approvals list and review flow', async () => {
        render(<ApprovalsPage />);
        
        // Assert sidebar items are loaded
        const title1 = screen.getAllByText('Episode 3.1 Teaser - Twitter')[0];
        const title2 = screen.getAllByText('Episode 3.1 Teaser - LinkedIn')[0];
        expect(title1).not.toBeNull();
        expect(title2).not.toBeNull();

        // It should render the first item in the main view by default
        let titleMain = screen.getAllByText('Episode 3.1 Teaser - Twitter')[1];
        expect(titleMain).not.toBeNull();

        // Click the second item
        fireEvent.click(title2);

        // Main view updates to second item
        titleMain = screen.getAllByText('Episode 3.1 Teaser - LinkedIn')[1];
        expect(titleMain).not.toBeNull();

        // Verify Action Buttons exist for binary state check
        expect(screen.getByText('Approve Content')).not.toBeNull();
        expect(screen.getByText('Reject')).not.toBeNull();

        // Test editing flow
        const isolateEditBtn = screen.getByText('Isolate & Edit');
        fireEvent.click(isolateEditBtn);

        // Confirm edit mode saves
        expect(screen.getByText('Save Changes')).not.toBeNull();
        const saveBtn = screen.getByText('Save Changes');
        fireEvent.click(saveBtn);

        // Confirm exit edit mode
        expect(screen.queryByText('Save Changes')).toBeNull();
        expect(screen.getByText('Approve Content')).not.toBeNull();
    });
});

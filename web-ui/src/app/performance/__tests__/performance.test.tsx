import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PerformancePage from '../page';

// Mock the actions
vi.mock('@/app/actions', () => ({
    getPerformanceDataAction: vi.fn(),
    getMentionsAction: vi.fn(),
    listIntegrationsAction: vi.fn(),
}));

import { getPerformanceDataAction, getMentionsAction, listIntegrationsAction } from '@/app/actions';

describe('Performance Workflow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('binary test: passes end-to-end performance rendering with connected account', async () => {
        // Arrange
        (listIntegrationsAction as any).mockResolvedValue([{ provider: 'x', connected: true }]);
        (getPerformanceDataAction as any).mockResolvedValue([
            { label: 'Impressions', value: 10000, change: '+5%' }
        ]);
        (getMentionsAction as any).mockResolvedValue([
            { id: '1', text: 'Great content', createdAt: new Date().toISOString(), author: { name: 'User1', username: 'user1', avatar: '' } }
        ]);

        // Act
        render(<PerformancePage />);
        
        // Assert Loading then Data
        await waitFor(() => {
            expect(screen.getByText('Impressions')).not.toBeNull();
            expect(screen.getByText('10,000')).not.toBeNull();
            expect(screen.getByText('User1')).not.toBeNull();
            expect(screen.getByText(/"Great content"/i)).not.toBeNull();
        });

        // Ensure actions were called correctly
        expect(listIntegrationsAction).toHaveBeenCalled();
        expect(getPerformanceDataAction).toHaveBeenCalledWith('x');
        expect(getMentionsAction).toHaveBeenCalledWith('x');
    });

    it('binary test: shows no integrations message if not connected', async () => {
        // Arrange
        (listIntegrationsAction as any).mockResolvedValue([{ provider: 'x', connected: false }]);

        // Act
        render(<PerformancePage />);
        
        // Assert
        await waitFor(() => {
            expect(screen.getByText('No Integrations Connected')).not.toBeNull();
        });
        
        // Ensure data fetch was not called
        expect(getPerformanceDataAction).not.toHaveBeenCalled();
    });
});

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AssetsPage from '../page';

// Mock the actions
vi.mock('@/app/actions', () => ({
    listAssetsAction: vi.fn(),
    deleteAssetAction: vi.fn()
}));

import { listAssetsAction, deleteAssetAction } from '@/app/actions';

describe('Assets Workflow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default confirm mock
        window.confirm = vi.fn().mockImplementation(() => true);
    });

    it('binary test: passes end-to-end assets loading, filtering, and deletion', async () => {
        // Arrange
        const mockAssets = [
            { id: '1', type: 'image', url: 'http://img1.com', prompt: 'hero image', createdAt: new Date().toISOString() },
            { id: '2', type: 'video', url: 'http://vid1.com', prompt: 'hero video', createdAt: new Date().toISOString() }
        ];
        (listAssetsAction as any).mockImplementation((type = 'all') => {
            if (type === 'all') return Promise.resolve(mockAssets);
            return Promise.resolve(mockAssets.filter((asset) => asset.type === type));
        });
        (deleteAssetAction as any).mockResolvedValue({ success: true });

        // Act
        render(<AssetsPage />);
        
        // Assert Loading state initially or wait for it to resolve
        await waitFor(() => {
            expect(screen.getByText('hero image')).not.toBeNull();
            expect(screen.getByText('hero video')).not.toBeNull();
        });

        // Filter to images only
        const imagesTab = screen.getByRole('tab', { name: /Images/i });
        fireEvent.mouseDown(imagesTab);
        fireEvent.mouseUp(imagesTab);
        fireEvent.click(imagesTab);

        // listAssetsAction should be called again with 'image'
        await waitFor(() => {
            expect(listAssetsAction).toHaveBeenCalledWith('image');
            expect(screen.getByText('hero image')).not.toBeNull();
            expect(screen.queryByText('hero video')).toBeNull();
        });

        // Back to all to test deletion
        const allTab = screen.getByRole('tab', { name: /All/i });
        fireEvent.mouseDown(allTab);
        fireEvent.mouseUp(allTab);
        fireEvent.click(allTab);

        await waitFor(() => {
            expect(listAssetsAction).toHaveBeenCalledWith('all');
            expect(screen.getByText('hero video')).not.toBeNull();
        });

        // Click an asset to open modal
        const card = screen.getByText('hero image');
        fireEvent.click(card);

        // Find delete button in modal
        await waitFor(() => {
            expect(screen.getByText('Download')).not.toBeNull(); // Modal is open
        });
        
        // Mocking window.confirm was set to true, so clicking delete works
        const deleteButton = screen.getAllByRole('button').find(btn => btn.className.includes('text-red-400'));
        if (deleteButton) {
            fireEvent.click(deleteButton);
        }

        await waitFor(() => {
            expect(deleteAssetAction).toHaveBeenCalledWith('1');
            // The item should be removed from DOM
            expect(screen.queryByText('hero image')).toBeNull();
        });
    });
});

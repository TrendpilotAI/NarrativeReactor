import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IntegrationsPage from '../page';

// Mock the actions
vi.mock('@/app/actions', () => ({
    listIntegrationsAction: vi.fn(),
    getAuthUrlAction: vi.fn(),
}));

// Mock Next.js routing
vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(''),
}));

import { listIntegrationsAction, getAuthUrlAction } from '@/app/actions';

describe('Integrations Workflow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock window.location
        delete (window as any).location;
        (window as any).location = { href: '' };
        Storage.prototype.setItem = vi.fn();
    });

    it('binary test: passes end-to-end integration listing and connection flow', async () => {
        // Arrange
        const mockIntegrations = [
            { provider: 'x', name: 'X (Twitter)', connected: false, username: '' },
            { provider: 'linkedin', name: 'LinkedIn', connected: true, username: 'tester' }
        ];
        (listIntegrationsAction as any).mockResolvedValue(mockIntegrations);
        (getAuthUrlAction as any).mockResolvedValue({
            url: 'http://auth.com/oauth',
            codeVerifier: 'abc123verifier'
        });

        // Act
        render(<IntegrationsPage />);
        
        // Wait for list to load
        await waitFor(() => {
            expect(screen.getByText('X (Twitter)')).not.toBeNull();
            expect(screen.getByText('LinkedIn')).not.toBeNull();
        });

        // Verify connected states
        expect(screen.getByText('Not connected')).not.toBeNull(); // For X
        expect(screen.getByText('@tester')).not.toBeNull(); // For LinkedIn
        expect(screen.getByText('Disconnect Account')).not.toBeNull();

        // Initiate connection for X
        const connectBtn = screen.getByText('Connect X (Twitter)');
        fireEvent.click(connectBtn);

        await waitFor(() => {
            expect(getAuthUrlAction).toHaveBeenCalledWith('x');
            expect(localStorage.setItem).toHaveBeenCalledWith('verifier_x', 'abc123verifier');
            expect(window.location.href).toBe('http://auth.com/oauth');
        });
    });
});

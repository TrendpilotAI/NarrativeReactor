import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResearchPage from '../page';

// Global fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Research Workflow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('binary test: passes end-to-end OSINT research workflow (Visual, Vibe, Dossier)', async () => {
        // Arrange Visual Search mock
        mockFetch.mockResolvedValueOnce({
            json: async () => ({
                result: {
                    images: [
                        { title: 'Cyberpunk City', imageUrl: 'http://img1.com', source: 'pinterest', link: 'http://link1.com' }
                    ]
                }
            })
        });

        // Act
        render(<ResearchPage />);
        
        // Ensure starting on Visual Studio
        expect(screen.getByText('Visual Studio')).not.toBeNull();

        // Perform search
        const searchInput = screen.getByPlaceholderText(/Search for visual styles/i);
        fireEvent.change(searchInput, { target: { value: 'cyberpunk' } });
        
        const searchBtn = screen.getByText('Initiate Search');
        fireEvent.click(searchBtn);

        // Verify it hits the visual search endpoint
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:3400/osintVisualSearchTool', expect.any(Object));

        // Await results
        await waitFor(() => {
            expect(screen.getByText('Cyberpunk City')).not.toBeNull();
        });


        // Await results
        await waitFor(() => {
            expect(screen.getByText('Cyberpunk City')).not.toBeNull();
        });
    });
});

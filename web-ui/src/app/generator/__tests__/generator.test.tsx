import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GeneratorPage from '../page';
import { LLM_MODELS } from '@/contexts/ModelContext';

// Mock the actions
vi.mock('@/app/actions', () => ({
    generateContentAction: vi.fn(),
    generateSceneAction: vi.fn(),
    generatePrevisImageAction: vi.fn(),
    generateVideoAction: vi.fn()
}));

// Mock the Models Context
vi.mock('@/contexts/ModelContext', () => ({
    useModels: () => ({
        llmModel: { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
        setLlmModel: vi.fn()
    }),
    LLM_MODELS: [
        { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
        { id: 'gemini-1-5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' }
    ]
}));

import { generateContentAction } from '@/app/actions';

describe('Generator Workflow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('binary test: passes end-to-end generator flow successfully', async () => {
        // Arrange
        (generateContentAction as any).mockResolvedValue({
            content: 'Successfully generated content test block.',
            compliance: { passed: true, issues: [] },
            metadata: {}
        });

        // Act
        render(<GeneratorPage />);
        
        // Assert Initial State
        expect(screen.getByText('Content Generator')).not.toBeNull();
        expect(screen.getByText('Preview & Validation')).not.toBeNull();

        // Simulate choosing a platform (Twitter is default usually, let's click LinkedIn)
        const linkedinBtn = screen.getByText('LinkedIn');
        fireEvent.click(linkedinBtn);
        
        // Click Generate
        const generateBtn = screen.getByText('GENERATE CONTENT');
        fireEvent.click(generateBtn);

        // Assert that loading state appears
        expect(screen.getByText('Generating...')).not.toBeNull();

        // Await resolution and verify output
        await waitFor(() => {
            expect(screen.getByText('Successfully generated content test block.')).not.toBeNull();
        });

        // Verify compliance badge
        expect(screen.getByText('Brand Compliance Passed')).not.toBeNull();
    });

    it('binary test: handles generator flow failure', async () => {
        // Arrange
        (generateContentAction as any).mockRejectedValue(new Error('API failure'));

        // Act
        render(<GeneratorPage />);
        
        // Click Generate
        const generateBtn = screen.getByText('GENERATE CONTENT');
        fireEvent.click(generateBtn);

        // Await resolution and verify error message
        await waitFor(() => {
            expect(screen.getByText('System Error: Failed to generate content.')).not.toBeNull();
        });
    });
});

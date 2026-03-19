import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPage from '../page';

// Mock the Models Context
vi.mock('@/contexts/ModelContext', () => ({
    useModels: () => ({
        llmModel: { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
        setLlmModel: vi.fn(),
        imageModel: { id: 'fal-ai/flux-pro', name: 'Flux Pro', provider: 'Fal.ai' },
        setImageModel: vi.fn(),
        videoModel: { id: 'fal-ai/minimax', name: 'Minimax', provider: 'Fal.ai' },
        setVideoModel: vi.fn(),
    }),
    LLM_MODELS: [{ id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' }],
    IMAGE_MODELS: [{ id: 'fal-ai/flux-pro', name: 'Flux Pro', provider: 'Fal.ai' }],
    VIDEO_MODELS: [{ id: 'fal-ai/minimax', name: 'Minimax', provider: 'Fal.ai' }]
}));

describe('Settings Workflow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: vi.fn().mockReturnValue(JSON.stringify({ anthropic: 'test-key' })),
                setItem: vi.fn()
            },
            writable: true
        });
    });

    it('binary test: passes end-to-end settings rendering and save flow', () => {
        // Act
        render(<SettingsPage />);
        
        // Assert tabs exist
        expect(screen.getAllByText('API Keys').length).toBeGreaterThan(0);
        expect(screen.getAllByText('AI Models').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Appearance').length).toBeGreaterThan(0);

        // Check if API keys from local storage loaded (anthropic key)
        const anthropicInput = screen.getByLabelText(/Anthropic API Key/i) as HTMLInputElement;
        expect(anthropicInput.value).toBe('test-key');

        // Modify input
        fireEvent.change(anthropicInput, { target: { value: 'new-key' } });

        // Save
        const saveBtn = screen.getByText('Save Settings');
        fireEvent.click(saveBtn);
        
        // Confirm Storage item was set
        expect(localStorage.setItem).toHaveBeenCalledWith('nr_api_keys', expect.stringContaining('new-key'));
        
        // Verify visual feedback loop
        expect(screen.getByText('Saved!')).not.toBeNull();
    });
});

/**
 * Tests for Sidebar component.
 * Verifies navigation items, branding, and model selector display.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

// Mock Next.js hooks
vi.mock('next/link', () => ({
    default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));
vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/'),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock ModelContext
const mockSetLlmModel = vi.fn();
vi.mock('@/contexts/ModelContext', () => ({
    useModels: () => ({
        llmModel: { id: 'claude-4-opus-20250514', name: 'Claude 4.5 Opus', provider: 'Anthropic' },
        setLlmModel: mockSetLlmModel,
    }),
    LLM_MODELS: [
        { id: 'claude-4-opus-20250514', name: 'Claude 4.5 Opus', provider: 'Anthropic', type: 'llm' },
        { id: 'gemini-3.0-pro', name: 'Gemini 3.0 Pro', provider: 'Google', type: 'llm' },
    ],
}));

import Sidebar from '../Sidebar';

describe('Sidebar', () => {
    it('renders the app branding', () => {
        const { container } = render(<Sidebar />);
        expect(container.textContent).toContain('NARRATIVE');
        expect(container.textContent).toContain('REACTOR');
    });

    it('shows system online indicator', () => {
        const { container } = render(<Sidebar />);
        expect(container.textContent).toContain('System Online');
    });

    it('renders key navigation items', () => {
        const { container } = render(<Sidebar />);
        expect(container.textContent).toContain('Dashboard');
        expect(container.textContent).toContain('Generator');
        expect(container.textContent).toContain('Story Bible');
        expect(container.textContent).toContain('Integrations');
        expect(container.textContent).toContain('Assets');
        expect(container.textContent).toContain('Settings');
    });

    it('renders nav items as links with correct hrefs', () => {
        const { container } = render(<Sidebar />);
        const links = container.querySelectorAll('a');
        const hrefs = Array.from(links).map(a => a.getAttribute('href'));
        expect(hrefs).toContain('/generator');
        expect(hrefs).toContain('/settings');
        expect(hrefs).toContain('/assets');
    });

    it('includes external documentation link', () => {
        const { container } = render(<Sidebar />);
        const links = container.querySelectorAll('a');
        const docLink = Array.from(links).find(a => a.getAttribute('href')?.includes('github.io'));
        expect(docLink).toBeTruthy();
    });

    it('displays current model label and name', () => {
        const { container } = render(<Sidebar />);
        expect(container.textContent).toContain('CURRENT MODEL');
        expect(container.textContent).toContain('Claude 4.5 Opus');
    });

    it('toggles model dropdown on click to reveal options', () => {
        const { container } = render(<Sidebar />);

        // Before click, the dropdown should be closed - Gemini 3.0 Pro should not be visible
        expect(container.textContent).not.toContain('Gemini 3.0 Pro');

        // Find and click the model selector (the div with cursor-pointer class)
        const modelSelector = container.querySelector('[class*="cursor-pointer"]');
        expect(modelSelector).toBeTruthy();
        fireEvent.click(modelSelector!);

        // After click, alternative model should appear in the dropdown
        expect(container.textContent).toContain('Gemini 3.0 Pro');
    });
});

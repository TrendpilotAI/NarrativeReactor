/**
 * Tests for ContentCard component.
 * Verifies rendering, action buttons, and callback invocations.
 * Uses container queries to handle Radix UI components that may render duplicate DOM.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ContentCard, ContentItem } from '../content-card';

// Mock react-markdown to avoid ESM issues in jsdom 
vi.mock('react-markdown', () => ({
    default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));
vi.mock('remark-gfm', () => ({ default: () => { } }));

const mockItem: ContentItem = {
    id: 'card-1',
    type: 'twitter',
    title: 'Maya Discovery Post',
    content: 'Maya stared at the screen. The signal was clear. #SignalStudio',
    status: 'draft',
    complianceScore: 85,
    complianceReasons: ['Tone is appropriate'],
    lastUpdated: '2026-01-15T10:00:00Z',
};

describe('ContentCard', () => {
    it('renders card title and content', () => {
        render(<ContentCard item={mockItem} />);
        expect(screen.getByText('Maya Discovery Post')).toBeInTheDocument();
        expect(screen.getByText(mockItem.content)).toBeInTheDocument();
    });

    it('renders the platform icon for twitter', () => {
        const { container } = render(<ContentCard item={mockItem} />);
        expect(container.textContent).toContain('🐦');
    });

    it('renders status badge text', () => {
        const { container } = render(<ContentCard item={mockItem} />);
        expect(container.textContent).toContain('draft');
    });

    it('renders compliance score', () => {
        const { container } = render(<ContentCard item={mockItem} />);
        expect(container.textContent).toContain('85%');
    });

    it('shows Edit and Approve buttons for draft status', () => {
        const { container } = render(<ContentCard item={mockItem} />);
        const buttons = container.querySelectorAll('button');
        const buttonTexts = Array.from(buttons).map(b => b.textContent);
        expect(buttonTexts.some(t => t?.includes('Edit'))).toBe(true);
        expect(buttonTexts.some(t => t?.includes('Approve'))).toBe(true);
    });

    it('hides Edit/Approve buttons for approved status', () => {
        const approvedItem = { ...mockItem, status: 'approved' as const };
        const { container } = render(<ContentCard item={approvedItem} />);
        const buttons = container.querySelectorAll('button');
        const buttonTexts = Array.from(buttons).map(b => b.textContent);
        expect(buttonTexts.some(t => t?.includes('Edit'))).toBe(false);
        expect(buttonTexts.some(t => t?.includes('Approve') && !t?.includes('Ready'))).toBe(false);
        expect(container.textContent).toContain('Ready to Publish');
    });

    it('calls onApprove when Approve button is clicked', () => {
        const onApprove = vi.fn();
        const { container } = render(<ContentCard item={mockItem} onApprove={onApprove} />);
        const buttons = container.querySelectorAll('button');
        const approveButton = Array.from(buttons).find(b => b.textContent?.includes('Approve'));
        expect(approveButton).toBeTruthy();
        fireEvent.click(approveButton!);
        expect(onApprove).toHaveBeenCalledWith('card-1');
    });

    it('calls onEdit when Edit button is clicked', () => {
        const onEdit = vi.fn();
        const { container } = render(<ContentCard item={mockItem} onEdit={onEdit} />);
        const buttons = container.querySelectorAll('button');
        const editButton = Array.from(buttons).find(b => b.textContent?.includes('Edit'));
        expect(editButton).toBeTruthy();
        fireEvent.click(editButton!);
        expect(onEdit).toHaveBeenCalledWith('card-1');
    });

    it('renders platform icons for different types', () => {
        const { container, rerender } = render(<ContentCard item={{ ...mockItem, type: 'linkedin' }} />);
        expect(container.textContent).toContain('💼');

        rerender(<ContentCard item={{ ...mockItem, type: 'threads' }} />);
        expect(container.textContent).toContain('🧵');

        rerender(<ContentCard item={{ ...mockItem, type: 'image-prompt' }} />);
        expect(container.textContent).toContain('🎨');
    });

    it('formats the last updated date', () => {
        const { container } = render(<ContentCard item={mockItem} />);
        expect(container.textContent).toContain('Updated:');
    });
});

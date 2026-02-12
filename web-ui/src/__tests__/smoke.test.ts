/**
 * Smoke test to verify the frontend test infrastructure is working correctly.
 * This file can be removed once real component tests are added.
 */
import { describe, it, expect } from 'vitest';

describe('Frontend Test Infrastructure', () => {
    it('vitest is configured and running', () => {
        expect(true).toBe(true);
    });

    it('jsdom environment is available', () => {
        expect(typeof document).toBe('object');
        expect(typeof window).toBe('object');
    });
});

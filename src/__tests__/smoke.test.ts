/**
 * Smoke test to verify the test infrastructure is working correctly.
 * This file can be removed once real tests are added.
 */
import { describe, it, expect } from 'vitest';

describe('Test Infrastructure', () => {
    it('vitest is configured and running', () => {
        expect(true).toBe(true);
    });

    it('environment variables are set from setup.ts', () => {
        expect(process.env.NODE_ENV).toBe('test');
        expect(process.env.ANTHROPIC_API_KEY).toBe('test-anthropic-key');
        expect(process.env.FAL_KEY).toBe('test-fal-key');
    });
});

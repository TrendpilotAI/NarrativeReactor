/**
 * Tests: Health endpoint + Production guard
 *
 * Health endpoint: GET /health → { status: "ok", timestamp: ... }
 * Production guard: guardDestructive() throws when NODE_ENV=production
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';

// ── Health endpoint ────────────────────────────────────────────────

describe('GET /health', () => {
    it('returns 200 with status ok and timestamp', async () => {
        // Build a minimal app that mirrors the real one
        const app = express();
        app.get('/health', (_req, res) => {
            res.json({ status: 'ok', service: 'NarrativeReactor', timestamp: new Date().toISOString() });
        });

        // Use node's http module to avoid supertest dependency
        const { createServer } = await import('http');
        const server = createServer(app);

        await new Promise<void>((resolve) => server.listen(0, resolve));
        const port = (server.address() as any).port;

        const response = await fetch(`http://localhost:${port}/health`);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('ok');
        expect(body.timestamp).toBeDefined();
        // Basic ISO 8601 shape check
        expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);

        await new Promise<void>((resolve, reject) =>
            server.close((err) => (err ? reject(err) : resolve()))
        );
    });

    it('health endpoint is not affected by missing auth headers', async () => {
        const app = express();
        // Simulate auth middleware on /api/* only
        app.use('/api', (_req, res) => {
            res.status(401).json({ error: 'Unauthorized' });
        });
        app.get('/health', (_req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        const { createServer } = await import('http');
        const server = createServer(app);
        await new Promise<void>((resolve) => server.listen(0, resolve));
        const port = (server.address() as any).port;

        const response = await fetch(`http://localhost:${port}/health`);
        expect(response.status).toBe(200);

        await new Promise<void>((resolve, reject) =>
            server.close((err) => (err ? reject(err) : resolve()))
        );
    });
});

// ── Production guard ───────────────────────────────────────────────

describe('productionGuard', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
    });

    it('throws ProductionGuardError when NODE_ENV=production', async () => {
        process.env.NODE_ENV = 'production';
        const { guardDestructive, ProductionGuardError } = await import('../lib/productionGuard');

        expect(() => guardDestructive('wipe content library')).toThrowError(ProductionGuardError);
        expect(() => guardDestructive('wipe content library')).toThrow(
            /blocked in production/
        );
    });

    it('does NOT throw when NODE_ENV=development', async () => {
        process.env.NODE_ENV = 'development';
        const { guardDestructive } = await import('../lib/productionGuard');

        expect(() => guardDestructive('wipe content library')).not.toThrow();
    });

    it('does NOT throw when NODE_ENV=test', async () => {
        process.env.NODE_ENV = 'test';
        const { guardDestructive } = await import('../lib/productionGuard');

        expect(() => guardDestructive('wipe content library')).not.toThrow();
    });

    it('error message includes the operation name', async () => {
        process.env.NODE_ENV = 'production';
        const { guardDestructive } = await import('../lib/productionGuard');

        expect(() => guardDestructive('drop database')).toThrow(/drop database/);
    });

    it('isProduction() returns true when NODE_ENV=production', async () => {
        process.env.NODE_ENV = 'production';
        const { isProduction } = await import('../lib/productionGuard');
        expect(isProduction()).toBe(true);
    });

    it('isProduction() returns false when NODE_ENV=development', async () => {
        process.env.NODE_ENV = 'development';
        const { isProduction } = await import('../lib/productionGuard');
        expect(isProduction()).toBe(false);
    });
});

// ── /api/admin/wipe route integration ─────────────────────────────

describe('POST /api/admin/wipe (production guard integration)', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
    });

    async function buildApp() {
        const app = express();
        app.use(express.json());

        // Inline the route to avoid heavy import chain
        const { guardDestructive } = await import('../lib/productionGuard');
        app.post('/api/admin/wipe', (_req, res) => {
            try {
                guardDestructive('wipe content library');
                res.json({ status: 'wiped' });
            } catch (err: any) {
                res.status(403).json({ error: err.message });
            }
        });
        return app;
    }

    it('returns 403 when NODE_ENV=production', async () => {
        process.env.NODE_ENV = 'production';
        const app = await buildApp();
        const { createServer } = await import('http');
        const server = createServer(app);
        await new Promise<void>((resolve) => server.listen(0, resolve));
        const port = (server.address() as any).port;

        const response = await fetch(`http://localhost:${port}/api/admin/wipe`, { method: 'POST' });
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error).toMatch(/blocked in production/);

        await new Promise<void>((resolve, reject) =>
            server.close((err) => (err ? reject(err) : resolve()))
        );
    });

    it('returns 200 when NODE_ENV=development', async () => {
        process.env.NODE_ENV = 'development';
        const app = await buildApp();
        const { createServer } = await import('http');
        const server = createServer(app);
        await new Promise<void>((resolve) => server.listen(0, resolve));
        const port = (server.address() as any).port;

        const response = await fetch(`http://localhost:${port}/api/admin/wipe`, { method: 'POST' });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('wiped');

        await new Promise<void>((resolve, reject) =>
            server.close((err) => (err ? reject(err) : resolve()))
        );
    });
});

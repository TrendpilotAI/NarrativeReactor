/**
 * @file cors-security.test.ts
 * @description Security tests for CORS allowlist enforcement.
 *
 * Verifies that:
 * 1. In production mode (NODE_ENV=production) without CORS_ALLOWED_ORIGINS,
 *    cross-origin browser requests are rejected.
 * 2. In production mode WITH CORS_ALLOWED_ORIGINS, only allowlisted origins pass.
 * 3. In development mode without env var, all origins are permitted.
 * 4. Server-to-server requests (no Origin header) always pass.
 * 5. Wildcard '*' is never used.
 */

import request from 'supertest';
import { createApp } from '../app';

const originalEnv = { ...process.env };

afterEach(() => {
    // Restore env after each test
    process.env = { ...originalEnv };
});

describe('CORS security: origin allowlist enforcement', () => {
    describe('Production mode (NODE_ENV=production)', () => {
        it('should reject requests from unlisted origins when CORS_ALLOWED_ORIGINS is set', async () => {
            process.env.NODE_ENV = 'production';
            process.env.CORS_ALLOWED_ORIGINS = 'https://app.narrativereactor.com,https://admin.narrativereactor.com';

            const app = createApp({ rateLimitMax: 10000 });
            const res = await request(app)
                .get('/health')
                .set('Origin', 'https://evil-attacker.com');

            // Supertest follows CORS preflight; a rejected origin will have no
            // Access-Control-Allow-Origin header set.
            const acaoHeader = res.headers['access-control-allow-origin'];
            expect(acaoHeader).not.toBe('https://evil-attacker.com');
            expect(acaoHeader).not.toBe('*');
        });

        it('should allow requests from allowlisted origins', async () => {
            process.env.NODE_ENV = 'production';
            process.env.CORS_ALLOWED_ORIGINS = 'https://app.narrativereactor.com,https://admin.narrativereactor.com';

            const app = createApp({ rateLimitMax: 10000 });
            const res = await request(app)
                .get('/health')
                .set('Origin', 'https://app.narrativereactor.com');

            expect(res.headers['access-control-allow-origin']).toBe('https://app.narrativereactor.com');
            expect(res.status).toBe(200);
        });

        it('should allow the second allowlisted origin', async () => {
            process.env.NODE_ENV = 'production';
            process.env.CORS_ALLOWED_ORIGINS = 'https://app.narrativereactor.com,https://admin.narrativereactor.com';

            const app = createApp({ rateLimitMax: 10000 });
            const res = await request(app)
                .get('/health')
                .set('Origin', 'https://admin.narrativereactor.com');

            expect(res.headers['access-control-allow-origin']).toBe('https://admin.narrativereactor.com');
        });

        it('should block requests from unlisted origins even without CORS_ALLOWED_ORIGINS env var', async () => {
            process.env.NODE_ENV = 'production';
            delete process.env.CORS_ALLOWED_ORIGINS;

            const app = createApp({ rateLimitMax: 10000 });
            const res = await request(app)
                .get('/health')
                .set('Origin', 'https://any-origin.com');

            // No CORS_ALLOWED_ORIGINS + production = block all browser origins
            const acaoHeader = res.headers['access-control-allow-origin'];
            expect(acaoHeader).not.toBe('https://any-origin.com');
            expect(acaoHeader).not.toBe('*');
        });

        it('should never respond with wildcard Access-Control-Allow-Origin', async () => {
            process.env.NODE_ENV = 'production';
            process.env.CORS_ALLOWED_ORIGINS = 'https://app.narrativereactor.com';

            const app = createApp({ rateLimitMax: 10000 });
            const res = await request(app)
                .get('/health')
                .set('Origin', 'https://app.narrativereactor.com');

            expect(res.headers['access-control-allow-origin']).not.toBe('*');
        });
    });

    describe('Development mode (NODE_ENV=development)', () => {
        it('should allow all origins when CORS_ALLOWED_ORIGINS is not set', async () => {
            process.env.NODE_ENV = 'development';
            delete process.env.CORS_ALLOWED_ORIGINS;

            const app = createApp({ rateLimitMax: 10000 });
            const res = await request(app)
                .get('/health')
                .set('Origin', 'http://localhost:3000');

            expect(res.status).toBe(200);
            // In dev mode, any origin is reflected back
            expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
        });

        it('should still enforce allowlist in dev if CORS_ALLOWED_ORIGINS is set', async () => {
            process.env.NODE_ENV = 'development';
            process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';

            const app = createApp({ rateLimitMax: 10000 });
            const res = await request(app)
                .get('/health')
                .set('Origin', 'http://localhost:9999');

            const acaoHeader = res.headers['access-control-allow-origin'];
            expect(acaoHeader).not.toBe('http://localhost:9999');
        });
    });

    describe('Server-to-server (no Origin header)', () => {
        it('should always allow requests without Origin header (server-to-server)', async () => {
            process.env.NODE_ENV = 'production';
            process.env.CORS_ALLOWED_ORIGINS = 'https://app.narrativereactor.com';

            const app = createApp({ rateLimitMax: 10000 });
            // No Origin header = server-to-server call (not a browser request)
            const res = await request(app).get('/health');

            expect(res.status).toBe(200);
        });
    });

    describe('CORS preflight (OPTIONS) handling', () => {
        it('should respond to OPTIONS preflight from allowlisted origin', async () => {
            process.env.NODE_ENV = 'production';
            process.env.CORS_ALLOWED_ORIGINS = 'https://app.narrativereactor.com';

            const app = createApp({ rateLimitMax: 10000 });
            const res = await request(app)
                .options('/health')
                .set('Origin', 'https://app.narrativereactor.com')
                .set('Access-Control-Request-Method', 'GET');

            expect(res.headers['access-control-allow-origin']).toBe('https://app.narrativereactor.com');
        });

        it('should set Access-Control-Allow-Credentials when origin is allowed', async () => {
            process.env.NODE_ENV = 'production';
            process.env.CORS_ALLOWED_ORIGINS = 'https://app.narrativereactor.com';

            const app = createApp({ rateLimitMax: 10000 });
            const res = await request(app)
                .options('/health')
                .set('Origin', 'https://app.narrativereactor.com')
                .set('Access-Control-Request-Method', 'GET');

            expect(res.headers['access-control-allow-credentials']).toBe('true');
        });
    });
});

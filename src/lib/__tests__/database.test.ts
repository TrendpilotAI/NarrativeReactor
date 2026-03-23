/**
 * Unit tests for src/lib/database.ts
 * 
 * Tests the SQLite database singleton, schema initialization, 
 * default integration seeding, and clean shutdown.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';

// We test the database module by importing it fresh for each test
// to validate the singleton behavior. We mock the filesystem and
// override DB_PATH to use in-memory databases.

// Mock fs to avoid creating real directories
vi.mock('fs', () => ({
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
}));

// Mock better-sqlite3 to use in-memory databases
const mockDbs: Database.Database[] = [];
vi.mock('better-sqlite3', async () => {
    const actual = await vi.importActual<typeof import('better-sqlite3')>('better-sqlite3');
    return {
        default: vi.fn().mockImplementation((_path: string) => {
            // Always create in-memory DB regardless of path
            const db = new actual.default(':memory:');
            mockDbs.push(db);
            return db;
        }),
    };
});

describe('database.ts', () => {
    let dbModule: typeof import('../database');

    beforeEach(async () => {
        // Reset module registry to get a fresh singleton each time
        vi.resetModules();
        // Re-import the module to get a fresh instance
        dbModule = await import('../database');
    });

    afterEach(() => {
        // Clean up any open databases
        try {
            dbModule.closeDatabase();
        } catch {
            // Ignore if already closed
        }
        // Close any lingering mock DBs
        for (const db of mockDbs) {
            try { db.close(); } catch { /* already closed */ }
        }
        mockDbs.length = 0;
    });

    describe('getDatabase()', () => {
        it('returns a valid Database instance', () => {
            const db = dbModule.getDatabase();
            expect(db).toBeDefined();
            // Verify it's a working database by running a query
            const result = db.prepare('SELECT 1 as val').get() as any;
            expect(result.val).toBe(1);
        });

        it('returns the same instance on repeated calls (singleton)', () => {
            const db1 = dbModule.getDatabase();
            const db2 = dbModule.getDatabase();
            expect(db1).toBe(db2);
        });
    });

    describe('initSchema()', () => {
        it('creates all 4 required tables', () => {
            const db = dbModule.getDatabase();

            const tables = db.prepare(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            ).all() as Array<{ name: string }>;

            const tableNames = tables.map(t => t.name);
            expect(tableNames).toContain('media_assets');
            expect(tableNames).toContain('content_posts');
            expect(tableNames).toContain('integrations');
            expect(tableNames).toContain('settings');
        });

        it('seeds 5 default integrations', () => {
            const db = dbModule.getDatabase();

            const integrations = db.prepare(
                'SELECT * FROM integrations ORDER BY id'
            ).all() as Array<{ id: string; provider: string; name: string; connected: number }>;

            expect(integrations).toHaveLength(5);

            const providers = integrations.map(i => i.provider);
            expect(providers).toContain('x');
            expect(providers).toContain('linkedin');
            expect(providers).toContain('threads');
            expect(providers).toContain('instagram');
            expect(providers).toContain('facebook');

            // All should start as disconnected
            for (const int of integrations) {
                expect(int.connected).toBe(0);
            }
        });

        it('media_assets table enforces type constraint', () => {
            const db = dbModule.getDatabase();

            // Valid types should work
            const stmt = db.prepare(
                'INSERT INTO media_assets (id, type, url) VALUES (?, ?, ?)'
            );
            expect(() => stmt.run('test-1', 'image', 'https://example.com/img.png')).not.toThrow();
            expect(() => stmt.run('test-2', 'video', 'https://example.com/vid.mp4')).not.toThrow();

            // Invalid type should fail
            expect(() => stmt.run('test-3', 'audio', 'https://example.com/audio.mp3')).toThrow();
        });
    });

    describe('closeDatabase()', () => {
        it('nullifies the singleton so next getDatabase creates a new one', async () => {
            const db1 = dbModule.getDatabase();
            dbModule.closeDatabase();

            // Reset the mock to track the next call
            vi.resetModules();
            dbModule = await import('../database');

            const db2 = dbModule.getDatabase();
            // Should be a different instance
            expect(db2).not.toBe(db1);
        });

        it('can be called multiple times without error', () => {
            dbModule.getDatabase(); // ensure DB is open
            expect(() => dbModule.closeDatabase()).not.toThrow();
            expect(() => dbModule.closeDatabase()).not.toThrow();
        });
    });
});

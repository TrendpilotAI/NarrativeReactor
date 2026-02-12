/**
 * In-memory SQLite database helper for tests.
 * 
 * Usage:
 * ```ts
 * import { setupTestDb, resetTestDb, closeTestDb } from '../helpers/mock-db';
 * 
 * beforeAll(() => setupTestDb());
 * afterEach(() => resetTestDb());
 * afterAll(() => closeTestDb());
 * ```
 */
import Database from 'better-sqlite3';
import { vi } from 'vitest';

let testDb: Database.Database | null = null;

/**
 * Creates an in-memory SQLite database with the same schema as production.
 * Also mocks `../lib/database` so that `getDatabase()` returns this test DB.
 */
export function setupTestDb(): Database.Database {
    testDb = new Database(':memory:');
    testDb.pragma('journal_mode = WAL');
    initTestSchema(testDb);
    return testDb;
}

/**
 * Clears all data from all tables, preserving schema.
 */
export function resetTestDb(): void {
    if (!testDb) return;
    testDb.exec('DELETE FROM media_assets');
    testDb.exec('DELETE FROM content_posts');
    testDb.exec('DELETE FROM integrations');
    testDb.exec('DELETE FROM settings');
    // Re-seed default integrations
    seedDefaultIntegrations(testDb);
}

/**
 * Closes the in-memory database.
 */
export function closeTestDb(): void {
    if (testDb) {
        testDb.close();
        testDb = null;
    }
}

/**
 * Returns the current test database instance.
 */
export function getTestDb(): Database.Database {
    if (!testDb) {
        throw new Error('Test database not initialized. Call setupTestDb() first.');
    }
    return testDb;
}

/**
 * Creates the mock for the database module.
 * Use with: vi.mock('../../lib/database', () => createDatabaseMock());
 */
export function createDatabaseMock() {
    return {
        getDatabase: () => {
            if (!testDb) {
                testDb = setupTestDb();
            }
            return testDb;
        },
        closeDatabase: () => closeTestDb(),
    };
}

function initTestSchema(db: Database.Database) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS media_assets (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL CHECK(type IN ('image', 'video')),
            url TEXT NOT NULL,
            prompt TEXT,
            model_id TEXT,
            cost REAL,
            duration REAL,
            created_at TEXT DEFAULT (datetime('now')),
            metadata TEXT
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS content_posts (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL CHECK(type IN ('twitter', 'linkedin', 'threads', 'instagram', 'facebook', 'image-prompt')),
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'pending_approval', 'approved', 'published', 'rejected')),
            compliance_score INTEGER,
            compliance_reasons TEXT,
            media_ids TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS integrations (
            id TEXT PRIMARY KEY,
            provider TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            connected INTEGER DEFAULT 0,
            username TEXT,
            access_token TEXT,
            refresh_token TEXT,
            token_expires_at TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

    seedDefaultIntegrations(db);
}

function seedDefaultIntegrations(db: Database.Database) {
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO integrations (id, provider, name, connected)
        VALUES (?, ?, ?, 0)
    `);

    const integrations = [
        { id: 'x', provider: 'x', name: 'X (Twitter)' },
        { id: 'linkedin', provider: 'linkedin', name: 'LinkedIn' },
        { id: 'threads', provider: 'threads', name: 'Threads' },
        { id: 'instagram', provider: 'instagram', name: 'Instagram' },
        { id: 'facebook', provider: 'facebook', name: 'Facebook' },
    ];

    for (const int of integrations) {
        stmt.run(int.id, int.provider, int.name);
    }
}

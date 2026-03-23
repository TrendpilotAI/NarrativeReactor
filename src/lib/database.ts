import Database from 'better-sqlite3';
import path from 'path';

// Database file location (in project root)
const DB_PATH = path.join(process.cwd(), 'data', 'narrative-reactor.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
    if (!db) {
        // Ensure data directory exists
        const fs = require('fs');
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');

        // Initialize schema
        initSchema(db);
    }
    return db;
}

function initSchema(db: Database.Database) {
    // Media Assets table
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

    // Content Posts table
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

    // Social Integrations table
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

    // Settings table
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

    // Initialize default integrations if not present
    const integrationStmt = db.prepare(`
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
        integrationStmt.run(int.id, int.provider, int.name);
    }
}

export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}

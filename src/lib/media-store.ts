import { getDatabase } from './database';
import { randomUUID } from 'crypto';

export interface MediaAsset {
    id: string;
    type: 'image' | 'video';
    url: string;
    prompt?: string;
    modelId?: string;
    cost?: number;
    duration?: number;
    createdAt: string;
    metadata?: Record<string, any>;
}

export class MediaStore {
    static save(asset: Omit<MediaAsset, 'id' | 'createdAt'>): MediaAsset {
        const db = getDatabase();
        const id = randomUUID();
        const createdAt = new Date().toISOString();

        const stmt = db.prepare(`
            INSERT INTO media_assets (id, type, url, prompt, model_id, cost, duration, created_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            id,
            asset.type,
            asset.url,
            asset.prompt || null,
            asset.modelId || null,
            asset.cost || null,
            asset.duration || null,
            createdAt,
            asset.metadata ? JSON.stringify(asset.metadata) : null
        );

        return { id, createdAt, ...asset };
    }

    static getAll(type?: 'image' | 'video'): MediaAsset[] {
        const db = getDatabase();
        let query = 'SELECT * FROM media_assets ORDER BY created_at DESC';
        if (type) {
            query = `SELECT * FROM media_assets WHERE type = ? ORDER BY created_at DESC`;
        }

        const stmt = type ? db.prepare(query) : db.prepare(query);
        const rows = type ? stmt.all(type) : stmt.all();

        return (rows as any[]).map(row => ({
            id: row.id,
            type: row.type,
            url: row.url,
            prompt: row.prompt,
            modelId: row.model_id,
            cost: row.cost,
            duration: row.duration,
            createdAt: row.created_at,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined
        }));
    }

    static getById(id: string): MediaAsset | null {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM media_assets WHERE id = ?');
        const row = stmt.get(id) as any;

        if (!row) return null;

        return {
            id: row.id,
            type: row.type,
            url: row.url,
            prompt: row.prompt,
            modelId: row.model_id,
            cost: row.cost,
            duration: row.duration,
            createdAt: row.created_at,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined
        };
    }

    static delete(id: string): boolean {
        const db = getDatabase();
        const stmt = db.prepare('DELETE FROM media_assets WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}

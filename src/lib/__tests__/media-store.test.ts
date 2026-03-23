/**
 * Unit tests for src/lib/media-store.ts
 * 
 * Tests the MediaStore class — CRUD operations for media assets 
 * (images and videos) backed by SQLite.
 * 
 * Uses an in-memory SQLite database for speed and isolation.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { setupTestDb, resetTestDb, closeTestDb, createDatabaseMock } from '../../__tests__/helpers/mock-db';

// Mock the database module to use our in-memory test DB
vi.mock('../database', () => createDatabaseMock());

// Mock crypto.randomUUID to return predictable IDs
let uuidCounter = 0;
vi.mock('crypto', () => ({
    randomUUID: () => `test-uuid-${++uuidCounter}`,
}));

import { MediaStore, MediaAsset } from '../media-store';

describe('MediaStore', () => {
    beforeAll(() => {
        setupTestDb();
    });

    beforeEach(() => {
        resetTestDb();
        uuidCounter = 0;
    });

    afterAll(() => {
        closeTestDb();
    });

    describe('save()', () => {
        it('creates a new asset with generated id and timestamp', () => {
            const result = MediaStore.save({
                type: 'image',
                url: 'https://example.com/image.png',
            });

            expect(result.id).toBe('test-uuid-1');
            expect(result.type).toBe('image');
            expect(result.url).toBe('https://example.com/image.png');
            expect(result.createdAt).toBeDefined();
            // Verify ISO format
            expect(new Date(result.createdAt).toISOString()).toBe(result.createdAt);
        });

        it('persists all fields including nullable ones', () => {
            const result = MediaStore.save({
                type: 'video',
                url: 'https://example.com/video.mp4',
                prompt: 'A cinematic sunset',
                modelId: 'fal-ai/seedance',
                cost: 0.05,
                duration: 12.5,
            });

            expect(result.prompt).toBe('A cinematic sunset');
            expect(result.modelId).toBe('fal-ai/seedance');
            expect(result.cost).toBe(0.05);
            expect(result.duration).toBe(12.5);

            // Verify it was actually persisted to DB
            const retrieved = MediaStore.getById(result.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.prompt).toBe('A cinematic sunset');
            expect(retrieved!.cost).toBe(0.05);
        });

        it('stores metadata as JSON string and roundtrips correctly', () => {
            const metadata = { tags: ['hero', 'sunset'], resolution: '1080p' };

            const result = MediaStore.save({
                type: 'image',
                url: 'https://example.com/image.png',
                metadata,
            });

            const retrieved = MediaStore.getById(result.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.metadata).toEqual(metadata);
            expect(retrieved!.metadata!.tags).toEqual(['hero', 'sunset']);
        });
    });

    describe('getAll()', () => {
        beforeEach(() => {
            // Seed some test data
            MediaStore.save({ type: 'image', url: 'https://example.com/img1.png' });
            MediaStore.save({ type: 'video', url: 'https://example.com/vid1.mp4' });
            MediaStore.save({ type: 'image', url: 'https://example.com/img2.png' });
        });

        it('returns all assets when no filter is provided', () => {
            const assets = MediaStore.getAll();
            expect(assets).toHaveLength(3);
            // Verify all three URLs are present
            const urls = assets.map(a => a.url);
            expect(urls).toContain('https://example.com/img1.png');
            expect(urls).toContain('https://example.com/vid1.mp4');
            expect(urls).toContain('https://example.com/img2.png');
        });

        it('filters by image type', () => {
            const images = MediaStore.getAll('image');
            expect(images).toHaveLength(2);
            images.forEach(img => expect(img.type).toBe('image'));
        });

        it('filters by video type', () => {
            const videos = MediaStore.getAll('video');
            expect(videos).toHaveLength(1);
            expect(videos[0].type).toBe('video');
            expect(videos[0].url).toBe('https://example.com/vid1.mp4');
        });

        it('maps column names correctly (model_id → modelId, created_at → createdAt)', () => {
            // Save with all fields to check mapping
            MediaStore.save({
                type: 'image',
                url: 'https://example.com/mapped.png',
                modelId: 'test-model',
            });

            const assets = MediaStore.getAll();
            const mapped = assets.find(a => a.url.includes('mapped'));
            expect(mapped).toBeDefined();
            expect(mapped!.modelId).toBe('test-model');
            expect(mapped!.createdAt).toBeDefined();
            // Ensure snake_case keys are NOT present
            expect((mapped as any).model_id).toBeUndefined();
            expect((mapped as any).created_at).toBeUndefined();
        });
    });

    describe('getById()', () => {
        it('returns null for non-existent id', () => {
            const result = MediaStore.getById('non-existent-id');
            expect(result).toBeNull();
        });

        it('returns correctly mapped asset for existing id', () => {
            const saved = MediaStore.save({
                type: 'video',
                url: 'https://example.com/vid.mp4',
                prompt: 'Test prompt',
                modelId: 'test-model',
                cost: 1.5,
                duration: 30.0,
            });

            const retrieved = MediaStore.getById(saved.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.id).toBe(saved.id);
            expect(retrieved!.type).toBe('video');
            expect(retrieved!.url).toBe('https://example.com/vid.mp4');
            expect(retrieved!.prompt).toBe('Test prompt');
            expect(retrieved!.modelId).toBe('test-model');
            expect(retrieved!.cost).toBe(1.5);
            expect(retrieved!.duration).toBe(30.0);
            expect(retrieved!.createdAt).toBeDefined();
        });

        it('returns undefined metadata when none was stored', () => {
            const saved = MediaStore.save({
                type: 'image',
                url: 'https://example.com/img.png',
            });

            const retrieved = MediaStore.getById(saved.id);
            expect(retrieved!.metadata).toBeUndefined();
        });
    });

    describe('delete()', () => {
        it('returns true and removes an existing asset', () => {
            const saved = MediaStore.save({
                type: 'image',
                url: 'https://example.com/img.png',
            });

            const result = MediaStore.delete(saved.id);
            expect(result).toBe(true);

            // Verify it's actually gone
            const retrieved = MediaStore.getById(saved.id);
            expect(retrieved).toBeNull();
        });

        it('returns false for non-existent id', () => {
            const result = MediaStore.delete('non-existent-id');
            expect(result).toBe(false);
        });

        it('does not affect other assets when deleting one', () => {
            const saved1 = MediaStore.save({ type: 'image', url: 'https://example.com/img1.png' });
            const saved2 = MediaStore.save({ type: 'image', url: 'https://example.com/img2.png' });

            MediaStore.delete(saved1.id);

            // saved2 should still exist
            const retrieved = MediaStore.getById(saved2.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.url).toBe('https://example.com/img2.png');

            // Total should be 1
            const all = MediaStore.getAll();
            expect(all).toHaveLength(1);
        });
    });
});

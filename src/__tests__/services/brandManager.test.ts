/**
 * Tests: Brand Manager service
 */
import { describe, it, expect, vi } from 'vitest';

// Brand manager reads/writes to data/brands.json using process.cwd() at module load.
// We test the actual module against the real data/ dir but use unique names
// to avoid collisions, and clean up after tests.
import fs from 'fs';
import path from 'path';

const BRANDS_FILE = path.join(process.cwd(), 'data', 'brands.json');

function cleanupBrand(id: string) {
  if (!fs.existsSync(BRANDS_FILE)) return;
  try {
    const data = JSON.parse(fs.readFileSync(BRANDS_FILE, 'utf-8'));
    data.brands = data.brands.filter((b: any) => b.id !== id);
    fs.writeFileSync(BRANDS_FILE, JSON.stringify(data, null, 2));
  } catch {
    // ignore
  }
}

import {
  createBrand,
  getBrand,
  listBrands,
  updateBrand,
  deleteBrand,
} from '../../services/brandManager';

describe('Brand Manager Service', () => {
  const sampleInput = {
    name: `Test Brand ${Date.now()}`,
    guidelines: 'Be professional and innovative and technology-focused',
    voiceTone: 'confident, knowledgeable',
    colors: ['#FF0000', '#00FF00'],
    logos: ['logo.svg'],
    targetAudience: 'Developers',
    prohibitedWords: ['spam', 'clickbait'],
  };

  describe('createBrand', () => {
    it('creates a brand with an ID and timestamps', () => {
      const brand = createBrand(sampleInput);
      try {
        expect(brand.id).toBeDefined();
        expect(brand.name).toBe(sampleInput.name);
        expect(brand.createdAt).toBeDefined();
        expect(brand.updatedAt).toBeDefined();
        expect(brand.prohibitedWords).toContain('spam');
      } finally {
        cleanupBrand(brand.id);
      }
    });

    it('stores and retrieves the brand', () => {
      const brand = createBrand(sampleInput);
      try {
        const found = getBrand(brand.id);
        expect(found).toBeDefined();
        expect(found!.name).toBe(sampleInput.name);
      } finally {
        cleanupBrand(brand.id);
      }
    });
  });

  describe('getBrand', () => {
    it('returns undefined for unknown ID', () => {
      expect(getBrand('does-not-exist-xyz-123')).toBeUndefined();
    });

    it('returns a brand that exists', () => {
      const brand = createBrand(sampleInput);
      try {
        const found = getBrand(brand.id);
        expect(found).toBeDefined();
      } finally {
        cleanupBrand(brand.id);
      }
    });
  });

  describe('listBrands', () => {
    it('returns an array', () => {
      const brands = listBrands();
      expect(Array.isArray(brands)).toBe(true);
    });

    it('includes created brands', () => {
      const brand = createBrand(sampleInput);
      try {
        const brands = listBrands();
        expect(brands.some(b => b.id === brand.id)).toBe(true);
      } finally {
        cleanupBrand(brand.id);
      }
    });
  });

  describe('updateBrand', () => {
    it('updates an existing brand', () => {
      const brand = createBrand(sampleInput);
      try {
        const updated = updateBrand(brand.id, { name: 'Updated Brand Name' });
        expect(updated).toBeDefined();
        expect(updated!.name).toBe('Updated Brand Name');
        expect(updated!.guidelines).toBe(sampleInput.guidelines); // unchanged
      } finally {
        cleanupBrand(brand.id);
      }
    });

    it('returns undefined for unknown brand', () => {
      const result = updateBrand('nonexistent-xyz-999', { name: 'Nope' });
      expect(result).toBeUndefined();
    });
  });

  describe('deleteBrand', () => {
    it('deletes an existing brand', () => {
      const brand = createBrand(sampleInput);
      const deleted = deleteBrand(brand.id);
      expect(deleted).toBe(true);
      expect(getBrand(brand.id)).toBeUndefined();
    });

    it('returns false for unknown brand', () => {
      expect(deleteBrand('does-not-exist-xyz-987')).toBe(false);
    });
  });
});

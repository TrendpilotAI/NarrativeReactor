import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface Brand {
  id: string;
  name: string;
  guidelines: string;
  voiceTone: string;
  colors: string[];
  logos: string[];
  targetAudience: string;
  prohibitedWords: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BrandData {
  brands: Brand[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BRANDS_FILE = path.join(DATA_DIR, 'brands.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): BrandData {
  ensureDataDir();
  if (!fs.existsSync(BRANDS_FILE)) {
    const defaultData: BrandData = {
      brands: [{
        id: 'signal-studio',
        name: 'Signal Studio',
        guidelines: 'Professional, innovative, audience-first content creation.',
        voiceTone: 'confident, knowledgeable, approachable',
        colors: ['#6C5CE7', '#00B894', '#FDCB6E'],
        logos: ['signal-studio-logo.svg'],
        targetAudience: 'Content creators, marketers, and digital storytellers',
        prohibitedWords: ['cheap', 'spam', 'clickbait'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]
    };
    save(defaultData);
    return defaultData;
  }
  try { return JSON.parse(fs.readFileSync(BRANDS_FILE, 'utf-8')); } catch { return { brands: [] }; }
}

function save(data: BrandData): void {
  ensureDataDir();
  fs.writeFileSync(BRANDS_FILE, JSON.stringify(data, null, 2));
}

export function createBrand(config: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>): Brand {
  const data = load();
  const brand: Brand = {
    ...config,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.brands.push(brand);
  save(data);
  return brand;
}

export function getBrand(id: string): Brand | undefined {
  return load().brands.find(b => b.id === id);
}

export function listBrands(): Brand[] {
  return load().brands;
}

export function updateBrand(id: string, updates: Partial<Omit<Brand, 'id' | 'createdAt'>>): Brand | undefined {
  const data = load();
  const idx = data.brands.findIndex(b => b.id === id);
  if (idx === -1) return undefined;
  data.brands[idx] = { ...data.brands[idx], ...updates, updatedAt: new Date().toISOString() };
  save(data);
  return data.brands[idx];
}

export function deleteBrand(id: string): boolean {
  const data = load();
  const len = data.brands.length;
  data.brands = data.brands.filter(b => b.id !== id);
  if (data.brands.length === len) return false;
  save(data);
  return true;
}

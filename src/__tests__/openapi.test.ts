import { describe, it, expect } from 'vitest';
import { spec } from '../openapi';

describe('OpenAPI spec', () => {
  it('has valid openapi version', () => {
    expect(spec.openapi).toBe('3.0.3');
  });

  it('has info block', () => {
    expect(spec.info.title).toBe('NarrativeReactor API');
    expect(spec.info.version).toBeTruthy();
  });

  it('defines security scheme', () => {
    expect(spec.components.securitySchemes.ApiKeyAuth).toBeDefined();
    expect(spec.components.securitySchemes.ApiKeyAuth.type).toBe('apiKey');
  });

  it('has health endpoint without security', () => {
    const health = spec.paths['/health'];
    expect(health).toBeDefined();
    expect(health.get.security).toEqual([]);
  });

  it('has all major endpoint groups', () => {
    const paths = Object.keys(spec.paths);
    expect(paths).toContain('/api/pipeline/generate');
    expect(paths).toContain('/api/campaigns');
    expect(paths).toContain('/api/brands');
    expect(paths).toContain('/api/social/post');
    expect(paths).toContain('/api/calendar');
    expect(paths).toContain('/api/costs');
    expect(paths).toContain('/api/audio/tts');
  });

  it('has all tags defined', () => {
    const tagNames = spec.tags.map((t: any) => t.name);
    expect(tagNames).toContain('System');
    expect(tagNames).toContain('Content Pipeline');
    expect(tagNames).toContain('Campaigns');
    expect(tagNames).toContain('Brands');
    expect(tagNames).toContain('Social');
  });

  it('every path has at least one method', () => {
    for (const [path, methods] of Object.entries(spec.paths)) {
      const methodKeys = Object.keys(methods as object);
      expect(methodKeys.length).toBeGreaterThan(0);
    }
  });
});

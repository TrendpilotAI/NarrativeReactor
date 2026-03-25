/**
 * Tests: Audience Persona service
 */
import { describe, it, expect } from 'vitest';
import { getDefaultPersonas, buildPersona } from '../../services/audiencePersona';

describe('Audience Persona Service', () => {
  describe('getDefaultPersonas', () => {
    it('returns an array of personas', () => {
      const personas = getDefaultPersonas();
      expect(Array.isArray(personas)).toBe(true);
      expect(personas.length).toBeGreaterThan(0);
    });

    it('each persona has required fields', () => {
      const personas = getDefaultPersonas();
      for (const p of personas) {
        expect(p.id).toBeDefined();
        expect(p.name).toBeDefined();
        expect(p.demographics).toBeDefined();
        expect(Array.isArray(p.interests)).toBe(true);
        expect(Array.isArray(p.activeHours)).toBe(true);
        expect(Array.isArray(p.preferredContentTypes)).toBe(true);
        expect(p.engagementPatterns).toBeDefined();
      }
    });

    it('includes tech professional persona', () => {
      const personas = getDefaultPersonas();
      expect(personas.some(p => p.id === 'persona_tech_professional')).toBe(true);
    });

    it('includes startup founder persona', () => {
      const personas = getDefaultPersonas();
      expect(personas.some(p => p.id === 'persona_startup_founder')).toBe(true);
    });
  });

  describe('buildPersona', () => {
    it('builds a persona from engagement data', () => {
      const persona = buildPersona({
        ageGroups: { '25-34': 40, '35-44': 30, '18-24': 30 },
        locations: { 'United States': 60, 'Canada': 20, 'UK': 20 },
        activeHourCounts: { 9: 100, 10: 80, 12: 120, 17: 90 },
      });
      expect(persona).toBeDefined();
      expect(persona.demographics).toBeDefined();
      expect(persona.activeHours.length).toBeGreaterThan(0);
    });

    it('handles minimal engagement data', () => {
      const persona = buildPersona({});
      expect(persona).toBeDefined();
    });

    it('picks the top age group', () => {
      const persona = buildPersona({
        ageGroups: { '18-24': 10, '25-34': 80, '35-44': 10 },
      });
      expect(persona.demographics.ageRange).toContain('25-34');
    });

    it('picks the top location', () => {
      const persona = buildPersona({
        locations: { 'United States': 90, 'UK': 10 },
      });
      expect(persona.demographics.location).toContain('United States');
    });

    it('identifies top active hours', () => {
      const persona = buildPersona({
        activeHourCounts: {
          9: 50,
          12: 200,
          17: 80,
          0: 5,
        },
      });
      const hours = persona.activeHours.flatMap(w => [w.start]);
      expect(hours).toContain(12); // highest count
    });
  });
});

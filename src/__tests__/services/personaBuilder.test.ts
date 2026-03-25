/**
 * Tests: Persona Builder service
 */
import { describe, it, expect } from 'vitest';
import { buildEnrichedPersona, matchPersona } from '../../services/personaBuilder';

describe('Persona Builder Service', () => {
  describe('buildEnrichedPersona', () => {
    it('returns a persona summary with insights and recommendations', () => {
      const summary = buildEnrichedPersona({
        ageGroups: { '25-34': 60, '35-44': 40 },
        locations: { 'United States': 70, 'Canada': 30 },
        activeHourCounts: { 9: 100, 12: 150, 17: 80 },
        contentTypeEngagement: { 'tutorials': 50, 'deep-dives': 40 },
        platformEngagement: { 'twitter': 60, 'linkedin': 40 },
        dayEngagement: { 'Tuesday': 90, 'Wednesday': 100 },
        genderSplit: { 'male': 55, 'female': 45 },
        interests: ['AI', 'machine learning'],
      });

      expect(summary.persona).toBeDefined();
      expect(summary.insights.length).toBeGreaterThanOrEqual(0);
      expect(summary.contentRecommendations.length).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(summary.bestPlatforms)).toBe(true);
    });

    it('handles empty snapshot gracefully', () => {
      const summary = buildEnrichedPersona({});
      expect(summary.persona).toBeDefined();
      expect(summary.persona.id).toContain('persona_custom');
    });

    it('overrides name with top age + location', () => {
      const summary = buildEnrichedPersona({
        ageGroups: { '25-34': 100 },
        locations: { 'Germany': 100 },
      });
      expect(summary.persona.name).toContain('25-34');
      expect(summary.persona.name).toContain('Germany');
    });

    it('incorporates provided interests', () => {
      const summary = buildEnrichedPersona({
        interests: ['blockchain', 'web3', 'defi'],
      });
      expect(summary.persona.interests).toContain('blockchain');
    });

    it('sets gender from genderSplit', () => {
      const summary = buildEnrichedPersona({
        genderSplit: { 'female': 80, 'male': 20 },
      });
      expect(summary.persona.demographics.gender).toBe('female');
    });
  });

  describe('matchPersona', () => {
    it('returns a persona for relevant tech topics', () => {
      const persona = matchPersona(['software development', 'API', 'cloud computing']);
      expect(persona).toBeDefined();
      expect(persona.id).toBeDefined();
    });

    it('returns a persona for startup topics', () => {
      const persona = matchPersona(['fundraising', 'startup', 'VC', 'bootstrapping']);
      expect(persona).toBeDefined();
    });

    it('returns a persona even with empty topics array', () => {
      const persona = matchPersona([]);
      expect(persona).toBeDefined();
    });

    it('returns a default persona for unknown topics', () => {
      const persona = matchPersona(['xyzunknownxyz', 'totallyobscure']);
      expect(persona).toBeDefined();
      // Should fall back to first default persona
    });
  });
});

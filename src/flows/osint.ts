import { z } from 'genkit';
import { ai } from '../genkit.config';
import {
    osintVisualSearchTool,
    osintSentimentTool,
    dossierEnrichmentTool
} from '../lib/agents';

export const osintVisualSearchFlow = ai.defineFlow(
    {
        name: 'osintVisualSearch',
        inputSchema: z.object({
            query: z.string(),
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        return await osintVisualSearchTool(input);
    }
);

export const osintSentimentFlow = ai.defineFlow(
    {
        name: 'osintSentiment',
        inputSchema: z.object({
            topic: z.string(),
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        return await osintSentimentTool(input);
    }
);

export const dossierEnrichmentFlow = ai.defineFlow(
    {
        name: 'dossierEnrichment',
        inputSchema: z.object({
            characterName: z.string(),
            location: z.string(),
            occupation: z.string(),
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        return await dossierEnrichmentTool(input);
    }
);

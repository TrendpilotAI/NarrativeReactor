import { z } from 'genkit';
import { ai } from '../genkit.config';
import { loadStoryBibleContext, loadBrandGuidelines } from '../lib/context';
import { generateCopyClaude } from '../lib/claude';
import { verifyBrandCompliance } from './compliance';

export const generateContentFlow = ai.defineFlow(
    {
        name: 'generateContent',
        inputSchema: z.object({
            episodeId: z.string(),
            platform: z.enum(['twitter', 'linkedin', 'threads']),
            useClaude: z.boolean().default(true), // Default to Claude Opus 4.5 for all copy
        }),
        outputSchema: z.object({
            content: z.string(),
            compliance: z.object({
                passed: z.boolean(),
                issues: z.array(z.string()),
            }),
            metadata: z.record(z.any()),
        }),
    },
    async (input) => {
        // 1. Load Context
        const context = await loadStoryBibleContext(input.episodeId);
        const guidelines = await loadBrandGuidelines();

        let content = '';

        // 2. Generate Content
        if (input.useClaude) {
            content = await generateCopyClaude({
                episodeId: input.episodeId,
                platform: input.platform,
                context,
                guidelines
            });
        } else {
            // Use Gemini via Genkit native generate
            const { text } = await ai.generate({
                prompt: `
                Generate ${input.platform} content for Episode ${input.episodeId}.
                
                CONTEXT:
                ${context}
                
                GUIDELINES:
                ${guidelines}
                
                Generate valid markdown copy.
                `
            });
            content = text;
        }

        // 3. Verify Compliance
        // Direct invocation of the flow
        const complianceResult = await verifyBrandCompliance({
            content,
            platform: input.platform
        });

        const validCompliance = complianceResult as unknown as { passed: boolean; issues: string[] };

        return {
            content,
            compliance: {
                passed: validCompliance.passed,
                issues: validCompliance.issues
            },
            metadata: {
                generator: input.useClaude ? 'Claude' : 'Gemini',
                episodeId: input.episodeId
            }
        };
    }
);

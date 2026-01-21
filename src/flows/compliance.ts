import { z } from 'genkit';
import { ai } from '../genkit.config';
import { loadBrandGuidelines } from '../lib/context';

export const ComplianceResultSchema = z.object({
    passed: z.boolean(),
    issues: z.array(z.string()),
    score: z.number().describe('0-100 score of brand alignment')
});

export const verifyBrandCompliance = ai.defineFlow(
    {
        name: 'verifyBrandCompliance',
        inputSchema: z.object({
            content: z.string(),
            platform: z.string(),
        }),
        outputSchema: ComplianceResultSchema,
    },
    async (input) => {
        const guidelines = await loadBrandGuidelines();

        const prompt = `
        Verify the following content against the Signal Studio Brand Guidelines.
        
        GUIDELINES:
        ${guidelines}
        
        PLATFORM: ${input.platform}
        
        CONTENT TO CHECK:
        "${input.content}"
        
        Check for:
        1. Tone alignment (Professional, accessible, etc.)
        2. Color usage (if applicable in text)
        3. Messaging hierarchy
        4. No banned words
        
        Return JSON validation.
        `;

        const { output } = await ai.generate({
            prompt,
            output: { schema: ComplianceResultSchema }
        });

        if (!output) {
            throw new Error("Failed to generate compliance report");
        }

        return output;
    }
);

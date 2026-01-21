import Anthropic from '@anthropic-ai/sdk';
import { z } from 'genkit';

// Initialize Anthropic client
// Assumes ANTHROPIC_API_KEY is set in environment
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || 'mock-key', // Fallback for build phase
});

export const GenerateCopySchema = z.object({
    episodeId: z.string(),
    platform: z.enum(['twitter', 'linkedin', 'threads']),
    context: z.string(),
    guidelines: z.string(),
});

export async function generateCopyClaude(input: z.infer<typeof GenerateCopySchema>) {

    const platformPrompts = {
        twitter: "Max 280 chars. 2-3 hashtags. Professional but accessible.",
        linkedin: "Max 3000 chars. Strategic, executive tone. Thought leadership.",
        threads: "Max 500 chars. Warm, conversational. Behind-the-scenes feel."
    };

    const systemPrompt = `You are the Narrative Reactor copywriter.
    
    BRAND GUIDELINES:
    ${input.guidelines}
    
    PLATFORM: ${input.platform.toUpperCase()}
    CONSTRAINTS: ${platformPrompts[input.platform]}
    `;

    try {
        const msg = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20240620", // Using available model
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
                {
                    role: "user",
                    content: `Generate ${input.platform} content for Episode ${input.episodeId}.\n\nCONTEXT:\n${input.context}`
                }
            ]
        });

        const textBlock = msg.content[0];
        if (textBlock.type === 'text') {
            return textBlock.text;
        }
        return "Error: No text returned from Claude.";

    } catch (error) {
        console.error("Claude API Error:", error);
        return "Error generating copy with Claude. Ensure API key is set.";
    }
}

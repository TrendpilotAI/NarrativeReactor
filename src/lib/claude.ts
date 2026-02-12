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

    const systemPrompt = `You are the Narrative Reactor copywriter using Claude 4.5 Opus.
    
    CORE PRINCIPLES:
    1. ORIGINALITY: Every piece of content must be fresh, surprising, and memorable. Avoid clichés, generic phrases, and predictable structures. Find unique angles and unexpected hooks.
    
    2. NARRATIVE COHESION: Each post is a teaser that links into the wider Signal Studio narrative—referencing characters (Maya, Marcus, Elena, Jamie, Helen), ongoing storylines, and the "11-second answer" theme. Make readers curious about the bigger story.
    
    3. ATOMIC CLARITY: Despite linking to a larger narrative, each post must stand completely on its own. A reader with zero context should instantly understand the core message. No inside jokes that exclude newcomers.
    
    4. EMOTIONAL RESONANCE: Move beyond information delivery. Create content that makes people feel something—curiosity, inspiration, recognition, or urgency.
    
    BRAND GUIDELINES:
    ${input.guidelines}
    
    PLATFORM: ${input.platform.toUpperCase()}
    CONSTRAINTS: ${platformPrompts[input.platform]}
    
    STYLE NOTES:
    - Use active voice and strong verbs
    - Lead with the most compelling insight
    - End with a thought that lingers
    - Vary sentence rhythm for impact
    `;

    try {
        const msg = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514", // Claude 4 Opus for highest quality
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

import { z } from 'genkit';
import { ai } from '../genkit.config';
import { providers, loadIntegrations } from './social-providers';
import { generateImage, generateVideo } from './fal';

/**
 * 1. Scene Generation Tool
 */
export const sceneGenerationTool = ai.defineTool(
    {
        name: 'sceneGenerationTool',
        description: 'Generates a detailed cinematic scene layout based on narrative context.',
        inputSchema: z.object({
            storyContext: z.string(),
            characters: z.array(z.string()),
            location: z.string(),
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        const p = ai.prompt('scene-gen');
        const { output } = await p(input);
        return output;
    }
);

/**
 * 2. Narrative Assembly Tool
 */
export const narrativeAssemblyTool = ai.defineTool(
    {
        name: 'narrativeAssemblyTool',
        description: 'Matches narrative beats and dialogue to specific characters and scenes.',
        inputSchema: z.object({
            prompt: z.string(),
            availableCharacters: z.array(z.string()),
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        const p = ai.prompt('narrative-assembly');
        const { output } = await p(input);
        return output;
    }
);

/**
 * 3. Score Generation Tool
 */
export const scoreGenTool = ai.defineTool(
    {
        name: 'scoreGenTool',
        description: 'Defines the musical score and sound design for a scene.',
        inputSchema: z.object({
            mood: z.string(),
            intensity: z.number().min(1).max(10),
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        const p = ai.prompt('score-gen');
        const { output } = await p(input);
        return output;
    }
);

/**
 * 4. Previs Image Tool
 */
export const previsImageTool = ai.defineTool(
    {
        name: 'previsImageTool',
        description: 'Generates rapid, low-resolution visual previews for storyboarding.',
        inputSchema: z.object({
            composition: z.string(),
            subject: z.string(),
            modelId: z.string().optional().describe('Fal.ai model ID (default: hunyuan-image/v3)'),
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        // Instead of just returning the prompt output, let's actually generate the image
        const imagePrompt = `Cinematic shot, ${input.composition}, subject: ${input.subject}, high quality, photorealistic, 8k`;
        try {
            const result = await generateImage(imagePrompt, input.modelId);
            return {
                prompt: imagePrompt,
                imageUrl: result.url,
                modelId: result.modelId,
                cost: result.cost,
                duration: result.duration,
                status: 'generated'
            };
        } catch (e: any) {
            return { error: e.message };
        }
    }
);

/**
 * 5. Social Post Tool
 * Posts content to connected social platforms.
 */
export const socialPostTool = ai.defineTool(
    {
        name: 'socialPostTool',
        description: 'Posts a message to a connected social platform (e.g., "x").',
        inputSchema: z.object({
            provider: z.string().describe('The social provider ID (e.g., "x")'),
            message: z.string().describe('The content to post'),
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        const integrations = await loadIntegrations();
        const integration = integrations[input.provider];
        if (!integration) return { error: `No account connected for ${input.provider}` };

        const provider = providers[input.provider];
        return await provider.post(integration.accessToken, input.message);
    }
);

/**
 * 6. Social Performance Tool
 * Retrieves analytics from social platforms.
 */
export const socialPerformanceTool = ai.defineTool(
    {
        name: 'socialPerformanceTool',
        description: 'Retrieves performance metrics from a connected social platform.',
        inputSchema: z.object({
            provider: z.string(),
            days: z.number().default(7),
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        const integrations = await loadIntegrations();
        const integration = integrations[input.provider];
        if (!integration) return { error: `No account connected for ${input.provider}` };

        const provider = providers[input.provider];
        return await provider.getAnalytics(integration.accessToken, input.days);
    }
);

/**
 * 7. List Integrations Tool
 * Checks which social accounts are connected.
 */
export const listIntegrationsTool = ai.defineTool(
    {
        name: 'listIntegrationsTool',
        description: 'Checks which social media accounts (X, LinkedIn, etc.) are connected.',
        inputSchema: z.void(),
        outputSchema: z.any(),
    },
    async () => {
        const integrations = await loadIntegrations();
        return Object.keys(providers).map(id => ({
            provider: id,
            name: providers[id].name,
            connected: !!integrations[id],
            username: integrations[id]?.username || '',
        }));
    }
);

/**
 * 8. OSINT Research Tool
 * Performs targeted web searches to gather intelligence for personas or narratives.
 */
export const osintResearchTool = ai.defineTool(
    {
        name: 'osintResearchTool',
        description: 'Performs targeted web searches to gather intelligence from open sources (OSINT). Use this to research personas, locations, or trends.',
        inputSchema: z.object({
            query: z.string().describe('The search query for intelligence gathering'),
            category: z.enum(['persona', 'location', 'trend', 'general']).default('general'),
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        const apiKey = process.env.SERPER_API_KEY;
        if (!apiKey || apiKey === 'YOUR_SERPER_API_KEY') {
            return {
                error: 'SERPER_API_KEY not configured. Please add it to your .env file.',
                suggestedAction: 'Visit https://serper.dev to get an API key.'
            };
        }

        try {
            const response = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: {
                    'X-API-KEY': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ q: input.query }),
            });

            const data = await response.json();
            return {
                query: input.query,
                category: input.category,
                results: data.organic?.map((r: any) => ({
                    title: r.title,
                    snippet: r.snippet,
                    link: r.link
                })) || []
            };
        } catch (error: any) {
            return { error: `Failed to perform OSINT research: ${error.message}` };
        }
    }
);

/**
 * 9. Video Generation Tool
 * Generates video from scene description.
 */
export const videoGenTool = ai.defineTool(
    {
        name: 'videoGenTool',
        description: 'Generates a video clip based on a scene description.',
        inputSchema: z.object({
            sceneDescription: z.string(),
            imageUrl: z.string().optional().describe('Optional starting frame URL'),
            modelId: z.string().optional().describe('Fal.ai model ID (default: seedance 1.5 pro)'),
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        try {
            const result = await generateVideo(input.sceneDescription, input.imageUrl, input.modelId);
            return {
                prompt: input.sceneDescription,
                videoUrl: result.url,
                modelId: result.modelId,
                cost: result.cost,
                duration: result.duration,
                status: 'generated'
            };
        } catch (e: any) {
            return { error: e.message };
        }
    }
);

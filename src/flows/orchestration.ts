import { listIntegrationsFlow, getPerformanceDataFlow } from './integrations';
import { z } from 'genkit';
import { ai } from '../genkit.config';
import {
    sceneGenerationTool,
    narrativeAssemblyTool,
    scoreGenTool,
    previsImageTool,
    socialPostTool,
    socialPerformanceTool,
    listIntegrationsTool,
    osintResearchTool,
    videoGenTool,
    osintVisualSearchTool,
    osintSentimentTool,
    dossierEnrichmentTool
} from '../lib/agents';
import { generateCaptions } from '../services/captionGenerator';
import { generateThumbnail } from '../services/thumbnailGenerator';

/**
 * Video Generation Flow
 * Orchestrates multiple agents/tools in parallel to produce a comprehensive production package.
 */
export const videoGenerationFlow = ai.defineFlow(
    {
        name: 'videoGeneration',
        inputSchema: z.object({
            theme: z.string(),
            characters: z.array(z.string()),
        }),
        outputSchema: z.object({
            scene: z.any(),
            narrative: z.any(),
            score: z.any(),
            previs: z.any(),
            script: z.string().optional(),
            captions: z.any().optional(),
            thumbnail: z.any().optional(),
            video: z.any().optional(),
            orchestrationStatus: z.string(),
            timestamp: z.string(),
        }),
    },
    async (input) => {
        // Parallel Orchestration: Trigger all specialized tools concurrently
        const [scene, narrative, score, previs] = await Promise.all([
            sceneGenerationTool({
                storyContext: input.theme,
                characters: input.characters,
                location: 'Signal Studio Innovation Hub',
            }),
            narrativeAssemblyTool({
                prompt: input.theme,
                availableCharacters: input.characters,
            }),
            scoreGenTool({
                mood: 'Techno-optimistic, cinematic',
                intensity: 7,
            }),
            previsImageTool({
                composition: 'Low-angle hero shot',
                subject: input.characters[0] || 'Maya Chen',
            }),
        ]);

        const script = typeof narrative === 'string' ? narrative : JSON.stringify(narrative);
        const captions = generateCaptions(script || input.theme, { format: 'srt' });
        const thumbnail = previs?.imageUrl
            ? generateThumbnail(previs.imageUrl, input.theme, input.characters[0] || 'Maya Chen', 'bold')
            : undefined;

        // Sequential: Generate Video using the Scene description and Previs Image
        let videoResult: any = { status: 'failed', error: 'Video generation did not run' };
        try {
            const sceneDesc = typeof scene === 'string' ? scene : JSON.stringify(scene);
            const imageUrl = previs?.imageUrl;

            videoResult = await videoGenTool({
                sceneDescription: sceneDesc.substring(0, 500), // Truncate for safety
                imageUrl: imageUrl,
                platform: 'tiktok',
                aspectRatio: '9:16',
                durationSeconds: 30,
            });
        } catch (e) {
            console.error("Video generation failed:", e);
            videoResult = {
                status: 'failed',
                error: e instanceof Error ? e.message : String(e),
            };
        }
        const videoFailed = !videoResult || videoResult.status === 'failed' || Boolean(videoResult.error);

        return {
            scene,
            narrative,
            score,
            previs,
            script,
            captions,
            thumbnail,
            video: videoResult,
            orchestrationStatus: videoFailed ? 'PARTIAL' : 'COMPLETE',
            timestamp: new Date().toISOString(),
        };
    }
);

/**
 * Agentic Chat Flow
 * A conversational agent that can reason through problems and invoke tools based on user intent.
 */
export const agenticChatFlow = ai.defineFlow(
    {
        name: 'agenticChat',
        inputSchema: z.object({
            message: z.string(),
            history: z.array(z.any()).optional(),
            context: z.record(z.any()).optional(),
        }),
        outputSchema: z.object({
            response: z.string(),
            suggestedActions: z.array(z.string()),
            toolOutputs: z.array(z.any()).optional(),
        }),
    },
    async (input) => {
        let performanceContext = "";
        try {
            const integrations = await listIntegrationsFlow(undefined);
            const xIntegration = integrations.find((i: any) => i.provider === 'x' && i.connected);
            if (xIntegration) {
                const perf = await getPerformanceDataFlow({ provider: 'x', days: 7 });
                performanceContext = `\n\nCURRENT SOCIAL PERFORMANCE (X/Twitter - last 7 days):\n${perf.map((m: any) => `- ${m.label}: ${m.value} (${m.change})`).join('\n')}`;
            }
        } catch (e) {
            // Ignore if performance data fails
        }

        const result = await ai.generate({
            model: 'googleai/gemini-1.5-flash',
            system: `You are the Narrative Reactor Agent. 
            You are currently observing the following dashboard context: ${JSON.stringify(input.context)}.${performanceContext}
            
            Your goal is to assist the user in directing cinematic marketing campaigns for Signal Studio.
            You can generate scenes, scripts, scores, and visual previs using your tools.
            You also have access to OSINT research tools to gather intelligence on personas, trends, and locations.
            Mention characters by name (Maya, Marcus, Elena, Jamie, Helen) and respect brand guidelines.
            
            Be concise, proactive, and prioritize visual storytelling.`,
            messages: [
                ...(input.history || []),
                { role: 'user', content: [{ text: input.message }] }
            ],
            tools: [
                sceneGenerationTool,
                narrativeAssemblyTool,
                scoreGenTool,
                previsImageTool,
                socialPostTool,
                socialPerformanceTool,
                listIntegrationsTool,
                osintResearchTool,
                videoGenTool,
                osintVisualSearchTool,
                osintSentimentTool,
                dossierEnrichmentTool
            ],
        });

        const toolOutputs = result.messages
            ?.flatMap(m => m.content || [])
            .filter(part => part.toolResponse)
            .map(part => ({
                name: part.toolResponse?.name,
                output: part.toolResponse?.output
            })) || result.toolRequests
            ?.map((part: any) => ({
                name: part.toolRequest?.name,
                output: part.toolRequest?.input,
            })) || [];

        return {
            response: result.text,
            suggestedActions: [
                'Draft Scene for Maya',
                'Generate Pacing for Narrative',
                'Design High-Intensity Score'
            ],
            ...(toolOutputs.length > 0 ? { toolOutputs } : {})
        };
    }
);

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
    osintResearchTool
} from '../lib/agents';

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
            orchestrationStatus: z.string(),
            timestamp: z.string(),
        }),
    },
    async (input) => {
        // Parallel Orchestration: Trigger all specialized tools concurrently
        const [scene, narrative, score, previs] = await Promise.all([
            ai.runTool(sceneGenerationTool, {
                storyContext: input.theme,
                characters: input.characters,
                location: 'Signal Studio Innovation Hub',
            }),
            ai.runTool(narrativeAssemblyTool, {
                prompt: input.theme,
                availableCharacters: input.characters,
            }),
            ai.runTool(scoreGenTool, {
                mood: 'Techno-optimistic, cinematic',
                intensity: 7,
            }),
            ai.runTool(previsImageTool, {
                composition: 'Low-angle hero shot',
                subject: input.characters[0] || 'Maya Chen',
            }),
        ]);

        return {
            scene,
            narrative,
            score,
            previs,
            orchestrationStatus: 'COMPLETE',
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
            const integrations = await ai.runFlow(listIntegrationsFlow, {});
            const xIntegration = integrations.find((i: any) => i.provider === 'x' && i.connected);
            if (xIntegration) {
                const perf = await ai.runFlow(getPerformanceDataFlow, { provider: 'x', days: 7 });
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
                osintResearchTool
            ],
        });

        return {
            response: result.text,
            suggestedActions: [
                'Draft Scene for Maya',
                'Generate Pacing for Narrative',
                'Design High-Intensity Score'
            ],
            toolOutputs: result.toolResponses?.map(tr => ({
                name: tr.name,
                output: tr.output
            }))
        };
    }
);

'use server';

export async function generateContentAction(
    episodeId: string,
    platform: string,
    useClaude: boolean
) {
    try {
        // Genkit Flow Server URL (Express)
        const FLOW_SERVER = 'http://127.0.0.1:3401';

        // The explicit flow name endpoint pattern with @genkit-ai/express
        const response = await fetch(`${FLOW_SERVER}/generateContent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data: {
                    episodeId,
                    platform: platform.toLowerCase(),
                    useClaude
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Genkit API Error:', errorText);
            throw new Error(`Genkit API error: ${response.status} ${response.statusText}`);
        }

        const json = await response.json();
        // Genkit response format: { result: { content: "...", compliance: {}, ... } }
        return json.result;

    } catch (error) {
        console.error('Server Action Error:', error);
        return {
            content: "Error generating content. Please ensure the Genkit backend is running (npx genkit start).",
            compliance: { passed: false, issues: ["Backend connection failed"] },
            metadata: { error: String(error) }
        };
    }
}

const FLOW_SERVER = 'http://127.0.0.1:3401';

export async function getAuthUrlAction(provider: string) {
    const response = await fetch(`${FLOW_SERVER}/getAuthUrl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { provider } }),
    });
    const json = await response.json();
    return json.result;
}

export async function connectSocialAccountAction(provider: string, code: string, codeVerifier: string) {
    const response = await fetch(`${FLOW_SERVER}/connectSocialAccount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { provider, code, codeVerifier } }),
    });
    const json = await response.json();
    return json.result;
}

export async function listIntegrationsAction() {
    const response = await fetch(`${FLOW_SERVER}/listIntegrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: undefined }),
    });
    const json = await response.json();
    return json.result;
}

export async function getPerformanceDataAction(provider: string, days: number = 7) {
    const response = await fetch(`${FLOW_SERVER}/getPerformanceData`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { provider, days } }),
    });
    const json = await response.json();
    return json.result;
}

export async function getMentionsAction(provider: string) {
    const response = await fetch(`${FLOW_SERVER}/getMentions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { provider } }),
    });
    const json = await response.json();
    return json.result;
}

export async function listAssetsAction(type: 'image' | 'video' | 'all' = 'all') {
    const response = await fetch(`${FLOW_SERVER}/listAssets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { type } }),
    });
    const json = await response.json();
    return json.result;
}

export async function deleteAssetAction(id: string) {
    const response = await fetch(`${FLOW_SERVER}/deleteAsset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { id } }),
    });
    const json = await response.json();
    return json.result;
}

// ============ Agentic Tool Actions ============

/**
 * Invoke agenticChatFlow with a specific tool directive
 */
async function invokeAgenticChat(message: string, context?: Record<string, unknown>) {
    const response = await fetch(`${FLOW_SERVER}/agenticChat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            data: {
                message,
                history: [],
                context: context || {}
            }
        }),
    });
    const json = await response.json();
    return json.result;
}

/**
 * Generate a cinematic scene using sceneGenerationTool
 */
export async function generateSceneAction(
    storyContext: string,
    characters: string[],
    location: string
) {
    const directive = `Use the sceneGenerationTool to generate a cinematic scene with the following parameters:
- Story Context: ${storyContext}
- Characters: ${characters.join(', ')}
- Location: ${location}

Return the detailed scene layout.`;

    return invokeAgenticChat(directive, { tool: 'sceneGeneration' });
}

/**
 * Generate a narrative assembly using narrativeAssemblyTool
 */
export async function generateNarrativeAction(
    prompt: string,
    characters: string[]
) {
    const directive = `Use the narrativeAssemblyTool to match narrative beats and dialogue:
- Prompt: ${prompt}
- Available Characters: ${characters.join(', ')}

Return the narrative assembly.`;

    return invokeAgenticChat(directive, { tool: 'narrativeAssembly' });
}

/**
 * Generate a score using scoreGenTool
 */
export async function generateScoreAction(
    mood: string,
    intensity: number
) {
    const directive = `Use the scoreGenTool to define the musical score:
- Mood: ${mood}
- Intensity: ${intensity}/10

Return the score and sound design details.`;

    return invokeAgenticChat(directive, { tool: 'scoreGen' });
}

/**
 * Generate a preview image using previsImageTool (Fal.ai)
 */
export async function generatePrevisImageAction(
    composition: string,
    subject: string,
    modelId?: string
) {
    const directive = `Use the previsImageTool to generate a visual preview:
- Composition: ${composition}
- Subject: ${subject}
${modelId ? `- Model ID: ${modelId}` : ''}

Generate and return the image.`;

    return invokeAgenticChat(directive, { tool: 'previsImage' });
}

/**
 * Generate a video using videoGenTool (Fal.ai)
 */
export async function generateVideoAction(
    sceneDescription: string,
    imageUrl?: string,
    modelId?: string
) {
    const directive = `Use the videoGenTool to generate a video clip:
- Scene Description: ${sceneDescription}
${imageUrl ? `- Starting Frame URL: ${imageUrl}` : ''}
${modelId ? `- Model ID: ${modelId}` : ''}

Generate and return the video.`;

    return invokeAgenticChat(directive, { tool: 'videoGen' });
}

/**
 * Perform OSINT research using osintResearchTool
 */
export async function osintResearchAction(
    query: string,
    category: 'persona' | 'location' | 'trend' | 'general' = 'general'
) {
    const directive = `Use the osintResearchTool to gather intelligence:
- Query: ${query}
- Category: ${category}

Return the research findings.`;

    return invokeAgenticChat(directive, { tool: 'osintResearch' });
}

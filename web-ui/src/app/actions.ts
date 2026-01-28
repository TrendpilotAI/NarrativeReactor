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

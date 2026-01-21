import { z } from 'genkit';
import { ai } from '../genkit.config';
import { providers, saveIntegration, loadIntegrations } from '../lib/social-providers';

export const getAuthUrlFlow = ai.defineFlow(
    {
        name: 'getAuthUrl',
        inputSchema: z.object({
            provider: z.string(),
        }),
        outputSchema: z.object({
            url: z.string(),
            codeVerifier: z.string(),
            state: z.string(),
        }),
    },
    async (input) => {
        const provider = providers[input.provider];
        if (!provider) throw new Error(`Provider ${input.provider} not found`);
        return await provider.generateAuthUrl();
    }
);

export const connectSocialAccountFlow = ai.defineFlow(
    {
        name: 'connectSocialAccount',
        inputSchema: z.object({
            provider: z.string(),
            code: z.string(),
            codeVerifier: z.string(),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            account: z.any(),
        }),
    },
    async (input) => {
        const provider = providers[input.provider];
        if (!provider) throw new Error(`Provider ${input.provider} not found`);

        const accountDetails = await provider.authenticate({
            code: input.code,
            codeVerifier: input.codeVerifier,
        });

        await saveIntegration(input.provider, accountDetails);

        return {
            success: true,
            account: {
                id: accountDetails.id,
                name: accountDetails.name,
                username: accountDetails.username,
                picture: accountDetails.picture,
            }
        };
    }
);

export const listIntegrationsFlow = ai.defineFlow(
    {
        name: 'listIntegrations',
        inputSchema: z.void(),
        outputSchema: z.array(z.object({
            provider: z.string(),
            name: z.string(),
            username: z.string(),
            picture: z.string().optional(),
            connected: z.boolean(),
        })),
    },
    async () => {
        const integrations = await loadIntegrations();
        return Object.keys(providers).map(id => ({
            provider: id,
            name: providers[id].name,
            username: integrations[id]?.username || '',
            picture: integrations[id]?.picture || '',
            connected: !!integrations[id],
        }));
    }
);

export const postToSocialFlow = ai.defineFlow(
    {
        name: 'postToSocial',
        inputSchema: z.object({
            provider: z.string(),
            message: z.string(),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            postId: z.string(),
            releaseURL: z.string(),
        }),
    },
    async (input) => {
        const integrations = await loadIntegrations();
        const integration = integrations[input.provider];
        if (!integration) throw new Error(`Integration for ${input.provider} not found`);

        const provider = providers[input.provider];
        const result = await provider.post(integration.accessToken, input.message);

        return {
            success: true,
            ...result
        };
    }
);

export const getPerformanceDataFlow = ai.defineFlow(
    {
        name: 'getPerformanceData',
        inputSchema: z.object({
            provider: z.string(),
            days: z.number().default(7),
        }),
        outputSchema: z.array(z.object({
            label: z.string(),
            value: z.number(),
            change: z.string(),
        })),
    },
    async (input) => {
        const integrations = await loadIntegrations();
        const integration = integrations[input.provider];
        if (!integration) throw new Error(`Integration for ${input.provider} not found`);

        const provider = providers[input.provider];
        return await provider.getAnalytics(integration.accessToken, input.days);
    }
);

export const getMentionsFlow = ai.defineFlow(
    {
        name: 'getMentions',
        inputSchema: z.object({
            provider: z.string(),
        }),
        outputSchema: z.array(z.object({
            id: z.string(),
            text: z.string(),
            createdAt: z.string(),
            author: z.object({
                name: z.string(),
                username: z.string(),
                avatar: z.string(),
            }),
        })),
    },
    async (input) => {
        const integrations = await loadIntegrations();
        const integration = integrations[input.provider];
        if (!integration) throw new Error(`Integration for ${input.provider} not found`);

        const provider = providers[input.provider];
        return await provider.getMentions(integration.accessToken);
    }
);

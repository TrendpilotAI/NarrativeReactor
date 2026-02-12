import { z } from 'genkit';
import { ai } from '../genkit.config';
import { MediaStore, MediaAsset } from '../lib/media-store';

export const listAssetsFlow = ai.defineFlow(
    {
        name: 'listAssets',
        inputSchema: z.object({
            type: z.enum(['image', 'video', 'all']).optional().default('all'),
        }),
        outputSchema: z.array(z.object({
            id: z.string(),
            type: z.enum(['image', 'video']),
            url: z.string(),
            prompt: z.string().optional(),
            modelId: z.string().optional(),
            cost: z.number().optional(),
            duration: z.number().optional(),
            createdAt: z.string(),
        })),
    },
    async (input) => {
        const typeFilter = input.type === 'all' ? undefined : input.type;
        const assets = MediaStore.getAll(typeFilter as 'image' | 'video' | undefined);
        return assets.map(a => ({
            id: a.id,
            type: a.type,
            url: a.url,
            prompt: a.prompt || undefined,
            modelId: a.modelId || undefined,
            cost: a.cost,
            duration: a.duration,
            createdAt: a.createdAt,
        }));
    }
);

export const getAssetFlow = ai.defineFlow(
    {
        name: 'getAsset',
        inputSchema: z.object({
            id: z.string(),
        }),
        outputSchema: z.object({
            id: z.string(),
            type: z.enum(['image', 'video']),
            url: z.string(),
            prompt: z.string().optional(),
            modelId: z.string().optional(),
            cost: z.number().optional(),
            duration: z.number().optional(),
            createdAt: z.string(),
        }).nullable(),
    },
    async (input) => {
        const asset = MediaStore.getById(input.id);
        if (!asset) return null;
        return {
            id: asset.id,
            type: asset.type,
            url: asset.url,
            prompt: asset.prompt || undefined,
            modelId: asset.modelId || undefined,
            cost: asset.cost,
            duration: asset.duration,
            createdAt: asset.createdAt,
        };
    }
);

export const deleteAssetFlow = ai.defineFlow(
    {
        name: 'deleteAsset',
        inputSchema: z.object({
            id: z.string(),
        }),
        outputSchema: z.object({
            success: z.boolean(),
        }),
    },
    async (input) => {
        const success = MediaStore.delete(input.id);
        return { success };
    }
);

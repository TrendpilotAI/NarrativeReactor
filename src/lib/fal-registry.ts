import { fal } from '@fal-ai/client';

export interface FalModel {
    id: string;
    owner: string;
    created_at: string;
    capabilities?: string[];
    category?: string;
    [key: string]: any;
}

export interface FalPricing {
    endpoint_id: string;
    unit_price: number;
    unit: string;
    currency: string;
}

export class FalRegistry {
    private static BASE_URL = 'https://api.fal.ai/v1';

    private static async request<T>(path: string, options: RequestInit = {}): Promise<T> {
        // We need the API key to call the platform API directly
        // The fal client usually handles this, but for platform metadata we assume standard REST
        const apiKey = process.env.FAL_KEY || process.env.FAL_API_KEY;
        if (!apiKey) {
            throw new Error('FAL_KEY is not configured');
        }

        // Handle "Key " prefix requirement if present or not in the raw key
        // The FAL_KEY usually looks like "key_id:key_secret"
        // The API expects 'Authorization: Key <FAL_KEY>'

        const response = await fetch(`${this.BASE_URL}${path}`, {
            ...options,
            headers: {
                'Authorization': `Key ${apiKey}`,
                'Content-Type': 'application/json',
                ...options.headers,
            }
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Fal Platform API error (${response.status}): ${text}`);
        }

        return response.json();
    }

    /**
     * Lists available models from the Fal.ai registry.
     * Note: The /models endpoint returns a list of models.
     */
    static async listModels(): Promise<FalModel[]> {
        try {
            // Fetch models. Endpoint: /models
            // This might be paginated, for now we fetch the first page or standard list
            const response = await this.request<any>('/models');
            const models = response.models || response.results || [];
            return models.map((m: any) => ({
                id: m.endpoint_id,
                owner: m.owner || 'fal-ai',
                created_at: m.metadata?.created_at || new Date().toISOString(),
                capabilities: m.metadata?.tags || [],
                category: m.metadata?.category || 'unknown',
                ...m
            }));
        } catch (error) {
            console.warn('Failed to list models from Fal Registry:', error);
            return [];
        }
    }

    /**
     * Fetches pricing for specific model endpoints.
     */
    static async getPricing(modelIds: string[]): Promise<FalPricing[]> {
        try {
            if (modelIds.length === 0) return [];

            // Query params: ?endpoint_id=model1&endpoint_id=model2
            const params = new URLSearchParams();
            modelIds.forEach(id => params.append('endpoint_id', id));

            const response = await this.request<any>(`/models/pricing?${params.toString()}`);
            return response.prices || [];
        } catch (error) {
            console.warn('Failed to fetch pricing:', error);
            return [];
        }
    }

    /**
     * Categorizes models by use case.
     * Use manual mapping for now as categories in metadata might be broad.
     */
    static getModelCategory(modelId: string): 'image' | 'video' | 'audio' | 'other' {
        if (modelId.includes('text-to-video') || modelId.includes('image-to-video') || modelId.includes('video')) return 'video';
        if (modelId.includes('text-to-image') || modelId.includes('image-to-image') || modelId.includes('flux') || modelId.includes('sdxl')) return 'image';
        if (modelId.includes('audio') || modelId.includes('music') || modelId.includes('voice')) return 'audio';
        return 'other';
    }
}

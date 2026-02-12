'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ModelOption {
    id: string;
    name: string;
    provider: string;
    type: 'llm' | 'image' | 'video';
}

export const LLM_MODELS: ModelOption[] = [
    { id: 'claude-4-opus-20250514', name: 'Claude 4.5 Opus', provider: 'Anthropic', type: 'llm' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude 4.5 Sonnet', provider: 'Anthropic', type: 'llm' },
    { id: 'claude-haiku-4-20250514', name: 'Claude 4.5 Haiku', provider: 'Anthropic', type: 'llm' },
    { id: 'gpt-5.2-turbo', name: 'GPT 5.2', provider: 'OpenAI', type: 'llm' },
    { id: 'gemini-3.0-pro', name: 'Gemini 3.0 Pro', provider: 'Google', type: 'llm' },
    { id: 'gemini-3.0-flash', name: 'Gemini 3.0 Flash', provider: 'Google', type: 'llm' },
    { id: 'glm-4.7', name: 'GLM 4.7', provider: 'Zhipu', type: 'llm' },
];

export const IMAGE_MODELS: ModelOption[] = [
    { id: 'fal-ai/hunyuan-image/v3/instruct/text-to-image', name: 'Hunyuan Image v3', provider: 'Fal.ai', type: 'image' },
    { id: 'fal-ai/flux-pro/v1.1', name: 'FLUX Pro 1.1', provider: 'Fal.ai', type: 'image' },
    { id: 'fal-ai/recraft-v3', name: 'Recraft v3', provider: 'Fal.ai', type: 'image' },
];

export const VIDEO_MODELS: ModelOption[] = [
    { id: 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video', name: 'Seedance 1.5 Pro', provider: 'Fal.ai', type: 'video' },
    { id: 'fal-ai/hunyuan-video', name: 'Hunyuan Video', provider: 'Fal.ai', type: 'video' },
    { id: 'fal-ai/minimax/video-01', name: 'MiniMax Video', provider: 'Fal.ai', type: 'video' },
];

interface ModelContextType {
    llmModel: ModelOption;
    setLlmModel: (model: ModelOption) => void;
    imageModel: ModelOption;
    setImageModel: (model: ModelOption) => void;
    videoModel: ModelOption;
    setVideoModel: (model: ModelOption) => void;
}

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export function ModelProvider({ children }: { children: ReactNode }) {
    const [llmModel, setLlmModelState] = useState<ModelOption>(LLM_MODELS[0]); // Claude 4.5 Opus default
    const [imageModel, setImageModelState] = useState<ModelOption>(IMAGE_MODELS[0]);
    const [videoModel, setVideoModelState] = useState<ModelOption>(VIDEO_MODELS[0]);

    useEffect(() => {
        // Load from localStorage on mount
        const storedLlm = localStorage.getItem('nr_llm_model');
        const storedImage = localStorage.getItem('nr_image_model');
        const storedVideo = localStorage.getItem('nr_video_model');

        if (storedLlm) {
            const found = LLM_MODELS.find(m => m.id === storedLlm);
            if (found) setLlmModelState(found);
        }
        if (storedImage) {
            const found = IMAGE_MODELS.find(m => m.id === storedImage);
            if (found) setImageModelState(found);
        }
        if (storedVideo) {
            const found = VIDEO_MODELS.find(m => m.id === storedVideo);
            if (found) setVideoModelState(found);
        }
    }, []);

    const setLlmModel = (model: ModelOption) => {
        setLlmModelState(model);
        localStorage.setItem('nr_llm_model', model.id);
    };

    const setImageModel = (model: ModelOption) => {
        setImageModelState(model);
        localStorage.setItem('nr_image_model', model.id);
    };

    const setVideoModel = (model: ModelOption) => {
        setVideoModelState(model);
        localStorage.setItem('nr_video_model', model.id);
    };

    return (
        <ModelContext.Provider value={{
            llmModel, setLlmModel,
            imageModel, setImageModel,
            videoModel, setVideoModel
        }}>
            {children}
        </ModelContext.Provider >
    );
}

export function useModels() {
    const context = useContext(ModelContext);
    if (!context) {
        throw new Error('useModels must be used within a ModelProvider');
    }
    return context;
}

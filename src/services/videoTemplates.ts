/**
 * Video Templates
 * Pre-defined templates for common video types with customizable scenes, pacing, and transitions.
 */

import { TransitionType } from './videoStitcher';

export type TemplateType = 'product_launch' | 'case_study' | 'testimonial' | 'explainer' | 'social_clip';
export type MusicMood = 'energetic' | 'calm' | 'dramatic' | 'upbeat' | 'corporate' | 'inspiring';
export type Pacing = 'fast' | 'medium' | 'slow';

export interface TemplateScene {
    label: string;
    description: string;
    suggestedDuration: number;
    transition: TransitionType;
}

export interface VideoTemplate {
    type: TemplateType;
    name: string;
    description: string;
    scenes: TemplateScene[];
    musicMood: MusicMood;
    pacing: Pacing;
    defaultTransition: TransitionType;
    recommendedDuration: number; // total seconds
}

const templates: Record<TemplateType, VideoTemplate> = {
    product_launch: {
        type: 'product_launch',
        name: 'Product Launch',
        description: 'High-energy product reveal with feature highlights and CTA',
        scenes: [
            { label: 'Hook', description: 'Attention-grabbing opening with problem statement', suggestedDuration: 5, transition: 'fade' },
            { label: 'Reveal', description: 'Product reveal with logo/name', suggestedDuration: 8, transition: 'dissolve' },
            { label: 'Features', description: 'Key feature showcase (3-4 features)', suggestedDuration: 15, transition: 'slide' },
            { label: 'Social Proof', description: 'Testimonials or stats', suggestedDuration: 7, transition: 'fade' },
            { label: 'CTA', description: 'Call to action with link/QR', suggestedDuration: 5, transition: 'fade' },
        ],
        musicMood: 'energetic',
        pacing: 'fast',
        defaultTransition: 'slide',
        recommendedDuration: 40,
    },
    case_study: {
        type: 'case_study',
        name: 'Case Study',
        description: 'Problem-solution narrative with measurable results',
        scenes: [
            { label: 'Challenge', description: 'Client challenge and context', suggestedDuration: 10, transition: 'fade' },
            { label: 'Approach', description: 'Solution approach and strategy', suggestedDuration: 15, transition: 'dissolve' },
            { label: 'Implementation', description: 'Key implementation steps', suggestedDuration: 15, transition: 'fade' },
            { label: 'Results', description: 'Metrics and outcomes', suggestedDuration: 10, transition: 'dissolve' },
            { label: 'Conclusion', description: 'Summary and next steps', suggestedDuration: 10, transition: 'fade' },
        ],
        musicMood: 'corporate',
        pacing: 'medium',
        defaultTransition: 'dissolve',
        recommendedDuration: 60,
    },
    testimonial: {
        type: 'testimonial',
        name: 'Testimonial',
        description: 'Customer testimonial with emotional storytelling',
        scenes: [
            { label: 'Intro', description: 'Customer introduction', suggestedDuration: 5, transition: 'fade' },
            { label: 'Before', description: 'Life before the product/service', suggestedDuration: 10, transition: 'dissolve' },
            { label: 'Experience', description: 'Their experience using it', suggestedDuration: 15, transition: 'fade' },
            { label: 'Impact', description: 'The positive impact/results', suggestedDuration: 10, transition: 'dissolve' },
            { label: 'Recommendation', description: 'Final recommendation and CTA', suggestedDuration: 5, transition: 'fade' },
        ],
        musicMood: 'inspiring',
        pacing: 'medium',
        defaultTransition: 'fade',
        recommendedDuration: 45,
    },
    explainer: {
        type: 'explainer',
        name: 'Explainer',
        description: 'Educational content that breaks down complex topics',
        scenes: [
            { label: 'Hook', description: 'Question or problem statement', suggestedDuration: 5, transition: 'fade' },
            { label: 'Context', description: 'Background and why it matters', suggestedDuration: 10, transition: 'dissolve' },
            { label: 'Explanation', description: 'Step-by-step breakdown', suggestedDuration: 20, transition: 'fade' },
            { label: 'Example', description: 'Real-world example or demo', suggestedDuration: 15, transition: 'dissolve' },
            { label: 'Summary', description: 'Key takeaways', suggestedDuration: 10, transition: 'fade' },
        ],
        musicMood: 'calm',
        pacing: 'medium',
        defaultTransition: 'dissolve',
        recommendedDuration: 60,
    },
    social_clip: {
        type: 'social_clip',
        name: 'Social Clip',
        description: 'Short-form social media content optimized for engagement',
        scenes: [
            { label: 'Hook', description: 'Scroll-stopping opening', suggestedDuration: 3, transition: 'cut' },
            { label: 'Content', description: 'Main message or value', suggestedDuration: 10, transition: 'cut' },
            { label: 'CTA', description: 'Engagement prompt (like, share, follow)', suggestedDuration: 2, transition: 'fade' },
        ],
        musicMood: 'upbeat',
        pacing: 'fast',
        defaultTransition: 'cut',
        recommendedDuration: 15,
    },
};

export function getTemplate(type: TemplateType): VideoTemplate {
    const t = templates[type];
    if (!t) throw new Error(`Unknown template type: ${type}`);
    return { ...t, scenes: t.scenes.map(s => ({ ...s })) };
}

export function customizeTemplate(template: VideoTemplate, overrides: Partial<VideoTemplate>): VideoTemplate {
    return {
        ...template,
        ...overrides,
        scenes: overrides.scenes || template.scenes.map(s => ({ ...s })),
    };
}

export function listTemplates(): VideoTemplate[] {
    return Object.values(templates).map(t => ({ ...t, scenes: t.scenes.map(s => ({ ...s })) }));
}

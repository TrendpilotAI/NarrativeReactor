/**
 * Multi-Scene Video Stitcher
 * Creates video projects from ordered scenes and generates FFmpeg commands for stitching.
 */

import crypto from 'crypto';

export type TransitionType = 'fade' | 'cut' | 'dissolve' | 'slide';

export interface Scene {
    id: string;
    description: string;
    imageUrl: string;
    audioUrl?: string;
    duration: number; // seconds
    transition: TransitionType;
}

export interface VideoProject {
    id: string;
    scenes: Scene[];
    createdAt: string;
    updatedAt: string;
}

export interface TimelineBreakdown {
    sceneId: string;
    description: string;
    startTime: number;
    endTime: number;
    duration: number;
    transition: TransitionType;
}

export interface ProjectTimeline {
    projectId: string;
    totalDuration: number;
    sceneCount: number;
    breakdown: TimelineBreakdown[];
}

const projects = new Map<string, VideoProject>();

export function createVideoProject(scenes: Scene[]): VideoProject {
    if (!scenes || scenes.length === 0) {
        throw new Error('At least one scene is required');
    }
    const project: VideoProject = {
        id: crypto.randomUUID(),
        scenes: scenes.map((s, i) => ({ ...s, id: s.id || `scene-${i + 1}` })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    projects.set(project.id, project);
    return project;
}

export function getVideoProject(id: string): VideoProject | undefined {
    return projects.get(id);
}

function transitionFilter(transition: TransitionType, duration: number, index: number): string {
    const offset = duration - 1; // 1s transition overlap
    switch (transition) {
        case 'fade':
            return `[${index}:v]fade=t=out:st=${offset}:d=1[v${index}fade];`;
        case 'dissolve':
            return `[${index}:v]fade=t=out:st=${offset}:d=1:alpha=1[v${index}fade];`;
        case 'slide':
            return `[${index}:v]fade=t=out:st=${offset}:d=1[v${index}fade];`;
        case 'cut':
        default:
            return '';
    }
}

export function generateStitchingScript(project: VideoProject): string {
    const { scenes } = project;
    if (scenes.length === 0) return '';

    if (scenes.length === 1) {
        const s = scenes[0];
        const inputs = s.audioUrl
            ? `-loop 1 -t ${s.duration} -i "${s.imageUrl}" -i "${s.audioUrl}"`
            : `-loop 1 -t ${s.duration} -i "${s.imageUrl}"`;
        const audioMap = s.audioUrl ? '-map 0:v -map 1:a -shortest' : '';
        return `ffmpeg ${inputs} -c:v libx264 -pix_fmt yuv420p ${audioMap} -t ${s.duration} output_${project.id}.mp4`;
    }

    // Build inputs
    const inputArgs = scenes.map((s, i) => {
        let input = `-loop 1 -t ${s.duration} -i "${s.imageUrl}"`;
        if (s.audioUrl) input += ` -i "${s.audioUrl}"`;
        return input;
    }).join(' ');

    // Build filter complex for transitions
    const filterParts: string[] = [];
    const concatInputs: string[] = [];

    scenes.forEach((s, i) => {
        const filter = transitionFilter(s.transition, s.duration, i);
        if (filter) {
            filterParts.push(filter);
            concatInputs.push(`[v${i}fade]`);
        } else {
            concatInputs.push(`[${i}:v]`);
        }
    });

    const concatFilter = `${concatInputs.join('')}concat=n=${scenes.length}:v=1:a=0[outv]`;
    filterParts.push(concatFilter);

    const filterComplex = `-filter_complex "${filterParts.join(' ')}"`;

    return `ffmpeg ${inputArgs} ${filterComplex} -map "[outv]" -c:v libx264 -pix_fmt yuv420p output_${project.id}.mp4`;
}

export function getProjectTimeline(project: VideoProject): ProjectTimeline {
    let currentTime = 0;
    const breakdown: TimelineBreakdown[] = project.scenes.map((scene) => {
        const entry: TimelineBreakdown = {
            sceneId: scene.id,
            description: scene.description,
            startTime: currentTime,
            endTime: currentTime + scene.duration,
            duration: scene.duration,
            transition: scene.transition,
        };
        currentTime += scene.duration;
        return entry;
    });

    return {
        projectId: project.id,
        totalDuration: currentTime,
        sceneCount: project.scenes.length,
        breakdown,
    };
}

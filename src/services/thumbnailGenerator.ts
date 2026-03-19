/**
 * Thumbnail Generator
 * Generates thumbnail configurations with text overlays and style presets.
 */

import { Scene } from './videoStitcher';

export type TextPosition = 'top' | 'center' | 'bottom';
export type ThumbnailStyle = 'bold' | 'minimal' | 'gradient' | 'split';

export interface TextOverlay {
    text: string;
    position: TextPosition;
    fontSize: number;
    color: string;
    backgroundColor?: string;
    fontWeight: string;
}

export interface ThumbnailConfig {
    imageUrl: string;
    width: number;
    height: number;
    style: ThumbnailStyle;
    overlays: TextOverlay[];
    ffmpegCommand: string;
}

const stylePresets: Record<ThumbnailStyle, { titleSize: number; titleColor: string; subtitleSize: number; subtitleColor: string; bgOverlay?: string }> = {
    bold: { titleSize: 72, titleColor: '#FFFFFF', subtitleSize: 36, subtitleColor: '#FFD700', bgOverlay: 'drawbox=x=0:y=ih*0.6:w=iw:h=ih*0.4:color=black@0.7:t=fill' },
    minimal: { titleSize: 48, titleColor: '#FFFFFF', subtitleSize: 24, subtitleColor: '#CCCCCC' },
    gradient: { titleSize: 60, titleColor: '#FFFFFF', subtitleSize: 30, subtitleColor: '#E0E0E0', bgOverlay: 'gradientblur' },
    split: { titleSize: 56, titleColor: '#000000', subtitleSize: 28, subtitleColor: '#333333', bgOverlay: 'drawbox=x=0:y=0:w=iw/2:h=ih:color=white@0.9:t=fill' },
};

function positionToY(position: TextPosition): string {
    switch (position) {
        case 'top': return 'y=h*0.1';
        case 'center': return 'y=(h-text_h)/2';
        case 'bottom': return 'y=h*0.85-text_h';
    }
}

function buildFFmpegCommand(imageUrl: string, style: ThumbnailStyle, title: string, subtitle?: string): string {
    const preset = stylePresets[style];
    const filters: string[] = ['scale=1280:720'];

    if (preset.bgOverlay && preset.bgOverlay !== 'gradientblur') {
        filters.push(preset.bgOverlay);
    }

    const safeTitle = title.replace(/'/g, "'\\''").replace(/:/g, '\\:');
    filters.push(`drawtext=text='${safeTitle}':fontsize=${preset.titleSize}:fontcolor=${preset.titleColor}:x=(w-text_w)/2:${positionToY(subtitle ? 'center' : 'center')}`);

    if (subtitle) {
        const safeSub = subtitle.replace(/'/g, "'\\''").replace(/:/g, '\\:');
        filters.push(`drawtext=text='${safeSub}':fontsize=${preset.subtitleSize}:fontcolor=${preset.subtitleColor}:x=(w-text_w)/2:${positionToY('bottom')}`);
    }

    return `ffmpeg -i "${imageUrl}" -vf "${filters.join(', ')}" -frames:v 1 thumbnail_output.jpg`;
}

export function generateThumbnail(imageUrl: string, title: string, subtitle?: string, style: ThumbnailStyle = 'bold'): ThumbnailConfig {
    if (!imageUrl || !title) throw new Error('imageUrl and title are required');

    const preset = stylePresets[style];
    const overlays: TextOverlay[] = [
        {
            text: title,
            position: subtitle ? 'center' : 'center',
            fontSize: preset.titleSize,
            color: preset.titleColor,
            fontWeight: 'bold',
        },
    ];

    if (subtitle) {
        overlays.push({
            text: subtitle,
            position: 'bottom',
            fontSize: preset.subtitleSize,
            color: preset.subtitleColor,
            fontWeight: 'normal',
        });
    }

    return {
        imageUrl,
        width: 1280,
        height: 720,
        style,
        overlays,
        ffmpegCommand: buildFFmpegCommand(imageUrl, style, title, subtitle),
    };
}

export function getThumbnailFromScene(scene: Scene, style: ThumbnailStyle = 'bold'): ThumbnailConfig {
    return generateThumbnail(scene.imageUrl, scene.description, undefined, style);
}

import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';

const STORY_BIBLE_PATH = path.join(process.cwd(), 'StoryBible');
const ROOT_PATH = process.cwd();

export interface StoryContext {
    episodeId: string;
    content: string;
}

export async function loadStoryBibleContext(episodeId: string): Promise<string> {
    // In a real implementation this would use Vector Search.
    // For now, we'll crudely grep the markdown files for the episode ID.

    // Try to find the file that contains the episode.
    // Part 3: Week 1-2
    // Part 4: Week 3-4
    // Part 5: Week 5-6

    let targetFile = '';
    // Simple heuristic based on episode number
    if (episodeId.startsWith('1.') || episodeId.startsWith('2.')) {
        targetFile = 'Part3_Week1-2.MD';
    } else if (episodeId.startsWith('3.') || episodeId.startsWith('4.')) {
        targetFile = 'Part4_Week3-4.MD';
    } else if (episodeId.startsWith('5.') || episodeId.startsWith('6.')) {
        targetFile = 'Part5_Week5-6.MD';
    }

    if (!targetFile) {
        // Fallback check all
        // Not implemented for brevity, assuming standard format
        return "Context not found for this episode ID structure.";
    }

    try {
        // Check directly in root or StoryBible subdir
        let filePath = path.join(ROOT_PATH, targetFile);
        try {
            await fs.access(filePath);
        } catch {
            filePath = path.join(STORY_BIBLE_PATH, targetFile);
        }

        const content = await fs.readFile(filePath, 'utf-8');

        // Naive extraction: find the header for the episode and read until next header
        // Assumes format "### Episode X.X" or similar
        const episodeRegex = new RegExp(`Episode ${episodeId.replace('.', '\\.')}`, 'i');
        const match = content.match(episodeRegex);

        if (!match) {
            return `Episode ${episodeId} not found in ${targetFile}.`;
        }

        // Extract a chunk around it
        // In production: use proper markdown parsing or embedding retrieval
        const startIndex = Math.max(0, match.index! - 500);
        const endIndex = Math.min(content.length, match.index! + 3000);

        return content.substring(startIndex, endIndex);

    } catch (error) {
        console.error("Error reading Story Bible:", error);
        return "Error loading Story Bible context.";
    }
}

export async function loadBrandGuidelines(): Promise<string> {
    try {
        // Part 1 contains brand guidelines
        let filePath = path.join(ROOT_PATH, 'Part1_Foundation.MD');
        try {
            await fs.access(filePath);
        } catch {
            filePath = path.join(STORY_BIBLE_PATH, 'Part1_Foundation.MD');
        }

        const content = await fs.readFile(filePath, 'utf-8');
        return content; // Return full content for now as it's not huge
    } catch (e) {
        return "Brand guidelines not found.";
    }
}

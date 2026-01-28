
import { videoGenerationFlow } from '../src/flows/orchestration';
import { videoGenTool } from '../src/lib/agents';
import { loadStoryBibleContext } from '../src/lib/context';
import { ai } from '../src/genkit.config';
import { startFlowsServer } from '@genkit-ai/flow';

async function main() {
    console.log("--- TEST: Story Bible Context Loading ---");
    try {
        const episodeId = '1.1'; // Part 3, Week 1-2
        console.log(`Loading context for Episode ${episodeId}...`);
        const context = await loadStoryBibleContext(episodeId);
        console.log("Context loaded successfully.");
        console.log("Preview (first 100 chars):", context.substring(0, 100).replace(/\n/g, ' '));

        if (context.includes("not found")) {
            console.warn("⚠️ Warning: Context might be missing.");
        }

    } catch (e) {
        console.error("❌ Error loading context:", e);
    }

    console.log("\n--- TEST: Video Generation Flow ---");
    try {
        const result = await videoGenerationFlow({
            theme: "The intersection of AI and human creativity in the 21st century",
            characters: ["Maya Chen", "Marcus"]
        });

        console.log("Flow executed successfully.");
        console.log("Orchestration Status:", result.orchestrationStatus);

        console.log("\n--- OUTPUTS ---");
        console.log("Scene:", JSON.stringify(result.scene, null, 2));
        console.log("Narrative:", JSON.stringify(result.narrative, null, 2));
        console.log("Score:", JSON.stringify(result.score, null, 2));
        console.log("Previs:", JSON.stringify(result.previs, null, 2));

        // specific check for file paths or URLs
        const outputStr = JSON.stringify(result);
        if (outputStr.includes("http") || outputStr.includes("file://") || outputStr.includes(".mp4")) {
            console.log("\n✅ FOUND POTENTIAL MEDIA ASSETS:");
            // simple regex to find urls
            const urls = outputStr.match(/https?:\/\/[^\s"']+/g);
            if (urls) urls.forEach(u => console.log("- " + u));
        } else {
            console.log("\nℹ️ No media file paths or URLs detected in output.");
            console.log("Current implementation likely generates text/metadata only.");
        }

    } catch (error) {
        console.error("❌ Error executing flow:", error);
    }

    console.log("\n--- TEST: Direct Video Generation (Fal.ai) ---");
    try {
        console.log("Generating video from sample prompt...");
        const videoRes = await videoGenTool({
            sceneDescription: "Cyberpunk city street at night, rain falling, neon lights reflecting on wet pavement, cinematic lighting, 8k",
            imageUrl: undefined // Text to Video
        });
        console.log("Video Result:", JSON.stringify(videoRes, null, 2));
    } catch (e) {
        console.error("❌ Error generating video:", e);
    }
}


main().catch(console.error);

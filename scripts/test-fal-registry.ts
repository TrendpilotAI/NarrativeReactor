
import 'dotenv/config'; // Load env vars
import { FalRegistry } from '../src/lib/fal-registry';
import { generateImage, generateVideo } from '../src/lib/fal';
import { videoGenTool, previsImageTool } from '../src/lib/agents';

async function main() {
    console.log("--- TEST: FalRegistry List Models ---");
    const models = await FalRegistry.listModels();
    console.log(`Found ${models.length} models.`);
    if (models.length > 0) {
        console.log("First 3 models:", models.slice(0, 3).map(m => m.id));
    }

    console.log("\n--- TEST: FalRegistry Get Pricing ---");
    const pricing = await FalRegistry.getPricing(['fal-ai/bytedance/seedance/v1.5/pro/text-to-video']);
    console.log("Pricing for Seedance:", JSON.stringify(pricing, null, 2));

    // Optional: Test actual generation with cost tracking (skipped to save cost/time in this quick check, strictly verification of logic)
    // To enable, uncomment:
    /*
    console.log("\n--- TEST: Image Generation Cost ---");
    const imgRes = await generateImage("Test prompt for cost", "fal-ai/hunyuan-image/v3/instruct/text-to-image");
    console.log("Image Result:", imgRes);
    */
}

main().catch(console.error);

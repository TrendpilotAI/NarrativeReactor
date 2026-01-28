
import { generateContentFlow } from '../src/flows/content-generation';
import { ai } from '../src/genkit.config';

async function main() {
    console.log("Starting test-generate-content...");

    try {
        const result = await generateContentFlow({
            episodeId: '1.1',
            platform: 'twitter',
            useClaude: false
        });

        console.log("\n--- GENERATION RESULT ---");
        console.log(JSON.stringify(result, null, 2));

        if (result.compliance.passed) {
            console.log("\n✅ Compliance Passed");
        } else {
            console.log("\n❌ Compliance Failed");
            result.compliance.issues.forEach(issue => console.log(`- ${issue}`));
        }

    } catch (error) {
        console.error("Error executing flow:", error);
    }
}

main().catch(console.error);

import { generateContentFlow } from './flows/content-generation';
import { verifyBrandCompliance } from './flows/compliance';
import { videoGenerationFlow, agenticChatFlow } from './flows/orchestration';
import { getAuthUrlFlow, connectSocialAccountFlow, listIntegrationsFlow, postToSocialFlow, getPerformanceDataFlow, getMentionsFlow } from './flows/integrations';
import { listAssetsFlow, getAssetFlow, deleteAssetFlow } from './flows/assets';
import { startFlowServer } from '@genkit-ai/express';

// Start a server on port 3400 to serve the flows (restart trigger v7)
startFlowServer({
    flows: [
        generateContentFlow,
        verifyBrandCompliance,
        videoGenerationFlow,
        agenticChatFlow,
        getAuthUrlFlow,
        connectSocialAccountFlow,
        listIntegrationsFlow,
        postToSocialFlow,
        getPerformanceDataFlow,
        getMentionsFlow,
        listAssetsFlow,
        getAssetFlow,
        deleteAssetFlow,
    ],
    port: 3401,
    cors: {
        origin: '*',
    }
});

import 'dotenv/config';
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { vertexAI } from '@genkit-ai/vertexai';

export const ai = genkit({
    plugins: [
        googleAI(),
        vertexAI({ location: 'us-central1' }),
    ],
    model: 'googleai/gemini-1.5-flash', // Higher quota than 2.0-flash experimental
});

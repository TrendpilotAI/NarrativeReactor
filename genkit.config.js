"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ai = void 0;
const genkit_1 = require("genkit");
const google_genai_1 = require("@genkit-ai/google-genai");
const vertexai_1 = require("@genkit-ai/vertexai");
const firebase_1 = require("@genkit-ai/firebase");
exports.ai = (0, genkit_1.genkit)({
    plugins: [
        (0, google_genai_1.googleAI)(),
        (0, vertexai_1.vertexAI)({ location: 'us-central1' }),
        (0, firebase_1.firebase)(),
    ],
    model: 'googleai/gemini-3-flash-preview',
});

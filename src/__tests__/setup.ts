/**
 * Global test setup for NarrativeReactor backend tests.
 * 
 * This file runs before every test file. It:
 * 1. Sets NODE_ENV to 'test'
 * 2. Provides mock environment variables for external APIs
 * 3. Ensures no real API calls are made during tests
 */

process.env.NODE_ENV = 'test';

// Mock API keys — these prevent initialization errors in modules
// that check for env vars at import time.
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.SERPER_API_KEY = 'test-serper-key';
process.env.FAL_KEY = 'test-fal-key';
process.env.FAL_API_KEY = 'test-fal-key';
process.env.GOOGLE_GENAI_API_KEY = 'test-google-key';
process.env.TWITTER_CLIENT_ID = 'test-twitter-client-id';
process.env.TWITTER_CLIENT_SECRET = 'test-twitter-client-secret';
process.env.TWITTER_CALLBACK_URL = 'http://localhost:3010/integrations/callback';

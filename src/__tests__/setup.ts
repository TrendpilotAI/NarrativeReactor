/**
 * Global test setup for NarrativeReactor backend tests.
 *
 * Sets env vars so modules don't crash on import.
 * Uses in-memory DB to avoid file locking issues in parallel tests.
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.SERPER_API_KEY = 'test-serper-key';
process.env.FAL_KEY = 'test-fal-key';
process.env.FAL_API_KEY = 'test-fal-key';
process.env.GOOGLE_GENAI_API_KEY = 'test-google-key';
process.env.GOOGLE_API_KEY = 'test-google-key';
process.env.FISH_AUDIO_API_KEY = 'test-fish-audio-key';
process.env.X_API_KEY = 'test-x-key';
process.env.X_API_SECRET = 'test-x-secret';
process.env.TWITTER_CLIENT_ID = 'test-twitter-client-id';
process.env.TWITTER_CLIENT_SECRET = 'test-twitter-client-secret';
process.env.TWITTER_CALLBACK_URL = 'http://localhost:3010/integrations/callback';

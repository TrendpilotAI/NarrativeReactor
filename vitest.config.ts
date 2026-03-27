import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts', 'tests/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/**',
        'src/flows/**',
        'src/services/**',
        'src/middleware/**',
        'src/routes/**',
      ],
      exclude: [
        'src/index.ts',
        'src/genkit.config.ts',
        'src/services/publisher.ts',
        'src/services/schedulerWorker.ts',
        'src/services/tts.ts',
        'src/services/podcastGenerator.ts',
        'src/services/dialogue.ts',
        'src/services/videoStitcher.ts',
        'src/services/thumbnailGenerator.ts',
        'src/services/subtitles.ts',
        'src/services/trendpilotBridge.ts',
      ],
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 60,
      },
    },
    testTimeout: 15000,
  },
});

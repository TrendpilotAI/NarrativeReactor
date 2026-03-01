/**
 * OpenAPI 3.0 Specification for NarrativeReactor.
 *
 * Served at /docs (Swagger UI) and /docs/openapi.json (raw spec).
 * No external dependencies — Swagger UI loaded from CDN.
 */

import { Router, Request, Response } from 'express';

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'NarrativeReactor API',
    version: '1.0.0',
    description: 'AI-powered content generation platform for Signal Studio. Generates multi-format content, manages campaigns, handles brand compliance, and publishes to social platforms.',
  },
  servers: [
    { url: '/', description: 'Current server' },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
      },
      Draft: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          topic: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'approved', 'rejected', 'published'] },
          formats: {
            type: 'object',
            properties: {
              xThread: { type: 'string' },
              linkedinPost: { type: 'string' },
              blogArticle: { type: 'string' },
            },
          },
          research: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Campaign: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          theme: { type: 'string' },
          days: { type: 'integer' },
          postsPerDay: { type: 'integer' },
          status: { type: 'string' },
        },
      },
      Brand: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          guidelines: { type: 'string' },
          voiceTone: { type: 'string' },
          colors: { type: 'array', items: { type: 'string' } },
          targetAudience: { type: 'string' },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          service: { type: 'string', example: 'NarrativeReactor' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['System'],
        security: [],
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } } } },
      },
    },
    // Content Pipeline
    '/api/pipeline/generate': {
      post: {
        summary: 'Generate multi-format content from a topic',
        tags: ['Content Pipeline'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['topic'], properties: { topic: { type: 'string' }, context: { type: 'string' }, useClaude: { type: 'boolean' }, brandGuidelines: { type: 'string' } } } } },
        },
        responses: {
          '201': { description: 'Draft created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Draft' } } } },
          '400': { description: 'Missing topic' },
          '500': { description: 'Server error' },
        },
      },
    },
    '/api/pipeline/drafts': {
      get: {
        summary: 'List all drafts',
        tags: ['Content Pipeline'],
        parameters: [{ name: 'status', in: 'query', schema: { type: 'string' } }],
        responses: { '200': { description: 'Array of drafts' } },
      },
    },
    '/api/pipeline/drafts/{id}': {
      get: {
        summary: 'Get a specific draft',
        tags: ['Content Pipeline'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Draft object' }, '404': { description: 'Not found' } },
      },
    },
    '/api/pipeline/drafts/{id}/approve': {
      post: {
        summary: 'Approve a draft',
        tags: ['Content Pipeline'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Approved draft' }, '404': { description: 'Not found' } },
      },
    },
    '/api/pipeline/drafts/{id}/reject': {
      post: {
        summary: 'Reject a draft with feedback',
        tags: ['Content Pipeline'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['feedback'], properties: { feedback: { type: 'string' } } } } } },
        responses: { '200': { description: 'Rejected draft' }, '404': { description: 'Not found' } },
      },
    },
    // Publishing
    '/api/pipeline/publish': {
      post: {
        summary: 'Publish a draft via Blotato',
        tags: ['Publishing'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['draftId', 'platforms', 'format'], properties: { draftId: { type: 'string' }, platforms: { type: 'array', items: { type: 'string' } }, format: { type: 'string', enum: ['xThread', 'linkedinPost', 'blogArticle'] }, scheduledAt: { type: 'string', format: 'date-time' } } } } },
        },
        responses: { '200': { description: 'Published' } },
      },
    },
    '/api/pipeline/queue': {
      get: { summary: 'Get publishing queue', tags: ['Publishing'], responses: { '200': { description: 'Queue items' } } },
    },
    // Campaigns
    '/api/campaigns': {
      get: { summary: 'List all campaigns', tags: ['Campaigns'], responses: { '200': { description: 'Array of campaigns' } } },
      post: {
        summary: 'Create a campaign',
        tags: ['Campaigns'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['theme', 'days', 'postsPerDay'], properties: { theme: { type: 'string' }, days: { type: 'integer' }, postsPerDay: { type: 'integer' }, name: { type: 'string' } } } } } },
        responses: { '201': { description: 'Campaign created' } },
      },
    },
    '/api/campaigns/{id}': {
      get: {
        summary: 'Get a campaign',
        tags: ['Campaigns'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Campaign' }, '404': { description: 'Not found' } },
      },
      delete: {
        summary: 'Delete a campaign',
        tags: ['Campaigns'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Deleted' }, '404': { description: 'Not found' } },
      },
    },
    // Brands
    '/api/brands': {
      get: { summary: 'List all brands', tags: ['Brands'], responses: { '200': { description: 'Array of brands' } } },
      post: {
        summary: 'Create a brand',
        tags: ['Brands'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, guidelines: { type: 'string' }, voiceTone: { type: 'string' }, colors: { type: 'array', items: { type: 'string' } }, targetAudience: { type: 'string' } } } } } },
        responses: { '201': { description: 'Brand created' } },
      },
    },
    // Social
    '/api/social/post': {
      post: {
        summary: 'Post to a social platform',
        tags: ['Social'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['provider', 'message'], properties: { provider: { type: 'string' }, message: { type: 'string' } } } } } },
        responses: { '200': { description: 'Posted' } },
      },
    },
    '/api/social/integrations': {
      get: { summary: 'List connected social accounts', tags: ['Social'], responses: { '200': { description: 'Integrations' } } },
    },
    // Calendar
    '/api/calendar': {
      get: {
        summary: 'List scheduled posts',
        tags: ['Calendar'],
        parameters: [
          { name: 'start', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'end', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { '200': { description: 'Scheduled posts' } },
      },
      post: {
        summary: 'Schedule a post',
        tags: ['Calendar'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['content', 'platform', 'scheduledAt'], properties: { content: { type: 'string' }, platform: { type: 'string' }, scheduledAt: { type: 'string', format: 'date-time' } } } } } },
        responses: { '201': { description: 'Scheduled' } },
      },
    },
    // Audio
    '/api/audio/tts': {
      post: {
        summary: 'Text to speech',
        tags: ['Audio'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' }, voiceId: { type: 'string' } } } } } },
        responses: { '200': { description: 'Audio result' } },
      },
    },
    // Content Generation (Genkit)
    '/api/generate': {
      post: {
        summary: 'Generate content for an episode/platform',
        tags: ['Content Generation'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['episodeId', 'platform'], properties: { episodeId: { type: 'string' }, platform: { type: 'string' }, useClaude: { type: 'boolean' } } } } } },
        responses: { '200': { description: 'Generated content' } },
      },
    },
    '/api/compliance': {
      post: {
        summary: 'Check brand compliance',
        tags: ['Content Generation'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['content', 'platform'], properties: { content: { type: 'string' }, platform: { type: 'string' } } } } } },
        responses: { '200': { description: 'Compliance result' } },
      },
    },
    // Costs
    '/api/costs': {
      get: { summary: 'Get cost tracking summary', tags: ['System'], responses: { '200': { description: 'Cost breakdown' } } },
    },
    // Agents
    '/api/agents/message': {
      post: { summary: 'Send message to agent communication bus', tags: ['Agents'], responses: { '200': { description: 'Message received' } } },
    },
    '/api/agents/log': {
      get: { summary: 'Get agent message log', tags: ['Agents'], responses: { '200': { description: 'Message log' } } },
    },
    // Trends
    '/api/trends': {
      get: { summary: 'Fetch trending topics', tags: ['Trends'], responses: { '200': { description: 'Trending topics' } } },
    },
    // Competitors
    '/api/competitors': {
      get: { summary: 'List tracked competitors', tags: ['Intelligence'], responses: { '200': { description: 'Competitors' } } },
      post: {
        summary: 'Add a competitor to track',
        tags: ['Intelligence'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'platforms'], properties: { name: { type: 'string' }, platforms: { type: 'array', items: { type: 'string' } } } } } } },
        responses: { '201': { description: 'Competitor added' } },
      },
    },
    // Optimal Times
    '/api/optimal-times': {
      get: {
        summary: 'Get optimal posting times for a platform',
        tags: ['Intelligence'],
        parameters: [
          { name: 'platform', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'timezone', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Optimal times' } },
      },
    },
  },
  tags: [
    { name: 'System', description: 'Health, costs, monitoring' },
    { name: 'Content Pipeline', description: 'Topic → research → multi-format draft generation' },
    { name: 'Publishing', description: 'Blotato cross-platform publishing' },
    { name: 'Campaigns', description: 'Multi-day campaign management' },
    { name: 'Brands', description: 'Brand management and voice analysis' },
    { name: 'Social', description: 'Social media posting and analytics' },
    { name: 'Calendar', description: 'Post scheduling' },
    { name: 'Audio', description: 'TTS, podcasts, dialogue' },
    { name: 'Content Generation', description: 'Genkit AI flows' },
    { name: 'Agents', description: 'Inter-agent communication' },
    { name: 'Trends', description: 'Trendpilot integration' },
    { name: 'Intelligence', description: 'Competitor tracking, hashtag discovery, posting optimization' },
  ],
};

const swaggerHtml = `<!DOCTYPE html>
<html>
<head>
  <title>NarrativeReactor API Docs</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/docs/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
    });
  </script>
</body>
</html>`;

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.type('html').send(swaggerHtml);
});

router.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(spec);
});

export default router;
export { spec };

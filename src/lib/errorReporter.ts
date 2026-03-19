/**
 * Error Reporter — Lightweight error tracking via Sentry HTTP API.
 *
 * No SDK dependency — uses fetch to POST to Sentry's envelope endpoint.
 * Falls back gracefully when SENTRY_DSN is not configured.
 *
 * Usage:
 *   import { captureException, captureMessage } from './errorReporter';
 *   captureException(error);
 *   captureMessage('Something happened', 'warning');
 */

import crypto from 'crypto';

interface SentryDsnParts {
  publicKey: string;
  host: string;
  projectId: string;
}

let dsnParts: SentryDsnParts | null = null;

function parseDsn(): SentryDsnParts | null {
  if (dsnParts) return dsnParts;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;

  try {
    const url = new URL(dsn);
    dsnParts = {
      publicKey: url.username,
      host: `${url.protocol}//${url.host}`,
      projectId: url.pathname.replace('/', ''),
    };
    return dsnParts;
  } catch {
    console.warn('[errorReporter] Invalid SENTRY_DSN — error reporting disabled');
    return null;
  }
}

function makeEventId(): string {
  return crypto.randomBytes(16).toString('hex');
}

function scrubSensitive(data: Record<string, unknown>): Record<string, unknown> {
  const scrubKeys = ['API_KEY', 'TOKEN_ENCRYPTION_KEY', 'JWT_SECRET', 'DASHBOARD_PASSWORD',
    'X_CLIENT_SECRET', 'LINKEDIN_CLIENT_SECRET', 'WEBHOOK_SECRET', 'SENTRY_DSN',
    'ANTHROPIC_API_KEY', 'GOOGLE_GENAI_API_KEY', 'FAL_KEY'];
  const result = { ...data };
  for (const key of scrubKeys) {
    if (key in result) result[key] = '[REDACTED]';
  }
  return result;
}

async function sendEnvelope(event: Record<string, unknown>): Promise<void> {
  const parts = parseDsn();
  if (!parts) return;

  const envelope = [
    JSON.stringify({
      event_id: event.event_id,
      sent_at: new Date().toISOString(),
      dsn: process.env.SENTRY_DSN,
    }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');

  try {
    const url = `${parts.host}/api/${parts.projectId}/envelope/`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parts.publicKey}, sentry_client=narrative-reactor/1.0`,
      },
      body: envelope,
    });
  } catch (err) {
    // Silently fail — error reporting should never crash the app
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[errorReporter] Failed to send event:', (err as Error).message);
    }
  }
}

/**
 * Capture an exception and report it to Sentry.
 */
export async function captureException(error: Error, extra?: Record<string, unknown>): Promise<string> {
  const eventId = makeEventId();

  console.error(`[error] ${error.message} (event: ${eventId})`);

  const event: Record<string, unknown> = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: 'error',
    server_name: process.env.HOSTNAME || 'narrative-reactor',
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || '1.0.0',
    exception: {
      values: [
        {
          type: error.name,
          value: error.message,
          stacktrace: error.stack
            ? {
                frames: error.stack
                  .split('\n')
                  .slice(1)
                  .map((line) => {
                    const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
                    if (match) {
                      return { function: match[1], filename: match[2], lineno: +match[3], colno: +match[4] };
                    }
                    const match2 = line.match(/at\s+(.+?):(\d+):(\d+)/);
                    if (match2) {
                      return { filename: match2[1], lineno: +match2[2], colno: +match2[3] };
                    }
                    return { filename: line.trim() };
                  })
                  .reverse(),
              }
            : undefined,
        },
      ],
    },
    extra: extra ? scrubSensitive(extra) : undefined,
    tags: {
      service: 'narrative-reactor',
      node_version: process.version,
    },
  };

  await sendEnvelope(event);
  return eventId;
}

/**
 * Capture a message (breadcrumb-style) and report to Sentry.
 */
export async function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  extra?: Record<string, unknown>
): Promise<string> {
  const eventId = makeEventId();

  const event: Record<string, unknown> = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'node',
    level,
    server_name: process.env.HOSTNAME || 'narrative-reactor',
    environment: process.env.NODE_ENV || 'development',
    message: { formatted: message },
    extra: extra ? scrubSensitive(extra) : undefined,
    tags: {
      service: 'narrative-reactor',
      node_version: process.version,
    },
  };

  await sendEnvelope(event);
  return eventId;
}

/**
 * Check if error reporting is configured.
 */
export function isConfigured(): boolean {
  return parseDsn() !== null;
}

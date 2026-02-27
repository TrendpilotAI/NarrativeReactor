/**
 * Startup environment validation.
 * Call validateEnv() early in your app startup (before binding to a port).
 * In production, throws if any required variable is missing.
 * In development, logs warnings but continues.
 */

const REQUIRED_VARS: string[] = ['API_KEY'];

export function validateEnv(): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const missing = REQUIRED_VARS.filter((v) => !process.env[v]);

    if (missing.length === 0) return;

    const msg = `Missing required environment variable(s): ${missing.join(', ')}`;

    if (isProduction) {
        throw new Error(`[env] FATAL — ${msg}. Refusing to start in production without required config.`);
    }

    console.warn('');
    console.warn('⚠️  [env] WARNING — ' + msg);
    console.warn('⚠️  [env] Continuing in development mode, but this WILL fail in production.');
    console.warn('');
}

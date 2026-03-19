/**
 * Startup environment validation.
 * Call validateEnv() early in your app startup (before binding to a port).
 * In production, throws if any required variable is missing.
 * In development, logs warnings but continues.
 */

const REQUIRED_VARS: string[] = ['API_KEY'];

// Billing vars — warn if missing (not hard-fail in dev, since billing may be optional locally)
const BILLING_VARS: string[] = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_STARTER', 'STRIPE_PRICE_PRO'];

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

// Non-fatal billing env check — runs on startup, warns but never throws
export function validateBillingEnv(): void {
    const missing = BILLING_VARS.filter((v) => !process.env[v]);
    if (missing.length > 0) {
        console.warn(`⚠️  [billing] Missing Stripe env vars: ${missing.join(', ')} — billing features will be unavailable.`);
    }
}

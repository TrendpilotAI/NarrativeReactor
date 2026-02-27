/**
 * Production Guard — prevents destructive operations when NODE_ENV=production.
 *
 * Usage:
 *   import { guardDestructive } from '../lib/productionGuard';
 *   guardDestructive('wipe content library'); // throws in production
 */

export class ProductionGuardError extends Error {
    constructor(operation: string) {
        super(
            `Destructive operation "${operation}" is blocked in production (NODE_ENV=production). ` +
            `Set NODE_ENV to "development" or "test" to allow this operation.`
        );
        this.name = 'ProductionGuardError';
    }
}

/**
 * Throws ProductionGuardError if NODE_ENV is "production".
 * Call this at the top of any destructive operation handler.
 */
export function guardDestructive(operationName: string): void {
    if (process.env.NODE_ENV === 'production') {
        throw new ProductionGuardError(operationName);
    }
}

/**
 * Returns true if running in production, false otherwise.
 */
export function isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
}

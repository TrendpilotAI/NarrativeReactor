/**
 * Type declarations for Node.js built-in `node:sqlite` module (Node 22+).
 * These types are not yet included in @types/node v20.
 */
declare module 'node:sqlite' {
  interface StatementResultingChanges {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  interface StatementSync {
    run(...params: unknown[]): StatementResultingChanges;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    iterate(...params: unknown[]): IterableIterator<unknown>;
  }

  class DatabaseSync {
    constructor(location: string, options?: { open?: boolean; readOnly?: boolean; enableForeignKeyConstraints?: boolean });
    open(): void;
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T;
  }

  export { DatabaseSync, StatementSync, StatementResultingChanges };
}

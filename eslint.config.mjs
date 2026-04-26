import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const tsRules = {
    ...tsPlugin.configs.recommended.rules,
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/no-unsafe-function-type': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'no-console': 'off',
    'no-undef': 'off',
    'no-unused-vars': 'off',
};

export default defineConfig([
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'coverage/**',
            'test-results/**',
            'quality-reports/**',
            'dashboard/**',
            'web-ui/**',
            'postiz-app/**',
            '*.js',
            '*.mjs',
            'vitest.config.ts',
        ],
    },
    js.configs.recommended,
    {
        files: ['src/**/*.ts', 'genkit.config.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                tsconfigRootDir: import.meta.dirname,
                ecmaVersion: 2022,
                sourceType: 'module',
            },
            globals: {
                ...globals.node,
                ...globals.es2022,
                fetch: 'readonly',
                RequestInit: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: tsRules,
    },
    {
        files: ['src/**/__tests__/**/*.ts', 'src/__tests__/**/*.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/unbound-method': 'off',
        },
    },
]);

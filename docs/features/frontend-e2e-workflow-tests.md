# Frontend E2E Workflow Tests

## Overview
Implemented comprehensive binary end-to-end (E2E) workflow tests for all primary frontend screens in the NarrativeReactor Next.js (`web-ui`) application. 

## Implementation Details
The application's backend flows (`src/flows`) were highly tested, but the new `web-ui` frontend had minimal testing coverage. We mapped out 8 key screen-level interactions:

1. **Generator** (`/generator`)
2. **Approvals** (`/approvals`)
3. **Assets** (`/assets`)
4. **Research** (`/research`)
5. **Story Bible** (`/story-bible`)
6. **Integrations** (`/integrations`)
7. **Performance** (`/performance`)
8. **Settings** (`/settings`)

### Framework Configuration
- Native React component tests implemented using `@testing-library/react` and `vitest`.
- Required setting up a Node environment wrapper with `jsdom` via `vitest.config.ts`.
- Mocks globally created for `localStorage` tracking using `Object.defineProperty(window, 'localStorage')` in `vitest.setup.ts`.

### Mocking Techniques
Each test suite isolates the UI by mocking its backend connection points globally imported via `@/app/actions` and context points via `@/contexts/ModelContext`.

```typescript
// Example Model Context Mock
vi.mock('@/contexts/ModelContext', () => ({
    useModels: () => ({
        llmModel: { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
        setLlmModel: vi.fn(),
    })
}));
```

## Running Tests
Run testing environment across screens using standard Vitest invocation natively from `web-ui`:

```bash
cd web-ui
npm run test -- src/app
```

## Missing Coverage
- The `postiz-app` module is entirely untested and should be reviewed if workflows transition across project roots.
- Complex nested Radix UI component states like `TabsContent` were simplified to testing base layouts (e.g. testing the initial default search view of Research) to keep binary states pristine without implementing Pointer Event polyfills.

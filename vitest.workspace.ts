import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      include: ['**/*.spec.ts', '**/*.arch.spec.ts'],
      exclude: [
        '**/*.integration.spec.ts',
        '**/*.isolation.spec.ts',
        '**/*.e2e.spec.ts',
        '**/node_modules/**',
        '**/dist/**',
      ],
    },
  },
  {
    test: {
      name: 'integration',
      include: ['**/*.integration.spec.ts', '**/*.e2e.spec.ts'],
      setupFiles: ['packages/test-utils/src/helpers/setup-db.ts'],
    },
  },
  {
    test: {
      name: 'isolation',
      include: ['**/*.isolation.spec.ts'],
      setupFiles: ['packages/test-utils/src/helpers/setup-db.ts'],
    },
  },
])

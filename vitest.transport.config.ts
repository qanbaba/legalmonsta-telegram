import { defineConfig } from 'vitest/config';

// Worker transport tests use synthetic sockets and need no UI or local-only setup
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/lib/gramjs/extensions/PromisedWebSockets.test.ts'],
  },
});

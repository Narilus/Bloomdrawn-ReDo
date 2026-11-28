import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
    // The persistent module cache keeps a file's import.meta.glob results while the file itself is
    // unchanged, so art added to src/assets/ went unseen (cardArt.test.ts). Every run transforms fresh.
    fsModuleCache: false,
  },
});

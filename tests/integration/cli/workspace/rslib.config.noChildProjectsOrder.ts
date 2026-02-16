import { defineConfig } from '@rslib/core';

export default defineConfig({
  projects: [
    'packages/z-empty/*',
    'packages/a-empty/*',
    '  packages/z-empty/*  ',
  ],
});

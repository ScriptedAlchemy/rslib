import { defineConfig } from '@rslib/core';

export default defineConfig({
  projects: ['packages/*'],
  // Invalid mixed mode config: workspace root should not define lib.
  lib: [
    {
      format: 'esm',
    },
  ],
});

import { defineConfig } from '@rslib/core';

export default defineConfig({
  projects: ['packages/*', 1 as unknown as string],
});

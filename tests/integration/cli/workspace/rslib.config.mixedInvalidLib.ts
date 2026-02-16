import { defineConfig } from '@rslib/core';

export default defineConfig({
  projects: ['packages/*'],
  lib: 'esm' as unknown as [],
});

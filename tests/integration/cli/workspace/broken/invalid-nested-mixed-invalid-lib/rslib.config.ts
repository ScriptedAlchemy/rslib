import { defineConfig } from '@rslib/core';

export default defineConfig({
  projects: ['apps/*'],
  lib: 'esm' as unknown as [],
});

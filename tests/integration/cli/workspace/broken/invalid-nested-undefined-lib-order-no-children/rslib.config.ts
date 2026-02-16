import { defineConfig } from '@rslib/core';

export default defineConfig({
  projects: ['apps-z/*', 'apps-a/*', '  apps-z/*  '],
  lib: undefined,
});

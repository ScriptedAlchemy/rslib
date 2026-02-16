import { defineConfig } from '@rslib/core';

export default defineConfig({
  projects: [
    'packages/group-z/shared',
    'packages/group-y/shared',
    'packages/group-b/common',
    'packages/group-a/common',
  ],
});

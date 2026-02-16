import { defineConfig } from '@rslib/core';

export default defineConfig({
  projects: 'packages/*' as unknown as string[],
});

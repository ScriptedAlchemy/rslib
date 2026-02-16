import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@rslib/core';
import { generateBundleEsmConfig } from 'test-helper';

const ensureSharedBuiltPlugin = () => ({
  name: 'ensure-shared-built',
  setup(api: any) {
    api.onBeforeBuild(() => {
      const sharedOutputs = [
        path.join(import.meta.dirname, '../shared/dist/index.js'),
        path.join(import.meta.dirname, '../shared/dist/index.mjs'),
      ];

      if (!sharedOutputs.some((sharedOutput) => existsSync(sharedOutput))) {
        throw new Error(
          `Expected shared package to be built first. Missing one of: ${sharedOutputs.join(', ')}`,
        );
      }
    });
  },
});

export default defineConfig({
  lib: [
    generateBundleEsmConfig({
      output: {
        distPath: './dist',
      },
    }),
  ],
  plugins: [ensureSharedBuiltPlugin()],
});

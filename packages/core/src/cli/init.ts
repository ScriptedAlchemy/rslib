import path from 'node:path';
import type { RsbuildEntry } from '@rsbuild/core';
import { createRslib } from '../createRslib';
import { loadConfig as baseLoadConfig } from '../loadConfig';
import { mergeRslibConfig } from '../mergeConfig';
import type {
  LibConfig,
  RsbuildConfigOutputTarget,
  RslibConfig,
  RslibInstance,
  RslibUserConfig,
  RslibWorkspaceConfig,
} from '../types';
import { ensureAbsolutePath } from '../utils/helper';
import { logger } from '../utils/logger';
import {
  isWorkspaceConfig,
  type ResolvedRslibProject,
  resolveWorkspaceProjects,
} from '../workspace';
import type { BuildOptions, CommonOptions } from './commands';

export class WorkspaceConfigError extends Error {
  constructor() {
    super('Workspace projects config detected.');
    this.name = 'WorkspaceConfigError';
  }
}

export const isWorkspaceConfigError = (
  error: unknown,
): error is WorkspaceConfigError => {
  return error instanceof WorkspaceConfigError;
};

const getEnvDir = (cwd: string, envDir?: string) => {
  if (envDir) {
    return path.isAbsolute(envDir) ? envDir : path.resolve(cwd, envDir);
  }
  return cwd;
};

export const resolveCliRoot = (options: CommonOptions): string => {
  const cwd = process.cwd();
  return options.root ? ensureAbsolutePath(cwd, options.root) : cwd;
};

export const parseEntryOption = (
  entries?: string[],
): Record<string, string> | undefined => {
  if (!entries?.length) return undefined;

  const entryList: { key: string; value: string; explicit: boolean }[] = [];

  for (const rawEntry of entries) {
    const value = rawEntry?.trim();
    if (!value) continue;

    const equalIndex = value.indexOf('=');
    if (equalIndex > -1) {
      const name = value.slice(0, equalIndex).trim();
      const entryPath = value.slice(equalIndex + 1).trim();
      if (name && entryPath) {
        entryList.push({ key: name, value: entryPath, explicit: true });
        continue;
      }
    }

    const basename = path.basename(value, path.extname(value));
    entryList.push({ key: basename, value, explicit: false });
  }

  const keyCount: Record<string, number> = {};
  for (const { key, explicit } of entryList) {
    if (!explicit) keyCount[key] = (keyCount[key] ?? 0) + 1;
  }

  const keyIndex: Record<string, number> = {};
  const parsed: Record<string, string> = {};

  for (const { key, value, explicit } of entryList) {
    const needsIndex = !explicit && (keyCount[key] ?? 0) > 1;
    const finalKey = needsIndex ? `${key}${keyIndex[key] ?? 0}` : key;
    if (needsIndex) keyIndex[key] = (keyIndex[key] ?? 0) + 1;
    parsed[finalKey] = value;
  }

  return Object.keys(parsed).length ? parsed : undefined;
};

export const applyCliOptions = (
  config: RslibConfig,
  options: BuildOptions,
  root: string,
): void => {
  if (options.root) {
    config.root = root;
  }

  if (options.logLevel) {
    config.logLevel = options.logLevel;
  }

  for (const lib of config.lib) {
    if (options.format !== undefined) lib.format = options.format;
    if (options.bundle !== undefined) lib.bundle = options.bundle;
    if (options.tsconfig !== undefined) {
      lib.source ||= {};
      lib.source.tsconfigPath = options.tsconfig;
    }
    const entry = parseEntryOption(options.entry);
    if (entry !== undefined) {
      lib.source ||= {};
      lib.source.entry = entry as RsbuildEntry;
    }
    const syntax = options.syntax;
    if (syntax !== undefined) lib.syntax = syntax;
    if (options.dts !== undefined) lib.dts = options.dts;
    if (options.autoExtension !== undefined)
      lib.autoExtension = options.autoExtension;
    if (options.autoExternal !== undefined)
      lib.autoExternal = options.autoExternal;
    lib.output ??= {};
    if (options.target !== undefined)
      lib.output.target = options.target as RsbuildConfigOutputTarget;
    if (options.minify !== undefined) lib.output.minify = options.minify;
    if (options.clean !== undefined) lib.output.cleanDistPath = options.clean;
    const externals = options.externals?.filter(Boolean) ?? [];
    if (externals.length > 0) lib.output.externals = externals;
    if (options.distPath) {
      lib.output.distPath = {
        ...(typeof lib.output.distPath === 'object' ? lib.output.distPath : {}),
        root: options.distPath,
      };
    }
  }
};

const loadRawConfig = async (
  options: CommonOptions,
  root: string,
): Promise<{ config: RslibUserConfig; configFilePath: string | null }> => {
  const { content: config, filePath: configFilePath } = await baseLoadConfig({
    cwd: root,
    path: options.config,
    envMode: options.envMode,
    loader: options.configLoader,
  });

  return { config, configFilePath };
};

const loadSingleProjectConfig = async (
  options: CommonOptions,
  root: string,
): Promise<RslibConfig> => {
  const { config: loadedConfig, configFilePath } = await loadRawConfig(
    options,
    root,
  );

  if (isWorkspaceConfig(loadedConfig)) {
    throw new WorkspaceConfigError();
  }

  const config = loadedConfig as RslibConfig;

  if (configFilePath === null) {
    config.lib = [{} satisfies LibConfig];
    logger.debug('Falling back to CLI options for the default library.');
  }

  applyCliOptions(config, options, root);

  return config;
};

export const cloneRslibConfig = (config: RslibConfig): RslibConfig => {
  return mergeRslibConfig(config) as RslibConfig;
};

export const initWithConfig = async ({
  options,
  root,
  config,
}: {
  options: CommonOptions;
  root: string;
  config: RslibConfig;
}): Promise<RslibInstance> => {
  const rslib = await createRslib({
    cwd: root,
    config: cloneRslibConfig(config),
    loadEnv:
      options.env === false
        ? false
        : {
            cwd: getEnvDir(root, options.envDir),
            mode: options.envMode,
          },
  });

  return rslib;
};

export async function init(options: CommonOptions): Promise<RslibInstance> {
  const root = resolveCliRoot(options);
  const rslib = await createRslib({
    cwd: root,
    config: () => loadSingleProjectConfig(options, root),
    loadEnv:
      options.env === false
        ? false
        : {
            cwd: getEnvDir(root, options.envDir),
            mode: options.envMode,
          },
  });
  return rslib;
}

export type WorkspaceInitResult = {
  root: string;
  configFilePath: string;
  config: RslibWorkspaceConfig;
  projects: ResolvedRslibProject[];
};

export const initWorkspace = async ({
  options,
  includeDependencies,
}: {
  options: CommonOptions;
  includeDependencies?: boolean;
}): Promise<WorkspaceInitResult | null> => {
  const root = resolveCliRoot(options);
  const { config, configFilePath } = await loadRawConfig(options, root);

  if (!configFilePath || !isWorkspaceConfig(config)) {
    return null;
  }

  const projects = await resolveWorkspaceProjects({
    config,
    cwd: root,
    envMode: options.envMode,
    configLoader: options.configLoader,
    projectFilters: options.project,
    includeDependencies,
  });

  return {
    root,
    configFilePath,
    config,
    projects,
  };
};

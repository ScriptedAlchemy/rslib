import fs from 'node:fs';
import path, { basename, dirname, join } from 'node:path';
import { glob, isDynamicPattern } from 'tinyglobby';
import { type ConfigLoader, loadConfig } from './loadConfig';
import type {
  RslibConfig,
  RslibUserConfig,
  RslibWorkspaceConfig,
} from './types';
import { color } from './utils/color';
import { ensureAbsolutePath } from './utils/helper';

export type ResolvedRslibProject = {
  name: string;
  root: string;
  configFilePath: string;
  config: RslibConfig;
  packageName?: string;
  dependencies: string[];
};

type ResolvedRslibProjectWithDependencyPackages = Omit<
  ResolvedRslibProject,
  'dependencies'
> & {
  dependencyPackageNames: string[];
};

const DEPENDENCY_FIELDS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
  'devDependencies',
] as const;

const isLeafProjectConfig = (
  config: RslibUserConfig,
): config is RslibConfig => {
  return (
    !isWorkspaceConfig(config) &&
    Array.isArray((config as RslibConfig).lib) &&
    (config as RslibConfig).lib.length > 0
  );
};

export const isWorkspaceConfig = (
  config: RslibUserConfig,
): config is RslibWorkspaceConfig => {
  return Array.isArray((config as RslibWorkspaceConfig).projects);
};

const readProjectPackageJson = (
  projectRoot: string,
): { name?: string; dependencyPackageNames: string[] } => {
  const packageJsonPath = join(projectRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return { dependencyPackageNames: [] };
  }

  try {
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8'),
    ) as Record<string, unknown>;
    const name =
      typeof packageJson.name === 'string' ? packageJson.name : undefined;
    const dependencyPackageNames = DEPENDENCY_FIELDS.flatMap((field) => {
      const section = packageJson[field];
      if (section && typeof section === 'object') {
        return Object.keys(section);
      }
      return [];
    });

    return {
      name,
      dependencyPackageNames: Array.from(new Set(dependencyPackageNames)),
    };
  } catch {
    return { dependencyPackageNames: [] };
  }
};

const ensureWorkspaceProjectConfig = (
  config: RslibWorkspaceConfig,
  configFilePath?: string,
): void => {
  const location = configFilePath ? ` in ${color.cyan(configFilePath)}` : '';

  if (!Array.isArray(config.projects) || config.projects.length === 0) {
    throw new Error(
      `Expect ${color.cyan('"projects"')} to be a non-empty array in workspace mode${location}.`,
    );
  }
  let hasNonEmptyProjectEntry = false;
  for (const [index, projectEntry] of config.projects.entries()) {
    if (typeof projectEntry !== 'string') {
      throw new Error(
        `Expect every item in ${color.cyan('"projects"')} to be a string path or glob${location}, but received ${color.cyan(typeof projectEntry)} at index ${color.cyan(String(index))}.`,
      );
    }
    if (projectEntry.trim()) {
      hasNonEmptyProjectEntry = true;
    }
  }
  if (!hasNonEmptyProjectEntry) {
    throw new Error(
      `Expect ${color.cyan('"projects"')} to contain at least one non-empty project path or glob${location}.`,
    );
  }
  const libField =
    'lib' in config ? (config as { lib?: unknown }).lib : undefined;
  if (libField !== undefined) {
    throw new Error(
      `The ${color.cyan('"projects"')} and ${color.cyan('"lib"')} fields cannot be used together in one config${location}. Split them into a workspace config and child project configs.`,
    );
  }
};

function ensureLeafProjectConfig(
  config: RslibUserConfig,
  configFilePath: string,
): asserts config is RslibConfig {
  const projectsField =
    'projects' in config
      ? (config as { projects: unknown }).projects
      : undefined;

  if (projectsField !== undefined && !Array.isArray(projectsField)) {
    throw new Error(
      `Expect ${color.cyan('"projects"')} to be a non-empty array in workspace mode in ${color.cyan(configFilePath)}.`,
    );
  }

  if (isWorkspaceConfig(config)) {
    throw new Error(
      `Cannot use nested workspace config ${color.cyan(configFilePath)} as a leaf project.`,
    );
  }

  if (!Array.isArray(config.lib) || config.lib.length === 0) {
    throw new Error(
      `Cannot resolve child project from ${color.cyan(configFilePath)} because ${color.cyan('"lib"')} is missing or empty.`,
    );
  }
}

const resolveProjectEntryPaths = async (
  projectEntry: string,
  root: string,
): Promise<string[]> => {
  const normalizedEntry = projectEntry.trim();
  if (!normalizedEntry) {
    return [];
  }

  const resolvedEntry = path.isAbsolute(normalizedEntry)
    ? normalizedEntry
    : path.resolve(root, normalizedEntry);

  if (isDynamicPattern(normalizedEntry)) {
    return glob(normalizedEntry, {
      cwd: root,
      absolute: true,
      dot: true,
      onlyFiles: false,
      expandDirectories: false,
      ignore: ['**/node_modules/**', '**/.DS_Store'],
    });
  }

  if (!fs.existsSync(resolvedEntry)) {
    throw new Error(
      `Can't resolve project ${color.cyan(`"${projectEntry}"`)}, please make sure ${color.cyan(resolvedEntry)} exists.`,
    );
  }

  return [resolvedEntry];
};

const loadProjectConfig = async ({
  projectPath,
  envMode,
  configLoader,
}: {
  projectPath: string;
  envMode?: string;
  configLoader?: ConfigLoader;
}) => {
  const isDirectory = fs.statSync(projectPath).isDirectory();

  const { content, filePath } = await loadConfig({
    cwd: isDirectory ? projectPath : dirname(projectPath),
    path: isDirectory ? undefined : projectPath,
    envMode,
    loader: configLoader,
  });

  if (!filePath) {
    throw new Error(
      `Cannot find config file in ${color.cyan(projectPath)}. Add a Rslib config file before using workspace projects mode.`,
    );
  }

  return { content, filePath };
};

const resolvePattern = (pattern: string): RegExp => {
  const escaped = pattern
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`);
};

const throwNoChildProjectsError = (
  projects: string[],
  configFilePath?: string,
): never => {
  const location = configFilePath ? ` in ${color.cyan(configFilePath)}` : '';
  const normalizedProjects = projects
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const displayedProjects = Array.from(
    new Set(normalizedProjects.length ? normalizedProjects : projects),
  );
  throw new Error(
    `No child projects found from workspace projects${location}: ${displayedProjects.map((entry) => color.cyan(entry)).join(', ')}.`,
  );
};

export const filterProjects = (
  projects: ResolvedRslibProject[],
  projectFilters?: string[],
): ResolvedRslibProject[] => {
  if (!projectFilters?.length) {
    return projects;
  }

  const normalizedProjectFilters = projectFilters.map(
    (projectFilter, index) => {
      const trimmedFilter = projectFilter.trim();
      if (!trimmedFilter) {
        throw new Error(
          `Expect every item in ${color.cyan('"--project"')} to be a non-empty project name or pattern, but received an empty value at index ${color.cyan(String(index))}.`,
        );
      }
      if (trimmedFilter.startsWith('!')) {
        const negationPattern = trimmedFilter.slice(1).trim();
        if (!negationPattern) {
          throw new Error(
            `Expect every item in ${color.cyan('"--project"')} to be a non-empty project name or pattern, but received an empty negation pattern at index ${color.cyan(String(index))}.`,
          );
        }
        return `!${negationPattern}`;
      }
      return trimmedFilter;
    },
  );

  const positivePatterns = normalizedProjectFilters.filter(
    (pattern) => !pattern.startsWith('!'),
  );
  const negativePatterns = normalizedProjectFilters
    .filter((pattern) => pattern.startsWith('!'))
    .map((pattern) => pattern.slice(1));

  const positiveRegExps = positivePatterns.map(resolvePattern);
  const negativeRegExps = negativePatterns.map(resolvePattern);

  const filteredProjects = projects.filter((project) => {
    const matchedPositive =
      positiveRegExps.length === 0 ||
      positiveRegExps.some((regExp) => regExp.test(project.name));
    const matchedNegative = negativeRegExps.some((regExp) =>
      regExp.test(project.name),
    );
    return matchedPositive && !matchedNegative;
  });

  if (!filteredProjects.length) {
    const availableProjectNames = projects
      .map((project) => project.name)
      .sort();
    throw new Error(
      `No projects found for filters: ${normalizedProjectFilters.map((name) => color.cyan(name)).join(', ')}. Available workspace projects: ${availableProjectNames.map((name) => color.cyan(name)).join(', ')}.`,
    );
  }

  return filteredProjects;
};

export const sortProjectsByDependencies = (
  projects: ResolvedRslibProject[],
): ResolvedRslibProject[] => {
  const projectNameSet = new Set(projects.map((project) => project.name));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const project of projects) {
    const localDependencies = project.dependencies.filter((dependency) =>
      projectNameSet.has(dependency),
    );
    inDegree.set(project.name, localDependencies.length);

    for (const dependency of localDependencies) {
      const next = dependents.get(dependency) ?? [];
      next.push(project.name);
      dependents.set(dependency, next);
    }
  }

  const sortedNames: string[] = [];
  const queue = projects
    .filter((project) => (inDegree.get(project.name) ?? 0) === 0)
    .map((project) => project.name)
    .sort();

  while (queue.length) {
    const projectName = queue.shift()!;
    sortedNames.push(projectName);

    const nextProjects = dependents.get(projectName) ?? [];
    for (const nextProjectName of nextProjects) {
      const currentInDegree = inDegree.get(nextProjectName) ?? 0;
      inDegree.set(nextProjectName, currentInDegree - 1);
      if (currentInDegree - 1 === 0) {
        queue.push(nextProjectName);
        queue.sort();
      }
    }
  }

  if (sortedNames.length !== projects.length) {
    const cycleProjects = projects
      .map((project) => project.name)
      .filter((projectName) => !sortedNames.includes(projectName));
    throw new Error(
      `Circular dependency detected in workspace projects: ${cycleProjects.map((name) => color.cyan(name)).join(', ')}.`,
    );
  }

  const projectMap = new Map(
    projects.map((project) => [project.name, project]),
  );
  return sortedNames.map((name) => projectMap.get(name)!);
};

const includeDependencyProjects = (
  allProjects: ResolvedRslibProject[],
  selectedProjects: ResolvedRslibProject[],
): ResolvedRslibProject[] => {
  const projectMap = new Map(
    allProjects.map((project) => [project.name, project] as const),
  );
  const selectedNameSet = new Set(
    selectedProjects.map((project) => project.name),
  );
  const queue = selectedProjects.map((project) => project.name);

  while (queue.length) {
    const currentName = queue.shift()!;
    const currentProject = projectMap.get(currentName);
    if (!currentProject) {
      continue;
    }

    for (const dependencyName of currentProject.dependencies) {
      if (!selectedNameSet.has(dependencyName)) {
        selectedNameSet.add(dependencyName);
        queue.push(dependencyName);
      }
    }
  }

  return allProjects.filter((project) => selectedNameSet.has(project.name));
};

const linkProjectDependencies = (
  projects: ResolvedRslibProjectWithDependencyPackages[],
): ResolvedRslibProject[] => {
  const packageNameToProject = new Map<
    string,
    { projectName: string; configFilePath: string }
  >();

  for (const project of projects) {
    if (!project.packageName) {
      continue;
    }

    const previousProject = packageNameToProject.get(project.packageName);
    if (previousProject) {
      throw new Error(
        `Duplicated package name ${color.cyan(project.packageName)} found in workspace projects ${color.cyan(previousProject.projectName)} (${color.cyan(previousProject.configFilePath)}) and ${color.cyan(project.name)} (${color.cyan(project.configFilePath)}).`,
      );
    }
    packageNameToProject.set(project.packageName, {
      projectName: project.name,
      configFilePath: project.configFilePath,
    });
  }

  return projects.map(
    ({ dependencyPackageNames, ...project }): ResolvedRslibProject => {
      const dependencies = dependencyPackageNames
        .map(
          (dependencyPackageName) =>
            packageNameToProject.get(dependencyPackageName)?.projectName,
        )
        .filter(Boolean)
        .filter((dependencyName, index, list) => {
          return list.indexOf(dependencyName) === index;
        }) as string[];

      return {
        ...project,
        dependencies,
      };
    },
  );
};

const validateProjectNames = (projects: ResolvedRslibProject[]): void => {
  const usedProjectNames = new Set<string>();
  for (const project of projects) {
    if (usedProjectNames.has(project.name)) {
      throw new Error(
        `Duplicated workspace project name ${color.cyan(project.name)} found. Add unique package names in each child project's package.json.`,
      );
    }
    usedProjectNames.add(project.name);
  }
};

const collectWorkspaceProjects = async ({
  config,
  cwd,
  envMode,
  configLoader,
  resolvedConfigPaths,
  configFilePath,
}: {
  config: RslibWorkspaceConfig;
  cwd: string;
  envMode?: string;
  configLoader?: ConfigLoader;
  resolvedConfigPaths: Set<string>;
  configFilePath?: string;
}): Promise<ResolvedRslibProjectWithDependencyPackages[]> => {
  ensureWorkspaceProjectConfig(config, configFilePath);

  const workspaceRoot = config.root
    ? ensureAbsolutePath(cwd, config.root)
    : cwd;
  const resolvedProjects: ResolvedRslibProjectWithDependencyPackages[] = [];
  let hasResolvedProjectPath = false;

  for (const projectEntry of config.projects) {
    const projectPaths = await resolveProjectEntryPaths(
      projectEntry,
      workspaceRoot,
    );
    if (projectPaths.length > 0) {
      hasResolvedProjectPath = true;
    }

    for (const projectPath of projectPaths) {
      const { content, filePath } = await loadProjectConfig({
        projectPath,
        envMode,
        configLoader,
      });

      if (resolvedConfigPaths.has(filePath)) {
        continue;
      }
      resolvedConfigPaths.add(filePath);

      if (isWorkspaceConfig(content)) {
        const nestedProjects = await collectWorkspaceProjects({
          config: content,
          cwd: dirname(filePath),
          envMode,
          configLoader,
          resolvedConfigPaths,
          configFilePath: filePath,
        });
        resolvedProjects.push(...nestedProjects);
        continue;
      }

      ensureLeafProjectConfig(content, filePath);
      if (!isLeafProjectConfig(content)) {
        continue;
      }

      const projectRoot = content.root
        ? ensureAbsolutePath(dirname(filePath), content.root)
        : dirname(filePath);
      const packageMetadata = readProjectPackageJson(projectRoot);
      const projectName = packageMetadata.name || basename(projectRoot);

      resolvedProjects.push({
        name: projectName,
        packageName: packageMetadata.name,
        root: projectRoot,
        configFilePath: filePath,
        config: content,
        dependencyPackageNames: packageMetadata.dependencyPackageNames,
      });
    }
  }

  if (!resolvedProjects.length && !hasResolvedProjectPath) {
    throwNoChildProjectsError(config.projects, configFilePath);
  }

  return resolvedProjects;
};

export type ResolveWorkspaceProjectsOptions = {
  config: RslibWorkspaceConfig;
  cwd: string;
  configFilePath?: string;
  envMode?: string;
  configLoader?: ConfigLoader;
  projectFilters?: string[];
  includeDependencies?: boolean;
};

export async function resolveWorkspaceProjects({
  config,
  cwd,
  configFilePath,
  envMode,
  configLoader,
  projectFilters,
  includeDependencies,
}: ResolveWorkspaceProjectsOptions): Promise<ResolvedRslibProject[]> {
  const resolvedProjects = await collectWorkspaceProjects({
    config,
    cwd,
    configFilePath,
    envMode,
    configLoader,
    resolvedConfigPaths: new Set<string>(),
  });

  if (!resolvedProjects.length) {
    throwNoChildProjectsError(config.projects, configFilePath);
  }

  const projectsWithDependencies = linkProjectDependencies(resolvedProjects);
  validateProjectNames(projectsWithDependencies);

  const filteredProjects = filterProjects(
    projectsWithDependencies,
    projectFilters,
  );
  const selectedProjects = includeDependencies
    ? includeDependencyProjects(projectsWithDependencies, filteredProjects)
    : filteredProjects;

  return sortProjectsByDependencies(selectedProjects);
}

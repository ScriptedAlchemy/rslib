import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from '@rstest/core';
import fse from 'fs-extra';
import { resolveWorkspaceProjects } from '../src/workspace';

const tempDirs: string[] = [];

const createWorkspace = async (files: Record<string, string>) => {
  const root = await fse.mkdtemp(path.join(os.tmpdir(), 'rslib-workspace-'));
  tempDirs.push(root);

  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      const filePath = path.join(root, relativePath);
      await fse.outputFile(filePath, content);
    }),
  );

  return root;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((tempDir) => fse.remove(tempDir)));
});

describe('workspace projects resolver', () => {
  test('resolves workspace projects and sorts by dependency order', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/shared/package.json': JSON.stringify({
        name: '@scope/shared',
      }),
      'packages/shared/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/app/package.json': JSON.stringify({
        name: '@scope/app',
        dependencies: {
          '@scope/shared': 'workspace:*',
        },
      }),
      'packages/app/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    const projects = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        projects: ['packages/*'],
      },
    });

    expect(projects.map((project) => project.name)).toEqual([
      '@scope/shared',
      '@scope/app',
    ]);
    expect(projects[1]?.dependencies).toEqual(['@scope/shared']);
  });

  test('uses deterministic order for independent projects', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/z-lib/package.json': JSON.stringify({
        name: '@scope/z-lib',
      }),
      'packages/z-lib/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/a-lib/package.json': JSON.stringify({
        name: '@scope/a-lib',
      }),
      'packages/a-lib/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    const projects = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        projects: ['packages/*'],
      },
    });

    expect(projects.map((project) => project.name)).toEqual([
      '@scope/a-lib',
      '@scope/z-lib',
    ]);
  });

  test('supports nested workspace projects', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: ['apps/*'] };`,
      'packages/group/apps/nested/package.json': JSON.stringify({
        name: '@scope/nested',
      }),
      'packages/group/apps/nested/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    const projects = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        projects: ['packages/*'],
      },
    });

    expect(projects.map((project) => project.name)).toEqual(['@scope/nested']);
  });

  test('resolves workspace projects relative to workspace config root', async () => {
    const workspaceRoot = await createWorkspace({
      'monorepo/packages/shared/package.json': JSON.stringify({
        name: '@scope/shared',
      }),
      'monorepo/packages/shared/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    const projects = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        root: './monorepo',
        projects: ['packages/*'],
      },
    });

    expect(projects.map((project) => project.name)).toEqual(['@scope/shared']);
    expect(projects[0]?.root).toContain('/monorepo/packages/shared');
  });

  test('resolves nested workspace projects relative to nested config root', async () => {
    const workspaceRoot = await createWorkspace({
      'groups/team/rslib.config.mjs': `export default { root: './apps', projects: ['*'] };`,
      'groups/team/apps/nested/package.json': JSON.stringify({
        name: '@scope/nested-rooted',
      }),
      'groups/team/apps/nested/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    const projects = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        projects: ['groups/*'],
      },
    });

    expect(projects.map((project) => project.name)).toEqual([
      '@scope/nested-rooted',
    ]);
    expect(projects[0]?.root).toContain('/groups/team/apps/nested');
  });

  test('supports project entries as explicit config file paths', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/app/package.json': JSON.stringify({
        name: '@scope/app',
      }),
      'packages/app/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    const projects = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        projects: ['packages/app/rslib.config.mjs'],
      },
    });

    expect(projects.map((project) => project.name)).toEqual(['@scope/app']);
    expect(projects[0]?.configFilePath).toContain(
      'packages/app/rslib.config.mjs',
    );
  });

  test('supports absolute directory paths in projects entries', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/shared/package.json': JSON.stringify({
        name: '@scope/shared',
      }),
      'packages/shared/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    const absoluteProjectPath = path.join(workspaceRoot, 'packages/shared');
    const projects = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        projects: [absoluteProjectPath],
      },
    });

    expect(projects.map((project) => project.name)).toEqual(['@scope/shared']);
  });

  test('supports absolute config file paths in projects entries', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/shared/package.json': JSON.stringify({
        name: '@scope/shared',
      }),
      'packages/shared/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    const absoluteConfigPath = path.join(
      workspaceRoot,
      'packages/shared/rslib.config.mjs',
    );
    const projects = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        projects: [absoluteConfigPath],
      },
    });

    expect(projects.map((project) => project.name)).toEqual(['@scope/shared']);
    expect(projects[0]?.configFilePath).toBe(absoluteConfigPath);
  });

  test('supports absolute glob patterns in projects entries', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/a/package.json': JSON.stringify({
        name: '@scope/a',
      }),
      'packages/a/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/b/package.json': JSON.stringify({
        name: '@scope/b',
      }),
      'packages/b/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    const absoluteGlob = path.join(workspaceRoot, 'packages/*');
    const projects = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        projects: [absoluteGlob],
      },
    });

    expect(projects.map((project) => project.name)).toEqual([
      '@scope/a',
      '@scope/b',
    ]);
  });

  test('trims and ignores empty workspace project entries', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/app/package.json': JSON.stringify({
        name: '@scope/app',
      }),
      'packages/app/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    const projects = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        projects: ['   ', '  packages/*  '],
      },
    });

    expect(projects.map((project) => project.name)).toEqual(['@scope/app']);
  });

  test('filters projects and can include local dependencies', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/shared/package.json': JSON.stringify({
        name: '@scope/shared',
      }),
      'packages/shared/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/app/package.json': JSON.stringify({
        name: '@scope/app',
        dependencies: {
          '@scope/shared': 'workspace:*',
        },
      }),
      'packages/app/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    const filteredOnly = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        projects: ['packages/*'],
      },
      projectFilters: ['@scope/app'],
      includeDependencies: false,
    });

    expect(filteredOnly.map((project) => project.name)).toEqual(['@scope/app']);

    const filteredWithDependencies = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        projects: ['packages/*'],
      },
      projectFilters: ['@scope/app'],
      includeDependencies: true,
    });

    expect(filteredWithDependencies.map((project) => project.name)).toEqual([
      '@scope/shared',
      '@scope/app',
    ]);
  });

  test('supports wildcard and negation project filters', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/shared/package.json': JSON.stringify({
        name: '@scope/shared',
      }),
      'packages/shared/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/app/package.json': JSON.stringify({
        name: '@scope/app',
      }),
      'packages/app/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/legacy/package.json': JSON.stringify({
        name: '@scope/legacy',
      }),
      'packages/legacy/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    const filteredProjects = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        projects: ['packages/*'],
      },
      projectFilters: ['@scope/*', '!@scope/legacy'],
    });

    expect(filteredProjects.map((project) => project.name)).toEqual([
      '@scope/app',
      '@scope/shared',
    ]);
  });

  test('supports negative-only project filters', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/shared/package.json': JSON.stringify({
        name: '@scope/shared',
      }),
      'packages/shared/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/app/package.json': JSON.stringify({
        name: '@scope/app',
      }),
      'packages/app/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/legacy/package.json': JSON.stringify({
        name: '@scope/legacy',
      }),
      'packages/legacy/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    const filteredProjects = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        projects: ['packages/*'],
      },
      projectFilters: ['!@scope/legacy'],
    });

    expect(filteredProjects.map((project) => project.name)).toEqual([
      '@scope/app',
      '@scope/shared',
    ]);
  });

  test('includes available project names when filters match nothing', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/shared/package.json': JSON.stringify({
        name: '@scope/shared',
      }),
      'packages/shared/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/app/package.json': JSON.stringify({
        name: '@scope/app',
      }),
      'packages/app/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: ['@scope/missing'],
      }),
    ).rejects.toThrowError('Available workspace projects');
  });

  test('includes available project names when negative-only filters exclude everything', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/shared/package.json': JSON.stringify({
        name: '@scope/shared',
      }),
      'packages/shared/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/app/package.json': JSON.stringify({
        name: '@scope/app',
      }),
      'packages/app/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: ['!@scope/*'],
      }),
    ).rejects.toThrowError('No projects found for filters');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: ['!@scope/*'],
      }),
    ).rejects.toThrowError('Available workspace projects');
  });

  test('lists available projects in deterministic order on filter miss', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/z-lib/package.json': JSON.stringify({
        name: '@scope/z-lib',
      }),
      'packages/z-lib/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/a-lib/package.json': JSON.stringify({
        name: '@scope/a-lib',
      }),
      'packages/a-lib/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: ['@scope/missing'],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      expect((error as Error).message).toContain(
        'Available workspace projects: @scope/a-lib, @scope/z-lib',
      );
    }
  });

  test('throws on duplicated package names', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/a/package.json': JSON.stringify({
        name: '@scope/dup',
      }),
      'packages/a/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/b/package.json': JSON.stringify({
        name: '@scope/dup',
      }),
      'packages/b/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      }),
    ).rejects.toThrowError('Duplicated package name');
  });

  test('throws on circular dependencies', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/a/package.json': JSON.stringify({
        name: '@scope/a',
        dependencies: {
          '@scope/b': 'workspace:*',
        },
      }),
      'packages/a/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/b/package.json': JSON.stringify({
        name: '@scope/b',
        dependencies: {
          '@scope/a': 'workspace:*',
        },
      }),
      'packages/b/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      }),
    ).rejects.toThrowError('Circular dependency detected');
  });

  test('throws when projects and lib are used together', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/a/package.json': JSON.stringify({
        name: '@scope/a',
      }),
      'packages/a/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          projects: ['packages/*'],
          // @ts-expect-error validate runtime guard for mixed mode
          lib: [{ format: 'esm' }],
        },
      }),
    ).rejects.toThrowError('cannot be used together');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          projects: ['packages/*'],
          // @ts-expect-error validate runtime guard for mixed mode
          lib: [{ format: 'esm' }],
        },
      }),
    ).rejects.toThrowError('/rslib.config.mjs');
  });

  test('includes config path in mixed projects/lib validation errors', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/a/package.json': JSON.stringify({
        name: '@scope/a',
      }),
      'packages/a/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.custom.mjs`,
        config: {
          projects: ['packages/*'],
          // @ts-expect-error validate runtime guard for mixed mode
          lib: [{ format: 'esm' }],
        },
      }),
    ).rejects.toThrowError('rslib.config.custom.mjs');
  });

  test('throws when projects and non-array lib are used together', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/a/package.json': JSON.stringify({
        name: '@scope/a',
      }),
      'packages/a/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          projects: ['packages/*'],
          // @ts-expect-error validate runtime guard for malformed mixed mode
          lib: 'esm',
        },
      }),
    ).rejects.toThrowError('cannot be used together');
  });

  test('allows workspace config when lib is undefined', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/a/package.json': JSON.stringify({
        name: '@scope/a',
      }),
      'packages/a/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    const projects = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      configFilePath: `${workspaceRoot}/rslib.config.mjs`,
      config: {
        projects: ['packages/*'],
        // @ts-expect-error validate runtime behavior for explicitly undefined lib
        lib: undefined,
      },
    });

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      name: '@scope/a',
    });
  });

  test('throws when projects and null lib are used together', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/a/package.json': JSON.stringify({
        name: '@scope/a',
      }),
      'packages/a/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          projects: ['packages/*'],
          // @ts-expect-error validate runtime guard for malformed mixed mode
          lib: null,
        },
      }),
    ).rejects.toThrowError('cannot be used together');
  });

  test('throws when projects contains non-string entries', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/a/package.json': JSON.stringify({
        name: '@scope/a',
      }),
      'packages/a/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          // @ts-expect-error validate runtime guard for non-string entries
          projects: ['packages/*', 123],
        },
      }),
    ).rejects.toThrowError(
      'to be a string path or glob, but received number at index 1',
    );
  });

  test('includes root config path in non-string projects error', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/a/package.json': JSON.stringify({
        name: '@scope/a',
      }),
      'packages/a/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          // @ts-expect-error validate runtime guard for non-string entries
          projects: ['packages/*', 123],
        },
      }),
    ).rejects.toThrowError('/rslib.config.mjs');
  });

  test('throws when child config has invalid projects field type', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: 'apps/*' };`,
      'packages/group/apps/nested/package.json': JSON.stringify({
        name: '@scope/nested',
      }),
      'packages/group/apps/nested/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      }),
    ).rejects.toThrowError('to be a non-empty array in workspace mode');
  });

  test('throws when child config mixes projects and non-array lib', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: ['apps/*'], lib: 'esm' };`,
      'packages/group/apps/nested/package.json': JSON.stringify({
        name: '@scope/nested',
      }),
      'packages/group/apps/nested/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      }),
    ).rejects.toThrowError('cannot be used together');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      }),
    ).rejects.toThrowError('/packages/group/rslib.config.mjs');
  });

  test('allows child workspace config when lib is undefined', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: ['apps/*'], lib: undefined };`,
      'packages/group/apps/nested/package.json': JSON.stringify({
        name: '@scope/nested',
      }),
      'packages/group/apps/nested/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    const projects = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        projects: ['packages/*'],
      },
    });

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      name: '@scope/nested',
    });
  });

  test('throws when child config mixes projects and null lib', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: ['apps/*'], lib: null };`,
      'packages/group/apps/nested/package.json': JSON.stringify({
        name: '@scope/nested',
      }),
      'packages/group/apps/nested/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      }),
    ).rejects.toThrowError('cannot be used together');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      }),
    ).rejects.toThrowError('/packages/group/rslib.config.mjs');
  });

  test('throws when nested workspace projects array is empty', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': 'export default { projects: [] };',
      'packages/group/apps/nested/package.json': JSON.stringify({
        name: '@scope/nested',
      }),
      'packages/group/apps/nested/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      }),
    ).rejects.toThrowError('to be a non-empty array in workspace mode');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      }),
    ).rejects.toThrowError('/packages/group/rslib.config.mjs');
  });

  test('throws when nested workspace project patterns resolve to no children', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: ['apps/*'] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      }),
    ).rejects.toThrowError('No child projects found from workspace projects');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      }),
    ).rejects.toThrowError('/packages/group/rslib.config.mjs');
  });

  test('throws when workspace projects array is empty', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/a/package.json': JSON.stringify({
        name: '@scope/a',
      }),
      'packages/a/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          projects: [],
        },
      }),
    ).rejects.toThrowError('to be a non-empty array in workspace mode');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          projects: [],
        },
      }),
    ).rejects.toThrowError('/rslib.config.mjs');
  });

  test('includes config file path in top-level workspace validation errors', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/a/package.json': JSON.stringify({
        name: '@scope/a',
      }),
      'packages/a/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: path.join(workspaceRoot, 'rslib.config.ts'),
        config: {
          projects: [],
        },
      }),
    ).rejects.toThrowError(
      `to be a non-empty array in workspace mode in ${path.join(workspaceRoot, 'rslib.config.ts')}`,
    );
  });

  test('throws when projects only contains empty entries', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/a/package.json': JSON.stringify({
        name: '@scope/a',
      }),
      'packages/a/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          projects: ['   ', '\n\t'],
        },
      }),
    ).rejects.toThrowError('to contain at least one non-empty project path');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          projects: ['   ', '\n\t'],
        },
      }),
    ).rejects.toThrowError('/rslib.config.mjs');
  });

  test('throws on duplicated fallback project names', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group-a/common/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/group-b/common/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/**/common'],
        },
      }),
    ).rejects.toThrowError('Duplicated workspace project name');
  });

  test('deduplicates same project resolved by overlapping patterns', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/app/package.json': JSON.stringify({
        name: '@scope/app',
      }),
      'packages/app/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    const projects = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        projects: [
          'packages/*',
          'packages/app',
          'packages/**/rslib.config.mjs',
        ],
      },
    });

    expect(projects.map((project) => project.name)).toEqual(['@scope/app']);
    expect(projects).toHaveLength(1);
  });

  test('throws when a project entry path does not exist', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/app/package.json': JSON.stringify({
        name: '@scope/app',
      }),
      'packages/app/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/app', 'packages/not-found'],
        },
      }),
    ).rejects.toThrowError(`Can't resolve project "packages/not-found"`);
  });

  test('throws when project patterns resolve to no child projects', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/app/package.json': JSON.stringify({
        name: '@scope/app',
      }),
      'packages/app/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          projects: ['packages/empty/*'],
        },
      }),
    ).rejects.toThrowError('No child projects found from workspace projects');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          projects: ['packages/empty/*'],
        },
      }),
    ).rejects.toThrowError('/rslib.config.mjs');
  });

  test('throws when a resolved project has no config file', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/a/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/b/package.json': JSON.stringify({
        name: '@scope/b',
      }),
      'packages/b/src/index.ts': `export const value = 'b';`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      }),
    ).rejects.toThrowError('Cannot find config file in');
  });
});

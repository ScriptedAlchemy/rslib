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

  test('trims project filters before matching', async () => {
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

    const filteredProjects = await resolveWorkspaceProjects({
      cwd: workspaceRoot,
      config: {
        projects: ['packages/*'],
      },
      projectFilters: ['  @scope/app  '],
    });

    expect(filteredProjects.map((project) => project.name)).toEqual([
      '@scope/app',
    ]);
  });

  test('trims negation project filters before matching', async () => {
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
      projectFilters: ['@scope/*', '  !@scope/legacy  '],
    });

    expect(filteredProjects.map((project) => project.name)).toEqual([
      '@scope/app',
      '@scope/shared',
    ]);
  });

  test('trims spaces after negation prefix before matching', async () => {
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
      projectFilters: ['@scope/*', '!   @scope/legacy'],
    });

    expect(filteredProjects.map((project) => project.name)).toEqual([
      '@scope/app',
      '@scope/shared',
    ]);
  });

  test('throws when project filters contain empty entries', async () => {
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
        projectFilters: ['@scope/app', '  '],
      }),
    ).rejects.toThrowError('non-empty project name or pattern');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: ['@scope/app', '  '],
      }),
    ).rejects.toThrowError('index 1');
  });

  test('throws when negation project filters are empty', async () => {
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
        projectFilters: ['@scope/app', '!   '],
      }),
    ).rejects.toThrowError('empty negation pattern');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: ['@scope/app', '!   '],
      }),
    ).rejects.toThrowError('index 1');
  });

  test('throws when negation project filters are empty after "!"', async () => {
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
        projectFilters: ['@scope/app', '!'],
      }),
    ).rejects.toThrowError('empty negation pattern');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: ['@scope/app', '!'],
      }),
    ).rejects.toThrowError('index 1');
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
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: ['!@scope/*'],
      }),
    ).rejects.toThrowError('!@scope/*');
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

  test('lists available projects in deterministic order on filter miss with undefined root lib', async () => {
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
          // @ts-expect-error validate runtime behavior for explicitly undefined lib
          lib: undefined,
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

  test('lists available projects in deterministic order on filter miss with undefined nested lib', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: ['apps/*'], lib: undefined };`,
      'packages/group/apps/z-lib/package.json': JSON.stringify({
        name: '@scope/z-lib',
      }),
      'packages/group/apps/z-lib/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/group/apps/a-lib/package.json': JSON.stringify({
        name: '@scope/a-lib',
      }),
      'packages/group/apps/a-lib/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
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

  test('lists available projects in deterministic order on filter miss with nested workspace projects', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: ['apps/*'] };`,
      'packages/group/apps/z-lib/package.json': JSON.stringify({
        name: '@scope/z-lib',
      }),
      'packages/group/apps/z-lib/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
      'packages/group/apps/a-lib/package.json': JSON.stringify({
        name: '@scope/a-lib',
      }),
      'packages/group/apps/a-lib/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
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

  test('includes all filter patterns in filter miss diagnostics', async () => {
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

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: ['@scope/missing', '!@scope/shared'],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('@scope/missing');
      expect(message).toContain('!@scope/shared');
      expect(message.indexOf('@scope/missing')).toBeLessThan(
        message.indexOf('!@scope/shared'),
      );
    }
  });

  test('trims filter patterns in filter miss diagnostics', async () => {
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

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: ['  @scope/missing  ', '  !@scope/app  '],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('@scope/missing');
      expect(message).toContain('!@scope/app');
    }
  });

  test('normalizes negation filters in filter miss diagnostics', async () => {
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

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: ['@scope/missing', '!   @scope/app'],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('@scope/missing');
      expect(message).toContain('!@scope/app');
      expect(message).not.toContain('!   @scope/app');
    }
  });

  test('deduplicates filter patterns in filter miss diagnostics', async () => {
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

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: ['@scope/missing', '@scope/missing', '!@scope/app'],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('@scope/missing');
      expect(message).toContain('!@scope/app');
      expect(message).toContain('@scope/missing, !@scope/app');
      expect(message).not.toContain('@scope/missing, @scope/missing');
    }
  });

  test('deduplicates normalized filter patterns in filter miss diagnostics', async () => {
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

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: [
          '  @scope/missing  ',
          '@scope/missing',
          '  !@scope/app  ',
          '!   @scope/app',
        ],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('@scope/missing');
      expect(message).toContain('!@scope/app');
      expect(message).toContain('@scope/missing, !@scope/app');
      expect(message).not.toContain('@scope/missing, @scope/missing');
      expect(message).not.toContain('!@scope/app, !@scope/app');
      expect(message).not.toContain('!   @scope/app');
    }
  });

  test('preserves first-occurrence order when deduplicating normalized filters in miss diagnostics', async () => {
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

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: [
          '  !@scope/shared  ',
          '@scope/missing',
          '!   @scope/shared',
          '  @scope/missing  ',
        ],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('!@scope/shared');
      expect(message).toContain('@scope/missing');
      expect(message).toContain('!@scope/shared, @scope/missing');
      expect(message).not.toContain('@scope/missing, !@scope/shared');
      expect(message).not.toContain('!   @scope/shared');
    }
  });

  test('preserves first-occurrence order across multiple normalized unique filters in miss diagnostics', async () => {
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

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: [
          '  !@scope/shared  ',
          '  @scope/missing-b  ',
          '@scope/missing-a',
          '!   @scope/shared',
          '  @scope/missing-a  ',
        ],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('!@scope/shared');
      expect(message).toContain('@scope/missing-b');
      expect(message).toContain('@scope/missing-a');
      expect(message).toContain(
        '!@scope/shared, @scope/missing-b, @scope/missing-a',
      );
      expect(message).not.toContain(
        '@scope/missing-a, @scope/missing-b, !@scope/shared',
      );
      expect(message).not.toContain('!   @scope/shared');
    }
  });

  test('deduplicates normalized negation-only filter patterns in miss diagnostics', async () => {
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

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: ['  !@scope/*  ', '!   @scope/*'],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('!@scope/*');
      expect(message).toContain('No projects found for filters: !@scope/*');
      expect(message).not.toContain('!@scope/*, !@scope/*');
      expect(message).not.toContain('!   @scope/*');
    }
  });

  test('preserves first-occurrence order for multiple normalized negation-only filters in miss diagnostics', async () => {
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

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: ['  !@scope/*  ', '!   @scope/shared', '!@scope/*'],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('!@scope/*');
      expect(message).toContain('!@scope/shared');
      expect(message).toContain(
        'No projects found for filters: !@scope/*, !@scope/shared',
      );
      expect(message).not.toContain('!@scope/shared, !@scope/*');
      expect(message).not.toContain('!@scope/*, !@scope/shared, !@scope/*');
      expect(message).not.toContain('!   @scope/shared');
    }
  });

  test('deduplicates normalized negation-only filters with undefined root lib in miss diagnostics', async () => {
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

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
          // @ts-expect-error validate runtime behavior for explicitly undefined lib
          lib: undefined,
        },
        projectFilters: ['  !@scope/*  ', '!   @scope/*'],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('!@scope/*');
      expect(message).toContain('No projects found for filters: !@scope/*');
      expect(message).not.toContain('!@scope/*, !@scope/*');
      expect(message).not.toContain('!   @scope/*');
    }
  });

  test('deduplicates normalized negation-only filters with undefined nested lib in miss diagnostics', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: ['apps/*'], lib: undefined };`,
      'packages/group/apps/nested/package.json': JSON.stringify({
        name: '@scope/nested',
      }),
      'packages/group/apps/nested/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: ['  !@scope/nested  ', '!   @scope/nested'],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('!@scope/nested');
      expect(message).toContain(
        'No projects found for filters: !@scope/nested',
      );
      expect(message).not.toContain('!@scope/nested, !@scope/nested');
      expect(message).not.toContain('!   @scope/nested');
    }
  });

  test('deduplicates normalized filter patterns with undefined root lib in miss diagnostics', async () => {
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

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
          // @ts-expect-error validate runtime behavior for explicitly undefined lib
          lib: undefined,
        },
        projectFilters: [
          '  @scope/missing  ',
          '@scope/missing',
          '  !@scope/app  ',
          '!   @scope/app',
        ],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('@scope/missing');
      expect(message).toContain('!@scope/app');
      expect(message).toContain('@scope/missing, !@scope/app');
      expect(message).not.toContain('@scope/missing, @scope/missing');
      expect(message).not.toContain('!@scope/app, !@scope/app');
      expect(message).not.toContain('!   @scope/app');
    }
  });

  test('preserves first-occurrence order when deduplicating normalized filters with undefined root lib in miss diagnostics', async () => {
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

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
          // @ts-expect-error validate runtime behavior for explicitly undefined lib
          lib: undefined,
        },
        projectFilters: [
          '  !@scope/shared  ',
          '@scope/missing',
          '!   @scope/shared',
          '  @scope/missing  ',
        ],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('!@scope/shared');
      expect(message).toContain('@scope/missing');
      expect(message).toContain('!@scope/shared, @scope/missing');
      expect(message).not.toContain('@scope/missing, !@scope/shared');
      expect(message).not.toContain('!   @scope/shared');
    }
  });

  test('preserves first-occurrence order across multiple normalized unique filters with undefined root lib in miss diagnostics', async () => {
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

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
          // @ts-expect-error validate runtime behavior for explicitly undefined lib
          lib: undefined,
        },
        projectFilters: [
          '  !@scope/shared  ',
          '  @scope/missing-b  ',
          '@scope/missing-a',
          '!   @scope/shared',
          '  @scope/missing-a  ',
        ],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('!@scope/shared');
      expect(message).toContain('@scope/missing-b');
      expect(message).toContain('@scope/missing-a');
      expect(message).toContain(
        '!@scope/shared, @scope/missing-b, @scope/missing-a',
      );
      expect(message).not.toContain(
        '@scope/missing-a, @scope/missing-b, !@scope/shared',
      );
      expect(message).not.toContain('!   @scope/shared');
    }
  });

  test('deduplicates normalized filter patterns with undefined nested lib in miss diagnostics', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: ['apps/*'], lib: undefined };`,
      'packages/group/apps/nested/package.json': JSON.stringify({
        name: '@scope/nested',
      }),
      'packages/group/apps/nested/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: [
          '  @scope/missing  ',
          '@scope/missing',
          '  !@scope/nested  ',
          '!   @scope/nested',
        ],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('@scope/missing');
      expect(message).toContain('!@scope/nested');
      expect(message).toContain('@scope/missing, !@scope/nested');
      expect(message).not.toContain('@scope/missing, @scope/missing');
      expect(message).not.toContain('!@scope/nested, !@scope/nested');
      expect(message).not.toContain('!   @scope/nested');
    }
  });

  test('preserves first-occurrence order when deduplicating normalized filters with undefined nested lib in miss diagnostics', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: ['apps/*'], lib: undefined };`,
      'packages/group/apps/nested/package.json': JSON.stringify({
        name: '@scope/nested',
      }),
      'packages/group/apps/nested/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: [
          '  !@scope/nested  ',
          '@scope/missing',
          '!   @scope/nested',
          '  @scope/missing  ',
        ],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('!@scope/nested');
      expect(message).toContain('@scope/missing');
      expect(message).toContain('!@scope/nested, @scope/missing');
      expect(message).not.toContain('@scope/missing, !@scope/nested');
      expect(message).not.toContain('!   @scope/nested');
    }
  });

  test('preserves first-occurrence order across multiple normalized unique filters with undefined nested lib in miss diagnostics', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: ['apps/*'], lib: undefined };`,
      'packages/group/apps/nested/package.json': JSON.stringify({
        name: '@scope/nested',
      }),
      'packages/group/apps/nested/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
        projectFilters: [
          '  !@scope/nested  ',
          '  @scope/missing-b  ',
          '@scope/missing-a',
          '!   @scope/nested',
          '  @scope/missing-a  ',
        ],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('No projects found for filters');
      expect(message).toContain('!@scope/nested');
      expect(message).toContain('@scope/missing-b');
      expect(message).toContain('@scope/missing-a');
      expect(message).toContain(
        '!@scope/nested, @scope/missing-b, @scope/missing-a',
      );
      expect(message).not.toContain(
        '@scope/missing-a, @scope/missing-b, !@scope/nested',
      );
      expect(message).not.toContain('!   @scope/nested');
    }
  });

  test('lists available projects in deterministic order on negative-only filter miss', async () => {
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
        projectFilters: ['!@scope/*'],
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      expect((error as Error).message).toContain(
        'No projects found for filters: !@scope/*',
      );
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

  test('normalizes nested no-child project patterns in diagnostics', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: ['  apps/*  ', '   '] };`,
    });

    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      }),
    ).rejects.toThrowError('apps/*');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      }),
    ).rejects.not.toThrowError('  apps/*  ');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      }),
    ).rejects.toThrowError(': apps/*.');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      }),
    ).rejects.toThrowError('/packages/group/rslib.config.mjs');
  });

  test('deduplicates nested no-child project patterns in diagnostics', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: ['apps/*', '  apps/*  '] };`,
    });

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain(
        'No child projects found from workspace projects',
      );
      expect(message).toContain('/packages/group/rslib.config.mjs');
      expect(message).toContain(': apps/*.');
      expect(message).not.toContain('apps/*, apps/*');
    }
  });

  test('preserves first-occurrence order when deduplicating nested no-child project patterns in diagnostics', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: ['apps-z/*', 'apps-a/*', '  apps-z/*  '] };`,
    });

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain(': apps-z/*, apps-a/*.');
      expect(message).toContain('/packages/group/rslib.config.mjs');
      expect(message).not.toContain(': apps-a/*, apps-z/*.');
      expect(message).not.toContain('apps-z/*, apps-a/*, apps-z/*');
      expect(message).not.toContain('  apps-z/*  ');
    }
  });

  test('deduplicates nested no-child project patterns when child lib is undefined', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: ['apps/*', '  apps/*  '], lib: undefined };`,
    });

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain(
        'No child projects found from workspace projects',
      );
      expect(message).toContain('/packages/group/rslib.config.mjs');
      expect(message).toContain(': apps/*.');
      expect(message).not.toContain('apps/*, apps/*');
      expect(message).not.toContain('  apps/*  ');
    }
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

  test('normalizes project entries in no-child diagnostics', async () => {
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
          projects: ['  packages/empty/*  ', '   '],
        },
      }),
    ).rejects.toThrowError('packages/empty/*');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          projects: ['  packages/empty/*  ', '   '],
        },
      }),
    ).rejects.not.toThrowError('  packages/empty/*  ');
    await expect(() =>
      resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          projects: ['  packages/empty/*  ', '   '],
        },
      }),
    ).rejects.toThrowError(': packages/empty/*.');
  });

  test('deduplicates no-child project patterns in diagnostics', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/app/package.json': JSON.stringify({
        name: '@scope/app',
      }),
      'packages/app/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          projects: ['packages/empty/*', '  packages/empty/*  '],
        },
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain(
        'No child projects found from workspace projects',
      );
      expect(message).toContain('packages/empty/*');
      expect(message).toContain(': packages/empty/*.');
      expect(message).not.toContain('packages/empty/*, packages/empty/*');
    }
  });

  test('preserves first-occurrence order when deduplicating no-child project patterns in diagnostics', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/app/package.json': JSON.stringify({
        name: '@scope/app',
      }),
      'packages/app/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          projects: [
            'packages/z-empty/*',
            'packages/a-empty/*',
            '  packages/z-empty/*  ',
          ],
        },
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain(': packages/z-empty/*, packages/a-empty/*.');
      expect(message).toContain('/rslib.config.mjs');
      expect(message).not.toContain(
        ': packages/a-empty/*, packages/z-empty/*.',
      );
      expect(message).not.toContain(
        'packages/z-empty/*, packages/a-empty/*, packages/z-empty/*',
      );
      expect(message).not.toContain('  packages/z-empty/*  ');
    }
  });

  test('preserves first-occurrence order when deduplicating no-child project patterns with undefined root lib in diagnostics', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/app/package.json': JSON.stringify({
        name: '@scope/app',
      }),
      'packages/app/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          projects: [
            'packages/z-empty/*',
            'packages/a-empty/*',
            '  packages/z-empty/*  ',
          ],
          // @ts-expect-error validate runtime behavior for explicitly undefined lib
          lib: undefined,
        },
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain(': packages/z-empty/*, packages/a-empty/*.');
      expect(message).toContain('/rslib.config.mjs');
      expect(message).not.toContain(
        ': packages/a-empty/*, packages/z-empty/*.',
      );
      expect(message).not.toContain(
        'packages/z-empty/*, packages/a-empty/*, packages/z-empty/*',
      );
      expect(message).not.toContain('  packages/z-empty/*  ');
    }
  });

  test('preserves first-occurrence order when deduplicating nested no-child project patterns with undefined child lib in diagnostics', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/group/rslib.config.mjs': `export default { projects: ['apps-z/*', 'apps-a/*', '  apps-z/*  '], lib: undefined };`,
    });

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        config: {
          projects: ['packages/*'],
        },
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain(': apps-z/*, apps-a/*.');
      expect(message).toContain('/packages/group/rslib.config.mjs');
      expect(message).not.toContain(': apps-a/*, apps-z/*.');
      expect(message).not.toContain('apps-z/*, apps-a/*, apps-z/*');
      expect(message).not.toContain('  apps-z/*  ');
    }
  });

  test('deduplicates no-child project patterns when root lib is undefined', async () => {
    const workspaceRoot = await createWorkspace({
      'packages/app/package.json': JSON.stringify({
        name: '@scope/app',
      }),
      'packages/app/rslib.config.mjs': `export default { lib: [{ format: 'esm' }] };`,
    });

    try {
      await resolveWorkspaceProjects({
        cwd: workspaceRoot,
        configFilePath: `${workspaceRoot}/rslib.config.mjs`,
        config: {
          projects: ['packages/empty/*', '  packages/empty/*  '],
          // @ts-expect-error validate runtime behavior for explicitly undefined lib
          lib: undefined,
        },
      });
      throw new Error('Expected resolveWorkspaceProjects to throw.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain(
        'No child projects found from workspace projects',
      );
      expect(message).toContain('packages/empty/*');
      expect(message).toContain(': packages/empty/*.');
      expect(message).not.toContain('packages/empty/*, packages/empty/*');
      expect(message).not.toContain('  packages/empty/*  ');
    }
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

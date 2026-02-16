import path from 'node:path';
import { describe, expect, test } from '@rstest/core';
import fse from 'fs-extra';
import { expectFile, runCliSync } from 'test-helper';

const removeDistDirs = async (fixturePath: string) => {
  await Promise.all([
    fse.remove(path.join(fixturePath, 'packages/shared/dist')),
    fse.remove(path.join(fixturePath, 'packages/app/dist')),
    fse.remove(path.join(fixturePath, 'packages/group/apps/nested/dist')),
    fse.remove(
      path.join(
        fixturePath,
        'broken/undefined-lib-workspace/apps/nested-undefined-lib/dist',
      ),
    ),
  ]);
};

describe('workspace projects', () => {
  test('builds workspace projects in dependency order', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync('build', {
      cwd: fixturePath,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    expect(status).toBe(0);

    await expectFile(path.join(fixturePath, 'packages/shared/dist/index.mjs'));
    await expectFile(path.join(fixturePath, 'packages/app/dist/index.mjs'));
    await expectFile(
      path.join(fixturePath, 'packages/group/apps/nested/dist/index.mjs'),
    );
  });

  test('builds workspace projects when root is configured', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync('build --config rslib.config.rooted.ts', {
      cwd: fixturePath,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    expect(status).toBe(0);

    await expectFile(path.join(fixturePath, 'packages/shared/dist/index.mjs'));
    await expectFile(path.join(fixturePath, 'packages/app/dist/index.mjs'));
    await expectFile(
      path.join(fixturePath, 'packages/group/apps/nested/dist/index.mjs'),
    );
  });

  test('build --project works with workspace root config', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync(
      'build --config rslib.config.rooted.ts --project @workspace/app',
      {
        cwd: fixturePath,
      },
    );

    expect(status).toBe(0);
    await expectFile(path.join(fixturePath, 'packages/shared/dist/index.mjs'));
    await expectFile(path.join(fixturePath, 'packages/app/dist/index.mjs'));
    expect(
      fse.existsSync(path.join(fixturePath, 'packages/group/apps/nested/dist')),
    ).toBe(false);
  });

  test('build accepts trimmed workspace project entries', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync(
      'build --config rslib.config.trimmedProjectsEntry.ts',
      {
        cwd: fixturePath,
      },
    );

    expect(status).toBe(0);
    await expectFile(path.join(fixturePath, 'packages/shared/dist/index.mjs'));
    await expectFile(path.join(fixturePath, 'packages/app/dist/index.mjs'));
    await expectFile(
      path.join(fixturePath, 'packages/group/apps/nested/dist/index.mjs'),
    );
  });

  test('build accepts workspace config with undefined lib field', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync(
      'build --config rslib.config.undefinedLibWorkspace.ts',
      {
        cwd: fixturePath,
      },
    );

    expect(status).toBe(0);
    await expectFile(path.join(fixturePath, 'packages/shared/dist/index.mjs'));
    await expectFile(path.join(fixturePath, 'packages/app/dist/index.mjs'));
    await expectFile(
      path.join(fixturePath, 'packages/group/apps/nested/dist/index.mjs'),
    );
  });

  test('build --project works with undefined-lib workspace config', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync(
      'build --config rslib.config.undefinedLibWorkspace.ts --project @workspace/app',
      {
        cwd: fixturePath,
      },
    );

    expect(status).toBe(0);
    await expectFile(path.join(fixturePath, 'packages/shared/dist/index.mjs'));
    await expectFile(path.join(fixturePath, 'packages/app/dist/index.mjs'));
    expect(
      fse.existsSync(path.join(fixturePath, 'packages/group/apps/nested/dist')),
    ).toBe(false);
  });

  test('build accepts nested workspace config with undefined lib field', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync(
      'build --config rslib.config.nestedUndefinedLibWorkspace.ts',
      {
        cwd: fixturePath,
      },
    );

    expect(status).toBe(0);
    await expectFile(
      path.join(
        fixturePath,
        'broken/undefined-lib-workspace/apps/nested-undefined-lib/dist/index.mjs',
      ),
    );
  });

  test('build --project works with nested undefined-lib workspace config', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync(
      'build --config rslib.config.nestedUndefinedLibWorkspace.ts --project @workspace/nested-undefined-lib',
      {
        cwd: fixturePath,
      },
    );

    expect(status).toBe(0);
    await expectFile(
      path.join(
        fixturePath,
        'broken/undefined-lib-workspace/apps/nested-undefined-lib/dist/index.mjs',
      ),
    );
    expect(fse.existsSync(path.join(fixturePath, 'packages/shared/dist'))).toBe(
      false,
    );
    expect(fse.existsSync(path.join(fixturePath, 'packages/app/dist'))).toBe(
      false,
    );
  });

  test('inspect accepts trimmed workspace project entries', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync(
      'inspect --config rslib.config.trimmedProjectsEntry.ts',
      {
        cwd: fixturePath,
      },
    );

    expect(status).toBe(0);
    await expectFile(
      path.join(fixturePath, 'packages/app/dist/.rsbuild/rslib.config.mjs'),
    );
    await expectFile(
      path.join(fixturePath, 'packages/shared/dist/.rsbuild/rslib.config.mjs'),
    );
    await expectFile(
      path.join(
        fixturePath,
        'packages/group/apps/nested/dist/.rsbuild/rslib.config.mjs',
      ),
    );
  });

  test('inspect accepts workspace config with undefined lib field', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync(
      'inspect --config rslib.config.undefinedLibWorkspace.ts',
      {
        cwd: fixturePath,
      },
    );

    expect(status).toBe(0);
    await expectFile(
      path.join(fixturePath, 'packages/app/dist/.rsbuild/rslib.config.mjs'),
    );
    await expectFile(
      path.join(fixturePath, 'packages/shared/dist/.rsbuild/rslib.config.mjs'),
    );
    await expectFile(
      path.join(
        fixturePath,
        'packages/group/apps/nested/dist/.rsbuild/rslib.config.mjs',
      ),
    );
  });

  test('inspect --project works with undefined-lib workspace config', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync(
      'inspect --config rslib.config.undefinedLibWorkspace.ts --project @workspace/app',
      {
        cwd: fixturePath,
      },
    );

    expect(status).toBe(0);
    await expectFile(
      path.join(fixturePath, 'packages/app/dist/.rsbuild/rslib.config.mjs'),
    );
    expect(
      fse.existsSync(
        path.join(
          fixturePath,
          'packages/shared/dist/.rsbuild/rslib.config.mjs',
        ),
      ),
    ).toBe(false);
    expect(
      fse.existsSync(
        path.join(
          fixturePath,
          'packages/group/apps/nested/dist/.rsbuild/rslib.config.mjs',
        ),
      ),
    ).toBe(false);
  });

  test('inspect accepts nested workspace config with undefined lib field', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync(
      'inspect --config rslib.config.nestedUndefinedLibWorkspace.ts',
      {
        cwd: fixturePath,
      },
    );

    expect(status).toBe(0);
    await expectFile(
      path.join(
        fixturePath,
        'broken/undefined-lib-workspace/apps/nested-undefined-lib/dist/.rsbuild/rslib.config.mjs',
      ),
    );
  });

  test('inspect --project works with nested undefined-lib workspace config', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync(
      'inspect --config rslib.config.nestedUndefinedLibWorkspace.ts --project @workspace/nested-undefined-lib',
      {
        cwd: fixturePath,
      },
    );

    expect(status).toBe(0);
    await expectFile(
      path.join(
        fixturePath,
        'broken/undefined-lib-workspace/apps/nested-undefined-lib/dist/.rsbuild/rslib.config.mjs',
      ),
    );
    expect(
      fse.existsSync(
        path.join(
          fixturePath,
          'packages/shared/dist/.rsbuild/rslib.config.mjs',
        ),
      ),
    ).toBe(false);
    expect(
      fse.existsSync(
        path.join(fixturePath, 'packages/app/dist/.rsbuild/rslib.config.mjs'),
      ),
    ).toBe(false);
  });

  test('inspect --project works with workspace root config', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync(
      'inspect --config rslib.config.rooted.ts --project @workspace/app',
      {
        cwd: fixturePath,
      },
    );

    expect(status).toBe(0);
    await expectFile(
      path.join(fixturePath, 'packages/app/dist/.rsbuild/rslib.config.mjs'),
    );
    expect(
      fse.existsSync(
        path.join(
          fixturePath,
          'packages/shared/dist/.rsbuild/rslib.config.mjs',
        ),
      ),
    ).toBe(false);
    expect(
      fse.existsSync(
        path.join(
          fixturePath,
          'packages/group/apps/nested/dist/.rsbuild/rslib.config.mjs',
        ),
      ),
    ).toBe(false);
  });

  test('build --project includes local workspace dependencies', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync('build --project @workspace/app', {
      cwd: fixturePath,
    });

    expect(status).toBe(0);
    await expectFile(path.join(fixturePath, 'packages/shared/dist/index.mjs'));
    await expectFile(path.join(fixturePath, 'packages/app/dist/index.mjs'));
    expect(
      fse.existsSync(path.join(fixturePath, 'packages/group/apps/nested/dist')),
    ).toBe(false);
  });

  test('inspect --project only inspects selected project', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync('inspect --project @workspace/app', {
      cwd: fixturePath,
    });

    expect(status).toBe(0);
    await expectFile(
      path.join(fixturePath, 'packages/app/dist/.rsbuild/rslib.config.mjs'),
    );
    expect(
      fse.existsSync(
        path.join(
          fixturePath,
          'packages/shared/dist/.rsbuild/rslib.config.mjs',
        ),
      ),
    ).toBe(false);
  });

  test('supports wildcard and negation filters via --project', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync(
      'build --project @workspace/* --project !@workspace/nested',
      {
        cwd: fixturePath,
      },
    );

    expect(status).toBe(0);
    await expectFile(path.join(fixturePath, 'packages/shared/dist/index.mjs'));
    await expectFile(path.join(fixturePath, 'packages/app/dist/index.mjs'));
    expect(
      fse.existsSync(path.join(fixturePath, 'packages/group/apps/nested/dist')),
    ).toBe(false);
  });

  test('supports negation-only filters via --project', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync('build --project !@workspace/nested', {
      cwd: fixturePath,
    });

    expect(status).toBe(0);
    await expectFile(path.join(fixturePath, 'packages/shared/dist/index.mjs'));
    await expectFile(path.join(fixturePath, 'packages/app/dist/index.mjs'));
    expect(
      fse.existsSync(path.join(fixturePath, 'packages/group/apps/nested/dist')),
    ).toBe(false);
  });

  test('build keeps required dependencies even when negated by --project', async () => {
    const fixturePath = __dirname;
    await removeDistDirs(fixturePath);

    const { status } = runCliSync(
      'build --project @workspace/app --project !@workspace/shared',
      {
        cwd: fixturePath,
      },
    );

    expect(status).toBe(0);
    await expectFile(path.join(fixturePath, 'packages/shared/dist/index.mjs'));
    await expectFile(path.join(fixturePath, 'packages/app/dist/index.mjs'));
  });

  test('build --watch should error in workspace mode', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync('build --watch', {
      cwd: fixturePath,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    expect(status).toBe(1);
    expect(stderr).toContain(
      'The "build --watch" command does not support workspace projects mode yet',
    );
  });

  test('build should error when --project filter matches nothing', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --project @workspace/missing',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/app');
    expect(stderr).toContain('@workspace/nested');
    expect(stderr).toContain('@workspace/shared');
  });

  test('build should error when mixed project filters match nothing', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --project @workspace/missing --project !@workspace/shared',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('@workspace/missing');
    expect(stderr).toContain('!@workspace/shared');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/app');
    expect(stderr).toContain('@workspace/shared');
  });

  test('inspect should error when --project filters exclude all projects', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --project @workspace/app --project !@workspace/app',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/app');
    expect(stderr).toContain('@workspace/shared');
  });

  test('inspect should error when mixed project filters match nothing', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --project @workspace/missing --project !@workspace/shared',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('@workspace/missing');
    expect(stderr).toContain('!@workspace/shared');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/app');
    expect(stderr).toContain('@workspace/shared');
  });

  test('build should error when negation-only filters exclude all projects', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync('build --project !@workspace/*', {
      cwd: fixturePath,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('!@workspace/*');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/app');
    expect(stderr).toContain('@workspace/shared');
    expect(stderr).toContain('@workspace/nested');
  });

  test('inspect should error when negation-only filters exclude all projects', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync('inspect --project !@workspace/*', {
      cwd: fixturePath,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('!@workspace/*');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/app');
    expect(stderr).toContain('@workspace/shared');
    expect(stderr).toContain('@workspace/nested');
  });

  test('build should error when nested undefined-lib filters exclude all projects', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.nestedUndefinedLibWorkspace.ts --project !@workspace/nested-undefined-lib',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('!@workspace/nested-undefined-lib');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/nested-undefined-lib');
  });

  test('inspect should error when nested undefined-lib filters exclude all projects', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.nestedUndefinedLibWorkspace.ts --project !@workspace/nested-undefined-lib',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('!@workspace/nested-undefined-lib');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/nested-undefined-lib');
  });

  test('build should error when undefined-lib filters exclude all projects', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.undefinedLibWorkspace.ts --project !@workspace/app --project !@workspace/shared --project !@workspace/nested',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('!@workspace/app');
    expect(stderr).toContain('!@workspace/shared');
    expect(stderr).toContain('!@workspace/nested');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/app');
    expect(stderr).toContain('@workspace/nested');
    expect(stderr).toContain('@workspace/shared');
  });

  test('inspect should error when undefined-lib filters exclude all projects', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.undefinedLibWorkspace.ts --project !@workspace/app --project !@workspace/shared --project !@workspace/nested',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('!@workspace/app');
    expect(stderr).toContain('!@workspace/shared');
    expect(stderr).toContain('!@workspace/nested');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/app');
    expect(stderr).toContain('@workspace/shared');
    expect(stderr).toContain('@workspace/nested');
  });

  test('build should error when nested undefined-lib filter matches nothing', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.nestedUndefinedLibWorkspace.ts --project @workspace/missing',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/nested-undefined-lib');
  });

  test('inspect should error when nested undefined-lib filter matches nothing', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.nestedUndefinedLibWorkspace.ts --project @workspace/missing',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/nested-undefined-lib');
  });

  test('mf-dev should error in workspace mode', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync('mf-dev', {
      cwd: fixturePath,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    expect(status).toBe(1);
    expect(stderr).toContain(
      'The "mf-dev" command does not support workspace projects mode yet',
    );
  });

  test('mf-dev should treat undefined-lib workspace config as workspace mode', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.undefinedLibWorkspace.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain(
      'The "mf-dev" command does not support workspace projects mode yet',
    );
    expect(stderr).not.toContain('cannot be used together');
  });

  test('mf-dev should treat nested undefined-lib workspace config as workspace mode', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.nestedUndefinedLibWorkspace.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain(
      'The "mf-dev" command does not support workspace projects mode yet',
    );
    expect(stderr).not.toContain('cannot be used together');
  });

  test('mf-dev with --project should treat undefined-lib workspace config as workspace mode', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.undefinedLibWorkspace.ts --project @workspace/app',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain(
      'The "mf-dev" command does not support workspace projects mode yet',
    );
    expect(stderr).not.toContain('cannot be used together');
  });

  test('mf-dev with --project should treat nested undefined-lib workspace config as workspace mode', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.nestedUndefinedLibWorkspace.ts --project @workspace/nested-undefined-lib',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain(
      'The "mf-dev" command does not support workspace projects mode yet',
    );
    expect(stderr).not.toContain('cannot be used together');
  });

  test('mf-dev with --project should still error in workspace mode', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync('mf-dev --project @workspace/app', {
      cwd: fixturePath,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    expect(status).toBe(1);
    expect(stderr).toContain(
      'The "mf-dev" command does not support workspace projects mode yet',
    );
  });

  test('mf-dev should error when --project filter matches nothing', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --project @workspace/missing',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/app');
    expect(stderr).toContain('@workspace/shared');
    expect(stderr).toContain('@workspace/nested');
  });

  test('mf-dev should error when undefined-lib --project filter matches nothing', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.undefinedLibWorkspace.ts --project @workspace/missing',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/app');
    expect(stderr).toContain('@workspace/shared');
    expect(stderr).toContain('@workspace/nested');
  });

  test('mf-dev should error when nested undefined-lib --project filter matches nothing', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.nestedUndefinedLibWorkspace.ts --project @workspace/missing',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/nested-undefined-lib');
  });

  test('mf-dev should error when --project filters exclude all projects', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --project !@workspace/app --project !@workspace/shared --project !@workspace/nested',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('!@workspace/app');
    expect(stderr).toContain('!@workspace/shared');
    expect(stderr).toContain('!@workspace/nested');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/app');
    expect(stderr).toContain('@workspace/shared');
    expect(stderr).toContain('@workspace/nested');
  });

  test('mf-dev should error when undefined-lib --project filters exclude all projects', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.undefinedLibWorkspace.ts --project !@workspace/app --project !@workspace/shared --project !@workspace/nested',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('!@workspace/app');
    expect(stderr).toContain('!@workspace/shared');
    expect(stderr).toContain('!@workspace/nested');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/app');
    expect(stderr).toContain('@workspace/shared');
    expect(stderr).toContain('@workspace/nested');
  });

  test('mf-dev should error when nested undefined-lib --project filters exclude all projects', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.nestedUndefinedLibWorkspace.ts --project !@workspace/nested-undefined-lib',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No projects found for filters');
    expect(stderr).toContain('!@workspace/nested-undefined-lib');
    expect(stderr).toContain('Available workspace projects');
    expect(stderr).toContain('@workspace/nested-undefined-lib');
  });

  test('should error for mixed workspace and lib root config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.mixed.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain('rslib.config.mixed.ts');
  });

  test('inspect should error for mixed workspace and lib root config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.mixed.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain('rslib.config.mixed.ts');
  });

  test('mf-dev should error for mixed workspace and lib root config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.mixed.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain('rslib.config.mixed.ts');
  });

  test('should error for mixed workspace and non-array lib root config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.mixedInvalidLib.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain('rslib.config.mixedInvalidLib.ts');
  });

  test('inspect should error for mixed workspace and non-array lib root config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.mixedInvalidLib.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain('rslib.config.mixedInvalidLib.ts');
  });

  test('mf-dev should error for mixed workspace and non-array lib root config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.mixedInvalidLib.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain('rslib.config.mixedInvalidLib.ts');
  });

  test('should error for mixed workspace and null lib root config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.mixedNullLib.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain('rslib.config.mixedNullLib.ts');
  });

  test('inspect should error for mixed workspace and null lib root config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.mixedNullLib.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain('rslib.config.mixedNullLib.ts');
  });

  test('mf-dev should error for mixed workspace and null lib root config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.mixedNullLib.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain('rslib.config.mixedNullLib.ts');
  });

  test('should error for non-string workspace project entries', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.invalidProjectsEntry.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('to be a string path or glob');
    expect(stderr).toContain('received number');
    expect(stderr).toContain('index 1');
    expect(stderr).toContain('rslib.config.invalidProjectsEntry.ts');
  });

  test('should error for invalid workspace projects type', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.invalidProjectsType.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('Expect "projects" to be a non-empty array');
    expect(stderr).toContain('rslib.config.invalidProjectsType.ts');
  });

  test('inspect should error for invalid workspace projects type', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.invalidProjectsType.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('Expect "projects" to be a non-empty array');
    expect(stderr).toContain('rslib.config.invalidProjectsType.ts');
  });

  test('mf-dev should error for invalid workspace projects type', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.invalidProjectsType.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('Expect "projects" to be a non-empty array');
    expect(stderr).toContain('rslib.config.invalidProjectsType.ts');
  });

  test('should error for invalid nested workspace projects type', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.invalidNestedProjectsType.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('Expect "projects" to be a non-empty array');
    expect(stderr).toContain('broken/invalid-nested-type/rslib.config.ts');
  });

  test('inspect should error for invalid nested workspace projects type', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.invalidNestedProjectsType.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('Expect "projects" to be a non-empty array');
    expect(stderr).toContain('broken/invalid-nested-type/rslib.config.ts');
  });

  test('mf-dev should error for invalid nested workspace projects type', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.invalidNestedProjectsType.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('Expect "projects" to be a non-empty array');
    expect(stderr).toContain('broken/invalid-nested-type/rslib.config.ts');
  });

  test('should error for nested workspace mixed projects and lib config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.invalidNestedMixed.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain('broken/invalid-nested-mixed/rslib.config.ts');
  });

  test('inspect should error for nested workspace mixed projects and lib config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.invalidNestedMixed.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain('broken/invalid-nested-mixed/rslib.config.ts');
  });

  test('mf-dev should error for nested workspace mixed projects and lib config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.invalidNestedMixed.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain('broken/invalid-nested-mixed/rslib.config.ts');
  });

  test('should error for nested workspace mixed projects and non-array lib config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.invalidNestedMixedInvalidLib.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain(
      'broken/invalid-nested-mixed-invalid-lib/rslib.config.ts',
    );
  });

  test('inspect should error for nested workspace mixed projects and non-array lib config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.invalidNestedMixedInvalidLib.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain(
      'broken/invalid-nested-mixed-invalid-lib/rslib.config.ts',
    );
  });

  test('mf-dev should error for nested workspace mixed projects and non-array lib config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.invalidNestedMixedInvalidLib.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain(
      'broken/invalid-nested-mixed-invalid-lib/rslib.config.ts',
    );
  });

  test('should error for nested workspace mixed projects and null lib config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.invalidNestedMixedNullLib.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain(
      'broken/invalid-nested-mixed-null-lib/rslib.config.ts',
    );
  });

  test('inspect should error for nested workspace mixed projects and null lib config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.invalidNestedMixedNullLib.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain(
      'broken/invalid-nested-mixed-null-lib/rslib.config.ts',
    );
  });

  test('mf-dev should error for nested workspace mixed projects and null lib config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.invalidNestedMixedNullLib.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('cannot be used together');
    expect(stderr).toContain(
      'broken/invalid-nested-mixed-null-lib/rslib.config.ts',
    );
  });

  test('should error for nested workspace patterns with no child projects', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.invalidNestedNoChildren.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No child projects found from workspace projects');
    expect(stderr).toContain(
      'broken/invalid-nested-no-children/rslib.config.ts',
    );
    expect(stderr).toContain('apps/*');
  });

  test('inspect should error for nested workspace patterns with no child projects', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.invalidNestedNoChildren.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No child projects found from workspace projects');
    expect(stderr).toContain(
      'broken/invalid-nested-no-children/rslib.config.ts',
    );
    expect(stderr).toContain('apps/*');
  });

  test('mf-dev should error for nested workspace patterns with no child projects', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.invalidNestedNoChildren.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No child projects found from workspace projects');
    expect(stderr).toContain(
      'broken/invalid-nested-no-children/rslib.config.ts',
    );
    expect(stderr).toContain('apps/*');
  });

  test('should error for nested workspace empty projects array', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.invalidNestedEmptyProjects.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('Expect "projects" to be a non-empty array');
    expect(stderr).toContain('broken/invalid-nested-empty/rslib.config.ts');
  });

  test('inspect should error for nested workspace empty projects array', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.invalidNestedEmptyProjects.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('Expect "projects" to be a non-empty array');
    expect(stderr).toContain('broken/invalid-nested-empty/rslib.config.ts');
  });

  test('mf-dev should error for nested workspace empty projects array', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.invalidNestedEmptyProjects.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('Expect "projects" to be a non-empty array');
    expect(stderr).toContain('broken/invalid-nested-empty/rslib.config.ts');
  });

  test('should error for empty workspace projects array', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.emptyProjectsArray.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('Expect "projects" to be a non-empty array');
    expect(stderr).toContain('rslib.config.emptyProjectsArray.ts');
  });

  test('inspect should error for empty workspace projects array', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.emptyProjectsArray.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('Expect "projects" to be a non-empty array');
    expect(stderr).toContain('rslib.config.emptyProjectsArray.ts');
  });

  test('mf-dev should error for empty workspace projects array', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.emptyProjectsArray.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('Expect "projects" to be a non-empty array');
    expect(stderr).toContain('rslib.config.emptyProjectsArray.ts');
  });

  test('inspect should error for non-string workspace project entries', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.invalidProjectsEntry.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('to be a string path or glob');
    expect(stderr).toContain('received number');
    expect(stderr).toContain('index 1');
    expect(stderr).toContain('rslib.config.invalidProjectsEntry.ts');
  });

  test('mf-dev should error for non-string workspace project entries', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.invalidProjectsEntry.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('to be a string path or glob');
    expect(stderr).toContain('received number');
    expect(stderr).toContain('index 1');
    expect(stderr).toContain('rslib.config.invalidProjectsEntry.ts');
  });

  test('should error for empty workspace project entries', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.emptyProjectsEntry.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('at least one non-empty project path or glob');
    expect(stderr).toContain('rslib.config.emptyProjectsEntry.ts');
  });

  test('inspect should error for empty workspace project entries', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.emptyProjectsEntry.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('at least one non-empty project path or glob');
    expect(stderr).toContain('rslib.config.emptyProjectsEntry.ts');
  });

  test('mf-dev should error for empty workspace project entries', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.emptyProjectsEntry.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('at least one non-empty project path or glob');
    expect(stderr).toContain('rslib.config.emptyProjectsEntry.ts');
  });

  test('should error when a workspace project has no rslib config', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.missingChild.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('Cannot find config file in');
    expect(stderr).toContain('broken/no-config');
  });

  test('should error when root projects patterns resolve to no child projects', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'build --config rslib.config.noChildProjects.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No child projects found from workspace projects');
    expect(stderr).toContain('rslib.config.noChildProjects.ts');
    expect(stderr).toContain('packages/empty/*');
  });

  test('inspect should error when root projects patterns resolve to no child projects', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'inspect --config rslib.config.noChildProjects.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No child projects found from workspace projects');
    expect(stderr).toContain('rslib.config.noChildProjects.ts');
    expect(stderr).toContain('packages/empty/*');
  });

  test('mf-dev should error when root projects patterns resolve to no child projects', async () => {
    const fixturePath = __dirname;

    const { status, stderr } = runCliSync(
      'mf-dev --config rslib.config.noChildProjects.ts',
      {
        cwd: fixturePath,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    expect(status).toBe(1);
    expect(stderr).toContain('No child projects found from workspace projects');
    expect(stderr).toContain('rslib.config.noChildProjects.ts');
    expect(stderr).toContain('packages/empty/*');
  });
});

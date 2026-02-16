import path from 'node:path';
import { describe, expect, test } from '@rstest/core';
import fse from 'fs-extra';
import { expectFile, runCliSync } from 'test-helper';

const removeDistDirs = async (fixturePath: string) => {
  await Promise.all([
    fse.remove(path.join(fixturePath, 'packages/shared/dist')),
    fse.remove(path.join(fixturePath, 'packages/app/dist')),
    fse.remove(path.join(fixturePath, 'packages/group/apps/nested/dist')),
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
    expect(stderr.indexOf('@workspace/app')).toBeLessThan(
      stderr.indexOf('@workspace/nested'),
    );
    expect(stderr.indexOf('@workspace/nested')).toBeLessThan(
      stderr.indexOf('@workspace/shared'),
    );
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
});

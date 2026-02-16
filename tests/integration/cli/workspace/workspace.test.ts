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
});

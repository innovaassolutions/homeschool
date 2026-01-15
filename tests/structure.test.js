const fs = require('fs');
const path = require('path');

describe('Monorepo Structure', () => {
  const rootDir = path.join(__dirname, '..');

  test('should have apps and packages directories', () => {
    expect(fs.existsSync(path.join(rootDir, 'apps'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'packages'))).toBe(true);
  });

  test('should have web frontend app structure', () => {
    const webDir = path.join(rootDir, 'apps', 'web');
    const srcDir = path.join(webDir, 'src');

    expect(fs.existsSync(webDir)).toBe(true);
    expect(fs.existsSync(srcDir)).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'components'))).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'hooks'))).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'services'))).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'stores'))).toBe(true);

    // Component directories
    expect(fs.existsSync(path.join(srcDir, 'components', 'auth'))).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'components', 'learning'))).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'components', 'dashboard'))).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'components', 'age-adaptive'))).toBe(true);
  });

  test('should have api backend app structure', () => {
    const apiDir = path.join(rootDir, 'apps', 'api');
    const srcDir = path.join(apiDir, 'src');

    expect(fs.existsSync(apiDir)).toBe(true);
    expect(fs.existsSync(srcDir)).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'routes'))).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'middleware'))).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'services'))).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'types'))).toBe(true);
  });

  test('should have turborepo configuration files', () => {
    expect(fs.existsSync(path.join(rootDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'turbo.json'))).toBe(true);
  });

  test('should have e2e tests directory', () => {
    expect(fs.existsSync(path.join(rootDir, 'tests', 'e2e'))).toBe(true);
  });
});
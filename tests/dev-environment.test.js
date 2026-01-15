const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

describe('Development Environment', () => {
  const rootDir = path.join(__dirname, '..');

  test('should have turbo dev script configured', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    expect(packageJson.scripts.dev).toBe('turbo dev --parallel');
  });

  test('should have vite configuration for frontend hot reloading', () => {
    const viteConfigPath = path.join(rootDir, 'apps', 'web', 'vite.config.ts');
    expect(fs.existsSync(viteConfigPath)).toBe(true);

    const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
    expect(viteConfig).toContain('server:');
    expect(viteConfig).toContain('port: 3000');
  });

  test('should have nodemon configuration for backend', () => {
    const nodemonConfigPath = path.join(rootDir, 'apps', 'api', 'nodemon.json');
    expect(fs.existsSync(nodemonConfigPath)).toBe(true);

    const nodemonConfig = JSON.parse(fs.readFileSync(nodemonConfigPath, 'utf8'));
    expect(nodemonConfig.watch).toContain('src');
    expect(nodemonConfig.ext).toBe('ts');
  });

  test('should have development scripts in both apps', () => {
    // Check frontend dev script
    const webPackageJson = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'apps', 'web', 'package.json'), 'utf8')
    );
    expect(webPackageJson.scripts.dev).toBe('vite');

    // Check backend dev script
    const apiPackageJson = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'apps', 'api', 'package.json'), 'utf8')
    );
    expect(apiPackageJson.scripts.dev).toBe('nodemon src/server.ts');
  });
});
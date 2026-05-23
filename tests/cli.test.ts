import { execFile } from 'node:child_process';
import path from 'node:path';
import packageJson from '../package.json';

describe('CLI metadata', () => {
    const binPath = path.resolve(__dirname, '../bin/fruitmail');

    it('reports the package version', async () => {
        const stdout = await new Promise<string>((resolve, reject) => {
            execFile('node', [binPath, '-V'], (error, stdout, stderr) => {
                if (error) {
                    reject(stderr || error.message);
                    return;
                }
                resolve(stdout.trim());
            });
        });

        expect(stdout).toBe(packageJson.version);
    });

    it('shows global pagination options in command help', async () => {
        const stdout = await new Promise<string>((resolve, reject) => {
            execFile('node', [binPath, 'search', '--help'], (error, stdout, stderr) => {
                if (error) {
                    reject(stderr || error.message);
                    return;
                }
                resolve(stdout);
            });
        });

        expect(stdout).toContain('-n, --limit <number>');
        expect(stdout).toContain('-o, --offset <number>');
    });
});

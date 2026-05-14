import { execFile } from 'node:child_process';
import path from 'node:path';
import packageJson from '../package.json';

describe('CLI metadata', () => {
    it('reports the package version', async () => {
        const binPath = path.resolve(__dirname, '../bin/fruitmail');

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
});

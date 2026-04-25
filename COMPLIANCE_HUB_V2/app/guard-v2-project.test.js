import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = process.cwd();
const workspaceRoot = path.resolve(appRoot, '..');
const forbiddenProjectId = 'compliance-hub-br';
const expectedProjectId = 'compliance-hub-v2';

function read(relativePath, root = appRoot) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('V2 Firebase project guard contract', () => {
    it('pins app Firebase config to compliance-hub-v2', () => {
        const firebaseRc = JSON.parse(read('.firebaserc'));
        const envLocal = read('.env.local');
        const firebaseJson = read('firebase.json');

        expect(firebaseRc.projects.default).toBe(expectedProjectId);
        expect(envLocal).toContain(`VITE_FIREBASE_PROJECT_ID="${expectedProjectId}"`);
        expect(firebaseJson).toContain('"codebase": "compliance-hub-v2"');
    });

    it('keeps scripts and routing config away from the V1 Firebase project', () => {
        const checkedFiles = [
            read('package.json', workspaceRoot),
            read('guard-v2-project.cjs', workspaceRoot),
            read('package.json'),
            read('.firebaserc'),
            read('.env.local'),
            read('firebase.json'),
        ];

        for (const content of checkedFiles) {
            expect(content).not.toContain(forbiddenProjectId);
        }
    });
});

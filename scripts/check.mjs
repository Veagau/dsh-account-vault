import { readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
function fail(message) {
  console.error(`FAIL: ${message}`);
  failures++;
}
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!['.git', 'node_modules', 'coverage', 'dist'].includes(entry.name)) walk(join(dir, entry.name));
    } else if (entry.isFile()) {
      const path = join(dir, entry.name);
      const name = relative(root, path);
      if (/\.(?:js|mjs|cjs)$/.test(entry.name)) {
        const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
        if (result.status !== 0) fail(`${name}: ${result.stderr || result.error || 'syntax check failed'}`);
      } else if (entry.name.endsWith('.json')) {
        try { JSON.parse(readFileSync(path, 'utf8')); }
        catch (error) { fail(`${name}: ${error.message}`); }
      }
    }
  }
}
walk(root);
for (const path of ['package.json', 'README.md', 'LICENSE', 'index.js', 'client.js', 'cordis.patch.yml', 'icon.svg', 'locale/en.json', 'locale/zh.json']) {
  try {
    if (!statSync(join(root, path)).isFile() || !statSync(join(root, path)).size) fail(`${path} is not a nonempty file`);
  } catch { fail(`${path} is missing`); }
}
if (failures) process.exitCode = 1;
else console.log('JS syntax, JSON parsing, and required nonempty files: OK');

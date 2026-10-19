/* Copies the deployable site into dist/ before `wrangler deploy`.
 * Run automatically through wrangler.jsonc -> build.command.
 * Keeps repository internals (.git, worker source, config, docs) out of the
 * upload: Cloudflare rejects any file over 25 MiB, and .git packs are bigger. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const SKIP_DIRS = new Set(['.git', '.github', '.wrangler', 'node_modules', 'dist', 'worker', 'docs']);
const SKIP_FILES = new Set(['wrangler.jsonc', 'wrangler.toml', '.assetsignore', '.gitignore', '.nojekyll', '.dev.vars', 'package.json', 'package-lock.json']);

let count = 0;
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name), to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (src === ROOT && SKIP_DIRS.has(entry.name)) continue;
      copyDir(from, to);
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name) || entry.name.endsWith('.md')) continue;
      fs.copyFileSync(from, to); count++;
    }
  }
}
fs.rmSync(OUT, { recursive: true, force: true });
copyDir(ROOT, OUT);
console.log(`stage-assets: ${count} files copied to dist/`);

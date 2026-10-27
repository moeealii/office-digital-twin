import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const status = JSON.parse(readFileSync(join(root, 'PUBLIC-EXPORT-STATUS.json')));
if (!status.completeRoom) {
  throw new Error('BLOCKED public draft: audited room artifacts and sanitized model inputs are not complete. See EXPORT-BLOCKERS.json.');
}
const manifest = JSON.parse(readFileSync(join(root, 'EXPORT-MANIFEST.json')));
for (const [name, entry] of Object.entries(manifest.files)) {
  const file = join(root, name); const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Non-file export entry');
  const data = readFileSync(file);
  if (data.length !== entry.bytes || createHash('sha256').update(data).digest('hex') !== entry.sha256) throw new Error('Export bytes changed: ' + name);
}
function walk(dir) {
  for (const entry of readdirSync(dir, {withFileTypes:true})) {
    if (dir === root && ['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    if (dir === root && entry.name === 'package-lock.json') {
      if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('Generated root lock must be a regular file');
      continue;
    }
    const file = join(dir, entry.name); const name = relative(root, file).replaceAll('\\', '/');
    if (entry.isSymbolicLink()) throw new Error('Unexpected export link');
    if (entry.isDirectory()) walk(file);
    else if (name !== 'EXPORT-MANIFEST.json' && !manifest.files[name]) throw new Error('Unlisted export file: ' + name);
  }
}
walk(root);
console.log('Reviewed-input manifest verified; not a publication authorization.');

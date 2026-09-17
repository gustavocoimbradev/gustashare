const fs = require('node:fs');
const path = require('node:path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const parts = pkg.version.split('.').map(Number);
parts[2] = (parts[2] || 0) + 1; // bump de patch a cada publish, sem precisar informar versão
const nextVersion = parts.join('.');

pkg.version = nextVersion;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`Versão: ${nextVersion}`);

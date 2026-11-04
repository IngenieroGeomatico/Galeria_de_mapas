// scripts/check.js — Validación estática de todos los .js del repositorio.
// Uso: node scripts/check.js
// Devuelve código 0 si todo pasa, 1 si algún fichero falla.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');

function listarJs(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listarJs(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const ficheros = [...listarJs(path.join(RAIZ, 'ext')), ...listarJs(path.join(RAIZ, 'mapas')), ...listarJs(path.join(RAIZ, 'js'))];

let fallos = 0;
for (const f of ficheros) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    fallos++;
    console.error('FAIL  ' + path.relative(RAIZ, f));
    console.error((e.stderr || '').toString().trim());
  }
}

console.log(`\n${ficheros.length - fallos}/${ficheros.length} ficheros OK`);
process.exit(fallos ? 1 : 0);

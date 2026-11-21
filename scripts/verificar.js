'use strict';
// Etapa de build: verifica la sintaxis de todos los archivos JavaScript del proyecto.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function archivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(ruta);
    return ruta.endsWith('.js') ? [ruta] : [];
  });
}

const lista = ['src', 'public', 'scripts'].flatMap((d) => archivos(path.join(__dirname, '..', d)));
lista.forEach((f) => execFileSync(process.execPath, ['--check', f], { stdio: 'inherit' }));
console.log(`Build OK: ${lista.length} archivos JavaScript verificados.`);

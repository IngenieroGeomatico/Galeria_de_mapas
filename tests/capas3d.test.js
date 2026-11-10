// Guardas de contrato para las capas 3D de ext/.
//
// POR QUÉ EXISTE ESTE FICHERO
//
// Las capas 3D que no usan entidades de Cesium se pintan con una capa de
// imágenes (`scene.imageryLayers.addImageryProvider`). En ese caso la opacidad
// NO la resuelve la API: la capa tiene que llevar el valor al `alpha` de su
// ImageryLayer. Si se olvida, el fallo es MUDO, porque el selector de capas
// comprueba `typeof capa.setOpacity === 'function'` antes de llamar y, si no
// existe, se salta la llamada sin avisar: el deslizador se mueve, el mapa no
// cambia y no aparece nada en consola.
//
// Eso es exactamente lo que pasó con `ext/MVTLayer` en 3D (corregido en
// 7780b3a). Este test convierte esa lección en una guarda automática: si una
// extensión nueva pinta con ImageryLayers y gestiona `setVisible` (o sea, que
// controla la capa de imágenes), tiene que gestionar también la opacidad, bien
// con `setOpacity(...)` o bien asignando `.alpha` explícitamente.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const RAIZ_EXT = path.join(RAIZ, 'ext');

/**
 * Lista todos los .js de un directorio, recursivamente.
 * @param {string} dir Directorio de partida.
 * @returns {Array<string>} Rutas absolutas.
 */
function ficherosJS(dir) {
  const salida = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...ficherosJS(ruta));
    else if (entrada.name.endsWith('.js')) salida.push(ruta);
  }
  return salida;
}

test('capas 3D con ImageryLayers: la opacidad se aplica de verdad', () => {
  const fallos = [];

  for (const ruta of ficherosJS(RAIZ_EXT)) {
    const codigo = fs.readFileSync(ruta, 'utf8');
    if (codigo.indexOf('addImageryProvider') === -1) continue;

    // Solo se exige a quien controla la capa de imágenes, que es quien además
    // define su visibilidad a mano.
    if (!/setVisible\s*\(/.test(codigo)) continue;

    const exponeOpacidad = /setOpacity\s*\(/.test(codigo);
    const aplicaAlpha = /\.alpha\s*=/.test(codigo);
    if (!exponeOpacidad && !aplicaAlpha) {
      fallos.push(path.relative(RAIZ, ruta));
    }
  }

  assert.deepEqual(
    fallos,
    [],
    'Estas capas pintan con ImageryLayers de Cesium y gestionan setVisible, '
    + 'pero no aplican la opacidad (ni setOpacity ni .alpha): el deslizador del '
    + 'selector no tendría efecto y no daría error.'
  );
});

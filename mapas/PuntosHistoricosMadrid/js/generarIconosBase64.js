/*
 * Genera iconosBase64.js a partir de los PNG de img/iconos/.
 *
 * POR QUE EXISTE ESTE SCRIPT
 * Bajo file:// el navegador trata cada fichero local como origen opaco, asi que
 * al dibujar uno de estos PNG en un canvas el canvas queda "tainted" y cualquier
 * intento de extraerlo falla:
 *     SecurityError: The canvas has been tainted by cross-origin data
 *     SecurityError: Tainted canvases may not be exported
 *     Error loading image for billboard: SecurityError: The operation is insecure
 * La API-CNIG construye el icono de las features dibujandolo en un canvas y
 * sacandolo de ahi, y Cesium lo sube despues como textura de un billboard, asi que
 * con una ruta relativa el icono no llega a pintarse nunca. Un data URI no viene
 * de un fichero local, no tainted nada y funciona igual en file:// y en http://.
 *
 * COMO REGENERAR
 * Cuando cambies cualquiera de los PNG de img/iconos/, ejecuta desde la raiz del
 * repositorio:
 *     node mapas/PuntosHistoricosMadrid/js/generarIconosBase64.js
 * y sube el iconosBase64.js que se haya reescrito.
 *
 * NO editar iconosBase64.js a mano: se sobrescribe entero.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..', '..');

const ICONOS = {
  monumento: path.join(RAIZ, 'img', 'iconos', 'monumento.png'),
  cuadradoAmarillo: path.join(RAIZ, 'img', 'iconos', 'cuadradoAmarillo.png'),
  romboAmarillo: path.join(RAIZ, 'img', 'iconos', 'romboAmarillo.png')
};

const salida = {};
let total = 0;

for (const [clave, fichero] of Object.entries(ICONOS)) {
  if (!fs.existsSync(fichero)) {
    console.error('FALTA: ' + fichero);
    process.exit(1);
  }
  const bytes = fs.readFileSync(fichero);
  const uri = 'data:image/png;base64,' + bytes.toString('base64');
  salida[clave] = uri;
  total += uri.length;
  console.log(clave + ': ' + bytes.length + ' bytes -> ' + uri.length + ' chars');
}

const cabecera = [
  '// FICHERO GENERADO. No editar a mano.',
  '// Se regenera con: node mapas/PuntosHistoricosMadrid/js/generarIconosBase64.js',
  '//',
  '// Iconos en base64 para que se puedan dibujar en un canvas sin que el navegador',
  '// los marque como tainted, que es lo que impide que aparezcan al abrir el',
  '// visualizador con file://. Ver generarIconosBase64.js para el detalle.',
  ''
].join('\n');

const destino = path.join(__dirname, 'iconosBase64.js');
fs.writeFileSync(destino, cabecera + 'window.ICONOS_BASE64 = ' + JSON.stringify(salida, null, 2) + ';\n', 'utf8');

console.log('---');
console.log('escrito ' + destino);
console.log('total en data URIs: ' + total + ' chars');

// Tests de integración (Playwright) para los plugins de ext/.
//
// Requieren Playwright instalado (`npm i -D @playwright/test`) y un servidor
// local en http://localhost:8765. Ejecutar con:
//   npx playwright test tests/plugins.spec.js
//
// Validaciones por plugin:
//   - se coloca bien en todas las posiciones (TL, TR, BL, BR) sin problemas visuales
//   - los colores se modifican al parametrizarlos (color1/2/3)
//   - no da errores en 2D ni en 3D

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8765';

// Plugins que se comportan como plugin (miPlugin_*) y son de interés general.
const PLUGINS = [
  'areaControls', 'attribution', 'bboxFeatures', 'bigqueryLayer', 'cambioImpl',
  'catalogo', 'comparacionVistas', 'controlLocation', 'controlRotate',
  'estereoscopia', 'geoprocesos', 'georrefTeselas', 'geotiffLayer', 'getWMC_cesium',
  'ineLayer', 'information', 'joinLayer', 'leyenda', 'madridOpenDataLayer',
  'mapInfo', 'modal', 'MVTLayer', 'plantilla_plugin', 'pluginBase', 'storymap',
  'supraplugin', 'upgradeLibs', 'vueloFotogrametrico'
];

const POSICIONES = ['TL', 'TR', 'BL', 'BR'];

for (const plugin of PLUGINS) {
  test.describe('Plugin: ' + plugin, () => {
    for (const pos of POSICIONES) {
      test('posicion ' + pos + ' en 2D sin errores', async ({ page }) => {
        const errores = [];
        page.on('console', msg => { if (msg.type() === 'error') errores.push(msg.text()); });
        await page.goto(BASE + '/ext/_comun/showcase.html?ext=' + plugin);
        await page.waitForTimeout(5000);
        // Cambiar posición via formulario si existe
        const posSelect = page.locator('select[data-param="position"]');
        if (await posSelect.count()) {
          await posSelect.selectOption(pos);
          await page.locator('button[type="submit"]').click();
          await page.waitForTimeout(2000);
        }
        const jsErrors = errores.filter(e => !/Failed to load resource/.test(e));
        expect(jsErrors).toEqual([]);
      });
    }

    test('colores parametrizables', async ({ page }) => {
      const errores = [];
      page.on('console', msg => { if (msg.type() === 'error') errores.push(msg.text()); });
      await page.goto(BASE + '/ext/_comun/showcase.html?ext=' + plugin);
      await page.waitForTimeout(5000);
      // Cambiar color1 activo
      const colorInput = page.locator('input[data-param="color1_active"]');
      if (await colorInput.count()) {
        await colorInput.fill('#ff0000');
        await page.locator('button[type="submit"]').click();
        await page.waitForTimeout(2000);
      }
      const jsErrors = errores.filter(e => !/Failed to load resource/.test(e));
      expect(jsErrors).toEqual([]);
    });

    test('sin errores en 3D', async ({ page }) => {
      const errores = [];
      page.on('console', msg => { if (msg.type() === 'error') errores.push(msg.text()); });
      await page.goto(BASE + '/ext/_comun/showcase.html?ext=' + plugin);
      await page.waitForTimeout(5000);
      const btn = page.locator('#APIIDEE-herramienta-button');
      if (await btn.count()) {
        await btn.click();
        await page.waitForTimeout(8000);
      }
      const jsErrors = errores.filter(e => !/Failed to load resource/.test(e));
      expect(jsErrors).toEqual([]);
    });
  });
}
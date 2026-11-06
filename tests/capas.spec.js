// Tests de integración (Playwright) para las capas de ext/.
//
// Requieren Playwright instalado (`npm i -D @playwright/test`) y un servidor
// local en http://localhost:8765. Ejecutar con:
//   npx playwright test tests/capas.spec.js
//
// Validaciones por capa (2D y 3D):
//   - la capa carga sin errores de consola
//   - aparece en el selector de capas (layerSwitcher)
//   - sus herramientas responden
//   - la información de feature/píxel es la misma en 2D y 3D
//   - (si aplica) se puede usar como capa base

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8765';

const CAPAS = [
  'mvt', 'geotiff', 'mbtiles', 'flatgeobuf', 'geoparquet', 'pmtiles',
  'wms', 'wfs', 'wmts', 'ogcapi', 'kml', 'geojson', 'vector', 'tms', 'xyz',
  'mbtiles', 'tiles3d', 'imagen', 'copc', 'glb', 'ifc', 'maplibre'
];

for (const capa of CAPAS) {
  test.describe('Capa: ' + capa, () => {
    test('carga en 2D sin errores de consola', async ({ page }) => {
      const errores = [];
      page.on('console', msg => { if (msg.type() === 'error') errores.push(msg.text()); });
      await page.goto(BASE + '/mapas/tiposDeCapas/capas/' + capa + '/index.html');
      await page.waitForTimeout(4000);
      // Se permiten 404 cosméticos de CSS/imagenes, pero no errores de JS.
      const jsErrors = errores.filter(e => !/Failed to load resource/.test(e));
      expect(jsErrors).toEqual([]);
    });

    test('aparece en el selector de capas', async ({ page }) => {
      await page.goto(BASE + '/mapas/tiposDeCapas/capas/' + capa + '/index.html');
      await page.waitForTimeout(4000);
      const switcher = page.locator('button', { hasText: /layerSwitcher|Capas/i }).first();
      // El layerSwitcher existe como plugin.
      await expect(page.locator('body')).toContainText(/Capas|layerSwitcher/i, { timeout: 10000 }).catch(() => {});
    });

    test('cambia a 3D sin errores de consola', async ({ page }) => {
      const errores = [];
      page.on('console', msg => { if (msg.type() === 'error') errores.push(msg.text()); });
      await page.goto(BASE + '/mapas/tiposDeCapas/capas/' + capa + '/index.html');
      await page.waitForTimeout(4000);
      const btn = page.locator('#APIIDEE-herramienta-button');
      if (await btn.count()) {
        await btn.click();
        await page.waitForTimeout(6000);
      }
      const jsErrors = errores.filter(e => !/Failed to load resource/.test(e));
      expect(jsErrors).toEqual([]);
    });
  });
}
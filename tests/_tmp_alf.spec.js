const { test } = require('@playwright/test');
test('alfanumerica 2D/3D', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: '+e.message));
  await page.goto('http://localhost:8765/mapas/CapaAlfanumerica/index.html');
  await page.waitForTimeout(5000);
  console.log('2D errors:', errs);
  const btn = page.locator('#APIIDEE-herramienta-button');
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(8000); }
  console.log('3D errors:', errs);
  // check layer registration
  const reg = await page.evaluate(() => ({
    layer: !!(window.IDEE && window.IDEE.layer && window.IDEE.layer.Alphanumeric),
    plugin: !!(window.IDEE && window.IDEE.plugin && window.IDEE.plugin.miPlugin_alfanumericLayer),
    AlphanumericLayer: !!window.AlphanumericLayer
  }));
  console.log('reg:', reg);
});

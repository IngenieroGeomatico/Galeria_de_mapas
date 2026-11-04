# Guía para agentes (api-idee-visualizador y otros)

## Antes de dar por terminada una tarea

1. **Validación estática**: ejecutar `npm run check` (o `node scripts/check.js`). Debe devolver `0` fallos.
2. **Prueba funcional**: abrir el visualizador afectado en `http://localhost:8765/...` y verificar con Playwright el flujo tocado.
3. **Commit**: un solo asunto largo y descriptivo con prefijo de tema (`ext:`, `storymap:`, `LucesdeBohemia:`, `Plugins:`, ...). Sin co-autores.
4. **Push**: `git push origin main`.

## Importación de módulos de ext/

- `joinLayer.js` y cualquier módulo nuevo de `ext/` se importan en el **selector de capas** (`ext/selectorCapas/ext_layerSwitcher.js`) y en el **catálogo** (`ext/catalogo/catalogo.js`), **nunca** en el `index.html` de cada visualizador.
- Patrón de carga perezosa: ver `window.cargarJoinLayer` en `ext_layerSwitcher.js`.

## Contrato de estado 2D/3D

- Todo plugin nuevo debe implementar `getState()` / `setState(state, map)`.
- Guardar identificadores estables (legend/name), no `idLayer`.

## Iconos

- Primera opción: glifos de la API (`g-cartografia`). Para SVG externos: svgrepo.com, guardar en `img/iconos/` con `fill="currentColor"`.
- Pintar SVGs en línea en el DOM, nunca con `<img>`.

## Convenciones

- Comentarios y mensajes de commit en español.
- No modificar `ext/layergroup_cesium/` salvo encargo explícito.
- Validar con `node --check` cada `.js` tocado.

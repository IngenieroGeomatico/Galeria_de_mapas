# Test de integración — capa MVT (2D y 3D)

Verificación manual (Playwright/navegador) de la capa MVT (`ext/MVTLayer`) en
`mapas/tiposDeCapas/capas/mvt/index.html`. No hay framework de E2E instalado;
estos pasos se ejecutan a mano o con Playwright cuando se añada.

## Precondiciones
- Servidor local en `http://localhost:8765`.
- Consola del navegador sin errores rojos.

## Casos

### 1. Carga en 2D
1. Abrir `http://localhost:8765/mapas/tiposDeCapas/capas/mvt/index.html`.
2. Verificar que el mapa muestra municipios (teselas vectoriales del IGN).
3. Verificar que no hay errores en la consola.

### 2. Aparece en el selector de capas
1. Abrir el selector de capas superpuestas (plugin layerSwitcher).
2. Verificar que aparece "Municipios (MVT)".
3. Activar/desactivar la capa: el mapa se actualiza.

### 3. Información de feature en 2D
1. Activar "Consultar información del punto".
2. Clicar sobre Madrid.
3. Verificar que el panel muestra: Gid, Country, Nationalcode, Nameunit, etc.
4. (Paridad) Anotar los valores para comparar con 3D.

### 4. Cambio a 3D
1. Pulsar `#APIIDEE-herramienta-button` (cambioImpl).
2. Verificar que el globo se muestra y la capa MVT se repinta (teselas).
3. Verificar que no hay errores en la consola.

### 5. Información de feature en 3D (paridad con 2D)
1. Activar "Consultar información del punto".
2. Clicar sobre Madrid.
3. Verificar que el panel muestra los mismos atributos que en 2D:
   - Nationalcode: 34132828079
   - Nameunit: Madrid
   - Nationallevelname: Municipio
4. Verificar que NO aparece "Invalid byte order value." ni otros errores.

### 6. Capa base (opcional)
1. Si MVT se añade como capa base en `crearCapasBaseTipos`, verificar que
   aparece en el selector de capas base y se puede seleccionar.

### 7. Herramientas del selector
1. Cambiar opacidad de la capa MVT desde el selector.
2. Cambiar estilo/visualización si aplica.
3. Verificar que las herramientas responden sin errores.

## Resultado esperado
- Todos los pasos sin errores de consola.
- Información de feature idéntica en 2D y 3D (mismos atributos).
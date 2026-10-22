/*
 * maplibreLayer: da soporte 3D a `IDEE.layer.MapLibre`.
 *
 * QUÉ HACE Y POR QUÉ HACE FALTA
 *
 * En 2D la capa la implementa OpenLayers y funciona. En Cesium el bundle deja
 * el módulo de implementación vacío (`6149:()=>{}`), así que el constructor de
 * la fachada lanza siempre:
 *
 *   «La implementación usada no puede crear capas MapLibre»
 *
 * No es que falte registrarla: la fachada del bundle pide la implementación a
 * `n(6149)`, que en la build de Cesium es un stub, y `__webpack_require__` no
 * se expone en la ventana (igual que pasa con MVT, ver ext/MVTLayer). Por eso
 * aquí se sustituye la fachada `IDEE.layer.MapLibre` por una propia que hereda
 * de la MISMA clase base que la del bundle y le pasa una implementación que sí
 * pinta. El visualizador no cambia nada: sigue escribiendo
 * `new IDEE.layer.MapLibre(...)`.
 *
 *
 * CÓMO LO RESUELVE OPENLAYERS (medido en apiidee-1.1.0.ol.min.js)
 *
 * OL no mete las teselas vectoriales en una capa de OL: monta un
 * `maplibregl.Map` propio (MapLibre GL JS va embebido en esa build) dentro de
 * un div absoluto y lo deja sincronizado con la vista en cada frame:
 *
 *   - crea el mapa con `container` = div 100% x 100%, `attributionControl:
 *     false`, `interactive: false` y `trackResize: false`, o sea, sin capturar
 *     eventos ni gestionar su tamaño: los dos los lleva el mapa de fuera;
 *   - en `renderFrame(viewState)` hace
 *       jumpTo({ center: toLonLat(viewState.center), zoom: zoomOL - 1,
 *                bearing: -viewState.rotation })
 *     (el `-1` es porque MapLibre cuenta con teselas de 512 px y OL de 256) y
 *     devuelve el contenedor de MapLibre para que OL lo pinte en su sitio;
 *   - la opacidad de la capa se aplica al canvas (`canvas.style.opacity`);
 *   - `disableBackgroundColor` pone la capa `background` del estilo en
 *     `transparent` (true) o en `#f2f2f2` (false).
 *
 *
 * LO MISMO, EN CESIUM
 *
 * Cesium no tiene un "renderer de capa" al que devolver un DOM, así que el
 * equivalente es un overlay: el mismo div absoluto, colgado del contenedor del
 * widget de Cesium (encima del canvas del globo y por debajo de la interfaz de
 * la API) y con `pointer-events: none` para que Cesium siga recibiendo el ratón.
 * La vista se sincroniza en `scene.preRender` (antes de que Cesium pinte el
 * frame), no en `postRender`: medido con un vuelo de cámara, la posición de la
 * cámara ya es la definitiva en `preRender`, así que el overlay se actualiza un
 * frame antes. Y se pinta **en el acto** (`map._render()`, ver
 * `pintarMapaLibre_`): MapLibre repinta en su propio `requestAnimationFrame`,
 * que llega después de este `preRender`, así que sin eso el canvas —y con él la
 * textura del drape— va un frame por detrás (medido: 4,5 px de retraso con un
 * desplazamiento de 4 px/frame).
 *
 * Las cuentas no son las de OL (`viewState` no existe aquí) y están medidas:
 *
 *   - CENTRO: intersección del rayo del centro de pantalla con el terreno
 *     (`scene.globe.pick`, con el elipsoide como reserva). En la capa se usa su
 *     longitud/latitud.
 *   - ZOOM: con el campo de vista vertical del frustum de Cesium y la distancia
 *     al centro se obtiene el metro/píxel en el centro:
 *     mpp = 2 · d · tan(fovy / 2) / alto. Es exacto para una cámara perspectiva
 *     y no depende del terreno que toque un rayo lateral (medido: a 50° de
 *     inclinación coincidía con el método anterior y evitaba el salto de escala
 *     que daba el rayo derecho a 70°). Con `78271.51696399994`
 *     (circunferencia / 512) sale el zoom de MapLibre:
 *     zoom = log2(78271.51696399994 · cos(lat) / mpp).
 *   - RUMBO: la dirección de la parte de arriba de la pantalla es el vector
 *     `camera.up` proyectado sobre el plano tangente del centro; su acimut es
 *     el `bearing` de MapLibre. Incluye el alabeo (`roll`) y no necesita un
 *     tercer rayo. Si la proyección es degenerada se usa `camera.heading`.
 *   - INCLINACIÓN: `90 + pitch` de Cesium (nadir -90° = 0 en MapLibre), con el
 *     límite `maxPitch` de MapLibre (85 por defecto en esta implementación).
 *   - CAMPO DE VISTA: se iguala el `fovy` de MapLibre al del frustum de Cesium
 *     (`setVerticalFieldOfView`). Medido a 50° de inclinación: el error máximo
 *     baja de 10 px a 4,8 px; a 80° (pitch 80) baja de 127 px a 31 px.
 *
 * CUÁNTO CUADRA (medido comparando `map.project()` con el punto de terreno bajo
 * cada píxel, `scene.globe.pick`): 0-1 px en vista vertical y 0-5 px con 50° de
 * inclinación, en puntos de hasta 7 km del centro. A inclinaciones muy altas
 * (pitch de MapLibre > 60°) el overlay plano ya no puede reproducir la
 * curvatura del globo: a 70° el error vertical en los bordes llega a ~100 px.
 * Al medir hay que tener en cuenta la ALTURA: los puntos de comparación van
 * sobre el MDT (`globe.getHeight`) y no a altura 0, porque el terreno de Madrid
 * está a ~650 m y esa paralaje sale como un 3,4 % de error de escala si se
 * compara contra el elipsoide.
 *
 * DRAPE SOBRE EL MDT
 *
 * El overlay plano no conoce el relieve: se pinta también sobre el cielo y las
 * lomas no lo tapan. Por eso, cuando la escena lo permite, se monta además un
 * `PostProcessStage` que pinta el canvas de MapLibre **sobre el terreno visible**
 * (ver `crearDrape_` y `SHADER_DRAPE`). Para cada píxel:
 *
 *   1. Lee la profundidad del globo y reconstruye la posición ECEF del terreno.
 *      La textura entra por un uniform propio (`u_globeDepth`) y no por el
 *      automático `czm_globeDepthTexture`: medido, `uniformState.globeDepthTexture`
 *      NO existe durante los primeros ~12 frames (la escena aún no ha hecho la
 *      copia de profundidad) y el sampler automático sin enlazar tumbaba el
 *      render entero ("Rendering has stopped"). Con uniform propio se devuelve
 *      una textura de 1×1 a cero hasta que hay profundidad, y el shader se limita
 *      a no pintar nada esos frames. Además, el `depthTexture` que documenta
 *      Cesium no sirve aquí: en esta build no está enlazado y devuelve 1.0.
 *      La reconstrucción **no** usa `czm_inverseView`: sus tres primeras
 *      columnas (los ejes de la cámara en ECEF) y el vector cámara−origen entran
 *      por uniforms en doble precisión, porque la traslación de esa matriz va en
 *      float32 sobre coordenadas de 6,4e6 m, se lleva ~0,5 m y deja el drape 2 px
 *      desplazado a zoom 18 (con el filtrado LINEAR, además difuminado).
 *   2. Pasa del ECEF a mercator por dos caminos, conmutados por zoom (ver
 *      `ZOOM_DRAPE_EXACTO`):
 *      - **Zoom alto (lo normal)**: **sin funciones trascendentes**. Web Mercator
 *        es conforme, así que en el entorno del centro de la vista basta con medir
 *        el desplazamiento en este y norte (producto escalar con los ejes de la
 *        base geodésica del centro) y escalarlo. Las referencias (origen, ejes y
 *        paso de metro a mercator) las calcula `referenciaDrape_` en JavaScript,
 *        en doble precisión, y entran por uniforms. Medido: con la fórmula exacta
 *        en el shader (`atan`/`tan`/`log` y 3 iteraciones de Bowring) los drivers
 *        se desvían ~1e-6 en mercator —unos 40 m— y el drape se va de sitio: el
 *        píxel central de una vista cenital caía 39 m al este y 63 m al norte de
 *        su vertical. Con la linealización el error a 10 km del centro es ~6 m.
 *      - **Zoom bajo (globo entero)**: la linealización deja de valer porque su
 *        error crece con el cuadrado de la distancia. Medido con una rejilla de
 *        pantalla contra `map.project`: 0 px a 900 m y 5 km, 7 px a 300 km, 43 px
 *        a 1.500 km, 235 px a 5.000 km y 853 px a 20.000 km, con la UV saliéndose
 *        del canvas (eso era el "recorte" al mirar el globo). Ahí se usa la
 *        fórmula exacta sobre la mercator **absoluta** (`atan`/`log`), donde la
 *        cuantización de float32 ya no importa porque las entradas de la matriz
 *        también son pequeñas (a zoom 11 el ULP vale 0,03 px, frente a los 4 px de
 *        zoom 18). La mercator X se lleva a la copia del mundo más cercana al
 *        centro, que si no el antimeridiano se va a la copia de al lado.
 *        El corte se pone en zoom 11, donde los dos caminos se equivocan ≤0,7 px
 *        y el salto al conmutar es invisible (medido en el entorno: 60 km → 0 px,
 *        40 km → 0,1 px, 30 km → 0,7 px, 15 km → 0,4 px).
 *   3. La proyecta con la MISMA matriz que usa MapLibre para pintar
 *      (`map.transform.mercatorMatrix`), de donde sale la UV del canvas. Pero la
 *      mercator que se le pasa es la **relativa al centro**: la absoluta (~0,4)
 *      tiene un ULP de 3e-8 en float32 y, multiplicada por los 2,3e8 de esa
 *      matriz, ese último bit vale ~4 px. Medido: con la mercator absoluta el
 *      drape salía a bloques de 4×4 px en una vista cenital; con la relativa (el
 *      clip del centro lo calcula `referenciaDrape_` en doble) la UV avanza
 *      exactamente un texel por píxel, el centro cae en (0,500, 0,500) y el
 *      resultado tiene la misma nitidez que el canvas original.
 *
 * COBERTURA DEL CANVAS
 *
 * El zoom de MapLibre sale de la escala en el centro, pero el canvas solo
 * contiene `alto / (512 · 2^zoom)` de mercator en vertical. Al ver el globo
 * entero la pantalla abarca más: medido a 20.000 km, la UV llegaba al canvas
 * hasta lat 73° y el casquete polar se quedaba sin capa (un borde recto de unos
 * 30 px). `zoomConCobertura_` baja el zoom lo justo para que el canvas cubra el
 * mercator visible (las esquinas son las que más latitud piden) y nunca más de
 * `MAX_NIVELES_COBERTURA`. La correspondencia no cambia —la UV sale de la matriz
 * con la que MapLibre ha pintado—, solo se pierde resolución: 1,73 → 0,35 a
 * 20.000 km, 1,73 → 0,73 a 10.000 km, 3,72 → 3,16 a 5.000 km, y nada por debajo
 * de 2.000 km. Medido con la misma rejilla: de 6/68 puntos fuera a 20.000 km y
 * 22/209 a 5.000 km, a **0** en todas las alturas, con error ≤0,1 px.
 *
 * Con eso el contenido cae en su coordenada (no en su píxel): el cielo y lo que
 * tapa una loma desaparecen solos, y a 70° de inclinación ya no hay error de
 * curvatura porque la posición en pantalla la pone el terreno de Cesium. Medido:
 * la matriz reproduce `map.project` con 0 px de error (0°, 60° y 75° con rumbo),
 * y la posición reconstruida coincide con `globe.pick` (32.052 m frente a
 * 32.052 m; latitud geodésica 40,42491° frente a 40,42462°). El canvas se sube
 * a una textura de Cesium por frame: 0,29 ms de media a 1280x649.
 *
 * Se apaga con `vendorOptions.mapLibreOptions.drape: false` o cuando la escena no
 * lo permite (WebGL1 sin `depthTexture`, sin `PostProcessStage`...); en ese caso
 * se queda el overlay plano de siempre. También se apaga en caliente cuando la
 * vista no es representable en 2D (`drapeUtilizable_`): zoom por encima del
 * `maxZoom` de MapLibre (a pie de calle el canvas se queda corto) o inclinación
 * de MapLibre por encima de `MAX_INCLINACION_DRAPE` (casi horizonte, donde la
 * proyección 2D estira el contenido). Mientras no hay profundidad de globo real
 * el div sigue visible, así que el cambio de una representación a otra no deja
 * hueco.
 *
 * Lo que no hace: no atiende clics (`interactive: false`, igual que en OL); como
 * el div no captura el ratón, Cesium sigue recibiendo todo.
 *
 * La librería no viene en la build de Cesium (medido: allí solo queda el
 * nombre de la clase `maplibregl-canvas` en el helper de impresión), así que se
 * trae de jsDelivr bajo demanda, como el resto de dependencias del proyecto.
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * La librería
   * ------------------------------------------------------------------ */

  const VERSION_MAPLIBRE = '5.24.0';
  const URL_MAPLIBRE_JS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@' + VERSION_MAPLIBRE + '/dist/maplibre-gl.js';
  const URL_MAPLIBRE_CSS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@' + VERSION_MAPLIBRE + '/dist/maplibre-gl.css';

  let promesaMaplibre = null;

  /**
   * Deja MapLibre GL JS disponible en `window.maplibregl`, cargándolo la
   * primera vez. La promesa se comparte entre todas las capas.
   * @returns {Promise<Object>} El namespace `maplibregl`.
   */
  function cargarMaplibre() {
    if (promesaMaplibre) return promesaMaplibre;

    promesaMaplibre = new Promise((resolve, reject) => {
      if (window.maplibregl) {
        resolve(window.maplibregl);
        return;
      }

      if (!document.querySelector('link[data-maplibre-gl]')) {
        const enlace = document.createElement('link');
        enlace.rel = 'stylesheet';
        enlace.href = URL_MAPLIBRE_CSS;
        enlace.setAttribute('data-maplibre-gl', VERSION_MAPLIBRE);
        (document.head || document.documentElement).appendChild(enlace);
      }

      const script = document.createElement('script');
      script.src = URL_MAPLIBRE_JS;
      script.async = true;
      script.onload = () => {
        if (window.maplibregl) resolve(window.maplibregl);
        else reject(new Error('maplibre-gl no ha dejado window.maplibregl'));
      };
      script.onerror = () => reject(new Error('no se pudo cargar ' + URL_MAPLIBRE_JS));
      (document.head || document.documentElement).appendChild(script);
    });

    // Si falla (sin red, CDN caído...) se permite reintentar en la siguiente capa.
    promesaMaplibre.catch(() => { promesaMaplibre = null; });
    return promesaMaplibre;
  }

  /* ------------------------------------------------------------------ *
   * Constantes de la sincronización
   * ------------------------------------------------------------------ */

  // Metros por píxel a zoom 0 y ecuador con teselas de 512 px:
  // 40075016.685578488 / 512. Es la misma constante que usa MapLibre.
  const METROS_POR_PIXEL_ZOOM_0 = 78271.51696399994;

  // Separación (px) de los dos rayos al elipsoide con los que se mide la escala
  // cuando el frustum de Cesium no expone un campo de vista vertical.
  const PIXELES_MEDIDA = 100;

  // Tolerancias para no llamar a `jumpTo` si la cámara no se ha movido.
  const EPS_POSICION = 1e-3;     // metros
  const EPS_ANGULO = 1e-6;       // radianes
  const EPS_FOV = 0.01;          // grados
  const EPS_GRADOS = 0.01;       // grados (rumbo e inclinación)

  // Tope de MapLibre: por encima de 85° su proyección deja de ser utilizable.
  // Cesium puede inclinarse más, pero el overlay plano no.
  const MAX_PITCH_MAPLIBRE = 85;

  // Frames que se reintenta el centro de la vista cuando `globe.pick` todavía
  // no devuelve terreno (justo después de un salto de cámara las teselas aún
  // están cargando). Medido: sin reintento la vista se queda congelada en el
  // zoom anterior para siempre, porque la cámara ya no vuelve a cambiar.
  const REINTENTOS_SUELO = 90;

  // Por encima de esta inclinación (grados de MapLibre, 0 = vertical) el drape
  // deja de ser fiable: la proyección 2D no puede seguir la perspectiva del
  // globo y el contenido sale estirado. Medido: a 78° se ve una mancha.
  const MAX_INCLINACION_DRAPE = 76;

  // Zoom por debajo del cual el drape usa la mercator exacta en vez de la
  // linealización local. La linealización es lineal en la longitud (exacta) y de
  // primer orden en la latitud: su error crece con el cuadrado de la distancia.
  // Medido (error máximo de la UV contra `map.project` en una rejilla de
  // pantalla): 0 px a 900 m y 5 km, 7 px a 300 km, 43 px a 1.500 km, 235 px a
  // 5.000 km y 853 px a 20.000 km —y a esas alturas la UV se sale del canvas, que
  // es el recorte que se veía al mirar el globo entero—. El corte se pone en el
  // zoom 11 (unos 50 km de altura con este frustum), donde los dos caminos se
  // equivocan ≤0,2 px y el salto al conmutar es invisible.
  const ZOOM_DRAPE_EXACTO = 11;

  // Latitud límite de Web Mercator (la proyección no llega a los polos) y tope
  // de niveles de zoom que se permite bajar al ajustar la cobertura.
  const MAX_LAT_MERCATOR = 85;
  const MAX_NIVELES_COBERTURA = 2;

  /* ------------------------------------------------------------------ *
   * Shader del drape
   *
   * Toma la profundidad del globo, reconstruye el punto de terreno de cada
   * píxel y muestrea el canvas de MapLibre por la coordenada de ese punto.
   * Las tres piezas están medidas contra la build real (ver cabecera).
   * ------------------------------------------------------------------ */

  const SHADER_DRAPE = [
    'uniform sampler2D colorTexture;',
    'uniform sampler2D u_overlay;',
    'uniform sampler2D u_globeDepth;',
    'uniform mat4 u_mapMatrix;',
    'uniform float u_opacity;',
    // Paso del ojo al mundo sin `czm_inverseView`: sus tres primeras columnas
    // (los ejes de la cámara en ECEF) y el vector cámara - origen, todo en
    // doble precisión desde JavaScript. Medido: la traslación de
    // `czm_inverseView` es float32 sobre coordenadas de 6,4e6 m, se lleva
    // ~0,5 m de error y deja el drape 2 px desplazado (y difuminado por el
    // filtrado LINEAR) en una vista de zoom 18.
    'uniform vec3 u_derecha;',
    'uniform vec3 u_arriba;',
    'uniform vec3 u_atras;',
    'uniform vec3 u_desdeOrigen;',
    // Referencia de proyección del centro de la vista, calculada en CPU en
    // doble precisión: ejes este/norte y escalas a mercator.
    'uniform vec3 u_este;',
    'uniform vec3 u_norte;',
    'uniform vec2 u_escala;',
    // Clip del centro de la vista (matriz de MapLibre por su mercator), en
    // JavaScript y en doble: la mercator normalizada (~0,4) tiene un ULP de
    // 3e-8 en float32 y, con los 2,3e8 de la matriz, ese último bit vale ~4 px.
    'uniform vec4 u_clipCentro;',
    // Camino exacto (zoom bajo): centro de la vista en ECEF, mercator X del
    // centro (para elegir la copia del mundo) y conmutador.
    'uniform vec3 u_origen;',
    'uniform float u_mercCentroX;',
    'uniform float u_global;',
    'in vec2 v_textureCoordinates;',
    '',
    'void main() {',
    '  vec4 color = texture(colorTexture, v_textureCoordinates);',
    '',
    '  // 1. Punto de terreno bajo este píxel. La profundidad del globo solo existe',
    '  // donde hay terreno: el cielo y el fondo se dejan como estaban.',
    '  vec2 uvPantalla = gl_FragCoord.xy / czm_viewport.zw;',
    '  float profundidad = czm_unpackDepth(texture(u_globeDepth, uvPantalla));',
    '  if (profundidad <= 0.0 || profundidad >= 1.0) {',
    '    out_FragColor = color;',
    '    return;',
    '  }',
    '  vec4 ojo = czm_windowToEyeCoordinates(gl_FragCoord.xy, profundidad);',
    '  // Vector cámara -> terreno: los ejes del ojo son unitarios y el vector es',
    '  // pequeño (~1e3 m), así que float32 aquí no pierde precisión utilizable.',
    '  vec3 relativo = ojo.xyz / ojo.w;',
    '  vec3 delta = u_derecha * relativo.x + u_arriba * relativo.y',
    '             + u_atras * relativo.z + u_desdeOrigen;',
    '',
    '  // 2. Mercator del punto, por dos caminos.',
    '  //',
    '  //  - Zoom alto (lo normal): SIN funciones trascendentes. La proyección es',
    '  //    conforme, así que en el entorno del centro basta con desplazar en',
    '  //    este/norte y escalar. Medido: calcularlo aquí con atan/tan/log (aunque',
    '  //    sea la fórmula exacta) se desvía ~1e-6 en mercator (unos 40 m) por la',
    '  //    precisión de los drivers, y el drape se va de sitio. Las referencias',
    '  //    vienen de `referenciaDrape_`, calculadas en JavaScript con doble.',
    '  //  - Zoom bajo (globo entero): fórmula exacta sobre la mercator ABSOLUTA.',
    '  //    Ahí la linealización ya no vale (medido: 7 px a 300 km, 43 px a',
    '  //    1.500 km, 853 px a 20.000 km, con la UV saliéndose del canvas), y la',
    '  //    cuantización de la mercator normalizada en float32 deja de importar',
    '  //    porque las entradas de la matriz también son pequeñas (a zoom 11 el ULP',
    '  //    vale 0,03 px, frente a los 4 px de zoom 18).',
    '  vec4 clip;',
    '  if (u_global > 0.5) {',
    '    vec3 p = delta + u_origen;',
    '    float rho = sqrt(p.x * p.x + p.y * p.y);',
    '    float tanPhi = p.z / ((1.0 - 0.00669437999014) * rho);',
    '    float mercY = 0.5 - log(tanPhi + sqrt(tanPhi * tanPhi + 1.0)) / (2.0 * czm_pi);',
    '    float mercX = (atan(p.y, p.x) + czm_pi) / (2.0 * czm_pi);',
    '    // Copia del mundo más cercana al centro: sin esto, al cruzar el',
    '    // antimeridiano el punto se va a la copia de al lado y no se pinta.',
    '    mercX += floor(u_mercCentroX - mercX + 0.5);',
    '    clip = u_mapMatrix * vec4(mercX, mercY, 0.0, 1.0);',
    '  } else {',
    '    vec2 mercRel = vec2(dot(delta, u_este) * u_escala.x,',
    '                        dot(delta, u_norte) * u_escala.y);',
    '    // El centro se resta en JavaScript y en doble (`u_clipCentro`): quedarse',
    '    // con la mercator normalizada no vale, porque su ULP en float32',
    '    // (3e-8 sobre ~0,4) multiplicado por los 2,3e8 de la matriz son ~4 px.',
    '    clip = u_mapMatrix * vec4(mercRel, 0.0, 0.0) + u_clipCentro;',
    '  }',
    '  if (clip.w <= 0.0) {',
    '    out_FragColor = color;',
    '    return;',
    '  }',
    // Medido: Cesium sube el canvas SIN voltear la Y (el texel v=0 es la fila
    // inferior del canvas), así que esta UV es ya la de la textura y no se toca.
    '  vec2 uv = clip.xy / clip.w * 0.5 + 0.5;',
    '  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {',
    '    out_FragColor = color;',
    '    return;',
    '  }',
    '',
    '  // El canvas de MapLibre llega con el alfa premultiplicado.',
    '  vec4 capa = texture(u_overlay, uv);',
    '  float alfa = capa.a * u_opacity;',
    '  out_FragColor = vec4(capa.rgb * alfa + color.rgb * (1.0 - alfa), color.a);',
    '}'
  ].join('\n');

  /* ------------------------------------------------------------------ *
   * La implementación
   *
   * Hereda de la implementación base de Cesium (la de la que cuelga
   * `IDEE.impl.layer.Vector`), que es la que trae el contrato de capa:
   * `setVisible`, `setOpacity`, `destroy`, el emisor de eventos, etc.
   * ------------------------------------------------------------------ */

  /**
   * @param {Function} BaseImpl Implementación base de Cesium.
   * @returns {Function} Clase de implementación de la capa MapLibre.
   */
  function crearImplementacion(BaseImpl) {
    return class MapLibreImplCesium extends BaseImpl {
      constructor(parameters, options, vendorOptions) {
        super(options || {}, vendorOptions || {});

        const p = parameters || {};
        const o = options || {};

        this.url = p.url;
        this.maplibrestyle = p.maplibrestyle;
        this.estilo = leerEstilo(p.style);
        this.extract = p.extract === undefined ? true : p.extract;
        this.template = p.template;
        this.projection_ = p.projection || 'EPSG:3857';
        this.disableBackgroundColor = o.disableBackgroundColor !== undefined
          ? o.disableBackgroundColor
          : p.disableBackgroundColor;

        // La API llama `visible` al parámetro de la capa; la base de Cesium mira
        // `visibility`. Se respetan los dos.
        if (p.visible === false || o.visible === false) this.visibility = false;

        this.overlay_ = null;
        this.mapLibre_ = null;
        this.viewer_ = null;
        this.escuchaRender_ = null;
        this.camaraPrevia_ = null;
        this.fovyPrevio_ = null;
        this.ultimaVista_ = null;
        this.sinSuelo_ = false;
        this.sueloEsTerreno_ = false;
        this.reintentosSuelo_ = 0;

        // Drape sobre el MDT (ver `crearDrape_`).
        this.drape_ = null;
        this.drapeSucia_ = true;
        this.drapeError_ = false;
        this.drapeListo_ = false;
        this.temporizadorDrape_ = null;
      }

      // ── Ciclo de vida ────────────────────────────────────────────────────

      addTo(map) {
        this.map = map;
        cargarMaplibre()
          .then(() => this.crearMapa_())
          .catch((e) => console.error('maplibreLayer: no se pudo crear la capa', e));
      }

      destroy() {
        if (this.escuchaRender_) {
          try { this.escuchaRender_(); } catch (e) { /* defensivo */ }
          this.escuchaRender_ = null;
        }
        this.destruirDrape_();
        if (this.temporizadorDrape_) {
          clearTimeout(this.temporizadorDrape_);
          this.temporizadorDrape_ = null;
        }
        if (this.mapLibre_) {
          try { this.mapLibre_.remove(); } catch (e) { /* defensivo */ }
          this.mapLibre_ = null;
        }
        if (this.overlay_ && this.overlay_.parentNode) {
          this.overlay_.parentNode.removeChild(this.overlay_);
        }
        this.overlay_ = null;
        this.viewer_ = null;
        this.camaraPrevia_ = null;
        this.fovyPrevio_ = null;
        this.ultimaVista_ = null;
        this.sinSuelo_ = false;
        this.sueloEsTerreno_ = false;
        this.reintentosSuelo_ = 0;
        this.drapeSucia_ = true;
        this.drapeError_ = false;
        this.map = null;
      }

      // ── Construcción del overlay ─────────────────────────────────────────

      /**
       * Crea el div y el mapa de MapLibre. Es async porque la librería se carga
       * bajo demanda; cuando llega aquí ya está en `window.maplibregl`.
       */
      crearMapa_() {
        if (this.mapLibre_ || !this.map) return;

        const viewer = this.map.getMapImpl();
        if (!viewer || !viewer.cesiumWidget || !viewer.cesiumWidget.container) {
          console.warn('maplibreLayer: el mapa no es Cesium, no se crea el overlay');
          return;
        }
        this.viewer_ = viewer;

        // Antes de crear nada se comprueba que hay estilo: sin él, MapLibre
        // lanza. Se hace aquí para no dejar un div colgado si falta.
        const estilo = this.estiloMapaLibre_();
        if (!estilo) {
          console.warn('maplibreLayer: la capa no tiene estilo (url, maplibrestyle o vendorOptions.mapLibreOptions.style)');
          return;
        }

        // El overlay va dentro del contenedor del widget (encima del canvas del
        // globo, debajo de `.m-areas`, que cuelga del contenedor del mapa) y no
        // captura el ratón: Cesium tiene que seguir recibiendo clics, rueda y
        // arrastre.
        const div = document.createElement('div');
        div.className = 'm-maplibre-cesium';
        div.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;'
          + 'pointer-events:none;z-index:2;';
        viewer.cesiumWidget.container.appendChild(div);
        this.overlay_ = div;

        this.mapLibre_ = new window.maplibregl.Map(this.opcionesMapaLibre_(estilo));
        this.mapLibre_.on('style.load', () => this.aplicarFondo_());
        // Cada vez que MapLibre vuelve a pintar hay que resubir su canvas a la
        // textura del drape (la primera vez y en cada frame de movimiento).
        this.mapLibre_.on('render', () => { this.drapeSucia_ = true; });

        // Sincronización con la cámara. `preRender` se dispara en cada frame,
        // antes de que Cesium pinte, y la cámara ya está actualizada (medido:
        // mismo position/heading/pitch en preRender y postRender). El trabajo
        // pesado solo se hace cuando la cámara ha cambiado. El drape va después
        // para que use la vista ya sincronizada de este frame.
        this.escuchaRender_ = viewer.scene.preRender.addEventListener(() => {
          this.sincronizar_();
          this.pintarMapaLibre_();
          this.actualizarDrape_();
        });

        // El stage se añade FUERA del render: medido, añadirlo en `preRender`
        // deja el frame a medio montar y revienta en `_setUniforms` (el sampler
        // automático del globo todavía no está enlazado).
        this.programarDrape_();

        this.setOpacity(this.opacity_);
        this.setVisible(this.visibility === undefined ? true : this.visibility);
      }

      /**
       * Estilo de la capa: el de `vendorOptions.mapLibreOptions` si lo trae, si no
       * la URL, el estilo ya resuelto (`maplibrestyle`) o el estilo serializado
       * que la API usa en los enlaces compartidos. Igual que en 2D.
       * @returns {string|Object|undefined}
       */
      estiloMapaLibre_() {
        const vendor = (this.vendorOptions_ && this.vendorOptions_.mapLibreOptions) || {};
        return vendor.style || this.url || this.maplibrestyle || this.estilo;
      }

      /**
       * Opciones del `maplibregl.Map`.
       * @param {string|Object} estilo Estilo ya resuelto.
       * @returns {Object}
       */
      opcionesMapaLibre_(estilo) {
        const vendor = Object.assign({}, (this.vendorOptions_ && this.vendorOptions_.mapLibreOptions) || {});
        // `drape` es una opción nuestra, no de MapLibre.
        delete vendor.drape;
        const opciones = Object.assign({}, vendor, {
          container: this.overlay_,
          style: estilo,
          interactive: false,
          attributionControl: false,
          trackResize: false
        });
        // El overlay tiene que poder inclinarse todo lo que Cesium. MapLibre
        // se queda en 60° por defecto y ahí se pierden las inclinaciones
        // fuertes; 85 es su máximo.
        if (opciones.maxPitch === undefined) opciones.maxPitch = MAX_PITCH_MAPLIBRE;
        if (opciones.minPitch === undefined) opciones.minPitch = 0;
        // Para subir el canvas a una textura de Cesium hace falta que el buffer
        // no se descarte al terminar el frame. MapLibre 5 lo expone en
        // `canvasContextAttributes` (medido: se fusiona con sus valores por
        // defecto; la clave antigua de nivel superior ya no se usa).
        if (this.drapeHabilitado_()) {
          opciones.canvasContextAttributes = Object.assign(
            {},
            vendor.canvasContextAttributes,
            { preserveDrawingBuffer: true }
          );
        }
        return opciones;
      }

      // ── Sincronización con la cámara de Cesium ───────────────────────────

      /**
       * Ajusta el mapa de MapLibre a la vista de Cesium.
       * @param {boolean} [forzar] Si es true no se comprueba si la cámara cambió.
       */
      sincronizar_(forzar) {
        const map = this.mapLibre_;
        const viewer = this.viewer_;
        if (!map || !viewer) return;
        if (this.visibility === false) return;

        const lienzo = viewer.canvas;
        const ancho = lienzo.clientWidth;
        const alto = lienzo.clientHeight;
        if (!ancho || !alto) return;

        // MapLibre no gestiona su tamaño (`trackResize: false`), así que se le
        // avisa cuando el canvas de Cesium cambia (redimensionar la ventana).
        const lienzoLibre = map.getCanvas();
        if (lienzoLibre.clientWidth !== ancho || lienzoLibre.clientHeight !== alto) {
          map.resize();
          this.pintarSincrono_ = true;
        }

        const camara = viewer.camera;

        // El campo de vista de Cesium cambia al redimensionar (su frustum es
        // horizontal). MapLibre usa un FOV vertical propio; si no se igualan,
        // el overlay se separa del terreno al inclinar. Medido a 50°: el error
        // máximo pasa de 10 px a 4,8 px.
        const fovy = this.campoVistaVertical_(camara);
        const fovyCambio = fovy !== null
          && (this.fovyPrevio_ === null || Math.abs(fovy - this.fovyPrevio_) > EPS_FOV);
        if (fovyCambio) {
          try {
            if (typeof map.setVerticalFieldOfView === 'function') {
              map.setVerticalFieldOfView(fovy);
            }
          } catch (e) { /* MapLibre se queda con su FOV */ }
          this.fovyPrevio_ = fovy;
        }

        const posicion = camara.position;
        const previa = this.camaraPrevia_;
        const cambiaCamara = !previa || fovyCambio
          || Math.abs(posicion.x - previa.x) >= EPS_POSICION
          || Math.abs(posicion.y - previa.y) >= EPS_POSICION
          || Math.abs(posicion.z - previa.z) >= EPS_POSICION
          || Math.abs(camara.heading - previa.heading) >= EPS_ANGULO
          || Math.abs(camara.pitch - previa.pitch) >= EPS_ANGULO
          || Math.abs(camara.roll - previa.roll) >= EPS_ANGULO;

        // Si la última sincronización no encontró suelo se reintenta unos
        // frames aunque la cámara ya no se mueva: el terreno puede estar
        // cargando y, sin esto, el overlay se queda con el zoom anterior.
        const pendienteSuelo = this.sinSuelo_ === true
          && (this.reintentosSuelo_ || 0) < REINTENTOS_SUELO;
        if (!forzar && !cambiaCamara && !pendienteSuelo) return;

        this.camaraPrevia_ = {
          x: posicion.x,
          y: posicion.y,
          z: posicion.z,
          heading: camara.heading,
          pitch: camara.pitch,
          roll: camara.roll
        };
        this.reintentosSuelo_ = cambiaCamara ? 0 : (this.reintentosSuelo_ || 0) + 1;

        const vista = this.vistaDesdeCamara_(viewer, ancho, alto);
        if (!this.sinSuelo_) this.reintentosSuelo_ = 0;
        if (!vista
          || !Number.isFinite(vista.lon)
          || !Number.isFinite(vista.lat)
          || !Number.isFinite(vista.zoom)) return;

        const ultima = this.ultimaVista_;
        if (!forzar && ultima
          && Math.abs(vista.lon - ultima.lon) < 1e-9
          && Math.abs(vista.lat - ultima.lat) < 1e-9
          && Math.abs(vista.zoom - ultima.zoom) < 1e-4
          && Math.abs(vista.rumbo - ultima.rumbo) < EPS_GRADOS
          && Math.abs(vista.inclinacion - ultima.inclinacion) < EPS_GRADOS) {
          return;
        }
        this.ultimaVista_ = vista;

        map.jumpTo({
          center: [vista.lon, vista.lat],
          zoom: vista.zoom,
          bearing: vista.rumbo,
          pitch: vista.inclinacion
        });
        this.pintarSincrono_ = true;
      }

      /**
       * Fuerza a MapLibre a pintar en el acto, dentro del `preRender` de Cesium.
       *
       * MapLibre repinta en su propio `requestAnimationFrame`, que llega después
       * de este `preRender`, así que sin forzarlo el canvas —y con él la textura
       * del drape— va un frame por detrás de la cámara. Medido con la cámara
       * desplazándose 4 px por frame: el contenido iba 4,5 px retrasado; con el
       * pintado síncrono, 0. Se usa `redraw()` porque además **aborta** el
       * repintado ya programado: con `_render()` a secas MapLibre pintaba dos
       * veces por frame (medido 1,9 renders/frame) y el mapa bajaba de 19 a 14
       * fps. Con `try/catch`: si falla queda el repintado asíncrono de siempre.
       */
      pintarMapaLibre_() {
        if (!this.pintarSincrono_) return;
        this.pintarSincrono_ = false;
        const map = this.mapLibre_;
        if (!map) return;
        try {
          if (typeof map.redraw === 'function') map.redraw();
          else if (typeof map._render === 'function') map._render(performance.now());
        } catch (e) { /* se queda el pintado asíncrono */ }
      }

      // ── Drape sobre el MDT ───────────────────────────────────────────────

      /**
       * ¿Se drapea el overlay sobre el terreno? Se apaga con
       * `vendorOptions.mapLibreOptions.drape: false`.
       * @returns {boolean}
       */
      drapeHabilitado_() {
        const vendor = (this.vendorOptions_ && this.vendorOptions_.mapLibreOptions) || {};
        return vendor.drape !== false;
      }

      /**
       * Monta el drape: una textura con el canvas de MapLibre y un
       * `PostProcessStage` que la pinta sobre el terreno visible.
       *
       * Se hace en el primer frame con tamaño, no al crear el mapa. Si la escena
       * no lo permite (WebGL1 sin `depthTexture`, sin `PostProcessStage`, sin
       * `Matrix4`...) se marca el error y se queda el overlay plano de siempre.
       *
       * @returns {boolean} `true` si el drape queda montado.
       */
      crearDrape_() {
        if (this.drape_) return true;
        if (!this.drapeHabilitado_() || this.drapeError_) return false;

        const Cesium = window.Cesium;
        const escena = this.viewer_ && this.viewer_.scene;
        if (!Cesium || !Cesium.PostProcessStage || !Cesium.Texture || !Cesium.Matrix4
          || !escena || !escena.postProcessStages || !escena.context
          || !escena.context.depthTexture || !this.mapLibre_) {
          this.drapeError_ = true;
          return false;
        }

        const lienzo = this.mapLibre_.getCanvas();
        const ancho = lienzo && lienzo.width;
        const alto = lienzo && lienzo.height;
        if (!ancho || !alto) return false;   // aún sin tamaño: se reintenta

        try {
          const textura = this.crearTexturaDrape_(escena, ancho, alto);
          const nula = this.crearTexturaNulaDrape_(escena);
          const matriz = new Cesium.Matrix4();
          // Referencia de proyección (ver `referenciaDrape_`): se reutilizan los
          // objetos y se reescriben en cada frame, así Cesium sube siempre el
          // valor vigente sin crear basura.
          const ref = {
            origen: new Cesium.Cartesian3(),
            derecha: new Cesium.Cartesian3(),
            arriba: new Cesium.Cartesian3(),
            atras: new Cesium.Cartesian3(),
            desdeOrigen: new Cesium.Cartesian3(),
            este: new Cesium.Cartesian3(),
            norte: new Cesium.Cartesian3(),
            mercCentro: new Cesium.Cartesian2(),
            escala: new Cesium.Cartesian2(),
            clipCentro: new Cesium.Cartesian4(),
            // Conmutador y mercator X del centro para el camino exacto.
            mercCentroX: 0,
            global: 0
          };
          const capa = this;
          const stage = escena.postProcessStages.add(new Cesium.PostProcessStage({
            name: 'maplibreDrape',
            fragmentShader: SHADER_DRAPE,
            uniforms: {
              u_overlay: () => (capa.drape_ && capa.drape_.textura) || nula,
              // La copia de profundidad del globo no existe en los primeros
              // frames: se devuelve la textura nula y el shader no pinta.
              u_globeDepth: () => {
                const profundidad = escena.context.uniformState.globeDepthTexture;
                if (profundidad) capa.drapeListo_ = true;
                return profundidad || nula;
              },
              u_mapMatrix: () => matriz,
              u_opacity: () => capa.opacidad_(),
              u_derecha: () => ref.derecha,
              u_arriba: () => ref.arriba,
              u_atras: () => ref.atras,
              u_desdeOrigen: () => ref.desdeOrigen,
              u_este: () => ref.este,
              u_norte: () => ref.norte,
              u_escala: () => ref.escala,
              u_clipCentro: () => ref.clipCentro,
              u_origen: () => ref.origen,
              u_mercCentroX: () => ref.mercCentroX,
              u_global: () => ref.global
            }
          }));

          this.drape_ = {
            textura: textura,
            nula: nula,
            matriz: matriz,
            ref: ref,
            stage: stage,
            ancho: ancho,
            alto: alto
          };
          this.drapeSucia_ = true;
          return true;
        } catch (e) {
          this.drapeError_ = true;
          this.drape_ = null;
          if (this.overlay_) this.overlay_.style.visibility = '';
          console.warn('maplibreLayer: no se pudo montar el drape sobre el MDT', e);
          return false;
        }
      }

      /**
       * Textura de Cesium del tamaño del canvas de MapLibre.
       * @param {Object} escena La escena de Cesium.
       * @param {number} ancho Ancho en píxeles del drawing buffer.
       * @param {number} alto Alto en píxeles del drawing buffer.
       * @returns {Object} `Cesium.Texture`.
       */
      crearTexturaDrape_(escena, ancho, alto) {
        const Cesium = window.Cesium;
        const opciones = {
          context: escena.context,
          width: ancho,
          height: alto,
          pixelFormat: Cesium.PixelFormat.RGBA,
          pixelDatatype: Cesium.PixelDatatype.UNSIGNED_BYTE
        };
        if (Cesium.Sampler && Cesium.TextureMinificationFilter && Cesium.TextureMagnificationFilter) {
          opciones.sampler = new Cesium.Sampler({
            minificationFilter: Cesium.TextureMinificationFilter.LINEAR,
            magnificationFilter: Cesium.TextureMagnificationFilter.LINEAR
          });
        }
        return new Cesium.Texture(opciones);
      }

      /**
       * Textura 1×1 a cero para el uniform de profundidad mientras la escena no
       * ha hecho la copia de profundidad del globo (los primeros frames). El
       * shader la lee como 0 y no pinta nada, que es lo correcto.
       * @param {Object} escena La escena de Cesium.
       * @returns {Object} `Cesium.Texture`.
       */
      crearTexturaNulaDrape_(escena) {
        const Cesium = window.Cesium;
        const opciones = {
          context: escena.context,
          width: 1,
          height: 1,
          pixelFormat: Cesium.PixelFormat.RGBA,
          pixelDatatype: Cesium.PixelDatatype.UNSIGNED_BYTE
        };
        try {
          return new Cesium.Texture(Object.assign({}, opciones, {
            source: { width: 1, height: 1, arrayBufferView: new Uint8Array(4) }
          }));
        } catch (e) {
          return new Cesium.Texture(opciones);
        }
      }

      /**
       * Quita el stage y la textura del drape y devuelve el div a la vista.
       */
      destruirDrape_() {
        const drape = this.drape_;
        this.drape_ = null;
        this.drapeListo_ = false;
        if (drape) {
          try {
            if (drape.stage && this.viewer_ && this.viewer_.scene) {
              this.viewer_.scene.postProcessStages.remove(drape.stage);
            }
          } catch (e) { /* defensivo */ }
          try {
            if (drape.textura) drape.textura.destroy();
          } catch (e) { /* defensivo */ }
          try {
            if (drape.nula) drape.nula.destroy();
          } catch (e) { /* defensivo */ }
        }
        if (this.overlay_) this.overlay_.style.visibility = '';
      }

      /**
       * Opacidad normalizada a [0, 1] (la base de Cesium la pasa a veces como
       * cadena, y al principio puede no estar definida).
       * @returns {number}
       */
      opacidad_() {
        const valor = typeof this.opacity_ === 'string' ? Number(this.opacity_) : this.opacity_;
        if (!Number.isFinite(valor)) return 1;
        return Math.max(0, Math.min(1, valor));
      }

      /**
       * Intenta montar el drape fuera del render (con reintentos mientras el
       * canvas de MapLibre no tenga tamaño).
       */
      programarDrape_() {
        const intentar = (intentos) => {
          this.temporizadorDrape_ = null;
          if (this.drape_ || this.drapeError_ || !this.overlay_) return;
          if (this.crearDrape_()) return;
          if (intentos < 60 && this.overlay_) {
            this.temporizadorDrape_ = setTimeout(() => intentar(intentos + 1), 100);
          }
        };
        if (this.temporizadorDrape_) clearTimeout(this.temporizadorDrape_);
        this.temporizadorDrape_ = setTimeout(() => intentar(0), 0);
      }

      /**
       * Mantiene el drape al día: tamaño de la textura, matriz de MapLibre y
       * subida del canvas cuando MapLibre ha vuelto a pintar.
       */
      actualizarDrape_() {
        const drape = this.drape_;
        if (!drape) return;
        // El drape solo vale si el canvas de MapLibre puede cubrir la escala
        // que pide la cámara. Cuando el zoom necesario pasa del máximo de
        // MapLibre (vistas a pie de calle) la correspondencia se rompe y es
        // mejor dejar el overlay plano, que al menos se ve coherente.
        const utilizable = this.drapeUtilizable_();
        drape.stage.enabled = this.visibility !== false && utilizable;
        if (!utilizable && this.overlay_ && this.overlay_.style.visibility === 'hidden') {
          this.overlay_.style.visibility = '';
        }
        if (!drape.stage.enabled) return;

        // El div se oculta solo cuando el drape ya ha pintado con profundidad
        // real; antes (primeros frames) aún no hay copia de profundidad y el
        // drape no pinta, así que se deja el overlay plano a la vista.
        if (this.drapeListo_ && this.overlay_ && this.overlay_.style.visibility !== 'hidden') {
          this.overlay_.style.visibility = 'hidden';
        }

        const map = this.mapLibre_;
        if (!map) return;
        const lienzo = map.getCanvas();
        if (!lienzo || !lienzo.width || !lienzo.height) return;

        // Ventana redimensionada: la textura tiene que seguir al canvas.
        if (lienzo.width !== drape.ancho || lienzo.height !== drape.alto) {
          try {
            drape.textura.destroy();
          } catch (e) { /* defensivo */ }
          try {
            drape.textura = this.crearTexturaDrape_(this.viewer_.scene, lienzo.width, lienzo.height);
            drape.ancho = lienzo.width;
            drape.alto = lienzo.height;
            this.drapeSucia_ = true;
          } catch (e) {
            this.drapeError_ = true;
            this.destruirDrape_();
            return;
          }
        }

        // Matriz de MapLibre (mercator normalizado -> clip). Es la que usa para
        // pintar, así que la correspondencia es exacta.
        const transform = map.transform;
        const matriz = transform && transform.mercatorMatrix;
        if (matriz && matriz.length >= 16) this.copiarMatrizDrape_(matriz, drape.matriz);
        this.referenciaDrape_(drape, matriz);

        if (this.drapeSucia_) {
          try {
            drape.textura.copyFrom({ source: lienzo });
            this.drapeSucia_ = false;
          } catch (e) { /* se reintenta en el siguiente frame */ }
        }
      }

      /**
       * Calcula el paso de ECEF a mercator en el entorno del centro de la vista.
       *
       * El shader no puede hacerlo: con `atan`/`tan`/`log` (la fórmula exacta)
       * los drivers se desvían ~1e-6 en mercator, que son unos 40 m en el
       * terreno, y el drape se va de sitio (medido: el píxel central caía 39 m
       * al este y 63 m al norte de su sitio). Como Web Mercator es conforme,
       * alrededor del centro vale la linealización: metros al este y al norte,
       * multiplicados por el paso de mercator en ese punto:
       *
       *   mercX = mercX₀ + este  / (2π·N·cos φ)
       *   mercY = mercY₀ − norte / (2π·M·cos φ)
       *
       * con `N` y `M` los radios de curvatura del elipsoide (el este recorre un
       * paralelo y el norte un meridiano). El error es de segundo orden: unos
       * 6 m a 10 km del centro y centímetros en las vistas normales.
       *
       * Todo se calcula en JavaScript, en doble precisión, y se reescribe en los
       * objetos de `drape.ref`, que son los que leen los uniforms.
       * @param {Object} drape Estado del drape.
       * @param {Float64Array} [matriz] `mercatorMatrix` de MapLibre, para el clip
       *   del centro.
       */
      referenciaDrape_(drape, matriz) {
        const vista = this.ultimaVista_;
        if (!drape || !drape.ref || !vista
          || !Number.isFinite(vista.lon) || !Number.isFinite(vista.lat)) {
          return;
        }
        const RAD = Math.PI / 180;
        const lon = vista.lon * RAD;
        const lat = vista.lat * RAD;
        const senLat = Math.sin(lat);
        const cosLat = Math.cos(lat);
        const senLon = Math.sin(lon);
        const cosLon = Math.cos(lon);

        // Radios de curvatura (WGS84) y altura del elipsoide en el centro.
        const A = 6378137;
        const E2 = 0.00669437999014;
        const w = 1 - E2 * senLat * senLat;
        const raiz = Math.sqrt(w);
        const N = A / raiz;                        // radio del primer vertical
        const M = A * (1 - E2) / (w * raiz);       // radio meridiano

        const ref = drape.ref;
        ref.origen.x = N * cosLat * cosLon;
        ref.origen.y = N * cosLat * senLon;
        ref.origen.z = N * (1 - E2) * senLat;

        // Ejes de la cámara en ECEF (columnas 0-2 de `inverseViewMatrix`, en
        // doble precisión) y vector cámara - origen. El shader los usa en vez de
        // la traslación de `czm_inverseView`, que va en float32 y arrastra
        // ~0,5 m de error sobre coordenadas de 6,4e6 m: medido, eso dejaba el
        // drape 2 px desplazado a zoom 18 y el filtrado LINEAR lo difuminaba.
        const camara = this.viewer_ && this.viewer_.scene && this.viewer_.scene.camera;
        const inv = camara && camara.inverseViewMatrix;
        if (inv) {
          ref.derecha.x = inv[0];
          ref.derecha.y = inv[1];
          ref.derecha.z = inv[2];
          ref.arriba.x = inv[4];
          ref.arriba.y = inv[5];
          ref.arriba.z = inv[6];
          ref.atras.x = inv[8];
          ref.atras.y = inv[9];
          ref.atras.z = inv[10];
          const pos = camara.positionWC;
          ref.desdeOrigen.x = pos.x - ref.origen.x;
          ref.desdeOrigen.y = pos.y - ref.origen.y;
          ref.desdeOrigen.z = pos.z - ref.origen.z;
        }

        // Base este/norte (geodésica) del centro, en ECEF.
        ref.este.x = -senLon;
        ref.este.y = cosLon;
        ref.este.z = 0;
        ref.norte.x = -senLat * cosLon;
        ref.norte.y = -senLat * senLon;
        ref.norte.z = cosLat;
        // Mercator del centro y paso de metros de terreno a mercator.
        ref.mercCentro.x = (lon + Math.PI) / (2 * Math.PI);
        ref.mercCentro.y = 0.5 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / (2 * Math.PI);
        ref.escala.x = 1 / (2 * Math.PI * N * cosLat);
        ref.escala.y = -1 / (2 * Math.PI * M * cosLat);

        // Conmutador del camino exacto del shader (ver `ZOOM_DRAPE_EXACTO`).
        ref.mercCentroX = ref.mercCentro.x;
        ref.global = Number.isFinite(vista.zoom) && vista.zoom < ZOOM_DRAPE_EXACTO ? 1 : 0;

        // Clip del centro: matriz de MapLibre por (mercCentro, 0, 1), en doble.
        // El shader le suma la parte lineal aplicada al mercator RELATIVO, así la
        // mercator absoluta (ULP de 3e-8 en float32) no llega a la GPU y el UV no
        // se cuantiza a bloques de 4 px.
        if (matriz && matriz.length >= 16) {
          const cx = ref.mercCentro.x;
          const cy = ref.mercCentro.y;
          ref.clipCentro.x = matriz[0] * cx + matriz[4] * cy + matriz[12];
          ref.clipCentro.y = matriz[1] * cx + matriz[5] * cy + matriz[13];
          ref.clipCentro.z = matriz[2] * cx + matriz[6] * cy + matriz[14];
          ref.clipCentro.w = matriz[3] * cx + matriz[7] * cy + matriz[15];
        }
      }

      /**
       * Indica si el drape es utilizable con la vista actual.
       *
       * - Si el zoom que pide la cámara pasa del máximo de MapLibre, el canvas
       *   se queda corto y la correspondencia se rompe (vistas a pie de calle).
       * - Casi al horizonte la proyección 2D de MapLibre no puede seguir la
       *   perspectiva del globo y el contenido se estira en exceso.
       *
       * En ambos casos se deja el overlay plano, que se ve coherente.
       * @returns {boolean}
       */
      drapeUtilizable_() {
        const map = this.mapLibre_;
        const ultima = this.ultimaVista_;
        if (!map || !ultima) return true;
        const maxZoom = typeof map.getMaxZoom === 'function' ? map.getMaxZoom() : null;
        if (Number.isFinite(maxZoom) && Number.isFinite(ultima.zoom)
          && ultima.zoom > maxZoom + 0.01) {
          return false;
        }
        if (Number.isFinite(ultima.inclinacion) && ultima.inclinacion > MAX_INCLINACION_DRAPE) {
          return false;
        }
        return true;
      }

      /**
       * Copia la matriz de MapLibre (column-major) a la de Cesium.
       * @param {Float64Array} origen Matriz de 16 valores de `map.transform`.
       * @param {Object} destino `Cesium.Matrix4` del uniform.
       */
      copiarMatrizDrape_(origen, destino) {
        const Matrix4 = window.Cesium.Matrix4;
        try {
          if (typeof Matrix4.fromColumnMajorArray === 'function') {
            Matrix4.fromColumnMajorArray(origen, destino);
          } else {
            Matrix4.fromArray(origen, 0, destino);
          }
        } catch (e) { /* se queda la matriz del frame anterior */ }
      }

      /**
       * Baja el zoom de MapLibre cuando su canvas no llega a cubrir el mercator
       * que abarca la pantalla.
       *
       * El zoom sale de la escala en el centro, que es lo que da nitidez, pero el
       * canvas solo contiene `alto / (512 · 2^zoom)` de mercator en vertical: al
       * ver el globo entero la pantalla abarca más y las latitudes altas se
       * quedaban sin textura (medido a 20.000 km: el drape llegaba hasta lat 73° y
       * el casquete polar se veía sin capa, que era el "recorte" del globo).
       *
       * Se baja el zoom lo justo y nunca más de `MAX_NIVELES_COBERTURA`. La
       * correspondencia no cambia —la UV sale de la matriz de MapLibre, que es la
       * que ha pintado el canvas—, solo se pierde resolución, y solo en las vistas
       * en las que el canvas no llegaba.
       * @param {Object} viewer El `Cesium.Viewer`.
       * @param {number} zoom Zoom pedido por la escala del centro.
       * @param {number} ancho Ancho del canvas en píxeles.
       * @param {number} alto Alto del canvas en píxeles.
       * @returns {number} Zoom corregido.
       */
      zoomConCobertura_(viewer, zoom, ancho, alto) {
        if (!(zoom < ZOOM_DRAPE_EXACTO) || !(alto > 0)) return zoom;
        const Cesium = window.Cesium;
        const escena = viewer && viewer.scene;
        const camara = viewer && viewer.camera;
        const elipsoide = escena && escena.globe && escena.globe.ellipsoid;
        if (!Cesium || !camara || !elipsoide || !Cesium.IntersectionTests) return zoom;

        // Latitud del punto del elipsoide bajo un píxel del canvas. Sin corte
        // (cielo o globo entero) devuelve null.
        const latBorde = (px, py) => {
          try {
            const rayo = camara.getPickRay(new Cesium.Cartesian2(px, py));
            const corte = rayo && Cesium.IntersectionTests.rayEllipsoid(rayo, elipsoide);
            if (!corte) return null;
            const t = corte.start > 0 ? corte.start : corte.stop;
            if (!(t > 0)) return null;
            const punto = Cesium.Ray.getPoint(rayo, t);
            return Cesium.Math.toDegrees(Cesium.Cartographic.fromCartesian(punto).latitude);
          } catch (e) {
            return null;
          }
        };
        // Las esquinas están más lejos del centro de la pantalla que los bordes,
        // así que son las que piden más latitud; se miran también los centros de
        // los bordes por si el horizonte está arriba.
        const muestras = [
          [0, 0], [ancho, 0], [0, alto], [ancho, alto],
          [ancho / 2, 0], [ancho / 2, alto]
        ];
        let arriba = -90;
        let abajo = 90;
        let conGlobo = 0;
        for (let i = 0; i < muestras.length; i++) {
          const lat = latBorde(muestras[i][0], muestras[i][1]);
          if (!Number.isFinite(lat)) continue;
          conGlobo++;
          if (lat > arriba) arriba = lat;
          if (lat < abajo) abajo = lat;
        }
        // Algún borde es cielo: el limbo del globo está dentro de la pantalla, así
        // que se pide el mundo entero (es cuando más se nota el recorte).
        if (conGlobo < muestras.length) {
          arriba = MAX_LAT_MERCATOR;
          abajo = -MAX_LAT_MERCATOR;
        }
        if (!(arriba > abajo) || arriba === -90) return zoom;

        // Mercator visible (fórmula exacta) y mercator que cubre el canvas al zoom
        // pedido (píxeles por mundo = 512 · 2^zoom, la misma cuenta de MapLibre).
        const RAD = Math.PI / 180;
        const mercY = (lat) => 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / (2 * Math.PI);
        const necesario = mercY(abajo) - mercY(arriba);
        const cubierto = alto / (512 * Math.pow(2, zoom));
        if (!(necesario > 0) || !(cubierto > 0) || necesario <= cubierto) return zoom;

        const bajada = Math.min(Math.log2(necesario / cubierto), MAX_NIVELES_COBERTURA);
        return zoom - bajada;
      }

      /**
       * Traduce la cámara de Cesium a los parámetros de `jumpTo`.
       * @param {Object} viewer El `Cesium.Viewer`.
       * @param {number} ancho Ancho del canvas en píxeles CSS.
       * @param {number} alto Alto del canvas en píxeles CSS.
       * @returns {Object|null} `{lon, lat, zoom, rumbo, inclinacion}` o null.
       */
      vistaDesdeCamara_(viewer, ancho, alto) {
        const Cesium = window.Cesium;
        if (!Cesium) return null;

        const escena = viewer.scene;
        const camara = viewer.camera;
        const centro = this.puntoSuelo_(escena, camara, ancho / 2, alto / 2);
        // Se anota si el rayo central dio terreno de verdad: `sincronizar_`
        // reintenta mientras siga sin haberlo (ver `REINTENTOS_SUELO`). El
        // corte con el elipsoide no cuenta: sin teselas cae demasiado lejos.
        this.sinSuelo_ = !centro || this.sueloEsTerreno_ === false;

        let lon = null;
        let lat = null;
        let zoom = null;
        if (centro) {
          const c0 = Cesium.Cartographic.fromCartesian(centro);
          lon = Cesium.Math.toDegrees(c0.longitude);
          lat = Cesium.Math.toDegrees(c0.latitude);
          zoom = this.zoomDesdeEscala_(escena, camara, centro, ancho, alto);
          zoom = this.zoomConCobertura_(viewer, zoom, ancho, alto);
        }

        // Mirando al horizonte o al cielo el rayo central puede no tocar el
        // globo. En vez de congelar el overlay se conserva el último centro
        // válido y se siguen actualizando rumbo e inclinación.
        const ultima = this.ultimaVista_;
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
          if (ultima && Number.isFinite(ultima.lon) && Number.isFinite(ultima.lat)) {
            lon = ultima.lon;
            lat = ultima.lat;
          } else {
            const posicion = camara.positionCartographic
              || Cesium.Cartographic.fromCartesian(camara.position);
            lon = Cesium.Math.toDegrees(posicion.longitude);
            lat = Cesium.Math.toDegrees(posicion.latitude);
          }
        }
        if (!Number.isFinite(zoom)) {
          zoom = ultima && Number.isFinite(ultima.zoom) ? ultima.zoom : 2;
        }

        const pitchCes = Cesium.Math.toDegrees(camara.pitch);
        const inclinacion = Number.isFinite(pitchCes)
          ? Math.max(0, Math.min(this.maxPitch_(), pitchCes + 90))
          : 0;

        return {
          lon: lon,
          lat: lat,
          zoom: zoom,
          rumbo: this.rumboDesdeCamara_(camara, centro, escena.globe.ellipsoid),
          inclinacion: inclinacion
        };
      }

      /**
       * Zoom de MapLibre a partir de la escala en el centro de la pantalla.
       * Se usa el campo de vista vertical del frustum de Cesium; si no está
       * disponible, se mide con dos rayos al elipsoide.
       * @param {Object} escena La escena de Cesium.
       * @param {Object} camara La cámara de Cesium.
       * @param {Object} centro Punto (terreno o elipsoide) bajo el centro.
       * @param {number} ancho Ancho del canvas en píxeles CSS.
       * @param {number} alto Alto del canvas en píxeles CSS.
       * @returns {number|null} Zoom de MapLibre o null.
       */
      zoomDesdeEscala_(escena, camara, centro, ancho, alto) {
        const Cesium = window.Cesium;
        if (!Cesium) return null;

        const fovy = this.campoVistaVerticalRad_(camara);
        let metrosPorPixel = null;

        if (fovy > 0) {
          const distancia = Cesium.Cartesian3.distance(camara.position, centro);
          if (distancia > 0) {
            metrosPorPixel = 2 * distancia * Math.tan(fovy / 2) / alto;
          }
        }

        if (!(metrosPorPixel > 0)) {
          const k = Math.max(20, Math.min(PIXELES_MEDIDA, Math.floor(Math.min(ancho, alto) / 4)));
          const derecha = this.puntoElipsoide_(escena, camara, ancho / 2 + k, alto / 2);
          if (derecha) {
            const c0 = Cesium.Cartographic.fromCartesian(centro);
            const c1 = Cesium.Cartographic.fromCartesian(derecha);
            const distancia = new Cesium.EllipsoidGeodesic(c0, c1).surfaceDistance;
            if (distancia > 0) metrosPorPixel = distancia / k;
          }
        }

        if (!(metrosPorPixel > 0)) return null;
        const c0 = Cesium.Cartographic.fromCartesian(centro);
        const lat = Cesium.Math.toDegrees(c0.latitude);
        return Math.log2(
          METROS_POR_PIXEL_ZOOM_0 * Math.cos(lat * Math.PI / 180) / metrosPorPixel
        );
      }

      /**
       * Campo de vista vertical del frustum de Cesium, en radianes.
       * @param {Object} camara La cámara de Cesium.
       * @returns {number|null}
       */
      campoVistaVerticalRad_(camara) {
        const frustum = camara && camara.frustum;
        if (!frustum) return null;
        let fovy = frustum.fovy;
        if (!(fovy > 0) && frustum.fov > 0 && frustum.aspectRatio > 0) {
          fovy = 2 * Math.atan(Math.tan(frustum.fov / 2) / frustum.aspectRatio);
        }
        return fovy > 0 ? fovy : null;
      }

      /**
       * Campo de vista vertical en grados (el que espera MapLibre).
       * @param {Object} camara La cámara de Cesium.
       * @returns {number|null}
       */
      campoVistaVertical_(camara) {
        const Cesium = window.Cesium;
        const fovy = this.campoVistaVerticalRad_(camara);
        return fovy > 0 && Cesium ? Cesium.Math.toDegrees(fovy) : null;
      }

      /**
       * Rumbo (bearing) a partir de la dirección de la parte superior de la
       * pantalla (`camera.up`) proyectada sobre el plano tangente del centro.
       * Incluye el alabeo y no depende de que un rayo auxiliar toque tierra.
       * @param {Object} camara La cámara de Cesium.
       * @param {Object|null} centro Punto bajo el centro de la pantalla.
       * @param {Object} elipsoide Elipsoide del globo.
       * @returns {number} Grados entre 0 y 360.
       */
      rumboDesdeCamara_(camara, centro, elipsoide) {
        const Cesium = window.Cesium;
        const heading = Cesium.Math.toDegrees(camara.heading);
        if (!centro) return this.normalizarRumbo_(heading);

        const normal = elipsoide.geodeticSurfaceNormal(centro);
        const arriba = camara.up;
        const proyeccion = Cesium.Cartesian3.subtract(
          arriba,
          Cesium.Cartesian3.multiplyByScalar(
            normal,
            Cesium.Cartesian3.dot(arriba, normal),
            new Cesium.Cartesian3()
          ),
          new Cesium.Cartesian3()
        );
        if (!(Cesium.Cartesian3.magnitude(proyeccion) > 1e-12)) {
          return this.normalizarRumbo_(heading);
        }

        const c0 = Cesium.Cartographic.fromCartesian(centro);
        const lon = c0.longitude;
        const lat = c0.latitude;
        const este = new Cesium.Cartesian3(-Math.sin(lon), Math.cos(lon), 0);
        const norte = new Cesium.Cartesian3(
          -Math.sin(lat) * Math.cos(lon),
          -Math.sin(lat) * Math.sin(lon),
          Math.cos(lat)
        );
        const angulo = Math.atan2(
          Cesium.Cartesian3.dot(proyeccion, este),
          Cesium.Cartesian3.dot(proyeccion, norte)
        );
        return this.normalizarRumbo_(Cesium.Math.toDegrees(angulo));
      }

      /**
       * @param {number} grados Rumbo en grados.
       * @returns {number} Rumbo normalizado a [0, 360).
       */
      normalizarRumbo_(grados) {
        if (!Number.isFinite(grados)) return 0;
        const rumbo = grados % 360;
        return rumbo < 0 ? rumbo + 360 : rumbo;
      }

      /**
       * Tope de inclinación de MapLibre (85 por defecto, o el que fije la capa).
       * @returns {number}
       */
      maxPitch_() {
        const max = this.mapLibre_ && typeof this.mapLibre_.getMaxPitch === 'function'
          ? this.mapLibre_.getMaxPitch()
          : MAX_PITCH_MAPLIBRE;
        return Math.max(0, Math.min(MAX_PITCH_MAPLIBRE, max));
      }

      /**
       * Punto del terreno (o del elipsoide) bajo un píxel.
       * @param {Object} escena La escena de Cesium.
       * @param {Object} camara La cámara de Cesium.
       * @param {number} x Píxel horizontal.
       * @param {number} y Píxel vertical.
       * @returns {Object|null} `Cesium.Cartesian3` o null si el rayo no toca.
       */
      puntoSuelo_(escena, camara, x, y) {
        const Cesium = window.Cesium;
        const ventana = new Cesium.Cartesian2(x, y);
        let punto = null;
        try {
          punto = escena.globe.pick(camara.getPickRay(ventana), escena);
        } catch (e) {
          punto = null;
        }
        if (this.puntoVisible_(camara, punto) && this.terrenoEnRango_(camara, punto)) {
          this.sueloEsTerreno_ = true;
          return punto;
        }
        // Sin teselas del terreno el rayo solo corta el elipsoide, que a poca
        // altura y con inclinación cae mucho más lejos que el suelo real. Se
        // usa como respaldo, pero se anota para reintentar cuando el terreno
        // esté cargado (si no, el zoom se queda congelado en ese valor).
        this.sueloEsTerreno_ = false;
        try {
          punto = camara.pickEllipsoid(ventana, escena.globe.ellipsoid);
        } catch (e) {
          punto = null;
        }
        return this.puntoVisible_(camara, punto) ? punto : null;
      }

      /**
       * Descarta lecturas de terreno más lejanas que el corte con el elipsoide:
       * mirando al suelo el rayo no puede ir más allá, así que un punto más
       * lejano es una lectura mala (la cara opuesta, o el elipsoide cuando aún
       * no hay teselas) y dejaba el zoom congelado en un valor absurdo. Se mide
       * con el pitch de la cámara porque `puntoSuelo_` solo se usa en el centro
       * de la pantalla, donde el rayo va en la dirección de la vista.
       * @param {Object} camara La cámara de Cesium.
       * @param {Object} punto `Cesium.Cartesian3` candidato.
       * @returns {boolean}
       */
      terrenoEnRango_(camara, punto) {
        if (!punto) return false;
        const altura = camara.positionCartographic
          ? camara.positionCartographic.height
          : 0;
        const seno = Math.abs(Math.sin(camara.pitch || 0));
        if (!(altura > 0) || seno < 1e-4) return true;
        const distancia = window.Cesium.Cartesian3.distance(camara.position, punto);
        return distancia <= (altura / seno) * 1.15 + 1000;
      }

      /**
       * Descarta intersecciones que no sirven para centrar el overlay: detrás
       * de la cámara o en la cara opuesta del elipsoide (cuando el rayo pasa
       * por encima del horizonte, `pickEllipsoid` puede devolver un punto a
       * miles de kilómetros).
       * @param {Object} camara La cámara de Cesium.
       * @param {Object|null} punto `Cesium.Cartesian3` candidato.
       * @returns {boolean}
       */
      puntoVisible_(camara, punto) {
        if (!punto) return false;
        const Cesium = window.Cesium;
        const posicion = camara.position;
        const dx = punto.x - posicion.x;
        const dy = punto.y - posicion.y;
        const dz = punto.z - posicion.z;
        const distancia = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (!(distancia > 0)) return false;

        const delante = dx * camara.direction.x
          + dy * camara.direction.y
          + dz * camara.direction.z;
        if (delante <= 0) return false;

        const altura = camara.positionCartographic
          ? camara.positionCartographic.height
          : 0;
        const horizonte = Math.sqrt(
          Math.max(0, 2 * 6378137 * Math.max(0, altura) + altura * altura)
        );
        return distancia <= Math.max(100000, horizonte * 2 + 50000);
      }

      /**
       * Punto del elipsoide bajo un píxel (sin consultar el terreno). Se usa
       * como reserva para medir la escala cuando el frustum no da el FOV.
       * @param {Object} escena La escena de Cesium.
       * @param {Object} camara La cámara de Cesium.
       * @param {number} x Píxel horizontal.
       * @param {number} y Píxel vertical.
       * @returns {Object|null} `Cesium.Cartesian3` o null si el rayo no toca.
       */
      puntoElipsoide_(escena, camara, x, y) {
        const Cesium = window.Cesium;
        const elipsoide = escena.globe && escena.globe.ellipsoid
          ? escena.globe.ellipsoid
          : Cesium.Ellipsoid.WGS84;
        try {
          const punto = camara.pickEllipsoid(new Cesium.Cartesian2(x, y), elipsoide);
          return this.puntoVisible_(camara, punto) ? punto : null;
        } catch (e) {
          return null;
        }
      }

      // ── Visibilidad, opacidad y orden ────────────────────────────────────

      setVisible(visible) {
        const estaba = this.visibility;
        this.visibility = visible;
        if (this.overlay_) this.overlay_.style.display = visible ? 'block' : 'none';
        // Con drape, el div está oculto con `visibility` (para no pintar dos
        // veces) y quien manda es el stage.
        if (this.drape_ && this.drape_.stage) this.drape_.stage.enabled = visible !== false;
        // Al volver a mostrarla hay que ponerse al día: mientras estaba oculta
        // no se ha llamado a `jumpTo`.
        if (visible && !estaba) {
          this.drapeSucia_ = true;
          this.sincronizar_(true);
        }
      }

      isVisible() {
        return this.visibility;
      }

      setOpacity(opacidad) {
        const valor = typeof opacidad === 'string' ? Number(opacidad) : opacidad;
        this.opacity_ = valor;
        // El drape lee la opacidad del uniform en cada frame (`opacidad_`); el
        // canvas se sigue ajustando para el modo plano.
        if (this.mapLibre_) this.mapLibre_.getCanvas().style.opacity = String(valor);
      }

      getOpacity() {
        return this.opacity_;
      }

      // El overlay no está en `imageryLayers`: el orden lo da el DOM (la capa
      // que se añade después queda encima). Se guarda el valor y no se toca nada
      // para que `setZIndex` de la base no intente recolocar una capa que no
      // existe.
      setZIndex(zindex) {
        this.zIndex_ = zindex;
      }

      getZIndex() {
        return this.zIndex_;
      }

      // ── Estilo ───────────────────────────────────────────────────────────

      /**
       * Aplica `disableBackgroundColor` a la capa `background` del estilo, igual
       * que la implementación de OpenLayers: `true` deja el fondo transparente
       * (para pintar sobre el mapa de Cesium) y `false` lo pone opaco (la capa
       * funciona como capa base).
       *
       * Si el estilo no tiene capa `background` no se hace nada. Medido: el estilo
       * de BTN Completa no la tiene (0 capas de fondo de 337), y en 2D eso le
       * revienta a la implementación de OpenLayers, que hace
       * `getStyle().layers.find(l => l.type === 'background').id` sin comprobar el
       * resultado (TypeError: no se puede leer 'id' de undefined, en
       * apiidee-1.1.0.ol.min.js). Aquí se comprueba.
       */
      aplicarFondo_() {
        if (!this.mapLibre_ || this.disableBackgroundColor === undefined) return;
        let capaFondo = null;
        try {
          capaFondo = (this.mapLibre_.getStyle().layers || []).find((l) => l.type === 'background');
        } catch (e) {
          return;
        }
        if (!capaFondo) return;

        const color = this.disableBackgroundColor === true ? 'transparent' : '#f2f2f2';
        try {
          this.mapLibre_.setPaintProperty(capaFondo.id, 'background-color', color);
        } catch (e) { /* el estilo aún no está listo */ }
      }

      setStyleMap(estilo) {
        if (!this.mapLibre_) return;
        try {
          this.mapLibre_.setStyle(estilo);
        } catch (e) {
          console.warn('maplibreLayer: no se pudo aplicar el estilo', e);
        }
      }

      getMapLibreStyleFromId(ids) {
        if (!this.mapLibre_) return [];
        const capas = (this.mapLibre_.getStyle() || {}).layers || [];
        return (ids && ids.length) ? capas.filter((c) => ids.indexOf(c.id) !== -1) : capas;
      }

      setPaintProperty(capa, propiedad, valor) {
        if (!this.mapLibre_) return;
        try { this.mapLibre_.setPaintProperty(capa, propiedad, valor); } catch (e) { /* defensivo */ }
      }

      setLayoutProperty(capa, propiedad, valor) {
        if (!this.mapLibre_) return;
        try { this.mapLibre_.setLayoutProperty(capa, propiedad, valor); } catch (e) { /* defensivo */ }
      }

      // ── Consultas ────────────────────────────────────────────────────────

      getProjection() {
        return this.projection_;
      }

      /**
       * Entidades pintadas ahora mismo. Son entidades de MapLibre, no de la API:
       * la capa no tiene geometrías propias (no hay teselas decodificadas a
       * mano), y `getGeometryType()` devuelve null.
       * @returns {Array}
       */
      getFeatures() {
        if (!this.mapLibre_) return [];
        try { return this.mapLibre_.queryRenderedFeatures(); } catch (e) { return []; }
      }

      getFeatureById(id) {
        return this.getFeatures().filter((f) => f && ((f.properties && f.properties.id === id) || f.id === id));
      }
    };
  }

  /**
   * Estilo serializado (base64) que la API usa en los enlaces compartidos.
   * @param {string} estilo Texto en base64.
   * @returns {Object|null} El estilo, o null si no hay o no se puede leer.
   */
  function leerEstilo(estilo) {
    if (typeof estilo !== 'string' || !estilo) return null;
    try {
      return JSON.parse(decodeURIComponent(escape(window.atob(estilo.replace(' ', '+')))));
    } catch (e) {
      return null;
    }
  }

  /* ------------------------------------------------------------------ *
   * La fachada
   *
   * Sustituye a `IDEE.layer.MapLibre`. Hereda de la MISMA clase base que la
   * fachada del bundle (para no perder nada del contrato de capa) y replica sus
   * miembros públicos, que son los que usan los visualizadores y la propia API.
   * ------------------------------------------------------------------ */

  /**
   * @param {Function} Base Clase base de la fachada del bundle.
   * @param {Function} Impl Implementación creada con `crearImplementacion`.
   * @returns {Function} Clase que se registra como `IDEE.layer.MapLibre`.
   */
  function crearFachada(Base, Impl) {
    class FachadaMapLibre extends Base {
      constructor(parameters, options, vendorOptions) {
        const params = Object.assign({}, parameters || {}, options || {});
        params.type = 'MapLibre';
        if (params.maxExtent) {
          params.maxExtent = undefined;
          console.warn('La propiedad maxExtent no está soportada en las capas MapLibre');
        }

        const impl = new Impl(params, options || {}, vendorOptions || {});
        super(params, impl);
        impl.facade = this;

        this.constructorParameters = { parameters: parameters, options: options, vendorOptions: vendorOptions };
        this.infoEventType = params.infoEventType || 'click';
        this.disableBackgroundColor = options && options.disableBackgroundColor !== undefined
          ? options.disableBackgroundColor
          : undefined;

        // Los setters de la fachada escriben en la implementación.
        this.extract = params.extract === undefined ? true : params.extract;
        this.template = params.template;
        this.maplibrestyle = params.maplibrestyle;

        this.minZoom = (options && options.minZoom) || Number.NEGATIVE_INFINITY;
        this.maxZoom = (options && options.maxZoom) || Number.POSITIVE_INFINITY;
      }

      get extract() {
        return this.getImpl().extract;
      }

      set extract(valor) {
        // Mismo trato que la fachada del bundle: sin valor, `true`; y los textos
        // ('true'/'false') se convierten, porque los parámetros pueden venir de
        // atributos HTML.
        if (valor === undefined) {
          this.getImpl().extract = true;
        } else if (typeof valor === 'string') {
          this.getImpl().extract = valor.trim() === 'true';
        } else {
          this.getImpl().extract = valor;
        }
      }

      get template() {
        return this.getImpl().template;
      }

      set template(valor) {
        this.getImpl().template = valor;
      }

      get maplibrestyle() {
        return this.getImpl().maplibrestyle;
      }

      set maplibrestyle(valor) {
        if (valor === undefined) return;
        this.getImpl().maplibrestyle = valor;
        if (this.getImpl().getLayer && this.getImpl().getLayer()) this.getImpl().setStyleMap(valor);
      }

      get url() {
        return this.getImpl().url;
      }

      set url(valor) {
        if (valor === undefined) return;
        this.getImpl().url = valor;
        if (this.getImpl().getLayer && this.getImpl().getLayer()) this.getImpl().setStyleMap(valor);
      }

      getStyle() {
        return undefined;
      }

      setMaxExtent() { /* no soportado */ }

      setFilter() { /* no soportado */ }

      addFeatures() { /* no soportado */ }

      removeFeatures() { /* no soportado */ }

      refresh() { /* no soportado */ }

      redraw() { /* no soportado */ }

      toGeoJSON() { /* no soportado */ }

      getFeatureById(id) {
        return this.getImpl().getFeatureById(id);
      }

      setMapLibreStyleFromId(lista) {
        if (!Array.isArray(lista)) return;
        lista.forEach(({ id, paint, layout }) => {
          if (paint) paint.forEach(({ property, value }) => this.setPaintProperty(id, property, value));
          if (layout) layout.forEach(({ property, value }) => this.setLayoutProperty(id, property, value));
        });
      }

      getMapLibreStyleFromId(ids) {
        return this.getImpl().getMapLibreStyleFromId(ids || []);
      }

      setPaintProperty(capa, propiedad, valor) {
        this.getImpl().setPaintProperty(capa, propiedad, valor);
      }

      setLayoutProperty(capa, propiedad, valor) {
        this.getImpl().setLayoutProperty(capa, propiedad, valor);
      }

      getProjection() {
        return this.getImpl().getProjection();
      }

      getGeometryType() {
        return null;
      }

      getFeatures() {
        return this.getImpl().getFeatures();
      }

      equals(otra) {
        let igual = false;
        if (otra instanceof FachadaMapLibre) {
          igual = this.url === otra.url;
          igual = igual && this.name === otra.name;
          igual = igual && this.idLayer === otra.idLayer;
          igual = igual && this.template === otra.template;
        }
        return igual;
      }
    }

    return FachadaMapLibre;
  }

  /* ------------------------------------------------------------------ *
   * Instalación
   *
   * Es un parche de arranque, no un plugin: tiene que estar puesto antes de que
   * `mapa()` cree capas (las capas base y las rápidas se resuelven ahí). Se
   * aplica al cargar el script, se reintenta cada 10 ms mientras la build de
   * Cesium no exista y se re-aplica cuando termina de ejecutarse el <script> de
   * la build (el cambio 2D/3D la recarga y `window.IDEE` es un objeto nuevo).
   * ------------------------------------------------------------------ */

  let fachadaInstalada = null;

  /**
   * ¿Es una capa MapLibre de las nuestras? Por tipo (el de la API) o por clase.
   * @param {Object} capa Facade de capa.
   * @returns {boolean}
   */
  function esCapaMapLibre(capa) {
    if (!capa) return false;
    if (fachadaInstalada && capa instanceof fachadaInstalada) return true;
    return capa.type === 'MapLibre';
  }

  /**
   * ¿Casa una capa MapLibre con el filtro que recibe `getUnknowLayers_`?
   *
   * El impl de Cesium devuelve TODAS las capas de tipo desconocido aunque se le
   * pase un filtro, y de ahí cuelga un efecto colateral medido: al cambiar de
   * capa base, `facade.removeLayers(base)` hace `getLayers(base)` y ese listado
   * incluye las MapLibre; la base se lleva por delante la capa de la página.
   * Aquí se replica el filtro de la API (capa, objeto con name/type/legend,
   * idLayer o cadena) para poder descartar las que no casen.
   *
   * @param {Object} capa Capa MapLibre.
   * @param {*} filtro Filtro recibido por `getUnknowLayers_`.
   * @returns {boolean}
   */
  function capaCoincideFiltro(capa, filtro) {
    if (filtro === undefined || filtro === null) return true;
    if (Array.isArray(filtro)) {
      if (!filtro.length) return true;
      return filtro.some((f) => capaCoincideFiltro(capa, f));
    }
    if (typeof filtro === 'string') {
      return capa.name === filtro || capa.idLayer === filtro || capa.legend === filtro;
    }
    if (typeof filtro !== 'object') return true;
    if (filtro === capa) return true;
    if (filtro.idLayer && capa.idLayer === filtro.idLayer) return true;

    let tieneCriterio = false;
    if (filtro.name) {
      tieneCriterio = true;
      if (capa.name !== filtro.name) return false;
    }
    if (filtro.type) {
      tieneCriterio = true;
      if (capa.type !== filtro.type) return false;
    }
    if (filtro.legend) {
      tieneCriterio = true;
      if (capa.legend !== filtro.legend) return false;
    }
    if (tieneCriterio) return true;
    // Solo venía idLayer y no ha casado antes: no es esta capa.
    return !filtro.idLayer;
  }

  /**
   * Parchea la implementación del mapa para que sepa qué hacer con una capa
   * `MapLibre`.
   *
   * Medido: `IDEE.impl.Map.addLayers` mira el tipo y solo tiene rama para WMS,
   * WMTS, KML, WFS, OGCAPIFeatures, MBTiles, XYZ, TMS, Tiles3D y Terrain; para
   * el resto hace `know(tipo) || (addUnknowLayers_ + facadeMap_.addUnknowLayers_)`,
   * y en la lista de `know` del módulo de tipos están MVT y MapLibre... pero sin
   * rama. O sea que una capa `MapLibre` se ignora EN SILENCIO: no se anade, no
   * aparece en `getLayers()` y no dispara el `addTo` de su implementación.
   * (`Vector` no está en `know`, y por eso las capas de ext/MVTLayer sí entran
   * por la vía de las no clasificadas.)
   *
   * Aquí se hace lo mismo que hace el propio impl con las capas que no conoce:
   * `addUnknowLayers_` la mete en `layers_` y llama a `getImpl().addTo()`, y
   * `facadeMap_.addUnknowLayers_` dispara el evento de capa anadida. Lo mismo en
   * la retirada, porque `removeLayers` reparte por tipo y tampoco tiene rama para
   * `MapLibre`: sin esto la capa se quedaría en el mapa.
   *
   * Y como `getUnknowLayers_` filtra por `!know(tipo)`, la capa entraría en
   * `layers_` pero no saldría en `getLayers()` (que arma la lista con los getters
   * por tipo más ese cajón): se parchea también para que la incluya.
   *
   * @param {Function} ImplMap Implementación del mapa de Cesium.
   */
  function parchearMapaImpl(ImplMap) {
    if (!ImplMap || !ImplMap.prototype) return;
    const proto = ImplMap.prototype;
    if (proto.__maplibreLayerParche) return;

    const addLayersOriginal = proto.addLayers;
    const removeLayersOriginal = proto.removeLayers;
    const getUnknowLayersOriginal = proto.getUnknowLayers_;
    if (typeof addLayersOriginal !== 'function' || typeof removeLayersOriginal !== 'function'
      || typeof getUnknowLayersOriginal !== 'function') return;

    proto.addLayers = function (capas) {
      const lista = Array.isArray(capas) ? capas : (capas === undefined ? [] : [capas]);
      const nuestras = lista.filter(esCapaMapLibre);
      const resto = lista.filter((c) => nuestras.indexOf(c) === -1);

      nuestras.forEach((capa) => {
        try {
          this.addUnknowLayers_([capa]);
          this.facadeMap_.addUnknowLayers_(capa);
        } catch (e) {
          console.warn('maplibreLayer: no se pudo anadir la capa al mapa', e);
        }
      });

      if (resto.length) addLayersOriginal.call(this, resto);
      return this;
    };

    proto.removeLayers = function (capas) {
      const lista = Array.isArray(capas) ? capas : (capas === undefined ? [] : [capas]);
      const nuestras = lista.filter(esCapaMapLibre);

      if (nuestras.length) {
        try {
          this.removeUnknowLayers_(nuestras);   // quita de `layers_` y llama a `destroy()`
        } catch (e) {
          console.warn('maplibreLayer: no se pudo quitar la capa del mapa', e);
        }
      }

      // Se le pasa la lista entera para que la API dispare sus eventos con
      // todas las capas; de las nuestras ya no queda nada que quitar.
      return removeLayersOriginal.call(this, lista);
    };

    proto.getUnknowLayers_ = function (filtro) {
      const lista = getUnknowLayersOriginal.call(this, filtro) || [];
      // El impl devuelve todas las de tipo desconocido aunque se le pase un
      // filtro. Se descartan las MapLibre que no casen para que getLayers() y
      // removeLayers() por otra capa no se las lleven por delante.
      const resultado = lista.filter((capa) => !esCapaMapLibre(capa) || capaCoincideFiltro(capa, filtro));
      (this.layers_ || []).forEach((capa) => {
        if (!esCapaMapLibre(capa) || resultado.indexOf(capa) !== -1) return;
        if (!capaCoincideFiltro(capa, filtro)) return;
        resultado.push(capa);
      });
      return resultado;
    };

    proto.__maplibreLayerParche = true;
  }

  /**
   * Devuelve la API solo si la implementación activa es Cesium. En 2D no se
   * toca nada: allí la capa la implementa OpenLayers y funciona.
   * @returns {Object|null}
   */
  function apiCesium() {
    const IDEE = window.IDEE || window.M;
    if (IDEE && IDEE.impl && IDEE.impl.cesium && IDEE.layer && IDEE.impl.layer) return IDEE;
    return null;
  }

  function aplicarParche() {
    const IDEE = apiCesium();
    if (!IDEE) return false;
    if (typeof IDEE.layer.MapLibre !== 'function' || typeof IDEE.impl.layer.Vector !== 'function') return false;

    // La implementación del mapa tiene que saber enrutar una capa `MapLibre`.
    parchearMapaImpl(IDEE.impl.Map);

    if (IDEE.layer.MapLibre !== fachadaInstalada) {
      try {
        // La fachada del bundle cuelga de una clase base que no está expuesta:
        // se toma de su prototipo. La implementación, igual, de la base de la
        // que cuelga `IDEE.impl.layer.Vector`.
        const BaseFachada = Object.getPrototypeOf(IDEE.layer.MapLibre.prototype).constructor;
        const BaseImpl = Object.getPrototypeOf(IDEE.impl.layer.Vector.prototype).constructor;

        fachadaInstalada = crearFachada(BaseFachada, crearImplementacion(BaseImpl));
        IDEE.layer.MapLibre = fachadaInstalada;
        if (window.M && window.M.layer && window.M.layer !== IDEE.layer) {
          window.M.layer.MapLibre = fachadaInstalada;
        }
      } catch (e) {
        console.warn('maplibreLayer: no se pudo instalar la fachada MapLibre', e);
        fachadaInstalada = null;
      }
    }

    return IDEE.layer.MapLibre === fachadaInstalada;
  }

  aplicarParche();
  setInterval(aplicarParche, 10);

  // Detección del cambio de build: el plugin 2D/3D reemplaza el <script> de la
  // build y, cuando termina de ejecutarse, `window.IDEE` ya es la nueva. Aplicar
  // aquí elimina la carrera con la re-ejecución de `mapa()`.
  if (document.addEventListener) {
    document.addEventListener('load', (e) => {
      const objetivo = e && e.target;
      if (objetivo && objetivo.tagName === 'SCRIPT' && /apiidee.*cesium/i.test(objetivo.src || '')) {
        aplicarParche();
      }
    }, true);
  }

  /* ------------------------------------------------------------------ *
   * Exposición
   * ------------------------------------------------------------------ */

  window.maplibreLayer = {
    cargar: cargarMaplibre,
    version: VERSION_MAPLIBRE,
    /**
     * Fachada instalada (para depurar desde la consola).
     * @returns {Function|null}
     */
    fachada: () => fachadaInstalada
  };
})();

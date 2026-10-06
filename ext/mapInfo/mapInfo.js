/* =====================================================================
   PLUGIN DE INFORMACIÓN DEL MAPA PARA API-IDEE / API-CNIG
   Repositorio: Galeria_de_mapas
   =====================================================================

   QUÉ ES ESTE PLUGIN:
   Lee lo que se está mirando y deja escribirlo. Hoy son el nivel de zoom (en
   2D) o la altura de la cámara (en 3D), y la escala 1:n. Se llama mapInfo y
   no "escala" porque va a crecer por ese lado: cuando se le añadan lecturas,
   este es el sitio donde van, y el nombre tiene que aguantar el crecimiento.

   MOTIVACIÓN:
   El control 'scale*true' del constructor IDEE.map({controls}) pintaba en la
   esquina inferior derecha un cuadro con el nivel de zoom y la escala
   ("Nivel de zoom 13.49 | Escala = 1 : 35.000"), que es el control 'Scale' de
   la propia API. Pero:

     - Cesium (3D) no sabe construirlo: lanza "La implementación usada no
       puede crear controles Scale" y aborta la creación del mapa;
     - y su panel cuelga del area de esquina, que es una columna estrecha de
       botones, mientras que esta lectura es un div ancho (272 px) que se
       cruza con el resto de herramientas.

   Este plugin sustituye a ese control con una lectura propia, colgada en la
   banda reservada de controles (ext/areaControls), que es un div a todo el
   ancho donde este tipo de lecturas sí encaja.

   CONTENIDO:
     Todo va en UNA TIRA, la misma línea de siempre, y solo baja a una segunda
     línea si no cabe en el ancho del visualizador. De izquierda a derecha:

     - 2D (OpenLayers): nivel de zoom del mapa y su escala 1:nnnnnn. La escala
       sale de la resolución de la vista, convertida a metros de suelo con el
       factor que da la propia proyección (ver ESCALA y _factorProyeccion). El
       nivel sale de la misma cuenta, y también sobre el suelo (ver NIVEL DE
       ZOOM).
     - 3D (Cesium): no hay nivel de zoom, así que en su lugar se muestra la
       altura de la cámara sobre el elipsoide, y la escala se calcula a partir
       del campo de visión y del tamaño del lienzo. La escala de un mapa en
       perspectiva no es constante (depende de la distancia a la que esté el
       punto mirado), de modo que el valor es el del centro de la vista. Esta
       vía no necesita factor de proyección: los metros por píxel ya salen de
       la geometría de la cámara, que es una distancia real sobre el terreno.
     - Las coordenadas del puntero, en el EPSG del visualizador (ver PUNTERO).
     - El selector de proyección, con la casilla de "cortar" al lado (ver
       PROYECCIÓN DEL VISUALIZADOR).

   ESCALA:
     Qué número se pinta y por qué es el mismo en cualquier proyección.

     La conversión es la del ejemplo "Projection and Scale" de OpenLayers, el
     patrón canónico para mantener la escala al cambiar de proyección: se le
     pregunta a la proyección cuántos metros de suelo mide un metro proyectado
     en el punto que se está mirando, y se multiplica.

         const mpu = proyeccion.getMetersPerUnit();
         const factor = getPointResolution(proyeccion, 1 / mpu, centro, 'm') * mpu;
         escala = resolucion * factor / M_POR_PX;

     En EPSG:3857 el factor es el coseno de la latitud, porque Mercator estira
     hacia los polos; en EPSG:4326 es el factor de latitud de los grados; en una
     proyección cónica sería el del cono. NO hay ninguna fórmula de latitudes
     en el plugin, y esa es la diferencia con la versión anterior, que arrancaba
     en 3857 y se leía mal en el resto.

     Que el sentido esté bien se ha medido, no supuesto: la distancia geodésica
     entre dos puntos separados 100 px da suelo/resolución = 1,0000 en el
     ecuador, 0,9653 a 15,15 grados, 0,8660 a 30, 0,7071 a 45 y 0,6482 a 49,59,
     que es el coseno clavado en las cinco. Multiplicar. Antes se dividía, que
     va al revés: hacía que la escala creciera al subir al norte cuando Mercator
     afina el detalle. La etapa de Camino de los Faros, en 43,32 N, salía
     42.710 en vez de 31.073.

     El píxel se queda en los 72 dpi de la API. OL NO USA DPI: su ScaleLine
     trabaja en metros y píxeles y pone una barra de una distancia redonda
     ("100 km"); el "1 : n" lo introduce la API al dividir por 0,0254/72. Por
     eso el píxel es el de la API, para que nuestra escala y la suya COINCIDAN
     EN EL ECUADOR, que es el único punto en el que se pueden contrastar. En el
     ecuador dan el mismo número; a 49,59 N la nuestra da 27.687 y la de la API
     sigue en 42.710, que es su escala del ecuador y no la del sitio.

     Contrastado contra ol.proj, que es la fuente, en ocho latitudes de 0 a 85
     grados: diferencia del 0,00% salvo el 0,01% a 85 grados, que es redondeo.

     Con esto, 2D y 3D dicen lo mismo. Antes se separaban por un factor de 4/3,
     porque el cálculo de 3D usaba el píxel de 96 dpi de una pantalla y el de
     2D el de 72 de la API.

   ESPACIOS:
     Los huecos entre etiqueta, valor y separador los pone el CSS (`gap` en
     .g-mapInfo-dato y margen en .g-mapInfo-separador), nunca el
     texto. Un espacio final dentro de un hijo flex se colapsa (CSS Text 3,
     4.1.1) y no se dibuja, así que "Nivel de zoom " se vería pegado al
     número.

   NIVEL DE ZOOM:
     El nivel se pinta y se escribe SOBRE EL SUELO, igual que la escala, y con
     la misma cuenta: log2(resolución máxima / (resolución de la vista × factor
     de la proyección)). Es la cuenta de OpenLayers con el denominador
     convertido a suelo, y el factor es el mismo de la escala.

     Por qué no se usa map.getZoom() tal cual: porque el nivel de OpenLayers es
     log2(maxResolution / resolución) sobre la resolución del PLANO de la
     proyección, así que es un artefacto de estar en Mercator. Al cambiar de
     proyección la resolución en metros proyectados cambia aunque el mapa no se
     haya movido, y el nivel se iba 0,46 por delante en Galicia sin que hubiera
     pasado nada. Con la cuenta sobre el suelo el nivel NO depende de la
     proyección, que es justo lo que se pedía.

     Dos cosas que conviene tener presentes al leerlo:

       - En el ECUADOR los dos dan el mismo número, y sigue siendo el que
         devolvía la API (medido: 13,342847 con 15,067 m/píxel). El ecuador es
         el único sitio donde se pueden contrastar, porque es donde el suelo y
         el plano coinciden.

       - A 43 grados el nivel leído es 0,46 más alto que el de la API. No es un
         error: ese 0,46 es el estiramiento de Mercator, el mismo que ya
         aparece en la escala de al lado.

     Por eso _irAZoom() anima la RESOLUCIÓN y no el zoom, y por eso el rango de
     lo que se escribe se desplaza con el mismo desvío (_rangoZoom): si se
     animara el zoom, OpenLayers lo interpretaría con su propia cuenta y el
     número escrito no sería el que acaba poniendo.

   EDICIÓN A MANO:
     Los dos valores se pueden escribir y el mapa va allí. En reposo se ven
     como simples cifras; al pulsar encima se convierten en un campo de texto.
     El control 'scale*true' de la API hace lo mismo pero con contenteditable,
     que se ha descartado por tres motivos:

       - no hay teclado numérico en móvil (falta inputmode), ni semántica de
         min/max/step, ni escalado con las flechas;
       - admite texto enriquecido, así que un pegado mete marcado dentro;
       - no valida nada, y la API tampoco: map.setToClosestScale('abc') deja
         el mapa con getZoom() === NaN, sin resolución y sin recuperación.

     Aquí los valores son <input type="text" inputmode="decimal">, se validan
     y se topan ANTES de llamar a la API (ver _aplicarTexto), y después de
     aplicar se relee del mapa lo que ha quedado de verdad, porque la API no
     acierta siempre: setToClosestScale(50000) deja 49999.

      Lo que se escribe es la misma magnitud que se pinta, así que escribir lo
     que se lee deja lo que se lee (ver _resolucionDeEscala). Sin esa vuelta, a
     15 grados de latitud el campo enseñaba 25.900 tras escribir 25.000, y
     reescribir ese 25.900 se iba a 26.826.

   TRANSICIÓN:
     Un salto de golpe al escribir un número queda brusco, así que en 2D se
     anima con la propia vista de OpenLayers (view.animate, 550 ms, curva
     easeOut) y no con map.setZoom(), que salta. Para la escala se anima la
     resolución, que es lo que la vista sabe interpolar, y esa resolución es la
     que sale de _resolucionDeEscala(). Por eso no se usa setToClosestScale(),
     que además no devuelve nada.

     En 3D no hay vista que animar y la cámara no tiene transición de altura:
     el cambio es instantáneo, aunque se conservan el rumbo y la inclinación
     (ver _fijarAlturaCamara).

   PUNTERO:
     La posición del puntero se lee en el EPSG DEL VISUALIZADOR, que es la
     misma regla que la escala: se le pregunta a la vista cuál es su
     proyección y se lee en ella, sin convertir a nada.

     En 2D no hay ni una línea de cálculo: OpenLayers ya entrega la coordenada
     del evento en las unidades de la vista (`ev.coordinate`), que son las de
     su proyección. Por eso el campo cambia solo, sin que el plugin sepa nada,
     al cambiar de proyección con el selector de abajo.

     En 3D no hay vista que consultar, y la proyección del visor la declara la
     propia API: `map.getProjection()` devuelve EPSG:4979, que es longitud,
     latitud y ALTURA. Se muestran las tres, y la altura es la del terreno
     (`globe.getHeight`), no la del elipsoide, que es cero.

     Ojo con qué método de Cesium sirve y cuál no, medido sobre cinco puntos
     muy separados de la pantalla:

       - `camera.pickEllipsoid(pos, globe.ellipsoid)` SÍ: de -8.885083/43.308610
         a -8.833263/43.329893. Es el que se usa.
       - `scene.pickPosition()` NO: devuelve SIEMPRE el mismo punto, el centro
         del mapa, dé donde se apunte. Engañoso, porque devuelve un valor con
         aspecto de válido.
       - `globe.pick()` NO: en esta versión del bundle devuelve un objeto sin
         `longitude` ni `latitude`, así que sus coordenadas salen NaN.

     pickEllipsoid corta en el elipsoide, no en el terreno, así que por sí solo
     daría altura cero. La del terreno sale de `globe.getHeight()`, que es
     síncrono y lee las teselas ya descargadas: 0 m en la ría, 117 m y 131 m
     tierra adentro, las tres medidas. Si la tesela no está descargada no hay
     dato, y entonces se muestra la del elipsoide.

   PROYECCIÓN DEL VISUALIZADOR:
     Botón "Proyección EPSG:n" en la tira, que abre una VENTANA MODAL con la
     lista de los sistemas de coordenadas utilizables, la casilla de recorte y
     el alta de uno nuevo. Es modal, y no un desplegable, por dos razones
     medidas: el desplegable tenía que ser de 26 em para que cupieran los
     nombres largos ("ETRS89 / UTM zone 30N (EPSG:25830)") y con eso se comía
     317 de los 780 px de la tira, y en una lista de doce códigos el desplegable
     del navegador acaba abriéndose hacia arriba, por encima del botón, que es
     justo donde está el resto del mapa.

     Lo que hay detrás, y por qué la lista está limitada a lo que está:

       - La API TIENE método: `map.setProjection(codigo)`. Funciona y no lanza.

       - Pero NO conserva la vista: al cambiarla la deja en (0,0), que es el
         golfo de Guinea. Eso se arregla aquí, y es la cuenta del ejemplo
         "Projection and Scale" de OpenLayers: se mide cuántos metros de suelo
         mide un píxel ANTES del cambio, se centra y se reparte en la resolución
         de la vista nueva. Con eso el mapa se queda donde estaba, que es
         justo lo que se le pedía.

       - Y hay una limitación que no es del plugin: si se elige un EPSG que la
         API no conoce, el mapa se queda EN BLANCO. Medido con EPSG:2154:
         0 de 40000 píxeles con color, y el aviso de OpenLayers
         "No transform available between EPSG:2154 and EPSG:3857". Las capas
         no saben reproyectarse a un sistema que no conocen.

         Por eso la lista no ofrece la base de datos EPSG entera, sino los
         códigos que cumplen DOS condiciones, ambas comprobadas al montar:
         que `ol.proj.get()` devuelva la proyección, y que exista transform
         entre ella y EPSG:3857 (la que usan las capas de la API). En la etapa
         de Camino de los Faros pasan once: 3857, 4326, CRS:84, 4269, 4230,
         4258, 25829, 25830, 32629, 32630 y 3395. Se quedan fuera 2154, 2065,
         27700 y 3875, que aquí no sirven.

       - El rótulo es "Nombre (EPSG:n)". Las proyecciones de OpenLayers NO
         guardan su nombre (no tienen getName(), ni set()), así que el nombre
         se le cuelga a la propia proyección como atributo `name` y su semilla
         es una tabla, NOMBRES_EPSG, con los nombres oficiales que se sacaron
         del <gml:name> del servicio de definiciones del OGC. Ver
         _nombreProyeccion.

       Y en la misma ventana está la casilla de "recortar", que decide si el
       visor se recorta a la extensión de la proyección o se deja en global.
       Dentro del modal y no en la tira porque va con la proyección: las dos
       cosas son la misma pregunta (qué sistema de coordenadas y de qué
       tamaño), y fuera de la tira la casilla quedaba como un adorno suelto
       al que no se sabía con qué proyección estaba relacionada:

         - De la extensión se ocupa la propia proyección, que es lo que hace que
           el mapa base se vea en una bolsita: la fuente de teselas pide su
           rejilla con la extensión de la proyección de la vista (medido: la
           capa base es la única con getTileGridForProjection), así que fuera de
           la franja de una UTM no hay ni una tesela que pedir.

         - Se tocan las dos cosas, no una: `setGlobal()` y `setExtent()`. La
           extensión es el recorte en sí, pero además la proyección se declara
           global o no, porque OpenLayers, al buscar la rejilla de una proyección
           que no es de las suyas, usa la rejilla mundial de EPSG:3857 cuando
           isGlobal() es cierto y la extensión de la proyección cuando no.

         - La extensión de partida se guarda en la propia proyección
           (`extentPropio`), que es lo único que permite volver al recorte real
           al marcar la casilla otra vez.

         - Y conviene decir qué es "global": quita el recorte, no arregla la
           proyección. Lejos de su franja, una UTM sigue siendo una UTM y sus
           coordenadas se disparan; lo que pasa es que ya no hay nada que lo
           impida mirar.

       - En 3D no hay nada que cambiar: el globo es geodésico y siempre es
         EPSG:4979. El botón se muestra deshabilitado, con la explicación en
         el título, en vez de fingir que hace algo. La casilla de recorte se
         deshabilita con él.

       - `ol.proj.proj4.register()` de la API parece el método para registrar
         un EPSG nuevo, pero NO funciona en este bundle: con nueve firmas
         distintas y 92 combinaciones de claves lanza siempre "Could not parse
         to valid json: defaultDatum", y sin llegar a hacer ninguna petición de
         red (comprobado). Por eso la vía de registro es la de abajo.

   REGISTRAR UN EPSG NUEVO:
     En la parte de abajo de la ventana hay dos campos, el código y la
     definición, y un botón "Añadir y usar". Antes esto se pedía con
     `window.prompt`, que no admite pegar un WKT largo con comodidad ni
     avisa de nada mientras se escribe; con los dos campos en el modal el WKT
     se pega en un textarea y se lee entero. El código y la definición también
     se admiten juntos en el campo de la definición separados por una barra
     vertical, que es como se daba antes.

     El método de la API es el que da el nombre:
     `IDEE.utils.parseCRSWKTtoJSON(wkt)` devuelve `PROJCS.name` y los
     `PARAMETER` de la proyección. Con eso se construye la transformación a
     mano (ver _registrarDesdeWKT) y se registra en OpenLayers con
     `addProjection` y `addCoordinateTransforms`, que sí están disponibles.

     Que las transformaciones las calcule el plugin y no la API es lo que
     permite hacerlo sin depender de un servicio de definiciones EPSG por red.

     Solo se cubren las proyecciones que se pueden escribir en veinte líneas y
     comprobar: Mercator, Mercator Auxiliar, Transversal de Mercator y Cónica
     Conforme de Lambert. Si el WKT trae otra, se dice y no se registra nada,
     en vez de registrar una proyección que miente.

     Cómo se comprueba que las transformaciones están bien, sin referencial
     externo: se registra un código NUEVO con la MISMA definición que una
     proyección que la API ya trae (ETRS89 / UTM 30N, EPSG:25830) y se exige
     que dé los mismos números. Está en la batería de pruebas.

      Y ahora además, cada alta hace su propia comprobación de ida y vuelta
      antes de darse por buena: un punto pasa y vuelve y tiene que salir como
      entró. Eso es lo que descubrió el error de signo de la inversa de Lambert,
      que estaba escrita al revés (π/2 − 2·atan(...) en vez de
      2·atan(...) − π/2) y ponía el hemisferio norte en negativo sin que nada se
      enterara (medido: Madrid a -40,64°).

   CONVENCIONES:
   1. Resolvedor dual de la API (window.IDEE || window.M) mediante api(),
      eligiendo el global que tenga la API REALMENTE cargada (.ui y .map).
   2. Detección de implementación: se prefiere map.getImplementation()
      ('ol' / 'cesium'), que es la que usa la propia API para distinguir sus
      dos implementaciones, y se cae al patrón canónico del repo
      (map.getMapImpl() con scene.camera) si ese método no existe.
   3. Constructor sin argumentos obligatorio:
      new IDEE.plugin.miPlugin_mapInfo()
   4. Contrato de estado getState()/setState() para el swap 2D/3D.
   5. Exposición triple (window / IDEE.plugin / M.plugin) para sobrevivir
      a la recarga del bundle de la API.
   ===================================================================== */

(function () {
  'use strict';

   /** Píxeles por pulgada con los que trabaja la API al publicar su escala (72 dpi).
   *
   * ESTE es el píxel de todo el plugin, en 2D y en 3D, y es a propósito. La API
   * mide el píxel a 72 dpi, no a los 96 que tendría una pantalla, y esa es la
   * medida con la que hay que poder contrastar nuestra escala con la suya: en el
   * ecuador tienen que dar exactamente el mismo número. Con 96 dpi, 2D diría
   * 4/3 de lo que dice la API.
   *
   * Ojo con quién decide esto: OL NO USA DPI. Su ScaleLine trabaja en metros y
   * píxeles y pone una barra de una distancia redonda ("100 km"); el "1 : n" lo
   * introduce la API al dividir por 0,0254/72. Así que el dpi es decisión
   * nuestra, y se toma el de la API para tener un punto de referencia con el
   * que contrastar.
   *
   * Comprobado a pelo, con la fórmula de la API: resolución = escala * 0,0254/72
   * en 1:5.000 (1,76389), 1:25.000 (8,81944), 1:100.000 (35,2778) y 1:500.000
   * (176,389). Con 96 dpi saldría un 33% mayor, que es justo el error. */
  const PPI = 72;
  /** Metros que mide un píxel con esos dpi: 0,0254 / 72. */
  const M_POR_PX = 0.0254 / PPI;
  /** Duración de la transición al escribir un valor, en ms. */
  const DURACION_TRANSICION = 550;
  /** Campo de visión por defecto de la cámara de Cesium (rad). */
  const FOV_POR_DEFECTO = Math.PI / 3;
  /** Tope de espera (ms) para que aparezca la escena de Cesium. */
  const ESPERA_ESCENA = 12000;
  /** Ancho en caracteres de los campos de texto, para que el ancho no baile. */
  const ANCHO_CARACTERES = 8;
  /** Rangos admitidos de la escala 1:n. Cubre de sobra los zooms 0-28. */
  const ESCALA_MINIMA = 1;
  const ESCALA_MAXIMA = 1e9;
  /** Rango de altura de cámara admitido en 3D (m). */
  const ALTURA_MINIMA = 1;
  const ALTURA_MAXIMA = 2e7;
  /** Decimales con que se pintan las coordenadas en metros. */
  const DECIMALES_METROS = 2;
  /** Decimales con que se pintan las coordenadas en grados.
   *  Un grado son 111 km, así que con dos decimales se perdían los diez metros;
   *  con cinco, el error es del metro. */
  const DECIMALES_GRADOS = 5;
  /** Proyección en la que trabajan las capas de la API. Es la que tiene que
   *  existir un transform para que un EPSG pueda usarse de verdad: sin él el
   *  mapa se queda en blanco (medido con EPSG:2154). */
  const PROYECCION_BASE = 'EPSG:3857';
  /** Proyección que declara la API cuando el mapa es 3D. */
  const PROYECCION_3D = 'EPSG:4979';
  /** Códigos que se ofrecen en el selector, en el orden en que se pintan.
   *  La lista se FIJA aquí porque OpenLayers no tiene forma de preguntar qué
   *  proyecciones tiene registradas (no hay enumerate()), pero NO se ofrecen
   *  sin comprobar: EPSG_A_FILTRAR decide cuáles se quedan. Los que la API
   *  tiene y no están aquí se pueden registrar pegando su WKT. */
  const EPSG_A_FILTRAR = [
    'EPSG:3857', 'EPSG:4326', 'CRS:84',
    'EPSG:4269', 'EPSG:4230', 'EPSG:4258',
    'EPSG:25829', 'EPSG:25830', 'EPSG:32629', 'EPSG:32630',
    'EPSG:23028', 'EPSG:23029', 'EPSG:23030',
    'EPSG:26929', 'EPSG:26930',
    'EPSG:3395', 'EPSG:27700', 'EPSG:2154', 'EPSG:2065', 'EPSG:3875'
  ];
  /** Nombres oficiales de los sistemas de coordenadas, para el rótulo del
   *  selector, que es "nombre del sistema (código)".
   *
   *  NO salen de las proyecciones de OpenLayers: su objeto Projection no
   *  guarda el nombre (no tiene getName(), medido) ni se le puede escribir con
   *  set(), que tampoco existe (medido). Por eso el nombre se le cuelga al
   *  propio objeto de la proyección como atributo `name`, que sí se queda
   *  (_nombreProyeccion), y esta tabla es su semilla.
   *
   *  La semilla son los nombres tal cual los publica el EPSG, y se han ido a
   *  buscarlos uno a uno en el elemento <gml:name> que devuelve el servicio de
   *  definiciones del OGC, que es justo adonde apunta el campo `coordRefSys` del
   *  registro de la API:
   *
   *      http://www.opengis.net/def/crs/EPSG/0/25830  ->  <gml:name>ETRS89 / UTM zone 30N</gml:name>
   *
   *  Se copiaron aquí y no se piden en tiempo de ejecución a propósito, porque
   *  ese servicio no manda la cabecera Access-Control-Allow-Origin (comprobado)
   *  y desde el navegador la petición se moriría de error de CORS, dejando la
   *  consola llena de errores en cada arranque. La resolución por red queda como
   *  método público y a mano (_resolverNombresOficiales()) por si algún día el
   *  servicio la sirve; si falla se queda el nombre de esta tabla y no se enseña
   *  ni se registra ningún error.
   *
   *  Merece la pena avisar de que los nombres no son lo que se suponía: el
   *  4269 es NAD83 (el ED50 es el 4230) y el 26929/26930 son NAD83 de Alabama,
   *  no de Australia. Con la tabla que había antes se ofrecían mal. */
  const NOMBRES_EPSG = {
    'EPSG:3857': 'WGS 84 / Pseudo-Mercator',
    'EPSG:4326': 'WGS 84',
    'CRS:84': 'WGS 84 en longitud y latitud',
    'EPSG:4269': 'NAD83',
    'EPSG:4230': 'ED50',
    'EPSG:4258': 'ETRS89',
    'EPSG:25829': 'ETRS89 / UTM zone 29N',
    'EPSG:25830': 'ETRS89 / UTM zone 30N',
    'EPSG:32629': 'WGS 84 / UTM zone 29N',
    'EPSG:32630': 'WGS 84 / UTM zone 30N',
    'EPSG:23028': 'ED50 / UTM zone 28N',
    'EPSG:23029': 'ED50 / UTM zone 29N',
    'EPSG:23030': 'ED50 / UTM zone 30N',
    'EPSG:26929': 'NAD83 / Alabama East',
    'EPSG:26930': 'NAD83 / Alabama West',
    'EPSG:3395': 'WGS 84 / World Mercator'
  };
  /** Proyecciones que se ofrecen en 3D DE MOMENTO. En 2D no aplican: allí sigue
   *  mandando EPSG_A_FILTRAR y la lista larga.
   *
   *  En 3D el globo es geodésico y no admite más que dos formas de leerlo: en
   *  globo (geográficas, con la altura del terreno) y en plano (las X e Y de la
   *  Mercator, más la altura). Así que de momento son esas dos y ya, y el resto de
   *  la maquinaria (registro, WKT, transformaciones) sigue ahí para cuando se
   *  vuelva a abrir el abanico.
   *
   *  Es una constante y no un `if` repartido: para abrir más en 3D se cambia esta
   *  línea y se le añade su entrada en MODO_3D.
   */
  const EPSG_DISPONIBLES = ['EPSG:4326', 'EPSG:3857'];
  /** Modo de la vista de Cesium que lleva cada proyección en 3D.
   *  - 'globo': el globo entero, que es como se ve el terreno.
   *  - 'plano': el globo aplanado, que es la vista plana equivalente al 2D. */
  const MODO_3D = {
    'EPSG:4326': 'globo',
    'EPSG:3857': 'plano',
  };
  /** Semieje mayor de la esfera en la Mercator esférica (EPSG:3857), en metros.
   *  Es el 6378137 del WGS 84, el mismo que usa el EPSG para esta proyección. */
  const SEMI_MAYOR_MERCATOR = 6378137;
  /** Servicio de definiciones del OGC: resuelve el `coordRefSys` de un código
   *  y devuelve su <gml:name>. Solo se usa como mejora del rótulo. */
  const SERVICIO_DEFINICIONES = 'https://www.opengis.net/def/crs/EPSG/0/';
  /** Servicio de definiciones que SÍ se puede leer desde el navegador: pide el
   *  código y devuelve la cadena proj4.
   *
   *  Medido: https://epsg.io/2154.proj4 contesta 200 con "+proj=lcc +lat_0=46.5
   *  +lon_0=3 ..." y con la cabecera que permite leerlo. El servicio de
   *  definiciones del OGC (SERVICIO_DEFINICIONES) y api.proj4.org NO la mandan y
   *  la petición se muere de CORS, que es por lo que el alta automática se hace
   *  contra este y no contra aquel. */
  const SERVICIO_DEFINICIONES_PROJ4 = 'https://epsg.io/';
  /** El código CRS:84 no es del EPSG y tiene su propio sitio en el servicio. */
  const DEFINICION_CRS84 = 'https://www.opengis.net/def/crs/OGC/1.3/CRS84';
  /** Pausa entre consultas al servicio de definiciones (ms). Se van una a una
   *  y no de golpe, para no soltar de golpe once peticiones ajenas. */
  const PAUSA_NOMBRES = 250;
  /** Cuánto espera el servicio de definiciones antes de darse por agotado (ms).
   *  Si contesta más tarde que esto da igual: su nombre ya no hace falta. */
  const ESPERA_NOMBRES = 6000;
  /** Radio del elipsoide WGS 84 (m). Lo usan las transformaciones que calcula
   *  el plugin al registrar un EPSG desde su WKT. */
  const SEMI_MAYOR_WGS84 = 6378137;
  /** Achatamiento del elipsoide WGS 84. */
  const ACHATAMIENTO_WGS84 = 298.257223563;
  /** Resolución de la vista a la que corresponde el nivel de zoom 0, en metros
   *  de suelo por píxel: la del ejemplo de OpenLayers, 2·π·a/2/256.
   *
   *  Solo se usa si la vista no publica la suya. No es un capricho: es lo que
   *  hace que getZoom() de OpenLayers sea log2(maxResolution / resolución), y
   *  como la resolución de una vista va en las unidades de SU proyección, ese
   *  número es un artefacto de la proyección. Con el nivel calculado sobre el
   *  suelo (resolución × factor) el número no depende de la proyección, que es
   *  justo lo que faltaba. */
  const RESOLUCION_MAXIMA = Math.PI * SEMI_MAYOR_WGS84 / 256;
  /** Hasta dónde llega el alcance "global" de una proyección en metros.
   *
   *  Es un número redondo y holgado a propósito. Sale de medir el mundo entero
   *  en las proyecciones que ofrece el visor: en 25830, 25829 y 32630 el punto
   *  más lejano que sale de transformar (180°, 0°) cae en 2,0·10^7 m de la
   *  coordenada Y, así que 3·10^7 lo envuelve holgadamente.
   *
   *  Y conviene tener presente qué es "global" aquí: quita el recorte, no arregla
   *  la proyección. Lejos de su franja, una UTM sigue siendo una UTM y sus
   *  coordenadas se disparan; lo que pasa es que ya no hay nada que lo impida
   *  mirar. */
  const ALCANCE_METROS = 3e7;
  /** Marca que se deja en una proyección que no traía extensión propia.
   *
   *  La 4269 viene con extent null (medido), así que no hay nada a lo que
   *  recortar el visor: la casilla no puede hacer nada y la proyección se queda
   *  en global para que no se le apague la repetición lateral. Y hay que dejar
   *  constancia en la propia proyección, porque en cuanto se abre en global su
   *  extensión es el mundo entero, y a partir de ahí `getExtent()` ya no dice si
   *  la tenía de origen. */
  const MARCA_SIN_EXTENSION = 'mapInfoSinExtension';
  /** Marca que se deja en una proyección que ya venía global.
   *
   *  La 3857 y la 3395 lo están, y su extensión es un mundo exacto. La rejilla de
   *  la capa base la trae la API fija y vale ese mismo mundo, así que a esas
   *  proyecciones no hay que tocarles la extensión en absoluto: si se les cambia,
   *  dejan de coincidir con su rejilla y la repetición lateral, que desplaza cada
   *  copia un ancho de la extensión de la proyección, se descuadra (medido: con
   *  ±3e7 m en la altura, al pasar de +180 la 3857 se ve 0/0/0/0/0 de píxeles con
   *  color).
   *
   *  Se guarda el valor tal como se vio la primera vez, porque luego el propio
   *  plugin pone la proyección en global y preguntarle después a isGlobal() no
   *  distinguiría una cosa de la otra. */
  const MUNDIAL_NATIVA = 'mapInfoMundialNativa';

  /**
   * Resuelve el objeto global de la API cartográfica realmente cargada.
   * No basta con comprobar que exista window.IDEE: el bloque de exposición
   * de este mismo fichero crea un window.IDEE vacío como simple namespace
   * de plugins, así que se exige que tenga las propiedades funcionales
   * .ui y .map (patrón de api_clampToGround() en controlClampToGroundLayers).
   * @returns {Object} Espacio de nombres de la API-IDEE / API-CNIG.
   */
  function api() {
    const IDEE = window.IDEE;
    if (IDEE && IDEE.ui && IDEE.map) return IDEE;
    const M = window.M;
    if (M && M.ui && M.map) return M;
    return IDEE || M;
  }

  /**
   * Derivada de la latitud Mercator respecto de la latitud geodésica.
   *
   * La necesita el Newton de la transformación inversa de Mercator. Con la
   * excentricidad a cero se reduce a 1/cos(φ), que es el caso de la esfera
   * auxiliar, así que una sola cuenta sirve para los dos.
   * @param {number} lat Latitud geodésica, en radianes.
   * @param {number} e Excentricidad del elipsoide (0 en la esfera).
   * @param {number} e2 Cuadrado de la excentricidad.
   * @returns {number} dψ/dφ.
   */
  function derivadaPsi(lat, e, e2) {
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);
    if (Math.abs(cosLat) < 1e-12) return Infinity;
    return (1 - e2) / ((1 - e2 * sinLat * sinLat) * cosLat);
  }

  /**
   * Escala y nivel de vista del mapa, en la banda de controles.
   */
  class miPlugin_mapInfo {
    /**
     * Constructor del plugin. Funciona sin argumentos.
     * @param {Object} [options={}] Opciones de configuración (todas opcionales).
     * @param {boolean} [options.visible=true] Estado inicial de visibilidad.
     * @param {string} [options.openPosition='bottom'] Banda donde se abre
     * ('bottom' o 'top').
     * @param {number} [options.order=0] Orden dentro de la banda. La banda es
     * un flex row, así que este `order` ordena de izquierda a derecha.
     * @param {boolean} [options.useArea=true] Colgar la lectura en la banda
     * reservada de controles (miPlugin_areaControls). Si la banda no está
     * cargada, la lectura se ancla abajo a la izquierda del mapa.
     * @param {string|Object} [options.color1] Color de fondo. Un color o un
     * objeto {active, deactive}.
     * @param {string|Object} [options.color2] Color de borde. Un color o un
     * objeto {active, deactive}.
     * @param {string|Object} [options.color3] Color de icono y texto. Un color o
     * un objeto {active, deactive}.
     */
    constructor(options = {}) {
      // Identificador obligatorio del plugin (gestor de plugins y cambioImpl).
      this.name = 'miPlugin_mapInfo';
      this.options = options || {};

      // Colores configurables, con los mismos valores por defecto y el mismo
      // reparto que en el resto de plugins del repositorio (ver
      // ext/CalidadAireMadridTiempoReal, que es el que fija el patrón):
      //   color1 = fondo, color2 = borde, color3 = icono y texto.
      // Cada uno puede ser un color suelto o un objeto {active, deactive}, y lo
      // que se pinta es el estado de reposo (el "deactive"), que es como se ve
      // la lectura siempre: no es un botón que se abra y se cierre.
      this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
      this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
      this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };

      // Referencia al mapa y a los elementos de interfaz.
      this._map = null;
      this._host = null;
      this._container = null;
      this._elEtiqueta = null;
      this._elValor = null;
      this._elUnidad = null;
      this._area = null;

      // Segunda línea de la lectura: coordenadas del puntero y botón de
      // proyección (que abre la ventana modal con la lista y la casilla de
      // recorte).
      this._elCoordenadas = null;
      this._etiquetaCoordenadas = null;
      this._selector = null;
      this._codigoSelector = null;
      this._etiquetaSelector = null;
      // La casilla de recorte y su etiqueta viven en la ventana modal, no en la
      // tira. `_cajaAlcance` es la fila entera, que es la que lleva el título.
      this._cajaAlcance = null;
      this._casillaAlcance = null;
      this._etiquetaAlcance = null;
      // Ventana modal de proyección. Va colgada del body y se crea una sola vez
      // en _construirUI(), cerrada; `_abrirModal()` la muestra.
      this._modal = null;
      this._modalVentana = null;
      this._modalFondo = null;
      this._modalLista = null;
      this._modalCampoBuscar = null;
      this._modalCuenta = null;
      this._modalCampoCodigo = null;
      this._modalCampoCodigoBusqueda = null;
      this._modalCampoDefinicion = null;
      this._modalAviso = null;
      this._modalPanelCodigo = null;
      this._modalPanelDef = null;
      this._modalPestanaCodigo = null;
      this._modalPestanaDef = null;
      this._modalBotonBuscar = null;
      this._focoAlAbrir = null;
      this._proyecciones = [];
      this._epsgActivo = null;
      // Proyección elegida para la vista 3D. En 3D no hay proyección que poner en el
      // mapa (el globo es geodésico), pero sí dos formas de leerlo y de verlo:
      // globo (EPSG:4326, geográficas) o plano (EPSG:3857, X e Y de la Mercator).
      // Se guarda aparte de _epsgActivo, que es lo de 2D, y es parte del estado
      // que sobrevive al cambio de implementación.
      this._epsg3D = 'EPSG:4326';
      this._registrando = false;
      this._rafPuntero = null;
      this._punteroEnCola = null;
      this._nombresRegistrados = {};
      // true recorta el visor a la extensión de la proyección; false lo deja
      // en global. Se decide con la casilla de la segunda línea y es parte del
      // estado que sobrevive al cambio 2D/3D.
      this._recortar = false;
      this._timerNombres = null;

      // Listeners registrados (DOM, API y Cesium) para poder soltarlos.
      this._listeners = [];
      this._listenersApi = [];
      this._listenersCesium = [];
      this._esperaEscena = null;

      // Estado de la edición a mano: qué campo se está escribiendo y si el
      // último cambio de foco debe descartarse en vez de aplicarse.
      this._campoEditando = null;
      this._descartar = null;
      this._textoAlEntrar = null;
      this._timerRechazo = null;
      // Último número calculado para cada campo, para poder escalonar con las
      // flechas partiendo del valor real y no del texto.
      this._ultimoPrincipal = null;
      this._ultimoEscala = null;

      // Configuración.
      this._visible = (options.visible !== undefined) ? Boolean(options.visible) : true;
      this._useArea = (options.useArea !== undefined) ? Boolean(options.useArea) : true;
      this._openPosition = (options.openPosition === 'top') ? 'top' : 'bottom';
      this.order = (options.order !== undefined && !Number.isNaN(Number(options.order)))
        ? Number(options.order) : 0;
    }

    /**
     * Devuelve {active, deactive} a partir de un color simple o de un objeto.
     *
     *  Es el mismo traductor que usan los plugins que ya tenían esquema de
     *  colores (ext/CalidadAireMadridTiempoReal, ext/cambioImpl,
     *  ext/plantilla_plugin, ...), para que un color se pueda pasar como '#fff'
     *  o como {active: '#fff', deactive: '#eee'} indistintamente.
     * @param {string|Object} c Color u objeto de colores.
     * @returns {{active: string, deactive: string}} Los dos estados.
     */
    resolveColor(c) {
      return (typeof c === 'object' && c !== null)
        ? { active: c.active, deactive: c.deactive }
        : { active: c, deactive: c };
    }

    /**
     * Vuelca los colores configurados a variables CSS del contenedor.
     *
     *  Se inyectan las seis variables del esquema (los estados de reposo y
     *  activo de fondo, borde e icono), igual que hace
     *  ext/CalidadAireMadridTiempoReal, y el CSS las consume con
     *  `var(--g-plugin-bg-color, orangered)` y compañía. Así el color se cambia
     *  desde el visualizador sin tocar la hoja de estilos, y si las variables no
     *  están el CSS conserva su color de reserva.
     *
     *  La lectura solo se pinta en un estado (no es un botón que se abra y se
     *  cierre), así que el estado que se ve es el de reposo, el "deactive".
     * @returns {boolean} true si se pudieron poner las variables.
     */
    _aplicarColores() {
      try {
        if (!this._container || !this._container.style) return false;
        const c1 = this.resolveColor(this.color1);
        const c2 = this.resolveColor(this.color2);
        const c3 = this.resolveColor(this.color3);
        const escribir = function (raiz) {
          raiz.style.setProperty('--g-plugin-bg-color', c1.deactive);
          raiz.style.setProperty('--g-plugin-bg-color-active', c1.active);
          raiz.style.setProperty('--g-plugin-border-color', c2.deactive);
          raiz.style.setProperty('--g-plugin-border-color-active', c2.active);
          raiz.style.setProperty('--g-plugin-icon-color', c3.deactive);
          raiz.style.setProperty('--g-plugin-icon-color-active', c3.active);
        };
        escribir(this._container);
        // La ventana va colgada del body (ver _crearModal), así que no hereda
        // las variables de la tira y hay que ponérselas también: si no, abrirla
        // se vería con los colores de reserva del CSS.
        if (this._modal) escribir(this._modal);
        return true;
      } catch (e) {
        console.warn(`${this.name}: no se pudieron aplicar los colores.`, e);
        return false;
      }
    }

    /**
     * Proporciona la información de ayuda al gestor de ayuda de la API-IDEE.
     * @returns {{title: string, content: Promise<HTMLElement|string>}} Ayuda del plugin.
     */
    getHelp() {
      const IDEE = api();
      return {
        title: 'Información del mapa',
        content: new Promise((resolve) => {
          let html = '<div><p>Escala del mapa (1 : n) y nivel de zoom, o altura ' +
            'de la cámara en la visualización 3D.</p>' +
            '<p>El valor se actualiza automáticamente al desplazarse o cambiar ' +
            'de zoom el mapa. En 3D la escala es la del punto mirado: al haber ' +
            'perspectiva, no es una constante en toda la vista.</p>' +
            '<p>Los dos valores se pueden escribir: pulse sobre el número, ' +
            'escriba el nuevo nivel de zoom o la nueva escala (1:n) y pulse ' +
            'Intro. La vista se desplaza con una transición suave, no de golpe. ' +
            'Se admite la escala con o sin el 1: delante (25000, 1:25000 o ' +
            '1 : 25.000) y con coma o punto decimal. Escape deshace. Con Alt y ' +
            'las flechas se salta de diez en diez.</p>' +
            '<p>La escala que se ve y la que se escribe es la del SUELO, y por eso ' +
            'no coincide con la que publica la API salvo en el ecuador. La ' +
            'API mide metros de PLANO, y un metro del plano no son lo mismo ' +
            'que un metro de suelo en cuanto el mapa se estira hacia los polos. ' +
            'El criterio es el mismo que usa OpenLayers para su resolución en ' +
            'el punto, y por eso vale en cualquier proyección. En el ecuador ' +
            'los dos números coinciden exactamente; a 49,6 grados norte esta ' +
            'escala marca unos dos tercios de la de la API.</p></div>';
          if (IDEE && IDEE.utils && typeof IDEE.utils.stringToHtml === 'function') {
            try {
              html = IDEE.utils.stringToHtml(html);
            } catch (e) {
              /* Fallback defensivo si falla el conversor */
            }
          }
          resolve(html);
        }),
      };
    }

    // =====================================================================
    // UTILIDADES INTERNAS
    // =====================================================================

    /**
     * Indica si el mapa activo usa la implementación 3D (Cesium).
     * Se pregunta primero a la API (map.getImplementation()), que es la vía
     * que usa ella misma, y se cae al patrón canónico del repo
     * (getMapImpl() con scene.camera) si ese método no está disponible.
     * @param {Object} [map] Instancia del mapa (por defecto, la ya montada).
     * @returns {boolean} true si la implementación actual es Cesium (3D).
     */
    _es3D(map) {
      const mapRef = map || this._map;
      let impl = '';
      try {
        if (mapRef && typeof mapRef.getImplementation === 'function') {
          impl = String(mapRef.getImplementation() || '').toLowerCase();
        }
      } catch (e) {
        impl = '';
      }
      if (impl) return impl === 'cesium';
      try {
        const nativo = (mapRef && typeof mapRef.getMapImpl === 'function')
          ? mapRef.getMapImpl() : null;
        return !!(nativo && nativo.scene && nativo.scene.camera);
      } catch (e) {
        return false;
      }
    }

    /**
     * Devuelve la implementación nativa del mapa (ol.Map o Cesium.Viewer).
     * @returns {Object|null} Instancia nativa.
     */
    _impl() {
      try {
        return (this._map && typeof this._map.getMapImpl === 'function')
          ? this._map.getMapImpl() : null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Localiza el elemento del DOM que aloja el mapa. Se sube desde
     * map.getContainer() hasta el contenedor raíz de la API
     * (.m-api-idee-container), que es el único nodo que existe igual en 2D
     * y en 3D: anclarlo a getContainer() no vale porque en OpenLayers
     * devuelve .ol-overlaycontainer-stopevent.
     * @param {Object} map Instancia del mapa.
     * @returns {HTMLElement|null} Elemento anfitrión.
     */
    _resolveHost(map) {
      let el = null;
      try {
        el = (map && typeof map.getContainer === 'function') ? map.getContainer() : null;
      } catch (e) {
        el = null;
      }
      if (!el || typeof el.querySelector !== 'function') {
        el = document.querySelector('.m-api-idee-container');
      }
      if (!el) return document.body || null;

      let nodo = el;
      let raiz = el;
      while (nodo && nodo !== document.body && nodo !== document.documentElement) {
        if (nodo.classList && nodo.classList.contains('m-api-idee-container')) {
          raiz = nodo;
          break;
        }
        if (nodo.querySelector && nodo.querySelector('.ol-viewport, .cesium-widget')) {
          raiz = nodo;
        }
        nodo = nodo.parentElement;
      }
      return raiz;
    }

    /**
     * Intenta colgar la lectura en la banda reservada de controles.
     * @param {HTMLElement} elemento Elemento ya construido del plugin.
     * @returns {boolean} true si se ha colgado en la banda, false si no.
     */
    _montarEnArea(elemento) {
      if (!this._useArea) return false;
      // La banda es una extensión aparte: si no está cargada, la lectura
      // sigue funcionando con su anclaje a esquina, así que no es un error.
      const Clase = (typeof window !== 'undefined') ? window.miPlugin_areaControls : null;
      if (typeof Clase !== 'function') return false;
      try {
        if (!this._area) {
          this._area = new Clase({ openPosition: this._openPosition });
          this._area.addTo(this._map);
        }
        return this._area.monta(elemento, { order: this.order }) !== null;
      } catch (e) {
        console.warn(`${this.name}: no se pudo colgar en la banda de controles.`, e);
        return false;
      }
    }

    /**
     * Formatea un número con el separador de miles español ("38.439"), que es
     * el que usan los controles de la API. El nivel de zoom no se formatea
     * aquí: lleva punto decimal en vez de coma, como hacía el control
     * 'scale*true' que este plugin sustituye.
     * @param {number} valor Valor a formatear.
     * @returns {string} Texto formateado, o '-' si el valor no es válido.
     */
    _formatear(valor) {
      const n = Number(valor);
      if (!isFinite(n)) return '-';
      try {
        return n.toLocaleString('es-ES', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
      } catch (e) {
        return String(Math.round(n));
      }
    }

    // =====================================================================
    // CONSTRUCCIÓN Y ACTUALIZACIÓN DE LA INTERFAZ
    // =====================================================================

    /**
     * Crea el DOM de la lectura: una caja con el dato principal, un separador
     * y la escala. Se parezca lo que se parezca al control 'scale*true' de la
     * API, porque es su sustituto visual.
     *
     * Los dos valores son campos de texto, no cifras: hasta que no se pulse
     * encima se comportan como texto plano (el CSS les quita fondo y borde),
     * y entonces sirven para escribir el nivel de zoom o la escala a mano.
     * @returns {HTMLElement} Contenedor creado.
     */
    _construirUI() {
      const cont = document.createElement('div');
      cont.className = 'g-mapInfo';
      cont.title = 'Información del mapa. Púlsalo para escribir los valores a mano.';

      const caja = document.createElement('div');
      caja.className = 'g-mapInfo-caja';

      // Dato principal: nivel de zoom en 2D, altura de la cámara en 3D.
      // Los textos van SIN espacios de relleno: los aporta el `gap` de
      // .g-mapInfo-dato y el margen del separador, porque un espacio
      // final dentro de un hijo flex se colapsa y no se vería.
      const principal = document.createElement('span');
      principal.className = 'g-mapInfo-dato';
      const etiqueta = document.createElement('span');
      etiqueta.className = 'g-mapInfo-etiqueta';
      etiqueta.textContent = 'Nivel de zoom';
      const valor = this._crearCampo('Nivel de zoom');
      principal.appendChild(etiqueta);
      principal.appendChild(valor);

      // la barra que divide entre secciones. SIN texto: el glifo "|" va de la
      // fila 2 a la 13 mientras que el texto va de la 2 a la 10 (medido por
      // píxeles), porque elPipe baja de la línea base, y por mucho que se
      // centre la caja la marca quedaba colgando y se veía torcida. La barra la
      // dibuja el CSS con alto fijo y `align-self: center`, así que su tinta cae
      // en las mismas filas que las letras (ver .g-mapInfo-separador).
      const separador = document.createElement('span');
      separador.className = 'g-mapInfo-separador';

      // Escala 1 : n, común a las dos implementaciones.
      const escala = document.createElement('span');
      escala.className = 'g-mapInfo-dato';
      const unidad = document.createElement('span');
      unidad.className = 'g-mapInfo-etiqueta';
      unidad.textContent = 'Escala = 1 :';
      const valorEscala = this._crearCampo('Escala');
      escala.appendChild(unidad);
      escala.appendChild(valorEscala);

      // La caja es una tira que se parte sola (ver .g-mapInfo-caja en el CSS):
      // todo lo de la lectura va en la MISMA línea, con sus separadores de por
      // medio, y solo baja a una segunda línea si no cabe en el ancho del
      // visualizador. No se fuerzan dos líneas fijas porque en cuanto se añade
      // la casilla de recorte, o se elige una proyección con un nombre largo,
      // el panel tiene que poder crecer sin empujar al mapa de sitio.
      // Coordenadas del puntero. NO es un campo editable: una posición bajo el
      // cursor no es una magnitud que se escriba, y aquí no hay nada que
      // mandar al mapa si se escribiera. Es un <span>, no un <input>, para que
      // además siga heredando pointer-events: none del contenedor y no robe el
      // ratón al mapa.
      const coordenadas = document.createElement('span');
      coordenadas.className = 'g-mapInfo-dato';
      const etiquetaCoordenadas = document.createElement('span');
      etiquetaCoordenadas.className = 'g-mapInfo-etiqueta';
      etiquetaCoordenadas.textContent = 'Coordenadas';
      const valorCoordenadas = document.createElement('span');
      valorCoordenadas.className = 'g-mapInfo-valor';
      valorCoordenadas.textContent = '-';
      coordenadas.appendChild(etiquetaCoordenadas);
      coordenadas.appendChild(valorCoordenadas);

      const separador2 = document.createElement('span');
      separador2.className = 'g-mapInfo-separador';
      const separador3 = separador2.cloneNode(true);

      // Botón de proyección del visor. Antes era un <select> con el desplegable
      // de la API, y ahora es un <button> que abre la ventana modal (ver
      // _crearModal). El rótulo se queda tal cual estaba, "Nombre (EPSG:n)": lo
      // que cambia es dónde se elige, no lo que se ve. La casilla de recorte se
      // va con él a la ventana, y con ella y con la etiqueta del desplegable se
      // recuperan los 52 px de la casilla.
      const bloqueProj = document.createElement('span');
      bloqueProj.className = 'g-mapInfo-dato';
      const etiquetaSelector = document.createElement('span');
      etiquetaSelector.className = 'g-mapInfo-etiqueta';
      etiquetaSelector.textContent = 'Proyección';
      const selector = document.createElement('button');
      selector.className = 'g-mapInfo-selector';
      selector.type = 'button';
      // El texto va en un <span> aparte y no directamente en el botón: el botón
      // es un inline-flex y sin el span su ancho lo fija el navegador, que le
      // da el ancho por defecto de button más un margen heredado de la API
      // (medido en el panel de la brújula: 40 px de botón dentro de 44 px de caja).
      const codigoSelector = document.createElement('span');
      codigoSelector.className = 'g-mapInfo-selector-codigo';
      const flechaSelector = document.createElement('span');
      flechaSelector.className = 'g-mapInfo-selector-flecha';
      flechaSelector.setAttribute('aria-hidden', 'true');
      flechaSelector.textContent = '▾';
      selector.appendChild(codigoSelector);
      selector.appendChild(flechaSelector);
      bloqueProj.appendChild(etiquetaSelector);
      bloqueProj.appendChild(selector);

      // La casilla de recorte NO se construye aquí: vive en la ventana modal, con la
      // proyección a la que pertenece (ver _crearModal). Lo que queda en la tira
      // es el botón, que es lo que abre la ventana.

      // El orden de la tira, de izquierda a derecha. Cada separador va en medio
      // de los dos datos que separa, y no se usa el `gap` de la caja para el
      // espacio entre ellos, porque así el aire queda pegado a la barra y no
      // repartido por igual (ver .g-mapInfo-separador).
      caja.appendChild(principal);
      caja.appendChild(separador);
      caja.appendChild(escala);
      caja.appendChild(separador2);
      caja.appendChild(coordenadas);
      caja.appendChild(separador3);
      caja.appendChild(bloqueProj);

      cont.appendChild(caja);

      this._container = cont;
      this._elEtiqueta = etiqueta;
      this._elValor = valor;
      this._elUnidad = valorEscala;
      this._elCoordenadas = valorCoordenadas;
      this._etiquetaCoordenadas = etiquetaCoordenadas;
      this._selector = selector;
      this._codigoSelector = codigoSelector;
      this._etiquetaSelector = etiquetaSelector;

      // El botón abre la ventana. Se construye aquí y no al vuelo porque el
      // modal tiene que existir ya para que su casilla de recorte reciba el
      // estado (setState la pone antes de cambiar la proyección) y para que
      //.destroy() pueda quitarlo.
      this._crearModal();
      this._on(selector, 'click', function () {
        this._alternarModal();
      }.bind(this));

      return cont;
    }

    /**
     * Crea la ventana modal de proyección, una sola vez, y la deja cerrada.
     *
     * Va colgada de `document.body` y no dentro de `.g-mapInfo` a propósito: la
     * ventana es `position: fixed` para poder centrarse en el mapa entero, y si
     * colgara de la caja de la tira heredaría sus `transform` (la animación de
     * la sacudida de _rechazar y la de apertura), que convierten al ancestro en
     * bloque contenedor y romperían el `fixed` (medido: con el modal dentro, el
     * `fixed` se midió respecto de la caja y la ventana se iba al borde
     * equivocado). Al colgarla del body hay que volver a ponerle las variables
     * de color, que se inyectan en el contenedor; de eso se encarga
     * _aplicarColores(), que escribe en los dos sitios.
     *
     * @returns {HTMLElement|null} Raíz de la ventana, o null si no se pudo crear.
     */
    _crearModal() {
      if (this._modal) return this._modal;
      const self = this;

      const fondo = document.createElement('div');
      fondo.className = 'g-mapInfo-modal-fondo';

      const ventana = document.createElement('div');
      ventana.className = 'g-mapInfo-modal';
      ventana.setAttribute('role', 'dialog');
      ventana.setAttribute('aria-modal', 'true');
      ventana.setAttribute('aria-label', 'Proyección del visualizador');

      // Cabecera con el título y la X de cerrar.
      const cabecera = document.createElement('div');
      cabecera.className = 'g-mapInfo-modal-cabecera';
      const titulo = document.createElement('span');
      titulo.className = 'g-mapInfo-modal-titulo';
      titulo.textContent = 'Proyección del visualizador';
      const cerrarX = document.createElement('button');
      cerrarX.className = 'g-mapInfo-modal-cerrar';
      cerrarX.type = 'button';
      cerrarX.title = 'Cerrar';
      cerrarX.setAttribute('aria-label', 'Cerrar');
      cerrarX.textContent = '×';
      cabecera.appendChild(titulo);
      cabecera.appendChild(cerrarX);

      // Buscador, encima de la lista. Filtra por nombre o por código, que es
      // como se busca un sistema de coordenadas: por nombre ("UTM 30N") o por
      // número ("25830"). Con quince filas y todas a la vista no hacia falta,
      // pero en cuanto haya registradas unas cuantas por el alta automática, sí.
      const buscador = document.createElement('div');
      buscador.className = 'g-mapInfo-modal-buscador';
      const campoBuscar = document.createElement('input');
      campoBuscar.className = 'g-mapInfo-modal-campo g-mapInfo-modal-buscar';
      campoBuscar.type = 'search';
      campoBuscar.placeholder = 'Buscar por nombre o por código';
      campoBuscar.title = 'Escribe parte del nombre o el código del sistema de coordenadas';
      const cuenta = document.createElement('span');
      cuenta.className = 'g-mapInfo-modal-cuenta';
      buscador.appendChild(campoBuscar);
      buscador.appendChild(cuenta);

      // Lista de los sistemas de coordenadas utilizables, uno por fila, con un
      // radio por fila. Radio y no casilla porque solo puede haber uno en uso, y
      // el radio lo dice solo, sin ninguna línea que lo explique.
      const lista = document.createElement('div');
      lista.className = 'g-mapInfo-modal-lista';

      // La casilla de recorte, que estaba en la tira y ahora viene aquí con la
      // proyección a la que pertenece.
      const filaAlcance = document.createElement('label');
      filaAlcance.className = 'g-mapInfo-modal-fila g-mapInfo-modal-fila--casilla';
      const casillaAlcance = document.createElement('input');
      casillaAlcance.type = 'checkbox';
      casillaAlcance.className = 'g-mapInfo-casilla';
      casillaAlcance.checked = Boolean(this._recortar);
      const etiquetaAlcance = document.createElement('span');
      etiquetaAlcance.className = 'g-mapInfo-modal-etiqueta';
      etiquetaAlcance.textContent = 'Recortar el visualizador a la extensión de la proyección';
      filaAlcance.appendChild(casillaAlcance);
      filaAlcance.appendChild(etiquetaAlcance);

      // Alta de un EPSG que no está en la lista, en DOS pestañas:
      //
      //   - "Por código": se escribe el número y se busca la definición por red.
      //   - "Con proj4 o WKT": se pega la definición a mano.
      //
      // Antes esto era un window.prompt con el código y la definición en la misma
      // línea. Lo de las dos pestañas es porque son dos cosas distintas: una se
      // escribe un número y no hay que saber nada más; la otra la usa quien ya
      // tiene la definición, y para esa el prompt era especialmente incómodo
      // porque un WKT son varias líneas y no había dónde pegarlas.
      const alta = document.createElement('div');
      alta.className = 'g-mapInfo-modal-alta';
      const tituloAlta = document.createElement('span');
      tituloAlta.className = 'g-mapInfo-modal-subtitulo';
      tituloAlta.textContent = 'Añadir un EPSG que no esté en la lista';

      const pestanas = document.createElement('div');
      pestanas.className = 'g-mapInfo-modal-pestanas';
      pestanas.setAttribute('role', 'tablist');
      const botonPestanaCodigo = document.createElement('button');
      botonPestanaCodigo.className = 'g-mapInfo-modal-pestana g-mapInfo-modal-pestana--activa';
      botonPestanaCodigo.type = 'button';
      botonPestanaCodigo.setAttribute('role', 'tab');
      botonPestanaCodigo.textContent = 'Por código';
      const botonPestanaDef = document.createElement('button');
      botonPestanaDef.className = 'g-mapInfo-modal-pestana';
      botonPestanaDef.type = 'button';
      botonPestanaDef.setAttribute('role', 'tab');
      botonPestanaDef.textContent = 'Con proj4 o WKT';
      pestanas.appendChild(botonPestanaCodigo);
      pestanas.appendChild(botonPestanaDef);

      // --- Pestaña 1: buscar la definición por código.
      const panelCodigo = document.createElement('div');
      panelCodigo.className = 'g-mapInfo-modal-panel g-mapInfo-modal-panel--activo';
      panelCodigo.setAttribute('role', 'tabpanel');
      const explicacionCodigo = document.createElement('span');
      explicacionCodigo.className = 'g-mapInfo-modal-explicacion';
      explicacionCodigo.textContent = 'Se busca la definición del código en epsg.io y se registra sola. ' +
        'Hace falta conexión: si no la hay, o el código no existe, se avisa y no se registra nada.';
      const lineaCodigo = document.createElement('div');
      lineaCodigo.className = 'g-mapInfo-modal-linea';
      const campoCodigo = document.createElement('input');
      campoCodigo.className = 'g-mapInfo-modal-campo';
      campoCodigo.type = 'text';
      campoCodigo.placeholder = '2154 o EPSG:2154';
      campoCodigo.title = 'Código del sistema de coordenadas';
      const botonBuscar = document.createElement('button');
      botonBuscar.className = 'g-mapInfo-modal-boton g-mapInfo-modal-boton--anadir';
      botonBuscar.type = 'button';
      botonBuscar.textContent = 'Buscar y usar';
      lineaCodigo.appendChild(campoCodigo);
      lineaCodigo.appendChild(botonBuscar);
      panelCodigo.appendChild(explicacionCodigo);
      panelCodigo.appendChild(lineaCodigo);

      // --- Pestaña 2: pegar la definición a mano.
      const panelDef = document.createElement('div');
      panelDef.className = 'g-mapInfo-modal-panel';
      panelDef.setAttribute('role', 'tabpanel');
      panelDef.hidden = true;
      const explicacionAlta = document.createElement('span');
      explicacionAlta.className = 'g-mapInfo-modal-explicacion';
      explicacionAlta.textContent = 'Se admiten las proyecciones que se pueden calcular aquí ' +
        '(Mercator, Mercator Auxiliar, Transversal de Mercator y Cónica Conforme de Lambert). ' +
        'La definición puede ser una cadena proj4 o un WKT, y también puede ir con el código delante, separado por una barra vertical.';
      const camposAlta = document.createElement('div');
      camposAlta.className = 'g-mapInfo-modal-campos';
      const campoCodigoManual = document.createElement('input');
      campoCodigoManual.className = 'g-mapInfo-modal-campo';
      campoCodigoManual.type = 'text';
      campoCodigoManual.placeholder = 'EPSG:2154';
      campoCodigoManual.title = 'Código del sistema de coordenadas';
      const campoDefinicion = document.createElement('textarea');
      campoDefinicion.className = 'g-mapInfo-modal-definicion';
      campoDefinicion.rows = 3;
      campoDefinicion.placeholder = '+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs';
      campoDefinicion.title = 'Definición: cadena proj4 o WKT';
      camposAlta.appendChild(campoCodigoManual);
      camposAlta.appendChild(campoDefinicion);
      const botonAnadir = document.createElement('button');
      botonAnadir.className = 'g-mapInfo-modal-boton g-mapInfo-modal-boton--anadir';
      botonAnadir.type = 'button';
      botonAnadir.textContent = 'Añadir y usar';
      panelDef.appendChild(explicacionAlta);
      panelDef.appendChild(camposAlta);
      panelDef.appendChild(botonAnadir);

      // El aviso del alta (por qué no se ha registrado, o que ya está) va aquí, no
      // en un alert: la ventana ya está abierta y un alert encima tapa el campo
      // que hay que corregir.
      const avisoAlta = document.createElement('div');
      avisoAlta.className = 'g-mapInfo-modal-aviso';
      avisoAlta.setAttribute('role', 'status');

      alta.appendChild(tituloAlta);
      alta.appendChild(pestanas);
      alta.appendChild(panelCodigo);
      alta.appendChild(panelDef);
      alta.appendChild(avisoAlta);

      // Pie con el botón de cerrar.
      const pie = document.createElement('div');
      pie.className = 'g-mapInfo-modal-pie';
      const botonCerrar = document.createElement('button');
      botonCerrar.className = 'g-mapInfo-modal-boton';
      botonCerrar.type = 'button';
      botonCerrar.textContent = 'Cerrar';
      pie.appendChild(botonCerrar);

      ventana.appendChild(cabecera);
      ventana.appendChild(buscador);
      ventana.appendChild(lista);
      ventana.appendChild(filaAlcance);
      ventana.appendChild(alta);
      ventana.appendChild(pie);

      const raiz = document.createElement('div');
      raiz.className = 'g-mapInfo-modal-capa';
      raiz.hidden = true;
      raiz.appendChild(fondo);
      raiz.appendChild(ventana);

      this._modal = raiz;
      this._modalVentana = ventana;
      this._modalFondo = fondo;
      this._modalCampoBuscar = campoBuscar;
      this._modalCuenta = cuenta;
      this._modalLista = lista;
      this._modalCampoCodigo = campoCodigoManual;
      this._modalCampoDefinicion = campoDefinicion;
      this._modalAviso = avisoAlta;
      this._modalCampoCodigoBusqueda = campoCodigo;
      this._modalPanelCodigo = panelCodigo;
      this._modalPanelDef = panelDef;
      this._modalPestanaCodigo = botonPestanaCodigo;
      this._modalPestanaDef = botonPestanaDef;
      this._modalBotonBuscar = botonBuscar;
      this._modalCampoCodigoBusqueda = campoCodigo;
      this._casillaAlcance = casillaAlcance;
      this._etiquetaAlcance = etiquetaAlcance;
      this._cajaAlcance = filaAlcance;
      this._focoAlAbrir = botonAnadir;

      // Los tres caminos de cerrar: la X, el pie y el fondo. Y Escape, que se
      // escucha en la ventana porque se cierra con el teclado sin tener que
      // punzar nada.
      this._on(cerrarX, 'click', function () { this._cerrarModal(); }.bind(this));
      this._on(botonCerrar, 'click', function () { this._cerrarModal(); }.bind(this));
      this._on(fondo, 'click', function () { this._cerrarModal(); }.bind(this));
      this._on(document, 'keydown', function (ev) {
        if (ev.key !== 'Escape') return;
        if (!this._modal || this._modal.hidden) return;
        ev.preventDefault();
        this._cerrarModal();
      }.bind(this));

      // La lista: un change en la lista (delegado, no uno por fila) es lo que
      // aplica el cambio, porque las filas se rehacen cada vez que se registra
      // uno nuevo y con un listener por fila habría que volver a colgarlo todo.
      this._on(lista, 'change', function (ev) {
        const elegido = ev.target;
        if (!elegido || !elegido.value) return;
        self._cambiarProyeccion(elegido.value);
      });

      this._on(casillaAlcance, 'change', function () {
        this._recortar = Boolean(this._casillaAlcance.checked);
        this._aplicarAlcance(this._epsgActivo || this._crsDelVisor().codigo);
      }.bind(this));

      this._on(botonAnadir, 'click', function () {
        this._altaEPSGDesdeModal();
      }.bind(this));

      // Las dos pestañas del alta. Se cambian con un solo método para que el
      // marcado y el panel no se puedan desincronizar, que es lo que pasa si cada
      // pestaña escribe en las dos cosas por su cuenta.
      this._on(botonPestanaCodigo, 'click', function () {
        this._verPestanaAlta('codigo');
      }.bind(this));
      this._on(botonPestanaDef, 'click', function () {
        this._verPestanaAlta('definicion');
      }.bind(this));

      // El buscador filtra mientras se escribe. Con `input`, no con `change`:
      // filtrar es de leer, no de confirmar.
      this._on(campoBuscar, 'input', function () {
        this._filtrarProyecciones();
      }.bind(this));

      this._on(botonBuscar, 'click', function () {
        this._buscarEPSGPorCodigo();
      }.bind(this));

      // El campo de la definición manda con Enter, que es lo que se espera de un
      // campo de texto; el textarea lo reserva para los saltos de línea, que en
      // un WKT pueden ser necesarios.
      this._on(campoCodigoManual, 'keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          this._altaEPSGDesdeModal();
        }
      }.bind(this));
      this._on(campoCodigo, 'keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          this._buscarEPSGPorCodigo();
        }
      }.bind(this));

      try {
        document.body.appendChild(raiz);
      } catch (e) {
        console.warn(`${this.name}: no se pudo colgar la ventana modal.`, e);
        this._modal = null;
        return null;
      }

      // La ventana nace con los mismos colores que la lectura, aunque todavía no
      // se haya llamado a _aplicarColores() (si no, abrirla antes de que el
      // contenedor existiera la dejaría con los colores de reserva).
      this._aplicarColores();
      this._rellenarProyecciones();
      return raiz;
    }

    /**
     * Abre o cierra la ventana modal, según esté.
     *
     * El alternar y no dos métodos separados es porque el caso real es el del
     * segundo toque: la acción de abrir es el botón y la de cerrar es todo lo
     * demás, y un solo camino para la condición "está abierta o no" evita que se
     * queden desincronizados.
     */
    _alternarModal() {
      if (!this._modal) return;
      if (this._modal.hidden) this._abrirModal();
      else this._cerrarModal();
    }

    /**
     * Abre la ventana, con la lista al día y el foco dentro.
     */
    _abrirModal() {
      if (!this._modal) return;
      this._rellenarProyecciones();
      this._modal.hidden = false;
      // Sin esta clase la ventana aparece ya en su sitio y el cambio se ve como
      // un parpadeo; con ella se pinta desde la escala y la opacidad de 0 (ver
      // .g-mapInfo-modal-capa en el CSS).
      this._modal.classList.add('g-mapInfo-modal-capa--visible');
      // El foco va a la lista, que es lo que se viene a cambiar, y no al primer
      // campo: si fuera el alta, con solo pulsar Enter no se registraría nada
      // porque no hay nada escrito.
      const activo = this._modal.querySelector('.g-mapInfo-modal-lista input:checked');
      if (activo) activo.focus();
      else if (this._modalCampoCodigo) this._modalCampoCodigo.focus();
    }

    /**
     * Cierra la ventana y devuelve el foco al botón, que es lo que la abrió.
     */
    _cerrarModal() {
      if (!this._modal || this._modal.hidden) return;
      this._modal.hidden = true;
      this._modal.classList.remove('g-mapInfo-modal-capa--visible');
      if (this._selector && typeof this._selector.focus === 'function') {
        try { this._selector.focus(); } catch (e) { /* silencioso */ }
      }
    }

    /**
     * Muestra una de las dos pestañas del alta.
     * @param {string} cual 'codigo' o 'definicion'.
     */
    _verPestanaAlta(cual) {
      if (!this._modal) return;
      const codigo = (cual !== 'definicion');
      this._modalPanelCodigo.hidden = !codigo;
      this._modalPanelCodigo.classList.toggle('g-mapInfo-modal-panel--activo', codigo);
      this._modalPanelDef.hidden = codigo;
      this._modalPanelDef.classList.toggle('g-mapInfo-modal-panel--activo', !codigo);
      this._modalPestanaCodigo.classList.toggle('g-mapInfo-modal-pestana--activa', codigo);
      this._modalPestanaDef.classList.toggle('g-mapInfo-modal-pestana--activa', !codigo);
      this._modalPestanaCodigo.setAttribute('aria-selected', codigo ? 'true' : 'false');
      this._modalPestanaDef.setAttribute('aria-selected', codigo ? 'false' : 'true');
      this._avisoAlta('', '');
    }

    /**
     * Filtra la lista de proyecciones por lo que haya en el buscador.
     *
     * Se filtran las filas ya pintadas en vez de volver a hacer la lista: la lista
     * sale de _leerProyecciones(), que es una comprobación cara (pregunta por
     * transformaciones), y no tiene sentido repetirla con cada tecla. Las filas
     * que no salen se esconden con la propiedad `hidden` en vez de quitarse del
     * DOM, para que al borrar el texto vuelvan a aparecer sin más.
     */
    _filtrarProyecciones() {
      if (!this._modalLista) return;
      const texto = this._modalCampoBuscar
        ? String(this._modalCampoBuscar.value || '').trim().toLowerCase()
        : '';
      const filas = this._modalLista.querySelectorAll('.g-mapInfo-modal-fila');
      let visibles = 0;
      let total = 0;
      Array.prototype.slice.call(filas).forEach(function (fila) {
        // La fila de la casilla no cuenta: no es una proyección, y si contara el
        // contador decía "7 de 14" con catorce en la lista.
        if (fila.classList.contains('g-mapInfo-modal-fila--casilla')) return;
        total++;
        const coincide = !texto || fila.textContent.toLowerCase().indexOf(texto) !== -1;
        fila.hidden = !coincide;
        if (coincide) visibles++;
      });
      // El contador es lo que hace que se entienda que la lista se está filtrando:
      // sin él, con "UTM" escrito y dos filas, no se sabe si es eso todo.
      if (this._modalCuenta) {
        this._modalCuenta.textContent = texto ? visibles + ' de ' + total : '';
      }
    }

    /**
     * Busca la definición de un EPSG por su código y lo registra.
     *
     * Pide la definición a epsg.io, que es el único sitio de los medidos que
     * sirve la cadena proj4 con la cabecera que permite leerla desde el navegador
     * (medido: https://epsg.io/2154.proj4 contesta 200 con
     * "+proj=lcc +lat_0=46.5 +lon_0=3 ..." y con CORS; en cambio el servicio de
     * definiciones del OGC y api.proj4.org no lo hacen y la petición se muere).
     *
     * Con la definición en la mano el camino es el de siempre, _registrarEPSG(), y
     * pasa por las mismas cuentas y la misma comprobación de ida y vuelta.
     *
     * El botón se deshabilita mientras está la petición para que no se pueda
     * pulsar veinte veces y veinte respuestas.
     */
    _buscarEPSGPorCodigo() {
      const self = this;
      const bruto = this._modalCampoCodigoBusqueda
        ? String(this._modalCampoCodigoBusqueda.value || '').trim()
        : '';
      const codigo = this._normalizarCodigoEPSG(bruto);
      if (!codigo) {
        this._avisoAlta('Escribe un código, por ejemplo 2154 o EPSG:2154.', 'error');
        return;
      }
      // Si el código ya está en la lista no hace falta ir a por la definición: se
      // aplica directamente, que es lo que quiere quien escribe uno que ya sale.
      const enLista = this._proyecciones.some(function (p) { return p.codigo === codigo; });
      if (enLista) {
        // El aviso se limpia antes de aplicar: si el cambio va bien no hay nada
        // que avisar, y si falla `_cambiarProyeccion` pone el suyo.
        this._avisoAlta('', '');
        this._cambiarProyeccion(codigo);
        this._rellenarProyecciones();
        return;
      }

      const numero = codigo.replace('EPSG:', '');
      const boton = this._modalBotonBuscar;
      if (boton) boton.disabled = true;
      this._avisoAlta('Buscando ' + numero + '…');

      if (typeof window.fetch !== 'function') {
        if (boton) boton.disabled = false;
        this._avisoAlta('Este navegador no tiene fetch, así que no se puede buscar. ' +
          'Se puede pegar la definición en la otra pestaña.', 'error');
        return;
      }

      window.fetch(SERVICIO_DEFINICIONES_PROJ4 + numero + '.proj4')
        .then(function (r) {
          if (!r.ok) throw new Error('el servicio ha contestado ' + r.status);
          return r.text();
        })
        .then(function (texto) {
          const definicion = String(texto || '').trim();
          if (!definicion) throw new Error('definición vacía');
          if (boton) boton.disabled = false;
          if (self._modalCampoCodigoBusqueda) self._modalCampoCodigoBusqueda.value = '';
          self._registrarEPSG(codigo, definicion);
        })
        .catch(function (e) {
          if (boton) boton.disabled = false;
          self._avisoAlta('No se ha podido buscar ' + numero + ': ' +
            ((e && e.message) ? e.message : 'sin conexión') +
            '. Se puede pegar la definición en la otra pestaña.', 'error');
        });
    }

    /**
     * Normaliza lo que se escribe en el campo del código a "EPSG:n".
     * @param {string} texto Texto escrito.
     * @returns {string} Código normalizado, o '' si no parece un código.
     */
    _normalizarCodigoEPSG(texto) {
      const limpio = String(texto || '').trim()
        .replace(/^(epsg\s*:?\s*|urn:ogc:def:crs:epsg::?)/i, '');
      if (!/^\d+$/.test(limpio)) return '';
      return 'EPSG:' + limpio;
    }

    /**
     * Nombre de un sistema a partir de su definición, para el rótulo de la lista.
     *
     * Del WKT sale el nombre, que es lo que se usa (`PROJCS.name`, y el método de
     * la API es justo el que lo da). De una cadena proj4 no hay nombre, así que
     * se compone con lo que sí aparece: el código y el método. Es más útil en la
     * lista que el número pelado, y sobre todo evita que dos filas se lean igual.
     * @param {string} definicion Cadena proj4 o WKT.
     * @param {string} numero Código sin el prefijo ("2154").
     * @returns {string} Nombre, o el código si no hay nada mejor.
     */
    _nombreDeLaDefinicion(definicion, numero) {
      if (definicion.indexOf('PROJCS') === 0 || definicion.indexOf('GEOGCS') === 0) {
        try {
          const IDEE = api();
          if (IDEE && IDEE.utils && typeof IDEE.utils.parseCRSWKTtoJSON === 'function') {
            const json = IDEE.utils.parseCRSWKTtoJSON(definicion);
            if (json && json.PROJCS && json.PROJCS.name) return String(json.PROJCS.name);
            if (json && json.GEOGCS && json.GEOGCS.name) return String(json.GEOGCS.name);
          }
        } catch (e) {
          /* sin nombre: se cae al código con el método */
        }
      }
      const metodo = /\+proj=([a-z0-9_]+)/i.exec(definicion);
      if (metodo) return 'EPSG:' + numero + ' (' + metodo[1] + ')';
      return 'EPSG:' + numero;
    }

    /**
     * Alta de un EPSG desde la ventana, con los dos campos.
     *
     * Acepta las dos formas: código en su campo y definición en el textarea, o
     * las dos cosas juntas en el textarea separadas por una barra vertical, que
     * es como se daba antes con el window.prompt. Se admiten las dos porque un
     * WKT copiado de un sitio cualquiera ya viene con el código dentro del
     * nombre, y obligar a separarlo a mano era un paso que no hacía falta.
     */
    _altaEPSGDesdeModal() {
      if (!this._modalCampoCodigo || !this._modalCampoDefinicion) return;
      let codigo = String(this._modalCampoCodigo.value || '').trim();
      let definicion = String(this._modalCampoDefinicion.value || '').trim();

      // Código y definición juntos en el campo de la definición. La barra tiene que
      // estar en algún sitio del texto (no solo al principio): un WKT copiado de
      // un sitio cualquiera viene con el código detrás del nombre, y quien pega
      // solo tiene que cambiar el separador.
      const barra = definicion.indexOf('|');
      if (barra > 0) {
        const posibleCodigo = definicion.slice(0, barra).trim();
        if (posibleCodigo && !codigo) {
          codigo = posibleCodigo;
          definicion = definicion.slice(barra + 1).trim();
        }
      }

      if (!codigo || !definicion) {
        this._avisoAlta('Falta el código o la definición.', 'error');
        return;
      }
      this._avisoAlta('', '');
      this._registrarEPSG(codigo, definicion);
    }

    /**
     * Escribe un aviso en el alta, y deja el modal como estaba si el alta va bien.
     * @param {string} texto Texto del aviso ('' lo borra).
     * @param {string} [tipo] 'error' o 'ok'.
     */
    _avisoAlta(texto, tipo) {
      if (!this._modalAviso) return;
      this._modalAviso.textContent = texto || '';
      this._modalAviso.className = 'g-mapInfo-modal-aviso'
        + (tipo ? ' g-mapInfo-modal-aviso--' + tipo : '');
    }

    /**
     * Crea uno de los dos campos editables de la lectura.
     *
     * Se usa type="text" y no type="number" a propósito: el primero deja
     * escribir lo que la API formatea en español ("44.248") y lo normaliza
     * este plugin, mientras que el segundo descarta en silencio lo que no
     * entiende y trae problemas con el separador decimal según el navegador.
     * El teclado numérico en móvil lo aporta inputmode.
     *
     * El contenedor ya no es una región viva (aria-live): ahora contiene
     * controles de formulario, y una región viva no debe anunciar en cada
     * fotograma de un desplazamiento. Cada campo lleva su propia etiqueta.
     * @param {string} nombre Etiqueta accesible del campo.
     * @returns {HTMLInputElement} Campo creado.
     */
    _crearCampo(nombre) {
      const campo = document.createElement('input');
      campo.type = 'text';
      campo.className = 'g-mapInfo-valor g-mapInfo-campo';
      campo.inputMode = 'decimal';
      campo.autocomplete = 'off';
      campo.spellcheck = false;
      campo.size = ANCHO_CARACTERES;
      campo.value = '-';
      campo.setAttribute('aria-label', nombre);
      campo.title = 'Pulsa para escribirlo a mano. Intro aplica, Escape cancela.';

      // Al pulsar se entra en edición; al perder el foco se aplica (o se
      // descarta, si antes se pulsó Escape).
      this._on(campo, 'focus', function () { this._alEntrarEnEdicion(campo); }.bind(this));
      this._on(campo, 'blur', function () { this._alPerderFoco(campo); }.bind(this));
      this._on(campo, 'keydown', function (ev) { this._alPulsarTecla(campo, ev); }.bind(this));

      return campo;
    }

    /**
     * Escribe un valor en un nodo sin repetir el texto (evita reflows).
     * @param {HTMLElement} nodo Nodo destino.
     * @param {string} texto Texto a escribir.
     */
    _pintar(nodo, texto) {
      if (!nodo || nodo.textContent === texto) return;
      nodo.textContent = texto;
    }

    /**
     * Escribe el contenido de uno de los dos campos editables.
     *
     * Si el campo se está editando no se toca: si no, cada refresco del mapa
     * (y hay uno por cada cambio de la vista) le borraría al usuario lo que
     * acaba de teclear, con la sensación de que el campo no acepta el teclado.
     * @param {HTMLInputElement} campo Campo destino.
     * @param {string} texto Texto a escribir.
     */
    _pintarCampo(campo, texto) {
      if (!campo) return;
      if (campo === this._campoEditando) return;
      if (campo.value === texto) return;
      campo.value = texto;
    }

    /**
     * Convierte lo que ha escrito el usuario en un número.
     *
     * Tiene que deshacer dos cosas: el formato español con punto de millar
     * ("44.248", que es lo que pinta este mismo plugin) y la costumbre de
     * escribir la escala como cociente ("1:50000" o "1 : 50.000"). Con un
     * punto delante puede ser un millar o un decimal, y se decide por la forma:
     * si el texto encaja en d{1,3}(.d{3})+ son millares; si no, decimal.
     * @param {string} texto Texto escrito por el usuario.
     * @returns {number|null} El número, o null si no hay uno válido.
     */
    _parsearNumero(texto) {
      if (typeof texto !== 'string') return null;
      let t = texto.trim();
      if (!t) return null;

      // "1 : 50.000", que es como la propia lectura presenta la escala.
      const cociente = /^1\s*[:/]\s*(\d.*)$/.exec(t);
      if (cociente) t = cociente[1];

      // Se quitan espacios (tb. los finos) y apóstrofos de millar.
      t = t.replace(/[\s\u00a0\u202f']/g, '');

      // "50000:1" también vale.
      const reves = /^(\d[\d.]*):1$/.exec(t);
      if (reves) t = reves[1];

      // La unidad que la lectura escribe en 3D ("5200 m"): si el usuario
      // selecciona el valor y pulsa Intro sin más, tiene que contar como válido.
      t = t.replace(/m$/i, '');

      const millares = /^\d{1,3}(\.\d{3})+$/.test(t);
      const decimal = /^\d+([.,]\d+)?$/.test(t);

      let n;
      if (millares) {
        n = Number(t.replace(/\./g, ''));
      } else if (decimal) {
        n = Number(t.replace(',', '.'));
      } else {
        // 'abc', '-', '1e12': aquí no se admiten notaciones raras.
        return null;
      }
      return isFinite(n) ? n : null;
    }

    /**
     * Rango de zoom con el que se acota lo que se escribe.
     *
     * Se pregunta primero a la vista de OL y después al facade de la API, que
     * es el que se usa de reserva. El tope de arriba sí es de fiar en los dos
     * sitios (28 en estos mapas), y es donde está el riesgo real de escribir
     * 999999.
     *
     * El de abajo NO lo es, y conviene saberlo: getMinZoom() devuelve 0 tanto
     * en la vista como en el facade, pero escribir 0 no deja el mapa en 0, lo
     * deja en 2,32, que es su mínimo real y lo impone la lista de resoluciones
     * por dentro, no el atributo. Como getResolutions() tampoco está publicado,
     * ese suelo no se puede leer de antemano. No pasa nada: se acota a lo que
     * diga el atributo, la vista corrige sola y, como el refresco escucha a la
     * vista, el campo acaba enseñando el 2,32 de verdad.
     *
     * Y el rango se devuelve desplazado al nivel sobre el suelo que pinta este
     * plugin, con el mismo desvío que usa _zoomDeResolucion(): los atributos de
     * la vista son del nivel de OpenLayers, que va por el plano de la
     * proyección, y entre uno y otro está el estiramiento de Mercator.
     * @returns {{min: number, max: number}} Rango leído de la vista o de la API.
     */
    _rangoZoom() {
      let min = null;
      let max = null;
      const mapa = this._map;

      try {
        const vista = this._vistaOL();
        if (vista) {
          if (typeof vista.getMinZoom === 'function') {
            const v = Number(vista.getMinZoom());
            if (isFinite(v)) min = v;
          }
          if (typeof vista.getMaxZoom === 'function') {
            const v = Number(vista.getMaxZoom());
            if (isFinite(v)) max = v;
          }
        }
      } catch (e) {
        /* se prueba con la API */
      }

      if (min === null || max === null) {
        try {
          if (min === null && mapa && typeof mapa.getMinZoom === 'function') {
            const v = Number(mapa.getMinZoom());
            if (isFinite(v)) min = v;
          }
          if (max === null && mapa && typeof mapa.getMaxZoom === 'function') {
            const v = Number(mapa.getMaxZoom());
            if (isFinite(v)) max = v;
          }
        } catch (e) {
          /* valores por defecto */
        }
      }

      // El rango se desplaza con el mismo desvío que el nivel. Los atributos
      // minZoom/maxZoom de la vista son del nivel de OpenLayers, que es el del
      // plano de la proyección, mientras que aquí el nivel es sobre el suelo; a
      // 43 grados esa diferencia es de 0,46 y sin corregir el campo rechazaría
      // como demasiado alto un nivel que la vista admite de sobra.
      const factor = this._factorProyeccion(this._vistaOL());
      const desvío = (factor !== null && factor > 0) ? -Math.log(factor) / Math.LN2 : 0;

      return {
        min: (min === null) ? 0 : min + desvío,
        max: (max === null) ? 28 : max + desvío,
      };
    }

    /**
     * Acota un valor a un rango.
     * @param {number} valor Valor pedido.
     * @param {number} min Mínimo admitido.
     * @param {number} max Máximo admitido.
     * @returns {number|null} El valor acotado, o null si no es un número.
     */
    _acotar(valor, min, max) {
      if (!isFinite(valor)) return null;
      let n = valor;
      if (isFinite(min) && n < min) n = min;
      if (isFinite(max) && n > max) n = max;
      return n;
    }

    /**
     * Último número que el plugin ha calculado para un campo, para poder
     * escalonar con las flechas partiendo de él.
     * @param {HTMLInputElement} campo Campo de la lectura.
     * @returns {number|null} El número, o null si no se sabe.
     */
    _valorNumerico(campo) {
      if (campo === this._elValor) return this._ultimoPrincipal;
      if (campo === this._elUnidad) return this._ultimoEscala;
      return null;
    }

    // ---------------------------------------------------------------------
    // EDICIÓN A MANO
    // ---------------------------------------------------------------------

    /**
     * El usuario ha pulsado dentro de un campo: se selecciona todo el texto
     * para que al escribir se sustituya la lectura en lugar de añadirse.
     * @param {HTMLInputElement} campo Campo enfocado.
     */
    _alEntrarEnEdicion(campo) {
      if (!campo || this._campoEditando === campo) return;
      this._campoEditando = campo;
      // Se apunta con qué texto se entra, porque lo que se pinta es la escala
      // del SUELO y no la del plano: si alguien selecciona el valor y pulsa
      // Intro sin escribir nada, aplicarlo no debe cambiar la escala. Por eso
      // se compara con el texto de entrada antes de decidir que no hay nada
      // que aplicar.
      this._textoAlEntrar = campo.value;
      campo.classList.add('g-mapInfo-campo--editando');
      try {
        campo.select();
      } catch (e) {
        /* silencioso */
      }
    }

    /**
     * Teclado dentro de un campo: Intro aplica, Escape deshace y las flechas
     * escalonan de valor en valor (con Alt, de diez en diez).
     * @param {HTMLInputElement} campo Campo enfocado.
     * @param {KeyboardEvent} ev Evento de teclado.
     */
    _alPulsarTecla(campo, ev) {
      if (!campo || !ev) return;
      const tecla = ev.key;
      if (tecla === 'Escape') {
        ev.preventDefault();
        this._descartar = campo;
        try { campo.blur(); } catch (e) { /* silencioso */ }
        return;
      }
      if (tecla === 'Enter') {
        ev.preventDefault();
        // Quitar el foco es lo que dispara la confirmación; se centraliza ahí
        // para no tener dos caminos distintos al mismo sitio.
        try { campo.blur(); } catch (e) { /* silencioso */ }
        return;
      }
      if (tecla === 'ArrowUp' || tecla === 'ArrowDown') {
        const salto = ev.altKey ? 10 : 1;
        const escrito = this._parsearNumero(campo.value);
        const base = (escrito === null) ? this._valorNumerico(campo) : escrito;
        if (base === null) return;
        ev.preventDefault();
        campo.value = String(base + ((tecla === 'ArrowUp') ? salto : -salto));
        try {
          const fin = campo.value.length;
          campo.setSelectionRange(fin, fin);
        } catch (e) {
          /* silencioso */
        }
      }
    }

    /**
     * El campo ha perdido el foco: se aplica lo escrito, salvo que el usuario
     * haya pulsado Escape antes.
     * @param {HTMLInputElement} campo Campo que pierde el foco.
     */
    _alPerderFoco(campo) {
      if (!campo) return;
      const descartado = (this._descartar === campo);
      this._descartar = null;
      this._cerrarEdicion(campo, !descartado);
    }

    /**
     * Termina la edición de un campo y repinta la lectura.
     * @param {HTMLInputElement} campo Campo editado.
     * @param {boolean} aplicar true para aplicar lo escrito, false para
     *   dejarlo como estaba.
     */
    _cerrarEdicion(campo, aplicar) {
      if (!campo) return;
      const sinCambiar = (campo.value === this._textoAlEntrar);
      if (aplicar && !sinCambiar) this._aplicarTexto(campo, campo.value);
      if (this._campoEditando === campo) {
        this._campoEditando = null;
        this._textoAlEntrar = null;
        campo.classList.remove('g-mapInfo-campo--editando');
      }
      this._actualizar();
    }

    /**
     * Traduce el texto de un campo a la acción que corresponde sobre el mapa.
     * @param {HTMLInputElement} campo Campo editado.
     * @param {string} texto Texto escrito por el usuario.
     */
    _aplicarTexto(campo, texto) {
      const numero = this._parsearNumero(texto);
      if (numero === null) {
        this._rechazar(campo);
        return;
      }
      if (campo === this._elValor) {
        this._aplicarPrincipal(numero);
      } else if (campo === this._elUnidad) {
        this._aplicarEscala(numero);
      }
    }

    /**
     * Aplica el dato principal: el nivel de zoom en 2D, la altura de la
     * cámara en 3D.
     * @param {number} numero Valor pedido.
     */
    _aplicarPrincipal(numero) {
      if (this._es3D(this._map)) {
        const metros = this._acotar(numero, ALTURA_MINIMA, ALTURA_MAXIMA);
        if (metros === null) {
          this._rechazar(this._elValor);
          return;
        }
        this._fijarAlturaCamara(metros);
        return;
      }
      const rango = this._rangoZoom();
      const nivel = this._acotar(numero, rango.min, rango.max);
      if (nivel === null) {
        this._rechazar(this._elValor);
        return;
      }
      this._irAZoom(nivel);
    }

    /**
     * Lleva la escala 1:n a la que se le escriba.
     * @param {number} numero Denominador pedido.
     */
    _aplicarEscala(numero) {
      const escala = this._acotar(numero, ESCALA_MINIMA, ESCALA_MAXIMA);
      if (escala === null) {
        this._rechazar(this._elUnidad);
        return;
      }
      this._irAEscala(escala);
    }

    /**
     * Lleva la vista a un nivel de zoom con transición.
     *
     * Un salto de golpe al escribir un número queda muy brusco, así que se
     * anima con la propia vista de OpenLayers (view.animate), que trae una
     * curva easeOut suave y además cancela la animación anterior si el usuario
     * escribe otra cosa mientras corre.
     *
     * map.setZoom() se deja como recurso: si no hay vista (3D), o si la
     * resolución no se puede calcular, o si animate() no existe en esta versión
     * de la API, se va directo a él.
     * @param {number} nivel Nivel de zoom pedido.
     */
    _irAZoom(nivel) {
      const vista = this._vistaOL();
      // Se anima la RESOLUCIÓN y no el zoom. No es un cambio de estilo: si se
      // animara el zoom, OpenLayers lo interpretaría con SU cuenta (la del plano
      // de la proyección) y el número que se está escribiendo no sería el que
      // acaba poniendo. Animando la resolución es la cuenta inversa exacta de la
      // que se lee, que es lo que hace falta para que el campo y el mapa no se
      // contradigan.
      const resolucion = vista
        ? this._resolucionDeZoom(nivel, this._factorProyeccion(vista), vista)
        : null;
      if (vista && typeof vista.animate === 'function' && resolucion !== null) {
        try {
          vista.animate({ resolution: resolucion, duration: DURACION_TRANSICION });
          return;
        } catch (e) {
          /* se prueba con la API */
        }
      }
      try {
        if (this._map && typeof this._map.setZoom === 'function') {
          this._map.setZoom(nivel);
        }
      } catch (e) {
        this._rechazar(this._elValor);
      }
    }

    /**
     * Lleva la vista a una escala 1:n con transición.
     *
     * No se usa map.setToClosestScale() porque salta y no devuelve nada, y
     * porque aquí ya está el dato: la resolución que corresponde a una escala
     * la da _resolucionDeEscala(). Con eso se anima la resolución, que es lo
     * que la vista sabe interpolar.
     *
     * El número que se escribe es la escala sobre el suelo, la misma que se
     * pinta, así que en 2D la resolución sale con el factor de la proyección
     * puesto. En 3D no hay vista que animar y la escala es una distancia real,
     * así que se convierte a altura de cámara (_alturaParaEscala3D) y se aplica
     * por la misma vía que la altura.
     * @param {number} escala Denominador pedido, sobre el suelo.
     */
    _irAEscala(escala) {
      // En 3D no hay vista de OL que animar: se cambia la altura de la cámara,
      // que es el equivalente de la escala ahí.
      if (this._es3D(this._map)) {
        const altura = this._alturaParaEscala3D(escala);
        if (altura === null) {
          this._rechazar(this._elUnidad);
          return;
        }
        this._fijarAlturaCamara(this._acotar(altura, ALTURA_MINIMA, ALTURA_MAXIMA));
        return;
      }
      // Lo que se escribe es la escala sobre el suelo, la misma que se pinta,
      // así que la resolución equivalente sale con _resolucionDeEscala().
      const resolucion = this._resolucionDeEscala(escala);
      const vista = this._vistaOL();
      if (!vista || typeof vista.animate !== 'function' || resolucion === null) {
        // Vía de reserva: la de la API. Aquí no hay vista, luego no hay factor
        // que aplicar, así que se le pasa el número tal cual. La API espera el
        // del plano y el nuestro es el del suelo, así que fuera del ecuador el
        // resultado se desvía; es el precio de una vía que en 2D no debería
        // llegar a usarse nunca, y se prefiere a dejar el mapa quieto.
        try {
          if (this._map && typeof this._map.setToClosestScale === 'function') {
            this._map.setToClosestScale(escala);
          }
        } catch (e) {
          this._rechazar(this._elUnidad);
        }
        return;
      }
      try {
        vista.animate({ resolution: resolucion, duration: DURACION_TRANSICION });
      } catch (e) {
        try {
          if (this._map && typeof this._map.setToClosestScale === 'function') {
            this._map.setToClosestScale(escala);
          }
        } catch (e2) {
          this._rechazar(this._elUnidad);
        }
      }
    }

    /**
     * Altura de la cámara que corresponde a una escala 1:n en 3D.
     *
     * Se deduce de la propia fórmula que usa _escala3D(): metros por píxel =
     * escala * M_POR_PX, y a la vez = 2 * altura * tan(fov/2) / alto_del_lienzo.
     * Despejando la altura queda lo de abajo. Se invierte así, y no llamando a
     * setToClosestScale(), porque la fórmula de lectura es nuestra y es la que
     * garantiza que escribir lo que se lee deja lo que se lee.
     * @param {number} escala Denominador 1:n sobre el suelo.
     * @returns {number|null} Altura en metros, o null si falta la escena.
     */
    _alturaParaEscala3D(escala) {
      try {
        const escena = this._escenaCesium();
        if (!escena || !escena.camera) return null;
        let fov = FOV_POR_DEFECTO;
        if (escena.camera.frustum && isFinite(escena.camera.frustum.fov)) {
          fov = escena.camera.frustum.fov;
        }
        const lienzo = escena.canvas;
        let alto = (lienzo && lienzo.clientHeight) ? lienzo.clientHeight : 0;
        if (!alto && escena.container && escena.container.clientHeight) {
          alto = escena.container.clientHeight;
        }
        if (!alto || !isFinite(alto) || alto <= 0) return null;
        const altura = (escala * M_POR_PX * alto) / (2 * Math.tan(fov / 2));
        return (isFinite(altura) && altura > 0) ? altura : null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Lleva la cámara de Cesium a una altura sobre el elipsoide.
     *
     * Conserva el rumbo y la inclinación: se relee la posición geodésica actual,
     * se cambia solo la altura y se vuelve a montar la cámara con la misma
     * orientación. Eso es lo que quiere quien escribe una altura (acercar o
     * alejar sin perder de vista a dónde mira), y no que la cámara se gire de
     * golpe al norte. Por eso se usa camera.setView() con orientation en vez
     * de tocar camera.position: setView() trabaja en coordenadas de mundo,
     * que es donde están las coordenadas geodésicas, y respeta el marco de
     * referencia que pueda tener la escena.
     *
     * OJO con la firma de Cesium: Cartesian3.fromRadians() NO admite un
     * Cartographic entero, sino longitud, latitud y altura sueltas. Pasándole
     * el objeto entero revienta con "Expected longitude to be typeof number,
     * actual typeof was object", el try se traga el error y la cámara se queda
     * donde estaba sin decir nada, que es como se vio el fallo.
     * @param {number} metros Altura pedida sobre el elipsoide.
     */
    _fijarAlturaCamara(metros) {
      const camara = this._camaraCesium();
      if (!camara) return;
      const Cesium = window.Cesium;
      if (!Cesium || !Cesium.Cartographic || !Cesium.Cartesian3 || !Cesium.Ellipsoid) {
        this._rechazar(this._elValor);
        return;
      }
      try {
        const elipsoide = this._elipsoideCesium(camara);
        const carto = Cesium.Cartographic.fromCartesian(camara.positionWC, elipsoide);
        if (!carto) {
          this._rechazar(this._elValor);
          return;
        }
        const destino = Cesium.Cartesian3.fromRadians(
          carto.longitude, carto.latitude, metros, elipsoide, new Cesium.Cartesian3()
        );
        camara.setView({
          destination: destino,
          orientation: { heading: camara.heading, pitch: camara.pitch, roll: camara.roll }
        });
      } catch (e) {
        this._rechazar(this._elValor);
      }
    }

    /**
     * Elipsoide con el que anda la escena de Cesium.
     *
     * Ni la cámara ni su frustum lo tienen (comprobado), así que se busca en el
     * globo y en la proyección del mapa antes de recurrir al WGS84, que es lo
     * que se usa siempre aquí.
     * @param {Object} camara Cámara de Cesium.
     * @returns {Object} Elipsoide de Cesium.
     */
    _elipsoideCesium(camara) {
      const Cesium = window.Cesium;
      const candidatas = [
        (camara && camara.frustum) ? camara.frustum.ellipsoid : null,
        (this._escenaCesium() || {}).globe,
        (this._escenaCesium() || {}).mapProjection,
        Cesium.Ellipsoid.WGS84
      ];
      for (let i = 0; i < candidatas.length; i++) {
        const elipsoide = candidatas[i] && candidatas[i].ellipsoid
          ? candidatas[i].ellipsoid : candidatas[i];
        if (elipsoide && typeof elipsoide.cartographicToCartesian === 'function') {
          return elipsoide;
        }
      }
      return Cesium.Ellipsoid.WGS84;
    }

    /**
     * Avisa de que lo escrito no vale y deja el campo como estaba.
     *
     * El mapa no se toca nunca en este camino, y es a propósito: la API no
     * valida y setToClosestScale('abc') deja el mapa con getZoom() === NaN,
     * es decir, sin resolución y sin manera de volver.
     * @param {HTMLElement} campo Elemento con un valor no válido. Vale igual
     *   para un campo de texto y para el selector de proyección, que es lo
     *   único más que se puede rechazar.
     */
    _rechazar(campo) {
      if (!campo) return;
      campo.classList.remove('g-mapInfo-rechazado');
      // Hay que forzar un reflow para que al volver a añadir la clase la
      // animación se ejecute otra vez en vez de no hacer nada.
      try { void campo.offsetWidth; } catch (e) { /* silencioso */ }
      campo.classList.add('g-mapInfo-rechazado');
      // Y un temporizador para quitar el aviso, que si se queda puesto parece
      // un resaltado permanente.
      if (this._timerRechazo) window.clearTimeout(this._timerRechazo);
      this._timerRechazo = window.setTimeout(function () {
        campo.classList.remove('g-mapInfo-rechazado');
      }, 700);
    }

    /**
     * Vista de OpenLayers, que es la que avisa de los cambios y la que sabe
     * animar el zoom. En Cesium no existe (getView() da undefined).
     * @returns {Object|null} Instancia de ol.View, o null en 3D.
     */
    _vistaOL() {
      try {
        const impl = this._impl();
        return (impl && typeof impl.getView === 'function') ? impl.getView() : null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Centro de la vista como pareja de coordenadas.
     *
     * Ojo con la forma: la vista de OpenLayers lo devuelve como ARRAY
     * [x, y], mientras que el facade de la API lo devuelve como {x, y}. Se
     * aceptan las dos, que este es justo el tipo de detalle que hace que un
     * plugin funcione en un sitio y no en otro.
     * @param {Object} vista Vista de OpenLayers.
     * @returns {Array<number>|null} [x, y], o null si no se puede leer.
     */
    _centroVista(vista) {
      try {
        if (!vista || typeof vista.getCenter !== 'function') return null;
        const centro = vista.getCenter();
        if (!centro) return null;
        if (centro.length === 2 && isFinite(centro[0]) && isFinite(centro[1])) {
          return [centro[0], centro[1]];
        }
        if (isFinite(centro.x) && isFinite(centro.y)) return [centro.x, centro.y];
        return null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Metros de SUELO por metro proyectado en el punto que se está mirando.
     *
     * Este es el número que hace que la escala valga para cualquier proyección,
     * y se le pregunta a la proyección en vez de calcularlo aquí. En EPSG:3857
     * sale coseno de la latitud, porque Mercator estira hacia los polos; en
     * EPSG:4326 sale el factor de latitud de los grados; en una proyección
     * cónica sería el del cono. No hay ni una fórmula de latitudes en el
     * plugin, que es lo que hacía fallar antes: arrancaba en 3857 y no cubría
     * las demás.
     *
     * La fórmula es la del ejemplo "Projection and Scale" de OpenLayers, que es
     * el patrón canónico para mantener la escala al cambiar de proyección:
     *
     *     const mpu = proyeccion.getMetersPerUnit();
     *     getPointResolution(proyeccion, 1 / mpu, centro, 'm') * mpu
     *
     * que es el número de metros de suelo por unidad proyectada. Si la
     * proyección no trae getPointResolutionFunc(), getPointResolution() ya
     * devuelve la resolución sin corregir, que es lo que hace OL también.
     *
     * En 3D no se usa: allí los metros por píxel salen de la geometría de la
     * cámara y ya son de suelo, sin proyección de por medio.
     * @param {Object} vista Vista de OpenLayers.
     * @returns {number|null} Factor, o null si no se puede calcular.
     */
    _factorProyeccion(vista) {
      try {
        if (!vista || typeof vista.getProjection !== 'function') return null;
        const proyeccion = vista.getProjection();
        if (!proyeccion) return null;
        const centro = this._centroVista(vista);
        if (centro === null) return null;

        const mpu = (typeof proyeccion.getMetersPerUnit === 'function')
          ? Number(proyeccion.getMetersPerUnit()) : 1;
        if (!isFinite(mpu) || mpu <= 0) return null;

        const ol = window.ol;
        let punto;
        if (ol && ol.proj && typeof ol.proj.getPointResolution === 'function') {
          punto = ol.proj.getPointResolution(proyeccion, 1 / mpu, centro, 'm');
        } else if (typeof proyeccion.getPointResolutionFunc === 'function') {
          // Reserva: la propia proyección trae su función, que es lo que
          // llama por dentro getPointResolution(), pero devuelve en las
          // unidades de la proyección, así que hay que pasarlas a metros.
          punto = Number(proyeccion.getPointResolutionFunc()(1 / mpu, centro)) * mpu;
        } else {
          punto = 1 / mpu;
        }
        const factor = Number(punto) * mpu;
        return (isFinite(factor) && factor > 0) ? factor : null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Resolución a la que corresponde el nivel de zoom 0, en metros de suelo.
     *
     *  Se pregunta primero a la vista, que es la que usa OpenLayers para su
     *  getZoom(), y solo si no contesta se cae al valor del ejemplo de OpenLayers
     *  (RESOLUCION_MAXIMA).
     * @param {Object} vista Vista de OpenLayers.
     * @returns {number} Resolución máxima.
     */
    _resolucionMaxima(vista) {
      try {
        if (vista && typeof vista.getMaxResolution === 'function') {
          const v = Number(vista.getMaxResolution());
          if (isFinite(v) && v > 0) return v;
        }
      } catch (e) {
        /* se usa el valor por defecto */
      }
      return RESOLUCION_MAXIMA;
    }

    /**
     * Nivel de zoom de una resolución de la vista.
     *
     *  La cuenta es la de OpenLayers, log2(maxResolution / resolución), pero con
     *  la resolución convertida a suelo mediante el factor de la proyección. La
     *  diferencia no es un detalle: la resolución de una vista va en las unidades
     *  de SU proyección, así que el número que sale sin el factor es un artefacto
     *  de estar en Mercator, y eso es justo lo que hacía que el nivel de zoom
     *  pareciera cambiar al cambiar de proyección.
     *
     *  En el ecuador el factor vale 1 y sale exactamente el getZoom() de la API
     *  (medido: los dos dan 13,342847 a 15,067 m/píxel), que es el mismo sitio
     *  donde la escala ya coincidía con ella. A 43 grados el nivel leído es 0,46
     *  más alto que el de la API, y ese 0,46 es ni más ni menos el estiramiento
     *  de Mercator, el mismo que ya se ve en la escala de la fila de al lado.
     * @param {number} resolucion Resolución de la vista, en sus unidades.
     * @param {number|null} factor Factor de _factorProyeccion().
     * @param {Object} vista Vista de OpenLayers.
     * @returns {number|null} Nivel de zoom, o null si no se puede.
     */
    _zoomDeResolucion(resolucion, factor, vista) {
      if (!isFinite(resolucion) || resolucion <= 0) return null;
      if (factor === null || !isFinite(factor) || factor <= 0) return null;
      const suelo = resolucion * factor;
      if (!isFinite(suelo) || suelo <= 0) return null;
      const nivel = Math.log(this._resolucionMaxima(vista) / suelo) / Math.LN2;
      return isFinite(nivel) ? nivel : null;
    }

    /**
     * Resolución de la vista que corresponde a un nivel de zoom.
     *
     *  Operación inversa de _zoomDeResolucion(), y hace falta por lo mismo que
     *  para la escala: escribir lo que se lee tiene que dejar lo que se lee.
     * @param {number} nivel Nivel de zoom pedido.
     * @param {number|null} factor Factor de _factorProyeccion().
     * @param {Object} vista Vista de OpenLayers.
     * @returns {number|null} Resolución de la vista, o null si no se puede.
     */
    _resolucionDeZoom(nivel, factor, vista) {
      if (!isFinite(nivel)) return null;
      if (factor === null || !isFinite(factor) || factor <= 0) return null;
      const suelo = this._resolucionMaxima(vista) / Math.pow(2, nivel);
      if (!isFinite(suelo) || suelo <= 0) return null;
      const resolucion = suelo / factor;
      return isFinite(resolucion) && resolucion > 0 ? resolucion : null;
    }

    /**
     * Nivel de zoom del visor en 2D.
     *
     *  El camino bueno es la cuenta sobre el suelo (_zoomDeResolucion). El de la
     *  API queda de reserva para cuando no haya vista de la que leerla.
     * @returns {number|null} Nivel de zoom, o null si no se puede leer.
     */
    _zoom2D() {
      const vista = this._vistaOL();
      let nivel = null;
      if (vista && typeof vista.getResolution === 'function') {
        nivel = this._zoomDeResolucion(Number(vista.getResolution()),
          this._factorProyeccion(vista), vista);
      }
      if (nivel !== null) return nivel;
      try {
        if (this._map && typeof this._map.getZoom === 'function') {
          const v = Number(this._map.getZoom());
          if (isFinite(v)) return v;
        }
      } catch (e) {
        /* sin nivel */
      }
      return null;
    }

    /**
     * Escala 1:n a la que lleva una resolución de la vista.
     *
     * Es el camino bueno, el que se usa siempre que haya vista, y no pasar por
     * la API a propósito. La razón es que la escala de la API es la resolución
     * dividida entre 0,0254/72 sin más, y la resolución de una vista va en las
     * unidades de SU proyección: en EPSG:3857 son metros y sale bien, pero en
     * EPSG:4326 son grados, y dividir grados entre el milímetro del píxel de la
     * API da un disparate. Pasando por la vista, las unidades sí se convierten
     * de verdad, porque el factor de proyección viene en las mismas unidades
     * que la resolución.
     *
     * La cuenta es la del ejemplo "Projection and Scale" de OpenLayers: la
     * resolución proyectada por los metros de suelo que mide un metro
     * proyectado, y al final dividido por el píxel de 72 dpi de la API (M_POR_PX)
     * para poder contrastar con ella.
     * @param {number} resolucion Resolución de la vista, en sus unidades.
     * @param {number|null} factor Factor de _factorProyeccion().
     * @returns {number|null} Escala 1:n del suelo, o null si no se puede.
     */
    _escalaDeResolucion(resolucion, factor) {
      if (!isFinite(resolucion) || resolucion <= 0) return null;
      if (factor === null || !isFinite(factor) || factor <= 0) return null;
      const escala = resolucion * factor / M_POR_PX;
      return (isFinite(escala) && escala > 0) ? escala : null;
    }

    /**
     * Resolución de la vista que corresponde a una escala 1:n.
     *
     * Operación inversa de _escalaDeResolucion(), y hace falta al escribir una
     * escala para que el número del campo y el que se lee coincidan: escribir
     * lo que se lee tiene que dejar lo que se lee. Sin esa vuelta el control se
     * contradecía a sí mismo.
     * @param {number} escala Escala 1:n del suelo, tal y como se pinta.
     * @returns {number|null} Resolución de la vista, o null si no se puede.
     */
    _resolucionDeEscala(escala) {
      if (!isFinite(escala) || escala <= 0) return null;
      const factor = this._factorProyeccion(this._vistaOL());
      // Sin factor se devuelve la cuenta plana, que es lo que hace OL cuando la
      // proyección no sabe corregirse. Peor que no corregir es no hacer nada.
      const resolucion = (factor === null ? escala * M_POR_PX : escala * M_POR_PX / factor);
      return (isFinite(resolucion) && resolucion > 0) ? resolucion : null;
    }

    /**
     * Refresca la lectura cuando cambia la vista de OpenLayers.
     *
     * Los eventos de la API (evt.MOVE) solo avisan de los gestos del usuario:
     * con map.setCenter() o map.setZoom() la lectura se queda obsoleta, y eso
     * se nota al volver de 3D, porque el cambio de implementación recentra el
     * mapa por código. La vista de OL sí notifica cualquier cambio de su
     * estado, venga de donde venga, así que se escucha directamente a ella.
     * En 3D no hay vista que escuchar (eso lo cubre la cámara).
     */
    _vigilarVistaOL() {
      try {
        const vista = this._vistaOL();
        if (!vista || typeof vista.addEventListener !== 'function') return;
        const self = this;
        const alCambiar = function () { self._actualizar(); };
        ['change:center', 'change:resolution', 'change:rotation'].forEach(function (tipo) {
          self._on(vista, tipo, alCambiar);
        });
      } catch (e) {
        /* los eventos de la API siguen vigilando; ver _onApi en addTo() */
      }
    }

    /**
     * Escala 1:n del punto mirado en 2D.
     *
     * Sale de la resolución de la vista y del factor de la proyección (ver
     * _escalaDeResolucion y _factorProyeccion), que es lo que hace que la
     * lectura cambie al desplazarse por el mapa y lo que hace que valga igual
     * en cualquier proyección. La escala de la API solo se usa de reserva,
     * para el caso raro de que no haya vista a la que preguntarle.
     * @returns {number|null} Denominador de la escala, o null si no hay dato.
     */
    _escala2D() {
      const vista = this._vistaOL();
      if (vista && typeof vista.getResolution === 'function') {
        let resolucion = null;
        try {
          resolucion = Number(vista.getResolution());
        } catch (e) {
          resolucion = null;
        }
        const escala = this._escalaDeResolucion(resolucion, this._factorProyeccion(vista));
        if (escala !== null) return escala;
      }
      // Reserva: la escala que publica la API, tal cual. Sin factor que aplicar
      // es su número del plano, que en el ecuador es el bueno.
      const map = this._map;
      if (!map) return null;
      try {
        if (typeof map.getExactScale === 'function') {
          const exacto = Number(map.getExactScale());
          if (isFinite(exacto) && exacto > 0) return exacto;
        }
      } catch (e) {
        /* se prueba el otro */
      }
      try {
        if (typeof map.getScale === 'function') {
          const escala = Number(map.getScale());
          if (isFinite(escala) && escala > 0) return escala;
        }
      } catch (e) {
        /* sin dato */
      }
      return null;
    }

    /**
     * Altura de la cámara de Cesium sobre el elipsoide, en metros.
     * @returns {number|null} Altura en metros, o null si no hay cámara.
     */
    _altura3D() {
      try {
        const camara = this._camaraCesium();
        if (!camara) return null;
        const altura = camara.positionCartographic.height;
        return isFinite(altura) ? altura : null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Escala 1:n del punto mirado en 3D.
     *
     * Con la cámara de Cesium, los metros por píxel del centro de la vista
     * son 2 * altura * tan(fov/2) / alto_del_lienzo, y la escala es esa
     * resolución dividida por el tamaño del píxel (M_POR_PX, los 72 dpi de la
     * API, para que 3D y 2D digan lo mismo). No se usa la proyección del
     * elipsoide porque la vista puede estar inclinada.
     *
     * Aquí no hay factor de proyección que aplicar, y no por descuido: los
     * metros por píxel salen de la geometría de la cámara y ya son una
     * distancia real sobre el terreno.
     * @returns {number|null} Denominador de la escala, o null si no hay dato.
     */
    _escala3D() {
      try {
        const escena = this._escenaCesium();
        if (!escena || !escena.camera) return null;
        const altura = this._altura3D();
        if (altura === null) return null;

        let fov = FOV_POR_DEFECTO;
        try {
          if (escena.camera.frustum && isFinite(escena.camera.frustum.fov)) {
            fov = escena.camera.frustum.fov;
          }
        } catch (e) {
          /* valor por defecto */
        }

        const lienzo = escena.canvas;
        let alto = (lienzo && lienzo.clientHeight) ? lienzo.clientHeight : 0;
        if (!alto && escena.container && escena.container.clientHeight) {
          alto = escena.container.clientHeight;
        }
        if (!alto) return null;

        const metrosPorPx = (2 * altura * Math.tan(fov / 2)) / alto;
        const escala = metrosPorPx / M_POR_PX;
        return isFinite(escala) && escala > 0 ? escala : null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Refresca los dos valores según la implementación activa.
     */
    _actualizar() {
      if (!this._container) return;
      const es3D = this._es3D(this._map);

      if (es3D) {
        this._pintar(this._elEtiqueta, 'Altura de la vista');
        const altura = this._altura3D();
        this._ultimoPrincipal = altura;
        this._etiquetarCampo(this._elValor, 'Altura de la cámara en metros');
        this._pintarCampo(this._elValor, (altura === null) ? '-'
          : this._formatear(altura) + ' m');
      } else {
        this._pintar(this._elEtiqueta, 'Nivel de zoom');
        const nivel = this._zoom2D();
        this._ultimoPrincipal = nivel;
        this._etiquetarCampo(this._elValor, 'Nivel de zoom');
        // Con punto decimal, como el control 'scale*true' de la API, para que
        // el nivel se lea igual que en los visizadores originales.
        this._pintarCampo(this._elValor, (nivel === null)
          ? '-' : Number(nivel).toFixed(2));
      }

      const escala = es3D ? this._escala3D() : this._escala2D();
      this._ultimoEscala = escala;
      this._etiquetarCampo(this._elUnidad, 'Denominador de la escala, 1 : n');
      this._pintarCampo(this._elUnidad, (escala === null) ? '-' : this._formatear(escala));

      // La segunda línea también depende de la implementación: el puntero se
      // lee de otra manera en 3D y el selector no se puede cambiar allí.
      this._ajustarSelector();
      this._pintarCoordenadas(this._punteroEnCola);
    }

    /**
     * Cambia la etiqueta accesible de un campo si ha cambiado de significado.
     * @param {HTMLInputElement} campo Campo a etiquetar.
     * @param {string} texto Etiqueta a poner.
     */
    _etiquetarCampo(campo, texto) {
      if (!campo) return;
      if (campo.getAttribute('aria-label') === texto) return;
      campo.setAttribute('aria-label', texto);
    }

    /**
     * Muestra u oculta la lectura.
     */
    _aplicarVisibilidad() {
      if (!this._container) return;
      this._container.style.display = this._visible ? '' : 'none';
    }

    // =====================================================================
    // ENLACE CON LA ESCENA DE CESIUM (3D)
    // =====================================================================

    /**
     * Devuelve la escena de Cesium, o null si todavía no existe.
     * @returns {Object|null} Escena de Cesium.
     */
    _escenaCesium() {
      const impl = this._impl();
      if (impl && impl.scene) return impl.scene;
      return null;
    }

    /**
     * Devuelve la cámara de Cesium, o null si todavía no existe.
     * @returns {Object|null} Cámara de Cesium.
     */
    _camaraCesium() {
      const escena = this._escenaCesium();
      return (escena && escena.camera) ? escena.camera : null;
    }

    /**
     * Espera a que aparezca la escena de Cesium y engancha el refresco a sus
     * cambios de cámara.
     *
     * El mapa se crea antes de que la escena exista (es lo que hace también
     * CentrarVistaInicial en mapas/LucesDeBohemia), así que un fallo en este
     * primer intento NO significa que no haya 3D: se reintenta hasta que
     * aparezca la escena o se agote la espera.
     */
    _vigilarCamara() {
      const camara = this._camaraCesium();
      if (!camara) {
        this._esperarEscena(0);
        return;
      }
      const self = this;
      const alCambiar = function () { self._actualizar(); };

      // 'changed' es el evento propio de Cesium para la cámara.
      try {
        if (camara.changed && typeof camara.changed.addEventListener === 'function') {
          camara.changed.addEventListener(alCambiar);
          this._listenersCesium.push({ tipo: 'changed', destino: camara.changed, fn: alCambiar });
        }
      } catch (e) {
        /* se intenta con postRender */
      }
      // Red de seguridad: si el evento de cámara no está disponible, se
      // refresca en cada fotograma (que es cuando la cámara puede haber
      // cambiado) limitando el trabajo con el propio temporal.
      try {
        const escena = this._escenaCesium();
        if (escena && escena.postRender && typeof escena.postRender.addEventListener === 'function') {
          escena.postRender.addEventListener(alCambiar);
          this._listenersCesium.push({ tipo: 'postRender', destino: escena.postRender, fn: alCambiar });
        }
      } catch (e) {
        /* sin refresco automático en 3D; el resto de eventos lo cubren */
      }
      this._actualizar();
    }

    /**
     * Reintenta con margen la espera de la escena de Cesium.
     * @param {number} intento Número de intento (0 es el primero).
     */
    _esperarEscena(intento) {
      const self = this;
      if (this._esperaEscena) {
        if (window.clearTimeout) window.clearTimeout(this._esperaEscena);
        this._esperaEscena = null;
      }
      if (this._camaraCesium()) {
        this._vigilarCamara();
        return;
      }
      if (intento * 500 > ESPERA_ESCENA) return;
      this._esperaEscena = window.setTimeout(function () {
        self._esperaEscena = null;
        self._esperarEscena(intento + 1);
      }, 500);
    }

    // =====================================================================
    // COORDENADAS DEL PUNTERO
    // =====================================================================

    /**
     * Sistema de coordenadas en el que está trabajando el visor ahora mismo.
     *
     * Es la misma pregunta que se le hace a la vista para la escala, y con la
     * misma intención: no convertir nada, preguntar. La respuesta decide dos
     * cosas, el número de coordenadas que se pintan y cómo se llaman:
     *
     *   - una proyección en grados (unidades 'd' o 'degrees') tiene etiquetas
     *     de longitud y latitud, y una en metros las de X e Y;
     *   - en 3D la API declara EPSG:4979, que es longitud, latitud y ALTURA, y
     *     entonces son tres coordenadas y la tercera lleva su unidad.
     *
     * @returns {{codigo: string, esGeografico: boolean, componentes: number,
     *   etiquetas: Array<string>, unidades: Array<string>}} Descripción del CRS.
     */
    _crsDelVisor() {
      const porDefecto = {
        codigo: PROYECCION_BASE, esGeografico: false, componentes: 2,
        etiquetas: ['X', 'Y'], unidades: ['m', 'm'],
      };
      try {
        if (this._es3D(this._map)) {
          let codigo = PROYECCION_3D;
          try {
            if (typeof this._map.getProjection === 'function') {
              const declarado = this._map.getProjection();
              // En 3D `map.getProjection()` NO devuelve un código sino el objeto de
              // proyección (el de Cesium), y hacer String() de eso da
              // "[object Object]" (medido). Ese texto se colaba en dos sitios y
              // rompía los dos: se pintaba en el botón de la tira y, peor, se
              // guardaba en getState() como si fuera un código, así que al
              // volver a 2D se intentaba aplicar "[object Object]" y la UTM que
              // tenía el usuario se perdía.
              // Por eso solo se acepta algo que tenga forma de código.
              const texto = declarado ? String(declarado) : '';
              if (/^(EPSG|CRS|urn:ogc):/i.test(texto)) codigo = texto;
            }
          } catch (e) {
            /* se queda el de por defecto */
          }
          return {
            codigo: codigo,
            // En modo plano lo que se lee son las X e Y de la Mercator, en metros,
            // y no grados; el resto de la cuenta (qué columnas hay, cuántas) es el
            // mismo. El modo lo decide MODO_3D a partir del código elegido.
            esGeografico: (MODO_3D[codigo] !== 'plano'),
            componentes: 3,
            etiquetas: (MODO_3D[codigo] === 'plano')
              ? ['X', 'Y', 'Altura']
              : ['Longitud', 'Latitud', 'Altura'],
            unidades: (MODO_3D[codigo] === 'plano') ? ['m', 'm', 'm'] : ['°', '°', 'm'],
          };
        }

        const vista = this._vistaOL();
        if (!vista || typeof vista.getProjection !== 'function') return porDefecto;
        const proyeccion = vista.getProjection();
        if (!proyeccion) return porDefecto;

        let codigo = PROYECCION_BASE;
        try {
          if (typeof proyeccion.getCode === 'function') codigo = String(proyeccion.getCode());
        } catch (e) {
          /* se queda el de por defecto */
        }
        let unidades = '';
        try {
          if (typeof proyeccion.getUnits === 'function') unidades = String(proyeccion.getUnits());
        } catch (e) {
          unidades = '';
        }
        const geografico = (unidades === 'd' || unidades === 'degrees');
        return {
          codigo: codigo,
          esGeografico: geografico,
          componentes: 2,
          etiquetas: geografico ? ['Longitud', 'Latitud'] : ['X', 'Y'],
          unidades: geografico ? ['°', '°'] : ['m', 'm'],
        };
      } catch (e) {
        return porDefecto;
      }
    }

    /**
     * Formatea una coordenada con los decimales que le tocan.
     *
     * Va al revés que _formatear(), y a propósito: aquí los millares estorban
     * (una X de Mercator es "-986.123,71", que ocupa mucho para lo que dice)
     * y los grados necesitan más decimales porque un grado son 111 km. El
     * separador de millar se quita solo en grados, que nunca pasan de 180.
     * @param {number} valor Coordenada.
     * @param {boolean} geografico true si la proyección está en grados.
     * @returns {string} Texto formateado, o '-' si no hay número válido.
     */
    _formatearCoordenada(valor, geografico) {
      const n = Number(valor);
      if (!isFinite(n)) return '-';
      const opciones = geografico
        ? { minimumFractionDigits: DECIMALES_GRADOS, maximumFractionDigits: DECIMALES_GRADOS, useGrouping: false }
        : { minimumFractionDigits: DECIMALES_METROS, maximumFractionDigits: DECIMALES_METROS, useGrouping: false };
      try {
        return n.toLocaleString('es-ES', opciones);
      } catch (e) {
        return String(n);
      }
    }

    /**
     * Pinta las coordenadas del puntero en la línea segunda.
     * @param {Array<number>|null} valores Coordenadas ya en el CRS del visor.
     */
    _pintarCoordenadas(valores) {
      if (!this._elCoordenadas) return;
      if (!valores || !valores.length) {
        this._pintar(this._elCoordenadas, '-');
        return;
      }
      const crs = this._crsDelVisor();
      const partes = [];
      for (let i = 0; i < valores.length; i++) {
        partes.push(this._formatearCoordenada(valores[i], crs.esGeografico));
      }
      this._pintar(this._elCoordenadas, partes.join('  '));
      // La etiqueta visible solo aparece cuando hay algo que nombrar; si no,
      // "Coordenadas -" ocupa sitio de más.
      this._pintar(this._etiquetaCoordenadas, partes.length ? 'Coordenadas' : '');
    }

    /**
     * Pide que se pinte la posición del puntero en el próximo fotograma.
     *
     * `pointermove` salta muchas más veces de las que se pueden pintar, y
     * cambiar el texto de un nodo obliga al navegador a recomponer. Con un
     * fotograma de margen se agrupan todos los eventos que caen en él y solo
     * se pinta uno, que es lo que se ve.
     * @param {Array<number>|null} valores Coordenadas en el CRS del visor.
     */
    _enColaPuntero(valores) {
      this._punteroEnCola = valores;
      if (this._rafPuntero !== null) return;
      const self = this;
      const pintar = function () {
        self._rafPuntero = null;
        self._pintarCoordenadas(self._punteroEnCola);
      };
      if (typeof window.requestAnimationFrame === 'function') {
        this._rafPuntero = window.requestAnimationFrame(pintar);
      } else {
        // Sin requestAnimationFrame se pinta de inmediato: peor, pero funciona.
        pintar();
      }
    }

    /**
     * Coordenada del puntero en 2D.
     *
     * No hay nada que calcular: OpenLayers ya entrega la coordenada del evento
     * en las unidades de la vista, que ya son las de su proyección. Por eso
     * este camino sirve igual en 3857, en 4326 y en las UTM sin tocar nada.
     * @param {Object} ev Evento `pointermove` de OpenLayers.
     */
    _alMoverPuntero2D(ev) {
      if (!ev) return;
      let coordenadas = null;
      try {
        const c = ev.coordinate;
        if (c && isFinite(c[0]) && isFinite(c[1])) coordenadas = [Number(c[0]), Number(c[1])];
        else if (c && isFinite(c.x) && isFinite(c.y)) coordenadas = [Number(c.x), Number(c.y)];
      } catch (e) {
        coordenadas = null;
      }
      this._enColaPuntero(coordenadas);
    }

    /**
     * Coordenada del puntero en 3D.
     *
     * Se corta el rayo de la cámara contra el elipsoide y se pasa a
     * geodésicas. El método que sirve es `camera.pickEllipsoid()`; los otros
     * dos que se probaron no sirven y están explicados en la cabecera
     * (pickPosition devuelve siempre el centro del mapa, y globe.pick no trae
     * coordenadas en esta versión del bundle).
     *
     * Como pickEllipsoid corta en el elipsoide, la altura saldría cero
     * siempre. La del terreno se pide aparte a `globe.getHeight()`, que es
     * síncrono y lee la tesela ya descargada; si no la hay, se muestra la del
     * elipsoide, que es cero, y no se disimula.
     * @param {Object} ev Evento de puntero del lienzo de Cesium.
     */
    _alMoverPuntero3D(ev) {
      try {
        const escena = this._escenaCesium();
        const camara = this._camaraCesium();
        if (!escena || !camara || !escena.globe || !ev) return;
        const lienzo = escena.canvas;
        if (!lienzo || typeof lienzo.getBoundingClientRect !== 'function') return;

        const rect = lienzo.getBoundingClientRect();
        if (!rect || !rect.width || !rect.height) return;
        // Cesium espera la posición en píxeles CSS relativos al lienzo, que es
        // justo lo que sale de restar el rectángulo. Pasarle clientX en crudo
        // falla si el lienzo no está en (0,0).
        const posicion = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
        if (posicion.x < 0 || posicion.y < 0 || posicion.x > rect.width || posicion.y > rect.height) return;

        const elipsoide = escena.globe.ellipsoid;
        const punto = camara.pickEllipsoid(posicion, elipsoide);
        if (!punto) return;
        const carto = elipsoide.cartesianToCartographic(punto);
        if (!carto) return;

        const RAD = 180 / Math.PI;
        let altura = 0;
        try {
          const delTerreno = escena.globe.getHeight(carto);
          if (typeof delTerreno === 'number' && isFinite(delTerreno)) altura = delTerreno;
        } catch (e) {
          altura = 0;
        }
        this._enColaPuntero(this._coordenadasDelModo3D(
          carto.longitude * RAD,
          carto.latitude * RAD,
          altura
        ));
      } catch (e) {
        this._enColaPuntero(null);
      }
    }

    /**
     * Pasa unas coordenadas geodésicas a las del modo que hay puesto en 3D.
     *
     * En modo globo se dejan como están (grados, grados, altura del terreno). En
     * modo plano se cambian las dos primeras por las X e Y de la Mercator
     * esférica, que es la del EPSG:3857 y la misma proyección que usan las capas
     * del visor en 2D, para que los números de un sitio y del otro se puedan
     * comparar. La fórmula es la del EPSG 9804:
     *
     *     X = a · λ      Y = a · ln(tan(π/4 + φ/2))
     *
     * La altura se pasa tal cual en los dos modos: en el plano es la de la
     * cámara sobre el elipsoide, que es lo único que hay cuando no hay terreno.
     * @param {number} lon Longitud en grados.
     * @param {number} lat Latitud en grados.
     * @param {number} altura Altura en metros.
     * @returns {Array<number>} [x, y, altura] en el modo activo.
     */
    _coordenadasDelModo3D(lon, lat, altura) {
      if (MODO_3D[this._epsg3D] !== 'plano') return [lon, lat, altura];
      const RAD = Math.PI / 180;
      const a = SEMI_MAYOR_MERCATOR;
      // La latitud se acota a ±85,0511 (unos 6,3·10^6 m) porque fuera de ahí la
      // Mercator se va a infinito: sin este tope, un punto en el polo soltaría un
      // NaN en la lectura.
      const acotada = Math.max(-85.051129, Math.min(85.051129, lat));
      return [
        a * lon * RAD,
        a * Math.log(Math.tan(Math.PI / 4 + acotada * RAD / 2)),
        altura,
      ];
    }

    /**
     * Escucha el puntero en la implementación que haya activa.
     *
     * En 2D se escucha a OpenLayers, que ya sabe del ratón y entrega la
     * coordenada en las unidades de la vista. En 3D no hay equivalente
     * publicado (`M.ScreenSpaceEventHandler` no está expuesto en este bundle),
     * así que se escucha al lienzo de Cesium directamente.
     *
     * Se escucha también la salida del ratón, para que el campo se vacíe en
     * vez de seguir enseñando la última posición, que ya no señala a nada.
     */
    _vigilarPuntero() {
      const self = this;
      if (this._es3D(this._map)) {
        const escena = this._escenaCesium();
        if (!escena || !escena.canvas) {
          this._esperarEscena(0);
          return;
        }
        const lienzo = escena.canvas;
        this._on(lienzo, 'pointermove', function (ev) { self._alMoverPuntero3D(ev); }, { passive: true });
        this._on(lienzo, 'mousemove', function (ev) { self._alMoverPuntero3D(ev); }, { passive: true });
        this._on(lienzo, 'mouseleave', function () { self._enColaPuntero(null); });
        return;
      }

      const impl = this._impl();
      if (impl && typeof impl.on === 'function') {
        this._on(impl, 'pointermove', function (ev) { self._alMoverPuntero2D(ev); });
      }
      // La salida del ratón se escucha en el contenedor, que es donde se sabe
      // que el puntero se ha ido del mapa y no solo de una capa.
      if (this._host) {
        this._on(this._host, 'mouseleave', function () { self._enColaPuntero(null); });
      }
    }

    // =====================================================================
    // PROYECCIÓN DEL VISUALIZADOR
    // =====================================================================

    /**
     * Nombre de un sistema de coordenadas, para el rótulo del selector.
     *
     *  El nombre acaba colgado de la propia proyección, como atributo `name`.
     *  Es una propiedad a secas, sin más: el objeto Projection de OpenLayers no
     *  tiene getName() ni set() (los dos medidos y los dos ausentes), pero sí
     *  admite atributos propios, y eso es justo lo que se pidió. El atributo se
     *  lee siempre antes que nada, así que a partir de la primera vez el rótulo
     *  sale de la proyección y no de las tablas de este fichero.
     *
     *  De dónde sale el nombre la primera vez, por orden:
     *   1) del atributo `name` de la proyección, si ya lo tiene;
     *   2) de `coordRefSys.name`, que es lo que devuelve la API al parsear un
     *      WKT (PROJCS.name) y lo que se guarda en _nombresRegistrados;
     *   3) de NOMBRES_EPSG, con los nombres oficiales que se copiaron del
     *      servicio de definiciones del OGC;
     *   4) de una última frase de cortesía, para que el desplegable nunca se
     *      quede sin rótulo ni con un hueco vacío.
     *
     *  Y en los cuatro casos se guarda, que es lo que hace que la proyección se
     *  quede con su nombre para siempre.
     * @param {string} codigo Código EPSG.
     * @returns {string} Nombre del sistema de coordenadas.
     */
    _nombreProyeccion(codigo) {
      if (!codigo) return '';
      const ol = window.ol;
      let proyeccion = null;
      try {
        proyeccion = (ol && ol.proj && typeof ol.proj.get === 'function') ? ol.proj.get(codigo) : null;
      } catch (e) {
        proyeccion = null;
      }
      // OJO con `proyeccion.name`: no siempre es una cadena. En la 4979 (la que
      // declara la API en 3D) es un objeto, y al pintarlo tal cual el botón de la
      // tira decía "Proyección [object Object]" (medido). Se exige que sea texto
      // antes de fiarse, como aquí.
      if (proyeccion && typeof proyeccion.name === 'string' && proyeccion.name) {
        return proyeccion.name;
      }

      let nombre = null;
      if (this._nombresRegistrados && this._nombresRegistrados[codigo]) {
        nombre = this._nombresRegistrados[codigo];
      } else if (NOMBRES_EPSG[codigo]) {
        nombre = NOMBRES_EPSG[codigo];
      } else {
        nombre = 'Proyección ' + codigo;
      }
      if (proyeccion) proyeccion.name = nombre;
      return nombre;
    }

    /**
     * Dirección del servicio de definiciones que resuelve un código.
     *
     * Es la misma cuenta que hace el propio OpenLayers para sus
     * proyecciones, y el mismo sitio al que apunta el `coordRefSys` que trae el
     * registro de la API. CRS:84 es la única excepción: no es un código del
     * EPSG y tiene su propio identificador en el servicio.
     * @param {string} codigo Código EPSG.
     * @returns {string|null} Dirección del servicio, o null si no se conoce.
     */
    _urnDeDefinicion(codigo) {
      if (!codigo) return null;
      if (codigo === 'CRS:84') return DEFINICION_CRS84;
      const numeros = /^EPSG:(\d+)$/.exec(codigo);
      return numeros ? (SERVICIO_DEFINICIONES + numeros[1]) : null;
    }

    /**
     * Lee el <gml:name> que devuelve el servicio de definiciones del OGC.
     * @param {string} codigo Código EPSG.
     * @returns {Promise<string|null>} El nombre oficial, o null si no se pudo.
     */
    _nombreOficial(codigo) {
      const url = this._urnDeDefinicion(codigo);
      if (!url || typeof window.fetch !== 'function') return Promise.resolve(null);
      let peticion;
      try {
        // El temporizador es la red de seguridad: si el servicio se queda
        // colgado, su nombre deja de hacer falta a los ESPERA_NOMBRES.
        peticion = window.fetch(url, { redirect: 'follow' });
      } catch (e) {
        return Promise.resolve(null);
      }
      const corte = new Promise(function (resolver) {
        setTimeout(function () { resolver(null); }, ESPERA_NOMBRES);
      });
      const promesa = peticion
        .then(function (respuesta) {
          return (respuesta && respuesta.ok) ? respuesta.text() : null;
        })
        .then(function (texto) {
          if (!texto) return null;
          const encontrado = /<gml:name>([^<]+)<\/gml:name>/.exec(texto);
          return (encontrado && encontrado[1]) ? encontrado[1].trim() : null;
        })
        .catch(function () { return null; });
      return Promise.race([promesa, corte]);
    }

    /**
     * Afina los rótulos del desplegable con el nombre oficial del EPSG.
     *
     * Se llama una vez por proyección, con la marca puesta en el propio objeto
     * de la proyección, así que ni se repite ni molesta a otras instancias.
     *
     *  Las peticiones van de una en una y con pausa, porque son once como poco y
     *  no es razón para soltarlas de golpe contra un servicio ajeno. Si alguna
     *  falla, no se dice nada: el nombre que ya tenía la proyección, de
     *  NOMBRES_EPSG o del WKT, es el bueno y no hay nada que arreglar. Aquí no se
     *  enseña ni se registra ningún error a propósito.
     *
     *  Y merece la pena decir por qué esto casi nunca va a cambiar nada: el
     *  servicio de definiciones del OGC no manda la cabecera
     *  Access-Control-Allow-Origin, así que desde el navegador la petición
     *  muere en el filtro de CORS antes de poder usarse. Por eso los nombres
     *  oficiales están ya copiados en NOMBRES_EPSG. Esto queda como red de
     *  seguridad por si algún día el servicio los sirve.
     */
    _resolverNombresOficiales() {
      const lista = (this._proyecciones || []).slice();
      if (!lista.length || typeof window.fetch !== 'function') return;

      const self = this;
      let indice = 0;
      const siguiente = function () {
        if (indice >= lista.length) {
          self._timerNombres = null;
          return;
        }
        const codigo = lista[indice].codigo;
        indice += 1;

        const ol = window.ol;
        let proyeccion = null;
        try {
          proyeccion = ol.proj.get(codigo);
        } catch (e) {
          proyeccion = null;
        }
        // La marca se pone ANTES de preguntar, tanto si sale bien como mal:
        // una respuesta, mala incluida, no se vuelve a pedir.
        if (proyeccion) proyeccion.nombreOficialIntentado = true;
        if (!proyeccion || proyeccion.nombreOficial || !self._urnDeDefinicion(codigo)) {
          self._timerNombres = setTimeout(siguiente, PAUSA_NOMBRES);
          return;
        }

        self._nombreOficial(codigo).then(function (oficial) {
          if (oficial) {
            proyeccion.nombreOficial = oficial;
            // El atributo `name` de la proyección manda sobre todo lo demás, así
            // que el afilado se le pone también ahí.
            proyeccion.name = oficial;
            self._pintarNombre(codigo, oficial);
          }
          self._timerNombres = setTimeout(siguiente, PAUSA_NOMBRES);
        });
      };
      this._timerNombres = setTimeout(siguiente, PAUSA_NOMBRES);
    }

    /**
     * Cambia el texto de una opción del desplegable, sin tocar su valor.
     * @param {string} codigo Código EPSG de la opción.
     * @param {string} nombre Nombre a pintar.
     */
    _pintarNombre(codigo, nombre) {
      try {
        if (!this._selector || !codigo || !nombre) return;
        const opciones = this._selector.options;
        for (let i = 0; i < opciones.length; i++) {
          if (opciones[i].value !== codigo) continue;
          opciones[i].textContent = nombre + ' (' + codigo + ')';
          return;
        }
      } catch (e) {
        /* el rótulo es un extra: si no se puede, se queda el de antes */
      }
    }

    /**
     * Extensión de la proyección puesta en modo "global".
     *
     *  Se aplica en la unidad de la proyección, que no siempre es la misma: en
     *  grados la extensión del mundo es 180x90, y en metros hace falta un
     *  rectángulo mucho mayor que el de una franja. Lo de los 3e7 m sale de
     *  medir: en las UTM que ofrece el visor el punto más lejano que aparece al
     *  transformar el mundo entero cae en 2,0·10^7 m de la coordenada Y, así que
     *  ese rectángulo lo envuelve.
     *
     *  Y hay que estar con cuidado al preguntar por las unidades, porque en esta
     *  API no están todas escritas igual (medido): 'm' en las métricas, 'd' en
     *  casi todas las geográficas (4326, CRS:84, 4230, 4258) y 'degrees' solo en
     *  la 4269. Con solo mirar por 'degrees' la 4326 se iba a poner en metros, que
     *  es dejarle una extensión de 3·10^7 GRADOS. Cuando las unidades no dicen
     *  nada se pregunta a la propia extensión: un rectángulo de 360x180 solo
     *  puede estar en grados.
     *
     *  Y el ancho, cuando hay que ensanchar, sale siendo un número entero de
     *  veces el ancho de la propia proyección, que no es un detalle: la
     *  repetición desplaza cada copia un ancho de extensión de la proyección
     *  (el código del renderizador: `x = getWidth(projection.getExtent())` y la
     *  copia `w` se dibuja desplazada `w*x`), así que si ese ancho no es múltiplo
     *  del de la rejilla de teselas las copias dejan de caer donde tocaba. Medido
     *  en la 25830, cuya franja mide 1,67·10^6 m: 36 copias llegan a ±3e7 m y se
     *  repiten sin costuras.
     *
     *  Y si la proyección ya venía global (la 3857 y la 3395, medidas) NO se toca
     *  nada: su extensión es un mundo exacto y es la que tiene su rejilla, que en
     *  esas la trae la API fija y no se recalcula. Medido: si a la 3857 se le
     *  ponía una extensión de ±3e7 m en la altura, al pasar de +180 el mapa se
     *  veía 0/0/0/0/0 de píxeles con color; con su extensión de verdad, repetido.
     * @param {Object} proyeccion Proyección de OpenLayers.
     * @returns {number[]} [xmin, ymin, xmax, ymax] en unidades de la proyección.
     */
    _extentGlobal(proyeccion) {
      const enGrados = ['degrees', 'degree', 'd'];
      try {
        const unidades = (proyeccion && typeof proyeccion.getUnits === 'function')
          ? String(proyeccion.getUnits() || '').toLowerCase() : '';
        if (enGrados.indexOf(unidades) !== -1) return [-180, -90, 180, 90];
      } catch (e) {
        /* si no se sabe la unidad, se deduce de la extensión */
      }
      const propio = proyeccion.extentPropio
        || (proyeccion && typeof proyeccion.getExtent === 'function' ? proyeccion.getExtent() : null);
      if (propio && Math.abs(propio[2] - propio[0]) <= 360 && Math.abs(propio[3] - propio[1]) <= 180) {
        return [-180, -90, 180, 90];
      }
      // Las que ya venían globales conservan su extensión tal cual: es un mundo
      // exacto y su rejilla viene fija en la API, tiene que seguir casando.
      if (propio && proyeccion[MUNDIAL_NATIVA]) {
        return [propio[0], propio[1], propio[2], propio[3]];
      }
      const ancho = propio ? Math.abs(propio[2] - propio[0]) : 0;
      if (!ancho) return [-ALCANCE_METROS, -ALCANCE_METROS, ALCANCE_METROS, ALCANCE_METROS];

      // Un número entero de anchos, centrados en la franja, y llegando a ±3e7 m.
      const veces = Math.max(1, Math.round((2 * ALCANCE_METROS) / ancho));
      const total = ancho * veces;
      const centro = (propio[0] + propio[2]) / 2;
      return [centro - total / 2, -ALCANCE_METROS, centro + total / 2, ALCANCE_METROS];
    }

    /**
     * Recorta el visor o lo deja en global, según la casilla.
     *
     *  De la extensión y de la globalidad se encarga la propia proyección, que
     *  es lo que la identifica como un recorte o como el mundo entero. Y son las
     *  dos cosas porque OpenLayers deriva de ellas la repetición lateral (el
     *  código de la propia biblioteca: `canWrapX_ = !(!global_ || !extent_)`, en
     *  `setGlobal` y en `setExtent`), o sea que con las dos puestas se enciende y
     *  con una sola no.
     *
     *  Con la proyección en global, el visor entero se ve repetido hacia los
     *  lados, sin corte en -180/180, que es lo que faltaba. Con la casilla
     *  marcada la proyección se queda en su franja y no se repite: repetir una
     *  bolsilla de UTM no significaría nada, y una extensión sin `global` es
     *  justamente un recorte.
     *
     *  La extensión de partida se guarda una vez en la propia proyección (el
     *  atributo `extentPropio`), porque al abrir en global se la cambia y hay que
     *  poder volver a la de verdad al marcar la casilla otra vez. Sin guardarla,
     *  marcar y desmarcar dejaría la proyección siempre en global y no volvería
     *  nunca a su recorte.
     *
     *  Y si la proyección no tenía extensión propia no hay nada que recortar:
     *  entonces la casilla no hace nada y, sobre todo, no se quita la global, que
     *  sería apagarle la repetición lateral a un mapa que no se recortaba. Es el
     *  caso de la 4269 (medido: su extent es null), y la casilla se deshabilita
     *  en _ajustarSelector() para que no parezca un control vivo.
     *
     *  Y con la proyección ya lista se recortan las capas, que es donde se ve
     *  el recorte de verdad (ver _recortarCapas).
     * @param {string} codigo Código EPSG de la proyección a ajustar.
     * @returns {boolean} true si se llegó a tocar la proyección.
     */
    _aplicarAlcance(codigo) {
      try {
        const ol = window.ol;
        if (!ol || !ol.proj || !codigo) return false;
        const proyeccion = ol.proj.get(codigo);
        if (!proyeccion) return false;

        // Solo se guarda la extensión la primera vez, que es cuando la tiene
        // puesta la propia API: a partir de ahí ya es la nuestra.
        if (!proyeccion.extentPropio && typeof proyeccion.getExtent === 'function') {
          const extent = proyeccion.getExtent();
          // Sin extent la proyección no recorta nada, así que no hay nada que
          // guardar ni que restaurar después. Y se deja dicho en la propia
          // proyección, porque a partir de aquí su extensión es la que le hemos
          // puesto nosotros: sin este aviso, al preguntar luego si se puede
          // recortar se vería una extensión donde no la hay y se daría por buena.
          if (extent) proyeccion.extentPropio = [extent[0], extent[1], extent[2], extent[3]];
          else proyeccion[MARCA_SIN_EXTENSION] = true;
          // Y si ya venía global, se apunta, para no volver a preguntárselo
          // después (ver MUNDIAL_NATIVA).
          if (typeof proyeccion.isGlobal === 'function') {
            proyeccion[MUNDIAL_NATIVA] = Boolean(proyeccion.isGlobal());
          }
        }

        const recortando = Boolean(this._recortar) && Boolean(proyeccion.extentPropio);
        const extent = recortando
          ? proyeccion.extentPropio
          : this._extentGlobal(proyeccion);

        if (typeof proyeccion.setGlobal === 'function') {
          proyeccion.setGlobal(!recortando);
        }
        if (extent && typeof proyeccion.setExtent === 'function') {
          const anterior = typeof proyeccion.getExtent === 'function' ? proyeccion.getExtent() : null;
          proyeccion.setExtent(extent);
          // Y la rejilla de teselas de esa proyección, que se hizo una sola vez,
          // con la extensión que había entonces, y si no se renueva sigue
          // sirviendo las teselas de la otra (ver _invalidarRejillas).
          if (String(anterior) !== String(extent)) this._invalidarRejillas(proyeccion);
        }
        this._recortarCapas(recortando ? extent : null);
        return true;
      } catch (e) {
        console.warn(`${this.name}: no se pudo ajustar el alcance de ${codigo}.`, e);
        return false;
      }
    }

    /**
     * Recorta las capas del visor a una extensión, o les devuelve la suya.
     *
     *  El recorte que se ve en pantalla no lo hace la extensión de la proyección.
     *  Medido: ponerla y quitarla con la vista del mundo entero en la 25830 deja
     *  los píxeles con color exactamente igual (98,3 % en los tres casos), y tirar
     *  la rejilla de la fuente tampoco, porque su caché va por clave numérica
     *  ("205" para la 25830) y no por código, así que borrarla a mano no la
     *  invalida. Lo que recorta de verdad es la extensión de la CAPA, que es
     *  parte de la API pública de OpenLayers: con las cinco capas recortadas a la
     *  franja de la 25830 el mismo encuadre pasa de 9,89 % a 0,07 % de píxeles con
     *  color, y vuelve a 9,89 % al soltar la extensión.
     *
     *  La extensión va en las unidades de la vista, que es donde está la
     *  extensión de la proyección, y se lleva a las unidades de cada capa antes
     *  de ponérsela: la extensión de una capa se interpreta en la proyección de
     *  esa capa, y sin traducirla una franja UTM pasada a la capa base, que está
     *  en 3857, se iría a un sitio imposible.
     *
     *  La extensión de partida de cada capa se guarda en la propia capa (la
     *  propiedad `_extentSinRecorte`) y no en el plugin: así sobrevive a los
     *  cambios de proyección, a marcar y desmarcar y a los cambios de
     *  implementación, en los que las capas se vuelven a crear.
     *
     *  Al soltar el recorte (extent null) lo que se hace es QUITAR la extensión de la
     *  capa, no ensancharla. Es lo que hace que el mapa se repita hacia los lados,
     *  y con números: OpenLayers dibuja cada copia desplazada un ancho de la
     *  extensión de la PROYECCIÓN (el código del renderizador: `x =
     *  getWidth(projection.getExtent())` y la copia `w` se dibuja desplazada
     *  `w*x`), pero la extensión de la CAPA lo recorta justo donde empieza la
     *  repetición. La de la capa base de la API es el mundo entero, así que tal
     *  cual el mapa se acaba en un borde recto al pasar de +180. Medido en 3857,
     *  con la vista a 0,62 / 1,20 / 2,32 / 3,49 mundos del centro, contando
     *  quintiles de píxeles con color:
     *
     *      sin extensión   96/99/100/99/98   98/100/97/97/98   98/100/97/97/100   99/96/100/100/99
     *      1 mundo         96/68/0/0/0       0/0/0/0/0        0/0/0/0/0         0/0/0/0/0
     *      3 mundos        96/99/100/99/98   98/100/97/97/46   0/0/0/0/0         0/0/0/0/0
     *     11 mundos        96/99/100/99/98   98/100/97/97/98   98/100/97/97/100   99/96/100/100/99
     *
     *  Ensanchar, pues, no alarga nada: solo va moviendo la pared. Sin extensión
     *  la repetición llega hasta donde se arrastre el mapa.
     *
     *  La extensión de partida de cada capa se guarda en la propia capa (la
     *  propiedad `_extentSinRecorte`) y no en el plugin: así sobrevive a los
     *  cambios de proyección, a marcar y desmarcar y a los cambios de
     *  implementación, en los que las capas se vuelven a crear, y se le puede
     *  devolver al plugin al desmontarlo.
     * @param {number[]|null} [extent] Extensión del recorte en las unidades de la
     * vista, o null para dejar las capas sin recorte (modo global).
     * @param {boolean} [restituir] true para devolverle a cada capa la extensión
     * que tenía, en vez de dejar el recorte como esté.
     * @returns {number} Cuántas capas han quedado con extensión puesta.
     */
    _recortarCapas(extent, restituir) {
      let tocadas = 0;
      try {
        const mapa = this._impl();
        if (!mapa || typeof mapa.getLayers !== 'function') return 0;
        const vista = typeof mapa.getView === 'function' ? mapa.getView() : null;
        const proyeccionVista = (vista && typeof vista.getProjection === 'function')
          ? vista.getProjection() : null;
        const capas = mapa.getLayers();
        for (let i = 0; i < capas.getLength(); i++) {
          const capa = capas.item(i);
          if (!capa || typeof capa.setExtent !== 'function') continue;
          if (!Object.prototype.hasOwnProperty.call(capa, '_extentSinRecorte')) {
            capa._extentSinRecorte = (typeof capa.getExtent === 'function')
              ? capa.getExtent() : undefined;
          }
          if (restituir) {
            capa.setExtent(capa._extentSinRecorte || undefined);
          } else if (extent) {
            capa.setExtent(this._extentEnProyeccion(extent, proyeccionVista,
              this._proyeccionCapa(capa, proyeccionVista)));
          } else {
            // Sin extensión: en global no hay nada que recorte, y sin este
            // undefined la copia repetida se quedaría fuera del mapa.
            capa.setExtent(undefined);
          }
          if (typeof capa.changed === 'function') capa.changed();
          tocadas++;
        }
      } catch (e) {
        console.warn(`${this.name}: no se pudieron recortar las capas.`, e);
      }
      return tocadas;
    }

    /**
     * Renueva la rejilla de teselas cacheada para una proyección, que es lo que
     *  hace que el cambio de alcance se vea al momento.
     *
     *  Las teselas de una proyección se calculan sobre una rejilla que se hace una
     *  sola vez, y esa se queda guardada en dos sitios:
     *
     *  1) En la propia proyección, como su rejilla por defecto
     *     (getDefaultTileGrid). Es la que manda: getTileGridForProjection() la
     *     devuelve siempre que la haya (medido: preguntar por la rejilla de la
     *     25830 devuelve siempre la misma, la que se hizo la primera vez).
     *  2) En la fuente, en su propiedad `tileGridForProjection`, cuya clave es un
     *     identificador interno de la proyección —"207" para la 25830—, no su
     *     código, así que no se puede borrar a mano por código.
     *
     *  Como la rejilla se hizo con la extensión que había entonces, al cambiar el
     *  alcance después sigue sirviendo las teselas de la de antes. Se nota mucho, y
     *  además solo en un orden, que es el que más confunde: marcando la casilla de
     *  recorte ANTES de elegir la 25830, la franja se ve bien (la rejilla nace ya
     *  con la extensión de la franja); y si se elige la proyección primero y se
     *  marca después, sale un cuadrado del mapa mundial, que es la esquina de la
     *  rejilla global recortada por la extensión de la franja. Los dos casos dejan
     *  idénticas la extensión de la proyección y las de todas las capas, así que la
     *  diferencia estaba solo en la rejilla.
     *
     *  Se anulan las dos y se dejan rehacerse solas con la extensión nueva (medido:
     *  así la franja sale igual de las dos maneras, con sus 43 niveles). Las
     *  rejillas de OTRAS proyecciones no se tocan, y la rejilla fija de la capa base
     *  tampoco, que esa se usa tal cual y no está cacheada en ningún sitio.
     * @param {Object} proyeccion Proyección a la que se le renueva la rejilla.
     * @returns {number} Cuántas rejillas caducadas se han tirado.
     */
    _invalidarRejillas(proyeccion) {
      let borradas = 0;
      try {
        const actual = (typeof proyeccion.getExtent === 'function') ? proyeccion.getExtent() : null;
        if (!actual) return 0;

        // 1) La de la propia proyección, que es la que se usa.
        if (typeof proyeccion.setDefaultTileGrid === 'function') {
          const reji = (typeof proyeccion.getDefaultTileGrid === 'function')
            ? proyeccion.getDefaultTileGrid() : null;
          const extent = (reji && typeof reji.getExtent === 'function') ? reji.getExtent() : null;
          if (reji && String(extent) !== String(actual)) {
            proyeccion.setDefaultTileGrid(null);
            borradas++;
          }
        }

        // 2) Las de las fuentes de teselas.
        const mapa = this._impl();
        if (mapa && typeof mapa.getLayers === 'function') {
          const capas = mapa.getLayers();
          for (let i = 0; i < capas.getLength(); i++) {
            const capa = capas.item(i);
            const fuente = (capa && typeof capa.getSource === 'function') ? capa.getSource() : null;
            if (!fuente || !fuente.tileGridForProjection) continue;
            const cache = fuente.tileGridForProjection;
            Object.keys(cache).forEach(function (clave) {
              const reji = cache[clave];
              const extent = (reji && typeof reji.getExtent === 'function') ? reji.getExtent() : null;
              if (!extent || String(extent) !== String(actual)) {
                delete cache[clave];
                borradas++;
              }
            });
            if (typeof fuente.changed === 'function') fuente.changed();
            if (typeof capa.changed === 'function') capa.changed();
          }
        }
      } catch (e) {
        console.warn(`${this.name}: no se pudieron renovar las rejillas.`, e);
      }
      return borradas;
    }

    /**
     * Proyección en la que hay que interpretar la extensión de una capa.
     *
     *  OpenLayers guarda la extensión de cada capa en la proyección de su fuente,
     *  y si no la tiene (capas de teselas) usa la de la vista. Se pregunta a la
     *  fuente, que es de donde sale.
     * @param {Object} capa Capa del visor.
     * @param {Object} [proyeccionVista] Proyección de la vista, por defecto.
     * @returns {Object|null} Proyección de la capa, o la de la vista.
     */
    _proyeccionCapa(capa, proyeccionVista) {
      try {
        const fuente = (capa && typeof capa.getSource === 'function') ? capa.getSource() : null;
        if (fuente && typeof fuente.getProjection === 'function') {
          const propia = fuente.getProjection();
          if (propia) return propia;
        }
      } catch (e) {
        /* si la fuente no responde, se usa la de la vista */
      }
      return proyeccionVista || null;
    }

    /**
     * Lleva una extensión de una proyección a otra, con su envolvente.
     *
     *  Se transforman las cuatro esquinas y se toma el rectángulo que las
     *  envuelve, que es lo único válido: al pasar de 4326 a una UTM los bordes no
     *  son rectos, así que transformar solo dos esquinas dejaría fuera parte de
     *  la franja.
     * @param {number[]} extent [xmin, ymin, xmax, ymax] de partida.
     * @param {Object} desde Proyección de partida.
     * @param {Object} hasta Proyección de llegada.
     * @returns {number[]} [xmin, ymin, xmax, ymax] de llegada.
     */
    _extentEnProyeccion(extent, desde, hasta) {
      try {
        const ol = window.ol;
        if (!ol || !ol.proj || !extent || !desde || !hasta || desde === hasta) return extent;
        const esquinas = [
          [extent[0], extent[1]], [extent[0], extent[3]],
          [extent[2], extent[1]], [extent[2], extent[3]],
        ].map((punto) => ol.proj.transform(punto, desde, hasta));
        const xs = esquinas.map((p) => p[0]);
        const ys = esquinas.map((p) => p[1]);
        return [Math.min.apply(null, xs), Math.min.apply(null, ys),
          Math.max.apply(null, xs), Math.max.apply(null, ys)];
      } catch (e) {
        return extent;
      }
    }

    /**
     * Indica si entre dos proyecciones hay una transformación de verdad.
     *
     * Se compara con la identidad, que es lo que OpenLayers devuelve cuando no
     * hay ninguna registrada. Es la comprobación que decide si un EPSG es
     * utilizable: si no hay transform con la proyección de las capas, el mapa
     * se queda en blanco al cambiar (medido con EPSG:2154, que deja 0 de 40000
     * píxeles con color y el aviso "No transform available").
     * @param {Object} a Proyección origen.
     * @param {Object} b Proyección destino.
     * @returns {boolean} true si existe alguna transformación entre las dos.
     */
    _hayTransform(a, b) {
      try {
        const ol = window.ol;
        if (!ol || !ol.proj || !a || !b) return false;
        if (a === b) return true;
        // OJO con cómo se pregunta, que es donde estaban los dos fallos:
        //
        //  - Comparar la transformación con la identidad POR REFERENCIA no vale.
        //    Cuando no hay par, `getTransform` devuelve null (medido en este
        //    bundle, que no devuelve la identidad), y null !== función es
        //    `true`, así que la comprobación decía que había transformación
        //    entre dos proyecciones que no la tenían. Con eso, el emparejamiento
        //    de las projections nuevas se saltaba justo los pares que faltaban
        //    y el mapa se quedaba con la proyección a medias.
        //
        //  - Y la identidad de OpenLayers tampoco se puede reconocer por
        //    referencia (la devuelve envuelta en un try/catch en unas versiones),
        //    así que se reconoce probándola con un punto.
        //
        // Con lo que hay: null no es transformación, y la identidad tampoco.
        return this._transformacionUsable(ol.proj.getTransform(a, b))
          || this._transformacionUsable(ol.proj.getTransform(b, a));
      } catch (e) {
        return false;
      }
    }

    /**
     * Indica si lo que devuelve `getTransform` sirve como transformación.
     * @param {*} t Valor devuelto por `ol.proj.getTransform`.
     * @returns {boolean} true si es una función y no es la identidad.
     */
    _transformacionUsable(t) {
      return (typeof t === 'function') && !this._esIdentidad(t);
    }

    /**
     * Indica si una transformación es la identidad, probándola con un punto.
     * @param {Function} transform Transformación a probar.
     * @returns {boolean} true si el punto sale igual.
     */
    _esIdentidad(transform) {
      try {
        if (typeof transform !== 'function') return true;
        const sonda = [1e6, 1e6];
        const salida = transform(sonda);
        if (!salida || salida.length < 2) return true;
        return salida[0] === sonda[0] && salida[1] === sonda[1];
      } catch (e) {
        return true;
      }
    }

    /**
     * Lista los sistemas de coordenadas que este visor puede usar de verdad.
     *
     * Se ofrecen los que cumplen las dos condiciones de _hayTransform() y
     * _leerProyecciones(): que OpenLayers sepa la proyección y que exista
     * transform con la de las capas. Se descartan los que no, porque dejaban
     * el mapa en blanco.
     * @returns {Array<{codigo: string, nombre: string}>} Códigos utilizables.
     */
    _leerProyecciones() {
      const lista = [];
      const ol = window.ol;
      if (!ol || !ol.proj || typeof ol.proj.get !== 'function') return lista;

      let base = null;
      try {
        base = ol.proj.get(PROYECCION_BASE);
      } catch (e) {
        base = null;
      }

      // La lista depende de la implementación: en 3D solo se ofrecen las dos que
      // tienen modo de vista (MODO_3D), porque en el globo geodésico las demás no
      // se pueden ver de otra manera; en 2D sigue la lista larga de siempre, que
      // es lo que había antes de esto.
      const es3D = this._es3D(this._map);
      const codigos = (es3D ? EPSG_DISPONIBLES : EPSG_A_FILTRAR).slice();
      // Las registradas en caliente, que no pueden estar en la lista fija. En 3D
      // NO se mezclan: son las que se registraron en 2D (la instancia sobrevive al
      // cambio de implementación) y aquí no se pueden usar, porque MODO_3D solo
      // tiene esas dos. Mezclarlas salía con las 14 de 2D más las 2 de 3D, con dos
      // 4326 y dos 3857 repetidos (medido).
      if (!es3D) {
        const extra = Object.keys(this._nombresRegistrados || {});
        extra.forEach(function (c) { if (codigos.indexOf(c) === -1) codigos.push(c); });
      }

      const self = this;
      codigos.forEach(function (codigo) {
        if (lista.some(function (l) { return l.codigo === codigo; })) return;
        let proyeccion = null;
        try {
          proyeccion = ol.proj.get(codigo);
        } catch (e) {
          proyeccion = null;
        }
        // 1) que exista la proyección.
        if (!proyeccion) return;
        // 2) que se pueda llegar a la de las capas; sin esto el mapa se
        //    queda en blanco al elegirla.
        if (base && codigo !== PROYECCION_BASE && !self._hayTransform(proyeccion, base)) return;
        lista.push({ codigo: codigo, nombre: self._nombreProyeccion(codigo) });
      });
      return lista;
    }

    /**
     * Llena la lista de la ventana con las proyecciones utilizables y deja
     * marcada la que está en uso, y actualiza el código del botón de la tira.
     *
     * Se llama al montar, al abrir la ventana y también después de registrar
     * una nueva, para que aparezca sin haber que recargar.
     */
    _rellenarProyecciones() {
      const self = this;
      try {
        this._proyecciones = this._leerProyecciones();
      } catch (e) {
        console.warn(`${this.name}: no se pudo leer la lista de proyecciones.`, e);
        return;
      }

      // El botón de la tira enseña el rótulo entero (nombre y código), que es como
      // estaba antes; la ventana es la que amplía la lista.
      this._pintarCodigo(this._epsgActivo || this._crsDelVisor().codigo);

      if (!this._modalLista) return;
      // Se quitan las ventanas que no sean NUESTRA. Pasa al cambiar de
      // implementación: la instancia anterior deja su capa en el body (si su
      // destroy() no llega a correr) y entonces hay dos ventanas, la que
      // responde al botón con la lista al día y la otra con la lista vieja, que es
      // lo que se veía: en 3D salían las 14 de 2D más las 2 de 3D (medido).
      try {
        const suyas = document.querySelectorAll('.g-mapInfo-modal-capa');
        Array.prototype.slice.call(suyas).forEach(function (capa) {
          if (capa !== this._modal && capa.parentNode) capa.parentNode.removeChild(capa);
        }.bind(this));
      } catch (e) {
        /* si no se puede limpiar, sigue como estaba */
      }
      const lista = this._modalLista;
      lista.textContent = '';

      // El marcado es el modo de 3D si estamos en 3D: el código que declara la API
      // (el 4979) no está en la lista de 3D, así que con la cuenta de antes
      // ninguna fila salía marcada y el radio acababa en la primera (medido: con
      // el 4326 puesto aparecía marcado el 3857).
      const activo = this._es3D(this._map)
        ? this._epsg3D
        : (this._epsgActivo || this._crsDelVisor().codigo);
      this._proyecciones.forEach(function (item) {
        const fila = document.createElement('label');
        fila.className = 'g-mapInfo-modal-fila';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.className = 'g-mapInfo-modal-radio';
        radio.name = 'g-mapInfo-proyeccion';
        radio.value = item.codigo;
        if (item.codigo === activo) radio.checked = true;
        const nombre = document.createElement('span');
        nombre.className = 'g-mapInfo-modal-nombre';
        // "Nombre (EPSG:n)", que es como seBUSCA un sistema de coordenadas:
        // por nombre o por número, pero con los dos a la vista.
        nombre.textContent = item.nombre;
        const codigo = document.createElement('span');
        codigo.className = 'g-mapInfo-modal-codigo';
        codigo.textContent = item.codigo;
        fila.appendChild(radio);
        fila.appendChild(nombre);
        fila.appendChild(codigo);
        lista.appendChild(fila);
      });

      if (!this._proyecciones.length) {
        const vacio = document.createElement('div');
        vacio.className = 'g-mapInfo-modal-vacio';
        vacio.textContent = 'No hay ninguna proyección utilizable en este visualizador.';
        lista.appendChild(vacio);
      }

      // La casilla de recorte se sincroniza con el estado, que es la fuente de
      // verdad: puede venir marcada de un getState()/setState() o de una
      // casilla marcada antes de que la ventana se abriera.
      if (this._casillaAlcance) this._casillaAlcance.checked = Boolean(this._recortar);
      // Y se vuelve a aplicar el filtro del buscador: al registrar uno nuevo la
      // lista se rehace entera, y sin esto las filas saldrían todas aunque el
      // buscador tuviera algo escrito.
      this._filtrarProyecciones();

      // Los nombres oficiales por red NO se piden aquí: es una mejora sobre los
      // de NOMBRES_EPSG (que ya son los mismos) y el servicio de opengis.net no
      // manda Access-Control-Allow-Origin, así que el navegador lo bloquea y
      // cada intento deja un error CORS en la consola. Queda a mano con
      // _resolverNombresOficiales() para cuando lo sirva con esa cabecera.
      void self;
    }

    /**
     * Escribe en el botón de la tira el rótulo de la proyección activa.
     *
     * El rótulo es "Nombre (EPSG:n)", el mismo que tenía cada opción del
     * desplegable: un sistema de coordenadas se busca por nombre o por número y
     * lo que se busca está aquí. La ventana modal no sustituye a este texto, lo
     * complementa: aquí se ve cuál está puesto y allí se elige o se añade otro.
     * @param {string} codigo Código de la proyección (puede ser null).
     */
    _pintarCodigo(codigo) {
      if (!this._codigoSelector) return;
      const nombre = codigo ? this._nombreProyeccion(codigo) : '';
      // "Nombre (EPSG:n)", y el código no se repite detrás si el nombre ya lo
      // trae: con lo que se registra desde una cadena proj4, donde no hay nombre
      // y se compone uno, salía "EPSG:2154 (lcc) (EPSG:2154)".
      const texto = (nombre && nombre !== codigo && nombre.indexOf(codigo) === -1)
        ? nombre + ' (' + codigo + ')'
        : (nombre || codigo || '-');
      this._codigoSelector.textContent = texto;
      if (this._selector) {
        this._selector.title = 'Pulsa para cambiar el sistema de coordenadas';
      }
    }

    /**
     * Habilita o deshabilita el botón de proyección según la implementación
     * activa.
     *
     * En 3D no hay nada que cambiar: el globo es geodésico y la proyección la
     * declara la propia API como EPSG:4979. Dejarlo vivo ahí sería prometer algo
     * que no ocurre, así que se deshabilita y se explica por qué en el título y
     * en la etiqueta.
     *
     * La casilla de recorte se deshabilita además cuando la proyección activa no
     * tiene extensión propia (la 4269, que viene con extent null), porque entonces
     * no hay nada que recortar y dejarla viva sería un control que no hace nada.
     */
    _ajustarSelector() {
      if (!this._selector) return;
      const es3D = this._es3D(this._map);
      // El botón NO se deshabilita en 3D: ahora hay algo que cambiar ahi, que es
      // el modo de la vista (globo o plano). Antes, con 3D deshabilitado, no había
      // nada que elegir porque el globo es geodésico y solo es EPSG:4979.
      this._selector.disabled = false;
      const recortable = this._hayExtensionPropia();
      if (this._casillaAlcance) {
        // En 3D el recorte lo pone el propio globo (la escena se dibuja en el
        // geodésico y no hay proyección que recortar), así que la casilla no
        // tiene nada que mandar y se deshabilita con el botón.
        this._casillaAlcance.disabled = es3D || !recortable;
        this._casillaAlcance.checked = Boolean(this._recortar);
      }
      const explicacion = es3D
        ? 'Elige cómo se ve el globo y en qué unidades se leen las coordenadas: ' +
        'EPSG:4326, el globo con su relieve y las coordenadas en grados; ' +
        'EPSG:3857, el globo aplanado y las coordenadas en metros de la Mercator.'
        : 'Cambia el sistema de coordenadas del visualizador, manteniendo la extensión que se está viendo.';
      this._etiquetaSelector.title = explicacion;
      if (this._selector) this._selector.title = explicacion;
      const explicacionAlcance = es3D
        ? 'En 3D no hay nada que recortar: el globo se ve entero.'
        : (recortable
          ? 'Marcada, el visualizador se recorta a la extensión de la proyección (una UTM solo enseña su franja). Desmarcada, se ve en global y se repite hacia los lados.'
          : 'Esta proyección no viene con extensión propia, así que no hay nada que recortar: se ve siempre en global.');
      if (this._cajaAlcance) this._cajaAlcance.title = explicacionAlcance;
      if (this._etiquetaAlcance) this._etiquetaAlcance.title = explicacionAlcance;
      // En 3D el botón enseña el modo elegido (4326 o 3857), no el código que
      // declara la API, porque aquel no depende de lo que se haya pedido.
      if (es3D) this._pintarCodigo(this._epsg3D);
    }

    /**
     * Indica si la proyección activa trae extensión propia, es decir, si hay
     * alguna franja a la que recortar el visor.
     *
     *  Se mira `extentPropio`, que es lo que puso la API, y no la extensión
     *  actual: en global la que hay es la nuestra (el mundo entero), así que
     *  preguntar por la actual daría por recortable una proyección que no tiene
     *  nada que recortar, como la 4269 (medido: viene con extent null).
     * @returns {boolean} true si la proyección activa tiene extensión.
     */
    _hayExtensionPropia() {
      try {
        const ol = window.ol;
        if (!ol || !ol.proj) return false;
        const codigo = this._epsgActivo || this._crsDelVisor().codigo;
        const proyeccion = ol.proj.get(codigo);
        if (!proyeccion) return false;
        if (proyeccion[MARCA_SIN_EXTENSION]) return false;
        if (proyeccion.extentPropio) return true;
        const extent = (typeof proyeccion.getExtent === 'function') ? proyeccion.getExtent() : null;
        return Boolean(extent);
      } catch (e) {
        return false;
      }
    }

    /**
     * Vuelve a ajustar el alcance cuando se añade una capa al visor.
     *
     *  Al montar no están todas: la capa base la añade después el plugin del
     *  fondo (miPlugin_baseLayer) y, si solo se tocaran las que hay en ese
     *  momento, la base se quedaría recortada al mundo entero y el mapa no se
     *  repetiría ni al arrancar. Medido: con la extensión de la capa base tal
     *  cual, pasado +180 se ven 98 69 0 0 0 por quintiles de píxeles con color; y
     *  ensanchada, 98 100 99 97 99.
     *
     *  Se vuelve a llamar a _aplicarAlcance() entero, y no solo a lo de las capas,
     *  para que la operación siga siendo la misma que al cambiar de proyección y
     *  no haya dos caminos que mantener. Es idempotente: volver a poner la misma
     *  extensión no cambia nada.
     */
    _vigilarCapas() {
      try {
        const mapa = this._impl();
        const capas = (mapa && typeof mapa.getLayers === 'function') ? mapa.getLayers() : null;
        if (!capas) return;
        const self = this;
        this._on(capas, 'add', function () {
          self._aplicarAlcance(self._epsgActivo || self._crsDelVisor().codigo);
        });
      } catch (e) {
        /* sin colección que vigilar se queda como esté; ver _aplicarAlcance */
      }
    }

    /**
     * Metros de suelo que mide un píxel de la vista.
     *
     * Es el número que hay que conservar al cambiar de proyección, y no la
     * escala ni el zoom: la escala depende del píxel de 72 dpi que usa la API
     * para imprimir su "1 : n", mientras que esto es una medida real del mapa.
     * Es el mismo factor de _factorProyeccion(), aplicado a la resolución.
     * @param {Object} vista Vista de OpenLayers.
     * @returns {number|null} Metros de suelo por píxel, o null si no se puede.
     */
    _metrosDeSueloPorPx(vista) {
      try {
        if (!vista || typeof vista.getResolution !== 'function') return null;
        const resolucion = Number(vista.getResolution());
        const factor = this._factorProyeccion(vista);
        if (!isFinite(resolucion) || resolucion <= 0 || factor === null) return null;
        const valor = resolucion * factor;
        return (isFinite(valor) && valor > 0) ? valor : null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Comprueba que un código se pueda usar antes de tocar el mapa.
     * @param {string} codigo Código EPSG.
     * @returns {boolean} true si el visor puede representarlo.
     */
    _puedeUsarProyeccion(codigo) {
      if (!codigo || this._es3D(this._map)) return false;
      try {
        const ol = window.ol;
        if (!ol || !ol.proj || typeof ol.proj.get !== 'function') return false;
        const proyeccion = ol.proj.get(codigo);
        if (!proyeccion) return false;
        const base = ol.proj.get(PROYECCION_BASE);
        if (!base || codigo === PROYECCION_BASE) return true;
        return this._hayTransform(proyeccion, base);
      } catch (e) {
        return false;
      }
    }

    /**
     * Cambia el modo de la vista de Cesium: globo o plano.
     *
     * En 3D el globo es geodésico y no admite más que dos formas de leerlo, así
     * que "cambiar de proyección" aquí es cambiar el modo y lo que se muestra:
     *   - EPSG:4326, modo globo: se ve el globo entero con su relieve y las
     *     coordenadas van en grados (longitud, latitud) más la altura del terreno.
     *   - EPSG:3857, modo plano: el globo se aplana, que es lo que más se parece
     *     a la vista 2D, y las coordenadas van en metros de la Mercator (X, Y)
     *     más la altura.
     *
     * El aplanado es `morphTo3D(0)`: Cesium interpola la geometría del globo
     * hacia un plano. Con el botón deshabilitado no se nota; con el botón vivo
     * (que es lo que hay ahora) se ve cómo el globo se aplasta.
     * @param {string} codigo Código de la proyección elegida.
     * @returns {boolean} true si el modo se aplicó.
     */
    _cambiarModo3D(codigo) {
      const modo = MODO_3D[codigo];
      if (!modo) {
        this._avisoAlta(codigo + ' no se puede ver en 3D: el globo solo admite ' +
          'geográficas (EPSG:4326) o la Mercator plana (EPSG:3857).', 'error');
        return false;
      }
      this._epsg3D = codigo;
      const aplicada = this._aplicarModo3D(modo);
      this._ajustarSelector();
      this._actualizar();
      if (aplicada) {
        this._avisoAlta('', '');
        console.info(`${this.name}: vista de Cesium en modo ${modo} (${codigo}).`);
      }
      return aplicada;
    }

    /**
     * Pone la escena de Cesium en modo globo o en modo plano.
     * @param {string} modo 'globo' o 'plano'.
     * @returns {boolean} true si se pudo.
     */
    _aplicarModo3D(modo) {
      const escena = this._escenaCesium();
      if (!escena) return false;
      try {
        if (typeof escena.morphTo3D === 'function') {
          // 0 es plano y 1 es globo. morphTo3D es instantáneo; para una
          // transición se usaría scene.morphComplete.addEventListener con
          // scene.morphTime, que aquí no hace falta: el cambio lo pide el usuario
          // y se aplica ya.
          escena.morphTo3D(modo === 'plano' ? 0 : 1);
          return true;
        }
        // Sin morphTo3D (versiones antiguas) se recurre a esconder el globo, que
        // es el otro modo de "verlo plano".
        if (escena.globe) escena.globe.show = (modo !== 'plano');
        return true;
      } catch (e) {
        console.warn(`${this.name}: no se pudo cambiar el modo de la vista 3D.`, e);
        return false;
      }
    }

    /**
     * Dice si un punto en coordenadas de la proyección actual cae fuera de la zona
     * de otra proyección, o si no se puede saber.
     *
     * Se calcula en la proyección de DESTINO, que es donde importa: un punto al
     * que le faltan mil millones de metros de ordenada es lo que rompe la rejilla
     * de las capas, y eso no lo dice la transformación (que siempre devuelve
     * números) sino la extensión de la proyección.
     * @param {Array<number>} punto Punto en la proyección actual [x, y].
     * @param {string} codigo Código de la proyección de destino.
     * @returns {string} Descripción de lo que pasa, o '' si el punto cae dentro.
     */
    _fueraDeLaZona(punto, codigo) {
      try {
        const ol = window.ol;
        if (!ol || !ol.proj) return '';
        const actual = this._vistaOL() ? this._vistaOL().getProjection() : null;
        const destino = ol.proj.get(codigo);
        if (!actual || !destino) return '';
        const enDestino = ol.proj.transform(punto, actual, destino);
        if (!enDestino || !isFinite(enDestino[0]) || !isFinite(enDestino[1])) {
          return 'el punto no tiene coordenadas finitas';
        }
        const extension = (typeof destino.getExtent === 'function') ? destino.getExtent() : null;
        if (!extension || extension.length < 4) return '';
        // Media banda de margen: lo que está justo en el borde es un caso límite
        // en el que la rejilla puede seguir fallando.
        const margenX = (extension[2] - extension[0]) * 0.05;
        const margenY = (extension[3] - extension[1]) * 0.05;
        if (enDestino[0] < extension[0] - margenX || enDestino[0] > extension[2] + margenX
          || enDestino[1] < extension[1] - margenY || enDestino[1] > extension[3] + margenY) {
          return 'el punto cae en ' + Math.round(enDestino[0]) + ', ' + Math.round(enDestino[1]);
        }
        return '';
      } catch (e) {
        return '';
      }
    }

    /**
     * Vuelve a la proyección por defecto (EPSG:3857) tras un fallo.
     *
     * Es lo que se hace cuando un código de la lista no se puede usar: en vez de
     * dejar el visualizador a medias, con la proyección a medio cambiar y el mapa
     * sin saber dónde está, se aplica la de por defecto, que es la misma que usan
     * las capas de la API y la que siempre funciona. Si ya se estaba en ella no
     * hay nada que hacer, pero la lista y el botón se repintan igual, para que la
     * ventana no se quede marcando un código que no es el del mapa.
     */
    _volverAProyeccionPorDefecto(aviso) {
      const actual = this._epsgActivo || this._crsDelVisor().codigo;
      if (actual !== PROYECCION_BASE) {
        this._cambiarProyeccion(PROYECCION_BASE);
      }
      // El relleno va antes del aviso a propósito: _rellenarProyecciones()
      // limpia el hueco de mensajes, así que si el aviso se pusiera antes se
      // perdería justo en el camino de volver a la buena.
      this._rellenarProyecciones();
      if (aviso) this._avisoAlta(aviso, 'error');
    }

    /**
     * Cambia el sistema de coordenadas del visualizador conservando lo que se ve.
     *
     * La API tiene el método (map.setProjection) y funciona, pero al cambiar
     * la proyección deja la vista en (0,0), que es el golfo de Guinea. Aquí se
     * mide antes cuánto mide un píxel de suelo y dónde está el centro, se
     * cambia, y se devuelve la vista a ese mismo sitio: es la cuenta del
     * ejemplo "Projection and Scale" de OpenLayers, que es justamente el
     * patrón canónico para esto.
     *
     * El centro se transporta con la transformación de OpenLayers, que es la
     * que sabe pasar de un sistema al otro. La resolución se reparte con el
     * factor de la proyección nueva, para que el detalle sea el mismo que
     * antes y no el que le toque por su cuenta.
     * @param {string} codigo Código EPSG destino.
     * @returns {boolean} true si el cambio se llegó a hacer.
     */
    _cambiarProyeccion(codigo, forzar) {
      if (this._registrando) return false;
      // En 3D no hay proyección que poner en el mapa, pero sí dos modos de verlo
      // (globo o plano), y eso es lo que hace este camino. Está antes que el
      // resto porque la comprobación de _puedeUsarProyeccion() es de 2D: en 3D no
      // hay vista de OpenLayers y siempre daría falso.
      if (this._es3D(this._map)) return this._cambiarModo3D(codigo);
      if (!this._puedeUsarProyeccion(codigo)) {
        this._rechazar(this._selector);
        this._volverAProyeccionPorDefecto(codigo + ' no se puede usar en este visualizador: no se sabe ' +
          'transformar a ' + PROYECCION_BASE + ', que es la de las capas. ' +
          'Se ha vuelto a la de por defecto.');
        return false;
      }

      const vista = this._vistaOL();
      const anterior = this._epsgActivo || this._crsDelVisor().codigo;
      const antes = {
        centro: this._centroVista(vista),
        sueloPorPx: this._metrosDeSueloPorPx(vista),
      };

      // ¿Cae lo que se está viendo dentro de la zona de la proyección que se
      // pide? Es una pregunta tonta de hacer y evita un desastre: si se elige la
      // UTM de la zona 9 con el mapa centrado en Madrid, el centro cae a 579 km
      // del meridiano, la rejilla de las capas se sale de rango y la API peta con
      // "TypeError: coordinates must be finite numbers" (medido), con su diálogo
      // de error encima. El aviso llega al modal, no a una consola que nadie ve.
      //
      // La comprobación se salta cuando se está RESTAURANDO una proyección que el
      // usuario ya tenía: en ese momento el mapa es nuevo y su centro es el que
      // le haya dado la API (el golfo de Guinea), así que el centro no dice nada
      // de la zona y la comprobación saltaba siempre (medido: al volver de 3D a
      // 2D no se recuperaba la UTM y se quedaba en la 3857).
      if (antes.centro && !forzar) {
        const fuera = this._fueraDeLaZona(antes.centro, codigo);
        if (fuera) {
          this._rechazar(this._selector);
          this._volverAProyeccionPorDefecto(codigo + ' no cubre la zona que se está viendo (' +
            fuera + '), así que no se ha aplicado y se ha vuelto a la de por defecto.');
          return false;
        }
      }
      let proyeccionVieja = null;
      try {
        proyeccionVieja = vista ? vista.getProjection() : null;
      } catch (e) {
        proyeccionVieja = null;
      }

      try {
        // 1) el cambio. Puede lanzar, y no se toca nada más si lo hace.
        if (this._map && typeof this._map.setProjection === 'function') {
          this._map.setProjection(codigo);
        } else {
          vista.setProjection(window.ol.proj.get(codigo));
        }
      } catch (e) {
        console.warn(`${this.name}: no se pudo cambiar a ${codigo}.`, e);
        this._rechazar(this._selector);
        this._volverAProyeccionPorDefecto(codigo + ' ha dado error al aplicarse: ' +
          ((e && e.message) ? e.message : 'error desconocido') +
          '. Se ha vuelto a la de por defecto.');
        return false;
      }

      // 2) el alcance: recortado a la extensión de la proyección o en global,
      // según la casilla. Se pone aquí, ya con la proyección cambiada, porque
      // la extensión que hay que tocar es la de la nueva.
      this._aplicarAlcance(codigo);

      // 3) devolver la vista a lo que se estaba viendo.
      const vistaNueva = this._vistaOL() || vista;
      if (vistaNueva) {
        if (antes.centro) {
          let centro = null;
          try {
            const ol = window.ol;
            centro = ol.proj.transform(antes.centro, proyeccionVieja, vistaNueva.getProjection());
          } catch (e) {
            centro = null;
          }
          // Sin transformación el centro se queda donde lo dejó la API, que es
          // (0,0), y mejor eso que un centro sin sentido calculado a medias.
          if (centro && isFinite(centro[0]) && isFinite(centro[1])) vistaNueva.setCenter(centro);
        }
        if (antes.sueloPorPx !== null) {
          const factor = this._factorProyeccion(vistaNueva);
          if (factor !== null && factor > 0) {
            try {
              vistaNueva.setResolution(antes.sueloPorPx / factor);
            } catch (e) {
              /* la vista se queda con la resolución que le haya dado la API */
            }
          }
        }
      }

      this._epsgActivo = codigo;
      this._registrando = true;
      try {
        // Se repinta el botón y la lista, para que el código nuevo se vea tanto en
        // la tira como dentro de la ventana (que es lo que ha elegido el usuario).
        this._pintarCodigo(codigo);
        if (this._modalLista) {
          Array.prototype.slice.call(this._modalLista.querySelectorAll('input[type="radio"]')).forEach(function (r) {
            r.checked = (r.value === codigo);
          });
        }
      } finally {
        this._registrando = false;
      }
      this._actualizar();
      // La vista no siempre avisa de un cambio de proyección, así que el
      // puntero se vacía: sus coordenadas estaban en el sistema anterior.
      this._enColaPuntero(null);
      if (anterior !== codigo) {
        console.info(`${this.name}: proyección cambiada de ${anterior} a ${codigo}.`);
      }
      return true;
    }

    /**
     * Registra un sistema de coordenadas que OpenLayers no conoce.
     *
     * La vía de la API (`ol.proj.proj4.register()`) no sirve en este bundle: con
     * nueve firmas y 92 combinaciones de claves lanza siempre "Could not parse
     * to valid json: defaultDatum" sin llegar a pedir nada por red. Así que lo
     * que hace la API aquí es poner el nombre y los parámetros
     * (`parseCRSWKTtoJSON`), y el cálculo lo pone el plugin con
     * `addProjection` y `addCoordinateTransforms`, que sí están disponibles.
     * @param {string} codigo Código EPSG, del tipo "EPSG:2154".
     * @param {string} definicion Cadena proj4 o WKT.
     * @returns {boolean} true si el código queda registrado y utilizable.
     */
    _registrarEPSG(codigo, definicion) {
      // El aviso va al hueco de la ventana, no a una sacudida del desplegable: la
      // ventana está abierta y es donde está el campo que hay que corregir. Con
      // el <select> de antes no había dónde decirlo sin cerrar el desplegable.
      if (!codigo || !definicion) {
        this._avisoAlta('Falta el código o la definición.', 'error');
        return false;
      }
      try {
        const ol = window.ol;
        if (!ol || !ol.proj) {
          this._avisoAlta('OpenLayers no está disponible, así que no se puede registrar nada.', 'error');
          return false;
        }
        const yaEsta = !!ol.proj.get(codigo);
        const nombre = this._registrarDefinicion(codigo, definicion);
        if (!nombre) {
          // _registrarDefinicion() devuelve null cuando la proyección no está
          // entre las que este plugin sabe calcular, y en ese caso no ha
          // declarado nada: aquí solo se dice por qué.
          this._avisoAlta(codigo + ' no se ha registrado: esta proyección no está entre las que ' +
            'el visualizador sabe calcular (Mercator, Mercator Auxiliar, Transversal de Mercator ' +
            'y Cónica Conforme de Lambert).', 'error');
          return false;
        }
        // El nombre se guarda antes de usarlo, para que el rótulo salga de
        // PROJCS.name en vez de del código pelado. Y si la definición no traía
        // nombre (una cadena proj4 no lo tiene), se compone uno con el código y
        // el método, que es más útil en la lista que el número pelado.
        this._nombresRegistrados = this._nombresRegistrados || {};
        this._nombresRegistrados[codigo] = (nombre && nombre !== codigo)
          ? nombre
          : this._nombreDeLaDefinicion(definicion, codigo.replace('EPSG:', ''));
        if (!yaEsta) this._proyecciones.push({ codigo: codigo, nombre: nombre });
        this._rellenarProyecciones();
        // Se elige: si el visor puede representarlo, se aplica; si no, se avisa y
        // la lista se queda con la proyección que había.
        if (this._puedeUsarProyeccion(codigo)) {
          this._cambiarProyeccion(codigo);
          this._avisoAlta(codigo + ' añadido y en uso.', 'ok');
          // Los campos se vacían para que el siguiente alta empiece limpio.
          if (this._modalCampoCodigo) this._modalCampoCodigo.value = '';
          if (this._modalCampoDefinicion) this._modalCampoDefinicion.value = '';
          return true;
        }
        this._avisoAlta(codigo + ' se ha registrado pero el visualizador no sabe representarlo ' +
          '(no hay transform con ' + PROYECCION_BASE + '), así que no se ha aplicado.', 'error');
        console.warn(`${this.name}: ${codigo} se ha registrado pero el visor no sabe representarlo ` +
          '(no hay transform con ' + PROYECCION_BASE + '), así que no se ha aplicado.');
        return false;
      } catch (e) {
        const motivo = (e && e.message) ? e.message : String(e);
        this._avisoAlta('No se pudo registrar ' + codigo + ': ' + motivo, 'error');
        console.warn(`${this.name}: no se pudo registrar ${codigo}.`, e);
        return false;
      }
    }

    /**
     * Empareja una proyección recién registrada con todas las demás utilizables.
     *
     * Hace falta porque OpenLayers NO encadena transformaciones: `getTransform`
     * busca un par registrado tal cual y, si no lo hay, devuelve la identidad
     * (que es un par de números que no son de la Tierra, y con él la API se
     * queda). Con solo registrar 4326↔nueva y 3857↔nueva, pasar de una UTM a la
     * nueva no encuentra 25830↔2154 y peta: medido, al elegir la 2154 desde la
     * 25830 salía el diálogo de error de la propia API con "TypeError: t is not a
     * function", y no pasaba al aplicarla desde la 3857, que sí tenía par.
     *
     * El par se compone por la geográfica: otra↔nueva es otra↔4326 seguido de
     * 4326↔nueva. Solo se registra si no lo hay ya, para no pisar las
     * transformaciones que trae la propia API.
     *
     * @param {Object} proyeccion Proyección nueva, ya declarada.
     * @param {{adelante: Function, atras: Function}} transformacion Con 4326.
     * @param {Object} geo Proyección geográfica EPSG:4326.
     */
    _emparejarConLasDemas(proyeccion, transformacion, geo) {
      try {
        const ol = window.ol;
        if (!ol || !ol.proj) return;
        const codigo = proyeccion.getCode();
        const otras = this._leerProyecciones();
        for (let i = 0; i < otras.length; i++) {
          const otra = otras[i].codigo;
          if (otra === codigo) continue;
          let p = null;
          try { p = ol.proj.get(otra); } catch (e) { p = null; }
          if (!p) continue;
          // Si ya hay un par, no se toca: el de la API es mejor que uno hecho aquí.
          if (this._hayTransform(p, proyeccion)) continue;
          const deOtra = ol.proj.getTransform(p, geo);
          const aOtra = ol.proj.getTransform(geo, p);
          ol.proj.addCoordinateTransforms(p, proyeccion,
            function (c) { return transformacion.adelante(deOtra(c)); },
            function (c) { return aOtra(transformacion.atras(c)); });
        }
      } catch (e) {
        // Que no se pueda emparejar con todo el mundo no invalida el alta: solo
        // afecta a los cambios de proyección que no estén emparejados.
        console.warn(`${this.name}: no se pudieron emparejar todas las proyecciones con ${codigo}.`, e);
      }
    }

    /**
     * Traduce una definición a una proyección de OpenLayers y la registra.
     *
     * El nombre sale del método de la API que hay para esto,
     * `IDEE.utils.parseCRSWKTtoJSON`, que devuelve `PROJCS.name`. Las
     * transformaciones las calcula _crearTransformacion() y se enganchan con
     * `addCoordinateTransforms`.
     * @param {string} codigo Código EPSG.
     * @param {string} definicion Cadena proj4 o WKT.
     * @returns {string|null} Nombre del sistema de coordenadas, o null si la
     *   proyección no está entre las que este plugin sabe calcular (en cuyo caso
     *   no se registra nada).
     */
    _registrarDefinicion(codigo, definicion) {
      const ol = window.ol;
      const IDEE = api();
      const geo = ol.proj.get('EPSG:4326');

      // Del WKT sale el nombre y el tipo de proyección. Del nombre se saca
      // además el código, que es la convención de los ficheros WKT.
      let nombre = NOMBRES_EPSG[codigo] || codigo;
      let tipo = '';
      let parametros = {};
      if (definicion.indexOf('PROJCS') === 0 || definicion.indexOf('GEOGCS') === 0) {
        let json = null;
        try {
          json = IDEE.utils.parseCRSWKTtoJSON(definicion);
        } catch (e) {
          json = null;
        }
        if (json && json.PROJCS) {
          if (json.PROJCS.name) nombre = json.PROJCS.name;
          tipo = json.PROJCS.PROJECTION || '';
          const lista = json.PROJCS.PARAMETER || [];
          if (Array.isArray(lista)) {
            lista.forEach(function (p) {
              const claves = Object.keys(p || {});
              if (claves.length) parametros[claves[0]] = p[claves[0]];
            });
          }
        }
      } else {
        // Cadena proj4: los parámetros van con signo igual, así que se
        // reconoce por el "+" inicial de cada par.
        tipo = this._tipoDesdeProj4(definicion);
        const pares = definicion.split(/\s+/);
        pares.forEach(function (par) {
          if (par.indexOf('+') !== 0) return;
          const igual = par.indexOf('=');
          if (igual < 0) return;
          const clave = par.slice(1, igual);
          const valor = Number(par.slice(igual + 1));
          if (isFinite(valor)) parametros[clave] = valor;
        });
      }

      const unidades = (parametros.units === 'm' || parametros.units === undefined)
        ? 'm'
        : (parametros.units === 'deg' ? 'd' : 'm');

      // La transformación se calcula ANTES de declarar la proyección, y si no
      // sale no se declara nada. Es lo que dice la cabecera de este fichero
      // ("en vez de registrar una proyección que miente") y hace falta de verdad:
      // medido que si se declara sin transformación, `ol.proj.get()` la devuelve,
      // la comprobación de _puedeUsarProyeccion() la da por buena y el visor se
      // queda EN EPSG:9999 sin capas y en blanco. Con "+proj=robin", por ejemplo,
      // que no está entre las cuatro que este plugin sabe calcular.
      const transformacion = this._crearTransformacion(tipo, parametros);
      if (!transformacion) {
        return null;
      }

      // Comprobación de ida y vuelta ANTES de declarar nada: se pasa un punto,
      // se vuelve y los dos números tienen que salir como entraron. Es lo que
      // descubre los errores de las inversas, que son de los que no se entera
      // nadie porque la ida está bien: el signo de Lambert (0,38°), el /a que
      // faltaba en la Transversal de Mercator (que devolvía -13 593°) y la
      // derivada mala del Newton de Mercator (que no convergía).
      //
      // El punto de sondeo NO es siempre el mismo, sino el de la propia
      // proyección (su meridiano y su latitud de origen). Sondear siempre Madrid
      // salía mal por el motivo contrario: una UTM de la zona 28 tiene su
      // meridiano en 15° O, así que Madrid está a 11° de él y la serie de
      // Mercator, que está cortada en D⁶, ya no es exacta ni para ida ni para
      // vuelta (medido: 0,0014° de desvío, o sea 150 m), y una proyección
      // perfectamente buena se rechazaba. Lo que se comprueba aquí es que la
      // cuenta esté bien hecha, no que la proyección sirva en todas partes, y
      // para eso el punto tiene que estar donde la proyección es buena.
      //
      // El umbral es de 1e-5 grados, unos 1,1 m en el suelo, y no de 1e-6 porque
      // la serie está cortada en D⁶: su inversa devuelve el punto con medio metro
      // de diferencia (medido: 4,5e-6 grados) y eso no es un fallo, es lo que
      // tiene la serie. Lo que se quiere cazar aquí son los errores de grados, de
      // kilómetros y de NaN.
      const sondeo = this._puntoDeSondeo(parametros);
      const ida = transformacion.adelante(sondeo);
      const vuelta = transformacion.atras(ida);
      const desviacion = Math.max(
        Math.abs(vuelta[0] - sondeo[0]),
        Math.abs(vuelta[1] - sondeo[1])
      );
      if (!isFinite(ida[0]) || !isFinite(ida[1]) || !isFinite(vuelta[0]) || !isFinite(vuelta[1]) || !(desviacion <= 1e-5)) {
        // El `!(desviacion <= 1e-5)` y no `desviacion > 1e-5` es a propósito: con
        // NaN la comparación es falsa en las dos formas, así que la versión
        // corriente dejaría pasar una transformación que devuelve NaN (medido:
        // con la fórmula de Lambert equivocada, la ida salía finita y la vuelta
        // NaN, y el alta se daba por buena).
        console.warn(`${this.name}: la transformación de ${codigo} no vuelve al punto de partida ` +
          `(desviación ${desviacion} grados), así que no se registra.`);
        return null;
      }

      const proyeccion = new ol.proj.Projection({
        code: codigo,
        units: unidades,
        extent: this._extentDeProyeccion(parametros, tipo),
      });

      // Las transformaciones se enganchan con la geográfica (EPSG:4326) Y con la
      // que usan las capas de la API (EPSG:3857), y no solo con la primera.
      //
      // Con solo la de 4326 el registro parecía bueno pero el mapa se quedaba
      // en blanco al aplicarlo: la API, al cambiar la proyección de la vista,
      // pide la transformación 2154→3857 y no la encuentra (con el aviso "No
      // transform available between EPSG:2154 and EPSG:3857"), y la API peta con
      // "TypeError: t is not a function" (medido). Las de 3857 son la composición
      // de la que ya hay (3857→4326) con la que se acaba de calcular
      // (4326→la nueva), y _emparejarConLasDemas() las hace con el resto.
      ol.proj.addProjection(proyeccion);
      ol.proj.addCoordinateTransforms(geo, proyeccion, transformacion.adelante, transformacion.atras);
      this._emparejarConLasDemas(proyeccion, transformacion, geo);
      return nombre;
    }

    /**
     * Punto de sondeo para comprobar una transformación, en grados.
     *
     * Es el de la propia proyección (su meridiano y su latitud de origen), que es
     * donde cualquier proyección está buena. Si la definición no trae esos
     * parámetros se cae a un punto de referencia, que para estas proyecciones es
     * el de la cadena de ejemplo del propio EPSG.
     * @param {Object} p Parámetros de la proyección.
     * @returns {Array<number>} [longitud, latitud] en grados.
     */
    _puntoDeSondeo(p) {
      const lat0 = Number(p.lat_0);
      const lon0 = Number(p.lon_0);
      if (isFinite(lon0) && isFinite(lat0)) return [lon0, lat0];
      return [-3.7038, 40.4168];
    }

    /**
     * Nombre del método de proyección en una cadena proj4.
     * @param {string} definicion Cadena proj4.
     * @returns {string} Nombre del método ("tmerc", "lcc", "merc"...).
     */
    _tipoDesdeProj4(definicion) {
      const enc = /\+proj=([a-z0-9_]+)/i.exec(definicion);
      if (!enc) return '';
      const mapa = {
        tmerc: 'Transverse_Mercator',
        etmerc: 'Transverse_Mercator',
        merc: 'Mercator',
        webmerc: 'Mercator_Auxiliary_Sphere',
        lcc: 'Lambert_Conformal_Conic_2SP',
      };
      return mapa[enc[1].toLowerCase()] || enc[1];
    }

    /**
     * Rectángulo de alcance aproximado de una proyección, para que OpenLayers
     * sepa hasta dónde preguntar antes de dejar de dibujar.
     *
     * Aproximado a propósito: el valor exacto de un sistema proyectado depende
     * de la zona, y una prueba de humo honesta es mejor que un número
     * inventado con seguridad.
     * @param {Object} p Parámetros de la proyección.
     * @returns {Array<number>} Extent [minx, miny, maxx, maxy].
     */
    _extentDeProyeccion(p, tipo) {
      if (p.units === 'deg' || p.units === 'd') return [-180, -90, 180, 90];
      // El método va en `tipo`, no en los parámetros: una cadena proj4 trae
      // "+proj=tmerc", pero eso se lee aparte y en `p` solo quedan los
      // parámetros con su "=". Con la comprobación sobre `p.proj` (que no existe)
      // salía siempre el rectángulo de reserva y la comprobación de "cubre la
      // zona" no llegaba a activarse nunca (medido: la extensión de una UTM
      // registrada salía de 40 000 x 40 000 km).
      const metodo = (tipo === 'Transverse_Mercator') ? 'tmerc'
        : (tipo === 'Lambert_Conformal_Conic_2SP') ? 'lcc'
          : (tipo === 'Mercator' || tipo === 'Mercator_Auxiliary_Sphere') ? 'merc'
            : (p.proj || '');
      if (metodo === 'lcc') {
        const centro = Number(p.lon_0) || 0;
        return [centro - 2.5e6, -5e6, centro + 2.5e6, 5e6];
      }
      if (metodo === 'tmerc') {
        // La zona de una UTM son 6° de longitud, o sea unos 667 km de ancho, y
        // va centrada en el FALSO ESTE (no en el meridiano: eso son grados, no
        // metros, y con el meridiano el rectángulo salía desplazado 500 km, que
        // es justo lo que hacía que la comprobación de "cubre la zona" no viera
        // que Madrid cae fuera de la zona 9).
        const falsoEste = Number(p.x_0 !== undefined ? p.x_0 : p.false_easting) || 0;
        const falsoNorte = Number(p.y_0 !== undefined ? p.y_0 : p.false_northing) || 0;
        const medioAncho = 3.2 * 111320 * Math.cos(((Number(p.lat_0) || 0) * Math.PI) / 180) || 3.2e5;
        return [falsoEste - medioAncho, falsoNorte - 1e7, falsoEste + medioAncho, falsoNorte + 1.2e7];
      }
      return [-2e7, -2e7, 2e7, 2e7];
    }

    /**
     * Construye las dos funciones de transformación de una proyección a partir
     * de sus parámetros, calculadas por el propio plugin.
     *
     * Es lo que hace posible registrar un EPSG sin depender de un servicio de
     * definiciones por red: se implementan las cuatro proyecciones que se
     * pueden escribir corto y comprobar, con las fórmulas de las EPSG
     * Guidance Note 7-2, y si el WKT pide otra se devuelve null en vez de
     * inventar una transformación que dé números falsos.
     *
     * El elipsoide es WGS 84. Para las de ED50 y ETRS89 la diferencia con el
     * propio WGS 84 es de centímetros, y el datum va en la definición, no en
     * la proyección.
     * @param {string} tipo Nombre del método de proyección.
     * @param {Object} p Parámetros.
     * @returns {{adelante: Function, atras: Function}|null} Transformación.
     */
    _crearTransformacion(tipo, p) {
      const a = SEMI_MAYOR_WGS84;
      const f = 1 / ACHATAMIENTO_WGS84;
      const e2 = f * (2 - f);
      const RAD = Math.PI / 180;

      // Para las grados, la cuenta es la identidad: la proyección geográfica no
      // necesita transformación, y aquí solo se registra si la piden.
      if (tipo === 'Geographic' || tipo === 'geographic') {
        return null;
      }

      try {
        if (tipo === 'Transverse_Mercator') {
          const lat0 = (Number(p.lat_0) || 0) * RAD;
          const lon0 = (Number(p.lon_0) || 0) * RAD;
          const k0 = (p.k_0 !== undefined ? Number(p.k_0)
            : (p.scale_factor !== undefined ? Number(p.scale_factor) : 0.9996));
          const x0 = Number(p.x_0 !== undefined ? p.x_0 : p.false_easting) || 0;
          const y0 = Number(p.y_0 !== undefined ? p.y_0 : p.false_northing) || 0;
          const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
          const M0 = a * ((1 - e2 / 4 - 3 * Math.pow(e2, 2) / 64 - 5 * Math.pow(e2, 3) / 256) * lat0
            - (3 * e2 / 8 + 3 * Math.pow(e2, 2) / 32 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(2 * lat0)
            + (15 * Math.pow(e2, 2) / 256 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(4 * lat0)
            - (35 * Math.pow(e2, 3) / 3072) * Math.sin(6 * lat0));

          const adelante = function (c) {
            const lat = c[1] * RAD;
            const lon = c[0] * RAD;
            const dl = lon - lon0;
            const N = a / Math.sqrt(1 - e2 * Math.sin(lat) * Math.sin(lat));
            const T = Math.pow(Math.tan(lat), 2);
            const C = e1 * Math.cos(lat) * Math.cos(lat);
            const A = Math.cos(lat) * dl;
            const M = a * ((1 - e2 / 4 - 3 * Math.pow(e2, 2) / 64 - 5 * Math.pow(e2, 3) / 256) * lat
              - (3 * e2 / 8 + 3 * Math.pow(e2, 2) / 32 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(2 * lat)
              + (15 * Math.pow(e2, 2) / 256 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(4 * lat)
              - (35 * Math.pow(e2, 3) / 3072) * Math.sin(6 * lat));
            const x = k0 * N * (A + (1 - T + C) * Math.pow(A, 3) / 6
              + (5 - 18 * T + Math.pow(T, 2) + 72 * C - 58 * e1) * Math.pow(A, 5) / 120) + x0;
            const y = k0 * (M - M0 + N * Math.tan(lat) * (Math.pow(A, 2) / 2
              + (5 - T + 9 * C + 4 * Math.pow(C, 2)) * Math.pow(A, 4) / 24
              + (61 - 58 * T + Math.pow(T, 2) + 600 * C - 330 * e1) * Math.pow(A, 6) / 720)) + y0;
            return [x, y, c.length > 2 ? c[2] : 0];
          };

          const atras = function (c) {
            const x = c[0] - x0;
            const y = c[1] - y0;
            const M = M0 + y / k0;
            // La latitud se recupera por Newton sobre el arco meridiano, que
            // converge en tres o cuatro iteraciones para estos valores.
            let mu = M / (a * (1 - e2 / 4 - 3 * Math.pow(e2, 2) / 64 - 5 * Math.pow(e2, 3) / 256));
            let lat = mu;
            for (let i = 0; i < 8; i++) {
              const F = a * ((1 - e2 / 4 - 3 * Math.pow(e2, 2) / 64 - 5 * Math.pow(e2, 3) / 256) * lat
                - (3 * e2 / 8 + 3 * Math.pow(e2, 2) / 32 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(2 * lat)
                + (15 * Math.pow(e2, 2) / 256 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(4 * lat)
                - (35 * Math.pow(e2, 3) / 3072) * Math.sin(6 * lat)) - M;
              // La derivada del arco meridiano es la cuenta CLARA, no la
              // serie de arriba diferenciada a mano:
              //   dM/dφ = a(1 − e²)/(1 − e²sin²φ)^(3/2)
              // Estaba mal puesta y por eso el Newton no convergía: multiplicaba
              // por cos(φ) en vez de dividir por (1 − e²sin²φ)^(3/2), y cerca del
              // ecuador las dos cosas valen casi lo mismo, así que a 40° el paso
              // sale 1,3 veces corto y la iteración se va (medido: Madrid
              // volvía a -13 593° de latitud).
              const sinLatNewton = Math.sin(lat);
              const dF = a * (1 - e2) / Math.pow(1 - e2 * sinLatNewton * sinLatNewton, 1.5);
              if (Math.abs(dF) < 1e-12) break;
              const paso = F / dF;
              lat -= paso;
              if (Math.abs(paso) < 1e-14) break;
            }
            const sinLat = Math.sin(lat);
            const cosLat = Math.cos(lat);
            const tanLat = Math.tan(lat);
            const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
            const T = tanLat * tanLat;
            const C = e1 * cosLat * cosLat;
            const D = x / (N * k0);
            // OJO con el /a de la corrección de la latitud: en el EPSG 9807 al revés la
            // fórmula es (N₁·tanφ₁/R)·(D²/2 − ...), y ese cociente SIN
            // DIMENSIONES es lo que convierte un D en radianes de latitud. Sin
            // el /a el término sale en metros y se le resta a una latitud que
            // está en radianes: el error es de a lo ancho de la Tierra, y el
            // punto volvía a -13 593° de latitud (medido). La ida estaba bien,
            // que es por lo que no se veía.
            const latR = lat - (N * tanLat / k0 / a) * (Math.pow(D, 2) / 2
              - (5 + 3 * T + 10 * C - 4 * Math.pow(C, 2) - 9 * e1) * Math.pow(D, 4) / 24
              + (61 + 90 * T + 298 * C + 45 * Math.pow(T, 2) - 252 * e1 - 3 * Math.pow(C, 2)) * Math.pow(D, 6) / 720);
            const lonR = lon0 + (D - (1 + 2 * T + C) * Math.pow(D, 3) / 6
              + (5 - 2 * C + 28 * T - 3 * Math.pow(C, 2) + 8 * e1 + 24 * Math.pow(T, 2)) * Math.pow(D, 5) / 120) / cosLat;
            return [lonR / RAD, latR / RAD, c.length > 2 ? c[2] : 0];
          };
          return { adelante: adelante, atras: atras };
        }

        if (tipo === 'Lambert_Conformal_Conic_2SP') {
          const lat1 = (Number(p.lat_1) || 0) * RAD;
          const lat2 = (Number(p.lat_2) !== undefined ? Number(p.lat_2) : Number(p.lat_1) || 0) * RAD;
          const lat0 = (Number(p.lat_0) || 0) * RAD;
          const lon0 = (Number(p.lon_0) || 0) * RAD;
          const x0 = Number(p.x_0 !== undefined ? p.x_0 : p.false_easting) || 0;
          const y0 = Number(p.y_0 !== undefined ? p.y_0 : p.false_northing) || 0;
          const e = Math.sqrt(e2);

          // Las fórmulas son las del EPSG 9807 (Guidance Note 7-2). Lo que hay
          // aquí estaba mal en dos sitios, y los dos se compensaban de lejos:
          // la auxiliar t era tan(π/4 + φ/2) en vez de la del EPSG, y la m era el
          // radio de curvatura en vez de la meridiana. Medido con el ejemplo
          // publicado del propio EPSG (NAD27 / Texas South Central): con las
          // fórmulas erróneas daba X 2 293 677 en vez de 2 963 504, y en
          // Lambert-93 Paris salía a 12 km y 472 km de desvío.
          //
          // Las dos auxiliares que hacen falta:
          //   m(φ) = cos φ / √(1 − e²sin²φ)                (la meridiana)
          //   t(φ) = tan(π/4 − φ/2) · [(1 + e·sin φ)/(1 − e·sin φ)]^(e/2)
          // El cociente de t va CON el + en el numerador: al revés sale un 0,2%
          // de error en cada t, que es poco pero se acumula en n y en F.
          // Comprobado contra los valores intermedios que publica el EPSG para
          // su ejemplo (m1, m2, t1, t2, tF, t, n y F): los ocho salen iguales
          // hasta el octavo decimal, y ρ sale 11 449 846,97 m, que son los
          // 37 565 039,86 pies que publica.
          const mDe = function (x) { return Math.cos(x) / Math.sqrt(1 - e2 * Math.sin(x) * Math.sin(x)); };
          const tDe = function (x) {
            const s = Math.sin(x);
            return Math.tan(Math.PI / 4 - x / 2) * Math.pow((1 + e * s) / (1 - e * s), e / 2);
          };
          // Con dos paralelos, n sale de ellos; con uno solo (los dos iguales),
          // n = sin(φ) del paralelo, que es el caso que el EPSG recoge aparte.
          const n = (Math.abs(lat1 - lat2) < 1e-9)
            ? Math.sin(lat1)
            : (Math.log(mDe(lat1)) - Math.log(mDe(lat2))) / (Math.log(tDe(lat1)) - Math.log(tDe(lat2)));
          const F = mDe(lat1) / (n * Math.pow(tDe(lat1), n));
          const rho = function (x) { return a * F * Math.pow(tDe(x), n); };
          const rho0 = rho(lat0);
          if (!isFinite(F) || !isFinite(rho0)) return null;

          const adelante = function (c) {
            const r = rho(c[1] * RAD);
            const theta = n * (c[0] * RAD - lon0);
            return [
              x0 + r * Math.sin(theta),
              y0 + rho0 - r * Math.cos(theta),
              c.length > 2 ? c[2] : 0,
            ];
          };

          // La inversa del EPSG lleva la corrección del elipsoide con la propia
          // latitud dentro del término, así que no se puede despejar de una vez:
          // se itera, y con dos o tres vueltas sale. El EPSG avisa de lo mismo en
          // su variante (2SP Belgium), donde lo dice "the formula for lat
          // requires iteration".
          //
          // Y la corrección va DIVIDIENDO, no multiplicando: t(φ) es
          // tan(π/4 − φ/2) POR la corrección, así que para despejar el
          // tangente hay que dividir por ella. Al revés salen 0,38° de error en
          // la latitud (medido: Madrid volvía a 40,04° en vez de a 40,42°), que
          // es poco y por eso no se veía: solo lo caza la comprobación de ida y
          // vuelta.
          const atras = function (c) {
            const dx = c[0] - x0;
            const dy = rho0 - (c[1] - y0);
            const theta = Math.atan2(dx, dy);
            // El signo de ρ lo pone el hemisferio: en el sur, n es negativo.
            const rhoPrima = (n < 0 ? -1 : 1) * Math.sqrt(dx * dx + dy * dy);
            const t = Math.pow(rhoPrima / (a * F), 1 / n);
            let lat = Math.PI / 2 - 2 * Math.atan(t);
            for (let vuelta = 0; vuelta < 6; vuelta++) {
              const s = Math.sin(lat);
              const correccion = Math.pow((1 + e * s) / (1 - e * s), e / 2);
              const nuevo = Math.PI / 2 - 2 * Math.atan(t / correccion);
              if (Math.abs(nuevo - lat) < 1e-12) { lat = nuevo; break; }
              lat = nuevo;
            }
            return [(theta / n + lon0) / RAD, lat / RAD, c.length > 2 ? c[2] : 0];
          };
          return { adelante: adelante, atras: atras };
        }

        if (tipo === 'Mercator' || tipo === 'Mercator_Auxiliary_Sphere') {
          const lat0 = (Number(p.lat_0) || 0) * RAD;
          const lon0 = (Number(p.lon_0) || 0) * RAD;
          const k0 = (p.k_0 !== undefined ? Number(p.k_0) : 1);
          const x0 = Number(p.x_0 !== undefined ? p.x_0 : p.false_easting) || 0;
          const y0 = Number(p.y_0 !== undefined ? p.y_0 : p.false_northing) || 0;
          // El Mercator de esfera auxiliar (el de EPSG:3857) usa la esfera, y
          // el de elipsoide lleva una corrección. Se separan porque no son el
          // mismo número, y confundirlos es el error clásico.
          const usaEsfera = (tipo === 'Mercator_Auxiliary_Sphere');
          const e = usaEsfera ? 0 : Math.sqrt(e2);

          // Latitud Mercator de una latitud geodésica, en radianes.
          const psi = function (lat) {
            if (usaEsfera) return Math.log(Math.tan(Math.PI / 4 + lat / 2));
            const sinLat = Math.sin(lat);
            return Math.log(Math.tan(Math.PI / 4 + lat / 2))
              - (e / 2) * Math.log((1 + e * sinLat) / (1 - e * sinLat));
          };
          const psi0 = psi(lat0);

          const adelante = function (c) {
            const lat = c[1] * RAD;
            return [
              x0 + k0 * a * (c[0] * RAD - lon0),
              y0 + k0 * a * (psi(lat) - psi0),
              c.length > 2 ? c[2] : 0,
            ];
          };

          const atras = function (c) {
            const lon = ((c[0] - x0) / (k0 * a)) + lon0;
            const y = (c[1] - y0) / (k0 * a) + psi0;
            // Sin corrección de elipsoide la inversa es directa; con ella hay
            // que despejar la latitud, y se hace con Newton sobre psi().
            let lat;
            if (usaEsfera) {
              lat = Math.PI / 2 - 2 * Math.atan(Math.exp(-y));
            } else {
              lat = y;
              for (let i = 0; i < 12; i++) {
                const paso = (psi(lat) - y) / derivadaPsi(lat, e, e2);
                lat -= paso;
                if (Math.abs(paso) < 1e-14) break;
              }
            }
            return [lon / RAD, lat / RAD, c.length > 2 ? c[2] : 0];
          };
          return { adelante: adelante, atras: atras };
        }
      } catch (e) {
        return null;
      }
      // Una proyección que no está en la lista se dice, no se disimula.
      return null;
    }

    // =====================================================================
    // GESTIÓN DE LISTENERS
    // =====================================================================

    /**
     * Registra un listener DOM y lo anota para poder soltarlo en destroy().
     * @param {EventTarget} objetivo Elemento destino.
     * @param {string} tipo Tipo de evento.
     * @param {Function} fn Función escuchada.
     * @param {Object|boolean} [opciones] Opciones de addEventListener.
     */
    _on(objetivo, tipo, fn, opciones) {
      if (!objetivo || typeof objetivo.addEventListener !== 'function') return;
      objetivo.addEventListener(tipo, fn, opciones);
      this._listeners.push({ objetivo: objetivo, tipo: tipo, fn: fn, opciones: opciones });
    }

    /**
     * Registra un listener de la API sobre el mapa (map.on).
     * @param {string} tipo Constante de IDEE.evt.
     * @param {Function} fn Función escuchada.
     */
    _onApi(tipo, fn) {
      if (!tipo || !this._map || typeof this._map.on !== 'function') return;
      try {
        this._map.on(tipo, fn);
        this._listenersApi.push(tipo);
      } catch (e) {
        /* El evento no existe en esta versión de la API */
      }
    }

    /**
     * Suelta todos los listeners registrados (DOM, API y Cesium).
     */
    _offAll() {
      for (let i = 0; i < this._listeners.length; i++) {
        const l = this._listeners[i];
        try {
          l.objetivo.removeEventListener(l.tipo, l.fn, l.opciones);
        } catch (e) {
          /* silencioso */
        }
      }
      this._listeners = [];

      for (let i = 0; i < this._listenersApi.length; i++) {
        try {
          if (this._map && typeof this._map.off === 'function') this._map.off(this._listenersApi[i]);
        } catch (e) {
          /* silencioso */
        }
      }
      this._listenersApi = [];

      for (let i = 0; i < this._listenersCesium.length; i++) {
        const l = this._listenersCesium[i];
        try {
          if (l.destino && typeof l.destino.removeEventListener === 'function') {
            l.destino.removeEventListener(l.fn);
          }
        } catch (e) {
          /* silencioso */
        }
      }
      this._listenersCesium = [];

      if (this._esperaEscena) {
        if (window.clearTimeout) window.clearTimeout(this._esperaEscena);
        this._esperaEscena = null;
      }

      if (this._timerRechazo) {
        if (window.clearTimeout) window.clearTimeout(this._timerRechazo);
        this._timerRechazo = null;
      }

      // Un fotograma pendiente de pintar seguiría escribiendo en un nodo que
      // ya no existe, así que se cancela.
      if (this._rafPuntero !== null) {
        try {
          if (window.cancelAnimationFrame) window.cancelAnimationFrame(this._rafPuntero);
        } catch (e) {
          /* silencioso */
        }
        this._rafPuntero = null;
      }
    }

    // =====================================================================
    // CICLO DE VIDA: MONTAJE EN EL MAPA
    // =====================================================================

    /**
     * Método invocado por mapajs.addPlugin(pluginInstancia).
     * @param {Object} map Instancia del mapa (IDEE.Map / M.Map).
     */
    addTo(map) {
      this._map = map;
      const IDEE = api();
      const evt = (IDEE && IDEE.evt) ? IDEE.evt : {};
      const self = this;

      this._host = this._resolveHost(map);
      if (!this._host) {
        console.warn(`${this.name}: no se encontró el contenedor del mapa para la escala.`);
        return;
      }

      // 1) Construir e insertar la lectura (una sola vez).
      if (!this._container) {
        const ui = this._construirUI();
        if (!this._montarEnArea(ui)) {
          // Sin banda (ext/areaControls no cargada): se ancla abajo a la
          // izquierda, que es donde la ponía el control de la API.
          ui.classList.add('g-mapInfo--suelto');
          this._host.appendChild(ui);
        }
        this._container = ui;
        this._aplicarColores();
      }

      // 2) Refresco: en 2D con los eventos de la API y con la vista de OL (que
      //    es la que avisa de los movimientos hechos por código), en 3D con la
      //    cámara.
      this._onApi(evt.CHANGE_ZOOM, function () { self._actualizar(); });
      this._onApi(evt.MOVE, function () { self._actualizar(); });
      this._onApi(evt.COMPLETED, function () { self._actualizar(); });
      this._on(window, 'resize', function () { self._actualizar(); });

      if (this._es3D(map)) {
        this._vigilarCamara();
      } else {
        this._vigilarVistaOL();
        this._vigilarCapas();
      }
      // El puntero y el botón de proyección.
      this._vigilarPuntero();
      this._rellenarProyecciones();
      this._ajustarSelector();

      // 3) La repetición lateral, también al arrancar. La capa base de la API
      //    nace recortada al mundo entero y eso se come las copias que dibuja
      //    OpenLayers al repetir (medido: en 3857, con la vista pasado +180, se
      //    ve 98 69 0 0 0 por quintiles de píxeles con color y, con la extensión
      //    ensanchada, 98 100 99 97 99). Sin esta llamada el visor arrancaría sin
      //    repetición y el mapa se cortaría en ±180 hasta que se tocase algo.
      if (!this._es3D(map)) this._recortarCapas(null);

      // 4) Primer pintado.
      this._aplicarVisibilidad();
      this._actualizar();
    }

    /**
     * Desmonta el plugin: quita el DOM creado y desconecta los listeners.
     */
    destroy() {
      this._offAll();
      // Antes de soltar el mapa se le devuelve a cada capa la extensión que
      // tenía: el recorte es cosa del plugin y, si se va el plugin, el mapa
      // tiene que quedarse como estaba.
      this._recortarCapas(null, true);
      if (this._area && this._container) {
        // El div de la banda, para poder comprobar si queda vacia.
        const banda = this._container.parentNode;
        try {
          this._area.desmonta(this._container);
        } catch (e) {
          /* silencioso */
        }
        // Si la banda se queda sin elementos se suelta entera: si no, sus
        // escuchadores (resize y MutationObserver sobre el rail) seguirian
        // vivos sin nadie que rellene el div.
        if (banda && banda.children.length === 0 && typeof this._area.destroy === 'function') {
          try {
            this._area.destroy();
            if (banda.parentNode) banda.parentNode.removeChild(banda);
          } catch (e) {
            /* silencioso */
          }
        }
      }
      if (this._container && this._container.parentNode) {
        try {
          this._container.parentNode.removeChild(this._container);
        } catch (e) {
          /* silencioso */
        }
      }
      // La ventana va colgada del body, no del contenedor, así que hay que
      // quitarla aparte: si no se queda en la pantalla al desmontar el plugin.
      if (this._modal) {
        try {
          if (this._modal.parentNode) this._modal.parentNode.removeChild(this._modal);
        } catch (e) {
          /* silencioso */
        }
      }
      this._modal = null;
      this._modalVentana = null;
      this._modalFondo = null;
      this._modalLista = null;
      this._modalCampoBuscar = null;
      this._modalCuenta = null;
      this._modalCampoCodigo = null;
      this._modalCampoCodigoBusqueda = null;
      this._modalCampoDefinicion = null;
      this._modalAviso = null;
      this._modalPanelCodigo = null;
      this._modalPanelDef = null;
      this._modalPestanaCodigo = null;
      this._modalPestanaDef = null;
      this._modalBotonBuscar = null;
      this._codigoSelector = null;
      this._container = null;
      this._elEtiqueta = null;
      this._elValor = null;
      this._elUnidad = null;
      this._elCoordenadas = null;
      this._etiquetaCoordenadas = null;
      this._selector = null;
      this._codigoSelector = null;
      this._etiquetaSelector = null;
      this._cajaAlcance = null;
      this._casillaAlcance = null;
      this._etiquetaAlcance = null;
      this._campoEditando = null;
      this._descartar = null;
      this._textoAlEntrar = null;
      this._timerRechazo = null;
      if (this._timerNombres) {
        clearTimeout(this._timerNombres);
        this._timerNombres = null;
      }
      this._ultimoPrincipal = null;
      this._ultimoEscala = null;
      this._proyecciones = [];
      this._epsgActivo = null;
      this._punteroEnCola = null;
      this._area = null;
      this._host = null;
      this._map = null;
    }

    // =====================================================================
    // CONTRATO DE ESTADO (CAMBIO DE IMPLEMENTACIÓN 2D / 3D)
    // =====================================================================

    /**
     * Captura el estado serializable mínimo de la interfaz.
     *
     * La proyección entra aquí porque el cambio de implementación rehace el
     * mapa desde cero: el mapa nuevo vuelve a EPSG:3857, así que sin
     * guardarla el usuario se encontraría con su visor en otra proyección
     * distinta de la que había elegido. Es un código, no un idLayer, y no
     * depende de la proyección, así que sobrevive al swap sin más que
     * copiar un código a otro sitio.
     *
     * El recorte entra por el mismo motivo: es una manera de ver el mapa, y si
     * no se guarda, al volver de 3D a 2D el visor saldría en global aunque el
     * usuario lo tuviera recortado a la franja de su proyección.
     * @returns {{visible: boolean, epsg: string|null, recortar: boolean}} Estado.
     */
    getState() {
      let epsg = this._epsgActivo;
      if (!epsg) {
        const codigo = this._crsDelVisor().codigo;
        // El 4979 de 3D no es elegible: en 2D no hayProjection que lo
        // produzca, así que se guarda como está para no inventar nada.
        epsg = (codigo && codigo !== PROYECCION_3D) ? codigo : null;
      }
      return {
        visible: Boolean(this._visible),
        epsg: epsg,
        recortar: Boolean(this._recortar),
        // El modo de la vista de Cesium viaja aparte de `epsg`, porque `epsg` es
        // lo de 2D y este modo solo existe en 3D: sin campo propio, al ir de 2D a
        // 3D el visualizador volvía siempre al modo globo.
        epsg3D: this._epsg3D,
      };
    }

    /**
     * Restaura el estado en la instancia ya montada (addTo ya se ejecutó
     * tras el swap 2D/3D). No reconstruye la interfaz.
     * @param {Object} state Estado previamente capturado con getState().
     * @param {Object} [map] Nueva instancia del mapa.
     */
    setState(state, map) {
      if (map) this._map = map;
      if (state && typeof state === 'object' && typeof state.visible === 'boolean') {
        this._visible = state.visible;
      }
      // El recorte se restaura ANTES de cambiar la proyección, para que al
      // cambiar se encuentre ya con la casilla en su sitio y la extensión de la
      // proyección nueva se ajuste como toca.
      if (state && typeof state === 'object' && typeof state.recortar === 'boolean') {
        this._recortar = state.recortar;
        if (this._casillaAlcance) this._casillaAlcance.checked = this._recortar;
      }
      this._aplicarVisibilidad();

      if (state && typeof state === 'object' && state.epsg && !this._es3D(this._map)) {
        // El mapa es nuevo y está en 3857: se devuelve a la proyección
        // elegida. Se hace por _cambiarProyeccion(), que además conserva la
        // extensión, para que el mapa no aparezca en otro sitio.
        this._epsgActivo = null;
        if (!this._cambiarProyeccion(state.epsg, true)) {
          // Si ya es la de por defecto no hay nada que hacer y no es un fallo.
          this._epsgActivo = null;
        }
      } else if (this._es3D(this._map) && state && typeof state === 'object' && state.epsg) {
        // En 3D la proyección del mapa es el EPSG:4979 del globo y no hay nada que
        // aplicar, pero la que eligió el usuario se guarda igualmente, porque es
        // lo único que sabe cuál era. Sin esto el viaje de ida llevaba la
        // proyección y el de vuelta no la llevaba, y el usuario se encontraba el
        // visualizador en la 3857 al volver de 3D (medido).
        this._epsgActivo = state.epsg;
      }

      // El modo de la vista de Cesium se restaura aquí, y solo en 3D: es lo que
      // decide si se ve el globo o el plano y en qué unidades se leen las
      // coordenadas. Sin esto, al volver de 2D a 3D salía siempre en globo.
      if (this._es3D(this._map) && state && typeof state === 'object' && MODO_3D[state.epsg3D]) {
        this._epsg3D = state.epsg3D;
        this._aplicarModo3D(MODO_3D[state.epsg3D]);
      }

      if (this._es3D(this._map)) {
        // El puntero ya quedó vigilado en addTo(), que se ejecuta antes que
        // este método: volver a escucharlo aquí duplicaría los listeners.
        this._vigilarCamara();
      } else {
        this._actualizar();
      }
      // El botón y la casilla se reajustan en los dos casos, porque su estado
      // depende de la implementación (en 3D no hay proyección que cambiar ni nada
      // que recortar) y esta instancia se acaba de montar con lo que tuviera la
      // anterior. Sin esto el botón se quedaba deshabilitado después de venir de
      // 3D y la ventana no se abría.
      this._ajustarSelector();
    }

    /**
     * Cambia la visibilidad de la lectura.
     * @param {boolean} visible true para mostrar, false para ocultar.
     */
    setVisible(visible) {
      this._visible = Boolean(visible);
      this._aplicarVisibilidad();
    }

    /**
     * @returns {boolean} Visibilidad actual solicitada por el usuario.
     */
    getVisible() {
      return Boolean(this._visible);
    }
  }

  // =====================================================================
  // EXPOSICIÓN TRIPLE GLOBAL DEL PLUGIN
  // =====================================================================
  // Al alternar entre OpenLayers (2D) y Cesium (3D) con cambioImpl, la API
  // recarga su bundle y reinicializa window.IDEE.plugin / window.M.plugin.
  // Exponer la clase también en el ámbito global directo permite
  // re-instanciarla sin volver a cargar este fichero.
  // =====================================================================
  if (typeof window !== 'undefined') {
    window.miPlugin_mapInfo = miPlugin_mapInfo;
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_mapInfo = miPlugin_mapInfo;
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_mapInfo = miPlugin_mapInfo;
  }
})();
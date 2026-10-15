/* =====================================================================
   Plantilla de visualizador (API-IDEE / API-CNIG)
   ---------------------------------------------------------------------
   Lo mínimo para tener un visualizador en marcha:

     1. el HTML con el contenedor del mapa (#mapaDIV) y el de carga
        (#cargaSVG), más los scripts de la API;
     2. una hoja de estilo que da el alto al contenedor del mapa;
     3. una función mapa() que crea el mapa y lo devuelve.

   Aquí NO hay ningún plugin ni ninguna configuración: ni capas base
   propias, ni proxy, ni controles, ni capas. El mapa sale con lo que la API
   pone por defecto, que es justo lo que conviene ver funcionando antes de
   añadir nada encima.

   Lo habitual es partir de aquí y descomentar de abajo solo lo que
   interese. Cada bloque va anotado con lo que trae y con el aviso de lo que
   conviene tener en cuenta al activarlo.
   ===================================================================== */

const SVGCarga = document.getElementById("cargaSVG");
window.onload = function () { SVGCarga.hidden = true; };

function mapa() {
  SVGCarga.hidden = false;

  // ── Mapa ──────────────────────────────────────────────────────────
  // Se declara en una variable global a propósito: la propia API la usa
  // para sus plugins y para el cambio entre 2D y 3D, y muchos plugins del
  // repositorio la leen de ahí.
  mapajs = IDEE.map({
    container: "mapaDIV",
  });

  // ── Capas base propias (opcional) ─────────────────────────────────
  // Sin esto el mapa sale con la capa base que trae la API. Al activarlo,
  // la carpeta img/ del visualizador guarda las miniaturas del selector
  // visual (imgPreview).
  //
  // IDEE.config.backgroundlayers = [
  //   {
  //     id: "imagen",
  //     title: "Imagen",
  //     imgPreview: "img/imagen.png",
  //     layers: ["QUICK*BASE_PNOA_MA_TMS"],
  //   },
  // ];
  //
  // IDEE.proxy(false);

  // ── Controles (opcional) ──────────────────────────────────────────
  // La API pone los suyos mientras no se indique nada. Si se indican, la
  // lista es completa: lo que no esté, no sale.
  //
  // controls: ['zoom', 'scale'],

  // ── Plugins (opcional) ───────────────────────────────────────────
  // Se registran en el mapa con mapajs.addPlugin(). Cada uno necesita
  // antes su <link> y su <script> en index.html.
  //
  // mapajs.addPlugin(new IDEE.plugin.miPlugin_baseLayer({ rows: 1 }));
  // mapajs.addPlugin(new IDEE.plugin.miPlugin_layerSwitcher());
  //
  // Si hace falta conservar una referencia para llamarlo después, se
  // declara antes en una variable:
  //
  // const baseLayerPlugin = new IDEE.plugin.miPlugin_baseLayer({ rows: 1 });
  // mapajs.addPlugin(baseLayerPlugin);
  //
  // Ojo con el control 'scale' si el visualizador va a alternar 2D/3D: la
  // implementación Cesium no sabe construirlo y lanza "La implementación
  // usada no puede crear controles Scale", con lo que aborta la creación
  // del mapa. En ese caso la lectura de escala la pone el plugin
  // miPlugin_mapInfo, en lugar de ese control.

  SVGCarga.hidden = true;
  return mapajs;
}

// Arranque.
mapajs_0 = mapa();

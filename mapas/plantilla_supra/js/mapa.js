/* =====================================================================
   Visualizador de ejemplo: Plantilla de Supraplugin con Item modelo
   Repositorio: Galeria_de_mapas
   --------------------------------------------------------------------
   Este visualizador demuestra el montaje de una barra supraplugin
   (`miPlugin_supraplugin`) transversal al visualizador cartográfico, al
   estilo de las barras de Ubuntu:

     - una barra que contiene items sueltos (un item modelo del
       repositorio, un separador y un control HTML suelto);
     - un SUPRAPLUGIN ANIDADO: en su barra aparece un botón y, al activarlo,
       se despliega otra barra hermana con sus propios items;
     - el PLEGADO por el "tirador" (los puntitos): con `pinned: false` la
       barra se pliega y asoma sola mientras el puntero esté encima; con un
       click se fija abierta o cerrada.

   Incluye además los plugins estándar del repositorio:
   - `miPlugin_cambioImpl`: alternancia entre 2D (OpenLayers) y 3D (Cesium),
     demostrando la preservación del estado de la UI (item, plegado y barras
     hijas abiertas) mediante getState / setState coordinado por
     `window.EstadoPlugins`.
   - `miPlugin_baseLayer`: selector de capas base IGN.
   - `miPlugin_layerSwitcher`: árbol y selector de capas temáticas.
   ===================================================================== */

const SVGCarga = document.getElementById("cargaSVG");
window.onload = (event) => {
  SVGCarga.hidden = true;
};

/**
 * Control HTML suelto, para comprobar que la barra admite cualquier
 * HTMLElement además de los items del contrato `getSupraElement`.
 * @returns {HTMLElement} El control ya montado.
 */
function controlHTML() {
  const wrap = document.createElement("div");
  wrap.className = "plantillaItem";

  const sel = document.createElement("select");
  sel.id = "demo-enfoque";
  sel.setAttribute("aria-label", "Nivel de detalle");
  ["General", "Detallado", "Muy detallado"].forEach((t, i) => {
    const op = document.createElement("option");
    op.value = String(i);
    op.textContent = t;
    sel.appendChild(op);
  });
  sel.addEventListener("change", function () {
    console.log("[plantilla_supra] Nivel de detalle:", this.value);
  });
  wrap.appendChild(sel);
  return wrap;
}

/**
 * Función principal de arranque del mapa y plugins.
 * Se invoca al cargar la página y como callback (`mapsFunction`)
 * al alternar la implementación 2D/3D con `cambioImpl`.
 *
 * @returns {Object} Instancia del mapa API-IDEE creado (`mapajs`).
 */
function iniciar() {
  SVGCarga.hidden = false;

  // 1. Inicialización del mapa API-IDEE anfitrión
  mapajs = IDEE.map({
    container: "mapaDIV"
  });

  // 2. Barra supraplugin principal. `pinned: false` la deja en modo hover:
  //    plegada y asomando al pasar el puntero; un click en el tirador la fija
  //    abierta, y otro click la deja cerrada de forma definitiva.
  const supra = new IDEE.plugin.miPlugin_supraplugin({
    id: "supra-plantilla",
    position: "top",
    title: "Plantilla supraplugin",
    collapsed: true,
    pinned: false,
    collapsible: true,
    peek: true
  });

  // 3. Creación del item modelo y acoplamiento a la barra
  const itemPlantilla = new IDEE.plugin.miPlugin_plantillaItem({
    texto: "Botón de ejemplo",
    vecesPulsado: 0,
    activo: false,
    onClick: function (itemInstancia, evento) {
      console.log("[plantilla_supra] Item pulsado:", itemInstancia.getState());
    }
  });

  supra.addItem(itemPlantilla);
  supra.addSeparator();
  supra.addItem(controlHTML());

  // 4. SUPRAPLUGIN ANIDADO: aparece como un botón en la barra del padre y,
  //    al activarlo, despliega su propia barra hermana apilada en el mismo
  //    dock (debajo de la del padre). No se registra en el mapa con
  //    addPlugin(): lo monta la barra que lo contiene.
  const supraHerramientas = new IDEE.plugin.miPlugin_supraplugin({
    id: "supra-plantilla-hijas",
    position: "top",
    title: "Herramientas",
    collapsed: false,
    pinned: true
  });
  supraHerramientas.addItem(new IDEE.plugin.miPlugin_plantillaItem({
    texto: "Herramienta anidada",
    order: 0
  }));
  supraHerramientas.addItem(controlHTML());
  supra.addSupraplugin(supraHerramientas);

  // 5. Registro del supraplugin en el mapa
  mapajs.addPlugin(supra);

  // 6. Plugins adicionales estándar del repositorio
  mapajs.addPlugin(new IDEE.plugin.miPlugin_cambioImpl({
    buttonTitle: "cambiar impl :)",
    mapsFunction: iniciar,
    sameMap: true,
    shareView: true,
    shareLayers: true
  }));

  mapajs.addPlugin(new IDEE.plugin.miPlugin_baseLayer({ rows: 1 }));
  mapajs.addPlugin(new IDEE.plugin.miPlugin_layerSwitcher());

  // 7. Ocultación del indicador de carga
  SVGCarga.hidden = true;

  return mapajs;
}

// Arranque inicial al cargar el script
var mapajs_0 = iniciar();
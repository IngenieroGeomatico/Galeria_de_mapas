// Plugin ClampToGround para API-IDEE (visor de constelaciones, Cesium 3D).
// Sigue el protocolo de ext_backgorundLayers.js: clase con constructor + getHelp
// + addTo(map). Se instancia con mapajs.addPlugin(new miPlugin_clampToGround()).
//
// El objeto global de la API puede llamarse IDEE (builds api-idee) o M (builds
// api-core). Elegimos el que tenga la API REALMENTE cargada (con .ui/.map): el
// bloque de exposición de este mismo archivo crea un window.IDEE vacío como
// namespace de plugins, así que no basta con comprobar que IDEE exista.
function api_clampToGround() {
  const IDEE = window.IDEE;
  if (IDEE && IDEE.ui && IDEE.map) return IDEE;
  const M = window.M;
  if (M && M.ui && M.map) return M;
  return IDEE || M;
}

class miPlugin_clampToGround {
  constructor(options = {}) {
    this.name = 'miPlugin_clampToGround';
    this.options = options || {};
    this.map = null;
  }

  getHelp() {
    const IDEE = api_clampToGround();
    return {
      title: 'Proyección de geometrías',
      content: new Promise((success) => {
        let html = '<div><p>Alterna la proyección de las geometrías: pegadas al ' +
          'terreno (clamp to ground) o sobre la esfera celeste.</p></div>';
        html = IDEE.utils.stringToHtml(html);
        success(html);
      }),
    };
  }

  addTo(map) {
    this.map = map;
    const IDEE = api_clampToGround();
    const self = this;

    const panelExtraControlC1 = new IDEE.ui.Panel('toolsExtra1C1', {
      className: 'm-herramientaC1',
      collapsedButtonClass: 'm-tools',
      position: IDEE.ui.position.TL,
    });

    map.addPanels([panelExtraControlC1]);

    document.querySelector('.m-herramientaC1 .m-panel-controls').innerHTML +=
      `
        <div class="m-control m-herramienta-container">
              <button id="m-herramienta-button" class="buttonHerramienta" title="Herramienta"></button>
        </div>
      `;

    const controlC1 = new IDEE.Control(new IDEE.impl.Control(), 'ControlPruebaC1');

    // Compartimos la variable con window (compatibilidad con el resto del visor).
    window.controlC1 = controlC1;

    // Capas proyectables (tienen 'proj') -> su capa Cesium subyacente.
    const capasProj = map.getLayers().filter(obj => obj.hasOwnProperty('proj'));
    const capasCesium = capasProj.map(layer => layer.getImpl().getLayer());

    controlC1.createView = () => {
      const contenedor = document.createElement('div');
      return contenedor;
    };

    controlC1.getActivationButton = (html) => {
      return html.querySelector('#m-herramienta-button');
    };

    controlC1.activate = async () => {
      IDEE.toast.success('Activado: geometrías proyectadas en la Tierra');

      await new Promise(resolve => setTimeout(resolve, 100)); // deja que se repinte la UI

      // Ahora sí, ejecutar las tareas pesadas
      self.setClampToGroundForLayers(capasCesium, true);

      window.SHELL_ALT_METERS = 0;
      const t = Cesium.JulianDate.now();
      const R = Cesium.Transforms.computeIcrfToFixedMatrix(t);
      const gjsonS = buildStarsGeojsonAtTime_withMatrix(R, window.SHELL_ALT_METERS);
      layerEstrellas.setSource(gjsonS);

      window.geojsonPlanets = getPlanetsGeoJSON(rawPlanetas, new Date(), true);
      layerPlanetas.setSource(window.geojsonPlanets);

      actualizarSolYLuna(true);

      document.querySelector('.buttonHerramienta').classList.add("activated");
    };

    controlC1.deactivate = async () => {
      IDEE.toast.info('Desactivado: geometrías proyectadas en la esfera celeste');

      await new Promise(resolve => setTimeout(resolve, 100)); // deja que se repinte la UI

      self.setClampToGroundForLayers(capasCesium, false);

      window.SHELL_ALT_METERS = 1.0e9;
      const t = Cesium.JulianDate.now();
      const R = Cesium.Transforms.computeIcrfToFixedMatrix(t);
      const gjsonS = buildStarsGeojsonAtTime_withMatrix(R, window.SHELL_ALT_METERS);
      layerEstrellas.setSource(gjsonS);
      window.geojsonPlanets = getPlanetsGeoJSON(rawPlanetas, new Date(), false);
      layerPlanetas.setSource(window.geojsonPlanets);
      actualizarSolYLuna(false);

      document.querySelector('.buttonHerramienta').classList.remove("activated");
    };

    controlC1.manageActivation(document.querySelector('.m-herramienta-container'));
  }

  setClampToGroundForLayers(layers, clampValue) {
    layers.forEach(layer => {
      let entities = layer.getEntities ? layer.getEntities() : null;
      if (!entities && layer.entities) entities = layer.entities.values;
      if (!entities && layer.source && layer.source.entities) entities = layer.source.entities.values;

      if (entities) {
        const pointEntities = Array.from(entities).filter(e => e.position && e.point);

        if (clampValue && typeof Cesium !== "undefined" && typeof viewer !== "undefined") {
          // Guarda la altura original si no está guardada
          pointEntities.forEach(e => {
            if (e.position && !e._originalHeight) {
              const cart = Cesium.Cartographic.fromCartesian(
                e.position.getValue ? e.position.getValue(Cesium.JulianDate.now()) : e.position
              );
              e._originalHeight = cart.height;
            }
          });
          // Obtén posiciones cartográficas
          const cartos = pointEntities.map(e => {
            const cart = Cesium.Cartographic.fromCartesian(
              e.position.getValue ? e.position.getValue(Cesium.JulianDate.now()) : e.position
            );
            return cart;
          });
          Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, cartos).then(updatedCartos => {
            updatedCartos.forEach((carto, i) => {
              pointEntities[i].position = Cesium.Cartesian3.fromRadians(
                carto.longitude,
                carto.latitude,
                carto.height
              );
            });
          });
        }

        // Si clampValue es false, restaura la altura original
        if (!clampValue) {
          pointEntities.forEach(e => {
            if (e._originalHeight !== undefined) {
              const cart = Cesium.Cartographic.fromCartesian(
                e.position.getValue ? e.position.getValue(Cesium.JulianDate.now()) : e.position
              );
              e.position = Cesium.Cartesian3.fromRadians(
                cart.longitude,
                cart.latitude,
                e._originalHeight
              );
            }
          });
        }

        entities.forEach(entity => {
          if (entity.polyline && entity.polyline.clampToGround !== undefined) {
            entity.polyline.clampToGround = clampValue;
          }
          if (entity.polygon && entity.polygon.clampToGround !== undefined) {
            entity.polygon.clampToGround = clampValue;
          }
          if (entity.billboard && entity.billboard.heightReference !== undefined) {
            entity.billboard.heightReference = clampValue
              ? Cesium.HeightReference.CLAMP_TO_GROUND
              : Cesium.HeightReference.NONE;
          }
        });
      }
    });
  }
}

// Exponer la clase en el namespace IDEE.plugin (y global directo).
if (typeof window !== 'undefined') {
  window.miPlugin_clampToGround = miPlugin_clampToGround;
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_clampToGround = miPlugin_clampToGround;
}

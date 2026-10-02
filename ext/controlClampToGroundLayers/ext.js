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
    // Orden del botón del plugin dentro del área de botones (el m-area donde se
    // colocan los paneles). Lo aplica la propia API: IDEE.ui.Panel hace
    // style.order sobre el panel, dentro de un flex column, así que el valor
    // es un valor CSS `order` y no un índice (los paneles sin `order` valen 0 y
    // se quedan por delante). Si se omite o no es un número válido, el botón
    // queda donde lo coloca Mapea por defecto (el orden de addPanels /
    // addPlugin).
    this.order = (options.order !== undefined && options.order !== null && !Number.isNaN(Number(options.order)))
      ? Number(options.order)
      : null;
    this.map = null;
    this.control = null;
    this.panel = null;
    this._activeState = null;
    // Colores configurables. Cada uno puede ser un color (string) o un
    // objeto {active, deactive}:
    //   color1 = fondo, color2 = borde (botón+panel), color3 = icono.
    this.color1 = (options.color1 !== undefined) ? options.color1 : { active: '#ffffff', deactive: 'orangered' };
    this.color2 = (options.color2 !== undefined) ? options.color2 : { active: '#71A7D3', deactive: '#ffffff' };
    this.color3 = (options.color3 !== undefined) ? options.color3 : { active: '#71A7D3', deactive: '#ffffff' };
  }

  // Devuelve {active, deactive} a partir de un color simple o un objeto.
  resolveColor(c) {
    return (typeof c === 'object' && c !== null)
      ? { active: c.active, deactive: c.deactive }
      : { active: c, deactive: c };
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
      // `order` lo aplica la propia API (style.order dentro del area, que es
      // un flex column), asi que no hace falta reordenar el DOM a mano.
      order: this.order,
    });

    map.addPanels([panelExtraControlC1]);
    // Referencia al panel: la necesita destroy() para bajarlo con removePanel
    // (aquí no se cuelga un control en el panel, así que removeControls no vale).
    this.panel = panelExtraControlC1;


    document.querySelector('.m-herramientaC1 .m-panel-controls').innerHTML +=
      `
        <div class="m-control m-herramienta-container">
              <button id="m-herramienta-button" class="buttonHerramienta" title="Herramienta"></button>
        </div>
      `;

    // Aplicar colores configurables (color1=fondo, color2=borde, color3=icono).
    // Se ponen también en el PANEL para que sobrevivan a re-renders del botón
    // dentro del panel (el botón hereda las variables de su ancestro).
    // Se inyectan 6 variables: estado normal y estado ".activated".
    var c1 = this.resolveColor(this.color1);
    var c2 = this.resolveColor(this.color2);
    var c3 = this.resolveColor(this.color3);
    var clampPanelEl = panelExtraControlC1.getElement ? panelExtraControlC1.getElement() : document.querySelector('.m-panel.m-herramientaC1');
    if (clampPanelEl) {
      clampPanelEl.style.setProperty('--g-plugin-bg-color', c1.deactive);
      clampPanelEl.style.setProperty('--g-plugin-bg-color-active', c1.active);
      clampPanelEl.style.setProperty('--g-plugin-border-color', c2.deactive);
      clampPanelEl.style.setProperty('--g-plugin-border-color-active', c2.active);
      clampPanelEl.style.setProperty('--g-plugin-icon-color', c3.deactive);
      clampPanelEl.style.setProperty('--g-plugin-icon-color-active', c3.active);
    }
    var clampBtn = document.getElementById('m-herramienta-button');
    if (clampBtn) {
      clampBtn.style.setProperty('--g-plugin-bg-color', c1.deactive);
      clampBtn.style.setProperty('--g-plugin-bg-color-active', c1.active);
      clampBtn.style.setProperty('--g-plugin-border-color', c2.deactive);
      clampBtn.style.setProperty('--g-plugin-border-color-active', c2.active);
      clampBtn.style.setProperty('--g-plugin-icon-color', c3.deactive);
      clampBtn.style.setProperty('--g-plugin-icon-color-active', c3.active);
    }

    const controlC1 = new IDEE.Control(new IDEE.impl.Control(), 'ControlPruebaC1');
    this.control = controlC1;

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

  // ── Contrato de preservación de estado (cambioImpl OL <-> Cesium) ──
  getState() {
    try {
      const btn = document.querySelector('.m-herramientaC1 .buttonHerramienta') || document.querySelector('.buttonHerramienta');
      const active = btn ? btn.classList.contains('activated') : Boolean(this._activeState);
      return { active };
    } catch (e) {
      return null;
    }
  }

  setState(state, map) {
    if (!state || typeof state.active !== 'boolean') return;
    this._activeState = state.active;

    const m = map || this.map;
    let isCesium = false;
    try {
      const impl = m && typeof m.getMapImpl === 'function' ? m.getMapImpl() : null;
      if (impl && impl.scene && impl.camera) isCesium = true;
    } catch (e) {
      isCesium = false;
    }

    // Este plugin es específico para Cesium 3D (proyección de geometrías en constelaciones).
    // Si el mapa actual es OpenLayers (2D), no se aplica la activación para evitar errores
    // pero se conserva el valor de `_activeState` por si se vuelve a alternar a Cesium.
    if (!isCesium) {
      return;
    }

    const ctrl = this.control || window.controlC1;
    const btn = document.querySelector('.m-herramientaC1 .buttonHerramienta') || document.querySelector('.buttonHerramienta');
    const isCurrentlyActive = btn ? btn.classList.contains('activated') : false;

    if (state.active && !isCurrentlyActive) {
      if (ctrl && typeof ctrl.activate === 'function') {
        try {
          const res = ctrl.activate();
          if (res && typeof res.catch === 'function') res.catch(() => {});
        } catch (e) {
          console.warn('[clampToGround] Error al restaurar activación:', e);
        }
      }
    } else if (!state.active && isCurrentlyActive) {
      if (ctrl && typeof ctrl.deactivate === 'function') {
        try {
          const res = ctrl.deactivate();
          if (res && typeof res.catch === 'function') res.catch(() => {});
        } catch (e) {
          console.warn('[clampToGround] Error al restaurar desactivación:', e);
        }
      }
    }
  }

  /**
   * Destruccion. map.removePlugins() de la API la exige: sin este metodo lanza
   * "t.destroy is not a function" y ABORTA el resto del lote de plugins que se
   * estuvieran quitando.
   *
   * Este plugin es un caso particular: su panel se crea con map.addPanels y su
   * HTML se inyecta directamente en el panel, SIN colgar el control de la API
   * en él. Por eso la cadena habitual (map.removeControls -> el panel se queda
   * sin controles -> removePanel) no sirve aquí: no hay control que retirar. Se
   * usa map.removePanel, que sí es público, y antes se desactiva el control para
   * que no deje hover sobre el terreno si estaba activado.
   */
  destroy() {
    const ctrl = this.control;
    if (ctrl && typeof ctrl.deactivate === 'function') {
      try {
        const res = ctrl.deactivate();
        if (res && typeof res.catch === 'function') res.catch(() => {});
      } catch (e) {
        /* El mapa puede estar ya destruido */
      }
    }
    try {
      if (this.map && this.panel && typeof this.map.removePanel === 'function') {
        this.map.removePanel(this.panel);
      }
    } catch (e) {
      /* Si el panel ya no estaba, se deja como estaba */
    }
    // El control se compartía con el resto del visor por window: se retira solo
    // si sigue siendo el de esta instancia.
    if (typeof window !== 'undefined' && window.controlC1 === ctrl) {
      try { delete window.controlC1; } catch (e) { window.controlC1 = null; }
    }
    this.control = null;
    this.panel = null;
    this._activeState = false;
    this.map = null;
  }
}

// Exponer la clase en los namespaces IDEE.plugin y M.plugin (y global directo).
if (typeof window !== 'undefined') {
  window.miPlugin_clampToGround = miPlugin_clampToGround;
  window.IDEE = window.IDEE || {};
  window.IDEE.plugin = window.IDEE.plugin || {};
  window.IDEE.plugin.miPlugin_clampToGround = miPlugin_clampToGround;
  window.M = window.M || {};
  window.M.plugin = window.M.plugin || {};
  window.M.plugin.miPlugin_clampToGround = miPlugin_clampToGround;
}

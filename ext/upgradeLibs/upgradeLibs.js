/*
 * upgradeLibs: carga versiones nuevas de OpenLayers y de Cesium desde un CDN.
 *
 * QUE HACE Y QUE NO HACE (medido, no supuesto):
 *
 * La API-CNIG lleva sus propias copias de las dos librerias dentro del bundle y
 * no lee los globales en tiempo de ejecucion:
 *
 *   - apiidee.ol.min.js     hace window.ol = {} y luego copia clases dentro
 *                           (ol.Map, ol.Feature...). Sus internos usan los
 *                           modulos de webpack, no ese objeto.
 *   - apiidee.cesium.min.js hace window.Cesium = __webpack_require__(53526),
 *                           o sea pisa el global con su copia.
 *
 * Instrumentando window.Cesium.Cartesian3.fromDegrees durante la construccion de
 * la escena y el movimiento de camara, y window.ol.proj.transform durante un
 * cambio de proyeccion, la API no llamo ni una vez (las dos llamadas que marco el
 * contador eran del propio script de medicion). Por eso:
 *
 *   - SUSTITUIR los globales no hace que la API use las librerias nuevas.
 *   - Añadir properties al objeto global si las ven los internos, porque el
 *     global ES el modulo de webpack, pero solo sirve para lo que la API ya
 *     llama. Y en este bundle no hay ni una clase de tesela vectorial
 *     (VectorTileProvider, VectorTileFeature y createVectorTileProvider
 *     aparecen cero veces), que es lo que hacia que las fuentes de datos de un
 *     MVT salieran con cero entidades en 3D. Con este plugin no se arregla eso:
 *     la version de Cesium de la pagina no es lo que falta.
 *
 * Lo que si sirve, y es lo que hace este plugin: que el codigo del visualizador
 * y de los plugins tengan OpenLayers y Cesium al dia, y que se puedan poner
 * encima de los globales cuando al codigo de uno le compenga, sabiendo que la
 * API seguira con las suyas.
 *
 * USO:
 *
 *   mapajs.addPlugin(new IDEE.plugin.miPlugin_upgradeLibs({
 *     que: 'ambos',                  // 'ol' | 'cesium' | 'ambos'
 *     olVersion: '10.6.1',
 *     cesiumVersion: '1.134',
 *     sobrescribirGlobales: false    // true pone las nuevas en window.ol y window.Cesium
 *   }));
 *
 * Lo que se carga queda en window.newOl y window.newCesium, y tambien en
 * plugin.nuevas.ol y plugin.nuevas.cesium. El plugin expone `cargado`, una
 * promesa que se resuelve cuando las librerias estan listas:
 *
 *   await plugin.cargado;
 *
 * SIN INTERFAZ: solo codigo.
 */
(function () {
  'use strict';

  // Direcciones de los paquetes. El de OpenLayers se distribuye como UMD y se
  // cuelga solo de window.ol; el de Cesium tambien, en Build/Cesium/Cesium.js.
  const CDN = {
    ol: function (version) {
      return 'https://cdn.jsdelivr.net/npm/ol@' + version + '/dist/ol.js';
    },
    cesium: function (version) {
      return 'https://cdn.jsdelivr.net/npm/cesium@' + version + '/Build/Cesium/Cesium.js';
    },
  };

  // Nombres con los que se dejan a mano. Se eligieron distintos de ol y Cesium
  // a proposito: si la nueva se carga encima del global, la que estaba antes se
  // aparta en lugar de perderse (puede ser la de la API, que la necesita).
  const GLOBAL_NUEVO = {
    ol: 'newOl',
    cesium: 'newCesium',
  };

  // El global de Cesium va en mayuscula y el de OpenLayers en minuscula: no es
  // un detalle, porque leer window.cesium da undefined aunque la libreria este
  // cargada (medido).
  const GLOBAL_REAL = {
    ol: 'ol',
    cesium: 'Cesium',
  };

  const NOMBRES = ['ol', 'cesium'];

  /**
   * Devuelve el valor de un global, o undefined si no existe.
   * @param {string} nombre Nombre del global.
   * @returns {*} Valor, o undefined.
   */
  function globalDe(nombre) {
    if (typeof window === 'undefined') return undefined;
    return window[nombre];
  }

  /**
   * Devuelve el valor de un global, borrandolo si no hay nada que poner.
   * @param {string} nombre Nombre del global.
   * @param {*} valor Valor a dejar; undefined borra el global.
   */
  function dejaGlobal(nombre, valor) {
    if (typeof window === 'undefined') return;
    if (valor === undefined) {
      try {
        delete window[nombre];
      } catch (e) {
        window[nombre] = undefined;
      }
    } else {
      window[nombre] = valor;
    }
  }

  /**
   * Añade un <script> y espera a que se haya ejecutado.
   * @param {string} url Direccion del fichero.
   * @returns {Promise<void>} Se resuelve cuando el script ha cargado.
   */
  function cargaScript(url) {
    return new Promise(function (resolve, reject) {
      if (typeof document === 'undefined') {
        reject(new Error('no hay document'));
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.async = false;   // en orden, que aqui importa el orden de carga
      script.crossOrigin = 'anonymous';
      script.onload = function () { resolve(); };
      script.onerror = function () {
        reject(new Error('no se ha podido cargar ' + url));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Plugin que deja disponibles versiones nuevas de OpenLayers y de Cesium.
   */
  class miPlugin_upgradeLibs {
    /**
     * @param {Object} [options] Configuracion.
     * @param {string} [options.que='ambos'] Que actualizar: 'ol', 'cesium' o 'ambos'.
     * @param {string} [options.olVersion] Version de OpenLayers a cargar.
     * @param {string} [options.cesiumVersion] Version de Cesium a cargar.
     * @param {boolean} [options.sobrescribirGlobales=false] Si es true, las
     *   librerias nuevas se dejan encima de window.ol y window.Cesium. Ojo: eso
     *   solo afecta al codigo que lee los globales (el visualizador y los
     *   plugins); la API sigue con las suyas, y mezclar objetos de una y otra
     *   copia en el mismo visor es la forma de tener bugs raros.
     * @param {boolean} [options.silencioso=false] Sin avisos por consola.
     */
    constructor(options) {
      const conf = options || {};
      this.name = 'upgradeLibs';
      this.que = conf.que || 'ambos';
      this.olVersion = conf.olVersion || '10.6.1';
      this.cesiumVersion = conf.cesiumVersion || '1.134';
      this.sobrescribirGlobales = Boolean(conf.sobrescribirGlobales);
      this.silencioso = Boolean(conf.silencioso);
      // Lo que se ha cargado: { ol: <la libreria>, cesium: <la libreria> }.
      this.nuevas = {};
      this.map = null;
      // Promesa de carga, para poder esperar con await.
      this.cargado = Promise.resolve(this.nuevas);
    }

    /**
     * Metodo invocado por mapajs.addPlugin(plugin).
     * @param {Object} map Instancia del mapa.
     * @returns {miPlugin_upgradeLibs} Esta misma instancia.
     */
    addTo(map) {
      this.map = map;
      const self = this;
      this.cargado = this._arrancar().then(function (cargadas) {
        self.nuevas = cargadas;
        if (!self.silencioso) {
          const resumen = self._describe(cargadas);
          console.info(`${self.name}: ${resumen}. Quedan en window.${GLOBAL_NUEVO.ol} y `
            + `window.${GLOBAL_NUEVO.cesium}. La API-CNIG sigue usando las suyas, que `
            + 'lleva dentro de su bundle y no lee de los globales.');
        }
        return cargadas;
      });
      return this;
    }

    /**
     * Dice que se ha cargado, para que se pueda comprobar desde fuera.
     * @returns {Object} { ol: <la libreria>, cesium: <la libreria> }.
     */
    getNuevas() {
      return this.nuevas;
    }

    /**
     * Devuelve la libreria nueva de una de las dos.
     * @param {string} nombre 'ol' o 'cesium'.
     * @returns {*} La libreria, o undefined si no se pido esa.
     */
    getNueva(nombre) {
      return this.nuevas[nombre];
    }

    /**
     * Cancela la carga si el mapa se destruye. Las librerias ya cargadas se
     * quedan: dejarlas puestas no rompe nada, y recargarlas cada vez que se
     * vuelve a crear el mapa (que es lo que pasa al cambiar de implementacion)
     * seria tirar la version nueva a la basura sin motivo.
     */
    destroy() {
      this.map = null;
    }

    /**
     * Resuelve la peticion en una lista de tareas y las va haciendo.
     * @returns {Promise<Object>} Las librerias cargadas.
     * @private
     */
    _arrancar() {
      const self = this;
      const pedidas = this._queHayQueCargar();
      // Encadena en serie: si se cargan a la vez, dos librerias pueden pelearse
      // por los mismos globals.
      return pedidas.reduce(function (anterior, tarea) {
        return anterior.then(function (acumulado) {
          return self._cargarUna(tarea).then(function (libreria) {
            acumulado[tarea] = libreria;
            return acumulado;
          });
        });
      }, Promise.resolve({}));
    }

    /**
     * Traduce la opcion "que" a una lista de nombres de libreria.
     * @returns {Array<string>} Nombres a cargar.
     * @private
     */
    _queHayQueCargar() {
      const q = String(this.que).toLowerCase();
      if (q === 'ol') return ['ol'];
      if (q === 'cesium') return ['cesium'];
      return NOMBRES.slice();
    }

    /**
     * Carga una libreria y la deja donde toca.
     * @param {string} nombre 'ol' o 'cesium'.
     * @returns {Promise<*>} La libreria cargada.
     * @private
     */
    _cargarUna(nombre) {
      const self = this;
      const version = nombre === 'ol' ? this.olVersion : this.cesiumVersion;
      const url = CDN[nombre](version);
      // El global de antes (que puede ser el de la API) se aparta: la version
      // nueva, al ser UMD, se cuelga del mismo sitio y lo pisa.
      const previo = globalDe(GLOBAL_REAL[nombre]);
      return cargaScript(url).then(function () {
        const cargada = globalDe(GLOBAL_REAL[nombre]);
        if (!cargada) {
          throw new Error(url + ' ha cargado pero no deja nada en window.' + GLOBAL_REAL[nombre]);
        }
        if (self.sobrescribirGlobales) {
          dejaGlobal(GLOBAL_REAL[nombre], cargada);
          dejaGlobal(GLOBAL_NUEVO[nombre], cargada);
        } else {
          // Se restituye lo que hubiera, para que el reparto siga siendo el de
          // siempre y no haya dos Cesium en la pagina por el hecho de querer la
          // nueva.
          dejaGlobal(GLOBAL_REAL[nombre], previo);
          dejaGlobal(GLOBAL_NUEVO[nombre], cargada);
        }
        return cargada;
      });
    }

    /**
     * Resume lo cargado para el aviso por consola.
     * @param {Object} cargadas Librerias cargadas.
     * @returns {string} Texto.
     * @private
     */
    _describe(cargadas) {
      const partes = [];
      if (cargadas.ol) partes.push('OpenLayers ' + (cargadas.ol.VERSION || this.olVersion));
      if (cargadas.cesium) {
        partes.push('Cesium ' + (cargadas.cesium.VERSION || this.cesiumVersion));
      }
      if (!partes.length) return 'no se ha cargado ninguna libreria';
      return 'cargadas ' + partes.join(' y ')
        + (this.sobrescribirGlobales ? ' (encima de los globales)' : ' (solo en window.new*)');
    }
  }

  // Exposición triple, como el resto de plugins del proyecto, para que se
  // pueda volver a instanciar sin recargar el fichero.
  if (typeof window !== 'undefined') {
    window.miPlugin_upgradeLibs = miPlugin_upgradeLibs;
    window.IDEE = window.IDEE || {};
    window.IDEE.plugin = window.IDEE.plugin || {};
    window.IDEE.plugin.miPlugin_upgradeLibs = miPlugin_upgradeLibs;
    window.M = window.M || {};
    window.M.plugin = window.M.plugin || {};
    window.M.plugin.miPlugin_upgradeLibs = miPlugin_upgradeLibs;
  }
})();
'use strict';

/* =====================================================================
   CAPA ALFANUMÉRICA — visualizador de ejemplo
   ---------------------------------------------------------------------
   Demuestra `IDEE.layer.Alphanumeric`: una capa de datos tabulares sin
   geometría. Se carga un CSV con lat/lon y un campo GeoJSON, y se pinta
   su contenido en el panel lateral (la capa no se renderiza en el mapa:
   no tiene geometría propia que mostrar; si se quiere ver en el mapa hay
   que convertirla con `toGeoJSON()` y añadirla como `IDEE.layer.GeoJSON`).

   La capa queda registrada en `mapajs.getAlphanumericLayers()` y se
   conserva tras el cambio 2D/3D gracias a `EstadoPlugins`.
   ===================================================================== */

var Base_IGNBaseTodo_TMS_2;
var tms_2;

const SVGCarga = document.getElementById('cargaSVG');
window.onload = function () {
  if (SVGCarga) SVGCarga.hidden = true;
};

function updateConfigBaseLayer() {
  Base_IGNBaseTodo_TMS_2 = new M.layer.TMS({
    url: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{-y}.jpeg',
    legend: 'IGNBaseTodo_2',
    visible: true,
    isBase: true,
    tileGridMaxZoom: 17,
    name: 'IGNBaseTodo_2',
    attribution: '<p><b>Mapa base</b>: <a style="color: #0000FF" href="https://www.scne.es" target="_blank">SCNE</a></p>',
  }, {
    crossOrigin: 'anonymous',
    displayInLayerSwitcher: false,
  });

  M.addQuickLayers({ Base_IGNBaseTodo_TMS_2: Base_IGNBaseTodo_TMS_2 });

  tms_2 = { base: 'QUICK*Base_IGNBaseTodo_TMS_2' };
  M.config('tms', tms_2);

  M.config.backgroundlayers = [
    {
      id: 'mapa',
      title: 'Callejero',
      imgPreview: 'img/IGNBase.png',
      layers: ['QUICK*Base_IGNBaseTodo_TMS_2'],
    },
    {
      id: 'imagen',
      title: 'Imagen',
      imgPreview: 'img/imagen.png',
      layers: ['QUICK*BASE_PNOA_MA_TMS'],
    },
  ];

  M.proxy(false);
}

function pintarTabla(capa) {
  const cont = document.getElementById('tablaAlfanumerica');
  if (!cont) return;
  const campos = capa.getFieldNames();
  const registros = capa.getRecords();
  if (!registros.length) {
    cont.innerHTML = '<p class="alf-vacio">La capa no tiene registros.</p>';
    return;
  }
  let html = '<p><strong>' + capa.getName() + '</strong> · ' + registros.length + ' registros · ' + campos.length + ' campos</p>';
  html += '<table><thead><tr>';
  campos.forEach(function (c) { html += '<th>' + c + '</th>'; });
  html += '</tr></thead><tbody>';
  registros.forEach(function (r) {
    html += '<tr>';
    campos.forEach(function (c) {
      const v = r[c];
      html += '<td>' + (v === null || v === undefined ? '' : String(v)) + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  cont.innerHTML = html;
}

function mapa() {
  if (SVGCarga) SVGCarga.hidden = false;
  updateConfigBaseLayer();

  if (window.AlphanumericLayer && typeof window.AlphanumericLayer.instalar === 'function') {
    window.AlphanumericLayer.instalar();
  }

  const mapajs = M.map({
    container: 'mapaID',
    zoom: 11,
    center: { x: -408000, y: 4925000 },
    layers: [],
  });
  window.mapajs = mapajs;

  // Capa alfanumérica de ejemplo, con dos tipos de geometría potencial:
  //   - lat/lon para construir puntos
  //   - un campo con GeoJSON para construir polígonos
  const csv = [
    'municipio,provincia,poblacion,lat,lon,geojson',
    'Madrid,Madrid,3332035,40.4168,-3.7038,"{""type"":""Point"",""coordinates"":[-3.7038,40.4168]}"',
    'Barcelona,Barcelona,1660122,41.3874,2.1686,"{""type"":""Point"",""coordinates"":[2.1686,41.3874]}"',
    'Valencia,Valencia,807693,39.4699,-0.3763,"{""type"":""Point"",""coordinates"":[-0.3763,39.4699]}"',
  ].join('\n');

  const AL = window.AlphanumericLayer;
  const capa = AL.fromCSV(csv, { name: 'Municipios (alfanumérica)', idField: 'municipio' });
  capa.setGeoFields({ latField: 'lat', lonField: 'lon', geometryField: 'geojson' });
  capa.addTo(mapajs);
  window.capaAlfanumerica = capa;
  pintarTabla(capa);

  /* ---- Plugins ------------------------------------------------------ */
  mapajs.addPlugin(new M.plugin.miPlugin_cambioImpl({
    buttonTitle: 'Cambiar implementación',
    mapsFunction: mapa,
    sameMap: true,
    shareView: true,
    shareLayers: true,
  }));

  mapajs.addPlugin(new M.plugin.miPlugin_baseLayer({ rows: 1 }));
  mapajs.addPlugin(new M.plugin.miPlugin_layerSwitcher());

  // También se puede visualizar como puntos convirtiéndola a GeoJSON:
  //   const fc = capa.toGeoJSON({ latField: 'lat', lonField: 'lon' });
  //   mapajs.addLayers(new M.layer.GeoJSON({ name: 'Municipios (puntos)', source: fc, extract: true }));

  if (SVGCarga) SVGCarga.hidden = true;
  return mapajs;
}

mapa();

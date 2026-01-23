mapajs = IDEE.map({
  container: "mapa",
  viewExtent:[ -405800.2034844995, 4927827.20105894, -402226.7819836404, 4929587.855610927 ],
  maxZoom: 18,
  center:{ x: -403965.9268097952, y: 4928708.155611674 },
  zoom: 15
});
window.mapajs = mapajs

// Carga del SVG
svgObjID = document.getElementById('svgObj')


svgObjID.addEventListener('load', () => {
  svgText = document.getElementById('svgObj').contentDocument.documentElement;
  svgObjID.remove()
  bbox3857 = [-404909.8506806855, 4928710.32207653, -403529.91623811726, 4929180.36224603]

  const bbox = reprojectBBox(bbox3857);
  geojsonSVG = svgToGeoJSON(svgText, bbox)
  capaGeojson = new IDEE.layer.GeoJSON(
    {
      source: geojsonSVG,
      extract:false
    }
  )
  mapajs.addLayers(capaGeojson)

  function rndInt0_255() { return (Math.floor(Math.random() * 255) + 1).toString(); };

  let estilo = new IDEE.style.Polygon({
    fill: {  
        color: 
        // Si se utiliza función, ésta se lanza en cada evento que se hace en mapa
        function(feature,map) {
                return  'rgba('+rndInt0_255()+','+rndInt0_255()+','+rndInt0_255()+',0.8)';
        },
        opacity: 0.8
    },
    stroke: {
        // Si no se utiliza función, el estilo se queda estático en su creación
        color: 'rgba('+rndInt0_255()+','+rndInt0_255()+','+rndInt0_255()+',0.8)',
        width: 2
    }
  });
  capaGeojson.setStyle(estilo, true);
  setInterval(function () {capaGeojson.setStyle(estilo, true); }, 1000);

});





function reprojectBBox(bbox, src = "EPSG:3857", dst = "EPSG:4326") {
  const [xmin, ymin, xmax, ymax] = bbox;

  // 1) Reproyectar las cuatro esquinas
  const p1 = IDEE.utils.reproject([xmin, ymin], src, dst); // xmin,ymin
  const p2 = IDEE.utils.reproject([xmax, ymax], src, dst); // xmax,ymax

  const lonMin = p1[0];
  const latMin = p1[1];
  const lonMax = p2[0];
  const latMax = p2[1];

  return [lonMin, latMin, lonMax, latMax];
}

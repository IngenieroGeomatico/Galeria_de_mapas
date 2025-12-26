mapajs = IDEE.map({
  container: "mapa",
  viewExtent:[ -405571.43707260775, 4927847.854762467, -402550.4545042762, 4929479.9789827075 ],
  maxZoom: 18,
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
        width: 4
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

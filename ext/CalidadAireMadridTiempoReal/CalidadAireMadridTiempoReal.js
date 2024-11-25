


miPlugin = new M.Plugin()
miPlugin.name = "MiPlugin"

miPlugin.getHelp = () => {
    return {
        title: 'Mi Plugin Personalizado',
        content: new Promise((success) => {
            let html = '<div><p>Información del plugin</p></div>';
            html = M.utils.stringToHtml(html);
            success(html);
        }),
    };
}


const panelExtra = new M.ui.Panel('toolsExtra', {
    "collapsible": true,
    "className": 'g-herramienta',
    "collapsedButtonClass": 'm-tools',
    "position": M.ui.position.TL
});

const htmlPanel =
    `
  <div aria-label="Plugin View Management" role="menuitem" id="div-contenedor-herramienta" class="m-control m-container m-herramienta">
      <header 
          role="heading" 
          tabindex="0" 
          id="m-herramienta-title"
          class="m-herramienta-header">
            Interpolar/extrapolar datos
      </header>
      <section id="m-herramienta-previews" class="m-herramienta-previews">

      </section>
      <div id="m-herramienta-contents"></div>
  </div>
  `

const controlToast = new M.Control(new M.impl.Control(), 'controlToast');

controlToast.createView = (map) => {
    const contenedor = document.createElement('div');
    return contenedor;
}


miPlugin.addTo = (map) => {

    miPlugin.panel = panelExtra

    panelExtra.addControls(controlToast);

    map.addPanels(panelExtra);
    document.querySelector('.g-herramienta .m-panel-controls').innerHTML = htmlPanel;
    document.querySelector('#m-herramienta-contents').appendChild(controlToast.getElement());

    document.querySelector('.g-herramienta .m-panel-controls').innerHTML = htmlPanel;

    // Para hacer movible el panel desde el título
    M.utils.draggabillyPlugin(panelExtra, '#m-herramienta-title');


    controlToast.activate = () => {

    }

    controlToast.deactivate = () => {

    }

    panelExtra.addControls(controlToast);

    panelExtra.getControls().forEach((btn) => {
        htmlControl = `
            <h4> Selector de capa: </h4>
            <div id="selectorWrapperID">
            <select class="seleccionCapasClass" id= "seleccionCapasID" name="seleccionCapas">
                <option value="1">----</option>
                <option value="2">....</option>
            </select>
            </div>
             <button id="botonCalcular" onclick="myFunctionInterpolateExtrapolate()" type="button">Calcular</button> 
        `

        map.on(M.evt.COMPLETED, () => {

            (async function checkForIncrease() {
                flag = true
                previousValue = -99
                while (flag) { // Salimos del bucle si no aumenta en 5 iteraciones
                    currentValue = map.getLayers().length;

                    if (currentValue > previousValue) {
                        // Simulamos un tiempo de espera para no saturar el bucle
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } else {
                        flag = false
                    }

                    previousValue = currentValue;
                }

                const legends = mapajs.getLayers()
                    .filter(capa => capa.displayInLayerSwitcher && capa.isBase == false) // Filtrar capas que tengan la propiedad 'legend'
                    .map(capa => capa.getImpl().legend).reverse();
                selector = miPlugin.panel.getTemplatePanel().querySelector("#seleccionCapasID")
                selector.innerHTML = ""
                legends.forEach((element) => {
                    if (element == "Municipio Madrid" || element == "Estaciones calidad del aire") {
                        // pass
                    } else {
                        var option = document.createElement("option");
                        option.text = element;
                        option.value = element;
                        selector.add(option);
                    }

                });
            })();
        });

        document.querySelector('#m-herramienta-previews').innerHTML += htmlControl
    })

}


async function myFunctionInterpolateExtrapolate() {
    SVGCarga.hidden = false;

    // Espera un ciclo de evento para que el navegador actualice el DOM
    await new Promise(resolve => setTimeout(resolve, 100));

    selector = miPlugin.panel.getTemplatePanel().querySelector("#seleccionCapasID")
    value = selector.value
    capaSeleccionada = mapajs.getLayers().filter(capa => capa.getImpl().legend == value)[0]
    console.log(capaSeleccionada.getImpl().legend)


    var bbox = turf.bbox(geojsonJoin.municipio);
    var grid = turf.pointGrid(bbox, 0.5,
        // {mask:geojsonJoin.municipio.features[0]}
    );

    var t = [ /* Target variable */];
    var x = [ /* X-axis coordinates */];
    var y = [ /* Y-axis coordinates */];
    gjsonCapaSeleccionada = capaSeleccionada.toGeoJSON()

    try {
        Vs = contarValoresenAtributos(gjsonCapaSeleccionada.features[0], "V")
        atributoH = "H" + Vs
    } catch (error) {
        M.toast.error('No existen los suficientes datos para realizar la operación', null, 2000);
        SVGCarga.hidden = true
        return
    }

    gjsonCapaSeleccionada.features.forEach(feature => {
        properties = feature.properties;
        geometry = feature.geometry;

        t.push(parseFloat(properties[atributoH]));
        x.push(geometry.coordinates[0]); // Longitud
        y.push(geometry.coordinates[1]); // Lstitud

    })

    var model = "exponential";
    var sigma2 = 0, alpha = 100;
    try {
        var variogram = kriging.train(t, x, y, model, sigma2, alpha);
    } catch (error) {
        M.toast.error('No existen los suficientes datos para realizar la operación', null, 2000);
        SVGCarga.hidden = true
        return
    }


    grid.features.forEach(feature => {
        properties = feature.properties;
        geometry = feature.geometry;
        var tpredicted = kriging.predict(geometry.coordinates[0], geometry.coordinates[1], variogram);

        properties[atributoH] = tpredicted

    })

    isoband = turf.isobands(
        grid,
        [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
            1, 2, 3, 4, 5, 6, 7, 8, 9,
            10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        { zProperty: atributoH }
    )

    isoband.features.forEach(feature => {
        intersection = turf.intersect(turf.featureCollection([feature, geojsonJoin.municipio.features[0]]));
        if (intersection) {
            feature.geometry = intersection.geometry
        }
    })

    // var intersection = turf.intersect(isoband, geojsonJoin.municipio.features[0]);

    gjsonCapaSeleccionada.features.push.apply(gjsonCapaSeleccionada.features, isoband.features)
    capaSeleccionada.clear()
    capaSeleccionada.getImpl().loadFeaturesPromise_ = null
    capaSeleccionada.setSource(gjsonCapaSeleccionada)
    mapajs.getLayers()
        .filter(objeto => objeto.isBase === false)
        .forEach(objeto => objeto.setVisible(false));

    SVGCarga.hidden = true
    await new Promise(resolve => setTimeout(resolve, 100));
    capaSeleccionada.setVisible(true)
}



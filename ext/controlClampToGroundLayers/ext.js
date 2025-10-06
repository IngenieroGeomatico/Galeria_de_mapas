const panelExtraControlC1 = new IDEE.ui.Panel('toolsExtra1C1', {
    "className": 'm-herramientaC1',
    "collapsedButtonClass": 'm-tools',
    "position": IDEE.ui.position.TL
});

mapajs.addPanels([panelExtraControlC1]);


document.querySelector('.m-herramientaC1 .m-panel-controls').innerHTML +=
    `
      <div class="m-control m-herramienta-container">
            <button id="m-herramienta-button" class="buttonHerramienta" title="Herramienta"></button>
      </div>
    `


const controlC1 = new IDEE.Control(new IDEE.impl.Control(), 'ControlPruebaC1');

// Con esta línea, se comparte con el objeto window la variable control1
window.controlC1 = controlC1;


capasProj = mapajs.getLayers().filter(obj => obj.hasOwnProperty('proj'));
const capasCesium = capasProj.map(layer => layer.getImpl().getLayer());

controlC1.createView = (map) => {
    const contenedor = document.createElement('div');
    console.log(controlC1)
    return contenedor;
}

controlC1.getActivationButton = (html) => {
    return html.querySelector('#m-herramienta-button');
}

controlC1.activate = () => {

    IDEE.toast.success('Activado: geometrías proyectadas en la Tierra');
    console.log('Activado');

    setClampToGroundForLayers(capasCesium, true);

    SHELL_ALT_METERS = 0
    const t = Cesium.JulianDate.now(); // Cesium.JulianDate
    const R = Cesium.Transforms.computeIcrfToFixedMatrix(t);
    const gjsonS = buildStarsGeojsonAtTime_withMatrix(R, SHELL_ALT_METERS);
    layerEstrellas.setSource(gjsonS);
    geojsonPlanets = getPlanetsGeoJSON(rawPlanetas, new Date(), true); // altura 0
    layerPlanetas.setSource(geojsonPlanets);

    
    document.querySelector('.buttonHerramienta').classList.add("activated");
    
}

controlC1.deactivate = () => {

    IDEE.toast.info('Desactivado: geometrías proyectadas en la esfera celeste');
    console.log('Desactivado');
    SVGCarga.hidden = false


    setClampToGroundForLayers(capasCesium, false);

    SHELL_ALT_METERS = 1.0e9
    const t = Cesium.JulianDate.now(); // Cesium.JulianDate
    const R = Cesium.Transforms.computeIcrfToFixedMatrix(t);
    const gjsonS = buildStarsGeojsonAtTime_withMatrix(R, SHELL_ALT_METERS);
    layerEstrellas.setSource(gjsonS);
    geojsonPlanets = getPlanetsGeoJSON(rawPlanetas, new Date(), false); 
    layerPlanetas.setSource(geojsonPlanets);

    
    document.querySelector('.buttonHerramienta').classList.remove("activated");
    SVGCarga.hidden = true

    
}

controlC1.manageActivation(document.querySelector('.m-herramienta-container'));



function setClampToGroundForLayers(layers, clampValue) {
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
var StoryMapJSON = {
    head: {
        "title": "Story Map sobre APICNIG"
    },
    cap: [

        {
            "title": "Escena Primera",
            "subtitle": "",
            "steps": [
                {
                    "html": `   <br><br><br><br>

                                <ul>
                                    <li> 
                                            Hora Crepuscular. Un guardillón con ventano angosto, lleno de
                                            sol. Retratos, grabados, autógrafos repartidos por las paredes, sujetos
                                            con chinches de dibujante. Conversación lánguida de un hombre
                                            ciego, y una mujer pelirrubia, triste y fatigada. El hombre ciego es un
                                            hiperbólico andaluz, poeta de odas y madrigales, MÁXIMO
                                            ESTRELLA. A la pelirrubia, por ser francesa, le dicen en la
                                            vecindad MADAMA COLLET.
                                    </li>
                                    <br>
                                    <br>
                                    <li> 
                                        MAX.—Vuelve a leerme la carta del Buey Apis.
                                    </li>
                                    <br>
                                    <li> 
                                        MADAMA COLLET.—Ten paciencia, Max.
                                    </li>
                                    <br>
                                    <li> 
                                        MAX.—Pudo esperar a que me enterrasen.
                                    </li>
                                    <br>
                                    <li> 
                                        MADAMA COLLET.—Le toca ir delante
                                    </li>
                                    <br>
                                    <li> 
                                        MAX.—¡Collet, mal vamos a vernos sin esas cuatro crónicas! 
                                            ¿Dónde gano yo veinte duros, Collet?.
                                    </li>
                                    <br>
                                    <li> 
                                        MADAMA COLLET.—Otra puerta se abrirá.
                                    </li>
                                </ul>

                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                            `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 1');

                            layerVectorialGJSON.clear()
                            layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null

                            mapajs.setCenter({ x: -413064.3575507956, y: 4927841.089710372 })
                            mapajs.setZoom(13)
                            
                        `,

                },

                {
                    "html": `   <br><br><br><br>

                                <ul>
                                    <li> 
                                        La casa de Max Estrella — «Calle Bastardillos, veintitrés, duplicado, Escalera interior, Guardilla B. 
                                        Nota: Si en este laberinto hiciese falta un hilo para guiarse, no se le pida a la portera, porque muerde.» (
                                        
                                        Cita de la escena octava. La calle es ficticia, y aparece en las escenas primera, duodécima y decimotercera.)

                                    </li>
                                    <br>
                                    <li> 
                                        Aunque la casa oficial sea ficticia, si podemos desplazarnos a la calle Conde Duque, 
                                        en el número 7, vivió y murió Alejandro Sawa, «el rey de los bohemios». 
                                    </li>
                                    <br>
                                    <li> 
                                        Alejandro Sawa (Sevilla, 1862-Madrid, 1909) murió un 3 de marzo de hace 109 años. 
                                        Dijo su amigo Valle Inclán que murió “ciego, loco y furioso” a la temprana edad de 46 años. 
                                        Tras una juventud en la que conoció el éxito, Sawa acabó dejando este mundo antes de lo previsto 
                                        tras pasar por todo tipo de penurias económicas. 
                                    </li>
                                    <br>
                                    <li> 
                                        La posteridad, sin embargo, no le ha olvidado, aunque no por sus novelas y artículos sino porque inspiró a Valle su personaje más famoso, 
                                        el inolvidable Max Estrella de Luces de Bohemia.
                                    </li>
                                    <br>
                                    <li> 
                                        Valle Inclán describió el apartamento de Sawa en Conde Duque como un “guardillón con ventano angosto” 
                                        y al propio desgraciado escritor como un hombre «absurdo, brillante y hambriento». 
                                        
                                    </li>
                                    <br>
                                    <li> 
                                        Fue la suya una muerte trágica por desesperación que conmovió profundamente a Valle Inclán, 
                                        que con él lloró «por todos los pobres poetas».
                                    </li>
                                </ul>

                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                            `,
                    "js": `
                            gjson = {
                                    "type": "FeatureCollection",
                                    "features": [
                                        {
                                        "type": "Feature",
                                        "properties": {
                                            "Dirección": "Calle Conde Duque, 7",
                                            "Descripción": "Alejandro Sawa"
                                        },
                                        "geometry": {
                                            "coordinates": [
                                            -3.711318,
                                            40.426273
                                            ],
                                            "type": "Point"
                                        }
                                        }
                                    ]
                            }

                            layerVectorialGJSON.setStyle(estilo2)

                            layerVectorialGJSON.clear()
                            layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null
                            layerVectorialGJSON.setSource(gjson)

                            layerVectorialGJSON.on(M.evt.LOAD, () => {
                                mapjs.setBbox(layerVectorialGJSON.getMaxExtent())
                                mapajs.setZoom(17)
                            });                            
                        `,

                },
            ]
        },

        {
            "title": "Escena Segunda",
            "subtitle": "",
            "steps": [
                {
                    "html": `   <br><br><br><br>

                                <ul>
                                    <li> 
                                        La cueva de ZARATUSTRA en el Pretil de los Consejos. Rimeros
                                        de libros hacen escombro y cubren las paredes. Empapelan los
                                        cuatro vidrios de una puerta cuatro cromos espeluznantes de un
                                        novelón por entregas. En la cueva hacen tertulia el gato, el loro,
                                        el can y el librero. ZARATUSTRA, abichado y giboso —la cara de
                                        tocino rancio y la bufanda de verde serpiente— promueve con su
                                        caracterización de fantoche, una aguda y dolorosa disonancia muy
                                        emotiva y muy moderna. Encogido en el roto pelote de una silla
                                        enana, con los pies entrapados y cepones en la tarima del
                                        brasero, guarda la tienda. Un ratón saca el hocico intrigante por
                                        un agujero.  
                                    </li>
                                    <br>
                                    <br>
                                    <li> 
                                        ZARATUSTRA.—¡No pienses que no te veo, ladrón!
                                    </li>
                                    <br>
                                    <li> 
                                        EL GATO.—¡Fu! ¡Fu! ¡Fu!
                                    </li>
                                    <br>
                                    <li> 
                                        EL CAN.—¡Guau!
                                    </li>
                                    <br>
                                    <li> 
                                        EL LORO.—¡Viva España!
                                    </li>
                                    <br>
                                    <li> 
                                        (Están en la puerta MAX ESTRELLA y DON LATINO DE HISPALIS. El poeta
                                        saca el brazo por entre los pliegues de su capa, y lo alza majestuoso,
                                        en un ritmo con su clásica cabeza ciega.)
                                    </li>
                                    <br>
                                    <li> 
                                        MAX.—¡Mal Polonia recibe a un extranjero!
                                    </li>
                                    <br>
                                    <li> 
                                        ZARATUSTRA.—¿Qué se ofrece?
                                    </li>
                                    <br>
                                    <li> 
                                        MAX.—Saludarte, y decirte que tus tratos no me convienen.
                                    </li>
                                  
                                </ul>

                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                            `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 2');

                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=CALLE%20PRETIL%20DE%20LOS%20CONSEJOS%201%2C%20Madrid&type=portal&tip_via=CALLE&id=280790465320&portal=1&extension=null&outputformat=geojson",
                                {
                                }
                            ).then(function (res) {
                                // Muestra un diálogo informativo con el resultado de la petición get
                                gjson = JSON.parse(res.text)

                                layerVectorialGJSON.setStyle(estilo1)

                                layerVectorialGJSON.clear()
                                layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null
                                layerVectorialGJSON.setSource(gjson)

                                layerVectorialGJSON.on(M.evt.LOAD, () => {
                                    mapjs.setBbox(layerVectorialGJSON.getMaxExtent())
                                    mapajs.setZoom(17)
                                }); 
                            });

                            
                            
                        `,

                },

                {
                    "html": `   <br><br><br><br>

                                <ul>
                                    <li> 
                                        Zaratustra, el librero que aparece aquí, 
                                        se puede representar con un librero real de la época de Valle Inclán, llamado Pueyo.

                                    </li>
                                    <br>
                                    <br>
                                    <li> 
                                        La librería de Pueyo se sabe que en origen estaba por aquí.
                                    </li>
                                    <br>
                                    <li> 
                                        Este librero Pueyo, que había publicado muchas obras de modernistas, 
                                        había engañado al propio Valle Inclán. Valle Inclán se vengó de él en esta obra, 
                                        diciendo que era un rastrero, un ruin, y un mezquino. 
                                  
                                    </li>

                                                                      
                                </ul>

                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                            `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 2');

                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=CALLE%20PRETIL%20DE%20LOS%20CONSEJOS%201%2C%20Madrid&type=portal&tip_via=CALLE&id=280790465320&portal=1&extension=null&outputformat=geojson",
                                {
                                }
                            ).then(function (res) {
                                // Muestra un diálogo informativo con el resultado de la petición get
                                gjson = JSON.parse(res.text)

                                layerVectorialGJSON.setStyle(estilo1)

                                layerVectorialGJSON.clear()
                                layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null
                                layerVectorialGJSON.setSource(gjson)

                                layerVectorialGJSON.on(M.evt.LOAD, () => {
                                    mapjs.setBbox(layerVectorialGJSON.getMaxExtent())
                                    mapajs.setZoom(17)
                                }); 
                            });

                            
                            
                        `,

                },

                {
                    "html": `   <br><br><br><br>

                                <ul>
                                    <li> 
                                        A Pueyo le gustaba sentirse mecenas de los jóvenes escritores, quienes le subrayan y 
                                        retratan haciéndole aparecer una y otra vez en sus volúmenes de memorias y 
                                        de ficción junto a la cofradía de los bohemios y luchadores del ideal.
                                    </li>
                                    <br>
                                    <li> 
                                        De una forma u otra, su local es un espacio mítico en la historia de Madrid y 
                                        en el imaginario modernista hispánico. Pero como de imaginario no se come, el editor, 
                                        para compensar las pérdidas que le ocasionaban los poetas modernistas, 
                                        editó novelas eróticas y a veces pornográficas.
                                    </li>
                                    <br>
                                    <li> 
                                        De manera que en el catálogo de Pueyo se entremezclan sutiles poetas de cisnes y 
                                        nenúfares con sicalípticos narradores de historias escabrosas. 
                                        Y junto a las portadas de mujeres exuberantes se alinearon, en el escaparate de Mesonero Romanos 10, 
                                        las sobrias portadas de cuidada tipografía: junto a “Soledades. Galerías. 
                                  
                                    </li>

                                                                      
                                </ul>

                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                            `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 2');

                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=CALLE%20MESONERO%20ROMANOS%2010%2C%20Madrid&type=portal&tip_via=CALLE&id=280790492709&portal=10&extension=null&outputformat=geojson",
                                {
                                }
                            ).then(function (res) {
                                // Muestra un diálogo informativo con el resultado de la petición get
                                gjson = JSON.parse(res.text)

                                layerVectorialGJSON.setStyle(estilo2)

                                layerVectorialGJSON.clear()
                                layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null
                                layerVectorialGJSON.setSource(gjson)

                                layerVectorialGJSON.on(M.evt.LOAD, () => {
                                    mapjs.setBbox(layerVectorialGJSON.getMaxExtent())
                                    mapajs.setZoom(17)
                                }); 
                            });

                            
                            
                        `,

                },
            ]
        },

        {
            "title": "Escena Tercera",
            "subtitle": "",
            "steps": [
                {
                "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                    La taberna de PICA LAGARTOS: Luz de acetileno: Mostrador de cinc:
                                    Zaguán obscuro con mesas y banquillos: Jugadores de mus: Borrosos
                                    diálogos. — MÁXIMO ESTRELLA y DON LATINO DE HISPALIS, sombras
                                    en las sombras de un rincón, se regalan con sendos quinces de
                                    morapio[533].
                                </li>
                                <br>
                                <br>
                                <li> 
                                    EL CHICO DE LA TABERNA.—Don Max, ha venido buscándole la Marquesa del Tango
                                </li>
                                <br>
                                <li> 
                                    UN BORRACHO.—¡Miau!
                                </li>
                                <br>
                                <li> 
                                    MAX.—No conozco a esa dama
                                </li>
                                <br>
                                <li> 
                                    EL CHICO DE LA TABERNA.—Enriqueta la Pisa Bien
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—¿Y desde cuándo titula esa golfa?
                                </li>
                                <br>
                                <li> 
                                    EL CHICO DE LA TABERNA.—Desque heredó del finado difunto de su papá, que entodavía vive.
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—¡Mala sombra!
                                </li>
                              
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                "js": `
                        console.log('hola, estoy comenzando el cap 3');

                        M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=CALLE%20MONTERA%2026%2C%20Madrid&type=portal&tip_via=CALLE&id=280790375085&portal=26&extension=null&outputformat=geojson",
                                {
                                }
                            ).then(function (res) {
                                // Muestra un diálogo informativo con el resultado de la petición get
                                gjson = JSON.parse(res.text)

                                layerVectorialGJSON.setStyle(estilo1)

                                layerVectorialGJSON.clear()
                                layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null
                                layerVectorialGJSON.setSource(gjson)

                                layerVectorialGJSON.on(M.evt.LOAD, () => {
                                    mapjs.setBbox(layerVectorialGJSON.getMaxExtent())
                                    mapajs.setZoom(17)
                                }); 
                            });
                        
                    `,

                },

                {
                    "html": `   <br><br><br><br>
    
                                <ul>
                                    <li> 
                                        Valle-Inclán, refleja a través del habla de los personajes que habitan la taberna, 
                                        la voz de las calles de la capital. Este lenguaje contiene vulgarismos, voces gitanas y 
                                        creaciones claramente madrileñas (“beatas” por pesetas o “ir al Viaducto” por suicidarse) 
                                        que ya el género chico, los sainetes y los escritores casticistas habían empleado como 
                                        parte de un costumbrismo sin mayor transcendencia.
                                    </li>
                                    <br>
                                    <li> 
                                        Las voces que surgen estridentes de las sombras de la taberna o de las masas que corren 
                                        por las calles y que entran en la taberna en busca de refugio de la violencia que en 
                                        la calle ejerce Acción Ciudadana, tratan de ser reflejo de la vida. 
                                    </li>
                                    <br>
                                    <li> 
                                        Valle-Inclán no quiere arrullar musicalmente al lector con la lengua pulcra de la 
                                        literatura modernista que él mismo ha cultivado, sino sacudirle, despertarle haciéndole escuchar 
                                        la voz de la calle, la que sobrelleva la angustia y la injusticia de cada día y 
                                        de la lucha inaplazable y continua contra la miseria. 
                                    </li>
                                    <br>
                                    <li> 
                                        No en vano, LUCES DE BOHEMIA aparece en respuesta a la necesidad de su autor de enfrentarse 
                                        con la cuestión del compromiso social.
                                    
                                    </li>

                                  
                                </ul>
    
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                            `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 3');
    
                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=CALLE%20MONTERA%2026%2C%20Madrid&type=portal&tip_via=CALLE&id=280790375085&portal=26&extension=null&outputformat=geojson",
                                    {
                                    }
                                ).then(function (res) {
                                    // Muestra un diálogo informativo con el resultado de la petición get
                                    gjson = JSON.parse(res.text)
    
                                    layerVectorialGJSON.setStyle(estilo1)
    
                                    layerVectorialGJSON.clear()
                                    layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null
                                    layerVectorialGJSON.setSource(gjson)
    
                                    layerVectorialGJSON.on(M.evt.LOAD, () => {
                                        mapjs.setBbox(layerVectorialGJSON.getMaxExtent())
                                        mapajs.setZoom(17)
                                    }); 
                                });
                            
                        `,
    
                },
        
             ]
        },

        {
            "title": "Escena Cuarta",
            "subtitle": "",
            "steps": [
                {
                    "html": `   <br><br><br><br>
    
                                <ul>
                                    <li> 
                                        Noche. MÁXIMO ESTRELLA y DON LATINO DE HISPALIS, tambalean
                                        asidos del brazo, por una calle enarenada y solitaria. Faroles
                                        rotos, cerradas todas, ventanas y puertas. En la llama de los faroles
                                        un igual temblor verde y macilento. La luna sobre el alero de las
                                        casas, partiendo la calle por medio. De tarde en tarde el asfalto
                                        sonoro. Un trote épico. Soldados Romanos. Sombras de Guardias.
                                        —Se extingue el eco de la patrulla. La Buñolería Modernista
                                        entreabre su puerta, y una banda de luz parte la acera. MAX y DON
                                        LATINO, borrachos lunáticos, filósofos peripatéticos, bajo la línea
                                        luminosa de los faroles, caminan y tambalean.
                                    </li>
                                    <br>
                                    <br>
                                    <li> 

                                    </li>
                                    <br>
                                    <li> 
                                       
                                    </li>
                                    <br>
                                    <li> 
                                       
                                    </li>
                                    <br>
                                    <li> 
                                        
                                    </li>
                                    <br>
                                    <li> 

                                    </li>
                                    <br>
                                    <li> 

                                    </li>
                                    <br>
                                    <li> 

                                    </li>
                                  
                                </ul>
    
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                            `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 3');
    
                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=CALLE%20MONTERA%2026%2C%20Madrid&type=portal&tip_via=CALLE&id=280790375085&portal=26&extension=null&outputformat=geojson",
                                    {
                                    }
                                ).then(function (res) {
                                    // Muestra un diálogo informativo con el resultado de la petición get
                                    gjson = JSON.parse(res.text)
    
                                    layerVectorialGJSON.setStyle(estilo1)
    
                                    layerVectorialGJSON.clear()
                                    layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null
                                    layerVectorialGJSON.setSource(gjson)
    
                                    layerVectorialGJSON.on(M.evt.LOAD, () => {
                                        mapjs.setBbox(layerVectorialGJSON.getMaxExtent())
                                        mapajs.setZoom(17)
                                    }); 
                                });
                            
                        `,
    
                    },
            ]
        },

        {
            "title": "Escena Quinta",
            "subtitle": "",
            "steps": [{
                "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                        
                                </li>
                                <br>
                                <br>
                                <li> 
                                    
                                </li>
                              
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                "js": `
                        console.log('hola, estoy comenzando el cap 1');

                        mapajs.setCenter({ x: -413064.3575507956, y: 4927841.089710372 })
                        mapajs.setZoom(13)
                        
                    `,

            },]
        },

        {
            "title": "Escena Sexta",
            "subtitle": "",
            "steps": [{
                "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                        
                                </li>
                                <br>
                                <br>
                                <li> 
                                    
                                </li>
                              
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                "js": `
                        console.log('hola, estoy comenzando el cap 1');

                        mapajs.setCenter({ x: -413064.3575507956, y: 4927841.089710372 })
                        mapajs.setZoom(13)
                        
                    `,

            },]
        },

        {
            "title": "Escena Séptima",
            "subtitle": "",
            "steps": [{
                "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                        
                                </li>
                                <br>
                                <br>
                                <li> 
                                    
                                </li>
                              
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                "js": `
                        console.log('hola, estoy comenzando el cap 1');

                        mapajs.setCenter({ x: -413064.3575507956, y: 4927841.089710372 })
                        mapajs.setZoom(13)
                        
                    `,

            },]
        },

        {
            "title": "Escena Octava",
            "subtitle": "",
            "steps": [{
                "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                        
                                </li>
                                <br>
                                <br>
                                <li> 
                                    
                                </li>
                              
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                "js": `
                        console.log('hola, estoy comenzando el cap 1');

                        mapajs.setCenter({ x: -413064.3575507956, y: 4927841.089710372 })
                        mapajs.setZoom(13)
                        
                    `,

            },]
        },

        {
            "title": "Escena Novena",
            "subtitle": "",
            "steps": []
        },

        {
            "title": "Escena Décima",
            "subtitle": "",
            "steps": [{
                "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                        
                                </li>
                                <br>
                                <br>
                                <li> 
                                    
                                </li>
                              
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                "js": `
                        console.log('hola, estoy comenzando el cap 1');

                        mapajs.setCenter({ x: -413064.3575507956, y: 4927841.089710372 })
                        mapajs.setZoom(13)
                        
                    `,

            },]
        },

        {
            "title": "Escena Undécima",
            "subtitle": "",
            "steps": [{
                "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                        
                                </li>
                                <br>
                                <br>
                                <li> 
                                    
                                </li>
                              
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                "js": `
                        console.log('hola, estoy comenzando el cap 1');

                        mapajs.setCenter({ x: -413064.3575507956, y: 4927841.089710372 })
                        mapajs.setZoom(13)
                        
                    `,

            },]
        },

        {
            "title": "Escena Doudécima",
            "subtitle": "",
            "steps": [{
                "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                        
                                </li>
                                <br>
                                <br>
                                <li> 
                                    
                                </li>
                              
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                "js": `
                        console.log('hola, estoy comenzando el cap 1');

                        mapajs.setCenter({ x: -413064.3575507956, y: 4927841.089710372 })
                        mapajs.setZoom(13)
                        
                    `,

            },]
        },

        {
            "title": "Escena Decimatercia",
            "subtitle": "",
            "steps": [{
                "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                        
                                </li>
                                <br>
                                <br>
                                <li> 
                                    
                                </li>
                              
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                "js": `
                        console.log('hola, estoy comenzando el cap 1');

                        mapajs.setCenter({ x: -413064.3575507956, y: 4927841.089710372 })
                        mapajs.setZoom(13)
                        
                    `,

            },]
        },

        {
            "title": "Escena Decimacuarta",
            "subtitle": "",
            "steps": [{
                "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                        
                                </li>
                                <br>
                                <br>
                                <li> 
                                    
                                </li>
                              
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                "js": `
                        console.log('hola, estoy comenzando el cap 1');

                        mapajs.setCenter({ x: -413064.3575507956, y: 4927841.089710372 })
                        mapajs.setZoom(13)
                        
                    `,

            },]
        },
        {
            "title": "Escena Última",
            "subtitle": "",
            "steps": [{
                "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                        
                                </li>
                                <br>
                                <br>
                                <li> 
                                    
                                </li>
                              
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                "js": `
                        console.log('hola, estoy comenzando el cap 1');

                        mapajs.setCenter({ x: -413064.3575507956, y: 4927841.089710372 })
                        mapajs.setZoom(13)
                        
                    `,

            },]
        },


    ]


}
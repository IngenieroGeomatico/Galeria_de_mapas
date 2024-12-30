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
                                        MAX.—¿Dónde estamos?
                                    </li>
                                    <br>
                                    <li> 
                                       DON LATINO.—Esta calle no tiene letrero.
                                    </li>
                                    <br>
                                    <li> 
                                       MAX.—Yo voy pisando vidrios rotos
                                    </li>
                                    <br>
                                    <li> 
                                        DON LATINO.—No ha hecho mala cachiza el honrado pueblo.
                                    </li>
                                    <br>
                                    <li> 
                                        MAX.—¿Qué rumbo consagramos?
                                    </li>
                                    <br>
                                    <li> 
                                        DON LATINO.—Déjate guiar.
                                    </li>
                                    <br>
                                    <li> 
                                        MAX.—Condúceme a casa.
                                    </li>
                                    <br>
                                    <li> 
                                        DON LATINO.—Tenemos abierta La Buñolería Modernista.
                                    </li>
                                  
                                </ul>
    
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                            `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 4');
    
                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=PASEO SAN GINES 5%2C Madrid&type=portal&tip_via=PASEO&id=280790268423&portal=5&extension=null&outputformat=geojson",
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
                                        mapajs.setZoom(18)
                                    }); 
                                });
                            
                        `,
    
                },
                {
                        "html": `   <br><br><br><br>
        
                                    <ul>
                                        <li> 
                                            La Buñolería Modernista está abierta de manera ininterrumpida en el Pasadizo de San Ginés desde 1894. 
                                            Fue llamada el “Maxim’s Golfo”, ya que cuando echaban el cierre todos los cafés y tabernas de Puerta del Sol, 
                                            era el único establecimiento abierto que recogía entre sus vahos de aceite y de aguardiente 
                                            y su café de recuelo a una clientela aterida y heterogénea que incluía madrugadores, bohemios, noctívagos 
                                            y ratés
                                        </li>
                                        <br>
                                        <li> 
                                            Por ese pasadizo de San Ginés, que aún conserva los faroles, se acercan Max y Don Latino, asidos del brazo 
                                            y tambaleantes, posiblemente, tras cerrar las tabernas de Puerta del Sol. El suelo lleno de vidrios rotos y 
                                            el frío que empieza a calar el cuerpo desabrigado y destemplado por el alcohol de Max. 
                                        </li>
                                    </ul>
        
                                    <br><br><br><br> <br><br><br> <br><br><br>
                                    <br><br><br><br> <br><br><br> <br><br><br>
                                    <br><br><br><br> <br><br><br> <br><br><br>
                                `,
                        "js": `
                                console.log('hola, estoy comenzando el cap 4');
        
                                M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=PASEO SAN GINES 5%2C Madrid&type=portal&tip_via=PASEO&id=280790268423&portal=5&extension=null&outputformat=geojson",
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
                                            mapajs.setZoom(18)
                                        }); 
                                    });
                                
                            `,
        
                },
                {
                    "html": `   <br><br><br><br>
    
                                <ul>
                                    <li> 
                                        La Chocolatería San Ginés es una popular chocolatería de Madrid, fundada en 1894 y 
                                        situada en el pasadizo de San Ginés, junto a la Puerta del Sol, tradicional local para la 
                                        degustación de chocolate con churros.
                                    </li>
                                    <br>
                                    <li> 
                                        En el año 1890 se abrió el local para mesón y fonda en el pasadizo de San Ginés, y en 1894 se transformó en churrería.
                                         Emplazado junto al Teatro Eslava, su fama empezó cuando la gente a la salida del teatro acostumbraba a tomar un 
                                         chocolate con churros.3​ Popular lugar de reunión de noctámbulos, también fue más tarde lugar de cita para los 
                                         que salían de la discoteca de Joy Eslava. Durante la Segunda República se conocía como “La Escondida”. 
                                         Por su cercanía con la Puerta del Sol y su horario nocturno todo el año, es el lugar, si se tiene paciencia, 
                                         donde se suele tomar el primer chocolate del Año Nuevo. 
                                    </li>
                                    <br>
                                    <li> 
                                        Conserva la estética de los cafés de final de siglo xix, distribuido en dos plantas con mesas de mármol blanco y 
                                        mostrador revestido de azulejería.  La fachada de la chocolatería se eligió como uno de los pasos del recorrido 
                                        cultural la noche de Max Estrella siguiendo la obra teatral Luces de Bohemia de Valle-Inclán.
                                    </li>
                                    <br>
                                    <li> 
                                        En 2010 se inauguró una chocolatería San Ginés en Tokio, en barrio de Shibuya, 
                                        adaptando sus productos a los gustos nipones.
                                    </li>
                                </ul>
    
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                            `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 4');
    
                            gjson = { 
                                "type": "FeatureCollection", 
                                "features": [
                                    {
                                        "type": "Feature",
                                        "geometry": {
                                            "type": "Point",
                                            "coordinates": [
                                            -3.70682,
                                            40.41683, 
                                            ]
                                        },
                                        "properties": {
                                            "Dirección": "Pasadizo de San Ginés, 5",
                                            "Descripción": "Chocolatería San Ginés"
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
                                mapajs.setZoom(18)
                            }); 
                            
                        `,
    
            },
            ]
        },

        {
            "title": "Escena Quinta",
            "subtitle": "",
            "steps": [
                {
                "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                    Zaguán en el Ministerio de la Gobernación. Estantería con legajos.
                                    Bancos al filo de la pared. Mesa con carpetas de badana mugrienta.
                                    Aire de cueva, y olor frío de tabaco rancio. Guardias soñolientos.
                                    Policías de la Secreta. —Hongos, garrotes, cuellos de celuloide,
                                    grandes sortijas, lunares rizosos y flamencos—. Hay un viejo
                                    chabacano —bisoñé y manguitos de percalina—, que escribe, y un
                                    pollo chulapón de peinado reluciente, con brisas de perfumería, que
                                    se pasea y dicta humeando un veguero. DON SERAFÍN, le dicen sus
                                    obligados, y la voz de la calle Serafín el Bonito. —Leve tumulto.
                                    Dando voces, la cabeza desnuda, humorista y lunático irrumpe MAX
                                    ESTRELLA—. DON LATINO le guía por la manga, implorante y
                                    suspirante. Detrás asoman los cascos de los GUARDIAS. Y en el
                                    corredor, se agrupan bajo la luz de una candileja, pipas,
                                    chalinas y melenas del modernismo.
                                </li>
                                <br>
                                <br>
                                <li> 
                                    MAX.—¡Traigo detenida una pareja de guindillas!. Estaban
                                    emborrachándose en una tasca, y los hice salir a darme escolta.
                                </li>
                                <br>
                                <li> 
                                    SERAFÍN EL BONITO.—Corrección, señor mío.
                                </li>
                                <br>
                                <li> 
                                    MAX.—No falto a ella, señor Delegado.
                                </li>
                                <br>
                                <li> 
                                    SERAFÍN EL BONITO.—Inspector.
                                </li>
                                 <br>
                                <li> 
                                    MAX.—Todo es uno y lo mismo.
                                </li>
                                 <br>
                                <li> 
                                    SERAFÍN EL BONITO.—¿Cómo se llama usted?
                                </li>
                                <br>
                                <li> 
                                    MAX.—Mi nombre es Máximo Estrella. Mi seudónimo Mala Estrella.
                                    Tengo el honor de no ser Académico
                                </li>
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                "js": `
                            console.log('hola, estoy comenzando el cap 5');
    
                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=PLAZA%20PUERTA%20DEL%20SOL%207,%20Madrid&type=portal&tip_via=PLAZA&id=280790417594&portal=7&extension=null&outputformat=geojson",
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
                                        mapajs.setZoom(18)
                                    }); 
                                });
                            
                        `,
                },
                {
                    "html": `   <br><br><br><br>
    
                                <ul>
                                    <li> 
                                        En el año 1847 el inmueble fue ampliamente reorganizado en su interior para convertirlo en la sede del Ministerio 
                                        de la Gobernación, aunque su planta baja sigue siendo utilizada como oficina central de Correos. 
                                        Anteriormente había estado Gobernación en el Palacio de la calle Torrija (edificio que perteneció 
                                        al Consejo Supremo de la Inquisición). En la calle de Carretas, 
                                        hasta comienzos del siglo XX se podían depositar cartas en unos buzones con forma de cabeza de león.
                                    </li>
                                    <br>
                                    <li> 
                                        A mediados del siglo XIX la hora de la Puerta del Sol se indicaba en un reloj de la fachada de la iglesia del Buen Suceso. 
                                        Este reloj con mecánica medieval (poseía una única manilla) tenía numerosos fallos mecánicos que irritaban 
                                        a los madrileños de la época por su habitual irregularidad. Las salidas de postas y diligencias se regían por este reloj. 
                                        Al ser derribado el hospital del Buen Suceso poco antes de la reforma de la Puerta del Sol, 
                                        el reloj se trasladó a la Casa de Correos y se construyó una torre y un templete para su instalación en 1855. 
                                        
                                         
                                    </li>
                                    <br>
                                    <li> 
                                        El segundo reloj, actual, obra del destacado relojero español José Rodríguez Losada, se colocó bajo una torrecilla que 
                                        es inaugurada el 19 de noviembre de 1866. El mal funcionamiento de este primer reloj queda patente en el conocido epigrama de la época:
                                    </li>
                                    <br>
                                    <li> 
                                        Este reló fatal, que hay en la Puerta del Sol
                                        dijo un turco a un español,
                                        ¿por qué anda siempre tan mal?
                                        El turco con desparpajo contestó cual perro viejo:
                                        este reló es el espejo del gobierno que hay debajo
                                    </li>
                                </ul>
    
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                            `,
                    "js": `
                                console.log('hola, estoy comenzando el cap 5');
        
                                M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=PLAZA%20PUERTA%20DEL%20SOL%207,%20Madrid&type=portal&tip_via=PLAZA&id=280790417594&portal=7&extension=null&outputformat=geojson",
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
                                            mapajs.setZoom(18)
                                        }); 
                                    });
                                
                            `,
                },
                {
                        "html": `   <br><br><br><br>
        
                                    <ul>
                                        <li> 
                                            El 14 de abril de 1931 se produce la proclamación de la Segunda República española, 
                                            y la Puerta del Sol fue testigo del cambio de poder y de las celebraciones populares por la proclamación de 
                                            la Segunda República, por lo que muchos madrileños se acercaron a la plaza con el objeto de celebrar 
                                            y adquirir nuevas sobre el evento.
                                        </li>
                                        <br>
                                        <li> 
                                            En fotografías de la época se puede ver cómo la aglomeración de personas sube a los techos de los tranvías y quioscos.
                                            La multitud era tanta que los miembros del nuevo gobierno que se acercaban en coche a la Casa de Correos (Gobernación) 
                                            tuvieron que hacer el trayecto desde la Puerta de Alcalá a Sol en dos horas. 
                                            Al llegar a las puertas principales de Gobernación se encuentran con unos guardias civiles, 
                                            que vacilantes no les permiten el paso. Maura grita: “¡Señores, paso al gobierno de la República!”, 
                                            justo en ese instante desde uno de los balcones ondeaba la bandera republicana.
                                        </li>
                                        <br>
                                        <li> 
                                            Después de la Guerra Civil la Casa de Correos se convirtió desde el edificio de Gobernación 
                                            (Ministerio de Gobernación) en la Dirección General de Seguridad (DGS). En la época del franquismo (1936-1975) 
                                            era imposible hacer manifestaciones delante del edificio y sus sótanos subterráneos albergaban prisiones, 
                                            donde se detenía y se torturaba a miembros de la oposición clandestina al régimen.
                                        </li>
                                        <br>
                                        <li> 
                                            Tras la llegada de la democracia con la aprobación de la Constitución española de 1978 
                                            y el Estado de las Autonomías, el 21 de diciembre de 1984 la Comunidad Autónoma de Madrid 
                                            alcanzó un acuerdo con el Ministerio del Interior para realizar un intercambio de edificios, 
                                            entre los que se incluía la Real Casa de Correos para ser transferido a la región madrileña. 
                                            El 12 de marzo de 1985, se hizo oficial el traspaso con el objetivo de convertir el edificio 
                                            en la sede de la presidencia regional.
                                        </li>
                                    </ul>
        
                                    <br><br><br><br> <br><br><br> <br><br><br>
                                    <br><br><br><br> <br><br><br> <br><br><br>
                                    <br><br><br><br> <br><br><br> <br><br><br>
                                `,
                        "js": `
                                console.log('hola, estoy comenzando el cap 4');
        
                                gjson = { 
                                    "type": "FeatureCollection", 
                                    "features": [
                                        {
                                        "type": "Feature",
                                        "geometry": {
                                            "type": "Point",
                                            "coordinates": [-3.7036,40.4166]
                                        },
                                        "properties": {
                                            "Dirección": "Puerta del Sol, 7",
                                            "Descripción": "Casa real de correos"
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
                                    mapajs.setZoom(18)
                                }); 
                                
                            `,
        
                },
            ]
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
                        console.log('hola, estoy comenzando el cap 6');

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
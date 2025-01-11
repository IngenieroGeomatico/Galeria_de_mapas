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
                            layerVectorialGJSON_Madrid.setZIndex(50)
                            layerVectorialGJSON_Libro.setZIndex(49)

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
                                layerVectorialGJSON_Madrid.setZIndex(49)
                                layerVectorialGJSON_Libro.setZIndex(50)

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
                                layerVectorialGJSON_Madrid.setZIndex(49)
                                layerVectorialGJSON_Libro.setZIndex(50)

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
                            layerVectorialGJSON_Madrid.setZIndex(50)
                            layerVectorialGJSON_Libro.setZIndex(49)

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

                        M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=CALLE%20MONTERA%202%2C%20Madrid&type=portal&tip_via=CALLE&id=2280790254631&portal=2&extension=null&outputformat=geojson",
                                {
                                }
                            ).then(function (res) {
                                // Muestra un diálogo informativo con el resultado de la petición get
                                gjson = JSON.parse(res.text)

                                layerVectorialGJSON.setStyle(estilo1)
                                layerVectorialGJSON_Madrid.setZIndex(49)
                                layerVectorialGJSON_Libro.setZIndex(50)

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
    
                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=CALLE%20MONTERA%202%2C%20Madrid&type=portal&tip_via=CALLE&id=2280790254631&portal=2&extension=null&outputformat=geojson",
                                    {
                                    }
                                ).then(function (res) {
                                    // Muestra un diálogo informativo con el resultado de la petición get
                                    gjson = JSON.parse(res.text)
    
                                    layerVectorialGJSON.setStyle(estilo1)
                                layerVectorialGJSON_Madrid.setZIndex(49)
                                layerVectorialGJSON_Libro.setZIndex(50)
    
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
                                    layerVectorialGJSON_Madrid.setZIndex(49)
                                    layerVectorialGJSON_Libro.setZIndex(50)
    
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
                                        layerVectorialGJSON_Madrid.setZIndex(49)
                                        layerVectorialGJSON_Libro.setZIndex(50)
        
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
    
                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=PASEO SAN GINES 5%2C Madrid&type=portal&tip_via=PASEO&id=280790268423&portal=5&extension=null&outputformat=geojson",
                                        {
                                        }
                                    ).then(function (res) {
                                        // Muestra un diálogo informativo con el resultado de la petición get
                                        gjson = JSON.parse(res.text)
        
                                        layerVectorialGJSON.setStyle(estilo2)
                                        layerVectorialGJSON_Madrid.setZIndex(50)
                                        layerVectorialGJSON_Libro.setZIndex(49)
        
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
                                layerVectorialGJSON_Madrid.setZIndex(49)
                                layerVectorialGJSON_Libro.setZIndex(50)
    
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
                                layerVectorialGJSON_Madrid.setZIndex(49)
                                layerVectorialGJSON_Libro.setZIndex(50)
        
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
                                console.log('hola, estoy comenzando el cap 5');
        
                                M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=PLAZA%20PUERTA%20DEL%20SOL%207,%20Madrid&type=portal&tip_via=PLAZA&id=280790417594&portal=7&extension=null&outputformat=geojson",
                                    {
                                    }
                                ).then(function (res) {
                                    // Muestra un diálogo informativo con el resultado de la petición get
                                    gjson = JSON.parse(res.text)
    
                                    layerVectorialGJSON.setStyle(estilo2)
                                layerVectorialGJSON_Madrid.setZIndex(50)
                                layerVectorialGJSON_Libro.setZIndex(49)
    
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
            ]
        },

        {
            "title": "Escena Sexta",
            "subtitle": "",
            "steps": [
                {
                    "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                    El calabozo. Sótano mal alumbrado por una candileja. En la sombra,
                                    se mueve el bulto de un hombre. —Blusa, tapabocas y alpargatas—.
                                    Pasea hablando solo. Repentinamente se abre la puerta. MAX
                                    ESTRELLA, empujado y trompicando, rueda al fondo del calabozo. Se
                                    cierra de golpe la puerta.
                                </li>
                                <br>
                                <br>
                                <li> 
                                    MAX.—¡Canallas! ¡Asalariados! ¡Cobardes!
                                </li>
                                <br>
                                <li> 
                                    VOZ FUERA.—¡Aún vas a llevar mancuerda!
                                </li>
                                <br>
                                <li> 
                                    MAX.—¡Esbirro!
                                </li>
                                <br>
                                <li> 
                                    (Sale de la tiniebla el bulto del hombre morador del calabozo. Bajo la
                                    luz se le ve esposado, con la cara llena de sangre.)
                                </li>
                                 <br>
                                <li> 
                                    EL PRESO.—¡Buenas noches!
                                </li>
                                 <br>
                                <li> 
                                    MAX.—¿No estoy solo?
                                </li>
                                <br>
                                <li> 
                                    EL PRESO.—Así parece.
                                </li>
                                <br>
                                <li> 
                                    MAX.—¿Catalán?
                                </li>
                                <br>
                                <li> 
                                    EL PRESO.—De todas partes
                                </li>
                                <br>
                                <li> 
                                    MAX.—¡Paria!… Solamente los obreros catalanes aguijan su rebeldía,
                                    con ese denigrante epíteto. Paria, en bocas como la tuya, es una espuela.
                                    Pronto llegará vuestra hora.
                                </li>
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 6');
    
                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=PLAZA%20PUERTA%20DEL%20SOL%207,%20Madrid&type=portal&tip_via=PLAZA&id=280790417594&portal=7&extension=null&outputformat=geojson",
                                    {
                                    }
                                ).then(function (res) {
                                    // Muestra un diálogo informativo con el resultado de la petición get
                                    gjson = JSON.parse(res.text)
    
                                    layerVectorialGJSON.setStyle(estilo1)
                                    layerVectorialGJSON_Madrid.setZIndex(49)
                                    layerVectorialGJSON_Libro.setZIndex(50)
    
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
            
            ]
        },

        {
            "title": "Escena Séptima",
            "subtitle": "",
            "steps": [
                {
                    "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                    La redacción de El Popular: Sala baja con piso de baldosas: En el
                                    centro una mesa larga y negra, rodeada de sillas vacías, que marcan
                                    los puestos, ante roídas carpetas, y rimeros de cuartillas que destacan
                                    su blancura en el círculo luminoso y verdoso de una lámpara con
                                    enagüillas. Al extremo fuma y escribe un hombre calvo, el eterno
                                    redactor del perfil triste, el gabán con flecos, los dedos de gancho, y
                                    las uñas entintadas. El hombre lógico y mítico enciende el cigarro
                                    apagado. Se abre la mampara, y el grillo de un timbre rasga el
                                    silencio. Asoma el conserje, vejete renegado, bigotudo, tripón,
                                    parejo de aquellos bizarros coroneles que en las procesiones se caen
                                    del caballo. Un enorme parecido que extravaga.
                                </li>
                                <br>
                                <br>
                                <li> 
                                    EL CONSERJE.—Ahí está Don Latino de Hispalis, con otros capitalistas
                                    de su cuerda. Vienen preguntando por el Señor Director. Les he dicho
                                    que solamente estaba usted en la casa. ¿Los recibe usted, Don Filiberto?
                                </li>
                                <br>
                                <li> 
                                    DON FILIBERTO.—Que pasen.
                                </li>
                                <br>
                                <li> 
                                    (Sigue escribiendo. EL CONSERJE sale, y queda batiente la verde
                                    mampara que proyecta un recuerdo de garitos y naipes. Entra el
                                    cotarro modernista, greñas, pipas, gabanes repelados[760], y alguna
                                    capa. El periodista calvo levanta los anteojos a la frente, requiere el
                                    cigarro, y se da importancia.)(Sigue escribiendo. EL CONSERJE sale, y queda batiente la verde
                                    mampara que proyecta un recuerdo de garitos y naipes. Entra el
                                    cotarro modernista, greñas, pipas, gabanes repelados[760], y alguna
                                    capa. El periodista calvo levanta los anteojos a la frente, requiere el
                                    cigarro, y se da importancia.)
                                </li>
                                <br>
                                <li> 
                                    DON FILIBERTO.—¡Caballeros y hombres buenos, adelante! ¿Ustedes me
                                    dirán lo que desean de mí y del Journal?
                                </li>
                                <br>
                                <li> 
                                    DORIO DE GÁDEX.—En España sigue reinando Carlos II
                                </li>
                                <br>
                                <li> 
                                    DON FILIBERTO.—¡Válgame un santo de palo!. ¿Nuestro gran poeta estaría curda?
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—Una copa de más, no justifica esa violación de los derechos individuales.
                                </li>
                                <br>
                                <li> 
                                    DON FILIBERTO.—Max Estrella también es amigo nuestro. ¡Válgame un
                                    santo de palo! El Señor Director, cuando a esta hora falta, ya no viene…
                                    Ustedes conocen cómo se hace un periódico. ¡El Director, es siempre un
                                    tirano…! Yo, sin consultarle, no me decido a recoger en nuestras columnas
                                    la protesta de ustedes. Desconozco la política del periódico con la Dirección
                                    de Seguridad… Y el relato de ustedes, francamente, me parece un poco
                                    exagerado.
                                </li>
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 7');

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
                                    Localización imposible por falta de indicios en el texto.
                                </li>
                                <br>
                                <br>
                                <li> 
                                    Los periódicos de la época se nutrían de artículos de fondo, sesudos y pesados, graves y 
                                    doctrinales, de gacetillas intencionadas, pues la prensa de entonces estaba estrechamente 
                                    unida a la vida política, tanto era así que los periódicos solían estar auspiciados 
                                    por los distintos partidos políticos, por eso muchas páginas de la prensa estaban 
                                    sometidas al poder, ausentes de crítica y cargadas de conformismo.
                                </li>
                                <br>
                                <li> 
                                    Durante la huelga general de agosto de 1917, los periódicos debían limitarse a publicar las notas 
                                    de prensa que emitían las Capitanías Generales y, paralelamente, se llevó a cabo, por parte de las autoridades, 
                                    la interrupción del servicio telegráfico y telefónico para impedir el flujo de información entre provincias.
                                </li>
                                <br>
                                <li> 
                                  Los periódicos se leían y comentaban en las casas, en los cafés, los círculos, los casinos y los ateneos; sus páginas se completaban 
                                  con folletines novelescos, las reseñas taurinas, la información de sucesos, las caricaturas y viñetas satíricas, 
                                  la cartelera y la crítica teatral… todo ello gracias a la naciente publicidad comercial. 
                                </li>
                                <br>
                                <li> 
                                   La vinculación estrecha de LUCES DE BOHEMIA con la prensa no se circunscribe solo su contenido, sino que la propia 
                                   obra vio la luz por entregas en la prensa, concretamente en la revista España, entre julio y octubre de 1920. 
                                   La vinculación estrecha de LUCES DE BOHEMIA con la prensa no se circunscribe solo su contenido, sino que la propia obra vio la luz por entregas en la prensa, 
                                   concretamente en la revista España, entre julio y octubre de 1920. 
                                   
                                </li>
                                <br>
                                <li> 
                                    Para su edición en libro en 1924, el autor añadió las escenas II, VI y XI, 
                                   con ellas se intensifica la deformación y la naturaleza de antihéroe de Max Estrella y también hay una mayor crítica social y 
                                   denuncia de los modos en que el poder administra la represión.
                                </li>
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 7');

                            layerVectorialGJSON.clear()
                            layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null

                            mapajs.setCenter({ x: -413064.3575507956, y: 4927841.089710372 })
                            mapajs.setZoom(13)
                        `,
                },
            ]
        },

        {
            "title": "Escena Octava",
            "subtitle": "",
            "steps": [
                {
                    "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                   Secretaría particular de Su Excelencia. Olor de brevas habanas,
                                    malos cuadros, lujo aparente y provinciano. La estancia tiene un
                                    recuerdo partido por medio, de oficina y sala de círculo con
                                    timba. De repente el grillo del teléfono se orina en el gran
                                    regazo burocrático[830]. Y DIEGUITO GARCÍA —Don Diego del Corral,
                                    en la Revista de Tribunales y Estrados — pega tres brincos y
                                    se planta la trompetilla en la oreja.
                                </li>
                                <br>
                                <br>
                                <li> 
                                  (MAX ESTRELLA aparece en la puerta, pálido, arañado, la corbata
                                    torcida, la expresión altanera y alocada. Detrás, abotonándose los
                                    calzones, aparece EL UJIER.)
                                </li>
                                <br>
                                <li> 
                                   EL UJIER.—Deténgase usted, caballero.
                                </li>
                                <br>
                                <li> 
                                    MAX.—No me ponga usted la mano encima.
                                </li>
                                <br>
                                <li> 
                                   EL UJIER.—Salga usted sin hacer desacato
                                </li>
                                <br>
                                <li> 
                                   MAX.—Anúncieme usted al Ministro.
                                </li>
                                <br>
                                <li> 
                                    EL UJIER.—No está visible.
                                </li>
                                <br>
                                <li> 
                                    MAX.—¡Ah! Es usted un gran lógico. Pero estará audible.
                                </li>
                                <br>
                                <li> 
                                    EL UJIER.—Retírese, caballero. Éstas no son horas de audiencia.
                                </li>
                                <br>
                                <li> 
                                    MAX.—Anúncieme usted.
                                </li>
                                <br>
                                <li> 
                                    EL UJIER.—Es la orden… Y no vale ponerse pelmazo, caballero.
                                </li>
                                <br>
                                <li> 
                                    DIEGUITO.—Fernández, deje usted a ese caballero que pase.
                                </li>
                                <br>
                                <li> 
                                    MAX.—¡Al fin doy con un indígena civilizado!
                                </li>
                                <br>
                                <li> 
                                    DIEGUITO.—Amigo Mala Estrella, usted perdonará que sólo un
                                    momento me ponga a sus órdenes. Me habló por usted la Redacción de El
                                    Popular. Allí le quieren a usted. A usted le quieren y le admiran en todas
                                    partes. Usted me deja mandado aquí y donde sea. No me olvide… ¡Quién
                                    sabe!… Yo tengo la nostalgia del periodismo… Pienso hacer algo… Hace
                                    tiempo acaricio la idea de una hoja volandera, un periódico ligero, festivo,
                                    espuma de champaña, fuego de virutas. Cuento con usted. Adiós,
                                    maestro. ¡Deploro que la ocasión de conocernos haya venido de suceso tan
                                    desagradable!.
                                </li>
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 8');
    
                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=PLAZA%20PUERTA%20DEL%20SOL%207,%20Madrid&type=portal&tip_via=PLAZA&id=280790417594&portal=7&extension=null&outputformat=geojson",
                                    {
                                    }
                                ).then(function (res) {
                                    // Muestra un diálogo informativo con el resultado de la petición get
                                    gjson = JSON.parse(res.text)
    
                                    layerVectorialGJSON.setStyle(estilo1)
                                    layerVectorialGJSON_Madrid.setZIndex(49)
                                    layerVectorialGJSON_Libro.setZIndex(50)
    
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
            ]
        },

        {
            "title": "Escena Novena",
            "subtitle": "",
            "steps": [
                {
                    "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                    Un café que prolongan empañados espejos. Mesas de mármol.
                                    Divanes rojos. El mostrador en el fondo, y detrás un vejete rubiales,
                                    destacado el busto sobre la diversa botillería. El Café tiene piano y
                                    violín. Las sombras y la música flotan en el vaho de humo, y en el
                                    lívido temblor de los arcos voltaicos. Los espejos multiplicadores
                                    están llenos de un interés folletinesco, en su fondo, con una geometría
                                    absurda, extravaga el Café. El compás canalla de la música, las
                                    luces en el fondo de los espejos, el vaho de humo penetrado del
                                    temblor de los arcos voltaicos, cifran su diversidad en una sola
                                    expresión. Entran extraños, y son de repente transfigurados en
                                    aquel triple ritmo, MALA ESTRELLA y DON LATINO.
                                </li>
                                <br>
                                <br>
                                <li> 
                                  MAX.—¿Qué tierra pisamos?
                                </li>
                                <br>
                                <li> 
                                   DON LATINO.—El Café Colón.
                                </li>
                                <br>
                                <li> 
                                    MAX.—Mira si está Rubén. Suele ponerse enfrente de los músicos.
                                </li>
                                <br>
                                <li> 
                                   DON LATINO.—Allá está como un cerdo triste
                                </li>
                                <br>
                                <li> 
                                   MAX.—Vamos a su lado, Latino. Muerto yo, el cetro de la poesía pasa a ese negro
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—No me encargues de ser tu testamentario.
                                </li>
                                <br>
                                <li> 
                                    MAX.—¡Es un gran poeta!
                                </li>
                                <br>
                                <li> 
                                    MAX.—¡Merecías ser el barbero de Maura!
                                </li>
                                <br>
                                <li> 
                                    (Por entre sillas y mármoles llegan al rincón donde está sentado y
                                    silencioso RUBÉN DARÍO. Ante aquella aparición, el poeta siente la
                                    amargura de la vida, y con gesto egoísta de niño enfadado, cierra losojos, 
                                    y bebe un sorbo de su copa de ajenjo. Finalmente, su
                                    máscara de ídolo se anima con una sonrisa cargada de humedad. El
                                    ciego se detiene ante la mesa y levanta su brazo, con magno ademán
                                    de estatua cesárea.)
                                </li>
                                <br>
                                <li> 
                                    MAX.—¡Salud hermano, si menor en años, mayor en prez!
                                </li>
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 9');

                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=CALLE%20ALCALA%2014%2C%20Madrid&type=portal&tip_via=CALLE&id=280790118799&portal=14&extension=null&outputformat=geojson",
                                    {
                                    }
                                ).then(function (res) {
                                    // Muestra un diálogo informativo con el resultado de la petición get
                                    gjson = JSON.parse(res.text)
    
                                    layerVectorialGJSON.setStyle(estilo1)
                                    layerVectorialGJSON_Madrid.setZIndex(49)
                                    layerVectorialGJSON_Libro.setZIndex(50)
    
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
                                    Ahora pisa el Café Colón presidido por el ídolo índico, maestro del modernismo y de su estilo idealista, 
                                    Rubén Darío. Al cruzar el dintel, Max y Latino son transfigurados por el triple ritmo de la luz en los 
                                    “empañados espejos” multiplicadores, del “compás canalla de la música” y del “vaho de humo penetrado del 
                                    temblor de los arcos voltaicos” da a toda la escena una geometría absurda. 
                                    
                                </li>
                                <br>
                                <li> 
                                    Por la descripción que hace Valle-Inclán en la acotación, podría tratarse del Café Universal que 
                                    estaba en el número 14 de la Calle de Alcalá. 
                                </li>
                                <br>
                                 <br>
                                <li> 
                                    Aquí Max, la Mala Estrella es “Estrella resplandeciente”, y Rubén lo elogia como un San Martín de Tours pues viene 
                                    a compartir su capa trasmudada en cena con él. Max gasta el dinero de los “reptiles”y, por un momento, 
                                    gracias al sortilegio del alcohol y de la música de opereta acentuada por las cucharillas en los vasos, 
                                    los tres desterrados vuelven a su paraíso y, hablando en francés “recuerdan y proyectan las luces de 
                                    la fiesta divina y mortal. “¡París! ¡Cabarets!, ¡Ilusión! y en el ritmo de las frases, desfila con su pata coja, 
                                    Papá Verlaine.” 
                                </li>
                                <br>
                                <li> 
                                    Los fragmentos modernistas que se esparcen en LDB contribuyen a dar la impresión de gente que vive enajenada de literatura,
                                    esclava de su pequeña cultura, de su erudición en versos y desdichas. Pero donde podemos apreciar más ceñidamente cómo 
                                    el habla sirve para retratar con indelebles apuntes una personalidad, es en la aparición de Rubén Darío. 
                                    El poeta nicaragüense se mueve, en gran parte en un café, bebiendo, lejano, ausente, forcejeando por 
                                    «distinguir eses y cedas».
                                </li>
                                <br>
                                <li> 
                                    Y el gran recurso de su diálogo es repetir copiosamente la palabreja alta de la época: «Admirable».
                                </li>
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 9');

                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=CALLE%20ALCALA%2014%2C%20Madrid&type=portal&tip_via=CALLE&id=280790118799&portal=14&extension=null&outputformat=geojson",
                                    {
                                    }
                                ).then(function (res) {
                                    // Muestra un diálogo informativo con el resultado de la petición get
                                    gjson = JSON.parse(res.text)
    
                                    layerVectorialGJSON.setStyle(estilo1)
                                    layerVectorialGJSON_Madrid.setZIndex(49)
                                    layerVectorialGJSON_Libro.setZIndex(50)
    
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
                                    Por la descripción que hace Valle-Inclán en la acotación, podría tratarse del Café Universal que estaba en 
                                    el número 14 de la Calle de Alcalá. 
                                </li>
                                <br>
                                <li> 
                                    El Café Universal o "café de los espejos" fue un establecimiento de Madrid, situado 
                                    en el número 15 (luego 14) de la Puerta del Sol, esquina al inicio de la calle de Alcalá. 
                                    Abierto mediado el siglo xix se mantuvo hasta 1974
                                </li>
                                <br>
                                 <br>
                                <li> 
                                    El Universal llamaba la atención por sus espejos enfrentados que conseguían un efecto óptico sorprendente para la época. 
                                    La decoración con pinturas firmadas por Piccoli, Amerigo, Bonardo y Bussato, mezclaba imitaciones de estéticas 
                                    italianizantes. El gran salón mostraba una escalera de caracol que subía al entresuelo, donde disponía de comedores 
                                    privados, mesas de tresillo y de billar, planta que también tenía acceso directo desde la calle.
                                </li>
                                <br>
                                <li> 
                                    El café de los espejos tuvo entre sus más distinguidos clientes a Benito Pérez Galdós, 
                                    miembro eventual en la tertulia de los "canarios",6 y que en los Episodios titulados La de los tristes destinos (1907) 
                                    y España Trágica (1909), inmortalizó a uno de sus camareros, Pepe “el malagueño”. 
                                    Entre los contertulios de Galdós, cabe mencionar a Fernando León y Castillo y Agustín Espinosa.
                                </li>
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 9');

                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=CALLE%20ALCALA%2014%2C%20Madrid&type=portal&tip_via=CALLE&id=280790118799&portal=14&extension=null&outputformat=geojson",
                                    {
                                    }
                                ).then(function (res) {
                                    // Muestra un diálogo informativo con el resultado de la petición get
                                    gjson = JSON.parse(res.text)
    
                                    layerVectorialGJSON.setStyle(estilo2)
                                    layerVectorialGJSON_Madrid.setZIndex(50)
                                    layerVectorialGJSON_Libro.setZIndex(49)
    
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
                                    Entre los años 1908 y 1914 Ramón María del Valle Inclán tuvo su importante tertulia en este café con música con 
                                    la asistencia de José Augusto Martínez “Azorín”, Rubén Darío, Santiago Rusiñol Prats, Julio Romero de Torres, Pío y 
                                    Ricardo Baroja Nessi, José Gutiérrez Solana y el joven Rafael de Penagos Zalabardo, entre otros muchos. 
                                    
                                </li>
                                <br>
                                <li> 
                                    A medida que la tertulia de Valle Inclán tomaba nombre y resonancia, muchos eran los que a ella se acercaban 
                                    para escuchar o intervenir, mientras la música sonaba. Esto dio motivo a cierta confrontación entre melómanos y 
                                    tertulianos hasta que un día Valle Inclán, que se distinguía entonces por su falta de oído musical, con voz áspera y 
                                    sonora, gritó: 
                                </li>
                                <br>
                                <li> 
                                   ¡Que se calle Wagner, que no deja que se me oiga! Pero en aquella disputa ganó el alemán.
                                </li>
                                <br>
                                <li> 
                                    No fue en éste, sino en otro café donde se produjo el lance que dejaría manco a Valle-Inclán. 
                                    Así lo cuenta Ramón Gómez de la Serna:
                                </li>
                                <br>
                                <li> 
                                  En el Café de la Montaña (entre la calle de Alcalá y la carrera de San Jerónimo), que es donde se reunían Valle, 
                                  Benavente, Manuel Bueno, Fernández Bahamonte, Palomero y Ricardo Baroja, se puso a discutir aquel duelo pendiente. 
                                </li>
                                <br>
                                <li> 
                                  - Es inútil que traten ustedes ese duelo – dijo Manuel Bueno-. 
                                    No puede verificarse porque Leal da Cámara no tiene edad para batirse.
                                </li>
                                <br>
                                <li> 
                                  - No zea uzted majadero, que uzted no zabe una palabra de ezo- replicó Valle-Inclán.
                                </li>
                                 <br>
                                <li> 
                                    Manuel Bueno, al oírse insultado así, dio un paso atrás y levantó en el aire su bastón con barra de hierro.
                                    Valle agarró una botella de agua por el cuello, como si manejase un as de bastos, y, llenando de agua a todos, 
                                    dio lugar a que Manuel Bueno descargara el bastonazo; 
                                    pero con tanta mala fortuna que le incrustó en la carne el gemelo del puño. 
                                </li>
                                 <br>
                                <li> 
                                  Todo se arregló de momento, pero al día siguiente se gangrenaba la pequeña herida y el médico dijo a Ruiz Castillo y 
                                  a Benavente que había que cortar el brazo. Se consultó con don Ramón y éste dijo que sí, que lo amputasen, 
                                  pero sin cloroformizarle, y hasta hay hasta quien dice que se cortó parte de la barba para ver bien la operación, 
                                  añadiendo con mayor exageración que hubo que rectificar y cortarle por más arriba, 
                                  ¡presenciando también don Ramón el segundocorte operatorio fumándose un puro! 
                                </li>
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 9');

                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=CALLE%20SAN%20JERONIMO%204%2C%20Madrid&type=portal&tip_via=CALLE&id=280790179172&portal=4&extension=null&outputformat=geojson",
                                    {
                                    }
                                ).then(function (res) {
                                    // Muestra un diálogo informativo con el resultado de la petición get
                                    gjson = JSON.parse(res.text)
    
                                    layerVectorialGJSON.setStyle(estilo2)
                                    layerVectorialGJSON_Madrid.setZIndex(50)
                                    layerVectorialGJSON_Libro.setZIndex(49)
    
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
            ]
        },

        {
            "title": "Escena Décima",
            "subtitle": "",
            "steps": [
                {
                    "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                   Paseo con jardines. El cielo raso y remoto. La luna lunera.
                                    Patrullas de caballería. Silencioso y luminoso rueda un auto. En la
                                    sombra clandestina de los ramajes, merodean mozuelas pingonas y
                                    viejas pintadas como caretas. Repartidos por las sillas del paseo,
                                    yacen algunos bultos durmientes. MAX ESTRELLA y DON LATINO
                                    caminan bajo las sombras del paseo. El perfume primaveral de las
                                    lilas embalsama la humedad de la noche.
                                </li>
                                <br>
                                <br>
                                <li> 
                                  UNA VIEJA PINTADA.—¡Morenos! ¡Chis!… ¡Morenos! ¿Queréis venir un ratito?
                                </li>
                                <br>
                                <li> 
                                   DON LATINO.—Cuando te pongas los dientes.
                                </li>
                                <br>
                                <li> 
                                    LA VIEJA PINTADA.—¡No me dejáis siquiera un pitillo!
                                </li>
                                <br>
                                <li> 
                                   DON LATINO.—Te daré la Corres, para que te ilustres, publica una carta de Maura.
                                </li>
                                <br>
                                <li> 
                                   LA VIEJA PINTADA.—Que le den morcilla
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—Se la prohíbe el rito judaico
                                </li>
                                <br>
                                <li> 
                                    LA VIEJA PINTADA.—¡Mira el camelista!. Esperaros, que llamo a una amiguita. 
                                    ¡Lunares! ¡Lunares!
                                </li>
                                <br>
                                <li> 
                                    (Surge LA LUNARES, una mozuela pingona, medias blancas, delantal,
                                    toquilla y alpargatas. Con risa desvergonzada se detiene en la
                                    sombra del jardinillo.)
                                </li>
                                <br>
                                <li> 
                                    LA LUNARES.—¡Ay, qué pollos más elegantes! Vosotros me sacáis esta noche de la calle.
                                </li>
                                <br>
                                <li> 
                                    LA VIEJA PINTADA.—Nos ponen piso.
                                </li>
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 10');

                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=PASEO%20RECOLETOS,%20Madrid&type=callejero&tip_via=PASEO&id=280790007738&portal=null&extension=null&outputformat=geojson",
                                    {
                                    }
                                ).then(function (res) {
                                    // Muestra un diálogo informativo con el resultado de la petición get
                                    gjson = JSON.parse(res.text)
    
                                    layerVectorialGJSON.setStyle(estilo1)
                                    layerVectorialGJSON_Madrid.setZIndex(49)
                                    layerVectorialGJSON_Libro.setZIndex(50)
    
                                    layerVectorialGJSON.clear()
                                    layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null
                                    layerVectorialGJSON.setSource(gjson)
    
                                    layerVectorialGJSON.on(M.evt.LOAD, () => {
                                        mapjs.setBbox(layerVectorialGJSON.getMaxExtent())
                                        // mapajs.setZoom(18)
                                    }); 
                                });
                        `,
                },
                {
                    "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                    Estatua de Valle-Inclán
                                </li>
                                <br>
                                <br>
                                <li> 
                                  Ramón María del Valle-Inclán (Villanueva de Arosa, Pontevedra, 28 de octubre de 1866 - Santiago de Compostela,
                                   La Coruña, 5 de enero de 1936) fue un dramaturgo, poeta y novelista español, que formó parte de la corriente 
                                   literaria del modernismo. Se le considera uno de los autores clave de la literatura española del siglo XX.
                                </li>
                                <br>
                                <li> 
                                   Novelista, poeta y autor dramático español, además de cuentista, ensayista y periodista. Destacó en todos los géneros 
                                   que cultivó y fue un modernista de primera hora que satirizó amargamente la sociedad española de su época. 
                                   Estudió Derecho en Santiago de Compostela, pero interrumpió sus estudios para viajar a México, donde trabajó de 
                                   periodista en El Correo Español y El Universal
                                </li>
                                <br>
                                <li> 
                                    A su regreso a Madrid llevó una vida literaria, adoptando una imagen que parece encarnar algunos de sus personajes. 
                                    Actor de sí mismo, profesó un auténtico culto a la literatura, por la que sacrificó todo, 
                                    llevando una vida bohemia de la que corrieron muchas anécdotas. Perdió un brazo durante una pelea. 
                                    En 1916 visitó el frente francés de la I Guerra Mundial, y en 1922 volvió a viajar a México. 
                                </li>
                                <br>
                                <li> 
                                   Considerada Luces de bohemia una de sus obras más importantes, con ella Valle-Inclán inaugura un nuevo género 
                                   teatral, el «esperpento», y sería el primero de los cuatro textos que el propio autor consideraría de ese género. 
                                   En la escena duodécima de la obra, el propio protagonista lo considera como una manera de mirar el mundo. 
                                </li>
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 10');

                            gjsonn = {
                                "type": "FeatureCollection",
                                "crs": {
                                    "type": "name",
                                    "properties": {
                                    "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
                                    }
                                },
                                "features": [
                                {
                                    "type": "Feature",
                                    "geometry": {
                                        "type": "Point",
                                        "coordinates": [
                                            -3.691462,
                                            40.423551
                                        ]
                                    },
                                    "properties": {
            
                                    }
                                }
                                ]
                            }

                            layerVectorialGJSON.setStyle(estilo2)
                            layerVectorialGJSON_Madrid.setZIndex(50)
                            layerVectorialGJSON_Libro.setZIndex(49)

                            layerVectorialGJSON.clear()
                            layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null
                            layerVectorialGJSON.setSource(gjsonn)
                            

                            layerVectorialGJSON.on(M.evt.LOAD, () => {
                                mapjs.setBbox(layerVectorialGJSON.getMaxExtent())
                                mapajs.setZoom(18)
                            }); 
                        `,
                },
            ]
        },

        {
            "title": "Escena Undécima",
            "subtitle": "",
            "steps": [
                
                {
                    "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                    Una calle del Madrid austríaco. Las tapias de un convento. Un
                                    casón de nobles. Las luces de una taberna. Un grupo consternado de
                                    vecinas, en la acera. Una mujer, despechugada y ronca, tiene en los
                                    brazos a su niño muerto, la sien traspasada por el agujero de una
                                    bala. MAX ESTRELLA y DON LATINO, hacen un alto.
                                </li>
                                <br>
                                <br>
                                <li> 
                                  MAX.—También aquí se pisan cristales rotos
                                </li>
                                <br>
                                <li> 
                                   DON LATINO.—¡La zurra ha sido buena!
                                </li>
                                <br>
                                <li> 
                                    MAX.—¡Canallas!… ¡Todos!… ¡Y los primeros nosotros, los poetas!
                                </li>
                                <br>
                                <li> 
                                   DON LATINO.—¡Se vive de milagro!
                                </li>
                                <br>
                                <li> 
                                   LA MADRE DEL NIÑO.—¡Maricas, cobardes! ¡El fuego del Infierno os abrase las negras entrañas! ¡Maricas, cobardes!
                                </li>
                                <br>
                                <li> 
                                    MAX.—¿Qué sucede, Latino? ¿Quién llora? ¿Quién grita con tal rabia?
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—Una verdulera, que tiene a su chico muerto en los brazos.
                                </li>
                                <br>
                                <li> 
                                    MAX.—¡Me ha estremecido esa voz trágica!
                                </li>
                                <br>
                                <li> 
                                    LA MADRE DEL NIÑO.—¡Sicarios! ¡Asesinos de criaturas!
                                </li>
                                <br>
                                <li> 
                                    EL EMPEÑISTA.—Está con algún trastorno, y no mide palabras.
                                </li>
                                <br>
                                <li> 
                                    EL GUARDIA.—La autoridad también se hace el cargo.
                                </li>
                                <br>
                                <li> 
                                    EL TABERNERO.—Son desgracias inevitables para el restablecimiento del orden.
                                </li>
                                <br>
                                <li> 
                                    EL EMPEÑISTA.—Las turbas anárquicas, me han destrozado el escaparate.
                                </li>
                                <br>
                                <li> 
                                    LA PORTERA.—¿Cómo no anduvo usted más vivo en echar los cierres?
                                </li>
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 11');

                            layerVectorialGJSON.clear()
                            layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null

                            mapajs.setCenter({ x: -411597.7220705739, y: 4926892.792828205 })
                            mapajs.setZoom(15)
                        `,
                }
                
            ]
        },

        {
            "title": "Escena Doudécima",
            "subtitle": "",
            "steps": [
                {
                    "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                   Rinconada en Costanilla, y una iglesia barroca por fondo. Sobre
                                    las campanas negras, la luna clara. DON LATINO y MAX
                                    ESTRELLA, filosofan sentados en el quicio de una puerta. A lo
                                    largo de su coloquio, se torna lívido el cielo. En el alero de la iglesia
                                    pían algunos pájaros. Remotos albores de amanecida. Ya se han ido
                                    los serenos, pero aún están las puertas cerradas. Despiertan las
                                    porteras.
                                </li>
                                <br>
                                <br>
                                <li> 
                                    MAX.—¿Debe estar amaneciendo?
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—Así es.
                                </li>
                                <br>
                                <li> 
                                    MAX.—¡Y qué frío!
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—Vamos a dar unos pasos.
                                </li>
                                <br>
                                <li> 
                                    MAX.—Ayúdame, que no puedo levantarme. ¡Estoy aterido!
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—¡Mira que haber empeñado la capa!
                                </li>
                                <br>
                                <li> 
                                    MAX.—Préstame tu carrik, Latino.
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—¡Max, eres fantástico!
                                </li>
                                <br>
                                <li> 
                                    MAX.—Ayúdame a ponerme en pie.
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—¡Arriba, carcunda!
                                </li>
                                <br>
                                <li> 
                                    MAX.—¡No me tengo!
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—¡Qué tuno eres!
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—¡La verdad es que tienes una fisonomía algo rara!
                                </li>
                                <br>
                                <li> 
                                    MAX.—¡Don Latino de Hispalis, grotesco personaje, te inmortalizaré en una novela!
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—Una tragedia, Max.
                                </li>
                                <br>
                                <li> 
                                    MAX.—La tragedia nuestra no es tragedia
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—¡Pues algo será!
                                </li>
                                <br>
                                <li> 
                                    MAX.—El Esperpento.
                                </li>
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 11');

                            layerVectorialGJSON.clear()
                            layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null

                            mapajs.setCenter({ x: -411597.7220705739, y: 4926892.792828205 })
                            mapajs.setZoom(15)
                        `,
                },
                {
                    "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                  DON LATINO.—Incorpórate, Max. Vamos a caminar
                                </li>
                                <br>
                                <li> 
                                   MAX.—Estoy muerto.
                                </li>
                                <br>
                                <li> 
                                  DON LATINO.—¡Que me estás asustando! Max, vamos a caminar.
                                    Incorpórate. ¡No tuerzas la boca condenado! ¡Max! ¡Max! ¡Condenado,
                                    responde!
                                </li>
                                <br>
                                <li> 
                                   MAX.—Los muertos no hablan.
                                </li>
                                <br>
                                <li> 
                                  DON LATINO.—Definitivamente, te dejo.
                                </li>
                                <br>
                                <li> 
                                  MAX.—¡Buenas noches!
                                </li>
                                <br>
                                <li> 
                                  DON LATINO.—Max, estás completamente borracho, y sería un crimen
                                    dejarte la cartera encima, para que te la roben. Max, me llevo tu
                                    cartera, y te la devolveré mañana
                                </li>
                            
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 11');

                            layerVectorialGJSON.clear()
                            layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null

                            mapajs.setCenter({ x: -411597.7220705739, y: 4926892.792828205 })
                            mapajs.setZoom(15)
                        `,
                },
                {
                    "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                    Placa a Valle-Inclán en el Callejón del Gato
                                </li>
                                <br>
                                <br>
                                <li> 
                                    Este es el Callejón del Gato, templo del Esperpento. Aquí

                                    las bravas gentes cuidan el tabernáculo de los espejos, donde

                                    los peregrinos se quitan el cráneo, como Don Latino, ante Max

                                    Estrella, Vicario de Don Ramón y Pontífice del Esperpentismo.
                                </li>
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 12');

                             M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=CALLE%20%C3%81LVAREZ%20GATO%201,%20Madrid&type=portal&tip_via=CALLE&id=2280790040012&portal=1&extension=null&outputformat=geojson",
                                    {
                                    }
                                ).then(function (res) {
                                    // Muestra un diálogo informativo con el resultado de la petición get
                                    gjson = JSON.parse(res.text)
    
                                    layerVectorialGJSON.setStyle(estilo2)
                                    layerVectorialGJSON_Madrid.setZIndex(50)
                                    layerVectorialGJSON_Libro.setZIndex(49)
    
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
            ]
        },

        {
            "title": "Escena Decimatercia",
            "subtitle": "",
            "steps": [
                {
                    "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                    Velorio en un sotabanco. MADAMA COLLET y CLAUDINITA,
                                    desgreñadas y macilentas, lloran al muerto, ya tendido en la
                                    angostura de la caja, amortajado con una sábana, entre cuatro
                                    velas. Astillando una tabla, el brillo de un clavo aguza su punta
                                    sobre la sien inerme[1041]. La caja, embetunada de luto por fuera, y
                                    por dentro de tablas de pino sin labrar ni pintar, tiene una sórdida
                                    esterilla que amarillea. Está posada sobre las baldosas, de esquina a
                                    esquina, y las dos mujeres que lloran en los ángulos, tienen en las
                                    manos cruzadas el reflejo de las velas. DORIO DE GÁDEX, CLARINITO y
                                    PÉREZ, arrimados a la pared, son tres fúnebres fantoches en
                                    hilera. Repentinamente, entrometiéndose en el duelo,
                                    cloquea. un rajado repique, la campanilla de la
                                    escalera.
                                </li>
                                <br>
                                <br>
                                <li> 
                                  DORIO DE GÁDEX.—A las cuatro viene la Funeraria.
                                </li>
                                <br>
                                <li> 
                                   CLARINITO.—No puede ser esa hora.
                                </li>
                                <br>
                                <li> 
                                    DORIO DE GÁDEX.—¿Usted no tendrá reloj, Madama Collet?
                                </li>
                                <br>
                                <li> 
                                   MADAMA COLLET.—¡Que no me lo lleven todavía! ¡Que no me lo lleven!
                                </li>
                                <br>
                                <li> 
                                   PÉREZ.—No puede ser la Funeraria.
                                </li>
                                <br>
                                <li> 
                                    DORIO DE GÁDEX.—¡Ninguno tiene reloj! ¡No hay duda que somos unos potentados!
                                </li>
                                <br>
                                <li> 
                                    (CLAUDINITA, con andar cansado, trompicando, ha salido para abrir
                                    la puerta. Se oye rumor de voces, y la tos de DON LATINO DE HISPALIS.
                                    La tos clásica del tabaco y del aguardiente)
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—¡Ha muerto el Genio! ¡No llores, hija mía! ¡Ha muerto, y
                                    no ha muerto!… ¡El Genio es inmortal!… ¡Consuélate, Claudinita, porque
                                    eres la hija del primer poeta español! ¡Que te sirva de consuelo saber que
                                    eres la hija de Víctor Hugo! ¡Una huérfana ilustre! ¡Déjame que te abrace!
                                </li>
                                 <br>
                                <li> 
                                    CLAUDINITA.—¡Usted está borracho!
                                </li>
                                 <br>
                                <li> 
                                    DON LATINO.—Lo parezco. Sin duda lo parezco. ¡Es el dolor!
                                </li>
                                 <br>
                                <li> 
                                    CLAUDINITA.—¡Si tumba el vaho de aguardiente!
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—¡Es el dolor! ¡Un efecto del dolor, estudiado
                                    científicamente por los alemanes!
                                </li>
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 13');

                            layerVectorialGJSON.clear()
                            layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null

                            mapajs.setCenter({ x: -411597.7220705739, y: 4926892.792828205 })
                            mapajs.setZoom(15)
                        `,
                },
            ]
        },

        {
            "title": "Escena Decimacuarta",
            "subtitle": "",
            "steps": [
                {
                    "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                    Un patio en el cementerio del este. La tarde fría. El viento
                                    adusto. La luz de la tarde sobre los muros de lápidas, tiene una aridez
                                    agresiva. DOS SEPULTUREROS apisonan la tierra de una fosa. Un
                                    momento suspenden la tarea: Sacan lumbre del yesquero, y las
                                    colillas de tras la oreja. Fuman sentados al pie del hoyo
                                </li>
                                <br>
                                <br>
                                <li> 
                                  UN SEPULTURERO.—Ese sujeto era un hombre de pluma.
                                </li>
                                <br>
                                <li> 
                                   OTRO SEPULTURERO.—¡Pobre entierro ha tenido!
                                </li>
                                <br>
                                <li> 
                                    UN SEPULTURERO.—Los papeles lo ponen por hombre de mérito.
                                </li>
                                <br>
                                <li> 
                                   OTRO SEPULTURERO.—En España el mérito no se premia. 
                                   Se premia el robar y el ser sinvergüenza. En España se premia todo lo malo
                                </li>
                                <br>
                                <li> 
                                   UN SEPULTURERO.—¡No hay que poner las cosas tan negras!
                                </li>
                                <br>
                                <li> 
                                    OTRO SEPULTURERO.—¡Ahí tienes al Pollo del Arete!
                                </li>
                                <br>
                                <li> 
                                    UN SEPULTURERO.—¿Y ése qué ha sacado?
                                </li>
                                <br>
                                <li> 
                                    OTRO SEPULTURERO.—Pasarlo como un rey siendo un malasangre.
                                    Míralo, disfrutando a la viuda de un concejal.
                                </li>
                                 <br>
                                <li> 
                                    UN SEPULTURERO.—Di un ladrón del Ayuntamiento.
                                </li>
                                 <br>
                                <li> 
                                    OTRO SEPULTURERO.—Ponlo por dicho. ¿Te parece que una mujer de
                                    posición se chifle así por un tal sujeto?
                                </li>
                                <br>
                                <li> 
                                    UN SEPULTURERO.—Cegueras. Es propio del sexo
                                </li>
                                <br>
                                <li> 
                                    OTRO SEPULTURERO.—¡Ahí tienes el mérito que triunfa! ¡Y para todo la misma ley!
                                </li>
                            </ul>

                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                            <br><br><br><br> <br><br><br> <br><br><br>
                        `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 14');

                            M.remote.get("https://www.cartociudad.es/geocoder/api/geocoder/find?q=Capilla%20del%20Cementerio%20de%20Nuestra%20Se%C3%B1ora%20de%20la%20Almudena%2C%20Madrid&type=toponimo&tip_via=Iglesia&id=BTN_423352&portal=null&extension=null&outputformat=geojson",
                                    {
                                    }
                                ).then(function (res) {
                                    // Muestra un diálogo informativo con el resultado de la petición get
                                    gjson = JSON.parse(res.text)
    
                                    layerVectorialGJSON.setStyle(estilo1)
                                    layerVectorialGJSON_Madrid.setZIndex(49)
                                    layerVectorialGJSON_Libro.setZIndex(50)
    
                                    layerVectorialGJSON.clear()
                                    layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null
                                    layerVectorialGJSON.setSource(gjson)
    
                                    layerVectorialGJSON.on(M.evt.LOAD, () => {
                                        mapjs.setBbox(layerVectorialGJSON.getMaxExtent())
                                        mapajs.setZoom(15)
                                    }); 
                                });
                        `,
                },
            ]
        },
        {
            "title": "Escena Última",
            "subtitle": "",
            "steps": [
                {
                    "html": `   <br><br><br><br>

                            <ul>
                                <li> 
                                    La taberna de PICA LAGARTOS. —Lobreguez con un temblor
                                    de acetileno—. DON LATINO DE HISPALIS, ante el mostrador, insiste y
                                    tartajea convidando al POLLO DEL PAY-PAY. Entre traspiés y
                                    traspiés, da la pelma.
                                </li>
                                <br>
                                <br>
                                <li> 
                                  DON LATINO.—¡Beba usted, amigo! ¡Usted no sabe la pena que rebosa
                                    mi corazón! ¡Beba usted! ¡Yo bebo sin dejar cortinas!
                                </li>
                                <br>
                                <li> 
                                   EL POLLO. —Porque usted no es castizo.
                                </li>
                                <br>
                                <li> 
                                    DON LATINO.—¡Hoy hemos enterrado al primer poeta de España!
                                    ¡Cuatro amigos en el cementerio! ¡Acabose! ¡Ni una cabrona representación
                                    de la Docta Casa!. ¿Qué te parece, Venancio?
                                </li>
                                <br>
                                <li> 
                                   PICA LAGARTOS. —Lo que usted guste, Don Latí.
                                </li>
                                <br>
                                <li> 
                                   DON LATINO.—¡El Genio brilla con luz propia! ¿Que no, Pollo?
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
                            console.log('hola, estoy comenzando el cap 7');

                            layerVectorialGJSON.clear()
                            layerVectorialGJSON.getImpl().loadFeaturesPromise_ = null

                            mapajs.setCenter({ x: -413064.3575507956, y: 4927841.089710372 })
                            mapajs.setZoom(13)
                        `,
                },
            ]
        },


    ]


}
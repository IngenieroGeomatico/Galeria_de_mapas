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
                    "html": `
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
                            
                        `,

                },
            ]
        },

        {
            "title": "Escena Segunda",
            "subtitle": "",
            "steps": []
        },

        {
            "title": "Escena Tercera",
            "subtitle": "",
            "steps": []
        },

        {
            "title": "Escena Cuarta",
            "subtitle": "",
            "steps": []
        },

        {
            "title": "Escena Quinta",
            "subtitle": "",
            "steps": []
        },

        {
            "title": "Escena Sexta",
            "subtitle": "",
            "steps": []
        },

        {
            "title": "Escena Séptima",
            "subtitle": "",
            "steps": []
        },

        {
            "title": "Escena Octava",
            "subtitle": "",
            "steps": []
        },

        {
            "title": "Escena Novena",
            "subtitle": "",
            "steps": []
        },

        {
            "title": "Escena Décima",
            "subtitle": "",
            "steps": []
        },

        {
            "title": "Escena Undécima",
            "subtitle": "",
            "steps": []
        },

        {
            "title": "Escena Doudécima",
            "subtitle": "",
            "steps": []
        },

        {
            "title": "Escena Decimatercia",
            "subtitle": "",
            "steps": []
        },

        {
            "title": "Escena Decimacuarta",
            "subtitle": "",
            "steps": []
        },
        {
            "title": "Escena Última",
            "subtitle": "",
            "steps": []
        },









        {
            "title": "Capítulo 1",
            "subtitle": "gestión del mapa",
            "steps": [
                {
                    "html": `
                                <ol id='indexContent2'>
                                    <li index=\"1\" style=" padding: 10px;" onMouseOver="this.style.color='darkorange'; this.style.cursor='pointer';" onMouseOut="this.style.color='';"  onclick='functionIndex(this)' id='centroMapa'> 
                                            Obtener el centro y el zoom del mapa 
                                    </li>
                                    <li index=\"2\" style=" padding: 10px;" onMouseOver="this.style.color='darkorange'; this.style.cursor='pointer';" onMouseOut="this.style.color='';"  onclick='functionIndex(this)' id='zoomMapa'> 
                                            Obtener el mínimo rectángulo envolvenete o BBOX
                                    </li>
                                </ol>

                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                            `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 1');
                            

                            function functionIndex(li) {
                                var nodes = Array.from( li.closest('ol').children );
                                var index = nodes.indexOf( li ) +1 ;
                                stringSVG = "pointStep"
                                document.getElementById(stringSVG.concat(index)).dispatchEvent(new Event('click'))
                            };

                            
                        `,

                },
                {
                    "html": `

                                <section id="centroMapaSection"> 
                                        <div class='place'>
                                            <h4>Centro del mapa y zoom</h4> 
                                        </div> 

                                        <ul> 
                                                <li style=" padding: 10px;" >Para obtener la posición del mapa usaremos el método mapajs.getCenter() </li> 
                                                <li style=" padding: 10px;" >Para obtener el zoom actual del mapa usaremos el método mapajs.getZoom() </li> 
                                                <li style=" padding: 10px;" >Para mover el mapa a una posición en concreto, se puede usar el método mapajs.setCenter() </li> 
                                                <li style=" padding: 10px;" >Para cambiar el zoom del mapa, se puede usar el método mapajs.setZoom() </li> 

                                                <ol> 
                                                    <li style=" padding: 10px;"  onMouseOver="this.style.color='darkorange'; this.style.cursor='pointer';" onMouseOut="this.style.color='';"  onclick='mapjs.setCenter([-411265.54,4926379.30]); mapjs.setZoom(10);'> Madrid </li> 
                                                    <li style=" padding: 10px;"  onMouseOver="this.style.color='darkorange'; this.style.cursor='pointer';" onMouseOut="this.style.color='';"  onclick='mapjs.setCenter([-54098.36,4629613.86]); mapjs.setZoom(12);'> Alicante </li> 
                                                </ol> 
                                              
                                        </ul> 
                                        
                                        
                                        
                                </section>
                                
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                            `,
                    "js": `
                            console.log('cap 1, centro del mapa');
                            console.log(mapajs.getCenter());

                        `,

                },
                {
                    "html": `

                                <section id="centroMapaSection"> 
                                        <div class='place'>
                                            <h4> Mínimo rectángulo envolvenete o BBOX</h4> 
                                        </div> 

                                        <ul> 
                                                <li style=" padding: 10px;" >Para obtener la posición del mapa usaremos el método mapajs.getBbox() </li> 

                                              
                                        </ul> 
                                        
                                        
                                        
                                </section>
                                
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                            `,
                    "js": `
                            console.log('cap 1, BBOX del mapa');
                            console.log(mapajs.getBbox());

                        `,

                }
            ]
        },
        {
            "title": "Capítulo 2",
            "subtitle": "gestión de utilidades",
            "steps": [
                {
                    "html": `
                                <ol id='indexContent2'>
                                    <li index=\"1\" style=" padding: 10px;" onMouseOver="this.style.color='darkorange'; this.style.cursor='pointer';" onMouseOut="this.style.color='';"  onclick='functionIndex(this)' > 
                                        Diálogos
                                    </li>
                                    <li index=\"2\" style=" padding: 10px;" onMouseOver="this.style.color='darkorange'; this.style.cursor='pointer';" onMouseOut="this.style.color='';"  onclick='functionIndex(this)' > 
                                        Toasts
                                    </li>
                                </ol>

                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                            `,
                    "js": `
                            console.log('hola, estoy comenzando el cap 2');
                            

                            function functionIndex(li) {
                                var nodes = Array.from( li.closest('ol').children );
                                var index = nodes.indexOf( li ) +1 ;
                                stringSVG = "pointStep"
                                document.getElementById(stringSVG.concat(index)).dispatchEvent(new Event('click'))
                            };

                            
                        `,

                },
                {
                    "html": `

                                <section > 
                                        <div class='place'>
                                            <h4>Diálogos</h4> 
                                        </div> 

                                        <ul> 
                                                <li style=" padding: 10px;" >Para hacer uso de los distintos diálogos, se utiliza el método M.dialog.{tipoDeDialogo}.("texto del diálogo")</li> 
                                                <li style=" padding: 10px;" >Los tipos de diálogos disponibles son: </li> 

                                                <ol> 
                                                    <li style=" padding: 10px;"  onMouseOver="this.style.color='darkorange'; this.style.cursor='pointer';" onMouseOut="this.style.color='';"  onclick="M.dialog.info('Mensaje informativo', 'Diálogo informativo');"> de información </li> 
                                                    <li style=" padding: 10px;"  onMouseOver="this.style.color='darkorange'; this.style.cursor='pointer';" onMouseOut="this.style.color='';"  onclick="M.dialog.success('Mensaje de éxito');"> de éxito </li> 
                                                    <li style=" padding: 10px;"  onMouseOver="this.style.color='darkorange'; this.style.cursor='pointer';" onMouseOut="this.style.color='';"  onclick="M.dialog.error('Mensaje de error', 'Diálogo de error', 1);"> de error </li> 
                                                </ol> 
                                              
                                        </ul> 
                                        
                                        
                                        
                                </section>
                                
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                            `,
                    "js": `
                            console.log('cap 2, diálogos'); 
                        `,

                },
                {
                    "html": `

                                <section > 
                                        <div class='place'>
                                            <h4>Toast</h4> 
                                        </div> 

                                        <ul> 
                                                <li style=" padding: 10px;" >Para hacer uso de los distintos avisos medainte toast, se utiliza el método M.toast.{tipoDeDialogo}.("texto del toast")</li> 
                                                <li style=" padding: 10px;" >Los tipos de toast disponibles son: </li> 

                                                <ol> 
                                                    <li style=" padding: 10px;"  onMouseOver="this.style.color='darkorange'; this.style.cursor='pointer';" onMouseOut="this.style.color='';"  onclick="M.toast.info('Notificación informativa', 1, 6000); "> de información </li> 
                                                    <li style=" padding: 10px;"  onMouseOver="this.style.color='darkorange'; this.style.cursor='pointer';" onMouseOut="this.style.color='';"  onclick="M.toast.success('Notificación de éxito');"> de éxito </li> 
                                                    <li style=" padding: 10px;"  onMouseOver="this.style.color='darkorange'; this.style.cursor='pointer';" onMouseOut="this.style.color='';"  onclick="M.toast.error('Notificación de error', null, 8000);"> de error </li> 
                                                    <li style=" padding: 10px;"  onMouseOver="this.style.color='darkorange'; this.style.cursor='pointer';" onMouseOut="this.style.color='';"  onclick="M.toast.warning('Notificación de aviso');"> de aviso</li> 
                                                </ol> 
                                              
                                        </ul> 
                                        
                                        
                                        
                                </section>
                                
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                                <br><br><br><br> <br><br><br> <br><br><br>
                            `,
                    "js": `
                            console.log('cap 2, toast'); 
                        `,

                },
            ]
        },
    ]


}

// Obtener todos los enlaces
const links = document.querySelectorAll('.nav-links a');
// Selecciona el elemento
const mapaID = document.getElementById('mapaID');
const containerID = document.getElementById('containerID');
const infoID = document.getElementById('infoID');



// Añadir un evento de clic a cada enlace
links.forEach(link => {
    link.addEventListener('click', (e) => {

        // Eliminar la clase 'activeButton' de todos los enlaces
        links.forEach(l => l.classList.remove('activeButton'));

        const accordions = document.querySelectorAll('.accordion.active');

        // Recorremos todos esos elementos
        accordions.forEach(function(accordion) {
          // Eliminamos la clase 'active' de cada uno de los elementos
          accordion.click()
        });

        // Añadir la clase 'activeButton' al enlace clicado
        link.classList.add('activeButton');

        if (e.target.id == "Arhivos"){// Establecer la propiedad hidden a false
          mapaID.style.visibility = "hidden";
          mapaID.hidden = true
          
          infoID.style.visibility = "hidden";
          infoID.hidden = true

          containerID.style.visibility = "visible";
          containerID.hidden = false

        }else if (e.target.id == "Info"){// Establecer la propiedad hidden a false
          mapaID.style.visibility = "hidden";
          mapaID.hidden = true

          containerID.style.visibility = "hidden";
          containerID.hidden = true

          infoID.style.visibility = "visible";
          infoID.hidden = false

        }else if (e.target.id == "Mapa"){// Establecer la propiedad hidden a false
          
          containerID.style.visibility = "hidden";
          containerID.hidden = true

          infoID.style.visibility = "hidden";
          infoID.hidden = true

          mapaID.style.visibility = "visible";
          mapaID.hidden = false;

          // setTimeout(function(){ 
            
          //   mapaID.style.visibility = "visible";
          //   mapaID.hidden = false;

          // }, 500);

          // setTimeout(function(){ 
            
          //   mapajs.setCenter({x: -841284.6582134482, y: 4219019.308751002})
          //   mapajs.setZoom(5)

          // }, 2000);

          

          

        }
    });
});
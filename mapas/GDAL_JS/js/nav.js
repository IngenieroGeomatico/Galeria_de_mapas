'use strict';

(function () {
  function getPanel(id) {
    return document.getElementById(id);
  }

  function showTab(targetId) {
    const mapaID = getPanel('mapaID');
    const containerID = getPanel('containerID');
    const infoID = getPanel('infoID');
    const links = document.querySelectorAll('.nav-links a');

    // Desactivar todos los links
    links.forEach((l) => l.classList.remove('activeButton'));

    if (targetId === 'Arhivos' || targetId === 'Archivos') {
      const link = document.getElementById('Arhivos') || document.getElementById('Archivos');
      if (link) link.classList.add('activeButton');

      if (mapaID) {
        mapaID.style.visibility = 'hidden';
        mapaID.style.display = 'none';
        mapaID.hidden = true;
      }
      if (infoID) {
        infoID.style.visibility = 'hidden';
        infoID.style.display = 'none';
        infoID.hidden = true;
      }
      if (containerID) {
        containerID.style.visibility = 'visible';
        containerID.style.display = 'block';
        containerID.hidden = false;
      }
    } else if (targetId === 'Info') {
      const link = document.getElementById('Info');
      if (link) link.classList.add('activeButton');

      if (mapaID) {
        mapaID.style.visibility = 'hidden';
        mapaID.style.display = 'none';
        mapaID.hidden = true;
      }
      if (containerID) {
        containerID.style.visibility = 'hidden';
        containerID.style.display = 'none';
        containerID.hidden = true;
      }
      if (infoID) {
        infoID.style.visibility = 'visible';
        infoID.style.display = 'block';
        infoID.hidden = false;
      }
    } else if (targetId === 'Mapa') {
      const link = document.getElementById('Mapa');
      if (link) link.classList.add('activeButton');

      if (containerID) {
        containerID.style.visibility = 'hidden';
        containerID.style.display = 'none';
        containerID.hidden = true;
      }
      if (infoID) {
        infoID.style.visibility = 'hidden';
        infoID.style.display = 'none';
        infoID.hidden = true;
      }
      if (mapaID) {
        mapaID.style.visibility = 'visible';
        mapaID.style.display = 'block';
        mapaID.hidden = false;
      }
    }
  }

  window.showTabGDAL = showTab;

  // Delegación de eventos en el documento para que funcione siempre aunque el DOM cambie
  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('.nav-links a');
    if (!link) return;
    e.preventDefault();

    const navCheck = document.getElementById('nav-check');
    if (navCheck) {
      navCheck.checked = false;
    }

    // Colapsar acordeones abiertos en Info
    const accordions = document.querySelectorAll('.accordion.active');
    accordions.forEach((accordion) => {
      accordion.click();
    });

    showTab(link.id);
  });
})();

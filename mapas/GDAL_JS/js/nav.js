'use strict';

(function () {
  function showTab(targetId) {
    const mapaID = document.getElementById('mapaID');
    const containerID = document.getElementById('containerID');
    const infoID = document.getElementById('infoID');
    const links = document.querySelectorAll('.nav-links a');

    // Desactivar todos los links
    links.forEach((l) => l.classList.remove('activeButton'));

    if (targetId === 'Arhivos' || targetId === 'Archivos') {
      const link = document.getElementById('Arhivos') || document.getElementById('Archivos');
      if (link) link.classList.add('activeButton');

      if (mapaID) mapaID.classList.add('is-hidden');
      if (infoID) infoID.classList.add('is-hidden');
      if (containerID) containerID.classList.remove('is-hidden');
    } else if (targetId === 'Info') {
      const link = document.getElementById('Info');
      if (link) link.classList.add('activeButton');

      if (mapaID) mapaID.classList.add('is-hidden');
      if (containerID) containerID.classList.add('is-hidden');
      if (infoID) infoID.classList.remove('is-hidden');
    } else if (targetId === 'Mapa') {
      const link = document.getElementById('Mapa');
      if (link) link.classList.add('activeButton');

      if (containerID) containerID.classList.add('is-hidden');
      if (infoID) infoID.classList.add('is-hidden');
      if (mapaID) {
        mapaID.classList.remove('is-hidden');
        mapaID.removeAttribute('hidden');
        if (window.mapajs) {
          if (typeof window.mapajs.updateSize === 'function') {
            window.mapajs.updateSize();
          }
          const impl = window.mapajs.getMapImpl && window.mapajs.getMapImpl();
          if (impl && typeof impl.updateSize === 'function') {
            impl.updateSize();
          }
        }
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

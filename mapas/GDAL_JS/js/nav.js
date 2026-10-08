'use strict';

(function () {
  const links = document.querySelectorAll('.nav-links a');
  const mapaID = document.getElementById('mapaID');
  const containerID = document.getElementById('containerID');
  const infoID = document.getElementById('infoID');
  const navCheck = document.getElementById('nav-check');

  if (!links.length || !mapaID || !containerID || !infoID) return;

  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();

      // Close mobile menu if open
      if (navCheck) {
        navCheck.checked = false;
      }

      // Remove active state from all links
      links.forEach((l) => l.classList.remove('activeButton'));

      // Collapse any open accordions in Info panel
      const accordions = document.querySelectorAll('.accordion.active');
      accordions.forEach((accordion) => {
        accordion.click();
      });

      // Activate clicked link
      link.classList.add('activeButton');

      const targetId = e.target.id;

      if (targetId === 'Arhivos' || targetId === 'Archivos') {
        // Show files panel
        mapaID.style.visibility = 'hidden';
        mapaID.hidden = true;

        infoID.style.visibility = 'hidden';
        infoID.hidden = true;

        containerID.style.visibility = 'visible';
        containerID.hidden = false;
      } else if (targetId === 'Info') {
        // Show info panel
        mapaID.style.visibility = 'hidden';
        mapaID.hidden = true;

        containerID.style.visibility = 'hidden';
        containerID.hidden = true;

        infoID.style.visibility = 'visible';
        infoID.hidden = false;
      } else if (targetId === 'Mapa') {
        // Show map
        containerID.style.visibility = 'hidden';
        containerID.hidden = true;

        infoID.style.visibility = 'hidden';
        infoID.hidden = true;

        mapaID.style.visibility = 'visible';
        mapaID.hidden = false;
      }
    });
  });
})();

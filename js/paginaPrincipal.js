/* ==========================================================================
   Galería de Mapas - lógica de la página principal
   --------------------------------------------------------------------------
   Se encarga de tres cosas:
     1. Filtrar las tarjetas al escribir en el buscador.
     2. Mantener coherentes los contadores y el estado "sin resultados".
     3. Registrar el service worker.

   El buscador también acepta el parámetro ?q= en la URL (enlace profundo):
   al abrir index.html?q=madrid se aplica el filtro nada más cargar.

   Nota sobre el selector del filtro: antes se usaba $("#examples div"), que
   es un selector de descendencia y por tanto también enganchaba los div
   interiores de cada tarjeta; al ocultarlos de forma independiente se veían
   tarjetas a medio borrar. Ahora se seleccionan por clase, así que la
   estructura interna de la tarjeta puede cambiar sin romper la búsqueda.
   ========================================================================== */

$(document).ready(function () {
  const $galeria = $("#examples");
  const $tarjetas = $galeria.find(".tarjeta-col");
  const $secciones = $galeria.find(".seccion");
  const $resumen = $("#resumen");
  const $resumenTexto = $("#resumenTexto");
  const $input = $("#keywords");
  const $limpiar = $("#limpiarBusqueda");
  const $restablecer = $("#restablecerBusqueda");
  const $sinResultados = $("#sinResultados");

  /* Se comparan textos sin acentos ni mayúsculas para que "aer" encuentre
     "Aire" y "cartografia" encuentre "Cartografía". */
  function normalizar(texto) {
    return (texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  /* El texto de cada tarjeta se lee una sola vez al cargar y se guarda, en
     lugar de releer el DOM en cada pulsación de teclado. */
  const textoBuscable = $tarjetas
    .map(function () {
      return normalizar($(this).text());
    })
    .get();

  /* Las tarjetas de una sección son sus hermanos siguientes hasta la próxima
     sección, así que el contador y el filtrado se resuelven con nextUntil. */
  const secciones = [];
  $secciones.each(function () {
    secciones.push({
      $el: $(this),
      $tarjetas: $(this).nextUntil(".seccion", ".tarjeta-col"),
      total: $(this).nextUntil(".seccion", ".tarjeta-col").length
    });
  });

  const totalMapas = $tarjetas.length;
  const totalSecciones = secciones.length;

  function pluralizar(n, singular, plural) {
    return n === 1 ? singular : plural;
  }

  function aplicarFiltro(termino) {
    const consulta = normalizar(termino).trim();
    const hayConsulta = consulta.length > 0;
    let mostradas = 0;

    $tarjetas.each(function (indice) {
      const coincide = !hayConsulta || textoBuscable[indice].indexOf(consulta) > -1;
      $(this).toggle(coincide);
    });

    /* Cada sección se mantiene visible si le queda alguna tarjeta: si no, su
       título se quedaría colgando sobre un hueco vacío. El contador pasa a
       mostrar las coincidencias de esa sección mientras hay búsqueda. */
    secciones.forEach(function (seccion) {
      const visibles = seccion.$tarjetas.filter(":visible").length;
      seccion.$el.toggle(visibles > 0);
      seccion.$el.find(".seccion__contador").text(visibles || (hayConsulta ? 0 : seccion.total));
      mostradas += visibles;
    });

    $limpiar.prop("hidden", !hayConsulta);
    $sinResultados.prop("hidden", mostradas > 0);

    if (hayConsulta) {
      $resumenTexto.text(
        mostradas + " " + pluralizar(mostradas, "resultado", "resultados") + " para «" + termino.trim() + "»"
      );
    } else {
      $resumenTexto.text(
        totalMapas + " visualizadores en " + totalSecciones + " " +
        pluralizar(totalSecciones, "sección", "secciones")
      );
    }
  }

  function limpiarBusqueda() {
    $input.val("");
    aplicarFiltro("");
    $input.trigger("focus");
  }

  $input.on("input", function () {
    aplicarFiltro($(this).val());
  });

  $input.on("keydown", function (evento) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      limpiarBusqueda();
    }
  });

  $limpiar.on("click", limpiarBusqueda);
  $restablecer.on("click", limpiarBusqueda);

  /* Enlace profundo: index.html?q=madrid */
  const parametroQ = new URLSearchParams(window.location.search).get("q");
  aplicarFiltro(parametroQ || "");
  if (parametroQ) {
    $input.val(parametroQ);
  }
});


if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("/serviceWorker.js")
      .then(res => console.log("service worker registered"))
      .catch(err => console.log("service worker not registered", err))
  })
}
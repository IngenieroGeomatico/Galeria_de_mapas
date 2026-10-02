// El nombre de la caché forma parte de la estrategia: la estrategia de fetch
// es cache-first, así que sin subir la versión los visitantes que ya tuvieran
// el service worker instalado seguirían recibiendo para siempre el index.html,
// el CSS y el JS antiguos. Hay que tocarlo en cada despliegue que cambie
// alguno de los tres ficheros de la lista "assets".
const staticGalMAps = "galeria-mapas-v2"
const assets = [
  "/",
  "/index.html",
  "/css/paginaPrincipal.css",
  "/js/paginaPrincipal.js",
  // El logo va en local precisamente porque el CDN que lo servía
  // (componentes.idee.es) no respondía; precargarlo evita además que la
  // cabecera salga sin logo cuando la PWA funciona sin conexión.
  "/img/logo/API_IDEE.svg",
]

self.addEventListener("install", installEvent => {
  installEvent.waitUntil(
    caches.open(staticGalMAps)
      .then(cache => {
        return cache.addAll(assets)
      })
      // Sin esto el service worker nuevo espera a que se cierren todas las
      // pestañas abiertas y el rediseño no aparecería hasta la visita
      // siguiente; con skipWaiting se activa en cuanto se instala.
      .then(() => self.skipWaiting())
  )
})

// Se vacían las cachés de versiones anteriores al activar la nueva.
self.addEventListener("activate", activateEvent => {
  activateEvent.waitUntil(
    caches.keys().then(claves => {
      return Promise.all(
        claves.filter(clave => clave !== staticGalMAps).map(clave => caches.delete(clave))
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", fetchEvent => {
    fetchEvent.respondWith(
      caches.match(fetchEvent.request).then(res => {
        return res || fetch(fetchEvent.request)
      })
    )
  })
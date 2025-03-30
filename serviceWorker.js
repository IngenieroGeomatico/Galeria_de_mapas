const staticGalMAps = "galeria-mapas-v1"
const assets = [
  "/",
  "/index.html",
  "/css/paginaPrincipal.css",
  "/js/paginaPrincipal.js",
]

self.addEventListener("install", installEvent => {
  installEvent.waitUntil(
    caches.open(staticGalMAps).then(cache => {
      cache.addAll(assets)
    })
  )
})

self.addEventListener("fetch", fetchEvent => {
    fetchEvent.respondWith(
      caches.match(fetchEvent.request).then(res => {
        return res || fetch(fetchEvent.request)
      })
    )
  })
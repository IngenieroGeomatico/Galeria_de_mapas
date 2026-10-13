#!/usr/bin/env python3
"""
Genera las copias locales del catálogo de servicios de la IDEE.

El catálogo vive en el portal de la IDEE, partido en secciones por tipo de
servicio, y cada una se pide con una URL como esta:

  https://www.idee.es/web/idee/segun-tipo-de-servicio
    ?p_p_id=es_igncnig_dirserv72_DirectorioServiciosPortlet_INSTANCE_<token>
    &p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_cacheability=cacheLevelPage
    &_es_..._id=<seccion>&_es_..._actionName=cargaTablaSrv

El problema es que www.idee.es NO manda Access-Control-Allow-Origin (medido con
`curl -D -`, en el portal, en su WMS y en la raíz: ninguna ruta la manda). Sin
esa cabecera un navegador no puede leer la respuesta desde una página nuestra:
el fetch falla con "Failed to fetch", y con `mode: 'no-cors'` la petición llega
pero la respuesta sale opaca (`type=opaque`), que tampoco se puede leer. Por
eso el plugin no puede pedir las secciones al vuelo.

Este script las pide AQUÍ, de servidor a servidor, que no tiene CORS, y guarda
el resultado en `datos/<seccion>.js`.

¿Por qué `.js` y no `.json`? Porque el plugin lo carga con una etiqueta
`<script>`, y una `<script>` SÍ se puede cargar desde `file://` (abrir el
visualizador directamente del disco, sin servidor), mientras que un `fetch` de
un JSON local está bloqueado por el navegador en ese mismo caso. Así el
catálogo funciona igual en `http://` que en `file://`.

El fichero generado tiene esta forma:

    window.CatalogoIDEE_Datos = window.CatalogoIDEE_Datos || {};
    window.CatalogoIDEE_Datos['wms_est'] = {"datos":{...}};

Para refrescar el catálogo:

    python ext/catalogo/generar_catalogo_idee.py          # las diez secciones
    python ext/catalogo/generar_catalogo_idee.py wmts     # solo una

Ojo: el catálogo cambia, así que conviene reejecutar el script de vez en cuando
y commitear el resultado. Y ojo también con el tamaño: las diez secciones pesan
algo más de 1 MB, y por eso el plugin carga solo la que se está mirando.

Uso: python generar_catalogo_idee.py [idSeccion ...]
"""

import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# Los tipos de servicio del catálogo, con las secciones del portal que los
# componen. Es la misma lista que SECCIONES en catalogo_idee.js: si se toca una,
# se tocan las dos.
#
#  Ojo con el WMS: en el portal está partido en CUATRO tablas (estatal,
#  autonómicos, locales y planos verticales), pero aquí se fusionan en una sola.
#  Todos los tipos tienen el mismo esquema: una sección por tipo de servicio.
TIPOS = [
    ('wms', 'WMS', ['supVisWmsEst', 'supVisWmsAut', 'supVisWmsLoc', 'supVisWmsPV']),
    ('wmts', 'WMTS', ['sup-vis-wmts']),
    ('xyz', 'XYZ · Raster Tile Service', ['sup-vis-rts']),
    ('mvt', 'Vector Tiles (MVT)', ['sup-vis-vts']),
    ('wfs', 'WFS', ['sup-des-wfs']),
    ('wcs', 'WCS', ['sup-des-wcs']),
    ('ogcapi', 'OGC API', ['sup-ogc-api']),
]

# Token de instancia del portal. Es público (lo trae el propio portal en su HTML)
# y no es un secreto; si el portal lo cambiara, solo hay que tocar esto.
INSTANCE_TOKEN = 'YZFuNrhnVi4f'

BASE_CATALOGO = 'https://www.idee.es/web/idee/segun-tipo-de-servicio'

# Dónde se guardan los JSON, relativo a este script.
DATOS = Path(__file__).resolve().parent / 'datos'

# Cabeceras mínimas: sin esto el portal a veces responde con una página de
# error en vez del JSON.
CABECERAS = {
    'User-Agent': 'Mozilla/5.0 (generador de catalogo local)',
    'Accept': 'application/json',
}


def url_seccion(id_portal):
    """URL de la tabla de servicios de una sección del portal."""
    p = 'es_igncnig_dirserv72_DirectorioServiciosPortlet_INSTANCE_' + INSTANCE_TOKEN
    return (
        BASE_CATALOGO
        + '?p_p_id=' + p
        + '&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view'
        + '&p_p_cacheability=cacheLevelPage'
        + '&_' + p + '_id=' + id_portal
        + '&_' + p + '_actionName=cargaTablaSrv'
    )


def pedir(id_portal):
    """Pide una sección al portal y devuelve el JSON ya parseado."""
    req = urllib.request.Request(url_seccion(id_portal), headers=CABECERAS)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))


def contar_servicios(datos):
    """Cuántos servicios tiene la sección, con la misma cuenta que hace el plugin.

    El portal agrupa por ámbito (est/aut/loc/pve) y en una sección concreta
    solo viene uno, pero se concatenan todos los que vengan.
    """
    total = 0
    for clave in ('est', 'aut', 'loc', 'pve'):
        familias = (datos or {}).get('datos', {}).get(clave) or []
        for familia in familias:
            grupos = familia.get('listorg') or (
                familia.get('listserv') if familia.get('listserv') else []
            )
            for grupo in grupos:
                if grupo.get('listserv'):
                    total += len(grupo['listserv'])
                elif grupo.get('capa') or grupo.get('url'):
                    total += 1
    return total


def fusionar(respuestas):
    """Fusiona varias respuestas del portal en una, por ámbito.

    El portal sirve el WMS en cuatro tablas (estatal, autonómicos, locales y
    planos verticales) y cada una trae solo su clave. Aquí se concatenan las
    cuatro, que es exactamente lo que hace el parser del plugin con las claves
    est/aut/loc/pve.
    """
    datos = {'est': [], 'aut': [], 'loc': [], 'pve': []}
    for respuesta in respuestas:
        crudo = (respuesta or {}).get('datos') or {}
        for clave in datos:
            datos[clave].extend(crudo.get(clave) or [])
    return {'datos': datos}


def generar(ids):
    """Genera (o regenera) los ficheros .js de los tipos de servicio pedidos."""
    DATOS.mkdir(parents=True, exist_ok=True)

    if not ids:
        ids = [id_plugin for id_plugin, _, _ in TIPOS]

    # Se buscan por el id del plugin (wms, wmts, ...), que es el que usa el JS.
    por_id = {id_plugin: (nombre, secciones) for id_plugin, nombre, secciones in TIPOS}

    fallidas = []
    total_kb = 0.0
    total_servicios = 0

    for id_plugin in ids:
        nombre, secciones_portal = por_id.get(id_plugin, (None, None))
        if not secciones_portal:
            print('  tipo desconocido: ' + id_plugin)
            fallidas.append(id_plugin)
            continue

        try:
            # Un tipo puede estar partido en varias tablas del portal: se piden
            # todas y se fusionan en una sola sección.
            respuestas = [pedir(id_portal) for id_portal in secciones_portal]
            datos = fusionar(respuestas) if len(respuestas) > 1 else respuestas[0]
        except (urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError) as e:
            print('  ' + id_plugin.ljust(8) + ' ERROR  ' + str(e)[:90])
            fallidas.append(id_plugin)
            continue

        # Se guarda como JS, no como JSON: el plugin lo carga con una etiqueta
        # <script>, que sí funciona en file:// (ver el comentario de arriba). El
        # contenido es el JSON tal cual, así que el parser del plugin no cambia.
        ruta = DATOS / (id_plugin + '.js')
        ruta.write_text(
            'window.CatalogoIDEE_Datos = window.CatalogoIDEE_Datos || {};\n'
            + 'window.CatalogoIDEE_Datos[' + json.dumps(id_plugin) + '] = '
            + json.dumps(datos, ensure_ascii=False, separators=(',', ':'))
            + ';\n',
            encoding='utf-8',
        )

        kb = ruta.stat().st_size / 1024.0
        servicios = contar_servicios(datos)
        total_kb += kb
        total_servicios += servicios
        print('  ' + id_plugin.ljust(8) + ' ' + format(kb, '7.1f') + ' KB'
              + '  ' + str(servicios).rjust(4) + ' servicios')

        # Un respiro entre peticiones: el portal no es nuestro y no hay por qué
        # ametrallarlo.
        time.sleep(0.4)

    print('')
    print('  ' + str(len(ids) - len(fallidas)) + '/' + str(len(ids))
          + ' tipos de servicio, ' + format(total_kb, '.1f') + ' KB'
          + ' y ' + str(total_servicios) + ' servicios en ' + str(DATOS))
    if fallidas:
        print('  fallidas: ' + ', '.join(fallidas))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(generar(sys.argv[1:]))
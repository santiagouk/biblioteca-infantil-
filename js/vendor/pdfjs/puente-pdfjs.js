/* ============================================================================
   PUENTE PARA PDF.JS (MÓDULO ES -> VARIABLE GLOBAL)
   ============================================================================
   Desde la versión 4.x, PDF.js solo se distribuye como módulo ES (.mjs),
   ya no como script clásico con variable global "pdfjsLib". Este archivo
   se carga con type="module" en libro.html, importa la librería, y la
   expone en window.pdfjsLib para que el resto del código (libro.js),
   escrito como script clásico, pueda seguir usándola sin cambios.

   Los archivos .mjs están guardados localmente en esta misma carpeta
   (en vez de cargarse desde un CDN externo) para evitar que bloqueadores
   de anuncios o configuraciones de red los bloqueen.
   ========================================================================= */

import * as pdfjsLib from './pdf.min.mjs'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.mjs', import.meta.url).href

window.pdfjsLib = pdfjsLib
window.dispatchEvent(new Event('pdfjs-listo'))

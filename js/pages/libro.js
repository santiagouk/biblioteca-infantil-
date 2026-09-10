/* ============================================================================
   LÓGICA DE LA PÁGINA: libro.html
   ========================================================================= */

// PDF.js se carga como módulo ES vía js/vendor/pdfjs/puente-pdfjs.js, que
// expone la librería en window.pdfjsLib y configura su worker. Como esa
// carga es asíncrona, esperamos el evento "pdfjs-listo" antes de usarla
// (o seguimos de inmediato si por algún motivo ya estaba lista).
const pdfjsListo = window.pdfjsLib
  ? Promise.resolve()
  : new Promise((resolve) => window.addEventListener('pdfjs-listo', resolve, { once: true }))

let perfilUsuarioActual = null
let libroActual = null
let documentoPdf = null
let paginaActual = 1
let escalaActual = 1.2
let esFavoritoActual = false
let leGustaActual = false
let seccionActividadMostrada = false
let otrosLibrosParaQuiz = []
let preguntasQuizActual = []
let indicePreguntaActual = 0
let puntajeQuizActual = 0

/**
 * Extrae un color dominante aproximado de una imagen, muestreando sus
 * píxeles con un <canvas> oculto. Funciona con imágenes de Supabase
 * Storage (mismo origen o con CORS habilitado por defecto en buckets
 * públicos); si la imagen falla por CORS o no carga, se usa un color de
 * respaldo para no romper la página.
 *
 * Devuelve una promesa que resuelve con un string "rgb(r, g, b)".
 */
function extraerColorDominante(urlImagen) {
  return new Promise((resolve) => {
    const COLOR_RESPALDO = 'rgb(124, 58, 237)' // violeta, igual a --violeta

    if (!urlImagen) {
      resolve(COLOR_RESPALDO)
      return
    }

    const imagen = new Image()
    imagen.crossOrigin = 'anonymous'

    imagen.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        // Reducimos la imagen a una miniatura pequeña: es más rápido de
        // procesar y el promedio de color sale igual de representativo.
        const ANCHO_MUESTRA = 40
        const alto = Math.max(1, Math.round((imagen.height / imagen.width) * ANCHO_MUESTRA) || ANCHO_MUESTRA)
        canvas.width = ANCHO_MUESTRA
        canvas.height = alto

        const contexto = canvas.getContext('2d')
        contexto.drawImage(imagen, 0, 0, ANCHO_MUESTRA, alto)

        const { data } = contexto.getImageData(0, 0, ANCHO_MUESTRA, alto)

        let totalR = 0
        let totalG = 0
        let totalB = 0
        let pixeles = 0

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          // Descarta píxeles casi blancos o casi negros (suelen ser
          // bordes/fondos de portada, no el color "de identidad" del libro)
          const brillo = (r + g + b) / 3
          if (brillo < 18 || brillo > 240) continue

          totalR += r
          totalG += g
          totalB += b
          pixeles++
        }

        if (pixeles === 0) {
          resolve(COLOR_RESPALDO)
          return
        }

        const promedioR = Math.round(totalR / pixeles)
        const promedioG = Math.round(totalG / pixeles)
        const promedioB = Math.round(totalB / pixeles)
        resolve(`rgb(${promedioR}, ${promedioG}, ${promedioB})`)
      } catch (error) {
        // getImageData puede lanzar un error de seguridad si la imagen es
        // de otro origen sin CORS habilitado. En ese caso, usamos el color
        // de respaldo en vez de romper la carga de la página.
        console.warn('No se pudo extraer el color de la portada:', error.message)
        resolve(COLOR_RESPALDO)
      }
    }

    imagen.onerror = () => resolve(COLOR_RESPALDO)
    imagen.src = urlImagen
  })
}

/**
 * Aplica el color extraído al fondo dinámico de la página, vía variable CSS.
 */
function aplicarColorDeFondo(colorRgb) {
  document.getElementById('fondo-color-libro').style.setProperty('--color-libro', colorRgb)
}

/**
 * Obtiene el id del libro desde el parámetro ?id= de la URL.
 */
function obtenerIdLibroDeUrl() {
  const parametros = new URLSearchParams(window.location.search)
  return parametros.get('id')
}

/**
 * Pinta la información básica del libro en la columna izquierda.
 */
function renderizarInfoLibro(libro) {
  document.getElementById('img-portada').src = libro.portada_url || 'images/portada-default.svg'
  document.getElementById('titulo-libro').textContent = libro.titulo
  document.getElementById('autor-libro').textContent = `por ${libro.autor}`
  document.getElementById('descripcion-libro').textContent = libro.descripcion || libro.sinopsis || ''
  document.getElementById('edad-libro').textContent = `Edad recomendada: ${etiquetaEdad(libro.edad_recomendada)}`
  document.getElementById('tipo-libro').innerHTML =
    `<i class="bi bi-file-earmark-pdf"></i> Formato: PDF${libro.numero_paginas ? ` · ${libro.numero_paginas} páginas` : ''}`

  const badge = document.getElementById('badge-categoria')
  badge.textContent = libro.categories?.nombre || 'Sin categoría'
  badge.style.backgroundColor = libro.categories?.color || '#6366f1'
  badge.classList.add('text-white')

  const badgeVip = document.getElementById('badge-vip-libro')
  if (libro.es_vip) {
    badgeVip.innerHTML = `<i class="bi bi-gem"></i> Libro VIP · ${libro.costo_creditos} créditos`
    badgeVip.classList.remove('d-none')
  }
}

/* ----------------------------------------------------------------------------
   LIBROS VIP: candado y canje de créditos
   ---------------------------------------------------------------------------- */

/**
 * Muestra el panel de "candado VIP" en lugar del lector de PDF, con el
 * costo del libro y el saldo actual del usuario, y conecta el botón de
 * canje. No bloquea el resto de la inicialización de la página (comentarios,
 * "me gusta", etc. siguen cargando en paralelo); si el canje tiene éxito,
 * es esta misma función la que revela el lector y carga el PDF.
 */
function activarCandadoVip(libro, perfil, paginaInicial) {
  document.getElementById('tarjeta-lector-pdf').classList.add('d-none')
  const candado = document.getElementById('tarjeta-candado-vip')
  candado.classList.remove('d-none')

  document.getElementById('candado-costo-creditos').textContent = libro.costo_creditos
  document.getElementById('candado-saldo-creditos').textContent = perfil.creditos ?? 0

  const alerta = document.getElementById('candado-alerta')
  const boton = document.getElementById('btn-canjear-vip')

  boton.addEventListener('click', async () => {
    boton.disabled = true
    boton.textContent = 'Canjeando...'

    const resultado = await canjearLibroVip(libro.id)

    boton.disabled = false
    boton.innerHTML = '<i class="bi bi-unlock"></i> Canjear con mis créditos'

    alerta.className = `alert small mx-auto ${resultado.exito ? 'alert-success' : 'alert-danger'}`
    alerta.style.maxWidth = '420px'
    alerta.textContent = resultado.mensaje
    alerta.classList.remove('d-none')

    if (resultado.creditos_restantes !== null) {
      document.getElementById('candado-saldo-creditos').textContent = resultado.creditos_restantes
    }

    if (resultado.exito) {
      candado.classList.add('d-none')
      document.getElementById('tarjeta-lector-pdf').classList.remove('d-none')
      await cargarDocumentoPdf(libro.archivo_pdf_url, paginaInicial)
    }
  })
}

/**
 * Carga el documento PDF con PDF.js y renderiza la primera página
 * (o la última página leída, si el usuario ya tenía progreso).
 */
async function cargarDocumentoPdf(urlPdf, paginaInicial) {
  documentoPdf = await pdfjsLib.getDocument(urlPdf).promise
  document.getElementById('texto-total-paginas').textContent = documentoPdf.numPages

  paginaActual = Math.min(Math.max(paginaInicial, 1), documentoPdf.numPages)
  await renderizarPaginaPdf(paginaActual)
}

/**
 * Dibuja una página específica del PDF en el <canvas>.
 */
async function renderizarPaginaPdf(numeroPagina) {
  const pagina = await documentoPdf.getPage(numeroPagina)
  const viewport = pagina.getViewport({ scale: escalaActual })

  const canvas = document.getElementById('canvas-pdf')
  const contexto = canvas.getContext('2d')
  canvas.width = viewport.width
  canvas.height = viewport.height

  await pagina.render({ canvasContext: contexto, viewport }).promise

  document.getElementById('texto-pagina-actual').textContent = numeroPagina
  paginaActual = numeroPagina

  // Guarda el progreso de lectura cada vez que cambia de página
  if (perfilUsuarioActual) {
    const porcentaje = Math.round((numeroPagina / documentoPdf.numPages) * 100)
    const completado = numeroPagina === documentoPdf.numPages
    await guardarProgresoLectura(perfilUsuarioActual.id, libroActual.id, numeroPagina, porcentaje, completado)
    actualizarBarraProgreso(porcentaje)

    // Al llegar a la última página, revela la actividad "¿Cuánto aprendiste?"
    if (completado && !seccionActividadMostrada) {
      seccionActividadMostrada = true
      mostrarSeccionActividad()
    }
  }
}

/* ============================================================================
   PANTALLA COMPLETA DEL LECTOR
   ========================================================================= */

function elementoEnPantallaCompleta() {
  return document.fullscreenElement || document.webkitFullscreenElement || null
}

function actualizarIconoPantallaCompleta() {
  const icono = document.getElementById('icono-pantalla-completa')
  if (!icono) return
  const tarjeta = document.getElementById('tarjeta-lector-pdf')
  const activo = elementoEnPantallaCompleta() === tarjeta
  icono.className = activo ? 'bi bi-fullscreen-exit' : 'bi bi-fullscreen'
}

/**
 * Activa/desactiva la pantalla completa sobre la tarjeta del lector (deja
 * visibles los controles de navegación/zoom, pero oculta el resto de la
 * página para una lectura más inmersiva). Si el navegador no soporta la
 * API de pantalla completa (p. ej. algunos navegadores móviles), no hace
 * nada en vez de romper la página.
 */
function alternarPantallaCompleta() {
  const tarjeta = document.getElementById('tarjeta-lector-pdf')
  if (!tarjeta) return

  if (!elementoEnPantallaCompleta()) {
    const solicitar = tarjeta.requestFullscreen || tarjeta.webkitRequestFullscreen
    if (solicitar) {
      solicitar.call(tarjeta).catch(() => {})
    }
  } else {
    const salir = document.exitFullscreen || document.webkitExitFullscreen
    if (salir) salir.call(document)
  }
}

document.addEventListener('fullscreenchange', actualizarIconoPantallaCompleta)
document.addEventListener('webkitfullscreenchange', actualizarIconoPantallaCompleta)

function actualizarBarraProgreso(porcentaje) {
  document.getElementById('seccion-progreso').classList.remove('d-none')
  document.getElementById('texto-progreso').textContent = `${porcentaje}%`
  document.getElementById('barra-progreso').style.width = `${porcentaje}%`
}

/**
 * Actualiza el botón de favorito según el estado actual.
 */
function actualizarBotonFavorito() {
  const boton = document.getElementById('btn-favorito')
  const icono = document.getElementById('icono-favorito')
  const texto = document.getElementById('texto-favorito')

  icono.className = esFavoritoActual ? 'bi bi-heart-fill' : 'bi bi-heart'
  texto.textContent = esFavoritoActual ? 'En tus favoritos' : 'Agregar a favoritos'
  boton.classList.toggle('btn-primary', esFavoritoActual)
  boton.classList.toggle('btn-outline-primary', !esFavoritoActual)
}

/**
 * Pinta la lista de marcadores guardados.
 */
function renderizarMarcadores(marcadores) {
  const lista = document.getElementById('lista-marcadores')

  if (marcadores.length === 0) {
    lista.innerHTML = '<li class="list-group-item text-muted">Aún no tienes marcadores.</li>'
    return
  }

  lista.innerHTML = marcadores
    .map(
      (marcador) => `
      <li class="list-group-item d-flex justify-content-between align-items-center px-0">
        <span class="cursor-pointer" data-pagina="${marcador.pagina}">
          <i class="bi bi-bookmark-fill"></i> Página ${marcador.pagina}
        </span>
        <button class="btn btn-sm btn-link text-danger p-0" data-eliminar="${marcador.id}">
          Quitar
        </button>
      </li>
    `
    )
    .join('')

  // Ir a la página al hacer clic en el marcador
  lista.querySelectorAll('[data-pagina]').forEach((elemento) => {
    elemento.addEventListener('click', () => {
      renderizarPaginaPdf(parseInt(elemento.dataset.pagina, 10))
    })
  })

  // Eliminar marcador
  lista.querySelectorAll('[data-eliminar]').forEach((boton) => {
    boton.addEventListener('click', async () => {
      await eliminarMarcador(boton.dataset.eliminar)
      const marcadoresActualizados = await obtenerMarcadores(perfilUsuarioActual.id, libroActual.id)
      renderizarMarcadores(marcadoresActualizados)
    })
  })
}

/* ============================================================================
   "¿QUÉ TE PARECIÓ ESTE LIBRO?" — ME GUSTA Y COMENTARIOS
   ========================================================================= */

function escaparHtml(texto) {
  const div = document.createElement('div')
  div.textContent = texto ?? ''
  return div.innerHTML
}

function formatearFechaComentario(fechaIso) {
  try {
    return new Date(fechaIso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

function actualizarBotonLike() {
  const boton = document.getElementById('btn-like')
  const icono = document.getElementById('icono-like')
  const texto = document.getElementById('texto-like')

  icono.className = leGustaActual ? 'bi bi-hand-thumbs-up-fill' : 'bi bi-hand-thumbs-up'
  texto.textContent = leGustaActual ? '¡Te gusta! ' : 'Me gusta'
  boton.classList.toggle('btn-primary', leGustaActual)
  boton.classList.toggle('btn-outline-primary', !leGustaActual)
}

async function actualizarContadorLikes() {
  const total = await obtenerTotalLikes(libroActual.id)
  const texto =
    total === 0
      ? 'Sé el primero en decir que te gusta este libro'
      : total === 1
      ? '1 lector dijo que le gusta'
      : `${total} lectores dijeron que les gusta`
  document.getElementById('contador-likes').textContent = texto
}

function crearElementoComentario(comentario) {
  const esPropio = perfilUsuarioActual && comentario.usuario_id === perfilUsuarioActual.id
  const esAdmin = perfilUsuarioActual && perfilUsuarioActual.rol === 'admin'
  const puedeEliminar = esPropio || esAdmin

  return `
    <div class="comentario-item p-3" data-id="${comentario.id}">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <strong>${escaparHtml(comentario.nombre_mostrado)}</strong>
        <div class="d-flex align-items-center gap-2">
          <span class="small text-muted">${formatearFechaComentario(comentario.creado_en)}</span>
          ${
            puedeEliminar
              ? `<button type="button" class="btn-eliminar-comentario" data-id="${comentario.id}"
                   aria-label="Eliminar comentario" title="Eliminar comentario">
                   <i class="bi bi-trash3"></i>
                 </button>`
              : ''
          }
        </div>
      </div>
      <p class="mb-0 mt-1">${escaparHtml(comentario.comentario)}</p>
    </div>
  `
}

/**
 * Maneja el clic en el botón de eliminar de un comentario con confirmación
 * de dos pasos (sin modal): el primer clic arma el botón mostrando
 * "¿Eliminar?", y solo un segundo clic dentro de los siguientes segundos
 * borra de verdad. Así se evita un borrado accidental sin necesitar un
 * diálogo emergente adicional.
 */
async function manejarClicEliminarComentario(boton) {
  if (boton.dataset.confirmando !== 'true') {
    boton.dataset.confirmando = 'true'
    boton.classList.add('confirmando')
    boton.innerHTML = '<i class="bi bi-check-lg"></i> ¿Eliminar?'

    boton.temporizadorConfirmacion = setTimeout(() => {
      if (boton.isConnected) {
        boton.dataset.confirmando = 'false'
        boton.classList.remove('confirmando')
        boton.innerHTML = '<i class="bi bi-trash3"></i>'
      }
    }, 3000)
    return
  }

  clearTimeout(boton.temporizadorConfirmacion)
  boton.disabled = true
  boton.innerHTML = '<span class="spinner-border spinner-border-sm"></span>'

  const { error } = await eliminarComentario(boton.dataset.id)

  if (error) {
    boton.disabled = false
    boton.dataset.confirmando = 'false'
    boton.classList.remove('confirmando')
    boton.innerHTML = '<i class="bi bi-trash3"></i>'
    return
  }

  await cargarComentarios()
}

async function cargarComentarios() {
  const comentarios = await obtenerComentariosLibro(libroActual.id)
  const lista = document.getElementById('lista-comentarios')
  const mensajeVacio = document.getElementById('mensaje-sin-comentarios')

  if (comentarios.length === 0) {
    lista.innerHTML = ''
    mensajeVacio.classList.remove('d-none')
    return
  }

  mensajeVacio.classList.add('d-none')
  lista.innerHTML = comentarios.map(crearElementoComentario).join('')
}

/* ============================================================================
   "¿CUÁNTO APRENDISTE?" — ACTIVIDAD AL TERMINAR DE LEER
   ========================================================================= */

function elegirAlAzar(lista, cantidad) {
  const copia = [...lista]
  const elegidos = []
  while (copia.length > 0 && elegidos.length < cantidad) {
    const indice = Math.floor(Math.random() * copia.length)
    elegidos.push(copia.splice(indice, 1)[0])
  }
  return elegidos
}

function mezclar(lista) {
  return elegirAlAzar(lista, lista.length)
}

const OPCIONES_EDAD_QUIZ = ['3-5', '6-8', '9-12', '13+']
const CANTIDAD_PREGUNTAS_QUIZ = 5

function truncarTexto(texto, maximo = 90) {
  if (!texto) return ''
  const limpio = texto.trim()
  return limpio.length > maximo ? `${limpio.slice(0, maximo).trim()}…` : limpio
}

/**
 * Banco de posibles preguntas sobre el libro que se acaba de leer. Cada
 * plantilla es una función que devuelve la pregunta armada, o null si no
 * hay datos suficientes para plantearla (por ejemplo, si el libro no tiene
 * año de publicación cargado, o el catálogo no tiene otros libros para
 * usar como opción incorrecta). Se genera un banco más grande de lo que
 * realmente se muestra, y en cada partida se sortean solo algunas —
 * así nunca se repite el mismo set de preguntas dos veces seguidas.
 */
function construirBancoPreguntasQuiz(libro, otrosLibros) {
  const nombreCategoria = libro.categories?.nombre || 'Sin categoría'
  const otrosTitulos = [...new Set(otrosLibros.map((l) => l.titulo).filter((t) => t && t !== libro.titulo))]
  const otrosAutores = [...new Set(otrosLibros.map((l) => l.autor).filter((a) => a && a !== libro.autor))]
  const otrasCategorias = [
    ...new Set(otrosLibros.map((l) => l.categories?.nombre).filter((c) => c && c !== nombreCategoria)),
  ]

  const banco = [
    // --- Título ---
    () => {
      const distractores = elegirAlAzar(otrosTitulos, Math.min(2, otrosTitulos.length))
      if (distractores.length === 0) return null
      return {
        pregunta: '📖 ¿Cuál es el título del cuento que acabas de leer?',
        opciones: mezclar([
          { texto: libro.titulo, correcta: true },
          ...distractores.map((t) => ({ texto: t, correcta: false })),
        ]),
      }
    },
    () => {
      if (otrosTitulos.length === 0) return null
      const distractorCorrecto = elegirAlAzar(otrosTitulos, 1)[0]
      const otroDistractor = elegirAlAzar(otrosTitulos.filter((t) => t !== distractorCorrecto), 1)
      return {
        pregunta: `🔍 ¿Cuál de estos títulos NO es el del cuento que acabas de leer?`,
        opciones: mezclar([
          { texto: distractorCorrecto, correcta: true },
          { texto: libro.titulo, correcta: false },
          ...otroDistractor.map((t) => ({ texto: t, correcta: false })),
        ]),
      }
    },

    // --- Autor ---
    () => {
      const distractores = elegirAlAzar(otrosAutores, Math.min(2, otrosAutores.length))
      if (distractores.length === 0) return null
      return {
        pregunta: `✍️ ¿Quién escribió "${libro.titulo}"?`,
        opciones: mezclar([
          { texto: libro.autor, correcta: true },
          ...distractores.map((a) => ({ texto: a, correcta: false })),
        ]),
      }
    },
    () => {
      if (otrosAutores.length === 0) return null
      const usarAutorReal = Math.random() < 0.5
      const autorMostrado = usarAutorReal ? libro.autor : elegirAlAzar(otrosAutores, 1)[0]
      return {
        pregunta: `🤔 Verdadero o falso: "${libro.titulo}" fue escrito por ${autorMostrado}.`,
        opciones: [
          { texto: 'Verdadero', correcta: usarAutorReal },
          { texto: 'Falso', correcta: !usarAutorReal },
        ],
      }
    },

    // --- Categoría ---
    () => {
      const distractores = elegirAlAzar(otrasCategorias, Math.min(2, otrasCategorias.length))
      if (distractores.length === 0) return null
      return {
        pregunta: `🏷️ ¿A qué categoría pertenece "${libro.titulo}"?`,
        opciones: mezclar([
          { texto: nombreCategoria, correcta: true },
          ...distractores.map((c) => ({ texto: c, correcta: false })),
        ]),
      }
    },
    () => {
      if (otrasCategorias.length === 0) return null
      const usarCategoriaReal = Math.random() < 0.5
      const categoriaMostrada = usarCategoriaReal ? nombreCategoria : elegirAlAzar(otrasCategorias, 1)[0]
      return {
        pregunta: `🤔 Verdadero o falso: "${libro.titulo}" pertenece a la categoría "${categoriaMostrada}".`,
        opciones: [
          { texto: 'Verdadero', correcta: usarCategoriaReal },
          { texto: 'Falso', correcta: !usarCategoriaReal },
        ],
      }
    },

    // --- Edad recomendada ---
    () => ({
      pregunta: '🎂 ¿Para qué edad se recomienda este cuento?',
      opciones: mezclar(
        OPCIONES_EDAD_QUIZ.map((valor) => ({
          texto: etiquetaEdad(valor),
          correcta: valor === libro.edad_recomendada,
        }))
      ),
    }),

    // --- Año de publicación (solo si el libro lo tiene registrado) ---
    () => {
      if (!libro.anio_publicacion_original) return null
      const anioReal = libro.anio_publicacion_original
      const otrosAnios = otrosLibros
        .map((l) => l.anio_publicacion_original)
        .filter((a) => a && a !== anioReal)
      const distractores = new Set(elegirAlAzar(otrosAnios, Math.min(2, otrosAnios.length)))
      while (distractores.size < 2) {
        const variacion = Math.floor(Math.random() * 15) + 3
        const candidato = anioReal + (Math.random() < 0.5 ? -variacion : variacion)
        if (candidato !== anioReal) distractores.add(candidato)
      }
      return {
        pregunta: `📅 ¿En qué año se publicó originalmente "${libro.titulo}"?`,
        opciones: mezclar([
          { texto: String(anioReal), correcta: true },
          ...[...distractores].map((a) => ({ texto: String(a), correcta: false })),
        ]),
      }
    },

    // --- Número de páginas (solo si el libro lo tiene registrado) ---
    () => {
      if (!libro.numero_paginas) return null
      const paginasReales = libro.numero_paginas
      const distractores = new Set()
      while (distractores.size < 2) {
        const variacion = Math.floor(Math.random() * 8) + 4
        const candidato = Math.max(1, paginasReales + (Math.random() < 0.5 ? -variacion : variacion))
        if (candidato !== paginasReales) distractores.add(candidato)
      }
      return {
        pregunta: `📄 ¿Cuántas páginas tiene aproximadamente "${libro.titulo}"?`,
        opciones: mezclar([
          { texto: `${paginasReales} páginas`, correcta: true },
          ...[...distractores].map((p) => ({ texto: `${p} páginas`, correcta: false })),
        ]),
      }
    },

    // --- Sinopsis (solo si el libro y al menos otros 2 tienen una registrada) ---
    () => {
      const sinopsisLibro = libro.sinopsis || libro.descripcion
      if (!sinopsisLibro) return null
      const otrasSinopsis = otrosLibros
        .map((l) => l.sinopsis || l.descripcion)
        .filter(Boolean)
      const distractores = elegirAlAzar(otrasSinopsis, Math.min(2, otrasSinopsis.length))
      if (distractores.length < 2) return null
      return {
        pregunta: `📝 ¿Cuál de estos resúmenes corresponde a "${libro.titulo}"?`,
        opciones: mezclar([
          { texto: truncarTexto(sinopsisLibro), correcta: true },
          ...distractores.map((s) => ({ texto: truncarTexto(s), correcta: false })),
        ]),
      }
    },
  ]

  return banco
}

/**
 * Arma la partida: construye el banco de posibles preguntas para este
 * libro y sortea CANTIDAD_PREGUNTAS_QUIZ de las que sí se pudieron
 * generar (algunas plantillas se descartan solas si falta un dato). El
 * banco tiene más plantillas de las que se muestran a la vez, así que
 * jugar varias veces con el mismo libro no siempre trae las mismas
 * preguntas ni en el mismo orden.
 */
function generarPreguntasQuiz(libro, otrosLibros) {
  const banco = construirBancoPreguntasQuiz(libro, otrosLibros)
  const generadas = mezclar(banco)
    .map((plantilla) => plantilla())
    .filter((pregunta) => pregunta && pregunta.opciones.length >= 2)

  return generadas.slice(0, CANTIDAD_PREGUNTAS_QUIZ)
}

function mostrarSeccionActividad() {
  document.getElementById('quiz-titulo-libro').textContent = `"${libroActual.titulo}"`
  document.getElementById('seccion-actividad').classList.remove('d-none')
}

async function iniciarQuiz() {
  if (otrosLibrosParaQuiz.length === 0) {
    otrosLibrosParaQuiz = await obtenerLibrosParaDistractores(libroActual.id)
  }

  preguntasQuizActual = generarPreguntasQuiz(libroActual, otrosLibrosParaQuiz)
  indicePreguntaActual = 0
  puntajeQuizActual = 0

  document.getElementById('quiz-intro').classList.add('d-none')
  document.getElementById('quiz-resultado').classList.add('d-none')

  if (preguntasQuizActual.length === 0) {
    // Catálogo demasiado pequeño para armar opciones incorrectas: no
    // rompemos la página, simplemente avisamos con cariño.
    document.getElementById('quiz-intro').classList.remove('d-none')
    document.getElementById('quiz-intro').insertAdjacentHTML(
      'beforeend',
      '<p class="small text-muted mt-2">Todavía no hay suficientes libros en la biblioteca para armar el juego. ¡Vuelve pronto!</p>'
    )
    return
  }

  document.getElementById('quiz-juego').classList.remove('d-none')
  mostrarPreguntaQuiz()
}

function mostrarPreguntaQuiz() {
  const pregunta = preguntasQuizActual[indicePreguntaActual]

  document.getElementById('quiz-progreso').textContent =
    `Pregunta ${indicePreguntaActual + 1} de ${preguntasQuizActual.length}`
  document.getElementById('quiz-puntos').textContent = `⭐ ${puntajeQuizActual}`
  document.getElementById('quiz-pregunta').textContent = pregunta.pregunta

  const contenedorOpciones = document.getElementById('quiz-opciones')
  const retroalimentacion = document.getElementById('quiz-retroalimentacion')
  const botonSiguiente = document.getElementById('btn-quiz-siguiente')

  retroalimentacion.classList.add('d-none')
  botonSiguiente.classList.add('d-none')

  contenedorOpciones.innerHTML = pregunta.opciones
    .map(
      (opcion, indice) => `
      <button type="button" class="btn btn-outline-secondary text-start opcion-quiz" data-indice="${indice}">
        ${escaparHtml(opcion.texto)}
      </button>
    `
    )
    .join('')

  contenedorOpciones.querySelectorAll('.opcion-quiz').forEach((boton) => {
    boton.addEventListener('click', () => responderPreguntaQuiz(pregunta, boton, contenedorOpciones))
  })
}

function responderPreguntaQuiz(pregunta, botonElegido, contenedorOpciones) {
  const indiceElegido = parseInt(botonElegido.dataset.indice, 10)
  const opcionElegida = pregunta.opciones[indiceElegido]

  contenedorOpciones.querySelectorAll('.opcion-quiz').forEach((boton) => {
    boton.disabled = true
  })

  pregunta.opciones.forEach((opcion, indice) => {
    const boton = contenedorOpciones.querySelector(`[data-indice="${indice}"]`)
    if (opcion.correcta) {
      boton.classList.add('opcion-correcta')
    } else if (indice === indiceElegido) {
      boton.classList.add('opcion-incorrecta')
    }
  })

  const retroalimentacion = document.getElementById('quiz-retroalimentacion')
  retroalimentacion.classList.remove('d-none', 'alert-success', 'alert-danger')
  retroalimentacion.classList.add('alert')

  if (opcionElegida.correcta) {
    puntajeQuizActual++
    retroalimentacion.classList.add('alert-success')
    retroalimentacion.textContent = '🎉 ¡Muy bien! Respuesta correcta.'
  } else {
    retroalimentacion.classList.add('alert-danger')
    retroalimentacion.textContent = '💛 ¡Casi! No te preocupes, sigamos aprendiendo.'
  }

  document.getElementById('quiz-puntos').textContent = `⭐ ${puntajeQuizActual}`
  document.getElementById('btn-quiz-siguiente').classList.remove('d-none')
}

function siguientePreguntaQuiz() {
  indicePreguntaActual++
  if (indicePreguntaActual >= preguntasQuizActual.length) {
    mostrarResultadoQuiz()
  } else {
    mostrarPreguntaQuiz()
  }
}

function mostrarResultadoQuiz() {
  document.getElementById('quiz-juego').classList.add('d-none')
  document.getElementById('quiz-resultado').classList.remove('d-none')

  const total = preguntasQuizActual.length
  document.getElementById('quiz-resultado-estrellas').textContent =
    '⭐'.repeat(puntajeQuizActual) + '☆'.repeat(total - puntajeQuizActual)

  let emoji = '🎉'
  let mensaje = `¡Respondiste ${puntajeQuizActual} de ${total} correctamente!`

  if (puntajeQuizActual === total) {
    emoji = '🏆'
    mensaje = `¡Perfecto! Respondiste las ${total} correctamente.`
  } else if (puntajeQuizActual === 0) {
    emoji = '🌱'
    mensaje = '¡Sigue practicando! La próxima vez lo harás mejor.'
  }

  document.getElementById('quiz-resultado-emoji').textContent = emoji
  document.getElementById('quiz-resultado-texto').textContent = mensaje
}

document.addEventListener('DOMContentLoaded', async () => {
  // Espera a que el módulo de PDF.js termine de cargarse antes de continuar,
  // ya que el resto de esta función depende de window.pdfjsLib.
  await pdfjsListo

  const idLibro = obtenerIdLibroDeUrl()
  const spinner = document.getElementById('spinner-carga')
  const contenido = document.getElementById('contenido-libro')
  const mensajeError = document.getElementById('mensaje-error')

  if (!idLibro) {
    spinner.classList.add('d-none')
    mensajeError.classList.remove('d-none')
    return
  }

  perfilUsuarioActual = await obtenerPerfilActual()
  libroActual = await obtenerLibroPorId(idLibro)

  if (!libroActual) {
    spinner.classList.add('d-none')
    mensajeError.classList.remove('d-none')
    return
  }

  renderizarInfoLibro(libroActual)

  // Tiñe el fondo de la página con el color dominante de la portada del
  // libro (efecto "plataforma de streaming"). No bloquea el resto de la
  // carga: se aplica en cuanto esté listo, en paralelo.
  extraerColorDominante(libroActual.portada_url).then(aplicarColorDeFondo)

  // Progreso de lectura: continuar desde la última página visitada
  let paginaInicial = 1
  if (perfilUsuarioActual) {
    const progreso = await obtenerProgresoLectura(perfilUsuarioActual.id, libroActual.id)
    if (progreso) {
      paginaInicial = progreso.ultima_pagina
      actualizarBarraProgreso(progreso.porcentaje_completado)
    }

    esFavoritoActual = await esFavorito(perfilUsuarioActual.id, libroActual.id)
    actualizarBotonFavorito()

    const marcadores = await obtenerMarcadores(perfilUsuarioActual.id, libroActual.id)
    renderizarMarcadores(marcadores)
  }

  // --- Candado VIP: si el libro requiere créditos y el usuario todavía no
  //     lo desbloqueó, se muestra el panel de canje en vez del lector, sin
  //     bloquear el resto de la carga de la página (comentarios, "me
  //     gusta", etc.). El propio candado carga el PDF si el canje tiene éxito.
  let libroDesbloqueado = true
  if (libroActual.es_vip && perfilUsuarioActual) {
    libroDesbloqueado = await usuarioDesbloqueoLibroVip(perfilUsuarioActual.id, libroActual.id)
  }

  spinner.classList.add('d-none')
  contenido.classList.remove('d-none')

  if (libroDesbloqueado) {
    await cargarDocumentoPdf(libroActual.archivo_pdf_url, paginaInicial)
  } else {
    activarCandadoVip(libroActual, perfilUsuarioActual, paginaInicial)
  }

  // --- Sección "¿Qué te pareció este libro?" (me gusta + comentarios) ---
  document.getElementById('seccion-opinion').classList.remove('d-none')
  if (perfilUsuarioActual) {
    leGustaActual = await usuarioDioLike(perfilUsuarioActual.id, libroActual.id)
    actualizarBotonLike()
  }
  await actualizarContadorLikes()
  await cargarComentarios()

  // --- Eventos de navegación de páginas ---
  document.getElementById('btn-pagina-anterior').addEventListener('click', () => {
    if (paginaActual > 1) renderizarPaginaPdf(paginaActual - 1)
  })
  document.getElementById('btn-pagina-siguiente').addEventListener('click', () => {
    if (paginaActual < documentoPdf.numPages) renderizarPaginaPdf(paginaActual + 1)
  })

  // --- Eventos de zoom ---
  document.getElementById('btn-zoom-mas').addEventListener('click', () => {
    escalaActual = Math.min(escalaActual + 0.2, 3)
    renderizarPaginaPdf(paginaActual)
  })
  document.getElementById('btn-zoom-menos').addEventListener('click', () => {
    escalaActual = Math.max(escalaActual - 0.2, 0.6)
    renderizarPaginaPdf(paginaActual)
  })

  // --- Evento de favorito ---
  document.getElementById('btn-favorito').addEventListener('click', async () => {
    if (!perfilUsuarioActual) return

    if (esFavoritoActual) {
      await quitarFavorito(perfilUsuarioActual.id, libroActual.id)
    } else {
      await agregarFavorito(perfilUsuarioActual.id, libroActual.id)
    }
    esFavoritoActual = !esFavoritoActual
    actualizarBotonFavorito()
  })

  // --- Evento de agregar marcador ---
  document.getElementById('btn-agregar-marcador').addEventListener('click', async () => {
    if (!perfilUsuarioActual) return

    const inputPagina = document.getElementById('input-pagina-marcador')
    const pagina = parseInt(inputPagina.value, 10) || paginaActual

    await crearMarcador(perfilUsuarioActual.id, libroActual.id, pagina)
    inputPagina.value = ''

    const marcadores = await obtenerMarcadores(perfilUsuarioActual.id, libroActual.id)
    renderizarMarcadores(marcadores)
  })

  // --- Evento de pantalla completa ---
  document.getElementById('btn-pantalla-completa').addEventListener('click', alternarPantallaCompleta)

  // --- Evento de "me gusta" ---
  document.getElementById('btn-like').addEventListener('click', async (evento) => {
    if (!perfilUsuarioActual) return

    const boton = evento.currentTarget
    boton.classList.add('animar-like')
    setTimeout(() => boton.classList.remove('animar-like'), 350)

    if (leGustaActual) {
      await quitarLike(perfilUsuarioActual.id, libroActual.id)
    } else {
      await darLike(perfilUsuarioActual.id, libroActual.id)
    }
    leGustaActual = !leGustaActual
    actualizarBotonLike()
    await actualizarContadorLikes()
  })

  // --- Evento de publicar comentario ---
  document.getElementById('form-comentario').addEventListener('submit', async (evento) => {
    evento.preventDefault()
    if (!perfilUsuarioActual) return

    const campoComentario = document.getElementById('input-comentario')
    const errorComentario = document.getElementById('error-comentario')
    const contenido = campoComentario.value.trim()

    if (!contenido) {
      errorComentario.textContent = 'Escribe algo antes de publicar tu comentario.'
      errorComentario.classList.remove('d-none')
      campoComentario.classList.add('campo-con-error')
      setTimeout(() => campoComentario.classList.remove('campo-con-error'), 400)
      return
    }
    errorComentario.classList.add('d-none')

    const botonPublicar = document.getElementById('btn-publicar-comentario')
    botonPublicar.disabled = true

    const nombreMostrado = perfilUsuarioActual.nombre_completo || perfilUsuarioActual.nombre_usuario || 'Un lector'
    const { error } = await publicarComentario(perfilUsuarioActual.id, libroActual.id, nombreMostrado, contenido)

    botonPublicar.disabled = false

    if (error) {
      errorComentario.textContent = 'No pudimos publicar tu comentario. Intenta de nuevo.'
      errorComentario.classList.remove('d-none')
      return
    }

    campoComentario.value = ''
    await cargarComentarios()
  })

  // --- Evento de eliminar comentario (delegado: la lista se re-renderiza) ---
  document.getElementById('lista-comentarios').addEventListener('click', (evento) => {
    const boton = evento.target.closest('.btn-eliminar-comentario')
    if (boton) manejarClicEliminarComentario(boton)
  })

  // --- Eventos de la actividad "¿Cuánto aprendiste?" ---
  document.getElementById('btn-iniciar-quiz').addEventListener('click', iniciarQuiz)
  document.getElementById('btn-quiz-siguiente').addEventListener('click', siguientePreguntaQuiz)
  document.getElementById('btn-quiz-reintentar').addEventListener('click', iniciarQuiz)
})

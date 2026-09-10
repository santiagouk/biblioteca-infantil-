/* ============================================================================
   LÓGICA DE LA PÁGINA: poemas.html (Foro de Poemas)
   ========================================================================= */

let perfilUsuarioActual = null
let poemaActual = null
let leGustaPoemaActual = false
let calificacionUsuarioActual = null
let modalPoema = null
let modalVerPoema = null
let modalReportarPoema = null
let temporizadorBusquedaPoema = null
let botonEliminarPoemaConfirmando = false

function escaparHtml(texto) {
  const div = document.createElement('div')
  div.textContent = texto
  return div.innerHTML
}

function formatearFechaPoema(fechaIso) {
  try {
    return new Date(fechaIso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

function truncarTextoPoema(texto, maximo = 140) {
  if (texto.length <= maximo) return texto
  return texto.slice(0, maximo).trim() + '…'
}

function renderizarEstrellas(promedio) {
  const llenas = Math.round(promedio)
  let html = ''
  for (let i = 1; i <= 5; i++) {
    html += `<i class="bi ${i <= llenas ? 'bi-star-fill' : 'bi-star'}"></i>`
  }
  return html
}

/* ----------------------------------------------------------------------------
   LISTADO Y FILTROS
   ---------------------------------------------------------------------------- */

const COLORES_TARJETA_POEMA = ['#7C3AED', '#00D9C0', '#FF4D6D', '#FFD23F']

function crearTarjetaPoema(poema, indice) {
  const colorBorde = COLORES_TARJETA_POEMA[indice % COLORES_TARJETA_POEMA.length]
  return `
    <div class="col-sm-6 col-lg-4">
      <div class="card tarjeta-poema h-100 p-3" style="--color-tarjeta:${colorBorde};" data-id="${poema.id}">
        <h3 class="h6 mb-1">${escaparHtml(poema.titulo)}</h3>
        <p class="small nombre-autor-poema mb-2">por ${escaparHtml(poema.nombre_autor)}</p>
        <p class="small extracto-poema mb-3">${escaparHtml(truncarTextoPoema(poema.contenido))}</p>
        <div class="d-flex justify-content-between align-items-center mt-auto small text-muted">
          <span class="estrellas-solo-lectura">${renderizarEstrellas(poema.promedio_estrellas)}</span>
          <span><i class="bi bi-hand-thumbs-up-fill"></i> ${poema.total_likes}</span>
        </div>
      </div>
    </div>
  `
}

async function cargarPoemas() {
  const spinner = document.getElementById('spinner-carga')
  const contenedor = document.getElementById('contenedor-poemas')
  const mensajeVacio = document.getElementById('mensaje-sin-poemas')

  spinner.classList.remove('d-none')
  mensajeVacio.classList.add('d-none')

  const busqueda = document.getElementById('filtro-busqueda-poema').value.trim()
  const orden = document.getElementById('filtro-orden-poema').value
  const poemas = await obtenerPoemas({ busqueda, orden })

  spinner.classList.add('d-none')

  if (poemas.length === 0) {
    contenedor.innerHTML = ''
    mensajeVacio.classList.remove('d-none')
    return
  }

  contenedor.innerHTML = poemas.map(crearTarjetaPoema).join('')

  contenedor.querySelectorAll('.tarjeta-poema').forEach((tarjeta) => {
    tarjeta.addEventListener('click', () => abrirDetallePoema(tarjeta.dataset.id))
  })
}

/* ----------------------------------------------------------------------------
   PUBLICAR / EDITAR POEMA
   ---------------------------------------------------------------------------- */

function limpiarFormularioPoema() {
  document.getElementById('form-poema').reset()
  document.getElementById('poema-id').value = ''
  document.getElementById('contador-caracteres-poema').textContent = '0 / 5000'
  document.getElementById('alerta-error-poema').classList.add('d-none')
  document.getElementById('titulo-modal-poema').textContent = 'Publicar poema'
  document.getElementById('btn-guardar-poema').textContent = 'Publicar'
}

function abrirModalNuevoPoema() {
  limpiarFormularioPoema()
  if (perfilUsuarioActual) {
    document.getElementById('campo-autor-poema').value = perfilUsuarioActual.nombre_completo || perfilUsuarioActual.nombre_usuario || ''
  }
}

function abrirModalEditarPoema(poema) {
  limpiarFormularioPoema()
  document.getElementById('titulo-modal-poema').textContent = 'Editar poema'
  document.getElementById('btn-guardar-poema').textContent = 'Guardar cambios'
  document.getElementById('poema-id').value = poema.id
  document.getElementById('campo-titulo-poema').value = poema.titulo
  document.getElementById('campo-autor-poema').value = poema.nombre_autor
  document.getElementById('campo-contenido-poema').value = poema.contenido
  document.getElementById('contador-caracteres-poema').textContent = `${poema.contenido.length} / 5000`
  modalVerPoema.hide()
  modalPoema.show()
}

/* ----------------------------------------------------------------------------
   DETALLE DEL POEMA (ver, calificar, dar like, reportar, editar/eliminar)
   ---------------------------------------------------------------------------- */

function mostrarAlertaInteraccion(tipo, mensaje) {
  const alerta = document.getElementById('alerta-interaccion-poema')
  alerta.className = `alert small mt-3 alert-${tipo}`
  alerta.textContent = mensaje
  alerta.classList.remove('d-none')
  setTimeout(() => alerta.classList.add('d-none'), 4000)
}

function actualizarBotonLikePoema() {
  const boton = document.getElementById('btn-like-poema')
  const icono = document.getElementById('ver-icono-like')
  const texto = document.getElementById('ver-texto-like')
  icono.className = leGustaPoemaActual ? 'bi bi-hand-thumbs-up-fill' : 'bi bi-hand-thumbs-up'
  texto.textContent = leGustaPoemaActual ? '¡Te gusta!' : 'Me gusta'
  boton.classList.toggle('tiene-like', leGustaPoemaActual)
}

function pintarSelectorEstrellas(valorSeleccionado) {
  const estrellas = document.querySelectorAll('#selector-estrellas .estrella')
  estrellas.forEach((estrella) => {
    const valor = parseInt(estrella.dataset.valor, 10)
    estrella.classList.toggle('activa', valorSeleccionado && valor <= valorSeleccionado)
  })
}

async function abrirDetallePoema(poemaId) {
  poemaActual = await obtenerPoemaPorId(poemaId)
  if (!poemaActual) return

  const esPropio = perfilUsuarioActual && poemaActual.usuario_id === perfilUsuarioActual.id
  const esModeracion = perfilUsuarioActual && (perfilUsuarioActual.rol === 'admin' || perfilUsuarioActual.rol === 'moderador')

  document.getElementById('ver-titulo-poema').textContent = poemaActual.titulo
  document.getElementById('ver-autor-poema').textContent = poemaActual.nombre_autor
  document.getElementById('ver-fecha-poema').textContent = formatearFechaPoema(poemaActual.creado_en)
  document.getElementById('ver-contenido-poema').textContent = poemaActual.contenido
  document.getElementById('ver-estrellas-promedio').innerHTML = renderizarEstrellas(poemaActual.promedio_estrellas)
  document.getElementById('ver-texto-calificacion').textContent =
    poemaActual.total_calificaciones === 0
      ? 'Sin calificaciones todavía'
      : `${poemaActual.promedio_estrellas} de 5 (${poemaActual.total_calificaciones} ${poemaActual.total_calificaciones === 1 ? 'calificación' : 'calificaciones'})`
  document.getElementById('ver-contador-likes').textContent =
    poemaActual.total_likes === 0 ? 'Sé el primero en decir que te gusta' : `${poemaActual.total_likes} ${poemaActual.total_likes === 1 ? 'persona dijo' : 'personas dijeron'} que les gusta`

  document.getElementById('btn-editar-poema').classList.toggle('d-none', !esPropio)
  document.getElementById('btn-eliminar-poema').classList.toggle('d-none', !(esPropio || esModeracion))
  document.getElementById('btn-eliminar-poema').dataset.confirmando = 'false'
  document.getElementById('btn-eliminar-poema').innerHTML = '<i class="bi bi-trash3"></i> Eliminar'

  const seccionCalificar = document.getElementById('seccion-calificar-poema')
  const avisoPropio = document.getElementById('aviso-autor-no-puede-interactuar')
  const botonLike = document.getElementById('btn-like-poema')

  if (!perfilUsuarioActual) {
    seccionCalificar.classList.add('d-none')
    avisoPropio.classList.add('d-none')
    botonLike.disabled = true
  } else if (esPropio) {
    seccionCalificar.classList.add('d-none')
    avisoPropio.classList.remove('d-none')
    botonLike.disabled = true
  } else {
    avisoPropio.classList.add('d-none')
    botonLike.disabled = false
    seccionCalificar.classList.remove('d-none')

    leGustaPoemaActual = await usuarioDioLikePoema(perfilUsuarioActual.id, poemaActual.id)
    actualizarBotonLikePoema()

    calificacionUsuarioActual = await obtenerCalificacionUsuario(perfilUsuarioActual.id, poemaActual.id)
    pintarSelectorEstrellas(calificacionUsuarioActual)
  }

  modalVerPoema.show()
}

/* ----------------------------------------------------------------------------
   INICIALIZACIÓN
   ---------------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', async () => {
  modalPoema = new bootstrap.Modal(document.getElementById('modal-poema'))
  modalVerPoema = new bootstrap.Modal(document.getElementById('modal-ver-poema'))
  modalReportarPoema = new bootstrap.Modal(document.getElementById('modal-reportar-poema'))

  perfilUsuarioActual = await obtenerPerfilActual()

  await cargarPoemas()

  // --- Filtros: búsqueda (con pequeño debounce) y orden ---
  document.getElementById('filtro-busqueda-poema').addEventListener('input', () => {
    clearTimeout(temporizadorBusquedaPoema)
    temporizadorBusquedaPoema = setTimeout(cargarPoemas, 350)
  })
  document.getElementById('filtro-orden-poema').addEventListener('change', cargarPoemas)
  document.getElementById('btn-limpiar-filtros-poema').addEventListener('click', () => {
    document.getElementById('filtro-busqueda-poema').value = ''
    document.getElementById('filtro-orden-poema').value = 'recientes'
    cargarPoemas()
  })

  // --- Contador de caracteres del textarea ---
  document.getElementById('campo-contenido-poema').addEventListener('input', (evento) => {
    document.getElementById('contador-caracteres-poema').textContent = `${evento.target.value.length} / 5000`
  })

  // --- Abrir modal de publicar (limpio) ---
  document.getElementById('btn-nuevo-poema').addEventListener('click', abrirModalNuevoPoema)

  // --- Publicar / guardar edición ---
  document.getElementById('form-poema').addEventListener('submit', async (evento) => {
    evento.preventDefault()
    if (!perfilUsuarioActual) return

    const alertaError = document.getElementById('alerta-error-poema')
    alertaError.classList.add('d-none')

    const poemaId = document.getElementById('poema-id').value
    const titulo = document.getElementById('campo-titulo-poema').value.trim()
    const nombreAutor = document.getElementById('campo-autor-poema').value.trim()
    const contenido = document.getElementById('campo-contenido-poema').value.trim()

    if (!titulo || !nombreAutor || !contenido) {
      alertaError.textContent = 'Completa el título, el autor y el contenido del poema.'
      alertaError.classList.remove('d-none')
      return
    }

    const botonGuardar = document.getElementById('btn-guardar-poema')
    botonGuardar.disabled = true

    const { error } = poemaId
      ? await actualizarPoema(poemaId, titulo, contenido, nombreAutor)
      : await publicarPoema(perfilUsuarioActual.id, titulo, contenido, nombreAutor)

    botonGuardar.disabled = false

    if (error) {
      alertaError.textContent = 'No pudimos guardar tu poema: ' + error.message
      alertaError.classList.remove('d-none')
      return
    }

    modalPoema.hide()
    await cargarPoemas()
  })

  // --- Editar (desde el modal de detalle) ---
  document.getElementById('btn-editar-poema').addEventListener('click', () => {
    if (poemaActual) abrirModalEditarPoema(poemaActual)
  })

  // --- Eliminar con confirmación de 2 clics (mismo patrón que comentarios de libro.html) ---
  document.getElementById('btn-eliminar-poema').addEventListener('click', async (evento) => {
    const boton = evento.currentTarget
    if (boton.dataset.confirmando !== 'true') {
      boton.dataset.confirmando = 'true'
      boton.innerHTML = '<i class="bi bi-check-lg"></i> ¿Eliminar?'
      setTimeout(() => {
        if (boton.dataset.confirmando === 'true') {
          boton.dataset.confirmando = 'false'
          boton.innerHTML = '<i class="bi bi-trash3"></i> Eliminar'
        }
      }, 3000)
      return
    }

    boton.disabled = true
    const { error } = await eliminarPoema(poemaActual.id)
    boton.disabled = false

    if (error) {
      mostrarAlertaInteraccion('danger', 'No pudimos eliminar el poema: ' + error.message)
      return
    }

    modalVerPoema.hide()
    await cargarPoemas()
  })

  // --- "Me gusta" en el detalle ---
  document.getElementById('btn-like-poema').addEventListener('click', async (evento) => {
    if (!perfilUsuarioActual || !poemaActual) return

    const boton = evento.currentTarget
    boton.classList.add('animar-like')
    setTimeout(() => boton.classList.remove('animar-like'), 350)

    const { error } = leGustaPoemaActual
      ? await quitarLikePoema(perfilUsuarioActual.id, poemaActual.id)
      : await darLikePoema(perfilUsuarioActual.id, poemaActual.id)

    if (error) {
      mostrarAlertaInteraccion('danger', 'No pudimos registrar tu "me gusta". Intenta de nuevo.')
      return
    }

    leGustaPoemaActual = !leGustaPoemaActual
    actualizarBotonLikePoema()
    poemaActual = await obtenerPoemaPorId(poemaActual.id)
    document.getElementById('ver-contador-likes').textContent =
      poemaActual.total_likes === 0 ? 'Sé el primero en decir que te gusta' : `${poemaActual.total_likes} ${poemaActual.total_likes === 1 ? 'persona dijo' : 'personas dijeron'} que les gusta`
  })

  // --- Calificar con estrellas ---
  document.getElementById('selector-estrellas').addEventListener('click', async (evento) => {
    const estrella = evento.target.closest('.estrella')
    if (!estrella || !perfilUsuarioActual || !poemaActual) return

    const valor = parseInt(estrella.dataset.valor, 10)
    const yaCalificado = calificacionUsuarioActual !== null

    const { error } = await calificarPoema(perfilUsuarioActual.id, poemaActual.id, valor, yaCalificado)

    if (error) {
      mostrarAlertaInteraccion('danger', 'No pudimos registrar tu calificación. Intenta de nuevo.')
      return
    }

    calificacionUsuarioActual = valor
    pintarSelectorEstrellas(valor)
    mostrarAlertaInteraccion('success', '¡Gracias por calificar este poema!')

    poemaActual = await obtenerPoemaPorId(poemaActual.id)
    document.getElementById('ver-estrellas-promedio').innerHTML = renderizarEstrellas(poemaActual.promedio_estrellas)
    document.getElementById('ver-texto-calificacion').textContent =
      `${poemaActual.promedio_estrellas} de 5 (${poemaActual.total_calificaciones} ${poemaActual.total_calificaciones === 1 ? 'calificación' : 'calificaciones'})`
  })

  // --- Reportar poema ---
  document.getElementById('btn-reportar-poema').addEventListener('click', () => {
    if (!perfilUsuarioActual) return
    document.getElementById('form-reportar-poema').reset()
    document.getElementById('alerta-error-reporte').classList.add('d-none')

    document.getElementById('modal-reportar-poema').addEventListener('hidden.bs.modal', () => {
      setTimeout(() => {
        if (poemaActual) modalVerPoema.show()
      }, 50)
    }, { once: true })

    const abrirReporte = () => modalReportarPoema.show()
    document.getElementById('modal-ver-poema').addEventListener('hidden.bs.modal', abrirReporte, { once: true })
    modalVerPoema.hide()
  })

  document.getElementById('form-reportar-poema').addEventListener('submit', async (evento) => {
    evento.preventDefault()
    if (!perfilUsuarioActual || !poemaActual) return

    const motivo = document.getElementById('campo-motivo-reporte').value.trim()
    const alertaError = document.getElementById('alerta-error-reporte')

    if (!motivo) {
      alertaError.textContent = 'Cuéntanos brevemente el motivo del reporte.'
      alertaError.classList.remove('d-none')
      return
    }

    const { error } = await reportarPoema(perfilUsuarioActual.id, poemaActual.id, motivo)

    if (error) {
      alertaError.textContent = error.message.includes('duplicate')
        ? 'Ya reportaste este poema anteriormente.'
        : 'No pudimos enviar tu reporte: ' + error.message
      alertaError.classList.remove('d-none')
      return
    }

    modalReportarPoema.hide()
    mostrarAlertaInteraccion('success', 'Gracias, revisaremos tu reporte.')
  })
})

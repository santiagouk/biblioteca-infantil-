/* ============================================================================
   LÓGICA DE LA PÁGINA: perfil.html
   ========================================================================= */

/**
 * Actualiza los datos editables del perfil del usuario actual.
 */
async function actualizarPerfil(usuarioId, cambios) {
  const { error } = await cliente
    .from('profiles')
    .update(cambios)
    .eq('id', usuarioId)
  return { error }
}

const COLORES_TARJETA = ['#00D9C0', '#FF4D6D', '#FFD23F', '#7C3AED']

function crearTarjetaHistorial(registro, indice) {
  const libro = registro.books
  const portada = libro.portada_url || 'images/portada-default.svg'
  const colorBorde = COLORES_TARJETA[indice % COLORES_TARJETA.length]

  return `
    <div class="col-sm-6 col-md-4">
      <a href="libro.html?id=${libro.id}" class="text-decoration-none text-dark">
        <div class="card tarjeta-libro h-100" style="--color-tarjeta:${colorBorde};">
          <img src="${portada}" class="portada-libro" style="height: 160px;" alt="Portada de ${libro.titulo}"
               onerror="this.src='images/portada-default.svg'">
          <div class="card-body">
            <h3 class="h6 mb-1">${libro.titulo}</h3>
            <p class="text-muted small mb-2">${libro.autor}</p>
            <div class="progress" style="height: 6px;">
              <div class="progress-bar" style="width: ${registro.porcentaje_completado}%"></div>
            </div>
            <p class="small text-muted mt-1 mb-0">
              ${registro.completado ? '<i class="bi bi-check-circle-fill text-success"></i> Completado' : `${registro.porcentaje_completado}% leído`}
            </p>
          </div>
        </div>
      </a>
    </div>
  `
}

/* ----------------------------------------------------------------------------
   FORO DE POEMAS Y CRÉDITOS
   ---------------------------------------------------------------------------- */

function formatearFechaCredito(fechaIso) {
  try {
    return new Date(fechaIso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

function crearFilaHistorialCredito(movimiento) {
  const esPositivo = movimiento.cantidad > 0
  return `
    <div class="fila-historial-credito">
      <div>
        <p class="small mb-0">${movimiento.motivo}</p>
        <p class="small text-muted mb-0">${formatearFechaCredito(movimiento.creado_en)}</p>
      </div>
      <span class="${esPositivo ? 'monto-positivo' : 'monto-negativo'}">
        ${esPositivo ? '+' : ''}${movimiento.cantidad}
      </span>
    </div>
  `
}

function crearTarjetaLibroVipDesbloqueado(registro) {
  const libro = registro.books
  const portada = libro?.portada_url || 'images/portada-default.svg'
  return `
    <a href="libro.html?id=${libro?.id}" class="text-decoration-none text-dark d-flex align-items-center gap-2 fila-historial-credito">
      <img src="${portada}" alt="" style="width:36px;height:50px;object-fit:cover;border-radius:4px;"
           onerror="this.src='images/portada-default.svg'">
      <div class="flex-grow-1">
        <p class="small fw-bold mb-0">${libro?.titulo || 'Libro'}</p>
        <p class="small text-muted mb-0">Canjeado por ${registro.creditos_pagados} créditos</p>
      </div>
    </a>
  `
}

async function cargarActividadForoPoemas(perfil) {
  document.getElementById('perfil-creditos').textContent = perfil.creditos ?? 0

  const estadisticas = await obtenerEstadisticasPoemasUsuario(perfil.id)
  document.getElementById('perfil-total-poemas').textContent = estadisticas.total_poemas
  document.getElementById('perfil-total-likes-poemas').textContent = estadisticas.total_likes_recibidos
  document.getElementById('perfil-promedio-poemas').textContent =
    estadisticas.total_poemas > 0 ? Number(estadisticas.promedio_calificacion).toFixed(1) : '—'

  const librosVip = await obtenerLibrosVipDesbloqueados(perfil.id)
  const contenedorVip = document.getElementById('lista-libros-vip')
  if (librosVip.length === 0) {
    document.getElementById('mensaje-sin-vip').classList.remove('d-none')
  } else {
    contenedorVip.innerHTML = librosVip.map(crearTarjetaLibroVipDesbloqueado).join('')
  }

  const historialCreditos = await obtenerHistorialCreditos(perfil.id, 10)
  const contenedorHistorial = document.getElementById('lista-historial-creditos')
  if (historialCreditos.length === 0) {
    document.getElementById('mensaje-sin-historial-creditos').classList.remove('d-none')
  } else {
    contenedorHistorial.innerHTML = historialCreditos.map(crearFilaHistorialCredito).join('')
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const perfil = await obtenerPerfilActual()
  if (!perfil) return

  // --- Rellenar formulario con datos actuales ---
  document.getElementById('nombre-completo').value = perfil.nombre_completo || ''
  document.getElementById('nombre-usuario').value = perfil.nombre_usuario || ''
  document.getElementById('email').value = perfil.email || ''
  document.getElementById('fecha-nacimiento').value = perfil.fecha_nacimiento || ''

  // La fecha de nacimiento no puede ser futura (mismo criterio que en el
  // registro y que la validación de backend de la migración 008).
  document.getElementById('fecha-nacimiento').max = new Date().toISOString().split('T')[0]

  await cargarActividadForoPoemas(perfil)

  document.getElementById('form-perfil').addEventListener('submit', async (evento) => {
    evento.preventDefault()

    const nombreCompleto = document.getElementById('nombre-completo').value.trim()
    const fechaNacimiento = document.getElementById('fecha-nacimiento').value
    const errorNombre = document.getElementById('error-nombre-completo')
    const errorFecha = document.getElementById('error-fecha-nacimiento')
    const campoNombre = document.getElementById('nombre-completo')
    const campoFecha = document.getElementById('fecha-nacimiento')

    campoNombre.classList.remove('is-invalid')
    campoFecha.classList.remove('is-invalid')
    if (errorNombre) errorNombre.classList.add('d-none')
    if (errorFecha) errorFecha.classList.add('d-none')

    if (/\d/.test(nombreCompleto)) {
      campoNombre.classList.add('is-invalid')
      if (errorNombre) {
        errorNombre.textContent = 'El nombre no puede contener números.'
        errorNombre.classList.remove('d-none')
      }
      campoNombre.focus()
      return
    }

    if (fechaNacimiento && fechaNacimiento > new Date().toISOString().split('T')[0]) {
      campoFecha.classList.add('is-invalid')
      if (errorFecha) {
        errorFecha.textContent = 'La fecha de nacimiento no puede ser en el futuro.'
        errorFecha.classList.remove('d-none')
      }
      campoFecha.focus()
      return
    }

    const cambios = {
      nombre_completo: nombreCompleto,
      nombre_usuario: document.getElementById('nombre-usuario').value.trim() || null,
      fecha_nacimiento: fechaNacimiento || null,
    }

    const { error } = await actualizarPerfil(perfil.id, cambios)
    const alertaExito = document.getElementById('alerta-exito')

    if (error) {
      alertaExito.classList.remove('alert-success')
      alertaExito.classList.add('alert-danger')
      alertaExito.textContent = 'No se pudo guardar: ' + error.message
    } else {
      alertaExito.classList.remove('alert-danger')
      alertaExito.classList.add('alert-success')
      alertaExito.innerHTML = '<i class="bi bi-check-circle-fill"></i> Perfil actualizado correctamente.'
    }
    alertaExito.classList.remove('d-none')
  })

  // --- Historial de lectura ---
  const spinner = document.getElementById('spinner-carga')
  const contenedor = document.getElementById('contenedor-historial')
  const mensajeSinHistorial = document.getElementById('mensaje-sin-historial')

  const historial = await obtenerHistorialLectura(perfil.id)
  spinner.classList.add('d-none')

  if (historial.length === 0) {
    mensajeSinHistorial.classList.remove('d-none')
    return
  }

  contenedor.innerHTML = historial.map(crearTarjetaHistorial).join('')
})

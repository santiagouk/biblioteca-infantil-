/* ============================================================================
   LÓGICA DE LA PÁGINA: admin/libros.html
   ========================================================================= */

// PDF.js se carga como módulo ES vía js/vendor/pdfjs/puente-pdfjs.js (ver
// libro.js para más detalle). Se usa aquí solo para leer cuántas páginas
// tiene el PDF que el admin está subiendo, antes de guardarlo.
const pdfjsListoAdmin = window.pdfjsLib
  ? Promise.resolve()
  : new Promise((resolve) => window.addEventListener('pdfjs-listo', resolve, { once: true }))

const LIMITE_MB_PDF = 50
const LIMITE_MB_PORTADA = 5
const LIMITE_PX_PORTADA = 2000

let modalLibro = null
let categoriasDisponibles = []
let autorConfirmado = false
let libroEnEdicionId = null
let numeroPaginasDetectado = null

/**
 * Pinta la tabla de libros.
 */
function renderizarTablaLibros(libros) {
  const tabla = document.getElementById('tabla-libros')

  if (libros.length === 0) {
    tabla.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-4">No hay libros registrados.</td></tr>`
    return
  }

  tabla.innerHTML = libros
    .map(
      (libro) => `
      <tr>
        <td>
          <img src="${libro.portada_url || '../images/portada-default.svg'}"
               alt="" style="width:40px;height:55px;object-fit:cover;border-radius:4px;"
               onerror="this.src='../images/portada-default.svg'">
        </td>
        <td>${libro.titulo}</td>
        <td>${libro.autor}</td>
        <td>${libro.categories?.nombre || '—'}</td>
        <td>${etiquetaEdad(libro.edad_recomendada)}</td>
        <td><span class="badge badge-tipo-libro">PDF${libro.numero_paginas ? ` · ${libro.numero_paginas} pág.` : ''}</span></td>
        <td>${libro.publicado ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-x-circle-fill text-danger"></i>'}</td>
        <td>${libro.destacado ? '<i class="bi bi-star-fill" style="color:#FFD23F;"></i>' : '—'}</td>
        <td>${libro.es_vip ? `<span class="badge badge-vip"><i class="bi bi-gem"></i> ${libro.costo_creditos}</span>` : '—'}</td>
        <td class="text-end">
          <div class="d-flex flex-wrap justify-content-end gap-2">
            <button class="btn btn-sm btn-outline-primary" data-editar="${libro.id}">Editar</button>
            <button class="btn btn-sm btn-outline-danger" data-eliminar="${libro.id}" data-titulo="${libro.titulo}">Eliminar</button>
          </div>
        </td>
      </tr>
    `
    )
    .join('')

  // Eventos de editar
  tabla.querySelectorAll('[data-editar]').forEach((boton) => {
    boton.addEventListener('click', () => abrirModalEdicion(boton.dataset.editar, libros))
  })

  // Eventos de eliminar
  tabla.querySelectorAll('[data-eliminar]').forEach((boton) => {
    boton.addEventListener('click', () => confirmarEliminarLibro(boton.dataset.eliminar, boton.dataset.titulo))
  })
}

/**
 * Carga la lista de libros desde Supabase y la pinta.
 */
async function recargarTablaLibros() {
  document.getElementById('spinner-carga').classList.remove('d-none')
  const libros = await obtenerTodosLosLibrosAdmin()
  document.getElementById('spinner-carga').classList.add('d-none')
  renderizarTablaLibros(libros)
  return libros
}

/**
 * Llena el select de categorías del formulario.
 */
async function cargarSelectCategorias() {
  categoriasDisponibles = await obtenerCategorias()
  const select = document.getElementById('campo-categoria')
  select.innerHTML = '<option value="">Sin categoría</option>' +
    categoriasDisponibles.map((cat) => `<option value="${cat.id}">${cat.nombre}</option>`).join('')
}

/* ============================================================================
   BUSCADOR DE AUTORES
   ============================================================================
   El campo "Título" queda deshabilitado hasta que se confirma un autor
   (uno ya existente en el catálogo, elegido de la lista, o uno nuevo
   escrito a mano y confirmado explícitamente). Mientras tanto se muestran
   sugerencias en vivo y, si hay coincidencias, "otros libros de ese autor".
   ========================================================================= */

function bloquearCampoTitulo() {
  autorConfirmado = false
  document.getElementById('campo-autor-confirmado').value = ''
  const campoTitulo = document.getElementById('campo-titulo')
  campoTitulo.disabled = true
  document.getElementById('aviso-titulo-bloqueado').classList.remove('d-none')
  document.getElementById('panel-info-autor').classList.add('d-none')
}

function desbloquearCampoTitulo(nombreAutor) {
  autorConfirmado = true
  document.getElementById('campo-autor-confirmado').value = nombreAutor
  document.getElementById('campo-titulo').disabled = false
  document.getElementById('aviso-titulo-bloqueado').classList.add('d-none')
}

async function mostrarInfoAutor(nombreAutor) {
  const panel = document.getElementById('panel-info-autor')
  const libros = await obtenerLibrosPorAutor(nombreAutor, libroEnEdicionId)

  if (libros.length === 0) {
    panel.innerHTML = `<i class="bi bi-info-circle"></i> Autor nuevo en el catálogo: se creará al guardar.`
  } else {
    panel.innerHTML = `
      <strong><i class="bi bi-collection"></i> Otros libros de ${nombreAutor}:</strong>
      <ul class="mb-0 mt-1 ps-3">
        ${libros.map((l) => `<li>${l.titulo}</li>`).join('')}
      </ul>
    `
  }
  panel.classList.remove('d-none')
}

async function seleccionarAutor(nombreAutor) {
  document.getElementById('campo-autor').value = nombreAutor
  document.getElementById('sugerencias-autor').classList.add('d-none')
  desbloquearCampoTitulo(nombreAutor)
  await mostrarInfoAutor(nombreAutor)
}

async function buscarYMostrarSugerenciasAutor(texto) {
  const contenedor = document.getElementById('sugerencias-autor')

  if (!texto || texto.trim().length < 2) {
    contenedor.classList.add('d-none')
    return
  }

  const resultados = await buscarAutores(texto)
  const coincidenciaExacta = resultados.some((r) => r.autor.toLowerCase() === texto.trim().toLowerCase())

  const opciones = resultados
    .map(
      (r) => `
      <button type="button" data-autor="${r.autor.replace(/"/g, '&quot;')}">
        ${r.autor} <span class="text-muted small">(${r.totalLibros} libro${r.totalLibros === 1 ? '' : 's'})</span>
      </button>
    `
    )
    .join('')

  const opcionNuevo = coincidenciaExacta
    ? ''
    : `<button type="button" class="opcion-autor-nuevo" data-autor-nuevo="${texto.trim().replace(/"/g, '&quot;')}">
         <i class="bi bi-plus-circle"></i> Usar "${texto.trim()}" como autor nuevo
       </button>`

  if (!opciones && !opcionNuevo) {
    contenedor.classList.add('d-none')
    return
  }

  contenedor.innerHTML = opciones + opcionNuevo
  contenedor.classList.remove('d-none')

  contenedor.querySelectorAll('[data-autor]').forEach((boton) => {
    boton.addEventListener('click', () => seleccionarAutor(boton.dataset.autor))
  })
  contenedor.querySelectorAll('[data-autor-nuevo]').forEach((boton) => {
    boton.addEventListener('click', () => seleccionarAutor(boton.dataset.autorNuevo))
  })
}

/* ============================================================================
   VALIDACIÓN DE ARCHIVOS (PDF y portada)
   ========================================================================= */

function validarArchivoPdf(archivo) {
  if (archivo.type !== 'application/pdf') {
    return 'El archivo debe ser un PDF.'
  }
  if (archivo.size > LIMITE_MB_PDF * 1024 * 1024) {
    return `El PDF no puede superar ${LIMITE_MB_PDF} MB.`
  }
  return null
}

function obtenerDimensionesImagen(archivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ ancho: img.naturalWidth, alto: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen.'))
    }
    img.src = url
  })
}

async function validarArchivoPortada(archivo) {
  const tiposValidos = ['image/png', 'image/jpeg', 'image/webp']
  if (!tiposValidos.includes(archivo.type)) {
    return 'La portada debe ser PNG, JPG o WebP.'
  }
  if (archivo.size > LIMITE_MB_PORTADA * 1024 * 1024) {
    return `La portada no puede superar ${LIMITE_MB_PORTADA} MB.`
  }
  try {
    const { ancho, alto } = await obtenerDimensionesImagen(archivo)
    if (ancho > LIMITE_PX_PORTADA || alto > LIMITE_PX_PORTADA) {
      return `La portada no puede superar ${LIMITE_PX_PORTADA}×${LIMITE_PX_PORTADA} píxeles (esta imagen mide ${ancho}×${alto}).`
    }
  } catch {
    return 'No se pudo leer la imagen seleccionada.'
  }
  return null
}

/**
 * Lee el PDF seleccionado (sin subirlo todavía) para detectar su número
 * de páginas automáticamente. Es la única forma en que numero_paginas se
 * completa: nunca se pide a mano en el formulario.
 */
async function detectarNumeroPaginas(archivo) {
  const texto = document.getElementById('texto-paginas-detectadas')
  texto.textContent = 'Detectando páginas...'

  try {
    await pdfjsListoAdmin
    const bufer = await archivo.arrayBuffer()
    const documento = await pdfjsLib.getDocument({ data: bufer }).promise
    numeroPaginasDetectado = documento.numPages
    texto.textContent = `Se detectaron ${numeroPaginasDetectado} páginas.`
  } catch (error) {
    console.error('Error al leer el PDF para contar páginas:', error)
    numeroPaginasDetectado = null
    texto.textContent = 'No se pudo detectar el número de páginas automáticamente.'
  }
}

/**
 * Filtra el campo de año para admitir solo dígitos, hasta 4 caracteres.
 */
function limpiarCampoAnio(input) {
  input.value = input.value.replace(/\D/g, '').slice(0, 4)
}

function validarAnioPublicacion(valor) {
  if (!valor) return { valor: null, error: null }
  if (!/^\d{1,4}$/.test(valor)) return { valor: null, error: 'El año solo puede tener números.' }
  const numero = parseInt(valor, 10)
  if (numero > 2027) return { valor: null, error: 'El año de publicación no puede ser mayor a 2027.' }
  return { valor: numero, error: null }
}

/**
 * Limpia el formulario del modal para crear un libro nuevo.
 */
function limpiarFormularioLibro() {
  document.getElementById('form-libro').reset()
  document.getElementById('libro-id').value = ''
  document.getElementById('campo-portada-url').value = ''
  document.getElementById('campo-pdf-url').value = ''
  document.getElementById('campo-numero-paginas').value = ''
  document.getElementById('texto-paginas-detectadas').textContent = ''
  document.getElementById('titulo-modal-libro').textContent = 'Agregar libro'
  document.getElementById('alerta-error-modal').classList.add('d-none')
  document.getElementById('sugerencias-autor').classList.add('d-none')
  document.getElementById('campo-es-vip').checked = false
  document.getElementById('campo-costo-creditos').value = '10'
  document.getElementById('contenedor-costo-creditos').style.display = 'none'
  libroEnEdicionId = null
  numeroPaginasDetectado = null
  bloquearCampoTitulo()
}

/**
 * Abre el modal en modo edición, rellenando los campos con los datos
 * actuales del libro seleccionado. El autor ya es válido (viene guardado),
 * así que el campo Título se habilita de inmediato.
 */
async function abrirModalEdicion(libroId, libros) {
  const libro = libros.find((l) => l.id === libroId)
  if (!libro) return

  limpiarFormularioLibro()
  libroEnEdicionId = libro.id
  numeroPaginasDetectado = libro.numero_paginas || null

  document.getElementById('titulo-modal-libro').textContent = 'Editar libro'
  document.getElementById('libro-id').value = libro.id
  document.getElementById('campo-autor').value = libro.autor
  desbloquearCampoTitulo(libro.autor)
  document.getElementById('campo-titulo').value = libro.titulo
  document.getElementById('campo-categoria').value = libro.categoria_id || ''
  document.getElementById('campo-edad').value = libro.edad_recomendada
  document.getElementById('campo-descripcion').value = libro.descripcion || ''
  document.getElementById('campo-fuente').value = libro.fuente_dominio_publico || ''
  document.getElementById('campo-anio').value = libro.anio_publicacion_original || ''
  document.getElementById('campo-portada-url').value = libro.portada_url || ''
  document.getElementById('campo-pdf-url').value = libro.archivo_pdf_url || ''
  document.getElementById('campo-publicado').checked = libro.publicado
  document.getElementById('campo-destacado').checked = libro.destacado
  document.getElementById('campo-es-vip').checked = libro.es_vip
  document.getElementById('campo-costo-creditos').value = libro.costo_creditos || 10
  document.getElementById('contenedor-costo-creditos').style.display = libro.es_vip ? '' : 'none'

  if (libro.numero_paginas) {
    document.getElementById('texto-paginas-detectadas').textContent = `Este libro tiene ${libro.numero_paginas} páginas.`
  }

  await mostrarInfoAutor(libro.autor)

  modalLibro.show()
}

/**
 * Pide confirmación y elimina un libro.
 */
async function confirmarEliminarLibro(libroId, titulo) {
  const confirmado = await confirmarConModal(
    `¿Seguro que quieres eliminar "${titulo}"? Esta acción no se puede deshacer.`,
    'Eliminar libro'
  )
  if (!confirmado) return

  const { error } = await eliminarLibro(libroId)
  mostrarAlertaResultado(error ? 'danger' : 'success', error ? error.message : 'Libro eliminado correctamente.')
  await recargarTablaLibros()
}

function mostrarAlertaResultado(tipo, mensaje) {
  const alerta = document.getElementById('alerta-resultado')
  alerta.className = `alert alert-${tipo}`
  alerta.textContent = mensaje
  alerta.classList.remove('d-none')
  setTimeout(() => alerta.classList.add('d-none'), 4000)
}

document.addEventListener('DOMContentLoaded', async () => {
  modalLibro = new bootstrap.Modal(document.getElementById('modal-libro'))

  document.getElementById('btn-nuevo-libro').addEventListener('click', limpiarFormularioLibro)

  await cargarSelectCategorias()
  await recargarTablaLibros()

  // --- Buscador de autores ---
  const campoAutor = document.getElementById('campo-autor')
  campoAutor.addEventListener('input', () => {
    if (autorConfirmado) bloquearCampoTitulo()
    buscarYMostrarSugerenciasAutor(campoAutor.value)
  })
  campoAutor.addEventListener('blur', () => {
    // Pequeño margen para que el clic en una sugerencia se registre antes
    // de cerrar la lista (si no, "blur" la ocultaría primero).
    setTimeout(() => document.getElementById('sugerencias-autor').classList.add('d-none'), 150)
  })
  document.addEventListener('click', (evento) => {
    if (!evento.target.closest('#campo-autor') && !evento.target.closest('#sugerencias-autor')) {
      document.getElementById('sugerencias-autor').classList.add('d-none')
    }
  })

  // --- Año de publicación: solo números, máximo 4 dígitos ---
  const campoAnio = document.getElementById('campo-anio')
  campoAnio.addEventListener('input', () => limpiarCampoAnio(campoAnio))

  // --- Detección automática de páginas al elegir un PDF ---
  document.getElementById('campo-archivo-pdf').addEventListener('change', async (evento) => {
    const archivo = evento.target.files[0]
    if (!archivo) return

    const errorPdf = validarArchivoPdf(archivo)
    if (errorPdf) {
      mostrarAlertaResultado('danger', errorPdf)
      evento.target.value = ''
      document.getElementById('texto-paginas-detectadas').textContent = ''
      numeroPaginasDetectado = null
      return
    }

    await detectarNumeroPaginas(archivo)
  })

  // --- Libro VIP: mostrar/ocultar el campo de costo en créditos ---
  document.getElementById('campo-es-vip').addEventListener('change', (evento) => {
    document.getElementById('contenedor-costo-creditos').style.display = evento.target.checked ? '' : 'none'
  })

  document.getElementById('form-libro').addEventListener('submit', async (evento) => {
    evento.preventDefault()

    const botonGuardar = document.getElementById('btn-guardar-libro')
    const alertaErrorModal = document.getElementById('alerta-error-modal')
    alertaErrorModal.classList.add('d-none')

    const libroId = document.getElementById('libro-id').value
    let portadaUrl = document.getElementById('campo-portada-url').value
    let pdfUrl = document.getElementById('campo-pdf-url').value

    const archivoPortada = document.getElementById('campo-archivo-portada').files[0]
    const archivoPdf = document.getElementById('campo-archivo-pdf').files[0]

    function mostrarError(mensaje) {
      alertaErrorModal.textContent = mensaje
      alertaErrorModal.classList.remove('d-none')
    }

    // Validación: el autor debe estar confirmado antes de guardar
    if (!autorConfirmado) {
      mostrarError('Elige un autor de la lista (o confírmalo como nuevo) antes de guardar.')
      return
    }

    // Validación: si es un libro nuevo, el PDF es obligatorio
    if (!libroId && !archivoPdf) {
      mostrarError('Debes subir un archivo PDF para crear el libro.')
      return
    }

    // Validación del año de publicación
    const { valor: anioValidado, error: errorAnio } = validarAnioPublicacion(document.getElementById('campo-anio').value)
    if (errorAnio) {
      mostrarError(errorAnio)
      return
    }

    // Validación del libro VIP: si está marcado, el costo debe ser un
    // entero positivo (el CHECK costo_creditos >= 0 de la base de datos no
    // exige que sea mayor a 0, pero un libro VIP con costo 0 no tendría
    // sentido de negocio).
    const esVip = document.getElementById('campo-es-vip').checked
    const costoCreditos = parseInt(document.getElementById('campo-costo-creditos').value, 10)
    if (esVip && (isNaN(costoCreditos) || costoCreditos < 1)) {
      mostrarError('Ingresa un costo en créditos válido (mínimo 1) para un libro VIP.')
      return
    }

    // Revalida el PDF por si acaso (defensa adicional, ya se validó al elegirlo)
    if (archivoPdf) {
      const errorPdf = validarArchivoPdf(archivoPdf)
      if (errorPdf) {
        mostrarError(errorPdf)
        return
      }
    }

    // Valida la portada (tipo, tamaño y dimensiones en píxeles)
    if (archivoPortada) {
      const errorPortada = await validarArchivoPortada(archivoPortada)
      if (errorPortada) {
        mostrarError(errorPortada)
        return
      }
    }

    botonGuardar.disabled = true
    botonGuardar.textContent = 'Guardando...'

    // Sube la portada nueva, si se seleccionó una
    if (archivoPortada) {
      const resultado = await subirArchivo('portadas', archivoPortada)
      if (resultado.error) {
        mostrarError('Error al subir la portada: ' + resultado.error.message)
        botonGuardar.disabled = false
        botonGuardar.textContent = 'Guardar'
        return
      }
      portadaUrl = resultado.url
    }

    // Sube el PDF nuevo, si se seleccionó uno
    if (archivoPdf) {
      const resultado = await subirArchivo('libros-pdf', archivoPdf)
      if (resultado.error) {
        mostrarError('Error al subir el PDF: ' + resultado.error.message)
        botonGuardar.disabled = false
        botonGuardar.textContent = 'Guardar'
        return
      }
      pdfUrl = resultado.url
    }

    const datosLibro = {
      titulo: document.getElementById('campo-titulo').value.trim(),
      autor: document.getElementById('campo-autor-confirmado').value,
      categoria_id: document.getElementById('campo-categoria').value || null,
      edad_recomendada: document.getElementById('campo-edad').value,
      descripcion: document.getElementById('campo-descripcion').value.trim() || null,
      fuente_dominio_publico: document.getElementById('campo-fuente').value.trim() || null,
      anio_publicacion_original: anioValidado,
      numero_paginas: numeroPaginasDetectado,
      portada_url: portadaUrl || null,
      archivo_pdf_url: pdfUrl,
      publicado: document.getElementById('campo-publicado').checked,
      destacado: document.getElementById('campo-destacado').checked,
      es_vip: esVip,
      costo_creditos: esVip ? costoCreditos : 0,
    }

    const { error } = libroId
      ? await actualizarLibro(libroId, datosLibro)
      : await crearLibro(datosLibro)

    botonGuardar.disabled = false
    botonGuardar.textContent = 'Guardar'

    if (error) {
      mostrarError('Error al guardar: ' + error.message)
      return
    }

    modalLibro.hide()
    mostrarAlertaResultado('success', libroId ? 'Libro actualizado correctamente.' : 'Libro creado correctamente.')
    await recargarTablaLibros()
  })
})

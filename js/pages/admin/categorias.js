/* ============================================================================
   LÓGICA DE LA PÁGINA: admin/categorias.html
   ========================================================================= */

let modalCategoria = null

function renderizarCategorias(categorias) {
  const contenedor = document.getElementById('contenedor-categorias')

  if (categorias.length === 0) {
    contenedor.innerHTML = `<p class="text-muted text-center py-4">No hay categorías registradas.</p>`
    return
  }

  contenedor.innerHTML = categorias
    .map(
      (categoria) => `
      <div class="col-sm-6 col-md-4 col-lg-3">
        <div class="card tarjeta-libro p-3 h-100" style="--color-tarjeta:${categoria.color};">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span style="width:14px;height:14px;border-radius:50%;background-color:${categoria.color};display:inline-block;"></span>
            <h3 class="h6 mb-0">${categoria.nombre}</h3>
          </div>
          <p class="small text-muted flex-grow-1">${categoria.descripcion || 'Sin descripción.'}</p>
          <div class="d-flex gap-2 mt-2">
            <button class="btn btn-sm btn-outline-primary flex-grow-1" data-editar="${categoria.id}">Editar</button>
            <button class="btn btn-sm btn-outline-danger flex-grow-1" data-eliminar="${categoria.id}" data-nombre="${categoria.nombre}">Eliminar</button>
          </div>
        </div>
      </div>
    `
    )
    .join('')

  contenedor.querySelectorAll('[data-editar]').forEach((boton) => {
    boton.addEventListener('click', () => abrirModalEdicionCategoria(boton.dataset.editar, categorias))
  })

  contenedor.querySelectorAll('[data-eliminar]').forEach((boton) => {
    boton.addEventListener('click', () => confirmarEliminarCategoria(boton.dataset.eliminar, boton.dataset.nombre))
  })
}

async function recargarCategorias() {
  document.getElementById('spinner-carga').classList.remove('d-none')
  const categorias = await obtenerCategorias()
  document.getElementById('spinner-carga').classList.add('d-none')
  renderizarCategorias(categorias)
  return categorias
}

function limpiarFormularioCategoria() {
  document.getElementById('form-categoria').reset()
  document.getElementById('categoria-id').value = ''
  document.getElementById('campo-color').value = '#6366f1'
  document.getElementById('titulo-modal-categoria').textContent = 'Agregar categoría'
  document.getElementById('alerta-error-modal').classList.add('d-none')
}

function abrirModalEdicionCategoria(categoriaId, categorias) {
  const categoria = categorias.find((c) => c.id === categoriaId)
  if (!categoria) return

  limpiarFormularioCategoria()
  document.getElementById('titulo-modal-categoria').textContent = 'Editar categoría'
  document.getElementById('categoria-id').value = categoria.id
  document.getElementById('campo-nombre').value = categoria.nombre
  document.getElementById('campo-descripcion').value = categoria.descripcion || ''
  document.getElementById('campo-color').value = categoria.color || '#6366f1'

  modalCategoria.show()
}

async function confirmarEliminarCategoria(categoriaId, nombre) {
  const confirmado = await confirmarConModal(
    `¿Eliminar la categoría "${nombre}"? Los libros que la usan quedarán sin categoría asignada.`,
    'Eliminar categoría'
  )
  if (!confirmado) return

  const { error } = await eliminarCategoria(categoriaId)
  mostrarAlertaResultado(error ? 'danger' : 'success', error ? error.message : 'Categoría eliminada.')
  await recargarCategorias()
}

function mostrarAlertaResultado(tipo, mensaje) {
  const alerta = document.getElementById('alerta-resultado')
  alerta.className = `alert alert-${tipo}`
  alerta.textContent = mensaje
  alerta.classList.remove('d-none')
  setTimeout(() => alerta.classList.add('d-none'), 4000)
}

document.addEventListener('DOMContentLoaded', async () => {
  modalCategoria = new bootstrap.Modal(document.getElementById('modal-categoria'))
  document.getElementById('btn-nueva-categoria').addEventListener('click', limpiarFormularioCategoria)

  await recargarCategorias()

  document.getElementById('form-categoria').addEventListener('submit', async (evento) => {
    evento.preventDefault()

    const botonGuardar = document.getElementById('btn-guardar-categoria')
    const alertaErrorModal = document.getElementById('alerta-error-modal')
    alertaErrorModal.classList.add('d-none')
    botonGuardar.disabled = true
    botonGuardar.textContent = 'Guardando...'

    const categoriaId = document.getElementById('categoria-id').value
    const datosCategoria = {
      nombre: document.getElementById('campo-nombre').value.trim(),
      descripcion: document.getElementById('campo-descripcion').value.trim() || null,
      color: document.getElementById('campo-color').value,
    }

    const { error } = categoriaId
      ? await actualizarCategoria(categoriaId, datosCategoria)
      : await crearCategoria(datosCategoria)

    botonGuardar.disabled = false
    botonGuardar.textContent = 'Guardar'

    if (error) {
      alertaErrorModal.textContent = 'Error al guardar: ' + error.message
      alertaErrorModal.classList.remove('d-none')
      return
    }

    modalCategoria.hide()
    mostrarAlertaResultado('success', categoriaId ? 'Categoría actualizada.' : 'Categoría creada.')
    await recargarCategorias()
  })
})

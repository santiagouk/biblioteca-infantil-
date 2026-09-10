/* ============================================================================
   LÓGICA DE LA PÁGINA: admin/usuarios.html
   ========================================================================= */

let perfilAdminActual = null

function formatearFecha(fechaIso) {
  const fecha = new Date(fechaIso)
  return fecha.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

function etiquetaRol(rol) {
  return { admin: 'Admin', moderador: 'Moderador', usuario: 'Usuario' }[rol] || rol
}

function claseBadgeRol(rol) {
  return { admin: 'badge-rol-admin', moderador: 'badge-rol-moderador', usuario: 'badge-rol-usuario' }[rol] || 'badge-rol-usuario'
}

function renderizarTablaUsuarios(usuarios) {
  const tabla = document.getElementById('tabla-usuarios')

  tabla.innerHTML = usuarios
    .map((usuario) => {
      const esUnoMismo = usuario.id === perfilAdminActual.id
      return `
        <tr>
          <td>${usuario.nombre_completo || '—'}</td>
          <td>${usuario.email}</td>
          <td>
            <span class="badge ${claseBadgeRol(usuario.rol)}">
              ${etiquetaRol(usuario.rol)}
            </span>
          </td>
          <td>${formatearFecha(usuario.creado_en)}</td>
          <td class="text-end">
            ${
              esUnoMismo
                ? '<span class="text-muted small">Esta es tu cuenta</span>'
                : `
                  <div class="d-flex flex-wrap justify-content-end align-items-center gap-2">
                    <select class="form-select form-select-sm w-auto" data-cambiar-rol="${usuario.id}" aria-label="Cambiar rol">
                      <option value="usuario" ${usuario.rol === 'usuario' ? 'selected' : ''}>Usuario</option>
                      <option value="moderador" ${usuario.rol === 'moderador' ? 'selected' : ''}>Moderador</option>
                      <option value="admin" ${usuario.rol === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                    <button class="btn btn-sm btn-outline-danger" data-eliminar="${usuario.id}" data-nombre="${usuario.nombre_completo || usuario.email}">
                      Eliminar
                    </button>
                  </div>
                `
            }
          </td>
        </tr>
      `
    })
    .join('')

  tabla.querySelectorAll('[data-cambiar-rol]').forEach((select) => {
    select.addEventListener('change', () => cambiarRolDesdeSelector(select))
  })

  tabla.querySelectorAll('[data-eliminar]').forEach((boton) => {
    boton.addEventListener('click', () => confirmarEliminarUsuario(boton.dataset.eliminar, boton.dataset.nombre))
  })
}

async function recargarUsuarios() {
  document.getElementById('spinner-carga').classList.remove('d-none')
  const usuarios = await obtenerTodosLosUsuarios()
  document.getElementById('spinner-carga').classList.add('d-none')
  renderizarTablaUsuarios(usuarios)
}

async function cambiarRolDesdeSelector(select) {
  const usuarioId = select.dataset.cambiarRol
  const nuevoRol = select.value

  const confirmado = await confirmarConModal(
    `¿Cambiar el rol de este usuario a "${etiquetaRol(nuevoRol)}"?`,
    'Cambiar rol de usuario'
  )
  if (!confirmado) {
    await recargarUsuarios()
    return
  }

  const { error } = await cambiarRolUsuario(usuarioId, nuevoRol)
  mostrarAlertaResultado(error ? 'danger' : 'success', error ? error.message : 'Rol actualizado correctamente.')
  await recargarUsuarios()
}

async function confirmarEliminarUsuario(usuarioId, nombre) {
  const confirmado = await confirmarConModal(
    `¿Eliminar el perfil de "${nombre}"? Esto no elimina su cuenta de inicio de sesión, solo sus datos de perfil.`,
    'Eliminar usuario'
  )
  if (!confirmado) return

  const { error } = await eliminarPerfilUsuario(usuarioId)
  mostrarAlertaResultado(error ? 'danger' : 'success', error ? error.message : 'Perfil eliminado.')
  await recargarUsuarios()
}

function mostrarAlertaResultado(tipo, mensaje) {
  const alerta = document.getElementById('alerta-resultado')
  alerta.className = `alert alert-${tipo}`
  alerta.textContent = mensaje
  alerta.classList.remove('d-none')
  setTimeout(() => alerta.classList.add('d-none'), 4000)
}

document.addEventListener('DOMContentLoaded', async () => {
  perfilAdminActual = await obtenerPerfilActual()
  await recargarUsuarios()
})

/* ============================================================================
   NAVBAR DINÁMICO
   ============================================================================
   Inserta un navbar de Bootstrap en el elemento <div id="navbar"></div> de
   cada página. Cambia los enlaces mostrados según si hay sesión iniciada
   y si el usuario es administrador.

   rutaBase: usar '' para páginas en la raíz, '../' para páginas dentro de admin/
   ========================================================================= */

async function cargarNavbar(rutaBase = '') {
  const contenedor = document.getElementById('navbar')
  if (!contenedor) return

  const perfil = await obtenerPerfilActual()

  const etiquetasRol = { admin: 'Admin', moderador: 'Moderador', usuario: 'Usuario' }
  const clasesBadgeRol = { admin: 'badge-rol-admin', moderador: 'badge-rol-moderador', usuario: 'badge-rol-usuario' }

  const enlaceAdmin = perfil?.rol === 'admin'
    ? `<li class="nav-item"><a class="nav-link" href="${rutaBase}admin/index.html">Panel admin</a></li>`
    : ''

  const usuarioActivo = perfil
    ? `
      <li class="nav-item d-flex align-items-center gap-1 me-lg-2">
        <span class="navbar-text small text-white-50" title="${perfil.email}">
          <i class="bi bi-person-circle"></i> ${perfil.nombre_completo || perfil.email}
        </span>
        <span class="badge ${clasesBadgeRol[perfil.rol] || 'badge-rol-usuario'}">
          ${etiquetasRol[perfil.rol] || perfil.rol}
        </span>
      </li>
    `
    : ''

  const enlacesSesion = perfil
    ? `
      ${usuarioActivo}
      <li class="nav-item"><a class="nav-link" href="${rutaBase}biblioteca.html">Biblioteca</a></li>
      <li class="nav-item"><a class="nav-link" href="${rutaBase}poemas.html"><i class="bi bi-feather"></i> Foro de Poemas</a></li>
      <li class="nav-item"><a class="nav-link" href="${rutaBase}favoritos.html">Favoritos</a></li>
      <li class="nav-item"><a class="nav-link" href="${rutaBase}perfil.html">Mi perfil</a></li>
      ${enlaceAdmin}
      <li class="nav-item">
        <button class="btn btn-outline-light btn-sm ms-2" id="btn-cerrar-sesion">Cerrar sesión</button>
      </li>
    `
    : `
      <li class="nav-item"><a class="nav-link" href="${rutaBase}login.html">Iniciar sesión</a></li>
      <li class="nav-item">
        <a class="btn btn-light btn-sm ms-2" href="${rutaBase}registro.html">Registrarme</a>
      </li>
    `

  contenedor.innerHTML = `
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm">
      <div class="container">
        <a class="navbar-brand fw-bold" href="${rutaBase}index.html">
          <i class="bi bi-journal-bookmark-fill"></i> Biblioteca Infantil
        </a>
        <button class="btn boton-tema d-lg-none ms-auto me-2" id="btn-tema-movil" aria-label="Cambiar tema claro/oscuro" type="button">
          <i class="bi bi-moon-stars-fill"></i>
        </button>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menuNav">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="menuNav">
          <ul class="navbar-nav ms-auto align-items-lg-center gap-1">
            ${enlacesSesion}
            <li class="nav-item d-none d-lg-block">
              <button class="btn boton-tema ms-2" id="btn-tema-escritorio" aria-label="Cambiar tema claro/oscuro" type="button">
                <i class="bi bi-moon-stars-fill"></i>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `

  const botonCerrarSesion = document.getElementById('btn-cerrar-sesion')
  if (botonCerrarSesion) {
    botonCerrarSesion.addEventListener('click', async () => {
      await cerrarSesion()
    })
  }

  // Conecta los dos botones de tema (versión escritorio y versión móvil,
  // que se muestran/ocultan según el ancho de pantalla con clases de
  // Bootstrap) a la misma función de alternancia.
  if (typeof inicializarBotonTema === 'function') {
    inicializarBotonTema(document.getElementById('btn-tema-escritorio'))
    inicializarBotonTema(document.getElementById('btn-tema-movil'))
  }
}

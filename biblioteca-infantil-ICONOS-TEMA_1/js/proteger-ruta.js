/* ============================================================================
   PROTECCIÓN DE RUTAS
   ============================================================================
   Se incluye al inicio de las páginas que requieren sesión iniciada
   (biblioteca, perfil, favoritos, libro) o rol de administrador (admin/*).

   Uso en una página normal (requiere estar logueado):
     <script src="js/proteger-ruta.js"></script>
     <script>protegerRuta()</script>

   Uso en una página de admin (requiere rol admin):
     <script src="js/proteger-ruta.js"></script>
     <script>protegerRutaAdmin()</script>

   Nota académica: esta protección evita que un usuario sin sesión vea el
   contenido de la página, pero la seguridad REAL de los datos vive en las
   políticas RLS de Supabase (un usuario no-admin nunca podría leer/escribir
   datos de administrador aunque manipulara este JavaScript en el navegador).
   ========================================================================= */

/**
 * Verifica que haya una sesión activa. Si no la hay, redirige a login.html.
 * Devuelve el perfil del usuario si todo está bien.
 */
async function protegerRuta() {
  const perfil = await obtenerPerfilActual()
  if (!perfil) {
    window.location.href = 'login.html'
    return null
  }
  return perfil
}

/**
 * Verifica que haya sesión Y que el usuario tenga rol "admin".
 * Si no hay sesión, redirige a login. Si hay sesión pero no es admin,
 * redirige a la biblioteca con un aviso.
 */
async function protegerRutaAdmin() {
  const perfil = await obtenerPerfilActual()

  if (!perfil) {
    window.location.href = '../login.html'
    return null
  }

  if (perfil.rol !== 'admin') {
    alert('No tienes permisos de administrador para ver esta página.')
    window.location.href = '../biblioteca.html'
    return null
  }

  return perfil
}

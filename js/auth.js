/* ============================================================================
   FUNCIONES DE AUTENTICACIÓN
   ============================================================================
   Funciones compartidas por todas las páginas que necesitan interactuar
   con Supabase Auth. Requiere que supabase-config.js se cargue ANTES de
   este archivo (define la variable global `cliente`).
   ========================================================================= */

/**
 * Registra un nuevo usuario con email y contraseña.
 * El perfil en la tabla "profiles" se crea automáticamente vía trigger
 * de base de datos (ver supabase/migrations/001_esquema_inicial.sql),
 * que también guarda el año de nacimiento si se envía (ver migración 008).
 */
async function registrarUsuario(email, password, nombreCompleto, anioNacimiento = null) {
  const { data, error } = await cliente.auth.signUp({
    email,
    password,
    options: {
      data: {
        nombre_completo: nombreCompleto,
        ...(anioNacimiento ? { anio_nacimiento: String(anioNacimiento) } : {}),
      },
    },
  })
  return { data, error }
}

/**
 * Inicia sesión con email y contraseña.
 */
async function iniciarSesion(email, password) {
  const { data, error } = await cliente.auth.signInWithPassword({ email, password })
  return { data, error }
}

/**
 * Cierra la sesión del usuario actual y redirige a login.html.
 * Calcula la ruta correcta según la profundidad de la página actual
 * (por ejemplo, desde admin/libros.html debe ir a ../login.html).
 */
async function cerrarSesion() {
  const { error } = await cliente.auth.signOut()
  if (!error) {
    const estaEnSubcarpeta = window.location.pathname.includes('/admin/')
    window.location.href = estaEnSubcarpeta ? '../login.html' : 'login.html'
  }
  return { error }
}

/**
 * Envía un correo de recuperación de contraseña.
 * El enlace del correo redirige a actualizar-password.html
 */
async function enviarRecuperacionPassword(email) {
  const { data, error } = await cliente.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/actualizar-password.html`,
  })
  return { data, error }
}

/**
 * Actualiza la contraseña del usuario (usado tras hacer clic en el enlace
 * de recuperación, cuando Supabase ya generó una sesión temporal).
 */
async function actualizarPassword(nuevaPassword) {
  const { data, error } = await cliente.auth.updateUser({ password: nuevaPassword })
  return { data, error }
}

/**
 * Obtiene la sesión actual (o null si no hay usuario autenticado).
 */
async function obtenerSesionActual() {
  const { data } = await cliente.auth.getSession()
  return data.session
}

/**
 * Obtiene el perfil completo (incluye el rol) del usuario autenticado.
 * Devuelve null si no hay sesión.
 */
async function obtenerPerfilActual() {
  const sesion = await obtenerSesionActual()
  if (!sesion) return null

  const { data, error } = await cliente
    .from('profiles')
    .select('*')
    .eq('id', sesion.user.id)
    .single()

  if (error) {
    console.error('Error al obtener el perfil:', error.message)
    return null
  }
  return data
}

/**
 * Traduce los mensajes de error más comunes de Supabase Auth al español,
 * para mostrar algo entendible al usuario en lugar del mensaje en inglés.
 */
function traducirErrorAuth(mensaje) {
  const traducciones = {
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'User already registered': 'Ya existe una cuenta con este correo.',
    'Email not confirmed': 'Debes confirmar tu correo antes de iniciar sesión.',
    'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
    'New password should be different from the old password.': 'La nueva contraseña debe ser diferente a la anterior.',
    'Auth session missing!': 'Tu enlace de recuperación no es válido o ya expiró.',
    'Email link is invalid or has expired': 'Este enlace ya no es válido. Solicita uno nuevo.',
    'Token has expired or is invalid': 'Este enlace ya no es válido. Solicita uno nuevo.',
  }
  return traducciones[mensaje] || mensaje
}

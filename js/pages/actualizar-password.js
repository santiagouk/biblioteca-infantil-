/* ============================================================================
   LÓGICA DE LA PÁGINA: actualizar-password.html
   ========================================================================= */

let sesionRecuperacionValida = false

/**
 * Muestra el formulario solo si el enlace de recuperación es válido.
 *
 * Supabase puede enviar el enlace de dos formas distintas según la
 * configuración del proyecto:
 *   - Flujo con "code" en la URL (?code=...): hay que canjearlo
 *     explícitamente con exchangeCodeForSession().
 *   - Flujo con tokens en el hash (#access_token=...): supabase-js los
 *     procesa solo al cargar la página (detectSessionInUrl).
 *
 * Para cubrir ambos casos sin asumir cuál está activo, intentamos el
 * canje si hay "code" y, además, esperamos un instante a que aparezca una
 * sesión (evento PASSWORD_RECOVERY o getSession()). Si después de ese
 * margen no hay sesión, el enlace no es válido o ya expiró: se avisa con
 * un mensaje claro en vez de dejar que el usuario intente actualizar su
 * contraseña sin sesión y reciba un error genérico.
 */
async function verificarEnlaceRecuperacion() {
  const avisoVerificando = document.getElementById('aviso-verificando')
  const formulario = document.getElementById('form-actualizar')

  const parametrosUrl = new URLSearchParams(window.location.search)
  const codigo = parametrosUrl.get('code')

  if (codigo) {
    const { error } = await cliente.auth.exchangeCodeForSession(codigo)
    if (error) {
      mostrarEnlaceInvalido(traducirErrorAuth(error.message))
      return
    }
  }

  const sesion = await new Promise((resolve) => {
    let resuelto = false

    const { data: suscripcion } = cliente.auth.onAuthStateChange((evento, sesionRecibida) => {
      if (!resuelto && (evento === 'PASSWORD_RECOVERY' || sesionRecibida)) {
        resuelto = true
        suscripcion.subscription.unsubscribe()
        resolve(sesionRecibida)
      }
    })

    obtenerSesionActual().then((sesionActual) => {
      if (!resuelto && sesionActual) {
        resuelto = true
        suscripcion.subscription.unsubscribe()
        resolve(sesionActual)
      }
    })

    setTimeout(() => {
      if (!resuelto) {
        resuelto = true
        suscripcion.subscription.unsubscribe()
        resolve(null)
      }
    }, 2500)
  })

  if (!sesion) {
    mostrarEnlaceInvalido('Este enlace de recuperación no es válido o ya expiró.')
    return
  }

  sesionRecuperacionValida = true
  avisoVerificando.classList.add('d-none')
  formulario.classList.remove('d-none')
}

function mostrarEnlaceInvalido(mensaje) {
  const avisoVerificando = document.getElementById('aviso-verificando')
  const formulario = document.getElementById('form-actualizar')
  const alertaError = document.getElementById('alerta-error')

  avisoVerificando.classList.add('d-none')
  formulario.classList.add('d-none')
  alertaError.innerHTML = `${mensaje} <a href="recuperar-password.html">Solicita un nuevo enlace</a>.`
  alertaError.classList.remove('d-none')
}

verificarEnlaceRecuperacion()

// Aviso en vivo si las contraseñas dejan de coincidir mientras se escribe
document.addEventListener('DOMContentLoaded', () => {
  const campoPassword = document.getElementById('password')
  const campoPasswordConfirmar = document.getElementById('password-confirmar')

  function revisarCoincidencia() {
    const aviso = document.getElementById('error-password-coincide')
    const coinciden = !campoPasswordConfirmar.value || campoPassword.value === campoPasswordConfirmar.value
    aviso.classList.toggle('d-none', coinciden)
  }
  campoPassword.addEventListener('input', revisarCoincidencia)
  campoPasswordConfirmar.addEventListener('input', revisarCoincidencia)
})

document.getElementById('form-actualizar').addEventListener('submit', async (evento) => {
  evento.preventDefault()

  if (!sesionRecuperacionValida) {
    mostrarEnlaceInvalido('Este enlace de recuperación no es válido o ya expiró.')
    return
  }

  const password = document.getElementById('password').value
  const passwordConfirmar = document.getElementById('password-confirmar').value
  const boton = document.getElementById('btn-actualizar')
  const alertaError = document.getElementById('alerta-error')
  const alertaExito = document.getElementById('alerta-exito')

  alertaError.classList.add('d-none')
  alertaExito.classList.add('d-none')

  if (password !== passwordConfirmar) {
    alertaError.textContent = 'Las contraseñas no coinciden.'
    alertaError.classList.remove('d-none')
    return
  }

  boton.disabled = true
  boton.textContent = 'Actualizando...'

  const { error } = await actualizarPassword(password)

  if (error) {
    alertaError.textContent = traducirErrorAuth(error.message)
    alertaError.classList.remove('d-none')
    boton.disabled = false
    boton.textContent = 'Actualizar contraseña'
    return
  }

  alertaExito.textContent = '¡Contraseña actualizada! Redirigiendo al login...'
  alertaExito.classList.remove('d-none')

  setTimeout(() => {
    window.location.href = 'login.html'
  }, 1500)
})

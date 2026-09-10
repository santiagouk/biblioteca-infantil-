/* ============================================================================
   LÓGICA DE LA PÁGINA: login.html
   ========================================================================= */

document.getElementById('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault()

  const email = document.getElementById('email').value.trim()
  const password = document.getElementById('password').value
  const botonLogin = document.getElementById('btn-login')
  const alertaError = document.getElementById('alerta-error')

  alertaError.classList.add('d-none')
  botonLogin.disabled = true
  botonLogin.textContent = 'Iniciando sesión...'

  const { error } = await iniciarSesion(email, password)

  if (error) {
    alertaError.textContent = traducirErrorAuth(error.message)
    alertaError.classList.remove('d-none')
    botonLogin.disabled = false
    botonLogin.textContent = 'Iniciar sesión'
    return
  }

  // Redirige a la biblioteca tras un login exitoso
  window.location.href = 'biblioteca.html'
})

// Si el usuario ya tiene sesión activa, lo mandamos directo a la biblioteca
;(async () => {
  const sesion = await obtenerSesionActual()
  if (sesion) {
    window.location.href = 'biblioteca.html'
  }
})()

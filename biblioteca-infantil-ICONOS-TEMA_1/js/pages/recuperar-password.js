/* ============================================================================
   LÓGICA DE LA PÁGINA: recuperar-password.html
   ========================================================================= */

document.getElementById('form-recuperar').addEventListener('submit', async (evento) => {
  evento.preventDefault()

  const email = document.getElementById('email').value.trim()
  const boton = document.getElementById('btn-recuperar')
  const alertaError = document.getElementById('alerta-error')
  const alertaExito = document.getElementById('alerta-exito')

  alertaError.classList.add('d-none')
  alertaExito.classList.add('d-none')
  boton.disabled = true
  boton.textContent = 'Enviando...'

  const { error } = await enviarRecuperacionPassword(email)

  if (error) {
    alertaError.textContent = traducirErrorAuth(error.message)
    alertaError.classList.remove('d-none')
    boton.disabled = false
    boton.textContent = 'Enviar enlace de recuperación'
    return
  }

  alertaExito.textContent = 'Revisa tu correo: te enviamos un enlace para restablecer tu contraseña.'
  alertaExito.classList.remove('d-none')
  boton.disabled = false
  boton.textContent = 'Enviar enlace de recuperación'
})

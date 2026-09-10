/* ============================================================================
   LÓGICA DE LA PÁGINA: registro.html
   ========================================================================= */

const ANIO_ACTUAL = new Date().getFullYear()
const ANIO_MINIMO_NACIMIENTO = ANIO_ACTUAL - 120

/**
 * Valida el nombre completo: sin números, solo letras (con acentos/ñ),
 * espacios, apóstrofes y guiones (para nombres compuestos).
 */
function validarNombre(nombre) {
  if (!nombre) return 'Escribe tu nombre completo.'
  if (/\d/.test(nombre)) return 'El nombre no puede contener números.'
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿÑñ' -]+$/.test(nombre)) return 'El nombre solo puede tener letras y espacios.'
  if (nombre.length > 80) return 'El nombre no puede superar 80 caracteres.'
  return null
}

/**
 * Valida el año de nacimiento (campo opcional): si se escribe algo, debe
 * ser un año de 4 dígitos, no futuro, y dentro de un rango de edad humano
 * razonable (hasta 120 años).
 */
function validarAnioNacimiento(texto) {
  if (!texto) return { valor: null, error: null }
  if (!/^\d{4}$/.test(texto)) return { valor: null, error: 'Escribe un año válido de 4 dígitos.' }

  const anio = parseInt(texto, 10)
  if (anio > ANIO_ACTUAL) return { valor: null, error: 'El año de nacimiento no puede ser en el futuro.' }
  if (anio < ANIO_MINIMO_NACIMIENTO) return { valor: null, error: 'Escribe un año de nacimiento válido.' }

  return { valor: anio, error: null }
}

document.addEventListener('DOMContentLoaded', () => {
  const campoNombre = document.getElementById('nombre')
  const campoAnio = document.getElementById('anio-nacimiento')
  const campoPassword = document.getElementById('password')
  const campoPasswordConfirmar = document.getElementById('password-confirmar')

  // Filtra en vivo el año a solo dígitos (igual que en el formulario de libros)
  campoAnio.addEventListener('input', () => {
    campoAnio.value = campoAnio.value.replace(/\D/g, '').slice(0, 4)
  })

  // Aviso en vivo si las contraseñas dejan de coincidir mientras se escribe
  function revisarCoincidenciaPassword() {
    const aviso = document.getElementById('error-password-coincide')
    const coinciden = !campoPasswordConfirmar.value || campoPassword.value === campoPasswordConfirmar.value
    aviso.classList.toggle('d-none', coinciden)
  }
  campoPassword.addEventListener('input', revisarCoincidenciaPassword)
  campoPasswordConfirmar.addEventListener('input', revisarCoincidenciaPassword)

  document.getElementById('form-registro').addEventListener('submit', async (evento) => {
    evento.preventDefault()

    const nombre = campoNombre.value.trim()
    const email = document.getElementById('email').value.trim()
    const password = campoPassword.value
    const passwordConfirmar = campoPasswordConfirmar.value
    const botonRegistro = document.getElementById('btn-registro')
    const alertaError = document.getElementById('alerta-error')
    const alertaExito = document.getElementById('alerta-exito')
    const errorNombre = document.getElementById('error-nombre')
    const errorAnio = document.getElementById('error-anio-nacimiento')

    alertaError.classList.add('d-none')
    alertaExito.classList.add('d-none')
    campoNombre.classList.remove('is-invalid')
    campoAnio.classList.remove('is-invalid')
    errorNombre.textContent = ''
    errorAnio.textContent = ''

    // Validación: nombre completo
    const errorDeNombre = validarNombre(nombre)
    if (errorDeNombre) {
      campoNombre.classList.add('is-invalid')
      errorNombre.textContent = errorDeNombre
      campoNombre.focus()
      return
    }

    // Validación: año de nacimiento (opcional, pero si se escribe debe ser válido)
    const { valor: anioNacimiento, error: errorDeAnio } = validarAnioNacimiento(campoAnio.value.trim())
    if (errorDeAnio) {
      campoAnio.classList.add('is-invalid')
      errorAnio.textContent = errorDeAnio
      campoAnio.focus()
      return
    }

    // Validación: coincidencia de contraseñas
    if (password !== passwordConfirmar) {
      alertaError.textContent = 'Las contraseñas no coinciden.'
      alertaError.classList.remove('d-none')
      return
    }

    botonRegistro.disabled = true
    botonRegistro.textContent = 'Creando cuenta...'

    const { error } = await registrarUsuario(email, password, nombre, anioNacimiento)

    if (error) {
      alertaError.textContent = traducirErrorAuth(error.message)
      alertaError.classList.remove('d-none')
      botonRegistro.disabled = false
      botonRegistro.textContent = 'Crear cuenta'
      return
    }

    alertaExito.textContent = '¡Cuenta creada! Redirigiendo a la biblioteca...'
    alertaExito.classList.remove('d-none')

    setTimeout(() => {
      window.location.href = 'biblioteca.html'
    }, 1500)
  })
})

/* ============================================================================
   SISTEMA DE TEMA CLARO/OSCURO
   ============================================================================
   Gestiona la alternancia entre modo claro y oscuro, persistiendo la
   preferencia en localStorage. El modo oscuro es el diseño original del
   proyecto; el modo claro es una paleta alternativa con buen contraste
   (ver css/estilos.css, bloque :root[data-tema="claro"]).

   Este archivo expone dos funciones:

   1. aplicarTemaGuardado() — debe llamarse lo más temprano posible (idealmente
      en un <script> inline en el <head>, ANTES de cargar el CSS) para evitar
      el "flash" de tema incorrecto al cargar la página. Lee localStorage y
      aplica el atributo data-tema en <html> de inmediato.

   2. inicializarBotonTema(boton) — conecta un botón de la interfaz (icono
      sol/luna) para que alterne el tema al hacer clic. Se llama una vez por
      cada botón de tema presente en la página (puede haber más de uno,
      como en el navbar con versión escritorio/móvil).
   ========================================================================= */

const CLAVE_TEMA = 'biblioteca-infantil-tema'

/**
 * Lee la preferencia guardada (o la del sistema operativo si nunca se
 * eligió ninguna) y la aplica de inmediato como atributo en <html>.
 * Debe llamarse lo antes posible para evitar parpadeos visuales.
 */
function aplicarTemaGuardado() {
  let tema = localStorage.getItem(CLAVE_TEMA)

  if (!tema) {
    const prefiereClaro = window.matchMedia('(prefers-color-scheme: light)').matches
    tema = prefiereClaro ? 'claro' : 'oscuro'
  }

  document.documentElement.setAttribute('data-tema', tema)
}

/**
 * Cambia entre 'claro' y 'oscuro', guarda la elección en localStorage,
 * actualiza el atributo en <html>, y refleja el cambio en todos los
 * botones de tema presentes en la página (puede haber más de uno).
 */
function alternarTema() {
  const temaActual = document.documentElement.getAttribute('data-tema') || 'oscuro'
  const nuevoTema = temaActual === 'oscuro' ? 'claro' : 'oscuro'

  document.documentElement.setAttribute('data-tema', nuevoTema)
  localStorage.setItem(CLAVE_TEMA, nuevoTema)

  actualizarIconosBotonTema(nuevoTema)
}

/**
 * Actualiza el ícono (sol/luna) de todos los botones de tema en la página,
 * según el tema activo.
 */
function actualizarIconosBotonTema(tema) {
  document.querySelectorAll('.boton-tema i').forEach((icono) => {
    icono.className = tema === 'oscuro' ? 'bi bi-moon-stars-fill' : 'bi bi-sun-fill'
  })
}

/**
 * Conecta un botón de tema a la función de alternancia, y deja su ícono
 * sincronizado con el tema actual desde el primer momento. Se puede
 * llamar varias veces (una por cada botón de tema en la página, por
 * ejemplo la versión de escritorio y la versión móvil del navbar).
 */
function inicializarBotonTema(boton) {
  if (!boton) return

  const temaActual = document.documentElement.getAttribute('data-tema') || 'oscuro'
  const icono = boton.querySelector('i')
  if (icono) {
    icono.className = temaActual === 'oscuro' ? 'bi bi-moon-stars-fill' : 'bi bi-sun-fill'
  }

  boton.addEventListener('click', alternarTema)
}

// Aplica el tema guardado de inmediato al cargar este script. Esto es una
// red de seguridad por si alguna página no incluye el script inline en
// el <head> (ver nota en cada .html); si ya se aplicó antes, esta llamada
// no cambia nada visualmente.
aplicarTemaGuardado()

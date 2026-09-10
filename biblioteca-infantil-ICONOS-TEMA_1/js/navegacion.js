/* ============================================================================
   NAVEGACIÓN — BOTÓN DE VOLVER
   ============================================================================
   Si hay historial previo del mismo sitio, usa history.back().
   Si no (llegó directo por URL o marcador), redirige al fallback.
   ========================================================================= */

function volverAtras(fallback) {
  const hayHistorial =
    history.length > 1 &&
    document.referrer &&
    new URL(document.referrer, location.href).origin === location.origin;

  if (hayHistorial) {
    history.back();
  } else {
    window.location.href = fallback;
  }
}

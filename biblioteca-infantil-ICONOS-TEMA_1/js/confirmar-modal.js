/* ============================================================================
   CONFIRMACIÓN CON MODAL DE BOOTSTRAP (reemplaza confirm() nativo)
   ============================================================================
   El navegador muestra confirm() con un diseño genérico ("127.0.0.1:5500
   dice...") que no se puede personalizar. Esta función usa en su lugar el
   modal #modal-confirmar que cada página admin debe incluir en su HTML.

   Requiere que la página tenga este modal en su HTML:
     <div class="modal fade" id="modal-confirmar" ...>...</div>
   (ver admin/usuarios.html para la estructura exacta)

   Uso:
     const confirmado = await confirmarConModal('¿Eliminar este libro?')
     if (confirmado) { ...continuar... }
   ========================================================================= */

function confirmarConModal(mensaje, titulo = 'Confirmar acción') {
  return new Promise((resolve) => {
    const elementoModal = document.getElementById('modal-confirmar')
    const modal = bootstrap.Modal.getOrCreateInstance(elementoModal)
    const botonConfirmar = document.getElementById('btn-confirmar-accion')

    document.getElementById('titulo-modal-confirmar').textContent = titulo
    document.getElementById('mensaje-modal-confirmar').textContent = mensaje

    // Limpia listeners anteriores clonando el botón, para evitar que se
    // acumulen handlers de confirmaciones previas en la misma página.
    const botonNuevo = botonConfirmar.cloneNode(true)
    botonConfirmar.parentNode.replaceChild(botonNuevo, botonConfirmar)

    let resuelto = false

    botonNuevo.addEventListener('click', () => {
      resuelto = true
      modal.hide()
      resolve(true)
    })

    elementoModal.addEventListener(
      'hidden.bs.modal',
      () => {
        if (!resuelto) resolve(false)
      },
      { once: true }
    )

    modal.show()
  })
}

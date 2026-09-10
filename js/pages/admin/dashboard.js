/* ============================================================================
   LÓGICA DE LA PÁGINA: admin/index.html (dashboard)
   ========================================================================= */

/**
 * Cuenta filas de una tabla (usando count en lugar de traer todos los datos).
 */
async function contarFilas(nombreTabla) {
  const { count, error } = await cliente
    .from(nombreTabla)
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error(`Error al contar ${nombreTabla}:`, error.message)
    return 0
  }
  return count || 0
}

document.addEventListener('DOMContentLoaded', async () => {
  const [totalLibros, totalCategorias, totalUsuarios, totalFavoritos] = await Promise.all([
    contarFilas('books'),
    contarFilas('categories'),
    contarFilas('profiles'),
    contarFilas('favorites'),
  ])

  const tarjetas = [
    { etiqueta: 'Libros publicados', valor: totalLibros, icono: 'bi-journals' },
    { etiqueta: 'Categorías', valor: totalCategorias, icono: 'bi-tag-fill' },
    { etiqueta: 'Usuarios registrados', valor: totalUsuarios, icono: 'bi-people-fill' },
    { etiqueta: 'Favoritos guardados', valor: totalFavoritos, icono: 'bi-heart-fill' },
  ]

  document.getElementById('contenedor-estadisticas').innerHTML = tarjetas
    .map(
      (tarjeta) => `
      <div class="col-sm-6 col-md-3">
        <div class="card tarjeta-libro p-4 text-center">
          <div class="fs-2"><i class="bi ${tarjeta.icono}"></i></div>
          <div class="fs-3 fw-bold text-primary">${tarjeta.valor}</div>
          <div class="small text-muted">${tarjeta.etiqueta}</div>
        </div>
      </div>
    `
    )
    .join('')
})

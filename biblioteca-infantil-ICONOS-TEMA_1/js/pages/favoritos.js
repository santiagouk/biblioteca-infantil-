/* ============================================================================
   LÓGICA DE LA PÁGINA: favoritos.html
   ========================================================================= */

const COLORES_TARJETA = ['#00D9C0', '#FF4D6D', '#FFD23F', '#7C3AED']

document.addEventListener('DOMContentLoaded', async () => {
  const perfil = await obtenerPerfilActual()
  const spinner = document.getElementById('spinner-carga')
  const contenedor = document.getElementById('contenedor-favoritos')
  const mensajeSinFavoritos = document.getElementById('mensaje-sin-favoritos')

  if (!perfil) return // protegerRuta() ya redirige, esto es solo defensivo

  const favoritos = await obtenerFavoritosUsuario(perfil.id)
  spinner.classList.add('d-none')

  if (favoritos.length === 0) {
    mensajeSinFavoritos.classList.remove('d-none')
    return
  }

  contenedor.innerHTML = favoritos
    .map((favorito, indice) => {
      const libro = favorito.books
      const colorCategoria = libro.categories?.color || '#6366f1'
      const nombreCategoria = libro.categories?.nombre || 'Sin categoría'
      const portada = libro.portada_url || 'images/portada-default.svg'
      const colorBorde = COLORES_TARJETA[indice % COLORES_TARJETA.length]

      return `
        <div class="col-sm-6 col-md-4 col-lg-3">
          <a href="libro.html?id=${libro.id}" class="text-decoration-none text-dark">
            <div class="card tarjeta-libro h-100" style="--color-tarjeta:${colorBorde};">
              <img src="${portada}" class="portada-libro" alt="Portada de ${libro.titulo}"
                   onerror="this.src='images/portada-default.svg'">
              <div class="card-body">
                <span class="badge badge-edad mb-2" style="background-color:${colorCategoria}">
                  ${nombreCategoria}
                </span>
                <h3 class="h6 mb-1">${libro.titulo}</h3>
                <p class="text-muted small mb-0">${libro.autor}</p>
              </div>
            </div>
          </a>
        </div>
      `
    })
    .join('')
})

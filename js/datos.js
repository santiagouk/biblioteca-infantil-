/* ============================================================================
   FUNCIONES DE ACCESO A DATOS (LIBROS, CATEGORÍAS, FAVORITOS, HISTORIAL)
   ============================================================================
   Requiere que supabase-config.js se cargue antes (variable global `cliente`).
   ========================================================================= */

/**
 * Obtiene todas las categorías, ordenadas alfabéticamente.
 */
async function obtenerCategorias() {
  const { data, error } = await cliente
    .from('categories')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) {
    console.error('Error al obtener categorías:', error.message)
    return []
  }
  return data
}

/**
 * Obtiene libros publicados, con filtros opcionales de búsqueda, categoría
 * y edad recomendada. Incluye el nombre/color de la categoría asociada.
 */
async function obtenerLibros({ busqueda = '', categoriaId = '', edad = '' } = {}) {
  let consulta = cliente
    .from('books')
    .select('*, categories(id, nombre, color, icono)')
    .eq('publicado', true)
    .order('creado_en', { ascending: false })

  if (categoriaId) {
    consulta = consulta.eq('categoria_id', categoriaId)
  }
  if (edad) {
    consulta = consulta.eq('edad_recomendada', edad)
  }
  if (busqueda) {
    // Busca coincidencias parciales en título O autor (insensible a mayúsculas)
    consulta = consulta.or(`titulo.ilike.%${busqueda}%,autor.ilike.%${busqueda}%`)
  }

  const { data, error } = await consulta

  if (error) {
    console.error('Error al obtener libros:', error.message)
    return []
  }
  return data
}

/**
 * Obtiene los libros marcados manualmente como destacados por el admin.
 * Se usa como respaldo de obtenerLibrosRecomendados() cuando todavía no
 * hay suficiente actividad de usuarios (me gusta/lecturas/favoritos) para
 * calcular una recomendación real, o si la función de popularidad falla.
 */
async function obtenerLibrosDestacados() {
  const { data, error } = await cliente
    .from('books')
    .select('*, categories(id, nombre, color, icono)')
    .eq('publicado', true)
    .eq('destacado', true)
    .limit(6)

  if (error) {
    console.error('Error al obtener destacados:', error.message)
    return []
  }
  return data
}

/**
 * Obtiene los libros "Recomendados": llama a la función SQL
 * obtener_libros_recomendados(limite), que ya vive en la base de datos
 * (migración "comentarios_valoraciones") y devuelve los libros publicados
 * ordenados por popularidad (lecturas completadas + me gusta), con
 * respaldo automático a destacados/más recientes cuando aún no hay
 * actividad suficiente — por eso no hace falta repetir esa lógica aquí.
 */
async function obtenerLibrosRecomendados() {
  const { data: libros, error } = await cliente.rpc('obtener_libros_recomendados', { limite: 6 })

  if (error || !libros || libros.length === 0) {
    return obtenerLibrosDestacados()
  }

  // La función devuelve filas de "books" sin la categoría relacionada;
  // se completa con una segunda consulta para que las tarjetas se vean
  // igual que en el resto de la biblioteca (nombre/color de categoría).
  const ids = libros.map((libro) => libro.id)
  const { data: librosConCategoria, error: errorCategoria } = await cliente
    .from('books')
    .select('*, categories(id, nombre, color, icono)')
    .in('id', ids)

  if (errorCategoria || !librosConCategoria) {
    return libros
  }

  // Vuelve a ordenar según el orden de popularidad que ya trae la función
  // (el "in" de Supabase no garantiza el orden de los resultados).
  const mapaLibros = new Map(librosConCategoria.map((libro) => [libro.id, libro]))
  return ids.map((id) => mapaLibros.get(id)).filter(Boolean)
}

/**
 * Obtiene el detalle completo de un libro por su id.
 */
async function obtenerLibroPorId(libroId) {
  const { data, error } = await cliente
    .from('books')
    .select('*, categories(id, nombre, color, icono)')
    .eq('id', libroId)
    .single()

  if (error) {
    console.error('Error al obtener el libro:', error.message)
    return null
  }
  return data
}

/**
 * Verifica si un libro está en los favoritos del usuario actual.
 */
async function esFavorito(usuarioId, libroId) {
  const { data, error } = await cliente
    .from('favorites')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('libro_id', libroId)
    .maybeSingle()

  if (error) {
    console.error('Error al verificar favorito:', error.message)
    return false
  }
  return !!data
}

/**
 * Agrega un libro a favoritos.
 */
async function agregarFavorito(usuarioId, libroId) {
  const { error } = await cliente
    .from('favorites')
    .insert({ usuario_id: usuarioId, libro_id: libroId })
  return { error }
}

/**
 * Quita un libro de favoritos.
 */
async function quitarFavorito(usuarioId, libroId) {
  const { error } = await cliente
    .from('favorites')
    .delete()
    .eq('usuario_id', usuarioId)
    .eq('libro_id', libroId)
  return { error }
}

/**
 * Obtiene la lista de libros favoritos del usuario, con el detalle del libro.
 */
async function obtenerFavoritosUsuario(usuarioId) {
  const { data, error } = await cliente
    .from('favorites')
    .select('id, creado_en, books(*, categories(id, nombre, color, icono))')
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false })

  if (error) {
    console.error('Error al obtener favoritos:', error.message)
    return []
  }
  return data
}

/**
 * Obtiene (o null) el registro de progreso de lectura de un usuario/libro.
 */
async function obtenerProgresoLectura(usuarioId, libroId) {
  const { data, error } = await cliente
    .from('reading_history')
    .select('*')
    .eq('usuario_id', usuarioId)
    .eq('libro_id', libroId)
    .maybeSingle()

  if (error) {
    console.error('Error al obtener progreso de lectura:', error.message)
    return null
  }
  return data
}

/**
 * Crea o actualiza el progreso de lectura ("upsert"): guarda la última
 * página visitada y el porcentaje completado.
 */
async function guardarProgresoLectura(usuarioId, libroId, ultimaPagina, porcentajeCompletado, completado = false) {
  const { error } = await cliente
    .from('reading_history')
    .upsert(
      {
        usuario_id: usuarioId,
        libro_id: libroId,
        ultima_pagina: ultimaPagina,
        porcentaje_completado: porcentajeCompletado,
        completado,
      },
      { onConflict: 'usuario_id,libro_id' }
    )
  return { error }
}

/**
 * Obtiene el historial de lectura del usuario, ordenado por más reciente.
 */
async function obtenerHistorialLectura(usuarioId) {
  const { data, error } = await cliente
    .from('reading_history')
    .select('*, books(*, categories(id, nombre, color, icono))')
    .eq('usuario_id', usuarioId)
    .order('ultima_lectura', { ascending: false })

  if (error) {
    console.error('Error al obtener historial:', error.message)
    return []
  }
  return data
}

/**
 * Obtiene los marcadores de un usuario para un libro específico.
 */
async function obtenerMarcadores(usuarioId, libroId) {
  const { data, error } = await cliente
    .from('bookmarks')
    .select('*')
    .eq('usuario_id', usuarioId)
    .eq('libro_id', libroId)
    .order('pagina', { ascending: true })

  if (error) {
    console.error('Error al obtener marcadores:', error.message)
    return []
  }
  return data
}

/**
 * Crea un nuevo marcador de página.
 */
async function crearMarcador(usuarioId, libroId, pagina, nota = '') {
  const { error } = await cliente
    .from('bookmarks')
    .insert({ usuario_id: usuarioId, libro_id: libroId, pagina, nota })
  return { error }
}

/**
 * Elimina un marcador por su id.
 */
async function eliminarMarcador(marcadorId) {
  const { error } = await cliente
    .from('bookmarks')
    .delete()
    .eq('id', marcadorId)
  return { error }
}

/* ============================================================================
   "ME GUSTA" Y COMENTARIOS DE LIBROS
   ========================================================================= */

/**
 * Cuenta cuántos "me gusta" tiene un libro (de todos los usuarios).
 */
async function obtenerTotalLikes(libroId) {
  const { count, error } = await cliente
    .from('book_likes')
    .select('id', { count: 'exact', head: true })
    .eq('libro_id', libroId)

  if (error) {
    console.error('Error al contar los "me gusta":', error.message)
    return 0
  }
  return count || 0
}

/**
 * Verifica si el usuario actual ya le dio "me gusta" a un libro.
 */
async function usuarioDioLike(usuarioId, libroId) {
  const { data, error } = await cliente
    .from('book_likes')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('libro_id', libroId)
    .maybeSingle()

  if (error) {
    console.error('Error al verificar "me gusta":', error.message)
    return false
  }
  return !!data
}

/**
 * Registra el "me gusta" del usuario actual sobre un libro.
 */
async function darLike(usuarioId, libroId) {
  const { error } = await cliente
    .from('book_likes')
    .insert({ usuario_id: usuarioId, libro_id: libroId })
  return { error }
}

/**
 * Quita el "me gusta" del usuario actual sobre un libro.
 */
async function quitarLike(usuarioId, libroId) {
  const { error } = await cliente
    .from('book_likes')
    .delete()
    .eq('usuario_id', usuarioId)
    .eq('libro_id', libroId)
  return { error }
}

/**
 * Obtiene los comentarios de un libro, del más reciente al más antiguo.
 */
async function obtenerComentariosLibro(libroId) {
  const { data, error } = await cliente
    .from('book_comments')
    .select('*')
    .eq('libro_id', libroId)
    .order('creado_en', { ascending: false })

  if (error) {
    console.error('Error al obtener comentarios:', error.message)
    return []
  }
  return data
}

/**
 * Publica un comentario nuevo. "nombreMostrado" queda guardado como una
 * copia del nombre a mostrar en ese momento (las políticas RLS de
 * "profiles" solo permiten a cada usuario leer su propio perfil, así que
 * no se puede resolver el nombre de otros usuarios con un join).
 */
async function publicarComentario(usuarioId, libroId, nombreMostrado, comentario) {
  const { error } = await cliente
    .from('book_comments')
    .insert({
      usuario_id: usuarioId,
      libro_id: libroId,
      nombre_mostrado: nombreMostrado,
      comentario,
    })
  return { error }
}

/**
 * Elimina un comentario. La política RLS ya exige que sea el autor o un
 * administrador (book_comments_delete_propio / book_comments_delete_admin),
 * así que esta función solo intenta el borrado: si el usuario no tiene
 * permiso, Supabase simplemente no borra nada y no lanza error.
 */
async function eliminarComentario(comentarioId) {
  const { error } = await cliente
    .from('book_comments')
    .delete()
    .eq('id', comentarioId)
  return { error }
}

/**
 * Obtiene una muestra de otros libros publicados (excluyendo uno dado),
 * con los datos necesarios para generar las opciones incorrectas de la
 * actividad "¿Cuánto aprendiste?" en libro.html. Incluye campos opcionales
 * (año, páginas, sinopsis) que pueden no estar diligenciados; el quiz los
 * usa solo cuando están disponibles.
 */
async function obtenerLibrosParaDistractores(idLibroExcluir, limite = 15) {
  const { data, error } = await cliente
    .from('books')
    .select('titulo, autor, numero_paginas, anio_publicacion_original, sinopsis, descripcion, categories(nombre)')
    .eq('publicado', true)
    .neq('id', idLibroExcluir)
    .limit(limite)

  if (error) {
    console.error('Error al obtener libros para la actividad:', error.message)
    return []
  }
  return data
}

/**
 * Devuelve una etiqueta legible para el rango de edad almacenado en la BD.
 */
function etiquetaEdad(rangoEdad) {
  const etiquetas = {
    '3-5': '3 a 5 años',
    '6-8': '6 a 8 años',
    '9-12': '9 a 12 años',
    '13+': '13 años o más',
  }
  return etiquetas[rangoEdad] || rangoEdad
}

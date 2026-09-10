/* ============================================================================
   FUNCIONES DE ACCESO A DATOS — FORO DE POEMAS Y SISTEMA DE CRÉDITOS
   ============================================================================
   Requiere que supabase-config.js se cargue antes (variable global `cliente`).
   Sigue el mismo estilo y convenciones que js/datos.js.
   ========================================================================= */

/* ----------------------------------------------------------------------------
   POEMAS
   ---------------------------------------------------------------------------- */

/**
 * Obtiene los poemas del foro (con sus estadísticas de likes/calificación
 * ya calculadas por la vista poemas_con_estadisticas), con búsqueda y
 * orden opcionales.
 *
 * orden: 'recientes' (por defecto), 'populares' (más "me gusta") o
 * 'valorados' (mejor calificación promedio, desempatando por cantidad de
 * calificaciones para que un solo 5★ no le gane a un poema con muchas).
 */
async function obtenerPoemas({ busqueda = '', orden = 'recientes' } = {}) {
  let consulta = cliente.from('poemas_con_estadisticas').select('*')

  if (busqueda) {
    consulta = consulta.or(
      `titulo.ilike.%${busqueda}%,contenido.ilike.%${busqueda}%,nombre_autor.ilike.%${busqueda}%`
    )
  }

  if (orden === 'populares') {
    consulta = consulta.order('total_likes', { ascending: false }).order('creado_en', { ascending: false })
  } else if (orden === 'valorados') {
    consulta = consulta
      .order('promedio_estrellas', { ascending: false })
      .order('total_calificaciones', { ascending: false })
  } else {
    consulta = consulta.order('creado_en', { ascending: false })
  }

  const { data, error } = await consulta

  if (error) {
    console.error('Error al obtener poemas:', error.message)
    return []
  }
  return data
}

/**
 * Obtiene un poema por su id (con estadísticas incluidas).
 */
async function obtenerPoemaPorId(poemaId) {
  const { data, error } = await cliente
    .from('poemas_con_estadisticas')
    .select('*')
    .eq('id', poemaId)
    .single()

  if (error) {
    console.error('Error al obtener el poema:', error.message)
    return null
  }
  return data
}

/**
 * Publica un poema nuevo.
 */
async function publicarPoema(usuarioId, titulo, contenido, nombreAutor) {
  const { data, error } = await cliente
    .from('poems')
    .insert({ usuario_id: usuarioId, titulo, contenido, nombre_autor: nombreAutor })
    .select()
    .single()
  return { data, error }
}

/**
 * Actualiza un poema propio. La política RLS ya exige que sea el autor
 * (poems_update_propio), así que esta función solo intenta la edición.
 */
async function actualizarPoema(poemaId, titulo, contenido, nombreAutor) {
  const { error } = await cliente
    .from('poems')
    .update({ titulo, contenido, nombre_autor: nombreAutor })
    .eq('id', poemaId)
  return { error }
}

/**
 * Elimina un poema. La política RLS exige que sea el autor o un
 * admin/moderador (poems_delete_propio / poems_delete_moderacion).
 */
async function eliminarPoema(poemaId) {
  const { error } = await cliente.from('poems').delete().eq('id', poemaId)
  return { error }
}

/* ----------------------------------------------------------------------------
   CALIFICACIÓN POR ESTRELLAS
   ---------------------------------------------------------------------------- */

/**
 * Obtiene la calificación que el usuario actual ya le dio a un poema
 * (o null si todavía no lo ha calificado).
 */
async function obtenerCalificacionUsuario(usuarioId, poemaId) {
  const { data, error } = await cliente
    .from('poem_ratings')
    .select('estrellas')
    .eq('usuario_id', usuarioId)
    .eq('poema_id', poemaId)
    .maybeSingle()

  if (error) {
    console.error('Error al obtener la calificación:', error.message)
    return null
  }
  return data ? data.estrellas : null
}

/**
 * Registra o actualiza la calificación (1 a 5 estrellas) del usuario
 * actual sobre un poema. La restricción UNIQUE (poema_id, usuario_id) en
 * la base de datos garantiza que nunca haya más de una por usuario.
 */
async function calificarPoema(usuarioId, poemaId, estrellas, yaCalificado) {
  if (yaCalificado) {
    const { error } = await cliente
      .from('poem_ratings')
      .update({ estrellas })
      .eq('usuario_id', usuarioId)
      .eq('poema_id', poemaId)
    return { error }
  }
  const { error } = await cliente
    .from('poem_ratings')
    .insert({ usuario_id: usuarioId, poema_id: poemaId, estrellas })
  return { error }
}

/* ----------------------------------------------------------------------------
   "ME GUSTA" DE POEMAS
   ---------------------------------------------------------------------------- */

/**
 * Verifica si el usuario actual ya le dio "me gusta" a un poema.
 */
async function usuarioDioLikePoema(usuarioId, poemaId) {
  const { data, error } = await cliente
    .from('poem_likes')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('poema_id', poemaId)
    .maybeSingle()

  if (error) {
    console.error('Error al verificar "me gusta" del poema:', error.message)
    return false
  }
  return !!data
}

/**
 * Registra el "me gusta" del usuario actual sobre un poema.
 */
async function darLikePoema(usuarioId, poemaId) {
  const { error } = await cliente
    .from('poem_likes')
    .insert({ usuario_id: usuarioId, poema_id: poemaId })
  return { error }
}

/**
 * Quita el "me gusta" del usuario actual sobre un poema.
 */
async function quitarLikePoema(usuarioId, poemaId) {
  const { error } = await cliente
    .from('poem_likes')
    .delete()
    .eq('usuario_id', usuarioId)
    .eq('poema_id', poemaId)
  return { error }
}

/* ----------------------------------------------------------------------------
   REPORTES
   ---------------------------------------------------------------------------- */

/**
 * Reporta un poema. La restricción UNIQUE (poema_id, usuario_id) evita que
 * el mismo usuario reporte dos veces el mismo poema.
 */
async function reportarPoema(usuarioId, poemaId, motivo) {
  const { error } = await cliente
    .from('poem_reports')
    .insert({ usuario_id: usuarioId, poema_id: poemaId, motivo })
  return { error }
}

/* ----------------------------------------------------------------------------
   ESTADÍSTICAS Y CRÉDITOS DEL USUARIO (para el perfil)
   ---------------------------------------------------------------------------- */

/**
 * Obtiene las estadísticas acumuladas de un usuario en el foro (total de
 * poemas publicados, total de "me gusta" recibidos, calificación promedio
 * de sus poemas), vía la vista estadisticas_poemas_usuario.
 */
async function obtenerEstadisticasPoemasUsuario(usuarioId) {
  const { data, error } = await cliente
    .from('estadisticas_poemas_usuario')
    .select('*')
    .eq('usuario_id', usuarioId)
    .maybeSingle()

  if (error) {
    console.error('Error al obtener estadísticas del usuario:', error.message)
    return null
  }
  return data || { total_poemas: 0, total_likes_recibidos: 0, promedio_calificacion: 0 }
}

/**
 * Obtiene el historial de créditos (ganados y gastados) de un usuario,
 * del más reciente al más antiguo.
 */
async function obtenerHistorialCreditos(usuarioId, limite = 20) {
  const { data, error } = await cliente
    .from('credit_transactions')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false })
    .limit(limite)

  if (error) {
    console.error('Error al obtener el historial de créditos:', error.message)
    return []
  }
  return data
}

/* ----------------------------------------------------------------------------
   LIBROS VIP
   ---------------------------------------------------------------------------- */

/**
 * Obtiene los libros VIP que un usuario ya desbloqueó, con el detalle del
 * libro incluido.
 */
async function obtenerLibrosVipDesbloqueados(usuarioId) {
  const { data, error } = await cliente
    .from('unlocked_vip_books')
    .select('id, creado_en, creditos_pagados, books(*, categories(id, nombre, color, icono))')
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false })

  if (error) {
    console.error('Error al obtener libros VIP desbloqueados:', error.message)
    return []
  }
  return data
}

/**
 * Verifica si un usuario ya desbloqueó un libro VIP en particular.
 */
async function usuarioDesbloqueoLibroVip(usuarioId, libroId) {
  const { data, error } = await cliente
    .from('unlocked_vip_books')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('libro_id', libroId)
    .maybeSingle()

  if (error) {
    console.error('Error al verificar desbloqueo de libro VIP:', error.message)
    return false
  }
  return !!data
}

/**
 * Canjea créditos del usuario actual por acceso a un libro VIP, mediante
 * la función de base de datos canjear_libro_vip(), que valida todo del
 * lado del servidor (saldo suficiente, que el libro sea VIP, que no esté
 * ya desbloqueado) y descuenta los créditos de forma atómica.
 * Devuelve { exito, mensaje, creditos_restantes } o un error de red.
 */
async function canjearLibroVip(libroId) {
  const { data, error } = await cliente.rpc('canjear_libro_vip', { p_libro_id: libroId })

  if (error) {
    console.error('Error al canjear el libro VIP:', error.message)
    return { exito: false, mensaje: 'No pudimos procesar el canje. Intenta de nuevo.', creditos_restantes: null }
  }
  // rpc() a una función que RETURNS TABLE devuelve un arreglo de una fila.
  return data && data[0] ? data[0] : { exito: false, mensaje: 'Respuesta inesperada del servidor.', creditos_restantes: null }
}

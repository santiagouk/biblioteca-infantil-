/* ============================================================================
   FUNCIONES DE DATOS PARA EL PANEL DE ADMINISTRADOR
   ============================================================================
   CRUD de libros, categorías, usuarios, y subida de archivos a Storage.
   La protección real contra usuarios no-admin vive en las políticas RLS de
   Supabase; estas funciones simplemente intentan la operación y devuelven
   el error si la base de datos la rechaza.
   ========================================================================= */

/**
 * Obtiene TODOS los libros (publicados y no publicados) para el admin,
 * con su categoría asociada.
 */
async function obtenerTodosLosLibrosAdmin() {
  const { data, error } = await cliente
    .from('books')
    .select('*, categories(id, nombre, color)')
    .order('creado_en', { ascending: false })

  if (error) {
    console.error('Error al obtener libros (admin):', error.message)
    return []
  }
  return data
}

/**
 * Crea un nuevo libro.
 */
async function crearLibro(libro) {
  const { data, error } = await cliente.from('books').insert(libro).select().single()
  return { data, error }
}

/**
 * Actualiza un libro existente.
 */
async function actualizarLibro(libroId, cambios) {
  const { error } = await cliente.from('books').update(cambios).eq('id', libroId)
  return { error }
}

/**
 * Elimina un libro.
 */
async function eliminarLibro(libroId) {
  const { error } = await cliente.from('books').delete().eq('id', libroId)
  return { error }
}

/**
 * Busca autores ya existentes en el catálogo cuyo nombre coincida con el
 * texto escrito (usado por el buscador de autores del formulario de
 * libros). Devuelve nombres de autor únicos, sin duplicados, con el
 * conteo de libros que ya tiene cada uno.
 */
async function buscarAutores(texto) {
  if (!texto || texto.trim().length < 2) return []

  const { data, error } = await cliente
    .from('books')
    .select('autor')
    .ilike('autor', `%${texto.trim()}%`)
    .limit(50)

  if (error) {
    console.error('Error al buscar autores:', error.message)
    return []
  }

  const conteo = new Map()
  data.forEach(({ autor }) => conteo.set(autor, (conteo.get(autor) || 0) + 1))

  return [...conteo.entries()]
    .map(([autor, totalLibros]) => ({ autor, totalLibros }))
    .sort((a, b) => a.autor.localeCompare(b.autor))
    .slice(0, 8)
}

/**
 * Obtiene los libros ya registrados de un autor (para mostrar "otros
 * libros de este autor" al elegirlo en el formulario). Excluye
 * opcionalmente el libro que se está editando, para no mostrarse a sí
 * mismo en la lista.
 */
async function obtenerLibrosPorAutor(autor, idExcluir = null) {
  let consulta = cliente
    .from('books')
    .select('id, titulo, portada_url')
    .eq('autor', autor)
    .order('creado_en', { ascending: false })
    .limit(6)

  if (idExcluir) consulta = consulta.neq('id', idExcluir)

  const { data, error } = await consulta
  if (error) {
    console.error('Error al obtener libros del autor:', error.message)
    return []
  }
  return data
}

/**
 * Crea una nueva categoría.
 */
async function crearCategoria(categoria) {
  const { data, error } = await cliente.from('categories').insert(categoria).select().single()
  return { data, error }
}

/**
 * Actualiza una categoría existente.
 */
async function actualizarCategoria(categoriaId, cambios) {
  const { error } = await cliente.from('categories').update(cambios).eq('id', categoriaId)
  return { error }
}

/**
 * Elimina una categoría.
 */
async function eliminarCategoria(categoriaId) {
  const { error } = await cliente.from('categories').delete().eq('id', categoriaId)
  return { error }
}

/**
 * Obtiene todos los perfiles de usuario (para la gestión de usuarios).
 */
async function obtenerTodosLosUsuarios() {
  const { data, error } = await cliente
    .from('profiles')
    .select('*')
    .order('creado_en', { ascending: false })

  if (error) {
    console.error('Error al obtener usuarios:', error.message)
    return []
  }
  return data
}

/**
 * Cambia el rol de un usuario ('admin' o 'usuario').
 * Solo funcionará si quien ejecuta esto ya es admin (lo valida RLS).
 */
async function cambiarRolUsuario(usuarioId, nuevoRol) {
  const { error } = await cliente
    .from('profiles')
    .update({ rol: nuevoRol })
    .eq('id', usuarioId)
  return { error }
}

/**
 * Elimina el perfil de un usuario.
 * Nota: esto NO elimina la cuenta de auth.users (eso requeriría la
 * service_role key desde un backend, que este proyecto no usa). Para un
 * borrado completo de cuenta, hazlo manualmente desde el dashboard de
 * Supabase → Authentication → Users.
 */
async function eliminarPerfilUsuario(usuarioId) {
  const { error } = await cliente.from('profiles').delete().eq('id', usuarioId)
  return { error }
}

/**
 * Sube un archivo a un bucket de Storage y devuelve su URL pública.
 * bucket: 'portadas' o 'libros-pdf'
 */
async function subirArchivo(bucket, archivo) {
  const nombreArchivo = `${Date.now()}-${archivo.name.replace(/\s+/g, '-')}`

  const { error: errorSubida } = await cliente.storage
    .from(bucket)
    .upload(nombreArchivo, archivo)

  if (errorSubida) {
    return { url: null, error: errorSubida }
  }

  const { data } = cliente.storage.from(bucket).getPublicUrl(nombreArchivo)
  return { url: data.publicUrl, error: null }
}

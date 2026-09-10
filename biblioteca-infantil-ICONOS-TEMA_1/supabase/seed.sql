-- ============================================================================
-- SEED: DATOS DE EJEMPLO PARA DESARROLLO
-- Biblioteca Virtual Infantil
-- ============================================================================
-- Este archivo NO se ejecuta automáticamente con las migraciones.
-- Para usarlo: supabase db reset  (lo ejecuta tras las migraciones)
-- o pégalo manualmente en el SQL Editor de Supabase después de crear
-- al menos un usuario administrador.
--
-- IMPORTANTE: Los archivos PDF y portadas de este seed usan URLs de ejemplo.
-- Reemplázalas subiendo tus propios archivos desde el panel admin, o usa
-- libros reales de Project Gutenberg (https://www.gutenberg.org) que ya
-- estén en dominio público.
-- ============================================================================

-- Categorías de ejemplo
insert into public.categories (nombre, descripcion, icono, color) values
  ('Fábulas', 'Historias breves con enseñanzas y moralejas', 'feather', '#f97316'),
  ('Aventura', 'Historias llenas de viajes y descubrimientos', 'compass', '#6366f1'),
  ('Cuentos clásicos', 'Cuentos tradicionales conocidos por todos', 'book-open', '#22c55e'),
  ('Ciencia y naturaleza', 'Libros para aprender sobre el mundo que nos rodea', 'leaf', '#0ea5e9'),
  ('Poesía infantil', 'Versos y rimas para los más pequeños', 'music', '#ec4899')
on conflict (nombre) do nothing;

-- Nota: la tabla "books" requiere creado_por (id de un perfil admin existente).
-- Sustituye 'TU_ID_DE_ADMIN_AQUI' por el UUID real de tu usuario administrador
-- antes de ejecutar este bloque, o coméntalo y agrega libros desde el panel admin.

-- Ejemplo comentado:
--
-- insert into public.books (
--   titulo, autor, descripcion, categoria_id, edad_recomendada,
--   portada_url, archivo_pdf_url, destacado, fuente_dominio_publico,
--   anio_publicacion_original, creado_por
-- ) values (
--   'Fábulas de Esopo',
--   'Esopo',
--   'Una colección de fábulas clásicas con enseñanzas morales para niños.',
--   (select id from public.categories where nombre = 'Fábulas'),
--   '6-8',
--   'https://tu-proyecto.supabase.co/storage/v1/object/public/portadas/esopo.jpg',
--   'https://tu-proyecto.supabase.co/storage/v1/object/public/libros-pdf/esopo.pdf',
--   true,
--   'Project Gutenberg',
--   1894,
--   'TU_ID_DE_ADMIN_AQUI'
-- );

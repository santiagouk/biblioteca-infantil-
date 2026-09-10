-- ============================================================================
-- MIGRACIÓN 004: "ME GUSTA", COMENTARIOS Y RECOMENDACIONES
-- Biblioteca Virtual Infantil
-- ============================================================================
-- NOTA: este archivo documenta el esquema tal como quedó aplicado
-- directamente en el SQL Editor del dashboard de Supabase (nombre real de
-- la migración en el historial: "comentarios_valoraciones", aplicada el
-- 2026-08-22). Se agrega aquí para que la carpeta migrations/ siga siendo
-- la fuente de verdad del esquema real del proyecto. Si tu base de datos
-- ya tiene estas tablas, NO ejecutes este archivo (fallaría con "la
-- relación ya existe"); si estás partiendo de cero, sí puedes ejecutarlo
-- normalmente después de 001/002/003.
--
-- Agrega:
--   - Tabla "book_likes": un usuario puede marcar "me gusta" en un libro
--     (1 por usuario/libro, se puede quitar).
--   - Tabla "book_comments": comentarios cortos de los usuarios sobre un
--     libro. Guarda una copia del nombre a mostrar en el momento de
--     publicar (nombre_mostrado) para no depender de leer el perfil de
--     otros usuarios, ya que las políticas RLS de "profiles" solo
--     permiten a cada usuario ver su propio perfil (ver 002_politicas_rls.sql).
--   - Función "obtener_libros_recomendados(limite)": devuelve libros
--     publicados completos (no solo IDs), ordenados por popularidad
--     (lecturas completadas × 2 + me gusta), con respaldo automático a
--     destacados/más recientes cuando aún no hay actividad suficiente.
--     Usa "security definer" (igual que "es_admin()" y "handle_new_user()"
--     en 001/002) porque "reading_history" es privado por usuario: la
--     función puede sumar el total de todos los usuarios sin exponer las
--     filas individuales de nadie, ya que solo devuelve el conteo agregado.
--     Se usa desde js/datos.js → obtenerLibrosRecomendados(), que arma la
--     sección "Recomendados" de biblioteca.html.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLA: book_likes
-- ----------------------------------------------------------------------------

create table public.book_likes (
  id uuid primary key default uuid_generate_v4(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  libro_id uuid not null references public.books(id) on delete cascade,
  creado_en timestamptz not null default now(),
  unique (usuario_id, libro_id)
);

comment on table public.book_likes is '"Me gusta" de un usuario sobre un libro, usado en la sección de valoración y para calcular libros recomendados';

-- ----------------------------------------------------------------------------
-- TABLA: book_comments
-- ----------------------------------------------------------------------------

create table public.book_comments (
  id uuid primary key default uuid_generate_v4(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  libro_id uuid not null references public.books(id) on delete cascade,
  nombre_mostrado text not null,
  comentario text not null check (char_length(btrim(comentario)) >= 1 and char_length(comentario) <= 500),
  creado_en timestamptz not null default now()
);

comment on table public.book_comments is 'Comentarios de usuarios sobre un libro, mostrados en la sección "¿Qué te pareció este libro?"';

-- ----------------------------------------------------------------------------
-- RLS: book_likes
-- ----------------------------------------------------------------------------

alter table public.book_likes enable row level security;

-- Cualquier usuario autenticado puede ver todos los "me gusta" (para poder
-- mostrar el conteo total por libro; no es información sensible).
create policy "book_likes_select_autenticado"
  on public.book_likes for select
  to authenticated
  using (true);

create policy "book_likes_insert_propio"
  on public.book_likes for insert
  with check (auth.uid() = usuario_id);

create policy "book_likes_delete_propio"
  on public.book_likes for delete
  using (auth.uid() = usuario_id);

-- ----------------------------------------------------------------------------
-- RLS: book_comments
-- ----------------------------------------------------------------------------

alter table public.book_comments enable row level security;

-- Cualquier usuario autenticado puede leer todos los comentarios (son
-- públicos dentro de la biblioteca, como en un muro de opiniones).
create policy "book_comments_select_autenticado"
  on public.book_comments for select
  to authenticated
  using (true);

create policy "book_comments_insert_propio"
  on public.book_comments for insert
  with check (auth.uid() = usuario_id);

-- Un usuario puede borrar su propio comentario; un administrador puede
-- borrar cualquiera (moderación básica).
create policy "book_comments_delete_propio"
  on public.book_comments for delete
  using (auth.uid() = usuario_id);

create policy "book_comments_delete_admin"
  on public.book_comments for delete
  using (public.es_admin());

-- ----------------------------------------------------------------------------
-- FUNCIÓN: obtener_libros_recomendados(limite)
-- ----------------------------------------------------------------------------

create or replace function public.obtener_libros_recomendados(limite integer default 6)
returns setof books
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  return query
    select b.*
    from public.books b
    left join (
      select libro_id, count(*)::int as total
      from public.book_likes
      group by libro_id
    ) l on l.libro_id = b.id
    left join (
      select libro_id, count(*)::int as total
      from public.reading_history
      where completado = true
      group by libro_id
    ) h on h.libro_id = b.id
    where b.publicado = true
    order by
      (coalesce(h.total, 0) * 2 + coalesce(l.total, 0)) desc,
      b.destacado desc,
      b.creado_en desc
    limit limite;
end;
$function$;

comment on function public.obtener_libros_recomendados(integer) is 'Libros publicados ordenados por popularidad (lecturas completadas + me gusta), con respaldo a destacados/recientes. Usado por la sección "Recomendados"';

grant execute on function public.obtener_libros_recomendados(integer) to authenticated;

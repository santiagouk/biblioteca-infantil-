-- ============================================================================
-- MIGRACIÓN 005: FUNCIÓN DE POPULARIDAD PARA "RECOMENDADOS"
-- ============================================================================
-- NOTA: esta función fue creada y luego eliminada en la migración 006 (ver
-- ese archivo para la explicación). Se documenta aquí solo para que el
-- historial local coincida exactamente con el historial real aplicado en
-- Supabase. No hace falta ejecutarla en un proyecto nuevo.
-- ============================================================================
-- Las tablas book_likes y book_comments ya existen (migración
-- "comentarios_valoraciones", aplicada el 2026-08-22 directo desde el SQL
-- Editor del dashboard). Esta migración solo agrega la función que falta:
-- el cálculo de popularidad usado por la sección "Recomendados" de
-- biblioteca.html.
--
-- Es "security definer" (igual que "es_admin()" y "handle_new_user()") porque
-- "reading_history" y "favorites" son privados por usuario: la función puede
-- sumar el total de todos los usuarios sin exponer las filas individuales de
-- nadie, ya que solo devuelve el conteo agregado.
-- ============================================================================

create or replace function public.obtener_libros_populares()
returns table (
  id uuid,
  total_likes integer,
  total_lecturas integer,
  total_favoritos integer,
  puntaje_popularidad integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.id,
    coalesce(l.total_likes, 0)::int as total_likes,
    coalesce(rh.total_lecturas, 0)::int as total_lecturas,
    coalesce(f.total_favoritos, 0)::int as total_favoritos,
    (
      coalesce(l.total_likes, 0) * 3
      + coalesce(rh.total_lecturas, 0) * 2
      + coalesce(f.total_favoritos, 0)
    )::int as puntaje_popularidad
  from public.books b
  left join (
    select libro_id, count(*) as total_likes
    from public.book_likes
    group by libro_id
  ) l on l.libro_id = b.id
  left join (
    select libro_id, count(*) as total_lecturas
    from public.reading_history
    group by libro_id
  ) rh on rh.libro_id = b.id
  left join (
    select libro_id, count(*) as total_favoritos
    from public.favorites
    group by libro_id
  ) f on f.libro_id = b.id
  where b.publicado = true;
$$;

comment on function public.obtener_libros_populares() is 'Puntaje de popularidad por libro (me gusta + lecturas + favoritos) para la sección "Recomendados"';

grant execute on function public.obtener_libros_populares() to authenticated;

/* ============================================================================
   MIGRACIÓN 009 — FORO DE POEMAS
   ============================================================================
   Nota: esta migración documenta el esquema del Foro de Poemas tal como ya
   quedó aplicado en producción (proyecto pbkbqggeaquncsmuykec) mediante el
   SQL Editor del dashboard, siguiendo el mismo patrón ya usado en el
   proyecto (ver 004_comentarios_valoraciones.sql). Se reconstruyó leyendo
   el esquema real vía el MCP de Supabase antes de conectar el frontend,
   para no duplicar tablas ni funciones con nombres distintos.

   Contenido:
     - Tabla poems (poemas publicados por usuarios)
     - Tabla poem_ratings (calificación de 1 a 5 estrellas, una por usuario/poema)
     - Tabla poem_likes ("me gusta", uno por usuario/poema)
     - Tabla poem_reports (reportes de moderación)
     - Función bloquear_autointeraccion_poema(): impide que el autor se dé
       like/calificación a sí mismo
     - Vistas de agregación: poemas_con_estadisticas y
       estadisticas_poemas_usuario
   ========================================================================= */

/* ----------------------------------------------------------------------------
   TABLAS
   ---------------------------------------------------------------------------- */

create table if not exists public.poems (
  id uuid primary key default extensions.uuid_generate_v4(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) >= 1 and char_length(btrim(titulo)) <= 150),
  contenido text not null check (char_length(btrim(contenido)) >= 1 and char_length(btrim(contenido)) <= 5000),
  nombre_autor text not null check (char_length(btrim(nombre_autor)) >= 1 and char_length(btrim(nombre_autor)) <= 100),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
comment on table public.poems is 'Poemas publicados por usuarios en el Foro de Poemas';

create index if not exists idx_poems_usuario on public.poems (usuario_id);
create index if not exists idx_poems_creado on public.poems (creado_en desc);

create table if not exists public.poem_ratings (
  id uuid primary key default extensions.uuid_generate_v4(),
  poema_id uuid not null references public.poems(id) on delete cascade,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  estrellas smallint not null check (estrellas >= 1 and estrellas <= 5),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (poema_id, usuario_id)
);
comment on table public.poem_ratings is 'Calificación de 1 a 5 estrellas de un usuario sobre un poema (una por usuario/poema)';

create table if not exists public.poem_likes (
  id uuid primary key default extensions.uuid_generate_v4(),
  poema_id uuid not null references public.poems(id) on delete cascade,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  creado_en timestamptz not null default now(),
  unique (poema_id, usuario_id)
);
comment on table public.poem_likes is '"Me gusta" de un usuario sobre un poema';

create table if not exists public.poem_reports (
  id uuid primary key default extensions.uuid_generate_v4(),
  poema_id uuid not null references public.poems(id) on delete cascade,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  motivo text not null check (char_length(btrim(motivo)) >= 1 and char_length(btrim(motivo)) <= 300),
  creado_en timestamptz not null default now(),
  unique (poema_id, usuario_id)
);
comment on table public.poem_reports is 'Reportes de usuarios sobre poemas inapropiados, visibles solo para admin/moderador';

/* ----------------------------------------------------------------------------
   BLOQUEO DE AUTOINTERACCIÓN
   ----------------------------------------------------------------------------
   Un usuario no puede darse "me gusta" ni calificarse a sí mismo (evita
   generar créditos infinitos con su propio poema).
   ---------------------------------------------------------------------------- */

create or replace function public.bloquear_autointeraccion_poema()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  autor_poema uuid;
begin
  select usuario_id into autor_poema from public.poems where id = new.poema_id;
  if autor_poema = new.usuario_id then
    raise exception 'No puedes interactuar con tu propio poema de esta forma.';
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_bloquear_autolike on public.poem_likes;
create trigger trigger_bloquear_autolike
  before insert on public.poem_likes
  for each row execute function public.bloquear_autointeraccion_poema();

drop trigger if exists trigger_bloquear_autocalificacion on public.poem_ratings;
create trigger trigger_bloquear_autocalificacion
  before insert on public.poem_ratings
  for each row execute function public.bloquear_autointeraccion_poema();

/* ----------------------------------------------------------------------------
   RLS
   ---------------------------------------------------------------------------- */

alter table public.poems enable row level security;
alter table public.poem_ratings enable row level security;
alter table public.poem_likes enable row level security;
alter table public.poem_reports enable row level security;

-- poems: cualquier usuario autenticado puede leer; solo el autor puede
-- crear a su propio nombre; el autor puede editar/borrar lo suyo; un
-- admin o moderador puede borrar cualquier poema (moderación).
create policy poems_select_autenticado on public.poems
  for select to authenticated using (true);
create policy poems_insert_propio on public.poems
  for insert with check (auth.uid() = usuario_id);
create policy poems_update_propio on public.poems
  for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy poems_delete_propio on public.poems
  for delete using (auth.uid() = usuario_id);
create policy poems_delete_moderacion on public.poems
  for delete using (public.es_moderador_o_admin());

-- poem_ratings: lectura abierta (para calcular promedios); un usuario solo
-- puede insertar/actualizar SU PROPIA calificación (no puede borrarla, solo
-- cambiarla, para evitar que "resetee" créditos ya otorgados a voluntad).
create policy poem_ratings_select_autenticado on public.poem_ratings
  for select to authenticated using (true);
create policy poem_ratings_insert_propio on public.poem_ratings
  for insert with check (auth.uid() = usuario_id);
create policy poem_ratings_update_propio on public.poem_ratings
  for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- poem_likes: lectura abierta; insertar/borrar solo el propio "me gusta".
create policy poem_likes_select_autenticado on public.poem_likes
  for select to authenticated using (true);
create policy poem_likes_insert_propio on public.poem_likes
  for insert with check (auth.uid() = usuario_id);
create policy poem_likes_delete_propio on public.poem_likes
  for delete using (auth.uid() = usuario_id);

-- poem_reports: solo el propio usuario puede reportar; solo admin/moderador
-- puede ver y resolver (borrar) los reportes.
create policy poem_reports_insert_propio on public.poem_reports
  for insert with check (auth.uid() = usuario_id);
create policy poem_reports_select_moderacion on public.poem_reports
  for select using (public.es_moderador_o_admin());
create policy poem_reports_delete_moderacion on public.poem_reports
  for delete using (public.es_moderador_o_admin());

/* ----------------------------------------------------------------------------
   VISTAS DE AGREGACIÓN
   ----------------------------------------------------------------------------
   Evitan recalcular en cada consulta desde el frontend el total de likes,
   total de calificaciones y promedio de estrellas de cada poema, y las
   estadísticas acumuladas por usuario que se muestran en el perfil.
   ---------------------------------------------------------------------------- */

create or replace view public.poemas_con_estadisticas as
select
  p.id,
  p.usuario_id,
  p.titulo,
  p.contenido,
  p.nombre_autor,
  p.creado_en,
  p.actualizado_en,
  coalesce(l.total_likes, 0)::int as total_likes,
  coalesce(r.total_calificaciones, 0)::int as total_calificaciones,
  coalesce(r.promedio_estrellas, 0)::numeric(3,2) as promedio_estrellas
from public.poems p
left join (
  select poema_id, count(*) as total_likes
  from public.poem_likes group by poema_id
) l on l.poema_id = p.id
left join (
  select poema_id, count(*) as total_calificaciones, avg(estrellas) as promedio_estrellas
  from public.poem_ratings group by poema_id
) r on r.poema_id = p.id;

create or replace view public.estadisticas_poemas_usuario as
select
  p.usuario_id,
  count(*)::int as total_poemas,
  coalesce(sum(pe.total_likes), 0)::int as total_likes_recibidos,
  coalesce(avg(pe.promedio_estrellas) filter (where pe.total_calificaciones > 0), 0)::numeric(3,2) as promedio_calificacion
from public.poems p
left join public.poemas_con_estadisticas pe on pe.id = p.id
group by p.usuario_id;

-- ============================================================================
-- MIGRACIÓN 002: POLÍTICAS DE SEGURIDAD (ROW LEVEL SECURITY)
-- Biblioteca Virtual Infantil
-- ============================================================================
-- Principio general:
--   - Los usuarios normales solo pueden ver/editar SUS PROPIOS datos
--     (favoritos, historial, marcadores, su propio perfil).
--   - El catálogo de libros y categorías es de LECTURA PÚBLICA para
--     cualquier usuario autenticado (no para anónimos, por seguridad infantil).
--   - Solo los administradores pueden crear, editar o eliminar libros,
--     categorías, y gestionar otros usuarios.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Función auxiliar: verifica si el usuario actual es administrador
-- Se usa "security definer" para evitar recursión infinita en las políticas
-- de la propia tabla profiles.
-- ----------------------------------------------------------------------------

create or replace function public.es_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'admin'
  );
end;
$$ language plpgsql security definer set search_path = public stable;

-- ----------------------------------------------------------------------------
-- Habilitar RLS en todas las tablas
-- ----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.books enable row level security;
alter table public.favorites enable row level security;
alter table public.reading_history enable row level security;
alter table public.bookmarks enable row level security;

-- ----------------------------------------------------------------------------
-- POLÍTICAS: profiles
-- ----------------------------------------------------------------------------

-- Cualquier usuario autenticado puede ver su propio perfil
create policy "profiles_select_propio"
  on public.profiles for select
  using (auth.uid() = id);

-- Los administradores pueden ver todos los perfiles (para el panel admin)
create policy "profiles_select_admin"
  on public.profiles for select
  using (public.es_admin());

-- Un usuario puede actualizar su propio perfil. La protección contra que
-- cambie su propio rol se aplica mediante el trigger "trg_proteger_cambio_rol"
-- definido más abajo (comparar valores antiguo/nuevo dentro de una política
-- RLS de UPDATE no es seguro en Postgres).
create policy "profiles_update_propio"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Solo los administradores pueden cambiar roles de otros usuarios
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.es_admin());

-- Los administradores pueden eliminar perfiles de usuarios
create policy "profiles_delete_admin"
  on public.profiles for delete
  using (public.es_admin());

-- La inserción de perfiles ocurre automáticamente vía trigger (handle_new_user),
-- que corre con "security definer", por lo que no se necesita política de insert
-- para el flujo normal de registro.

-- ----------------------------------------------------------------------------
-- TRIGGER: impedir que un usuario cambie su propio rol
-- Defensa adicional a nivel de base de datos (además de la política RLS),
-- ya que validar "no cambiar el rol propio" dentro de una política RLS de
-- UPDATE no es seguro. Solo un admin (validado vía la función es_admin())
-- puede modificar el campo "rol" de cualquier perfil, incluyendo el suyo.
-- ----------------------------------------------------------------------------

create or replace function public.proteger_cambio_rol()
returns trigger as $$
begin
  if new.rol is distinct from old.rol and not public.es_admin() then
    raise exception 'No tienes permiso para cambiar el rol de usuario';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_proteger_cambio_rol
  before update on public.profiles
  for each row execute function public.proteger_cambio_rol();

-- ----------------------------------------------------------------------------
-- POLÍTICAS: categories
-- ----------------------------------------------------------------------------

-- Lectura pública para cualquier usuario autenticado
create policy "categories_select_autenticado"
  on public.categories for select
  to authenticated
  using (true);

-- Solo administradores pueden crear, editar o eliminar categorías
create policy "categories_insert_admin"
  on public.categories for insert
  with check (public.es_admin());

create policy "categories_update_admin"
  on public.categories for update
  using (public.es_admin());

create policy "categories_delete_admin"
  on public.categories for delete
  using (public.es_admin());

-- ----------------------------------------------------------------------------
-- POLÍTICAS: books
-- ----------------------------------------------------------------------------

-- Lectura pública de libros publicados para cualquier usuario autenticado
create policy "books_select_publicados"
  on public.books for select
  to authenticated
  using (publicado = true);

-- Los administradores pueden ver también los libros no publicados (borradores)
create policy "books_select_admin"
  on public.books for select
  using (public.es_admin());

-- Solo administradores pueden agregar, editar o eliminar libros
create policy "books_insert_admin"
  on public.books for insert
  with check (public.es_admin());

create policy "books_update_admin"
  on public.books for update
  using (public.es_admin());

create policy "books_delete_admin"
  on public.books for delete
  using (public.es_admin());

-- ----------------------------------------------------------------------------
-- POLÍTICAS: favorites
-- ----------------------------------------------------------------------------

-- Un usuario solo puede ver, crear y eliminar SUS PROPIOS favoritos
create policy "favorites_select_propio"
  on public.favorites for select
  using (auth.uid() = usuario_id);

create policy "favorites_insert_propio"
  on public.favorites for insert
  with check (auth.uid() = usuario_id);

create policy "favorites_delete_propio"
  on public.favorites for delete
  using (auth.uid() = usuario_id);

-- Los administradores pueden ver todos los favoritos (para estadísticas)
create policy "favorites_select_admin"
  on public.favorites for select
  using (public.es_admin());

-- ----------------------------------------------------------------------------
-- POLÍTICAS: reading_history
-- ----------------------------------------------------------------------------

create policy "reading_history_select_propio"
  on public.reading_history for select
  using (auth.uid() = usuario_id);

create policy "reading_history_insert_propio"
  on public.reading_history for insert
  with check (auth.uid() = usuario_id);

create policy "reading_history_update_propio"
  on public.reading_history for update
  using (auth.uid() = usuario_id);

create policy "reading_history_delete_propio"
  on public.reading_history for delete
  using (auth.uid() = usuario_id);

create policy "reading_history_select_admin"
  on public.reading_history for select
  using (public.es_admin());

-- ----------------------------------------------------------------------------
-- POLÍTICAS: bookmarks
-- ----------------------------------------------------------------------------

create policy "bookmarks_select_propio"
  on public.bookmarks for select
  using (auth.uid() = usuario_id);

create policy "bookmarks_insert_propio"
  on public.bookmarks for insert
  with check (auth.uid() = usuario_id);

create policy "bookmarks_update_propio"
  on public.bookmarks for update
  using (auth.uid() = usuario_id);

create policy "bookmarks_delete_propio"
  on public.bookmarks for delete
  using (auth.uid() = usuario_id);

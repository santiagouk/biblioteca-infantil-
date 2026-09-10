-- ============================================================================
-- MIGRACIÓN 008: PERMISOS DEL ROL MODERADOR + VALIDACIONES DE BACKEND
-- ============================================================================
-- Nota: las validaciones nuevas se agregan con NOT VALID a propósito. Ya
-- existían filas antiguas que las violarían (por ejemplo, perfiles con
-- fecha_nacimiento en el año 3000 o 5000, y un nombre con números) — no se
-- modificaron esos datos históricos sin decisión explícita del dueño del
-- proyecto. NOT VALID hace que la restricción aplique solo hacia adelante
-- (nuevos INSERT/UPDATE), sin tocar lo ya guardado.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) CORRECCIÓN DE SEGURIDAD: un usuario podía auto-asignarse rol='admin'
--    La política "profiles_update_propio" (auth.uid() = id) solo valida que
--    el usuario edite SU PROPIA fila, pero no restringe qué columnas puede
--    cambiar — permitía que cualquier usuario autenticado hiciera
--    UPDATE profiles SET rol = 'admin' WHERE id = auth.uid() y la política
--    lo aceptaba. Este trigger revierte cualquier cambio de rol que no
--    venga de un administrador, sin bloquear el resto de la actualización
--    (nombre, avatar, fecha de nacimiento siguen editables con normalidad).
-- ----------------------------------------------------------------------------

create or replace function public.proteger_cambio_rol()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.rol is distinct from old.rol and not public.es_admin() then
    new.rol := old.rol;
  end if;
  return new;
end;
$$;

comment on function public.proteger_cambio_rol() is 'Impide que un usuario cambie su propio rol (u otro) si quien ejecuta el UPDATE no es admin, incluso si RLS ya dejó pasar la fila por ser el dueño';

drop trigger if exists trigger_proteger_cambio_rol on public.profiles;
create trigger trigger_proteger_cambio_rol
  before update on public.profiles
  for each row
  execute function public.proteger_cambio_rol();

-- ----------------------------------------------------------------------------
-- 2) ROL INTERMEDIO "moderador": puede eliminar cualquier comentario
--    (moderación de contenido), pero NO tiene ningún otro permiso de admin
--    (no puede gestionar libros, categorías, usuarios ni roles — eso sigue
--    exigiendo es_admin() en todas las demás políticas, sin cambios).
-- ----------------------------------------------------------------------------

create policy "book_comments_delete_moderador"
  on public.book_comments for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and rol = 'moderador'
    )
  );

-- ----------------------------------------------------------------------------
-- 3) VALIDACIONES DE BACKEND (además de las de frontend, que son solo la
--    primera línea de defensa y se pueden saltar llamando a la API directo)
-- ----------------------------------------------------------------------------

alter table public.books
  add constraint books_anio_publicacion_valido
  check (anio_publicacion_original is null or (anio_publicacion_original >= 0 and anio_publicacion_original <= 2027))
  not valid;

alter table public.books
  add constraint books_numero_paginas_positivo
  check (numero_paginas is null or numero_paginas > 0)
  not valid;

alter table public.profiles
  add constraint profiles_nombre_sin_numeros
  check (nombre_completo is null or nombre_completo !~ '[0-9]')
  not valid;

alter table public.profiles
  add constraint profiles_nombre_longitud
  check (nombre_completo is null or char_length(nombre_completo) <= 80)
  not valid;

alter table public.profiles
  add constraint profiles_fecha_nacimiento_valida
  check (
    fecha_nacimiento is null
    or (fecha_nacimiento <= current_date and fecha_nacimiento >= (current_date - interval '120 years'))
  )
  not valid;

-- ----------------------------------------------------------------------------
-- 4) Registro: permite capturar el año de nacimiento (registro.html) igual
--    que ya se captura nombre_completo, sin romper otros clientes (la app
--    Flutter, por ejemplo) que no envíen ese metadato — queda simplemente
--    en null y se puede completar luego desde "Mi perfil".
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  anio_texto text;
  anio_numero int;
begin
  anio_texto := new.raw_user_meta_data->>'anio_nacimiento';
  anio_numero := null;

  if anio_texto is not null and anio_texto ~ '^[0-9]{4}$' then
    anio_numero := anio_texto::int;
    if anio_numero < extract(year from current_date) - 120 or anio_numero > extract(year from current_date) then
      anio_numero := null;
    end if;
  end if;

  insert into public.profiles (id, email, nombre_completo, rol, fecha_nacimiento)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nombre_completo',
    'usuario',
    case when anio_numero is not null then make_date(anio_numero, 1, 1) else null end
  );
  return new;
end;
$$;

/* ============================================================================
   MIGRACIÓN 010 — SISTEMA DE CRÉDITOS Y LIBROS VIP
   ============================================================================
   Documenta (igual que 009_foro_poemas.sql) el esquema ya aplicado en
   producción para conectar el Foro de Poemas con recompensas canjeables
   por libros VIP.

   Contenido:
     - profiles.creditos: saldo de créditos del usuario
     - books.es_vip / books.costo_creditos: marca un libro como "de pago
       en créditos" y cuánto cuesta
     - configuracion_creditos: fila única y editable con los parámetros de
       la recompensa (cuántos créditos da un like, cuántos una calificación
       positiva, y desde qué número de estrellas se considera "positiva")
     - credit_transactions: historial (ledger) de créditos ganados/gastados
     - unlocked_vip_books: libros VIP ya desbloqueados por cada usuario
     - registrar_credito(): única función que puede modificar el saldo,
       siempre dejando un registro en el ledger
     - Triggers que otorgan/revocan crédito automáticamente por likes y
       calificaciones positivas recibidas en un poema
     - canjear_libro_vip(): función que el usuario invoca para canjear
       créditos por un libro VIP, con todas las validaciones de negocio
   ========================================================================= */

alter table public.profiles
  add column if not exists creditos integer not null default 0 check (creditos >= 0);

alter table public.books
  add column if not exists es_vip boolean not null default false,
  add column if not exists costo_creditos integer not null default 0 check (costo_creditos >= 0);

/* ----------------------------------------------------------------------------
   CONFIGURACIÓN DE CRÉDITOS
   ----------------------------------------------------------------------------
   Fila única (id boolean = true, con CHECK (id)) para poder ajustar la
   recompensa desde el panel admin o el SQL Editor sin tocar código.
   ---------------------------------------------------------------------------- */

create table if not exists public.configuracion_creditos (
  id boolean primary key default true check (id),
  creditos_por_like integer not null default 1 check (creditos_por_like >= 0),
  creditos_por_calificacion_positiva integer not null default 1 check (creditos_por_calificacion_positiva >= 0),
  umbral_calificacion_positiva smallint not null default 4 check (umbral_calificacion_positiva >= 1 and umbral_calificacion_positiva <= 5),
  actualizado_en timestamptz not null default now()
);
comment on table public.configuracion_creditos is 'Fila única con los parámetros del sistema de créditos; editable por un admin para ajustar recompensas sin tocar código';

insert into public.configuracion_creditos (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.credit_transactions (
  id uuid primary key default extensions.uuid_generate_v4(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  cantidad integer not null check (cantidad <> 0),
  motivo text not null,
  referencia_tabla text,
  referencia_id uuid,
  creado_en timestamptz not null default now()
);
comment on table public.credit_transactions is 'Historial de créditos ganados y gastados por cada usuario';
create index if not exists idx_credit_transactions_usuario on public.credit_transactions (usuario_id, creado_en desc);

create table if not exists public.unlocked_vip_books (
  id uuid primary key default extensions.uuid_generate_v4(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  libro_id uuid not null references public.books(id) on delete cascade,
  creditos_pagados integer not null,
  creado_en timestamptz not null default now(),
  unique (usuario_id, libro_id)
);
comment on table public.unlocked_vip_books is 'Registro de libros VIP desbloqueados por cada usuario a cambio de créditos';

/* ----------------------------------------------------------------------------
   registrar_credito(): único camino para tocar el saldo
   ----------------------------------------------------------------------------
   NOTA: esta es la versión inicial. La migración 011 la reemplaza para
   coordinarla con el trigger que protege profiles.creditos de escrituras
   directas — ver 011_proteger_columna_creditos.sql para la versión final
   realmente vigente.
   ---------------------------------------------------------------------------- */

create or replace function public.registrar_credito(
  p_usuario_id uuid,
  p_cantidad integer,
  p_motivo text,
  p_referencia_tabla text default null,
  p_referencia_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_cantidad = 0 or p_usuario_id is null then
    return;
  end if;

  -- El "greatest(0, ...)" es una red de seguridad para que el saldo nunca
  -- se vea negativo en pantalla; el ledger siempre queda con el monto real.
  update public.profiles
  set creditos = greatest(0, creditos + p_cantidad)
  where id = p_usuario_id;

  insert into public.credit_transactions (usuario_id, cantidad, motivo, referencia_tabla, referencia_id)
  values (p_usuario_id, p_cantidad, p_motivo, p_referencia_tabla, p_referencia_id);
end;
$$;

/* ----------------------------------------------------------------------------
   TRIGGERS: crédito automático por likes y calificaciones de poemas
   ---------------------------------------------------------------------------- */

create or replace function public.otorgar_credito_por_like_poema()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  autor_id uuid;
  puntos integer;
begin
  select usuario_id into autor_id from public.poems where id = new.poema_id;
  select creditos_por_like into puntos from public.configuracion_creditos limit 1;
  perform public.registrar_credito(autor_id, puntos, 'Me gusta recibido en un poema', 'poem_likes', new.id);
  return new;
end;
$$;

drop trigger if exists trigger_credito_like_poema on public.poem_likes;
create trigger trigger_credito_like_poema
  after insert on public.poem_likes
  for each row execute function public.otorgar_credito_por_like_poema();

create or replace function public.revocar_credito_por_unlike_poema()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  autor_id uuid;
  puntos integer;
begin
  select usuario_id into autor_id from public.poems where id = old.poema_id;
  select creditos_por_like into puntos from public.configuracion_creditos limit 1;
  perform public.registrar_credito(autor_id, -puntos, 'Me gusta retirado de un poema', 'poem_likes', old.id);
  return old;
end;
$$;

drop trigger if exists trigger_revocar_credito_unlike_poema on public.poem_likes;
create trigger trigger_revocar_credito_unlike_poema
  after delete on public.poem_likes
  for each row execute function public.revocar_credito_por_unlike_poema();

-- Calificaciones: solo se premia si la calificación es "positiva" según el
-- umbral configurado (por defecto 4+ estrellas). Si el usuario cambia una
-- calificación ya positiva a una no positiva (o viceversa), el crédito se
-- ajusta en consecuencia — así no se puede subir a 5, cobrar, bajar a 1 y
-- volver a subir para generar créditos repetidos (el UPDATE está cubierto,
-- no solo el INSERT).
create or replace function public.gestionar_credito_por_calificacion()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  autor_id uuid;
  puntos integer;
  umbral smallint;
  era_positiva boolean;
  es_positiva boolean;
begin
  select creditos_por_calificacion_positiva, umbral_calificacion_positiva
    into puntos, umbral
    from public.configuracion_creditos limit 1;

  if tg_op = 'INSERT' then
    select usuario_id into autor_id from public.poems where id = new.poema_id;
    if new.estrellas >= umbral then
      perform public.registrar_credito(autor_id, puntos, 'Calificación positiva recibida en un poema', 'poem_ratings', new.id);
    end if;
    return new;
  end if;

  select usuario_id into autor_id from public.poems where id = new.poema_id;
  era_positiva := old.estrellas >= umbral;
  es_positiva := new.estrellas >= umbral;

  if era_positiva and not es_positiva then
    perform public.registrar_credito(autor_id, -puntos, 'Calificación bajó de positiva a no positiva', 'poem_ratings', new.id);
  elsif (not era_positiva) and es_positiva then
    perform public.registrar_credito(autor_id, puntos, 'Calificación subió a positiva', 'poem_ratings', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_credito_calificacion_poema on public.poem_ratings;
create trigger trigger_credito_calificacion_poema
  after insert or update on public.poem_ratings
  for each row execute function public.gestionar_credito_por_calificacion();

/* ----------------------------------------------------------------------------
   RLS de las tablas nuevas
   ---------------------------------------------------------------------------- */

alter table public.configuracion_creditos enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.unlocked_vip_books enable row level security;

create policy configuracion_creditos_select_autenticado on public.configuracion_creditos
  for select to authenticated using (true);
create policy configuracion_creditos_update_admin on public.configuracion_creditos
  for update using (public.es_admin()) with check (public.es_admin());

-- credit_transactions: cada usuario ve su propio historial; un admin ve
-- todo. No hay política de INSERT/UPDATE para authenticated/anon a
-- propósito: la única forma de insertar es registrar_credito(), que corre
-- como SECURITY DEFINER y por lo tanto no depende de estas políticas.
create policy credit_transactions_select_propio on public.credit_transactions
  for select using (auth.uid() = usuario_id);
create policy credit_transactions_select_admin on public.credit_transactions
  for select using (public.es_admin());

-- unlocked_vip_books: mismo criterio. No hay política de INSERT para
-- usuarios normales: solo canjear_libro_vip() (SECURITY DEFINER) puede
-- crear estas filas, así que un usuario no puede "desbloquearse" un libro
-- llamando directamente a la API de Supabase.
create policy unlocked_vip_books_select_propio on public.unlocked_vip_books
  for select using (auth.uid() = usuario_id);
create policy unlocked_vip_books_select_admin on public.unlocked_vip_books
  for select using (public.es_admin());

/* ----------------------------------------------------------------------------
   canjear_libro_vip(): canje de créditos por acceso a un libro VIP
   ---------------------------------------------------------------------------- */

create or replace function public.canjear_libro_vip(p_libro_id uuid)
returns table(exito boolean, mensaje text, creditos_restantes integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_costo integer;
  v_es_vip boolean;
  v_creditos_actuales integer;
  v_ya_desbloqueado boolean;
begin
  if v_usuario_id is null then
    return query select false, 'Debes iniciar sesión.', 0;
    return;
  end if;

  select es_vip, costo_creditos into v_es_vip, v_costo from public.books where id = p_libro_id;

  if v_es_vip is null then
    return query select false, 'El libro no existe.', 0;
    return;
  end if;

  if not v_es_vip then
    return query select false, 'Este libro no requiere créditos.', 0;
    return;
  end if;

  select exists(
    select 1 from public.unlocked_vip_books where usuario_id = v_usuario_id and libro_id = p_libro_id
  ) into v_ya_desbloqueado;

  select creditos into v_creditos_actuales from public.profiles where id = v_usuario_id;

  if v_ya_desbloqueado then
    return query select true, 'Ya tenías este libro desbloqueado.', v_creditos_actuales;
    return;
  end if;

  if v_creditos_actuales < v_costo then
    return query select false, 'No tienes créditos suficientes.', v_creditos_actuales;
    return;
  end if;

  perform public.registrar_credito(v_usuario_id, -v_costo, 'Canje de libro VIP', 'books', p_libro_id);
  insert into public.unlocked_vip_books (usuario_id, libro_id, creditos_pagados) values (v_usuario_id, p_libro_id, v_costo);

  select creditos into v_creditos_actuales from public.profiles where id = v_usuario_id;
  return query select true, '¡Libro desbloqueado!', v_creditos_actuales;
end;
$$;

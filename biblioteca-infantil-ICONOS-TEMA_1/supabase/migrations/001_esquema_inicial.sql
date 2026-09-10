-- ============================================================================
-- MIGRACIÓN 001: ESQUEMA INICIAL
-- Biblioteca Virtual Infantil
-- ============================================================================
-- Esta migración crea las tablas base, tipos enumerados y relaciones.
-- Ejecutar en el SQL Editor de Supabase o vía Supabase CLI (supabase db push).
-- ============================================================================

-- Extensión necesaria para generar UUIDs
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- TIPOS ENUMERADOS
-- ----------------------------------------------------------------------------

create type user_role as enum ('admin', 'usuario');

create type rango_edad as enum ('3-5', '6-8', '9-12', '13+');

-- ----------------------------------------------------------------------------
-- TABLA: profiles
-- Extiende auth.users de Supabase con datos adicionales del perfil.
-- Se crea automáticamente cuando un usuario se registra (ver trigger abajo).
-- ----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre_completo text,
  nombre_usuario text unique,
  avatar_url text,
  rol user_role not null default 'usuario',
  fecha_nacimiento date,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.profiles is 'Perfiles de usuario, extiende auth.users';

-- ----------------------------------------------------------------------------
-- TABLA: categories
-- Categorías/géneros de libros (ej: Aventura, Fábulas, Ciencia)
-- ----------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null unique,
  descripcion text,
  icono text,
  color text default '#6366f1',
  creado_en timestamptz not null default now()
);

comment on table public.categories is 'Categorías de clasificación de libros';

-- ----------------------------------------------------------------------------
-- TABLA: books
-- Catálogo principal de libros (dominio público / sin derechos de autor)
-- ----------------------------------------------------------------------------

create table public.books (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null,
  autor text not null,
  descripcion text,
  sinopsis text,
  categoria_id uuid references public.categories(id) on delete set null,
  edad_recomendada rango_edad not null default '6-8',
  idioma text not null default 'es',
  portada_url text,
  archivo_pdf_url text not null,
  numero_paginas integer,
  destacado boolean not null default false,
  publicado boolean not null default true,
  fuente_dominio_publico text,
  anio_publicacion_original integer,
  creado_por uuid references public.profiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.books is 'Catálogo de libros de dominio público disponibles para lectura';
comment on column public.books.fuente_dominio_publico is 'Referencia a la fuente que certifica que el libro es de dominio público (ej: Project Gutenberg)';

create index idx_books_categoria on public.books(categoria_id);
create index idx_books_edad on public.books(edad_recomendada);
create index idx_books_destacado on public.books(destacado) where destacado = true;
create index idx_books_publicado on public.books(publicado) where publicado = true;
create index idx_books_titulo_busqueda on public.books using gin (to_tsvector('spanish', titulo));
create index idx_books_autor_busqueda on public.books using gin (to_tsvector('spanish', autor));

-- ----------------------------------------------------------------------------
-- TABLA: favorites
-- Libros marcados como favoritos por cada usuario
-- ----------------------------------------------------------------------------

create table public.favorites (
  id uuid primary key default uuid_generate_v4(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  libro_id uuid not null references public.books(id) on delete cascade,
  creado_en timestamptz not null default now(),
  unique (usuario_id, libro_id)
);

comment on table public.favorites is 'Relación de libros favoritos por usuario';

create index idx_favorites_usuario on public.favorites(usuario_id);

-- ----------------------------------------------------------------------------
-- TABLA: reading_history
-- Historial de lectura: progreso y última página visitada por libro/usuario
-- ----------------------------------------------------------------------------

create table public.reading_history (
  id uuid primary key default uuid_generate_v4(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  libro_id uuid not null references public.books(id) on delete cascade,
  ultima_pagina integer not null default 1,
  porcentaje_completado numeric(5,2) not null default 0,
  completado boolean not null default false,
  primera_lectura timestamptz not null default now(),
  ultima_lectura timestamptz not null default now(),
  unique (usuario_id, libro_id)
);

comment on table public.reading_history is 'Progreso de lectura por usuario y libro, permite continuar donde se dejó';

create index idx_reading_history_usuario on public.reading_history(usuario_id);
create index idx_reading_history_ultima_lectura on public.reading_history(usuario_id, ultima_lectura desc);

-- ----------------------------------------------------------------------------
-- TABLA: bookmarks
-- Marcadores específicos dentro de un libro (puede haber varios por libro)
-- ----------------------------------------------------------------------------

create table public.bookmarks (
  id uuid primary key default uuid_generate_v4(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  libro_id uuid not null references public.books(id) on delete cascade,
  pagina integer not null,
  nota text,
  creado_en timestamptz not null default now()
);

comment on table public.bookmarks is 'Marcadores de página específicos creados manualmente por el usuario';

create index idx_bookmarks_usuario_libro on public.bookmarks(usuario_id, libro_id);

-- ----------------------------------------------------------------------------
-- TRIGGER: actualizar campo actualizado_en automáticamente
-- ----------------------------------------------------------------------------

create or replace function public.actualizar_timestamp()
returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql security invoker;

create trigger trg_profiles_actualizado
  before update on public.profiles
  for each row execute function public.actualizar_timestamp();

create trigger trg_books_actualizado
  before update on public.books
  for each row execute function public.actualizar_timestamp();

-- ----------------------------------------------------------------------------
-- TRIGGER: crear perfil automáticamente al registrarse un usuario
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nombre_completo, rol)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nombre_completo',
    'usuario'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- TRIGGER: actualizar última_lectura automáticamente
-- ----------------------------------------------------------------------------

create or replace function public.actualizar_ultima_lectura()
returns trigger as $$
begin
  new.ultima_lectura = now();
  return new;
end;
$$ language plpgsql security invoker;

create trigger trg_reading_history_actualizado
  before update on public.reading_history
  for each row execute function public.actualizar_ultima_lectura();

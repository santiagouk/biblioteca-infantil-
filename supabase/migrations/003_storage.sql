-- ============================================================================
-- MIGRACIÓN 003: STORAGE (PORTADAS Y ARCHIVOS PDF)
-- Biblioteca Virtual Infantil
-- ============================================================================
-- Crea dos buckets:
--   - "portadas": imágenes de portada de los libros (público para lectura)
--   - "libros-pdf": archivos PDF de los libros (público para lectura,
--     ya que son libros de dominio público sin restricción de distribución)
-- Solo administradores pueden subir/editar/eliminar archivos en ambos buckets.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('portadas', 'portadas', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('libros-pdf', 'libros-pdf', true, 52428800, array['application/pdf'])
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- POLÍTICAS: bucket "portadas"
-- ----------------------------------------------------------------------------

create policy "portadas_lectura_publica"
  on storage.objects for select
  using (bucket_id = 'portadas');

create policy "portadas_insert_admin"
  on storage.objects for insert
  with check (bucket_id = 'portadas' and public.es_admin());

create policy "portadas_update_admin"
  on storage.objects for update
  using (bucket_id = 'portadas' and public.es_admin());

create policy "portadas_delete_admin"
  on storage.objects for delete
  using (bucket_id = 'portadas' and public.es_admin());

-- ----------------------------------------------------------------------------
-- POLÍTICAS: bucket "libros-pdf"
-- ----------------------------------------------------------------------------

create policy "libros_pdf_lectura_publica"
  on storage.objects for select
  using (bucket_id = 'libros-pdf');

create policy "libros_pdf_insert_admin"
  on storage.objects for insert
  with check (bucket_id = 'libros-pdf' and public.es_admin());

create policy "libros_pdf_update_admin"
  on storage.objects for update
  using (bucket_id = 'libros-pdf' and public.es_admin());

create policy "libros_pdf_delete_admin"
  on storage.objects for delete
  using (bucket_id = 'libros-pdf' and public.es_admin());

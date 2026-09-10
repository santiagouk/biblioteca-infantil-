/* ============================================================================
   MIGRACIÓN 012 — CORREGIR VISTAS SECURITY DEFINER DEL FORO DE POEMAS
   ============================================================================
   El linter de seguridad de Supabase marcó como ERROR que las vistas
   poemas_con_estadisticas y estadisticas_poemas_usuario (migración 009)
   quedaron con la propiedad SECURITY DEFINER: por defecto en Postgres, una
   vista se ejecuta con los privilegios de quien la creó, no de quien
   consulta, lo cual puede saltarse RLS de forma no intencional. La
   corrección es marcarlas como SECURITY INVOKER (Postgres 15+), para que
   respeten siempre los permisos y políticas RLS del usuario que consulta.
   No cambia ninguna columna ni el comportamiento funcional: ambas vistas
   solo leen tablas con políticas de "select" abiertas a authenticated.
   ========================================================================= */

alter view public.poemas_con_estadisticas set (security_invoker = true);
alter view public.estadisticas_poemas_usuario set (security_invoker = true);

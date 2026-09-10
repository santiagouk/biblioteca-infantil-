-- ============================================================================
-- MIGRACIÓN 007: ROL INTERMEDIO "moderador"
-- ============================================================================
-- Agrega un tercer valor al enum user_role, entre "usuario" y "admin".
-- Se agrega en su propia migración porque Postgres no permite usar un
-- valor de enum recién creado en la misma transacción en la que se crea.
-- Los permisos reales de este rol se definen en la migración 008 (no
-- obtiene automáticamente ningún permiso de admin: es_admin() sigue
-- exigiendo rol = 'admin' exactamente).
-- ============================================================================

alter type public.user_role add value 'moderador';

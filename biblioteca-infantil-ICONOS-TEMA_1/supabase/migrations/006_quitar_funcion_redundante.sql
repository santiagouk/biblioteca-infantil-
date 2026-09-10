-- Se elimina: al revisar la base de datos ya existía la función
-- obtener_libros_recomendados(limite), creada en la migración
-- "comentarios_valoraciones" (2026-08-22), que cumple el mismo propósito
-- de forma más completa (devuelve los libros ya ordenados por
-- popularidad, con respaldo automático a destacados/recientes). Se evita
-- así dejar dos funciones RPC redundantes en la API pública.
drop function if exists public.obtener_libros_populares();

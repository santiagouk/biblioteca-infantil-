/* ============================================================================
   CONFIGURACIÓN DE SUPABASE
   ============================================================================
   Este archivo crea el cliente de Supabase que usarán todas las páginas.
   Reemplaza SUPABASE_URL y SUPABASE_ANON_KEY con los valores de tu propio
   proyecto (Project Settings → API en el dashboard de Supabase).

   IMPORTANTE: la "anon key" es pública por diseño (se usa en el navegador).
   La seguridad real está en las políticas RLS configuradas en la base de
   datos, no en ocultar esta clave. NUNCA pongas aquí la "service_role key".
   ========================================================================= */

const SUPABASE_URL = 'https://pbkbqggeaquncsmuykec.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBia2JxZ2dlYXF1bmNzbXV5a2VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NzQ0MjUsImV4cCI6MjA5NzU1MDQyNX0.iD2ln_FhAlRFRw4ReLe_hwj6v2LRFEvm6tXPSTqmWCg'

// El objeto `supabase` global lo provee el script de la CDN cargado en el
// <head> de cada página (ver comentario en cada .html).
const cliente = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

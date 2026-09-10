# 📚 Biblioteca Infantil — HTML5 + CSS3 + Bootstrap 5 + JavaScript + Supabase

Biblioteca virtual infantil para leer libros de dominio público, construida
con HTML, CSS y JavaScript tradicionales (sin frameworks de frontend) y
Supabase como backend (base de datos, autenticación y almacenamiento).

## ✅ Funcionalidades incluidas

- Registro, inicio de sesión y recuperación de contraseña, con mostrar/ocultar contraseña y validaciones de nombre y año de nacimiento (frontend y backend)
- Roles de usuario: `usuario`, `moderador` (puede eliminar cualquier comentario, moderación de contenido) y `admin` (control total) — todos validados también a nivel de base de datos, no solo ocultando botones en la interfaz
- Catálogo de libros con búsqueda y filtros (categoría, edad, autor/título), con vista "Inicio" (Recomendados + catálogo) y vista "Catálogo" (solo el catálogo, a todo lo ancho)
- Sección "Recomendados" en la biblioteca: libros más populares según me gusta, lecturas y favoritos de todos los usuarios (con respaldo a los destacados marcados manualmente si aún no hay suficiente actividad)
- Lector de PDF integrado en el navegador (con PDF.js), con zoom, navegación y pantalla completa
- "¿Qué te pareció este libro?": me gusta y comentarios en cada libro, con opción de eliminar el propio comentario (o cualquiera, si eres admin o moderador)
- "¿Cuánto aprendiste?": actividad tipo juego que aparece al terminar de leer un libro, con preguntas generadas dinámicamente sobre ese libro
- Favoritos, historial de lectura ("continuar leyendo") y marcadores de página
- Panel de administrador: CRUD de libros y categorías, gestión de roles de usuario. El formulario de libros incluye buscador de autores (con "otros libros de este autor"), año de publicación validado (máx. 2027), número de páginas detectado automáticamente al subir el PDF, y validación de tipo/tamaño/dimensiones de los archivos subidos
- Subida de portadas y archivos PDF a Supabase Storage
- Modo claro y modo oscuro, con transición suave y preferencia guardada en el navegador

## 🧱 Tecnologías usadas

| Capa | Tecnología |
|---|---|
| Estructura | HTML5 |
| Estilos | CSS3 + Bootstrap 5 (vía CDN) |
| Comportamiento | JavaScript (ES6+), sin frameworks |
| Lector de PDF | PDF.js (Mozilla), incluido localmente en `js/vendor/pdfjs/` |
| Backend | Supabase (PostgreSQL + Auth + Storage) |

No se usa Node.js, npm, ni ningún paso de "build" — son archivos estáticos
que cualquier navegador puede abrir directamente.

> **Nota sobre PDF.js:** a diferencia de Bootstrap y el SDK de Supabase
> (que sí se cargan desde un CDN), la librería PDF.js está incluida
> localmente en `js/vendor/pdfjs/`. Esto es intencional: algunos
> bloqueadores de anuncios (AdBlock, uBlock Origin) y configuraciones de
> privacidad del navegador (como "Tracking Prevention" de Edge) bloquean
> `cdnjs.cloudflare.com` por error, lo que rompía el lector de PDF. Al
> incluir la librería como archivo propio del proyecto, el lector funciona
> sin depender de eso.

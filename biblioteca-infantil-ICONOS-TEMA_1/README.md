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

---

## 📁 Estructura completa del proyecto

```
biblioteca-infantil-html/
│
├── index.html                      → Página de inicio
├── login.html                      → Inicio de sesión
├── registro.html                   → Registro de cuenta
├── recuperar-password.html         → Solicitar recuperación de contraseña
├── actualizar-password.html        → Establecer nueva contraseña
├── biblioteca.html                 → Catálogo con filtros (requiere sesión)
├── libro.html                      → Detalle + lector de PDF (?id=xxx)
├── favoritos.html                  → Libros favoritos del usuario
├── perfil.html                     → Datos de perfil + historial de lectura
│
├── admin/                          → Panel de administrador (requiere rol admin)
│   ├── index.html                  → Dashboard con estadísticas
│   ├── libros.html                 → CRUD de libros
│   ├── categorias.html             → CRUD de categorías
│   └── usuarios.html               → Gestión de roles de usuario
│
├── css/
│   └── estilos.css                 → Estilos personalizados sobre Bootstrap
│
├── js/
│   ├── supabase-config.js          → Claves y cliente de Supabase
│   ├── auth.js                     → Funciones de autenticación
│   ├── datos.js                    → Acceso a datos (libros, favoritos, etc.)
│   ├── datos-admin.js              → Acceso a datos exclusivo del admin (CRUD)
│   ├── navbar.js                   → Genera el menú de navegación dinámico
│   ├── proteger-ruta.js            → Verifica sesión/rol antes de mostrar la página
│   └── pages/                      → Un archivo JS por cada página HTML
│       ├── login.js
│       ├── registro.js
│       ├── recuperar-password.js
│       ├── actualizar-password.js
│       ├── biblioteca.js
│       ├── libro.js
│       ├── favoritos.js
│       ├── perfil.js
│       └── admin/
│           ├── dashboard.js
│           ├── libros.js
│           ├── categorias.js
│           └── usuarios.js
│
├── images/
│   └── portada-default.svg         → Imagen que se muestra si un libro no tiene portada
│
└── supabase/
    ├── seed.sql                    → Datos de ejemplo (categorías)
    └── migrations/
        ├── 001_esquema_inicial.sql               → Crea las 6 tablas
        ├── 002_politicas_rls.sql                 → Reglas de seguridad
        ├── 003_storage.sql                       → Buckets de portadas y PDFs
        └── 004_comentarios_valoraciones.sql       → Tablas "book_likes"/"book_comments" + función de recomendados
        ├── 005_libros_populares.sql               → (histórica, ver nota en el archivo)
        ├── 006_quitar_funcion_redundante.sql       → (histórica, ver nota en el archivo)
        ├── 007_rol_moderador_enum.sql              → Agrega el rol "moderador"
        └── 008_permisos_moderador_y_validaciones.sql → Permisos del moderador + validaciones de backend (año, nombre, fecha de nacimiento) + corrección de seguridad en profiles
```

### Dónde va cada cosa (guía rápida)

- **¿Necesitas agregar una página nueva?** Crea un `.html` en la raíz (o en `admin/` si es de administración) y su script correspondiente en `js/pages/`.
- **¿Quieres cambiar estilos?** Todo el CSS personalizado vive en `css/estilos.css`. Bootstrap se carga desde un CDN en el `<head>` de cada página, no hay que descargarlo.
- **¿Necesitas una función que consulta la base de datos?** Si es de uso general, va en `js/datos.js`. Si es exclusiva del panel admin, va en `js/datos-admin.js`.
- **Imágenes propias** (logos, iconos) van en `images/`.

---

## 🛠️ Cómo ejecutarlo en Visual Studio Code

### 1. Abrir el proyecto

**Archivo → Abrir carpeta...** y selecciona la carpeta `biblioteca-infantil-html`.

### 2. Instalar la extensión Live Server

Como este proyecto no usa Node.js, no hay `npm install` ni `npm run dev`.
En su lugar, necesitas servir los archivos HTML con un servidor local simple
(abrir el archivo directamente con doble clic causa errores de CORS con
Supabase y con los módulos de PDF.js).

1. Ve a la pestaña de extensiones (`Ctrl+Shift+X`).
2. Busca **"Live Server"** (de Ritwick Dey) e instálala.

### 3. Configurar Supabase

1. Crea un proyecto en [app.supabase.com](https://app.supabase.com).
2. Ve a **Project Settings → API** y copia el **Project URL** y la **anon public key**.
3. Abre `js/supabase-config.js` en VS Code y reemplaza:

```javascript
const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co'
const SUPABASE_ANON_KEY = 'TU_ANON_KEY_AQUI'
```

con tus valores reales.

> ⚠️ A diferencia de un proyecto con backend (Next.js, Express, etc.), aquí
> **no existe `.env`**: como todo el código corre en el navegador, la
> configuración va directamente en este archivo JS. Esto es seguro porque
> la "anon key" está diseñada para ser pública — la protección real está en
> las políticas RLS de la base de datos.

### 4. Ejecutar las migraciones SQL

En el dashboard de Supabase, ve a **SQL Editor → New query** y ejecuta, en
este orden, el contenido completo de:

1. `supabase/migrations/001_esquema_inicial.sql`
2. `supabase/migrations/002_politicas_rls.sql`
3. `supabase/migrations/003_storage.sql`
4. `supabase/migrations/004_comentarios_valoraciones.sql`
5. `supabase/migrations/005_libros_populares.sql`
6. `supabase/migrations/006_quitar_funcion_redundante.sql`
7. `supabase/migrations/007_rol_moderador_enum.sql`
8. `supabase/migrations/008_permisos_moderador_y_validaciones.sql`

> ⚠️ Si ya conectaste este proyecto a tu base de datos de Supabase (la del
> proyecto `pbkbqggeaquncsmuykec`), **no ejecutes ninguno de estos
> archivos**: todo ya está aplicado ahí. Solo hacen falta si estás
> configurando el proyecto desde cero en un Supabase distinto.

(Opcional) Ejecuta también `supabase/seed.sql` para tener categorías de
ejemplo ya creadas.

### 5. Iniciar el servidor local

1. En el explorador de VS Code, haz clic derecho sobre `index.html`.
2. Selecciona **"Open with Live Server"**.
3. Se abrirá tu navegador en algo como `http://127.0.0.1:5500/index.html`.

Para detenerlo: clic en **"Port: 5500"** en la barra inferior de VS Code, o cierra la pestaña del navegador.

---

## 🔑 Crear tu primer usuario administrador

1. Regístrate normalmente desde `registro.html` en el navegador.
2. En el dashboard de Supabase, ve a **Table Editor → profiles**.
3. Busca la fila con tu correo y cambia el campo `rol` de `usuario` a `admin`.
4. Recarga la página — ahora verás el enlace **"Panel admin"** en el menú.

---

## ✅ Cómo verificar que todo funciona

### Login y registro
1. Ve a `registro.html`, crea una cuenta.
2. Deberías ser redirigido automáticamente a `biblioteca.html`.
3. Cierra sesión (botón en el menú) y vuelve a iniciar sesión en `login.html` con las mismas credenciales.

### Biblioteca
1. Como administrador, ve a **Panel admin → Libros → "+ Agregar libro"**.
2. Sube un PDF de prueba (cualquier PDF corto que tengas) y una portada.
3. Marca la casilla "Publicado" y guarda.
4. Ve a `biblioteca.html` — el libro debe aparecer en el catálogo.
5. Prueba los filtros de categoría, edad y la barra de búsqueda.

### Lector de PDF
1. Haz clic en el libro que subiste.
2. Debe abrirse `libro.html` mostrando la primera página del PDF.
3. Prueba los botones "Anterior" / "Siguiente", los de zoom (➕ / ➖) y el de pantalla completa (⛶).
4. Marca el libro como favorito (🤍 → ❤️) y verifica que aparezca en `favoritos.html`.
5. Agrega un marcador de página y verifica que aparezca en la lista de marcadores.
6. Debajo del lector, da "me gusta" y publica un comentario; verifica que el contador y la lista se actualicen.
7. Llega hasta la última página del PDF: debe aparecer la actividad "¿Cuánto aprendiste?". Juega el quiz y prueba el botón "Volver a jugar".

### Modo claro / oscuro
1. Usa el interruptor de tema en el menú de navegación.
2. Recorre varias páginas (biblioteca, libro, perfil, panel admin) y confirma que no queden fondos o bordes "pegados" al tema anterior (por ejemplo, la lista de marcadores o el navbar).
3. Recarga la página: el tema elegido debe mantenerse.

### Recuperación de contraseña
1. Desde `login.html`, ve a "¿Olvidaste tu contraseña?" y solicita el enlace con tu correo.
2. Abre el enlace que llega al correo: `actualizar-password.html` debe mostrar primero "Verificando tu enlace..." y luego el formulario.
3. Define una nueva contraseña y confirma que puedas iniciar sesión con ella.
4. Prueba entrar a `actualizar-password.html` directamente, sin pasar por el enlace del correo: debe mostrar el aviso de enlace inválido, no el formulario.

### Panel de administrador
1. Ve a **Panel admin → Categorías** y crea una categoría nueva.
2. Ve a **Panel admin → Usuarios**: deberías ver tu cuenta y poder (en teoría) cambiar el rol de otras cuentas que crees para probar.
3. Cierra sesión y vuelve a entrar con una cuenta que **no** sea admin: el enlace "Panel admin" no debe aparecer, y si intentas entrar a `admin/index.html` manualmente por URL, debe redirigirte a la biblioteca con un aviso.

---

## 🌐 Cómo publicar el proyecto cuando esté terminado

Como es un sitio 100% estático (sin servidor backend propio), puedes
publicarlo gratis en cualquiera de estas opciones:

### Opción A: Netlify (recomendada, más simple)
1. Crea una cuenta en [netlify.com](https://netlify.com).
2. Arrastra la carpeta completa del proyecto al panel de Netlify ("Deploy manually").
3. Netlify te da una URL pública al instante.

### Opción B: GitHub Pages
1. Sube el proyecto a un repositorio de GitHub.
2. Ve a **Settings → Pages** del repositorio.
3. Selecciona la rama `main` y la carpeta raíz (`/`).
4. GitHub te da una URL del tipo `tuusuario.github.io/biblioteca-infantil-html`.

### Opción C: Vercel
1. Crea una cuenta en [vercel.com](https://vercel.com).
2. Importa el repositorio de GitHub (o sube la carpeta directamente).
3. Como no hay paso de build, Vercel lo detecta como sitio estático automáticamente.

En cualquiera de las tres opciones, recuerda que `js/supabase-config.js` ya
debe tener tus claves reales antes de publicar — no hay variables de entorno
que configurar por separado en este stack.

---

## 🔒 Notas de seguridad

- La "anon key" de Supabase es pública por diseño; nunca pongas aquí la **service_role key**.
- Toda la seguridad de quién puede leer/escribir cada tabla vive en las políticas RLS (`supabase/migrations/002_politicas_rls.sql`), no en este código JavaScript. Aunque alguien modifique el JS del navegador, la base de datos seguirá rechazando operaciones no autorizadas.
- Un usuario no puede otorgarse a sí mismo el rol de administrador (esto está bloqueado por un trigger en la base de datos, no solo por la interfaz).

---

¿Todo funcionando? El siguiente paso natural es la **Fase del asistente virtual con IA**, que quedó pendiente de definir en una conversación anterior.

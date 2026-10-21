# Cuestionarios

Aplicación web de cuestionarios interactivos construida con **Astro + React** y desplegada en **Vercel**.

- Todos los cuestionarios se almacenan en **Neon Postgres**
- Creación desde PDF o JSON con validación automática
- 100% funcional sin registro

---

## Inicio rápido

```bash
# Instalar dependencias
pnpm install

# Desarrollo local
pnpm dev          # → http://localhost:4321

# Build de producción
pnpm build        # → genera /dist
```

---

## Estructura del proyecto

```
cuestionario/
├── public/
│   ├── ads.txt                   # Registro de vendedor de AdSense
│   ├── robots.txt
│   └── favicon.png
├── src/
│   ├── components/
│   │   ├── Quiz.tsx              # Tema: repaso con soluciones + test aleatorio de 15
│   │   ├── UserQuiz.jsx          # Reproducir un cuestionario de usuario
│   │   ├── CreateQuiz.jsx        # Crear desde PDF o JSON
│   │   ├── EditQuiz.jsx          # Editar un cuestionario propio
│   │   ├── QuizQuestionEditor.jsx  # Editor visual de preguntas (modal)
│   │   ├── MyQuizzes.jsx         # Cuestionarios creados en este navegador
│   │   ├── LandingCourses.jsx    # Buscador de la portada
│   │   ├── QuizCard.jsx          # Tarjeta de cuestionario (fila de listado)
│   │   ├── FloatingActions.jsx   # Botones flotantes + showViewStart / scrollToQuestion
│   │   ├── UndoToast.jsx         # Aviso "Deshacer"
│   │   ├── useExitTransition.js  # Montaje con salida animada (data-state)
│   │   ├── usePendingDeletion.js # Borrado optimista con deshacer
│   │   ├── pendingDeletion.js    # Lógica del borrado pendiente (testeada)
│   │   ├── useUnsavedChangesWarning.js
│   │   ├── AdSenseAd.tsx / AdSenseManager.tsx / CookieConsentBanner.tsx
│   │   ├── Landing.jsx           # FAQ_ITEMS de la portada
│   │   └── Catalog.jsx           # Sin uso en ninguna página
│   ├── layouts/
│   │   └── Layout.astro          # Header, selector de tema, footer, SEO
│   ├── lib/
│   │   ├── api.ts                # Cliente de API + caché en localStorage
│   │   ├── curriculum.ts         # Nombres y descripciones de cursos y asignaturas
│   │   ├── motion.ts             # prefersReducedMotion / scrollBehavior
│   │   ├── ads.ts / feedAds.ts   # Dónde se pueden servir anuncios y en qué posiciones
│   │   ├── quizLimits.ts / quizValidator.ts / slug.ts / ownerToken.ts
│   │   └── server/               # env, http, rateLimit, audit, hash, generateQuizFromPdf
│   ├── pages/
│   │   ├── index.astro           # Portada: buscador + todos los temas
│   │   ├── cursos.astro          # Catálogo de cursos
│   │   ├── [grado].astro         # Asignaturas y temas de un curso
│   │   ├── [grado]/[curso]/[unidad].astro  # Tema (renderizado en servidor)
│   │   ├── crear.astro / editar/[id].astro / mis-cuestionarios.astro
│   │   ├── user-quiz/[id].astro  # Cuestionario de usuario
│   │   ├── prompt.astro          # Prompt para generar JSON con IA
│   │   ├── sobre.astro / contact.astro / privacy-policy.astro / terms.astro
│   │   ├── sitemap.xml.ts
│   │   └── api/
│   │       ├── quizzes.ts, quizzes/[id].ts, quizzes/[id]/report.ts
│   │       ├── generate-quiz-from-pdf.ts
│   │       ├── admin/export.ts
│   │       └── cron/cleanup-rate-limits.ts
│   └── styles/
│       └── global.css            # Todos los estilos y tokens de diseño
├── sql/                          # Migraciones (pnpm db:migrate)
├── scripts/                      # run-sql.mjs, env-dev.mjs
├── tests/                        # node --test
├── neon-setup.sql                # Esquema inicial
└── vercel.json                   # Cron diario de limpieza de rate limits
```

---

## Cuestionarios de usuarios

Los usuarios pueden crear sus propios cuestionarios subiendo un PDF, subiendo un archivo JSON o pegando JSON.

### Formato del JSON

```json
{
  "title": "Repaso Tema 1",
  "description": "Cuestionario de ejemplo",
  "grado": "1asir",
  "course_id": "pni",
  "unidad": "ud1",
  "questions": [
    {
      "question": "¿Cuál es la pregunta?",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "answer": 0,
      "explanation": "Explicación de la respuesta correcta."
    }
  ]
}
```

### Campos obligatorios

| Campo       | Descripción                           |
|------------|--------------------------------------|
| `grado`    | ID del grado (ej: `1asir`, `1bach`)   |
| `course_id` | ID del curso (ej: `pni`, `digitalizacion`) |
| `questions`| Array con entre 20 y 50 preguntas     |

### Campos opcionales

| Campo         | Descripción                      |
|--------------|--------------------------------|
| `title`       | Título del cuestionario           |
| `description`| Descripción o notas              |
| `unidad`     | ID de unidad (ej: `ud1`, `tema1`)|

### Validación

El sistema valida automáticamente:
- Que sea un JSON válido
- Que tenga los campos obligatorios
- Que cada pregunta tenga 4 opciones
- Que `answer` sea un índice válido (0-3)
- Que no haya opciones vacías

---

## Prompt para generar JSON con IA

Copia este prompt en ChatGPT, Claude, Gemini, etc. junto con el contenido del tema:

```
Necesito que generes un cuestionario tipo test en formato JSON basado en el contenido que te proporcione.

REGLAS:
1. Genera entre 20 y 50 preguntas de tipo test.
2. Cada pregunta debe tener exactamente 4 opciones de respuesta.
3. Solo UNA opción debe ser correcta.
4. Incluye una explicación para cada respuesta correcta.
5. Las opciones incorrectas deben ser plausibles.
6. La respuesta correcta debe estar en posiciones aleatorias (no siempre la primera).

FORMATO JSON:
{
  "title": "Nombre del tema",
  "description": "Descripción opcional",
  "grado": "1asir",
  "course_id": "pni",
  "unidad": "ud1",
  "questions": [
    {
      "question": "Texto de la pregunta",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "answer": 0,
      "explanation": "Explicación breve."
    }
  ]
}

Donde "answer" es el índice (0-3) de la opción correcta.
```

### Cómo usar el JSON generado

1. Ve a `/crear`
2. Arrastra el archivo JSON o pega el contenido
3. Escribe o selecciona grado, curso y unidad
4. Guarda

---

## Base de datos (Neon)

Los cuestionarios se guardan en **Neon Postgres**.

### Tabla (actualizada)

```sql
CREATE TABLE IF NOT EXISTS user_quizzes (
  id SERIAL PRIMARY KEY,
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  grado TEXT NOT NULL,
  course_id TEXT NOT NULL,
  unidad TEXT DEFAULT '',
  questions JSONB NOT NULL,
  quiz_hash TEXT,
  owner_token TEXT DEFAULT '',
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_quizzes_grado ON user_quizzes(grado);
CREATE INDEX IF NOT EXISTS idx_user_quizzes_created ON user_quizzes(created_at DESC);
```

Las migraciones actuales están en `sql/public-growth-practices.sql` y `sql/rate-limits.sql` (`pnpm db:migrate` ejecuta ambas).

### Variables de entorno

| Variable      | Descripción              |
|---------------|------------------------|
| `DATABASE_URL`| Connection string de Neon|
| `GROQ_API_KEY`| Clave de Groq para generar desde PDF |
| `GROQ_MODEL`| Modelo de Groq, opcional |
| `ADMIN_API_KEY`| Clave admin para export y borrados admin |
| `CRON_SECRET`| Protege `/api/cron/cleanup-rate-limits` |
| `PUBLIC_ADSENSE_CLIENT` / `PUBLIC_ADSENSE_SLOT` | Cliente y bloque de AdSense |
| `PUBLIC_ADSENSE_INFEED_SLOT` / `PUBLIC_ADSENSE_INFEED_LAYOUT_KEY` | Bloque in-feed de los listados (opcional) |
| `PUBLIC_ENABLE_ADS`| `true` para servir anuncios |
| `PUBLIC_CONTACT_EMAIL`| Email de la página de contacto |
| `SENTRY_AUTH_TOKEN`| Subida de source maps a Sentry en el build |

La plantilla completa está en `.env.example`.

---

## Deploy en Vercel

1. Sube a GitHub
2. Conecta el repo a **Vercel**
3. Añade **Neon** desde **Storage** → **Create Database**
4. Deploy automático en cada push

### Entornos

| Entorno | Rama git | Base de datos (Neon) | URL |
|---------|----------|----------------------|-----|
| Producción | `main` | rama `main` | https://cuestionario.online |
| Pruebas | `dev` | rama `dev` | preview de Vercel de la rama `dev` |
| Local | cualquiera | rama `dev` | http://localhost:4321 |

La rama `dev` de Neon es una copia de producción: se puede crear, borrar y probar sin afectar a los datos reales.
En Vercel, `DATABASE_URL` y `DATABASE_URL_UNPOOLED` tienen un valor específico para la rama git `dev` (Preview → dev).

Flujo de trabajo: trabajar en `dev` → push → revisar el preview → merge a `main`.

### Development local

```bash
# Una sola vez: iniciar sesión en Vercel y Neon
pnpm dlx vercel@64.7.0 login && pnpm dlx vercel@64.7.0 link
pnpm dlx neon@8.0.10 auth

# Variables de producción -> .env.production.local (no se usa en `pnpm dev`)
pnpm env:pull

# Genera .env apuntando a la rama Neon "dev"
pnpm env:dev

# Ejecutar
pnpm dev
```

Para refrescar los datos de `dev` con los de producción: consola de Neon → Branches → `dev` → **Reset from parent**.

---

## Resumen rápido

| Quiero...                  | Dónde hacerlo             |
|---------------------------|------------------------|
| Practicar con cuestionarios | Navega por los grados    |
| Crear mi cuestionario    | `/crear` → subir PDF o JSON |
| Ver mis cuestionarios    | `/mis-cuestionarios`  |
| Generar preguntas con IA | Copia el prompt de arriba |

---

## Cambios recientes y buenas prácticas añadidas

Esta sección documenta las mejoras añadidas para que la aplicación pueda seguir siendo pública, pero con más control operativo.

La idea principal no es cerrar la app con login. La idea es que cualquiera pueda leer y crear cuestionarios, pero evitando datos rotos, abuso básico y pérdidas accidentales.

### 1. Generación de cuestionarios desde PDF

Archivos principales:

```text
src/pages/api/generate-quiz-from-pdf.ts
src/lib/server/generateQuizFromPdf.ts
src/components/CreateQuiz.jsx
```

Qué hace:

- Permite subir un PDF desde `/crear`.
- Extrae texto con `pdf-parse`.
- Envía el contenido a Groq.
- Pide a la IA un JSON con entre 20 y 50 preguntas.
- Valida el resultado antes de mostrarlo o guardarlo.

Por qué:

- Evita tener que copiar el contenido del temario manualmente.
- Mantiene el mismo formato validado que los JSON subidos a mano.
- Reduce errores porque el JSON generado no se guarda directamente: primero pasa por el validador.

Controles añadidos:

- Solo acepta `.pdf`.
- Límite de 10 MB por PDF.
- Timeout de 45 segundos en la llamada a Groq.
- Mensajes de error controlados.

Variables necesarias:

```env
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
```

### 2. Validación centralizada

Archivos:

```text
src/lib/quizValidator.ts
src/lib/quizLimits.ts
```

Qué hace:

- Valida que el quiz tenga `grado`, `course_id` y `questions`.
- Exige entre 20 y 50 preguntas.
- Exige exactamente 4 opciones por pregunta.
- Exige que `answer` sea un entero entre 0 y 3.
- Rechaza opciones vacías.
- Rechaza textos demasiado largos.

Por qué:

- Antes el frontend validaba más que el backend.
- Si alguien llamaba directamente a la API, podía guardar datos mal formados.
- Ahora frontend y backend usan las mismas reglas.

### 3. Normalización de slugs

Archivo:

```text
src/lib/slug.ts
```

Qué hace:

- Convierte valores como `grado`, `course_id` y `unidad` a texto limpio en minúsculas.

Por qué:

- Evita duplicados como `1ASIR`, `1asir` y ` 1asir `.
- Hace que rutas, filtros y búsquedas coincidan mejor.

### 4. Variables de entorno centralizadas

Archivo:

```text
src/lib/server/env.ts
```

Qué hace:

- Centraliza lectura de `DATABASE_URL`, `GROQ_API_KEY`, `GROQ_MODEL` y `ADMIN_API_KEY`.
- Lanza errores claros cuando falta una variable obligatoria.

Por qué:

- Evita repetir `import.meta.env...` en muchos archivos.
- Hace más fácil saber qué variable falta cuando algo falla.

### 5. Respuestas HTTP y errores consistentes

Archivo:

```text
src/lib/server/http.ts
```

Qué hace:

- Centraliza respuestas JSON.
- Devuelve errores internos con más detalle en desarrollo.
- Oculta detalles técnicos en producción.

Por qué:

- Evita respuestas inconsistentes entre endpoints.
- Reduce riesgo de filtrar información sensible en producción.

### 6. Rate limiting básico

Archivo:

```text
src/lib/server/rateLimit.ts
```

Límites actuales:

| Acción | Límite |
| --- | --- |
| Crear quiz | 20 por hora/IP |
| Generar desde PDF | 5 por hora/IP |
| Reportar quiz | 10 por hora/IP |
| Borrar quiz | 30 por hora/IP |

Por qué:

- La app permite creación pública.
- Sin límites, un bot podría llenar la base de datos o gastar llamadas a Groq.

Cómo se guarda:

- Cada petición se registra en la tabla `rate_limits` de Postgres (`sql/rate-limits.sql`), así el límite se comparte entre instancias serverless.
- Las filas caducadas se borran de vez en cuando durante las peticiones y con un cron diario (`vercel.json` → `/api/cron/cleanup-rate-limits`, protegido con `CRON_SECRET`).

### 7. Paginación y búsqueda

Archivo principal:

```text
src/pages/api/quizzes.ts
```

Cliente:

```text
src/lib/api.ts
src/components/MyQuizzes.jsx
```

Qué hace:

- `GET /api/quizzes` acepta `limit`, `offset`, `q` y `grado`.
- Devuelve el total en el header `X-Total-Count`.
- La pantalla `/mis-cuestionarios` permite buscar y paginar.

Ejemplo:

```text
GET /api/quizzes?limit=24&offset=0&q=redes
```

Por qué:

- Cargar todos los cuestionarios funciona al principio, pero escala mal.
- La paginación evita respuestas enormes.
- La búsqueda hace usable el listado cuando crezca.

### 8. Soft delete

Archivos:

```text
src/pages/api/quizzes/[id].ts
sql/public-growth-practices.sql
```

Qué hace:

- Borrar ya no elimina la fila.
- Marca `deleted_at = NOW()`.
- Los listados solo muestran quizzes con `deleted_at IS NULL`.

Por qué:

- Permite recuperar información si se borra algo por error.
- Conserva historial para auditoría.
- Evita pérdidas irreversibles.

### 9. Propiedad ligera con token local

Archivos:

```text
src/lib/ownerToken.ts
src/lib/api.ts
src/components/MyQuizzes.jsx
```

Qué hace:

- Crea un token aleatorio en `localStorage`.
- Ese token se envía al crear un quiz.
- Permite listar “creados en este navegador”.
- Permite borrar esos cuestionarios propios.

Por qué:

- Mantiene la app sin registro.
- Da una forma básica de gestionar lo que uno ha creado.

Limitación:

- Si el usuario borra el navegador/localStorage, pierde ese vínculo.
- No sustituye a una autenticación real.

### 10. Borrado protegido

Archivo:

```text
src/pages/api/quizzes/[id].ts
```

Quién puede borrar:

- El navegador que creó el quiz, mediante `x-owner-token`.
- Un admin, mediante `x-admin-api-key`.

Por qué:

- Cualquiera puede crear, pero no cualquiera debe poder borrar contenido ajeno.

### 11. Deduplicación

Archivo:

```text
src/lib/server/hash.ts
src/pages/api/quizzes.ts
```

Qué hace:

- Calcula un `quiz_hash` con título, grado, curso, unidad y preguntas.
- Rechaza duplicados activos con HTTP `409`.

Por qué:

- Evita que el mismo quiz se cree repetidamente por doble click, reintentos o importaciones duplicadas.

### 12. Reportes de cuestionarios

Archivos:

```text
src/pages/api/quizzes/[id]/report.ts
src/components/UserQuiz.jsx
```

Qué hace:

- Añade un formulario para reportar un cuestionario.
- Guarda el motivo en `quiz_reports`.
- Registra auditoría del reporte.

Por qué:

- En una app pública siempre puede aparecer contenido incorrecto o inapropiado.
- Reportar permite moderar después sin impedir la creación pública.

### 13. Auditoría

Archivo:

```text
src/lib/server/audit.ts
```

Tabla:

```text
audit_logs
```

Eventos actuales:

- `quiz_created`
- `quiz_reported`
- `quiz_soft_deleted`

Por qué:

- Ayuda a saber qué ha pasado si hay problemas.
- Facilita depurar abusos, borrados y actividad anómala.

### 14. Export admin

Archivo:

```text
src/pages/api/admin/export.ts
```

Endpoint:

```text
GET /api/admin/export
```

Requiere header:

```text
x-admin-api-key: <ADMIN_API_KEY>
```

Exporta:

- cuestionarios
- reportes
- últimos eventos de auditoría

Por qué:

- Sirve como backup manual.
- Facilita migrar datos o revisar el estado de la app.

### 15. Migraciones SQL

Archivos:

```text
sql/public-growth-practices.sql
scripts/run-sql.mjs
```

Comando:

```bash
pnpm db:migrate
```

Qué hace:

- Lee `DATABASE_URL` desde `.env`.
- Ejecuta las sentencias de `sql/public-growth-practices.sql`.
- Crea columnas y tablas necesarias para soft delete, reportes, auditoría y deduplicación.

Por qué:

- El código puede requerir columnas nuevas como `deleted_at`.
- Si la base no tiene esas columnas, la API falla.
- Tener un comando documentado evita hacerlo manualmente cada vez.

### 16. Tests

Comando:

```bash
pnpm test
```

| Archivo | Qué cubre |
| --- | --- |
| `tests/quizValidator.test.mjs` | Quiz válido, `answer` no entero, número de preguntas, contenido demasiado largo |
| `tests/adsenseReadiness.test.mjs` | `ads.txt`, `robots.txt`, páginas legales enlazadas, soft-404, sitemap, sin anuncios en páginas sensibles |
| `tests/feedAds.test.mjs` | Posiciones de los anuncios in-feed en los listados |
| `tests/uxBehavior.test.mjs` | Borrado con deshacer (deshacer, expirar, reemplazar, error de API, salir de la página) y scroll con movimiento reducido |

Por qué:

- El validador protege la calidad de datos.
- Los tests de AdSense evitan romper requisitos de la revisión sin darse cuenta.

### 17. CI

Archivo:

```text
.github/workflows/ci.yml
```

Qué ejecuta:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm run build
```

Por qué:

- Evita subir cambios que rompan validación o build.
- Da una comprobación automática en pushes y pull requests.

### 18. Archivos ignorados

`.gitignore` ahora ignora:

```text
.env
.astro
dist
node_modules
```

Por qué:

- `.env` contiene secretos.
- `.astro` y `dist` son generados.
- `node_modules` no se versiona.

Si `.env` estuvo trackeado antes, hay que sacarlo del índice:

```bash
git rm --cached -f .env
```

Y si llegó al remoto, hay que rotar esas claves.

### 19. Resumen operativo

Después de clonar o actualizar:

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

Antes de subir cambios:

```bash
pnpm test
pnpm build
```

Para probar que la API responde:

```bash
curl http://localhost:4321/api/quizzes
```

Para exportar como admin:

```bash
curl -H "x-admin-api-key: $ADMIN_API_KEY" http://localhost:4321/api/admin/export
```

### 20. Decisión de producto

La app sigue siendo pública:

- Cualquiera puede leer.
- Cualquiera puede crear.
- Cualquiera puede reportar.

Las buenas prácticas añadidas controlan daños sin bloquear el uso:

- Validación evita datos rotos.
- Rate limit reduce abuso.
- Soft delete permite recuperar.
- Reportes permiten moderar.
- Deduplicación reduce ruido.
- Auditoría ayuda a investigar.
- Export facilita backups.
- Token local permite gestión básica sin login.

---

## Publicidad (AdSense)

- Los anuncios solo se sirven si `PUBLIC_ENABLE_ADS=true` y hay cliente configurado (`src/lib/ads.ts`).
- Nunca en páginas sensibles: `/crear`, `/mis-cuestionarios`, `/editar/*`, `/user-quiz/*` ni en las páginas de tema (`/grado/curso/unidad`), donde se repasa y se hace el test.
- En los listados se intercalan anuncios in-feed como una fila más, siempre etiquetados como anuncio (`src/lib/feedAds.ts`: tras la 3.ª tarjeta, luego cada 8, máximo 3).
- Un hueco de anuncio solo ocupa espacio cuando hay un anuncio servido y visible (`.is-filled`). Si no, queda a 0 px para no dejar huecos ni mover el contenido.
- **Texto para la revisión:** el contexto largo (introducciones, descripciones de asignaturas, guía de estudio, "Cómo funciona") va en desplegables `<details class="more-info">`. Sigue en el HTML del servidor, y Google lo indexa igual. **No ocultar texto con CSS solo para buscadores** (`display:none`, `sr-only`, fuera de pantalla): las políticas de Google lo tratan como texto oculto y puede costar la aprobación.

---

## Diseño e interacción

Criterios aplicados tras una auditoría con la skill *apple-design*. Mantenerlos al añadir UI.

### Tokens y tema

- Todos los colores son variables en `:root` de `global.css` definidas con `light-dark(claro, oscuro)`. No usar colores fijos en componentes; si hace falta uno nuevo, añadir un token.
- El tema lo decide `color-scheme`. Sin `data-theme` en `<html>` sigue al sistema; `data-theme="light" | "dark"` lo fija.
- El selector claro / oscuro / sistema está en el header (`Layout.astro`). La elección se guarda en `localStorage` (`cuestionario.theme`) y la aplica un script inline en `<head>` antes del primer pintado, para que no haya parpadeo. El cambio usa un fundido con View Transitions y se sincroniza entre pestañas.
- Se respetan `prefers-contrast: more` (bordes y texto secundario más marcados) y `prefers-reduced-transparency` (barras translúcidas pasan a sólidas).
- Fuente del sistema y `font-size: 100%`, para respetar el tamaño de letra del usuario.

### Tarjetas de listado

- Una sola tarjeta para cursos, asignaturas y cuestionarios: filas (`.grado-card` / `.unit-card`) dentro de un contenedor con borde (`.unit-grid`, `.grade-grid`, `.course-list-transition`).
- Contenido: título y una línea de datos en monoespaciada, con la etiqueta de la asignatura en morado (`.card-tag`).
- La acción es una píldora lila con flecha. Al pasar el ratón, la fila se tiñe de morado, aparece una barra morada a la izquierda (inset) y la píldora se rellena.
- El morado de la marca debe seguir presente: no dejar las tarjetas en gris.

### Movimiento

- Respuesta al pulsar (`:active`, `scale(0.97)` en 60 ms) en botones, opciones del test y filas.
- Solo se animan `transform` y `opacity`. Nada de animar `height`, `max-height`, `margin` ni `padding`. Para mover algo que cambia de sitio por layout, usar FLIP (ejemplo: el buscador de la portada en `LandingCourses.jsx`).
- Curva por defecto `--ease-out` (sin rebote). Rebote solo si viene de un gesto con inercia.
- Entradas y salidas por el mismo camino con `data-state="open" | "closing"` y `useExitTransition` (200 ms). Lo usan el editor modal, el aviso de envío, la caja de reporte y `UndoToast`.
- Movimiento reducido: el CSS cambia el movimiento por fundidos de 150 ms y el JS usa `scrollBehavior()` de `src/lib/motion.ts`.
- Al cambiar de vista (empezar test, corregir, volver al repaso) se llama a `showViewStart()` después de pintar, con salto directo. Al empezar un test garantiza que la primera pregunta se ve entera.

### Deshacer en vez de confirmar

- Lo que se puede recuperar se hace al instante y muestra un `UndoToast` de 6 s: borrar una pregunta en el editor, descartar un test a medias, eliminar un cuestionario.
- Eliminar un cuestionario es optimista (`usePendingDeletion`): la petición se envía cuando caduca el aviso, o con `keepalive` si se sale de la página. Si falla, el elemento vuelve a su sitio.
- `window.confirm` queda solo para lo irreversible (descartar cambios sin guardar del editor).

### Accesibilidad

- Zonas táctiles de 44 px en pantallas táctiles.
- Editor modal: Escape cierra, el foco queda atrapado dentro y vuelve al botón que lo abrió.
- Escape también cierra la caja de reporte y el aviso de envío.


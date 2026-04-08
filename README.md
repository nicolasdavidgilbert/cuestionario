# 📝 Cuestionarios

Aplicación web de cuestionarios interactivos construida con **React + Vite**. 100% estática, sin backend, desplegable gratis en **Vercel**.

---

## 🚀 Inicio rápido

```bash
# Instalar dependencias
pnpm install

# Desarrollo local
pnpm dev          # → http://localhost:5173

# Build de producción
pnpm build        # → genera /dist
pnpm preview      # → previsualizar el build
```

> El catálogo `public/catalog.json` se regenera automáticamente cada vez que ejecutas `dev` o `build`.

---

## 📂 Estructura del proyecto

```
cuestionarios/
├── public/
│   ├── questions/                ← ⭐ Aquí van todos los exámenes
│   │   ├── 1asir/                ← Carpeta del grado/curso
│   │   │   ├── idp/              ← Carpeta de la asignatura
│   │   │   │   └── ud1.json      ← Archivo del examen
│   │   │   ├── pni/
│   │   │   │   ├── ud1.json
│   │   │   │   └── ud2.json
│   │   │   ├── gtb/
│   │   │   │   └── ud2.json
│   │   │   └── digitalizacion/
│   │   │       └── ud1.json
│   │   └── 1bach/                ← Otro grado (vacío por ahora)
│   ├── catalog.json              ← Auto-generado, NO editar
│   └── favicon.svg
├── src/
│   ├── main.jsx                  ← Punto de entrada React
│   ├── App.jsx                   ← Router principal
│   ├── index.css                 ← Estilos globales
│   └── pages/
│       ├── Landing.jsx           ← Selección de grado
│       ├── Catalog.jsx           ← Lista de asignaturas y temas
│       └── Quiz.jsx              ← Cuestionario interactivo
├── generate-catalog.js           ← Script que genera catalog.json
├── vercel.json                   ← Config para deploy en Vercel
├── package.json
└── vite.config.ts
```

---

## ➕ Cómo añadir un nuevo examen

### 1. Identificar la ruta

La estructura de carpetas sigue este patrón:

```
public/questions/{grado}/{asignatura}/{unidad}.json
```

Ejemplo: para añadir la Unidad 3 de PNI en 1º ASIR:

```
public/questions/1asir/pni/ud3.json
```

### 2. Crear el archivo JSON

Crea el archivo `.json` con el formato descrito más abajo y colócalo en la carpeta correspondiente.

### 3. Regenerar el catálogo

Simplemente ejecuta de nuevo `pnpm dev` o `pnpm build` y el catálogo se actualiza solo. No hay nada más que hacer.

---

## ➕ Cómo añadir un nuevo grado/curso

1. Crea una carpeta dentro de `public/questions/` con el ID del grado (en minúsculas, sin espacios ni tildes):

```bash
mkdir -p public/questions/2asir
```

2. Abre `generate-catalog.js` y añade una entrada en el objeto `GRADOS_META`:

```javascript
const GRADOS_META = {
  '1asir': { label: '1º ASIR', description: 'Administración de Sistemas Informáticos en Red' },
  '1bach': { label: '1º BACH', description: 'Bachillerato' },
  '2asir': { label: '2º ASIR', description: 'Segundo curso de ASIR' },  // ← NUEVA
};
```

3. Dentro de la carpeta del grado, crea subcarpetas para cada asignatura y añade los JSON de los exámenes.

4. Ejecuta `pnpm dev` y listo.

---

## ➕ Cómo añadir una nueva asignatura

Simplemente crea una carpeta nueva dentro del grado:

```bash
mkdir -p public/questions/1asir/lmsgi
```

Y coloca dentro los archivos JSON de las unidades (`ud1.json`, `ud2.json`, etc.).

El nombre de la carpeta se usará como etiqueta (en mayúsculas) en la web. Por ejemplo, `lmsgi` se mostrará como **LMSGI**.

---

## 📋 Formato del JSON de examen

Cada archivo JSON es un **array** donde:

- El **primer elemento** (opcional) contiene solo el campo `title` con el título del tema.
- El **resto de elementos** son las preguntas.

```json
[
    {
        "title": "Unidad Didáctica 1: Nombre del Tema"
    },
    {
        "question": "¿Cuál es la pregunta?",
        "options": [
            "Opción A (correcta)",
            "Opción B",
            "Opción C",
            "Opción D"
        ],
        "answer": 0,
        "explanation": "Explicación de por qué la opción A es correcta."
    },
    {
        "question": "¿Segunda pregunta?",
        "options": [
            "Opción A",
            "Opción B (correcta)",
            "Opción C",
            "Opción D"
        ],
        "answer": 1,
        "explanation": "Explicación de por qué la opción B es correcta."
    }
]
```

### Campos de cada pregunta

| Campo         | Tipo     | Obligatorio | Descripción                                                                 |
|---------------|----------|-------------|-----------------------------------------------------------------------------|
| `question`    | string   | ✅          | Texto de la pregunta                                                        |
| `options`     | string[] | ✅          | Array con 4 opciones de respuesta                                           |
| `answer`      | number   | ✅          | Índice (0-3) de la opción correcta                                          |
| `explanation` | string   | ✅          | Explicación breve de por qué es correcta esa respuesta                      |

> **Nota:** La app selecciona **15 preguntas aleatorias** cada vez que cargas un cuestionario, así que cuantas más preguntas tenga el JSON, más variado será.

---

## 🤖 Prompt para generar preguntas con IA

Copia y pega este prompt en cualquier IA (ChatGPT, Claude, Gemini, etc.) junto con el PDF o texto del tema:

---

````
Necesito que leas el siguiente documento/PDF y generes un cuestionario tipo test en formato JSON.

REGLAS:
1. Genera entre 30 y 50 preguntas de tipo test basadas EXCLUSIVAMENTE en el contenido del documento.
2. Cada pregunta debe tener exactamente 4 opciones de respuesta.
3. Solo UNA opción debe ser correcta.
4. Incluye una explicación breve para cada respuesta correcta, citando o parafraseando el documento.
5. Las preguntas deben cubrir TODOS los apartados del documento de forma equilibrada.
6. Varía la dificultad: incluye preguntas fáciles, medias y difíciles.
7. La posición de la respuesta correcta debe variar aleatoriamente (no siempre la primera opción).
8. Las opciones incorrectas deben ser plausibles, no absurdas.

FORMATO DE SALIDA:
Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta (sin texto adicional antes o después):

```json
[
    {
        "title": "Nombre del tema o unidad didáctica"
    },
    {
        "question": "Texto de la pregunta",
        "options": [
            "Opción A",
            "Opción B",
            "Opción C",
            "Opción D"
        ],
        "answer": 0,
        "explanation": "Explicación de por qué la respuesta correcta es correcta."
    }
]
```

Donde "answer" es el índice (0, 1, 2 o 3) de la opción correcta en el array "options".

DOCUMENTO:
[Pega aquí el contenido del PDF o adjunta el archivo]
````

---

### Después de generar el JSON:

1. Copia el JSON generado por la IA.
2. Guárdalo como archivo `.json` en la ruta correcta:
   ```
   public/questions/{grado}/{asignatura}/{unidad}.json
   ```
3. Ejecuta `pnpm dev` o `pnpm build` para regenerar el catálogo.
4. ¡Listo! El nuevo cuestionario aparecerá automáticamente en la web.

---

## 🌐 Deploy en Vercel

1. Sube el proyecto a un repositorio de GitHub.
2. Ve a [vercel.com](https://vercel.com) e importa el repositorio.
3. Vercel detectará Vite automáticamente. Configuración por defecto: 
   - **Build Command:** `pnpm build` (o `npm run build`)
   - **Output Directory:** `dist`
4. Haz clic en **Deploy** y listo.

Cada vez que hagas push al repositorio, Vercel re-desplegará automáticamente.

---

## 📌 Resumen rápido

| Quiero...                        | Qué hago                                                                                 |
|----------------------------------|------------------------------------------------------------------------------------------|
| Añadir un examen nuevo           | Creo un `.json` en `public/questions/{grado}/{asignatura}/` y ejecuto `pnpm dev`         |
| Añadir una asignatura nueva      | Creo una carpeta en `public/questions/{grado}/` y meto los JSON dentro                   |
| Añadir un grado/curso nuevo      | Creo la carpeta en `public/questions/`, actualizo `GRADOS_META` en `generate-catalog.js` |
| Generar preguntas desde un PDF   | Uso el prompt de IA de arriba y guardo el JSON resultante                                |
| Desplegar en producción          | Push a GitHub → Vercel despliega automáticamente                                         |

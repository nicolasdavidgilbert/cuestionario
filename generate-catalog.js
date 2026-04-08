import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const questionsDir = path.resolve(__dirname, 'public/questions');

// Metadata for each "grado"
const GRADOS_META = {
  '1asir': { label: '1º ASIR', description: 'Administración de Sistemas Informáticos en Red' },
  '1bach': { label: '1º BACH', description: 'Bachillerato' },
};

const catalog = { grados: [] };

if (fs.existsSync(questionsDir)) {
  for (const grado of fs.readdirSync(questionsDir).sort()) {
    const gradoPath = path.join(questionsDir, grado);
    if (!fs.statSync(gradoPath).isDirectory()) continue;

    const meta = GRADOS_META[grado.toLowerCase()] || {
      label: grado.toUpperCase(),
      description: '',
    };

    const courses = [];

    for (const course of fs.readdirSync(gradoPath).sort()) {
      const coursePath = path.join(gradoPath, course);
      if (!fs.statSync(coursePath).isDirectory()) continue;

      const units = [];
      for (const fname of fs.readdirSync(coursePath).sort()) {
        if (!fname.toLowerCase().endsWith('.json')) continue;
        const unit = path.parse(fname).name.toLowerCase();

        let title = '';
        try {
          const data = JSON.parse(fs.readFileSync(path.join(coursePath, fname), 'utf-8'));
          if (Array.isArray(data) && data[0] && data[0].title) {
            title = data[0].title;
          }
        } catch (e) {}

        units.push({
          id: unit,
          path: `/${grado.toLowerCase()}/${course.toLowerCase()}/${unit}`,
          title,
        });
      }

      if (units.length > 0) {
        courses.push({
          id: course.toLowerCase(),
          label: course.toUpperCase(),
          units,
        });
      }
    }

    catalog.grados.push({
      id: grado.toLowerCase(),
      label: meta.label,
      description: meta.description,
      courses,
    });
  }
}

fs.writeFileSync(
  path.resolve(__dirname, 'public/catalog.json'),
  JSON.stringify(catalog, null, 2)
);
console.log('Catálogo generado en public/catalog.json');

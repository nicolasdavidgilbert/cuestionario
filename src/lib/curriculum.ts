// Nombres y descripciones legibles de cursos y asignaturas.
// La base de datos solo guarda identificadores cortos (1asir, pni, fuw...): aquí se traducen
// para que cada página explique qué se estudia en ella.

export interface GradeInfo {
  name: string
  short: string
  description: string
}

export interface CourseInfo {
  name: string
  description: string
}

const GRADES: Record<string, GradeInfo> = {
  '1asir': {
    name: '1.º de ASIR',
    short: 'Primer curso de Administración de Sistemas Informáticos en Red',
    description:
      'Primer curso del ciclo formativo de grado superior en Administración de Sistemas Informáticos en Red (ASIR). ' +
      'Reúne los fundamentos del ciclo: hardware y centros de datos, sistemas operativos, redes de ordenadores, bases de datos ' +
      'y digitalización. Los cuestionarios están pensados para repasar cada tema antes de un examen y detectar qué conceptos fallan.'
  },
  '2asir': {
    name: '2.º de ASIR',
    short: 'Segundo curso de Administración de Sistemas Informáticos en Red',
    description:
      'Segundo curso del ciclo de grado superior en Administración de Sistemas Informáticos en Red (ASIR). ' +
      'Se centra en la administración práctica: acceso remoto y gestión de servidores, sistemas gestores de bases de datos ' +
      'y servicios de red. Los cuestionarios repasan comandos, configuraciones y conceptos que suelen aparecer en exámenes y prácticas.'
  }
}

const COURSES: Record<string, CourseInfo> = {
  digitalizacion: {
    name: 'Digitalización aplicada a los sectores productivos',
    description:
      'Transformación digital de las empresas y tecnologías habilitadoras como el big data, la nube, el IoT o la inteligencia artificial.'
  },
  fuw: {
    name: 'Fundamentos de hardware',
    description:
      'Componentes físicos de los equipos, almacenamiento y sistemas RAID, copias de seguridad, clonación de discos y diseño de centros de proceso de datos (CPD).'
  },
  gtb: {
    name: 'Gestión de bases de datos',
    description:
      'Diseño y consulta de bases de datos relacionales con SQL: consultas básicas, transacciones y niveles de aislamiento.'
  },
  idp: {
    name: 'Implantación de sistemas operativos',
    description:
      'Conceptos de sistemas operativos: funciones, tipos, gestión de procesos, memoria y ficheros, e instalación y configuración.'
  },
  pni: {
    name: 'Planificación y administración de redes',
    description:
      'Redes de ordenadores desde la capa física hasta la de red: señales y medios de transmisión, modelos OSI y TCP/IP, routers, enrutamiento estático y RIPv2.'
  },
  add: {
    name: 'Administración de sistemas operativos',
    description:
      'Administración de servidores y acceso remoto: SSH, VNC, RDP y PowerShell Remoting en entornos Linux y Windows.'
  },
  ade: {
    name: 'Administración de sistemas gestores de bases de datos',
    description:
      'Instalación, configuración y administración de sistemas gestores como MySQL y MariaDB en servidores Linux.'
  }
}

export function getGradeInfo(gradeId: string): GradeInfo {
  return GRADES[gradeId?.toLowerCase()] ?? {
    name: gradeId?.toUpperCase() ?? '',
    short: `Cuestionarios de ${gradeId?.toUpperCase() ?? ''}`,
    description: `Cuestionarios tipo test de ${gradeId?.toUpperCase() ?? ''} organizados por asignatura y tema.`
  }
}

export function getCourseInfo(courseId: string): CourseInfo {
  return COURSES[courseId?.toLowerCase()] ?? {
    name: courseId?.toUpperCase() ?? '',
    description: ''
  }
}

export function getCourseName(courseId: string): string {
  return getCourseInfo(courseId).name
}

// Genera el hash de la contraseña administradora para ADMIN_PASSWORD_HASH.
// Uso: pnpm admin:password   (pide la contraseña dos veces sin mostrarla)
import { createInterface } from 'node:readline'
import { hashPassword } from '../src/lib/server/password.ts'

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    // Oculta lo que se escribe: solo se muestra la pregunta.
    rl._writeToOutput = (text) => { if (text.includes(question)) process.stdout.write(text) }
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

const password = await ask('Nueva contraseña: ')
if (password.length < 12) {
  console.error('La contraseña debe tener al menos 12 caracteres.')
  process.exit(1)
}
if (await ask('Repite la contraseña: ') !== password) {
  console.error('Las contraseñas no coinciden.')
  process.exit(1)
}

const hash = await hashPassword(password)
console.log('\nAñade esta línea a .env (y el valor, sin el nombre, como variable de entorno en Vercel):')
console.log(`ADMIN_PASSWORD_HASH=${hash}`)
console.log('\nAl cambiarla, las sesiones abiertas siguen activas hasta caducar; ciérralas desde el panel si es necesario.')

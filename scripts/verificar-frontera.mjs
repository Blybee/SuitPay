import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Comprueba que el paquete del navegador no contenga nada privilegiado.
 *
 * ## Por qué esto existe si ya hay una regla de ESLint
 *
 * La regla de ESLint vigila las *rutas de importación* que escribimos, y por eso
 * se puede rodear sin querer: un `import()` construido con una variable, una
 * dependencia que reexporta el adaptador, un archivo nuevo en `routes/api/` que un
 * día gana un `component` y arrastra el Admin SDK al cliente. En todos esos casos
 * el linter dice que todo está bien y el paquete cuenta otra historia.
 *
 * Esta comprobación mira **el resultado**, que es el único lugar donde la fuga
 * sería real. Es la diferencia entre confiar en la disciplina y verificar el
 * hecho, y para el token del proveedor la diferencia importa: quien lo obtenga
 * puede emitir comprobantes tributarios en nombre del negocio.
 */

const CLIENTE = 'dist/client/assets'

/**
 * Lo que no puede aparecer, y la razón por la que cada rastro es grave.
 *
 * Son cadenas literales y no expresiones regulares a propósito: se comparan
 * contra código minificado, donde los nombres locales desaparecen pero los
 * nombres de módulo, las claves de objeto y los literales de texto sobreviven.
 */
const PROHIBIDOS = [
  {
    rastro: 'factpro',
    porque:
      'el adaptador del proveedor llegó al navegador; con él viajan su URL y la forma de su autenticación',
  },
  {
    rastro: 'firebase-admin',
    porque:
      'el Admin SDK llegó al navegador; ignora las reglas de seguridad, así que sería una llave maestra sobre Firestore',
  },
  {
    rastro: 'FACTPRO_TOKEN',
    porque: 'el nombre del secreto del proveedor quedó expuesto',
  },
  {
    rastro: 'SECRETO_DE_TAREAS',
    porque:
      'el secreto que protege las rutas de tareas quedó expuesto; cualquiera podría disparar la reconciliación',
  },
  {
    rastro: 'serviceAccountKey',
    porque: 'una credencial de cuenta de servicio quedó incrustada',
  },
]

async function archivosDelCliente() {
  try {
    const nombres = await readdir(CLIENTE)
    return nombres.filter((n) => n.endsWith('.js')).map((n) => join(CLIENTE, n))
  } catch {
    return undefined
  }
}

const archivos = await archivosDelCliente()

if (archivos === undefined || archivos.length === 0) {
  // No hay nada que verificar todavía. Se falla en lugar de pasar en silencio:
  // una comprobación que aprueba cuando no encontró qué mirar es peor que no
  // tenerla, porque da la confianza sin hacer el trabajo.
  console.error(
    `No hay paquete que revisar en ${CLIENTE}. Ejecuta "npm run build" antes.`,
  )
  process.exit(1)
}

const fugas = []

for (const archivo of archivos) {
  const contenido = await readFile(archivo, 'utf8')
  for (const { rastro, porque } of PROHIBIDOS) {
    if (contenido.includes(rastro)) {
      fugas.push({ archivo, rastro, porque })
    }
  }
}

if (fugas.length > 0) {
  console.error('\nLa frontera del servidor está rota.\n')
  for (const { archivo, rastro, porque } of fugas) {
    console.error(`  ${rastro}  en ${archivo}`)
    console.error(`      ${porque}\n`)
  }
  console.error(
    'El servidor se alcanza solo desde un archivo *.funciones.ts. Busca qué\n' +
      'importación nueva llega a src/server/ por otro camino.\n',
  )
  process.exit(1)
}

console.log(
  `Frontera intacta: ${archivos.length} archivos del cliente, ` +
    `sin rastro de proveedor ni de privilegio administrativo.`,
)

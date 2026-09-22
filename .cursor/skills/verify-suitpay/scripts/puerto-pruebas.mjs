#!/usr/bin/env node
/** Imprime un puerto libre para el webServer de Playwright (3000 o 3001). */
import { createConnection } from 'node:net'

function ocupado(puerto) {
  return new Promise((resolve) => {
    const c = createConnection({ port: puerto, host: '127.0.0.1' })
    c.on('connect', () => {
      c.destroy()
      resolve(true)
    })
    c.on('error', () => resolve(false))
  })
}

const preferido = Number(process.env.PUERTO_PRUEBAS ?? 3000)
if (!(await ocupado(preferido))) {
  console.log(String(preferido))
  process.exit(0)
}
if (preferido === 3000 && !(await ocupado(3001))) {
  console.log('3001')
  process.exit(0)
}
console.error('FALLO  No hay puerto libre (3000 ni 3001). Detén el dev server conflictivo.')
process.exit(1)

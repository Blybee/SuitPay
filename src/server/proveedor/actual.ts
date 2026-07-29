import { ProveedorFactpro } from './factpro/index.ts'
import { ProveedorSimulado } from './simulado.ts'
import type { ProveedorDeEmision } from './interfaz.ts'

/**
 * El proveedor que el sistema usa.
 *
 * ## Por qué existe este archivo de tres líneas
 *
 * Sin él, cada sitio que necesita emitir tendría que importar el adaptador
 * concreto, y el nombre del proveedor aparecería repartido por la aplicación. El
 * linter lo impide, y esta fábrica es la respuesta correcta a esa prohibición: es
 * **el único punto del sistema donde se elige el proveedor**, y devuelve la
 * interfaz, no el adaptador.
 *
 * La consecuencia práctica es la que buscaba el principio III: cambiar de proveedor
 * es escribir otra carpeta hermana de `factpro/` y cambiar una línea aquí. Nada
 * más se toca, porque nada más lo conoce.
 *
 * La comprobación de que la frontera es real es buscar el nombre del proveedor en
 * el repositorio: solo debe aparecer dentro de `src/server/proveedor/`.
 */

let instancia: ProveedorDeEmision | undefined

/**
 * ¿Se pidió el proveedor simulado?
 *
 * La prueba de extremo a extremo necesita un servidor que emita de verdad —con su
 * transacción, su correlativo y su comprobante en Firestore— pero sin llamar a
 * Factpro, porque una prueba que depende de un servicio ajeno falla por motivos que
 * no tienen que ver con lo que está probando.
 *
 * ## La comprobación de producción no es paranoia
 *
 * Si esta variable llegara encendida a producción, el sistema **aparentaría emitir
 * y no emitiría**: comprobantes con número y apariencia normal que no existen ante
 * la autoridad, descubiertos semanas después. Es el peor fallo que este sistema
 * puede tener, y el coste de impedirlo es la condición de abajo, así que se pone
 * aunque parezca defensiva.
 */
function seRequiereSimulado(): boolean {
  if (process.env['NODE_ENV'] === 'production') return false
  return process.env['PROVEEDOR_SIMULADO'] === 'true'
}

export function proveedorActual(): ProveedorDeEmision {
  // Se reutiliza entre invocaciones para no releer la configuración en cada
  // emisión. No guarda estado por petición, así que compartirlo es seguro.
  instancia ??= seRequiereSimulado()
    ? new ProveedorSimulado()
    : new ProveedorFactpro()
  return instancia
}

/** Sustituye el proveedor. Solo para pruebas de integración. */
export function fijarProveedor(otro: ProveedorDeEmision | undefined): void {
  instancia = otro
}

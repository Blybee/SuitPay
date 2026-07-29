import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import {
  estadoSegunProveedor,
  exigeVerificacion,
  ventaEstaCerrada,
} from '../../../src/server/emision/estados.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

/**
 * La distinción entre "el proveedor lo tiene" y "la autoridad lo aceptó".
 *
 * Es la sutileza que más fácil sería romper sin que nada avisara, y romperla
 * rompe el mostrador de una de dos formas opuestas:
 *
 * - Si `enviado` se tratase como espera, el vendedor se quedaría mirando la
 *   pantalla con el cliente delante esperando algo que puede tardar minutos, y el
 *   papel que tiene que entregar ya estaba listo.
 * - Si `enviado` se guardase como `aceptado`, estaríamos afirmando en nuestros
 *   propios datos que la autoridad aceptó un documento que todavía no ha mirado.
 */
describe('estado informado por el proveedor', () => {
  it('registrado y sin respuesta de la autoridad no son aceptado', async () => {
    // La tabla de la decisión 4b. Decir `aceptado` aquí sería afirmar algo que no
    // consta.
    expect(estadoSegunProveedor('registrado')).toBe('enviado')
    expect(estadoSegunProveedor('sin_respuesta_autoridad')).toBe('enviado')
    expect(estadoSegunProveedor('aceptado')).toBe('aceptado')
  })

  it('la venta está cerrada en enviado, sin esperar a la autoridad', async () => {
    // Lo que de verdad importa con un cliente delante: ¿puedo dar la venta por
    // hecha y atender al siguiente?
    expect(ventaEstaCerrada('enviado')).toBe(true)
    expect(ventaEstaCerrada('aceptado')).toBe(true)
    expect(ventaEstaCerrada('reclamado')).toBe(false)
    expect(ventaEstaCerrada('pendiente')).toBe(false)
    expect(ventaEstaCerrada('indeterminado')).toBe(false)
  })

  it('una emisión registrada por el proveedor cierra la venta y confirma el número', async () => {
    const { almacen, contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'exito', estado: 'registrado' })

    const resultado = await emitirComprobante(contexto, peticion())

    expect(resultado.estado).toBe('enviado')
    expect(ventaEstaCerrada(resultado.estado)).toBe(true)
    expect(resultado.archivos.pdf).not.toBeNull()

    // El correlativo se confirma ya. Si se esperase a `aceptado`, todos los
    // números en tránsito quedarían marcados como dudosos y el sondeo de la
    // reconciliación tendría que revisar la jornada entera.
    const serie = await almacen.leerSerie('vendedor-1__boleta')
    expect(serie?.ultimoNumeroConfirmado).toBe(1)
  })

  it('un enviado no se persigue por la reconciliación', async () => {
    // El proveedor ya confirmó que lo tiene: no hay nada que averiguar. Barrerlo
    // sería gastar consultas en documentos que están perfectamente.
    const hace1Hora = new Date('2026-07-28T14:00:00Z')
    const ahora = new Date('2026-07-28T15:00:00Z')

    expect(exigeVerificacion('enviado', hace1Hora, ahora)).toBe(false)
  })

  it('un reclamado envejecido sí se verifica', async () => {
    // Es el proceso que murió entre la llamada al proveedor y la escritura del
    // resultado. No se puede saber de qué lado murió, así que se pregunta.
    const hace1Hora = new Date('2026-07-28T14:00:00Z')
    const haceUnSegundo = new Date('2026-07-28T14:59:59Z')
    const ahora = new Date('2026-07-28T15:00:00Z')

    expect(exigeVerificacion('reclamado', hace1Hora, ahora)).toBe(true)
    // Recién creado no: puede estar en vuelo ahora mismo.
    expect(exigeVerificacion('reclamado', haceUnSegundo, ahora)).toBe(false)
  })

  it('un reintento sobre una venta cerrada en enviado no vuelve a emitir', async () => {
    const { contexto, proveedor } = montarEscenario()
    proveedor.configurarEmision({ tipo: 'exito', estado: 'registrado' })
    const peticionDeVenta = peticion()

    await emitirComprobante(contexto, peticionDeVenta)
    const segunda = await emitirComprobante(contexto, peticionDeVenta)

    expect(segunda.yaExistia).toBe(true)
    expect(segunda.estado).toBe('enviado')
    expect(proveedor.llamadasA('emitir')).toBe(1)
  })
})

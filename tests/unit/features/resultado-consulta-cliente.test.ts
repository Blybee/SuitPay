import { describe, expect, it } from 'vitest'
import {
  decidirTrasConsultaContribuyente,
  mensajeDeConsultaIndisponible,
} from '../../../src/features/clientes/resultado-consulta.ts'
import type { RespuestaDeConsultaContribuyente } from '../../../src/features/clientes/clientes.funciones.ts'

const documento = {
  tipoDocumento: 'RUC' as const,
  numeroDocumento: '20123456789',
}

const datosOk = {
  tipoDocumento: 'RUC' as const,
  numeroDocumento: '20123456789',
  denominacion: 'FERRETERIA DEMO S.A.C.',
  direccion: 'AV. DEMO 1',
  ubigeo: '150101',
  condicion: 'HABIDO',
  estadoRegistro: 'ACTIVO',
  noHabido: false,
}

describe('decidirTrasConsultaContribuyente (FR-026)', () => {
  it('confirma cuando el padrón responde con datos', () => {
    const respuesta: RespuestaDeConsultaContribuyente = {
      ok: true,
      datos: datosOk,
    }
    expect(decidirTrasConsultaContribuyente(respuesta, documento)).toEqual({
      tipo: 'confirmar',
      datos: datosOk,
    })
  })

  it('abre alta manual cuando el servicio no está disponible', () => {
    const respuesta: RespuestaDeConsultaContribuyente = {
      ok: false,
      error: {
        codigo: 'servicio_no_disponible',
        mensaje: 'La consulta de datos oficiales no responde. Puedes escribir los datos del cliente a mano y continuar.',
        reintentable: true,
      },
    }
    const decision = decidirTrasConsultaContribuyente(respuesta, documento)
    expect(decision.tipo).toBe('alta_manual')
    if (decision.tipo !== 'alta_manual') return
    expect(decision.numeroDocumento).toBe(documento.numeroDocumento)
    expect(decision.mensaje).toMatch(/mano/i)
  })

  it('abre alta manual ante respuesta undefined (RPC 500)', () => {
    const decision = decidirTrasConsultaContribuyente(undefined, documento)
    expect(decision).toEqual({
      tipo: 'alta_manual',
      mensaje: mensajeDeConsultaIndisponible(),
      tipoDocumento: 'RUC',
      numeroDocumento: '20123456789',
    })
  })

  it('abre alta manual ante no_encontrado sin inventar datos', () => {
    const respuesta: RespuestaDeConsultaContribuyente = {
      ok: false,
      error: {
        codigo: 'no_encontrado',
        mensaje: 'No se encontraron datos para ese documento de identidad.',
        reintentable: false,
      },
    }
    const decision = decidirTrasConsultaContribuyente(respuesta, {
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
    })
    expect(decision.tipo).toBe('alta_manual')
    if (decision.tipo !== 'alta_manual') return
    expect(decision.tipoDocumento).toBe('DNI')
    expect(decision.mensaje).toMatch(/No se encontraron/)
  })
})

import { describe, expect, it } from 'vitest'
import {
  clavesDelPayload,
  construirPayloadDeAsistencia,
  payloadContieneDatosDeCliente,
} from '../../../src/server/asistencia/payload.ts'

describe('principio IV — payload de asistencia (T116)', () => {
  it('solo incluye tipo, medio y candidatos de producto', () => {
    const payload = construirPayloadDeAsistencia({
      tipo: 'audio',
      medio: { mimeType: 'audio/webm', dataBase64: 'YWJj' },
      candidatos: [
        { codigo: 'C1', descripcion: 'CODO FG 1/2', unidad: 'NIU' },
      ],
    })

    expect([...clavesDelPayload(payload)].sort()).toEqual(
      ['candidatos', 'medio', 'tipo'].sort(),
    )
    expect(payload.candidatos[0]).toEqual({
      codigo: 'C1',
      descripcion: 'CODO FG 1/2',
      unidad: 'NIU',
    })
    expect(payloadContieneDatosDeCliente(payload)).toBe(false)
  })

  it('no admite razón social, RUC, DNI, dirección, teléfono, correo ni historial', () => {
    const payload = construirPayloadDeAsistencia({
      tipo: 'imagen',
      medio: { mimeType: 'image/jpeg', dataBase64: 'eA==' },
      candidatos: [
        { codigo: 'P2', descripcion: 'TEE PVC 3/4', unidad: 'NIU' },
      ],
    })

    // Intento hostil: mezclar campos de cliente en un objeto paralelo.
    const contaminado = {
      ...payload,
      cliente: {
        razonSocial: 'Ferretería Tal SAC',
        ruc: '20123456789',
        dni: '12345678',
        direccion: 'Av. Ejemplo 1',
        telefono: '999888777',
        correo: 'a@b.com',
        historial: [{ total: 100 }],
      },
    }

    expect(payloadContieneDatosDeCliente(contaminado)).toBe(true)
    expect(payloadContieneDatosDeCliente(payload)).toBe(false)

    const serializado = JSON.stringify(payload)
    for (const prohibido of [
      'razonSocial',
      '20123456789',
      '12345678',
      'Av. Ejemplo',
      '999888777',
      'a@b.com',
      'historial',
    ]) {
      expect(serializado).not.toContain(prohibido)
    }
  })

  it('omite precio y cualquier campo extra del candidato de entrada', () => {
    const hostil = {
      codigo: 'X',
      descripcion: 'NIPLE 1',
      unidad: 'NIU',
      precio: 1500,
      ruc: '20999999999',
    }
    const payload = construirPayloadDeAsistencia({
      tipo: 'audio',
      medio: { mimeType: 'audio/webm', dataBase64: 'YQ==' },
      candidatos: [hostil],
    })

    expect(payload.candidatos[0]).toEqual({
      codigo: 'X',
      descripcion: 'NIPLE 1',
      unidad: 'NIU',
    })
    expect(payloadContieneDatosDeCliente(payload)).toBe(false)
  })
})

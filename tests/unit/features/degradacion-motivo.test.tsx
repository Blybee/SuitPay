import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  degradacionPrincipal,
  usarDegradacion,
} from '../../../src/features/degradacion/estado.ts'
import {
  esFalloDeStorage,
  formatearFalloDeCliente,
  formatearMotivoAsistencia,
} from '../../../src/features/degradacion/motivo-asistencia.ts'
import { BandaDegradacion } from '../../../src/ui/componentes/BandaDegradacion.tsx'

describe('motivo técnico de la asistencia en la banda', () => {
  beforeEach(() => {
    usarDegradacion.getState().resolverTodas()
  })

  it('traduce el detalle del servidor a una línea estable, sin texto del proveedor', () => {
    expect(
      formatearMotivoAsistencia({
        motivo: 'clave_rechazada',
        status: 403,
        estadoGemini: 'PERMISSION_DENIED',
        modelo: 'gemini-3-flash-preview',
        clave: 'secundaria',
        intentos: 2,
      }),
    ).toBe(
      'Asistencia: la clave fue rechazada por el servicio (HTTP 403 · PERMISSION_DENIED · gemini-3-flash-preview · clave secundaria)',
    )
    expect(formatearMotivoAsistencia({ motivo: 'timeout', status: null })).toBe(
      'Asistencia: el servicio no respondió a tiempo',
    )
    expect(formatearMotivoAsistencia(undefined)).toBeUndefined()
    expect(formatearMotivoAsistencia({ otra: 'cosa' })).toBeUndefined()
  })

  it('distingue fallos de Storage (subida) de fallos de la asistencia', () => {
    expect(esFalloDeStorage({ code: 'storage/unauthorized' })).toBe(true)
    expect(esFalloDeStorage(new TypeError('Failed to fetch'))).toBe(false)
    expect(formatearFalloDeCliente(new TypeError('Failed to fetch'))).toBe(
      'Cliente: TypeError: Failed to fetch',
    )
  })

  it('la banda muestra el detalle técnico y lo actualiza sin reiniciar la antigüedad', () => {
    const almacen = usarDegradacion.getState()
    almacen.declarar('asistencia', 'Asistencia: cuota agotada (HTTP 429)')
    const primera = degradacionPrincipal(usarDegradacion.getState())
    expect(primera?.detalleTecnico).toBe('Asistencia: cuota agotada (HTTP 429)')

    usarDegradacion
      .getState()
      .declarar('asistencia', 'Asistencia: clave rechazada (HTTP 403)')
    const segunda = degradacionPrincipal(usarDegradacion.getState())
    expect(segunda?.desde).toBe(primera?.desde)
    expect(segunda?.detalleTecnico).toBe(
      'Asistencia: clave rechazada (HTTP 403)',
    )

    render(<BandaDegradacion degradacion={segunda} />)
    expect(
      screen.getByText(
        'El dictado, la lectura de fotos y de PDFs no están disponibles.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByTestId('detalle-tecnico-degradacion')).toHaveTextContent(
      'HTTP 403',
    )
  })

  it('sin detalle no se pinta la línea técnica', () => {
    usarDegradacion.getState().declarar('asistencia')
    render(
      <BandaDegradacion
        degradacion={degradacionPrincipal(usarDegradacion.getState())}
      />,
    )
    expect(
      screen.queryByTestId('detalle-tecnico-degradacion'),
    ).not.toBeInTheDocument()
  })
})

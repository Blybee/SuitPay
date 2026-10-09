import { describe, expect, it } from 'vitest'
import {
  confirmarGuardado,
  diffDeBorrador,
  esSucia,
  filaDesdeIndice,
  filaNueva,
  filtrarFilas,
  reconciliarConIndice,
} from '#/features/padron/borrador.ts'
import type { FilaDeBorrador } from '#/features/padron/borrador.ts'

function persistida(
  numero: string,
  nombre: string,
  parcial: Partial<FilaDeBorrador> = {},
): FilaDeBorrador {
  return {
    ...filaDesdeIndice({ numeroDocumento: numero, denominacion: nombre }),
    ...parcial,
  }
}

describe('borrador del padrón', () => {
  it('filtra por documento o nombre sin distinguir mayúsculas', () => {
    const filas = [
      persistida('20100000001', 'ACME SAC'),
      persistida('45111392', 'Cadillo Nehemias'),
    ]
    expect(filtrarFilas(filas, 'acme')).toEqual([filas[0]])
    expect(filtrarFilas(filas, '4511')).toEqual([filas[1]])
    expect(filtrarFilas(filas, '  ')).toEqual(filas)
  })

  it('acepta un DNI de 8 y un RUC de 11 como alta de cliente', () => {
    const dni = {
      ...filaNueva('clientes', 'n1'),
      numeroDocumento: '45111392',
      denominacion: 'Cadillo',
    }
    const ruc = {
      ...filaNueva('clientes', 'n2'),
      numeroDocumento: '20561321800',
      denominacion: 'Grupo Vilra',
    }
    const diff = diffDeBorrador('clientes', [dni, ruc])
    expect(diff.errores).toEqual([])
    expect(diff.tocaIndice).toBe(true)
    expect(diff.altas).toEqual([
      {
        tipoDocumento: 'DNI',
        numeroDocumento: '45111392',
        denominacion: 'Cadillo',
      },
      {
        tipoDocumento: 'RUC',
        numeroDocumento: '20561321800',
        denominacion: 'Grupo Vilra',
      },
    ])
  })

  it('rechaza un DNI como transportista y un documento repetido', () => {
    const mala = {
      ...filaNueva('transportistas', 'n1'),
      numeroDocumento: '45111392',
      denominacion: 'Alguien',
    }
    const repetida = persistida('20100000001', 'ACME')
    const copia = {
      ...filaNueva('transportistas', 'n2'),
      numeroDocumento: '20100000001',
      denominacion: 'Otra',
    }
    const diff = diffDeBorrador('transportistas', [mala, repetida, copia])
    expect(diff.altas).toEqual([])
    expect(diff.errores).toEqual([
      'El RUC 45111392 tiene que tener 11 dígitos.',
      'El documento 20100000001 está repetido.',
    ])
  })

  it('ignora una fila nueva vacía', () => {
    const vacia = filaNueva('clientes', 'n1')
    expect(esSucia(vacia)).toBe(false)
    const diff = diffDeBorrador('clientes', [vacia, persistida('20100000001', 'ACME')])
    expect(diff.altas).toEqual([])
    expect(diff.cambios).toEqual([])
    expect(diff.tocaIndice).toBe(false)
    expect(diff.errores).toEqual([])
  })

  it('no toca el índice si solo cambió la ficha', () => {
    const origen = {
      direccion: '',
      telefono: '',
      correo: '',
      ubigeo: '',
      condicion: '',
    }
    const fila = persistida('20100000001', 'ACME', {
      ficha: { ...origen, telefono: '999111222' },
      fichaOrigen: origen,
    })
    const diff = diffDeBorrador('clientes', [fila])
    expect(diff.tocaIndice).toBe(false)
    expect(diff.altas).toEqual([])
    expect(diff.cambios).toEqual([
      {
        numeroDocumento: '20100000001',
        denominacion: 'ACME',
        ficha: { ...origen, telefono: '999111222' },
      },
    ])
  })

  it('marca el índice cuando cambia el nombre', () => {
    const fila = persistida('20100000001', 'ACME', { denominacion: 'ACME EIRL' })
    const diff = diffDeBorrador('clientes', [fila])
    expect(diff.tocaIndice).toBe(true)
    expect(diff.cambios).toEqual([
      { numeroDocumento: '20100000001', denominacion: 'ACME EIRL' },
    ])
  })

  it('al reconciliar conserva el nombre editado y las filas nuevas', () => {
    const nueva = {
      ...filaNueva('clientes', 'n1'),
      numeroDocumento: '10456789012',
      denominacion: 'Nuevo',
    }
    const editada = persistida('20100000001', 'ACME', {
      denominacion: 'ACME EIRL',
    })
    const quieta = persistida('45111392', 'Cadillo')
    const resultado = reconciliarConIndice(
      [nueva, editada, quieta],
      [
        { numeroDocumento: '20100000001', denominacion: 'ACME' },
        { numeroDocumento: '45111392', denominacion: 'Cadillo Abel' },
        { numeroDocumento: '20999999999', denominacion: 'Recien importada' },
      ],
    )
    expect(resultado.map((fila) => fila.numeroDocumento)).toEqual([
      '10456789012',
      '20100000001',
      '45111392',
      '20999999999',
    ])
    expect(resultado[1]?.denominacion).toBe('ACME EIRL')
    expect(resultado[1]?.denominacionOrigen).toBe('ACME')
    expect(resultado[2]?.denominacion).toBe('Cadillo Abel')
    expect(resultado[0]?.nueva).toBe(true)
  })

  it('al confirmar, la fila nueva pasa a persistida con el documento como clave', () => {
    const nueva = {
      ...filaNueva('clientes', 'n1'),
      numeroDocumento: '45111392',
      denominacion: 'Cadillo',
    }
    const { filas, claves } = confirmarGuardado([nueva])
    expect(claves.get('n1')).toBe('45111392')
    expect(filas[0]).toMatchObject({
      clave: '45111392',
      nueva: false,
      denominacionOrigen: 'Cadillo',
    })
  })
})

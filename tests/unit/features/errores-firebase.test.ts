import { describe, expect, it } from 'vitest'
import { esPermisoDenegado } from '../../../src/infra/firebase/errores.ts'

describe('esPermisoDenegado', () => {
  it('reconoce el código del SDK', () => {
    expect(esPermisoDenegado({ code: 'permission-denied' })).toBe(true)
    expect(esPermisoDenegado({ code: 'firestore/permission-denied' })).toBe(
      true,
    )
    expect(esPermisoDenegado({ code: 'unavailable' })).toBe(false)
    expect(esPermisoDenegado(new Error('permission-denied'))).toBe(false)
  })
})

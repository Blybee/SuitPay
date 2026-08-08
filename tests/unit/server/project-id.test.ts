import { describe, expect, it } from 'vitest'
import { projectIdDelEntorno } from '../../../src/server/firebase/project-id.ts'

describe('projectIdDelEntorno', () => {
  it('prioriza GOOGLE_CLOUD_PROJECT sobre el resto', () => {
    expect(
      projectIdDelEntorno({
        GOOGLE_CLOUD_PROJECT: 'suitpay-prod',
        GCLOUD_PROJECT: 'otro',
        VITE_FIREBASE_PROJECT_ID: 'cliente',
      }),
    ).toBe('suitpay-prod')
  })

  it('usa GCLOUD_PROJECT si falta GOOGLE_CLOUD_PROJECT', () => {
    expect(
      projectIdDelEntorno({
        GCLOUD_PROJECT: 'via-gcloud',
        VITE_FIREBASE_PROJECT_ID: 'cliente',
      }),
    ).toBe('via-gcloud')
  })

  it('cae a VITE_FIREBASE_PROJECT_ID si no hay vars de Google Cloud', () => {
    expect(
      projectIdDelEntorno({
        VITE_FIREBASE_PROJECT_ID: 'desde-vite',
      }),
    ).toBe('desde-vite')
  })

  it('usa import.meta.env como último respaldo', () => {
    expect(
      projectIdDelEntorno({}, { VITE_FIREBASE_PROJECT_ID: 'desde-import-meta' }),
    ).toBe('desde-import-meta')
  })

  it('ignora cadenas vacías o solo espacios', () => {
    expect(
      projectIdDelEntorno({
        GOOGLE_CLOUD_PROJECT: '   ',
        VITE_FIREBASE_PROJECT_ID: 'valido',
      }),
    ).toBe('valido')
  })

  it('devuelve undefined si no hay ninguna fuente', () => {
    expect(projectIdDelEntorno({})).toBeUndefined()
  })
})

/**
 * Resolución del projectId para el Admin SDK.
 *
 * Vive aparte de `admin.ts` para poder probarse sin inicializar Firebase.
 * El orden importa: las libs de Google leen `GOOGLE_CLOUD_PROJECT` /
 * `GCLOUD_PROJECT`; el fallback `VITE_FIREBASE_*` evita un vacío en builds
 * donde solo viajó la config pública, pero en App Hosting debe existir
 * `GOOGLE_CLOUD_PROJECT` explícito (ver `apphosting.yaml`).
 */

function textoNoVacio(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined
  const limpio = valor.trim()
  return limpio === '' ? undefined : limpio
}

export function projectIdDelEntorno(
  entorno: NodeJS.ProcessEnv = process.env,
  importMetaEnv?: Record<string, unknown>,
): string | undefined {
  return (
    textoNoVacio(entorno['GOOGLE_CLOUD_PROJECT']) ??
    textoNoVacio(entorno['GCLOUD_PROJECT']) ??
    textoNoVacio(entorno['VITE_FIREBASE_PROJECT_ID']) ??
    (importMetaEnv !== undefined
      ? textoNoVacio(importMetaEnv['VITE_FIREBASE_PROJECT_ID'])
      : undefined)
  )
}

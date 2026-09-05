# Bundle de servidor (Nitro 3)

Cómo se empaqueta `.output/server` y por qué un fallo ahí se disfraza de
«asistencia caída». Configuración: [`vite.config.ts`](../vite.config.ts).
Detector: `npm run build ; npm run humo:produccion`.

## Síntoma

En producción (App Hosting / Cloud Run), **todas** las funciones de servidor
responden 500. En el mostrador:

- `Cannot read properties of undefined (reading 'ok')`
- banda «El dictado, la lectura de fotos y de PDFs no están disponibles»
- las URLs `/_serverFn/<hash>` devuelven `{"status":500,"unhandled":true}` **sin**
  la cabecera `x-tss-serialized`

No es RAM, no es Gemini, no es un timeout de asistencia. El módulo de la
función **no llegó a cargarse**.

`vite dev` no empaqueta `node_modules`; por eso en local el mismo código
funciona.

## Causa (septiembre 2026)

Nitro 3 mete todo `node_modules` en `.output/server/_libs`. Al empaquetar
`firebase-admin`, la interop CJS→ESM de rolldown deja `import_app.default`
indefinido en `firebase-admin/lib/esm/app`. El chunk lanza:

```
TypeError: Cannot read properties of undefined (reading 'SDK_VERSION')
```

Eso ocurre en `getServerFnById`, **fuera** del `try/catch` del handler. Nitro
responde JSON plano. El cliente de TanStack Start solo acepta respuestas
serializadas, así que devuelve `undefined` y `respuesta.ok` explota. El
`catch` de captura declara asistencia caída.

Toda función de servidor importa el Admin SDK (sesión, Firestore, Storage):
si `firebase-admin` no carga, **todas** fallan igual.

## Los dos mandos (no intercambiarlos)

| Opción | Qué hace | En este repo |
| --- | --- | --- |
| `nitro({ traceDeps: ['paquete'] })` | Lo deja **externo** y lo copia a `.output/server/node_modules`. Node resuelve la interop. | `firebase-admin` |
| `ssr.noExternal: ['paquete']` | **Fuerza** a empaquetarlo (cuando un `import()` dinámico se cae del grafo). | `unpdf` |

Invariante: **no empaquetar `firebase-admin`**. No quites `traceDeps`. Si
añades otro paquete CJS nativo o con la misma forma de export (Admin-like),
corre la prueba de humo **antes** de desplegar; puede necesitar `traceDeps`
o, al revés, `noExternal`.

## Prueba de humo

Arranca el artefacto que se despliega, no las fuentes:

```powershell
npm run build
npm run humo:produccion
```

Éxito: HTTP 200, `x-tss-serialized: true`, cuerpo con `sesion_ausente` (se
llama sin token a propósito). Fallo: 500 plano, o el servidor no abre el
puerto.

Obligatoria al tocar `vite.config.ts`, `nitro`, `vite` o `firebase-admin`.
Está en `verificar:todo` después del build.

El script lee los ids (hashes) del bundle. Si un upgrade de TanStack Start
cambia el formato, sale 2 con «no encuentro en el bundle»: eso es un fallo
real, no un OK silencioso.

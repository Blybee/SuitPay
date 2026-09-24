# Lista de requerimiento

## Sub-features

- Tab **Lista** en el mostrador (`/`).
- Días en carrusel (`aria-label="Día de la lista de requerimiento"`).
- Altas desde el mismo buscador de productos (contexto `lista` en captura).
- Cantidad / urgencia por línea; export PDF y WhatsApp.

## Cómo llegar (POV usuario)

1. Sesión de vendedor en `/`.
2. Pulsar tab **Lista** en la barra «Secciones del mostrador» (`role="tab"`, name `Lista`).

## Driving con Playwright

No hay spec e2e dedicado aún. Opciones:

1. **Extender e2e** siguiendo `vecinos.spec.ts`: `entrarComoVendedorE2E`, sembrar catálogo, `getByRole('tab', { name: 'Lista' }).click()`, agregar vía combobox.
2. **Vitest emulador** (reglas Firestore): `npm run prueba:emulador` — proyecto `emulador`, reglas en `tests/emulador/reglas.test.ts` (`listasRequerimiento/.../diasLista`).

Comandos de regresión rápida sin UI:

```bash
npm run prueba:emulador
npm run prueba -- tests/unit/features/alta-lista.test.ts
```

## Gotchas

- Altas a Firestore requieren sesión (`sesion.uid !== null` en `index.tsx`); sin login el buscador no persiste en lista.
- El día activo usa zona Lima (`claveDeDiaLima`); pruebas deben fijar «hoy» coherente con el emulador.
- Preferir emuladores; no mezclar lista real con proyecto demo en el mismo navegador.

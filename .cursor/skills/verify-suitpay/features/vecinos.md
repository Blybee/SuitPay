# Vecinos (cotizaciones de vecino)

## Sub-features

- Tab **Vecinos** en `/`.
- Sub-tabs por alias de vecino.
- Vista «Ver deudas» vs pedido del día.
- Alta por combobox y persistencia en Firestore (`cotizaciones`).

## Cómo llegar (POV usuario)

1. Login vendedor (`/acceso`).
2. Tab **Vecinos**.
3. Elegir el sub-tab del vecino (alias visible).

## Driving con Playwright

Spec: `tests/e2e/vecinos.spec.ts` — flujo de referencia para verify-suitpay.

```bash
node .cursor/skills/verify-suitpay/scripts/doctor.mjs
bash .cursor/skills/verify-suitpay/scripts/drive-feature.sh vecinos
node .cursor/skills/verify-suitpay/scripts/archivar-evidencia.mjs
```

Selectores estables del spec:

- `getByRole('tab', { name: 'Vecinos' })`
- `getByRole('tab', { name: alias })` (alias único por worker)
- `getByRole('button', { name: 'Ver deudas' })`
- Combobox producto: `getByRole('combobox', { name: /Buscar producto/i })`

Ayudas: `tests/e2e/ayudas-vecino.ts`, `entrarComoVendedorE2E` en `ayudas-sesion.ts`.

## Gotchas

- Requiere **Auth + Firestore emulators** (`test.skip` si 9099/8080 no responden).
- Siembra Firestore: `sembrarVecinoLegado` / `sembrarCatalogoDeVecinoE2E` antes del UI.
- Logs `verifyIdToken` con `aud` distinto si hay `.env.local` de nube y un dev paralelo en 3000; usar puerto alterno y solo emulators:exec.
- Timeout largo (90s) por sync Firestore.

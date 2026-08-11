# Data Model: Ranking de productos

**Feature**: `004-ranking-productos` | **Date**: 2026-08-10

## Local (IndexedDB)

Store `ranking-dia`:

| Campo | Notas |
|-------|-------|
| `vendedorId` | uid |
| `fechaLima` | `YYYY-MM-DD` |
| `porCodigo` | map codigo → `{ unidades, importeCentimos? }` |
| `loteId` | uuid del empujón pendiente (estable hasta éxito) |
| `estado` | `abierto` \| `empujando` \| `empujado` |

## Firestore

`ranking_dias/{fechaLima}` documento resumen opcional + subcolección `productos/{codigo}`:

| Campo | Notas |
|-------|-------|
| `unidades` | total empresa |
| `importeCentimos` | opcional |
| `porVendedor.{uid}` | unidades de ese puesto (desnormalizado para auditoría) |
| `lotesAplicados` | map `loteId` → true (idempotencia) |

Alternativa compacta si el volumen lo permite: un solo doc `ranking_dias/{fecha}` con mapa `productos` (cuidado con límite 1 MiB; con 500 SKUs cabe).

## Lecturas admin

Top 20: leer el día o agregar en servidor últimos 7/30 docs (máx. 30 lecturas/doc-día) o mantener `ranking_ventanas/7d` actualizado en cada empujón (más escrituras). Preferencia inicial: agregar on-read sobre ≤30 docs/día (barato a esta escala).

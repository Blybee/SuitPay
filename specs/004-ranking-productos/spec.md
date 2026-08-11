# Feature Specification: Ranking de productos

**Feature Branch**: `004-ranking-productos`

**Created**: 2026-08-10

**Status**: Draft

**Input**: Track local de unidades vendidas por producto, empujón diferido a Firestore (sin Cloud Scheduler), página admin/jefe con estadísticas. Depende de emisión en `001-mostrador-asistido`.

**Governance**: constitución v1.0.0. Sin Scheduler (alineado a decisión 10 de `001`). Principio IV: solo códigos de producto y cantidades/importes; sin PII de clientes. Principio VI: no declarar “mejora de surtido” sin línea base.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acumular ventas en el puesto (Priority: P1)

Cada vez que un vendedor emite un comprobante, el puesto suma unidades (y opcionalmente importe) por código de producto en almacenamiento local del día (America/Lima). No escribe a Firestore en cada venta.

**Why this priority**: reduce escrituras calientes y cumple el objetivo de “un empujón por vendedor/día”.

**Independent Test**: emitir tres ventas el mismo día; IndexedDB muestra contadores locales; Firestore de ranking aún no cambió.

**Acceptance Scenarios**:

1. **Given** una emisión exitosa con líneas, **When** termina, **Then** los contadores locales del día incrementan por código.
2. **Given** una anulación del mismo día, **When** se confirma, **Then** los contadores locales del día descuentan esas unidades (sin ir negativos por debajo de lo empujado pendiente — ver edge cases).

---

### User Story 2 - Empujón diferido al cambiar el día (Priority: P1)

No hay job a medianoche. La primera vez que la app detecta que el día Lima local pendiente es anterior a “hoy”, tras el primer paint (idle / timeout corto), envía el lote a Firestore en segundo plano y reinicia el bucket local. También se evalúa al volver a enfocar la pestaña.

**Why this priority**: encaja con “sin Scheduler” y no sobrecarga el login.

**Independent Test**: simular contadores del día D; avanzar reloj a D+1; al abrir la app, tras idle, los agregados en Firestore reflejan D y el local de D queda limpio.

**Acceptance Scenarios**:

1. **Given** contadores locales del lunes pendientes, **When** el martes la app queda idle tras pintar, **Then** se envía el lote del lunes y el martes empieza en cero en local.
2. **Given** el empujón falla por red, **When** se reintenta más tarde, **Then** el merge es idempotente (mismo id de lote no duplica).
3. **Given** el martes nadie abre ese puesto, **When** no hay proceso vivo, **Then** el empujón espera (no hay cron).

---

### User Story 3 - Ver ranking en administración (Priority: P2)

Admin o jefe abre una página de estadísticas: top 20 productos por unidades en los últimos 7 y 30 días (defaults).

**Why this priority**: justifica el empujón; no es crítica para vender el mismo día.

**Independent Test**: con agregados sembrados, la página muestra top 20 ordenado por unidades.

**Acceptance Scenarios**:

1. **Given** agregados en Firestore, **When** admin abre ranking, **Then** ve top 20 por unidades (7 y 30 días).
2. **Given** un vendedor, **When** intenta abrir la página de ranking, **Then** se le niega o no aparece en su nav (solo admin/jefe).

---

### Edge Cases

- Dos pestañas del mismo vendedor: un solo empujón gana; el otro no-op por id de lote.
- Anulación de un comprobante cuyo día local ya se empujó: el ajuste va al bucket del día actual o a un delta correctivo en servidor (documentar en plan: preferir corrección server-side por `comprobanteId` si el día ya se cerró localmente).
- Nota: el ranking no sustituye inventario (`003`).

## Requirements *(mandatory)*

- **FR-001**: Tras emitir, el cliente MUST incrementar contadores locales del día America/Lima por `codigo` (unidades; importe opcional en céntimos).
- **FR-002**: El empujón MUST ocurrir de forma diferida al detectar día local pendiente &lt; hoy Lima, tras idle/post-paint o al focus; MUST NOT bloquear login ni carga de catálogo.
- **FR-003**: El empujón MUST ser idempotente (id de lote) y usar incremento atómico en servidor.
- **FR-004**: MUST NOT usar Cloud Scheduler ni Cloud Functions aparte solo para este fin.
- **FR-005**: La página admin/jefe MUST mostrar top 20 por unidades en ventanas 7 y 30 días (defaults).
- **FR-006**: MUST NOT enviar ni almacenar en el track local datos identificatorios de clientes.

## Success Criteria

- **SC-001**: En una jornada de prueba, las escrituras Firestore de ranking por vendedor son O(1) por día (un empujón), no O(ventas).
- **SC-002**: El arranque del mostrador no espera al empujón (p95 de bloqueo por ranking = 0 ms en camino crítico).
- **SC-003**: Admin obtiene top 20 actualizado el día hábil siguiente a las ventas (cuando los puestos hayan abierto la app).

## Assumptions

- 5 puestos; volumen diario modesto; IndexedDB ya usado en `001` para pedido/catálogo.
- Login por alias fuera de alcance (acceso sigue siendo correo).
- Defaults de UI: top 20, unidades, ventanas 7/30 días.

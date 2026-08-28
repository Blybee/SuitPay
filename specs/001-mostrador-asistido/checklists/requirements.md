# Specification Quality Checklist: Mostrador asistido — primera entrega de SuitPay

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-28
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Constitution Compliance (SuitPay v1.0.0)

Verificación adicional, no incluida en la plantilla estándar, exigida por la sección de
Gobernanza de la constitución.

- [x] **I. Aprobación humana indelegable** — FR-027 exige confirmación explícita y atribución; FR-041 impide que una captura emita por sí sola; FR-048 prohíbe que una instrucción en lenguaje natural produzca efectos irreversibles.
- [x] **II. Ninguna venta se documenta dos veces** — FR-028 fija la garantía, FR-029 exige registrar antes de solicitar y prohíbe el reintento a ciegas, SC-004 la hace medible, y los casos límite cubren la respuesta ausente y los dos dispositivos.
- [x] **III. Proveedor sustituible** — la especificación no nombra ningún proveedor ni ninguno de sus conceptos; se refiere siempre a "el proveedor de emisión" como dependencia de negocio.
- [x] **IV. Datos de clientes fuera de los servicios de IA** — FR-045 lo prohíbe para dictado/foto; FR-061 documenta la excepción del PDF de requerimiento; SC-012 lo hace verificable.
- [x] **V. El mostrador no se detiene** — FR-007 desacopla la búsqueda de servicios externos, FR-046 y FR-052 garantizan la continuidad, FR-051 exige que la degradación sea visible, FR-015 protege el pedido en curso.
- [x] **VI. Lo que no se mide no se declara mejorado** — cada criterio afectado declara su línea base o su ausencia; SC-013 está etiquetado como cualitativo.
- [x] **Restricciones del dominio** — FR-036 distingue documentos regulados de internos, FR-039 prohíbe la palabra "eliminar", FR-030 exige trazar incluso los intentos fallidos, FR-032 impide recalcular el impuesto.

## Notes

**Estado: aprobado. Todos los ítems pasan.** Validado en dos iteraciones.

La primera iteración dejó tres marcadores `[NEEDS CLARIFICATION]` abiertos, resueltos por el
autor en la misma sesión y ya incorporados a la especificación:

| Incógnita | Resolución | Requisitos afectados |
|-----------|------------|----------------------|
| Qué recibe el cliente si la emisión no puede completarse en el momento | Un documento interno sin valor tributario, marcado como pendiente de comprobante; el comprobante real llega al restablecerse el servicio | FR-050, FR-050a, FR-050b, US1 escenario 9 |
| Importe que obliga a identificar al adquirente en una boleta | 700 soles | FR-021, US1 escenario 8 |
| Plazo admitido para anular | El mismo día de la emisión; después corresponde nota de crédito | FR-037, FR-038, US4 escenarios 1 y 2 |

La resolución de la primera incógnita hizo aparecer un caso límite que antes no existía: el
comprobante pendiente que resulta **rechazado** al restablecerse el servicio, con el cliente ya
ido y con mercadería. Queda recogido en Edge Cases.

Dos observaciones que no afectan a la calidad de la especificación pero sí al riesgo del
proyecto, ambas registradas en Assumptions:

- FR-028 y FR-029 dependen de que el proveedor de emisión permita determinar si una emisión
  concreta ocurrió. Si esa capacidad no existiera, **SC-004 no podría garantizarse** y habría que
  replantear el proveedor. Es la asunción más cara de toda la especificación.
- El umbral de 700 soles es de origen regulatorio y puede cambiar por norma. No debe quedar
  enterrado como una constante intocable.

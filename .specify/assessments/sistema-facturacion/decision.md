# Decision: SuitPay — Mostrador asistido para una distribuidora mayorista

- **Slug**: sistema-facturacion
- **Decided**: 2026-07-28
- **Verdict**: go (condicionado — ver las tres verificaciones previas)
- **Artifacts reviewed**: intake.md, research.md, problem.md, concept.md

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | strong | El problema está observado directamente y es concreto: la operación no puede empezar hasta que llega quien tiene las credenciales, la búsqueda no encuentra productos que existen, y el pedido se recorre por varias pantallas según el documento. El dueño encargó la solución y está dispuesto a reemplazar el sistema. |
| Evidence strength | adequate | Asimétrica. Las restricciones técnicas y regulatorias están fuertemente citadas contra la documentación del proveedor de emisión. La evidencia de usuarios es débil: ninguna entrevista estructurada, ningún volumen de operación y ninguna línea base medida. Es `adequate` porque el problema está documentado por observación directa, no `strong` porque su magnitud no está cuantificada. |
| Value vs. inaction | adequate | No hacer nada no rompe nada: el sistema heredado emite comprobantes válidos. El coste de la inacción es acumulativo y humano —quejas de años, ventas de mostrador no atendidas en la apertura, papel transcrito a mano— más el desperdicio de la disposición al cambio que el dueño tiene ahora. Real, pero no urgente en términos de riesgo operativo. |
| Feasibility / appetite | adequate | Existe una opción recomendada y, detrás de ella, un repliegue creíble. El apetito de la Opción D es `large` con incertidumbre concentrada en un único factor —el acoplamiento de las herramientas ya construidas— que se mide barato. Si resulta profundo, la Opción B sigue siendo viable en semanas. Tener plan de repliegue es lo que sostiene esta nota. |
| Strategic fit | unknown | **No se glosa: el proyecto todavía no tiene constitución.** `.specify/memory/constitution.md` sigue siendo la plantilla sin rellenar, así que no hay principios declarados contra los cuales medir el encaje. La única guía estratégica disponible es el encargo del dueño y su criterio de aceptación. Se resuelve ejecutando `/speckit-constitution`, que cuesta minutos. |
| Risk posture | adequate | Los riesgos mayores están identificados y la mayoría acotados: el regulatorio se delega en un proveedor con contingencia documentada ante caídas de la autoridad; el de alcance se contiene con exclusiones explícitas; el de inventario inconsistente durante la convivencia se reconoce y se aplaza. **Uno queda identificado pero sin mitigación confirmada**: la emisión duplicada, porque depende de una pregunta al proveedor todavía sin respuesta. Eso impide una nota `strong`. |

## Verdict & Rationale

**Go, condicionado a tres verificaciones previas.**

El gate se supera porque los dos requisitos duros están cumplidos: la validez del problema es `strong` y la fuerza de la evidencia es `adequate`, nunca `weak` ni `unknown`, y existe una opción de concepto recomendada y acotada. El problema no es una intuición: está observado, tiene manifestaciones concretas y verificables, y quien decide ya pidió resolverlo.

La nota `adequate` en evidencia merece explicación, porque es donde este assessment es más frágil. Lo que está bien fundamentado es el terreno técnico: qué documentos exige la autoridad tributaria, qué hace y qué no hace el proveedor de emisión, qué se puede anular y qué no, y cómo se comporta el sistema cuando la autoridad no responde. Lo que no está fundamentado es la magnitud del dolor. Nadie ha entrevistado a los cinco vendedores de forma estructurada, nadie ha contado cuántos documentos se emiten al día ni cuántos se anulan al mes, y nadie ha medido cuánto se tarda hoy en documentar una venta. Eso no invalida el problema —la escena de la puerta y el buscador que falla existen— pero sí significa que, tal como están las cosas, **será imposible demostrar que SuitPay mejoró algo**, y el criterio de aceptación del dueño es precisamente que los vendedores perciban una mejora.

La puntuación `unknown` en encaje estratégico se deja a la vista deliberadamente. El proyecto no tiene constitución escrita, así que hay principios que ya están operando de hecho sin estar declarados: que la responsabilidad de lo emitido recae siempre en el vendedor, que el proveedor de emisión debe ser sustituible, que ningún dato de clientes se envía a servicios de inteligencia artificial. Son exactamente los principios que una constitución debe fijar antes de que la especificación los dé por supuestos o los contradiga.

No se emite `needs-clarification` porque ninguna de las incógnitas abiertas impide **escribir** la especificación. Bloquean el diseño de requisitos concretos y la capacidad de medir, no la definición de qué debe hacer el sistema. Dos de las tres son preguntas a terceros que pueden avanzar en paralelo a la especificación, y la tercera se responde leyendo código propio.

### Verificaciones previas (condiciones del go)

Ninguna bloquea empezar a especificar, pero las tres deben resolverse antes de comprometer el alcance o de dar por buenos los requisitos que dependen de ellas.

1. **Revisar el acoplamiento de las herramientas de captura ya construidas** en la tienda virtual de la empresa. Es la incógnita que más puede mover el alcance y la única que se despeja gratis, leyendo el código en lugar de especulando. Si el acoplamiento resulta profundo, la recomendación debe replegarse de la Opción D a la Opción B.
2. **Medir las líneas base en el sistema actual**: minutos desde la apertura hasta la primera emisión, tiempo de una venta, comprobantes anulados al mes, pedidos en papel por semana, y volumen del canal de los vecinos. Son días de conteo y sin ellos el criterio de éxito del dueño no tiene contra qué compararse.
3. **Preguntar al proveedor de emisión si acepta un número de comprobante explícito** en lugar de asignarlo él. De la respuesta depende poder garantizar que ninguna venta se emita dos veces, que es el único riesgo grave sin mitigación confirmada.

### Recomendación paralela, independiente del proyecto

Crear un usuario por vendedor en el sistema actual y repartir permisos. Cuesta días, no requiere SuitPay, y elimina hoy la fricción más aguda —personal y clientes esperando a que llegue quien tiene las credenciales—, que en el fondo nunca fue un problema de software.

## If needs-clarification

No aplica. El veredicto es `go`. Las incógnitas se trasladan a la especificación como preguntas abiertas, no como bloqueos de etapa.

## If go — Handoff to `/speckit-specify`

- **Problem**: en una distribuidora mayorista de grifería y gasfitería en Perú, los 5 vendedores no pueden documentar una venta al ritmo del mostrador porque el sistema está atado a máquinas y a las credenciales de una sola persona, obliga a recorrer varias pantallas por documento y no encuentra productos cuando el nombre no se teclea en el orden exacto; el resultado son clientes sin atender y ventas tomadas en papel.

- **Chosen approach**: Opción D — Mostrador asistido acotado. Aplicación web para navegador en escritorio y móvil, con sesión persistente por vendedor. Tres entradas equivalentes que construyen un mismo pedido —escribir, dictar o fotografiar una guía manual— y ese pedido se documenta como cualquier comprobante. La emisión se delega en un proveedor externo sustituible. Lo capturado automáticamente se muestra contrastado contra el producto propuesto y **siempre lo aprueba el vendedor**, que conserva la responsabilidad.

- **In scope**: pedido único convertible a boleta, factura o nota de venta; búsqueda de productos por atributos en cualquier orden; alta de cliente en contexto mediante consulta por RUC y DNI; cotizaciones numeradas, persistidas en servidor y recuperables desde cualquier dispositivo; precio mayorista editable en línea sin validación; captura por audio y por fotografía con revisión contrastada; comandos de **consulta** en el buscador; modal de contexto limitado a coincidencias de cliente y de producto; anulación dentro de plazo como operación explícita; registro referencial de medio de pago y monto; pedido en curso persistido localmente para sobrevivir a cortes de red; impresión en A4 desde escritorio y PDF compartible desde móvil; migración del catálogo de productos; facturación al crédito para el canal de los vecinos, emitida en el momento de la entrega.

- **Out of scope**: contabilidad; cobranzas como módulo; aplicación nativa; impresión desde el móvil; asumir la firma y la emisión ante la autoridad tributaria; comandos u órdenes habladas que anulen o modifiquen comprobantes emitidos; modal de contexto genérico más allá de clientes y productos; guía de remisión; panel del jefe y alertas de mercadería por agotarse; sugerencias de compra de los vendedores; notas de crédito y anulación fuera de plazo como flujo completo; migración masiva de clientes; sincronización con el sistema actual; cambiar la forma de trabajar del almacenero; reemplazar la tienda virtual.

- **Success metrics**: minutos desde la apertura hasta la primera emisión; tiempo desde que el cliente llega hasta que tiene su comprobante; porcentaje de búsquedas que aciertan al primer intento; pedidos en papel por semana que requieren transcripción completa; comprobantes anulados al mes; comprobantes rechazados u observados por la autoridad, que no debe empeorar; **comprobantes duplicados emitidos: cero**; ventas a vecinos documentadas el mismo día de la entrega; y, como señal cualitativa declarada por el dueño, que los 5 vendedores prefieran SuitPay al sistema actual. Todas las líneas base están sin medir salvo la de duplicados, que no aplica al sistema actual.

- **Carried-forward open questions**:
  - ¿Acepta el proveedor de emisión un número de comprobante explícito? Sin ello no hay forma de reconciliar una emisión interrumpida y el objetivo de cero duplicados no se puede garantizar.
  - ¿Cuánto acoplamiento tienen las herramientas de captura existentes con la tienda virtual? Condiciona el alcance de la primera entrega.
  - ¿Qué relación tendrán SuitPay y la tienda virtual una vez migrado el catálogo, si la tienda sigue vendiendo?
  - ¿Qué recibe el cliente en el instante en que paga y se lleva la mercadería si el servicio de emisión está caído?
  - ¿Existe un formato de impresión de rollo en el proveedor, o el objetivo de abandonar el A4 es inalcanzable por esa vía?
  - ¿Qué postura tiene el contador sobre el desglose del impuesto a partir de precios que ya lo incluyen, la facturación al crédito de los vecinos y la anulación por error de impresión?
  - ¿Qué debe poder hacer el vendedor si la asistencia automática no responde en absoluto, y se acepta operar solo con búsqueda escrita como degradación válida?
  - ¿Respecto a qué base se calcula el porcentaje de la alerta de mercadería por agotarse?
  - ¿Qué umbral de importe obliga a identificar al comprador en una boleta, y quién valida esa regla?
  - ¿Caben 5 vendedores emitiendo simultáneamente en los límites de uso de la API del proveedor?
  - ¿En qué momento SuitPay toma el control del inventario, dado que durante la convivencia con el sistema actual el stock será inconsistente por diseño?

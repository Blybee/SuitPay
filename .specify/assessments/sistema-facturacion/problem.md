# Problem Definition: Emisión de comprobantes en el mostrador de una distribuidora mayorista

- **Slug**: sistema-facturacion
- **Created**: 2026-07-28
- **Inputs used**: intake.md (volcados 1 a 4) + research.md

## Problem Statement

En una distribuidora mayorista de grifería y gasfitería en Perú, los 5 vendedores no pueden documentar una venta al ritmo que exige el mostrador: el sistema que usan está atado a máquinas físicas y a las credenciales de una sola persona, obliga a recorrer varias pantallas para producir cada documento, y no encuentra los productos cuando su nombre no se teclea en el orden exacto. La consecuencia diaria es que hay clientes que esperan sin ser atendidos y que parte de la venta se toma en papel y se transcribe después.

**Nota sobre el encuadre**: la idea llegó al intake formulada como solución (un sistema web con captura por voz, foto y búsqueda difusa asistida por IA, con todo concentrado en una ventana). Este documento revierte ese encuadre para quedarse en el problema. La ventana única, los comandos, el modal de contexto y la asistencia de modelos multimodales son **opciones de solución** ya registradas en `intake.md`, y se evalúan en `/speckit-assess-shape`, no aquí.

## Affected Users & Stakeholders

### Users

- **Vendedores (5, en 5 puestos concurrentes)** — Son los afectados principales. No pueden empezar a atender hasta que llega la encargada con las credenciales; navegan entre pantallas distintas por cada documento; pierden tiempo cuando la búsqueda de producto no devuelve lo que existe; y se ven obligados a abandonar la venta en curso para registrar a un cliente nuevo — [source: intake.md, volcado 1]
- **Almacenero** — Persona mayor que también atiende como vendedor cuando hace falta y no usa la computadora, por lo que su trabajo se queda en papel y no llega al sistema hasta que otra persona lo transcribe. La decisión explícita del negocio es no forzarlo a cambiar — [source: intake.md, volcados 3 y 4]
- **Clientes de mostrador** — Esperan mientras el sistema no está disponible, y en la apertura hay quienes no pueden ser atendidos en absoluto — [source: intake.md, volcado 1]
- **Comerciantes vecinos (mayoristas)** — Compran mercadería y pagan al cierre del día o en días posteriores. Hoy reciben una foto de la cuenta y su factura recién cuando pagan, de modo que la entrega y el documento quedan desfasados — [source: intake.md, volcados 3 y 4]
- **Administrador / contador** — Mantiene el inventario y configura los vendedores y sus series de comprobantes — [source: intake.md, volcados 3 y 4]
- **Jefe** — No tiene visibilidad de qué mercadería está por agotarse — [source: intake.md, volcado 3]

### Stakeholders

- **Dueño de la empresa** — Encargó el sistema y decide el reemplazo. Su criterio de aceptación es la satisfacción declarada de los vendedores — [source: intake.md, volcados 1 y 2]
- **Hijo del dueño** — Impulsa el cambio de impresión A4 a formato de rollo por costo y desperdicio de papel — [source: intake.md, volcado 2]
- **Contador de la empresa** — Tiene interés directo en la validez de lo emitido, pero **no ha sido consultado en ningún momento** — [source: intake.md, volcado 1] [NEEDS CLARIFICATION: su postura es desconocida y afecta decisiones que ya están sobre la mesa]
- **SUNAT (autoridad tributaria)** — No es usuario, pero determina qué es válido: plazos de envío, condiciones de anulación y contenido obligatorio de cada comprobante — [source: research.md]
- **Proveedor de emisión (Factpro como primera opción)** — Tercero del que depende que un documento exista legalmente; ya se exigió que sea sustituible — [source: intake.md, volcado 2; research.md]

## Goals

- Que cualquier vendedor autorizado pueda empezar a atender en cuanto abre el local, sin depender de que llegue una persona concreta ni de una máquina concreta.
- Que un pedido tomado una sola vez se pueda documentar como el comprobante que el cliente pida, sin volver a capturarlo ni recorrer pantallas distintas según el tipo de documento.
- Que buscar un producto por sus atributos —material, medida, marca— lo encuentre sin importar el orden en que se escriban.
- Que el trabajo que hoy se toma en papel llegue al sistema sin necesidad de volver a teclearlo íntegro.
- Que registrar a un cliente nuevo no obligue a abandonar la venta en curso.
- Que la venta a un comerciante vecino quede documentada en el momento en que ocurre y su cobro pendiente sea visible hasta que se pague.
- Que el jefe pueda ver qué mercadería está por agotarse sin pedírselo a nadie.
- Que la responsabilidad de lo que se emite siga recayendo íntegramente en el vendedor, por mucho que el sistema le precargue el trabajo.
- Que la operación del mostrador no se detenga cuando falle un servicio externo, y que ningún fallo produzca comprobantes duplicados ni documentos que SUNAT rechace.

## Non-Goals

Explícitamente fuera de alcance, para acotar el trabajo:

- **Contabilidad** — el sistema actual la cubre y no ha habido interacción con el contador — [source: intake.md, volcado 1]
- **Medios de pago como función real** — se registran medio y monto solo de forma referencial; no hay conciliación ni exigencia de declarar tarjeta o billetera digital — [source: intake.md, volcado 3]
- **Cobranzas como módulo** — más allá de que el pendiente de un vecino sea visible, no se construye gestión de cobranza — [source: intake.md, volcados 2 y 3]
- **Sugerencias de compra de los vendedores hacia el jefe** — postergadas por decisión del autor — [source: intake.md, volcado 4]
- **Aplicación nativa** — navegador en escritorio y móvil — [source: intake.md, volcado 3]
- **Imprimir desde el móvil** — la impresión física se destina a los puestos de escritorio; en móvil la salida es un archivo que se comparte con el cliente — [source: intake.md, volcado 3]
- **Asumir la emisión ante SUNAT** — la firma, el certificado digital y el diálogo con la autoridad quedan del lado del proveedor — [source: intake.md, volcado 2; research.md]
- **Cambiar la forma de trabajar del almacenero** — decisión deliberada del negocio — [source: intake.md, volcado 4]
- **Sincronizar con el sistema actual** — convivirán aislados durante las pruebas — [source: intake.md, volcado 3]
- **Reemplazar la tienda virtual de la empresa** — es un proyecto aparte, aunque su relación con este sigue sin resolverse — [source: intake.md, volcado 4]

## Success Metrics

**Advertencia sobre las líneas base**: casi ninguna está medida. Todo lo que sigue sale de observación cualitativa, no de instrumentación. Medir estas líneas base en el sistema actual es barato —bastan unos días de conteo— y sin ellas no habrá forma de demostrar que SuitPay mejoró nada, ni de detectar un retroceso. Es la mayor debilidad de este assessment y así se recoge en `research.md`.

- **Minutos desde la apertura del local hasta que el primer vendedor puede emitir** (baseline: desconocido; hoy depende de la hora de llegada de la encargada, que según el relato suele ser tarde)
- **Tiempo desde que el cliente llega al mostrador hasta que tiene su comprobante** (baseline: desconocido)
- **Porcentaje de búsquedas de producto que devuelven el producto correcto en el primer intento** (baseline: desconocido; se sabe que falla cuando los términos no van en orden exacto)
- **Cantidad de pedidos por semana tomados en papel que requieren transcripción manual completa** (baseline: desconocido)
- **Comprobantes anulados por mes**, como aproximación a la tasa de error en la emisión (baseline: desconocido)
- **Comprobantes rechazados u observados por SUNAT**: no debe empeorar respecto del sistema actual (baseline: desconocido)
- **Comprobantes duplicados emitidos: cero.** No es una mejora sino un riesgo nuevo que introduce el sistema propuesto, y la investigación mostró que el proveedor no ofrece un mecanismo documentado para evitarlo (baseline: no aplica en el sistema actual) — [source: research.md]
- **Ventas a vecinos con documento emitido el mismo día de la entrega** (baseline: hoy la factura se emite cuando pagan, que puede ser días después)
- **Cualitativa**: los 5 vendedores declaran preferir SuitPay al sistema actual. Es el criterio explícito del dueño y se registra como tal, pero es subjetivo y no sustituye a las métricas anteriores — [source: intake.md, volcado 2]

## Cost of Inaction

Si no se construye nada, no ocurre ninguna catástrofe: el sistema heredado funciona, emite comprobantes válidos y la empresa está bien posicionada en su mercado. El coste es acumulativo y recae sobre las personas.

Cada mañana se repite la misma escena: personal y clientes esperando en la puerta a que llegue quien tiene las credenciales, con ventas de mostrador que simplemente no se atienden. Los vendedores siguen navegando entre pantallas, peleando con un buscador que no encuentra lo que existe, y saliendo del flujo de venta para registrar clientes. El trabajo del almacenero y el de los vecinos se sigue tomando en papel y transcribiendo a mano, con el doble coste de tiempo y de errores. Las facturas de los vecinos se siguen emitiendo con desfase respecto a la entrega. El jefe sigue sin saber qué se está agotando hasta que alguien se lo dice.

El riesgo real no es operativo sino humano: las quejas ya existen y llevan años acumulándose sin que el sistema mejore, y el dueño —que está dispuesto a cambiar— habrá invertido la disposición al cambio en nada. También queda un coste de oportunidad concreto: las herramientas de captura por audio y foto que la empresa ya construyó para su tienda virtual permanecen aisladas del lugar donde se factura.

## Open Questions

Arrastradas desde `intake.md` y `research.md`, ordenadas por lo que bloquean. Las dos primeras condicionan si el problema puede resolverse de forma segura.

- [NEEDS CLARIFICATION: ¿acepta el proveedor de emisión un número de comprobante explícito, o siempre lo asigna él? Sin eso no existe forma de averiguar si una emisión interrumpida llegó a ocurrir, y el objetivo de cero duplicados no puede garantizarse — [source: research.md]]
- [NEEDS CLARIFICATION: qué relación tendrán SuitPay y la tienda virtual de la empresa. Si SuitPay es la fuente de verdad del catálogo pero la tienda sigue vendiendo, la empresa mantendrá dos verdades sobre el mismo stock — [source: intake.md, volcado 4]]
- [NEEDS CLARIFICATION: la postura del contador sobre el momento de emisión de las facturas a los vecinos, el desglose del IGV a partir de precios que ya lo incluyen, y la anulación por error de impresión.]
- [NEEDS CLARIFICATION: qué recibe el cliente en el instante en que paga y se lleva la mercadería si el servicio de emisión no está disponible.]
- [NEEDS CLARIFICATION: existe un formato de impresión de rollo en el proveedor, o el objetivo de abandonar el A4 no es alcanzable por esa vía — [source: research.md]]
- [NEEDS CLARIFICATION: qué significa operativamente "mercadería por agotarse" — la alerta se configuró como un porcentaje, pero no se definió respecto a qué base se calcula.]
- [NEEDS CLARIFICATION: qué debe poder hacer el vendedor si la asistencia automática no responde en absoluto, y si operar sin ella se considera degradación aceptable.]
- [NEEDS CLARIFICATION: no existe evidencia directa de los usuarios. Cinco conversaciones con los vendedores y unos días de conteo de documentos cambiarían la calidad de toda esta definición — [source: research.md]]

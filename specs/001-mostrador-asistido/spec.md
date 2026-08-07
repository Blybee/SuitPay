# Feature Specification: Mostrador asistido — primera entrega de SuitPay

**Feature Branch**: `001-mostrador-asistido`

**Created**: 2026-07-28

**Updated**: 2026-07-29 (enmienda volcado 5 — shell, Soft-Pill, tabs, default Nota de Venta, número inicial de serie)

**Status**: Draft

**Input**: Traspaso del assessment `sistema-facturacion` (veredicto `go`, Opción D — Mostrador asistido acotado; enmienda volcado 5). Ver `.specify/assessments/sistema-facturacion/decision.md`.

**Governance**: sujeta a la constitución de SuitPay v1.0.0 (`.specify/memory/constitution.md`). Los principios I, II y IV son no negociables y atraviesan varias historias.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tomar el pedido y emitir el comprobante escribiendo (Priority: P1)

Un vendedor abre el navegador en su puesto o en su teléfono y ya está dentro, sin pedir credenciales a nadie. Llega al mostrador (Inicio) con el tab Pedido y el tipo de documento **Nota de Venta** por defecto. Escribe lo que el cliente le pide, encontrando cada producto aunque teclee los términos en cualquier orden. Ajusta el precio si negoció uno distinto, cambia el tipo si hace falta (boleta, factura o nota de venta), revisa el total y confirma. El comprobante sale impreso en el puesto, o como archivo para enviarle al cliente si está atendiendo desde el teléfono.

**Why this priority**: es el sistema. Sin esta historia no hay nada que reemplace al mostrador actual, y con ella sola la empresa ya puede vender. Contiene además la solución a la queja más concreta y verificada del sistema anterior: la búsqueda que no encuentra lo que existe.

**Independent Test**: con un subconjunto de productos cargado y una serie configurada, un vendedor completa una venta de principio a fin y obtiene un comprobante válido. Se puede demostrar sin ninguna otra historia implementada.

**Acceptance Scenarios**:

1. **Given** un vendedor que ya inició sesión en este dispositivo alguna vez, **When** abre la aplicación al día siguiente, **Then** entra directamente al mostrador (Inicio, tab Pedido) sin volver a escribir credenciales, con tipo de documento Nota de Venta.
2. **Given** un catálogo que contiene "CODO FG 1/2", **When** el vendedor escribe "1/2 codo fierro", **Then** el producto aparece entre los resultados.
3. **Given** un pedido con tres productos, **When** el vendedor cambia el tipo de documento de boleta a factura, **Then** el pedido se conserva íntegro sin volver a capturarse.
4. **Given** un producto con precio mayorista de referencia, **When** el vendedor escribe un precio distinto sobre ese valor, **Then** el sistema lo acepta sin validarlo y el total se recalcula.
5. **Given** un pedido listo y un cliente eventual por defecto, **When** el vendedor confirma la emisión, **Then** el comprobante se emite, queda atribuido a ese vendedor y se ofrece imprimirlo o compartirlo.
6. **Given** un pedido en curso, **When** el vendedor pierde la conexión y la recupera en el mismo dispositivo, **Then** el pedido sigue ahí sin pérdida de líneas.
7. **Given** una emisión en curso, **When** el vendedor pulsa confirmar dos veces seguidas, **Then** se emite un único comprobante.
8. **Given** una boleta cuyo importe supera los 700 soles y un cliente eventual, **When** el vendedor intenta emitirla, **Then** el sistema exige identificar al comprador antes de continuar.
9. **Given** el proveedor de emisión sin responder, **When** el vendedor confirma la venta, **Then** el sistema informa que no se pudo emitir, el pedido se conserva en el dispositivo y el vendedor puede reintentar más tarde (sin cola en segundo plano ni documento interno de contingencia).

---

### User Story 2 - Poner el catálogo en producción (Priority: P2)

El administrador carga el catálogo de productos que hoy vive en el proyecto de la tienda virtual, entregado como archivo estructurado o como documento. Revisa en pantalla lo que el sistema entendió, corrige o descarta lo que no cuadra, y confirma. A partir de ese momento los vendedores encuentran esos productos.

**Why this priority**: habilita todo lo demás. Se ordena después de P1 porque el valor está en vender, no en cargar, y porque P1 puede demostrarse con un subconjunto cargado a mano.

**Independent Test**: el administrador carga un archivo con productos y comprueba que quedan disponibles en la búsqueda, con sus precios y unidades.

**Acceptance Scenarios**:

1. **Given** un archivo con el catálogo, **When** el administrador lo carga, **Then** el sistema muestra un resumen de cuántos productos se reconocieron y cuántos presentan problemas, antes de confirmar nada.
2. **Given** un archivo con dos productos que comparten el mismo código, **When** el administrador lo carga, **Then** el sistema señala el conflicto y no lo resuelve por su cuenta.
3. **Given** un catálogo ya cargado, **When** el administrador carga una versión actualizada, **Then** puede ver qué productos son nuevos, cuáles cambian de precio y cuáles desaparecen, antes de aplicar los cambios.

---

### User Story 3 - Dar de alta un cliente nuevo sin abandonar la venta (Priority: P3)

Llega un cliente con RUC que nunca compró aquí. El vendedor escribe el número, el sistema detecta que no existe y le ofrece agregarlo en el mismo sitio. Consulta los datos por RUC o DNI, el vendedor los revisa y confirma, y la venta continúa donde estaba. Si escribió una razón social que coincide con varios clientes, el sistema le muestra las opciones para que elija.

**Why this priority**: es una fricción diaria concreta del sistema anterior —abandonar la venta para ir a otra ventana— y su solución es autocontenida.

**Independent Test**: partiendo de una venta en curso, el vendedor registra un cliente inexistente y termina la venta sin haber perdido el pedido.

**Acceptance Scenarios**:

1. **Given** un RUC que no está registrado, **When** el vendedor lo escribe, **Then** el sistema le ofrece agregarlo desde ahí mismo sin cambiar de pantalla.
2. **Given** un RUC válido, **When** el vendedor pide traer los datos, **Then** el sistema los presenta para revisión y el vendedor confirma antes de guardarlos.
3. **Given** una razón social parcial que coincide con varios clientes registrados, **When** el vendedor la escribe, **Then** el sistema presenta las coincidencias para que seleccione una.
4. **Given** un RUC que el registro oficial marca como no habido, **When** se traen sus datos, **Then** el sistema lo advierte de forma visible y deja la decisión al vendedor.
5. **Given** una consulta de datos que no obtiene respuesta, **When** el vendedor necesita continuar, **Then** puede escribir los datos a mano y la venta no se bloquea.

---

### User Story 4 - Anular un comprobante dentro de plazo (Priority: P4)

Un cliente vuelve porque su boleta salió con una cantidad equivocada. El vendedor localiza el comprobante, ve claramente que va a anularlo y qué implica, indica el motivo y confirma. El sistema deja constancia de quién lo anuló y cuándo.

**Why this priority**: ocurre a diario y hoy ya se hace en el sistema anterior. Es la primera operación irreversible del sistema, y por eso su diseño debe fijarse temprano.

**Independent Test**: emitido un comprobante, se anula dentro de plazo y queda registrado como anulado con su motivo y su autor.

**Acceptance Scenarios**:

1. **Given** un comprobante emitido hoy, **When** el vendedor solicita anularlo, **Then** el sistema muestra qué documento se va a anular y exige confirmación explícita antes de proceder.
2. **Given** un comprobante emitido ayer o antes, **When** el vendedor intenta anularlo, **Then** el sistema lo impide y explica que corresponde una nota de crédito.
3. **Given** una anulación confirmada, **When** se consulta el comprobante después, **Then** aparece como anulado, con el motivo, el autor y el momento.
4. **Given** cualquier pantalla del sistema, **When** se ofrece esta operación, **Then** en ningún lugar se la denomina "eliminar".

---

### User Story 5 - Guardar el pedido como cotización y recuperarlo (Priority: P5)

Un cliente pide precios pero no cierra la compra. El vendedor guarda el pedido como cotización con un número que lo identifica. Días después —quizá otro vendedor, quizá desde otro dispositivo— la recupera por ese número y la convierte en el documento que el cliente finalmente pida.

**Why this priority**: es una capacidad que el negocio ya usa conceptualmente ("pedidos guardados") y habilita la historia del canal de vecinos.

**Independent Test**: se guarda una cotización en un dispositivo y se recupera y convierte en comprobante desde otro.

**Acceptance Scenarios**:

1. **Given** un pedido armado, **When** el vendedor lo guarda como cotización, **Then** recibe un número que la identifica.
2. **Given** una cotización guardada en el puesto de escritorio, **When** otro vendedor la busca por su número desde un teléfono, **Then** la encuentra con todas sus líneas y precios.
3. **Given** una cotización, **When** se convierte en comprobante, **Then** queda cerrada a nuevas conversiones.
4. **Given** una cotización ya convertida, **When** alguien intenta convertirla otra vez, **Then** el sistema lo impide e indica en qué comprobante terminó.

---

### User Story 6 - Dictar el pedido (Priority: P6)

El vendedor tiene las manos ocupadas o el cliente va rápido. Pulsa el botón de audio y dice en voz alta lo que le están pidiendo. El sistema propone el pedido que entendió, mostrando junto a cada línea lo que oyó y el producto que sugiere. El vendedor corrige lo que haga falta, aprueba y sigue el flujo normal de emisión.

**Why this priority**: es la capacidad que probablemente convenza a los vendedores, de la cual depende el criterio de aceptación del dueño. Se ordena después del núcleo porque no puede sustituirlo.

**Independent Test**: se dicta un pedido de varios productos y se obtiene una propuesta revisable que, tras aprobarse, produce el mismo pedido que se habría escrito a mano.

**Acceptance Scenarios**:

1. **Given** un dictado con tres productos, **When** el sistema termina de interpretarlo, **Then** presenta las tres líneas con el texto oído y el producto propuesto para cada una, sin haber emitido nada.
2. **Given** una propuesta con una línea equivocada, **When** el vendedor la corrige, **Then** el pedido refleja la corrección y conserva el resto.
3. **Given** un dictado donde un término coincide con varios productos, **When** el sistema no puede decidir, **Then** presenta las opciones para que el vendedor elija en lugar de escoger por su cuenta.
4. **Given** un dictado que menciona al cliente, **When** el sistema procesa el audio, **Then** la identidad del cliente se resuelve dentro del sistema y ningún dato del cliente se envía al servicio de asistencia.
5. **Given** el servicio de asistencia sin responder, **When** el vendedor intenta dictar, **Then** el sistema lo informa con claridad y el vendedor puede completar la venta escribiendo.

---

### User Story 7 - Capturar una guía manual por fotografía (Priority: P7)

El almacenero tomó pedidos en papel, como siempre. Otra persona fotografía esas guías. El sistema extrae el texto y, para cada renglón, muestra lo que leyó junto al producto o productos que propone, de forma que se pueda comparar uno contra otro. Quien revisa confirma o corrige línea por línea, y de ahí sale el pedido.

**Why this priority**: es la única vía por la que el trabajo en papel entra al sistema, y cubre los dos usos reales del papel. Se ordena al final del bloque asistido porque es la pieza con más incertidumbre de calidad.

**Independent Test**: se fotografía una guía manual real y se obtiene un pedido revisable cuyo contenido puede compararse renglón a renglón con la foto.

**Acceptance Scenarios**:

1. **Given** la fotografía de una guía manual, **When** el sistema la procesa, **Then** muestra el texto extraído de cada renglón antes de proponer productos, y nada se ha emitido.
2. **Given** el texto extraído, **When** el sistema propone productos, **Then** cada renglón muestra el texto original y las propuestas de forma visualmente distinguible entre sí.
3. **Given** un renglón que el sistema no pudo interpretar, **When** se revisa la propuesta, **Then** ese renglón queda marcado como pendiente y no se descarta en silencio.
4. **Given** una fotografía ilegible, **When** el sistema no puede extraer texto, **Then** lo informa y permite reintentar con otra foto.
5. **Given** una guía que contiene el nombre de un cliente, **When** se procesa la imagen, **Then** los datos del cliente no se envían al servicio de asistencia.

---

### User Story 8 - Facturar al canal de vecinos en la entrega y cobrar después (Priority: P8)

Un comerciante vecino se lleva mercadería y pagará al cierre del día o en los días siguientes. El vendedor documenta la venta en el momento de la entrega, indicando que el pago es a crédito y cuándo se espera. Cuando el vecino paga, la venta queda registrada como cobrada.

**Why this priority**: corrige un desfase que hoy existe entre la entrega y el documento. Se ordena al final porque depende de las cotizaciones y de la emisión ya consolidadas, y porque requiere confirmación del contador.

**Independent Test**: se documenta una venta a crédito con fecha de pago esperada y, más tarde, se registra su cobro.

**Acceptance Scenarios**:

1. **Given** una venta a un vecino que se lleva la mercadería, **When** el vendedor la documenta como crédito, **Then** el comprobante se emite en ese momento con la fecha de pago esperada.
2. **Given** una venta a crédito pendiente, **When** el vecino paga, **Then** el vendedor registra el cobro y la venta deja de figurar como pendiente.
3. **Given** varias ventas a crédito de un mismo vecino, **When** se consulta ese cliente, **Then** se ve qué ventas siguen pendientes y desde cuándo.

---

### User Story 9 - Consultar desde el buscador con comandos (Priority: P9)

En lugar de navegar, el vendedor escribe una instrucción corta en el mismo buscador que usa para productos —los últimos comprobantes de un cliente, una cotización por su número— y obtiene el resultado sin cambiar de pantalla. Lo mismo puede pedirlo hablando.

**Why this priority**: reduce la navegación, que es una queja real, pero es la menos crítica y la más fácil de posponer. Se limita deliberadamente a consultas.

**Independent Test**: se pide por comando la lista de comprobantes de un cliente y se obtiene sin salir de la pantalla de venta.

**Acceptance Scenarios**:

1. **Given** un cliente con comprobantes previos, **When** el vendedor pide por comando sus últimos comprobantes, **Then** los obtiene sin abandonar la pantalla de venta.
2. **Given** una instrucción que pretende anular, eliminar o modificar un comprobante, **When** el vendedor la escribe o la dicta, **Then** el sistema no la ejecuta y le indica dónde se realiza esa operación.
3. **Given** una instrucción incompleta, **When** falta un dato para poder consultar, **Then** el sistema pide lo que falta en lugar de fallar.

---

### Edge Cases

- **La emisión se confirma y la respuesta nunca llega.** El sistema no debe reintentar a ciegas: debe poder averiguar si el documento existe antes de volver a intentarlo, y mientras no lo sepa, no debe presentar la venta como emitida ni como fallida.
- **El mismo pedido abierto en dos dispositivos.** Solo uno puede convertirlo en comprobante; el otro debe descubrir que ya se emitió.
- **El proveedor de emisión no responde.** Se informa con claridad; el pedido permanece en el dispositivo; el vendedor reintenta manualmente más tarde con la misma intención de venta (idempotencia). No hay emisión automática en background ni documento interno de contingencia (decisión 10 de `research.md`).
- **La respuesta de emisión se pierde (indeterminado).** El sistema MUST NOT ofrecer reemitir a ciegas. El vendedor (o un administrador) consulta el estado al proveedor bajo demanda; solo entonces se adopta el resultado.
- **Corte de red con el pedido a medio armar.** El pedido sobrevive en el dispositivo; al recuperar la conexión continúa.
- **Cambio de dispositivo con un pedido en curso.** Se acepta que el pedido en curso no viaje: el vendedor lo rehace. Las cotizaciones guardadas sí viajan.
- **Producto que no existe en el catálogo.** La búsqueda no debe devolver un resultado aproximado como si fuera exacto; debe quedar claro que no hay coincidencia.
- **Precio editado a cero o negativo.** No hay validación de precio por decisión del negocio, pero un importe no positivo no puede convertirse en comprobante.
- **Boleta que supera el importe que obliga a identificar al comprador.** El sistema debe exigir los datos del cliente antes de permitir la emisión.
- **Serie del vendedor no configurada.** El sistema debe impedir la venta con un mensaje que diga qué falta, en lugar de fallar al emitir.
- **Sesión revocada o vendedor desactivado.** La aplicación no debe permitir emitir con una sesión que ya no es válida.
- **Cotización cuyos productos cambiaron de precio o desaparecieron del catálogo.** Al recuperarla debe quedar claro qué cambió antes de convertirla.
- **El servicio de asistencia responde con lentitud.** El vendedor debe poder abandonar la espera y seguir escribiendo.
- **Fotografía de una guía con renglones tachados o ilegibles.** Deben quedar señalados como pendientes, nunca descartados en silencio.
- **Impresora sin papel o no disponible.** El comprobante ya emitido debe poder reimprimirse o compartirse como archivo; la falla de impresión no invalida la emisión.

## Requirements *(mandatory)*

### Functional Requirements

**Acceso y sesión**

- **FR-001**: El sistema MUST permitir que cada vendedor acceda con credenciales propias, sin depender de las de otra persona.
- **FR-002**: El sistema MUST mantener la sesión entre jornadas y revalidarla en segundo plano, sin pedir credenciales en cada apertura.
- **FR-003**: El sistema MUST impedir emitir cuando la sesión ya no sea válida o el vendedor haya sido desactivado.
- **FR-004**: El sistema MUST funcionar en navegador de escritorio y de móvil, con la misma capacidad de venta.
- **FR-005**: El sistema MUST distinguir los roles de vendedor, administrador y jefe, y limitar a cada uno a lo que le corresponde.
- **FR-005a**: El sistema MUST presentar un sidebar de navegación con la marca SuitPay, al menos los ítems Inicio y Configuración, y el perfil del usuario autenticado con acción de cerrar sesión al pie del sidebar.
- **FR-005b**: El mostrador (Inicio) MUST ofrecer tabs internos Pedido, Cotizaciones, Vecinos y Lista, y MUST abrir por defecto en el tab Pedido.

**Catálogo y búsqueda**

- **FR-006**: El sistema MUST encontrar un producto a partir de sus atributos escritos en cualquier orden, y tolerar variaciones y errores menores de escritura.
- **FR-007**: La búsqueda de productos MUST funcionar sin depender de ningún servicio externo de asistencia.
- **FR-008**: El sistema MUST distinguir con claridad la ausencia de coincidencias de una coincidencia aproximada.
- **FR-009**: El administrador MUST poder cargar el catálogo desde un archivo estructurado o un documento, revisando el resultado antes de confirmarlo.
- **FR-010**: El sistema MUST señalar los conflictos de una carga —códigos repetidos, precios ausentes, unidades desconocidas— sin resolverlos por su cuenta.
- **FR-011**: Ante una recarga del catálogo, el sistema MUST mostrar qué productos son nuevos, cuáles cambian y cuáles desaparecen, antes de aplicar los cambios.
- **FR-012**: El sistema MUST mostrar el precio mayorista como referencia y MUST permitir sustituirlo en el momento de la venta sin validar el nuevo valor.
- **FR-013**: El sistema MUST impedir convertir en comprobante una línea cuyo importe no sea positivo.

**Pedido**

- **FR-014**: El sistema MUST permitir armar un pedido único y convertirlo en boleta, factura o nota de venta sin volver a capturarlo.
- **FR-014a**: Al iniciar un pedido nuevo (o al abrir el mostrador sin pedido en curso que fije otro tipo), el tipo de documento MUST ser Nota de Venta por defecto.
- **FR-015**: El sistema MUST conservar el pedido en curso en el propio dispositivo, de forma que sobreviva a una pérdida de conexión y a un cambio de red.
- **FR-016**: El sistema MUST permitir guardar un pedido como cotización identificada por un número. En la cabecera del mostrador, Cotización es una opción del selector de tipo: el CTA del pie pasa a Guardar (sin emitir) y el resultado queda en el tab Cotizaciones.
- **FR-017**: Las cotizaciones MUST quedar accesibles desde cualquier dispositivo y para cualquier vendedor autorizado.
- **FR-018**: Al recuperar una cotización, el sistema MUST advertir de los productos que cambiaron de precio o dejaron de existir.
- **FR-019**: Una cotización convertida en comprobante MUST quedar cerrada a nuevas conversiones, indicando en qué comprobante terminó.

**Clientes**

- **FR-020**: El sistema MUST ofrecer como opción por defecto un cliente eventual, sin exigir datos para una venta ordinaria.
- **FR-021**: El sistema MUST exigir los datos identificatorios del cliente cuando el importe de una boleta supere los 700 soles, e impedir la emisión mientras falten.
- **FR-022**: El campo de cliente en cabecera MUST admitir, según el tipo: RUC (factura), DNI o Nombre (boleta), y RUC/DNI/Nombre (cotización). Con documento, MUST resolver primero clientes ya registrados; si no está registrado, MUST ofrecer registrarlo (morph «Agregar»). Con Nombre, MUST permitir fijar la denominación en el pedido/cotización sin abandonar la venta.
- **FR-023**: El sistema MUST poder traer los datos de un contribuyente a partir de su RUC o DNI, presentarlos para revisión (como mínimo razón social/denominación y dirección cuando exista) y guardarlos solo tras la confirmación del vendedor.
- **FR-024**: El sistema MUST advertir de forma visible cuando el registro oficial señale al contribuyente como no habido, dejando la decisión al vendedor.
- **FR-025**: Cuando una razón social parcial coincida con varios clientes, el sistema MUST presentar las coincidencias para que el vendedor elija.
- **FR-026**: Si la consulta de datos no obtiene respuesta, el sistema MUST permitir introducirlos a mano y MUST NOT bloquear la venta.

**Emisión**

- **FR-027**: El sistema MUST exigir la confirmación explícita de un vendedor identificado antes de emitir cualquier documento, y MUST atribuirle la emisión.
- **FR-028**: El sistema MUST garantizar que un mismo pedido produzca un único comprobante, independientemente del número de confirmaciones, del dispositivo o de los fallos de red.
- **FR-029**: El sistema MUST registrar el intento de emisión antes de solicitarlo al proveedor, y MUST NOT reintentar sin haber determinado antes si la emisión ocurrió.
- **FR-030**: El sistema MUST trazar toda emisión, anulación e intento fallido, con su autor, momento y resultado, incluidos los intentos que consumieron numeración.
- **FR-031**: El sistema MUST impedir la venta cuando el vendedor no tenga serie configurada, indicando exactamente qué falta.
- **FR-031a**: Al configurar una serie, el sistema MUST registrar un número inicial desde el cual empezará a emitir (ej. 0 → primer comprobante `serie-0`; 100 → `serie-100`), y MUST alinear el contador interno a ese origen. La serie y el número inicial MUST quedar coherentes con la configuración del proveedor de emisión.
- **FR-032**: El sistema MUST NOT recalcular por su cuenta el desglose del impuesto: los precios del catálogo lo incluyen y el desglose corresponde al proveedor de emisión.
- **FR-033**: El sistema MUST registrar el medio de pago y el monto recibido con carácter referencial, sin exigir conciliación.
- **FR-034**: El sistema MUST permitir documentar una venta a crédito indicando la fecha de pago esperada, y registrar posteriormente su cobro.
- **FR-035**: El sistema MUST permitir consultar qué ventas a crédito de un cliente siguen pendientes y desde cuándo.
- **FR-036**: El sistema MUST distinguir de forma inequívoca, en pantalla y en la impresión, los documentos con valor tributario de los internos.

**Anulación**

- **FR-037**: El sistema MUST permitir anular un comprobante el mismo día de su emisión, exigiendo un motivo y una confirmación explícita que muestre qué documento se va a anular.
- **FR-038**: El sistema MUST impedir la anulación de un comprobante emitido en una fecha anterior y MUST indicar que corresponde una nota de crédito.
- **FR-039**: El sistema MUST NOT usar la palabra "eliminar" para referirse a un comprobante emitido, en ninguna parte de la interfaz.

**Captura asistida**

- **FR-040**: El sistema MUST permitir capturar un pedido dictándolo por voz y otro fotografiando una guía manual.
- **FR-041**: Toda captura asistida MUST producir una propuesta revisable y MUST NOT emitir nada por sí sola.
- **FR-042**: La propuesta MUST mostrar, para cada línea, el contenido original interpretado junto al producto propuesto, de forma visualmente distinguible.
- **FR-043**: Cuando el sistema no pueda decidir entre varios productos, MUST presentar las opciones en lugar de escoger.
- **FR-044**: Las líneas que el sistema no pudo interpretar MUST quedar marcadas como pendientes y MUST NOT descartarse en silencio.
- **FR-045**: El sistema MUST NOT enviar a servicios de asistencia automática razón social, RUC, DNI, dirección, teléfono, correo ni historial de compras de un cliente. La identidad del cliente MUST resolverse dentro del sistema.
- **FR-046**: Cuando el servicio de asistencia no responda o tarde en exceso, el sistema MUST informarlo con claridad y MUST permitir completar la venta escribiendo.

**Comandos**

- **FR-047**: El sistema MUST admitir instrucciones de consulta, escritas o dictadas, resueltas sin abandonar la pantalla de venta.
- **FR-048**: El sistema MUST NOT ejecutar mediante instrucción en lenguaje natural ninguna operación que cree, modifique, anule o dé de baja un comprobante.
- **FR-049**: Cuando una instrucción esté incompleta o admita varias interpretaciones de cliente o de producto, el sistema MUST pedir lo que falta o presentar las coincidencias.

**Contingencia**

- **FR-050**: Cuando el proveedor de emisión no responda (`indisponible`), el sistema MUST informarlo con claridad, MUST conservar el pedido en el dispositivo y MUST permitir al vendedor reintentar la misma emisión más tarde. MUST NOT completar la emisión en segundo plano ni exigir datos de contacto “para después”.
- **FR-050a**: *(retirado — decisión 10 de `research.md`)* El documento interno de contingencia y la cola de ventas en espera dejan de ser requisitos de esta entrega.
- **FR-050b**: *(retirado — decisión 10)* Sustituido por consulta bajo demanda: ante estado `indeterminado`, el sistema MUST ofrecer solo una acción que consulta al proveedor si la emisión ocurrió, y MUST NOT reemitir.
- **FR-051**: El sistema MUST mostrar al vendedor, de forma visible, cuándo está operando de forma degradada y qué capacidad no está disponible.
- **FR-052**: El sistema MUST NOT bloquear la toma de un pedido por la indisponibilidad de un servicio externo.

**Salida impresa**

- **FR-053**: El sistema MUST permitir imprimir el comprobante en formato A4 desde los puestos de escritorio.
- **FR-054**: El sistema MUST permitir obtener el comprobante como archivo para compartirlo con el cliente, especialmente desde el móvil.
- **FR-055**: Un fallo de impresión MUST NOT invalidar ni repetir una emisión ya realizada; el comprobante MUST poder reimprimirse o compartirse.

### Key Entities

- **Producto**: lo que se vende. Nombre descriptivo que incorpora material, medida y marca; código; unidad de medida; precio mayorista de referencia con impuesto incluido.
- **Cliente**: quien compra. Tipo y número de documento de identidad, denominación, dirección, contacto y condición ante el registro oficial. Incluye el cliente eventual como caso por defecto.
- **Pedido en curso**: la lista que el vendedor está armando. Vive en el dispositivo, no ha producido ningún documento y puede convertirse en cualquiera de ellos.
- **Cotización**: un pedido guardado con número propio, accesible desde cualquier dispositivo, pendiente de convertirse o ya convertido.
- **Comprobante**: el documento resultante. Tipo, serie y número, cliente, líneas con precio, condición de pago, estado ante la autoridad, autor de la emisión y momento.
- **Intento de emisión**: el registro de una emisión solicitada, con su resultado o su indeterminación. Es lo que permite no emitir dos veces la misma venta.
- **Anulación**: la baja de un comprobante, con motivo, autor y momento.
- **Serie**: la numeración asignada a un vendedor para un tipo de documento, con número inicial configurado y correlativo consumido a partir de ese origen.
- **Vendedor**: quien atiende y asume la responsabilidad de lo emitido. Tiene rol, credenciales y series asignadas.
- **Captura asistida**: el contenido original —audio o imagen— y la propuesta derivada de él, con su estado de revisión.
- **Venta a crédito**: el compromiso de pago asociado a un comprobante, con fecha esperada y estado de cobro.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cualquier vendedor puede emitir su primer comprobante del día en menos de 2 minutos desde que llega a su puesto, sin depender de que otra persona esté presente. (Línea base: sin medir; hoy depende de la hora de llegada de quien tiene las credenciales.)
- **SC-002**: Una venta de mostrador de hasta 5 líneas se documenta completa en menos de 2 minutos desde que el cliente termina de pedir.
- **SC-003**: El 95% de las búsquedas de producto devuelven el producto buscado entre los primeros resultados al primer intento. (Línea base: sin medir; se sabe que el sistema anterior falla cuando el orden no es exacto.)
- **SC-004**: Ningún pedido produce dos comprobantes. El recuento de duplicados emitidos es cero, sostenido durante toda la operación.
- **SC-005**: La proporción de comprobantes rechazados u observados por la autoridad no empeora respecto del sistema anterior. (Línea base: sin medir.)
- **SC-006**: Ninguna venta se pierde por indisponibilidad de un servicio externo: el 100% de los pedidos iniciados durante una degradación pueden completarse o quedar en espera con los datos necesarios para emitir después.
- **SC-007**: Un pedido en curso sobrevive al 100% de las pérdidas de conexión y cambios de red dentro del mismo dispositivo.
- **SC-008**: El 80% de las líneas de un pedido dictado o fotografiado se aprueban sin corrección manual. (Línea base: no aplica; hoy se transcriben a mano en su totalidad.)
- **SC-009**: Los pedidos en papel que requieren transcripción manual completa se reducen respecto de la línea base semanal medida antes de la puesta en marcha.
- **SC-010**: El 100% de las ventas al canal de vecinos quedan documentadas el mismo día de la entrega. (Línea base: hoy se documentan cuando el cliente paga, que puede ser días después.)
- **SC-011**: El 100% de las emisiones, anulaciones e intentos fallidos son atribuibles a un vendedor identificado y a un momento concreto.
- **SC-012**: Ningún dato identificatorio de clientes aparece en el tráfico hacia servicios de asistencia automática, verificable por inspección.
- **SC-013**: Señal cualitativa, declarada como tal: los 5 vendedores manifiestan preferir SuitPay al sistema anterior tras dos semanas de uso. Es el criterio de aceptación del dueño y no sustituye a las métricas anteriores.

## Assumptions

- **Las líneas base de SC-001, SC-002, SC-003, SC-005 y SC-009 se miden en el sistema anterior antes de la puesta en marcha.** Sin ellas esos criterios no son verificables. Es una condición del veredicto `go` y una exigencia del principio VI de la constitución.
- **La emisión de comprobantes se delega en un proveedor externo** que firma y dialoga con la autoridad tributaria. SuitPay no asume la firma ni el certificado digital.
- **El proveedor de emisión ofrece un entorno de demostración** y toda integración se ejercita allí antes de tocar el entorno real.
- **El proveedor permite determinar si una emisión concreta ocurrió. Confirmado el 2026-07-28.** Su endpoint de consulta acepta exactamente serie y número y devuelve existencia, estado y traza de eventos, que es la primitiva de la que dependen FR-028 y FR-029. Era la asunción más cara de la especificación y ya no lo es. Queda por comprobar en el entorno de demostración que el proveedor respete un número explícito, lo que evitaría el sondeo de reconciliación; y, más importante, **qué forma tienen sus respuestas de error**, porque el ejemplo documentado no lleva código y de esa distinción depende no reintentar a ciegas. Ver `research.md`, decisiones 4 y 4b.
- **Una caída de la autoridad tributaria no impide emitir.** El proveedor firma en sus propios servidores y mantiene su propia cola hacia la autoridad. El fallo de FR-050 (mensaje + reintento manual) solo aplica cuando el proveedor mismo o la red están inalcanzables, no cuando lo está la autoridad (decisión 10).
- **Cada vendedor opera con series propias**, creadas de antemano para cada tipo de documento que vaya a emitir, cada una con un **número inicial** configurado (alineado con el panel del proveedor).
- **La dirección visual es Modern Soft-Pill** (`DESIGN.md` enmendado 2026-07-29): cápsulas, radios amplios, lienzo gris/blanco; no papel cálido ni radio cero.
- **Los precios del catálogo incluyen el impuesto** y el desglose lo realiza el proveedor de emisión.
- **El catálogo ronda los 500 productos** con nombres estructurados por material, medida y marca, lo que favorece tanto la búsqueda tolerante como el emparejamiento de las capturas.
- **La empresa dispone de conexión estable** y, ante caída del router, los vendedores pueden usar la red de sus teléfonos.
- **El alcance de esta entrega no incluye** contabilidad, cobranzas como módulo, guía de remisión, panel del jefe ni alertas de mercadería por agotarse, sugerencias de compra, notas de crédito como flujo completo, migración masiva de clientes, aplicación nativa, impresión desde el móvil, ni comandos que escriban. Ver `concept.md`.
- **El inventario no forma parte de esta entrega.** Mientras SuitPay y el sistema anterior operen aislados, cualquier cifra de stock sería inconsistente por diseño. El momento en que SuitPay tome el control del inventario es una decisión posterior.
- **La captura por voz y fotografía reutiliza herramientas ya existentes** en el proyecto de la tienda virtual de la empresa. Están funcionando pero acopladas a ese proyecto, y el grado de reelaboración necesario está sin evaluar. Si resultara profundo, las historias 6 y 7 deberían replantearse.
- **El pedido en curso no viaja entre dispositivos.** Cambiar de dispositivo obliga a rehacerlo, y el negocio lo acepta.
- **La impresión en formato de rollo**: el proveedor documenta `formato_pdf: ticket` además de `a4`. Esta entrega sigue cubriendo A4 y archivo compartible; la validación de maquetación/ancho del ticket queda por probar en demo.
- **El almacenero no usará el sistema.** Otra persona fotografía sus guías, por decisión explícita del negocio.
- **El umbral de 700 soles de FR-021 es un valor de origen regulatorio**, no una preferencia del negocio. Puede cambiar por norma sin que cambie nada en SuitPay, así que no debe quedar enterrado como una constante intocable: modificarlo tiene que ser barato.
- **Anular solo el mismo día es la regla de operación de la empresa**, y es más estricta que el máximo que la norma admite. Se adopta deliberadamente por prudencia: reduce la ventana en la que un comprobante puede desaparecer y empuja los errores tardíos hacia la nota de crédito, que deja mejor rastro.
- **FR-050a (documento interno de contingencia) está retirado** en esta entrega (decisión 10). No hay papel sustituto automático mientras el proveedor no responde.

# Feature Specification: Mostrador asistido — primera entrega de SuitPay

**Feature Branch**: `001-mostrador-asistido`

**Created**: 2026-07-28

**Updated**: 2026-08-18 (enmienda: US2 marca persistida + categoría de un nivel en importación; nota de venta interna confirmada; stock en `003`)

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
4. **Given** un producto con precio mayorista de referencia, **When** el vendedor escribe un precio igual o mayor, **Then** el sistema lo acepta y el total se recalcula.
5. **Given** un producto con precio mayorista de referencia, **When** el vendedor escribe un precio menor, **Then** la línea se marca, el total se recalcula, y emitir o guardar quedan bloqueados hasta corregirlo.
5. **Given** un pedido listo y un cliente eventual por defecto, **When** el vendedor confirma la emisión, **Then** el comprobante se emite, queda atribuido a ese vendedor y el diálogo de éxito ofrece imprimir, guardar/descargar o compartir el PDF del proveedor cuando exista (sin reemitir).
6. **Given** un pedido en curso, **When** el vendedor pierde la conexión y la recupera en el mismo dispositivo, **Then** el pedido sigue ahí sin pérdida de líneas.
7. **Given** una emisión en curso, **When** el vendedor pulsa confirmar dos veces seguidas, **Then** se emite un único comprobante.
8. **Given** una boleta cuyo importe supera los 700 soles y un cliente eventual, **When** el vendedor intenta emitirla, **Then** el sistema exige identificar al comprador antes de continuar.
9. **Given** el proveedor de emisión sin responder, **When** el vendedor confirma la venta, **Then** el sistema informa que no se pudo emitir, el pedido se conserva en el dispositivo y el vendedor puede reintentar más tarde (sin cola en segundo plano ni documento interno de contingencia).

---

### User Story 2 - Poner el catálogo en producción (Priority: P2)

El administrador carga el catálogo desde el JSON de la tienda virtual **o** desde el PDF de lista de precios del proveedor (columnas CODIGO | PRODUCTO | U.M. | PRECIO S/; se ignoran % DCT.). Tras interpretar un PDF, revisa en una grilla editable lo que el sistema entendió: puede seleccionar filas, eliminar, autoseleccionar por marca (`LINEA`), editar en línea, **crear categorías de un nivel y asignarlas a filas** (también en lote, p. ej. tras filtrar por marca) y solo entonces validar el resumen/conflictos/diff y confirmar la publicación. Nada se aplica al catálogo vivo hasta esa confirmación. A partir de ese momento los vendedores encuentran esos productos y pueden filtrarlos por marca y por categoría —en todo el catálogo o dentro de una marca.

**Why this priority**: habilita todo lo demás. Se ordena después de P1 porque el valor está en vender, no en cargar, y porque P1 puede demostrarse con un subconjunto cargado a mano.

**Independent Test**: el administrador carga un archivo (JSON o PDF de prueba), crea al menos una categoría, asigna productos (incluido filtrar por marca) y comprueba que quedan disponibles en la búsqueda, con precios, unidades, marca persistida y filtro por categoría.

**Acceptance Scenarios**:

1. **Given** un archivo con el catálogo, **When** el administrador lo carga, **Then** el sistema muestra un resumen de cuántos productos se reconocieron y cuántos presentan problemas, antes de confirmar nada.
2. **Given** un archivo con dos productos que comparten el mismo código, **When** el administrador lo carga, **Then** el sistema señala el conflicto y no lo resuelve por su cuenta.
3. **Given** un catálogo ya cargado, **When** el administrador carga una versión actualizada, **Then** puede ver qué productos son nuevos, cuáles cambian de precio y cuáles desaparecen, antes de aplicar los cambios.
4. **Given** el PDF de lista de precios del proveedor (`docs/LISTAS.pdf` o equivalente), **When** el administrador lo interpreta, **Then** ve una grilla con las filas reconocidas (código, producto, U.M., precio) y metadato de marca desde `LINEA`, sin haber escrito aún en Firestore.
5. **Given** la grilla de revisión con filas de varias marcas, **When** el administrador autoselecciona una marca y elimina la selección, **Then** esas filas salen de la importación pendiente y no forman parte del validar/publicar.
6. **Given** una fila con unidad o descripción incorrecta, **When** el administrador la edita en línea y valida, **Then** el resumen refleja el valor corregido; la publicación sigue bloqueada si quedan conflictos no resueltos.
7. **Given** la grilla de revisión, **When** el administrador crea una categoría (un solo nivel) y la asigna a una o más filas, **Then** esas filas quedan agrupadas bajo esa categoría y la publicación la persiste junto con el catálogo.
8. **Given** productos de varias marcas en la grilla, **When** el administrador filtra por una marca y asigna una categoría a la selección, **Then** solo esas filas de esa marca quedan asignadas; la misma categoría sigue siendo usable en el resto del catálogo.
9. **Given** un catálogo publicado con marcas y categorías, **When** el vendedor o el administrador filtra por categoría (global) o por categoría dentro de una marca, **Then** solo se listan los productos que cumplen ese criterio. Un producto sin categoría permanece visible en el listado sin filtro.

---

### User Story 3 - Dar de alta un cliente nuevo sin abandonar la venta (Priority: P3)

Llega un cliente con RUC que nunca compró aquí. El vendedor escribe el número y confirma con Enter; el sistema detecta que no existe, consulta el padrón de inmediato y abre el diálogo de alta con los datos precargados. El vendedor los revisa y confirma, y la venta continúa donde estaba. Si escribió una razón social que coincide con varios clientes, el sistema le muestra las opciones para que elija.

**Why this priority**: es una fricción diaria concreta del sistema anterior —abandonar la venta para ir a otra ventana— y su solución es autocontenida.

**Independent Test**: partiendo de una venta en curso, el vendedor registra un cliente inexistente y termina la venta sin haber perdido el pedido.

**Acceptance Scenarios**:

1. **Given** un RUC o DNI que no está registrado, **When** el vendedor lo confirma con Enter en cabecera, **Then** el sistema consulta el padrón y abre el diálogo de alta con los datos precargados, sin paso intermedio de morph «Agregar».
2. **Given** un RUC o DNI válido no registrado y respuesta del padrón, **When** se abre el diálogo de alta, **Then** el sistema presenta los datos para revisión y el vendedor confirma antes de guardarlos.
3. **Given** una búsqueda (razón social, RUC o DNI) que coincide con clientes registrados en el diálogo «Buscar o Agregar cliente», **When** el sistema lista resultados, **Then** cada fila ofrece «Usar» y «Editar».
4. **Given** un RUC o DNI ya registrado, **When** el vendedor lo confirma con Enter en cabecera, **Then** el sistema fija ese cliente al pedido de inmediato, sin panel de confirmación.
4. **Given** un RUC que el registro oficial marca como no habido, **When** se traen sus datos, **Then** el sistema lo advierte de forma visible y deja la decisión al vendedor.
5. **Given** una consulta de datos que no obtiene respuesta, **When** el vendedor necesita continuar, **Then** puede escribir los datos a mano y la venta no se bloquea.

---

### User Story 4 - Anular un comprobante dentro de plazo (Priority: P4)

Un cliente vuelve porque su boleta salió con una cantidad equivocada. El vendedor localiza el comprobante (el suyo o el de un compañero), abre el detalle, ve claramente que va a anularlo y qué implica, indica el motivo y confirma. El sistema deja constancia de quién lo anuló y cuándo. La anulación ocurre en el detalle del comprobante; la lista solo localiza y enlaza.

**Why this priority**: ocurre a diario y hoy ya se hace en el sistema anterior. Es la primera operación irreversible del sistema, y por eso su diseño debe fijarse temprano.

**Independent Test**: emitido un comprobante, se anula dentro de plazo y queda registrado como anulado con su motivo y su autor.

**Acceptance Scenarios**:

1. **Given** un comprobante emitido hoy, **When** el vendedor solicita anularlo desde el detalle, **Then** el sistema muestra qué documento se va a anular y exige confirmación explícita antes de proceder.
2. **Given** un comprobante emitido ayer o antes, **When** el vendedor intenta anularlo, **Then** el sistema lo impide y explica que corresponde una nota de crédito.
3. **Given** una anulación confirmada, **When** se consulta el comprobante después, **Then** aparece como anulado, con el motivo, el autor y el momento.
4. **Given** cualquier pantalla del sistema, **When** se ofrece esta operación, **Then** en ningún lugar se la denomina "eliminar".
5. **Given** un comprobante emitido hoy por el vendedor A, **When** el vendedor B lo anula dentro de plazo con motivo y confirmación, **Then** la anulación procede y queda atribuida al vendedor B (el emisor original permanece en la traza).

---

### User Story 4b - Resumen, filtros e impresión de comprobantes (Priority: P4)

Al cierre o durante el día, la encargada de caja o cualquier vendedor abre Comprobantes. La página no descarga la lista al entrar: ofrece **Hoy** (todos los del día, con total de ventas para cierre de caja), un **rango de fechas** paginado, un **filtro por cliente** (combinable con Hoy o con el rango) y una **búsqueda por serie y número**. Cada documento visible ofrece imprimir el PDF (URL del proveedor) y reutilizar el pedido; el detalle sigue siendo el lugar para anular.

**Why this priority**: el listado actual no sirve para cierre de caja ni para el trabajo colaborativo del mostrador; sin filtros bajo demanda el coste de lecturas y la fricción crecen.

**Independent Test**: con varios comprobantes del día de distintos vendedores, pulsar Hoy muestra todos y un total que excluye anulados; un rango pagina de 20 en 20; buscar por serie-número abre el documento con opción de imprimir.

**Acceptance Scenarios**:

1. **Given** la página Comprobantes recién abierta, **When** no se ha pulsado ningún filtro, **Then** no se muestra lista de comprobantes (solo controles).
2. **Given** comprobantes emitidos hoy por varios vendedores, **When** se pulsa **Hoy**, **Then** se cargan todos los del día (zona America/Lima) sin paginación y se muestra el **total de ventas** del día (comprobantes emitidos; los anulados no suman).
3. **Given** el modo **Hoy** activo, **When** se elige un cliente, **Then** la lista y el resumen se restringen a ese cliente **y** al día de hoy.
4. **Given** un rango de fechas `{inicio, fin}`, **When** se aplica, **Then** se desactiva Hoy, se lista con paginación por cursores (página de 20) y, si hay cliente elegido, se exige que cumplan rango **y** cliente.
5. **Given** serie y número de un comprobante conocido, **When** se usa la búsqueda exacta, **Then** se muestra ese documento con opción de **Imprimir** (URL PDF del proveedor persistida o reconsultada).
6. **Given** una fila visible en la lista, **When** el vendedor pulsa Imprimir, **Then** se abre/usa la URL PDF del comprobante sin reemitir; si no hay URL, el sistema la obtiene por consulta al proveedor y puede guardarla en el documento.
7. **Given** un comprobante emitido por el vendedor A, **When** el vendedor B lo busca, imprime o reutiliza, **Then** puede hacerlo sin restricción por autor (mismo universo de documentos para vendedor, admin y jefe).

---

### User Story 5 - Guardar el pedido como cotización y recuperarlo (Priority: P5)

Un cliente pide precios pero no cierra la compra. El vendedor guarda el pedido como cotización con un número que lo identifica. Días después —quizá otro vendedor, quizá desde otro dispositivo— la recupera por ese número y la convierte en el documento que el cliente finalmente pida. Si la cotización ya no sirve, el vendedor puede eliminarla; si se convierte en comprobante, desaparece del sistema.

**Why this priority**: es una capacidad que el negocio ya usa conceptualmente ("pedidos guardados") y habilita la historia del canal de vecinos.

**Independent Test**: se guarda una cotización en un dispositivo y se recupera y convierte en comprobante desde otro; la cotización deja de existir tras la conversión.

**Acceptance Scenarios**:

1. **Given** un pedido armado, **When** el vendedor lo guarda como cotización, **Then** recibe un número que la identifica y queda listada en el tab Cotizaciones (`canal` general).
2. **Given** una cotización guardada en el puesto de escritorio, **When** otro vendedor la busca por su número desde un teléfono, **Then** la encuentra con todas sus líneas y precios.
3. **Given** una cotización pendiente, **When** se convierte en boleta, factura o nota de venta, **Then** el documento de cotización se elimina en duro de Firestore en el mismo acto que crea el comprobante.
4. **Given** una cotización que ya fue convertida o eliminada, **When** alguien intenta convertirla otra vez (p. ej. desde otro dispositivo), **Then** el sistema lo impide porque la cotización ya no existe.
5. **Given** una cotización pendiente en el tab Cotizaciones, **When** el vendedor pulsa eliminar y confirma en el diálogo, **Then** el documento se elimina en duro de Firestore y deja de listarse.
6. **Given** el diálogo de confirmación de eliminación, **When** el vendedor cancela, **Then** la cotización permanece intacta.
7. **Given** el tab Cotizaciones, **When** el vendedor pulsa Subir PDF y elige un PDF de requerimiento, **Then** el procesamiento corre en segundo plano: el tab sigue usable, y al terminar aparece un toast y una fila en Pendientes recientes con el nombre del cliente (si se resolvió) o «Sin cliente».
8. **Given** un job de PDF listo, **When** el vendedor pulsa Revisar cotización, **Then** se abre la revisión contrastada en Pedido; nada se ha numerado ni emitido.
9. **Given** un PDF cuyo cliente está en el índice local, **When** termina el job, **Then** la fila muestra **nuestra** denominación, no un nombre inventado por el modelo.

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

### User Story 8 - Canal de vecinos como cotizaciones por alias (Priority: P8)

Un comerciante vecino se lleva mercadería y pagará al cierre del día o en los días siguientes. En la práctica de la empresa, el vendedor arma una cotización dedicada a ese vecino en el momento de la entrega; cuando el vecino paga —el mismo día u otro—, esa cotización se convierte en boleta, factura o nota de venta. El tab Vecinos agrupa esas cotizaciones por alias, con una superficie de trabajo (líneas + total) por vecino.

**Why this priority**: alinea el sistema al flujo real (cotizar → cobrar → emitir) y corrige el desfase entre entrega y documento. Depende de las cotizaciones (incluida su eliminación al convertir) ya consolidadas.

**Independent Test**: se crea un vecino por comando confirmado, se le agregan productos desde el buscador dentro de su tab, y más tarde se convierte esa cotización en comprobante; la cotización desaparece.

**Acceptance Scenarios**:

1. **Given** el buscador del mostrador, **When** el vendedor escribe `/crear vecino {alias} {DNI/RUC}` (p. ej. `/crear vecino wilmer 12345678901`) y confirma la propuesta, **Then** queda un vecino con ese alias y una cotización viva (`canal` vecino) asociada a ese documento de identidad.
2. **Given** el tab Vecinos con al menos un vecino, **When** el vendedor abre un tab interno, **Then** solo se muestra el alias como etiqueta del tab, y el cuerpo muestra la lista de productos y el total de esa cotización.
3. **Given** un tab interno de vecino activo, **When** el vendedor busca y elige un producto en el buscador, **Then** la línea se agrega a la cotización de ese vecino (no al pedido general ni a otro vecino).
4. **Given** la cotización de un vecino con líneas, **When** el vendedor la convierte en boleta, factura o nota de venta, **Then** se emite el comprobante y la cotización se elimina en duro (misma regla que US5).
5. **Given** el comando `/crear vecino …` sin confirmación, **When** el vendedor cancela la propuesta o no confirma, **Then** no se crea ningún documento.

---

### User Story 9 - Consultar desde el buscador con comandos (Priority: P9)

En lugar de navegar, el vendedor escribe una instrucción corta en el mismo buscador que usa para productos —los últimos comprobantes de un cliente, una cotización por su número— y obtiene el resultado sin cambiar de pantalla. Lo mismo puede pedirlo hablando.

**Why this priority**: reduce la navegación, que es una queja real, pero es la menos crítica y la más fácil de posponer. Se limita deliberadamente a consultas.

**Independent Test**: se pide por comando la lista de comprobantes de un cliente y se obtiene sin salir de la pantalla de venta.

**Acceptance Scenarios**:

1. **Given** un cliente con comprobantes previos, **When** el vendedor pide por comando sus últimos comprobantes, **Then** los obtiene sin abandonar la pantalla de venta.
2. **Given** una instrucción que pretende anular, eliminar o modificar un comprobante, **When** el vendedor la escribe o la dicta, **Then** el sistema no la ejecuta y le indica dónde se realiza esa operación.
3. **Given** una instrucción incompleta, **When** falta un dato para poder consultar, **Then** el sistema pide lo que falta en lugar de fallar.
4. **Given** el buscador vacío o con texto que empieza por `/`, **When** el vendedor escribe `/`, **Then** ve una lista seleccionable de los comandos del catálogo cerrado (no sugerencias de producto) y, al elegir uno, el prefijo queda en el campo con los parámetros pendientes como pista.

---

### User Story 10 - Reutilizar el pedido de un comprobante emitido (Priority: P6)

Tras emitir una boleta o factura, el cliente —al recoger— indica que es de provincia y necesita también una guía de remisión con la misma mercadería. El vendedor abre el comprobante, reutiliza las líneas en el mostrador y arma el documento adicional (p. ej. guía vía `002-guias-remision`) sin volver a capturar el pedido. El comprobante original permanece intacto.

**Why this priority**: evita recaptura en un caso real del mostrador; no toca la emisión del documento origen (principio II).

**Independent Test**: desde el detalle de un comprobante emitido con líneas, «Reutilizar pedido» deja esas líneas (y cliente) en el tab Pedido con nueva intención de venta.

**Acceptance Scenarios**:

1. **Given** un comprobante emitido con líneas, **When** el vendedor pulsa «Reutilizar pedido», **Then** el mostrador muestra esas líneas y el cliente del documento, sin modificar el comprobante origen.
2. **Given** un pedido en curso en el dispositivo, **When** el vendedor reutiliza otro comprobante, **Then** el sistema pide confirmación antes de reemplazar el pedido actual.
3. **Given** un pedido reutilizado, **When** el vendedor emite un documento nuevo, **Then** se usa una clave de idempotencia distinta a la del comprobante origen.

---

### Edge Cases

- **La emisión se confirma y la respuesta nunca llega.** El sistema no debe reintentar a ciegas: debe poder averiguar si el documento existe antes de volver a intentarlo, y mientras no lo sepa, no debe presentar la venta como emitida ni como fallida.
- **La misma cotización abierta en dos dispositivos.** Solo uno puede convertirla en comprobante; el otro debe descubrir que la cotización ya no existe (`cotizacion_ya_usada`).
- **El proveedor de emisión no responde.** Se informa con claridad; el pedido permanece en el dispositivo; el vendedor reintenta manualmente más tarde con la misma intención de venta (idempotencia). No hay emisión automática en background ni documento interno de contingencia (decisión 10 de `research.md`).
- **La respuesta de emisión se pierde (indeterminado).** El sistema MUST NOT ofrecer reemitir a ciegas. El vendedor (o un administrador) consulta el estado al proveedor bajo demanda; solo entonces se adopta el resultado.
- **Corte de red con el pedido a medio armar.** El pedido sobrevive en el dispositivo; al recuperar la conexión continúa.
- **Cambio de dispositivo con un pedido en curso.** Se acepta que el pedido en curso no viaje: el vendedor lo rehace. Las cotizaciones guardadas sí viajan.
- **Producto que no existe en el catálogo.** La búsqueda no debe devolver un resultado aproximado como si fuera exacto; debe quedar claro que no hay coincidencia.
- **Precio editado a cero o negativo.** Un importe no positivo no puede convertirse en comprobante (FR-013).
- **Precio por debajo del mayorista.** La línea se marca y emitir/guardar quedan bloqueados hasta subir el precio al de catálogo o más (FR-012).
- **Boleta que supera el importe que obliga a identificar al comprador.** El sistema debe exigir los datos del cliente antes de permitir la emisión.
- **Serie del vendedor no configurada.** El sistema debe impedir la venta con un mensaje que diga qué falta, en lugar de fallar al emitir.
- **Sesión revocada o vendedor desactivado.** La aplicación no debe permitir emitir con una sesión que ya no es válida.
- **Cotización cuyos productos cambiaron de precio o desaparecieron del catálogo.** Al recuperarla debe quedar claro qué cambió antes de convertirla.
- **El servicio de asistencia responde con lentitud.** El vendedor debe poder abandonar la espera y seguir escribiendo.
- **Fotografía de una guía con renglones tachados o ilegibles.** Deben quedar señalados como pendientes, nunca descartados en silencio.
- **Impresora sin papel o no disponible.** El comprobante ya emitido debe poder reimprimirse o compartirse como archivo; la falla de impresión no invalida la emisión.
- **Hoy activo y luego se elige un rango de fechas.** Se desactiva Hoy; manda el rango (y el cliente si aplica).
- **URL PDF ausente o rota.** Se reconsulta al proveedor; no se reemite; no se sube el PDF a Storage.
- **Nota de venta sin PDF del proveedor.** Imprimir lo indica con claridad; no falla la consulta de lista ni el resumen.
- **Resumen del día con anulados.** Los anulados aparecen en la lista de Hoy si existen, pero no suman al total de cierre.

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
- **FR-009b**: Ante un PDF de lista de precios, el sistema MUST interpretar las columnas CODIGO, PRODUCTO, U.M. y PRECIO (ignorando % DCT.), MUST presentar una grilla de revisión editable (selección, eliminación, autoselección por marca `LINEA`, edición inline) y MUST NOT escribir `catalogo/actual` hasta que el administrador confirme publicar tras validar. El parseo MUST ser determinista en servidor (`unpdf` + reglas de columnas); MUST NOT delegar la extracción tabular a un LLM.
- **FR-009c**: Cada producto del catálogo publicado MUST persistir `marca` como campo propio (JSON de tienda: `brand`; PDF: cabecera `LINEA`). La marca MUST seguir formando parte de `descripcion` para la búsqueda. Un producto sin marca reconocida MUST publicarse con `marca` vacío, no inventar una.
- **FR-009d**: El administrador MUST poder crear y asignar **categorías de un solo nivel** en la administración del catálogo (lista maestra publicada e importación pendiente de publicar). El documento `catalogo/actual` MUST incluir el arreglo `categorias: { id, nombre }[]`. Cada producto MAY tener `categoriaId` opcional. La misma categoría MUST servir para filtrar/agrupar en todo el catálogo y dentro de una marca (filtros combinables). MUST NOT exigirse jerarquía familia/grupo. MUST NOT bloquear la publicación si un producto no tiene categoría. Los filtros facetados MUST estar en la grilla de importación y en la administración del catálogo, sobre el catálogo ya cargado. MUST NOT aparecer en la búsqueda del mostrador: el vendedor busca con el combobox local (FR-006, FR-007).
- **FR-010**: El sistema MUST señalar los conflictos de una carga —códigos repetidos, precios ausentes, unidades desconocidas— sin resolverlos por su cuenta.
- **FR-011**: Ante una recarga del catálogo, el sistema MUST mostrar qué productos son nuevos, cuáles cambian y cuáles desaparecen, antes de aplicar los cambios.
- **FR-012**: El sistema MUST mostrar el precio mayorista como referencia y MUST permitir sustituirlo en el momento de la venta solo si el nuevo valor es **mayor o igual** al de catálogo. Un precio menor MUST marcarse y MUST impedir emitir y guardar cotización (piso acordado con gerencia).
- **FR-013**: El sistema MUST impedir convertir en comprobante una línea cuyo importe no sea positivo.

**Pedido**

- **FR-014**: El sistema MUST permitir armar un pedido único y convertirlo en boleta, factura o nota de venta sin volver a capturarlo.
- **FR-014a**: Al iniciar un pedido nuevo (o al abrir el mostrador sin pedido en curso que fije otro tipo), el tipo de documento MUST ser Nota de Venta por defecto.
- **FR-015**: El sistema MUST conservar el pedido en curso en el propio dispositivo, de forma que sobreviva a una pérdida de conexión y a un cambio de red.
- **FR-016**: El sistema MUST permitir guardar un pedido como cotización identificada por un número, con `canal` `general`. En la cabecera del mostrador, Cotización es una opción del selector de tipo: el CTA del pie pasa a Guardar (sin emitir) y el resultado queda en el tab Cotizaciones (solo cotizaciones de canal general).
- **FR-017**: Las cotizaciones MUST quedar accesibles desde cualquier dispositivo y para cualquier vendedor autorizado.
- **FR-018**: Al recuperar una cotización, el sistema MUST advertir de los productos que cambiaron de precio o dejaron de existir.
- **FR-019**: Al convertir una cotización en boleta, factura o nota de venta, el sistema MUST eliminar en duro el documento de cotización en la misma transacción que crea el comprobante. Si la cotización ya no existe, MUST impedir una segunda conversión.
- **FR-019a**: El tab Cotizaciones MUST ofrecer eliminar una cotización pendiente mediante un control explícito que exige confirmación del vendedor; tras confirmar, el documento MUST eliminarse en duro de Firestore. Cancelar el diálogo MUST dejar la cotización intacta.
- **FR-061**: El tab Cotizaciones MUST ofrecer **Subir PDF** para importar un requerimiento del cliente. MUST NOT numerar una cotización ni emitir por el solo hecho de subir el archivo. Recuperar por número MUST seguir disponible como control de icono dentro del campo de número (Enter envía la búsqueda).
- **FR-061a**: El PDF MUST enviarse al modelo como documento (`application/pdf`, inline o File API si supera el techo). MUST NOT extraerse el texto en el servidor con un parser determinista antes del modelo. El catálogo MUST NOT viajar en el payload; el emparejamiento MUST ocurrir en el cliente con la búsqueda local (Fuse). El modelo MAY devolver `cliente: { tipoDocumento, numeroDocumento, denominacion } | null`. La etiqueta de Pendientes MUST usar la denominación del índice/`clientes/{id}` cuando el documento coincida; si no está registrado, MAY mostrar una etiqueta provisional en la fila del job y MUST NOT escribir `clientes/{id}` desde la respuesta del modelo.
- **FR-061b**: El procesamiento MUST ser un trabajo en segundo plano. Al terminar MUST avisarse con toast y MUST NOT abrir el diff ni cambiar de tab. «Revisar cotización» hidrata la revisión contrastada (FR-042) y pasa a Pedido. Aprobar sigue FR-041. Si la asistencia está caída, Subir PDF MUST quedar inerte (FR-046).
- **FR-061c**: En la revisión, cada caja de sugerencias MUST ofrecer un control (lupa) que abre un combobox local sobre el catálogo para esa línea.
- **FR-056**: Desde el detalle de un comprobante con líneas, el sistema MUST ofrecer «Reutilizar pedido»: cargar esas líneas (y el cliente, si lo había) en el mostrador como un pedido nuevo, con nueva clave de idempotencia, **sin modificar ni anular** el comprobante origen. Si ya hay un pedido en curso, MUST pedir confirmación antes de reemplazarlo. Al recuperar, SHOULD advertir diferencias de catálogo cuando aplique el mismo criterio que FR-018. Caso de uso: emitir boleta/factura y, al recoger, necesitar además una guía de remisión con la misma lista (ver feature `002-guias-remision`).

**Clientes**

- **FR-020**: El sistema MUST ofrecer como opción por defecto un cliente eventual, sin exigir datos para una venta ordinaria.
- **FR-021**: El sistema MUST exigir los datos identificatorios del cliente cuando el importe de una boleta supere los 700 soles, e impedir la emisión mientras falten.
- **FR-022**: El campo de cliente en cabecera MUST admitir, según el tipo: RUC (factura), DNI o Nombre (boleta), y RUC/DNI/Nombre (cotización). Con documento, MUST resolver primero clientes ya registrados y, si existe, MUST fijarlo al pedido de inmediato sin panel de confirmación; si no está registrado, tras Enter MUST consultar el padrón y abrir el diálogo de alta con los datos precargados — MUST NOT exigir un paso intermedio de morph «Agregar». Mientras consulta (registro o padrón), MUST mostrar feedback visual inmediato en el campo (p. ej. indicador de carga). Con Nombre, MUST fijar la denominación en el pedido/cotización de inmediato al confirmar (Enter o «Usar»), sin panel intermedio de confirmación y sin abandonar la venta. El control «+» MUST abrir el diálogo «Buscar o Agregar cliente» (búsqueda por RUC/DNI/razón social o alta) y MUST NOT confirmar el campo inline. En ese diálogo, MUST NOT permitir usar un cliente cuyo documento sea incompatible con el tipo actual (factura ↔ solo RUC; boleta ↔ solo DNI).
- **FR-023**: El sistema MUST poder traer los datos de un contribuyente a partir de su RUC o DNI, presentarlos para revisión en el diálogo de alta (como mínimo razón social/denominación y dirección cuando exista) y guardarlos solo tras la confirmación del vendedor.
- **FR-024**: El sistema MUST advertir de forma visible cuando el registro oficial señale al contribuyente como no habido, dejando la decisión al vendedor.
- **FR-025**: Cuando una búsqueda por razón social, RUC o DNI coincida con clientes registrados, el sistema MUST presentar la lista de resultados. Cada resultado MUST ofrecer «Usar» (fijar al pedido) y «Editar» (corregir datos antes de usar).
- **FR-026**: Si la consulta de datos no obtiene respuesta, el sistema MUST abrir el diálogo de alta en modo manual, MUST permitir introducirlos a mano y MUST NOT bloquear la venta.

**Emisión**

- **FR-027**: El sistema MUST exigir la confirmación explícita de un vendedor identificado antes de emitir cualquier documento, y MUST atribuirle la emisión.
- **FR-028**: El sistema MUST garantizar que un mismo pedido produzca un único comprobante, independientemente del número de confirmaciones, del dispositivo o de los fallos de red.
- **FR-029**: El sistema MUST registrar el intento de emisión antes de solicitarlo al proveedor, y MUST NOT reintentar sin haber determinado antes si la emisión ocurrió.
- **FR-030**: El sistema MUST trazar toda emisión, anulación e intento fallido, con su autor, momento y resultado, incluidos los intentos que consumieron numeración.
- **FR-031**: El sistema MUST impedir la venta cuando el vendedor no tenga serie configurada, indicando exactamente qué falta.
- **FR-031a**: Al configurar una serie, el sistema MUST registrar un número inicial desde el cual empezará a emitir (ej. 0 → primer comprobante `serie-0`; 100 → `serie-100`), y MUST alinear el contador interno a ese origen. La serie y el número inicial MUST quedar coherentes con la configuración del proveedor de emisión.
- **FR-032**: El sistema MUST NOT recalcular por su cuenta el desglose del impuesto: los precios del catálogo lo incluyen y el desglose corresponde al proveedor de emisión.
- **FR-033**: El sistema MUST registrar el medio de pago y el monto recibido con carácter referencial, sin exigir conciliación.
- **FR-034**: El tab Vecinos MUST listar cotizaciones de `canal` `vecino` como tabs internos etiquetados solo con el `aliasVecino`, cada uno con la lista de líneas y el total de esa cotización viva.
- **FR-034a**: El sistema MUST admitir el comando `/crear vecino {alias} {DNI/RUC}` en el buscador del mostrador. El comando MUST resolverse en una propuesta que el vendedor confirma o cancela; MUST NOT crear el vecino ni su cotización sin esa confirmación (principio I).
- **FR-034b**: Tras confirmar `/crear vecino`, el sistema MUST crear (o reutilizar el cliente registrado para ese documento) y una cotización pendiente `canal` `vecino` con el alias indicado; si el cliente no está registrado, MUST ofrecer el alta en contexto antes de completar.
- **FR-035**: Mientras un tab interno de vecino esté activo, las altas de producto desde el buscador MUST agregarse a la cotización de ese vecino y MUST persistirse en su documento de Firestore.
- **FR-035a**: La conversión de una cotización de vecino a boleta, factura o nota de venta MUST reutilizar FR-019 (eliminación en duro en la misma transacción).
- **FR-035b**: El dictado y la fotografía MUST respetar el tab activo: Pedido, Vecinos o Lista. MUST NOT cambiar de tab al abrir el micrófono o la cámara, salvo el tab Cotizaciones, que MUST pasar a Pedido. La revisión contrastada se mantiene; nada se escribe sin aprobación (FR-041).
- **FR-035c**: Con el tab Vecinos activo, un dictado sin mención de alias MUST asignarse al pill activo. Si el texto oído menciona un alias existente, MUST asignarse a ese vecino. La resolución del alias MUST ocurrir en el cliente, no en el servicio de asistencia (FR-045).
- **FR-035d**: Cada pill de vecino MUST ofrecer un control de captura de su lista (productos + total) que copia la imagen al portapapeles y, si hay teléfono, abre el chat de WhatsApp de ese número. MUST NOT usarse verde como confirmación; MUST avisarse con toast de éxito. wa.me no adjunta archivos: el vendedor pega la imagen.
- **FR-035e**: Junto a los pills MUST haber un control + que abre el modal de alta de vecino (alias, documento, teléfono). El modal MUST ofrecer «Ver todos» con edición y eliminación de vecinos registrados (cotizaciones pendientes de canal vecino). El teléfono MUST persistirse en la cotización (`telefonoVecino`).
- **FR-035f**: El panel de dictado MUST listar, en un desplegable, los audios del día civil America/Lima del contexto activo (Pedido, Lista, o el pill de vecino activo), cada uno con reproductor y hora de grabación. La UI MUST NOT ofrecer borrar audios; el lifecycle de Storage los caduca (audio 1 día, foto 1 semana).

**Lista de requerimiento**

- **FR-060**: El tab Lista MUST ser la lista de requerimiento del vendedor, no el catálogo. MUST mostrar una tabla con columnas N° | Producto | Cantidad | Urgencia. MUST cargarse al abrir el tab (no al arrancar la app).
- **FR-060a**: Las altas con el tab Lista activo (buscador, dictado aprobado o foto aprobada) MUST agregarse a esa lista. Cantidad por omisión: 1. Urgencia por omisión: Normal, salvo que el texto oído indique urgencia; el control de urgencia MUST ser un texto pulsable que alterna Normal y Urgente.
- **FR-060b**: La lista MUST persistirse en Firestore por día laboral (`listasRequerimiento/{uid}/diasLista/{AAAA-MM-DD}`) para sincronizar entre dispositivos del mismo vendedor, con `caducaEn` a 1 semana. Las escrituras MUST fusionar en transacción. MUST ofrecer Exportar PDF y compartir ese PDF por WhatsApp (documento interno, no un comprobante).
- **FR-060c**: El tab Lista MUST mostrar pills de lunes a sábado (abreviados; fecha corta en teléfono) de la semana actual en America/Lima, abriendo en el día actual. Cada día MUST leerse bajo demanda al pulsar su pill, nunca al arrancar. Las altas nuevas van al día actual y MUST seleccionar ese pill.
- **FR-036**: El sistema MUST distinguir de forma inequívoca, en pantalla y en la impresión, los documentos con valor tributario de los internos.

**Nota de alcance (crédito/cobro)**: la emisión a crédito con fecha de vencimiento, el registro de cobro y la consulta de pendientes de cobro **no forman parte de esta entrega**. El canal de vecinos se documenta como cotización hasta que el vecino paga y se emite el comprobante al contado (u otra condición que el flujo de emisión ya soporte sin módulo de cobranzas).

**Anulación**

- **FR-037**: El sistema MUST permitir anular un comprobante el mismo día de su emisión, exigiendo un motivo y una confirmación explícita que muestre qué documento se va a anular. La anulación MUST realizarse desde el detalle del comprobante. Si hay guía asociada, la cascada bidireccional (toast informativo, mismo motivo/autor) se especifica en `002-guias-remision` FR-013–016.
- **FR-038**: El sistema MUST impedir la anulación de un comprobante emitido en una fecha anterior y MUST indicar que corresponde una nota de crédito.
- **FR-039**: El sistema MUST NOT usar la palabra "eliminar" para referirse a un comprobante emitido, en ninguna parte de la interfaz.
- **FR-037a**: Cualquier vendedor, administrador o jefe autenticado y activo MUST poder anular (dentro de plazo) un comprobante emitido por otro vendedor. La anulación MUST atribuirse a quien confirma, sin borrar la atribución del emisor original.

**Consulta y resumen de comprobantes**

- **FR-057**: La página Comprobantes MUST NOT cargar la lista al montar. MUST ofrecer controles bajo demanda: **Hoy**, rango de fechas `{inicio, fin}`, filtro por cliente y búsqueda por serie y número.
- **FR-057a**: **Hoy** MUST cargar todos los comprobantes del día calendario America/Lima **sin paginación**, MUST mostrar un resumen con el total de ventas del conjunto cargado, y MUST permitir combinar Hoy + cliente. Los comprobantes en estado anulado MUST NOT sumar al total del resumen.
- **FR-057b**: El filtro por rango de fechas MUST desactivar Hoy, MUST paginar por cursores (página de 20, nunca por desplazamiento) y, con cliente seleccionado, MUST exigir que cada resultado cumpla rango **y** cliente (AND).
- **FR-057c**: En esta página, vendedor, administrador y jefe MUST ver el mismo universo de comprobantes de la empresa. El `vendedorId` del emisor es atribución, no filtro de acceso para listar, leer, imprimir, anular (dentro de plazo) ni reutilizar.
- **FR-058**: El sistema MUST admitir búsqueda exacta por serie y número de comprobante, mostrando el resultado con opción de imprimir.
- **FR-059**: Cada comprobante visible en la lista MUST ofrecer Imprimir PDF junto a Reutilizar, con el mismo estilo de control. Imprimir MUST usar la URL PDF persistida en el documento; si falta, MUST consultarla al proveedor vía la frontera, MAY persistir esa URL en el documento y MUST NOT subir el binario a almacenamiento de archivos propio. MUST NOT reemitir.
- **FR-056a**: «Reutilizar pedido» MUST estar disponible también desde la lista de comprobantes y MUST aplicar a comprobantes de cualquier emisor (mismas reglas de confirmación que FR-056).

**Captura asistida**

- **FR-040**: El sistema MUST permitir capturar un pedido dictándolo por voz y otro fotografiando una guía manual.
- **FR-041**: Toda captura asistida MUST producir una propuesta revisable y MUST NOT emitir nada por sí sola.
- **FR-042**: La propuesta MUST mostrar, para cada línea, el contenido original interpretado junto al producto propuesto, de forma visualmente distinguible.
- **FR-043**: Cuando el sistema no pueda decidir entre varios productos, MUST presentar las opciones en lugar de escoger.
- **FR-044**: Las líneas que el sistema no pudo interpretar MUST quedar marcadas como pendientes y MUST NOT descartarse en silencio.
- **FR-045**: El sistema MUST NOT enviar a servicios de asistencia automática razón social, RUC, DNI, dirección, teléfono, correo ni historial de compras de un cliente **salvo la excepción de FR-061** (PDF de requerimiento íntegro, solo esa función). Audio, fotografía, catálogo y colección `clientes` MUST NOT enviarse. La identidad del cliente MUST resolverse dentro del sistema; el modelo no es la fuente de verdad.
- **FR-046**: Cuando el servicio de asistencia no responda o tarde en exceso, el sistema MUST informarlo con claridad y MUST permitir completar la venta escribiendo.

**Comandos**

- **FR-047**: El sistema MUST admitir instrucciones de consulta, escritas o dictadas, resueltas sin abandonar la pantalla de venta.
- **FR-047a**: Cuando el buscador opera en modo comando (texto que empieza por `/`), el sistema MUST NOT mostrar sugerencias de producto. MUST mostrar una **lista seleccionable** de entradas del **catálogo cerrado** en `src/features/comandos/pistas.ts` (`CATALOGO_DE_COMANDOS`: `prefijo` + `parametros`), filtrada por lo tecleado. Al elegir un comando, MUST rellenar el prefijo en el campo y mostrar como pista (texto fantasma / placeholder) los parámetros que aún faltan. Todo comando nuevo —consulta, escritura con confirmación o plantilla `/audio:`— MUST registrarse en ese catálogo; no hay interpretación libre de intenciones para las pistas.
- **FR-047b**: El catálogo de esta entrega incluye al menos: `/crear vecino`, `/usar cotizacion`, `/limpiar pedido`, `/cotizacion`, `/cotizaciones`, `/vecinos`, `/vecino`, `/cliente`, `/ayuda`, y plantillas `/audio:…` de documentación de voz. Las entradas `/guia` y `/crear transportista` pertenecen a la feature `002-guias-remision` y MUST NOT implementarse aquí.
- **FR-048**: El sistema MUST NOT ejecutar mediante instrucción en lenguaje natural ninguna operación que cree, modifique, anule o dé de baja un comprobante. Las escrituras iniciadas por comando en esta entrega (`/crear vecino`, y cuando se implementen `/usar cotizacion` / `/limpiar pedido`) MUST resolverse siempre como propuesta a confirmar —nunca como efecto inmediato. Las plantillas `/audio:…` MUST NOT emitir comprobantes; solo documentan frases canónicas que se resuelven como propuesta editable.
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
- **FR-054a**: Tras una emisión exitosa con valor tributario, el diálogo de éxito MUST ofrecer de inmediato imprimir, guardar/descargar y compartir usando la URL de PDF devuelta por el proveedor en la respuesta de emisión cuando exista; MUST NOT exigir una nueva emisión. Si no hay PDF (p. ej. nota de venta interna), MUST indicarlo con claridad. Esa URL MUST persistirse en el documento del comprobante (enlace, no archivo binario).
- **FR-055**: Un fallo de impresión MUST NOT invalidar ni repetir una emisión ya realizada; el comprobante MUST poder reimprimirse o compartirse.

### Key Entities

- **Producto**: lo que se vende. Código; descripción (material, medida y marca en el texto); `marca` persistida; unidad; precio mayorista de referencia con impuesto incluido; `categoriaId` opcional.
- **Categoría**: agrupación de un solo nivel, creada en la importación, reusable en todo el catálogo y para filtrar dentro de una marca.
- **Cliente**: quien compra. Tipo y número de documento de identidad, denominación, dirección, contacto y condición ante el registro oficial. Incluye el cliente eventual como caso por defecto.
- **Pedido en curso**: la lista que el vendedor está armando. Vive en el dispositivo, no ha producido ningún documento y puede convertirse en cualquiera de ellos.
- **Cotización**: un pedido guardado con número propio, accesible desde cualquier dispositivo, con `canal` `general` o `vecino`. Mientras está pendiente puede editarse o eliminarse; al convertirse en comprobante se elimina en duro.
- **Vecino (canal)**: cotización de `canal` `vecino` identificada por un `aliasVecino` (etiqueta del tab) y un cliente (DNI/RUC). Una cotización viva por vecino; se arma en la entrega y se convierte en comprobante cuando el vecino paga.
- **Comprobante**: el documento resultante. Tipo, serie y número, cliente, líneas con precio, condición de pago, estado ante la autoridad, autor de la emisión y momento.
- **Intento de emisión**: el registro de una emisión solicitada, con su resultado o su indeterminación. Es lo que permite no emitir dos veces la misma venta.
- **Anulación**: la baja de un comprobante, con motivo, autor y momento.
- **Serie**: la numeración asignada a un vendedor para un tipo de documento, con número inicial configurado y correlativo consumido a partir de ese origen.
- **Vendedor**: quien atiende y asume la responsabilidad de lo emitido. Tiene rol, credenciales y series asignadas.
- **Captura asistida**: el contenido original —audio o imagen— y la propuesta derivada de él, con su estado de revisión.

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
- **SC-010**: El 100% de las entregas al canal de vecinos quedan documentadas el mismo día como cotización de vecino; el comprobante se emite cuando el vecino paga. (Línea base: hoy se documentan solo al pagar, sin rastro formal en la entrega.)
- **SC-011**: El 100% de las emisiones, anulaciones e intentos fallidos son atribuibles a un vendedor identificado y a un momento concreto.
- **SC-012**: En dictado y fotografía, ningún dato identificatorio de clientes aparece en el tráfico hacia servicios de asistencia automática, verificable por inspección. En FR-061 el PDF viaja como medio; el payload de esa función MUST NOT incluir catálogo ni ficha de `clientes`.
- **SC-013**: Señal cualitativa, declarada como tal: los 5 vendedores manifiestan preferir SuitPay al sistema anterior tras dos semanas de uso. Es el criterio de aceptación del dueño y no sustituye a las métricas anteriores.
- **SC-014**: En Comprobantes, un vendedor obtiene el resumen del día (Hoy) con el total de ventas de la empresa en menos de 10 segundos en una jornada ordinaria, sin paginar.
- **SC-015**: El 100% de las operaciones de listar, leer, imprimir, anular (mismo día) y reutilizar sobre comprobantes de otro emisor están permitidas a cualquier vendedor activo (trabajo colaborativo).

## Assumptions

- **Las líneas base de SC-001, SC-002, SC-003, SC-005 y SC-009 se miden en el sistema anterior antes de la puesta en marcha.** Sin ellas esos criterios no son verificables. Es una condición del veredicto `go` y una exigencia del principio VI de la constitución.
- **La emisión de comprobantes se delega en un proveedor externo** que firma y dialoga con la autoridad tributaria. SuitPay no asume la firma ni el certificado digital.
- **El proveedor de emisión ofrece un entorno de demostración** y toda integración se ejercita allí antes de tocar el entorno real.
- **El proveedor permite determinar si una emisión concreta ocurrió. Confirmado el 2026-07-28.** Su endpoint de consulta acepta exactamente serie y número y devuelve existencia, estado y traza de eventos, que es la primitiva de la que dependen FR-028 y FR-029. Era la asunción más cara de la especificación y ya no lo es. Queda por comprobar en el entorno de demostración que el proveedor respete un número explícito, lo que evitaría el sondeo de reconciliación; y, más importante, **qué forma tienen sus respuestas de error**, porque el ejemplo documentado no lleva código y de esa distinción depende no reintentar a ciegas. Ver `research.md`, decisiones 4 y 4b.
- **Una caída de la autoridad tributaria no impide emitir.** El proveedor firma en sus propios servidores y mantiene su propia cola hacia la autoridad. El fallo de FR-050 (mensaje + reintento manual) solo aplica cuando el proveedor mismo o la red están inalcanzables, no cuando lo está la autoridad (decisión 10).
- **Cada vendedor opera con series propias**, creadas de antemano para cada tipo de documento que vaya a emitir, cada una con un **número inicial** configurado (alineado con el panel del proveedor).
- **La dirección visual es Modern Soft-Pill** (`DESIGN.md` enmendado 2026-07-29): cápsulas, radios amplios, lienzo gris/blanco; no papel cálido ni radio cero.
- **Los precios del catálogo incluyen el impuesto** y el desglose lo realiza el proveedor de emisión.
- **El catálogo puede ir de cientos a ~3000 productos** (lista PDF del proveedor) con nombres estructurados por material, medida y marca; sigue cabiendo en un solo documento `catalogo/actual` bajo 1 MiB (decisión 2 / 13). La búsqueda tolerante y el emparejamiento de capturas siguen aplicando.
- **La empresa dispone de conexión estable** y, ante caída del router, los vendedores pueden usar la red de sus teléfonos.
- **El alcance de esta entrega no incluye** contabilidad, cobranzas como módulo (incluido registro de cobro / ventas a crédito como UX), sugerencias de compra, notas de crédito como flujo completo, migración masiva de clientes, aplicación nativa, impresión desde el móvil, login por alias/usuario (se mantiene correo + contraseña), ni la implementación completa de todos los parsers de consulta del catálogo (las pistas y la lista seleccionable sí). **La guía de remisión electrónica** se especifica en `002-guias-remision`. **Inventario y alertas de stock** en `003-inventario-almacen`. **Ranking / estadísticas de productos** en `004-ranking-productos`. Las únicas escrituras por comando implementadas aquí siguen el principio I (propuesta a confirmar). Ver `concept.md`.
- **La nota de venta es documento interno** (confirmado 2026-08-18): se aloja solo en SuitPay, no se crea en el proveedor ni consume serie regulada, y se distingue en pantalla e impresión (FR-036). **Sí mueve stock**, igual que boleta/factura sin guía; el descuento y el reintegro viven en `003-inventario-almacen`. **No se asocia a guía de remisión** (la guía es documento regulado de traslado sobre boleta/factura; ver `002`).
- **El inventario se especifica e implementa en `003-inventario-almacen`** (contadores orientativos; no es sistema de registro). Las cantidades no viven en `catalogo/actual`.
- **Las categorías se crean y asignan en la administración del catálogo y en la importación** (FR-009d). No hay jerarquía familia/grupo.
- **La captura por voz y fotografía reutiliza herramientas ya existentes** en el proyecto de la tienda virtual de la empresa. Están funcionando pero acopladas a ese proyecto, y el grado de reelaboración necesario está sin evaluar. Si resultara profundo, las historias 6 y 7 deberían replantearse.
- **El pedido en curso no viaja entre dispositivos.** Cambiar de dispositivo obliga a rehacerlo, y el negocio lo acepta.
- **La impresión en formato de rollo**: el proveedor documenta `formato_pdf: ticket` además de `a4`. Esta entrega sigue cubriendo A4 y archivo compartible; la validación de maquetación/ancho del ticket queda por probar en demo.
- **El almacenero no usará el sistema.** Otra persona fotografía sus guías, por decisión explícita del negocio.
- **El umbral de 700 soles de FR-021 es un valor de origen regulatorio**, no una preferencia del negocio. Puede cambiar por norma sin que cambie nada en SuitPay, así que no debe quedar enterrado como una constante intocable: modificarlo tiene que ser barato.
- **Anular solo el mismo día es la regla de operación de la empresa**, y es más estricta que el máximo que la norma admite. Se adopta deliberadamente por prudencia: reduce la ventana en la que un comprobante puede desaparecer y empuja los errores tardíos hacia la nota de crédito, que deja mejor rastro.
- **FR-050a (documento interno de contingencia) está retirado** en esta entrega (decisión 10). No hay papel sustituto automático mientras el proveedor no responde.

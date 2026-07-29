# Idea Research: SuitPay — Sistema de facturación multiplataforma con asistencia de IA

- **Slug**: sistema-facturacion
- **Created**: 2026-07-28
- **Updated**: 2026-07-29 (ronda volcado 5)
- **Evidence confidence (overall)**: medium
- **Foco de la ronda inicial**: la documentación pública de Factpro, el proveedor de emisión elegido como primera opción, para cerrar las incógnitas técnicas que bloqueaban el diseño (correlativo, idempotencia, GRE, anulación, IGV). La evidencia sobre usuarios y demanda sigue siendo débil y se señala como tal.
- **Foco de la ronda 2026-07-29**: número inicial al configurar series; estructuras de factura / NC / ND / GRE aportadas por el autor; implicaciones para el contador de SuitPay. No cierra la prueba en sandbox (T027).

## Users & Demand

- El encargo proviene del dueño de la empresa, que además está dispuesto a reemplazar el sistema actual si el nuevo resulta efectivo — [source: intake.md, volcado 1] (confidence: high)
- Los usuarios directos son 5 vendedores en 5 puestos concurrentes, más un administrador/contador y un jefe — [source: intake.md, volcado 3] (confidence: high)
- Las quejas fueron recopiladas por el desarrollador a partir de observación y conversación, no mediante entrevistas estructuradas ni instrumentación del sistema actual — [source: intake.md, volcado 1] (confidence: medium)
- Existe una queja concreta y verificable: el buscador de productos del sistema actual no encuentra el producto si los términos no van en el orden exacto — [source: intake.md, volcado 1] (confidence: high)
- Existe una fricción organizativa observada: nadie puede operar hasta que llega la encargada, mientras personal y clientes esperan en la puerta — [source: intake.md, volcado 1] (confidence: high)
- No hay datos cuantitativos del volumen de operación: documentos emitidos por día, tiempo promedio para generar un comprobante, cantidad de errores o anulaciones mensuales — [ASSUMPTION: no se recopilaron] (confidence: low)
- El criterio de éxito declarado es que los vendedores digan que el sistema es efectivo, sin una medición previa contra la cual comparar — [source: intake.md, volcado 2] (confidence: high)

## Prior Art

- **Interno, el más relevante**: la misma empresa ya tiene construidas y funcionando las herramientas de captura de pedidos por audio y por foto, dentro del proyecto de su tienda virtual (React + Vite + TypeScript + Firebase). El enfoque de IA propuesto no es especulativo: ya opera en la casa — [source: intake.md, volcados 3 y 4] (confidence: high)
- **Interno**: el sistema actual de escritorio sobre VM es la línea base de lo que falla — dispersión de documentos, anclaje a máquinas, búsqueda rígida — [source: intake.md, volcado 1] (confidence: high)
- **Del proveedor**: Factpro ya ofrece su propio panel web con emisión de comprobantes, carga masiva por plantilla Excel, PDF con logo y color, y consulta de estados. Parte de lo que SuitPay quiere construir ya existe en la herramienta que va a consumir — [source: https://docs.factpro.la/importar-masivo-por-excel] (confidence: high)
- **Del proveedor**: Factpro documenta una integración con Shopify, evidencia de que su API ya se consume desde sistemas de venta de terceros — [source: https://docs.factpro.la/llms.txt] (confidence: medium)
- **De producto**: el patrón de revisión en rojo/verde y los comandos con `/` provienen de los IDE con IA, y el propio autor cita Cursor como referencia explícita — [source: intake.md, volcado 1] (confidence: high)

## Market & Context

- La alternativa que la empresa usa hoy es el sistema heredado sobre VM, y el coste de no hacer nada es la fricción diaria ya descrita: apertura demorada, clientes sin atender, navegación entre pantallas y búsquedas fallidas — [source: intake.md, volcado 1] (confidence: high)
- Factpro cubre por API los cinco documentos que el negocio necesita: factura, boleta, nota de crédito, nota de débito y comunicación de baja, más guía de remisión remitente en un endpoint aparte — [source: https://docs.factpro.la/api-facturacion-v3] (confidence: high)
- Factpro también expone consulta de RUC y DNI, consulta de tipo de cambio y una API SIRE para compras, que sería relevante si más adelante se incorpora la contabilidad hoy fuera de alcance — [source: https://docs.factpro.la/llms.txt] (confidence: high)
- Existen otros proveedores de facturación electrónica y sistemas comerciales de venta en el mercado peruano, pero no se investigaron en esta ronda; la comparación de "construir contra comprar" queda sin evidencia — [ASSUMPTION] (confidence: low)

## Data & Constraints

Todo lo de esta sección proviene de la documentación pública de Factpro y tiene confianza alta salvo donde se indique.

### Numeración y correlativo

- Los ejemplos de creación de documentos envían `"numero": "#"`, y la respuesta devuelve el número ya asignado (`"numero": "F100-82"` / `"number": "F001-5"`). Con el comodín, **Factpro asigna el correlativo** — [source: https://docs.factpro.la/api-facturacion-v3/estructura-para-generar-facturas] (confidence: high)
- La documentación de carga masiva lo confirma de forma explícita: "El sistema Factpro asigna el correlativo de forma completamente automática" — [source: https://docs.factpro.la/importar-masivo-por-excel]
- Las series se registran previamente en Factpro y admiten máximo 4 caracteres, con prefijo obligatorio según el tipo: `F` factura, `B` boleta, `FC`/`BC` nota de crédito, `FD`/`BD` nota de débito, `T` guía de remisión remitente — [source: https://docs.factpro.la/api-facturacion-v3/como-empezar/4-series]
- **Número inicial de la serie (volcado 5)**: al configurar series, el panel pide también **desde qué número empezar** a generar documentos (ej. empezar en 0 → `F001-0`; empezar en 100 → `F002-100`). No es solo el código de serie: hay un origen numérico configurable — [source: intake.md, volcado 5; observación del autor en el panel del proveedor] (confidence: high sobre la afirmación del autor; medium sobre el detalle exacto del campo en la API, no verificado en esta ronda)
- **Implicación para SuitPay**: el contador propio por serie (`ultimoNumero` o equivalente) **debe inicializarse alineado a ese número de arranque** al dar de alta la serie (p. ej. `ultimoNumero = numeroInicial - 1` si el siguiente reclamado es `numeroInicial`), no asumir siempre el cero. El equipo SuitPay sigue siendo el árbitro que envía el número concreto; el origen lo fija la configuración compartida con el proveedor — [ASSUMPTION de diseño derivada del volcado 5] (confidence: medium)
- **Implicación no documentada por el proveedor**: si cada uno de los 5 vendedores tiene serie propia, hacen falta series paralelas por cada tipo de documento (facturas, boletas y notas de crédito como mínimo), todas creadas de antemano en el panel de Factpro — [ASSUMPTION derivada de las dos fuentes anteriores] (confidence: medium)
- **T027 sigue abierta**: que el campo `numero` acepte un valor explícito (no solo `#`) y qué responde ante un número ya usado **no está cerrado** por el volcado 5; se resuelve en el entorno de demostración — [source: specs/001-mostrador-asistido/tasks.md T027] (confidence: high)

### Idempotencia

- La consulta de documentos se hace por `serie` + `numero`, y no hay ningún campo de referencia externa ni de clave de idempotencia en el cuerpo de creación — [source: https://docs.factpro.la/api-facturacion-v3/consultar-documentos]
- **Consecuencia directa**: si enviamos `numero: "#"` y la llamada se corta sin respuesta, no conocemos el número asignado y por tanto no podemos consultar si el documento se emitió. No existe forma documentada de reconciliar ese estado — (confidence: high)
- Los ejemplos nunca muestran el envío de un número explícito, y la documentación no indica si la API lo acepta. **Es la pregunta más importante a resolver con el soporte de Factpro**, porque de ella depende que exista un mecanismo de reconciliación — [NEEDS CLARIFICATION] (confidence: high sobre el vacío documental)

### Estados del documento

- Los estados son: `01` registrado en servidor Factpro, `03` enviado sin respuesta de SUNAT, `05` aceptado, `09` rechazado, `11` anulado, `13` por anular, `19` sin respuesta de SUNAT — [source: https://docs.factpro.la/estados-de-documentos]
- El estado `01` admite editar el comprobante, lo que abre una ventana de corrección antes de que llegue a SUNAT — [source: https://docs.factpro.la/estados-de-documentos]

### Contingencia

- Factpro firma el XML en sus propios servidores, sin depender de SUNAT para ello, y mantiene una cola de reintentos automáticos cada 5 minutos cuando SUNAT no responde. Declara continuidad de negocio: el vendedor puede seguir generando ventas y entregando el comprobante al cliente, y el CDR llega cuando SUNAT se recupera — [source: https://docs.factpro.la/api-facturacion-v3/introduccion/plan-de-contingencia-y-resiliencia-ante-caidas-de-sunat]
- **Esto resuelve la caída de SUNAT, no la de Factpro**: si su API o el internet de la empresa fallan, la cola de pendientes propia de SuitPay sigue siendo necesaria — (confidence: high)
- Factpro ofrece redundancia vía OSE como opción comercial premium para entornos que no pueden esperar — [source: misma página] (confidence: high)

### Plazos

- Las boletas de venta se envían mediante resúmenes masivos con un plazo máximo de 7 días calendario; fuera de plazo el documento recibe observación tributaria y el envío queda bajo responsabilidad del contribuyente — [source: https://docs.factpro.la/faq/plazos-de-envio-de-facturas-a-la-sunat]
- Si una boleta incluida en un resumen tiene errores, el procedimiento es excluirla del lote y regenerar el resumen — [source: misma página]

### Anulación

- Se anula con `serie`, `numero` y `motivo` de texto libre; el ejemplo usa "ERROR DEL SISTEMA", compatible con el "ERROR DE IMPRESIÓN" que usa la empresa. La respuesta devuelve un ticket y genera un documento `RA-` — [source: https://docs.factpro.la/api-facturacion-v3/anular-documento]
- Se pueden anular facturas, boletas y notas de crédito. **Las guías de remisión no se pueden anular desde un sistema externo**: solo desde SUNAT con clave SOL, por sus normas de validación — [source: https://docs.factpro.la/faq/los-documentos-que-se-pueden-anular-son-facturas-boletas-notas-de-credito]

### IGV y precios

- El ítem admite `"incluye_tax": true` junto a `precio`, de modo que la API acepta precios con impuesto incluido y realiza el desglose — [source: https://docs.factpro.la/api-facturacion-v3/estructura-para-generar-facturas/factura-simple]
- **Esto desactiva casi por completo la preocupación de redondeo** que quedó pendiente de consulta con el contador: el catálogo puede seguir manejando precios con IGV incluido sin que SuitPay tenga que calcular la base imponible — (confidence: high)

### Ventas al crédito

- Existe una estructura documentada de factura al crédito: `condicion_de_pago` con `tipo_de_condicion: "1"`, y una entrada por cuota con `fecha` de vencimiento y `monto`, ambos obligatorios para Perú — [source: https://docs.factpro.la/api-facturacion-v3/estructura-para-generar-facturas/factura-al-credito]
- **Encaja exactamente con el canal de los vecinos**: permite emitir la factura en el momento de la entrega y declarar la fecha en que se espera el pago, en lugar de retrasar la emisión hasta el cobro — (confidence: high)

### Guía de remisión

- El endpoint de guías exige bastante más de lo previsto: `fecha_de_traslado`, `codigo_modo_transporte`, `motivo_traslado`, `peso_bruto_unidad`, `peso_bruto_total`, `numero_de_bultos`, datos del transportista (documento, denominación, registro MTC), datos del conductor (documento, nombres, licencia, placa), y `direccion_partida` y `direccion_llegada` cada una con ubigeo y dirección — [source: https://docs.factpro.la/api-facturacion-v3/estructura-para-generar-guias-remitente/guia-remision-remitente]
- **El comando `/guia` diseñado por el autor recoge 4 datos y el endpoint necesita del orden de 15.** Peso bruto, número de bultos, motivo y modo de traslado, ubigeos de partida y llegada, y los datos del conductor no están contemplados — (confidence: high)
- La consulta de RUC de Factpro devuelve `ubigeo`, `direccion` y `direccion_completa`, lo que cubre parte de los datos de dirección de llegada a partir del RUC del cliente — [source: https://docs.factpro.la/api-consulta-ruc-y-dni/busqueda-por-numero-de-ruc]

### Formato de impresión

- Los cuerpos de creación aceptan `"formato_pdf": "a4"`, prueba de que el formato del PDF es un parámetro de la petición — [source: factura-simple, factura-al-credito, guia-remision-remitente]
- Los valores admitidos distintos de `a4` no aparecen en las páginas revisadas, así que **no está confirmado que exista un formato de ticket o rollo**, que es justamente el destino deseado por el hijo del dueño — [NEEDS CLARIFICATION] (confidence: high sobre el vacío documental)

### Consulta de contribuyentes

- La consulta por RUC devuelve razón social, estado, condición (habido/no habido), dirección desglosada y ubigeo. Existen además consulta de anexos por RUC y consulta de DNI — [source: https://docs.factpro.la/api-consulta-ruc-y-dni/busqueda-por-numero-de-ruc y https://docs.factpro.la/llms.txt]
- El campo `condicion` (habido / no habido) es información con valor de negocio que el flujo actual de alta de cliente no contempla — (confidence: high)

## Ronda 2026-07-29 — Estructuras de emisión (excerpt de sesión)

Material aportado por el autor desde la documentación pública del proveedor (host: docs.factpro.la, policy: confirmed-by-user / excerpt de sesión). No se re-fetchó en esta ronda; se cita lo aportado.

### Factura / boleta — `POST …/api/v3/documentos`

- Campos obligatorios relevantes: `serie` (4 exacto; prefijo F/B), `numero`, `tipo_operacion` (default práctico `"1"` venta interna), cliente (`cliente_tipo_documento`, `cliente_numero_documento`, `cliente_denominacion`; dirección condicional), `items` (`unidad`, `descripcion`, `cantidad`, `precio`, `tipo_tax`), `formato_pdf` (`a4` o `ticket` — el excerpt de volcado 5 confirma `ticket` como valor admitido, lo que **cierra parcialmente** la duda de rollo de la ronda anterior) — [source: https://docs.factpro.la/api-facturacion-v3/estructura-para-generar-facturas]
- Ejemplo de cuerpo usa `"numero": "#"`; respuesta 200 incluye `data.number`, `external_id`, `links` (xml/pdf/cdr) y `response.code` — [mismo source]
- `incluye_tax` opcional: si el precio ya incluye impuesto, `true` o omitir — [mismo source]

### Nota de crédito — mismo endpoint de documentos

- Campos adicionales: `tipo_nota`, `motivo_nota`, `documento_afectado` (`tipo_documento`, `serie`, `numero`) — [source: https://docs.factpro.la/api-facturacion-v3/estructura-para-generar-nota-de-credito]
- Ítems: el texto de atributos menciona `precio_unitario`; el ejemplo JSON usa `precio` — posible inconsistencia documental a verificar en demo — [mismo source] (confidence: medium)

### Nota de débito — mismo endpoint

- `tipo_nota` en catálogo de débito (14–18 en el excerpt); misma forma de `documento_afectado` e ítems — [source: https://docs.factpro.la/api-facturacion-v3/estructura-para-generar-nota-de-debito]

### Guía de remisión remitente — `POST …/api/v3/guias`

- `tipo_documento` = 11 (GRE Remitente); serie con prefijo `T`; exige traslado (`fecha_de_traslado`, modo, motivo, peso, bultos), destinatario, partida/llegada con ubigeo, y transportista o conductor según modo 01/02 — [source: https://docs.factpro.la/api-facturacion-v3/estructura-para-generar-guias-remitente]
- Confirma el hallazgo previo: muchos más campos que el comando `/guia` de cuatro placeholders del intake.

### Infra operativa citada (sin secretos)

- Proyecto Firebase declarado: `blayblocklabs-antrax` — [source: intake.md, volcado 5]
- Site Hosting: `suitpay` — [source: intake.md, volcado 5]
- Credencial de API del proveedor: disponible para demo; **no almacenada en este artefacto** — [source: intake.md, volcado 5]

## Evidence Against the Idea

Ninguna de estas invalida el proyecto, pero son las razones más fuertes para dudar y deben pesarse antes de decidir.

- **El problema no está medido.** No hay entrevistas estructuradas con los 5 vendedores, ni tiempos, ni volumen de documentos, ni tasa de errores del sistema actual. El criterio de éxito —"que los vendedores digan que es efectivo"— es subjetivo y, sin línea base, no habrá forma de demostrar la mejora ni de detectar un retroceso — [source: intake.md] (confidence: high)
- **Parte del dolor narrado no es de software.** Que nadie pueda operar hasta que llegue la encargada es un problema de concentración de credenciales y de proceso de apertura. Crear más usuarios y repartir permisos en el sistema actual podría eliminar esa fricción sin reescribir nada — (confidence: high)
- **Factpro ya cubre por sí solo el caso simple.** Su panel web emite comprobantes, carga documentos masivamente por Excel y genera PDF personalizados. Para una operación de 5 vendedores, buena parte del valor está disponible sin construir un sistema propio — [source: https://docs.factpro.la/importar-masivo-por-excel] (confidence: medium)
- **La queja verificada más concreta no necesita IA.** Que el buscador no encuentre productos si el orden no es exacto se resuelve con búsqueda difusa local, que no depende del modelo, no cuesta por uso y no añade latencia. La IA es la parte más ambiciosa del proyecto y también la que menos evidencia de necesidad tiene — (confidence: medium)
- **Riesgo de duplicar dos sistemas de la misma empresa.** Las herramientas de audio y foto ya existen en la tienda virtual. Si SuitPay las reimplementa y además declara ser la fuente de verdad del catálogo mientras la tienda sigue operando, la empresa acaba manteniendo dos verdades — [source: intake.md, volcado 4] (confidence: high)
- **El alcance crece rápido.** A la facturación ya se le sumaron cotizaciones, inventario con alertas configurables, panel de administración, migración de datos, dos formatos de impresión y una integración con la tienda virtual. Cada pieza es razonable; el conjunto es grande para una primera versión — (confidence: high)
- **Reemplazar facturación en producción tiene riesgo asimétrico.** Un fallo no produce una mala experiencia, produce comprobantes rechazados, observaciones tributarias y ventas que no se pueden documentar. El sistema heredado, con todos sus defectos, funciona — (confidence: high)
- **La aprobación humana obligatoria limita el ahorro de tiempo.** Si el vendedor debe revisar y aprobar todo lo que la IA precarga, el techo de mejora es el tiempo de lectura y verificación, no cero. Conviene no prometer más que eso — (confidence: medium)

## Gaps & Open Questions

- ~~[NEEDS CLARIFICATION: ¿acepta la API un `numero` explícito?]~~ **Cerrado T027 (2026-07-29)**: sí respeta el número; duplicado → `"El documento ya está registrado."`; errores vía HTTP 404 + `errors[].message` sin código. Ver `specs/001-mostrador-asistido/research.md` § T027.
- ~~[NEEDS CLARIFICATION: ¿existe un valor de `formato_pdf` para ticket o rollo?]~~ **Parcialmente cerrado (volcado 5)**: la página de facturas documenta `a4` o `ticket`. Queda el ancho físico de la impresora de rollo y la calidad de maquetación.
- [NEEDS CLARIFICATION: ¿cómo se envían los resúmenes de boletas — los agrupa Factpro automáticamente o SuitPay debe disparar el resumen diario? La página de plazos describe la obligación pero no quién ejecuta el envío.]
- [NEEDS CLARIFICATION: límites de uso de la API de Factpro — solicitudes por minuto, concurrencia y tiempos de respuesta típicos. Con 5 puestos emitiendo a la vez importa.]
- [NEEDS CLARIFICATION: la respuesta de ejemplo del endpoint de guías a veces muestra números de factura en lugar de serie `T`; conviene verificar la forma real de la respuesta antes de diseñar contra ella.]
- [NEEDS CLARIFICATION: no se investigaron proveedores alternativos ni sistemas comerciales del mercado peruano, así que la comparación entre construir y comprar sigue sin evidencia.]
- [NEEDS CLARIFICATION: no existe evidencia directa de los usuarios finales. Cinco conversaciones cortas con los vendedores y un conteo de documentos por día cambiarían la calidad de todo este assessment.]
- [NEEDS CLARIFICATION: qué umbral de importe obliga a identificar al comprador en una boleta, y si la validación debe vivir en SuitPay o la rechaza Factpro. Ninguna de las páginas revisadas lo menciona.]
- [NEEDS CLARIFICATION: en ítems de NC/ND, ¿el campo de precio es `precio` o `precio_unitario`? El excerpt de atributos y el ejemplo JSON no coinciden.]

## Sources

Todas las fuentes web pertenecen al mismo host, cuya consulta fue solicitada explícitamente por el usuario.

- https://docs.factpro.la/ (host: docs.factpro.la, policy: confirmed-by-user)
- https://docs.factpro.la/llms.txt (host: docs.factpro.la, policy: confirmed-by-user)
- https://docs.factpro.la/api-facturacion-v3/como-empezar/4-series (host: docs.factpro.la, policy: confirmed-by-user)
- https://docs.factpro.la/api-facturacion-v3/estructura-para-generar-facturas (host: docs.factpro.la, policy: confirmed-by-user / excerpt sesión 2026-07-29)
- https://docs.factpro.la/api-facturacion-v3/estructura-para-generar-facturas/factura-simple (host: docs.factpro.la, policy: confirmed-by-user)
- https://docs.factpro.la/api-facturacion-v3/estructura-para-generar-facturas/factura-al-credito (host: docs.factpro.la, policy: confirmed-by-user)
- https://docs.factpro.la/api-facturacion-v3/estructura-para-generar-nota-de-credito (host: docs.factpro.la, policy: confirmed-by-user / excerpt sesión 2026-07-29)
- https://docs.factpro.la/api-facturacion-v3/estructura-para-generar-nota-de-debito (host: docs.factpro.la, policy: confirmed-by-user / excerpt sesión 2026-07-29)
- https://docs.factpro.la/api-facturacion-v3/estructura-para-generar-guias-remitente (host: docs.factpro.la, policy: confirmed-by-user / excerpt sesión 2026-07-29)
- https://docs.factpro.la/api-facturacion-v3/estructura-para-generar-guias-remitente/guia-remision-remitente (host: docs.factpro.la, policy: confirmed-by-user)
- https://docs.factpro.la/api-facturacion-v3/consultar-documentos (host: docs.factpro.la, policy: confirmed-by-user)
- https://docs.factpro.la/api-facturacion-v3/anular-documento (host: docs.factpro.la, policy: confirmed-by-user)
- https://docs.factpro.la/api-facturacion-v3/introduccion/plan-de-contingencia-y-resiliencia-ante-caidas-de-sunat (host: docs.factpro.la, policy: confirmed-by-user)
- https://docs.factpro.la/estados-de-documentos (host: docs.factpro.la, policy: confirmed-by-user)
- https://docs.factpro.la/faq/plazos-de-envio-de-facturas-a-la-sunat (host: docs.factpro.la, policy: confirmed-by-user)
- https://docs.factpro.la/faq/los-documentos-que-se-pueden-anular-son-facturas-boletas-notas-de-credito (host: docs.factpro.la, policy: confirmed-by-user)
- https://docs.factpro.la/api-consulta-ruc-y-dni/busqueda-por-numero-de-ruc (host: docs.factpro.la, policy: confirmed-by-user)
- https://docs.factpro.la/importar-masivo-por-excel (host: docs.factpro.la, policy: confirmed-by-user)
- `.specify/assessments/sistema-facturacion/intake.md` (artefacto interno, volcados 1 a 5)

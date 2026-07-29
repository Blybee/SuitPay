# Guía de validación — Mostrador asistido

**Feature**: 001-mostrador-asistido | **Fecha**: 2026-07-28

Cómo comprobar que la entrega funciona de verdad. No es documentación de instalación ni contiene implementación: son los escenarios que hay que poder ejecutar y lo que debe observarse en cada uno.

## Prerrequisitos

**Cuentas y proyectos**
- Un proyecto de Firebase nuevo e independiente del de la tienda virtual, con Firestore en edición Standard, Authentication, Cloud Storage y App Hosting habilitados. App Hosting exige el plan de facturación Blaze.
- Una cuenta en el entorno de **demostración** del proveedor de emisión, con al menos una serie de facturas y una de boletas creadas. La constitución prohíbe estrenar la integración en producción.
- Credenciales del servicio de asistencia multimodal. Dos, para poder ejercitar la conmutación.

**Datos mínimos**
- Un catálogo de prueba con al menos 30 productos cuyos nombres incluyan material, medida y marca, imitando la estructura real. Deben existir varios productos que compartan palabras para poder probar la ambigüedad.
- Tres usuarios: un vendedor, un administrador y un jefe.
- Una serie de facturas y una de boletas asignadas al vendedor.
- Al menos una guía manual fotografiada de verdad, escrita a mano. Una imagen sintética no sirve para juzgar la calidad del reconocimiento.

**Entorno local**
- Firebase Emulator Suite para Firestore, Authentication, Functions y Storage. Las pruebas de reglas y de emisión corren aquí.

## Escenarios de validación

### V1 — Venta escrita de principio a fin (US1)

Iniciar sesión como vendedor, cerrar el navegador, volver a abrirlo. **Debe entrar sin pedir credenciales.** Escribir "1/2 codo fierro" y comprobar que aparece el codo de fierro galvanizado de media pulgada, aunque el catálogo lo nombre en otro orden. Añadir tres productos, cambiar el precio de uno, alternar el tipo de documento entre boleta y factura y confirmar que el pedido no se pierde. Emitir.

**Observar**: el comprobante existe en el proveedor de demostración con la serie y el número que muestra la aplicación; el documento en la base de datos está atribuido al vendedor; el archivo imprimible se abre.

### V2 — La doble pulsación no duplica (principio II)

Con un pedido listo, pulsar confirmar dos veces lo más rápido posible. Repetirlo con el ratón y con el teclado.

**Observar**: **existe un único comprobante** y un único número consumido en la serie. La segunda respuesta indica que ya existía en lugar de presentarse como una emisión nueva.

### V3 — La respuesta que no llega (principio II, el caso peligroso)

En el emulador, forzar que la llamada al proveedor agote su tiempo de espera **después** de que el proveedor haya creado el documento. Es el escenario que produce duplicados en los sistemas que reintentan a ciegas, y por eso es la prueba más importante de toda la entrega.

**Observar**: la venta queda en estado indeterminado; la interfaz **no ofrece reintentar la emisión**; al ejecutar la reconciliación, el estado real se adopta y no nace un segundo comprobante. Repetir la variante en que el proveedor **no** creó el documento: la reconciliación debe permitir volver a emitir con seguridad.

### V4 — Dos dispositivos, una cotización (FR-019)

Guardar una cotización. Abrirla simultáneamente en el escritorio y en un teléfono. Convertirla a comprobante desde ambos, casi a la vez.

**Observar**: solo uno emite. El otro recibe el aviso de que ya fue convertida e indica en qué comprobante terminó. Es el caso que la clave de idempotencia por sí sola no cubre, porque cada dispositivo genera una clave distinta.

### V5 — El proveedor no responde (FR-050, principio V)

Simular la indisponibilidad del proveedor y completar una venta.

**Observar**: la venta queda pendiente; se ofrece el documento interno claramente marcado como sin valor tributario y pendiente de comprobante; se recogen los datos de contacto del cliente. Al restablecer el proveedor y ejecutar el proceso de pendientes, el comprobante se emite y la venta deja de estar en espera. Probar también el rechazo al recuperarse: la venta debe quedar señalada como necesitada de intervención, **no cerrada en silencio**.

### V6 — Trabajar sin red (principio V, FR-015)

Con un pedido a medio armar, desactivar la red. Seguir buscando productos y añadiendo líneas. Refrescar la página. Reactivar la red.

**Observar**: la búsqueda **sigue funcionando** porque el catálogo está en caché; el pedido sobrevive al refresco; la interfaz muestra de forma visible que está degradada; al volver la red se puede emitir.

### V7 — La asistencia caída no impide vender (FR-046)

Desactivar las credenciales del servicio de asistencia e intentar dictar un pedido.

**Observar**: se informa con claridad y el vendedor completa la venta escribiendo. Probar además la conmutación: agotar la primera credencial y verificar que se usa la segunda sin que el vendedor lo note.

### V8 — Ningún dato de cliente sale hacia el modelo (principio IV, SC-012)

Registrar el tráfico saliente de la función de interpretación. Dictar "hazme una factura para Ferretería El Progreso con veinte codos de media".

**Observar**: el payload contiene el audio y el lote de productos candidatos, y **ningún campo almacenado del cliente**: ni RUC, ni dirección, ni teléfono, ni historial. La identificación de "Ferretería El Progreso" se resuelve dentro del sistema, contra el índice local. Es la verificación por inspección que exige SC-012.

### V9 — Revisión contrastada de una guía manual (US7)

Fotografiar una guía manuscrita real con al menos seis renglones, incluyendo uno tachado o ilegible a propósito.

**Observar**: cada renglón muestra el texto leído junto al producto propuesto, distinguibles a simple vista; los renglones ambiguos ofrecen opciones en lugar de elegir solos; **el renglón ilegible aparece marcado como pendiente y no desaparece**. Nada se ha emitido hasta que alguien aprueba.

### V10 — Anulación y su ventana (US4, FR-037, FR-038)

Anular un comprobante emitido hoy, indicando el motivo. Después, intentar anular uno con fecha anterior.

**Observar**: el primero se anula, con motivo, autor y momento registrados en el propio documento, que **sigue existiendo**. El segundo se rechaza indicando que corresponde una nota de crédito. Recorrer la interfaz buscando la palabra "eliminar" referida a un comprobante: **no debe aparecer en ningún sitio** (FR-039).

### V11 — Umbral de identificación del comprador (FR-021)

Armar una boleta que supere los 700 soles con cliente eventual e intentar emitirla.

**Observar**: se exige identificar al comprador antes de continuar. Bajar el importe por debajo del umbral y comprobar que vuelve a permitirse el cliente eventual. Cambiar el umbral en los parámetros de configuración y verificar que el comportamiento cambia **sin desplegar código**.

### V12 — Alta de cliente en contexto (US3)

Con una venta en curso, escribir un RUC no registrado.

**Observar**: se ofrece agregarlo ahí mismo; los datos traídos se presentan para revisión y solo se guardan tras confirmar; **el pedido sigue intacto** al terminar. Probar con un contribuyente no habido: la advertencia debe ser visible y la decisión quedar en manos del vendedor. Probar con el servicio de consulta caído: debe poder escribirse a mano.

### V13 — Carga del catálogo (US2)

Como administrador, cargar el catálogo en modo validación y luego publicarlo. Cargar después una versión con un precio cambiado, un producto nuevo, uno desaparecido y dos códigos repetidos.

**Observar**: el resumen previo muestra las diferencias antes de aplicar nada; los códigos duplicados se señalan **sin resolverse automáticamente**; tras publicar, los vendedores ven el catálogo nuevo al refrescar. Contar las escrituras de la publicación: **debe ser una sola**, no una por producto.

### V14 — Los comandos no escriben (FR-048, principio I)

Pedir por comando los últimos comprobantes de un cliente. Después intentar, escrito y dictado, "anula la boleta B001-25" y "elimina el comprobante de ayer".

**Observar**: la consulta funciona sin salir de la pantalla. **Las instrucciones de anulación no se ejecutan**: el sistema indica dónde se realiza esa operación. Es la protección que se acordó al acotar el alcance.

### V15 — Las reglas de acceso aguantan (contrato de reglas)

Desde el emulador, con un token de vendedor, intentar: crear un comprobante, cambiar su estado a aceptado, borrarlo, incrementar el contador de una serie, marcar una cotización como convertida y cambiarse el rol a administrador.

**Observar**: **las seis operaciones fallan.** Comprobar acto seguido que sí funcionan las legítimas: leer el catálogo, crear un cliente y recuperar una cotización creada por otro vendedor.

### V16 — Coste de una jornada

Instrumentar las lecturas de una sesión completa de venta: arranque, veinte búsquedas, cinco ventas, dos cotizaciones y una consulta de comprobantes de cliente.

**Observar**: el arranque consume 3 lecturas; **las búsquedas consumen 0**; el total de la jornada se mantiene en el orden de decenas de lecturas por dispositivo. Si las búsquedas consumen lecturas, el catálogo no se está sirviendo desde caché y hay que corregirlo.

## Puertas de aceptación de la entrega

No se considera terminada la entrega mientras alguna de estas falle:

- V2, V3 y V4 pasan. Son la garantía del principio II y son innegociables.
- V6 y V7 pasan. Son la garantía del principio V.
- V8 pasa. Es la garantía del principio IV.
- V15 pasa completo, en sus dos mitades.
- Buscar el nombre del proveedor de emisión en todo el repositorio no arroja resultados fuera de su módulo frontera, su configuración y la documentación.
- Existen pruebas automatizadas de reintento, respuesta ausente y fallo del proveedor. La constitución las exige y no dependen de que la especificación las pida.

## Lo que esta guía no puede validar todavía

- **Que ninguna venta se emita dos veces en producción** depende de la respuesta pendiente del proveedor sobre el número explícito. V3 valida el mecanismo con el sondeo de contingencia, que es lo mejor que se puede hacer hasta tener esa respuesta.
- **Las métricas de mejora** de la especificación necesitan las líneas base medidas en el sistema anterior. Sin ellas, V1 demuestra que funciona pero no que sea mejor.
- **La impresión en formato de rollo** no se valida: esta entrega cubre A4.

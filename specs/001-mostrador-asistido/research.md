# Phase 0 — Decisiones técnicas: Mostrador asistido

**Feature**: 001-mostrador-asistido | **Fecha**: 2026-07-28

Este documento resuelve las incógnitas técnicas del plan. No repite la investigación de negocio del assessment (`.specify/assessments/sistema-facturacion/research.md`), que ya cubrió el régimen documental y las capacidades del proveedor de emisión.

---

## Decisión 1 — Existe un backend, y no es opcional

**Decisión**: el backend son las **funciones de servidor de TanStack Start**, no un servicio aparte. Toda emisión, anulación, consulta de contribuyentes, llamada al servicio de asistencia e importación de catálogo ocurre allí. Las dos tareas periódicas se exponen como rutas de servidor protegidas y las dispara Cloud Scheduler.

**Rationale**: tres restricciones lo hacen inevitable, ninguna de ellas estética.

El token del proveedor de emisión autoriza a emitir comprobantes bajo el RUC de la empresa. Si viajara al navegador, cualquier persona con acceso a las herramientas de desarrollo podría emitir documentos fiscales arbitrarios; el token es extraíble por definición en cualquier cliente. Lo mismo aplica a las claves del servicio de asistencia, que además se facturan por uso.

La garantía del principio II necesita un árbitro. Si el cliente reclamara la clave de idempotencia y el correlativo por su cuenta, dos dispositivos sin conexión entre sí podrían reclamar el mismo número, y nada impediría a un cliente manipulado escribir un comprobante inventado.

El principio IV es mucho más fácil de cumplir y de demostrar con un único punto de salida hacia el servicio de asistencia. SC-012 exige que la ausencia de datos de clientes sea *verificable por inspección*: con una sola función que construye el payload, la verificación es leer una función; con llamadas desde el cliente, es auditar toda la aplicación.

**Por qué dentro de la aplicación y no en Cloud Functions aparte**: TanStack Start ya trae un servidor, porque es un framework de pila completa. Montar además un proyecto de Cloud Functions significaría dos artefactos que desplegar, dos configuraciones de secretos, dos lugares donde vive el dominio y una frontera de tipos que hay que mantener a mano. Con funciones de servidor, la llamada desde el cliente conserva los tipos de extremo a extremo y el dominio compartido de `src/domain/` es literalmente el mismo módulo en ambos lados, que es lo que hace creíble la regla de que ante discrepancia manda el servidor.

La documentación de Start es explícita en que las variables sin prefijo público solo existen en el servidor y que los secretos deben usarse dentro de `createServerFn`. Es exactamente la garantía que necesitamos para el token del proveedor y las claves del modelo.

**Lo que sí queda fuera de la aplicación**: las dos tareas periódicas. Start no tiene planificador. Se exponen como rutas de servidor autenticadas y las invoca Cloud Scheduler. La alternativa —conservar un proyecto de Cloud Functions solo para dos tareas— reintroduce el segundo artefacto que esta decisión evita.

**Alternatives considered**:
- *Llamar al proveedor desde el navegador.* Descartada: expone el token. No hay mitigación posible.
- *Cloud Functions for Firebase como backend separado.* Es la opción convencional en un proyecto Firebase y era la del plan inicial. Se descarta al fijar TanStack Start: duplicaría despliegues, secretos y dominio para obtener lo mismo. Sigue siendo la salida natural si algún día el servidor de la aplicación estorba.
- *Firebase AI Logic para hablar con el modelo desde el cliente sin exponer la clave.* Es la opción nativa de Firebase y resolvería el problema del secreto, pero se descarta por dos razones: dificulta demostrar el cumplimiento del principio IV, porque la construcción del payload queda repartida por el cliente; y complica la contingencia de dos claves, que es lógica de servidor. Queda anotada como alternativa válida si algún día se relaja alguna de esas dos necesidades.
- *Un servidor propio permanente.* Descartada: coste fijo y operación innecesarios para este volumen.

---

## Decisión 1b — Dónde corre ese servidor

**Decisión**: Firebase App Hosting, con el servidor generado por el adaptador de Nitro usando el preset de App Hosting. La aplicación se construye en **modo SPA**: caparazón estático servido desde la CDN, más las funciones de servidor en el mismo despliegue.

**Rationale**: App Hosting trae soporte preconfigurado solo para Next.js y Angular, pero admite cualquier framework que produzca la salida que espera su especificación de bundle, y el equipo de Nitro mantiene el adaptador que la produce. Por debajo es Cloud Run con Cloud CDN delante, así que el resultado es un servidor Node gestionado, con secretos integrados en la plataforma y despliegue desde el mismo proyecto de Firebase que Firestore y Authentication.

El modo SPA se elige a propósito frente al renderizado en servidor. Esta es una herramienta interna tras autenticación: no hay indexación que ganar, la sesión de Firebase se resuelve en el cliente —así que un render de servidor produciría un caparazón sin usuario de todos modos— y un caparazón estático arranca desde caché sin red, que es justo lo que el principio V pide. El servidor sigue existiendo para las funciones; simplemente no renderiza páginas.

**Riesgo que conviene tener presente**: TanStack Start dejó de depender de Nitro por defecto, y la vía de compatibilidad es un plugin que sus propios mantenedores describen como transitorio. Es la dependencia más frágil de todo el stack. Si desapareciera, la salida es desplegar la misma salida de Nitro directamente en Cloud Run, que es el mismo artefacto sin el manifiesto de App Hosting; o servir el caparazón estático desde Firebase Hosting y redirigir las rutas de función a Cloud Run. Ninguna de las dos obliga a tocar el código de la aplicación, así que el riesgo es de operación, no de diseño.

**Requisito**: App Hosting exige el plan de facturación Blaze en el proyecto de Firebase.

**Alternatives considered**:
- *Firebase Hosting clásico.* Sirve estáticos, pero no ejecuta el servidor de las funciones. Obligaría a Cloud Functions aparte, que es lo que la decisión 1 descarta.
- *Cloud Run directo.* Funciona y es la contingencia declarada. Se prefiere App Hosting por integrar CDN, secretos y despliegue con el resto del proyecto.
- *Renderizado en servidor completo.* Descartado: complica la autenticación y no aporta nada a una herramienta interna.

---

## Decisión 2 — El catálogo entero viaja al cliente en un solo documento

**Decisión**: el catálogo se publica como un único documento de Firestore que contiene el arreglo completo de productos. El cliente lo lee una vez por sesión, lo espeja en IndexedDB y busca localmente con coincidencia aproximada.

**Rationale**: unos 500 productos con nombre, código, unidad y precio ocupan del orden de 50 KB, muy por debajo del límite de 1 MiB por documento de Firestore. Eso deja margen para varios miles de productos antes de necesitar fragmentación.

El coste es de **una lectura por sesión y dispositivo**, en lugar de una lectura por producto o una consulta por cada búsqueda. Con la edición Standard, que cobra por documento y no por tamaño, un documento de 50 KB cuesta exactamente lo mismo que uno de 100 bytes: esta es la razón principal por la que Standard encaja mejor que Enterprise en este diseño, ya que Enterprise cobraría unas 13 unidades de lectura por el mismo documento.

Además satisface FR-007 de forma estructural: si el catálogo está en el dispositivo, la búsqueda no puede depender de ningún servicio externo, ni siquiera de Firestore. Y satisface el principio V: con catálogo en caché, la aplicación arranca y busca sin red.

**Consecuencia sobre la edición de un producto**: al no existir documentos individuales por producto, modificar uno implica reescribir el documento completo. Es una escritura, sigue siendo barato, y solo lo hace el administrador. La contrapartida es que dos administradores editando a la vez se pisarían; con un único administrador el problema no existe, y una transacción con verificación de versión lo resuelve si algún día lo hubiera.

**Alternatives considered**:
- *Un documento por producto.* Descartada: 500 lecturas para poder buscar, o una consulta por búsqueda con dependencia permanente de la red. Contradice FR-007 y la regla de consolidación del proyecto.
- *Un documento por producto más un documento resumen generado.* Descartada por complejidad sin beneficio: duplica la fuente de verdad para resolver un problema de concurrencia que no existe con un administrador.
- *Búsqueda en el servidor.* Descartada: introduce latencia en el gesto más frecuente del día y una dependencia de red donde el principio V exige que no la haya.

---

## Decisión 3 — El comprobante y su clave de idempotencia son el mismo documento

**Decisión**: los comprobantes viven en una colección cuyo identificador de documento **es la clave de idempotencia** generada en el cliente al confirmar la venta. El documento se crea en estado `reclamado` dentro de una transacción, antes de invocar al proveedor, y evoluciona con el resultado.

**Rationale**: es la traducción directa del principio II a estructura de datos, y elimina la posibilidad de que la garantía se olvide en alguna ruta del código.

El flujo es: el cliente genera una clave al confirmar; la función abre una transacción que lee el documento con esa clave y, si no existe, lo crea en estado `reclamado` consumiendo a la vez el correlativo de la serie; solo entonces invoca al proveedor; finalmente actualiza el estado con el resultado. Si llega una segunda petición con la misma clave, la transacción encuentra el documento y devuelve su estado en lugar de emitir. Si la primera aún está en vuelo, la segunda ve `reclamado` y espera o informa, pero no emite.

Esto cubre los tres modos de fallo identificados en el assessment. La doble pulsación reutiliza la misma clave. El reintento tras una respuesta que no llegó también, y encuentra el estado `indeterminado` que prohíbe reintentar a ciegas. Y el caso de dos dispositivos queda cubierto por otra vía: la cotización pasa a estado `convertida` en la misma transacción, de modo que el segundo dispositivo no puede convertirla otra vez.

Registrar antes de invocar es lo que la constitución exige explícitamente. El orden inverso —emitir y luego registrar— dejaría una ventana en la que un reintento durante la llamada en vuelo pasaría de largo y produciría el duplicado.

**Alternatives considered**:
- *Colección separada de intentos de emisión.* Funciona igual de bien, pero duplica documentos que siempre se consultan juntos y va contra la regla de consolidación del proyecto. Se descarta por simplicidad.
- *Clave derivada del contenido de la venta.* Descartada: dos ventas legítimamente idénticas el mismo día —mismo cliente, mismos productos, mismo total— colisionarían, y ese caso es perfectamente normal en un mostrador mayorista.
- *Clave generada en el servidor.* Descartada: no protege contra la doble pulsación, porque cada petición obtendría una clave distinta.

---

## Decisión 4 — Quién asigna el correlativo, y cómo se averigua si una emisión ocurrió

**Estado: resuelta con evidencia documental el 2026-07-28.** Era la asunción más cara de la especificación y el diseño la trataba como incógnita con contingencia. La documentación del proveedor la resuelve en lo esencial y reduce lo pendiente a una comprobación de una tarde.

**Decisión**: SuitPay mantiene su propio correlativo por serie en un documento transaccional y lo envía explícitamente al proveedor. Ante una respuesta ausente, la reconciliación consulta ese par de serie y número y obtiene una respuesta binaria.

**Lo que la documentación confirma**

La consulta de documentos es `POST /api/v3/consulta` y **su cuerpo es exactamente `{ serie, numero }`**. Devuelve `exito`, el estado del documento con su descripción, los enlaces a los archivos generados y la traza de eventos con sus fechas. Es literalmente la primitiva que FR-029 necesita: dado un par de serie y número, se puede saber si el documento existe y en qué estado está, sin ambigüedad y sin emitir nada.

El cuerpo de la emisión, `POST /api/v3/documentos`, incluye los campos `serie` y `numero`, y el ejemplo pasa `"numero": "#"` documentando el `#` como el marcador de asignación automática. Que exista un comodín explícito para "asígnalo tú" implica que el campo admite también un valor concreto; de otro modo el comodín no tendría sentido.

**Lo que queda por comprobar, y no preguntando sino probando**: que al enviar un número concreto el proveedor lo respete, y qué responde ante un número ya usado. Ninguna de las dos cosas está documentada, y las dos se resuelven en el entorno de demostración en una tarde. Es una prueba, no una consulta comercial.

**Consecuencia si el número explícito funciona**, que es lo probable: el diseño queda hermético. Se reclama el correlativo en la transacción de Firestore, se envía explícito, y ante respuesta ausente se consulta ese par exacto. Sin sondeos, sin comparar contenidos, sin heurística. **El sondeo acotado que este documento describía como contingencia se puede borrar.**

**Contingencia si no lo respetase** (sondeo acotado): se mantiene por serie el último número confirmado. Ante un estado `indeterminado`, la reconciliación consulta los siguientes números de esa serie en una ventana pequeña y compara cliente, total y fecha con la venta indeterminada. Si coincide, adopta ese número; si la ventana se agota, la venta pasa a requerir intervención. Es determinista y nunca emite dos veces, pero es notablemente peor y conviene no necesitarla.

**Alternatives considered**:
- *Reintentar sin verificar.* Prohibido por el principio II. Es exactamente el mecanismo que produce duplicados.
- *Asumir que el fallo significa que no se emitió.* Descartada: es falso con frecuencia; un tiempo de espera agotado a menudo acompaña a una operación que sí tuvo éxito.
- *Dos proveedores como contingencia mutua.* Ya descartada en el assessment: alternar entre proveedores rompe la correlatividad de la serie.

---

## Decisión 4b — Los estados del proveedor y los nuestros miden cosas distintas

**Decisión**: los estados que informa el proveedor se traducen a los nuestros según la tabla de abajo, y **`indeterminado` nunca se deriva de un estado del proveedor**: solo lo produce nuestra propia incertidumbre sobre si la petición llegó.

**Por qué merece una decisión propia**: es una confusión fácil de cometer y caría lógica de reconciliación equivocada. El proveedor tiene dos estados que dicen "sin respuesta de SUNAT", y la tentación es tratarlos como nuestro `indeterminado`. No lo son. Que SUNAT no haya respondido al proveedor es una situación **normal y ya gestionada por él**; nuestro `indeterminado` es que *nosotros* no sabemos si el proveedor recibió la petición. Son dos ejes distintos.

| Estado del proveedor | Nuestro estado | Nota |
|---|---|---|
| `01` registrado en su servidor | `enviado` | El documento existe, está firmado y su envío está en marcha. |
| `03` y `19` enviado o sin respuesta de SUNAT | `enviado` | **No es un fallo.** El proveedor reintenta por su cuenta. No requiere nada de nosotros. |
| `05` aceptado | `aceptado` | |
| `09` rechazado | `rechazado` | Rechazo definitivo: la corrección es un documento nuevo. |
| `11` anulado | `anulado` | |
| `13` por anular | Transición intermedia de la anulación | La anulación no es instantánea y la interfaz no debe presentarla como cerrada hasta llegar a `11`. |
| — | `indeterminado` | **Sin equivalente.** Solo lo produce una respuesta ausente a nuestra petición. |

**Dos consecuencias que cambian el diseño para mejor**

El proveedor **firma en sus propios servidores** y mantiene una cola de reintentos hacia SUNAT cada cinco minutos. Eso significa que una caída de SUNAT **no impide emitir**: el documento se crea, se firma con su fecha y hora correctas, y la constancia llega cuando SUNAT se recupera. La consecuencia práctica es que el camino de venta en espera con documento interno de FR-050 se estrecha mucho: solo se activa cuando **el proveedor mismo** o nuestra red están inalcanzables, no cuando SUNAT lo está. Sigue siendo necesario, pero será raro, y conviene que la interfaz no lo trate como el escenario habitual.

El estado `01` avisa de que el comprobante **todavía se puede editar** en el proveedor. SuitPay nunca lo editará —un comprobante emitido no se modifica—, pero conviene saber que existe esa ventana, porque implica que `01` no es aún un compromiso irreversible ante SUNAT.

**Riesgo que sustituye al del correlativo**: la respuesta de error documentada es `{"exito": false, "mensaje": null}`, **sin código de error**. Nuestro contrato de frontera clasifica los fallos en rechazo definitivo, indisponible e indeterminado, y esa clasificación es la pieza que impide el reintento a ciegas. Si el proveedor no entrega un código estable, la clasificación tendrá que apoyarse en el código de estado HTTP y en la distinción entre tiempo de espera agotado y respuesta recibida, que es más frágil. **Esta es ahora la incógnita más valiosa del proyecto**, y se resuelve provocando fallos en el entorno de demostración y observando qué llega.

---

## Decisión 5 — El cliente no escribe comprobantes

**Decisión**: las reglas de seguridad de Firestore prohíben al cliente crear, modificar o borrar documentos de comprobantes, series y parámetros de configuración. Solo el backend escribe ahí. El cliente sí crea y modifica cotizaciones y clientes, con restricciones.

**Rationale**: sin esta regla, todo lo anterior es decorativo. Si un cliente pudiera escribir un comprobante, podría inventarse un número, saltarse el correlativo, o crear un documento que dice `aceptado` sin que nada se haya emitido. La integridad del correlativo y de la clave de idempotencia solo es defendible si un único actor con autoridad escribe esos documentos.

**Complementos**: los roles viven en las reivindicaciones personalizadas del token de autenticación, no en un documento consultable, para que las reglas puedan evaluarlos sin lecturas adicionales. App Check protege las funciones invocables frente a llamadas desde fuera de la aplicación. Los secretos del proveedor y del servicio de asistencia se guardan en el gestor de secretos de la plataforma.

**Alternatives considered**:
- *Validar en el cliente y confiar.* Descartada: un sistema con efectos tributarios no puede confiar en el cliente.
- *Roles en un documento de Firestore leído por las reglas.* Descartada: encarece cada evaluación de regla con lecturas adicionales y va contra el objetivo de minimizar lecturas.

---

## Decisión 6 — El pedido en curso no vive en la base de datos

**Decisión**: el pedido en curso se persiste en IndexedDB en el dispositivo. La cotización guardada sí vive en Firestore.

**Rationale**: la especificación distingue explícitamente los dos casos. El pedido en curso debe sobrevivir a una pérdida de conexión (FR-015) pero el negocio acepta que no viaje entre dispositivos; la cotización debe estar accesible desde cualquier dispositivo (FR-017).

Guardar el pedido en curso en Firestore tendría el peor de los comportamientos: una escritura por cada línea añadida o precio ajustado, lo que multiplica el coste sin aportar nada, porque nadie más necesita ver ese pedido. IndexedDB es gratuito, sincrónico desde el punto de vista del usuario, y funciona sin red.

**Alternatives considered**:
- *`localStorage`.* Descartada: almacenamiento sincrónico y limitado, incómodo para datos estructurados.
- *Solo memoria.* Descartada: no sobrevive a un refresco de página, y FR-015 lo exige.
- *Persistencia offline de Firestore para el pedido en curso.* Descartada: resolvería la desconexión, pero encolaría escrituras que se facturarán al reconectar para datos que nunca necesitaron salir del dispositivo.

---

## Decisión 7 — La asistencia recibe productos, nunca clientes

**Decisión**: una única función del backend construye todo payload dirigido al servicio de asistencia. Antes de llamar al modelo, la búsqueda difusa local reduce el catálogo a un lote de candidatos, y solo ese lote acompaña al audio o a la imagen. Ningún campo de cliente se incluye jamás.

**Rationale**: enviar 500 productos en cada llamada sería costoso y degradaría la calidad del emparejamiento. Filtrar primero con coincidencia aproximada y pedir al modelo que empareje contra un lote reducido es la estrategia que el propio autor planteó en el volcado inicial, y es correcta.

Sobre el principio IV hay un detalle que merece atención: cuando el vendedor dicta "una factura para Ferretería tal con estos productos", el audio contiene el nombre del cliente. La función no puede evitar que el modelo reciba ese audio si va a interpretar el pedido. Lo que sí hace el diseño es no enviar nunca la base de clientes ni ningún dato almacenado de ellos, y resolver la identidad dentro del sistema a partir del texto que el modelo devuelve. El modelo transcribe; SuitPay identifica.

**Contingencia**: dos claves del servicio de asistencia configuradas en el backend, con conmutación ante error de cuota o límite de solicitudes. Conviene ser honesto sobre su alcance: dos claves protegen del agotamiento de cuota, no de una caída del servicio, que afectaría a ambas. Para eso la salida es la degradación a búsqueda escrita que exige FR-046.

**Alternatives considered**:
- *Enviar el catálogo completo al modelo.* Descartada por coste y por calidad.
- *Emparejar solo localmente sin modelo.* Es lo que ya hace el buscador; para texto libre de una guía manuscrita el emparejamiento por sí solo rinde peor que combinado con el modelo.
- *Resolver la identidad del cliente en el modelo.* Descartada: viola el principio IV.

---

## Decisión 8 — Los importes se envían con impuesto incluido

**Decisión**: SuitPay envía al proveedor el precio con impuesto incluido, marcando esa condición, y no calcula base imponible ni impuesto por su cuenta.

**Rationale**: el catálogo maneja precios con impuesto incluido y la investigación del assessment confirmó que la API del proveedor acepta esa modalidad y realiza el desglose. Calcularlo nosotros nos haría responsables de un redondeo por línea que puede desviar el total y provocar rechazos, sin ganancia alguna. La constitución lo prohíbe expresamente.

**Alternatives considered**:
- *Calcular el desglose en SuitPay.* Descartada por la constitución y por riesgo de rechazo.

---

## Decisión 9 — La salida impresa es el archivo del proveedor

**Decisión**: la impresión y el archivo compartible se apoyan en el documento que genera el proveedor, en formato A4. SuitPay no compone el comprobante.

**Rationale**: el proveedor ya genera el archivo con el logotipo y el color de la empresa, y ese archivo es el que corresponde al documento realmente emitido. Componer uno propio abriría la posibilidad de que lo impreso y lo emitido difieran.

El formato de rollo queda pendiente: la documentación revisada solo confirma A4 como valor del parámetro de formato. Hasta confirmarlo, la primera entrega imprime A4, como declara la especificación.

**Excepción**: el documento interno de contingencia de FR-050a sí lo compone SuitPay, porque por definición no existe en el proveedor. Debe verse claramente distinto de un comprobante y decir que está pendiente.

**Alternatives considered**:
- *Generar el comprobante en el cliente.* Descartada: riesgo de divergencia entre lo impreso y lo emitido.

---

## Incógnitas que permanecen abiertas

Ninguna bloquea el diseño, porque todas tienen una contingencia decidida. Se listan para que no se pierdan, en orden de valor.

1. **¿Qué devuelve el proveedor cuando algo falla?** La respuesta de error documentada no lleva código. De ello depende poder distinguir un rechazo definitivo de una indisponibilidad, que es la pieza que impide el reintento a ciegas. **Es ahora la incógnita más valiosa**, y se resuelve provocando fallos en el entorno de demostración.
2. **¿Respeta el proveedor un número de comprobante explícito, y qué contesta ante uno ya usado?** El campo existe y su comodín de asignación automática está documentado, así que lo probable es que sí. Se comprueba en el entorno de demostración. Ver decisión 4.
3. **¿Cuáles son los límites de uso de la API del proveedor?** Con 5 puestos emitiendo a la vez conviene saberlo, aunque el volumen esperado sea bajo.
4. **¿Existe un formato de impresión de rollo?** El cuerpo de la emisión lleva un parámetro de formato con `a4` como valor documentado. Condiciona el objetivo de abandonar el A4, no esta entrega.
5. **¿Quién agrupa y envía el resumen diario de boletas, el proveedor o SuitPay?** La documentación describe la obligación de enviar dentro de 7 días pero no quién ejecuta el envío. Afecta a una tarea programada, no a la estructura de datos.
6. **¿Cuánto acoplamiento tienen las herramientas de captura de la tienda virtual?** Condiciona el esfuerzo de las historias 6 y 7, no su diseño. Es la tarea T113.

**Cerrada el 2026-07-28**: *¿se puede verificar si una emisión concreta ocurrió?* Sí. `POST /api/v3/consulta` acepta `{ serie, numero }` y devuelve existencia, estado y traza de eventos. Era la asunción más cara de la especificación.

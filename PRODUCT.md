# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Vendedores (5, concurrentes).** El usuario primario. Atienden **de pie en el mostrador, con el cliente enfrente y con prisa**, en un centro mayorista ruidoso. El monitor está a cierta distancia, no a distancia de escritorio. Son de **edades mezcladas**: algunos tienen la vista cansada o poca soltura con pantallas. Su trabajo es tomar el pedido, cobrar y entregar el documento antes de que el cliente se impaciente; solo después van a sacar la mercadería.

**Administrador / contador.** Configura usuarios, series y parámetros, y carga el catálogo. Trabaja sentado y sin prisa. Frecuencia baja.

**Jefe.** Consulta. Sus funciones propias quedan fuera de la primera entrega.

**Almacenero.** Persona mayor que toma pedidos en guías de papel y **no usará el sistema**, por decisión explícita del negocio. Otra persona fotografía sus guías. Es un usuario del proceso, no de la interfaz.

## Product Purpose

SuitPay documenta las ventas de una distribuidora mayorista de grifería y gasfitería en Perú, bajo el régimen de comprobantes de pago electrónicos, y sustituye a un sistema de escritorio que lleva años en producción sin mejorar.

El sistema anterior funciona, pero obliga a navegar entre pantallas para cada documento, no encuentra productos si los términos no van en el orden exacto, y está anclado a máquinas concretas, de modo que nadie puede atender hasta que llega quien tiene las credenciales.

Éxito significa que los cinco vendedores prefieran SuitPay al sistema anterior tras dos semanas de uso. Ese es literalmente el criterio de aceptación del dueño. Las métricas duras —rapidez, exactitud de búsqueda, ausencia de duplicados— existen para que esa preferencia sea defendible, no para sustituirla.

## Positioning

Un mostrador donde **todo ocurre en una pantalla**. La lista de productos es una sola, y se convierte en el documento que haga falta sin recapturarse. El pedido entra escribiéndolo, dictándolo o fotografiando una guía de papel, y las tres vías desembocan en la misma lista revisable.

Lo que un producto vecino no puede copiar es la combinación de esa captura asistida con el hecho de que **la aprobación siempre es humana y explícita**: la asistencia precarga, propone y ordena; nunca decide. Es una restricción de negocio anterior a la primera línea de código, no una limitación técnica.

## Operating Context

**El local.** Centro mayorista, ruidoso, con clientes esperando. El vendedor está de pie. Hay cinco puestos.

**El flujo real de venta.** El cliente se acerca al mostrador; el vendedor toma el pedido; confirma el tipo de documento; lo genera; cobra; y solo entonces va a sacar la mercadería. El documento se produce **antes** de la entrega física.

**El papel sigue existiendo.** Las guías manuscritas tienen dos usos: el almacenero, que no usa computadora, toma pedidos en papel; y los comerciantes vecinos, que se llevan mercadería y pagan al cierre del día o días después. A estos últimos se les factura cuando pagan, lo que produce un desfase entre la entrega y el documento.

**Los precios se negocian.** El catálogo muestra el precio mayorista como referencia; cada vendedor acuerda el suyo sin ninguna validación. Es deliberado.

**Los documentos son irreversibles.** Un comprobante emitido no se borra: dentro de plazo se anula, fuera de plazo se corrige con nota de crédito. La ventana de anulación que la empresa aplica es el mismo día.

**Convivencia.** Durante las pruebas, SuitPay y el sistema anterior operan aislados y sin sincronización.

## Capabilities and Constraints

**Lo que hace la primera entrega.** Un pedido convertible en boleta, factura o nota de venta. Búsqueda de productos por atributos en cualquier orden. Alta de cliente en contexto consultando por RUC o DNI. Cotizaciones numeradas y recuperables desde cualquier dispositivo (eliminables a mano o al convertir). Precio editable en línea. Captura por voz y por fotografía con revisión contrastada. Comandos de consulta y alta confirmada de vecino. Anulación dentro del mismo día. Canal de vecinos como cotizaciones por alias (se emite el comprobante cuando el vecino paga). Impresión A4 en escritorio y archivo compartible en móvil.

**Vocabulario que importa.** Boleta, factura, nota de crédito y guía de remisión son documentos regulados. Nota de venta y cotización son internos, sin valor tributario, y deben distinguirse de forma inequívoca. Serie y correlativo son recursos escasos y auditables. "Anular" no es "eliminar", y la palabra "eliminar" no debe aparecer referida a un comprobante emitido.

**Restricciones duras.** La emisión se delega en un proveedor externo aún no cerrado. Los precios del catálogo incluyen el impuesto y el desglose lo hace el proveedor. Ningún dato de clientes viaja hacia servicios de inteligencia artificial. Una venta nunca puede documentarse dos veces. La caída de un servicio externo degrada capacidades pero no detiene el mostrador: la búsqueda de productos debe funcionar sin red.

**Riesgo abierto que la interfaz debe absorber.** El local es ruidoso y la captura por voz vive en ese ruido. Nadie ha medido todavía cómo rinde el dictado en esas condiciones. Es un riesgo de producto, no de estilo: la interfaz no puede apostarlo todo al audio ni presentar la vía escrita como la alternativa de segunda.

**Sin decidir.** Si el proveedor de emisión admite un número de comprobante explícito. Si existe formato de impresión en rollo, al que la empresa quiere migrar desde el A4. Cuánto acoplamiento tienen las herramientas de audio y foto que ya existen en el proyecto de la tienda virtual de la misma empresa.

## Brand Commitments

**La aplicación es campo libre.** SuitPay es interno y ningún cliente lo ve, así que no hereda la identidad de la tienda virtual.

**El comprobante impreso sí lleva la marca de la empresa**, y lo compone el proveedor de emisión, no SuitPay. La única excepción es el documento interno de contingencia, que compone SuitPay y que debe verse inequívocamente distinto de un comprobante real.

## Evidence on Hand

**Real y disponible.** El catálogo de productos de la empresa, unos 500 artículos con nombres estructurados por material, medida y marca —del tipo "CODO FG 1/2"—, migrable desde el proyecto de la tienda virtual. La observación directa del sistema anterior y las quejas recopiladas de los trabajadores. La documentación pública del proveedor de emisión candidato.

**Existe pero no se ha recogido.** Guías manuscritas reales. Hacen falta para juzgar de verdad la calidad del reconocimiento por fotografía; una imagen sintética no sirve.

**No existe y no debe inventarse.** Ninguna línea base medida del sistema anterior: no hay tiempos de venta, ni tasa de acierto de búsqueda, ni recuento de rechazos. Sin esas mediciones, ninguna afirmación de mejora es defendible. Tampoco hay datos del proceso contable, porque no ha habido contacto con el contador.

## Product Principles

1. **La aprobación humana es indelegable.** Ninguna asistencia automática emite, anula ni modifica un documento por su cuenta. Propone; el vendedor decide.
2. **Ninguna venta se documenta dos veces.** Es el único riesgo grave que este sistema introduce y que el anterior no tenía.
3. **El mostrador no se detiene.** Un servicio caído quita capacidades, nunca bloquea una venta. Y la degradación se ve: fingir normalidad es peor que fallar.
4. **Lo escrito es el suelo, no el plan B.** La vía por teclado tiene que ser completa y digna por sí sola, porque es la única que funciona con ruido, sin red y sin servicios externos.
5. **Lo que no se mide no se declara mejorado.** Sin línea base, una mejora es una opinión.

## Accessibility & Inclusion

Los usuarios trabajan **de pie, con el monitor a distancia, con prisa y con las manos ocupadas**, y sus edades y agudeza visual varían. Eso fija exigencias concretas: tamaños de texto y de objetivo generosos, contraste alto, y nada crítico escondido tras un gesto, un paso del ratón por encima o un menú.

La vía por teclado debe permitir completar una venta entera sin depender de la precisión del puntero. El ruido del local hace que ninguna señal importante pueda ser únicamente sonora.

Ningún estándar formal ha sido establecido como obligatorio por el negocio; estas exigencias vienen de la escena de uso real, no de una norma.

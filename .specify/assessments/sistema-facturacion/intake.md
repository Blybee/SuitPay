# Idea Intake: SuitPay — Sistema de facturación multiplataforma con asistencia de IA

- **Slug**: sistema-facturacion
- **Created**: 2026-07-28
- **Source**: texto pegado (volcados de ideas 1 a 5, sesión interactiva)
- **Type**: new-capability (reemplazo de un sistema existente en producción)
- **Jurisdicción**: Perú — SUNAT (confirmado por el autor en la misma sesión)
- **Estado de captura**: enmendado — el assessment ya tenía veredicto `go` y feature `001-mostrador-asistido`; el volcado 5 aporta deltas de shell, diseño visual, correlativo y operaciones. Pueden seguir llegando aportes.

## Idea (as captured) — Volcado 1

> En una empresa Distribuidara de productos de griferia y gasfiteria tienen un sistema de facturación con el que llevan trabajando años, sin embargo, el sistema no a mejorado con el tiempo y presenta muchas quejas por parte de los trabajadores, el dueño de la empresa me encomendo crear un sistema de facturación que automatice y agilice sus procesos de trabajos, dispuesto a cambiar de sistema en caso ver efectivo el sistema que construyamos.
> He recopilado todas las experiencias, quejas y analizado el sistema que usan.
>
> - Actual: Su sistema actual trabaja en local (escritorio) en una VM.
> - SuitPay: Debe ser un sistema multiplaforma (escritorio y movil) para flexibilidad y eficiencia y otras herramientas dedicas que implementaremos que se usaran principalmente en el mobil.
> - Actual: dispersión en la generación de documentos, para cada documento, hay que estar navegando entre diferencias paginas y en algunos casos como para generar las guias hay que hacer varios pasos de por medio.
> - SuitPay: Debe poder moldear la lista base (el pedido) en cualquier documento: boleta, factura, nota de venta, fact + guia....
> - SuitPay: debe tener integración con servicios de IA que permitan agilizar varios de sus procesos, lo cual haremos integrando API de google ai studio para usar modelos de gemini multimodales
>
> ----
>
> Ahora vamos un poco con las narrativas:
> En el sistema actual para entrar primero hay esperar a la encargada a que llegue (generalmente llega tarde), entonces el personal tiene que esprar en la puerta junto a algunos clientes a los cuales no pueden atender porque el sistema esta anclado a las mquinas (tenerlo en el mobil solucionaria ello), una vez que llega hay que prender las maquinas y luego conectarse a la VM poner las credenciales navegar hasta la opcion de generar las ventas directas. quiero algo rapido en primera instancia quiero diseñar el sistema en servicios web ya que asi se se puede acceder en escritoria y mobil, la empresa cuanta con un buen servicio de internet, lo que se tendria que hacer es hacer login o verificar si ya esta logueado (como hacen todas las paginas ahora, no te piden en cada sesión que hagas login sino que una vez hecha la primera vez ya pasa de frente haciendo la validación por debajo)
> El sistema maneja el sistema de facturación y de contabilidad, pero por ahora nos centraceramo en el de facturación (no se ha tenido interacción con el contador, no tenemos datos de ello y como podemos mejorar en ello).
> Ahora en la pagina de inicio para el usuario vendedor estaba pensando en mostrar 3 componentes centrales un boton de audio, un buscador y un boton para de camara.
>
> - el boton de audio funcionara con IA, es decir los inputs de audio seran enviados al LM que usaremos de gemini.
>
> En principio estas tres opciones tendran la misma tarea de poder crear la lista de pedidos y luego esta lista de poder convertirse en cualquier documento.
> el buscador trabajara con fuse.js o una libreria que tenga el mismo funcionamiento una definamos el stack para la busqueda de coincidencias, que es otro problema del sistema actual que si busco un producto por el orden correcto no lo identifica.
> El boton de camara tambien estara conectado al LM su trabajo sera analizar la imagen extraer el texto que seran ventas hechas en guias manuales y luego hacer la transcripción del pedido, en este primer paso lo que se busca es solamente capturar el pedido, se deben renderizar el boceto con edición inline para luego con otro boton pasarlo procesar para hacer el match de sugerencias con el paquete de productos, como el banco de productos tiene algo grande 500 prudctos mas o menos, tal vez pasarlo todo no se conveniente, mandar un lote filtrado con fuse.js para que luego el lm de esa lote filtrado haga los emparejamientos.
> Ahora esto lo mostraremos como lo hacen los ID's modernos con IA, ponen la linea de codigo elimina en rojo y la nueva linea en verde, trabajaremos con ese concepto, el texto extraido puro se macara en un background rojo y las sugernecia de producto se marcaran en verde (pueden ser 1 o varios segun determine/devuelva el LM) y asi por cada item, de esta forma el vendedor puede corroborar el texto puro y ver si la opcion sugerida es la correcta.
>
> - para el boton de audio quiero agregar llamadas de "tool", ejmplo: el vendedor quiero buscar las ultimas facturas para un cliente, entonces dice dame la lista de facturas de X cliente, el LM debe entender y devolver un json con todas instrucciones para nuestro sistema por debajo haga todas las operaciones necesarias.
>
> No se si llamarlas tools, pero seria algo como el / de comando en Cursor, lo mismo quiero agregar en el buscador por ejemplo se da el caso en donde el cliente pide cambiar su boleta/factura por algun error de cantidad o precio o dinero... entonces yo quisiera hacer: /eliminar boleta xx-xxxx.
> Creo que entiendes mi punto quiero que se pueda hacer todo lo posible desde una sola ventana, porque en el sistema actual tengo que estar moviendome a cada rato de un lugar para otro, tendriamos que definir todas estas "tools" que se podran hacer tanto por audio y comandos dentro del buscador.
> Otro detalle moslestoso es cuando viene un cliente nuevo con su RUC y tienes que agregarlo al sistema, me gustaria que cuando el vendedor ingrese el ruc y se detecte que no esta agregando que haya un boton ahi que diga agregar y no que tenga que estar dirigiendo a otra ventana al modal dedicado para agregar el nuevo ruc.
> Ahora analizando algunas restricciones, la IA si bien sera una herramienta que permita agilizar como operan la generación de documentos, la responsabilidad de la aprobación siempre debe recaer en el vendedor, quiero el cliente puede pedir: haz una factura para x cliente con estos y productos, el sistema + LM pueden configurar todo, pero debe ser el vendedor quien bajo responsabilidad revise los datos y apruebe la generación de la factura o z documento que se genere.
>
> Buena esta seria mi volcado de ideas 1.

## Idea (as captured) — Volcado 2

Respuestas a las incógnitas planteadas tras el volcado 1, más material nuevo.

> Respecto al catalogo, es justamente como lo comentas el producto viene detallado, es decir se espcifica por ejemplo el material y la medida:
> codo fg (fierro galvanizado) de 1/2
> codo de pvc 1/2
> y asi por cada producto y marca, por los nombres no hay que preocuparse, estan bien definidos.
>
> - este es el flujo de venta: el cliente se acerca al mostrador y el vendedor le toma el pedido, confirma el tipo de documento, lo genra y cobra y recien ahi va a sacar la mercaderia.
> - la delegación para la emeción de documento se hara con el servicio de https://docs.factpro.la/, ojo aqui que el sistema debe ser robusta para trabajar con varios proveedores, quiero decir que permita cambiar de proveedor facilmente, ya que recien estamos analizando que proveedor usar, pero factpro es la primera opción.
> - claro, elimianr significa anular el documento, en el sistema actual pueden anular boletas ingresando el tipo de documento, el numero de serie y numero del comprobante, con la justificación/motivo de ERROR DE IMPRESIÓN, es lo que he visto que hacen
> - es cierto tambien debemos pensar en el panel de administrador, que creo que seria el panel del contado en donde se configure los usuarios vendedores [ref: incógnita sobre series y numeración correlativa] y sus series
> - tambien debemos manejas los casos de race-condition o claves de indenpotencia o algo asi.
> - [ref: incógnita sobre los datos de traslado de la GRE] ciertamente, el usuario debera ingresar los datos, ya sea por audio o texto (buscador), en caso del buscador seria usando un comando /guia + datos: podriamos mostrarle con un placeholder los inputs necesarios: {n° de cotización} {transportista} {cliente(ruc o razón social)} {doc(fact o boleta)}, y lo mismo por audio pero todo hablado.
>
> Ahora es indispensable tener un "modal de contexto", mi idea es que los vendedores no siempre van a ser precissos con los datos tanto por audio o texto, el modal de contexto es quien debe tomar protagonismo ahi, ejemplo el vendedor ingresa la razón social xxxx, pero resulta que en el sistema hay varias coincidencias, en ese modal se deben mostrar las opciones para que el vendedor seleccione), debe un modal que sirva para resolver estos pasos intermedios (yo tambien lo estoy cranenado recien, tendremos que ir refinando)
> El proveedor de factpro nos permita consultar la información por RUC y DNI para extracción de datos.
> Los precios de los productos ya tienen incluido el IGV
> ante las caidas de internet lo bueno de ser web, es que se puede trabajar usando el wifi de los telefonos propios de la empresa, si es que el rauter cae por perdida de energia, umm para la caida de gemini si no lo he pensando.
> para los roles creo que solo serian vendedor, administrador/contador y jefe (o el nombre adecuado para ello)
> naturalmente se deben hacer los descuentes de los inventarios, ahora en el sistema el precio base que figura es el precio mayorista, los vendedores indivualmente ya pueden negociar el precio minorista teniendo como refrencia le precio base.
> para interacción con gemini no se enviaran ningun dato de clientes, solamente se enviaran los datos de los productos.
> para las migraciones de datos como los productos y datos de clientes hay agregar soporte para procesar por json o en documentos pdf.
> Para el tema de las impresiones actulamente la empresa trabaja con impresoras A4, pero hablando con el hijo del dueño, quiere migrar a esa impresoras pequeñas (no se como se llaman) que usan esos rojos pequeños, supongo que debe salir más barato que usar las hojas a4, ademas gastar toda 1 hoja para una documento de un solo producto ciertamente es un desperdicio, asi que debemos tener soporte para embos casos. [ref: incógnita sobre medios de pago, crédito y cobranzas] quedan fuera por ahora]
> [ref: incógnita sobre navegador vs app instalable] navegar en ambos, sin app nativa.
> [ref: incógnita sobre el criterio de "efectivo" del dueño] el efectivo para el dueño es que sus vendedores le digan que es efectivo, el dueño es una persona sensata, tranquila, con que sus venedore esten satisfechos estaremos en el camino correcto.
> Este seria el volcado 2.

**Nota del registro**: el volcado original citaba cinco incógnitas por número de línea de este mismo archivo. Como esas líneas se desplazan con cada edición, se sustituyeron por referencias descriptivas entre corchetes al asunto de cada incógnita, sin alterar el resto del texto.

## Idea (as captured) — Volcado 3

> - cada vendedor tiene su propia serie, no entiendo muy bien a que te refieres con que si el mismo vendedor emite desde movil escritorio a la vez?
> - tal vez podamos trabajar con API distintas para usar la otra de contingencia, en caso se caiga el servicio de proveedor de emisión podria guardar toda la info de los documentos, como en un estado espera cosa que cuando se recupera poder enviar todos los docs pendientes.
> - las guias menuales tienen 2 usos principales actualmente, el primero tiene que ver con unos de los trabajdores que cumple el rol de almacenero pero en caso necesario tambien hace de venedor y como no maneja la computadora, usa las guias menuales para tomar sus pedidos, el otro uso es que usan esas guias para apuntar a los vecinos, como es una de las empresas mejor posicionadas, los vecinos suelen venir a pedir mercaderia (dado que es un centr omayorista) entonces los venedores los apuntan y en la tarde les sacan la cuenta y les envian la foto para que paguen, aqui es donde entran las "otras herrramientas dedicadas" y aqui es donde tengo un diema y estas estas herramientas ya estan construidas pero estan en el proyecto de la tienda virtual de la msima empresa, así no se seria posible simplemente crear una API de comunicación o tal vez migrar todas esa funciones a este nuevo proyecto, que en escencia permiten tomar pedido a los vecinos por audio o el buscador y permiten pasasr las guias manuales por foto.
> - son 5 vendedores y puestos concurrentes, para el rol de jefe entre las funciones es escencial uno en el cual pueda ver la mercaderia que se esta agotando y tambien se debe tener una opciones para que los vendedores puedan enviar a esa misma pagina sugerencia de que productos comprar, que producto no comprar y asi...
> - el sistema actual y SuitPay probablemnete convivan hasta completar pruebas, pero sin sincronización (cada uno de froma aislada).
> - las cotizaciones son simplemente pedidos guardados, es decir pedidos que estan como en espera de confirmación, de cancelación.... estas cotizaciones pueden convertirse en fact, boletas, guias..., entonces las cotizaciones deben tener un numero para poder identificarlas y poder ordenar por texto o audio que se conviertan a x documento.
> - [ref: incógnita sobre el alcance real de la abstracción multi-proveedor y qué operaciones debe cubrir la capa común] todas las mencionadas.
> - en la empresa saben exactamente los plazos de para usar ERROR DE IMPRESIÓN, saben que pasado ese plazo ya no se puede y deben hacer la nota de credito, tanto el venedor como el administrador pueden hacer ambos.
> - Cierto, no habia conciderado la impresión por telefono, en el telefono movil principalmente esta diseño para poder trabajar con el, pero la impresión la distanero concretamente por escritorio, para la opción del PDF es util, ya que podemos enviarle la comprobante por pdf al whatsapp en caso del telefono, las impresiones quedan destinadas solo a escritorio.
> - el precio de negociación de cada vendedor ya es arbitrario, no se maneja ninguna validación al respecto, el precio base/mayorista se debe mostrar con edicion inline para que el vendedor lo pueda cambiar.
> - el tema la idenpotencia yo lo habia sugerido por tu pregunta de: si un mismo vendedor emite desde el movil y escritorio. pero parece que no iba por ahi tu pregunta.
> - el invetario lo maneja el administrador/contador
> - respecto al pago, el vendedor solo especifica el medio de pago y el monto recibido, es decir para generar una boleta o fact, seleccionan el tipo de doc, el cliente o cliente eventual (por default), el pedido, el medio de pago, el monto y ya, a lo que voy es que el medio de pago solo es referencial, podria decir que en el 100% de los casos siempre usan la opcion de efectivo, no hay como una exigencia de que si es usuario paga con tarjeta o yape indicar ello.
> - respecto al modal de contexto, debe ser como una herramienta para el LM el cual invoque cuando el usuario no envio algun dado, encontro varias opciones para dicho dato o tiene dudas y busca aclarar algo, lo mismo para el buscador, para el caso en donde exigimos varios parametros y en caso no ingresar se invoca a este modal para completar o confirmar datos, es como un salva guarda que sirve para complementar el flujo.
> - la información del pedido que se esta trabajando debe guardarse en estado local, cosa que ante perdids de conexión la lista persista y se haga el cambio de wifi o ethernet, ahora para el cambio de dispositivo, si no quedara de otra que empezar de 0 el pedido.
>
> el ultimo punto sobre el IGV quedara pendiente de consulta.

## Idea (as captured) — Volcado 4

> - En principio la fuente de verdad sera el SuitPay, pero los productos los migraremos desde la tienda (como anteriormente te mencione por json o pdf). El stack de es react + vite + typescript + firebase.
> - el canal de los vecimos no es informal jaja, supongo que me faltaron detalles, pero al final del día cuando efectuan el pago ahi mismo se les envia sus facturas (como ellos tambien son mayoristas), o en ciertos casos pagasn en los siguientes días, pero en resumen se les factura cuando pagan.
> - como el almacenero es una persona ya mayor y tiene un caracter medio particular (estable emocionalmente) otra persona le tomara foto a sus guias, no queremos forzarlo.
> - cuando el sistema esta caido normalmente se pide al cliente que deje sus datos telefono, ruc/dni tipo de doc que quiere para que una vez recuperado se le envie el comprobante (eso he visto que hacen)
> - no me referia a tener 2 proveedores de facturación sino 2 apis de gemini.
> - el correlativo habra que verlo revisando la documentación de Factpro
> - el administrador deberia poder configurar el porcentaje bajo el cual se activaria la alerta de mercaderia por default podriamos dejar en 10%.
> - las sugerencias lo dejamos por ahora
> - si SuitPay debe exigir los datos del cliente al superar ese umbral.
> - la cotización guardada debe quedar guardad en al base de datos, haciendolo accesible en cualquier dispositivo.
> - el tema la idenpotencia te lo dejo a ti analisis.

## Restated

Se propone construir SuitPay, un sistema de facturación accesible desde el navegador en escritorio y móvil que reemplace el sistema de escritorio alojado en una VM que hoy usa una empresa distribuidora de grifería y gasfitería en Perú. El sistema concentraría la operación del vendedor en una sola pantalla, donde una única "lista base" de pedido puede convertirse en distintos documentos de venta, y donde entradas por voz, búsqueda por texto y fotografía —procesadas con modelos multimodales de Gemini vía Google AI Studio— aceleran la captura de pedidos, dejando siempre la aprobación final del documento en manos del vendedor.

La emisión de los comprobantes ante SUNAT no la asumiría SuitPay directamente, sino que se delegaría en un proveedor externo —Factpro como primera opción— detrás de una capa que permita sustituirlo por otro sin rehacer el sistema. Cuando los datos dictados o tecleados por el vendedor resulten ambiguos, un "modal de contexto" transversal se encarga de resolver la ambigüedad presentando las coincidencias para que el vendedor elija.

## Origin & Context

- **Raised by**: el dueño de la empresa distribuidora encargó explícitamente la creación del sistema. El autor del volcado (desarrollador) recopiló las experiencias y quejas del personal y analizó el sistema actual.
- **Trigger**: un sistema heredado que "no ha mejorado con el tiempo" acumuló quejas del personal. Fricciones concretas citadas: el sistema está anclado a máquinas físicas, por lo que nadie puede operar hasta que llega la encargada con las credenciales —mientras personal y clientes esperan en la puerta—; la generación de documentos está dispersa entre varias páginas y las guías requieren varios pasos intermedios; el buscador de productos no encuentra coincidencias si los términos no van en el orden exacto; y dar de alta un cliente nuevo por RUC obliga a salir del flujo de venta hacia un modal dedicado.
- **Disposición al cambio**: el dueño está dispuesto a migrar del sistema actual si el nuevo demuestra ser efectivo.
- **Alcance declarado**: el sistema actual cubre facturación y contabilidad; este esfuerzo se limita por ahora a facturación. Contabilidad queda fuera por falta de datos: no ha habido interacción con el contador.

## Elementos capturados

Registrados aquí sin evaluar, para que las etapas siguientes los pesen:

- **Una sola ventana**: el objetivo transversal es que el vendedor haga todo lo posible sin navegar entre pantallas.
- **Tres puntos de entrada equivalentes** en la pantalla de inicio del vendedor (audio, buscador, cámara), los tres con la misma tarea inicial: construir la lista de pedido.
- **Lista base moldeable**: un mismo pedido se convierte en boleta, factura, nota de venta, o factura + guía.
- **Captura por cámara**: fotografía de guías manuales, extracción de texto por el modelo, render del boceto con edición inline y un segundo paso explícito para el emparejamiento con el catálogo.
- **Emparejamiento en dos etapas**: prefiltrado local con fuse.js (o equivalente) sobre un catálogo de ~500 productos, y envío únicamente del lote filtrado al modelo para que haga el match, en lugar de enviar el catálogo completo.
- **Revisión estilo diff de IDE**: el texto extraído en crudo se marca sobre fondo rojo y las sugerencias de producto en verde (una o varias por ítem), para que el vendedor contraste original contra sugerencia.
- **"Tools" / comandos**: instrucciones en lenguaje natural por voz y comandos con `/` en el buscador (referencia explícita al patrón de comandos de Cursor) que el modelo traduce a un JSON de instrucciones que el sistema ejecuta. Ejemplos citados: consultar las últimas facturas de un cliente; `/eliminar boleta xx-xxxx`. El conjunto completo de tools está por definir.
- **Alta de cliente en contexto**: al teclear un RUC no registrado, ofrecer un botón "agregar" en el mismo lugar, sin salir del flujo.
- **Sesión persistente**: login una sola vez con revalidación silenciosa posterior, en lugar de credenciales en cada sesión.
- **Restricción no negociable declarada**: la IA asiste y precarga, pero la aprobación y la responsabilidad de emitir cualquier documento recaen siempre en el vendedor.
- **Preferencia técnica anticipada**: arquitectura de servicios web para cubrir escritorio y móvil con una sola base; la empresa cuenta con buen servicio de internet.

### Añadido en el volcado 2

- **Flujo de venta actual, de principio a fin**: el cliente se acerca al mostrador, el vendedor toma el pedido, confirma el tipo de documento, lo genera, cobra, y solo después va a sacar la mercadería del almacén.
- **Emisión delegada y sustituible**: la emisión de comprobantes se delega en un proveedor externo. Factpro es la primera opción, pero la elección aún está en análisis y el autor exige explícitamente que cambiar de proveedor sea fácil.
- **Consulta de RUC y DNI**: el mismo proveedor (Factpro) expone consulta por RUC y DNI, que alimentaría la extracción de datos del cliente.
- **"Modal de contexto" como pieza central**: componente transversal para resolver los pasos intermedios cuando la entrada del vendedor —hablada o tecleada— es imprecisa o ambigua. Ejemplo dado: se dicta una razón social que coincide con varios clientes y el modal presenta las opciones para que el vendedor seleccione. El autor señala que la idea está en formación y se irá refinando.
- **Comando `/guia` con placeholder de campos**: para la guía de remisión, el vendedor introduce los datos por comando o por voz. Los campos citados como placeholder son `{n° de cotización}`, `{transportista}`, `{cliente (RUC o razón social)}` y `{doc (fact o boleta)}`.
- **Anulación de comprobantes**: "eliminar" significa anular. Hoy anulan boletas indicando tipo de documento, serie y número, con el motivo "ERROR DE IMPRESIÓN", que es lo que el autor observó que hacen en la práctica.
- **Panel de administrador/contador**: donde se configuran los usuarios vendedores y sus series de comprobantes.
- **Concurrencia**: el autor plantea explícitamente que hay que manejar condiciones de carrera y claves de idempotencia.
- **Roles**: vendedor, administrador/contador y jefe (nombre del tercer rol aún por definir).
- **Inventario**: emitir un documento debe descontar existencias.
- **Precios**: el precio base del catálogo es el precio mayorista y ya incluye IGV. Cada vendedor puede negociar individualmente el precio minorista tomando el base como referencia.
- **Límite de datos enviados a la IA**: a Gemini se enviarían únicamente datos de productos, nunca datos de clientes.
- **Migración de datos**: la carga inicial de productos y clientes debe poder procesarse desde JSON y desde documentos PDF.
- **Impresión en dos formatos**: hoy usan impresoras A4; el hijo del dueño quiere migrar a impresoras de rollo (térmicas / ticketeras) por costo y porque gastar una hoja A4 en un documento de un solo producto es desperdicio. Deben soportarse ambos formatos.
- **Contingencia de conectividad**: si el router cae por corte de energía, pueden trabajar con el wifi de los teléfonos de la empresa. El autor reconoce no haber pensado todavía en la caída de Gemini.
- **Fuera de alcance por ahora**: medios de pago, ventas al crédito y cobranzas, además de contabilidad.
- **Sin app nativa**: navegador en escritorio y móvil.
- **Criterio de éxito del dueño**: que sus vendedores le digan que el sistema es efectivo. El autor lo describe como una persona sensata y tranquila, y toma la satisfacción de los vendedores como la señal de que van por buen camino.

### Añadido en el volcado 3

- **Cotizaciones = pedidos guardados**: un pedido en espera de confirmación o cancelación. Llevan número propio para identificarlas y poder ordenar por texto o voz que se conviertan en factura, boleta o guía.
- **Cola de documentos pendientes**: si el proveedor de emisión cae, el sistema guardaría la información de los documentos en un estado de espera y los enviaría todos al recuperarse el servicio. El autor plantea además la posibilidad de trabajar con dos APIs de proveedores distintos, una como contingencia de la otra.
- **Capa multi-proveedor completa**: debe cubrir todas las operaciones — emisión, anulación, consulta de RUC/DNI, notas de crédito y GRE.
- **Los dos usos reales de las guías manuales en papel**:
  1. Un trabajador con rol de almacenero que también atiende como vendedor cuando hace falta y no maneja la computadora, así que toma sus pedidos en papel.
  2. Anotar los pedidos de los "vecinos": al ser un centro mayorista y estar la empresa bien posicionada, comerciantes vecinos vienen a pedir mercadería; los vendedores los apuntan, por la tarde les sacan la cuenta y les envían una foto para que paguen.
- **Las "otras herramientas dedicadas" ya existen, pero en otro proyecto**: están construidas dentro de la tienda virtual de la misma empresa, y permiten tomar pedidos de los vecinos por audio o buscador y procesar las guías manuales por foto. El autor declara un dilema abierto: exponerlas mediante una API de comunicación entre proyectos, o migrar esas funciones a SuitPay.
- **Escala**: 5 vendedores y 5 puestos concurrentes. Cada vendedor tiene su propia serie de comprobantes.
- **Rol jefe**: como función esencial, ver qué mercadería se está agotando. En esa misma página, los vendedores deben poder enviar sugerencias de qué comprar y qué no comprar.
- **Convivencia con el sistema actual**: probablemente coexistan hasta terminar las pruebas, de forma aislada y sin ninguna sincronización entre ambos.
- **Anulación**: la empresa conoce los plazos para usar "ERROR DE IMPRESIÓN" y sabe que, vencidos, corresponde nota de crédito. Tanto el vendedor como el administrador pueden ejecutar ambas operaciones.
- **Impresión solo en escritorio**: el móvil se destina a operar, no a imprimir. En móvil la salida es un PDF del comprobante que se envía al cliente por WhatsApp.
- **Precio negociado sin validación**: el precio base/mayorista se muestra con edición inline y el vendedor lo cambia con total libertad; no hay pisos ni autorizaciones.
- **Inventario a cargo del administrador/contador.**
- **Datos para emitir**: tipo de documento, cliente o "cliente eventual" (opción por defecto), el pedido, el medio de pago y el monto recibido. El medio de pago es meramente referencial: en la práctica se elige efectivo casi siempre y no se exige registrar tarjeta o Yape.
- **Modal de contexto como herramienta del modelo**: el LM lo invoca cuando falta un dato, cuando hay varias coincidencias para un dato, o cuando necesita aclarar algo. En el buscador cumple la misma función cuando un comando exige varios parámetros y no se ingresaron. El autor lo describe como una salvaguarda que complementa el flujo, no como una pantalla más.
- **Persistencia local del pedido en curso**: la lista debe sobrevivir a una pérdida de conexión y al cambio de wifi a ethernet. Ante cambio de dispositivo, el autor acepta empezar el pedido de cero.

### Añadido en el volcado 4

- **SuitPay como fuente de verdad**: el catálogo de productos se migra una vez desde la tienda virtual (vía JSON o PDF) y a partir de ahí SuitPay manda.
- **Stack de la tienda virtual**: React + Vite + TypeScript + Firebase. Es el proyecto donde ya viven las herramientas de captura por audio y por foto.
- **El canal de los vecinos sí se factura**: los vecinos también son mayoristas. Al efectuar el pago —el mismo día al cierre, o en los días siguientes— se les envía su factura. La regla que da el autor es simple: se factura cuando pagan.
- **El almacenero se queda en papel a propósito**: es una persona mayor y de carácter particular, y la decisión explícita es no forzarlo a cambiar. Otra persona fotografiará sus guías.
- **Práctica actual ante caída del sistema**: se le piden al cliente sus datos (teléfono, RUC o DNI, y el tipo de documento que desea) para enviarle el comprobante cuando el servicio se recupere.
- **Corrección sobre la doble API**: las dos APIs de contingencia son de Gemini, no de proveedores de facturación. El esquema de proveedor de emisión sigue siendo uno solo con cola de pendientes.
- **Alerta de stock configurable**: el administrador define el porcentaje que dispara la alerta de mercadería por agotarse, con 10% como valor por defecto propuesto.
- **Sugerencias de compra postergadas**: quedan fuera de esta primera versión.
- **Umbral del cliente eventual**: SuitPay debe exigir los datos del cliente cuando la venta supere el importe que obliga a identificarlo.
- **Cotizaciones en base de datos**: a diferencia del pedido en curso (local), la cotización guardada se persiste en el servidor y queda accesible desde cualquier dispositivo.
- **Correlativo pendiente de investigación**: el autor delega la respuesta a la revisión de la documentación de Factpro.
- **Idempotencia delegada**: el autor deja el análisis del mecanismo al criterio técnico, para resolver en la etapa de diseño.

## Idea (as captured) — Volcado 5

> - En términos de UI vamos a agregar un sidebar lateral entre las menus por ahora tendremos nuestra pagina de inicio (la que ya tenemos construida) y un item de configuración, moveremos el nombre de la plataforma del header al sidebar SuitPay, debajo agregaremos el perfil de usuario con un boton de logout (analizar si es conveniente dejar el perfil de usuario en la parte superior o en la parte inferior)
> - En la sesión de ayer se estaba suponiendo que podiamos nosotros generar el numero del documento es decir seria-###, pero revisando ahora esto no es así, se pueden configurar las series pero tambien te pide el numero de accion desde el cual va a empezar generar los documentos, por ejemplo para que empiece desde el 0 o desde el 100 -> F001-0 O F002-100
> - Tambien quiero un cambio en la UI, quiero cambiar el estilo brutalista de los componentes por componentes con bordes suaves: pivote de dirección de arte de "Brutalista" a "Modern Soft-Pill UI". Actualizar DESIGN.md con reglas absolutas: purgar rounded-none/rounded-sm y esquinas afiladas; botones/badges/controles interactivos en cápsula (rounded-full); tarjetas/contenedores mayores con radios amplios (rounded-2xl o rounded-3xl); purgar bordes gruesos (border-2, border-4, border-black) y sombras sólidas brutales; separación por contraste de color; fondos blancos (bg-white) sobre fondos de aplicación gris claro (bg-gray-50 o bg-gray-100); si borde, border border-gray-200; si sombra, shadow-sm o shadow-md con opacidad baja.
> - Ahora para la pagina de inicio (la que tenemos construida) quiero hacer un cambio, ya no quiero que se concentre solo en el centro el contenido, quiero que use todo el espacio y quitar ese color medio amarillento del fondo, trabajaremos en capas/tonos de gris o blanco para el fondo.
> - ademas quiero tabs internos: Pedido | Cotizaciones | Vecinos | Lista
> - Ademas el tipo de documento por default que este configurado debe ser Nota de Venta.
> - Ayer nos quedaron pendientes tareas porque faltaban algunos datos: API del proveedor de emisión [REDACTED — no persistir; rotar si quedó expuesto en chat]; rutas de documentación: estructura para generar facturas, nota de crédito, nota de débito, guías remitente (docs.factpro.la/api-facturacion-v3/…).
> - Datos de configuración del proyecto de Firebase [REDACTED apiKey y demás secretos del cliente]: projectId blayblocklabs-antrax; authDomain blayblocklabs-antrax.firebaseapp.com; storageBucket blayblocklabs-antrax.firebasestorage.app; measurementId presente. Almacenar en env / consola, no en este artefacto.
> - Dominio/site para despliegue Hosting: site "suitpay".
>
> Confirmaciones de la misma sesión: (1) proceder documentando por Speckit antes de codificar; (2) perfil de usuario + logout al **pie** del sidebar.

**Nota del registro**: se redactaron el token de API del proveedor y el bloque completo de `firebaseConfig` (incl. `apiKey`). El autor debe rotar el token expuesto en el chat y colocar credenciales solo en Secret Manager / `.env.local` (fuera del repo).

## Restated

*(sin cambio de fondo; el volcado 5 no redefine el problema, enmienda shell, dirección visual, numeración de series y defaults de documento.)*

## Origin & Context

*(heredado de volcados 1–4; el volcado 5 lo aporta el mismo autor en sesión del 2026-07-29, tras el go del assessment y con implementación parcial de la feature 001.)*

## Elementos capturados

### Añadido en el volcado 5

- **Shell con sidebar**: navegación lateral con, por ahora, Inicio (mostrador ya construido) y Configuración. La marca **SuitPay** pasa del header al sidebar. Perfil de usuario con logout: decisión confirmada **al pie** del sidebar (marca arriba, nav en medio, perfil abajo).
- **Pivote de arte Modern Soft-Pill**: sustituye el estilo brutalista / papel cálido / radio cero. Cápsulas en controles interactivos; radios amplios en tarjetas; elevación suave; contraste blanco sobre gris claro.
- **Mostrador full-bleed**: el contenido usa todo el espacio; se elimina el fondo amarillento/kraft; capas de gris o blanco.
- **Tabs internos del mostrador**: Pedido | Cotizaciones | Vecinos | Lista.
- **Tipo de documento por defecto**: Nota de Venta.
- **Series con número inicial**: al configurar una serie se indica desde qué número empezar a emitir (ej. `F001` desde 0 → `F001-0`; `F002` desde 100 → `F002-100`). Corrige la suposición de que SuitPay inventaba el correlativo sin origen configurado.
- **Infra operativa (sin secretos)**: proyecto Firebase `blayblocklabs-antrax`; site Hosting `suitpay`; documentación del proveedor de emisión para factura, nota de crédito, nota de débito y GRE remitente; credencial de API disponible para el entorno de demostración (almacenamiento fuera del repo).

## Resueltas durante el intake

- **Jurisdicción**: Perú, autoridad tributaria SUNAT. Esto fija el marco de comprobantes de pago electrónicos (CPE) y hace que los cuatro documentos citados por el autor no sean equivalentes entre sí — factura, boleta de venta y guía de remisión son comprobantes regulados por SUNAT, mientras que la nota de venta es un documento interno sin valor tributario.
- **Modalidad de emisión**: se delega en un proveedor externo, con Factpro como primera opción y el requisito explícito de poder sustituirlo. En consecuencia, el certificado digital, la firma del XML y el diálogo con SUNAT quedan del lado del proveedor.
- **Significado de "eliminar"**: anular el comprobante. El procedimiento observado hoy consiste en indicar tipo de documento, serie y número, con el motivo "ERROR DE IMPRESIÓN".
- **Origen de los datos de la guía de remisión**: los introduce el vendedor, por voz o mediante el comando `/guia` con los campos `{n° de cotización}`, `{transportista}`, `{cliente}` y `{doc}`.
- **Alta de cliente por RUC**: los datos se obtienen consultando por RUC o DNI a través del proveedor (Factpro).
- **IGV y precios**: el precio base del catálogo es mayorista y ya incluye IGV; el vendedor negocia el minorista sobre esa referencia.
- **Roles**: vendedor, administrador/contador y jefe.
- **Inventario**: emitir un documento descuenta existencias.
- **Datos enviados a la IA**: solo datos de productos; ningún dato de clientes.
- **Migración de datos**: debe aceptar JSON y PDF para productos y clientes.
- **Impresión**: soporte obligatorio para A4 (uso actual) y para impresoras de rollo (destino deseado).
- **Nomenclatura del catálogo**: los nombres están bien definidos e incorporan material y medida (`codo fg de 1/2`, `codo de pvc 1/2`), además de marca.
- **Alcance excluido por ahora**: contabilidad, medios de pago, ventas al crédito y cobranzas.
- **Plataforma**: navegador en escritorio y móvil, sin aplicación nativa.
- **Criterio de éxito del dueño**: la satisfacción declarada de los vendedores.
- **Escala y series**: 5 vendedores en 5 puestos concurrentes, cada uno con su propia serie de comprobantes.
- **Cotizaciones**: son pedidos guardados en espera, con número propio, convertibles a cualquier documento por orden de texto o voz.
- **Usos de las guías manuales**: las toma el almacenero que no maneja computadora, y sirven para anotar los pedidos de los comerciantes vecinos.
- **"Otras herramientas dedicadas"**: ya existen, construidas dentro del proyecto de la tienda virtual de la empresa.
- **Alcance de la capa multi-proveedor**: todas las operaciones (emisión, anulación, consulta RUC/DNI, notas de crédito, GRE).
- **Anulación**: la empresa domina los plazos; vencidos, emiten nota de crédito. Vendedor y administrador pueden ejecutar ambas.
- **Impresión**: exclusivamente desde escritorio. En móvil, PDF enviado por WhatsApp.
- **Precio negociado**: arbitrario y sin validación, editable inline sobre el precio base.
- **Inventario**: lo mantiene el administrador/contador.
- **Cobro**: se registran medio de pago y monto recibido, ambos referenciales; en la práctica siempre efectivo.
- **Modal de contexto**: es una herramienta que el modelo invoca ante datos faltantes, ambiguos o dudosos, y que el buscador reutiliza cuando un comando queda incompleto.
- **Pedido en curso**: se guarda en estado local para sobrevivir a cortes de red y cambios de wifi/ethernet. Cambiar de dispositivo implica rehacer el pedido.
- **Convivencia**: sistema actual y SuitPay coexistirán aislados durante las pruebas, sin sincronización.
- **Fuente de verdad**: SuitPay. El catálogo se migra una vez desde la tienda virtual (React + Vite + TypeScript + Firebase).
- **Facturación a los vecinos**: se emite factura en el momento del pago, sea al cierre del día o días después. Los vecinos son mayoristas.
- **El almacenero sigue en papel**: decisión deliberada; otra persona fotografía sus guías.
- **Contingencia de IA**: dos APIs de Gemini, una como respaldo de la otra. El proveedor de emisión sigue siendo uno solo, con cola de pendientes.
- **Alerta de stock**: porcentaje configurable por el administrador, 10% por defecto.
- **Sugerencias de compra**: fuera del alcance de la primera versión.
- **Cliente eventual**: se exigirán los datos del cliente al superar el umbral que obliga a identificarlo.
- **Cotizaciones**: persistidas en base de datos y accesibles desde cualquier dispositivo, a diferencia del pedido en curso.
- **Práctica ante caída del servicio**: se recogen teléfono, RUC/DNI y tipo de documento deseado para enviar el comprobante al restablecerse.
- **Shell**: sidebar con Inicio y Configuración; marca SuitPay en el sidebar; perfil + logout al pie.
- **Dirección visual**: Modern Soft-Pill (cápsulas, radios amplios, grises/blancos, sombras suaves); se abandona el brutalismo / papel cálido como norte.
- **Mostrador**: contenido a todo el ancho; tabs Pedido | Cotizaciones | Vecinos | Lista.
- **Default de documento**: Nota de Venta.
- **Origen del correlativo**: las series se configuran con un número de arranque (ej. 0 o 100); SuitPay debe alinear su contador a ese origen. Queda por comprobar en demo si el proveedor respeta un número explícito en la emisión (tarea T027 / research).
- **Proyecto Firebase y Hosting**: `blayblocklabs-antrax`, site `suitpay`.

## First-Glance Unknowns

Heredadas y aún abiertas:

- [NEEDS CLARIFICATION: presupuesto y tolerancia a costos y latencia de las llamadas al modelo por cada pedido capturado.]
- [NEEDS CLARIFICATION: cómo se desglosa el IGV y cómo se redondea. Los precios se manejan con IGV incluido, pero un comprobante electrónico exige valor unitario sin IGV, base imponible e IGV por línea y totales que cuadren; al partir del precio con impuesto incluido, el redondeo por línea puede desviar el total y provocar rechazos. **El autor lo dejó pendiente de consulta con el contador.** La API del proveedor acepta `incluye_tax: true` (research), lo que reduce el riesgo operativo, pero la postura del contador sigue abierta.]
- ~~[NEEDS CLARIFICATION: el correlativo…]~~ **Enmendado en volcado 5**: el origen del contador es el número inicial configurado en la serie; SuitPay reclama y envía el siguiente número. Persiste la comprobación en demo de que el proveedor respete el número explícito y qué responde ante uno ya usado.
- [NEEDS CLARIFICATION: qué se entrega al cliente en el momento cuando el proveedor de emisión está caído. La práctica actual —recoger sus datos y enviarle el comprobante después— resuelve el después, pero el cliente paga y se lleva la mercadería en ese instante. ¿Se va sin nada, con un documento interno, o se retiene la venta?]
- ~~[NEEDS CLARIFICATION: idempotencia…]~~ **Delegada y resuelta en diseño** (clave de idempotencia = id del comprobante; ver `specs/001-mostrador-asistido/research.md`). Se mantiene como decisión de implementación, no como incógnita de intake.

Nuevas, surgidas del volcado 4:

- [NEEDS CLARIFICATION: qué pasa con la tienda virtual después de la migración. Si SuitPay es la fuente de verdad pero la tienda sigue vendiendo, necesita leer catálogo y stock desde SuitPay; una migración única por JSON o PDF no mantiene eso alineado. ¿La tienda seguirá operando, y si sí, cómo se alimenta?]
- [NEEDS CLARIFICATION: las herramientas de audio y foto ya construidas en la tienda virtual, ¿se migran a SuitPay o se consumen mediante API? El autor confirmó la fuente de verdad y el stack, pero no resolvió este dilema que él mismo planteó. Que ambos proyectos compartan stack lo hace plausible, pero es una decisión pendiente.]
- [NEEDS CLARIFICATION: si un vecino paga días después, entre el pedido y el pago existe un saldo pendiente. ¿La cotización guardada cumple la función de registrar lo que debe, o hace falta un estado explícito de deuda por vecino con su antigüedad?]
- [NEEDS CLARIFICATION: el 10% de la alerta de stock, ¿porcentaje respecto a qué? Necesita una base de cálculo: el stock máximo histórico, la última compra, el promedio de rotación o un mínimo fijado por producto.]
- [NEEDS CLARIFICATION: dos APIs de Gemini protegen contra el agotamiento de cuota o el límite de solicitudes, pero no contra una caída del servicio, que afectaría a ambas por igual. ¿Qué debe poder hacer el vendedor si la IA no responde en absoluto — bastaría con el buscador local, que no depende del modelo?]
- [NEEDS CLARIFICATION: cuando se factura a un vecino al momento del pago, la fecha de emisión cae días después de la entrega de la mercadería. ¿Es así como opera hoy y el contador lo valida, o la venta y la entrega deben quedar documentadas en su momento con otro documento?]

Nuevas, surgidas del volcado 5:

- [NEEDS CLARIFICATION: qué contiene exactamente el tab **Lista** del mostrador — ¿lista de productos, historial de comprobantes del día, u otra cosa?]
- [NEEDS CLARIFICATION: la pantalla **Configuración**, ¿es solo para administrador/contador (series, usuarios, parámetros) o el vendedor también entra a ajustar preferencias propias?]

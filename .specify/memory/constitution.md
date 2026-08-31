<!--
SYNC IMPACT REPORT
==================
Version change: 1.1.0 → 1.2.0
Bump rationale: MINOR. Se amplía el principio IV: el catálogo compacto
(código, nombre, alias y etiquetas de asistencia), las notas de instrucción
sin identidad, y los medios de Cotizar (PDF, imagen, texto) MAY enviarse al
modelo. La colección `clientes` sigue prohibida. Aprobado por el dueño al
pedir emparejado semántico y aprendizaje diferido (spec 005).

Principios modificados:
  IV.  Los datos de clientes no salen hacia servicios de IA — excepciones
       acotadas: medios de Cotizar, catálogo compacto, notas anónimas, lote
       de aprendizaje (pares + memoria de productos, sin PII).

Secciones añadidas: ninguna.
Plantillas: sin cambio estructural. Spec `005`.

TODO diferidos: ninguno.
-->

<!--
SYNC IMPACT REPORT (histórico)
==================
Version change: TEMPLATE (sin ratificar) → 1.0.0
Bump rationale: MINOR no aplica; es la ratificación inicial. Se pasa de una plantilla con
marcadores sin rellenar a una constitución con seis principios concretos, dos secciones de
restricciones y una sección de gobernanza. Versión inicial 1.0.0.

Principios añadidos (ninguno modificado ni eliminado, no había versión previa):
  I.   La aprobación humana es indelegable (NO NEGOCIABLE)
  II.  Ninguna venta se documenta dos veces (NO NEGOCIABLE)
  III. El proveedor de emisión es sustituible
  IV.  Los datos de clientes no salen hacia servicios de IA (NO NEGOCIABLE)
  V.   El mostrador no se detiene
  VI.  Lo que no se mide no se declara mejorado

Secciones añadidas:
  - Restricciones del Dominio y la Plataforma (SECTION_2)
  - Disciplina de Desarrollo y Puertas de Calidad (SECTION_3)
  - Governance

Origen: derivada de los artefactos del assessment en
.specify/assessments/sistema-facturacion/ (intake, research, problem, concept, decision).
El veredicto `go` marcó el encaje estratégico como `unknown` precisamente porque esta
constitución no existía; esta ratificación cierra ese hueco.

Plantillas y artefactos dependientes:
  ✅ .specify/templates/plan-template.md — sección "Constitution Check" concretada con las
     seis puertas derivadas de estos principios (antes era un marcador genérico)
  ✅ .specify/templates/spec-template.md — revisado; su estructura de requisitos, criterios
     de éxito y supuestos es compatible sin cambios
  ✅ .specify/templates/tasks-template.md — revisado; su categorización de tareas admite los
     tipos que estos principios exigen sin cambios estructurales
  ✅ .cursor/rules/specify-rules.mdc — es el archivo de guía en tiempo de ejecución y se
     regenera mediante la extensión agent-context; no requiere edición manual aquí

TODO diferidos: ninguno. No quedan marcadores sin resolver.
-->

# Constitución de SuitPay

SuitPay es el sistema de facturación de una distribuidora mayorista de grifería y gasfitería
que opera en Perú, bajo el régimen de comprobantes de pago electrónicos de SUNAT. Sustituye a
un sistema de escritorio que lleva años en producción. Esta constitución fija las reglas que
ninguna especificación, plan o implementación puede contradecir sin una enmienda documentada.

## Core Principles

### I. La aprobación humana es indelegable (NO NEGOCIABLE)

Ningún documento con efecto tributario o contable se emite sin que un vendedor identificado lo
haya revisado y confirmado de forma explícita. La asistencia automática precarga, propone y
ordena el trabajo; nunca decide.

- Ninguna orden en lenguaje natural —dictada por voz o escrita como comando— puede por sí sola
  crear, modificar, anular o dar de baja un comprobante. Las órdenes en lenguaje natural que
  producen efectos irreversibles MUST resolverse en una propuesta que el vendedor confirma.
- Todo dato propuesto por un modelo MUST mostrarse de forma que el vendedor pueda compararlo con
  el original antes de aceptarlo.
- Toda emisión MUST quedar atribuida al vendedor que la aprobó.

**Razón**: la responsabilidad legal de lo emitido recae en la empresa y, operativamente, en la
persona que atiende. Fue la primera restricción que el negocio impuso y es la que sostiene la
confianza en todo lo demás.

### II. Ninguna venta se documenta dos veces (NO NEGOCIABLE)

Un mismo pedido no puede producir dos comprobantes, sin importar cuántas veces se pulse el
botón, desde cuántos dispositivos se intente o cómo falle la red.

- Toda operación que produce un documento MUST ser idempotente respecto a la intención del
  vendedor, no respecto a la petición técnica.
- Ante una respuesta que no llega, el sistema MUST poder determinar si la emisión ocurrió antes
  de volver a intentarlo. Reintentar a ciegas está prohibido.
- El registro de una emisión en curso MUST escribirse antes de invocar al proveedor, nunca
  después.
- Un pedido ya convertido en comprobante MUST quedar cerrado a nuevas conversiones.

**Razón**: un duplicado consume un correlativo, obliga a anular ante SUNAT y produce un
documento que el cliente no pidió. Es el único riesgo grave que introduce este sistema y que no
existía en el anterior.

### III. El proveedor de emisión es sustituible

La emisión de comprobantes electrónicos se delega en un tercero que aún no está decidido de
forma definitiva. El sistema MUST poder cambiarlo sin reescribir la lógica de venta.

- Toda interacción con el proveedor MUST ocurrir detrás de una frontera propia que cubra
  emisión, anulación, notas de crédito, guías de remisión y consulta de contribuyentes.
- Ningún concepto del proveedor —nombres de campos, códigos propios, formas de respuesta,
  rutas— MUST filtrarse hacia el resto del sistema.
- Las particularidades del proveedor MUST quedar aisladas y documentadas en un solo lugar.

**Razón**: Factpro es la primera opción, no una decisión cerrada. El coste de esta frontera se
paga una vez; el de no tenerla se paga entero el día que haya que cambiar.

### IV. Los datos de clientes no salen hacia servicios de IA (NO NEGOCIABLE)

A los servicios de inteligencia automática solo se envían datos de productos y el contenido que
el vendedor produce para describir un pedido: su voz, su texto, o la fotografía de una guía
manual.

**Excepción (v1.1.0, ampliada v1.2.0).** El medio que el vendedor aporta en Cotizar —PDF,
imagen o texto pegado— MAY enviarse al modelo (el membrete puede viajar en el archivo). Audio y
fotografía del pedido siguen siendo contenido que produce el vendedor.

**Catálogo compacto (v1.2.0).** En cotizar, fotografía y dictado MAY enviarse un catálogo
minimizado `{ id, n, a[], e[] }` (código, nombre, alias y etiquetas de asistencia). MUST NOT
enviarse precio, stock, ni la colección `clientes`. La búsqueda escrita del mostrador MUST
seguir siendo local (principio V).

**Notas de instrucción (v1.2.0).** El texto de las notas que el vendedor escribe sobre un
cliente MAY enviarse, sin RUC, DNI, razón social, teléfono ni historial. El servidor MUST
anonimizar dígitos de documento antes de incluirlas.

**Lote de aprendizaje (v1.2.0).** MAY enviarse pares `textoOriginal` + códigos/nombres
aprobados y la memoria de productos vigente (solo alias/etiquetas), con agrupaciones opacas.
MUST NOT enviarse identidad de cliente. El lote MUST NOT escribir `clientes/{id}`; solo
`aprendizaje/memoria`.

El modelo MAY devolver un número de documento y una denominación; la etiqueta que ve el
vendedor MUST resolverse dentro del sistema. El modelo no es la fuente de verdad del cliente.
No se escribe `clientes/{id}` a partir de la respuesta del modelo.

- Razón social, RUC, DNI, dirección, teléfono, correo e historial de compras de un cliente MUST
  NOT enviarse a ningún servicio de inteligencia automática, salvo el contenido propio del
  medio de Cotizar en la función citada.
- Cuando una fotografía o un dictado contenga datos de cliente, la resolución de la identidad
  del cliente MUST ocurrir dentro del sistema, no delegarse al modelo.

**Razón**: decisión explícita del negocio. La excepción del PDF (v1.1.0) y su ampliación a
imagen/texto, catálogo compacto y aprendizaje (v1.2.0) las pidió el mismo dueño: sin visión
del requerimiento y sin matching semántico, la cotización no entra al mostrador.

### V. El mostrador no se detiene

La caída de un servicio externo degrada capacidades; nunca bloquea una venta.

- Si la asistencia automática no responde, el vendedor MUST poder completar la venta escribiendo.
  La búsqueda de productos MUST NOT depender de un servicio externo.
- Si el proveedor de emisión no responde, la venta MUST poder registrarse y quedar en espera, y
  el sistema MUST conservar qué se le prometió al cliente y cómo contactarlo.
- El pedido en curso MUST sobrevivir a una pérdida de conexión y a un cambio de red en el mismo
  dispositivo.
- Toda degradación MUST ser visible para el vendedor. Un sistema que finge normalidad mientras
  opera degradado es peor que uno que falla.

**Razón**: el sistema que se reemplaza funciona sin depender de servicios externos. Retroceder en
disponibilidad sería un cambio a peor, por muchas capacidades que se ganen.

### VI. Lo que no se mide no se declara mejorado

Ninguna afirmación de mejora se sostiene sin una línea base medida.

- Antes de dar por buena una mejora de rapidez, exactitud o esfuerzo, MUST existir una medición
  previa —del sistema anterior o de una versión previa de SuitPay— contra la cual comparar.
- Las señales cualitativas, como la preferencia declarada por los vendedores, MUST etiquetarse
  como tales y MUST NOT presentarse como evidencia de rendimiento.

**Razón**: el criterio de aceptación del dueño es la percepción de los vendedores. Sin datos, esa
percepción no se puede defender ante una queja ni contrastar con la realidad, y el assessment
identificó la ausencia de líneas base como su debilidad más grave.

## Restricciones del Dominio y la Plataforma

**Régimen documental.** Los comprobantes se rigen por el régimen peruano de comprobantes de pago
electrónicos. La factura, la boleta, la nota de crédito, la nota de débito y la guía de remisión
son documentos regulados. La nota de venta y la cotización son documentos internos sin valor
tributario y MUST distinguirse de los anteriores de forma inequívoca en pantalla y en la
impresión.

**Irreversibilidad.** Un comprobante emitido no se borra. Dentro de plazo se anula; fuera de
plazo se corrige con una nota de crédito. La palabra "eliminar" MUST NOT usarse en la interfaz
para referirse a un comprobante emitido.

**Series y correlativos.** Son recursos escasos, secuenciales y auditables. Cada consumo MUST
quedar trazado, incluidos los consumos fallidos. Cada vendedor opera con series propias.

**Impuesto incluido.** Los precios del catálogo incluyen IGV. El desglose de la base imponible y
el impuesto es responsabilidad del proveedor de emisión y MUST NOT recalcularse por cuenta propia
para construir el comprobante.

**Trazabilidad.** Toda emisión, anulación e intento fallido MUST quedar registrado con su autor,
su momento y su resultado. Un sistema de facturación sin rastro no es auditable, y sin auditoría
no es defendible.

**Plataforma.** Navegador en escritorio y en móvil, sin aplicación nativa. La sesión persiste
entre jornadas y se revalida en segundo plano. La impresión física se limita a los puestos de
escritorio; en móvil la salida es un archivo que se comparte con el cliente.

**Convivencia.** Durante las pruebas, SuitPay y el sistema anterior operan aislados y sin
sincronización. Mientras eso dure, ninguna cifra agregada de SuitPay —en particular el
inventario— MUST presentarse como fiable.

## Disciplina de Desarrollo y Puertas de Calidad

**Pruebas donde importa.** Toda funcionalidad que emita, anule o modifique un documento MUST
tener pruebas antes de llegar a producción, y esas pruebas MUST cubrir explícitamente el
reintento, la respuesta que no llega y el fallo del proveedor. El resto del sistema se prueba con
criterio proporcional al riesgo.

**Nunca estrenar en producción.** El proveedor de emisión ofrece un entorno de demostración. Toda
integración MUST ejercitarse allí antes de tocar el entorno real.

**El assessment es contexto vinculante.** Los artefactos de
`.specify/assessments/sistema-facturacion/` registran el problema, la evidencia, el concepto
elegido y la decisión. Una especificación que los contradiga MUST declarar por qué; el silencio
no es una opción válida.

**Las incógnitas se declaran.** Un requisito que dependa de algo sin resolver MUST marcarse como
tal en lugar de resolverse por suposición. Suponer y no decirlo es la forma más cara de
equivocarse en un sistema con efectos tributarios.

**El alcance excluido permanece excluido.** Lo que `concept.md` declara fuera de alcance no entra
por la puerta de atrás durante la implementación. Incorporarlo requiere una decisión explícita.

## Governance

Esta constitución prevalece sobre cualquier otra práctica, preferencia o costumbre del proyecto.
Ante un conflicto entre esta constitución y una especificación, un plan o una decisión de
implementación, prevalece la constitución.

**Enmiendas.** Toda enmienda MUST documentarse en el informe de impacto de este archivo, con
fecha, motivo y versión. Modificar o retirar un principio marcado NO NEGOCIABLE MUST contar con
la aprobación del dueño del negocio, no solo del equipo técnico.

**Versionado.** Semántico. MAYOR para retirar o redefinir un principio de forma incompatible;
MENOR para añadir un principio o ampliar materialmente una guía; PARCHE para aclaraciones,
redacción y correcciones sin efecto semántico.

**Cumplimiento.** Cada especificación y cada plan MUST verificarse contra estos principios antes
de avanzar de etapa; la sección "Constitution Check" de la plantilla de plan existe para eso. Una
revisión MUST rechazar el trabajo que viole un principio sin enmienda previa.

**Complejidad.** Toda complejidad MUST justificarse frente a la alternativa más simple que se
consideró y se descartó. La plantilla de plan reserva una tabla para ello.

**Guía en tiempo de ejecución.** `.cursor/rules/specify-rules.mdc` es el archivo de contexto del
agente de codificación y se mantiene mediante la extensión `agent-context`.

**Version**: 1.2.0 | **Ratified**: 2026-07-28 | **Last Amended**: 2026-08-29

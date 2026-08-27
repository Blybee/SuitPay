# Contrato — Reglas de acceso a datos

**Feature**: 001-mostrador-asistido | **Fecha**: 2026-07-28

Define quién puede leer y escribir cada colección. Es el contrato que sostiene todo lo demás: sin él, la garantía de no emitir duplicados y la integridad del correlativo serían promesas del cliente en lugar de propiedades del sistema.

## Premisas

**El rol vive en las reivindicaciones del token**, no en un documento consultable. Así las reglas lo evalúan sin lecturas adicionales, lo que además evita que cada comprobación de permiso se facture.

**El backend escribe con privilegios administrativos** y por tanto no está sujeto a estas reglas. Eso es precisamente lo que las hace útiles: todo lo que aquí se prohíbe al cliente solo puede ocurrir a través de una función, donde hay validación, transacción y traza.

**Regla por defecto: negar.** Cualquier colección no enumerada aquí es inaccesible desde el cliente.

## Matriz de acceso

| Colección | Vendedor | Administrador | Jefe | Notas |
|-----------|----------|---------------|------|-------|
| `catalogo/actual` | leer | leer | leer | Escribir solo el backend, al publicar. |
| `indices/clientes` | leer | leer | leer | Escribir solo el backend. |
| `config/parametros` | leer | leer | leer | Escribir solo el backend. |
| `clientes/{id}` | leer, crear | leer, crear, editar | leer | El vendedor crea pero no edita: corregir los datos de un cliente ya registrado es una operación administrativa. |
| `comprobantes/{id}` | **leer** | **leer** | **leer** | **Ningún rol escribe. Nunca.** Solo el backend. |
| `series/{id}` | leer las propias | leer, editar | leer | El contador solo lo toca el backend, en transacción. |
| `cotizaciones/{id}` | leer, crear, editar y **borrar** las pendientes | leer, crear, editar, borrar pendientes | leer | La conversión las borra el backend en la transacción de emisión (FR-019). El cliente puede borrar pendientes tras confirmación en UI (FR-019a). En canal `vecino` se admite `telefonoVecino` y editar `aliasVecino`. |
| `listasRequerimiento/{uid}` | leer, crear, editar, borrar **las propias** | leer, crear, editar, borrar las propias | leer las propias | Lista de requerimiento; TTL 1 semana (`caducaEn`). |
| `capturas/{id}` | leer, crear las propias | leer | — | El estado y las propuestas los escribe el backend. |
| `usuarios/{uid}` | leer el propio | leer, crear, editar | leer | El rol solo lo asigna el administrador, y se propaga al token. |

## Restricciones que las reglas deben imponer explícitamente

**Sobre comprobantes.** Prohibido crear, modificar y borrar desde el cliente, sin excepción y para todos los roles. Es la restricción más importante del sistema. Si un cliente pudiera escribir aquí, podría inventar un número, declarar `aceptado` un documento que nunca se emitió, o saltarse el correlativo. Toda la máquina de estados perdería sentido.

**Sobre el borrado.** Ninguna regla concede borrado de **comprobantes**, series ni config. La anulación es un cambio de estado y la ejecuta el backend. No existe camino para eliminar un comprobante. **Excepción**: las cotizaciones `pendiente` sí pueden borrarse desde el cliente (FR-019a) y desde el backend al emitir (FR-019).

**Sobre las cotizaciones.** El vendedor puede crear, editar y borrar una cotización mientras esté `pendiente`. El único estado vigente es `pendiente` (el documento existe o no). Campos `canal` (`general` \| `vecino`) y, si aplica, `aliasVecino` y `telefonoVecino`. El alias y el teléfono de un vecino sí se pueden editar. No existen campos de “comprobante resultante” ni transición a `convertida`: la protección contra la doble conversión es el **borrado en la misma transacción de emisión**. Cualquier vendedor autorizado puede borrar pendientes de otro (alineado a FR-017).

**Sobre los medios de captura.** En Cloud Storage, cada vendedor escribe y puede borrar solo bajo su propio prefijo. La UI no borra: el lifecycle del bucket caduca audios a 1 día y fotos a 7 días (`docs/CICLO-DE-VIDA-MEDIOS.md`). Acumular audios diarios sin limpieza consumiría más recursos de los necesarios.

**Sobre las series.** El cliente puede leer su serie para saber si la tiene configurada, pero no puede tocar el contador. Escribirlo desde el cliente permitiría reservar o repetir numeración.

**Sobre los usuarios.** Un vendedor solo lee su propio documento y no puede modificar su rol ni reactivarse. La desactivación tiene que ser efectiva (FR-003).

## Validaciones de forma en las reglas

Las reglas comprueban forma, no lógica de negocio. La lógica vive en las funciones, donde puede validarse en serio.

- Al crear un cliente: el identificador del documento coincide con el campo del número de documento, los campos obligatorios están presentes, y `creadoPor` coincide con el usuario autenticado.
- Al crear una cotización: `creadoPor` coincide con el usuario autenticado, el estado inicial es `pendiente`, `canal` es `general` o `vecino`, y si `canal` es `vecino` entonces `aliasVecino` está presente y no vacío.
- Al editar una cotización: el estado sigue siendo `pendiente`, no se altera la autoría ni el `canal`; `aliasVecino` y `telefonoVecino` sí pueden cambiar en canal vecino.
- Al escribir `listasRequerimiento/{uid}`: el id coincide con el vendedor autenticado, `lineas` es un arreglo y `caducaEn` es marca de tiempo.
- Al borrar una cotización: el documento existía en estado `pendiente` (el cliente no “borra” comprobantes disfrazados).
- En toda escritura: se rechazan campos no previstos, para que la forma de los documentos no derive con el tiempo.

## Cómo se verifica este contrato

Las reglas se prueban con el emulador, y las pruebas son obligatorias porque protegen operaciones con efecto tributario. Los casos que no pueden faltar:

- Un vendedor intenta crear un comprobante directamente. **Debe fallar.**
- Un vendedor intenta cambiar el estado de un comprobante a `aceptado`. **Debe fallar.**
- Un vendedor intenta borrar un comprobante. **Debe fallar.**
- Un vendedor intenta incrementar el contador de su serie. **Debe fallar.**
- Un vendedor intenta escribir un campo `comprobanteId` o `estado: convertida` en una cotización. **Debe fallar** (campos no previstos / estado inválido).
- Un vendedor borra una cotización `pendiente` (propia o de otro). **Debe funcionar** (FR-019a / FR-017).
- Un vendedor desactivado intenta cualquier escritura. **Debe fallar.**
- Un vendedor intenta cambiar su propio rol a administrador. **Debe fallar.**
- Un vendedor lee el catálogo, el índice de clientes y los parámetros. **Debe funcionar.**
- Un vendedor crea un cliente nuevo con forma válida. **Debe funcionar.**
- Un vendedor recupera una cotización creada por otro vendedor. **Debe funcionar**, porque FR-017 lo exige.

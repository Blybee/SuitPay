# Importar padrón de clientes y transportistas

## Qué resuelve

El administrador carga en `/administracion/clientes-transporte` el PDF de clientes y el PDF de empresas de transporte. Esas fichas quedan en las mismas colecciones que ya usa la app, así el mostrador reconoce un DNI o RUC y la papeleta de guía ofrece el transportista.

## Reglas

- Solo el rol administrador importa.
- La lectura del PDF es texto (sin modelo de IA). La línea `VENDEDOR:` se ignora.
- Un cliente es un DNI de 8 dígitos o un RUC de 11. Un transportista exige RUC de 11. El resto se descarta. Dentro del archivo, el primer documento gana.
- Si el documento ya existe, no se pisa la denominación ni el autor. Solo se completan dirección y teléfono cuando estaban vacíos.
- La escritura va por lotes. Reimportar el mismo PDF no crea duplicados.
- El índice sigue siendo un solo documento (`indices/clientes`, `indices/transportistas`). Si el siguiente lote no cabe bajo 1 MiB, la importación se detiene.

# Probar el servidor MCP en local

El servidor es un proceso aparte del mostrador. Escucha en `/mcp` con Streamable HTTP y no guarda sesión entre peticiones.

## Arrancar

Desde la raíz del repositorio:

```bash
npm run mcp
```

El proceso escucha en `http://127.0.0.1:8787/mcp`. `PORT` cambia el puerto. Con `MCP_HOST=0.0.0.0` hace falta `MCP_ALLOWED_HOSTS` (hostnames, sin puerto, separados por comas). Si no está, el proceso sale con código 1.

`MCP_ALLOWED_ORIGINS` lista los hostnames de `Origin` que se aceptan. Si el encabezado no viene, la petición pasa. Un `Origin` de otro hostname responde `403`.

## Inspector

En otra terminal:

```bash
npx @modelcontextprotocol/inspector
```

En el inspector elige el transporte Streamable HTTP y la URL `http://127.0.0.1:8787/mcp`. Pulsa Connect y luego List Tools. La lista incluye `ping` y `resumen_ventas`. `ping` no lleva argumentos y responde `{ "pong": true }`. `resumen_ventas` pide `periodo` como `AAAA-MM` (mes civil de Lima). Los montos van en céntimos e incluyen IGV. El top de clientes trae documento y razón social. No trae dirección, teléfono ni correo. Una boleta, factura o nota de venta en estado `indeterminado` no entra en el total, y mientras haya alguna el mes no se guarda.

La misma comprobación, sin abrir el inspector:

```bash
npx @modelcontextprotocol/inspector --cli http://127.0.0.1:8787/mcp --method tools/list
```

## Cloud Run

La imagen se construye con `Dockerfile.mcp`. El servicio previsto es `suitpay-mcp` en `us-central1`, con mínimo 0 y máximo 2 instancias. Este cambio no lo despliega. En el runtime hay que definir `MCP_ALLOWED_HOSTS` con el hostname público del servicio. La cuenta de servicio usa ADC. No hace falta una llave JSON.

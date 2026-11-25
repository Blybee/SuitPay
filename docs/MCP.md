# Probar el servidor MCP en local

El servidor es un proceso aparte del mostrador. Escucha en `/mcp` con Streamable HTTP y no guarda sesión entre peticiones.

## Arrancar

Desde la raíz del repositorio:

```bash
npm run mcp
```

El proceso escucha en `http://127.0.0.1:8787/mcp`. `PORT` cambia el puerto. Con `MCP_HOST=0.0.0.0` hace falta `MCP_ALLOWED_HOSTS` (hostnames, sin puerto, separados por comas). Si no está, el proceso sale con código 1.

`/mcp` exige un Bearer JWT. Sin estas variables el proceso sale con código 1 y el mensaje nombra la variable que falta, no su valor:

- `MCP_JWT_ISSUER`: emisor del token.
- `MCP_JWKS_URL`: URL del JWKS que firma el token.
- `MCP_RESOURCE_URL`: audiencia. Es la URL pública del endpoint, con `/mcp`.

`MCP_UID_CLAIM` dice en qué claim viaja el uid de Firebase. Si no la defines, el servidor lee `firebase_uid`. Ese nombre es un supuesto: WorkOS tiene que copiar ahí el uid, porque `sub` de AuthKit no es el uid de Firebase. `MCP_USUARIO_CACHE_MS` es la caché de la ficha en Firestore. El valor por omisión es 60000.

Tras validar firma, emisor, audiencia y expiración, el servidor lee `usuarios/{uid}` y admite solo `administrador` o `jefe` con `activo: true`. Un `vendedor`, una cuenta inactiva o un uid ausente reciben 403. Un token inválido recibe 401 y `WWW-Authenticate` con `resource_metadata` apuntando a `/.well-known/oauth-protected-resource`. La escritura futura exige el alcance `suitpay.escribir`. `ping` no lo exige.

`MCP_ALLOWED_ORIGINS` lista los hostnames de `Origin` que se aceptan. Si el encabezado no viene, la petición pasa. Un `Origin` de otro hostname responde `403`.

## Inspector

En otra terminal:

```bash
npx @modelcontextprotocol/inspector
```

En el inspector elige el transporte Streamable HTTP y la URL `http://127.0.0.1:8787/mcp`. En el encabezado `Authorization` pon `Bearer` y un JWT firmado por `MCP_JWKS_URL`, con `iss` igual a `MCP_JWT_ISSUER`, `aud` igual a `MCP_RESOURCE_URL` y el uid de Firebase en `firebase_uid` (o en el claim de `MCP_UID_CLAIM`). Ese uid tiene que existir en `usuarios/{uid}` como administrador o jefe activo. Pulsa Connect y luego List Tools. La lista incluye `ping`. Llámala sin argumentos. La respuesta estructurada es `{ "pong": true }`. Sin token, la respuesta es 401.

La misma comprobación, sin abrir el inspector, añadiendo el mismo encabezado con `--header`:

```bash
npx @modelcontextprotocol/inspector --cli http://127.0.0.1:8787/mcp --method tools/list --header "Authorization: Bearer <token>"
```

## Cloud Run

La imagen se construye con `Dockerfile.mcp`. El servicio previsto es `suitpay-mcp` en `us-central1`, con mínimo 0 y máximo 2 instancias. Este cambio no lo despliega. En el runtime hay que definir `MCP_ALLOWED_HOSTS` con el hostname público del servicio. La cuenta de servicio usa ADC. No hace falta una llave JSON.

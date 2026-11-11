/* =============================================================
   Netlify Function · Peluquería Mayka (Los Alcázares)
   Sirve la API del sistema de citas: disponibilidad, reservas,
   panel de gestión y envío del correo.

   Usa la misma lógica que el servidor Node (server/app.js), así que
   el comportamiento es idéntico en los dos entornos.

   Netlify redirige /api/* a esta función (ver netlify.toml).
   ============================================================= */

const { handle } = require('../../server/app');

/* Respuesta estilo Express que devuelve el formato de Netlify. */
function crearRespuesta() {
  const estado = { statusCode: 200, headers: {}, body: '' };
  const res = {
    setHeader(clave, valor) {
      estado.headers[clave] = valor;
    },
    writeHead(codigo, cabeceras) {
      estado.statusCode = codigo;
      Object.assign(estado.headers, cabeceras || {});
    },
    end(datos) {
      if (datos !== undefined && datos !== null) {
        estado.body += typeof datos === 'string' ? datos : String(datos);
      }
    }
  };
  return { res, estado };
}

/* Petición estilo Node a partir del evento de Netlify (formato Lambda). */
function crearPeticion(event) {
  let cuerpo = event.body;
  if (event.isBase64Encoded && typeof cuerpo === 'string') {
    cuerpo = Buffer.from(cuerpo, 'base64').toString('utf8');
  }

  const cabeceras = event.headers || {};
  let url = event.path || event.rawUrl || '/';
  if (event.queryStringParameters && Object.keys(event.queryStringParameters).length) {
    const query = new URLSearchParams(event.queryStringParameters).toString();
    url += '?' + query;
  }

  return {
    method: event.httpMethod || 'GET',
    url,
    headers: cabeceras,
    body: cuerpo
  };
}

/* Netlify Functions v1 (AWS Lambda) */
exports.handler = async (event) => {
  const { res, estado } = crearRespuesta();
  const req = crearPeticion(event);
  await handle(req, res);
  return {
    statusCode: estado.statusCode,
    headers: estado.headers,
    body: estado.body
  };
};

/* Netlify Functions v2 (Request/Response web estándar) */
exports.handlerV2 = async (request) => {
  const { res, estado } = crearRespuesta();
  const url = new URL(request.url);
  const cuerpo = ['GET', 'HEAD'].includes(request.method)
    ? undefined
    : await request.text();

  const req = {
    method: request.method,
    url: url.pathname + url.search,
    headers: Object.fromEntries(request.headers.entries()),
    body: cuerpo
  };

  await handle(req, res);

  return new Response(estado.body || '', {
    status: estado.statusCode,
    headers: estado.headers
  });
};

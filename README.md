# Peluquería Mayka · Los Alcázares (Murcia)

Web oficial con **sistema de citas** para Peluquería Mayka (Avenida Europa nº 5,
Los Narejos, 30710 Los Alcázares, Murcia). Cada cita enviada desde la web llega
automáticamente al correo **miguelmelladoros6@gmail.com**.

---

## 1. Puesta en marcha rápida

```bash
npm install          # instala nodemailer (opcional, sólo para envío por SMTP)
npm start
```

El archivo `.env` ya viene creado y listo. Si prefieres empezar de cero:
`cp .env.example .env` (en Windows: `copy .env.example .env`).

Quedará todo escuchando en:

| Dirección | Uso |
|---|---|
| `http://localhost:3000` | Web pública |
| `http://localhost:3000/admin` | Panel de gestión de citas |
| `http://localhost:3000/admin?token=mayka-2026` | Panel con acceso directo |

> El servidor **no necesita dependencias obligatorias**: funciona sólo con Node 18+.
> `nodemailer` es opcional y sólo se usa para el envío por SMTP.

---

## 2. Configurar el envío de correo (lo importante)

Hay dos formas de que las citas lleguen a `miguelmelladoros6@gmail.com`.
Elige una (la primera es la recomendada).

### Opción A · Gmail por SMTP (recomendada, entrega inmediata)

1. Entra en la cuenta de **miguelmelladoros6@gmail.com** en Google.
2. Ve a **Cuenta de Google → Seguridad → Verificación en 2 pasos** y actívala (es obligatorio
   para poder crear contraseñas de aplicación).
3. En la misma pantalla, entra en **Contraseñas de aplicación → Generar**.
4. Elige la app **"Correo"**, el dispositivo **"Otro"**, ponle nombre (p. ej. `Mayka Web`)
   y copia la contraseña de 16 caracteres.
5. Abre el archivo `.env` y rellena:

```ini
MAIL_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=miguelmelladoros6@gmail.com
SMTP_PASS=aquí_la_contraseña_de_16_caracteres
MAIL_FROM=Peluquería Mayka <miguelmelladoros6@gmail.com>
```

6. Reinicia el servidor. En la consola debe aparecer:
   `Envío: SMTP (smtp.gmail.com)`.

### Opción B · FormSubmit.co (sin configurar nada, 1 clic)

Si no quieres tocar las contraseñas de aplicación, deja `MAIL_MODE=auto` o
`MAIL_MODE=formsubmit` y el servidor enviará por FormSubmit automáticamente.

**Único paso:** la primera cita que envíes hará que FormSubmit te mande un email a
`miguelmelladoros6@gmail.com` con un enlace **«Activate Form»**. Haz clic una sola vez
en ese enlace y desde ese momento todos los correos llegan solos.

El panel de gestión te avisa del estado en la parte superior, y cada cita con el correo
fallido aparece marcada con «correo no enviado».

### Opción C · Desactivado (sólo pruebas)

```ini
MAIL_MODE=off
```

Las citas se guardan en `data/citas.json` pero no se envía ningún email.

---

## 3. Variables de configuración

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor |
| `HOST` | `0.0.0.0` | Interfaz de escucha |
| `TZ` | `Europe/Madrid` | Zona horaria del negocio |
| `SHOP_EMAIL` | `miguelmelladoros6@gmail.com` | Destino de las citas |
| `MAIL_MODE` | `auto` | `smtp` · `formsubmit` · `auto` · `off` |
| `MAIL_CLIENT_COPY` | `true` | Envía copia de confirmación al cliente (sólo a dominios habituales: Gmail, Hotmail, Outlook…) |
| `MAIL_FROM` | `SMTP_USER` | Remitente visible |
| `SMTP_*` | — | Servidor SMTP (ver opción A) |
| `PUBLIC_URL` | `http://localhost:3000` | URL pública; se usa como `Referer` en FormSubmit |
| `ADMIN_TOKEN` | `mayka-2026` | Token de acceso a `/admin` — **cámbialo antes de publicar** |
| `CAPACITY` | `2` | Citas simultáneas (Mayka + Sara) |
| `SLOT_STEP` | `30` | Paso de la rejilla de horas, en minutos |
| `HORIZON_DAYS` | `60` | Días hacia adelante que se pueden reservar |

---

## 4. Cómo funciona el sistema de citas

1. El cliente elige **servicio → día → hora** y deja sus datos.
2. El frontend pide las horas libres a `GET /api/disponibilidad?fecha=…&servicio=…`.
3. El servidor las calcula combinando:
   - el horario real del salón (`public/shared/horarios.js`),
   - la duración de cada servicio (`public/shared/servicios.js`),
   - las citas ya reservadas, respetando `CAPACITY`.
4. `POST /api/citas` **vuelve a comprobar la disponibilidad** en el servidor (evita dobles
   reservas aunque dos personas envíen a la vez), guarda la cita y envía el email.
5. El cliente recibe una pantalla de confirmación y, si dejó su email, una copia.

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/config` | Datos del negocio, servicios y horario |
| `GET` | `/api/servicios` | Catálogo de servicios |
| `GET` | `/api/horarios` | Horario semanal |
| `GET` | `/api/disponibilidad?fecha=&servicio=` | Horas libres de un día |
| `POST` | `/api/citas` | Crear cita (envía el email) |
| `GET` | `/api/admin/citas?token=` | Listado de citas |
| `PATCH` | `/api/admin/citas/:id` | Cambiar estado (`confirmada`, `realizada`, `cancelada`) |
| `GET` | `/api/admin/citas.ics?token=` | Descargar las citas como calendario |
| `GET` | `/api/admin/diagnostico?token=` | Estado del envío de correo |

---

## 5. Panel de gestión de citas

En `http://localhost:3000/admin` (con el token) puedes:

- Ver todas las citas, con cliente, teléfono, correo y notas.
- **Confirmar**, marcar como **realizada** o **cancelar** cada cita (se avisa por email).
- Descargar el calendario en formato `.ics` e importarlo en Google Calendar o Outlook.
- Ver un resumen (citas de hoy, pendientes, próximas) y un aviso si el correo falló.

### El token

El token se define en `.env` con la variable `ADMIN_TOKEN` (por defecto `mayka-2026`).
Hay tres formas de entrar:

| Forma | Ejemplo |
|---|---|
| Escribirlo en el panel | `http://localhost:3000/admin` → escribe el token → **Entrar** |
| Directamente en la URL | `http://localhost:3000/admin?token=mayka-2026` |
| Marcador / enlace guardado | da igual dónde lo guardes |

La comparación es **tolerante**: no importan las mayúsculas, los espacios, los acentos
graves, las comillas, ni si usas `-`, `_` o `.` como separador. También funciona si
pegas la URL completa en el campo del token.

> **Antes de publicar la web**, cambia `ADMIN_TOKEN` por algo más largo y aleatorio.

---

## 6. Publicar la web

### Con servidor propio (recomendado)

Cualquier hosting con Node sirve tal cual:

```bash
npm install --omit=dev
MAIL_MODE=smtp SMTP_USER=… SMTP_PASS=… node server/index.js
```

En VPS usa **pm2**:

```bash
npm i -g pm2
pm2 start server/index.js --name "mayka"
pm2 save && pm2 startup
```

Detrás de Apache/Nginx, sirve con **proxy inverso a `http://127.0.0.1:3000`** y pon
`PUBLIC_URL=https://tu-dominio.es` en el `.env`.

### Sólo hosting estático (Netlify, Vercel, GitHub Pages…)

Sube el contenido de `public/` (que ya incluye la carpeta `shared/`) a la raíz del dominio y ya está.
En ese modo la web envía las citas directamente a FormSubmit desde el navegador
(`enviarExterno` en `public/js/app.js`), sin necesidad de servidor Node.

> Si lo haces así, recuerda que la primera cita activa el formulario por email y que
> **no hay comprobación de disponibilidad real** (las horas se calculan en el navegador).
> Para evitar huecos duplicados, usa la opción con servidor.

---

## 7. Estructura del proyecto

```
.
├── netlify.toml          # Configuración de despliegue en Netlify
├── netlify/functions/
│   └── api.js            # Netlify Function con la API de citas
├── server/
│   ├── app.js            # Manejador de la API (compartido Node + Netlify)
│   ├── index.js          # Servidor HTTP de Node
│   ├── config.js         # Configuración y carga del .env
│   ├── schedule.js       # Motor de horarios y disponibilidad
│   ├── store.js          # Almacén de citas (Netlify Blobs o archivo JSON)
│   └── mailer.js         # Envío de correo (SMTP / FormSubmit) y plantillas
├── public/               # Todo lo que sirve el navegador
│   ├── index.html        # Web pública
│   ├── admin.html        # Panel de gestión de citas
│   ├── shared/           # Catálogo de servicios y horario (servidor + navegador)
│   ├── css/              # Estilos
│   └── js/               # Lógica del cliente
├── data/citas.json       # Citas guardadas en servidor propio (se crea solo)
├── .env                  # Tu configuración (no se sube a git)
├── .env.example          # Plantilla de configuración
└── package.json
```

### Dónde se guardan las citas

| Entorno | Almacenamiento | ¿Persiste? |
|---|---|---|
| Netlify Functions | Netlify Blobs | ✅ Sí |
| Servidor Node (VPS) | `data/citas.json` | ✅ Sí |

---

## 8. Información real utilizada en la web

Todo el contenido procede del perfil público del negocio (Google Business Profile),
de la ficha de **Fresha** y de las **reseñas de los clientes**:

- **Nombre:** Peluquería Mayka
- **Dirección:** Avenida Europa nº 5, Los Narejos, 30710 Los Alcázares (Murcia)
- **Teléfono:** +34 868 70 01 05
- **Coordenadas:** 37.76079, -0.835474
- **Valoración:** 4,8 / 5 con 46 reseñas en Google
- **Horario:** L–J 9:30–13:30 y 16:00–20:00 · V 9:00–13:30 y 16:00–20:00 · S 9:00–15:00 · D cerrado
- **Servicios:** corte de mujer, corte de niños, tinte, mechas, balayage, matiz,
  rizado y permanentas, peinado, alisado con secador, modelación de cejas y citas para bodas
- **Servicios del local:** aseos, aseos unisex, pagos con móvil (NFC), tarjetas de crédito
  y débito, adecuado para niños, parking gratuito en la calle, se recomienda pedir cita
- **Equipo:** Mayka y Sara; el local es centro de prácticas para alumnos de peluquería

> **No se han inventado precios.** El negocio no los publica, así que la web indica que el
> precio se confirma en el salón tras el diagnóstico.
> Las reseñas que aparecen son textuales, firmadas por su autor y procedentes de Google.

### Personalizar el contenido

- **Servicios y duración** → `public/shared/servicios.js` (campo `duracion` en minutos).
- **Horario** → `public/shared/horarios.js` (índice 0 = domingo … 6 = sábado).
- **Textos, reseñas y ficha** → `public/index.html`.
- **Colores y tipografías** → variables CSS de `public/css/styles.css`.

---

## 8b. Motor de ingresos (genera dinero mientras duermes)

La web incluye un **motor de ingresos pasivos** integrado, accesible desde
`/tienda.html` (clientes) y `/admin-ingresos.html` (gestión):

- **Bonos regalo** (`/api/bonos/*`): el cliente paga por adelantado; el bono se
  canjea en el salón. Saldo no canjeado = ingreso puro.
- **Club Mayka** (`/api/membresias/*`): suscripción mensual recurrente (MRR).
  Ingreso cada mes aunque el cliente no venga.
- **Tienda** (`/api/pedidos`, `/api/productos`): productos de cuidado capilar
  con carrito y gestión de stock.
- **Lista de espera** (`/api/lista-espera`): cuando se cancela una cita, el
  hueco se ofrece al siguiente en espera (recuperación de ingresos).
- **Referidos** (`/api/referidos/*`): cada cliente tiene un código; invitar a
  una amiga acredita crédito al padrino (crecimiento viral de bajo coste).
- **Depósitos** en la reserva (`DEPOSIT_MODE`, `DEPOSIT_AMOUNT`): reduce
  ausencias y asegura caja.
- **Analítica** (`/api/admin/ingresos`): ingresos por servicio, MRR, bonos,
  tienda, tasa de cancelación/no-show, clientes dormidos, top servicios.
- **Automatización** (llamar con cron externo, p. ej. cron-job.org):
  - `POST /api/admin/recordatorios` → envía recordatorio a las citas de mañana.
  - `POST /api/admin/reengagement` → contacta clientes sin visita en
    `REENGAGEMENT_DAYS` días con oferta.
  - Al cancelar una cita, la lista de espera se notifica automáticamente.

Variables de entorno relevantes: `DEPOSIT_MODE`, `DEPOSIT_AMOUNT`,
`REFERRAL_CREDIT`, `NO_SHOW_FEE`, `REENGAGEMENT_DAYS`, `GIFT_CARD_EXPIRY_DAYS`,
`PRECIOS_SERVICIOS` (JSON), `BANK_IBAN`, `BANK_BENEFICIARY`,
`STRIPE_SECRET_KEY` (opcional, para cobro online).

## 9. Avisos legales:


- Los datos del formulario se usan **únicamente** para gestionar la cita.
- Los horarios pueden cambiar: conviene revisarlos cada cierto tiempo.
- Las reseñas pertenecen a sus autores y a Google; se reproducen de forma identificativa.

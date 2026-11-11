# Publicar la web de Peluquería Mayka

**La opción elegida es Netlify.** Netlify Functions aporta la API completa y Netlify
Blobs guarda las citas de forma permanente, así que **funciona todo**: horas libres
reales, panel de gestión y correo. Coste: 0 €.

---

## Los dos archivos que ya están listos

| Archivo | Para qué sirve |
|---|---|
| **`netlify.toml`** | Configuración del despliegue: carpeta pública, carpeta de funciones, redirección de `/api/*` a la Function, cabeceras de seguridad y caché. |
| **`netlify/functions/api.js`** | La Function que sirve la API del sistema de citas (disponibilidad, reservas, panel y envío de correo). Usa la misma lógica que el servidor Node (`server/app.js`). |

No hace falta tocar ninguno de los dos para publicar.

---

## Paso 1 · Subir el código a GitHub

```bash
cd "C:\Users\User\Documents\Proyecto predeterminado"
git add -A
git commit -m "Publicación en Netlify"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/peluqueria-mayka.git
git push -u origin main
```

Crea antes el repositorio **vacío** en github.com (sin README, para que no dé conflictos).

> El archivo `.env` **no** se sube (está en `.gitignore`). Las credenciales se pondrán
> en el panel de Netlify, que es más seguro.

---

## Paso 2 · Crear el sitio en Netlify

1. Entra en [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**.
2. Elige GitHub y selecciona el repositorio `peluqueria-mayka`.
3. Netlify detecta el `netlify.toml` y lo aplica solo:
   - Build command: *(déjalo vacío)*
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
4. Pulsa **Deploy site**.

En unos minutos tendrás la URL `https://peluqueria-mayka-1234.netlify.app`.

---

## Paso 3 · Configurar las variables de entorno

En Netlify: **Site configuration → Environment variables → Add a variable**.

| Variable | Valor | Obligatoria |
|---|---|---|
| `SHOP_EMAIL` | `miguelmelladoros6@gmail.com` | ✅ |
| `MAIL_MODE` | `formsubmit` | ✅ |
| `MAIL_CLIENT_COPY` | `true` | — |
| `PUBLIC_URL` | `https://tu-dominio.es` | ✅ |
| `ADMIN_TOKEN` | *algo largo y privado* | ✅ |
| `TZ` | `Europe/Madrid` | — |
| `CAPACITY` | `2` | — |
| `SLOT_STEP` | `30` | — |
| `HORIZON_DAYS` | `60` | — |

**Después de añadirlas, haz un nuevo despliegue** (botón *Deploy site* → *Clear cache and deploy site*).

### ¿Correo por FormSubmit o por Gmail?

| | FormSubmit (recomendado en Netlify) | Gmail SMTP |
|---|---|---|
| Configuración | Ninguna | Contraseña de aplicación (5 pasos) |
| Activación | 1 clic en el email que recibe el salón | Ninguna |
| Fiable en Netlify | ✅ Sí | ⚠️ A veces Netlify bloquea el puerto 587 |

Empieza con **FormSubmit** (así viene por defecto). La primera cita enviada activa el
formulario: recibirás un email en `miguelmelladoros6@gmail.com` con un enlace
**«Activate Form»**. Haz clic una sola vez y a partir de ahí llegan todas las citas.

Si prefieres Gmail, añade además:

| Variable | Valor |
|---|---|
| `MAIL_MODE` | `smtp` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | `miguelmelladoros6@gmail.com` |
| `SMTP_PASS` | *los 16 caracteres de la contraseña de aplicación* |
| `MAIL_FROM` | `Peluquería Mayka <miguelmelladoros6@gmail.com>` |

Para crear la contraseña de aplicación: Google → **Cuenta de Google → Seguridad →
Verificación en 2 pasos** → actívala → **Contraseñas de aplicación → Generar** →
app *Correo*, dispositivo *Otro*, nombre `Mayka Web*.

---

## Paso 4 · Dominio propio

1. Compra el dominio (`.es` en Red.es, `.com` en Namecheap o Donuts).
2. En Netlify: **Site configuration → Domain management → Add a custom domain**.
3. Netlify te dirá qué registro DNS crear (normalmente un `A` o un `CNAME`).
4. Créalo en el panel del dominio y espera a que propague (5–30 min).

Netlify emite el **certificado HTTPS automáticamente** y lo renueva solo.

---

## Paso 5 · Las citas se guardan solas

Las citas se guardan en **Netlify Blobs** (base de datos gratuita incluida en el plan
gratuito), así que **no se pierden aunque la función se reinicie**. El panel `/admin`
te dirá siempre en qué está guardando:

```
Citas: Netlify Blobs
```

---

## Nota sobre el plan gratuito

Las funciones se apagan tras unos minutos sin uso, pero Netlify las reactiva sola al
llegar una petición. La primera visita tras un rato de inactividad puede tardar 2–5
segundos. Para un salón con pocas visitas al día no es ningún problema.

---

## Alternativas (por si Netlify no te convence)

| | VPS | Render / Railway | Netlify estático |
|---|---|---|---|
| Coste | 5–12 €/mes | 0–7 €/mes | 0 € |
| Horas libres reales | Sí | Sí | **No** |
| Panel `/admin` | Sí | Sí | **No** |
| Correo | SMTP | SMTP | FormSubmit |
| Citas persistentes | Disco del servidor | Con disco montado | No |

### VPS (control total)

Ubuntu 24.04 con Node + pm2 + Nginx + Let's Encrypt:

```bash
sudo apt install -y nodejs nginx git
sudo npm install -g pm2
sudo mkdir -p /var/www/mayka && cd /var/www/mayka
git clone https://github.com/TU_USUARIO/peluqueria-mayka.git .
npm install --omit=dev
nano .env          # rellena SMTP_PASS, ADMIN_TOKEN, PUBLIC_URL…
pm2 start server/index.js --name mayka && pm2 save && pm2 startup
```

Nginx (proxy inverso a `127.0.0.1:3000`) y certificado:

```bash
sudo ln -s /etc/nginx/sites-available/mayka /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d tu-dominio.es -d www.tu-dominio.es
```

### Render / Railway (desde GitHub)

*New → Web Service* → build `npm install`, start `npm start` → variables de entorno →
dominio propio. Ojo: el disco es temporal, así que hay que montar un disco
persistente en `/app/data`.

---

## Antes de dar por terminada la web

- [ ] La web abre en `https://tu-dominio.es` con candado verde
- [ ] Se ve bien en móvil (mira la sección de citas, que es la importante)
- [ ] Haces una cita de prueba y **llega el email a `miguelmelladoros6@gmail.com`**
- [ ] El cliente recibe el email de confirmación
- [ ] Entras en `/admin` con tu token y ves la cita
- [ ] La hora reservada ya **no** aparece disponible en la web
- [ ] Has cambiado `ADMIN_TOKEN` por algo privado
- [ ] Google Business → *Sitio web* → pon la URL con HTTPS

---

## Datos del negocio (para los perfiles y directorios)

```
Peluquería Mayka
Avenida Europa nº 5, Los Narejos
30710 Los Alcázares, Murcia
+34 868 70 01 05
miguelmelladoros6@gmail.com
Coordenadas: 37.76079, -0.835474
Horario: L-J 9:30-13:30 y 16:00-20:00 · V 9:00-13:30 y 16:00-20:00 · S 9:00-15:00 · D cerrado
```

La web ya incluye los datos estructurados `schema.org` (`HairSalon`) con el horario,
el teléfono, la dirección y las 46 reseñas: Google puede mostrarlos directamente en los
resultados de búsqueda.

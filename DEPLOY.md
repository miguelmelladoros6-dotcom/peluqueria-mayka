# Publicar la web de Peluquería Mayka

Tienes dos caminos, ambos sobre Netlify:

| | **Opción 1 · Netlify Drop** (arrastrar el ZIP) | **Opción 2 · Netlify CLI** |
|---|---|---|
| Dificultad | Muy fácil | Muy fácil |
| GitHub | No hace falta | No hace falta |
| Web y correo | Sí | Sí |
| Panel `/admin` | No | Sí |
| Control de horas libres | No | Sí |
| Las citas se guardan | Solo en el correo | Netlify Blobs (persistentes) |

> **Documentación oficial de Netlify:** *"It is not possible to use Serverless Function, or
> Edge Functions with sites that are directly uploaded."* → al arrastrar un ZIP no hay
> servidor, así que la Opción 1 pierde el panel y el control de disponibilidad.

---

## Opción 1 · Arrastrar el ZIP (la más rápida)

El archivo ya está preparado:

```
C:\Users\User\Documents\Proyecto predeterminado\peluqueria-mayka-web.zip
```

(también copiado en tu **Escritorio**, listo para arrastrar).

### Pasos

1. Entra en [app.netlify.com/drop](https://app.netlify.com/drop) e **inicia sesión**
   (importante: si no entras, el sitio se publica pero se borra a la hora).
2. Arrastra el **ZIP** `peluqueria-mayka-web.zip` a la zona de Drop.
3. En unos segundos tienes la URL `https://peluqueria-mayka-xxxx.netlify.app`.
4. **Reclama el sitio** para que no se borre (aparece un aviso arriba).

### Qué funciona y qué no

| | Estado |
|---|---|
| La web completa, responsive y con mapa | Funciona |
| El formulario de citas | Funciona |
| **El email al salón** | Funciona (FormSubmit) |
| Panel `/admin` | No hay servidor |
| Que nadie reserve una hora ya ocupada | No se comprueba en servidor |

**Cómo gestionas las citas en esta opción:** te llegan por correo a
`miguelmelladoros6@gmail.com` con todos los datos (cliente, teléfono, servicio, día y
hora). Confirmas por teléfono. Es exactamente como se trabaja en muchos salones.

> Si el correo no te llega, es que FormSubmit necesita **una activación**: revisa tu
> bandeja, busca el email con el enlace **«Activate Form»** y haz clic una vez.

### Regenerar el ZIP cuando cambies algo

```bash
node scripts/crear-zip.js
```

Vuelve a copiarlo al Escritorio y arrástralo otra vez (Netlify Drop permite
actualizar el sitio arrastrando el ZIP nuevo al panel del proyecto).

---

## Opción 2 · Netlify CLI (todo funcionando, sin GitHub)

Es la forma de tener **el sistema de citas completo** (API, panel y horas libres
reales) sin necesidad de GitHub ni de un servidor propio.

### 1 · Instalar la CLI

```bash
npm install -g netlify-cli
```

### 2 · Entrar en tu cuenta (un clic en el navegador)

```bash
netlify login
```

### 3 · Desplegar

Desde la carpeta del proyecto:

```bash
netlify deploy --prod
```

La primera vez te preguntará el nombre del sitio (`peluqueria-mayka`) y el equipo.
Netlify **crea y despliega las Functions** automáticamente y te da la URL.

Para actualizar más adelante, vuelve a ejecutar `netlify deploy --prod`.

### 4 · Variables de entorno

```bash
netlify env:set SHOP_EMAIL miguelmelladoros6@gmail.com
netlify env:set MAIL_MODE formsubmit
netlify env:set PUBLIC_URL https://tu-dominio.es
netlify env:set ADMIN_TOKEN un-token-largo-y-privado
netlify env:set MAIL_CLIENT_COPY true
```

Y vuelve a desplegar para que se apliquen.

### 5 · Dominio propio

```bash
netlify domains:add tu-dominio.es
```

Netlify te dice qué registro DNS crear. El certificado HTTPS sale automático.

---

## Opción 3 · GitHub (despliegue automático, lo ideal a largo plazo)

Cada vez que hagas `git push`, Netlify publica solo. Ideal si vas a tocar la web
con frecuencia.

1. Sube el repo a GitHub:
   ```bash
   git add -A
   git commit -m "Actualización"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/peluqueria-mayka.git
   git push -u origin main
   ```
2. Netlify → *Add new site → Import an existing project* → elige el repo.
3. Netlify lee el `netlify.toml` solo: build vacío, publish `public`, functions `netlify/functions`.
4. Añade las variables de entorno en *Site configuration → Environment variables*
   (las de la Opción 2) y haz *Clear cache and deploy site*.

---

## Los dos archivos de configuración

| Archivo | Para qué sirve |
|---|---|
| **`netlify.toml`** | Configuración del despliegue con Functions: carpeta pública, carpeta de funciones, redirección de `/api/*` a la Function, cabeceras y caché. Se usa en las Opciones 2 y 3. |
| **`netlify/functions/api.js`** | La Function con la API del sistema de citas (disponibilidad, reservas, panel y envío de correo). Usa la misma lógica que el servidor Node (`server/app.js`). |

Para la **Opción 1 (ZIP)** no hacen falta: el ZIP ya lleva sus equivalentes
(`_redirects` y `_headers`) dentro de la carpeta de publicación.

---

## Alternativas a Netlify

| | VPS | Render / Railway |
|---|---|---|
| Coste | 5–12 €/mes | 0–7 €/mes |
| Horas libres reales | Sí | Sí |
| Panel `/admin` | Sí | Sí |
| Citas persistentes | Disco del servidor | Con disco montado |

**VPS** (control total):

```bash
sudo apt install -y nodejs nginx git
sudo npm install -g pm2
sudo mkdir -p /var/www/mayka && cd /var/www/mayka
git clone https://github.com/TU_USUARIO/peluqueria-mayka.git .
npm install --omit=dev
nano .env          # SMTP_PASS, ADMIN_TOKEN, PUBLIC_URL…
pm2 start server/index.js --name mayka && pm2 save && pm2 startup
```

Nginx (proxy inverso a `127.0.0.1:3000`) y certificado:

```bash
sudo ln -s /etc/nginx/sites-available/mayka /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d tu-dominio.es -d www.tu-dominio.es
```

---

## Antes de dar por terminada la web

- [ ] La web abre en `https://tu-dominio.es` con candado verde
- [ ] Se ve bien en móvil (mira la sección de citas, que es la importante)
- [ ] Haces una cita de prueba y **llega el email a `miguelmelladoros6@gmail.com`**
- [ ] El cliente recibe el email de confirmación
- [ ] Entras en `/admin` con tu token y ves la cita *(sólo en Opciones 2 y 3)*
- [ ] La hora reservada ya **no** aparece disponible en la web *(sólo en Opciones 2 y 3)*
- [ ] Has cambiado `ADMIN_TOKEN` por algo privado *(Opciones 2 y 3)*
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

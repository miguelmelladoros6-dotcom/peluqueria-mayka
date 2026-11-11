# Publicar la web de Peluquería Mayka

Tres caminos, de más completo a más simple. **Elige la Opción A si quieres el sistema
de citas con control real de disponibilidad, panel de gestión y correo instantáneo.**

| | Opción A · VPS | Opción B · Render/Railway | Opción C · Netlify/Vercel |
|---|---|---|---|
| Coste | 5–12 €/mes | 0–7 €/mes | 0 € |
| Comprueba horas libres reales | Sí | Sí | **No** (se calculan en el navegador) |
| Panel `/admin` | Sí | Sí | **No** |
| Correo | SMTP (Gmail) | SMTP (Gmail) | FormSubmit |
| Dificultad | Media | Fácil | Muy fácil |

---

## Antes de empezar (5 minutos)

### 1. Dominio

Busca el nombre que quieras: `peluqueriamayka.es`, `maykapeluqueria.es`, `peluqueriamayka.com`…
Los dominios `.es` los gestiona Red.es (≈8–12 €/año). Los `.com` están en Namecheap, Donuts, Google Domains…
**Punto fundamental:** la web ya está pensada para funcionar en `http://` con la IP del servidor
mientras tanto; el dominio sólo hay que añadirlo al final.

### 2. Correo con Gmail (recomendado)

Para que las citas lleguen al instante a `miguelmelladoros6@gmail.com`:

1. Google → **Cuenta de Google → Seguridad → Verificación en 2 pasos** → actívala.
2. En la misma pantalla → **Contraseñas de aplicación → Generar**.
3. App: *Correo* · Dispositivo: *Otro* · Nombre: `Mayka Web` → copia los **16 caracteres**.
4. Guárdalos en un sitio seguro. Lo necesitarás en el paso de configuración.

---

## Opción A · VPS (todo funciona)

### Paso 1 · Contratar el servidor

Proveedores recommendationados (todos con panel y acceso SSH):

- **Hostinger** — hosting VPS desde ≈6 €/mes (Ubuntu 24.04, 2 GB RAM).
- **Aruba Cloud** — ≈5 €/mes.
- **Contabo** — ≈4 €/mes, aunque el soporte es más lento.
- **DigitalOcean** — 6 €/mes, muy fácil de usar.

Al contratar: sistema **Ubuntu 24.04 LTS**, 1 vCPU, 1–2 GB RAM, 20–30 GB disco.

### Paso 2 · Conectar por SSH

Desde Windows (PowerShell):

```powershell
ssh root=TU_IP_DEL_SERVIDOR
```

(En Hostinger/Aruba el usuario suele ser `root` o `debian`.) Acepta la huella y ya entras.

### Paso 3 · Instalar Node.js y subir el proyecto

```bash
# Node 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git
sudo npm install -g pm2

# Crear la carpeta de la web
sudo mkdir -p /var/www/mayka
sudo chown $USER:$USER /var/www/mayka
cd /var/www/mayka

# Opción 1: subir por git (recomendado)
git clone https://github.com/TU_USUARIO/peluqueria-mayka.git .
git remote set-url origin https://github.com/TU_USUARIO/peluqueria-mayka.git

# Opción 2: subir por SFTP/FTP (WinSCP) los archivos sueltos

npm install --omit=dev
```

### Paso 4 · Configurar

```bash
nano .env
```

Contenido mínimo (cambia lo que haga falta):

```ini
PORT=3000
HOST=127.0.0.1
TZ=Europe/Madrid
PUBLIC_URL=https://tu-dominio.es

SHOP_EMAIL=miguelmelladoros6@gmail.com
MAIL_MODE=smtp
MAIL_CLIENT_COPY=true

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=miguelmelladoros6@gmail.com
SMTP_PASS=AQUI_LOS_16_CARACTERES
MAIL_FROM=Peluquería Mayka <miguelmelladoros6@gmail.com>

ADMIN_TOKEN=un-token-largo-y-aleatorio-que-cambies
CAPACITY=2
SLOT_STEP=30
HORIZON_DAYS=60
```

> ⚠️ `ADMIN_TOKEN` es la contraseña de tu panel: pon algo largo y no lo publiques.

Guarda con `Ctrl+O`, `Enter`, `Ctrl+X`.

### Paso 5 · Arrancar con pm2 (para que no se caiga)

```bash
pm2 start server/index.js --name "mayka"
pm2 save
pm2 startup        # ejecuta el comando que te muestre para survive al reinicio
```

Comprueba que responde:

```bash
curl http://127.0.0.1:3000/api/config
```

### Paso 6 · Nginx + HTTPS

```bash
sudo nano /etc/nginx/sites-available/mayka
```

```nginx
server {
    listen 80;
    server_name tu-dominio.es www.tu-dominio.es;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mayka /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**Certificado HTTPS gratis** (Let\'s Encrypt):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.es -d www.tu-dominio.es
```

Elige la opción de redirección a HTTPS. El certificado se renueva solo.

### Paso 7 · Apuntar el dominio

En el panel del proveedor del dominio, crea los registros DNS:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `@` | `TU_IP_DEL_SERVIDOR` |
| A | `www` | `TU_IP_DEL_SERVIDOR` |

Espera 5–30 minutos a que propaguen.

### Paso 8 · Comprobación final

- `https://tu-dominio.es` → la web
- `https://tu-dominio.es/admin` → panel (pide el token)
- Haz una cita de prueba y **comprueba que llega el correo a tu bandeja**

---

## Opción B · Render / Railway (desde GitHub, sin tocar servidores)

### Paso 1 · Subir el código a GitHub

```bash
cd "C:\Users\User\Documents\Proyecto predeterminado"
git init
git add .
git commit -m "Web Peluquería Mayka con sistema de citas"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/peluqueria-mayka.git
git push -u origin main
```

Crea antes el repositorio vacío en github.com.

### Paso 2 · Desplegar

**En Render.com:**

1. *New → Web Service* → conectar el repositorio.
2. Runtime: **Node**. Build command: `npm install`. Start command: `npm start`.
3. Plan: **Free** (se duerme tras 15 min sin visitas; la primera visita tarda unos 30 s)
   o **Starter 7 $/mes** (siempre activo, recomendado para un negocio).
4. *Environment* → añade las mismas variables del `.env` que en la Opción A.
5. Render te da una URL tipo `peluqueria-mayka.onrender.com`.

**En Railway.app:**

1. *New Project → Deploy from GitHub repo*.
2. Railway detecta el `Procfile` y lo despliega solo.
3. *Variables* → las del `.env`.
4. *Settings → Networking* → genera dominio.

### Paso 3 · Dominio propio

En Render/Railway: *Settings → Custom Domains* → `www.tu-dominio.es`.
Después crea el registro DNS que te indiquen (CNAME o A).

### ⚠️ Persistencia de las citas

En Render/Railway el disco es temporal: **cada reinicio borra `data/citas.json`**.

Solución rápida en Render: añade un disco persistente en *Disks* y monta la ruta
`/app/data`. En Railway, monta un volumen en `/app/data`.

Si prefieres no complicate: en la Opción A (VPS) las citas se guardan siempre en disco,
que es justo lo que necesitas para un negocio.

---

## Opción C · Netlify / Vercel / GitHub Pages (sólo estático)

**Limitaciones reales:** no hay comprobación de disponibilidad en el servidor (dos personas
podrían pillar la misma hora), no hay panel `/admin` y las citas se guardan sólo en el
correo. **Para un salón con 2 peluqueras esto puede generar problemas**, úsala sólo como
web informative mientras montas la Opción A o B.

```bash
# Sube el contenido de public/ y shared/ a la raíz del repositorio de despliegue
```

En Netlify: *Add new site → Import an existing project* →Build command: `npm run build`
o vacío · Publish directory: `public`.

**Activar el correo:** la web en modo estático envía por FormSubmit desde el navegador.
La primera cita activa el formulario (llega un email a `miguelmelladoros6@gmail.com` con
el enlace *Activate Form*). Y en el archivo `public/js/app.js` conviene cambiar:

```js
var EMAIL_SALON = 'miguelmelladoros6@gmail.com';
```

por el correo que quieras usar (ya está así).

---

## Checklist antes de dar por terminada la web

- [ ] La web abre en `https://tu-dominio.es` con candado verde
- [ ] Se ve bien en móvil (mira la sección de citas, que es la importante)
- [ ] Haces una cita de prueba y **llega el email a `miguelmelladoros6@gmail.com`**
- [ ] El cliente recibe el email de confirmación
- [ ] Entras en `/admin` con tu token y ves la cita
- [ ] La hora reservada ya **no** aparece disponible en la web
- [ ] Has cambiado `ADMIN_TOKEN` por algo privado
- [ ] Google Maps: pide a los clientes queapusden una reseña (ya tienes 46, ¡no las pierdas!)
- [ ] Actualiza la ficha de Google Business con la URL de la web

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

En Google Business → *Sitio web* → pon la URL con HTTPS.
En el `schema.org` del pie de la web se pueden añadir los horarios como datos
estructurados para que Google los muestre en los resultados.

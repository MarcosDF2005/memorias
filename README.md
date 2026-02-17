# Memoria Digital

Portal de memorias compartidas con amigos.

## Ejecutar con API (recomendado)

Los datos del calendario y eventos se guardan en `data/user-data.json` y se comparten entre todos los que usen la app.

```bash
npm install
npm run setup-users   # Primera vez: crea cuentas (contraseña: memoria)
npm start
```

Abre http://localhost:3000

### Inicio de sesión

- Cada amigo tiene su cuenta (usuario = nombre en el sistema)
- Contraseña por defecto: **memoria**
- Al iniciar sesión, tu foto de perfil del portal aparece en el hub
- Sin servidor: usa "Continuar sin login" o Live Server

## Desplegar en Render

1. **Sube el proyecto a GitHub** (si no lo has hecho).

2. **Entra en [Render](https://render.com)** → New → Web Service.

3. **Conecta tu repo** y configura:
   - **Name**: memoria-digital
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run setup-users`
   - **Start Command**: `npm start`

4. **Variables de entorno** (en la pestaña Environment):
   - `NODE_ENV` = `production`
   - `SESSION_SECRET` = (genera una aleatoria, ej. `openssl rand -hex 32`)

5. Deploy. Tu app quedará en `https://tu-nombre.onrender.com`

### Persistencia de datos

En el plan gratuito, el disco es efímero: al redesplegar o reiniciar, se pierden calendario y eventos añadidos. Los usuarios se recrean en cada build con `setup-users`. Para conservar los datos necesitas [Render Disk](https://render.com/docs/disks) (de pago) o migrar a una base de datos.

## Ejecutar solo frontend (Live Server)

Si abres el proyecto con Live Server, los datos se guardan en el navegador (localStorage) y no se comparten. No hay login.

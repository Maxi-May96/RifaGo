# RifaGo

Sistema de Gestión de Rifas y Sorteos en Línea.

## Estructura del Proyecto

El código de la aplicación está organizado dentro de la carpeta `src/`:

- `config/`: Configuración de base de datos, firebase, sockets y variables de entorno.
- `controllers/`: Lógica de negocio y manejo de peticiones HTTP.
- `middleware/`: Middlewares para autenticación, autorización, validación y subida de archivos.
- `models/`: Modelos de datos (Mongoose / MongoDB).
- `routes/`: Definición de las rutas del servidor Express.
- `services/`: Capa de servicios para integraciones externas (Firebase, Sockets, correos, pasarela de pago).
- `sockets/`: Handlers para eventos de WebSockets (chat, notificaciones en tiempo real, sorteos).
- `helpers/`: Funciones auxiliares reutilizables.
- `utils/`: Constantes y utilidades generales.
- `views/`: Vistas y plantillas de renderizado de la interfaz de usuario (EJS).
- `public/`: Archivos estáticos públicos (CSS, JS cliente, imágenes, iconos).
- `jobs/`: Trabajos en segundo plano o tareas programadas (sorteos automáticos, envío masivo).
- `app.js`: Configuración de la aplicación Express.
- `server.js`: Punto de entrada que inicializa el servidor HTTP y WebSockets.

## Requisitos
- Node.js v18+
- MongoDB

## Configuración e Instalación
1. Clonar el repositorio.
2. Copiar `.env` y configurar las variables correspondientes.
3. Ejecutar `npm install` para instalar las dependencias.
4. Iniciar en modo desarrollo: `npm run dev`.

# Desplegar Firebase Functions (notificaciones push)

Pasos para actualizar y desplegar las Cloud Functions después de agregar la notificación de comprobante subido.

## Requisitos

- Node.js instalado
- Cuenta de Firebase y proyecto configurado
- Firebase CLI: `npm install -g firebase-tools`
- Haber hecho login: `firebase login`

## 1. Entrar a la carpeta de functions

```bash
cd functions
```

## 2. Instalar dependencias (si hace falta)

```bash
npm install
```

## 3. Variables de entorno (VAPID)

Las notificaciones push usan claves VAPID. Deben estar en un archivo `.env` dentro de `functions/` (o configuradas en Firebase). Ejemplo:

```env
VAPID_EMAIL=tu@email.com
VAPID_PUBLIC_KEY=tu_clave_publica_base64url
VAPID_PRIVATE_KEY=tu_clave_privada_base64url
```

Si usas otro método (Secret Manager, etc.), configúralo según tu proyecto.

## 4. Desplegar solo las functions

Desde la **raíz del proyecto** (no desde `functions/`):

```bash
firebase deploy --only functions
```

Para desplegar una función concreta:

```bash
firebase deploy --only functions:onDepositProofUploaded
```

## 5. Verificar en la consola de Firebase

1. Entra a [Firebase Console](https://console.firebase.google.com/) → tu proyecto.
2. **Functions** → deberías ver:
   - `onBookingCreated` (nueva reserva)
   - `onBookingCancelled` (reserva cancelada)
   - `onDepositProofUploaded` (comprobante subido)

## Resumen de notificaciones

| Acción                    | Trigger                 | Quién recibe push |
|---------------------------|-------------------------|-------------------|
| Cliente hace una reserva  | `onBookingCreated`      | Profesionales de la reserva |
| Cliente sube comprobante  | `onDepositProofUploaded` | Profesionales de la reserva |
| Reserva cancelada         | `onBookingCancelled`    | Profesionales de la reserva |

Los profesionales deben tener **notificaciones activadas** en su perfil del admin (suscritos con el mismo navegador donde usan la app).

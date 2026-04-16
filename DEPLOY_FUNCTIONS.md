# Desplegar Firebase Functions (push + correos Brevo)

Pasos para actualizar y desplegar las Cloud Functions con notificaciones push y correos transaccionales vía Brevo.

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

## 3. Variables de entorno

Deben estar en un archivo `.env` dentro de `functions/` (o configuradas en Firebase/Secret Manager). Ejemplo:

```env
# Push (web-push)
VAPID_EMAIL=tu@email.com
VAPID_PUBLIC_KEY=tu_clave_publica_base64url
VAPID_PRIVATE_KEY=tu_clave_privada_base64url

# Correos transaccionales (Brevo)
BREVO_API_KEY=tu_api_key_brevo
BREVO_SENDER_EMAIL=no-reply@tudominio.com
BREVO_SENDER_NAME=Slotti

# URL pública de la app para links en correo
APP_BASE_URL=https://slotti.vercel.app
```

Notas:

- `BREVO_SENDER_EMAIL` debe ser un remitente válido en tu cuenta Brevo.
- `APP_BASE_URL` se usa para construir el enlace `/:slug/reserva/:bookingId` dentro del correo.
- Si no hay `clientEmail` en la reserva, no se envía correo.

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
   - `onBookingConfirmed` (reserva confirmada, correo cliente)
   - `onBookingCancelled` (reserva cancelada)
   - `onDepositProofUploaded` (comprobante subido)

## Resumen de notificaciones

| Acción                       | Trigger                  | Resultado                                                   |
| ---------------------------- | ------------------------ | ----------------------------------------------------------- |
| Cliente crea reserva         | `onBookingCreated`       | Push a profesionales de la reserva                          |
| Profesional confirma reserva | `onBookingConfirmed`     | Correo al cliente (si `clientEmail`) con link de estado     |
| Reserva cancelada            | `onBookingCancelled`     | Push a profesionales + correo al cliente (si `clientEmail`) |
| Cliente sube comprobante     | `onDepositProofUploaded` | Push a profesionales                                        |

Los profesionales deben tener **notificaciones activadas** en su perfil del admin (suscritos con el mismo navegador donde usan la app).

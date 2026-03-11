# Reglas de Firestore para reseñas

El error **"Missing or insufficient permissions"** al enviar una reseña se debe a que Firestore no tenía permisos para:

1. **Leer** el booking (para cargar la página de reseña).
2. **Consultar** si ya existe una reseña para ese booking.
3. **Crear** un documento en la subcolección `reviews` (enviar la reseña).

## Qué hacer

### Opción A — Firebase Console (recomendado si no usas CLI)

1. Entra en [Firebase Console](https://console.firebase.google.com) → tu proyecto → **Firestore Database** → pestaña **Reglas**.
2. Si ya tienes reglas para `tenants`, `bookings`, etc., **añade o ajusta** solo lo que falte:
   - Que **cualquiera** (sin login) pueda:
     - Hacer **get** de un documento en `tenants/{tenantId}/bookings/{bookingId}`.
     - **Leer** y **crear** en `tenants/{tenantId}/reviews`.
   - Que **solo usuarios autenticados** puedan **actualizar** o **eliminar** en `tenants/{tenantId}/reviews` (panel admin).
3. Si no tienes reglas aún, puedes pegar el contenido del archivo **`firestore.rules`** de este proyecto (reemplaza todo lo que haya en la consola).
4. Pulsa **Publicar**.

### Opción B — Firebase CLI

Si tienes el proyecto vinculado con `firebase init`:

```bash
firebase deploy --only firestore:rules
```

(El archivo `firestore.rules` en la raíz del proyecto debe ser el que usa Firebase; si tus reglas están en otro sitio, indica la ruta en `firebase.json`.)

## Sobre la lentitud al cargar

- Con las reglas correctas, las lecturas dejan de fallar y la página suele cargar más rápido.
- La página ya está optimizada para no esperar la comprobación “¿ya hay reseña?” antes de mostrar el formulario, así que el usuario ve el formulario en cuanto se carga el negocio y la reserva.

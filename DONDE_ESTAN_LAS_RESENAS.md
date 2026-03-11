# Dónde se guardan las reseñas en Firestore

Las reseñas **no** están en una colección llamada `reviews` en la raíz. Están **dentro de cada negocio (tenant)**.

## Ruta en la base de datos

```
Firestore Database
└── tenants          ← colección de negocios
    └── [tenantId]    ← documento de TU negocio (un ID largo)
        └── reviews  ← subcolección (aquí están las reseñas)
            └── [reviewId]
                ├── bookingId
                ├── clientName
                ├── professionalName
                ├── rating
                ├── comment
                ├── status   ("pending" | "approved" | "rejected")
                ├── createdAt
                └── ...
```

## Cómo verlas en Firebase Console

1. Entra en [Firebase Console](https://console.firebase.google.com) → tu proyecto.
2. **Firestore Database** → pestaña **Datos**.
3. Abre la colección **`tenants`**.
4. Haz clic en **el documento de tu negocio** (el que tiene el nombre, slug, etc.). El ID de ese documento es tu `tenantId`.
5. Dentro verás varias **subcolecciones**; una de ellas es **`reviews`**. Ahí están todas las reseñas de ese negocio.

Si enviaste una reseña y llegó el mensaje "¡Gracias por tu reseña!", el documento se creó en **`tenants` → [tu tenant] → `reviews`**.

## Por qué no aparecen en el panel "Reseñas"

1. **Índice compuesto faltante**  
   Las consultas de pendientes y aprobadas usan `status` + `createdAt`. Firestore exige un **índice compuesto** para eso.  
   - Si falta, en el panel puede salir un mensaje de error o la lista vacía, y en la **consola del navegador** (F12 → Console) suele aparecer un error con un **enlace para crear el índice**.  
   - También puedes crearlo a mano: **Firestore → Indexes** → **Composite** → Colección: `tenants/[tenantId]/reviews` (o la ruta que te indique el error), campos: `status` (Asc), `createdAt` (Desc).

2. **Sesión de otro negocio**  
   El panel muestra solo las reseñas del negocio del usuario logueado (`tenantId` del perfil en `users/{uid}`). Si entraste con otro usuario/negocio, no verás las reseñas del que usaste para enviar la reseña.

3. **Revisar en la consola**  
   Abre F12 → Console, recarga la página de Reseñas y mira si aparece algún error de Firestore (por ejemplo "index" o "permission"). Eso confirma si es tema de índice o de permisos.

## Resumen

- **Dónde:** `tenants` → [documento de tu negocio] → subcolección **`reviews`**.
- **Qué hacer si no ves nada:** Crear el índice compuesto que pida Firestore (o el que está en el comentario de `src/lib/firestore/reviews.js`) y asegurarte de estar logueado con el mismo negocio para el que enviaste la reseña.

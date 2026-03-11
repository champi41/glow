/**
 * Seed script — Barbería SaaS
 * ─────────────────────────────────────────────────────────────
 * Crea los documentos mínimos para comenzar a desarrollar.
 *
 * USO (PowerShell):
 *   node seed.cjs
 *
 * Requiere: npm install firebase-admin
 * Coloca este archivo en la RAÍZ del proyecto junto a serviceAccount.json
 * ─────────────────────────────────────────────────────────────
 */

const admin = require('firebase-admin');
const path  = require('path');

// ── Inicialización ────────────────────────────────────────────
const serviceAccount = require(path.resolve(__dirname, 'serviceAccount.json'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

// ── Constantes ────────────────────────────────────────────────
const TENANT_ID = 'demo-barberia';

// ── Helpers ───────────────────────────────────────────────────
const now = admin.firestore.Timestamp.now();

function toTimestamp(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min]  = timeStr.split(':').map(Number);
  return admin.firestore.Timestamp.fromDate(
    new Date(y, m - 1, d, h, min, 0)
  );
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Datos ─────────────────────────────────────────────────────

const tenant = {
  name:        'Barbería Demo',
  slug:        'demo-barberia',
  phone:       '+56912345678',
  address:     'Av. Providencia 123, Santiago',
  description: 'Barbería clásica con los mejores profesionales de la ciudad.',
  logoUrl:     '',
  coverUrl:    '',
  instagramUrl:'',
  plan:        'free',
  createdAt:   now,
  businessHours: {
    monday:    { open: '09:00', close: '20:00', isOpen: true  },
    tuesday:   { open: '09:00', close: '20:00', isOpen: true  },
    wednesday: { open: '09:00', close: '20:00', isOpen: true  },
    thursday:  { open: '09:00', close: '20:00', isOpen: true  },
    friday:    { open: '09:00', close: '20:00', isOpen: true  },
    saturday:  { open: '10:00', close: '18:00', isOpen: true  },
    sunday:    { open: '00:00', close: '00:00', isOpen: false },
  },
  breaks: [
    { name: 'Colación', start: '13:00', end: '14:00' },
  ],
};

// Profesionales — availability: null hereda horario del negocio
const professionals = [
  {
    id:           'prof-carlos',
    name:         'Carlos Pérez',
    slug:         'carlos-perez',
    bio:          'Barbero con 10 años de experiencia. Especialista en cortes clásicos y degradados.',
    photoUrl:     '',
    role:         'owner',
    uid:          '', // <-- rellena después con el UID de Auth
    isActive:     true,
    order:        0,
    instagram:    '',
    availability: null, // hereda horario del negocio
  },
  {
    id:           'prof-maria',
    name:         'María González',
    slug:         'maria-gonzalez',
    bio:          'Especialista en colorimetría y tratamientos capilares.',
    photoUrl:     '',
    role:         'professional',
    uid:          '',
    isActive:     true,
    order:        1,
    instagram:    '',
    availability: {
      monday:    { start: '10:00', end: '19:00', isWorking: true  },
      tuesday:   { start: '10:00', end: '19:00', isWorking: true  },
      wednesday: { start: '10:00', end: '19:00', isWorking: false },
      thursday:  { start: '10:00', end: '19:00', isWorking: true  },
      friday:    { start: '10:00', end: '19:00', isWorking: true  },
      saturday:  { start: '10:00', end: '17:00', isWorking: true  },
      sunday:    { start: '00:00', end: '00:00', isWorking: false },
    },
  },
  {
    id:           'prof-luis',
    name:         'Luis Torres',
    slug:         'luis-torres',
    bio:          'Experto en barba y bigote. Navaja y tijera de precisión.',
    photoUrl:     '',
    role:         'professional',
    uid:          '',
    isActive:     true,
    order:        2,
    instagram:    '',
    availability: null,
  },
];

// Servicios
const services = [
  {
    id:             'serv-corte-clasico',
    name:           'Corte clásico',
    description:    'Corte tradicional a tijera o máquina.',
    price:          12000,
    duration:       30,
    category:       'Corte',
    professionalIds: ['prof-carlos', 'prof-luis'],
    isActive:       true,
    order:          0,
  },
  {
    id:             'serv-corte-barba',
    name:           'Corte + Barba',
    description:    'Corte completo más arreglo de barba con navaja.',
    price:          18000,
    duration:       50,
    category:       'Combo',
    professionalIds: ['prof-carlos', 'prof-luis'],
    isActive:       true,
    order:          1,
  },
  {
    id:             'serv-barba',
    name:           'Arreglo de barba',
    description:    'Perfilado y arreglo de barba con navaja.',
    price:          8000,
    duration:       20,
    category:       'Barba',
    professionalIds: ['prof-carlos', 'prof-luis'],
    isActive:       true,
    order:          2,
  },
  {
    id:             'serv-degradado',
    name:           'Degradado',
    description:    'Corte degradado con máquina y tijera.',
    price:          15000,
    duration:       40,
    category:       'Corte',
    professionalIds: ['prof-maria'],
    isActive:       true,
    order:          3,
  },
  {
    id:             'serv-tinte',
    name:           'Tinte',
    description:    'Coloración completa del cabello.',
    price:          25000,
    duration:       60,
    category:       'Color',
    professionalIds: ['prof-maria'],
    isActive:       true,
    order:          4,
  },
];

// Reservas de ejemplo (hoy y mañana)
const today    = todayStr();
const tomorrow = tomorrowStr();

const bookings = [
  {
    clientName:    'Juan López',
    clientPhone:   '+56987654321',
    date:          toTimestamp(today, '10:00'),
    dateStr:       today,
    status:        'confirmed',
    createdAt:     now,
    notes:         '',
    items: [
      {
        serviceId:        'serv-corte-clasico',
        serviceName:      'Corte clásico',
        professionalId:   'prof-carlos',
        professionalName: 'Carlos Pérez',
        professionalSlug: 'carlos-perez',
        startTime:        '10:00',
        endTime:          '10:30',
        price:            12000,
        duration:         30,
      },
    ],
    totalPrice:    12000,
    totalDuration: 30,
  },
  {
    clientName:    'Ana Martínez',
    clientPhone:   '+56911223344',
    date:          toTimestamp(today, '11:00'),
    dateStr:       today,
    status:        'pending',
    createdAt:     now,
    notes:         '',
    items: [
      {
        serviceId:        'serv-corte-barba',
        serviceName:      'Corte + Barba',
        professionalId:   'prof-carlos',
        professionalName: 'Carlos Pérez',
        professionalSlug: 'carlos-perez',
        startTime:        '11:00',
        endTime:          '11:50',
        price:            18000,
        duration:         50,
      },
    ],
    totalPrice:    18000,
    totalDuration: 50,
  },
  {
    clientName:    'Pedro Sánchez',
    clientPhone:   '+56955667788',
    date:          toTimestamp(today, '09:00'),
    dateStr:       today,
    status:        'completed',
    createdAt:     now,
    notes:         '',
    items: [
      {
        serviceId:        'serv-barba',
        serviceName:      'Arreglo de barba',
        professionalId:   'prof-luis',
        professionalName: 'Luis Torres',
        professionalSlug: 'luis-torres',
        startTime:        '09:00',
        endTime:          '09:20',
        price:            8000,
        duration:         20,
      },
    ],
    totalPrice:    8000,
    totalDuration: 20,
  },
  // Reserva multi-servicio con 2 profesionales distintos
  {
    clientName:    'Sofía Ramírez',
    clientPhone:   '+56944332211',
    date:          toTimestamp(tomorrow, '15:00'),
    dateStr:       tomorrow,
    status:        'pending',
    createdAt:     now,
    notes:         'Viene con su pareja',
    items: [
      {
        serviceId:        'serv-degradado',
        serviceName:      'Degradado',
        professionalId:   'prof-maria',
        professionalName: 'María González',
        professionalSlug: 'maria-gonzalez',
        startTime:        '15:00',
        endTime:          '15:40',
        price:            15000,
        duration:         40,
      },
      {
        serviceId:        'serv-corte-clasico',
        serviceName:      'Corte clásico',
        professionalId:   'prof-carlos',
        professionalName: 'Carlos Pérez',
        professionalSlug: 'carlos-perez',
        startTime:        '15:00',
        endTime:          '15:30',
        price:            12000,
        duration:         30,
      },
    ],
    totalPrice:    27000,
    totalDuration: 40, // paralelo: máximo de los dos
  },
];

// Bloqueo de ejemplo
const blocks = [
  {
    professionalId: 'prof-carlos',
    date:           toTimestamp(tomorrow, '12:00'),
    dateStr:        tomorrow,
    startTime:      '12:00',
    endTime:        '13:00',
    reason:         'Reunión',
  },
];

// ── Ejecución ─────────────────────────────────────────────────
async function seed() {
  console.log('🌱 Iniciando seed...\n');

  const tenantRef = db.collection('tenants').doc(TENANT_ID);

  // 1. Tenant
  await tenantRef.set(tenant);
  console.log(`✅ Tenant creado: ${TENANT_ID}`);

  // 2. Profesionales
  for (const { id, ...data } of professionals) {
    await tenantRef.collection('professionals').doc(id).set(data);
    console.log(`✅ Profesional: ${data.name} (ID: ${id})`);
  }

  // 3. Servicios
  for (const { id, ...data } of services) {
    await tenantRef.collection('services').doc(id).set(data);
    console.log(`✅ Servicio: ${data.name} (ID: ${id})`);
  }

  // 4. Reservas
  for (const booking of bookings) {
    const ref = await tenantRef.collection('bookings').add(booking);
    console.log(`✅ Reserva: ${booking.clientName} — ${booking.dateStr} (ID: ${ref.id})`);
  }

  // 5. Bloqueos
  for (const block of blocks) {
    const ref = await tenantRef.collection('blocks').add(block);
    console.log(`✅ Bloqueo: ${block.professionalId} ${block.dateStr} ${block.startTime}-${block.endTime} (ID: ${ref.id})`);
  }

  console.log('\n─────────────────────────────────────────────');
  console.log('🎉 Seed completado.\n');
  console.log('📋 PASOS SIGUIENTES:');
  console.log('');
  console.log('1. Ir a Firebase Console → Authentication → Add user');
  console.log('   Email: owner@demo.com');
  console.log('   Password: Demo1234!');
  console.log('   → Copia el UID generado\n');
  console.log('2. En Firestore crear: users/{UID}');
  console.log('   tenantId:       "demo-barberia"');
  console.log('   professionalId: "prof-carlos"');
  console.log('   role:           "owner"');
  console.log('   email:          "owner@demo.com"\n');
  console.log('3. En Firestore ir a:');
  console.log('   tenants/demo-barberia/professionals/prof-carlos');
  console.log('   Editar campo uid → pegar el UID copiado\n');
  console.log('🌐 Landing pública: /demo-barberia');
  console.log('🔐 Admin login:     /admin/login');
  console.log('─────────────────────────────────────────────\n');
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});

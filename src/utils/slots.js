import { format, parseISO } from "date-fns";

const SLOT_STEP = 15; // minutos

// ─── Utilidades de tiempo ────────────────────────────────────

function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minToTime(m) {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function generateSlots(openMin, closeMin) {
  const slots = [];
  for (let m = openMin; m + SLOT_STEP <= closeMin; m += SLOT_STEP) {
    slots.push(m);
  }
  return slots; // array de minutos, no strings
}

// ─── Horario del profesional para un día ────────────────────

function getProfWindow(professional, tenant, dateStr) {
  const day = format(parseISO(dateStr), "EEEE").toLowerCase();
  const avail = professional?.availability?.[day];

  if (avail !== undefined && avail !== null) {
    if (!avail.isWorking) return null;
    return { start: timeToMin(avail.start), end: timeToMin(avail.end) };
  }

  const bh = tenant?.businessHours?.[day];
  if (bh?.isOpen) {
    return { start: timeToMin(bh.open), end: timeToMin(bh.close) };
  }

  return null;
}

// Devuelve los descansos configurados para un profesional en un día concreto.
// Prioriza el descanso diario del profesional; si no tiene horario propio,
// usa el descanso diario del negocio para ese día. Como fallback final,
// mantiene compatibilidad con el antiguo esquema tenant.breaks (array global).
function getProfBreaks(professional, tenant, dateStr) {
  const day = format(parseISO(dateStr), "EEEE").toLowerCase();
  const avail = professional?.availability?.[day];

  // Horario propio del profesional
  if (avail !== undefined && avail !== null) {
    const br = avail.break;
    if (br?.hasBreak) {
      return [{ start: br.start, end: br.end }];
    }
    return [];
  }

  // Hereda horario del negocio
  const bh = tenant?.businessHours?.[day];
  if (bh?.break?.hasBreak) {
    return [{ start: bh.break.start, end: bh.break.end }];
  }

  // Compatibilidad con descansos globales antiguos
  return tenant?.breaks || [];
}

// ─── Verifica si un rango cae en un break ────────────────────

function overlapsBreak(startMin, endMin, breaks) {
  if (!breaks?.length) return false;
  return breaks.some((b) => {
    const bs = timeToMin(b.start);
    const be = timeToMin(b.end);
    return startMin < be && endMin > bs;
  });
}

// ─── Rangos ocupados por profesional ────────────────────────
// Solo reservas que ocupan el slot: pending y confirmed. Cancelled y completed no bloquean.
function isBookingOccupying(status) {
  if (status === "cancelled" || status === "completed") return false;
  return true; // pending, confirmed o undefined (compatibilidad)
}

function buildOccupied(profIds, existingBookings, existingBlocks) {
  const occupied = {};
  for (const pid of profIds) occupied[pid] = [];

  for (const booking of existingBookings) {
    if (!isBookingOccupying(booking.status)) continue;
    for (const item of booking.items || []) {
      const pid = item.professionalId;
      if (!occupied[pid]) continue;
      occupied[pid].push({
        start: timeToMin(item.startTime),
        end: timeToMin(item.endTime),
      });
    }
  }

  for (const block of existingBlocks) {
    const pid = block.professionalId;
    if (!occupied[pid]) continue;
    occupied[pid].push({
      start: timeToMin(block.startTime),
      end: timeToMin(block.endTime),
    });
  }

  return occupied;
}

// ─── Verifica si un profesional está libre en un rango ───────

function isProfFree(profId, startMin, endMin, occupied, profWindow, breaks) {
  if (!profWindow) return false;
  if (startMin < profWindow.start || endMin > profWindow.end) return false;
  if (overlapsBreak(startMin, endMin, breaks)) return false;
  return !(occupied[profId] || []).some(
    (r) => startMin < r.end && endMin > r.start,
  );
}

// ─── Permutaciones ───────────────────────────────────────────

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

// ─── FUNCIÓN PRINCIPAL ───────────────────────────────────────

/**
 * Calcula los slots disponibles para una reserva.
 *
 * Para un solo profesional:
 *   Busca slots donde el profesional tenga tiempo continuo
 *   suficiente para todos sus servicios en secuencia.
 *
 * Para múltiples profesionales:
 *   Prueba todas las permutaciones del orden de atención.
 *   Para cada permutación, busca slots donde los servicios
 *   se encadenen en secuencia: Prof1 termina → Prof2 empieza.
 *   Retorna los slots válidos con el detalle del orden.
 *
 * @param {object} params
 * @param {string} params.date - "YYYY-MM-DD"
 * @param {object} params.tenant
 * @param {Record<string,string>} params.assignments - { serviceId: profId } sin 'any'
 * @param {Array} params.selectedServices
 * @param {Array} params.professionals
 * @param {Array} params.existingBookings
 * @param {Array} params.existingBlocks
 *
 * @returns {Array<{
 *   startTime: string,
 *   order: Array<{
 *     profId: string,
 *     services: Array,
 *     start: string,
 *     end: string
 *   }>
 * }>}
 */
export function calcAvailableSlots({
  date,
  tenant,
  assignments,
  selectedServices,
  professionals,
  existingBookings,
  existingBlocks,
}) {
  // 1. Verificar que el negocio abre ese día
  const day = format(parseISO(date), "EEEE").toLowerCase();
  const bh = tenant?.businessHours?.[day];
  if (!bh?.isOpen) return [];

  const openMin = timeToMin(bh.open);
  const closeMin = timeToMin(bh.close);
  const allSlots = generateSlots(openMin, closeMin);

  // 2. Profesionales involucrados
  const profIds = [...new Set(Object.values(assignments))];

  // 3. Ventanas de trabajo por profesional
  const profWindows = {};
  const profBreaks = {};
  for (const pid of profIds) {
    const prof = professionals.find((p) => p.id === pid);
    profWindows[pid] = getProfWindow(prof, tenant, date);
    if (!profWindows[pid]) return []; // si algún prof no trabaja ese día, no hay slots
    profBreaks[pid] = getProfBreaks(prof, tenant, date);
  }

  // 4. Rangos ocupados por profesional
  const occupied = buildOccupied(profIds, existingBookings, existingBlocks);

  // 5. Agrupar servicios por profesional
  // profGroups[profId] = [service1, service2, ...]
  const profGroups = {};
  for (const service of selectedServices) {
    const pid = assignments[service.id];
    if (!pid) continue;
    if (!profGroups[pid]) profGroups[pid] = [];
    profGroups[pid].push(service);
  }

  const isSingleProf = profIds.length === 1;

  // ── CASO 1: Un solo profesional ──────────────────────────
  if (isSingleProf) {
    const profId = profIds[0];
    const window = profWindows[profId];
    const breaks = profBreaks[profId] || [];
    const services = profGroups[profId] || [];
    const total = services.reduce((s, sv) => s + (sv.duration || 0), 0);
    const result = [];

    for (const slotMin of allSlots) {
      const endMin = slotMin + total;
      if (!isProfFree(profId, slotMin, endMin, occupied, window, breaks))
        continue;

      // Construir el orden con tiempos exactos
      let cursor = slotMin;
      const order = [
        {
          profId,
          services,
          start: minToTime(slotMin),
          end: minToTime(slotMin + total),
        },
      ];

      result.push({ startTime: minToTime(slotMin), order });
    }

    return result;
  }

  // ── CASO 2: Múltiples profesionales — secuencial ─────────
  // Generar permutaciones de grupos de profesionales
  const groupKeys = Object.keys(profGroups); // [profId1, profId2, ...]
  const allPerms = permutations(groupKeys);
  const validSlots = new Map(); // startTime → primer order válido encontrado

  for (const perm of allPerms) {
    for (const slotMin of allSlots) {
      const startTime = minToTime(slotMin);

      // Si ya encontramos un order para este slot, no buscar más
      if (validSlots.has(startTime)) continue;

      let cursor = slotMin;
      const order = [];
      let valid = true;

      for (const profId of perm) {
        const services = profGroups[profId];
        const duration = services.reduce((s, sv) => s + (sv.duration || 0), 0);
        const endMin = cursor + duration;
        const window = profWindows[profId];
        const breaks = profBreaks[profId] || [];

        if (!isProfFree(profId, cursor, endMin, occupied, window, breaks)) {
          valid = false;
          break;
        }

        order.push({
          profId,
          services,
          start: minToTime(cursor),
          end: minToTime(endMin),
        });

        cursor = endMin; // el siguiente prof empieza cuando termina este
      }

      if (valid) {
        validSlots.set(startTime, { startTime, order });
      }
    }
  }

  // Ordenar por hora de inicio
  return [...validSlots.values()].sort(
    (a, b) => timeToMin(a.startTime) - timeToMin(b.startTime),
  );
}

/**
 * Resuelve los assignments "any" al profesional con menos
 * reservas ese día entre los disponibles para ese servicio.
 *
 * @param {Record<string,string>} assignments - puede tener "any"
 * @param {Array} selectedServices
 * @param {Array} professionals
 * @param {Array} existingBookings - bookings del día
 * @returns {Record<string,string>} assignments sin ningún "any"
 */
export function resolveAnyAssignments(
  assignments,
  selectedServices,
  professionals,
  existingBookings,
) {
  const resolved = { ...assignments };

  // Contar reservas que ocupan el slot por profesional (pending/confirmed)
  const bookingCount = {};
  for (const booking of existingBookings) {
    if (!isBookingOccupying(booking.status)) continue;
    for (const item of booking.items || []) {
      const pid = item.professionalId;
      bookingCount[pid] = (bookingCount[pid] || 0) + 1;
    }
  }

  for (const service of selectedServices) {
    if (resolved[service.id] !== "any") continue;

    const available = professionals.filter(
      (p) => p.isActive && service.professionalIds?.includes(p.id),
    );

    if (!available.length) continue;

    // Elegir el que tenga menos reservas, desempate por order
    const chosen = available.sort((a, b) => {
      const diff = (bookingCount[a.id] || 0) - (bookingCount[b.id] || 0);
      return diff !== 0 ? diff : (a.order ?? 0) - (b.order ?? 0);
    })[0];

    resolved[service.id] = chosen.id;
  }

  return resolved;
}

/**
 * Resolve which services get auto-assigned and which need user selection.
 * @param {Array} selectedServices - Services with id, professionalIds
 * @param {Array} professionals - All professionals with id
 * @param {string | null} profIdFixed - Optional fixed professional from query param
 * @returns {{ autoAssigned: Record<string, string>, needsSelection: string[] }}
 */
export function resolveAssignments(selectedServices, professionals, profIdFixed) {
  const autoAssigned = {};
  const needsSelection = [];

  const availableProfsByService = {};
  for (const service of selectedServices) {
    const ids = service.professionalIds || [];
    availableProfsByService[service.id] = professionals.filter((p) => ids.includes(p.id));
  }

  for (const service of selectedServices) {
    const available = availableProfsByService[service.id] || [];
    if (available.length === 0) continue;

    if (profIdFixed && available.some((p) => p.id === profIdFixed)) {
      autoAssigned[service.id] = profIdFixed;
      continue;
    }
    if (profIdFixed && !available.some((p) => p.id === profIdFixed)) {
      needsSelection.push(service.id);
      continue;
    }

    if (available.length === 1) {
      autoAssigned[service.id] = available[0].id;
    } else {
      needsSelection.push(service.id);
    }
  }

  return { autoAssigned, needsSelection };
}

/**
 * Merge user assignments (including 'any') with auto-assigned. Resolve 'any' to profId when needed elsewhere.
 * @param {Record<string, string>} assignments - may contain 'any'
 * @param {Record<string, string>} autoAssigned
 * @param {string[]} needsSelection
 * @returns {Record<string, string>} Final serviceId → professionalId (no 'any')
 */
export function mergeAssignments(assignments, autoAssigned, needsSelection) {
  const result = { ...autoAssigned };
  for (const serviceId of needsSelection) {
    const v = assignments[serviceId];
    if (v && v !== "any") result[serviceId] = v;
  }
  return result;
}

/**
 * Resolve 'any' to the professional with fewest bookings that day (call before calcAvailableSlots).
 * @param {Record<string, string>} assignments - may contain 'any'
 * @param {string[]} serviceIdsWithAny - service IDs that have assignment 'any'
 * @param {Array} selectedServices
 * @param {Array} professionals
 * @param {Array} existingBookings - bookings for the selected date
 * @returns {Record<string, string>} assignments with 'any' resolved to prof id
 */
export function resolveAnyAssignments(assignments, serviceIdsWithAny, selectedServices, professionals, existingBookings) {
  const result = { ...assignments };
  const bookingsByProf = {};
  for (const b of existingBookings) {
    for (const item of b.items || []) {
      const pid = item.professionalId;
      bookingsByProf[pid] = (bookingsByProf[pid] || 0) + 1;
    }
  }

  for (const serviceId of serviceIdsWithAny) {
    const service = selectedServices.find((s) => s.id === serviceId);
    if (!service) continue;
    const ids = service.professionalIds || [];
    const available = professionals.filter((p) => ids.includes(p.id));
    if (available.length === 0) continue;
    const leastBusy = available.reduce((a, b) =>
      (bookingsByProf[a.id] ?? 0) <= (bookingsByProf[b.id] ?? 0) ? a : b
    );
    result[serviceId] = leastBusy.id;
  }
  return result;
}

/**
 * Build the booking document for Firestore.
 * @param {object} bookingState - selectedDate, selectedSlot, clientName, clientPhone, clientEmail
 * @param {Array} selectedServices
 * @param {Record<string, string>} finalAssignments - serviceId → profId (no 'any')
 * @param {Array} professionals
 * @returns {object} Booking doc + totalDuration (for caller to add Timestamp etc)
 */
export function buildBookingDoc(bookingState, selectedServices, finalAssignments, professionals) {
  const { selectedDate, selectedSlot, clientName, clientPhone, clientEmail } = bookingState;
  const getProf = (id) => professionals.find((p) => p.id === id) || {};

  const profIds = [...new Set(Object.values(finalAssignments))];
  const isSingleProf = profIds.length === 1;

  const items = [];
  if (isSingleProf) {
    let currentStart = selectedSlot;
    for (const service of selectedServices) {
      const profId = finalAssignments[service.id];
      const prof = getProf(profId);
      const duration = service.duration ?? 0;
      const endTime = addMinutesToTime(currentStart, duration);
      items.push({
        serviceId: service.id,
        serviceName: service.name,
        professionalId: profId,
        professionalName: prof.name ?? "",
        professionalSlug: prof.slug ?? "",
        startTime: currentStart,
        endTime,
        price: service.price ?? 0,
        duration,
      });
      currentStart = endTime;
    }
  } else {
    for (const service of selectedServices) {
      const profId = finalAssignments[service.id];
      const prof = getProf(profId);
      const duration = service.duration ?? 0;
      const endTime = addMinutesToTime(selectedSlot, duration);
      items.push({
        serviceId: service.id,
        serviceName: service.name,
        professionalId: profId,
        professionalName: prof.name ?? "",
        professionalSlug: prof.slug ?? "",
        startTime: selectedSlot,
        endTime,
        price: service.price ?? 0,
        duration,
      });
    }
  }

  const totalPrice = items.reduce((sum, i) => sum + i.price, 0);
  const totalDuration = isSingleProf
    ? items.reduce((sum, i) => sum + i.duration, 0)
    : Math.max(...items.map((i) => i.duration), 0);

  return {
    clientName,
    clientPhone,
    clientEmail: clientEmail || "",
    items,
    totalPrice,
    totalDuration,
    selectedDate,
    selectedSlot,
  };
}

function addMinutesToTime(timeStr, minutes) {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

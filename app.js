/**
 * ═══════════════════════════════════════════════════════════
 * PLATZREIFE – Frontend JavaScript
 * Golfclub Metzenhof – Version 2.2 (17.01.2026) – Robuste Datumserkennung
 * ═══════════════════════════════════════════════════════════
 */

// ══════════════════════════════════════════════════════════════
// KONFIGURATION
// ══════════════════════════════════════════════════════════════

// WICHTIG: Hier die URL des Google Apps Script Web App eintragen!
const API_BASE = "https://script.google.com/macros/s/AKfycbzeT3syS3BN25_HR9QJ-qzHETYSTyz_Z61KxvIa8K0nr5b8XzIGr6A-FwyERn_DU3Dl_A/exec";

// Statische Termine 2026 (Fallback falls API nicht erreichbar)
const STATIC_DATES = [
  "2026-02-25", "2026-03-07", "2026-03-14", "2026-03-21", "2026-03-28",
  "2026-04-04", "2026-04-18", "2026-04-25", "2026-05-01", "2026-05-02",
  "2026-05-16", "2026-05-30", "2026-06-13", "2026-06-20", "2026-06-27",
  "2026-07-04", "2026-07-18", "2026-08-01", "2026-08-08", "2026-08-15",
  "2026-08-22", "2026-08-29", "2026-09-05", "2026-09-19", "2026-10-03",
  "2026-10-17"
];

// Kurszeiten
const COURSE_START = "09:00";
const COURSE_END = "15:00";
const MAX_CAPACITY = 8;

// ══════════════════════════════════════════════════════════════
// DOM ELEMENTE
// ══════════════════════════════════════════════════════════════

const elements = {
  monthFilter: document.getElementById("month-filter"),
  slotsContainer: document.getElementById("slots-container"),
  slotSelect: document.getElementById("slot-select"),
  bookingForm: document.getElementById("booking-form"),
  contactEmail: document.getElementById("contact-email"),
  contactPhone: document.getElementById("contact-phone"),
  participantCount: document.getElementById("participant-count"),
  participantsContainer: document.getElementById("participants-container"),
  agbCheckbox: document.getElementById("agb-checkbox"),
  privacyCheckbox: document.getElementById("privacy-checkbox"),
  submitBtn: document.getElementById("submit-btn"),
  formMessage: document.getElementById("form-message"),
  successSection: document.getElementById("success-section"),
  successBookingId: document.getElementById("success-booking-id"),
  successDate: document.getElementById("success-date"),
  successCount: document.getElementById("success-count"),
  successEmail: document.getElementById("success-email")
};

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════

let allSlots = [];
let selectedMonth = "";

// ══════════════════════════════════════════════════════════════
// HILFSFUNKTIONEN
// ══════════════════════════════════════════════════════════════

/**
 * Wochentag-Namen
 */
const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONTHS = ["Jänner", "Februar", "März", "April", "Mai", "Juni", 
                "Juli", "August", "September", "Oktober", "November", "Dezember"];

/**
 * Datum parsen: Unterstützt YYYY-MM-DD und DD.MM.YYYY
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  let year, month, day;
  
  if (dateStr.includes("-")) {
    [year, month, day] = dateStr.split("-").map(Number);
  } else if (dateStr.includes(".")) {
    [day, month, year] = dateStr.split(".").map(Number);
  } else {
    return null;
  }
  
  return { year, month, day };
}

/**
 * Datum formatieren: "2026-02-25" → "Mittwoch, 25.02.2026"
 */
function formatDate(dateStr) {
  const parsed = parseDate(dateStr);
  if (!parsed) return dateStr;
  
  const { year, month, day } = parsed;
  const date = new Date(year, month - 1, day);
  const weekday = WEEKDAYS[date.getDay()];
  return `${weekday}, ${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

/**
 * Kurzes Datum: "2026-02-25" → "25.02.2026"
 */
function formatDateShort(dateStr) {
  const parsed = parseDate(dateStr);
  if (!parsed) return dateStr;
  
  const { year, month, day } = parsed;
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

/**
 * Monat extrahieren: "2026-02-25" → "2026-02"
 */
function getMonth(dateStr) {
  const parsed = parseDate(dateStr);
  if (!parsed) return "";
  return `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
}

/**
 * Monat formatieren: "2026-02" → "Februar 2026"
 */
function formatMonth(monthStr) {
  if (!monthStr || !monthStr.includes("-")) return monthStr;
  const [year, month] = monthStr.split("-");
  return `${MONTHS[parseInt(month) - 1]} ${year}`;
}

/**
 * Prüfen ob Datum in der Zukunft liegt
 * Unterstützt YYYY-MM-DD und DD.MM.YYYY
 */
function isFuture(dateStr) {
  const parsed = parseDate(dateStr);
  if (!parsed) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { year, month, day } = parsed;
  const date = new Date(year, month - 1, day);
  return date >= today;
}

/**
 * Nachricht anzeigen
 */
function showMessage(text, type = "") {
  elements.formMessage.textContent = text;
  elements.formMessage.className = `message ${type}`;
}

/**
 * Nachricht leeren
 */
function clearMessage() {
  elements.formMessage.textContent = "";
  elements.formMessage.className = "message";
}

// ══════════════════════════════════════════════════════════════
// API FUNKTIONEN
// ══════════════════════════════════════════════════════════════

/**
 * Statische Slots generieren (Fallback)
 */
function generateStaticSlots() {
  return STATIC_DATES.filter(isFuture).map(date => ({
    slot_id: date,
    date: date,
    start: COURSE_START,
    end: COURSE_END,
    capacity: MAX_CAPACITY,
    booked: 0,
    free: MAX_CAPACITY,
    status: "OPEN"
  }));
}

/**
 * Slots vom Backend laden
 */
async function fetchSlots() {
  try {
    const response = await fetch(`${API_BASE}?action=slots`);
    if (!response.ok) throw new Error("API nicht erreichbar");
    const data = await response.json();
    const slots = data.slots || [];
    
    // Falls API keine Slots liefert, Fallback verwenden
    if (slots.length === 0) {
      console.warn("API liefert keine Slots, verwende statische Termine");
      return generateStaticSlots();
    }
    
    return slots;
  } catch (error) {
    console.warn("API nicht erreichbar, verwende statische Termine:", error);
    return generateStaticSlots();
  }
}

/**
 * Buchung an Backend senden
 */
async function submitBooking(payload) {
  const response = await fetch(`${API_BASE}?action=book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return await response.json();
}

// ══════════════════════════════════════════════════════════════
// RENDER FUNKTIONEN
// ══════════════════════════════════════════════════════════════

/**
 * Monatsfilter aufbauen
 */
function renderMonthFilter() {
  // Alle einzigartigen Monate sammeln
  const months = [...new Set(allSlots.map(s => getMonth(s.date)))].sort();
  
  elements.monthFilter.innerHTML = '<option value="">Alle Termine anzeigen</option>';
  months.forEach(month => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = formatMonth(month);
    elements.monthFilter.appendChild(option);
  });
}



/**
 * Slots-Übersicht – Modern & Einfach
 */
function renderSlots() {
  // Robuste Slot-Extraktion
  const futureSlots = allSlots
    .map(slot => {
      const dateStr = slot.date || slot.slot_id || "";
      const capacity = parseInt(slot.capacity) || MAX_CAPACITY;
      const booked = parseInt(slot.booked) || 0;
      return { ...slot, date: dateStr, capacity, booked };
    })
    .filter(s => s.date && isFuture(s.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  const container = document.getElementById("slots-container");
  if (!container) {
    console.error("slots-container nicht gefunden");
    return;
  }
  
  console.log(`${futureSlots.length} zukünftige Termine für Anzeige`);
  
  if (futureSlots.length === 0) {
    container.innerHTML = '<div class="slots-empty">Aktuell keine Termine verfügbar.</div>';
    return;
  }
  
  // Moderne Chip-Ansicht
  container.innerHTML = futureSlots.map(slot => {
    const free = slot.capacity - slot.booked;
    let statusClass = "open";
    let statusText = `${free} frei`;
    
    if (free === 0) {
      statusClass = "full";
      statusText = "ausgebucht";
    } else if (free <= 2) {
      statusClass = "few";
      statusText = `nur ${free} frei`;
    }
    
    // Formatierung: "Mi 25. Feb"
    const parsed = parseDate(slot.date);
    if (!parsed) return "";
    
    const dateObj = new Date(parsed.year, parsed.month - 1, parsed.day);
    const weekday = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][dateObj.getDay()];
    const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    const displayDate = `${weekday} ${parsed.day}. ${monthNames[parsed.month - 1]}`;
    
    return `<div class="slot-chip ${statusClass}">
      <span class="chip-date">${displayDate}</span>
      <span class="chip-status">${statusText}</span>
    </div>`;
  }).join("");
}

/**
 * Slot-Dropdown für Buchung rendern
 */
function renderSlotSelect() {
  // Nur buchbare Slots (Zukunft + freie Plätze)
  const bookableSlots = allSlots.filter(slot => {
    // Robuste Prüfung
    const dateStr = slot.date || slot.slot_id;
    if (!dateStr) return false;
    
    const capacity = parseInt(slot.capacity) || MAX_CAPACITY;
    const booked = parseInt(slot.booked) || 0;
    const free = capacity - booked;
    
    return isFuture(dateStr) && free > 0;
  });
  
  console.log(`${bookableSlots.length} buchbare Termine gefunden`);
  
  elements.slotSelect.innerHTML = '<option value="">Bitte wählen...</option>';
  
  bookableSlots.forEach(slot => {
    const capacity = parseInt(slot.capacity) || MAX_CAPACITY;
    const booked = parseInt(slot.booked) || 0;
    const free = capacity - booked;
    const dateStr = slot.date || slot.slot_id;
    const start = slot.start || COURSE_START;
    const end = slot.end || COURSE_END;
    
    const option = document.createElement("option");
    option.value = slot.slot_id || dateStr;
    option.textContent = `${formatDate(dateStr)} · ${start}–${end} Uhr · ${free} frei`;
    option.dataset.free = free;
    option.dataset.date = dateStr;
    elements.slotSelect.appendChild(option);
  });
}

/**
 * Teilnehmerfelder rendern (inkl. Kontaktdaten)
 */
function renderParticipants(count) {
  elements.participantsContainer.innerHTML = "";
  
  for (let i = 0; i < count; i++) {
    const box = document.createElement("div");
    box.className = "participant-box";
    
    // Für den ersten Teilnehmer zusätzlich E-Mail und Handynummer abfragen
    const contactFields = i === 0 ? `
        <label>
          E-Mail-Adresse
          <input type="email" name="email_${i}" id="participant-email-0" placeholder="ihre@email.at" required>
        </label>
        <label>
          Handynummer
          <input type="tel" name="phone_${i}" id="participant-phone-0" placeholder="+43 664 1234567" required>
        </label>
    ` : '';
    
    box.innerHTML = `
      <h4>Teilnehmer ${i + 1}${i === 0 ? ' (Ansprechpartner)' : ''}</h4>
      <div class="form-grid">
        <label>
          Vorname
          <input type="text" name="first_name_${i}" required>
        </label>
        <label>
          Nachname
          <input type="text" name="last_name_${i}" required>
        </label>
        ${contactFields}
        <label>
          Straße
          <input type="text" name="street_${i}" required>
        </label>
        <label>
          Hausnummer
          <input type="text" name="house_no_${i}" required>
        </label>
        <label>
          PLZ
          <input type="text" name="zip_${i}" required pattern="[0-9]{4,5}">
        </label>
        <label>
          Ort
          <input type="text" name="city_${i}" required>
        </label>
      </div>
    `;
    elements.participantsContainer.appendChild(box);
  }
}

/**
 * Erfolgsanzeige rendern
 */
function showSuccess(bookingId, date, count, email) {
  // Formular verstecken
  document.querySelectorAll(".card").forEach(card => {
    if (!card.classList.contains("success-card")) {
      card.classList.add("hidden");
    }
  });
  
  // Erfolgsanzeige befüllen und zeigen
  elements.successBookingId.textContent = bookingId;
  elements.successDate.textContent = formatDate(date);
  elements.successCount.textContent = `${count} ${count === 1 ? "Person" : "Personen"}`;
  elements.successEmail.textContent = email;
  elements.successSection.classList.remove("hidden");
  
  // Nach oben scrollen
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ══════════════════════════════════════════════════════════════
// EVENT HANDLER
// ══════════════════════════════════════════════════════════════

/**
 * Monatsfilter ändern
 */
elements.monthFilter.addEventListener("change", (e) => {
  selectedMonth = e.target.value;
  renderSlots();
});

/**
 * Slot-Auswahl ändern → Max Teilnehmer anpassen
 */
elements.slotSelect.addEventListener("change", (e) => {
  const selected = e.target.options[e.target.selectedIndex];
  if (selected && selected.dataset.free) {
    const maxFree = parseInt(selected.dataset.free);
    elements.participantCount.max = Math.min(maxFree, MAX_CAPACITY);
    
    // Falls aktuelle Anzahl > verfügbar, reduzieren
    if (parseInt(elements.participantCount.value) > maxFree) {
      elements.participantCount.value = maxFree;
      renderParticipants(maxFree);
    }
  }
});

/**
 * Teilnehmeranzahl ändern
 */
elements.participantCount.addEventListener("input", (e) => {
  let count = parseInt(e.target.value) || 1;
  count = Math.max(1, Math.min(count, parseInt(e.target.max) || MAX_CAPACITY));
  e.target.value = count;
  renderParticipants(count);
});

/**
 * Formular absenden
 */
elements.bookingForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();
  
  // Validierung
  const slotId = elements.slotSelect.value;
  if (!slotId) {
    showMessage("Bitte wählen Sie einen Termin.", "error");
    return;
  }
  
  const count = parseInt(elements.participantCount.value);
  if (count < 1 || count > MAX_CAPACITY) {
    showMessage("Ungültige Teilnehmeranzahl.", "error");
    return;
  }
  
  // E-Mail und Handynummer vom ersten Teilnehmer holen
  const emailInput = document.getElementById("participant-email-0");
  const phoneInput = document.getElementById("participant-phone-0");
  
  const email = emailInput ? emailInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim() : "";
  
  if (!email) {
    showMessage("Bitte geben Sie die E-Mail-Adresse des Ansprechpartners ein.", "error");
    return;
  }
  
  if (!phone) {
    showMessage("Bitte geben Sie die Handynummer des Ansprechpartners ein.", "error");
    return;
  }
  
  if (!elements.agbCheckbox.checked || !elements.privacyCheckbox.checked) {
    showMessage("Bitte akzeptieren Sie die AGB und Datenschutzerklärung.", "error");
    return;
  }
  
  // Teilnehmerdaten sammeln
  const participants = [];
  for (let i = 0; i < count; i++) {
    const firstName = document.querySelector(`[name="first_name_${i}"]`).value.trim();
    const lastName = document.querySelector(`[name="last_name_${i}"]`).value.trim();
    const street = document.querySelector(`[name="street_${i}"]`).value.trim();
    const houseNo = document.querySelector(`[name="house_no_${i}"]`).value.trim();
    const zip = document.querySelector(`[name="zip_${i}"]`).value.trim();
    const city = document.querySelector(`[name="city_${i}"]`).value.trim();
    
    if (!firstName || !lastName || !street || !houseNo || !zip || !city) {
      showMessage(`Bitte füllen Sie alle Felder für Teilnehmer ${i + 1} aus.`, "error");
      return;
    }
    
    participants.push({
      first_name: firstName,
      last_name: lastName,
      street: street,
      house_no: houseNo,
      zip: zip,
      city: city
    });
  }
  
  // Payload zusammenstellen
  const payload = {
    slot_id: slotId,
    contact_email: email,
    contact_phone: phone,
    participants: participants,
    agb_accepted: true,
    privacy_accepted: true
  };
  
  // Button deaktivieren
  elements.submitBtn.disabled = true;
  elements.submitBtn.textContent = "Wird gesendet...";
  showMessage("Buchung wird verarbeitet...", "loading");
  
  try {
    const result = await submitBooking(payload);
    
    if (result.ok) {
      // Erfolg!
      const selectedOption = elements.slotSelect.options[elements.slotSelect.selectedIndex];
      showSuccess(result.booking_id, selectedOption.dataset.date, count, email);
    } else {
      // Fehler vom Backend
      showMessage(result.message || "Buchung fehlgeschlagen. Bitte versuchen Sie es erneut.", "error");
      elements.submitBtn.disabled = false;
      elements.submitBtn.textContent = "Verbindlich buchen";
    }
  } catch (error) {
    console.error("Buchungsfehler:", error);
    showMessage("Verbindungsfehler. Bitte versuchen Sie es später erneut.", "error");
    elements.submitBtn.disabled = false;
    elements.submitBtn.textContent = "Verbindlich buchen";
  }
});

// ══════════════════════════════════════════════════════════════
// INITIALISIERUNG
// ══════════════════════════════════════════════════════════════

async function init() {
  // Slots laden (mit Timeout-Fallback)
  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout")), 5000)
    );
    allSlots = await Promise.race([fetchSlots(), timeoutPromise]);
  } catch (error) {
    console.warn("Fallback auf statische Termine:", error);
    allSlots = generateStaticSlots();
  }
  
  // Sicherstellen, dass immer Slots vorhanden sind
  if (!allSlots || allSlots.length === 0) {
    console.warn("Keine Slots geladen, verwende statische Termine");
    allSlots = generateStaticSlots();
  }
  
  console.log(`${allSlots.length} Termine geladen`);
  console.log("Erster Slot:", JSON.stringify(allSlots[0]));
  
  // Debug: Prüfen wie viele Termine in Zukunft liegen
  const today = new Date().toISOString().split("T")[0];
  console.log("Heute:", today);
  const futureCount = allSlots.filter(s => {
    const d = s.date || s.slot_id;
    return d && d >= today;
  }).length;
  console.log(`${futureCount} Termine in der Zukunft`);
  
  // UI rendern
  renderMonthFilter();
  renderSlots();
  renderSlotSelect();
  renderParticipants(1);
}



// Start
init();


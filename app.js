/**
 * ═══════════════════════════════════════════════════════════
 * PLATZREIFE – Frontend JavaScript
 * Golfclub Metzenhof
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
 * Datum formatieren: "2026-02-25" → "Mittwoch, 25.02.2026"
 */
function formatDate(dateStr) {
  const [year, month, day] = dateStr.split("-");
  const date = new Date(year, month - 1, day);
  const weekday = WEEKDAYS[date.getDay()];
  return `${weekday}, ${day}.${month}.${year}`;
}

/**
 * Kurzes Datum: "2026-02-25" → "25.02.2026"
 */
function formatDateShort(dateStr) {
  const [year, month, day] = dateStr.split("-");
  return `${day}.${month}.${year}`;
}

/**
 * Monat extrahieren: "2026-02-25" → "2026-02"
 */
function getMonth(dateStr) {
  return dateStr.substring(0, 7);
}

/**
 * Monat formatieren: "2026-02" → "Februar 2026"
 */
function formatMonth(monthStr) {
  const [year, month] = monthStr.split("-");
  return `${MONTHS[parseInt(month) - 1]} ${year}`;
}

/**
 * Prüfen ob Datum in der Zukunft liegt
 */
function isFuture(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = dateStr.split("-");
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
 * Slots vom Backend laden
 */
async function fetchSlots() {
  try {
    const response = await fetch(`${API_BASE}?action=slots`);
    if (!response.ok) throw new Error("API nicht erreichbar");
    const data = await response.json();
    return data.slots || [];
  } catch (error) {
    console.warn("API nicht erreichbar, verwende statische Termine:", error);
    // Fallback: Statische Termine mit voller Kapazität
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
 * Slots-Übersicht als Tabelle rendern
 */
function renderSlots() {
  // Nach Monat filtern
  const filteredSlots = selectedMonth 
    ? allSlots.filter(s => getMonth(s.date) === selectedMonth)
    : allSlots;
  
  // Nur zukünftige Termine
  const futureSlots = filteredSlots.filter(s => isFuture(s.date));
  
  // Tabellen-Body Element finden
  const tbody = document.getElementById("slots-tbody");
  if (!tbody) {
    console.error("slots-tbody nicht gefunden");
    return;
  }
  
  if (futureSlots.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="no-slots">Keine Termine verfügbar.</td></tr>';
    return;
  }
  
  tbody.innerHTML = futureSlots.map(slot => {
    const free = slot.capacity - slot.booked;
    let availClass = "available";
    let availText = `${free} Plätze`;
    
    if (free === 0) {
      availClass = "full";
      availText = "Ausgebucht";
    } else if (free <= 2) {
      availClass = "few";
      availText = `${free} ${free === 1 ? "Platz" : "Plätze"}`;
    }
    
    return `
      <tr>
        <td class="slot-date-cell">${formatDate(slot.date)}</td>
        <td class="slot-time-cell">${slot.start}–${slot.end} Uhr</td>
        <td class="slot-free-cell">
          <span class="slot-free-badge ${availClass}">${availText}</span>
        </td>
      </tr>
    `;
  }).join("");
}

/**
 * Slot-Dropdown für Buchung rendern
 */
function renderSlotSelect() {
  // Nur buchbare Slots (Zukunft + freie Plätze)
  const bookableSlots = allSlots.filter(s => 
    isFuture(s.date) && (s.capacity - s.booked) > 0
  );
  
  elements.slotSelect.innerHTML = '<option value="">Bitte wählen...</option>';
  bookableSlots.forEach(slot => {
    const free = slot.capacity - slot.booked;
    const option = document.createElement("option");
    option.value = slot.slot_id;
    option.textContent = `${formatDate(slot.date)} · ${slot.start}–${slot.end} Uhr · ${free} frei`;
    option.dataset.free = free;
    option.dataset.date = slot.date;
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
  // Slots laden
  allSlots = await fetchSlots();
  
  // UI rendern
  renderMonthFilter();
  renderSlots();
  renderSlotSelect();
  renderParticipants(1);
}

// Start
init();


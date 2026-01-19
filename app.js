/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PLATZREIFE BUCHUNGSSYSTEM – VERSION 4.2
 * Golfclub Metzenhof – 17.01.2026 – Verbesserte Buchungsseite
 * 
 * Zwei-Seiten-System:
 * - index.html: Terminübersicht (klickbar → weiter zu buchen.html)
 * - buchen.html: Buchungsformular mit vorausgewähltem Termin
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ══════════════════════════════════════════════════════════════════════════════
// KONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbzqu4baOn_qlzcQkeNK6NumYOEhRwTfGP-QbLKDtb8fi49MMq-TStg5-ZYevPUgYOq3/exec",
  MAX_PARTICIPANTS: 8,
  COURSE_START: "09:00",
  COURSE_END: "15:00",
  
  // Feste Termine 2026 (Fallback)
  DATES_2026: [
    "2026-02-25", "2026-02-28", "2026-03-04", "2026-03-07", "2026-03-11",
    "2026-03-14", "2026-03-18", "2026-03-21", "2026-03-25", "2026-03-28",
    "2026-04-01", "2026-04-04", "2026-04-08", "2026-04-11", "2026-04-15",
    "2026-04-18", "2026-04-22", "2026-04-25", "2026-04-29", "2026-05-02",
    "2026-05-06", "2026-05-09", "2026-05-13", "2026-09-16", "2026-10-14",
    "2026-10-17"
  ]
};

// ══════════════════════════════════════════════════════════════════════════════
// HILFSFUNKTIONEN
// ══════════════════════════════════════════════════════════════════════════════

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/**
 * Datum parsen - unterstützt viele Formate
 */
function parseDate(input) {
  if (!input) return null;
  
  let dateObj;
  
  if (input instanceof Date) {
    dateObj = input;
  } else if (typeof input === "number") {
    dateObj = new Date(input);
  } else if (typeof input === "string") {
    const str = input.trim();
    
    if (str.includes("T")) {
      dateObj = new Date(str);
    } else if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y, m, d] = str.split("-").map(Number);
      return { year: y, month: m, day: d };
    } else if (str.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) {
      const [d, m, y] = str.split(".").map(Number);
      return { year: y, month: m, day: d };
    } else {
      dateObj = new Date(str);
    }
  } else {
    return null;
  }
  
  if (dateObj && !isNaN(dateObj.getTime())) {
    return {
      year: dateObj.getFullYear(),
      month: dateObj.getMonth() + 1,
      day: dateObj.getDate()
    };
  }
  
  return null;
}

/**
 * Datum formatieren: "Mittwoch, 25.02.2026"
 */
function formatDateLong(str) {
  const p = parseDate(str);
  if (!p) return str;
  
  const date = new Date(p.year, p.month - 1, p.day);
  const wd = WEEKDAYS[date.getDay()];
  return `${wd}, ${String(p.day).padStart(2, "0")}.${String(p.month).padStart(2, "0")}.${p.year}`;
}

/**
 * Datum formatieren kurz: "25.02.2026"
 */
function formatDateShort(str) {
  const p = parseDate(str);
  if (!p) return str;
  return `${String(p.day).padStart(2, "0")}.${String(p.month).padStart(2, "0")}.${p.year}`;
}

/**
 * Prüfen ob Datum heute oder in der Zukunft liegt
 */
function isFuture(str) {
  const p = parseDate(str);
  if (!p) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const date = new Date(p.year, p.month - 1, p.day);
  return date >= today;
}

/**
 * URL-Parameter auslesen
 */
function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/**
 * Nachricht anzeigen
 */
function showMessage(text, type = "info") {
  const msgEl = document.getElementById("message");
  if (!msgEl) return;
  
  msgEl.textContent = text;
  msgEl.className = `message ${type}`;
  msgEl.style.display = "block";
  
  if (type !== "error") {
    setTimeout(() => { msgEl.style.display = "none"; }, 5000);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SLOTS / TERMINE
// ══════════════════════════════════════════════════════════════════════════════

let allSlots = [];

/**
 * Statische Slots generieren (Fallback)
 */
function generateStaticSlots() {
  return CONFIG.DATES_2026
    .filter(isFuture)
    .map(date => ({
      slot_id: date,
      date: date,
      start: CONFIG.COURSE_START,
      end: CONFIG.COURSE_END,
      capacity: CONFIG.MAX_PARTICIPANTS,
      booked: 0
    }));
}

/**
 * Slots von API laden
 */
async function fetchSlots() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${CONFIG.API_URL}?action=slots`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (!response.ok) throw new Error("API Error");
    
    const data = await response.json();
    const slots = data.slots || [];
    
    if (slots.length === 0) {
      console.log("API leer, verwende statische Termine");
      return generateStaticSlots();
    }
    
    // Prüfen ob zukünftige Termine vorhanden
    const futureSlots = slots.filter(s => isFuture(s.date || s.slot_id));
    if (futureSlots.length === 0) {
      console.log("Keine zukünftigen Termine in API, verwende statische");
      return generateStaticSlots();
    }
    
    return slots;
  } catch (e) {
    console.log("API nicht erreichbar:", e.message);
    return generateStaticSlots();
  }
}

/**
 * ISO-Datum zu YYYY-MM-DD konvertieren
 */
function toDateId(input) {
  const p = parseDate(input);
  if (!p) return input;
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * Slot normalisieren
 */
function normalizeSlot(s) {
  const rawDate = s.date || s.slot_id || "";
  const dateId = toDateId(rawDate); // Konvertiere zu YYYY-MM-DD
  
  return {
    id: dateId, // Immer YYYY-MM-DD als ID
    date: rawDate,
    dateId: dateId,
    capacity: parseInt(s.capacity) || CONFIG.MAX_PARTICIPANTS,
    booked: parseInt(s.booked) || 0,
    start: s.start || CONFIG.COURSE_START,
    end: s.end || CONFIG.COURSE_END
  };
}

/**
 * Slot nach ID finden (sucht nach dateId im YYYY-MM-DD Format)
 */
function findSlotById(slotId) {
  // Normalisiere die gesuchte ID auch zu YYYY-MM-DD
  const searchId = toDateId(slotId) || slotId;
  
  return allSlots.find(s => {
    const normalized = normalizeSlot(s);
    return normalized.dateId === searchId || normalized.id === searchId;
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// INDEX.HTML – TERMINÜBERSICHT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Termine-Grid rendern (index.html)
 */
function renderTermineGrid() {
  const container = document.getElementById("slots-container");
  if (!container) return;
  
  // Slots normalisieren
  const normalized = allSlots.map(normalizeSlot);
  
  // Deduplizieren nach dateId (YYYY-MM-DD)
  const uniqueMap = new Map();
  for (const slot of normalized) {
    if (!slot.dateId || !isFuture(slot.date)) continue;
    
    // Wenn Datum schon existiert, Buchungen addieren
    if (uniqueMap.has(slot.dateId)) {
      const existing = uniqueMap.get(slot.dateId);
      existing.booked = Math.max(existing.booked, slot.booked);
    } else {
      uniqueMap.set(slot.dateId, { ...slot });
    }
  }
  
  // Zu Array konvertieren und sortieren
  const slots = Array.from(uniqueMap.values())
    .sort((a, b) => {
      const pa = parseDate(a.date);
      const pb = parseDate(b.date);
      if (!pa || !pb) return 0;
      return new Date(pa.year, pa.month - 1, pa.day) - new Date(pb.year, pb.month - 1, pb.day);
    });
  
  console.log(`${slots.length} einzigartige zukünftige Termine`);
  
  if (slots.length === 0) {
    container.innerHTML = `
      <div class="termine-error">
        <p class="error-text">Termine konnten nicht geladen werden.</p>
        <button type="button" class="btn-reload" onclick="window.location.reload()">
          🔄 Erneut laden
        </button>
        <p class="error-contact">
          Wenn das Problem bleibt, kontaktiere uns: 
          <a href="mailto:info@metzenhof.at">info@metzenhof.at</a>
        </p>
      </div>
    `;
    return;
  }
  
  // HTML generieren – Klickbare Karten mit erweiterten Infos
  container.innerHTML = slots.map(slot => {
    const p = parseDate(slot.date);
    if (!p) return "";
    
    const free = slot.capacity - slot.booked;
    const dateObj = new Date(p.year, p.month - 1, p.day);
    const isBookable = free > 0;
    
    let statusClass = "open";
    let statusText = `${free} von ${slot.capacity} Plätzen frei`;
    
    if (free === 0) {
      statusClass = "full";
      statusText = "Ausgebucht";
    } else if (free <= 2) {
      statusClass = "few";
      statusText = `Nur noch ${free} Plätze frei`;
    }
    
    // Klickbar nur wenn buchbar
    const clickAttr = isBookable 
      ? `onclick="selectSlot('${slot.id}')" style="cursor:pointer;"` 
      : 'style="opacity:0.5; cursor:not-allowed;"';
    
    return `
      <div class="termin-card ${statusClass}" ${clickAttr} title="${isBookable ? 'Termin auswählen' : 'Ausgebucht'}">
        <div class="termin-datum">
          <div class="termin-weekday">${WEEKDAYS[dateObj.getDay()]}</div>
          <div class="termin-date">${String(p.day).padStart(2, "0")}.${String(p.month).padStart(2, "0")}.${p.year}</div>
        </div>
        <div class="termin-details">
          <div class="termin-info-row">
            <span class="info-icon">🕐</span>
            <span class="info-text">${CONFIG.COURSE_START}–${CONFIG.COURSE_END} Uhr</span>
          </div>
          <div class="termin-info-row">
            <span class="info-icon">👥</span>
            <span class="info-text status-${statusClass}">${statusText}</span>
          </div>
          <div class="termin-verbindlich">⚡ verbindlicher Termin</div>
        </div>
        ${isBookable 
          ? '<button type="button" class="termin-cta">Termin auswählen & weiter</button>' 
          : '<div class="termin-cta-disabled">Nicht verfügbar</div>'
        }
      </div>
    `;
  }).join("");
}

/**
 * Termin auswählen → Weiterleitung zur Buchungsseite
 */
function selectSlot(slotId) {
  window.location.href = `buchen.html?slot=${encodeURIComponent(slotId)}`;
}

// Global verfügbar machen
window.selectSlot = selectSlot;

// ══════════════════════════════════════════════════════════════════════════════
// BUCHEN.HTML – BUCHUNGSFORMULAR
// ══════════════════════════════════════════════════════════════════════════════

let selectedSlot = null;

/**
 * Buchungsseite initialisieren
 */
function initBookingPage() {
  const slotId = getUrlParam("slot");
  
  if (!slotId) {
    showNoSlotError();
    return;
  }
  
  // Slot finden
  const rawSlot = findSlotById(slotId);
  
  if (!rawSlot) {
    // Slot nicht in API gefunden – versuche als statischen Termin
    if (isFuture(slotId)) {
      selectedSlot = {
        id: slotId,
        date: slotId,
        capacity: CONFIG.MAX_PARTICIPANTS,
        booked: 0,
        start: CONFIG.COURSE_START,
        end: CONFIG.COURSE_END
      };
    } else {
      showNoSlotError();
      return;
    }
  } else {
    selectedSlot = normalizeSlot(rawSlot);
  }
  
  const free = selectedSlot.capacity - selectedSlot.booked;
  
  if (free <= 0) {
    showNoSlotError("Dieser Termin ist leider ausgebucht.");
    return;
  }
  
  // UI anzeigen
  displaySelectedSlot();
  setupBookingForm(free);
  renderParticipants(1);
}

/**
 * Fehleranzeige wenn kein Slot gewählt
 */
function showNoSlotError(message = null) {
  const formSection = document.querySelector(".booking-form-section");
  const errorSection = document.getElementById("no-slot-section");
  
  if (formSection) formSection.style.display = "none";
  if (errorSection) {
    errorSection.style.display = "block";
    if (message) {
      const p = errorSection.querySelector("p");
      if (p) p.textContent = message;
    }
  }
}

/**
 * Uhrzeit formatieren: "09:00" → "09:00 Uhr"
 */
function formatTime(timeStr) {
  if (!timeStr) return "";
  // Falls ISO-Format, nur Stunden:Minuten extrahieren
  if (timeStr.includes("T")) {
    const date = new Date(timeStr);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} Uhr`;
  }
  // Falls bereits "HH:MM" Format
  return timeStr.includes("Uhr") ? timeStr : `${timeStr} Uhr`;
}

/**
 * Gewählten Termin anzeigen
 */
function displaySelectedSlot() {
  if (!selectedSlot) return;
  
  const free = selectedSlot.capacity - selectedSlot.booked;
  
  // Header Badge
  const headerText = document.getElementById("selected-date-text");
  if (headerText) {
    headerText.textContent = formatDateLong(selectedSlot.date);
  }
  
  // Info-Card im Formular
  const infoDate = document.getElementById("slot-info-date");
  const infoTime = document.getElementById("slot-info-time");
  const infoFree = document.getElementById("slot-info-free");
  const hiddenInput = document.getElementById("slot_id");
  
  if (infoDate) infoDate.textContent = formatDateLong(selectedSlot.date);
  
  // Neues Uhrzeit-Format
  if (infoTime) {
    const startTime = formatTime(selectedSlot.start);
    const endTime = formatTime(selectedSlot.end);
    infoTime.innerHTML = `
      <span class="time-label">Kurszeit:</span>
      <span class="time-value">${startTime} bis ${endTime}</span>
    `;
  }
  
  // Freie Plätze mit Icon
  if (infoFree) {
    if (free <= 2) {
      infoFree.innerHTML = `<span class="free-warning">⚠️ Nur noch ${free} ${free === 1 ? 'Platz' : 'Plätze'} frei!</span>`;
    } else {
      infoFree.textContent = `✓ ${free} Plätze frei`;
    }
  }
  
  if (hiddenInput) hiddenInput.value = selectedSlot.id;
}

/**
 * Buchungsformular Setup
 */
function setupBookingForm(maxParticipants) {
  const countInput = document.getElementById("participants_count");
  const minusBtn = document.getElementById("count-minus");
  const plusBtn = document.getElementById("count-plus");
  
  // Hilfsfunktion: Wert aktualisieren
  function updateCount(newVal) {
    const val = Math.max(1, Math.min(maxParticipants, newVal));
    countInput.value = val;
    renderParticipants(val);
    
    // Buttons aktivieren/deaktivieren
    if (minusBtn) minusBtn.disabled = val <= 1;
    if (plusBtn) plusBtn.disabled = val >= maxParticipants;
  }
  
  if (countInput) {
    countInput.max = maxParticipants;
    countInput.value = 1;
    
    // Minus Button
    if (minusBtn) {
      minusBtn.disabled = true; // Initial deaktiviert bei 1
      minusBtn.addEventListener("click", () => {
        updateCount(parseInt(countInput.value) - 1);
      });
    }
    
    // Plus Button
    if (plusBtn) {
      plusBtn.disabled = maxParticipants <= 1;
      plusBtn.addEventListener("click", () => {
        updateCount(parseInt(countInput.value) + 1);
      });
    }
    
    // Direkte Eingabe (falls readonly entfernt wird)
    countInput.addEventListener("input", (e) => {
      updateCount(parseInt(e.target.value) || 1);
    });
  }
  
  const form = document.getElementById("booking-form");
  if (form) {
    form.addEventListener("submit", handleSubmit);
  }
  
  const newBookingBtn = document.getElementById("new-booking");
  if (newBookingBtn) {
    newBookingBtn.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }
}

/**
 * Teilnehmerfelder rendern
 */
function renderParticipants(count) {
  const container = document.getElementById("participants");
  if (!container) return;
  
  container.innerHTML = "";
  
  for (let i = 0; i < count; i++) {
    const isFirst = i === 0;
    const html = `
      <fieldset class="participant-fieldset">
        <legend>Teilnehmer ${i + 1}${isFirst ? " (Kontakt)" : ""}</legend>
        
        <div class="form-row">
          <label>
            Vorname *
            <input type="text" name="p${i}_first" required>
          </label>
          <label>
            Nachname *
            <input type="text" name="p${i}_last" required>
          </label>
        </div>
        
        <div class="form-row">
          <label>
            Straße *
            <input type="text" name="p${i}_street" required>
          </label>
          <label class="small">
            Hausnr. *
            <input type="text" name="p${i}_house" required>
          </label>
        </div>
        
        <div class="form-row">
          <label class="small">
            PLZ *
            <input type="text" name="p${i}_zip" required pattern="[0-9]{4,5}">
          </label>
          <label>
            Ort *
            <input type="text" name="p${i}_city" required>
          </label>
        </div>
        
        ${isFirst ? `
          <div class="form-row">
            <label>
              E-Mail *
              <input type="email" name="contact_email" required placeholder="max.mustermann@email.at">
            </label>
            <label>
              Telefon *
              <input type="tel" name="contact_phone" required placeholder="+43 664 1234567">
            </label>
          </div>
        ` : ""}
      </fieldset>
    `;
    container.insertAdjacentHTML("beforeend", html);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// BUCHUNG ABSENDEN
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Formular verarbeiten
 */
async function handleSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');
  
  btn.disabled = true;
  btn.textContent = "Wird gesendet...";
  
  try {
    const slotId = formData.get("slot_id");
    const count = parseInt(formData.get("participants_count")) || 1;
    const email = formData.get("contact_email");
    const phone = formData.get("contact_phone") || "";
    
    if (!slotId) throw new Error("Kein Termin gewählt.");
    if (!email) throw new Error("Bitte E-Mail eingeben.");
    if (!phone) throw new Error("Bitte Telefonnummer eingeben.");
    
    const participants = [];
    for (let i = 0; i < count; i++) {
      participants.push({
        first_name: formData.get(`p${i}_first`) || "",
        last_name: formData.get(`p${i}_last`) || "",
        street: formData.get(`p${i}_street`) || "",
        house_no: formData.get(`p${i}_house`) || "",
        zip: formData.get(`p${i}_zip`) || "",
        city: formData.get(`p${i}_city`) || ""
      });
    }
    
    // AGB und Datenschutz Checkboxen prüfen
    const agbCheckbox = document.getElementById("agb_accepted");
    const privacyCheckbox = document.getElementById("privacy_accepted");
    
    const agbAccepted = agbCheckbox ? agbCheckbox.checked : false;
    const privacyAccepted = privacyCheckbox ? privacyCheckbox.checked : false;
    
    if (!agbAccepted || !privacyAccepted) {
      throw new Error("Bitte akzeptiere die AGB und Datenschutzerklärung.");
    }
    
    const payload = {
      slot_id: slotId,
      contact_email: email,
      contact_phone: phone,
      participants_count: count,
      participants: participants,
      agb_accepted: agbAccepted,
      privacy_accepted: privacyAccepted
    };
    
    console.log("Sende Buchung:", payload);
    
    // Google Apps Script: GET-Request mit Base64-kodierten Daten (CORS-sicher)
    const payloadBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const bookingUrl = `${CONFIG.API_URL}?action=book&data=${encodeURIComponent(payloadBase64)}`;
    
    console.log("Buchungs-URL:", bookingUrl);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    try {
      const response = await fetch(bookingUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      const result = await response.json();
      console.log("Server-Antwort:", result);
      
      if (result.success || result.ok) {
        showSuccess(result.booking_id, slotId, count, email, result.email_sent);
      } else {
        throw new Error(result.error || result.message || "Buchung fehlgeschlagen.");
      }
      
    } catch (fetchError) {
      clearTimeout(timeout);
      console.error("Fetch-Fehler:", fetchError);
      
      if (fetchError.name === "AbortError") {
        throw new Error("Zeitüberschreitung. Bitte versuche es erneut.");
      }
      
      throw new Error("Verbindungsfehler. Bitte versuche es erneut.");
    }
    
  } catch (error) {
    showMessage(error.message, "error");
    btn.disabled = false;
    btn.textContent = "Verbindlich buchen";
  }
}

/**
 * Erfolgsanzeige
 */
function showSuccess(bookingId, slotId, count, email, emailSent) {
  const formSection = document.querySelector(".booking-form-section");
  const successSection = document.getElementById("success-section");
  
  if (formSection) formSection.style.display = "none";
  
  if (successSection) {
    successSection.style.display = "block";
    
    const idEl = document.getElementById("success-id");
    const dateEl = document.getElementById("success-date");
    const countEl = document.getElementById("success-count");
    const emailEl = document.getElementById("success-email");
    const emailStatusEl = document.getElementById("email-status-text");
    
    if (idEl) idEl.textContent = bookingId || "–";
    if (dateEl) dateEl.textContent = formatDateLong(slotId);
    if (countEl) countEl.textContent = count;
    if (emailEl) emailEl.textContent = email;
    
    // E-Mail-Status anzeigen
    if (emailStatusEl) {
      if (emailSent) {
        emailStatusEl.textContent = "Eine Bestätigungs-E-Mail mit allen Details wurde an Sie gesendet.";
      } else {
        emailStatusEl.textContent = "Ihre Buchung wurde erfolgreich registriert.";
      }
    }
  }
  
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ══════════════════════════════════════════════════════════════════════════════
// INITIALISIERUNG
// ══════════════════════════════════════════════════════════════════════════════

async function init() {
  console.log("🏌️ Platzreife App v4.2 gestartet");
  
  // Slots laden
  allSlots = await fetchSlots();
  console.log(`${allSlots.length} Termine geladen`);
  
  // Debug
  if (allSlots.length > 0) {
    console.log("Erster Slot:", JSON.stringify(allSlots[0]));
  }
  
  // Welche Seite?
  const isBookingPage = window.location.pathname.includes("buchen.html");
  
  if (isBookingPage) {
    initBookingPage();
  } else {
    // Index/Terminübersicht
    renderTermineGrid();
  }
  
  console.log("✓ App initialisiert");
}

// Start
document.addEventListener("DOMContentLoaded", init);

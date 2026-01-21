/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PLATZREIFE BUCHUNGSSYSTEM – VERSION 4.3
 * Golfclub Metzenhof – 19.01.2026 – n8n Webhook Integration
 * 
 * Zwei-Seiten-System:
 * - index.html: Terminübersicht (klickbar → weiter zu buchen.html)
 * - buchen.html: Buchungsformular mit vorausgewähltem Termin
 * 
 * n8n Webhook Integration:
 * - Nach erfolgreicher Buchung wird ein Webhook an n8n gesendet
 * - n8n kann dann Outlook E-Mails versenden
 * - Setze N8N_WEBHOOK_URL in CONFIG um den Webhook zu aktivieren
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ══════════════════════════════════════════════════════════════════════════════
// KONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbw2p10V1q7BD9BxLEawGyQr2dWrdK1aVsl406PvqB5JL3MU3tHWYEWgAWZekbi_XNAEiw/exec",
  MAX_PARTICIPANTS: 8,
  COURSE_START: "09:00",
  COURSE_END: "15:00",
  
  // ══════════════════════════════════════════════════════════════════════════
  // n8n WEBHOOK KONFIGURATION
  // Setze hier die n8n Webhook URL ein, um nach Buchung E-Mails zu triggern.
  // Leer lassen = Webhook deaktiviert.
  // ══════════════════════════════════════════════════════════════════════════
  N8N_WEBHOOK_URL: "https://n8n.srv1066806.hstgr.cloud/webhook/platreife/booking",
  N8N_WEBHOOK_TIMEOUT: 8000,  // 8 Sekunden Timeout
  N8N_WEBHOOK_RETRY_DELAY: 2000,  // 2 Sekunden bis Retry
  
  // Dokumentenversion für rechtliche Nachvollziehbarkeit
  DOCUMENTS_VERSION: "v4.3-2026-01-19",
  
  // Preise
  PRICING: {
    COURSE_GMBH: 99,
    MEMBERSHIP_VEREIN: 45,
    TOTAL: 144,
    CURRENCY: "EUR"
  },
  
  // Dokument-URLs (absolut für E-Mail-Verwendung)
  BASE_URL: "https://platzreife.metzenhof.at",
  DOCUMENTS: {
    AGB_URL: "https://platzreife.metzenhof.at/agb.html",
    PRIVACY_URL: "https://platzreife.metzenhof.at/privacy.html",
    STATUTES_URL: "https://platzreife.metzenhof.at/2009_statuten_metzenhof-1.pdf",
    MEMBERSHIP_TERMS_URL: "https://platzreife.metzenhof.at/AGB%20Verein%20Golfpark%20Metzenhof.pdf"
  },
  
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
          <a href="mailto:golf@metzenhof.at">golf@metzenhof.at</a>
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
      : '';
    
    return `
      <div class="termin-card ${statusClass}" ${clickAttr} title="${isBookable ? 'Termin auswählen & weiter' : 'Dieser Termin ist leider ausgebucht'}">
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
  const dateFormatted = formatDateLong(selectedSlot.date);
  
  // Header Badge
  const headerText = document.getElementById("selected-date-text");
  if (headerText) {
    headerText.textContent = dateFormatted;
  }
  
  // Info-Card im Formular
  const infoDate = document.getElementById("slot-info-date");
  const infoTime = document.getElementById("slot-info-time");
  const infoFree = document.getElementById("slot-info-free");
  const hiddenInput = document.getElementById("slot_id");
  
  if (infoDate) infoDate.textContent = dateFormatted;
  
  // Neues Uhrzeit-Format
  if (infoTime) {
    const startTime = formatTime(selectedSlot.start);
    const endTime = formatTime(selectedSlot.end);
    infoTime.innerHTML = `
      <span class="time-label">Kurszeit:</span>
      <span class="time-value">${startTime} bis ${endTime}</span>
    `;
  }
  
  // Freie Plätze mit Icon (oder "Max. 8" wenn keine Daten)
  if (infoFree) {
    if (isNaN(free) || free === null || free === undefined) {
      infoFree.textContent = "Max. 8 Teilnehmer";
    } else if (free <= 2 && free > 0) {
      infoFree.innerHTML = `<span class="free-warning">⚠️ Nur noch ${free} ${free === 1 ? 'Platz' : 'Plätze'} frei!</span>`;
    } else if (free > 0) {
      infoFree.textContent = `✓ ${free} Plätze frei`;
    } else {
      infoFree.textContent = "Max. 8 Teilnehmer";
    }
  }
  
  if (hiddenInput) hiddenInput.value = selectedSlot.id;
  
  // Bestellübersicht aktualisieren
  const summaryDate = document.getElementById("summary-date");
  if (summaryDate) {
    summaryDate.textContent = dateFormatted;
  }
}

/**
 * Buchungsformular Setup (Einzelbuchung - immer 1 Teilnehmer)
 */
function setupBookingForm(maxParticipants) {
  // Immer 1 Teilnehmer - Teilnehmerfelder rendern
  renderParticipants(1);
  
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
 * Teilnehmerfelder rendern (Einzelbuchung)
 * Nur 1 Teilnehmer mit vollen Kontaktdaten
 */
function renderParticipants(count) {
  const container = document.getElementById("participants");
  if (!container) return;
  
  // Formular für einzelnen Teilnehmer (Kontaktperson)
  container.innerHTML = `
    <fieldset class="participant-fieldset participant-contact">
      <legend>Kontaktperson & Rechnungsadresse</legend>
      
      <div class="form-row">
        <label>
          Vorname *
          <input type="text" name="p0_first" required autocomplete="given-name">
        </label>
        <label>
          Nachname *
          <input type="text" name="p0_last" required autocomplete="family-name">
        </label>
      </div>
      
      <div class="form-row">
        <label>
          Geburtsdatum *
          <input type="date" name="p0_birthdate" required max="${new Date().toISOString().split('T')[0]}">
          <small class="field-hint">Erforderlich für Vereinsmitgliedschaft</small>
        </label>
      </div>
      
      <div class="form-row">
        <label>
          Straße *
          <input type="text" name="p0_street" required autocomplete="street-address">
        </label>
        <label class="small">
          Hausnr. *
          <input type="text" name="p0_house" required>
        </label>
      </div>
      
      <div class="form-row">
        <label class="small">
          PLZ *
          <input type="text" name="p0_zip" required pattern="[0-9]{4,5}" autocomplete="postal-code">
        </label>
        <label>
          Ort *
          <input type="text" name="p0_city" required autocomplete="address-level2">
        </label>
      </div>
      
      <div class="form-row">
        <label>
          Land *
          <select name="p0_country" required autocomplete="country">
            <option value="AT" selected>Österreich</option>
            <option value="DE">Deutschland</option>
            <option value="CH">Schweiz</option>
            <option value="OTHER">Anderes</option>
          </select>
        </label>
      </div>
      
      <div class="form-row">
        <label>
          E-Mail *
          <input type="email" name="contact_email" required placeholder="max.mustermann@email.at" autocomplete="email">
        </label>
        <label>
          Mobiltelefon *
          <input type="tel" name="contact_phone" required placeholder="+43 664 1234567" autocomplete="tel">
        </label>
      </div>
    </fieldset>
  `;
}

/**
 * Bestellübersicht aktualisieren
 */
function updateOrderSummary(count) {
  const summaryCount = document.getElementById("summary-count");
  const summaryTotal = document.getElementById("summary-total");
  const summaryDate = document.getElementById("summary-date");
  
  if (summaryCount) {
    summaryCount.textContent = count === 1 ? "1 Person" : `${count} Personen`;
  }
  
  if (summaryTotal) {
    const total = count * 144;
    summaryTotal.textContent = `${total} €`;
  }
  
  if (summaryDate && selectedSlot) {
    summaryDate.textContent = formatDateLong(selectedSlot.date);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// n8n WEBHOOK INTEGRATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Strukturiertes Booking-Payload für n8n erstellen
 * Enthält alle Infos für Outlook E-Mail-Versand
 */
function buildBookingPayload(bookingId, slotId, participants, email, phone, termsAccepted, voucherCode = "") {
  const count = participants.length;
  const contactPerson = participants[0] || {};
  const otherParticipants = participants.slice(1).map(p => ({
    first_name: p.first_name,
    last_name: p.last_name,
    birthdate: p.birthdate || null
  }));
  
  return {
    // Buchungsidentifikation
    booking_id: bookingId || `TMP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    created_at: new Date().toISOString(),
    
    // Termin-Informationen
    slot: {
      slot_id: slotId,
      date_iso: slotId, // YYYY-MM-DD
      date_display: formatDateShort(slotId),
      date_long: formatDateLong(slotId),
      time_range: `${CONFIG.COURSE_START}–${CONFIG.COURSE_END}`
    },
    
    // Teilnehmer
    participants: {
      count: count,
      contact_person: {
        first_name: contactPerson.first_name || "",
        last_name: contactPerson.last_name || "",
        email: email,
        phone: phone,
        address: {
          street: contactPerson.street || "",
          house_no: contactPerson.house_no || "",
          zip: contactPerson.zip || "",
          city: contactPerson.city || "",
          country: contactPerson.country || "AT"
        },
        birthdate: contactPerson.birthdate || null
      },
      others: otherParticipants
    },
    
    // Gutscheincode (falls vorhanden)
    voucher_code: voucherCode || "",
    
    // Preise
    pricing: {
      total: CONFIG.PRICING.TOTAL * count,
      per_person: CONFIG.PRICING.TOTAL,
      currency: CONFIG.PRICING.CURRENCY,
      breakdown: {
        course_gmbh: CONFIG.PRICING.COURSE_GMBH * count,
        membership_verein: CONFIG.PRICING.MEMBERSHIP_VEREIN * count
      }
    },
    
    // Rechtliche Zustimmungen
    legal_acceptance: {
      agb_kurs: termsAccepted.agb_kurs,
      privacy_accepted: termsAccepted.privacy_accepted,
      membership_statutes: termsAccepted.membership_statutes,
      partner_awareness: termsAccepted.partner_awareness,
      cancellation_notice: termsAccepted.cancellation_notice,
      fagg_consent: termsAccepted.fagg_consent,
      third_party_consent: termsAccepted.third_party_consent,
      newsletter: termsAccepted.newsletter,
      accepted_at: termsAccepted.accepted_at,
      documents: {
        agb_url: CONFIG.DOCUMENTS.AGB_URL,
        privacy_url: CONFIG.DOCUMENTS.PRIVACY_URL,
        statutes_url: CONFIG.DOCUMENTS.STATUTES_URL,
        membership_terms_url: CONFIG.DOCUMENTS.MEMBERSHIP_TERMS_URL,
        documents_version: CONFIG.DOCUMENTS_VERSION
      },
      evidence: {
        user_agent: navigator.userAgent,
        page_url: window.location.href,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    }
  };
}

/**
 * n8n Webhook triggern (mit Retry)
 * Gibt zurück: { success: true/false, message: string }
 */
async function triggerN8nWebhook(payload) {
  // Webhook deaktiviert?
  if (!CONFIG.N8N_WEBHOOK_URL) {
    console.log("n8n Webhook deaktiviert (keine URL konfiguriert)");
    return { success: true, message: "webhook_disabled" };
  }
  
  console.log("Triggere n8n Webhook:", CONFIG.N8N_WEBHOOK_URL);
  console.log("Payload:", JSON.stringify(payload, null, 2));
  
  const attemptWebhook = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.N8N_WEBHOOK_TIMEOUT);
    
    try {
      const response = await fetch(CONFIG.N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log("n8n Webhook erfolgreich (Status:", response.status, ")");
        return { success: true, message: "webhook_success" };
      } else {
        console.warn("n8n Webhook fehlgeschlagen (Status:", response.status, ")");
        return { success: false, message: `webhook_error_${response.status}` };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        console.warn("n8n Webhook Timeout");
        return { success: false, message: "webhook_timeout" };
      }
      console.warn("n8n Webhook Fehler:", error.message);
      return { success: false, message: "webhook_network_error" };
    }
  };
  
  // Erster Versuch
  let result = await attemptWebhook();
  
  // Retry bei Fehlschlag
  if (!result.success) {
    console.log(`n8n Webhook Retry in ${CONFIG.N8N_WEBHOOK_RETRY_DELAY}ms...`);
    await new Promise(resolve => setTimeout(resolve, CONFIG.N8N_WEBHOOK_RETRY_DELAY));
    result = await attemptWebhook();
  }
  
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// BUCHUNG ABSENDEN
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Formular verarbeiten (mit rechtlichen Checkboxen und Metadata)
 */
async function handleSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');
  const checkboxError = document.getElementById("checkbox-error");
  
  // Fehlermeldung zurücksetzen
  if (checkboxError) checkboxError.style.display = "none";
  
  btn.disabled = true;
  btn.textContent = "Wird gesendet...";
  
  try {
    const slotId = formData.get("slot_id");
    const count = parseInt(formData.get("participants_count")) || 1;
    const email = formData.get("contact_email");
    const phone = formData.get("contact_phone") || "";
    
    if (!slotId) throw new Error("Kein Termin gewählt.");
    if (!email) throw new Error("Bitte E-Mail-Adresse eingeben.");
    
    // E-Mail Validierung
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) throw new Error("Bitte gültige E-Mail-Adresse eingeben.");
    
    if (!phone) throw new Error("Bitte Mobiltelefonnummer eingeben.");
    
    // Telefon minimal validieren (mind. 6 Ziffern)
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 6) throw new Error("Bitte gültige Telefonnummer eingeben.");
    
    // Teilnehmerdaten sammeln
    const participants = [];
    for (let i = 0; i < count; i++) {
      const isFirst = i === 0;
      const participant = {
        first_name: formData.get(`p${i}_first`) || "",
        last_name: formData.get(`p${i}_last`) || "",
        birthdate: formData.get(`p${i}_birthdate`) || ""
      };
      
      // Geburtsdatum validieren (nicht in der Zukunft)
      if (participant.birthdate) {
        const birthDate = new Date(participant.birthdate);
        if (birthDate > new Date()) {
          throw new Error(`Teilnehmer ${i + 1}: Geburtsdatum darf nicht in der Zukunft liegen.`);
        }
      }
      
      // Kontaktperson: Adressdaten
      if (isFirst) {
        participant.street = formData.get(`p${i}_street`) || "";
        participant.house_no = formData.get(`p${i}_house`) || "";
        participant.zip = formData.get(`p${i}_zip`) || "";
        participant.city = formData.get(`p${i}_city`) || "";
        participant.country = formData.get(`p${i}_country`) || "AT";
        
        // Geburtsdatum Pflicht für Kontaktperson
        if (!participant.birthdate) {
          throw new Error("Bitte Geburtsdatum der Kontaktperson eingeben.");
        }
      }
      
      participants.push(participant);
    }
    
    // CHECKBOXEN VALIDIEREN
    const requiredCheckboxes = [
      { id: "agb_kurs", name: "AGB für den Platzerlaubniskurs" },
      { id: "privacy_accepted", name: "Datenschutzerklärung" },
      { id: "membership_statutes", name: "Mitgliedschaftsantrag und Statuten" },
      { id: "partner_awareness", name: "Vertragspartner-Kenntnisnahme" },
      { id: "cancellation_notice", name: "Kündigungshinweis" },
      { id: "fagg_consent", name: "Fixtermin/FAGG-Zustimmung" }
    ];
    
    // Drittdaten-Checkbox bei mehreren Teilnehmern
    if (count > 1) {
      requiredCheckboxes.push({ id: "third_party_consent", name: "Drittdaten-Bestätigung" });
    }
    
    const missingCheckboxes = [];
    for (const cb of requiredCheckboxes) {
      const checkbox = document.getElementById(cb.id);
      if (!checkbox || !checkbox.checked) {
        missingCheckboxes.push(cb.name);
      }
    }
    
    if (missingCheckboxes.length > 0) {
      const errorMsg = `Bitte bestätige: ${missingCheckboxes.join(", ")}`;
      if (checkboxError) {
        checkboxError.textContent = errorMsg;
        checkboxError.style.display = "block";
      }
      throw new Error(errorMsg);
    }
    
    // Zustimmungen mit Timestamp sammeln
    const acceptedAt = new Date().toISOString();
    const termsAccepted = {
      agb_kurs: document.getElementById("agb_kurs")?.checked || false,
      privacy_accepted: document.getElementById("privacy_accepted")?.checked || false,
      membership_statutes: document.getElementById("membership_statutes")?.checked || false,
      partner_awareness: document.getElementById("partner_awareness")?.checked || false,
      cancellation_notice: document.getElementById("cancellation_notice")?.checked || false,
      fagg_consent: document.getElementById("fagg_consent")?.checked || false,
      third_party_consent: count > 1 ? (document.getElementById("third_party_consent")?.checked || false) : null,
      newsletter: document.getElementById("newsletter")?.checked || false,
      accepted_at: acceptedAt,
      terms_version: window.location.origin + "/platzreife/v2026-01",
      user_agent: navigator.userAgent
    };
    
    // Gutscheincode auslesen (optional)
    const voucherCode = (formData.get("voucher_code") || "").trim().toUpperCase();
    
    const payload = {
      slot_id: slotId,
      contact_email: email,
      contact_phone: phone,
      participants_count: count,
      participants: participants,
      voucher_code: voucherCode, // Gutscheincode
      // Rückwärtskompatibilität für Backend
      agb_accepted: true,
      privacy_accepted: true,
      // Neue detaillierte Einwilligungen
      terms_accepted: termsAccepted
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
        // Buchung erfolgreich - jetzt n8n Webhook triggern
        const bookingPayload = buildBookingPayload(
          result.booking_id,
          slotId,
          participants,
          email,
          phone,
          termsAccepted,
          voucherCode
        );
        
        // Webhook async triggern (Buchung ist bereits gespeichert)
        const webhookResult = await triggerN8nWebhook(bookingPayload);
        
        // Erfolgsanzeige mit Webhook-Status
        showSuccess(result.booking_id, slotId, count, email, result.email_sent, webhookResult);
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
    btn.textContent = "Jetzt kostenpflichtig buchen";
  }
}

/**
 * Erfolgsanzeige mit Webhook-Status
 */
function showSuccess(bookingId, slotId, count, email, emailSent, webhookResult = null) {
  const formSection = document.querySelector(".booking-form-section");
  const successSection = document.getElementById("success-section");
  
  if (formSection) formSection.style.display = "none";
  
  if (successSection) {
    successSection.style.display = "block";
    
    const idEl = document.getElementById("success-id");
    const dateEl = document.getElementById("success-date");
    const emailEl = document.getElementById("success-email");
    const emailStatusEl = document.getElementById("email-status-text");
    const nextStepsEl = document.getElementById("next-steps");
    const webhookStatusEl = document.getElementById("webhook-status");
    
    if (idEl) idEl.textContent = bookingId || "–";
    if (dateEl) dateEl.textContent = formatDateLong(slotId);
    if (emailEl) emailEl.textContent = email;
    
    // E-Mail-Status anzeigen
    if (emailStatusEl) {
      if (emailSent) {
        emailStatusEl.textContent = "Eine Bestätigungs-E-Mail mit allen Details wurde an Sie gesendet.";
      } else {
        emailStatusEl.textContent = "Ihre Buchung wurde erfolgreich registriert.";
      }
    }
    
    // Webhook-Status anzeigen (für E-Mail via n8n/Outlook)
    if (webhookStatusEl && webhookResult) {
      if (webhookResult.message === "webhook_disabled") {
        // Webhook nicht konfiguriert - kein Hinweis nötig
        webhookStatusEl.style.display = "none";
      } else if (webhookResult.success) {
        webhookStatusEl.textContent = "Bestätigung wird per E-Mail versendet.";
        webhookStatusEl.className = "webhook-status success";
        webhookStatusEl.style.display = "block";
      } else {
        webhookStatusEl.textContent = "E-Mail-Bestätigung konnte gerade nicht automatisch ausgelöst werden. Bei Fragen kontaktieren Sie uns bitte.";
        webhookStatusEl.className = "webhook-status warning";
        webhookStatusEl.style.display = "block";
      }
    }
    
    // "Nächste Schritte" einblenden
    if (nextStepsEl) {
      nextStepsEl.style.display = "block";
    }
  }
  
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ══════════════════════════════════════════════════════════════════════════════
// INITIALISIERUNG
// ══════════════════════════════════════════════════════════════════════════════

async function init() {
  console.log("🏌️ Platzerlaubnis App v4.4 gestartet (n8n Webhook)");
  
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

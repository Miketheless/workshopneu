/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * WORKSHOP BUCHUNGSSYSTEM – Gemma Golfn
 * Statisches Frontend für GitHub Pages + Google Apps Script Backend
 * 
 * - index.html: Alle Workshops nacheinander mit Terminen, Filter zum Einschränken
 * - buchen.html: Teilnehmer 1–4 (Vorname, Nachname, E-Mail) + Buchung
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ══════════════════════════════════════════════════════════════════════════════
// KONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  SCRIPT_BASE: "https://script.google.com/macros/s/AKfycbzzN5zS2802FgcA0k3pGaLJ4a-xTiYte3uEYy846IScsKT5CqDpzdUTXKvptxlKeoQW/exec",
  MAX_PARTICIPANTS: 4,
  BASE_URL: "https://miketheless.github.io/workshopneu"
};

// ══════════════════════════════════════════════════════════════════════════════
// HILFSFUNKTIONEN
// ══════════════════════════════════════════════════════════════════════════════

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function parseDate(input) {
  if (!input) return null;
  if (input instanceof Date) {
    const d = input;
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }
  if (typeof input === "string") {
    const str = input.trim();
    if (str.includes("T")) {
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split("-").map(Number);
      return { year: y, month: m, day: d };
    }
  }
  return null;
}

function formatDateLong(str) {
  const p = parseDate(str);
  if (!p) return str;
  const date = new Date(p.year, p.month - 1, p.day);
  const wd = WEEKDAYS[date.getDay()];
  return `${wd}, ${String(p.day).padStart(2, "0")}.${String(p.month).padStart(2, "0")}.${p.year}`;
}

function formatDateShort(str) {
  const p = parseDate(str);
  if (!p) return str;
  return `${String(p.day).padStart(2, "0")}.${String(p.month).padStart(2, "0")}.${p.year}`;
}

function isFuture(str) {
  const p = parseDate(str);
  if (!p) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(p.year, p.month - 1, p.day);
  return date >= today;
}

function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function showMessage(text, type = "info") {
  const msgEl = document.getElementById("message");
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.className = `message ${type}`;
  msgEl.style.display = "block";
  if (type !== "error") setTimeout(() => { msgEl.style.display = "none"; }, 5000);
}

// ══════════════════════════════════════════════════════════════════════════════
// API
// ══════════════════════════════════════════════════════════════════════════════

async function fetchWorkshops() {
  try {
    const res = await fetch(`${CONFIG.SCRIPT_BASE}?action=workshops`);
    const data = await res.json();
    return data.ok ? (data.workshops || []) : [];
  } catch (e) {
    console.warn("Workshops API:", e.message);
    return [];
  }
}

async function fetchSlots(workshopId) {
  if (!workshopId) return [];
  try {
    const res = await fetch(`${CONFIG.SCRIPT_BASE}?action=slots&workshop_id=${encodeURIComponent(workshopId)}`);
    const data = await res.json();
    return data.ok ? (data.slots || []) : [];
  } catch (e) {
    console.warn("Slots API:", e.message);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// INDEX.HTML – ALLE WORKSHOPS MIT TERMINEN
// ══════════════════════════════════════════════════════════════════════════════

let workshopsWithSlots = [];

function selectSlot(workshopId, slotId) {
  window.location.href = `buchen.html?workshop_id=${encodeURIComponent(workshopId)}&slot=${encodeURIComponent(slotId)}`;
}
window.selectSlot = selectSlot;

function renderFilterDropdown() {
  const sel = document.getElementById("workshop-filter");
  if (!sel) return;

  sel.innerHTML = '<option value="">Alle Workshops</option>';
  workshopsWithSlots.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w.workshop.workshop_id;
    opt.textContent = w.workshop.title;
    sel.appendChild(opt);
  });

  sel.onchange = renderAllWorkshops;
}

function renderSlotCard(slot, workshop) {
  const dateId = (slot.date || slot.slot_id || "").toString().split("T")[0];
  const p = parseDate(dateId);
  if (!p) return "";

  const capacity = parseInt(slot.capacity) || CONFIG.MAX_PARTICIPANTS;
  const booked = parseInt(slot.booked) || 0;
  const free = capacity - booked;
  const dateObj = new Date(p.year, p.month - 1, p.day);
  const isBookable = free > 0 && (slot.status !== "FULL");

  let statusClass = "open";
  let statusText = `${free} von ${capacity} Plätzen frei`;
  if (free === 0) { statusClass = "full"; statusText = "Ausgebucht"; }
  else if (free <= 1) { statusClass = "few"; statusText = `Nur noch ${free} Platz frei`; }

  const clickAttr = isBookable ? `onclick="selectSlot('${workshop.workshop_id}','${slot.slot_id || dateId}')" style="cursor:pointer;"` : "";

  return `
    <div class="termin-card ${statusClass}" ${clickAttr} title="${isBookable ? "Termin auswählen" : "Ausgebucht"}">
      <div class="termin-datum">
        <div class="termin-weekday">${WEEKDAYS[dateObj.getDay()]}</div>
        <div class="termin-date">${String(p.day).padStart(2,"0")}.${String(p.month).padStart(2,"0")}.${p.year}</div>
      </div>
      <div class="termin-details">
        <div class="termin-info-row">
          <span class="info-icon">🕐</span>
          <span class="info-text">${slot.start || "–"}–${slot.end || "–"} Uhr</span>
        </div>
        <div class="termin-info-row">
          <span class="info-icon">👥</span>
          <span class="info-text status-${statusClass}">${statusText}</span>
        </div>
      </div>
      ${isBookable ? '<button type="button" class="termin-cta">Termin auswählen</button>' : '<div class="termin-cta-disabled">Nicht verfügbar</div>'}
    </div>
  `;
}

function renderAllWorkshops() {
  const filterValue = document.getElementById("workshop-filter")?.value || "";
  const container = document.getElementById("workshops-list");
  if (!container) return;

  let html = "";
  const toShow = filterValue
    ? workshopsWithSlots.filter(w => w.workshop.workshop_id === filterValue)
    : workshopsWithSlots;

  if (toShow.length === 0) {
    html = '<div class="termine-empty termine-loading"><span>Keine Termine verfügbar.</span></div>';
  } else {
    toShow.forEach(item => {
      const w = item.workshop;
      const futureSlots = (item.slots || []).filter(s => isFuture(s.date || s.slot_id));
      futureSlots.sort((a, b) => {
        const da = parseDate(a.date || a.slot_id);
        const db = parseDate(b.date || b.slot_id);
        if (!da || !db) return 0;
        return new Date(da.year, da.month - 1, da.day) - new Date(db.year, db.month - 1, db.day);
      });

      html += `
        <div class="workshop-block" data-workshop-id="${w.workshop_id}">
          <h3>${w.title}</h3>
          <p class="workshop-desc">${w.description || ""}</p>
          <div class="workshop-meta">
            <span>Preis: € ${w.price_eur || 50}</span>
            <span>Dauer: ${w.duration_text || "–"}</span>
            <span>2–4 Teilnehmer</span>
          </div>
          <div class="workshop-slots-title">Verfügbare Termine:</div>
          <div class="termine-grid">
            ${futureSlots.length > 0
              ? futureSlots.map(s => renderSlotCard(s, w)).join("")
              : '<p class="termine-empty" style="grid-column:1/-1;color:var(--color-text-muted);">Keine zukünftigen Termine.</p>'
            }
          </div>
        </div>
      `;
    });
  }

  container.innerHTML = html;
}

async function loadAllWorkshopsAndSlots() {
  const container = document.getElementById("workshops-list");
  if (container) {
    container.innerHTML = '<div class="termine-loading"><div class="loading-spinner"></div><span>Termine werden geladen...</span></div>';
  }

  const workshops = await fetchWorkshops();
  workshopsWithSlots = [];

  for (let i = 0; i < workshops.length; i++) {
    const w = workshops[i];
    if (w.is_active === false) continue;
    const slots = await fetchSlots(w.workshop_id);
    workshopsWithSlots.push({ workshop: w, slots });
  }

  renderFilterDropdown();
  renderAllWorkshops();
}

// ══════════════════════════════════════════════════════════════════════════════
// BUCHEN.HTML – BUCHUNGSFORMULAR
// ══════════════════════════════════════════════════════════════════════════════

let selectedSlot = null;

function initBookingPage() {
  const workshopId = getUrlParam("workshop_id");
  const slotParam = getUrlParam("slot");

  if (!workshopId || !slotParam) {
    showNoSlotError();
    return;
  }

  fetchWorkshops().then(async workshops => {
    const workshop = workshops.find(w => w.workshop_id === workshopId);
    if (!workshop) {
      showNoSlotError("Workshop nicht gefunden.");
      return;
    }

    const slots = await fetchSlots(workshopId);
    const slot = slots.find(s => (s.slot_id || s.date || "").toString().split("T")[0] === (slotParam || "").toString().split("T")[0])
      || slots.find(s => String(s.slot_id) === String(slotParam))
      || (isFuture(slotParam) ? { slot_id: slotParam, date: slotParam, start: "10:00", end: "12:00", capacity: CONFIG.MAX_PARTICIPANTS, booked: 0 } : null);

    if (!slot) {
      showNoSlotError("Termin nicht gefunden.");
      return;
    }

    const free = (parseInt(slot.capacity) || CONFIG.MAX_PARTICIPANTS) - (parseInt(slot.booked) || 0);
    if (free <= 0) {
      showNoSlotError("Dieser Termin ist ausgebucht.");
      return;
    }

    selectedSlot = {
      id: slot.slot_id || slotParam,
      date: slot.date || slotParam,
      start: slot.start || "10:00",
      end: slot.end || "12:00",
      capacity: parseInt(slot.capacity) || CONFIG.MAX_PARTICIPANTS,
      booked: parseInt(slot.booked) || 0,
      workshop_id: workshopId,
      workshop
    };

    document.getElementById("slot_id").value = selectedSlot.id;
    document.getElementById("workshop_id").value = workshopId;

    displaySelectedSlot();
    setupParticipantsSelect(free);
    renderParticipants(1);
  });
}

function showNoSlotError(message) {
  const form = document.querySelector(".booking-form-section");
  const err = document.getElementById("no-slot-section");
  if (form) form.style.display = "none";
  if (err) {
    err.style.display = "block";
    const p = err.querySelector("p");
    if (p && message) p.textContent = message;
  }
}

function displaySelectedSlot() {
  if (!selectedSlot) return;

  const free = selectedSlot.capacity - selectedSlot.booked;

  document.getElementById("selected-date-text").textContent = formatDateLong(selectedSlot.date);
  document.getElementById("slot-info-date").textContent = formatDateLong(selectedSlot.date);
  document.getElementById("slot-info-time").innerHTML = `<span class="time-label">Zeit:</span> <span class="time-value">${selectedSlot.start}–${selectedSlot.end} Uhr</span>`;
  document.getElementById("slot-info-free").textContent = free > 0 ? `✓ ${free} Plätze frei` : "Ausgebucht";
  document.getElementById("slot-info-workshop").textContent = selectedSlot.workshop ? selectedSlot.workshop.title : "";

  document.getElementById("summary-date").textContent = formatDateLong(selectedSlot.date);
  document.getElementById("summary-workshop").textContent = selectedSlot.workshop ? selectedSlot.workshop.title : "";

  updateOrderSummary(1);
}

function setupParticipantsSelect(maxFree) {
  const sel = document.getElementById("participants_count");
  if (!sel) return;

  const max = Math.min(CONFIG.MAX_PARTICIPANTS, maxFree);
  Array.from(sel.options || []).forEach(opt => {
    const v = parseInt(opt.value);
    opt.disabled = v > max;
  });
  if (parseInt(sel.value) > max) sel.value = String(max);

  const handler = () => {
    const n = parseInt(sel.value) || 1;
    renderParticipants(n);
    updateOrderSummary(n);
  };
  sel.onchange = handler;
}

function renderParticipants(count) {
  const container = document.getElementById("participants");
  if (!container) return;

  container.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const fs = document.createElement("fieldset");
    fs.className = "participant-fieldset";
    fs.innerHTML = `
      <legend>Teilnehmer ${i + 1}</legend>
      <div class="form-row">
        <label>Vorname * <input type="text" name="p${i}_first" required autocomplete="given-name"></label>
        <label>Nachname * <input type="text" name="p${i}_last" required autocomplete="family-name"></label>
      </div>
      <div class="form-row">
        <label>E-Mail * <input type="email" name="p${i}_email" required autocomplete="email"></label>
      </div>
    `;
    container.appendChild(fs);
  }
}

function updateOrderSummary(count) {
  const sel = document.getElementById("participants_count");
  const n = sel ? parseInt(sel.value) || count : count;

  document.getElementById("summary-count").textContent = n === 1 ? "1 Person" : `${n} Personen`;

  const price = selectedSlot?.workshop ? parseInt(selectedSlot.workshop.price_eur) || 50 : 50;
  document.getElementById("summary-total").textContent = `${price * n} €`;
}

async function handleSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');
  const checkboxError = document.getElementById("checkbox-error");

  if (checkboxError) checkboxError.style.display = "none";
  btn.disabled = true;
  btn.textContent = "Wird gesendet...";

  try {
    const slotId = formData.get("slot_id");
    const workshopId = formData.get("workshop_id");
    const contactEmail = formData.get("contact_email");
    const count = parseInt(formData.get("participants_count")) || 1;

    if (!slotId || !workshopId || !contactEmail) throw new Error("Unvollständige Angaben.");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) throw new Error("Bitte gültige Kontakt-E-Mail eingeben.");

    const participants = [];
    for (let i = 0; i < count; i++) {
      const first = (formData.get(`p${i}_first`) || "").trim();
      const last = (formData.get(`p${i}_last`) || "").trim();
      const email = (formData.get(`p${i}_email`) || "").trim();
      if (!first || !last || !email) throw new Error(`Teilnehmer ${i + 1}: Alle Felder Pflicht.`);
      if (!emailRegex.test(email)) throw new Error(`Teilnehmer ${i + 1}: Ungültige E-Mail.`);
      participants.push({ first_name: first, last_name: last, email });
    }

    const agb = document.getElementById("agb_accepted")?.checked;
    const privacy = document.getElementById("privacy_accepted")?.checked;
    const fagg = document.getElementById("fagg_consent")?.checked;
    if (!agb || !privacy || !fagg) {
      throw new Error("Bitte alle rechtlichen Zustimmungen bestätigen.");
    }

    const payload = {
      slot_id: slotId,
      workshop_id: workshopId,
      contact_email: contactEmail,
      participants_count: count,
      participants,
      agb_accepted: true,
      privacy_accepted: true,
      fagg_consent: true
    };

    const payloadBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const url = `${CONFIG.SCRIPT_BASE}?action=book&data=${encodeURIComponent(payloadBase64)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    clearTimeout(timeout);

    const result = await response.json();

    if (result.success || result.ok) {
      showSuccess(result.booking_id, slotId, contactEmail);
    } else {
      throw new Error(result.error || result.message || "Buchung fehlgeschlagen.");
    }
  } catch (err) {
    showMessage(err.message, "error");
    btn.disabled = false;
    btn.textContent = "Jetzt buchen";
  }
}

function showSuccess(bookingId, slotId, email) {
  const formSection = document.querySelector(".booking-form-section");
  if (formSection) formSection.style.display = "none";
  const success = document.getElementById("success-section");
  if (success) {
    success.style.display = "block";
    document.getElementById("success-id").textContent = bookingId || "–";
    document.getElementById("success-date").textContent = formatDateLong(slotId);
    document.getElementById("success-email").textContent = email;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ══════════════════════════════════════════════════════════════════════════════
// INITIALISIERUNG
// ══════════════════════════════════════════════════════════════════════════════

async function init() {
  const isBookingPage = window.location.pathname.includes("buchen.html");

  if (isBookingPage) {
    const form = document.getElementById("booking-form");
    if (form) form.addEventListener("submit", handleSubmit);
    const newBtn = document.getElementById("new-booking");
    if (newBtn) newBtn.addEventListener("click", () => { window.location.href = "index.html"; });

    initBookingPage();
  } else {
    await loadAllWorkshopsAndSlots();
  }
}

document.addEventListener("DOMContentLoaded", init);

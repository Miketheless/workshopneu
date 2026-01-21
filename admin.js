/**
 * ═══════════════════════════════════════════════════════════
 * PLATZREIFE – Admin JavaScript
 * Golfclub Metzenhof – Version 5.3 (21.01.2026)
 * 
 * Features:
 * - Monatskalender mit Farbcodierung
 * - Schnellbuchung per Klick auf Termin
 * - Sortierbare Tabellen
 * - Admin-Checkboxen
 * - Stornierung + Wiederherstellung
 * - GmbH & Club Spalten (Rechnung/Bezahlt)
 * - Bezahldatum-Anzeige wenn gesetzt
 * ═══════════════════════════════════════════════════════════
 */

const API_BASE = "https://script.google.com/macros/s/AKfycbzqu4baOn_qlzcQkeNK6NumYOEhRwTfGP-QbLKDtb8fi49MMq-TStg5-ZYevPUgYOq3/exec";

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════

let currentAdminKey = "";
let bookingsData = [];
let slotsData = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// Sortierung für kombinierte Tabelle
let combinedSortColumn = "slot_id";
let combinedSortDir = "asc";

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", 
                "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// ══════════════════════════════════════════════════════════════
// DOM ELEMENTS
// ══════════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

const elements = {
  loginSection: $("login-section"),
  adminPanel: $("admin-panel"),
  adminKey: $("admin-key"),
  loginBtn: $("login-btn"),
  loginMessage: $("login-message"),
  refreshBtn: $("refresh-btn"),
  exportBtn: $("export-btn"),
  statTotal: $("stat-total"),
  statConfirmed: $("stat-confirmed"),
  statCancelled: $("stat-cancelled"),
  statParticipants: $("stat-participants"),
  combinedContainer: $("combined-container"),
  loadingOverlay: $("loading-overlay"),
  // Kalender
  calendarGrid: $("calendar-grid"),
  calendarTitle: $("calendar-title"),
  prevMonth: $("prev-month"),
  nextMonth: $("next-month"),
  // Modal
  quickBookModal: $("quick-book-modal"),
  quickBookForm: $("quick-book-form"),
  modalClose: $("modal-close"),
  modalSlotId: $("modal-slot-id"),
  modalSlotDate: $("modal-slot-date"),
  modalSlotFree: $("modal-slot-free"),
  modalFirstName: $("modal-first-name"),
  modalLastName: $("modal-last-name"),
  modalEmail: $("modal-email"),
  modalPhone: $("modal-phone"),
  modalStreet: $("modal-street"),
  modalHouseNo: $("modal-house-no"),
  modalZip: $("modal-zip"),
  modalCity: $("modal-city"),
  modalVoucherCode: $("modal-voucher-code"),
  modalMessage: $("modal-message")
};

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function showLoading(show = true) {
  elements.loadingOverlay?.classList.toggle("hidden", !show);
}

function extractDateId(dateStr) {
  if (!dateStr) return "";
  if (typeof dateStr === "string") {
    if (dateStr.includes("T")) return dateStr.split("T")[0];
    return dateStr;
  }
  if (dateStr instanceof Date) {
    const y = dateStr.getFullYear();
    const m = String(dateStr.getMonth() + 1).padStart(2, "0");
    const d = String(dateStr.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(dateStr);
}

function formatDate(dateStr) {
  if (!dateStr) return "–";
  const id = extractDateId(dateStr);
  if (id.includes("-")) {
    const [y, m, d] = id.split("-");
    return `${d}.${m}.${y}`;
  }
  return dateStr;
}

function formatDateLong(dateStr) {
  const id = extractDateId(dateStr);
  if (!id) return "–";
  const [y, m, d] = id.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const weekday = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][date.getDay()];
  return `${weekday}, ${d}.${m}.${y}`;
}

function formatTimestamp(ts) {
  if (!ts) return "–";
  const date = new Date(ts);
  if (isNaN(date.getTime())) return "–";
  return date.toLocaleString("de-AT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function getSortIcon(column, current, dir) {
  if (column !== current) return '<span class="sort-icon">⇅</span>';
  return dir === "asc" ? '<span class="sort-icon active">↑</span>' : '<span class="sort-icon active">↓</span>';
}

function sortData(data, column, direction) {
  return [...data].sort((a, b) => {
    let valA = a[column] ?? "";
    let valB = b[column] ?? "";
    
    if (["timestamp", "cancelled_at", "slot_id", "paid_date_gmbh", "paid_date_club"].includes(column)) {
      valA = new Date(valA || 0).getTime();
      valB = new Date(valB || 0).getTime();
    } else if (["participants_count", "participant_nr"].includes(column)) {
      valA = parseInt(valA) || 0;
      valB = parseInt(valB) || 0;
    } else if (["invoice_sent_gmbh", "invoice_sent_club", "appeared", "membership_form", "dsgvo_form"].includes(column)) {
      valA = valA ? 1 : 0;
      valB = valB ? 1 : 0;
    } else {
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
    }
    
    if (valA < valB) return direction === "asc" ? -1 : 1;
    if (valA > valB) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

// ══════════════════════════════════════════════════════════════
// API
// ══════════════════════════════════════════════════════════════

async function fetchBookings(adminKey) {
  const res = await fetch(`${API_BASE}?action=admin_bookings&admin_key=${encodeURIComponent(adminKey)}`);
  return res.json();
}

async function fetchSlots() {
  try {
    const res = await fetch(`${API_BASE}?action=slots`);
    const data = await res.json();
    return data.ok ? data.slots : [];
  } catch (e) {
    console.warn("Slots fetch failed:", e);
    return [];
  }
}

async function updateBookingField(bookingId, field, value) {
  showLoading(true);
  try {
    const url = `${API_BASE}?action=admin_update&admin_key=${encodeURIComponent(currentAdminKey)}&booking_id=${encodeURIComponent(bookingId)}&field=${encodeURIComponent(field)}&value=${encodeURIComponent(value)}`;
    const res = await fetch(url);
    const result = await res.json();
    if (!result.ok) alert("Fehler: " + (result.message || "Unbekannt"));
    return result;
  } catch (e) {
    alert("Verbindungsfehler");
    return { ok: false };
  } finally {
    showLoading(false);
  }
}

async function cancelBooking(bookingId) {
  if (!confirm(`Buchung ${bookingId} stornieren?`)) return;
  showLoading(true);
  try {
    const url = `${API_BASE}?action=admin_cancel&admin_key=${encodeURIComponent(currentAdminKey)}&booking_id=${encodeURIComponent(bookingId)}`;
    const res = await fetch(url);
    const result = await res.json();
    if (result.ok) await handleRefresh();
    else alert("Fehler: " + (result.message || "Unbekannt"));
  } catch (e) {
    alert("Verbindungsfehler");
  } finally {
    showLoading(false);
  }
}

async function restoreBooking(bookingId) {
  if (!confirm(`Buchung ${bookingId} wiederherstellen?`)) return;
  showLoading(true);
  try {
    const url = `${API_BASE}?action=admin_restore&admin_key=${encodeURIComponent(currentAdminKey)}&booking_id=${encodeURIComponent(bookingId)}`;
    const res = await fetch(url);
    const result = await res.json();
    if (result.ok) await handleRefresh();
    else alert("Fehler: " + (result.message || "Unbekannt"));
  } catch (e) {
    alert("Verbindungsfehler");
  } finally {
    showLoading(false);
  }
}

async function addQuickBooking(payload) {
  showLoading(true);
  try {
    const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const url = `${API_BASE}?action=admin_add_booking&admin_key=${encodeURIComponent(currentAdminKey)}&data=${base64}`;
    const res = await fetch(url);
    return res.json();
  } catch (e) {
    return { ok: false, message: "Verbindungsfehler" };
  } finally {
    showLoading(false);
  }
}

// ══════════════════════════════════════════════════════════════
// KALENDER
// ══════════════════════════════════════════════════════════════

function getSlotsByDate() {
  const map = {};
  slotsData.forEach(slot => {
    const dateId = extractDateId(slot.slot_id || slot.date);
    if (!map[dateId]) {
      map[dateId] = {
        dateId,
        capacity: slot.capacity || 8,
        booked: slot.booked || 0,
        status: slot.status
      };
    }
  });
  return map;
}

function renderCalendar() {
  const slotsByDate = getSlotsByDate();
  const today = extractDateId(new Date());
  
  elements.calendarTitle.textContent = `${MONTHS[currentMonth]} ${currentYear}`;
  
  // Erster Tag des Monats
  const firstDay = new Date(currentYear, currentMonth, 1);
  let startDay = firstDay.getDay(); // 0 = Sonntag
  startDay = startDay === 0 ? 6 : startDay - 1; // Montag = 0
  
  // Anzahl Tage im Monat
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  let html = '';
  
  // Wochentage Header
  WEEKDAYS.forEach(wd => {
    html += `<div class="calendar-weekday">${wd}</div>`;
  });
  
  // Leere Zellen vor dem 1.
  for (let i = 0; i < startDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }
  
  // Tage des Monats
  for (let day = 1; day <= daysInMonth; day++) {
    const dateId = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isToday = dateId === today;
    const slot = slotsByDate[dateId];
    
    html += `<div class="calendar-day ${isToday ? "today" : ""}">`;
    html += `<div class="day-number">${day}</div>`;
    
    if (slot) {
      const free = slot.capacity - slot.booked;
      let colorClass = "";
      
      if (free <= 0 || slot.status === "FULL") {
        colorClass = "full";
      } else if (free <= 2) {
        colorClass = "low";
      }
      
      const clickable = free > 0 && slot.status !== "FULL";
      
      html += `
        <div class="calendar-slot ${colorClass}" 
             ${clickable ? `data-slot-id="${dateId}" data-free="${free}"` : ""}
             title="${free > 0 ? `${free} Plätze frei – Klicken zum Buchen` : "Ausgebucht"}">
          <div class="slot-time">09:00–15:00</div>
          <div class="slot-info">${free > 0 ? `${free} frei` : "voll"}</div>
        </div>
      `;
    }
    
    html += '</div>';
  }
  
  elements.calendarGrid.innerHTML = html;
  
  // Click Handler für Slots
  document.querySelectorAll(".calendar-slot[data-slot-id]").forEach(el => {
    el.addEventListener("click", () => {
      openQuickBookModal(el.dataset.slotId, parseInt(el.dataset.free));
    });
  });
}

function openQuickBookModal(slotId, free) {
  elements.modalSlotId.value = slotId;
  elements.modalSlotDate.textContent = formatDateLong(slotId);
  elements.modalSlotFree.textContent = free;
  elements.modalMessage.textContent = "";
  
  // Form zurücksetzen
  elements.quickBookForm.reset();
  elements.modalSlotId.value = slotId;
  
  // Teilnehmer für diesen Termin anzeigen
  renderModalParticipants(slotId);
  
  elements.quickBookModal.classList.remove("hidden");
}

function renderModalParticipants(slotId) {
  const container = document.getElementById("modal-participants-list");
  if (!container) return;
  
  // Alle Teilnehmer für diesen Termin finden
  const participants = [];
  
  bookingsData.forEach(booking => {
    const bookingDateId = extractDateId(booking.slot_id);
    if (bookingDateId === slotId && booking.participants) {
      booking.participants.forEach((p, idx) => {
        participants.push({
          bookingId: booking.booking_id,
          status: booking.status,
          firstName: p.first_name || "",
          lastName: p.last_name || "",
          nr: idx + 1
        });
      });
    }
  });
  
  if (participants.length === 0) {
    container.innerHTML = '<p style="color: #999; margin: 0;">Noch keine Buchungen für diesen Termin.</p>';
    return;
  }
  
  let html = '';
  participants.forEach(p => {
    const isCancelled = p.status === "CANCELLED";
    html += `
      <div class="modal-participant-item ${isCancelled ? "cancelled" : ""}">
        <div>
          <span class="modal-participant-name ${isCancelled ? "text-muted" : ""}" style="${isCancelled ? "text-decoration: line-through;" : ""}">
            ${p.firstName} ${p.lastName}
          </span>
          <span class="modal-participant-booking">(${p.bookingId})</span>
        </div>
        <span class="modal-participant-status ${isCancelled ? "cancelled" : "confirmed"}">
          ${isCancelled ? "✕ Storno" : "✓ OK"}
        </span>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function closeQuickBookModal() {
  elements.quickBookModal.classList.add("hidden");
}

async function handleQuickBook(e) {
  e.preventDefault();
  
  const slotId = elements.modalSlotId.value;
  const firstName = elements.modalFirstName.value.trim();
  const lastName = elements.modalLastName.value.trim();
  
  if (!firstName || !lastName) {
    elements.modalMessage.textContent = "Vor- und Nachname erforderlich";
    elements.modalMessage.className = "message error";
    return;
  }
  
  const payload = {
    slot_id: slotId,
    contact_email: elements.modalEmail.value.trim(),
    contact_phone: elements.modalPhone.value.trim(),
    voucher_code: (elements.modalVoucherCode?.value || "").trim().toUpperCase(),
    participants: [{
      first_name: firstName,
      last_name: lastName,
      street: elements.modalStreet.value.trim(),
      house_no: elements.modalHouseNo.value.trim(),
      zip: elements.modalZip.value.trim(),
      city: elements.modalCity.value.trim()
    }]
  };
  
  elements.modalMessage.textContent = "Wird gebucht...";
  elements.modalMessage.className = "message loading";
  
  const result = await addQuickBooking(payload);
  
  if (result.ok) {
    elements.modalMessage.textContent = `✓ Buchung ${result.booking_id} erstellt!`;
    elements.modalMessage.className = "message success";
    
    await handleRefresh();
    
    setTimeout(() => {
      closeQuickBookModal();
    }, 1500);
  } else {
    elements.modalMessage.textContent = "Fehler: " + (result.message || "Unbekannt");
    elements.modalMessage.className = "message error";
  }
}

// ══════════════════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════════════════

function renderStats() {
  const total = bookingsData.length;
  const confirmed = bookingsData.filter(b => b.status === "CONFIRMED").length;
  const cancelled = bookingsData.filter(b => b.status === "CANCELLED").length;
  const participants = bookingsData
    .filter(b => b.status === "CONFIRMED")
    .reduce((sum, b) => sum + (parseInt(b.participants_count) || 0), 0);
  
  elements.statTotal.textContent = total;
  elements.statConfirmed.textContent = confirmed;
  elements.statCancelled.textContent = cancelled;
  elements.statParticipants.textContent = participants;
}

/**
 * Kombinierte Tabelle: Buchungen & Teilnehmer
 * Jede Zeile = ein Teilnehmer mit allen Buchungs- und Adressdaten
 */
function renderCombinedTable() {
  // Alle Teilnehmer mit Buchungsinfos sammeln
  const all = [];
  bookingsData.forEach(b => {
    const participants = b.participants || [];
    
    // Falls keine Teilnehmer, trotzdem Buchung anzeigen
    if (participants.length === 0) {
      all.push({
        booking_id: b.booking_id,
        slot_id: b.slot_id,
        contact_email: b.contact_email || "",
        contact_phone: b.contact_phone || "",
        status: b.status,
        invoice_sent_gmbh: b.invoice_sent_gmbh,
        appeared: b.appeared,
        membership_form: b.membership_form,
        dsgvo_form: b.dsgvo_form,
        paid_date_gmbh: b.paid_date_gmbh,
        invoice_sent_club: b.invoice_sent_club,
        paid_date_club: b.paid_date_club,
        voucher_code: b.voucher_code || "",
        participant_nr: 0,
        first_name: "(keine TN)",
        last_name: "",
        street: "",
        house_no: "",
        zip: "",
        city: ""
      });
    } else {
      participants.forEach((p, i) => {
        all.push({
          booking_id: b.booking_id,
          slot_id: b.slot_id,
          contact_email: b.contact_email || "",
          contact_phone: b.contact_phone || "",
          status: b.status,
          invoice_sent_gmbh: b.invoice_sent_gmbh,
          appeared: b.appeared,
          membership_form: b.membership_form,
          dsgvo_form: b.dsgvo_form,
          paid_date_gmbh: b.paid_date_gmbh,
          invoice_sent_club: b.invoice_sent_club,
          paid_date_club: b.paid_date_club,
          voucher_code: b.voucher_code || "",
          participant_nr: i + 1,
          first_name: p.first_name || "",
          last_name: p.last_name || "",
          street: p.street || "",
          house_no: p.house_no || "",
          zip: p.zip || "",
          city: p.city || ""
        });
      });
    }
  });
  
  if (all.length === 0) {
    elements.combinedContainer.innerHTML = '<p class="text-muted">Keine Buchungen vorhanden.</p>';
    return;
  }
  
  const sorted = sortData(all, combinedSortColumn, combinedSortDir);
  
  // Hilfsfunktion für Bezahlt-Anzeige (Datum anzeigen wenn gesetzt, sonst Input)
  function renderPaidDateCell(bookingId, paidDate, disabled, fieldName) {
    if (paidDate && !disabled) {
      // Datum ist gesetzt - zeige es als grünes Badge mit Klick zum Ändern
      const formattedDate = formatDate(paidDate);
      return `
        <div class="paid-date-set" title="Klicken zum Ändern">
          <span style="background:#d4edda;padding:0.1rem 0.25rem;border-radius:3px;font-size:0.6rem;font-weight:600;color:#155724;display:inline-block;">${formattedDate}</span>
          <input type="date" class="admin-date" data-id="${bookingId}" data-field="${fieldName}" value="${paidDate}" style="position:absolute;opacity:0;width:100%;height:100%;left:0;top:0;cursor:pointer;">
        </div>
      `;
    } else if (disabled && paidDate) {
      // Storniert aber Datum war gesetzt
      return `<span style="text-decoration:line-through;color:#999;font-size:0.6rem;">${formatDate(paidDate)}</span>`;
    } else {
      // Kein Datum - zeige Input
      return `<input type="date" class="admin-date" data-id="${bookingId}" data-field="${fieldName}" value="${paidDate || ""}" ${disabled ? "disabled" : ""} title="Bezahldatum">`;
    }
  }

  // Einfache Tabelle - jede Zeile enthält alle Daten, alle Spalten sortierbar
  const html = `
    <table class="admin-table combined-table">
      <thead>
        <tr>
          <th class="sortable-header" data-column="slot_id">Termin ${getSortIcon("slot_id", combinedSortColumn, combinedSortDir)}</th>
          <th class="sortable-header" data-column="booking_id">Buchung ${getSortIcon("booking_id", combinedSortColumn, combinedSortDir)}</th>
          <th class="sortable-header" data-column="first_name">Vorname ${getSortIcon("first_name", combinedSortColumn, combinedSortDir)}</th>
          <th class="sortable-header" data-column="last_name">Nachname ${getSortIcon("last_name", combinedSortColumn, combinedSortDir)}</th>
          <th class="sortable-header" data-column="street">Adresse ${getSortIcon("street", combinedSortColumn, combinedSortDir)}</th>
          <th class="sortable-header" data-column="zip">PLZ ${getSortIcon("zip", combinedSortColumn, combinedSortDir)}</th>
          <th class="sortable-header" data-column="city">Ort ${getSortIcon("city", combinedSortColumn, combinedSortDir)}</th>
          <th class="sortable-header" data-column="contact_email">E-Mail ${getSortIcon("contact_email", combinedSortColumn, combinedSortDir)}</th>
          <th class="sortable-header" data-column="contact_phone">Telefon ${getSortIcon("contact_phone", combinedSortColumn, combinedSortDir)}</th>
          <th class="sortable-header" data-column="voucher_code">Gutschein ${getSortIcon("voucher_code", combinedSortColumn, combinedSortDir)}</th>
          <th class="sortable-header col-center" data-column="invoice_sent_gmbh" title="Rechnung GmbH">Re.GmbH ${getSortIcon("invoice_sent_gmbh", combinedSortColumn, combinedSortDir)}</th>
          <th class="sortable-header col-center" data-column="paid_date_gmbh" title="Bezahlt GmbH">Bez.GmbH ${getSortIcon("paid_date_gmbh", combinedSortColumn, combinedSortDir)}</th>
          <th class="sortable-header col-center" data-column="invoice_sent_club" title="Rechnung Club">Re.Club ${getSortIcon("invoice_sent_club", combinedSortColumn, combinedSortDir)}</th>
          <th class="sortable-header col-center" data-column="paid_date_club" title="Bezahlt Club">Bez.Club ${getSortIcon("paid_date_club", combinedSortColumn, combinedSortDir)}</th>
          <th class="sortable-header col-center" data-column="appeared">Erschienen ${getSortIcon("appeared", combinedSortColumn, combinedSortDir)}</th>
          <th class="sortable-header col-center" data-column="status">Status ${getSortIcon("status", combinedSortColumn, combinedSortDir)}</th>
          <th>Aktion</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map((row) => {
          const cancelled = row.status === "CANCELLED";
          const disabled = cancelled ? "disabled" : "";
          const addressStr = row.street ? `${row.street} ${row.house_no || ""}`.trim() : "–";
          
          return `
            <tr class="${cancelled ? "row-cancelled" : ""}">
              <td>${formatDate(row.slot_id)}</td>
              <td><strong>${row.booking_id}</strong></td>
              <td class="name-cell"><strong>${row.first_name}</strong></td>
              <td class="name-cell"><strong>${row.last_name}</strong></td>
              <td>${addressStr}</td>
              <td>${row.zip || "–"}</td>
              <td>${row.city || "–"}</td>
              <td><a href="mailto:${row.contact_email}">${row.contact_email || "–"}</a></td>
              <td>${row.contact_phone || "–"}</td>
              <td>${row.voucher_code ? `<span style="background:#e7f5e7;padding:0.1rem 0.4rem;border-radius:3px;font-size:0.7rem;font-weight:600;color:#2e7d32;">${row.voucher_code}</span>` : "–"}</td>
              <td class="col-center"><input type="checkbox" class="admin-checkbox" data-id="${row.booking_id}" data-field="invoice_sent_gmbh" ${row.invoice_sent_gmbh ? "checked" : ""} ${disabled} title="Rechnung GmbH gesendet"></td>
              <td class="col-center">${renderPaidDateCell(row.booking_id, row.paid_date_gmbh, cancelled, "paid_date_gmbh")}</td>
              <td class="col-center"><input type="checkbox" class="admin-checkbox" data-id="${row.booking_id}" data-field="invoice_sent_club" ${row.invoice_sent_club ? "checked" : ""} ${disabled} title="Rechnung Club gesendet"></td>
              <td class="col-center">${renderPaidDateCell(row.booking_id, row.paid_date_club, cancelled, "paid_date_club")}</td>
              <td class="col-center"><input type="checkbox" class="admin-checkbox" data-id="${row.booking_id}" data-field="appeared" ${row.appeared ? "checked" : ""} ${disabled} title="Teilnehmer erschienen"></td>
              <td class="col-center"><span class="status-badge ${cancelled ? "cancelled" : "confirmed"}">${cancelled ? "✕" : "✓"}</span></td>
              <td class="col-center">
                ${cancelled 
                  ? `<button type="button" class="btn-restore" data-id="${row.booking_id}" title="Wiederherstellen">↩</button>` 
                  : `<button type="button" class="btn-cancel" data-id="${row.booking_id}" title="Stornieren">✕</button>`
                }
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
    <p style="font-size: 0.75rem; color: #666; margin-top: 0.5rem;">
      Buchungen: <strong>${bookingsData.length}</strong> · 
      Teilnehmer: <strong>${all.filter(p => p.participant_nr > 0).length}</strong> · 
      Bestätigt: <strong>${all.filter(p => p.status === "CONFIRMED" && p.participant_nr > 0).length}</strong>
    </p>
  `;
  
  elements.combinedContainer.innerHTML = html;
  attachCombinedListeners();
}

function attachCombinedListeners() {
  // Sort
  document.querySelectorAll('.admin-table.combined-table .sortable-header').forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.column;
      if (combinedSortColumn === col) {
        combinedSortDir = combinedSortDir === "asc" ? "desc" : "asc";
      } else {
        combinedSortColumn = col;
        combinedSortDir = "asc";
      }
      renderCombinedTable();
    });
  });
  
  // Checkboxes
  document.querySelectorAll(".admin-checkbox").forEach(cb => {
    cb.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const field = e.target.dataset.field;
      const val = e.target.checked;
      const result = await updateBookingField(id, field, val);
      if (!result.ok) e.target.checked = !val;
    });
  });
  
  // Date inputs (paid_date_gmbh und paid_date_club)
  document.querySelectorAll(".admin-date").forEach(input => {
    input.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const field = e.target.dataset.field || "paid_date_gmbh";
      const result = await updateBookingField(id, field, e.target.value);
      if (result.ok) {
        // Tabelle neu rendern um Anzeige zu aktualisieren
        await handleRefresh();
      }
    });
  });
  
  // Cancel/Restore
  document.querySelectorAll(".btn-cancel").forEach(btn => {
    btn.addEventListener("click", () => cancelBooking(btn.dataset.id));
  });
  document.querySelectorAll(".btn-restore").forEach(btn => {
    btn.addEventListener("click", () => restoreBooking(btn.dataset.id));
  });
}

// ══════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════

function initTabs() {
  document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      // Deactivate all
      document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      
      // Activate clicked
      tab.classList.add("active");
      const tabId = "tab-" + tab.dataset.tab;
      document.getElementById(tabId)?.classList.add("active");
    });
  });
}

// ══════════════════════════════════════════════════════════════
// HANDLERS
// ══════════════════════════════════════════════════════════════

async function handleLogin() {
  const key = elements.adminKey.value.trim();
  if (!key) {
    elements.loginMessage.textContent = "Bitte Schlüssel eingeben";
    return;
  }
  
  elements.loginBtn.disabled = true;
  elements.loginBtn.textContent = "Prüfe...";
  
  try {
    const [bookingsRes, slots] = await Promise.all([
      fetchBookings(key),
      fetchSlots()
    ]);
    
    if (bookingsRes.ok) {
      currentAdminKey = key;
      bookingsData = bookingsRes.bookings || [];
      slotsData = slots;
      
      // Set to current year for slots
      if (slotsData.length > 0) {
        const firstSlot = extractDateId(slotsData[0].slot_id || slotsData[0].date);
        if (firstSlot) {
          const [y, m] = firstSlot.split("-");
          currentYear = parseInt(y);
          currentMonth = parseInt(m) - 1;
        }
      }
      
      elements.loginSection.classList.add("hidden");
      elements.adminPanel.classList.remove("hidden");
      
      renderStats();
      renderCalendar();
      renderCombinedTable();
    } else {
      elements.loginMessage.textContent = bookingsRes.message || "Ungültiger Schlüssel";
      elements.loginBtn.disabled = false;
      elements.loginBtn.textContent = "Anmelden";
    }
  } catch (e) {
    console.error(e);
    elements.loginMessage.textContent = "Verbindungsfehler";
    elements.loginBtn.disabled = false;
    elements.loginBtn.textContent = "Anmelden";
  }
}

async function handleRefresh() {
  elements.refreshBtn.disabled = true;
  elements.refreshBtn.textContent = "⏳...";
  showLoading(true);
  
  try {
    const [bookingsRes, slots] = await Promise.all([
      fetchBookings(currentAdminKey),
      fetchSlots()
    ]);
    
    if (bookingsRes.ok) {
      bookingsData = bookingsRes.bookings || [];
      slotsData = slots;
      
      renderStats();
      renderCalendar();
      renderCombinedTable();
    }
  } catch (e) {
    console.error(e);
  }
  
  showLoading(false);
  elements.refreshBtn.disabled = false;
  elements.refreshBtn.textContent = "🔄 Aktualisieren";
}

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════

elements.loginBtn.addEventListener("click", handleLogin);
elements.adminKey.addEventListener("keypress", e => { if (e.key === "Enter") handleLogin(); });
elements.refreshBtn.addEventListener("click", handleRefresh);
elements.exportBtn.addEventListener("click", async () => {
  try {
    elements.exportBtn.disabled = true;
    elements.exportBtn.textContent = "Exportiere...";
    
    const response = await fetch(`${API_BASE}?action=admin_export_csv&admin_key=${encodeURIComponent(currentAdminKey)}`);
    const text = await response.text();
    
    // Versuche JSON zu parsen
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      // Falls kein JSON: Vielleicht ist es direkt CSV (alte Version)
      if (text.includes(";") && text.includes("\n")) {
        // Sieht aus wie CSV - direkt herunterladen
        const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `platzerlaubnis_buchungen_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }
      console.error("Server-Antwort:", text.substring(0, 500));
      alert("Export-Fehler: Server hat kein gültiges Format zurückgegeben.\n\nBitte neue Bereitstellung in Apps Script erstellen!");
      return;
    }
    
    if (data.success && data.csv) {
      // CSV als Datei herunterladen
      const blob = new Blob(["\uFEFF" + data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `platzerlaubnis_buchungen_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      alert("Export fehlgeschlagen: " + (data.error || "Unbekannter Fehler"));
    }
  } catch (err) {
    console.error("Export-Fehler:", err);
    alert("Export-Fehler: " + err.message);
  } finally {
    elements.exportBtn.disabled = false;
    elements.exportBtn.textContent = "📥 CSV Export";
  }
});

// Kalender Navigation
elements.prevMonth.addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
});
elements.nextMonth.addEventListener("click", () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
});

// Modal
elements.modalClose.addEventListener("click", closeQuickBookModal);
elements.quickBookModal.addEventListener("click", e => {
  if (e.target === elements.quickBookModal) closeQuickBookModal();
});
elements.quickBookForm.addEventListener("submit", handleQuickBook);

// Tabs
initTabs();

console.log("🔐 Admin Panel v5.3 geladen (GmbH/Club Spalten)");

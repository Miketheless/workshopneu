/**
 * ═══════════════════════════════════════════════════════════
 * PLATZREIFE – Admin JavaScript
 * Golfclub Metzenhof – Version 5.1 (17.01.2026)
 * 
 * Features:
 * - Sortierbare Tabellen
 * - Admin-Checkboxen (Rechnung, Erschienen, Formulare)
 * - Bezahlt-Datum
 * - Admin-Stornierung + Wiederherstellung
 * - Neue Buchung hinzufügen
 * ═══════════════════════════════════════════════════════════
 */

// ══════════════════════════════════════════════════════════════
// KONFIGURATION
// ══════════════════════════════════════════════════════════════

const API_BASE = "https://script.google.com/macros/s/AKfycbzqu4baOn_qlzcQkeNK6NumYOEhRwTfGP-QbLKDtb8fi49MMq-TStg5-ZYevPUgYOq3/exec";

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════

let currentAdminKey = "";
let bookingsData = [];
let slotsData = [];
let participantCounter = 0;

// Sortierung
let bookingsSortColumn = "slot_id";
let bookingsSortDir = "asc";
let participantsSortColumn = "slot_id";
let participantsSortDir = "asc";

// ══════════════════════════════════════════════════════════════
// DOM ELEMENTE
// ══════════════════════════════════════════════════════════════

const elements = {
  loginSection: document.getElementById("login-section"),
  adminPanel: document.getElementById("admin-panel"),
  adminKey: document.getElementById("admin-key"),
  loginBtn: document.getElementById("login-btn"),
  loginMessage: document.getElementById("login-message"),
  refreshBtn: document.getElementById("refresh-btn"),
  exportBtn: document.getElementById("export-btn"),
  toggleAddForm: document.getElementById("toggle-add-form"),
  addBookingSection: document.getElementById("add-booking-section"),
  addBookingForm: document.getElementById("add-booking-form"),
  addBookingMessage: document.getElementById("add-booking-message"),
  newSlot: document.getElementById("new-slot"),
  newEmail: document.getElementById("new-email"),
  newPhone: document.getElementById("new-phone"),
  participantsList: document.getElementById("participants-list"),
  addParticipantBtn: document.getElementById("add-participant-btn"),
  statTotal: document.getElementById("stat-total"),
  statConfirmed: document.getElementById("stat-confirmed"),
  statCancelled: document.getElementById("stat-cancelled"),
  statParticipants: document.getElementById("stat-participants"),
  bookingsContainer: document.getElementById("bookings-container"),
  participantsContainer: document.getElementById("participants-container"),
  loadingOverlay: document.getElementById("loading-overlay")
};

// ══════════════════════════════════════════════════════════════
// HILFSFUNKTIONEN
// ══════════════════════════════════════════════════════════════

function showLoading(show = true) {
  if (elements.loadingOverlay) {
    elements.loadingOverlay.classList.toggle("hidden", !show);
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "–";
  
  try {
    let date;
    if (dateStr instanceof Date) {
      date = dateStr;
    } else if (typeof dateStr === "string") {
      if (dateStr.includes("T")) {
        date = new Date(dateStr);
      } else if (dateStr.includes("-")) {
        const parts = dateStr.split("-");
        if (parts.length === 3) {
          return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
      }
    }
    
    if (date && !isNaN(date.getTime())) {
      return date.toLocaleDateString("de-AT");
    }
  } catch (e) {
    console.warn("Datum-Parse-Fehler:", e);
  }
  
  return String(dateStr);
}

function extractDateId(dateStr) {
  if (!dateStr) return "";
  if (typeof dateStr === "string") {
    if (dateStr.includes("T")) {
      return dateStr.split("T")[0];
    }
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

function formatTimestamp(ts) {
  if (!ts) return "–";
  const date = new Date(ts);
  if (isNaN(date.getTime())) return "–";
  return date.toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function showLoginMessage(text, type = "") {
  elements.loginMessage.textContent = text;
  elements.loginMessage.className = `message ${type}`;
}

function showAddBookingMessage(text, type = "") {
  elements.addBookingMessage.textContent = text;
  elements.addBookingMessage.className = `message ${type}`;
}

function getSortIcon(column, currentColumn, currentDir) {
  if (column !== currentColumn) {
    return '<span class="sort-icon">⇅</span>';
  }
  return currentDir === "asc" 
    ? '<span class="sort-icon active">↑</span>' 
    : '<span class="sort-icon active">↓</span>';
}

function sortData(data, column, direction) {
  return [...data].sort((a, b) => {
    let valA = a[column];
    let valB = b[column];
    
    if (valA == null) valA = "";
    if (valB == null) valB = "";
    
    if (column === "timestamp" || column === "cancelled_at" || column === "slot_id" || column === "paid_date") {
      valA = new Date(valA || 0).getTime();
      valB = new Date(valB || 0).getTime();
    }
    else if (column === "participants_count" || column === "participant_nr") {
      valA = parseInt(valA) || 0;
      valB = parseInt(valB) || 0;
    }
    else if (column === "invoice_sent" || column === "appeared" || column === "membership_form" || column === "dsgvo_form") {
      valA = valA ? 1 : 0;
      valB = valB ? 1 : 0;
    }
    else {
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
    }
    
    if (valA < valB) return direction === "asc" ? -1 : 1;
    if (valA > valB) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

// ══════════════════════════════════════════════════════════════
// API FUNKTIONEN
// ══════════════════════════════════════════════════════════════

async function fetchBookings(adminKey) {
  const response = await fetch(`${API_BASE}?action=admin_bookings&admin_key=${encodeURIComponent(adminKey)}`);
  return await response.json();
}

async function fetchSlots() {
  try {
    const response = await fetch(`${API_BASE}?action=slots`);
    const result = await response.json();
    if (result.ok && result.slots) {
      return result.slots;
    }
  } catch (e) {
    console.warn("Slots laden fehlgeschlagen:", e);
  }
  return [];
}

async function updateBookingField(bookingId, field, value) {
  showLoading(true);
  try {
    const url = `${API_BASE}?action=admin_update&admin_key=${encodeURIComponent(currentAdminKey)}&booking_id=${encodeURIComponent(bookingId)}&field=${encodeURIComponent(field)}&value=${encodeURIComponent(value)}`;
    const response = await fetch(url);
    const result = await response.json();
    
    if (!result.ok) {
      alert("Fehler: " + (result.message || "Unbekannter Fehler"));
    }
    return result;
  } catch (error) {
    console.error("Update-Fehler:", error);
    alert("Verbindungsfehler beim Speichern");
    return { ok: false };
  } finally {
    showLoading(false);
  }
}

async function cancelBooking(bookingId) {
  if (!confirm(`Buchung ${bookingId} wirklich stornieren?`)) {
    return;
  }
  
  showLoading(true);
  try {
    const url = `${API_BASE}?action=admin_cancel&admin_key=${encodeURIComponent(currentAdminKey)}&booking_id=${encodeURIComponent(bookingId)}`;
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.ok) {
      await handleRefresh();
    } else {
      alert("Fehler: " + (result.message || "Unbekannter Fehler"));
    }
  } catch (error) {
    console.error("Stornierung-Fehler:", error);
    alert("Verbindungsfehler bei der Stornierung");
  } finally {
    showLoading(false);
  }
}

async function restoreBooking(bookingId) {
  if (!confirm(`Buchung ${bookingId} wiederherstellen?`)) {
    return;
  }
  
  showLoading(true);
  try {
    const url = `${API_BASE}?action=admin_restore&admin_key=${encodeURIComponent(currentAdminKey)}&booking_id=${encodeURIComponent(bookingId)}`;
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.ok) {
      await handleRefresh();
    } else {
      alert("Fehler: " + (result.message || "Unbekannter Fehler"));
    }
  } catch (error) {
    console.error("Wiederherstellung-Fehler:", error);
    alert("Verbindungsfehler bei der Wiederherstellung");
  } finally {
    showLoading(false);
  }
}

async function addBooking(payload) {
  showLoading(true);
  try {
    const jsonString = JSON.stringify(payload);
    const base64Data = btoa(unescape(encodeURIComponent(jsonString)));
    
    const url = `${API_BASE}?action=admin_add_booking&admin_key=${encodeURIComponent(currentAdminKey)}&data=${base64Data}`;
    const response = await fetch(url);
    const result = await response.json();
    
    return result;
  } catch (error) {
    console.error("AddBooking-Fehler:", error);
    return { ok: false, message: "Verbindungsfehler" };
  } finally {
    showLoading(false);
  }
}

function getExportUrl(adminKey) {
  return `${API_BASE}?action=admin_export_csv&admin_key=${encodeURIComponent(adminKey)}`;
}

// ══════════════════════════════════════════════════════════════
// RENDER FUNKTIONEN
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

function renderSlotOptions() {
  // Deduplizieren und sortieren
  const uniqueSlots = {};
  slotsData.forEach(slot => {
    const dateId = extractDateId(slot.slot_id || slot.date);
    if (!uniqueSlots[dateId]) {
      const free = (slot.capacity || 8) - (slot.booked || 0);
      if (free > 0 && slot.status !== "FULL") {
        uniqueSlots[dateId] = {
          dateId,
          date: slot.date || slot.slot_id,
          free
        };
      }
    }
  });
  
  const sortedSlots = Object.values(uniqueSlots).sort((a, b) => 
    new Date(a.dateId) - new Date(b.dateId)
  );
  
  elements.newSlot.innerHTML = '<option value="">Termin wählen...</option>';
  sortedSlots.forEach(slot => {
    const option = document.createElement("option");
    option.value = slot.dateId;
    option.textContent = `${formatDate(slot.dateId)} (${slot.free} frei)`;
    elements.newSlot.appendChild(option);
  });
}

function renderBookings() {
  if (bookingsData.length === 0) {
    elements.bookingsContainer.innerHTML = '<p class="text-muted">Keine Buchungen vorhanden.</p>';
    return;
  }
  
  const sorted = sortData(bookingsData, bookingsSortColumn, bookingsSortDir);
  
  const tableHtml = `
    <table class="admin-table">
      <thead>
        <tr>
          <th class="sortable-header" data-column="booking_id" data-table="bookings">
            ID ${getSortIcon("booking_id", bookingsSortColumn, bookingsSortDir)}
          </th>
          <th class="sortable-header" data-column="slot_id" data-table="bookings">
            Termin ${getSortIcon("slot_id", bookingsSortColumn, bookingsSortDir)}
          </th>
          <th class="sortable-header" data-column="contact_email" data-table="bookings">
            E-Mail ${getSortIcon("contact_email", bookingsSortColumn, bookingsSortDir)}
          </th>
          <th class="sortable-header" data-column="contact_phone" data-table="bookings">
            Telefon ${getSortIcon("contact_phone", bookingsSortColumn, bookingsSortDir)}
          </th>
          <th class="sortable-header" data-column="participants_count" data-table="bookings">
            TN ${getSortIcon("participants_count", bookingsSortColumn, bookingsSortDir)}
          </th>
          <th class="sortable-header" data-column="invoice_sent" data-table="bookings">
            Rechnung ${getSortIcon("invoice_sent", bookingsSortColumn, bookingsSortDir)}
          </th>
          <th class="sortable-header" data-column="appeared" data-table="bookings">
            Erschienen ${getSortIcon("appeared", bookingsSortColumn, bookingsSortDir)}
          </th>
          <th class="sortable-header" data-column="membership_form" data-table="bookings">
            Mitglied ${getSortIcon("membership_form", bookingsSortColumn, bookingsSortDir)}
          </th>
          <th class="sortable-header" data-column="dsgvo_form" data-table="bookings">
            DSGVO ${getSortIcon("dsgvo_form", bookingsSortColumn, bookingsSortDir)}
          </th>
          <th class="sortable-header" data-column="paid_date" data-table="bookings">
            Bezahlt am ${getSortIcon("paid_date", bookingsSortColumn, bookingsSortDir)}
          </th>
          <th class="sortable-header" data-column="status" data-table="bookings">
            Status ${getSortIcon("status", bookingsSortColumn, bookingsSortDir)}
          </th>
          <th class="no-sort">Aktion</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(b => {
          const isCancelled = b.status === "CANCELLED";
          const rowClass = isCancelled ? "row-cancelled" : "";
          const disabled = isCancelled ? "disabled" : "";
          
          let paidDateValue = "";
          if (b.paid_date) {
            try {
              const d = new Date(b.paid_date);
              if (!isNaN(d.getTime())) {
                paidDateValue = d.toISOString().split("T")[0];
              }
            } catch (e) {}
          }
          
          return `
            <tr class="${rowClass}">
              <td class="no-strike"><strong class="text-small">${b.booking_id || "–"}</strong></td>
              <td class="no-strike">${formatDate(b.slot_id)}</td>
              <td class="no-strike"><a href="mailto:${b.contact_email}" class="text-small">${b.contact_email || "–"}</a></td>
              <td class="no-strike"><a href="tel:${b.contact_phone}" class="text-small">${b.contact_phone || "–"}</a></td>
              <td class="no-strike" style="text-align:center;">${b.participants_count || 0}</td>
              <td class="no-strike" style="text-align:center;">
                <input type="checkbox" class="admin-checkbox" 
                       data-booking-id="${b.booking_id}" 
                       data-field="invoice_sent"
                       ${b.invoice_sent ? "checked" : ""} 
                       ${disabled}>
              </td>
              <td class="no-strike" style="text-align:center;">
                <input type="checkbox" class="admin-checkbox" 
                       data-booking-id="${b.booking_id}" 
                       data-field="appeared"
                       ${b.appeared ? "checked" : ""} 
                       ${disabled}>
              </td>
              <td class="no-strike" style="text-align:center;">
                <input type="checkbox" class="admin-checkbox" 
                       data-booking-id="${b.booking_id}" 
                       data-field="membership_form"
                       ${b.membership_form ? "checked" : ""} 
                       ${disabled}>
              </td>
              <td class="no-strike" style="text-align:center;">
                <input type="checkbox" class="admin-checkbox" 
                       data-booking-id="${b.booking_id}" 
                       data-field="dsgvo_form"
                       ${b.dsgvo_form ? "checked" : ""} 
                       ${disabled}>
              </td>
              <td class="no-strike">
                <input type="date" class="admin-date" 
                       data-booking-id="${b.booking_id}" 
                       data-field="paid_date"
                       value="${paidDateValue}"
                       ${disabled}>
              </td>
              <td class="no-strike">
                <span class="status-badge ${isCancelled ? "cancelled" : "confirmed"}">
                  ${isCancelled ? "✕ Storniert" : "✓ OK"}
                </span>
              </td>
              <td class="no-strike">
                ${isCancelled ? `
                  <button type="button" class="btn-restore" data-booking-id="${b.booking_id}">
                    ↩ Wiederherstellen
                  </button>
                ` : `
                  <button type="button" class="btn-cancel" data-booking-id="${b.booking_id}">
                    ✕ Stornieren
                  </button>
                `}
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
  
  elements.bookingsContainer.innerHTML = tableHtml;
  attachBookingEventListeners();
}

function attachBookingEventListeners() {
  // Sortierung
  document.querySelectorAll('.sortable-header[data-table="bookings"]').forEach(header => {
    header.addEventListener("click", () => {
      const column = header.dataset.column;
      if (bookingsSortColumn === column) {
        bookingsSortDir = bookingsSortDir === "asc" ? "desc" : "asc";
      } else {
        bookingsSortColumn = column;
        bookingsSortDir = "asc";
      }
      renderBookings();
    });
  });
  
  // Checkboxen
  document.querySelectorAll(".admin-checkbox").forEach(checkbox => {
    checkbox.addEventListener("change", async (e) => {
      const bookingId = e.target.dataset.bookingId;
      const field = e.target.dataset.field;
      const value = e.target.checked;
      
      const result = await updateBookingField(bookingId, field, value);
      
      if (result.ok) {
        const booking = bookingsData.find(b => b.booking_id === bookingId);
        if (booking) {
          booking[field] = value;
        }
      } else {
        e.target.checked = !value;
      }
    });
  });
  
  // Datumseingaben
  document.querySelectorAll(".admin-date").forEach(input => {
    input.addEventListener("change", async (e) => {
      const bookingId = e.target.dataset.bookingId;
      const field = e.target.dataset.field;
      const value = e.target.value;
      
      const result = await updateBookingField(bookingId, field, value);
      
      if (result.ok) {
        const booking = bookingsData.find(b => b.booking_id === bookingId);
        if (booking) {
          booking[field] = value;
        }
      }
    });
  });
  
  // Stornieren-Buttons
  document.querySelectorAll(".btn-cancel").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const bookingId = e.target.dataset.bookingId;
      cancelBooking(bookingId);
    });
  });
  
  // Wiederherstellen-Buttons
  document.querySelectorAll(".btn-restore").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const bookingId = e.target.dataset.bookingId;
      restoreBooking(bookingId);
    });
  });
}

function renderParticipants() {
  const allParticipants = [];
  
  bookingsData.forEach(booking => {
    if (booking.participants && Array.isArray(booking.participants)) {
      booking.participants.forEach((p, idx) => {
        allParticipants.push({
          booking_id: booking.booking_id,
          booking_status: booking.status,
          slot_id: booking.slot_id,
          contact_email: booking.contact_email,
          contact_phone: booking.contact_phone,
          participant_nr: idx + 1,
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
  
  if (allParticipants.length === 0) {
    elements.participantsContainer.innerHTML = '<p class="text-muted">Keine Teilnehmer vorhanden.</p>';
    return;
  }
  
  const sorted = sortData(allParticipants, participantsSortColumn, participantsSortDir);
  
  const columns = [
    { key: "booking_id", label: "Buchungs-ID" },
    { key: "slot_id", label: "Termin" },
    { key: "participant_nr", label: "Nr." },
    { key: "first_name", label: "Vorname" },
    { key: "last_name", label: "Nachname" },
    { key: "street", label: "Straße" },
    { key: "house_no", label: "Nr." },
    { key: "zip", label: "PLZ" },
    { key: "city", label: "Ort" },
    { key: "booking_status", label: "Status" }
  ];
  
  const tableHtml = `
    <table class="admin-table">
      <thead>
        <tr>
          ${columns.map(col => `
            <th class="sortable-header" data-column="${col.key}" data-table="participants">
              ${col.label} ${getSortIcon(col.key, participantsSortColumn, participantsSortDir)}
            </th>
          `).join("")}
        </tr>
      </thead>
      <tbody>
        ${sorted.map(p => {
          const isCancelled = p.booking_status === "CANCELLED";
          return `
            <tr class="${isCancelled ? "row-cancelled" : ""}">
              <td class="text-small no-strike">${p.booking_id || "–"}</td>
              <td class="no-strike">${formatDate(p.slot_id)}</td>
              <td class="no-strike" style="text-align:center;">${p.participant_nr}</td>
              <td class="name-cell"><strong>${p.first_name || "–"}</strong></td>
              <td class="name-cell"><strong>${p.last_name || "–"}</strong></td>
              <td class="no-strike">${p.street || "–"}</td>
              <td class="no-strike">${p.house_no || "–"}</td>
              <td class="no-strike">${p.zip || "–"}</td>
              <td class="no-strike">${p.city || "–"}</td>
              <td class="no-strike">
                <span class="status-badge ${isCancelled ? "cancelled" : "confirmed"}">
                  ${isCancelled ? "✕" : "✓"}
                </span>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
    <p class="text-small" style="margin-top: 0.5rem; color: #666;">
      Gesamt: <strong>${allParticipants.length}</strong> Teilnehmer 
      (${allParticipants.filter(p => p.booking_status === "CONFIRMED").length} bestätigt, 
      ${allParticipants.filter(p => p.booking_status === "CANCELLED").length} storniert)
    </p>
  `;
  
  elements.participantsContainer.innerHTML = tableHtml;
  
  // Sortierung
  document.querySelectorAll('.sortable-header[data-table="participants"]').forEach(header => {
    header.addEventListener("click", () => {
      const column = header.dataset.column;
      if (participantsSortColumn === column) {
        participantsSortDir = participantsSortDir === "asc" ? "desc" : "asc";
      } else {
        participantsSortColumn = column;
        participantsSortDir = "asc";
      }
      renderParticipants();
    });
  });
}

// ══════════════════════════════════════════════════════════════
// NEUE BUCHUNG FORMULAR
// ══════════════════════════════════════════════════════════════

function addParticipantEntry() {
  participantCounter++;
  const entry = document.createElement("div");
  entry.className = "participant-entry";
  entry.dataset.index = participantCounter;
  
  entry.innerHTML = `
    <div class="participant-header">
      <strong>Teilnehmer ${participantCounter}</strong>
      ${participantCounter > 1 ? `<button type="button" class="btn-remove" data-index="${participantCounter}">×</button>` : ""}
    </div>
    <div class="form-row">
      <div>
        <label>Vorname *</label>
        <input type="text" name="first_name_${participantCounter}" required>
      </div>
      <div>
        <label>Nachname *</label>
        <input type="text" name="last_name_${participantCounter}" required>
      </div>
    </div>
    <div class="form-row">
      <div>
        <label>Straße</label>
        <input type="text" name="street_${participantCounter}">
      </div>
      <div>
        <label>Hausnummer</label>
        <input type="text" name="house_no_${participantCounter}">
      </div>
    </div>
    <div class="form-row">
      <div>
        <label>PLZ</label>
        <input type="text" name="zip_${participantCounter}">
      </div>
      <div>
        <label>Ort</label>
        <input type="text" name="city_${participantCounter}">
      </div>
    </div>
  `;
  
  elements.participantsList.appendChild(entry);
  
  // Remove-Button Event
  const removeBtn = entry.querySelector(".btn-remove");
  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      entry.remove();
      updateParticipantNumbers();
    });
  }
}

function updateParticipantNumbers() {
  const entries = elements.participantsList.querySelectorAll(".participant-entry");
  entries.forEach((entry, idx) => {
    const header = entry.querySelector(".participant-header strong");
    if (header) {
      header.textContent = `Teilnehmer ${idx + 1}`;
    }
  });
}

function resetAddBookingForm() {
  elements.addBookingForm.reset();
  elements.participantsList.innerHTML = "";
  participantCounter = 0;
  addParticipantEntry(); // Ersten Teilnehmer hinzufügen
  showAddBookingMessage("");
}

async function handleAddBooking(e) {
  e.preventDefault();
  
  const slotId = elements.newSlot.value;
  const email = elements.newEmail.value;
  const phone = elements.newPhone.value;
  
  if (!slotId) {
    showAddBookingMessage("Bitte Termin wählen.", "error");
    return;
  }
  
  // Teilnehmer sammeln
  const participants = [];
  const entries = elements.participantsList.querySelectorAll(".participant-entry");
  
  for (const entry of entries) {
    const idx = entry.dataset.index;
    const firstName = entry.querySelector(`input[name="first_name_${idx}"]`)?.value?.trim();
    const lastName = entry.querySelector(`input[name="last_name_${idx}"]`)?.value?.trim();
    
    if (!firstName || !lastName) {
      showAddBookingMessage("Bitte Vor- und Nachname für alle Teilnehmer eingeben.", "error");
      return;
    }
    
    participants.push({
      first_name: firstName,
      last_name: lastName,
      street: entry.querySelector(`input[name="street_${idx}"]`)?.value?.trim() || "",
      house_no: entry.querySelector(`input[name="house_no_${idx}"]`)?.value?.trim() || "",
      zip: entry.querySelector(`input[name="zip_${idx}"]`)?.value?.trim() || "",
      city: entry.querySelector(`input[name="city_${idx}"]`)?.value?.trim() || ""
    });
  }
  
  if (participants.length === 0) {
    showAddBookingMessage("Mindestens ein Teilnehmer erforderlich.", "error");
    return;
  }
  
  const payload = {
    slot_id: slotId,
    contact_email: email,
    contact_phone: phone,
    participants: participants
  };
  
  showAddBookingMessage("Buchung wird erstellt...", "loading");
  
  const result = await addBooking(payload);
  
  if (result.ok) {
    showAddBookingMessage(`✓ Buchung ${result.booking_id} erstellt!`, "success");
    resetAddBookingForm();
    await handleRefresh();
  } else {
    showAddBookingMessage("Fehler: " + (result.message || "Unbekannter Fehler"), "error");
  }
}

// ══════════════════════════════════════════════════════════════
// EVENT HANDLER
// ══════════════════════════════════════════════════════════════

async function handleLogin() {
  const key = elements.adminKey.value.trim();
  if (!key) {
    showLoginMessage("Bitte Admin-Schlüssel eingeben.", "error");
    return;
  }
  
  elements.loginBtn.disabled = true;
  elements.loginBtn.textContent = "Wird geprüft...";
  showLoginMessage("Anmeldung...", "loading");
  
  try {
    const [bookingsResult, slots] = await Promise.all([
      fetchBookings(key),
      fetchSlots()
    ]);
    
    if (bookingsResult.ok) {
      currentAdminKey = key;
      bookingsData = bookingsResult.bookings || [];
      slotsData = slots;
      
      elements.loginSection.classList.add("hidden");
      elements.adminPanel.classList.remove("hidden");
      
      renderStats();
      renderBookings();
      renderParticipants();
      renderSlotOptions();
      
      // Ersten Teilnehmer im Formular hinzufügen
      addParticipantEntry();
    } else {
      showLoginMessage(bookingsResult.message || "Ungültiger Schlüssel.", "error");
      elements.loginBtn.disabled = false;
      elements.loginBtn.textContent = "Anmelden";
    }
  } catch (error) {
    console.error("Login-Fehler:", error);
    showLoginMessage("Verbindungsfehler.", "error");
    elements.loginBtn.disabled = false;
    elements.loginBtn.textContent = "Anmelden";
  }
}

async function handleRefresh() {
  elements.refreshBtn.disabled = true;
  elements.refreshBtn.textContent = "⏳ Lädt...";
  showLoading(true);
  
  try {
    const [bookingsResult, slots] = await Promise.all([
      fetchBookings(currentAdminKey),
      fetchSlots()
    ]);
    
    if (bookingsResult.ok) {
      bookingsData = bookingsResult.bookings || [];
      slotsData = slots;
      renderStats();
      renderBookings();
      renderParticipants();
      renderSlotOptions();
    }
  } catch (error) {
    console.error("Refresh-Fehler:", error);
  }
  
  showLoading(false);
  elements.refreshBtn.disabled = false;
  elements.refreshBtn.textContent = "🔄 Aktualisieren";
}

function handleExport() {
  window.open(getExportUrl(currentAdminKey), "_blank");
}

function toggleAddForm() {
  const section = elements.addBookingSection;
  if (section.style.display === "none") {
    section.style.display = "block";
  } else {
    section.style.display = "none";
  }
}

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════

elements.loginBtn.addEventListener("click", handleLogin);
elements.adminKey.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleLogin();
});
elements.refreshBtn.addEventListener("click", handleRefresh);
elements.exportBtn.addEventListener("click", handleExport);
elements.toggleAddForm.addEventListener("click", toggleAddForm);
elements.addParticipantBtn.addEventListener("click", addParticipantEntry);
elements.addBookingForm.addEventListener("submit", handleAddBooking);

console.log("🔐 Admin Panel v5.1 geladen");

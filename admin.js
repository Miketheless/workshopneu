/**
 * ═══════════════════════════════════════════════════════════
 * PLATZREIFE – Admin JavaScript
 * Golfclub Metzenhof – Version 4.2 (17.01.2026)
 * Neu: Teilnehmertabelle + Sortierbare Spalten
 * ═══════════════════════════════════════════════════════════
 */

// ══════════════════════════════════════════════════════════════
// KONFIGURATION
// ══════════════════════════════════════════════════════════════

const API_BASE = "https://script.google.com/macros/s/AKfycbzeT3syS3BN25_HR9QJ-qzHETYSTyz_Z61KxvIa8K0nr5b8XzIGr6A-FwyERn_DU3Dl_A/exec";

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
  statTotal: document.getElementById("stat-total"),
  statConfirmed: document.getElementById("stat-confirmed"),
  statCancelled: document.getElementById("stat-cancelled"),
  statParticipants: document.getElementById("stat-participants"),
  bookingsContainer: document.getElementById("bookings-container"),
  participantsContainer: document.getElementById("participants-container")
};

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════

let currentAdminKey = "";
let bookingsData = [];

// Sortierung
let bookingsSortColumn = "timestamp";
let bookingsSortDir = "desc";
let participantsSortColumn = "booking_id";
let participantsSortDir = "asc";

// ══════════════════════════════════════════════════════════════
// HILFSFUNKTIONEN
// ══════════════════════════════════════════════════════════════

/**
 * Datum formatieren: "2026-02-25" oder ISO → "25.02.2026"
 */
function formatDate(dateStr) {
  if (!dateStr) return "–";
  
  // ISO Format
  if (dateStr.includes("T")) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("de-AT");
  }
  
  // YYYY-MM-DD Format
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
  }
  
  return dateStr;
}

/**
 * Timestamp formatieren
 */
function formatTimestamp(ts) {
  if (!ts) return "–";
  const date = new Date(ts);
  return date.toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * Nachricht anzeigen
 */
function showLoginMessage(text, type = "") {
  elements.loginMessage.textContent = text;
  elements.loginMessage.className = `message ${type}`;
}

/**
 * Sortier-Icon generieren
 */
function getSortIcon(column, currentColumn, currentDir) {
  if (column !== currentColumn) {
    return '<span class="sort-icon">⇅</span>';
  }
  return currentDir === "asc" 
    ? '<span class="sort-icon active">↑</span>' 
    : '<span class="sort-icon active">↓</span>';
}

/**
 * Generische Sortierfunktion
 */
function sortData(data, column, direction) {
  return [...data].sort((a, b) => {
    let valA = a[column];
    let valB = b[column];
    
    // Null/undefined handling
    if (valA == null) valA = "";
    if (valB == null) valB = "";
    
    // Datum/Timestamp erkennen
    if (column === "timestamp" || column === "cancelled_at" || column === "slot_id") {
      valA = new Date(valA || 0).getTime();
      valB = new Date(valB || 0).getTime();
    }
    // Zahlen
    else if (column === "participants_count") {
      valA = parseInt(valA) || 0;
      valB = parseInt(valB) || 0;
    }
    // Strings
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

function getExportUrl(adminKey) {
  return `${API_BASE}?action=admin_export_csv&admin_key=${encodeURIComponent(adminKey)}`;
}

// ══════════════════════════════════════════════════════════════
// RENDER FUNKTIONEN
// ══════════════════════════════════════════════════════════════

/**
 * Statistiken berechnen und anzeigen
 */
function renderStats() {
  const total = bookingsData.length;
  const confirmed = bookingsData.filter(b => b.status === "CONFIRMED").length;
  const cancelled = bookingsData.filter(b => b.status === "CANCELLED").length;
  const participants = bookingsData
    .filter(b => b.status === "CONFIRMED")
    .reduce((sum, b) => sum + (b.participants_count || 0), 0);
  
  elements.statTotal.textContent = total;
  elements.statConfirmed.textContent = confirmed;
  elements.statCancelled.textContent = cancelled;
  elements.statParticipants.textContent = participants;
}

/**
 * Buchungstabelle rendern (mit Sortierung)
 */
function renderBookings() {
  if (bookingsData.length === 0) {
    elements.bookingsContainer.innerHTML = '<p class="text-muted">Keine Buchungen vorhanden.</p>';
    return;
  }
  
  // Sortieren
  const sorted = sortData(bookingsData, bookingsSortColumn, bookingsSortDir);
  
  const columns = [
    { key: "booking_id", label: "Buchungs-ID" },
    { key: "timestamp", label: "Buchungsdatum" },
    { key: "slot_id", label: "Kurstermin" },
    { key: "contact_email", label: "E-Mail" },
    { key: "contact_phone", label: "Telefon" },
    { key: "participants_count", label: "Teilnehmer" },
    { key: "status", label: "Status" }
  ];
  
  const tableHtml = `
    <table class="admin-table sortable">
      <thead>
        <tr>
          ${columns.map(col => `
            <th class="sortable-header" data-column="${col.key}" data-table="bookings">
              ${col.label} ${getSortIcon(col.key, bookingsSortColumn, bookingsSortDir)}
            </th>
          `).join("")}
        </tr>
      </thead>
      <tbody>
        ${sorted.map(booking => `
          <tr class="${booking.status === "CANCELLED" ? "row-cancelled" : ""}">
            <td><strong>${booking.booking_id || "–"}</strong></td>
            <td>${formatTimestamp(booking.timestamp)}</td>
            <td>${formatDate(booking.slot_id)}</td>
            <td><a href="mailto:${booking.contact_email}">${booking.contact_email || "–"}</a></td>
            <td><a href="tel:${booking.contact_phone}">${booking.contact_phone || "–"}</a></td>
            <td class="text-center">
              <span class="participant-count">${booking.participants_count || 0}</span>
            </td>
            <td>
              <span class="status-badge ${booking.status === "CONFIRMED" ? "confirmed" : "cancelled"}">
                ${booking.status === "CONFIRMED" ? "✓ Bestätigt" : "✕ Storniert"}
              </span>
              ${booking.cancelled_at ? `<br><small class="text-muted">${formatTimestamp(booking.cancelled_at)}</small>` : ""}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  
  elements.bookingsContainer.innerHTML = tableHtml;
  
  // Event Listener für Sortierung
  attachSortListeners("bookings");
}

/**
 * Teilnehmertabelle rendern (mit Sortierung)
 */
function renderParticipants() {
  // Alle Teilnehmer aus allen Buchungen extrahieren
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
          city: p.city || "",
          full_name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
          full_address: `${p.street || ""} ${p.house_no || ""}, ${p.zip || ""} ${p.city || ""}`.trim()
        });
      });
    }
  });
  
  if (allParticipants.length === 0) {
    elements.participantsContainer.innerHTML = '<p class="text-muted">Keine Teilnehmer vorhanden.</p>';
    return;
  }
  
  // Sortieren
  const sorted = sortData(allParticipants, participantsSortColumn, participantsSortDir);
  
  const columns = [
    { key: "booking_id", label: "Buchungs-ID" },
    { key: "slot_id", label: "Kurstermin" },
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
    <table class="admin-table sortable participants-table">
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
        ${sorted.map(p => `
          <tr class="${p.booking_status === "CANCELLED" ? "row-cancelled" : ""}">
            <td><small>${p.booking_id || "–"}</small></td>
            <td>${formatDate(p.slot_id)}</td>
            <td class="text-center">${p.participant_nr}</td>
            <td><strong>${p.first_name || "–"}</strong></td>
            <td><strong>${p.last_name || "–"}</strong></td>
            <td>${p.street || "–"}</td>
            <td>${p.house_no || "–"}</td>
            <td>${p.zip || "–"}</td>
            <td>${p.city || "–"}</td>
            <td>
              <span class="status-badge ${p.booking_status === "CONFIRMED" ? "confirmed" : "cancelled"}">
                ${p.booking_status === "CONFIRMED" ? "✓" : "✕"}
              </span>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <p class="table-summary">
      Gesamt: <strong>${allParticipants.length}</strong> Teilnehmer 
      (${allParticipants.filter(p => p.booking_status === "CONFIRMED").length} bestätigt, 
      ${allParticipants.filter(p => p.booking_status === "CANCELLED").length} storniert)
    </p>
  `;
  
  elements.participantsContainer.innerHTML = tableHtml;
  
  // Event Listener für Sortierung
  attachSortListeners("participants");
}

/**
 * Event Listener für sortierbare Spalten
 */
function attachSortListeners(tableType) {
  const headers = document.querySelectorAll(`.sortable-header[data-table="${tableType}"]`);
  
  headers.forEach(header => {
    header.addEventListener("click", () => {
      const column = header.dataset.column;
      
      if (tableType === "bookings") {
        // Toggle Richtung wenn gleiche Spalte
        if (bookingsSortColumn === column) {
          bookingsSortDir = bookingsSortDir === "asc" ? "desc" : "asc";
        } else {
          bookingsSortColumn = column;
          bookingsSortDir = "asc";
        }
        renderBookings();
      } else {
        if (participantsSortColumn === column) {
          participantsSortDir = participantsSortDir === "asc" ? "desc" : "asc";
        } else {
          participantsSortColumn = column;
          participantsSortDir = "asc";
        }
        renderParticipants();
      }
    });
  });
}

// ══════════════════════════════════════════════════════════════
// EVENT HANDLER
// ══════════════════════════════════════════════════════════════

async function handleLogin() {
  const key = elements.adminKey.value.trim();
  if (!key) {
    showLoginMessage("Bitte geben Sie den Admin-Schlüssel ein.", "error");
    return;
  }
  
  elements.loginBtn.disabled = true;
  elements.loginBtn.textContent = "Wird geprüft...";
  showLoginMessage("Anmeldung wird geprüft...", "loading");
  
  try {
    const result = await fetchBookings(key);
    
    if (result.ok) {
      currentAdminKey = key;
      bookingsData = result.bookings || [];
      
      // UI wechseln
      elements.loginSection.classList.add("hidden");
      elements.adminPanel.classList.remove("hidden");
      
      // Daten anzeigen
      renderStats();
      renderBookings();
      renderParticipants();
    } else {
      showLoginMessage(result.message || "Ungültiger Admin-Schlüssel.", "error");
      elements.loginBtn.disabled = false;
      elements.loginBtn.textContent = "Anmelden";
    }
  } catch (error) {
    console.error("Login-Fehler:", error);
    showLoginMessage("Verbindungsfehler. Bitte versuchen Sie es später.", "error");
    elements.loginBtn.disabled = false;
    elements.loginBtn.textContent = "Anmelden";
  }
}

async function handleRefresh() {
  elements.refreshBtn.disabled = true;
  elements.refreshBtn.textContent = "Lädt...";
  
  try {
    const result = await fetchBookings(currentAdminKey);
    
    if (result.ok) {
      bookingsData = result.bookings || [];
      renderStats();
      renderBookings();
      renderParticipants();
    }
  } catch (error) {
    console.error("Refresh-Fehler:", error);
  }
  
  elements.refreshBtn.disabled = false;
  elements.refreshBtn.textContent = "Daten aktualisieren";
}

function handleExport() {
  const url = getExportUrl(currentAdminKey);
  window.open(url, "_blank");
}

// Event Listener
elements.loginBtn.addEventListener("click", handleLogin);
elements.adminKey.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleLogin();
});
elements.refreshBtn.addEventListener("click", handleRefresh);
elements.exportBtn.addEventListener("click", handleExport);

console.log("🔐 Admin Panel v4.2 geladen");

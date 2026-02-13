/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * WORKSHOP BUCHUNGSSYSTEM – Google Apps Script Backend
 * Gemma Golfn / Golfclub Metzenhof
 * 
 * INSTALLATION:
 * 1. Neues Google Sheet erstellen mit Tabs: Workshops, Slots, Bookings, Participants, Settings
 * 2. initSheets() ausführen (oder Header manuell anlegen)
 * 3. seedWorkshops() + seedSlotsFromFlyer_March() ausführen
 * 4. SPREADSHEET_ID eintragen, Bereitstellen als Web-App
 * 5. URL in app.js, admin.js, cancel.html eintragen
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// WICHTIG: Ersetze durch deine echte Sheet-ID (zwischen /d/ und /edit in der URL)
const SPREADSHEET_ID = "1wM-yIR0EkbqPoAX9262P0wOF4QgPLS8RSElQK1hmmBU";

const SHEET_WORKSHOPS = "Workshops";
const SHEET_SLOTS = "Slots";
const SHEET_BOOKINGS = "Bookings";
const SHEET_PARTICIPANTS = "Participants";
const SHEET_SETTINGS = "Settings";

const MAX_PARTICIPANTS = 4;

// ══════════════════════════════════════════════════════════════════════════════
// HILFSFUNKTIONEN
// ══════════════════════════════════════════════════════════════════════════════

function getSpreadsheet() {
  // Fallback: Wenn Skript aus dem Sheet heraus läuft (Erweiterungen → Apps Script)
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (_) {}
  
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "DEINE_SPREADSHEET_ID") {
    throw new Error("SPREADSHEET_ID nicht gesetzt! Öffne backend.gs (Zeile 15) und trage die ID aus der Sheet-URL ein (zwischen /d/ und /edit). Beispiel: const SPREADSHEET_ID = \"1abc123...\";");
  }
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
  } catch (e) {
    throw new Error("Spreadsheet nicht gefunden. Prüfe SPREADSHEET_ID – korrekt? Keine Leerzeichen? Zugriff auf das Sheet? Originalfehler: " + e.message);
  }
}

function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

function getSetting(key) {
  const sheet = getSheet(SHEET_SETTINGS);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

function generateBookingId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "WS-";
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function generateCancelToken() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function extractSlotDateId(value) {
  if (!value) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(value).trim();
  if (str.includes('T')) return str.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return str;
}

function formatDateForEmail(dateValue) {
  const weekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  let date;
  if (dateValue instanceof Date) date = dateValue;
  else if (typeof dateValue === "string") {
    if (dateValue.includes('T')) date = new Date(dateValue);
    else if (dateValue.includes('-')) {
      const [year, month, day] = dateValue.split("-");
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else date = new Date(dateValue);
  } else date = new Date(dateValue);
  const weekday = weekdays[date.getDay()];
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${weekday}, ${day}.${month}.${year}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// API
// ══════════════════════════════════════════════════════════════════════════════

function doGet(e) {
  if (!e || !e.parameter) {
    return jsonResponse({ ok: false, message: "Keine Parameter" });
  }
  const action = e.parameter.action;
  
  switch (action) {
    case "workshops": return handleGetWorkshops();
    case "slots": return handleGetSlots(e.parameter.workshop_id);
    case "book": return handleBookViaGet(e.parameter.data);
    case "cancel": return handleCancel(e.parameter.token);
    case "admin_bookings": return handleAdminBookings(e.parameter.admin_key);
    case "admin_export_csv": return handleAdminExportCsv(e.parameter.admin_key);
    case "admin_slots": return handleAdminSlots(e.parameter.admin_key);
    case "admin_add_slot": return handleAdminAddSlot(e.parameter);
    default: return jsonResponse({ ok: false, message: "Unbekannte Aktion" });
  }
}

function handleBookViaGet(base64Data) {
  try {
    if (!base64Data) return jsonResponse({ ok: false, success: false, error: "Keine Buchungsdaten" });
    const jsonString = Utilities.newBlob(Utilities.base64Decode(base64Data)).getDataAsString("UTF-8");
    const payload = JSON.parse(jsonString);
    return handleBook(payload);
  } catch (error) {
    return jsonResponse({ ok: false, success: false, error: "Fehler: " + error.message });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// WORKSHOPS
// ══════════════════════════════════════════════════════════════════════════════

function handleGetWorkshops() {
  const sheet = getSheet(SHEET_WORKSHOPS);
  if (!sheet) return jsonResponse({ ok: false, workshops: [] });
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return jsonResponse({ ok: true, workshops: [] });
  
  const headers = data[0];
  const workshops = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const isActive = row[7] !== false && row[7] !== "FALSE" && row[7] !== "";
    if (!isActive) continue;
    
    workshops.push({
      workshop_id: row[0],
      title: row[1],
      description: row[2],
      duration_text: row[3],
      price_eur: parseInt(row[4]) || 50,
      min_participants: parseInt(row[5]) || 2,
      max_participants: parseInt(row[6]) || MAX_PARTICIPANTS,
      is_active: true
    });
  }
  return jsonResponse({ ok: true, workshops });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLOTS
// ══════════════════════════════════════════════════════════════════════════════

function handleGetSlots(workshopId) {
  if (!workshopId) return jsonResponse({ ok: false, slots: [] });
  
  const sheet = getSheet(SHEET_SLOTS);
  if (!sheet) return jsonResponse({ ok: true, slots: [] });
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return jsonResponse({ ok: true, slots: [] });
  
  const slots = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[1]) !== String(workshopId)) continue; // workshop_id Spalte 2
    
    const dateId = extractSlotDateId(row[2]); // date
    if (!dateId) continue;
    
    const slotDate = new Date(dateId);
    if (slotDate < today) continue; // Vergangene Slots nicht liefern
    
    const capacity = parseInt(row[5]) || MAX_PARTICIPANTS;
    const booked = parseInt(row[6]) || 0;
    const status = row[7] || "OPEN";
    
    slots.push({
      slot_id: row[0],
      workshop_id: row[1],
      date: dateId,
      start: row[3] || "10:00",
      end: row[4] || "12:00",
      capacity,
      booked,
      free: Math.max(0, capacity - booked),
      status: (capacity - booked) <= 0 ? "FULL" : status
    });
  }
  
  return jsonResponse({ ok: true, slots });
}

// ══════════════════════════════════════════════════════════════════════════════
// BUCHUNG
// ══════════════════════════════════════════════════════════════════════════════

function handleBook(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    if (!payload.slot_id || !payload.workshop_id || !payload.contact_email || !payload.participants || payload.participants.length === 0) {
      return jsonResponse({ ok: false, message: "Unvollständige Buchungsdaten" });
    }
    
    if (!payload.agb_accepted || !payload.privacy_accepted) {
      return jsonResponse({ ok: false, message: "AGB und Datenschutz müssen akzeptiert werden" });
    }
    
    const participantCount = payload.participants.length;
    if (participantCount < 1 || participantCount > MAX_PARTICIPANTS) {
      return jsonResponse({ ok: false, message: "Ungültige Teilnehmeranzahl (1–" + MAX_PARTICIPANTS + ")" });
    }
    
    const slotsSheet = getSheet(SHEET_SLOTS);
    const slotsData = slotsSheet.getDataRange().getValues();
    
    let slotRowIndex = -1;
    let slotData = null;
    
    for (let i = 1; i < slotsData.length; i++) {
      const row = slotsData[i];
      const slotIdMatch = String(row[0]) === String(payload.slot_id);
      const workshopMatch = String(row[1]) === String(payload.workshop_id);
      
      if (slotIdMatch && workshopMatch) {
        slotRowIndex = i + 1;
        slotData = {
          slot_id: row[0],
          workshop_id: row[1],
          date: row[2],
          start: row[3],
          end: row[4],
          capacity: parseInt(row[5]) || MAX_PARTICIPANTS,
          booked: parseInt(row[6]) || 0,
          status: row[7]
        };
        break;
      }
    }
    
    if (!slotData) return jsonResponse({ ok: false, message: "Termin nicht gefunden" });
    if (slotData.status === "FULL") return jsonResponse({ ok: false, message: "Termin ausgebucht" });
    
    const free = slotData.capacity - slotData.booked;
    if (participantCount > free) {
      return jsonResponse({ ok: false, message: "Nur noch " + free + " Plätze verfügbar" });
    }
    
    const bookingId = generateBookingId();
    const cancelToken = generateCancelToken();
    const timestamp = new Date().toISOString();
    
    const bookingsSheet = getSheet(SHEET_BOOKINGS);
    bookingsSheet.appendRow([
      bookingId,
      timestamp,
      payload.slot_id,
      payload.workshop_id,
      payload.contact_email,
      participantCount,
      "CONFIRMED",
      cancelToken,
      ""
    ]);
    
    const participantsSheet = getSheet(SHEET_PARTICIPANTS);
    payload.participants.forEach((p, idx) => {
      participantsSheet.appendRow([
        bookingId,
        idx + 1,
        p.first_name || "",
        p.last_name || "",
        p.email || ""
      ]);
    });
    
    const newBooked = slotData.booked + participantCount;
    slotsSheet.getRange(slotRowIndex, 7).setValue(newBooked);
    if (newBooked >= slotData.capacity) {
      slotsSheet.getRange(slotRowIndex, 8).setValue("FULL");
    }
    
    let emailSent = false;
    try {
      sendBookingConfirmationEmail(bookingId, payload, slotData, cancelToken);
      sendAdminNotificationEmail(bookingId, payload, slotData);
      emailSent = true;
    } catch (emailError) {
      console.warn("E-Mail Fehler:", emailError.message);
    }
    
    return jsonResponse({
      ok: true,
      success: true,
      booking_id: bookingId,
      message: "Buchung erfolgreich",
      email_sent: emailSent
    });
    
  } catch (error) {
    console.error("Buchungsfehler:", error);
    return jsonResponse({ ok: false, message: "Fehler: " + error.message });
  } finally {
    lock.releaseLock();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// STORNO
// ══════════════════════════════════════════════════════════════════════════════

function handleCancel(token) {
  if (!token) return jsonResponse({ ok: false, message: "Kein Token" });
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    const bookingsSheet = getSheet(SHEET_BOOKINGS);
    const bookingsData = bookingsSheet.getDataRange().getValues();
    
    let bookingRowIndex = -1;
    let bookingData = null;
    
    for (let i = 1; i < bookingsData.length; i++) {
      if (bookingsData[i][7] === token) {
        bookingRowIndex = i + 1;
        bookingData = {
          booking_id: bookingsData[i][0],
          slot_id: bookingsData[i][2],
          workshop_id: bookingsData[i][3],
          contact_email: bookingsData[i][4],
          participants_count: bookingsData[i][5],
          status: bookingsData[i][6]
        };
        break;
      }
    }
    
    if (!bookingData) return jsonResponse({ ok: false, message: "Buchung nicht gefunden" });
    
    if (bookingData.status === "CANCELLED") {
      return jsonResponse({ ok: true, already_cancelled: true, booking_id: bookingData.booking_id, message: "Bereits storniert" });
    }
    
    const cancelledAt = new Date().toISOString();
    bookingsSheet.getRange(bookingRowIndex, 7).setValue("CANCELLED");
    bookingsSheet.getRange(bookingRowIndex, 9).setValue(cancelledAt);
    
    const slotsSheet = getSheet(SHEET_SLOTS);
    const slotsData = slotsSheet.getDataRange().getValues();
    
    for (let i = 1; i < slotsData.length; i++) {
      const row = slotsData[i];
      if (String(row[0]) === String(bookingData.slot_id) && String(row[1]) === String(bookingData.workshop_id)) {
        const currentBooked = parseInt(row[6]) || 0;
        const newBooked = Math.max(0, currentBooked - bookingData.participants_count);
        slotsSheet.getRange(i + 1, 7).setValue(newBooked);
        if (row[7] === "FULL" && newBooked < (row[5] || MAX_PARTICIPANTS)) {
          slotsSheet.getRange(i + 1, 8).setValue("OPEN");
        }
        break;
      }
    }
    
    try {
      sendCancellationEmail(bookingData);
      sendAdminCancellationEmail(bookingData);
    } catch (e) { console.warn("E-Mail bei Storno:", e.message); }
    
    return jsonResponse({ ok: true, booking_id: bookingData.booking_id, message: "Buchung storniert" });
    
  } catch (error) {
    return jsonResponse({ ok: false, message: "Fehler" });
  } finally {
    lock.releaseLock();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN
// ══════════════════════════════════════════════════════════════════════════════

function handleAdminBookings(adminKey) {
  if (!adminKey || adminKey !== getSetting("ADMIN_KEY")) {
    return jsonResponse({ ok: false, message: "Ungültiger Admin-Schlüssel" });
  }
  
  const bookingsSheet = getSheet(SHEET_BOOKINGS);
  const participantsSheet = getSheet(SHEET_PARTICIPANTS);
  const workshopsSheet = getSheet(SHEET_WORKSHOPS);
  
  const bookingsData = bookingsSheet.getDataRange().getValues();
  const participantsData = participantsSheet.getDataRange().getValues();
  
  const participantsByBooking = {};
  for (let i = 1; i < participantsData.length; i++) {
    const bid = participantsData[i][0];
    if (!participantsByBooking[bid]) participantsByBooking[bid] = [];
    participantsByBooking[bid].push({
      idx: participantsData[i][1],
      first_name: participantsData[i][2],
      last_name: participantsData[i][3],
      email: participantsData[i][4] || ""
    });
  }
  
  const workshopTitles = {};
  if (workshopsSheet) {
    const wData = workshopsSheet.getDataRange().getValues();
    for (let i = 1; i < wData.length; i++) {
      workshopTitles[wData[i][0]] = wData[i][1];
    }
  }
  
  const bookings = [];
  for (let i = 1; i < bookingsData.length; i++) {
    const row = bookingsData[i];
    bookings.push({
      booking_id: row[0],
      timestamp: row[1],
      slot_id: row[2],
      workshop_id: row[3],
      workshop_title: workshopTitles[row[3]] || row[3],
      contact_email: row[4],
      participants_count: row[5],
      status: row[6],
      cancelled_at: row[8],
      participants: participantsByBooking[row[0]] || []
    });
  }
  
  return jsonResponse({ ok: true, bookings });
}

function handleAdminExportCsv(adminKey) {
  if (!adminKey || adminKey !== getSetting("ADMIN_KEY")) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, csv: "" })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const bookingsSheet = getSheet(SHEET_BOOKINGS);
  const participantsSheet = getSheet(SHEET_PARTICIPANTS);
  const workshopsSheet = getSheet(SHEET_WORKSHOPS);
  
  const bookingsData = bookingsSheet.getDataRange().getValues();
  const participantsData = participantsSheet.getDataRange().getValues();
  
  const workshopTitles = {};
  if (workshopsSheet) {
    const wData = workshopsSheet.getDataRange().getValues();
    for (let i = 1; i < wData.length; i++) workshopTitles[wData[i][0]] = wData[i][1];
  }
  
  const participantsByBooking = {};
  for (let i = 1; i < participantsData.length; i++) {
    const bid = participantsData[i][0];
    if (!participantsByBooking[bid]) participantsByBooking[bid] = [];
    participantsByBooking[bid].push(participantsData[i]);
  }
  
  let csv = "Buchungs-ID;Buchungsdatum;Slot;Workshop;E-Mail;Anzahl;Status;TN-Nr;Vorname;Nachname;E-Mail\n";
  
  for (let i = 1; i < bookingsData.length; i++) {
    const b = bookingsData[i];
    const participants = participantsByBooking[b[0]] || [];
    const workshopTitle = workshopTitles[b[3]] || b[3];
    
    if (participants.length > 0) {
      participants.forEach((p, idx) => {
        csv += [b[0], b[1], b[2], workshopTitle, b[4], b[5], b[6], p[1], p[2], p[3], p[4] || ""].join(";") + "\n";
      });
    } else {
      csv += [b[0], b[1], b[2], workshopTitle, b[4], b[5], b[6], "", "", "", ""].join(";") + "\n";
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: true, csv })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Admin: Alle Slots + Workshops für Terminverwaltung
 */
function handleAdminSlots(adminKey) {
  if (!adminKey || adminKey !== getSetting("ADMIN_KEY")) {
    return jsonResponse({ ok: false, message: "Ungültiger Admin-Schlüssel" });
  }
  
  const workshops = [];
  const workshopsSheet = getSheet(SHEET_WORKSHOPS);
  if (workshopsSheet) {
    const wData = workshopsSheet.getDataRange().getValues();
    for (let i = 1; i < wData.length; i++) {
      if (wData[i][7] !== false && wData[i][7] !== "FALSE") {
        workshops.push({ workshop_id: wData[i][0], title: wData[i][1] });
      }
    }
  }
  
  const slots = [];
  const slotsSheet = getSheet(SHEET_SLOTS);
  const workshopTitles = {};
  workshops.forEach(w => { workshopTitles[w.workshop_id] = w.title; });
  
  if (slotsSheet) {
    const sData = slotsSheet.getDataRange().getValues();
    for (let i = 1; i < sData.length; i++) {
      const row = sData[i];
      const dateId = extractSlotDateId(row[2]);
      if (!dateId) continue;
      slots.push({
        slot_id: row[0],
        workshop_id: row[1],
        workshop_title: workshopTitles[row[1]] || row[1],
        date: dateId,
        start: row[3] || "10:00",
        end: row[4] || "12:00",
        capacity: parseInt(row[5]) || MAX_PARTICIPANTS,
        booked: parseInt(row[6]) || 0,
        status: row[7] || "OPEN"
      });
    }
  }
  
  return jsonResponse({ ok: true, slots, workshops });
}

/**
 * Admin: Neuen Termin anlegen
 */
function handleAdminAddSlot(params) {
  if (!params.admin_key || params.admin_key !== getSetting("ADMIN_KEY")) {
    return jsonResponse({ ok: false, message: "Ungültiger Admin-Schlüssel" });
  }
  
  const workshopId = (params.workshop_id || "").toString().trim();
  const date = (params.date || "").toString().trim();
  const start = (params.start || "10:00").toString().trim();
  const end = (params.end || "12:00").toString().trim();
  
  if (!workshopId || !date) {
    return jsonResponse({ ok: false, message: "Workshop und Datum erforderlich" });
  }
  
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonResponse({ ok: false, message: "Datum im Format YYYY-MM-DD eingeben" });
  }
  
  const slotsSheet = getSheet(SHEET_SLOTS);
  const sData = slotsSheet.getDataRange().getValues();
  let maxNr = 0;
  for (let i = 1; i < sData.length; i++) {
    const row = sData[i];
    if (String(row[1]) === workshopId && String(extractSlotDateId(row[2])) === date) {
      const m = String(row[0]).match(/_(\d+)$/);
      if (m) maxNr = Math.max(maxNr, parseInt(m[1]));
    }
  }
  
  const slotId = workshopId + "_" + date.replace(/-/g, "") + "_" + (maxNr + 1);
  
  slotsSheet.appendRow([slotId, workshopId, date, start, end, MAX_PARTICIPANTS, 0, "OPEN"]);
  
  return jsonResponse({ ok: true, message: "Termin angelegt", slot_id: slotId });
}

// ══════════════════════════════════════════════════════════════════════════════
// E-MAIL
// ══════════════════════════════════════════════════════════════════════════════

function sendBookingConfirmationEmail(bookingId, payload, slotData, cancelToken) {
  const baseUrl = getSetting("PUBLIC_BASE_URL") || "https://YOUR-GITHUB-USERNAME.github.io/workshop";
  const fromName = getSetting("MAIL_FROM_NAME") || "gemma golfn";
  const cancelUrl = baseUrl + "/cancel.html?token=" + cancelToken;
  
  const participantsList = payload.participants.map((p, i) => (i + 1) + ". " + (p.first_name || "") + " " + (p.last_name || "") + " (" + (p.email || "") + ")").join("\n");
  
  const subject = "Buchungsbestätigung – Workshop am " + formatDateForEmail(slotData.date);
  const body = `
Hallo,

vielen Dank für Ihre Workshop-Buchung bei Gemma Golfn!

═══════════════════════════════════════
BUCHUNGSDETAILS
═══════════════════════════════════════

Buchungs-ID: ${bookingId}
Termin: ${formatDateForEmail(slotData.date)}
Uhrzeit: ${slotData.start}–${slotData.end} Uhr
Teilnehmer: ${payload.participants.length}

${participantsList}

═══════════════════════════════════════
STORNIERUNG
═══════════════════════════════════════

Falls Sie die Buchung stornieren möchten:
${cancelUrl}

═══════════════════════════════════════

Bei Fragen: office@gemma-golfn.at | +43 7225 7389 10

Ihr Team von Gemma Golfn
  `.trim();
  
  GmailApp.sendEmail(payload.contact_email, subject, body, { name: fromName });
}

function sendAdminNotificationEmail(bookingId, payload, slotData) {
  const adminEmail = getSetting("ADMIN_EMAIL") || "info@metzenhof.at";
  const baseUrl = getSetting("PUBLIC_BASE_URL") || "";
  const cancelToken = ""; // Wird aus Bookings gelesen wenn nötig
  
  const participantsList = payload.participants.map((p, i) => (i + 1) + ". " + (p.first_name || "") + " " + (p.last_name || "") + " – " + (p.email || "")).join("\n");
  
  const subject = "[Neue Buchung] " + bookingId + " – " + formatDateForEmail(slotData.date);
  const body = `
Neue Workshop-Buchung!

Buchungs-ID: ${bookingId}
Workshop: ${payload.workshop_id}
Termin: ${formatDateForEmail(slotData.date)}, ${slotData.start}–${slotData.end} Uhr
E-Mail: ${payload.contact_email}
Teilnehmer: ${payload.participants.length}

${participantsList}
  `.trim();
  
  GmailApp.sendEmail(adminEmail, subject, body);
}

function sendCancellationEmail(bookingData) {
  const fromName = getSetting("MAIL_FROM_NAME") || "gemma golfn";
  const subject = "Stornierungsbestätigung – Buchung " + bookingData.booking_id;
  const body = `
Hallo,

Ihre Buchung wurde erfolgreich storniert.

Buchungs-ID: ${bookingData.booking_id}

Bei Fragen: office@gemma-golfn.at | +43 7225 7389 10

Ihr Team von Gemma Golfn
  `.trim();
  GmailApp.sendEmail(bookingData.contact_email, subject, body, { name: fromName });
}

function sendAdminCancellationEmail(bookingData) {
  const adminEmail = getSetting("ADMIN_EMAIL") || "info@metzenhof.at";
  const subject = "[Stornierung] " + bookingData.booking_id;
  const body = "Buchung storniert: " + bookingData.booking_id + " – " + bookingData.contact_email;
  GmailApp.sendEmail(adminEmail, subject, body);
}

// ══════════════════════════════════════════════════════════════════════════════
// INIT & SEEDER
// ══════════════════════════════════════════════════════════════════════════════

function initSheets() {
  const ss = getSpreadsheet();
  
  let ws = ss.getSheetByName(SHEET_WORKSHOPS);
  if (!ws) { ws = ss.insertSheet(SHEET_WORKSHOPS); }
  if (ws.getLastRow() === 0) {
    ws.appendRow(["workshop_id", "title", "description", "duration_text", "price_eur", "min_participants", "max_participants", "is_active"]);
  }
  
  let sl = ss.getSheetByName(SHEET_SLOTS);
  if (!sl) { sl = ss.insertSheet(SHEET_SLOTS); }
  if (sl.getLastRow() === 0) {
    sl.appendRow(["slot_id", "workshop_id", "date", "start", "end", "capacity", "booked", "status"]);
  }
  
  let bo = ss.getSheetByName(SHEET_BOOKINGS);
  if (!bo) { bo = ss.insertSheet(SHEET_BOOKINGS); }
  if (bo.getLastRow() === 0) {
    bo.appendRow(["booking_id", "timestamp", "slot_id", "workshop_id", "contact_email", "participants_count", "status", "cancel_token", "cancelled_at"]);
  }
  
  let pa = ss.getSheetByName(SHEET_PARTICIPANTS);
  if (!pa) { pa = ss.insertSheet(SHEET_PARTICIPANTS); }
  if (pa.getLastRow() === 0) {
    pa.appendRow(["booking_id", "idx", "first_name", "last_name", "email"]);
  }
  
  let se = ss.getSheetByName(SHEET_SETTINGS);
  if (!se) { se = ss.insertSheet(SHEET_SETTINGS); }
  if (se.getLastRow() === 0) {
    se.appendRow(["key", "value"]);
    se.appendRow(["ADMIN_EMAIL", "info@metzenhof.at"]);
    se.appendRow(["MAIL_FROM_NAME", "gemma golfn"]);
    se.appendRow(["ADMIN_KEY", "CHANGE_THIS_SECRET_KEY"]);
    se.appendRow(["PUBLIC_BASE_URL", "https://YOUR-GITHUB-USERNAME.github.io/workshop"]);
  }
  
  console.log("Sheets initialisiert.");
}

/**
 * Workshop-Datensatz aus gemma-golfn.at einfügen
 */
function seedWorkshops() {
  const sheet = getSheet(SHEET_WORKSHOPS);
  if (sheet.getLastRow() > 1) {
    console.log("Workshops bereits befüllt. Überspringe.");
    return;
  }
  
  const workshops = [
    ["langes-spiel", "Langes Spiel (inkl. Toptracer)", "Langes Spiel & Schwungtechnik – mehr Power, mehr Präzision. Bei diesem Workshop konzentrieren wir uns auf das Verbessern deines Schwungs. Dein Eisenspiel sowie die Schläge mit Hybrids, Fairwayhölzern und dem Driver profitieren direkt von den erarbeiteten Verbesserungen! Mit Videoanalyse und individuellem Trainingsplan.", "2 Stunden", 50, 2, 4, true],
    ["pitchen-bunker", "Pitchen/Bunker", "Pitchen & Bunkerschläge rund ums Grün. Wie bringe ich den Ball schnell zum Liegen – und wie dosiere ich meinen Schlag richtig? In diesem Workshop zeigen dir unsere Pros, wie du rund ums Grün die volle Kontrolle bekommst.", "2 Stunden", 50, 2, 4, true],
    ["putten-chippen", "Putten/Chippen", "Putten & Chippen – das Feingefühl macht den Unterschied. In diesem Workshop lernst du von unseren Pros, wie du das kurze Spiel meisterst – mit mehr Gefühl, besserer Technik und konstanter Kontrolle auf dem Grün.", "2 Stunden", 50, 2, 4, true],
    ["spielen-am-platz", "Spielen am Platz", "9 Loch mit dem Pro – Golftraining direkt dort, wo's zählt! Gemeinsam mit unseren Pros spielst du 9 Loch und bekommst wertvolle Tipps zu Strategie, Schlägerwahl, Technik und mentalem Spiel.", "ca. 2 Stunden", 99, 1, 4, true],
    ["regelkunde", "Regelkunde", "Dein smarter Regelabend – zwei Stunden voller Aha-Momente! Unsere Pros erklären dir praxisnah die wichtigsten Golfregeln – einfach, verständlich und mit vielen Beispielen direkt vom Platz.", "2 Stunden", 29, 2, 4, true]
  ];
  
  workshops.forEach(w => sheet.appendRow(w));
  console.log(workshops.length + " Workshops angelegt.");
}

/**
 * März-Termine aus dem Platzreife-Flyer (Platzreifekurse 2026 inkl. Jahresmitgliedschaft Golfpark Metzenhof.pdf)
 * Flyer enthält u.a.: 07.03.2026, 14.03.2026, 21.03.2026, 28.03.2026
 * Erstellt Slots für jede Workshop-Kategorie an diesen Terminen.
 */
function seedSlotsFromFlyer_March() {
  const sheet = getSheet(SHEET_SLOTS);
  const workshopsSheet = getSheet(SHEET_WORKSHOPS);
  
  if (!workshopsSheet || workshopsSheet.getLastRow() < 2) {
    console.log("Bitte zuerst seedWorkshops() ausführen.");
    return;
  }
  
  const workshopData = workshopsSheet.getDataRange().getValues();
  const workshopIds = [];
  for (let i = 1; i < workshopData.length; i++) {
    const row = workshopData[i];
    const isActive = row[7];
    if (isActive !== false && isActive !== "FALSE" && isActive !== "") {
      workshopIds.push(row[0]);
    }
  }
  
  const marchDates = ["2026-03-07", "2026-03-14", "2026-03-21", "2026-03-28"];
  const timeSlots = [
    { start: "09:00", end: "11:00" },
    { start: "11:30", end: "13:30" },
    { start: "14:00", end: "16:00" }
  ];
  
  let added = 0;
  for (let wi = 0; wi < workshopIds.length; wi++) {
    const workshopId = workshopIds[wi];
    for (let di = 0; di < marchDates.length; di++) {
      const dateStr = marchDates[di];
      for (let ti = 0; ti < timeSlots.length; ti++) {
        const ts = timeSlots[ti];
        const slotId = workshopId + "_" + dateStr.replace(/-/g, "") + "_" + (ti + 1);
        sheet.appendRow([slotId, workshopId, dateStr, ts.start, ts.end, MAX_PARTICIPANTS, 0, "OPEN"]);
        added++;
      }
    }
  }
  
  console.log(added + " Slots für März 2026 angelegt (aus Flyer-Terminen).");
}

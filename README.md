# 🏌️ Platzreife Online-Buchungssystem (v2.0)

**Golfclub Metzenhof – Platzreife-Kurs Buchungsplattform**

Ein vollständiges Online-Buchungssystem für Platzreife-Kurse mit statischem Frontend (HTML/CSS/JS) und Google Apps Script Backend.

---

## 📋 Inhaltsverzeichnis

1. [Projektübersicht](#-projektübersicht)
2. [Systemanforderungen](#-systemanforderungen)
3. [Dateistruktur](#-dateistruktur)
4. [Schritt-für-Schritt Anleitung](#-schritt-für-schritt-anleitung)
   - [Teil 1: Google Sheets einrichten](#teil-1-google-sheets-einrichten)
   - [Teil 2: Google Apps Script erstellen](#teil-2-google-apps-script-erstellen)
   - [Teil 3: Backend konfigurieren](#teil-3-backend-konfigurieren)
   - [Teil 4: Frontend verbinden](#teil-4-frontend-verbinden)
   - [Teil 5: GitHub Pages aktivieren](#teil-5-github-pages-aktivieren)
5. [Funktionen](#-funktionen)
6. [API-Dokumentation](#-api-dokumentation)
7. [Fehlerbehebung](#-fehlerbehebung)
8. [Anpassungen](#-anpassungen)

---

## 🎯 Projektübersicht

### Was dieses System kann:
- ✅ Buchungsformular für Platzreife-Kurse
- ✅ Automatische Slot-Verwaltung (max. 8 Teilnehmer pro Termin)
- ✅ E-Mail-Bestätigungen an Kunden
- ✅ E-Mail-Benachrichtigungen an Admins
- ✅ Stornierungsfunktion mit eindeutigem Link
- ✅ Admin-Bereich mit Buchungsübersicht
- ✅ CSV-Export aller Buchungen
- ✅ Vollständig kostenlose Infrastruktur

### Technologie-Stack:
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend:** Google Apps Script (kostenlos)
- **Datenbank:** Google Sheets (kostenlos)
- **Hosting:** GitHub Pages (kostenlos)
- **E-Mail:** GmailApp (kostenlos)

---

## 💻 Systemanforderungen

### Du brauchst:
- Einen **Google Account** (für Sheets + Apps Script)
- Einen **GitHub Account** (für Pages Hosting)
- Einen **Texteditor** (z.B. VS Code, Notepad++)
- Einen **Webbrowser** (Chrome empfohlen)

### Keine Programmierkenntnisse nötig!
Diese Anleitung führt dich Schritt für Schritt durch den gesamten Prozess.

---

## 📁 Dateistruktur

```
platzreife/
├── index.html          # Hauptseite mit Buchungsformular
├── styles.css          # Komplettes Styling (Metzenhof-Design)
├── app.js              # Frontend-Logik (Formulare, API-Calls)
├── admin.html          # Admin-Bereich
├── admin.js            # Admin-Logik (Buchungsliste, CSV)
├── cancel.html         # Stornierungsseite
├── agb.html            # Allgemeine Geschäftsbedingungen
├── privacy.html        # Datenschutzerklärung
├── backend.gs          # Google Apps Script (Backend-Code)
├── metzenhof_logo*.svg # Logo-Dateien
└── README.md           # Diese Datei
```

---

## 🚀 Schritt-für-Schritt Anleitung

### Teil 1: Google Sheets einrichten

#### Schritt 1.1: Neues Google Sheet erstellen

1. Öffne [Google Sheets](https://sheets.google.com)
2. Klicke auf **+ Blank** (Leere Tabelle)
3. Benenne die Tabelle: **"Platzreife Buchungen"** (oben links auf "Untitled spreadsheet" klicken)

#### Schritt 1.2: Arbeitsblätter (Tabs) erstellen

Du brauchst 4 Tabs. Klicke unten auf das **+** Symbol, um neue Tabs hinzuzufügen:

1. **Slots** (bereits vorhanden, nur umbenennen)
2. **Bookings** (neu erstellen)
3. **Participants** (neu erstellen)
4. **Settings** (neu erstellen)

> 💡 **Tipp:** Klicke auf den Tab-Namen, um ihn umzubenennen.

#### Schritt 1.3: Tab "Slots" einrichten

Trage in die **erste Zeile** folgende Spaltenüberschriften ein:

| A | B | C | D |
|---|---|---|---|
| slot_id | date | start | end |

#### Schritt 1.4: Tab "Bookings" einrichten

Trage in die **erste Zeile** folgende Spaltenüberschriften ein:

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| booking_id | timestamp | slot_id | contact_email | contact_phone | participants_count | status | cancel_token | cancelled_at |

#### Schritt 1.5: Tab "Participants" einrichten

Trage in die **erste Zeile** folgende Spaltenüberschriften ein:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| booking_id | participant_idx | first_name | last_name | street | house_no | zip | city |

#### Schritt 1.6: Tab "Settings" einrichten

Trage folgende Daten ein:

| A | B |
|---|---|
| key | value |
| ADMIN_EMAIL | info@metzenhof.at |
| MAIL_FROM_NAME | Golfclub Metzenhof |
| ADMIN_KEY | DeinGeheimesPasswort123 |
| PUBLIC_BASE_URL | https://DEIN-USERNAME.github.io/platzreife |

> ⚠️ **Wichtig:** 
> - Ersetze `info@metzenhof.at` mit deiner echten E-Mail
> - Ersetze `DeinGeheimesPasswort123` mit einem sicheren Passwort
> - Die PUBLIC_BASE_URL wird später noch angepasst!

#### Schritt 1.7: Sheet-ID notieren

Die Sheet-ID findest du in der URL deines Sheets:
```
https://docs.google.com/spreadsheets/d/DIESE-LANGE-ID-HIER-KOPIEREN/edit
```

📝 **Notiere dir diese ID!** Du brauchst sie im nächsten Schritt.

---

### Teil 2: Google Apps Script erstellen

#### Schritt 2.1: Apps Script öffnen

1. In deinem Google Sheet, klicke auf **Erweiterungen** (oben im Menü)
2. Wähle **Apps Script**
3. Ein neuer Tab öffnet sich mit dem Script-Editor

#### Schritt 2.2: Backend-Code einfügen

1. Lösche den vorhandenen Code im Editor (alles auswählen mit `Strg+A`, dann löschen)
2. Öffne die Datei `backend.gs` aus diesem Repository
3. Kopiere den **gesamten Inhalt**
4. Füge ihn im Script-Editor ein (`Strg+V`)

#### Schritt 2.3: Sheet-ID eintragen

Finde diese Zeile ganz oben im Code:
```javascript
const SPREADSHEET_ID = "DEINE_SHEET_ID_HIER";
```

Ersetze `DEINE_SHEET_ID_HIER` mit deiner notierten Sheet-ID aus Schritt 1.7.

**Beispiel:**
```javascript
const SPREADSHEET_ID = "1a2b3c4d5e6f7g8h9i0j_abcdefghijklmno";
```

#### Schritt 2.4: Projekt speichern

1. Klicke auf das **Disketten-Symbol** (💾) oben oder drücke `Strg+S`
2. Benenne das Projekt: **"Platzreife Backend"**

#### Schritt 2.5: Initialisierung ausführen

1. Wähle im Dropdown neben "Ausführen" die Funktion **initSheets**
2. Klicke auf **▶ Ausführen**
3. Es erscheint ein Popup: Klicke auf **Berechtigungen überprüfen**
4. Wähle deinen Google Account
5. Klicke auf **Erweitert** → **Zu Platzreife Backend (unsicher)**
6. Klicke auf **Zulassen**

> ℹ️ Die "unsicher"-Warnung erscheint, weil das Script nicht von Google verifiziert ist. Das ist normal für selbst erstellte Scripts.

#### Schritt 2.6: Termine (Slots) hinzufügen

1. Wähle die Funktion **seedSlots2026**
2. Klicke auf **▶ Ausführen**
3. Prüfe deinen "Slots"-Tab – dort sollten jetzt alle 2026er Termine stehen!

---

### Teil 3: Backend konfigurieren

#### Schritt 3.1: Web-App veröffentlichen

1. Klicke im Script-Editor auf **Bereitstellen** → **Neue Bereitstellung**
2. Klicke auf das **Zahnrad-Symbol** ⚙️ neben "Typ auswählen"
3. Wähle **Web-App**
4. Fülle aus:
   - **Beschreibung:** "Platzreife API v1"
   - **Ausführen als:** "Ich"
   - **Zugriff:** "Jeder"
5. Klicke auf **Bereitstellen**
6. **Kopiere die Web-App-URL!** 

Die URL sieht so aus:
```
https://script.google.com/macros/s/AKfycby...LANGE-ID.../exec
```

📝 **Notiere diese URL!** Das ist deine API-URL.

#### Schritt 3.2: E-Mail-Versand testen

1. Führe die Funktion **testEmail** aus (falls vorhanden)
2. Prüfe dein E-Mail-Postfach

---

### Teil 4: Frontend verbinden

#### Schritt 4.1: API-URL eintragen

Öffne die Datei `app.js` und finde diese Zeile:

```javascript
const API_BASE = "DEINE_APPS_SCRIPT_WEB_APP_URL";
```

Ersetze den Platzhalter mit deiner Web-App-URL aus Schritt 3.1.

**Beispiel:**
```javascript
const API_BASE = "https://script.google.com/macros/s/AKfycby.../exec";
```

#### Schritt 4.2: Admin-API-URL eintragen

Öffne die Datei `admin.js` und trage dieselbe URL ein:

```javascript
const API_BASE = "https://script.google.com/macros/s/AKfycby.../exec";
```

#### Schritt 4.3: Cancel-Seite anpassen

Öffne die Datei `cancel.html` und finde das Script am Ende. Aktualisiere auch hier die API-URL.

---

### Teil 5: GitHub Pages aktivieren

#### Schritt 5.1: Repository erstellen (falls noch nicht geschehen)

1. Gehe zu [GitHub](https://github.com)
2. Klicke auf **+** → **New repository**
3. Name: **platzreife**
4. Wähle **Public**
5. Klicke auf **Create repository**

#### Schritt 5.2: Dateien hochladen

1. Klicke auf **uploading an existing file**
2. Ziehe alle Dateien aus dem platzreife-Ordner hierher:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `admin.html`
   - `admin.js`
   - `cancel.html`
   - `agb.html`
   - `privacy.html`
   - Logo-Dateien (`.svg`)
3. Schreibe eine Commit-Nachricht: "Initial upload"
4. Klicke auf **Commit changes**

#### Schritt 5.3: GitHub Pages aktivieren

1. Gehe zu deinem Repository
2. Klicke auf **Settings** (⚙️ Tab)
3. Scrolle zu **Pages** (linke Sidebar)
4. Unter "Source", wähle:
   - **Branch:** main
   - **Folder:** / (root)
5. Klicke auf **Save**

#### Schritt 5.4: Warten & URL notieren

Nach 1-5 Minuten erscheint oben eine grüne Box mit deiner URL:
```
Your site is live at https://DEIN-USERNAME.github.io/platzreife/
```

📝 **Das ist deine öffentliche Buchungsseite!**

#### Schritt 5.5: PUBLIC_BASE_URL aktualisieren

Gehe zurück zu deinem Google Sheet → Tab "Settings" und aktualisiere:

| key | value |
|-----|-------|
| PUBLIC_BASE_URL | https://DEIN-USERNAME.github.io/platzreife |

(Ersetze DEIN-USERNAME mit deinem echten GitHub-Benutzernamen)

---

## ✨ Funktionen

### Für Kunden:
- 📅 Termine anzeigen und wählen
- 👥 Mehrere Teilnehmer (1-8) pro Buchung
- 📧 Automatische Bestätigungs-E-Mail
- ❌ Einfache Stornierung per Link

### Für Admins:
- 📊 Übersicht aller Buchungen
- 📥 CSV-Export für Excel
- 📧 Benachrichtigung bei neuen Buchungen
- 🔐 Passwortgeschützter Zugang

---

## 📡 API-Dokumentation

### Endpoints:

| Methode | URL | Beschreibung |
|---------|-----|--------------|
| GET | `?action=slots` | Verfügbare Termine abrufen |
| POST | `?action=book` | Neue Buchung erstellen |
| GET | `?action=cancel&token=...` | Buchung stornieren |
| GET | `?action=admin_bookings&admin_key=...` | Alle Buchungen (Admin) |
| GET | `?action=admin_export_csv&admin_key=...` | CSV-Export (Admin) |

### Buchungs-Payload (POST):
```json
{
  "slot_id": "2026-02-25",
  "contact_email": "kunde@email.at",
  "contact_phone": "+43 664 1234567",
  "participants": [
    {
      "first_name": "Max",
      "last_name": "Mustermann",
      "street": "Musterstraße",
      "house_no": "1",
      "zip": "4020",
      "city": "Linz"
    }
  ],
  "agb_accepted": true,
  "privacy_accepted": true
}
```

---

## 🔧 Fehlerbehebung

### "CORS-Fehler" im Browser
- Stelle sicher, dass die Web-App mit "Jeder" Zugriff veröffentlicht ist
- Nach Änderungen: Neue Bereitstellung erstellen!

### "Keine Termine verfügbar"
- Prüfe, ob `seedSlots2026` ausgeführt wurde
- Prüfe den "Slots"-Tab im Sheet

### "E-Mails kommen nicht an"
- Prüfe den Spam-Ordner
- Prüfe die ADMIN_EMAIL in Settings
- Stelle sicher, dass GmailApp-Berechtigungen erteilt wurden

### "Admin-Login funktioniert nicht"
- Prüfe den ADMIN_KEY in Settings
- Beachte Groß-/Kleinschreibung!

### Änderungen werden nicht übernommen
1. Erstelle eine **neue Bereitstellung** im Apps Script
2. Kopiere die **neue URL**
3. Aktualisiere die URL in `app.js` und `admin.js`
4. Committe die Änderungen auf GitHub
5. Warte 1-2 Minuten (GitHub Pages Cache)

---

## 🎨 Anpassungen

### Farben ändern
Öffne `styles.css` und ändere die CSS-Variablen:
```css
:root {
  --color-primary: #4a8c7b;      /* Hauptfarbe (Teal-Grün) */
  --color-primary-dark: #3d7569; /* Dunklere Variante */
  --color-text: #2c2c2c;         /* Textfarbe */
  /* ... weitere Farben ... */
}
```

### Termine anpassen
Öffne `app.js` und bearbeite das `TERMINE`-Array:
```javascript
const TERMINE = [
  "25.02.2026",
  "04.03.2026",
  // ... weitere Termine hinzufügen/entfernen ...
];
```

### Kurszeiten ändern
1. Bearbeite in `index.html` den Untertitel
2. Ändere in `backend.gs` die `seedSlots2026`-Funktion

### Logo austauschen
Ersetze die `.svg`-Dateien im Repository mit deinen eigenen Logos.

---

## 📞 Support

Bei Fragen oder Problemen:
- **E-Mail:** info@metzenhof.at
- **Telefon:** +43 7225 7389
- **Website:** [www.metzenhof.at](https://www.metzenhof.at)

---

## 📄 Lizenz

Dieses Projekt wurde für den Golfclub Metzenhof entwickelt.

© 2026 Golfclub Metzenhof – „mitanaund genießen"


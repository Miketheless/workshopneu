# Workshop-Buchungssystem – Gemma Golfn

Statisches Frontend (HTML/CSS/Vanilla JS) für GitHub Pages, Backend: Google Apps Script + Google Sheets.

---

## Schritt-für-Schritt-Anleitung

---

### Schritt 1: Google Sheet anlegen

1. Öffne deinen Browser und gehe zu **https://sheets.google.com**
2. Klicke auf **+ Leer** (oder „Blank“) um ein neues, leeres Tabellenblatt zu erstellen
3. Gib dem Sheet einen Namen (z.B. „Workshop Buchungen“) – oben links neben „Unbenannte Tabelle“
4. Öffne die Adresszeile des Browsers und kopiere die **SPREADSHEET_ID**:
   - Die URL sieht z.B. so aus: `https://docs.google.com/spreadsheets/d/1abc123XYZ.../edit`
   - Die ID ist der lange Teil zwischen `/d/` und `/edit`
   - Beispiel: Bei `.../d/1NkaviS-fPq_A04HntatthchUYgjTto04Adicd-LvmBg/edit`  
     ist die ID: `1NkaviS-fPq_A04HntatthchUYgjTto04Adicd-LvmBg`
5. Speichere die ID – du brauchst sie im nächsten Schritt

---

### Schritt 2: Apps Script Projekt erstellen

1. Öffne **https://script.google.com**
2. Klicke oben links auf **+ Neues Projekt**
3. Es öffnet sich der Script-Editor mit Beispielcode (`function myFunction() { … }`)
4. Lösche den gesamten Inhalt im Editor (Strg+A, dann Entf)
5. Öffne die Datei **backend.gs** aus diesem Projektordner
6. Kopiere den kompletten Inhalt und füge ihn in den Apps-Script-Editor ein
7. Suche die Zeile (ca. Zeile 15):
   ```javascript
   const SPREADSHEET_ID = "DEINE_SPREADSHEET_ID";
   ```
8. Ersetze `DEINE_SPREADSHEET_ID` durch die ID aus Schritt 1 – **Anführungszeichen beibehalten**
   - Beispiel: `const SPREADSHEET_ID = "1NkaviS-fPq_A04HntatthchUYgjTto04Adicd-LvmBg";`
9. Klicke oben auf **Projektname** und benenne das Projekt z.B. „Workshop Backend“
10. Speichere mit Strg+S (oder Datei → Speichern)

---

### Schritt 3: Sheets initialisieren und mit Daten füllen

1. Im Apps-Script-Editor siehst du oben ein Dropdown-Menü mit Funktionsnamen
2. Klicke auf das Dropdown und wähle die Funktion **initSheets**
3. Klicke auf den **Ausführen**-Button (▶ Dreieck)
4. Beim ersten Ausführen erscheint „Autorisierung erforderlich“:
   - Klicke auf **Berechtigungen prüfen**
   - Wähle deinen Google-Account
   - Klicke auf **Erweitert** (falls angezeigt)
   - Klicke auf „Zu Workshop (unsicher) wechseln“ bzw. „Zum Projekt wechseln“
   - Klicke auf **Zulassen**
5. Warte, bis unten „Ausführung abgeschlossen“ erscheint
6. Öffne dein Google Sheet – du solltest jetzt mehrere Tabs sehen: Workshops, Slots, Bookings, Participants, Settings

7. Wähle im Dropdown die Funktion **seedWorkshops** und klicke **Ausführen**
   - Im Tab „Workshops“ sollten jetzt 6 Workshop-Kategorien erscheinen (inkl. Driver)
8. Wähle die Funktion **seedSlotsFromFlyer_March2026** und klicke **Ausführen**
   - Alle bisherigen Slots werden gelöscht; die 5 Termine vom Flyer „Workshops März 2026“ werden angelegt

---

### Schritt 4: Settings anpassen

1. Öffne dein Google Sheet (Tabs unten)
2. Klicke auf den Tab **Settings**
3. In der Tabelle stehen Zeilen mit **key** und **value**. Trage folgende Werte ein bzw. ändere sie:

   | key | value |
   |-----|-------|
   | ADMIN_EMAIL | Deine E-Mail für Buchungsbenachrichtigungen (z.B. `info@metzenhof.at`) |
   | MAIL_FROM_NAME | Absendername für E-Mails (z.B. `gemma golfn`) |
   | ADMIN_KEY | Ein geheimer Schlüssel für den Admin-Login (z.B. `MeinGeheimerSchluessel2026`) – merk dir diesen! |
   | PUBLIC_BASE_URL | Noch leer lassen – tragen wir in Schritt 7 ein |
   | N8N_WEBHOOK_URL | (Optional) n8n-Webhook-URL für Automatisierungen – z.B. `https://n8n.srv1066806.hstgr.cloud/webhook/Workshop` |

4. Speichere das Sheet (Strg+S)

---

### Schritt 5: Web-App bereitstellen

1. Im Apps-Script-Editor klicke oben rechts auf **Bereitstellen**
2. Wähle **Neue Bereitstellung**
3. Neben „Art der Bereitstellung“ klicke auf das **Zahnrad-Symbol** und wähle **Web-App**
4. Fülle die Felder aus:
   - **Beschreibung**: z.B. `Workshop Backend v1` (optional)
   - **Ausführen als**: **Ich** (wichtig!)
   - **Zugriff**: **Jeder** (wichtig – sonst funktioniert das Frontend nicht)
5. Klicke auf **Bereitstellen**
6. Beim ersten Mal: Noch einmal **Autorisieren** bestätigen
7. Es erscheint ein Fenster mit der **Web-App-URL**
   - Sie sieht z.B. so aus: `https://script.google.com/macros/s/AKfycb.../exec`
   - Klicke auf **URL kopieren** oder markiere sie und kopiere sie (Strg+C)
8. Speichere diese URL – du brauchst sie im nächsten Schritt

---

### Schritt 6: SCRIPT_BASE in den Frontend-Dateien eintragen

1. Öffne das Projekt in deinem Editor (z.B. Cursor / VS Code)
2. Öffne die Datei **app.js**
   - Suche die Zeile mit `SCRIPT_BASE` (ca. Zeile 17)
   - Ersetze die Platzhalter-URL durch deine kopierte Web-App-URL
   - Beispiel: `const SCRIPT_BASE = "https://script.google.com/macros/s/AKfycb.../exec";`
3. Öffne die Datei **admin.js**
   - Suche die Zeile mit `SCRIPT_BASE` (ca. Zeile 8)
   - Ersetze sie durch dieselbe URL
4. Öffne die Datei **cancel.html**
   - Suche im `<script>`-Block die Zeile mit `SCRIPT_BASE`
   - Ersetze sie durch dieselbe URL
5. Speichere alle drei Dateien

---

### Schritt 7: GitHub Pages einrichten

1. Lade das Projekt auf GitHub hoch:
   - Falls noch nicht geschehen: Repo auf GitHub anlegen
   - Projektordner mit `git push` hochladen
2. Gehe auf die GitHub-Reposeite
3. Klicke auf **Settings** (Einstellungen)
4. In der linken Seitenleiste: **Pages** auswählen
5. Unter „Build and deployment“:
   - **Source**: „Deploy from a branch“ auswählen
   - **Branch**: `main` (oder `master`) auswählen
   - **Folder**: `/ (root)` auswählen
6. **Save** klicken
7. Warte 1–2 Minuten – die Seite wird erstellt
8. Die URL lautet: `https://<dein-github-username>.github.io/<repo-name>/`
   - Beispiel: `https://micha.github.io/workshop/`
9. Öffne das Google Sheet, Tab **Settings**
10. Trage bei **PUBLIC_BASE_URL** diese URL ein (ohne abschließenden Schrägstrich)
    - Beispiel: `https://micha.github.io/workshop`

---

### Schritt 8: Testen

1. **API testen**
   - Öffne im Browser: `DEINE_WEB_APP_URL?action=workshops`
   - Es sollte eine JSON-Antwort mit den Workshop-Daten erscheinen
   - Öffne: `DEINE_WEB_APP_URL?action=slots&workshop_id=langes-spiel`
   - Es sollte JSON mit den Slots für „Langes Spiel“ erscheinen

2. **Buchungsseite testen**
   - Öffne `https://dein-username.github.io/workshop/` (deine GitHub-Pages-URL)
   - Wähle einen Workshop (z.B. „Langes Spiel“)
   - Es sollten Termine erscheinen – wähle einen aus
   - Fülle das Buchungsformular mit Testdaten aus
   - Prüfe: Erhältst du eine Bestätigungs-E-Mail? Erhält die ADMIN_EMAIL eine Benachrichtigung?

3. **Admin testen**
   - Öffne `https://dein-username.github.io/workshop/admin.html`
   - Gib den **ADMIN_KEY** aus dem Settings-Tab ein
   - Klicke **Anmelden**
   - Prüfe: Siehst du die Buchungen? Im Tab **Termine** die Slots?

4. **Neuen Termin anlegen**
   - Im Admin unter **Termine**: Workshop wählen, Datum eingeben, **Termin hinzufügen** klicken
   - Gehe zurück zur Buchungsseite und prüfe, ob der neue Termin erscheint

---

## Termine im Admin-Bereich verwalten

1. Öffne **admin.html** und melde dich mit dem ADMIN_KEY an
2. Klicke auf den Tab **Termine**
3. **Neuen Termin anlegen**:
   - **Workshop** aus dem Dropdown wählen
   - **Datum** über den Datepicker oder manuell (YYYY-MM-DD) eingeben
   - **Start** und **Ende** anpassen (Standard: 10:00–12:00)
   - Auf **Termin hinzufügen** klicken
4. Der Termin erscheint in der Liste und ist sofort auf der Buchungsseite buchbar
5. Mit dem **Filter Workshop** kannst du die Liste auf einen bestimmten Workshop einschränken

---

## Termine direkt im Google Sheet anlegen

Alternativ kannst du im Tab **Slots** neue Zeilen einfügen:

| Spalte | Beispiel | Bedeutung |
|--------|----------|-----------|
| slot_id | langes-spiel_20260415_1 | Eindeutige ID: `workshop_id` + `YYYYMMDD` + `_1` |
| workshop_id | langes-spiel | Muss im Tab Workshops existieren |
| date | 2026-04-15 | Format: YYYY-MM-DD |
| start | 10:00 | Startzeit |
| end | 12:00 | Endzeit |
| capacity | 4 | Max. Teilnehmer pro Termin |
| booked | 0 | Bereits gebuchte Plätze (bei neuem Termin: 0) |
| status | OPEN | OPEN oder FULL (bei Vollbuchung) |

---

## Flyer-Seeder

Die Funktion `seedSlotsFromFlyer_March()` legt Termine für **März 2026** an (07., 14., 21., 28.03.) – für jede Workshop-Kategorie und jeden Tag mehrere Zeitslots. Einmal im Apps Script ausführen, danach weitere Termine im Admin oder im Sheet ergänzen.

---

## n8n-Webhook

Wenn du **N8N_WEBHOOK_URL** im Settings-Tab einträgst, ruft das Backend bei jeder **Buchung** und jeder **Stornierung** deinen n8n-Webhook auf (POST, JSON).

**Buchung** (`event: "booking"`):
- `booking_id`, `contact_email`, `participants` (Array mit first_name, last_name, email, phone), `voucher_code` (Gutscheinnummer), `slot_id`, `workshop_id`, `workshop_title`, `slot_date`, `slot_start`, `slot_end`, `slot_date_formatted` (z.B. "Donnerstag, 19.03.2026"), `timestamp`

**Stornierung** (`event: "cancellation"`):
- `booking_id`, `contact_email`, `voucher_code`, `slot_id`, `workshop_id`, `workshop_title`, `slot_date`, `slot_start`, `slot_end`, `slot_date_formatted`, `timestamp`

---

## Häufige Probleme

- **„Ungültiger Admin-Schlüssel“** – ADMIN_KEY im Settings-Tab prüfen, exakt so eingeben wie hinterlegt
- **Keine Termine sichtbar** – `seedSlotsFromFlyer_March()` ausgeführt? Im Tab Slots nachsehen
- **E-Mails kommen nicht an** – Gmail des Google-Accounts muss für Apps Script freigegeben sein; Spam-Ordner prüfen
- **Buchungsseite zeigt „Termine werden geladen…“** – SCRIPT_BASE korrekt? Web-App als „Jeder“ bereitgestellt?
- **CORS-Fehler in der Konsole** – Web-App muss mit Zugriff „Jeder“ bereitgestellt sein

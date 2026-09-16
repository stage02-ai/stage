**[Nome azienda]**
[Indirizzo azienda]
[CAP], [Città] ([Provincia])
[Telefono]

# Gestione Certificati Medici

7 settembre 2026

## PANORAMICA

Il progetto **Gestione Certificati Medici** nasce per aiutare una squadra sportiva a tenere sotto controllo, in modo semplice ed efficiente, i certificati medici dei propri giocatori. Permette di controllare automaticamente le scadenze e di avvisare per tempo quando un certificato sta per scadere. Per completare il progetto è stato realizzato anche un sito web con le informazioni principali sulla squadra.

## OBIETTIVI

1. Progettare un database solido, collegando le varie tabelle tramite un identificativo (id).
   - Evitare che le tabelle contengano dati ripetuti.
2. Realizzare un sito web per consultare in modo semplice e sempre aggiornato le informazioni della squadra.
3. Automatizzare il controllo delle scadenze dei certificati medici, avvisando quando un certificato sta per scadere.
   - Controllare a intervalli regolari lo stato di ogni certificato medico.
   - Inviare un'email di avviso quando un certificato risulta scaduto.
   - Decidere quale indirizzo email usare per inviare gli avvisi.
   - Permettere ai giocatori di caricare il proprio certificato medico, ma solo dopo aver ricevuto l'avviso di scadenza.
   - Permettere al responsabile di controllare i certificati caricati e di approvarli o scartarli.
4. Aggiungere altre funzioni utili, per rendere il sito più facile da usare.
5. Completare il progetto, passando a WordPress.

## SPECIFICHE

Il progetto è organizzato in due parti separate: una di **front end** (quello che vede e usa chi visita il sito, nella cartella `browser`) e una di **back end** (la logica e i dati gestiti dal server, nella cartella `server`).

### Architettura

Il frontend è una Single Page Application (SPA) con routing lato client basato su hash. Il backend espone un'API REST (Express) su cui il frontend effettua le chiamate, con risposte in formato JSON. Nel complesso, l'architettura è client-server a tre livelli: presentazione (`browser`), logica applicativa (`server`), dati (Supabase/PostgreSQL).

### Tecnologie utilizzate

**Back end**
- Node.js (richiesta almeno la versione 18, perché il codice usa la funzione `fetch` integrata, disponibile da quella versione in poi).
- Express, per gestire le richieste del sito — versione 4.22.2.
- Supabase (database basato su PostgreSQL), collegato tramite la libreria `@supabase/supabase-js` — versione 2.114.0.
- `dotenv`, per leggere le credenziali dal file `.env` senza scriverle nel codice — versione 16.6.1.
- Resend (resend.com), aggiunto in seguito per l'invio vero delle email (avvisi di scadenza, approvazioni, scarti): non è una libreria da installare, viene richiamato direttamente con `fetch` dal server.

**Front end**
- Un unico file `index.html`, scritto in HTML, CSS e JavaScript "puro" (senza framework come React, e senza bisogno di compilazione): stile e comportamento del sito sono scritti direttamente dentro questo file.
- Il font del sito ("Plus Jakarta Sans") viene caricato da Google Fonts.
- Nessuna libreria esterna da installare per questa parte.

### Struttura dei file

Il progetto è organizzato in due cartelle principali: `browser` e `server`.

La cartella `browser` contiene il file che il browser scarica quando qualcuno visita il sito:

- `index.html` — l'unico file dell'intero sito: la struttura della pagina, lo stile grafico e il comportamento sono scritti tutti qui dentro. (Inizialmente stile e comportamento erano in due file a parte, `style.css` e `main.js`: sono poi stati riuniti in `index.html`, e i due file vecchi non sono più usati dal sito.)

La cartella `server` contiene il codice eseguito sul server:

- `server.js` è il file principale: invia al browser i file della cartella `browser` e gestisce le rotte API.
- `src/supabaseClient.js` gestisce il collegamento al database, utilizzando le credenziali salvate in un file a parte (`.env`), per non scriverle direttamente nel codice.
- `sql/` — aggiunta in seguito: raccoglie gli script SQL con cui il database è cresciuto (nuove tabelle, nuove colonne), da eseguire a mano nell'SQL Editor di Supabase.

### Rotte API attive

**Squadre**

| Rotta | A cosa serve |
|---|---|
| `GET /api/squadre` | Restituisce l'elenco delle squadre |
| `POST /api/squadre` | Crea una nuova squadra |
| `PUT /api/squadre/:id` | Modifica il nome di una squadra |
| `DELETE /api/squadre/:id` | Elimina una squadra (rifiutata se ha ancora un responsabile assegnato); i suoi giocatori vengono archiviati automaticamente |
| `GET /api/squadre/:id/giocatori` | Restituisce la rosa di una squadra |

**Giocatori**

| Rotta | A cosa serve |
|---|---|
| `GET /api/giocatori` | Restituisce tutti i giocatori attivi, con squadra, ruolo e stato del certificato attuale |
| `GET /api/giocatori/archiviati` | Restituisce i giocatori archiviati (eliminati) |
| `POST /api/giocatori` | Crea un nuovo giocatore |
| `PUT /api/giocatori/:id` | Modifica un giocatore, oppure lo ripristina se archiviato (`ripristina: true`) |
| `DELETE /api/giocatori/:id` | Archivia un giocatore (non lo elimina davvero, per non perdere la sua storia di certificati) |

**Certificati medici**

| Rotta | A cosa serve |
|---|---|
| `GET /api/certificati` | Elenco per la pagina "Gestione": un giocatore per riga, con il certificato attuale e quello nuovo in attesa, ordinati per urgenza |
| `GET /api/certificati/archivio` | Elenco completo di tutti i certificati mai caricati, per la pagina "Archivio" |
| `POST /api/certificati` | Carica (o sostituisce) il certificato di un giocatore riconosciuto |
| `PATCH /api/certificati/:id` | Approva un certificato in attesa |
| `DELETE /api/certificati/:id` | Scarta un certificato (eliminato dal database e dalla foto nello spazio di archiviazione) |
| `GET /api/certificati/:id/foto` | Genera un link temporaneo (5 minuti) per vedere la foto di un certificato |

**Segnalazioni** (certificati caricati con un nome non riconosciuto)

| Rotta | A cosa serve |
|---|---|
| `POST /api/certificati/segnalazione` | Salva una segnalazione (nome scritto, foto, data) e avvisa l'Admin via email |
| `GET /api/segnalazioni` | Elenco di tutte le segnalazioni ricevute |
| `GET /api/segnalazioni/:id/foto` | Link temporaneo per vedere la foto di una segnalazione |
| `POST /api/segnalazioni/:id/collega` | Collega una segnalazione a un giocatore vero: crea per lui un certificato in attesa |
| `POST /api/segnalazioni/:id/scarta` | Scarta una segnalazione (resta comunque nello storico) |

**Notifiche e verifica**

| Rotta | A cosa serve |
|---|---|
| `GET /api/notifiche` | Storico delle email di avviso inviate ai giocatori |
| `GET /test-giocatori` | Rotta di prova: verifica il corretto collegamento al database |

### Struttura del database

Il database è organizzato in otto tabelle, collegate tra loro tramite id. Rispetto all'impostazione iniziale sono state aggiunte le tabelle **segnalazioni_certificati** e **impostazioni_sito**, e la tabella **persona** contiene ora anche la data di nascita (spostata qui da "giocatori"):

- **squadre**: contiene le categorie della società.
- **persona**: contiene nome, cognome, email e data di nascita, condivisi da giocatori e responsabili.
- **responsabili**: collegati alla propria persona e alla squadra allenata.
- **giocatori**: collegati alla propria persona, al proprio responsabile e alla propria squadra.
- **certificati_medici**: collegati al giocatore corrispondente.
- **segnalazioni_certificati** *(nuova)*: certificati caricati con un nome non riconosciuto tra i giocatori; l'Admin le collega a un giocatore vero o le scarta, mantenendo comunque lo storico di ogni segnalazione ricevuta.
- **notifiche_inviate**: collegate al certificato medico per cui è stata inviata la notifica.
- **impostazioni_sito** *(nuova)*: una riga sola con il nome del sito e i dati della pagina Contatti; predisposta ma non ancora collegata al sito.

| Tabella | Collegata a |
|---|---|
| squadre | — |
| persona | — |
| responsabili | persona, squadre |
| giocatori | persona, responsabili, squadre |
| certificati_medici | giocatori |
| segnalazioni_certificati | giocatori (solo se collegata) |
| notifiche_inviate | certificati_medici |
| impostazioni_sito | — |

## TAPPE INTERMEDIE

### Stato attuale

Il progetto è arrivato a un buon punto: la funzione principale richiesta dall'azienda, la gestione dei certificati medici, funziona già, anche se non è ancora del tutto completa. Intorno a questa funzione è stata realizzata anche la gestione base della società (squadre e giocatori), necessaria perché i certificati medici abbiano senso, oltre a un primo accesso al sito diviso per ruolo (Admin e Giocatore), anche se ancora senza una vera password.

Il sistema controlla già da solo, ogni giorno, le scadenze dei certificati e manda un'email a chi deve caricarne uno nuovo, senza bisogno che qualcuno se ne ricordi. Restano comunque delle cose da sistemare prima di dire il progetto finito: far arrivare le email anche a indirizzi veri (non solo di prova), riempire la parte Admin della pagina Impostazioni, e tenere il server sempre acceso perché i controlli automatici continuino a funzionare.

Per avviare il progetto in locale è necessario: installare le librerie necessarie (`express`, `@supabase/supabase-js`, `dotenv`) con il comando `npm install` nella cartella `server`; creare un file `.env` nella stessa cartella con l'indirizzo e la chiave di accesso al progetto Supabase; avviare il server con il comando `npm start`. Una volta avviato, il sito è raggiungibile all'indirizzo `http://localhost:3000`.

**Fase 1 (1 – 13 settembre)**

1. Realizzazione e organizzazione del database.
2. Realizzazione del server e collegamento con il database.
3. Realizzazione di una prima versione del sito web, non ancora definitiva, da aggiornare fino alla scadenza del progetto.
4. Realizzazione della funzione principale, ovvero la gestione dei certificati medici.

Conclusione della fase: ottenere una versione funzionante, anche se ancora di prova, del sito con la funzione dei certificati medici attiva.

**Fase 2 (14 – 21 settembre)**

1. Realizzazione della versione definitiva del sito.
2. Aggiunta di ulteriori funzioni per migliorare l'esperienza dell'utente.
   - Gestione dell'accesso e della registrazione, con un'area riservata diversa in base al profilo con cui si accede.
3. Completamento del progetto, passando dal server realizzato in Node.js a WordPress.

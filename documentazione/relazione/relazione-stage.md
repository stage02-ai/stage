**[Nome azienda]**
[Indirizzo azienda]
[CAP], [Città] ([Provincia])
[Telefono]

# Gestione Certificati Medici

18 settembre 2026

## PANORAMICA

Il progetto **Gestione Certificati Medici** nasce per aiutare una squadra sportiva a tenere sotto controllo, in modo semplice ed efficiente, i certificati medici dei propri giocatori, eliminando il rischio che una scadenza passi inosservata: il sistema controlla da solo le scadenze e avvisa per tempo chi deve caricare un nuovo certificato. Attorno a questa funzione principale è stato realizzato un sito web completo per la gestione della società (squadre, giocatori, accesso riservato per ruolo), pensato fin dall'inizio come prima base su cui l'azienda potrà far crescere altri strumenti in futuro, senza doverla ricostruire da zero. Il sito è oggi pubblicato online, raggiungibile da chiunque all'indirizzo https://stage-rho-lyart.vercel.app.

## OBIETTIVI

1. Progettare un database solido, collegando le varie tabelle tramite un identificativo (id).
   - Evitare che le tabelle contengano dati ripetuti.
2. Realizzare un sito web per consultare in modo semplice e sempre aggiornato le informazioni della squadra.
3. Automatizzare il controllo delle scadenze dei certificati medici, avvisando quando un certificato sta per scadere.
   - Controllare a intervalli regolari lo stato di ogni certificato medico.
   - Inviare un'email di avviso quando un certificato risulta scaduto.
   - Decidere quale indirizzo email usare per inviare gli avvisi.
   - Permettere ai giocatori di caricare il proprio certificato medico, ma solo dopo aver ricevuto l'avviso di scadenza.
   - Permettere all'Admin di controllare i certificati caricati e di approvarli o scartarli.
4. Aggiungere altre funzioni utili, per rendere il sito più facile e sicuro da usare: un vero accesso con email e password (al posto di quello iniziale, senza password), il recupero della password dimenticata, e una pagina Impostazioni per gestire i propri dati.

## SPECIFICHE

Il progetto è organizzato in due parti separate: una di **front end** (quello che vede e usa chi visita il sito, nella cartella `browser`) e una di **back end** (la logica e i dati gestiti dal server, nella cartella `server`).

### Architettura

Il frontend è una Single Page Application (SPA) con routing lato client basato su hash. Il backend espone un'API REST (Express) su cui il frontend effettua le chiamate, con risposte in formato JSON. Nel complesso, l'architettura è client-server a tre livelli: presentazione (`browser`), logica applicativa (`server`), dati (Supabase/PostgreSQL). L'autenticazione (login, sessione, recupero password) è affidata interamente a Supabase Auth: il server non vede né gestisce mai le password, solo il token che Supabase restituisce dopo un accesso riuscito.

### Tecnologie utilizzate

**Back end**
- Node.js (richiesta almeno la versione 18, perché il codice usa la funzione `fetch` integrata, disponibile da quella versione in poi).
- Express, per gestire le richieste del sito — versione 4.19.
- Supabase (database basato su PostgreSQL e sistema di login), collegato tramite la libreria `@supabase/supabase-js` — versione 2.45.
- `dotenv`, per leggere le credenziali dal file `.env` senza scriverle nel codice — versione 16.4.
- `nodemailer`, per l'invio delle email vere tramite una casella Gmail dedicata (con una password per le app). Sostituisce Resend, usato in una prima fase: senza un dominio verificato, Resend non poteva mandare email a indirizzi reali, solo a quello di prova.

**Front end**
- Un unico file `index.html`, scritto in HTML, CSS e JavaScript "puro" (senza framework come React, e senza bisogno di compilazione): stile e comportamento del sito sono scritti direttamente dentro questo file.
- La libreria ufficiale `@supabase/supabase-js` (caricata da CDN), usata direttamente dal browser per il login, il recupero password e per mantenere la sessione di chi ha già fatto accesso.
- Il font del sito ("Plus Jakarta Sans") viene caricato da Google Fonts.

**Pubblicazione online**
- Il codice sorgente è ospitato su GitHub.
- Il sito è pubblicato su Vercel, collegato direttamente alla repository: ogni aggiornamento inviato con `git push` viene messo online in automatico, senza bisogno di un server da tenere acceso a mano.

### Struttura dei file

Il progetto è organizzato in due cartelle principali: `browser` e `server`.

La cartella `browser` contiene il file che il browser scarica quando qualcuno visita il sito:

- `index.html` — l'unico file dell'intero sito: la struttura della pagina, lo stile grafico e il comportamento sono scritti tutti qui dentro. (Inizialmente stile e comportamento erano in due file a parte, `style.css` e `main.js`: sono poi stati riuniti in `index.html`, e i due file vecchi non sono più usati dal sito.)

La cartella `server` contiene il codice eseguito sul server:

- `server.js` è il file principale: invia al browser i file della cartella `browser`, verifica l'accesso di chi chiama, e gestisce tutte le rotte API.
- `src/supabaseClient.js` gestisce il collegamento al database, utilizzando le credenziali salvate in un file a parte (`.env`), per non scriverle direttamente nel codice.
- `sql/` raccoglie gli script SQL con cui il database è cresciuto nel tempo (nuove tabelle, nuove colonne, correzioni), da eseguire a mano nell'SQL Editor di Supabase.
- `pulizia-foto-orfane.js` — script di manutenzione, da lanciare a mano quando serve: trova ed elimina le foto rimaste nello spazio di archiviazione senza più un certificato o una segnalazione collegata.

Alla radice del progetto, il file `vercel.json` dice a Vercel come pubblicare il sito online.

### Rotte API attive

**Accesso e account**

| Rotta | A cosa serve |
|---|---|
| `GET /api/config` | Restituisce al sito, prima ancora del login, l'indirizzo e la chiave pubblica del progetto Supabase a cui collegarsi |
| `GET /api/chi-sono` | Dice chi ha fatto accesso (ruolo, nome, cognome, email, eventuale giocatore collegato); usata anche a ogni apertura del sito per ritrovare una sessione già attiva |
| `PATCH /api/mio-account` | Permette a chi ha fatto accesso di modificare i propri dati anagrafici (nome, cognome, email) dalla pagina Impostazioni |

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
| `GET /api/giocatori` | Restituisce tutti i giocatori attivi, con squadre, ruolo e stato del certificato attuale |
| `GET /api/giocatori/archiviati` | Restituisce i giocatori archiviati (eliminati) |
| `POST /api/giocatori` | Crea un nuovo giocatore |
| `PUT /api/giocatori/:id` | Modifica un giocatore, oppure lo ripristina se archiviato (`ripristina: true`) |
| `DELETE /api/giocatori/:id` | Archivia un giocatore (non lo elimina davvero, per non perdere la sua storia di certificati) |
| `POST /api/giocatori/:id/invita` | Manda (o rimanda) l'email con cui il giocatore sceglie la propria password di accesso |
| `DELETE /api/giocatori/:id/definitivo` | Elimina per sempre un giocatore già archiviato, con la sua anagrafica, i suoi certificati e il suo eventuale account di accesso: azione che non si può annullare |

**Certificati medici**

| Rotta | A cosa serve |
|---|---|
| `GET /api/certificati` | Elenco per la pagina "Gestione": un giocatore per riga, con il certificato attuale e quello nuovo in attesa, ordinati per urgenza |
| `GET /api/certificati/archivio` | Elenco completo di tutti i certificati mai caricati, per la pagina "Archivio" |
| `POST /api/certificati` | Carica (o sostituisce) il certificato di un giocatore riconosciuto |
| `PATCH /api/certificati/:id` | Approva un certificato in attesa |
| `POST /api/certificati/:id/revoca` | Scarta un certificato già approvato (per esempio se l'Admin lo approva per errore), tenendone traccia nell'Archivio |
| `DELETE /api/certificati/:id` | Scarta un certificato ancora in attesa (eliminato dal database e dalla foto nello spazio di archiviazione) |
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

Tutte le rotte che iniziano con `/api/` (tranne `/api/config`, pubblica di proposito) richiedono un accesso valido: chi chiama deve mandare, nell'intestazione della richiesta, il token ricevuto da Supabase al momento del login. Le operazioni più delicate (creare, modificare, eliminare squadre e giocatori, gestire certificati e segnalazioni) sono inoltre riservate al solo ruolo Admin.

### Struttura del database

Il database è organizzato in otto tabelle. Rispetto all'impostazione iniziale, la relazione tra giocatori e squadre non è più diretta ma passa da una tabella di collegamento (**giocatori_squadre**), per permettere a un giocatore di appartenere a più squadre insieme; sono state aggiunte anche le tabelle **segnalazioni_certificati** e **impostazioni_sito**; la tabella **persona** contiene ora anche la data di nascita e i due campi che collegano l'anagrafica a un vero account di accesso (**id_account**, **ruolo_accesso**):

- **squadre**: contiene le categorie della società.
- **persona**: contiene nome, cognome, email e data di nascita, condivisi da giocatori e responsabili; per chi può accedere al sito (Admin o Giocatore), contiene anche il collegamento al proprio account Supabase Auth e il ruolo con cui accede.
- **responsabili**: collegati alla propria persona; usati oggi solo internamente (per esempio nel controllo che blocca l'eliminazione di una squadra con un responsabile ancora assegnato), non hanno un proprio accesso al sito.
- **giocatori**: collegati alla propria persona e, tramite **giocatori_squadre**, a una o più squadre.
- **giocatori_squadre** *(nuova)*: una riga per ogni collegamento giocatore-squadra, per permettere a un giocatore di appartenere a più squadre.
- **certificati_medici**: collegati al giocatore corrispondente.
- **segnalazioni_certificati** *(nuova)*: certificati caricati con un nome non riconosciuto tra i giocatori; l'Admin le collega a un giocatore vero o le scarta, mantenendo comunque lo storico di ogni segnalazione ricevuta.
- **notifiche_inviate**: collegate al certificato medico per cui è stata inviata la notifica.
- **impostazioni_sito** *(nuova)*: una riga sola con il nome del sito e i dati della pagina Contatti; predisposta ma non ancora collegata al sito.

| Tabella | Collegata a |
|---|---|
| squadre | — |
| persona | — (collegata anche ad auth.users, per chi ha un account di accesso) |
| responsabili | persona |
| giocatori | persona |
| giocatori_squadre | giocatori, squadre |
| certificati_medici | giocatori |
| segnalazioni_certificati | giocatori (solo se collegata) |
| notifiche_inviate | certificati_medici |
| impostazioni_sito | — |

## TAPPE INTERMEDIE

### Stato attuale

Il progetto ha raggiunto tutti gli obiettivi principali stabiliti a inizio stage. La gestione dei certificati medici, funzione prioritaria richiesta dall'azienda, è completa: controllo automatico giornaliero delle scadenze, avviso via email a chi deve caricare un nuovo certificato, caricamento da parte del giocatore e approvazione o scarto da parte dell'Admin, con uno storico completo (Archivio) e la gestione delle segnalazioni per i certificati caricati con un nome non riconosciuto. Attorno a questa funzione è stata realizzata anche la gestione base della società (squadre, giocatori, più squadre per lo stesso giocatore) e un vero accesso al sito diviso per ruolo (Admin e Giocatore), con login tramite email e password, recupero della password dimenticata e una pagina Impostazioni per gestire i propri dati.

Il sito non gira più solo in locale: è pubblicato online su Vercel, collegato alla repository GitHub del progetto, ed è raggiungibile da chiunque all'indirizzo https://stage-rho-lyart.vercel.app. Le email di avviso vengono inviate davvero, tramite una casella Gmail dedicata (dopo un primo tentativo con Resend, scartato perché senza un dominio verificato non poteva mandare email a indirizzi reali).

Restano da sistemare solo alcuni dettagli minori prima di dire il progetto concluso: completare la pagina Impostazioni con i dati di contatto della società (tabella **impostazioni_sito**, già pronta nel database ma non ancora collegata), e continuare a controllare il sito online man mano che viene usato davvero, correggendo tempestivamente eventuali problemi (come quello, individuato e corretto il 18 settembre, per cui un aggiornamento della pagina poteva disconnettere chi aveva già fatto accesso).

Per avviare il progetto in locale è necessario: installare le librerie necessarie (`express`, `@supabase/supabase-js`, `dotenv`, `nodemailer`) con il comando `npm install` nella cartella `server`; creare un file `.env` nella stessa cartella con l'indirizzo e la chiave di accesso al progetto Supabase e le credenziali della casella Gmail; avviare il server con il comando `npm start`. Una volta avviato, il sito è raggiungibile all'indirizzo `http://localhost:3000`. La versione pubblicata online, invece, è sempre raggiungibile senza bisogno di avviare nulla a mano.

**Fase 1 (1 – 13 settembre)**

1. Realizzazione e organizzazione del database.
2. Realizzazione del server e collegamento con il database.
3. Realizzazione di una prima versione del sito web, non ancora definitiva, da aggiornare fino alla scadenza del progetto.
4. Realizzazione della funzione principale, ovvero la gestione dei certificati medici.

Conclusione della fase: ottenuta una versione funzionante, anche se ancora di prova, del sito con la funzione dei certificati medici attiva.

**Fase 2 (14 – 21 settembre)**

1. Realizzazione della versione definitiva del sito, con l'aggiunta di un vero accesso (email e password) diviso per ruolo, recupero della password dimenticata e pagina Impostazioni.
2. Passaggio dall'invio di email di prova (Resend) all'invio di email vere tramite una casella Gmail dedicata.
3. Pubblicazione del sito online (GitHub e Vercel), raggiungibile pubblicamente.
4. Rifiniture conclusive: completamento della pagina Impostazioni con i dati della società, e correzione dei problemi individuati durante l'uso reale del sito online.

Conclusione della fase (in corso): il progetto è sostanzialmente completo rispetto agli obiettivi concordati; restano da chiudere solo le rifiniture del punto 4, entro la scadenza del 21 settembre.

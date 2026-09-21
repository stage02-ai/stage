// Punto di partenza del server: Express gestisce le richieste,
// supabaseClient.js gestisce il collegamento al database.

require('dotenv').config();
const path = require('path');
const express = require('express');
const nodemailer = require('nodemailer');
const supabase = require('./src/supabaseClient');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve i file statici del sito (HTML, CSS, JS, immagini) dalla cartella
// "browser", che sta allo stesso livello di "server" dentro "progetto"
// (non dentro "server" stesso: lì c'è solo il codice Node.js/Express).
// Per la rotta "/" restituisce automaticamente browser/index.html: è la
// pagina iniziale con il menu del sito.
//
// "index.html" (la pagina principale, con dentro tutto il sito) non deve
// mai essere salvata così com'è, da nessuno lungo il tragitto (non solo
// dal telefono/browser di chi la apre, ma anche da eventuali "magazzini"
// intermedi usati da Vercel per velocizzare le risposte): altrimenti, ad
// ogni aggiornamento che pubblichiamo, chi l'ha già aperta in passato
// rischia di continuare a vedere la versione vecchia per giorni, senza
// nessun modo semplice per accorgersene. "no-store" è la versione più
// decisa possibile: dice esplicitamente "non salvare mai una copia di
// questo, da nessuna parte", quindi ogni apertura del sito lo scarica
// sempre di nuovo, aggiornato. Le altre risorse (immagini, css, js)
// restano con il comportamento di sempre, perché cambiano raramente.
app.use(express.static(path.join(__dirname, '..', 'browser'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
}));

// Limite più alto del solito (di base sarebbe 100kb): le foto dei
// certificati arrivano come testo (base64) dentro il corpo della
// richiesta, non come file separato, quindi il corpo può essere
// alcuni megabyte. Il limite qui è solo una prima protezione a monte
// (una foto da 5 MB, il massimo consentito — vedi
// erroreFotoCertificato più sotto — diventa circa 6,7 MB una volta
// scritta in base64): il controllo che conta davvero sulla
// dimensione della foto è quello, non questo limite generico.
app.use(express.json({ limit: '8mb' }));

// ---------- autenticazione (Supabase Auth) ----------
//
// Il vero login (email e password) lo fa il sito direttamente con
// Supabase Auth, dal browser: il server non vede mai le password. Qui
// controlliamo solo che ogni richiesta importante arrivi da qualcuno
// che ha davvero fatto accesso, leggendo il token che il browser manda
// nell'intestazione "Authorization: Bearer <token>".
//
// "/api/config" resta pubblica apposta: serve al sito, prima ancora di
// sapere chi lo sta usando, per sapere a quale progetto Supabase
// collegarsi per il login. Non contiene nessun segreto: la chiave
// "anon" è fatta apposta per essere pubblica (è diversa dalla chiave
// "service_role" usata dal resto di questo file, quella sì segreta,
// che infatti non esce mai da qui).
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
});

// Punto d'ingresso per il controllo automatico delle scadenze QUANDO IL
// SITO È ONLINE su Vercel (vedi anche, in fondo al file, il commento
// su "if (!process.env.VERCEL)": online il server non resta mai acceso
// per conto suo, quindi un "ogni 24 ore" fatto con setInterval non
// partirebbe mai davvero). La soluzione è un "Cron Job" di Vercel
// (configurato in vercel.json, chiave "crons"): è Vercel stesso a
// chiamare questa rotta una volta al giorno, da solo, anche se nessuno
// visita il sito in quel momento.
//
// Questa rotta resta VOLUTAMENTE fuori da "richiedeAccesso" qui sotto
// (per lo stesso motivo di "/api/config" sopra: deve rispondere prima
// e indipendentemente da qualunque login), ma non deve essere
// raggiungibile da chiunque conosca l'indirizzo: per questo controlla
// un codice segreto (CRON_SECRET), da impostare tra le variabili
// d'ambiente del progetto su Vercel (Project Settings > Environment
// Variables). Quando è impostato, Vercel manda da solo questo stesso
// codice, come intestazione "Authorization", ogni volta che attiva il
// Cron Job: se il codice che arriva non corrisponde, la richiesta
// viene rifiutata.
app.get('/api/cron/controlla-scadenze', async (req, res) => {
  const segretoAtteso = process.env.CRON_SECRET;
  const intestazioneAutorizzazione = req.headers.authorization || '';
  const segretoRicevuto = intestazioneAutorizzazione.indexOf('Bearer ') === 0
    ? intestazioneAutorizzazione.slice(7)
    : null;

  if (!segretoAtteso || segretoRicevuto !== segretoAtteso) {
    return res.status(401).json({ errore: 'Non autorizzato.' });
  }

  try {
    await controllaScadenzeCertificati();
    res.json({ ok: true });
  } catch (erroreInatteso) {
    console.error('Errore nel controllo automatico delle scadenze (Cron):', erroreInatteso.message);
    res.status(500).json({ errore: erroreInatteso.message });
  }
});

// ---------- Registrazione di un giocatore da un link WhatsApp ----------
//
// Queste due rotte ("chi è" e "completa la registrazione") restano
// VOLUTAMENTE fuori da richiedeAccesso qui sotto (per lo stesso motivo
// di "/api/config" e "/api/cron/controlla-scadenze" più sopra): chi le
// chiama non ha ancora un account, quindi non può mandare nessun token
// di accesso. Al posto del login, il "segreto" che dimostra di essere
// davvero il giocatore giusto è il token lungo e casuale dentro il
// link stesso (vedi POST /api/giocatori/rapido e POST
// /api/giocatori/:id/link-registrazione più sotto, dopo
// richiedeAccesso, dove questi token vengono generati: solo l'Admin,
// che è autenticato, può generarli).

// Il sito la chiama appena apre il link di registrazione, per sapere
// per chi è (nome e cognome, da mostrare) e se il link è ancora valido,
// PRIMA di mostrare il modulo con cui il giocatore sceglie data di
// nascita, email e password.
app.get('/api/registrazione/:token', async (req, res) => {
  const { token } = req.params;

  const { data: persona, error } = await supabase
    .from('persona')
    .select('nome, cognome, id_account, token_registrazione_scadenza')
    .eq('token_registrazione', token)
    .maybeSingle();

  if (error) {
    console.error('Errore nella lettura del token di registrazione:', error.message);
    return res.status(500).json({ errore: error.message });
  }
  if (!persona || persona.id_account) {
    return res.status(404).json({ errore: 'Questo link non è valido: controlli di averlo copiato per intero, oppure chieda all\'allenatore di generarne uno nuovo.' });
  }
  if (persona.token_registrazione_scadenza && new Date(persona.token_registrazione_scadenza) < new Date()) {
    return res.status(410).json({ errore: 'Questo link è scaduto: chieda all\'allenatore di generarne uno nuovo.' });
  }

  res.json({ nome: persona.nome, cognome: persona.cognome });
});

// Completa la registrazione: il giocatore sceglie data di nascita,
// email e password. Crea davvero l'account di accesso (Supabase Auth)
// e lo collega alla persona già creata dall'Admin (vedi POST
// /api/giocatori/rapido).
app.post('/api/registrazione/:token', async (req, res) => {
  const { token } = req.params;
  const { data_nascita, email, password } = req.body || {};

  if (!data_nascita) {
    return res.status(400).json({ errore: 'Serve la Sua data di nascita.' });
  }
  const erroreData = erroreDataNascita(data_nascita);
  if (erroreData) {
    return res.status(400).json({ errore: erroreData });
  }
  if (!email || !String(email).trim()) {
    return res.status(400).json({ errore: 'Serve la Sua email.' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ errore: 'La password deve avere almeno 8 caratteri.' });
  }

  const { data: persona, error: erroreLettura } = await supabase
    .from('persona')
    .select('id, id_account, token_registrazione_scadenza')
    .eq('token_registrazione', token)
    .maybeSingle();

  if (erroreLettura) {
    console.error('Errore nella lettura del token di registrazione:', erroreLettura.message);
    return res.status(500).json({ errore: erroreLettura.message });
  }
  if (!persona || persona.id_account) {
    return res.status(404).json({ errore: 'Questo link non è valido: controlli di averlo copiato per intero, oppure chieda all\'allenatore di generarne uno nuovo.' });
  }
  if (persona.token_registrazione_scadenza && new Date(persona.token_registrazione_scadenza) < new Date()) {
    return res.status(410).json({ errore: 'Questo link è scaduto: chieda all\'allenatore di generarne uno nuovo.' });
  }

  // Creo davvero l'account di accesso: "email_confirm: true" salta
  // l'email di conferma di Supabase, perché il possesso stesso del
  // link (mandato dall'Admin su WhatsApp) è già la prova che serviva.
  const { data: nuovoAccount, error: erroreAccount } = await supabase.auth.admin.createUser({
    email: String(email).trim(),
    password: String(password),
    email_confirm: true,
  });

  if (erroreAccount) {
    const messaggio = /already|esiste|registrat/i.test(erroreAccount.message || '')
      ? 'Questa email è già usata da un altro account: ne scelga un\'altra.'
      : erroreAccount.message;
    return res.status(400).json({ errore: messaggio });
  }
  if (!nuovoAccount || !nuovoAccount.user) {
    return res.status(500).json({ errore: 'Registrazione non riuscita per un motivo sconosciuto.' });
  }

  const { error: erroreCollega } = await supabase
    .from('persona')
    .update({
      id_account: nuovoAccount.user.id,
      ruolo_accesso: 'giocatore',
      email: String(email).trim(),
      data_nascita,
      token_registrazione: null,
      token_registrazione_scadenza: null,
    })
    .eq('id', persona.id);

  if (erroreCollega) {
    console.error('Non sono riuscito a collegare l\'account appena creato alla persona:', erroreCollega.message);
    // L'account di accesso è stato creato ma non collegato: lo tolgo,
    // così chi riprova non trova un'email "già usata" per un
    // collegamento che in realtà non è mai andato a buon fine.
    await supabase.auth.admin.deleteUser(nuovoAccount.user.id);
    return res.status(500).json({ errore: erroreCollega.message });
  }

  res.json({ ok: true });
});

// Controlla il token di chi sta chiamando e, se è valido, recupera la
// persona collegata (con il suo ruolo). Se manca il token, non è
// valido, oppure non corrisponde a nessuna persona abilitata (cioè con
// "ruolo_accesso" impostato), blocca subito la richiesta. Tutte le
// rotte "/api/..." definite più sotto (tranne "/api/config" qui sopra,
// già definita prima di questa riga) passano da qui.
async function richiedeAccesso(req, res, next) {
  const intestazione = req.headers.authorization || '';
  const token = intestazione.indexOf('Bearer ') === 0 ? intestazione.slice(7) : null;

  if (!token) {
    return res.status(401).json({ errore: 'Accesso richiesto: effettuare il login.' });
  }

  const { data: datiToken, error: erroreToken } = await supabase.auth.getUser(token);
  if (erroreToken || !datiToken || !datiToken.user) {
    return res.status(401).json({ errore: 'Sessione scaduta o non valida: effettuare di nuovo il login.' });
  }

  const { data: persona, error: errorePersona } = await supabase
    .from('persona')
    .select('id, nome, cognome, ruolo_accesso, giocatori(id, archiviato)')
    .eq('id_account', datiToken.user.id)
    .maybeSingle();

  if (errorePersona) {
    console.error('Errore nel controllo dell\'accesso:', errorePersona.message);
    return res.status(500).json({ errore: errorePersona.message });
  }
  if (!persona || !persona.ruolo_accesso) {
    return res.status(403).json({ errore: 'Questo account non è abilitato ad accedere al sito.' });
  }

  const giocatoreAttivo = (persona.giocatori || []).filter(function (g) { return !g.archiviato; })[0];

  req.utente = {
    idPersona: persona.id,
    nome: persona.nome,
    cognome: persona.cognome,
    // L'email con cui si effettua davvero il login (quella di Supabase
    // Auth), non quella scritta su "persona": è quella giusta da
    // mostrare nella pagina Impostazioni, perché è con quella che
    // l'account accede al sito.
    email: datiToken.user.email,
    ruolo: persona.ruolo_accesso,
    idGiocatore: giocatoreAttivo ? giocatoreAttivo.id : null,
  };
  next();
}

// Da qui in poi, ogni rotta "/api/..." richiede l'accesso (vedi
// richiedeAccesso appena sopra).
app.use('/api', richiedeAccesso);

// Da aggiungere come secondo parametro solo alle rotte riservate
// all'Admin (creare/modificare/eliminare squadre e giocatori, approvare
// o scartare certificati, gestire le segnalazioni...): un Giocatore che
// provasse a chiamarle riceve un errore invece di essere eseguita.
function richiedeAdmin(req, res, next) {
  if (!req.utente || req.utente.ruolo !== 'admin') {
    return res.status(403).json({ errore: 'Questa azione è consentita solo all\'Admin.' });
  }
  next();
}

// Dice al sito chi ha fatto accesso: usato subito dopo il login, e ad
// ogni apertura del sito per ritrovare la sessione già fatta.
app.get('/api/chi-sono', (req, res) => {
  res.json({
    ruolo: req.utente.ruolo,
    nome: req.utente.nome,
    cognome: req.utente.cognome,
    email: req.utente.email,
    idGiocatore: req.utente.idGiocatore,
  });
});

// Permette a chi ha fatto accesso (Admin o Giocatore) di modificare i
// propri dati anagrafici dalla scheda "Account" della pagina
// Impostazioni: nome, cognome ed email. Aggiorna sempre e solo la
// PROPRIA persona (req.utente.idPersona, calcolato dal server in
// richiedeAccesso a partire dal token: mai un id mandato dal
// browser), così nessuno può modificare i dati di qualcun altro.
//
// NOTA sull'email: qui aggiorniamo l'email scritta sulla tabella
// "persona" (quella usata, per esempio, per le notifiche sui
// certificati). L'email con cui si effettua davvero il login resta
// quella di Supabase Auth: per cambiare anche quella, il sito chiama
// separatamente, dal browser, supabase.auth.updateUser({ email }),
// che manda un'email di conferma prima di attivare il cambio.
app.patch('/api/mio-account', async (req, res) => {
  const { nome, cognome, email } = req.body || {};

  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ errore: 'Serve il nome.' });
  }
  if (!cognome || !String(cognome).trim()) {
    return res.status(400).json({ errore: 'Serve il cognome.' });
  }
  if (!email || !String(email).trim()) {
    return res.status(400).json({ errore: 'Serve l\'email.' });
  }

  const { error: errorePersona } = await supabase
    .from('persona')
    .update({
      nome: String(nome).trim(),
      cognome: String(cognome).trim(),
      email: String(email).trim(),
    })
    .eq('id', req.utente.idPersona);

  if (errorePersona) {
    if (errorePersona.code === '23505') {
      return res.status(400).json({ errore: 'Esiste già una persona con questa email.' });
    }
    console.error('Errore nella modifica del proprio account:', errorePersona.message);
    return res.status(500).json({ errore: errorePersona.message });
  }

  res.json({
    nome: String(nome).trim(),
    cognome: String(cognome).trim(),
    email: String(email).trim(),
  });
});

// Nome dello spazio di archiviazione ("bucket") su Supabase Storage dove
// vengono salvate le foto dei certificati medici. Non è pubblico: per
// vederle si passa sempre da un link temporaneo generato dal server
// (vedi la route "/api/certificati/:id/foto" più sotto).
const BUCKET_CERTIFICATI = 'certificati-medici';

// Formati e dimensione massima accettati per la foto di un
// certificato medico: valgono sia per il caricamento normale (POST
// /api/certificati) sia per le segnalazioni di nomi non riconosciuti
// (POST /api/certificati/segnalazione). Lo stesso controllo lo fa
// anche il sito prima di inviare (vedi erroreFotoCertificato in
// index.html), ma quello che conta davvero è questo, fatto dal
// server.
const FORMATI_FOTO_ACCETTATI = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const DIMENSIONE_MASSIMA_FOTO = 5 * 1024 * 1024; // 5 MB

// La dimensione si controlla sui byte veri della foto, non sulla
// lunghezza del testo in base64 (che è più lunga di circa un terzo).
function erroreFotoCertificato(base64, mime) {
  if (!FORMATI_FOTO_ACCETTATI.includes(mime)) {
    return 'Formato non accettato: si può caricare solo una foto in JPG, PNG o WEBP, oppure un file PDF.';
  }
  const bytes = Buffer.byteLength(base64 || '', 'base64');
  if (bytes > DIMENSIONE_MASSIMA_FOTO) {
    return 'La foto è troppo pesante (' + Math.round((bytes / 1024 / 1024) * 10) / 10 + ' MB): il massimo consentito è 5 MB.';
  }
  return null;
}

// Crea il bucket la prima volta che il server parte, se non esiste già:
// così non serve andare a crearlo a mano su Supabase.
async function assicuraBucketCertificati() {
  const { data: bucket, error: erroreLettura } = await supabase.storage.getBucket(BUCKET_CERTIFICATI);

  if (bucket) return; // esiste già, non c'è altro da fare

  if (erroreLettura && !/not found|non trovato/i.test(erroreLettura.message || '')) {
    console.error('Errore nel controllo dello spazio di archiviazione:', erroreLettura.message);
  }

  const { error: erroreCreazione } = await supabase.storage.createBucket(BUCKET_CERTIFICATI, { public: false });
  if (erroreCreazione) {
    console.error(
      'Non sono riuscito a creare lo spazio di archiviazione "' + BUCKET_CERTIFICATI + '":',
      erroreCreazione.message
    );
  } else {
    console.log('Spazio di archiviazione "' + BUCKET_CERTIFICATI + '" creato su Supabase.');
  }
}
assicuraBucketCertificati();

// Route di prova: legge la tabella "giocatori" da Supabase.
// Se questa route funziona, il collegamento al database è corretto.
app.get('/test-giocatori', async (req, res) => {
  const { data, error } = await supabase.from('giocatori').select('*');

  if (error) {
    console.error('Errore nella query a Supabase:', error.message);
    return res.status(500).json({ errore: error.message });
  }

  res.json(data);
});

// Elenco delle squadre della società, usato dalla pagina "Squadre" del sito.
app.get('/api/squadre', async (req, res) => {
  const { data, error } = await supabase.from('squadre').select('id, nome').order('id');

  if (error) {
    console.error('Errore nella query a Supabase (squadre):', error.message);
    return res.status(500).json({ errore: error.message });
  }

  res.json(data);
});

// Crea una nuova squadra/categoria: usato dal pulsante "Nuova squadra"
// nella pagina Squadre del sito (visibile solo all'Admin).
app.post('/api/squadre', richiedeAdmin, async (req, res) => {
  const { nome } = req.body || {};

  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ errore: 'Serve il nome della squadra.' });
  }

  const { data, error } = await supabase
    .from('squadre')
    .insert({ nome: String(nome).trim() })
    .select('id, nome')
    .single();

  if (error) {
    // "nome" è unique nel database: il codice 23505 di Postgres vuol
    // dire che esiste già una squadra con questo nome.
    if (error.code === '23505') {
      return res.status(400).json({ errore: 'Esiste già una squadra con questo nome.' });
    }
    console.error('Errore nella creazione della squadra:', error.message);
    return res.status(500).json({ errore: error.message });
  }

  res.status(201).json(data);
});

// Modifica il nome di una squadra: usato dalla matita sulla card della
// squadra nella pagina Squadre (solo Admin).
app.put('/api/squadre/:id', richiedeAdmin, async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body || {};

  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ errore: 'Serve il nome della squadra.' });
  }

  const { data, error } = await supabase
    .from('squadre')
    .update({ nome: String(nome).trim() })
    .eq('id', id)
    .select('id, nome')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(400).json({ errore: 'Esiste già una squadra con questo nome.' });
    }
    console.error('Errore nella modifica della squadra:', error.message);
    return res.status(500).json({ errore: error.message });
  }

  res.json(data);
});

// Elimina una squadra: usato dal cestino sulla card della squadra nella
// pagina Squadre (solo Admin). Se c'è ancora un responsabile assegnato
// a questa squadra, per sicurezza l'eliminazione viene rifiutata (va
// prima spostato o rimosso). I suoi giocatori, invece, non bloccano più
// l'eliminazione: vengono archiviati automaticamente, esattamente come
// quando si elimina un giocatore singolarmente (vedi DELETE
// /api/giocatori/:id) — spariscono da Giocatori e dalla Rosa, e tutti i
// loro certificati finiscono nella sezione "Archiviati" dell'Archivio.
app.delete('/api/squadre/:id', richiedeAdmin, async (req, res) => {
  const { id } = req.params;

  const { count: numResponsabili, error: erroreResponsabili } = await supabase
    .from('responsabili')
    .select('id', { count: 'exact', head: true })
    .eq('id_squadra', id);

  if (erroreResponsabili) {
    console.error('Errore nel controllo dei responsabili della squadra:', erroreResponsabili.message);
    return res.status(500).json({ errore: erroreResponsabili.message });
  }

  if (numResponsabili && numResponsabili > 0) {
    return res.status(400).json({
      errore: 'Non è possibile eliminare questa squadra: c\'è ancora un responsabile assegnato a questa squadra.',
    });
  }

  // Un giocatore può appartenere a più squadre: prima di archiviare
  // qualcuno, controlliamo per ognuno dei giocatori di QUESTA squadra
  // se gli resterebbe almeno un'altra squadra dopo l'eliminazione. Se
  // sì, resta attivo (perde solo questa squadra); se questa era la sua
  // unica squadra, viene archiviato automaticamente, esattamente come
  // quando si elimina un giocatore singolarmente (vedi DELETE
  // /api/giocatori/:id) — sparisce da Giocatori e dalla Rosa, e tutti i
  // suoi certificati finiscono nella sezione "Archiviati" dell'Archivio.
  const { data: collegamentiSquadra, error: erroreCollegamenti } = await supabase
    .from('giocatori_squadre')
    .select('id_giocatore')
    .eq('id_squadra', id);

  if (erroreCollegamenti) {
    console.error('Errore nella lettura dei giocatori della squadra:', erroreCollegamenti.message);
    return res.status(500).json({ errore: erroreCollegamenti.message });
  }

  const idGiocatoriSquadra = (collegamentiSquadra || []).map((r) => r.id_giocatore);

  if (idGiocatoriSquadra.length) {
    const { data: tutteLeSquadreDiQuesti, error: erroreTutteLeSquadre } = await supabase
      .from('giocatori_squadre')
      .select('id_giocatore')
      .in('id_giocatore', idGiocatoriSquadra);

    if (erroreTutteLeSquadre) {
      console.error('Errore nel controllo delle squadre dei giocatori:', erroreTutteLeSquadre.message);
      return res.status(500).json({ errore: erroreTutteLeSquadre.message });
    }

    // Conto, per ogni giocatore coinvolto, in quante squadre sta in
    // totale (compresa questa che stiamo per eliminare).
    const conteggioSquadrePerGiocatore = {};
    (tutteLeSquadreDiQuesti || []).forEach((riga) => {
      conteggioSquadrePerGiocatore[riga.id_giocatore] = (conteggioSquadrePerGiocatore[riga.id_giocatore] || 0) + 1;
    });

    const idGiocatoriDaArchiviare = idGiocatoriSquadra.filter(
      (idGiocatore) => (conteggioSquadrePerGiocatore[idGiocatore] || 0) <= 1
    );

    if (idGiocatoriDaArchiviare.length) {
      const { error: erroreArchiviaGiocatori } = await supabase
        .from('giocatori')
        .update({ archiviato: true })
        .in('id', idGiocatoriDaArchiviare);

      if (erroreArchiviaGiocatori) {
        console.error('Errore nell\'archiviazione dei giocatori della squadra:', erroreArchiviaGiocatori.message);
        return res.status(500).json({ errore: erroreArchiviaGiocatori.message });
      }
    }
  }

  // Elimino la squadra: i collegamenti in giocatori_squadre che la
  // riguardano spariscono da soli (vedi sql/permetti-piu-squadre-giocatore.sql).
  const { error } = await supabase.from('squadre').delete().eq('id', id);

  if (error) {
    console.error('Errore nell\'eliminazione della squadra:', error.message);
    return res.status(500).json({ errore: error.message });
  }

  res.json({ ok: true });
});

// Giocatori di una singola squadra (id_squadra), usato quando si apre
// la pagina di dettaglio di una squadra dal sito. Nome, cognome ed email
// non stanno più dentro "giocatori" ma nella tabella "persona" (condivisa
// anche dai responsabili, per non ripetere le stesse colonne in due
// tabelle): qui li leggiamo insieme tramite il collegamento id_persona, e
// li restituiamo comunque "appiattiti" (id, nome, cognome, email)
// così il resto del sito non deve accorgersi di nulla.
app.get('/api/squadre/:id/giocatori', async (req, res) => {
  const { id } = req.params;
  // Un giocatore può appartenere a più squadre: partiamo dalla tabella
  // dei collegamenti (giocatori_squadre) invece che da "giocatori"
  // direttamente, per trovare tutti i giocatori collegati a QUESTA
  // squadra (anche se ne hanno anche altre).
  const { data, error } = await supabase
    .from('giocatori_squadre')
    .select('giocatori!inner(id, archiviato, persona(nome, cognome, email, data_nascita))')
    .eq('id_squadra', id)
    .eq('giocatori.archiviato', false);

  if (error) {
    console.error('Errore nella query a Supabase (giocatori):', error.message);
    return res.status(500).json({ errore: error.message });
  }

  const giocatori = (data || [])
    .map((riga) => riga.giocatori)
    .map((g) => {
      // Stessa logica di GET /api/giocatori: l'anno di nascita è solo
      // la parte iniziale della data di nascita salvata su "persona".
      const dataNascita = g.persona ? g.persona.data_nascita : null;
      const annoNascita = dataNascita ? parseInt(String(dataNascita).slice(0, 4), 10) : null;

      return {
        id: g.id,
        nome: g.persona ? g.persona.nome : '',
        cognome: g.persona ? g.persona.cognome : '',
        email: g.persona ? g.persona.email : '',
        anno_nascita: annoNascita,
      };
    })
    .sort((a, b) => a.cognome.localeCompare(b.cognome));

  res.json(giocatori);
});

// Tutti i giocatori di tutte le squadre, con il nome della squadra: usato
// dalla pagina "Carica certificato" per far scegliere all'admin per quale
// giocatore sta caricando il certificato.
// Legge i giocatori dal database (attivi oppure archiviati, a seconda
// di "archiviato") e li restituisce "appiattiti" con tutti i dati che
// servono al sito: usata sia da GET /api/giocatori (attivi) sia da
// GET /api/giocatori/archiviati (archiviati).
async function leggiGiocatori(archiviato) {
  // Un giocatore può appartenere a più squadre insieme: le leggiamo
  // tramite la tabella dei collegamenti "giocatori_squadre" (vedi
  // sql/permetti-piu-squadre-giocatore.sql), invece che da una singola
  // colonna "id_squadra" come prima.
  const { data, error } = await supabase
    .from('giocatori')
    .select('id, certificati_azzerati_al, persona(nome, cognome, email, data_nascita, id_account, token_registrazione, token_registrazione_scadenza), giocatori_squadre(squadre(id, nome)), certificati_medici(stato, data_scadenza, data_approvazione, data_caricamento)')
    .eq('archiviato', archiviato);

  if (error) return { error };

  const giocatori = (data || [])
    .map((g) => {
      // Il certificato "attuale" del giocatore è l'ultimo approvato
      // (se ce n'è più di uno nel tempo, prendiamo il più recente):
      // la sua scadenza serve al sito per decidere se si può caricarne
      // uno nuovo oppure no (vedi POST /api/certificati più sotto). Se
      // il giocatore è stato ripristinato dopo essere stato
      // archiviato, i certificati caricati prima di quel momento non
      // contano più (vedi anche GET /api/certificati).
      const approvati = (g.certificati_medici || [])
        .filter((c) => c.stato === 'approvato')
        .filter((c) => !g.certificati_azzerati_al || new Date(c.data_caricamento) > new Date(g.certificati_azzerati_al))
        .sort((a, b) => new Date(b.data_approvazione || 0) - new Date(a.data_approvazione || 0));
      const corrente = approvati[0] || null;

      // L'anno di nascita è solo la parte iniziale (le prime 4 cifre)
      // della data di nascita salvata su "persona" (formato AAAA-MM-GG):
      // basta leggerla come testo, senza passare da un oggetto Date,
      // così non ci sono sorprese di fuso orario.
      const dataNascita = g.persona ? g.persona.data_nascita : null;
      const annoNascita = dataNascita ? parseInt(String(dataNascita).slice(0, 4), 10) : null;

      // Elenco delle squadre di questo giocatore (può essere più di
      // una): "squadre" è l'elenco vero e proprio (usato dal modulo di
      // modifica per sapere quali caselle spuntare), "squadra" resta
      // una scritta unica con i nomi separati da virgola, per non dover
      // cambiare tutte le altre pagine del sito che mostravano già
      // questo campo.
      const squadre = (g.giocatori_squadre || [])
        .map((collegamento) => collegamento.squadre)
        .filter(Boolean);

      return {
        id: g.id,
        nome: g.persona ? g.persona.nome : '',
        cognome: g.persona ? g.persona.cognome : '',
        email: g.persona ? g.persona.email : '',
        data_nascita: dataNascita,
        squadra: squadre.map((s) => s.nome).join(', '),
        squadre,
        anno_nascita: annoNascita,
        certificato_corrente_scadenza: corrente ? corrente.data_scadenza : null,
        // Dice al sito se questo giocatore ha già un account di accesso
        // collegato (per mostrare o no il pulsante "Manda accesso"
        // nell'elenco: vedi POST /api/giocatori/:id/invita).
        accesso_attivo: !!(g.persona && g.persona.id_account),
        // Dice al sito se questo giocatore è stato creato con "Aggiungi
        // con link WhatsApp" e sta ancora aspettando di completare da
        // solo la registrazione (vedi POST /api/giocatori/rapido e
        // POST /api/registrazione/:token più sotto): in quel caso non
        // ha ancora né email né account, ma ha un link in attesa.
        registrazione_in_attesa: !!(g.persona && !g.persona.id_account && g.persona.token_registrazione),
        registrazione_scaduta: !!(g.persona && !g.persona.id_account && g.persona.token_registrazione && g.persona.token_registrazione_scadenza && new Date(g.persona.token_registrazione_scadenza) < new Date()),
      };
    })
    .sort((a, b) => a.cognome.localeCompare(b.cognome));

  return { giocatori };
}

app.get('/api/giocatori', async (req, res) => {
  const { giocatori, error } = await leggiGiocatori(false);

  if (error) {
    console.error('Errore nella query a Supabase (giocatori):', error.message);
    return res.status(500).json({ errore: error.message });
  }

  res.json(giocatori);
});

// Giocatori archiviati (eliminati dall'elenco Giocatori): usata dalla
// sezione "Archiviati" della pagina Squadre > Giocatori (solo Admin),
// per poterli comunque consultare senza farli comparire tra i giocatori
// attivi (vedi DELETE /api/giocatori/:id, che li archivia invece di
// eliminarli davvero).
app.get('/api/giocatori/archiviati', richiedeAdmin, async (req, res) => {
  const { giocatori, error } = await leggiGiocatori(true);

  if (error) {
    console.error('Errore nella query a Supabase (giocatori archiviati):', error.message);
    return res.status(500).json({ errore: error.message });
  }

  res.json(giocatori);
});

// Controlla che la data di nascita scritta abbia senso: un giocatore
// non può essere nato "domani" (nessuna data futura), e per sicurezza
// scartiamo anche date troppo lontane nel passato, quasi certamente un
// errore di battitura (per esempio scrivere "1902" invece di "2012").
// Usata sia da POST che da PUT /api/giocatori. Restituisce il
// messaggio di errore da mostrare, oppure null se la data va bene.
function erroreDataNascita(data_nascita) {
  const data = new Date(data_nascita + 'T00:00:00');
  if (isNaN(data.getTime())) {
    return 'La data di nascita non è valida.';
  }

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  if (data > oggi) {
    return 'La data di nascita non può essere nel futuro.';
  }

  const primaDataRagionevole = new Date('1920-01-01T00:00:00');
  if (data < primaDataRagionevole) {
    return 'La data di nascita scritta è troppo lontana nel passato: controlli che sia corretta.';
  }

  return null;
}

// Crea un nuovo giocatore: prima la sua "persona" (dati anagrafici),
// poi il giocatore vero e proprio collegato alle squadre scelte (può
// appartenere a più di una). Usato dal pulsante "Nuovo giocatore" nella
// pagina Squadre > Giocatori (solo Admin). Il responsabile non si
// sceglie nel modulo: viene preso automaticamente da quello già
// collegato alla prima squadra scelta, se c'è.
app.post('/api/giocatori', richiedeAdmin, async (req, res) => {
  const { nome, cognome, email, data_nascita, id_squadre } = req.body || {};

  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ errore: 'Serve il nome del giocatore.' });
  }
  if (!cognome || !String(cognome).trim()) {
    return res.status(400).json({ errore: 'Serve il cognome del giocatore.' });
  }
  if (!email || !String(email).trim()) {
    return res.status(400).json({ errore: 'Serve l\'email del giocatore.' });
  }
  if (!data_nascita) {
    return res.status(400).json({ errore: 'Serve la data di nascita del giocatore.' });
  }
  const erroreData = erroreDataNascita(data_nascita);
  if (erroreData) {
    return res.status(400).json({ errore: erroreData });
  }
  // Un giocatore può appartenere a più squadre: il sito manda un elenco
  // di id (anche di una sola squadra), non più un id singolo.
  const squadreScelte = Array.isArray(id_squadre) ? id_squadre.filter(Boolean) : [];
  if (!squadreScelte.length) {
    return res.status(400).json({ errore: 'Serve almeno una squadra per il giocatore.' });
  }

  // 1) Creo prima la persona (dati anagrafici, condivisi anche con i
  //    responsabili).
  const { data: persona, error: errorePersona } = await supabase
    .from('persona')
    .insert({
      nome: String(nome).trim(),
      cognome: String(cognome).trim(),
      email: String(email).trim(),
      data_nascita,
    })
    .select('id')
    .single();

  if (errorePersona) {
    if (errorePersona.code === '23505') {
      return res.status(400).json({ errore: 'Esiste già una persona con questa email.' });
    }
    console.error('Errore nella creazione della persona:', errorePersona.message);
    return res.status(500).json({ errore: errorePersona.message });
  }

  // 2) Cerco un responsabile già collegato alla PRIMA squadra scelta:
  //    se c'è, diventerà anche il responsabile di questo giocatore. Se
  //    quella squadra non ha ancora un responsabile, il giocatore resta
  //    senza (si potrà sistemare in seguito).
  const { data: responsabile, error: erroreResponsabile } = await supabase
    .from('responsabili')
    .select('id')
    .eq('id_squadra', squadreScelte[0])
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (erroreResponsabile) {
    console.error('Errore nella ricerca del responsabile della squadra:', erroreResponsabile.message);
  }

  // 3) Creo il giocatore, collegato alla persona appena creata.
  const { data: giocatore, error: erroreGiocatore } = await supabase
    .from('giocatori')
    .insert({
      id_persona: persona.id,
      id_responsabile: responsabile ? responsabile.id : null,
    })
    .select('id')
    .single();

  if (erroreGiocatore) {
    // Se il giocatore non si riesce a creare, tolgo anche la persona
    // appena creata, per non lasciare dati anagrafici "orfani" nel
    // database.
    await supabase.from('persona').delete().eq('id', persona.id);
    console.error('Errore nella creazione del giocatore:', erroreGiocatore.message);
    return res.status(500).json({ errore: erroreGiocatore.message });
  }

  // 3bis) Lo collego a tutte le squadre scelte.
  const { error: erroreSquadreGiocatore } = await supabase
    .from('giocatori_squadre')
    .insert(squadreScelte.map((idSquadra) => ({ id_giocatore: giocatore.id, id_squadra: idSquadra })));

  if (erroreSquadreGiocatore) {
    // Se il collegamento alle squadre fallisce (per esempio una delle
    // squadre scelte non esiste più), tolgo anche il giocatore e la
    // persona appena creati, per non lasciare nulla a metà.
    await supabase.from('giocatori').delete().eq('id', giocatore.id);
    await supabase.from('persona').delete().eq('id', persona.id);
    console.error('Errore nel collegare il giocatore alle squadre:', erroreSquadreGiocatore.message);
    return res.status(500).json({ errore: erroreSquadreGiocatore.message });
  }

  // 4) A differenza di prima, qui NON mandiamo più subito l'email per
  //    scegliere la password: su richiesta del tutor, l'invio deve
  //    passare da un pulsante ("Manda accesso") che l'Admin clicca
  //    quando decide lui, non partire in automatico appena creato il
  //    giocatore. Quel pulsante compare nell'elenco Giocatori finché
  //    la persona non ha ancora un account di accesso (vedi
  //    leggiGiocatori più sotto) e chiama POST
  //    /api/giocatori/:id/invita, definita subito dopo questa rotta.
  res.status(201).json({ ok: true, id: giocatore.id });
});

// Manda (o rimanda) l'email con cui un giocatore sceglie la propria
// password di accesso: prima veniva fatto in automatico appena creato
// il giocatore (vedi sopra), ora è un passaggio separato ed esplicito,
// azionato dal pulsante "Manda accesso" nell'elenco Giocatori. Così
// l'Admin decide lui quando l'email parte, e può anche rimandarla in
// un secondo momento se il primo tentativo fosse fallito.
app.post('/api/giocatori/:id/invita', richiedeAdmin, async (req, res) => {
  const { id } = req.params;

  const { data: giocatore, error: erroreGiocatore } = await supabase
    .from('giocatori')
    .select('id_persona')
    .eq('id', id)
    .single();

  if (erroreGiocatore || !giocatore) {
    return res.status(404).json({ errore: 'Giocatore non trovato.' });
  }

  const { data: persona, error: erroreLetturaPersona } = await supabase
    .from('persona')
    .select('id, email, id_account')
    .eq('id', giocatore.id_persona)
    .single();

  if (erroreLetturaPersona || !persona) {
    return res.status(404).json({ errore: 'Anagrafica del giocatore non trovata.' });
  }
  if (persona.id_account) {
    return res.status(400).json({ errore: 'Questo giocatore ha già un account di accesso: non serve mandargli di nuovo l\'email.' });
  }
  if (!persona.email) {
    return res.status(400).json({ errore: 'Al giocatore manca l\'email: la aggiunga prima dalla modifica del giocatore.' });
  }

  const baseUrl = req.protocol + '://' + req.get('host');
  const { data: invito, error: erroreInvito } = await supabase.auth.admin.inviteUserByEmail(
    persona.email,
    { redirectTo: baseUrl + '/' }
  );

  if (erroreInvito) {
    console.error('Non sono riuscito a invitare il giocatore ad accedere:', erroreInvito.message);
    return res.status(500).json({ errore: erroreInvito.message });
  }
  if (!invito || !invito.user) {
    return res.status(500).json({ errore: 'Invito non riuscito per un motivo sconosciuto.' });
  }

  const { error: erroreCollega } = await supabase
    .from('persona')
    .update({ id_account: invito.user.id, ruolo_accesso: 'giocatore' })
    .eq('id', persona.id);

  if (erroreCollega) {
    console.error('Non sono riuscito a collegare l\'account di accesso al giocatore:', erroreCollega.message);
    return res.status(500).json({ errore: erroreCollega.message });
  }

  res.json({ ok: true });
});

// Quanti giorni resta valido un link di registrazione generato con
// "Aggiungi con link WhatsApp" (vedi POST /api/giocatori/rapido e POST
// /api/giocatori/:id/link-registrazione qui sotto), prima che l'Admin
// debba generarne uno nuovo. Passato questo tempo il link smette di
// funzionare, per sicurezza (se finisse nelle mani sbagliate o
// restasse dimenticato in una chat).
const GIORNI_VALIDITA_LINK_REGISTRAZIONE = 7;

// Genera un codice casuale, imprevedibile, da usare come token nel
// link di registrazione: chi lo indovina potrebbe registrarsi al posto
// del giocatore, quindi deve essere lungo e casuale (non un numero
// progressivo).
function generaTokenRegistrazione() {
  return require('crypto').randomBytes(24).toString('hex');
}

// Crea un giocatore "rapido": solo nome, cognome e squadre, senza
// email né password. Usato dal pulsante "Aggiungi con link WhatsApp"
// nella pagina Squadre > Giocatori (solo Admin), pensato per quando il
// giocatore non è presente di persona: l'Admin lo aggiunge subito con
// il minimo indispensabile, poi manda al giocatore (su WhatsApp, o come
// preferisce) il link restituito da questa rotta. Aprendo quel link il
// giocatore stesso sceglie data di nascita, email e password (vedi GET
// e POST /api/registrazione/:token, più in alto in questo file, PRIMA
// di richiedeAccesso perché quelle due rotte restano pubbliche).
app.post('/api/giocatori/rapido', richiedeAdmin, async (req, res) => {
  const { nome, cognome, id_squadre } = req.body || {};

  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ errore: 'Serve il nome del giocatore.' });
  }
  if (!cognome || !String(cognome).trim()) {
    return res.status(400).json({ errore: 'Serve il cognome del giocatore.' });
  }
  const squadreScelte = Array.isArray(id_squadre) ? id_squadre.filter(Boolean) : [];
  if (!squadreScelte.length) {
    return res.status(400).json({ errore: 'Serve almeno una squadra per il giocatore.' });
  }

  // 1) Creo la persona, senza email né data di nascita: le sceglierà il
  //    giocatore stesso registrandosi dal link.
  const { data: persona, error: errorePersona } = await supabase
    .from('persona')
    .insert({
      nome: String(nome).trim(),
      cognome: String(cognome).trim(),
      email: null,
    })
    .select('id')
    .single();

  if (errorePersona) {
    console.error('Errore nella creazione della persona (rapido):', errorePersona.message);
    return res.status(500).json({ errore: errorePersona.message });
  }

  // 2) Come nella creazione normale: responsabile della PRIMA squadra
  //    scelta, se c'è.
  const { data: responsabile, error: erroreResponsabile } = await supabase
    .from('responsabili')
    .select('id')
    .eq('id_squadra', squadreScelte[0])
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (erroreResponsabile) {
    console.error('Errore nella ricerca del responsabile della squadra:', erroreResponsabile.message);
  }

  // 3) Creo il giocatore, collegato alla persona appena creata.
  const { data: giocatore, error: erroreGiocatore } = await supabase
    .from('giocatori')
    .insert({
      id_persona: persona.id,
      id_responsabile: responsabile ? responsabile.id : null,
    })
    .select('id')
    .single();

  if (erroreGiocatore) {
    await supabase.from('persona').delete().eq('id', persona.id);
    console.error('Errore nella creazione del giocatore (rapido):', erroreGiocatore.message);
    return res.status(500).json({ errore: erroreGiocatore.message });
  }

  // 3bis) Lo collego a tutte le squadre scelte.
  const { error: erroreSquadreGiocatore } = await supabase
    .from('giocatori_squadre')
    .insert(squadreScelte.map((idSquadra) => ({ id_giocatore: giocatore.id, id_squadra: idSquadra })));

  if (erroreSquadreGiocatore) {
    await supabase.from('giocatori').delete().eq('id', giocatore.id);
    await supabase.from('persona').delete().eq('id', persona.id);
    console.error('Errore nel collegare il giocatore alle squadre (rapido):', erroreSquadreGiocatore.message);
    return res.status(500).json({ errore: erroreSquadreGiocatore.message });
  }

  // 4) Genero il token di registrazione e lo salvo, con la sua
  //    scadenza, sulla persona appena creata.
  const token = generaTokenRegistrazione();
  const scadenza = new Date(Date.now() + GIORNI_VALIDITA_LINK_REGISTRAZIONE * 24 * 60 * 60 * 1000).toISOString();

  const { error: erroreToken } = await supabase
    .from('persona')
    .update({ token_registrazione: token, token_registrazione_scadenza: scadenza })
    .eq('id', persona.id);

  if (erroreToken) {
    console.error('Errore nel salvare il token di registrazione:', erroreToken.message);
    return res.status(500).json({ errore: erroreToken.message });
  }

  const baseUrl = req.protocol + '://' + req.get('host');
  const link = baseUrl + '/#/registrati/' + token;

  res.status(201).json({ ok: true, id: giocatore.id, link });
});

// Genera un nuovo link di registrazione per un giocatore creato con
// "Aggiungi con link WhatsApp" che non si è ancora registrato: usato
// sia per mandare di nuovo il link (se il giocatore l'ha perso), sia
// per farne uno nuovo se quello precedente è scaduto. Ogni volta che
// viene chiamata, il link precedente smette subito di funzionare (resta
// valido solo l'ultimo generato).
app.post('/api/giocatori/:id/link-registrazione', richiedeAdmin, async (req, res) => {
  const { id } = req.params;

  const { data: giocatore, error: erroreGiocatore } = await supabase
    .from('giocatori')
    .select('id_persona')
    .eq('id', id)
    .single();

  if (erroreGiocatore || !giocatore) {
    return res.status(404).json({ errore: 'Giocatore non trovato.' });
  }

  const { data: persona, error: erroreLetturaPersona } = await supabase
    .from('persona')
    .select('id, id_account')
    .eq('id', giocatore.id_persona)
    .single();

  if (erroreLetturaPersona || !persona) {
    return res.status(404).json({ errore: 'Anagrafica del giocatore non trovata.' });
  }
  if (persona.id_account) {
    return res.status(400).json({ errore: 'Questo giocatore ha già un account di accesso: non serve generare un link.' });
  }

  const token = generaTokenRegistrazione();
  const scadenza = new Date(Date.now() + GIORNI_VALIDITA_LINK_REGISTRAZIONE * 24 * 60 * 60 * 1000).toISOString();

  const { error: erroreToken } = await supabase
    .from('persona')
    .update({ token_registrazione: token, token_registrazione_scadenza: scadenza })
    .eq('id', persona.id);

  if (erroreToken) {
    console.error('Errore nel rigenerare il token di registrazione:', erroreToken.message);
    return res.status(500).json({ errore: erroreToken.message });
  }

  const baseUrl = req.protocol + '://' + req.get('host');
  const link = baseUrl + '/#/registrati/' + token;

  res.json({ ok: true, link });
});

// Modifica un giocatore esistente: aggiorna sia i dati anagrafici
// (persona) sia le squadre. Usato dalla matita sulla riga del
// giocatore nella pagina Squadre > Giocatori (solo Admin). Se cambia la
// squadra, il responsabile si aggiorna da solo in base alla nuova
// squadra, come alla creazione.
//
// Questa stessa route serve anche per RIPRISTINARE un giocatore
// archiviato (pulsante "Ripristina" nella sezione Archiviati): in quel
// caso il corpo della richiesta contiene anche "ripristina: true", che
// oltre ad aggiornare i dati toglie il giocatore dall'archivio e
// "azzera" i suoi certificati (vedi sotto): da quel momento dovrà
// caricarne uno nuovo, anche se ne aveva già uno approvato prima di
// essere archiviato.
app.put('/api/giocatori/:id', richiedeAdmin, async (req, res) => {
  const { id } = req.params;
  const { nome, cognome, email, data_nascita, id_squadre, ripristina } = req.body || {};

  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ errore: 'Serve il nome del giocatore.' });
  }
  if (!cognome || !String(cognome).trim()) {
    return res.status(400).json({ errore: 'Serve il cognome del giocatore.' });
  }
  if (!email || !String(email).trim()) {
    return res.status(400).json({ errore: 'Serve l\'email del giocatore.' });
  }
  if (!data_nascita) {
    return res.status(400).json({ errore: 'Serve la data di nascita del giocatore.' });
  }
  const erroreData = erroreDataNascita(data_nascita);
  if (erroreData) {
    return res.status(400).json({ errore: erroreData });
  }
  const squadreScelte = Array.isArray(id_squadre) ? id_squadre.filter(Boolean) : [];
  if (!squadreScelte.length) {
    return res.status(400).json({ errore: 'Serve almeno una squadra per il giocatore.' });
  }

  // 1) Trovo l'id_persona collegato a questo giocatore.
  const { data: giocatoreEsistente, error: erroreLettura } = await supabase
    .from('giocatori')
    .select('id_persona')
    .eq('id', id)
    .single();

  if (erroreLettura || !giocatoreEsistente) {
    return res.status(404).json({ errore: 'Giocatore non trovato.' });
  }

  // 2) Aggiorno i dati anagrafici su "persona".
  const { error: errorePersona } = await supabase
    .from('persona')
    .update({
      nome: String(nome).trim(),
      cognome: String(cognome).trim(),
      email: String(email).trim(),
      data_nascita,
    })
    .eq('id', giocatoreEsistente.id_persona);

  if (errorePersona) {
    if (errorePersona.code === '23505') {
      return res.status(400).json({ errore: 'Esiste già una persona con questa email.' });
    }
    console.error('Errore nella modifica della persona:', errorePersona.message);
    return res.status(500).json({ errore: errorePersona.message });
  }

  // 3) Cerco il responsabile della PRIMA squadra scelta (come alla
  //    creazione), nel caso le squadre siano cambiate.
  const { data: responsabile, error: erroreResponsabile } = await supabase
    .from('responsabili')
    .select('id')
    .eq('id_squadra', squadreScelte[0])
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (erroreResponsabile) {
    console.error('Errore nella ricerca del responsabile della squadra:', erroreResponsabile.message);
  }

  // 4) Aggiorno i dati da giocatore. Se è un ripristino, tolgo anche
  //    l'archiviazione e segno da quando in poi contano i certificati:
  //    quelli caricati prima di questo momento restano nell'Archivio
  //    ma non vengono più considerati "attuali" (vedi GET
  //    /api/certificati, GET /api/certificati/archivio e il controllo
  //    in POST /api/certificati).
  const datiGiocatore = {
    id_responsabile: responsabile ? responsabile.id : null,
  };
  if (ripristina) {
    datiGiocatore.archiviato = false;
    datiGiocatore.certificati_azzerati_al = new Date().toISOString();
  }

  const { error: erroreGiocatore } = await supabase
    .from('giocatori')
    .update(datiGiocatore)
    .eq('id', id);

  if (erroreGiocatore) {
    console.error('Errore nella modifica del giocatore:', erroreGiocatore.message);
    return res.status(500).json({ errore: erroreGiocatore.message });
  }

  // 5) Aggiorno le squadre: tolgo tutti i collegamenti che aveva prima
  //    e rimetto quelli scelti adesso (più semplice e sicuro che capire
  //    quali aggiungere e quali togliere uno per uno).
  const { error: erroreRimuoviSquadre } = await supabase
    .from('giocatori_squadre')
    .delete()
    .eq('id_giocatore', id);

  if (erroreRimuoviSquadre) {
    console.error('Errore nell\'aggiornare le squadre del giocatore:', erroreRimuoviSquadre.message);
    return res.status(500).json({ errore: erroreRimuoviSquadre.message });
  }

  const { error: erroreAggiungiSquadre } = await supabase
    .from('giocatori_squadre')
    .insert(squadreScelte.map((idSquadra) => ({ id_giocatore: id, id_squadra: idSquadra })));

  if (erroreAggiungiSquadre) {
    console.error('Errore nell\'aggiornare le squadre del giocatore:', erroreAggiungiSquadre.message);
    return res.status(500).json({ errore: erroreAggiungiSquadre.message });
  }

  res.json({ ok: true });
});

// "Elimina" un giocatore: usato dal cestino sulla riga del giocatore
// nella pagina Squadre > Giocatori (solo Admin). Non lo toglie
// davvero dal database (così non si perde la sua storia di
// certificati): lo segna solo come "archiviato". Da quel momento
// sparisce dall'elenco Giocatori e dalla rosa della sua squadra, e
// tutti i suoi certificati compaiono tra gli "Archiviati" nella
// pagina Certificati medici > Archivio (vedi GET /api/certificati/archivio).
app.delete('/api/giocatori/:id', richiedeAdmin, async (req, res) => {
  const { id } = req.params;

  const { data: giocatore, error: erroreArchivia } = await supabase
    .from('giocatori')
    .update({ archiviato: true })
    .eq('id', id)
    .select('id')
    .single();

  if (erroreArchivia) {
    console.error('Errore nell\'archiviazione del giocatore:', erroreArchivia.message);
    return res.status(500).json({ errore: erroreArchivia.message });
  }
  if (!giocatore) {
    return res.status(404).json({ errore: 'Giocatore non trovato.' });
  }

  res.json({ ok: true });
});

// "Elimina DEFINITIVAMENTE" un giocatore già archiviato (pulsante nella
// sezione "Archiviati" della pagina Squadre > Giocatori, solo Admin).
// A differenza della normale eliminazione qui sopra (che lo archivia
// soltanto, senza perdere nulla), questa lo toglie per sempre dal
// database: la sua anagrafica (persona), i suoi certificati medici
// (comprese le foto nello spazio di archiviazione) e, se aveva un
// account per accedere al sito, anche quello. Non si può annullare:
// per questo si può usare solo su un giocatore già archiviato, mai su
// uno attivo (l'Admin deve prima "eliminarlo" nel modo normale, che lo
// sposta tra gli Archiviati, e solo da lì eliminarlo per sempre).
app.delete('/api/giocatori/:id/definitivo', richiedeAdmin, async (req, res) => {
  const { id } = req.params;

  const { data: giocatore, error: erroreLettura } = await supabase
    .from('giocatori')
    .select('id, id_persona, archiviato')
    .eq('id', id)
    .maybeSingle();

  if (erroreLettura) {
    console.error('Errore nella lettura del giocatore da eliminare definitivamente:', erroreLettura.message);
    return res.status(500).json({ errore: erroreLettura.message });
  }
  if (!giocatore) {
    return res.status(404).json({ errore: 'Giocatore non trovato.' });
  }
  if (!giocatore.archiviato) {
    return res.status(400).json({ errore: 'Si può eliminare definitivamente solo un giocatore già archiviato.' });
  }

  // 1) Scollego eventuali segnalazioni di certificati (pagina
  //    Certificati medici > Segnalazioni) che erano state collegate a
  //    questo giocatore: restano nello storico delle segnalazioni, ma
  //    non punteranno più a un giocatore e un certificato che stiamo
  //    per cancellare (altrimenti il database rifiuterebbe la
  //    cancellazione).
  const { error: erroreScollega } = await supabase
    .from('segnalazioni_certificati')
    .update({ id_giocatore_collegato: null, id_certificato_creato: null })
    .eq('id_giocatore_collegato', id);

  if (erroreScollega) {
    console.error('Errore nello scollegare le segnalazioni dal giocatore:', erroreScollega.message);
    return res.status(500).json({ errore: erroreScollega.message });
  }

  // 2) Tolgo dallo spazio di archiviazione le foto dei suoi certificati
  //    (altrimenti resterebbero lì per sempre, senza che nessuna riga
  //    del database le indichi più).
  const { data: certificati, error: erroreCertificati } = await supabase
    .from('certificati_medici')
    .select('foto_path')
    .eq('id_giocatore', id);

  if (erroreCertificati) {
    console.error('Errore nella lettura dei certificati da eliminare:', erroreCertificati.message);
    return res.status(500).json({ errore: erroreCertificati.message });
  }

  const percorsiFoto = (certificati || []).map((c) => c.foto_path).filter(Boolean);
  if (percorsiFoto.length) {
    const { error: erroreRimozioneFoto } = await supabase.storage.from(BUCKET_CERTIFICATI).remove(percorsiFoto);
    if (erroreRimozioneFoto) {
      // Non blocco l'eliminazione per questo: meglio una foto rimasta
      // per sbaglio nello spazio di archiviazione che un giocatore che
      // poi non si riesce più a togliere dal database.
      console.error('Errore nella rimozione delle foto dei certificati:', erroreRimozioneFoto.message);
    }
  }

  // 3) Tolgo i suoi certificati medici dal database.
  const { error: erroreEliminaCertificati } = await supabase
    .from('certificati_medici')
    .delete()
    .eq('id_giocatore', id);

  if (erroreEliminaCertificati) {
    console.error('Errore nell\'eliminazione dei certificati:', erroreEliminaCertificati.message);
    return res.status(500).json({ errore: erroreEliminaCertificati.message });
  }

  // 4) Tolgo il giocatore.
  const { error: erroreEliminaGiocatore } = await supabase
    .from('giocatori')
    .delete()
    .eq('id', id);

  if (erroreEliminaGiocatore) {
    console.error('Errore nell\'eliminazione del giocatore:', erroreEliminaGiocatore.message);
    return res.status(500).json({ errore: erroreEliminaGiocatore.message });
  }

  // 5) Tolgo anche la sua anagrafica (persona) e, se aveva un account
  //    per accedere al sito, anche quello: da questo momento non potrà
  //    più accedere con quell'email e password.
  if (giocatore.id_persona) {
    const { data: persona, error: errorePersona } = await supabase
      .from('persona')
      .select('id_account')
      .eq('id', giocatore.id_persona)
      .maybeSingle();

    if (errorePersona) {
      console.error('Errore nella lettura dell\'anagrafica da eliminare:', errorePersona.message);
    } else {
      const { error: erroreEliminaPersona } = await supabase
        .from('persona')
        .delete()
        .eq('id', giocatore.id_persona);
      if (erroreEliminaPersona) {
        console.error('Errore nell\'eliminazione dell\'anagrafica:', erroreEliminaPersona.message);
      }
      if (persona && persona.id_account) {
        const { error: erroreEliminaAccount } = await supabase.auth.admin.deleteUser(persona.id_account);
        if (erroreEliminaAccount) {
          console.error('Errore nell\'eliminazione dell\'account di accesso:', erroreEliminaAccount.message);
        }
      }
    }
  }

  res.json({ ok: true });
});

// Quanti giorni mancano alla scadenza del certificato "attuale" di un
// giocatore (negativo se è già scaduto): usato per ordinare l'elenco
// di "Approvazione" per urgenza (vedi sotto). Chi non ha nessun
// certificato attuale è il caso più urgente di tutti.
function giorniAllaScadenza(persona, oggi) {
  if (!persona.corrente || !persona.corrente.data_scadenza) return -Infinity;
  const scadenza = new Date(persona.corrente.data_scadenza + 'T00:00:00');
  if (isNaN(scadenza.getTime())) return -Infinity;
  return Math.round((scadenza - oggi) / (1000 * 60 * 60 * 24));
}

// Elenco dei certificati medici, uno per ogni giocatore: usato dalla
// pagina "Approvazione". Si parte sempre dall'elenco completo dei
// giocatori (non dai certificati caricati) così un giocatore resta in
// elenco anche se non ha ancora caricato nulla, o se il suo unico
// certificato è stato scartato: in quel caso lo show con "In attesa".
// Un giocatore può avere fino a due certificati contemporaneamente:
// quello "corrente" (l'ultimo approvato) e uno "nuovo" (l'ultimo
// caricato, in attesa di essere approvato o scartato) — qui li teniamo
// separati così il sito può mostrarli affiancati. L'elenco è ordinato
// per urgenza (in base alla scadenza): chi ha il certificato più
// scaduto (o non ne ha nessuno) sta più in alto, chi ha più tempo
// prima della scadenza sta più in basso.
app.get('/api/certificati', async (req, res) => {
  const { data, error } = await supabase
    .from('giocatori')
    .select(
      'id, certificati_azzerati_al, persona(nome, cognome), certificati_medici(id, stato, data_caricamento, data_approvazione, data_rilascio, data_scadenza, nota)'
    )
    .eq('archiviato', false);

  if (error) {
    console.error('Errore nella query a Supabase (certificati):', error.message);
    return res.status(500).json({ errore: error.message });
  }

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  const risultato = (data || [])
    .map((g) => {
      // Se il giocatore è stato ripristinato dopo essere stato
      // archiviato, i certificati caricati PRIMA del ripristino non
      // contano più come "attuali" o "in attesa": restano visibili solo
      // nell'Archivio. Deve caricarne uno nuovo da zero.
      const certificati = (g.certificati_medici || []).filter(
        (c) => !g.certificati_azzerati_al || new Date(c.data_caricamento) > new Date(g.certificati_azzerati_al)
      );

      const approvati = certificati
        .filter((c) => c.stato === 'approvato')
        .sort((a, b) => new Date(b.data_approvazione || 0) - new Date(a.data_approvazione || 0));
      const corrente = approvati[0] || null;

      // Solo "attesa": un certificato scartato dopo essere stato
      // approvato (stato 'scartato', vedi POST /api/certificati/:id/revoca)
      // non deve ricomparire qui come se fosse un nuovo caricamento da
      // valutare.
      const inAttesa = certificati
        .filter((c) => c.stato === 'attesa')
        .sort((a, b) => new Date(b.data_caricamento) - new Date(a.data_caricamento));
      const nuovo = inAttesa[0] || null;

      return {
        giocatore: {
          id: g.id,
          nome: g.persona ? g.persona.nome : '',
          cognome: g.persona ? g.persona.cognome : '',
        },
        corrente,
        nuovo,
      };
    })
    .sort((a, b) => {
      // Confronto diretto (non per sottrazione): due giocatori senza
      // nessun certificato hanno entrambi -Infinity, e -Infinity meno
      // -Infinity darebbe un risultato non valido (NaN).
      const ga = giorniAllaScadenza(a, oggi);
      const gb = giorniAllaScadenza(b, oggi);
      if (ga !== gb) return ga < gb ? -1 : 1;
      return a.giocatore.cognome.localeCompare(b.giocatore.cognome);
    });

  res.json(risultato);
});

// Elenco "grezzo" di TUTTI i certificati mai caricati, uno per riga
// (non raggruppati per giocatore come in GET /api/certificati): usato
// dalla pagina "Archivio", che a differenza di "Approvazione" mostra
// la storia completa di ogni giocatore, compresi i certificati vecchi
// e già sostituiti da uno più recente.
app.get('/api/certificati/archivio', async (req, res) => {
  const { data, error } = await supabase
    .from('certificati_medici')
    .select(
      'id, id_giocatore, stato, data_caricamento, data_approvazione, data_rilascio, data_scadenza, nota, motivo_scarto, data_scarto, giocatori(persona(nome, cognome), archiviato, certificati_azzerati_al)'
    )
    .order('data_caricamento', { ascending: false });

  if (error) {
    console.error('Errore nella query a Supabase (archivio certificati):', error.message);
    return res.status(500).json({ errore: error.message });
  }

  const risultato = (data || []).map((c) => {
    const azzeratoAl = c.giocatori ? c.giocatori.certificati_azzerati_al : null;
    return {
      id: c.id,
      id_giocatore: c.id_giocatore,
      nome: c.giocatori && c.giocatori.persona ? c.giocatori.persona.nome : '',
      cognome: c.giocatori && c.giocatori.persona ? c.giocatori.persona.cognome : '',
      stato: c.stato,
      data_caricamento: c.data_caricamento,
      data_approvazione: c.data_approvazione,
      data_rilascio: c.data_rilascio,
      data_scadenza: c.data_scadenza,
      nota: c.nota,
      motivo_scarto: c.motivo_scarto,
      data_scarto: c.data_scarto,
      // Se il giocatore è stato archiviato (eliminato dall'elenco
      // Giocatori), anche tutti i suoi certificati finiscono tra gli
      // "Archiviati", qualsiasi sia il loro stato.
      giocatore_archiviato: !!(c.giocatori && c.giocatori.archiviato),
      // Se il giocatore è stato RIPRISTINATO dopo essere stato
      // archiviato, i certificati caricati prima di quel momento
      // restano per sempre tra gli "Archiviati" (anche se il giocatore
      // ora è di nuovo attivo): da lì in poi contano solo quelli nuovi.
      precedente_al_ripristino: !!(azzeratoAl && new Date(c.data_caricamento) <= new Date(azzeratoAl)),
    };
  });

  res.json(risultato);
});

// Carica (o sostituisce, se ne aveva già uno) il certificato di un
// giocatore. La foto arriva come testo codificato in base64 dentro il
// corpo della richiesta (niente librerie in più lato server): viene
// salvata nello Storage di Supabase, e nel database resta solo il suo
// percorso, non la foto stessa.
app.post('/api/certificati', async (req, res) => {
  let { id_giocatore, foto_base64, foto_mime, data_rilascio, nota } = req.body || {};

  // Un Giocatore può caricare un certificato solo per sé stesso: qui
  // ignoriamo del tutto quello che arriva dal sito e usiamo sempre e
  // solo l'id del giocatore a cui è collegato il suo account (letto
  // dal server in richiedeAccesso, non modificabile dal browser), così
  // non può in nessun modo far risultare un certificato a nome di un
  // altro giocatore. Vale solo per il ruolo Giocatore: l'Admin può
  // ancora scegliere il giocatore per cui carica.
  if (req.utente.ruolo === 'giocatore') {
    if (!req.utente.idGiocatore) {
      return res.status(403).json({ errore: 'Il Suo account non è collegato a nessun giocatore: non può caricare certificati. Contatti l\'Admin.' });
    }
    id_giocatore = req.utente.idGiocatore;
  }

  if (!id_giocatore || !foto_base64 || !data_rilascio) {
    return res.status(400).json({ errore: 'Servono id_giocatore, foto_base64 e data_rilascio.' });
  }

  const erroreFoto = erroreFotoCertificato(foto_base64, foto_mime);
  if (erroreFoto) {
    return res.status(400).json({ errore: erroreFoto });
  }

  // La scadenza non la scrive l'admin: si calcola da sola, un anno
  // esatto dopo la data di rilascio (come i certificati agonistici).
  const rilascio = new Date(data_rilascio + 'T00:00:00');
  if (isNaN(rilascio.getTime())) {
    return res.status(400).json({ errore: 'Data di rilascio non valida.' });
  }
  const scadenza = new Date(rilascio);
  scadenza.setFullYear(scadenza.getFullYear() + 1);
  const data_scadenza = scadenza.toISOString().slice(0, 10);

  // La data di rilascio non può essere nel futuro (un certificato non
  // può avere una data che deve ancora arrivare), e non può essere così
  // vecchia che il certificato risulterebbe già scaduto oggi: in
  // entrambi i casi probabilmente è stata scritta la data sbagliata.
  // Lo stesso controllo lo fa anche il modulo sul sito prima di
  // inviare (vedi erroreDataRilascio in index.html), ma quello che
  // conta davvero è questo, fatto dal server.
  const oggiControllo = new Date();
  oggiControllo.setHours(0, 0, 0, 0);
  if (rilascio > oggiControllo) {
    return res.status(400).json({
      errore: 'La data di rilascio scritta (' + data_rilascio + ') è nel futuro: non può essere successiva a oggi.',
    });
  }
  if (scadenza < oggiControllo) {
    return res.status(400).json({
      errore:
        'Con la data di rilascio scritta (' +
        data_rilascio +
        ') il certificato risulterebbe già scaduto dal ' +
        data_scadenza +
        ' (la scadenza si calcola sempre un anno dopo la data di rilascio): controlli di aver scritto la data giusta.',
    });
  }

  // Se questo giocatore è stato archiviato e poi ripristinato, i suoi
  // certificati caricati PRIMA del ripristino non contano più: per lui
  // è come se ripartisse da zero (vedi anche GET /api/certificati e GET
  // /api/certificati/archivio).
  const { data: giocatoreRiga, error: erroreGiocatoreRiga } = await supabase
    .from('giocatori')
    .select('certificati_azzerati_al')
    .eq('id', id_giocatore)
    .single();

  if (erroreGiocatoreRiga) {
    console.error('Errore nella lettura del giocatore:', erroreGiocatoreRiga.message);
    return res.status(500).json({ errore: erroreGiocatoreRiga.message });
  }

  const azzeratoAl = giocatoreRiga && giocatoreRiga.certificati_azzerati_al;

  // Si può caricare un nuovo certificato solo se quello attuale del
  // giocatore (l'ultimo approvato) è già scaduto, o sta per scadere
  // (entro due mesi — la stessa soglia del pallino arancione "in
  // scadenza"), oppure se non ne ha ancora uno: altrimenti la
  // richiesta viene rifiutata.
  let queryApprovati = supabase
    .from('certificati_medici')
    .select('data_scadenza, data_approvazione, data_rilascio')
    .eq('id_giocatore', id_giocatore)
    .eq('stato', 'approvato');
  if (azzeratoAl) queryApprovati = queryApprovati.gt('data_caricamento', azzeratoAl);
  const { data: approvati, error: erroreCorrente } = await queryApprovati
    .order('data_approvazione', { ascending: false })
    .limit(1);

  if (erroreCorrente) {
    console.error('Errore nel controllo del certificato attuale:', erroreCorrente.message);
    return res.status(500).json({ errore: erroreCorrente.message });
  }

  const corrente = approvati && approvati[0];

  // Si può caricare un nuovo certificato solo se quello attuale del
  // giocatore sta per scadere (entro due mesi) o è già scaduto.
  // Consideriamo "non ancora il momento" anche quando la data scritta
  // per il nuovo certificato è precedente a quella del certificato
  // attuale: in pratica vuol dire lo stesso, cioè che il certificato
  // attuale è ancora valido. In entrambi i casi mostriamo lo stesso
  // messaggio, invece di due messaggi diversi per la stessa situazione.
  if (corrente && corrente.data_rilascio && corrente.data_scadenza) {
    const rilascioCorrente = new Date(corrente.data_rilascio + 'T00:00:00');
    const scadenzaCorrente = new Date(corrente.data_scadenza + 'T00:00:00');
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const fraDueMesi = new Date(oggi);
    fraDueMesi.setMonth(fraDueMesi.getMonth() + 2);

    const dataPrecedente = !isNaN(rilascioCorrente.getTime()) && rilascio < rilascioCorrente;
    const ancoraValidoALungo = scadenzaCorrente > fraDueMesi;

    if (dataPrecedente || ancoraValidoALungo) {
      return res.status(400).json({
        errore:
          'Questo giocatore ha già un certificato valido, rilasciato il ' +
          corrente.data_rilascio +
          ' (scade il ' +
          corrente.data_scadenza +
          '), e non è ancora vicino alla scadenza: non se ne può caricare un altro adesso.',
      });
    }
  }

  // Se questo giocatore ha già un certificato "in attesa" (caricato in
  // precedenza e non ancora valutato dall'Admin), non se ne può
  // caricare un altro: bisogna aspettare che quello venga approvato o
  // scartato prima di inviarne uno nuovo.
  let queryInAttesa = supabase
    .from('certificati_medici')
    .select('id')
    .eq('id_giocatore', id_giocatore)
    .eq('stato', 'attesa');
  if (azzeratoAl) queryInAttesa = queryInAttesa.gt('data_caricamento', azzeratoAl);
  const { data: giaInAttesa, error: erroreInAttesa } = await queryInAttesa.limit(1);

  if (erroreInAttesa) {
    console.error('Errore nel controllo del certificato in attesa:', erroreInAttesa.message);
    return res.status(500).json({ errore: erroreInAttesa.message });
  }

  if (giaInAttesa && giaInAttesa.length) {
    return res.status(400).json({
      errore: 'C\'è già un certificato in attesa di essere valutato: bisogna aspettare che l\'Admin lo approvi o lo scarti prima di caricarne un altro.',
    });
  }

  const estensione = (foto_mime && foto_mime.split('/')[1]) || 'jpg';
  const percorso = 'giocatore-' + id_giocatore + '/' + Date.now() + '.' + estensione;
  const buffer = Buffer.from(foto_base64, 'base64');

  const { error: erroreCaricamento } = await supabase.storage
    .from(BUCKET_CERTIFICATI)
    .upload(percorso, buffer, { contentType: foto_mime || 'image/jpeg', upsert: true });

  if (erroreCaricamento) {
    console.error('Errore nel caricamento della foto:', erroreCaricamento.message);
    return res.status(500).json({ errore: erroreCaricamento.message });
  }

  const { data, error } = await supabase
    .from('certificati_medici')
    .insert({
      id_giocatore,
      stato: 'attesa',
      foto_path: percorso,
      data_caricamento: new Date().toISOString(),
      data_approvazione: null,
      data_rilascio,
      data_scadenza,
      nota: nota || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Errore nel salvataggio del certificato:', error.message);
    return res.status(500).json({ errore: error.message });
  }

  // Da qui in poi il certificato è già salvato: rispondiamo subito al
  // sito, SENZA aspettare che l'email di verifica all'Admin sia
  // partita. Prima la aspettavamo prima di rispondere: se l'invio
  // dell'email era lento, o si bloccava (per esempio per un problema
  // di rete verso Resend), il sito a volte mostrava un errore di
  // caricamento anche se il certificato era stato salvato
  // regolarmente — lasciando un certificato "fantasma" in attesa, che
  // poi bloccava un nuovo caricamento per lo stesso giocatore ("c'è
  // già un certificato in attesa"). L'email continua a partire come
  // prima, solo senza far aspettare la risposta al sito.
  res.json(data);

  supabase
    .from('giocatori')
    .select('persona(nome, cognome), giocatori_squadre(squadre(nome))')
    .eq('id', id_giocatore)
    .single()
    .then(function (risultato) {
      const giocatoreInfo = risultato.data;
      // Un giocatore può appartenere a più squadre: le mettiamo tutte
      // nell'email, separate da virgola.
      const nomiSquadre = giocatoreInfo && giocatoreInfo.giocatori_squadre
        ? giocatoreInfo.giocatori_squadre.map((collegamento) => collegamento.squadre && collegamento.squadre.nome).filter(Boolean)
        : [];
      return inviaEmailVerificaAdmin({
        trovato: true,
        nome: giocatoreInfo && giocatoreInfo.persona ? giocatoreInfo.persona.nome : '',
        cognome: giocatoreInfo && giocatoreInfo.persona ? giocatoreInfo.persona.cognome : '',
        squadra: nomiSquadre.join(', '),
        dataRilascio: data_rilascio,
        nota: nota,
      });
    })
    .catch(function (erroreEmail) {
      console.error('Errore imprevisto nell\'email di verifica Admin:', erroreEmail.message);
    });
});

// Quando chi entra come Giocatore scrive, in "Carica certificato", un
// nome che non corrisponde a nessun giocatore vero nel database, il
// certificato non può essere collegato subito a nessuno. Questa rotta
// salva comunque la segnalazione (foto compresa) nella tabella
// "segnalazioni_certificati", così l'Admin la può gestire dalla pagina
// Certificati medici > Segnalazioni del sito (vedere la foto,
// collegarla a un giocatore vero o scartarla), e manda comunque anche
// un'email di verifica con la foto allegata, per chi preferisce
// controllare dalla posta.
app.post('/api/certificati/segnalazione', async (req, res) => {
  const { nome, cognome, foto_base64, foto_mime, data_rilascio, nota } = req.body || {};

  if (!nome || !cognome || !foto_base64 || !data_rilascio) {
    return res.status(400).json({ errore: 'Servono nome, cognome, foto_base64 e data_rilascio.' });
  }

  const erroreFoto = erroreFotoCertificato(foto_base64, foto_mime);
  if (erroreFoto) {
    return res.status(400).json({ errore: erroreFoto });
  }

  // Stesso controllo sulla data di rilascio di POST /api/certificati
  // (non nel futuro, non così vecchia da risultare già scaduta): vale
  // anche qui, anche se questo caricamento non finisce nel database,
  // per non far perdere tempo all'Admin con una data scritta male.
  const rilascioSegnalato = new Date(data_rilascio + 'T00:00:00');
  if (isNaN(rilascioSegnalato.getTime())) {
    return res.status(400).json({ errore: 'Data di rilascio non valida.' });
  }
  const oggiSegnalato = new Date();
  oggiSegnalato.setHours(0, 0, 0, 0);
  if (rilascioSegnalato > oggiSegnalato) {
    return res.status(400).json({
      errore: 'La data di rilascio scritta (' + data_rilascio + ') è nel futuro: non può essere successiva a oggi.',
    });
  }
  const scadenzaSegnalata = new Date(rilascioSegnalato);
  scadenzaSegnalata.setFullYear(scadenzaSegnalata.getFullYear() + 1);
  if (scadenzaSegnalata < oggiSegnalato) {
    return res.status(400).json({
      errore:
        'Con la data di rilascio scritta (' +
        data_rilascio +
        ') il certificato risulterebbe già scaduto: controlli di aver scritto la data giusta.',
    });
  }

  // Salva la foto nello Storage, nella stessa "cartella" dei
  // certificati veri ma sotto "segnalazioni/", visto che per ora non è
  // collegata a nessun giocatore.
  const estensioneSegnalazione = (foto_mime && foto_mime.split('/')[1]) || 'jpg';
  const percorsoSegnalazione =
    'segnalazioni/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + estensioneSegnalazione;
  const bufferSegnalazione = Buffer.from(foto_base64, 'base64');

  const { error: erroreCaricamentoSegnalazione } = await supabase.storage
    .from(BUCKET_CERTIFICATI)
    .upload(percorsoSegnalazione, bufferSegnalazione, { contentType: foto_mime || 'image/jpeg', upsert: true });

  if (erroreCaricamentoSegnalazione) {
    console.error('Errore nel caricamento della foto della segnalazione:', erroreCaricamentoSegnalazione.message);
    return res.status(500).json({ errore: erroreCaricamentoSegnalazione.message });
  }

  // La salviamo anche nel database, così l'Admin la può gestire dalla
  // pagina Certificati medici > Segnalazioni del sito e non solo
  // dall'email (vedi GET/POST /api/segnalazioni più sotto). Se il
  // salvataggio fallisce, mandiamo comunque l'email: meglio avvisare
  // l'Admin in qualche modo che non avvisarlo affatto.
  const { data: segnalazione, error: erroreSalvataggioSegnalazione } = await supabase
    .from('segnalazioni_certificati')
    .insert({
      nome,
      cognome,
      data_rilascio,
      nota: nota || null,
      foto_path: percorsoSegnalazione,
    })
    .select()
    .single();

  if (erroreSalvataggioSegnalazione) {
    console.error('Errore nel salvataggio della segnalazione:', erroreSalvataggioSegnalazione.message);
  }

  // Rispondiamo subito (la segnalazione, se il salvataggio sopra è
  // riuscito, è già salvata): l'email di verifica all'Admin parte
  // comunque, ma in background, senza far aspettare la risposta —
  // stesso motivo di POST /api/certificati qui sopra.
  res.json({ segnalazione: segnalazione || null });

  inviaEmailVerificaAdmin({
    trovato: false,
    nome,
    cognome,
    dataRilascio: data_rilascio,
    nota,
    fotoBase64: foto_base64,
    fotoMime: foto_mime,
  }).catch(function (erroreEmail) {
    console.error('Errore imprevisto nell\'email di verifica della segnalazione:', erroreEmail.message);
  });
});

// Elenco di tutte le segnalazioni ricevute finora (certificati
// caricati con un nome non riconosciuto), più recenti prima: usato
// dalla pagina Certificati medici > Segnalazioni, sia per la parte
// "Da gestire" (filtrata lato sito sulle sole "in_attesa") sia per lo
// storico completo.
app.get('/api/segnalazioni', richiedeAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('segnalazioni_certificati')
    .select('id, nome, cognome, data_rilascio, nota, stato, creato_il, gestito_il, id_giocatore_collegato, id_certificato_creato')
    .order('creato_il', { ascending: false });

  if (error) {
    console.error('Errore nella query a Supabase (segnalazioni):', error.message);
    return res.status(500).json({ errore: error.message });
  }

  res.json(data);
});

// Link temporaneo (5 minuti) per vedere la foto allegata a una
// segnalazione: stesso meccanismo di GET /api/certificati/:id/foto.
app.get('/api/segnalazioni/:id/foto', richiedeAdmin, async (req, res) => {
  const { id } = req.params;

  const { data: segnalazione, error: erroreLettura } = await supabase
    .from('segnalazioni_certificati')
    .select('foto_path')
    .eq('id', id)
    .single();

  if (erroreLettura || !segnalazione || !segnalazione.foto_path) {
    return res.status(404).json({ errore: 'Foto non trovata.' });
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_CERTIFICATI)
    .createSignedUrl(segnalazione.foto_path, 300);

  if (error) {
    console.error('Errore nella creazione del link alla foto:', error.message);
    return res.status(500).json({ errore: error.message });
  }

  res.json({ url: data.signedUrl });
});

// Collega una segnalazione a un giocatore vero: crea un certificato
// "in attesa" per lui, con la stessa foto, data di rilascio e nota già
// segnalate, così finisce nella normale coda di approvazione
// (Certificati medici > Gestione), esattamente come se il giocatore
// l'avesse caricato lui stesso col suo nome scritto giusto. Rifà gli
// stessi controlli di POST /api/certificati (certificato attuale del
// giocatore, eventuale certificato già in attesa): la data di rilascio
// invece non la ricontrolliamo, perché è già stata controllata quando
// la segnalazione è stata creata.
app.post('/api/segnalazioni/:id/collega', richiedeAdmin, async (req, res) => {
  const { id } = req.params;
  const { id_giocatore } = req.body || {};

  if (!id_giocatore) {
    return res.status(400).json({ errore: 'Serve id_giocatore.' });
  }

  const { data: segnalazione, error: erroreLettura } = await supabase
    .from('segnalazioni_certificati')
    .select('*')
    .eq('id', id)
    .single();

  if (erroreLettura || !segnalazione) {
    return res.status(404).json({ errore: 'Segnalazione non trovata.' });
  }
  if (segnalazione.stato !== 'in_attesa') {
    return res.status(400).json({ errore: 'Questa segnalazione è già stata gestita.' });
  }

  const { data: giocatoreRiga, error: erroreGiocatoreRiga } = await supabase
    .from('giocatori')
    .select('certificati_azzerati_al')
    .eq('id', id_giocatore)
    .single();

  if (erroreGiocatoreRiga) {
    console.error('Errore nella lettura del giocatore:', erroreGiocatoreRiga.message);
    return res.status(500).json({ errore: erroreGiocatoreRiga.message });
  }

  const azzeratoAl = giocatoreRiga && giocatoreRiga.certificati_azzerati_al;
  const rilascio = new Date(segnalazione.data_rilascio + 'T00:00:00');
  const scadenza = new Date(rilascio);
  scadenza.setFullYear(scadenza.getFullYear() + 1);
  const data_scadenza = scadenza.toISOString().slice(0, 10);

  let queryApprovati = supabase
    .from('certificati_medici')
    .select('data_scadenza, data_approvazione, data_rilascio')
    .eq('id_giocatore', id_giocatore)
    .eq('stato', 'approvato');
  if (azzeratoAl) queryApprovati = queryApprovati.gt('data_caricamento', azzeratoAl);
  const { data: approvati, error: erroreCorrente } = await queryApprovati
    .order('data_approvazione', { ascending: false })
    .limit(1);

  if (erroreCorrente) {
    console.error('Errore nel controllo del certificato attuale:', erroreCorrente.message);
    return res.status(500).json({ errore: erroreCorrente.message });
  }

  const corrente = approvati && approvati[0];

  // Stesso controllo di POST /api/certificati: non si può collegare un
  // nuovo certificato se quello attuale del giocatore non è ancora
  // vicino alla scadenza (o se la data della segnalazione è precedente
  // a quella del certificato attuale, il che vuol dire la stessa cosa).
  if (corrente && corrente.data_rilascio && corrente.data_scadenza) {
    const rilascioCorrente = new Date(corrente.data_rilascio + 'T00:00:00');
    const scadenzaCorrente = new Date(corrente.data_scadenza + 'T00:00:00');
    const oggiControlloCollega = new Date();
    oggiControlloCollega.setHours(0, 0, 0, 0);
    const fraDueMesiCollega = new Date(oggiControlloCollega);
    fraDueMesiCollega.setMonth(fraDueMesiCollega.getMonth() + 2);

    const dataPrecedente = !isNaN(rilascioCorrente.getTime()) && rilascio < rilascioCorrente;
    const ancoraValidoALungo = scadenzaCorrente > fraDueMesiCollega;

    if (dataPrecedente || ancoraValidoALungo) {
      return res.status(400).json({
        errore:
          'Questo giocatore ha già un certificato valido, rilasciato il ' +
          corrente.data_rilascio +
          ' (scade il ' +
          corrente.data_scadenza +
          '), e non è ancora vicino alla scadenza: non se ne può collegare un altro adesso.',
      });
    }
  }

  let queryInAttesa = supabase
    .from('certificati_medici')
    .select('id')
    .eq('id_giocatore', id_giocatore)
    .eq('stato', 'attesa');
  if (azzeratoAl) queryInAttesa = queryInAttesa.gt('data_caricamento', azzeratoAl);
  const { data: giaInAttesa, error: erroreInAttesa } = await queryInAttesa.limit(1);

  if (erroreInAttesa) {
    console.error('Errore nel controllo del certificato in attesa:', erroreInAttesa.message);
    return res.status(500).json({ errore: erroreInAttesa.message });
  }

  if (giaInAttesa && giaInAttesa.length) {
    return res.status(400).json({
      errore: 'Questo giocatore ha già un certificato in attesa di essere valutato: bisogna approvarlo o scartarlo prima di collegarne un altro.',
    });
  }

  const { data: nuovoCertificato, error: erroreInserimento } = await supabase
    .from('certificati_medici')
    .insert({
      id_giocatore,
      stato: 'attesa',
      foto_path: segnalazione.foto_path,
      data_caricamento: new Date().toISOString(),
      data_approvazione: null,
      data_rilascio: segnalazione.data_rilascio,
      data_scadenza,
      nota: segnalazione.nota,
    })
    .select()
    .single();

  if (erroreInserimento) {
    console.error('Errore nella creazione del certificato dalla segnalazione:', erroreInserimento.message);
    return res.status(500).json({ errore: erroreInserimento.message });
  }

  const { error: erroreAggiornamento } = await supabase
    .from('segnalazioni_certificati')
    .update({
      stato: 'collegata',
      id_giocatore_collegato: id_giocatore,
      id_certificato_creato: nuovoCertificato.id,
      gestito_il: new Date().toISOString(),
    })
    .eq('id', id);

  if (erroreAggiornamento) {
    console.error('Errore nell\'aggiornamento della segnalazione:', erroreAggiornamento.message);
  }

  // Avvisa il giocatore che il certificato caricato con un nome non
  // riconosciuto è stato trovato e collegato a lui: altrimenti non
  // avrebbe altro modo di saperlo (vedi anche il tipo "collegato" in
  // registraNotifica più sopra).
  await registraNotifica(nuovoCertificato, 'collegato');

  res.json({ certificato: nuovoCertificato });
});

// Scarta una segnalazione: resta nello storico (per questo non viene
// eliminata dal database, a differenza di un certificato vero
// scartato), ma sparisce dall'elenco "Da gestire".
app.post('/api/segnalazioni/:id/scarta', richiedeAdmin, async (req, res) => {
  const { id } = req.params;

  const { data: segnalazione, error: erroreLettura } = await supabase
    .from('segnalazioni_certificati')
    .select('id, stato')
    .eq('id', id)
    .single();

  if (erroreLettura || !segnalazione) {
    return res.status(404).json({ errore: 'Segnalazione non trovata.' });
  }
  if (segnalazione.stato !== 'in_attesa') {
    return res.status(400).json({ errore: 'Questa segnalazione è già stata gestita.' });
  }

  const { error } = await supabase
    .from('segnalazioni_certificati')
    .update({ stato: 'scartata', gestito_il: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Errore nello scarto della segnalazione:', error.message);
    return res.status(500).json({ errore: error.message });
  }

  res.json({ ok: true });
});

// ---------- invio email vere (tramite Gmail, con una casella Gmail) ----------

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
// Indirizzo dell'Admin, usato per le email di verifica quando viene
// caricato un nuovo certificato (vedi inviaEmailVerificaAdmin più sotto).
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

// Il "trasportatore" che manda davvero le email, tramite il server SMTP
// di Gmail. Viene creato una sola volta e riusato per ogni invio. Se
// mancano GMAIL_USER o GMAIL_APP_PASSWORD nel file .env resta "null":
// inviaEmail se ne accorge e non fa nulla (vedi sotto), senza far
// bloccare il resto del sito.
const trasportatoreEmail = (GMAIL_USER && GMAIL_APP_PASSWORD)
  ? nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    })
  : null;

// Manda un'email vera tramite Gmail. Se non sono state messe le
// credenziali nel file .env (GMAIL_USER e GMAIL_APP_PASSWORD), non fa
// nulla e lo dice soltanto nel registro del server: il sito continua a
// funzionare esattamente come prima, semplicemente senza mandare
// email, finché non viene collegata una casella Gmail.
//
// A differenza di un servizio come Resend senza dominio verificato,
// Gmail non ha restrizioni su chi può ricevere le email: arrivano a
// qualsiasi indirizzo reale il giocatore o l'Admin indichi.
//
// allegati (facoltativo): un elenco di { filename, content } dove
// "content" è il file in base64 (senza il prefisso "data:..."), per
// esempio la foto di un certificato non collegato a nessun giocatore
// vero (vedi inviaEmailVerificaAdmin).
async function inviaEmail(destinatario, oggetto, corpoHtml, allegati) {
  if (!trasportatoreEmail) {
    console.log('(Email non inviata: mancano GMAIL_USER e/o GMAIL_APP_PASSWORD nel file .env)');
    return { inviata: false, motivo: 'GMAIL_USER / GMAIL_APP_PASSWORD non configurati' };
  }
  if (!destinatario) {
    return { inviata: false, motivo: 'Indirizzo email mancante' };
  }

  try {
    const messaggio = {
      from: GMAIL_USER,
      to: destinatario,
      subject: oggetto,
      html: corpoHtml,
    };
    if (allegati && allegati.length) {
      messaggio.attachments = allegati.map(function (allegato) {
        return {
          filename: allegato.filename,
          content: allegato.content,
          encoding: 'base64',
        };
      });
    }

    await trasportatoreEmail.sendMail(messaggio);

    return { inviata: true };
  } catch (erroreInatteso) {
    console.error('Errore imprevisto nell\'invio dell\'email:', erroreInatteso.message);
    return { inviata: false, motivo: erroreInatteso.message };
  }
}

// Manda all'Admin (ADMIN_EMAIL nel file .env) un'email di verifica ogni
// volta che arriva un nuovo certificato medico, sia che il nome
// corrisponda a un giocatore vero del database (dettagli.trovato:
// true — il certificato è già salvato e visibile in "Gestione"), sia
// che non corrisponda a nessuno (dettagli.trovato: false — non viene
// salvato nulla nel database: questa email, con la foto allegata,
// resta l'unica traccia di quel caricamento). Non blocca mai la
// richiesta principale se l'invio fallisce o se ADMIN_EMAIL non è
// configurata nel file .env.
async function inviaEmailVerificaAdmin(dettagli) {
  const nome = dettagli.nome || '';
  const cognome = dettagli.cognome || '';

  let oggetto;
  let corpoHtml;
  if (dettagli.trovato) {
    oggetto = 'Nuovo certificato medico da verificare — ' + cognome + ' ' + nome;
    corpoHtml =
      '<p>&Egrave; stato caricato un nuovo certificato medico per <strong>' + cognome + ' ' + nome + '</strong>' +
      (dettagli.squadra ? ' (' + dettagli.squadra + ')' : '') + '.</p>' +
      '<p>Data di rilascio dichiarata: ' + (dettagli.dataRilascio || '&mdash;') + '.</p>' +
      (dettagli.nota ? '<p>Nota lasciata da chi ha caricato: ' + dettagli.nota + '</p>' : '') +
      '<p>Apra la sezione Gestione del sito per controllarlo e approvarlo o scartarlo.</p>';
  } else {
    oggetto = 'Certificato caricato per un nome non riconosciuto — ' + cognome + ' ' + nome;
    corpoHtml =
      '<p>Qualcuno ha provato a caricare un certificato medico indicando il nome <strong>' + cognome + ' ' + nome + '</strong>, ma non risulta nessun giocatore con questo nome nel database.</p>' +
      '<p>Data di rilascio dichiarata: ' + (dettagli.dataRilascio || '&mdash;') + '.</p>' +
      (dettagli.nota ? '<p>Nota lasciata da chi ha caricato: ' + dettagli.nota + '</p>' : '') +
      '<p>In allegato trova la foto del certificato: controlli di chi si tratta (magari il nome &egrave; scritto in modo diverso, oppure &egrave; un nuovo giocatore da aggiungere) prima di decidere come procedere. Questo caricamento non &egrave; stato salvato nel sito.</p>';
  }

  let allegati;
  if (!dettagli.trovato && dettagli.fotoBase64) {
    const estensione = (dettagli.fotoMime && dettagli.fotoMime.split('/')[1]) || 'jpg';
    allegati = [{ filename: 'certificato.' + estensione, content: dettagli.fotoBase64 }];
  }

  if (!ADMIN_EMAIL) {
    console.log('(Email di verifica Admin non inviata: manca ADMIN_EMAIL nel file .env)');
    return { inviata: false, motivo: 'ADMIN_EMAIL non configurata' };
  }

  const esito = await inviaEmail(ADMIN_EMAIL, oggetto, corpoHtml, allegati);
  if (!esito.inviata) {
    console.log('Email di verifica Admin non inviata: ' + esito.motivo);
  }
  return esito;
}

// Scrive nello storico ("notifiche_inviate") che è stato generato un
// avviso per un certificato, e prova a mandare davvero un'email al
// giocatore (vedi inviaEmail sopra). Non blocca mai la richiesta
// principale: se qualcosa qui fallisce (email non partita, tabella
// mancante...), viene solo scritto un avviso nel registro del server,
// senza far fallire l'approvazione o lo scarto.
//
// tipo: 'approvato', 'scartato', 'in_scadenza', 'scaduto', 'collegato'
// oppure 'revocato' — cambia il testo dell'email e
// viene salvato anche nella riga di "notifiche_inviate" insieme a
// nome e cognome del giocatore, così lo storico resta leggibile anche
// se in seguito il certificato viene eliminato (succede sempre per
// gli scarti: vedi DELETE /api/certificati/:id più sotto).
async function registraNotifica(certificato, tipo) {
  try {
    const { data: giocatore } = await supabase
      .from('giocatori')
      .select('persona(nome, cognome, email)')
      .eq('id', certificato.id_giocatore)
      .single();

    const destinatario = giocatore && giocatore.persona ? giocatore.persona.email : null;
    const nomeGiocatore = giocatore && giocatore.persona ? giocatore.persona.nome : '';
    const cognomeGiocatore = giocatore && giocatore.persona ? giocatore.persona.cognome : '';

    let oggetto;
    let corpoHtml;
    if (tipo === 'scartato') {
      oggetto = 'Certificato medico scartato';
      corpoHtml =
        '<p>Gentile' + (nomeGiocatore ? ' ' + nomeGiocatore : ' utente') + ',</p>' +
        '<p>Il certificato medico che ha caricato non &egrave; stato accettato' +
        (certificato.nota ? ' (' + certificato.nota + ')' : '') +
        '.</p>' +
        '<p>Pu&ograve; caricarne uno nuovo dal sito quando vuole.</p>';
    } else if (tipo === 'in_scadenza') {
      oggetto = 'Certificato medico in scadenza';
      corpoHtml =
        '<p>Gentile' + (nomeGiocatore ? ' ' + nomeGiocatore : ' utente') + ',</p>' +
        '<p>Il Suo certificato medico scade il ' + certificato.data_scadenza + ': Le ricordiamo di caricarne uno nuovo dal sito prima che scada.</p>';
    } else if (tipo === 'scaduto') {
      oggetto = 'Certificato medico scaduto';
      corpoHtml =
        '<p>Gentile' + (nomeGiocatore ? ' ' + nomeGiocatore : ' utente') + ',</p>' +
        '<p>Il Suo certificato medico &egrave; scaduto il ' + certificato.data_scadenza + ': carichi il prima possibile un nuovo certificato dal sito.</p>';
    } else if (tipo === 'collegato') {
      // Mandata quando l'Admin collega a questo giocatore una
      // segnalazione (un certificato caricato con un nome non
      // riconosciuto al momento): è l'unico modo per avvisarlo che il
      // suo caricamento è stato trovato e sta per essere valutato,
      // visto che chi carica un certificato con un nome non
      // riconosciuto non riceve altrimenti nessuna notizia dell'esito.
      oggetto = 'Certificato medico ricevuto';
      corpoHtml =
        '<p>Gentile' + (nomeGiocatore ? ' ' + nomeGiocatore : ' utente') + ',</p>' +
        '<p>Abbiamo ricevuto e collegato al Suo profilo il certificato medico che aveva caricato: &egrave; ora in attesa di essere valutato.</p>';
    } else if (tipo === 'revocato') {
      // Mandata quando l'Admin scarta un certificato che era già stato
      // approvato (per esempio perché approvato per errore): a
      // differenza dello scarto di un certificato in attesa, qui il
      // motivo è sempre scritto dall'Admin (obbligatorio nel sito), e lo
      // includiamo nell'email così il giocatore sa perché.
      oggetto = 'Certificato medico scartato';
      corpoHtml =
        '<p>Gentile' + (nomeGiocatore ? ' ' + nomeGiocatore : ' utente') + ',</p>' +
        '<p>Il Suo certificato medico, che era stato approvato, &egrave; stato successivamente scartato' +
        (certificato.motivo_scarto ? ': ' + certificato.motivo_scarto : '') +
        '.</p>' +
        '<p>Carichi il prima possibile un nuovo certificato dal sito.</p>';
    } else {
      oggetto = 'Certificato medico approvato';
      corpoHtml =
        '<p>Gentile' + (nomeGiocatore ? ' ' + nomeGiocatore : ' utente') + ',</p>' +
        '<p>Il Suo certificato medico &egrave; stato approvato' +
        (certificato.data_scadenza ? ' ed &egrave; valido fino al ' + certificato.data_scadenza : '') +
        '.</p>';
    }

    const esitoEmail = await inviaEmail(destinatario, oggetto, corpoHtml);
    if (!esitoEmail.inviata) {
      console.log('Notifica registrata, ma l\'email non e\' partita: ' + esitoEmail.motivo);
    }

    const { error } = await supabase
      .from('notifiche_inviate')
      .insert({
        id_certificato: certificato.id,
        destinatario,
        tipo: tipo || 'approvato',
        nome_giocatore: nomeGiocatore,
        cognome_giocatore: cognomeGiocatore,
      });

    if (error) {
      console.error('Non sono riuscito a registrare la notifica:', error.message);
    }
  } catch (erroreInatteso) {
    console.error('Errore imprevisto nella registrazione della notifica:', erroreInatteso.message);
  }
}

// Controlla tutti i certificati "attuali" (approvati) e avvisa il
// giocatore quando mancano due mesi alla scadenza, e di nuovo quando è
// scaduto. Per non mandare lo stesso avviso più volte, prima di
// mandarlo controlliamo nello storico ("notifiche_inviate") se non sia
// già stato registrato un avviso di quel tipo per quel certificato.
//
// Questo controllo gira una volta all'avvio del server e poi ogni 24
// ore (vedi in fondo al file): quindi funziona solo mentre il server
// resta acceso. Se il server viene riavviato più volte in un giorno
// non manda avvisi doppi, proprio grazie al controllo nello storico.
async function controllaScadenzeCertificati() {
  // Leggiamo anche se il giocatore è archiviato (giocatori.archiviato):
  // un giocatore archiviato (eliminato, o i cui giocatori sono stati
  // archiviati insieme alla sua squadra) non deve più ricevere avvisi
  // di scadenza, anche se il suo vecchio certificato risulta ancora
  // "approvato" nel database.
  const { data: certificati, error } = await supabase
    .from('certificati_medici')
    .select('id, id_giocatore, data_scadenza, nota, giocatori(archiviato)')
    .eq('stato', 'approvato');

  if (error) {
    console.error('Errore nel controllo delle scadenze dei certificati:', error.message);
    return;
  }

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const fraDueMesi = new Date(oggi);
  fraDueMesi.setMonth(fraDueMesi.getMonth() + 2);

  for (const certificato of certificati || []) {
    if (certificato.giocatori && certificato.giocatori.archiviato) continue; // giocatore archiviato: niente avvisi
    if (!certificato.data_scadenza) continue;
    const scadenza = new Date(certificato.data_scadenza + 'T00:00:00');
    if (isNaN(scadenza.getTime())) continue;

    let tipo = null;
    if (scadenza < oggi) tipo = 'scaduto';
    else if (scadenza <= fraDueMesi) tipo = 'in_scadenza';
    if (!tipo) continue; // certificato ancora valido a lungo: niente da fare

    const { data: giaMandate, error: erroreControllo } = await supabase
      .from('notifiche_inviate')
      .select('id')
      .eq('id_certificato', certificato.id)
      .eq('tipo', tipo)
      .limit(1);

    if (erroreControllo) {
      console.error('Errore nel controllo delle notifiche già mandate:', erroreControllo.message);
      continue;
    }
    if (giaMandate && giaMandate.length) continue; // avviso di questo tipo già mandato

    await registraNotifica(certificato, tipo);
  }
}

// Approva un certificato "nuovo" (dalla pagina Approvazione): da quel
// momento diventa il certificato "attuale" del giocatore. Registra
// anche un avviso per il giocatore interessato (vedi registraNotifica
// sopra). Per scartare un certificato non si usa questa route: si
// elimina del tutto con DELETE /api/certificati/:id, più sotto.
app.patch('/api/certificati/:id', richiedeAdmin, async (req, res) => {
  const { id } = req.params;
  const { stato } = req.body || {};

  if (stato !== 'approvato') {
    return res.status(400).json({ errore: 'Stato non valido: da qui si può solo approvare (per scartare, il certificato va eliminato).' });
  }

  const { data, error } = await supabase
    .from('certificati_medici')
    .update({ stato: 'approvato', data_approvazione: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Errore nell\'aggiornamento del certificato:', error.message);
    return res.status(500).json({ errore: error.message });
  }

  await registraNotifica(data, 'approvato');

  res.json(data);
});

// Scarta un certificato GIÀ APPROVATO (per esempio se l'Admin si
// accorge di averlo approvato per errore): a differenza dello scarto
// di un certificato ancora "in attesa" (vedi DELETE più sotto), qui il
// certificato NON viene eliminato dal database. Resta con stato
// "scartato" e il motivo scritto dall'Admin, così ne resta traccia
// nella pagina Archivio. Da questo momento il giocatore non ha più un
// certificato "attuale": può caricarne subito uno nuovo.
app.post('/api/certificati/:id/revoca', richiedeAdmin, async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body || {};

  if (!motivo || !motivo.trim()) {
    return res.status(400).json({ errore: 'Scriva il motivo per cui questo certificato va scartato.' });
  }

  const { data: certificatoEsistente, error: erroreLettura } = await supabase
    .from('certificati_medici')
    .select('id, stato')
    .eq('id', id)
    .single();

  if (erroreLettura || !certificatoEsistente) {
    return res.status(404).json({ errore: 'Certificato non trovato.' });
  }
  if (certificatoEsistente.stato !== 'approvato') {
    return res.status(400).json({
      errore: 'Questa azione vale solo per un certificato già approvato: per uno ancora in attesa, si usa "Scarta" nella pagina Gestione.',
    });
  }

  const { data, error } = await supabase
    .from('certificati_medici')
    .update({ stato: 'scartato', motivo_scarto: motivo.trim(), data_scarto: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Errore nella revoca del certificato:', error.message);
    return res.status(500).json({ errore: error.message });
  }

  await registraNotifica(data, 'revocato');

  res.json(data);
});

// Scarta un certificato "nuovo": viene eliminato del tutto dal
// database, come se non fosse mai stato caricato. Il certificato
// "attuale" del giocatore (se ne aveva uno) non viene toccato.
// Prima di eliminarlo leggiamo i suoi dati, per poter avvisare il
// giocatore che il certificato è stato scartato.
app.delete('/api/certificati/:id', richiedeAdmin, async (req, res) => {
  const { id } = req.params;

  const { data: certificato } = await supabase
    .from('certificati_medici')
    .select('id, id_giocatore, stato, nota, foto_path')
    .eq('id', id)
    .single();

  // Un certificato già approvato non va eliminato del tutto (si
  // perderebbe ogni traccia): per quello c'è la revoca qui sopra
  // (POST /api/certificati/:id/revoca), che lo tiene nello storico
  // con lo stato "scartato" e il motivo. Questa rotta resta solo per
  // scartare un certificato ancora "in attesa".
  if (certificato && certificato.stato === 'approvato') {
    return res.status(400).json({
      errore: 'Questo certificato è già approvato: per scartarlo va usata la revoca, non l\'eliminazione diretta.',
    });
  }

  if (certificato) {
    await registraNotifica(certificato, 'scartato');
  }

  const { error } = await supabase.from('certificati_medici').delete().eq('id', id);

  if (error) {
    console.error('Errore nell\'eliminazione del certificato:', error.message);
    return res.status(500).json({ errore: error.message });
  }

  // La foto nello Storage non serve più a nessuno, a differenza delle
  // segnalazioni (dove la teniamo per lo storico): la eliminiamo anche
  // lì, altrimenti resterebbe salvata per sempre senza motivo. Se
  // questo fallisce non blocchiamo la risposta: il certificato è già
  // stato eliminato correttamente, che è la parte che conta davvero.
  if (certificato && certificato.foto_path) {
    const { error: erroreEliminazioneFoto } = await supabase.storage
      .from(BUCKET_CERTIFICATI)
      .remove([certificato.foto_path]);
    if (erroreEliminazioneFoto) {
      console.error('Errore nell\'eliminazione della foto dallo Storage:', erroreEliminazioneFoto.message);
    }
  }

  res.json({ ok: true });
});

// Link temporaneo (5 minuti) per vedere la foto di un certificato: la foto
// non è mai pubblica, quindi il sito deve chiedere ogni volta un link
// fresco invece di salvarne uno fisso.
app.get('/api/certificati/:id/foto', async (req, res) => {
  const { id } = req.params;

  const { data: cert, error: erroreLettura } = await supabase
    .from('certificati_medici')
    .select('foto_path')
    .eq('id', id)
    .single();

  if (erroreLettura || !cert || !cert.foto_path) {
    return res.status(404).json({ errore: 'Foto non trovata.' });
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_CERTIFICATI)
    .createSignedUrl(cert.foto_path, 300);

  if (error) {
    console.error('Errore nella creazione del link alla foto:', error.message);
    return res.status(500).json({ errore: error.message });
  }

  res.json({ url: data.signedUrl });
});

// Storico delle notifiche registrate finora: usato dalla pagina
// Certificati medici > Segnalazioni (tab "Storico"). Leggiamo
// "nome_giocatore"/"cognome_giocatore" salvati direttamente sulla riga
// (non tramite certificati_medici) perché per gli scarti il
// certificato collegato viene eliminato subito dopo: senza questi due
// campi, lo storico perderebbe il nome di chi era.
app.get('/api/notifiche', richiedeAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('notifiche_inviate')
    .select('id, data_invio, tipo, destinatario, nome_giocatore, cognome_giocatore')
    .order('data_invio', { ascending: false });

  if (error) {
    console.error('Errore nella query a Supabase (notifiche):', error.message);
    return res.status(500).json({ errore: error.message });
  }

  res.json(data);
});

// In locale (sul computer, con "npm start") il server resta acceso per
// conto suo e risponde su questa porta, come sempre. Online, su
// Vercel, non deve fare così: è Vercel stesso a ricevere le richieste
// e a passarle a questo file (vedi "vercel.json" nella cartella
// principale del progetto) ogni volta che serve, quindi mettersi in
// ascolto di una porta qui bloccherebbe l'avvio online. "VERCEL" è una
// variabile che Vercel imposta da solo quando fa girare il sito
// online: la usiamo per distinguere i due casi senza doverci pensare
// ogni volta a mano.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server avviato: http://localhost:${PORT}`);
  });

  // Il controllo automatico delle scadenze fatto così (subito
  // all'avvio, poi ogni 24 ore) ha senso solo quando il server resta
  // acceso per conto suo, come in locale: online su Vercel, ogni
  // richiesta fa partire un'esecuzione nuova che si spegne subito dopo
  // aver risposto, quindi un giro ogni 24 ore impostato così non
  // partirebbe mai davvero. Online il controllo gira invece tramite un
  // "Cron Job" di Vercel, che richiama una volta al giorno la rotta
  // GET /api/cron/controlla-scadenze definita più sopra (vedi
  // vercel.json, chiave "crons", e il commento su quella rotta).
  controllaScadenzeCertificati();
  setInterval(controllaScadenzeCertificati, 24 * 60 * 60 * 1000);
}

// Su Vercel questo file viene letto come un "modulo" (un pezzo di
// codice da cui prendere qualcosa), non avviato direttamente come in
// locale: gli serve poter prendere "app" da qui per passargli le
// richieste che arrivano dal sito online.
module.exports = app;

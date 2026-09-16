# Come mettere in piedi il sito WordPress in locale sul tuo Mac

Questi passaggi ti servono una sola volta, per avere sul tuo Mac una copia di WordPress dove vedere e continuare a costruire il sito (esattamente come avevamo il server Node in locale prima).

## 1. Installa "Local" (gratis)

Vai su **localwp.com** e scarica "Local" per Mac: è un programma gratuito, fatto apposta per far girare WordPress sul proprio computer con un clic, senza dover installare a mano PHP, MySQL ecc. da Terminale.

## 2. Crea il sito

Apri Local → "Create a new site" → dagli un nome (es. `us-rio`) → lascia le impostazioni consigliate (PHP e MySQL già pronti) → crea un utente amministratore a tua scelta (username e password che vuoi tu).

Dopo qualche secondo il sito è pronto e Local ti mostra due pulsanti: **"Admin"** (apre il pannello di amministrazione) e **"View Site"** (apre il sito).

## 3. Copia dentro il tema e il plugin

In Local, clicca sui tre puntini del sito → **"Reveal in Finder"**: si apre la cartella del sito. Dentro trovi `app/public/wp-content/`.

- Scompatta `us-rio-tema.zip` (che ti ho mandato in chat) dentro `wp-content/themes/`: alla fine deve esserci la cartella `wp-content/themes/us-rio/`.
- Il plugin **Advanced Custom Fields** non serve scompattarlo a mano: più avanti (punto 5) lo installi direttamente dal pannello di WordPress, con un clic, perché il tuo Mac ha accesso a internet vero (io per ora lavoro in un ambiente isolato che non può scaricarlo dal sito ufficiale).

## 4. Attiva il tema

Apri il pannello di amministrazione (pulsante "Admin" in Local) → **Aspetto → Temi** → attiva **"U.S. Rio A.S.D."**.

## 5. Installa il plugin Advanced Custom Fields

Nel pannello → **Plugin → Aggiungi nuovo** → cerca "Advanced Custom Fields" (quello di WP Engine, con l'icona blu) → **Installa** → **Attiva**.

## 6. Sistema gli indirizzi delle pagine

Nel pannello → **Impostazioni → Permalink** → scegli **"Nome articolo"** → **Salva le modifiche**. Serve per avere indirizzi tipo `/squadre/` invece di link con `?p=15`.

## 7. Importa i contenuti di esempio

Nel pannello → **Strumenti → Importa** → cerca "WordPress" nell'elenco → se non è installato ti propone di installarlo, clicca **Installa ora** e poi **Esegui il programma di importazione** → carica il file `usrio-contenuti.xml` (che ti ho mandato in chat) → nella schermata successiva lascia le impostazioni di default e clicca **Invia**.

Questo ti crea le pagine del sito (Società, Storia, Squadre, ecc.) e due squadre/giocatori di prova.

## 8. Crea gli utenti di prova (per provare i 4 profili)

Nel pannello → **Utenti → Aggiungi nuovo**, crea questi utenti di prova (puoi cambiare nomi/password come vuoi):

| Nome utente | Email | Ruolo | Password |
|---|---|---|---|
| giulia.bruni | giulia.bruni@example.it | Allenatore | (a tua scelta) |
| mario.rossi | mario.rossi@example.it | Giocatore | (a tua scelta) |
| anna.socia | anna.socia@example.it | Socio | (a tua scelta) |

Per **giulia.bruni** (l'Allenatore), dopo averla creata apri di nuovo il suo profilo (Utenti → clicca sul suo nome) e in fondo trovi il campo **"Squadra assegnata"**: scegli "Prima Squadra". Solo così, quando lei accede, vede la bacheca di quella squadra e non delle altre.

## 9. Prova il sito

Clicca "View Site" in Local, oppure vai su `/accedi/` e prova ad accedere con uno degli utenti creati sopra: ogni profilo vede una "Mia Area" diversa, esattamente come nella versione precedente — solo che ora l'accesso è vero (email e password controllate davvero), non più finto.

---

**Cosa fa già il sito ora:**
- Stessa identica grafica di prima (menu, home, colori, tutte le pagine).
- Login vero con WordPress: non serve più "far finta" di accedere.
- Il Socio aggiunge/toglie squadre e giocatori direttamente dal pannello di WordPress (Squadre, Giocatori nel menu laterale), come farebbe con un Articolo — non serve più il pannello che avevamo costruito a mano.
- Il Socio crea gli Allenatori come utenti e assegna a ciascuno una squadra dal suo profilo: l'Allenatore vede solo quella nella sua Area riservata.

**Cosa manca ancora (prossimi passi):**
- Spostare dentro WordPress i 600 giocatori di prova che avevi già su Supabase (per ora ci sono solo 2 giocatori di esempio).
- Il profilo Iscritto non ha ancora contenuti dedicati (come nella versione precedente).
- Il certificato medico resta un segnaposto: la funzione vera è ancora da avviare, come deciso.

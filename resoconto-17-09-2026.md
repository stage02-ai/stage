# Resoconto lavori — 17 settembre 2026

Progetto: sito web per la società sportiva (area giocatori, squadre, certificati medici).

## Interfaccia del giocatore

Un utente che accede come Giocatore ora vede solo le squadre a cui appartiene davvero, non più l'elenco completo di tutte le squadre della società.

La voce "Archivio" nella pagina Certificati medici non compare più per il ruolo Giocatore. È stato bloccato anche l'accesso diretto tramite link, così un giocatore non può raggiungerla nemmeno digitando l'indirizzo a mano.

## Carica certificato: nome bloccato al proprio

Nella pagina "Carica certificato", i campi Nome e Cognome per il ruolo Giocatore sono ora precompilati con i suoi dati e non modificabili: non ha alcuna possibilità di scrivere un nome diverso dal proprio per caricare un certificato.

Per sicurezza, il controllo è stato aggiunto anche lato server (non solo nell'interfaccia del sito): anche se qualcuno provasse a forzare la richiesta bypassando il sito, il certificato viene comunque sempre collegato solo al giocatore associato al proprio account di accesso.

## Discussione: passaggio a WordPress

È stata valutata l'ipotesi di spostare il sito su WordPress. La valutazione: non conviene per come è strutturato oggi il sito, perché la logica di ruoli, database e certificati andrebbe comunque riscritta da zero (in PHP) dentro un plugin su misura, senza un reale vantaggio. Potrebbe avere senso solo se il resto del sito della società è già su WordPress e questa parte dovesse integrarsi lì, oppure se in futuro qualcuno dovrà scrivere contenuti semplici (news, pagine) senza saper programmare.

## Stato della pubblicazione

Tutte le modifiche di oggi sono state salvate sul Mac, nella cartella del progetto. Manca solo l'ultimo passaggio per renderle visibili online: da Terminale, nella cartella del progetto, eseguire:

```
cd /Users/stage/Desktop/progetto
git add .
git commit -m "Blocca nome/cognome del giocatore in Carica certificato, anche lato server"
git push
```

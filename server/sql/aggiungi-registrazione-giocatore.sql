-- ============================================================
-- Aggiunge quello che serve alla nuova modalità "Aggiungi con link
-- WhatsApp": l'Admin crea il giocatore con solo nome, cognome e
-- squadra (senza email), e il sito genera un link da mandare al
-- giocatore. Aprendo quel link, il giocatore stesso sceglie data di
-- nascita, email e password, e si registra da solo.
--
-- Cosa aggiunge:
-- - Toglie l'obbligo dell'email sulla tabella "persona": finché il
--   giocatore non si è ancora registrato da solo, la sua persona non
--   ha ancora nessuna email (la sceglierà lui in fase di
--   registrazione). Per tutti gli altri casi (giocatori aggiunti con
--   "Nuovo giocatore", responsabili, Admin) il sito continua comunque
--   a chiedere sempre l'email: qui si toglie solo il vincolo rigido
--   del database, non cambia nient'altro.
-- - token_registrazione: il codice segreto, lungo e casuale, dentro il
--   link mandato al giocatore. Resta vuoto per chi non ha (o non ha
--   più) un link in attesa.
-- - token_registrazione_scadenza: da quando in poi quel link smette di
--   funzionare (per sicurezza, il sito lo rende valido solo per un po'
--   di giorni: dopo, l'Admin può sempre generarne uno nuovo).
--
-- Non tocca nessun dato esistente: aggiunge solo le due colonne nuove
-- (vuote per tutte le persone già presenti) e toglie un vincolo.
--
-- Come usarlo: apri il progetto su supabase.com, vai su "SQL Editor",
-- "New query", incolla tutto questo file, clicca "Run".
-- ============================================================

alter table persona
  alter column email drop not null;

alter table persona
  add column if not exists token_registrazione text unique;

alter table persona
  add column if not exists token_registrazione_scadenza timestamptz;

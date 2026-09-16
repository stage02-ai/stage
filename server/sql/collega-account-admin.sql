-- ============================================================
-- Collega l'account Admin, creato a mano su Supabase (Authentication
-- > Users > "Add user"), a una persona dedicata nel database.
--
-- NOTA IMPORTANTE: l'email qui sotto è solo quella della persona nel
-- database (compare nelle pagine del sito): NON deve essere un'email
-- già usata da altre persone nel database, come quella dei 20
-- giocatori di prova e del responsabile (stage02@engimedia.it).
-- Se usi la stessa email di persone già esistenti, questo script
-- proverebbe a collegare l'account Admin a più persone insieme, cosa
-- che non è permessa (dà errore: "duplicate key value violates
-- unique constraint... id_account").
--
-- Prima di eseguire questo file:
-- 1. Vai su supabase.com -> il tuo progetto -> "Authentication" ->
--    "Users" -> "Add user" (se non l'hai già fatto), e crea l'account
--    con l'email e la password che vuoi usare per accedere come Admin.
-- 2. Apri l'utente appena creato e copia il suo "User UID".
-- 3. Qui sotto, sostituisci INCOLLA_QUI_L_UUID_DELL_ACCOUNT con quel
--    codice, e l'email con una DIVERSA da quella dei dati di prova
--    (va benissimo la stessa email che hai usato al punto 1). Puoi
--    anche cambiare nome e cognome.
--
-- Questo file NON deve mai contenere la password: quella resta solo
-- dentro Supabase Auth, il database non la vede né la salva.
--
-- Come usarlo: SQL Editor su supabase.com (dopo aver fatto le
-- modifiche sopra), incolla, Run.
-- ============================================================

insert into persona (nome, cognome, email, ruolo_accesso, id_account)
values (
  'Gianluca',
  'Codato',
  'INCOLLA_QUI_UN_EMAIL_DIVERSA_DA_QUELLE_DI_PROVA',
  'admin',
  'INCOLLA_QUI_L_UUID_DELL_ACCOUNT'
);

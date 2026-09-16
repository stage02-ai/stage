-- ============================================================
-- Aggiunge alla tabella "persona" il collegamento con il vero login
-- (email e password), gestito da Supabase Auth.
--
-- Cosa aggiunge:
-- - id_account: collega la persona all'account di accesso vero,
--   creato da Supabase Auth (Authentication > Users nel pannello di
--   Supabase). Resta vuoto per chi non ha (ancora) un account di
--   accesso: per esempio i giocatori di prova, o i responsabili (per
--   ora possono accedere solo l'Admin e i giocatori).
-- - ruolo_accesso: dice con quale ruolo quella persona può accedere
--   al sito: 'admin' oppure 'giocatore'. Resta vuoto per chi non deve
--   (o non può ancora) fare login.
--
-- Non tocca nessun dato esistente: aggiunge solo due colonne, vuote
-- per tutte le persone già presenti.
--
-- Come usarlo: apri il progetto su supabase.com, vai su "SQL Editor",
-- "New query", incolla tutto questo file, clicca "Run".
-- ============================================================

alter table persona
  add column if not exists id_account uuid unique references auth.users(id) on delete set null;

alter table persona
  add column if not exists ruolo_accesso text check (ruolo_accesso in ('admin', 'giocatore'));

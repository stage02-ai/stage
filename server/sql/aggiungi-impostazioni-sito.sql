-- ============================================================
-- Aggiunge la tabella "impostazioni_sito": una riga sola, sempre la
-- stessa (id = 1), con il nome del sito e le informazioni della
-- pagina Contatti (indirizzo, telefono, email, campo di gioco).
--
-- Prima questi dati erano testi finti scritti direttamente nel codice
-- del sito (per esempio "[Via, città]"). Da ora si modificano dalla
-- nuova pagina "Impostazioni", visibile solo entrando come Admin (menu
-- in alto a destra), e compaiono subito anche nell'intestazione del
-- sito (il nome) e nella pagina Contatti.
--
-- Come usarlo:
-- 1. Apri il progetto su supabase.com
-- 2. Nel menu a sinistra vai su "SQL Editor"
-- 3. Clicca "New query"
-- 4. Incolla tutto questo file
-- 5. Clicca "Run" (o il pulsante Play)
--
-- Si può eseguire più di una volta senza rompere nulla.
-- ============================================================

create table if not exists impostazioni_sito (
  id integer primary key default 1,
  nome_sito text not null default 'U.S. Rio A.S.D.',
  indirizzo text,
  telefono text,
  email text,
  campo_gioco text,
  constraint impostazioni_sito_una_sola_riga check (id = 1)
);

insert into impostazioni_sito (id, nome_sito)
values (1, 'U.S. Rio A.S.D.')
on conflict (id) do nothing;

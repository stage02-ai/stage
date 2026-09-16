-- ============================================================
-- Sposta la "data di nascita" dalla tabella "giocatori" alla
-- tabella "persona" (dato anagrafico, condiviso anche con i
-- responsabili). Serve per mostrare l'anno di nascita nell'elenco
-- "Giocatori" (Squadre > Giocatori).
--
-- NOTA: se nella tua tabella "giocatori" il campo con la data di
-- nascita si chiama in modo diverso da "data_nascita", correggi il
-- nome nelle righe 15 e 21 prima di eseguire lo script (e poi dimmi
-- il nome esatto così sistemo anche il codice del sito).
--
-- Come usarlo:
-- 1. Apri il progetto su supabase.com
-- 2. Nel menu a sinistra vai su "SQL Editor"
-- 3. Clicca "New query"
-- 4. Incolla tutto questo file
-- 5. Clicca "Run" (o il pulsante Play)
-- ============================================================

-- 1) Aggiunge il campo alla tabella "persona".
alter table persona add column if not exists data_nascita date;

-- 2) Copia i valori già inseriti su "giocatori" dentro "persona",
--    seguendo il collegamento id_persona.
update persona
set data_nascita = giocatori.data_nascita
from giocatori
where giocatori.id_persona = persona.id
  and giocatori.data_nascita is not null;

-- 3) Rimuove il campo duplicato dalla tabella "giocatori": da qui in
--    avanti la data di nascita si trova solo in "persona".
alter table giocatori drop column if exists data_nascita;

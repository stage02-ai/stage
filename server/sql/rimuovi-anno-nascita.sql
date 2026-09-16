-- ============================================================
-- Rimuove il campo "anno_nascita" dalla tabella "persona".
--
-- Non serve più: l'anno di nascita ora si ricava direttamente dalla
-- data di nascita (campo "data_nascita"), spostata nella tabella
-- "persona" con lo script "sposta-data-nascita-in-persona.sql".
--
-- Come usarlo:
-- 1. Apri il progetto su supabase.com
-- 2. Nel menu a sinistra vai su "SQL Editor"
-- 3. Clicca "New query"
-- 4. Incolla tutto questo file
-- 5. Clicca "Run" (o il pulsante Play)
--
-- Si può eseguire anche se il campo non esiste più: l'"if exists"
-- evita errori in quel caso.
-- ============================================================

alter table persona drop column if exists anno_nascita;

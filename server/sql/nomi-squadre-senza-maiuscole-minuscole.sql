-- ============================================================
-- Fa in modo che due squadre non possano avere lo stesso nome nemmeno
-- se scritto con maiuscole/minuscole diverse (per esempio "Nuova" e
-- "nuova" adesso contano come lo stesso nome, e la seconda viene
-- rifiutata).
--
-- Perché serve questo script: la regola che c'era già ("nome" unique)
-- distingue maiuscole e minuscole per il database, quindi "Nuova" e
-- "nuova" venivano considerati due nomi diversi e si potevano creare
-- entrambi. Questo script toglie quella regola e ne mette una nuova
-- che confronta i nomi ignorando le maiuscole.
--
-- Il sito non cambia: il messaggio "Esiste già una squadra con questo
-- nome" che compare già oggi provando a creare o rinominare una
-- squadra con un nome già usato, da adesso compare anche se cambia
-- solo maiuscole/minuscole.
--
-- Come usarlo:
-- 1. Apri il progetto su supabase.com
-- 2. Nel menu a sinistra vai su "SQL Editor"
-- 3. Clicca "New query"
-- 4. Incolla tutto questo file
-- 5. Clicca "Run" (o il pulsante Play)
--
-- ATTENZIONE: se hai già oggi due squadre con lo stesso nome scritto
-- in modo diverso (per esempio "Juniores" e "juniores"), questo
-- script si ferma con un errore invece di crearne una copia rifiutata
-- in silenzio: in quel caso rinomina prima una delle due dal sito
-- (pagina Squadre), poi rilancia lo script.
--
-- Si può eseguire più di una volta senza rompere nulla.
-- ============================================================

alter table squadre drop constraint if exists squadre_nome_key;

create unique index if not exists squadre_nome_senza_maiuscole_key on squadre (lower(nome));

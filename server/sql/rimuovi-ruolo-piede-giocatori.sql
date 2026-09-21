-- ============================================================
-- Toglie dal database due colonne che non servono più: il "ruolo"
-- calcistico del giocatore (Portiere/Difensore/Centrocampista/
-- Attaccante) e il "piede preferito" (destro/sinistro). Su richiesta
-- del tutor, questi due campi sono stati tolti anche dal sito: non
-- vengono più chiesti né quando si aggiunge un giocatore, né quando lo
-- si modifica.
--
-- Questo comando cancella per davvero i valori già salvati per questi
-- due campi su tutti i giocatori esistenti: non si possono recuperare
-- dopo averlo eseguito (nessun altro dato, per esempio i certificati o
-- le squadre, viene toccato).
--
-- Come usarlo: apri il progetto su supabase.com, vai su "SQL Editor",
-- "New query", incolla tutto questo file, clicca "Run".
-- ============================================================

alter table giocatori drop column if exists ruolo;
alter table giocatori drop column if exists piede_preferito;

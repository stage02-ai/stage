-- ============================================================
-- Ora un giocatore può avere fino a DUE certificati registrati
-- contemporaneamente: quello "attuale" (l'ultimo approvato) e uno
-- "nuovo" appena caricato, in attesa di essere approvato o scartato.
--
-- Prima invece un giocatore poteva avere un solo certificato in
-- tutto (per questo, quando ne caricava uno nuovo, sostituiva quello
-- di prima). Questo script toglie quel limite.
--
-- Come usarlo: uguale agli altri script — SQL Editor su
-- supabase.com, incolla, Run. Si può eseguire più volte senza
-- problemi.
-- ============================================================

drop index if exists certificati_medici_id_giocatore_key;

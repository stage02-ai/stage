-- ============================================================
-- Aggiunge alla tabella "certificati_medici" le colonne per la data
-- di rilascio (quella scritta dal medico sul certificato) e la data
-- di scadenza (calcolata automaticamente dal sito: un anno dopo il
-- rilascio, come i certificati agonistici).
--
-- Da adesso in poi, quando carichi un nuovo certificato dalla pagina
-- "Carica certificato", ti verrà chiesta la data di rilascio e la
-- scadenza si calcolerà da sola.
--
-- Come usarlo: uguale agli altri script — SQL Editor su
-- supabase.com, incolla, Run. Si può eseguire più volte senza
-- problemi.
-- ============================================================

begin;

alter table certificati_medici
  add column if not exists data_rilascio date;

alter table certificati_medici
  add column if not exists data_scadenza date;

commit;

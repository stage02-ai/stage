-- ============================================================
-- Aggiunge alla tabella "certificati_medici" la colonna "nota": una
-- nota facoltativa che chi carica il certificato può scrivere (per
-- esempio per segnalare qualcosa a chi deve approvarlo).
--
-- Come usarlo: uguale agli altri script — SQL Editor su
-- supabase.com, incolla, Run. Si può eseguire più volte senza
-- problemi.
-- ============================================================

alter table certificati_medici
  add column if not exists nota text;

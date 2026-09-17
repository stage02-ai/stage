-- ============================================================
-- Permette di scartare un certificato medico che era già stato
-- approvato (per esempio se l'Admin si accorge di averlo approvato
-- per errore). A differenza dello scarto di un certificato ancora "in
-- attesa" (che viene eliminato del tutto), qui il certificato NON
-- viene cancellato: resta nel database con lo stato "scartato" e il
-- motivo scritto dall'Admin, così ne resta traccia nella pagina
-- Archivio.
--
-- Come usarlo: uguale agli altri script — apri il progetto su
-- supabase.com, vai su "SQL Editor", incolla tutto questo file, clicca
-- "Run". Si può eseguire più di una volta senza rompere nulla.
-- ============================================================

alter table certificati_medici
  add column if not exists motivo_scarto text;

alter table certificati_medici
  add column if not exists data_scarto timestamptz;

-- Aggiunge "scartato" ai valori possibili di "stato" (prima erano solo
-- "attesa" e "approvato").
alter table certificati_medici drop constraint if exists certificati_medici_stato_check;

alter table certificati_medici
  add constraint certificati_medici_stato_check
  check (stato in ('attesa', 'approvato', 'scartato'));

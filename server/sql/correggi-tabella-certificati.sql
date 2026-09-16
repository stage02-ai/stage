-- ============================================================
-- Corregge la tabella "certificati_medici".
--
-- Cosa è successo: la tabella "certificati_medici" esisteva già nel
-- database (probabilmente creata tempo fa, con una struttura diversa
-- da quella che serve oggi al sito). Per questo lo script che ti
-- avevo dato prima ("aggiungi-tabella-certificati.sql") non ha
-- cambiato nulla: diceva "crea la tabella SE NON ESISTE GIÀ", e
-- infatti esisteva già, anche se con altre colonne. Risultato:
-- mancavano delle colonne e il sito dava errore aprendo i
-- certificati.
--
-- Questo script aggiunge SOLO le colonne che mancano, senza toccare
-- o cancellare nulla di quello che c'è già nella tabella. Si può
-- eseguire più di una volta senza problemi.
--
-- Come usarlo: uguale agli altri script — apri il progetto su
-- supabase.com, vai su "SQL Editor", incolla tutto questo file,
-- clicca "Run". Non serve riavviare il server dopo averlo eseguito:
-- basta ricaricare la pagina del sito.
-- ============================================================

begin;

alter table certificati_medici
  add column if not exists stato text not null default 'attesa';

alter table certificati_medici
  add column if not exists foto_path text;

alter table certificati_medici
  add column if not exists data_caricamento timestamptz not null default now();

alter table certificati_medici
  add column if not exists data_approvazione timestamptz;

-- Un solo certificato "attivo" per giocatore: caricandone uno nuovo
-- si sostituisce quello precedente.
create unique index if not exists certificati_medici_id_giocatore_key
  on certificati_medici (id_giocatore);

-- Limita i valori possibili di "stato" a quelli usati dal sito.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'certificati_medici_stato_check'
  ) then
    alter table certificati_medici
      add constraint certificati_medici_stato_check
      check (stato in ('attesa', 'approvato'));
  end if;
end $$;

commit;

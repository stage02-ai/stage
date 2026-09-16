-- ============================================================
-- Compila data di rilascio e scadenza per i 10 certificati di
-- esempio creati con "inserisci-10-certificati.sql" (esegui prima
-- "aggiungi-date-certificati.sql", che crea le due colonne).
--
-- La scadenza è sempre calcolata come un anno esatto dopo il
-- rilascio, esattamente come fa il sito quando l'admin carica un
-- certificato vero.
--
-- Come usarlo: uguale agli altri script — SQL Editor su
-- supabase.com, incolla, Run. Si può eseguire più volte senza
-- problemi (aggiorna sempre le stesse 10 righe).
-- ============================================================

with certificati_di_esempio as (
  select cm.id, row_number() over (order by cm.id) as rn
  from certificati_medici cm
  join giocatori g on g.id = cm.id_giocatore
  join persona p on p.id = g.id_persona
  where p.email in (
    'mario.rossi@example.com','luca.bianchi@example.com','marco.verdi@example.com',
    'andrea.ferrari@example.com','davide.romano@example.com','simone.colombo@example.com',
    'matteo.ricci@example.com','alessio.marino@example.com','federico.greco@example.com',
    'riccardo.bruno@example.com'
  )
),
date_rilascio as (
  select
    id,
    (array['2026-01-10','2026-02-14','2025-12-02','2026-03-20','2025-11-15',
           '2026-04-05','2025-10-22','2026-01-28','2025-09-30','2026-02-02']::date[])[rn] as rilascio
  from certificati_di_esempio
)
update certificati_medici cm
set
  data_rilascio = dr.rilascio,
  data_scadenza = (dr.rilascio + interval '1 year')::date
from date_rilascio dr
where cm.id = dr.id;

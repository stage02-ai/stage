-- ============================================================
-- Aggiunge un certificato medico di esempio per ognuno dei 10
-- giocatori creati con "inserisci-10-giocatori.sql" (li riconosce
-- dalla loro email, quindi esegui PRIMA quello script se non l'hai
-- già fatto, e anche "correggi-tabella-certificati.sql" se non
-- l'hai ancora eseguito).
--
-- Nota sulle foto: qui non viene allegata nessuna foto vera — non è
-- possibile "inventare" una foto reale nello spazio di archiviazione
-- di Supabase. Questi certificati di esempio hanno solo lo stato
-- (in attesa / approvato) e le date, utili per vedere e provare la
-- pagina "Approvazione" con dati diversi. Se apri il dettaglio di uno
-- di questi certificati di esempio, il sito dirà "Foto non trovata":
-- è normale, non è un errore. Le foto vere si vedono solo per i
-- certificati caricati per davvero dalla pagina "Carica certificato".
--
-- Come usarlo: uguale agli altri script — SQL Editor su
-- supabase.com, incolla, Run. Si può eseguire più volte senza
-- problemi (aggiorna gli stessi 10 certificati invece di duplicarli).
-- ============================================================

with giocatori_di_esempio as (
  select g.id as id_giocatore, row_number() over (order by g.id) as rn
  from giocatori g
  join persona p on p.id = g.id_persona
  where p.email in (
    'mario.rossi@example.com','luca.bianchi@example.com','marco.verdi@example.com',
    'andrea.ferrari@example.com','davide.romano@example.com','simone.colombo@example.com',
    'matteo.ricci@example.com','alessio.marino@example.com','federico.greco@example.com',
    'riccardo.bruno@example.com'
  )
),
stati as (
  select
    ge.id_giocatore,
    (array['approvato','attesa','approvato','attesa','approvato',
           'attesa','approvato','attesa','approvato','attesa'])[ge.rn] as stato,
    ge.rn
  from giocatori_di_esempio ge
)
insert into certificati_medici (id_giocatore, stato, data_caricamento, data_approvazione)
select
  s.id_giocatore,
  s.stato,
  now() - (s.rn || ' days')::interval,
  case when s.stato = 'approvato' then now() - ((s.rn - 1) || ' days')::interval else null end
from stati s
on conflict (id_giocatore) do update set
  stato = excluded.stato,
  data_caricamento = excluded.data_caricamento,
  data_approvazione = excluded.data_approvazione;

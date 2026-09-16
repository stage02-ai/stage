-- ============================================================
-- Aggiunge una notifica di esempio per ognuno dei 10 certificati di
-- esempio creati con "inserisci-10-certificati.sql" (esegui prima
-- quello script, e prima ancora "aggiungi-tabella-notifiche.sql" per
-- creare la tabella).
--
-- Ricorda: queste notifiche sono solo righe nel database, non email
-- vere (il sito non ha ancora un servizio di posta collegato). Da
-- adesso in poi, però, ogni volta che approvi o scarti un certificato
-- vero dalla pagina "Approvazione", il server registra qui una nuova
-- notifica in automatico.
--
-- Come usarlo: uguale agli altri script — SQL Editor su
-- supabase.com, incolla, Run.
--
-- Attenzione: a differenza degli altri script, questo non è pensato
-- per essere eseguito più volte: se lo lanci due volte, aggiungerà
-- due notifiche identiche per ogni certificato invece di aggiornarle
-- (qui non c'è un vincolo che lo impedisca, perché nella realtà uno
-- stesso certificato può ricevere più avvisi nel tempo).
-- ============================================================

with certificati_di_esempio as (
  select
    cm.id as id_certificato,
    p.email as destinatario,
    row_number() over (order by cm.id) as rn
  from certificati_medici cm
  join giocatori g on g.id = cm.id_giocatore
  join persona p on p.id = g.id_persona
  where p.email in (
    'mario.rossi@example.com','luca.bianchi@example.com','marco.verdi@example.com',
    'andrea.ferrari@example.com','davide.romano@example.com','simone.colombo@example.com',
    'matteo.ricci@example.com','alessio.marino@example.com','federico.greco@example.com',
    'riccardo.bruno@example.com'
  )
)
insert into notifiche_inviate (id_certificato, destinatario, data_invio)
select
  id_certificato,
  destinatario,
  now() - (rn || ' hours')::interval
from certificati_di_esempio;

-- ============================================================
-- Aggiunge 10 giocatori di prova al database, ognuno con i propri
-- dati (nome, cognome, email, ruolo, piede preferito, data di
-- nascita). Vengono collegati automaticamente alle squadre e agli
-- allenatori (responsabili) che esistono già nel database: lo script
-- NON ha bisogno di sapere i loro ID, li trova da solo.
--
-- Come usarlo:
-- 1. Apri il progetto su supabase.com
-- 2. Nel menu a sinistra vai su "SQL Editor"
-- 3. Clicca "New query"
-- 4. Incolla tutto questo file
-- 5. Clicca "Run" (o il pulsante Play)
--
-- Se qualcosa va storto (per esempio un errore su "ruolo" o su
-- "email"), non viene inserito nulla di sbagliato: Supabase annulla
-- automaticamente tutta l'operazione in caso di errore. In quel caso
-- copiami il messaggio di errore che compare e sistemo lo script.
--
-- Nota: se lo lanci una seconda volta aggiunge altri 10 giocatori
-- nuovi (non sostituisce quelli già inseriti). Se il database non
-- accetta email duplicate e li lanci due volte senza modificare le
-- email qui sotto, darà errore: in quel caso basta cambiare le email
-- prima di rilanciarlo.
-- ============================================================

with nuove_persone as (
  insert into persona (nome, cognome, email)
  values
    ('Mario',    'Rossi',     'mario.rossi@example.com'),
    ('Luca',     'Bianchi',   'luca.bianchi@example.com'),
    ('Marco',    'Verdi',     'marco.verdi@example.com'),
    ('Andrea',   'Ferrari',   'andrea.ferrari@example.com'),
    ('Davide',   'Romano',    'davide.romano@example.com'),
    ('Simone',   'Colombo',   'simone.colombo@example.com'),
    ('Matteo',   'Ricci',     'matteo.ricci@example.com'),
    ('Alessio',  'Marino',    'alessio.marino@example.com'),
    ('Federico', 'Greco',     'federico.greco@example.com'),
    ('Riccardo', 'Bruno',     'riccardo.bruno@example.com')
  returning id
),

-- Numeriamo le 10 persone appena create (1, 2, 3, ... 10) così
-- possiamo assegnare a ciascuna un ruolo, un piede e una data di
-- nascita diversi, presi dalle liste qui sotto.
persone_numerate as (
  select id, row_number() over () as rn
  from nuove_persone
),

persone_con_dati as (
  select
    pn.id,
    pn.rn,
    (array['Portiere','Difensore','Difensore','Centrocampista','Centrocampista',
           'Attaccante','Difensore','Centrocampista','Attaccante','Portiere'])[pn.rn] as ruolo,
    (array['destro','sinistro','destro','destro','sinistro',
           'destro','destro','sinistro','destro','sinistro'])[pn.rn] as piede_preferito,
    (array['2007-03-14','2008-07-22','2006-11-05','2007-09-30','2008-01-18',
           '2006-05-27','2007-12-02','2008-04-09','2006-08-16','2007-06-25']::date[])[pn.rn] as data_nascita
  from persone_numerate pn
),

-- Squadre già esistenti nel database, numerate per poterle assegnare
-- a rotazione ai 10 nuovi giocatori (se ci sono 3 squadre, il 4°
-- giocatore torna alla prima squadra, e così via).
squadre_numerate as (
  select id as id_squadra, row_number() over (order by id) as rn, count(*) over () as totale
  from squadre
),

-- Per ogni squadra, un responsabile (allenatore) già collegato ad
-- essa nel database, se esiste.
responsabile_per_squadra as (
  select distinct on (id_squadra) id_squadra, id as id_responsabile
  from responsabili
  order by id_squadra, id
)

insert into giocatori (id_persona, id_squadra, id_responsabile, ruolo, piede_preferito, data_nascita)
select
  pcd.id,
  sn.id_squadra,
  rps.id_responsabile,
  pcd.ruolo,
  pcd.piede_preferito,
  pcd.data_nascita
from persone_con_dati pcd
join squadre_numerate sn on sn.rn = ((pcd.rn - 1) % sn.totale) + 1
left join responsabile_per_squadra rps on rps.id_squadra = sn.id_squadra;

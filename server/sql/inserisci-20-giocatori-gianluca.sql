-- ============================================================
-- Aggiunge 20 giocatori di prova al database, TUTTI con la stessa
-- email (gianlucacodato08@gmail.com), così puoi vedere/ricevere per
-- davvero le email vere (approvazione, scarto, avvisi di scadenza)
-- nella tua casella di posta durante i test.
--
-- Ogni giocatore ha anche un certificato medico già approvato, con
-- scadenze diverse apposta per poter vedere subito tutti e tre i casi
-- nella pagina "Approvazione" e "Archivio":
--   -  7 giocatori con il certificato già SCADUTO (pallino rosso)
--   -  6 giocatori con il certificato IN SCADENZA, entro due mesi da
--      oggi (pallino arancione)
--   -  7 giocatori con il certificato ancora VALIDO a lungo (pallino
--      verde)
--
-- Vengono collegati automaticamente alle squadre e agli allenatori
-- (responsabili) che esistono già nel database: lo script NON ha
-- bisogno di sapere i loro ID, li trova da solo.
--
-- IMPORTANTE sulle foto: questi certificati di esempio non hanno
-- nessuna foto vera allegata (non è possibile "inventare" una foto
-- reale nello spazio di archiviazione di Supabase). Se apri il
-- dettaglio di uno di questi certificati e clicchi per vedere la
-- foto, il sito dirà "Foto non trovata": è normale, non è un errore.
--
-- IMPORTANTE sull'email: se la tabella "persona" nel tuo database
-- impedisce le email duplicate (vincolo "unique"), questo script
-- darà un errore invece di inserire i 20 giocatori (Supabase annulla
-- comunque tutto in automatico, quindi il database resta pulito).
-- Se succede, copiami il messaggio di errore esatto e sistemo lo
-- script insieme a te.
--
-- Come usarlo:
-- 1. Apri il progetto su supabase.com
-- 2. Nel menu a sinistra vai su "SQL Editor"
-- 3. Clicca "New query"
-- 4. Incolla tutto questo file
-- 5. Clicca "Run" (o il pulsante Play)
--
-- Nota: se lo lanci una seconda volta aggiunge altri 20 giocatori
-- nuovi (non sostituisce quelli già inseriti).
-- ============================================================

begin;

with nuove_persone as (
  insert into persona (nome, cognome, email)
  values
    ('Giulia',      'Esposito',    'gianlucacodato08@gmail.com'),
    ('Alessandro',  'Fontana',     'gianlucacodato08@gmail.com'),
    ('Chiara',      'Barbieri',    'gianlucacodato08@gmail.com'),
    ('Stefano',     'Gatti',       'gianlucacodato08@gmail.com'),
    ('Valentina',   'Mariani',     'gianlucacodato08@gmail.com'),
    ('Emanuele',    'Rinaldi',     'gianlucacodato08@gmail.com'),
    ('Sara',        'Caruso',      'gianlucacodato08@gmail.com'),
    ('Michele',     'Longo',       'gianlucacodato08@gmail.com'),
    ('Elisa',       'Villa',       'gianlucacodato08@gmail.com'),
    ('Daniele',     'Testa',       'gianlucacodato08@gmail.com'),
    ('Martina',     'Serra',       'gianlucacodato08@gmail.com'),
    ('Antonio',     'Leone',       'gianlucacodato08@gmail.com'),
    ('Giorgia',     'Farina',      'gianlucacodato08@gmail.com'),
    ('Paolo',       'Sartori',     'gianlucacodato08@gmail.com'),
    ('Beatrice',    'Pellegrini',  'gianlucacodato08@gmail.com'),
    ('Luigi',       'De Santis',   'gianlucacodato08@gmail.com'),
    ('Francesca',   'Palumbo',     'gianlucacodato08@gmail.com'),
    ('Salvatore',   'Grasso',      'gianlucacodato08@gmail.com'),
    ('Ilaria',      'Vitale',      'gianlucacodato08@gmail.com'),
    ('Roberto',     'Basile',      'gianlucacodato08@gmail.com')
  returning id
),

-- Numeriamo le 20 persone appena create (1, 2, 3, ... 20) così
-- possiamo assegnare a ciascuna un ruolo, un piede, una data di
-- nascita e (più sotto) una scadenza del certificato diversi, presi
-- dalle liste in ordine.
persone_numerate as (
  select id, row_number() over () as rn
  from nuove_persone
),

persone_con_dati as (
  select
    pn.id,
    pn.rn,
    (array['Portiere','Difensore','Centrocampista','Attaccante','Difensore',
           'Centrocampista','Attaccante','Portiere','Difensore','Centrocampista',
           'Attaccante','Difensore','Centrocampista','Attaccante','Portiere',
           'Difensore','Centrocampista','Attaccante','Difensore','Centrocampista'])[pn.rn] as ruolo,
    (array['destro','sinistro','destro','destro','sinistro',
           'destro','sinistro','destro','destro','sinistro',
           'destro','destro','sinistro','destro','sinistro',
           'destro','destro','sinistro','destro','sinistro'])[pn.rn] as piede_preferito,
    (array['2007-03-14','2008-07-22','2006-11-05','2007-09-30','2008-01-18',
           '2006-05-27','2007-12-02','2008-04-09','2006-08-16','2007-06-25',
           '2008-02-11','2006-10-19','2007-01-08','2008-05-30','2006-12-24',
           '2007-07-17','2008-03-03','2006-09-21','2007-11-13','2008-06-06']::date[])[pn.rn] as data_nascita
  from persone_numerate pn
),

-- Squadre già esistenti nel database, numerate per poterle assegnare
-- a rotazione ai 20 nuovi giocatori.
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
),

nuovi_giocatori as (
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
  left join responsabile_per_squadra rps on rps.id_squadra = sn.id_squadra
  returning id, id_persona
),

-- Ricolleghiamo ogni nuovo giocatore al suo numero (rn), per potergli
-- assegnare la scadenza del certificato corrispondente qui sotto.
giocatori_con_rn as (
  select ng.id as id_giocatore, pcd.rn
  from nuovi_giocatori ng
  join persone_con_dati pcd on pcd.id = ng.id_persona
),

-- Le scadenze: le prime 7 nel passato (scaduti), le 6 dopo entro due
-- mesi da oggi (in scadenza), le ultime 7 ben oltre (validi).
scadenze as (
  select
    gcr.id_giocatore,
    (array[
      '2025-01-15','2025-06-20','2025-11-10','2026-02-05','2026-05-18','2026-07-30','2026-09-01',
      '2026-09-15','2026-09-25','2026-10-05','2026-10-15','2026-10-28','2026-11-05',
      '2026-12-20','2027-01-10','2027-03-15','2027-05-22','2027-07-08','2027-09-30','2028-01-12'
    ]::date[])[gcr.rn] as data_scadenza
  from giocatori_con_rn gcr
)

insert into certificati_medici (id_giocatore, stato, data_rilascio, data_scadenza, data_caricamento, data_approvazione, nota)
select
  s.id_giocatore,
  'approvato',
  (s.data_scadenza - interval '1 year')::date,
  s.data_scadenza,
  (s.data_scadenza - interval '1 year')::timestamptz,
  (s.data_scadenza - interval '1 year' + interval '3 days')::timestamptz,
  'Certificato di esempio (dati di prova)'
from scadenze s;

commit;

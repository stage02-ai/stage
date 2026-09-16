-- ============================================================
-- Riempie di dati di esempio TUTTE le tabelle del progetto nuovo.
--
-- DA ESEGUIRE DOPO "schema-completo-nuovo-progetto.sql" (che deve
-- aver già creato le tabelle e la squadra di partenza) — se lo lanci
-- prima, o su un progetto che non ha ancora quelle tabelle, darà
-- errore.
--
-- Su richiesta, TUTTE le persone di esempio (responsabile e 20
-- giocatori) hanno esattamente la stessa email: stage02@engimedia.it.
-- Per permetterlo, lo script "schema-completo-nuovo-progetto.sql" ha
-- tolto dalla tabella "persona" la regola che imponeva un'email
-- diversa per ciascuno (vedi la nota in quel file): qui sfruttiamo
-- proprio l'assenza di quella regola.
--
-- Tutti e 20 i giocatori sono nell'unica squadra creata dallo script
-- precedente ("Prima Squadra").
--
-- Cosa inserisce:
-- - 1 responsabile per l'unica squadra
-- - 20 giocatori, tutti nella stessa squadra
-- - un certificato medico approvato per ciascuno dei 20 giocatori,
--   con scadenze diverse apposta: 7 già scaduti, 6 in scadenza entro
--   due mesi da oggi, 7 ancora validi a lungo (così si vedono subito
--   tutti i casi nelle pagine Approvazione e Archivio)
-- - 3 segnalazioni di esempio: una ancora da gestire, una già
--   collegata a un giocatore (che quindi si ritrova anche un secondo
--   certificato "in attesa"), una scartata
-- - qualche riga di storico in "notifiche_inviate"
-- - i dati di esempio della pagina Contatti, dentro "impostazioni_sito"
--
-- IMPORTANTE sulle foto: nessuno di questi certificati o segnalazioni
-- ha una foto vera allegata (non si può "inventare" una foto reale
-- nello spazio di archiviazione di Supabase). Se apri il dettaglio di
-- uno di questi e clicchi per vedere la foto, il sito dirà "Foto non
-- trovata": è normale, non è un errore.
--
-- Come usarlo: uguale agli altri script — apri il progetto su
-- supabase.com, vai su "SQL Editor", "New query", incolla tutto
-- questo file, clicca "Run".
-- ============================================================

begin;

-- 1) Un responsabile per l'unica squadra.
with nuova_persona_responsabile as (
  insert into persona (nome, cognome, email)
  values ('Giovanni', 'Marchetti', 'stage02@engimedia.it')
  returning id
),
squadra as (
  select id as id_squadra from squadre order by id limit 1
)
insert into responsabili (id_persona, id_squadra)
select p.id, s.id_squadra
from nuova_persona_responsabile p, squadra s;

-- 2) 20 giocatori, tutti nella stessa squadra e collegati allo stesso
--    responsabile, con un certificato medico approvato ciascuno
--    (scadenze diverse apposta).
with nuove_persone as (
  insert into persona (nome, cognome, email, data_nascita)
  values
    ('Giulia',      'Esposito',    'stage02@engimedia.it', '2007-03-14'),
    ('Alessandro',  'Fontana',     'stage02@engimedia.it', '2008-07-22'),
    ('Chiara',      'Barbieri',    'stage02@engimedia.it', '2006-11-05'),
    ('Stefano',     'Gatti',       'stage02@engimedia.it', '2007-09-30'),
    ('Valentina',   'Mariani',     'stage02@engimedia.it', '2008-01-18'),
    ('Emanuele',    'Rinaldi',     'stage02@engimedia.it', '2006-05-27'),
    ('Sara',        'Caruso',      'stage02@engimedia.it', '2007-12-02'),
    ('Michele',     'Longo',       'stage02@engimedia.it', '2008-04-09'),
    ('Elisa',       'Villa',       'stage02@engimedia.it', '2006-08-16'),
    ('Daniele',     'Testa',       'stage02@engimedia.it', '2007-06-25'),
    ('Martina',     'Serra',       'stage02@engimedia.it', '2008-02-11'),
    ('Antonio',     'Leone',       'stage02@engimedia.it', '2006-10-19'),
    ('Giorgia',     'Farina',      'stage02@engimedia.it', '2007-01-08'),
    ('Paolo',       'Sartori',     'stage02@engimedia.it', '2008-05-30'),
    ('Beatrice',    'Pellegrini',  'stage02@engimedia.it', '2006-12-24'),
    ('Luigi',       'De Santis',   'stage02@engimedia.it', '2007-07-17'),
    ('Francesca',   'Palumbo',     'stage02@engimedia.it', '2008-03-03'),
    ('Salvatore',   'Grasso',      'stage02@engimedia.it', '2006-09-21'),
    ('Ilaria',      'Vitale',      'stage02@engimedia.it', '2007-11-13'),
    ('Roberto',     'Basile',      'stage02@engimedia.it', '2008-06-06')
  returning id
),
persone_numerate as (
  select id, row_number() over () as rn from nuove_persone
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
           'destro','destro','sinistro','destro','sinistro'])[pn.rn] as piede_preferito
  from persone_numerate pn
),
squadra_unica as (
  select id as id_squadra from squadre order by id limit 1
),
responsabile_unico as (
  select id as id_responsabile from responsabili order by id limit 1
),
nuovi_giocatori as (
  insert into giocatori (id_persona, id_squadra, id_responsabile, ruolo, piede_preferito)
  select
    pcd.id,
    su.id_squadra,
    ru.id_responsabile,
    pcd.ruolo,
    pcd.piede_preferito
  from persone_con_dati pcd, squadra_unica su, responsabile_unico ru
  returning id, id_persona
),
giocatori_con_rn as (
  select ng.id as id_giocatore, pcd.rn
  from nuovi_giocatori ng
  join persone_con_dati pcd on pcd.id = ng.id_persona
),
scadenze as (
  select
    gcr.id_giocatore,
    (array[
      '2025-01-15','2025-06-20','2025-11-10','2026-02-05','2026-05-18','2026-07-30','2026-09-01',
      '2026-09-22','2026-09-30','2026-10-10','2026-10-22','2026-11-02','2026-11-12',
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

-- 3) Segnalazioni di esempio: una da gestire, una collegata (con un
--    secondo certificato "in attesa" per la prima giocatrice inserita
--    sopra, Giulia Esposito), una scartata.
with primo_giocatore as (
  select g.id as id_giocatore
  from giocatori g
  join persona p on p.id = g.id_persona
  where p.nome = 'Giulia' and p.cognome = 'Esposito'
  order by g.id desc
  limit 1
),
certificato_collegato as (
  insert into certificati_medici (id_giocatore, stato, data_rilascio, nota)
  select id_giocatore, 'attesa', current_date - 2, 'Certificato di esempio (segnalazione collegata)'
  from primo_giocatore
  returning id, id_giocatore
)
insert into segnalazioni_certificati
  (nome, cognome, data_rilascio, nota, foto_path, stato, id_giocatore_collegato, id_certificato_creato, creato_il, gestito_il)
select 'Giulia', 'Esposito', current_date - 2, null,
       'segnalazioni/esempio-collegata.jpg', 'collegata', cc.id_giocatore, cc.id,
       now() - interval '3 days', now() - interval '2 days'
from certificato_collegato cc
union all
select 'Simone', 'Verdi', current_date - 1, null,
       'segnalazioni/esempio-da-gestire.jpg', 'in_attesa', null, null,
       now() - interval '1 day', null
union all
select 'Paolo', 'Neri', current_date - 10, 'Nome scritto poco leggibile nella foto',
       'segnalazioni/esempio-scartata.jpg', 'scartata', null, null,
       now() - interval '10 days', now() - interval '9 days';

-- 4) Qualche riga di storico in "notifiche_inviate", per non trovare
--    la pagina Certificati medici > Segnalazioni > Storico vuota.
insert into notifiche_inviate (id_certificato, tipo, nome_giocatore, cognome_giocatore, data_invio, destinatario)
select c.id, 'approvato', p.nome, p.cognome, c.data_approvazione, p.email
from certificati_medici c
join giocatori g on g.id = c.id_giocatore
join persona p on p.id = g.id_persona
where c.stato = 'approvato'
order by c.data_approvazione desc
limit 5;

insert into notifiche_inviate (tipo, nome_giocatore, cognome_giocatore, data_invio, destinatario)
values ('scartato', 'Paolo', 'Neri', now() - interval '9 days', null);

-- 5) Dati di esempio per la pagina Contatti (Impostazioni sito).
update impostazioni_sito
set
  indirizzo = 'Via dello Sport 12, Rio',
  telefono = '0421 123456',
  email = 'stage02@engimedia.it',
  campo_gioco = 'Campo Comunale di Rio'
where id = 1;

commit;

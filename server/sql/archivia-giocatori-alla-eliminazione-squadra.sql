-- ============================================================
-- Fa in modo che, quando elimini una squadra dal sito, i suoi
-- giocatori NON blocchino più l'eliminazione: vengono invece
-- archiviati automaticamente (come quando elimini un giocatore
-- singolarmente), e di conseguenza tutti i loro certificati medici
-- finiscono nella sezione "Archiviati" dell'Archivio.
--
-- Perché serve questo script: nel database, ogni giocatore è
-- collegato alla sua squadra tramite "id_squadra", ed era obbligatorio
-- (non poteva essere vuoto). Se si prova a cancellare una squadra
-- mentre dei giocatori la puntano ancora, il database rifiuta
-- l'operazione per non lasciare collegamenti "rotti". Questo script:
--   1. rende il campo "id_squadra" dei giocatori facoltativo;
--   2. dice al database che, se la squadra a cui un giocatore è
--      collegato viene eliminata, quel collegamento va semplicemente
--      svuotato (invece di bloccare tutto).
--
-- Con questo script installato, un giocatore archiviato perché la sua
-- squadra è stata eliminata non avrà più una squadra indicata (nel suo
-- riquadro comparirà "—" al posto del nome della squadra): il resto
-- dei suoi dati e tutti i suoi certificati restano invece intatti
-- nell'archivio.
--
-- Come usarlo:
-- 1. Apri il progetto su supabase.com
-- 2. Nel menu a sinistra vai su "SQL Editor"
-- 3. Clicca "New query"
-- 4. Incolla tutto questo file
-- 5. Clicca "Run" (o il pulsante Play)
--
-- Si può eseguire più di una volta senza rompere nulla.
-- ============================================================

-- Toglie il vecchio collegamento tra giocatori e squadre (qualsiasi
-- sia il suo nome esatto nel database) e ne crea uno nuovo che, alla
-- cancellazione di una squadra, svuota il campo invece di bloccare
-- l'operazione.
do $$
declare
  vincolo text;
begin
  select tc.constraint_name into vincolo
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'giocatori'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'id_squadra';

  if vincolo is not null then
    execute format('alter table giocatori drop constraint %I', vincolo);
  end if;
end $$;

alter table giocatori
  add constraint giocatori_id_squadra_fkey
  foreign key (id_squadra) references squadre(id) on delete set null;

-- Da qui in avanti un giocatore può restare temporaneamente senza
-- squadra (succede solo quando la sua squadra viene eliminata: quando
-- se ne crea uno nuovo dal sito, la squadra resta comunque obbligatoria).
alter table giocatori alter column id_squadra drop not null;

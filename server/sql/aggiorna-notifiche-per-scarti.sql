-- ============================================================
-- Aggiorna la tabella "notifiche_inviate" per poter registrare
-- anche gli avvisi mandati quando un certificato viene SCARTATO
-- (finora la tabella registrava solo le approvazioni).
--
-- Perché serve: quando un certificato viene scartato, la riga in
-- "certificati_medici" viene eliminata del tutto (come richiesto:
-- "come se non fosse mai stato caricato"). Se lasciassimo la tabella
-- delle notifiche collegata a quella riga come prima, la notifica
-- dello scarto sparirebbe insieme al certificato eliminato. Con
-- questo script:
--   - il collegamento al certificato diventa "opzionale": se il
--     certificato viene poi eliminato, la notifica resta comunque
--     nello storico (semplicemente non risulta più collegata a
--     nessun certificato specifico, che tanto non esiste più);
--   - salviamo anche nome e cognome del giocatore e il tipo di
--     avviso ("approvato" oppure "scartato") direttamente nella
--     riga della notifica, così lo storico resta leggibile anche
--     dopo che un certificato è stato eliminato.
--
-- Come usarlo: uguale agli altri script — SQL Editor su
-- supabase.com, incolla, Run. Si può eseguire anche più di una
-- volta senza problemi.
-- ============================================================

begin;

alter table notifiche_inviate add column if not exists tipo text;
alter table notifiche_inviate add column if not exists nome_giocatore text;
alter table notifiche_inviate add column if not exists cognome_giocatore text;

alter table notifiche_inviate alter column id_certificato drop not null;

alter table notifiche_inviate drop constraint if exists notifiche_inviate_id_certificato_fkey;

alter table notifiche_inviate
  add constraint notifiche_inviate_id_certificato_fkey
  foreign key (id_certificato) references certificati_medici(id) on delete set null;

commit;

-- ============================================================
-- Correzione veloce: la tabella "persona" del progetto nuovo era già
-- stata creata la prima volta con la regola dell'email unica (prima
-- che la togliessimo dallo script). "create table if not exists" non
-- rifà una tabella che esiste già, quindi quella regola era rimasta
-- attiva: questo comando la toglie per davvero.
--
-- Come usarlo: SQL Editor su supabase.com, incolla, Run. Dopo averlo
-- eseguito, rilancia "dati-di-esempio-nuovo-progetto.sql".
-- ============================================================

alter table persona drop constraint if exists persona_email_key;

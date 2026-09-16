-- ============================================================
-- Svuota COMPLETAMENTE tutte le tabelle del progetto (torna come se
-- fosse appena stato creato, ma senza dover ricreare le tabelle).
--
-- Usalo solo sul progetto NUOVO, per ripulire i tentativi fatti finora
-- prima di rifare tutto da capo pulito. NON eseguirlo mai sul
-- progetto vecchio (quello con l'email personale): cancellerebbe
-- tutto anche lì.
--
-- Come usarlo: SQL Editor su supabase.com (progetto nuovo), incolla,
-- Run. Poi, in ordine:
-- 1. schema-completo-nuovo-progetto.sql
-- 2. dati-di-esempio-nuovo-progetto.sql
-- ============================================================

truncate table
  notifiche_inviate,
  segnalazioni_certificati,
  certificati_medici,
  giocatori,
  responsabili,
  persona,
  squadre,
  impostazioni_sito
restart identity cascade;

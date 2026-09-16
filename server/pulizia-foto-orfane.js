// ============================================================
// Pulizia una tantum delle foto "orfane" nello spazio di
// archiviazione (Storage) dei certificati medici: foto che sono
// rimaste salvate lì ma che non sono più collegate a nessuna riga
// né in "certificati_medici" né in "segnalazioni_certificati" (per
// esempio le foto dei certificati scartati PRIMA che il server
// cominciasse a eliminarle in automatico — vedi il commento sopra
// "DELETE /api/certificati/:id" in server.js).
//
// Le foto delle segnalazioni contano come "ancora in uso" anche se
// la segnalazione è già stata collegata o scartata: le teniamo
// sempre, per lo storico della pagina Segnalazioni.
//
// Come si usa (da dentro la cartella "server"):
//   node pulizia-foto-orfane.js            -> mostra solo l'elenco
//                                              di cosa verrebbe
//                                              eliminato, senza
//                                              cancellare nulla
//   node pulizia-foto-orfane.js --elimina  -> elimina davvero le
//                                              foto orfane trovate
//
// Consiglio: lanciarlo prima SENZA "--elimina" e controllare che
// l'elenco abbia senso, poi rilanciarlo con "--elimina" per
// eliminare davvero. Una foto eliminata da qui non si può
// recuperare.
// ============================================================

const supabase = require('./src/supabaseClient');

const BUCKET_CERTIFICATI = 'certificati-medici';
const eseguireEliminazione = process.argv.includes('--elimina');

// Elenca tutti i file dentro il bucket, comprese le sottocartelle
// "giocatore-<id>/" e "segnalazioni/" (Supabase Storage restituisce
// le cartelle come voci senza "id": bisogna rientrarci a mano).
async function elencaTuttiIFile() {
  const file = [];
  const { data: voci, error } = await supabase.storage.from(BUCKET_CERTIFICATI).list('', { limit: 1000 });
  if (error) throw error;

  for (const voce of voci || []) {
    if (voce.id === null) {
      // è una "cartella"
      const { data: sottoVoci, error: erroreSotto } = await supabase.storage
        .from(BUCKET_CERTIFICATI)
        .list(voce.name, { limit: 1000 });
      if (erroreSotto) throw erroreSotto;
      for (const sottoVoce of sottoVoci || []) {
        if (sottoVoce.id !== null) {
          file.push(voce.name + '/' + sottoVoce.name);
        }
      }
    } else {
      file.push(voce.name);
    }
  }
  return file;
}

async function main() {
  const tuttiIFile = await elencaTuttiIFile();

  const { data: certificati, error: erroreCertificati } = await supabase
    .from('certificati_medici')
    .select('foto_path');
  if (erroreCertificati) throw erroreCertificati;

  const { data: segnalazioni, error: erroreSegnalazioni } = await supabase
    .from('segnalazioni_certificati')
    .select('foto_path');
  if (erroreSegnalazioni) throw erroreSegnalazioni;

  const referenziati = new Set();
  for (const c of certificati || []) if (c.foto_path) referenziati.add(c.foto_path);
  for (const s of segnalazioni || []) if (s.foto_path) referenziati.add(s.foto_path);

  const orfani = tuttiIFile.filter((f) => !referenziati.has(f));

  console.log('File totali nello Storage:', tuttiIFile.length);
  console.log('Foto ancora collegate a un certificato o una segnalazione:', referenziati.size);
  console.log('File orfani trovati:', orfani.length);
  orfani.forEach((f) => console.log('  -', f));

  if (!orfani.length) {
    console.log('Niente da eliminare: lo Storage è già pulito.');
    return;
  }

  if (!eseguireEliminazione) {
    console.log('\n(Questa è solo una verifica: nessun file è stato eliminato. Rilancia con "node pulizia-foto-orfane.js --elimina" per eliminarli davvero.)');
    return;
  }

  const { error: erroreEliminazione } = await supabase.storage.from(BUCKET_CERTIFICATI).remove(orfani);
  if (erroreEliminazione) throw erroreEliminazione;
  console.log('\nEliminati', orfani.length, 'file orfani.');
}

main().catch((errore) => {
  console.error('Errore durante la pulizia:', errore.message || errore);
  process.exit(1);
});

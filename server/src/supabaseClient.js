// Questo file crea un unico "collegamento" al database Supabase,
// che poi viene riutilizzato da tutto il resto del server (require('./supabaseClient')).

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Mancano SUPABASE_URL o SUPABASE_KEY: controlla di aver creato il file .env (a partire da .env.example) con i tuoi valori reali.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;

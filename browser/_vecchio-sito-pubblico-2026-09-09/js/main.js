// Struttura del sito in stile "club professionistico": menu orizzontale fisso
// in alto, hero grande in home, contenuto sotto (#content) che cambia in base
// alla voce scelta. I testi con 🚧 sono segnaposto.
//
// Non essendoci ancora foto reali della società, al loro posto sono usate
// illustrazioni semplici (icone SVG), chiaramente disegni e non fotografie,
// da sostituire con le foto vere non appena disponibili.
//
// Sito solo pubblico: niente più login, account, profili o aree riservate.
// Le pagine mostrano solo contenuti visibili a chiunque le apra.

const ICON_CREST = `<svg viewBox="0 0 100 120" class="icon-illustration"><path d="M50 4 L92 20 V56 C92 86 74 106 50 116 C26 106 8 86 8 56 V20 Z"/><circle cx="50" cy="55" r="16" stroke-width="3"/><path d="M50 39 V71 M34 55 H66"/></svg>`;
const ICON_TROPHY = `<svg viewBox="0 0 100 100" class="icon-illustration"><path d="M30 10 H70 V30 C70 46 58 56 50 56 C42 56 30 46 30 30 Z"/><path d="M30 16 H16 C16 30 24 38 30 40"/><path d="M70 16 H84 C84 30 76 38 70 40"/><line x1="50" y1="56" x2="50" y2="72"/><line x1="34" y1="88" x2="66" y2="88"/><path d="M40 72 H60 L64 88 H36 Z"/></svg>`;
const ICON_JERSEY = `<svg viewBox="0 0 100 100" class="icon-illustration"><path d="M30 10 L10 26 L22 40 L30 34 V90 H70 V34 L78 40 L90 26 L70 10 C70 18 61 24 50 24 C39 24 30 18 30 10 Z"/></svg>`;
const ICON_HANDSHAKE = `<svg viewBox="0 0 100 100" class="icon-illustration"><circle cx="38" cy="40" r="17"/><circle cx="66" cy="40" r="17"/><path d="M20 90 C20 68 30 58 44 60 M84 90 C84 68 74 58 60 60"/></svg>`;
// Figura stilizzata "cartoon" di un calciatore che calcia il pallone: usata al posto di una vera foto squadra.
const ICON_PLAYER = `<svg viewBox="0 0 100 100" class="icon-figure"><circle cx="78" cy="80" r="7"/><rect x="42" y="55" width="9" height="30" rx="4"/><g transform="rotate(-35 52 58)"><rect x="52" y="55" width="9" height="30" rx="4"/></g><g transform="rotate(8 50 45)"><rect x="38" y="28" width="24" height="32" rx="8"/></g><g transform="rotate(-25 40 34)"><rect x="36" y="30" width="8" height="22" rx="4"/></g><g transform="rotate(35 62 34)"><rect x="58" y="30" width="8" height="22" rx="4"/></g><circle cx="50" cy="16" r="11"/></svg>`;

// Icona "foto" (rettangolo con lente e profilo di montagne, come le classiche
// icone segnaposto delle immagini): usata al posto delle vecchie mascotte, in
// tutti i riquadri dove in futuro andrà una foto vera della società.
const ICON_PHOTO = `<svg viewBox="0 0 100 100" class="icon-illustration"><rect x="8" y="20" width="84" height="64" rx="8"/><circle cx="34" cy="42" r="9"/><path d="M12 74 L38 48 L56 64 L72 44 L88 62"/></svg>`;

// Squadra scelta nella pagina pubblica "Squadre", per sapere di quale
// squadra leggere la rosa vera dal database ({ id, nome }).
let selectedRosterTeam = null;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Genera una sequenza di "righe" di riquadri segnaposto in stile griglia da
// fumetto: nessuna sovrapposizione, dimensioni diverse (altezza per riga, e
// da una a tre foto per riga, di larghezza diversa), separati sempre dalla
// stessa distanza (gap), proprio come i modelli di tavole a fumetti presi
// come riferimento.
function heroCascadePanelRows() {
  const rowCount = 9 + Math.floor(Math.random() * 3);
  let rows = '';
  for (let i = 0; i < rowCount; i += 1) {
    // Altezza più generosa (non più "schiacciata" come prima) e larghezza
    // proporzionata, così quando ci sarà una foto vera non dovrà essere
    // tagliata per riempire una cornice dalle proporzioni esagerate.
    const height = Math.round(74 + Math.random() * 46);
    const panelBasis = () => Math.round(height * (0.75 + Math.random() * 0.5));
    const roll = Math.random();
    const panelCount = roll < 0.35 ? 1 : (roll < 0.75 ? 2 : 3);
    const panels = Array.from({ length: panelCount })
      .map(() => `<div class="cascade-panel" style="flex-basis:${panelBasis()}px;">${ICON_PHOTO}</div>`)
      .join('');
    rows += `<div class="cascade-row" style="height:${height}px;">${panels}</div>`;
  }
  return rows;
}

// Cascata (una per lato) che scorre all'infinito verso il basso: la stessa
// sequenza di righe è ripetuta due volte una sopra l'altra, e l'intera
// striscia si sposta verso l'alto della metà della propria altezza in
// loop continuo, così il punto in cui "si ricollega" non si vede mai.
function heroCascadeSide(duration) {
  const rowsHtml = heroCascadePanelRows();
  return `<div class="cascade-strip" style="--duration:${duration}s;">${rowsHtml}${rowsHtml}</div>`;
}

const views = {

  home: {
    render: () => `
      <div class="hero">
        <div class="hero-cascade-side" aria-hidden="true">${heroCascadeSide(34)}</div>
        <div class="hero-inner">
          <p class="eyebrow">Affiliata Calcio Padova</p>
          <h1>U.S. RIO A.S.D.</h1>
          <p>Il sito ufficiale della società: storia, squadre, notizie e tutto ciò che riguarda U.S. Rio.</p>
          <div class="hero-crest">
            <img src="img/logo.png" alt="Stemma U.S. Rio">
          </div>
          <div class="hero-photo">
            <div class="hero-photo-row">${ICON_PHOTO}</div>
            <span class="hero-photo-note">Foto della squadra in arrivo</span>
          </div>
        </div>
        <div class="hero-cascade-side" aria-hidden="true">${heroCascadeSide(40)}</div>
      </div>

      <div class="view-inner">
        <div class="showcase-grid">
          <div class="showcase-card" data-view="societa">
            <div class="thumb">${ICON_PHOTO}</div>
            <div class="body">
              <span class="name">Società</span>
              <span class="desc">Chi siamo e l'affiliazione con il Calcio Padova.</span>
            </div>
          </div>
          <div class="showcase-card" data-view="squadre">
            <div class="thumb">${ICON_PHOTO}</div>
            <div class="body">
              <span class="name">Squadre</span>
              <span class="desc">Le categorie della società, dal settore giovanile alla prima squadra.</span>
            </div>
          </div>
          <div class="showcase-card" data-view="bacheca">
            <div class="thumb">${ICON_PHOTO}</div>
            <div class="body">
              <span class="name">Bacheca</span>
              <span class="desc">Notizie, risultati e comunicati.</span>
            </div>
          </div>
        </div>
      </div>
    `
  },

  societa: {
    render: () => `
      <div class="view-inner">
        <div class="view-header">
          <p class="eyebrow">Il club</p>
          <h1>Società</h1>
          <p class="view-sub">Chi è U.S. Rio A.S.D., e il suo legame con il Calcio Padova.</p>
        </div>
        <div class="prose">
          <p>U.S. Rio A.S.D. è affiliata al Calcio Padova, con cui collabora nell'ambito del settore giovanile.</p>
        </div>
        <div class="photo-slot photo-slot-chibi">
          <div class="hero-photo-row">${ICON_PHOTO}</div>
          <span>Foto sede/dirigenza in arrivo</span>
        </div>
        <div class="placeholder-card">
          <strong>🚧 Testo segnaposto.</strong> Questa sezione andrà completata con i contenuti reali forniti dalla società: descrizione ufficiale, dettagli dell'affiliazione con il Calcio Padova (settore giovanile, scuola calcio, collaborazione tecnica), organigramma/dirigenza e sede sociale.
        </div>

        <div class="sub-menu">
          <p class="sub-menu-label">Vedi anche</p>
          <div class="showcase-grid">
            <div class="showcase-card" data-view="storia">
              <div class="thumb">${ICON_PHOTO}</div>
              <div class="body">
                <span class="name">Storia</span>
                <span class="desc">Le tappe principali della storia del club.</span>
              </div>
            </div>
            <div class="showcase-card" data-view="sponsor">
              <div class="thumb">${ICON_PHOTO}</div>
              <div class="body">
                <span class="name">Sponsor</span>
                <span class="desc">Le aziende che sostengono U.S. Rio A.S.D.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  },

  storia: {
    render: () => `
      <div class="view-inner">
        <div class="view-header">
          <p class="eyebrow">Società &rsaquo; Storia</p>
          <h1>Storia</h1>
          <p class="view-sub">Le tappe principali della storia di U.S. Rio A.S.D.</p>
        </div>
        <div class="photo-slot photo-slot-chibi">
          <div class="hero-photo-row">${ICON_PHOTO}</div>
          <span>Foto storiche in arrivo</span>
        </div>
        <div class="placeholder-card">
          <strong>🚧 Testo segnaposto.</strong> Qui andrà la storia reale della società: anno di fondazione, tappe principali, eventuali fusioni o cambi di denominazione, risultati storici e aneddoti. In attesa dei contenuti reali da parte della società.
        </div>
      </div>
    `
  },

  // Elenco delle squadre: adesso letto davvero dal database (tabella
  // "squadre"), tramite la route /api/squadre del server. render() mostra
  // subito un messaggio di caricamento; afterRender() fa la richiesta e
  // riempie la griglia quando arriva la risposta.
  squadre: {
    render: () => `
      <div class="view-inner">
        <div class="view-header">
          <p class="eyebrow">Il club</p>
          <h1>Squadre</h1>
          <p class="view-sub">Le categorie della società, dal settore giovanile alla prima squadra.</p>
        </div>
        <div class="showcase-grid" id="squadreGrid">
          <p class="loading-note">Caricamento squadre dal database…</p>
        </div>
      </div>
    `,
    afterRender: async () => {
      const grid = document.getElementById('squadreGrid');
      try {
        const res = await fetch('/api/squadre');
        if (!res.ok) throw new Error('Richiesta non riuscita');
        const squadre = await res.json();

        if (!squadre.length) {
          grid.innerHTML = '<p class="loading-note">Nessuna squadra trovata nel database.</p>';
          return;
        }

        grid.innerHTML = squadre.map((s, i) => `
          <div class="showcase-card" data-view="rosasquadra" data-team-id="${escapeHtml(String(s.id))}" data-team-name="${escapeHtml(s.nome)}">
            <div class="thumb thumb-chibi">${ICON_PHOTO}</div>
            <div class="body">
              <span class="name">${escapeHtml(s.nome)}</span>
              <span class="desc">Rosa e informazioni della categoria.</span>
            </div>
          </div>
        `).join('');
      } catch (err) {
        grid.innerHTML = `
          <div class="placeholder-card">
            <strong>⚠️ Squadre non disponibili.</strong> Non è stato possibile leggere le squadre dal server: controlla che il server sia avviato e collegato al database.
          </div>
        `;
      }
    }
  },

  // Rosa di una singola squadra, aperta cliccando una delle card nella
  // pagina Squadre. Pagina pubblica: mostra solo nome, cognome e ruolo,
  // letti davvero dal database tramite il server.
  rosasquadra: {
    render: () => {
      const teamName = selectedRosterTeam ? selectedRosterTeam.nome : 'Squadra';
      return `
        <div class="view-inner">
          <div class="view-header">
            <p class="eyebrow">Squadre &rsaquo; ${escapeHtml(teamName)}</p>
            <h1>${escapeHtml(teamName)}</h1>
            <p class="view-sub">Rosa e informazioni della categoria.</p>
          </div>
          <div id="rosaContent">
            <p class="loading-note">Caricamento rosa dal database…</p>
          </div>
        </div>
      `;
    },
    afterRender: async () => {
      const container = document.getElementById('rosaContent');

      if (!selectedRosterTeam || !selectedRosterTeam.id) {
        container.innerHTML = `
          <div class="placeholder-card">
            <strong>🚧 Nessuna squadra selezionata.</strong> Torna alla pagina Squadre e scegline una.
          </div>
        `;
        return;
      }

      try {
        const res = await fetch(`/api/squadre/${encodeURIComponent(selectedRosterTeam.id)}/giocatori`);
        if (!res.ok) throw new Error('Richiesta non riuscita');
        const giocatori = await res.json();

        if (!giocatori.length) {
          container.innerHTML = `
            <div class="placeholder-card">
              <strong>Nessun giocatore trovato.</strong> Non ci sono ancora giocatori assegnati a questa squadra nel database.
            </div>
          `;
          return;
        }

        container.innerHTML = `
          <table class="table-preview">
            <tr><th>Giocatore</th><th>Ruolo</th></tr>
            ${giocatori.map((g) => `<tr><td>${escapeHtml(g.nome || '')} ${escapeHtml(g.cognome || '')}</td><td>${escapeHtml(g.ruolo || '—')}</td></tr>`).join('')}
          </table>
        `;
      } catch (err) {
        container.innerHTML = `
          <div class="placeholder-card">
            <strong>⚠️ Errore.</strong> Non è stato possibile leggere i giocatori dal server: controlla che il server sia avviato e collegato al database.
          </div>
        `;
      }
    }
  },

  bacheca: {
    render: () => `
      <div class="view-inner">
        <div class="view-header">
          <p class="eyebrow">Il club</p>
          <h1>Bacheca</h1>
          <p class="view-sub">Notizie, risultati e comunicati della società.</p>
        </div>
        <div class="photo-slot photo-slot-chibi">
          <div class="hero-photo-row">${ICON_PHOTO}</div>
          <span>Foto delle giornate di campionato in arrivo</span>
        </div>
        <div class="news-list">
          <div class="news-item">
            <span class="news-date">Notizia di esempio</span>
            <h3>Titolo della notizia</h3>
            <p>Testo di esempio: qui comparirà l'anteprima di una notizia reale della società, con data e breve descrizione.</p>
          </div>
          <div class="news-item">
            <span class="news-date">Notizia di esempio</span>
            <h3>Titolo della notizia</h3>
            <p>Testo di esempio: qui comparirà l'anteprima di una notizia reale della società, con data e breve descrizione.</p>
          </div>
        </div>
        <div class="placeholder-card">
          <strong>🚧 Notizie di esempio.</strong> Questa sezione mostrerà le news reali della società (risultati, comunicati, eventi) man mano che verranno fornite.
        </div>
      </div>
    `
  },

  sponsor: {
    render: () => `
      <div class="view-inner">
        <div class="view-header">
          <p class="eyebrow">Società &rsaquo; Sponsor</p>
          <h1>Sponsor</h1>
          <p class="view-sub">Le aziende che sostengono U.S. Rio A.S.D.</p>
        </div>
        <div class="photo-slot photo-slot-chibi">
          <div class="hero-photo-row">${ICON_PHOTO}</div>
          <span>Foto con gli sponsor in arrivo</span>
        </div>
        <div class="sponsor-strip">
          ${Array.from({length:5}).map(() => `<div class="sponsor-box">Logo sponsor</div>`).join('')}
        </div>
        <div class="placeholder-card">
          <strong>🚧 Sezione da completare.</strong> Qui andranno i loghi e i nomi degli sponsor della società, quando forniti.
        </div>
      </div>
    `
  },

  contatti: {
    render: () => `
      <div class="view-inner">
        <div class="view-header">
          <p class="eyebrow">Il club</p>
          <h1>Contatti</h1>
          <p class="view-sub">Come mettersi in contatto con la società.</p>
        </div>
        <div class="photo-slot photo-slot-chibi">
          <div class="hero-photo-row">${ICON_PHOTO}</div>
          <span>Vi aspettiamo al campo!</span>
        </div>
        <div class="placeholder-card">
          <strong>🚧 Dati da completare.</strong> Qui andranno indirizzo della sede/campo sportivo, email, telefono e social ufficiali della società.
        </div>
      </div>
    `
  }
};

function showView(key) {
  const view = views[key];
  if (!view) return;

  document.getElementById('content').innerHTML = view.render();

  document.querySelectorAll('.menu-item, .mobile-menu-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === key);
  });

  window.scrollTo({ top: 0, behavior: 'instant' });
  closeMobileMenu();

  // Alcune pagine (es. Squadre) mostrano prima un contenuto provvisorio
  // e poi lo completano quando arriva la risposta dal server.
  if (typeof view.afterRender === 'function') {
    view.afterRender();
  }
}

// Click sul menu orizzontale (desktop)
document.querySelector('.menu').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (!btn) return;
  showView(btn.dataset.view);
});

// Click sul menu a tutto schermo (mobile)
document.querySelector('.mobile-menu-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (!btn) return;
  showView(btn.dataset.view);
});

// Click sul logo/nome società: torna alla home
document.querySelector('.brand').addEventListener('click', (e) => {
  e.preventDefault();
  showView('home');
});

// Click sulle card cliccabili dentro il contenuto (es. home -> altre viste,
// squadre -> rosa di una squadra, che ha anche un data-team-id da ricordare
// prima di cambiare vista).
document.getElementById('content').addEventListener('click', (e) => {
  const card = e.target.closest('[data-view]');
  if (!card) return;
  if (card.dataset.teamId) {
    selectedRosterTeam = { id: card.dataset.teamId, nome: card.dataset.teamName || '' };
  }
  showView(card.dataset.view);
});

// Apertura/chiusura menu mobile a tutto schermo
const mobileMenu = document.getElementById('mobileMenu');
const menuToggle = document.getElementById('menuToggle');

menuToggle.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});

function closeMobileMenu() {
  mobileMenu.classList.remove('open');
}

// Vista iniziale
showView('home');

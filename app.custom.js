/* Wiring minimal du player, sans hack CORS ni URL absolue imposée. */

let hls = null;
let videoEl, pageInput, m3u8Input, info, startBtn, stopBtn, manualBtn, autoStart;
let drawer, togglePanelBtn, closePanelBtn;

document.addEventListener('DOMContentLoaded', () => {
  // DOM
  videoEl = document.getElementById('video');
  pageInput = document.getElementById('pageUrl');
  m3u8Input = document.getElementById('m3u8Url');
  info = document.getElementById('info');
  startBtn = document.getElementById('startBtn');
  stopBtn = document.getElementById('stopBtn');
  manualBtn = document.getElementById('manualInject');
  autoStart = document.getElementById('autoStart');
  drawer = document.getElementById('controlDrawer');
  togglePanelBtn = document.getElementById('togglePanel');
  closePanelBtn = document.getElementById('closePanel');

  // Actions
  startBtn.addEventListener('click', startPlayback);
  stopBtn.addEventListener('click', stopPlayback);
  manualBtn.addEventListener('click', manualInject);
  togglePanelBtn.addEventListener('click', toggleDrawer);
  closePanelBtn.addEventListener('click', closeDrawer);

  // Auto-start si coché
  if (autoStart?.checked) {
    // petit délai pour laisser HLS.js se charger
    setTimeout(startPlayback, 100);
  }

  // Ferme le panneau au scroll vers le bas pour garder l’écran propre
  let lastY = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY || 0;
    if (y > lastY) closeDrawer();
    lastY = y;
  }, { passive: true });
});

function setInfo(msg, isError = false) {
  if (!info) return;
  info.textContent = msg || '';
  info.style.color = isError ? '#ff8894' : '#9aa3b2';
}

function toggleDrawer(){
  const willOpen = !drawer.classList.contains('open');
  drawer.classList.toggle('open', willOpen);
  togglePanelBtn.setAttribute('aria-expanded', String(willOpen));
}
function closeDrawer(){
  drawer.classList.remove('open');
  togglePanelBtn.setAttribute('aria-expanded', 'false');
}

async function startPlayback(){
  const url = (m3u8Input?.value || '').trim();
  if (!url) {
    setInfo('Renseigne une URL m3u8 valide.', true);
    return;
  }
  stopPlayback(); // reset propre

  try {
    if (window.Hls?.isSupported()) {
      hls = new Hls({
        // options safe par défaut
        autoStartLoad: true,
        enableWorker: true,
        lowLatencyMode: true,
      });
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(url);
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data?.fatal) {
          setInfo(`Erreur fatale HLS: ${data.details || data.type}`, true);
          switch (data.type) {
            case 'networkError': hls.startLoad(); break;
            case 'mediaError': hls.recoverMediaError(); break;
            default: stopPlayback(); break;
          }
        } else {
          setInfo(`Avertissement HLS: ${data?.details || data?.type || 'inconnu'}`);
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = url;
    } else {
      setInfo('HLS non supporté par ce navigateur.', true);
      return;
    }

    // Tentative de lecture
    const p = videoEl.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        setInfo('Lecture démarrée.');
        startBtn.disabled = true;
        stopBtn.disabled = false;
      }).catch(() => {
        setInfo('Lecture bloquée par la politique autoplay. Clique sur Lecture.', true);
        startBtn.disabled = false;
        stopBtn.disabled = false;
      });
    }
  } catch (e) {
    setInfo(`Erreur démarrage: ${e?.message || e}`, true);
  }
}

function stopPlayback(){
  try {
    if (hls) {
      hls.destroy();
      hls = null;
    }
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
    }
  } catch {}
  startBtn && (startBtn.disabled = false);
  stopBtn && (stopBtn.disabled = true);
  setInfo('Lecture arrêtée.');
}

async function manualInject(){
  // Cette action se contente d’utiliser la valeur m3u8 fournie.
  // Si tu ajoutes plus tard une logique d’extraction depuis pageUrl, branche-la ici.
  const src = (m3u8Input?.value || '').trim();
  if (!src) {
    setInfo('Renseigne une URL m3u8 avant injection.', true);
    return;
  }
  setInfo('Injection manuelle du flux m3u8…');
  await startPlayback();
}

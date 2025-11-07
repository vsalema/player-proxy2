// app.js — Auto inject, token refresh via auth endpoint, WebSocket realtime detection.
// Déploye après DOMContentLoaded.

document.addEventListener('DOMContentLoaded', () => {
  console.log('[m3u8-watcher] ready');

  // DOM
  const pageInput = document.getElementById('pageUrl');
  const m3u8Input = document.getElementById('m3u8Url');
  const authInput = document.getElementById('authEndpoint');
  const wsInput = document.getElementById('wsEndpoint');
  const autoStartCheckbox = document.getElementById('autoStart');
  const pollIntervalInput = document.getElementById('pollInterval');
  const refreshIntervalInput = document.getElementById('refreshInterval');

  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const manualBtn = document.getElementById('manualInject');
  const info = document.getElementById('info');
  const video = document.getElementById('video');

  // State
  let pollTimer = null;
  let pollInterval = Number(pollIntervalInput.value) || 15000;
  let lastFound = null;
  let hls = null;
  let ws = null;
  let refreshTimer = null;

  function setInfo(t){ info.textContent = t; console.log('[m3u8-watcher]', t); }
  function destroyHls(){ if(hls){ try{ hls.destroy(); }catch(e){} hls = null; } }

  async function setSource(url){
    if(!url) { setInfo('URL vide'); return; }
    setInfo('Injection: ' + url);
    destroyHls();
    video.muted = true;

    const native = !!video.canPlayType && video.canPlayType('application/vnd.apple.mpegurl') !== '';
    if(native){
      try{
        video.src = url;
        await video.play();
        setInfo('Lecture native démarrée.');
        return;
      }catch(e){
        console.warn('native play failed', e);
      }
    }

    if(window.Hls && Hls.isSupported()){
      hls = new Hls();
      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('Hls error', data);
        setInfo('Erreur Hls.js: ' + (data && data.details || 'inconnue'));
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().then(()=> setInfo('Lecture Hls.js démarrée')).catch(()=> setInfo('Flux chargé. Appuyez sur play.'));
      });
    } else {
      setInfo('Hls.js non supporté et lecture native non disponible.');
    }
  }

  // Very simple regex to extract first .m3u8 or fallback .fmp4
  const reM3U8 = /https?:\/\/[^'"\s<>]+\.m3u8[^'"\s<>]*/i;
  const reAlt  = /https?:\/\/[^'"\s<>]+\.fmp4[^'"\s<>]*/i;

  function extractM3U8(html){
    if(!html) return null;
    const m = html.match(reM3U8);
    if(m) return m[0];
    const a = html.match(reAlt);
    return a ? a[0] : null;
  }

  async function fetchText(url){
    const resp = await fetch(url);
    if(!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.text();
  }

  // Poll page once: extract m3u8 and inject if changed
  async function pollOnce(){
    const pageUrl = pageInput.value.trim();
    if(!pageUrl){ setInfo('Saisir URL de page'); return; }
    try {
      setInfo('Fetch page...');
      const html = await fetchText(pageUrl);
      const found = extractM3U8(html);
      if(found && found !== lastFound){
        lastFound = found;
        m3u8Input.value = found;
        await setSource(found);
        setInfo('Nouvelle URL détectée et injectée.');
        // start token refresh loop if auth endpoint provided
        startTokenRefreshIfNeeded();
      } else if(!found){
        setInfo('Aucune .m3u8 trouvée.');
      } else {
        setInfo('Pas de changement.');
      }
    } catch(err){
      console.error(err);
      setInfo('Fetch failed: ' + err.message);
    }
  }

  function startPolling(){
    if(pollTimer) return;
    pollInterval = Number(pollIntervalInput.value) || 15000;
    pollOnce();
    pollTimer = setInterval(pollOnce, pollInterval);
    startBtn.disabled = true;
    stopBtn.disabled = false;
    setInfo('Surveillance démarrée.');
  }

  function stopPolling(){
    if(!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    setInfo('Surveillance arrêtée.');
  }

  // Manual inject
  manualBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const u = m3u8Input.value.trim();
    if(!u){ setIn

// AutoResume: démarre, restaure le dernier flux valide depuis localStorage, et injecte sans clic.
document.addEventListener('DOMContentLoaded', () => {
  console.log('[m3u8-watcher] ready');

  const pageInput = document.getElementById('pageUrl');
  const m3u8Input = document.getElementById('m3u8Url');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const manualBtn = document.getElementById('manualInject');
  const info = document.getElementById('info');
  const video = document.getElementById('video');

  let pollTimer = null;
  let lastFound = null;
  let hls = null;

  const LS_KEY = 'm3u8_watcher_last_url';

  function setInfo(t){ info.textContent = t; console.log('[m3u8-watcher]', t); }
  function saveLast(url){ try{ localStorage.setItem(LS_KEY, url); }catch(e){} }
  function loadLast(){ try{ return localStorage.getItem(LS_KEY); }catch(e){ return null; } }
  function destroyHls(){ if(hls){ try{ hls.destroy(); }catch(e){} hls = null; } }

  async function setSource(url){
    if(!url){ setInfo('URL vide'); return; }
    setInfo('Injection: ' + url);
    destroyHls();
    video.muted = true;

    const native = !!video.canPlayType && video.canPlayType('application/vnd.apple.mpegurl') !== '';
    if(native){
      try{ 
        video.src = url; 
        await video.play().catch(()=>{});
        setInfo('Lecture native (si autorisée).'); 
        saveLast(url); 
        return; 
      }catch(e){ console.warn('native play failed', e); }
    }

    if(window.Hls && Hls.isSupported()){
      hls = new Hls();
      hls.on(Hls.Events.ERROR, (_, data)=>{ console.error('Hls error', data); setInfo('Erreur Hls.js'); });
      hls.on(Hls.Events.MANIFEST_PARSED, ()=>{
        video.play().then(()=> setInfo('Lecture Hls.js')).catch(()=> setInfo('Flux chargé. Appuyez sur play.'));
        saveLast(url);
      });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else {
      setInfo('Pas de support HLS');
    }
  }

  const reM3U8 = /https?:\/\/[^'"\s<>]+\.m3u8[^'"\s<>]*/i;
  async function fetchText(u){ const r = await fetch(u); if(!r.ok) throw new Error('HTTP '+r.status); return await r.text(); }

  async function pollOnce(){
    const pageUrl = pageInput.value.trim();
    if(!pageUrl){ setInfo('URL page manquante'); return; }
    try{
      setInfo('Récupération page...');
      const html = await fetchText(pageUrl);
      const m = html.match(reM3U8);
      const found = m ? m[0] : null;
      if(found && found !== lastFound){
        lastFound = found;
        m3u8Input.value = found;
        await setSource(found);
        setInfo('URL détectée et injectée.');
      } else if(!found){
        setInfo('Aucune .m3u8 trouvée.');
      } else {
        setInfo('Pas de changement.');
      }
    }catch(e){
      console.error(e);
      setInfo('Erreur: ' + e.message);
    }
  }

  function startPolling(){ if(pollTimer) return; pollOnce(); pollTimer=setInterval(pollOnce,15000); startBtn.disabled=true; stopBtn.disabled=false; setInfo('Surveillance démarrée.'); }
  function stopPolling(){ if(!pollTimer) return; clearInterval(pollTimer); pollTimer=null; startBtn.disabled=false; stopBtn.disabled=true; setInfo('Arrêté.'); }

  startBtn.addEventListener('click', e=>{ e.preventDefault(); startPolling(); });
  stopBtn.addEventListener('click', e=>{ e.preventDefault(); stopPolling(); });
  manualBtn.addEventListener('click', async e=>{ e.preventDefault(); const u=m3u8Input.value.trim(); if(!u) return; lastFound=u; await setSource(u); });

  // --- AutoResume sequence ---
  // 1) si un m3u8 est présent dans le champ, l'injecter immédiatement
  const initialField = (m3u8Input.value || '').trim();
  if(initialField){
    lastFound = initialField;
    setSource(initialField);
  } else {
    // 2) sinon, restaurer le dernier flux valide depuis localStorage
    const last = loadLast();
    if(last){
      m3u8Input.value = last;
      lastFound = last;
      setSource(last);
      setInfo('Reprise automatique du dernier flux valide.');
    }
  }

  // 3) démarrer la surveillance automatiquement
  setTimeout(()=>{ startPolling(); }, 400);
});

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

  function setInfo(t){ info.textContent = t; console.log('[m3u8-watcher]', t); }
  function destroyHls(){ if(hls){ try{ hls.destroy(); }catch(e){} hls = null; } }

  async function setSource(url){
    if(!url){ setInfo('URL vide'); return; }
    setInfo('Injection: ' + url);
    destroyHls();
    video.muted = true;
    const native = !!video.canPlayType && video.canPlayType('application/vnd.apple.mpegurl') !== '';
    if(native){
      try{ video.src = url; await video.play(); setInfo('Lecture native.'); return; }
      catch(e){ console.warn('native play failed', e); }
    }
    if(window.Hls && Hls.isSupported()){
      hls = new Hls();
      hls.on(Hls.Events.ERROR, (_, data)=>{ console.error('Hls error', data); setInfo('Erreur Hls.js'); });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, ()=>{ video.play().then(()=>setInfo('Lecture Hls.js')).catch(()=>setInfo('Flux chargé. Appuyez sur play.')); });
    } else setInfo('Pas de Hls support.');
  }

  const reM3U8 = /https?:\/\/[^'"\s<>]+\.m3u8[^'"\s<>]*/i;
  async function fetchText(url){ const r = await fetch(url); if(!r.ok) throw new Error('HTTP '+r.status); return await r.text(); }

  async function pollOnce(){
    const pageUrl = pageInput.value.trim();
    if(!pageUrl){ setInfo('URL manquante.'); return; }
    try{
      setInfo('Récupération page...');
      const html = await fetchText(pageUrl);
      const m = html.match(reM3U8);
      const found = m ? m[0] : null;
      if(found && found!==lastFound){ lastFound=found; m3u8Input.value=found; await setSource(found); setInfo('URL détectée et injectée.'); }
      else if(!found) setInfo('Aucune .m3u8 trouvée.');
      else setInfo('Pas de changement.');
    }catch(e){ console.error(e); setInfo('Erreur: '+e.message); }
  }

  function startPolling(){ if(pollTimer) return; pollOnce(); pollTimer=setInterval(pollOnce,15000); startBtn.disabled=true; stopBtn.disabled=false; setInfo('Surveillance démarrée.'); }
  function stopPolling(){ if(!pollTimer) return; clearInterval(pollTimer); pollTimer=null; startBtn.disabled=false; stopBtn.disabled=true; setInfo('Arrêté.'); }

  startBtn.addEventListener('click', e=>{ e.preventDefault(); startPolling(); });
  stopBtn.addEventListener('click', e=>{ e.preventDefault(); stopPolling(); });
  manualBtn.addEventListener('click', async e=>{ e.preventDefault(); const u=m3u8Input.value.trim(); if(!u) return; lastFound=u; await setSource(u); });

  // Force auto-start après chargement
  setTimeout(()=>{ startPolling(); }, 500);
});

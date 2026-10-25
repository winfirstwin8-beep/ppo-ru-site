/* Сповіщення про нові оголошення (крок 4).
   Оголошення — публічні дані з головної. На телефоні зберігаються лише позначки «прочитано / вже сповіщено»
   та налаштування; персональних даних членів тут немає. */
(function () {
  const BELL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>';
  const META = 'meta-ppo';
  const hasN = 'Notification' in window;
  const NKEY = n => (n['ID'] || '') + '|' + (n['Дата'] || '') + '|' + (n['Заголовок'] || '');
  const isPinned = n => n['Закріплено'] === 'Так';
  const getSet = k => { try { return new Set(JSON.parse(LS.get(k) || '[]')); } catch (e) { return new Set(); } };
  const putSet = (k, s) => LS.set(k, JSON.stringify([...s].slice(-300)));
  const importantOnly = () => LS.get('notifImportant') === '1';
  let LIST = [], lastCheck = 0;

  const unread = () => { const seen = getSet('seenNews'); return LIST.filter(n => !seen.has(NKEY(n))); };
  function updateBell() {
    const b = $('#bell'); if (!b) return;
    b.hidden = false;
    const c = unread().length, d = b.querySelector('.bdg');
    d.hidden = !c; d.textContent = c > 9 ? '9+' : String(c);
    b.setAttribute('aria-label', c ? 'Сповіщення, нових: ' + c : 'Сповіщення');
  }
  function markAllRead() { putSet('seenNews', new Set(LIST.map(NKEY))); updateBell(); }

  /* обмін з service worker (фонова перевірка на Android) */
  async function readMeta() { try { const c = await caches.open(META); const r = await c.match('meta'); return r ? await r.json() : {}; } catch (e) { return {}; } }
  async function writeMeta() {
    try {
      const old = await readMeta();
      const notified = new Set([...(old.notified || []), ...getSet('notifiedNews')]);
      const c = await caches.open(META);
      await c.put('meta', new Response(JSON.stringify({ api: window.PPO_API, important: importantOnly(), notified: [...notified].slice(-300) }), { headers: { 'Content-Type': 'application/json' } }));
    } catch (e) {}
  }
  async function registerPeriodic() {
    try {
      if (!('serviceWorker' in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      if (!('periodicSync' in reg)) return;
      const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (st.state === 'granted') await reg.periodicSync.register('ppo-news', { minInterval: 12 * 60 * 60 * 1000 });
    } catch (e) {}
  }

  async function showSys(title, body, tag) {
    if (!hasN || Notification.permission !== 'granted') return;
    const opt = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag, data: { href: '#/notifs' } };
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) await reg.showNotification(title, opt); else new Notification(title, opt);
    } catch (e) {}
  }

  function check(reload) {
    if (reload) H = null;
    lastCheck = Date.now();
    return loadHome().then(async h => {
      LIST = (h.news || []).slice(0, 30);
      const keys = LIST.map(NKEY);
      if (LS.get('notifInit') !== '1') { putSet('seenNews', new Set(keys)); putSet('notifiedNews', new Set(keys)); LS.set('notifInit', '1'); }
      const meta = await readMeta();
      const notified = new Set([...getSet('notifiedNews'), ...(meta.notified || [])]);
      const fresh = unread().filter(n => !notified.has(NKEY(n)) && (!importantOnly() || isPinned(n)));
      if (fresh.length) {
        if (document.visibilityState === 'visible') {
          toast(fresh.length > 1 ? 'Нових оголошень: ' + fresh.length : 'Нове оголошення: ' + fresh[0]['Заголовок']);
          if (reload && currentKey() === 'home' && !$('#main').hidden) ROUTES.home.render();
        } else {
          for (const n of fresh.slice(0, 3)) await showSys((isPinned(n) ? 'Важливо: ' : 'Нове оголошення: ') + n['Заголовок'], String(n['Текст'] || '').slice(0, 140), 'ppo-' + NKEY(n));
        }
        fresh.forEach(n => notified.add(NKEY(n)));
      }
      putSet('notifiedNews', notified);
      writeMeta();
      updateBell();
      if (currentKey() === 'notifs' && !$('#main').hidden) viewNotifs();
    }).catch(() => {});
  }

  function viewNotifs() {
    const seen = getSet('seenNews');
    const perm = hasN ? Notification.permission : 'unsupported';
    const permCard = perm === 'default'
      ? `<section class="card inst"><b>Отримувати сповіщення про нові оголошення?</b>
          <p class="note" style="margin:0">Телефон покаже повідомлення, коли профком опублікує нове оголошення. Вимкнути можна будь-коли.</p>
          <button type="button" class="btn pri full" id="nAllow">Увімкнути сповіщення</button></section>`
      : perm === 'granted' ? '<div class="okbar">Сповіщення увімкнено на цьому пристрої.</div>'
      : perm === 'denied' ? `<section class="card"><b>Сповіщення заблоковано в браузері.</b>
          <p class="note" style="margin:4px 0 0">Відкрийте налаштування сайту (значок замка біля адреси) і дозвольте «Сповіщення», потім оновіть сторінку.</p></section>`
      : `<section class="card"><p class="note" style="margin:0">Цей браузер не показує сповіщень. На iPhone спершу встановіть сайт на початковий екран («Ще» → «Встановити на телефон») і відкрийте його з іконки.</p></section>`;
    const list = LIST.length ? LIST.slice(0, 15).map(n => {
      const u = !seen.has(NKEY(n));
      return `<a class="nrow${u ? ' unread' : ''}" href="#/news"><span class="dot"></span><span class="nt"><span class="nm">${isPinned(n) ? 'Важливо · ' : ''}${esc(dmy(n['Дата']))}</span><span class="nh">${esc(n['Заголовок'])}</span></span></a>`;
    }).join('') : '<p class="empty" style="padding:12px 16px">Оголошень поки немає.</p>';
    const imp = importantOnly();
    $('#main').innerHTML = `${permCard}
      <section class="list">
        <button type="button" class="row tgl" id="nImp" aria-pressed="${imp}"><span class="t">Лише важливі<span class="s" style="display:block;font-weight:400">сповіщати тільки про закріплені оголошення</span></span><span class="swt${imp ? ' on' : ''}"><span></span></span></button>
      </section>
      <div class="nhead"><p class="kick">Останні оголошення</p>${unread().length ? '<button type="button" class="btn sm" id="nRead">Прочитати всі</button>' : ''}</div>
      <section class="list">${list}</section>
      <p class="note">Сповіщення приходять, коли сайт відкрито або повернуто на екран. На Android у встановленому застосунку — також у фоні, приблизно раз на 12 годин (як дозволяє Chrome).</p>`;
    if ($('#nAllow')) $('#nAllow').onclick = () => Notification.requestPermission().then(p => {
      if (p === 'granted') { registerPeriodic(); writeMeta(); showSys('ППО РУ', 'Сповіщення про нові оголошення увімкнено', 'ppo-on'); }
      viewNotifs();
    });
    $('#nImp').onclick = () => { LS.set('notifImportant', imp ? '0' : '1'); writeMeta(); viewNotifs(); };
    if ($('#nRead')) $('#nRead').onclick = () => { markAllRead(); viewNotifs(); };
    if (!LIST.length) check(false);
  }

  /* підключення до маршрутів сайту */
  ROUTES.notifs = { title: 'Сповіщення', nav: 'home', back: '#/home', render: viewNotifs };
  const origNews = ROUTES.news.render;
  ROUTES.news.render = function () { origNews(); loadHome().then(h => { LIST = (h.news || []).slice(0, 30); markAllRead(); }).catch(() => {}); };
  const origMenu = viewMenu;
  viewMenu = function () {
    origMenu();
    const nav = document.querySelector('#main nav.list');
    if (nav) {
      const a = document.createElement('a'); a.className = 'row'; a.href = '#/notifs';
      a.innerHTML = BELL + '<span class="t">Сповіщення</span><span class="s">' + (hasN && Notification.permission === 'granted' ? 'увімкнено' : 'вимкнено') + '</span>';
      nav.appendChild(a);
    }
  };
  ROUTES.menu.render = viewMenu;
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'NAV') location.hash = e.data.href; });

  check(false);
  if (hasN && Notification.permission === 'granted') registerPeriodic();
  setInterval(() => check(true), 15 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastCheck > 5 * 60 * 1000) check(true); });
  if (['notifs', 'menu'].includes(currentKey())) route();
})();

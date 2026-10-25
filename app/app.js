/* Портал ППО РУ — оболонка. Дані беруться з Apps Script (../config.js → window.PPO_API).
   Персональні дані членів тут не зберігаються: облік відкривається з Apps Script у рамці. */
const APP_VERSION = '1.2.0';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dmy = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : (s || '');
const linkify = t => esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
const initials = n => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
const nameShort = n => { const p = String(n || '').split(/\s+/); return p.length >= 3 ? p[0][0] + p[0].slice(1).toLowerCase() + ' ' + p[1] + ' ' + p[2] : n; };
const telA = p => p ? `<a href="tel:${esc(p.replace(/[^\d+]/g, ''))}">${esc(p)}</a>` : '';
const LS = { get(k) { try { return localStorage.getItem('ppo.' + k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem('ppo.' + k, v); } catch (e) {} } };
function toast(t) { const e = $('#toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(e._t); e._t = setTimeout(() => e.style.display = 'none', 3500); }
const I = {
  chev: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  join: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v10M7 12h10"/><circle cx="12" cy="12" r="9"/></svg>',
  doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></svg>',
  tel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  oblik: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v3H8z"/><path d="M5 6h3v1h8V6h3v15H5z"/><path d="M9 12h6M9 16h4"/></svg>',
  news: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M8 9h5M8 13h5"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/></svg>',
  users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 11.5-4.2"/><rect x="15" y="14" width="6" height="6" rx="1.2"/><path d="M16.5 14v-1.5a1.5 1.5 0 0 1 3 0V14"/></svg>'
};

/* тема */
function applyTheme() { const t = LS.get('theme') || 'auto'; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
applyTheme();

/* дані з Apps Script */
function api(params) {
  const u = new URL(window.PPO_API); Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  return fetch(u.toString()).then(r => r.json()).then(j => { if (j && j.error) throw new Error(j.error); return j; });
}
let H = null, NEWS_LIMIT = 5;
const loadHome = () => H ? Promise.resolve(H) : api({ api: 'home' }).then(h => (H = h));

/* маршрути */
const ROUTES = {
  home: { title: 'ППО РУ «ГТСУ»', nav: 'home', render: viewHome },
  news: { title: 'Новини та оголошення', nav: 'home', back: '#/home', render: viewNews },
  join: { title: 'Як вступити', nav: 'menu', back: '#/menu', render: viewJoin },
  docs: { title: 'Документи', nav: 'menu', back: '#/menu', render: viewDocs },
  contacts: { title: 'Контакти', nav: 'menu', back: '#/menu', render: viewContacts },
  menu: { title: 'Ще', nav: 'menu', render: viewMenu },
  profkom: { title: 'Профспілковий комітет', nav: 'profkom', frame: () => window.PPO_API + '?view=profkom&only=1' },
  oblik: { title: 'Облік членів', nav: 'oblik', frame: () => window.PPO_API },
  users: { title: 'Користувачі та доступ', nav: 'menu', back: '#/menu', frame: () => window.PPO_API + '?view=users' },
  install: { title: 'Встановити на телефон', nav: 'menu', back: '#/menu', render: viewInstall }
};
function route() {
  const key = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'home';
  const r = ROUTES[key] || ROUTES.home;
  $('#title').textContent = r.title;
  document.title = r.title === 'ППО РУ «ГТСУ»' ? r.title : r.title + ' — ППО РУ';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.g === r.nav));
  $('#back').hidden = !r.back; $('#back').onclick = () => { location.hash = r.back; };
  if (r.frame) {
    const u = r.frame(), f = $('#ifr');
    if (f.dataset.src !== u) { f.src = u; f.dataset.src = u; $('#alt').href = u; }
    $('#frame').hidden = false; $('#main').hidden = true;
  } else {
    $('#frame').hidden = true; $('#main').hidden = false;
    r.render(); window.scrollTo(0, 0);
  }
}
window.addEventListener('hashchange', route);

function withHome(fn) {
  if (H) return fn();
  $('#main').innerHTML = '<p class="loading">Завантаження…</p>';
  loadHome().then(fn).catch(e => { $('#main').innerHTML = '<p class="loading">Не вдалося завантажити дані: ' + esc(e.message) + '</p>'; });
}

function newsHtml(list) {
  return list.map(n => `<article class="news${n['Закріплено'] === 'Так' ? ' pin' : ''}">
    <div class="meta">${n['Закріплено'] === 'Так' ? '<span>Закріплено ·</span>' : ''}<span>${esc(dmy(n['Дата']))}</span>
      ${n['Профспілка'] === 'РУ' ? '<span class="chip ru">РУ</span>' : n['Профспілка'] === 'ОРУ' ? '<span class="chip oru">ОРУ</span>' : ''}</div>
    <h3>${esc(n['Заголовок'])}</h3>${n['Текст'] ? `<div class="txt">${linkify(n['Текст'])}</div>` : ''}
    ${n['Посилання'] ? `<p><a href="${esc(n['Посилання'])}" target="_blank" rel="noopener">Детальніше →</a></p>` : ''}</article>`).join('')
    || '<p class="empty">Новин поки немає.</p>';
}

function viewHome() {
  withHome(() => {
    const s = H.stats;
    $('#main').innerHTML = `${installBanner()}
    <section class="card"><p class="kick">Первинна профспілкова організація</p>
      <p style="margin:4px 0 0;font-weight:600">${esc(String(H.org || '').replace(/^Первинна профспілкова організація\s*/i, ''))}</p></section>
    <div class="stats">
      <div class="stat ru"><b>${esc(s.ru)}</b><span>членів ППО РУ</span></div>
      ${s.oru ? `<div class="stat oru"><b>${esc(s.oru)}</b><span>членів ${esc(H.oruName || 'ОРУ')}</span></div>` : `<div class="stat"><b>${esc(s.pct)}%</b><span>охоплення</span></div>`}
      <div class="stat"><b>${esc(s.staff)}</b><span>працівників</span></div>
    </div>
    <section class="card"><h2>Новини та оголошення <a href="#/news" style="font-size:13px">Усі${H.news.length ? ' (' + H.news.length + ')' : ''}</a></h2>
      ${newsHtml(H.news.slice(0, 3))}</section>
    <div class="tiles">
      <a class="tile" href="#/oblik">${I.oblik}Облік членів</a>
      <a class="tile" href="#/join">${I.join}Як вступити</a>
      <a class="tile" href="#/docs">${I.doc}Документи</a>
      <a class="tile" href="#/contacts">${I.tel}Контакти</a>
    </div>`;
    bindInstall();
  });
}
function viewNews() {
  withHome(() => {
    $('#main').innerHTML = `<section class="card">${newsHtml(H.news.slice(0, NEWS_LIMIT))}
      ${H.news.length > NEWS_LIMIT ? `<button class="btn sm" id="moreNews" type="button">Показати ще (${H.news.length - NEWS_LIMIT})</button>` : ''}</section>`;
    if ($('#moreNews')) $('#moreNews').onclick = () => { NEWS_LIMIT += 10; viewNews(); };
  });
}
function viewJoin() {
  withHome(() => {
    const t = H.templates.find(x => /заяв/i.test(x.name) && /вступ/i.test(x.name));
    $('#main').innerHTML = `<section class="card">
      ${H.howTo ? `<div style="white-space:pre-line;margin-bottom:12px">${linkify(H.howTo)}</div>` : ''}
      <ol class="steps">
        <li>Заповніть <b>заяву про вступ</b> до первинної профспілкової організації${t ? ` — <a href="#" data-dl="${esc(t.id)}" data-fmt="docx">скачати бланк</a>` : ''}.</li>
        <li>Напишіть заяву про <b>згоду на утримання членських внесків</b> із заробітної плати (розмір визначено статутом).</li>
        <li>Передайте заяви голові або члену профкому свого підрозділу.</li>
        <li>Профком розгляне заяву на найближчому засіданні та видасть <b>профспілковий квиток</b>.</li>
      </ol></section>`;
  });
}
function docRows(list, fmt) {
  return list.map(d => `<div class="doc"><div><div>${esc(d.name)}</div><div class="d">оновлено ${esc(d.updated)}</div></div><button class="btn sm" type="button" data-dl="${esc(d.id)}"${fmt ? ` data-fmt="${fmt}"` : ''}>Скачати</button></div>`).join('') || '<p class="empty">—</p>';
}
function viewDocs() {
  withHome(() => {
    $('#main').innerHTML = `<section class="card"><h2>Установчі документи</h2>${docRows(H.docs)}</section>
      <section class="card"><h2>Зразки заяв і документів</h2>${docRows(H.templates, 'docx')}</section>`;
  });
}
function viewContacts() {
  withHome(() => {
    const leaders = H.aktiv ? H.aktiv.groups.map(g => `<div class="agrp">${esc(g)}</div>${H.aktiv.items.filter(i => i.group === g).map(p =>
      `<div class="person${/ОРУ/.test(g) ? ' oru' : ''}"><div class="ava">${p.photo ? `<img src="${esc(p.photo)}" alt="" referrerpolicy="no-referrer">` : esc(initials(p.name))}</div>
        <div><b>${esc(nameShort(p.name))}</b><div class="r">${esc(p.role)}${p.unit ? '<br>' + esc(p.unit) : ''}</div>${telA(p.phone)}</div></div>`).join('')}`).join('') : '';
    $('#main').innerHTML = `<section class="card"><div class="contacts">
        ${H.phone ? `<div><small>Телефон</small>${telA(H.phone)}</div>` : ''}
        ${H.email ? `<div><small>Email</small><a href="mailto:${esc(H.email)}">${esc(H.email)}</a></div>` : ''}
        ${H.address ? `<div><small>Адреса</small>${esc(H.address)}</div>` : ''}
        ${H.hours ? `<div><small>Прийом</small>${esc(H.hours)}</div>` : ''}
        ${!H.phone && !H.email && !H.address && !H.hours ? '<p class="empty">Контакти буде додано найближчим часом.</p>' : ''}</div></section>
      ${leaders ? `<section class="card"><h2>Профспілковий актив</h2>${leaders}</section>` : ''}`;
  });
}
function viewMenu() {
  const t = LS.get('theme') || 'auto';
  $('#main').innerHTML = `
    <nav class="list" aria-label="Розділи">
      <a class="row" href="#/news">${I.news}<span class="t">Новини та оголошення</span>${I.chev}</a>
      <a class="row" href="#/join">${I.join}<span class="t">Як вступити до профспілки</span>${I.chev}</a>
      <a class="row" href="#/docs">${I.doc}<span class="t">Документи</span><span class="s">Статут, КД, заяви</span></a>
      <a class="row" href="#/contacts">${I.tel}<span class="t">Контакти</span>${I.chev}</a>
      <a class="row" href="#/install">${I.phone}<span class="t">Встановити на телефон</span>${isStandalone() ? '<span class="s">встановлено</span>' : I.chev}</a>
    </nav>
    <p class="kick" style="margin:4px 4px 0">Доступ до обліку</p>
    <section class="card" style="padding:0;overflow:hidden">
      <a class="row" href="#/users">${I.users}<span class="t">Користувачі та права доступу</span>${I.chev}</a>
      <div style="padding:10px 16px 12px;border-top:1px solid var(--line-2);font-size:13.5px;display:grid;gap:6px">
        <div><b>«Редагування»</b> — вносить зміни в облік, публікує новини, додає користувачів і змінює їхні права.</div>
        <div><b>«Перегляд»</b> — лише переглядає облік, нічого не змінює.</div>
        <div style="color:var(--mute)">Вхід — одноразовим кодом на email зі списку користувачів. Зняти позначку «активний» — доступ закривається одразу. Змінювати список можуть лише користувачі з роллю «редагування».</div>
      </div>
    </section>
    <section class="list">
      <div class="row"><span class="t">Тема</span><div class="seg" role="group" aria-label="Тема">
        ${[['auto', 'Авто'], ['light', 'Світла'], ['dark', 'Темна']].map(x => `<button type="button" data-th="${x[0]}" class="${t === x[0] ? 'on' : ''}" aria-pressed="${t === x[0]}">${x[1]}</button>`).join('')}</div></div>
      <div class="row"><span class="t">Версія сайту</span><span class="s">${APP_VERSION}</span></div>
      <a class="row" href="../index.html"><span class="t">Попередня версія сайту</span>${I.chev}</a>
    </section>
    <p class="note">Персональні дані членів на телефоні не зберігаються: облік завжди відкривається з Google-таблиці.</p>`;
  document.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { LS.set('theme', b.dataset.th); applyTheme(); viewMenu(); });
}

/* встановлення на телефон */
let deferredPrompt = null;
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const canInstall = () => !isStandalone() && (!!deferredPrompt || isIOS);
const installLater = () => Date.now() - (+LS.get('installLater') || 0) < 14 * 864e5;
function currentKey() { return (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'home'; }
function rerender() { const k = currentKey(); if (['home', 'menu', 'install'].includes(k) && !$('#main').hidden) ROUTES[k].render(); }
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; rerender(); });
window.addEventListener('appinstalled', () => { deferredPrompt = null; toast('ППО РУ встановлено на телефон'); rerender(); });
function installBanner() {
  if (!canInstall() || installLater()) return '';
  return `<section class="card inst" aria-label="Встановлення на телефон">
    <div class="hd"><img src="icons/icon-192.png" alt=""><div style="flex:1"><b>Встановіть ППО РУ на телефон</b>
      <p style="margin:2px 0 0;font-size:13px;color:var(--mute)">Іконка на екрані, швидкий доступ до новин, оголошень і обліку</p></div></div>
    <div class="btns"><button type="button" class="btn" id="instLater">Пізніше</button><button type="button" class="btn pri" id="instGo">Встановити</button></div></section>`;
}
function bindInstall() {
  if ($('#instLater')) $('#instLater').onclick = () => { LS.set('installLater', String(Date.now())); rerender(); };
  if ($('#instGo')) $('#instGo').onclick = doInstall;
}
function doInstall() {
  if (deferredPrompt) {
    const p = deferredPrompt; p.prompt();
    p.userChoice.then(c => { deferredPrompt = null; if (c && c.outcome === 'dismissed') LS.set('installLater', String(Date.now())); rerender(); }).catch(() => {});
  } else location.hash = '#/install';
}
function viewInstall() {
  if (isStandalone()) { $('#main').innerHTML = '<div class="okbar">Сайт уже встановлено на цьому пристрої. Відкривайте його з іконки «ППО РУ».</div>'; return; }
  $('#main').innerHTML = `
    ${deferredPrompt ? `<section class="card inst"><div class="hd"><img src="icons/icon-192.png" alt=""><b style="flex:1">ППО РУ «ГТСУ»</b></div>
      <button type="button" class="btn pri full" id="instGo">Встановити</button></section>` : ''}
    <section class="card"><h2>iPhone, iPad</h2><ol class="how">
      <li>Відкрийте сайт у браузері <b>Safari</b>.</li>
      <li>Натисніть «Поділитися» (квадрат зі стрілкою вгору).</li>
      <li>Виберіть «<b>На початковий екран</b>» і натисніть «Додати».</li></ol></section>
    <section class="card"><h2>Android</h2><ol class="how">
      <li>Відкрийте сайт у <b>Chrome</b>.</li>
      <li>Натисніть кнопку «Встановити» вище або меню ⋮ у правому верхньому куті.</li>
      <li>Виберіть «<b>Встановити застосунок</b>» або «Додати на головний екран».</li></ol></section>
    <p class="note">Персональні дані членів на телефоні не зберігаються — лише файли самого сайту, щоб він швидко відкривався.</p>`;
  bindInstall();
}

/* оновлення версій */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const ask = w => { if (w && navigator.serviceWorker.controller) { $('#upd').hidden = false; $('#updGo').onclick = () => w.postMessage({ type: 'SKIP_WAITING' }); } };
    if (reg.waiting) ask(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') ask(w); }); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
}

/* завантаження документів */
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-dl]'); if (!b) return; e.preventDefault();
  if (b.dataset.busy) return; b.dataset.busy = 1; const old = b.textContent; b.textContent = 'Завантаження…';
  api({ api: 'dl', id: b.dataset.dl, fmt: b.dataset.fmt || '' }).then(f => {
    b.textContent = old; delete b.dataset.busy;
    const bin = atob(f.data), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u], { type: f.mime })); a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
  }).catch(er => { b.textContent = old; delete b.dataset.busy; toast('Помилка: ' + er.message); });
});

route();

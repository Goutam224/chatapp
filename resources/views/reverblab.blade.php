<!DOCTYPE html>
<html>
<head>
  <meta name="csrf-token" content="{{ csrf_token() }}">
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@400;600;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0c10;
    --surface: #111318;
    --surface2: #181c24;
    --border: #1e2330;
    --accent: #00e5ff;
    --accent2: #7c3aed;
    --green: #00ff88;
    --red: #ff3d6a;
    --yellow: #ffc107;
    --text: #e2e8f0;
    --muted: #4a5568;
    --mono: 'JetBrains Mono', monospace;
    --sans: 'Syne', sans-serif;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--mono);
    min-height: 100vh;
    padding: 0;
    overflow-x: hidden;
  }

  .grid-bg {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image:
      linear-gradient(rgba(0,229,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,229,255,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  .app { position: relative; z-index: 1; display: flex; flex-direction: column; min-height: 100vh; }

  header {
    padding: 18px 28px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 16px;
    background: rgba(10,12,16,0.9);
    backdrop-filter: blur(10px);
    position: sticky; top: 0; z-index: 100;
  }

  .logo { font-family: var(--sans); font-size: 18px; font-weight: 800; letter-spacing: -0.5px; color: var(--accent); }
  .logo span { color: var(--text); }

  .status-pill {
    display: flex; align-items: center; gap: 7px;
    padding: 4px 12px; border-radius: 999px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.5px;
    border: 1px solid var(--border); background: var(--surface);
    margin-left: auto; transition: all 0.3s;
  }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); transition: all 0.3s; }
  .status-pill.connected { border-color: var(--green); color: var(--green); }
  .status-pill.connected .status-dot { background: var(--green); box-shadow: 0 0 8px var(--green); animation: pulse 2s infinite; }
  .status-pill.connecting { border-color: var(--yellow); color: var(--yellow); }
  .status-pill.connecting .status-dot { background: var(--yellow); }
  .status-pill.error { border-color: var(--red); color: var(--red); }
  .status-pill.error .status-dot { background: var(--red); }

  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  .main { display: grid; grid-template-columns: 340px 1fr; flex: 1; }

  .sidebar {
    border-right: 1px solid var(--border);
    background: var(--surface);
    display: flex; flex-direction: column;
    overflow-y: auto; height: calc(100vh - 57px);
    position: sticky; top: 57px;
  }

  .section { padding: 20px; border-bottom: 1px solid var(--border); }
  .section-label { font-size: 9px; font-weight: 700; letter-spacing: 2px; color: var(--muted); text-transform: uppercase; margin-bottom: 14px; }

  .field { margin-bottom: 12px; }
  .field label { display: block; font-size: 10px; color: var(--muted); margin-bottom: 5px; letter-spacing: 0.5px; }

  input, select {
    width: 100%; background: var(--bg); border: 1px solid var(--border);
    color: var(--text); font-family: var(--mono); font-size: 12px;
    padding: 8px 10px; border-radius: 6px; outline: none; transition: border-color 0.2s;
  }
  input:focus, select:focus { border-color: var(--accent); }
  input::placeholder { color: var(--muted); }

  .btn {
    width: 100%; padding: 10px; border: none; border-radius: 6px;
    font-family: var(--mono); font-size: 12px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: all 0.2s;
  }
  .btn-primary { background: var(--accent); color: #000; }
  .btn-primary:hover { opacity: 0.85; transform: translateY(-1px); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
  .btn-danger { background: var(--red); color: #fff; }
  .btn-danger:hover { opacity: 0.85; }
  .btn-secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
  .btn-secondary:hover { border-color: var(--accent); color: var(--accent); }

  .channel-item {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 6px;
    background: var(--bg); border: 1px solid var(--border); font-size: 11px;
    margin-bottom: 6px;
  }
  .channel-item .ch-name { flex: 1; color: var(--accent); word-break: break-all; }
  .channel-item .ch-remove { color: var(--muted); cursor: pointer; font-size: 14px; padding: 0 4px; transition: color 0.2s; }
  .channel-item .ch-remove:hover { color: var(--red); }

  .channel-add { display: flex; gap: 6px; }
  .channel-add input { flex: 1; }
  .channel-add .btn { width: auto; padding: 8px 14px; }

  .log-panel { display: flex; flex-direction: column; height: calc(100vh - 57px); }

  .log-toolbar {
    padding: 14px 20px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 10px; background: var(--surface);
  }
  .log-toolbar span { font-size: 11px; color: var(--muted); margin-right: auto; }
  .event-count { background: var(--accent2); color: #fff; font-size: 10px; padding: 2px 8px; border-radius: 999px; font-weight: 700; }

  .log-area { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; background: var(--bg); }

  .log-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--muted); gap: 12px; font-size: 12px; text-align: center; }
  .log-empty .big { font-size: 48px; opacity: 0.3; }

  .event-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; animation: slideIn 0.2s ease; }
  @keyframes slideIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }

  .event-card.type-MessageSent { border-left: 3px solid var(--green); }
  .event-card.type-MessageEdited { border-left: 3px solid var(--yellow); }
  .event-card.type-MessageDeleted { border-left: 3px solid var(--red); }
  .event-card.type-UserTyping { border-left: 3px solid var(--accent); }
  .event-card.type-UserBlocked { border-left: 3px solid #ff6b6b; }
  .event-card.type-system { border-left: 3px solid var(--muted); }
  .event-card.type-error { border-left: 3px solid var(--red); background: rgba(255,61,106,0.05); }

  .event-header { display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; user-select: none; }
  .event-header:hover { background: var(--surface2); }
  .event-type { font-size: 11px; font-weight: 700; color: var(--accent); letter-spacing: 0.5px; }
  .event-channel { font-size: 10px; color: var(--muted); background: var(--bg); padding: 2px 8px; border-radius: 4px; }
  .event-time { font-size: 10px; color: var(--muted); margin-left: auto; }

  .event-body { padding: 0 14px 12px; display: none; }
  .event-body.open { display: block; }
  .event-body pre { font-size: 11px; line-height: 1.7; color: #a0aec0; white-space: pre-wrap; word-break: break-all; background: var(--bg); padding: 10px; border-radius: 6px; border: 1px solid var(--border); }

  .filter-row { display: flex; gap: 6px; flex-wrap: wrap; padding: 12px 20px; border-bottom: 1px solid var(--border); background: var(--surface); }
  .filter-chip { font-size: 10px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg); color: var(--muted); cursor: pointer; font-family: var(--mono); transition: all 0.15s; }
  .filter-chip.active { border-color: var(--accent); color: var(--accent); background: rgba(0,229,255,0.08); }

  .send-section textarea { width: 100%; background: var(--bg); border: 1px solid var(--border); color: var(--text); font-family: var(--mono); font-size: 11px; padding: 8px 10px; border-radius: 6px; resize: vertical; min-height: 80px; outline: none; }
  .send-section textarea:focus { border-color: var(--accent); }
  .send-section textarea::placeholder { color: var(--muted); }

  .info-box { background: rgba(0,229,255,0.05); border: 1px solid rgba(0,229,255,0.2); border-radius: 8px; padding: 12px; font-size: 11px; color: var(--accent); line-height: 1.7; margin-bottom: 12px; }
  .info-box strong { display: block; margin-bottom: 4px; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
</style>
</head>
<body>
<div class="grid-bg"></div>
<div class="app">
  <header>
    <div class="logo">Reverb<span>Lab</span></div>
    <div style="font-size:11px;color:var(--muted);">WebSocket Event Tester — run locally for best results</div>
    <div class="status-pill" id="statusPill">
      <div class="status-dot"></div>
      <span id="statusText">DISCONNECTED</span>
    </div>
  </header>

  <div class="main">
    <div class="sidebar">

      <!-- Connection -->
      <div class="section">
        <div class="section-label">Connection</div>
        <div class="info-box">
          <strong>⚠ Run this file locally</strong>
          Open this HTML file directly in your browser from your computer so it can reach localhost:8000 without CORS issues.
        </div>
        <div class="field"><label>Reverb Host</label><input id="host" value="localhost"></div>
        <div class="field"><label>Reverb Port</label><input id="port" value="8080"></div>
        <div class="field"><label>App Key (REVERB_APP_KEY)</label><input id="appKey" placeholder="your-reverb-app-key"></div>
        <div class="field"><label>Bearer Token</label><input id="token" type="password" placeholder="from POST /auth/token"></div>
        <div style="display:flex;gap:8px;margin-top:4px;">
          <button class="btn btn-primary" id="connectBtn" onclick="connect()">Connect</button>
          <button class="btn btn-danger" id="disconnectBtn" onclick="disconnect()" disabled style="width:auto;padding:10px 16px;">✕</button>
        </div>
      </div>

      <!-- Channels -->
      <div class="section">
        <div class="section-label">Channels</div>
        <div class="channel-add">
          <input id="channelInput" placeholder="private-chat.54" onkeydown="if(event.key==='Enter')addChannel()">
          <button class="btn btn-secondary" onclick="addChannel()">+</button>
        </div>
        <div style="margin-top:10px;">
          <div style="font-size:10px;color:var(--muted);margin-bottom:8px;">Quick add:</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;">
            <button class="btn btn-secondary" style="width:auto;padding:4px 10px;font-size:10px;" onclick="quickAdd('private-chat.{id}')">private-chat</button>
            <button class="btn btn-secondary" style="width:auto;padding:4px 10px;font-size:10px;" onclick="quickAdd('private-user.{id}')">private-user</button>
            <button class="btn btn-secondary" style="width:auto;padding:4px 10px;font-size:10px;" onclick="quickAdd('presence-global.presence')">presence-global</button>
          </div>
        </div>
        <div id="channelsList" style="margin-top:12px;"></div>
      </div>

      <!-- Trigger API -->
      <div class="section send-section">
        <div class="section-label">Trigger API Event</div>
        <div class="field"><label>API Base URL</label><input id="apiBase" placeholder="http://localhost:8000"></div>
        <div class="field">
          <label>Endpoint</label>
          <select id="apiEndpoint">
            <option value="/typing">POST /typing</option>
            <option value="/message/send">POST /message/send</option>
            <option value="/message/delivered/1">POST /message/delivered/{id}</option>
            <option value="/message/seen/1">POST /message/seen/{id}</option>
            <option value="/block">POST /block</option>
          </select>
        </div>
        <div class="field"><label>Body (JSON)</label><textarea id="apiBody" placeholder='{"chat_id": 54}'></textarea></div>
        <button class="btn btn-secondary" onclick="triggerApi()">▶ Send Request</button>
        <div id="apiResult" style="margin-top:8px;font-size:10px;color:var(--muted);word-break:break-all;"></div>
      </div>

    </div>

    <!-- Log Panel -->
    <div class="log-panel">
      <div class="log-toolbar">
        <span id="logCount">0 events captured</span>
        <span class="event-count" id="eventCount" style="display:none">0</span>
        <button class="btn btn-secondary" style="width:auto;padding:6px 14px;font-size:10px;" onclick="clearLog()">Clear</button>
      </div>
      <div class="filter-row">
        <span class="filter-chip active" data-filter="all" onclick="setFilter('all')">ALL</span>
        <span class="filter-chip" data-filter="MessageSent" onclick="setFilter('MessageSent')">MessageSent</span>
        <span class="filter-chip" data-filter="MessageEdited" onclick="setFilter('MessageEdited')">MessageEdited</span>
        <span class="filter-chip" data-filter="MessageDeleted" onclick="setFilter('MessageDeleted')">MessageDeleted</span>
        <span class="filter-chip" data-filter="UserTyping" onclick="setFilter('UserTyping')">UserTyping</span>
        <span class="filter-chip" data-filter="UserBlocked" onclick="setFilter('UserBlocked')">UserBlocked</span>
        <span class="filter-chip" data-filter="system" onclick="setFilter('system')">System</span>
        <span class="filter-chip" data-filter="error" onclick="setFilter('error')">Errors</span>
      </div>
      <div class="log-area" id="logArea">
        <div class="log-empty">
          <div class="big">⚡</div>
          <div>Open this file locally in your browser<br>then connect to your Reverb server<br>to see live events here.</div>
        </div>
      </div>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/pusher-js@8.4.0/dist/web/pusher.min.js"></script>
<script>
let pusher = null;
let events = [];
let activeFilter = 'all';
let subscribedChannels = {};
let channelList = [];

function setStatus(state, text) {
  const pill = document.getElementById('statusPill');
  pill.className = 'status-pill ' + state;
  document.getElementById('statusText').textContent = text;
}

function connect() {
  const host    = document.getElementById('host').value.trim() || 'localhost';
  const port    = document.getElementById('port').value.trim() || '8080';
  const appKey  = document.getElementById('appKey').value.trim();
  const token   = document.getElementById('token').value.trim();
  const apiBase = document.getElementById('apiBase').value.trim();

  if (!appKey) { logEvent('error','System',{error:'App Key is required'}); return; }
  if (!token)  { logEvent('error','System',{error:'Bearer Token is required'}); return; }

  setStatus('connecting','CONNECTING...');
  if (pusher) { pusher.disconnect(); }

  pusher = new Pusher(appKey, {
    wsHost: host,
    wsPort: parseInt(port),
    wssPort: parseInt(port),
    forceTLS: false,
    enabledTransports: ['ws'],
    cluster: 'mt1',
    authEndpoint: (apiBase || window.location.origin) + '/broadcasting/auth',
    auth: {
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    }
  });

  pusher.connection.bind('connected', () => {
    setStatus('connected','CONNECTED');
    document.getElementById('connectBtn').disabled = true;
    document.getElementById('disconnectBtn').disabled = false;
    logEvent('system','System',{message:'✓ Connected to Reverb', socketId: pusher.connection.socket_id});
    channelList.forEach(subscribeChannel);
  });

  pusher.connection.bind('disconnected', () => {
    setStatus('','DISCONNECTED');
    document.getElementById('connectBtn').disabled = false;
    document.getElementById('disconnectBtn').disabled = true;
    logEvent('system','System',{message:'Disconnected'});
  });

  pusher.connection.bind('error', (err) => {
    setStatus('error','ERROR');
    logEvent('error','System',{error: err?.error?.data?.message || 'Connection failed', detail: err});
  });
}

function disconnect() {
  if (pusher) { pusher.disconnect(); pusher = null; subscribedChannels = {}; }
}

function quickAdd(tpl) {
  const id = prompt('Enter ID for: ' + tpl, '54');
  if (id === null) return;
  document.getElementById('channelInput').value = tpl.replace('{id}', id);
  addChannel();
}

function addChannel() {
  const input = document.getElementById('channelInput');
  const name  = input.value.trim();
  if (!name || channelList.includes(name)) { input.value=''; return; }
  channelList.push(name);
  input.value = '';
  renderChannels();
  if (pusher && pusher.connection.state === 'connected') subscribeChannel(name);
}

function removeChannel(name) {
  channelList = channelList.filter(c => c !== name);
  if (pusher && subscribedChannels[name]) { pusher.unsubscribe(name); delete subscribedChannels[name]; }
  renderChannels();
}

function renderChannels() {
  document.getElementById('channelsList').innerHTML = channelList.map(c => `
    <div class="channel-item">
      <span style="color:var(--green);font-size:10px;">●</span>
      <span class="ch-name">${c}</span>
      <span class="ch-remove" onclick="removeChannel('${c}')">×</span>
    </div>
  `).join('');
}

const EVENT_NAMES = [
  'MessageSent','MessageEdited','MessageDeleted','MessagePinned',
  'UserTyping','UserBlocked','UserOnlineStatusUpdated',
  'App\\Events\\MessageSent','App\\Events\\MessageEdited',
  'App\\Events\\MessageDeleted','App\\Events\\UserTyping','App\\Events\\UserBlocked'
];

function subscribeChannel(name) {
  if (subscribedChannels[name]) return;
  const ch = pusher.subscribe(name);
  subscribedChannels[name] = ch;

  ch.bind('pusher:subscription_succeeded', (data) => {
    logEvent('system', name, {message: '✓ Subscribed to ' + name, members: data?.count});
  });
  ch.bind('pusher:subscription_error', (err) => {
    logEvent('error', name, {error: 'Failed to subscribe to ' + name, detail: err});
  });
  ch.bind('pusher:member_added',   (m) => logEvent('system', name, {event:'member_added',   member: m}));
  ch.bind('pusher:member_removed', (m) => logEvent('system', name, {event:'member_removed', member: m}));

  EVENT_NAMES.forEach(evtName => {
    ch.bind(evtName, (data) => {
      logEvent(evtName.split('\\').pop(), name, data);
    });
  });

  ch.bind_global((evtName, data) => {
    if (evtName.startsWith('pusher:')) return;
    if (EVENT_NAMES.includes(evtName)) return;
    logEvent(evtName, name, data);
  });
}

function logEvent(type, channel, data) {
  const event = { type, channel, data, time: new Date(), id: Date.now()+Math.random() };
  events.unshift(event);
  updateCount();
  if (activeFilter === 'all' || activeFilter === type) renderEvent(event, true);
}

function updateCount() {
  const count = events.filter(e => e.type !== 'system').length;
  const el = document.getElementById('eventCount');
  el.textContent = count;
  el.style.display = count > 0 ? '' : 'none';
  document.getElementById('logCount').textContent = `${events.length} event${events.length !== 1?'s':''} captured`;
}

function renderEvent(event, prepend=false) {
  const area = document.getElementById('logArea');
  const empty = area.querySelector('.log-empty');
  if (empty) empty.remove();

  const t = event.time;
  const timeStr = [t.getHours(),t.getMinutes(),t.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':')
    + '.' + String(t.getMilliseconds()).padStart(3,'0');

  const card = document.createElement('div');
  card.className = 'event-card type-' + event.type;
  card.innerHTML = `
    <div class="event-header" onclick="toggleBody(this)">
      <span class="event-type">${event.type}</span>
      <span class="event-channel">${event.channel}</span>
      <span class="event-time">${timeStr}</span>
      <span style="font-size:10px;color:var(--muted);">▾</span>
    </div>
    <div class="event-body">
      <pre>${JSON.stringify(event.data, null, 2)}</pre>
    </div>`;

  if (prepend && area.firstChild) area.insertBefore(card, area.firstChild);
  else area.appendChild(card);
}

function toggleBody(header) {
  const body = header.nextElementSibling;
  body.classList.toggle('open');
}

function setFilter(f) {
  activeFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === f));
  const area = document.getElementById('logArea');
  area.innerHTML = '';
  const filtered = events.filter(e => f === 'all' || e.type === f);
  if (!filtered.length) {
    area.innerHTML = '<div class="log-empty"><div class="big">⚡</div><div>No events match this filter.</div></div>';
    return;
  }
  filtered.forEach(e => renderEvent(e));
}

function clearLog() {
  events = [];
  document.getElementById('logArea').innerHTML =
    '<div class="log-empty"><div class="big">⚡</div><div>Cleared. Waiting for events...</div></div>';
  updateCount();
}

async function triggerApi() {
  const base     = document.getElementById('apiBase').value.trim();
  const endpoint = document.getElementById('apiEndpoint').value;
  const token    = document.getElementById('token').value.trim();
  const bodyStr  = document.getElementById('apiBody').value.trim();
  const result   = document.getElementById('apiResult');

  if (!base)  { result.textContent='⚠ Set API Base URL'; result.style.color='var(--yellow)'; return; }
  if (!token) { result.textContent='⚠ Set Bearer Token'; result.style.color='var(--yellow)'; return; }

  let body = {};
  try { if (bodyStr) body = JSON.parse(bodyStr); } catch(e) { result.textContent='⚠ Invalid JSON'; result.style.color='var(--red)'; return; }

  result.textContent='Sending...'; result.style.color='var(--muted)';

  try {
    const res  = await fetch(base + endpoint, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+token, 'Accept':'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(()=>({}));
    result.textContent = `${res.status} — ${JSON.stringify(data).slice(0,120)}`;
    result.style.color = res.ok ? 'var(--green)' : 'var(--red)';
    logEvent('system','API → '+endpoint,{status:res.status,response:data});
  } catch(e) {
    result.textContent='Error: '+e.message;
    result.style.color='var(--red)';
    logEvent('error','API',{error:e.message, hint:'Make sure your Laravel server is running and CORS allows localhost'});
  }
}
</script>
</body>
</html>

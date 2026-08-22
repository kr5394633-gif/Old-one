const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { Client } = require('discord.js-selfbot-v13');
const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const JWT_SECRET = 'RINTU_FINAL_2026';

// ─── COOKIE PARSER ───
function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) return cookies;
    cookieHeader.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (key) cookies[key] = decodeURIComponent(value);
    });
    return cookies;
}

function getToken(req) {
    const cookies = parseCookies(req.headers.cookie || '');
    return cookies.token || req.headers.authorization?.split(' ')[1];
}

function authenticate(req, res, next) {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: 'Auth required' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
}

// ─── HTML ───
const HTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌸 RINTU FINAL</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', sans-serif;
            background: #0a0a1a;
            min-height: 100vh;
            padding: 16px;
            background-image: radial-gradient(ellipse at 10% 20%, rgba(120,80,255,0.15) 0%, transparent 50%);
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .container { max-width: 850px; width: 100%; margin: 0 auto; }
        .header { text-align: center; padding: 20px 0; }
        .header h1 {
            font-size: 2.8em;
            font-weight: 900;
            background: linear-gradient(135deg, #ff6b9d, #c084fc, #60a5fa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .header .sub { color: rgba(255,255,255,0.3); letter-spacing: 3px; font-size: 0.8em; }
        .card {
            background: rgba(22,22,50,0.75);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 16px;
            border: 1px solid rgba(255,255,255,0.06);
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .card-title { font-size: 0.75em; text-transform: uppercase; letter-spacing: 3px; color: rgba(255,255,255,0.3); margin-bottom: 14px; }
        .login-box { text-align: center; padding: 20px; }
        .login-box input {
            width: 100%;
            padding: 14px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(0,0,0,0.3);
            color: #fff;
            font-size: 1em;
            margin-bottom: 12px;
            outline: none;
        }
        .login-box input:focus { border-color: rgba(192,132,252,0.4); }
        .login-btn {
            width: 100%;
            padding: 14px;
            border: none;
            border-radius: 12px;
            background: linear-gradient(135deg, #c084fc, #7c3aed);
            color: #fff;
            font-size: 1.1em;
            font-weight: 600;
            cursor: pointer;
        }
        .login-btn:hover { transform: translateY(-2px); }
        .token-area textarea {
            width: 100%;
            min-height: 100px;
            padding: 14px;
            border-radius: 14px;
            border: 1px solid rgba(255,255,255,0.06);
            background: rgba(0,0,0,0.3);
            color: #e2e8f0;
            font-size: 0.8em;
            font-family: 'Courier New', monospace;
            outline: none;
            resize: vertical;
        }
        .token-area textarea:focus { border-color: rgba(192,132,252,0.3); }
        .token-stats { display: flex; gap: 15px; flex-wrap: wrap; font-size: 0.8em; color: rgba(255,255,255,0.4); }
        .token-stats span { background: rgba(255,255,255,0.05); padding: 4px 12px; border-radius: 20px; }
        .token-stats .count { color: #c084fc; font-weight: 600; }
        .status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }
        .status-left { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .status-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            display: inline-block;
            transition: all 0.3s;
        }
        .status-dot.online { background: #34d399; box-shadow: 0 0 20px rgba(52,211,153,0.5); }
        .status-dot.offline { background: #f87171; box-shadow: 0 0 20px rgba(248,113,113,0.3); }
        .status-text { font-weight: 600; font-size: 1em; }
        .status-text.online { color: #34d399; }
        .status-text.offline { color: #f87171; }
        .status-badge { font-size: 0.7em; padding: 4px 14px; border-radius: 20px; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.6); }
        .status-badge span { color: #c084fc; font-weight: 600; }
        .btn-group { display: flex; gap: 10px; flex-wrap: wrap; }
        .btn {
            padding: 10px 24px;
            border: none;
            border-radius: 14px;
            font-weight: 600;
            font-size: 0.85em;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .btn:active { transform: scale(0.95); }
        .btn-start { background: linear-gradient(135deg, #34d399, #059669); color: #fff; }
        .btn-start:hover { transform: translateY(-2px); }
        .btn-stop { background: linear-gradient(135deg, #f87171, #dc2626); color: #fff; }
        .btn-stop:hover { transform: translateY(-2px); }
        .btn-glow { background: linear-gradient(135deg, #c084fc, #7c3aed); color: #fff; }
        .btn-glow:hover { transform: translateY(-2px); }
        .btn-save { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #1a1a2e; }
        .btn-save:hover { transform: translateY(-2px); }
        .btn-danger { background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; }
        .now-playing {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 14px 18px;
            background: rgba(0,0,0,0.3);
            border-radius: 14px;
            margin-top: 12px;
        }
        .now-playing .title { font-weight: 600; color: #e2e8f0; }
        .cmd-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(85px, 1fr)); gap: 8px; }
        .cmd-btn {
            padding: 10px 6px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.06);
            background: rgba(255,255,255,0.03);
            color: rgba(255,255,255,0.7);
            font-size: 0.7em;
            cursor: pointer;
            text-align: center;
            transition: all 0.25s;
        }
        .cmd-btn:hover { background: rgba(192,132,252,0.12); transform: translateY(-2px); }
        .cmd-btn .icon { font-size: 1.4em; display: block; margin-bottom: 3px; }
        .input-row { display: flex; gap: 10px; margin-top: 4px; }
        .input-row input {
            flex: 1;
            padding: 14px 18px;
            border-radius: 14px;
            border: 1px solid rgba(255,255,255,0.06);
            background: rgba(0,0,0,0.3);
            color: #e2e8f0;
            font-size: 0.9em;
            outline: none;
        }
        .input-row input:focus { border-color: rgba(192,132,252,0.3); }
        .log-area {
            background: rgba(0,0,0,0.4);
            border-radius: 14px;
            padding: 14px;
            max-height: 200px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.75em;
            line-height: 1.8;
        }
        .log-entry .time { color: rgba(255,255,255,0.2); margin-right: 10px; }
        .log-entry .sys { color: rgba(255,255,255,0.3); }
        .log-entry .resp { color: #34d399; }
        .log-entry .err { color: #f87171; }
        .status-user { display: flex; justify-content: space-between; padding: 8px 12px; background: rgba(255,255,255,0.05); border-radius: 10px; margin-bottom: 12px; }
        .status-user .user { color: #c084fc; font-weight: 600; }
        .status-user .logout { color: #f87171; cursor: pointer; font-size: 0.8em; }
        .status-user .logout:hover { text-decoration: underline; }
        .token-area { display: flex; flex-direction: column; gap: 10px; }
        .join-box { display: flex; gap: 10px; flex-wrap: wrap; }
        .join-box input { flex: 1; padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.3); color: #fff; outline: none; min-width: 150px; }
        .join-box input:focus { border-color: rgba(192,132,252,0.3); }
        @media (max-width: 600px) {
            .header h1 { font-size: 1.8em; }
            .status-bar { flex-direction: column; }
            .cmd-grid { grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); }
            .now-playing { flex-direction: column; text-align: center; }
            .input-row { flex-direction: column; }
            .join-box { flex-direction: column; }
        }
    </style>
</head>
<body>
<div id="app">
    <!-- LOGIN SCREEN -->
    <div id="loginScreen" class="container">
        <div class="card login-box">
            <h1 style="font-size:2em;background:linear-gradient(135deg,#ff6b9d,#c084fc,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px;">🌸 RINTU</h1>
            <div style="color:rgba(255,255,255,0.3);margin-bottom:20px;">✦ LOGIN ✦</div>
            <input type="text" id="loginUser" placeholder="Username" value="admin">
            <input type="password" id="loginPass" placeholder="Password" value="admin123">
            <button class="login-btn" onclick="login()">🔓 LOGIN</button>
            <div id="loginError" style="color:#f87171;margin-top:12px;"></div>
        </div>
    </div>

    <!-- DASHBOARD -->
    <div id="dashboardScreen" class="container" style="display:none;">
        <div class="header">
            <h1>🌸 RINTU</h1>
            <div class="sub">✦ FINAL - Everything Works ✦</div>
            <div class="status-user">
                <span class="user">👑 <span id="currentUser">admin</span></span>
                <span class="logout" onclick="logout()">🚪 Logout</span>
            </div>
        </div>

        <div class="card">
            <div class="card-title">🔑 Tokens</div>
            <div class="token-area">
                <textarea id="tokenInput" placeholder="Paste tokens (one per line)"></textarea>
                <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                    <div class="token-stats"><span>📊 <span class="count" id="tokenCount">0</span></span></div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button class="btn btn-save" id="saveTokensBtn">💾 Save</button>
                        <button class="btn btn-glow" id="loadTokensBtn">📂 Load</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">🎯 Join Server</div>
            <div class="join-box">
                <input id="inviteInput" placeholder="https://discord.gg/invite or invite code">
                <button class="btn btn-glow" id="joinBtn">🚀 Join Server</button>
            </div>
            <div style="font-size:0.7em;color:rgba(255,255,255,0.2);margin-top:6px;">⚡ All bots will join the server</div>
        </div>

        <div class="card">
            <div class="status-bar">
                <div class="status-left">
                    <span class="status-dot offline" id="statusDot"></span>
                    <span class="status-text offline" id="statusText">OFFLINE</span>
                    <span class="status-badge">🤖 <span id="botCount">0</span></span>
                    <span class="status-badge">🔊 <span id="volDisplay">100</span>%</span>
                </div>
                <div class="btn-group">
                    <button class="btn btn-start" id="startBtn">▶ START</button>
                    <button class="btn btn-danger" id="stopBtn">■ STOP</button>
                </div>
            </div>
            <div class="now-playing">
                <span style="font-size:2em;">🎵</span>
                <div><div style="font-size:0.65em;color:rgba(255,255,255,0.3);">NOW PLAYING</div>
                <div class="title" id="nowPlaying">✨ Ready</div></div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">⚡ Commands</div>
            <div class="cmd-grid">
                <button class="cmd-btn" data-cmd="play"><span class="icon">▶️</span><span class="label">Play</span></button>
                <button class="cmd-btn" data-cmd="stop"><span class="icon">⏹️</span><span class="label">Stop</span></button>
                <button class="cmd-btn" data-cmd="pause"><span class="icon">⏸️</span><span class="label">Pause</span></button>
                <button class="cmd-btn" data-cmd="resume"><span class="icon">▶️</span><span class="label">Resume</span></button>
                <button class="cmd-btn" data-cmd="volume 200"><span class="icon">🔊</span><span class="label">200%</span></button>
                <button class="cmd-btn" data-cmd="volume 500"><span class="icon">💥</span><span class="label">500%</span></button>
                <button class="cmd-btn" data-cmd="volume 1000"><span class="icon">💀</span><span class="label">1000%</span></button>
                <button class="cmd-btn" data-cmd="leave"><span class="icon">👋</span><span class="label">Leave</span></button>
            </div>
        </div>

        <div class="card">
            <div class="card-title">⌨️ Command</div>
            <div class="input-row">
                <input id="cmdInput" placeholder="play URL or channel_id">
                <button class="btn btn-glow" id="sendBtn">Send ✦</button>
            </div>
        </div>

        <div class="card">
            <div class="card-title">📋 Log</div>
            <div class="log-area" id="logArea">
                <div class="log-entry"><span class="time">[✦]</span> <span class="sys">🌸 RINTU FINAL ready</span></div>
            </div>
        </div>
    </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
let socket;

// ─── LOGIN FUNCTION ───
function login() {
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    
    if(!user || !pass) {
        document.getElementById('loginError').textContent = '❌ Enter username and password';
        return;
    }
    
    document.getElementById('loginError').textContent = '⏳ Logging in...';
    
    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
    })
    .then(r => r.json())
    .then(data => {
        if(data.success) {
            document.getElementById('loginError').textContent = '';
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('dashboardScreen').style.display = 'block';
            document.getElementById('currentUser').textContent = user;
            initDashboard();
        } else {
            document.getElementById('loginError').textContent = '❌ ' + data.error;
        }
    })
    .catch(() => {
        document.getElementById('loginError').textContent = '❌ Login failed - check server';
    });
}

// ─── LOGOUT ───
function logout() {
    fetch('/api/logout', { method: 'POST' }).then(() => {
        document.getElementById('dashboardScreen').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('loginError').textContent = '';
    });
}

// ─── DASHBOARD ───
function initDashboard() {
    socket = io();
    const logArea = document.getElementById('logArea');
    const tokenInput = document.getElementById('tokenInput');

    function addLog(msg, type='sys') {
        const time = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = '<span class="time">[' + time + ']</span> <span class="' + type + '">' + msg + '</span>';
        logArea.appendChild(entry);
        logArea.scrollTop = logArea.scrollHeight;
    }
    window.addLog = addLog;

    function updateTokenStats() {
        const lines = tokenInput.value.split('\n').filter(l => l.trim().length > 10);
        document.getElementById('tokenCount').textContent = lines.length;
    }
    tokenInput.addEventListener('input', updateTokenStats);

    function getTokens() {
        return tokenInput.value.split('\n').map(l => l.trim()).filter(l => l.length > 10);
    }

    document.getElementById('saveTokensBtn').onclick = function() {
        const tokens = getTokens();
        if(!tokens.length) { addLog('❌ No tokens!', 'err'); return; }
        localStorage.setItem('rintu_tokens', JSON.stringify(tokens));
        addLog('💾 Saved ' + tokens.length + ' tokens', 'resp');
    };

    document.getElementById('loadTokensBtn').onclick = function() {
        const saved = localStorage.getItem('rintu_tokens');
        if(!saved) { addLog('❌ No saved tokens', 'err'); return; }
        const tokens = JSON.parse(saved);
        tokenInput.value = tokens.join('\n');
        updateTokenStats();
        addLog('📂 Loaded ' + tokens.length + ' tokens', 'resp');
    };

    (function() {
        const saved = localStorage.getItem('rintu_tokens');
        if(saved) {
            try {
                const tokens = JSON.parse(saved);
                tokenInput.value = tokens.join('\n');
                updateTokenStats();
            } catch(e) {}
        }
    })();

    // ─── JOIN SERVER ───
    document.getElementById('joinBtn').onclick = function() {
        const invite = document.getElementById('inviteInput').value.trim();
        if(!invite) { addLog('❌ Enter invite link or code', 'err'); return; }
        
        fetch('/api/join-server', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invite: invite })
        })
        .then(r => r.json())
        .then(data => {
            if(data.message) addLog('✅ ' + data.message, 'resp');
            if(data.error) addLog('❌ ' + data.error, 'err');
        })
        .catch(e => addLog('❌ Error: ' + e.message, 'err'));
    };

    // ─── STATUS ───
    function updateStatus(running, count, title) {
        const dot = document.getElementById('statusDot');
        const text = document.getElementById('statusText');
        dot.className = 'status-dot ' + (running ? 'online' : 'offline');
        text.className = 'status-text ' + (running ? 'online' : 'offline');
        text.textContent = running ? '🟢 ONLINE' : '🔴 OFFLINE';
        document.getElementById('botCount').textContent = count || 0;
        if(title) document.getElementById('nowPlaying').textContent = title;
    }

    socket.on('status_update', (d) => updateStatus(d.isRunning, d.botCount, d.currentTitle));
    socket.on('bots_started', (d) => { addLog('🚀 ' + d.count + ' bots started', 'resp'); updateStatus(true, d.count); });
    socket.on('bots_stopped', () => { addLog('⛔ Bots stopped', 'err'); updateStatus(false, 0); });
    socket.on('bot_status', (d) => addLog('🤖 Bot ' + d.index + '/' + d.total + ': ' + d.tag, 'resp'));
    socket.on('audio_update', (d) => { if(d.title) document.getElementById('nowPlaying').textContent = d.title; if(d.volume) document.getElementById('volDisplay').textContent = Math.round(d.volume); });
    socket.on('command_response', (d) => addLog('✦ ' + d.command + ' → ' + d.response, d.response.includes('❌') ? 'err' : 'resp'));

    // ─── START/STOP ───
    document.getElementById('startBtn').onclick = function() {
        const tokens = getTokens();
        if(!tokens.length) { addLog('❌ Add tokens!', 'err'); return; }
        localStorage.setItem('rintu_tokens', JSON.stringify(tokens));
        socket.emit('start_bots_with_tokens', { tokens });
        addLog('🚀 Starting ' + tokens.length + ' bots...', 'sys');
    };

    document.getElementById('stopBtn').onclick = function() {
        socket.emit('stop_bots');
        addLog('⛔ Stopping...', 'sys');
    };

    // ─── COMMANDS ───
    function sendCmd(cmd) {
        if(!cmd) return;
        fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
        })
        .then(r => r.json())
        .then(d => { if(d.response) addLog('✦ ' + cmd + ' → ' + d.response, d.response.includes('❌') ? 'err' : 'resp'); })
        .catch(e => addLog('❌ Error: ' + e.message, 'err'));
    }

    document.getElementById('sendBtn').onclick = function() {
        const inp = document.getElementById('cmdInput');
        sendCmd(inp.value.trim());
        inp.value = '';
    };

    document.getElementById('cmdInput').onkeypress = function(e) {
        if(e.key === 'Enter') document.getElementById('sendBtn').click();
    };

    document.querySelectorAll('.cmd-btn').forEach(function(btn) {
        btn.onclick = function() {
            const cmd = this.dataset.cmd;
            if(cmd === 'play') {
                const url = prompt('🎵 Enter YouTube URL:');
                if(url) sendCmd('play ' + url);
                return;
            }
            sendCmd(cmd);
        };
    });

    fetch('/api/status').then(r => r.json()).then(d => updateStatus(d.isRunning, d.botCount, d.currentTitle)).catch(console.error);
}

// ─── AUTO-LOGIN CHECK ───
window.onload = function() {
    fetch('/api/check-auth')
        .then(r => r.json())
        .then(data => {
            if(data.authenticated) {
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('dashboardScreen').style.display = 'block';
                document.getElementById('currentUser').textContent = data.user;
                initDashboard();
            }
        })
        .catch(() => {});
};
</script>
</body>
</html>`;

// ─── SERVE ───
app.get('/', (req, res) => {
    const token = getToken(req);
    if (token) {
        try {
            jwt.verify(token, JWT_SECRET);
            return res.send(HTML);
        } catch {}
    }
    res.send(HTML);
});

// ─── AUTH ───
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // Simple auth - you can add more users
    if (username === 'admin' && password === 'admin123') {
        const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
        res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Max-Age=86400; Path=/`);
        return res.json({ success: true });
    }
    if (username === 'friend1' && password === 'friend123') {
        const token = jwt.sign({ username, role: 'friend' }, JWT_SECRET, { expiresIn: '24h' });
        res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Max-Age=86400; Path=/`);
        return res.json({ success: true });
    }
    res.json({ success: false, error: 'Invalid credentials' });
});

app.post('/api/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'token=; Max-Age=0; Path=/');
    res.json({ success: true });
});

app.get('/api/check-auth', (req, res) => {
    const token = getToken(req);
    if (!token) return res.json({ authenticated: false });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ authenticated: true, user: decoded.username });
    } catch {
        res.json({ authenticated: false });
    }
});

// ─── BOT ───
let dashboardTokens = [];
let isBotRunning = false;
let clients = [];
let connections = {};
let players = {};
let currentTitle = 'Nothing playing';
let currentVolume = 1.0;
let keepAliveIntervals = {};

function startBots() {
    if (isBotRunning) return;
    if (!dashboardTokens.length) {
        console.log('❌ No tokens');
        return;
    }

    isBotRunning = true;
    dashboardTokens.forEach((token, index) => {
        const client = new Client({ 
            checkUpdate: false,
            ws: { properties: { $browser: 'Discord iOS' } }
        });

        client.on('ready', () => {
            const tag = client.user ? client.user.tag : 'Unknown';
            console.log('🤖 Bot ' + (index + 1) + '/' + dashboardTokens.length + ': ' + tag);
            io.emit('bot_status', { index: index + 1, total: dashboardTokens.length, tag: tag });
        });

        client.on('error', (err) => {
            console.log('❌ Bot ' + (index + 1) + ' error:', err.message);
        });

        client.login(token).catch(err => {
            console.log('❌ Bot ' + (index + 1) + ' login failed:', err.message);
        });
        clients.push(client);
    });
    io.emit('bots_started', { count: dashboardTokens.length });
}

function stopBots() {
    isBotRunning = false;
    for (const key in players) {
        try { players[key].stop(); } catch(e) {}
    }
    players = {};
    for (const key in connections) {
        try { connections[key].destroy(); } catch(e) {}
    }
    connections = {};
    for (const key in keepAliveIntervals) {
        clearInterval(keepAliveIntervals[key]);
    }
    keepAliveIntervals = {};
    clients.forEach(c => { try { c.destroy(); } catch(e) {} });
    clients = [];
    io.emit('bots_stopped');
    console.log('⛔ All bots stopped');
}

// ─── JOIN SERVER ───
app.post('/api/join-server', authenticate, async (req, res) => {
    const { invite } = req.body;
    if (!invite) return res.json({ error: 'No invite provided' });
    
    if (clients.length === 0) {
        return res.json({ error: 'Start bots first!' });
    }

    let inviteCode = invite;
    if (invite.includes('discord.gg/')) {
        inviteCode = invite.split('discord.gg/')[1].split('/')[0].split('?')[0];
    }
    if (invite.includes('discord.com/invite/')) {
        inviteCode = invite.split('discord.com/invite/')[1].split('/')[0].split('?')[0];
    }

    let results = [];
    for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        if (!client) continue;
        
        try {
            console.log('🔄 Bot ' + (i + 1) + ' joining server with code:', inviteCode);
            
            // Method 1: Use acceptInvite
            const inviteObj = await client.fetchInvite(inviteCode);
            if (inviteObj) {
                await client.acceptInvite(inviteCode);
                results.push('✅ Bot ' + (i + 1) + ' joined: ' + (inviteObj.guild?.name || 'Server'));
                console.log('✅ Bot ' + (i + 1) + ' joined server');
            }
        } catch (err1) {
            console.log('⚠️ Bot ' + (i + 1) + ' invite method failed:', err1.message);
            
            try {
                // Method 2: Direct API join
                const response = await axios.post(
                    `https://discord.com/api/v9/invites/${inviteCode}`,
                    {},
                    {
                        headers: {
                            'Authorization': client.token || client.authToken,
                            'Content-Type': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    }
                );
                if (response.data && response.data.guild) {
                    results.push('✅ Bot ' + (i + 1) + ' joined: ' + response.data.guild.name);
                }
            } catch (err2) {
                results.push('❌ Bot ' + (i + 1) + ' failed: ' + err2.message);
            }
        }
    }

    const message = results.join('\n');
    io.emit('command_response', { command: '🔗 Join Server', response: message });
    res.json({ message: message });
});

// ─── JOIN VOICE ───
async function joinVoiceChannelRaw(client, channelId) {
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return null;
        
        const connection = client.voice.connect(channelId);
        return connection;
    } catch (err) {
        console.log('Join voice error:', err.message);
        return null;
    }
}

function keepBotsInVoice() {
    for (const key in connections) {
        if (connections[key]) {
            try {
                connections[key].setSpeaking(true);
                setTimeout(() => {
                    try { connections[key].setSpeaking(false); } catch(e) {}
                }, 200);
            } catch(e) {}
        }
    }
}

// ─── API ───
app.get('/api/status', (req, res) => {
    res.json({
        isRunning: isBotRunning,
        botCount: clients.length,
        totalTokens: dashboardTokens.length,
        currentTitle: currentTitle,
        volume: Math.round(currentVolume * 100)
    });
});

app.post('/api/command', async (req, res) => {
    const command = req.body.command;
    if (!command) return res.json({ error: 'No command' });

    const lower = command.toLowerCase().trim();
    let response = '';

    try {
        if (lower.startsWith('play ')) {
            const url = command.slice(5).trim();
            if (!connections[0]) {
                response = '❌ Join voice first! Send channel ID';
            } else {
                try {
                    const stream = ytdl(url, { 
                        filter: 'audioonly',
                        quality: 'highestaudio',
                        highWaterMark: 1 << 25
                    });
                    
                    const resource = createAudioResource(stream, {
                        inputType: StreamType.Arbitrary,
                        inlineVolume: true
                    });
                    
                    resource.volume.setVolume(currentVolume * 2);
                    const player = createAudioPlayer();
                    player.play(resource);
                    
                    if (connections[0]) {
                        connections[0].subscribe(player);
                    }
                    players[0] = player;
                    
                    currentTitle = '🎵 ' + url;
                    io.emit('audio_update', { 
                        status: 'playing', 
                        title: currentTitle, 
                        volume: Math.round(currentVolume * 100) 
                    });
                    response = '🎵 Now playing!';
                } catch (err) {
                    response = '❌ Error: ' + err.message;
                }
            }
        } else if (lower === 'stop') {
            if (players[0]) { players[0].stop(); response = '⏹️ Stopped'; }
            else response = '❌ Nothing playing';
        } else if (lower === 'pause') {
            if (players[0]) { players[0].pause(); response = '⏸️ Paused'; }
            else response = '❌ Nothing playing';
        } else if (lower === 'resume') {
            if (players[0]) { players[0].unpause(); response = '▶️ Resumed'; }
            else response = '❌ Nothing playing';
        } else if (lower.startsWith('volume ')) {
            const vol = parseInt(command.slice(7).trim());
            if (isNaN(vol) || vol < 1 || vol > 2000) {
                response = '❌ Volume 1-2000';
            } else {
                currentVolume = vol / 100;
                if (players[0] && players[0].state.resource) {
                    players[0].state.resource.volume.setVolume(currentVolume * 2);
                }
                response = '🔊 Volume: ' + vol + '%';
                io.emit('audio_update', { volume: Math.round(currentVolume * 100) });
            }
        } else if (lower === 'leave') {
            for (const key in connections) {
                try { connections[key].destroy(); } catch(e) {}
            }
            connections = {};
            players = {};
            for (const key in keepAliveIntervals) {
                clearInterval(keepAliveIntervals[key]);
            }
            keepAliveIntervals = {};
            response = '👋 Left voice';
        } else if (!isNaN(lower) && lower.length >= 10) {
            const channelId = lower;
            let count = 0;
            
            for (let i = 0; i < clients.length; i++) {
                const client = clients[i];
                if (!client) continue;
                
                try {
                    const connection = await joinVoiceChannelRaw(client, channelId);
                    if (connection) {
                        connections[i] = connection;
                        count++;
                        console.log('✅ Bot ' + (i + 1) + ' connected to voice');
                        
                        keepAliveIntervals[i] = setInterval(() => {
                            try {
                                if (connections[i]) {
                                    connections[i].setSpeaking(true);
                                    setTimeout(() => {
                                        try { connections[i].setSpeaking(false); } catch(e) {}
                                    }, 100);
                                }
                            } catch(e) {}
                        }, 15000);
                    }
                } catch (err) {
                    console.log('❌ Bot ' + (i + 1) + ' join voice error:', err.message);
                }
            }
            
            if (count > 0) {
                response = '✅ Connected ' + count + '/' + clients.length + ' bots to voice! They will stay forever!';
            } else {
                response = '❌ Failed to connect. Make sure bots are in the server!';
            }
        } else {
            response = '❌ Unknown command';
        }
    } catch (err) {
        response = '❌ Error: ' + err.message;
    }

    io.emit('command_response', { command, response });
    res.json({ response });
});

// ─── SOCKET ───
io.use((socket, next) => {
    const token = getToken(socket.handshake);
    if (!token) return next(new Error('Auth required'));
    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch { next(new Error('Invalid')); }
});

io.on('connection', (socket) => {
    socket.emit('status_update', {
        isRunning: isBotRunning,
        botCount: clients.length,
        totalTokens: dashboardTokens.length,
        currentTitle: currentTitle,
        volume: Math.round(currentVolume * 100)
    });

    socket.on('start_bots_with_tokens', (data) => {
        const newTokens = data.tokens;
        if (newTokens && newTokens.length > 0) {
            dashboardTokens = newTokens.filter(t => t && t.length > 10);
            startBots();
        }
    });

    socket.on('start_bots', startBots);
    socket.on('stop_bots', stopBots);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('\n🌸 RINTU FINAL: http://localhost:' + PORT);
    console.log('👑 admin / admin123');
    console.log('👤 friend1 / friend123');
    console.log('⚡ BOTS STAY IN VOICE FOREVER!\n');
});

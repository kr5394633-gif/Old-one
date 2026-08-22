const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Client } = require('discord.js-selfbot-v13');
const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg-static');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── HTML - Using template literal properly ───
const HTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌸 RINTU</title>
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
            align-items: flex-start;
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
        .btn-danger:hover { transform: translateY(-2px); }
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
            max-height: 250px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.75em;
            line-height: 1.8;
        }
        .log-entry .time { color: rgba(255,255,255,0.2); margin-right: 10px; }
        .log-entry .sys { color: rgba(255,255,255,0.3); }
        .log-entry .resp { color: #34d399; }
        .log-entry .err { color: #f87171; }
        .token-area { display: flex; flex-direction: column; gap: 10px; }
        .join-box { display: flex; gap: 10px; flex-wrap: wrap; }
        .join-box input { flex: 1; padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.3); color: #fff; outline: none; min-width: 150px; }
        .join-box input:focus { border-color: rgba(192,132,252,0.3); }
        .toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.9);
            padding: 12px 24px;
            border-radius: 12px;
            color: #fff;
            font-size: 0.9em;
            display: none;
            z-index: 999;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .toast.show { display: block; animation: fadeUp 0.3s ease; }
        @keyframes fadeUp {
            from { opacity: 0; transform: translateX(-50%) translateY(20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
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
<div class="container">
    <div class="header">
        <h1>🌸 RINTU</h1>
        <div class="sub">✦ WORKING DASHBOARD ✦</div>
    </div>

    <div class="card">
        <div class="card-title">🔑 Tokens</div>
        <div class="token-area">
            <textarea id="tokenInput" placeholder="Paste tokens (one per line)"></textarea>
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                <div class="token-stats"><span>📊 <span class="count" id="tokenCount">0</span></span></div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-save" id="saveBtn">💾 Save</button>
                    <button class="btn btn-glow" id="loadBtn">📂 Load</button>
                </div>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-title">🎯 Join Server</div>
        <div class="join-box">
            <input id="inviteInput" placeholder="https://discord.gg/invite">
            <button class="btn btn-glow" id="joinBtn">🚀 Join</button>
        </div>
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
            <div class="log-entry"><span class="time">[✦]</span> <span class="sys">🌸 RINTU ready</span></div>
        </div>
    </div>
</div>

<div id="toast" class="toast"></div>

<script>
// ============================================================
// ALL JAVASCRIPT - SIMPLIFIED AND WORKING
// ============================================================

function showToast(msg, type) {
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.borderColor = type === 'error' ? '#f87171' : '#34d399';
    toast.className = 'toast show';
    setTimeout(function() { toast.className = 'toast'; }, 3000);
}

function getTokens() {
    var text = document.getElementById('tokenInput').value;
    var lines = text.split('\n');
    var result = [];
    for (var i = 0; i < lines.length; i++) {
        var token = lines[i].trim();
        if (token.length > 10) {
            result.push(token);
        }
    }
    return result;
}

function updateTokenCount() {
    var tokens = getTokens();
    document.getElementById('tokenCount').textContent = tokens.length;
}

document.getElementById('tokenInput').addEventListener('input', updateTokenCount);

// Save tokens
document.getElementById('saveBtn').onclick = function() {
    var tokens = getTokens();
    if (tokens.length === 0) {
        showToast('No tokens to save!', 'error');
        return;
    }
    try {
        localStorage.setItem('rintu_tokens', JSON.stringify(tokens));
        showToast('Saved ' + tokens.length + ' tokens!', 'success');
        addLog('Saved ' + tokens.length + ' tokens', 'resp');
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
};

// Load tokens
document.getElementById('loadBtn').onclick = function() {
    try {
        var saved = localStorage.getItem('rintu_tokens');
        if (!saved) {
            showToast('No saved tokens!', 'error');
            return;
        }
        var tokens = JSON.parse(saved);
        if (tokens && tokens.length > 0) {
            document.getElementById('tokenInput').value = tokens.join('\n');
            updateTokenCount();
            showToast('Loaded ' + tokens.length + ' tokens!', 'success');
            addLog('Loaded ' + tokens.length + ' tokens', 'resp');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
};

// Auto load
(function() {
    try {
        var saved = localStorage.getItem('rintu_tokens');
        if (saved) {
            var tokens = JSON.parse(saved);
            if (tokens && tokens.length > 0) {
                document.getElementById('tokenInput').value = tokens.join('\n');
                updateTokenCount();
                setTimeout(function() {
                    addLog('Auto-loaded ' + tokens.length + ' tokens', 'sys');
                }, 500);
            }
        }
    } catch (e) {}
})();

// Log function
function addLog(msg, type) {
    if (!type) type = 'sys';
    var time = new Date().toLocaleTimeString();
    var entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = '<span class="time">[' + time + ']</span> <span class="' + type + '">' + msg + '</span>';
    document.getElementById('logArea').appendChild(entry);
    document.getElementById('logArea').scrollTop = document.getElementById('logArea').scrollHeight;
}

// Socket
var socket = io();

function updateStatus(running, count, title) {
    var dot = document.getElementById('statusDot');
    var text = document.getElementById('statusText');
    dot.className = 'status-dot ' + (running ? 'online' : 'offline');
    text.className = 'status-text ' + (running ? 'online' : 'offline');
    text.textContent = running ? 'ONLINE' : 'OFFLINE';
    document.getElementById('botCount').textContent = count || 0;
    if (title) document.getElementById('nowPlaying').textContent = title;
}

socket.on('connect', function() {
    addLog('Connected to server', 'sys');
});

socket.on('status_update', function(d) {
    updateStatus(d.isRunning, d.botCount, d.currentTitle);
});

socket.on('bots_started', function(d) {
    addLog('Started ' + d.count + ' bots', 'resp');
    updateStatus(true, d.count);
});

socket.on('bots_stopped', function() {
    addLog('Bots stopped', 'err');
    updateStatus(false, 0);
});

socket.on('bot_status', function(d) {
    addLog('Bot ' + d.index + '/' + d.total + ': ' + d.tag, 'resp');
});

socket.on('audio_update', function(d) {
    if (d.title) document.getElementById('nowPlaying').textContent = d.title;
    if (d.volume) document.getElementById('volDisplay').textContent = Math.round(d.volume);
});

socket.on('command_response', function(d) {
    var isErr = d.response.indexOf('❌') !== -1;
    addLog(d.command + ' → ' + d.response, isErr ? 'err' : 'resp');
});

// ─── START BUTTON ───
document.getElementById('startBtn').onclick = function() {
    addLog('START button clicked!', 'sys');
    var tokens = getTokens();
    addLog('Found ' + tokens.length + ' tokens', 'sys');
    
    if (tokens.length === 0) {
        showToast('Add tokens first!', 'error');
        addLog('No tokens to start', 'err');
        return;
    }
    
    localStorage.setItem('rintu_tokens', JSON.stringify(tokens));
    addLog('Saving tokens to localStorage', 'sys');
    addLog('Sending to server via HTTP POST...', 'sys');
    
    fetch('/api/start-bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: tokens })
    })
    .then(function(response) {
        addLog('Response status: ' + response.status, 'sys');
        return response.json();
    })
    .then(function(data) {
        addLog('Response: ' + JSON.stringify(data), 'sys');
        if (data.success) {
            addLog('Starting ' + data.count + ' bots...', 'resp');
            showToast('Starting ' + data.count + ' bots!', 'success');
        } else {
            addLog('Error: ' + data.error, 'err');
            showToast('Error: ' + data.error, 'error');
        }
    })
    .catch(function(e) {
        addLog('Fetch error: ' + e.message, 'err');
        showToast('Error: ' + e.message, 'error');
    });
};

// ─── STOP BUTTON ───
document.getElementById('stopBtn').onclick = function() {
    addLog('STOP button clicked!', 'sys');
    fetch('/api/stop-bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            addLog('Bots stopped', 'sys');
            showToast('Bots stopped', 'success');
        }
    })
    .catch(function(e) {
        addLog('Error: ' + e.message, 'err');
    });
};

// ─── JOIN SERVER ───
document.getElementById('joinBtn').onclick = function() {
    var invite = document.getElementById('inviteInput').value.trim();
    if (!invite) {
        showToast('Enter invite link!', 'error');
        return;
    }
    fetch('/api/join-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite: invite })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.message) {
            addLog(data.message, 'resp');
            showToast('Joined server!', 'success');
        }
        if (data.error) {
            addLog('Error: ' + data.error, 'err');
            showToast('Error: ' + data.error, 'error');
        }
    })
    .catch(function(e) {
        addLog('Error: ' + e.message, 'err');
    });
};

// ─── SEND COMMAND ───
function sendCmd(cmd) {
    if (!cmd) return;
    fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.response) {
            var isErr = d.response.indexOf('❌') !== -1;
            addLog(cmd + ' → ' + d.response, isErr ? 'err' : 'resp');
            if (!isErr) showToast(d.response, 'success');
        }
    })
    .catch(function(e) {
        addLog('Error: ' + e.message, 'err');
    });
}

document.getElementById('sendBtn').onclick = function() {
    var inp = document.getElementById('cmdInput');
    sendCmd(inp.value.trim());
    inp.value = '';
};

document.getElementById('cmdInput').onkeypress = function(e) {
    if (e.key === 'Enter') document.getElementById('sendBtn').click();
};

// ─── QUICK COMMANDS ───
var btns = document.querySelectorAll('.cmd-btn');
for (var i = 0; i < btns.length; i++) {
    btns[i].onclick = function() {
        var cmd = this.dataset.cmd;
        if (cmd === 'play') {
            var url = prompt('Enter YouTube URL:');
            if (url) sendCmd('play ' + url);
            return;
        }
        sendCmd(cmd);
    };
}

// ─── INITIAL STATUS ───
fetch('/api/status')
    .then(function(r) { return r.json(); })
    .then(function(d) {
        updateStatus(d.isRunning, d.botCount, d.currentTitle);
    })
    .catch(console.error);
</script>
</body>
</html>`;

// ─── SERVE ───
app.get('/', function(req, res) {
    res.send(HTML);
});

// ─── BOT ───
var dashboardTokens = [];
var isBotRunning = false;
var clients = [];
var connections = {};
var players = {};
var currentTitle = 'Nothing playing';
var currentVolume = 1.0;
var keepAliveIntervals = {};

console.log('🚀 SERVER STARTED!');

function startBots(tokens) {
    console.log('🔥 startBots() called with ' + tokens.length + ' tokens');
    
    if (isBotRunning) {
        console.log('⚠️ Bots already running');
        return { success: false, error: 'Bots already running' };
    }
    
    if (!tokens || tokens.length === 0) {
        console.log('❌ No tokens');
        return { success: false, error: 'No tokens' };
    }

    dashboardTokens = tokens;
    console.log('🚀 Starting ' + dashboardTokens.length + ' bots...');
    isBotRunning = true;
    
    for (var i = 0; i < dashboardTokens.length; i++) {
        (function(index) {
            var token = dashboardTokens[index];
            console.log('🔑 Logging in bot ' + (index + 1) + '...');
            
            var client = new Client({ 
                checkUpdate: false,
                ws: { properties: { $browser: 'Discord iOS' } }
            });

            client.on('ready', function() {
                var tag = client.user ? client.user.tag : 'Unknown';
                console.log('✅ Bot ' + (index + 1) + '/' + dashboardTokens.length + ': ' + tag + ' ONLINE!');
                io.emit('bot_status', { index: index + 1, total: dashboardTokens.length, tag: tag });
            });

            client.on('error', function(err) {
                console.log('❌ Bot ' + (index + 1) + ' error:', err.message);
            });

            client.login(token).catch(function(err) {
                console.log('❌ Bot ' + (index + 1) + ' login failed:', err.message);
            });
            clients.push(client);
        })(i);
    }
    
    io.emit('bots_started', { count: dashboardTokens.length });
    console.log('✅ startBots() completed');
    return { success: true, count: dashboardTokens.length };
}

function stopBots() {
    console.log('🔥 stopBots() called');
    
    if (!isBotRunning) {
        return { success: false, error: 'Not running' };
    }
    
    isBotRunning = false;
    
    for (var key in players) {
        try { players[key].stop(); } catch(e) {}
    }
    players = {};
    
    for (var key2 in connections) {
        try { connections[key2].destroy(); } catch(e) {}
    }
    connections = {};
    
    for (var key3 in keepAliveIntervals) {
        clearInterval(keepAliveIntervals[key3]);
    }
    keepAliveIntervals = {};
    
    for (var i = 0; i < clients.length; i++) {
        try { clients[i].destroy(); } catch(e) {}
    }
    clients = [];
    
    io.emit('bots_stopped');
    console.log('✅ All bots stopped');
    return { success: true };
}

// ─── API ───

app.post('/api/start-bots', function(req, res) {
    console.log('📨 POST /api/start-bots');
    console.log('📦 Body:', req.body);
    
    var tokens = req.body.tokens;
    if (!tokens || tokens.length === 0) {
        return res.json({ success: false, error: 'No tokens' });
    }
    
    var result = startBots(tokens);
    res.json(result);
});

app.post('/api/stop-bots', function(req, res) {
    console.log('📨 POST /api/stop-bots');
    var result = stopBots();
    res.json(result);
});

app.post('/api/join-server', async function(req, res) {
    var invite = req.body.invite;
    if (!invite) return res.json({ error: 'No invite' });
    
    if (clients.length === 0) {
        return res.json({ error: 'Start bots first!' });
    }

    var inviteCode = invite;
    if (invite.indexOf('discord.gg/') !== -1) {
        inviteCode = invite.split('discord.gg/')[1].split('/')[0].split('?')[0];
    }
    if (invite.indexOf('discord.com/invite/') !== -1) {
        inviteCode = invite.split('discord.com/invite/')[1].split('/')[0].split('?')[0];
    }

    var results = [];
    for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        if (!client) continue;
        
        try {
            var inviteObj = await client.fetchInvite(inviteCode);
            if (inviteObj) {
                await client.acceptInvite(inviteCode);
                results.push('Bot ' + (i + 1) + ' joined');
            }
        } catch (err1) {
            try {
                var response = await axios.post(
                    'https://discord.com/api/v9/invites/' + inviteCode,
                    {},
                    {
                        headers: {
                            'Authorization': client.token || client.authToken,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                if (response.data && response.data.guild) {
                    results.push('Bot ' + (i + 1) + ' joined');
                }
            } catch (err2) {
                results.push('Bot ' + (i + 1) + ' failed');
            }
        }
    }

    var message = results.join('\n');
    io.emit('command_response', { command: 'Join Server', response: message });
    res.json({ message: message });
});

app.get('/api/status', function(req, res) {
    res.json({
        isRunning: isBotRunning,
        botCount: clients.length,
        totalTokens: dashboardTokens.length,
        currentTitle: currentTitle,
        volume: Math.round(currentVolume * 100)
    });
});

app.post('/api/command', async function(req, res) {
    var command = req.body.command;
    if (!command) return res.json({ error: 'No command' });

    var lower = command.toLowerCase().trim();
    var response = '';

    try {
        if (lower.indexOf('play ') === 0) {
            var url = command.slice(5).trim();
            if (!connections[0]) {
                response = 'Join voice first! Send channel ID';
            } else {
                try {
                    var stream = ytdl(url, { 
                        filter: 'audioonly',
                        quality: 'highestaudio',
                        highWaterMark: 1 << 25
                    });
                    
                    var resource = createAudioResource(stream, {
                        inputType: StreamType.Arbitrary,
                        inlineVolume: true
                    });
                    
                    resource.volume.setVolume(currentVolume * 2);
                    var player = createAudioPlayer();
                    player.play(resource);
                    
                    if (connections[0]) {
                        connections[0].subscribe(player);
                    }
                    players[0] = player;
                    
                    currentTitle = 'Playing';
                    io.emit('audio_update', { 
                        status: 'playing', 
                        title: currentTitle, 
                        volume: Math.round(currentVolume * 100) 
                    });
                    response = 'Now playing!';
                } catch (err) {
                    response = 'Error: ' + err.message;
                }
            }
        } else if (lower === 'stop') {
            if (players[0]) { players[0].stop(); response = 'Stopped'; }
            else response = 'Nothing playing';
        } else if (lower === 'pause') {
            if (players[0]) { players[0].pause(); response = 'Paused'; }
            else response = 'Nothing playing';
        } else if (lower === 'resume') {
            if (players[0]) { players[0].unpause(); response = 'Resumed'; }
            else response = 'Nothing playing';
        } else if (lower.indexOf('volume ') === 0) {
            var vol = parseInt(command.slice(7).trim());
            if (isNaN(vol) || vol < 1 || vol > 2000) {
                response = 'Volume 1-2000';
            } else {
                currentVolume = vol / 100;
                if (players[0] && players[0].state.resource) {
                    players[0].state.resource.volume.setVolume(currentVolume * 2);
                }
                response = 'Volume: ' + vol + '%';
                io.emit('audio_update', { volume: Math.round(currentVolume * 100) });
            }
        } else if (lower === 'leave') {
            for (var key in connections) {
                try { connections[key].destroy(); } catch(e) {}
            }
            connections = {};
            players = {};
            for (var key2 in keepAliveIntervals) {
                clearInterval(keepAliveIntervals[key2]);
            }
            keepAliveIntervals = {};
            response = 'Left voice';
        } else if (!isNaN(lower) && lower.length >= 10) {
            var channelId = lower;
            var count = 0;
            
            for (var i = 0; i < clients.length; i++) {
                var client = clients[i];
                if (!client) continue;
                
                try {
                    var channel = await client.channels.fetch(channelId);
                    if (channel) {
                        var connection = client.voice.connect(channelId);
                        connections[i] = connection;
                        count++;
                        console.log('Bot ' + (i + 1) + ' connected to voice');
                        
                        keepAliveIntervals[i] = setInterval(function() {
                            try {
                                if (connections[i]) {
                                    connections[i].setSpeaking(true);
                                    setTimeout(function() {
                                        try { connections[i].setSpeaking(false); } catch(e) {}
                                    }, 100);
                                }
                            } catch(e) {}
                        }, 15000);
                    }
                } catch (err) {
                    console.log('Bot ' + (i + 1) + ' join error');
                }
            }
            
            if (count > 0) {
                response = 'Connected ' + count + '/' + clients.length + ' bots to voice!';
            } else {
                response = 'Failed to connect. Make sure bots are in the server!';
            }
        } else {
            response = 'Unknown command';
        }
    } catch (err) {
        response = 'Error: ' + err.message;
    }

    io.emit('command_response', { command: command, response: response });
    res.json({ response: response });
});

// ─── SOCKET ───
io.on('connection', function(socket) {
    console.log('Client connected');
    socket.emit('status_update', {
        isRunning: isBotRunning,
        botCount: clients.length,
        totalTokens: dashboardTokens.length,
        currentTitle: currentTitle,
        volume: Math.round(currentVolume * 100)
    });
});

var PORT = process.env.PORT || 3000;
server.listen(PORT, function() {
    console.log('\n🌸 RINTU: http://localhost:' + PORT);
    console.log('✅ Server started!');
    console.log('📊 Click START and check logs!\n');
});

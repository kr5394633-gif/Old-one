const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Client } = require('discord.js-selfbot-v13');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());

// ─── HTML DASHBOARD ───
const HTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌸 RINTU DASHBOARD</title>
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
        .header { text-align: center; padding: 30px 0 25px; }
        .header h1 {
            font-size: 2.8em;
            font-weight: 900;
            background: linear-gradient(135deg, #ff6b9d, #c084fc, #60a5fa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: 2px;
        }
        .header .subtitle { color: rgba(255,255,255,0.4); font-size: 0.85em; letter-spacing: 4px; }
        .header .glow-line {
            width: 100px;
            height: 3px;
            margin: 12px auto 0;
            background: linear-gradient(90deg, transparent, #c084fc, #ff6b9d, transparent);
            border-radius: 10px;
        }
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
            min-height: 120px;
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
        .status-badge { font-size: 0.7em; padding: 4px 14px; border-radius: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); }
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
        .btn-start { background: linear-gradient(135deg, #34d399, #059669); color: #fff; box-shadow: 0 4px 20px rgba(52,211,153,0.3); }
        .btn-start:hover { transform: translateY(-2px); }
        .btn-stop { background: linear-gradient(135deg, #f87171, #dc2626); color: #fff; box-shadow: 0 4px 20px rgba(248,113,113,0.3); }
        .btn-stop:hover { transform: translateY(-2px); }
        .btn-glow { background: linear-gradient(135deg, #c084fc, #7c3aed); color: #fff; box-shadow: 0 4px 20px rgba(192,132,252,0.3); }
        .btn-glow:hover { transform: translateY(-2px); }
        .btn-save { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #1a1a2e; box-shadow: 0 4px 20px rgba(251,191,36,0.3); }
        .btn-save:hover { transform: translateY(-2px); }
        .now-playing {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 14px 18px;
            background: rgba(0,0,0,0.3);
            border-radius: 14px;
            margin-top: 12px;
            border: 1px solid rgba(255,255,255,0.04);
        }
        .now-playing .icon { font-size: 2em; }
        .now-playing .label { font-size: 0.65em; text-transform: uppercase; letter-spacing: 2px; color: rgba(255,255,255,0.3); }
        .now-playing .title { font-weight: 600; color: #e2e8f0; font-size: 0.95em; background: linear-gradient(135deg, #c084fc, #60a5fa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .cmd-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(85px, 1fr)); gap: 8px; }
        .cmd-btn {
            padding: 10px 6px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.06);
            background: rgba(255,255,255,0.03);
            color: rgba(255,255,255,0.7);
            font-size: 0.7em;
            cursor: pointer;
            transition: all 0.25s ease;
            text-align: center;
            font-weight: 500;
        }
        .cmd-btn:hover { background: rgba(192,132,252,0.12); border-color: rgba(192,132,252,0.2); transform: translateY(-2px); }
        .cmd-btn .icon { font-size: 1.4em; display: block; margin-bottom: 3px; }
        .cmd-btn .label { font-size: 0.7em; opacity: 0.7; }
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
            border: 1px solid rgba(255,255,255,0.04);
        }
        .log-entry { padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.02); }
        .log-entry .time { color: rgba(255,255,255,0.2); margin-right: 10px; }
        .log-entry .cmd { color: #60a5fa; }
        .log-entry .resp { color: #34d399; }
        .log-entry .err { color: #f87171; }
        .log-entry .sys { color: rgba(255,255,255,0.3); }
        .token-area { display: flex; flex-direction: column; gap: 10px; }
        @media (max-width: 600px) {
            .header h1 { font-size: 1.8em; }
            .status-bar { flex-direction: column; align-items: stretch; }
            .btn-group { justify-content: center; }
            .cmd-grid { grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); }
            .now-playing { flex-direction: column; text-align: center; }
            .input-row { flex-direction: column; }
        }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>🌸 RINTU DASHBOARD</h1>
        <div class="subtitle">✦ Selfbot Voice Controller ✦</div>
        <div class="glow-line"></div>
    </div>

    <div class="card">
        <div class="card-title">🔑 Token Manager</div>
        <div class="token-area">
            <textarea id="tokenInput" placeholder="Paste your tokens here (one per line)"></textarea>
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                <div class="token-stats">
                    <span>📊 Tokens: <span class="count" id="tokenCount">0</span></span>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-save" id="saveTokensBtn">💾 Save</button>
                    <button class="btn btn-glow" id="loadTokensBtn">📂 Load</button>
                </div>
            </div>
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
                <button class="btn btn-stop" id="stopBtn">■ STOP</button>
            </div>
        </div>
        <div class="now-playing">
            <span class="icon">🎵</span>
            <div style="flex:1;min-width:0;">
                <div class="label">NOW PLAYING</div>
                <div class="title" id="nowPlaying">✨ Ready to play</div>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-title">⚡ Quick Commands</div>
        <div class="cmd-grid">
            <button class="cmd-btn" data-cmd="play"><span class="icon">▶️</span><span class="label">Play</span></button>
            <button class="cmd-btn" data-cmd="stop"><span class="icon">⏹️</span><span class="label">Stop</span></button>
            <button class="cmd-btn" data-cmd="pause"><span class="icon">⏸️</span><span class="label">Pause</span></button>
            <button class="cmd-btn" data-cmd="resume"><span class="icon">▶️</span><span class="label">Resume</span></button>
            <button class="cmd-btn" data-cmd="volume 200"><span class="icon">🔊</span><span class="label">+200%</span></button>
            <button class="cmd-btn" data-cmd="volume 500"><span class="icon">💥</span><span class="label">+500%</span></button>
            <button class="cmd-btn" data-cmd="leave"><span class="icon">👋</span><span class="label">Leave</span></button>
        </div>
    </div>

    <div class="card">
        <div class="card-title">⌨️ Custom Command</div>
        <div class="input-row">
            <input id="cmdInput" placeholder="play https://youtube.com/... or channel_id">
            <button class="btn btn-glow" id="sendBtn">Send ✦</button>
        </div>
    </div>

    <div class="card">
        <div class="card-title">📋 Activity Log</div>
        <div class="log-area" id="logArea">
            <div class="log-entry"><span class="time">[✦]</span> <span class="sys">🌸 RINTU DASHBOARD ready.</span></div>
        </div>
    </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
var logArea = document.getElementById('logArea');
var statusDot = document.getElementById('statusDot');
var statusText = document.getElementById('statusText');
var botCount = document.getElementById('botCount');
var volDisplay = document.getElementById('volDisplay');
var nowPlaying = document.getElementById('nowPlaying');
var tokenInput = document.getElementById('tokenInput');
var tokenCount = document.getElementById('tokenCount');

function updateTokenStats() {
    var lines = tokenInput.value.split('\\n').filter(l => l.trim().length > 10);
    tokenCount.textContent = lines.length;
}
tokenInput.addEventListener('input', updateTokenStats);

function getTokens() {
    return tokenInput.value.split('\\n').map(l => l.trim()).filter(l => l.length > 10);
}

document.getElementById('saveTokensBtn').onclick = function() {
    var tokens = getTokens();
    if (!tokens.length) { addLog('❌ No tokens!', 'err'); return; }
    localStorage.setItem('rintu_tokens', JSON.stringify(tokens));
    addLog('💾 Saved ' + tokens.length + ' tokens', 'resp');
};

document.getElementById('loadTokensBtn').onclick = function() {
    var saved = localStorage.getItem('rintu_tokens');
    if (!saved) { addLog('❌ No saved tokens', 'err'); return; }
    var tokens = JSON.parse(saved);
    tokenInput.value = tokens.join('\\n');
    updateTokenStats();
    addLog('📂 Loaded ' + tokens.length + ' tokens', 'resp');
};

window.onload = function() {
    var saved = localStorage.getItem('rintu_tokens');
    if (saved) {
        try {
            var tokens = JSON.parse(saved);
            tokenInput.value = tokens.join('\\n');
            updateTokenStats();
        } catch(e) {}
    }
};

function addLog(msg, type) {
    if (!type) type = 'sys';
    var time = new Date().toLocaleTimeString();
    var entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = '<span class="time">[' + time + ']</span> <span class="' + type + '">' + msg + '</span>';
    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
}

var socket = io();

function updateStatus(running, count, title) {
    statusDot.className = 'status-dot ' + (running ? 'online' : 'offline');
    statusText.className = 'status-text ' + (running ? 'online' : 'offline');
    statusText.textContent = running ? '🟢 ONLINE' : '🔴 OFFLINE';
    botCount.textContent = count || 0;
    if (title) nowPlaying.textContent = title;
}

socket.on('status_update', function(d) {
    updateStatus(d.isRunning, d.botCount, d.currentTitle);
});

socket.on('bots_started', function(d) {
    addLog('🚀 ' + d.count + ' bots started', 'resp');
    updateStatus(true, d.count);
});

socket.on('bots_stopped', function() {
    addLog('⛔ Bots stopped', 'err');
    updateStatus(false, 0);
});

socket.on('bot_status', function(d) {
    addLog('🤖 Bot ' + d.index + '/' + d.total + ': ' + d.tag, 'resp');
});

socket.on('audio_update', function(d) {
    if (d.title) nowPlaying.textContent = d.title;
    if (d.volume) volDisplay.textContent = Math.round(d.volume);
    if (d.status === 'playing') addLog('🎵 Playing: ' + d.title, 'resp');
});

socket.on('command_response', function(d) {
    var isErr = d.response.includes('❌');
    addLog('✦ ' + d.command + ' → ' + d.response, isErr ? 'err' : 'resp');
});

document.getElementById('startBtn').onclick = function() {
    var tokens = getTokens();
    if (!tokens.length) { addLog('❌ Add tokens!', 'err'); return; }
    localStorage.setItem('rintu_tokens', JSON.stringify(tokens));
    socket.emit('start_bots_with_tokens', { tokens: tokens });
    addLog('🚀 Starting ' + tokens.length + ' bots...', 'sys');
};

document.getElementById('stopBtn').onclick = function() {
    socket.emit('stop_bots');
    addLog('⛔ Stopping...', 'sys');
};

function sendCmd(cmd) {
    if (!cmd) return;
    fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
    })
    .then(r => r.json())
    .then(d => {
        if (d.response) {
            var isErr = d.response.includes('❌');
            addLog('✦ ' + cmd + ' → ' + d.response, isErr ? 'err' : 'resp');
        }
    })
    .catch(e => addLog('❌ Error: ' + e.message, 'err'));
}

document.getElementById('sendBtn').onclick = function() {
    var inp = document.getElementById('cmdInput');
    sendCmd(inp.value.trim());
    inp.value = '';
};

document.getElementById('cmdInput').onkeypress = function(e) {
    if (e.key === 'Enter') document.getElementById('sendBtn').click();
};

document.querySelectorAll('.cmd-btn').forEach(function(btn) {
    btn.onclick = function() {
        var cmd = this.dataset.cmd;
        if (cmd === 'play') {
            var url = prompt('🎵 Enter YouTube URL:');
            if (url) sendCmd('play ' + url);
            return;
        }
        sendCmd(cmd);
    };
});

fetch('/api/status').then(r => r.json()).then(d => {
    updateStatus(d.isRunning, d.botCount, d.currentTitle);
}).catch(console.error);
</script>
</body>
</html>`;

app.get('/', (req, res) => res.send(HTML));

// ─── BOT LOGIC ───
var dashboardTokens = [];
var isBotRunning = false;
var clients = [];
var connections = {};
var players = {};
var currentTitle = 'Nothing playing';
var currentUrl = null;
var currentVolume = 1.0;

function startBots() {
    if (isBotRunning) return;
    if (!dashboardTokens.length) {
        console.log('❌ No tokens');
        return;
    }

    isBotRunning = true;

    dashboardTokens.forEach((token, index) => {
        const client = new Client({ checkUpdate: false });

        client.on('ready', () => {
            const tag = client.user ? client.user.tag : 'Unknown';
            console.log('🤖 Bot ' + (index + 1) + '/' + dashboardTokens.length + ': ' + tag);
            io.emit('bot_status', { index: index + 1, total: dashboardTokens.length, tag: tag });
        });

        client.login(token).catch(err => {
            console.log('❌ Bot ' + (index + 1) + ' login failed');
        });

        clients.push(client);
    });

    io.emit('bots_started', { count: dashboardTokens.length });
}

function stopBots() {
    isBotRunning = false;
    clients.forEach(c => { try { c.destroy(); } catch(e) {} });
    clients = [];
    connections = {};
    players = {};
    io.emit('bots_stopped');
    console.log('⛔ All bots stopped');
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
                response = '❌ Join a voice channel first! Send channel ID';
            } else {
                try {
                    const stream = ytdl(url, { filter: 'audioonly', highWaterMark: 1 << 25 });
                    const resource = createAudioResource(stream, { inlineVolume: true });
                    resource.volume.setVolume(currentVolume * 2);

                    const player = createAudioPlayer();
                    player.play(resource);

                    connections[0].subscribe(player);
                    players[0] = player;

                    currentTitle = '🎵 ' + url;
                    io.emit('audio_update', { status: 'playing', title: currentTitle, volume: Math.round(currentVolume * 100) });
                    response = '🎵 Now playing!';
                } catch (err) {
                    response = '❌ Error: ' + err.message;
                }
            }
        } else if (lower === 'stop') {
            if (players[0]) {
                players[0].stop();
                response = '⏹️ Stopped';
            }
        } else if (lower === 'pause') {
            if (players[0]) {
                players[0].pause();
                response = '⏸️ Paused';
            }
        } else if (lower === 'resume') {
            if (players[0]) {
                players[0].unpause();
                response = '▶️ Resumed';
            }
        } else if (lower.startsWith('volume ')) {
            const vol = parseInt(command.slice(7).trim());
            if (isNaN(vol) || vol < 1 || vol > 500) {
                response = '❌ Volume 1-500';
            } else {
                currentVolume = vol / 100;
                if (players[0] && players[0].state.resource) {
                    players[0].state.resource.volume.setVolume(currentVolume * 2);
                }
                response = '🔊 Volume: ' + vol + '%';
                io.emit('audio_update', { volume: Math.round(currentVolume * 100) });
            }
        } else if (lower === 'leave') {
            if (connections[0]) {
                connections[0].destroy();
                connections = {};
                players = {};
                response = '👋 Left voice';
            }
        } else if (!isNaN(lower) && lower.length >= 10) {
            const channelId = lower;
            let count = 0;

            for (let i = 0; i < clients.length; i++) {
                const client = clients[i];
                if (!client) continue;

                try {
                    const channel = await client.channels.fetch(channelId);
                    if (!channel) continue;

                    const connection = joinVoiceChannel({
                        channelId: channel.id,
                        guildId: channel.guild.id,
                        adapterCreator: channel.guild.voiceAdapterCreator,
                        selfMute: false,
                        selfDeaf: false,
                        group: client.user.id
                    });

                    connections[i] = connection;
                    count++;
                } catch (err) {
                    console.log('❌ Bot ' + (i + 1) + ' join error');
                }
            }

            response = '✅ Connected ' + count + '/' + clients.length + ' bots to voice';
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
            console.log('🔄 ' + dashboardTokens.length + ' tokens loaded');
            startBots();
        }
    });

    socket.on('start_bots', startBots);
    socket.on('stop_bots', stopBots);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('\n🌸 RINTU DASHBOARD: http://localhost:' + PORT);
    console.log('📱 Open your Railway URL!\n');
});

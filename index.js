const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require("fs");
const path = require("path");

// Patch for selfbot
try {
    const ClientUserSettingManager = require("./node_modules/discord.js-selfbot-v13/src/managers/ClientUserSettingManager.js");
    if (ClientUserSettingManager && ClientUserSettingManager.prototype) {
        ClientUserSettingManager.prototype._patch = function(data) { return this; };
    }
} catch (e) {}

const { Client } = require("discord.js-selfbot-v13");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require("@discordjs/voice");
const { spawn } = require("child_process");
const youtubedl = require("youtube-dl-exec");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());

// ─── SERVE HTML DIRECTLY FROM MEMORY ───
const HTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌸 RINTU DASHBOARD</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Poppins', sans-serif;
            background: #0a0a1a;
            min-height: 100vh;
            padding: 16px;
            background-image: 
                radial-gradient(ellipse at 10% 20%, rgba(120, 80, 255, 0.15) 0%, transparent 50%),
                radial-gradient(ellipse at 90% 80%, rgba(255, 50, 150, 0.12) 0%, transparent 50%);
            display: flex;
            justify-content: center;
            align-items: flex-start;
        }
        .container { max-width: 850px; width: 100%; margin: 0 auto; }
        .header {
            text-align: center;
            padding: 30px 0 25px;
        }
        .header h1 {
            font-family: 'Orbitron', monospace;
            font-size: 2.8em;
            font-weight: 900;
            background: linear-gradient(135deg, #ff6b9d, #c084fc, #60a5fa);
            background-size: 300% 300%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: gradientShift 4s ease-in-out infinite;
            letter-spacing: 2px;
        }
        @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        .header .subtitle {
            color: rgba(255, 255, 255, 0.5);
            font-size: 0.85em;
            letter-spacing: 4px;
            margin-top: 4px;
            font-weight: 300;
            text-transform: uppercase;
        }
        .header .glow-line {
            width: 100px;
            height: 3px;
            margin: 12px auto 0;
            background: linear-gradient(90deg, transparent, #c084fc, #ff6b9d, transparent);
            border-radius: 10px;
            animation: pulseGlow 2s ease-in-out infinite;
        }
        @keyframes pulseGlow {
            0%, 100% { opacity: 0.4; transform: scaleX(0.8); }
            50% { opacity: 1; transform: scaleX(1); }
        }
        .card {
            background: rgba(22, 22, 50, 0.75);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 16px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }
        .card-title {
            font-size: 0.75em;
            text-transform: uppercase;
            letter-spacing: 3px;
            color: rgba(255, 255, 255, 0.3);
            margin-bottom: 14px;
            font-weight: 600;
        }
        .token-area textarea {
            width: 100%;
            min-height: 120px;
            padding: 14px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(0, 0, 0, 0.3);
            color: #e2e8f0;
            font-size: 0.8em;
            font-family: 'Courier New', monospace;
            outline: none;
            resize: vertical;
        }
        .token-area textarea:focus { border-color: rgba(192, 132, 252, 0.3); }
        .token-area textarea::placeholder { color: rgba(255, 255, 255, 0.2); }
        .token-stats {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            font-size: 0.8em;
            color: rgba(255, 255, 255, 0.4);
        }
        .token-stats span {
            background: rgba(255, 255, 255, 0.05);
            padding: 4px 12px;
            border-radius: 20px;
        }
        .token-stats .count { color: #c084fc; font-weight: 600; }
        .status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }
        .status-left {
            display: flex;
            align-items: center;
            gap: 14px;
            flex-wrap: wrap;
        }
        .status-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            display: inline-block;
            transition: all 0.3s;
        }
        .status-dot.online {
            background: #34d399;
            box-shadow: 0 0 20px rgba(52, 211, 153, 0.5);
        }
        .status-dot.offline {
            background: #f87171;
            box-shadow: 0 0 20px rgba(248, 113, 113, 0.3);
        }
        .status-text { font-weight: 600; font-size: 1em; }
        .status-text.online { color: #34d399; }
        .status-text.offline { color: #f87171; }
        .status-badge {
            font-size: 0.7em;
            padding: 4px 14px;
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.6);
        }
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
            font-family: 'Poppins', sans-serif;
            letter-spacing: 0.5px;
        }
        .btn:active { transform: scale(0.95); }
        .btn-start {
            background: linear-gradient(135deg, #34d399, #059669);
            color: #fff;
            box-shadow: 0 4px 20px rgba(52, 211, 153, 0.3);
        }
        .btn-start:hover { transform: translateY(-2px); }
        .btn-stop {
            background: linear-gradient(135deg, #f87171, #dc2626);
            color: #fff;
            box-shadow: 0 4px 20px rgba(248, 113, 113, 0.3);
        }
        .btn-stop:hover { transform: translateY(-2px); }
        .btn-glow {
            background: linear-gradient(135deg, #c084fc, #7c3aed);
            color: #fff;
            box-shadow: 0 4px 20px rgba(192, 132, 252, 0.3);
        }
        .btn-glow:hover { transform: translateY(-2px); }
        .btn-save {
            background: linear-gradient(135deg, #fbbf24, #f59e0b);
            color: #1a1a2e;
            box-shadow: 0 4px 20px rgba(251, 191, 36, 0.3);
        }
        .btn-save:hover { transform: translateY(-2px); }
        .now-playing {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 14px 18px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 14px;
            margin-top: 12px;
            border: 1px solid rgba(255, 255, 255, 0.04);
        }
        .now-playing .icon {
            font-size: 2em;
            animation: spin 3s linear infinite;
            display: inline-block;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .now-playing .label {
            font-size: 0.65em;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: rgba(255, 255, 255, 0.3);
        }
        .now-playing .title {
            font-weight: 600;
            color: #e2e8f0;
            font-size: 0.95em;
            background: linear-gradient(135deg, #c084fc, #60a5fa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .effects-wrap { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
        .badge {
            display: inline-block;
            padding: 3px 14px;
            border-radius: 20px;
            font-size: 0.65em;
            font-weight: 600;
            text-transform: uppercase;
        }
        .badge-bass { background: rgba(192, 132, 252, 0.2); color: #c084fc; border: 1px solid rgba(192, 132, 252, 0.2); }
        .badge-blast { background: rgba(251, 146, 60, 0.2); color: #fb923c; border: 1px solid rgba(251, 146, 60, 0.2); }
        .badge-pungi { background: rgba(52, 211, 153, 0.2); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.2); }
        .badge-super { background: rgba(248, 113, 113, 0.2); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.2); }
        .badge-force { background: rgba(244, 114, 182, 0.2); color: #f472b6; border: 1px solid rgba(244, 114, 182, 0.2); }
        .badge-loop { background: rgba(34, 211, 238, 0.2); color: #22d3ee; border: 1px solid rgba(34, 211, 238, 0.2); }
        .badge-loud { background: rgba(251, 191, 36, 0.2); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.2); }
        .cmd-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(85px, 1fr));
            gap: 8px;
        }
        .cmd-btn {
            padding: 10px 6px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(255, 255, 255, 0.03);
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.7em;
            cursor: pointer;
            transition: all 0.25s ease;
            text-align: center;
            font-family: 'Poppins', sans-serif;
            font-weight: 500;
        }
        .cmd-btn:hover {
            background: rgba(192, 132, 252, 0.12);
            border-color: rgba(192, 132, 252, 0.2);
            transform: translateY(-2px);
        }
        .cmd-btn .icon { font-size: 1.4em; display: block; margin-bottom: 3px; }
        .cmd-btn .label { font-size: 0.7em; opacity: 0.7; }
        .input-row {
            display: flex;
            gap: 10px;
            margin-top: 4px;
        }
        .input-row input {
            flex: 1;
            padding: 14px 18px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(0, 0, 0, 0.3);
            color: #e2e8f0;
            font-size: 0.9em;
            font-family: 'Poppins', sans-serif;
            outline: none;
        }
        .input-row input:focus { border-color: rgba(192, 132, 252, 0.3); }
        .input-row input::placeholder { color: rgba(255, 255, 255, 0.2); }
        .log-area {
            background: rgba(0, 0, 0, 0.4);
            border-radius: 14px;
            padding: 14px;
            max-height: 200px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.75em;
            line-height: 1.8;
            border: 1px solid rgba(255, 255, 255, 0.04);
        }
        .log-area::-webkit-scrollbar { width: 4px; }
        .log-area::-webkit-scrollbar-thumb { background: rgba(192, 132, 252, 0.3); border-radius: 10px; }
        .log-entry { padding: 2px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.02); }
        .log-entry .time { color: rgba(255, 255, 255, 0.2); margin-right: 10px; }
        .log-entry .cmd { color: #60a5fa; }
        .log-entry .resp { color: #34d399; }
        .log-entry .err { color: #f87171; }
        .log-entry .sys { color: rgba(255, 255, 255, 0.3); }
        .token-area { display: flex; flex-direction: column; gap: 10px; }
        @media (max-width: 600px) {
            .header h1 { font-size: 1.8em; }
            .status-bar { flex-direction: column; align-items: stretch; }
            .btn-group { justify-content: center; }
            .status-left { justify-content: center; }
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
        <div class="subtitle">✦ Discord Self-Bot Controller ✦</div>
        <div class="glow-line"></div>
    </div>

    <div class="card">
        <div class="card-title">🔑 Token Manager</div>
        <div class="token-area">
            <textarea id="tokenInput" placeholder="Paste your tokens here (one per line)&#10;Example:&#10;mfa.xxxxx&#10;mfa.yyyyy"></textarea>
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                <div class="token-stats">
                    <span>📊 Tokens: <span class="count" id="tokenCount">0</span></span>
                    <span>✅ Valid: <span class="count" id="validCount">0</span></span>
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
            <div class="effects-wrap" id="effectsWrap"></div>
        </div>
    </div>

    <div class="card">
        <div class="card-title">⚡ Quick Commands</div>
        <div class="cmd-grid">
            <button class="cmd-btn" data-cmd="stop"><span class="icon">⏹️</span><span class="label">Stop</span></button>
            <button class="cmd-btn" data-cmd="pause"><span class="icon">⏸️</span><span class="label">Pause</span></button>
            <button class="cmd-btn" data-cmd="resume"><span class="icon">▶️</span><span class="label">Resume</span></button>
            <button class="cmd-btn" data-cmd="blast"><span class="icon">🔥</span><span class="label">Blast</span></button>
            <button class="cmd-btn" data-cmd="doubleblast"><span class="icon">💥</span><span class="label">Double</span></button>
            <button class="cmd-btn" data-cmd="superloud"><span class="icon">🔊</span><span class="label">Super</span></button>
            <button class="cmd-btn" data-cmd="forceloud"><span class="icon">⚡</span><span class="label">Force</span></button>
            <button class="cmd-btn" data-cmd="bassboost"><span class="icon">🎵</span><span class="label">Bass</span></button>
            <button class="cmd-btn" data-cmd="pungi"><span class="icon">🐍</span><span class="label">Pungi</span></button>
            <button class="cmd-btn" data-cmd="loudmode"><span class="icon">📢</span><span class="label">Loud</span></button>
            <button class="cmd-btn" data-cmd="loop"><span class="icon">🔄</span><span class="label">Loop</span></button>
            <button class="cmd-btn" data-cmd="leave"><span class="icon">👋</span><span class="label">Leave</span></button>
            <button class="cmd-btn" data-cmd="max"><span class="icon">💀</span><span class="label">Max</span></button>
            <button class="cmd-btn" data-cmd="status"><span class="icon">📊</span><span class="label">Status</span></button>
        </div>
    </div>

    <div class="card">
        <div class="card-title">⌨️ Custom Command</div>
        <div class="input-row">
            <input id="cmdInput" placeholder='play https://youtube.com/... or channel_id'>
            <button class="btn btn-glow" id="sendBtn">Send ✦</button>
        </div>
    </div>

    <div class="card">
        <div class="card-title">📋 Activity Log</div>
        <div class="log-area" id="logArea">
            <div class="log-entry"><span class="time">[✦]</span> <span class="sys">RINTU DASHBOARD ready. Add tokens and press START.</span></div>
        </div>
    </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
const logArea = document.getElementById('logArea');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const botCount = document.getElementById('botCount');
const volDisplay = document.getElementById('volDisplay');
const nowPlaying = document.getElementById('nowPlaying');
const effectsWrap = document.getElementById('effectsWrap');
const tokenInput = document.getElementById('tokenInput');
const tokenCount = document.getElementById('tokenCount');
const validCount = document.getElementById('validCount');

function updateTokenStats() {
    const text = tokenInput.value;
    const lines = text.split('\\n').map(l => l.trim()).filter(l => l.length > 10);
    tokenCount.textContent = lines.length;
    validCount.textContent = lines.filter(l => l.startsWith('mfa.') || l.length > 20).length;
}
tokenInput.addEventListener('input', updateTokenStats);

function getTokensFromInput() {
    const text = tokenInput.value;
    return text.split('\\n').map(l => l.trim()).filter(l => l.length > 10);
}

document.getElementById('saveTokensBtn').onclick = () => {
    const tokens = getTokensFromInput();
    if (!tokens.length) { addLog('❌ No tokens to save!', 'err'); return; }
    localStorage.setItem('rintu_tokens', JSON.stringify(tokens));
    addLog(`💾 Saved ${tokens.length} tokens`, 'resp');
};

document.getElementById('loadTokensBtn').onclick = () => {
    const saved = localStorage.getItem('rintu_tokens');
    if (!saved) { addLog('❌ No saved tokens found', 'err'); return; }
    try {
        const tokens = JSON.parse(saved);
        tokenInput.value = tokens.join('\\n');
        updateTokenStats();
        addLog(`📂 Loaded ${tokens.length} tokens`, 'resp');
    } catch(e) { addLog('❌ Error loading tokens', 'err'); }
};

window.onload = () => {
    const saved = localStorage.getItem('rintu_tokens');
    if (saved) {
        try {
            const tokens = JSON.parse(saved);
            tokenInput.value = tokens.join('\\n');
            updateTokenStats();
        } catch(e) {}
    }
};

function addLog(msg, type='sys') {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="time">[${time}]</span> <span class="${type}">${msg}</span>`;
    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
}

function updateStatus(running, count, title, vol) {
    statusDot.className = `status-dot ${running ? 'online' : 'offline'}`;
    statusText.className = `status-text ${running ? 'online' : 'offline'}`;
    statusText.textContent = running ? 'ONLINE' : 'OFFLINE';
    botCount.textContent = count || 0;
    if (vol !== undefined) volDisplay.textContent = Math.round(vol);
    if (title && title !== 'Nothing playing') nowPlaying.textContent = title;
    else nowPlaying.textContent = '✨ Ready to play';
}

function updateEffects(data) {
    const map = [
        ['bassboost', '🎵 Bass', 'badge-bass'],
        ['blast', '🔥 Blast', 'badge-blast'],
        ['pungi', '🐍 Pungi', 'badge-pungi'],
        ['superLoudMode', '🔊 Super', 'badge-super'],
        ['forceLoudMode', '⚡ Force', 'badge-force'],
        ['loopMode', '🔄 Loop', 'badge-loop'],
        ['loudMode', '📢 Loud', 'badge-loud']
    ];
    effectsWrap.innerHTML = '';
    for (const [key, label, cls] of map) {
        if (data[key]) {
            const badge = document.createElement('span');
            badge.className = `badge ${cls}`;
            badge.textContent = label;
            effectsWrap.appendChild(badge);
        }
    }
}

socket.on('status_update', (d) => {
    updateStatus(d.isRunning, d.botCount, d.currentTitle, d.volume);
    updateEffects(d);
});

socket.on('bots_started', (d) => {
    addLog(`🚀 ${d.count} bots started`, 'resp');
    updateStatus(true, d.count);
});

socket.on('bots_stopped', () => {
    addLog('⛔ Bots stopped', 'err');
    updateStatus(false, 0);
});

socket.on('bot_status', (d) => {
    addLog(`🤖 Bot ${d.index}/${d.total}: ${d.tag}`, 'resp');
});

socket.on('audio_update', (d) => {
    if (d.title) nowPlaying.textContent = d.title;
    if (d.volume) volDisplay.textContent = Math.round(d.volume);
});

socket.on('command_response', (d) => {
    const isErr = d.response.includes('❌') || d.response.includes('Error');
    addLog(`✦ ${d.command} → ${d.response}`, isErr ? 'err' : 'resp');
});

document.getElementById('startBtn').onclick = () => {
    const tokens = getTokensFromInput();
    if (!tokens.length) { addLog('❌ Add tokens first!', 'err'); return; }
    localStorage.setItem('rintu_tokens', JSON.stringify(tokens));
    socket.emit('start_bots_with_tokens', { tokens });
    addLog(`🚀 Starting ${tokens.length} bots...`, 'sys');
};

document.getElementById('stopBtn').onclick = () => {
    socket.emit('stop_bots');
    addLog('⛔ Stopping...', 'sys');
};

async function sendCmd(cmd) {
    if (!cmd) return;
    try {
        const res = await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
        });
        const data = await res.json();
        if (data.response) {
            const isErr = data.response.includes('❌') || data.response.includes('Error');
            addLog(`✦ ${cmd} → ${data.response}`, isErr ? 'err' : 'resp');
        }
    } catch(e) { addLog(`❌ ${e.message}`, 'err'); }
}

document.getElementById('sendBtn').onclick = () => {
    const inp = document.getElementById('cmdInput');
    sendCmd(inp.value.trim());
    inp.value = '';
};

document.getElementById('cmdInput').onkeypress = (e) => {
    if (e.key === 'Enter') document.getElementById('sendBtn').click();
};

document.querySelectorAll('.cmd-btn').forEach(btn => {
    btn.onclick = async () => {
        const cmd = btn.dataset.cmd;
        if (cmd === 'play') {
            const url = prompt('🎵 Enter URL:');
            if (url) await sendCmd(`play ${url}`);
            return;
        }
        await sendCmd(cmd);
    };
});

fetch('/api/status').then(r => r.json()).then(d => {
    updateStatus(d.isRunning, d.botCount, d.currentTitle, d.volume);
    updateEffects(d);
}).catch(console.error);

setInterval(() => {
    fetch('/api/status').then(r => r.json()).then(d => {
        updateEffects(d);
        if (d.currentTitle && d.currentTitle !== 'Nothing playing') {
            nowPlaying.textContent = d.currentTitle;
        }
        if (d.volume !== undefined) volDisplay.textContent = Math.round(d.volume);
    }).catch(console.error);
}, 3000);
</script>
</body>
</html>`;

// ─── SERVE HTML ───
app.get('/', (req, res) => {
    res.send(HTML);
});

// ─── TOKENS FROM DASHBOARD ───
let dashboardTokens = [];
let isBotRunning = false;

console.log(`🎯 RINTU DASHBOARD - Ready!`);

// Bot state
const clients = [];
const connections = new Map();
const players = new Map();
const activeResources = new Map();
let currentFFmpegProcess = null;
let currentUrl = null;
let currentTitle = "Nothing playing";
let currentChannelId = null;
let loopMode = false;
let isPaused = false;
let isBassboosted = false;
let currentVolumeMultiplier = 1.0;
let blastMode = false;
let blastVolume = 50.0;
let pungiMode = false;
let pungiIntensity = 50.0;
let loudMode = false;
let loudModeBoost = 20.0;
let loudModeMaxVolume = 500.0;
let loudModeInterval = null;
let superLoudMode = false;
let forceLoudMode = false;

function stopFFmpeg() {
    if (currentFFmpegProcess) {
        try { currentFFmpegProcess.kill("SIGKILL"); } catch (e) {}
        currentFFmpegProcess = null;
    }
}

function stopLoudMode() {
    if (loudModeInterval) {
        clearInterval(loudModeInterval);
        loudModeInterval = null;
    }
    loudMode = false;
}

function startLoudMode() {
    if (loudModeInterval) clearInterval(loudModeInterval);
    loudModeInterval = setInterval(() => {
        if (!loudMode || connections.size === 0) return;
        const primaryClient = clients[0];
        if (!primaryClient || !currentChannelId) return;
        const channel = primaryClient.channels.cache.get(currentChannelId);
        if (!channel) return;
        const clusterIds = clients.map(c => c.user?.id).filter(Boolean);
        const speakingMembers = channel.members.filter(m => {
            return !clusterIds.includes(m.id) && !m.voice.selfMute && m.voice.speaking;
        });
        const targetVolume = speakingMembers.size > 0 
            ? Math.min(currentVolumeMultiplier * loudModeBoost, loudModeMaxVolume)
            : currentVolumeMultiplier;
        activeResources.forEach((resource) => {
            if (resource && resource.volume && resource.volume.volume !== targetVolume) {
                resource.volume.setVolume(targetVolume);
            }
        });
    }, 400);
}

function isYouTubeUrl(url) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url);
}

function startFFmpegStream(inputSource) {
    stopFFmpeg();
    let audioFilters = [];
    audioFilters.push("highpass=f=60");

    if (superLoudMode) {
        audioFilters.push("compand=attacks=0.01:decays=0.01:points=-80/-80|-30/-15|-12/-6|-6/-3|0/-2|20/-1");
        audioFilters.push("volume=15dB");
        audioFilters.push("acompressor=threshold=0.05:ratio=20:attack=5:release=50");
        audioFilters.push("alimiter=level_in=15:level_out=0:limit=0.99:attack=1:release=50");
        audioFilters.push("dynaudnorm=p=0.95:m=100:g=20");
        audioFilters.push("volume=amplitude=8");
    }
    if (forceLoudMode) {
        audioFilters.push("compand=attacks=0.001:decays=0.001:points=-80/-80|-40/-25|-20/-10|0/-5|10/-2|20/0|30/5");
        audioFilters.push("acompressor=threshold=0.01:ratio=50:attack=1:release=100");
        audioFilters.push("alimiter=level_in=25:level_out=0.99:limit=1:attack=1:release=100");
        audioFilters.push("dynaudnorm=p=1:m=100:g=30");
        audioFilters.push("volume=20dB");
        audioFilters.push("aecho=0.8:0.9:1000:0.3");
    }
    if (isBassboosted) {
        audioFilters.push("equalizer=f=60:width_type=h:width=50:g=15");
    }
    if (pungiMode) {
        audioFilters.push("acrusher=bits=4:mode=log:aa=1");
        audioFilters.push("equalizer=f=30:width_type=h:width=80:g=20");
        audioFilters.push("equalizer=f=1000:width_type=h:width=500:g=10");
        audioFilters.push(`volume=${pungiIntensity}`);
        audioFilters.push("aphaser=0.8:0.8:2000:0.4");
        audioFilters.push("aecho=0.8:0.9:1000:0.3");
    } else if (blastMode) {
        audioFilters.push(`volume=${blastVolume}`);
        audioFilters.push("dynaudnorm=p=0.9:m=50.0:g=15");
        audioFilters.push("alimiter=level_in=2.0:level_out=0.98:limit=0.99:attack=5:release=50");
    } else {
        if (currentVolumeMultiplier > 1.0) {
            audioFilters.push(`volume=${currentVolumeMultiplier}`);
        }
    }

    currentFFmpegProcess = spawn("ffmpeg", [
        "-reconnect", "1",
        "-reconnect_streamed", "1",
        "-reconnect_delay_max", "5",
        "-i", inputSource,
        "-filter:a", audioFilters.join(","),
        "-f", "s16le",
        "-ar", "48000",
        "-ac", "2",
        "pipe:1"
    ]);

    clients.forEach((client, index) => {
        const player = players.get(index);
        if (player && currentFFmpegProcess) {
            const resource = createAudioResource(currentFFmpegProcess.stdout, {
                inputType: StreamType.Raw,
                inlineVolume: true
            });
            let effectiveVol = currentVolumeMultiplier;
            if (pungiMode) effectiveVol = Math.min(pungiIntensity, 200.0);
            else if (blastMode) effectiveVol = Math.min(blastVolume, 500.0);
            else if (superLoudMode) effectiveVol = Math.min(currentVolumeMultiplier * 20, 2000.0);
            else if (forceLoudMode) effectiveVol = Math.min(currentVolumeMultiplier * 30, 3000.0);
            else effectiveVol = Math.min(currentVolumeMultiplier * 2, 200.0);
            resource.volume.setVolume(effectiveVol);
            activeResources.set(index, resource);
            player.play(resource);
            io.emit('audio_update', { 
                status: 'playing', 
                title: currentTitle, 
                volume: Math.round(effectiveVol * 100) 
            });
        }
    });
    isPaused = false;
    if (loudMode) startLoudMode();
}

function startBots() {
    if (isBotRunning) return;
    
    if (dashboardTokens.length === 0) {
        console.log("❌ No tokens available! Add tokens in dashboard.");
        return;
    }
    
    isBotRunning = true;
    dashboardTokens.forEach((token, index) => {
        const client = new Client({ checkUpdate: false });
        client.on("ready", () => {
            console.log(`🤖 Bot ${index + 1}/${dashboardTokens.length}: ${client.user.tag}`);
            io.emit('bot_status', { index: index + 1, total: dashboardTokens.length, tag: client.user.tag, status: 'online' });
        });
        client.login(token).catch((err) => {
            console.log(`❌ Bot ${index + 1} login failed: ${err.message}`);
        });
        clients.push(client);
    });
    io.emit('bots_started', { count: dashboardTokens.length });
}

function stopBots() {
    isBotRunning = false;
    stopFFmpeg();
    stopLoudMode();
    players.forEach(p => p.stop());
    players.clear();
    connections.forEach(c => { try { c.destroy(); } catch(e){} });
    connections.clear();
    activeResources.clear();
    clients.forEach(c => { try { c.destroy(); } catch(e){} });
    clients.length = 0;
    currentUrl = null;
    currentChannelId = null;
    io.emit('bots_stopped');
    console.log("⛔ All bots stopped");
}

// API Routes
app.get('/api/status', (req, res) => {
    res.json({
        isRunning: isBotRunning,
        botCount: clients.length,
        totalTokens: dashboardTokens.length,
        currentTitle: currentTitle,
        volume: Math.round(currentVolumeMultiplier * 100),
        isPaused, loopMode, isBassboosted, blastMode, pungiMode, loudMode, superLoudMode, forceLoudMode,
        connected: connections.size > 0
    });
});

app.post('/api/command', async (req, res) => {
    const { command } = req.body;
    if (!command) return res.json({ error: 'No command' });
    
    const lowerCmd = command.toLowerCase().trim();
    let response = '';

    try {
        if (lowerCmd === 'help') {
            response = `Commands: play <url>, volume <1-20000>, max, blast, doubleblast, superloud, forceloud, bassboost, pungi, pungiset, loudmode, loop, pause, resume, stop, leave, status\n📊 ${dashboardTokens.length} tokens loaded`;
        }
        else if (lowerCmd.startsWith('play ')) {
            const url = command.slice(5).trim();
            if (connections.size === 0) {
                response = '❌ Join a voice channel first!';
            } else if (isYouTubeUrl(url)) {
                try {
                    const result = await youtubedl(url, {
                        dumpSingleJson: true,
                        noPlaylist: true,
                        format: "bestaudio[ext=webm]/bestaudio/best",
                        noWarnings: true
                    });
                    currentUrl = result.url;
                    currentTitle = result.title || "YouTube Audio";
                    startFFmpegStream(currentUrl);
                    response = `▶️ Now Playing: ${currentTitle}`;
                } catch (err) {
                    response = `❌ Error: ${err.message}`;
                }
            } else {
                currentUrl = url;
                currentTitle = "Direct Audio";
                startFFmpegStream(url);
                response = `▶️ Playing: ${url}`;
            }
        }
        else if (lowerCmd === 'stop') {
            stopFFmpeg();
            stopLoudMode();
            players.forEach(p => p.stop());
            activeResources.clear();
            response = '⏹️ Playback stopped';
        }
        else if (lowerCmd === 'pause') {
            players.forEach(p => p.pause());
            isPaused = true;
            response = '⏸️ Paused';
        }
        else if (lowerCmd === 'resume') {
            players.forEach(p => p.unpause());
            isPaused = false;
            response = '▶️ Resumed';
        }
        else if (lowerCmd === 'leave') {
            stopFFmpeg();
            stopLoudMode();
            players.forEach(p => p.stop());
            players.clear();
            connections.forEach(c => { try { c.destroy(); } catch(e){} });
            connections.clear();
            activeResources.clear();
            currentUrl = null;
            currentChannelId = null;
            response = '👋 Disconnected all bots';
        }
        else if (lowerCmd.startsWith('volume ')) {
            const vol = parseInt(command.slice(7).trim(), 10);
            if (isNaN(vol) || vol < 1 || vol > 20000) {
                response = '❌ Volume must be 1-20000';
            } else {
                currentVolumeMultiplier = vol / 100;
                activeResources.forEach((res) => {
                    if (res?.volume) res.volume.setVolume(currentVolumeMultiplier);
                });
                response = `🔊 Volume set to ${vol}%`;
            }
        }
        else if (lowerCmd === 'max') {
            currentVolumeMultiplier = 100.0;
            activeResources.forEach((res) => {
                if (res?.volume) res.volume.setVolume(currentVolumeMultiplier);
            });
            if (currentUrl) startFFmpegStream(currentUrl);
            response = '💥 MAXIMUM VOLUME (10000%)';
        }
        else if (lowerCmd === 'blast') {
            blastMode = !blastMode;
            pungiMode = false; superLoudMode = false; forceLoudMode = false;
            if (currentUrl) startFFmpegStream(currentUrl);
            response = `🔥 Blast Mode ${blastMode ? 'ACTIVATED' : 'DEACTIVATED'}`;
        }
        else if (lowerCmd === 'doubleblast') {
            blastMode = true; pungiMode = false; superLoudMode = false; forceLoudMode = false;
            blastVolume = 100.0; currentVolumeMultiplier = 100.0;
            activeResources.forEach((res) => {
                if (res?.volume) res.volume.setVolume(100.0);
            });
            if (currentUrl) startFFmpegStream(currentUrl);
            response = '💥💥 DOUBLE BLAST ACTIVATED!';
        }
        else if (lowerCmd === 'superloud') {
            superLoudMode = !superLoudMode;
            if (superLoudMode) { blastMode = false; pungiMode = false; forceLoudMode = false; }
            if (currentUrl) startFFmpegStream(currentUrl);
            response = `🔊 Super Loud ${superLoudMode ? 'ACTIVATED' : 'DEACTIVATED'}`;
        }
        else if (lowerCmd === 'forceloud') {
            forceLoudMode = !forceLoudMode;
            if (forceLoudMode) { blastMode = false; pungiMode = false; superLoudMode = false; }
            if (currentUrl) startFFmpegStream(currentUrl);
            response = `🔥 Force Loud ${forceLoudMode ? 'ACTIVATED' : 'DEACTIVATED'}`;
        }
        else if (lowerCmd === 'bassboost') {
            isBassboosted = !isBassboosted;
            if (currentUrl) startFFmpegStream(currentUrl);
            response = `🎵 Bassboost ${isBassboosted ? 'ENABLED' : 'DISABLED'}`;
        }
        else if (lowerCmd === 'pungi') {
            pungiMode = !pungiMode;
            blastMode = false; superLoudMode = false; forceLoudMode = false;
            if (currentUrl) startFFmpegStream(currentUrl);
            response = `🐍 Pungi Mode ${pungiMode ? 'ACTIVATED' : 'DEACTIVATED'}`;
        }
        else if (lowerCmd.startsWith('pungiset ')) {
            const val = parseFloat(command.slice(9).trim());
            if (isNaN(val) || val < 1 || val > 200) {
                response = '❌ Intensity must be 1-200';
            } else {
                pungiIntensity = val;
                if (pungiMode && currentUrl) startFFmpegStream(currentUrl);
                response = `🐍 Pungi intensity set to ${val}x`;
            }
        }
        else if (lowerCmd === 'loudmode') {
            loudMode = !loudMode;
            if (loudMode) startLoudMode();
            else stopLoudMode();
            response = `🔊 Loud Mode ${loudMode ? 'ENABLED' : 'DISABLED'}`;
        }
        else if (lowerCmd === 'loop') {
            loopMode = !loopMode;
            response = `🔄 Loop ${loopMode ? 'ENABLED' : 'DISABLED'}`;
        }
        else if (lowerCmd === 'status') {
            response = `🎵 ${currentTitle}\n📊 ${clients.length}/${dashboardTokens.length} bots online\n🔊 ${Math.round(currentVolumeMultiplier * 100)}%\n🔄 Loop: ${loopMode ? 'ON' : 'OFF'}`;
        }
        else if (!isNaN(lowerCmd) && lowerCmd.length >= 10) {
            currentChannelId = lowerCmd;
            for (const [index, client] of clients.entries()) {
                try {
                    const channel = await client.channels.fetch(lowerCmd);
                    if (channel) {
                        const conn = joinVoiceChannel({
                            channelId: channel.id,
                            guildId: channel.guild.id,
                            adapterCreator: channel.guild.voiceAdapterCreator,
                            selfMute: false,
                            selfDeaf: false,
                            group: client.user.id
                        });
                        const player = createAudioPlayer();
                        conn.subscribe(player);
                        player.on(AudioPlayerStatus.Idle, () => {
                            if (loopMode && currentUrl && !isPaused && index === 0) {
                                setTimeout(() => startFFmpegStream(currentUrl), 500);
                            }
                        });
                        connections.set(index, conn);
                        players.set(index, player);
                    }
                } catch (err) {
                    console.log(`❌ Bot ${index + 1} join error: ${err.message}`);
                }
            }
            response = `✅ Connected ${clients.length} bots to channel ${lowerCmd}`;
        }
        else {
            response = '❌ Unknown command. Type "help" for list.';
        }
    } catch (err) {
        response = `❌ Error: ${err.message}`;
    }

    io.emit('command_response', { command, response });
    res.json({ response });
});

// ─── SOCKET.IO ───
io.on('connection', (socket) => {
    console.log('📱 Dashboard connected');
    socket.emit('status_update', {
        isRunning: isBotRunning,
        botCount: clients.length,
        totalTokens: dashboardTokens.length,
        currentTitle: currentTitle,
        volume: Math.round(currentVolumeMultiplier * 100)
    });
    
    socket.on('start_bots_with_tokens', (data) => {
        const { tokens: newTokens } = data;
        if (newTokens && newTokens.length > 0) {
            dashboardTokens = [];
            for (const t of newTokens) {
                if (t && t.length > 10) {
                    dashboardTokens.push(t);
                }
            }
            console.log(`🔄 Updated tokens from dashboard: ${dashboardTokens.length} tokens`);
            startBots();
        } else {
            console.log('❌ No valid tokens received from dashboard');
        }
    });
    
    socket.on('start_bots', () => startBots());
    socket.on('stop_bots', () => stopBots());
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🌐 RINTU DASHBOARD: http://localhost:${PORT}`);
    console.log(`📱 Open your Railway URL!\n`);
});

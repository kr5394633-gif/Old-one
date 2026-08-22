const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require("fs");
const path = require("path");

// Fix for voice connections
process.env.DISCORD_VOICE_NO_BROWSER = 'true';

// Patch for selfbot
try {
    const ClientUserSettingManager = require("./node_modules/discord.js-selfbot-v13/src/managers/ClientUserSettingManager.js");
    if (ClientUserSettingManager && ClientUserSettingManager.prototype) {
        ClientUserSettingManager.prototype._patch = function(data) { return this; };
    }
} catch (e) {}

const { Client } = require("discord.js-selfbot-v13");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType, VoiceConnectionStatus } = require("@discordjs/voice");
const { spawn } = require("child_process");
const youtubedl = require("youtube-dl-exec");
const ffmpeg = require('ffmpeg-static');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());

// ─── HTML DIRECTLY IN CODE ───
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
                    <button class="btn btn-save" id="saveTokensBtn">💾 Save Tokens</button>
                    <button class="btn btn-glow" id="loadTokensBtn">📂 Load Tokens</button>
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
                <button class="btn btn-glow" id="blastBtn">💥 BLAST</button>
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
            <input id="cmdInput" placeholder="play https://youtube.com/... or channel_id">
            <button class="btn btn-glow" id="sendBtn">Send ✦</button>
        </div>
    </div>

    <div class="card">
        <div class="card-title">📋 Activity Log</div>
        <div class="log-area" id="logArea">
            <div class="log-entry"><span class="time">[✦]</span> <span class="sys">🌸 RINTU DASHBOARD ready. Add tokens and press START.</span></div>
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
var effectsWrap = document.getElementById('effectsWrap');
var tokenInput = document.getElementById('tokenInput');
var tokenCount = document.getElementById('tokenCount');
var validCount = document.getElementById('validCount');

function updateTokenStats() {
    var text = tokenInput.value;
    var lines = text.split('\\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 10; });
    tokenCount.textContent = lines.length;
    var valid = lines.filter(function(l) { return l.startsWith('mfa.') || l.length > 20; });
    validCount.textContent = valid.length;
}

tokenInput.addEventListener('input', updateTokenStats);

function getTokensFromInput() {
    var text = tokenInput.value;
    var lines = text.split('\\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 10; });
    return lines;
}

document.getElementById('saveTokensBtn').addEventListener('click', function() {
    var tokens = getTokensFromInput();
    if (tokens.length === 0) { addLog('❌ No tokens to save!', 'err'); return; }
    try {
        localStorage.setItem('rintu_tokens', JSON.stringify(tokens));
        addLog('💾 Saved ' + tokens.length + ' tokens', 'resp');
    } catch(e) { addLog('❌ Error saving: ' + e.message, 'err'); }
});

document.getElementById('loadTokensBtn').addEventListener('click', function() {
    try {
        var saved = localStorage.getItem('rintu_tokens');
        if (!saved) { addLog('❌ No saved tokens found', 'err'); return; }
        var tokens = JSON.parse(saved);
        if (tokens && tokens.length > 0) {
            tokenInput.value = tokens.join('\\n');
            updateTokenStats();
            addLog('📂 Loaded ' + tokens.length + ' tokens', 'resp');
        }
    } catch(e) { addLog('❌ Error loading: ' + e.message, 'err'); }
});

window.addEventListener('load', function() {
    try {
        var saved = localStorage.getItem('rintu_tokens');
        if (saved) {
            var tokens = JSON.parse(saved);
            if (tokens && tokens.length > 0) {
                tokenInput.value = tokens.join('\\n');
                updateTokenStats();
                addLog('📂 Auto-loaded ' + tokens.length + ' tokens', 'sys');
            }
        }
    } catch(e) {}
});

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

function updateStatus(running, count, title, vol) {
    statusDot.className = 'status-dot ' + (running ? 'online' : 'offline');
    statusText.className = 'status-text ' + (running ? 'online' : 'offline');
    statusText.textContent = running ? '🟢 ONLINE' : '🔴 OFFLINE';
    botCount.textContent = count || 0;
    if (vol !== undefined) volDisplay.textContent = Math.round(vol);
    if (title && title !== 'Nothing playing') {
        nowPlaying.textContent = title;
    } else {
        nowPlaying.textContent = '✨ Ready to play';
    }
}

function updateEffects(data) {
    var map = [
        ['bassboost', '🎵 Bass', 'badge-bass'],
        ['blast', '🔥 Blast', 'badge-blast'],
        ['pungi', '🐍 Pungi', 'badge-pungi'],
        ['superLoudMode', '🔊 Super', 'badge-super'],
        ['forceLoudMode', '⚡ Force', 'badge-force'],
        ['loopMode', '🔄 Loop', 'badge-loop'],
        ['loudMode', '📢 Loud', 'badge-loud']
    ];
    effectsWrap.innerHTML = '';
    for (var i = 0; i < map.length; i++) {
        var key = map[i][0];
        var label = map[i][1];
        var cls = map[i][2];
        if (data[key]) {
            var badge = document.createElement('span');
            badge.className = 'badge ' + cls;
            badge.textContent = label;
            effectsWrap.appendChild(badge);
        }
    }
}

socket.on('status_update', function(data) {
    updateStatus(data.isRunning, data.botCount, data.currentTitle, data.volume);
    updateEffects(data);
});

socket.on('bots_started', function(data) {
    addLog('🚀 ' + data.count + ' bots started successfully', 'resp');
    updateStatus(true, data.count);
});

socket.on('bots_stopped', function() {
    addLog('⛔ All bots stopped', 'err');
    updateStatus(false, 0);
});

socket.on('bot_status', function(data) {
    addLog('🤖 Bot ' + data.index + '/' + data.total + ': ' + data.tag + ' ✅', 'resp');
});

socket.on('audio_update', function(data) {
    if (data.title) nowPlaying.textContent = data.title;
    if (data.volume) volDisplay.textContent = Math.round(data.volume);
    if (data.status === 'playing') addLog('🎵 Now Playing: ' + data.title, 'resp');
});

socket.on('command_response', function(data) {
    var isErr = data.response.includes('❌') || data.response.includes('Error');
    addLog('✦ ' + data.command + ' → ' + data.response, isErr ? 'err' : 'resp');
});

document.getElementById('startBtn').addEventListener('click', function() {
    var tokens = getTokensFromInput();
    if (tokens.length === 0) { addLog('❌ Add tokens first!', 'err'); return; }
    try { localStorage.setItem('rintu_tokens', JSON.stringify(tokens)); } catch(e) {}
    socket.emit('start_bots_with_tokens', { tokens: tokens });
    addLog('🚀 Starting ' + tokens.length + ' bots...', 'sys');
});

document.getElementById('stopBtn').addEventListener('click', function() {
    socket.emit('stop_bots');
    addLog('⛔ Stopping bots...', 'sys');
});

document.getElementById('blastBtn').addEventListener('click', function() {
    sendCmd('doubleblast');
    sendCmd('volume 20000');
    addLog('💥💥 BLAST MODE ACTIVATED! MAXIMUM VOLUME!', 'resp');
});

function sendCmd(cmd) {
    if (!cmd) return;
    fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.response) {
            var isErr = data.response.includes('❌') || data.response.includes('Error');
            addLog('✦ ' + cmd + ' → ' + data.response, isErr ? 'err' : 'resp');
        }
    })
    .catch(function(e) { addLog('❌ Error: ' + e.message, 'err'); });
}

document.getElementById('sendBtn').addEventListener('click', function() {
    var inp = document.getElementById('cmdInput');
    var cmd = inp.value.trim();
    if (cmd) {
        sendCmd(cmd);
        inp.value = '';
    }
});

document.getElementById('cmdInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') { document.getElementById('sendBtn').click(); }
});

var cmdBtns = document.querySelectorAll('.cmd-btn');
for (var i = 0; i < cmdBtns.length; i++) {
    cmdBtns[i].addEventListener('click', function() {
        var cmd = this.dataset.cmd;
        if (cmd === 'play') {
            var url = prompt('🎵 Enter YouTube URL:');
            if (url) sendCmd('play ' + url);
            return;
        }
        sendCmd(cmd);
    });
}

fetch('/api/status').then(function(r) { return r.json(); }).then(function(data) {
    updateStatus(data.isRunning, data.botCount, data.currentTitle, data.volume);
    updateEffects(data);
}).catch(console.error);

setInterval(function() {
    fetch('/api/status').then(function(r) { return r.json(); }).then(function(data) {
        updateEffects(data);
        if (data.currentTitle && data.currentTitle !== 'Nothing playing') {
            nowPlaying.textContent = data.currentTitle;
        }
        if (data.volume !== undefined) volDisplay.textContent = Math.round(data.volume);
    }).catch(console.error);
}, 3000);
</script>
</body>
</html>`;

// ─── SERVE HTML ───
app.get('/', function(req, res) {
    res.send(HTML);
});

// ─── TOKENS FROM DASHBOARD ───
var dashboardTokens = [];
var isBotRunning = false;

console.log('🌸 RINTU DASHBOARD - Ready!');

// Bot state
var clients = [];
var connections = new Map();
var players = new Map();
var activeResources = new Map();
var currentFFmpegProcess = null;
var currentUrl = null;
var currentTitle = 'Nothing playing';
var currentChannelId = null;
var loopMode = false;
var isPaused = false;
var isBassboosted = false;
var currentVolumeMultiplier = 1.0;
var blastMode = false;
var blastVolume = 50.0;
var pungiMode = false;
var pungiIntensity = 50.0;
var loudMode = false;
var loudModeBoost = 20.0;
var loudModeMaxVolume = 500.0;
var loudModeInterval = null;
var superLoudMode = false;
var forceLoudMode = false;
var botReadyStatus = {};

function stopFFmpeg() {
    if (currentFFmpegProcess) {
        try { currentFFmpegProcess.kill('SIGKILL'); } catch (e) {}
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
    loudModeInterval = setInterval(function() {
        if (!loudMode || connections.size === 0) return;
        var primaryClient = clients[0];
        if (!primaryClient || !currentChannelId) return;
        var channel = primaryClient.channels.cache.get(currentChannelId);
        if (!channel) return;
        var clusterIds = [];
        for (var i = 0; i < clients.length; i++) {
            if (clients[i].user && clients[i].user.id) clusterIds.push(clients[i].user.id);
        }
        var speakingMembers = channel.members.filter(function(m) {
            return clusterIds.indexOf(m.id) === -1 && !m.voice.selfMute && m.voice.speaking;
        });
        var targetVolume = speakingMembers.size > 0 
            ? Math.min(currentVolumeMultiplier * loudModeBoost, loudModeMaxVolume)
            : currentVolumeMultiplier;
        activeResources.forEach(function(resource) {
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
    var audioFilters = [];
    audioFilters.push('highpass=f=60');

    if (superLoudMode) {
        audioFilters.push('compand=attacks=0.01:decays=0.01:points=-80/-80|-30/-15|-12/-6|-6/-3|0/-2|20/-1');
        audioFilters.push('volume=15dB');
        audioFilters.push('acompressor=threshold=0.05:ratio=20:attack=5:release=50');
        audioFilters.push('alimiter=level_in=15:level_out=0:limit=0.99:attack=1:release=50');
        audioFilters.push('dynaudnorm=p=0.95:m=100:g=20');
        audioFilters.push('volume=amplitude=8');
    }
    if (forceLoudMode) {
        audioFilters.push('compand=attacks=0.001:decays=0.001:points=-80/-80|-40/-25|-20/-10|0/-5|10/-2|20/0|30/5');
        audioFilters.push('acompressor=threshold=0.01:ratio=50:attack=1:release=100');
        audioFilters.push('alimiter=level_in=25:level_out=0.99:limit=1:attack=1:release=100');
        audioFilters.push('dynaudnorm=p=1:m=100:g=30');
        audioFilters.push('volume=20dB');
        audioFilters.push('aecho=0.8:0.9:1000:0.3');
    }
    if (isBassboosted) {
        audioFilters.push('equalizer=f=60:width_type=h:width=50:g=15');
    }
    if (pungiMode) {
        audioFilters.push('acrusher=bits=4:mode=log:aa=1');
        audioFilters.push('equalizer=f=30:width_type=h:width=80:g=20');
        audioFilters.push('equalizer=f=1000:width_type=h:width=500:g=10');
        audioFilters.push('volume=' + pungiIntensity);
        audioFilters.push('aphaser=0.8:0.8:2000:0.4');
        audioFilters.push('aecho=0.8:0.9:1000:0.3');
    } else if (blastMode) {
        audioFilters.push('volume=' + blastVolume);
        audioFilters.push('dynaudnorm=p=0.9:m=50.0:g=15');
        audioFilters.push('alimiter=level_in=2.0:level_out=0.98:limit=0.99:attack=5:release=50');
    } else {
        if (currentVolumeMultiplier > 1.0) {
            audioFilters.push('volume=' + currentVolumeMultiplier);
        }
    }

    var ffmpegPath = ffmpeg || 'ffmpeg';
    
    currentFFmpegProcess = spawn(ffmpegPath, [
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-i', inputSource,
        '-filter:a', audioFilters.join(','),
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
    ]);

    currentFFmpegProcess.stdout.on('error', function(err) {
        console.log('FFmpeg stdout error:', err.message);
    });

    currentFFmpegProcess.stderr.on('data', function(data) {});

    clients.forEach(function(client, index) {
        var player = players.get(index);
        if (player && currentFFmpegProcess) {
            try {
                var resource = createAudioResource(currentFFmpegProcess.stdout, {
                    inputType: StreamType.Raw,
                    inlineVolume: true
                });
                var effectiveVol = currentVolumeMultiplier;
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
            } catch(err) {
                console.log('Error playing audio on bot ' + (index + 1) + ':', err.message);
            }
        }
    });
    isPaused = false;
    if (loudMode) startLoudMode();
}

function startBots() {
    if (isBotRunning) return;
    
    if (dashboardTokens.length === 0) {
        console.log('❌ No tokens available!');
        return;
    }
    
    isBotRunning = true;
    dashboardTokens.forEach(function(token, index) {
        var client = new Client({ 
            checkUpdate: false,
            ws: {
                properties: {
                    $browser: 'Discord iOS'
                }
            }
        });
        
        client.on('ready', function() {
            var tag = client.user ? client.user.tag : 'Unknown';
            console.log('🤖 Bot ' + (index + 1) + '/' + dashboardTokens.length + ': ' + tag);
            io.emit('bot_status', { index: index + 1, total: dashboardTokens.length, tag: tag, status: 'online' });
            botReadyStatus[index] = true;
        });
        
        client.login(token).catch(function(err) {
            console.log('❌ Bot ' + (index + 1) + ' login failed: ' + err.message);
        });
        clients.push(client);
    });
    io.emit('bots_started', { count: dashboardTokens.length });
}

function stopBots() {
    isBotRunning = false;
    stopFFmpeg();
    stopLoudMode();
    players.forEach(function(p) { 
        try { p.stop(); } catch(e) {}
    });
    players.clear();
    connections.forEach(function(c) { 
        try { c.destroy(); } catch(e){} 
    });
    connections.clear();
    activeResources.clear();
    clients.forEach(function(c) { 
        try { c.destroy(); } catch(e){} 
    });
    clients = [];
    botReadyStatus = {};
    currentUrl = null;
    currentChannelId = null;
    io.emit('bots_stopped');
    console.log('⛔ All bots stopped');
}

// ─── API ROUTES ───

app.get('/api/status', function(req, res) {
    res.json({
        isRunning: isBotRunning,
        botCount: clients.length,
        totalTokens: dashboardTokens.length,
        currentTitle: currentTitle,
        volume: Math.round(currentVolumeMultiplier * 100),
        isPaused: isPaused,
        loopMode: loopMode,
        isBassboosted: isBassboosted,
        blastMode: blastMode,
        pungiMode: pungiMode,
        loudMode: loudMode,
        superLoudMode: superLoudMode,
        forceLoudMode: forceLoudMode,
        connected: connections.size > 0
    });
});

app.post('/api/command', async function(req, res) {
    var command = req.body.command;
    if (!command) return res.json({ error: 'No command' });
    
    var lowerCmd = command.toLowerCase().trim();
    var response = '';

    try {
        // ─── HELP ───
        if (lowerCmd === 'help') {
            response = '📋 Commands: play <url>, volume <1-20000>, max, blast, doubleblast, superloud, forceloud, bassboost, pungi, pungiset, loudmode, loop, pause, resume, stop, leave, status\n📊 ' + dashboardTokens.length + ' tokens loaded';
        }
        
        // ─── PLAY ───
        else if (lowerCmd.startsWith('play ')) {
            var url = command.slice(5).trim();
            if (connections.size === 0) {
                response = '❌ Join a voice channel first! Enter a channel ID';
            } else if (isYouTubeUrl(url)) {
                try {
                    var result = await youtubedl(url, {
                        dumpSingleJson: true,
                        noPlaylist: true,
                        format: 'bestaudio[ext=webm]/bestaudio/best',
                        noWarnings: true
                    });
                    currentUrl = result.url;
                    currentTitle = result.title || 'YouTube Audio';
                    startFFmpegStream(currentUrl);
                    response = '🎵 Now Playing: ' + currentTitle;
                } catch (err) {
                    response = '❌ Error: ' + err.message;
                }
            } else {
                currentUrl = url;
                currentTitle = 'Direct Audio';
                startFFmpegStream(url);
                response = '🎵 Playing: ' + url;
            }
        }
        
        // ─── STOP ───
        else if (lowerCmd === 'stop') {
            stopFFmpeg();
            stopLoudMode();
            players.forEach(function(p) { try { p.stop(); } catch(e){} });
            activeResources.clear();
            response = '⏹️ Playback stopped';
        }
        
        // ─── PAUSE ───
        else if (lowerCmd === 'pause') {
            players.forEach(function(p) { try { p.pause(); } catch(e){} });
            isPaused = true;
            response = '⏸️ Paused';
        }
        
        // ─── RESUME ───
        else if (lowerCmd === 'resume') {
            players.forEach(function(p) { try { p.unpause(); } catch(e){} });
            isPaused = false;
            response = '▶️ Resumed';
        }
        
        // ─── LEAVE ───
        else if (lowerCmd === 'leave') {
            stopFFmpeg();
            stopLoudMode();
            players.forEach(function(p) { try { p.stop(); } catch(e){} });
            players.clear();
            connections.forEach(function(c) { try { c.destroy(); } catch(e){} });
            connections.clear();
            activeResources.clear();
            currentUrl = null;
            currentChannelId = null;
            response = '👋 Disconnected all bots from voice';
        }
        
        // ─── VOLUME ───
        else if (lowerCmd.startsWith('volume ')) {
            var vol = parseInt(command.slice(7).trim(), 10);
            if (isNaN(vol) || vol < 1 || vol > 20000) {
                response = '❌ Volume must be 1-20000';
            } else {
                currentVolumeMultiplier = vol / 100;
                activeResources.forEach(function(res) {
                    if (res && res.volume) res.volume.setVolume(currentVolumeMultiplier);
                });
                response = '🔊 Volume set to ' + vol + '%';
            }
        }
        
        // ─── MAX ───
        else if (lowerCmd === 'max') {
            currentVolumeMultiplier = 100.0;
            activeResources.forEach(function(res) {
                if (res && res.volume) res.volume.setVolume(currentVolumeMultiplier);
            });
            if (currentUrl) startFFmpegStream(currentUrl);
            response = '💥 MAXIMUM VOLUME (10000%)';
        }
        
        // ─── BLAST ───
        else if (lowerCmd === 'blast') {
            blastMode = !blastMode;
            pungiMode = false; superLoudMode = false; forceLoudMode = false;
            if (currentUrl) startFFmpegStream(currentUrl);
            response = '🔥 Blast Mode ' + (blastMode ? 'ACTIVATED' : 'DEACTIVATED');
        }
        
        // ─── DOUBLE BLAST ───
        else if (lowerCmd === 'doubleblast') {
            blastMode = true; pungiMode = false; superLoudMode = false; forceLoudMode = false;
            blastVolume = 100.0; currentVolumeMultiplier = 100.0;
            activeResources.forEach(function(res) {
                if (res && res.volume) res.volume.setVolume(100.0);
            });
            if (currentUrl) startFFmpegStream(currentUrl);
            response = '💥💥 DOUBLE BLAST ACTIVATED!';
        }
        
        // ─── SUPER LOUD ───
        else if (lowerCmd === 'superloud') {
            superLoudMode = !superLoudMode;
            if (superLoudMode) { blastMode = false; pungiMode = false; forceLoudMode = false; }
            if (currentUrl) startFFmpegStream(currentUrl);
            response = '🔊 Super Loud ' + (superLoudMode ? 'ACTIVATED' : 'DEACTIVATED');
        }
        
        // ─── FORCE LOUD ───
        else if (lowerCmd === 'forceloud') {
            forceLoudMode = !forceLoudMode;
            if (forceLoudMode) { blastMode = false; pungiMode = false; superLoudMode = false; }
            if (currentUrl) startFFmpegStream(currentUrl);
            response = '⚡ Force Loud ' + (forceLoudMode ? 'ACTIVATED' : 'DEACTIVATED');
        }
        
        // ─── BASSBOOST ───
        else if (lowerCmd === 'bassboost') {
            isBassboosted = !isBassboosted;
            if (currentUrl) startFFmpegStream(currentUrl);
            response = '🎵 Bassboost ' + (isBassboosted ? 'ENABLED' : 'DISABLED');
        }
        
        // ─── PUNGI ───
        else if (lowerCmd === 'pungi') {
            pungiMode = !pungiMode;
            blastMode = false; superLoudMode = false; forceLoudMode = false;
            if (currentUrl) startFFmpegStream(currentUrl);
            response = '🐍 Pungi Mode ' + (pungiMode ? 'ACTIVATED' : 'DEACTIVATED');
        }
        
        // ─── PUNGISET ───
        else if (lowerCmd.startsWith('pungiset ')) {
            var val = parseFloat(command.slice(9).trim());
            if (isNaN(val) || val < 1 || val > 200) {
                response = '❌ Intensity must be 1-200';
            } else {
                pungiIntensity = val;
                if (pungiMode && currentUrl) startFFmpegStream(currentUrl);
                response = '🐍 Pungi intensity set to ' + val + 'x';
            }
        }
        
        // ─── LOUDMODE ───
        else if (lowerCmd === 'loudmode') {
            loudMode = !loudMode;
            if (loudMode) startLoudMode();
            else stopLoudMode();
            response = '📢 Loud Mode ' + (loudMode ? 'ENABLED' : 'DISABLED');
        }
        
        // ─── LOOP ───
        else if (lowerCmd === 'loop') {
            loopMode = !loopMode;
            response = '🔄 Loop ' + (loopMode ? 'ENABLED' : 'DISABLED');
        }
        
        // ─── STATUS ───
        else if (lowerCmd === 'status') {
            response = '🎵 ' + currentTitle + '\n📊 ' + clients.length + '/' + dashboardTokens.length + ' bots online\n🔊 ' + Math.round(currentVolumeMultiplier * 100) + '%\n🔄 Loop: ' + (loopMode ? 'ON' : 'OFF');
        }
        
        // ─── JOIN VOICE CHANNEL ───
        else if (!isNaN(lowerCmd) && lowerCmd.length >= 10) {
            currentChannelId = lowerCmd;
            response = '🔊 Connecting ' + clients.length + ' bots to voice channel...';
            
            // Send immediate response
            io.emit('command_response', { command: command, response: response });
            
            // Wait for bots to be ready and connect
            setTimeout(function() {
                var connectedCount = 0;
                for (var i = 0; i < clients.length; i++) {
                    var client = clients[i];
                    if (!client) continue;
                    
                    (function(index) {
                        client.channels.fetch(lowerCmd).then(function(channel) {
                            if (channel) {
                                try {
                                    var conn = joinVoiceChannel({
                                        channelId: channel.id,
                                        guildId: channel.guild.id,
                                        adapterCreator: channel.guild.voiceAdapterCreator,
                                        selfMute: false,
                                        selfDeaf: false
                                    });
                                    
                                    conn.on(VoiceConnectionStatus.Ready, function() {
                                        console.log('✅ Bot ' + (index + 1) + ' connected to voice');
                                        connectedCount++;
                                        if (connectedCount === clients.length) {
                                            io.emit('command_response', { 
                                                command: '🔊 Voice', 
                                                response: '✅ All ' + clients.length + ' bots connected to voice channel!' 
                                            });
                                        }
                                    });
                                    
                                    conn.on(VoiceConnectionStatus.Disconnected, function() {
                                        console.log('❌ Bot ' + (index + 1) + ' disconnected from voice');
                                    });
                                    
                                    var player = createAudioPlayer();
                                    conn.subscribe(player);
                                    
                                    player.on(AudioPlayerStatus.Idle, function() {
                                        if (loopMode && currentUrl && !isPaused) {
                                            setTimeout(function() { startFFmpegStream(currentUrl); }, 500);
                                        }
                                    });
                                    
                                    connections.set(index, conn);
                                    players.set(index, player);
                                } catch(err) {
                                    console.log('❌ Join error Bot ' + (index + 1) + ':', err.message);
                                }
                            }
                        }).catch(function(err) {
                            console.log('❌ Fetch error Bot ' + (index + 1) + ':', err.message);
                        });
                    })(i);
                }
            }, 3000);
            
            return res.json({ response: response });
        }
        
        else {
            response = '❌ Unknown command. Type "help" for list.';
        }
    } catch (err) {
        response = '❌ Error: ' + err.message;
    }

    io.emit('command_response', { command: command, response: response });
    res.json({ response: response });
});

// ─── SOCKET.IO ───
io.on('connection', function(socket) {
    console.log('📱 Dashboard connected');
    socket.emit('status_update', {
        isRunning: isBotRunning,
        botCount: clients.length,
        totalTokens: dashboardTokens.length,
        currentTitle: currentTitle,
        volume: Math.round(currentVolumeMultiplier * 100)
    });
    
    socket.on('start_bots_with_tokens', function(data) {
        var newTokens = data.tokens;
        if (newTokens && newTokens.length > 0) {
            dashboardTokens = [];
            for (var i = 0; i < newTokens.length; i++) {
                var t = newTokens[i];
                if (t && t.length > 10) {
                    dashboardTokens.push(t);
                }
            }
            console.log('🔄 Updated tokens from dashboard: ' + dashboardTokens.length + ' tokens');
            startBots();
        } else {
            console.log('❌ No valid tokens received from dashboard');
        }
    });
    
    socket.on('start_bots', function() { startBots(); });
    socket.on('stop_bots', function() { stopBots(); });
});

// ─── START SERVER ───
var PORT = process.env.PORT || 3000;
server.listen(PORT, function() {
    console.log('\n🌸 RINTU DASHBOARD: http://localhost:' + PORT);
    console.log('📱 Open your Railway URL!\n');
});

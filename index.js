const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Client } = require('discord.js-selfbot-v13');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── SECRET KEY ───
const JWT_SECRET = 'RINTU_PREMIUM_SECRET_KEY_2026';
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

// ─── USER DATABASE (In-memory for demo) ───
// In production, use a real database!
const users = {};

// Default admin account - CHANGE THIS!
const DEFAULT_ADMIN = {
    username: 'admin',
    password: '$2b$10$YourHashedPasswordHere' // Use bcrypt to hash
};

// ─── AUTH MIDDLEWARE ───
function authenticate(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
}

// ─── HTML DASHBOARD (WITH LOGIN) ───
const HTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌸 RINTU PREMIUM</title>
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
        .login-container, .container {
            max-width: 850px;
            width: 100%;
            margin: 0 auto;
        }
        .login-box {
            background: rgba(22,22,50,0.9);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 40px;
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            text-align: center;
        }
        .login-box h1 {
            font-size: 2.5em;
            font-weight: 900;
            background: linear-gradient(135deg, #ff6b9d, #c084fc, #60a5fa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        .login-box .sub {
            color: rgba(255,255,255,0.4);
            margin-bottom: 30px;
            letter-spacing: 3px;
        }
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
            transition: all 0.3s;
        }
        .login-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 30px rgba(192,132,252,0.3); }
        .login-error { color: #f87171; margin-top: 12px; font-size: 0.9em; }
        .status-user {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: rgba(255,255,255,0.05);
            border-radius: 10px;
            margin-bottom: 12px;
        }
        .status-user .user { color: #c084fc; font-weight: 600; }
        .status-user .logout { color: #f87171; cursor: pointer; font-size: 0.8em; }
        .status-user .logout:hover { text-decoration: underline; }
        .header { text-align: center; padding: 20px 0 15px; }
        .header h1 {
            font-size: 2.5em;
            font-weight: 900;
            background: linear-gradient(135deg, #ff6b9d, #c084fc, #60a5fa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: 2px;
        }
        .header .subtitle { color: rgba(255,255,255,0.3); font-size: 0.8em; letter-spacing: 3px; }
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
        .btn-danger { background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; }
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
        .share-link {
            background: rgba(0,0,0,0.3);
            padding: 10px 14px;
            border-radius: 10px;
            margin-top: 8px;
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }
        .share-link input {
            flex: 1;
            background: transparent;
            border: none;
            color: #60a5fa;
            font-size: 0.85em;
            outline: none;
            min-width: 150px;
        }
        .share-link .copy-btn {
            background: rgba(192,132,252,0.2);
            color: #c084fc;
            border: none;
            padding: 6px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.8em;
        }
        .share-link .copy-btn:hover { background: rgba(192,132,252,0.3); }
        @media (max-width: 600px) {
            .header h1 { font-size: 1.8em; }
            .status-bar { flex-direction: column; align-items: stretch; }
            .btn-group { justify-content: center; }
            .cmd-grid { grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); }
            .now-playing { flex-direction: column; text-align: center; }
            .input-row { flex-direction: column; }
            .login-box { padding: 24px; }
        }
    </style>
</head>
<body>
<div id="app">
    <!-- LOGIN SCREEN -->
    <div id="loginScreen" class="login-container">
        <div class="login-box">
            <h1>🌸 RINTU PREMIUM</h1>
            <div class="sub">✦ Multi-User Selfbot Controller ✦</div>
            <input type="text" id="loginUser" placeholder="Username" value="admin">
            <input type="password" id="loginPass" placeholder="Password" value="admin123">
            <button class="login-btn" onclick="login()">🔓 LOGIN</button>
            <div id="loginError" class="login-error"></div>
        </div>
    </div>

    <!-- DASHBOARD -->
    <div id="dashboardScreen" class="container" style="display:none;">
        <div class="header">
            <h1>🌸 RINTU PREMIUM</h1>
            <div class="subtitle">✦ Multi-User Selfbot Controller ✦</div>
            <div class="status-user">
                <span class="user">👤 <span id="currentUser">admin</span></span>
                <span class="logout" onclick="logout()">🚪 Logout</span>
            </div>
        </div>

        <!-- SHARE LINK -->
        <div class="card">
            <div class="card-title">🔗 Share Dashboard</div>
            <div class="share-link">
                <input id="shareUrl" readonly value="Loading...">
                <button class="copy-btn" onclick="copyShareUrl()">📋 Copy</button>
            </div>
            <div style="font-size:0.7em;color:rgba(255,255,255,0.2);margin-top:6px;">
                Anyone with this link can access! Change admin password in code.
            </div>
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
                <div class="log-entry"><span class="time">[✦]</span> <span class="sys">🌸 RINTU PREMIUM ready.</span></div>
            </div>
        </div>
    </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
// ─── AUTH ───
let currentUser = null;

function login() {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value.trim();
    
    if (!username || !password) {
        document.getElementById('loginError').textContent = '❌ Enter username and password';
        return;
    }
    
    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            currentUser = username;
            document.getElementById('currentUser').textContent = username;
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('dashboardScreen').style.display = 'block';
            document.getElementById('shareUrl').value = window.location.href;
            initDashboard();
        } else {
            document.getElementById('loginError').textContent = '❌ ' + data.error;
        }
    })
    .catch(() => {
        document.getElementById('loginError').textContent = '❌ Login failed';
    });
}

function logout() {
    fetch('/api/logout', { method: 'POST' })
    .then(() => {
        document.getElementById('dashboardScreen').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('loginError').textContent = '';
    });
}

function copyShareUrl() {
    const url = document.getElementById('shareUrl');
    url.select();
    document.execCommand('copy');
    addLog('📋 Share URL copied!', 'resp');
}

// ─── DASHBOARD ───
var logArea, statusDot, statusText, botCount, volDisplay, nowPlaying;
var tokenInput, tokenCount;
var socket;

function initDashboard() {
    logArea = document.getElementById('logArea');
    statusDot = document.getElementById('statusDot');
    statusText = document.getElementById('statusText');
    botCount = document.getElementById('botCount');
    volDisplay = document.getElementById('volDisplay');
    nowPlaying = document.getElementById('nowPlaying');
    tokenInput = document.getElementById('tokenInput');
    tokenCount = document.getElementById('tokenCount');

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
        try {
            var tokens = JSON.parse(saved);
            tokenInput.value = tokens.join('\\n');
            updateTokenStats();
            addLog('📂 Loaded ' + tokens.length + ' tokens', 'resp');
        } catch(e) { addLog('❌ Error loading', 'err'); }
    };

    // Auto-load tokens
    (function() {
        var saved = localStorage.getItem('rintu_tokens');
        if (saved) {
            try {
                var tokens = JSON.parse(saved);
                tokenInput.value = tokens.join('\\n');
                updateTokenStats();
            } catch(e) {}
        }
    })();

    window.addLog = function(msg, type) {
        if (!type) type = 'sys';
        var time = new Date().toLocaleTimeString();
        var entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = '<span class="time">[' + time + ']</span> <span class="' + type + '">' + msg + '</span>';
        logArea.appendChild(entry);
        logArea.scrollTop = logArea.scrollHeight;
    };

    socket = io();

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

    // Check if already logged in via cookie
    fetch('/api/check-auth')
        .then(r => r.json())
        .then(data => {
            if (data.authenticated) {
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('dashboardScreen').style.display = 'block';
                document.getElementById('currentUser').textContent = data.user;
                document.getElementById('shareUrl').value = window.location.href;
                initDashboard();
            }
        })
        .catch(() => {});
}

// Auto-login check on load
window.onload = function() {
    fetch('/api/check-auth')
        .then(r => r.json())
        .then(data => {
            if (data.authenticated) {
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('dashboardScreen').style.display = 'block';
                document.getElementById('currentUser').textContent = data.user;
                document.getElementById('shareUrl').value = window.location.href;
                initDashboard();
            }
        })
        .catch(() => {});
};
</script>
</body>
</html>`;

// ─── SERVE HTML ───
app.get('/', (req, res) => {
    res.send(HTML);
});

// ─── AUTH ROUTES ───

// Pre-create admin user (in-memory)
users.admin = {
    username: 'admin',
    password: '$2b$10$YourHashedPasswordHere' // Use actual hash from bcrypt
};

// For demo - simple password check (use bcrypt in production)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.json({ success: false, error: 'Missing credentials' });
    }
    
    // Simple check - in production use bcrypt
    if (username === 'admin' && password === 'admin123') {
        const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
        res.cookie('token', token, { httpOnly: true, maxAge: SESSION_TIMEOUT });
        return res.json({ success: true });
    }
    
    res.json({ success: false, error: 'Invalid credentials' });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

app.get('/api/check-auth', authenticate, (req, res) => {
    res.json({ authenticated: true, user: req.user.username });
});

// ─── API ROUTES (Protected) ───

// ─── BOT STATE ───
let dashboardTokens = [];
let isBotRunning = false;
let clients = [];
let connections = {};
let players = {};
let currentTitle = 'Nothing playing';
let currentUrl = null;
let currentVolume = 1.0;
let currentChannelId = null;

// ─── BOT FUNCTIONS ───
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
            ws: {
                properties: {
                    $browser: 'Discord iOS'
                }
            }
        });

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
    
    // Stop all players
    for (const key in players) {
        try { players[key].stop(); } catch(e) {}
    }
    players = {};
    
    // Destroy all connections
    for (const key in connections) {
        try { connections[key].destroy(); } catch(e) {}
    }
    connections = {};
    
    // Destroy all clients
    clients.forEach(c => { try { c.destroy(); } catch(e) {} });
    clients = [];
    
    currentUrl = null;
    currentChannelId = null;
    io.emit('bots_stopped');
    console.log('⛔ All bots stopped');
}

// ─── PROTECTED ROUTES ───
app.get('/api/status', authenticate, (req, res) => {
    res.json({
        isRunning: isBotRunning,
        botCount: clients.length,
        totalTokens: dashboardTokens.length,
        currentTitle: currentTitle,
        volume: Math.round(currentVolume * 100)
    });
});

app.post('/api/command', authenticate, async (req, res) => {
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
                    // FIX: Use proper ytdl with opus
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
            if (players[0]) {
                players[0].stop();
                response = '⏹️ Stopped';
            } else {
                response = '❌ Nothing playing';
            }
        } else if (lower === 'pause') {
            if (players[0]) {
                players[0].pause();
                response = '⏸️ Paused';
            } else {
                response = '❌ Nothing playing';
            }
        } else if (lower === 'resume') {
            if (players[0]) {
                players[0].unpause();
                response = '▶️ Resumed';
            } else {
                response = '❌ Nothing playing';
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
            } else {
                response = '❌ Not in voice';
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

                    // Handle connection events
                    connection.on(VoiceConnectionStatus.Ready, () => {
                        console.log('✅ Bot ' + (i + 1) + ' connected to voice');
                    });

                    connection.on(VoiceConnectionStatus.Disconnected, () => {
                        console.log('❌ Bot ' + (i + 1) + ' disconnected');
                    });

                    connections[i] = connection;
                    count++;
                } catch (err) {
                    console.log('❌ Bot ' + (i + 1) + ' join error');
                }
            }

            response = '✅ Connected ' + count + '/' + clients.length + ' bots to voice';
        } else if (lower === 'status') {
            response = '🎵 ' + currentTitle + '\n📊 ' + clients.length + '/' + dashboardTokens.length + ' bots online\n🔊 ' + Math.round(currentVolume * 100) + '%';
        } else {
            response = '❌ Unknown command. Try: play <url>, stop, pause, resume, volume 1-500, leave, or channel_id';
        }
    } catch (err) {
        response = '❌ Error: ' + err.message;
    }

    io.emit('command_response', { command, response });
    res.json({ response });
});

// ─── SOCKET.IO ───
io.use((socket, next) => {
    const token = socket.handshake.headers.cookie?.split('token=')[1]?.split(';')[0];
    if (!token) {
        return next(new Error('Authentication required'));
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
        next();
    } catch (err) {
        next(new Error('Invalid token'));
    }
});

io.on('connection', (socket) => {
    console.log('📱 Dashboard connected: ' + socket.user.username);
    
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
            console.log('🔄 ' + dashboardTokens.length + ' tokens loaded by ' + socket.user.username);
            startBots();
        }
    });

    socket.on('start_bots', startBots);
    socket.on('stop_bots', stopBots);
});

// ─── START SERVER ───
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('\n🌸 RINTU PREMIUM: http://localhost:' + PORT);
    console.log('📱 Multi-User Enabled!');
    console.log('🔑 Default: admin / admin123');
    console.log('📋 Share URL with friends!\n');
});

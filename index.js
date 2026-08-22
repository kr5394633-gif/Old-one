const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Client } = require('discord.js-selfbot-v13');
const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg-static');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
        return { success: false, error: 'Bots already running' };
    }
    
    if (!tokens || tokens.length === 0) {
        return { success: false, error: 'No tokens' };
    }

    dashboardTokens = tokens;
    isBotRunning = true;
    
    for (var i = 0; i < dashboardTokens.length; i++) {
        (function(index) {
            var token = dashboardTokens[index];
            var client = new Client({ 
                checkUpdate: false,
                ws: { properties: { $browser: 'Discord iOS' } }
            });

            client.on('ready', function() {
                var tag = client.user ? client.user.tag : 'Unknown';
                console.log('✅ Bot ' + (index + 1) + ': ' + tag);
                io.emit('bot_status', { index: index + 1, total: dashboardTokens.length, tag: tag });
            });

            client.login(token).catch(function(err) {
                console.log('❌ Bot ' + (index + 1) + ' login failed');
            });
            clients.push(client);
        })(i);
    }
    
    io.emit('bots_started', { count: dashboardTokens.length });
    return { success: true, count: dashboardTokens.length };
}

function stopBots() {
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
    return { success: true };
}

// ─── API ───

app.post('/api/start-bots', function(req, res) {
    console.log('📨 POST /api/start-bots');
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

    var results = [];
    for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        if (!client) continue;
        try {
            await client.acceptInvite(inviteCode);
            results.push('Bot ' + (i + 1) + ' joined');
        } catch (err) {
            results.push('Bot ' + (i + 1) + ' failed');
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

app.post('/api/command', function(req, res) {
    var command = req.body.command;
    if (!command) return res.json({ error: 'No command' });
    io.emit('command_response', { command: command, response: 'Command received!' });
    res.json({ response: 'Command received!' });
});

// ─── SOCKET ───
io.on('connection', function(socket) {
    console.log('📱 Client connected');
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
    console.log('✅ Server started!\n');
});

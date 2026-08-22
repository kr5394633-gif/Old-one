const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Client, StreamType } = require('discord.js-selfbot-v13');
const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg-static');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── BOT STATE ───
var dashboardTokens = [];
var isBotRunning = false;
var clients = [];
var voiceConnections = {};
var players = {};
var currentTitle = 'Nothing playing';
var currentVolume = 1.0;
var keepAliveIntervals = {};

console.log('🚀 SERVER STARTED!');

// ─── START BOTS ───
function startBots(tokens) {
    console.log('🔥 Starting ' + tokens.length + ' bots...');
    
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

// ─── STOP BOTS ───
function stopBots() {
    if (!isBotRunning) {
        return { success: false, error: 'Not running' };
    }
    
    isBotRunning = false;
    
    for (var key in players) {
        try { players[key].stop(); } catch(e) {}
    }
    players = {};
    
    for (var key2 in voiceConnections) {
        try { voiceConnections[key2].destroy(); } catch(e) {}
    }
    voiceConnections = {};
    
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

// ─── JOIN VOICE ───
async function joinVoice(client, channelId) {
    try {
        var channel = await client.channels.fetch(channelId);
        if (!channel) {
            console.log('❌ Channel not found');
            return null;
        }
        
        // Check if already connected
        if (client.voice.connection) {
            console.log('⚠️ Already in voice, disconnecting first...');
            client.voice.disconnect();
            await sleep(1000);
        }
        
        var connection = client.voice.connect(channelId);
        console.log('✅ Connected to voice!');
        return connection;
    } catch (err) {
        console.log('❌ Join voice error:', err.message);
        return null;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── PLAY AUDIO ───
function playAudio(clientIndex, url) {
    try {
        var client = clients[clientIndex];
        if (!client) {
            console.log('❌ Client not found');
            return false;
        }
        
        if (!client.voice.connection) {
            console.log('❌ Not in voice channel');
            return false;
        }
        
        // Create audio stream
        var stream = ytdl(url, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25
        });
        
        // Play using the voice connection
        var dispatcher = client.voice.connection.play(stream, {
            type: 'opus',
            volume: currentVolume
        });
        
        dispatcher.on('finish', function() {
            console.log('✅ Playback finished');
            io.emit('audio_update', { status: 'finished', title: 'Nothing playing' });
        });
        
        dispatcher.on('error', function(err) {
            console.log('❌ Playback error:', err.message);
        });
        
        players[clientIndex] = dispatcher;
        currentTitle = '🎵 Playing audio';
        io.emit('audio_update', { status: 'playing', title: currentTitle, volume: Math.round(currentVolume * 100) });
        console.log('✅ Playing audio on bot ' + (clientIndex + 1));
        return true;
    } catch (err) {
        console.log('❌ Play error:', err.message);
        return false;
    }
}

// ─── API ROUTES ───

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
            results.push('✅ Bot ' + (i + 1) + ' joined');
        } catch (err) {
            results.push('❌ Bot ' + (i + 1) + ' failed');
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
    var parts = lower.split(' ');
    var cmd = parts[0];
    var args = parts.slice(1).join(' ');

    console.log('📨 Command:', cmd, 'Args:', args);

    try {
        // ─── PLAY ───
        if (cmd === 'play' && args) {
            if (clients.length === 0) {
                response = '❌ Start bots first!';
            } else {
                var success = false;
                for (var i = 0; i < clients.length; i++) {
                    var client = clients[i];
                    if (!client) continue;
                    
                    // Check if in voice
                    if (!client.voice.connection) {
                        console.log('Bot ' + (i + 1) + ' not in voice, skipping');
                        continue;
                    }
                    
                    var result = playAudio(i, args);
                    if (result) {
                        success = true;
                        response = '🎵 Playing on ' + (i + 1) + ' bots!';
                        break;
                    }
                }
                
                if (!success) {
                    response = '❌ No bots in voice channel! Join voice first.';
                }
            }
        }
        
        // ─── STOP ───
        else if (cmd === 'stop') {
            var stopped = 0;
            for (var key in players) {
                try {
                    players[key].stop();
                    stopped++;
                } catch(e) {}
            }
            players = {};
            response = '⏹️ Stopped playback on ' + stopped + ' bots';
        }
        
        // ─── PAUSE ───
        else if (cmd === 'pause') {
            var paused = 0;
            for (var key in players) {
                try {
                    players[key].pause();
                    paused++;
                } catch(e) {}
            }
            response = '⏸️ Paused on ' + paused + ' bots';
        }
        
        // ─── RESUME ───
        else if (cmd === 'resume') {
            var resumed = 0;
            for (var key in players) {
                try {
                    players[key].resume();
                    resumed++;
                } catch(e) {}
            }
            response = '▶️ Resumed on ' + resumed + ' bots';
        }
        
        // ─── VOLUME ───
        else if (cmd === 'volume') {
            var vol = parseInt(args);
            if (isNaN(vol) || vol < 1 || vol > 2000) {
                response = '❌ Volume must be 1-2000';
            } else {
                currentVolume = vol / 100;
                for (var key in players) {
                    try {
                        players[key].setVolume(currentVolume);
                    } catch(e) {}
                }
                response = '🔊 Volume set to ' + vol + '%';
                io.emit('audio_update', { volume: Math.round(currentVolume * 100) });
            }
        }
        
        // ─── LEAVE ───
        else if (cmd === 'leave') {
            var left = 0;
            for (var i2 = 0; i2 < clients.length; i2++) {
                var client2 = clients[i2];
                if (!client2) continue;
                if (client2.voice.connection) {
                    try {
                        client2.voice.disconnect();
                        left++;
                    } catch(e) {}
                }
            }
            voiceConnections = {};
            players = {};
            response = '👋 Left voice on ' + left + ' bots';
        }
        
        // ─── JOIN VOICE (CHANNEL ID) ───
        else if (!isNaN(cmd) && cmd.length >= 10) {
            var channelId = cmd;
            var joined = 0;
            
            for (var i3 = 0; i3 < clients.length; i3++) {
                var client3 = clients[i3];
                if (!client3) continue;
                
                try {
                    var connection = await joinVoice(client3, channelId);
                    if (connection) {
                        voiceConnections[i3] = connection;
                        joined++;
                    }
                } catch (err) {
                    console.log('❌ Bot ' + (i3 + 1) + ' join error');
                }
            }
            
            if (joined > 0) {
                response = '✅ ' + joined + '/' + clients.length + ' bots joined voice!';
            } else {
                response = '❌ Failed to join voice. Make sure bots are in the server!';
            }
        }
        
        // ─── HELP ───
        else if (cmd === 'help') {
            response = 'Commands: play <url>, stop, pause, resume, volume <1-2000>, leave, <channel_id>';
        }
        
        else {
            response = '❌ Unknown command. Try: play <url>, stop, pause, resume, volume <1-2000>, leave, <channel_id>';
        }
    } catch (err) {
        response = '❌ Error: ' + err.message;
        console.log('Command error:', err.message);
    }

    io.emit('command_response', { command: command, response: response });
    res.json({ response: response });
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
    console.log('✅ Server started!');
    console.log('📊 Commands: play <url>, stop, pause, resume, volume, leave, <channel_id>\n');
});

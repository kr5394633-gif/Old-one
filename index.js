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

console.log('🚀 RINTU ULTIMATE STARTED!');

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
                console.log('✅ Bot ' + (index + 1) + '/' + dashboardTokens.length + ': ' + tag);
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
        try { voiceConnections[key2].disconnect(); } catch(e) {}
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
        console.log('🔄 Joining voice channel: ' + channelId);
        
        // First check if channel exists
        var channel = await client.channels.fetch(channelId);
        if (!channel) {
            console.log('❌ Channel not found');
            return false;
        }
        
        // Check if already connected
        if (client.voice.connection) {
            console.log('⚠️ Already in voice, reconnecting...');
            try { client.voice.disconnect(); } catch(e) {}
            await sleep(1000);
        }
        
        // Connect to voice
        var connection = client.voice.connect(channelId);
        console.log('✅ Connected to voice!');
        
        // Set up keep-alive
        var intervalId = setInterval(function() {
            try {
                if (client.voice && client.voice.connection) {
                    client.voice.connection.setSpeaking(true);
                    setTimeout(function() {
                        try { client.voice.connection.setSpeaking(false); } catch(e) {}
                    }, 100);
                }
            } catch(e) {}
        }, 15000);
        
        keepAliveIntervals[Date.now()] = intervalId;
        return true;
    } catch (err) {
        console.log('❌ Join voice error:', err.message);
        return false;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
            var inviteObj = await client.fetchInvite(inviteCode);
            if (inviteObj) {
                await client.acceptInvite(inviteCode);
                results.push('✅ Bot ' + (i + 1) + ' joined: ' + (inviteObj.guild?.name || 'Server'));
            }
        } catch (err) {
            results.push('❌ Bot ' + (i + 1) + ' failed: ' + err.message);
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

    console.log('📨 Command:', cmd);

    try {
        // ─── JOIN VOICE (CHANNEL ID) ───
        if (!isNaN(cmd) && cmd.length >= 10) {
            var channelId = cmd;
            var joined = 0;
            var failed = 0;
            
            for (var i = 0; i < clients.length; i++) {
                var client = clients[i];
                if (!client) continue;
                
                var success = await joinVoice(client, channelId);
                if (success) {
                    voiceConnections[i] = client.voice.connection;
                    joined++;
                } else {
                    failed++;
                }
            }
            
            if (joined > 0) {
                response = '✅ ' + joined + '/' + clients.length + ' bots joined voice!';
                if (failed > 0) {
                    response += ' ⚠️ ' + failed + ' failed';
                }
            } else {
                response = '❌ All bots failed to join. Make sure they are in the server and the channel ID is correct.';
            }
        }
        
        // ─── PLAY ───
        else if (cmd === 'play' && args) {
            if (clients.length === 0) {
                response = '❌ Start bots first!';
            } else {
                var played = 0;
                var failedPlay = 0;
                
                for (var i2 = 0; i2 < clients.length; i2++) {
                    var client2 = clients[i2];
                    if (!client2) continue;
                    if (!client2.voice.connection) {
                        failedPlay++;
                        continue;
                    }
                    
                    try {
                        // Get audio stream
                        var stream = ytdl(args, {
                            filter: 'audioonly',
                            quality: 'highestaudio',
                            highWaterMark: 1 << 25
                        });
                        
                        // Play using voice connection
                        var dispatcher = client2.voice.connection.play(stream, {
                            type: 'opus',
                            volume: currentVolume
                        });
                        
                        dispatcher.on('finish', function() {
                            console.log('✅ Playback finished');
                            io.emit('audio_update', { status: 'finished', title: 'Nothing playing' });
                        });
                        
                        players[i2] = dispatcher;
                        played++;
                        currentTitle = '🎵 Playing';
                        io.emit('audio_update', { status: 'playing', title: currentTitle, volume: Math.round(currentVolume * 100) });
                    } catch (err) {
                        console.log('❌ Play error bot ' + (i2 + 1) + ':', err.message);
                        failedPlay++;
                    }
                }
                
                if (played > 0) {
                    response = '🎵 Playing on ' + played + '/' + clients.length + ' bots!';
                    if (failedPlay > 0) {
                        response += ' ⚠️ ' + failedPlay + ' bots not in voice';
                    }
                } else {
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
            response = '⏹️ Stopped on ' + stopped + ' bots';
            io.emit('audio_update', { status: 'stopped', title: 'Nothing playing' });
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
        else if (cmd === 'volume' && args) {
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
            for (var i3 = 0; i3 < clients.length; i3++) {
                var client3 = clients[i3];
                if (!client3) continue;
                if (client3.voice.connection) {
                    try {
                        client3.voice.disconnect();
                        left++;
                    } catch(e) {}
                }
            }
            voiceConnections = {};
            players = {};
            for (var key in keepAliveIntervals) {
                clearInterval(keepAliveIntervals[key]);
            }
            keepAliveIntervals = {};
            response = '👋 Left voice on ' + left + ' bots';
        }
        
        // ─── HELP ───
        else if (cmd === 'help') {
            response = 'Commands:\n<channel_id> - Join voice\nplay <url> - Play music\nstop - Stop playback\npause - Pause\nresume - Resume\nvolume <1-2000> - Set volume\nleave - Leave voice';
        }
        
        else {
            response = '❌ Unknown command. Try: <channel_id>, play <url>, stop, pause, resume, volume, leave';
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
    console.log('\n🌸 RINTU ULTIMATE: http://localhost:' + PORT);
    console.log('✅ Server started!');
    console.log('📊 ' + dashboardTokens.length + ' tokens loaded\n');
});

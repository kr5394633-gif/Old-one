const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Client } = require('discord.js-selfbot-v13');
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
var voiceStates = {};
var keepAliveIntervals = {};

console.log('🚀 SERVER STARTED - BYPASS MODE');

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
    
    for (var key in keepAliveIntervals) {
        clearInterval(keepAliveIntervals[key]);
    }
    keepAliveIntervals = {};
    
    for (var i = 0; i < clients.length; i++) {
        try { clients[i].destroy(); } catch(e) {}
    }
    clients = [];
    voiceStates = {};
    
    io.emit('bots_stopped');
    return { success: true };
}

// ─── BYPASS: JOIN VOICE USING RAW DISCORD API ───
async function bypassJoinVoice(token, channelId, guildId) {
    try {
        // Get the voice gateway URL
        const gatewayResponse = await axios.get('https://discord.com/api/v9/gateway');
        const gatewayUrl = gatewayResponse.data.url;
        
        // Get voice region and server info
        const channelInfo = await axios.get(`https://discord.com/api/v9/channels/${channelId}`, {
            headers: { 'Authorization': token }
        });
        
        const guildInfo = await axios.get(`https://discord.com/api/v9/guilds/${guildId}`, {
            headers: { 'Authorization': token }
        });
        
        // Get voice state
        const voiceState = await axios.patch(
            `https://discord.com/api/v9/guilds/${guildId}/voice-states/@me`,
            {
                channel_id: channelId,
                self_mute: false,
                self_deaf: false
            },
            {
                headers: { 
                    'Authorization': token,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Voice state updated for bot');
        return true;
    } catch (err) {
        console.log('❌ Bypass join error:', err.response?.data || err.message);
        return false;
    }
}

// ─── ALTERNATIVE: USE BUILT-IN VOICE ───
async function joinVoiceBuiltIn(client, channelId) {
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            console.log('❌ Channel not found');
            return false;
        }
        
        // Check if already in voice
        if (client.voice.connection) {
            console.log('⚠️ Already in voice, reconnecting...');
            client.voice.disconnect();
            await sleep(1000);
        }
        
        // Connect using built-in method
        const connection = client.voice.connect(channelId);
        console.log('✅ Connected to voice using built-in');
        
        // Keep alive
        const intervalId = setInterval(() => {
            try {
                if (client.voice.connection) {
                    client.voice.connection.setSpeaking(true);
                    setTimeout(() => {
                        try { client.voice.connection.setSpeaking(false); } catch(e) {}
                    }, 100);
                }
            } catch(e) {}
        }, 10000);
        
        keepAliveIntervals[Date.now()] = intervalId;
        return true;
    } catch (err) {
        console.log('❌ Built-in join error:', err.message);
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
            await client.acceptInvite(inviteCode);
            results.push('✅ Bot ' + (i + 1) + ' joined: ' + (inviteObj.guild?.name || 'Server'));
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
        currentTitle: 'Nothing playing',
        volume: 100
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
        // ─── JOIN VOICE (BY CHANNEL ID) ───
        if (!isNaN(cmd) && cmd.length >= 10) {
            var channelId = cmd;
            var joined = 0;
            var failed = 0;
            
            for (var i = 0; i < clients.length; i++) {
                var client = clients[i];
                if (!client) continue;
                
                console.log('🔄 Bot ' + (i + 1) + ' joining voice...');
                
                try {
                    // Try built-in first
                    var success = await joinVoiceBuiltIn(client, channelId);
                    if (success) {
                        joined++;
                    } else {
                        // Try bypass method
                        console.log('⚠️ Built-in failed, trying bypass...');
                        var token = dashboardTokens[i];
                        var guildId = client.guilds.cache.first()?.id;
                        if (guildId) {
                            var bypassSuccess = await bypassJoinVoice(token, channelId, guildId);
                            if (bypassSuccess) {
                                joined++;
                            } else {
                                failed++;
                            }
                        } else {
                            failed++;
                        }
                    }
                } catch (err) {
                    console.log('❌ Bot ' + (i + 1) + ' error:', err.message);
                    failed++;
                }
            }
            
            if (joined > 0) {
                response = '✅ ' + joined + '/' + clients.length + ' bots joined voice!';
                if (failed > 0) {
                    response += ' ⚠️ ' + failed + ' bots failed';
                }
            } else {
                response = '❌ All bots failed to join. Try using a different method or check server permissions.';
            }
        }
        
        // ─── PLAY ───
        else if (cmd === 'play' && args) {
            if (clients.length === 0) {
                response = '❌ Start bots first!';
            } else {
                var played = 0;
                for (var i2 = 0; i2 < clients.length; i2++) {
                    var client2 = clients[i2];
                    if (!client2) continue;
                    if (!client2.voice.connection) {
                        console.log('Bot ' + (i2 + 1) + ' not in voice, skipping');
                        continue;
                    }
                    
                    try {
                        // Get audio URL using ytdl via API
                        var audioInfo = await axios.get(`https://api.vevioz.com/api/button/mp3/${encodeURIComponent(args)}`);
                        if (audioInfo.data && audioInfo.data.download) {
                            var audioUrl = audioInfo.data.download;
                            
                            // Play using the connection
                            var dispatcher = client2.voice.connection.play(audioUrl, {
                                type: 'unknown',
                                volume: 1.0
                            });
                            
                            dispatcher.on('finish', function() {
                                console.log('✅ Playback finished');
                            });
                            
                            played++;
                            io.emit('audio_update', { status: 'playing', title: '🎵 ' + args });
                        }
                    } catch (err) {
                        console.log('❌ Play error bot ' + (i2 + 1) + ':', err.message);
                    }
                }
                
                if (played > 0) {
                    response = '🎵 Playing on ' + played + ' bots!';
                } else {
                    response = '❌ No bots in voice or audio error';
                }
            }
        }
        
        // ─── STOP ───
        else if (cmd === 'stop') {
            var stopped = 0;
            for (var i3 = 0; i3 < clients.length; i3++) {
                var client3 = clients[i3];
                if (!client3) continue;
                if (client3.voice.connection && client3.voice.connection.dispatcher) {
                    try {
                        client3.voice.connection.dispatcher.stop();
                        stopped++;
                    } catch(e) {}
                }
            }
            response = '⏹️ Stopped on ' + stopped + ' bots';
            io.emit('audio_update', { status: 'stopped', title: 'Nothing playing' });
        }
        
        // ─── LEAVE ───
        else if (cmd === 'leave') {
            var left = 0;
            for (var i4 = 0; i4 < clients.length; i4++) {
                var client4 = clients[i4];
                if (!client4) continue;
                if (client4.voice.connection) {
                    try {
                        client4.voice.disconnect();
                        left++;
                    } catch(e) {}
                }
            }
            for (var key in keepAliveIntervals) {
                clearInterval(keepAliveIntervals[key]);
            }
            keepAliveIntervals = {};
            response = '👋 Left voice on ' + left + ' bots';
        }
        
        // ─── HELP ───
        else if (cmd === 'help') {
            response = 'Commands: <channel_id> (join voice), play <url>, stop, leave, help';
        }
        
        else {
            response = '❌ Unknown command. Try: <channel_id> (join voice), play <url>, stop, leave';
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
        currentTitle: 'Nothing playing',
        volume: 100
    });
});

var PORT = process.env.PORT || 3000;
server.listen(PORT, function() {
    console.log('\n🌸 RINTU BYPASS: http://localhost:' + PORT);
    console.log('✅ Server started!');
    console.log('📊 Commands: <channel_id>, play <url>, stop, leave\n');
});

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
let dashboardTokens = [];
let isBotRunning = false;
let clients = [];
let tokenStatus = {};
let botTags = [];

console.log('🚀 RINTU STARTED!');

// ─── START BOTS ───
async function startBots(tokens) {
    console.log('🔥 Starting ' + tokens.length + ' bots...');
    
    if (isBotRunning) {
        return { success: false, error: 'Bots already running' };
    }
    if (!tokens || tokens.length === 0) {
        return { success: false, error: 'No tokens' };
    }

    for (let i = 0; i < clients.length; i++) {
        try { clients[i].destroy(); } catch(e) {}
    }
    clients = [];
    botTags = [];
    
    dashboardTokens = tokens;
    isBotRunning = true;
    tokenStatus = {};
    
    const totalTokens = dashboardTokens.length;
    console.log('📊 Total tokens to login: ' + totalTokens);
    
    for (let i = 0; i < dashboardTokens.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        (function(index) {
            const token = dashboardTokens[index];
            console.log('🔑 Logging in bot ' + (index + 1) + '/' + totalTokens);
            
            const client = new Client({ 
                checkUpdate: false,
                ws: { properties: { $browser: 'Discord iOS' } }
            });

            client.on('ready', function() {
                const tag = client.user ? client.user.tag : 'Unknown';
                console.log('✅ Bot ' + (index + 1) + '/' + totalTokens + ': ' + tag + ' ONLINE!');
                tokenStatus[index] = { valid: true, tag: tag };
                botTags[index] = tag;
                io.emit('bot_status', { index: index + 1, total: totalTokens, tag: tag });
                
                let online = 0;
                for (const key in tokenStatus) {
                    if (tokenStatus[key] && tokenStatus[key].valid) online++;
                }
                io.emit('online_update', { online: online, total: totalTokens });
            });

            client.on('error', function(err) {
                console.log('❌ Bot ' + (index + 1) + ' error:', err.message);
                tokenStatus[index] = { valid: false, error: err.message };
            });

            client.login(token).catch(function(err) {
                console.log('❌ Bot ' + (index + 1) + ' login failed:', err.message);
                tokenStatus[index] = { valid: false, error: err.message };
            });
            
            clients.push(client);
        })(i);
    }
    
    setTimeout(function() {
        io.emit('bots_started', { count: dashboardTokens.length });
    }, 3000);
    
    return { success: true, count: dashboardTokens.length };
}

// ─── STOP BOTS ───
function stopBots() {
    if (!isBotRunning) {
        return { success: false, error: 'Not running' };
    }
    
    isBotRunning = false;
    
    for (let i = 0; i < clients.length; i++) {
        try { clients[i].destroy(); } catch(e) {}
    }
    clients = [];
    botTags = [];
    tokenStatus = {};
    
    io.emit('bots_stopped');
    return { success: true };
}

// ─── SEND MESSAGE TO CHANNEL ───
async function sendMessageToChannel(channelId, content) {
    let success = 0;
    for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        if (!client) continue;
        if (!tokenStatus[i] || !tokenStatus[i].valid) continue;
        
        try {
            const channel = await client.channels.fetch(channelId);
            if (channel) {
                await channel.send(content);
                success++;
            }
        } catch (err) {
            console.log('❌ Bot ' + (i + 1) + ' send error:', err.message);
        }
    }
    return success;
}

// ─── API ROUTES ───

app.post('/api/start-bots', function(req, res) {
    console.log('📨 POST /api/start-bots');
    const tokens = req.body.tokens;
    if (!tokens || tokens.length === 0) {
        return res.json({ success: false, error: 'No tokens' });
    }
    startBots(tokens).then(function(result) {
        res.json(result);
    });
});

app.post('/api/stop-bots', function(req, res) {
    console.log('📨 POST /api/stop-bots');
    const result = stopBots();
    res.json(result);
});

app.post('/api/join-server', async function(req, res) {
    const invite = req.body.invite;
    if (!invite) return res.json({ error: 'No invite' });
    if (clients.length === 0) {
        return res.json({ error: 'Start bots first!' });
    }

    let inviteCode = invite;
    if (invite.indexOf('discord.gg/') !== -1) {
        inviteCode = invite.split('discord.gg/')[1].split('/')[0].split('?')[0];
    }
    if (invite.indexOf('discord.com/invite/') !== -1) {
        inviteCode = invite.split('discord.com/invite/')[1].split('/')[0].split('?')[0];
    }

    const results = [];
    for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        if (!client) continue;
        try {
            const inviteObj = await client.fetchInvite(inviteCode);
            if (inviteObj) {
                await client.acceptInvite(inviteCode);
                results.push('✅ Bot ' + (i + 1) + ' joined: ' + (inviteObj.guild?.name || 'Server'));
            }
        } catch (err) {
            results.push('❌ Bot ' + (i + 1) + ' failed: ' + err.message);
        }
    }

    const message = results.join('\n');
    io.emit('command_response', { command: 'Join Server', response: message });
    res.json({ message: message });
});

app.get('/api/status', function(req, res) {
    let online = 0;
    for (const key in tokenStatus) {
        if (tokenStatus[key] && tokenStatus[key].valid) online++;
    }
    
    res.json({
        isRunning: isBotRunning,
        botCount: clients.length,
        onlineCount: online,
        totalTokens: dashboardTokens.length,
        currentTitle: 'Nothing playing',
        volume: 100,
        tokenStatus: tokenStatus,
        botTags: botTags
    });
});

app.post('/api/command', async function(req, res) {
    const command = req.body.command;
    if (!command) return res.json({ error: 'No command' });

    const lower = command.toLowerCase().trim();
    let response = '';
    const parts = lower.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1).join(' ');

    console.log('📨 Command:', cmd);

    try {
        // ─── SEND MESSAGE ───
        if (!isNaN(cmd) && cmd.length >= 10) {
            const channelId = cmd;
            const sent = await sendMessageToChannel(channelId, '✅ Bot is online and ready!');
            response = '📨 Sent message to ' + sent + '/' + clients.length + ' bots in channel ' + channelId;
        }
        
        // ─── SEND CUSTOM MESSAGE ───
        else if (cmd === 'say' && args) {
            const parts2 = args.split(' ');
            const channelId = parts2[0];
            const message = parts2.slice(1).join(' ');
            if (!channelId || !message) {
                response = '❌ Usage: say <channel_id> <message>';
            } else {
                const sent = await sendMessageToChannel(channelId, message);
                response = '📨 Sent "' + message + '" to ' + sent + '/' + clients.length + ' bots';
            }
        }
        
        // ─── HELP ───
        else if (cmd === 'help') {
            response = 'Commands:\n<channel_id> - Send "Bot is online"\nsay <channel_id> <message> - Send custom message\nhelp - Show this';
        }
        
        else {
            response = '❌ Unknown command. Try: <channel_id>, say <channel_id> <message>, help';
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
    
    let online = 0;
    for (const key in tokenStatus) {
        if (tokenStatus[key] && tokenStatus[key].valid) online++;
    }
    
    socket.emit('status_update', {
        isRunning: isBotRunning,
        botCount: clients.length,
        onlineCount: online,
        totalTokens: dashboardTokens.length,
        currentTitle: 'Nothing playing',
        volume: 100
    });
    
    if (botTags.length > 0) {
        for (let i = 0; i < botTags.length; i++) {
            if (botTags[i]) {
                socket.emit('bot_status', { index: i + 1, total: botTags.length, tag: botTags[i] });
            }
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, function() {
    console.log('\n🌸 RINTU: http://localhost:' + PORT);
    console.log('✅ Server started!');
    console.log('📊 Bots can send messages! (Voice not supported for selfbots)\n');
});

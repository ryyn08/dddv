const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    downloadContentFromMessage, 
    makeInMemoryStore, 
    proto 
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const axios = require('axios');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const { FormData, Blob } = require('formdata-node'); // Pastikan install: npm install formdata-node

const phoneNumber = "6283119396819";
const usePairingCode = true;

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

async function Starts() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const ryyn = makeWASocket({
        version,
        logger: pino({ level: 'fatal' }), 
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: true,
    });

    if (usePairingCode && !ryyn.authState.creds.registered) {
        setTimeout(async () => {
            let code = await ryyn.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`\n╭────────────────╼\n╎ RYYN BOT PAIRING CODE : ${code}\n╰────────────────╼\n`);
        }, 3000);
    }

    ryyn.ev.on('creds.update', saveCreds);

    ryyn.ev.on('messages.upsert', async chatUpdate => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message) return;
            const type = Object.keys(m.message)[0];
            const from = m.key.remoteJid;
            
            // Pengambilan Body Pesan
            const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (type === 'imageMessage') ? m.message.imageMessage.caption : (type === 'videoMessage') ? m.message.videoMessage.caption : '';
            const prefix = /^[./!#]/.test(body) ? body.match(/^[./!#]/)[0] : '';
            const command = body.startsWith(prefix) ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : '';
            const args = body.trim().split(/ +/).slice(1);
            const text = args.join(" ");
            
            const isOwner = ["6285883881264@s.whatsapp.net"].includes(m.key.participant || m.key.remoteJid);

            const reply = (teks) => {
                ryyn.sendMessage(from, { text: teks }, { quoted: m });
            };

            switch (command) {
                case 'menu': {
                    const menuText = `
╭───「 *RYYN BOTZ* 」───
│ 
│ 👋 Halo! Nama saya Ryyn Botz
│ 
│ 🛠️ *Fitur Utama:*
│ ⮕ ${prefix}getsw (Reply Status)
│ ⮕ ${prefix}rvo (Ambil ViewOnce)
│ ⮕ ${prefix}sbrat [teks]
│ ⮕ ${prefix}fakett [format]
│ ⮕ ${prefix}ping
│
╰────────────────╼`;
                    reply(menuText);
                }
                break;

                case 'ping':
                    reply('Pong! Bot Aktif 🚀');
                    break;

                // FIX RVO: Mendukung berbagai struktur ViewOnce Baileys
                case 'rvo': case 'readviewonce': {
                
                    const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!quoted) return reply('Reply pesan ViewOnce!');

                    // Deteksi konten di dalam viewOnceMessageV2 atau viewOnceMessage
                    const vOne = quoted.viewOnceMessageV2?.message || quoted.viewOnceMessage?.message || quoted;
                    const typeV = Object.keys(vOne)[0];
                    const media = vOne[typeV];

                    if (!/imageMessage|videoMessage/.test(typeV)) return reply('Itu bukan pesan ViewOnce gambar/video.');

                    const stream = await downloadContentFromMessage(media, typeV.replace('Message', ''));
                    let buffer = Buffer.from([]);
                    for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

                    if (/video/.test(typeV)) {
                        await ryyn.sendMessage(from, { video: buffer, caption: media.caption || 'Downloaded by Ryyn' }, { quoted: m });
                    } else {
                        await ryyn.sendMessage(from, { image: buffer, caption: media.caption || 'Downloaded by Ryyn' }, { quoted: m });
                    }
                }
                break;

                case 'faketiktok': case 'fakett': {
                    if (!text && !m.message.imageMessage) {
                        return reply(`*Format Salah!*\n\nContoh:\n${prefix + command} Nama|User|Follow|Followers|Likes\n\nAtau reply gambar dengan caption tersebut.`);
                    }

                    await ryyn.sendMessage(from, { react: { text: '⏳', key: m.key } });

                    let [name, username, following, followers, likes, url] = text.split('|').map(v => v?.trim());
                    const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    const mime = (m.message.imageMessage || quoted?.imageMessage) ? 'image/jpeg' : '';

                    if (!url) {
                        if (mime) {
                            // Proses Download & Upload ke Uguu
                            const target = m.message.imageMessage ? m.message.imageMessage : quoted.imageMessage;
                            const stream = await downloadContentFromMessage(target, 'image');
                            let buffer = Buffer.from([]);
                            for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

                            let form = new FormData();
                            form.append('files[]', new Blob([buffer]), 'image.jpg');
                            let upload = await axios.post('https://uguu.se/upload.php', form);
                            url = upload.data.files[0].url;
                        } else {
                            url = 'https://telegra.ph/file/241d714fad39ad348858d.jpg'; // Default jika tidak ada foto
                        }
                    }

                    try {
                        let api = `https://api.zenzxz.my.id/maker/faketiktok?name=${encodeURIComponent(name || 'Ryyn')}&username=${encodeURIComponent(username || 'ryynstore')}&following=${following || '10'}&followers=${followers || '100k'}&likes=${likes || '1M'}&url=${encodeURIComponent(url)}`;
                        await ryyn.sendMessage(from, { image: { url: api }, caption: '✅ Selesai!' }, { quoted: m });
                    } catch (e) {
                        reply('Gagal memproses gambar.');
                    } finally {
                        await ryyn.sendMessage(from, { react: { text: '', key: m.key } });
                    }
                }
                break;

                case 'brat': {
                    if (!text) return reply('Ketik teksnya!');
                    try {
                        const bratUrl = `https://brat.siputzx.my.id/image?text=${encodeURIComponent(text)}&background=%23ffffff&color=%23000000&emojiStyle=apple`;
                        const sticker = new Sticker(bratUrl, {
                            pack: 'Yan imup',
                            author: 'Ryyn Tamvan',
                            type: StickerTypes.FULL,
                        });
                        const buffer = await sticker.toBuffer();
                        await ryyn.sendMessage(from, { sticker: buffer }, { quoted: m });
                    } catch (e) {
                        reply('Gagal membuat sticker.');
                    }
                }
                break;

                case 'getsw': {
                    const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!quoted) return reply('Reply statusnya!');
                    const typeS = Object.keys(quoted)[0];
                    if (!/imageMessage|videoMessage/.test(typeS)) return reply('Hanya foto/video.');
                    
                    const stream = await downloadContentFromMessage(quoted[typeS], typeS.replace('Message', ''));
                    let buffer = Buffer.from([]);
                    for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
                    await ryyn.sendMessage(from, { [typeS.replace('Message', '')]: buffer }, { quoted: m });
                }
                break;
            }
        } catch (err) {
            console.error('Error:', err);
        }
    });

    ryyn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) Starts();
        } else if (connection === 'open') {
            console.log('✅ Bot Berhasil Terhubung!');
        }
    });
}

Starts();

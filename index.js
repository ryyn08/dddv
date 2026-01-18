const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeInMemoryStore, 
    jidDecode,
    proto
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const chalk = require('chalk');
const fetch = require('node-fetch');

// Konfigurasi Pairing
const phoneNumber = "6283119396819";
const usePairingCode = true;

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

const readmore = String.fromCharCode(8206).repeat(4001);

async function Starts() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const Cantarella = makeWASocket({
        printQRInTerminal: !usePairingCode,
        syncFullHistory: true,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        generateHighQualityLinkPreview: true, 
        version,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        logger: pino({ level: 'silent' }),
        auth: state
    });

    // Logika Pairing Code
    if (usePairingCode && !Cantarella.authState.creds.registered) {
        setTimeout(async () => {
            let code = await Cantarella.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(chalk.black(chalk.bgGreen(` Your Pairing Code : `)), chalk.black(chalk.white(code)));
        }, 3000);
    }

    Cantarella.ev.on('creds.update', saveCreds);

    Cantarella.ev.on('messages.upsert', async chatUpdate => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message) return;
            if (m.key && m.key.remoteJid === 'status@broadcast') return;
            
            const from = m.key.remoteJid;
            const type = Object.keys(m.message)[0];
            const content = JSON.stringify(m.message);
            const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (type === 'imageMessage') ? m.message.imageMessage.caption : (type === 'videoMessage') ? m.message.videoMessage.caption : '';
            
            const prefix = /^[°•π÷×¶∆£¢€¥®™✓_=|~!?@#$%^&.\/\\©^]/.test(body) ? body.match(/^[°•π÷×¶∆£¢€¥®™✓_=|~!?@#$%^&.\/\\©^]/)[0] : '';
            const isCmd = body.startsWith(prefix);
            const command = isCmd ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : '';
            const args = body.trim().split(/ +/).slice(1);
            const text = q = args.join(" ");
            
            const reply = (teks) => {
                Cantarella.sendMessage(from, { text: teks }, { quoted: m });
            };

            if (isCmd) {
                console.log(chalk.green(`[COMMAND]`), chalk.white(command), `from`, chalk.yellow(from));
            }

            switch (command) {
                case 'menu':
                case 'help': {
                    let menu = `*HYDRO-MD BOT* 🌊\n\n` +
                               `*PREFIX:* [ ${prefix} ]\n\n` +
                               `*Main Menu:*\n` +
                               `• ${prefix}iqc <text>\n` +
                               `• ${prefix}readmore <text1|text2>\n` +
                               `• ${prefix}ping\n\n` +
                               `_Bot ini berjalan menggunakan Baileys Multi-Device._`;
                    reply(menu);
                }
                break;

                case 'ping': {
                    reply('Pong!! Bot Aktif ✅');
                }
                break;

                case 'iqc': {
                    if (!text) return reply('Mana Text Nya?');
                    if (text.length > 80) return reply('Max 80 Text');
                    reply("Proses...");
                    await Cantarella.sendMessage(from, {
                        image: { url: 'https://flowfalcon.dpdns.org/imagecreator/iqc?text=' + encodeURIComponent(text) },
                        caption: `Done ✨`
                    }, { quoted: m });
                }
                break;

                case 'readmore':
                case 'selengkapnya': {
                    if (!text.includes('|')) return reply(`Masukan text contoh: ${prefix}${command} Kamujelek|tapi boong`);
                    let [l, r] = text.split('|');
                    reply(l + readmore + r);
                }
                break;

                default:
            }
        } catch (err) {
            console.log(err);
        }
    });

    Cantarella.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            if (reason === DisconnectReason.loggedOut) { console.log(`Device Logged Out, Please Scan Again.`); }
            else { Starts(); }
        } else if (connection === 'open') {
            console.log(chalk.green('Connected to WhatsApp ✅'));
        }
    });
}

Starts();

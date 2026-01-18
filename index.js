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
const axios = require('axios');
const fs = require('fs');

// --- KONFIGURASI ---
const phoneNumber = "6283119396819"; // Nomor bot kamu
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

    // --- LOGIKA PAIRING CODE ---
    if (usePairingCode && !Cantarella.authState.creds.registered) {
        setTimeout(async () => {
            let code = await Cantarella.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`
╭────────────────────────────╼
│ RYYN BOTZ PAIRING CODE
├────────────────────────────╼
│ Your Code : ${code}
╰────────────────────────────╼`);
        }, 3000);
    }

    store.bind(Cantarella.ev);

    Cantarella.ev.on('creds.update', saveCreds);

    Cantarella.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            if (reason === DisconnectReason.loggedOut) { 
                console.log(`Device Logged Out, Please Delete Session and Scan Again.`); 
                process.exit();
            } else { 
                Starts(); 
            }
        } else if (connection === 'open') {
            console.log('BOT TERHUBUNG...!');
        }
    });

    // --- HANDLING PESAN ---
    Cantarella.ev.on('messages.upsert', async chatUpdate => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message) return;
            const contents = JSON.stringify(m.message);
            const from = m.key.remoteJid;
            const type = Object.keys(m.message)[0];
            const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (type === 'imageMessage') ? m.message.imageMessage.caption : (type === 'videoMessage') ? m.message.videoMessage.caption : '';
            const prefix = /^[°•π÷×¶∆£¢€¥®™✓_=|~!?@#$%^&.\/\\©^]/.test(body) ? body.match(/^[°•π÷×¶∆£¢€¥®™✓_=|~!?@#$%^&.\/\\©^]/)[0] : '';
            const isCmd = body.startsWith(prefix);
            const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
            const args = body.trim().split(/ +/).slice(1);
            const text = q = args.join(" ");

            const reply = (teks) => {
                Cantarella.sendMessage(from, { text: teks }, { quoted: m });
            };

            if (isCmd) {
                switch (command) {
                    case 'menu':
                    case 'help':
                        let menu = `╭─── [ *RYYN BOTZ* ] ───╼
│
│ • ${prefix}iqc <text>
│ • ${prefix}readmore <teks|teks>
│ • ${prefix}web3zip <url>
│
╰────────────────────────╼`;
                        reply(menu);
                        break;

                    case 'iqc': {
                        if (!text) return reply('Mana Text Nya?');
                        if (text.length > 80) return reply('Max 80 Text');
                        await reply("Proses...");
                        try {
                            await Cantarella.sendMessage(from, {
                                image: { url: `https://api.screenshotmachine.com/?key=788325&url=https://flowfalcon.dpdns.org/imagecreator/iqc?text=${encodeURIComponent(text)}&dimension=1024x768` },
                                caption: "Nih Kak Hasilnya"
                            }, { quoted: m });
                        } catch (e) {
                            // Fallback jika URL utama error
                            await Cantarella.sendMessage(from, {
                                image: { url: 'https://flowfalcon.dpdns.org/imagecreator/iqc?text=' + encodeURIComponent(text) }
                            }, { quoted: m });
                        }
                    }
                    break;

                    case 'readmore':
                    case 'selengkapnya': {
                        if (!text.includes('|')) return reply(`Masukan text contoh: ${prefix}${command} Kamujelek|tapi boong`);
                        let [l, r] = text.split('|');
                        reply(l + readmore + r);
                    }
                    break;

                    case "web3zip": {
                        if (!text) return reply(`Masukkan URL website.\n\nContoh: ${prefix}${command} https://example.com`);
                        let url = text.startsWith("http") ? text : `https://${text}`;
                        await reply("Sedang memproses website ke ZIP, mohon tunggu...");

                        try {
                            const { data } = await axios.post("https://copier.saveweb2zip.com/api/copySite", 
                                { url, renameAssets: true, saveStructure: false, alternativeAlgorithm: false, mobileVersion: false },
                                { headers: { "content-type": "application/json", "origin": "https://saveweb2zip.com" } }
                            );

                            let isFinished = false;
                            let resultData;
                            
                            while (!isFinished) {
                                const { data: status } = await axios.get(`https://copier.saveweb2zip.com/api/getStatus/${data.md5}`);
                                if (status.isFinished) {
                                    isFinished = true;
                                    resultData = status;
                                } else {
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                }
                            }

                            if (resultData.errorCode) return reply(`Gagal: ${resultData.errorText}`);

                            await Cantarella.sendMessage(from, {
                                document: { url: `https://copier.saveweb2zip.com/api/downloadArchive/${resultData.md5}` },
                                fileName: `${url.replace(/https?:\/\//, "").split("/")[0]}.zip`,
                                mimetype: "application/zip",
                                caption: `✅ Website berhasil di-zip!`
                            }, { quoted: m });
                        } catch (e) {
                            reply(`❌ Terjadi kesalahan: ${e.message}`);
                        }
                    }
                    break;
                }
            }
        } catch (err) {
            console.log(err);
        }
    });
}

Starts();

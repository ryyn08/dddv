const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const admin = require("firebase-admin");

// --- KONFIGURASI ---
const botNumber = "6283119396819"; // Nomor Bot Anda
const ownerNumber = "6285883881264@s.whatsapp.net"; // Nomor Owner

// --- FIREBASE SETUP ---
const serviceAccount = {
  "projectId": "vanznumeroo",
  "databaseURL": "https://vanznumeroo-default-rtdb.asia-southeast1.firebasedatabase.app"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: serviceAccount.databaseURL
});

const db = admin.database();

async function Starts() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    
    const Cantarella = makeWASocket({
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // Logika Pairing Code
    if (!Cantarella.authState.creds.registered) {
        setTimeout(async () => {
            let code = await Cantarella.requestPairingCode(botNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`\x1b[36m╭────────────────╼\n╎ Kode Pairing Anda: ${code}\n╰────────────────╼\x1b[0m`);
        }, 3000);
    }

    Cantarella.ev.on("creds.update", saveCreds);

    Cantarella.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("Bot Berhasil Terhubung!");
            await Cantarella.sendMessage(botNumber + "@s.whatsapp.net", { text: "bot aktif" });
            
            // Pantau Firebase untuk data baru
            const ref = db.ref("notifications");
            ref.on("child_added", async (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    const textToSend = `𝐇𝐈 𝐀𝐃𝐌𝐈𝐍 𝐓𝐇𝐄𝐑𝐄'𝐒 𝐍𝐄𝐖 𝐂𝐇 𝐃𝐀𝐓𝐀 𝐇𝐄𝐑𝐄🪀\n\nʟɪɴᴋ ᴄʜ : ${data.url}\nʀᴇᴀᴄᴛ ᴇᴍᴏᴊɪ : ${data.emoji}\nᴋᴇᴍʙᴀʟɪ ᴀᴋᴛɪꜰ : 10 Menit\nᴡᴀᴋᴛᴜ : ${data.timestamp}`;
                    
                    await Cantarella.sendMessage(ownerNumber, { text: textToSend });
                    // Hapus data setelah terkirim agar tidak double
                    await snapshot.ref.remove();
                }
            });
        }
        
        if (connection === "close") {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                Starts();
            }
        }
    });
}

Starts();


// clone at your own risk
const fs = require("fs");
const path = require("path");
const util = require("util");
global.axios = require('axios').default
const chalk = require("chalk");
const speed = require("performance-now");
const { DateTime } = require('luxon');
const fetchSettings = require('./database/fetchSettings');
const groupCache = require('./lib/Groupcache');
const identity = require('./lib/Identity');
const sudoLib = require('./lib/sudo');
const antideleteLib = require('./lib/antidelete');
const { fetchJson } = require('./lib/dreadfunc');
const { execFile } = require("child_process");
const handler = require('./lib/handler');
handler.loadPlugins();

const BOT_ID_PREFIXES = (process.env.ANTIBOT_PREFIXES || 'BAE5')
  .split(',').map((prefix) => prefix.trim().toUpperCase()).filter(Boolean);

function isBotMessageId(id) {
  const value = String(id || '').toUpperCase();
  if (!value) return false;
  if (value.startsWith('3EB0')) return value.length >= 30;
  if (/^[0-9A-F]{32}$/.test(value)) return false;
  return BOT_ID_PREFIXES.some((prefix) => value.startsWith(prefix));
}

module.exports = async function tesla(client, m, chatUpdate, store) {
  try {
	  const {
  wapresence,
  autoread,
  mode,
  prefix,
  antilink,
  antilinkall,
  antidelete,
  gptdm,
  badword,
  antibot,
  antitag	
} = await fetchSettings(); 
	  
	  
    var body =
      m.mtype === "conversation"
        ? m.message.conversation
        : m.mtype == "extendedTextMessage"
        ? m.message.extendedTextMessage.text
        : m.mtype == "buttonsResponseMessage"
        ? m.message.buttonsResponseMessage.selectedButtonId
        : m.mtype == "listResponseMessage"
        ? m.message.listResponseMessage.singleSelectReply.selectedRowId
        : m.mtype == "templateButtonReplyMessage"
        ? m.message.templateButtonReplyMessage.selectedId
        : m.mtype === "messageContextInfo"
        ? m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply.selectedRowId || m.text
        : "";
var budy = typeof m.text == "string" ? m.text : "";
var msgDreaded = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
	  
// leave the prefix string empty if you don't want the bot to use a prefix
const Heroku = require("heroku-client");  
const appname = process.env.APP_NAME || '';
const herokuapi = process.env.HEROKU_API;
const cmd = body.startsWith(prefix);
const botname = "TESLA-MD";
	  
const command = body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase();
const args = body.slice(prefix.length).trim().split(/ +/).slice(1);    
    const pushname = m.pushName || "No Name";
    const botNumber = await client.decodeJid(client.user.id);
    const myIds = await identity.expand(client, identity.botIds(client));
    const itsMe0 = m.fromMe || myIds.has(identity.bare(m.sender));
    const q = args.join(" ");
    let text = q;
    const arg = budy.trim().substring(budy.indexOf(" ") + 1);
    const arg1 = arg.trim().substring(arg.indexOf(" ") + 1);
    m.isBaileys = m.id.startsWith("BAE5") && m.id.length === 16;
    const from = m.chat;
    const reply = m.reply;
    const sender = m.sender;
    const mek = chatUpdate.messages[0];
    const getGroupAdmins = (participants) => { 
       let admins = []; 
       for (let i of participants) { 
         i.admin === "superadmin" ? admins.push(i.id) : i.admin === "admin" ? admins.push(i.id) : ""; 
       } 
       return admins || []; 
     };
    const fortu = (m.quoted || m); 
         const quoted = (fortu.mtype == 'buttonsMessage') ? fortu[Object.keys(fortu)[1]] : (fortu.mtype == 'templateMessage') ? fortu.hydratedTemplate[Object.keys(fortu.hydratedTemplate)[1]] : (fortu.mtype == 'product') ? fortu[Object.keys(fortu)[0]] : m.quoted ? m.quoted : m; 
 
    const color = (text, color) => {
      return !color ? chalk.green(text) : chalk.keyword(color)(text);
    };
const mime = (quoted.msg || quoted).mimetype || "";
const qmsg = (quoted.msg || quoted);
const author = process.env.STICKER_AUTHOR ||'𝗕𝗢𝗧';
const packname = process.env.STICKER_PACKNAME || 'TESLA-MD';
const dev = process.env.DEV || '254781346242';
const menu = process.env.MENU_TYPE || 'VIDEO';
const DevDreaded = dev.split(",");
const badwordkick = process.env.BAD_WORD_KICK || 'FALSE';
const bad = process.env.BAD_WORD || 'fuck';
const badwords = bad.split(",")
	  
    // Group
    const groupMetadata = m.isGroup ? await groupCache.fetchMetadata(client, m.chat).catch((e) => { }) : "";
    const groupName = m.isGroup && groupMetadata ? await groupMetadata.subject : "";
    const groupParticipants = m.isGroup && groupMetadata ? groupMetadata.participants : [];
    const participants = groupParticipants
      .filter(p => p.id)
      .map(p => p.id);

    const adminIds = identity.adminIdSet(groupParticipants);
    const groupAdmin = groupParticipants
      .filter(p => (p.admin || p.isAdmin || p.isSuperAdmin) && p.id)
      .map(p => p.id);
    const isBotAdmin = m.isGroup ? identity.overlaps(myIds, adminIds) : false;
    const senderAllIds = await identity.expand(client, identity.senderIds(m, mek, groupParticipants));
    const groupSender = m.isGroup
      ? ((groupParticipants.find(p => identity.participantIds(p).some(id => senderAllIds.has(id))) || {}).id || sender)
      : sender;
     const isAdmin = m.isGroup ? identity.overlaps(senderAllIds, adminIds) : false;
     const ownerAlt = await identity.expand(client, identity.ownerJids(DevDreaded));
     const itsMe = itsMe0 || identity.overlaps(senderAllIds, myIds);
     const botJid = identity.bare(client.user.id);
     const botLid = identity.bare(client.user.lid || '');
     const botOwnerIds = [botJid, botLid, ...myIds].filter(Boolean);
     const MainOwner = itsMe || identity.isOwner(senderAllIds, DevDreaded, [...ownerAlt, ...botOwnerIds]);
     const isSudo = !MainOwner && await sudoLib.isSudo(client, senderAllIds);
     const Owner = MainOwner || isSudo;
     const admin = process.env.ADMIN_MSG || '𝗖𝗼𝗺𝗺𝗮𝗻𝗱 𝗿𝗲𝘀𝗲𝗿𝘃𝗲𝗱 𝗳𝗼𝗿 𝗔𝗱𝗺𝗶𝗻𝘀!';
     const group = process.env.GROUP_ONLY_MSG || '𝗖𝗼𝗺𝗺𝗮𝗻𝗱 𝗺𝗲𝗮𝗻𝘁 𝗳𝗼𝗿 𝗚𝗿𝗼𝘂𝗽𝘀!';
     const botAdmin = process.env.BOT_ADMIN_MSG || '𝗜 𝗻𝗲𝗲𝗱 𝗔𝗱𝗺𝗶𝗻 𝗽𝗿𝗲𝘃𝗶𝗹𝗲𝗱𝗴𝗲𝘀!'
     const NotOwner = process.env.NOT_OWNER_MSG || '𝗖𝗼𝗺𝗺𝗮𝗻𝗱 𝗺𝗲𝗮𝗻𝘁 𝗳𝗼𝗿 𝘁𝗵𝗲 𝗼𝘄𝗻𝗲𝗿!';
     const mycode = process.env.CODE || '254';
     
const runtime = function (seconds) { 
 seconds = Number(seconds); 
 var d = Math.floor(seconds / (3600 * 24)); 
 var h = Math.floor((seconds % (3600 * 24)) / 3600); 
 var m = Math.floor((seconds % 3600) / 60); 
 var s = Math.floor(seconds % 60); 
 var dDisplay = d > 0 ? d + (d == 1 ? " 𝗱𝗮𝘆, " : " 𝗗𝗮𝘆𝘀, ") : ""; 
 var hDisplay = h > 0 ? h + (h == 1 ? " 𝗵𝗼𝘂𝗿, " : " 𝗛𝗼𝘂𝗿𝘀, ") : ""; 
 var mDisplay = m > 0 ? m + (m == 1 ? " 𝗺𝗶𝗻𝘂𝘁𝗲, " : " 𝗠𝗶𝗻𝘂𝘁𝗲𝘀, ") : ""; 
 var sDisplay = s > 0 ? s + (s == 1 ? " 𝘀𝗲𝗰𝗼𝗻𝗱" : " 𝗦𝗲𝗰𝗼𝗻𝗱𝘀") : ""; 
 return dDisplay + hDisplay + mDisplay + sDisplay; 
 }   
const timestamp = speed(); 
const dreadedspeed = speed() - timestamp 
	  
    // Push Message To Console
 let argsLog = budy.length > 30 ? `${q.substring(0, 30)}...` : budy;

if (wapresence === 'recording' && !m.isGroup) { 
             client.sendPresenceUpdate('recording', m.chat);
	
} else if (wapresence === 'typing' && !m.isGroup) { 
             client.sendPresenceUpdate('composing', m.chat);
	
      }	else if (wapresence === 'online' && !m.isGroup) { 
             client.sendPresenceUpdate('available', m.chat);
    }
    
if (cmd && mode === 'private' && !itsMe && !Owner && m.sender !== dev) {
return;
}


    if (autoread === 'on' && !m.isGroup) { 
             client.readMessages([m.key])
    }
      if (itsMe && mek.key.id.startsWith("BAE5") && mek.key.id.length === 16 && !m.isGroup) return;

antideleteLib.handle(client, m, mek, antidelete);

const msgId = (mek && mek.key && mek.key.id) || m.id || '';
if (antibot === 'on' && m.isGroup && isBotAdmin && !isAdmin && !Owner && !itsMe && isBotMessageId(msgId)) {
  const botSender = m.sender;
  await client.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: msgId, participant: botSender } }).catch(() => { });
  await client.sendMessage(m.chat, {
    text: `${botname} antibot:\n\n@${botSender.split('@')[0]} was identified as a bot and removed to prevent spam.`,
    mentions: [botSender],
  }, { quoted: m }).catch(() => { });
  await client.groupParticipantsUpdate(m.chat, [botSender], 'remove').catch((error) => console.log('Antibot remove failed:', error.message || error));
  return;
}
if (budy.startsWith('>')) { 
   if (!Owner) return;
   try { 
 let evaled = await eval(budy.slice(2)); 
 if (typeof evaled !== 'string') evaled = require('util').inspect(evaled); 
 await reply(evaled); 
   } catch (err) { 
 await reply(String(err)); 
   } 
 } 
 


async function mp3d () {
  const source = path.join(__dirname, 'menu.mp3');
  const voice = path.join(__dirname, 'menu.ogg');
  let note = null;
  try {
    if (!fs.existsSync(voice) || fs.statSync(voice).mtimeMs < fs.statSync(source).mtimeMs) {
      await new Promise((resolve, reject) => {
        execFile('ffmpeg', ['-y', '-i', source, '-vn', '-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1', '-f', 'ogg', voice], { timeout: 30000 }, (error) => (error ? reject(error) : resolve()));
      });
    }
    note = { audio: fs.readFileSync(voice), mimetype: 'audio/ogg; codecs=opus', ptt: true };
  } catch (error) {
    note = { audio: fs.readFileSync(source), mimetype: 'audio/mpeg', ptt: true };
  }
  await client.sendMessage(m.chat, note, { quoted: m });
							}
 
    if (gptdm === 'on' && m.chat.endsWith("@s.whatsapp.net")) {

  let d = await fetchJson(
            `https://bk9.fun/ai/gptt4?q=${text}`
          );
          if (!d.BK9) {
            return reply(
              "An error occurred while fetching the AI chatbot response. Please try again later."
            );
          } else {
            reply(d.BK9);
          }
    }

	  
async function loading () {
var lod = [
"🖤",
"🤬",
"❤",	
	"😡",
   "💙",
	"😂",
	"💛",
"𝗣𝗶𝗻𝗴𝗶𝗻𝗴 𝗖𝗼𝗺𝗽𝗹𝗲𝘁𝗲!"	
]
let { key } = await client.sendMessage(from, {text: '𝗣𝗼𝗻𝗴'})

for (let i = 0; i < lod.length; i++) {
await client.sendMessage(from, {text: lod[i], edit: key });
}
	  }
	  const getGreeting = () => {
            const currentHour = DateTime.now().setZone('Africa/Nairobi').hour;

            if (currentHour >= 5 && currentHour < 12) {
                return '𝗚𝗼𝗼𝗱 𝗠𝗼𝗿𝗻𝗶𝗻𝗴 🌅';
            } else if (currentHour >= 12 && currentHour < 16) {
                return '𝗚𝗼𝗼𝗱 𝗔𝗳𝘁𝗲𝗿𝗻𝗼𝗼𝗻 ☀️';
            } else if (currentHour >= 16 && currentHour < 20) {
                return '𝗚𝗼𝗼𝗱 𝗘𝘃𝗲𝗻𝗶𝗻𝗴 🌇';
            } else {
                return '𝗚𝗼𝗼𝗱 𝗡𝗶𝗴𝗵𝘁 😴';
            }
        };


        const getCurrentTimeInNairobi = () => {
            return DateTime.now().setZone('Africa/Nairobi').toLocaleString(DateTime.TIME_SIMPLE);
        };
	  const date = new Date() 
if (badword === 'on' && isBotAdmin && !isAdmin && body && (new RegExp('\\b' + badwords.join('\\b|\\b') + '\\b')).test(body.toLowerCase())) {
            
     client.groupParticipantsUpdate(from, [sender], 'remove')
            reply("Hey niggah.\n\nMy owner hates usage of bad words in my presence!")
            
        
                                                   }
    if (antilink === 'on' && body.includes('chat.whatsapp.com') && !Owner && isBotAdmin && !isAdmin && m.isGroup) { 
  
 kid = m.sender; 
  
 client.sendMessage(m.chat, { 
  
                delete: { 
                   remoteJid: m.chat, 
                   fromMe: false, 
                   id: m.key.id, 
                   participant: kid 
                } 
             }).then(() => client.groupParticipantsUpdate(m.chat, [kid], 'remove')); 
 client.sendMessage(m.chat, {text:`𝗛𝗲𝘆 @${ki.split("@")[0]}👋\n\n𝗦𝗲𝗻𝗱𝗶𝗻𝗴 𝗚𝗿𝗼𝘂𝗽 𝗟𝗶𝗻𝗸𝘀 𝗶𝘀 𝗣𝗿𝗼𝗵𝗶𝗯𝗶𝘁𝗲𝗱 𝗶𝗻 𝘁𝗵𝗶𝘀 𝗚𝗿𝗼𝘂𝗽 !`, contextInfo:{mentionedJid:[kid]}}, {quoted:m}); 
       }   

if (antilinkall === 'on' && body.includes('https://') && !Owner && isBotAdmin && !isAdmin && m.isGroup) { 
  
 ki = m.sender; 
  
 client.sendMessage(m.chat, { 
  
                delete: { 
                   remoteJid: m.chat, 
                   fromMe: false, 
                   id: m.key.id, 
                   participant: ki
                } 
             }).then(() => client.groupParticipantsUpdate(m.chat, [ki], 'remove')); 
 client.sendMessage(m.chat, {text:`𝗛𝗲𝘆 @${ki.split("@")[0]}👋\n\n𝗦𝗲𝗻𝗱𝗶𝗻𝗴 𝗟𝗶𝗻𝗸𝘀 𝗶𝘀 𝗣𝗿𝗼𝗵𝗶𝗯𝗶𝘁𝗲𝗱 𝗶𝗻 𝘁𝗵𝗶𝘀 𝗚𝗿𝗼𝘂𝗽 !`, contextInfo:{mentionedJid:[ki]}}, {quoted:m}); 
       }   
  
  
  

    if (cmd && !m.isGroup) {
      console.log(chalk.black(chalk.bgWhite("[ RAVEN-AI ]")), color(argsLog, "turquoise"), chalk.magenta("From"), chalk.green(pushname), chalk.yellow(`[ ${m.sender.replace("@s.whatsapp.net", "")} ]`));
    } else if (cmd && m.isGroup) {
      console.log(
        chalk.black(chalk.bgWhite("[ LOGS ]")),
        color(argsLog, "turquoise"),
        chalk.magenta("From"),
        chalk.green(pushname),
        chalk.yellow(`[ ${m.sender.replace("@s.whatsapp.net", "")} ]`),
        chalk.blueBright("IN"),
        chalk.green(groupName)
      );
    }

    if (cmd && process.env.DEBUG_IDS === 'true') console.log('IDS', JSON.stringify({ fromMe: m.fromMe, sender: m.sender, key: mek.key, me: [...myIds], senderIds: [...senderAllIds], owner: Owner, itsMe, isAdmin }));
    if (cmd) {
      const handled = await handler.dispatch(command, client, m, {
          DevDreaded, Heroku, NotOwner, Owner, MainOwner: Owner, isSudo, admin, appname,
          args, author, botAdmin, botNumber, botname, budy,
          chatUpdate, command, dreadedspeed, from, getGreeting, group,
          groupMetadata, herokuapi, isAdmin, isBotAdmin, loading, mek,
          menu, menutype: menu, mime, mp3d, msgDreaded, mycode, packname,
          participants, prefix, pushname, qmsg, quoted, reply,
          runtime, sender, store, text, q: text,
        });
        if (!handled) {
        {
          if (cmd && budy.toLowerCase() != undefined) {
            if (m.chat.endsWith("broadcast")) return;
            if (m.isBaileys) return;
            if (!budy.toLowerCase()) return;
            if (argsLog || (cmd && !m.isGroup)) {
              // client.sendReadReceipt(m.chat, m.sender, [m.key.id])
              console.log(chalk.black(chalk.bgRed("[ ERROR ]")), color("command", "turquoise"), color(`${prefix}${command}`, "turquoise"), color("Raven", "turquoise"));
            } else if (argsLog || (cmd && m.isGroup)) {
              // client.sendReadReceipt(m.chat, m.sender, [m.key.id])
              console.log(chalk.black(chalk.bgRed("[ ERROR ]")), color("command", "turquoise"), color(`${prefix}${command}`, "turquoise"), color("Raven", "turquoise"));
            }
          }
        }
      }
    }
  } catch (err) {
    console.log(util.format(err));
  }
};

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});
 
  

/**
 * Pulse backend (Google Apps Script)
 *  • Live alerts: Bank of America alert emails → Finance → Live alerts
 *  • Device sync: keeps Pulse on your phone and PC in step (data saved in a file in your Google Drive,
 *    journal photos in a "Pulse photos" folder)
 *
 * Runs inside YOUR Google account (the Gmail that receives the BofA alerts, directly or forwarded).
 * It only reads Bank of America alert emails, only touches its own "pulse-sync.json" file in Drive,
 * and only answers requests that carry your private key.
 *
 * UPDATING FROM THE ALERTS-ONLY VERSION: paste this whole file over the old code → Save → run `setup`
 * once (it asks for one new permission, Google Drive) → Deploy → Manage deployments → pencil →
 * Version: New version → Deploy. The URL and key stay the same.
 *
 * ONE-TIME SETUP
 *  1. Bank of America app → Menu → Alerts → turn on email alerts for debit/credit card purchases
 *     (set the threshold to $0.01 so every purchase alerts), deposits, and Zelle.
 *  2. Go to https://script.google.com → New project → delete the sample code → paste this whole file → Save.
 *  3. In the function dropdown at the top pick `setup` → Run → approve the permissions
 *     (Google says the app "isn't verified" because it's your own private script:
 *      Advanced → Go to project → Allow).
 *     The log (View → Logs / Execution log) prints your DASHBOARD KEY and a few transactions it found.
 *  4. Deploy → New deployment → gear icon → Web app
 *        Execute as: Me
 *        Who has access: Anyone
 *     → Deploy → copy the Web app URL (ends in /exec).
 *  5. Dashboard → Finance → Live alerts → paste the Web app URL and the key → Connect.
 *  6. Sync: Pulse → Settings → Sync between devices → paste the same URL and key → Connect.
 *     Do this on your PC first, then on your phone.
 *
 * If you edit this file later: Deploy → Manage deployments → pencil → Version: New version → Deploy
 * (the URL stays the same).
 *
 * If an alert isn't picked up: run `debugLatest` and send the logged text (you can blank out names).
 * To change the key (e.g. if you shared the link by accident): run `resetKey`, then update the dashboard.
 */

// Matches alerts sent straight from BofA and ones you forward from another Gmail.
const SEARCH = '(from:bankofamerica.com OR "bankofamerica.com" OR "Bank of America")';

// Bank of America emails that are never transactions.
const NOT_TRANSACTIONS = /statement|password|passcode|sign[- ]?in|log ?in|security code|verify|verification|profile|e-?bill|document|privacy|survey|offer|rewards|new device|update your|contact information|card is on its way|travel notice/i;

const DEFAULT_DAYS = 14;
const MAX_THREADS = 300;

/* ---------------- Setup helpers (run from the editor) ---------------- */

function setup() {
  const key = getKey_(true);
  syncFile_();    // creates pulse-sync.json in your Drive (and asks for the Drive permission)
  photoFolder_(); // creates the "Pulse photos" folder for journal photos
  const sample = collect_(DEFAULT_DAYS);
  Logger.log('DASHBOARD KEY (paste into Finance → Live alerts):\n' + key);
  Logger.log('Found ' + sample.txns.length + ' transaction alerts in the last ' + DEFAULT_DAYS + ' days' +
    (sample.unparsed.length ? '; ' + sample.unparsed.length + ' alert emails could not be read (run debugLatest).' : '.'));
  sample.txns.slice(0, 8).forEach(t => Logger.log(t.date + '  ' + (t.amount > 0 ? '+' : '') + t.amount.toFixed(2) + '  ' + t.merchant));
}

function resetKey() {
  PropertiesService.getScriptProperties().deleteProperty('DASHBOARD_KEY');
  Logger.log('New DASHBOARD KEY:\n' + getKey_(true));
}

// Prints the 3 most recent Bank of America emails so the parser can be tuned to your exact format.
function debugLatest() {
  const threads = GmailApp.search(SEARCH + ' newer_than:30d', 0, 10);
  let shown = 0;
  threads.forEach(thread => thread.getMessages().forEach(msg => {
    if (shown >= 3) return;
    shown++;
    Logger.log('=== ' + msg.getDate() + '\nSUBJECT: ' + msg.getSubject() + '\nFROM: ' + msg.getFrom() + '\n' +
      msg.getPlainBody().replace(/\d{9,}/g, '•••').slice(0, 1500));
    Logger.log('PARSED AS: ' + JSON.stringify(parse_(msg.getSubject(), msg.getPlainBody(), msg.getDate(), Session.getScriptTimeZone())));
  }));
  if (!shown) Logger.log('No Bank of America emails found in the last 30 days. Check the alerts are going to this Gmail account.');
}

/* ---------------- Web app endpoint (called by the dashboard) ---------------- */

function doGet(e) {
  const params = (e && e.parameter) || {};
  const key = getKey_(false);
  if (!key || params.key !== key) {
    return json_({ ok: false, error: 'Wrong or missing key. Run setup() in the script and copy the key again.' });
  }
  if (params.action === 'pull') return json_(syncPull_(params.since));
  if (params.action === 'image') return json_(getImage_(params.id));
  const days =Math.min(90, Math.max(1, parseInt(params.days, 10) || DEFAULT_DAYS));
  const cache = CacheService.getScriptCache();
  const cacheKey = 'txns_' + days;
  const cached = cache.get(cacheKey);
  if (cached) return text_(cached);
  const body = JSON.stringify(collect_(days));
  if (body.length < 95000) cache.put(cacheKey, body, 45);
  return text_(body);
}

// Pulse sends sync changes here as a plain-text JSON body: { key, action: 'push', changes: { [name]: { v, t } } }
function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Bad request.' });
  }
  const key = getKey_(false);
  if (!key || body.key !== key) return json_({ ok: false, error: 'Wrong or missing key.' });
  if (body.action === 'push') return json_(syncPush_(body.changes));
  if (body.action === 'putImage') return json_(putImage_(body.id, body.data));
  if (body.action === 'deleteImage') return json_(deleteImage_(body.id));
  return json_({ ok: false, error: 'Unknown action.' });
}

/* ---------------- Journal photos ----------------
   Each photo is one file named by its id in a "Pulse photos" folder in your Drive. */

function photoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PHOTO_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (err) { /* deleted — make a new one */ }
  }
  const folder = DriveApp.createFolder('Pulse photos');
  props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}

const validPhotoId_ = id => typeof id === 'string' && /^[a-z0-9]{4,64}$/i.test(id);

function putImage_(id, dataUrl) {
  if (!validPhotoId_(id)) return { ok: false, error: 'Bad photo id.' };
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) return { ok: false, error: 'Bad photo data.' };
  const folder = photoFolder_();
  const existing = folder.getFilesByName(id);
  while (existing.hasNext()) existing.next().setTrashed(true);
  folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], id));
  return { ok: true };
}

function getImage_(id) {
  if (!validPhotoId_(id)) return { ok: false, error: 'Bad photo id.' };
  const files = photoFolder_().getFilesByName(id);
  if (!files.hasNext()) return { ok: false, error: 'Photo not found.', missing: true };
  const blob = files.next().getBlob();
  return { ok: true, data: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
}

function deleteImage_(id) {
  if (!validPhotoId_(id)) return { ok: false, error: 'Bad photo id.' };
  const files = photoFolder_().getFilesByName(id);
  while (files.hasNext()) files.next().setTrashed(true);
  return { ok: true };
}

/* ---------------- Device sync ----------------
   One JSON file in your Drive holds every synced setting: { version, keys: { name: { v: text|null, t: ms } } }.
   Each piece (today's goals, the trade journal, finance, …) keeps the newest copy by timestamp;
   null means it was deleted. `version` goes up on every change so devices can skip unchanged pulls. */

function syncFile_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SYNC_FILE_ID');
  if (id) {
    try { return DriveApp.getFileById(id); } catch (err) { /* deleted — make a new one */ }
  }
  const file = DriveApp.createFile('pulse-sync.json', JSON.stringify({ version: 0, keys: {} }), 'application/json');
  props.setProperty('SYNC_FILE_ID', file.getId());
  return file;
}

function readSync_() {
  try {
    const doc = JSON.parse(syncFile_().getBlob().getDataAsString());
    return { version: doc.version || 0, keys: doc.keys || {} };
  } catch (err) {
    return { version: 0, keys: {} };
  }
}

function syncPull_(since) {
  const doc = readSync_();
  if (since !== undefined && since !== '' && Number(since) === doc.version) {
    return { ok: true, version: doc.version, unchanged: true };
  }
  return { ok: true, version: doc.version, keys: doc.keys };
}

function syncPush_(changes) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const doc = readSync_();
    let accepted = 0;
    Object.keys(changes || {}).forEach(name => {
      const c = changes[name];
      if (!c || typeof c.t !== 'number') return;
      const current = doc.keys[name];
      if (!current || c.t >= current.t) {
        doc.keys[name] = { v: typeof c.v === 'string' ? c.v : null, t: c.t };
        accepted++;
      }
    });
    if (accepted) {
      doc.version += 1;
      syncFile_().setContent(JSON.stringify(doc));
    }
    return { ok: true, version: doc.version, accepted: accepted };
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- Gmail → transactions ---------------- */

function collect_(days) {
  const tz = Session.getScriptTimeZone();
  const threads = GmailApp.search(SEARCH + ' newer_than:' + days + 'd', 0, MAX_THREADS);
  const txns = [];
  const unparsed = [];
  const seen = {};
  threads.forEach(thread => thread.getMessages().forEach(msg => {
    const id = msg.getId();
    if (seen[id]) return;
    seen[id] = true;
    const subject = msg.getSubject() || '';
    const body = msg.getPlainBody() || '';
    if (!/bank ?of ?america|bankofamerica/i.test(msg.getFrom() + '\n' + body)) return;
    if (NOT_TRANSACTIONS.test(subject)) return;
    const tx = parse_(subject, body, msg.getDate(), tz);
    if (tx) {
      tx.id = id;
      txns.push(tx);
    } else if (/transaction|purchase|deposit|zelle|payment|withdrawal|transfer|charge|refund|credit|debit/i.test(subject)) {
      unparsed.push({ id: id, date: Utilities.formatDate(msg.getDate(), tz, 'yyyy-MM-dd'), subject: subject });
    }
  }));
  txns.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { ok: true, generated: new Date().toISOString(), txns: txns, unparsed: unparsed.slice(0, 25) };
}

// Reads "Label: value" lines, e.g. "Amount: $25.00", "Where: SAFEWAY #0219".
function field_(text, labels) {
  for (let i = 0; i < labels.length; i++) {
    const re = new RegExp('(?:^|\\n)[ \\t*>]*' + labels[i] + '[ \\t]*:?[ \\t]*([^\\n]+)', 'i');
    const m = text.match(re);
    if (m && m[1].trim()) return m[1].trim();
  }
  return '';
}

function parse_(subject, body, sentAt, tz) {
  const text = String(body || '').replace(/\r/g, '').replace(/ /g, ' ');
  const subj = String(subject || '');
  const all = (subj + '\n' + text).toLowerCase();

  // Amount: prefer an "Amount:" line, otherwise the first dollar figure in the subject or body.
  const amountLine = field_(text, ['Amount', 'Transaction amount', 'Purchase amount', 'Deposit amount', 'Payment amount', 'Transfer amount']);
  const m = (amountLine.match(/\$?\s*([\d,]+\.\d{2})/)) || (subj + '\n' + text).match(/\$\s?([\d,]+\.\d{2})/);
  if (!m) return null;
  const amount = parseFloat(m[1].replace(/,/g, ''));
  if (!amount) return null;

  // Direction: decide from the subject first, then the body.
  const isIn = s => /deposit|you received|received money|money received|was credited|refund|direct dep|incoming|credit(?! card)/.test(s);
  const isOut = s => /purchase|you sent|was sent|sent money|withdrawal|debit card|credit card|payment to|charge|transaction/.test(s);
  const s = subj.toLowerCase();
  let incoming = isIn(s) && !/you sent|was sent|sent money/.test(s);
  if (!isIn(s) && !isOut(s)) incoming = isIn(all) && !isOut(all);

  // Who / where.
  let merchant = field_(text, ['Where', 'Merchant', 'Merchant name', 'Description', 'Location', 'At']);
  const zelle = /zelle/.test(all);
  if (!merchant || zelle) {
    const who = field_(text, incoming ? ['From', 'Sender', 'Sent by', 'Received from'] : ['To', 'Recipient', 'Sent to', 'Paid to']);
    const fromSubject = subj.match(incoming ? /\bfrom\s+(.+?)\s*$/i : /\bto\s+(.+?)\s*$/i);
    const name = (who && !/@|bank of america/i.test(who) ? who : '') || (fromSubject ? fromSubject[1] : '');
    if (zelle) merchant = 'Zelle payment ' + (incoming ? 'from ' : 'to ') + (name || 'someone');
    else if (!merchant) merchant = name;
  }
  if (!merchant) {
    const at = subj.match(/\bat\s+(.+?)\s*$/i);
    merchant = at ? at[1] : (incoming ? 'Deposit' : subj);
  }
  if (incoming && !zelle && /deposit/.test(all) && !/refund/.test(all)) merchant = /atm/.test(all) ? 'ATM deposit' : merchant || 'Deposit';

  // Date: the alert's own "Date:" line, else when the email arrived.
  let when = sentAt;
  let dateLine = field_(text, ['Date', 'Transaction date', 'Posted date', 'Date posted']);
  if (!dateLine) {
    // Sentence style: "…was made to your account on September 28, 2026."
    const inline = text.match(/\bon\s+([A-Z][a-z]+\.? \d{1,2},? \d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (inline) dateLine = inline[1];
  }
  if (dateLine) {
    const parsed = new Date(dateLine.replace(/\s+at\s+.*$/i, '').replace(/(\d)(st|nd|rd|th)\b/, '$1'));
    if (!isNaN(parsed)) when = parsed;
  }

  const acct = all.match(/ending in\s*(\d{4})/);
  return {
    date: Utilities.formatDate(when, tz, 'yyyy-MM-dd'),
    amount: incoming ? amount : -amount,
    merchant: String(merchant).replace(/\d{9,}/g, '').trim().slice(0, 120),
    account: acct ? acct[1] : '',
    subject: subj.slice(0, 140),
    received: sentAt.toISOString()
  };
}

/* ---------------- Utilities ---------------- */

function getKey_(create) {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('DASHBOARD_KEY');
  if (!key && create) {
    key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('DASHBOARD_KEY', key);
  }
  return key;
}

function text_(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}

function json_(obj) {
  return text_(JSON.stringify(obj));
}

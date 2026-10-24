/* =====================================================================
   AI LEGAL ASSISTANT FOR RURAL RIGHTS - backend (server.js)

   What this file does, in plain words:
   1. On start-up it reads every PDF / TXT file inside the "knowledge" folder.
   2. It cuts the text into small pieces ("chunks") and turns each piece into
      numbers ("embeddings") using a free local AI model (bge-m3 via Ollama).
      The numbers are saved in cache.json so the next start-up is instant.
   3. When someone asks a question, it finds the 4 most similar chunks
      (this is called RAG = Retrieval Augmented Generation).
   4. It gives those chunks + the question to a free local chat model
      (e.g. gemma3:4b via Ollama) and sends the answer back to the website.

   Everything runs on your own computer. Cost = 0 rupees.
===================================================================== */

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
// We import the inner file because pdf-parse@1.1.1 has a known start-up bug otherwise.
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const { ChatOllama, OllamaEmbeddings } = require('@langchain/ollama');

/* ---------------------------------------------------------------------
   ✏️ EDIT HERE #1 - Settings.
   Most of these can also be changed in the .env file without touching code.
--------------------------------------------------------------------- */
const CONFIG = {
  port: Number(process.env.PORT) || 3000,
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',

  // The chat model that writes the answers.
  // gemma3:4b  -> works on 8 GB RAM laptops, decent Hindi
  // gemma3:12b -> better Hindi, needs ~16 GB RAM
  // llama3.1:8b -> good English, average Hindi
  chatModel: process.env.CHAT_MODEL || 'gemma3:1b',

  // The model that understands meaning for searching. bge-m3 is multilingual (Hindi + English).
  embedModel: process.env.EMBED_MODEL || 'bge-m3',

  knowledgeDir: path.join(__dirname, 'knowledge'),   // put your PDFs here
  publicDir: path.join(__dirname, 'frontend'),       // your index.html, style.css, script.js live here
  cacheFile: path.join(__dirname, 'cache.json'),

  chunkSize: 1000,      // characters per chunk. Bigger = more context, slower.
  chunkOverlap: 150,    // characters shared between neighbouring chunks
  topK: Number(process.env.TOP_K) || 2,   // how many document pieces the AI reads per question. LESS = MUCH FASTER (try 2 to 4)
  temperature: 0.1,     // 0 = very strict/factual, 1 = creative. Keep low for legal info.
  maxQuestionLength: 500,

  keepAlive: process.env.KEEP_ALIVE || '30m',  // keep the models loaded in memory so answers start faster
  maxAnswerTokens: 300,                         // upper limit on answer length (smaller = faster)
  maxChunkChars: Number(process.env.MAX_CHUNK_CHARS) || 700,   // each piece is trimmed to this many characters before sending (smaller = faster)
  numCtx: 3072,                                 // memory window of the AI in tokens (smaller = faster, less RAM)

  // STRICT MODE: a document piece must match the question at least this well (0 to 1).
  // If nothing reaches it, the AI is NOT called and the reply is "not in the documents".
  // Higher = stricter (more "not found"), lower = more answers. Look at the "match scores" line
  // in the terminal after each question to choose a good value. Can also be set as MIN_SCORE in .env
  minScore: Number(process.env.MIN_SCORE) || 0.40,

  // TWO-LEVEL GATE (see the "Topic guide" below):
  //   best score below MIN_SCORE      -> always "not in documents"
  //   best score above SURE_SCORE     -> always answer
  //   best score in between (grey zone) -> the Topic guide decides (is it a land/rights/scheme question,
  //                                        or an off-topic one such as politics, sports, weather?)
  sureScore: Number(process.env.SURE_SCORE) || 0.50,
  // How much closer to the "blocked" examples than to the "allowed" ones a question must be to be refused.
  // 0 = refuse if it is even slightly closer to blocked. Raise (e.g. 0.03) if good questions get refused.
  topicMargin: Number(process.env.TOPIC_MARGIN) || 0,
  topicFile: path.join(__dirname, 'topic-examples.json')
};

/* ---------------------------------------------------------------------
   ✏️ EDIT HERE #2 - The AI's instructions (the "system prompt").
   This is the most powerful place to improve your project.
   Change tone, add rules, add helpline names, etc.
--------------------------------------------------------------------- */
function buildSystemPrompt(language) {
  const preferred = language === 'en' ? 'English' : 'Hindi (Devanagari script)';
  return `You are "Gramin Adhikar Sahayak", a helpful assistant that explains land rights, government schemes and basic resources to villagers and farmers in India.

RULES:
1. You know NOTHING except the text inside CONTEXT. Never use your own knowledge. Do not answer general-knowledge questions (politicians, news, history, sports, etc.). Do not invent laws, section numbers, amounts, deadlines or phone numbers.
2. If the CONTEXT does not clearly contain the answer to the question, reply with exactly this one word and nothing else: NOT_FOUND
3. LANGUAGE: Write the whole answer in ${preferred}. Even if the CONTEXT is in English, you must translate the facts into ${preferred}. If the person speaks a local dialect (Bhojpuri, Awadhi, Braj, Haryanvi, etc.), reply in very simple Hindi.
4. Use very simple, short sentences and everyday village words. Avoid legal jargon; if you must use a legal term, explain it in simple words.
5. ANSWER ONLY WHAT IS ASKED. If the question is "how", give only the steps or rules of that process. Do NOT add background, importance, benefits, history, general advice or a conclusion. Do NOT repeat the question.
6. Format: give only as many bullet points as needed (1 to 4), each under 25 words. Never add extra points just to make the list longer. Start directly with the first bullet; no introduction sentence. Each bullet starts with "- ". No headings, no bold, no tables, no markdown symbols other than the leading "- ".
7. Be polite and respectful. You are not a lawyer; for serious disputes suggest meeting a legal-aid centre.`;
}

// Small models forget instructions given at the start, so we repeat the language rule at the very end.
function languageReminder(language) {
  return language === 'en'
    ? 'IMPORTANT: Write your answer ONLY in English, as 1 to 4 short bullet points starting with "- ". Answer only what the question asks: no background, no importance, no extra advice. No introduction sentence. Use ONLY the CONTEXT. If the CONTEXT does not clearly answer the question, write only: NOT_FOUND'
    : 'IMPORTANT: अपना उत्तर केवल हिंदी (देवनागरी लिपि) में लिखें, सरल शब्दों में। ज़रूरत के अनुसार 1 से 4 छोटे बिंदु लिखें (हर बिंदु 25 शब्दों से कम), सिर्फ़ वही बताएँ जो पूछा गया है; महत्व, पृष्ठभूमि या अतिरिक्त सलाह न लिखें, हर बिंदु "- " से शुरू हो। भूमिका वाला वाक्य न लिखें। अंग्रेज़ी में न लिखें। केवल CONTEXT की जानकारी से उत्तर दें; यदि उत्तर CONTEXT में स्पष्ट नहीं है तो सिर्फ़ यह लिखें: NOT_FOUND';
}

/* ---------------------------------------------------------------------
   Part 1 - Reading documents and cutting them into chunks
--------------------------------------------------------------------- */
function splitText(text, size, overlap) {
  const clean = text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);

    // try to end the chunk at a natural break (new line, Hindi danda "।" or full stop)
    if (end < clean.length) {
      const breakAt = Math.max(
        clean.lastIndexOf('\n', end),
        clean.lastIndexOf('। ', end),
        clean.lastIndexOf('. ', end)
      );
      if (breakAt > start + size * 0.5) end = breakAt + 1;
    }

    const piece = clean.slice(start, end).trim();
    if (piece.length > 50) chunks.push(piece);
    if (end >= clean.length) break;
    start = end - overlap;
  }
  return chunks;
}

async function readFileText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text || '';
  }
  return fs.readFileSync(filePath, 'utf8'); // .txt or .md
}

/* ---------------------------------------------------------------------
   Part 2 - Our tiny "vector database" (just an array in memory)
--------------------------------------------------------------------- */
const embeddings = new OllamaEmbeddings({
  model: CONFIG.embedModel,
  baseUrl: CONFIG.ollamaUrl,
  keepAlive: CONFIG.keepAlive
});
const chat = new ChatOllama({
  model: CONFIG.chatModel,
  baseUrl: CONFIG.ollamaUrl,
  temperature: CONFIG.temperature,
  keepAlive: CONFIG.keepAlive,
  numPredict: CONFIG.maxAnswerTokens,
  numCtx: CONFIG.numCtx
});

let store = [];            // [{ source, text, vector }]
let ready = false;

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

async function retrieve(question) {
  const qVec = await embeddings.embedQuery(question);
  const top = store
    .map((c) => ({ ...c, score: cosineSimilarity(qVec, c.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CONFIG.topK);
  return { top, qVec };
}

/* ---------------------------------------------------------------------
   Topic guide: decides borderline questions.
   topic-examples.json holds example questions the assistant SHOULD answer ("allowed")
   and ones it should REFUSE ("blocked"). We compare the new question with both lists.
   To teach it: if a bad question gets answered, add it to "blocked";
   if a good question gets refused, add it to "allowed". Then restart the server.
--------------------------------------------------------------------- */
let topicGuide = { allowed: [], blocked: [] };

async function loadTopicGuide() {
  if (!fs.existsSync(CONFIG.topicFile)) {
    console.warn('⚠️  topic-examples.json not found - borderline questions will be decided by score only.');
    return;
  }
  const data = JSON.parse(fs.readFileSync(CONFIG.topicFile, 'utf8'));
  const embedList = async (list) => {
    if (!Array.isArray(list) || list.length === 0) return [];
    const vectors = await embeddings.embedDocuments(list);
    return list.map((text, i) => ({ text, vector: vectors[i] }));
  };
  topicGuide.allowed = await embedList(data.allowed);
  topicGuide.blocked = await embedList(data.blocked);
  console.log(`🧭 Topic guide ready: ${topicGuide.allowed.length} allowed and ${topicGuide.blocked.length} blocked examples.`);
}

function topicVote(qVec) {
  const closest = (list) => list.reduce((best, a) => {
    const sim = cosineSimilarity(qVec, a.vector);
    return sim > best.sim ? { sim, text: a.text } : best;
  }, { sim: -1, text: '' });
  return { allowed: closest(topicGuide.allowed), blocked: closest(topicGuide.blocked) };
}

/* ---------------------------------------------------------------------
   Part 3 - Building (or loading) the knowledge base
--------------------------------------------------------------------- */
async function buildKnowledgeBase() {
  if (!fs.existsSync(CONFIG.knowledgeDir)) fs.mkdirSync(CONFIG.knowledgeDir);

  const files = fs.readdirSync(CONFIG.knowledgeDir)
    .filter((f) => /\.(pdf|txt|md)$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.warn('⚠️  No documents found. Put your PDFs inside the "knowledge" folder and restart.');
    store = [];
    return;
  }

  // The "signature" changes if you add/replace a file or change the embedding model.
  const signature = JSON.stringify({
    model: CONFIG.embedModel,
    chunk: [CONFIG.chunkSize, CONFIG.chunkOverlap],
    files: files.map((f) => [f, fs.statSync(path.join(CONFIG.knowledgeDir, f)).size])
  });

  if (fs.existsSync(CONFIG.cacheFile)) {
    try {
      const cache = JSON.parse(fs.readFileSync(CONFIG.cacheFile, 'utf8'));
      if (cache.signature === signature) {
        store = cache.chunks;
        console.log(`✅ Loaded ${store.length} chunks from cache.json (fast start).`);
        return;
      }
    } catch (e) { /* cache is broken - rebuild below */ }
  }

  console.log('📚 Reading documents and building the knowledge base (first time only, may take a few minutes)...');
  const chunks = [];
  for (const file of files) {
    const text = await readFileText(path.join(CONFIG.knowledgeDir, file));
    console.log(`   - ${file}: ${text.length} characters read`);
    if (text.length < 200) {
      console.warn(`     ⚠️  Very little text found in ${file}. It may be a scanned PDF (images). Use an OCR'd or text version.`);
    }
    splitText(text, CONFIG.chunkSize, CONFIG.chunkOverlap).forEach((piece) => {
      chunks.push({ source: file, text: piece });
    });
  }

  // Turn chunks into numbers, a few at a time, so we can show progress.
  const BATCH = 16;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const vectors = await embeddings.embedDocuments(batch.map((c) => c.text));
    batch.forEach((c, j) => { c.vector = vectors[j]; });
    console.log(`   embedded ${Math.min(i + BATCH, chunks.length)} / ${chunks.length}`);
  }

  store = chunks;
  fs.writeFileSync(CONFIG.cacheFile, JSON.stringify({ signature, chunks }));
  console.log(`✅ Knowledge base ready: ${store.length} chunks saved to cache.json`);
}

/* ---------------------------------------------------------------------
   Part 4 - The web server
--------------------------------------------------------------------- */
const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(express.static(CONFIG.publicDir));   // serves frontend/index.html, style.css, script.js

// Tells the website which documents are loaded (shown in the sidebar)
app.get('/api/sources', (req, res) => {
  const counts = {};
  store.forEach((c) => { counts[c.source] = (counts[c.source] || 0) + 1; });
  res.json({ sources: Object.entries(counts).map(([name, chunks]) => ({ name, chunks })) });
});

// Quick health check: open http://localhost:3000/api/health in the browser
app.get('/api/health', (req, res) => {
  res.json({ ok: true, ready, chatModel: CONFIG.chatModel, embedModel: CONFIG.embedModel, chunks: store.length });
});

// Helper: turns the AI's message content into plain text
function contentToText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p) => p.text || '').join('');
  return '';
}

// Helper: converts a technical error into a message a normal person understands
function friendlyError(err) {
  const msg = (err && err.message) || '';
  if (/ECONNREFUSED|fetch failed/i.test(msg)) {
    return { status: 503, message: 'The local AI (Ollama) is not running. Start the Ollama app and try again.' };
  }
  if (/not found/i.test(msg)) {
    return { status: 503, message: `AI model not found. Run in the terminal: ollama pull ${CONFIG.chatModel}` };
  }
  return { status: 500, message: 'Something went wrong while answering. Please try again.' };
}

// Helper: prints how long each step took, so you can see where the time goes
function logTimings(info) {
  const m = info.meta || {};
  const rate = m.eval_count && m.eval_duration ? (m.eval_count / (m.eval_duration / 1e9)).toFixed(1) : '?';
  console.log(
    `⏱  search ${info.retrievalMs} ms | first word ${info.firstTokenMs ?? '?'} ms | total ${info.totalMs} ms` +
    ` | prompt tokens ${m.prompt_eval_count ?? '?'} | answer tokens ${m.eval_count ?? '?'} | speed ${rate} tokens/sec`
  );
}

/* ---------------------------------------------------------------------
   ✏️ EDIT HERE #3 - The reply shown when the answer is NOT in your PDFs.
   Change the wording or add your local helpline / office name.
--------------------------------------------------------------------- */
function notFoundMessage(language) {
  return language === 'en'
    ? '- Sorry, I could not find this information in the official documents I have.\n- Please ask at your Tehsil office, Patwari/Lekhpal, Gram Panchayat or the nearest Legal Services Authority.'
    : '- माफ़ कीजिए, यह जानकारी मेरे पास मौजूद सरकारी दस्तावेज़ों में नहीं मिली।';
}

// The AI is told to write NOT_FOUND when the documents do not contain the answer.
function isNotFound(text) {
  return /^\s*NOT[_\s-]?FOUND/i.test(text || '');
}

// Shared by both endpoints: checks the question, searches the PDFs, builds the messages for the AI.
async function prepareQuestion(body) {
  const question = String(body.question || '').trim();
  const toggle = body.language === 'en' ? 'en' : 'hi';
  // If the question contains Hindi letters (Devanagari), always answer in Hindi.
  // Otherwise follow the Hindi/English toggle on the website.
  const language = /[\u0900-\u097F]/.test(question) ? 'hi' : toggle;

  if (!question) return { status: 400, error: 'Question is empty.' };
  if (question.length > CONFIG.maxQuestionLength) {
    return { status: 400, error: `Question is too long (max ${CONFIG.maxQuestionLength} characters).` };
  }
  if (!ready || store.length === 0) {
    return { status: 503, error: 'Knowledge base is empty. Add PDFs to the "knowledge" folder and restart the server.' };
  }

  // 1) find the most similar parts of the official documents
  const t0 = Date.now();
  const { top, qVec } = await retrieve(question);
  const retrievalMs = Date.now() - t0;
  console.log('🔎 match scores: ' + top.map((c) => `${c.score.toFixed(2)} (${c.source})`).join(' | '));

  // 2) GATE: keep only pieces that really match. If nothing matches well, we do not even
  //    call the AI, so it has no chance to answer from its own memory.
  const relevant = top.filter((c) => c.score >= CONFIG.minScore);
  const best = top.length ? top[0].score : 0;

  if (relevant.length === 0) {
    console.log(`🚫 Best score ${best.toFixed(2)} is below MIN_SCORE=${CONFIG.minScore} -> answering "not in documents".`);
    return { language, notFound: true, retrievalMs, sources: [] };
  }

  // Grey zone: the match is OK but not great. Ask the Topic guide whether this is an on-topic question.
  if (best < CONFIG.sureScore && topicGuide.allowed.length && topicGuide.blocked.length) {
    const vote = topicVote(qVec);
    console.log(
      `🧭 Grey zone (best ${best.toFixed(2)}): closest ALLOWED ${vote.allowed.sim.toFixed(2)} "${vote.allowed.text}"` +
      ` | closest BLOCKED ${vote.blocked.sim.toFixed(2)} "${vote.blocked.text}"`
    );
    if (vote.blocked.sim - vote.allowed.sim > CONFIG.topicMargin) {
      console.log('🚫 The question looks off-topic -> answering "not in documents".');
      return { language, notFound: true, retrievalMs, sources: [] };
    }
  }

  const context = relevant
    .map((c, i) => `[Part ${i + 1} | ${c.source}]\n${c.text.slice(0, CONFIG.maxChunkChars)}`)
    .join('\n\n---\n\n');

  // 3) the messages we will give to the local AI
  const messages = [
    ['system', buildSystemPrompt(language)],
    ['human', `CONTEXT:\n${context}\n\nQUESTION:\n${question}\n\n${languageReminder(language)}`]
  ];

  return { language, messages, retrievalMs, sources: [...new Set(relevant.map((c) => c.source))] };
}

// Endpoint 1: STREAMING (used by the website). Words appear on screen as the AI writes them,
// so the person starts reading after a few seconds instead of waiting for the full answer.
app.post('/api/ask-stream', async (req, res) => {
  let prep;
  try {
    prep = await prepareQuestion(req.body);
  } catch (err) {
    console.error('Error while searching:', err.message);
    const f = friendlyError(err);
    return res.status(f.status).json({ error: f.message });
  }
  if (prep.error) return res.status(prep.status).json({ error: prep.error });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  // Nothing in the PDFs matches the question -> say so, without calling the AI at all
  if (prep.notFound) {
    send({ type: 'sources', sources: [] });
    send({ type: 'token', text: notFoundMessage(prep.language) });
    send({ type: 'done' });
    return res.end();
  }

  // If the person closes the page, stop the AI immediately (saves your computer's power)
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  const started = Date.now();
  let firstTokenMs = null;
  let meta = null;

  try {
    const stream = await chat.stream(prep.messages, { signal: controller.signal });

    // We hold back the first few characters to check whether the AI wrote NOT_FOUND.
    let held = '';
    let decided = false;
    let refused = false;

    for await (const chunk of stream) {
      if (chunk.response_metadata && Object.keys(chunk.response_metadata).length) meta = chunk.response_metadata;
      const text = contentToText(chunk.content);
      if (!text) continue;

      if (!decided) {
        held += text;
        if (held.trim().length < 10) continue;      // not enough characters yet to decide
        decided = true;
        if (isNotFound(held)) { refused = true; break; }
        send({ type: 'sources', sources: prep.sources });
        firstTokenMs = Date.now() - started;
        send({ type: 'token', text: held });
      } else {
        send({ type: 'token', text });
      }
    }

    // Very short answers end before 10 characters were collected
    if (!decided && !refused) {
      if (isNotFound(held)) refused = true;
      else if (held.trim()) {
        send({ type: 'sources', sources: prep.sources });
        send({ type: 'token', text: held });
      }
    }

    if (refused) {
      console.log('🚫 The AI said NOT_FOUND -> answering "not in documents".');
      send({ type: 'sources', sources: [] });
      send({ type: 'token', text: notFoundMessage(prep.language) });
    }

    send({ type: 'done' });
    logTimings({ retrievalMs: prep.retrievalMs, firstTokenMs, totalMs: Date.now() - started, meta });
  } catch (err) {
    if (!controller.signal.aborted) {
      console.error('Error in /api/ask-stream:', err.message);
      send({ type: 'error', error: friendlyError(err).message });
    }
  }
  res.end();
});

// Endpoint 2: NORMAL (waits for the full answer, then replies once). Kept for testing.
app.post('/api/ask', async (req, res) => {
  try {
    const prep = await prepareQuestion(req.body);
    if (prep.error) return res.status(prep.status).json({ error: prep.error });
    if (prep.notFound) return res.json({ answer: notFoundMessage(prep.language), sources: [] });

    const started = Date.now();
    const result = await chat.invoke(prep.messages);
    logTimings({
      retrievalMs: prep.retrievalMs, firstTokenMs: null, totalMs: Date.now() - started,
      meta: result.response_metadata
    });

    const text = contentToText(result.content).trim();
    if (isNotFound(text)) return res.json({ answer: notFoundMessage(prep.language), sources: [] });

    // If the model still adds an intro line ending with ":", remove it.
    let lines = text.split('\n');
    if (lines.length > 2 && !/^\s*[-*•]/.test(lines[0]) && /[:：]\s*$/.test(lines[0].trim())) lines = lines.slice(1);

    res.json({ answer: lines.join('\n').trim(), sources: prep.sources });
  } catch (err) {
    console.error('Error in /api/ask:', err.message);
    const f = friendlyError(err);
    res.status(f.status).json({ error: f.message });
  }
});

// Loading an AI model from disk can take 1-2 minutes on a normal laptop.
// We do it once at start-up, so the FIRST question during your demo is not slow.
// Wait for the "Models ready" message in the terminal before asking your first question.
async function warmUp() {
  try {
    const t0 = Date.now();
    console.log('🔥 Loading the AI models into memory (this can take 1-2 minutes, only once)...');
    await embeddings.embedQuery('warm up');
    await chat.invoke([['human', 'Hi']]);
    console.log(`✅ Models ready (took ${Math.round((Date.now() - t0) / 1000)} s). You can ask questions now.`);
  } catch (err) {
    console.warn('⚠️  Warm-up skipped:', err.message);
  }
}

/* ---------------------------------------------------------------------
   Start everything
--------------------------------------------------------------------- */
(async () => {
  try {
    await buildKnowledgeBase();
    await loadTopicGuide().catch((e) => console.warn('⚠️  Topic guide skipped:', e.message));
    ready = true;
  } catch (err) {
    console.error('❌ Could not build the knowledge base:', err.message);
    console.error('   Is Ollama running? Did you run: ollama pull ' + CONFIG.embedModel + ' ?');
  }
  app.listen(CONFIG.port, () => {
    console.log(`🚀 Open http://localhost:${CONFIG.port} in Google Chrome`);
    warmUp();   // load both AI models into memory right now, in the background
  });
})();
/* =====================================================================
   AI LEGAL ASSISTANT FOR RURAL RIGHTS - script.js

   Look for the "✏️ EDIT HERE" comments: these are the safe places to
   change text, language codes, speech speed, URLs, etc.
===================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------
     ✏️ EDIT HERE #1 - Basic settings
  ------------------------------------------------------------------ */
  const CONFIG = {
    USE_STREAMING: true,            // true = words appear while the AI writes (feels much faster); false = wait for full answer
    STREAM_URL: '/api/ask-stream',  // backend endpoint for streaming answers
    API_URL: '/api/ask',            // backend endpoint for normal (non-streaming) answers
    SOURCES_URL: '/api/sources',    // backend endpoint that lists the loaded documents
    REQUEST_TIMEOUT_MS: 180000,     // give up if the AI is completely silent for this long (3 minutes)
    AUTO_SPEAK: true,               // speak every answer out loud automatically
    SPEECH_RATE: 0.95,              // 0.5 = slow, 1 = normal, 1.5 = fast
    DEFAULT_LANG: 'hi',             // 'hi' or 'en' - language when the page opens
    FONT_SIZES: [100, 115, 130],    // text size steps (in %) for the "A A" button
    // Language codes used by the browser's voice engines.
    // Add another Indian language later, e.g. 'ta-IN' for Tamil.
    LANGS: {
      hi: { recog: 'hi-IN', tts: 'hi-IN' },
      en: { recog: 'en-IN', tts: 'en-IN' }
    }
  };

  /* ------------------------------------------------------------------
     ✏️ EDIT HERE #2 - Knowledge base tokens shown in the sidebar.
     Put your 2 real document names here. If the backend is running it
     replaces these automatically with the real PDF file names.
  ------------------------------------------------------------------ */
  let KNOWLEDGE_BASE = [
    { name: 'manual-for-legal-rights.pdf', detail: 'Official government document' },
    { name: 'OPERATIONAL-GUIDELINES.pdf', detail: 'Official government document' }
  ];

  /* ------------------------------------------------------------------
     ✏️ EDIT HERE #3 - All visible text in both languages
  ------------------------------------------------------------------ */
  const TEXT = {
    hi: {
      title: 'अपने अधिकार जानें',
      subtitle: 'ज़मीन, सरकारी योजनाएँ और ज़रूरी सहायता',
      send: 'भेजें',
      micIdle: 'बोलने के लिए दबाएँ',
      micListening: 'सुन रहा हूँ... बोलिए',
      micHearing: 'आवाज़ मिल रही है ✓',
      placeholder: 'यहाँ लिखें या माइक दबाकर बोलें...',
      thinking: 'AI सोच रहा है...',
      welcome: 'नमस्ते! 🙏 मैं आपको ज़मीन के अधिकार, सरकारी योजनाओं और ज़रूरी सहायता के बारे में बताऊँगा। नीचे दिया माइक दबाकर अपना सवाल पूछिए।',
      suggestionsTitle: 'ऐसे सवाल पूछ सकते हैं:',
      sources: 'स्रोत:',
      listen: '🔊 सुनें',
      stopListen: '⏹ रोकें',
      errEmpty: 'AI ने कोई जवाब नहीं दिया। कृपया दोबारा कोशिश करें।',
      errServer: 'सर्वर से जुड़ नहीं पाए। कृपया जाँचें कि बैकएंड (node server.js) चालू है।',
      errTimeout: 'जवाब आने में बहुत देर लगी। कृपया दोबारा कोशिश करें।',
      errNoMic: 'इस ब्राउज़र में आवाज़ पहचान उपलब्ध नहीं है। कृपया Google Chrome इस्तेमाल करें या सवाल लिखें।',
      errMicDenied: 'माइक की अनुमति नहीं मिली। ब्राउज़र में माइक की अनुमति दें।',
      errNoSpeech: 'कोई आवाज़ सुनाई नहीं दी। जाँचें कि सही माइक चुना है और उसकी आवाज़ चालू है।',
      errAudio: 'माइक नहीं मिला या कोई दूसरा ऐप माइक इस्तेमाल कर रहा है। Windows में Sound → Input जाँचें।',
      errLang: 'इस ब्राउज़र में इस भाषा की आवाज़ पहचान उपलब्ध नहीं है।',
      errOther: 'आवाज़ पहचान में समस्या आई। कोड:',
      errNoVoice: 'इस डिवाइस में हिंदी आवाज़ इंस्टॉल नहीं है, इसलिए जवाब सुनाई नहीं देगा।'
    },
    en: {
      title: 'Know your rights',
      subtitle: 'Land, government schemes and essential help',
      send: 'Send',
      micIdle: 'Tap to speak',
      micListening: 'Listening... speak now',
      micHearing: 'Hearing you ✓',
      placeholder: 'Type here or tap the mic to speak...',
      thinking: 'AI is thinking...',
      welcome: 'Namaste! 🙏 I can explain land rights, government schemes and basic resources. Tap the microphone below and ask your question.',
      suggestionsTitle: 'You can ask things like:',
      sources: 'Sources:',
      listen: '🔊 Listen',
      stopListen: '⏹ Stop',
      errEmpty: 'The AI did not return an answer. Please try again.',
      errServer: 'Could not reach the server. Please check that the backend (node server.js) is running.',
      errTimeout: 'The answer took too long. Please try again.',
      errNoMic: 'Voice recognition is not available in this browser. Please use Google Chrome or type your question.',
      errMicDenied: 'Microphone permission was denied. Please allow microphone access in your browser.',
      errNoSpeech: 'No speech was heard. Check that the right microphone is selected and not muted.',
      errAudio: 'No microphone found, or another app is using it. Check Windows Settings → Sound → Input.',
      errLang: 'Voice recognition is not available for this language in this browser.',
      errOther: 'Voice recognition problem. Code:',
      errNoVoice: 'No English voice is installed on this device, so the answer cannot be spoken.'
    }
  };

  /* ------------------------------------------------------------------
     ✏️ EDIT HERE #4 - Example questions shown as tappable chips
  ------------------------------------------------------------------ */
  const SUGGESTIONS = {
    hi: [
      'ज़मीन के कागज़ात कैसे निकालें?',
      'ज़मीन का बँटवारा कैसे होता है?',
      'किसानों के लिए कौन सी सरकारी योजनाएँ हैं?'
    ],
    en: [
      'How do I get my land records?',
      'How is family land divided?',
      'Which government schemes are there for farmers?'
    ]
  };

  /* ------------------------------------------------------------------ */
  /* Everything below is the engine. You can leave it as it is.         */
  /* ------------------------------------------------------------------ */

  const $ = (id) => document.getElementById(id);
  const chat = $('chat'), scrollBtn = $('scrollBtn');
  const textForm = $('textForm'), textInput = $('textInput'), sendBtn = $('sendBtn');
  const micArea = $('micArea'), micBtn = $('micBtn'), micLabel = $('micLabel');
  const iconMic = $('iconMic'), iconStop = $('iconStop');
  const muteBtn = $('muteBtn'), muteIcon = $('muteIcon'), fontBtn = $('fontBtn');
  const langToggle = $('langToggle'), kbList = $('kbList');

  let lang = CONFIG.DEFAULT_LANG;
  let listening = false;
  let busy = false;
  let hasConversation = false;     // becomes true after the first question
  let speakEnabled = CONFIG.AUTO_SPEAK;
  let fontStep = 0;
  let voiceWarned = false;
  let voices = [];
  let recognition = null;

  const t = (key) => TEXT[lang][key];

  /* ---------- tiny helper to build HTML elements safely ---------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function scrollToBottom() {
    chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
  }

  /* Show the floating "scroll down" button when the person scrolls up */
  chat.addEventListener('scroll', () => {
    const away = chat.scrollHeight - chat.scrollTop - chat.clientHeight;
    scrollBtn.classList.toggle('is-visible', away > 200);
  });
  scrollBtn.addEventListener('click', scrollToBottom);

  /* ---------- Language handling ---------- */
  function applyLanguage() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      if (!(listening && key === 'micIdle')) node.textContent = t(key);
    });
    textInput.placeholder = t('placeholder');

    langToggle.dataset.active = lang;   // CSS slides the green pill using this value
    document.querySelectorAll('.lang-btn').forEach((btn) => {
      const active = btn.dataset.lang === lang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    if (recognition) recognition.lang = CONFIG.LANGS[lang].recog;
    if (listening) micLabel.textContent = t('micListening');
    if (!hasConversation) renderWelcome();   // re-draw the welcome message in the new language
  }

  function setLang(newLang) {
    if (newLang === lang) return;
    stopSpeaking();
    if (listening) stopListening();
    lang = newLang;
    applyLanguage();
  }

  /* ---------- Sidebar: knowledge base tokens ---------- */
  function renderKnowledge() {
    kbList.innerHTML = '';
    KNOWLEDGE_BASE.forEach((doc) => {
      const li = el('li', 'kb-item');
      li.appendChild(el('span', 'kb-dot'));
      const box = el('div');
      box.appendChild(el('p', 'kb-name', doc.name));
      box.appendChild(el('p', 'kb-detail', doc.detail || 'Active'));
      li.appendChild(box);
      kbList.appendChild(li);
    });
  }

  async function loadSourcesFromBackend() {
    try {
      const res = await fetch(CONFIG.SOURCES_URL);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.sources) && data.sources.length) {
        KNOWLEDGE_BASE = data.sources.map((s) => ({ name: s.name, detail: `${s.chunks} sections indexed` }));
        renderKnowledge();
      }
    } catch (e) { /* backend not running yet - keep the defaults */ }
  }

  /* ---------- Chat bubbles ---------- */
  function timeNow() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function addUserBubble(text) {
    const row = el('div', 'msg msg--user');
    const bubble = el('div', 'bubble bubble--user');
    bubble.appendChild(el('p', 'bubble-text', text));
    bubble.appendChild(el('p', 'bubble-time', timeNow()));
    row.appendChild(bubble);
    chat.appendChild(row);
    scrollToBottom();
  }

  // Turns the AI text into clean lines (removes "-", "*", "1." and **bold** markers)
  function toBulletLines(answer) {
    let rawLines = String(answer || '').replace(/\*\*/g, '').split('\n');
    // If the AI starts with an intro sentence ending in ":", skip it
    const first = (rawLines[0] || '').trim();
    if (rawLines.length > 2 && !/^([-*•●▪]|\d+[.)])/.test(first) && /[:：]$/.test(first)) rawLines = rawLines.slice(1);
    return rawLines
      .map((line) => line.trim().replace(/^([-*•●▪]|\d+[.)])\s*/, '').trim())
      .filter(Boolean);
  }

  function aiBubbleShell(extraClass) {
    const row = el('div', 'msg msg--ai');
    row.appendChild(el('div', 'avatar', '⚖'));
    const bubble = el('div', 'bubble ' + (extraClass || 'bubble--ai'));
    row.appendChild(bubble);
    return { row, bubble };
  }

  // Shows the bullet lines inside a <ul>. Existing lines are only updated (not re-created),
  // so while the AI is typing, only the NEW bullet animates in.
  function renderBullets(ul, lines, stagger) {
    lines.forEach((line, i) => {
      let li = ul.children[i];
      if (!li) {
        li = el('li');
        li.style.setProperty('--i', stagger ? i : 0);   // used by CSS to stagger the bullet animation
        ul.appendChild(li);
      }
      if (li.textContent !== line) li.textContent = line;
    });
  }

  // Bottom row of an answer: source tags + "Listen" button
  function makeFooter(lines, sources) {
    const footer = el('div', 'bubble-footer');
    if (Array.isArray(sources) && sources.length) {
      footer.appendChild(el('span', 'sources-label', t('sources')));
      sources.forEach((s) => footer.appendChild(el('span', 'source-tag', s)));
    }
    const listenBtn = el('button', 'listen-btn', t('listen'));
    listenBtn.type = 'button';
    listenBtn.addEventListener('click', () => {
      if (window.speechSynthesis && window.speechSynthesis.speaking) { stopSpeaking(); return; }
      speakLines(lines);
    });
    footer.appendChild(listenBtn);
    return footer;
  }

  // Normal (non-streaming) answer: the whole text is already available
  function addAIBubble(answer, sources) {
    const { row, bubble } = aiBubbleShell();
    const lines = toBulletLines(answer);

    if (lines.length <= 1) {
      bubble.appendChild(el('p', 'bubble-text', lines[0] || '—'));
    } else {
      const ul = el('ul', 'bullets');
      renderBullets(ul, lines, true);
      bubble.appendChild(ul);
    }

    bubble.appendChild(makeFooter(lines, sources));
    bubble.appendChild(el('p', 'bubble-time', timeNow()));
    chat.appendChild(row);
    scrollToBottom();
    return lines;
  }

  // Streaming answer: the bubble appears with the first word and grows while the AI writes
  function createLiveBubble() {
    const { row, bubble } = aiBubbleShell();
    const ul = el('ul', 'bullets');
    bubble.appendChild(ul);
    chat.appendChild(row);
    chat.scrollTop = chat.scrollHeight;
    return {
      update(answer) {
        const nearBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 160;
        renderBullets(ul, toBulletLines(answer), false);
        if (nearBottom) chat.scrollTop = chat.scrollHeight;
      },
      finish(answer, sources) {
        const lines = toBulletLines(answer);
        if (lines.length === 0) renderBullets(ul, ['—'], false);
        bubble.appendChild(makeFooter(lines, sources));
        bubble.appendChild(el('p', 'bubble-time', timeNow()));
        scrollToBottom();
        return lines;
      }
    };
  }

  function addErrorBubble(message) {
    const { row, bubble } = aiBubbleShell('bubble--error');
    bubble.appendChild(el('p', 'bubble-text', message));
    chat.appendChild(row);
    scrollToBottom();
  }

  function renderWelcome() {
    chat.innerHTML = '';
    const { row, bubble } = aiBubbleShell();
    bubble.appendChild(el('p', 'bubble-text', t('welcome')));
    bubble.appendChild(el('p', 'welcome-title', t('suggestionsTitle')));
    const chips = el('div', 'chips');
    SUGGESTIONS[lang].forEach((q) => {
      const chip = el('button', 'chip', q);
      chip.type = 'button';
      chip.addEventListener('click', () => sendMessage(q));
      chips.appendChild(chip);
    });
    bubble.appendChild(chips);
    chat.appendChild(row);
  }

  /* ---------- "AI is thinking..." indicator ---------- */
  let typingRow = null;
  function showTyping() {
    hideTyping();
    const { row, bubble } = aiBubbleShell();
    const inner = el('div', 'typing');
    const dots = el('div', 'typing-dots');
    dots.append(el('span'), el('span'), el('span'));
    inner.append(dots, el('span', 'typing-label', t('thinking')));
    bubble.appendChild(inner);
    chat.appendChild(row);
    typingRow = row;
    scrollToBottom();
  }
  function hideTyping() {
    if (typingRow) { typingRow.remove(); typingRow = null; }
  }

  function updateInputState() {
    sendBtn.disabled = busy || textInput.value.trim() === '';
    textInput.disabled = busy;
    micBtn.disabled = busy;
  }
  function setBusy(state) { busy = state; updateInputState(); }
  textInput.addEventListener('input', updateInputState);

  /* ---------- Sending a question to the backend ---------- */

  // The streaming backend sends small messages such as   data: {"type":"token","text":"नमस्ते"}
  // separated by a blank line. This function cuts the received text into those messages.
  function parseStreamBuffer(buffer) {
    const messages = [];
    let rest = buffer;
    let idx;
    while ((idx = rest.indexOf('\n\n')) !== -1) {
      const block = rest.slice(0, idx);
      rest = rest.slice(idx + 2);
      const line = block.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      try { messages.push(JSON.parse(line.slice(5).trim())); } catch (e) { /* ignore a broken piece */ }
    }
    return { messages, rest };
  }

  async function sendMessage(raw) {
    const text = (raw || '').trim();
    if (!text || busy) return;

    stopSpeaking();
    if (listening) stopListening();
    hasConversation = true;

    addUserBubble(text);
    textInput.value = '';
    setBusy(true);
    showTyping();

    // The timer restarts every time new words arrive, so it only triggers if the AI goes silent
    const controller = new AbortController();
    let timer;
    const bump = () => { clearTimeout(timer); timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS); };
    bump();

    // ✏️ EDIT HERE #5 - the data we send to the backend.
    // The backend reads req.body.question and req.body.language.
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: text, language: lang }),
      signal: controller.signal
    };

    try {
      if (CONFIG.USE_STREAMING) {
        // ----- Streaming: words appear one by one -----
        const res = await fetch(CONFIG.STREAM_URL, request);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'HTTP ' + res.status);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '', answer = '', sources = [], live = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          bump();
          buffer += decoder.decode(value, { stream: true });
          const parsed = parseStreamBuffer(buffer);
          buffer = parsed.rest;

          for (const msg of parsed.messages) {
            if (msg.type === 'sources') {
              sources = msg.sources || [];
            } else if (msg.type === 'token') {
              if (!live) { hideTyping(); live = createLiveBubble(); }   // first word arrived
              answer += msg.text;
              live.update(answer);
            } else if (msg.type === 'error') {
              throw new Error(msg.error);
            }
          }
        }

        hideTyping();
        if (!live) throw new Error(t('errEmpty'));
        const lines = live.finish(answer, sources);
        if (speakEnabled) speakLines(lines);

      } else {
        // ----- Normal: wait for the whole answer -----
        const res = await fetch(CONFIG.API_URL, request);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);

        hideTyping();
        // The backend replies as: { answer: "text...", sources: ["file1.pdf", ...] }
        const lines = addAIBubble(data.answer, data.sources);
        if (speakEnabled) speakLines(lines);
      }
    } catch (err) {
      hideTyping();
      if (err.name === 'AbortError') addErrorBubble(t('errTimeout'));
      else if (err instanceof TypeError) addErrorBubble(t('errServer'));
      else addErrorBubble(err.message || t('errServer'));
    } finally {
      clearTimeout(timer);
      setBusy(false);
      if (window.matchMedia('(min-width: 768px)').matches) textInput.focus();
    }
  }

  /* ---------- Text-to-Speech (browser built-in) ---------- */
  function loadVoices() { voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; }

  function pickVoice(code) {
    const norm = (s) => s.toLowerCase().replace('_', '-');
    const prefix = norm(code).split('-')[0];
    return voices.find((v) => norm(v.lang) === norm(code)) ||
           voices.find((v) => norm(v.lang).startsWith(prefix)) || null;
  }

  function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function speakLines(lines) {
    if (!window.speechSynthesis || !lines.length) return;
    stopSpeaking();
    const code = CONFIG.LANGS[lang].tts;
    const voice = pickVoice(code);
    if (!voice && !voiceWarned) { voiceWarned = true; addErrorBubble(t('errNoVoice')); }

    // Chrome stops long speech after ~15 seconds, so we speak one sentence at a time.
    const sentences = lines.flatMap((l) => l.split(/(?<=[।.!?])\s+/)).filter(Boolean);
    sentences.forEach((s) => {
      const u = new SpeechSynthesisUtterance(s);
      u.lang = code;
      u.rate = CONFIG.SPEECH_RATE;
      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
    });
  }

  /* ---------- Speech-to-Text (browser built-in Web Speech API) ---------- */
  function setupRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    const r = new SR();
    r.lang = CONFIG.LANGS[lang].recog;
    r.continuous = false;       // stop automatically when the person pauses
    r.interimResults = true;    // show words live while speaking
    r.maxAlternatives = 1;

    let finalText = '';
    let sent = false;

    r.onstart = () => { finalText = ''; sent = false; setListeningUI(true); };

    // Diagnostics: these show whether the microphone is really hearing you.
    // Press F12 -> Console to see them. If you never see "speech started", the mic is silent.
    r.onaudiostart  = () => console.log('[mic] audio capture started');
    r.onspeechstart = () => { console.log('[mic] speech started'); if (listening) micLabel.textContent = t('micHearing'); };
    r.onspeechend   = () => console.log('[mic] speech ended');

    r.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += piece; else interim += piece;
      }
      textInput.value = (finalText + interim).trim();   // live preview in the text box
      updateInputState();
      if (finalText.trim() && !sent) {                  // final sentence received -> send automatically
        sent = true;
        const spoken = finalText.trim();
        r.stop();
        sendMessage(spoken);
      }
    };

    r.onerror = (event) => {
      setListeningUI(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') addErrorBubble(t('errMicDenied'));
      else if (event.error === 'no-speech') addErrorBubble(t('errNoSpeech'));
      else if (event.error === 'network') addErrorBubble(t('errServer'));
      else if (event.error === 'audio-capture') addErrorBubble(t('errAudio'));
      else if (event.error === 'language-not-supported') addErrorBubble(t('errLang'));
      else if (event.error !== 'aborted') addErrorBubble(t('errOther') + ' ' + event.error);
      console.log('[mic] error:', event.error);
    };

    r.onend = () => {
      setListeningUI(false);
      // If the browser ended without a "final" flag but we have words, send them anyway
      if (!sent && textInput.value.trim()) { sent = true; sendMessage(textInput.value); }
    };
    return r;
  }

  function setListeningUI(state) {
    listening = state;
    micArea.classList.toggle('is-listening', state);   // CSS turns the mic red and starts the animations
    iconMic.classList.toggle('hidden', state);
    iconStop.classList.toggle('hidden', !state);
    micBtn.setAttribute('aria-label', state ? 'Stop listening' : 'Start speaking');
    micLabel.textContent = state ? t('micListening') : t('micIdle');
  }

  function startListening() {
    if (!recognition) { addErrorBubble(t('errNoMic')); return; }
    stopSpeaking();                         // so the microphone does not hear the AI's own voice
    recognition.lang = CONFIG.LANGS[lang].recog;
    try { recognition.start(); } catch (e) { /* already started */ }
  }
  function stopListening() { if (recognition) recognition.stop(); }

  /* ---------- Wire up the buttons ---------- */
  micBtn.addEventListener('click', () => {
    micBtn.classList.remove('pop');
    void micBtn.offsetWidth;                // restarts the little "pop" animation
    micBtn.classList.add('pop');
    listening ? stopListening() : startListening();
  });

  textForm.addEventListener('submit', (e) => { e.preventDefault(); sendMessage(textInput.value); });

  document.querySelectorAll('.lang-btn').forEach((btn) =>
    btn.addEventListener('click', () => setLang(btn.dataset.lang)));

  muteBtn.addEventListener('click', () => {
    speakEnabled = !speakEnabled;
    muteIcon.textContent = speakEnabled ? '🔊' : '🔇';
    muteBtn.setAttribute('aria-pressed', String(speakEnabled));
    if (!speakEnabled) stopSpeaking();
  });

  // "A A" button: cycles through the text sizes in CONFIG.FONT_SIZES
  fontBtn.addEventListener('click', () => {
    fontStep = (fontStep + 1) % CONFIG.FONT_SIZES.length;
    document.documentElement.style.fontSize = CONFIG.FONT_SIZES[fontStep] + '%';
  });

  /* ---------- Start ---------- */
  if (window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;   // voices load late in Chrome
  }
  recognition = setupRecognition();
  muteIcon.textContent = speakEnabled ? '🔊' : '🔇';
  renderKnowledge();
  applyLanguage();
  updateInputState();
  loadSourcesFromBackend();
})();
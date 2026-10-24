# ⚖️ AI Legal Assistant for Rural Rights
### ग्रामीण अधिकार सहायक

A **voice-activated, Hindi-first** web assistant that explains government schemes and legal-aid services to rural and underprivileged communities, using only official documents. It runs **completely free and locally**: no paid APIs, no cloud AI.


## ✨ Features

-  **Speak or type**: voice input in Hindi (`hi-IN`) and English (`en-IN`) using the browser's built-in Web Speech API.
-  **Spoken answers**: replies are read aloud automatically, with a "Listen again" button on every answer.
-  **Hindi / English toggle**: the interface and the answers switch language. Questions written in Devanagari are always answered in Hindi.
- **Answers only from official PDFs**: a local AI reads the relevant parts of your documents (RAG) and answers from them, with the source file shown under each answer.
-  **Says "not found" instead of guessing**: off-topic questions (for example politics or cricket) are refused, using a relevance score plus a topic guide.
-  **Streaming replies**: words appear while the AI is still writing.
- **Accessibility**: large touch targets, adjustable text size, keyboard focus styles and reduced-motion support.
-  **₹0 to run**: Ollama + open models on your own computer.

---

## How it works


1. On start-up the server reads every PDF/TXT in `knowledge/`, splits it into chunks and turns each chunk into an embedding (cached in `cache.json`).
2. For each question it finds the most similar chunks.
3. **Gate 1:** if the best match score is too low, the question is refused without calling the AI.
4. **Gate 2:** for borderline scores, a *topic guide* (`topic-examples.json`) decides whether the question is on-topic.
5. The AI is told to use only the supplied text and to reply `NOT_FOUND` otherwise.

---

## 🛠️ Tech stack

| Part | Technology |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript |
| Voice | Web Speech API (speech recognition + speech synthesis) |
| Backend | Node.js, Express |
| AI orchestration | LangChain (`@langchain/ollama`) |
| Chat model | `gemma3:1b` by default (via Ollama); `gemma3:4b` recommended for better Hindi |
| Embedding model | `bge-m3` (multilingual: Hindi + English) |

---

## Project structure

```
Ai-Legal-Assistant-for-Rural-Rights/
├── frontend/
│   ├── index.html          # page structure
│   ├── style.css           # all styling and animations
│   └── script.js           # voice, chat, streaming, settings
├── knowledge/              # put your PDFs here
├── server.js               # Express API + RAG logic
├── topic-examples.json     # allowed / blocked example questions
├── package.json
├── .env                    # your local settings (not committed)
└── README.md
```

---

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org) 18 or newer
- [Ollama](https://ollama.com/download)
- Google Chrome (for voice input)
- About 8 GB RAM is recommended

### 1. Clone and install
```bash
git clone https://github.com/shivankart9/Ai-Legal-Assistant-for-Rural-Rights.git
cd Ai-Legal-Assistant-for-Rural-Rights
npm install
```

### 2. Download the AI models (one time)
```bash
ollama pull gemma3:1b
ollama pull bge-m3
```

### 3. Add your documents
Create a `knowledge` folder and copy your PDF files into it. The project was built with:
- *PM-KISAN Operational Guidelines* (Government of India)
- *Manual for District Legal Services Authorities, 2023* (NALSA)

### 4. Create the `.env` file
```env
PORT=3000
CHAT_MODEL=gemma3:1b
EMBED_MODEL=bge-m3
OLLAMA_URL=http://localhost:11434
MIN_SCORE=0.40
SURE_SCORE=0.50
TOP_K=3
MAX_CHUNK_CHARS=700
```

### 5. Run
```bash
node server.js
```
- The first start reads the PDFs and builds the index (a few minutes, once).
- Wait for **`✅ Models ready`** in the terminal.
- Open **http://localhost:3000** in Chrome (do **not** use VS Code Live Server).



## Showing it on a phone (free)

Browsers only allow the microphone on **HTTPS** pages (or `localhost`). A free Cloudflare quick tunnel gives your laptop a temporary HTTPS address:

```bash
winget install --id Cloudflare.cloudflared     # one time (Windows)
node server.js                                  # terminal 1
cloudflared tunnel --url http://localhost:3000  # terminal 2
```

Open the `https://….trycloudflare.com` link on your phone. Keep the laptop plugged in and awake. The link stops working when you press `Ctrl + C`. The AI still runs on your laptop.

---

## Limitations and disclaimer

- **Not legal advice.** This is a prototype for general guidance only. For real disputes, contact your Tehsil office, Gram Panchayat or the nearest District Legal Services Authority (NALSA helpline: **15100**).
- **Answers are only as good as the documents.** The sample documents cover the PM-KISAN scheme and legal-aid services. Topics such as land partition, khasra/khatauni or mutation need additional documents in `knowledge/`.
- **Local dialects:** Chrome's speech recognition supports Hindi but not dialects such as Bhojpuri or Awadhi. These are transcribed as the closest Hindi.
- **Not fully offline:** the AI and search run locally, but Chrome's speech recognition sends audio to Google's servers, and the fonts load from Google Fonts.
- **Small models make mistakes.** `gemma3:1b` is fast but limited in Hindi. Use `gemma3:4b` or larger if your computer allows.
- **Speed depends on hardware.** On a laptop without a GPU, a live answer can take a minute or more. Verified quick answers are instant.
- **Hindi voice output** needs a Hindi voice installed on the device (Windows: Settings → Time & Language → Speech).


## Acknowledgements

- National Legal Services Authority (NALSA) and the Department of Agriculture & Farmers Welfare, Government of India, for the source documents
- [Ollama](https://ollama.com), [LangChain](https://js.langchain.com), [Express](https://expressjs.com), Google Gemma and BAAI bge-m3

## 👤 Author

Built by [@shivankart9](https://github.com/shivankart9).
const worker = new Worker("worker.js", { type: "module" });

const SUMMARIZE_SVG = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 6h16M4 12h10M4 18h14"></path>
  </svg>
`;

const sourceInput = document.getElementById("source-input");
const convertBtn = document.getElementById("convert-btn");
const clearBtn = document.getElementById("clear-btn");
const composerNote = document.getElementById("composer-note");
const articleContent = document.getElementById("article-content");
const metaStatus = document.getElementById("meta-status");
const metaSections = document.getElementById("meta-sections");
const metaWords = document.getElementById("meta-words");
const metaModel = document.getElementById("meta-model");
const readyDot = document.getElementById("ready-dot");
const readyText = document.getElementById("ready-text");

const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");
const chatResponse = document.getElementById("chat-response");
const chatLabel = document.getElementById("chat-label");
const chatQuestion = document.getElementById("chat-question");
const chatText = document.getElementById("chat-text");
const chatStats = document.getElementById("chat-stats");
const chatClose = document.getElementById("chat-close");

const loadingOverlay = document.getElementById("loading-overlay");
const loadingProgressFill = document.getElementById("loading-progress-fill");
const loadingDetail = document.getElementById("loading-detail");

let modelReady = false;
let isGenerating = false;
let generationId = 0;
let articleSource = "";
let sections = [];
let activeRequest = null;

worker.postMessage({ type: "load" });

worker.addEventListener("message", (event) => {
  const data = event.data;

  if (data.type === "progress") {
    const pct = data.progress != null ? Math.round(data.progress) : 0;
    loadingProgressFill.style.width = pct + "%";
    loadingDetail.textContent = `Loading model... ${pct}%`;
    readyText.textContent = `Loading WebGPU model... ${pct}%`;
    return;
  }

  if (data.type === "ready") {
    modelReady = true;
    loadingOverlay.classList.add("hidden");
    readyDot.classList.add("online");
    readyText.textContent = "Model ready";
    metaModel.textContent = "Ready";
    updateControls();
    if (sections.length > 0) {
      chatInput.focus();
    }
    return;
  }

  if (!activeRequest || data.generationId !== generationId) {
    return;
  }

  if (data.type === "token") {
    activeRequest.tokenCount += 1;
    activeRequest.firstTokenAt ||= performance.now();
    activeRequest.outputEl.textContent += data.token;
    if (activeRequest.type === "chat") {
      chatResponse.classList.add("visible");
    }
    return;
  }

  if (data.type === "done") {
    finishRequest(data.output || activeRequest.outputEl.textContent || "");
    return;
  }

  if (data.type === "error") {
    finishRequest("Error: " + data.message, true);
  }
});

function cleanText(rawText) {
  let text = rawText;

  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, " ");

  // Remove markdown images: ![alt](url)
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");

  // Remove markdown links but keep label: [label](url) → label
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Remove standalone URLs
  text = text.replace(/https?:\/\/[^\s)>\]]+/g, "");

  // Remove citation brackets like [1], [2,3], [citation needed]
  text = text.replace(/\[\d+(?:[,\s]*\d+)*\]/g, "");
  text = text.replace(/\[citation needed\]/gi, "");

  // Remove markdown bold/italic markers
  text = text.replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2");

  // Remove markdown headings markers (keep text)
  text = text.replace(/^#{1,6}\s+/gm, "");

  // Remove markdown horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, "");

  // Remove markdown code fences
  text = text.replace(/```[\s\S]*?```/g, "");
  text = text.replace(/`([^`]+)`/g, "$1");

  // Decode common HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");

  // Collapse excessive whitespace
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0).join("\n");

  return Promise.resolve(text.trim());
}

function splitSections(cleanedText) {
  const chunks = cleanedText
    .split(/\n\s*\n+/)
    .map((chunk) => chunk.split("\n").map((line) => line.trim()).filter(Boolean).join(" "))
    .map((chunk) => chunk.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  return chunks.map((text) => {
    const words = text.split(/\s+/).filter(Boolean);
    const looksLikeHeading =
      words.length <= 12 &&
      text.length <= 90 &&
      !/[.!?]$/.test(text) &&
      text === text.trim();

    return {
      type: looksLikeHeading ? "heading" : "paragraph",
      text,
      wordCount: words.length,
    };
  });
}

function renderSections() {
  articleContent.innerHTML = "";

  if (!sections.length) {
    articleContent.innerHTML = `
      <div class="placeholder">
        Nothing usable remained after cleanup. Try pasting more article text or plain text content.
      </div>
    `;
    return;
  }

  sections.forEach((section, index) => {
    const block = document.createElement("section");
    block.className = "article-block";

    if (section.type === "heading") {
      const heading = document.createElement(index === 0 ? "h2" : "h3");
      heading.textContent = section.text;
      block.appendChild(heading);
    } else {
      const paragraph = document.createElement("div");
      paragraph.className = "article-paragraph";
      paragraph.textContent = section.text;

      const button = document.createElement("button");
      button.className = "summarize-btn";
      button.innerHTML = `${SUMMARIZE_SVG} Summarize`;
      button.addEventListener("click", () => summarizeSection(section, block, button));

      paragraph.appendChild(button);
      block.appendChild(paragraph);
    }

    articleContent.appendChild(block);
  });
}

async function convertSource() {
  if (isGenerating) return;

  const rawText = sourceInput.value.trim();
  if (!rawText) {
    articleSource = "";
    sections = [];
    renderSections();
    updateMeta();
    updateControls();
    return;
  }

  convertBtn.disabled = true;
  convertBtn.textContent = "Cleaning...";

  try {
    articleSource = await cleanText(rawText);
    sections = splitSections(articleSource);
    renderSections();
    updateMeta();
    updateControls();

    if (sections.length) {
      composerNote.textContent = "Converted successfully. Hover a section to summarize it, or ask a question in the bottom-right.";
    } else {
      composerNote.textContent = "The cleanup step removed almost everything. Try pasting more text and less markup.";
    }
  } catch (err) {
    composerNote.textContent = "Error cleaning text: " + err.message;
    articleSource = "";
    sections = [];
    renderSections();
    updateMeta();
    updateControls();
  } finally {
    convertBtn.textContent = "Convert";
    updateControls();
  }
}

function updateMeta() {
  const words = articleSource ? articleSource.split(/\s+/).filter(Boolean).length : 0;
  metaStatus.textContent = articleSource ? "Converted" : "Waiting for input";
  metaSections.textContent = String(sections.filter((section) => section.type === "paragraph").length);
  metaWords.textContent = String(words);
}

function updateControls() {
  const hasText = sourceInput.value.trim().length > 0;
  const hasArticle = articleSource.length > 0 && sections.length > 0;

  convertBtn.disabled = !hasText || isGenerating;
  clearBtn.disabled = !hasText || isGenerating;
  chatInput.disabled = !modelReady || !hasArticle || isGenerating;
  chatSend.disabled = !modelReady || !hasArticle || isGenerating;

  articleContent.querySelectorAll(".summarize-btn").forEach((button) => {
    button.disabled = !modelReady || isGenerating;
  });
}

function beginRequest(type, outputEl, context = {}) {
  generationId += 1;
  isGenerating = true;
  activeRequest = {
    type,
    outputEl,
    startedAt: performance.now(),
    firstTokenAt: null,
    tokenCount: 0,
    ...context,
  };
  updateControls();
}

function finishRequest(finalText, isError = false) {
  if (!activeRequest) return;

  activeRequest.outputEl.textContent = finalText;
  const elapsed = ((performance.now() - activeRequest.startedAt) / 1000).toFixed(1);
  const decodeSeconds = activeRequest.firstTokenAt
    ? (performance.now() - activeRequest.firstTokenAt) / 1000
    : 0;
  const tokPerSec =
    activeRequest.tokenCount > 1 && decodeSeconds > 0
      ? ((activeRequest.tokenCount - 1) / decodeSeconds).toFixed(1)
      : "-";

  if (activeRequest.type === "summary") {
    activeRequest.labelEl.textContent = isError ? "Summary failed" : "Summary";
    const originalWords = activeRequest.sourceText.split(/\s+/).filter(Boolean).length;
    const summaryWords = finalText.split(/\s+/).filter(Boolean).length;
    activeRequest.statsEl.innerHTML =
      `<span>${originalWords}</span> words to <span>${summaryWords}</span> words · ${elapsed}s · <span>${tokPerSec}</span> tok/s`;
    activeRequest.buttonEl.disabled = false;
    activeRequest.buttonEl.innerHTML = `${SUMMARIZE_SVG} Re-summarize`;
  } else if (activeRequest.type === "chat") {
    chatLabel.textContent = isError ? "Answer failed" : "Answer";
    chatStats.innerHTML = `${elapsed}s · <span>${tokPerSec}</span> tok/s`;
  }

  isGenerating = false;
  activeRequest = null;
  updateControls();
}

function summarizeSection(section, block, button) {
  if (!modelReady || isGenerating) return;

  let summaryBlock = block.querySelector(".summary-block");
  let labelEl;
  let outputEl;
  let statsEl;

  if (!summaryBlock) {
    summaryBlock = document.createElement("div");
    summaryBlock.className = "summary-block";

    labelEl = document.createElement("div");
    labelEl.className = "summary-label";
    summaryBlock.appendChild(labelEl);

    outputEl = document.createElement("div");
    outputEl.className = "summary-text";
    summaryBlock.appendChild(outputEl);

    statsEl = document.createElement("div");
    statsEl.className = "summary-stats";
    summaryBlock.appendChild(statsEl);

    block.appendChild(summaryBlock);
  } else {
    labelEl = summaryBlock.querySelector(".summary-label");
    outputEl = summaryBlock.querySelector(".summary-text");
    statsEl = summaryBlock.querySelector(".summary-stats");
  }

  labelEl.innerHTML = `<span class="spinner"></span> Summarizing`;
  outputEl.textContent = "";
  statsEl.textContent = "";
  button.disabled = true;

  beginRequest("summary", outputEl, {
    labelEl,
    statsEl,
    buttonEl: button,
    sourceText: section.text,
  });

  worker.postMessage({
    type: "generate",
    task: "summary",
    generationId,
    messages: [
      {
        role: "system",
        content: "You summarize one section of text. Respond in the same language as the input text. Remove noise, keep only the key ideas, stay concise, and never change the meaning of gendered nouns, names, or proper nouns.",
      },
      {
        role: "user",
        content: `Summarize this section in a short paragraph using only the information below. Use the same language as the text.\n\n${section.text}`,
      },
    ],
    options: {
      max_new_tokens: 220,
      do_sample: false,
    },
  });
}

function askQuestion() {
  const question = chatInput.value.trim();
  if (!question || !modelReady || !articleSource || isGenerating) return;

  chatQuestion.textContent = question;
  chatText.textContent = "";
  chatStats.textContent = "";
  chatLabel.innerHTML = `<span class="spinner"></span> Thinking`;
  chatResponse.classList.add("visible");

  beginRequest("chat", chatText);
  chatInput.value = "";

  worker.postMessage({
    type: "generate",
    task: "chat",
    generationId,
    messages: [
      {
        role: "system",
        content:
          "You answer questions about the converted article text. Respond in the same language as the question. Use only the text provided. If the answer is not supported by the text, say that clearly.\n\n" +
          articleSource,
      },
      {
        role: "user",
        content: question,
      },
    ],
    options: {
      max_new_tokens: 320,
      do_sample: false,
    },
  });
}

convertBtn.addEventListener("click", convertSource);

clearBtn.addEventListener("click", () => {
  if (isGenerating) return;
  sourceInput.value = "";
  articleSource = "";
  sections = [];
  composerNote.textContent =
    "Convert cleans URLs, markdown image syntax, HTML tags, and extra whitespace before splitting into sections.";
  renderSections();
  updateMeta();
  updateControls();
  chatResponse.classList.remove("visible");
  chatInput.value = "";
  chatQuestion.textContent = "";
  chatText.textContent = "";
  chatStats.textContent = "";
});

sourceInput.addEventListener("input", updateControls);
sourceInput.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    convertSource();
  }
});

chatSend.addEventListener("click", askQuestion);
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    askQuestion();
  }
});

chatClose.addEventListener("click", () => {
  if (!isGenerating) {
    chatResponse.classList.remove("visible");
  }
});

updateMeta();
updateControls();

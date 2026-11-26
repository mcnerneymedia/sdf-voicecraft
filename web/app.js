let allVoices = [];
let currentBlob = null;
let currentFilename = '';

const voiceSelect = document.getElementById('voice-select');
const selectedVoiceTag = document.getElementById('selected-voice-tag');
const speedSlider = document.getElementById('speed-slider');
const speedVal = document.getElementById('speed-val');
const scriptText = document.getElementById('script-text');
const btnSynthesize = document.getElementById('btn-synthesize');
const outputBox = document.getElementById('output-box');
const outputStatus = document.getElementById('output-status');
const audioPlayer = document.getElementById('audio-player');
const outputActions = document.getElementById('output-actions');
const btnDownload = document.getElementById('btn-download');
const btnSendSoundCraft = document.getElementById('btn-send-soundcraft');
const btnPublishLore = document.getElementById('btn-publish-lore');
const voiceTableBody = document.getElementById('voice-table-body');
const searchInput = document.getElementById('search-input');
const filterAccent = document.getElementById('filter-accent');
const filterGender = document.getElementById('filter-gender');

speedSlider.oninput = () => {
  speedVal.textContent = speedSlider.value + 'x';
};

async function loadVoices() {
  try {
    const resp = await fetch('https://sdf-1alpha.tailc31025.ts.net:8096/v1/audio/voices');
    const data = await resp.json();
    const rawVoices = data.voices || [];

    const categories = {
      'af': { gender: 'Female', accent: 'American' },
      'am': { gender: 'Male', accent: 'American' },
      'bf': { gender: 'Female', accent: 'British' },
      'bm': { gender: 'Male', accent: 'British' },
      'ef': { gender: 'Female', accent: 'Spanish' },
      'em': { gender: 'Male', accent: 'Spanish' },
      'ff': { gender: 'Female', accent: 'French' },
      'hf': { gender: 'Female', accent: 'Hindi' },
      'hm': { gender: 'Male', accent: 'Hindi' },
      'if': { gender: 'Female', accent: 'Italian' },
      'im': { gender: 'Male', accent: 'Italian' },
      'jf': { gender: 'Female', accent: 'Japanese' },
      'jm': { gender: 'Male', accent: 'Japanese' },
      'pf': { gender: 'Female', accent: 'Portuguese' },
      'pm': { gender: 'Male', accent: 'Portuguese' },
      'zf': { gender: 'Female', accent: 'Mandarin' },
      'zm': { gender: 'Male', accent: 'Mandarin' }
    };

    allVoices = rawVoices.map(v => {
      const prefix = v.slice(0, 2);
      const cat = categories[prefix] || { gender: 'Voice', accent: 'General' };
      const name = v.slice(3).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return {
        id: v,
        name: `${name}`,
        fullName: `${name} (${cat.accent} ${cat.gender})`,
        accent: cat.accent,
        gender: cat.gender
      };
    });

    populateVoiceSelect();
    renderVoiceTable();
  } catch (e) {
    console.error('Failed to load voices:', e);
    document.getElementById('engine-status').textContent = 'Voice Gateway Offline';
  }
}

function populateVoiceSelect() {
  voiceSelect.innerHTML = '';
  allVoices.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.fullName;
    if (v.id === 'af_heart') opt.selected = true;
    voiceSelect.appendChild(opt);
  });
  selectedVoiceTag.textContent = voiceSelect.value;
}

voiceSelect.onchange = () => {
  selectedVoiceTag.textContent = voiceSelect.value;
  highlightSelectedVoiceInTable(voiceSelect.value);
};


function renderVoiceTable() {
  const q = searchInput.value.toLowerCase();
  const acc = filterAccent.value;
  const gen = filterGender.value;

  const filtered = allVoices.filter(v => {
    const matchesQ = v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q) || v.accent.toLowerCase().includes(q);
    const matchesAcc = !acc || v.accent === acc;
    const matchesGen = !gen || v.gender === gen;
    return matchesQ && matchesAcc && matchesGen;
  });

  voiceTableBody.innerHTML = '';
  if (filtered.length === 0) {
    voiceTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No matching voices found.</td></tr>';
    return;
  }

  filtered.forEach(v => {
    const tr = document.createElement('tr');
    if (v.id === voiceSelect.value) tr.classList.add('selected');
    tr.onclick = () => selectVoice(v.id);

    tr.innerHTML = `
      <td style="font-weight: 600; color: #fff;">${v.name}</td>
      <td style="font-family: monospace; font-size: 12px; color: var(--accent-blue);">${v.id}</td>
      <td>${v.accent}</td>
      <td>${v.gender}</td>
      <td><button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="event.stopPropagation(); previewVoice('${v.id}')">▶ Sample</button></td>
      <td><button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="event.stopPropagation(); selectVoice('${v.id}')">Select</button></td>
    `;
    voiceTableBody.appendChild(tr);
  });
}

function selectVoice(voiceId) {
  voiceSelect.value = voiceId;
  selectedVoiceTag.textContent = voiceId;
  highlightSelectedVoiceInTable(voiceId);
}

function highlightSelectedVoiceInTable(voiceId) {
  Array.from(voiceTableBody.querySelectorAll('tr')).forEach(tr => {
    const idCell = tr.children[1];
    if (idCell && idCell.textContent === voiceId) {
      tr.classList.add('selected');
    } else {
      tr.classList.remove('selected');
    }
  });
}

searchInput.oninput = renderVoiceTable;
filterAccent.onchange = renderVoiceTable;
filterGender.onchange = renderVoiceTable;
document.getElementById('btn-refresh-voices').onclick = loadVoices;

async function previewVoice(voiceId) {
  try {
    outputStatus.textContent = `Generating preview for ${voiceId}...`;
    const resp = await fetch('https://sdf-1alpha.tailc31025.ts.net:8096/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: `Hello, this is a sample of ${voiceId} synthesized locally.`,
        voice: voiceId,
        speed: 1.0
      })
    });
    const blob = await resp.blob();
    playAudioBlob(blob, `sample_${voiceId}.wav`, `Sample preview for ${voiceId}`);
  } catch (e) {
    outputStatus.textContent = 'Preview error: ' + e;
  }
}

btnSynthesize.onclick = async () => {
  const text = scriptText.value.trim();
  if (!text) {
    alert('Please enter text to synthesize.');
    return;
  }

  btnSynthesize.disabled = true;
  btnSynthesize.textContent = '⏳ Synthesizing Local Speech...';
  outputStatus.textContent = 'Generating speech with local Kokoro-ONNX engine...';

  try {
    const t0 = performance.now();
    const resp = await fetch('https://sdf-1alpha.tailc31025.ts.net:8096/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: text,
        voice: voiceSelect.value,
        speed: parseFloat(speedSlider.value)
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(err);
    }

    const blob = await resp.blob();
    const dur = ((performance.now() - t0) / 1000).toFixed(2);
    const fname = `voice_${voiceSelect.value}_${Date.now()}.wav`;

    playAudioBlob(blob, fname, `Synthesized in ${dur}s • ${voiceSelect.value} (${(blob.size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    outputStatus.textContent = 'Synthesis Error: ' + err.message;
  } finally {
    btnSynthesize.disabled = false;
    btnSynthesize.textContent = '⚡ Synthesize Voiceover (Local)';
  }
};

function playAudioBlob(blob, filename, statusMsg) {
  currentBlob = blob;
  currentFilename = filename;
  const audioUrl = URL.createObjectURL(blob);
  audioPlayer.src = audioUrl;
  audioPlayer.style.display = 'block';
  outputActions.style.display = 'flex';
  outputStatus.textContent = statusMsg;
  audioPlayer.play();
}

btnDownload.onclick = () => {
  if (!currentBlob) return;
  const a = document.createElement('a');
  a.href = audioPlayer.src;
  a.download = currentFilename || 'synthesized_voice.wav';
  a.click();
};

btnSendSoundCraft.onclick = () => {
  if (!currentBlob) return;
  window.open('https://sdf-1alpha.tailc31025.ts.net:8087/', '_blank');
};

btnPublishLore.onclick = async () => {
  if (!currentBlob) return;
  btnPublishLore.disabled = true;
  btnPublishLore.textContent = 'Publishing...';
  try {
    if (window.exportVoiceToLore) {
      const res = await window.exportVoiceToLore(
        currentBlob,
        currentFilename,
        scriptText.value,
        voiceSelect.value
      );
      alert('Successfully published to Lore asset registry!');
    } else {
      alert('Lore collab client not initialized.');
    }
  } catch (e) {
    alert('Failed to publish to Lore: ' + e);
  } finally {
    btnPublishLore.disabled = false;
    btnPublishLore.textContent = '📦 Publish to Lore';
  }
};

loadVoices();

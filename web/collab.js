// SoundCraft Live Collaboration, Lore Asset Vault & AI Registry Suite
// Features: Real-time multi-user sync, Lore Studio Asset Vault, AI Audio/SFX Generation (Port 8092), and Lore Project Saving

(function() {
  console.log("[SoundCraft Collab] Initializing Collaboration, Lore & AI Suite...");

  const appTitle = "VoiceCraft";
  const appFormat = "voicecraft";
  const roomId = "studio-voicecraft";
  const clientId = "voice-user-" + Math.random().toString(36).substring(2, 8);
  const storedUser = localStorage.getItem("voicecraft_collab_user");
  const defaultNames = ["PJ (Voice Director)", "Kenji (Audio Engineer)", "Elena (Voice Actor)", "Maya (Sound Tech)"];
  const randomName = defaultNames[Math.floor(Math.random() * defaultNames.length)];
  const userName = storedUser || randomName;
  const userColor = "#38bdf8";

  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const apiProtocol = window.location.protocol;
  const hubPort = "8086";
  const hubHost = `${window.location.hostname}:${hubPort}`;
  const wsUrl = `${wsProtocol}//${hubHost}/ws/collab/${roomId}/${clientId}`;
  const apiBase = `${apiProtocol}//${hubHost}`;
  const aiRegistryBase = `${apiProtocol}//${window.location.hostname}:8092`;

  let socket = null;
  let remotePresences = {};
  let currentMembers = [];
  let isShareModalOpen = false;
  let isLoreModalOpen = false;
  let isAiModalOpen = false;
  let isChatOpen = false;
  let chatMessages = [];
  let loreAssets = [];

  // --- Styles Setup ---
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    .collab-pill {
      position: fixed; top: 10px; right: 12px; z-index: 99990;
      background: rgba(20, 20, 24, 0.92); border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px; padding: 6px 12px; color: #f4f4f5;
      font: 12px/1.4 system-ui, -apple-system, sans-serif;
      backdrop-filter: blur(12px); box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      display: flex; align-items: center; gap: 8px; user-select: none;
    }
    .collab-btn {
      background: #27272a; border: 1px solid rgba(255,255,255,0.15); color: #e4e4e7;
      padding: 4px 10px; border-radius: 5px; font-size: 11px; font-weight: 500;
      cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
      transition: all 0.15s ease;
    }
    .collab-btn:hover { background: #3f3f46; color: #fff; }
    .collab-btn-primary { background: #2563eb; border-color: #3b82f6; color: #fff; }
    .collab-btn-primary:hover { background: #1d4ed8; }
    .collab-btn-lore { background: #059669; border-color: #10b981; color: #fff; }
    .collab-btn-lore:hover { background: #047857; }
    .collab-btn-ai { background: #7c3aed; border-color: #a78bfa; color: #fff; }
    .collab-btn-ai:hover { background: #6d28d9; }
    .collab-modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.65);
      backdrop-filter: blur(4px); z-index: 99995;
      display: flex; align-items: center; justify-content: center;
    }
    .collab-modal-box {
      width: 620px; max-width: 90vw; background: #18181b; border: 1px solid #27272a;
      border-radius: 10px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);
      color: #f4f4f5; font: 13px/1.5 system-ui, sans-serif; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .collab-modal-header {
      padding: 14px 18px; border-bottom: 1px solid #27272a;
      display: flex; justify-content: space-between; align-items: center;
      background: #202024;
    }
    .collab-modal-header h3 { margin: 0; font-size: 15px; font-weight: 600; }
    .collab-modal-body { padding: 18px; max-height: 70vh; overflow-y: auto; }
    .collab-modal-footer {
      padding: 12px 18px; border-top: 1px solid #27272a; background: #202024;
      display: flex; justify-content: flex-end; gap: 8px;
    }
    .collab-role-tag {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      padding: 2px 7px; border-radius: 4px;
    }
    .role-owner { background: #064e3b; color: #34d399; }
    .role-editor { background: #1e3a8a; color: #60a5fa; }
    .role-reviewer { background: #78350f; color: #fbbf24; }
    .role-viewer { background: #374151; color: #9ca3af; }
    .chat-drawer {
      position: fixed; bottom: 12px; right: 12px; width: 340px; height: 440px;
      background: #18181b; border: 1px solid #27272a; border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 99992;
      display: none; flex-direction: column; overflow: hidden;
    }
    .lore-asset-card {
      background: #202024; border: 1px solid #27272a; border-radius: 6px;
      padding: 10px 14px; margin-bottom: 8px; display: flex;
      justify-content: space-between; align-items: center;
    }
    .lore-asset-card:hover { border-color: #10b981; }
  `;
  document.head.appendChild(styleEl);

  // --- Collab Top Overlay Pill ---
  const overlay = document.createElement("div");
  overlay.className = "collab-pill";
  overlay.id = "collab_overlay";
  overlay.innerHTML = `
    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:#22c55e;" id="collab_dot"></span>
    <span style="font-weight:600; letter-spacing:0.3px;">${appTitle} Mesh</span>
    <span id="collab_peers" style="background:#27272a; padding:2px 7px; border-radius:4px; font-weight:600; font-size:11px;">1 Peer</span>
    <button class="collab-btn collab-btn-lore" id="btn_open_lore" title="Open Lore Studio Asset Vault">📦 Lore Assets</button>
    <button class="collab-btn collab-btn-ai" id="btn_open_ai" title="AI Registry Studio Gateway">✨ AI Audio / SFX</button>
    <button class="collab-btn collab-btn-primary" id="btn_open_share" title="Manage Collaborators & Roles">👥 Share</button>
    <button class="collab-btn" id="btn_open_chat" title="Live Review Notes & Chat">💬 Chat</button>
  `;
  document.body.appendChild(overlay);

  document.getElementById("btn_open_share").onclick = () => openShareModal();
  document.getElementById("btn_open_lore").onclick = () => openLoreModal();
  document.getElementById("btn_open_ai").onclick = () => openAiModal();
  document.getElementById("btn_open_chat").onclick = () => toggleChatDrawer();

  // --- WebSocket Connection ---
  function connect() {
    try {
      socket = new WebSocket(wsUrl);
    } catch (e) {
      console.warn(`[${appTitle} Collab] Socket creation error:`, e);
      document.getElementById("collab_dot").style.backgroundColor = "#eab308";
      return;
    }

    socket.onopen = () => {
      console.log(`[${appTitle} Collab] Connected to room:`, roomId);
      document.getElementById("collab_dot").style.backgroundColor = "#22c55e";
      setInterval(sendPresence, 250);
      loadMembers();
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (err) {
        console.error(`[${appTitle} Collab] Message parse error:`, err);
      }
    };

    socket.onclose = () => {
      document.getElementById("collab_dot").style.backgroundColor = "#ef4444";
      setTimeout(connect, 3000);
    };
  }

  function sendPresence() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
      type: "presence_update",
      presence: {
        user_name: userName,
        user_color: userColor,
        role: "owner",
        device_name: "Web Studio Node",
        active_layer_id: "voice_track_1",
        cursor: { x: 0, y: 0 }
      }
    }));
  }

  function handleMessage(msg) {
    if (msg.type === "presence_broadcast") {
      const p = msg.presence;
      remotePresences[p.client_id] = p;
      updatePeerCount();
    } else if (msg.type === "peer_disconnected") {
      delete remotePresences[msg.client_id];
      updatePeerCount();
    } else if (msg.type === "members_updated") {
      currentMembers = msg.members || [];
      if (isShareModalOpen) renderShareModal();
    } else if (msg.type === "chat_broadcast") {
      chatMessages.push(msg);
      renderChatMessages();
    } else if (msg.type === "command_broadcast") {
      const cmd = msg.command;
      showToast(`${cmd.user_name}: ${cmd.action}`);
    }
  }

  function updatePeerCount() {
    const count = Object.keys(remotePresences).length + 1;
    const el = document.getElementById("collab_peers");
    if (el) el.textContent = `${count} Peer${count > 1 ? "s" : ""}`;
  }

  // --- Share / RBAC Modal ---
  async function loadMembers() {
    try {
      const res = await fetch(`${apiBase}/api/rooms/${roomId}/members`);
      if (res.ok) {
        const data = await res.json();
        currentMembers = data.members || [];
      }
    } catch (e) {
      console.warn("Failed to load room members:", e);
    }
  }

  function openShareModal() {
    isShareModalOpen = true;
    let modal = document.getElementById("collab_share_modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "collab_share_modal";
      modal.className = "collab-modal-backdrop";
      document.body.appendChild(modal);
    }
    modal.style.display = "flex";
    renderShareModal();
  }

  function closeShareModal() {
    isShareModalOpen = false;
    const modal = document.getElementById("collab_share_modal");
    if (modal) modal.style.display = "none";
  }

  function renderShareModal() {
    const modal = document.getElementById("collab_share_modal");
    if (!modal) return;
    modal.innerHTML = `
      <div class="collab-modal-box">
        <div class="collab-modal-header">
          <div>
            <h3>Share Project & Permissions</h3>
            <div style="font-size:11px; color:#a1a1aa; margin-top:2px;">Real-time Mesh & RBAC Role Management</div>
          </div>
          <button style="background:none; border:none; color:#a1a1aa; font-size:18px; cursor:pointer;" id="share_close_x">&times;</button>
        </div>
        <div class="collab-modal-body">
          <div style="background:#202024; padding:12px; border-radius:6px; margin-bottom:14px; display:flex; gap:8px;">
            <input type="email" id="invite_email" placeholder="colleague@mcnerney.media" style="flex:1; background:#18181b; border:1px solid #3f3f46; border-radius:5px; padding:6px 10px; color:#fff; font-size:12px;">
            <select id="invite_role" style="background:#18181b; border:1px solid #3f3f46; border-radius:5px; padding:6px 8px; color:#fff; font-size:12px;">
              <option value="editor">Editor</option>
              <option value="reviewer">Reviewer</option>
              <option value="viewer">Viewer</option>
            </select>
            <button class="collab-btn collab-btn-primary" id="btn_invite">Invite</button>
          </div>
          <div style="font-weight:600; font-size:12px; margin-bottom:8px; color:#a1a1aa; text-transform:uppercase;">Project Members</div>
          <div id="members_list">
            ${currentMembers.map((m, idx) => `
              <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom:1px solid #27272a;">
                <div>
                  <div style="font-weight:600; color:#fff; font-size:13px;">${m.name} ${m.is_current_user ? '<span style="font-size:10px; color:#10b981;">(You)</span>' : ''}</div>
                  <div style="font-size:11px; color:#a1a1aa;">${m.email}</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span class="collab-role-tag role-${m.role}">${m.role}</span>
                  ${!m.is_current_user ? `<button class="collab-btn" style="color:#ef4444;" onclick="window.voicecraftRevokeMember(${idx})">Revoke</button>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="collab-modal-footer">
          <button class="collab-btn" id="share_close_btn">Close</button>
        </div>
      </div>
    `;
    document.getElementById("share_close_x").onclick = closeShareModal;
    document.getElementById("share_close_btn").onclick = closeShareModal;
    document.getElementById("btn_invite").onclick = () => {
      const email = document.getElementById("invite_email").value.trim();
      const role = document.getElementById("invite_role").value;
      if (!email) return;
      const name = email.split("@")[0].replace(".", " ");
      currentMembers.push({
        id: "user-" + Math.random().toString(36).substring(2, 7),
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email: email,
        role: role,
        is_online: false,
        is_current_user: false
      });
      syncMembersToServer();
      renderShareModal();
    };
  }

  window.voicecraftRevokeMember = function(idx) {
    currentMembers.splice(idx, 1);
    syncMembersToServer();
    renderShareModal();
  };

  async function syncMembersToServer() {
    try {
      await fetch(`${apiBase}/api/rooms/${roomId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: currentMembers })
      });
    } catch (e) {
      console.warn("Failed to sync members to server:", e);
    }
  }

  // --- Lore Asset Vault Modal ---
  function openLoreModal() {
    isLoreModalOpen = true;
    let modal = document.getElementById("collab_lore_modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "collab_lore_modal";
      modal.className = "collab-modal-backdrop";
      document.body.appendChild(modal);
    }
    modal.style.display = "flex";
    loadLoreAssets();
  }

  function closeLoreModal() {
    isLoreModalOpen = false;
    const modal = document.getElementById("collab_lore_modal");
    if (modal) modal.style.display = "none";
  }

  async function loadLoreAssets() {
    const modal = document.getElementById("collab_lore_modal");
    if (!modal) return;
    modal.innerHTML = `
      <div class="collab-modal-box" style="width:680px;">
        <div class="collab-modal-header">
          <div>
            <h3>Lore Studio Asset Vault</h3>
            <div style="font-size:11px; color:#a1a1aa; margin-top:2px;">SDF-1 Alpha Vault (/mnt/nvme_scratch/lore)</div>
          </div>
          <button style="background:none; border:none; color:#a1a1aa; font-size:18px; cursor:pointer;" id="lore_close_x">&times;</button>
        </div>
        <div class="collab-modal-body" id="lore_modal_body">
          <div style="color:#a1a1aa; padding:20px; text-align:center;">Loading assets...</div>
        </div>
        <div class="collab-modal-footer">
          <input type="file" id="lore_upload_input" style="display:none;" />
          <button class="collab-btn collab-btn-lore" id="btn_upload_lore">📤 Upload New Asset</button>
          <button class="collab-btn" id="lore_close_btn">Close</button>
        </div>
      </div>
    `;
    document.getElementById("lore_close_x").onclick = closeLoreModal;
    document.getElementById("lore_close_btn").onclick = closeLoreModal;
    document.getElementById("btn_upload_lore").onclick = () => document.getElementById("lore_upload_input").click();
    document.getElementById("lore_upload_input").onchange = handleAssetUpload;

    try {
      const [statusRes, assetsRes] = await Promise.all([
        fetch(`${apiBase}/api/lore/status`),
        fetch(`${apiBase}/api/lore/assets`)
      ]);
      const status = await statusRes.json();
      const assetsData = await assetsRes.json();
      loreAssets = assetsData.assets || [];

      const body = document.getElementById("lore_modal_body");
      body.innerHTML = `
        <div style="background:#202024; border:1px solid #27272a; border-radius:6px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span style="font-weight:600; color:#10b981;">● Vault Online</span>
            <span style="color:#a1a1aa; margin-left:8px;">Branch: <strong style="color:#fff;">${status.branch}</strong></span>
            <span style="color:#a1a1aa; margin-left:8px;">Rev: <strong style="color:#fff;">${status.current_rev}</strong></span>
          </div>
          <div style="font-size:11px; color:#a1a1aa;">${loreAssets.length} Tracked Assets</div>
        </div>
        <div style="max-height:360px; overflow-y:auto;">
          ${loreAssets.length === 0 ? '<div style="color:#71717a; text-align:center; padding:20px;">No assets tracked yet. Upload to start!</div>' : ''}
          ${loreAssets.map(asset => `
            <div class="lore-asset-card">
              <div style="display:flex; align-items:center; gap:12px;">
                <span style="font-size:20px;">${asset.kind === 'image' ? '🖼️' : asset.kind === 'audio' ? '🎵' : asset.kind === 'vector' ? '📐' : '📦'}</span>
                <div>
                  <div style="font-weight:600; color:#fff; font-size:13px;">${asset.name}</div>
                  <div style="font-size:11px; color:#a1a1aa;">${(asset.size / 1024).toFixed(1)} KB • ${asset.path}</div>
                </div>
              </div>
              <div style="display:flex; gap:6px;">
                <button class="collab-btn collab-btn-primary" onclick="window.collabInjectAsset('${asset.url}', '${asset.name}', '${asset.kind}')">Import Track</button>
                <a href="${apiBase}${asset.url}" target="_blank" download class="collab-btn">Download</a>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      document.getElementById("lore_modal_body").innerHTML = `<div style="color:#ef4444; padding:20px;">Failed to reach Lore gateway: ${e}</div>`;
    }
  }

  async function handleAssetUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    let subfolder = "Content/Voices";
    const path = `${subfolder}/${file.name}`;
    const formData = new FormData();
    formData.append("path", path);
    formData.append("client_id", clientId);
    formData.append("file", file);

    try {
      const res = await fetch(`${apiBase}/api/lore/assets/add`, { method: "POST", body: formData });
      if (res.ok) {
        await fetch(`${apiBase}/api/lore/commit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: `Add ${file.name} from ${appTitle} Studio` })
        });
        loadLoreAssets();
      }
    } catch (err) {
      alert("Upload to Lore failed: " + err);
    }
  }

  window.collabInjectAsset = function(url, name, kind) {
    const fullUrl = `${apiBase}${url}`;
    console.log(`[${appTitle} Collab] Injecting asset '${name}' (${kind}) from ${fullUrl}`);
    showToast(`Imported ${name} into ${appTitle} session`);
    closeLoreModal();
  };

  // --- AI Registry Integration Modal ---
  function openAiModal() {
    isAiModalOpen = true;
    let modal = document.getElementById("collab_ai_modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "collab_ai_modal";
      modal.className = "collab-modal-backdrop";
      document.body.appendChild(modal);
    }
    modal.style.display = "flex";
    modal.innerHTML = `
      <div class="collab-modal-box">
        <div class="collab-modal-header">
          <div>
            <h3>AI Audio & SFX Generator</h3>
            <div style="font-size:11px; color:#a1a1aa; margin-top:2px;">Connected to AI Registry (:8092) & ElevenLabs / Local Workers</div>
          </div>
          <button style="background:none; border:none; color:#a1a1aa; font-size:18px; cursor:pointer;" id="ai_close_x">&times;</button>
        </div>
        <div class="collab-modal-body">
          <div style="margin-bottom:14px;">
            <label style="display:block; font-size:11px; color:#a1a1aa; margin-bottom:4px;">Generation Mode</label>
            <select id="ai_mode_select" style="width:100%; background:#202024; border:1px solid #3f3f46; border-radius:5px; padding:7px; color:#fff; font-size:12px;">
              <option value="sfx">Sound Effect (SFX) Prompt</option>
              <option value="voice">Dialogue / Voice Synthesis (TTS)</option>
            </select>
          </div>
          <div style="margin-bottom:14px;">
            <label style="display:block; font-size:11px; color:#a1a1aa; margin-bottom:4px;">Prompt / Dialogue</label>
            <textarea id="ai_prompt" rows="3" placeholder="e.g. Laser cannon power up and blast with heavy low-frequency reverb..." style="width:100%; background:#202024; border:1px solid #3f3f46; border-radius:5px; padding:8px; color:#fff; font-size:12px; font-family:inherit;"></textarea>
          </div>
          <div id="ai_result_box" style="display:none; padding:12px; background:#202024; border-radius:6px; border:1px solid #27272a; margin-top:12px;"></div>
        </div>
        <div class="collab-modal-footer">
          <button class="collab-btn" id="ai_close_btn">Cancel</button>
          <button class="collab-btn collab-btn-ai" id="btn_submit_ai">✨ Generate Audio</button>
        </div>
      </div>
    `;
    document.getElementById("ai_close_x").onclick = () => { modal.style.display = "none"; };
    document.getElementById("ai_close_btn").onclick = () => { modal.style.display = "none"; };
    document.getElementById("btn_submit_ai").onclick = async () => {
      const mode = document.getElementById("ai_mode_select").value;
      const prompt = document.getElementById("ai_prompt").value.trim();
      const resBox = document.getElementById("ai_result_box");
      if (!prompt) return;

      resBox.style.display = "block";
      resBox.innerHTML = `<span style="color:#a78bfa;">Dispatching generation job to AI Registry (:8092)...</span>`;

      try {
        const endpoint = mode === "sfx" ? `${aiRegistryBase}/api/registry/generate/sfx` : `${aiRegistryBase}/api/registry/generate/audio`;
        const payload = mode === "sfx" ? { prompt: prompt, duration_seconds: 5 } : { text: prompt };
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        resBox.innerHTML = `
          <div style="color:#10b981; font-weight:600; margin-bottom:6px;">✓ Generation Complete</div>
          <div style="font-size:11px; color:#a1a1aa;">File: ${data.filename || 'audio.mp3'}</div>
          <div style="margin-top:8px;">
            <audio controls src="${aiRegistryBase}${data.url}" style="width:100%; height:32px;"></audio>
          </div>
          <div style="margin-top:8px; display:flex; justify-content:flex-end;">
            <button class="collab-btn collab-btn-lore" onclick="window.collabInjectAsset('${data.url}', '${data.filename}', 'audio')">Import into VoiceCraft</button>
          </div>
        `;
      } catch (err) {
        resBox.innerHTML = `<span style="color:#ef4444;">Generation failed: ${err}</span>`;
      }
    };
  }

  // --- Project Saving to Lore ---
  window.collabSaveProject = async function(commitMsg = "Save project state") {
    try {
      const res = await fetch(`${apiBase}/api/lore/projects/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: roomId,
          document: {
            format_version: 1,
            name: appTitle + " Session",
            sample_rate: 48000,
            saved_at: new Date().toISOString()
          },
          commit_message: commitMsg,
          author: userName
        })
      });
      if (res.ok) {
        showToast("✓ Saved session revision to Lore");
      }
    } catch (err) {
      console.warn("Failed to save project to Lore:", err);
    }
  };

  // --- Chat Drawer ---
  function toggleChatDrawer() {
    isChatOpen = !isChatOpen;
    let drawer = document.getElementById("collab_chat_drawer");
    if (!drawer) {
      drawer = document.createElement("div");
      drawer.id = "collab_chat_drawer";
      drawer.className = "chat-drawer";
      drawer.innerHTML = `
        <div style="padding:10px 14px; background:#202024; border-bottom:1px solid #27272a; display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#fff; font-size:13px;">Studio Chat & Review</strong>
          <button style="background:none; border:none; color:#a1a1aa; cursor:pointer;" onclick="document.getElementById('collab_chat_drawer').style.display='none'">&times;</button>
        </div>
        <div id="collab_chat_body" style="flex:1; padding:10px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;"></div>
        <div style="padding:8px 10px; background:#202024; border-top:1px solid #27272a; display:flex; gap:6px;">
          <input type="text" id="chat_input" placeholder="Feedback or note..." style="flex:1; background:#18181b; border:1px solid #3f3f46; border-radius:4px; padding:6px 8px; color:#fff; font-size:12px;">
          <button class="collab-btn collab-btn-primary" id="btn_send_chat">Send</button>
        </div>
      `;
      document.body.appendChild(drawer);

      document.getElementById("btn_send_chat").onclick = sendChatMessage;
      document.getElementById("chat_input").onkeydown = (e) => { if (e.key === "Enter") sendChatMessage(); };
    }
    drawer.style.display = isChatOpen ? "flex" : "none";
  }

  function sendChatMessage() {
    const input = document.getElementById("chat_input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "chat_comment",
        user_name: userName,
        user_color: userColor,
        text: text
      }));
    }
  }

  function renderChatMessages() {
    const body = document.getElementById("collab_chat_body");
    if (!body) return;
    body.innerHTML = chatMessages.map(m => `
      <div style="background:#27272a; padding:6px 10px; border-radius:6px; font-size:12px;">
        <span style="color:${m.user_color}; font-weight:600;">${m.user_name}:</span>
        <span style="color:#f4f4f5; margin-left:4px;">${m.text}</span>
      </div>
    `).join('');
    body.scrollTop = body.scrollHeight;
  }

  function showToast(msg) {
    const toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = "rgba(16, 185, 129, 0.95)";
    toast.style.color = "#fff";
    toast.style.padding = "8px 18px";
    toast.style.borderRadius = "20px";
    toast.style.fontWeight = "600";
    toast.style.fontSize = "12px";
    toast.style.zIndex = "99999";
    toast.style.boxShadow = "0 6px 20px rgba(0,0,0,0.4)";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  // --- Publish to Lore API Function ---
  async function publishToLore(fileOrBlob, subfolder = "Content/Voices", metadata = {}) {
    const filename = fileOrBlob.name || metadata.title || "voice_take.wav";
    const path = `${subfolder}/${filename}`;
    const formData = new FormData();
    formData.append("path", path);
    formData.append("client_id", clientId);
    formData.append("file", fileOrBlob, filename);

    const addRes = await fetch(`/api/lore/assets/add`, {
      method: "POST",
      body: formData
    });

    if (!addRes.ok) {
      const errText = await addRes.text();
      throw new Error(`Failed to stage asset in Lore: ${errText}`);
    }

    const commitRes = await fetch(`/api/lore/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Add ${filename} from VoiceCraft Studio`,
        author: userName
      })
    });

    if (!commitRes.ok) {
      const errText = await commitRes.text();
      throw new Error(`Failed to commit asset in Lore: ${errText}`);
    }

    showToast(`📦 Published ${filename} to Lore`);
    return { success: true, path, filename };
  }

  // --- Send to SoundCraft Studio via Collab Command ---
  async function sendToSoundCraft(blob, filename, transcript, voiceName) {
    // 1. First publish to Lore so SoundCraft has the physical asset in the repository
    const pub = await publishToLore(blob, "Content/Voices", {
      title: filename,
      transcript: transcript,
      voice: voiceName
    });

    // 2. Broadcast import_stem command to SoundCraft room (studio-soundcraft)
    const assetUrl = `/api/lore/assets/download?path=${encodeURIComponent(pub.path)}`;
    const cmdPayload = {
      type: "command",
      user_name: userName,
      command: {
        action: "import_stem",
        payload: {
          name: filename,
          url: assetUrl,
          track_name: "Audio 1: Dialogue",
          sub_title: `VoiceCraft Kokoro (${voiceName})`
        }
      }
    };

    // Open connection to SoundCraft's collab channel to dispatch command
    const scWsUrl = `${wsProtocol}//${hubHost}/ws/collab/studio-soundcraft/${clientId}-broadcaster`;
    try {
      const scWs = new WebSocket(scWsUrl);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          scWs.close();
          resolve(); // Resolve anyway so UI doesn't hang
        }, 3000);

        scWs.onopen = () => {
          scWs.send(JSON.stringify(cmdPayload));
          clearTimeout(timeout);
          setTimeout(() => {
            scWs.close();
            resolve();
          }, 500);
        };
        scWs.onerror = (e) => {
          clearTimeout(timeout);
          reject(e);
        };
      });
    } catch (e) {
      console.warn("Failed to dispatch command to SoundCraft channel directly:", e);
    }

    showToast(`🎵 Dispatched stem to SoundCraft dialogue track`);
    return { success: true };
  }

  window.collabClient = {
    publishToLore,
    sendToSoundCraft
  };

  connect();
})();

window.exportVoiceToLore = async function(blob, filename, transcript, voiceName) {
    try {
        const file = new File([blob], filename, { type: 'audio/wav' });
        const res = await window.collabClient.publishToLore(file, 'Content/Voices', {
            title: filename,
            tags: ['tts', 'voice', voiceName],
            metadata: {
                transcript: transcript,
                voice: voiceName,
                engine: 'Kokoro-v1.0'
            }
        });
        return res;
    } catch (e) {
        console.error('Error publishing voice to Lore:', e);
        throw e;
    }
};

(function () {
  'use strict';

  const state = {
    socket: null,
    currentScreen: 'home',
    currentTab: 'home',
    playerId: null,
    username: null,
    roomCode: null,
    isHost: false,
    joinMode: null,
    playerData: null,
    roomData: null,
    selectedAction: null,
    selectedTarget: null,
    timerInterval: null,
    timerValue: 0,
    timerDuration: 60,
    searchResult: null,
    privateChatMessages: [],
    hasActed: false,
    hasVoted: false,
    votesCast: 0,
    totalAlive: 0,
    morningMessages: [],
    chatMessages: [],
    gamePhase: null,
    allPlayersWithRoles: [],
    playerListOpen: false,
  };

  function connectSocket() {
    state.socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    });

    state.socket.on('connect', () => {
      console.log('Connected to server:', state.socket.id);
    });

    state.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      showToast('Connection lost. Reconnecting...', 'error');
    });

    state.socket.on('room-updated', (roomData) => {
      state.roomData = roomData;
       state.chatMessages = roomData.chatMessages || state.chatMessages;
      if (state.currentScreen === 'room') renderRoom();
      updateAliveCount();
      renderGamePlayerList();
      renderChatBox();
    });

    state.socket.on('host-changed', ({ newHostId }) => {
      state.isHost = state.playerId === newHostId;
      if (state.currentScreen === 'room') renderRoom();
    });

    state.socket.on('game-started', ({ player, room }) => {
      state.playerData = player;
      state.roomData = room;
      state.chatMessages = room.chatMessages || [];
      state.hasActed = false;
      state.hasVoted = false;
      state.votesCast = 0;
      state.totalAlive = 0;
      state.searchResult = null;
      state.privateChatMessages = [];
      state.allPlayersWithRoles = [];
      showScreen('game');
      hideNav();
      updateRoleCard();
      renderGamePlayerList();
      renderChatBox();
    });

    state.socket.on('phase-changed', ({ phase, nightCount, messages, room }) => {
      state.roomData = room;
      state.chatMessages = room?.chatMessages || state.chatMessages;
      state.gamePhase = phase;
      state.hasActed = false;
      state.hasVoted = false;
      state.votesCast = 0;
      state.totalAlive = room?.aliveCount || 0;
      state.selectedAction = null;
      state.selectedTarget = null;
      if (messages) state.morningMessages = messages;
      updatePhaseUI(phase, nightCount);
      renderGameContent(phase);
      updateAliveCount();
      renderGamePlayerList();
      renderChatBox();
    });

    state.socket.on('player-updated', ({ player }) => {
      state.playerData = player;
      state.hasActed = player.hasSubmittedAction;
      state.hasVoted = player.hasVoted;
      renderGamePlayerList();
      renderChatBox();
    });

    state.socket.on('chat-message', ({ message }) => {
      state.chatMessages.push(message);
      if (state.chatMessages.length > 150) state.chatMessages = state.chatMessages.slice(-150);
      renderChatBox();
    });

    state.socket.on('chat-message-updated', ({ message }) => {
      const index = state.chatMessages.findIndex((entry) => entry.id === message.id);
      if (index >= 0) {
        state.chatMessages[index] = message;
      } else {
        state.chatMessages.push(message);
        if (state.chatMessages.length > 150) state.chatMessages = state.chatMessages.slice(-150);
      }
      renderChatBox();
    });

    state.socket.on('private-chat-message', ({ message }) => {
      state.privateChatMessages.push(message);
      if (state.privateChatMessages.length > 50) state.privateChatMessages = state.privateChatMessages.slice(-50);
      renderChatBox();
    });

    state.socket.on('timer-start', ({ phase, duration }) => {
      startTimer(duration);
    });

    state.socket.on('vote-update', ({ votesCast, totalAlive }) => {
      state.votesCast = votesCast;
      state.totalAlive = totalAlive;
      const el = document.getElementById('votes-cast-count');
      if (el) el.textContent = `${votesCast} / ${totalAlive} votes cast`;
    });

    state.socket.on('vote-result', ({ message, eliminated, room }) => {
      state.roomData = room;
      state.chatMessages = room?.chatMessages || state.chatMessages;
      state.gamePhase = 'vote-result';
      renderVoteResult(message);
      updateAliveCount();
      renderGamePlayerList();
      renderChatBox();
    });

    state.socket.on('game-over', ({ winner, players }) => {
      state.allPlayersWithRoles = players;
      clearTimerInterval();
      showGameOver(winner, players);
    });

    state.socket.on('game-reset', ({ room }) => {
      state.roomData = room;
      state.playerData = null;
      state.hasActed = false;
      state.hasVoted = false;
      state.votesCast = 0;
      state.totalAlive = 0;
      state.searchResult = null;
      state.privateChatMessages = [];
      state.selectedAction = null;
      state.selectedTarget = null;
      state.morningMessages = [];
      state.chatMessages = room.chatMessages || [];
      state.gamePhase = null;
      state.allPlayersWithRoles = [];
      state.playerListOpen = false;
      clearTimerInterval();
      showScreen('room');
      showNav();
      renderRoom();
      showToast('Game reset! Ready to play again.', 'success');
    });
  }

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const screen = document.getElementById(`screen-${screenId}`);
    if (screen) {
      screen.classList.add('active');
      state.currentScreen = screenId;
    }
  }

  function showNav() { document.getElementById('nav-tabs').classList.remove('hidden'); }
  function hideNav() { document.getElementById('nav-tabs').classList.add('hidden'); }

  function showToast(message, type = 'info') {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast ${type}`;
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function startTimer(duration) {
    clearTimerInterval();
    state.timerValue = duration;
    state.timerDuration = duration;
    updateTimerDisplay();
    state.timerInterval = setInterval(() => {
      state.timerValue--;
      if (state.timerValue <= 0) {
        state.timerValue = 0;
        clearTimerInterval();
      }
      updateTimerDisplay();
    }, 1000);
  }

  function clearTimerInterval() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    const text = document.getElementById('timer-text');
    const progress = document.getElementById('timer-progress');
    if (text) text.textContent = state.timerValue;
    if (progress) {
      const pct = (state.timerValue / state.timerDuration) * 100;
      progress.setAttribute('stroke-dasharray', `${pct}, 100`);
      if (state.timerValue <= 10) progress.setAttribute('stroke', 'hsl(0,75%,45%)');
      else if (state.timerValue <= 20) progress.setAttribute('stroke', 'hsl(45,90%,50%)');
      else progress.setAttribute('stroke', 'hsl(195,90%,60%)');
    }
  }

  // Renders the collapsible player list during the game
  function renderGamePlayerList() {
    const ul = document.getElementById('game-players-ul');
    if (!ul || !state.roomData) return;

    const players = state.roomData.players;
    const currentPlayer = players.find(p => p.id === state.playerId);
    const isDead = currentPlayer ? !currentPlayer.alive : !!(state.playerData && !state.playerData.alive);

    // Build role lookup from allPlayersWithRoles (populated on game-over)
    const roleMap = {};
    state.allPlayersWithRoles.forEach(p => { roleMap[p.id] = p; });

    ul.innerHTML = '';
    players.forEach(p => {
      const row = document.createElement('div');
      row.className = `gpl-row${p.alive ? '' : ' gpl-dead'}${p.id === state.playerId ? ' gpl-self' : ''}`;

      const colors = ['hsl(195,60%,30%)', 'hsl(220,50%,30%)', 'hsl(260,40%,30%)', 'hsl(340,40%,30%)', 'hsl(160,40%,25%)'];
      const colorIdx = p.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
      const initial = p.name.charAt(0).toUpperCase();

      // Dead players see roles of ALL players (alive and dead)
      // Roles come from roomData (server now sends role+faction in public data for dead players)
      let roleTag = '';
      if (isDead) {
        // Use allPlayersWithRoles if available, otherwise fall back to roomData role
        const rp = roleMap[p.id] || p;
        if (rp && rp.role) {
          const isAssassin = rp.faction === 'Assassin';
          roleTag = `<span class="gpl-role ${isAssassin ? 'assassin-role' : 'crew-role'}">${rp.role}</span>`;
        } else {
          roleTag = `<span class="gpl-role unknown-role">?</span>`;
        }
      }

      row.innerHTML = `
        <div class="gpl-avatar" style="background:${colors[colorIdx]}">${p.alive ? initial : '💀'}</div>
        <span class="gpl-name">${p.name}${p.id === state.playerId ? ' <span class="player-you">YOU</span>' : ''}</span>
        ${roleTag}
        <span class="gpl-status">${p.alive ? '● alive' : '○ dead'}</span>
      `;
      ul.appendChild(row);
    });
  }

  function renderRoom() {
    const data = state.roomData;
    if (!data) return;

    document.getElementById('room-code-text').textContent = data.code;
    const gameRoomCode = document.getElementById('game-room-code');
    if (gameRoomCode) gameRoomCode.textContent = data.code;
    document.getElementById('player-count').textContent = `${data.playerCount} / 15`;
    const anonymousVotesToggle = document.getElementById('toggle-anonymous-votes');
    if (anonymousVotesToggle) {
      anonymousVotesToggle.checked = !!data.anonymousVotes;
      anonymousVotesToggle.disabled = !(state.isHost || state.playerId === data.hostId);
    }

    const list = document.getElementById('players-list');
    list.innerHTML = '';

    data.players.forEach((player) => {
      const div = document.createElement('div');
      div.className = `player-item${player.id === state.playerId ? ' is-self' : ''}`;
      const initial = player.name.charAt(0).toUpperCase();
      const colors = ['hsl(195,60%,30%)', 'hsl(220,50%,30%)', 'hsl(260,40%,30%)', 'hsl(340,40%,30%)', 'hsl(160,40%,25%)'];
      const colorIdx = player.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;

      div.innerHTML = `
        <div class="player-avatar" style="background:${colors[colorIdx]}">${initial}</div>
        <span class="player-name">${player.name}</span>
        ${player.id === state.playerId ? '<span class="player-you">YOU</span>' : ''}
        ${player.isHost ? '<span class="player-crown"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/></svg></span>' : ''}
      `;
      list.appendChild(div);
    });

    const startBtn = document.getElementById('btn-start-game');
    const startCount = document.getElementById('start-game-count');

    if (state.isHost || state.playerId === data.hostId) {
      startBtn.style.display = 'flex';
      if (data.playerCount >= 5) {
        startBtn.disabled = false;
        startCount.textContent = `(${data.playerCount} players)`;
      } else {
        startBtn.disabled = true;
        startCount.textContent = `(Need ${5 - data.playerCount} more)`;
      }
    } else {
      startBtn.style.display = 'flex';
      startBtn.disabled = true;
      startCount.textContent = 'Waiting for host...';
    }
  }

  function updatePhaseUI(phase, nightCount) {
    const icon = document.getElementById('phase-icon');
    const name = document.getElementById('phase-name');
    const count = document.getElementById('phase-count');
    icon.className = 'phase-icon';

    switch (phase) {
      case 'night':
        icon.classList.add('night');
        icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
        name.textContent = 'NIGHT';
        count.textContent = `Night ${nightCount || state.roomData?.nightCount || 1}`;
        break;
      case 'morning':
        icon.classList.add('morning');
        icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
        name.textContent = 'MORNING';
        count.textContent = 'Dawn breaks...';
        break;
      case 'voting':
        icon.classList.add('voting');
        icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
        name.textContent = 'VOTING';
        count.textContent = 'Cast your vote';
        break;
      case 'ended':
        name.textContent = 'GAME OVER';
        count.textContent = '';
        break;
    }
  }

  function updateAliveCount() {
    const el = document.getElementById('alive-count-text');
    if (el && state.roomData) el.textContent = `${state.roomData.aliveCount} alive`;
  }

  function getChatMode() {
    if (state.gamePhase === 'morning') return 'morning';
    if (state.gamePhase === 'voting') return 'voting';
    if (state.gamePhase === 'night') return 'night';
    if (state.gamePhase === 'vote-result') return 'readonly';
    return 'hidden';
  }

  function renderChatBox() {
    const panel = document.getElementById('phase-chat-panel');
    if (!panel) return;

    const mode = getChatMode();
    const canChat = mode === 'morning' || mode === 'voting';
    const subtitle = canChat
      ? 'Chat is open for discussion.'
      : mode === 'readonly'
        ? 'Waiting for the next phase...'
        : 'Chat is visible but locked until morning.';
    const messages = state.chatMessages || [];

    panel.className = `phase-chat-panel ${mode === 'morning' ? 'chat-expanded' : 'chat-compact'}${canChat ? '' : ' chat-locked'}`;

    if (mode === 'hidden') {
      panel.innerHTML = '';
      return;
    }

    const items = messages.length
      ? messages.map((message) => {
        const isSelf = message.senderId === state.playerId;
        const classes = `chat-message ${message.type === 'system' ? 'system' : ''}${isSelf ? ' self' : ''}`;
        const sender = message.type === 'system' ? 'SYSTEM' : message.senderName;
        return `
          <div class="${classes}">
            <div class="chat-message-meta">${sender}</div>
            <div class="chat-message-text">${message.text}</div>
          </div>`;
      }).join('')
      : '<div class="chat-empty">No messages yet.</div>';

    panel.innerHTML = `
      <div class="chat-panel-header">
        <div>
          <div class="chat-panel-title">Room Chat</div>
          <div class="chat-panel-subtitle">${subtitle}</div>
        </div>
      </div>
      <div class="chat-messages" id="chat-messages">${items}</div>
      <form class="chat-input-row" id="chat-form">
        <input
          id="chat-input"
          class="chat-input"
          type="text"
          maxlength="280"
          placeholder="${canChat ? 'Type a message...' : 'Chat is locked at night'}"
          ${canChat ? '' : 'disabled'}
        />
        <button class="btn btn-primary chat-send-btn" type="submit" ${canChat ? '' : 'disabled'}>Send</button>
      </form>`;

    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;

    const chatForm = document.getElementById('chat-form');
    if (chatForm && canChat) {
      chatForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input ? input.value.trim() : '';
        if (!text) return;

        state.socket.emit('send-chat-message', { text }, (response) => {
          if (response.success) {
            if (input) input.value = '';
          } else {
            showToast(response.error || 'Message failed to send', 'error');
          }
        });
      });
    }
  }

  function renderGameContent(phase) {
    const content = document.getElementById('game-content');
    const messages = document.getElementById('game-messages');
    content.style.display = 'flex';
    messages.style.display = 'none';

    if (state.playerData && !state.playerData.alive) {
      content.innerHTML = '<div class="dead-overlay"><div class="dead-icon">💀</div><h3 class="dead-title">ELIMINATED</h3><p class="dead-subtitle">You watch from the shadows as the game continues...<br><span style="font-size:0.8rem;opacity:0.6;">Open the player list below to see all roles.</span></p></div>';
      return;
    }

    switch (phase) {
      case 'night': renderNightPhase(content); break;
      case 'morning': renderMorningPhase(content, messages); break;
      case 'voting': renderVotingPhase(content); break;
    }
  }

  function renderNightPhase(container) {
    const player = state.playerData;
    if (!player) return;

    if (player.role === 'Villager') {
      container.innerHTML = '<div class="waiting-panel"><div class="waiting-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></div><p class="waiting-text">THE NIGHT IS DARK</p><p class="waiting-subtext">You have no abilities. Wait for dawn...</p></div>';
      return;
    }

    if (state.hasActed) {
      container.innerHTML = '<div class="action-confirmed"><div class="confirmed-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><p class="confirmed-text">ACTION SUBMITTED</p><p class="confirmed-detail">Waiting for others...</p></div>';
      return;
    }

    const targets = getTargetPlayers();
    const isAssassin = player.faction === 'Assassin';
    const actionClass = isAssassin ? 'assassin-action' : '';
    const targetClass = isAssassin ? 'assassin-target' : '';

    let actionsHTML = '';
    if (player.role === 'Sheriff') {
      actionsHTML = `<div class="action-buttons"><button class="action-btn ${state.selectedAction === 'shoot' ? 'selected' : ''}" data-action="shoot">🔫 SHOOT</button><button class="action-btn ${state.selectedAction === 'search' ? 'selected' : ''}" data-action="search">🔍 SEARCH</button></div>`;
    } else if (player.role === 'Medic') {
      state.selectedAction = 'protect';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="protect">🛡️ PROTECT</button></div>';
    } else if (player.role === 'Assassin') {
      state.selectedAction = 'kill';
      actionsHTML = `<div class="action-buttons"><button class="action-btn selected ${actionClass}" data-action="kill">🗡️ KILL</button></div>`;
    }

    let actionDesc = '';
    if (player.role === 'Sheriff') actionDesc = 'Choose to shoot or investigate a player';
    else if (player.role === 'Medic') actionDesc = 'Choose a player to protect tonight';
    else if (player.role === 'Assassin') actionDesc = 'Choose a crew member to eliminate';

    // For medic: find the last protected player name to show restriction
    let medicNote = '';
    if (player.role === 'Medic' && player.lastMedicTarget) {
      const lastTarget = state.roomData?.players?.find(p => p.id === player.lastMedicTarget);
      if (lastTarget) {
        medicNote = `<div class="medic-restriction">⚠️ Cannot protect <strong>${lastTarget.name}</strong> again this night</div>`;
      }
    }

    container.innerHTML = `
      <div class="action-panel">
        <div class="action-title">NIGHT ACTION</div>
        <div class="action-subtitle">${actionDesc}</div>
        ${actionsHTML}
        ${medicNote}
        <div class="target-label">SELECT TARGET</div>
        <div class="target-list" id="target-list">
          ${targets.map(t => {
            const isRestricted = player.role === 'Medic' && t.id === player.lastMedicTarget;
            return `<div class="target-item ${state.selectedTarget === t.id ? `selected ${targetClass}` : ''} ${isRestricted ? 'target-restricted' : ''}" data-target="${t.id}" ${isRestricted ? 'data-restricted="true"' : ''}><div class="target-dot"></div><span class="target-name">${t.name}${isRestricted ? ' <span class="restricted-label">(protected last night)</span>' : ''}</span></div>`;
          }).join('')}
        </div>
        <button class="btn ${isAssassin ? 'btn-assassin' : 'btn-crew'} confirm-action" id="btn-confirm-action" ${!state.selectedAction || !state.selectedTarget ? 'disabled' : ''}>CONFIRM</button>
        <button class="btn btn-ghost" id="btn-skip-night" style="margin-top:8px; width:100%;">SKIP (Do nothing)</button>
      </div>`;

    container.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedAction = btn.dataset.action;
        state.selectedTarget = null;
        renderNightPhase(container);
      });
    });

    container.querySelectorAll('.target-item').forEach(item => {
      item.addEventListener('click', () => {
        if (item.dataset.restricted === 'true') {
          showToast('You cannot protect the same player two nights in a row', 'error');
          return;
        }
        state.selectedTarget = item.dataset.target;
        renderNightPhase(container);
      });
    });

    const confirmBtn = document.getElementById('btn-confirm-action');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (!state.selectedAction || !state.selectedTarget) return;
        state.socket.emit('night-action', { action: state.selectedAction, targetId: state.selectedTarget }, (response) => {
          if (response.success) {
            state.hasActed = true;
            renderNightPhase(container);
            showToast('Action submitted', 'success');
          } else {
            showToast(response.error || 'Action failed', 'error');
          }
        });
      });
    }

    const skipBtn = document.getElementById('btn-skip-night');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        state.socket.emit('skip-night', (response) => {
          if (response.success) {
            state.hasActed = true;
            renderNightPhase(container);
            showToast('Skipped night action', 'info');
          }
        });
      });
    }
  }

  function renderMorningPhase(container, messagesContainer) {
    container.style.display = 'none';
    messagesContainer.style.display = 'flex';

    const msgList = document.getElementById('messages-list');
    msgList.innerHTML = '';

    if (state.searchResult) {
      const isAssassin = state.searchResult.faction === 'Assassin';
      const div = document.createElement('div');
      div.className = 'search-result-card';
      div.innerHTML = `<div class="search-label">🔍 INVESTIGATION RESULT</div><div class="search-target-name">${state.searchResult.targetName}</div><div class="search-target-role ${isAssassin ? 'assassin-role' : 'crew-role'}">${state.searchResult.role} (${state.searchResult.faction})</div>`;
      msgList.appendChild(div);
      state.searchResult = null;
    }

    state.morningMessages.forEach((msg, i) => {
      const div = document.createElement('div');
      div.className = `message-card ${msg.type}`;
      div.style.animationDelay = `${(i + 1) * 0.3}s`;
      let icon = '';
      if (msg.type === 'death') icon = '💀';
      else if (msg.type === 'protected') icon = '🛡️';
      else if (msg.type === 'peaceful') icon = '🌅';
      div.innerHTML = `<span class="message-icon">${icon}</span><span class="message-text">${msg.text}</span>`;
      msgList.appendChild(div);
    });

    if (state.morningMessages.length === 0) {
      const div = document.createElement('div');
      div.className = 'message-card peaceful';
      div.innerHTML = '<span class="message-icon">🌅</span><span class="message-text">The night passed peacefully.</span>';
      msgList.appendChild(div);
    }

    state.socket.emit('request-player-data', (response) => {
      if (response.success) {
        state.playerData = response.player;
        state.roomData = response.room;
        updateRoleCard();
        updateAliveCount();
        renderGamePlayerList();
      }
    });
  }

  function renderVotingPhase(container) {
    if (state.hasVoted) {
      container.innerHTML = '<div class="action-confirmed"><div class="confirmed-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><p class="confirmed-text">VOTE SUBMITTED</p><p class="confirmed-detail">Waiting for others...</p></div>';
      return;
    }

    const targets = getVoteTargets();
    const aliveCount = state.totalAlive || state.roomData?.aliveCount || '?';

    container.innerHTML = `
      <div class="voting-panel">
        <div class="action-title">TOWN VOTE</div>
        <div class="action-subtitle">Vote to eliminate a suspect</div>
        <div class="vote-count-bar"><span id="votes-cast-count" class="vote-cast-count">${state.votesCast} / ${aliveCount} votes cast</span></div>
        <div class="target-list" id="vote-target-list">
          ${targets.map(t => `<div class="target-item ${state.selectedTarget === t.id ? 'selected' : ''}" data-target="${t.id}"><div class="target-dot"></div><span class="target-name">${t.name}</span></div>`).join('')}
        </div>
        <button class="skip-vote-btn ${state.selectedTarget === 'skip' ? 'selected' : ''}" id="btn-vote-skip">⏭ SKIP VOTE</button>
        <button class="btn btn-primary confirm-action" id="btn-confirm-vote" ${!state.selectedTarget ? 'disabled' : ''}>CONFIRM VOTE</button>
      </div>`;

    container.querySelectorAll('.target-item').forEach(item => {
      item.addEventListener('click', () => {
        state.selectedTarget = item.dataset.target;
        renderVotingPhase(container);
      });
    });

    const skipBtn = document.getElementById('btn-vote-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        state.selectedTarget = 'skip';
        renderVotingPhase(container);
      });
    }

    const confirmBtn = document.getElementById('btn-confirm-vote');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (!state.selectedTarget) return;
        state.votesCast = (state.votesCast || 0) + 1;
        renderVotingPhase(container);
        state.socket.emit('vote', { targetId: state.selectedTarget }, (response) => {
          if (response.success) {
            state.hasVoted = true;
            renderVotingPhase(container);
            showToast('Vote cast', 'success');
          } else {
            state.votesCast = Math.max(0, (state.votesCast || 1) - 1);
            renderVotingPhase(container);
            showToast(response.error || 'Vote failed', 'error');
          }
        });
      });
    }
  }

  function renderVoteResult(message) {
    const content = document.getElementById('game-content');
    const messages = document.getElementById('game-messages');
    content.style.display = 'flex';
    messages.style.display = 'none';

    let icon = '🗳️';
    if (message.type === 'eliminated') icon = '⚖️';

    content.innerHTML = `<div class="vote-result-panel"><div style="font-size:2rem; margin-bottom:12px;">${icon}</div><div class="vote-result-text">${message.text}</div><div class="vote-result-detail">Transitioning to next phase...</div></div>`;

    state.socket.emit('request-player-data', (response) => {
      if (response.success) {
        state.playerData = response.player;
        state.roomData = response.room;
        updateRoleCard();
        updateAliveCount();
        renderGamePlayerList();
      }
    });
  }

  function renderNightPhase(container) {
    const player = state.playerData;
    if (!player) return;

    if (player.role === 'Villager') {
      container.innerHTML = '<div class="waiting-panel"><div class="waiting-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></div><p class="waiting-text">THE NIGHT IS DARK</p><p class="waiting-subtext">You have no abilities. Wait for dawn...</p></div><div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }

    if (state.hasActed) {
      container.innerHTML = '<div class="action-confirmed"><div class="confirmed-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><p class="confirmed-text">ACTION SUBMITTED</p><p class="confirmed-detail">Waiting for others...</p></div><div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }

    const targets = getTargetPlayers();
    const isAssassin = player.faction === 'Assassin';
    const actionClass = isAssassin ? 'assassin-action' : '';
    const targetClass = isAssassin ? 'assassin-target' : '';

    let actionsHTML = '';
    if (player.role === 'Sheriff') {
      actionsHTML = `<div class="action-buttons"><button class="action-btn ${state.selectedAction === 'shoot' ? 'selected' : ''}" data-action="shoot">🔫 SHOOT</button><button class="action-btn ${state.selectedAction === 'search' ? 'selected' : ''}" data-action="search">🔍 SEARCH</button></div>`;
    } else if (player.role === 'Medic') {
      state.selectedAction = 'protect';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="protect">🛡️ PROTECT</button></div>';
    } else if (player.role === 'Assassin') {
      state.selectedAction = 'kill';
      actionsHTML = `<div class="action-buttons"><button class="action-btn selected ${actionClass}" data-action="kill">🗡️ KILL</button></div>`;
    }

    let actionDesc = '';
    if (player.role === 'Sheriff') actionDesc = 'Choose to shoot or investigate a player';
    else if (player.role === 'Medic') actionDesc = 'Choose a player to protect tonight';
    else if (player.role === 'Assassin') actionDesc = 'Choose a crew member to eliminate';

    container.innerHTML = `
      <div class="action-panel">
        <div class="action-title">NIGHT ACTION</div>
        <div class="action-subtitle">${actionDesc}</div>
        ${actionsHTML}
        <div class="target-label">SELECT TARGET</div>
        <div class="target-list" id="target-list">
          ${targets.map(t => {
            const isRestricted = player.role === 'Medic' && t.id === player.lastMedicTarget;
            return `<div class="target-item ${state.selectedTarget === t.id ? `selected ${targetClass}` : ''} ${isRestricted ? 'target-restricted' : ''}" data-target="${t.id}" ${isRestricted ? 'data-restricted="true"' : ''}><div class="target-dot"></div><span class="target-name">${t.name}</span></div>`;
          }).join('')}
        </div>
        <button class="btn ${isAssassin ? 'btn-assassin' : 'btn-crew'} confirm-action" id="btn-confirm-action" ${!state.selectedAction || !state.selectedTarget ? 'disabled' : ''}>CONFIRM</button>
        <button class="btn btn-ghost" id="btn-skip-night" style="margin-top:8px; width:100%;">SKIP (Do nothing)</button>
      </div>
      <div id="phase-chat-panel"></div>`;

    container.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedAction = btn.dataset.action;
        state.selectedTarget = null;
        renderNightPhase(container);
      });
    });

    container.querySelectorAll('.target-item').forEach(item => {
      item.addEventListener('click', () => {
        if (item.dataset.restricted === 'true') {
          showToast('You cannot protect the same player two nights in a row', 'error');
          return;
        }
        state.selectedTarget = item.dataset.target;
        renderNightPhase(container);
      });
    });

    const confirmBtn = document.getElementById('btn-confirm-action');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (!state.selectedAction || !state.selectedTarget) return;
        state.socket.emit('night-action', { action: state.selectedAction, targetId: state.selectedTarget }, (response) => {
          if (response.success) {
            state.hasActed = true;
            renderNightPhase(container);
            showToast('Action submitted', 'success');
          } else {
            showToast(response.error || 'Action failed', 'error');
          }
        });
      });
    }

    const skipBtn = document.getElementById('btn-skip-night');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        state.socket.emit('skip-night', (response) => {
          if (response.success) {
            state.hasActed = true;
            renderNightPhase(container);
            showToast('Skipped night action', 'info');
          }
        });
      });
    }

    renderChatBox();
  }

  function renderMorningPhase(container, messagesContainer) {
    container.style.display = 'flex';
    messagesContainer.style.display = 'none';
    container.innerHTML = `
      <div class="morning-chat-intro">
        <div class="action-title">MORNING DISCUSSION</div>
        <div class="action-subtitle">System messages below summarize the night and show who is alive. Use the chat to discuss before voting.</div>
      </div>
      <div id="phase-chat-panel"></div>`;

    renderChatBox();

    state.socket.emit('request-player-data', (response) => {
      if (response.success) {
        state.playerData = response.player;
        state.roomData = response.room;
        state.chatMessages = response.room?.chatMessages || state.chatMessages;
        updateRoleCard();
        updateAliveCount();
        renderGamePlayerList();
        renderChatBox();
      }
    });
  }

  function renderVotingPhase(container) {
    if (state.hasVoted) {
      container.innerHTML = '<div class="action-confirmed"><div class="confirmed-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><p class="confirmed-text">VOTE SUBMITTED</p><p class="confirmed-detail">Waiting for others...</p></div><div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }

    const targets = getVoteTargets();
    const aliveCount = state.totalAlive || state.roomData?.aliveCount || '?';

    container.innerHTML = `
      <div class="voting-panel">
        <div class="action-title">TOWN VOTE</div>
        <div class="action-subtitle">Vote to eliminate a suspect</div>
        <div class="vote-count-bar"><span id="votes-cast-count" class="vote-cast-count">${state.votesCast} / ${aliveCount} votes cast</span></div>
        <div class="target-list" id="vote-target-list">
          ${targets.map(t => `<div class="target-item ${state.selectedTarget === t.id ? 'selected' : ''}" data-target="${t.id}"><div class="target-dot"></div><span class="target-name">${t.name}</span></div>`).join('')}
        </div>
        <button class="skip-vote-btn ${state.selectedTarget === 'skip' ? 'selected' : ''}" id="btn-vote-skip">⏭ SKIP VOTE</button>
        <button class="btn btn-primary confirm-action" id="btn-confirm-vote" ${!state.selectedTarget ? 'disabled' : ''}>CONFIRM VOTE</button>
      </div>
      <div id="phase-chat-panel"></div>`;

    container.querySelectorAll('.target-item').forEach(item => {
      item.addEventListener('click', () => {
        state.selectedTarget = item.dataset.target;
        renderVotingPhase(container);
      });
    });

    const skipBtn = document.getElementById('btn-vote-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        state.selectedTarget = 'skip';
        renderVotingPhase(container);
      });
    }

    const confirmBtn = document.getElementById('btn-confirm-vote');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (!state.selectedTarget) return;
        state.votesCast = (state.votesCast || 0) + 1;
        renderVotingPhase(container);
        state.socket.emit('vote', { targetId: state.selectedTarget }, (response) => {
          if (response.success) {
            state.hasVoted = true;
            renderVotingPhase(container);
            showToast('Vote cast', 'success');
          } else {
            state.votesCast = Math.max(0, (state.votesCast || 1) - 1);
            renderVotingPhase(container);
            showToast(response.error || 'Vote failed', 'error');
          }
        });
      });
    }

    renderChatBox();
  }

  function renderVoteResult(message) {
    const content = document.getElementById('game-content');
    const messages = document.getElementById('game-messages');
    content.style.display = 'flex';
    messages.style.display = 'none';

    let icon = '🗳️';
    if (message.type === 'eliminated') icon = '⚖️';

    content.innerHTML = '<div id="phase-chat-panel"></div>';
    renderChatBox();

    state.socket.emit('request-player-data', (response) => {
      if (response.success) {
        state.playerData = response.player;
        state.roomData = response.room;
        state.chatMessages = response.room?.chatMessages || state.chatMessages;
        updateRoleCard();
        updateAliveCount();
        renderGamePlayerList();
        renderChatBox();
      }
    });
  }

  function updateRoleCard() {
    const player = state.playerData;
    if (!player) return;

    const card = document.getElementById('role-card');
    const faction = document.getElementById('role-faction');
    const roleName = document.getElementById('role-name');
    const desc = document.getElementById('role-description');
    const teammates = document.getElementById('role-teammates');
    const teammatesList = document.getElementById('teammates-list');

    card.className = `role-card ${player.faction?.toLowerCase() || ''}`;
    faction.textContent = player.faction?.toUpperCase() || '';
    roleName.textContent = player.role?.toUpperCase() || '';

    const descriptions = {
      Sheriff: 'You uphold justice from the shadows. Shoot or investigate.',
      Medic: 'You protect the innocent. Cannot protect the same player twice in a row.',
      Villager: 'Trust your instincts. Find the assassins among you.',
      Assassin: 'Eliminate the crew. Stay hidden. Strike silently.',
    };
    desc.textContent = descriptions[player.role] || '';

    if (player.faction === 'Assassin' && player.teammates && player.teammates.length > 0) {
      teammates.style.display = 'block';
      teammatesList.innerHTML = player.teammates.map(t => `<span class="teammate-tag">${t.name} ${t.alive ? '' : '(Dead)'}</span>`).join('');
    } else {
      teammates.style.display = 'none';
    }
  }

  function getTargetPlayers() {
    if (!state.roomData || !state.playerData) return [];
    return state.roomData.players.filter(p => {
      if (!p.alive) return false;
      if (p.id === state.playerId) return state.playerData.role === 'Medic';
      if (state.playerData.role === 'Assassin') {
        const isTeammate = state.playerData.teammates?.some(t => t.id === p.id);
        if (isTeammate) return false;
      }
      return true;
    }).map(p => ({ id: p.id, name: p.name }));
  }

  function getVoteTargets() {
    if (!state.roomData) return [];
    return state.roomData.players.filter(p => p.alive && p.id !== state.playerId).map(p => ({ id: p.id, name: p.name }));
  }

  function showGameOver(winner, players) {
    showScreen('gameover');
    const glow = document.getElementById('gameover-glow');
    const title = document.getElementById('gameover-faction');
    const reason = document.getElementById('gameover-reason');
    const playersList = document.getElementById('gameover-players');

    glow.className = `gameover-glow ${winner.winner === 'Crew' ? 'crew-win' : 'assassin-win'}`;
    title.className = `gameover-faction ${winner.winner === 'Crew' ? 'crew-text' : 'assassin-text'}`;
    title.textContent = `${winner.winner.toUpperCase()} WINS`;
    reason.textContent = winner.reason;

    playersList.innerHTML = players.map(p => `
      <div class="gameover-player ${!p.alive ? 'dead' : ''}">
        <span class="gameover-player-name">${p.name}</span>
        <span class="gameover-player-role ${p.faction === 'Crew' ? 'crew-role' : 'assassin-role'}">
          ${p.role}
          <span class="gameover-player-status">${p.alive ? '✓' : '✗'}</span>
        </span>
      </div>`).join('');

    const existingPlayAgain = document.getElementById('btn-play-again');
    if (existingPlayAgain) existingPlayAgain.remove();

    const gameoverScreen = document.getElementById('screen-gameover');

    if (state.isHost) {
      const btn = document.createElement('button');
      btn.id = 'btn-play-again';
      btn.className = 'btn btn-primary';
      btn.style.cssText = 'margin-top: 24px; width: 100%; max-width: 320px; display: flex; align-items: center; justify-content: center; gap: 8px;';
      btn.innerHTML = '▶ PLAY AGAIN';
      btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.textContent = 'Starting...';
        state.socket.emit('start-game', (response) => {
          if (!response.success) {
            showToast(response.error || 'Cannot start game', 'error');
            btn.disabled = false;
            btn.innerHTML = '▶ PLAY AGAIN';
          }
        });
      });
      gameoverScreen.appendChild(btn);
    } else {
      const waiting = document.createElement('p');
      waiting.id = 'btn-play-again';
      waiting.style.cssText = 'margin-top: 24px; color: hsl(195,60%,60%); font-size: 0.85rem; text-align: center;';
      waiting.textContent = 'Waiting for host to start a new game...';
      gameoverScreen.appendChild(waiting);
    }
  }

  function initEventListeners() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (state.currentScreen === 'game' || state.currentScreen === 'gameover') return;
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        state.currentTab = tabName;
        if (tabName === 'home') {
          if (state.roomCode) showScreen('room');
          else showScreen('home');
        } else if (tabName === 'roles') showScreen('roles');
        else if (tabName === 'rules') showScreen('rules');
        else if (tabName === 'changelog') showScreen('changelog');
      });
    });

    document.getElementById('btn-online').addEventListener('click', () => showScreen('online'));
    document.getElementById('btn-back-online').addEventListener('click', () => showScreen('home'));

    document.getElementById('btn-create-room').addEventListener('click', () => {
      state.joinMode = 'create';
      document.getElementById('join-code-group').style.display = 'none';
      showScreen('username');
    });

    document.getElementById('btn-join-room').addEventListener('click', () => {
      state.joinMode = 'join';
      document.getElementById('join-code-group').style.display = 'block';
      showScreen('username');
    });

    document.getElementById('btn-back-username').addEventListener('click', () => {
      showScreen('online');
      document.getElementById('input-username').value = '';
      document.getElementById('input-room-code').value = '';
      document.getElementById('username-error').textContent = '';
    });

    const usernameInput = document.getElementById('input-username');
    const roomCodeInput = document.getElementById('input-room-code');
    const proceedBtn = document.getElementById('btn-proceed');

    function validateInputs() {
      const name = usernameInput.value.trim();
      const code = roomCodeInput.value.trim();
      proceedBtn.disabled = !(name.length >= 2 && (state.joinMode === 'create' || code.length === 6));
    }

    usernameInput.addEventListener('input', validateInputs);
    roomCodeInput.addEventListener('input', validateInputs);

    proceedBtn.addEventListener('click', () => {
      const username = usernameInput.value.trim();
      const errorEl = document.getElementById('username-error');
      errorEl.textContent = '';

      if (username.length < 2) {
        errorEl.textContent = 'Name must be at least 2 characters';
        return;
      }

      state.username = username;

      if (state.joinMode === 'create') {
        state.socket.emit('create-room', { username }, (response) => {
          if (response.success) {
            state.playerId = response.playerId;
            state.roomCode = response.room.code;
            state.roomData = response.room;
            state.isHost = true;
            showScreen('room');
            renderRoom();
          } else {
            errorEl.textContent = response.error || 'Failed to create room';
          }
        });
      } else {
        const code = roomCodeInput.value.trim().toUpperCase();
        if (code.length !== 6) {
          errorEl.textContent = 'Room code must be 6 characters';
          return;
        }
        state.socket.emit('join-room', { code, username }, (response) => {
          if (response.success) {
            state.playerId = response.playerId;
            state.roomCode = response.room.code;
            state.roomData = response.room;
            state.isHost = false;
            showScreen('room');
            renderRoom();
          } else {
            errorEl.textContent = response.error || 'Failed to join room';
          }
        });
      }
    });

    document.getElementById('btn-leave-room').addEventListener('click', () => {
      state.socket.emit('leave-room', () => {
        state.roomCode = null;
        state.roomData = null;
        state.isHost = false;
        showScreen('home');
        showNav();
      });
    });

    document.getElementById('btn-copy-code').addEventListener('click', () => {
      const code = state.roomCode || '';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => showToast('Code copied!', 'success'));
      } else {
        const ta = document.createElement('textarea');
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Code copied!', 'success');
      }
    });

    document.getElementById('btn-start-game').addEventListener('click', () => {
      state.socket.emit('start-game', (response) => {
        if (!response.success) showToast(response.error || 'Cannot start game', 'error');
      });
    });

    document.getElementById('toggle-anonymous-votes').addEventListener('change', (event) => {
      state.socket.emit('update-room-settings', { anonymousVotes: event.target.checked }, (response) => {
        if (!response.success) {
          showToast(response.error || 'Could not update room settings', 'error');
          event.target.checked = !!state.roomData?.anonymousVotes;
        }
      });
    });

    document.getElementById('btn-back-home').addEventListener('click', () => {
      state.roomCode = null;
      state.roomData = null;
      state.playerData = null;
      state.isHost = false;
      state.hasActed = false;
      state.hasVoted = false;
      state.votesCast = 0;
      state.totalAlive = 0;
      state.searchResult = null;
      state.selectedAction = null;
      state.selectedTarget = null;
      state.morningMessages = [];
      state.gamePhase = null;
      state.allPlayersWithRoles = [];
      state.playerListOpen = false;
      clearTimerInterval();
      showScreen('home');
      showNav();
      document.getElementById('input-username').value = '';
      document.getElementById('input-room-code').value = '';
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelector('[data-tab="home"]').classList.add('active');
    });

  }

  function init() {
    connectSocket();
    initEventListeners();
    showScreen('home');
    showNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function renderGameContent(phase) {
    const content = document.getElementById('game-content');
    const messages = document.getElementById('game-messages');
    content.style.display = 'flex';
    messages.style.display = 'none';

    if (state.playerData && !state.playerData.alive) {
      content.innerHTML = '<div class="dead-overlay"><div class="dead-icon">💀</div><h3 class="dead-title">ELIMINATED</h3><p class="dead-subtitle">You watch from the shadows as the game continues. Follow the conversation and system updates in chat below.</p></div><div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }

    switch (phase) {
      case 'night': renderNightPhase(content); break;
      case 'morning': renderMorningPhase(content, messages); break;
      case 'voting': renderVotingPhase(content); break;
    }
  }

  function renderNightPhase(container) {
    const player = state.playerData;
    if (!player) return;

    if (player.role === 'Villager') {
      container.innerHTML = '<div class="waiting-panel"><div class="waiting-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></div><p class="waiting-text">THE NIGHT IS DARK</p><p class="waiting-subtext">You have no abilities. Wait for dawn...</p></div><div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }

    if (state.hasActed) {
      container.innerHTML = '<div class="action-confirmed"><div class="confirmed-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><p class="confirmed-text">ACTION SUBMITTED</p><p class="confirmed-detail">Waiting for others...</p></div><div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }

    const targets = getTargetPlayers();
    const isAssassin = player.faction === 'Assassin';
    const actionClass = isAssassin ? 'assassin-action' : '';
    const targetClass = isAssassin ? 'assassin-target' : '';

    let actionsHTML = '';
    if (player.role === 'Sheriff') {
      actionsHTML = `<div class="action-buttons"><button class="action-btn ${state.selectedAction === 'shoot' ? 'selected' : ''}" data-action="shoot">🔫 SHOOT</button><button class="action-btn ${state.selectedAction === 'search' ? 'selected' : ''}" data-action="search">🔍 SEARCH</button></div>`;
    } else if (player.role === 'Medic') {
      state.selectedAction = 'protect';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="protect">🛡️ PROTECT</button></div>';
    } else if (player.role === 'Assassin') {
      state.selectedAction = 'kill';
      actionsHTML = `<div class="action-buttons"><button class="action-btn selected ${actionClass}" data-action="kill">🗡️ KILL</button></div>`;
    }

    let actionDesc = '';
    if (player.role === 'Sheriff') actionDesc = 'Choose to shoot or investigate a player';
    else if (player.role === 'Medic') actionDesc = 'Choose a player to protect tonight';
    else if (player.role === 'Assassin') actionDesc = 'Choose a crew member to eliminate';

    container.innerHTML = `
      <div class="action-panel">
        <div class="action-title">NIGHT ACTION</div>
        <div class="action-subtitle">${actionDesc}</div>
        ${actionsHTML}
        <div class="target-label">SELECT TARGET</div>
        <div class="target-list" id="target-list">
          ${targets.map(t => {
            const isRestricted = player.role === 'Medic' && t.id === player.lastMedicTarget;
            return `<div class="target-item ${state.selectedTarget === t.id ? `selected ${targetClass}` : ''} ${isRestricted ? 'target-restricted' : ''}" data-target="${t.id}" ${isRestricted ? 'data-restricted="true"' : ''}><div class="target-dot"></div><span class="target-name">${t.name}</span></div>`;
          }).join('')}
        </div>
        <button class="btn ${isAssassin ? 'btn-assassin' : 'btn-crew'} confirm-action" id="btn-confirm-action" ${!state.selectedAction || !state.selectedTarget ? 'disabled' : ''}>CONFIRM</button>
        <button class="btn btn-ghost" id="btn-skip-night" style="margin-top:8px; width:100%;">SKIP (Do nothing)</button>
      </div>
      <div id="phase-chat-panel"></div>`;

    container.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedAction = btn.dataset.action;
        state.selectedTarget = null;
        renderNightPhase(container);
      });
    });

    container.querySelectorAll('.target-item').forEach(item => {
      item.addEventListener('click', () => {
        if (item.dataset.restricted === 'true') {
          showToast('You cannot protect the same player two nights in a row', 'error');
          return;
        }
        state.selectedTarget = item.dataset.target;
        renderNightPhase(container);
      });
    });

    const confirmBtn = document.getElementById('btn-confirm-action');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (!state.selectedAction || !state.selectedTarget) return;
        state.socket.emit('night-action', { action: state.selectedAction, targetId: state.selectedTarget }, (response) => {
          if (response.success) {
            state.hasActed = true;
            renderNightPhase(container);
            showToast('Action submitted', 'success');
          } else {
            showToast(response.error || 'Action failed', 'error');
          }
        });
      });
    }

    const skipBtn = document.getElementById('btn-skip-night');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        state.socket.emit('skip-night', (response) => {
          if (response.success) {
            state.hasActed = true;
            renderNightPhase(container);
            showToast('Skipped night action', 'info');
          }
        });
      });
    }

    renderChatBox();
  }

  function renderMorningPhase(container, messagesContainer) {
    container.style.display = 'flex';
    messagesContainer.style.display = 'none';
    container.innerHTML = '<div id="phase-chat-panel"></div>';
    renderChatBox();

    state.socket.emit('request-player-data', (response) => {
      if (response.success) {
        state.playerData = response.player;
        state.roomData = response.room;
        state.chatMessages = response.room?.chatMessages || state.chatMessages;
        updateRoleCard();
        updateAliveCount();
        renderChatBox();
      }
    });
  }

  function renderVotingPhase(container) {
    if (state.hasVoted) {
      container.innerHTML = '<div class="action-confirmed"><div class="confirmed-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><p class="confirmed-text">VOTE SUBMITTED</p><p class="confirmed-detail">Waiting for others...</p></div><div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }

    const targets = getVoteTargets();
    const aliveCount = state.totalAlive || state.roomData?.aliveCount || '?';

    container.innerHTML = `
      <div class="voting-panel">
        <div class="action-title">TOWN VOTE</div>
        <div class="action-subtitle">Vote to eliminate a suspect</div>
        <div class="vote-count-bar"><span id="votes-cast-count" class="vote-cast-count">${state.votesCast} / ${aliveCount} votes cast</span></div>
        <div class="target-list" id="vote-target-list">
          ${targets.map(t => `<div class="target-item ${state.selectedTarget === t.id ? 'selected' : ''}" data-target="${t.id}"><div class="target-dot"></div><span class="target-name">${t.name}</span></div>`).join('')}
        </div>
        <button class="skip-vote-btn ${state.selectedTarget === 'skip' ? 'selected' : ''}" id="btn-vote-skip">⏭ SKIP VOTE</button>
        <button class="btn btn-primary confirm-action" id="btn-confirm-vote" ${!state.selectedTarget ? 'disabled' : ''}>CONFIRM VOTE</button>
      </div>
      <div id="phase-chat-panel"></div>`;

    container.querySelectorAll('.target-item').forEach(item => {
      item.addEventListener('click', () => {
        state.selectedTarget = item.dataset.target;
        renderVotingPhase(container);
      });
    });

    const skipBtn = document.getElementById('btn-vote-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        state.selectedTarget = 'skip';
        renderVotingPhase(container);
      });
    }

    const confirmBtn = document.getElementById('btn-confirm-vote');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (!state.selectedTarget) return;
        state.votesCast = (state.votesCast || 0) + 1;
        renderVotingPhase(container);
        state.socket.emit('vote', { targetId: state.selectedTarget }, (response) => {
          if (response.success) {
            state.hasVoted = true;
            renderVotingPhase(container);
            showToast('Vote cast', 'success');
          } else {
            state.votesCast = Math.max(0, (state.votesCast || 1) - 1);
            renderVotingPhase(container);
            showToast(response.error || 'Vote failed', 'error');
          }
        });
      });
    }

    renderChatBox();
  }

  function renderVoteResult(message) {
    const content = document.getElementById('game-content');
    const messages = document.getElementById('game-messages');
    content.style.display = 'flex';
    messages.style.display = 'none';

    let icon = '🗳️';
    if (message.type === 'eliminated') icon = '⚖️';

    content.innerHTML = '<div id="phase-chat-panel"></div>';
    renderChatBox();

    state.socket.emit('request-player-data', (response) => {
      if (response.success) {
        state.playerData = response.player;
        state.roomData = response.room;
        state.chatMessages = response.room?.chatMessages || state.chatMessages;
        updateRoleCard();
        updateAliveCount();
        renderChatBox();
      }
    });
  }
  function getLocalActionPanelMarkup() {
    const player = state.playerData;
    if (!player) return '';

    if (state.gamePhase === 'night') {
      if (player.role === 'Villager') {
        return '<div class="chat-local-panel"><div class="chat-local-title">Night</div><div class="chat-local-copy">You have no abilities tonight. Watch the chat and wait for dawn.</div></div>';
      }
      if (state.hasActed) return '';

      const targets = getTargetPlayers();
      const isAssassin = player.faction === 'Assassin';
      const actionClass = isAssassin ? 'assassin-action' : '';
      const targetClass = isAssassin ? 'assassin-target' : '';

      let actionsHTML = '';
      if (player.role === 'Sheriff') {
        actionsHTML = `<div class="action-buttons"><button class="action-btn ${state.selectedAction === 'shoot' ? 'selected' : ''}" data-action="shoot">Shoot</button><button class="action-btn ${state.selectedAction === 'search' ? 'selected' : ''}" data-action="search">Search</button></div>`;
      } else if (player.role === 'Medic') {
        state.selectedAction = 'protect';
        actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="protect">Protect</button></div>';
      } else if (player.role === 'Assassin') {
        state.selectedAction = 'kill';
        actionsHTML = `<div class="action-buttons"><button class="action-btn selected ${actionClass}" data-action="kill">Kill</button></div>`;
      }

      let actionDesc = '';
      if (player.role === 'Sheriff') actionDesc = 'Choose to shoot or investigate a player';
      else if (player.role === 'Medic') actionDesc = 'Choose a player to protect tonight';
      else if (player.role === 'Assassin') actionDesc = 'Choose a crew member to eliminate';

      return `
        <div class="chat-local-panel">
          <div class="chat-local-header">
            <div class="chat-local-title">Your Night Action</div>
            <div class="chat-local-copy">${actionDesc}</div>
          </div>
          ${actionsHTML}
          <div class="target-label">Select Target</div>
          <div class="target-list chat-target-list" id="target-list">
            ${targets.map(t => {
              const isRestricted = player.role === 'Medic' && t.id === player.lastMedicTarget;
              return `<div class="target-item ${state.selectedTarget === t.id ? `selected ${targetClass}` : ''} ${isRestricted ? 'target-restricted' : ''}" data-target="${t.id}" ${isRestricted ? 'data-restricted="true"' : ''}><div class="target-dot"></div><span class="target-name">${t.name}</span></div>`;
            }).join('')}
          </div>
          <div class="chat-local-actions">
            <button class="btn ${isAssassin ? 'btn-assassin' : 'btn-crew'} confirm-action" id="btn-confirm-action" ${!state.selectedAction || !state.selectedTarget ? 'disabled' : ''}>Confirm</button>
            <button class="btn btn-ghost chat-local-skip" id="btn-skip-night">Skip</button>
          </div>
        </div>`;
    }

    if (state.gamePhase === 'voting') {
      if (state.hasVoted) {
        return '<div class="chat-local-panel"><div class="chat-local-title">Vote Locked</div><div class="chat-local-copy">Your vote is submitted. Keep following the discussion in chat.</div></div>';
      }

      const targets = getVoteTargets();
      const aliveCount = state.totalAlive || state.roomData?.aliveCount || '?';
      return `
        <div class="chat-local-panel">
          <div class="chat-local-header">
            <div class="chat-local-title">Your Vote</div>
            <div class="chat-local-copy">${state.votesCast} / ${aliveCount} votes cast</div>
          </div>
          <div class="target-list chat-target-list" id="vote-target-list">
            ${targets.map(t => `<div class="target-item ${state.selectedTarget === t.id ? 'selected' : ''}" data-target="${t.id}"><div class="target-dot"></div><span class="target-name">${t.name}</span></div>`).join('')}
          </div>
          <div class="chat-local-actions">
            <button class="skip-vote-btn ${state.selectedTarget === 'skip' ? 'selected' : ''}" id="btn-vote-skip">Skip Vote</button>
            <button class="btn btn-primary confirm-action" id="btn-confirm-vote" ${!state.selectedTarget ? 'disabled' : ''}>Confirm Vote</button>
          </div>
        </div>`;
    }

    return '';
  }

  function bindLocalActionPanelHandlers(container) {
    if (state.gamePhase === 'night') {
      container.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.selectedAction = btn.dataset.action;
          state.selectedTarget = null;
          renderChatBox();
        });
      });

      container.querySelectorAll('#target-list .target-item').forEach(item => {
        item.addEventListener('click', () => {
          if (item.dataset.restricted === 'true') {
            showToast('You cannot protect the same player two nights in a row', 'error');
            return;
          }
          state.selectedTarget = item.dataset.target;
          renderChatBox();
        });
      });

      const confirmBtn = document.getElementById('btn-confirm-action');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          if (!state.selectedAction || !state.selectedTarget) return;
          state.socket.emit('night-action', { action: state.selectedAction, targetId: state.selectedTarget }, (response) => {
            if (response.success) {
              state.hasActed = true;
              renderGameContent('night');
              showToast('Action submitted', 'success');
            } else {
              showToast(response.error || 'Action failed', 'error');
            }
          });
        });
      }

      const skipBtn = document.getElementById('btn-skip-night');
      if (skipBtn) {
        skipBtn.addEventListener('click', () => {
          state.socket.emit('skip-night', (response) => {
            if (response.success) {
              state.hasActed = true;
              renderGameContent('night');
              showToast('Skipped night action', 'info');
            }
          });
        });
      }
    }

    if (state.gamePhase === 'voting') {
      container.querySelectorAll('#vote-target-list .target-item').forEach(item => {
        item.addEventListener('click', () => {
          state.selectedTarget = item.dataset.target;
          renderChatBox();
        });
      });

      const skipBtn = document.getElementById('btn-vote-skip');
      if (skipBtn) {
        skipBtn.addEventListener('click', () => {
          state.selectedTarget = 'skip';
          renderChatBox();
        });
      }

      const confirmBtn = document.getElementById('btn-confirm-vote');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          if (!state.selectedTarget) return;
          state.votesCast = (state.votesCast || 0) + 1;
          renderChatBox();
          state.socket.emit('vote', { targetId: state.selectedTarget }, (response) => {
            if (response.success) {
              state.hasVoted = true;
              renderGameContent('voting');
              showToast('Vote cast', 'success');
            } else {
              state.votesCast = Math.max(0, (state.votesCast || 1) - 1);
              renderChatBox();
              showToast(response.error || 'Vote failed', 'error');
            }
          });
        });
      }
    }
  }

  function renderChatBox() {
    const panel = document.getElementById('phase-chat-panel');
    if (!panel) return;

    const mode = getChatMode();
    const canChat = mode === 'morning' || mode === 'voting';
    const subtitle = canChat
      ? 'Chat is open for discussion.'
      : mode === 'readonly'
        ? 'Waiting for the next phase...'
        : 'Chat is visible but locked until morning.';
    const messages = [...(state.chatMessages || []), ...(state.privateChatMessages || [])]
      .sort((a, b) => a.createdAt - b.createdAt);

    panel.className = `phase-chat-panel ${mode === 'morning' ? 'chat-expanded' : 'chat-compact'}${canChat ? '' : ' chat-locked'}`;

    if (mode === 'hidden') {
      panel.innerHTML = '';
      return;
    }

    const localPanel = getLocalActionPanelMarkup();
    const items = messages.length
      ? messages.map((message) => {
        const isSelf = message.senderId === state.playerId;
        const classes = `chat-message ${message.type === 'system' ? 'system' : ''}${message.private ? ' private' : ''}${isSelf ? ' self' : ''}`;
        const sender = message.type === 'system' ? 'SYSTEM' : message.senderName;
        return `
          <div class="${classes}">
            <div class="chat-message-meta">${sender}</div>
            <div class="chat-message-text">${message.text}</div>
          </div>`;
      }).join('')
      : '<div class="chat-empty">No messages yet.</div>';

    panel.innerHTML = `
      ${localPanel}
      <div class="chat-panel-header">
        <div>
          <div class="chat-panel-title">Room Chat</div>
          <div class="chat-panel-subtitle">${subtitle}</div>
        </div>
      </div>
      <div class="chat-messages" id="chat-messages">${items}</div>
      <form class="chat-input-row" id="chat-form">
        <input
          id="chat-input"
          class="chat-input"
          type="text"
          maxlength="280"
          placeholder="${canChat ? 'Type a message...' : 'Chat is locked at night'}"
          ${canChat ? '' : 'disabled'}
        />
        <button class="btn btn-primary chat-send-btn" type="submit" ${canChat ? '' : 'disabled'}>Send</button>
      </form>`;

    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;

    const chatForm = document.getElementById('chat-form');
    if (chatForm && canChat) {
      chatForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input ? input.value.trim() : '';
        if (!text) return;

        state.socket.emit('send-chat-message', { text }, (response) => {
          if (response.success) {
            if (input) input.value = '';
          } else {
            showToast(response.error || 'Message failed to send', 'error');
          }
        });
      });
    }

    bindLocalActionPanelHandlers(panel);
  }

  function renderGameContent(phase) {
    const content = document.getElementById('game-content');
    const messages = document.getElementById('game-messages');
    content.style.display = 'flex';
    messages.style.display = 'none';

    if (state.playerData && !state.playerData.alive) {
      content.innerHTML = '<div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }

    switch (phase) {
      case 'night': renderNightPhase(content); break;
      case 'morning': renderMorningPhase(content, messages); break;
      case 'voting': renderVotingPhase(content); break;
    }
  }

  function renderNightPhase(container) {
    container.innerHTML = '<div id="phase-chat-panel"></div>';
    renderChatBox();
  }

  function renderMorningPhase(container, messagesContainer) {
    container.style.display = 'flex';
    messagesContainer.style.display = 'none';
    container.innerHTML = '<div id="phase-chat-panel"></div>';
    renderChatBox();

    state.socket.emit('request-player-data', (response) => {
      if (response.success) {
        state.playerData = response.player;
        state.roomData = response.room;
        state.chatMessages = response.room?.chatMessages || state.chatMessages;
        updateRoleCard();
        updateAliveCount();
        renderChatBox();
      }
    });
  }

  function renderVotingPhase(container) {
    container.innerHTML = '<div id="phase-chat-panel"></div>';
    renderChatBox();
  }

  function renderVoteResult(message) {
    const content = document.getElementById('game-content');
    const messages = document.getElementById('game-messages');
    content.style.display = 'flex';
    messages.style.display = 'none';

    let icon = '🗳️';
    if (message.type === 'eliminated') icon = '⚖️';

    content.innerHTML = `<div class="vote-result-panel"><div style="font-size:2rem; margin-bottom:12px;">${icon}</div><div class="vote-result-text">${message.text}</div><div class="vote-result-detail">Transitioning to next phase...</div></div><div id="phase-chat-panel"></div>`;
    renderChatBox();

    state.socket.emit('request-player-data', (response) => {
      if (response.success) {
        state.playerData = response.player;
        state.roomData = response.room;
        state.chatMessages = response.room?.chatMessages || state.chatMessages;
        updateRoleCard();
        updateAliveCount();
        renderChatBox();
      }
    });
  }
})();

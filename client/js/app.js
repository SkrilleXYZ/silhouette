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
    selectedAvatarIndex: 0,
    profileConfirmed: false,
    playerData: null,
    roomData: null,
    selectedAction: null,
    selectedTarget: null,
    timerInterval: null,
    timerValue: 0,
    timerDuration: 60,
    timerEndsAt: 0,
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
    chatOverlayOpen: false,
    roleRevealActive: false,
    roleRevealEndsAt: 0,
    roleRevealTimeout: null,
    toastTimeout: null,
    connectionToastVisible: false,
    currentRolesFaction: 'Crew',
  };

  const MAX_ROOM_PLAYERS = 16;
  const PROFILE_STORAGE_KEY = 'silhouette.profile';
  const PLAYER_SESSION_STORAGE_KEY = 'silhouette.playerSessionId';
  const ROLE_REVEAL_ITEM_HEIGHT = 72;
  const AVATAR_ASSET_VERSION = '20260324c';
  const ROLE_DEFINITIONS = {
    Sheriff: {
      faction: 'Crew',
      subfaction: 'Killing',
      description: 'You uphold justice from the shadows. Shoot or investigate.',
      revealText: 'Justice glints in gold. Hunt carefully from the dark.',
      abilities: [
        {
          name: 'Shoot',
          type: 'Night',
          description: 'Shoot a player. If they happen to be a Crew member the victim survives but you die instead.',
        },
        {
          name: 'Search',
          type: 'Night',
          description: 'Choose a player to learn their exact role.',
        },
      ],
    },
    Vitalist: {
      faction: 'Crew',
      subfaction: 'Protection',
      description: 'You protect the innocent. Cannot protect the same player twice in a row.',
      revealText: 'A neon ward surrounds you. Keep the crew alive through the dark.',
      abilities: [
        {
          name: 'Shield',
          type: 'Night',
          description: 'Protect a player from getting killed until the next night. Cannot target the same player in a row.',
        },
      ],
    },
    Villager: {
      faction: 'Crew',
      description: 'Trust your instincts. Find the assassins among you.',
      revealText: 'You have no night action, but your voice matters at dawn.',
      abilities: [
        {
          name: 'Survive',
          type: 'Passive',
          description: 'Try to survive and eliminate all Assassins and Neutral Killers.',
        },
      ],
    },
    Assassin: {
      faction: 'Assassin',
      subfaction: 'Power',
      description: 'Eliminate the crew. Stay hidden. Strike silently.',
      revealText: 'Crimson intent burns bright. Stay hidden and strike first.',
      abilities: [
        {
          name: 'Kill',
          type: 'Night',
          description: 'Eliminate a player.',
        },
      ],
    },
  };
  const ROLE_GUIDE_DEFINITIONS = {
    ...ROLE_DEFINITIONS,
    Jester: {
      faction: 'Neutral',
      subfaction: 'Evil',
      description: 'Act like an Assassin to get voted out. Try to avoid dying.',
      abilities: [
        {
          name: 'Trickster',
          type: 'Passive',
          description: 'Act like an Assassin to get voted out. Try to avoid dying.',
        },
      ],
    },
  };
  const ROLE_GUIDE_SECTIONS = [
    { key: 'Crew', label: 'Crew', icon: 'Crew' },
    { key: 'Assassin', label: 'Assassin', icon: 'Assassin' },
    { key: 'Neutral', label: 'Neutral', icon: 'Neutral' },
  ];
  const LOBBY_AVATAR_FILES = [
    'Avatar 1.png',
    'Avatar 11.png',
    'Avatar 12.png',
    'Avatar 13.png',
    'Avatar 14.png',
    'Avatar 15.png',
    'Avatar 16.png',
    'Avatar 17.png',
    'Avatar 18.png',
    'Avatar 19.png',
    'Avatar 2.png',
    'Avatar 20.png',
    'Avatar 21.png',
    'Avatar 22.png',
    'Avatar 23.png',
    'Avatar 24.png',
    'Avatar 25.png',
    'Avatar 3.png',
    'Avatar 5.png',
    'Avatar 6.png',
    'Avatar 7.png',
    'Avatar 8.png',
    'Avatar 9.png',
  ];
  const LOBBY_AVATAR_IMAGES = LOBBY_AVATAR_FILES.map((fileName) => `./assets/avatars/${encodeURIComponent(fileName)}?v=${AVATAR_ASSET_VERSION}`);

  function getLobbyAvatarSrc(index) {
    return LOBBY_AVATAR_IMAGES[index % LOBBY_AVATAR_IMAGES.length];
  }

  function getAvatarIndex(key, fallback = 0) {
    const source = String(key || fallback);
    return source.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % LOBBY_AVATAR_IMAGES.length;
  }

  function handleAvatarLoadError(img) {
    if (!img) return;
    const fallbackOffset = Number.parseInt(img.dataset.avatarFallbacks || '0', 10) || 0;
    const originalSrc = img.dataset.avatarSrc || img.getAttribute('src') || '';
    if (!originalSrc) return;

    if (fallbackOffset === 0) {
      img.dataset.avatarFallbacks = '1';
      img.src = `${originalSrc}${originalSrc.includes('?') ? '&' : '?'}retry=1`;
      return;
    }

    img.removeAttribute('onerror');
    img.classList.add('avatar-load-failed');
  }

  window.handleAvatarLoadError = handleAvatarLoadError;

  function renderAvatarMarkup(key, className = 'player-avatar', avatarIndex = null) {
    const resolvedIndex = Number.isInteger(avatarIndex) ? avatarIndex : getAvatarIndex(key);
    const avatarSrc = getLobbyAvatarSrc(resolvedIndex);
    return `<img class="${className}" src="${avatarSrc}" alt="" data-avatar-index="${resolvedIndex}" data-avatar-src="${avatarSrc}" data-avatar-fallbacks="0" onerror="window.handleAvatarLoadError && window.handleAvatarLoadError(this)" />`;
  }

  function normalizeProfileName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 16);
  }

  function getDefaultProfile() {
    return {
      name: '',
      avatarIndex: Math.floor(Math.random() * LOBBY_AVATAR_IMAGES.length),
      confirmed: false,
    };
  }

  function loadProfile() {
    const fallback = getDefaultProfile();
    try {
      const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      const avatarIndex = Number.isInteger(parsed.avatarIndex) ? parsed.avatarIndex % LOBBY_AVATAR_IMAGES.length : fallback.avatarIndex;
      return {
        name: normalizeProfileName(parsed.name || ''),
        avatarIndex,
        confirmed: !!parsed.confirmed,
      };
    } catch (error) {
      return fallback;
    }
  }

  function saveProfile() {
    const profile = {
      name: normalizeProfileName(state.username),
      avatarIndex: Number.isInteger(state.selectedAvatarIndex) ? state.selectedAvatarIndex : 0,
      confirmed: !!state.profileConfirmed,
    };
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }

  function getOrCreatePlayerSessionId() {
    let playerSessionId = '';
    try {
      playerSessionId = window.sessionStorage.getItem(PLAYER_SESSION_STORAGE_KEY) || '';
      if (!playerSessionId) {
        playerSessionId = window.crypto?.randomUUID
          ? window.crypto.randomUUID()
          : `player-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        window.sessionStorage.setItem(PLAYER_SESSION_STORAGE_KEY, playerSessionId);
      }
    } catch (error) {
      playerSessionId = `player-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
    return playerSessionId;
  }

  function getRoomCodeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get('room') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  function setRoomUrl(code) {
    const url = new URL(window.location.href);
    url.searchParams.set('room', code);
    window.history.replaceState({}, '', url);
  }

  function clearRoomUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url);
  }

  function applyRoomCodeToInput(code) {
    const roomCodeInput = document.getElementById('home-room-code-input');
    if (roomCodeInput) roomCodeInput.value = String(code || '').toUpperCase();
  }

  function restoreRoomSession(response) {
    if (!response?.success) return false;

    state.playerId = response.playerId || state.playerId;
    state.roomCode = response.room?.code || state.roomCode;
    state.roomData = response.room || state.roomData;
    state.playerData = response.player || state.playerData;
    state.isHost = !!(response.room && state.playerId === response.room.hostId);
    state.chatMessages = response.room?.chatMessages || [];
    state.gamePhase = response.room?.state || null;
    state.hasActed = !!response.player?.hasSubmittedAction;
    state.hasVoted = !!response.player?.hasVoted;
    state.privateChatMessages = [];
    state.chatOverlayOpen = false;
    state.searchResult = null;
    state.selectedAction = null;
    state.selectedTarget = null;
    state.totalAlive = response.room?.aliveCount || 0;
    setRoomUrl(state.roomCode);
    applyRoomCodeToInput(state.roomCode);

    if (response.timer?.endsAt) {
      const remaining = Math.max(0, Math.ceil((response.timer.endsAt - Date.now()) / 1000));
      startTimer(remaining, response.timer.endsAt);
    } else {
      clearTimerInterval();
    }

    if (response.room?.state === 'lobby') {
      showScreen('room');
      showNav();
      renderRoom();
      return true;
    }

    if (response.room?.state === 'ended' && response.winner && response.allPlayers) {
      hideNav();
      showGameOver(response.winner, response.allPlayers);
      return true;
    }

    showScreen('game');
    hideNav();
    updateRoleCard();
    updatePhaseUI(response.room?.state, response.room?.nightCount || 0);
    renderGameContent(response.room?.state);
    updateAliveCount();
    renderGamePlayerList();
    renderChatBox();

    if (response.room?.roleRevealEndsAt && response.room.roleRevealEndsAt > Date.now()) {
      startRoleReveal(response.player, response.room.roleRevealEndsAt, Math.max(0, response.room.roleRevealEndsAt - Date.now()));
    } else {
      stopRoleReveal(false);
    }

    return true;
  }

  function tryAutoRejoin() {
    const roomCode = state.roomCode || getRoomCodeFromUrl();
    if (!roomCode || !state.playerId || !state.profileConfirmed || !state.username) return;

    state.socket.emit('rejoin-room', {
      code: roomCode,
      playerId: state.playerId,
      username: state.username,
      avatarIndex: state.selectedAvatarIndex,
    }, (response) => {
      if (response?.success) {
        restoreRoomSession(response);
        return;
      }

      applyRoomCodeToInput(roomCode);
      if (response?.error === 'Player not found') {
        state.socket.emit('join-room', {
          code: roomCode,
          playerId: state.playerId,
          username: state.username,
          avatarIndex: state.selectedAvatarIndex,
        }, (joinResponse) => {
          if (!joinResponse?.success) return;
          state.playerId = joinResponse.playerId;
          state.roomCode = joinResponse.room.code;
          state.roomData = joinResponse.room;
          state.isHost = !!(joinResponse.room && state.playerId === joinResponse.room.hostId);
          setRoomUrl(state.roomCode);
          showScreen('room');
          showNav();
          renderRoom();
        });
        return;
      }
      if (response?.error === 'Room not found') {
        state.roomCode = null;
        clearRoomUrl();
      }
    });
  }

  function renderProfilePanel() {
    const nameInput = document.getElementById('profile-name-input');
    const preview = document.getElementById('profile-avatar-preview');
    const grid = document.getElementById('profile-avatar-grid');
    const compact = document.getElementById('profile-panel-compact');
    const body = document.getElementById('profile-panel-body');
    const compactName = document.getElementById('profile-compact-name');
    const editButton = document.getElementById('btn-edit-profile');
    const confirmButton = document.getElementById('btn-confirm-profile');
    if (!nameInput || !preview || !grid || !compact || !body || !compactName || !editButton || !confirmButton) return;

    nameInput.value = state.username || '';
    preview.innerHTML = renderAvatarMarkup('profile-preview', 'player-avatar', state.selectedAvatarIndex);
    compactName.textContent = state.username || 'Choose your profile';
    compact.style.display = state.profileConfirmed ? 'flex' : 'none';
    body.style.display = state.profileConfirmed ? 'none' : 'flex';
    grid.innerHTML = LOBBY_AVATAR_IMAGES.map((_, index) => `
      <button class="profile-avatar-option ${index === state.selectedAvatarIndex ? 'selected' : ''}" type="button" data-avatar-option="${index}">
        ${renderAvatarMarkup(`profile-option-${index}`, 'player-avatar', index)}
      </button>
    `).join('');

    grid.querySelectorAll('[data-avatar-option]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedAvatarIndex = Number.parseInt(button.dataset.avatarOption || '0', 10) || 0;
        saveProfile();
        renderProfilePanel();
      });
    });

    confirmButton.onclick = () => {
      const profile = validateProfile();
      if (!profile) return;
      state.profileConfirmed = true;
      saveProfile();
      renderProfilePanel();
    };

    editButton.onclick = () => {
      state.profileConfirmed = false;
      saveProfile();
      renderProfilePanel();
      nameInput.focus();
    };
  }

  function validateProfile({ requireCode = false } = {}) {
    const errorEl = document.getElementById('profile-error');
    const nameInput = document.getElementById('profile-name-input');
    const roomCodeInput = document.getElementById('home-room-code-input');
    const profileName = normalizeProfileName(nameInput ? nameInput.value : state.username);
    const roomCode = roomCodeInput ? roomCodeInput.value.trim().toUpperCase() : '';

    if (errorEl) errorEl.textContent = '';
    if (nameInput) nameInput.value = profileName;
    if (roomCodeInput) roomCodeInput.value = roomCode;

    if (profileName.length < 2) {
      if (errorEl) errorEl.textContent = 'Name must be at least 2 characters';
      return null;
    }

    if (requireCode && roomCode.length !== 6) {
      if (errorEl) errorEl.textContent = 'Room code must be 6 characters';
      return null;
    }

    state.username = profileName;
    saveProfile();
    return {
      username: profileName,
      avatarIndex: state.selectedAvatarIndex,
      code: roomCode,
    };
  }

  function getPlayerChatStyle(message) {
    if (!message || message.type === 'system') return '';
    const source = String(message.senderId || message.senderName || 'player');
    const seed = source.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const hue = seed % 360;
    return `--chat-accent:${hue};`;
  }

  function connectSocket() {
    state.socket = io(window.location.origin, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    state.socket.on('connect', () => {
      console.log('Connected to server:', state.socket.id);
      state.connectionToastVisible = false;
      tryAutoRejoin();
    });

    state.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      if (reason === 'io client disconnect') return;
      if (state.connectionToastVisible) return;
      state.connectionToastVisible = true;
      showToast('Connection lost. Reconnecting...', 'error');
    });

    state.socket.on('connect_error', (error) => {
      console.log('Socket connect error:', error?.message || error);
      if (state.connectionToastVisible) return;
      state.connectionToastVisible = true;
      showToast('Trying to reconnect...', 'error');
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

    state.socket.on('game-started', ({ player, room, revealEndsAt, revealDurationMs }) => {
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
      startRoleReveal(player, revealEndsAt, revealDurationMs);
    });

    state.socket.on('phase-changed', ({ phase, nightCount, messages, room }) => {
      state.roomData = room;
      state.chatMessages = room?.chatMessages || state.chatMessages;
      state.gamePhase = phase;
      state.chatOverlayOpen = false;
      state.hasActed = false;
      state.hasVoted = false;
      state.votesCast = 0;
      state.totalAlive = room?.aliveCount || 0;
      state.selectedAction = null;
      state.selectedTarget = null;
      if (messages) state.morningMessages = messages;
      if (phase === 'night') stopRoleReveal(true);
      else if (phase !== 'vote-result') stopRoleReveal(false);
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

    state.socket.on('timer-start', ({ phase, duration, endsAt }) => {
      startTimer(duration, endsAt);
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
      state.chatOverlayOpen = false;
      renderVoteResult(message);
      updateAliveCount();
      renderGamePlayerList();
      renderChatBox();
    });

    state.socket.on('game-over', ({ winner, players }) => {
      state.allPlayersWithRoles = players;
      clearTimerInterval();
      stopRoleReveal(false);
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
      state.chatOverlayOpen = false;
      state.allPlayersWithRoles = [];
      state.playerListOpen = false;
      clearTimerInterval();
      stopRoleReveal(false);
      showScreen('room');
      showNav();
      renderRoom();
      showToast('Game reset! Ready to play again.', 'success');
    });
  }

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const overlay = document.getElementById('chat-fullscreen-overlay');
    if (overlay && screenId !== 'game') {
      overlay.classList.remove('active');
      overlay.innerHTML = '';
    }
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
    if (state.toastTimeout) {
      clearTimeout(state.toastTimeout);
      state.toastTimeout = null;
    }
    toast.classList.remove('show');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    requestAnimationFrame(() => toast.classList.add('show'));
    state.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
      state.toastTimeout = null;
    }, 3000);
  }

  function startTimer(duration, endsAt) {
    clearTimerInterval();
    state.timerDuration = duration;
    state.timerEndsAt = endsAt || (Date.now() + duration * 1000);
    syncTimerValue();
    state.timerInterval = setInterval(() => {
      syncTimerValue();
      if (state.timerValue <= 0) {
        clearTimerInterval();
      }
    }, 250);
  }

  function clearTimerInterval() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function syncTimerValue() {
    state.timerValue = Math.max(0, Math.ceil((state.timerEndsAt - Date.now()) / 1000));
    updateTimerDisplay();
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

  function getRoleThemeClass(role, fallbackFaction = 'Crew') {
    const normalizedRole = String(role || '').trim().toLowerCase();
    if (normalizedRole === 'sheriff') return 'sheriff';
    if (normalizedRole === 'vitalist') return 'vitalist';
    if (normalizedRole === 'assassin') return 'assassin';
    if (normalizedRole === 'villager') return 'villager';
    if (normalizedRole === 'jester') return 'neutral';
    return String(fallbackFaction || 'Crew').trim().toLowerCase();
  }

  function getRoleBadgeClass(role, faction) {
    return `role-theme-${getRoleThemeClass(role, faction)}`;
  }

  function getRoleDefinition(role) {
    return ROLE_DEFINITIONS[role] || {
      faction: 'Crew',
      description: '',
      revealText: '',
      abilities: [],
    };
  }

  function getRolesForFaction(faction) {
    return Object.entries(ROLE_GUIDE_DEFINITIONS)
      .filter(([, roleInfo]) => roleInfo.faction === faction)
      .map(([role, roleInfo]) => ({ role, ...roleInfo }));
  }

  function renderRolesGuide() {
    const tabs = document.getElementById('roles-faction-tabs');
    const summaryLabel = document.getElementById('roles-guide-summary-label');
    const summaryCount = document.getElementById('roles-guide-summary-count');
    const grid = document.getElementById('roles-guide-grid');
    if (!tabs || !summaryLabel || !summaryCount || !grid) return;

    const activeFaction = state.currentRolesFaction || 'Crew';
    const factionRoles = getRolesForFaction(activeFaction);

    tabs.innerHTML = ROLE_GUIDE_SECTIONS.map((section) => `
      <button
        class="roles-faction-tab roles-faction-tab-${section.key.toLowerCase()} ${section.key === activeFaction ? 'active' : ''}"
        type="button"
        role="tab"
        aria-selected="${section.key === activeFaction ? 'true' : 'false'}"
        data-roles-faction="${section.key}"
      >
        <span class="roles-faction-tab-label">${section.label}</span>
      </button>
    `).join('');

    summaryLabel.className = `roles-guide-summary-label roles-faction-${activeFaction.toLowerCase()}`;
    summaryLabel.textContent = activeFaction;
    summaryCount.textContent = `${factionRoles.length} role${factionRoles.length === 1 ? '' : 's'}`;

    if (!factionRoles.length) {
      grid.innerHTML = `
        <article class="roles-empty-state">
          <h3 class="roles-empty-title">Neutral Roles Incoming</h3>
          <p class="roles-empty-copy">This faction is reserved for standalone roles with their own agendas. Their cards will appear here once they enter the lineup.</p>
        </article>
      `;
      return;
    }

    grid.innerHTML = factionRoles.map((roleInfo, index) => `
      <article class="roles-guide-card ${getRoleBadgeClass(roleInfo.role, roleInfo.faction)}" style="--role-card-delay:${index * 90}ms;">
        <div class="roles-guide-card-head">
          <div class="roles-guide-card-aura"></div>
          <div class="roles-guide-card-icon">${roleInfo.role.slice(0, 1)}</div>
          <div class="roles-guide-card-copy">
            <h3 class="roles-guide-card-title">${roleInfo.role.toUpperCase()}</h3>
            <div class="roles-guide-card-meta">
              <span>${roleInfo.faction}</span>
              ${roleInfo.subfaction ? `<span>${roleInfo.subfaction}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="roles-guide-abilities">
          ${roleInfo.abilities.map((ability) => `
            <div class="roles-guide-ability">
              <div class="roles-guide-ability-head">
                <span class="roles-guide-ability-name">${ability.name}</span>
                <span class="roles-guide-ability-type">${ability.type}</span>
              </div>
              <p class="roles-guide-ability-copy">${ability.description}</p>
            </div>
          `).join('')}
        </div>
      </article>
    `).join('');
  }

  function buildRoleRevealSequence(finalRole) {
    const roles = Object.keys(ROLE_DEFINITIONS);
    const sequence = [];
    let lastRole = null;

    for (let i = 0; i < 18; i++) {
      let nextRole = roles[Math.floor(Math.random() * roles.length)];
      if (nextRole === lastRole) {
        nextRole = roles[(roles.indexOf(nextRole) + 1 + Math.floor(Math.random() * (roles.length - 1))) % roles.length];
      }
      sequence.push(nextRole);
      lastRole = nextRole;
    }

    sequence.push(finalRole);
    lastRole = finalRole;

    for (let i = 0; i < 2; i++) {
      let nextRole = roles[Math.floor(Math.random() * roles.length)];
      if (nextRole === lastRole) {
        nextRole = roles[(roles.indexOf(nextRole) + 1 + Math.floor(Math.random() * (roles.length - 1))) % roles.length];
      }
      sequence.push(nextRole);
      lastRole = nextRole;
    }

    return {
      sequence,
      selectedIndex: sequence.length - 3,
    };
  }

  function renderRoleRevealItem(role) {
    const roleInfo = getRoleDefinition(role);
    const factionClass = roleInfo.faction.toLowerCase();
    const themeClass = getRoleBadgeClass(role, roleInfo.faction);
    return `
      <div class="role-reveal-item role-${factionClass} ${themeClass}">
        <span class="role-reveal-name">${role}</span>
        <span class="role-reveal-faction">${roleInfo.faction}</span>
      </div>
    `;
  }

  function startRoleReveal(player, revealEndsAt, revealDurationMs) {
    if (!player || !player.role) return;

    stopRoleReveal(false);
    clearTimerInterval();

    const overlay = document.getElementById('role-reveal-overlay');
    const panel = document.getElementById('role-reveal-panel');
    const reel = document.getElementById('role-reveal-reel');
    const result = document.getElementById('role-reveal-result');
    const gameContainer = document.querySelector('#screen-game .game-container');
    if (!overlay || !panel || !reel || !result || !gameContainer) return;

    const timerText = document.getElementById('timer-text');
    const timerProgress = document.getElementById('timer-progress');

    const roleInfo = getRoleDefinition(player.role);
    const roleThemeClass = getRoleBadgeClass(player.role, roleInfo.faction);
    const { sequence, selectedIndex } = buildRoleRevealSequence(player.role);
    const remainingMs = Math.max(2800, (revealEndsAt || (Date.now() + (revealDurationMs || 6000))) - Date.now());
    const spinDuration = Math.max(2200, remainingMs - 450);

    state.roleRevealActive = true;
    state.roleRevealEndsAt = revealEndsAt || (Date.now() + (revealDurationMs || 6000));
    state.timerValue = 0;

    if (timerText) timerText.textContent = '--';
    if (timerProgress) {
      timerProgress.setAttribute('stroke-dasharray', '100, 100');
      timerProgress.setAttribute('stroke', 'hsl(0,0%,32%)');
    }

    gameContainer.classList.add('role-reveal-active');
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    panel.className = 'role-reveal-panel';

    result.className = 'role-reveal-result pending';
    result.innerHTML = '<strong>Shadows decide...</strong>The reel is still spinning.';
    result.dataset.role = player.role;
    result.dataset.revealText = roleInfo.revealText;
    result.dataset.faction = roleInfo.faction.toLowerCase();
    result.dataset.theme = roleThemeClass;

    reel.dataset.selectedIndex = String(selectedIndex);
    reel.innerHTML = sequence.map((role) => renderRoleRevealItem(role)).join('');
    reel.style.transition = 'none';
    reel.style.transform = 'translateY(0px)';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        reel.style.transition = `transform ${spinDuration}ms cubic-bezier(0.14, 0.88, 0.22, 1)`;
        reel.style.transform = `translateY(-${selectedIndex * ROLE_REVEAL_ITEM_HEIGHT}px)`;
      });
    });

    if (state.roleRevealTimeout) {
      clearTimeout(state.roleRevealTimeout);
    }
    state.roleRevealTimeout = setTimeout(() => {
      const revealItems = reel.querySelectorAll('.role-reveal-item');
      if (revealItems[selectedIndex]) {
        revealItems[selectedIndex].classList.add('is-selected');
      }
      panel.className = `role-reveal-panel ${roleThemeClass} settled`;
      result.className = `role-reveal-result ${roleThemeClass}`;
      result.innerHTML = `<strong>${player.role}</strong>${roleInfo.revealText}`;
    }, spinDuration);
  }

  function stopRoleReveal(settle) {
    const overlay = document.getElementById('role-reveal-overlay');
    const panel = document.getElementById('role-reveal-panel');
    const result = document.getElementById('role-reveal-result');
    const gameContainer = document.querySelector('#screen-game .game-container');

    if (state.roleRevealTimeout) {
      clearTimeout(state.roleRevealTimeout);
      state.roleRevealTimeout = null;
    }

    state.roleRevealActive = false;
    state.roleRevealEndsAt = 0;

    if (!overlay || !panel || !gameContainer) return;

    if (settle) {
      const revealItems = document.querySelectorAll('#role-reveal-reel .role-reveal-item');
      revealItems.forEach((item) => item.classList.remove('is-selected'));
      const reel = document.getElementById('role-reveal-reel');
      const selectedIndex = Number.parseInt(reel?.dataset?.selectedIndex || '-1', 10);
      if (selectedIndex >= 0 && revealItems[selectedIndex]) {
        revealItems[selectedIndex].classList.add('is-selected');
      }
      if (result?.dataset?.role) {
        panel.className = `role-reveal-panel ${result.dataset.theme || ''} settled`.trim();
        result.className = `role-reveal-result ${result.dataset.theme || result.dataset.faction || ''}`.trim();
        result.innerHTML = `<strong>${result.dataset.role}</strong>${result.dataset.revealText || ''}`;
      }
      window.setTimeout(() => {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
      }, 220);
    } else {
      panel.className = 'role-reveal-panel';
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    }

    gameContainer.classList.remove('role-reveal-active');
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
          roleTag = `<span class="gpl-role ${getRoleBadgeClass(rp.role, rp.faction)}">${rp.role}</span>`;
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
    document.getElementById('player-count').textContent = `${data.playerCount} / ${MAX_ROOM_PLAYERS}`;
    const anonymousVotesToggle = document.getElementById('toggle-anonymous-votes');
    if (anonymousVotesToggle) {
      anonymousVotesToggle.checked = !!data.anonymousVotes;
      anonymousVotesToggle.disabled = !(state.isHost || state.playerId === data.hostId);
    }
    const anonymousEjectsToggle = document.getElementById('toggle-anonymous-ejects');
    if (anonymousEjectsToggle) {
      anonymousEjectsToggle.checked = !!data.anonymousEjects;
      anonymousEjectsToggle.disabled = !(state.isHost || state.playerId === data.hostId);
    }
    const hiddenRoleListToggle = document.getElementById('toggle-hidden-role-list');
    if (hiddenRoleListToggle) {
      hiddenRoleListToggle.checked = !!data.hiddenRoleList;
      hiddenRoleListToggle.disabled = !(state.isHost || state.playerId === data.hostId);
    }

    const list = document.getElementById('players-list');
    list.innerHTML = '';

    data.players.forEach((player) => {
      const div = document.createElement('div');
      div.className = `player-item${player.id === state.playerId ? ' is-self' : ''}`;

      div.innerHTML = `
        ${renderAvatarMarkup(player.id || player.name, 'player-avatar', player.avatarIndex)}
        <span class="player-name">${player.name}</span>
        <div class="player-badges">
          ${player.id === state.playerId ? '<span class="player-you">YOU</span>' : ''}
          ${player.isHost ? '<span class="player-crown"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/></svg></span>' : ''}
        </div>
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

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getSummaryLineClass(line) {
    const text = String(line || '').trim();
    if (!text) return '';
    if (/alive players:/i.test(text)) return 'summary-alive';
    if (/was found dead|was eliminated by vote/i.test(text)) return 'summary-death';
    if (/used their gun/i.test(text)) return 'summary-shoot';
    if (/investigating someone/i.test(text)) return 'summary-search';
    if (/protected someone/i.test(text)) return 'summary-protect';
    if (/moved through the shadows/i.test(text)) return 'summary-kill';
    return '';
  }

  function formatChatMessageHtml(message) {
    if (message.type === 'system' && message.summaryTitle) {
      const title = `<div class="chat-summary-title">${escapeHtml(message.summaryTitle)}</div>`;
      const lines = (message.summaryLines || []).map((line) => {
        const lineClass = getSummaryLineClass(line);
        return `<div class="chat-summary-line${lineClass ? ` ${lineClass}` : ''}">${escapeHtml(line)}</div>`;
      }).join('');
      return `${title}${lines ? `<div class="chat-summary-lines">${lines}</div>` : ''}`;
    }

    return escapeHtml(message.text).replace(/\n/g, '<br>');
  }

  function renderChatBox() {
    const panel = document.getElementById('phase-chat-panel');
    if (!panel) return;

    const mode = getChatMode();
    const canChat = mode === 'morning' || mode === 'voting';
    const isMorningFullscreen = mode === 'morning' && state.chatOverlayOpen;
    const isExpandedMode = mode === 'morning' && !isMorningFullscreen;
    const isDockedMode = mode !== 'hidden' && !isExpandedMode;
    const isOverlayOpen = state.chatOverlayOpen;
    const subtitle = canChat
      ? 'Chat is open for discussion.'
      : mode === 'readonly'
        ? 'Waiting for the next phase...'
        : 'Chat is visible but locked until morning.';
    const messages = state.chatMessages || [];

    panel.className = `phase-chat-panel ${isOverlayOpen ? 'chat-expanded' : 'chat-compact'}${canChat ? '' : ' chat-locked'}${isDockedMode ? ' chat-docked-mode' : ''}${isOverlayOpen && isDockedMode ? ' chat-overlay-open' : ''}`;

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
    } else if (player.role === 'Vitalist') {
      state.selectedAction = 'protect';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="protect">🛡️ PROTECT</button></div>';
    } else if (player.role === 'Assassin') {
      state.selectedAction = 'kill';
      actionsHTML = `<div class="action-buttons"><button class="action-btn selected ${actionClass}" data-action="kill">🗡️ KILL</button></div>`;
    }

    let actionDesc = '';
    if (player.role === 'Sheriff') actionDesc = 'Choose to shoot or investigate a player';
    else if (player.role === 'Vitalist') actionDesc = 'Choose a player to protect tonight';
    else if (player.role === 'Assassin') actionDesc = 'Choose a crew member to eliminate';

    // For the Vitalist: find the last protected player name to show restriction
    let medicNote = '';
    if (player.role === 'Vitalist' && player.lastMedicTarget) {
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
            const isRestricted = player.role === 'Vitalist' && t.id === player.lastMedicTarget;
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
      const div = document.createElement('div');
      div.className = 'search-result-card';
      div.innerHTML = `<div class="search-label">🔍 INVESTIGATION RESULT</div><div class="search-target-name">${state.searchResult.targetName}</div><div class="search-target-role ${getRoleBadgeClass(state.searchResult.role, state.searchResult.faction)}">${state.searchResult.role} (${state.searchResult.faction})</div>`;
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
    } else if (player.role === 'Vitalist') {
      state.selectedAction = 'protect';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="protect">🛡️ PROTECT</button></div>';
    } else if (player.role === 'Assassin') {
      state.selectedAction = 'kill';
      actionsHTML = `<div class="action-buttons"><button class="action-btn selected ${actionClass}" data-action="kill">🗡️ KILL</button></div>`;
    }

    let actionDesc = '';
    if (player.role === 'Sheriff') actionDesc = 'Choose to shoot or investigate a player';
    else if (player.role === 'Vitalist') actionDesc = 'Choose a player to protect tonight';
    else if (player.role === 'Assassin') actionDesc = 'Choose a crew member to eliminate';

    container.innerHTML = `
      <div class="action-panel">
        <div class="action-title">NIGHT ACTION</div>
        <div class="action-subtitle">${actionDesc}</div>
        ${actionsHTML}
        <div class="target-label">SELECT TARGET</div>
        <div class="target-list" id="target-list">
          ${targets.map(t => {
            const isRestricted = player.role === 'Vitalist' && t.id === player.lastMedicTarget;
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
    const roleInfo = getRoleDefinition(player.role);

    const card = document.getElementById('role-card');
    const faction = document.getElementById('role-faction');
    const roleName = document.getElementById('role-name');
    const desc = document.getElementById('role-description');
    const teammates = document.getElementById('role-teammates');
    const teammatesList = document.getElementById('teammates-list');

    card.className = `role-card ${player.faction?.toLowerCase() || ''} ${getRoleBadgeClass(player.role, player.faction)}`;
    faction.textContent = player.faction?.toUpperCase() || '';
    roleName.textContent = player.role?.toUpperCase() || '';
    desc.textContent = roleInfo.description;

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
      if (p.id === state.playerId) return state.playerData.role === 'Vitalist';
      if (state.playerData.role === 'Assassin') {
        const isTeammate = state.playerData.teammates?.some(t => t.id === p.id);
        if (isTeammate) return false;
      }
      return true;
    }).map(p => ({ id: p.id, name: p.name, avatarIndex: p.avatarIndex }));
  }

  function getVoteTargets() {
    if (!state.roomData) return [];
    return state.roomData.players
      .filter(p => p.alive && p.id !== state.playerId)
      .map(p => ({ id: p.id, name: p.name, avatarIndex: p.avatarIndex }));
  }

  function showGameOver(winner, players) {
    showScreen('gameover');
    const glow = document.getElementById('gameover-glow');
    const title = document.getElementById('gameover-faction');
    const reason = document.getElementById('gameover-reason');
    const playersList = document.getElementById('gameover-players');
    const winnerLabel = winner.winner === 'Assassin' ? 'Assassins Win' : 'Crew Wins';

    glow.className = `gameover-glow ${winner.winner === 'Crew' ? 'crew-win' : 'assassin-win'}`;
    title.className = `gameover-faction ${winner.winner === 'Crew' ? 'crew-text' : 'assassin-text'}`;
    title.textContent = winnerLabel.toUpperCase();
    reason.textContent = winner.reason;

    playersList.innerHTML = players.map(p => `
      <div class="gameover-player ${!p.alive ? 'dead' : ''}">
        <span class="gameover-player-name">${p.name}</span>
        <span class="gameover-player-role ${getRoleBadgeClass(p.role, p.faction)}">
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
        } else if (tabName === 'roles') {
          renderRolesGuide();
          showScreen('roles');
        }
        else if (tabName === 'rules') showScreen('rules');
        else if (tabName === 'changelog') showScreen('changelog');
      });
    });

    const rolesFactionTabs = document.getElementById('roles-faction-tabs');
    if (rolesFactionTabs) {
      rolesFactionTabs.addEventListener('click', (event) => {
        const button = event.target.closest('[data-roles-faction]');
        if (!button) return;
        state.currentRolesFaction = button.dataset.rolesFaction || 'Crew';
        renderRolesGuide();
      });
    }

    const profileNameInput = document.getElementById('profile-name-input');
    const onlineBtn = document.getElementById('btn-online');
    const backOnlineBtn = document.getElementById('btn-back-online');
    const homeRoomCodeInput = document.getElementById('home-room-code-input');
    const createRoomBtn = document.getElementById('btn-create-room');
    const joinRoomBtn = document.getElementById('btn-join-room');

    if (onlineBtn) {
      onlineBtn.addEventListener('click', () => {
        if (!state.profileConfirmed) {
          const errorEl = document.getElementById('profile-error');
          if (errorEl) errorEl.textContent = 'Confirm your profile first';
          return;
        }
        showScreen('online');
      });
    }

    if (backOnlineBtn) {
      backOnlineBtn.addEventListener('click', () => showScreen('home'));
    }

    if (profileNameInput) {
      profileNameInput.addEventListener('input', () => {
        state.username = normalizeProfileName(profileNameInput.value);
        saveProfile();
      });
    }

    if (homeRoomCodeInput) {
      homeRoomCodeInput.addEventListener('input', () => {
        homeRoomCodeInput.value = homeRoomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      });
      homeRoomCodeInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') joinRoomBtn.click();
      });
    }

    if (createRoomBtn) {
      createRoomBtn.addEventListener('click', () => {
        if (!state.profileConfirmed) {
          const errorEl = document.getElementById('profile-error');
          if (errorEl) errorEl.textContent = 'Confirm your profile first';
          return;
        }
        const profile = validateProfile();
        if (!profile) return;
        state.socket.emit('create-room', { playerId: state.playerId, username: profile.username, avatarIndex: profile.avatarIndex }, (response) => {
          const errorEl = document.getElementById('profile-error');
          if (response.success) {
            state.playerId = response.playerId;
            state.roomCode = response.room.code;
            state.roomData = response.room;
            state.isHost = true;
            setRoomUrl(state.roomCode);
            applyRoomCodeToInput(state.roomCode);
            showScreen('room');
            renderRoom();
          } else if (errorEl) {
            errorEl.textContent = response.error || 'Failed to create room';
          }
        });
      });
    }

    if (joinRoomBtn) {
      joinRoomBtn.addEventListener('click', () => {
        if (!state.profileConfirmed) {
          const errorEl = document.getElementById('profile-error');
          if (errorEl) errorEl.textContent = 'Confirm your profile first';
          return;
        }
        const profile = validateProfile({ requireCode: true });
        if (!profile) return;
        state.socket.emit('join-room', { code: profile.code, playerId: state.playerId, username: profile.username, avatarIndex: profile.avatarIndex }, (response) => {
          const errorEl = document.getElementById('profile-error');
          if (response.success) {
            state.playerId = response.playerId;
            state.roomCode = response.room.code;
            state.roomData = response.room;
            state.isHost = false;
            setRoomUrl(state.roomCode);
            applyRoomCodeToInput(state.roomCode);
            showScreen('room');
            renderRoom();
          } else if (errorEl) {
            errorEl.textContent = response.error || 'Failed to join room';
          }
        });
      });
    }

    document.getElementById('btn-leave-room').addEventListener('click', () => {
      state.socket.emit('leave-room', () => {
        state.roomCode = null;
        state.roomData = null;
        state.isHost = false;
        clearRoomUrl();
        applyRoomCodeToInput('');
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

    document.getElementById('toggle-anonymous-ejects').addEventListener('change', (event) => {
      state.socket.emit('update-room-settings', { anonymousEjects: event.target.checked }, (response) => {
        if (!response.success) {
          showToast(response.error || 'Could not update room settings', 'error');
          event.target.checked = !!state.roomData?.anonymousEjects;
        }
      });
    });

    document.getElementById('toggle-hidden-role-list').addEventListener('change', (event) => {
      state.socket.emit('update-room-settings', { hiddenRoleList: event.target.checked }, (response) => {
        if (!response.success) {
          showToast(response.error || 'Could not update room settings', 'error');
          event.target.checked = !!state.roomData?.hiddenRoleList;
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
      clearRoomUrl();
      applyRoomCodeToInput('');
      showScreen('home');
      showNav();
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelector('[data-tab="home"]').classList.add('active');
      renderProfilePanel();
    });

  }

  function init() {
    const profile = loadProfile();
    state.playerId = getOrCreatePlayerSessionId();
    state.username = profile.name;
    state.selectedAvatarIndex = profile.avatarIndex;
    state.profileConfirmed = profile.confirmed;
    state.roomCode = getRoomCodeFromUrl();
    connectSocket();
    initEventListeners();
    renderProfilePanel();
    renderRolesGuide();
    applyRoomCodeToInput(state.roomCode);
    showScreen(state.roomCode ? 'online' : 'home');
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
    } else if (player.role === 'Vitalist') {
      state.selectedAction = 'protect';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="protect">🛡️ PROTECT</button></div>';
    } else if (player.role === 'Assassin') {
      state.selectedAction = 'kill';
      actionsHTML = `<div class="action-buttons"><button class="action-btn selected ${actionClass}" data-action="kill">🗡️ KILL</button></div>`;
    }

    let actionDesc = '';
    if (player.role === 'Sheriff') actionDesc = 'Choose to shoot or investigate a player';
    else if (player.role === 'Vitalist') actionDesc = 'Choose a player to protect tonight';
    else if (player.role === 'Assassin') actionDesc = 'Choose a crew member to eliminate';

    container.innerHTML = `
      <div class="action-panel">
        <div class="action-title">NIGHT ACTION</div>
        <div class="action-subtitle">${actionDesc}</div>
        ${actionsHTML}
        <div class="target-label">SELECT TARGET</div>
        <div class="target-list" id="target-list">
          ${targets.map(t => {
            const isRestricted = player.role === 'Vitalist' && t.id === player.lastMedicTarget;
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

    return '';
  }

  function getRenderableChatMessages() {
    return [...(state.chatMessages || []), ...(state.privateChatMessages || [])]
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function getChatItemsMarkup(messages) {
    return messages.length
      ? messages.map((message) => {
        const isSelf = message.senderId === state.playerId;
        const phaseClass = message.type === 'system' && message.phase ? ` phase-${message.phase}` : '';
        const summaryClass = message.type === 'system' && message.summaryTitle ? ' phase-summary' : '';
        const classes = `chat-message ${message.type === 'system' ? 'system' : 'player'}${phaseClass}${summaryClass}${message.private ? ' private' : ''}${isSelf ? ' self' : ''}`;
        const sender = message.type === 'system' ? 'SYSTEM' : message.senderName;
        const style = getPlayerChatStyle(message);
        return `
          <div class="${classes}"${style ? ` style="${style}"` : ''}>
            <div class="chat-message-meta">${sender}</div>
            <div class="chat-message-text">${formatChatMessageHtml(message)}</div>
          </div>`;
      }).join('')
      : '<div class="chat-empty">No messages yet.</div>';
  }

  function bindChatComposer(form, canChat) {
    if (!form || !canChat) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = form.querySelector('.chat-input');
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

  function ensureChatOverlay() {
    let overlay = document.getElementById('chat-fullscreen-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'chat-fullscreen-overlay';
    overlay.className = 'chat-fullscreen-overlay';
    document.body.appendChild(overlay);
    return overlay;
  }

  function renderChatBox() {
    const panel = document.getElementById('phase-chat-panel');
    if (!panel) return;

    const mode = getChatMode();
    const canChat = mode === 'morning' || mode === 'voting';
    const isMorningFullscreen = mode === 'morning' && state.chatOverlayOpen;
    const isExpandedMode = mode === 'morning' && !isMorningFullscreen;
    const isDockedMode = mode !== 'hidden' && !isExpandedMode;
    const isOverlayOpen = state.chatOverlayOpen;
    const subtitle = canChat
      ? 'Chat is open for discussion.'
      : mode === 'readonly'
        ? 'Waiting for the next phase...'
        : 'Chat is visible but locked until morning.';
    const gameContainer = document.querySelector('.game-container');
    const messages = getRenderableChatMessages();
    const overlay = ensureChatOverlay();
    const isStandaloneOverlay = isDockedMode && isOverlayOpen;

    panel.className = `phase-chat-panel ${isStandaloneOverlay ? 'chat-overlay-anchor' : isOverlayOpen ? 'chat-expanded' : 'chat-compact'}${canChat ? '' : ' chat-locked'}${isDockedMode ? ' chat-docked-mode' : ''}`;
    if (gameContainer) {
      gameContainer.classList.toggle('chat-overlay-active', isStandaloneOverlay);
    }
    overlay.classList.toggle('active', isStandaloneOverlay);

    if (mode === 'hidden') {
      panel.innerHTML = '';
      overlay.innerHTML = '';
      return;
    }

    if (isDockedMode && !isOverlayOpen) {
      overlay.innerHTML = '';
      panel.innerHTML = `
        <button class="chat-dock-toggle" id="chat-open-btn" type="button">
          <span class="chat-dock-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </span>
          <span class="chat-dock-copy">
            <span class="chat-dock-title">Open Chat</span>
            <span class="chat-dock-subtitle">${canChat ? 'Discussion and actions' : 'View updates'}</span>
          </span>
        </button>`;
      const openBtn = document.getElementById('chat-open-btn');
      if (openBtn) {
        openBtn.addEventListener('click', () => {
          state.chatOverlayOpen = true;
          renderChatBox();
        });
      }
      return;
    }

    const localPanel = getLocalActionPanelMarkup();
    const items = getChatItemsMarkup(messages);

    if (isStandaloneOverlay) {
      panel.innerHTML = '';
      overlay.innerHTML = `
        <div class="chat-fullscreen-shell${canChat ? '' : ' chat-locked'}">
          ${localPanel}
          <div class="chat-panel-header">
            <div>
              <div class="chat-panel-title">Room Chat</div>
              <div class="chat-panel-subtitle">${subtitle}</div>
            </div>
            <div class="chat-header-actions">
              <button class="chat-close-btn" id="chat-overlay-close-btn" type="button">Close</button>
            </div>
          </div>
          <div class="chat-messages" id="chat-overlay-messages">${items}</div>
          <form class="chat-input-row" id="chat-overlay-form">
            <input
              id="chat-overlay-input"
              class="chat-input"
              type="text"
              maxlength="280"
              placeholder="${canChat ? 'Type a message...' : 'Chat is locked at night'}"
              ${canChat ? '' : 'disabled'}
            />
            <button class="btn btn-primary chat-send-btn" type="submit" ${canChat ? '' : 'disabled'}>Send</button>
          </form>
        </div>`;

      const overlayMessages = document.getElementById('chat-overlay-messages');
      if (overlayMessages) overlayMessages.scrollTop = overlayMessages.scrollHeight;

      const overlayCloseBtn = document.getElementById('chat-overlay-close-btn');
      if (overlayCloseBtn) {
        overlayCloseBtn.addEventListener('click', () => {
          state.chatOverlayOpen = false;
          renderChatBox();
        });
      }

      bindChatComposer(document.getElementById('chat-overlay-form'), canChat);
      return;
    }

    overlay.innerHTML = '';

    panel.innerHTML = `
      ${localPanel}
      <div class="chat-panel-header">
        <div>
          <div class="chat-panel-title">Room Chat</div>
          <div class="chat-panel-subtitle">${subtitle}</div>
        </div>
        <div class="chat-header-actions">
          ${mode === 'morning' && !isOverlayOpen ? '<button class="chat-fullscreen-btn" id="chat-fullscreen-btn" type="button">Fullscreen</button>' : ''}
          ${isDockedMode ? '<button class="chat-close-btn" id="chat-close-btn" type="button">Close</button>' : ''}
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

    const fullscreenBtn = document.getElementById('chat-fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        state.chatOverlayOpen = true;
        renderChatBox();
      });
    }

    const closeBtn = document.getElementById('chat-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        state.chatOverlayOpen = false;
        renderChatBox();
      });
    }

    bindChatComposer(document.getElementById('chat-form'), canChat);
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
      actionsHTML = `<div class="action-buttons"><button class="action-btn ${state.selectedAction === 'shoot' ? 'selected' : ''}" data-action="shoot">Shoot</button><button class="action-btn ${state.selectedAction === 'search' ? 'selected' : ''}" data-action="search">Search</button></div>`;
    } else if (player.role === 'Vitalist') {
      state.selectedAction = 'protect';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="protect">Protect</button></div>';
    } else if (player.role === 'Assassin') {
      state.selectedAction = 'kill';
      actionsHTML = `<div class="action-buttons"><button class="action-btn selected ${actionClass}" data-action="kill">Kill</button></div>`;
    }

    let actionDesc = '';
    if (player.role === 'Sheriff') actionDesc = 'Choose to shoot or investigate a player';
    else if (player.role === 'Vitalist') actionDesc = 'Choose a player to protect tonight';
    else if (player.role === 'Assassin') actionDesc = 'Choose a crew member to eliminate';

    container.innerHTML = `
      <div class="action-panel">
        <div class="action-title">YOUR NIGHT ACTION</div>
        <div class="action-subtitle">${actionDesc}</div>
        ${actionsHTML}
        <div class="target-label">SELECT TARGET</div>
        <div class="target-list chat-target-list" id="target-list">
          ${targets.map(t => {
            const isRestricted = player.role === 'Vitalist' && t.id === player.lastMedicTarget;
            return `<div class="target-item ${state.selectedTarget === t.id ? `selected ${targetClass}` : ''} ${isRestricted ? 'target-restricted' : ''}" data-target="${t.id}" ${isRestricted ? 'data-restricted="true"' : ''}>${renderAvatarMarkup(t.id || t.name, 'target-avatar', t.avatarIndex)}<span class="target-name">${t.name}</span></div>`;
          }).join('')}
        </div>
        <div class="chat-local-actions">
          <button class="btn ${isAssassin ? 'btn-assassin' : 'btn-crew'} confirm-action" id="btn-confirm-action" ${!state.selectedAction || !state.selectedTarget ? 'disabled' : ''}>Confirm</button>
          <button class="btn btn-ghost chat-local-skip" id="btn-skip-night">Skip</button>
        </div>
      </div>
      <div id="phase-chat-panel"></div>`;

    container.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.remove('action-activate');
        void btn.offsetWidth;
        btn.classList.add('action-activate');
        state.selectedAction = btn.dataset.action;
        state.selectedTarget = null;
        renderNightPhase(container);
      });
    });

    container.querySelectorAll('#target-list .target-item').forEach(item => {
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
        <div class="action-title">CAST YOUR VOTE</div>
        <div class="action-subtitle">${state.votesCast} / ${aliveCount} votes cast</div>
        <div class="target-label">SELECT PLAYER</div>
        <div class="target-list chat-target-list" id="vote-target-list">
          ${targets.map(t => `<div class="target-item ${state.selectedTarget === t.id ? 'selected' : ''}" data-target="${t.id}">${renderAvatarMarkup(t.id || t.name, 'target-avatar', t.avatarIndex)}<span class="target-name">${t.name}</span></div>`).join('')}
        </div>
        <div class="chat-local-actions">
          <button class="skip-vote-btn ${state.selectedTarget === 'skip' ? 'selected' : ''}" id="btn-vote-skip">Skip Vote</button>
          <button class="btn btn-primary confirm-action" id="btn-confirm-vote" ${!state.selectedTarget ? 'disabled' : ''}>Confirm Vote</button>
        </div>
      </div>
      <div id="phase-chat-panel"></div>`;

    container.querySelectorAll('#vote-target-list .target-item').forEach(item => {
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


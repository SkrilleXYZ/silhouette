class GameLogic {
  constructor() {
    this.rooms = new Map();
    this.avatarCount = 29;
    this.roleCatalog = {
      Crew: {
        Info: ['Villager', 'Investigator', 'Tracker', 'Stalker'],
        Protection: ['Vitalist', 'Mirror Caster'],
        Killing: ['Sheriff', 'Veteran'],
      },
      Assassin: {
        Power: ['Assassin'],
      },
      Neutral: {
        Evil: ['Jester', 'Executioner'],
        Benign: ['Amnesiac'],
      },
    };
  }

  normalizePlayerName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 16);
  }

  sanitizeAvatarIndex(avatarIndex) {
    return Number.isInteger(avatarIndex) && avatarIndex >= 0
      ? avatarIndex % this.avatarCount
      : this.assignAvatarIndex({ players: new Map() });
  }

  sanitizePlayerColorHex(colorHex) {
    const normalized = String(colorHex || '').trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) return null;
    return normalized.toUpperCase();
  }

  resolveUniquePlayerName(room, requestedName) {
    const baseName = this.normalizePlayerName(requestedName);
    if (!baseName) return '';

    const takenNames = new Set();
    for (const [, player] of room.players) {
      takenNames.add(player.name.toLowerCase());
    }

    if (!takenNames.has(baseName.toLowerCase())) return baseName;

    let suffix = 2;
    while (true) {
      const suffixText = `-${suffix}`;
      const stem = baseName.slice(0, Math.max(1, 16 - suffixText.length));
      const candidate = `${stem}${suffixText}`;
      if (!takenNames.has(candidate.toLowerCase())) return candidate;
      suffix++;
    }
  }

  assignAvatarIndex(room) {
    const usedIndexes = new Set();
    for (const [, player] of room.players) {
      if (Number.isInteger(player.avatarIndex)) usedIndexes.add(player.avatarIndex);
    }

    const availableIndexes = [];
    for (let index = 0; index < this.avatarCount; index++) {
      if (!usedIndexes.has(index)) availableIndexes.push(index);
    }

    if (availableIndexes.length) {
      return availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
    }

    return Math.floor(Math.random() * this.avatarCount);
  }

  generateRoomCode() {
    let code;
    do {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      code = code.replace(/[^A-Z0-9]/g, '');
      while (code.length < 6) {
        code += Math.random().toString(36).substring(2, 3).toUpperCase();
      }
      code = code.substring(0, 6);
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(hostId, hostName, avatarIndex = null, colorHex = null) {
    const code = this.generateRoomCode();
    const room = {
      code,
      hostId,
      players: new Map(),
      state: 'lobby',
      phase: 0,
      nightActions: {},
      votes: {},
      nightResults: [],
      eliminatedToday: null,
      winner: null,
      nightCount: 0,
      votingTimer: null,
      nightTimer: null,
      morningMessages: [],
      chatMessages: [],
      currentPhaseSummaryId: null,
      anonymousVotes: false,
      anonymousEjects: false,
      hiddenRoleList: false,
      playerOrder: [],
      lastAction: Date.now(),
      lastMedicTarget: null,
      lastMirrorTargets: {},
      lastInvestigatorTargets: {},
      lastTrackerTargets: {},
      lastStalkerTargets: {},
      recentKillers: [],
      roleRevealEndsAt: 0,
    };

    const normalizedHostName = this.normalizePlayerName(hostName);
    if (normalizedHostName.length < 2) return { error: 'Name must be at least 2 characters' };

    room.players.set(hostId, {
      id: hostId,
      name: normalizedHostName,
      avatarIndex: Number.isInteger(avatarIndex) ? this.sanitizeAvatarIndex(avatarIndex) : this.assignAvatarIndex(room),
      colorHex: this.sanitizePlayerColorHex(colorHex),
      role: null,
      faction: null,
      veteranUsesRemaining: 4,
      mirrorUsesRemaining: 4,
      executionerTargetId: null,
      alive: true,
      connected: true
    });

    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code, playerId, playerName, avatarIndex = null, colorHex = null) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };
    if (room.state !== 'lobby') return { error: 'Game already in progress' };
    if (room.players.size >= 16) return { error: 'Room is full' };
    const resolvedName = this.resolveUniquePlayerName(room, playerName);
    if (resolvedName.length < 2) return { error: 'Name must be at least 2 characters' };

    room.players.set(playerId, {
      id: playerId,
      name: resolvedName,
      avatarIndex: Number.isInteger(avatarIndex) ? this.sanitizeAvatarIndex(avatarIndex) : this.assignAvatarIndex(room),
      colorHex: this.sanitizePlayerColorHex(colorHex),
      role: null,
      faction: null,
      veteranUsesRemaining: 4,
      mirrorUsesRemaining: 4,
      executionerTargetId: null,
      alive: true,
      connected: true
    });

    return { room };
  }

  reconnectPlayer(code, playerId, playerName = null, avatarIndex = null, colorHex = null) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };

    const player = room.players.get(playerId);
    if (!player) return { error: 'Player not found' };

    const normalizedName = this.normalizePlayerName(playerName);
    if (normalizedName.length >= 2) {
      player.name = normalizedName;
    }
    if (Number.isInteger(avatarIndex)) {
      player.avatarIndex = this.sanitizeAvatarIndex(avatarIndex);
    }
    if (colorHex) {
      player.colorHex = this.sanitizePlayerColorHex(colorHex);
    }

    player.connected = true;
    room.lastAction = Date.now();
    return { room, player };
  }

  leaveRoom(code, playerId) {
    const room = this.rooms.get(code);
    if (!room) return null;

    room.players.delete(playerId);

    if (room.hostId === playerId) {
      if (room.players.size > 0) {
        const newHost = room.players.keys().next().value;
        room.hostId = newHost;
      } else {
        this.rooms.delete(code);
        return { deleted: true };
      }
    }

    return { room, newHostId: room.hostId };
  }

  disconnectPlayer(code, playerId) {
    const room = this.rooms.get(code);
    if (!room) return null;

    if (room.state === 'lobby') {
      return this.leaveRoom(code, playerId);
    }

    const player = room.players.get(playerId);
    if (!player) return { room };

    player.connected = false;
    room.lastAction = Date.now();
    return { room };
  }

  pickRandomRole(roles) {
    if (!Array.isArray(roles) || !roles.length) return null;
    return roles[Math.floor(Math.random() * roles.length)];
  }

  pickRoleForSlot(faction, subfaction) {
    const pool = this.roleCatalog?.[faction]?.[subfaction] || [];
    return this.pickRandomRole(pool);
  }

  assignRoleFromSlot(room, playerId, faction, subfaction) {
    const player = room.players.get(playerId);
    if (!player) return false;

    const role = this.pickRoleForSlot(faction, subfaction);
    if (!role) return false;

    player.role = role;
    player.faction = faction;
    return true;
  }

  assignExecutionerTargets(room) {
    if (!room) return;

    const players = Array.from(room.players.values());
    const executioners = players.filter((player) => player.role === 'Executioner');

    for (const executioner of executioners) {
      const possibleTargets = players.filter((player) => player.id !== executioner.id);
      const target = this.pickRandomRole(possibleTargets);
      executioner.executionerTargetId = target?.id || null;
    }
  }

  convertExecutionerToAmnesiac(room, playerId) {
    const player = room?.players?.get(playerId);
    if (!player || player.role !== 'Executioner') return false;

    player.role = 'Amnesiac';
    player.faction = 'Neutral';
    player.executionerTargetId = null;
    return true;
  }

  assignNeutralSpecialRole(room, playerId, categories = ['Evil']) {
    const player = room.players.get(playerId);
    if (!player) return false;

    const pool = categories.flatMap((category) => this.roleCatalog?.Neutral?.[category] || []);
    const role = this.pickRandomRole(pool);
    if (!role) return false;

    player.role = role;
    player.faction = 'Neutral';
    return true;
  }

  inheritDeadRole(room, playerId, targetId) {
    const player = room.players.get(playerId);
    const target = room.players.get(targetId);
    if (!player || !target || target.alive) return { error: 'Invalid target' };

    player.role = target.role;
    player.faction = target.faction;
    player.executionerTargetId = target.role === 'Executioner' ? (target.executionerTargetId || null) : null;
    player.veteranUsesRemaining = target.role === 'Veteran' ? (target.veteranUsesRemaining ?? 4) : 4;
    player.mirrorUsesRemaining = target.role === 'Mirror Caster' ? (target.mirrorUsesRemaining ?? 4) : 4;

    return { success: true, player };
  }

  assignRoles(code) {
    const room = this.rooms.get(code);
    if (!room) return null;

    const playerIds = Array.from(room.players.keys());
    const count = playerIds.length;

    let assassinCount;
    if (count <= 6) assassinCount = 1;
    else if (count <= 9) assassinCount = 2;
    else if (count <= 12) assassinCount = 3;
    else assassinCount = 4;

    const shuffled = [...playerIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    for (const playerId of shuffled) {
      const player = room.players.get(playerId);
      if (!player) continue;
      player.veteranUsesRemaining = 4;
      player.mirrorUsesRemaining = 4;
      player.executionerTargetId = null;
    }

    let index = 0;

    if (count === 5) {
      const slotPlan = [
        { faction: 'Crew', subfaction: 'Info' },
        { faction: 'Crew', subfaction: 'Protection' },
        { faction: 'Crew', subfaction: 'Killing' },
        { faction: 'Assassin', subfaction: 'Power' },
        { faction: 'Neutral', subfaction: 'Evil' },
      ];

      for (const slot of slotPlan) {
        this.assignRoleFromSlot(room, shuffled[index], slot.faction, slot.subfaction);
        index++;
      }

      room.playerOrder = shuffled;
      this.assignExecutionerTargets(room);
      return room;
    }

    if (count === 7) {
      const slotPlan = [
        { faction: 'Crew', subfaction: 'Info' },
        { faction: 'Crew', subfaction: 'Protection' },
        { faction: 'Crew', subfaction: 'Killing' },
        { faction: 'Crew', subfaction: 'Info' },
        { faction: 'Assassin', subfaction: 'Power' },
        { faction: 'Assassin', subfaction: 'Power' },
      ];

      for (const slot of slotPlan) {
        this.assignRoleFromSlot(room, shuffled[index], slot.faction, slot.subfaction);
        index++;
      }

      this.assignNeutralSpecialRole(room, shuffled[index], ['Evil', 'Benign']);
      room.playerOrder = shuffled;
      this.assignExecutionerTargets(room);
      return room;
    }

    for (let i = 0; i < assassinCount; i++) {
      const player = room.players.get(shuffled[index]);
      player.role = 'Assassin';
      player.faction = 'Assassin';
      index++;
    }

    if (index < shuffled.length) {
      this.assignRoleFromSlot(room, shuffled[index], 'Neutral', 'Evil');
      index++;
    }

    this.assignRoleFromSlot(room, shuffled[index], 'Crew', 'Killing');
    index++;

    this.assignRoleFromSlot(room, shuffled[index], 'Crew', 'Protection');
    index++;

    if (index < shuffled.length) {
      this.assignRoleFromSlot(room, shuffled[index], 'Crew', 'Info');
      index++;
    }

    while (index < shuffled.length) {
      const player = room.players.get(shuffled[index]);
      player.role = 'Villager';
      player.faction = 'Crew';
      index++;
    }

    room.playerOrder = shuffled;
    this.assignExecutionerTargets(room);
    return room;
  }

  startGame(code, requesterId) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };
    if (room.hostId !== requesterId) return { error: 'Only the host can start the game' };
    if (room.players.size < 5) return { error: 'Need at least 5 players' };

    this.assignRoles(code);
    room.state = 'night';
    room.nightCount = 1;
    room.nightActions = {};
    room.morningMessages = [];
    room.chatMessages = [];
    room.currentPhaseSummaryId = null;
    room.lastMedicTarget = null;
    room.lastMirrorTargets = {};
    room.lastInvestigatorTargets = {};
    room.lastTrackerTargets = {};
    room.lastStalkerTargets = {};
    room.roleRevealEndsAt = 0;

    this.beginPhaseSummary(code, 'Night 1 has begun. Chat is locked until morning.');

    return { room };
  }

  resetRoom(code) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };

    for (const [, player] of room.players) {
      player.role = null;
      player.faction = null;
      player.veteranUsesRemaining = 4;
      player.mirrorUsesRemaining = 4;
      player.executionerTargetId = null;
      player.alive = true;
      player.connected = true;
    }

    room.state = 'lobby';
    room.phase = 0;
    room.nightActions = {};
    room.votes = {};
    room.nightResults = [];
    room.eliminatedToday = null;
    room.winner = null;
    room.nightCount = 0;
    room.morningMessages = [];
    room.chatMessages = [];
    room.currentPhaseSummaryId = null;
    room.playerOrder = [];
    room.lastAction = Date.now();
    room.lastMedicTarget = null;
    room.lastMirrorTargets = {};
    room.lastInvestigatorTargets = {};
    room.lastTrackerTargets = {};
    room.lastStalkerTargets = {};
    room.recentKillers = [];
    room.roleRevealEndsAt = 0;

    return { room };
  }

  submitNightAction(code, playerId, action, targetId) {
    const room = this.rooms.get(code);
    if (!room || room.state !== 'night') return { error: 'Not in night phase' };
    if (room.roleRevealEndsAt && Date.now() < room.roleRevealEndsAt) {
      return { error: 'Night actions unlock after the role reveal.' };
    }

    const player = room.players.get(playerId);
    if (!player || !player.alive) return { error: 'Invalid player' };

    if (player.role === 'Sheriff') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'shoot' && action !== 'search') return { error: 'Invalid action for Sheriff' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
    } else if (player.role === 'Investigator') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'examine') return { error: 'Invalid action for Investigator' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      const recentTargets = room.lastInvestigatorTargets[playerId] || [];
      if (recentTargets.length >= 2 && recentTargets[recentTargets.length - 1] === targetId && recentTargets[recentTargets.length - 2] === targetId) {
        return { error: 'You cannot target the same player 3 times in a row' };
      }
    } else if (player.role === 'Tracker') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'track') return { error: 'Invalid action for Tracker' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      if (room.lastTrackerTargets[playerId] === targetId) {
        return { error: 'You cannot target the same player twice in a row' };
      }
    } else if (player.role === 'Stalker') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'stalk') return { error: 'Invalid action for Stalker' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      if (room.lastStalkerTargets[playerId] === targetId) {
        return { error: 'You cannot target the same player twice in a row' };
      }
    } else if (player.role === 'Vitalist') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'protect') return { error: 'Invalid action for Vitalist' };
      // Cannot protect the same player twice in a row
      if (targetId === room.lastMedicTarget) {
        return { error: 'You cannot protect the same player two nights in a row' };
      }
    } else if (player.role === 'Mirror Caster') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'mirror') return { error: 'Invalid action for Mirror Caster' };
      if ((player.mirrorUsesRemaining ?? 4) <= 0) return { error: 'You have no Mirror uses remaining' };
      if (room.lastMirrorTargets[playerId] === targetId) {
        return { error: 'You cannot target the same player twice in a row' };
      }
    } else if (player.role === 'Amnesiac') {
      const target = room.players.get(targetId);
      if (!target || target.alive) return { error: 'Invalid target' };
      if (action !== 'inherit') return { error: 'Invalid action for Amnesiac' };

      const inheritResult = this.inheritDeadRole(room, playerId, targetId);
      if (inheritResult.error) return inheritResult;

      const passiveRoles = new Set(['Villager', 'Jester', 'Executioner', 'Amnesiac']);
      if (passiveRoles.has(inheritResult.player.role)) {
        room.nightActions[playerId] = { action: 'skip', targetId: null };
      } else {
        delete room.nightActions[playerId];
      }

      return { success: true, room, player: this.getPlayerData(code, playerId), transformed: true };
    } else if (player.role === 'Veteran') {
      if (action !== 'instinct') return { error: 'Invalid action for Veteran' };
      if ((player.veteranUsesRemaining ?? 4) <= 0) return { error: 'You have no Instinct uses remaining' };
    } else if (player.role === 'Assassin') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (action !== 'kill') return { error: 'Invalid action for Assassin' };
      if (target.faction === 'Assassin') return { error: 'Cannot kill teammates' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
    } else {
      return { error: 'You have no night abilities' };
    }

    room.nightActions[playerId] = { action, targetId: action === 'instinct' ? null : targetId };

    return { success: true, room };
  }

  skipNightAction(code, playerId) {
    const room = this.rooms.get(code);
    if (!room || room.state !== 'night') return { error: 'Not in night phase' };
    if (room.roleRevealEndsAt && Date.now() < room.roleRevealEndsAt) {
      return { error: 'Night actions unlock after the role reveal.' };
    }

    const player = room.players.get(playerId);
    if (!player || !player.alive) return { error: 'Invalid player' };

    room.nightActions[playerId] = { action: 'skip', targetId: null };
    return { success: true, room };
  }

  checkAllNightActionsSubmitted(code) {
    const room = this.rooms.get(code);
    if (!room) return false;

    for (const [id, player] of room.players) {
      if (!player.alive) continue;
      if (player.role === 'Villager') continue;
      if (player.role === 'Jester') continue;
      if (player.role === 'Executioner') continue;
      if (player.role === 'Amnesiac') {
        const hasDeadTargets = Array.from(room.players.values()).some((candidate) => !candidate.alive && candidate.id !== id);
        if (!hasDeadTargets) continue;
      }
      if (player.role === 'Veteran' && (player.veteranUsesRemaining ?? 4) <= 0) continue;
      if (player.role === 'Mirror Caster' && (player.mirrorUsesRemaining ?? 4) <= 0) continue;
      if (!room.nightActions[id]) return false;
    }
    return true;
  }

  resolveNight(code) {
    const room = this.rooms.get(code);
    if (!room) return null;

    const messages = [];
    const killed = new Set();
    const protected_ = new Set();
    const searchResults = {};
    const privateMessages = {};
    const killersThisNight = new Set();
    const recentKillers = new Set((room.recentKillers || []).flat());
    const veteranAlertIds = new Set();
    const mirroredTargets = new Map();

    // Track who the medic protected this night
    let medicTargetThisNight = null;
    const nextMirrorTargets = {};

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      if (!player) continue;
      if (action.action === 'instinct' && player.role === 'Veteran') {
        veteranAlertIds.add(playerId);
        player.veteranUsesRemaining = Math.max(0, (player.veteranUsesRemaining ?? 4) - 1);
      }
      if (action.action === 'protect' && action.targetId) {
        protected_.add(action.targetId);
        medicTargetThisNight = action.targetId;
      }
      if (action.action === 'mirror' && action.targetId && player.role === 'Mirror Caster') {
        mirroredTargets.set(action.targetId, playerId);
        nextMirrorTargets[playerId] = action.targetId;
        player.mirrorUsesRemaining = Math.max(0, (player.mirrorUsesRemaining ?? 4) - 1);
      }
    }

    // Update lastMedicTarget for next night
    if (medicTargetThisNight !== null) {
      room.lastMedicTarget = medicTargetThisNight;
    } else {
      // If medic skipped, clear the restriction so they can protect anyone next night
      room.lastMedicTarget = null;
    }
    room.lastMirrorTargets = nextMirrorTargets;

    const nightSummaryLines = this.getNightActionSummaryLines(code);
    nightSummaryLines.forEach((line) => this.appendToPhaseSummary(code, line));

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      if (!player) continue;

      if (action.action === 'kill' && player.role === 'Assassin' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
        } else if (mirroredTargets.has(action.targetId)) {
          killed.add(playerId);
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A mirrored shield reflected a killing blow away from you.', 'Mirror Caster')
          );
        } else if (!protected_.has(action.targetId)) {
          killed.add(action.targetId);
          killersThisNight.add(playerId);
        } else {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [
              this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.', 'Vitalist')
            ];
          }
        }
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      if (!player || player.role !== 'Sheriff') continue;

      if (action.action === 'shoot' && action.targetId) {
        const target = room.players.get(action.targetId);
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
        } else if (mirroredTargets.has(action.targetId)) {
          killed.add(playerId);
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [];
          }
          privateMessages[action.targetId].push(
            this.createPrivateSystemMessage(code, 'A mirrored shield reflected a killing blow away from you.', 'Mirror Caster')
          );
        } else if (target && target.faction === 'Crew') {
          killed.add(playerId);
        } else if (!protected_.has(action.targetId)) {
          killed.add(action.targetId);
          killersThisNight.add(playerId);
        } else {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [
              this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.', 'Vitalist')
            ];
          }
        }
      } else if (action.action === 'search' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
          continue;
        }
        const target = room.players.get(action.targetId);
        searchResults[playerId] = {
          targetId: action.targetId,
          targetName: target.name,
          role: target.role,
          faction: target.faction
        };
        if (!privateMessages[playerId]) privateMessages[playerId] = [];
        privateMessages[playerId].push(
          this.createPrivateSystemMessage(code, `Your investigation found that ${target.name} is the ${target.role}.`, 'Sheriff')
        );
      }
    }

    const nextInvestigatorTargets = {};
    const killHistoryForInvestigators = new Set([...recentKillers, ...killersThisNight]);
    const nextTrackerTargets = {};
    const nextStalkerTargets = {};
    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      if (!player || player.role !== 'Investigator') continue;

      const previousTargets = room.lastInvestigatorTargets[playerId] || [];
      if (action.action === 'examine' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
          nextInvestigatorTargets[playerId] = [...previousTargets.slice(-1), action.targetId];
          continue;
        }
        const target = room.players.get(action.targetId);
        const hasKilledRecently = killHistoryForInvestigators.has(action.targetId);
        searchResults[playerId] = {
          targetId: action.targetId,
          targetName: target.name,
          resultType: 'kill-check',
          hasKilledRecently,
          roundsChecked: 2,
        };
        if (!privateMessages[playerId]) privateMessages[playerId] = [];
        privateMessages[playerId].push(
          this.createPrivateSystemMessage(
            code,
            hasKilledRecently
              ? `${target.name} has killed someone in the last 2 rounds.`
              : `${target.name} has not killed anyone in the last 2 rounds.`,
            'Investigator'
          )
        );
        nextInvestigatorTargets[playerId] = [...previousTargets.slice(-1), action.targetId];
      } else {
        nextInvestigatorTargets[playerId] = [];
      }
    }
    room.lastInvestigatorTargets = nextInvestigatorTargets;

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      if (!player || player.role !== 'Tracker') continue;

      if (action.action === 'track' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
          nextTrackerTargets[playerId] = action.targetId;
          continue;
        }
        const trackedPlayer = room.players.get(action.targetId);
        const trackedAction = room.nightActions[action.targetId];
        const interactedTarget = trackedAction?.targetId
          ? room.players.get(trackedAction.targetId)
          : null;
        const interactedWithPlayer = trackedAction?.action && trackedAction.action !== 'skip' && interactedTarget;

        searchResults[playerId] = {
          targetId: action.targetId,
          targetName: trackedPlayer?.name || 'Unknown',
          resultType: 'track',
          interactedWithId: interactedWithPlayer ? interactedTarget.id : null,
          interactedWithName: interactedWithPlayer ? interactedTarget.name : null,
        };

        if (!privateMessages[playerId]) privateMessages[playerId] = [];
        privateMessages[playerId].push(
          this.createPrivateSystemMessage(
            code,
            interactedWithPlayer
              ? `${trackedPlayer.name} interacted with ${interactedTarget.name} tonight.`
              : `${trackedPlayer.name} did not interact with anyone tonight.`,
            'Tracker'
          )
        );

        nextTrackerTargets[playerId] = action.targetId;
      } else {
        nextTrackerTargets[playerId] = null;
      }
    }
    room.lastTrackerTargets = nextTrackerTargets;

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      if (!player || player.role !== 'Stalker') continue;

      if (action.action === 'stalk' && action.targetId) {
        if (veteranAlertIds.has(action.targetId)) {
          killed.add(playerId);
          nextStalkerTargets[playerId] = action.targetId;
          continue;
        }
        const stalkedPlayer = room.players.get(action.targetId);
        const visitors = Object.entries(room.nightActions)
          .filter(([visitorId, visitorAction]) => (
            visitorId !== playerId
            && visitorAction?.action
            && visitorAction.action !== 'skip'
            && visitorAction.targetId === action.targetId
          ))
          .map(([visitorId]) => room.players.get(visitorId))
          .filter(Boolean);

        searchResults[playerId] = {
          targetId: action.targetId,
          targetName: stalkedPlayer?.name || 'Unknown',
          resultType: 'stalk',
          visitorIds: visitors.map((visitor) => visitor.id),
          visitorNames: visitors.map((visitor) => visitor.name),
        };

        if (!privateMessages[playerId]) privateMessages[playerId] = [];
        privateMessages[playerId].push(
          this.createPrivateSystemMessage(
            code,
            visitors.length
              ? `${stalkedPlayer.name} was interacted by ${visitors.map((visitor) => visitor.name).join(', ')} tonight.`
              : `${stalkedPlayer.name} was not interacted by anyone tonight.`,
            'Stalker'
          )
        );

        nextStalkerTargets[playerId] = action.targetId;
      } else {
        nextStalkerTargets[playerId] = null;
      }
    }
    room.lastStalkerTargets = nextStalkerTargets;

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      if (!player || player.role !== 'Vitalist') continue;
      if (action.action === 'protect' && action.targetId && veteranAlertIds.has(action.targetId)) {
        killed.add(playerId);
      }
    }

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      if (!player || player.role !== 'Mirror Caster') continue;
      if (action.action === 'mirror' && action.targetId && veteranAlertIds.has(action.targetId)) {
        killed.add(playerId);
      }
    }

    for (const deadId of killed) {
      const deadPlayer = room.players.get(deadId);
      if (deadPlayer) {
        deadPlayer.alive = false;
        const deathText = room.anonymousEjects
          ? `${deadPlayer.name} was found dead.`
          : `${deadPlayer.name} was found dead. They were a ${deadPlayer.role}.`;
        messages.push({
          type: 'death',
          text: deathText,
          playerId: deadId,
          role: deadPlayer.role,
          faction: deadPlayer.faction,
          public: true
        });
      }
    }

    for (const [, player] of room.players) {
      if (player.role !== 'Executioner') continue;
      if (player.executionerTargetId && killed.has(player.executionerTargetId)) {
        this.convertExecutionerToAmnesiac(room, player.id);
        if (player.alive) {
          if (!privateMessages[player.id]) privateMessages[player.id] = [];
          privateMessages[player.id].push(
            this.createPrivateSystemMessage(code, 'Your target has died. You have become the Amnesiac.', 'Executioner')
          );
        }
      }
    }

    if (killed.size === 0 && messages.length === 0) {
      messages.push({
        type: 'peaceful',
        text: 'The night passed peacefully. No one was harmed.',
        public: true
      });
    }

    room.morningMessages = messages;
    const alivePlayers = Array.from(room.players.values()).filter(p => p.alive).map(p => p.name);
    const morningLines = messages.filter((msg) => msg.public).map((msg) => msg.text);
    morningLines.push(`Alive players: ${alivePlayers.join(', ') || 'No one'}.`);
    room.state = 'morning';
    this.beginPhaseSummary(code, `Morning ${room.nightCount} begins.`, morningLines);
    room.searchResults = searchResults;
    room.recentKillers = [...(room.recentKillers || []), Array.from(killersThisNight)].slice(-2);
    room.nightActions = {};

    const winCheck = this.checkWinCondition(code);
    if (winCheck) {
      room.state = 'ended';
      room.winner = winCheck;
    }

    return { room, messages, searchResults, privateMessages, winner: room.winner };
  }

  submitVote(code, voterId, targetId) {
    const room = this.rooms.get(code);
    if (!room || room.state !== 'voting') return { error: 'Not in voting phase' };

    const voter = room.players.get(voterId);
    if (!voter || !voter.alive) return { error: 'Invalid voter' };

    if (targetId !== 'skip') {
      const target = room.players.get(targetId);
      if (!target || !target.alive) return { error: 'Invalid target' };
      if (targetId === voterId) return { error: 'Cannot vote for yourself' };
    }

    room.votes[voterId] = targetId;

    return { success: true, room };
  }

  updateRoomSettings(code, requesterId, settings) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };
    if (room.hostId !== requesterId) return { error: 'Only the host can change settings' };
    if (room.state !== 'lobby') return { error: 'Settings can only be changed in the lobby' };

    if (typeof settings.anonymousVotes === 'boolean') {
      room.anonymousVotes = settings.anonymousVotes;
    }
    if (typeof settings.anonymousEjects === 'boolean') {
      room.anonymousEjects = settings.anonymousEjects;
    }
    if (typeof settings.hiddenRoleList === 'boolean') {
      room.hiddenRoleList = settings.hiddenRoleList;
    }

    room.lastAction = Date.now();
    return { success: true, room };
  }

  checkAllVotesSubmitted(code) {
    const room = this.rooms.get(code);
    if (!room) return false;

    for (const [id, player] of room.players) {
      if (!player.alive) continue;
      if (!room.votes[id]) return false;
    }
    return true;
  }

  resolveVotes(code) {
    const room = this.rooms.get(code);
    if (!room) return null;

    const voteCounts = {};
    let skipVotes = 0;

    for (const [, targetId] of Object.entries(room.votes)) {
      if (targetId === 'skip') {
        skipVotes++;
      } else {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
      }
    }

    let maxVotes = 0;
    let eliminated = null;
    let isTie = false;

    for (const [playerId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminated = playerId;
        isTie = false;
      } else if (count === maxVotes) {
        isTie = true;
      }
    }

    if (skipVotes >= maxVotes) {
      eliminated = null;
      isTie = false;
    }

    let message;
    if (isTie) {
      message = {
        type: 'tie',
        text: 'The vote resulted in a tie. No one was eliminated.',
        public: true
      };
      eliminated = null;
    } else if (!eliminated) {
      message = {
        type: 'skip',
        text: 'The town decided to skip the vote. No one was eliminated.',
        public: true
      };
    } else {
      const player = room.players.get(eliminated);
      player.alive = false;
      const eliminationText = room.anonymousEjects
        ? `${player.name} was eliminated by vote.`
        : `${player.name} was eliminated by vote. They were a ${player.role}.`;
      message = {
        type: 'eliminated',
        text: eliminationText,
        playerId: eliminated,
        role: player.role,
        faction: player.faction,
        public: true
      };

      const executionerWinner = Array.from(room.players.values()).find((candidate) => (
        candidate.role === 'Executioner'
        && candidate.executionerTargetId === eliminated
      ));

      if (executionerWinner) {
        room.eliminatedToday = eliminated;
        room.votes = {};
        this.appendToPhaseSummary(code, message.text);
        room.state = 'ended';
        room.winner = {
          winner: 'Executioner',
          reason: `${executionerWinner.name} got their target voted out. Everyone else loses.`,
        };

        return {
          room,
          message,
          voteCounts,
          eliminated,
          winner: room.winner
        };
      }

      if (player.role === 'Jester') {
        room.eliminatedToday = eliminated;
        room.votes = {};
        this.appendToPhaseSummary(code, message.text);
        room.state = 'ended';
        room.winner = {
          winner: 'Jester',
          reason: 'Jester tricked the town into voting them out. Everyone else loses.',
        };

        return {
          room,
          message,
          voteCounts,
          eliminated,
          winner: room.winner
        };
      }
    }

    room.eliminatedToday = eliminated;
    room.votes = {};
    this.appendToPhaseSummary(code, message.text);

    const winCheck = this.checkWinCondition(code);
    if (winCheck) {
      room.state = 'ended';
      room.winner = winCheck;
    } else {
      room.state = 'night';
      room.nightCount++;
      room.nightActions = {};
      this.beginPhaseSummary(code, `Night ${room.nightCount} begins. Chat is locked until morning.`);
    }

    return {
      room,
      message,
      voteCounts,
      eliminated,
      winner: room.winner
    };
  }

  startVoting(code) {
    const room = this.rooms.get(code);
    if (!room) return null;
    room.state = 'voting';
    room.votes = {};
    this.beginPhaseSummary(code, 'Voting has started.');
    return room;
  }

  checkWinCondition(code) {
    const room = this.rooms.get(code);
    if (!room) return null;

    let aliveCrewCount = 0;
    let aliveAssassinCount = 0;
    let aliveNeutralEvilCount = 0;

    for (const [, player] of room.players) {
      if (!player.alive) continue;
      if (player.faction === 'Crew') aliveCrewCount++;
      else if (player.faction === 'Assassin') aliveAssassinCount++;
      else if (player.faction === 'Neutral' && this.roleCatalog?.Neutral?.Evil?.includes(player.role)) aliveNeutralEvilCount++;
    }

    if (aliveAssassinCount === 0) {
      return { winner: 'Crew', reason: 'All Assassins have been eliminated!' };
    }

    // Neutral Evil roles like Jester should be able to keep the game alive at parity,
    // so the table still has a chance to vote them out instead of ending immediately.
    if (aliveAssassinCount > 0 && aliveCrewCount > 0 && aliveNeutralEvilCount > 0) {
      return null;
    }

    if (aliveAssassinCount >= aliveCrewCount) {
      return { winner: 'Assassin', reason: 'Assassins have taken control!' };
    }

    return null;
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  getRoomPublicData(code) {
    const room = this.rooms.get(code);
    if (!room) return null;

    const players = [];
    for (const [id, player] of room.players) {
      players.push({
        id,
        name: player.name,
        avatarIndex: player.avatarIndex,
        colorHex: player.colorHex ?? null,
        alive: player.alive,
        connected: player.connected,
        isHost: id === room.hostId,
        role: player.role,
        faction: player.faction,
      });
    }

    return {
      code: room.code,
      hostId: room.hostId,
      players,
      state: room.state,
      winner: room.winner || null,
      nightCount: room.nightCount,
      roleRevealEndsAt: room.roleRevealEndsAt || 0,
      playerCount: room.players.size,
      aliveCount: players.filter(p => p.alive).length,
      chatMessages: room.chatMessages.slice(-150),
      anonymousVotes: room.anonymousVotes,
      anonymousEjects: room.anonymousEjects,
      hiddenRoleList: room.hiddenRoleList,
    };
  }

  addSystemChatMessage(code, text) {
    const room = this.rooms.get(code);
    if (!room || !text) return null;

    const message = this.createChatMessage('system', 'SYSTEM', text, null, room.state);

    room.chatMessages.push(message);
    if (room.chatMessages.length > 150) room.chatMessages = room.chatMessages.slice(-150);
    room.lastAction = Date.now();
    return message;
  }

  getNightActionSummaryLine(code, action) {
    const room = this.rooms.get(code);
    if (!room || !action) return null;

    if (room.hiddenRoleList) {
      if (action === 'skip') return null;
      return 'A player used their ability.';
    }

    if (action === 'shoot') return 'Sheriff has used their gun.';
    if (action === 'search') return 'Sheriff is investigating someone.';
    if (action === 'examine') return 'Investigator is examining someone.';
    if (action === 'track') return 'Tracker is following someone.';
    if (action === 'stalk') return 'Stalker is shadowing someone.';
    if (action === 'protect') return 'Vitalist has protected someone.';
    if (action === 'mirror') return 'Mirror Caster has woven a reflective shield.';
    if (action === 'instinct') return 'Veteran is standing watch.';
    if (action === 'kill') return 'An Assassin has moved through the shadows.';
    return null;
  }

  getNightActionSummaryLines(code) {
    const room = this.rooms.get(code);
    if (!room) return [];

    const lines = [];
    const seen = new Set();

    for (const { action } of Object.values(room.nightActions)) {
      const line = this.getNightActionSummaryLine(code, action);
      if (!line || seen.has(line)) continue;
      seen.add(line);
      lines.push(line);
    }

    const currentSummary = room.chatMessages.find((entry) => entry.id === room.currentPhaseSummaryId);
    const existingLines = new Set(currentSummary?.summaryLines || []);
    return lines.filter((line) => !existingLines.has(line));
  }

  beginPhaseSummary(code, title, lines = []) {
    const room = this.rooms.get(code);
    if (!room || !title) return null;

    const message = this.createChatMessage(
      'system',
      'SYSTEM',
      this.formatPhaseSummary(title, lines),
      null,
      room.state
    );

    message.summaryTitle = title;
    message.summaryLines = [...lines];
    room.chatMessages.push(message);
    room.currentPhaseSummaryId = message.id;
    if (room.chatMessages.length > 150) room.chatMessages = room.chatMessages.slice(-150);
    room.lastAction = Date.now();
    return message;
  }

  appendToPhaseSummary(code, line) {
    const room = this.rooms.get(code);
    if (!room || !line) return null;

    const message = room.chatMessages.find((entry) => entry.id === room.currentPhaseSummaryId);
    if (!message) {
      return this.beginPhaseSummary(code, line);
    }

    message.summaryTitle = message.summaryTitle || message.text;
    message.summaryLines = [...(message.summaryLines || []), line];
    message.text = this.formatPhaseSummary(message.summaryTitle, message.summaryLines);
    message.createdAt = Date.now();
    room.lastAction = Date.now();
    return message;
  }

  formatPhaseSummary(title, lines = []) {
    const cleanTitle = String(title || '').trim();
    const cleanLines = lines
      .map((line) => String(line || '').trim())
      .filter(Boolean);

    if (!cleanLines.length) return cleanTitle;
    return `${cleanTitle}\n\n${cleanLines.map((line) => `- ${line}`).join('\n')}`;
  }

  createPrivateSystemMessage(code, text, senderName = 'SYSTEM') {
    const room = this.rooms.get(code);
    if (!room || !text) return null;
    return {
      ...this.createChatMessage('system', senderName, text, null, room.state),
      private: true,
    };
  }

  createChatMessage(type, senderName, text, senderId = null, phase = null) {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      senderId,
      senderName,
      text,
      createdAt: Date.now(),
      phase,
    };
  }

  addChatMessage(code, playerId, text) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };
    if (room.state !== 'morning' && room.state !== 'voting') {
      return { error: 'Chat is only available during morning and voting' };
    }

    const player = room.players.get(playerId);
    if (!player) return { error: 'Player not found' };

    const cleanText = String(text || '').trim().replace(/\s+/g, ' ');
    if (!cleanText) return { error: 'Message cannot be empty' };
    if (cleanText.length > 280) return { error: 'Message is too long' };

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'player',
      senderId: playerId,
      senderName: player.name,
      text: cleanText,
      createdAt: Date.now(),
      phase: room.state,
    };

    room.chatMessages.push(message);
    if (room.chatMessages.length > 150) room.chatMessages = room.chatMessages.slice(-150);
    room.lastAction = Date.now();

    return { success: true, message };
  }

  getPlayerData(code, playerId) {
    const room = this.rooms.get(code);
    if (!room) return null;

    const player = room.players.get(playerId);
    if (!player) return null;

    let teammates = [];
    if (player.faction === 'Assassin' && room.state !== 'lobby') {
      for (const [id, p] of room.players) {
        if (id !== playerId && p.faction === 'Assassin') {
          teammates.push({ id, name: p.name, alive: p.alive });
        }
      }
    }

    return {
      ...player,
      teammates,
      hasSubmittedAction: !!room.nightActions[playerId],
      hasVoted: !!room.votes[playerId],
      executionerTargetId: player.role === 'Executioner' ? (player.executionerTargetId || null) : null,
      executionerTargetName: player.role === 'Executioner' && player.executionerTargetId
        ? (room.players.get(player.executionerTargetId)?.name || null)
        : null,
      lastMedicTarget: player.role === 'Vitalist' ? room.lastMedicTarget : null,
      lastMirrorTarget: player.role === 'Mirror Caster' ? (room.lastMirrorTargets[playerId] || null) : null,
      lastInvestigatorTargets: player.role === 'Investigator' ? (room.lastInvestigatorTargets[playerId] || []) : [],
      lastTrackerTarget: player.role === 'Tracker' ? (room.lastTrackerTargets[playerId] || null) : null,
      lastStalkerTarget: player.role === 'Stalker' ? (room.lastStalkerTargets[playerId] || null) : null,
      veteranUsesRemaining: player.role === 'Veteran' ? (player.veteranUsesRemaining ?? 4) : null,
      mirrorUsesRemaining: player.role === 'Mirror Caster' ? (player.mirrorUsesRemaining ?? 4) : null,
    };
  }

  getAlivePlayers(code) {
    const room = this.rooms.get(code);
    if (!room) return [];

    const players = [];
    for (const [id, player] of room.players) {
      if (player.alive) {
        players.push({ id, name: player.name });
      }
    }
    return players;
  }

  getAllPlayersWithRoles(code) {
    const room = this.rooms.get(code);
    if (!room) return [];

    const players = [];
    for (const [id, player] of room.players) {
      players.push({
        id,
        name: player.name,
        colorHex: player.colorHex ?? null,
        role: player.role,
        faction: player.faction,
        alive: player.alive
      });
    }
    return players;
  }

  cleanupOldRooms() {
    const now = Date.now();
    const timeout = 30 * 60 * 1000;
    for (const [code, room] of this.rooms) {
      if (now - room.lastAction > timeout) {
        this.rooms.delete(code);
      }
    }
  }
}

module.exports = GameLogic;

class GameLogic {
  constructor() {
    this.rooms = new Map();
    this.avatarCount = 29;
  }

  normalizePlayerName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 16);
  }

  sanitizeAvatarIndex(avatarIndex) {
    return Number.isInteger(avatarIndex) && avatarIndex >= 0
      ? avatarIndex % this.avatarCount
      : this.assignAvatarIndex({ players: new Map() });
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

  createRoom(hostId, hostName, avatarIndex = null) {
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
      lastInvestigatorTargets: {},
      recentKillers: [],
      roleRevealEndsAt: 0,
    };

    const normalizedHostName = this.normalizePlayerName(hostName);
    if (normalizedHostName.length < 2) return { error: 'Name must be at least 2 characters' };

    room.players.set(hostId, {
      id: hostId,
      name: normalizedHostName,
      avatarIndex: Number.isInteger(avatarIndex) ? this.sanitizeAvatarIndex(avatarIndex) : this.assignAvatarIndex(room),
      role: null,
      faction: null,
      alive: true,
      connected: true
    });

    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code, playerId, playerName, avatarIndex = null) {
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
      role: null,
      faction: null,
      alive: true,
      connected: true
    });

    return { room };
  }

  reconnectPlayer(code, playerId, playerName = null, avatarIndex = null) {
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

    let index = 0;

    if (count === 5) {
      const assassin = room.players.get(shuffled[index]);
      assassin.role = 'Assassin';
      assassin.faction = 'Assassin';
      index++;

      const sheriff = room.players.get(shuffled[index]);
      sheriff.role = 'Sheriff';
      sheriff.faction = 'Crew';
      index++;

      const vitalist = room.players.get(shuffled[index]);
      vitalist.role = 'Vitalist';
      vitalist.faction = 'Crew';
      index++;

      const crewInfo = room.players.get(shuffled[index]);
      crewInfo.role = this.pickRandomRole(['Villager', 'Investigator']);
      crewInfo.faction = 'Crew';
      index++;

      const jester = room.players.get(shuffled[index]);
      jester.role = 'Jester';
      jester.faction = 'Neutral';

      room.playerOrder = shuffled;
      return room;
    }

    for (let i = 0; i < assassinCount; i++) {
      const player = room.players.get(shuffled[index]);
      player.role = 'Assassin';
      player.faction = 'Assassin';
      index++;
    }

    const sheriff = room.players.get(shuffled[index]);
    sheriff.role = 'Sheriff';
    sheriff.faction = 'Crew';
    index++;

    const medic = room.players.get(shuffled[index]);
    medic.role = 'Vitalist';
    medic.faction = 'Crew';
    index++;

    while (index < shuffled.length) {
      const player = room.players.get(shuffled[index]);
      player.role = 'Villager';
      player.faction = 'Crew';
      index++;
    }

    room.playerOrder = shuffled;
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
    room.lastInvestigatorTargets = {};
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

    const target = room.players.get(targetId);
    if (!target || !target.alive) return { error: 'Invalid target' };

    if (player.role === 'Sheriff') {
      if (action !== 'shoot' && action !== 'search') return { error: 'Invalid action for Sheriff' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
    } else if (player.role === 'Investigator') {
      if (action !== 'examine') return { error: 'Invalid action for Investigator' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
      const recentTargets = room.lastInvestigatorTargets[playerId] || [];
      if (recentTargets.length >= 2 && recentTargets[recentTargets.length - 1] === targetId && recentTargets[recentTargets.length - 2] === targetId) {
        return { error: 'You cannot target the same player 3 times in a row' };
      }
    } else if (player.role === 'Vitalist') {
      if (action !== 'protect') return { error: 'Invalid action for Vitalist' };
      // Cannot protect the same player twice in a row
      if (targetId === room.lastMedicTarget) {
        return { error: 'You cannot protect the same player two nights in a row' };
      }
    } else if (player.role === 'Assassin') {
      if (action !== 'kill') return { error: 'Invalid action for Assassin' };
      if (target.faction === 'Assassin') return { error: 'Cannot kill teammates' };
      if (targetId === playerId) return { error: 'Cannot target yourself' };
    } else {
      return { error: 'You have no night abilities' };
    }

    room.nightActions[playerId] = { action, targetId };

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

    // Track who the medic protected this night
    let medicTargetThisNight = null;

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      if (!player) continue;
      if (action.action === 'protect' && action.targetId) {
        protected_.add(action.targetId);
        medicTargetThisNight = action.targetId;
      }
    }

    // Update lastMedicTarget for next night
    if (medicTargetThisNight !== null) {
      room.lastMedicTarget = medicTargetThisNight;
    } else {
      // If medic skipped, clear the restriction so they can protect anyone next night
      room.lastMedicTarget = null;
    }

    const nightSummaryLines = this.getNightActionSummaryLines(code);
    nightSummaryLines.forEach((line) => this.appendToPhaseSummary(code, line));

    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      if (!player) continue;

      if (action.action === 'kill' && player.role === 'Assassin' && action.targetId) {
        if (!protected_.has(action.targetId)) {
          killed.add(action.targetId);
          killersThisNight.add(playerId);
        } else {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [
              this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.')
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
        if (target && target.faction === 'Crew') {
          killed.add(playerId);
        } else if (!protected_.has(action.targetId)) {
          killed.add(action.targetId);
          killersThisNight.add(playerId);
        } else {
          if (!privateMessages[action.targetId]) {
            privateMessages[action.targetId] = [
              this.createPrivateSystemMessage(code, 'You were protected by the Vitalist during the night.')
            ];
          }
        }
      } else if (action.action === 'search' && action.targetId) {
        const target = room.players.get(action.targetId);
        searchResults[playerId] = {
          targetId: action.targetId,
          targetName: target.name,
          role: target.role,
          faction: target.faction
        };
        if (!privateMessages[playerId]) privateMessages[playerId] = [];
        privateMessages[playerId].push(
          this.createPrivateSystemMessage(code, `Your investigation found that ${target.name} is the ${target.role}.`)
        );
      }
    }

    const nextInvestigatorTargets = {};
    const killHistoryForInvestigators = new Set([...recentKillers, ...killersThisNight]);
    for (const [playerId, action] of Object.entries(room.nightActions)) {
      const player = room.players.get(playerId);
      if (!player || player.role !== 'Investigator') continue;

      const previousTargets = room.lastInvestigatorTargets[playerId] || [];
      if (action.action === 'examine' && action.targetId) {
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
              : `${target.name} has not killed anyone in the last 2 rounds.`
          )
        );
        nextInvestigatorTargets[playerId] = [...previousTargets.slice(-1), action.targetId];
      } else {
        nextInvestigatorTargets[playerId] = [];
      }
    }
    room.lastInvestigatorTargets = nextInvestigatorTargets;

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

    for (const [, player] of room.players) {
      if (!player.alive) continue;
      if (player.faction === 'Crew') aliveCrewCount++;
      else if (player.faction === 'Assassin') aliveAssassinCount++;
    }

    if (aliveAssassinCount === 0) {
      return { winner: 'Crew', reason: 'All Assassins have been eliminated!' };
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
    if (action === 'protect') return 'Vitalist has protected someone.';
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

  createPrivateSystemMessage(code, text) {
    const room = this.rooms.get(code);
    if (!room || !text) return null;
    return {
      ...this.createChatMessage('system', 'SYSTEM', text, null, room.state),
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
      lastMedicTarget: player.role === 'Vitalist' ? room.lastMedicTarget : null,
      lastInvestigatorTargets: player.role === 'Investigator' ? (room.lastInvestigatorTargets[playerId] || []) : [],
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

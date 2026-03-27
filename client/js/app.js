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
    selectedNameColorHex: '#F5F7FF',
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
    roomSettingsFullscreenOpen: false,
    forceExpandedNightChat: false,
    roleRevealActive: false,
    roleRevealEndsAt: 0,
    roleRevealTimeout: null,
    toastTimeout: null,
    connectionToastVisible: false,
    currentRolesFaction: 'Crew',
    profilePaletteView: 'avatars',
    pendingRoleInheritance: null,
    pendingLifeTransition: null,
    chatDraft: '',
    chatOverlayDraft: '',
    assassinChatDraft: '',
    assassinChatOverlayDraft: '',
    jailChatDraft: '',
    jailChatOverlayDraft: '',
    abyssChatDraft: '',
    abyssChatOverlayDraft: '',
    aceOfBladesRollAnimation: null,
    selectedTargets: [],
    assassinChatMessages: [],
    jailChatMessages: [],
    abyssChatMessages: [],
    currentChatChannel: 'public',
    oracleVotingTab: 'ability',
    selectedVotingAbilityTargets: [],
    selectedVotingAbilityAction: null,
  };

  const MAX_ROOM_PLAYERS = 15;
  const PROFILE_STORAGE_KEY = 'silhouette.profile';
  const PLAYER_SESSION_STORAGE_KEY = 'silhouette.playerSessionId';
  const ROLE_REVEAL_ITEM_HEIGHT = 72;
  const AVATAR_ASSET_VERSION = '20260327a';
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
    Veteran: {
      faction: 'Crew',
      subfaction: 'Killing',
      description: 'Become unkillable for the night and kill anyone who interacts with you. Can be used 4 times.',
      revealText: 'Muted metal steadies your pulse. Stand watch and punish anyone who comes too close.',
      abilities: [
        {
          name: 'Instinct',
          type: 'Night',
          description: 'Become unkillable for the night and kill anyone who interacts with you. Can be used 4 times.',
        },
      ],
    },
    Karma: {
      faction: 'Crew',
      subfaction: 'Unbound',
      description: 'Whoever kills you dies with you.',
      revealText: 'Dark crimson payback follows your last breath. Anyone who ends you falls beside you.',
      abilities: [
        {
          name: 'Payback',
          type: 'Passive',
          description: 'Whoever kills you dies with you.',
        },
      ],
    },
    'Mirror Caster': {
      faction: 'Crew',
      subfaction: 'Protection',
      description: 'Shield a player to reflect killing damage back to the attacker. Can target yourself. Cannot target the same player twice in a row. Can be used 4 times.',
      revealText: 'Silver-blue glass ripples in your hands. Bend lethal force back where it came from.',
      abilities: [
        {
          name: 'Mirror',
          type: 'Night',
          description: 'Shield a player to prevent them from dying by reflecting the damage back to the killer. Can target yourself. Cannot target the same player twice in a row. Can be used 4 times.',
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
    Warden: {
      faction: 'Crew',
      subfaction: 'Protection',
      description: 'Protect a player from being interacted with at night. Cannot target the same player twice in a row.',
      revealText: 'Blue, teal, and gold barriers lock into place around your target. Keep every hand away from them until dawn.',
      abilities: [
        {
          name: 'Guard',
          type: 'Night',
          description: 'Protect a player from being interacted with at night. Cannot target the same player twice in a row.',
        },
      ],
    },
    Inquisitor: {
      faction: 'Crew',
      subfaction: 'Unbound',
      description: 'Exile a player before a voting phase ends, making other player\'s votes completely useless.',
      revealText: 'Teal judgement coils in the air. End the vote on your terms and drag one player out before the crowd decides.',
      abilities: [
        {
          name: 'Exile',
          type: 'Voting',
          description: 'Exile a player before a voting phase ends, making other player\'s votes completely useless.',
        },
      ],
    },
    Alturist: {
      faction: 'Crew',
      subfaction: 'Unbound',
      description: 'Bring a dead player to life while sacrificing your own for the greater good.',
      revealText: 'Red, gold, and white conviction burn together. Trade your own life to return a fallen ally to the board.',
      abilities: [
        {
          name: 'Sacrifice',
          type: 'Night',
          description: 'Bring a dead player to life while sacrificing your own for the greater good.',
        },
      ],
    },
    Mayor: {
      faction: 'Crew',
      subfaction: 'Unbound',
      hiddenFromReveal: false,
      description: 'Skipped votes during voting are stored to be used later.',
      revealText: 'Deep purple influence settles over the chamber. Pass on a vote now and return later with more weight in your hand.',
      abilities: [
        {
          name: 'Corruption',
          type: 'Voting',
          description: 'Skipped votes during voting are stored to be used later.',
        },
      ],
    },
    Medium: {
      faction: 'Crew',
      subfaction: 'Unbound',
      hiddenFromGuide: false,
      hiddenFromReveal: false,
      description: 'Allows you to talk to the dead by switching dimensions. Can be used 3 times.',
      revealText: 'Lavender and magenta drift across the veil. Slip into the Abyss and speak with the dead before dawn closes it again.',
      abilities: [
        {
          name: 'Mediate',
          type: 'Night',
          description: 'Allows you to talk to the dead by switching dimensions. Can be used 3 times.',
        },
      ],
    },
    'The Vessel': {
      faction: 'Crew',
      subfaction: 'Unbound',
      description: 'Become a killer if you get killed by one.',
      revealText: 'Purple and gold hold something unfinished inside you. The first killing blow only wakes what was already waiting.',
      abilities: [
        {
          name: 'Penumbra',
          type: 'Passive',
          description: 'Become a killer if you get killed by one.',
        },
        {
          name: 'Kill',
          type: 'Night',
          description: 'Eliminate a player.',
        },
      ],
    },
    Narcissist: {
      faction: 'Crew',
      subfaction: 'Unbound',
      description: 'Decieve the Crew members and make sure they lose.',
      revealText: 'Royal violet vanity curls around your silhouette. Stay alive and watch the crew collapse without you.',
      abilities: [
        {
          name: 'Self-Interest',
          type: 'Passive',
          description: 'Decieve the Crew members and make sure they lose.',
        },
      ],
    },
    Oracle: {
      faction: 'Crew',
      subfaction: 'Protection',
      description: 'Mark a player so their killer must confess if they die tonight. Purify a player to stop them from being voted out.',
      revealText: 'Neon pink omen-light surrounds your hands. Mark a doomed soul at night and spare one from exile by day.',
      abilities: [
        {
          name: 'Evil Eye',
          type: 'Night',
          description: 'Select a player. If the chosen player dies that night, the killer must confess the murder. Can be used 3 times.',
        },
        {
          name: 'Purify',
          type: 'Voting',
          description: 'Protect a player from getting voted out. Can be used 2 times.',
        },
      ],
    },
    Lawyer: {
      faction: 'Crew',
      subfaction: 'Protection',
      description: 'Protect a player from getting voted out and turn skipped votes into vote reduction later.',
      revealText: 'Metallic gold authority settles over the chamber. Spare one player from exile, then cash in your skipped votes to weaken another case later.',
      abilities: [
        {
          name: 'Objection',
          type: 'Voting',
          description: 'Protect a player from getting voted out. Can be used 2 times.',
        },
        {
          name: 'Hearsay',
          type: 'Voting',
          description: 'Skipped votes during voting are stored to be used as vote reduction later.',
        },
      ],
    },
    Officer: {
      faction: 'Crew',
      subfaction: 'Killing',
      hiddenFromReveal: false,
      description: 'Detain a player, then release or execute them the following night. If you execute the wrong player, you become an Amnesiac.',
      revealText: 'A blue verdict hangs in the air. Lock one player away, hear them out in private, and decide their fate when night returns.',
      abilities: [
        {
          name: 'Detain',
          type: 'Night',
          description: 'Detain a player. The Jailee is unable to do anything until you set them free the next night.',
        },
        {
          name: 'Verdict',
          type: 'Night',
          description: 'Release the Jailee or Execute them. If they happen to be a Crew member or a Neutral Benign, you become an Amnesiac.',
        },
      ],
    },
    Teleporter: {
      faction: 'Crew',
      subfaction: 'Chaos',
      description: 'Choose 2 players to switch places during the night.',
      revealText: 'Cold cyan light tears the room sideways. Swap two positions and let every night action hit the wrong place.',
      abilities: [
        {
          name: 'Teleport',
          type: 'Night',
          description: 'Choose 2 players to switch places during the night.',
        },
      ],
    },
    Swapper: {
      faction: 'Crew',
      subfaction: 'Chaos',
      description: 'Choose 2 players to swap places during a voting phase.',
      revealText: 'Prismatic light folds across the table. Switch two seats before the vote lands and let the wrong fate fall in the wrong place.',
      abilities: [
        {
          name: 'Swap',
          type: 'Voting',
          description: 'Choose 2 players to swap places during a voting phase.',
        },
      ],
    },
    Magician: {
      faction: 'Crew',
      subfaction: 'Chaos',
      description: 'Make a player disappear, making them completely immune to everything but their abilities are also blocked. Cannot target the same player twice in a row.',
      revealText: 'Indigo sleight bends the room out of shape. Spoof a target into the void and let every hand miss them until dawn.',
      abilities: [
        {
          name: 'Abracadabra',
          type: 'Night',
          description: 'Make a player disappear, making them completely immune to everything but their abilities are also blocked. Cannot target the same player twice in a row.',
        },
      ],
    },
    Investigator: {
      faction: 'Crew',
      subfaction: 'Info',
      description: 'Investigate a player to learn if they have killed someone in the last 2 rounds. Cannot target the same player 3 times in a row.',
      revealText: 'Violet intuition hums around you. Read the blood trail hidden in the dark.',
      abilities: [
        {
          name: 'Examine',
          type: 'Night',
          description: 'Investigate a player to learn if they have killed someone in the last 2 rounds. Cannot target the same player 3 times in a row.',
        },
      ],
    },
    Tracker: {
      faction: 'Crew',
      subfaction: 'Info',
      description: 'Track a player to learn who they interacted with at night. Cannot target the same player twice in a row.',
      revealText: 'An icy blue trail sharpens your senses. Follow movement through the dark.',
      abilities: [
        {
          name: 'Track',
          type: 'Night',
          description: 'Track a player to learn who they interacted with at night. Cannot target the same player twice in a row.',
        },
      ],
    },
    Stalker: {
      faction: 'Crew',
      subfaction: 'Info',
      description: 'Stalk a player to learn who interacted with them at night. Cannot target the same player twice in a row.',
      revealText: 'A deep forest hush follows your steps. Watch who slips into another player’s shadow.',
      abilities: [
        {
          name: 'Stalk',
          type: 'Night',
          description: 'Stalk a player to learn who interacted with them at night. Cannot target the same player twice in a row.',
        },
      ],
    },
    Traplord: {
      faction: 'Crew',
      subfaction: 'Info',
      description: 'Choose at least 3 players to learn their roles. The order is random.',
      revealText: 'A violet snare glimmers in the dark. Set a wide trap and read what it catches.',
      abilities: [
        {
          name: 'Trap',
          type: 'Night',
          description: 'Choose at least 3 players to learn their roles. The order is random.',
        },
      ],
    },
    Redflag: {
      faction: 'Crew',
      subfaction: 'Info',
      description: 'Whoever kills you must confess the murder in the morning.',
      revealText: 'Bright red warning burns through the dark. If they silence you forever, their name will surface at dawn.',
      abilities: [
        {
          name: 'Confession',
          type: 'Passive',
          description: 'Whoever kills you must confess the murder in the morning.',
        },
      ],
    },
    Scientist: {
      faction: 'Crew',
      subfaction: 'Chaos',
      description: 'Choose 2 players to switch roles permanently during a voting session. Can only be used once. Cannot target yourself.',
      revealText: 'Teal and violet formulas hum behind the glass. Rewrite two destinies after the town is done voting.',
      abilities: [
        {
          name: 'Experiment',
          type: 'Voting',
          description: 'Choose 2 players to switch roles permanently during a voting session. Can only be used once. Cannot target yourself.',
        },
      ],
    },
    Silencer: {
      faction: 'Crew',
      subfaction: 'Chaos',
      description: 'Disable a player\'s abilities and prevent them from talking until the next night. Cannot target the same player twice in a row.',
      revealText: 'A hard crimson hush closes around your target. Mute their voice and snuff out their night action.',
      abilities: [
        {
          name: 'Quietus',
          type: 'Night',
          description: 'Disable a player\'s abilities and prevent them from talking until the next night. Cannot target the same player twice in a row.',
        },
      ],
    },
    Villager: {
      faction: 'Crew',
      subfaction: 'Info',
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
    Psychopath: {
      faction: 'Assassin',
      subfaction: 'Power',
      hiddenFromGuide: false,
      hiddenFromReveal: false,
      description: 'Skipped kills during night can be stacked and used later. Maximum 3 kills at once.',
      revealText: 'Blood-red hunger coils around the blade. Hold back now, then unleash a bloodbath when the night is right.',
      abilities: [
        {
          name: 'Bloodbath',
          type: 'Night',
          description: 'Skipped kills during night can be stacked and used later. Maximum 3 kills at once.',
        },
      ],
    },
    Devastator: {
      faction: 'Assassin',
      subfaction: 'Power',
      description: 'Strap a player with dynamites that explodes and kills whoever interacts with them that night along with the victim, or eliminate a player.',
      revealText: 'Orange heat bleeds into red ruin. Strap the room with buried dynamite, then wait for one careless touch to blow the night open.',
      abilities: [
        {
          name: 'Demolish',
          type: 'Night',
          description: 'Strap a player with dynamites that explodes and kills whoever interacts with them that night along with the victim.',
        },
        {
          name: 'Kill',
          type: 'Night',
          description: 'Eliminate a player.',
        },
      ],
    },
    'Ace of Blades': {
      faction: 'Assassin',
      subfaction: 'Power',
      description: 'Roll 3Fold to decide how many players you can kill this round.',
      revealText: 'Crimson and gold chance sharpens into steel. Trust the spin, then carve through as many names as fate allows.',
      abilities: [
        {
          name: '3Fold',
          type: 'Night',
          description: 'Roll a dice, the number you get is the amount of players you can kill this round. 1 kill has a 60% chance, 2 kills have a 30% chance, and 3 kills have a 10% chance.',
        },
      ],
    },
    Traitor: {
      faction: 'Assassin',
      subfaction: 'Special',
      hiddenFromReveal: true,
      description: 'They trusted you and that\'s on them. Eliminate the Crew.',
      revealText: 'Blue loyalty tears open into red betrayal. You were Crew once. Now the knife points the other way.',
      abilities: [
        {
          name: 'Overthrow',
          type: 'Passive',
          description: 'If there are no Assassins left while the game has at least 6 players, a random Crew member becomes an Assassin.',
        },
        {
          name: 'Kill',
          type: 'Night',
          description: 'Eliminate a player.',
        },
      ],
    },
    Sniper: {
      faction: 'Assassin',
      subfaction: 'Power',
      description: 'Shoot a player from a great distance. The bullet hits them 2 rounds later, making you harder to track.',
      revealText: 'Dark red focus narrows into a single line. Fire now and let the kill arrive long after the trigger pull.',
      abilities: [
        {
          name: 'Longshot',
          type: 'Night',
          description: 'Shoot a player from a great distance. The bullet hits them 2 rounds later making you harder to track.',
        },
      ],
    },
    Tetherhex: {
      faction: 'Assassin',
      subfaction: 'Power',
      description: 'Link with a player each round. If you get killed, they also die with you. Can be used with Kill. Cannot target the same player 3 times in a row.',
      revealText: 'Neon green chains hum in the dark. Bind another life to yours, then strike before the tether snaps.',
      abilities: [
        {
          name: 'Interlinked',
          type: 'Night',
          description: 'Link with a player each round. If you get killed, they also die with you. Can be used with Kill. Cannot target the same player 3 times in a row.',
        },
        {
          name: 'Kill',
          type: 'Night',
          description: 'Eliminate a player.',
        },
      ],
    },
    Hypnotic: {
      faction: 'Assassin',
      subfaction: 'Concealing',
      description: 'Disable a player\'s abilities for the night, or eliminate a player. Cannot target the same player twice in a row with Trance.',
      revealText: 'Pink-magenta haze settles over the room. Veil a target in trance or strike when the time is right.',
      abilities: [
        {
          name: 'Trance',
          type: 'Night',
          description: 'Disable a player\'s abilities for the night. Cannot target the same player twice in a row.',
        },
        {
          name: 'Kill',
          type: 'Night',
          description: 'Eliminate a player.',
        },
      ],
    },
    Blackout: {
      faction: 'Assassin',
      subfaction: 'Concealing',
      description: 'Blind every information role for the night, or eliminate a player.',
      revealText: 'Dark metal swallows the room. Blind every watcher, then strike through the silence.',
      abilities: [
        {
          name: 'Flash',
          type: 'Night',
          description: 'Make information roles useless by blinding everyone. Cannot be used twice in a row. Can be used 3 times.',
        },
        {
          name: 'Kill',
          type: 'Night',
          description: 'Eliminate a player.',
        },
      ],
    },
    Blackmailer: {
      faction: 'Assassin',
      subfaction: 'Concealing',
      description: 'Threaten a player to disable their ability to talk and vote until the next night, or eliminate a player.',
      revealText: 'A gilded threat settles over the table. Silence a target, then decide if the blade follows.',
      abilities: [
        {
          name: 'Blackmail',
          type: 'Night',
          description: 'Threaten a player to disable their ability to talk and vote until the next night.',
        },
        {
          name: 'Kill',
          type: 'Night',
          description: 'Eliminate a player.',
        },
      ],
    },
    Disruptor: {
      faction: 'Assassin',
      subfaction: 'Support',
      description: 'Revoke a voting session before it ends, or eliminate a player. Veto can be used once.',
      revealText: 'Black-red pressure coils around the table. Cancel the vote the moment it turns against you, then cut someone down by night.',
      abilities: [
        {
          name: 'Veto',
          type: 'Voting',
          description: 'Revoke a voting session during voting. Can be used once.',
        },
        {
          name: 'Kill',
          type: 'Night',
          description: 'Eliminate a player.',
        },
      ],
    },
    Manipulator: {
      faction: 'Assassin',
      subfaction: 'Support',
      description: 'Double every assassin vote during a voting phase with Surprise, or eliminate a player. Surprise can be used 2 times.',
      revealText: 'Red fades into violet as you bend the count. Tip the vote when everyone else thinks the outcome is settled.',
      abilities: [
        {
          name: 'Surprise',
          type: 'Voting',
          description: 'Count each assassin vote as double during that voting phase. Can be used 2 times.',
        },
        {
          name: 'Kill',
          type: 'Night',
          description: 'Eliminate a player.',
        },
      ],
    },
    Prophet: {
      faction: 'Assassin',
      subfaction: 'Support',
      description: 'Choose a player to learn their role with Gospel. Can be used 2 times, or eliminate a player.',
      revealText: 'A deep red omen curls through the smoke. Read a soul twice, then decide when the knife speaks instead.',
      abilities: [
        {
          name: 'Gospel',
          type: 'Night',
          description: 'Choose a player to learn their role. Can be used 2 times.',
        },
        {
          name: 'Kill',
          type: 'Night',
          description: 'Eliminate a player.',
        },
      ],
    },
    'The Purge': {
      faction: 'Assassin',
      subfaction: 'Concealing',
      description: 'Seize the night so only assassins can use abilities, or eliminate a player. Fascism can be used once.',
      revealText: 'Black-red rule crushes the room into silence. Seize the whole night for the assassins, then decide who vanishes with it.',
      abilities: [
        {
          name: 'Fascism',
          type: 'Night',
          description: 'Disable every player\'s ability except Assassins for the night. Can be used once.',
        },
        {
          name: 'Kill',
          type: 'Night',
          description: 'Eliminate a player.',
        },
      ],
    },
    Overload: {
      faction: 'Neutral',
      subfaction: 'Killing',
      description: 'Hack players to disable their abilities, or eliminate a player.',
      revealText: 'Toxic green code floods your vision. Infect a target with malware, then shut the system down.',
      abilities: [
        {
          name: 'Malware',
          type: 'Night',
          description: 'Hack a player to disable their abilities for the night.',
        },
        {
          name: 'Shutdown',
          type: 'Night',
          description: 'Eliminate a player.',
        },
      ],
    },
    Arsonist: {
      faction: 'Neutral',
      subfaction: 'Killing',
      description: 'Douse 1 player in gasoline each night, then ignite everyone you have tagged at once.',
      revealText: 'Orange heat rolls into a blood-red blaze. Mark the room with gasoline, then burn every doused soul at the same time.',
      abilities: [
        {
          name: 'Douse',
          type: 'Night',
          description: 'Douse 1 player with gasoline each night. Already doused players cannot be targeted again.',
        },
        {
          name: 'Ignite',
          type: 'Night',
          description: 'Kill every currently doused player at the same time. Requires at least 1 player to be doused.',
        },
      ],
    },
    Wither: {
      faction: 'Neutral',
      subfaction: 'Killing',
      description: 'Infect a player at night. The players they interact with also become infected. If all other living players become infected, you transform into Pestilence.',
      revealText: 'Dark crimson rot gathers around your hands. Start the infection quietly, then let every contact carry it further.',
      abilities: [
        {
          name: 'Plague',
          type: 'Night',
          description: 'Infect a player. Infected players silently spread the infection through their interactions and cannot be infected again. If all players become infected, you become the Pestilence.',
        },
      ],
    },
    Pestilence: {
      faction: 'Neutral',
      subfaction: 'Killing',
      hiddenFromReveal: true,
      description: 'You cannot be killed and can only lose by being voted or exiled out. Eliminate players until you are the last one standing.',
      revealText: 'Dark violet ruin crowns you in silence. No blade can finish what the plague has already made eternal.',
      abilities: [
        {
          name: 'Immortal',
          type: 'Passive',
          description: 'You cannot be killed only voted out.',
        },
        {
          name: 'Kill',
          type: 'Night',
          description: 'Eliminate a player.',
        },
      ],
    },
    Dracula: {
      faction: 'Neutral',
      subfaction: 'Killing',
      hiddenFromReveal: false,
      description: 'Transform or kill players by biting them. Build a bloodline and outlive everyone else with your Vampire.',
      revealText: 'Deep blood-red hunger crawls across a black horizon. Sire one loyal vampire, then drain the rest of the town dry together.',
      abilities: [
        {
          name: 'Sire',
          type: 'Night',
          description: 'Bite a player to convert them into a Vampire. If the bitten player was a Crew member they will turn into a Vampire (unless there is already a Vampire alive) Else they will kill the bitten player.',
        },
      ],
    },
    Vampire: {
      faction: 'Neutral',
      subfaction: 'Killing',
      hiddenFromGuide: false,
      hiddenFromReveal: true,
      description: 'Bite a player to kill them.',
      revealText: 'Deep red hunger stains the dark. Feed beside Dracula until your bloodline is all that remains.',
      abilities: [
        {
          name: 'Bite',
          type: 'Night',
          description: 'Bite a player to kill them.',
        },
      ],
    },
    Jester: {
      faction: 'Neutral',
      subfaction: 'Evil',
      description: 'Act like an Assassin to get voted out. Try to avoid dying.',
      revealText: 'A pale-pink grin hides your chaos. Fool the table into ending you.',
      abilities: [
        {
          name: 'Trickster',
          type: 'Passive',
          description: 'Act like an Assassin to get voted out. Try to avoid dying.',
        },
      ],
    },
    Executioner: {
      faction: 'Neutral',
      subfaction: 'Evil',
      description: 'A random player becomes your target. Get them voted out. If your target dies, you become an Amnesiac.',
      revealText: 'Amber judgment burns in your hands. Guide the vote onto your marked target.',
      abilities: [
        {
          name: 'Verdict',
          type: 'Passive',
          description: 'A random player becomes your target. Get them voted out. If your target dies, you become an Amnesiac.',
        },
      ],
    },
    'Guardian Angel': {
      faction: 'Neutral',
      subfaction: 'Benign',
      description: 'Protect your target until the end to win with them.',
      revealText: 'Warm white gold gathers around you. Watch over your chosen soul and rise or fall with their fate.',
      abilities: [
        {
          name: 'Blessing',
          type: 'Night',
          description: 'Protect your target from getting killed that round. If your target dies, you become an Amnesiac. Can be used 4 times.',
        },
      ],
    },
    Survivalist: {
      faction: 'Neutral',
      subfaction: 'Benign',
      description: 'Protect yourself from getting killed. Can be used 4 times. Survive until the end of the game no matter who wins.',
      revealText: 'Warm gold-orange fire wraps around you. Endure the whole game and claim victory beside whoever remains.',
      abilities: [
        {
          name: 'Lifeguard',
          type: 'Night',
          description: 'Protect yourself from getting killed. Can be used 4 times.',
        },
      ],
    },
    Imitator: {
      faction: 'Neutral',
      subfaction: 'Benign',
      description: 'Steal the role of a different player each night. Cannot target the same player again until there is no one left. Survive until the end.',
      revealText: 'Soft white-red imitation flickers across your mask. Borrow a role for the night, then slip back into yourself by dawn.',
      abilities: [
        {
          name: 'Mimicry',
          type: 'Night',
          description: 'Steal the role of a different player each night. Cannot target the same player again until there is no one left.',
        },
      ],
    },
    Amnesiac: {
      faction: 'Neutral',
      subfaction: 'Benign',
      description: 'Steal the role of a dead player along with their win condition.',
      revealText: 'Bright cyan memory glows in the dark. Claim a fallen role and inherit its fate.',
      abilities: [
        {
          name: 'Inheritance',
          type: 'Night',
          description: 'Steal the role of a dead player along with their win condition.',
        },
      ],
    },
  };
  const ROLE_GUIDE_DEFINITIONS = ROLE_DEFINITIONS;
  const ROLE_GUIDE_SECTIONS = [
    { key: 'Crew', label: 'Crew', icon: 'Crew' },
    { key: 'Assassin', label: 'Assassin', icon: 'Assassin' },
    { key: 'Neutral', label: 'Neutral', icon: 'Neutral' },
  ];
  const ROLE_GUIDE_GROUP_ORDER = {
    Crew: ['Info', 'Protection', 'Killing', 'Chaos', 'Unbound', 'General'],
    Assassin: ['Power', 'Concealing', 'Support', 'General'],
    Neutral: ['Evil', 'Benign', 'Killing', 'General'],
  };
  const LOBBY_AVATAR_FILES = [
    'Avatar 1.png',
    'Avatar 11.png',
    'Avatar 12.png',
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
    'Avatar 26.png',
    'Avatar 3.png',
    'Avatar 5.png',
    'Avatar 6.png',
    'Avatar 7.png',
    'Avatar 8.png',
    'Avatar 9.png',
    'Avatar 10.png',
  ];
  const LOBBY_AVATAR_IMAGES = LOBBY_AVATAR_FILES.map((fileName) => `./assets/avatars/${encodeURIComponent(fileName)}?v=${AVATAR_ASSET_VERSION}`);
  const PLAYER_NAME_PALETTE = [
    { label: 'Ivory', value: '#F5F7FF' },
    { label: 'Rose', value: '#FF8FA3' },
    { label: 'Coral', value: '#FF9A6B' },
    { label: 'Amber', value: '#FFC857' },
    { label: 'Lime', value: '#D9F06B' },
    { label: 'Mint', value: '#7EF7C9' },
    { label: 'Teal', value: '#58E1D9' },
    { label: 'Sky', value: '#7ED7FF' },
    { label: 'Azure', value: '#6DA8FF' },
    { label: 'Indigo', value: '#8D8BFF' },
    { label: 'Violet', value: '#B78CFF' },
    { label: 'Magenta', value: '#E882FF' },
    { label: 'Blush', value: '#FF9AD5' },
    { label: 'Ruby', value: '#FF6B8A' },
    { label: 'Silver', value: '#D7DEE8' },
    { label: 'Stone', value: '#B8C0CC' },
  ];

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

  function sanitizePlayerColorHex(value, fallback = PLAYER_NAME_PALETTE[0].value) {
    const normalized = String(value || '').trim().toUpperCase();
    const match = PLAYER_NAME_PALETTE.find((entry) => entry.value.toUpperCase() === normalized);
    return match ? match.value : fallback;
  }

  function hexToHsl(hex) {
    const normalized = sanitizePlayerColorHex(hex);
    const value = normalized.slice(1);
    const red = Number.parseInt(value.slice(0, 2), 16) / 255;
    const green = Number.parseInt(value.slice(2, 4), 16) / 255;
    const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    const lightness = (max + min) / 2;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs((2 * lightness) - 1));

    let hue;
    if (delta === 0) hue = 0;
    else if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = ((blue - red) / delta) + 2;
    else hue = ((red - green) / delta) + 4;

    return {
      h: ((hue * 60) + 360) % 360,
      s: Math.round(saturation * 100),
      l: Math.round(lightness * 100),
    };
  }

  function buildPlayerColorStyle(colorHex) {
    const normalized = sanitizePlayerColorHex(colorHex);
    const hsl = hexToHsl(normalized);
    return `--chat-accent-color:${normalized};--chat-accent-h:${hsl.h};--chat-accent-s:${hsl.s}%;--chat-accent-l:${hsl.l}%;`;
  }

  function getDefaultProfile() {
    return {
      name: '',
      avatarIndex: Math.floor(Math.random() * LOBBY_AVATAR_IMAGES.length),
      colorHex: PLAYER_NAME_PALETTE[Math.floor(Math.random() * PLAYER_NAME_PALETTE.length)].value,
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
        colorHex: sanitizePlayerColorHex(parsed.colorHex || parsed.colorHue, fallback.colorHex),
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
      colorHex: sanitizePlayerColorHex(state.selectedNameColorHex, PLAYER_NAME_PALETTE[0].value),
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
    state.assassinChatMessages = response.assassinChatMessages || [];
    state.jailChatMessages = response.jailChatMessages || [];
    state.abyssChatMessages = response.abyssChatMessages || [];
    state.gamePhase = response.room?.state || null;
    state.hasActed = !!response.player?.hasSubmittedAction;
    state.hasVoted = !!response.player?.hasVoted;
    state.privateChatMessages = [];
    state.chatDraft = '';
    state.chatOverlayDraft = '';
    state.assassinChatDraft = '';
    state.assassinChatOverlayDraft = '';
    state.jailChatDraft = '';
    state.jailChatOverlayDraft = '';
    state.currentChatChannel = 'public';
    state.chatOverlayOpen = false;
    state.searchResult = null;
    state.selectedAction = null;
    state.selectedTarget = null;
    state.aceOfBladesRollAnimation = null;
    state.selectedTargets = [];
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
      colorHex: state.selectedNameColorHex,
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
          colorHex: state.selectedNameColorHex,
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
    const selectionLabel = document.getElementById('profile-selection-label');
    const paletteMode = document.getElementById('profile-palette-mode');
    const prevPaletteButton = document.getElementById('btn-profile-palette-prev');
    const nextPaletteButton = document.getElementById('btn-profile-palette-next');
    const compact = document.getElementById('profile-panel-compact');
    const body = document.getElementById('profile-panel-body');
    const compactName = document.getElementById('profile-compact-name');
    const editButton = document.getElementById('btn-edit-profile');
    const confirmButton = document.getElementById('btn-confirm-profile');
    if (!nameInput || !preview || !grid || !selectionLabel || !paletteMode || !prevPaletteButton || !nextPaletteButton || !compact || !body || !compactName || !editButton || !confirmButton) return;

    nameInput.value = state.username || '';
    nameInput.style.cssText = `${buildPlayerColorStyle(state.selectedNameColorHex)}color: var(--chat-accent-color);`;
    preview.innerHTML = renderAvatarMarkup('profile-preview', 'player-avatar', state.selectedAvatarIndex);
    compactName.textContent = state.username || 'Choose your profile';
    compactName.style.cssText = buildPlayerColorStyle(state.selectedNameColorHex);
    compact.style.display = state.profileConfirmed ? 'flex' : 'none';
    body.style.display = state.profileConfirmed ? 'none' : 'flex';
    selectionLabel.textContent = state.profilePaletteView === 'colors' ? 'Choose Name Color' : 'Choose Avatar';
    paletteMode.textContent = state.profilePaletteView === 'colors' ? 'Colors' : 'Avatars';
    grid.innerHTML = state.profilePaletteView === 'colors'
      ? PLAYER_NAME_PALETTE.map((entry) => `
        <button class="profile-color-option ${entry.value === sanitizePlayerColorHex(state.selectedNameColorHex) ? 'selected' : ''}" type="button" data-color-option="${entry.value}">
          <span class="profile-color-swatch" style="background:${entry.value};"></span>
          <span class="profile-color-name">${entry.label}</span>
        </button>
      `).join('')
      : LOBBY_AVATAR_IMAGES.map((_, index) => `
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

    grid.querySelectorAll('[data-color-option]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedNameColorHex = sanitizePlayerColorHex(button.dataset.colorOption, state.selectedNameColorHex);
        saveProfile();
        renderProfilePanel();
      });
    });

    const togglePaletteView = () => {
      state.profilePaletteView = state.profilePaletteView === 'avatars' ? 'colors' : 'avatars';
      renderProfilePanel();
    };
    prevPaletteButton.onclick = togglePaletteView;
    nextPaletteButton.onclick = togglePaletteView;

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
      colorHex: sanitizePlayerColorHex(state.selectedNameColorHex, PLAYER_NAME_PALETTE[0].value),
      code: roomCode,
    };
  }

  function getPlayerChatStyle(message, options = {}) {
    if (!message || message.type === 'system') return '';
    const { useSenderPalette = false } = options;
    const source = String(message.senderId || message.senderName || 'player');
    let hash = 5381;
    for (let index = 0; index < source.length; index++) {
      hash = ((hash << 5) + hash) ^ source.charCodeAt(index);
    }
    const normalizedHash = Math.abs(hash >>> 0);

    if (useSenderPalette) {
      return buildPlayerColorStyle(PLAYER_NAME_PALETTE[normalizedHash % PLAYER_NAME_PALETTE.length].value);
    }

    const explicitColor = message.colorHex ?? message.senderColorHex;
    if (explicitColor) {
      return buildPlayerColorStyle(explicitColor);
    }
    const playerFromRoom = state.roomData?.players?.find((candidate) => candidate.id === message.senderId);
    if (playerFromRoom?.colorHex) {
      return buildPlayerColorStyle(playerFromRoom.colorHex);
    }
    return buildPlayerColorStyle(PLAYER_NAME_PALETTE[normalizedHash % PLAYER_NAME_PALETTE.length].value);
  }

  function connectSocket() {
    state.socket = io(window.location.origin, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000,
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

    state.socket.on('game-started', ({ player, room, assassinChatMessages, jailChatMessages, abyssChatMessages, revealEndsAt, revealDurationMs }) => {
      state.playerData = player;
      state.roomData = room;
      state.chatMessages = room.chatMessages || [];
      state.assassinChatMessages = assassinChatMessages || [];
      state.jailChatMessages = jailChatMessages || [];
      state.abyssChatMessages = abyssChatMessages || [];
      state.hasActed = false;
      state.hasVoted = false;
      state.votesCast = 0;
      state.totalAlive = 0;
      state.searchResult = null;
      state.privateChatMessages = [];
      state.chatDraft = '';
      state.chatOverlayDraft = '';
      state.assassinChatDraft = '';
      state.assassinChatOverlayDraft = '';
      state.jailChatDraft = '';
      state.jailChatOverlayDraft = '';
      state.abyssChatDraft = '';
      state.abyssChatOverlayDraft = '';
      state.currentChatChannel = 'public';
      state.selectedAction = null;
      state.selectedTarget = null;
      state.aceOfBladesRollAnimation = null;
      state.selectedTargets = [];
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
      state.aceOfBladesRollAnimation = null;
      state.selectedTargets = [];
      state.selectedVotingAbilityTargets = [];
      state.oracleVotingTab = phase === 'voting' ? 'ability' : 'vote';
      if (state.currentChatChannel === 'abyss' && !canUseAbyssChat()) {
        state.currentChatChannel = 'public';
      } else if (state.currentChatChannel === 'jail' && !canUseJailChat()) {
        state.currentChatChannel = 'public';
      } else if (state.currentChatChannel === 'assassin' && !canUseAssassinChat()) {
        state.currentChatChannel = 'public';
      }
      if (messages) state.morningMessages = messages;
      if (phase === 'night') stopRoleReveal(true);
      else if (phase !== 'vote-result') stopRoleReveal(false);
      updatePhaseUI(phase, nightCount);
      renderGameContent(phase);
      updateAliveCount();
      renderGamePlayerList();
      renderChatBox();
    });

    state.socket.on('player-updated', ({ player, assassinChatMessages, jailChatMessages, abyssChatMessages }) => {
      const previousPlayer = state.playerData;
      queueAmnesiacInheritanceTransition(previousPlayer, player);
      queueTraitorTurnTransition(previousPlayer, player);
      queueVampireTurnTransition(previousPlayer, player);
      queuePestilenceTurnTransition(previousPlayer, player);
      queueLifeTransition(previousPlayer, player);
      state.playerData = player;
      if (Array.isArray(assassinChatMessages)) {
        state.assassinChatMessages = assassinChatMessages;
      }
      if (Array.isArray(jailChatMessages)) {
        state.jailChatMessages = jailChatMessages;
      }
      if (Array.isArray(abyssChatMessages)) {
        state.abyssChatMessages = abyssChatMessages;
      }
      if (state.currentChatChannel === 'abyss' && !player.abyssAvailable) {
        state.currentChatChannel = 'public';
      } else if (state.currentChatChannel === 'jail' && !player.isJailed && !player.officerJailedTargetId) {
        state.currentChatChannel = 'public';
      } else if (state.currentChatChannel === 'assassin' && (player.faction !== 'Assassin' || player.alive === false)) {
        state.currentChatChannel = 'public';
      }
      state.hasActed = player.hasSubmittedAction;
      state.hasVoted = player.hasVoted;
      if (state.currentScreen === 'game' && state.gamePhase) {
        updateRoleCard();
        renderGameContent(state.gamePhase);
        playPendingRoleInheritanceTransition();
        playPendingLifeTransition();
      }
      renderGamePlayerList();
      renderChatBox();
    });

    state.socket.on('chat-message', ({ message }) => {
      state.chatMessages.push(message);
      if (state.chatMessages.length > 150) state.chatMessages = state.chatMessages.slice(-150);
      renderChatBox();
    });

    state.socket.on('assassin-chat-message', ({ message }) => {
      state.assassinChatMessages.push(message);
      if (state.assassinChatMessages.length > 120) state.assassinChatMessages = state.assassinChatMessages.slice(-120);
      renderChatBox();
    });

    state.socket.on('jail-chat-message', ({ message }) => {
      state.jailChatMessages.push(message);
      if (state.jailChatMessages.length > 120) state.jailChatMessages = state.jailChatMessages.slice(-120);
      renderChatBox();
    });

    state.socket.on('abyss-chat-message', ({ message }) => {
      state.abyssChatMessages.push(message);
      if (state.abyssChatMessages.length > 120) state.abyssChatMessages = state.abyssChatMessages.slice(-120);
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
      if (message?.type === 'system') {
        state.currentChatChannel = 'public';
      }
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
      state.isHost = !!(room && state.playerId === room.hostId);
      state.playerData = null;
      state.hasActed = false;
      state.hasVoted = false;
      state.votesCast = 0;
      state.totalAlive = 0;
      state.searchResult = null;
      state.privateChatMessages = [];
      state.chatDraft = '';
      state.chatOverlayDraft = '';
      state.assassinChatDraft = '';
      state.assassinChatOverlayDraft = '';
      state.jailChatDraft = '';
      state.jailChatOverlayDraft = '';
      state.abyssChatDraft = '';
      state.abyssChatOverlayDraft = '';
      state.jailChatMessages = [];
      state.abyssChatMessages = [];
      state.selectedAction = null;
      state.selectedTarget = null;
      state.aceOfBladesRollAnimation = null;
      state.selectedTargets = [];
      state.morningMessages = [];
      state.chatMessages = room.chatMessages || [];
      state.assassinChatMessages = [];
      state.abyssChatMessages = [];
      state.chatDraft = '';
      state.chatOverlayDraft = '';
      state.assassinChatDraft = '';
      state.assassinChatOverlayDraft = '';
      state.gamePhase = null;
      state.chatOverlayOpen = false;
      state.currentChatChannel = 'public';
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
    setRoomSettingsFullscreen(false);
    const screen = document.getElementById(`screen-${screenId}`);
    if (screen) {
      screen.classList.add('active');
      state.currentScreen = screenId;
    }
  }

  function setRoomSettingsFullscreen(open) {
    state.roomSettingsFullscreenOpen = !!open;
    const panel = document.querySelector('.room-settings-panel');
    if (!panel) return;
    if (open) {
      panel.classList.add('is-fullscreen');
      panel.open = true;
      document.body.classList.add('room-settings-fullscreen-open');
    } else {
      panel.classList.remove('is-fullscreen');
      panel.open = false;
      document.body.classList.remove('room-settings-fullscreen-open');
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
    if (normalizedRole === 'veteran') return 'veteran';
    if (normalizedRole === 'karma') return 'karma';
    if (normalizedRole === 'mirror caster') return 'mirrorcaster';
    if (normalizedRole === 'vitalist') return 'vitalist';
    if (normalizedRole === 'warden') return 'warden';
    if (normalizedRole === 'oracle') return 'oracle';
    if (normalizedRole === 'lawyer') return 'lawyer';
    if (normalizedRole === 'medium') return 'medium';
    if (normalizedRole === 'officer') return 'officer';
    if (normalizedRole === 'inquisitor') return 'inquisitor';
    if (normalizedRole === 'disruptor') return 'disruptor';
    if (normalizedRole === 'manipulator') return 'manipulator';
    if (normalizedRole === 'mayor') return 'mayor';
    if (normalizedRole === 'prophet') return 'prophet';
    if (normalizedRole === 'wither') return 'wither';
    if (normalizedRole === 'pestilence' || normalizedRole === 'the pestilence') return 'pestilence';
    if (normalizedRole === 'dracula') return 'dracula';
    if (normalizedRole === 'vampire') return 'vampire';
    if (normalizedRole === 'alturist') return 'alturist';
    if (normalizedRole === 'the vessel') return 'vessel';
    if (normalizedRole === 'narcissist') return 'narcissist';
    if (normalizedRole === 'teleporter') return 'teleporter';
    if (normalizedRole === 'swapper') return 'swapper';
    if (normalizedRole === 'magician') return 'magician';
    if (normalizedRole === 'scientist') return 'scientist';
    if (normalizedRole === 'investigator') return 'investigator';
    if (normalizedRole === 'tracker') return 'tracker';
    if (normalizedRole === 'stalker') return 'stalker';
    if (normalizedRole === 'traplord') return 'traplord';
    if (normalizedRole === 'redflag') return 'redflag';
    if (normalizedRole === 'silencer') return 'silencer';
    if (normalizedRole === 'assassin') return 'assassin';
    if (normalizedRole === 'psychopath') return 'psychopath';
    if (normalizedRole === 'devastator') return 'devastator';
    if (normalizedRole === 'ace of blades') return 'aceofblades';
    if (normalizedRole === 'traitor') return 'traitor';
    if (normalizedRole === 'sniper') return 'sniper';
    if (normalizedRole === 'tetherhex') return 'tetherhex';
    if (normalizedRole === 'hypnotic') return 'hypnotic';
    if (normalizedRole === 'overload') return 'overload';
    if (normalizedRole === 'arsonist') return 'arsonist';
    if (normalizedRole === 'blackout') return 'blackout';
    if (normalizedRole === 'blackmailer') return 'blackmailer';
    if (normalizedRole === 'the purge') return 'thepurge';
    if (normalizedRole === 'villager') return 'villager';
    if (normalizedRole === 'jester') return 'jester';
    if (normalizedRole === 'executioner') return 'executioner';
    if (normalizedRole === 'guardian angel') return 'guardianangel';
    if (normalizedRole === 'survivalist') return 'survivalist';
    if (normalizedRole === 'amnesiac') return 'amnesiac';
    return String(fallbackFaction || 'Crew').trim().toLowerCase();
  }

  function getRoleBadgeClass(role, faction) {
    return `role-theme-${getRoleThemeClass(role, faction)}`;
  }

  function getRoleGuideDefinition(role) {
    return ROLE_GUIDE_DEFINITIONS[role] || getRoleDefinition(role);
  }

  function getWinnerPresentation(winnerName) {
    const normalizedWinner = String(winnerName || '').trim();
    if (normalizedWinner === 'Crew') {
      return {
        label: 'Crew Wins',
        glowClass: 'crew-win',
        textClass: 'crew-text',
      };
    }
    if (normalizedWinner === 'Assassin') {
      return {
        label: 'Assassins Win',
        glowClass: 'assassin-win',
        textClass: 'assassin-text',
      };
    }
    if (normalizedWinner === 'Nobody') {
      return {
        label: 'Nobody Wins',
        glowClass: 'nobody-win',
        textClass: 'nobody-text',
      };
    }
    if (normalizedWinner === 'Bloodlust') {
      return {
        label: 'Bloodlust Victory',
        glowClass: 'bloodlust-win',
        textClass: 'bloodlust-text',
        isSoloWin: true,
      };
    }

    const roleInfo = getRoleGuideDefinition(normalizedWinner);
    const themeClass = getRoleThemeClass(normalizedWinner, roleInfo?.faction || 'Neutral');
    return {
      label: `${normalizedWinner} Wins`,
      glowClass: `${themeClass}-win`,
      textClass: `${themeClass}-text`,
      isSoloWin: true,
    };
  }

  function getWinnerThemeStyles(winnerName) {
    const normalizedWinner = String(winnerName || '').trim();
    if (!normalizedWinner) return null;

    if (normalizedWinner === 'Crew') {
      return {
        glowBackground: 'var(--crew)',
        titleColor: 'var(--crew)',
        titleShadow: '0 0 30px var(--crew-glow)',
      };
    }
    if (normalizedWinner === 'Assassin') {
      return {
        glowBackground: 'var(--assassin)',
        titleColor: 'var(--assassin)',
        titleShadow: '0 0 30px var(--assassin-glow)',
      };
    }
    if (normalizedWinner === 'Nobody') {
      return {
        glowBackground: 'rgba(190, 202, 220, 0.46)',
        titleColor: 'hsl(214, 24%, 84%)',
        titleShadow: '0 0 28px rgba(190, 202, 220, 0.22)',
      };
    }
    if (normalizedWinner === 'Bloodlust') {
      return {
        glowBackground: 'linear-gradient(135deg, rgba(120, 0, 8, 0.96), rgba(18, 2, 4, 0.92))',
        titleColor: 'hsl(356, 94%, 72%)',
        titleShadow: '0 0 34px rgba(154, 12, 24, 0.34)',
      };
    }

    const themeClass = getRoleThemeClass(normalizedWinner, getRoleGuideDefinition(normalizedWinner)?.faction || 'Neutral');
    const themeStyles = {
      sheriff: { glowBackground: 'hsl(42, 100%, 62%)', titleColor: 'hsl(42, 100%, 76%)', titleShadow: '0 0 30px rgba(227, 178, 51, 0.26)' },
      veteran: { glowBackground: 'hsl(58, 28%, 62%)', titleColor: 'hsl(58, 34%, 76%)', titleShadow: '0 0 30px rgba(188, 192, 139, 0.24)' },
      karma: { glowBackground: 'hsl(356, 54%, 42%)', titleColor: 'hsl(356, 54%, 62%)', titleShadow: '0 0 30px rgba(123, 18, 34, 0.26)' },
      mirrorcaster: { glowBackground: 'var(--mirrorcaster)', titleColor: 'var(--mirrorcaster)', titleShadow: '0 0 30px rgba(132, 205, 255, 0.24)' },
      vitalist: { glowBackground: 'var(--vitalist)', titleColor: 'var(--vitalist)', titleShadow: '0 0 30px rgba(67, 239, 128, 0.24)' },
      warden: { glowBackground: 'var(--warden)', titleColor: 'var(--warden)', titleShadow: '0 0 30px rgba(92, 228, 226, 0.24)' },
      oracle: { glowBackground: 'hsl(324, 100%, 62%)', titleColor: 'hsl(324, 100%, 76%)', titleShadow: '0 0 30px rgba(255, 82, 190, 0.24)' },
      officer: { glowBackground: 'linear-gradient(135deg, hsl(203, 100%, 72%), hsl(218, 72%, 48%))', titleColor: 'hsl(203, 100%, 82%)', titleShadow: '0 0 30px rgba(84, 170, 255, 0.24)' },
      inquisitor: { glowBackground: 'hsl(176, 94%, 58%)', titleColor: 'hsl(176, 94%, 74%)', titleShadow: '0 0 30px rgba(84, 255, 236, 0.24)' },
      disruptor: { glowBackground: 'hsl(357, 86%, 58%)', titleColor: 'hsl(357, 92%, 70%)', titleShadow: '0 0 30px rgba(222, 58, 66, 0.24)' },
      manipulator: { glowBackground: 'var(--manipulator)', titleColor: 'hsl(286, 100%, 84%)', titleShadow: '0 0 30px rgba(180, 74, 255, 0.26)' },
      mayor: { glowBackground: 'var(--mayor)', titleColor: 'hsl(278, 100%, 86%)', titleShadow: '0 0 30px rgba(126, 74, 214, 0.26)' },
      prophet: { glowBackground: 'var(--prophet)', titleColor: 'var(--prophet)', titleShadow: '0 0 30px rgba(168, 42, 48, 0.28)' },
      traitor: { glowBackground: 'linear-gradient(90deg, hsl(222, 92%, 58%), hsl(10, 94%, 54%))', titleColor: 'hsl(0, 100%, 88%)', titleShadow: '0 0 30px rgba(138, 58, 66, 0.28)' },
      narcissist: { glowBackground: 'hsl(270, 82%, 58%)', titleColor: 'hsl(270, 90%, 78%)', titleShadow: '0 0 30px rgba(124, 58, 237, 0.24)' },
      teleporter: { glowBackground: 'var(--teleporter)', titleColor: 'var(--teleporter)', titleShadow: '0 0 30px rgba(126, 184, 255, 0.24)' },
      swapper: { glowBackground: 'hsl(286, 100%, 68%)', titleColor: 'hsl(48, 100%, 84%)', titleShadow: '0 0 30px rgba(176, 104, 255, 0.26)' },
      magician: { glowBackground: 'var(--magician)', titleColor: 'var(--magician)', titleShadow: '0 0 30px rgba(124, 112, 255, 0.24)' },
      scientist: { glowBackground: 'var(--scientist)', titleColor: 'var(--scientist)', titleShadow: '0 0 30px rgba(84, 232, 214, 0.24)' },
      investigator: { glowBackground: 'hsl(267, 86%, 68%)', titleColor: 'hsl(267, 100%, 86%)', titleShadow: '0 0 30px rgba(185, 132, 255, 0.24)' },
      tracker: { glowBackground: 'hsl(195, 100%, 68%)', titleColor: 'hsl(195, 100%, 78%)', titleShadow: '0 0 30px rgba(122, 226, 255, 0.24)' },
      stalker: { glowBackground: 'var(--stalker)', titleColor: 'var(--stalker)', titleShadow: '0 0 30px rgba(84, 182, 129, 0.24)' },
      traplord: { glowBackground: 'var(--traplord)', titleColor: 'var(--traplord)', titleShadow: '0 0 30px rgba(212, 92, 202, 0.24)' },
      redflag: { glowBackground: 'var(--redflag)', titleColor: 'var(--redflag)', titleShadow: '0 0 30px rgba(255, 76, 76, 0.24)' },
      silencer: { glowBackground: 'var(--silencer)', titleColor: 'var(--silencer)', titleShadow: '0 0 30px rgba(214, 64, 64, 0.24)' },
      villager: { glowBackground: 'hsl(204, 20%, 62%)', titleColor: 'hsl(204, 20%, 82%)', titleShadow: '0 0 26px rgba(191, 206, 215, 0.18)' },
      jester: { glowBackground: 'var(--jester)', titleColor: 'var(--jester)', titleShadow: '0 0 30px var(--jester-glow)' },
      executioner: { glowBackground: 'var(--executioner)', titleColor: 'var(--executioner)', titleShadow: '0 0 30px rgba(255, 190, 82, 0.24)' },
      guardianangel: { glowBackground: 'var(--guardianangel)', titleColor: 'var(--guardianangel)', titleShadow: '0 0 30px rgba(246, 226, 177, 0.24)' },
      survivalist: { glowBackground: 'var(--survivalist)', titleColor: 'var(--survivalist)', titleShadow: '0 0 30px rgba(236, 154, 62, 0.24)' },
      amnesiac: { glowBackground: 'var(--amnesiac)', titleColor: 'var(--amnesiac)', titleShadow: '0 0 26px rgba(171, 183, 206, 0.2)' },
      assassin: { glowBackground: 'var(--assassin)', titleColor: 'var(--assassin)', titleShadow: '0 0 30px var(--assassin-glow)' },
      aceofblades: { glowBackground: 'linear-gradient(135deg, rgba(255, 204, 92, 0.96), rgba(198, 22, 44, 0.92))', titleColor: 'hsl(42, 100%, 84%)', titleShadow: '0 0 30px rgba(228, 132, 74, 0.28)' },
      sniper: { glowBackground: 'var(--sniper)', titleColor: 'var(--sniper)', titleShadow: '0 0 30px rgba(141, 46, 46, 0.24)' },
      tetherhex: { glowBackground: 'var(--tetherhex)', titleColor: 'var(--tetherhex)', titleShadow: '0 0 30px rgba(74, 255, 119, 0.24)' },
      hypnotic: { glowBackground: 'var(--hypnotic)', titleColor: 'var(--hypnotic)', titleShadow: '0 0 30px rgba(196, 65, 148, 0.24)' },
      disruptor: { glowBackground: 'var(--disruptor)', titleColor: 'var(--disruptor)', titleShadow: '0 0 30px rgba(214, 56, 64, 0.24)' },
      overload: { glowBackground: 'var(--overload)', titleColor: 'var(--overload)', titleShadow: '0 0 30px rgba(99, 255, 76, 0.24)' },
      arsonist: { glowBackground: 'var(--arsonist)', titleColor: 'var(--arsonist)', titleShadow: '0 0 30px rgba(255, 114, 52, 0.28)' },
      wither: { glowBackground: 'var(--wither)', titleColor: 'var(--wither)', titleShadow: '0 0 30px rgba(162, 24, 38, 0.3)' },
      dracula: { glowBackground: 'linear-gradient(135deg, rgba(148, 10, 24, 0.96), rgba(16, 4, 6, 0.92))', titleColor: 'hsl(356, 100%, 78%)', titleShadow: '0 0 32px rgba(154, 16, 28, 0.34)' },
      vampire: { glowBackground: 'linear-gradient(135deg, rgba(112, 8, 18, 0.96), rgba(12, 2, 4, 0.92))', titleColor: 'hsl(356, 100%, 76%)', titleShadow: '0 0 30px rgba(132, 12, 22, 0.32)' },
      pestilence: { glowBackground: 'var(--pestilence)', titleColor: 'var(--pestilence)', titleShadow: '0 0 30px rgba(122, 62, 214, 0.34)' },
      blackout: { glowBackground: 'var(--blackout)', titleColor: 'var(--blackout)', titleShadow: '0 0 28px rgba(112, 120, 136, 0.22)' },
      blackmailer: { glowBackground: 'var(--blackmailer)', titleColor: 'var(--blackmailer)', titleShadow: '0 0 30px rgba(226, 180, 76, 0.24)' },
      thepurge: { glowBackground: 'var(--thepurge)', titleColor: 'var(--thepurge)', titleShadow: '0 0 30px rgba(148, 24, 24, 0.24)' },
    };

    return themeStyles[themeClass] || null;
  }

  function getGameoverWinnerThemeClass(winningSide, player) {
    if (!player) return '';
    if (winningSide === 'Crew' && player.faction === 'Crew') return 'winner-crew';
    if (winningSide === 'Assassin' && player.faction === 'Assassin') return 'winner-assassin';
    if (winningSide === 'Nobody') return '';
    if (winningSide === 'Bloodlust' && (player.role === 'Dracula' || player.role === 'Vampire')) return 'winner-dracula';
    if (winningSide === player.role) return `winner-${getRoleThemeClass(player.role, player.faction)}`;
    return '';
  }

  function getRoleDefinition(role) {
    return ROLE_DEFINITIONS[role] || {
      faction: 'Crew',
      description: '',
      revealText: '',
      abilities: [],
    };
  }

  function getActiveNightRole(player) {
    if (!player) return null;
    return player.imitatorCopiedRole || player.role || null;
  }

  function canUseNightPublicChat(player) {
    return getActiveNightRole(player) === 'Inquisitor';
  }

  function getDisplayedRoleTheme(player) {
    const activeRole = getActiveNightRole(player);
    if (!player || !activeRole) return '';
    const roleInfo = getRoleDefinition(activeRole);
    return getRoleBadgeClass(activeRole, roleInfo.faction);
  }

  function getInGameRoleDescription(roleInfo) {
    const description = String(roleInfo?.description || '');
    if (roleInfo?.faction !== 'Assassin') return description;
    return description.replace(/\s*Can be used with Kill\.\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  function getRolesForFaction(faction) {
    return Object.entries(ROLE_GUIDE_DEFINITIONS)
      .filter(([, roleInfo]) => roleInfo.faction === faction && !roleInfo.hiddenFromGuide)
      .map(([role, roleInfo]) => ({ role, ...roleInfo }));
  }

  function formatRoleGuideAbilityDescription(description) {
    const safeDescription = escapeHtml(description || '');
    return safeDescription
      .replace(
        'Cannot target the same player 3 times in a row.',
        '<span class="roles-guide-ability-highlight">Cannot target the same player 3 times in a row.</span>'
      )
      .replace(
        'Cannot target the same player in a row.',
        '<span class="roles-guide-ability-highlight">Cannot target the same player in a row.</span>'
      )
      .replace(
        'Cannot target the same player twice in a row.',
        '<span class="roles-guide-ability-highlight">Cannot target the same player twice in a row.</span>'
      )
      .replace(
        'Cannot target the same player again until there is no one left.',
        '<span class="roles-guide-ability-highlight">Cannot target the same player again until there is no one left.</span>'
      )
      .replace(
        'Can target yourself.',
        '<span class="roles-guide-ability-highlight">Can target yourself.</span>'
      )
      .replace(
        'Cannot protect the same player twice in a row.',
        '<span class="roles-guide-ability-highlight">Cannot protect the same player twice in a row.</span>'
      )
      .replace(
        'Can be used 4 times.',
        '<span class="roles-guide-ability-highlight">Can be used 4 times.</span>'
      )
      .replace(
        'Can be used 3 times.',
        '<span class="roles-guide-ability-highlight">Can be used 3 times.</span>'
      )
      .replace(
        'Can be used 2 times.',
        '<span class="roles-guide-ability-highlight">Can be used 2 times.</span>'
      )
      .replace(
        'cannot be targeted again.',
        '<span class="roles-guide-ability-highlight">cannot be targeted again.</span>'
      )
      .replace(
        'Requires at least 1 player to be doused.',
        '<span class="roles-guide-ability-highlight">Requires at least 1 player to be doused.</span>'
      )
      .replace(
        'cannot be infected again.',
        '<span class="roles-guide-ability-highlight">cannot be infected again.</span>'
      )
      .replace(
        'you become the Pestilence.',
        '<span class="roles-guide-ability-highlight">you become the Pestilence.</span>'
      )
      .replace(
        'If your target dies, you become an Amnesiac.',
        '<span class="roles-guide-ability-highlight">If your target dies, you become an Amnesiac.</span>'
      )
      .replace(
        'Can be used once.',
        '<span class="roles-guide-ability-highlight">Can be used once.</span>'
      )
      .replace(
        'Cannot be used twice in a row.',
        '<span class="roles-guide-ability-highlight">Cannot be used twice in a row.</span>'
      )
      .replace(
        'but you die instead.',
        '<span class="roles-guide-ability-highlight">but you die instead.</span>'
      )
      .replace(
        'Can only be used once. Cannot target yourself.',
        '<span class="roles-guide-ability-highlight">Can only be used once. Cannot target yourself.</span>'
      )
      .replace(
        'If your target dies, you become an Amnesiac. Can be used 4 times.',
        '<span class="roles-guide-ability-highlight">If your target dies, you become an Amnesiac. Can be used 4 times.</span>'
      )
      .replace(
        'you become an Amnesiac.',
        '<span class="roles-guide-ability-highlight">you become an Amnesiac.</span>'
      )
      .replace(
        'at least 6 players',
        '<span class="roles-guide-ability-highlight">at least 6 players</span>'
      )
      .replace(
        'Maximum 3 kills at once.',
        '<span class="roles-guide-ability-highlight">Maximum 3 kills at once.</span>'
      )
      .replace(
        'get voted out.',
        '<span class="roles-guide-ability-highlight">get voted out.</span>'
      );
  }

  function renderRolesGuide() {
    const tabs = document.getElementById('roles-faction-tabs');
    const summary = document.querySelector('#screen-roles .roles-guide-summary');
    const summaryLabel = document.getElementById('roles-guide-summary-label');
    const summaryCount = document.getElementById('roles-guide-summary-count');
    const grid = document.getElementById('roles-guide-grid');
    const guideScreen = document.querySelector('#screen-roles .roles-guide-screen');
    if (!tabs || !summary || !summaryLabel || !summaryCount || !grid || !guideScreen) return;

    const activeFaction = state.currentRolesFaction || 'Crew';
    const factionRoles = getRolesForFaction(activeFaction);
    guideScreen.className = `roles-guide-screen roles-guide-screen-${activeFaction.toLowerCase()}`;

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

    summary.className = `roles-guide-summary roles-faction-${activeFaction.toLowerCase()}`;
    summaryLabel.className = `roles-guide-summary-label roles-faction-${activeFaction.toLowerCase()}`;
    summaryLabel.textContent = activeFaction.toUpperCase();
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

    const groupedRoles = factionRoles.reduce((groups, roleInfo) => {
      const groupKey = roleInfo.subfaction || 'General';
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(roleInfo);
      return groups;
    }, {});

    const orderedGroups = Object.entries(groupedRoles).sort(([left], [right]) => {
      const groupOrder = ROLE_GUIDE_GROUP_ORDER[activeFaction] || [];
      const leftIndex = groupOrder.indexOf(left);
      const rightIndex = groupOrder.indexOf(right);
      if (leftIndex !== -1 || rightIndex !== -1) {
        const safeLeftIndex = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
        const safeRightIndex = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
        if (safeLeftIndex !== safeRightIndex) return safeLeftIndex - safeRightIndex;
      }
      return left.localeCompare(right);
    });
    let cardIndex = 0;

    grid.innerHTML = orderedGroups.map(([groupName, roles]) => `
      <section class="roles-guide-section">
        <div class="roles-guide-section-head roles-guide-section-head-${activeFaction.toLowerCase()}">
          <h3 class="roles-guide-section-title">${escapeHtml(groupName)}</h3>
          <span class="roles-guide-section-count">${roles.length} role${roles.length === 1 ? '' : 's'}</span>
        </div>
        <div class="roles-guide-grid">
          ${roles.map((roleInfo) => {
            const currentIndex = cardIndex++;
            return `
              <article class="roles-guide-card ${getRoleBadgeClass(roleInfo.role, roleInfo.faction)}" style="--role-card-delay:${currentIndex * 80}ms;">
                <div class="roles-guide-card-head">
                  <div class="roles-guide-card-icon-shell">
                    <div class="roles-guide-card-icon"></div>
                  </div>
                  <div class="roles-guide-card-copy">
                    <h3 class="roles-guide-card-title">${escapeHtml(roleInfo.role)}</h3>
                    <div class="roles-guide-card-meta">${escapeHtml(roleInfo.faction)}${roleInfo.subfaction ? ` &bull; ${escapeHtml(roleInfo.subfaction)}` : ''}</div>
                  </div>
                </div>
                <div class="roles-guide-abilities">
                  ${roleInfo.abilities.map((ability) => `
                    <div class="roles-guide-ability">
                      <div class="roles-guide-ability-head">
                        <span class="roles-guide-ability-name">${escapeHtml(ability.name)}</span>
                        <span class="roles-guide-ability-type">${escapeHtml(ability.type)}</span>
                      </div>
                      <p class="roles-guide-ability-copy">${formatRoleGuideAbilityDescription(ability.description)}</p>
                    </div>
                  `).join('')}
                </div>
                <div class="roles-guide-card-bottom-glow"></div>
              </article>
            `;
          }).join('')}
        </div>
      </section>
    `).join('');
  }

  function buildRoleRevealSequence(finalRole) {
    const roomPlayerCount = Math.max(
      Number(state.roomData?.playerCount) || 0,
      Array.isArray(state.roomData?.players) ? state.roomData.players.length : 0
    );
    const roles = Object.entries(ROLE_DEFINITIONS)
      .filter(([role]) => !(state.roomData?.disableVillagerRole && role === 'Villager'))
      .filter(([role]) => role !== 'Psychopath' || roomPlayerCount >= 6)
      .filter(([role]) => role !== 'Devastator' || roomPlayerCount >= 7)
      .filter(([role]) => role !== 'Ace of Blades' || roomPlayerCount >= 6)
      .filter(([role]) => role !== 'Sniper' || roomPlayerCount >= 6)
      .filter(([, roleInfo]) => !roleInfo.hiddenFromReveal)
      .map(([role]) => role);
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
      row.className = `gpl-row${p.alive ? '' : ' gpl-dead'}${p.id === state.playerId ? ' gpl-self' : ''}${p.isJailed ? ' gpl-jailed' : ''}`;

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
        <span class="gpl-status">${p.alive ? (p.isJailed ? '● jailed' : '● alive') : '○ dead'}</span>
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
    const anonymousKillsToggle = document.getElementById('toggle-anonymous-kills');
    if (anonymousKillsToggle) {
      anonymousKillsToggle.checked = !!data.anonymousKills;
      anonymousKillsToggle.disabled = !(state.isHost || state.playerId === data.hostId);
    }
    const hiddenRoleListToggle = document.getElementById('toggle-hidden-role-list');
    if (hiddenRoleListToggle) {
      hiddenRoleListToggle.checked = !!data.hiddenRoleList;
      hiddenRoleListToggle.disabled = !(state.isHost || state.playerId === data.hostId);
    }
    const disableVillagerRoleToggle = document.getElementById('toggle-disable-villager-role');
    if (disableVillagerRoleToggle) {
      disableVillagerRoleToggle.checked = !!data.disableVillagerRole;
      disableVillagerRoleToggle.disabled = !(state.isHost || state.playerId === data.hostId);
    }
    const enableTraitorToggle = document.getElementById('toggle-enable-traitor');
    if (enableTraitorToggle) {
      enableTraitorToggle.checked = !!data.enableTraitor;
      enableTraitorToggle.disabled = !(state.isHost || state.playerId === data.hostId);
    }
    const classicFivePlayerSetupToggle = document.getElementById('toggle-classic-five-player-setup');
    if (classicFivePlayerSetupToggle) {
      classicFivePlayerSetupToggle.checked = !!data.useClassicFivePlayerSetup;
      classicFivePlayerSetupToggle.disabled = !(state.isHost || state.playerId === data.hostId);
    }
    const sheriffKillsCrewTargetToggle = document.getElementById('toggle-sheriff-kills-crew-target');
    if (sheriffKillsCrewTargetToggle) {
      sheriffKillsCrewTargetToggle.checked = !!data.sheriffKillsCrewTarget;
      sheriffKillsCrewTargetToggle.disabled = !(state.isHost || state.playerId === data.hostId);
    }
    const sheriffKillsNeutralEvilToggle = document.getElementById('toggle-sheriff-kills-neutral-evil');
    if (sheriffKillsNeutralEvilToggle) {
      sheriffKillsNeutralEvilToggle.checked = !!data.sheriffKillsNeutralEvil;
      sheriffKillsNeutralEvilToggle.disabled = !(state.isHost || state.playerId === data.hostId);
    }
    const officerKillsNeutralEvilToggle = document.getElementById('toggle-officer-kills-neutral-evil');
    if (officerKillsNeutralEvilToggle) {
      officerKillsNeutralEvilToggle.checked = !!data.officerKillsNeutralEvil;
      officerKillsNeutralEvilToggle.disabled = !(state.isHost || state.playerId === data.hostId);
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
          ${player.isJailed ? '<span class="player-jailed-badge">JAILED</span>' : ''}
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

    renderChatBox();
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
    if (state.currentScreen === 'room' && state.roomData?.state === 'lobby') return 'lobby';
    if (state.gamePhase === 'morning') return 'morning';
    if (state.gamePhase === 'voting') return 'voting';
    if (state.gamePhase === 'night') return 'night';
    if (state.gamePhase === 'vote-result') return 'readonly';
    return 'hidden';
  }

  function getActiveChatPanel() {
    const activeScreen = state.currentScreen === 'game'
      ? document.getElementById('screen-game')
      : state.currentScreen === 'room'
        ? document.getElementById('screen-room')
        : document.querySelector('.screen.active');
    return activeScreen ? activeScreen.querySelector('#phase-chat-panel') : null;
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
    if (/has been Tethered\./i.test(text)) return 'summary-tethered';
    if (/was found dead|was eliminated by vote/i.test(text)) return 'summary-death';
    if (/was exiled by the Inquisitor\./i.test(text)) return 'summary-inquisitor';
    if (/The Disruptor has veto'd the voting\./i.test(text)) return 'summary-disruptor';
    if (/The Manipulator has played with the results\./i.test(text)) return 'summary-manipulator';
    if (/The Psychopath is plotting\./i.test(text)) return 'summary-psychopath';
    if (/The Devastator has strapped a player with dynamites\./i.test(text)) return 'summary-devastator';
    if (/The Dracula is thirsty for blood\.?$/i.test(text)) return 'summary-dracula';
    if (/A Vampie was thirsty\.?$/i.test(text)) return 'summary-vampire';
    if (/Pestilence became all powerful\./i.test(text)) return 'summary-pestilence';
    if (/The Plague is spreading\./i.test(text)) return 'summary-wither';
    if (/had their places swapped by the Swapper\./i.test(text)) return 'summary-swapper';
    if (/used their gun/i.test(text)) return 'summary-shoot';
    if (/Sheriff is investigating someone/i.test(text)) return 'summary-search';
    if (/Prophet has unveiled someone's role\./i.test(text)) return 'summary-prophet';
    if (/Investigator is examining someone/i.test(text)) return 'summary-examine';
    if (/Tracker is following someone/i.test(text)) return 'summary-track';
    if (/Stalker is shadowing someone/i.test(text)) return 'summary-stalk';
    if (/Traplord is setting traps\./i.test(text)) return 'summary-traplord';
    if (/Teleporter is bending the room\./i.test(text)) return 'summary-teleporter';
    if (/Magician has made a player disappear\./i.test(text)) return 'summary-magician';
    if (/Warden has guarded someone\./i.test(text)) return 'summary-warden';
    if (/The Officer has arrested someone\./i.test(text)) return 'summary-officer';
    if (/The Medium is hearing whispers\./i.test(text)) return 'summary-medium';
    if (/has been jailed by the Officer\./i.test(text)) return 'summary-officer';
    if (/was executed by the Officer/i.test(text)) return 'summary-officer';
    if (/The Alturist has sacrificed themselves\./i.test(text)) return 'summary-alturist';
    if (/Imitator has shifted abilities\./i.test(text)) return 'summary-imitator';
    if (/Amnesiac has claimed a forgotten role\./i.test(text)) return 'summary-amnesiac';
    if (/Oracle has marked someone with the Evil Eye\./i.test(text)) return 'summary-oracle';
    if (/Arsonist is playing with fire\./i.test(text)) return 'summary-arsonist';
    if (/Vitalist has protected someone\./i.test(text)) return 'summary-vitalist';
    if (/Silencer has hushed someone\./i.test(text)) return 'summary-silencer';
    if (/Guardian Angel has blessed their target\./i.test(text)) return 'summary-guardianangel';
    if (/Hypnotic has cast a trance over someone\./i.test(text)) return 'summary-hypnotic';
    if (/Someone has been hacked by the Overload\./i.test(text)) return 'summary-overload';
    if (/Blackout has blinded the room\./i.test(text)) return 'summary-blackout';
    if (/A crushing force has settled over the night\./i.test(text)) return 'summary-thepurge';
    if (/Blackmailer has silenced someone\./i.test(text)) return 'summary-blackmailer';
    if (/Survivalist has prepared to survive the night\./i.test(text)) return 'summary-survivalist';
    if (/Mirror Caster has woven a reflective shield\./i.test(text)) return 'summary-mirrorcaster';
    if (/Veteran is standing watch\./i.test(text)) return 'summary-veteran';
    if (/Sniper has lined up a distant shot\./i.test(text)) return 'summary-sniper';
    if (/Tetherhex has forged a lethal bond\./i.test(text)) return 'summary-tetherhex';
    if (/The Vessel has taken revenge\./i.test(text)) return 'summary-vessel';
    if (/An Assassin has moved through the shadows\./i.test(text)) return 'summary-kill';
    if (/The exiled player was protected by the Oracle\./i.test(text)) return 'summary-oracle-protect';
    if (/The Lawyer has objected this decision\./i.test(text)) return 'summary-lawyer-protect';
    if (/protected someone/i.test(text)) return 'summary-protect';
    if (/moved through the shadows/i.test(text)) return 'summary-kill';
    return '';
  }

  function formatAlivePlayersSummaryLine(line) {
    const text = String(line || '').trim();
    const match = text.match(/^Alive players:\s*(.*)\.$/i);
    if (!match) return escapeHtml(text);

    const namesText = String(match[1] || '').trim();
    if (!namesText || /^No one$/i.test(namesText)) {
      return 'Alive players: No one.';
    }

    const names = namesText.split(',').map((name) => name.trim()).filter(Boolean);
    const renderedNames = names.map((name) => {
      const player = state.roomData?.players?.find((candidate) => candidate.name === name);
      if (!player) return escapeHtml(name);
      const style = getPlayerChatStyle({
        type: 'player',
        senderId: player.id,
        senderName: player.name,
      });
      return `<span class="chat-alive-name"${style ? ` style="${style}"` : ''}>${escapeHtml(name)}</span>`;
    }).join(', ');

    return `Alive players: ${renderedNames}.`;
  }

  function formatPlayerNameReference(name) {
    const cleanName = String(name || '').trim();
    if (!cleanName) return '';

    const player = state.roomData?.players?.find((candidate) => candidate.name === cleanName);
    if (!player) return escapeHtml(cleanName);

    const style = getPlayerChatStyle({
      type: 'player',
      senderId: player.id,
      senderName: player.name,
    });

    return `<span class="chat-player-ref"${style ? ` style="${style}"` : ''}>${escapeHtml(cleanName)}</span>`;
  }

  function getSystemMessageVariantClass(message) {
    if (!message || message.type !== 'system') return '';
    const text = String(message.text || '').trim();
    if (!text) return '';

    if (/Your investigation found that .* is the .*?\.$/i.test(text)) {
      return ' system-result-search';
    }
    if (/.* has killed someone in the last 2 rounds\.$/i.test(text) || /.* has not killed anyone in the last 2 rounds\.$/i.test(text)) {
      return ' system-result-examine';
    }
    if (/.* interacted with .* tonight\.$/i.test(text) || /.* did not interact with anyone tonight\.$/i.test(text)) {
      return ' system-result-tracker';
    }
    if (/.* was interacted by .* tonight\.$/i.test(text) || /.* was not interacted by anyone tonight\.$/i.test(text)) {
      return ' system-result-stalker';
    }
    if (/Your trap uncovered these roles: .*?\.$/i.test(text) && String(message.source || '').trim() === 'Traplord') {
      return ' system-result-trap';
    }
    if (/You couldn\'t see anything last night\.$/i.test(text) && String(message.source || '').trim() === 'Blackout') {
      return ' system-result-blackout';
    }
    if (/You have been blackmailed\.$/i.test(text) && String(message.source || '').trim() === 'Blackmailer') {
      return ' system-result-blackmail';
    }
    if (/You have been silenced by the Silencer\.$/i.test(text) && String(message.source || '').trim() === 'Silencer') {
      return ' system-result-silenced';
    }
    if (/You have been hypnotised by the Hypnotic\.$/i.test(text) && String(message.source || '').trim() === 'Hypnotic') {
      return ' system-result-hypnotic';
    }
    if (/You have been hacked by the Overload\.$/i.test(text) && String(message.source || '').trim() === 'Overload') {
      return ' system-result-overload';
    }
    if (/You have been teleported with .*\.$/i.test(text) && String(message.source || '').trim() === 'Teleporter') {
      return ' system-result-teleporter';
    }
    if (/Your gospel revealed that .* is the .*?\.$/i.test(text) && String(message.source || '').trim() === 'Prophet') {
      return ' system-result-prophet';
    }
    if (/The Magician made you disappear\.$/i.test(text) && String(message.source || '').trim() === 'Magician') {
      return ' system-result-magician';
    }
    if ((/You have been killed by .*\.$/i.test(text) || /You have been killed\.$/i.test(text) || /You have been burnt to crisp by the Arsonist\.$/i.test(text)) && String(message.source || '').trim() === 'Death') {
      return ' system-result-killed';
    }
    if (/It is over when i say it is$/i.test(text) && String(message.source || '').trim() === 'The Vessel') {
      return ' system-result-vessel';
    }
    if (/The Purge has seized the night\.\s*$/i.test(text) || /The night has been taken over by The Purge, no abilities worked\.?$/i.test(text)) {
      return ' system-result-purge';
    }
    if (/You protected the chosen player\.$/i.test(text) && String(message.source || '').trim() === 'Warden') {
      return ' system-result-warden-confirm';
    }
    if (/Warden has protected you from all interactions\.$/i.test(text) && String(message.source || '').trim() === 'Warden') {
      return ' system-result-warden';
    }
    if (/.* confesses to murdering .*\.$/i.test(text) && String(message.source || '').trim() === 'Redflag') {
      return ' system-result-redflag';
    }
    if ((/.* confesses to murdering .*\.$/i.test(text) || /.* was killed by .*\.$/i.test(text)) && String(message.source || '').trim() === 'Oracle') {
      return ' system-result-oracle';
    }
    if (/The exiled player was protected by the Oracle\./i.test(text) && String(message.source || '').trim() === 'Oracle') {
      return ' system-result-oracle-protect';
    }
    if (/The Lawyer has objected this decision\./i.test(text) && String(message.source || '').trim() === 'Lawyer') {
      return ' system-result-lawyer-protect';
    }
    if (/The Medium is hearing whispers\./i.test(text) && String(message.source || '').trim() === 'Medium') {
      return ' system-result-medium';
    }
    if ((/The Officer has arrested someone\./i.test(text) || /has been jailed by the Officer\./i.test(text) || /was executed by the Officer/i.test(text)) && String(message.source || '').trim() === 'Officer') {
      return ' system-result-officer';
    }
    if (/.* was exiled by the Inquisitor\./i.test(text) && String(message.source || '').trim() === 'Inquisitor') {
      return ' system-result-inquisitor';
    }
    if (/The Disruptor has veto'd the voting\./i.test(text) && String(message.source || '').trim() === 'Disruptor') {
      return ' system-result-disruptor';
    }
    if (/The Manipulator has played with the results\./i.test(text) && String(message.source || '').trim() === 'Manipulator') {
      return ' system-result-manipulator';
    }
    if (/The Psychopath is plotting\./i.test(text) && String(message.source || '').trim() === 'Psychopath') {
      return ' system-result-psychopath';
    }
    if (/The Devastator has strapped a player with dynamites\./i.test(text) && String(message.source || '').trim() === 'Devastator') {
      return ' system-result-devastator';
    }
    if ((/The Dracula is thirsty for blood\.?$/i.test(text) || /Your fangs have grown\.?$/i.test(text)) && String(message.source || '').trim() === 'Dracula') {
      return ' system-result-dracula';
    }
    if (/A Vampie was thirsty\.?$/i.test(text) && String(message.source || '').trim() === 'Vampire') {
      return ' system-result-vampire';
    }
    if (/Pestilence became all powerful\./i.test(text) && String(message.source || '').trim() === 'Pestilence') {
      return ' system-result-pestilence';
    }
    if (/A mirrored shield reflected a killing blow away from you\.$/i.test(text) && String(message.source || '').trim() === 'Mirror Caster') {
      return ' system-result-mirror';
    }
    if (/You were protected by the Vitalist during the night\.$/i.test(text) && String(message.source || '').trim() === 'Vitalist') {
      return ' system-result-vitalist';
    }
    if (/You protected yourself from death during the night\.$/i.test(text) && String(message.source || '').trim() === 'Survivalist') {
      return ' system-result-survivalist';
    }
    if (/A Guardian Angel blessed you through the night\.$/i.test(text) && String(message.source || '').trim() === 'Guardian Angel') {
      return ' system-result-guardian-angel';
    }
    if (/Your target has died\. You have become an Amnesiac\.$/i.test(text) && String(message.source || '').trim() === 'Executioner') {
      return ' system-result-executioner-shift';
    }
    if (/Your target has died\. You have become an Amnesiac\.$/i.test(text) && String(message.source || '').trim() === 'Guardian Angel') {
      return ' system-result-guardian-shift';
    }
    if (/You executed the wrong player\. You have become an Amnesiac\.$/i.test(text) && String(message.source || '').trim() === 'Officer') {
      return ' system-result-officer-shift';
    }
    if (/You were protected by the Vitalist during the night\.$/i.test(text)) {
      return ' system-result-protect';
    }

    return '';
  }

  function formatChatMessageHtml(message) {
    if (message.type === 'system' && message.summaryTitle) {
      const title = `<div class="chat-summary-title">${escapeHtml(message.summaryTitle)}</div>`;
      const lines = (message.summaryLines || []).map((line) => {
        const lineClass = getSummaryLineClass(line);
        const lineHtml = lineClass === 'summary-alive'
          ? formatAlivePlayersSummaryLine(line)
          : escapeHtml(line);
        return `<div class="chat-summary-line${lineClass ? ` ${lineClass}` : ''}">${lineHtml}</div>`;
      }).join('');
      return `${title}${lines ? `<div class="chat-summary-lines">${lines}</div>` : ''}`;
    }

    if (message.type === 'system') {
      const redflagConfessionMatch = String(message.text || '').trim().match(/^(.*?) confesses to murdering (.*?)\.$/i);
      if (redflagConfessionMatch && (String(message.source || '').trim() === 'Redflag' || String(message.source || '').trim() === 'Oracle')) {
        return `${formatPlayerNameReference(redflagConfessionMatch[1])} confesses to murdering ${formatPlayerNameReference(redflagConfessionMatch[2])}.`;
      }
      const oracleRevealMatch = String(message.text || '').trim().match(/^(.*?) was killed by (.*?)\.$/i);
      if (oracleRevealMatch && String(message.source || '').trim() === 'Oracle') {
        return `${formatPlayerNameReference(oracleRevealMatch[1])} was killed by ${formatPlayerNameReference(oracleRevealMatch[2])}.`;
      }
      const privateKilledByMatch = String(message.text || '').trim().match(/^You have been killed by (.*?)\.$/i);
      if (privateKilledByMatch && String(message.source || '').trim() === 'Death') {
        return `You have been killed by ${formatPlayerNameReference(privateKilledByMatch[1])}.`;
      }
      if (/^You have been killed\.$/i.test(String(message.text || '').trim()) && String(message.source || '').trim() === 'Death') {
        return 'You have been killed.';
      }
    }

    if (message.private && message.type === 'system') {
      const text = String(message.text || '').trim();
      const sheriffSearchMatch = text.match(/^Your investigation found that (.*?) is the (.*?)\.$/i);
      if (sheriffSearchMatch) {
        const revealedRole = sheriffSearchMatch[2];
        const revealedRoleInfo = getRoleDefinition(revealedRole);
        return `Your investigation found that ${formatPlayerNameReference(sheriffSearchMatch[1])} is the <span class="search-target-role ${getRoleBadgeClass(revealedRole, revealedRoleInfo.faction)}">${escapeHtml(revealedRole)}</span>.`;
      }
      const prophetRevealMatch = text.match(/^Your gospel revealed that (.*?) is the (.*?)\.$/i);
      if (prophetRevealMatch) {
        const revealedRole = prophetRevealMatch[2];
        const revealedRoleInfo = getRoleDefinition(revealedRole);
        return `Your gospel revealed that ${formatPlayerNameReference(prophetRevealMatch[1])} is the <span class="search-target-role ${getRoleBadgeClass(revealedRole, revealedRoleInfo.faction)}">${escapeHtml(revealedRole)}</span>.`;
      }

      const killedMatch = text.match(/^(.*?) has killed someone in the last 2 rounds\.$/i);
      if (killedMatch) {
        return `${formatPlayerNameReference(killedMatch[1])} <span class="chat-result-highlight is-positive">has killed someone in the last 2 rounds.</span>`;
      }

      const notKilledMatch = text.match(/^(.*?) has not killed anyone in the last 2 rounds\.$/i);
      if (notKilledMatch) {
        return `${formatPlayerNameReference(notKilledMatch[1])} <span class="chat-result-highlight is-negative">has not killed anyone in the last 2 rounds.</span>`;
      }

      const interactedMatch = text.match(/^(.*?) interacted with (.*?) tonight\.$/i);
      if (interactedMatch) {
        return `${formatPlayerNameReference(interactedMatch[1])} <span class="chat-result-highlight is-tracker">interacted with ${formatPlayerNameReference(interactedMatch[2])} tonight.</span>`;
      }

      const noInteractionMatch = text.match(/^(.*?) did not interact with anyone tonight\.$/i);
      if (noInteractionMatch) {
        return `${formatPlayerNameReference(noInteractionMatch[1])} <span class="chat-result-highlight is-tracker-muted">did not interact with anyone tonight.</span>`;
      }

      const stalkedByMatch = text.match(/^(.*?) was interacted by (.*?) tonight\.$/i);
      if (stalkedByMatch) {
        const visitorNames = stalkedByMatch[2]
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => formatPlayerNameReference(name))
          .join(', ');
        return `${formatPlayerNameReference(stalkedByMatch[1])} <span class="chat-result-highlight is-tracker">was interacted by ${visitorNames} tonight.</span>`;
      }

      const noVisitorMatch = text.match(/^(.*?) was not interacted by anyone tonight\.$/i);
      if (noVisitorMatch) {
        return `${formatPlayerNameReference(noVisitorMatch[1])} <span class="chat-result-highlight is-tracker-muted">was not interacted by anyone tonight.</span>`;
      }

      const teleportedMatch = text.match(/^You have been teleported with (.*?)\.$/i);
      if (teleportedMatch) {
        return `You have been teleported with ${formatPlayerNameReference(teleportedMatch[1])}.`;
      }

      const trapMatch = text.match(/^Your trap uncovered these roles: (.*?)\.$/i);
      if (trapMatch) {
        const roleList = trapMatch[1]
          .split(',')
          .map((role) => role.trim())
          .filter(Boolean)
          .map((role) => {
            const roleInfo = getRoleDefinition(role);
            return `<span class="search-target-role ${getRoleBadgeClass(role, roleInfo.faction)}">${escapeHtml(role)}</span>`;
          })
          .join(', ');
        return `Your trap uncovered these roles: ${roleList}.`;
      }
    }

    return escapeHtml(message.text).replace(/\n/g, '<br>');
  }

  function renderChatBox() {
    const panel = document.getElementById('phase-chat-panel');
    if (!panel) return;

    const mode = getChatMode();
    const phaseAllowsChat = mode === 'morning' || mode === 'voting';
    const canChat = phaseAllowsChat && !state.playerData?.isBlackmailed && !state.playerData?.isSilenced;
    const isMorningFullscreen = mode === 'morning' && state.chatOverlayOpen;
    const isExpandedMode = mode === 'morning' && !isMorningFullscreen;
    const isDockedMode = mode !== 'hidden' && !isExpandedMode;
    const isOverlayOpen = state.chatOverlayOpen;
    const subtitle = state.playerData?.isBlackmailed
      ? 'You have been blackmailed.'
      : state.playerData?.isSilenced
        ? 'You have been silenced.'
      : canChat
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
        const sender = message.type === 'system' ? (message.senderName || 'SYSTEM') : message.senderName;
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

    if (player.role === 'Villager' || player.role === 'Jester') {
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
            state.aceOfBladesRollAnimation = null;
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
    const activeRole = getActiveNightRole(player);
    if (player.isJailed) {
      container.innerHTML = '<div class="waiting-panel"><div class="waiting-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/></svg></div><p class="waiting-text">YOU ARE JAILED</p><p class="waiting-subtext">You cannot act or use public chat while detained. Use Jail chat instead.</p></div><div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }
    const shouldUseExpandedSelfNightChat = activeRole === 'Veteran' || activeRole === 'Survivalist' || activeRole === 'Guardian Angel' || activeRole === 'Medium';

    if (
      player.role === 'Villager'
      || player.role === 'Jester'
      || player.role === 'Karma'
      || player.role === 'Narcissist'
      || (player.role === 'Veteran' && (player.veteranUsesRemaining ?? 4) <= 0)
    ) {
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
    if (state.playerData?.isBlackmailed) {
      container.innerHTML = '<div class="waiting-panel"><div class="waiting-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 8h8"/><path d="M7 12h10"/><path d="M9 16h6"/></svg></div><p class="waiting-text">YOU HAVE BEEN BLACKMAILED</p><p class="waiting-subtext">You cannot speak or vote until the next night.</p></div><div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }

    if (state.hasVoted) {
      container.innerHTML = '<div class="action-confirmed"><div class="confirmed-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><p class="confirmed-text">VOTE SUBMITTED</p><p class="confirmed-detail">Waiting for others...</p></div><div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }

    const targets = getVoteTargets();
    const aliveCount = state.totalAlive || state.roomData?.votingEligibleCount || state.roomData?.aliveCount || '?';

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
    const activeRole = getActiveNightRole(player);
    const roleInfo = getRoleDefinition(player.role);
    const isDead = player.alive === false;

    const card = document.getElementById('role-card');
    const faction = document.getElementById('role-faction');
    const roleName = document.getElementById('role-name');
    const desc = document.getElementById('role-description');
    const teammates = document.getElementById('role-teammates');
    const teammatesList = document.getElementById('teammates-list');
    const teammatesLabel = teammates?.querySelector('.teammates-label');

    if (isDead) {
      card.className = 'role-card dead';
      faction.textContent = 'SPECTATOR';
      roleName.textContent = "YOU'VE DIED";
      desc.textContent = 'Spectate the remaining players and see how the game turns out.';
      teammates.style.display = 'none';
      return;
    }

    card.className = `role-card ${player.faction?.toLowerCase() || ''} ${player.role === 'Imitator' ? getDisplayedRoleTheme(player) : getRoleBadgeClass(player.role, player.faction)}`;
    faction.textContent = player.faction?.toUpperCase() || '';
    roleName.textContent = player.role?.toUpperCase() || '';
    if ((player.role === 'Executioner' && player.executionerTargetName) || (activeRole === 'Guardian Angel' && player.guardianAngelTargetName)) {
      const targetId = activeRole === 'Guardian Angel' ? player.guardianAngelTargetId : player.executionerTargetId;
      const targetName = activeRole === 'Guardian Angel' ? player.guardianAngelTargetName : player.executionerTargetName;
      const targetPlayer = state.roomData?.players?.find((candidate) => candidate.id === targetId);
      const targetStyle = targetPlayer
        ? getPlayerChatStyle({ type: 'player', senderId: targetPlayer.id, senderName: targetPlayer.name, colorHex: targetPlayer.colorHex })
        : '';
      if (player.role === 'Executioner') {
        desc.innerHTML = `Get <span class="chat-player-ref"${targetStyle ? ` style="${targetStyle}"` : ''}>${escapeHtml(targetName)}</span> voted out. Make sure they don't die.`;
      } else {
        const targetRoleSuffix = player.guardianAngelTargetRole ? ` They are <span class="roles-guide-ability-highlight">${escapeHtml(player.guardianAngelTargetRole)}</span>.` : '';
        desc.innerHTML = `Protect <span class="chat-player-ref"${targetStyle ? ` style="${targetStyle}"` : ''}>${escapeHtml(targetName)}</span> until the end to win with them.${targetRoleSuffix}`;
      }
    } else if (player.role === 'Imitator') {
      desc.textContent = player.imitatorCopiedRole
        ? `Borrowing ${player.imitatorCopiedRole} tonight. Survive until the end to win with whoever remains.`
        : getInGameRoleDescription(roleInfo);
    } else {
      desc.textContent = getInGameRoleDescription(roleInfo);
    }

    if ((player.faction === 'Assassin' || player.role === 'Dracula' || player.role === 'Vampire') && player.teammates && player.teammates.length > 0) {
      teammates.style.display = 'block';
      if (teammatesLabel) {
        teammatesLabel.textContent = player.role === 'Vampire'
          ? 'Your Teammate:'
          : player.role === 'Dracula'
            ? 'Your Teammate:'
            : 'Fellow Assassins:';
      }
      teammatesList.innerHTML = player.teammates.map(t => `<span class="teammate-tag">${t.name} ${t.alive ? '' : '(Dead)'}</span>`).join('');
    } else {
      teammates.style.display = 'none';
    }
  }

  function shouldAnimateAmnesiacInheritance(previousPlayer, nextPlayer) {
    const becameAmnesiacAfterTargetLoss = (
      previousPlayer
      && nextPlayer
      && previousPlayer.id === nextPlayer.id
      && previousPlayer.alive !== false
      && nextPlayer.alive !== false
      && nextPlayer.role === 'Amnesiac'
      && (previousPlayer.role === 'Executioner' || previousPlayer.role === 'Guardian Angel' || previousPlayer.role === 'Officer')
    );

    return !!(
      becameAmnesiacAfterTargetLoss
      || (
        previousPlayer
        && nextPlayer
        && previousPlayer.id === nextPlayer.id
        && previousPlayer.alive !== false
        && nextPlayer.alive !== false
        && previousPlayer.role === 'Amnesiac'
        && nextPlayer.role
        && nextPlayer.role !== 'Amnesiac'
      )
    );
  }

  function queueAmnesiacInheritanceTransition(previousPlayer, nextPlayer) {
    if (!shouldAnimateAmnesiacInheritance(previousPlayer, nextPlayer)) return;
    state.pendingRoleInheritance = {
      role: nextPlayer.role,
      type: 'inheritance',
      timestamp: Date.now(),
    };
  }

  function shouldAnimateTraitorTurn(previousPlayer, nextPlayer) {
    return !!(
      previousPlayer
      && nextPlayer
      && previousPlayer.alive !== false
      && nextPlayer.alive !== false
      && previousPlayer.role !== 'Traitor'
      && nextPlayer.role === 'Traitor'
      && previousPlayer.faction === 'Crew'
      && nextPlayer.faction === 'Assassin'
    );
  }

  function queueTraitorTurnTransition(previousPlayer, nextPlayer) {
    if (!shouldAnimateTraitorTurn(previousPlayer, nextPlayer)) return;
    state.pendingRoleInheritance = {
      role: nextPlayer.role,
      type: 'traitor',
      timestamp: Date.now(),
    };
  }

  function shouldAnimateVampireTurn(previousPlayer, nextPlayer) {
    return !!(
      previousPlayer
      && nextPlayer
      && previousPlayer.id === nextPlayer.id
      && previousPlayer.alive !== false
      && nextPlayer.alive !== false
      && previousPlayer.role !== 'Vampire'
      && nextPlayer.role === 'Vampire'
      && !!nextPlayer.draculaMasterId
    );
  }

  function queueVampireTurnTransition(previousPlayer, nextPlayer) {
    if (!shouldAnimateVampireTurn(previousPlayer, nextPlayer)) return;
    state.pendingRoleInheritance = {
      role: nextPlayer.role,
      type: 'vampire',
      timestamp: Date.now(),
    };
  }

  function shouldAnimatePestilenceTurn(previousPlayer, nextPlayer) {
    return !!(
      previousPlayer
      && nextPlayer
      && previousPlayer.id === nextPlayer.id
      && previousPlayer.alive !== false
      && nextPlayer.alive !== false
      && previousPlayer.role === 'Wither'
      && nextPlayer.role === 'Pestilence'
    );
  }

  function queuePestilenceTurnTransition(previousPlayer, nextPlayer) {
    if (!shouldAnimatePestilenceTurn(previousPlayer, nextPlayer)) return;
    state.pendingRoleInheritance = {
      role: nextPlayer.role,
      type: 'pestilence',
      timestamp: Date.now(),
    };
  }

  function playPendingRoleInheritanceTransition() {
    if (!state.pendingRoleInheritance) return;
    const roleCard = document.getElementById('role-card');
    const gameContent = document.getElementById('game-content');
    const activePanel = gameContent
      ? Array.from(gameContent.children).find((child) => child.id !== 'phase-chat-panel')
      : null;

    const transition = state.pendingRoleInheritance;
    state.pendingRoleInheritance = null;
    const cardClass = transition.type === 'traitor'
      ? 'role-traitor-turn-enter'
      : transition.type === 'vampire'
        ? 'role-vampire-turn-enter'
        : transition.type === 'pestilence'
          ? 'role-pestilence-turn-enter'
        : 'role-inheritance-enter';
    const panelClass = transition.type === 'traitor'
      ? 'role-traitor-turn-panel-enter'
      : transition.type === 'vampire'
        ? 'role-vampire-turn-panel-enter'
        : transition.type === 'pestilence'
          ? 'role-pestilence-turn-panel-enter'
        : 'role-inheritance-panel-enter';

    if (roleCard) {
      roleCard.classList.remove('role-inheritance-enter', 'role-traitor-turn-enter', 'role-vampire-turn-enter', 'role-pestilence-turn-enter');
      void roleCard.offsetWidth;
      roleCard.classList.add(cardClass);
      window.setTimeout(() => roleCard.classList.remove(cardClass), transition.type === 'traitor' ? 1180 : transition.type === 'vampire' ? 1120 : transition.type === 'pestilence' ? 1220 : 820);
    }

    if (activePanel) {
      activePanel.classList.remove('role-inheritance-panel-enter', 'role-traitor-turn-panel-enter', 'role-vampire-turn-panel-enter', 'role-pestilence-turn-panel-enter');
      void activePanel.offsetWidth;
      activePanel.classList.add(panelClass);
      window.setTimeout(() => activePanel.classList.remove(panelClass), transition.type === 'traitor' ? 980 : transition.type === 'vampire' ? 920 : transition.type === 'pestilence' ? 980 : 700);
    }

    if (transition.type === 'traitor') {
      showToast('You have become the Traitor', 'info');
    } else if (transition.type === 'vampire') {
      showToast('Your fangs have grown', 'info');
    } else if (transition.type === 'pestilence') {
      showToast('The plague has crowned you Pestilence', 'info');
    }
  }

  function queueLifeTransition(previousPlayer, nextPlayer) {
    if (!previousPlayer || !nextPlayer) return;
    if (previousPlayer.alive === false && nextPlayer.alive !== false) {
      state.pendingLifeTransition = { type: 'revive', timestamp: Date.now() };
    } else if (previousPlayer.alive !== false && nextPlayer.alive === false) {
      state.pendingLifeTransition = { type: 'fall', timestamp: Date.now() };
    }
  }

  function playPendingLifeTransition() {
    if (!state.pendingLifeTransition) return;
    const { type } = state.pendingLifeTransition;
    const roleCard = document.getElementById('role-card');
    const gameContent = document.getElementById('game-content');
    const activePanel = gameContent
      ? Array.from(gameContent.children).find((child) => child.id !== 'phase-chat-panel')
      : null;

    state.pendingLifeTransition = null;

    const roleCardClass = type === 'revive' ? 'role-life-revive-enter' : 'role-life-fall-enter';
    const panelClass = type === 'revive' ? 'role-life-revive-panel-enter' : 'role-life-fall-panel-enter';

    if (roleCard) {
      roleCard.classList.remove('role-life-revive-enter', 'role-life-fall-enter');
      void roleCard.offsetWidth;
      roleCard.classList.add(roleCardClass);
      window.setTimeout(() => roleCard.classList.remove(roleCardClass), 880);
    }

    if (activePanel) {
      activePanel.classList.remove('role-life-revive-panel-enter', 'role-life-fall-panel-enter');
      void activePanel.offsetWidth;
      activePanel.classList.add(panelClass);
      window.setTimeout(() => activePanel.classList.remove(panelClass), 760);
    }
  }

  function getTargetPlayers() {
    if (!state.roomData || !state.playerData) return [];
    const activeRole = getActiveNightRole(state.playerData);
    return state.roomData.players.filter(p => {
      if (!p.alive) return false;
      if (p.id === state.playerId) return activeRole === 'Vitalist' || activeRole === 'Mirror Caster' || activeRole === 'Teleporter' || activeRole === 'Warden';
      if (state.playerData.faction === 'Assassin' && (activeRole === 'Assassin' || activeRole === 'Disruptor' || activeRole === 'Manipulator' || activeRole === 'Ace of Blades')) {
        const isTeammate = state.playerData.teammates?.some(t => t.id === p.id);
        if (isTeammate) return false;
      }
      if (activeRole === 'Dracula') {
        const isBloodline = state.playerData.teammates?.some((t) => t.id === p.id);
        if (isBloodline) return false;
      }
      if (activeRole === 'Vampire') {
        const isBloodline = p.id === state.playerData.draculaMasterId || state.playerData.teammates?.some((t) => t.id === p.id);
        if (isBloodline) return false;
      }
      return true;
    }).map(p => ({ id: p.id, name: p.name, avatarIndex: p.avatarIndex, isJailed: !!p.isJailed }));
  }

  function getAmnesiacTargets() {
    if (!state.roomData || !state.playerData) return [];
    return state.roomData.players
      .filter((p) => !p.alive && p.id !== state.playerId)
      .map((p) => ({ id: p.id, name: p.name, avatarIndex: p.avatarIndex }));
  }

  function getDeadTargets() {
    if (!state.roomData || !state.playerData) return [];
    return state.roomData.players
      .filter((p) => !p.alive && p.id !== state.playerId)
      .map((p) => ({ id: p.id, name: p.name, avatarIndex: p.avatarIndex }));
  }

  function getPinnedTargetBadgeMeta(player, activeRole, targetId) {
    if (!player || !targetId) return null;
    if (player.role === 'Executioner' && player.executionerTargetId === targetId) {
      return { label: 'Target', className: 'target-status-executioner-target' };
    }
    if (activeRole === 'Guardian Angel' && player.guardianAngelTargetId === targetId) {
      return { label: 'Target', className: 'target-status-guardian-target' };
    }
    return null;
  }

  function renderPinnedTargetBadge(player, activeRole, targetId) {
    const badge = getPinnedTargetBadgeMeta(player, activeRole, targetId);
    return badge ? `<span class="target-status ${badge.className}">${badge.label}</span>` : '';
  }

  function getVoteTargets() {
    if (!state.roomData) return [];
    return state.roomData.players
      .filter(p => p.alive && p.id !== state.playerId)
      .map(p => ({ id: p.id, name: p.name, avatarIndex: p.avatarIndex, isJailed: !!p.isJailed }));
  }

  function showGameOver(winner, players) {
    showScreen('gameover');
    const glow = document.getElementById('gameover-glow');
    const title = document.getElementById('gameover-faction');
    const reason = document.getElementById('gameover-reason');
    const playersList = document.getElementById('gameover-players');
    const returnLobbyBtn = document.getElementById('btn-return-lobby');
    const winnerPresentation = getWinnerPresentation(winner?.winner);
    const winningSide = String(winner?.winner || '').trim();
    const guardianAngelWinnerIds = new Set(winner?.guardianAngelWinnerIds || []);
    const survivalistWinnerIds = new Set(winner?.survivalistWinnerIds || []);
    const narcissistWinnerIds = new Set(winner?.narcissistWinnerIds || []);
    const winnerThemeStyles = getWinnerThemeStyles(winner?.winner);

    glow.className = `gameover-glow ${winnerPresentation.glowClass}`;
    title.className = `gameover-faction ${winnerPresentation.textClass}`;
    glow.style.background = winnerThemeStyles?.glowBackground || '';
    title.style.color = winnerThemeStyles?.titleColor || '';
    title.style.textShadow = winnerThemeStyles?.titleShadow || '';
    title.textContent = winnerPresentation.label.toUpperCase();
    reason.textContent = winnerPresentation.isSoloWin
      ? (winner.reason || 'Everyone else loses.')
      : winner.reason;
    if (returnLobbyBtn) {
      returnLobbyBtn.disabled = false;
      returnLobbyBtn.innerHTML = '<span>RETURN TO LOBBY</span>';
    }

    playersList.innerHTML = players.map((p, index) => `
      <div class="gameover-player ${(winningSide !== 'Nobody' && (narcissistWinnerIds.has(p.id) || survivalistWinnerIds.has(p.id) || guardianAngelWinnerIds.has(p.id) || (winningSide === 'Crew' && p.faction === 'Crew') || (winningSide === 'Assassin' && p.faction === 'Assassin') || (winningSide === 'Bloodlust' && (p.role === 'Dracula' || p.role === 'Vampire')) || winningSide === p.role)) ? 'won' : 'lost'}" style="--gameover-delay:${320 + (index * 60)}ms;">
        <span class="gameover-player-name" style="${getPlayerChatStyle({ type: 'player', senderId: p.id, senderName: p.name, colorHex: p.colorHex || p.colorHue })}">${p.name}</span>
        <span class="gameover-player-role ${getRoleBadgeClass(p.role, p.faction)}">
          ${p.role}
          <span class="gameover-player-status">${p.alive ? '✓' : '✗'}</span>
        </span>
      </div>`).join('');

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
        state.socket.emit('create-room', { playerId: state.playerId, username: profile.username, avatarIndex: profile.avatarIndex, colorHex: profile.colorHex }, (response) => {
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
        state.socket.emit('join-room', { code: profile.code, playerId: state.playerId, username: profile.username, avatarIndex: profile.avatarIndex, colorHex: profile.colorHex }, (response) => {
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

    document.getElementById('toggle-anonymous-kills').addEventListener('change', (event) => {
      state.socket.emit('update-room-settings', { anonymousKills: event.target.checked }, (response) => {
        if (!response.success) {
          showToast(response.error || 'Could not update room settings', 'error');
          event.target.checked = !!state.roomData?.anonymousKills;
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

    document.getElementById('toggle-disable-villager-role').addEventListener('change', (event) => {
      state.socket.emit('update-room-settings', { disableVillagerRole: event.target.checked }, (response) => {
        if (!response.success) {
          showToast(response.error || 'Could not update room settings', 'error');
          event.target.checked = !!state.roomData?.disableVillagerRole;
        }
      });
    });

    document.getElementById('toggle-enable-traitor').addEventListener('change', (event) => {
      state.socket.emit('update-room-settings', { enableTraitor: event.target.checked }, (response) => {
        if (!response.success) {
          showToast(response.error || 'Could not update room settings', 'error');
          event.target.checked = !!state.roomData?.enableTraitor;
        }
      });
    });

    document.getElementById('toggle-classic-five-player-setup').addEventListener('change', (event) => {
      state.socket.emit('update-room-settings', { useClassicFivePlayerSetup: event.target.checked }, (response) => {
        if (!response.success) {
          showToast(response.error || 'Could not update room settings', 'error');
          event.target.checked = !!state.roomData?.useClassicFivePlayerSetup;
        }
      });
    });

    document.getElementById('toggle-sheriff-kills-crew-target').addEventListener('change', (event) => {
      state.socket.emit('update-room-settings', { sheriffKillsCrewTarget: event.target.checked }, (response) => {
        if (!response.success) {
          showToast(response.error || 'Could not update room settings', 'error');
          event.target.checked = !!state.roomData?.sheriffKillsCrewTarget;
        }
      });
    });

    document.getElementById('toggle-sheriff-kills-neutral-evil').addEventListener('change', (event) => {
      state.socket.emit('update-room-settings', { sheriffKillsNeutralEvil: event.target.checked }, (response) => {
        if (!response.success) {
          showToast(response.error || 'Could not update room settings', 'error');
          event.target.checked = !!state.roomData?.sheriffKillsNeutralEvil;
        }
      });
    });

    document.getElementById('toggle-officer-kills-neutral-evil').addEventListener('change', (event) => {
      state.socket.emit('update-room-settings', { officerKillsNeutralEvil: event.target.checked }, (response) => {
        if (!response.success) {
          showToast(response.error || 'Could not update room settings', 'error');
          event.target.checked = !!state.roomData?.officerKillsNeutralEvil;
        }
      });
    });

    const roomSettingsExpandBtn = document.getElementById('btn-room-settings-fullscreen');
    if (roomSettingsExpandBtn) {
      roomSettingsExpandBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setRoomSettingsFullscreen(true);
      });
    }

    const roomSettingsCloseBtn = document.getElementById('btn-room-settings-close');
    if (roomSettingsCloseBtn) {
      roomSettingsCloseBtn.addEventListener('click', () => {
        setRoomSettingsFullscreen(false);
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.roomSettingsFullscreenOpen) {
        setRoomSettingsFullscreen(false);
      }
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
      state.selectedTargets = [];
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

    document.getElementById('btn-return-lobby').addEventListener('click', () => {
      const button = document.getElementById('btn-return-lobby');
      if (!button) return;
      button.disabled = true;
      button.textContent = 'Returning...';
      state.socket.emit('return-to-lobby', (response) => {
        if (!response?.success) {
          showToast(response?.error || 'Could not return to lobby', 'error');
          button.disabled = false;
          button.innerHTML = '<span>RETURN TO LOBBY</span>';
        }
      });
    });

  }

  function init() {
    const profile = loadProfile();
    state.playerId = getOrCreatePlayerSessionId();
    state.username = profile.name;
    state.selectedAvatarIndex = profile.avatarIndex;
    state.selectedNameColorHex = sanitizePlayerColorHex(profile.colorHex || profile.colorHue, PLAYER_NAME_PALETTE[0].value);
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
    const activeRole = getActiveNightRole(player);

    if (
      activeRole === 'Villager'
      || activeRole === 'Jester'
      || activeRole === 'Executioner'
      || activeRole === 'Karma'
      || activeRole === 'Inquisitor'
      || activeRole === 'Narcissist'
      || (activeRole === 'Guardian Angel' && (player.guardianAngelUsesRemaining ?? 4) <= 0)
      || (activeRole === 'Oracle' && (player.oracleEvilEyeUsesRemaining ?? 3) <= 0)
      || (activeRole === 'Survivalist' && (player.survivalistUsesRemaining ?? 4) <= 0)
      || (activeRole === 'Veteran' && (player.veteranUsesRemaining ?? 4) <= 0)
      || (activeRole === 'Mirror Caster' && (player.mirrorUsesRemaining ?? 4) <= 0)
    ) {
      const amnesiacTargets = activeRole === 'Amnesiac' ? getAmnesiacTargets() : [];
      if (activeRole === 'Amnesiac' && amnesiacTargets.length > 0) {
        // Fall through to the interactive panel when there are dead roles to inherit.
      } else {
      const executionerTargetPlayer = state.roomData?.players?.find((candidate) => candidate.id === player.executionerTargetId);
      const executionerTargetStyle = executionerTargetPlayer
        ? getPlayerChatStyle({ type: 'player', senderId: executionerTargetPlayer.id, senderName: executionerTargetPlayer.name, colorHex: executionerTargetPlayer.colorHex })
        : '';
      const guardianAngelTargetPlayer = state.roomData?.players?.find((candidate) => candidate.id === player.guardianAngelTargetId);
      const guardianAngelTargetStyle = guardianAngelTargetPlayer
        ? getPlayerChatStyle({ type: 'player', senderId: guardianAngelTargetPlayer.id, senderName: guardianAngelTargetPlayer.name, colorHex: guardianAngelTargetPlayer.colorHex })
        : '';
      const pinnedWaitingTargets = activeRole === 'Executioner' && player.executionerTargetId
        ? getTargetPlayers().filter((target) => target.id === player.executionerTargetId)
        : activeRole === 'Guardian Angel' && player.guardianAngelTargetId
          ? getTargetPlayers().filter((target) => target.id === player.guardianAngelTargetId)
          : [];
      const waitingSubtext = activeRole === 'Executioner' && player.executionerTargetName
        ? `Your target is <span class="chat-player-ref"${executionerTargetStyle ? ` style="${executionerTargetStyle}"` : ''}>${escapeHtml(player.executionerTargetName)}</span>. Get them voted out.`
        : activeRole === 'Guardian Angel' && player.guardianAngelTargetName
          ? `Your target is <span class="chat-player-ref"${guardianAngelTargetStyle ? ` style="${guardianAngelTargetStyle}"` : ''}>${escapeHtml(player.guardianAngelTargetName)}</span>${player.guardianAngelTargetRole ? `, the <span class="roles-guide-ability-highlight">${escapeHtml(player.guardianAngelTargetRole)}</span>` : ''}. Your blessings are spent, so watch over them from the sidelines.`
        : activeRole === 'Oracle'
          ? 'Your Evil Eye uses are spent. Wait for dawn and save Purify for the vote.'
        : activeRole === 'Survivalist'
          ? 'Your Lifeguard uses are spent. Survive with your wits from here.'
        : activeRole === 'Amnesiac'
          ? 'No dead players can be remembered yet. Wait for dawn...'
          : 'You have no abilities. Wait for dawn...';
      container.innerHTML = `<div class="waiting-panel"><div class="waiting-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></div><p class="waiting-text">THE NIGHT IS DARK</p><p class="waiting-subtext">${waitingSubtext}</p>${pinnedWaitingTargets.length ? `<div class="target-list chat-target-list waiting-target-list">${pinnedWaitingTargets.map((t) => `<div class="target-item target-static" data-target="${t.id}">${renderAvatarMarkup(t.id || t.name, 'target-avatar', t.avatarIndex)}<span class="target-name">${t.name}</span>${renderPinnedTargetBadge(player, activeRole, t.id)}</div>`).join('')}</div>` : ''}</div><div id="phase-chat-panel"></div>`;
      renderChatBox();
      return;
      }
    }

    if (state.hasActed) {
      container.innerHTML = '<div class="action-confirmed"><div class="confirmed-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><p class="confirmed-text">ACTION SUBMITTED</p><p class="confirmed-detail">Waiting for others...</p></div><div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }

    const targets = activeRole === 'Amnesiac' ? getAmnesiacTargets() : getTargetPlayers();
    const imitatorTargets = player.role === 'Imitator' && !player.imitatorCopiedRole
      ? targets.filter((target) => (player.imitatorAvailableTargetIds || []).includes(target.id))
      : [];
    const isAssassin = player.faction === 'Assassin' && activeRole !== 'Imitator';
    const actionClass = isAssassin ? 'assassin-action' : '';
    const targetClass = isAssassin ? 'assassin-target' : '';
    const guardianAngelTargetPlayer = state.roomData?.players?.find((candidate) => candidate.id === player.guardianAngelTargetId);
    const guardianAngelTargetStyle = guardianAngelTargetPlayer
      ? getPlayerChatStyle({ type: 'player', senderId: guardianAngelTargetPlayer.id, senderName: guardianAngelTargetPlayer.name, colorHex: guardianAngelTargetPlayer.colorHex })
      : '';

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
    state.chatOverlayOpen = false;
    state.forceExpandedNightChat = false;
    const overlay = document.getElementById('chat-fullscreen-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      overlay.innerHTML = '';
    }
    container.innerHTML = `
      <div class="morning-chat-intro">
        <div class="action-title">MORNING DISCUSSION</div>
        <div class="action-subtitle">Use the chat to discuss what happened during the night before voting begins.</div>
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
    const player = state.playerData;
    const canPurify = player?.role === 'Oracle' && (player.oraclePurifyUsesRemaining ?? 2) > 0 && !player.oraclePurifiedTargetId;
    if (state.hasVoted && !canPurify) {
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

  function canUseAssassinChat() {
    return state.playerData?.faction === 'Assassin' && state.playerData?.alive !== false;
  }

  function canUseJailChat() {
    return state.playerData?.alive !== false && (!!state.playerData?.isJailed || !!state.playerData?.officerJailedTargetId);
  }

  function canUseAbyssChat() {
    return state.gamePhase === 'night' && !!state.playerData?.abyssAvailable;
  }

  function getActiveChatChannel() {
    if (state.currentChatChannel === 'assassin' && canUseAssassinChat()) return 'assassin';
    if (state.currentChatChannel === 'jail' && canUseJailChat()) return 'jail';
    if (state.currentChatChannel === 'abyss' && canUseAbyssChat()) return 'abyss';
    return 'public';
  }

  function getRenderableChatMessages(channel = 'public') {
    if (channel === 'assassin') {
      return [...(state.assassinChatMessages || [])].sort((a, b) => a.createdAt - b.createdAt);
    }
    if (channel === 'jail') {
      return [...(state.jailChatMessages || [])].sort((a, b) => a.createdAt - b.createdAt);
    }
    if (channel === 'abyss') {
      return [...(state.abyssChatMessages || [])].sort((a, b) => a.createdAt - b.createdAt);
    }

    const viewerIsDead = state.playerData?.alive === false;
    return [...(state.chatMessages || []), ...(state.privateChatMessages || [])]
      .filter((message) => {
        if (viewerIsDead) return true;
        if (message.type !== 'player') return true;
        const sender = state.roomData?.players?.find((candidate) => candidate.id === message.senderId);
        const senderAlive = sender ? sender.alive : message.senderAlive;
        return senderAlive !== false;
      })
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function getChatItemsMarkup(messages) {
    return messages.length
      ? messages.map((message) => {
        const isSelf = message.senderId === state.playerId;
        const sender = state.roomData?.players?.find((candidate) => candidate.id === message.senderId);
        const senderIsDead = message.type === 'player' && ((sender ? sender.alive : message.senderAlive) === false);
        const variantClass = getSystemMessageVariantClass(message);
        const phaseClass = message.type === 'system' && message.phase && !variantClass ? ` phase-${message.phase}` : '';
        const summaryClass = message.type === 'system' && message.summaryTitle ? ' phase-summary' : '';
        const classes = `chat-message ${message.type === 'system' ? 'system' : 'player'}${phaseClass}${summaryClass}${message.private ? ' private' : ''}${variantClass}${isSelf ? ' self' : ''}${senderIsDead ? ' sender-dead' : ''}`;
        const senderLabel = message.type === 'system' ? (message.senderName || 'SYSTEM') : message.senderName;
        const style = getPlayerChatStyle(message, {
          useSenderPalette: getChatMode() === 'lobby' && message.type === 'player',
        });
        return `
          <div class="${classes}"${style ? ` style="${style}"` : ''}>
            <div class="chat-message-meta">${senderLabel}</div>
            <div class="chat-message-text">${formatChatMessageHtml(message)}</div>
          </div>`;
      }).join('')
      : '<div class="chat-empty">No messages yet.</div>';
  }

  function syncChatDraftFromDom() {
    const inlineInput = document.getElementById('chat-input');
    if (inlineInput) setChatDraftValue(false, getActiveChatChannel(), inlineInput.value);

    const overlayInput = document.getElementById('chat-overlay-input');
    if (overlayInput) setChatDraftValue(true, getActiveChatChannel(), overlayInput.value);
  }

  function getChatDraftValue(isOverlayForm, channel) {
    if (channel === 'assassin') {
      return isOverlayForm ? (state.assassinChatOverlayDraft || '') : (state.assassinChatDraft || '');
    }
    if (channel === 'jail') {
      return isOverlayForm ? (state.jailChatOverlayDraft || '') : (state.jailChatDraft || '');
    }
    if (channel === 'abyss') {
      return isOverlayForm ? (state.abyssChatOverlayDraft || '') : (state.abyssChatDraft || '');
    }
    return isOverlayForm ? (state.chatOverlayDraft || '') : (state.chatDraft || '');
  }

  function setChatDraftValue(isOverlayForm, channel, value) {
    if (channel === 'assassin') {
      if (isOverlayForm) state.assassinChatOverlayDraft = value;
      else state.assassinChatDraft = value;
      return;
    }
    if (channel === 'jail') {
      if (isOverlayForm) state.jailChatOverlayDraft = value;
      else state.jailChatDraft = value;
      return;
    }
    if (channel === 'abyss') {
      if (isOverlayForm) state.abyssChatOverlayDraft = value;
      else state.abyssChatDraft = value;
      return;
    }
    if (isOverlayForm) state.chatOverlayDraft = value;
    else state.chatDraft = value;
  }

  function setAllChatDraftValues(channel, value) {
    if (channel === 'assassin') {
      state.assassinChatDraft = value;
      state.assassinChatOverlayDraft = value;
      return;
    }
    if (channel === 'jail') {
      state.jailChatDraft = value;
      state.jailChatOverlayDraft = value;
      return;
    }
    if (channel === 'abyss') {
      state.abyssChatDraft = value;
      state.abyssChatOverlayDraft = value;
      return;
    }
    state.chatDraft = value;
    state.chatOverlayDraft = value;
  }

  function syncChatDraftForInput(input, isOverlayForm, channel) {
    if (!input) return;
    setChatDraftValue(isOverlayForm, channel, input.value);
  }

  function bindChatComposer(form, canChat, channel = 'public') {
    if (!form || !canChat) return;

    const isOverlayForm = form.id === 'chat-overlay-form';
    const input = form.querySelector('.chat-input');

    if (input) {
      const syncDraft = () => syncChatDraftForInput(input, isOverlayForm, channel);
      const deferredSyncDraft = () => window.requestAnimationFrame(syncDraft);

      input.addEventListener('input', syncDraft);
      input.addEventListener('change', syncDraft);
      input.addEventListener('blur', syncDraft);
      input.addEventListener('keyup', syncDraft);
      input.addEventListener('compositionend', syncDraft);
      input.addEventListener('beforeinput', deferredSyncDraft);
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      syncChatDraftForInput(input, isOverlayForm, channel);
      const text = input ? input.value.trim() : '';
      if (!text) return;

      const eventName = channel === 'assassin'
        ? 'send-assassin-chat-message'
        : channel === 'jail'
          ? 'send-jail-chat-message'
          : channel === 'abyss'
            ? 'send-abyss-chat-message'
          : 'send-chat-message';
      const previousText = text;
      if (input) input.value = '';
      setAllChatDraftValues(channel, '');
      state.socket.emit(eventName, { text }, (response) => {
        if (response.success) {
          setAllChatDraftValues(channel, '');
        } else {
          if (input) input.value = previousText;
          setAllChatDraftValues(channel, previousText);
          showToast(response.error || 'Message failed to send', 'error');
        }
      });
    });
  }

  function bindChatChannelTabs(root) {
    if (!root) return;
    root.querySelectorAll('[data-chat-channel]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const nextChannel = button.dataset.chatChannel || 'public';
        if (nextChannel === state.currentChatChannel) return;
        state.currentChatChannel = nextChannel;
        renderChatBox();
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
    syncChatDraftFromDom();

    const panel = getActiveChatPanel();
    if (!panel) return;

    const mode = getChatMode();
    const activeChannel = getActiveChatChannel();
    const assassinChatAvailable = canUseAssassinChat();
    const jailChatAvailable = canUseJailChat();
    const abyssChatAvailable = canUseAbyssChat();
    const canPublicChat = (
      mode === 'lobby'
      || mode === 'morning'
      || mode === 'voting'
      || (mode === 'night' && (state.playerData?.alive === false || canUseNightPublicChat(state.playerData)))
    ) && !state.playerData?.isBlackmailed && !state.playerData?.isSilenced && !state.playerData?.isJailed;
    const canAssassinChat = assassinChatAvailable && mode !== 'hidden' && mode !== 'ended' && !state.playerData?.isBlackmailed && !state.playerData?.isSilenced;
    const canJailChat = jailChatAvailable && mode !== 'hidden' && mode !== 'ended';
    const canAbyssChat = abyssChatAvailable && mode === 'night' && mode !== 'hidden' && mode !== 'ended';
    const canChat = activeChannel === 'assassin'
      ? canAssassinChat
      : activeChannel === 'jail'
        ? canJailChat
        : activeChannel === 'abyss'
          ? canAbyssChat
          : canPublicChat;
    const isDaytimeInline = mode === 'lobby' || mode === 'morning';
    const isDaytimeFullscreen = isDaytimeInline && state.chatOverlayOpen;
    const isDeadSpectator = state.playerData?.alive === false;
    const isJailedPlayer = !!state.playerData?.isJailed;
    const isForcedExpandedNight = mode === 'night'
      && !state.chatOverlayOpen
      && (!!state.forceExpandedNightChat || isDeadSpectator || isJailedPlayer);
    const isExpandedMode = (isDaytimeInline && !isDaytimeFullscreen) || isForcedExpandedNight;
    const isDockedMode = mode !== 'hidden' && !isExpandedMode;
    const isOverlayOpen = state.chatOverlayOpen;
    const subtitle = activeChannel === 'assassin'
      ? (canAssassinChat
        ? 'Private assassin coordination.'
        : state.playerData?.isBlackmailed
          ? 'You have been blackmailed'
          : state.playerData?.isSilenced
            ? 'You have been silenced'
            : 'Assassin chat is unavailable.')
      : activeChannel === 'jail'
        ? (canJailChat
          ? (state.playerData?.isJailed ? 'Speak privately with the Officer.' : 'Speak privately with your prisoner.')
          : 'Jail chat is unavailable.')
      : activeChannel === 'abyss'
        ? (canAbyssChat
          ? (state.playerData?.alive === false ? 'Speak with the Medium from beyond the veil.' : 'Speak with the dead through the Abyss.')
          : 'Abyss chat is unavailable.')
      : (canPublicChat
        ? (mode === 'lobby' ? 'Chat before the game starts.' : 'Chat is open for discussion.')
        : mode === 'readonly'
          ? 'Waiting for the next phase...'
          : state.playerData?.isBlackmailed
            ? 'You have been blackmailed'
            : state.playerData?.isSilenced
              ? 'You have been silenced'
              : 'Chat is visible but locked until morning.');
    const gameContainer = document.querySelector('.game-container');
    const messages = getRenderableChatMessages(activeChannel);
    const overlay = ensureChatOverlay();
    const isStandaloneOverlay = isOverlayOpen;
    panel.className = `phase-chat-panel ${isStandaloneOverlay ? 'chat-overlay-anchor' : isOverlayOpen ? 'chat-expanded' : 'chat-compact'}${canChat ? '' : ' chat-locked'}${isDockedMode ? ' chat-docked-mode' : ''}${isDeadSpectator ? ' chat-dead' : ''}${activeChannel === 'assassin' ? ' chat-channel-assassin' : ''}${activeChannel === 'jail' ? ' chat-channel-jail' : ''}${activeChannel === 'abyss' ? ' chat-channel-abyss' : ''}${mode === 'lobby' ? ' chat-lobby room-chat-panel' : ''}${mode === 'morning' ? ' chat-morning' : ''}${mode === 'night' && isExpandedMode ? ' chat-night-expanded' : ''}`;
    if (gameContainer) {
      gameContainer.classList.toggle('chat-overlay-active', isStandaloneOverlay);
    }
    overlay.classList.toggle('active', isStandaloneOverlay);
    overlay.classList.toggle('lobby-chat-fullscreen', mode === 'lobby' && isStandaloneOverlay);

    if (mode === 'hidden') {
      panel.innerHTML = '';
      overlay.innerHTML = '';
      return;
    }

    const channelTabs = [`<button class="chat-channel-tab${activeChannel === 'public' ? ' active' : ''}" data-chat-channel="public" type="button">Public</button>`];
    if (assassinChatAvailable) {
      channelTabs.push(`<button class="chat-channel-tab${activeChannel === 'assassin' ? ' active' : ''}" data-chat-channel="assassin" type="button">Assassin</button>`);
    }
    if (jailChatAvailable) {
      channelTabs.push(`<button class="chat-channel-tab${activeChannel === 'jail' ? ' active' : ''}" data-chat-channel="jail" type="button">Jail</button>`);
    }
    if (abyssChatAvailable) {
      channelTabs.push(`<button class="chat-channel-tab${activeChannel === 'abyss' ? ' active' : ''}" data-chat-channel="abyss" type="button">Abyss</button>`);
    }
    const tabsMarkup = channelTabs.length > 1 ? `<div class="chat-channel-tabs">${channelTabs.join('')}</div>` : '';

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
            <span class="chat-dock-title">${activeChannel === 'assassin' ? 'Open Assassin Chat' : activeChannel === 'jail' ? 'Open Jail Chat' : activeChannel === 'abyss' ? 'Open Abyss Chat' : 'Open Chat'}</span>
            <span class="chat-dock-subtitle">${activeChannel === 'assassin' ? (canAssassinChat ? 'Private assassin coordination' : 'Assassin chat unavailable') : activeChannel === 'jail' ? (canJailChat ? 'Private jail discussion' : 'Jail chat unavailable') : activeChannel === 'abyss' ? (canAbyssChat ? 'Private channel to the dead' : 'Abyss chat unavailable') : canPublicChat ? 'Discussion and actions' : state.playerData?.isBlackmailed ? 'You have been blackmailed' : state.playerData?.isSilenced ? 'You have been silenced' : state.playerData?.isJailed ? 'Public chat disabled while jailed' : 'View updates'}</span>
          </span>
        </button>`;
      const openBtn = panel.querySelector('#chat-open-btn');
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
        <div class="chat-fullscreen-shell${canChat ? '' : ' chat-locked'}${isDeadSpectator ? ' chat-dead' : ''}${activeChannel === 'assassin' ? ' chat-channel-assassin' : ''}${activeChannel === 'jail' ? ' chat-channel-jail' : ''}${activeChannel === 'abyss' ? ' chat-channel-abyss' : ''}${mode === 'lobby' ? ' chat-lobby' : ''}">
          ${localPanel}
          <div class="chat-panel-header">
            <div>
              <div class="chat-panel-title">${activeChannel === 'assassin' ? 'Assassin Chat' : activeChannel === 'jail' ? 'Jail Chat' : activeChannel === 'abyss' ? 'Abyss Chat' : 'Room Chat'}</div>
              <div class="chat-panel-subtitle">${subtitle}</div>
            </div>
            <div class="chat-header-actions">
              <button class="chat-close-btn" id="chat-overlay-close-btn" type="button">Close</button>
            </div>
          </div>
          ${tabsMarkup}
          <div class="chat-messages" id="chat-overlay-messages">${items}</div>
          <form class="chat-input-row" id="chat-overlay-form">
            <input
              id="chat-overlay-input"
              class="chat-input"
              type="text"
              maxlength="280"
              value="${escapeHtml(getChatDraftValue(true, activeChannel))}"
              placeholder="${state.playerData?.isBlackmailed ? 'You have been blackmailed' : state.playerData?.isSilenced ? 'You have been silenced' : canChat ? `Message ${activeChannel === 'assassin' ? 'the assassins' : activeChannel === 'jail' ? 'the jail' : 'the room'}...` : activeChannel === 'assassin' ? 'Assassin chat unavailable' : activeChannel === 'jail' ? 'Jail chat unavailable' : state.playerData?.isJailed ? 'Public chat disabled while jailed' : 'Chat is locked at night'}"
              ${canChat ? '' : 'disabled'}
            />
            <button class="btn btn-primary chat-send-btn" type="submit" ${canChat ? '' : 'disabled'}>Send</button>
          </form>
        </div>`;

      const overlayMessages = overlay.querySelector('#chat-overlay-messages');
      if (overlayMessages) overlayMessages.scrollTop = overlayMessages.scrollHeight;

      const overlayCloseBtn = overlay.querySelector('#chat-overlay-close-btn');
      if (overlayCloseBtn) {
        overlayCloseBtn.addEventListener('click', () => {
          state.chatOverlayOpen = false;
          renderChatBox();
        });
      }

      bindChatChannelTabs(overlay);
      bindChatComposer(overlay.querySelector('#chat-overlay-form'), canChat, activeChannel);
      return;
    }

    overlay.innerHTML = '';

    panel.innerHTML = `
      ${localPanel}
      <div class="chat-panel-header">
        <div>
          <div class="chat-panel-title">${activeChannel === 'assassin' ? 'Assassin Chat' : activeChannel === 'jail' ? 'Jail Chat' : activeChannel === 'abyss' ? 'Abyss Chat' : 'Room Chat'}</div>
          <div class="chat-panel-subtitle">${subtitle}</div>
        </div>
        <div class="chat-header-actions">
          ${(mode === 'morning' || mode === 'lobby') && !isOverlayOpen ? '<button class="chat-fullscreen-btn" id="chat-fullscreen-btn" type="button">Fullscreen</button>' : ''}
          ${isDockedMode ? '<button class="chat-close-btn" id="chat-close-btn" type="button">Close</button>' : ''}
        </div>
      </div>
      ${tabsMarkup}
      <div class="chat-messages" id="chat-messages">${items}</div>
      <form class="chat-input-row" id="chat-form">
        <input
          id="chat-input"
          class="chat-input"
          type="text"
          maxlength="280"
          value="${escapeHtml(getChatDraftValue(false, activeChannel))}"
          placeholder="${state.playerData?.isBlackmailed ? 'You have been blackmailed' : state.playerData?.isSilenced ? 'You have been silenced' : canChat ? `Message ${activeChannel === 'assassin' ? 'the assassins' : activeChannel === 'jail' ? 'the jail' : 'the room'}...` : activeChannel === 'assassin' ? 'Assassin chat unavailable' : activeChannel === 'jail' ? 'Jail chat unavailable' : state.playerData?.isJailed ? 'Public chat disabled while jailed' : 'Chat is locked at night'}"
          ${canChat ? '' : 'disabled'}
        />
        <button class="btn btn-primary chat-send-btn" type="submit" ${canChat ? '' : 'disabled'}>Send</button>
      </form>`;

    const chatMessages = panel.querySelector('#chat-messages');
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;

    const fullscreenBtn = panel.querySelector('#chat-fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        state.chatOverlayOpen = true;
        renderChatBox();
      });
    }

    const closeBtn = panel.querySelector('#chat-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        state.chatOverlayOpen = false;
        renderChatBox();
      });
    }

    bindChatChannelTabs(panel);
    bindChatComposer(panel.querySelector('#chat-form'), canChat, activeChannel);
  }

  function renderGameContent(phase) {
    const content = document.getElementById('game-content');
    const messages = document.getElementById('game-messages');
    content.style.display = 'flex';
    messages.style.display = 'none';
    state.forceExpandedNightChat = false;

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
    const activeRole = getActiveNightRole(player);
    if (player.isJailed) {
      container.innerHTML = '<div class="waiting-panel"><div class="waiting-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/></svg></div><p class="waiting-text">YOU ARE JAILED</p><p class="waiting-subtext">You cannot act or use public chat while detained. Use Jail chat instead.</p></div><div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }
    const shouldUseExpandedSelfNightChat = activeRole === 'Veteran'
      || activeRole === 'Survivalist'
      || activeRole === 'Guardian Angel'
      || activeRole === 'Medium'
      || (activeRole === 'Blackout' && state.selectedAction === 'flash')
      || (activeRole === 'The Purge' && state.selectedAction === 'fascism');

    if (
      player.role === 'Villager'
      || player.role === 'Jester'
      || player.role === 'Executioner'
      || player.role === 'Amnesiac'
      || player.role === 'Redflag'
      || player.role === 'Karma'
      || player.role === 'Inquisitor'
      || activeRole === 'Lawyer'
      || player.role === 'Scientist'
      || player.role === 'Swapper'
      || player.role === 'Mayor'
      || (activeRole === 'Medium' && (player.mediumMediateUsesRemaining ?? 3) <= 0)
      || player.role === 'Alturist'
      || (player.role === 'The Vessel' && !player.vesselAwakened)
      || player.role === 'Narcissist'
      || (player.role === 'Veteran' && (player.veteranUsesRemaining ?? 4) <= 0)
      || (player.role === 'Mirror Caster' && (player.mirrorUsesRemaining ?? 4) <= 0)
    ) {
      const deadTargets = player.role === 'Amnesiac' || player.role === 'Alturist' ? getDeadTargets() : [];
      if ((player.role === 'Amnesiac' || player.role === 'Alturist') && deadTargets.length > 0) {
        // Fall through so Amnesiac or Alturist can use a dead-player action.
      } else {
      const executionerTargetPlayer = state.roomData?.players?.find((candidate) => candidate.id === player.executionerTargetId);
      const executionerTargetStyle = executionerTargetPlayer
        ? getPlayerChatStyle({ type: 'player', senderId: executionerTargetPlayer.id, senderName: executionerTargetPlayer.name, colorHex: executionerTargetPlayer.colorHex })
        : '';
      const waitingSubtext = player.role === 'Executioner' && player.executionerTargetName
        ? 'Wait for dawn...'
        : player.role === 'Amnesiac'
          ? 'No dead players can be remembered yet. Wait for dawn...'
        : player.role === 'Scientist'
          ? 'Your experiment can only be used during voting. Wait for dawn...'
        : activeRole === 'Lawyer'
          ? 'Your case is built during voting. Wait for dawn...'
        : player.role === 'Swapper'
            ? 'Your swap can only be used during voting. Wait for dawn...'
          : player.role === 'Mayor'
            ? 'Your corruption is saved for voting. Wait for dawn...'
          : activeRole === 'Medium'
            ? 'You have no Mediate uses left. Wait for dawn...'
          : player.role === 'Alturist'
            ? 'No dead players can be revived yet. Wait for dawn...'
            : player.role === 'The Vessel'
              ? 'Your Kill is locked. Wait for dawn...'
          : 'You have no abilities. Wait for dawn...';
      state.forceExpandedNightChat = true;
      container.innerHTML = `<div class="waiting-panel"><div class="waiting-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></div><p class="waiting-text">THE NIGHT IS DARK</p><p class="waiting-subtext">${waitingSubtext}</p></div><div id="phase-chat-panel"></div>`;
      renderChatBox();
      return;
      }
    }

    const imitatorTargets = player.role === 'Imitator' && !player.imitatorCopiedRole
      ? getTargetPlayers().filter((target) => (player.imitatorAvailableTargetIds || []).includes(target.id))
      : [];
    if (player.role === 'Imitator' && !player.imitatorCopiedRole && imitatorTargets.length === 0) {
      state.forceExpandedNightChat = true;
      container.innerHTML = '<div class="waiting-panel"><div class="waiting-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></div><p class="waiting-text">THE NIGHT IS DARK</p><p class="waiting-subtext">No roles can be copied tonight. Wait for dawn...</p></div><div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }

    if (shouldUseExpandedSelfNightChat) {
      state.forceExpandedNightChat = true;
    }

    if (state.hasActed) {
      container.innerHTML = '<div class="action-confirmed"><div class="confirmed-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><p class="confirmed-text">ACTION SUBMITTED</p><p class="confirmed-detail">Waiting for others...</p></div><div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }

    const targets = player.role === 'Amnesiac' || player.role === 'Alturist'
      ? getDeadTargets()
      : getTargetPlayers();
    const isAssassin = player.faction === 'Assassin';
    const actionClass = isAssassin ? 'assassin-action' : '';
    const targetClass = isAssassin ? 'assassin-target' : '';
    const investigatorLockedTargetId = activeRole === 'Investigator'
      && Array.isArray(player.lastInvestigatorTargets)
      && player.lastInvestigatorTargets.length >= 2
      && player.lastInvestigatorTargets[0] === player.lastInvestigatorTargets[1]
      ? player.lastInvestigatorTargets[0]
      : null;
    const trackerLockedTargetId = activeRole === 'Tracker'
      ? player.lastTrackerTarget
      : null;
    const stalkerLockedTargetId = activeRole === 'Stalker'
      ? player.lastStalkerTarget
      : null;
    const tetherhexLockedTargetId = activeRole === 'Tetherhex' && state.selectedAction === 'interlinked'
      && Array.isArray(player.lastTetherhexTargets)
      && player.lastTetherhexTargets.length >= 2
      && player.lastTetherhexTargets[0] === player.lastTetherhexTargets[1]
      ? player.lastTetherhexTargets[0]
      : null;
    const silencerLockedTargetId = activeRole === 'Silencer'
      ? player.lastSilencerTarget
      : null;
    const magicianLockedTargetId = activeRole === 'Magician'
      ? player.lastMagicianTarget
      : null;
    const hypnoticLockedTargetId = activeRole === 'Hypnotic' && state.selectedAction === 'trance'
      ? player.lastHypnoticTarget
      : null;
    const overloadLockedTargetId = activeRole === 'Overload' && state.selectedAction === 'malware'
      ? player.lastOverloadTarget
      : null;
    const arsonistDousedTargetIds = activeRole === 'Arsonist'
      ? (Array.isArray(player.arsonistDousedTargetIds) ? player.arsonistDousedTargetIds : [])
      : [];
    const witherKnownInfectedIds = activeRole === 'Wither'
      ? (Array.isArray(player.witherKnownInfectedIds) ? player.witherKnownInfectedIds : [])
      : [];
    const aceOfBladesKillsAvailable = activeRole === 'Ace of Blades'
      ? Math.max(0, Number(player.aceOfBladesKillsAvailable) || 0)
      : 0;
    const psychopathKillsAvailable = activeRole === 'Psychopath'
      ? Math.max(1, Math.min(3, Number(player.psychopathKillsAvailable) || 1))
      : 1;
    const psychopathStoredKills = activeRole === 'Psychopath'
      ? Math.max(0, Number(player.psychopathStoredKills) || 0)
      : 0;
    const aceOfBladesNeedsRoll = activeRole === 'Ace of Blades' && aceOfBladesKillsAvailable <= 0;
    const aceOfBladesRollAnimating = activeRole === 'Ace of Blades' && !!state.aceOfBladesRollAnimation;
    const aceOfBladesRollPhase = aceOfBladesRollAnimating ? (state.aceOfBladesRollAnimation?.phase || 'spinning') : null;
    const aceOfBladesRollResult = aceOfBladesRollAnimating ? Number(state.aceOfBladesRollAnimation?.result) || 1 : 1;
    const arsonistCanIgniteTonight = activeRole === 'Arsonist' && arsonistDousedTargetIds.length > 0;
    const officerHasPrisoner = activeRole === 'Officer' && !!player.officerJailedTargetId;
    const officerVerdictAvailable = activeRole === 'Officer' && !!player.officerVerdictAvailable;
    let multiSelectedTargets = [];
    const guardianAngelFixedTargetId = activeRole === 'Guardian Angel'
      ? (player.guardianAngelTargetId || null)
      : null;
    const guardianAngelTargetPlayer = guardianAngelFixedTargetId
      ? state.roomData?.players?.find((candidate) => candidate.id === guardianAngelFixedTargetId)
      : null;
    const guardianAngelTargetStyle = guardianAngelTargetPlayer
      ? getPlayerChatStyle({
          type: 'player',
          senderId: guardianAngelTargetPlayer.id,
          senderName: guardianAngelTargetPlayer.name,
          colorHex: guardianAngelTargetPlayer.colorHex,
        })
      : '';
    const blackoutCanFlashTonight = activeRole === 'Blackout'
      ? (player.blackoutFlashUsesRemaining ?? 3) > 0
        && !player.blackoutFlashUsedThisNight
        && player.lastBlackoutFlashNight !== ((state.roomData?.nightCount || 1) - 1)
      : false;
    const purgeCanUseFascismTonight = activeRole === 'The Purge'
      ? (player.purgeFascismUsesRemaining ?? 1) > 0
        && !player.purgeFascismUsedThisNight
      : false;

    if (activeRole === 'Tetherhex') {
      if (player.tetherhexInterlinkedUsedThisNight && state.selectedAction === 'interlinked') {
        state.selectedAction = 'kill';
        state.selectedTarget = null;
      } else if (!state.selectedAction) {
        state.selectedAction = 'kill';
      }
    }

    if (activeRole === 'Hypnotic') {
      if (player.hypnoticTranceUsedThisNight && state.selectedAction === 'trance') {
        state.selectedAction = 'kill';
        state.selectedTarget = null;
      } else if (!state.selectedAction) {
        state.selectedAction = 'kill';
      }
    }

    if (activeRole === 'Overload') {
      if (player.overloadMalwareUsedThisNight && state.selectedAction === 'malware') {
        state.selectedAction = 'kill';
        state.selectedTarget = null;
      } else if (!state.selectedAction) {
        state.selectedAction = 'kill';
      }
    }

    if (activeRole === 'Blackmailer') {
      if (player.blackmailerBlackmailUsedThisNight && state.selectedAction === 'blackmail') {
        state.selectedAction = 'kill';
        state.selectedTarget = null;
      } else if (!state.selectedAction) {
        state.selectedAction = 'kill';
      }
    }

    if (activeRole === 'Blackout') {
      if (player.blackoutFlashUsedThisNight && state.selectedAction === 'flash') {
        state.selectedAction = 'kill';
        state.selectedTarget = null;
      } else if (!state.selectedAction) {
        state.selectedAction = 'kill';
      }
    }

    if (activeRole === 'The Purge') {
      if (player.purgeFascismUsedThisNight && state.selectedAction === 'fascism') {
        state.selectedAction = 'kill';
        state.selectedTarget = null;
      } else if (!state.selectedAction) {
        state.selectedAction = 'kill';
      }
    }

    if (activeRole === 'Arsonist') {
      if (state.selectedAction === 'ignite' && !arsonistCanIgniteTonight) {
        state.selectedAction = 'douse';
      } else if (!state.selectedAction) {
        state.selectedAction = arsonistCanIgniteTonight ? 'ignite' : 'douse';
      }
    }

    if (activeRole === 'Ace of Blades') {
      if (aceOfBladesNeedsRoll) {
        state.selectedAction = 'threefold';
        state.selectedTarget = null;
        state.selectedTargets = [];
      } else {
        state.selectedAction = 'kill';
        if (aceOfBladesKillsAvailable > 1) {
          state.selectedTarget = null;
        } else if (Array.isArray(state.selectedTargets) && state.selectedTargets.length) {
          state.selectedTargets = [];
        }
      }
    }

    if (activeRole === 'Psychopath') {
      state.selectedAction = 'kill';
      if (psychopathKillsAvailable > 1) {
        state.selectedTarget = null;
      } else if (Array.isArray(state.selectedTargets) && state.selectedTargets.length) {
        state.selectedTargets = [];
      }
    }

    if (activeRole === 'Devastator' && !state.selectedAction) {
      state.selectedAction = 'kill';
    }

    if (activeRole === 'Dracula') {
      state.selectedAction = 'sire';
    }

    if (activeRole === 'Vampire') {
      state.selectedAction = 'kill';
    }

    if (activeRole === 'Officer') {
      if (officerHasPrisoner) {
        if (!officerVerdictAvailable) {
          state.selectedAction = null;
        } else if (state.selectedAction !== 'release' && state.selectedAction !== 'execute') {
          state.selectedAction = 'release';
        }
        state.selectedTarget = null;
      } else {
        state.selectedAction = 'detain';
      }
    }

    if (activeRole === 'Traplord' || activeRole === 'Teleporter' || (activeRole === 'Ace of Blades' && aceOfBladesKillsAvailable > 1) || (activeRole === 'Psychopath' && psychopathKillsAvailable > 1)) {
      state.selectedAction = 'trap';
      if (activeRole === 'Teleporter') {
        state.selectedAction = 'teleport';
      } else if (activeRole === 'Ace of Blades') {
        state.selectedAction = 'kill';
      } else if (activeRole === 'Psychopath') {
        state.selectedAction = 'kill';
      }
      if (!Array.isArray(state.selectedTargets)) {
        state.selectedTargets = [];
      } else if (activeRole === 'Teleporter') {
        state.selectedTargets = [...new Set(state.selectedTargets)].slice(-2);
      } else if (activeRole === 'Ace of Blades') {
        state.selectedTargets = [...new Set(state.selectedTargets)].slice(-aceOfBladesKillsAvailable);
      } else if (activeRole === 'Psychopath') {
        state.selectedTargets = [...new Set(state.selectedTargets)].slice(-psychopathKillsAvailable);
      }
    } else if (Array.isArray(state.selectedTargets) && state.selectedTargets.length) {
      state.selectedTargets = [];
    }

    multiSelectedTargets = (activeRole === 'Traplord' || activeRole === 'Teleporter' || (activeRole === 'Ace of Blades' && aceOfBladesKillsAvailable > 1) || (activeRole === 'Psychopath' && psychopathKillsAvailable > 1))
      ? (Array.isArray(state.selectedTargets) ? state.selectedTargets : [])
      : [];

    if (activeRole === 'Guardian Angel') {
      state.selectedAction = 'bless';
      state.selectedTarget = guardianAngelFixedTargetId;
    }

    if (activeRole === 'Sheriff' && !state.selectedAction) {
      state.selectedAction = 'shoot';
    }
    if (activeRole === 'Prophet' && !state.selectedAction) {
      state.selectedAction = 'kill';
    }
    if (activeRole === 'Prophet' && state.selectedAction === 'gospel' && (player.prophetGospelUsesRemaining ?? 2) <= 0) {
      state.selectedAction = 'kill';
    }

    if (player.role === 'Imitator' && !player.imitatorCopiedRole) {
      state.selectedAction = 'mimic';
      state.selectedTarget = state.selectedTarget && (player.imitatorAvailableTargetIds || []).includes(state.selectedTarget)
        ? state.selectedTarget
        : null;
    }

    let actionsHTML = '';
    const aceWheelHTML = activeRole === 'Ace of Blades' && (aceOfBladesNeedsRoll || aceOfBladesRollAnimating)
      ? (() => {
          const aceReelValues = [1, 2, 3, 1, 2, 3, 1, 2, 3];
          const aceReelStopIndex = aceOfBladesRollAnimating ? (6 + Math.max(0, aceOfBladesRollResult - 1)) : 1;
          return `<div class="ace-wheel-panel ${aceOfBladesRollAnimating ? 'is-spinning' : ''} ${aceOfBladesRollPhase === 'landed' ? 'is-landed' : ''}">
            <div class="ace-wheel-header">3FOLD</div>
            <div class="ace-reel-shell">
              <div class="ace-reel-window">
                <div class="ace-reel-track"${aceOfBladesRollAnimating ? ` style="--ace-reel-stop:${aceReelStopIndex};"` : ''}>
                  ${aceReelValues.map((value) => `<div class="ace-reel-row">${value}</div>`).join('')}
                </div>
                <div class="ace-reel-highlight"></div>
              </div>
              ${aceOfBladesRollPhase === 'landed' ? `<div class="ace-reel-result-burst">${aceOfBladesRollResult}</div>` : ''}
            </div>
            <div class="ace-wheel-odds"><span>1 kill 60%</span><span>2 kills 30%</span><span>3 kills 10%</span></div>
          </div>`;
        })()
      : '';
    if (activeRole === 'Sheriff') {
      actionsHTML = `<div class="action-buttons"><button class="action-btn ${state.selectedAction === 'shoot' ? 'selected' : ''}" data-action="shoot">Shoot</button><button class="action-btn ${state.selectedAction === 'search' ? 'selected' : ''}" data-action="search">Search</button></div>`;
    } else if (activeRole === 'Prophet') {
      actionsHTML = `<div class="action-buttons"><button class="action-btn ${state.selectedAction === 'kill' ? 'selected assassin-action' : ''}" data-action="kill">Kill</button><button class="action-btn ${state.selectedAction === 'gospel' ? 'selected' : ''}" data-action="gospel" ${((player.prophetGospelUsesRemaining ?? 2) <= 0) ? 'disabled' : ''}>Gospel</button></div>`;
    } else if (activeRole === 'Investigator') {
      state.selectedAction = 'examine';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="examine">Examine</button></div>';
    } else if (activeRole === 'Tracker') {
      state.selectedAction = 'track';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="track">Track</button></div>';
    } else if (activeRole === 'Stalker') {
      state.selectedAction = 'stalk';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="stalk">Stalk</button></div>';
    } else if (activeRole === 'Traplord') {
      state.selectedAction = 'trap';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="trap">Trap</button></div>';
    } else if (activeRole === 'Teleporter') {
      state.selectedAction = 'teleport';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="teleport">Teleport</button></div>';
    } else if (activeRole === 'Magician') {
      state.selectedAction = 'abracadabra';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="abracadabra">Abracadabra</button></div>';
    } else if (activeRole === 'Silencer') {
      state.selectedAction = 'quietus';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="quietus">Quietus</button></div>';
    } else if (activeRole === 'Alturist') {
      state.selectedAction = 'sacrifice';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="sacrifice">Sacrifice</button></div>';
    } else if (activeRole === 'Dracula') {
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected dracula-action" data-action="sire">Sire</button></div>';
    } else if (activeRole === 'Vampire') {
      state.selectedAction = 'kill';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected vampire-action" data-action="kill">Bite</button></div>';
    } else if (activeRole === 'The Vessel') {
      state.selectedAction = 'kill';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="kill">Kill</button></div>';
    } else if (activeRole === 'Amnesiac') {
      state.selectedAction = 'inherit';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="inherit">Inheritance</button></div>';
    } else if (activeRole === 'Guardian Angel') {
      state.selectedAction = 'bless';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="bless">Blessing</button></div>';
    } else if (activeRole === 'Survivalist') {
      state.selectedAction = 'lifeguard';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="lifeguard">Lifeguard</button></div>';
    } else if (activeRole === 'Veteran') {
      state.selectedAction = 'instinct';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="instinct">Instinct</button></div>';
    } else if (activeRole === 'Mirror Caster') {
      state.selectedAction = 'mirror';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="mirror">Mirror</button></div>';
    } else if (activeRole === 'Warden') {
      state.selectedAction = 'guard';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="guard">Guard</button></div>';
    } else if (activeRole === 'Medium') {
      state.selectedAction = 'mediate';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="mediate">Mediate</button></div>';
    } else if (activeRole === 'Officer') {
      if (officerHasPrisoner) {
        state.selectedAction = 'execute';
      } else {
        state.selectedAction = 'detain';
      }
      actionsHTML = officerHasPrisoner
        ? `<div class="action-buttons"><button class="action-btn selected" data-action="execute" ${officerVerdictAvailable ? '' : 'disabled'}>Execute</button></div>`
        : '<div class="action-buttons"><button class="action-btn selected" data-action="detain">Detain</button></div>';
    } else if (activeRole === 'Ace of Blades') {
      actionsHTML = `<div class="action-buttons"><button class="action-btn selected assassin-action" data-action="${aceOfBladesNeedsRoll ? 'threefold' : 'kill'}">${aceOfBladesNeedsRoll ? '3Fold' : 'Kill'}</button></div>${aceWheelHTML}`;
    } else if (activeRole === 'Devastator') {
      actionsHTML = `<div class="action-buttons"><button class="action-btn ${state.selectedAction === 'kill' ? 'selected assassin-action' : ''}" data-action="kill">Kill</button><button class="action-btn ${state.selectedAction === 'demolish' ? 'selected' : ''}" data-action="demolish">Demolish</button></div>`;
    } else if (activeRole === 'Psychopath') {
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected assassin-action psychopath-action" data-action="kill">Bloodbath</button></div>';
    } else if (activeRole === 'Oracle') {
      state.selectedAction = 'evil-eye';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="evil-eye">Evil Eye</button></div>';
    } else if (activeRole === 'Vitalist') {
      state.selectedAction = 'protect';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="protect">Protect</button></div>';
    } else if (activeRole === 'Tetherhex') {
      actionsHTML = `<div class="action-buttons"><button class="action-btn ${state.selectedAction === 'kill' ? 'selected' : ''}" data-action="kill">Kill</button><button class="action-btn ${state.selectedAction === 'interlinked' ? 'selected' : ''}" data-action="interlinked" ${player.tetherhexInterlinkedUsedThisNight ? 'disabled' : ''}>Interlinked</button></div>`;
    } else if (activeRole === 'Hypnotic') {
      actionsHTML = `<div class="action-buttons"><button class="action-btn ${state.selectedAction === 'kill' ? 'selected' : ''}" data-action="kill">Kill</button><button class="action-btn ${state.selectedAction === 'trance' ? 'selected' : ''}" data-action="trance" ${player.hypnoticTranceUsedThisNight ? 'disabled' : ''}>Trance</button></div>`;
    } else if (activeRole === 'Overload') {
      actionsHTML = `<div class="action-buttons"><button class="action-btn ${state.selectedAction === 'kill' ? 'selected overload-kill-action' : ''}" data-action="kill">Shutdown</button><button class="action-btn ${state.selectedAction === 'malware' ? 'selected' : ''}" data-action="malware" ${player.overloadMalwareUsedThisNight ? 'disabled' : ''}>Malware</button></div>`;
    } else if (activeRole === 'Arsonist') {
      actionsHTML = `<div class="action-buttons"><button class="action-btn ${state.selectedAction === 'douse' ? 'selected' : ''}" data-action="douse">Douse</button><button class="action-btn ${state.selectedAction === 'ignite' ? 'selected' : ''}" data-action="ignite" ${arsonistCanIgniteTonight ? '' : 'disabled'}>Ignite</button></div>`;
    } else if (activeRole === 'Wither') {
      state.selectedAction = 'infect';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="infect">Plague</button></div>';
    } else if (activeRole === 'Pestilence') {
      state.selectedAction = 'kill';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="kill">Kill</button></div>';
    } else if (activeRole === 'Blackmailer') {
      actionsHTML = `<div class="action-buttons"><button class="action-btn ${state.selectedAction === 'kill' ? 'selected' : ''}" data-action="kill">Kill</button><button class="action-btn ${state.selectedAction === 'blackmail' ? 'selected' : ''}" data-action="blackmail" ${player.blackmailerBlackmailUsedThisNight ? 'disabled' : ''}>Blackmail</button></div>`;
    } else if (activeRole === 'Blackout') {
      actionsHTML = `<div class="action-buttons"><button class="action-btn ${state.selectedAction === 'kill' ? 'selected' : ''}" data-action="kill">Kill</button><button class="action-btn ${state.selectedAction === 'flash' ? 'selected' : ''}" data-action="flash" ${blackoutCanFlashTonight ? '' : 'disabled'}>Flash</button></div>`;
    } else if (activeRole === 'The Purge') {
      actionsHTML = `<div class="action-buttons"><button class="action-btn ${state.selectedAction === 'kill' ? 'selected' : ''}" data-action="kill">Kill</button><button class="action-btn ${state.selectedAction === 'fascism' ? 'selected' : ''}" data-action="fascism" ${purgeCanUseFascismTonight ? '' : 'disabled'}>Fascism</button></div>`;
    } else if (activeRole === 'Sniper') {
      state.selectedAction = 'longshot';
      actionsHTML = `<div class="action-buttons"><button class="action-btn selected ${actionClass}" data-action="longshot">Longshot</button></div>`;
    } else if (activeRole === 'Assassin' || activeRole === 'Traitor' || activeRole === 'Disruptor' || activeRole === 'Manipulator') {
      state.selectedAction = 'kill';
      actionsHTML = `<div class="action-buttons"><button class="action-btn selected ${actionClass}" data-action="kill">Kill</button></div>`;
    } else if (player.role === 'Imitator') {
      state.selectedAction = 'mimic';
      actionsHTML = '<div class="action-buttons"><button class="action-btn selected" data-action="mimic">Mimicry</button></div>';
    }

    let actionDesc = '';
    if (activeRole === 'Sheriff') actionDesc = 'Choose to shoot or investigate a player';
    else if (activeRole === 'Prophet') actionDesc = state.selectedAction === 'gospel'
      ? ((player.prophetGospelUsesRemaining ?? 2) > 0
        ? 'Choose a player to unveil their role. Gospel can be used 2 times.'
        : 'Gospel has no uses left. Choose Kill instead.')
      : 'Eliminate a player after reading the omens.';
    else if (activeRole === 'Investigator') actionDesc = 'Choose a player to examine for recent kills';
    else if (activeRole === 'Tracker') actionDesc = 'Choose a player to track for nighttime interactions';
    else if (activeRole === 'Stalker') actionDesc = 'Choose a player to stalk for incoming interactions';
    else if (activeRole === 'Traplord') actionDesc = 'Choose at least 3 players. You will learn their roles in random order.';
    else if (activeRole === 'Teleporter') actionDesc = 'Choose exactly 2 players to swap every night interaction between them.';
    else if (activeRole === 'Magician') actionDesc = 'Choose a player to disappear for the night. They become immune to every interaction, but their own ability is blocked.';
    else if (activeRole === 'Silencer') actionDesc = 'Choose a player to silence until the next night.';
    else if (activeRole === 'Alturist') actionDesc = 'Choose a dead player to bring back. You will die in their place.';
    else if (activeRole === 'The Vessel') actionDesc = 'Choose a player to eliminate.';
    else if (activeRole === 'Amnesiac') actionDesc = 'Choose a dead player to inherit their role';
    else if (activeRole === 'Guardian Angel') actionDesc = player.guardianAngelTargetName
      ? `Protect <span class="chat-player-ref"${guardianAngelTargetStyle ? ` style="${guardianAngelTargetStyle}"` : ''}>${escapeHtml(player.guardianAngelTargetName)}</span>${player.guardianAngelTargetRole ? `, the <span class="roles-guide-ability-highlight">${escapeHtml(player.guardianAngelTargetRole)}</span>` : ''}, from death tonight.`
      : 'Protect your target from death tonight.';
    else if (activeRole === 'Survivalist') actionDesc = 'Protect yourself from death tonight.';
    else if (activeRole === 'Tetherhex') actionDesc = state.selectedAction === 'interlinked'
      ? player.tetherhexInterlinkedUsedThisNight
        ? 'Interlinked is already active for tonight. You can still follow up with Kill.'
        : 'Bind another player to your fate for this round.'
      : 'Eliminate a player while your tether is active.';
    else if (activeRole === 'Hypnotic') actionDesc = state.selectedAction === 'trance'
      ? player.hypnoticTranceUsedThisNight
        ? 'Trance is already active for tonight. You can still follow up with Kill.'
        : 'Disable a player\'s abilities for tonight.'
      : 'Eliminate a player after casting your trance.';
    else if (activeRole === 'Overload') actionDesc = state.selectedAction === 'malware'
      ? player.overloadMalwareUsedThisNight
        ? 'Malware is already active for tonight. You can still follow up with Shutdown.'
        : 'Hack a player and disable their abilities for tonight.'
      : 'Eliminate a player after injecting your malware.';
    else if (activeRole === 'Arsonist') actionDesc = state.selectedAction === 'ignite'
      ? arsonistCanIgniteTonight
        ? `Ignite every doused player at once. ${arsonistDousedTargetIds.length} target${arsonistDousedTargetIds.length === 1 ? '' : 's'} will burn tonight.`
        : 'You need at least 1 doused player before Ignite becomes available.'
      : 'Douse 1 player with gasoline tonight. Already doused players cannot be targeted again.';
    else if (activeRole === 'Ace of Blades') actionDesc = aceOfBladesNeedsRoll
      ? 'Roll 3Fold to decide how many players you can kill tonight.'
      : aceOfBladesRollAnimating
        ? 'Chance is spinning. Hold steady while the wheel decides your kill count.'
        : `Your roll gave you ${aceOfBladesKillsAvailable} kill${aceOfBladesKillsAvailable === 1 ? '' : 's'} tonight. Choose exactly ${aceOfBladesKillsAvailable} target${aceOfBladesKillsAvailable === 1 ? '' : 's'}.`;
    else if (activeRole === 'Devastator') actionDesc = state.selectedAction === 'demolish'
      ? 'Strap a player with dynamites. If anyone interacts with them tonight, both the target and the visitor die.'
      : 'Eliminate a player before the blast ever starts.';
    else if (activeRole === 'Psychopath') actionDesc = psychopathStoredKills > 0
      ? `You have ${psychopathStoredKills} stored kill${psychopathStoredKills === 1 ? '' : 's'}. Unleash up to ${psychopathKillsAvailable} kill${psychopathKillsAvailable === 1 ? '' : 's'} tonight, or skip to keep stacking.`
      : 'Skip tonight to stack a future kill, or strike now and stay on schedule.';
    else if (activeRole === 'Dracula') actionDesc = 'Bite a player tonight. Crew become your Vampire if none is alive. Everyone else dies instead.';
    else if (activeRole === 'Vampire') actionDesc = 'Bite a player tonight and feed the bloodline beside Dracula.';
    else if (activeRole === 'Wither') actionDesc = 'Infect 1 player tonight. Infected players silently spread infection through future interactions.';
    else if (activeRole === 'Pestilence') actionDesc = 'You are immortal to every kill. Choose a player to eliminate tonight.';
    else if (activeRole === 'Blackmailer') actionDesc = state.selectedAction === 'blackmail'
      ? player.blackmailerBlackmailUsedThisNight
        ? 'Blackmail is already active for tonight. You can still follow up with Kill.'
        : 'Threaten a player so they cannot chat or vote until the next night.'
      : 'Eliminate a player after delivering your threat.';
    else if (activeRole === 'Blackout') actionDesc = state.selectedAction === 'flash'
      ? player.blackoutFlashUsedThisNight
        ? 'Flash is already active for tonight. You can still follow up with Kill.'
        : blackoutCanFlashTonight
          ? 'Blind every information role tonight. Flash is targetless and can be used 3 times.'
          : 'Flash cannot be used tonight. Choose Kill instead.'
      : 'Eliminate a player after the blackout.';
    else if (activeRole === 'The Purge') actionDesc = state.selectedAction === 'fascism'
      ? player.purgeFascismUsedThisNight
        ? 'Fascism is already active for tonight. You can still follow up with Kill.'
        : purgeCanUseFascismTonight
          ? 'Take over the whole night so only assassins can use abilities. Fascism can be used once.'
          : 'Fascism cannot be used again. Choose Kill instead.'
      : 'Eliminate a player after seizing the night.';
    else if (activeRole === 'Veteran') actionDesc = 'Stand watch tonight.';
    else if (activeRole === 'Mirror Caster') actionDesc = 'Choose a player to mirror tonight';
    else if (activeRole === 'Warden') actionDesc = 'Choose a player to block all night interactions on.';
    else if (activeRole === 'Medium') actionDesc = 'Switch dimensions and open the Abyss for yourself and every dead player tonight.';
    else if (activeRole === 'Officer') actionDesc = officerHasPrisoner
      ? (player.officerJailedTargetName
        ? officerVerdictAvailable
          ? `Decide the fate of <span class="chat-player-ref">${escapeHtml(player.officerJailedTargetName)}</span>. Confirm to execute them, or skip to let them go tonight.`
          : `<span class="chat-player-ref">${escapeHtml(player.officerJailedTargetName)}</span> is jailed. You cannot execute them on the same night you detained them.`
        : 'Your prisoner is waiting for your verdict.')
      : 'Choose a player to detain. They will lose their abilities, public chat, and vote until you release them or execute them.';
    else if (activeRole === 'Oracle') actionDesc = 'Choose a player. If they die tonight, the killer will confess. Purify becomes available during voting.';
    else if (activeRole === 'Vitalist') actionDesc = 'Choose a player to protect tonight';
    else if (activeRole === 'Sniper') actionDesc = 'Mark a player with a distant shot. The bullet lands 2 rounds later.';
    else if (activeRole === 'Assassin') actionDesc = 'Choose a crew member to eliminate';
    else if (activeRole === 'Traitor') actionDesc = 'You have turned on the Crew. Choose a player to eliminate.';
    else if (activeRole === 'Disruptor') actionDesc = 'Eliminate a player at night. Veto becomes available during voting.';
    else if (activeRole === 'Manipulator') actionDesc = 'Eliminate a player at night. Surprise becomes available during voting.';
    else if (player.role === 'Imitator') actionDesc = 'Choose a living player to borrow their role for tonight.';

    const isTargetlessRole = activeRole === 'Veteran'
      || activeRole === 'Guardian Angel'
      || activeRole === 'Survivalist'
      || activeRole === 'Medium'
      || (activeRole === 'Officer' && officerHasPrisoner)
      || (activeRole === 'Ace of Blades' && (aceOfBladesNeedsRoll || aceOfBladesRollAnimating))
      || (activeRole === 'Arsonist' && state.selectedAction === 'ignite')
      || (activeRole === 'Blackout' && state.selectedAction === 'flash')
      || (activeRole === 'The Purge' && state.selectedAction === 'fascism');
    const displayedTargets = activeRole === 'Arsonist' && state.selectedAction === 'ignite'
      ? targets.filter((target) => arsonistDousedTargetIds.includes(target.id))
      : player.role === 'Imitator' && !player.imitatorCopiedRole
        ? imitatorTargets
        : targets;
    const isMultiTargetRole = activeRole === 'Traplord' || activeRole === 'Teleporter' || (activeRole === 'Ace of Blades' && aceOfBladesKillsAvailable > 1) || (activeRole === 'Psychopath' && psychopathKillsAvailable > 1);
    const requiredMultiTargetCount = activeRole === 'Teleporter'
      ? 2
      : activeRole === 'Ace of Blades'
        ? aceOfBladesKillsAvailable
        : activeRole === 'Psychopath'
          ? 1
        : 3;
    const shouldShowTargetList = (!isTargetlessRole && !aceOfBladesRollAnimating) || activeRole === 'Arsonist';
    const targetLabel = activeRole === 'Arsonist' && state.selectedAction === 'ignite'
      ? `DOUSED PLAYERS${displayedTargets.length ? ` (${displayedTargets.length})` : ''}`
      : activeRole === 'Ace of Blades'
        ? `SELECT ${aceOfBladesKillsAvailable} TARGET${aceOfBladesKillsAvailable === 1 ? '' : 'S'}${isMultiTargetRole && multiSelectedTargets.length ? ` (${multiSelectedTargets.length} SELECTED)` : ''}`
        : activeRole === 'Psychopath'
          ? `SELECT UP TO ${psychopathKillsAvailable} TARGET${psychopathKillsAvailable === 1 ? '' : 'S'}${multiSelectedTargets.length ? ` (${multiSelectedTargets.length} SELECTED)` : ''}`
      : isMultiTargetRole
        ? `${activeRole === 'Teleporter' ? 'SELECT 2 TARGETS' : 'SELECT AT LEAST 3 TARGETS'}${multiSelectedTargets.length ? ` (${multiSelectedTargets.length} SELECTED)` : ''}`
        : 'SELECT TARGET';
    container.innerHTML = `
      <div class="action-panel">
        <div class="action-title">YOUR NIGHT ACTION</div>
        <div class="action-subtitle">${actionDesc}</div>
        ${actionsHTML}
        ${shouldShowTargetList ? `
        <div class="target-label">${targetLabel}</div>
        <div class="target-list chat-target-list" id="target-list">
          ${displayedTargets.map(t => {
            const isRestricted = (activeRole === 'Vitalist' && t.id === player.lastMedicTarget)
              || (activeRole === 'Mirror Caster' && t.id === player.lastMirrorTarget)
              || (activeRole === 'Warden' && t.id === player.lastWardenTarget)
              || (activeRole === 'Magician' && t.id === magicianLockedTargetId)
              || (activeRole === 'Investigator' && t.id === investigatorLockedTargetId)
              || (activeRole === 'Tracker' && t.id === trackerLockedTargetId)
              || (activeRole === 'Stalker' && t.id === stalkerLockedTargetId)
              || (activeRole === 'Tetherhex' && t.id === tetherhexLockedTargetId)
              || (activeRole === 'Silencer' && t.id === silencerLockedTargetId)
              || (activeRole === 'Hypnotic' && t.id === hypnoticLockedTargetId)
              || (activeRole === 'Overload' && t.id === overloadLockedTargetId)
              || (activeRole === 'Arsonist' && arsonistDousedTargetIds.includes(t.id))
              || (activeRole === 'Wither' && witherKnownInfectedIds.includes(t.id))
              || t.isJailed;
            const isSelected = isMultiTargetRole
              ? multiSelectedTargets.includes(t.id)
              : state.selectedTarget === t.id;
            return `<div class="target-item ${isSelected ? `selected ${targetClass}` : ''} ${isRestricted ? 'target-restricted' : ''} ${activeRole === 'Arsonist' && arsonistDousedTargetIds.includes(t.id) ? 'target-doused' : ''} ${activeRole === 'Wither' && witherKnownInfectedIds.includes(t.id) ? 'target-infected' : ''} ${t.isJailed ? 'target-jailed' : ''} ${activeRole === 'Arsonist' && state.selectedAction === 'ignite' ? 'target-static' : ''}" data-target="${t.id}" ${isRestricted ? 'data-restricted="true"' : ''}>${renderAvatarMarkup(t.id || t.name, 'target-avatar', t.avatarIndex)}<span class="target-name">${t.name}</span>${renderPinnedTargetBadge(player, activeRole, t.id)}${activeRole === 'Arsonist' && arsonistDousedTargetIds.includes(t.id) ? '<span class="target-status target-status-doused">Doused</span>' : ''}${activeRole === 'Wither' && witherKnownInfectedIds.includes(t.id) ? '<span class="target-status target-status-infected">Infected</span>' : ''}${t.isJailed ? '<span class="target-status target-status-jailed">Jailed</span>' : ''}</div>`;
          }).join('')}
        </div>` : ''}
        <div class="chat-local-actions">
          <button class="btn ${isAssassin ? 'btn-assassin' : 'btn-crew'} confirm-action" id="btn-confirm-action" ${!state.selectedAction || (!isTargetlessRole && !isMultiTargetRole && !state.selectedTarget) || (isMultiTargetRole && multiSelectedTargets.length < requiredMultiTargetCount) || (activeRole === 'Arsonist' && state.selectedAction === 'ignite' && !arsonistCanIgniteTonight) || (activeRole === 'Blackout' && state.selectedAction === 'flash' && !blackoutCanFlashTonight) || (activeRole === 'The Purge' && state.selectedAction === 'fascism' && !purgeCanUseFascismTonight) || (activeRole === 'Officer' && officerHasPrisoner && !officerVerdictAvailable) || aceOfBladesRollAnimating ? 'disabled' : ''}>${activeRole === 'Veteran' ? `Confirm ${player.veteranUsesRemaining ?? 4}/4` : activeRole === 'Mirror Caster' ? `Confirm ${player.mirrorUsesRemaining ?? 4}/4` : activeRole === 'Guardian Angel' ? `Confirm ${player.guardianAngelUsesRemaining ?? 4}/4` : activeRole === 'Medium' ? `Confirm ${player.mediumMediateUsesRemaining ?? 3}/3` : activeRole === 'Oracle' ? `Confirm ${player.oracleEvilEyeUsesRemaining ?? 3}/3` : activeRole === 'Prophet' && state.selectedAction === 'gospel' ? `Confirm ${player.prophetGospelUsesRemaining ?? 2}/2` : activeRole === 'Survivalist' ? `Confirm ${player.survivalistUsesRemaining ?? 4}/4` : activeRole === 'Ace of Blades' && aceOfBladesNeedsRoll ? 'Roll' : activeRole === 'Ace of Blades' ? `Confirm ${isMultiTargetRole ? multiSelectedTargets.length : (state.selectedTarget ? 1 : 0)}/${aceOfBladesKillsAvailable}` : activeRole === 'Psychopath' ? `Confirm ${isMultiTargetRole ? multiSelectedTargets.length : (state.selectedTarget ? 1 : 0)}/${psychopathKillsAvailable}` : activeRole === 'Arsonist' && state.selectedAction === 'ignite' ? `Ignite ${arsonistDousedTargetIds.length}` : activeRole === 'Blackout' && state.selectedAction === 'flash' ? `Confirm ${player.blackoutFlashUsesRemaining ?? 3}/3` : activeRole === 'The Purge' && state.selectedAction === 'fascism' ? `Confirm ${player.purgeFascismUsesRemaining ?? 1}/1` : activeRole === 'Teleporter' ? `Confirm ${multiSelectedTargets.length}/2` : isMultiTargetRole ? `Confirm ${multiSelectedTargets.length}/3+` : 'Confirm'}</button>
          <button class="btn btn-ghost chat-local-skip" id="btn-skip-night">Skip</button>
        </div>
      </div>
      <div id="phase-chat-panel"></div>`;

    container.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        btn.classList.remove('action-activate');
        void btn.offsetWidth;
        btn.classList.add('action-activate');
        state.selectedAction = btn.dataset.action;
        state.selectedTarget = activeRole === 'Guardian Angel' ? guardianAngelFixedTargetId : null;
        state.selectedTargets = [];
        renderNightPhase(container);
      });
    });

    container.querySelectorAll('#target-list .target-item').forEach(item => {
      item.addEventListener('click', () => {
        if (activeRole === 'Arsonist' && state.selectedAction === 'ignite') {
          return;
        }
        if (item.dataset.restricted === 'true') {
          if (item.classList.contains('target-jailed')) {
            showToast('Jailed players cannot be targeted at night', 'error');
          } else if (activeRole === 'Investigator') {
            showToast('You cannot target the same player 3 times in a row', 'error');
          } else if (activeRole === 'Tracker') {
            showToast('You cannot target the same player twice in a row', 'error');
          } else if (activeRole === 'Stalker') {
            showToast('You cannot target the same player twice in a row', 'error');
          } else if (activeRole === 'Tetherhex') {
            showToast('You cannot target the same player 3 times in a row', 'error');
          } else if (activeRole === 'Silencer') {
            showToast('You cannot target the same player twice in a row', 'error');
          } else if (activeRole === 'Magician') {
            showToast('You cannot target the same player twice in a row', 'error');
          } else if (activeRole === 'Hypnotic') {
            showToast('You cannot target the same player twice in a row with Trance', 'error');
          } else if (activeRole === 'Overload') {
            showToast('You cannot target the same player twice in a row with Malware', 'error');
          } else if (activeRole === 'Arsonist') {
            showToast('That player is already doused', 'error');
          } else if (activeRole === 'Wither') {
            showToast('That player is already infected', 'error');
          } else if (activeRole === 'Mirror Caster') {
            showToast('You cannot target the same player twice in a row', 'error');
          } else if (activeRole === 'Warden') {
            showToast('You cannot target the same player twice in a row', 'error');
          } else {
            showToast('You cannot protect the same player two nights in a row', 'error');
          }
          return;
        }
        if (isMultiTargetRole) {
          const targetId = item.dataset.target;
          if (multiSelectedTargets.includes(targetId)) {
            state.selectedTargets = multiSelectedTargets.filter((selectedId) => selectedId !== targetId);
          } else if (activeRole === 'Teleporter') {
            state.selectedTargets = [...multiSelectedTargets.slice(-1), targetId];
          } else if (activeRole === 'Ace of Blades') {
            state.selectedTargets = [...multiSelectedTargets.slice(-(Math.max(0, requiredMultiTargetCount - 1))), targetId];
          } else if (activeRole === 'Psychopath') {
            state.selectedTargets = [...multiSelectedTargets.slice(-(Math.max(0, psychopathKillsAvailable - 1))), targetId];
          } else {
            state.selectedTargets = [...multiSelectedTargets, targetId];
          }
        } else {
          state.selectedTarget = item.dataset.target;
        }
        renderNightPhase(container);
      });
    });

    const confirmBtn = document.getElementById('btn-confirm-action');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (!state.selectedAction) return;
        if (activeRole === 'Ace of Blades' && aceOfBladesRollAnimating) return;
        if (!isTargetlessRole && !isMultiTargetRole && !state.selectedTarget) return;
        if (isMultiTargetRole && multiSelectedTargets.length < requiredMultiTargetCount) return;
        state.socket.emit('night-action', {
          action: state.selectedAction,
          targetId: isTargetlessRole || isMultiTargetRole ? null : state.selectedTarget,
          targetIds: isMultiTargetRole
            ? multiSelectedTargets
            : ((activeRole === 'Ace of Blades' || activeRole === 'Psychopath') && state.selectedAction === 'kill' && state.selectedTarget ? [state.selectedTarget] : null),
        }, (response) => {
            if (response.success) {
              if (response.player) {
                const previousPlayer = state.playerData;
                queueAmnesiacInheritanceTransition(previousPlayer, response.player);
                queueVampireTurnTransition(previousPlayer, response.player);
                state.playerData = response.player;
              state.hasActed = !!response.player.hasSubmittedAction;
              const responseActiveRole = getActiveNightRole(response.player);
              if (responseActiveRole === 'Traplord' || responseActiveRole === 'Teleporter' || responseActiveRole === 'Ace of Blades' || responseActiveRole === 'Psychopath') {
                state.selectedTargets = [];
              }
              if (responseActiveRole === 'Ace of Blades' && response.rollResult) {
                const animationToken = Date.now();
                state.aceOfBladesRollAnimation = { result: response.rollResult, token: animationToken, phase: 'spinning' };
                renderNightPhase(container);
                showToast(`3Fold rolled ${response.rollResult}`, 'info');
                window.setTimeout(() => {
                  if (state.aceOfBladesRollAnimation?.token !== animationToken) return;
                  state.aceOfBladesRollAnimation = { result: response.rollResult, token: animationToken, phase: 'landed' };
                  if (state.currentScreen === 'game' && state.gamePhase === 'night') {
                    renderNightPhase(container);
                  }
                  window.setTimeout(() => {
                    if (state.aceOfBladesRollAnimation?.token !== animationToken) return;
                    state.aceOfBladesRollAnimation = null;
                    if (state.currentScreen === 'game' && state.gamePhase === 'night') {
                      renderNightPhase(container);
                    }
                  }, 900);
                }, 5000);
                return;
              } else if (responseActiveRole !== 'Ace of Blades') {
                state.aceOfBladesRollAnimation = null;
              }
              if (response.player.role === 'Imitator' && response.player.imitatorCopiedRole) {
                state.selectedAction = null;
                state.selectedTarget = null;
              } else if (responseActiveRole === 'Blackout' && state.selectedAction === 'flash' && !response.player.hasSubmittedAction) {
                state.selectedAction = 'kill';
                state.selectedTarget = null;
              } else if (responseActiveRole === 'The Purge' && state.selectedAction === 'fascism' && !response.player.hasSubmittedAction) {
                state.selectedAction = 'kill';
                state.selectedTarget = null;
              } else if (responseActiveRole === 'Tetherhex' && state.selectedAction === 'interlinked' && !response.player.hasSubmittedAction) {
                state.selectedAction = 'kill';
                state.selectedTarget = null;
              } else if (responseActiveRole === 'Hypnotic' && state.selectedAction === 'trance' && !response.player.hasSubmittedAction) {
                state.selectedAction = 'kill';
                state.selectedTarget = null;
              } else if (responseActiveRole === 'Overload' && state.selectedAction === 'malware' && !response.player.hasSubmittedAction) {
                state.selectedAction = 'kill';
                state.selectedTarget = null;
              } else if (responseActiveRole === 'Blackmailer' && state.selectedAction === 'blackmail' && !response.player.hasSubmittedAction) {
                state.selectedAction = 'kill';
                state.selectedTarget = null;
              }
            } else {
              state.hasActed = true;
            }
            renderNightPhase(container);
            playPendingRoleInheritanceTransition();
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
    const player = state.playerData;
    if (player?.isJailed) {
      container.innerHTML = '<div class="waiting-panel"><div class="waiting-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/></svg></div><p class="waiting-text">YOU ARE JAILED</p><p class="waiting-subtext">You cannot vote or use public chat while detained. Use Jail chat instead.</p></div><div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }
    const canPurify = player?.role === 'Oracle' && (player.oraclePurifyUsesRemaining ?? 2) > 0 && !player.oraclePurifiedTargetId;
    const canObjection = player?.role === 'Lawyer' && (player.lawyerObjectionUsesRemaining ?? 2) > 0 && !player.lawyerProtectedTargetId;
    const canHearsay = player?.role === 'Lawyer' && (player.lawyerStoredVotes ?? 0) > 0;
    const canExile = player?.role === 'Inquisitor'
      && !player.inquisitorExileUsed
      && !player.inquisitorExiledTargetId;
    const canVeto = player?.role === 'Disruptor' && (player.disruptorVetoUsesRemaining ?? 1) > 0 && !player.disruptorVetoUsed;
    const canSurprise = player?.role === 'Manipulator' && (player.manipulatorSurpriseUsesRemaining ?? 2) > 0 && !player.manipulatorSurpriseUsed;
    const canExperiment = player?.role === 'Scientist' && (player.scientistExperimentUsesRemaining ?? 1) > 0;
    const canSwapVote = player?.role === 'Swapper';
    const hasVotingAbility = canPurify || canObjection || canHearsay || canExile || canVeto || canSurprise || canExperiment || canSwapVote;
    const mayorVotesAvailable = player?.role === 'Mayor' ? Math.max(1, Number(player.mayorVotesAvailable) || 1) : 1;
    const mayorVotesCastThisPhase = player?.role === 'Mayor' ? Math.max(0, Number(player.mayorVotesCastThisPhase) || 0) : 0;
    const mayorVotesRemaining = player?.role === 'Mayor' ? Math.max(0, mayorVotesAvailable - mayorVotesCastThisPhase) : 0;
    const mayorStoredVotes = player?.role === 'Mayor' ? Math.max(0, Number(player.mayorStoredVotes) || 0) : 0;
    const lawyerStoredVotes = player?.role === 'Lawyer' ? Math.max(0, Number(player.lawyerStoredVotes) || 0) : 0;
    const lawyerCanUseAbility = canObjection || canHearsay;
    if (hasVotingAbility) {
      if (state.oracleVotingTab !== 'ability' && state.oracleVotingTab !== 'vote') {
        state.oracleVotingTab = 'ability';
      }
    } else {
      state.oracleVotingTab = 'vote';
    }
    if (state.hasVoted) {
      container.innerHTML = '<div class="action-confirmed"><div class="confirmed-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><p class="confirmed-text">VOTE SUBMITTED</p><p class="confirmed-detail">Waiting for others...</p></div><div id="phase-chat-panel"></div>';
      renderChatBox();
      return;
    }

    const targets = getVoteTargets();
    const aliveCount = state.totalAlive || state.roomData?.aliveCount || '?';
    const showAbilityTab = hasVotingAbility && state.oracleVotingTab === 'ability';
    const selectedVotingAbilityTargets = Array.isArray(state.selectedVotingAbilityTargets) ? state.selectedVotingAbilityTargets : [];
    const isScientistAbility = player?.role === 'Scientist';
    const isSwapperAbility = player?.role === 'Swapper';
    const isLawyerAbility = player?.role === 'Lawyer';
    const isTargetlessVotingAbility = player?.role === 'Disruptor' || player?.role === 'Manipulator';
    if (isLawyerAbility) {
      if (!lawyerCanUseAbility) {
        state.selectedVotingAbilityAction = null;
      } else if (state.selectedVotingAbilityAction !== 'objection' && state.selectedVotingAbilityAction !== 'hearsay') {
        state.selectedVotingAbilityAction = canObjection ? 'objection' : 'hearsay';
      } else if (state.selectedVotingAbilityAction === 'objection' && !canObjection) {
        state.selectedVotingAbilityAction = canHearsay ? 'hearsay' : null;
      } else if (state.selectedVotingAbilityAction === 'hearsay' && !canHearsay) {
        state.selectedVotingAbilityAction = canObjection ? 'objection' : null;
      }
    } else {
      state.selectedVotingAbilityAction = null;
    }
    const lawyerUsingHearsay = isLawyerAbility && state.selectedVotingAbilityAction === 'hearsay';
    const votingAbilityTitle = player.role === 'Inquisitor'
      ? 'INQUISITOR ABILITY'
      : player.role === 'Scientist'
        ? 'SCIENTIST ABILITY'
        : player.role === 'Swapper'
          ? 'SWAP'
          : player.role === 'Disruptor'
            ? 'VETO'
            : player.role === 'Manipulator'
              ? 'SURPRISE'
              : player.role === 'Lawyer'
                ? 'LAWYER ABILITY'
                : 'ORACLE ABILITY';
    const votingAbilitySubtitle = player.role === 'Inquisitor'
      ? 'Exile a player instantly and make every other vote useless.'
      : player.role === 'Scientist'
        ? 'Choose 2 players. Their roles will be switched after this voting session ends.'
        : player.role === 'Swapper'
          ? 'Choose 2 players to swap places before this voting phase resolves.'
          : player.role === 'Disruptor'
            ? 'Revoke this vote instantly.'
            : player.role === 'Manipulator'
              ? 'Each assassin vote will count as double for this voting phase.'
              : player.role === 'Lawyer'
                ? lawyerUsingHearsay
                  ? `Spend your stored reductions one by one. ${lawyerStoredVotes} reduction${lawyerStoredVotes === 1 ? '' : 's'} left this phase.`
                  : 'Protect a player so they cannot be voted out this phase.'
                : 'Purify a player so they cannot be voted out this phase.';
    const votingAbilityTargetLabel = player.role === 'Inquisitor'
      ? 'SELECT PLAYER TO EXILE'
      : player.role === 'Scientist'
        ? `SELECT 2 PLAYERS TO SWITCH${selectedVotingAbilityTargets.length ? ` (${selectedVotingAbilityTargets.length} SELECTED)` : ''}`
        : player.role === 'Swapper'
          ? `SELECT 2 PLAYERS TO SWAP${selectedVotingAbilityTargets.length ? ` (${selectedVotingAbilityTargets.length} SELECTED)` : ''}`
          : player.role === 'Lawyer'
            ? (lawyerUsingHearsay ? 'SELECT PLAYER TO REDUCE' : 'SELECT PLAYER TO PROTECT')
            : 'SELECT PLAYER TO PURIFY';
    const votingAbilityPanel = hasVotingAbility ? `
      <div class="action-panel oracle-vote-panel${showAbilityTab ? '' : ' hidden'}">
        <div class="action-title">${votingAbilityTitle}</div>
        <div class="action-subtitle">${votingAbilitySubtitle}</div>
        ${isLawyerAbility ? `<div class="action-buttons"><button class="action-btn ${state.selectedVotingAbilityAction === 'objection' ? 'selected' : ''}" data-voting-ability-action="objection" ${canObjection ? '' : 'disabled'}>Objection</button><button class="action-btn ${state.selectedVotingAbilityAction === 'hearsay' ? 'selected' : ''}" data-voting-ability-action="hearsay" ${canHearsay ? '' : 'disabled'}>Hearsay</button></div>` : ''}
        ${isTargetlessVotingAbility ? '' : `<div class="target-label">${votingAbilityTargetLabel}</div>
        <div class="target-list chat-target-list" id="voting-ability-target-list">
          ${targets.filter((target) => target.id !== state.playerId).map((t) => `<div class="target-item ${((isScientistAbility || isSwapperAbility) ? selectedVotingAbilityTargets.includes(t.id) : state.selectedOracleTarget === t.id) ? 'selected' : ''} ${t.isJailed ? 'target-jailed' : ''}" data-target="${t.id}">${renderAvatarMarkup(t.id || t.name, 'target-avatar', t.avatarIndex)}<span class="target-name">${t.name}</span>${t.isJailed ? '<span class="target-status target-status-jailed">Jailed</span>' : ''}</div>`).join('')}
        </div>`}
        <div class="chat-local-actions">
          <button class="btn ${player?.faction === 'Assassin' ? 'btn-assassin' : 'btn-crew'} confirm-action" id="btn-confirm-voting-ability" ${isTargetlessVotingAbility ? '' : (isScientistAbility || isSwapperAbility) ? selectedVotingAbilityTargets.length !== 2 ? 'disabled' : '' : !state.selectedOracleTarget ? 'disabled' : ''}>${player.role === 'Inquisitor' ? 'Confirm Exile' : (player.role === 'Scientist' || player.role === 'Swapper') ? `Confirm ${selectedVotingAbilityTargets.length}/2` : player.role === 'Disruptor' ? `Confirm ${player.disruptorVetoUsesRemaining ?? 1}/1` : player.role === 'Manipulator' ? `Confirm ${player.manipulatorSurpriseUsesRemaining ?? 2}/2` : player.role === 'Lawyer' ? (lawyerUsingHearsay ? `Use 1 • ${lawyerStoredVotes} left` : `Confirm ${player.lawyerObjectionUsesRemaining ?? 2}/2`) : `Confirm ${player.oraclePurifyUsesRemaining ?? 2}/2`}</button>
          <button class="btn btn-ghost chat-local-skip" id="btn-skip-voting-ability">Skip</button>
        </div>
      </div>` : '';

    container.innerHTML = `
      ${votingAbilityPanel}
      <div class="voting-panel${showAbilityTab ? ' hidden' : ''}">
        <div class="action-title">CAST YOUR VOTE</div>
        <div class="action-subtitle">${player?.role === 'Mayor' ? `${state.votesCast} / ${aliveCount} votes cast • ${mayorVotesRemaining} vote${mayorVotesRemaining === 1 ? '' : 's'} left • ${mayorStoredVotes} stored` : player?.role === 'Lawyer' ? `${state.votesCast} / ${aliveCount} votes cast • ${lawyerStoredVotes} stored reduction${lawyerStoredVotes === 1 ? '' : 's'} left` : `${state.votesCast} / ${aliveCount} votes cast`}</div>
        <div class="target-label">SELECT PLAYER</div>
        <div class="target-list chat-target-list" id="vote-target-list">
          ${targets.map(t => `<div class="target-item ${state.selectedTarget === t.id ? 'selected' : ''} ${t.isJailed ? 'target-jailed' : ''}" data-target="${t.id}">${renderAvatarMarkup(t.id || t.name, 'target-avatar', t.avatarIndex)}<span class="target-name">${t.name}</span>${t.isJailed ? '<span class="target-status target-status-jailed">Jailed</span>' : ''}</div>`).join('')}
        </div>
        <div class="chat-local-actions">
          <button class="skip-vote-btn ${state.selectedTarget === 'skip' ? 'selected' : ''}" id="btn-vote-skip">Skip Vote</button>
          <button class="btn btn-primary confirm-action" id="btn-confirm-vote" ${!state.selectedTarget ? 'disabled' : ''}>Confirm Vote</button>
        </div>
      </div>
      <div id="phase-chat-panel"></div>`;

    container.querySelectorAll('[data-voting-ability-action]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.disabled) return;
        state.selectedVotingAbilityAction = button.dataset.votingAbilityAction;
        state.selectedOracleTarget = null;
        renderVotingPhase(container);
      });
    });

    container.querySelectorAll('#voting-ability-target-list .target-item').forEach((item) => {
      item.addEventListener('click', () => {
        if (isScientistAbility || isSwapperAbility) {
          const targetId = item.dataset.target;
          if (selectedVotingAbilityTargets.includes(targetId)) {
            state.selectedVotingAbilityTargets = selectedVotingAbilityTargets.filter((selectedId) => selectedId !== targetId);
          } else {
            state.selectedVotingAbilityTargets = [...selectedVotingAbilityTargets.slice(-1), targetId];
          }
        } else {
          state.selectedOracleTarget = item.dataset.target;
        }
        renderVotingPhase(container);
      });
    });

    const confirmVotingAbilityBtn = document.getElementById('btn-confirm-voting-ability');
    if (confirmVotingAbilityBtn) {
      confirmVotingAbilityBtn.addEventListener('click', () => {
        if (!isTargetlessVotingAbility && !isScientistAbility && !isSwapperAbility && !state.selectedOracleTarget) return;
        if ((isScientistAbility || isSwapperAbility) && selectedVotingAbilityTargets.length !== 2) return;
        const action = player.role === 'Inquisitor' ? 'exile' : player.role === 'Scientist' ? 'experiment' : player.role === 'Swapper' ? 'swap' : player.role === 'Disruptor' ? 'veto' : player.role === 'Manipulator' ? 'surprise' : player.role === 'Lawyer' ? (state.selectedVotingAbilityAction || 'objection') : 'purify';
        state.socket.emit('voting-action', { action, targetId: (isScientistAbility || isSwapperAbility || isTargetlessVotingAbility) ? null : state.selectedOracleTarget, targetIds: (isScientistAbility || isSwapperAbility) ? selectedVotingAbilityTargets : null }, (response) => {
          if (response.success) {
            state.playerData = response.player || state.playerData;
            state.roomData = response.room || state.roomData;
            state.selectedOracleTarget = null;
            state.selectedVotingAbilityTargets = [];
            state.oracleVotingTab = player.role === 'Lawyer' && action === 'hearsay' && ((response.player?.lawyerStoredVotes ?? 0) > 0)
              ? 'ability'
              : 'vote';
            renderVotingPhase(container);
            showToast(player.role === 'Inquisitor' ? 'Exile used' : player.role === 'Scientist' ? 'Experiment used' : player.role === 'Swapper' ? 'Swap used' : player.role === 'Disruptor' ? 'Veto used' : player.role === 'Manipulator' ? 'Surprise used' : player.role === 'Lawyer' ? (action === 'hearsay' ? '1 reduction used' : 'Objection used') : 'Purify used', 'success');
          } else {
            showToast(response.error || 'Action failed', 'error');
          }
        });
      });
    }

    const skipVotingAbilityBtn = document.getElementById('btn-skip-voting-ability');
    if (skipVotingAbilityBtn) {
      skipVotingAbilityBtn.addEventListener('click', () => {
        state.selectedOracleTarget = null;
        state.selectedVotingAbilityTargets = [];
        state.selectedVotingAbilityAction = null;
        state.oracleVotingTab = 'vote';
        renderVotingPhase(container);
      });
    }

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
        state.socket.emit('vote', { targetId: state.selectedTarget }, (response) => {
          if (response.success) {
            state.playerData = response.player || state.playerData;
            state.roomData = response.room || state.roomData;
            state.hasVoted = !!response.player?.hasVoted;
            state.selectedTarget = null;
            renderVotingPhase(container);
            showToast(response.player?.hasVoted ? 'Vote submitted' : 'Vote cast', 'success');
          } else {
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




    panel.querySelectorAll('[data-chat-channel]').forEach((button) => {
      button.addEventListener('click', () => {
        state.currentChatChannel = button.dataset.chatChannel || 'public';
        renderChatBox();
      });
    });

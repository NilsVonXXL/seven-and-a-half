// --- Application State ---
const DEFAULT_PLAYERS = [
  { id: 'p1', name: 'Alice', balance: 0, isBanker: false },
  { id: 'p2', name: 'Bob', balance: 0, isBanker: true },
  { id: 'p3', name: 'Charlie', balance: 0, isBanker: false }
];

let state = {
  players: [],
  currentRound: {
    phase: 'betting', // 'betting' | 'resolution'
    bets: {},         // playerId -> number
    outcomes: {}      // playerId -> 'win' | 'lose' | 'push'
  },
  history: []         // array of: { id, roundNum, bankerId, settlements: [], bankerChange }
};

// --- DOM Cache ---
const elements = {
  playerNameInput: document.getElementById('playerNameInput'),
  addPlayerForm: document.getElementById('addPlayerForm'),
  playerListContainer: document.getElementById('playerListContainer'),
  playerCountLabel: document.getElementById('playerCountLabel'),
  resetGameBtn: document.getElementById('resetGameBtn'),
  currentBankerName: document.getElementById('currentBankerName'),
  
  setupPromptCard: document.getElementById('setupPromptCard'),
  roundWorkflowContainer: document.getElementById('roundWorkflowContainer'),
  
  // Phase Views
  bettingPhaseView: document.getElementById('bettingPhaseView'),
  resolutionPhaseView: document.getElementById('resolutionPhaseView'),
  stepBetting: document.getElementById('stepBetting'),
  stepResolution: document.getElementById('stepResolution'),
  roundPhaseTitle: document.getElementById('roundPhaseTitle'),
  
  // Grids & Actions
  bettingGrid: document.getElementById('bettingGrid'),
  resolutionGrid: document.getElementById('resolutionGrid'),
  confirmBetsBtn: document.getElementById('confirmBetsBtn'),
  backToBetsBtn: document.getElementById('backToBetsBtn'),
  settleRoundBtn: document.getElementById('settleRoundBtn'),
  
  // History
  historyListContainer: document.getElementById('historyListContainer'),
  undoBtn: document.getElementById('undoBtn')
};

// --- Local Storage Helpers ---
function saveToLocalStorage() {
  localStorage.setItem('sette_e_mezzo_state', JSON.stringify(state));
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem('sette_e_mezzo_state');
  if (saved) {
    try {
      state = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved state, resetting', e);
      initializeDefaultState();
    }
  } else {
    initializeDefaultState();
  }
}

function initializeDefaultState() {
  state.players = JSON.parse(JSON.stringify(DEFAULT_PLAYERS));
  state.currentRound = {
    phase: 'betting',
    bets: {},
    outcomes: {}
  };
  state.history = [];
  saveToLocalStorage();
}

// --- State Modifiers ---
function addPlayer(name) {
  const newPlayer = {
    id: 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    name: name.trim(),
    balance: 0,
    isBanker: state.players.length === 0 // automatically banker if first player
  };
  state.players.push(newPlayer);
  
  // If we just added the banker, check state
  saveToLocalStorage();
  render();
}

function removePlayer(id) {
  const player = state.players.find(p => p.id === id);
  if (!player) return;

  if (confirm(`Are you sure you want to remove ${player.name} from the game?`)) {
    // If we remove the banker, assign a new banker if players remain
    const wasBanker = player.isBanker;
    state.players = state.players.filter(p => p.id !== id);
    
    // Clean current round states
    delete state.currentRound.bets[id];
    delete state.currentRound.outcomes[id];

    if (wasBanker && state.players.length > 0) {
      state.players[0].isBanker = true;
    }
    
    saveToLocalStorage();
    render();
  }
}

function setBanker(id) {
  state.players.forEach(p => {
    p.isBanker = (p.id === id);
  });
  
  // Clean banker bets since the banker doesn't bet against themselves
  delete state.currentRound.bets[id];
  delete state.currentRound.outcomes[id];

  saveToLocalStorage();
  render();
}

function setPlayerBet(id, amount) {
  const val = parseInt(amount, 10);
  if (isNaN(val) || val < 0) {
    delete state.currentRound.bets[id];
  } else {
    state.currentRound.bets[id] = val;
  }
  
  saveToLocalStorage();
  checkBettingValidity();
}

function setPlayerOutcome(id, outcome) {
  if (['win', 'lose', 'push'].includes(outcome)) {
    state.currentRound.outcomes[id] = outcome;
  }
  saveToLocalStorage();
}

// Check if all players (excluding banker) have set their bets
function checkBettingValidity() {
  const activePlayers = state.players.filter(p => !p.isBanker);
  let allSet = true;
  
  activePlayers.forEach(p => {
    const bet = state.currentRound.bets[p.id];
    if (bet === undefined || bet === null || isNaN(bet) || bet <= 0) {
      allSet = false;
    }
  });

  elements.confirmBetsBtn.disabled = !allSet || activePlayers.length === 0;
}

// Transition to Resolution Phase
function advanceToResolution() {
  state.currentRound.phase = 'resolution';
  
  // Pre-fill outcomes with 'push' for any that aren't set
  state.players.forEach(p => {
    if (!p.isBanker && !state.currentRound.outcomes[p.id]) {
      state.currentRound.outcomes[p.id] = 'push';
    }
  });
  
  saveToLocalStorage();
  render();
}

// Transition back to Betting Phase
function backToBetting() {
  state.currentRound.phase = 'betting';
  saveToLocalStorage();
  render();
}

// Settle the round mathematically
function settleRound() {
  const banker = state.players.find(p => p.isBanker);
  if (!banker) return;

  const activePlayers = state.players.filter(p => !p.isBanker);
  const settlements = [];
  let bankerChangeTotal = 0;

  activePlayers.forEach(p => {
    const bet = state.currentRound.bets[p.id] || 0;
    const outcome = state.currentRound.outcomes[p.id] || 'push';
    let balanceChange = 0;

    if (outcome === 'win') {
      balanceChange = bet;
      p.balance += bet;
      bankerChangeTotal -= bet;
    } else if (outcome === 'lose') {
      balanceChange = -bet;
      p.balance -= bet;
      bankerChangeTotal += bet;
    }

    settlements.push({
      playerId: p.id,
      playerName: p.name,
      bet: bet,
      outcome: outcome,
      change: balanceChange
    });
  });

  // Apply net change to banker
  banker.balance += bankerChangeTotal;

  // Add to history
  const roundRecord = {
    id: 'round_' + Date.now(),
    roundNum: state.history.length + 1,
    bankerId: banker.id,
    bankerName: banker.name,
    settlements: settlements,
    bankerChange: bankerChangeTotal
  };
  state.history.unshift(roundRecord); // add to top of stack

  // Reset round data
  state.currentRound = {
    phase: 'betting',
    bets: {},
    outcomes: {}
  };

  saveToLocalStorage();
  render();
}

// Undo Last Settle
function undoLastRound() {
  if (state.history.length === 0) return;
  
  if (confirm("Are you sure you want to undo the last round's settlements? All balances will be reverted.")) {
    const lastRound = state.history.shift(); // remove top record
    
    // Reverse banker change
    const banker = state.players.find(p => p.id === lastRound.bankerId);
    if (banker) {
      banker.balance -= lastRound.bankerChange;
    }

    // Reverse players changes
    lastRound.settlements.forEach(settlement => {
      const p = state.players.find(player => player.id === settlement.playerId);
      if (p) {
        p.balance -= settlement.change;
      }
    });

    // Go back to betting phase
    state.currentRound = {
      phase: 'betting',
      bets: {},
      outcomes: {}
    };

    saveToLocalStorage();
    render();
  }
}

// Reset Entire Game
function resetGame() {
  if (confirm("Are you sure you want to reset the game? This will reset all players to 0 points and wipe the history log.")) {
    initializeDefaultState();
    render();
  }
}

// --- Render Functions ---

function render() {
  renderRoster();
  renderHistory();
  renderRoundView();
  updateHeader();
}

function updateHeader() {
  const banker = state.players.find(p => p.isBanker);
  if (banker) {
    elements.currentBankerName.textContent = `${banker.name} (${banker.balance} pts)`;
    elements.headerBankerBadge.classList.remove('hidden');
  } else {
    elements.currentBankerName.textContent = 'None';
    elements.headerBankerBadge.classList.add('hidden');
  }
}

function renderRoster() {
  elements.playerCountLabel.textContent = `${state.players.length} Player${state.players.length === 1 ? '' : 's'}`;
  elements.playerListContainer.innerHTML = '';
  
  if (state.players.length === 0) {
    elements.playerListContainer.innerHTML = '<div class="empty-state">No players added yet. Add players to begin.</div>';
    return;
  }

  state.players.forEach(p => {
    const card = document.createElement('div');
    card.className = `player-card ${p.isBanker ? 'is-banker' : ''}`;
    
    const balanceClass = p.balance > 0 ? 'positive' : (p.balance < 0 ? 'negative' : 'neutral');
    const formattedBalance = (p.balance >= 0 ? '' : '') + p.balance;

    card.innerHTML = `
      <div class="player-info">
        <div class="player-name-wrapper">
          <span class="player-name">${escapeHTML(p.name)}</span>
          ${p.isBanker ? '<span class="banker-crown" title="Current Banker">👑</span>' : ''}
        </div>
        <span class="player-chips ${balanceClass}">${formattedBalance} pts</span>
      </div>
      <div class="player-card-actions">
        ${!p.isBanker ? `
          <button class="btn-icon bank-btn" title="Set as Banker" data-id="${p.id}">
            👑
          </button>
        ` : ''}
        <button class="btn-icon delete-btn" title="Delete Player" data-id="${p.id}">
          🗑️
        </button>
      </div>
    `;

    // Event hooks
    const bankBtn = card.querySelector('.bank-btn');
    if (bankBtn) {
      bankBtn.addEventListener('click', () => setBanker(p.id));
    }
    card.querySelector('.delete-btn').addEventListener('click', () => removePlayer(p.id));

    elements.playerListContainer.appendChild(card);
  });
}

function renderRoundView() {
  const banker = state.players.find(p => p.isBanker);
  const activePlayers = state.players.filter(p => !p.isBanker);

  // If we don't have enough players (at least 2: banker + 1 player)
  if (state.players.length < 2 || !banker) {
    elements.setupPromptCard.classList.remove('hidden');
    elements.roundWorkflowContainer.classList.add('hidden');
    return;
  }

  elements.setupPromptCard.classList.add('hidden');
  elements.roundWorkflowContainer.classList.remove('hidden');

  const phase = state.currentRound.phase;

  if (phase === 'betting') {
    elements.roundPhaseTitle.textContent = 'Round Ledger - Place Bets';
    elements.stepBetting.classList.add('active');
    elements.stepResolution.classList.remove('active');
    
    elements.bettingPhaseView.classList.remove('hidden');
    elements.resolutionPhaseView.classList.add('hidden');
    
    renderBettingGrid(activePlayers);
    checkBettingValidity();
  } else {
    elements.roundPhaseTitle.textContent = 'Round Ledger - Settle Outcomes';
    elements.stepBetting.classList.remove('active');
    elements.stepResolution.classList.add('active');
    
    elements.bettingPhaseView.classList.add('hidden');
    elements.resolutionPhaseView.classList.remove('hidden');
    
    renderResolutionGrid(activePlayers);
  }
}

function renderBettingGrid(activePlayers) {
  elements.bettingGrid.innerHTML = '';

  activePlayers.forEach(p => {
    const card = document.createElement('div');
    card.className = 'board-card';
    
    const betVal = state.currentRound.bets[p.id] || '';
    
    card.innerHTML = `
      <div class="card-player-header">
        <span class="card-player-name">${escapeHTML(p.name)}</span>
        <span class="card-player-balance">${p.balance} pts</span>
      </div>
      
      <div class="bet-input-wrapper">
        <span class="bet-currency">$</span>
        <input type="number" class="player-bet-input" data-id="${p.id}" value="${betVal}" placeholder="Place bet..." min="1" step="1">
      </div>

      <div class="bet-hotkeys">
        ${[50, 100, 150, 200, 250, 300].map(amt => `
          <button class="btn btn-hotkey ${betVal === amt ? 'active' : ''}" data-id="${p.id}" data-amount="${amt}">
            ${amt}
          </button>
        `).join('')}
      </div>
    `;

    // Event hooks
    const input = card.querySelector('.player-bet-input');
    input.addEventListener('input', (e) => {
      setPlayerBet(p.id, e.target.value);
      // Re-render hotkeys state manually to avoid visual input flashing
      const buttons = card.querySelectorAll('.btn-hotkey');
      const currentVal = parseInt(e.target.value, 10);
      buttons.forEach(btn => {
        const btnAmt = parseInt(btn.getAttribute('data-amount'), 10);
        if (btnAmt === currentVal) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    });

    card.querySelectorAll('.btn-hotkey').forEach(btn => {
      btn.addEventListener('click', () => {
        const amt = btn.getAttribute('data-amount');
        input.value = amt;
        setPlayerBet(p.id, amt);
        
        // Visual toggle update
        card.querySelectorAll('.btn-hotkey').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    elements.bettingGrid.appendChild(card);
  });
}

function renderResolutionGrid(activePlayers) {
  elements.resolutionGrid.innerHTML = '';

  activePlayers.forEach(p => {
    const card = document.createElement('div');
    card.className = 'board-card';
    
    const bet = state.currentRound.bets[p.id] || 0;
    const currentOutcome = state.currentRound.outcomes[p.id] || 'push';

    card.innerHTML = `
      <div class="card-player-header">
        <span class="card-player-name">${escapeHTML(p.name)}</span>
        <span class="card-player-balance">${p.balance} pts</span>
      </div>

      <div class="resolution-bet-display">
        Locked Bet: <span>$${bet}</span>
      </div>

      <div class="result-selector">
        <div class="result-option-wrapper">
          <input type="radio" id="win_${p.id}" name="result_${p.id}" value="win" class="result-option" ${currentOutcome === 'win' ? 'checked' : ''}>
          <label for="win_${p.id}" class="result-label">Won</label>
        </div>
        <div class="result-option-wrapper">
          <input type="radio" id="push_${p.id}" name="result_${p.id}" value="push" class="result-option" ${currentOutcome === 'push' ? 'checked' : ''}>
          <label for="push_${p.id}" class="result-label">Push</label>
        </div>
        <div class="result-option-wrapper">
          <input type="radio" id="lose_${p.id}" name="result_${p.id}" value="lose" class="result-option" ${currentOutcome === 'lose' ? 'checked' : ''}>
          <label for="lose_${p.id}" class="result-label">Lost</label>
        </div>
      </div>
    `;

    // Event hooks
    card.querySelectorAll('input[type="radio"]').forEach(rad => {
      rad.addEventListener('change', (e) => {
        if (e.target.checked) {
          setPlayerOutcome(p.id, e.target.value);
        }
      });
    });

    elements.resolutionGrid.appendChild(card);
  });
}

function renderHistory() {
  elements.historyListContainer.innerHTML = '';
  
  if (state.history.length === 0) {
    elements.historyListContainer.innerHTML = '<div class="empty-state">No rounds played in this session.</div>';
    elements.undoBtn.disabled = true;
    return;
  }

  elements.undoBtn.disabled = false;

  state.history.forEach(round => {
    const card = document.createElement('div');
    card.className = 'history-card';

    const bChangeClass = round.bankerChange > 0 ? 'positive' : (round.bankerChange < 0 ? 'negative' : 'neutral');
    const bChangeSign = round.bankerChange > 0 ? '+' : '';

    card.innerHTML = `
      <div class="history-card-header">
        <span class="history-round-num">Round #${round.roundNum}</span>
        <span class="history-banker-info">
          Bank: <strong>${escapeHTML(round.bankerName)}</strong> 
          (<span class="history-banker-change ${bChangeClass}">${bChangeSign}${round.bankerChange}</span>)
        </span>
      </div>
      <div class="history-settlements">
        ${round.settlements.map(item => {
          const valClass = item.change > 0 ? 'positive' : (item.change < 0 ? 'negative' : 'neutral');
          const valSign = item.change > 0 ? '+' : '';
          return `
            <div class="history-item">
              <span class="history-item-name">${escapeHTML(item.playerName)}</span>
              <span class="history-item-outcome">
                <span class="history-badge ${item.outcome}">${item.outcome}</span>
                <span class="history-item-value ${valClass}">${valSign}${item.change}</span>
              </span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    elements.historyListContainer.appendChild(card);
  });
}

// --- Utilities ---
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// --- Initialization & Event Binding ---
function setupEventListeners() {
  // Add Player Form
  elements.addPlayerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = elements.playerNameInput.value.trim();
    if (name) {
      addPlayer(name);
      elements.playerNameInput.value = '';
    }
  });

  // Reset Game
  elements.resetGameBtn.addEventListener('click', resetGame);

  // Undo Last Round
  elements.undoBtn.addEventListener('click', undoLastRound);

  // Betting Next Action
  elements.confirmBetsBtn.addEventListener('click', advanceToResolution);

  // Resolution Back Action
  elements.backToBetsBtn.addEventListener('click', backToBetting);

  // Resolution Settle Action
  elements.settleRoundBtn.addEventListener('click', settleRound);
}

// Start App
document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  setupEventListeners();
  render();
});

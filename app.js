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
  headerBankerBadge: document.getElementById('headerBankerBadge'),
  
  setupPromptCard: document.getElementById('setupPromptCard'),
  roundWorkflowContainer: document.getElementById('roundWorkflowContainer'),
  boardContent: document.querySelector('.board-content'),
  
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
  allWinBtn: document.getElementById('allWinBtn'),
  allLoseBtn: document.getElementById('allLoseBtn'),
  lastHotkeyInput: document.getElementById('lastHotkeyInput'),
  
  // History
  historyListContainer: document.getElementById('historyListContainer'),
  undoBtn: document.getElementById('undoBtn')
};

// --- Helper: Get active players rotated starting from the player after the Banker ---
function getActivePlayersSorted() {
  const bankerIndex = state.players.findIndex(p => p.isBanker);
  if (bankerIndex === -1) {
    return state.players.filter(p => !p.isBanker);
  }
  
  const activeSorted = [];
  const len = state.players.length;
  for (let i = 1; i < len; i++) {
    const p = state.players[(bankerIndex + i) % len];
    if (!p.isBanker) {
      activeSorted.push(p);
    }
  }
  return activeSorted;
}

// --- Local Storage Helpers ---
function saveToLocalStorage() {
  localStorage.setItem('sette_e_mezzo_state', JSON.stringify(state));
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem('sette_e_mezzo_state');
  if (saved) {
    try {
      state = JSON.parse(saved);
      // Ensure settings & burned properties exist for backward compatibility
      if (!state.settings) {
        state.settings = { lastHotkey: 5 };
      }
      if (!state.currentRound) {
        state.currentRound = { phase: 'betting', bets: {}, outcomes: {}, burned: {} };
      }
      if (!state.currentRound.burned) {
        state.currentRound.burned = {};
      }
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
  state.settings = {
    lastHotkey: 5
  };
  state.currentRound = {
    phase: 'betting',
    bets: {},
    outcomes: {},
    burned: {}
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

function movePlayerUp(index) {
  if (index <= 0 || index >= state.players.length) return;
  const temp = state.players[index];
  state.players[index] = state.players[index - 1];
  state.players[index - 1] = temp;
  
  saveToLocalStorage();
  render();
}

function movePlayerDown(index) {
  if (index < 0 || index >= state.players.length - 1) return;
  const temp = state.players[index];
  state.players[index] = state.players[index + 1];
  state.players[index + 1] = temp;
  
  saveToLocalStorage();
  render();
}

function toggleBurnPlayer(id) {
  if (!state.currentRound.burned) {
    state.currentRound.burned = {};
  }
  const isBurned = !!state.currentRound.burned[id];
  if (isBurned) {
    delete state.currentRound.burned[id];
  } else {
    state.currentRound.burned[id] = true;
    // Ensure they have a non-zero bet locked in if they busted
    if (!state.currentRound.bets[id]) {
      state.currentRound.bets[id] = 1; // default standard bet
    }
  }
  
  saveToLocalStorage();
  render();
}

function setPlayerBet(id, amount) {
  const val = parseFloat(amount);
  if (isNaN(val) || val < 0) {
    delete state.currentRound.bets[id];
  } else {
    state.currentRound.bets[id] = val;
  }
  
  saveToLocalStorage();
  checkBettingValidity();
}

function setPlayerOutcome(id, outcome) {
  if (['win', 'lose'].includes(outcome)) {
    state.currentRound.outcomes[id] = outcome;
  }
  saveToLocalStorage();
  checkResolutionValidity();
}

// Check if all players (excluding banker) have set their bets
function checkBettingValidity() {
  const activePlayers = getActivePlayersSorted();
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
  
  // Clear old outcomes, but pre-fill "lose" for players who burned (busted)
  const activePlayers = getActivePlayersSorted();
  activePlayers.forEach(p => {
    const isBurned = state.currentRound.burned && !!state.currentRound.burned[p.id];
    if (isBurned) {
      state.currentRound.outcomes[p.id] = 'lose';
    } else {
      delete state.currentRound.outcomes[p.id];
    }
  });
  
  saveToLocalStorage();
  render();
  
  // Scroll board content container back to top
  if (elements.boardContent) {
    elements.boardContent.scrollTop = 0;
  }
}

// Check if all players (excluding banker) have outcomes set (Won or Lost)
function checkResolutionValidity() {
  const activePlayers = getActivePlayersSorted();
  let allSet = true;
  
  activePlayers.forEach(p => {
    const outcome = state.currentRound.outcomes[p.id];
    if (outcome !== 'win' && outcome !== 'lose') {
      allSet = false;
    }
  });

  elements.settleRoundBtn.disabled = !allSet || activePlayers.length === 0;
}

// Bulk set outcomes for all active players (e.g. All Won / All Lost)
function setAllOutcomes(outcome) {
  const activePlayers = getActivePlayersSorted();
  activePlayers.forEach(p => {
    state.currentRound.outcomes[p.id] = outcome;
  });
  saveToLocalStorage();
  render();
}

// Transition back to Betting Phase
function backToBetting() {
  state.currentRound.phase = 'betting';
  saveToLocalStorage();
  render();
  
  // Scroll board content container back to top
  if (elements.boardContent) {
    elements.boardContent.scrollTop = 0;
  }
}

// Settle the round mathematically
function settleRound() {
  const banker = state.players.find(p => p.isBanker);
  if (!banker) return;

  const activePlayers = getActivePlayersSorted();
  const settlements = [];
  let bankerChangeTotal = 0;

  activePlayers.forEach(p => {
    const bet = state.currentRound.bets[p.id] || 0;
    const outcome = state.currentRound.outcomes[p.id];
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

  // Take a snapshot of all player balances after settlements are applied
  const balanceSnapshot = {};
  state.players.forEach(p => {
    balanceSnapshot[p.name] = p.balance;
  });

  // Add to history
  const roundRecord = {
    id: 'round_' + Date.now(),
    roundNum: state.history.length + 1,
    bankerId: banker.id,
    bankerName: banker.name,
    settlements: settlements,
    bankerChange: bankerChangeTotal,
    balances: balanceSnapshot
  };
  state.history.unshift(roundRecord); // add to top of stack

  // Reset round data
  state.currentRound = {
    phase: 'betting',
    bets: {},
    outcomes: {},
    burned: {}
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

let balanceChart = null;

function updateChart() {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js is not loaded yet');
    return;
  }
  const ctx = document.getElementById('balanceChart');
  if (!ctx) return;

  // Reconstruct historical balances of all current players
  const chronoHistory = [...state.history].reverse();
  
  // X-axis: Start, R1, R2, R3...
  const labels = ['Start'];
  chronoHistory.forEach((r, idx) => {
    labels.push(`R${idx + 1}`);
  });

  // Generate dataset for each current player
  const datasets = state.players.map((player, index) => {
    const hue = (index * 137.5) % 360; // Spaced out colors
    const color = `hsl(${hue}, 85%, 60%)`;
    const colorTransparent = `hsla(${hue}, 85%, 60%, 0.15)`;

    const dataPoints = [0]; // Starts at 0 points
    chronoHistory.forEach(round => {
      let snapVal;
      if (round.balances) {
        snapVal = round.balances[player.name];
      } else {
        snapVal = player.balance; // Fallback
      }
      dataPoints.push(snapVal !== undefined ? snapVal : 0);
    });

    return {
      label: player.name,
      data: dataPoints,
      borderColor: color,
      backgroundColor: colorTransparent,
      borderWidth: 3,
      tension: 0.35, // Smooth curves
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: true
    };
  });

  if (balanceChart) {
    balanceChart.destroy();
  }

  // Draw chart using Chart.js library loaded via script CDN
  balanceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#ffffff',
            font: {
              family: "'Outfit', sans-serif",
              weight: 'bold',
              size: 13
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(5, 26, 14, 0.95)',
          titleColor: '#d4af37',
          bodyColor: '#ffffff',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          titleFont: { family: "'Outfit', sans-serif", weight: 'bold' },
          bodyFont: { family: "'Inter', sans-serif" },
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${context.parsed.y} €`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#a8c3b4',
            font: { family: "'Inter', sans-serif" }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#a8c3b4',
            font: { family: "'Inter', sans-serif" },
            callback: function(value) {
              return value + ' €';
            }
          }
        }
      }
    }
  });
}

function render() {
  renderRoster();
  renderHistory();
  renderRoundView();
  updateHeader();
  updateChart();
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

  state.players.forEach((p, index) => {
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
        <button class="btn-icon reorder-btn up-btn" title="Move Up" data-id="${p.id}" ${index === 0 ? 'disabled' : ''}>
          ▲
        </button>
        <button class="btn-icon reorder-btn down-btn" title="Move Down" data-id="${p.id}" ${index === state.players.length - 1 ? 'disabled' : ''}>
          ▼
        </button>
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
    card.querySelector('.up-btn').addEventListener('click', () => movePlayerUp(index));
    card.querySelector('.down-btn').addEventListener('click', () => movePlayerDown(index));
    
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
  const activePlayers = getActivePlayersSorted();

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
    checkResolutionValidity();
  }
}

function renderBettingGrid(activePlayers) {
  elements.bettingGrid.innerHTML = '';

  activePlayers.forEach(p => {
    const card = document.createElement('div');
    const isBurned = state.currentRound.burned && !!state.currentRound.burned[p.id];
    card.className = `board-card ${isBurned ? 'is-burned' : ''}`;
    
    const betVal = state.currentRound.bets[p.id] || '';
    const lastQuickBet = state.settings.lastHotkey || 5;
    const hotkeyValues = [0.5, 1, 2, 3, 4, lastQuickBet];
    
    card.innerHTML = `
      <div class="card-player-header">
        <span class="card-player-name">${escapeHTML(p.name)}</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${isBurned ? '<span class="burned-badge">Burned</span>' : ''}
          <button class="btn-burn ${isBurned ? 'active' : ''}" data-id="${p.id}" title="Burn Player (Bust)">
            🔥
          </button>
        </div>
      </div>
      
      <div class="bet-input-wrapper">
        <span class="bet-currency">€</span>
        <input type="number" class="player-bet-input" data-id="${p.id}" value="${betVal}" placeholder="Place bet..." min="0.5" step="0.5" ${isBurned ? 'disabled' : ''}>
      </div>

      <div class="bet-hotkeys">
        ${hotkeyValues.map(amt => `
          <button class="btn btn-hotkey ${betVal === amt ? 'active' : ''}" data-id="${p.id}" data-amount="${amt}" ${isBurned ? 'disabled' : ''}>
            ${amt}
          </button>
        `).join('')}
      </div>
    `;

    // Event hooks
    card.querySelector('.btn-burn').addEventListener('click', () => {
      toggleBurnPlayer(p.id);
    });

    const input = card.querySelector('.player-bet-input');
    input.addEventListener('input', (e) => {
      setPlayerBet(p.id, e.target.value);
      // Re-render hotkeys state manually to avoid visual input flashing
      const buttons = card.querySelectorAll('.btn-hotkey');
      const currentVal = parseFloat(e.target.value);
      buttons.forEach(btn => {
        const btnAmt = parseFloat(btn.getAttribute('data-amount'));
        if (btnAmt === currentVal) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    });

    card.querySelectorAll('.btn-hotkey').forEach(btn => {
      btn.addEventListener('click', () => {
        const amt = parseFloat(btn.getAttribute('data-amount'));
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
    const currentOutcome = state.currentRound.outcomes[p.id];

    card.innerHTML = `
      <div class="card-player-header">
        <span class="card-player-name">${escapeHTML(p.name)}</span>
        <span class="card-player-balance">${p.balance} pts</span>
      </div>

      <div class="resolution-bet-display">
        Locked Bet: <span>€${bet}</span>
      </div>

      <div class="result-selector">
        <div class="result-option-wrapper">
          <input type="radio" id="win_${p.id}" name="result_${p.id}" value="win" class="result-option" ${currentOutcome === 'win' ? 'checked' : ''}>
          <label for="win_${p.id}" class="result-label">Won</label>
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

  // Settle outcomes quickly
  elements.allWinBtn.addEventListener('click', () => setAllOutcomes('win'));
  elements.allLoseBtn.addEventListener('click', () => setAllOutcomes('lose'));

  // Custom Last Hotkey setting listener
  elements.lastHotkeyInput.addEventListener('input', (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val <= 0) {
      val = 5; // fallback
    }
    state.settings.lastHotkey = val;
    saveToLocalStorage();
    renderRoundView(); // refresh quick bets with the new last hotkey
  });
}

// Start App
document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  if (elements.lastHotkeyInput && state.settings) {
    elements.lastHotkeyInput.value = state.settings.lastHotkey || 5;
  }
  setupEventListeners();
  render();
});

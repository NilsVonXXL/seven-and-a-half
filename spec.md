# Seven and a Half (Sette e Mezzo) - Companion Counting App Specification

This document specifies a companion web application for tracking bets, scores, and dealer states for the traditional Italian card game **Seven and a Half (Sette e Mezzo)**.

---

## 1. Game Overview & Rules

The game is played with a 40-card deck (standard 52-card deck with 8s, 9s, and 10s removed). 

### Card Values
- **Aces**: 1 point
- **Numeric Cards (2–7)**: Face value (2 to 7 points)
- **Face Cards (Jack, Queen, King)**: 0.5 (half) point each
- **King of Diamonds (K♦)**: Wild card. It can represent any positive integer value ($1, 2, 3, \dots$).

### Objective
Players compete individually against the Banker (Dealer). The goal is to obtain a hand total closer to $7.5$ than the Banker, without going over $7.5$ (busting).

### Core Mechanics
1. **Betting**: Each player places a bet before any cards are dealt.
2. **First Card**: Each player and the banker receive one face-down card.
3. **Player Turns**: Players can hit (draw cards face-up) as many times as they want to improve their score. If a player exceeds $7.5$, they bust immediately, lose their bet to the banker, and exit the round.
4. **Banker Turn**: After all players have stood or busted, the banker reveals their face-down card and hits/stands.
5. **Settlement**: 
   - Banker busts $\rightarrow$ Banker pays all active (non-busted) players their bet amount.
   - Banker stands $\rightarrow$ Banker compares score with each active player:
     - Player score > Banker score $\rightarrow$ Banker pays the player their bet amount.
     - Player score < Banker score $\rightarrow$ Banker collects the player's bet amount.
     - Player score == Banker score $\rightarrow$ Push (no chips exchanged).

---

## 2. Counting Application Scope & Requirements

The application is a **digital companion counter** designed to run on a website. It automates financial ledger tracking for a physical game, avoiding the need for physical chips or manual calculations.

### Core Features

#### 1. Player Management
- **Add/Remove Players**: Dynamic list of players participating in the game.
- **Starting Score / Balances**: Players start with a baseline balance of 0 points/chips. **There are no chip limits:** players can go negative, and they can always place any bet size regardless of their balance.
- **Active Banker Selection**: A clear visual indicator showing who is currently the Banker. The Banker can be changed at any time.

#### 2. Round Flow & Dashboard
To match physical game play, each round consists of two distinct phases:
1. **Betting Phase (Start of Round)**:
   - Active players (excluding the Banker) are sorted in play order: starting with the player immediately to the Banker's left (adding order) and wrapping clockwise.
   - For each active player, their bet is input before cards are resolved.
   - **Bet Input**:
     - **Quick-Bet Hotkeys**: Standard buttons for fast entry: **0.5**, **1**, **2**, **3**, **4**, and **5** (or a customizable 6th value).
     - **Custom Amount Field**: A numeric text input for any custom bet size in Euros (€).
   - Bets are unrestricted: players can always place bets of any size, and balances can go negative.
2. **Resolution Phase (End of Round)**:
   - When advancing to this phase, the dashboard automatically scrolls back to the top of the player list.
   - A **Quick Select All** bar at the top allows marking **All Won** or **All Lost** with a single click.
   - For each player, the dealer logs their outcome (Push has been removed):
     - **Won**: Player won their bet. The player's balance increases by their bet amount (€), and the Banker's balance decreases by the same amount.
     - **Lost**: Player lost their bet. The player's balance decreases by their bet amount (€), and the Banker's balance increases by the same amount.

#### 3. Calculations & Ledger
- When the round is submitted and settled:
  - Updates all players' persistent balances and the banker's balance in real-time.
  - Re-calculates and displays total stakes (in Euros €) and individual net standings.
  - **Visual Performance Graph**: Renders an interactive stock-style line chart at the bottom, plotting each player's points round-by-round (utilizing HSL color distribution and shaded areas) to track balance trends.

#### 4. History Log & Undo
- A chronological feed of played rounds showing:
  - Round number.
  - Banker name during that round.
  - Brief breakdown of payouts (e.g., "Alice: +100, Bob: -50, Banker (Charlie): -50").
- An **Undo** button to revert the last round's settlements in case of mistake.

---

## 3. UI/UX Design System

To ensure a premium, immersive gaming atmosphere, the web app will use a modern dark theme inspired by luxury casinos.

### Aesthetics & Theme
- **Theme**: Dark Mode with rich emerald green accents (reminiscent of felt card tables) and gold highlight elements.
- **Glassmorphism**: Translucent panels with subtle borders, background blurs, and drop shadows to create depth.
- **Typography**: Clean, geometric sans-serif fonts (e.g., *Outfit* or *Inter*) loaded from Google Fonts.
- **Animations**: Smooth transitions on hover states, micro-interactions for buttons, and active indicators.

### Key Visual Components
1. **Header Banner**: Displaying the game title, current banker, and total table stakes.
2. **Player Roster (Left/Top Sidebar)**: Cards displaying each player's name, chip count, and a crown/badge icon for the current banker.
3. **Settlement Console (Center Panel)**: A structured grid of active players where the banker can quickly mark win/loss/push and select bet values.
4. **Action Bar (Bottom Panel)**: Clean buttons to "Settle Round", "Undo Last Round", or "Reset Ledger".

---

## 4. Technical Architecture

A lightweight, single-page client-side app ensures maximum portability and instant responses.

### Tech Stack
- **Structure**: Semantic HTML5.
- **Styling**: Vanilla CSS3 with CSS Variables for theme tokens, Flexbox/Grid layouts, and CSS keyframe animations.
- **Logic**: ES6+ Javascript (no external runtime dependencies required).
- **Hosting**: Can be run locally (double-clicking `index.html`), hosted on GitHub Pages, or deployed to Vercel/Netlify.

### Data Model (JSON Structure)
```javascript
// State structure maintained in application memory / local storage
let gameState = {
  players: [
    { id: "1", name: "Alice", chips: 1000, isBanker: true },
    { id: "2", name: "Bob", chips: 1000, isBanker: false },
    { id: "3", name: "Charlie", chips: 1000, isBanker: false }
  ],
  history: [
    // Array of past round logs for undo capabilities
  ]
};
```

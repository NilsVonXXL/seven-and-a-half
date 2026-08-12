# Seven and a Half (Sette e Mezzo) - Companion Betting Console

A responsive, high-end dealer console and scoring web application for playing the physical Italian card game **Seven and a Half** (Sette e Mezzo). It automates bet ledger tracking and Banker settlements, allowing you to run the game from your phone.

---

## 🃏 Game Rules Refresher

- **Deck**: Played with a 40-card deck (Remove all 8s, 9s, and 10s from a standard 52-card deck).
- **Aces**: 1 point.
- **2 to 7**: Face value.
- **Face Cards (J, Q, K)**: 0.5 (half) point.
- **King of Diamonds (K♦)**: Wild card (can represent any positive whole number).
- **Objective**: Get closer to **7.5** than the Banker without busting (going over 7.5).
- **Settlement**: 
  - Players bet at the start of each round.
  - If a player beats the banker, the banker pays them their bet amount.
  - If a player loses to the banker (or busts), the banker collects their bet amount.
  - Ties (Pushes) result in no exchange of chips.
  - The Banker pays out and collects directly from/to their own balance.

---

## 📱 Web App Features

- **No Rigid Chip Limits**: Players can place bets of any size regardless of their score. Balances can go negative, so players are never forced out of the game.
- **Two-Phase Round Flow**:
  1. **Betting Phase (Round Start)**: Input bets for all active players using tactile quick-bet buttons (`50`, `100`, `150`, `200`, `250`, `300`) or custom numerical input fields.
  2. **Resolution Phase (Round End)**: Settle outcomes per-player as a **Win**, **Lost**, or **Push**.
- **Automated Ledger System**: Updates players' balances in real-time, subtracting winning bets from the Banker and adding losing bets to the Banker's total stakes automatically.
- **Persistent State**: Auto-saves your players, scores, and round history to your browser's local storage so you don't lose your game if you refresh or reopen the app on your phone.
- **Log & Reversion**: Dynamic scroll feed of all rounds played in the session with a dedicated **Undo** button to revert accidental submissions.
- **Mobile Responsive Design**: Designed with large touch targets (48px+) and fluid stacking panels ideal for phone screens.

---

## 🚀 How to Load and Host

### 1. Running Locally on your PC
Double-click `index.html` to open it in any browser, or run a local lightweight server in this directory:

**Using Python:**
```bash
python -m http.server 8000
```
Then visit: `http://localhost:8000`

### 2. Accessing from your Phone via Local Wi-Fi
If your phone and computer are on the same Wi-Fi network:
1. Find your computer's local IP address (run `ipconfig` on Windows CMD and look for IPv4 Address, e.g., `192.168.1.50`).
2. Run the local Python server: `python -m http.server 8000`
3. On your phone's browser, enter: `http://192.168.1.50:8000`

---

## 🌐 Publishing to GitHub Pages (For Global Access)

To host the page permanently for free on GitHub so you can access it anywhere:

### Step 1: Commit the Files Locally
Open your command terminal in this directory and run:
```bash
# Add files to git
git add index.html index.css app.js README.md

# Commit files
git commit -m "Initial commit of Sette e Mezzo companion app"
```

### Step 2: Push to GitHub
Link the local repository to your remote SSH address and push to the `main` branch:
```bash
# Set main branch
git branch -M main

# Push files to GitHub
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. Go to your repository at [github.com/NilsVonXXL/seven-and-a-half](https://github.com/NilsVonXXL/seven-and-a-half).
2. Click on **Settings** in the top navigation tab.
3. In the left-hand sidebar, select **Pages**.
4. Under **Build and deployment** $\rightarrow$ **Branch**, change "None" to **`main`** (and keep the folder as `/ (root)`).
5. Click **Save**.
6. Wait about 30 seconds. A link will appear at the top of the page:
   `https://nilsvonxxl.github.io/seven-and-a-half/`

You can load this link on your phone's browser, bookmark it, and add it to your home screen!

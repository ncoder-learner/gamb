# Game Hunk

Authoritative multiplayer virtual-chip game lounge using vanilla HTML/CSS/JS, Express and Socket.IO. No real-money gambling is implemented.

## 1. Run locally

```bash
npm install
CLIENT_ORIGIN=http://localhost:3000 npm start
```

Open `http://localhost:3000`.

For local browser testing, the same Node process serves the frontend as well as Socket.IO. Production Netlify uses the static `public/` folder while the Node server runs separately.

## 2. Deploy the backend to Render

1. Push this folder to GitHub.
2. Create a new Render Web Service from the repository, or use the included `render.yaml` Blueprint.
3. Build command: `npm install`.
4. Start command: `npm start`.
5. Set `CLIENT_ORIGIN` to the exact Netlify origin, for example `https://gamehunk.netlify.app`.
6. Deploy and use the deployed Render URL, such as `https://game-hunk-server.onrender.com`.

The server listens on `0.0.0.0` and `process.env.PORT`, and exposes `/health`.

## 3. Deploy the frontend to Netlify

1. Create a Netlify site from the same repository.
2. Netlify reads `netlify.toml` and publishes `public/`.
3. No Node server is required on Netlify.
4. The Socket.IO client connects directly to the Render backend.

## 4. Put the Render URL in the frontend

At the top of `public/app.js`, set the production fallback:

```js
const SOCKET_URL = window.POKER_SERVER_URL || "https://gamb-eu6t.onrender.com";
```

Replace the placeholder with your real Render URL. You can also override it before the app loads with `window.POKER_SERVER_URL`.

## 5. Configure CLIENT_ORIGIN

On Render, set:

`CLIENT_ORIGIN=https://gamehunk.netlify.app`

Use the exact scheme and hostname and do not add a trailing slash. For a temporary multi-origin setup, comma-separate allowed origins.

## 6. How multiplayer works

The browser sends intent only: join room, bet, move, chat, etc. The Node server owns rooms, chips, decks, turns, cards, outcomes and timers. Each room supports up to 8 seats. Hosts are server-assigned; if a host disconnects, a connected player becomes host. Reconnection tokens let a recently disconnected human reclaim their seat.

Texas Hold'em uses explicit `LOBBY`, `PREFLOP`, `FLOP`, `TURN`, `RIVER`, `SHOWDOWN`, and `HAND_COMPLETE` phases. Betting rounds use a deterministic pending-player/required-bet model, so preflop and later streets cannot silently stall. All-in players are removed from action while remaining players continue; if nobody can act, the server deals remaining streets automatically.

Blackjack uses a server-side 52-card deck, dealer stands on all 17s (including soft 17), blackjack pays 3:2, pushes return the wager, and double-down is limited to the first two cards. Roulette uses American 0/00 with server-selected results and standard virtual-chip payouts. Chess uses `chess.js` for legal move validation, check/checkmate/stalemate, castling, en passant and promotion.

## 7. Add bots

The host sees `+ ADD BOT` in a room. Choose a personality and click Add. Bots are server-side players with their own IDs, chips and decision parameters. They use the same legal action handlers as humans and act after short server-side delays.

Supported poker personalities: Ace, Shark, Bluff, Lucky, Dealer, River, Pocket and Wildcard.

## Health check

`GET /health` returns a small JSON status payload.

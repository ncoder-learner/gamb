# Game Hunk

Game Hunk is a Netlify frontend + Node/Express/Socket.IO authoritative multiplayer game server.

## Local

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Accounts

Accounts use server-side password hashing. The current development store is a local `data.json` file; this is suitable for local testing but is **not durable across ephemeral Render restarts**. A production deployment should move account/token/history data to a persistent database before treating it as long-term storage.

New accounts receive 1,000 virtual tokens. Tokens are non-redeemable and have no cash value.

The rebuild adds persistent session hashes, transaction history, game statistics, daily rewards, profile editing, leaderboard data, and server-side quick games.

## Render

Create a Render Web Service from this repository.

- Build: `npm install`
- Start: `npm start`
- Environment: `CLIENT_ORIGIN=https://YOUR-NETLIFY-DOMAIN.netlify.app`

The server listens on `0.0.0.0` and `process.env.PORT`.

## Netlify

Netlify publishes `public/` using `netlify.toml`.

The frontend currently connects to:

`https://gamb-eu6t.onrender.com`

Change `SOCKET_URL` in `public/app.js` if the backend URL changes.

## Shop

The shop sells cosmetic collectibles only. Purchases and equipped items are server-side account data.

## Rewarded ads

The supplied Google publisher script is included in `public/index.html`. The **WATCH AD · +200** control is intentionally not allowed to mint tokens from a browser click. The server currently returns a configuration error until a supported rewarded-ad completion/verification callback is wired to `/api/reward-ad`.

Google's rewarded-ad rules require clear disclosure, affirmative opt-in, and delivery of the promised reward only after the required action is completed. See Google's current rewarded-ad policies before enabling the token grant.

## Multiplayer

Socket.IO connects browsers to the Node server. The server owns rooms, cards, decks, turns, roulette results, blackjack outcomes, and chess legality. Random outcomes use Node's crypto random generator.

## Rebuild status

The rebuild branch is `rebuild/game-hunk-v3`. It adds profile/history/daily/leaderboard APIs, persistent session hashes, quick-play games, and regression tests while preserving the existing multiplayer game engine.

## Required Render environment variable

Set `CLIENT_ORIGIN` to your exact Netlify production URL, for example:

`https://gamehunk.netlify.app`

Do not include a trailing slash.

The frontend sends account API requests to the Render server at `https://gamb-eu6t.onrender.com`.

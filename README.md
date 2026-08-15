# Game Hunk

Game Hunk is a Netlify frontend + Node/Express/Socket.IO authoritative multiplayer game server.

## Local

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Accounts

Accounts use server-side password hashing. A local `data.json` file stores account data. For production persistence across Render restarts/redeploys, move the account store to a persistent database (for example Postgres) before relying on it as a long-term account system.

New accounts start with 1,000 virtual tokens. Creating/joining a room automatically moves up to 1,000 tokens from the vault into the table wallet. Use **DEPOSIT** to return chips to the vault and **WITHDRAW** to move more tokens into the current table.

Tokens are virtual only and have no cash value.

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

Socket.IO connects browsers to the Node server. The server owns rooms, cards, decks, chip balances, turns, roulette results, blackjack outcomes, and chess legality.


## Required Render environment variable

Set `CLIENT_ORIGIN` to your exact Netlify production URL, for example:

`https://gamehunk.netlify.app`

Do not include a trailing slash.

The frontend sends account API requests to the Render server at `https://gamb-eu6t.onrender.com`.

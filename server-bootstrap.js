const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATA_FILE = path.join(__dirname, 'data.json');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required for Game Hunk persistence.');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

function normalizeAccount(row) {
  return {
    id: row.id,
    name: row.name,
    passwordHash: row.password_hash,
    salt: row.password_salt,
    tokens: Number(row.tokens || 0),
    inventory: row.inventory || [],
    equipped: row.equipped || {},
    sessions: row.sessions || [],
    history: row.history || [],
    stats: row.stats || {gamesPlayed:0,wins:0,losses:0,largestWin:0,byGame:{}},
    daily: row.daily || {lastClaim:null,streak:0},
    refill: row.refill || {lastClaim:0},
    createdAt: Number(row.created_at || Date.now()),
  };
}

async function readDatabase() {
  const { rows } = await pool.query('select * from public.game_accounts order by created_at asc');
  return Object.fromEntries(rows.map(row => [row.id, normalizeAccount(row)]));
}

async function writeDatabase(accounts) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const account of Object.values(accounts)) {
      await client.query(
        `insert into public.game_accounts
          (id,name,password_hash,password_salt,tokens,inventory,equipped,sessions,history,stats,daily,refill,created_at)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13)
         on conflict (id) do update set
          name=excluded.name,
          password_hash=excluded.password_hash,
          password_salt=excluded.password_salt,
          tokens=excluded.tokens,
          inventory=excluded.inventory,
          equipped=excluded.equipped,
          sessions=excluded.sessions,
          history=excluded.history,
          stats=excluded.stats,
          daily=excluded.daily,
          refill=excluded.refill,
          created_at=excluded.created_at`,
        [
          account.id,
          account.name,
          account.passwordHash,
          account.salt,
          Math.max(0, Math.floor(Number(account.tokens) || 0)),
          JSON.stringify(Array.isArray(account.inventory) ? account.inventory : []),
          JSON.stringify(account.equipped || {}),
          JSON.stringify(Array.isArray(account.sessions) ? account.sessions : []),
          JSON.stringify(Array.isArray(account.history) ? account.history : []),
          JSON.stringify(account.stats || {}),
          JSON.stringify(account.daily || {}),
          JSON.stringify(account.refill || {}),
          Number(account.createdAt || Date.now()),
        ]
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function syncLogs(accounts) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const account of Object.values(accounts)) {
      const history = Array.isArray(account.history) ? account.history : [];
      await client.query('delete from public.game_transactions where account_id=$1', [account.id]);
      await client.query('delete from public.game_history where account_id=$1', [account.id]);

      for (const item of history) {
        const meta = item.meta == null ? null : JSON.stringify(item.meta);
        await client.query(
          `insert into public.game_transactions
           (id,account_id,amount,type,game,meta,created_at)
           values ($1,$2,$3,$4,$5,$6::jsonb,$7)
           on conflict (id) do nothing`,
          [item.id, account.id, Number(item.amount || 0), item.type || 'unknown', item.game || null, meta, Number(item.timestamp || Date.now())]
        );

        if (String(item.type || '').startsWith('game_')) {
          const result = item.meta?.result || (item.type === 'game_payout' ? 'win' : item.type === 'game_loss' ? 'loss' : 'push');
          const payout = Number(item.meta?.payout || 0);
          await client.query(
            `insert into public.game_history
             (id,account_id,game,net,result,payout,meta,created_at)
             values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
             on conflict (id) do nothing`,
            [item.id, account.id, item.game || 'unknown', Number(item.amount || 0), result, payout, meta, Number(item.timestamp || Date.now())]
          );
        }
      }
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function bootstrap() {
  await pool.query('select 1');

  const localExists = fs.existsSync(DATA_FILE);
  const local = localExists ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}') : {};
  const databaseAccounts = await readDatabase();

  if (Object.keys(databaseAccounts).length > 0) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(databaseAccounts, null, 2));
  } else if (Object.keys(local).length > 0) {
    await writeDatabase(local);
    await syncLogs(local);
  } else {
    fs.writeFileSync(DATA_FILE, '{}');
  }

  let last = '';
  let syncing = false;

  const sync = async () => {
    if (syncing || !fs.existsSync(DATA_FILE)) return;
    try {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      if (content === last) return;
      const accounts = JSON.parse(content || '{}');
      syncing = true;
      await writeDatabase(accounts);
      await syncLogs(accounts);
      last = content;
    } catch (error) {
      console.error('[db-sync]', error.message);
    } finally {
      syncing = false;
    }
  };

  await sync();

  setInterval(sync, 500);
  process.on('SIGTERM', async () => {
    await sync();
    await pool.end();
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    await sync();
    await pool.end();
    process.exit(0);
  });

  require('./server.js');
}

bootstrap().catch(error => {
  console.error('[db-bootstrap] Failed to initialize Supabase persistence:', error);
  process.exit(1);
});

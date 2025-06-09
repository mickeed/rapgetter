import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// === RAP Caching ===
const resaleCache = {}; // assetId -> { price: number, timestamp: number }
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

async function fetchAllCollectibles(userId) {
  let collectibles = [];
  let cursor = null;

  do {
    const url = `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100&sortOrder=Asc${cursor ? `&cursor=${cursor}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch collectibles: ${res.status}`);
    const data = await res.json();
    collectibles = collectibles.concat(data.data);
    cursor = data.nextPageCursor || null;
  } while (cursor);

  return collectibles;
}

async function fetchResalePrice(assetId) {
  const now = Date.now();

  // Return from cache if valid
  if (resaleCache[assetId] && now - resaleCache[assetId].timestamp < CACHE_TTL_MS) {
    return resaleCache[assetId].price;
  }

  const url = `https://economy.roblox.com/v1/assets/${assetId}/resale-data`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch resale data for asset ${assetId}: ${res.status}`);
  const data = await res.json();
  const price = data.recentAveragePrice || 0;

  // Cache it
  resaleCache[assetId] = { price, timestamp: now };
  return price;
}

async function calculateRAP(userId) {
  try {
    console.log(`Fetching collectibles for user ${userId}...`);
    const collectibles = await fetchAllCollectibles(userId);
    console.log(`Found ${collectibles.length} collectibles.`);

    // Count how many of each asset
    const assetCounts = {};
    for (const item of collectibles) {
      const assetId = item.assetId;
      assetCounts[assetId] = (assetCounts[assetId] || 0) + 1;
    }

    let totalRAP = 0;
    const assetIds = Object.keys(assetCounts);

    console.log(`Fetching resale prices for ${assetIds.length} unique assets...`);

    for (const assetId of assetIds) {
      try {
        const averagePrice = await fetchResalePrice(assetId);
        const quantity = assetCounts[assetId];
        totalRAP += averagePrice * quantity;
        console.log(`Asset ${assetId}: quantity ${quantity}, recentAveragePrice ${averagePrice}, subtotal ${averagePrice * quantity}`);
      } catch (assetErr) {
        console.warn(`Error fetching asset ${assetId}:`, assetErr.message);
      }
    }

    console.log(`Total RAP for user ${userId}: ${totalRAP}`);
    return totalRAP;
  } catch (err) {
    console.error("Error calculating RAP:", err.message);
    return null;
  }
}

// === API endpoint ===
app.get('/rap/:userId', async (req, res) => {
  const userId = req.params.userId;
  if (!userId) return res.status(400).json({ success: false, error: 'Missing userId' });

  const rap = await calculateRAP(userId);
  if (rap === null) {
    return res.status(500).json({ success: false, error: 'Failed to calculate RAP' });
  }

  res.json({ rap });
});

// === Simple Test Frontend ===
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>RAP Checker</title></head>
      <body style="font-family: sans-serif;">
        <h2>Check Roblox User RAP</h2>
        <form method="GET" action="/rap">
          <label>User ID: <input type="text" name="userId" required /></label>
          <button type="submit">Check</button>
        </form>
      </body>
    </html>
  `);
});

// Optional: allow ?userId=... in query
app.get('/rap', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.send("Missing userId in query");

  const rap = await calculateRAP(userId);
  res.send(`Estimated RAP for user ${userId}: ${rap !== null ? rap : "Error retrieving data"}`);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

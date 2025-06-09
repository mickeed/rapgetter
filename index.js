import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

// Fetch all collectibles for a given user
async function fetchAllCollectibles(userId) {
  let collectibles = [];
  let cursor = null;

  do {
    const url = `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100&sortOrder=Asc${cursor ? `&cursor=${cursor}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch collectibles: ${res.status}`);
    }
    const data = await res.json();
    collectibles = collectibles.concat(data.data);
    cursor = data.nextPageCursor || null;
  } while (cursor);

  return collectibles;
}

// Fetch resale price for a given asset
async function fetchResalePrice(assetId) {
  const url = `https://economy.roblox.com/v1/assets/${assetId}/resale-data`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch resale data for asset ${assetId}: ${res.status}`);
  }
  const data = await res.json();
  console.log(`Resale data for asset ${assetId}:`, data);

  return data.recentAveragePrice || data.lowestPrice || 0;
}

// Calculate RAP for all collectibles owned by a user
async function calculateRAP(userId) {
  try {
    console.log(`Fetching collectibles for user ${userId}...`);
    const collectibles = await fetchAllCollectibles(userId);
    console.log(`Found ${collectibles.length} collectibles.`);

    const assetCounts = {};
    for (const item of collectibles) {
      const assetId = item.assetId;
      assetCounts[assetId] = (assetCounts[assetId] || 0) + 1;
    }

    let totalRAP = 0;
    const assetIds = Object.keys(assetCounts);

    console.log(`Fetching resale prices for ${assetIds.length} unique assets...`);

    for (const assetId of assetIds) {
      const rap = await fetchResalePrice(assetId);
      const quantity = assetCounts[assetId];
      totalRAP += rap * quantity;
      console.log(`Asset ${assetId}: quantity ${quantity}, recentAveragePrice ${rap}, subtotal ${rap * quantity}`);
    }

    console.log(`Total RAP for user ${userId}: ${totalRAP}`);
    return totalRAP;

  } catch (error) {
    console.error("Error calculating RAP:", error);
    return 0;
  }
}

// Express route to return RAP
app.get('/rap/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    const totalRAP = await calculateRAP(userId);
    res.json({ rap: totalRAP }); // ✅ Return RAP to the user
  } catch (error) {
    console.error("Error in /rap route:", error);
    res.status(500).json({ error: 'Failed to calculate RAP' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

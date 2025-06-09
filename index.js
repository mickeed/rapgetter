import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

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

async function fetchResalePrice(assetId) {
  const url = `https://economy.roblox.com/v1/assets/${assetId}/resale-data`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch resale data for asset ${assetId}: ${res.status}`);
  }
  const data = await res.json();
  // Use lowest price or average price, or fallback to 0
  return data.lowestPrice || data.averagePrice || 0;
}

async function calculateRAP(userId) {
  try {
    const collectibles = await fetchAllCollectibles(userId);

    // Group collectibles by assetId and count quantity
    const assetCounts = {};
    for (const item of collectibles) {
      const assetId = item.assetId;
      assetCounts[assetId] = (assetCounts[assetId] || 0) + 1;
    }

    let totalRAP = 0;
    const assetIds = Object.keys(assetCounts);

    for (const assetId of assetIds) {
      const price = await fetchResalePrice(assetId);
      const quantity = assetCounts[assetId];
      totalRAP += price * quantity;
    }

    return totalRAP;
  } catch (error) {
    console.error("Error calculating RAP:", error);
    throw error;
  }
}

// API endpoint: GET /rap/:userId
app.get('/rap/:userId', async (req, res) => {
  const userId = req.params.userId;
  if (!userId || isNaN(userId)) {
    return res.status(400).json({ success: false, message: 'Invalid userId' });
  }

  try {
    const rap = await calculateRAP(userId);
    res.json({ success: true, userId, rap });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

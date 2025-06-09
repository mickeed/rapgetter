import fetch from 'node-fetch';

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
    // If no resale data found, treat price as 0
    console.log(`No resale data for asset ${assetId} (status ${res.status}), treating price as 0.`);
    return 0;
  }
  const data = await res.json();
  console.log(`Resale data for asset ${assetId}:`, data);

  // Use recentAveragePrice as the RAP price, fallback to 0
  return data.recentAveragePrice || 0;
}

async function calculateRAP(userId) {
  try {
    console.log(`Fetching collectibles for user ${userId}...`);
    const collectibles = await fetchAllCollectibles(userId);
    console.log(`Found ${collectibles.length} collectibles.`);

    // Count quantity per assetId
    const assetCounts = {};
    for (const item of collectibles) {
      const assetId = item.assetId;
      assetCounts[assetId] = (assetCounts[assetId] || 0) + 1;
    }

    let totalRAP = 0;
    const assetIds = Object.keys(assetCounts);

    console.log(`Fetching resale prices for ${assetIds.length} unique assets...`);

    for (const assetId of assetIds) {
      const price = await fetchResalePrice(assetId);
      const quantity = assetCounts[assetId];
      const subtotal = price * quantity;
      totalRAP += subtotal;
      console.log(`Asset ${assetId}: quantity ${quantity}, recentAveragePrice ${price}, subtotal ${subtotal}`);
    }

    console.log(`Total RAP for user ${userId}: ${totalRAP}`);

    return totalRAP;
  } catch (error) {
    console.error("Error calculating RAP:", error);
    return null;
  }
}

// Example usage:
const testUserId = 22746766; // Replace with actual userId
calculateRAP(testUserId).then(rap => {
  console.log("Estimated RAP:", rap);
});

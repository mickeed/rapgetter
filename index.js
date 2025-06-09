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
    throw new Error(`Failed to fetch resale data for asset ${assetId}: ${res.status}`);
  }
  const data = await res.json();
  console.log(`Resale data for asset ${assetId}:`, data);
  
  // Use lowest price or average price, or fallback to 0
  return data.lowestPrice || data.averagePrice || 0;
}






async function calculateRAP(userId) {
  try {
    console.log(`Fetching collectibles for user ${userId}...`);
    const collectibles = await fetchAllCollectibles(userId);
    console.log(`Found ${collectibles.length} collectibles.`);

    // Group collectibles by assetId and count quantity
    const assetCounts = {};
    for (const item of collectibles) {
      const assetId = item.assetId;
      assetCounts[assetId] = (assetCounts[assetId] || 0) + 1;
    }

    let totalRAP = 0;
    const assetIds = Object.keys(assetCounts);

    console.log(`Fetching resale prices for ${assetIds.length} unique assets...`);

    for (const assetId of assetIds) {
      const averagePrice = await fetchResalePrice(assetId);
      const quantity = assetCounts[assetId];
      totalRAP += averagePrice * quantity;
      console.log(`Asset ${assetId}: quantity ${quantity}, average price ${averagePrice}, subtotal ${averagePrice * quantity}`);
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

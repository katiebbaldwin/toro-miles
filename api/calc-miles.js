export default async function handler(req, res) {
  // Allow Webflow to call this endpoint
  res.setHeader("Access-Control-Allow-Origin", "https://YOUR-WEBFLOW-DOMAIN.com");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { stops } = req.body || {};
    if (!Array.isArray(stops) || stops.length < 2) {
      return res.status(400).json({ error: "stops must be an array with at least 2 addresses" });
    }

    const originAddress = stops[0];
    const destinationAddress = stops[stops.length - 1];
    const intermediateStops = stops.slice(1, -1);

    const googleResp = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
        // Field mask is required; request only distance for speed/cost
        "X-Goog-FieldMask": "routes.distanceMeters"
      },
      body: JSON.stringify({
        origin: { address: originAddress },
        destination: { address: destinationAddress },
        intermediates: intermediateStops.map(a => ({ address: a })),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE"
      })
    });

    const data = await googleResp.json();

    if (!googleResp.ok) {
      return res.status(502).json({ error: "Google Routes error", details: data });
    }

    const meters = data?.routes?.[0]?.distanceMeters;
    if (typeof meters !== "number") {
      return res.status(404).json({ error: "No route found", details: data });
    }

    const miles = meters / 1609.344;
    return res.status(200).json({ miles: Number(miles.toFixed(1)) });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}

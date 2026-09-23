const EARTH_RADIUS_METERS = 6371000;
export const DEFAULT_LOCATION_THRESHOLD_METERS = 50;

export function validCoordinates(latitude, longitude) {
  return typeof latitude === "number" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && typeof longitude === "number" && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!validCoordinates(lat1, lon1) || !validCoordinates(lat2, lon2)) throw new Error("Valid latitude and longitude are required.");
  const radians = (degrees) => degrees * Math.PI / 180;
  const deltaLat = radians(lat2 - lat1);
  const deltaLon = radians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
}

export function isWithinThreshold(distance, threshold = DEFAULT_LOCATION_THRESHOLD_METERS) {
  return Number.isFinite(distance) && distance >= 0 && Number.isFinite(threshold) && threshold > 0 && distance <= threshold;
}

export function getLocationVerificationStatus(before, after, threshold = DEFAULT_LOCATION_THRESHOLD_METERS) {
  if (!Number.isFinite(threshold) || threshold <= 0) throw new Error("A positive location threshold is required.");
  if (!before || !after || !validCoordinates(before.latitude, before.longitude) || !validCoordinates(after.latitude, after.longitude)) {
    return { verified: false, status: "missing", distanceMeters: null, thresholdMeters: threshold, note: "Confirmed before and after coordinates are required." };
  }
  const distance = calculateDistanceMeters(before.latitude, before.longitude, after.latitude, after.longitude);
  const accuracy = Math.max(before.accuracy || 0, after.accuracy || 0);
  const manual = [before.source, after.source].some((source) => ["manual", "map", "search"].includes(source));
  const confirmed = before.confirmed !== false && after.confirmed !== false;
  const within = isWithinThreshold(distance, threshold);
  const poorAccuracy = accuracy > threshold;
  const verified = within && confirmed && !poorAccuracy;
  return { verified, status: !confirmed ? "unconfirmed" : poorAccuracy ? "low-accuracy" : within ? "verified" : "mismatch", distanceMeters: Math.round(distance * 10) / 10, thresholdMeters: threshold, accuracyMeters: accuracy || null, requiresReview: manual, note: !confirmed ? "Confirm both locations before verification." : poorAccuracy ? "Reported device accuracy exceeds the threshold. Capture a more accurate location or request an authority review." : within ? `Reported coordinates are within ${threshold} metres.${manual ? " A location was manually supplied and requires authority review." : " Device coordinates and metadata are not proof of capture authenticity."}` : "After-evidence is outside the configured location threshold. Review the location before resolution." };
}

// יוצרת (או מחזירה קיים) מזהה ייחודי וקבוע למכשיר/דפדפן הזה,
// כדי שנוכל לזהות "מי אני" בלי מערכת הרשמה אמיתית
export function getClientId() {
  const STORAGE_KEY = 'livebeat_client_id';
  let clientId = localStorage.getItem(STORAGE_KEY);

  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, clientId);
  }

  return clientId;
}
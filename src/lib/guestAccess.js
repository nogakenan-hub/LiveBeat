const STORAGE_KEY = 'rezo_guest_rooms';

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

// מחזירה את השם ששמור עבור חדר מסוים (או null אם אין)
export function getGuestRoomName(roomId) {
  const store = readStore();
  return store[roomId] || null;
}

// שומרת שהאורחת הזו קיבלה גישה לחדר הזה, עם השם שהזינה
export function saveGuestRoomAccess(roomId, name) {
  const store = readStore();
  store[roomId] = name;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// מחזירה את כל מזהי החדרים ששמורים לאורחת הזו, עם השמות שלה בכל אחד
export function getAllGuestRooms() {
  return readStore();
}
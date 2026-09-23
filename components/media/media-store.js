'use client';

const DATABASE = 'jharkhand-innovation-evidence';
let connection;
function openDatabase() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('media');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { connection = null; reject(new Error('Browser storage is unavailable. Enable site storage to keep demo evidence.')); };
  });
  return connection;
}
export async function saveLocalMedia(id, file) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('media', 'readwrite');
    transaction.objectStore('media').put(file, id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(new Error('There is not enough browser storage for this file. Try a smaller file.'));
  });
}
export async function getLocalMediaUrl(id) {
  const database = await openDatabase();
  const blob = await new Promise((resolve, reject) => {
    const request = database.transaction('media', 'readonly').objectStore('media').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return blob ? URL.createObjectURL(blob) : null;
}


/**
 * Offline Storage using IndexedDB
 * Provides persistent storage for menu items, orders, and sync queue
 */

const DB_NAME = 'chiyadani-offline';
const DB_VERSION = 1;

interface SyncQueueItem {
  id: string;
  type: 'order' | 'waiterCall';
  data: any;
  timestamp: number;
  retries: number;
}

class OfflineStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private isUnavailable = false; // Track if IndexedDB is unavailable

  async init(): Promise<void> {
    // If IndexedDB is known to be unavailable, skip silently
    if (this.isUnavailable) return;
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    // Check if IndexedDB is available at all
    if (typeof indexedDB === 'undefined') {
      console.warn('[OfflineStorage] IndexedDB not available in this environment');
      this.isUnavailable = true;
      return;
    }

    this.initPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          console.warn('[OfflineStorage] Failed to open IndexedDB:', request.error?.message || 'Unknown error');
          // Mark as unavailable and resolve (don't reject) to prevent crashes
          this.isUnavailable = true;
          this.initPromise = null;
          resolve();
        };

        request.onsuccess = () => {
          this.db = request.result;

          // If the browser closes the connection (navigation/reload/version change),
          // reset state so future calls can re-init cleanly.
          this.db.onclose = () => {
            this.db = null;
            this.initPromise = null;
          };
          this.db.onversionchange = () => {
            try {
              this.db?.close();
            } finally {
              this.db = null;
              this.initPromise = null;
            }
          };

          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Store for cached menu items
          if (!db.objectStoreNames.contains('menuItems')) {
            db.createObjectStore('menuItems', { keyPath: 'id' });
          }

          // Store for cached categories
          if (!db.objectStoreNames.contains('categories')) {
            db.createObjectStore('categories', { keyPath: 'id' });
          }

          // Store for offline orders (pending sync)
          if (!db.objectStoreNames.contains('syncQueue')) {
            const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
            syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          }

          // Store for settings cache
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }

          // Store for cached images (blob URLs)
          if (!db.objectStoreNames.contains('imageCache')) {
            db.createObjectStore('imageCache', { keyPath: 'url' });
          }
        };
      } catch (err) {
        console.warn('[OfflineStorage] IndexedDB initialization error:', err);
        this.isUnavailable = true;
        this.initPromise = null;
        resolve();
      }
    });

    return this.initPromise;
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore | null> {
    await this.init();
    // If IndexedDB is unavailable, return null (callers should handle gracefully)
    if (this.isUnavailable || !this.db) return null;

    try {
      const tx = this.db.transaction(storeName, mode);
      return tx.objectStore(storeName);
    } catch (err) {
      // Typical when the DB is closing during navigation or a versionchange.
      if (err instanceof DOMException && err.name === 'InvalidStateError') {
        this.db = null;
        this.initPromise = null;
        await this.init();
        if (this.isUnavailable || !this.db) return null;
        const tx = this.db.transaction(storeName, mode);
        return tx.objectStore(storeName);
      }
      console.warn('[OfflineStorage] Error getting store:', err);
      return null;
    }
  }

  // Menu Items
  async cacheMenuItems(items: any[]): Promise<void> {
    const store = await this.getStore('menuItems', 'readwrite');
    if (!store) return; // IndexedDB unavailable, skip silently
    
    const tx = store.transaction;
    
    // Clear existing
    store.clear();
    
    // Add new items
    for (const item of items) {
      store.put(item);
    }

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // Don't reject, just resolve
    });
  }

  async getMenuItems(): Promise<any[]> {
    const store = await this.getStore('menuItems');
    if (!store) return []; // IndexedDB unavailable, return empty
    
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]); // Return empty on error
    });
  }

  // Categories
  async cacheCategories(categories: any[]): Promise<void> {
    const store = await this.getStore('categories', 'readwrite');
    if (!store) return;
    
    const tx = store.transaction;
    
    store.clear();
    for (const cat of categories) {
      store.put(cat);
    }

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async getCategories(): Promise<any[]> {
    const store = await this.getStore('categories');
    if (!store) return [];
    
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  }

  // Sync Queue (for offline orders)
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    const store = await this.getStore('syncQueue', 'readwrite');
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    if (!store) return id; // Return ID even if storage unavailable
    
    const queueItem: SyncQueueItem = {
      ...item,
      id,
      timestamp: Date.now(),
      retries: 0
    };

    return new Promise((resolve) => {
      const request = store.put(queueItem);
      request.onsuccess = () => resolve(id);
      request.onerror = () => resolve(id);
    });
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const store = await this.getStore('syncQueue');
    if (!store) return [];
    
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  }

  async removeFromSyncQueue(id: string): Promise<void> {
    const store = await this.getStore('syncQueue', 'readwrite');
    if (!store) return;
    
    return new Promise((resolve) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  async updateSyncQueueItem(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
    const store = await this.getStore('syncQueue', 'readwrite');
    if (!store) return;
    
    return new Promise((resolve) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          const updated = { ...item, ...updates };
          const putRequest = store.put(updated);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => resolve();
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => resolve();
    });
  }

  // Settings cache
  async cacheSetting(key: string, value: any): Promise<void> {
    const store = await this.getStore('settings', 'readwrite');
    if (!store) return;
    
    return new Promise((resolve) => {
      const request = store.put({ key, value, updatedAt: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  async getSetting(key: string): Promise<any | null> {
    const store = await this.getStore('settings');
    if (!store) return null;
    
    return new Promise((resolve) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value ?? null);
      request.onerror = () => resolve(null);
    });
  }

  // Check if we have cached data
  async hasCachedData(): Promise<boolean> {
    try {
      const items = await this.getMenuItems();
      return items.length > 0;
    } catch {
      return false;
    }
  }

  // Clear all caches
  async clearAll(): Promise<void> {
    await this.init();
    if (this.isUnavailable || !this.db) return;

    const stores = ['menuItems', 'categories', 'settings', 'imageCache'];
    for (const storeName of stores) {
      const store = await this.getStore(storeName, 'readwrite');
      if (store) store.clear();
    }
  }
}

// Singleton instance
export const offlineStorage = new OfflineStorage();

// Background sync manager
export class BackgroundSync {
  private static isProcessing = false;

  static async processSyncQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (!navigator.onLine) return;

    this.isProcessing = true;

    try {
      const queue = await offlineStorage.getSyncQueue();
      
      for (const item of queue) {
        try {
          // Attempt to sync based on type
          if (item.type === 'order') {
            const response = await fetch('/api/orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.data)
            });

            if (response.ok) {
              await offlineStorage.removeFromSyncQueue(item.id);
              console.log('Synced offline order:', item.id);
            } else {
              throw new Error(`Failed to sync order: ${response.status}`);
            }
          } else if (item.type === 'waiterCall') {
            const response = await fetch('/api/waiter-calls', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.data)
            });

            if (response.ok) {
              await offlineStorage.removeFromSyncQueue(item.id);
            }
          }
        } catch (error) {
          console.error('Failed to sync item:', item.id, error);
          // Increment retry count
          await offlineStorage.updateSyncQueueItem(item.id, {
            retries: item.retries + 1
          });

          // Remove if too many retries
          if (item.retries >= 5) {
            await offlineStorage.removeFromSyncQueue(item.id);
            console.error('Removed item after max retries:', item.id);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  static startAutoSync(intervalMs = 30000): () => void {
    // Process immediately
    this.processSyncQueue();

    // Set up interval
    const intervalId = setInterval(() => {
      this.processSyncQueue();
    }, intervalMs);

    // Listen for online events
    const onlineHandler = () => {
      console.log('Back online, processing sync queue...');
      this.processSyncQueue();
    };
    window.addEventListener('online', onlineHandler);

    // Return cleanup function
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('online', onlineHandler);
    };
  }
}

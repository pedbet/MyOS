// IndexedDB storage layer for MyOS

import { stringUtils } from './utils.js';

const DB_NAME = 'myos-db';
const DB_VERSION = 1;

// Store names
const STORES = {
    checkins: 'checkins',
    tasks: 'tasks',
    habits: 'habits',
    habitLogs: 'habit_logs',
    prayers: 'prayers',
    prayerLogs: 'prayer_logs',
    journal: 'journal_entries',
    actionLogs: 'action_logs',
    settings: 'settings',
    labels: 'labels'
};

class Storage {
    constructor() {
        this.db = null;
        this.initPromise = null;
    }

    // Initialize IndexedDB
    async init() {
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores
                Object.values(STORES).forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        const store = db.createObjectStore(storeName, { keyPath: 'id' });
                        
                        // Create indexes during store creation
                        switch (storeName) {
                            case STORES.checkins:
                                store.createIndex('deleted_at', 'deleted_at');
                                store.createIndex('labels', 'labels', { multiEntry: true });
                                break;
                            case STORES.tasks:
                                store.createIndex('status', 'status');
                                store.createIndex('created_at', 'created_at');
                                store.createIndex('due_at', 'due_at');
                                store.createIndex('deleted_at', 'deleted_at');
                                store.createIndex('labels', 'labels', { multiEntry: true });
                                break;
                            case STORES.habits:
                                store.createIndex('archived_at', 'archived_at');
                                store.createIndex('deleted_at', 'deleted_at');
                                store.createIndex('labels', 'labels', { multiEntry: true });
                                break;
                            case STORES.habitLogs:
                                store.createIndex('habit_id', 'habit_id');
                                store.createIndex('date', 'date');
                                store.createIndex('deleted_at', 'deleted_at');
                                break;
                            case STORES.prayers:
                                store.createIndex('deleted_at', 'deleted_at');
                                store.createIndex('labels', 'labels', { multiEntry: true });
                                break;
                            case STORES.prayerLogs:
                                store.createIndex('prayer_id', 'prayer_id');
                                store.createIndex('date', 'date');
                                store.createIndex('deleted_at', 'deleted_at');
                                break;
                            case STORES.journal:
                                store.createIndex('date', 'date');
                                store.createIndex('deleted_at', 'deleted_at');
                                break;
                            case STORES.actionLogs:
                                store.createIndex('entity_type', 'entity_type');
                                store.createIndex('entity_id', 'entity_id');
                                store.createIndex('timestamp', 'timestamp');
                                break;
                        }
                    }
                });
            };
        });

        return this.initPromise;
    }

    // Generic CRUD operations
    async create(storeName, data) {
        await this.init();
        
        const item = {
            id: stringUtils.generateId(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...data
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(item);

            request.onsuccess = () => resolve(item);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, id) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName, filter = {}) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                let results = request.result || [];

                // Apply filters
                if (filter.deleted_at === false) {
                    results = results.filter(item => !item.deleted_at);
                } else if (filter.deleted_at === true) {
                    results = results.filter(item => item.deleted_at);
                }

                if (filter.status) {
                    results = results.filter(item => item.status === filter.status);
                }

                if (filter.date) {
                    results = results.filter(item => item.date === filter.date);
                }

                if (filter.habit_id) {
                    results = results.filter(item => item.habit_id === filter.habit_id);
                }

                if (filter.prayer_id) {
                    results = results.filter(item => item.prayer_id === filter.prayer_id);
                }

                // Sort by updated_at descending by default
                results.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async update(storeName, id, data) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // Get existing item first
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const existing = getRequest.result;
                if (!existing) {
                    reject(new Error('Item not found'));
                    return;
                }

                const updated = {
                    ...existing,
                    ...data,
                    updated_at: new Date().toISOString()
                };

                const putRequest = store.put(updated);
                putRequest.onsuccess = () => resolve(updated);
                putRequest.onerror = () => reject(putRequest.error);
            };
            
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async delete(storeName, id, soft = true) {
        await this.init();

        if (soft) {
            return this.update(storeName, id, { deleted_at: new Date().toISOString() });
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(id);

                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        }
    }

    // Store-specific methods
    async createCheckin(data) {
        return this.create(STORES.checkins, data);
    }

    async getCheckins(filter = {}) {
        return this.getAll(STORES.checkins, { deleted_at: false, ...filter });
    }

    async updateCheckin(id, data) {
        return this.update(STORES.checkins, id, data);
    }

    async deleteCheckin(id, soft = true) {
        return this.delete(STORES.checkins, id, soft);
    }

    async createTask(data) {
        return this.create(STORES.tasks, data);
    }

    async getTasks(filter = {}) {
        return this.getAll(STORES.tasks, { deleted_at: false, ...filter });
    }

    async updateTask(id, data) {
        return this.update(STORES.tasks, id, data);
    }

    async deleteTask(id, soft = true) {
        return this.delete(STORES.tasks, id, soft);
    }

    async createHabit(data) {
        return this.create(STORES.habits, data);
    }

    async getHabits(filter = {}) {
        return this.getAll(STORES.habits, { deleted_at: false, ...filter });
    }

    async updateHabit(id, data) {
        return this.update(STORES.habits, id, data);
    }

    async deleteHabit(id, soft = true) {
        return this.delete(STORES.habits, id, soft);
    }

    async createHabitLog(data) {
        return this.create(STORES.habitLogs, data);
    }

    async getHabitLogs(filter = {}) {
        return this.getAll(STORES.habitLogs, { deleted_at: false, ...filter });
    }

    async updateHabitLog(id, data) {
        return this.update(STORES.habitLogs, id, data);
    }

    async deleteHabitLog(id, soft = true) {
        return this.delete(STORES.habitLogs, id, soft);
    }

    async createPrayer(data) {
        return this.create(STORES.prayers, data);
    }

    async getPrayers(filter = {}) {
        return this.getAll(STORES.prayers, { deleted_at: false, ...filter });
    }

    async updatePrayer(id, data) {
        return this.update(STORES.prayers, id, data);
    }

    async deletePrayer(id, soft = true) {
        return this.delete(STORES.prayers, id, soft);
    }

    async createPrayerLog(data) {
        return this.create(STORES.prayerLogs, data);
    }

    async getPrayerLogs(filter = {}) {
        return this.getAll(STORES.prayerLogs, { deleted_at: false, ...filter });
    }

    async updatePrayerLog(id, data) {
        return this.update(STORES.prayerLogs, id, data);
    }

    async deletePrayerLog(id, soft = true) {
        return this.delete(STORES.prayerLogs, id, soft);
    }

    async createJournalEntry(data) {
        return this.create(STORES.journal, data);
    }

    async getJournalEntries(filter = {}) {
        return this.getAll(STORES.journal, { deleted_at: false, ...filter });
    }

    async updateJournalEntry(id, data) {
        return this.update(STORES.journal, id, data);
    }

    async deleteJournalEntry(id, soft = true) {
        return this.delete(STORES.journal, id, soft);
    }

    async createActionLog(data) {
        return this.create(STORES.actionLogs, data);
    }

    async getActionLogs(filter = {}) {
        return this.getAll(STORES.actionLogs, filter);
    }

    // Settings
    async getSetting(key) {
        await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.settings], 'readonly');
            const store = transaction.objectStore(STORES.settings);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => reject(request.error);
        });
    }

    async setSetting(key, value) {
        await this.init();

        const setting = {
            id: key,
            value,
            updated_at: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.settings], 'readwrite');
            const store = transaction.objectStore(STORES.settings);
            const request = store.put(setting);

            request.onsuccess = () => resolve(setting);
            request.onerror = () => reject(request.error);
        });
    }

    // Clear all data (for development/reset)
    async clearAll() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(Object.values(STORES), 'readwrite');
            
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);

            Object.values(STORES).forEach(storeName => {
                const store = transaction.objectStore(storeName);
                store.clear();
            });
        });
    }
}

// Export singleton instance
export const storage = new Storage();

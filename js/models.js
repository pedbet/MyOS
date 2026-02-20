// Data models for MyOS domains

import { dateUtils, validationUtils } from './utils.js';
import { storage } from './storage.js';

// Base model class
class BaseModel {
    constructor(data) {
        this.id = data.id;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.deleted_at = data.deleted_at;
        this.labels = data.labels || [];
    }

    static async create(data) {
        const instance = new this(data);
        return instance.save();
    }

    static async find(id) {
        const data = await storage.get(this.storeName, id);
        return data ? new this(data) : null;
    }

    static async findAll(filter = {}) {
        const items = await storage.getAll(this.storeName, { deleted_at: false, ...filter });
        return items.map(data => new this(data));
    }

    async save() {
        if (this.id) {
            return storage.update(this.constructor.storeName, this.id, this.toJSON());
        } else {
            return storage.create(this.constructor.storeName, this.toJSON());
        }
    }

    async delete(soft = true) {
        if (soft) {
            this.deleted_at = new Date().toISOString();
            return this.save();
        } else {
            return storage.delete(this.constructor.storeName, this.id, false);
        }
    }

    toJSON() {
        const data = { ...this };
        delete data.constructor;
        return data;
    }
}

// Check-in model
export class Checkin extends BaseModel {
    static storeName = 'checkins';

    constructor(data) {
        super(data);
        this.title = data.title;
        this.frequency_value = data.frequency_value;
        this.frequency_unit = data.frequency_unit;
        this.yellow_value = data.yellow_value;
        this.yellow_unit = data.yellow_unit;
        this.red_value = data.red_value;
        this.red_unit = data.red_unit;
        this.first_due_at = data.first_due_at;
        this.last_checkin_at = data.last_checkin_at;
    }

    static async create(data) {
        // Validate duration fields
        const freqValidation = validationUtils.validateDuration(data.frequency_value, data.frequency_unit);
        if (!freqValidation.isValid) {
            throw new Error(`Invalid frequency: ${freqValidation.error}`);
        }

        const yellowValidation = validationUtils.validateDuration(data.yellow_value, data.yellow_unit);
        if (!yellowValidation.isValid) {
            throw new Error(`Invalid yellow threshold: ${yellowValidation.error}`);
        }

        const redValidation = validationUtils.validateDuration(data.red_value, data.red_unit);
        if (!redValidation.isValid) {
            throw new Error(`Invalid red threshold: ${redValidation.error}`);
        }

        // Set default first_due_at if not provided
        if (!data.first_due_at) {
            data.first_due_at = new Date().toISOString();
        }

        return super.create(data);
    }

    getStatus() {
        const now = new Date();
        const anchor = this.last_checkin_at ? new Date(this.last_checkin_at) : new Date(this.first_due_at);
        
        // Calculate yellow and red thresholds using calendar-aware math
        const yellowAt = dateUtils.addDuration(
            dateUtils.addDuration(anchor, this.frequency_value, this.frequency_unit),
            this.yellow_value,
            this.yellow_unit
        );
        
        const redAt = dateUtils.addDuration(
            dateUtils.addDuration(anchor, this.frequency_value, this.frequency_unit),
            this.red_value,
            this.red_unit
        );

        if (now < yellowAt) return 'GREEN';
        if (now < redAt) return 'YELLOW';
        return 'RED';
    }

    async checkin() {
        this.last_checkin_at = new Date().toISOString();
        return this.save();
    }

    getDaysSinceAnchor() {
        const anchor = this.last_checkin_at ? new Date(this.last_checkin_at) : new Date(this.first_due_at);
        return dateUtils.daysDifference(anchor, new Date());
    }
}

// Task model
export class Task extends BaseModel {
    static storeName = 'tasks';

    constructor(data) {
        super(data);
        this.title = data.title;
        this.notes = data.notes;
        this.status = data.status || 'OPEN';
        this.completed_at = data.completed_at;
        this.due_at = data.due_at;
    }

    static async create(data) {
        if (!data.title) {
            throw new Error('Task title is required');
        }
        return super.create(data);
    }

    async complete() {
        this.status = 'DONE';
        this.completed_at = new Date().toISOString();
        return this.save();
    }

    async reopen() {
        this.status = 'OPEN';
        this.completed_at = null;
        return this.save();
    }

    getDaysOpen() {
        if (this.status === 'DONE') return 0;
        return dateUtils.daysDifference(new Date(this.created_at), new Date());
    }

    isOverdue() {
        return this.due_at && new Date(this.due_at) < new Date();
    }
}

// Habit model
export class Habit extends BaseModel {
    static storeName = 'habits';

    constructor(data) {
        super(data);
        this.title = data.title;
        this.description = data.description;
        this.archived_at = data.archived_at;
    }

    static async create(data) {
        if (!data.title) {
            throw new Error('Habit title is required');
        }
        return super.create(data);
    }

    async archive() {
        this.archived_at = new Date().toISOString();
        return this.save();
    }

    async unarchive() {
        this.archived_at = null;
        return this.save();
    }

    isArchived() {
        return !!this.archived_at;
    }

    async getLogForDate(date) {
        const dateString = dateUtils.getLocalDateString(date);
        const logs = await HabitLog.findAll({ habit_id: this.id, date: dateString });
        return logs[0] || null;
    }

    async getRecentLogs(days = 30) {
        const endDate = new Date();
        const startDate = dateUtils.addDuration(endDate, -days, 'day');
        
        const logs = await HabitLog.findAll({ habit_id: this.id });
        return logs.filter(log => {
            const logDate = dateUtils.parseLocalDateString(log.date);
            return logDate >= startDate && logDate <= endDate;
        });
    }
}

// Habit Log model
export class HabitLog extends BaseModel {
    static storeName = 'habit_logs';

    constructor(data) {
        super(data);
        this.habit_id = data.habit_id;
        this.date = data.date;
        this.status = data.status; // SUCCESS | FAIL | NA
    }

    static async create(data) {
        // Validate date format
        if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
            throw new Error('Date must be in YYYY-MM-DD format');
        }

        // Validate status
        const validStatuses = ['SUCCESS', 'FAIL', 'NA'];
        if (!validStatuses.includes(data.status)) {
            throw new Error(`Status must be one of: ${validStatuses.join(', ')}`);
        }

        // Check if log already exists for this date
        const existing = await HabitLog.findAll({ habit_id: data.habit_id, date: data.date });
        if (existing.length > 0) {
            throw new Error('Habit log already exists for this date');
        }

        // Validate date is not too far in the past (7 days max)
        const logDate = dateUtils.parseLocalDateString(data.date);
        const minDate = dateUtils.addDuration(new Date(), -7, 'day');
        if (logDate < minDate) {
            throw new Error('Cannot create habit logs more than 7 days in the past');
        }

        return super.create(data);
    }
}

// Prayer model
export class Prayer extends BaseModel {
    static storeName = 'prayers';

    constructor(data) {
        super(data);
        this.title = data.title;
        this.text = data.text;
    }

    static async create(data) {
        if (!data.title) {
            throw new Error('Prayer title is required');
        }
        if (!data.text) {
            throw new Error('Prayer text is required');
        }
        return super.create(data);
    }

    async getLogsForDate(date) {
        const dateString = dateUtils.getLocalDateString(date);
        return PrayerLog.findAll({ prayer_id: this.id, date: dateString });
    }

    async getRecentLogs(days = 30) {
        const endDate = new Date();
        const startDate = dateUtils.addDuration(endDate, -days, 'day');
        
        const logs = await PrayerLog.findAll({ prayer_id: this.id });
        return logs.filter(log => {
            const logDate = dateUtils.parseLocalDateString(log.date);
            return logDate >= startDate && logDate <= endDate;
        });
    }

    async logPrayer(date = new Date()) {
        const dateString = dateUtils.getLocalDateString(date);
        
        // Try to find existing log for today
        const existingLogs = await PrayerLog.findAll({ prayer_id: this.id, date: dateString });
        
        if (existingLogs.length > 0) {
            // Increment count on existing log
            const existing = existingLogs[0];
            existing.count = (existing.count || 1) + 1;
            return existing.save();
        } else {
            // Create new log
            return PrayerLog.create({
                prayer_id: this.id,
                date: dateString,
                count: 1
            });
        }
    }
}

// Prayer Log model
export class PrayerLog extends BaseModel {
    static storeName = 'prayer_logs';

    constructor(data) {
        super(data);
        this.prayer_id = data.prayer_id;
        this.date = data.date;
        this.count = data.count || 1;
    }

    static async create(data) {
        // Validate date format
        if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
            throw new Error('Date must be in YYYY-MM-DD format');
        }

        // Validate count
        if (!Number.isInteger(data.count) || data.count < 1) {
            throw new Error('Count must be a positive integer');
        }

        return super.create(data);
    }
}

// Journal Entry model
export class JournalEntry extends BaseModel {
    static storeName = 'journal_entries';

    constructor(data) {
        super(data);
        this.date = data.date;
        this.title = data.title;
        this.body = data.body;
    }

    static async create(data) {
        // Validate date format
        if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
            throw new Error('Date must be in YYYY-MM-DD format');
        }

        // Check if entry already exists for this date
        const existing = await JournalEntry.findAll({ date: data.date });
        if (existing.length > 0) {
            throw new Error('Journal entry already exists for this date');
        }

        return super.create(data);
    }

    static async findByDate(date) {
        const dateString = typeof date === 'string' ? date : dateUtils.getLocalDateString(date);
        const entries = await JournalEntry.findAll({ date: dateString });
        return entries[0] || null;
    }

    static async getOrCreateForDate(date = new Date()) {
        const dateString = dateUtils.getLocalDateString(date);
        let entry = await JournalEntry.findByDate(dateString);
        
        if (!entry) {
            entry = await JournalEntry.create({
                date: dateString,
                title: dateUtils.isToday(date) ? "Today's Journal" : `Journal - ${dateString}`,
                body: ''
            });
        }
        
        return entry;
    }
}

// Action Log model (for undo functionality)
export class ActionLog extends BaseModel {
    static storeName = 'action_logs';

    constructor(data) {
        super(data);
        this.entity_type = data.entity_type;
        this.entity_id = data.entity_id;
        this.action_type = data.action_type; // CREATE, UPDATE, DELETE
        this.before_snapshot = data.before_snapshot;
        this.after_snapshot = data.after_snapshot;
        this.timestamp = data.timestamp || new Date().toISOString();
    }

    static async logAction(entityType, entityId, actionType, beforeSnapshot, afterSnapshot) {
        return ActionLog.create({
            entity_type: entityType,
            entity_id: entityId,
            action_type: actionType,
            before_snapshot: beforeSnapshot,
            after_snapshot: afterSnapshot
        });
    }

    static async getRecentActions(limit = 50) {
        const actions = await ActionLog.findAll();
        return actions
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }
}

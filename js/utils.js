// Utility functions for MyOS

// Date utilities
export const dateUtils = {
    // Get local date string in YYYY-MM-DD format
    getLocalDateString(date = new Date()) {
        return date.toISOString().split('T')[0];
    },

    // Parse local date string to Date object (no timezone conversion)
    parseLocalDateString(dateString) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day);
    },

    // Add duration to date using calendar-aware math
    addDuration(date, value, unit) {
        const result = new Date(date);
        
        switch (unit) {
            case 'day':
                result.setDate(result.getDate() + value);
                break;
            case 'week':
                result.setDate(result.getDate() + (value * 7));
                break;
            case 'month':
                result.setMonth(result.getMonth() + value);
                break;
            case 'year':
                result.setFullYear(result.getFullYear() + value);
                break;
            default:
                throw new Error(`Invalid unit: ${unit}`);
        }
        
        return result;
    },

    // Calculate difference in days between two dates
    daysDifference(date1, date2) {
        const diffTime = Math.abs(date2 - date1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    // Get start of day (midnight)
    startOfDay(date = new Date()) {
        const result = new Date(date);
        result.setHours(0, 0, 0, 0);
        return result;
    },

    // Get end of day (23:59:59.999)
    endOfDay(date = new Date()) {
        const result = new Date(date);
        result.setHours(23, 59, 59, 999);
        return result;
    },

    // Check if date is today
    isToday(date) {
        const today = this.startOfDay(new Date());
        const checkDate = this.startOfDay(date);
        return today.getTime() === checkDate.getTime();
    },

    // Check if date is overdue
    isOverdue(date) {
        return date < new Date();
    }
};

// String utilities
export const stringUtils = {
    // Generate random ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Truncate text
    truncate(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },

    // Slugify text for URLs/IDs
    slugify(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }
};

// Array utilities
export const arrayUtils = {
    // Remove item from array
    remove(array, item) {
        const index = array.indexOf(item);
        if (index > -1) {
            array.splice(index, 1);
        }
        return array;
    },

    // Move item in array
    move(array, fromIndex, toIndex) {
        const result = [...array];
        const [removed] = result.splice(fromIndex, 1);
        result.splice(toIndex, 0, removed);
        return result;
    },

    // Unique items
    unique(array) {
        return [...new Set(array)];
    },

    // Group by key
    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = item[key];
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
        }, {});
    }
};

// Validation utilities
export const validationUtils = {
    // Validate email
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    // Validate required fields
    validateRequired(obj, requiredFields) {
        const missing = requiredFields.filter(field => !obj[field]);
        return {
            isValid: missing.length === 0,
            missing
        };
    },

    // Validate duration (value + unit)
    validateDuration(value, unit) {
        const validUnits = ['day', 'week', 'month', 'year'];
        return {
            isValid: Number.isInteger(value) && value > 0 && validUnits.includes(unit),
            error: !Number.isInteger(value) || value <= 0 ? 'Value must be a positive integer' :
                   !validUnits.includes(unit) ? 'Unit must be one of: day, week, month, year' : null
        };
    }
};

// Debounce utility
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle utility
export function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

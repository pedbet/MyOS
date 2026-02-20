// UI Components for MyOS

import { stringUtils, dateUtils } from './utils.js';

export class Modal {
    constructor(options = {}) {
        this.title = options.title || '';
        this.content = options.content || '';
        this.className = options.className || '';
        this.onClose = options.onClose || null;
        this.overlay = null;
        this.modal = null;
    }

    show() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        
        // Create modal
        this.modal = document.createElement('div');
        this.modal.className = `modal ${this.className}`;
        
        this.modal.innerHTML = `
            <div class="modal-header">
                <h3 class="modal-title">${stringUtils.escapeHtml(this.title)}</h3>
                <button class="modal-close" aria-label="Close">&times;</button>
            </div>
            <div class="modal-body">
                ${this.content}
            </div>
        `;

        this.overlay.appendChild(this.modal);
        document.getElementById('modals').appendChild(this.overlay);

        // Event listeners
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        this.modal.querySelector('.modal-close').addEventListener('click', () => {
            this.close();
        });

        // Focus management
        requestAnimationFrame(() => {
            const firstInput = this.modal.querySelector('input, textarea, button, select');
            if (firstInput) {
                firstInput.focus();
            }
        });
    }

    close() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
            this.modal = null;
        }
        if (this.onClose) {
            this.onClose();
        }
    }

    // Static method to create form modals
    static createFormModal(options = {}) {
        const { title, fields, onSubmit, submitText = 'Save' } = options;
        
        let formFields = '';
        fields.forEach(field => {
            const fieldId = stringUtils.slugify(field.name);
            let input = '';
            
            switch (field.type) {
                case 'textarea':
                    input = `<textarea id="${fieldId}" name="${field.name}" class="form-input form-textarea" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}>${field.value || ''}</textarea>`;
                    break;
                case 'select':
                    const options = field.options.map(opt => `<option value="${opt.value}" ${opt.value === field.value ? 'selected' : ''}>${opt.label}</option>`).join('');
                    input = `<select id="${fieldId}" name="${field.name}" class="form-input" ${field.required ? 'required' : ''}>${options}</select>`;
                    break;
                case 'number':
                    input = `<input type="number" id="${fieldId}" name="${field.name}" class="form-input" value="${field.value || ''}" min="${field.min || ''}" max="${field.max || ''}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}>`;
                    break;
                default:
                    input = `<input type="${field.type || 'text'}" id="${fieldId}" name="${field.name}" class="form-input" value="${field.value || ''}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}>`;
            }
            
            formFields += `
                <div class="form-group">
                    <label for="${fieldId}" class="form-label">${field.label}</label>
                    ${input}
                </div>
            `;
        });

        const content = `
            <form id="modal-form">
                ${formFields}
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">${submitText}</button>
                </div>
            </form>
        `;

        const modal = new Modal({ title, content });
        
        modal.show();
        
        // Form submission
        const form = document.getElementById('modal-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = {};
            
            fields.forEach(field => {
                const value = formData.get(field.name);
                if (field.type === 'number') {
                    data[field.name] = value ? parseInt(value, 10) : null;
                } else {
                    data[field.name] = value || '';
                }
            });
            
            try {
                await onSubmit(data);
                modal.close();
            } catch (error) {
                console.error('Form submission error:', error);
                alert(error.message || 'An error occurred while saving.');
            }
        });

        // Cancel button
        form.querySelector('.modal-cancel').addEventListener('click', () => {
            modal.close();
        });

        return modal;
    }
}

export class Card {
    constructor(options = {}) {
        this.title = options.title || '';
        this.subtitle = options.subtitle || '';
        this.content = options.content || '';
        this.actions = options.actions || [];
        this.className = options.className || '';
        this.onClick = options.onClick || null;
    }

    render() {
        const actionsHtml = this.actions.map(action => {
            const className = action.className || 'btn btn-secondary btn-sm';
            return `<button class="${className}" data-action="${action.action}">${action.label}</button>`;
        }).join('');

        return `
            <div class="card ${this.className}" ${this.onClick ? 'data-clickable="true"' : ''}>
                ${this.title ? `<div class="card-title">${stringUtils.escapeHtml(this.title)}</div>` : ''}
                ${this.subtitle ? `<div class="card-meta">${stringUtils.escapeHtml(this.subtitle)}</div>` : ''}
                ${this.content ? `<div class="card-content">${this.content}</div>` : ''}
                ${actionsHtml ? `<div class="card-actions">${actionsHtml}</div>` : ''}
            </div>
        `;
    }
}

export class StatusIndicator {
    static render(status) {
        const className = `status-${status.toLowerCase()}`;
        return `<span class="${className}">${status}</span>`;
    }
}

export class Label {
    static render(label) {
        return `<span class="label">${stringUtils.escapeHtml(label)}</span>`;
    }

    static renderList(labels) {
        if (!labels || labels.length === 0) return '';
        return labels.map(label => Label.render(label)).join('');
    }
}

export class EmptyState {
    static render(message, action = null) {
        const actionHtml = action ? `<button class="btn btn-primary" data-action="${action.action}">${action.label}</button>` : '';
        
        return `
            <div class="empty-state text-center">
                <p class="text-secondary">${message}</p>
                ${actionHtml}
            </div>
        `;
    }
}

export class LoadingSpinner {
    static render(size = 'small') {
        const sizeClass = size === 'large' ? 'spinner-large' : 'spinner-small';
        return `<div class="spinner ${sizeClass}"></div>`;
    }
}

// Form field generators
export const FormFields = {
    text(name, label, options = {}) {
        return {
            name,
            label,
            type: 'text',
            value: options.value || '',
            placeholder: options.placeholder || '',
            required: options.required || false
        };
    },

    textarea(name, label, options = {}) {
        return {
            name,
            label,
            type: 'textarea',
            value: options.value || '',
            placeholder: options.placeholder || '',
            required: options.required || false
        };
    },

    number(name, label, options = {}) {
        return {
            name,
            label,
            type: 'number',
            value: options.value || '',
            min: options.min || null,
            max: options.max || null,
            placeholder: options.placeholder || '',
            required: options.required || false
        };
    },

    select(name, label, options = {}) {
        return {
            name,
            label,
            type: 'select',
            value: options.value || '',
            options: options.options || [],
            required: options.required || false
        };
    },

    // Duration field (value + unit) for check-ins
    duration(valueName, unitName, label, options = {}) {
        return [
            {
                name: valueName,
                label: `${label} Value`,
                type: 'number',
                value: options.value || 1,
                min: 1,
                required: true
            },
            {
                name: unitName,
                label: `${label} Unit`,
                type: 'select',
                value: options.unit || 'day',
                options: [
                    { value: 'day', label: 'Days' },
                    { value: 'week', label: 'Weeks' },
                    { value: 'month', label: 'Months' },
                    { value: 'year', label: 'Years' }
                ],
                required: true
            }
        ];
    },

    // Status field
    status(name, label, options = {}) {
        return {
            name,
            label,
            type: 'select',
            value: options.value || 'OPEN',
            options: [
                { value: 'OPEN', label: 'Open' },
                { value: 'DONE', label: 'Done' }
            ],
            required: true
        };
    },

    // Date field
    date(name, label, options = {}) {
        return {
            name,
            label,
            type: 'date',
            value: options.value || dateUtils.getLocalDateString(),
            required: options.required || false
        };
    }
};

// Toast notification system
export class Toast {
    static show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        // Add to page
        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('toast-show');
        });

        // Remove after duration
        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    static success(message, duration) {
        this.show(message, 'success', duration);
    }

    static error(message, duration) {
        this.show(message, 'error', duration);
    }

    static warning(message, duration) {
        this.show(message, 'warning', duration);
    }

    static info(message, duration) {
        this.show(message, 'info', duration);
    }
}

// Add toast styles to the page
const toastStyles = `
.toast {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    background: #1f2937;
    color: white;
    padding: 0.75rem 1rem;
    border-radius: 0.375rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    max-width: 300px;
    font-size: 0.875rem;
}

.toast-show {
    transform: translateX(0);
}

.toast-success {
    background: #16a34a;
}

.toast-error {
    background: #dc2626;
}

.toast-warning {
    background: #f59e0b;
}

.toast-info {
    background: #2563eb;
}

.spinner {
    border: 2px solid #e5e7eb;
    border-top: 2px solid #2563eb;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.spinner-small {
    width: 16px;
    height: 16px;
}

.spinner-large {
    width: 32px;
    height: 32px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.empty-state {
    padding: 2rem;
    color: #6b7280;
}

.card-actions {
    margin-top: 0.75rem;
    display: flex;
    gap: 0.5rem;
}

.form-actions {
    margin-top: 1.5rem;
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
}
`;

// Inject styles
if (!document.getElementById('toast-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'toast-styles';
    styleSheet.textContent = toastStyles;
    document.head.appendChild(styleSheet);
}

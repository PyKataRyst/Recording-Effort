/**
 * Safe wrapper for localStorage to prevent crashes in private mode or restricted environments.
 */
export const SafeStorage = {
    getItem: (key: string): string | null => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                return window.localStorage.getItem(key);
            }
        } catch (e) {
            console.warn(`SafeStorage: Failed to get item ${key}`, e);
        }
        return null;
    },

    setItem: (key: string, value: string): void => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(key, value);
            }
        } catch (e) {
            console.warn(`SafeStorage: Failed to set item ${key}`, e);
        }
    },

    removeItem: (key: string): void => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem(key);
            }
        } catch (e) {
            console.warn(`SafeStorage: Failed to remove item ${key}`, e);
        }
    },

    clear: (): void => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.clear();
            }
        } catch (e) {
            console.warn('SafeStorage: Failed to clear storage', e);
        }
    }
};

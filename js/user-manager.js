// User Management Module for Point Traceability
const UserManager = (function() {
    'use strict';
    
    // Private methods
    function getTodayKey() {
        return new Date().toISOString().split('T')[0];
    }
    
    function getSessionKey() {
        return `forestMap_session_${getTodayKey()}`;
    }
    
    function getUserNameKey() {
        return `forestMap_userName_${getTodayKey()}`;
    }
    
    // Public API
    return {
        // Get current user name (prompt if first time today)
        getCurrentUserName: function() {
            if (!this.hasUserNameForToday()) {
                return this.promptForUserName();
            }
            return this.getStoredUserName();
        },
        
        // Check if user name exists for today
        hasUserNameForToday: function() {
            const stored = localStorage.getItem(getUserNameKey());
            return stored !== null && stored.trim() !== '';
        },
        
        // Get stored user name for today
        getStoredUserName: function() {
            return localStorage.getItem(getUserNameKey()) || null;
        },
        
        // Store user name with daily expiration
        storeUserName: function(name) {
            const trimmedName = name.trim();
            if (!trimmedName) return false;
            
            const today = getTodayKey();
            localStorage.setItem(getUserNameKey(), trimmedName);
            
            // Store session metadata
            const sessionData = {
                userName: trimmedName,
                startTime: new Date().toISOString(),
                pointCount: 0,
                lastActivity: new Date().toISOString()
            };
            
            localStorage.setItem(getSessionKey(), JSON.stringify(sessionData));
            return true;
        },
        
        // Prompt user for name with validation
        promptForUserName: function() {
            return new Promise((resolve) => {
                this.showUserNameDialog().then(resolve);
            });
        },
        
        // Show user name input dialog
        showUserNameDialog: function() {
            return new Promise((resolve) => {
                const dialog = document.createElement('div');
                dialog.className = 'user-name-dialog-overlay';
                dialog.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: 5000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(5px);
                    -webkit-backdrop-filter: blur(5px);
                `;
                
                const dialogContent = document.createElement('div');
                dialogContent.className = 'user-name-dialog';
                dialogContent.style.cssText = `
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    max-width: 400px;
                    text-align: center;
                    margin: 20px;
                `;
                
                dialogContent.innerHTML = `
                    <div style="margin-bottom: 25px;">
                        <svg width="48" height="48" style="color: #2196F3; margin-bottom: 15px;" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                        <h3 style="margin: 0 0 10px 0; color: #333; font-size: 20px;">${i18n.t('namePromptTitle')}</h3>
                    </div>
                    
                    <p style="color: #666; font-size: 14px; line-height: 1.5; margin: 15px 0 25px 0;">
                        ${i18n.t('namePromptMessage')}
                    </p>
                    
                    <div style="margin: 20px 0;">
                        <input type="text" id="user-name-input" 
                               placeholder="${i18n.t('enterYourName')}"
                               maxlength="50"
                               style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; text-align: center;">
                    </div>
                    
                    <p style="color: #999; font-size: 12px; margin: 15px 0 25px 0;">
                        ${i18n.t('rememberNameToday')}
                    </p>
                    
                    <div style="display: flex; gap: 15px; justify-content: center;">
                        <button id="name-cancel" 
                                style="background: #f5f5f5; color: #333; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
                            ${i18n.t('close')}
                        </button>
                        <button id="name-confirm" 
                                style="background: #2196F3; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
                            ${i18n.t('confirm')}
                        </button>
                    </div>
                `;
                
                dialog.appendChild(dialogContent);
                document.body.appendChild(dialog);
                
                const input = document.getElementById('user-name-input');
                const confirmBtn = document.getElementById('name-confirm');
                const cancelBtn = document.getElementById('name-cancel');
                
                // Focus input
                setTimeout(() => input.focus(), 100);
                
                // Validate input
                const validateInput = () => {
                    const name = input.value.trim();
                    confirmBtn.disabled = name.length === 0 || name.length > 50;
                    confirmBtn.style.opacity = confirmBtn.disabled ? '0.5' : '1';
                };
                
                input.addEventListener('input', validateInput);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !confirmBtn.disabled) {
                        handleConfirm();
                    } else if (e.key === 'Escape') {
                        handleCancel();
                    }
                });
                
                const handleConfirm = () => {
                    const name = input.value.trim();
                    if (name.length > 0 && name.length <= 50) {
                        this.storeUserName(name);
                        document.body.removeChild(dialog);
                        resolve(name);
                    }
                };
                
                const handleCancel = () => {
                    document.body.removeChild(dialog);
                    resolve(null);
                };
                
                confirmBtn.addEventListener('click', handleConfirm);
                cancelBtn.addEventListener('click', handleCancel);
                
                // Handle click outside dialog
                dialog.addEventListener('click', (e) => {
                    if (e.target === dialog) {
                        handleCancel();
                    }
                });
                
                // Initial validation
                validateInput();
            });
        },
        
        // Clear user name (manual reset)
        clearUserName: function() {
            localStorage.removeItem(getUserNameKey());
            localStorage.removeItem(getSessionKey());
        },
        
        // Clean up old user names (run on init)
        cleanupOldUserNames: function() {
            const today = getTodayKey();
            const keysToRemove = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('forestMap_userName_') && !key.includes(today)) {
                    keysToRemove.push(key);
                }
                if (key && key.startsWith('forestMap_session_') && !key.includes(today)) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => localStorage.removeItem(key));
        },
        
        // Update session point count
        updateSessionPointCount: function() {
            try {
                const sessionData = JSON.parse(localStorage.getItem(getSessionKey()) || '{}');
                sessionData.pointCount = (sessionData.pointCount || 0) + 1;
                sessionData.lastActivity = new Date().toISOString();
                localStorage.setItem(getSessionKey(), JSON.stringify(sessionData));
            } catch (e) {
                console.warn('Failed to update session point count:', e);
            }
        },
        
        // Get session information
        getSessionInfo: function() {
            try {
                const sessionData = localStorage.getItem(getSessionKey());
                return sessionData ? JSON.parse(sessionData) : null;
            } catch (e) {
                console.warn('Failed to get session info:', e);
                return null;
            }
        },
        
        // Initialize user manager (cleanup old names)
        init: function() {
            this.cleanupOldUserNames();
        }
    };
})();
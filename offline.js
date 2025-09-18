// offline.js - Connection status detection and UI feedback

class OfflineManager {
  constructor() {
	this.isOnline = navigator.onLine;
	this.statusIndicator = null;
	this.init();
  }

  init() {
	this.createStatusIndicator();
	this.bindEvents();
	this.updateStatus();
  }

  // REPLACE the createStatusIndicator method in offline.js with this:
  createStatusIndicator() {
	// Create a more visible status indicator
	this.statusIndicator = document.createElement('div');
	this.statusIndicator.id = 'connection-status';
	this.statusIndicator.style.cssText = `
	  position: fixed;
	  top: 80px;
	  right: 16px;
	  z-index: 9999;
	  padding: 8px 12px;
	  border-radius: 20px;
	  font-size: 12px;
	  font-weight: 600;
	  transition: all 0.3s ease;
	  pointer-events: none;
	  opacity: 0;
	  transform: translateY(-10px);
	  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
	`;
	
	document.body.appendChild(this.statusIndicator);
  }

  bindEvents() {
	window.addEventListener('online', () => {
	  this.isOnline = true;
	  this.updateStatus();
	  this.showTemporaryStatus('🟢 Back online', '#d1fae5', '#065f46', 3000);
	});

	window.addEventListener('offline', () => {
	  this.isOnline = false;
	  this.updateStatus();
	  this.showTemporaryStatus('🔴 Working offline', '#fee2e2', '#991b1b', 0); // Stay visible
	});
  }

  // REPLACE the updateStatus method with this more aggressive version:
  updateStatus() {
	console.log('Connection status:', this.isOnline ? 'ONLINE' : 'OFFLINE'); // Debug log
	
	if (!this.isOnline) {
	  this.showOfflineIndicator();
	} else {
	  // Only hide if we're definitely online and not showing a temporary message
	  setTimeout(() => {
		if (this.isOnline) {
		  this.hideIndicator();
		}
	  }, 100);
	}
  }

  showOfflineIndicator() {
	this.statusIndicator.textContent = '🔴 Offline mode';
	this.statusIndicator.style.background = '#fee2e2';
	this.statusIndicator.style.color = '#991b1b';
	this.statusIndicator.style.border = '1px solid #fecaca';
	this.statusIndicator.style.opacity = '1';
	this.statusIndicator.style.transform = 'translateY(0)';
  }

  showTemporaryStatus(message, bgColor, textColor, duration = 3000) {
	this.statusIndicator.textContent = message;
	this.statusIndicator.style.background = bgColor;
	this.statusIndicator.style.color = textColor;
	this.statusIndicator.style.opacity = '1';
	this.statusIndicator.style.transform = 'translateY(0)';

	if (duration > 0) {
	  setTimeout(() => {
		if (this.isOnline) {
		  this.hideIndicator();
		} else {
		  this.showOfflineIndicator();
		}
	  }, duration);
	}
  }

  hideIndicator() {
	this.statusIndicator.style.opacity = '0';
	this.statusIndicator.style.transform = 'translateY(-10px)';
  }

  // Public method to check connection status
  getStatus() {
	return {
	  online: this.isOnline,
	  message: this.isOnline ? 'Connected' : 'Offline'
	};
  }
}

// Create global instance
export const offlineManager = new OfflineManager();

// Add to window for debugging
if (typeof window !== 'undefined') {
  window.offlineManager = offlineManager;
}
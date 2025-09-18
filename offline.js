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

  createStatusIndicator() {
	this.statusIndicator = document.createElement('div');
	this.statusIndicator.id = 'connection-status';
	this.statusIndicator.style.cssText = `
	  position: fixed;
	  top: calc(var(--topbar-h, 56px) + 16px);
	  left: 50%;
	  transform: translateX(-50%) translateY(-20px);
	  z-index: 9999;
	  padding: 6px 16px;
	  border-radius: 20px;
	  font-size: 12px;
	  font-weight: 600;
	  transition: all 0.3s ease;
	  pointer-events: none;
	  opacity: 0;
	  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
	  backdrop-filter: blur(10px);
	`;
	
	document.body.appendChild(this.statusIndicator);
	console.log('Status indicator created'); // Debug log
  }

  bindEvents() {
	window.addEventListener('online', () => {
	  console.log('Event: Going online');
	  this.isOnline = true;
	  this.updateStatus();
	  this.showTemporaryStatus('🟢 Back online', 'rgba(34, 197, 94, 0.9)', 'white', 3000);
	});

	window.addEventListener('offline', () => {
	  console.log('Event: Going offline');
	  this.isOnline = false;
	  this.updateStatus();
	  this.showOfflineIndicator();
	});
  }

  updateStatus() {
	console.log('Connection status:', this.isOnline ? 'ONLINE' : 'OFFLINE');
	
	if (!this.isOnline) {
	  this.showOfflineIndicator();
	} else {
	  setTimeout(() => {
		if (this.isOnline) {
		  this.hideIndicator();
		}
	  }, 100);
	}
  }

  showOfflineIndicator() {
	console.log('Showing offline indicator');
	this.statusIndicator.textContent = '🔴 Working offline';
	this.statusIndicator.style.background = 'rgba(239, 68, 68, 0.9)';
	this.statusIndicator.style.color = 'white';
	this.statusIndicator.style.border = '1px solid rgba(239, 68, 68, 0.3)';
	this.statusIndicator.style.opacity = '1';
	this.statusIndicator.style.transform = 'translateX(-50%) translateY(0)';
  }

  hideIndicator() {
	console.log('Hiding indicator');
	this.statusIndicator.style.opacity = '0';
	this.statusIndicator.style.transform = 'translateX(-50%) translateY(-20px)';
  }

  showTemporaryStatus(message, bgColor, textColor, duration = 3000) {
	console.log('Showing temporary status:', message);
	this.statusIndicator.textContent = message;
	this.statusIndicator.style.background = bgColor;
	this.statusIndicator.style.color = textColor;
	this.statusIndicator.style.opacity = '1';
	this.statusIndicator.style.transform = 'translateX(-50%) translateY(0)';

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

  // Public method to manually trigger offline indicator (for testing)
  forceOffline() {
	this.showOfflineIndicator();
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
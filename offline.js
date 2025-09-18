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
 // REPLACE the createStatusIndicator method with this:
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

  // REPLACE showOfflineIndicator and hideIndicator methods:
  showOfflineIndicator() {
	this.statusIndicator.textContent = '🔴 Working offline';
	this.statusIndicator.style.background = 'rgba(239, 68, 68, 0.9)';
	this.statusIndicator.style.color = 'white';
	this.statusIndicator.style.border = '1px solid rgba(239, 68, 68, 0.3)';
	this.statusIndicator.style.opacity = '1';
	this.statusIndicator.style.transform = 'translateX(-50%) translateY(0)';
  }
  
  hideIndicator() {
	this.statusIndicator.style.opacity = '0';
	this.statusIndicator.style.transform = 'translateX(-50%) translateY(-20px)';
  }
  
  showTemporaryStatus(message, bgColor, textColor, duration = 3000) {
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
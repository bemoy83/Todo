# Todo App - Drag, Swipe & Add

## Overview
This is a modern vanilla JavaScript todo application with drag-and-drop functionality, swipe gestures, and a clean interface. The app runs entirely in the browser with local storage for persistence.

## Project Architecture
- **Frontend-only application**: Pure HTML, CSS, and vanilla JavaScript with ES modules
- **No build system**: Direct browser execution of ES modules
- **Static hosting**: Served via Python's built-in HTTP server
- **Deployment**: Configured for autoscale deployment on Replit

## Key Features
- Drag and drop task reordering
- Swipe gestures for task actions
- Local storage persistence
- Responsive design
- Keyboard shortcuts (Ctrl+N for new task, Ctrl+S to save)
- Export/import functionality

## File Structure
- `index.html` - Main application HTML
- `main.js` - Application entry point with ES module imports
- `core.js` - Core application logic and DOM utilities
- `styles.css` - Complete application styling with CSS custom properties
- `drag.js` - Drag and drop functionality
- `swipe.js` - Touch gesture handling
- `state.js` - Application state management and persistence
- `rendering.js` - DOM rendering logic
- `editing.js` - Task editing functionality
- `taskOperations.js` - Task CRUD operations
- `menu.js` - Menu system
- `utils.js` - Utility functions
- `constants.js` - Application constants

## Recent Changes (Sep 16, 2025)
- Fixed CSS syntax errors (replaced invalid // comments with /* */ comments)
- Set up workflow to serve application on port 5000
- Configured deployment for autoscale hosting
- Verified all ES modules load correctly

### iOS Touch Interaction Improvements
- **Fixed gesture arbitration conflicts**: Resolved iOS scroll vs drag issues by preventing simultaneous activation of drag and swipe gestures
- **Enhanced touch policies**: Added comprehensive CSS touch-action declarations with proper state management (armed, swiping, dragging states)
- **Robust scroll locking**: Implemented iOS-compatible scroll prevention using position: fixed with scroll position preservation and aggressive touch event prevention
- **Edge exclusion zones**: Added 24px exclusion zones near screen edges to prevent conflicts with iOS back/forward navigation gestures
- **Centralized scroll management**: Created shared scroll locking utilities in core.js for consistent behavior across all gesture systems

## Running the Project
The application is served via a simple HTTP server on port 5000:
```bash
python3 -m http.server 5000 --bind 0.0.0.0
```

## User Preferences
- Clean, modern vanilla JavaScript approach maintained
- No build system complexity - direct browser execution preferred
- Responsive design with touch gesture support
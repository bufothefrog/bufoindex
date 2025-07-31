/**
 * BufoIndex Terminal UI Framework
 * Main entry point for component registration and global initialization
 */

// Import component library
import './components/index.js';

// Import framework modules
import { ThemeSystem } from './framework/theme-system.js';
import { AppController } from './framework/app-controller.js';

// Initialize theme system
const themeSystem = new ThemeSystem();
themeSystem.initialize();

// Make globally available for tools
window.BufoFramework = {
  AppController,
  version: '2.0.0'
};

console.log('🐸 BufoIndex Terminal Framework v2.0.0 loaded');
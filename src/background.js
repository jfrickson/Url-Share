/*eslint no-undef: "error"*/
/*eslint-env browser*/
/*eslint-env node*/
/*global chrome*/

import { createContextMenus } from './background/context-menu.js';
import { fetchAndUpdateBadge } from './background/badge.js';
import { setupMessageListener } from './background/messaging.js';
import { setupHotkeys } from './background/hotkeys.js';
import { setupTabListeners } from './background/tab-listeners.js';
import { setupContextMenuHandler } from './background/context-menu-handler.js';

// Create context menu
chrome.runtime.onInstalled.addListener(() => {
	createContextMenus();
});

// Initialize all components
setupTabListeners();
setupContextMenuHandler();
setupHotkeys();
setupMessageListener();

// Initialize badge
fetchAndUpdateBadge();

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
	if (area === 'local')
		fetchAndUpdateBadge();
});

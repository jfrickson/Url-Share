/*eslint no-undef: "error"*/
/*eslint-env browser*/
/*eslint-env node*/
/*global chrome, console*/

import { updateContextMenus } from './context-menu.js';

// Tab event handling

export function setupTabListeners() {
	// Listen for tab updates to check URL
	chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
		if (changeInfo.url || changeInfo.status === 'complete') {
			updateContextMenus(tab.url);
		}
	});

	// Listen for tab activation to check URL
	chrome.tabs.onActivated.addListener((activeInfo) => {
		chrome.tabs.get(activeInfo.tabId, (tab) => {
			if (chrome.runtime.lastError) {
				// Handle case where tab no longer exists
				console.warn(`Tab ${activeInfo.tabId} not found:`, chrome.runtime.lastError.message);
				return;
			}
			if (!tab) return;
			updateContextMenus(tab.url);
		});
	});
}

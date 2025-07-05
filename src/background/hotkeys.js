/*eslint no-undef: "error"*/
/*eslint-env browser*/
/*eslint-env node*/
/*global chrome*/

import { validateUrl, handleSendNow, handleAddToQueue } from './actions.js';

// Keyboard shortcuts

export function setupHotkeys() {
	chrome.commands.onCommand.addListener(async (command) => {
		if (command === 'queue-email') {
			// Get current tab info and add to queue
			chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
				if (tabs[0]) {
					const tab = tabs[0];
					if (await validateUrl(tab.url)) {
						const item = { title: tab.title || 'No Title', url: tab.url };
						handleAddToQueue(item);
					}
				}
			});
		} else if (command === 'send-email') {
			// Get current tab info and send now
			chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
				if (tabs[0]) {
					const tab = tabs[0];
					if (await validateUrl(tab.url)) {
						const item = { title: tab.title || 'No Title', url: tab.url };
						handleSendNow(item, 'hotkey-send');
					}
				}
			});
		}
	});
}

/*eslint no-undef: "error"*/
/*eslint-env browser*/
/*eslint-env node*/
/*global chrome, URL*/

import { validateUrl, handleSendNow, handleAddToQueue } from './actions.js';

// Context menu click handling

export function setupContextMenuHandler() {
	chrome.contextMenus.onClicked.addListener( async (info, tab) => {
		const isLink = info.linkUrl;
		const url = isLink ? info.linkUrl : tab.url;
		const title = isLink ? (info.selectionText || new URL(url).hostname) : (tab.title || 'No Title');

		// Validate URL for send-now and add-to-queue actions
		if (
			(info.menuItemId === 'page-send-now' ||
			info.menuItemId === 'link-send-now' ||
			info.menuItemId === 'page-add-to-queue' ||
			info.menuItemId === 'link-add-to-queue') )
		{
			if (!(await validateUrl(url))) {
				return;
			}
		}

		const item = { title, url };

		if (info.menuItemId === 'page-send-now' || info.menuItemId === 'link-send-now') {
			handleSendNow(item, info.menuItemId);
		} else if (info.menuItemId === 'page-add-to-queue' || info.menuItemId === 'link-add-to-queue') {
			handleAddToQueue(item);
		}
	});
}

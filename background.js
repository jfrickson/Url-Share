import { buildMailtoUrl, getStorageKeys, createNotification } from './utils.js';

// Create context menu
chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		id: 'page-send-now',
		title: 'Send now',
		contexts: ['page'],
		visible: true
	});
	chrome.contextMenus.create({
		id: 'page-add-to-queue',
		title: 'Add to queue',
		contexts: ['page'],
		visible: true

	});
	chrome.contextMenus.create({
		id: 'link-send-now',
		title: 'Send now',
		contexts: ['link'],
		visible: true

	});
	chrome.contextMenus.create({
		id: 'link-add-to-queue',
		title: 'Add to queue',
		contexts: ['link'],
		visible: true

	});
});

function fetchAndUpdateBadge() {
	getStorageKeys(['queue', 'recipients', 'prefix', 'suffix',
					'maxLength', 'subject']).then(updateBadge);
}

// Function to update context menu items based on URL protocol
function updateContextMenus(url) {
	const isValidProtocol = (url && (
		url.startsWith('http://') ||
		url.startsWith('https://') ||
		url.startsWith('ftp://'))
	);

	// List of context menu item IDs
	const menuIds = [
		'page-send-now',
		'page-add-to-queue',
		'link-send-now',
		'link-add-to-queue'
	];

	if (typeof(isValidProtocol) != "boolean")
		return;
	menuIds.forEach((id) => {
		chrome.contextMenus.update(id, {
			visible: isValidProtocol,
		}, () => {
			// Handle potential errors silently
			if (chrome.runtime.lastError) {
				console.warn(`Error updating context menu ${id}:`,
							chrome.runtime.lastError.message);
			}
		});
	});
}

// Listen for tab updates to check URL
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.url || changeInfo.status === 'complete') {
		updateContextMenus(tab.url);
	}
});

// Listen for tab activation to check URL
chrome.tabs.onActivated.addListener((activeInfo) => {
	chrome.tabs.get(activeInfo.tabId, (tab) => {
		updateContextMenus(tab.url);
	});
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
	const isLink = info.linkUrl;
	const url = isLink ? info.linkUrl : tab.url;
	const title = isLink ? (info.selectionText || new URL(url).hostname) : (tab.title || 'No Title');

	// Validate URL for send-now and add-to-queue actions
	if (
		(info.menuItemId === 'page-send-now' ||
			info.menuItemId === 'link-send-now' ||
			info.menuItemId === 'page-add-to-queue' ||
			info.menuItemId === 'link-add-to-queue') &&
			!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('ftp://') )
	{
		chrome.windows.create({
			url: chrome.runtime.getURL('msgbox.html') +
						'?t=err&subj=Invalid URL&' +
						'msg=Only HTTP/HTTPS/FTP URLs can be added or sent.',
			type: 'popup',
			width: 400,
			height: 225
		});
		return;
	}

	const item = { title, url };

	if (info.menuItemId === 'page-send-now' || info.menuItemId === 'link-send-now') {
		chrome.storage.local.get(['recipients', 'prefix', 'suffix', 'subject'], (result) => {
			const recipients = Array.isArray(result.recipients) ? result.recipients : [];
			const prefix = result.prefix || '';
			const suffix = result.suffix || '';
			const subject = result.subject || 'Shared Links';

			if (recipients.length === 0) {
				chrome.storage.local.set({
					pendingAction: {
						type: 'send-now',
						item,
						menuItemId: info.menuItemId
					}
				}, () => {
					// Open the popup
					chrome.windows.create({
						url: chrome.runtime.getURL('msgbox.html') + '?t=e',
						type: 'popup',
						width: 400,
						height: 225
					});
				});

			} else {

				const { url: mailtoUrl } = buildMailtoUrl(recipients, subject, prefix,
														suffix, [item], false);
				chrome.tabs.create({ url: mailtoUrl, active: false });
			}
		});
	} else if (info.menuItemId === 'page-add-to-queue' || info.menuItemId === 'link-add-to-queue') {
		chrome.storage.local.get(['queue'], (result) => {
			const queue = result.queue || [];
			queue.push(item);
			chrome.storage.local.set({ queue }, () => {
				createNotification('Link Added', `Added "${item.title}" to queue`);
			});
		});
	}
});

// Handle the user input from msgbox.html
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === 'userInput' && message.data) {
		// Save the new recipient
		chrome.storage.local.get(['recipients'], (result) => {
			const recipients = Array.isArray(result.recipients) ? result.recipients : [];
			recipients.push(message.data); // Add the new email
			const pendingAction = message.pendingAction;

			chrome.storage.local.set({ recipients }, () => {
				if (pendingAction && pendingAction.type === 'send-now') {
					// Retrieve settings and process the stored action
					chrome.storage.local.get(['prefix', 'suffix', 'subject'], (settings) => {
						const prefix = settings.prefix || '';
						const suffix = settings.suffix || '';
						const subject = settings.subject || 'Shared Links';
						const { url: mailtoUrl } = buildMailtoUrl([message.data],
							subject, prefix, suffix, [pendingAction.item], false);
						chrome.tabs.create({ url: mailtoUrl, active: false });
					});
				}
			});
		});
	}
});

// Initialize badge
fetchAndUpdateBadge();

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
	if (area === 'local')
		fetchAndUpdateBadge();
});

function updateBadge(data) {
	const queue = data.queue || [];
	const recipients = data.recipients || [];
	const prefix = data.prefix || '';
	const suffix = data.suffix || '';
	const subject = data.subject || 'Shared Links';
	const maxLength = data.maxLength || 2000;

	if (queue.length === 0) {
		chrome.action.setBadgeText({ text: '' });
		return;
	}

	// Calculate mailto URL length
	const { url } = buildMailtoUrl(recipientList = recipients.join(','),
			subject, prefix, suffix, queue, false);

	const color = url.length > maxLength ? '#dc3545' : '#ffc107';
	chrome.action.setBadgeText({ text: queue.length.toString() });
	chrome.action.setBadgeBackgroundColor({ color });
}

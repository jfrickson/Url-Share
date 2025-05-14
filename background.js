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
		chrome.notifications.create({
			type: 'basic',
			iconUrl: 'icon48.png',
			title: 'Invalid URL',
			message: 'Only HTTP/HTTPS/FTP URLs can be added or sent.'
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
				chrome.notifications.create({
					type: 'basic',
					iconUrl: 'icon48.png',
					title: 'No Recipients',
					message: 'Select or type an email in the extension popup, ' +
							'or add recipients to the saved list.'
				});
				return;
			}

			const { url: mailtoUrl } = buildMailtoUrl(recipients, subject, prefix,
													suffix, [item], false, false);
			try {
				chrome.tabs.create({ url: mailtoUrl, active: false });
				chrome.notifications.create({
					type: 'basic',
					iconUrl: 'icon48.png',
					title: 'Email Opened',
					message: `Opening email with "${item.title}"`
				});
			} catch (error) {
				console.error('Failed to open mailto URL:', error);
				chrome.notifications.create({
					type: 'basic',
					iconUrl: 'icon48.png',
					title: 'Error',
					message: 'Failed to open email client.'
				});
			}
		});
	} else if (info.menuItemId === 'page-add-to-queue' || info.menuItemId === 'link-add-to-queue') {
		chrome.storage.local.get(['queue'], (result) => {
			const queue = result.queue || [];
			queue.push(item);
			chrome.storage.local.set({ queue }, () => {
				chrome.notifications.create({
					type: 'basic',
					iconUrl: 'icon48.png',
					title: 'Link Added',
					message: `Added "${item.title}" to queue`
				});
			});
		});
	}
});

// Initialize badge
chrome.storage.local.get(['queue', 'recipients', 'prefix', 'suffix',
						'maxLength', 'subject'], (result) => {
	updateBadge(result);
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
	if (area === 'local') {
		chrome.storage.local.get(['queue', 'recipients', 'prefix', 'suffix',
						'maxLength', 'subject'], (result) => {
			updateBadge(result);
		});
	}
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
	const links = queue.map(item => `${item.title}\n${item.url}`).join('\n\n');
	const body = `${prefix}\n\n${links}\n\n${suffix}`.trim();
	const encodedSubject = encodeURIComponent(subject);
	const encodedBody = encodeURIComponent(body);
	const recipientList = recipients.join(',');
	const mailtoUrl = `mailto:${recipientList}?subject=${encodedSubject}&body=${encodedBody}`;

	const color = mailtoUrl.length > maxLength ? '#dc3545' : '#ffc107';
	chrome.action.setBadgeText({ text: queue.length.toString() });
	chrome.action.setBadgeBackgroundColor({ color });
}

// Helper: Build mailto URL
function buildMailtoUrl(recipients, subject, prefix, suffix, queue, stripTitles, stripNames) {
	const currentRecipients = stripNames ? recipients.map(email => {
		const match = email.match(/<(.+?)>|(.+)/);
		return match ? (match[1] || match[2]) : email;
	}) : recipients;
	const links = queue.map(item => stripTitles ? item.url :
							`${item.title}\n${item.url}`).join('\n\n');
	const body = `${prefix}\n\n${links}\n\n${suffix}`.trim();
	const encodedSubject = encodeURIComponent(subject);
	const encodedBody = encodeURIComponent(body);
	const recipientList = currentRecipients.join(',');
	const url = `mailto:${recipientList}?subject=${encodedSubject}&body=${encodedBody}`;
	return { url, body };
}

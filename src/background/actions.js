/*eslint no-undef: "error"*/
/*eslint-env browser*/
/*eslint-env node*/
/*global chrome, console*/

import { buildMailtoUrl, getStorageKeys, createNotification, setStorage, calcMsgboxPos } from '../utils.js';

// Send/queue actions

// Validate URL for send-now and add-to-queue actions
export async function validateUrl(url)
{
	if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('ftp://')) {
		const pos = await getStorageKeys(['screenX', 'screenY', 'height']);
		const sz = { w: 300, h: 175 };
		const ul = await calcMsgboxPos(sz, pos);
		chrome.windows.create({
			url: chrome.runtime.getURL('msgbox.html') +
						'?t=err&subj=Invalid URL&' +
						'msg=Only HTTP/HTTPS/FTP URLs can be added or sent.',
			type: 'popup',
			width: sz.w,
			height: sz.h,
			left: ul.left,
			top: ul.top
		});
		return false;
	}
	return true;
}

// Handle send-now action
export async function handleSendNow(item, menuItemId) {
	chrome.storage.local.get(['recipients', 'prefix', 'suffix', 'subject'], (result) => {
		const recipients = Array.isArray(result.recipients) ? result.recipients : [];			// TODO: Use default recip
		const prefix = result.prefix || '';
		const suffix = result.suffix || '';
		const subject = result.subject || 'Shared Links';

		if (recipients.length === 0) {
			// Adding first recip? Make it the default (check elsewhere)
			setStorage({
				pendingAction: {
					type: 'send-now',
					item,
					menuItemId
				}
			}).then( async () => {
				// Open the popup
				const pos = await getStorageKeys(['screenX', 'screenY', 'height']);
				const sz = { w: 400, h: 200 };
				const ul = await calcMsgboxPos(sz, pos);
				chrome.windows.create({
					url: chrome.runtime.getURL('msgbox.html') +
						'?t=e&subj=Recipient Email Address&b1=OK&b2=Cancel',
					type: 'popup',
					width: sz.w,
					height: sz.h,
					left: ul.left,
					top: ul.top
				});
			}).catch((error) => {
				console.error('Failed to save pendingAction:', error);
				createNotification('Error', 'Failed to initiate email action. Please try again.', 'assets/error.png');
			});

		} else {

			const { url: mailtoUrl } = buildMailtoUrl(recipients, subject, prefix,
													suffix, [item], false);
			chrome.tabs.create({ url: mailtoUrl, active: false });
		}
	});
}

// Handle add-to-queue action
export function handleAddToQueue(item) {
	chrome.storage.local.get(['queue', 'currentQueue'], (result) => {
		const queue = result.queue || [];
		if (queue.some(queueItem => queueItem.url === item.url)) {
			createNotification('Duplicate Link', 'Link already exists in queue', 'assets/warn.png');
			return;
		}
		const currentQueue = Array.isArray(result.currentQueue) ? result.currentQueue : [];
		queue.push(item);
		currentQueue.push(queue.length - 1); // Add new item's index to currentQueue
		setStorage({ queue, currentQueue }).then(() => {
			createNotification('Link Added', `Added "${item.title}" to queue`);
		}).catch((error) => {
			console.error('Failed to update queue or currentQueue:', error);
			createNotification('Error', 'Failed to add to queue. Please try again.', 'assets/error.png');
		});
	});
}

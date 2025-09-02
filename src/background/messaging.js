/*eslint no-undef: "error"*/
/*eslint-env browser*/
/*eslint-env node*/
/*global chrome, console*/

import { buildMailtoUrl, getStorageKeys, setStorage, calcMsgboxPos } from '../utils.js';

// Message handling

// Handle the user input from msgbox.html
export function setupMessageListener() {
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (!message || typeof message !== 'object') {
			sendResponse({ error: 'Invalid message format' });
			return;
		}

		const pendingAction = message.pendingAction;

		if (message.type === 'userInput' && message.data) {
			handleUserInput(message, pendingAction, sendResponse);
		} else if (message.type === 'sendEmail') {
			handleSendEmail(message, sendResponse);
			return true; // Keep message channel open for async response
		}
	});
}

function handleUserInput(message, pendingAction, sendResponse) {
	// SECURITY FIX: Validate email input
	if (typeof message.data !== 'string' || message.data.length > 254) {
		sendResponse({ error: 'Invalid email format' });
		return;
	}

	// Save the new recipient
	chrome.storage.local.get(['recipients'], (result) => {
		const recipients = Array.isArray(result.recipients) ? result.recipients : [];
		const isFirstRecipient = recipients.length === 0;
		recipients.push(message.data); // Add the new email

		// Prepare storage update
		const storageUpdate = { recipients };
		if (isFirstRecipient) {
			storageUpdate.defaultRecip = message.data; // Set defaultRecip if first recipient
		}

		setStorage(storageUpdate, (error) => {
			console.error('Failed to save recipients:', error);
		}).then(() => {
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

function handleSendEmail(message, sendResponse) {
	const { batches, queue } = message.data;
	if (!batches || !Array.isArray(batches) || !batches.every(batch => batch.url && Array.isArray(batch.items))) {
		sendResponse({ error: 'Invalid batch data' });
		return;
	}

	(async () => {
		let sentIndices = [];
		let sendAll = false;
		try {
			for (let i = 0; i < batches.length; i++) {
				if (!sendAll) {
					const pos = await getStorageKeys(['screenX', 'screenY', 'height']);
					const sz = { w: 300, h: 175 };
					const ul = await calcMsgboxPos(sz, pos);
					const msg = `Send email ${i + 1} of ${batches.length}?`;

					const btn_pressed = await new Promise(resolve => {
						chrome.storage.local.set({ pendingAction: { type: 'sendEmailBatch', index: i } });
						chrome.runtime.onMessage.addListener(function listener(message) {
							if (message.type === 'btnclick') {
								chrome.runtime.onMessage.removeListener(listener);
								resolve(message.button);
							}
						});
						chrome.windows.create({
							url: chrome.runtime.getURL('msgbox.html') +
								`?t=qry&subj=Confirm Send&msg=${encodeURIComponent(msg)}&` +
								`showAll=${batches.length - i - 1 > 0}&` +
								`b1=Send&b2=Send All&b3=Cancel`,
							type: 'popup',
							width: sz.w,
							height: sz.h,
							left: ul.left,
							top: ul.top
						});
					});

					if (btn_pressed === 'Cancel') {
						if (sentIndices.length > 0) {
							const updatedQueue = queue.filter((_, idx) => !sentIndices.includes(idx));
							await setStorage({ queue: updatedQueue });
							sendResponse({
								updatedQueue,
								sentCount: sentIndices.length,
								batchCount: i
							});
						} else {
							sendResponse({ error: 'Sending cancelled' });
						}
						return;
					} else if (btn_pressed === 'Send All') {
						sendAll = true;
					}
				}

				await new Promise(resolve => {
					chrome.tabs.create({ url: batches[i].url, active: false }, () => {
						resolve();
					});
				});
				sentIndices = sentIndices.concat(batches[i].items.map(item => queue.indexOf(item)));
			}

			const updatedQueue = queue.filter((_, idx) => !sentIndices.includes(idx));
			await setStorage({ queue: updatedQueue });
			sendResponse({
				updatedQueue,
				sentCount: sentIndices.length,
				batchCount: batches.length
			});
		} catch (e) {
			console.error('Error sending batch emails:', e);
			if (sentIndices.length > 0) {
				const updatedQueue = queue.filter((_, idx) => !sentIndices.includes(idx));
				await setStorage({ queue: updatedQueue });
				sendResponse({
					updatedQueue,
					sentCount: sentIndices.length,
					batchCount: sentIndices.length > 0 ? batches.findIndex(b => b.items.includes(queue[sentIndices[sentIndices.length - 1]])) + 1 : 0
				});
			} else {
				sendResponse({ error: 'Failed to send emails or update queue' });
			}
		}
	})();
}

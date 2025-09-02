/*eslint no-undef: "error"*/
/*eslint-env browser*/
/*eslint-env node*/
/*global chrome, console, document, window*/

import { isValidEmail, buildMailtoUrl, calculateEmailsNeeded, setStatus, setStorage, calcMsgboxPos, moveQueueItem } from '../utils.js';

// Event handlers

export function handleWindowLoad()
{
	setStorage({
		screenX: window.screenX,
		screenY: window.screenY,
		height: window.outerHeight
	}, (error) => {
		console.error('Failed to save window position:', error);
		setStatus('Failed to save window position', 'red');
	});
}

export async function handleAddRecipient(localData, recipientInput, updateRecipientList)
{
	const recipient = recipientInput.value.trim();
	if (!isValidEmail(recipient)) {
		setStatus('Invalid email address', 'red');
		return;
	}
	if (localData.recipients.includes(recipient)) {
		setStatus('Email address already exists', 'red');
		return;
	}
	try {
		localData.recipients.push(recipient);
		await setStorage({ recipients: localData.recipients }, () => {
			localData.recipients.pop();
			updateRecipientList(localData.recipients, localData.defaultRecip);
			setStatus('Failed to save recipient', 'red');
		});
		recipientInput.value = recipient;
		if (localData.defaultRecip === '') {
			localData.defaultRecip = recipient;
			await setStorage({ defaultRecip: recipient });
		}
		updateRecipientList(localData.recipients, localData.defaultRecip);
		setStatus('Recipient added to saved list', 'green');
	} catch (e) {
		localData.recipients.pop();
		console.error('Failed to save recipient:', e);
		setStatus('Failed to save recipient', 'red');
		updateRecipientList(localData.recipients, localData.defaultRecip);
	}
}

export async function handleAddToQueue(localData, curTab, debouncedUpdateQueueList, updateStatus)
{
	const item = { title: curTab.title || 'No Title', url: curTab.url };
	if (localData.queue.some(queueItem => queueItem.url === item.url)) {
		setStatus('Link already exists in queue', 'red');
		return;
	}
	localData.queue.push(item);
	localData.currentQueue.push(localData.queue.length - 1);
	await setStorage({ queue: localData.queue, currentQueue: localData.currentQueue }, () => {
		localData.queue.pop();
		debouncedUpdateQueueList(localData.queue);
		setStatus('Failed adding current page to queue', 'red');
	}, setStatus);
	debouncedUpdateQueueList(localData.queue);
	setStatus('Added to queue', 'green');
	updateStatus();
}

export async function handleClearQueue(localData, debouncedUpdateQueueList, updateStatus)
{
	const pos = {
			screenX: window.screenX,
			screenY: window.screenY,
			height: window.outerHeight
	};
	const sz = { w: 300, h: 175 };
	const ul = await calcMsgboxPos(sz, pos);

	await setStorage({ pendingAction: { type: 'clearQueue' } });

	const msg = "Are you sure you want to clear the queue?";
	const btn_pressed = await new Promise(resolve => {
		function clearQueueMessageListener(message) {
			const pendingAction = message.pendingAction;
			if (pendingAction && pendingAction.type === 'clearQueue') {
				if (message.type === 'btnclick') {
					chrome.runtime.onMessage.removeListener(clearQueueMessageListener);
					resolve(message.button);
				}
			}
		}

		chrome.runtime.onMessage.addListener(clearQueueMessageListener);

		chrome.windows.create({
			url: chrome.runtime.getURL('msgbox.html') +
				`?t=qry&subj=Clear Queue&msg=${msg}&b1=Yes&b2=No`,
			type: 'popup',
			width: sz.w,
			height: sz.h,
			left: ul.left,
			top: ul.top
		});
	});

	if (btn_pressed === "Yes") {
		await setStorage({ queue: [], currentQueue: [] });
		debouncedUpdateQueueList([]);
		localData.queue = [];
		localData.currentQueue = [];
		setStatus('Queue cleared', 'green');
		updateStatus();
	}
}

export async function handleSendEmail(localData, prefix, suffix, subject, maxLength, debouncedUpdateQueueList)
{
	// Add input validation for prefix to address Codacy warning
	if (typeof prefix.value !== 'string') {
		setStatus('Invalid prefix value', 'red');
		return;
	}

    // Collect checked recipients from recipientList
	const recipientCheckboxes = document.querySelectorAll('#recipientList input[type="checkbox"]');
	const recipients = Array.from(recipientCheckboxes)
		.filter(cb => cb.checked)
		.map(cb => cb.parentElement.querySelector('.email_entry').textContent.trim())
		.filter(Boolean);
	const queue = localData.queue;

	localData.prefix = prefix.value;
	localData.suffix = suffix.value;
	localData.subject = subject.value;
	await setStorage({ prefix, suffix, subject });

	if (recipients.length === 0) {
		setStatus('No recipients selected', 'red');
		return;
	}
	if (!recipients.every(isValidEmail)) {
		setStatus('One or more selected emails are invalid', 'red');
		return;
	}
	if (localData.queue.length === 0) {
		setStatus('Queue is empty', 'red');
		return;
	}

	// Only send checked links
	const queueCheckboxes = document.querySelectorAll('#queueList input[type="checkbox"]');
	const selectedQueue = [];
	const selectedIndices = [];
	queueCheckboxes.forEach((cb) => {
		if (cb.checked) {
			const idx = parseInt(cb.dataset.index);
			selectedQueue.push(queue[idx]);
			selectedIndices.push(idx);
		}
	});
	if (selectedQueue.length === 0) {
		setStatus('No links selected', 'red');
		return;
	}

	const { url: mailtoUrl } = buildMailtoUrl(recipients,
			localData.subject, localData.prefix, localData.suffix,
			selectedQueue, false, false);
	if (mailtoUrl.length <= maxLength) {
		try {
			// Ensure the URL is a mailto URL before navigation
			if (!mailtoUrl.startsWith('mailto:')) {
				setStatus('Invalid email URL generated', 'red');
				return;
			}
			window.location.href = mailtoUrl;
		} catch (e) {
			setStatus('Failed to open email client', 'red');
			return;
		}
		setStatus('Opening email client...', 'green');
		// Remove only sent (checked) items from queue
		const updatedQueue = localData.queue.filter((_, i) => !selectedIndices.includes(i));
		localData.queue = updatedQueue;
		await setStorage({ queue: updatedQueue });
		debouncedUpdateQueueList(updatedQueue);

	} else {

		const batches = calculateEmailsNeeded(recipients, localData.subject,
			localData.prefix, localData.suffix, selectedQueue, false, maxLength);
		console.log('Batches:', batches); // Debug log
		if (!batches.length || !batches.every(batch => batch.url && Array.isArray(batch.items))) {
			setStatus('Error: Invalid batch structure', 'red');
			console.error('Invalid batches:', batches);
			return;
		}

		// Send batches to background.js for processing with confirmations
		setStatus('Waiting for batch confirmation...', 'green');
		chrome.runtime.sendMessage({
			type: 'sendEmail',
			data: {
				batches,
				queue: localData.queue,
				selectedIndices
			}
		}, (response) => {
			if (chrome.runtime.lastError) {
				setStatus('Error communicating with background script', 'red');
				console.error('Background communication error:', chrome.runtime.lastError);
				return;
			}
			if (response.error) {
				setStatus(response.error, 'red');
				return;
			}
			localData.queue = response.updatedQueue;
			debouncedUpdateQueueList(localData.queue);
			setStatus(`Sent ${response.sentCount} item${response.sentCount > 1 ? 's' : ''} ` +
				`in ${response.batchCount} email${response.batchCount > 1 ? 's' : ''}`, 'green');
		});
	}
}

export async function handleRecipientCheckboxChange(event, localData, updateStatus)
{
	const checkbox = event.target;
	const recipient = checkbox.parentElement.querySelector('.email_entry').textContent;
	let currentRecips = localData.currentRecips || [];

	if (checkbox.checked) {
		if (!currentRecips.includes(recipient)) currentRecips.push(recipient);
	} else {
		currentRecips = currentRecips.filter(r => r !== recipient);
	}

	localData.currentRecips = currentRecips;
	await setStorage({ currentRecips });
	updateStatus();
}

export function createHandleSetDefaultRecipient(recipient, localData, updateRecipientList, updateStatus)
{
	return async () => {
		const oldDefaultRecip = localData.defaultRecip;
		await setStorage({ defaultRecip: recipient }, () => {
			localData.defaultRecip = oldDefaultRecip;
			setStatus('Failed to set recipient as default', 'red');
			updateRecipientList(localData.recipients, oldDefaultRecip);
		});
		updateRecipientList(localData.recipients, recipient);
		setStatus('Recipient set as default', 'green');
		updateStatus();
	};
}

export function createHandleRemoveRecipient(recipient, localData, updateRecipientList, recipientInput, updateStatus)
{
	return async () => {
		const recipients = localData.recipients;
		let defaultRecip = localData.defaultRecip || '';
		const updated = recipients.filter(r => r !== recipient);
		if (recipient === defaultRecip) {
			defaultRecip = updated.length > 0 ? updated[0] : '';
		}
		await setStorage({ recipients: updated, defaultRecip }, async (error) => {
			if (error) {
				localData.recipients = recipients;
				localData.defaultRecip = defaultRecip;
				setStatus('Failed to update recipients', 'red');
				return;
			}
		});
		// Remove from currentRecips as well
		const currentRecips = localData.currentRecips || [];
		const newCurrent = currentRecips.filter(r => r !== recipient);
		await setStorage({ currentRecips: newCurrent });
		localData.recipients = updated;
		localData.defaultRecip = defaultRecip;
		localData.currentRecips = newCurrent;
		updateRecipientList(updated, defaultRecip);
		recipientInput.value = '';
		setStatus('Recipient removed from saved list', 'green');
		updateStatus();
	};
}

export async function handleQueueChange(e, localData, updateStatus)
{
	if (e.target.type === 'checkbox') {
		const list = document.getElementById('queueList');
		const allCheckboxes = list.querySelectorAll('input[type="checkbox"]');
		const checkedIndices = Array.from(allCheckboxes)
			.filter(cb => cb.checked)
			.map(cb => parseInt(cb.dataset.index));
		await setStorage({ currentQueue: checkedIndices }, (error) => {
			console.error('Failed to save checked indices:', error);
			setStatus('Failed to update queue selection', 'red');
		});
		localData.currentQueue = checkedIndices;
		updateStatus();
	}
}

export async function handleQueueClick(e, localData, debouncedUpdateQueueList, updateStatus)
{
	const li = e.target.closest('li');
	if (!li) return;
	const index = parseInt(li.dataset.index);

	if (e.target.classList.contains('up-btn')) {
		await moveQueueItem('liveRegion-main', localData.queue, index, -1, debouncedUpdateQueueList);
	} else if (e.target.classList.contains('dn-btn')) {
		await moveQueueItem('liveRegion-main', localData.queue, index, 1, debouncedUpdateQueueList);
	} else if (e.target.classList.contains('remove-btn')) {
		const updated = localData.queue.filter((_, i) => i !== index);
		// Remove the index from currentQueue and adjust indices above the removed one
		let updatedCurrentQueue = (localData.currentQueue || []).filter(i => i !== index).map(i => i > index ? i - 1 : i);
		await setStorage({ queue: updated, currentQueue: updatedCurrentQueue }, (error) => {
			if (error) {
				localData.currentQueue = localData.currentQueue || [];
				debouncedUpdateQueueList(localData.queue);
				setStatus('Failed to remove from queue', 'red');
			}
		});

		localData.queue = updated;
		localData.currentQueue = updatedCurrentQueue;
		debouncedUpdateQueueList(updated);
		setStatus('Removed from queue', 'green');
		updateStatus();
	}
}

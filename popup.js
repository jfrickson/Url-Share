import { buildMailtoUrl, isValidEmail } from './utils.js';

// Export helper functions needed by overLimitDialog.js
export { calculateEmailsNeeded, showConfirmDialog, moveQueueItem, setupDragAndDrop };

// Load saved data
document.addEventListener('DOMContentLoaded', () => {
	// Load length limit
	chrome.storage.local.get(['maxLength', 'subject'], (result) => {
		document.getElementById('subject').value = result.subject || 'Shared Links';
		document.getElementById('maxLength').value = result.maxLength || 2000;
	});

	// Load recipients into select
	chrome.storage.local.get(['recipients', 'defaultRecip'], (result) => {
		const recipients = result.recipients || [];
		const defaultRecip = result.defaultRecip || '';
		updateRecipientSelect(recipients, defaultRecip);
	});

	// Load queue
	chrome.storage.local.get(['queue'], (result) => {
		const queue = result.queue || [];
		updateQueueList(queue);
	});

	// Load prefix/suffix
	chrome.storage.local.get(['prefix', 'suffix'], (result) => {
		document.getElementById('prefix').value = result.prefix || '';
		document.getElementById('suffix').value = result.suffix || '';
	});

	// Get current page
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		const tab = tabs[0];
		const url = tab.url;
		const title = tab.title;
		if (title)
			document.getElementById('currentPage').textContent = `${title}`;
		else
			document.getElementById('currentPage').textContent = `${url}`;
		if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('ftp://'))
			document.getElementById('addToQueue').disabled = true;
	});

	// Sync select and input
	const recipientSelect = document.getElementById('recipientSelect');
	const recipientInput = document.getElementById('recipientInput');
	recipientSelect.addEventListener('change', () => {
		if (recipientSelect.value === '') {
			recipientInput.value = '';
			recipientInput.disabled = false;
			recipientInput.focus();
		} else {
			recipientInput.value = recipientSelect.value;
			recipientInput.disabled = true;
		}
	});

	// Enable input when typing
	recipientInput.addEventListener('input', () => {
		if (recipientInput.value !== recipientSelect.value) {
			recipientSelect.value = '';
			recipientInput.disabled = false;
		}
	});
});

// length change
document.getElementById('maxLength').addEventListener('change', (e) => {
	const maxLength = Math.max(500, Math.min(5000, e.target.value));
	chrome.storage.local.set({ maxLength });
	e.target.value = maxLength;
});

// Add recipient to saved list
document.getElementById('addRecipient').addEventListener('click', () => {
	const recipient = document.getElementById('recipientInput').value.trim();
	const status = document.getElementById('status');
	if (!isValidEmail(recipient)) {
		status.textContent = 'Invalid email address';
		status.style.color = 'red';
		return;
	}
	chrome.storage.local.get(['recipients', 'defaultRecip'], (result) => {
		const recipients = result.recipients || [];
		const defaultRecip = result.defaultRecip || (recipients.length > 0 ? recipients[0] : '');
		if (!recipients.includes(recipient)) {
			recipients.push(recipient);
			chrome.storage.local.set({ recipients }, () => {
				updateRecipientSelect(recipients, defaultRecip);
				document.getElementById('recipientSelect').value = recipient;
				document.getElementById('recipientInput').value = recipient;
				document.getElementById('recipientInput').disabled = true;
				status.textContent = 'Recipient added to saved list';
				status.style.color = 'green';
			});
		} else {
			status.textContent = 'Recipient already in list';
			status.style.color = 'orange';
		}
	});
});

// Remove recipient from saved list
document.getElementById('removeRecipient').addEventListener('click', () => {
	const recipient = document.getElementById('recipientInput').value.trim();
	const status = document.getElementById('status');
	chrome.storage.local.get(['recipients', 'defaultRecip'], (result) => {
		const recipients = result.recipients || [];
		let defaultRecip = result.defaultRecip || '';
		if (recipients.includes(recipient)) {
			const updated = recipients.filter(r => r !== recipient);
			// If the removed recipient was the default, reset defaultRecip
			if (recipient === defaultRecip) {
				defaultRecip = updated.length > 0 ? updated[0] : '';
			}
			chrome.storage.local.set({ recipients: updated, defaultRecip }, () => {
				updateRecipientSelect(updated, defaultRecip);
				document.getElementById('recipientInput').value = '';
				document.getElementById('recipientSelect').value = '';
				document.getElementById('recipientInput').disabled = false;
				status.textContent = 'Recipient removed from saved list';
				status.style.color = 'green';
			});
		} else {
			status.textContent = 'Recipient not in saved list';
			status.style.color = 'red';
		}
	});
});

// Make recipient the default
document.getElementById('makeDefault').addEventListener('click', () => {
	const recipient = document.getElementById('recipientInput').value.trim();
	const status = document.getElementById('status');
	if (!isValidEmail(recipient)) {
		status.textContent = 'Invalid email address';
		status.style.color = 'red';
		return;
	}
	chrome.storage.local.get(['recipients'], (result) => {
		const recipients = result.recipients || [];
		if (!recipients.includes(recipient)) {
			status.textContent = 'Please add recipient to saved list first';
			status.style.color = 'red';
			return;
		}
		chrome.storage.local.set({ defaultRecip: recipient }, () => {
			updateRecipientSelect(recipients, recipient);
			document.getElementById('recipientSelect').value = recipient;
			document.getElementById('recipientInput').value = recipient;
			document.getElementById('recipientInput').disabled = true;
			status.textContent = 'Recipient set as default';
			status.style.color = 'green';
		});
	});
});

// Add current page to queue
document.getElementById('addToQueue').addEventListener('click', () => {
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		const tab = tabs[0];
		const item = { title: tab.title || 'No Title', url: tab.url };
		chrome.storage.local.get(['queue'], (result) => {
			const queue = result.queue || [];
			queue.push(item);
			chrome.storage.local.set({ queue }, () => {
				updateQueueList(queue);
				document.getElementById('status').textContent = 'Added to queue';
				document.getElementById('status').style.color = 'green';
			});
		});
	});
});

// Clear queue
document.getElementById('clearQueue').addEventListener('click', () => {
	if (confirm('Clear the queue?')) {
		chrome.storage.local.set({ queue: [] }, () => {
			updateQueueList([]);
			document.getElementById('status').textContent = 'Queue cleared';
			document.getElementById('status').style.color = 'green';
		});
	}
});

// Send email
document.getElementById('sendEmail').addEventListener('click', () => {
	const status = document.getElementById('status');
	const recipient = document.getElementById('recipientInput').value.trim();
	chrome.storage.local.get(['queue', 'prefix', 'suffix', 'maxLength', 'subject'], (result) => {
		const queue = result.queue || [];
		const prefix = document.getElementById('prefix').value;
		const suffix = document.getElementById('suffix').value;
		const subject = document.getElementById('subject').value;
		const maxLength = result.maxLength || 2000;

		chrome.storage.local.set({ prefix, suffix, subject });

		if (!isValidEmail(recipient)) {
			status.textContent = 'Invalid email address';
			status.style.color = 'red';
			return;
		}
		if (queue.length === 0) {
			status.textContent = 'Queue is empty';
			status.color = 'red';
			return;
		}
		if (!isValidEmail(recipient)) {
			status.textContent = 'Invalid email address';
			status.style.color = 'red';
			return;
		}
		if (queue.length === 0) {
			status.textContent = 'Queue is empty';
			status.color = 'red';
			return;
		}

		const recipients = [recipient];
		const { url: mailtoUrl, body } = buildMailtoUrl(recipients, subject, prefix, suffix, queue, false, false);
		if (mailtoUrl.length <= maxLength) {
			window.location.href = mailtoUrl;
			status.textContent = 'Opening email client...';
			status.style.color = 'green';
			chrome.storage.local.set({ queue: [] }, () => { updateQueueList([]); });
		} else
			showOverLimitDialog(recipients, queue, prefix, suffix, subject, maxLength, body, updateQueueList);
	});
});




// Over-limit dialog logic
function showOverLimitDialog(recipients, queue, prefix, suffix, subject, maxLength, initialBody) {
	const dialog = document.getElementById('overLimitDialog');
	const limitInfo = document.getElementById('limitInfo');
	const dialogRecipients = document.getElementById('dialogRecipients');
	const dialogPrefix = document.getElementById('dialogPrefix');
	const dialogSuffix = document.getElementById('dialogSuffix');
	const dialogQueue = document.getElementById('dialogQueue');
	const stripTitles = document.getElementById('stripTitles');
	const emailCount = document.getElementById('emailCount');
	const nameStripSaves = document.getElementById('nameStripSaves');
	const titleStripSaves = document.getElementById('titleStripSaves');

	// Initialize dialog
	limitInfo.textContent = `The email exceeds the ${maxLength}-character limit. Adjust below.`;
	dialogRecipients.textContent = recipients.join(', ');
	dialogPrefix.value = prefix;
	dialogSuffix.value = suffix;

	const saveSize = queue.map(item => `${item.title}\n${item.url}`).join('\n\n').length -
					queue.map(item => item.url).join('\n\n').length;
	titleStripSaves.textContent = saveSize;

	// Build queue with checkboxes and buttons
	dialogQueue.innerHTML = '';
	queue.forEach((item, index) => {
		const li = document.createElement('li');
		li.draggable = true;
		li.dataset.index = index;
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.checked = true;
		checkbox.dataset.index = index;
		const length = encodeURIComponent(`${item.title}\n${item.url}`).length;
		const label = document.createElement('label');
		label.className = "queue_entry"
		label.textContent = `(${length}) ${item.title}\n${item.url}`;
		const upBtn = document.createElement('button');
		upBtn.textContent = 'Up';
		upBtn.className = 'move-btn';
		upBtn.disabled = index === 0;
		upBtn.setAttribute('aria-label', 'Move item up');
		upBtn.onclick = () => moveQueueItem(queue, index, -1, () => {
			showOverLimitDialog(recipients, queue, dialogPrefix.value, dialogSuffix.value, subject, maxLength, initialBody);
		});
		const downBtn = document.createElement('button');
		downBtn.textContent = 'Dn';
		downBtn.className = 'move-btn';
		downBtn.disabled = index === queue.length - 1;
		downBtn.setAttribute('aria-label', 'Move item down');
		downBtn.onclick = () => moveQueueItem(queue, index, 1, () => {
			showOverLimitDialog(recipients, queue, dialogPrefix.value, dialogSuffix.value, subject, maxLength, initialBody);
		});
		li.appendChild(checkbox);
		li.appendChild(label);
		li.appendChild(upBtn);
		li.appendChild(downBtn);
		dialogQueue.appendChild(li);
	});

	// Drag-and-drop for dialog queue
	setupDragAndDrop(dialogQueue, queue, (newQueue) => {
		queue = newQueue;
		showOverLimitDialog(recipients, queue, dialogPrefix.value, dialogSuffix.value, subject, maxLength, initialBody);
	});

	// Update length and email count
	function updateDialog() {
		const selectedIndices = Array.from(dialogQueue.querySelectorAll('input:checked')).map(cb => parseInt(cb.dataset.index));
		const selectedQueue = selectedIndices.map(i => queue[i]);
		const currentPrefix = dialogPrefix.value;
		const currentSuffix = dialogSuffix.value;
		const useStripTitles = stripTitles.checked;
		const currentRecipients = recipients;

		const { url } = buildMailtoUrl(currentRecipients, subject, currentPrefix, currentSuffix, selectedQueue, useStripTitles);
		const emailsNeeded = calculateEmailsNeeded(
									currentRecipients, subject, currentPrefix, currentSuffix,
								  	selectedQueue, useStripTitles, maxLength);

		limitInfo.innerHTML = `The email exceeds the ${maxLength}-character limit.<br>` +
								`Current length: ${url.length} characters.<br>` +
								`${emailsNeeded.length} separate emails would be needed`;
		emailCount.textContent = `${emailsNeeded.length} email${emailsNeeded.length > 1 ? 's' : ''} will be sent.`;
	}

	// Event listeners for real-time updates
	dialogPrefix.addEventListener('input', updateDialog);
	dialogSuffix.addEventListener('input', updateDialog);
	stripTitles.addEventListener('change', updateDialog);
	dialogQueue.addEventListener('change', updateDialog);

	// Initial update
	updateDialog();

	// Send selected
	document.getElementById('sendSelected').onclick = async () => {
		const status = document.getElementById('status');
		const selectedIndices = Array.from(dialogQueue.querySelectorAll('input:checked'))
									.map(cb => parseInt(cb.dataset.index));
		const selectedQueue = selectedIndices.map(i => queue[i]);
		let remainingQueue = [...queue]; // Start with full queue
		const currentPrefix = dialogPrefix.value;
		const currentSuffix = dialogSuffix.value;
		const useStripTitles = stripTitles.checked;
		const currentRecipients = recipients;

		// Save updated prefix/suffix
		chrome.storage.local.set({ prefix: currentPrefix, suffix: currentSuffix });

		if (!isValidInputText(prefix)) {
			status.textContent = 'Invalid prefix: contains disallowed characters or is too long';
			status.style.color = 'red';
			return;
		}
		if (!isValidInputText(suffix)) {
			status.textContent = 'Invalid prefix: contains disallowed characters or is too long';
			status.style.color = 'red';
			return;
		}

		// Split emails if needed
		const emails = calculateEmailsNeeded(
						currentRecipients, subject, currentPrefix, currentSuffix,
						selectedQueue, useStripTitles, maxLength);


		// Map selected queue items to their original indices for tracking
		const selectedItems = selectedQueue.map((item, idx) => ({
			item, originalIndex: selectedIndices[idx]
		}));

		let sentCount = 0;
		for (let i = 0; i < emails.length; i++) {
			const emailQueue = emails[i];
			const { url } = buildMailtoUrl(currentRecipients,
					`${subject}${emails.length > 1 ? ` (Part ${i + 1})` : ''}`,
					currentPrefix, currentSuffix, emailQueue, useStripTitles);
			const confirmed = await showConfirmDialog(`Send email ${i + 1} of ${emails.length}?`,
											i === emails.length - 1, emails.length - i - 1);
			if (confirmed === 'all') {
				// Send all remaining emails with delay
				for (let j = i; j < emails.length; j++) {
					const subQueue = emails[j];
					const subUrl = buildMailtoUrl(
						currentRecipients, `${subject}${emails.length > 1 ? ` (Part ${j + 1})` : ''}`,
						currentPrefix, currentSuffix, subQueue, useStripTitles
					).url;

					setTimeout(() => {
						window.location.href = subUrl;
						// Remove sent items from remainingQueue
						const sentIndices = subQueue.map(sentItem =>
							selectedItems.find(si => si.item === sentItem).originalIndex
						);
						remainingQueue = remainingQueue.filter((_, idx) => !sentIndices.includes(idx));
						chrome.storage.local.set({ queue: remainingQueue });
					}, (j - i) * 2000); // 2-second delay
					sentCount++;
				}
				break;
			} else if (confirmed) {
				window.location.href = url;
				sentCount++;

				// Remove sent items from remainingQueue
				const sentIndices = emailQueue.map(sentItem =>
					selectedItems.find(si => si.item === sentItem).originalIndex
				);
				remainingQueue = remainingQueue.filter((_, idx) => !sentIndices.includes(idx));
				chrome.storage.local.set({ queue: remainingQueue }, () => {
							updateQueueList(remainingQueue); });

			} else {
				document.getElementById('status').textContent = `Stopped at email ${i + 1}`;
				document.getElementById('status').style.color = sentCount > 0 ? 'green' : 'red';
				break;
			}
		}

		dialog.style.display = 'none';
		document.getElementById('status').textContent = `Opened ${sentCount} email${sentCount !== 1 ? 's' : ''}`;
		document.getElementById('status').style.color = sentCount > 0 ? 'green' : 'red';
	};

	// Save changes
	document.getElementById('saveChanges').onclick = () => {
		const selectedIndices = Array.from(dialogQueue.querySelectorAll('input:checked'))
									.map(cb => parseInt(cb.dataset.index));
		const remainingQueue = queue.filter((_, i) => !selectedIndices.includes(i));
		const currentPrefix = dialogPrefix.value;
		const currentSuffix = dialogSuffix.value;
		chrome.storage.local.set({ prefix: currentPrefix, suffix: currentSuffix,
								   queue: remainingQueue }, () => {
			updateQueueList(remainingQueue);
			dialog.style.display = 'none';
			document.getElementById('status').textContent = 'Changes saved';
			document.getElementById('status').style.color = 'green';
		});
	};

	// Cancel
	document.getElementById('cancelDialog').onclick = () => {
		dialog.style.display = 'none';
	};

	// Show dialog
	dialog.style.display = 'flex';
}

// Confirmation dialog
function showConfirmDialog(message, isLast, remaining) {
	return new Promise((resolve) => {
		const dialog = document.getElementById('confirmDialog');
		const messageEl = document.getElementById('confirmMessage');
		const sendBtn = document.getElementById('confirmSend');
		const sendAllBtn = document.getElementById('confirmSendAll');
		const cancelBtn = document.getElementById('confirmCancel');

		messageEl.textContent = message;
		sendAllBtn.style.display = remaining > 0 ? 'inline-block' : 'none';
		dialog.style.display = 'flex';

		const cleanup = () => {
			dialog.style.display = 'none';
			sendBtn.removeEventListener('click', onSend);
			sendAllBtn.removeEventListener('click', onSendAll);
			cancelBtn.removeEventListener('click', onCancel);
		};

		const onSend = () => {
			cleanup();
			resolve(true);
		};

		const onSendAll = () => {
			cleanup();
			resolve('all');
		};

		const onCancel = () => {
			cleanup();
			resolve(false);
		};

		sendBtn.addEventListener('click', onSend);
		sendAllBtn.addEventListener('click', onSendAll);
		cancelBtn.addEventListener('click', onCancel);
	});
}

// Helper: Strip recipient name
function stripRecipientName(email) {
	const match = email.match(/<(.+?)>|(.+)/);
	return match ? (match[1] || match[2]) : email;
}

// Helper: Calculate emails needed
function calculateEmailsNeeded(recipients, subject, prefix, suffix, queue, stripTitles, maxLength) {
	const emails = [];
	let currentQueue = [];
	let currentLength = 0;

	// Base length (recipients, subject, prefix, suffix)
	const base = buildMailtoUrl(recipients, subject, prefix, suffix, [], stripTitles).url.length;

	queue.forEach((item) => {
		const linkText = stripTitles ? item.url : `${item.title}\n${item.url}`;
		const linkLength = encodeURIComponent(linkText).length + (currentQueue.length ? 4 : 0);

		if (base + currentLength + linkLength <= maxLength) {
			currentQueue.push(item);
			currentLength += linkLength;
		} else {
			if (currentQueue.length) {
				emails.push([...currentQueue]);
			}
			currentQueue = [item];
			currentLength = linkLength;
		}
	});

	if (currentQueue.length) {
		emails.push(currentQueue);
	}

	return emails;
}

// Helper: Move queue item
function moveQueueItem(queue, index, direction, callback) {
	const newIndex = index + direction;
	if (newIndex < 0 || newIndex >= queue.length) return;
	const newQueue = [...queue];
	[newQueue[index], newQueue[newIndex]] = [newQueue[newIndex], newQueue[index]];
	chrome.storage.local.set({ queue: newQueue }, () => {
		callback(newQueue);
	});
}

// Helper: Setup drag-and-drop
function setupDragAndDrop(container, queue, onUpdate) {
	container.addEventListener('dragstart', (e) => {
		if (e.target.tagName === 'LI') {
			e.target.classList.add('dragging');
			e.dataTransfer.setData('text/plain', e.target.dataset.index);
		}
	});

	container.addEventListener('dragend', (e) => {
		if (e.target.tagName === 'LI') {
			e.target.classList.remove('dragging');
		}
	});

	container.addEventListener('dragover', (e) => {
		e.preventDefault();
		const dragging = container.querySelector('.dragging');
		const afterElement = getDragAfterElement(container, e.clientY);
		if (afterElement == null) {
			container.appendChild(dragging);
		} else {
			container.insertBefore(dragging, afterElement);
		}
	});

	container.addEventListener('drop', (e) => {
		e.preventDefault();
		const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
		const newOrder = Array.from(container.children).map(li => parseInt(li.dataset.index));
		const newQueue = newOrder.map(i => queue[i]);
		chrome.storage.local.set({ queue: newQueue }, () => {
			onUpdate(newQueue);
		});
	});

	function getDragAfterElement(container, y) {
		const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];
		return draggableElements.reduce((closest, child) => {
			const box = child.getBoundingClientRect();
			const offset = y - box.top - box.height / 2;
			if (offset < 0 && offset > closest.offset) {
				return { offset, element: child };
			}
			return closest;
		}, { offset: Number.NEGATIVE_INFINITY }).element;
	}
}

// Helper: Validate input (prefix and suffix)
function isValidInputText(input, maxLength = 500) {
	if (typeof input !== 'string') return false;
	if (input.length > maxLength) return false;
	// Disallow HTML tags, scripts, and control characters
	const invalidPattern = /[<>{}\[\]\(\)\\/*`~|;]|script|[\u0000-\u001F\u007F-\u009F]/i;
	return !invalidPattern.test(input);
}

// Update recipient select
function updateRecipientSelect(recipients, defaultRecip) {
	const select = document.getElementById('recipientSelect');
	const currentValue = select.value;
	select.innerHTML = '<option value="">Type new email...</option>';
	recipients.forEach((recipient) => {
		const option = document.createElement('option');
		option.value = recipient;
		option.textContent = recipient;
		if (recipient === defaultRecip)
			option.className = 'default_recip';
		select.appendChild(option);
	});
	// Restore previous selection if still valid
	if (recipients.includes(defaultRecip)) {
			select.value = defaultRecip;
			document.getElementById('recipientInput').value = defaultRecip;
			document.getElementById('recipientInput').disabled = true;
	} else if (recipients.includes(currentValue)) {
				select.value = currentValue;
				document.getElementById('recipientInput').value = currentValue;
				document.getElementById('recipientInput').disabled = true;
	} else {
		select.value = '';
		document.getElementById('recipientInput').value = '';
		document.getElementById('recipientInput').disabled = false;
	}
}

// Update queue list UI
function updateQueueList(queue) {
	const list = document.getElementById('queueList');
	list.innerHTML = '';
	queue.forEach((item, index) => {
		const li = document.createElement('li');
		li.draggable = true;
		li.dataset.index = index;
		const length = encodeURIComponent(`${item.title}\n${item.url}`).length;
		const content = document.createElement('span');
		content.className = 'queue_entry';
		content.innerHTML = `<span class="length-prefix">(${length})</span> ${item.title}<br>${item.url}`;
		const upBtn = document.createElement('button');
		upBtn.textContent = 'Up';
		upBtn.className = 'move-btn';
		upBtn.disabled = index === 0;
		upBtn.setAttribute('aria-label', 'Move item up');
		upBtn.onclick = () => moveQueueItem(queue, index, -1, updateQueueList);
		const downBtn = document.createElement('button');
		downBtn.textContent = 'Dn';
		downBtn.className = 'move-btn';
		downBtn.disabled = index === queue.length - 1;
		downBtn.setAttribute('aria-label', 'Move item down');
		downBtn.onclick = () => moveQueueItem(queue, index, 1, updateQueueList);
		const removeBtn = document.createElement('button');
		removeBtn.textContent = 'Remove';
		removeBtn.className = 'remove-btn';
		removeBtn.onclick = () => {
			chrome.storage.local.get(['queue'], (result) => {
				const updated = result.queue.filter((_, i) => i !== index);
				chrome.storage.local.set({ queue: updated }, () => {
					updateQueueList(updated);
				});
			});
		};
		li.appendChild(content);
		li.appendChild(upBtn);
		li.appendChild(downBtn);
		li.appendChild(removeBtn);
		list.appendChild(li);
	});

	// Setup drag-and-drop
	setupDragAndDrop(list, queue, updateQueueList);
}

// overLimitDialog.js
import { buildMailtoUrl } from './utils.js';
import { calculateEmailsNeeded } from './popup.js'; // Assuming calculateEmailsNeeded is exported from popup.js
import { showConfirmDialog } from './popup.js'; // Assuming showConfirmDialog is exported from popup.js
import { moveQueueItem, setupDragAndDrop } from './popup.js'; // Assuming these are exported from popup.js

// Initialize the dialog UI
function initDialog(dialog, recipients, prefix, suffix, subject, maxLength) {
	const limitInfo = document.getElementById('limitInfo');
	const dialogRecipients = document.getElementById('dialogRecipients');
	const dialogPrefix = document.getElementById('dialogPrefix');
	const dialogSuffix = document.getElementById('dialogSuffix');

	limitInfo.textContent = `The email exceeds the ${maxLength}-character limit. Adjust below.`;
	dialogRecipients.textContent = recipients.join(', ');
	dialogPrefix.value = prefix;
	dialogSuffix.value = suffix;

	dialog.style.display = 'flex';
}

// Render the queue list with checkboxes and buttons
function renderQueueList(queue, dialogQueue, recipients, subject, prefix, suffix, maxLength) {
	dialogQueue.innerHTML = '';
	const saveSize = queue.map(item => `${item.title}\n${item.url}`).join('\n\n').length -
		queue.map(item => item.url).join('\n\n').length;
	document.getElementById('titleStripSaves').textContent = saveSize;

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
		label.className = 'queue_entry';
		label.textContent = `(${length}) ${item.title}\n${item.url}`;

		const upBtn = document.createElement('button');
		upBtn.textContent = 'Up';
		upBtn.className = 'move-btn';
		upBtn.disabled = index === 0;
		upBtn.setAttribute('aria-label', 'Move item up');
		upBtn.onclick = () => moveQueueItem(queue, index, -1, () => {
			showOverLimitDialog(recipients, queue, dialogPrefix.value, dialogSuffix.value, subject, maxLength);
		});

		const downBtn = document.createElement('button');
		downBtn.textContent = 'Dn';
		downBtn.className = 'move-btn';
		downBtn.disabled = index === queue.length - 1;
		downBtn.setAttribute('aria-label', 'Move item down');
		downBtn.onclick = () => moveQueueItem(queue, index, 1, () => {
			showOverLimitDialog(recipients, queue, dialogPrefix.value, dialogSuffix.value, subject, maxLength);
		});

		li.appendChild(checkbox);
		li.appendChild(label);
		li.appendChild(upBtn);
		li.appendChild(downBtn);
		dialogQueue.appendChild(li);
	});

	setupDragAndDrop(dialogQueue, queue, (newQueue) => {
		showOverLimitDialog(recipients, queue, prefix, suffix, subject, maxLength);
	});
}

// Update dialog calculations (length and email count)
function updateDialog(dialogQueue, queue, recipients, subject, prefix, suffix, maxLength, stripTitles) {
	const selectedIndices = Array.from(dialogQueue.querySelectorAll('input:checked')).map(cb => parseInt(cb.dataset.index));
	const selectedQueue = selectedIndices.map(i => queue[i]);
	const useStripTitles = stripTitles.checked;

	const { url } = buildMailtoUrl(recipients, subject, prefix, suffix, selectedQueue, useStripTitles);
	const emailsNeeded = calculateEmailsNeeded(recipients, subject, prefix, suffix, selectedQueue, useStripTitles, maxLength);

	const limitInfo = document.getElementById('limitInfo');
	limitInfo.innerHTML = `The email exceeds the ${maxLength}-character limit.<br>` +
		`Current length: ${url.length} characters.<br>` +
		`${emailsNeeded.length} separate emails would be needed`;

	const emailCount = document.getElementById('emailCount');
	emailCount.textContent = `${emailsNeeded.length} email${emailsNeeded.length > 1 ? 's' : ''} will be sent.`;
}

// Set up event listeners for dialog inputs
function setupEventListeners(dialogQueue, queue, recipients, subject, maxLength, dialogPrefix, dialogSuffix, stripTitles) {
	const update = () => updateDialog(dialogQueue, queue, recipients, subject, dialogPrefix.value, dialogSuffix.value, maxLength, stripTitles);

	dialogPrefix.addEventListener('input', update);
	dialogSuffix.addEventListener('input', update);
	stripTitles.addEventListener('change', update);
	dialogQueue.addEventListener('change', update);

	return update;
}

// Handle send selected button
async function handleSendSelected(queue, selectedIndices, recipients, subject, dialogPrefix, dialogSuffix, stripTitles, maxLength, updateQueueList) {
	const selectedQueue = selectedIndices.map(i => queue[i]);
	let remainingQueue = [...queue];
	const currentPrefix = dialogPrefix.value;
	const currentSuffix = dialogSuffix.value;
	const useStripTitles = stripTitles.checked;

	chrome.storage.local.set({ prefix: currentPrefix, suffix: currentSuffix });

	const emails = calculateEmailsNeeded(recipients, subject, currentPrefix, currentSuffix, selectedQueue, useStripTitles, maxLength);
	const selectedItems = selectedQueue.map((item, idx) => ({ item, originalIndex: selectedIndices[idx] }));

	let sentCount = 0;
	for (let i = 0; i < emails.length; i++) {
		const emailQueue = emails[i];
		const { url } = buildMailtoUrl(recipients, `${subject}${emails.length > 1 ? ` (Part ${i + 1})` : ''}`, currentPrefix, currentSuffix, emailQueue, useStripTitles);
		const confirmed = await showConfirmDialog(`Send email ${i + 1} of ${emails.length}?`, i === emails.length - 1, emails.length - i - 1);

		if (confirmed === 'all') {
			for (let j = i; j < emails.length; j++) {
				const subQueue = emails[j];
				const subUrl = buildMailtoUrl(recipients, `${subject}${emails.length > 1 ? ` (Part ${j + 1})` : ''}`, currentPrefix, currentSuffix, subQueue, useStripTitles).url;

				setTimeout(() => {
					window.location.href = subUrl;
					const sentIndices = subQueue.map(sentItem => selectedItems.find(si => si.item === sentItem).originalIndex);
					remainingQueue = remainingQueue.filter((_, idx) => !sentIndices.includes(idx));
					chrome.storage.local.set({ queue: remainingQueue }, () => updateQueueList(remainingQueue));
				}, (j - i) * 2000);
				sentCount++;
			}
			break;
		} else if (confirmed) {
			window.location.href = url;
			sentCount++;
			const sentIndices = emailQueue.map(sentItem => selectedItems.find(si => si.item === sentItem).originalIndex);
			remainingQueue = remainingQueue.filter((_, idx) => !sentIndices.includes(idx));
			chrome.storage.local.set({ queue: remainingQueue }, () => updateQueueList(remainingQueue));
		} else {
			document.getElementById('status').textContent = `Stopped at email ${i + 1}`;
			document.getElementById('status').style.color = sentCount > 0 ? 'green' : 'red';
			break;
		}
	}

	document.getElementById('overLimitDialog').style.display = 'none';
	document.getElementById('status').textContent = `Opened ${sentCount} email${sentCount !== 1 ? 's' : ''}`;
	document.getElementById('status').style.color = sentCount > 0 ? 'green' : 'red';
}

// Handle save changes button
function handleSaveChanges(queue, selectedIndices, dialogPrefix, dialogSuffix, updateQueueList) {
	const remainingQueue = queue.filter((_, i) => !selectedIndices.includes(i));
	const currentPrefix = dialogPrefix.value;
	const currentSuffix = dialogSuffix.value;

	chrome.storage.local.set({ prefix: currentPrefix, suffix: currentSuffix, queue: remainingQueue }, () => {
		updateQueueList(remainingQueue);
		document.getElementById('overLimitDialog').style.display = 'none';
		document.getElementById('status').textContent = 'Changes saved';
		document.getElementById('status').style.color = 'green';
	});
}

// Main function to show the over-limit dialog
export function showOverLimitDialog(recipients, queue, prefix, suffix, subject, maxLength, initialBody, updateQueueList = () => {}) {
	const dialog = document.getElementById('overLimitDialog');
	const dialogQueue = document.getElementById('dialogQueue');
	const dialogPrefix = document.getElementById('dialogPrefix');
	const dialogSuffix = document.getElementById('dialogSuffix');
	const stripTitles = document.getElementById('stripTitles');

	initDialog(dialog, recipients, prefix, suffix, subject, maxLength);
	renderQueueList(queue, dialogQueue, recipients, subject, prefix, suffix, maxLength);

	const update = setupEventListeners(dialogQueue, queue, recipients, subject, maxLength, dialogPrefix, dialogSuffix, stripTitles);
	update(); // Initial update

	document.getElementById('sendSelected').onclick = async () => {
		const selectedIndices = Array.from(dialogQueue.querySelectorAll('input:checked')).map(cb => parseInt(cb.dataset.index));
		await handleSendSelected(queue, selectedIndices, recipients, subject, dialogPrefix, dialogSuffix, stripTitles, maxLength, updateQueueList);
	};

	document.getElementById('saveChanges').onclick = () => {
		const selectedIndices = Array.from(dialogQueue.querySelectorAll('input:checked')).map(cb => parseInt(cb.dataset.index));
		handleSaveChanges(queue, selectedIndices, dialogPrefix, dialogSuffix, updateQueueList);
	};

	document.getElementById('cancelDialog').onclick = () => {
		dialog.style.display = 'none';
	};
}


	// Drag-and-drop for dialog queue
////	setupDragAndDrop(dialogQueue, queue, (newQueue) => {
//		queue = newQueue;
//////		showOverLimitDialog(recipients, queue, dialogPrefix.value, dialogSuffix.value, subject, maxLength, initialBody);
////	});

	// Send selected
//	document.getElementById('sendSelected').onclick = async () => {
//		const currentRecipients = recipients;
//	};

/*eslint no-undef: "error"*/
/*eslint-env browser*/
/*eslint-env node*/
/*global document*/

import { buildMailtoUrl, isValidInputText, calculateEmailsNeeded, setStatus, setStorage } from '../utils.js';

// UI-related functions

export function setupTabs()
{
	// Tab switching logic
	const tabLinks = document.getElementById('tabLinks');
	const tabContentLinks = document.getElementById('tabContentLinks');
	const tabEmail = document.getElementById('tabEmail');
	const tabContentEmail = document.getElementById('tabContentEmail');

	function switchToEmailTab() {
		tabEmail.classList.add('active');
		tabLinks.classList.remove('active');
		tabContentLinks.style.display = 'none';
		tabContentLinks.setAttribute('aria-hidden', 'true');
		tabContentLinks.setAttribute('aria-selected', 'false');
		tabContentEmail.style.display = 'block';
		tabContentEmail.setAttribute('aria-hidden', 'false');
		tabContentEmail.setAttribute('aria-selected', 'true');
	}

	function switchToLinksTab() {
		tabLinks.classList.add('active');
		tabEmail.classList.remove('active');
		tabContentLinks.style.display = 'block';
		tabContentLinks.setAttribute('aria-hidden', 'false');
		tabContentLinks.setAttribute('aria-selected', 'true');
		tabContentEmail.style.display = 'none';
		tabContentEmail.setAttribute('aria-hidden', 'true');
		tabContentEmail.setAttribute('aria-selected', 'false');
	}

	tabEmail.addEventListener('click', switchToEmailTab);
	tabLinks.addEventListener('click', switchToLinksTab);

	// Add keyboard event listener for Ctrl+Tab
	document.addEventListener('keydown', (e) => {
		if (e.ctrlKey && e.key === 'Tab') {
			e.preventDefault();
			// Switch to the other tab
			if (tabEmail.classList.contains('active')) {
				switchToLinksTab();
			} else {
				switchToEmailTab();
			}
		}
	});
}

export async function updateStatus(localData, subject, prefix, suffix, stripTitles, maxLength)
{
	const doStripTitles = stripTitles.checked;

	// Validate prefix, suffix, and subject
	if (!isValidInputText(prefix.value)) {
		setStatus('Invalid characters in "Text Before Links".', 'red');
		return;
	}
	if (!isValidInputText(suffix.value)) {
		setStatus('Invalid characters in "Text After Links".', 'red');
		return;
	}
	if (subject.value.length === 0) {
		setStatus('You must include a "Subject".', 'red');
		return;
	}
	if (!isValidInputText(subject.value)) {
		setStatus('Invalid characters in "Subject".', 'red');
		return;
	}

	if (localData.prefix !== prefix.value || localData.suffix !== suffix.value ||
		localData.subject !== subject.value)
	{
		// Save new settings
		localData.prefix = prefix.value;
		localData.suffix = suffix.value;
		localData.subject = subject.value;
		await setStorage(localData);
	}

	const queue = localData.queue;
	const recipients = localData.currentRecips;

	if (recipients.length === 0 || queue.length === 0) return;

	const selectedQueue = [];
	const queueCheckboxes = document.querySelectorAll('#queueList input[type="checkbox"]');
	queueCheckboxes.forEach((cb) => {
		if (cb.checked) {
			const idx = parseInt(cb.dataset.index);
			selectedQueue.push(queue[idx]);
		}
	});

	if (selectedQueue.length === 0) return;

	const { url } = buildMailtoUrl(recipients, subject.value, prefix.value,
								suffix.value, selectedQueue, doStripTitles);
	if (url.length > maxLength) {
		const emailsNeeded = calculateEmailsNeeded(recipients, subject.value,
			prefix.value, suffix.value, selectedQueue, doStripTitles, maxLength).length;
		let stat_txt = `URL too long. ${emailsNeeded} emails will be needed.`;
		setStatus(stat_txt, 'red');
	}

	const rcpCnt = recipients.length;
	const rcpLth = buildMailtoUrl(recipients, "", "", "", [], false).url.length;
	const subLth = subject.value.length;
	const pfxLth = prefix.value.length;
	const sfxLth = suffix.value.length;
	const lnkCnt = selectedQueue.length;
	const totLth = selectedQueue.map(item => `${item.title}\n${item.url}`).join('\n\n').length;
	const urlLth = selectedQueue.map(item => item.url).join('\n\n').length;
	const ttlLth = doStripTitles ? 0 : totLth - urlLth;

	document.getElementById('numRecip').textContent = rcpCnt;
	document.getElementById('lnkCnt').textContent = lnkCnt;
	document.getElementById('recipLth').textContent = rcpLth;
	document.getElementById('subLth').textContent = subLth;
	document.getElementById('prfxLth').textContent = pfxLth;
	document.getElementById('sfxLth').textContent = sfxLth;
	document.getElementById('ttlLth').textContent = ttlLth;
	document.getElementById('urlLth').textContent = urlLth;
}

export function updateRecipientList(localData, recipients, defaultRecip, handleRecipientCheckboxChange, createHandleSetDefaultRecipient, createHandleRemoveRecipient, updateStatus)
{
	const list = document.getElementById('recipientList');
	list.innerHTML = '';

	let currentRecips = localData.currentRecips || (defaultRecip ? [defaultRecip] : []);
	recipients.forEach((recipient) => {
		const li = document.createElement('li');
		li.className = recipient === defaultRecip ? 'default_recip' : '';
		li.setAttribute('role', 'listitem');

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		if (recipient === defaultRecip && !currentRecips.includes(recipient))
			currentRecips.push(recipient);
		checkbox.checked = currentRecips.includes(recipient);
		if (checkbox.checked)
			checkbox.setAttribute('aria-label', `Deselect recipient: ${recipient}`);
		else
			checkbox.setAttribute('aria-label', `Select recipient: ${recipient}`);
		checkbox.addEventListener('change', handleRecipientCheckboxChange);

		const span = document.createElement('span');
		span.className = 'email_entry';
		span.textContent = recipient;

		const defaultBtn = document.createElement('button');
		defaultBtn.title = 'Set as default recipient';
		defaultBtn.className = 'default-btn';
		if (recipient === defaultRecip) {
			defaultBtn.disabled = true;
		} else {
			defaultBtn.addEventListener('click', createHandleSetDefaultRecipient(recipient));
		}

		const removeBtn = document.createElement('button');
		removeBtn.className = 'remove-btn';
		removeBtn.title = 'Remove this recipient';
		removeBtn.addEventListener('click', createHandleRemoveRecipient(recipient,
									recipients, defaultRecip, currentRecips));

		li.appendChild(checkbox);
		li.appendChild(span);
		li.appendChild(defaultBtn);
		li.appendChild(removeBtn);
		list.appendChild(li);
	});

	updateStatus();
}

export function updateQueueList(localData, queue, handleQueueChange, handleQueueClick, setupDragAndDrop, updateStatus)
{
	const list = document.getElementById('queueList');

	// Clear existing event listeners
	list.removeEventListener('change', handleQueueChange);
	list.removeEventListener('click', handleQueueClick);

	// Calculate save size
	const saveSize = queue.map(item => `${item.title}\n${item.url}`).join('\n\n').length -
		queue.map(item => item.url).join('\n\n').length;
	document.getElementById('titleStripSaves').textContent = saveSize;

	// Get current DOM items
	const currentItems = Array.from(list.children);
//	const currentIndices = currentItems.map(li => parseInt(li.dataset.index));
	const newIndices = queue.map((_, i) => i);

	// Remove items not in new queue
	currentItems.forEach(li => {
		const index = parseInt(li.dataset.index);
		if (!newIndices.includes(index)) {
			li.remove();
		}
	});

	// Update or add items
	queue.forEach((item, index) => {
		let li = currentItems.find(li => parseInt(li.dataset.index) === index);
		if (!li) {
			// Create new item
			li = document.createElement('li');
			li.draggable = true;
			li.dataset.index = index;
			li.setAttribute('role', 'listitem');
			li.className = 'queue_item';

			const que_prfx = document.createElement('span');
			que_prfx.className = 'queue_prefix';

			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.dataset.index = index;
			que_prfx.append(checkbox);
			que_prfx.append(document.createElement('br'));
			const lengthSpan = document.createElement('span');
			que_prfx.append(lengthSpan);

			const content = document.createElement('span');
			content.className = 'queue_entry';

			const upBtn = document.createElement('button');
			upBtn.className = 'up-btn';
			upBtn.setAttribute('aria-label', 'Move item up');

			const downBtn = document.createElement('button');
			downBtn.className = 'dn-btn';
			downBtn.setAttribute('aria-label', 'Move item down');

			const removeBtn = document.createElement('button');
			removeBtn.className = 'remove-btn';

			li.appendChild(que_prfx);
			li.appendChild(content);
			li.appendChild(upBtn);
			li.appendChild(downBtn);
			li.appendChild(removeBtn);
			list.appendChild(li);
		}

		// Update existing or new item
		const checkbox = li.querySelector('input[type="checkbox"]');
		const currentQueue = localData.currentQueue || [];
		checkbox.checked = Array.isArray(currentQueue) ? currentQueue.includes(index) : true;
		checkbox.setAttribute('aria-label', checkbox.checked ? `Deselect queue item: ${item.title}` : `Select queue item: ${item.title}`);
		li.querySelector('span.queue_prefix span').innerText = `(${encodeURIComponent(`${item.title}\n${item.url}`).length})`;
		const queueEntry = li.querySelector('span.queue_entry');
		queueEntry.textContent = '';
		const titleSpan = document.createElement('span');
		titleSpan.textContent = item.title;
		queueEntry.appendChild(titleSpan);
		const br = document.createElement('br');
		queueEntry.appendChild(br);
		const urlSpan = document.createElement('span');
		urlSpan.textContent = item.url;
		queueEntry.appendChild(urlSpan);

		li.querySelector('.up-btn').disabled = index === 0;
		li.querySelector('.dn-btn').disabled = index === queue.length - 1;
	});

	// Reorder items to match queue
	queue.forEach((_, index) => {
		const li = list.querySelector(`li[data-index="${index}"]`);
		if (li && list.children[index] !== li) {
			list.insertBefore(li, list.children[index]);
		}
	});

	// Delegate event listeners
	list.addEventListener('change', handleQueueChange);
	list.addEventListener('click', handleQueueClick);

	// Setup drag-and-drop
	setupDragAndDrop(list, queue, updateQueueList);
	updateStatus();
}

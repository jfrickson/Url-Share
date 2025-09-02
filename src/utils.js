/*eslint no-undef: "error"*/
/*eslint-env browser*/
/*eslint-env node*/
/*global chrome, console, clearTimeout, setTimeout, document*/

export function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

export function createNotification(title, message, iconUrl = 'assets/icon48.png')
{
	chrome.notifications.create({ type: 'basic', iconUrl, title, message });
}

export async function calcMsgboxPos(sz, pos)
{
	let w = sz.w || 0;
	const h = sz.y || 0;
	const py = pos.screenY || 0;
	const px = pos.screenX || 0;
	const ph = pos.height || 0;
	if (px === 0)
		w = 0;

	const l = px - w;
	const t = py + ph - h;

	return { left: l, top: t };
}

export function getStorageKeys(keys)
{
	return new Promise((resolve) => {
		chrome.storage.local.get(keys, resolve);
	});
}

export function setStorage(data, onError = null, notify = setStatus)
{
	return new Promise((resolve, reject) => {
		try {
			chrome.storage.local.set(data, () => {
				if (chrome.runtime.lastError) {
					const error = new Error(`Storage set failed: ${chrome.runtime.lastError.message}`);
					if (notify) notify('Failed to save data', 'red');
					console.error(error);
					if (onError) onError(error);
					reject(error);
					return;
				}
				resolve();
			});
		} catch (e) {
			if (notify) notify('Failed to save data', 'red');
			console.error(`Storage set failed: ${e.message}`);
			if (onError) onError(e);
			reject(e);
		}
	});
}

export function isValidInputText(input, maxLength = 200)
{
	if (typeof input !== 'string') return false
	const trimmedInput = input.trim();
	if (trimmedInput.length > maxLength) return false;
	// Disallow HTML tags, scripts, and control characters
	const validPattern = /^[a-zA-Z0-9\s.,!?&'":;+-]*$/;
	return validPattern.test(trimmedInput);
}

export function isValidEmail(email) {
	return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/i.test(email);
}

export function debounce(fn, ms)
{
	let timeout;
	return (...args) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => fn(...args), ms);
	};
}

let statusTimeout = null;
export function setStatus(message, color)
{
	const status = document.getElementById('status');
	if (statusTimeout) {
		clearTimeout(statusTimeout);
		statusTimeout = null;
	}
	if (message) {
		statusTimeout = setTimeout(() => {
			status.textContent = '';
			status.style.color = '';
		}, 5000);
	}
	if (status.textContent === message && status.style.color === color) return;
	status.textContent = message;
	status.style.color = color;
}

export async function moveQueueItem(lr_name, queue, index, direction, callback)
{
	const newIndex = index + direction;
	if (newIndex < 0 || newIndex >= queue.length) return;
	const newQueue = [...queue];
	[newQueue[index], newQueue[newIndex]] = [newQueue[newIndex], newQueue[index]];
	const liveRegion = document.getElementById(lr_name);
	liveRegion.textContent = `Item "${queue[index].title}" moved up`;
	await setStorage({ queue: newQueue }, (error) => {
		console.error('Failed to move queue item:', error);
	});
	callback(newQueue);
}

export function buildMailtoUrl(recipients, subject, prefix, suffix, queue, stripTitles)
{
	const currentRecipients = recipients;
	const links = queue.map(item => stripTitles ? item.url :
							`${item.title}\n${item.url}`).join('\n\n');
	const body = `${prefix}\n\n${links}\n\n${suffix}`.trim();
	const encodedSubject = encodeURIComponent(subject);
	const encodedBody = encodeURIComponent(body);
	const recipientList = currentRecipients.join(',');
	const url = `mailto:${recipientList}?subject=${encodedSubject}&body=${encodedBody}`;
	return { url, body };
}

// Helper: Calculate emails needed
export function calculateEmailsNeeded(recipients, subject, prefix, suffix, queue, stripTitles, maxLength)
{
	const emails = [];
	let currentQueue = [];
	let currentLength = 0;

	// Base length (recipients, subject, prefix, suffix)
	const base = buildMailtoUrl(recipients, subject, prefix, suffix, [], stripTitles).url.length;

	queue.forEach((item) => {
		const linkText = stripTitles ? item.url : `${item.title}\n${item.url}`;
		// Add 4 for "\n\n" separator, unless it's the first item
		const linkLength = encodeURIComponent(linkText).length + (currentQueue.length ? 4 : 0);

		if (base + currentLength + linkLength <= maxLength) {
			currentQueue.push(item);
			currentLength += linkLength;
		} else {
			if (currentQueue.length) {
				emails.push({
					url: buildMailtoUrl(recipients, subject, prefix, suffix, currentQueue, stripTitles).url,
					items: [...currentQueue]
				});
			}
			currentQueue = [item];
			currentLength = linkLength;
		}
	});

	// Add the final batch if it has items
	if (currentQueue.length) {
		emails.push({
			url: buildMailtoUrl(recipients, subject, prefix, suffix, currentQueue, stripTitles).url,
			items: [...currentQueue]
		});
	}

	return emails;
}

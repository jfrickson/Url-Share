export function buildMailtoUrl(recipients, subject, prefix, suffix, queue, stripTitles) {
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

export function getStorageKeys(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, resolve);
    });
}

export function createNotification(title, message, iconUrl = 'icon48.png') {
    chrome.notifications.create({ type: 'basic', iconUrl, title, message });
}

export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/*eslint no-undef: "error"*/
/*eslint-env browser*/
/*eslint-env node*/
/*global chrome*/

import { buildMailtoUrl, getStorageKeys } from '../utils.js';

// Badge management

export function fetchAndUpdateBadge()
{
	getStorageKeys(['queue', 'recipients', 'prefix', 'suffix',
					'maxLength', 'subject']).then(updateBadge);
}

export function updateBadge(data)
{
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
	const { url } = buildMailtoUrl(recipients, subject, prefix,
									suffix, queue, false);

	const color = url.length > maxLength ? '#dc3545' : '#ffc107';
	chrome.action.setBadgeText({ text: queue.length.toString() });
	chrome.action.setBadgeBackgroundColor({ color });
}

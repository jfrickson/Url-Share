/*eslint no-undef: "error"*/
/*eslint-env browser*/
/*eslint-env node*/
/*global chrome, document, window*/

import { getStorageKeys, debounce} from './utils.js';
import { setupTabs, updateStatus, updateRecipientList, updateQueueList } from './popup/ui.js';
import { handleWindowLoad, handleAddRecipient, handleAddToQueue, handleClearQueue,
		handleSendEmail, handleRecipientCheckboxChange, createHandleSetDefaultRecipient,
		createHandleRemoveRecipient, handleQueueChange, handleQueueClick }
		from './popup/handlers.js';
import { setupDragAndDrop } from './popup/drag-drop.js';

// Global variables
let localData = {};
let curTab = null;

const subject = document.getElementById('subject');
const prefix = document.getElementById('prefix');
const suffix = document.getElementById('suffix');
const addToQueue = document.getElementById('addToQueue');
const stripTitles = document.getElementById('stripTitles');
const recipientInput = document.getElementById('recipientInput');
const maxLength = 2000;

const debouncedUpdateStatus = debounce(() => updateStatus(localData, subject, prefix, suffix, stripTitles, maxLength), 300); // 300ms delay
const debouncedUpdateQueueList = debounce((queue) => updateQueueList(localData, queue,
	(e) => handleQueueChange(e, localData, debouncedUpdateStatus),
	(e) => handleQueueClick(e, localData, debouncedUpdateQueueList, debouncedUpdateStatus),
	setupDragAndDrop, debouncedUpdateStatus), 300); // 300ms delay


// Load saved data
document.addEventListener('DOMContentLoaded', async () => {

	localData = await getStorageKeys(['prefix', 'suffix', 'subject', 'queue',
				'currentQueue', 'recipients', 'defaultRecip', 'currentRecips']);

	// Set defaults for undefined values
	localData.prefix = localData.prefix || '';
	localData.suffix = localData.suffix || '';
	localData.subject = localData.subject || 'Shared Links';
	localData.queue = localData.queue || [];
	localData.currentQueue = Array.isArray(localData.currentQueue) ?
		localData.currentQueue : localData.queue.map((_, i) => i);
	localData.recipients = localData.recipients || [];
	localData.defaultRecip = localData.defaultRecip || '';
	localData.currentRecips = localData.currentRecips ||
			(localData.defaultRecip ? [localData.defaultRecip] : []);

	subject.value = localData.subject;
	const wrappedUpdateRecipientList = (recipients, defaultRecip) =>
		updateRecipientList(localData, recipients, defaultRecip,
			(e) => handleRecipientCheckboxChange(e, localData, debouncedUpdateStatus),
			(recipient) => createHandleSetDefaultRecipient(recipient, localData, wrappedUpdateRecipientList, debouncedUpdateStatus),
			(recipient) => createHandleRemoveRecipient(recipient, localData, wrappedUpdateRecipientList, recipientInput, debouncedUpdateStatus),
			debouncedUpdateStatus);

	wrappedUpdateRecipientList(localData.recipients, localData.defaultRecip);
	debouncedUpdateQueueList(localData.queue);
	prefix.value = localData.prefix || '';
	suffix.value = localData.suffix || '';

	// Get current page
	chrome.tabs.query({ active: true, currentWindow: true }, handleTabQuery);

	setupTabs();
	setupListeners();
});

function handleTabQuery(tabs)
{
	curTab = tabs[0];
	const url = curTab.url;
	const title = curTab.title;
	if (title)
		document.getElementById('currentPage').textContent = `${title}`;
	else
		document.getElementById('currentPage').textContent = `${url}`;
	if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('ftp://'))
		addToQueue.disabled = true;
	stripTitles.addEventListener('change', () => updateStatus(localData, subject, prefix, suffix, stripTitles, maxLength));
	prefix.addEventListener('input', debouncedUpdateStatus);
	suffix.addEventListener('input', debouncedUpdateStatus);
	subject.addEventListener('input', debouncedUpdateStatus);
	updateStatus(localData, subject, prefix, suffix, stripTitles, maxLength);
}

function setupListeners()
{
	window.addEventListener('load', handleWindowLoad);

	// Add recipient to saved list
	document.getElementById('addRecipient').addEventListener('click', () =>
		handleAddRecipient(localData, recipientInput,
			(recipients, defaultRecip) => updateRecipientList(localData, recipients, defaultRecip,
				(e) => handleRecipientCheckboxChange(e, localData, debouncedUpdateStatus),
				(recipient) => createHandleSetDefaultRecipient(recipient, localData,
					(recipients, defaultRecip) => updateRecipientList(localData, recipients, defaultRecip,
						(e) => handleRecipientCheckboxChange(e, localData, debouncedUpdateStatus),
						(recipient) => createHandleSetDefaultRecipient(recipient, localData,
							(recipients, defaultRecip) => updateRecipientList(localData, recipients, defaultRecip,
								(e) => handleRecipientCheckboxChange(e, localData, debouncedUpdateStatus),
								(recipient) => createHandleSetDefaultRecipient(recipient, localData, () => {}, debouncedUpdateStatus),
								(recipient) => createHandleRemoveRecipient(recipient, localData, () => {}, recipientInput, debouncedUpdateStatus),
								debouncedUpdateStatus),
							debouncedUpdateStatus),
						(recipient) => createHandleRemoveRecipient(recipient, localData,
							(recipients, defaultRecip) => updateRecipientList(localData, recipients, defaultRecip,
								(e) => handleRecipientCheckboxChange(e, localData, debouncedUpdateStatus),
								(recipient) => createHandleSetDefaultRecipient(recipient, localData, () => {}, debouncedUpdateStatus),
								(recipient) => createHandleRemoveRecipient(recipient, localData, () => {}, recipientInput, debouncedUpdateStatus),
								debouncedUpdateStatus),
							recipientInput, debouncedUpdateStatus),
						debouncedUpdateStatus),
					debouncedUpdateStatus),
				(recipient) => createHandleRemoveRecipient(recipient, localData,
					(recipients, defaultRecip) => updateRecipientList(localData, recipients, defaultRecip,
						(e) => handleRecipientCheckboxChange(e, localData, debouncedUpdateStatus),
						(recipient) => createHandleSetDefaultRecipient(recipient, localData, () => {}, debouncedUpdateStatus),
						(recipient) => createHandleRemoveRecipient(recipient, localData, () => {}, recipientInput, debouncedUpdateStatus),
						debouncedUpdateStatus),
					recipientInput, debouncedUpdateStatus),
				debouncedUpdateStatus)));

	// Add current page to queue
	addToQueue.addEventListener('click', () =>
		handleAddToQueue(localData, curTab, debouncedUpdateQueueList, () => updateStatus(localData, subject, prefix, suffix, stripTitles, maxLength)));

	// Clear queue
	document.getElementById('clearQueue').addEventListener('click', () =>
		handleClearQueue(localData, debouncedUpdateQueueList, () => updateStatus(localData, subject, prefix, suffix, stripTitles, maxLength)));

	// Send email
	document.getElementById('sendEmail').addEventListener('click', () =>
		handleSendEmail(localData, prefix, suffix, subject, maxLength, debouncedUpdateQueueList));
}

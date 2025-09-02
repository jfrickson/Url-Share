/*eslint no-undef: "error"*/
/*eslint-env browser*/
/*eslint-env node*/
/*global chrome, console*/

// Context menu management

export function createContextMenus()
{
	chrome.contextMenus.create({
		id: 'page-send-now',
		title: 'Send now',
		contexts: ['page'],
		visible: true
	});
	chrome.contextMenus.create({
		id: 'page-add-to-queue',
		title: 'Add to queue',
		contexts: ['page'],
		visible: true

	});
	chrome.contextMenus.create({
		id: 'link-send-now',
		title: 'Send now',
		contexts: ['link'],
		visible: true

	});
	chrome.contextMenus.create({
		id: 'link-add-to-queue',
		title: 'Add to queue',
		contexts: ['link'],
		visible: true

	});
}

// Function to update context menu items based on URL protocol
export function updateContextMenus(url)
{
	const isValidProtocol = (url && (
		url.startsWith('http://') ||
		url.startsWith('https://') ||
		url.startsWith('ftp://'))
	);

	// List of context menu item IDs
	const menuIds = [
		'page-send-now',
		'page-add-to-queue',
		'link-send-now',
		'link-add-to-queue'
	];

	if (typeof isValidProtocol !== "boolean")
		return;
	menuIds.forEach((id) => {
		chrome.contextMenus.update(id, {
			visible: isValidProtocol,
		}, () => {
			// Handle potential errors silently
			if (chrome.runtime.lastError) {
				console.warn(`Error updating context menu ${id}:`,
							chrome.runtime.lastError.message);
			}
		});
	});
}

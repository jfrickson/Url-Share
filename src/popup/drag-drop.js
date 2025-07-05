/*eslint no-undef: "error"*/
/*eslint-env browser*/
/*eslint-env node*/

import { setStorage } from '../utils.js';

// Drag and drop functionality

export function setupDragAndDrop(container, queue, onUpdate)
{
	container.addEventListener('dragstart', handleDragStart);
	container.addEventListener('dragend', handleDragEnd);
	container.addEventListener('dragover', handleDragOver);
	container.addEventListener('drop', createHandleDrop(container, queue, onUpdate));
}

function handleDragStart(e)
{
	if (e.target.tagName === 'LI') {
		e.target.classList.add('dragging');
		e.dataTransfer.setData('text/plain', e.target.dataset.index);
	}
}

function handleDragEnd(e)
{
	if (e.target.tagName === 'LI') {
		e.target.classList.remove('dragging');
	}
}

function handleDragOver(e)
{
	e.preventDefault();
	const container = e.currentTarget;
	const dragging = container.querySelector('.dragging');
	const afterElement = getDragAfterElement(container, e.clientY);
	if (afterElement == null) {
		container.appendChild(dragging);
	} else {
		container.insertBefore(dragging, afterElement);
	}
}

function createHandleDrop(container, queue, onUpdate)
{
	return async (e) => {
		e.preventDefault();
//		const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
		const newOrder = Array.from(container.children).map(li => parseInt(li.dataset.index));
		const newQueue = newOrder.map(i => queue[i]);
		await setStorage({ queue: newQueue });
		onUpdate(newQueue);
	};
}

function getDragAfterElement(container, y)
{
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

/*eslint no-undef: "error"*/
/*eslint-env browser*/
/*eslint-env node*/
/*global chrome, document, window, URLSearchParams*/


import { isValidEmail, setStatus, sleep } from './utils.js';

let savedPendingAction; // Store pendingAction locally
let type_arg;

document.addEventListener('DOMContentLoaded', () => {
	// Retrieve and clear pendingAction at startup
	chrome.storage.local.get(['pendingAction'], (result) => {
		if (result.pendingAction) {
			savedPendingAction = result.pendingAction; // Save locally
			chrome.storage.local.remove('pendingAction');
		}

		const queryString = window.location.search;
		const parms = new URLSearchParams(queryString);
		type_arg = parms.get('t');

		run(parms);
	});
});

function run(parms)
{
	if (!parms) {
		window.close();
		return;
	}

	const subj = document.getElementById('subject');
	const icon = document.getElementById('icon');
	const b1_txt = parms.get('b1') || null;
	const b2_txt = parms.get('b2') || null;
	let b3_txt = parms.get('b3') || null;
	let subj_arg = parms.get('subj');

	if (!b1_txt && !b2_txt && !b3_txt)
		b3_txt = "OK";

	if (b1_txt) {
		const button1 = document.getElementById('button1');
		button1.classList.remove('hidden');
		button1.textContent = b1_txt;
	}
	if (b2_txt) {
		const button2 = document.getElementById('button2');
		button2.classList.remove('hidden');
		button2.textContent = b2_txt;
	}
	if (b3_txt) {
		const button3 = document.getElementById('button3');
		button3.classList.remove('hidden');
		button3.textContent = b3_txt;
	}

	document.getElementById('buttonBar')
		.addEventListener('click', (event) => {
			const btn = event.target;
			onButtonClick(btn);
		});

	switch (type_arg) {
		case 'e':
			icon.src = 'assets/info.png';
			icon.alt = 'Information icon';
			email_addr();
			break;

		case 'inf':
			icon.src = 'assets/info.png';
			icon.alt = 'Information icon';
			break;

		case 'qry':
			icon.src = 'assets/query.png';
			icon.alt = 'Query icon';
			break;

		case 'wrn':
			icon.src = 'assets/warn.png';
			icon.alt = 'Warning icon';
			subj_arg = `Warning: ${subj_arg}`;
			subj.className = 'subj_warn';
			break;

		case 'err':
			icon.src = 'assets/error.png';
			icon.alt = 'Error icon';
			subj_arg = `ERROR: ${subj_arg}`;
			subj.className = 'subj_error';
			break;

		default:
			window.close();
			return;
	}

	subj.textContent = subj_arg;
	document.getElementById('message').innerHTML = parms.get('msg') || '';
}

function email_addr()
{
	const inpt = document.getElementById('userInput');
	inpt.placeholder = "ex. user@some_domain.com";
	inpt.classList.remove('hidden');
	inpt.focus();

	document.getElementById('message')
		.textContent = "An email address is required. After entering " +
			"one here, it will become the default for 'Send Now' actions. " +
			"The default recipient can be changed in the main extension " +
			"window by clicking on the icon in the browser toolbar."
}

//async
function onButtonClick(btn)
{
//	let x = 1; while(x--) await sleep(1000);

	if (btn.localName !== "button")
		return;

	let msg_type = "btnclick";
	const userInput = document.getElementById('userInput').value;

	if (type_arg === 'e') {
		if (btn.textContent === "OK" && !isValidEmail(userInput)) {
			setStatus('Invalid email address', 'red');
			return;
		}
		msg_type = "userInput";
	}

	chrome.runtime.sendMessage({
		type: msg_type,
		data: userInput,
		button: btn.textContent,
		pendingAction: savedPendingAction
	});

	window.close();
}

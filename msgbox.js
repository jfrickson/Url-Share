let savedPendingAction = null; // Store pendingAction locally
let subj = null;
let msg = null;
let inpt = null;
let submit = null;
let cancel = null;
let stat = null;

function init()
{
	subj = document.getElementById('subject');
	msg = document.getElementById('message');
	inpt = document.getElementById('userInput');
	submit = document.getElementById('submit');
	cancel = document.getElementById('cancel');
	stat = document.getElementById('status');

	const queryString = window.location.search;
	return new URLSearchParams(queryString);
}

function run(parms)
{
	const cancel = document.getElementById('cancel');

	if (!parms) {
		window.close();
		return;
	}

	cancel.addEventListener('click', () => {
		window.close();
	});

	if (parms) {
		const type_arg = parms.get('t');
		switch (type_arg) {
			case 'e':
				email_addr(parms);
				break;

			case 'inf':
				information(parms);
				break;

			case 'wrn':
				warning(parms);
				break;

			case 'err':
				error(parms);
				break;

			default:
				window.close();
		}
	}
}

function email_addr(parms)
{
	subj.textContent = "Recipient Email Address"
	msg.textContent = "An email address is required. After entering " +
			"one here, it will become the default for 'Send Now' actions. " +
			"The default recipient can be changed in the main extension " +
			"window by clicking on the icon in the browser toolbar."
	inpt.placeholder = "ex. user@some_domain.com";

	submit.addEventListener('click', () => {
		const userInput = document.getElementById('userInput').value;

		if (!userInput.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
			stat.textContent = 'Invalid email address';
			stat.style.color = 'red';
			return;
		}


		chrome.runtime.sendMessage({
			type: 'userInput',
			data: userInput,
			pendingAction: savedPendingAction
		});
		window.close();
	});
}

function information(parms)
{
	const subj_arg = parms.get('subj');
	infobox(parms, subj_arg);
}

function warning(parms)
{
	const subj_arg = `Warning: ${parms.get('subj')}`;
	subj.className = 'subj_warn';
	infobox(parms, subj_arg);
}

function error(parms)
{
	const subj_arg = `ERROR: ${parms.get('subj')}`;
	subj.className = 'subj_error';
	infobox(parms, subj_arg);
}

function infobox(parms, subj_txt)
{
	const msg_arg = parms.get('msg');
	subj.textContent = subj_txt;
	msg.textContent = msg_arg;
	inpt.className = 'hidden';
	submit.className = 'hidden';
	cancel.textContent = "OK";
}

document.addEventListener('DOMContentLoaded', () => {
	// Retrieve and clear pendingAction at startup
	chrome.storage.local.get(['pendingAction'], (result) => {
		if (result.pendingAction) {
			savedPendingAction = result.pendingAction; // Save locally
			chrome.storage.local.remove('pendingAction');
		}

		const parms = init();
		if (parms) run(parms);
	});
});

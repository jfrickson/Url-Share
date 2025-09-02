/*global module*/

module.exports = {
	env: {
		browser: true,
		webextensions: true,
		es2021: true,
		node: true
	},
	extends: [
		'eslint:recommended'
	],
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module'
	},
	globals: {
		chrome: 'readonly',
		document: 'readonly',
		window: 'readonly',
		console: 'readonly'
	},
	rules: {
		// Add any custom rules here
		'no-unused-vars': 'warn',
		'no-console': 'off',
		'no-undef': 'error'
	}
};

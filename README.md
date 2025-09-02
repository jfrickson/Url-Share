# URL-Share With Queue

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/b2c9a17c465546b1a90db60ed39cf7dd)](https://app.codacy.com/gh/jfrickson/Url-Share?utm_source=github.com&utm_medium=referral&utm_content=jfrickson/Url-Share&utm_campaign=Badge_Grade)

A powerful browser extension for sharing web pages and links via email with advanced queuing and organization features.

## 🚀 Key Features

### Email Integration
- **Local `mailto:` handler** - Completely private, uses your default email client
- **No external servers** - All processing happens locally on your machine
- **Smart email splitting** - Automatically splits large link collections into multiple emails when URL length limits are exceeded

### Link Management
- **Queue system** - Collect multiple URLs before sending them all at once
- **Drag & drop reordering** - Organize links in your preferred order
- **Title stripping** - Option to remove page titles to save space
- **URL validation** - Only HTTP/HTTPS/FTP URLs are accepted

### Recipient Management
- **Persistent recipient list** - Save frequently used email addresses
- **Default recipient** - Set a primary recipient for quick "Send Now" actions
- **Multiple recipients** - Send to multiple people simultaneously

### User Interface
- **Tabbed interface** - Separate tabs for email details and queued links
- **Real-time status** - Live updates on email size and recipient count
- **Accessibility features** - Screen reader support and keyboard navigation
- **Visual feedback** - Clear status indicators and validation messages

## 📋 How to Use

### Basic Usage
1. **Install the extension** and pin it to your toolbar
2. **Add recipients** by entering email addresses in the popup
3. **Queue links** by clicking the extension icon or using context menus
4. **Compose email** when ready to send all queued links

### Context Menu Actions
- **Right-click on any page** → "Send now" or "Add to queue"
- **Right-click on any link** → "Send now" or "Add to queue"

### Keyboard Shortcuts
- `Alt+Shift+E` - Open extension popup
- `Ctrl+Shift+Q` (`Cmd+Shift+Q` on Mac) - Queue current page
- `Ctrl+Shift+E` (`Cmd+Shift+E` on Mac) - Send current page immediately

### Advanced Features
- **Customizable text** - Add prefix and suffix text to your emails
- **Subject line control** - Customize email subject lines
- **Link reordering** - Use drag & drop or up/down buttons
- **Size optimization** - Strip titles when approaching URL length limits

## 🛠️ Installation

### From Source
1. Clone this repository
2. Run `make` to build the extension package
3. Load the generated `.crx` file in your browser

### Manual Installation
1. Open Chrome/Edge extensions page (`chrome://extensions/`)
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `src` folder

## 🎯 Use Cases

- **Research sharing** - Send multiple research links to colleagues
- **Content curation** - Share curated lists with teams or friends
- **Project collaboration** - Distribute relevant resources for projects
- **News sharing** - Send multiple news articles in one organized email
- **Educational content** - Share learning resources with students

## 🔧 Technical Details

- **Manifest V3** compatible
- **Modern ES6+ JavaScript** with module system
- **Responsive design** with accessibility features
- **Chrome Storage API** for persistent data
- **Chrome Notifications API** for user feedback

## 📁 Project Structure

```
src/
├── manifest.json          # Extension manifest
├── popup.html            # Main popup interface
├── popup.js             # Popup logic and initialization
├── background.js        # Service worker and background tasks
├── utils.js            # Shared utility functions
├── styles.css          # Main stylesheet
├── msgbox.html/js/css  # Modal dialog system
├── assets/             # Icons and images
├── popup/              # Popup-specific modules
│   ├── ui.js          # UI management
│   ├── handlers.js    # Event handlers
│   └── drag-drop.js   # Drag & drop functionality
└── background/         # Background script modules
    ├── actions.js     # Send/queue actions
    ├── context-menu.js # Context menu setup
    └── hotkeys.js     # Keyboard shortcuts
```

## 🔒 Privacy & Security

- **No data collection** - All data stays on your device
- **Local storage only** - Uses browser's local storage API
- **No network requests** - Extension works entirely offline
- **Open source** - Full source code available for inspection

## 📄 License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 🐛 Troubleshooting

### Common Issues
- **"Invalid URL" error** - Only HTTP/HTTPS/FTP URLs are supported
- **Email too long** - Enable "Strip URL Titles" or send fewer links per email
- **Context menu not appearing** - Ensure the extension is enabled and permissions are granted

### Support
If you encounter issues, please check the browser console for error messages and create an issue in this repository.

# ShopBoard

A Chrome extension for saving products you're thinking about buying. Group them into folders and see the item count and total cost of each folder at a glance.

## Features

- Organize saved products into folders
- Store a name, price, quantity, link, and notes for each item
- Auto-fill the name and price from the product page you're on (works best on Amazon and Walmart, and on most other stores)
- See running totals for each folder
- Everything is stored locally in your browser. Nothing is sent to a server.

## Installation

ShopBoard isn't on the Chrome Web Store yet, so you load it manually. It takes about a minute.

1. **Download the code**
   - Click the green **Code** button at the top of this page → **Download ZIP**, then unzip it, **or**
   - Clone it: `git clone <this-repo-url>`
2. **Open the extensions page.** Go to `chrome://extensions` in Chrome.
3. **Turn on Developer mode** with the toggle in the top-right corner.
4. **Load the extension.** Click **Load unpacked** and select the **`dist`** folder inside the project. (Pick `dist`, not the project folder itself.)
5. **Pin it to your toolbar.** Click the puzzle-piece icon next to the address bar, then click the pin next to **ShopBoard**.

This also works in other Chromium browsers such as Edge, Brave, and Arc. Use their extensions page instead (for example `edge://extensions`).

## How to use

### Create a folder

1. Click the ShopBoard icon in your toolbar.
2. Click **Add Folder**, type a name (like "Desk Setup"), and click **Create**.

### Save a product

1. Go to a product page in any store.
2. Open ShopBoard and click the folder you want to save to.
3. Click **+ New Item**. The name, price, and link are filled in from the page automatically.
4. Check the details, set the quantity, add notes if you want, and click **Save**.

You can also create a new folder from the **Folder** dropdown on the item form.

### View, edit, or delete items

- Click a folder to see its items, item count, and total cost.
- Click an item to edit it. **Open** goes to the product page and **Delete** removes the item.
- Click **Delete** on a folder card to remove the folder. This also deletes every item in it.

## Troubleshooting

- **Auto-fill didn't work.** Refresh the product page and try again. Tabs that were already open when you installed the extension need a reload first. Some sites don't expose a price in a readable way. If that happens, type it in yourself.
- **The extension disappeared or stopped working.** Go back to `chrome://extensions` and make sure ShopBoard is turned on. Don't move or delete the `dist` folder, because Chrome loads the extension from there.
- **Updating to a newer version.** Download or `git pull` the latest code, then click the reload icon (↻) on the ShopBoard card in `chrome://extensions`.

## Project structure

```
dist/
├── manifest.json   # Extension config (Manifest V3)
├── popup.html      # Popup UI
├── popup.css       # Popup styles
├── popup.js        # Popup logic (the file Chrome runs)
├── popup.ts        # Typed version of the popup logic
└── scraper.js      # Content script that reads product name and price from pages
```

There's no build step. Chrome runs `popup.js` directly, so any changes to `popup.ts` have to be copied into `popup.js` by hand.

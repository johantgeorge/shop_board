const STORAGE_KEY = "shopboard-popup-state";

const defaultState = {
  folders: [
    { id: "f-1", name: "Kitchen Refresh" },
    { id: "f-2", name: "Office Setup" }
  ],
  items: [
    {
      id: "i-1",
      folderId: "f-1",
      title: "Stainless Steel Pan",
      price: 49.99,
      quantity: 1,
      url: "https://www.amazon.com/",
      notes: "Compare with the 12-inch version before ordering.",
      createdAt: Date.now() - 1000 * 60 * 60 * 18
    },
    {
      id: "i-2",
      folderId: "f-2",
      title: "Desk Lamp",
      price: 32.5,
      quantity: 2,
      url: "https://www.amazon.com/",
      notes: "Warm light only.",
      createdAt: Date.now() - 1000 * 60 * 60 * 8
    }
  ]
};

const state = {
  data: loadState(),
  currentView: "SAVE_FORM",
  selectedFolderId: null,
  selectedItemId: null,
  pendingDeleteFolderId: null,
  scrapedDraft: null,
  scrapeMessage: ""
};

const folderView = document.getElementById("folder-view");
const itemsView = document.getElementById("items-view");
const formView = document.getElementById("form-view");
const backButtons = document.querySelectorAll("[data-back-button]");
const folderList = document.getElementById("folder-list");
const itemList = document.getElementById("item-list");
const itemsFolderTitle = document.getElementById("items-folder-title");
const formTitle = document.getElementById("form-title");
const itemCount = document.getElementById("item-count");
const itemTotal = document.getElementById("item-total");
const itemForm = document.getElementById("item-form");
const openUrlLink = document.getElementById("open-url-link");
const itemFolderSelect = document.getElementById("item-folder");
const homeButton = document.getElementById("home-button");
const scrapeStatus = document.getElementById("scrape-status");
const folderCreateForm = document.getElementById("folder-create-form");
const folderNameInput = document.getElementById("folder-name-input");
const cancelFolderButton = document.getElementById("cancel-folder-button");

const fields = {
  title: document.getElementById("item-name"),
  price: document.getElementById("item-price"),
  quantity: document.getElementById("item-quantity"),
  url: document.getElementById("item-url"),
  notes: document.getElementById("item-notes")
};

bootstrap();

function bootstrap() {
  state.selectedFolderId = state.data.folders[0]?.id ?? null;
  render();
  bindEvents();
  prefillFromActiveTab();
}

function bindEvents() {
  backButtons.forEach((button) => button.addEventListener("click", handleBack));
  document.getElementById("add-folder-button")?.addEventListener("click", handleShowAddFolder);
  document.getElementById("new-item-button")?.addEventListener("click", handleNewItem);
  document.getElementById("delete-item-button")?.addEventListener("click", handleDeleteItem);
  homeButton.addEventListener("click", handleHome);
  fields.price.addEventListener("blur", normalizePriceInput);
  fields.price.addEventListener("change", normalizePriceInput);
  itemForm.addEventListener("submit", handleSaveItem);
  folderCreateForm.addEventListener("submit", handleAddFolder);
  cancelFolderButton.addEventListener("click", handleCancelAddFolder);
}

function render() {
  renderView();
  renderFolders();
  renderFolderOptions();
  renderItems();
  renderForm();
}

function renderView() {
  folderView.classList.toggle("is-hidden", state.currentView !== "FOLDER_LIST");
  itemsView.classList.toggle("is-hidden", state.currentView !== "ITEM_LIST");
  formView.classList.toggle("is-hidden", state.currentView !== "SAVE_FORM");
}

function renderFolders() {
  folderList.innerHTML = "";

  if (!state.data.folders.length) {
    folderList.appendChild(createEmptyState("No folders yet. Add one to get started."));
    return;
  }

  const template = document.getElementById("folder-card-template");

  state.data.folders.forEach((folder) => {
    const button = template.content.firstElementChild.cloneNode(true);
    const count = state.data.items.filter((item) => item.folderId === folder.id).length;
    const total = state.data.items
      .filter((item) => item.folderId === folder.id)
      .reduce((sum, item) => sum + item.price * item.quantity, 0);

    button.querySelector(".card-title").textContent = folder.name;
    button.querySelector(".card-price").textContent = formatCurrency(total);
    button.querySelector(".card-meta").textContent = `${count} item${count === 1 ? "" : "s"}`;
    button.querySelector(".folder-delete-button").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleRequestDeleteFolder(folder.id);
    });
    button.addEventListener("click", () => openFolder(folder.id));
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openFolder(folder.id);
      }
    });

    if (state.pendingDeleteFolderId === folder.id) {
      button.appendChild(createFolderDeleteConfirm(folder));
    }

    folderList.appendChild(button);
  });
}

function renderFolderOptions() {
  itemFolderSelect.innerHTML = "";

  state.data.folders.forEach((folder) => {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.name;
    itemFolderSelect.appendChild(option);
  });
}

function renderItems() {
  const selectedFolder = getSelectedFolder();
  const items = getItemsForSelectedFolder();
  itemList.innerHTML = "";
  itemsFolderTitle.textContent = selectedFolder?.name ?? "Selected Folder";
  itemCount.textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;
  itemTotal.textContent = `Total: ${formatCurrency(items.reduce((sum, item) => sum + item.price * item.quantity, 0))}`;

  if (!items.length) {
    itemList.appendChild(createEmptyState("This folder is empty. Add a new item to start saving products."));
    return;
  }

  const template = document.getElementById("item-card-template");

  items.forEach((item) => {
    const button = template.content.firstElementChild.cloneNode(true);
    button.querySelector(".card-title").textContent = item.title || "Untitled item";
    button.querySelector(".card-price").textContent = formatCurrency(item.price);
    button.querySelector(".card-meta").textContent = `Qty ${item.quantity}`;
    button.classList.toggle("is-active", item.id === state.selectedItemId && state.currentView === "SAVE_FORM");
    button.addEventListener("click", () => openItem(item.id));
    itemList.appendChild(button);
  });
}

function renderForm() {
  const item = getSelectedItem();
  const isNewItem = !item;

  formTitle.textContent = isNewItem ? "New Item" : item.title || "Untitled item";

  const payload = item ?? {
    folderId: state.selectedFolderId ?? state.data.folders[0]?.id ?? "",
    title: state.scrapedDraft?.title ?? "",
    price: state.scrapedDraft?.price ?? 0,
    quantity: 1,
    url: state.scrapedDraft?.url ?? "",
    notes: ""
  };

  fields.title.value = payload.title ?? "";
  fields.price.value = payload.price || payload.price === 0 ? Number(payload.price).toFixed(2) : "";
  fields.quantity.value = String(payload.quantity ?? 1);
  fields.url.value = payload.url ?? "";
  fields.notes.value = payload.notes ?? "";
  itemFolderSelect.value = payload.folderId ?? "";

  document.getElementById("delete-item-button").disabled = isNewItem;
  openUrlLink.href = payload.url || "#";
  openUrlLink.setAttribute("aria-disabled", payload.url ? "false" : "true");
  scrapeStatus.textContent = state.scrapeMessage;
  scrapeStatus.classList.toggle("is-hidden", !state.scrapeMessage || !isNewItem);
}

function openFolder(folderId) {
  state.selectedFolderId = folderId;
  state.selectedItemId = null;
  state.currentView = "ITEM_LIST";
  render();
}

function openItem(itemId) {
  state.selectedItemId = itemId;
  state.currentView = "SAVE_FORM";
  render();
}

function handleBack() {
  if (state.currentView === "SAVE_FORM") {
    state.currentView = state.selectedItemId ? "ITEM_LIST" : "FOLDER_LIST";
  } else {
    state.currentView = "FOLDER_LIST";
  }

  render();
}

function handleHome() {
  state.currentView = "FOLDER_LIST";
  render();
}

function normalizePriceInput() {
  if (!fields.price.value.trim()) {
    return;
  }

  const parsed = Number(fields.price.value);
  if (Number.isNaN(parsed)) {
    return;
  }

  fields.price.value = parsed.toFixed(2);
}

async function prefillFromActiveTab() {
  if (state.selectedItemId) {
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      state.scrapeMessage = "Could not detect product details from this page.";
      render();
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: "SHOPBOARD_SCRAPE_PRODUCT" });
    applyScrapedDraft(response?.product ?? null);
  } catch {
    state.scrapeMessage = "Could not detect product details from this page.";
    render();
  }
}

function applyScrapedDraft(product) {
  if (state.selectedItemId || !product) {
    state.scrapeMessage = "Could not detect product details from this page.";
    render();
    return;
  }

  state.scrapedDraft = {
    title: product.title || "",
    price: Number(product.price || 0),
    url: product.url || "",
    store: product.store || "",
    source: product.source || "fallback"
  };

  if (product.source === "fallback") {
    state.scrapeMessage = "Only basic page details were found. Review before saving.";
  } else {
    state.scrapeMessage = "";
  }

  render();
}

function handleShowAddFolder() {
  state.pendingDeleteFolderId = null;
  folderCreateForm.classList.remove("is-hidden");
  folderNameInput.focus();
}

function handleCancelAddFolder() {
  folderCreateForm.reset();
  folderCreateForm.classList.add("is-hidden");
}

function handleAddFolder(event) {
  event.preventDefault();
  const name = folderNameInput.value;
  if (!name?.trim()) {
    folderNameInput.focus();
    return;
  }

  const folder = { id: crypto.randomUUID(), name: name.trim() };
  state.data.folders.push(folder);
  state.selectedFolderId = folder.id;
  saveState();
  folderCreateForm.reset();
  folderCreateForm.classList.add("is-hidden");
  openFolder(folder.id);
}

function handleRequestDeleteFolder(folderId) {
  state.pendingDeleteFolderId = folderId;
  folderCreateForm.classList.add("is-hidden");
  render();
}

function handleCancelDeleteFolder() {
  state.pendingDeleteFolderId = null;
  render();
}

function handleConfirmDeleteFolder() {
  const folder = state.data.folders.find((entry) => entry.id === state.pendingDeleteFolderId);
  if (!folder) {
    state.pendingDeleteFolderId = null;
    render();
    return;
  }

  state.data.folders = state.data.folders.filter((entry) => entry.id !== folder.id);
  state.data.items = state.data.items.filter((entry) => entry.folderId !== folder.id);
  state.selectedFolderId = state.data.folders[0]?.id ?? null;
  state.selectedItemId = null;
  state.currentView = "FOLDER_LIST";
  state.pendingDeleteFolderId = null;
  saveState();
  render();
}

function createFolderDeleteConfirm(folder) {
  const wrapper = document.createElement("div");
  wrapper.className = "folder-card-confirm";
  wrapper.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  wrapper.addEventListener("keydown", (event) => {
    event.stopPropagation();
  });

  const message = document.createElement("p");
  message.className = "confirm-text";
  message.textContent = `Delete folder "${folder.name}" and its items?`;

  const actions = document.createElement("div");
  actions.className = "confirm-actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "secondary-button compact-button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", handleCancelDeleteFolder);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger-button compact-button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", handleConfirmDeleteFolder);

  actions.append(cancelButton, deleteButton);
  wrapper.append(message, actions);
  return wrapper;
}

function handleNewItem() {
  if (!state.data.folders.length) {
    window.alert("Create a folder first.");
    return;
  }

  state.selectedItemId = null;
  state.currentView = "SAVE_FORM";
  render();
}

function handleSaveItem(event) {
  event.preventDefault();

  const formData = new FormData(itemForm);
  const nextItem = {
    id: state.selectedItemId ?? crypto.randomUUID(),
    folderId: String(formData.get("folderId") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    price: Number(formData.get("price") ?? 0),
    quantity: Math.max(1, Number(formData.get("quantity") ?? 1)),
    url: String(formData.get("url") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    store: getSelectedItem()?.store ?? state.scrapedDraft?.store ?? "",
    source: getSelectedItem()?.source ?? state.scrapedDraft?.source ?? "",
    createdAt: getSelectedItem()?.createdAt ?? Date.now()
  };

  const existingIndex = state.data.items.findIndex((item) => item.id === nextItem.id);
  if (existingIndex >= 0) {
    state.data.items[existingIndex] = nextItem;
  } else {
    state.data.items.unshift(nextItem);
  }

  state.selectedFolderId = nextItem.folderId;
  state.selectedItemId = nextItem.id;
  state.currentView = "ITEM_LIST";
  state.scrapeMessage = "";
  saveState();
  render();
}

function handleDeleteItem() {
  const item = getSelectedItem();
  if (!item) {
    return;
  }

  const confirmed = window.confirm(`Delete "${item.title || "this item"}"?`);
  if (!confirmed) {
    return;
  }

  state.data.items = state.data.items.filter((entry) => entry.id !== item.id);
  state.selectedItemId = null;
  state.currentView = "ITEM_LIST";
  saveState();
  render();
}

function getSelectedFolder() {
  return state.data.folders.find((folder) => folder.id === state.selectedFolderId) ?? null;
}

function getSelectedItem() {
  return state.data.items.find((item) => item.id === state.selectedItemId) ?? null;
}

function getItemsForSelectedFolder() {
  return state.data.items.filter((item) => item.folderId === state.selectedFolderId);
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return structuredClone(defaultState);
  }

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed.folders) || !Array.isArray(parsed.items)) {
      return structuredClone(defaultState);
    }
    return parsed;
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function createEmptyState(message) {
  const element = document.createElement("div");
  element.className = "empty-state";
  element.textContent = message;
  return element;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

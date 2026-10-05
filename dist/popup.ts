type ViewName = "FOLDER_LIST" | "ITEM_LIST" | "SAVE_FORM";

type Folder = {
  id: string;
  name: string;
};

type Item = {
  id: string;
  folderId: string;
  title: string;
  price: number;
  quantity: number;
  url: string;
  notes: string;
  store?: string;
  source?: "json-ld" | "meta" | "dom" | "fallback";
  createdAt: number;
};

type ScrapedProduct = {
  title: string;
  price: number;
  url: string;
  store: string;
  source: "json-ld" | "meta" | "dom" | "fallback";
};

type PersistedState = {
  folders: Folder[];
  items: Item[];
};

const STORAGE_KEY = "shopboard-popup-state";

const defaultState: PersistedState = {
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
  currentView: "SAVE_FORM" as ViewName,
  selectedFolderId: null as string | null,
  selectedItemId: null as string | null,
  pendingDeleteFolderId: null as string | null,
  isFolderPickerOpen: false,
  scrapedDraft: null as ScrapedProduct | null,
  scrapeMessage: ""
};

const folderView = document.getElementById("folder-view") as HTMLElement;
const itemsView = document.getElementById("items-view") as HTMLElement;
const formView = document.getElementById("form-view") as HTMLElement;
const backButtons = document.querySelectorAll("[data-back-button]");
const folderList = document.getElementById("folder-list") as HTMLElement;
const itemList = document.getElementById("item-list") as HTMLElement;
const itemsFolderTitle = document.getElementById("items-folder-title") as HTMLElement;
const formTitle = document.getElementById("form-title") as HTMLElement;
const itemCount = document.getElementById("item-count") as HTMLElement;
const itemTotal = document.getElementById("item-total") as HTMLElement;
const itemForm = document.getElementById("item-form") as HTMLFormElement;
const openUrlLink = document.getElementById("open-url-link") as HTMLAnchorElement;
const itemFolderSelect = document.getElementById("item-folder") as HTMLInputElement;
const folderPicker = document.getElementById("folder-picker") as HTMLElement;
const folderPickerButton = document.getElementById("folder-picker-button") as HTMLButtonElement;
const folderPickerLabel = document.getElementById("folder-picker-label") as HTMLElement;
const folderPickerMenu = document.getElementById("folder-picker-menu") as HTMLElement;
const folderFieldMeta = document.getElementById("folder-field-meta") as HTMLElement;
const homeButton = document.getElementById("home-button") as HTMLButtonElement;
const scrapeStatus = document.getElementById("scrape-status") as HTMLElement;
const folderCreateForm = document.getElementById("folder-create-form") as HTMLFormElement;
const folderNameInput = document.getElementById("folder-name-input") as HTMLInputElement;
const cancelFolderButton = document.getElementById("cancel-folder-button") as HTMLButtonElement;

const fields = {
  title: document.getElementById("item-name") as HTMLInputElement,
  price: document.getElementById("item-price") as HTMLInputElement,
  quantity: document.getElementById("item-quantity") as HTMLInputElement,
  url: document.getElementById("item-url") as HTMLInputElement,
  notes: document.getElementById("item-notes") as HTMLTextAreaElement
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
  folderPickerButton.addEventListener("click", handleToggleFolderPicker);
  itemForm.addEventListener("submit", handleSaveItem);
  folderCreateForm.addEventListener("submit", handleAddFolder);
  cancelFolderButton.addEventListener("click", handleCancelAddFolder);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);
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

  const template = document.getElementById("folder-card-template") as HTMLTemplateElement;

  state.data.folders.forEach((folder) => {
    const button = template.content.firstElementChild?.cloneNode(true) as HTMLDivElement;
    const count = state.data.items.filter((item) => item.folderId === folder.id).length;
    const total = state.data.items
      .filter((item) => item.folderId === folder.id)
      .reduce((sum, item) => sum + item.price * item.quantity, 0);

    (button.querySelector(".card-title") as HTMLElement).textContent = folder.name;
    (button.querySelector(".card-price") as HTMLElement).textContent = formatCurrency(total);
    (button.querySelector(".card-meta") as HTMLElement).textContent = `${count} item${count === 1 ? "" : "s"}`;
    (button.querySelector(".folder-delete-button") as HTMLButtonElement).addEventListener("click", (event) => {
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
  folderPickerMenu.innerHTML = "";

  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.className = "folder-picker-create";
  createButton.textContent = "+ New Folder";
  createButton.addEventListener("click", handleCreateFolderFromPicker);
  folderPickerMenu.appendChild(createButton);

  state.data.folders.forEach((folder) => {
    const option = document.createElement("button");
    const count = state.data.items.filter((item) => item.folderId === folder.id).length;
    const total = state.data.items
      .filter((item) => item.folderId === folder.id)
      .reduce((sum, item) => sum + item.price * item.quantity, 0);

    option.type = "button";
    option.className = "folder-picker-option";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", itemFolderSelect.value === folder.id ? "true" : "false");
    option.classList.toggle("is-selected", itemFolderSelect.value === folder.id);
    option.addEventListener("click", () => handleSelectFolderOption(folder.id));

    const title = document.createElement("span");
    title.className = "folder-picker-option-title";
    title.textContent = folder.name;

    const meta = document.createElement("span");
    meta.className = "folder-picker-option-meta";
    meta.textContent = `${count} item${count === 1 ? "" : "s"} · ${formatCurrency(total)}`;

    option.append(title, meta);
    folderPickerMenu.appendChild(option);
  });

  folderPickerMenu.classList.toggle("is-hidden", !state.isFolderPickerOpen);
  folderPickerButton.classList.toggle("is-open", state.isFolderPickerOpen);
  folderPickerButton.setAttribute("aria-expanded", state.isFolderPickerOpen ? "true" : "false");
  renderSelectedFolderMeta();
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

  const template = document.getElementById("item-card-template") as HTMLTemplateElement;

  items.forEach((item) => {
    const button = template.content.firstElementChild?.cloneNode(true) as HTMLButtonElement;
    (button.querySelector(".card-title") as HTMLElement).textContent = item.title || "Untitled item";
    (button.querySelector(".card-price") as HTMLElement).textContent = formatCurrency(item.price);
    (button.querySelector(".card-meta") as HTMLElement).textContent = `Qty ${item.quantity}`;
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
  state.isFolderPickerOpen = false;
  renderSelectedFolderMeta();

  (document.getElementById("delete-item-button") as HTMLButtonElement).disabled = isNewItem;
  openUrlLink.href = payload.url || "#";
  openUrlLink.setAttribute("aria-disabled", payload.url ? "false" : "true");
  scrapeStatus.textContent = state.scrapeMessage;
  scrapeStatus.classList.toggle("is-hidden", !state.scrapeMessage || !isNewItem);
}

function openFolder(folderId: string) {
  state.selectedFolderId = folderId;
  state.selectedItemId = null;
  state.currentView = "ITEM_LIST";
  render();
}

function openItem(itemId: string) {
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
    applyScrapedDraft((response as { product?: ScrapedProduct } | undefined)?.product ?? null);
  } catch {
    state.scrapeMessage = "Could not detect product details from this page.";
    render();
  }
}

function applyScrapedDraft(product: ScrapedProduct | null) {
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

function handleAddFolder(event: Event) {
  event.preventDefault();
  const name = folderNameInput.value;
  if (!name?.trim()) {
    folderNameInput.focus();
    return;
  }

  const folder: Folder = { id: crypto.randomUUID(), name: name.trim() };
  state.data.folders.push(folder);
  state.selectedFolderId = folder.id;
  saveState();
  folderCreateForm.reset();
  folderCreateForm.classList.add("is-hidden");
  openFolder(folder.id);
}

function handleToggleFolderPicker() {
  state.isFolderPickerOpen = !state.isFolderPickerOpen;
  renderFolderOptions();
}

function handleSelectFolderOption(folderId: string) {
  itemFolderSelect.value = folderId;
  state.isFolderPickerOpen = false;
  renderFolderOptions();
}

function handleCreateFolderFromPicker() {
  const name = window.prompt("New folder name");
  if (!name?.trim()) {
    return;
  }

  const folder: Folder = { id: crypto.randomUUID(), name: name.trim() };
  state.data.folders.push(folder);
  state.selectedFolderId = folder.id;
  itemFolderSelect.value = folder.id;
  state.isFolderPickerOpen = false;
  saveState();
  render();
}

function handleRequestDeleteFolder(folderId: string) {
  state.pendingDeleteFolderId = folderId;
  folderCreateForm.classList.add("is-hidden");
  render();
}

function handleCancelDeleteFolder() {
  state.pendingDeleteFolderId = null;
  render();
}

function handleDocumentClick(event: MouseEvent) {
  if (!state.isFolderPickerOpen) {
    return;
  }

  if (folderPicker.contains(event.target as Node)) {
    return;
  }

  state.isFolderPickerOpen = false;
  renderFolderOptions();
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape" || !state.isFolderPickerOpen) {
    return;
  }

  state.isFolderPickerOpen = false;
  renderFolderOptions();
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

function renderSelectedFolderMeta() {
  const folderId = itemFolderSelect.value;
  const folder = state.data.folders.find((entry) => entry.id === folderId);

  if (!folder) {
    folderPickerLabel.textContent = "Select a folder";
    folderFieldMeta.textContent = "Choose where this item should be saved.";
    return;
  }

  const count = state.data.items.filter((item) => item.folderId === folder.id).length;
  const total = state.data.items
    .filter((item) => item.folderId === folder.id)
    .reduce((sum, item) => sum + item.price * item.quantity, 0);

  folderPickerLabel.textContent = folder.name;
  folderFieldMeta.textContent = `${folder.name} · ${count} item${count === 1 ? "" : "s"} · ${formatCurrency(total)}`;
}

function createFolderDeleteConfirm(folder: Folder) {
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

function handleSaveItem(event: Event) {
  event.preventDefault();

  const formData = new FormData(itemForm);
  const nextItem: Item = {
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

function getSelectedFolder(): Folder | null {
  return state.data.folders.find((folder) => folder.id === state.selectedFolderId) ?? null;
}

function getSelectedItem(): Item | null {
  return state.data.items.find((item) => item.id === state.selectedItemId) ?? null;
}

function getItemsForSelectedFolder(): Item[] {
  return state.data.items.filter((item) => item.folderId === state.selectedFolderId);
}

function loadState(): PersistedState {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return structuredClone(defaultState);
  }

  try {
    const parsed = JSON.parse(stored) as PersistedState;
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

function createEmptyState(message: string) {
  const element = document.createElement("div");
  element.className = "empty-state";
  element.textContent = message;
  return element;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

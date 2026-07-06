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
  imageUrl: string;
  notes: string;
  createdAt: number;
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
      imageUrl: "",
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
      imageUrl: "",
      notes: "Warm light only.",
      createdAt: Date.now() - 1000 * 60 * 60 * 8
    }
  ]
};

const state = {
  data: loadState(),
  currentView: "SAVE_FORM" as ViewName,
  selectedFolderId: null as string | null,
  selectedItemId: null as string | null
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
const itemFolderSelect = document.getElementById("item-folder") as HTMLSelectElement;
const homeButton = document.getElementById("home-button") as HTMLButtonElement;

const fields = {
  title: document.getElementById("item-name") as HTMLInputElement,
  price: document.getElementById("item-price") as HTMLInputElement,
  quantity: document.getElementById("item-quantity") as HTMLInputElement,
  url: document.getElementById("item-url") as HTMLInputElement,
  imageUrl: document.getElementById("item-image") as HTMLInputElement,
  notes: document.getElementById("item-notes") as HTMLTextAreaElement
};

bootstrap();

function bootstrap() {
  state.selectedFolderId = state.data.folders[0]?.id ?? null;
  render();
  bindEvents();
}

function bindEvents() {
  backButtons.forEach((button) => button.addEventListener("click", handleBack));
  document.getElementById("add-folder-button")?.addEventListener("click", handleAddFolder);
  document.getElementById("folder-menu-button")?.addEventListener("click", handleFolderMenu);
  document.getElementById("new-item-button")?.addEventListener("click", handleNewItem);
  document.getElementById("delete-item-button")?.addEventListener("click", handleDeleteItem);
  homeButton.addEventListener("click", handleHome);
  itemForm.addEventListener("submit", handleSaveItem);
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
    const button = template.content.firstElementChild?.cloneNode(true) as HTMLButtonElement;
    const count = state.data.items.filter((item) => item.folderId === folder.id).length;
    const total = state.data.items
      .filter((item) => item.folderId === folder.id)
      .reduce((sum, item) => sum + item.price * item.quantity, 0);

    (button.querySelector(".card-title") as HTMLElement).textContent = folder.name;
    (button.querySelector(".card-meta") as HTMLElement).textContent =
      `${count} item${count === 1 ? "" : "s"} • ${formatCurrency(total)}`;
    button.addEventListener("click", () => openFolder(folder.id));
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

  const template = document.getElementById("item-card-template") as HTMLTemplateElement;

  items.forEach((item) => {
    const button = template.content.firstElementChild?.cloneNode(true) as HTMLButtonElement;
    (button.querySelector(".card-title") as HTMLElement).textContent = item.title || "Untitled item";
    (button.querySelector(".card-meta") as HTMLElement).textContent =
      `${formatCurrency(item.price)} • Qty ${item.quantity}`;
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
    title: "",
    price: 0,
    quantity: 1,
    url: "",
    imageUrl: "",
    notes: ""
  };

  fields.title.value = payload.title ?? "";
  fields.price.value = payload.price ? String(payload.price) : "";
  fields.quantity.value = String(payload.quantity ?? 1);
  fields.url.value = payload.url ?? "";
  fields.imageUrl.value = payload.imageUrl ?? "";
  fields.notes.value = payload.notes ?? "";
  itemFolderSelect.value = payload.folderId ?? "";

  (document.getElementById("delete-item-button") as HTMLButtonElement).disabled = isNewItem;
  openUrlLink.href = payload.url || "#";
  openUrlLink.setAttribute("aria-disabled", payload.url ? "false" : "true");
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

function handleAddFolder() {
  const name = window.prompt("Folder name");
  if (!name?.trim()) {
    return;
  }

  const folder: Folder = { id: crypto.randomUUID(), name: name.trim() };
  state.data.folders.push(folder);
  state.selectedFolderId = folder.id;
  saveState();
  openFolder(folder.id);
}

function handleFolderMenu() {
  const folder = getSelectedFolder();
  if (!folder) {
    return;
  }

  const action = window.prompt(`Folder: ${folder.name}\nType "rename" or "delete".`, "rename");
  if (action === "rename") {
    const nextName = window.prompt("New folder name", folder.name);
    if (!nextName?.trim()) {
      return;
    }
    folder.name = nextName.trim();
    saveState();
    render();
    return;
  }

  if (action === "delete") {
    if (state.data.folders.length === 1) {
      window.alert("Keep at least one folder.");
      return;
    }

    const confirmed = window.confirm(`Delete folder "${folder.name}" and its items?`);
    if (!confirmed) {
      return;
    }

    state.data.folders = state.data.folders.filter((entry) => entry.id !== folder.id);
    state.data.items = state.data.items.filter((entry) => entry.folderId !== folder.id);
    state.selectedFolderId = state.data.folders[0]?.id ?? null;
    state.selectedItemId = null;
    state.currentView = "FOLDER_LIST";
    saveState();
    render();
  }
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
    imageUrl: String(formData.get("imageUrl") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
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
    currency: "USD"
  }).format(Number(value || 0));
}

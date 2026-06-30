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
  currentView: "FOLDER_LIST",
  selectedFolderId: null,
  selectedItemId: null,
  isEditing: false
};

const folderView = document.getElementById("folder-view");
const itemsView = document.getElementById("items-view");
const formView = document.getElementById("form-view");
const viewTitle = document.getElementById("view-title");
const backButton = document.getElementById("back-button");
const folderList = document.getElementById("folder-list");
const itemList = document.getElementById("item-list");
const itemsFolderTitle = document.getElementById("items-folder-title");
const formTitle = document.getElementById("form-title");
const itemCount = document.getElementById("item-count");
const itemTotal = document.getElementById("item-total");
const itemForm = document.getElementById("item-form");
const openUrlLink = document.getElementById("open-url-link");
const itemFolderSelect = document.getElementById("item-folder");
const editItemButton = document.getElementById("edit-item-button");

const fields = {
  title: document.getElementById("item-name"),
  price: document.getElementById("item-price"),
  quantity: document.getElementById("item-quantity"),
  url: document.getElementById("item-url"),
  imageUrl: document.getElementById("item-image"),
  notes: document.getElementById("item-notes")
};

bootstrap();

function bootstrap() {
  state.selectedFolderId = state.data.folders[0]?.id ?? null;
  render();
  bindEvents();
}

function bindEvents() {
  backButton.addEventListener("click", handleBack);
  document.getElementById("add-folder-button")?.addEventListener("click", handleAddFolder);
  document.getElementById("folder-menu-button")?.addEventListener("click", handleFolderMenu);
  document.getElementById("new-item-button")?.addEventListener("click", handleNewItem);
  document.getElementById("delete-item-button")?.addEventListener("click", handleDeleteItem);
  editItemButton.addEventListener("click", toggleEditMode);
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
  backButton.classList.toggle("is-hidden", state.currentView === "FOLDER_LIST");

  if (state.currentView === "FOLDER_LIST") {
    viewTitle.textContent = "Folders";
  } else if (state.currentView === "ITEM_LIST") {
    viewTitle.textContent = getSelectedFolder()?.name ?? "Items";
  } else {
    viewTitle.textContent = state.selectedItemId ? "Product" : "New Item";
  }
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
    button.querySelector(".card-meta").textContent =
      `${count} item${count === 1 ? "" : "s"} • ${formatCurrency(total)}`;
    button.classList.toggle("is-active", folder.id === state.selectedFolderId);
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

  const template = document.getElementById("item-card-template");

  items.forEach((item) => {
    const button = template.content.firstElementChild.cloneNode(true);
    button.querySelector(".card-title").textContent = item.title || "Untitled item";
    button.querySelector(".card-meta").textContent = `${formatCurrency(item.price)} • Qty ${item.quantity}`;
    button.classList.toggle("is-active", item.id === state.selectedItemId && state.currentView === "SAVE_FORM");
    button.addEventListener("click", () => openItem(item.id, false));
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

  const disabled = !state.isEditing;
  itemForm.querySelectorAll("input, select, textarea, button[type='submit']").forEach((element) => {
    element.disabled = disabled;
  });

  document.getElementById("delete-item-button").disabled = isNewItem;
  editItemButton.textContent = state.isEditing ? "Editing" : "Read Only";
  openUrlLink.href = payload.url || "#";
  openUrlLink.setAttribute("aria-disabled", payload.url ? "false" : "true");
}

function openFolder(folderId) {
  state.selectedFolderId = folderId;
  state.selectedItemId = null;
  state.currentView = "ITEM_LIST";
  state.isEditing = false;
  render();
}

function openItem(itemId, editing) {
  state.selectedItemId = itemId;
  state.currentView = "SAVE_FORM";
  state.isEditing = editing;
  render();
}

function handleBack() {
  if (state.currentView === "SAVE_FORM") {
    state.currentView = "ITEM_LIST";
    state.isEditing = false;
  } else {
    state.currentView = "FOLDER_LIST";
  }

  render();
}

function handleAddFolder() {
  const name = window.prompt("Folder name");
  if (!name?.trim()) {
    return;
  }

  const folder = { id: crypto.randomUUID(), name: name.trim() };
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
    state.isEditing = false;
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
  state.isEditing = true;
  render();
}

function toggleEditMode() {
  if (!state.selectedItemId) {
    state.isEditing = true;
    render();
    return;
  }

  state.isEditing = !state.isEditing;
  render();
}

function handleSaveItem(event) {
  event.preventDefault();

  if (!state.isEditing) {
    return;
  }

  const formData = new FormData(itemForm);
  const nextItem = {
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
  state.isEditing = false;
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
  state.isEditing = false;
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
    currency: "USD"
  }).format(Number(value || 0));
}

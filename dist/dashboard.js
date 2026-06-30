const STORAGE_KEY = "shopboard-dashboard-state";

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
  selectedFolderId: null,
  selectedItemId: null,
  editMode: false
};

const folderList = document.getElementById("folder-list");
const itemList = document.getElementById("item-list");
const itemPanelTitle = document.getElementById("item-panel-title");
const itemCount = document.getElementById("item-count");
const itemTotal = document.getElementById("item-total");
const detailTitle = document.getElementById("detail-title");
const itemForm = document.getElementById("item-form");
const openUrlLink = document.getElementById("open-url-link");
const itemFolderSelect = document.getElementById("item-folder");

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
  state.selectedFolderId = state.data.folders[0]?.id || null;
  const firstItem = getItemsForSelectedFolder()[0];
  state.selectedItemId = firstItem?.id || null;
  render();
  bindEvents();
}

function bindEvents() {
  document.getElementById("add-folder-button").addEventListener("click", handleAddFolder);
  document.getElementById("new-item-button").addEventListener("click", handleNewItem);
  document.getElementById("edit-item-button").addEventListener("click", () => setEditMode(true));
  document.getElementById("delete-item-button").addEventListener("click", handleDeleteItem);
  itemForm.addEventListener("submit", handleSaveItem);
}

function render() {
  renderFolders();
  renderFolderOptions();
  renderItems();
  renderDetail();
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
    const itemCountForFolder = state.data.items.filter((item) => item.folderId === folder.id).length;
    button.querySelector(".folder-name").textContent = folder.name;
    button.querySelector(".folder-meta").textContent = `${itemCountForFolder} item${itemCountForFolder === 1 ? "" : "s"}`;
    button.classList.toggle("is-active", folder.id === state.selectedFolderId);
    button.addEventListener("click", () => selectFolder(folder.id));
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openFolderActionPrompt(folder.id);
    });
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
  itemPanelTitle.textContent = selectedFolder ? selectedFolder.name : "No Folder Selected";
  itemCount.textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;
  itemTotal.textContent = `Total: ${formatCurrency(items.reduce((sum, item) => sum + item.price * item.quantity, 0))}`;

  if (!items.length) {
    itemList.appendChild(createEmptyState("This folder is empty. Add a new item to start saving products."));
    return;
  }

  const template = document.getElementById("item-card-template");

  items.forEach((item) => {
    const button = template.content.firstElementChild.cloneNode(true);
    button.querySelector(".item-card-title").textContent = item.title || "Untitled item";
    button.querySelector(".item-card-meta").textContent = `${formatCurrency(item.price)} • Qty ${item.quantity}`;
    button.classList.toggle("is-active", item.id === state.selectedItemId);
    button.addEventListener("click", () => {
      state.selectedItemId = item.id;
      state.editMode = false;
      render();
    });
    itemList.appendChild(button);
  });
}

function renderDetail() {
  const item = getSelectedItem();
  const hasItem = Boolean(item);
  detailTitle.textContent = hasItem ? item.title || "Untitled item" : "Choose an item";

  const payload = item || {
    title: "",
    price: "",
    quantity: 1,
    url: "",
    imageUrl: "",
    notes: "",
    folderId: state.selectedFolderId || state.data.folders[0]?.id || ""
  };

  fields.title.value = payload.title ?? "";
  fields.price.value = payload.price ?? "";
  fields.quantity.value = payload.quantity ?? 1;
  fields.url.value = payload.url ?? "";
  fields.imageUrl.value = payload.imageUrl ?? "";
  fields.notes.value = payload.notes ?? "";
  itemFolderSelect.value = payload.folderId ?? "";

  const disabled = !hasItem && !state.editMode;
  itemForm.querySelectorAll("input, select, textarea, button[type='submit']").forEach((element) => {
    if (element.id === "delete-item-button") {
      return;
    }
    element.disabled = disabled || !state.editMode;
  });

  document.getElementById("delete-item-button").disabled = !hasItem;
  openUrlLink.href = payload.url || "#";
  openUrlLink.setAttribute("aria-disabled", payload.url ? "false" : "true");
  openUrlLink.style.pointerEvents = payload.url ? "auto" : "none";
  openUrlLink.style.opacity = payload.url ? "1" : "0.45";
}

function selectFolder(folderId) {
  state.selectedFolderId = folderId;
  state.selectedItemId = getItemsForSelectedFolder()[0]?.id || null;
  state.editMode = false;
  render();
}

function handleAddFolder() {
  const name = window.prompt("Folder name");
  if (!name) {
    return;
  }

  const folder = { id: crypto.randomUUID(), name: name.trim() };
  state.data.folders.push(folder);
  state.selectedFolderId = folder.id;
  saveState();
  render();
}

function handleNewItem() {
  if (!state.data.folders.length) {
    window.alert("Create a folder first.");
    return;
  }

  state.selectedItemId = null;
  state.editMode = true;
  render();
}

function handleSaveItem(event) {
  event.preventDefault();
  if (!state.editMode) {
    return;
  }

  const formData = new FormData(itemForm);
  const nextItem = {
    id: state.selectedItemId || crypto.randomUUID(),
    folderId: formData.get("folderId"),
    title: String(formData.get("title") || "").trim(),
    price: Number(formData.get("price") || 0),
    quantity: Math.max(1, Number(formData.get("quantity") || 1)),
    url: String(formData.get("url") || "").trim(),
    imageUrl: String(formData.get("imageUrl") || "").trim(),
    notes: String(formData.get("notes") || "").trim(),
    createdAt: getSelectedItem()?.createdAt || Date.now()
  };

  const existingIndex = state.data.items.findIndex((item) => item.id === nextItem.id);
  if (existingIndex >= 0) {
    state.data.items[existingIndex] = nextItem;
  } else {
    state.data.items.unshift(nextItem);
  }

  state.selectedFolderId = nextItem.folderId;
  state.selectedItemId = nextItem.id;
  state.editMode = false;
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
  state.selectedItemId = getItemsForSelectedFolder().find((entry) => entry.id !== item.id)?.id || null;
  state.editMode = false;
  saveState();
  render();
}

function openFolderActionPrompt(folderId) {
  const folder = state.data.folders.find((entry) => entry.id === folderId);
  if (!folder) {
    return;
  }

  const action = window.prompt(
    `Folder: ${folder.name}\nType "rename", "delete", or "select".`,
    "select"
  );

  if (action === "rename") {
    const name = window.prompt("New folder name", folder.name);
    if (!name) {
      return;
    }
    folder.name = name.trim();
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
    state.selectedFolderId = state.data.folders[0]?.id || null;
    state.selectedItemId = getItemsForSelectedFolder()[0]?.id || null;
    state.editMode = false;
    saveState();
    render();
    return;
  }

  selectFolder(folder.id);
}

function setEditMode(nextValue) {
  if (!getSelectedItem() && !nextValue) {
    return;
  }
  state.editMode = nextValue;
  render();
}

function getSelectedFolder() {
  return state.data.folders.find((folder) => folder.id === state.selectedFolderId) || null;
}

function getSelectedItem() {
  return state.data.items.find((item) => item.id === state.selectedItemId) || null;
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

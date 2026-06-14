/* ============================================================
   GYRO STORE — Panel admin con login de Google (Firebase Auth)
   La tienda es pública; este panel exige cuenta autorizada.
   ============================================================ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  signInWithEmailAndPassword,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const API = '/api';
let CONFIG = { currency: 'C$', categories: [] };
let auth = null;
let currentPurchaseForEdit = null;
let currentUserInfo = null;
let allPurchases = [];

let excelFilters = {
  purchases: { lote: null, code: null, date: null, product: null },
  stock: { lote: null, code: null, product: null }
};
let currentFilterPopover = null; // { table, col, triggerBtn }


/* ---------- utilidades ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `${CONFIG.currency}${Number(n).toFixed(2)}`;
const $ = (s, c = document) => c.querySelector(s);

function parseCustomTimestamp(ts) {
  if (!ts) return null;
  if (ts === 'Fecha anterior') return null;
  if (ts instanceof Date) return ts;

  let d = new Date(ts);
  if (!isNaN(d.getTime())) return d;

  try {
    const parts = String(ts).split(',');
    if (parts.length >= 2) {
      const dateParts = parts[0].trim().split('/');
      if (dateParts.length === 3) {
        const day = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        const year = parseInt(dateParts[2]);

        let timeStr = parts[1].trim();
        timeStr = timeStr.replace(/\u202f/g, ' ');

        const isPM = /p\.\s*m\.|pm/i.test(timeStr);
        const isAM = /a\.\s*m\.|am/i.test(timeStr);

        const timeParts = timeStr.replace(/[^\d:]/g, '').split(':');
        if (timeParts.length >= 2) {
          let hours = parseInt(timeParts[0]);
          const minutes = parseInt(timeParts[1]);
          const seconds = timeParts[2] ? parseInt(timeParts[2]) : 0;

          if (isPM && hours < 12) hours += 12;
          if (isAM && hours === 12) hours = 0;

          const parsedDate = new Date(year, month, day, hours, minutes, seconds);
          if (!isNaN(parsedDate.getTime())) return parsedDate;
        }
      }
    }
  } catch { }
  return null;
}

function formatFriendlyDate(dateInput) {
  if (!dateInput) return 'Fecha anterior';
  const d = parseCustomTimestamp(dateInput);
  if (!d) return dateInput;
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day} de ${month} de ${year}, ${hours}:${minutes} ${ampm}`;
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const urlParams = new URLSearchParams(window.location.search);
  const isDevMode = urlParams.get('dev') === 'true' || localStorage.getItem('gyro_admin_dev_mode') === 'true';
  if (isDevMode) {
    headers.Authorization = 'Bearer dev-token';
  } else if (auth && auth.currentUser) {
    headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
  }
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => (t.hidden = true), 300); }, 2600);
}

/* ============================================================
   Productos
   ============================================================ */
async function loadProducts() {
  const products = await api('/products');
  $('#product-count').textContent = products.length;
  $('#products-tbody').innerHTML = products.map((p) => `
    <tr>
      <td>${esc(p.name)}</td>
      <td>${esc(p.category)}</td>
      <td>${money(p.price)}</td>
      <td class="row-actions">
        <button class="edit-btn" data-edit='${esc(JSON.stringify(p))}'>Editar</button>
        <button class="del-btn" data-del="${esc(p.id)}" data-name="${esc(p.name)}">Borrar</button>
      </td>
    </tr>`).join('');
  populateProductsDatalist(products);
}

function populateProductsDatalist(products) {
  const dl = $('#products-datalist');
  if (!dl) return;
  const names = Array.from(new Set(products.map(p => p.name).filter(Boolean)));
  dl.innerHTML = names.map(name => `<option value="${esc(name)}">`).join('');
}

function fillCategorySelect() {
  $('#p-category').innerHTML = CONFIG.categories
    .map((c) => `<option value="${esc(c.id)}">${c.icon} ${esc(c.name)}</option>`).join('');
}

function resetForm() {
  $('#product-form').reset();
  $('#p-id').value = '';
  $('#form-title').textContent = 'Nuevo producto';
  $('#cancel-edit').classList.add('hidden');
}

function startEdit(p) {
  $('#p-id').value = p.id;
  $('#p-name').value = p.name || '';
  $('#p-category').value = p.category || '';
  $('#p-price').value = p.price ?? '';
  $('#p-img').value = p.img || '';
  $('#p-desc').value = p.desc || '';
  $('#p-images').value = (p.images || []).join(', ');
  $('#p-variants').value = (p.variants || []).map((v) => v.name).join(', ');
  $('#p-specs').value = (p.specs || []).map((s) => `${s.label}: ${s.value}`).join('\n');
  $('#form-title').textContent = `Editar: ${p.name}`;
  $('#cancel-edit').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitProduct(e) {
  e.preventDefault();
  const id = $('#p-id').value;
  const images = $('#p-images').value.split(',').map((s) => s.trim()).filter(Boolean);
  const variants = $('#p-variants').value.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ name }));
  const specs = $('#p-specs').value.split('\n').map((line) => {
    const i = line.indexOf(':');
    if (i === -1) return null;
    const label = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    return label ? { label, value } : null;
  }).filter(Boolean);

  const payload = {
    name: $('#p-name').value.trim(),
    category: $('#p-category').value,
    price: Number($('#p-price').value),
    img: $('#p-img').value.trim(),
    desc: $('#p-desc').value.trim(),
    images, variants, specs,
  };
  try {
    if (id) {
      await api(`/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      toast('Producto actualizado.');
    } else {
      await api('/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      toast('Producto creado.');
    }
    resetForm();
    loadProducts();
  } catch (err) { toast(`Error: ${err.message}`); }
}

async function deleteProduct(id, name) {
  if (!confirm(`¿Borrar "${name}"? Esta acción no se puede deshacer.`)) return;
  try {
    await api(`/products/${id}`, { method: 'DELETE' });
    toast('Producto borrado.');
    loadProducts();
  } catch (err) { toast(`Error: ${err.message}`); }
}

/* ============================================================
   Pedidos
   ============================================================ */
async function loadOrders() {
  try {
    const orders = await api('/orders');
    $('#orders-tbody').innerHTML = orders.map((o) => {
      const items = o.lines.map((l) => `${esc(l.name)}${l.variant ? ` (${esc(l.variant)})` : ''} x${l.qty}`).join(', ');
      const date = o.createdAt && o.createdAt._seconds
        ? new Date(o.createdAt._seconds * 1000).toLocaleString('es-NI') : '—';
      const c = o.customer || {};
      const deliv = c.delivery === 'shipping' ? `🚚 ${esc(c.address || '')}` : '🏬 Retiro en tienda';
      const cliente = c.name
        ? `<strong>${esc(c.name)}</strong><br><small>${esc(c.phone || '')}</small><br><small class="muted-note">${deliv}</small>${c.note ? `<br><small class="muted-note">📝 ${esc(c.note)}</small>` : ''}`
        : '<span class="muted-note">—</span>';
      const statuses = ['pending', 'paid', 'delivered', 'cancelled'];
      const select = `<select class="status-pill status-${esc(o.status)}" data-order="${esc(o.id)}">
        ${statuses.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
      </select>`;
      return `<tr>
        <td>#${esc(o.id.slice(0, 6))}</td>
        <td>${cliente}</td>
        <td>${items}</td>
        <td><strong>${money(o.total)}</strong></td>
        <td>${select}</td>
        <td>${date}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" class="muted-note">Aún no hay pedidos.</td></tr>';
  } catch (err) { toast(`Error al cargar pedidos: ${err.message}`); }
}

async function updateOrderStatus(id, status) {
  try {
    await api(`/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    toast(`Pedido #${id.slice(0, 6)} → ${status}`);
    loadOrders();
  } catch (err) { toast(`Error: ${err.message}`); }
}

/* ============================================================
   Compras de China
   ============================================================ */
async function loadPurchases() {
  try {
    allPurchases = await api('/purchases');
    applyPurchasesFilters();
  } catch (err) { toast(`Error al cargar compras: ${err.message}`); }
}

function applyPurchasesFilters() {
  const filtered = allPurchases.filter((p) => {
    if (excelFilters.purchases.lote && !excelFilters.purchases.lote.has(String(p.lote || ''))) return false;
    if (excelFilters.purchases.code && !excelFilters.purchases.code.has(String(p.code || ''))) return false;
    if (excelFilters.purchases.date && !excelFilters.purchases.date.has(String(p.date || ''))) return false;
    if (excelFilters.purchases.product && !excelFilters.purchases.product.has(String(p.product || ''))) return false;
    return true;
  });

  $('#purchases-tbody').innerHTML = filtered.map((p) => {
    const date = p.date ? new Date(p.date + 'T00:00:00').toLocaleDateString('es-NI') : '—';
    const statusClass = p.status === 'Recibido' ? 'status-delivered' : p.status === 'En tránsito' ? 'status-paid' : 'status-pending';
    const preTotal = p.qty * p.cost;
    const impTotal = p.qty * p.tax;
    return `<tr class="clickable-row" data-purchase='${esc(JSON.stringify(p))}'>
      <td class="col-select"><input type="checkbox" class="purchase-select" data-id="${p.id}" /></td>
      <td><strong>${esc(p.lote)}</strong></td>
      <td><span class="muted-note">${esc(p.code || '—')}</span></td>
      <td>${date}</td>
      <td>${esc(p.product)}</td>
      <td>${p.qty}</td>
      <td>$${p.cost.toFixed(2)}</td>
      <td>$${p.tax.toFixed(4)}</td>
      <td><strong>$${p.unitCost.toFixed(4)}</strong></td>
      <td>$${preTotal.toFixed(2)}</td>
      <td>$${impTotal.toFixed(2)}</td>
      <td><strong style="color: var(--accent);">$${p.totalUsd.toFixed(2)}</strong></td>
      <td><span class="status-pill ${statusClass}">${esc(p.status)}</span></td>
    </tr>`;
  }).join('') || '<tr><td colspan="13" class="muted-note">No se encontraron compras con los filtros seleccionados.</td></tr>';

  const selectAll = $('#select-all-purchases');
  if (selectAll) selectAll.checked = false;
  updateBulkActionsBar();
}

async function loadStock() {
  try {
    const purchases = await api('/purchases');
    allPurchases = purchases;
    applyStockFilters();
  } catch (err) {
    toast(`Error al cargar stock: ${err.message}`);
  }
}

function applyStockFilters() {
  const received = allPurchases.filter(p => p.status === 'Recibido');
  const filtered = received.filter((p) => {
    if (excelFilters.stock.lote && !excelFilters.stock.lote.has(String(p.lote || ''))) return false;
    if (excelFilters.stock.code && !excelFilters.stock.code.has(String(p.code || ''))) return false;
    if (excelFilters.stock.product && !excelFilters.stock.product.has(String(p.product || ''))) return false;
    return true;
  });

  $('#stock-tbody').innerHTML = filtered.map((p) => {
    const unitCostVal = typeof p.unitCost === 'number' ? p.unitCost : 0;
    const totalUsdVal = typeof p.totalUsd === 'number' ? p.totalUsd : (p.qty * unitCostVal);

    return `<tr class="clickable-row" data-purchase='${esc(JSON.stringify(p))}'>
      <td><strong>${esc(p.lote)}</strong></td>
      <td><span class="muted-note">${esc(p.code || '—')}</span></td>
      <td>${esc(p.product)}</td>
      <td>${p.qty}</td>
      <td><strong>$${unitCostVal.toFixed(4)}</strong></td>
      <td><strong style="color: var(--accent);">$${totalUsdVal.toFixed(2)}</strong></td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" class="muted-note">No se encontraron productos en stock con los filtros seleccionados.</td></tr>';
}

function openExcelFilterPopover(table, col, btn) {
  if (currentFilterPopover && currentFilterPopover.table === table && currentFilterPopover.col === col) {
    closeExcelFilterPopover();
    return;
  }

  currentFilterPopover = { table, col, triggerBtn: btn };

  const searchInput = $('#popover-search');
  searchInput.value = '';

  let dataset = [];
  if (table === 'purchases') {
    dataset = allPurchases;
  } else if (table === 'stock') {
    dataset = allPurchases.filter(p => p.status === 'Recibido');
  }

  let valuesMap = new Map();
  dataset.forEach(p => {
    let rawVal = '';
    let displayVal = '';
    if (col === 'lote') {
      rawVal = p.lote || '';
      displayVal = rawVal;
    } else if (col === 'code') {
      rawVal = p.code || '';
      displayVal = rawVal;
    } else if (col === 'date') {
      rawVal = p.date || '';
      displayVal = p.date ? new Date(p.date + 'T00:00:00').toLocaleDateString('es-NI') : '—';
    } else if (col === 'product') {
      rawVal = p.product || '';
      displayVal = rawVal;
    }
    valuesMap.set(String(rawVal), displayVal || '—');
  });

  let uniquePairs = Array.from(valuesMap.entries());
  if (col === 'date') {
    uniquePairs.sort((a, b) => {
      const timeA = a[0] ? new Date(a[0]).getTime() : 0;
      const timeB = b[0] ? new Date(b[0]).getTime() : 0;
      return timeA - timeB;
    });
  } else {
    uniquePairs.sort((a, b) => a[1].localeCompare(b[1]));
  }

  const activeSet = excelFilters[table][col];
  const container = $('#popover-options');
  container.innerHTML = '';

  const isSelectAllChecked = !activeSet;
  const selectAllItem = document.createElement('div');
  selectAllItem.className = 'popover-option-item';
  selectAllItem.style.fontWeight = 'bold';
  selectAllItem.innerHTML = `
    <input type="checkbox" id="popover-select-all" ${isSelectAllChecked ? 'checked' : ''} />
    <label for="popover-select-all" style="cursor:pointer; flex: 1;">(Seleccionar todo)</label>
  `;
  container.appendChild(selectAllItem);

  uniquePairs.forEach(([rawVal, displayVal], idx) => {
    const optionId = `popover-opt-${idx}`;
    const isChecked = !activeSet || activeSet.has(rawVal);
    const item = document.createElement('div');
    item.className = 'popover-option-item';
    item.dataset.value = rawVal;
    item.innerHTML = `
      <input type="checkbox" class="popover-val-cb" id="${optionId}" data-value="${esc(rawVal)}" ${isChecked ? 'checked' : ''} />
      <label for="${optionId}" style="cursor:pointer; flex: 1;">${esc(displayVal)}</label>
    `;
    container.appendChild(item);
  });

  const selectAllCb = selectAllItem.querySelector('input');
  selectAllCb.addEventListener('change', () => {
    const visibleCheckboxes = Array.from(container.querySelectorAll('.popover-val-cb')).filter(cb => {
      return cb.closest('.popover-option-item').style.display !== 'none';
    });
    visibleCheckboxes.forEach(cb => {
      cb.checked = selectAllCb.checked;
    });
    updateSelectAllIndeterminate();
  });

  const valCheckboxes = container.querySelectorAll('.popover-val-cb');
  valCheckboxes.forEach(cb => {
    cb.addEventListener('change', updateSelectAllIndeterminate);
  });

  function updateSelectAllIndeterminate() {
    const visibleCBs = Array.from(container.querySelectorAll('.popover-val-cb')).filter(cb => {
      return cb.closest('.popover-option-item').style.display !== 'none';
    });
    const checkedCount = visibleCBs.filter(cb => cb.checked).length;

    if (checkedCount === 0) {
      selectAllCb.checked = false;
      selectAllCb.indeterminate = false;
    } else if (checkedCount === visibleCBs.length) {
      selectAllCb.checked = true;
      selectAllCb.indeterminate = false;
    } else {
      selectAllCb.checked = false;
      selectAllCb.indeterminate = true;
    }
  }

  updateSelectAllIndeterminate();

  const popover = $('#excel-filter-popover');
  popover.classList.remove('hidden');

  const rect = btn.getBoundingClientRect();
  const top = rect.bottom + window.scrollY;
  const left = rect.left + window.scrollX;
  popover.style.top = `${top + 4}px`;

  const popoverWidth = 220;
  if (left + popoverWidth > window.innerWidth) {
    popover.style.left = `${rect.right + window.scrollX - popoverWidth}px`;
  } else {
    popover.style.left = `${left}px`;
  }
}

function closeExcelFilterPopover() {
  const popover = $('#excel-filter-popover');
  if (popover) popover.classList.add('hidden');
  currentFilterPopover = null;
}

function applyExcelFilter() {
  if (!currentFilterPopover) return;
  const { table, col, triggerBtn } = currentFilterPopover;

  const container = $('#popover-options');
  const allCBs = Array.from(container.querySelectorAll('.popover-val-cb'));
  const checkedCBs = allCBs.filter(cb => cb.checked);

  if (checkedCBs.length === allCBs.length) {
    excelFilters[table][col] = null;
    triggerBtn.classList.remove('active');
  } else {
    const selectedSet = new Set(checkedCBs.map(cb => cb.dataset.value));
    excelFilters[table][col] = selectedSet;
    triggerBtn.classList.add('active');
  }

  closeExcelFilterPopover();

  if (table === 'purchases') {
    applyPurchasesFilters();
  } else if (table === 'stock') {
    applyStockFilters();
  }
}

function handlePopoverSearch() {
  const query = $('#popover-search').value.toLowerCase().trim();
  const container = $('#popover-options');
  const items = container.querySelectorAll('.popover-option-item');

  items.forEach(item => {
    const isSelectAll = item.querySelector('#popover-select-all');
    if (isSelectAll) return;

    const label = item.querySelector('label');
    const text = label ? label.textContent.toLowerCase() : '';

    if (text.includes(query)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });

  const selectAllCb = $('#popover-select-all');
  if (selectAllCb) {
    const visibleCBs = Array.from(container.querySelectorAll('.popover-val-cb')).filter(cb => {
      return cb.closest('.popover-option-item').style.display !== 'none';
    });
    const checkedCount = visibleCBs.filter(cb => cb.checked).length;

    if (visibleCBs.length === 0) {
      selectAllCb.checked = false;
      selectAllCb.indeterminate = false;
    } else if (checkedCount === 0) {
      selectAllCb.checked = false;
      selectAllCb.indeterminate = false;
    } else if (checkedCount === visibleCBs.length) {
      selectAllCb.checked = true;
      selectAllCb.indeterminate = false;
    } else {
      selectAllCb.checked = false;
      selectAllCb.indeterminate = true;
    }
  }
}


function updateBulkActionsBar() {
  const checkboxes = document.querySelectorAll('.purchase-select');
  const checked = Array.from(checkboxes).filter(cb => cb.checked);
  const bar = $('#purchases-bulk-actions');
  const countEl = $('#bulk-select-count');

  if (checked.length > 0) {
    countEl.textContent = checked.length;
    bar.classList.remove('hidden');

    // Disable comments button if more than 1 item is selected
    const btnComment = $('#btn-bulk-comment');
    if (btnComment) {
      btnComment.disabled = checked.length !== 1;
    }
  } else {
    bar.classList.add('hidden');
  }
}

async function bulkDeletePurchases() {
  const checked = document.querySelectorAll('.purchase-select:checked');
  if (checked.length === 0) return;
  if (!confirm(`¿Borrar los ${checked.length} registros de compra seleccionados?`)) return;

  let count = 0;
  for (const cb of checked) {
    try {
      await api(`/purchases/${cb.dataset.id}`, { method: 'DELETE' });
      count++;
    } catch (err) {
      toast(`Error al borrar registro ${cb.dataset.id}: ${err.message}`);
    }
  }
  toast(`${count} compras eliminadas.`);
  loadPurchases();
  loadStock();
}

// Comments helper function
function populateModalCommentsList(notes) {
  const list = $('#modal-comments-list');
  if (!list) return;
  list.innerHTML = '';

  let comments = [];
  try {
    comments = JSON.parse(notes || '[]');
    if (!Array.isArray(comments)) comments = [];
  } catch {
    if (notes) {
      comments = [{
        text: notes,
        userName: 'Admin',
        userPhoto: '',
        timestamp: 'Fecha anterior'
      }];
    }
  }

  if (comments.length === 0) {
    list.innerHTML = `<div class="no-comments-placeholder">Be the first one to add a comment</div>`;
  } else {
    list.innerHTML = comments.map((c, index) => {
      const imgHtml = c.userPhoto
        ? `<img src="${esc(c.userPhoto)}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--accent-soft);" />`
        : `<div style="width: 30px; height: 30px; border-radius: 50%; background: #334155; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; border: 1.5px solid rgba(255,255,255,0.08);">${esc((c.userName || 'AD').slice(0, 2).toUpperCase())}</div>`;

      const editedBadge = c.edited ? ' <span style="font-size: 10px; font-style: italic; opacity: 0.8; color: var(--muted); margin-left: 2px;">(editado)</span>' : '';

      return `<div class="comment-bubble" data-comment-index="${index}" style="position: relative; display: flex; gap: 10px; align-items: flex-start; background: #1e293b; padding: 12px; border-radius: 12px; margin-bottom: 12px; border: 1px solid rgba(255, 255, 255, 0.05);">
        ${imgHtml}
        <div style="flex: 1; min-width: 0;" class="comment-body-container">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
            <strong style="font-size: 13.5px; color: #fff;">${esc(c.userName)}</strong>
            <div class="comment-menu-container" style="position: relative;">
              <button type="button" class="comment-menu-btn" style="background: none; border: none; padding: 0 4px; color: var(--text-soft); font-size: 16px; cursor: pointer; line-height: 1; font-weight: bold; transition: color 0.2s;">...</button>
              <div class="comment-menu-dropdown hidden">
                <button type="button" class="edit-comment-btn" data-index="${index}">✏️ Editar</button>
                <button type="button" class="delete-comment-btn" data-index="${index}">🗑️ Borrar</button>
              </div>
            </div>
          </div>
          <div class="comment-text-display" style="font-size: 13.5px; color: var(--text-soft); word-break: break-word; line-height: 1.4; margin-bottom: 6px;">${esc(c.text)}</div>
          <div style="font-size: 11px; color: var(--muted); text-align: left; display: flex; align-items: center; gap: 4px;">
            <span>${esc(formatFriendlyDate(c.timestamp))}</span>${editedBadge}
          </div>
        </div>
      </div>`;
    }).join('');
  }
}

function handleEditCommentInline(index, btn) {
  const bubble = btn.closest('.comment-bubble');
  if (!bubble) return;

  let comments = [];
  try {
    comments = JSON.parse(currentPurchaseForEdit.notes || '[]');
    if (!Array.isArray(comments)) comments = [];
  } catch {
    if (currentPurchaseForEdit.notes) {
      comments = [{
        text: currentPurchaseForEdit.notes,
        userName: 'Admin',
        userPhoto: '',
        timestamp: 'Fecha anterior'
      }];
    }
  }

  const commentText = comments[index]?.text || '';
  const bodyContainer = bubble.querySelector('.comment-body-container');
  if (!bodyContainer) return;

  const userName = comments[index]?.userName || 'Admin';
  const timestamp = comments[index]?.timestamp || 'Fecha anterior';
  const editedBadge = comments[index]?.edited ? ' <span style="font-size: 10px; font-style: italic; opacity: 0.8; color: var(--muted); margin-left: 2px;">(editado)</span>' : '';

  bodyContainer.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
      <strong style="font-size: 13.5px; color: #fff;">${esc(userName)}</strong>
    </div>
    <textarea class="edit-comment-textarea">${esc(commentText)}</textarea>
    <div style="display: flex; gap: 8px; justify-content: space-between; align-items: center; margin-top: 4px;">
      <div style="font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 4px;">
        <span>${esc(formatFriendlyDate(timestamp))}</span>${editedBadge}
      </div>
      <div style="display: flex; gap: 6px; align-items: center;">
        <button type="button" class="cancel-comment-edit-btn">Cancelar</button>
        <button type="button" class="save-comment-edit-btn" data-index="${index}">Guardar</button>
      </div>
    </div>
  `;

  const textarea = bodyContainer.querySelector('.edit-comment-textarea');
  textarea.focus();
  // Colocar cursor al final del texto
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const saveBtn = bodyContainer.querySelector('.save-comment-edit-btn');
      if (saveBtn) saveBtn.click();
    }
  });
}

async function handleSaveCommentInline(index, btn) {
  const bubble = btn.closest('.comment-bubble');
  if (!bubble) return;

  const textarea = bubble.querySelector('.edit-comment-textarea');
  if (!textarea) return;

  const text = textarea.value.trim();
  if (!text) return toast('El comentario no puede estar vacío.');

  let comments = [];
  try {
    comments = JSON.parse(currentPurchaseForEdit.notes || '[]');
    if (!Array.isArray(comments)) comments = [];
  } catch {
    if (currentPurchaseForEdit.notes) {
      comments = [{
        text: currentPurchaseForEdit.notes,
        userName: 'Admin',
        userPhoto: '',
        timestamp: 'Fecha anterior'
      }];
    }
  }

  if (!comments[index]) return;

  // Solo actualiza si cambió el texto
  if (comments[index].text !== text) {
    comments[index].text = text;
    comments[index].edited = true;
  }

  const updatedNotes = JSON.stringify(comments);
  const id = currentPurchaseForEdit.id;

  const payload = {
    lote: currentPurchaseForEdit.lote,
    code: currentPurchaseForEdit.code,
    date: currentPurchaseForEdit.date,
    product: currentPurchaseForEdit.product,
    qty: currentPurchaseForEdit.qty,
    cost: currentPurchaseForEdit.cost,
    tax: currentPurchaseForEdit.tax,
    exchangeRate: currentPurchaseForEdit.exchangeRate,
    status: currentPurchaseForEdit.status,
    notes: updatedNotes
  };

  try {
    await api(`/purchases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    toast('Comentario actualizado.');

    currentPurchaseForEdit.notes = updatedNotes;
    $('#edit-pur-notes').value = updatedNotes;

    populateModalCommentsList(updatedNotes);
    await loadPurchases();
    await loadStock();

    // Mantener la fila seleccionada visualmente
    const tr = document.querySelector(`tr[data-purchase*="${id}"]`) || document.querySelector(`.purchase-select[data-id="${id}"]`)?.closest('tr');
    if (tr) {
      tr.classList.add('selected-row');
      const cb = tr.querySelector('.purchase-select');
      if (cb) cb.checked = true;
      updateBulkActionsBar();
      tr.dataset.purchase = JSON.stringify(currentPurchaseForEdit);
    }
  } catch (err) { toast(`Error: ${err.message}`); }
}

async function handleDeleteComment(index, btn) {
  if (!confirm('¿Borrar este comentario? Esta acción no se puede deshacer.')) return;

  let comments = [];
  try {
    comments = JSON.parse(currentPurchaseForEdit.notes || '[]');
    if (!Array.isArray(comments)) comments = [];
  } catch {
    if (currentPurchaseForEdit.notes) {
      comments = [{
        text: currentPurchaseForEdit.notes,
        userName: 'Admin',
        userPhoto: '',
        timestamp: 'Fecha anterior'
      }];
    }
  }

  if (!comments[index]) return;

  comments.splice(index, 1);
  const updatedNotes = JSON.stringify(comments);
  const id = currentPurchaseForEdit.id;

  const payload = {
    lote: currentPurchaseForEdit.lote,
    code: currentPurchaseForEdit.code,
    date: currentPurchaseForEdit.date,
    product: currentPurchaseForEdit.product,
    qty: currentPurchaseForEdit.qty,
    cost: currentPurchaseForEdit.cost,
    tax: currentPurchaseForEdit.tax,
    exchangeRate: currentPurchaseForEdit.exchangeRate,
    status: currentPurchaseForEdit.status,
    notes: updatedNotes
  };

  try {
    await api(`/purchases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    toast('Comentario eliminado.');

    currentPurchaseForEdit.notes = updatedNotes;
    $('#edit-pur-notes').value = updatedNotes;

    populateModalCommentsList(updatedNotes);
    await loadPurchases();
    await loadStock();

    const tr = document.querySelector(`tr[data-purchase*="${id}"]`) || document.querySelector(`.purchase-select[data-id="${id}"]`)?.closest('tr');
    if (tr) {
      tr.classList.add('selected-row');
      const cb = tr.querySelector('.purchase-select');
      if (cb) cb.checked = true;
      updateBulkActionsBar();
      tr.dataset.purchase = JSON.stringify(currentPurchaseForEdit);
    }
  } catch (err) { toast(`Error: ${err.message}`); }
}

async function submitModalComment(e) {
  e.preventDefault();
  if (!currentPurchaseForEdit) return;

  const id = currentPurchaseForEdit.id;
  const text = $('#modal-comment-text').value.trim();
  if (!text) return;

  const newComment = {
    text: text,
    userName: currentUserInfo?.displayName || currentUserInfo?.email || 'Admin',
    userPhoto: currentUserInfo?.photoURL || '',
    timestamp: formatFriendlyDate(new Date())
  };

  let comments = [];
  try {
    comments = JSON.parse(currentPurchaseForEdit.notes || '[]');
    if (!Array.isArray(comments)) comments = [];
  } catch {
    if (currentPurchaseForEdit.notes) {
      comments = [{
        text: currentPurchaseForEdit.notes,
        userName: 'Admin',
        userPhoto: '',
        timestamp: 'Fecha anterior'
      }];
    }
  }

  comments.push(newComment);
  const updatedNotes = JSON.stringify(comments);

  const payload = {
    lote: currentPurchaseForEdit.lote,
    code: currentPurchaseForEdit.code,
    date: currentPurchaseForEdit.date,
    product: currentPurchaseForEdit.product,
    qty: currentPurchaseForEdit.qty,
    cost: currentPurchaseForEdit.cost,
    tax: currentPurchaseForEdit.tax,
    exchangeRate: currentPurchaseForEdit.exchangeRate,
    status: currentPurchaseForEdit.status,
    notes: updatedNotes
  };

  try {
    await api(`/purchases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    toast('Comentario guardado.');
    $('#modal-comment-text').value = '';

    // Update local variable and textarea
    currentPurchaseForEdit.notes = updatedNotes;
    $('#edit-pur-notes').value = updatedNotes;

    // Refresh comments list UI
    populateModalCommentsList(updatedNotes);

    // Refresh history grid without closing modal
    await loadPurchases();
    await loadStock();
    // Maintain selection for visual consistency
    const tr = document.querySelector(`tr[data-purchase*="${id}"]`) || document.querySelector(`.purchase-select[data-id="${id}"]`)?.closest('tr');
    if (tr) {
      tr.classList.add('selected-row');
      const cb = tr.querySelector('.purchase-select');
      if (cb) cb.checked = true;
      updateBulkActionsBar();
      // Update stringified purchase data in row
      tr.dataset.purchase = JSON.stringify(currentPurchaseForEdit);
    }
  } catch (err) { toast(`Error: ${err.message}`); }
}

function toggleModalComments() {
  const modalContent = $('#edit-modal-content');
  const toggleBtn = $('#btn-toggle-comments');
  const list = $('#modal-comments-list');

  const opening = !modalContent.classList.contains('show-comments-pane');
  modalContent.classList.toggle('show-comments-pane', opening);
  toggleBtn.classList.toggle('active', opening);

  if (opening) {
    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
  }
}

// Bulk edit modal functions
function openBulkEditModal(count) {
  $('#bulk-edit-status').value = '';
  updateSelectStatusColor($('#bulk-edit-status'));
  $('#bulk-edit-rate').value = '';
  $('#bulk-edit-lote').value = '';
  $('#bulk-edit-count-label').textContent = count;
  $('#purchase-bulk-edit-modal').classList.remove('hidden');
}

function closeBulkEditModal() {
  $('#purchase-bulk-edit-modal').classList.add('hidden');
}

async function submitBulkEdit(e) {
  e.preventDefault();
  const checked = document.querySelectorAll('.purchase-select:checked');
  if (checked.length === 0) return;

  const targetStatus = $('#bulk-edit-status').value;
  const targetRate = $('#bulk-edit-rate').value.trim();
  const targetLote = $('#bulk-edit-lote').value.trim();

  if (!targetStatus && !targetRate && !targetLote) {
    return toast('Debes modificar al menos un campo.');
  }

  let count = 0;
  for (const cb of checked) {
    const tr = cb.closest('tr');
    if (!tr) continue;
    const p = JSON.parse(tr.dataset.purchase);

    const payload = {
      lote: targetLote ? targetLote : p.lote,
      code: p.code,
      date: p.date,
      product: p.product,
      qty: p.qty,
      cost: p.cost,
      tax: p.tax,
      exchangeRate: targetRate ? parseFloat(targetRate) : p.exchangeRate,
      status: targetStatus ? targetStatus : p.status,
      notes: p.notes
    };

    try {
      await api(`/purchases/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      count++;
    } catch (err) {
      toast(`Error al actualizar compra ${p.product}: ${err.message}`);
    }
  }

  toast(`${count} compras actualizadas en lote.`);
  closeBulkEditModal();
  loadPurchases();
  loadStock();
}

function handleToolbarEdit() {
  const checked = document.querySelectorAll('.purchase-select:checked');
  if (checked.length === 0) return;
  if (checked.length === 1) {
    const tr = checked[0].closest('tr');
    const p = JSON.parse(tr.dataset.purchase);
    openEditPurchaseModal(p, true);
  } else {
    openBulkEditModal(checked.length);
  }
}

function handleToolbarComment() {
  const checked = document.querySelectorAll('.purchase-select:checked');
  if (checked.length !== 1) return;
  const tr = checked[0].closest('tr');
  const p = JSON.parse(tr.dataset.purchase);
  openEditPurchaseModal(p, true);
}

function openEditPurchaseModal(p, autoShowComments = true) {
  const isCreate = !p;
  currentPurchaseForEdit = p;

  const modalContent = $('#edit-modal-content');
  const toggleBtn = $('#btn-toggle-comments');
  const list = $('#modal-comments-list');
  const title = $('#purchase-modal-title');
  const submitBtn = $('#purchase-edit-form button[type="submit"]');

  if (isCreate) {
    title.textContent = 'Registrar Compra de China';
    submitBtn.textContent = 'Registrar Compra';

    $('#edit-pur-id').value = '';

    let lastLote = 'LT1';
    const firstRow = document.querySelector('#purchases-tbody tr');
    if (firstRow) {
      const firstRowLote = firstRow.querySelector('td:nth-child(2)')?.textContent;
      if (firstRowLote) lastLote = firstRowLote.trim();
    }
    $('#edit-pur-lote').value = lastLote;

    $('#edit-pur-code').value = '';
    $('#edit-pur-date').value = new Date().toISOString().split('T')[0];
    $('#edit-pur-product').value = '';
    $('#edit-pur-qty').value = 1;
    $('#edit-pur-cost').value = 0;
    $('#edit-pur-tax').value = 0;
    $('#edit-pur-rate').value = 37.00;
    $('#edit-pur-status').value = 'Recibido';
    $('#edit-pur-notes').value = '[]';

    modalContent.classList.remove('show-comments-pane');
    toggleBtn.classList.remove('active');
    toggleBtn.classList.add('hidden');
  } else {
    title.textContent = 'Editar Compra de China';
    submitBtn.textContent = 'Guardar';

    $('#edit-pur-id').value = p.id;
    $('#edit-pur-lote').value = p.lote || '';
    $('#edit-pur-code').value = p.code || '';
    $('#edit-pur-date').value = p.date || '';
    $('#edit-pur-product').value = p.product || '';
    $('#edit-pur-qty').value = p.qty || 1;
    $('#edit-pur-cost').value = p.cost || 0;
    $('#edit-pur-tax').value = p.tax || 0;
    $('#edit-pur-rate').value = p.exchangeRate || 37.00;
    $('#edit-pur-status').value = p.status || 'Pedido';
    $('#edit-pur-notes').value = p.notes || '';

    populateModalCommentsList(p.notes);

    toggleBtn.classList.remove('hidden');
    if (autoShowComments) {
      modalContent.classList.add('show-comments-pane');
      toggleBtn.classList.add('active');
      setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
    } else {
      modalContent.classList.remove('show-comments-pane');
      toggleBtn.classList.remove('active');
    }
  }

  updateSelectStatusColor($('#edit-pur-status'));
  $('#purchase-edit-modal').classList.remove('hidden');
}

function closeEditPurchaseModal() {
  $('#purchase-edit-modal').classList.add('hidden');
  currentPurchaseForEdit = null;
}

async function submitModalPurchase(e) {
  e.preventDefault();

  const id = $('#edit-pur-id').value;
  const isCreate = !id;

  const lote = $('#edit-pur-lote').value.trim();
  const code = $('#edit-pur-code').value.trim();
  const date = $('#edit-pur-date').value;
  const product = $('#edit-pur-product').value.trim();
  const qty = parseInt($('#edit-pur-qty').value) || 1;
  const cost = parseFloat($('#edit-pur-cost').value) || 0;
  const tax = parseFloat($('#edit-pur-tax').value) || 0;
  const rate = parseFloat($('#edit-pur-rate').value) || 37.00;
  const status = $('#edit-pur-status').value;
  const notes = $('#edit-pur-notes').value.trim() || '[]';

  try {
    if (isCreate) {
      const payload = {
        lote,
        date,
        exchangeRate: rate,
        status,
        notes,
        items: [{ code, product, qty, cost, tax }]
      };

      await api('/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      toast('Compra registrada exitosamente.');
    } else {
      const payload = {
        lote, code, date, product, qty, cost, tax,
        exchangeRate: rate, status, notes
      };

      await api(`/purchases/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      toast('Compra actualizada exitosamente.');
    }
    closeEditPurchaseModal();
    loadPurchases();
    loadStock();
  } catch (err) { toast(`Error: ${err.message}`); }
}

async function deletePurchase(id, desc) {
  if (!confirm(`¿Borrar registro de compra "${desc}"?`)) return;
  try {
    await api(`/purchases/${id}`, { method: 'DELETE' });
    toast('Compra eliminada.');
    loadPurchases();
    loadStock();
  } catch (err) { toast(`Error: ${err.message}`); }
}

/* ============================================================
   Configuración / Temas
   ============================================================ */
function openSettingsModal() {
  const currentTheme = document.body.getAttribute('data-theme') || 'dark';
  $('#settings-theme').value = currentTheme;
  $('#settings-modal').classList.remove('hidden');
}

function closeSettingsModal() {
  $('#settings-modal').classList.add('hidden');
}

function submitSettings(e) {
  e.preventDefault();
  const theme = $('#settings-theme').value;
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('gyro_admin_theme', theme);
  toast('Configuración guardada.');
  closeSettingsModal();
}

function updateSelectStatusColor(selectEl) {
  if (!selectEl) return;
  selectEl.classList.remove('status-pending', 'status-paid', 'status-delivered');
  const val = selectEl.value;
  if (val === 'Pedido') {
    selectEl.classList.add('status-pending');
  } else if (val === 'En tránsito') {
    selectEl.classList.add('status-paid');
  } else if (val === 'Recibido') {
    selectEl.classList.add('status-delivered');
  }
}

/* ============================================================
   Vistas (login / panel)
   ============================================================ */
function showLogin(errorMsg) {
  localStorage.removeItem('gyro_admin_logged_in');
  const loadingView = $('#loading-view');
  if (loadingView) loadingView.classList.add('hidden');
  $('#login-view').classList.remove('hidden');
  $('#panel-view').classList.add('hidden');
  const el = $('#login-error');
  if (errorMsg) { el.textContent = errorMsg; el.classList.remove('hidden'); }
  else el.classList.add('hidden');
}

async function showPanel(user) {
  currentUserInfo = user;
  localStorage.setItem('gyro_admin_logged_in', 'true');

  if (user.role === 'seller') {
    localStorage.setItem('gyro_admin_dev_mode', 'seller');
    window.location.href = 'vendedor.html' + window.location.search;
    return;
  }

  // Si somos admin, limpiamos la bandera de modo vendedor
  if (localStorage.getItem('gyro_admin_dev_mode') === 'seller') {
    localStorage.removeItem('gyro_admin_dev_mode');
  }

  const urlParams = new URLSearchParams(window.location.search);
  const fromPage = urlParams.get('from');
  if (fromPage) {
    window.location.href = fromPage;
    return;
  }

  $('#login-view').classList.add('hidden');
  const loadingView = $('#loading-view');
  if (loadingView) loadingView.classList.add('hidden');
  $('#panel-view').classList.remove('hidden');
  $('#user-email').textContent = user.email;
  $('#user-photo').src = user.photoURL || 'assets/img/Gyro_Store_logo.jpeg';

  CONFIG = await api('/config');
  fillCategorySelect();
  await loadProducts();
  await loadPurchases();

  // Inicializa valores por defecto del formulario de compras (ya no estático)
}

/* ============================================================
   Init
   ============================================================ */
async function init() {
  // Cargar y aplicar tema guardado
  const savedTheme = localStorage.getItem('gyro_admin_theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);

  // Listeners de UI (no dependen de auth)
  $('#product-form').addEventListener('submit', submitProduct);
  $('#cancel-edit').addEventListener('click', resetForm);

  $('#purchase-edit-form').addEventListener('submit', submitModalPurchase);
  $('#modal-comments-form').addEventListener('submit', submitModalComment);
  $('#purchase-bulk-edit-form').addEventListener('submit', submitBulkEdit);

  const commentTextarea = $('#modal-comment-text');
  if (commentTextarea) {
    commentTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        $('#modal-comments-form').requestSubmit();
      }
    });
  }

  const btnNewPurchase = $('#btn-new-purchase');
  if (btnNewPurchase) {
    btnNewPurchase.addEventListener('click', () => openEditPurchaseModal(null));
  }



  $('#btn-bulk-delete').addEventListener('click', bulkDeletePurchases);
  $('#btn-bulk-edit').addEventListener('click', handleToolbarEdit);
  $('#btn-bulk-comment').addEventListener('click', handleToolbarComment);

  $('#btn-toggle-comments').addEventListener('click', toggleModalComments);

  // Close modal button configurations
  const modalCloseActions = [
    { btn: '#close-single-edit-modal-btn', action: closeEditPurchaseModal },
    { btn: '#cancel-single-edit-btn', action: closeEditPurchaseModal },
    { btn: '#close-bulk-edit-modal-btn', action: closeBulkEditModal },
    { btn: '#cancel-bulk-edit-btn', action: closeBulkEditModal },
    { btn: '#close-settings-modal-btn', action: closeSettingsModal },
    { btn: '#cancel-settings-btn', action: closeSettingsModal }
  ];
  modalCloseActions.forEach(cfg => {
    const el = $(cfg.btn);
    if (el) el.addEventListener('click', cfg.action);
  });

  // Listeners de Configuración
  const btnSettings = $('#btn-settings');
  if (btnSettings) btnSettings.addEventListener('click', openSettingsModal);
  $('#settings-form').addEventListener('submit', submitSettings);

  $('#edit-pur-status').addEventListener('change', (e) => updateSelectStatusColor(e.target));
  $('#bulk-edit-status').addEventListener('change', (e) => updateSelectStatusColor(e.target));

  const btnLogout = $('#btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      closeSettingsModal();
      localStorage.removeItem('gyro_admin_logged_in');
      localStorage.removeItem('gyro_admin_dev_mode');
      const urlParams = new URLSearchParams(window.location.search);
      const isDevMode = urlParams.get('dev') === 'true' || localStorage.getItem('gyro_admin_dev_mode') === 'true';
      if (isDevMode) {
        window.location.href = window.location.pathname;
      } else if (auth) {
        signOut(auth).catch(() => {});
      } else {
        showLogin();
      }
    });
  }

  // Listeners para filtros de columna estilo Excel
  document.querySelectorAll('.excel-filter-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const table = btn.dataset.table;
      const col = btn.dataset.col;
      openExcelFilterPopover(table, col, btn);
    });
  });

  const popoverSearch = $('#popover-search');
  if (popoverSearch) {
    popoverSearch.addEventListener('input', handlePopoverSearch);
  }

  const popoverCancel = $('#popover-cancel-btn');
  if (popoverCancel) {
    popoverCancel.addEventListener('click', closeExcelFilterPopover);
  }

  const popoverApply = $('#popover-apply-btn');
  if (popoverApply) {
    popoverApply.addEventListener('click', applyExcelFilter);
  }

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      $('#tab-stock').classList.toggle('hidden', target !== 'stock');
      $('#tab-products').classList.toggle('hidden', target !== 'products');
      $('#tab-orders').classList.toggle('hidden', target !== 'orders');
      $('#tab-purchases').classList.toggle('hidden', target !== 'purchases');
      if (target === 'orders') loadOrders();
      if (target === 'purchases') loadPurchases();
      if (target === 'stock') loadStock();
    });
  });

  document.addEventListener('click', (e) => {
    // Cerrar el popover de filtro si se hace clic fuera de él y de los triggers
    if (!e.target.closest('#excel-filter-popover') && !e.target.closest('.excel-filter-trigger')) {
      closeExcelFilterPopover();
    }

    const edit = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    const removeItem = e.target.closest('.btn-remove-item');
    const delPurchase = e.target.closest('[data-del-purchase]');
    const editPurchase = e.target.closest('.edit-purchase-btn');
    const closeModal = e.target.closest('.close-modal-btn');
    const editComment = e.target.closest('.edit-comment-btn');
    const cancelCommentEdit = e.target.closest('.cancel-comment-edit-btn');
    const saveCommentEdit = e.target.closest('.save-comment-edit-btn');
    const deleteComment = e.target.closest('.delete-comment-btn');
    const commentMenuBtn = e.target.closest('.comment-menu-btn');

    // Cerrar menús de comentarios si se hace clic fuera
    if (!e.target.closest('.comment-menu-container')) {
      document.querySelectorAll('.comment-menu-dropdown').forEach(d => d.classList.add('hidden'));
    }

    const clickableRow = e.target.closest('.clickable-row');
    if (clickableRow && !editPurchase && !delPurchase && !closeModal) {
      if (!e.target.closest('.purchase-select') && !e.target.closest('button') && !e.target.closest('a') && !e.target.closest('input')) {
        const purchaseData = clickableRow.dataset.purchase;
        if (purchaseData) {
          openEditPurchaseModal(JSON.parse(purchaseData));
        }
      }
    }

    if (edit) startEdit(JSON.parse(edit.dataset.edit));
    if (del) deleteProduct(del.dataset.del, del.dataset.name);
    if (removeItem) {
      removeItem.closest('tr').remove();
      recalculatePurchaseTotals();
    }
    if (delPurchase) {
      deletePurchase(delPurchase.dataset.delPurchase, delPurchase.dataset.desc);
    }
    if (editPurchase) {
      openEditPurchaseModal(JSON.parse(editPurchase.dataset.purchase));
    }
    if (closeModal) {
      closeEditPurchaseModal();
    }
    if (editComment) {
      const idx = parseInt(editComment.dataset.index);
      handleEditCommentInline(idx, editComment);
    }
    if (cancelCommentEdit) {
      if (currentPurchaseForEdit) populateModalCommentsList(currentPurchaseForEdit.notes);
    }
    if (saveCommentEdit) {
      const idx = parseInt(saveCommentEdit.dataset.index);
      handleSaveCommentInline(idx, saveCommentEdit);
    }
    if (deleteComment) {
      const idx = parseInt(deleteComment.dataset.index);
      handleDeleteComment(idx, deleteComment);
    }
    if (commentMenuBtn) {
      e.stopPropagation();
      const dropdown = commentMenuBtn.nextElementSibling;
      if (dropdown) {
        document.querySelectorAll('.comment-menu-dropdown').forEach(d => {
          if (d !== dropdown) d.classList.add('hidden');
        });
        dropdown.classList.toggle('hidden');
      }
      return;
    }
  });
  document.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-order]');
    if (sel) updateOrderStatus(sel.dataset.order, sel.value);

    const cb = e.target.closest('.purchase-select');
    if (cb) {
      const tr = cb.closest('tr');
      if (tr) {
        tr.classList.toggle('selected-row', cb.checked);
      }
      updateBulkActionsBar();

      const checkboxes = document.querySelectorAll('.purchase-select');
      const allChecked = Array.from(checkboxes).every(x => x.checked);
      const noneChecked = Array.from(checkboxes).every(x => !x.checked);
      const selectAll = $('#select-all-purchases');
      if (selectAll) {
        selectAll.checked = allChecked;
        selectAll.indeterminate = !allChecked && !noneChecked;
      }
    }

    const selectAllCb = e.target.closest('#select-all-purchases');
    if (selectAllCb) {
      const checked = selectAllCb.checked;
      document.querySelectorAll('.purchase-select').forEach((cb) => {
        cb.checked = checked;
        const tr = cb.closest('tr');
        if (tr) tr.classList.toggle('selected-row', checked);
      });
      updateBulkActionsBar();
    }
  });

  const urlParams = new URLSearchParams(window.location.search);
  const isDevMode = urlParams.get('dev') === 'true' || urlParams.get('dev') === 'seller' || localStorage.getItem('gyro_admin_dev_mode') === 'true' || localStorage.getItem('gyro_admin_dev_mode') === 'seller';

  if (urlParams.get('logout') === 'true') {
    localStorage.removeItem('gyro_admin_logged_in');
    localStorage.removeItem('gyro_admin_dev_mode');
    if (isDevMode || urlParams.get('logout') === 'true') {
      const fromPage = urlParams.get('from') || 'index.html';
      window.location.href = fromPage;
      return;
    }
  }

  if (isDevMode) {
    console.log('Dev mode active. Bypassing Firebase Auth.');
    const isSeller = localStorage.getItem('gyro_admin_dev_mode') === 'seller' || urlParams.get('dev') === 'seller';
    if (isSeller) {
      window.location.href = 'vendedor.html' + window.location.search;
      return;
    }
    await showPanel({
      email: 'dev-admin@gyrostore.com',
      photoURL: '../assets/img/Gyro_Store_logo.jpeg',
      displayName: 'Gerald Inga (Dev)',
      role: 'admin'
    });
    return;
  }

  // Si estamos en entorno local o red local, mostramos el botón de inicio de sesión de desarrollador
  const isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  /^192\.168\.\d+\.\d+$/.test(window.location.hostname) ||
                  /^10\.\d+\.\d+\.\d+$/.test(window.location.hostname) ||
                  /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(window.location.hostname) ||
                  /^169\.254\.\d+\.\d+$/.test(window.location.hostname);
                  
  if (isLocal) {
    const btnDev = $('#btn-dev-login');
    if (btnDev) {
      btnDev.classList.remove('hidden');
      btnDev.addEventListener('click', () => {
        const fromParam = urlParams.get('from');
        localStorage.setItem('gyro_admin_dev_mode', 'true');
        window.location.search = `?dev=true${fromParam ? `&from=${encodeURIComponent(fromParam)}` : ''}`;
      });

      // Insertar información de las credenciales locales de prueba
      let devInfo = document.getElementById('dev-credentials-info');
      if (!devInfo) {
        devInfo = document.createElement('div');
        devInfo.id = 'dev-credentials-info';
        devInfo.style.marginTop = '15px';
        devInfo.style.padding = '12px';
        devInfo.style.background = 'rgba(124, 131, 255, 0.08)';
        devInfo.style.border = '1px dashed rgba(124, 131, 255, 0.3)';
        devInfo.style.borderRadius = '8px';
        devInfo.style.fontSize = '12.5px';
        devInfo.style.color = 'var(--text-soft)';
        devInfo.style.textAlign = 'left';
        devInfo.innerHTML = `
          <p style="margin: 0 0 6px 0; font-weight: bold; color: var(--accent-soft); display: flex; align-items: center; gap: 4px;">
            🔑 Credenciales Locales de Prueba:
          </p>
          <div style="margin: 4px 0;"><strong>Admin:</strong> dev-admin@gyrostore.com <br> <span style="color:var(--muted);">Contraseña:</span> /admin1</div>
          <div style="margin: 4px 0; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px;"><strong>Vendedor:</strong> dev-seller@gyrostore.com <br> <span style="color:var(--muted);">Contraseña:</span> /seller1</div>
        `;
        btnDev.after(devInfo);
      }
    }
  }

  // Configuración de Firebase Web
  let fbConfig;
  try {
    fbConfig = await api('/auth/config');
  } catch {
    return showLogin('No se pudo contactar al servidor.');
  }
  if (!fbConfig.configured) {
    return showLogin('Falta configurar Firebase Web en el archivo .env (FIREBASE_API_KEY, FIREBASE_APP_ID, …).');
  }

  // Inicializa Firebase Auth
  const app = initializeApp(fbConfig);
  auth = getAuth(app);

  if (urlParams.get('logout') === 'true') {
    signOut(auth).then(() => {
      window.location.href = urlParams.get('from') || 'index.html';
    }).catch(() => {
      window.location.href = urlParams.get('from') || 'index.html';
    });
    return;
  }

  const emailLoginForm = $('#email-login-form');
  if (emailLoginForm) {
    emailLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#login-email').value.trim();
      const password = $('#login-password').value;
      const errorEl = $('#login-error');
      if (errorEl) errorEl.classList.add('hidden');

      // Interceptar credenciales de desarrollador local
      if (email === 'dev-admin@gyrostore.com' && password === '/admin1') {
        console.log('Local Dev credentials used. Bypassing Firebase.');
        localStorage.setItem('gyro_admin_dev_mode', 'true');
        const urlParams = new URLSearchParams(window.location.search);
        const fromParam = urlParams.get('from');
        window.location.href = `admin.html?dev=true${fromParam ? `&from=${encodeURIComponent(fromParam)}` : ''}`;
        return;
      }

      // Interceptar credenciales de vendedor local
      if (email === 'dev-seller@gyrostore.com' && password === '/seller1') {
        console.log('Local Seller credentials used. Bypassing Firebase.');
        localStorage.setItem('gyro_admin_dev_mode', 'seller');
        const urlParams = new URLSearchParams(window.location.search);
        const fromParam = urlParams.get('from');
        window.location.href = `vendedor.html?dev=seller${fromParam ? `&from=${encodeURIComponent(fromParam)}` : ''}`;
        return;
      }

      const submitBtn = emailLoginForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.textContent : 'Iniciar sesión';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Iniciando sesión...';
      }

      // Mostrar spinner de carga
      const loadingView = $('#loading-view');
      const loginView = $('#login-view');
      if (loadingView) loadingView.classList.remove('hidden');
      if (loginView) loginView.classList.add('hidden');

      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        if (loadingView) loadingView.classList.add('hidden');
        if (loginView) loginView.classList.remove('hidden');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
        let friendlyMessage = err.message;
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
          friendlyMessage = 'Correo o contraseña incorrectos.';
        } else if (err.code === 'auth/invalid-email') {
          friendlyMessage = 'Formato de correo electrónico no válido.';
        }
        showLogin(friendlyMessage);
      }
    });
  }

  $('#btn-google').addEventListener('click', async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      showLogin(`No se pudo iniciar sesión: ${err.message}`);
    }
  });

  // Reacciona a los cambios de sesión
  onAuthStateChanged(auth, async (user) => {
    if (!user) return showLogin();
    try {
      const me = await api('/auth/me'); // valida token + lista blanca en el servidor
      await showPanel({
        email: me.email,
        photoURL: user.photoURL,
        displayName: user.displayName || me.email.split('@')[0],
        role: me.role
      });
    } catch (err) {
      // Cuenta válida pero NO autorizada como admin
      await signOut(auth);
      showLogin(err.status === 403
        ? 'Esta cuenta no tiene permisos autorizados.'
        : `Error de sesión: ${err.message}`);
    }
  });
}

init();

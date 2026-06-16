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
let activePurchasesTab = 'all';
let currentPurchaseForReview = null;
let discardPurchaseId = null;

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

function switchTab(target) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  const tabBtn = $(`.tab[data-tab="${target}"]`);
  if (tabBtn) tabBtn.classList.add('active');

  $('#tab-stock').classList.toggle('hidden', target !== 'stock');
  $('#tab-products').classList.toggle('hidden', target !== 'products');
  $('#tab-orders').classList.toggle('hidden', target !== 'orders');
  $('#tab-purchases').classList.toggle('hidden', target !== 'purchases');
}

window.updateFilledInputs = function() {
  document.querySelectorAll('.grid-form input, .grid-form select, .grid-form textarea').forEach(el => {
    if (el.value !== undefined && el.value !== null && el.value.toString().trim() !== '') {
      el.classList.add('filled-input');
    } else {
      el.classList.remove('filled-input');
    }
  });
};

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
  const res = await fetch(`${API}${path}`, { cache: 'no-store', ...options, headers });
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
async function loadProducts(cachedProducts = null) {
  const products = cachedProducts || await api('/products?all=true');
  $('#product-count').textContent = products.length;
  $('#products-tbody').innerHTML = products.map((p) => `
    <tr>
      <td>${esc(p.name)}</td>
      <td>${esc(p.category)}</td>
      <td><span class="status-pill status-delivered" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: none;">Stock: ${p.stock || 0}</span></td>
      <td class="text-right">${money(p.price)}</td>
      <td class="row-actions text-center">
        <button class="edit-btn" data-edit='${esc(JSON.stringify(p))}'>Editar</button>
        <button class="del-btn" data-del="${esc(p.id)}" data-name="${esc(p.name)}">Borrar</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="5" class="muted-note">No hay productos.</td></tr>';
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
  window.updateFilledInputs();
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
  window.updateFilledInputs();
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
function renderOrderActionCell(o) {
  if (o.status === 'pending_approval') {
    return `<div style="display:flex; gap:6px; justify-content:center;">
      <button class="btn-ghost" style="padding:6px 10px; font-size:12px; color:#10b981;" data-approve-order="${esc(o.id)}">✔ Aprobar</button>
      <button class="btn-ghost" style="padding:6px 10px; font-size:12px; color:#ef4444;" data-reject-order="${esc(o.id)}">✖ Rechazar</button>
    </div>`;
  }
  if (o.status === 'approved' || o.status === 'rejected') {
    return `<span class="status-pill status-${esc(o.status)}">${esc(o.status)}</span>`;
  }
  const statuses = ['pending', 'paid', 'delivered', 'cancelled'];
  return `<select class="status-pill status-${esc(o.status)}" data-order="${esc(o.id)}">
    ${statuses.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
  </select>`;
}

async function loadOrders() {
  try {
    const orders = await api('/orders');

    const pendingApprovalCount = orders.filter((o) => o.status === 'pending_approval').length;
    $('#badge-orders-pending')?.classList.toggle('hidden', pendingApprovalCount === 0);

    $('#orders-tbody').innerHTML = orders.map((o) => {
      const items = o.lines.map((l) => `${esc(l.name)}${l.variant ? ` (${esc(l.variant)})` : ''} x${l.qty}`).join(', ');
      const date = o.createdAt && o.createdAt._seconds
        ? new Date(o.createdAt._seconds * 1000).toLocaleString('es-NI') : '—';
      const c = o.customer || {};
      const deliv = c.delivery === 'shipping' ? `🚚 ${esc(c.address || '')}` : '🏬 Retiro en tienda';
      const cliente = c.name && c.name !== 'Venta Directa'
        ? `<strong>${esc(c.name)}</strong><br><small>${esc(c.phone || '')}</small><br><small class="muted-note">${deliv}</small>${c.note ? `<br><small class="muted-note">📝 ${esc(c.note)}</small>` : ''}`
        : (o.sellerName ? `<strong>${esc(o.sellerName)}</strong><br><small class="muted-note">Venta directa (vendedor)</small>` : '<span class="muted-note">—</span>');
      const commission = o.commissionTotal != null ? money(o.commissionTotal) : '—';
      return `<tr>
        <td>#${esc(o.id.slice(0, 6))}</td>
        <td>${cliente}</td>
        <td>${items}</td>
        <td><strong>${money(o.total)}</strong></td>
        <td style="text-align:right;">${commission}</td>
        <td style="text-align:center;">${renderOrderActionCell(o)}</td>
        <td>${date}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" class="muted-note">Aún no hay pedidos.</td></tr>';
  } catch (err) { toast(`Error al cargar pedidos: ${err.message}`); }
}

async function updateOrderStatus(id, status) {
  try {
    await api(`/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    toast(`Pedido #${id.slice(0, 6)} → ${status}`);
    loadOrders();
  } catch (err) { toast(`Error: ${err.message}`); }
}

async function approveOrder(id) {
  try {
    const result = await api(`/orders/${id}/approve`, { method: 'POST' });
    toast(`Venta aprobada. Comisión: ${money(result.commissionTotal)}`);
    loadOrders();
  } catch (err) { toast(`Error al aprobar venta: ${err.message}`); }
}

let rejectOrderId = null;

function openRejectOrderModal(id) {
  rejectOrderId = id;
  $('#reject-order-reason').value = '';
  $('#reject-order-modal').classList.remove('hidden');
}

function closeRejectOrderModal() {
  $('#reject-order-modal').classList.add('hidden');
  rejectOrderId = null;
}

async function submitRejectOrder() {
  const reason = $('#reject-order-reason').value.trim();
  if (!reason) return toast('El motivo es obligatorio.');
  try {
    const id = rejectOrderId;
    await api(`/orders/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
    toast('Venta rechazada.');
    closeRejectOrderModal();
    loadOrders();
  } catch (err) { toast(`Error al rechazar venta: ${err.message}`); }
}

/* ============================================================
   Compras de China
   ============================================================ */
async function loadPurchases(cachedPurchases = null) {
  try {
    allPurchases = cachedPurchases || await api('/purchases');
    applyPurchasesFilters();
  } catch (err) { toast(`Error al cargar compras: ${err.message}`); }
}

function applyPurchasesFilters() {
  // Calcular conteos antes de aplicar el filtro de la pestaña activa
  const baseFiltered = allPurchases.filter((p) => {
    if (excelFilters.purchases.lote && !excelFilters.purchases.lote.has(String(p.lote || ''))) return false;
    if (excelFilters.purchases.code && !excelFilters.purchases.code.has(String(p.code || ''))) return false;
    if (excelFilters.purchases.date && !excelFilters.purchases.date.has(String(p.date || ''))) return false;
    if (excelFilters.purchases.product && !excelFilters.purchases.product.has(String(p.product || ''))) return false;
    return true;
  });

  const countAll = baseFiltered.length;
  const countTransit = baseFiltered.filter(p => p.status === 'En tránsito' || p.status === 'Pedido').length;
  const countReceived = baseFiltered.filter(p => p.status === 'Recibido').length;

  const purchasesAllEl = $('#purchases-all-count');
  if (purchasesAllEl) purchasesAllEl.textContent = countAll;
  const purchasesTransitEl = $('#purchases-transit-count');
  if (purchasesTransitEl) purchasesTransitEl.textContent = countTransit;
  const purchasesReceivedEl = $('#purchases-received-count');
  if (purchasesReceivedEl) purchasesReceivedEl.textContent = countReceived;

  // Filtrar ahora sí aplicando la pestaña activa
  const filtered = baseFiltered.filter((p) => {
    if (activePurchasesTab === 'transit' && p.status !== 'En tránsito' && p.status !== 'Pedido') return false;
    if (activePurchasesTab === 'received' && p.status !== 'Recibido') return false;
    return true;
  });

  $('#purchases-tbody').innerHTML = filtered.map((p) => {
    const date = p.date ? new Date(p.date + 'T00:00:00').toLocaleDateString('es-NI') : '—';
    const statusClass = p.status === 'Recibido' ? 'status-delivered' : p.status === 'En tránsito' ? 'status-paid' : 'status-pending';
    const preTotal = p.qty * p.cost;
    const impTotal = p.qty * (p.tax || 0);
    const unitCost = p.cost + (p.tax || 0);
    const totalUsd = p.qty * unitCost;
    return `<tr class="clickable-row" data-purchase='${esc(JSON.stringify(p))}'>
      <td class="col-select"><input type="checkbox" class="purchase-select" data-id="${p.id}" /></td>
      <td><strong>${esc(p.lote)}</strong></td>
      <td><span class="muted-note">${esc(p.code || '—')}</span></td>
      <td>${date}</td>
      <td>${esc(p.product)}</td>
      <td>${p.qty}</td>
      <td>$${p.cost.toFixed(2)}</td>
      <td>$${(p.tax || 0).toFixed(4)}</td>
      <td><strong>$${unitCost.toFixed(4)}</strong></td>
      <td>$${preTotal.toFixed(2)}</td>
      <td>$${impTotal.toFixed(4)}</td>
      <td><strong style="color: var(--accent);">$${totalUsd.toFixed(2)}</strong></td>
      <td><span class="status-pill ${statusClass}">${esc(p.status)}</span></td>
    </tr>`;
  }).join('') || '<tr><td colspan="13" class="muted-note">No se encontraron compras con los filtros seleccionados.</td></tr>';

  // Calcular y actualizar los totales en el pie de tabla
  let totalPre = 0;
  let totalImp = 0;
  let totalUsd = 0;
  filtered.forEach((p) => {
    totalPre += p.qty * p.cost;
    totalImp += p.qty * (p.tax || 0);
    totalUsd += p.qty * (p.cost + (p.tax || 0));
  });

  const totalPreEl = $('#purchases-total-pre');
  if (totalPreEl) totalPreEl.textContent = `$${totalPre.toFixed(2)}`;
  const totalImpEl = $('#purchases-total-imp');
  if (totalImpEl) totalImpEl.textContent = `$${totalImp.toFixed(4)}`;
  const totalUsdEl = $('#purchases-total-usd');
  if (totalUsdEl) totalUsdEl.textContent = `$${totalUsd.toFixed(2)}`;

  const selectAll = $('#select-all-purchases');
  if (selectAll) selectAll.checked = false;
  updateBulkActionsBar();
  updateNotifications();
}

async function loadStock(cachedPurchases = null) {
  try {
    const purchases = cachedPurchases || await api('/purchases');
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

  const approvedStock = filtered.filter(p => p.approved === true);
  const pendingStock = filtered.filter(p => p.approved === false || p.approved === undefined);

  // Update badge and text counts
  const countApproved = $('#stock-approved-count');
  if (countApproved) countApproved.textContent = approvedStock.length;
  const countPending = $('#stock-pending-count');
  if (countPending) countPending.textContent = pendingStock.length;

  // Render Approved Stock
  $('#stock-tbody').innerHTML = approvedStock.map((p) => {
    const unitCostVal = typeof p.unitCost === 'number' ? p.unitCost : 0;
    const totalUsdVal = typeof p.totalUsd === 'number' ? p.totalUsd : (p.qty * unitCostVal);
    const dateStr = p.receiveDate ? new Date(p.receiveDate + 'T00:00:00').toLocaleDateString('es-NI') : '—';
    const days = p.receiveDate && p.date ? Math.ceil((new Date(p.receiveDate) - new Date(p.date)) / (1000 * 60 * 60 * 24)) : null;
    const daysText = days !== null ? `${days} días` : '—';

    return `<tr class="clickable-row" data-purchase='${esc(JSON.stringify(p))}'>
      <td class="col-select"><input type="checkbox" class="stock-select" data-id="${p.id}" /></td>
      <td><strong>${esc(p.code || '—')}</strong></td>
      <td>${esc(p.product)}</td>
      <td class="text-right">${dateStr}</td>
      <td class="text-right">${daysText}</td>
      <td class="text-right">${p.qty}</td>
      <td class="text-right">$${(p.shipping || 0).toFixed(4)}</td>
      <td class="text-right"><strong>$${unitCostVal.toFixed(4)}</strong></td>
      <td class="text-right"><strong style="color: var(--accent);">$${totalUsdVal.toFixed(2)}</strong></td>
      <td class="text-right" style="color: #10b981;">C$${p.totalNio.toFixed(2)}</td>
      <td class="text-right" style="color: #6366f1;">C$${Math.ceil(unitCostVal * p.exchangeRate * 1.40)}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="11" class="muted-note">No se encontraron productos en stock con los filtros seleccionados.</td></tr>';

  // Render Pending Stock
  $('#stock-pending-tbody').innerHTML = pendingStock.map((p) => {
    return `<tr class="clickable-row" data-purchase='${esc(JSON.stringify(p))}'>
      <td><strong>${esc(p.code || '—')}</strong></td>
      <td>${esc(p.product)}</td>
      <td class="text-right">${p.qty}</td>
      <td class="text-right">$${(p.shipping || 0).toFixed(4)}</td>
      <td class="text-right"><strong>$${p.unitCost.toFixed(4)}</strong></td>
      <td class="text-right">$${p.totalUsd.toFixed(2)}</td>
      <td class="text-right"><strong style="color: var(--accent);">$${p.totalNio.toFixed(2)}</strong></td>
      <td class="text-right" style="color: #10b981;">C$${Math.ceil(p.unitCost * p.exchangeRate * 1.40)}</td>
      <td class="text-center row-actions">
        <button type="button" class="edit-btn btn-review-approve" data-id="${p.id}" style="margin: 0; padding: 6px 12px; font-weight:700;">Aprobar</button>
        <button type="button" class="del-btn btn-review-discard" data-id="${p.id}" style="margin: 0; padding: 6px 12px; font-weight:700;">Descartar</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="9" class="muted-note">No hay productos recibidos pendientes de aprobación.</td></tr>';

  // Calculate totals for Approved Stock
  let totalUsdApproved = 0;
  let totalNioApproved = 0;
  approvedStock.forEach(p => {
    totalUsdApproved += p.totalUsd || 0;
    totalNioApproved += p.totalNio || 0;
  });
  const totalUsdEl = $('#stock-total-usd');
  if (totalUsdEl) totalUsdEl.textContent = `$${totalUsdApproved.toFixed(2)}`;
  const totalNioEl = $('#stock-total-nio');
  if (totalNioEl) totalNioEl.textContent = `C$${totalNioApproved.toFixed(2)}`;

  // Calculate totals for Pending Stock
  let totalUsdPending = 0;
  let totalNioPending = 0;
  pendingStock.forEach(p => {
    totalUsdPending += p.totalUsd || 0;
    totalNioPending += p.totalNio || 0;
  });
  const pendingTotalUsdEl = $('#stock-pending-total-usd');
  if (pendingTotalUsdEl) pendingTotalUsdEl.textContent = `$${totalUsdPending.toFixed(2)}`;
  const pendingTotalNioEl = $('#stock-pending-total-nio');
  if (pendingTotalNioEl) pendingTotalNioEl.textContent = `C$${totalNioPending.toFixed(2)}`;

  // Reset stock select all checkbox and bulk actions bar
  const selectAll = $('#select-all-stock');
  if (selectAll) selectAll.checked = false;
  updateStockBulkActionsBar();
  updateNotifications();
}

/* ============================================================
   Aprobaciones y Revisiones de Stock
   ============================================================ */
function updateStockBulkActionsBar() {
  const selected = document.querySelectorAll('.stock-select:checked');
  const bar = $('#stock-bulk-actions');
  if (!bar) return;

  const countEl = $('#stock-bulk-select-count');
  if (countEl) countEl.textContent = selected.length;

  if (selected.length > 0) {
    bar.classList.remove('hidden');
    
    // Enable buttons only if exactly 1 is selected
    const editBtn = $('#btn-stock-bulk-edit');
    const discardBtn = $('#btn-stock-bulk-discard');
    
    if (editBtn) {
      editBtn.disabled = (selected.length !== 1);
      editBtn.style.opacity = (selected.length === 1) ? '1' : '0.5';
      editBtn.style.cursor = (selected.length === 1) ? 'pointer' : 'not-allowed';
    }
    if (discardBtn) {
      discardBtn.disabled = (selected.length !== 1);
      discardBtn.style.opacity = (selected.length === 1) ? '1' : '0.5';
      discardBtn.style.cursor = (selected.length === 1) ? 'pointer' : 'not-allowed';
    }
  } else {
    bar.classList.add('hidden');
  }
}

function updateNotifications() {
  const received = allPurchases.filter(p => p.status === 'Recibido');
  const pendingApproval = received.filter(p => p.approved === false || p.approved === undefined);

  const badge = $('#notif-badge');
  if (badge) {
    badge.textContent = pendingApproval.length;
    if (pendingApproval.length > 0) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  const list = $('#notif-items-list');
  if (list) {
    if (pendingApproval.length === 0) {
      list.innerHTML = `<div class="notif-empty">No hay notificaciones pendientes.</div>`;
    } else {
      list.innerHTML = pendingApproval.map(p => `
        <div class="notif-item" data-id="${p.id}">
          <div class="notif-item-title">Pendiente de Aprobación</div>
          <div class="notif-item-desc">${esc(p.product)}</div>
          <div class="notif-item-meta">
            <span>Cant: ${p.qty}</span>
            <span>Lote: ${esc(p.lote || '—')}</span>
          </div>
        </div>
      `).join('');
    }
  }
}

function openReviewModal(p) {
  currentPurchaseForReview = p;
  $('#review-pur-id').value = p.id;

  const modalTitle = $('#purchase-review-modal-title');
  const submitBtn = $('#purchase-review-form button[type="submit"]');
  const reviewDiscardBtn = $('#review-discard-btn');

  if (p.approved === true) {
    $('#review-pur-date').value = p.receiveDate ? p.receiveDate : '';
    $('#review-pur-shipping').value = p.shipping || 0;
    if (modalTitle) modalTitle.textContent = 'Editar Stock';
    if (submitBtn) submitBtn.textContent = 'Guardar Cambios';
    if (reviewDiscardBtn) reviewDiscardBtn.classList.remove('hidden');
  } else {
    $('#review-pur-date').value = '';
    $('#review-pur-shipping').value = '';
    if (modalTitle) modalTitle.textContent = 'Revisar Ingreso a Bodega';
    if (submitBtn) submitBtn.textContent = 'Aprobar e Ingresar';
    if (reviewDiscardBtn) reviewDiscardBtn.classList.add('hidden');
  }

  $('#purchase-review-modal').classList.remove('hidden');
  window.updateFilledInputs();
}

function closeReviewModal() {
  $('#purchase-review-modal').classList.add('hidden');
  currentPurchaseForReview = null;
}

async function submitReviewForm(e) {
  e.preventDefault();
  const id = $('#review-pur-id').value;
  const receiveDate = $('#review-pur-date').value;
  const shipping = parseFloat($('#review-pur-shipping').value) || 0;

  try {
    const p = currentPurchaseForReview;
    const payload = {
      ...p,
      receiveDate,
      shipping,
      approved: true,
      status: 'Recibido'
    };

    await api(`/purchases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (p && p.approved === true) {
      toast('Stock actualizado correctamente.');
    } else {
      toast('Producto aprobado e ingresado a bodega.');
    }
    closeReviewModal();
    await loadStock();
    await loadPurchases();
  } catch (err) {
    toast(`Error al aprobar: ${err.message}`);
  }
}

function openDiscardModal(id) {
  discardPurchaseId = id;
  $('#discard-reason-input').value = '';
  $('#discard-prompt-modal').classList.remove('hidden');
  window.updateFilledInputs();
}

function closeDiscardModal() {
  $('#discard-prompt-modal').classList.add('hidden');
  discardPurchaseId = null;
}

async function submitDiscard() {
  const reason = $('#discard-reason-input').value.trim();
  if (!reason) return toast('El motivo es obligatorio.');

  try {
    const id = discardPurchaseId;
    const p = allPurchases.find(x => x.id === id);
    if (!p) return toast('No se encontró el producto a descartar.');

    let comments = [];
    try {
      comments = JSON.parse(p.notes || '[]');
    } catch {
      if (p.notes) comments = [{ text: p.notes, userName: 'Admin', userPhoto: '', timestamp: 'Fecha anterior' }];
    }
    comments.push({
      text: `Producto descartado. Motivo: ${reason}`,
      userName: currentUserInfo?.displayName || 'Admin',
      userPhoto: currentUserInfo?.photoURL || '',
      timestamp: formatFriendlyDate(new Date())
    });

    const payload = {
      ...p,
      status: 'En tránsito',
      approved: false,
      notes: JSON.stringify(comments)
    };

    await api(`/purchases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    toast('Producto devuelto a estado "En tránsito".');
    closeDiscardModal();
    await loadStock();
    await loadPurchases();
  } catch (err) {
    toast(`Error al descartar: ${err.message}`);
  }
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
    uniquePairs.sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true, sensitivity: 'base' }));
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
  const rateInput = $('#bulk-edit-rate');
  if (rateInput) rateInput.value = '';
  $('#bulk-edit-lote').value = '';
  $('#bulk-edit-count-label').textContent = count;
  $('#purchase-bulk-edit-modal').classList.remove('hidden');
  window.updateFilledInputs();
}

function closeBulkEditModal() {
  $('#purchase-bulk-edit-modal').classList.add('hidden');
}

async function submitBulkEdit(e) {
  e.preventDefault();
  const checked = document.querySelectorAll('.purchase-select:checked');
  if (checked.length === 0) return;

  const targetStatus = $('#bulk-edit-status').value;
  const rateInput = $('#bulk-edit-rate');
  const targetRate = rateInput ? rateInput.value.trim() : '';
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
      status: (targetStatus && p.status !== 'Recibido') ? targetStatus : p.status,
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
    $('#edit-pur-lote').value = '';
    $('#edit-pur-code').value = '';
    $('#edit-pur-date').value = '';
    $('#edit-pur-product').value = '';
    $('#edit-pur-qty').value = '';
    $('#edit-pur-cost').value = '';
    $('#edit-pur-tax').value = '';
    const rateInput = $('#edit-pur-rate');
    if (rateInput) rateInput.value = 37.00;
    $('#edit-pur-status').value = 'En tránsito';
    $('#edit-pur-status').disabled = true;
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
    const rateInput = $('#edit-pur-rate');
    if (rateInput) rateInput.value = p.exchangeRate || 37.00;
    $('#edit-pur-status').value = p.status || 'Pedido';
    $('#edit-pur-status').disabled = (p.status === 'Recibido');
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
  window.updateFilledInputs();
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
  const rateInput = $('#edit-pur-rate');
  const rate = rateInput ? (parseFloat(rateInput.value) || 37.00) : 37.00;
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
  localStorage.setItem('gyro_user_name', user.displayName || user.email.split('@')[0] || '');
  localStorage.setItem('gyro_user_photo', user.photoURL || '');
  localStorage.setItem('gyro_user_role', user.role || '');
  localStorage.setItem('gyro_user_roles', JSON.stringify(user.roles || (user.role ? [user.role] : [])));

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

  // Ocultar login y asegurar que se muestra pantalla de carga
  $('#login-view').classList.add('hidden');
  const loadingView = $('#loading-view');
  if (loadingView) loadingView.classList.remove('hidden');
  $('#panel-view').classList.add('hidden');

  // Fetch config, products, and purchases in parallel to optimize load time
  const [configData, productsData, purchasesData] = await Promise.all([
    api('/config'),
    api('/products?all=true'),
    api('/purchases')
  ]);

  CONFIG = configData;
  fillCategorySelect();

  // Populate global purchases and render initial tables
  allPurchases = purchasesData;
  await loadProducts(productsData);
  applyPurchasesFilters();
  applyStockFilters();

  // Restore active tab
  const activeTab = localStorage.getItem('gyro_admin_active_tab') || 'purchases';
  switchTab(activeTab);

  if (activeTab === 'orders') {
    await loadOrders();
  }

  // Una vez cargado todo y establecida la pestaña activa, ocultamos pantalla de carga y mostramos el panel
  if (loadingView) loadingView.classList.add('hidden');
  $('#panel-view').classList.remove('hidden');
  $('#user-email').textContent = user.email;
  $('#user-photo').src = user.photoURL || 'assets/img/Gyro_Store_logo.jpeg';
}

/* ============================================================
   Init
   ============================================================ */
async function init() {
  // Cargar y aplicar tema guardado
  const savedTheme = localStorage.getItem('gyro_admin_theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);

  // Listeners de UI (no dependen de auth)
  $('#product-form')?.addEventListener('submit', submitProduct);
  $('#cancel-edit')?.addEventListener('click', resetForm);

  document.addEventListener('input', (e) => {
    if (e.target.closest('.grid-form')) window.updateFilledInputs();
  });
  document.addEventListener('change', (e) => {
    if (e.target.closest('.grid-form')) window.updateFilledInputs();
  });

  $('#purchase-edit-form')?.addEventListener('submit', submitModalPurchase);
  $('#modal-comments-form')?.addEventListener('submit', submitModalComment);
  $('#purchase-bulk-edit-form')?.addEventListener('submit', submitBulkEdit);

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



  $('#btn-bulk-delete')?.addEventListener('click', bulkDeletePurchases);
  $('#btn-bulk-edit')?.addEventListener('click', handleToolbarEdit);
  $('#btn-bulk-comment')?.addEventListener('click', handleToolbarComment);

  $('#btn-toggle-comments')?.addEventListener('click', toggleModalComments);

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
  $('#settings-form')?.addEventListener('submit', submitSettings);

  $('#edit-pur-status')?.addEventListener('change', (e) => updateSelectStatusColor(e.target));
  $('#bulk-edit-status')?.addEventListener('change', (e) => updateSelectStatusColor(e.target));

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
      const target = tab.dataset.tab;
      switchTab(target);
      localStorage.setItem('gyro_admin_active_tab', target);
      if (target === 'orders') loadOrders();
      if (target === 'purchases') loadPurchases();
      if (target === 'stock') loadStock();
    });
  });

  document.querySelectorAll('[data-stock-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-stock-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const isPending = btn.dataset.stockTab === 'pending';
      $('#stock-pane-approved').classList.toggle('hidden', isPending);
      $('#stock-pane-pending').classList.toggle('hidden', !isPending);
    });
  });

  document.querySelectorAll('[data-purchases-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-purchases-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activePurchasesTab = btn.dataset.purchasesTab;
      applyPurchasesFilters();
    });
  });

  $('#purchase-review-form')?.addEventListener('submit', submitReviewForm);

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

    const btnNotifications = e.target.closest('#btn-notifications');
    const notifItem = e.target.closest('.notif-item');

    const btnReviewApprove = e.target.closest('.btn-review-approve');
    const btnReviewDiscard = e.target.closest('.btn-review-discard');
    const reviewDiscardBtn = e.target.closest('#review-discard-btn');
    const closeReviewModalBtn = e.target.closest('#close-review-modal-btn');
    const cancelReviewBtn = e.target.closest('#cancel-review-btn');
    const cancelDiscardBtn = e.target.closest('#cancel-discard-btn');
    const confirmDiscardBtn = e.target.closest('#confirm-discard-btn');

    // Cerrar menús de comentarios si se hace clic fuera
    if (!e.target.closest('.comment-menu-container')) {
      document.querySelectorAll('.comment-menu-dropdown').forEach(d => d.classList.add('hidden'));
    }

    // Cerrar menú de notificaciones si se hace clic fuera
    if (!e.target.closest('#btn-notifications') && !e.target.closest('#notifications-dropdown')) {
      $('#notifications-dropdown')?.classList.add('hidden');
    }

    const btnStockBulkEdit = e.target.closest('#btn-stock-bulk-edit');
    const btnStockBulkDiscard = e.target.closest('#btn-stock-bulk-discard');

    const clickableRow = e.target.closest('.clickable-row');
    if (clickableRow && !editPurchase && !delPurchase && !closeModal && !btnReviewApprove && !btnReviewDiscard && !btnStockBulkEdit && !btnStockBulkDiscard) {
      if (!e.target.closest('.purchase-select') && !e.target.closest('.stock-select') && !e.target.closest('button') && !e.target.closest('a') && !e.target.closest('input')) {
        const purchaseData = clickableRow.dataset.purchase;
        if (purchaseData) {
          const parsed = JSON.parse(purchaseData);
          if (clickableRow.closest('#stock-table') || clickableRow.closest('#stock-pending-table')) {
            openReviewModal(parsed);
          } else {
            openEditPurchaseModal(parsed);
          }
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
    if (btnReviewApprove) {
      const tr = btnReviewApprove.closest('tr');
      const p = JSON.parse(tr.dataset.purchase);
      openReviewModal(p);
    }
    if (btnReviewDiscard) {
      openDiscardModal(btnReviewDiscard.dataset.id);
    }
    if (btnNotifications) {
      e.stopPropagation();
      $('#notifications-dropdown')?.classList.toggle('hidden');
    }
    if (notifItem) {
      const id = notifItem.dataset.id;
      const p = allPurchases.find(x => x.id === id);
      if (p) {
        $('#notifications-dropdown')?.classList.add('hidden');
        openReviewModal(p);
      }
    }
    if (reviewDiscardBtn) {
      if (currentPurchaseForReview) {
        const id = currentPurchaseForReview.id;
        closeReviewModal();
        openDiscardModal(id);
      }
    }
    if (btnStockBulkEdit) {
      const selected = document.querySelectorAll('.stock-select:checked');
      if (selected.length === 1) {
        const id = selected[0].dataset.id;
        const p = allPurchases.find(x => x.id === id);
        if (p) openReviewModal(p);
      }
    }
    if (btnStockBulkDiscard) {
      const selected = document.querySelectorAll('.stock-select:checked');
      if (selected.length === 1) {
        const id = selected[0].dataset.id;
        openDiscardModal(id);
      }
    }
    if (closeReviewModalBtn || cancelReviewBtn) {
      closeReviewModal();
    }
    if (cancelDiscardBtn) {
      closeDiscardModal();
    }
    if (confirmDiscardBtn) {
      submitDiscard();
    }
    const approveOrderBtn = e.target.closest('[data-approve-order]');
    if (approveOrderBtn) {
      approveOrder(approveOrderBtn.dataset.approveOrder);
    }
    const rejectOrderBtn = e.target.closest('[data-reject-order]');
    if (rejectOrderBtn) {
      openRejectOrderModal(rejectOrderBtn.dataset.rejectOrder);
    }
    if (e.target.closest('#cancel-reject-order-btn')) {
      closeRejectOrderModal();
    }
    if (e.target.closest('#confirm-reject-order-btn')) {
      submitRejectOrder();
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

    const stockCb = e.target.closest('.stock-select');
    if (stockCb) {
      const tr = stockCb.closest('tr');
      if (tr) {
        tr.classList.toggle('selected-row', stockCb.checked);
      }
      updateStockBulkActionsBar();

      const checkboxes = document.querySelectorAll('.stock-select');
      const allChecked = Array.from(checkboxes).every(x => x.checked);
      const noneChecked = Array.from(checkboxes).every(x => !x.checked);
      const selectAllStock = $('#select-all-stock');
      if (selectAllStock) {
        selectAllStock.checked = allChecked;
        selectAllStock.indeterminate = !allChecked && !noneChecked;
      }
    }

    const selectAllStockCb = e.target.closest('#select-all-stock');
    if (selectAllStockCb) {
      const checked = selectAllStockCb.checked;
      document.querySelectorAll('.stock-select').forEach((cb) => {
        cb.checked = checked;
        const tr = cb.closest('tr');
        if (tr) tr.classList.toggle('selected-row', checked);
      });
      updateStockBulkActionsBar();
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
    const btnDev   = $('#btn-dev-login');
    const devModal = $('#dev-login-modal');

    if (btnDev && devModal) {
      btnDev.classList.remove('hidden');

      const openModal  = () => { devModal.style.display = 'grid'; $('#dev-login-password').focus(); };
      const closeModal = () => {
        devModal.style.display = 'none';
        $('#dev-login-password').value = '';
        $('#dev-login-error').style.display = 'none';
      };

      btnDev.addEventListener('click', openModal);
      $('#dev-modal-close').addEventListener('click', closeModal);
      devModal.addEventListener('click', e => {
        e.stopPropagation();
        if (e.target === devModal) closeModal();
      });

      // Toggle mostrar/ocultar contraseña en el modal
      $('#dev-pass-toggle').addEventListener('click', () => {
        const inp  = $('#dev-login-password');
        const icon = $('#dev-pass-icon');
        const show = inp.type === 'password';
        inp.type       = show ? 'text' : 'password';
        icon.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      });

      // Submit del modal → usa el form principal con Firebase
      $('#dev-login-form').addEventListener('submit', async e => {
        e.preventDefault();
        const password  = $('#dev-login-password').value;
        const errEl     = $('#dev-login-error');
        const submitBtn = $('#dev-login-submit');

        errEl.style.display = 'none';
        submitBtn.disabled  = true;
        submitBtn.textContent = 'Iniciando sesión...';

        try {
          await signInWithEmailAndPassword(auth, 'dev-admin@gyrostore.com', password);
          closeModal();
        } catch (err) {
          let msg = 'Error al iniciar sesión.';
          if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
            msg = 'Contraseña incorrecta.';
          } else if (err.code === 'auth/too-many-requests') {
            msg = 'Demasiados intentos. Espera un momento.';
          }
          errEl.textContent   = msg;
          errEl.style.display = 'block';
          submitBtn.disabled  = false;
          submitBtn.textContent = 'Iniciar sesión';
        }
      });
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

  // Toggle mostrar/ocultar contraseña
  const btnTogglePass = $('#btn-toggle-password');
  if (btnTogglePass) {
    btnTogglePass.addEventListener('click', () => {
      const passInput = $('#login-password');
      const icon      = $('#toggle-pass-icon');
      if (!passInput) return;
      const isHidden = passInput.type === 'password';
      passInput.type = isHidden ? 'text' : 'password';
      icon.className = isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    });
  }

  const emailLoginForm = $('#email-login-form');
  if (emailLoginForm) {
    emailLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#login-email').value.trim();
      const password = $('#login-password').value;
      const errorEl = $('#login-error');
      if (errorEl) errorEl.classList.add('hidden');

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
        role: me.role,
        roles: me.roles
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

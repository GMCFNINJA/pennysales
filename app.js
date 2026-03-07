const state = {
  page: "home",
  products: [],
  sales: [],
  salesTotalCount: 0,
  salesVisible: 20,
  affiliates: [],
  balances: [],
  modalOpen: false,
  submitting: false
};

const el = {
  pageHome: document.getElementById("page-home"),
  pageAffiliates: document.getElementById("page-affiliates"),
  pageCart: document.getElementById("page-cart"),
  productsList: document.getElementById("productsList"),
  affiliatesList: document.getElementById("affiliatesList"),
  balancesTop: document.getElementById("balancesTop"),
  salesList: document.getElementById("salesList"),
  bottomBar: document.getElementById("bottomBar"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalContainer: document.getElementById("modalContainer"),
  exportCsvBtn: document.getElementById("exportCsvBtn")
};

function formatMoney(value) {
  const num = Number(value || 0);
  return `${num.toFixed(2)}€`;
}

function formatDate(dateString) {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString("pt-PT");
}

function nowDateISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nowTimeHHMMSS() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function escapeHtml(text = "") {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getProductById(id) {
  return state.products.find(p => Number(p.id) === Number(id));
}

function getBalanceByPerson(name) {
  return state.balances.find(b => b.person_name === name) || {
    person_name: name,
    current_balance: 0,
    total_withdrawn: 0,
    total_profit: 0
  };
}

function setSubmitting(value) {
  state.submitting = value;
  document.querySelectorAll("[data-busy-lock='true']").forEach(btn => {
    btn.disabled = value;
    btn.style.opacity = value ? "0.6" : "1";
  });
}

function openModal(html) {
  state.modalOpen = true;
  el.modalContainer.innerHTML = html;
  el.modalOverlay.classList.remove("hidden");
}

function closeModal() {
  state.modalOpen = false;
  el.modalOverlay.classList.add("hidden");
  el.modalContainer.innerHTML = "";
}

function alertModal(message, title = "Aviso") {
  openModal(`
    <div class="modal-top">
      <h2 class="modal-title">${escapeHtml(title)}</h2>
      <button class="circle-btn" data-close-modal="true">✕</button>
    </div>
    <div class="info-row">
      <div class="info-value">${escapeHtml(message)}</div>
    </div>
    <div class="modal-actions">
      <button class="action-btn primary" data-close-modal="true">OK</button>
    </div>
  `);
}

function confirmModal(message, onConfirm, title = "Confirmar") {
  openModal(`
    <div class="modal-top">
      <h2 class="modal-title">${escapeHtml(title)}</h2>
      <button class="circle-btn" data-close-modal="true">✕</button>
    </div>
    <div class="info-row">
      <div class="info-value">${escapeHtml(message)}</div>
    </div>
    <div class="modal-actions">
      <button class="action-btn" data-close-modal="true">Cancelar</button>
      <button class="action-btn primary" id="confirmActionBtn" data-busy-lock="true">Confirmar</button>
    </div>
  `);

  document.getElementById("confirmActionBtn").addEventListener("click", async () => {
    if (state.submitting) return;
    try {
      setSubmitting(true);
      await onConfirm();
      closeModal();
    } catch (error) {
      alertModal(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  });
}

function readErrorMessage(error) {
  const msg = error?.message || String(error || "");
  if (msg.includes("STOCK_INSUFFICIENT")) return "Stock insuficiente.";
  if (msg.toLowerCase().includes("duplicate")) return "Esse nome já existe.";
  return msg || "Ocorreu um erro.";
}

function showPage(page) {
  state.page = page;

  el.pageHome.classList.toggle("hidden", page !== "home");
  el.pageAffiliates.classList.toggle("hidden", page !== "affiliates");
  el.pageCart.classList.toggle("hidden", page !== "cart");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });
}

async function refreshCoreData() {
  state.products = await db.getProducts();
  state.salesTotalCount = await db.getSalesCount();
  state.sales = await db.getSales(state.salesVisible, 0);
  state.affiliates = await db.getAffiliates();
  await db.recalculateBalances();
  state.balances = await db.getBalances();
}

function renderHome() {
  if (!state.products.length) {
    el.productsList.innerHTML = `<div class="empty-state">Sem produtos.</div>`;
    return;
  }

  el.productsList.innerHTML = state.products.map(product => `
    <div class="product-row">
      <div class="product-id">${product.id}</div>
      <img class="product-photo" src="${product.image_url}" alt="Produto ${product.id}" />
      <button class="stock-btn" data-action="increase-stock" data-id="${product.id}">+</button>
      <div class="stock-value">${product.stock}</div>
      <button class="stock-btn" data-action="open-sale" data-id="${product.id}" ${Number(product.stock) <= 0 ? "disabled" : ""}>-</button>
    </div>
  `).join("");
}

function renderAffiliates() {
  const cards = [];

  cards.push(`
    <div class="add-affiliate-card" data-action="open-add-affiliate">
      <div>+ Adicionar afiliado</div>
    </div>
  `);

  if (!state.affiliates.length) {
    cards.push(`<div class="empty-state">Ainda não existem afiliados.</div>`);
  } else {
    state.affiliates.forEach(affiliate => {
      cards.push(`
        <div class="affiliate-card">
          <img class="affiliate-avatar" src="${affiliate.image_url}" alt="${escapeHtml(affiliate.name)}" />
          <div>
            <div class="affiliate-name">${escapeHtml(affiliate.name)}</div>
            <div class="affiliate-sales">Vendas: ${affiliate.sales_count}</div>
          </div>
          <div class="affiliate-actions">
            <button class="small-action-btn" data-action="affiliate-plus" data-id="${affiliate.id}">+</button>
            <button class="small-action-btn" data-action="affiliate-minus" data-id="${affiliate.id}">-</button>
            <button class="small-action-btn remove" data-action="affiliate-remove" data-id="${affiliate.id}">✕</button>
          </div>
        </div>
      `);
    });
  }

  el.affiliatesList.innerHTML = cards.join("");
}

function renderBalances() {
  el.balancesTop.innerHTML = APP_CONFIG.PERSONS.map(name => {
    const balance = getBalanceByPerson(name);
    return `
      <div class="balance-card" data-action="open-withdraw" data-person="${name}">
        <div class="balance-head">
          <div class="person-icon">
            <img src="${APP_CONFIG.NAV_ICONS.person}" alt="${name}" />
          </div>
          <div class="balance-name">${name}</div>
        </div>
        <div class="balance-main">${formatMoney(balance.current_balance)}</div>
        <div class="balance-meta">
          Total levantado: ${formatMoney(balance.total_withdrawn)}<br />
          Lucro total: ${formatMoney(balance.total_profit)}
        </div>
      </div>
    `;
  }).join("");
}

function renderSales() {
  if (!state.sales.length) {
    el.salesList.innerHTML = `<div class="empty-state">Ainda não existem vendas.</div>`;
    return;
  }

  const html = state.sales.map(sale => {
    const product = getProductById(sale.product_id);
    const image = product?.image_url || "https://placehold.co/120x120/png?text=?";
    return `
      <div class="sale-card" data-action="open-sale-info" data-id="${sale.id}">
        <img class="sale-photo" src="${image}" alt="Produto ${sale.product_id}" />
        <div>
          <div class="sale-title">Venda #${sale.id}</div>
          <div class="sale-sub">
            ${formatDate(sale.sale_date)} · ${sale.sale_time}<br />
            Produto ${sale.product_id} · ${formatMoney(sale.price)} · ${escapeHtml(sale.client)}
          </div>
        </div>
      </div>
    `;
  }).join("");

  const loadMoreButton = state.sales.length < state.salesTotalCount
    ? `<button class="action-btn load-more" data-action="load-more-sales">Carregar mais</button>`
    : "";

  el.salesList.innerHTML = html + loadMoreButton;
}

function renderAll() {
  renderHome();
  renderAffiliates();
  renderBalances();
  renderSales();
}

function saleModal(productId) {
  const product = getProductById(productId);
  if (!product) {
    alertModal("Produto não encontrado.");
    return;
  }

  openModal(`
    <div class="modal-top">
      <button class="circle-btn" data-close-modal="true">✕</button>
      <h2 class="modal-title">Registar venda</h2>
      <div style="width:34px"></div>
    </div>

    <div class="info-row" style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
      <img src="${product.image_url}" alt="Produto ${product.id}" style="width:72px; height:72px; object-fit:cover; border-radius:16px; border:1px solid rgba(255,255,255,0.08);" />
      <div>
        <div class="info-label">Produto</div>
        <div class="info-value">ID ${product.id}</div>
        <div class="info-value">Stock atual: ${product.stock}</div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Preço</label>
      <select id="salePriceSelect" class="select">
        <option value="">Escolher...</option>
        <option value="20">20€</option>
        <option value="15">15€</option>
        <option value="17">17€</option>
        <option value="custom">Personalizado</option>
      </select>
    </div>

    <div class="form-group hidden" id="customPriceWrap">
      <label class="form-label">Preço personalizado</label>
      <input id="customPriceInput" class="input" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" />
    </div>

    <div class="form-group">
      <label class="form-label">Cliente</label>
      <input id="saleClientInput" class="input" type="text" placeholder="Nome do cliente" />
    </div>

    <div class="form-group">
      <label class="form-label">Estado</label>
      <select id="saleStatusSelect" class="select">
        <option value="">Escolher...</option>
        <option value="Pago">Pago</option>
        <option value="Por pagar">Por pagar</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Pagamento</label>
      <select id="saleMethodSelect" class="select">
        <option value="">Escolher...</option>
        <option value="MB Way">MB Way</option>
        <option value="Cash">Cash</option>
      </select>
    </div>

    <div class="modal-actions">
      <button class="action-btn" data-close-modal="true">Cancelar</button>
      <button id="confirmSaleBtn" class="action-btn primary" data-busy-lock="true">Confirmar</button>
    </div>
  `);

  const priceSelect = document.getElementById("salePriceSelect");
  const customWrap = document.getElementById("customPriceWrap");

  priceSelect.addEventListener("change", () => {
    customWrap.classList.toggle("hidden", priceSelect.value !== "custom");
  });

  document.getElementById("confirmSaleBtn").addEventListener("click", async () => {
    if (state.submitting) return;

    const selectedPrice = document.getElementById("salePriceSelect").value;
    const customPrice = document.getElementById("customPriceInput")?.value?.trim() || "";
    const client = document.getElementById("saleClientInput").value.trim();
    const payment_status = document.getElementById("saleStatusSelect").value;
    const payment_method = document.getElementById("saleMethodSelect").value;

    let finalPrice = 0;

    if (!selectedPrice) {
      alertModal("Escolhe um preço.");
      return;
    }

    if (selectedPrice === "custom") {
      finalPrice = Number(customPrice.replace(",", "."));
      if (!customPrice || Number.isNaN(finalPrice) || finalPrice <= 0) {
        alertModal("Insere um preço personalizado válido.");
        return;
      }
    } else {
      finalPrice = Number(selectedPrice);
    }

    if (!client) {
      alertModal("O campo cliente é obrigatório.");
      return;
    }

    if (!payment_status) {
      alertModal("O estado é obrigatório.");
      return;
    }

    if (!payment_method) {
      alertModal("O método de pagamento é obrigatório.");
      return;
    }

    try {
      setSubmitting(true);

      await db.createSaleAndDecreaseStock({
        product_id: productId,
        price: finalPrice,
        client,
        sale_date: nowDateISO(),
        sale_time: nowTimeHHMMSS(),
        payment_status,
        payment_method
      });

      await db.recalculateBalances();
      await refreshCoreData();
      renderAll();
      closeModal();
    } catch (error) {
      alertModal(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  });
}

function withdrawModal(personName) {
  const balance = getBalanceByPerson(personName);

  openModal(`
    <div class="modal-top">
      <h2 class="modal-title">Levantar</h2>
      <button class="circle-btn" data-close-modal="true">✕</button>
    </div>

    <div class="info-grid">
      <div class="info-row">
        <div class="info-label">Pessoa</div>
        <div class="info-value">${escapeHtml(personName)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Saldo atual</div>
        <div class="info-value">${formatMoney(balance.current_balance)}</div>
      </div>
    </div>

    <div class="form-group" style="margin-top:14px;">
      <label class="form-label">Valor</label>
      <input id="withdrawValueInput" class="input" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" />
    </div>

    <div class="modal-actions">
      <button class="action-btn" data-close-modal="true">Cancelar</button>
      <button id="confirmWithdrawBtn" class="action-btn primary" data-busy-lock="true">Confirmar</button>
    </div>
  `);

  document.getElementById("confirmWithdrawBtn").addEventListener("click", async () => {
    if (state.submitting) return;

    const value = Number(document.getElementById("withdrawValueInput").value.replace(",", "."));

    if (Number.isNaN(value) || value <= 0) {
      alertModal("Insere um valor válido.");
      return;
    }

    const latestBalances = await db.getBalances();
    state.balances = latestBalances;
    const latestBalance = getBalanceByPerson(personName);

    if (value > Number(latestBalance.current_balance)) {
      alertModal("Saldo insuficiente.");
      return;
    }

    try {
      setSubmitting(true);
      await db.insertWithdrawal(personName, value);
      await db.recalculateBalances();
      await refreshCoreData();
      renderAll();
      closeModal();
    } catch (error) {
      alertModal(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  });
}

function saleInfoModal(saleId) {
  const sale = state.sales.find(s => Number(s.id) === Number(saleId));
  if (!sale) {
    alertModal("Venda não encontrada.");
    return;
  }

  const product = getProductById(sale.product_id);
  const image = product?.image_url || "https://placehold.co/120x120/png?text=?";

  openModal(`
    <div class="modal-top">
      <h2 class="modal-title">Info da venda</h2>
      <button class="circle-btn" data-close-modal="true">✕</button>
    </div>

    <div class="info-grid">
      <div class="info-row">
        <div class="info-label">Data</div>
        <div class="info-value">${formatDate(sale.sale_date)} · ${sale.sale_time}</div>
      </div>

      <div class="info-row">
        <div class="info-label">ID do produto</div>
        <div class="info-value">${sale.product_id}</div>
      </div>

      <div class="info-row">
        <div class="info-label">Foto do produto</div>
        <img class="info-photo" src="${image}" alt="Produto ${sale.product_id}" />
      </div>

      <div class="info-row">
        <div class="info-label">Preço</div>
        <div class="info-value">${formatMoney(sale.price)}</div>
      </div>

      <div class="info-row">
        <div class="info-label">Cliente</div>
        <div class="info-value">${escapeHtml(sale.client)}</div>
      </div>

      <div class="info-row">
        <div class="info-label">Estado de pagamento</div>
        <select id="saleStatusEdit" class="select">
          <option value="Pago" ${sale.payment_status === "Pago" ? "selected" : ""}>Pago</option>
          <option value="Por pagar" ${sale.payment_status === "Por pagar" ? "selected" : ""}>Por pagar</option>
        </select>
      </div>

      <div class="info-row">
        <div class="info-label">Método de pagamento</div>
        <div class="info-value">${escapeHtml(sale.payment_method)}</div>
      </div>

      <div class="info-row">
        <div class="info-label">Observações</div>
        <div class="info-value obs-preview" id="openObsEditor">${sale.observations ? escapeHtml(sale.observations) : "Toque para adicionar observações"}</div>
      </div>
    </div>
  `);

  document.getElementById("saleStatusEdit").addEventListener("change", async (e) => {
    try {
      await db.updateSaleStatus(sale.id, e.target.value);
      await db.recalculateBalances();
      await refreshCoreData();
      renderAll();
      saleInfoModal(sale.id);
    } catch (error) {
      alertModal(readErrorMessage(error));
    }
  });

  document.getElementById("openObsEditor").addEventListener("click", () => {
    observationEditorModal(sale);
  });
}

function observationEditorModal(sale) {
  openModal(`
    <div class="obs-editor-shell">
      <div class="obs-editor-top">
        <button class="circle-btn large" data-close-modal="true">✕</button>
        <div class="modal-title">Observações</div>
        <button class="circle-btn large" id="saveObsBtn" data-busy-lock="true">✔</button>
      </div>

      <textarea id="obsEditorText" class="textarea obs-editor" placeholder="Escreve aqui...">${escapeHtml(sale.observations || "")}</textarea>
    </div>
  `);

  document.getElementById("saveObsBtn").addEventListener("click", async () => {
    if (state.submitting) return;
    try {
      setSubmitting(true);
      const text = document.getElementById("obsEditorText").value;
      await db.updateSaleObservations(sale.id, text);
      await refreshCoreData();
      renderAll();
      closeModal();
      saleInfoModal(sale.id);
    } catch (error) {
      alertModal(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  });
}

function addAffiliateModal() {
  openModal(`
    <div class="modal-top">
      <h2 class="modal-title">Adicionar afiliado</h2>
      <button class="circle-btn" data-close-modal="true">✕</button>
    </div>

    <div class="form-group">
      <label class="form-label">Nome</label>
      <input id="affiliateNameInput" class="input" type="text" placeholder="Nome do afiliado" />
    </div>

    <div class="modal-actions">
      <button class="action-btn" data-close-modal="true">Cancelar</button>
      <button id="confirmAddAffiliateBtn" class="action-btn primary" data-busy-lock="true">Confirmar</button>
    </div>
  `);

  document.getElementById("confirmAddAffiliateBtn").addEventListener("click", async () => {
    if (state.submitting) return;

    const name = document.getElementById("affiliateNameInput").value.trim();
    if (!name) {
      alertModal("O nome é obrigatório.");
      return;
    }

    const duplicate = state.affiliates.some(a => a.name.trim().toLowerCase() === name.toLowerCase());
    if (duplicate) {
      alertModal("Já existe um afiliado com esse nome.");
      return;
    }

    try {
      setSubmitting(true);
      await db.addAffiliate(name, APP_CONFIG.DEFAULT_AFFILIATE_IMAGE);
      await refreshCoreData();
      renderAll();
      closeModal();
    } catch (error) {
      alertModal(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  });
}

async function increaseStock(productId) {
  try {
    await db.increaseStock(productId);
    await refreshCoreData();
    renderAll();
  } catch (error) {
    alertModal(readErrorMessage(error));
  }
}

async function changeAffiliateCount(id, delta) {
  try {
    await db.changeAffiliateSalesCount(id, delta);
    await refreshCoreData();
    renderAll();
  } catch (error) {
    alertModal(readErrorMessage(error));
  }
}

function exportCSV() {
  if (!state.sales.length) {
    alertModal("Não existem vendas para exportar.");
    return;
  }

  const rows = [
    [
      "id",
      "product_id",
      "price",
      "client",
      "sale_date",
      "sale_time",
      "payment_status",
      "payment_method",
      "observations"
    ]
  ];

  state.sales.forEach(sale => {
    rows.push([
      sale.id,
      sale.product_id,
      sale.price,
      sale.client,
      sale.sale_date,
      sale.sale_time,
      sale.payment_status,
      sale.payment_method,
      (sale.observations || "").replace(/\n/g, " ")
    ]);
  });

  const csv = rows
    .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vendas_${nowDateISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function bindEvents() {
  el.bottomBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-btn");
    if (!btn) return;
    showPage(btn.dataset.page);
  });

  el.productsList.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    const id = Number(button.dataset.id);

    if (action === "increase-stock") increaseStock(id);
    if (action === "open-sale") saleModal(id);
  });

  el.affiliatesList.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    const id = Number(target.dataset.id);

    if (action === "open-add-affiliate") {
      addAffiliateModal();
      return;
    }

    if (action === "affiliate-plus") {
      changeAffiliateCount(id, 1);
      return;
    }

    if (action === "affiliate-minus") {
      changeAffiliateCount(id, -1);
      return;
    }

    if (action === "affiliate-remove") {
      const affiliate = state.affiliates.find(a => Number(a.id) === id);
      if (!affiliate) return;

      confirmModal(`Remover permanentemente "${affiliate.name}"?`, async () => {
        await db.removeAffiliate(id);
        await refreshCoreData();
        renderAll();
      }, "Remover afiliado");
    }
  });

  el.balancesTop.addEventListener("click", (e) => {
    const card = e.target.closest("[data-action='open-withdraw']");
    if (!card) return;
    withdrawModal(card.dataset.person);
  });

  el.salesList.addEventListener("click", async (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    const id = Number(target.dataset.id);

    if (action === "open-sale-info") {
      saleInfoModal(id);
      return;
    }

    if (action === "load-more-sales") {
      state.salesVisible += 20;
      state.sales = await db.getSales(state.salesVisible, 0);
      renderSales();
    }
  });

  el.modalOverlay.addEventListener("click", (e) => {
    if (e.target === el.modalOverlay || e.target.closest("[data-close-modal='true']")) {
      closeModal();
    }
  });

  el.exportCsvBtn.addEventListener("click", exportCSV);
}

async function initApp() {
  try {
    await db.syncProducts(APP_CONFIG.PRODUCTS);
    await refreshCoreData();
    renderAll();
    bindEvents();
    showPage("home");
  } catch (error) {
    alertModal(readErrorMessage(error), "Erro ao iniciar");
  }
}

document.addEventListener("DOMContentLoaded", initApp);

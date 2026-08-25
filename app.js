const SUPABASE_URL = "https://ygulvirkzwvdyfgqsbjj.supabase.co";
;
const SUPABASE_ANON_KEY = "sb_publishable_2u7B7_ZvZuKc-e3UPxx3rg_5oEN83x5";

const fallbackProducts = [
  { id: 42, name: "RETATRUTIDA UTHER 60 MG", price: 238.19, stock: 0 },
  { id: 45, name: "TIRZEPATIDA UTHER 60 MG", price: 181.49, stock: 0 }
];

let products = [];
let cart = {};

const fmt = v =>
  Number(v).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

async function api(path, options = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
    { ...options, headers }
  );

  if (!r.ok) {
    throw new Error(await r.text());
  }

  if (r.status === 204) return null;

  return r.json();
}

async function loadProducts() {
  try {
    const rows = await api(
    "products?select=id,nameName,price_brl,stock_available&id=in.(42,45)&order=id.asc"
    );

    products = rows.map(r => ({
      id: r.id,
      name: r.nameName,
      price: Number(r.price_brl),
      stock: Number(r.stock_available ?? 0)
    }));

    if (!products.length) {
      throw new Error("Nenhum produto encontrado");
    }
  } catch (e) {console.error("ERRO SUPABASE:", e);
    products = fallbackProducts;

    const status = document.getElementById("status");
    if (status) {
      status.textContent =
        "Não foi possível atualizar os produtos.";
    }
  }

  renderProducts();
}

function renderProducts() {
  const el = document.getElementById("products");
  if (!el) return;

  el.innerHTML = "";

  products.forEach(p => {
    const q = cart[p.id]?.draft || 1;

    const card = document.createElement("article");
    card.className = "card";

    card.innerHTML = `
      <span class="badge">UTHER</span>
      <h3>${p.name}</h3>
      <div class="price">${fmt(p.price)}</div>
      <div class="stock">
        Disponível: <span>${p.stock}</span>
      </div>

      <div class="qty">
        <button type="button" data-act="minus">−</button>
        <span>${q}</span>
        <button type="button" data-act="plus">+</button>
      </div>

      <button class="add" type="button"
        ${p.stock <= 0 ? "disabled" : ""}>
        Adicionar
      </button>
    `;

    card.querySelector('[data-act="minus"]').onclick = () => {
      const atual = cart[p.id]?.draft || 1;

      cart[p.id] = {
        ...(cart[p.id] || {}),
        draft: Math.max(1, atual - 1)
      };

      renderProducts();
    };

    card.querySelector('[data-act="plus"]').onclick = () => {
      const atual = cart[p.id]?.draft || 1;

      cart[p.id] = {
        ...(cart[p.id] || {}),
        draft: Math.min(p.stock, atual + 1)
      };

      renderProducts();
    };

    card.querySelector(".add").onclick = () => {
      const atual = cart[p.id]?.qty || 0;
      const quantidade = cart[p.id]?.draft || 1;

      cart[p.id] = {
        qty: Math.min(p.stock, atual + quantidade),
        draft: 1
      };

      renderProducts();
      renderCart();
    };

    el.appendChild(card);
  });
}

function renderCart() {
  const rows = products.filter(
    p => cart[p.id]?.qty > 0
  );

  const box = document.getElementById("cartItems");

  if (box) {
    if (!rows.length) {
      box.innerHTML = "<p>Nenhum item adicionado.</p>";
    } else {
      box.innerHTML = rows.map(p => `
        <div class="cart-row">
          <span>${p.name}</span>
          <strong>
            ${cart[p.id].qty} × ${fmt(p.price)}
          </strong>
        </div>
      `).join("");
    }
  }

  const subtotal = rows.reduce(
    (s, p) => s + p.price * cart[p.id].qty,
    0
  );

  const subtotalEl = document.getElementById("subtotal");
  const totalEl = document.getElementById("total");
  const finish = document.getElementById("finish");

  if (subtotalEl) subtotalEl.textContent = fmt(subtotal);
  if (totalEl) totalEl.textContent = fmt(subtotal + 50);
  if (finish) finish.disabled = rows.length === 0;
}

const finishButton = document.getElementById("finish");

if (finishButton) {
  finishButton.onclick = async () => {
    const status = document.getElementById("status");

    const customerName =
      document.getElementById("customerName").value.trim();

    const customerPhone =
      document.getElementById("customerPhone").value.trim();

    const customerEmail =
      document.getElementById("customerEmail").value.trim();

    const customerCep =
      document.getElementById("customerCep").value.trim();

    const customerAddress =
      document.getElementById("customerAddress").value.trim();

    const customerCity =
      document.getElementById("customerCity").value.trim();

    const customerState =
      document.getElementById("customerState").value.trim();

    if (
      !customerName ||
      !customerPhone ||
      !customerCep ||
      !customerAddress ||
      !customerCity ||
      !customerState
    ) {
      status.className = "status error";
      status.textContent =
        "Preencha todos os campos obrigatórios.";
      return;
    }

    const rows = products.filter(
      p => cart[p.id]?.qty > 0
    );

    if (!rows.length) return;

    const subtotal = rows.reduce(
      (s, p) => s + p.price * cart[p.id].qty,
      0
    );

    finishButton.disabled = true;
    status.textContent = "Confirmando pedido...";

    try {
      await api("orders", {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_cep: customerCep,
          customer_address:
            `${customerAddress} - ${customerCity}/${customerState}` +
            (customerEmail ? ` - ${customerEmail}` : ""),
          freight: 0,
          total: subtotal + 50,
          status: "novo"
        })
      });

      for (const p of rows) {
        await api("rpc/decrement_stock", {
          method: "POST",
          body: JSON.stringify({
            p_product_id: p.id,
            p_quantity: cart[p.id].qty
          })
        });
      }

      status.className = "status ok";
      status.textContent =
        "Pedido confirmado com sucesso!";

      cart = {};

      renderCart();
      await loadProducts();

    } catch (e) {
      status.className = "status error";
      status.textContent =
        "Erro ao confirmar pedido: " + e.message;

    } finally {
      finishButton.disabled = false;
    }
  };
}

loadProducts();
renderCart();

// LOGIN DO CLIENTE
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const message = document.getElementById("loginMessage");

    message.textContent = "Entrando...";

    try {
      const response = await fetch(
        `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: email,
            password: password
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_description || data.msg || "E-mail ou senha inválidos");
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user_id", data.user.id);
      localStorage.setItem("user_email", data.user.email);

      message.textContent = "Login realizado com sucesso!";
      window.location.href = "index.html";

    } catch (error) {
      message.textContent = "Erro: " + error.message;
    }
  });
}

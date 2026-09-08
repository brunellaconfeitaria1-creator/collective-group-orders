const SUPABASE_URL = "https://ygulvirkzwvdyfgqsbjj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_2u7B7_ZvZuKc-e3UPxx3rg_5oEN83x5";

/* PRÓXIMO PAGAMENTO POR AMPOLA */
const NEXT_PAYMENT_BRL = 70.20;

const fallbackProducts = [
  {
    id: 42,
    name: "RETATRUTIDA UTHER 60 MG",
    price: 238.19,
    nextPayment: NEXT_PAYMENT_BRL,
    stock: 0
  },
  {
    id: 45,
    name: "TIRZEPATIDA UTHER 60 MG",
    price: 181.49,
    nextPayment: NEXT_PAYMENT_BRL,
    stock: 0
  }
];

let products = [];
let cart = {};

const fmt = v =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

async function api(path, options = {}) {
  const accessToken =
    localStorage.getItem("access_token") ||
    SUPABASE_ANON_KEY;

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
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

  const text = await r.text();

  return text ? JSON.parse(text) : null;
}

/* =========================
   PRODUTOS
========================= */

async function loadProducts() {
  try {
    const rows = await api(
      "products?select=id,nameName,price_brl,next_payment_brl,stock_available&id=in.(42,45)&order=id.asc"
    );

    products = rows.map(r => ({
      id: r.id,
      name: r.nameName,
      price: Number(r.price_brl || 0),

      /* SEMPRE R$ 70,20 */
      nextPayment: NEXT_PAYMENT_BRL,

      stock: Number(r.stock_available ?? 0)
    }));

    if (!products.length) {
      throw new Error("Nenhum produto encontrado");
    }

  } catch (e) {
    console.error("ERRO SUPABASE:", e);

    products = fallbackProducts;

    const status = document.getElementById("status");

    if (status) {
      status.textContent =
        "Não foi possível atualizar os produtos.";
    }
  }

  renderProducts();
  renderCart();
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

      <div class="price">
        ${fmt(p.price)}
      </div>

      <div style="
        margin-top:8px;
        padding:10px;
        border-radius:10px;
        background:#101828;
      ">
        <small>Próximo pagamento por unidade</small>
        <br>
        <strong style="font-size:18px">
          ${fmt(NEXT_PAYMENT_BRL)}
        </strong>
      </div>

      <div class="stock">
        Disponível:
        <span>${p.stock}</span>
      </div>

      <div class="qty">

        <button
          type="button"
          data-act="minus"
        >
          −
        </button>

        <span>${q}</span>

        <button
          type="button"
          data-act="plus"
        >
          +
        </button>

      </div>

      <button
        class="add"
        type="button"
        ${p.stock <= 0 ? "disabled" : ""}
      >
        Adicionar
      </button>
    `;

    card.querySelector(
      '[data-act="minus"]'
    ).onclick = () => {

      const atual =
        cart[p.id]?.draft || 1;

      cart[p.id] = {
        ...(cart[p.id] || {}),
        draft: Math.max(
          1,
          atual - 1
        )
      };

      renderProducts();
    };

    card.querySelector(
      '[data-act="plus"]'
    ).onclick = () => {

      const atual =
        cart[p.id]?.draft || 1;

      cart[p.id] = {
        ...(cart[p.id] || {}),
        draft: Math.min(
          p.stock,
          atual + 1
        )
      };

      renderProducts();
    };

    card.querySelector(
      ".add"
    ).onclick = () => {

      const atual =
        cart[p.id]?.qty || 0;

      const quantidade =
        cart[p.id]?.draft || 1;

      cart[p.id] = {
        qty: Math.min(
          p.stock,
          atual + quantidade
        ),
        draft: 1
      };

      renderProducts();
      renderCart();
    };

    el.appendChild(card);
  });
}

/* =========================
   CARRINHO
========================= */

function renderCart() {
  const rows = products.filter(
    p => cart[p.id]?.qty > 0
  );

  const box =
    document.getElementById(
      "cartItems"
    );

  if (box) {

    if (!rows.length) {

      box.innerHTML =
        "<p>Nenhum item adicionado.</p>";

    } else {

      box.innerHTML =
        rows.map(p => {

          const qty =
            cart[p.id].qty;

          const nextTotal =
            NEXT_PAYMENT_BRL * qty;

          return `
            <div class="cart-row">

              <span>
                ${p.name}
              </span>

              <strong>
                ${qty} × ${fmt(p.price)}
              </strong>

              <div style="
                width:100%;
                margin-top:5px;
                font-size:13px;
              ">
                Próximo pagamento:
                <strong>
                  ${qty} × ${fmt(NEXT_PAYMENT_BRL)}
                  = ${fmt(nextTotal)}
                </strong>
              </div>

            </div>
          `;

        }).join("");
    }
  }

  const subtotal = rows.reduce(
    (s, p) =>
      s +
      p.price *
      cart[p.id].qty,
    0
  );

  const nextPaymentTotal =
    rows.reduce(
      (s, p) =>
        s +
        NEXT_PAYMENT_BRL *
        cart[p.id].qty,
      0
    );

  const subtotalEl =
    document.getElementById(
      "subtotal"
    );

  const totalEl =
    document.getElementById(
      "total"
    );

  const finish =
    document.getElementById(
      "finish"
    );

  if (subtotalEl) {
    subtotalEl.textContent =
      fmt(subtotal);
  }

  /*
    Mantém o total atual
    como já funcionava antes:
    pagamento atual + taxa R$ 50
  */
  if (totalEl) {
    totalEl.textContent =
      fmt(subtotal + 50);
  }

  /*
    Se existir um campo com
    id="nextPayment" no HTML,
    mostra o próximo pagamento.
  */
  const nextPaymentEl =
    document.getElementById(
      "nextPayment"
    );

  if (nextPaymentEl) {
    nextPaymentEl.textContent =
      fmt(nextPaymentTotal);
  }

  if (finish) {
    finish.disabled =
      rows.length === 0;
  }
}

/* =========================
   FINALIZAR PEDIDO
========================= */

const finishButton =
  document.getElementById(
    "finish"
  );

if (finishButton) {

  finishButton.onclick =
    async () => {

      const status =
        document.getElementById(
          "status"
        );

      const customerName =
        document.getElementById(
          "customerName"
        ).value.trim();

      const customerPhone =
        document.getElementById(
          "customerPhone"
        ).value.trim();

      const customerEmail =
        document.getElementById(
          "customerEmail"
        ).value.trim();

      const customerCep =
        document.getElementById(
          "customerCep"
        ).value.trim();

      const customerAddress =
        document.getElementById(
          "customerAddress"
        ).value.trim();

      const customerCity =
        document.getElementById(
          "customerCity"
        ).value.trim();

      const customerState =
        document.getElementById(
          "customerState"
        ).value.trim();

      if (
        !customerName ||
        !customerPhone ||
        !customerCep ||
        !customerAddress ||
        !customerCity ||
        !customerState
      ) {

        status.className =
          "status error";

        status.textContent =
          "Preencha todos os campos obrigatórios.";

        return;
      }

      const rows =
        products.filter(
          p =>
            cart[p.id]?.qty > 0
        );

      if (!rows.length) return;

      const subtotal =
        rows.reduce(
          (s, p) =>
            s +
            p.price *
            cart[p.id].qty,
          0
        );

      /*
        Próximo pagamento:
        R$ 70,20 por unidade
      */
      const nextPaymentTotal =
        rows.reduce(
          (s, p) =>
            s +
            NEXT_PAYMENT_BRL *
            cart[p.id].qty,
          0
        );

      finishButton.disabled = true;

      status.textContent =
        "Confirmando pedido...";

      try {

        await api("orders", {

          method: "POST",

          headers: {
            Prefer:
              "return=representation"
          },

          body: JSON.stringify({

            customer_name:
              customerName,

            customer_phone:
              customerPhone,

            customer_email:
              customerEmail || null,

            customer_cep:
              customerCep,

            customer_address:
              `${customerAddress} - ${customerCity}/${customerState}`,

            freight: 0,

            /*
              Mantém total anterior
              do pagamento atual + taxa
            */
            total:
              subtotal + 50,

            status: "novo",

            user_id:
              localStorage.getItem(
                "user_id"
              ),

            /*
              PRÓXIMO PAGAMENTO
            */
            next_payment_brl:
              Number(
                nextPaymentTotal.toFixed(2)
              ),

            admin_fee_brl: 50,

            freight_note:
              "Frete à parte",

            items:
              rows.map(p => ({

                product_id:
                  p.id,

                name:
                  p.name,

                quantity:
                  cart[p.id].qty,

                price:
                  p.price,

                /*
                  R$ 70,20
                  EM TODAS AS UNIDADES
                */
                unit_next_brl:
                  NEXT_PAYMENT_BRL

              }))

          })

        });

        for (const p of rows) {

          await api(
            "rpc/decrement_stock",
            {

              method: "POST",

              body:
                JSON.stringify({

                  p_product_id:
                    p.id,

                  p_quantity:
                    cart[p.id].qty

                })

            }
          );
        }

        status.className =
          "status ok";

        status.textContent =
          "Pedido confirmado com sucesso!";

        cart = {};

        renderCart();

        await loadProducts();

      } catch (e) {

        console.error(e);

        status.className =
          "status error";

        status.textContent =
          "Erro ao confirmar pedido: " +
          e.message;

      } finally {

        finishButton.disabled =
          false;
      }
    };
}

/* =========================
   LOGIN DO CLIENTE
========================= */

const loginForm =
  document.getElementById(
    "loginForm"
  );

if (loginForm) {

  loginForm.addEventListener(
    "submit",
    async e => {

      e.preventDefault();

      const email =
        document.getElementById(
          "email"
        ).value.trim();

      const password =
        document.getElementById(
          "password"
        ).value;

      const message =
        document.getElementById(
          "loginMessage"
        );

      message.textContent =
        "Entrando...";

      try {

        const response =
          await fetch(

            `${SUPABASE_URL}/auth/v1/token?grant_type=password`,

            {

              method: "POST",

              headers: {

                apikey:
                  SUPABASE_ANON_KEY,

                "Content-Type":
                  "application/json"

              },

              body:
                JSON.stringify({
                  email,
                  password
                })

            }
          );

        const data =
          await response.json();

        if (!response.ok) {

          throw new Error(
            data.error_description ||
            data.msg ||
            "E-mail ou senha inválidos"
          );
        }

        localStorage.setItem(
          "access_token",
          data.access_token
        );

        localStorage.setItem(
          "user_id",
          data.user.id
        );

        localStorage.setItem(
          "user_email",
          data.user.email
        );

        localStorage.setItem(
          "user_name",
          data.user.user_metadata
            ?.nome ||
          data.user.email
            .split("@")[0]
        );

        message.textContent =
          "Login realizado com sucesso!";

        window.location.href =
          "index.html";

      } catch (error) {

        message.textContent =
          "Erro: " +
          error.message;
      }
    }
  );
}

/* =========================
   MEUS PEDIDOS
========================= */

async function loadMyOrders() {

  const ordersList =
    document.getElementById(
      "ordersList"
    );

  if (!ordersList) return;

  const userId =
    localStorage.getItem(
      "user_id"
    );

  if (!userId) {

    window.location.href =
      "login.html";

    return;
  }

  try {

    const orders =
      await api(
        `orders?user_id=eq.${userId}&select=*&order=created_at.desc`
      );

    if (!orders.length) {

      ordersList.innerHTML =
        "<p>Você ainda não possui pedidos.</p>";

      return;
    }

    ordersList.innerHTML =
      orders.map(order => `

        <div class="card">

          <h3>
            Pedido #${order.id}
          </h3>

          <p>
            <strong>Data:</strong>
            ${new Date(
              order.created_at
            ).toLocaleString(
              "pt-BR"
            )}
          </p>

          <p>
            <strong>
              Total:
            </strong>
            ${fmt(order.total)}
          </p>

          <p>
            <strong>
              Próximo pagamento:
            </strong>
            ${fmt(
              order.next_payment_brl ||
              0
            )}
          </p>

          <p>
            <strong>
              Próximo pagamento por unidade:
            </strong>
            ${fmt(
              NEXT_PAYMENT_BRL
            )}
          </p>

          <p>
            <strong>Status:</strong>
            ${order.status || "novo"}
          </p>

        </div>

      `).join("");

  } catch (error) {

    ordersList.innerHTML =
      "<p>Não foi possível carregar seus pedidos.</p>";

    console.error(error);
  }
}

loadMyOrders();

/* =========================
   ADMIN
========================= */

async function loadAdminOrders() {

  const adminList =
    document.getElementById(
      "adminOrdersList"
    );

  if (!adminList) return;

  const ADMIN_EMAIL =
    "nuuna102@gmail.com";

  const userEmail =
    localStorage.getItem(
      "user_email"
    );

  if (
    !userEmail ||
    userEmail.toLowerCase() !==
    ADMIN_EMAIL.toLowerCase()
  ) {

    alert(
      "Acesso permitido somente para administradora."
    );

    window.location.href =
      "index.html";

    return;
  }

  try {

    const orders =
      await api(
        "orders?select=*&order=created_at.desc"
      );

    if (!orders.length) {

      adminList.innerHTML =
        "<p>Nenhum pedido encontrado.</p>";

      return;
    }

    adminList.innerHTML =
      orders.map(order => `

        <div class="card">

          <h3>
            Pedido #${order.id}
          </h3>

          <p>
            <strong>Cliente:</strong>
            ${order.customer_name || "-"}
          </p>

          <p>
            <strong>Telefone:</strong>
            ${order.customer_phone || "-"}
          </p>

          <p>
            <strong>Data:</strong>
            ${new Date(
              order.created_at
            ).toLocaleString(
              "pt-BR"
            )}
          </p>

          <p>
            <strong>Total:</strong>
            ${fmt(order.total)}
          </p>

          <p>
            <strong>
              Próximo pagamento:
            </strong>
            ${fmt(
              order.next_payment_brl ||
              0
            )}
          </p>

          <p>
            <strong>
              Valor por unidade:
            </strong>
            ${fmt(
              NEXT_PAYMENT_BRL
            )}
          </p>

          <p>
            <strong>Status:</strong>
            ${order.status || "novo"}
          </p>

        </div>

      `).join("");

  } catch (error) {

    adminList.innerHTML =
      "<p>Não foi possível carregar os pedidos.</p>";

    console.error(error);
  }
}

loadAdminOrders();

/* =========================
   CADASTRO DO CLIENTE
========================= */

const cadastroForm =
  document.getElementById(
    "cadastroForm"
  );

if (cadastroForm) {

  cadastroForm.addEventListener(
    "submit",
    async function (e) {

      e.preventDefault();

      const nome =
        document.getElementById(
          "name"
        ).value.trim();

      const email =
        document.getElementById(
          "email"
        ).value.trim();

      const password =
        document.getElementById(
          "password"
        ).value;

      const message =
        document.getElementById(
          "cadastroMessage"
        );

      message.textContent =
        "Criando cadastro...";

      try {

        const response =
          await fetch(
            `${SUPABASE_URL}/auth/v1/signup`,
            {

              method: "POST",

              headers: {

                apikey:
                  SUPABASE_ANON_KEY,

                "Content-Type":
                  "application/json"

              },

              body:
                JSON.stringify({

                  email,
                  password,

                  data: {
                    nome
                  }

                })

            }
          );

        const data =
          await response.json();

        if (!response.ok) {

          throw new Error(
            data.msg ||
            data.message ||
            data.error_description ||
            "Não foi possível criar o cadastro."
          );
        }

        message.textContent =
          "Cadastro criado com sucesso!";

        setTimeout(
          function () {

            window.location.href =
              "login.html";

          },
          1500
        );

      } catch (error) {

        message.textContent =
          "Erro: " +
          error.message;
      }
    }
  );
}

/* =========================
   INICIALIZAÇÃO
========================= */

loadProducts();
renderCart();

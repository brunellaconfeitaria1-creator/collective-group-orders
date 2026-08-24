const SUPABASE_URL = "https://ygulvirkzwvdyfgqsbjj.supabase.co";
const SUPABASE_ANON_KEY ="sb_publishable_2u7B7_ZvZuKc-e3UPxx3rg_5oEN83x5";

const fallbackProducts = [
  { id: 42, name: "RETATRUTIDA UTHER 60 MG", price: 238.19, stock: 200 },
  { id: 45, name: "TIRZEPATIDA UTHER 60 MG", price: 181.49, stock: 200 }
];

let products = [];
let cart = {};
const fmt = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

async function api(path, options={}) {
  if (SUPABASE_ANON_KEY.includes("COLE_AQUI")) throw new Error("Supabase ainda não configurado");
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type":"application/json",
    ...(options.headers||{})
  };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {...options, headers});
  if (!r.ok) throw new Error(await r.text());
  if (r.status === 204) return null;
  return r.json();
}

async function loadProducts() {
  try {
    const rows = await api('products?select=id,nameName,price_brl,stock_available&or=(id.eq.42,id.eq.45)&order=id');
    products = rows.map(r => ({
      id:r.id, name:r.nameName, price:Number(r.price_brl), stock:Number(r.stock_available)
    }));
    if (!products.length) throw new Error("Produtos não encontrados");
  } catch(e) {
    products = fallbackProducts;
    document.getElementById("status").textContent =
      "Prévia local: falta configurar a chave pública do Supabase para o estoque sincronizar.";
  }
  renderProducts();
}

function renderProducts(){
  const el=document.getElementById("products");
  el.innerHTML="";
  products.forEach(p=>{
    const q=cart[p.id]?.draft||1;
    const card=document.createElement("article");
    card.className="card";
    card.innerHTML=`<span class="badge">UTHER</span>
      <h3>${p.name}</h3>
      <div class="price">${fmt(p.price)}</div>
      <div class="stock">Disponível: <span>${p.stock}</span> unidades</div>
      <div class="qty"><button data-act="minus">−</button><strong>${q}</strong><button data-act="plus">+</button></div>
      <button class="add" ${p.stock<=0?"disabled":""}>${p.stock<=0?"Esgotado":"Adicionar ao carrinho"}</button>`;
    card.querySelector('[data-act="minus"]').onclick=()=>{cart[p.id]={...(cart[p.id]||{}),draft:Math.max(1,q-1)};renderProducts()};
    card.querySelector('[data-act="plus"]').onclick=()=>{cart[p.id]={...(cart[p.id]||{}),draft:Math.min(p.stock,q+1)};renderProducts()};
    card.querySelector(".add").onclick=()=>{
      const current=cart[p.id]?.qty||0;
      const draft=cart[p.id]?.draft||1;
      cart[p.id]={qty:Math.min(p.stock,current+draft),draft:1};
      renderProducts(); renderCart();
    };
    el.appendChild(card);
  });
}

function renderCart(){
  const rows=products.filter(p=>cart[p.id]?.qty);
  const box=document.getElementById("cartItems");
  if(!rows.length) box.innerHTML="<p>Nenhum produto adicionado.</p>";
  else box.innerHTML=rows.map(p=>`<div class="cart-row"><span>${p.name} × ${cart[p.id].qty}</span><strong>${fmt(p.price*cart[p.id].qty)}</strong></div>`).join("");
  const subtotal=rows.reduce((s,p)=>s+p.price*cart[p.id].qty,0);
  document.getElementById("subtotal").textContent=fmt(subtotal);
  document.getElementById("total").textContent=fmt(subtotal+50);
  document.getElementById("finish").disabled=!rows.length;
}

document.getElementById("finish").onclick=async()=>{
  const btn=document.getElementById("finish"), status=document.getElementById("status");
  btn.disabled=true; status.textContent="Confirmando pedido...";
  try{
    // Atualização otimista simples. Para produção com muitos compradores simultâneos,
    // recomenda-se trocar por uma função SQL/RPC atômica no Supabase.
    for(const p of products.filter(x=>cart[x.id]?.qty)){
      const fresh=(await api(`products?id=eq.${p.id}&select=stock_available`))[0];
      const qty=cart[p.id].qty, available=Number(fresh.stock_available);
      if(qty>available) throw new Error(`Estoque insuficiente para ${p.name}. Restam ${available}.`);
      await api(`products?id=eq.${p.id}`,{
        method:"PATCH",
        headers:{Prefer:"return=minimal"},
        body:JSON.stringify({stock_available:available-qty})
      });
    }
    status.className="status ok"; status.textContent="Pedido confirmado. O estoque foi atualizado.";
    cart={}; renderCart(); await loadProducts();
  }catch(e){
    status.className="status error"; status.textContent="Não foi possível confirmar: "+e.message;
  }finally{btn.disabled=false}
};

loadProducts(); renderCart();

// Cliente compartilhado pelas 3 telas. O estado vive no servidor (server.py);
// aqui só buscamos (a cada 1s) e enviamos ações.
let CARDAPIO = [];
let estado = { pedidos: [], proximo: 1, v: -1 };
let aoAtualizar = () => {};
let primeira = true;

const R = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const item = id => CARDAPIO.find(c => c.id === id);
const load = () => estado;

function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

function setOnline(ok) {
  const c = document.getElementById('conexao');
  if (!c) return;
  c.textContent = ok ? '● online' : '● sem conexão';
  c.className = ok ? '' : 'off';
}

async function api(url, body) {
  const r = await fetch(url, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return r.json();
}

async function atualizar() {
  try {
    if (!CARDAPIO.length) CARDAPIO = await (await fetch('/cardapio.json')).json();
    const e = await api('/api/estado?v=' + estado.v);
    setOnline(true);
    if (e.mudou === false) {
      if (primeira) { primeira = false; aoAtualizar(); }
    } else { primeira = false; estado = e; aoAtualizar(); }
  } catch { setOnline(false); }
}

function iniciar(fn) {
  aoAtualizar = fn;
  atualizar();
  setInterval(atualizar, 1000);
}

async function acao(url, corpo) {
  try {
    const r = await api(url, corpo);
    if (r.estado) { estado = r.estado; aoAtualizar(); }
    return r;
  } catch {
    setOnline(false);
    return { erro: 'Sem conexão com o servidor. A ação NÃO foi registrada.' };
  }
}

// O estoque é DERIVADO dos pedidos: cancelar um pedido devolve o estoque sozinho.
function vendidos(s) {
  const v = {};
  s.pedidos.filter(p => p.status !== 'cancelado')
    .forEach(p => p.itens.forEach(i => v[i.id] = (v[i.id] || 0) + i.qtd));
  return v;
}
function restante(s, it) {
  return it.estoque == null ? Infinity : it.estoque - (vendidos(s)[it.id] || 0);
}

const criarPedido = itens => acao('/api/pedido', { itens });
const mudarStatus = (num, status) => acao('/api/status', { num, status });
const zerarEvento = () => acao('/api/zerar', {});

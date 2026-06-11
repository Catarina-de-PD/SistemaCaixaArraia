const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbyM7n9yHHNICx-8qmLD4eeupz-aaVAqW0aj6g9ztmAx73N4rLX6KO17GCDj-2wD-7-fzA/exec"; 

const produtos = [
    { id: 1, nome: "Cachorro Quente", preco: 6.0, imagem: "images/cachorroQuente.png" },
    { id: 2, nome: "Cachorro Quente Vegetariano", preco: 6.0, imagem: "images/cachorroQuenteVeg.png" },
    { id: 3, nome: "Milho Cozido", preco: 5.0, imagem: "images/milho.png"},
    { id: 4, nome: "Pipoca", preco: 2.0, imagem: "images/pipoca.png"},
    { id: 5, nome: "Caldo", preco: 8.0, imagem: "images/caldo.png"},
    { id: 6, nome: "Amendoim", preco: 2.0, imagem: "images/amendoim.png"},
    
    { id: 7, nome: "Bolo de Cenoura", preco: 5.0, imagem: "images/boloCenoura.png"},
    { id: 8, nome: "Bolo de Fubá", preco: 5.0, imagem: "images/boloFuba.png"},
    { id: 9, nome: "Bolo de Milho", preco: 5.0, imagem: "images/boloMilho.png"},
    { id: 10, nome: "Canjica", preco: 8.0, imagem: "images/canjica.png"},
    { id: 11, nome: "Maçã do Amor", preco: 10.0, imagem: "images/macaAmor.png"},
    { id: 12, nome: "Paçoca", preco: 1.0, imagem: "images/pacoca.png"},

    { id: 13, nome: "Refrigerante", preco: 5.0, imagem: "images/refrigerante.png"},
    { id: 14, nome: "Suco", preco: 5.0, imagem: "images/suco.png"},
    { id: 15, nome: "Quentão", preco: 6.0, imagem: "images/quentao.png"},
    { id: 16, nome: "Chocolate Quente", preco: 6.0, imagem: "images/chocolateQuente.png"},
];


let carrinho = [];
function renderizarProdutos(lista = produtos) {
    const grade = document.getElementById('gradeProdutos');
    const template = document.getElementById('produtoTemplate');
    if (!grade || !template) return;
    grade.innerHTML = '';

    lista.forEach(item => {
        const clone = template.content.cloneNode(true);
        clone.querySelector('.nomeProduto').textContent = item.nome;
        clone.querySelector('.precoProduto').textContent = `R$ ${item.preco.toFixed(2).replace('.', ',')}`;
        
        const imgElement = clone.querySelector('.cardImagem');
        imgElement.src = item.imagem;
        imgElement.alt = item.nome;

        clone.querySelector('.botaoAdicionar').onclick = () => adicionarAoCarrinho(item.id);
        grade.appendChild(clone);
    });
}

function atualizarInterface() {
    const listaHTML = document.getElementById('listaCarrinho');
    const totalHTML = document.getElementById('valorTotal');
    const badge = document.getElementById('cartBadge');
    
    if (!listaHTML || !totalHTML) return;
    
    listaHTML.innerHTML = '';
    let somaTotal = 0;
    let totalItens = 0;

    carrinho.forEach(item => {
        const subtotal = item.preco * item.qtd;
        somaTotal += subtotal;
        totalItens += item.qtd;

        listaHTML.innerHTML += `
            <div class="linhaPedido">
                <div class="pedidoInfo">
                    <span class="pedidoNome">${item.qtd}x ${item.nome}</span>
                    <span class="pedidoSubtotal">R$ ${subtotal.toFixed(2).replace('.', ',')}</span>
                </div>
                <div class="controlesQuantidade">
                    <button class="btnCircular" onclick="alterarQtd(${item.id}, -1)">-</button>
                    <span class="numQtd">${item.qtd}</span>
                    <button class="btnCircular" onclick="alterarQtd(${item.id}, 1)">+</button>
                </div>
            </div>`;
    });

    totalHTML.textContent = `R$ ${somaTotal.toFixed(2).replace('.', ',')}`;
    if (badge) badge.textContent = totalItens;
}

function adicionarAoCarrinho(id) {
    const produto = produtos.find(p => p.id === id);
    const itemNoCarrinho = carrinho.find(item => item.id === id);
    itemNoCarrinho ? itemNoCarrinho.qtd++ : carrinho.push({ ...produto, qtd: 1 });
    atualizarInterface();
}

function alterarQtd(id, delta) {
    const item = carrinho.find(i => i.id === id);
    if (item) {
        item.qtd += delta;
        if (item.qtd <= 0) carrinho = carrinho.filter(i => i.id !== id);
    }
    atualizarInterface();
}

function limparCarrinho() {
    if(confirm("Limpar pedido?")) {
        carrinho = [];
        atualizarInterface();
    }
}

function finalizarPedido() {

    if (carrinho.length === 0) {
        alert("Carrinho vazio!");
        return;
    }

    let nomeCaixa = localStorage.getItem('identificacaoCaixa');

    if (!nomeCaixa) {

        nomeCaixa = prompt(
            "Digite a identificação deste dispositivo (Ex: Caixa 1, Caixa 2, Celular Ana):"
        );

        if (!nomeCaixa) {
            alert("Operação cancelada. É necessário identificar o caixa.");
            return;
        }

        localStorage.setItem('identificacaoCaixa', nomeCaixa);
    }

    const totalPedido = carrinho.reduce(
        (acc, item) => acc + (item.preco * item.qtd),
        0
    );

    const novoPedido = {
        id: "PED-" + Date.now(),
        data: new Date().toLocaleString("pt-BR"),
        caixa: nomeCaixa,
        total: totalPedido,
        itens: carrinho.map(item => ({
            nome: item.nome,
            qtd: item.qtd
        }))
    };

    // Salva localmente
    const historico = JSON.parse(
        localStorage.getItem('vendasArraia') || '[]'
    );

    historico.push(novoPedido);

    localStorage.setItem(
        'vendasArraia',
        JSON.stringify(historico)
    );

    const btnFinalizar = document.querySelector('.btnFinalizar');
    const textoOriginalBotao = btnFinalizar.textContent;

    btnFinalizar.disabled = true;
    btnFinalizar.textContent = "Enviando...";
    btnFinalizar.style.opacity = "0.6";
    btnFinalizar.style.cursor = "not-allowed";

    fetch(URL_PLANILHA, {
    method: "POST",
    body: JSON.stringify(novoPedido)
    })
    .then(() => {

        alert(`Venda registrada com sucesso no ${nomeCaixa}!`);

        carrinho = [];
        atualizarInterface();

    })
    .catch(error => {

        console.error("Erro ao enviar:", error);

        alert(
            "Venda salva localmente, mas houve um problema ao enviar para a planilha."
        );

    })
    .finally(() => {

        btnFinalizar.disabled = false;
        btnFinalizar.textContent = textoOriginalBotao;
        btnFinalizar.style.opacity = "1";
        btnFinalizar.style.cursor = "pointer";

    });
}

renderizarProdutos();
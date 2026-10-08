"""Caixa do Luau da Comp - servidor local. Uso: python server.py
Guarda pedidos em estado.json (sobrevive a reinício) e serve as telas na rede local."""
import json, os, socket, threading, time
import urllib.request
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORTA = 8000
URL_PLANILHA = ''  # opcional: URL do Apps Script para backup dos pedidos

PASTA = os.path.dirname(os.path.abspath(__file__))
ARQ = os.path.join(PASTA, 'estado.json')
lock = threading.Lock()

with open(os.path.join(PASTA, 'cardapio.json'), encoding='utf-8') as f:
    ITENS = {i['id']: i for i in json.load(f)}


def novo_estado(v=0):
    return {'pedidos': [], 'proximo': 1, 'v': v}


def carregar():
    try:
        with open(ARQ, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return novo_estado()


estado = carregar()


def salvar():
    estado['v'] += 1
    tmp = ARQ + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(estado, f, ensure_ascii=False)
    os.replace(tmp, ARQ)  # troca atômica: o arquivo nunca fica pela metade


def vendidos():
    v = {}
    for p in estado['pedidos']:
        if p['status'] != 'cancelado':
            for i in p['itens']:
                v[i['id']] = v.get(i['id'], 0) + i['qtd']
    return v


def enviar_planilha(p):
    if not URL_PLANILHA:
        return
    def f():
        try:
            req = urllib.request.Request(URL_PLANILHA, data=json.dumps(p).encode(), method='POST')
            urllib.request.urlopen(req, timeout=15)
        except Exception:
            pass
    threading.Thread(target=f, daemon=True).start()


def criar_pedido(dados):
    ja = vendidos()
    lista = []
    for i in dados.get('itens', []):
        it = ITENS.get(i.get('id'))
        qtd = i.get('qtd')
        if not it or not isinstance(qtd, int) or qtd <= 0:
            return {'erro': 'Pedido inválido.'}
        if it['estoque'] is not None and it['estoque'] - ja.get(it['id'], 0) < qtd:
            return {'erro': 'Estoque insuficiente: ' + it['nome']}
        lista.append({'id': it['id'], 'nome': it['nome'], 'preco': it['preco'], 'qtd': qtd})
    if not lista:
        return {'erro': 'Pedido vazio.'}
    p = {'num': estado['proximo'], 'hora': int(time.time() * 1000), 'status': 'aguardando',
         'itens': lista, 'total': sum(i['preco'] * i['qtd'] for i in lista)}
    estado['proximo'] += 1
    estado['pedidos'].append(p)
    salvar()
    enviar_planilha(p)
    return {'pedido': p}


def mudar_status(dados):
    if dados.get('status') not in ('aguardando', 'entregue', 'cancelado'):
        return {'erro': 'Status inválido.'}
    for p in estado['pedidos']:
        if p['num'] == dados.get('num'):
            p['status'] = dados['status']
            if dados['status'] == 'entregue':
                p['horaEntrega'] = int(time.time() * 1000)
            salvar()
            return {}
    return {'erro': 'Pedido não encontrado.'}


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=PASTA, **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def resp(self, obj, code=200):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == '/api/estado':
            v = parse_qs(u.query).get('v', [''])[0]
            with lock:
                return self.resp({'mudou': False} if v == str(estado['v']) else estado)
        if u.path == '/':
            self.send_response(302); self.send_header('Location', '/caixa.html'); self.end_headers(); return
        if u.path in ('/estado.json', '/server.py'):
            return self.send_error(404)
        super().do_GET()

    def do_POST(self):
        try:
            n = int(self.headers.get('Content-Length', 0))
            dados = json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return self.resp({'erro': 'Requisição inválida.'}, 400)
        rota = urlparse(self.path).path
        with lock:
            if rota == '/api/pedido':
                r = criar_pedido(dados)
            elif rota == '/api/status':
                r = mudar_status(dados)
            elif rota == '/api/zerar':
                estado.update(novo_estado(estado['v'])); salvar(); r = {}
            else:
                return self.resp({'erro': 'Rota inexistente.'}, 404)
            r['estado'] = estado
            return self.resp(r)


def ip_local():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()


if __name__ == '__main__':
    ip = ip_local()
    print('\n=== Caixa do Luau da Comp ===')
    print(f'Caixa (notebook):     http://localhost:{PORTA}/caixa.html')
    print(f'Retirada (monitor):   http://localhost:{PORTA}/retirada.html')
    print(f'Controle (celular):   http://{ip}:{PORTA}/controle.html')
    print('\nCtrl+C para parar. Pedidos ficam salvos em estado.json.\n')
    ThreadingHTTPServer(('0.0.0.0', PORTA), H).serve_forever()

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token_financas');

    // PROTEÇÃO: Expulsa o usuário se ele tentar acessar a tela sem estar logado
    if (!token) {
        alert('Acesso negado. Por favor, faça login primeiro!');
        window.location.href = 'index.html';
        return;
    }

    // Inicializa carregando a tabela de contas na tela
    listarContas();

    // 1. EVENTO DE CADASTRO: Envia uma nova conta para o backend Java
    document.getElementById('formConta').addEventListener('submit', async (event) => {
        event.preventDefault();

        const nome = document.getElementById('nomeConta').value;
        const tipoConta = document.getElementById('tipoConta').value;
        const saldoInicial = parseFloat(document.getElementById('saldoInicial').value);
        const alerta = document.getElementById('mensagemAlerta');

        alerta.classList.add('d-none');

        try {
            // Dispara o POST contra a rota de contas protegida por inquilino
            const response = await fetch(`${API_BASE_URL}/contas`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nome,
                    tipoConta,
                    saldoInicial,
                    javaMoeda: { id: 1 } // Vincula à nossa entidade de Moeda Padrão Real
                })
            });

            if (response.ok) {
                alerta.textContent = 'Conta cadastrada com sucesso!';
                alerta.classList.remove('d-none', 'alert-danger');
                alerta.classList.add('alert-success');
                
                document.getElementById('formConta').reset(); // Limpa as caixinhas digitadas
                listarContas(); // Atualiza a tabela na hora para mostrar a nova conta!

            } else {
                const erroData = await response.json();
                alerta.textContent = erroData.mensagem || 'Erro ao salvar a conta.';
                alerta.classList.remove('d-none');
                alerta.classList.add('alert-danger');
            }

        } catch (error) {
            alerta.textContent = 'Erro de conexão com o servidor.';
            alerta.classList.remove('d-none');
            alerta.classList.add('alert-danger');
        }
    });

    // 2. FUNÇÃO CORE: Busca as contas do usuário logado e renderiza a tabela HTML
    async function listarContas() {
        const tabela = document.getElementById('tabelaContas');

        try {
            // Dispara o GET (Equivalente ao Passo G do nosso arquivo de testes HTTP)
            const response = await fetch('http://localhost:8080/api/contas', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const contas = await response.json();
                tabela.innerHTML = ''; // Limpa a mensagem de "Carregando..."

                if (contas.length === 0) {
                    tabela.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">Nenhuma conta cadastrada para este usuário.</td></tr>`;
                    return;
                }

                // Varre a lista de contas recebidas da API e constrói o HTML físico de cada linha
                contas.forEach(conta => {
                    const linha = document.createElement('tr');
                    linha.innerHTML = `
                        <td><span class="badge bg-secondary">${conta.id}</span></td>
                        <td class="fw-bold text-dark">${conta.nome}</td>
                        <td><span class="badge bg-light text-dark border">${conta.tipoConta}</span></td>
                        <td class="text-end fw-bold text-primary">${formatarMoeda(conta.saldoAtual)}</td>
                    `;
                    tabela.appendChild(linha);
                });
            } else {
                tabela.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Erro ao carregar contas do banco de dados.</td></tr>`;
            }

        } catch (error) {
            tabela.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Erro de comunicação com o backend.</td></tr>`;
        }
    }

    // BOTÃO SAIR
    document.getElementById('btnSair').addEventListener('click', () => {
        localStorage.removeItem('token_financas');
        window.location.href = 'index.html';
    });

    // Formatador de Moeda para R\$
    function formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    }
});

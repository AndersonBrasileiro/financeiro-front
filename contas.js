document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token_financas');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    let contasCache = [];
    let idEmEdicao = null;

    const formConta = document.getElementById('formConta');
    const inputSaldoInicial = document.getElementById('saldoInicial');
    const btnSubmit = formConta.querySelector('button[type="submit"]');
    const textoOriginalBtn = btnSubmit ? btnSubmit.innerHTML : 'Salvar Conta';

    const btnCancelarEdicao = document.createElement('button');
    btnCancelarEdicao.type = 'button';
    btnCancelarEdicao.className = 'btn btn-outline-secondary ms-2 d-none';
    btnCancelarEdicao.textContent = 'Cancelar Edição';
    if (btnSubmit) {
        btnSubmit.insertAdjacentElement('afterend', btnCancelarEdicao);
    }

    btnCancelarEdicao.addEventListener('click', resetarModoEdicao);

    listarContas();

    function resetarModoEdicao() {
        idEmEdicao = null;
        formConta.reset();
        if (inputSaldoInicial) inputSaldoInicial.disabled = false;
        if (btnSubmit) btnSubmit.innerHTML = textoOriginalBtn;
        btnCancelarEdicao.classList.add('d-none');
    }

    // 1. CADASTRAR OU ATUALIZAR CONTA (POST / PUT)
    formConta.addEventListener('submit', async (event) => {
        event.preventDefault();

        const nome = document.getElementById('nomeConta').value.trim();
        const tipoConta = document.getElementById('tipoConta').value;
        const saldoInicial = parseFloat(inputSaldoInicial.value) || 0;
        const alerta = document.getElementById('mensagemAlerta');

        alerta.classList.add('d-none');

        const url = idEmEdicao ? `${API_BASE_URL}/contas/${idEmEdicao}` : `${API_BASE_URL}/contas`;
        const metodo = idEmEdicao ? 'PUT' : 'POST';

        const payload = idEmEdicao
            ? { nome, tipoConta }
            : { nome, tipoConta, saldoInicial, javaMoeda: { id: 1 } };

        try {
            const response = await fetch(url, {
                method: metodo,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alerta.textContent = idEmEdicao
                    ? 'Conta bancária atualizada com sucesso!'
                    : 'Conta cadastrada com sucesso!';
                alerta.classList.remove('d-none', 'alert-danger');
                alerta.classList.add('alert-success');

                resetarModoEdicao();
                listarContas();
            } else {
                const erroData = await response.json().catch(() => ({}));
                alerta.textContent = erroData.mensagem || erroData.message || `Erro ao salvar a conta (HTTP ${response.status}).`;
                alerta.classList.remove('d-none', 'alert-success');
                alerta.classList.add('alert-danger');
            }
        } catch (error) {
            alerta.textContent = 'Erro de conexão com o servidor.';
            alerta.classList.remove('d-none', 'alert-success');
            alerta.classList.add('alert-danger');
        }
    });

    // 2. LISTAR CONTAS NA TABELA
    async function listarContas() {
        const tabela = document.getElementById('tabelaContas');

        try {
            const response = await fetch(`${API_BASE_URL}/contas`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token_financas');
                window.location.href = 'index.html';
                return;
            }

            if (response.ok) {
                contasCache = await response.json();
                contasCache.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
                tabela.innerHTML = '';

                if (contasCache.length === 0) {
                    tabela.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Nenhuma conta cadastrada para este usuário.</td></tr>`;
                    return;
                }

                contasCache.forEach(conta => {
                    const linha = document.createElement('tr');
                    linha.innerHTML = `
                        <td><span class="badge bg-secondary">${conta.id}</span></td>
                        <td class="fw-bold text-dark">${conta.nome}</td>
                        <td><span class="badge bg-light text-dark border">${conta.tipoConta}</span></td>
                        <td class="text-end fw-bold text-primary">${formatarMoeda(conta.saldoAtual)}</td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-outline-primary me-1 btn-editar-conta" data-id="${conta.id}" title="Editar conta">✏️</button>
                            <button class="btn btn-sm btn-outline-danger btn-excluir-conta" data-id="${conta.id}" data-nome="${conta.nome}" title="Excluir conta">🗑️</button>
                        </td>
                    `;
                    tabela.appendChild(linha);
                });

                document.querySelectorAll('.btn-editar-conta').forEach(btn => {
                    btn.addEventListener('click', () => iniciarEdicao(parseInt(btn.dataset.id)));
                });

                document.querySelectorAll('.btn-excluir-conta').forEach(btn => {
                    btn.addEventListener('click', () => excluirConta(parseInt(btn.dataset.id), btn.dataset.nome));
                });
            } else {
                tabela.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Erro ao carregar contas do banco de dados.</td></tr>`;
            }
        } catch (error) {
            tabela.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Erro de comunicação com o backend.</td></tr>`;
        }
    }

    function iniciarEdicao(id) {
        const conta = contasCache.find(c => c.id === id);
        if (!conta) return;

        idEmEdicao = id;
        document.getElementById('nomeConta').value = conta.nome;
        document.getElementById('tipoConta').value = conta.tipoConta;

        if (inputSaldoInicial) {
            inputSaldoInicial.value = conta.saldoInicial ?? conta.saldoAtual;
            inputSaldoInicial.disabled = true; // Protege o saldo inicial para não corromper movimentações
        }

        if (btnSubmit) btnSubmit.innerHTML = 'Atualizar Conta';
        btnCancelarEdicao.classList.remove('d-none');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function excluirConta(id, nome) {
        if (!confirm(`Deseja realmente excluir a conta "${nome}"?\n\nObservação: Contas com lançamentos ou movimentações no extrato não podem ser excluídas.`)) {
            return;
        }

        const alerta = document.getElementById('mensagemAlerta');
        alerta.classList.add('d-none');

        try {
            const response = await fetch(`${API_BASE_URL}/contas/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                alerta.textContent = `Conta "${nome}" excluída com sucesso!`;
                alerta.classList.remove('d-none', 'alert-danger');
                alerta.classList.add('alert-success');
                listarContas();
            } else {
                const err = await response.json().catch(() => ({}));
                alerta.textContent = err.mensagem || err.message || `Não foi possível excluir a conta (HTTP ${response.status}).`;
                alerta.classList.remove('d-none', 'alert-success');
                alerta.classList.add('alert-danger');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (error) {
            alerta.textContent = 'Erro de conexão ao tentar excluir a conta.';
            alerta.classList.remove('d-none', 'alert-success');
            alerta.classList.add('alert-danger');
        }
    }

    document.getElementById('btnSair')?.addEventListener('click', () => {
        localStorage.removeItem('token_financas');
        window.location.href = 'index.html';
    });

    function formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    }
});

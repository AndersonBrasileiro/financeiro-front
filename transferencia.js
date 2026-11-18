document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token_financas');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const hojeISO = new Date().toISOString().slice(0, 10);
    document.getElementById('inputData').value = hojeISO;

    carregarContasNosSelects();
    listarTransferencias();

    document.getElementById('formTransferencia').addEventListener('submit', async (e) => {
        e.preventDefault();
        executarTransferencia();
    });

    document.getElementById('btnCancelar').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });

    document.getElementById('btnFiltrar').addEventListener('click', () => {
        listarTransferencias();
    });

    document.getElementById('btnLimparFiltros').addEventListener('click', () => {
        document.getElementById('filtroDataInicio').value = '';
        document.getElementById('filtroDataFim').value = '';
        listarTransferencias();
    });

    async function carregarContasNosSelects() {
        const selectOrigem = document.getElementById('selectContaOrigem');
        const selectDestino = document.getElementById('selectContaDestino');

        try {
            const response = await fetch(`${API_BASE_URL}/contas`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token_financas');
                window.location.href = 'index.html';
                return;
            }

            if (response.ok) {
                const contas = await response.json();
                selectOrigem.innerHTML = '<option value="">-- Selecione a Origem --</option>';
                selectDestino.innerHTML = '<option value="">-- Selecione o Destino --</option>';

                contas.forEach(c => {
                    const optionHtml = `<option value="${c.id}">${c.nome} (Saldo: R$ ${c.saldoAtual.toFixed(2)})</option>`;
                    selectOrigem.innerHTML += optionHtml;
                    selectDestino.innerHTML += optionHtml;
                });
            }
        } catch (error) {
            console.error('Erro ao carregar contas nos seletores', error);
            exibirAlerta('Erro de conexão ao carregar as contas bancárias.', 'danger');
        }
    }

    async function executarTransferencia() {
        const contaOrigemId = document.getElementById('selectContaOrigem').value;
        const contaDestinoId = document.getElementById('selectContaDestino').value;
        const valor = parseFloat(document.getElementById('inputValor').value);
        const data = document.getElementById('inputData').value;
        const observacao = document.getElementById('inputObservacao').value;

        if (contaOrigemId === contaDestinoId) {
            exibirAlerta('⚠️ A conta de destino não pode ser igual à conta de origem.', 'warning');
            return;
        }

        const dadosTransferencia = {
            descricao: observacao || "Transferência entre Contas",
            valor: valor,
            dataTransferencia: data,
            contaOrigem: { id: parseInt(contaOrigemId) },
            contaDestino: { id: parseInt(contaDestinoId) }
        };

        try {
            const response = await fetch(`${API_BASE_URL}/transferencias`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(dadosTransferencia)
            });

            if (response.ok) {
                exibirAlerta('✅ Transferência executada com sucesso!', 'success');
                document.getElementById('formTransferencia').reset();
                document.getElementById('inputData').value = new Date().toISOString().slice(0, 10);
                carregarContasNosSelects();
                listarTransferencias();
            } else {
                const err = await response.json().catch(() => ({}));
                exibirAlerta(`Erro do servidor (Status ${response.status}): ${err.message || 'Falha na operação.'}`, 'danger');
            }
        } catch (error) {
            console.error('Erro na transferência:', error);
            exibirAlerta('Erro de conexão com o backend.', 'danger');
        }
    }
    function extrairDataISO(dataBruta) {
        if (!dataBruta) return '';
        if (Array.isArray(dataBruta)) {
            const [ano, mes, dia] = dataBruta;
            return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        }
        return dataBruta.toString().slice(0, 10);
    }

    async function listarTransferencias() {
        const tabela = document.getElementById('tabelaTransferencias');
        if (!tabela) return;

        const dataInicio = document.getElementById('filtroDataInicio').value;
        const dataFim = document.getElementById('filtroDataFim').value;

        tabela.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Buscando transferências...</td></tr>`;

        try {
            const response = await fetch(`${API_BASE_URL}/transferencias`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                let transferencias = await response.json();

                if (dataInicio) {
                    transferencias = transferencias.filter(t => extrairDataISO(t.dataTransferencia) >= dataInicio);
                }
                if (dataFim) {
                    transferencias = transferencias.filter(t => extrairDataISO(t.dataTransferencia) <= dataFim);
                }

                tabela.innerHTML = '';

                if (transferencias.length === 0) {
                    tabela.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Nenhuma transferência encontrada para o período.</td></tr>`;
                    return;
                }

                transferencias.forEach(t => {
                    const origemNome = t.contaOrigem ? t.contaOrigem.nome : 'N/A';
                    const destinoNome = t.contaDestino ? t.contaDestino.nome : 'N/A';

                    const dataISO = extrairDataISO(t.dataTransferencia);
                    let dataExibicao = 'N/A';
                    if (dataISO) {
                        const [ano, mes, dia] = dataISO.split('-');
                        dataExibicao = `${dia}/${mes}/${ano}`;
                    }

                    const linha = document.createElement('tr');
                    linha.innerHTML = `
                        <td>${dataExibicao}</td>
                        <td>
                            <span class="badge bg-light text-danger border">${origemNome}</span>
                            <span class="mx-1 text-muted">➔</span>
                            <span class="badge bg-light text-success border">${destinoNome}</span>
                        </td>
                        <td class="fw-bold text-dark">${t.descricao || 'Transferência'}</td>
                        <td class="text-end fw-bold text-primary">R$ ${t.valor.toFixed(2)}</td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-outline-danger btn-excluir-transf" data-id="${t.id}" title="Excluir e recompor saldos">🗑️</button>
                        </td>
                    `;
                    tabela.appendChild(linha);
                });

                document.querySelectorAll('.btn-excluir-transf').forEach(btn => {
                    btn.addEventListener('click', () => excluirTransferencia(btn.dataset.id));
                });
            } else {
                tabela.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Erro ao carregar histórico (HTTP ${response.status}).</td></tr>`;
            }
        } catch (error) {
            console.error('Erro ao listar transferências:', error);
            tabela.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Falha de conexão com o servidor.</td></tr>`;
        }
    }

    async function excluirTransferencia(id) {
        if (!confirm('Deseja realmente excluir esta transferência? Os saldos das duas contas serão recompostos e os registros removidos do extrato.')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/transferencias/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                exibirAlerta('✅ Transferência excluída e saldos recompostos com sucesso!', 'success');
                carregarContasNosSelects();
                listarTransferencias();
            } else {
                const err = await response.json().catch(() => ({}));
                exibirAlerta(`Erro ao excluir (Status ${response.status}): ${err.message || 'Não foi possível excluir.'}`, 'danger');
            }
        } catch (error) {
            console.error('Erro ao excluir transferência:', error);
            exibirAlerta('Erro de conexão ao tentar excluir.', 'danger');
        }
    }

    function exibirAlerta(mensagem, tipo) {
        const alerta = document.getElementById('alertaFeedback');
        alerta.className = `alert alert-${tipo} small`;
        alerta.innerText = mensagem;
        alerta.classList.remove('d-none');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.getElementById('btnSair')?.addEventListener('click', () => {
        localStorage.removeItem('token_financas');
        window.location.href = 'index.html';
    });
});

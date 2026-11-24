document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token_financas');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Inicializa a tela
    carregarDropdownContas();
    carregarDropdownCategoriasReais();
    carregarDropdownCentrosReceita();
    listarLancamentosReceber();

    // 1. CARREGA AS CONTAS EM ORDEM ALFABÉTICA (Formulário + Filtro)
    async function carregarDropdownContas() {
        const selectForm = document.getElementById('selectConta');
        const selectFiltro = document.getElementById('filtroConta');
        try {
            const response = await fetch(`${API_BASE_URL}/contas`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const contas = await response.json();
                contas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
                selectForm.innerHTML = '<option value="">-- Selecione a Conta --</option>';
                selectFiltro.innerHTML = '<option value="">Todas</option>';
                contas.forEach(c => {
                    selectForm.innerHTML += `<option value="${c.id}">${c.nome} (Saldo: R$ ${c.saldoAtual.toFixed(2)})</option>`;
                    selectFiltro.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
                });
            }
        } catch (e) { console.error('Erro ao carregar contas', e); }
    }

    // Helper para identificar Categoria Pai em qualquer nomenclatura
    function obterCategoriaPai(categoria) {
        return categoria.categoriaPai || categoria.pai || categoria.categoriaPrincipal || null;
    }

        // 2. CARREGA APENAS AS CATEGORIAS ANALÍTICAS DE RECEITA EM ORDEM ALFABÉTICA (A-Z)
    async function carregarDropdownCategoriasReais() {
        const selectForm = document.getElementById('selectCategoria');
        const selectFiltro = document.getElementById('filtroCategoria');
        try {
            const response = await fetch(`${API_BASE_URL}/categorias`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const categorias = await response.json();

                // Filtra apenas categorias de Receita que sejam Analíticas (possuem pai)
                const analiticasReceita = categorias
                    .filter(cat => {
                        const valorFluxo = cat.fluxo || cat.tipo || 'DESPESA';
                        return valorFluxo.toString().toUpperCase() === 'RECEITA' && Boolean(obterCategoriaPai(cat));
                    })
                    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

                selectForm.innerHTML = '<option value="">-- Selecione a Categoria Analítica --</option>';
                selectFiltro.innerHTML = '<option value="">Todas as Analíticas</option>';

                analiticasReceita.forEach(cat => {
                    selectForm.innerHTML += `<option value="${cat.id}">${cat.nome}</option>`;
                    selectFiltro.innerHTML += `<option value="${cat.id}">${cat.nome}</option>`;
                });
            }
        } catch (e) { console.error('Erro ao carregar categorias reais', e); }
    }


    // 3. CARREGA OS CENTROS DE RECEITA EM ORDEM ALFABÉTICA (Formulário + Filtro)
    async function carregarDropdownCentrosReceita() {
        const selectForm = document.getElementById('selectCentroCusto');
        const selectFiltro = document.getElementById('filtroCentroCusto');
        try {
            const response = await fetch(`${API_BASE_URL}/centros-custo/filtrar?fluxo=RECEITA`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const centros = await response.json();
                centros.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
                selectForm.innerHTML = '<option value="">-- Selecione o Centro de Receita --</option>';
                selectFiltro.innerHTML = '<option value="">Todos</option>';
                centros.forEach(centro => {
                    selectForm.innerHTML += `<option value="${centro.id}">${centro.nome}</option>`;
                    selectFiltro.innerHTML += `<option value="${centro.id}">${centro.nome}</option>`;
                });
            }
        } catch (e) { console.error('Erro ao carregar centros de receita', e); }
    }

    // 4. SALVA OU ATUALIZA UMA RECEITA
    document.getElementById('formReceber').addEventListener('submit', async (event) => {
        event.preventDefault();

        const idEdicao = document.getElementById('lancamentoId').value;
        const descricao = document.getElementById('descricao').value;
        const valor = parseFloat(document.getElementById('valor').value);
        const dataVencimento = document.getElementById('dataVencimento').value;
        const contaId = document.getElementById('selectConta').value;
        const categoriaId = document.getElementById('selectCategoria').value;
        const centroCustoId = document.getElementById('selectCentroCusto').value;
        const pago = document.getElementById('recebido').checked;

        document.getElementById('mensagemAlerta').classList.add('d-none');

        const payload = {
            descricao,
            valor,
            dataVencimento,
            pago,
            tipoLancamento: "RECEITA",
            conta: { id: parseInt(contaId) },
            categoria: { id: parseInt(categoriaId) },
            centroCusto: centroCustoId ? { id: parseInt(centroCustoId) } : null
        };

        const url = idEdicao ? `${API_BASE_URL}/lancamentos/${idEdicao}` : `${API_BASE_URL}/lancamentos`;
        const metodo = idEdicao ? 'PUT' : 'POST';

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
                exibirAlerta(idEdicao ? 'Receita alterada com sucesso!' : 'Receita cadastrada com sucesso!', 'success');
                resetarFormulario();
                carregarDropdownContas();
                listarLancamentosReceber();
            } else {
                const err = await response.json().catch(() => ({}));
                exibirAlerta(err.message || err.mensagem || 'Operação não permitida pelo servidor.', 'danger');
            }
        } catch (error) {
            console.error(error);
            exibirAlerta('Erro de comunicação com o servidor.', 'danger');
        }
    });
        // 5. EVENTOS DOS BOTÕES DE FILTRO, MODAL E CANCELAR EDIÇÃO
    document.getElementById('btnAplicarFiltros').addEventListener('click', () => listarLancamentosReceber());
    document.getElementById('btnLimparFiltros').addEventListener('click', () => {
        document.getElementById('filtroDataInicio').value = '';
        document.getElementById('filtroDataFim').value = '';
        document.getElementById('filtroConta').value = '';
        document.getElementById('filtroCentroCusto').value = '';
        document.getElementById('filtroCategoria').value = '';
        document.getElementById('filtroStatus').value = '';
        listarLancamentosReceber();
    });
    document.getElementById('btnCancelarEdicao').addEventListener('click', resetarFormulario);

    document.getElementById('btnConfirmarBaixaModal').addEventListener('click', async () => {
        const id = document.getElementById('baixaLancamentoId').value;
        const dataPagamento = document.getElementById('baixaDataPagamento').value;
        if (!dataPagamento) {
            alert('Por favor, informe a data do recebimento.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/lancamentos/${id}/baixar?dataPagamento=${dataPagamento}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const modalInstance = bootstrap.Modal.getInstance(document.getElementById('modalBaixa'));
                if (modalInstance) modalInstance.hide();

                exibirAlerta('Recebimento confirmado com sucesso!', 'success');
                carregarDropdownContas();
                listarLancamentosReceber();
            } else {
                const err = await response.json().catch(() => ({}));
                alert(`Erro ao baixar (HTTP ${response.status}): ${err.message || 'Falha no servidor.'}`);
            }
        } catch (e) { console.error(e); }
    });

    // 6. LISTA AS RECEITAS APLICANDO OS FILTROS + TOTALIZADOR EM ABERTO
    async function listarLancamentosReceber() {
        const tabela = document.getElementById('tabelaReceber');
        tabela.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Buscando lançamentos...</td></tr>`;

        const params = new URLSearchParams({ tipo: 'RECEITA' });
        const dataInicio = document.getElementById('filtroDataInicio').value;
        const dataFim = document.getElementById('filtroDataFim').value;
        const contaId = document.getElementById('filtroConta').value;
        const centroCustoId = document.getElementById('filtroCentroCusto').value;
        const categoriaId = document.getElementById('filtroCategoria').value;
        const statusFiltro = document.getElementById('filtroStatus').value;

        if (dataInicio) params.append('dataInicio', dataInicio);
        if (dataFim) params.append('dataFim', dataFim);
        if (contaId) params.append('contaId', contaId);
        if (centroCustoId) params.append('centroCustoId', centroCustoId);
        if (categoriaId) params.append('categoriaId', categoriaId);

        try {
            let response = await fetch(`${API_BASE_URL}/lancamentos/filtrar?${params.toString()}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            let receitas = [];

            if (response.ok) {
                receitas = await response.json();
            } else {
                const fallbackResp = await fetch(`${API_BASE_URL}/lancamentos`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!fallbackResp.ok) {
                    tabela.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Erro ao carregar dados (HTTP ${fallbackResp.status}).</td></tr>`;
                    return;
                }

                const todos = await fallbackResp.json();
                receitas = todos.filter(l => {
                    if (l.tipoLancamento !== 'RECEITA') return false;
                    if (dataInicio && l.dataVencimento < dataInicio) return false;
                    if (dataFim && l.dataVencimento > dataFim) return false;
                    if (contaId && (!l.conta || l.conta.id != contaId)) return false;
                    if (centroCustoId && (!l.centroCusto || l.centroCusto.id != centroCustoId)) return false;
                    if (categoriaId && (!l.categoria || l.categoria.id != categoriaId)) return false;
                    return true;
                });
            }

            if (statusFiltro === 'ABERTO') {
                receitas = receitas.filter(l => !l.pago);
            } else if (statusFiltro === 'PAGO') {
                receitas = receitas.filter(l => l.pago);
            }

            const somaEmAberto = receitas
                .filter(l => !l.pago)
                .reduce((acumulador, item) => acumulador + item.valor, 0);

            const elTotalAberto = document.getElementById('totalReceberAberto');
            if (elTotalAberto) {
                elTotalAberto.textContent = new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                }).format(somaEmAberto);
            }

            tabela.innerHTML = '';

            if (receitas.length === 0) {
                tabela.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Nenhuma receita encontrada para os filtros selecionados.</td></tr>`;
                return;
            }
            receitas.forEach(l => {
                const statusBadge = l.pago
                    ? `<span class="badge bg-success">Recebida</span>${l.dataPagamento ? `<br><small class="text-muted" style="font-size:0.7rem;">em ${new Date(l.dataPagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</small>` : ''}`
                    : '<span class="badge bg-warning text-dark">A Receber</span>';

                const categoriaNome = l.categoria ? l.categoria.nome : 'N/A';
                const centroNome = l.centroCusto ? l.centroCusto.nome : 'Padrão';

                const botoesAcao = l.pago
                    ? `<button class="btn btn-sm btn-outline-warning fw-bold btn-estornar" data-id="${l.id}" title="Estornar recebimento">↩️ Estornar</button>`
                    : `
                        <div class="btn-group btn-group-sm" role="group">
                            <button class="btn btn-success btn-baixar" data-id="${l.id}" title="Confirmar recebimento">✅ Baixar</button>
                            <button class="btn btn-outline-primary btn-editar" data-id="${l.id}" title="Alterar título">✏️</button>
                            <button class="btn btn-outline-danger btn-excluir" data-id="${l.id}" title="Excluir título">🗑️</button>
                        </div>
                      `;

                const line = document.createElement('tr');
                line.innerHTML = `
                    <td>${new Date(l.dataVencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                    <td class="fw-bold">
                        ${l.descricao}
                        <br><small class="text-muted fw-normal">📁 ${categoriaNome} | 🏢 ${centroNome}</small>
                    </td>
                    <td><span class="badge bg-light text-dark border">${l.conta ? l.conta.nome : 'N/A'}</span></td>
                    <td>${statusBadge}</td>
                    <td class="text-end fw-bold text-success">+ R$ ${l.valor.toFixed(2)}</td>
                    <td class="text-center">${botoesAcao}</td>
                `;
                tabela.appendChild(line);
            });

            vincularEventosBotoes(receitas);

        } catch (e) {
            console.error(e);
            tabela.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Falha de conexão com a API.</td></tr>`;
        }
    }

    // 7. VINCULA EVENTOS DOS BOTÕES DA TABELA
    function vincularEventosBotoes(receitas) {
        document.querySelectorAll('.btn-baixar').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = receitas.find(r => r.id == btn.dataset.id);
                if (!item) return;

                document.getElementById('baixaLancamentoId').value = item.id;
                document.getElementById('baixaDescricao').textContent = item.descricao;
                document.getElementById('baixaValor').textContent = `Valor: R$ ${item.valor.toFixed(2)}`;
                document.getElementById('baixaDataPagamento').value = item.dataVencimento;

                new bootstrap.Modal(document.getElementById('modalBaixa')).show();
            });
        });

        document.querySelectorAll('.btn-estornar').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Deseja estornar este recebimento? O registro no extrato será removido e o valor descontado da conta.')) return;
                try {
                    const response = await fetch(`${API_BASE_URL}/lancamentos/${btn.dataset.id}/estornar`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.ok) {
                        exibirAlerta('Recebimento estornado com sucesso!', 'success');
                        carregarDropdownContas();
                        listarLancamentosReceber();
                    } else {
                        const err = await response.json().catch(() => ({}));
                        exibirAlerta(`Erro no estorno (HTTP ${response.status}): ${err.message || err.error || 'Verifique o servidor.'}`, 'danger');
                    }
                } catch (e) {
                    console.error(e);
                    exibirAlerta('Erro de rede ao tentar estornar.', 'danger');
                }
            });
        });

        document.querySelectorAll('.btn-excluir').forEach(btn => {
            btn.addEventListener('click', () => excluirLancamento(btn.dataset.id));
        });

        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = receitas.find(r => r.id == btn.dataset.id);
                if (item) carregarParaEdicao(item);
            });
        });
    }

    async function excluirLancamento(id) {
        if (!confirm('Tem certeza que deseja excluir esta receita em aberto?')) return;
        try {
            const response = await fetch(`${API_BASE_URL}/lancamentos/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                exibirAlerta('Receita excluída com sucesso!', 'success');
                listarLancamentosReceber();
            } else {
                const err = await response.json().catch(() => ({}));
                exibirAlerta(err.message || 'Não é permitido excluir este lançamento.', 'danger');
            }
        } catch (e) { console.error(e); }
    }

    function carregarParaEdicao(item) {
        document.getElementById('lancamentoId').value = item.id;
        document.getElementById('descricao').value = item.descricao;
        document.getElementById('valor').value = item.valor;
        document.getElementById('dataVencimento').value = item.dataVencimento;
        document.getElementById('selectConta').value = item.conta ? item.conta.id : '';
        document.getElementById('selectCentroCusto').value = item.centroCusto ? item.centroCusto.id : '';
        document.getElementById('selectCategoria').value = item.categoria ? item.categoria.id : '';

        document.getElementById('tituloFormulario').textContent = `Editando Receita #${item.id}`;
        document.getElementById('btnSalvarReceber').textContent = 'Salvar Alterações';
        document.getElementById('btnCancelarEdicao').classList.remove('d-none');
        document.getElementById('boxCheckRecebido').classList.add('d-none');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function resetarFormulario() {
        document.getElementById('formReceber').reset();
        document.getElementById('lancamentoId').value = '';
        document.getElementById('tituloFormulario').textContent = 'Nova Receita';
        document.getElementById('btnSalvarReceber').textContent = 'Salvar Receita';
        document.getElementById('btnCancelarEdicao').classList.add('d-none');
        document.getElementById('boxCheckRecebido').classList.remove('d-none');
    }

    function exibirAlerta(texto, tipo) {
        const alerta = document.getElementById('mensagemAlerta');
        alerta.textContent = texto;
        alerta.className = `alert alert-${tipo} small`;
        alerta.classList.remove('d-none');
    }
});

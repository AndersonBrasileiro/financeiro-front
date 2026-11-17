document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token_financas');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Inicializa a tela
    carregarDropdownContas();
    carregarDropdownCategoriasReais();
    carregarDropdownCentros();
    listarLancamentosPagar();

    // 1. CARREGA AS CONTAS (Formulário + Filtro)
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
                selectForm.innerHTML = '<option value="">-- Selecione a Conta --</option>';
                selectFiltro.innerHTML = '<option value="">Todas</option>';
                contas.forEach(c => {
                    selectForm.innerHTML += `<option value="${c.id}">${c.nome} (Saldo: R$ ${c.saldoAtual.toFixed(2)})</option>`;
                    selectFiltro.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
                });
            }
        } catch (e) { console.error('Erro ao carregar contas', e); }
    }

    // 2. CARREGA APENAS AS CATEGORIAS ANALÍTICAS (Formulário + Filtro)
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
                selectForm.innerHTML = '<option value="">-- Selecione a Categoria Analítica --</option>';
                selectFiltro.innerHTML = '<option value="">Todas as Analíticas</option>';

                categorias.forEach(cat => {
                    const valorFluxo = cat.fluxo || cat.tipo || 'DESPESA';
                    // Regra estrita: apenas DESPESA e apenas Analíticas (que possuem categoriaPai)
                    if (valorFluxo.toString().toUpperCase() === 'DESPESA' && cat.categoriaPai) {
                        const label = `${cat.nome} (${cat.categoriaPai.nome})`;
                        selectForm.innerHTML += `<option value="${cat.id}">${label}</option>`;
                        selectFiltro.innerHTML += `<option value="${cat.id}">${label}</option>`;
                    }
                });
            }
        } catch (e) { console.error('Erro ao carregar categorias', e); }
    }

    // 3. CARREGA OS CENTROS DE CUSTO (Formulário + Filtro)
    async function carregarDropdownCentros() {
        const selectForm = document.getElementById('selectCentroCusto');
        const selectFiltro = document.getElementById('filtroCentroCusto');
        try {
            const response = await fetch(`${API_BASE_URL}/centros-custo/filtrar?fluxo=DESPESA`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const centros = await response.json();
                selectForm.innerHTML = '<option value="">-- Selecione o Centro de Custo --</option>';
                selectFiltro.innerHTML = '<option value="">Todos</option>';
                centros.forEach(centro => {
                    selectForm.innerHTML += `<option value="${centro.id}">${centro.nome}</option>`;
                    selectFiltro.innerHTML += `<option value="${centro.id}">${centro.nome}</option>`;
                });
            }
        } catch (e) { console.error('Erro ao carregar centros de custo', e); }
    }

    // 4. SALVA OU ATUALIZA UMA DESPESA
    document.getElementById('formPagar').addEventListener('submit', async (event) => {
        event.preventDefault();

        const idEdicao = document.getElementById('lancamentoId').value;
        const descricao = document.getElementById('descricao').value;
        const valor = parseFloat(document.getElementById('valor').value);
        const dataVencimento = document.getElementById('dataVencimento').value;
        const contaId = document.getElementById('selectConta').value;
        const categoriaId = document.getElementById('selectCategoria').value;
        const centroCustoId = document.getElementById('selectCentroCusto').value;
        const pago = document.getElementById('pago').checked;
        const alerta = document.getElementById('mensagemAlerta');

        alerta.classList.add('d-none');

        const payload = {
            descricao,
            valor,
            dataVencimento,
            pago,
            tipoLancamento: "DESPESA",
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
                exibirAlerta(idEdicao ? 'Despesa alterada com sucesso!' : 'Despesa cadastrada com sucesso!', 'success');
                resetarFormulario();
                carregarDropdownContas();
                listarLancamentosPagar();
            } else {
                const err = await response.json().catch(() => ({}));
                exibirAlerta(err.message || err.mensagem || 'Operação não permitida pelo servidor.', 'danger');
            }
        } catch (error) {
            console.error(error);
            exibirAlerta('Erro de comunicação com o servidor.', 'danger');
        }
    });
        // 5. EVENTOS DOS BOTÕES DE FILTRO E CANCELAR EDIÇÃO
    document.getElementById('btnAplicarFiltros').addEventListener('click', () => listarLancamentosPagar());
    document.getElementById('btnLimparFiltros').addEventListener('click', () => {
        document.getElementById('filtroDataInicio').value = '';
        document.getElementById('filtroDataFim').value = '';
        document.getElementById('filtroConta').value = '';
        document.getElementById('filtroCentroCusto').value = '';
        document.getElementById('filtroCategoria').value = '';
        document.getElementById('filtroStatus').value = '';
        listarLancamentosPagar();
    });
    document.getElementById('btnCancelarEdicao').addEventListener('click', resetarFormulario);

    // Evento do botão confirmar dentro do Modal de Baixa
    document.getElementById('btnConfirmarBaixaModal').addEventListener('click', async () => {
        const id = document.getElementById('baixaLancamentoId').value;
        const dataPagamento = document.getElementById('baixaDataPagamento').value;
        if (!dataPagamento) {
            alert('Por favor, informe a data do pagamento.');
            return;
        }

        const url = `${API_BASE_URL}/lancamentos/${id}/baixar?dataPagamento=${dataPagamento}`;
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const modalEl = document.getElementById('modalBaixa');
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();

                exibirAlerta('Título baixado com sucesso!', 'success');
                carregarDropdownContas();
                listarLancamentosPagar();
            } else {
                const err = await response.json().catch(() => ({}));
                alert(`Erro ao baixar (HTTP ${response.status}): ${err.message || 'Falha no servidor.'}`);
            }
        } catch (e) { console.error(e); }
    });

    // 6. LISTA AS DESPESAS APLICANDO OS FILTROS
    async function listarLancamentosPagar() {
        const tabela = document.getElementById('tabelaPagar');
        tabela.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Buscando lançamentos...</td></tr>`;

        const params = new URLSearchParams({ tipo: 'DESPESA' });

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

            let despesas = [];

            if (response.ok) {
                despesas = await response.json();
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
                despesas = todos.filter(l => {
                    if (l.tipoLancamento !== 'DESPESA') return false;
                    if (dataInicio && l.dataVencimento < dataInicio) return false;
                    if (dataFim && l.dataVencimento > dataFim) return false;
                    if (contaId && (!l.conta || l.conta.id != contaId)) return false;
                    if (centroCustoId && (!l.centroCusto || l.centroCusto.id != centroCustoId)) return false;
                    if (categoriaId && (!l.categoria || l.categoria.id != categoriaId)) return false;
                    return true;
                });
            }

            if (statusFiltro === 'ABERTO') {
                despesas = despesas.filter(l => !l.pago);
            } else if (statusFiltro === 'PAGO') {
                despesas = despesas.filter(l => l.pago);
            }

            tabela.innerHTML = '';

            if (despesas.length === 0) {
                tabela.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Nenhuma despesa encontrada para os filtros selecionados.</td></tr>`;
                return;
            }
            despesas.forEach(l => {
                const statusBadge = l.pago
                    ? `<span class="badge bg-success">Paga</span>${l.dataPagamento ? `<br><small class="text-muted" style="font-size:0.7rem;">em ${new Date(l.dataPagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</small>` : ''}`
                    : '<span class="badge bg-warning text-dark">Em Aberto</span>';

                const categoriaNome = l.categoria ? l.categoria.nome : 'N/A';
                const centroNome = l.centroCusto ? l.centroCusto.nome : 'Padrão';

                const botoesAcao = l.pago
                    ? `<button class="btn btn-sm btn-outline-warning fw-bold btn-estornar" data-id="${l.id}" title="Estornar baixa">↩️ Estornar</button>`
                    : `
                        <div class="btn-group btn-group-sm" role="group">
                            <button class="btn btn-success btn-baixar" data-id="${l.id}" title="Baixar título">✅ Baixar</button>
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
                    <td class="text-end fw-bold text-danger">- R$ ${l.valor.toFixed(2)}</td>
                    <td class="text-center">${botoesAcao}</td>
                `;
                tabela.appendChild(line);
            });

            vincularEventosBotoes(despesas);

        } catch (e) {
            console.error(e);
            tabela.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Falha de conexão com a API.</td></tr>`;
        }
    }

    // 7. VINCULA EVENTOS DOS BOTÕES DA TABELA
    function vincularEventosBotoes(despesas) {
        document.querySelectorAll('.btn-baixar').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = despesas.find(d => d.id == btn.dataset.id);
                if (!item) return;

                document.getElementById('baixaLancamentoId').value = item.id;
                document.getElementById('baixaDescricao').textContent = item.descricao;
                document.getElementById('baixaValor').textContent = `Valor: R$ ${item.valor.toFixed(2)}`;
                document.getElementById('baixaDataPagamento').value = item.dataVencimento;

                const modalEl = document.getElementById('modalBaixa');
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            });
        });

        document.querySelectorAll('.btn-estornar').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Deseja estornar este pagamento? O registro no extrato será removido e o saldo da conta recomposto.')) return;
                try {
                    const response = await fetch(`${API_BASE_URL}/lancamentos/${btn.dataset.id}/estornar`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.ok) {
                        exibirAlerta('Título estornado com sucesso!', 'success');
                        carregarDropdownContas();
                        listarLancamentosPagar();
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
                const item = despesas.find(d => d.id == btn.dataset.id);
                if (item) carregarParaEdicao(item);
            });
        });
    }


    async function executarAcaoPut(id, acao, mensagemConfirmacao) {
        if (!confirm(mensagemConfirmacao)) return;
        try {
            const response = await fetch(`${API_BASE_URL}/lancamentos/${id}/${acao}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                exibirAlerta(acao === 'baixar' ? 'Título baixado com sucesso!' : 'Título estornado com sucesso!', 'success');
                carregarDropdownContas();
                listarLancamentosPagar();
            } else {
                const err = await response.json().catch(() => ({}));
                exibirAlerta(err.message || 'Não foi possível concluir a operação.', 'danger');
            }
        } catch (e) { console.error(e); }
    }

    async function excluirLancamento(id) {
        if (!confirm('Tem certeza que deseja excluir esta despesa em aberto?')) return;
        try {
            const response = await fetch(`${API_BASE_URL}/lancamentos/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                exibirAlerta('Despesa excluída com sucesso!', 'success');
                listarLancamentosPagar();
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

        document.getElementById('tituloFormulario').textContent = `Editando Despesa #${item.id}`;
        document.getElementById('btnSalvarPagar').textContent = 'Salvar Alterações';
        document.getElementById('btnCancelarEdicao').classList.remove('d-none');
        document.getElementById('boxCheckPago').classList.add('d-none');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function resetarFormulario() {
        document.getElementById('formPagar').reset();
        document.getElementById('lancamentoId').value = '';
        document.getElementById('tituloFormulario').textContent = 'Nova Despesa';
        document.getElementById('btnSalvarPagar').textContent = 'Salvar Despesa';
        document.getElementById('btnCancelarEdicao').classList.add('d-none');
        document.getElementById('boxCheckPago').classList.remove('d-none');
    }

    function exibirAlerta(texto, tipo) {
        const alerta = document.getElementById('mensagemAlerta');
        alerta.textContent = texto;
        alerta.className = `alert alert-${tipo} small`;
        alerta.classList.remove('d-none');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token_financas');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Inicializa a tela buscando todos os dados do Java
    carregarDropdownContas();
    carregarDropdownCategoriasReais();
    carregarDropdownCentros(); 
    listarLancamentosPagar();

    // 1. CARREGA AS CONTAS DO USUÁRIO NO DROPDOWN - CENTRALIZADO
    async function carregarDropdownContas() {
        const select = document.getElementById('selectConta');
        try {
            const response = await fetch(`${API_BASE_URL}/contas`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const contas = await response.json();
                select.innerHTML = '<option value="">-- Selecione a Conta --</option>';
                contas.forEach(c => {
                    select.innerHTML += `<option value="${c.id}">${c.nome} (Saldo: R$ ${c.saldoAtual.toFixed(2)})</option>`;
                });
            }
        } catch (e) { console.error('Erro ao carregar contas', e); }
    }

    // 2. CARREGA AS CATEGORIAS FILTRADAS - CENTRALIZADO
    async function carregarDropdownCategoriasReais() {
        const select = document.getElementById('selectCategoria');
        try {
            const response = await fetch(`${API_BASE_URL}/categorias`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const categorias = await response.json();
                select.innerHTML = '<option value="">-- Selecione a Categoria --</option>';
                
                categorias.forEach(cat => {
                    const valorFluxo = cat.fluxo || cat.tipo || 'DESPESA';
                    
                    if (valorFluxo.toString().toUpperCase() === 'DESPESA' && cat.categoriaPai) {
                        select.innerHTML += `<option value="${cat.id}">${cat.nome} (${cat.categoriaPai.nome})</option>`;
                    }
                });
            }
        } catch (e) { console.error('Erro ao carregar categorias reais', e); }
    }

    // 3. CARREGA OS CENTROS DE CUSTO - CENTRALIZADO
    async function carregarDropdownCentros() {
        const select = document.getElementById('selectCentroCusto');
        if (!select) return;
        try {
            const response = await fetch(`${API_BASE_URL}/centros-custo/filtrar?fluxo=DESPESA`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const centros = await response.json();
                select.innerHTML = '<option value="">-- Selecione o Centro de Custo --</option>';
                centros.forEach(centro => {
                    select.innerHTML += `<option value="${centro.id}">${centro.nome}</option>`;
                });
            }
        } catch (e) { console.error('Erro ao carregar centros de custo', e); }
    }

    // 4. SALVA A NOVA DESPESA NO BANCO JAVA - CENTRALIZADO
    document.getElementById('formPagar').addEventListener('submit', async (event) => {
        event.preventDefault();

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
            categoria: { id: parseInt(categoriaId) }
        };

        if (centroCustoId) {
            payload.centroCusto = { id: parseInt(centroCustoId) };
        }

        try {
            const response = await fetch(`${API_BASE_URL}/lancamentos`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alerta.textContent = 'Despesa cadastrada com sucesso!';
                alerta.classList.remove('d-none', 'alert-danger');
                alerta.classList.add('alert-success');
                document.getElementById('formPagar').reset();
                listarLancamentosPagar(); 
            } else {
                const err = await response.json();
                alerta.textContent = err.mensagem || 'Erro ao salvar despesa.';
                alerta.classList.remove('d-none');
                alerta.classList.add('alert-danger');
            }
        } catch (error) { console.error(error); }
    });

    // 5. LISTA AS DESPESAS NA TABELA - CENTRALIZADO
    async function listarLancamentosPagar() {
        const tabela = document.getElementById('tabelaPagar');
        try {
            const response = await fetch(`${API_BASE_URL}/lancamentos`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const lancamentos = await response.json();
                tabela.innerHTML = '';
                
                const despesas = lancamentos.filter(l => l.tipoLancamento === 'DESPESA');

                if (despesas.length === 0) {
                    tabela.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Nenhuma despesa lançada.</td></tr>`;
                    return;
                }

                despesas.forEach(l => {
                    const statusBadge = l.pago ? '<span class="badge bg-success">Paga</span>' : '<span class="badge bg-warning text-dark">Em Aberto</span>';
                    const categoriaNome = l.categoria ? l.categoria.nome : 'N/A';
                    const centroNome = l.centroCusto ? l.centroCusto.nome : 'Padrão';
                    
                    const line = document.createElement('tr');
                    line.innerHTML = `
                        <td>${new Date(l.dataVencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                        <td class="fw-bold">
                            ${l.descricao}
                            <br><small class="text-muted fw-normal">📁 ${categoriaNome} | 🏢 ${centroNome}</small>
                        </td>
                        <td><span class="badge bg-light text-dark border">${l.conta ? l.conta.nome : 'N/A'}</span></td>
                        <td>${statusBadge}</td>
                        <td class="text-end fw-bold text-danger">- R$ ${l.valor.toFixed(2)}</td>
                    `;
                    tabela.appendChild(line);
                });
            }
        } catch (e) { console.error(e); }
    }

    document.getElementById('btnSair').addEventListener('click', () => {
        localStorage.removeItem('token_financas');
        window.location.href = 'index.html';
    });
});
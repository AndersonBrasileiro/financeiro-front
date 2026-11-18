document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token_financas');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Inicializa a tela buscando os dados da Render
    carregarFiltroContas();
    listarMovimentacoes();

    // Ouvintes dos botões de filtro
    document.getElementById('btnFiltrar').addEventListener('click', () => {
        listarMovimentacoes();
    });

    document.getElementById('btnLimparFiltros').addEventListener('click', () => {
        document.getElementById('filtroDataInicio').value = '';
        document.getElementById('filtroDataFim').value = '';
        listarMovimentacoes();
    });

    // 1. CARREGA AS CONTAS DO USUÁRIO NO SELECT DE FILTRO
    async function carregarFiltroContas() {
        const select = document.getElementById('selectContaFiltro');
        try {
            const response = await fetch(`${API_BASE_URL}/contas`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const contas = await response.json();
                select.innerHTML = '<option value="">-- Selecione a Conta --</option>';
                contas.forEach(c => {
                    select.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
                });
            }
        } catch (e) { console.error('Erro ao carregar filtro de contas', e); }
    }

    // Helper para extrair YYYY-MM-DD com segurança (suporta Array ou String ISO)
    function extrairDataISO(dataBruta) {
        if (!dataBruta) return '';
        if (Array.isArray(dataBruta)) {
            const [ano, mes, dia] = dataBruta;
            return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        }
        return dataBruta.toString().split('T')[0];
    }

    // 2. BUSCA E LISTA AS MOVIMENTAÇÕES NA TABELA - MATEMÁTICA DE SALDO PROGRESSIVO + PERÍODO
    async function listarMovimentacoes() {
        const tabela = document.getElementById('tabelaExtrato');
        const contaSelecionadaId = document.getElementById('selectContaFiltro').value;
        const dataInicio = document.getElementById('filtroDataInicio').value;
        const dataFim = document.getElementById('filtroDataFim').value;
        
        if (!contaSelecionadaId) {
            tabela.innerHTML = `<tr><td colspan="6" class="text-center text-warning py-4">⚠️ Por favor, selecione uma Conta Bancária específica para visualizar o extrato.</td></tr>`;
            return;
        }

        tabela.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Carregando movimentações...</td></tr>`;

        try {
            const response = await fetch(`${API_BASE_URL}/movimentacoes/conta/${contaSelecionadaId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                let movimentacoes = await response.json();

                if (movimentacoes.length === 0) {
                    tabela.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Nenhuma movimentação encontrada para esta conta.</td></tr>`;
                    return;
                }

                // 1º Passo: Ordena cronologicamente (mais antigas primeiro) para calcular o saldo histórico real
                movimentacoes.sort((a, b) => {
                    const dataA = extrairDataISO(a.dataHora || a.dataMovimentacao || a.data);
                    const dataB = extrairDataISO(b.dataHora || b.dataMovimentacao || b.data);
                    return dataA.localeCompare(dataB) || a.id - b.id;
                });

                let saldoAcumulado = 0;

                movimentacoes.forEach(m => {
                    const tipoOriginal = m.tipoMovimentacao || m.tipo || 'SAIDA';
                    const isEntrada = tipoOriginal.toString().toUpperCase() === 'ENTRADA' || tipoOriginal.toString().toUpperCase() === 'RECEITA';
                    
                    if (isEntrada) {
                        saldoAcumulado += m.valor;
                    } else {
                        saldoAcumulado -= m.valor;
                    }
                    
                    m.saldoNoMomento = saldoAcumulado;
                    m.dataISO = extrairDataISO(m.dataHora || m.dataMovimentacao || m.data);
                });

                // 2º Passo: Filtra o período selecionado mantendo o saldo histórico exato de cada movimentação
                if (dataInicio) {
                    movimentacoes = movimentacoes.filter(m => m.dataISO >= dataInicio);
                }
                if (dataFim) {
                    movimentacoes = movimentacoes.filter(m => m.dataISO <= dataFim);
                }

                tabela.innerHTML = '';

                if (movimentacoes.length === 0) {
                    tabela.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Nenhuma movimentação encontrada para o período selecionado.</td></tr>`;
                    return;
                }

                // 3º Passo: Inverte a lista para exibir as mais recentes no topo da tabela
                movimentacoes.sort((a, b) => {
                    return b.dataISO.localeCompare(a.dataISO) || b.id - a.id;
                });

                // 4º Passo: Renderiza as linhas na tela
                movimentacoes.forEach(m => {
                    const tipoOriginal = m.tipoMovimentacao || m.tipo || 'SAIDA';
                    const isEntrada = tipoOriginal.toString().toUpperCase() === 'ENTRADA' || tipoOriginal.toString().toUpperCase() === 'RECEITA';
                    
                    const tipoTexto = isEntrada ? 'Entrada' : 'Saída';
                    const badgeCor = isEntrada ? 'bg-success' : 'bg-danger';
                    const valorCor = isEntrada ? 'text-success' : 'text-danger';
                    const sinal = isEntrada ? '+' : '-';
                    const contaNome = m.conta ? m.conta.nome : 'N/A';

                    let dataExibicao = 'N/A';
                    if (m.dataISO) {
                        const [ano, mes, dia] = m.dataISO.split('-');
                        dataExibicao = `${dia}/${mes}/${ano}`;
                    }

                    const saldoCor = m.saldoNoMomento >= 0 ? 'text-primary' : 'text-danger';

                    const linha = document.createElement('tr');
                    linha.innerHTML = `
                        <td>${dataExibicao}</td>
                        <td class="fw-bold text-dark">${m.historico || 'Movimentação Automática por Baixa'}</td>
                        <td><span class="badge bg-light text-dark border">${contaNome}</span></td>
                        <td><span class="badge ${badgeCor}">${tipoTexto}</span></td>
                        <td class="text-end fw-bold ${valorCor}">${sinal} R$ ${m.valor.toFixed(2)}</td>
                        <td class="text-end fw-bold ${saldoCor}">R$ ${m.saldoNoMomento.toFixed(2)}</td>
                    `;
                    tabela.appendChild(linha);
                });
            } else {
                tabela.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Erro ao ler dados do servidor (Status: ${response.status}).</td></tr>`;
            }
        } catch (error) { 
            console.error(error); 
            tabela.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Erro de conexão com o backend.</td></tr>`;
        }
    }

    document.getElementById('btnSair')?.addEventListener('click', () => {
        localStorage.removeItem('token_financas');
        window.location.href = 'index.html';
    });
});

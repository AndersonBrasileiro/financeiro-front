document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token_financas');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Inicializa a tela buscando os dados da Render
    carregarFiltroContas();
    listarMovimentacoes();

    // Ouvinte do botão de filtro
    document.getElementById('btnFiltrar').addEventListener('click', () => {
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

    // 2. BUSCA E LISTA AS MOVIMENTAÇÕES NA TABELA - MATEMÁTICA DE SALDO PROGRESSIVO
    async function listarMovimentacoes() {
        const tabela = document.getElementById('tabelaExtrato');
        const contaSelecionadaId = document.getElementById('selectContaFiltro').value;
        
        if (!contaSelecionadaId) {
            tabela.innerHTML = `<tr><td colspan="6" class="text-center text-warning py-4">⚠️ Por favor, selecione uma Conta Bancária específica para visualizar o extrato.</td></tr>`;
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/movimentacoes/conta/${contaSelecionadaId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const movimentacoes = await response.json();
                tabela.innerHTML = '';

                if (movimentacoes.length === 0) {
                    tabela.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Nenhuma movimentação encontrada para esta conta.</td></tr>`;
                    return;
                }

                // 📈 ALGORITMO BANCÁRIO: Ordena cronologicamente pela data real (mais antigas primeiro) para calcular o saldo progressivo
                movimentacoes.sort((a, b) => {
                    const dataA = new Date(a.dataHora || a.dataMovimentacao || a.data || 0);
                    const dataB = new Date(b.dataHora || b.dataMovimentacao || b.data || 0);
                    return dataA - dataB || a.id - b.id;
                });

                let saldoAcumulado = 0;

                // Primeiro passo: Injeta o cálculo do saldo sequencial em cada objeto
                movimentacoes.forEach(m => {
                    const tipoOriginal = m.tipoMovimentacao || m.tipo || 'SAIDA';
                    const isEntrada = tipoOriginal.toString().toUpperCase() === 'ENTRADA' || tipoOriginal.toString().toUpperCase() === 'RECEITA';
                    
                    if (isEntrada) {
                        saldoAcumulado += m.valor;
                    } else {
                        saldoAcumulado -= m.valor;
                    }
                    
                    m.saldoNoMomento = saldoAcumulado;
                });

                // Segundo passo: Inverte a lista para exibir as mais recentes no topo da tabela
                movimentacoes.sort((a, b) => {
                    const dataA = new Date(a.dataHora || a.dataMovimentacao || a.data || 0);
                    const dataB = new Date(b.dataHora || b.dataMovimentacao || b.data || 0);
                    return dataB - dataA || b.id - a.id;
                });

                // Terceiro passo: Renderiza as linhas na tela
                movimentacoes.forEach(m => {
                    const tipoOriginal = m.tipoMovimentacao || m.tipo || 'SAIDA';
                    const isEntrada = tipoOriginal.toString().toUpperCase() === 'ENTRADA' || tipoOriginal.toString().toUpperCase() === 'RECEITA';
                    
                    const tipoTexto = isEntrada ? 'Entrada' : 'Saída';
                    const badgeCor = isEntrada ? 'bg-success' : 'bg-danger';
                    const valorCor = isEntrada ? 'text-success' : 'text-danger';
                    const sinal = isEntrada ? '+' : '-';
                    
                    const contaNome = m.conta ? m.conta.nome : 'N/A';

                    // Formatação segura da data vinda do campo dataHora do Java
                    const dataBruta = m.dataHora || m.dataMovimentacao || m.data;
                    let dataExibicao = 'N/A';
                    if (dataBruta) {
                        const apenasData = dataBruta.toString().split('T');
                        const [ano, mes, dia] = apenasData.split('-');
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

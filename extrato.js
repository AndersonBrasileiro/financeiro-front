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
                // Mantém a opção padrão e adiciona as contas reais
                select.innerHTML = '<option value="">-- Todas as Contas --</option>';
                contas.forEach(c => {
                    select.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
                });
            }
        } catch (e) { console.error('Erro ao carregar filtro de contas', e); }
    }

    // 2. BUSCA E LISTA AS MOVIMENTAÇÕES NA TABELA - ALINHADO COM O SEU JAVA
    async function listarMovimentacoes() {
        const tabela = document.getElementById('tabelaExtrato');
        const contaSelecionadaId = document.getElementById('selectContaFiltro').value;
        
        // 🌟 REGRA DE NEGÓCIO: Como seu Java exige o ID da conta, alertamos o usuário se ele não escolher uma
        if (!contaSelecionadaId) {
            tabela.innerHTML = `<tr><td colspan="5" class="text-center text-warning py-4">⚠️ Por favor, selecione uma Conta Bancária específica para visualizar o extrato.</td></tr>`;
            return;
        }

        try {
            // 🌟 CORRIGIDO: Batendo exatamente na rota exigida pelo seu Controller Java!
            const response = await fetch(`${API_BASE_URL}/movimentacoes/conta/${contaSelecionadaId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const movimentacoes = await response.json();
                tabela.innerHTML = '';

                if (movimentacoes.length === 0) {
                    tabela.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Nenhuma movimentação encontrada para esta conta.</td></tr>`;
                    return;
                }

                // Ordena por ID decrescente (mais recentes primeiro)
                movimentacoes.sort((a, b) => b.id - a.id);

                movimentacoes.forEach(m => {
                    const tipoOriginal = m.tipoMovimentacao || m.tipo || 'SAIDA';
                    const isEntrada = tipoOriginal.toString().toUpperCase() === 'ENTRADA' || tipoOriginal.toString().toUpperCase() === 'RECEITA';
                    
                    const tipoTexto = isEntrada ? 'Entrada' : 'Saída';
                    const badgeCor = isEntrada ? 'bg-success' : 'bg-danger';
                    const valorCor = isEntrada ? 'text-success' : 'text-danger';
                    const sinal = isEntrada ? '+' : '-';
                    
                    const contaNome = m.conta ? m.conta.nome : 'N/A';
                    const dataFormatada = m.dataMovimentacao || m.data || new Date();

                    const linha = document.createElement('tr');
                    linha.innerHTML = `
                        <td>${new Date(dataFormatada).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                        <td class="fw-bold text-dark">${m.descricao || 'Movimentação Automática por Baixa'}</td>
                        <td><span class="badge bg-light text-dark border">${contaNome}</span></td>
                        <td><span class="badge ${badgeCor}">${tipoTexto}</span></td>
                        <td class="text-end fw-bold ${valorCor}">${sinal} R$ ${m.valor.toFixed(2)}</td>
                    `;
                    tabela.appendChild(linha);
                });
            } else {
                tabela.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Erro ao ler dados do servidor (Status: ${response.status}).</td></tr>`;
            }
        } catch (error) { 
            console.error(error); 
            tabela.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Erro de conexão com o backend.</td></tr>`;
        }
    }


    document.getElementById('btnSair').addEventListener('click', () => {
        localStorage.removeItem('token_financas');
        window.location.href = 'index.html';
    });
});


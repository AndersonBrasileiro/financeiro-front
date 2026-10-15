document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token_financas');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Inicializa a tela buscando todos os dados reais de receita do Java
    carregarDropdownContas();
    carregarDropdownCategoriasReais();
    carregarDropdownCentrosReceita(); // Ativado no topo de forma independente!
    listarLancamentosReceber();

    // 1. CARREGA AS CONTAS DO USUÁRIO NO DROPDOWN
    async function carregarDropdownContas() {
        const select = document.getElementById('selectConta');
        try {
            const response = await fetch('http://localhost:8080/api/contas', {
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

        // 2. CORRIGIDO WITH TRAVA: Carrega APENAS subcategorias (filhas) do tipo "RECEITA"
    async function carregarDropdownCategoriasReais() {
        const select = document.getElementById('selectCategoria');
        try {
            const response = await fetch('http://localhost:8080/api/categorias', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const categorias = await response.json();
                select.innerHTML = '<option value="">-- Selecione a Categoria --</option>';
                
                categorias.forEach(cat => {
                    const valorFluxo = cat.fluxo || cat.tipo || 'DESPESA';
                    
                    // 🌟 REGRA DE NEGÓCIO: Só exibe se for RECEITA E se possuir uma Categoria Pai (é filha)
                    if (valorFluxo.toString().toUpperCase() === 'RECEITA' && cat.categoriaPai) {
                        select.innerHTML += `<option value="${cat.id}">${cat.nome} (${cat.categoriaPai.nome})</option>`;
                    }
                });
            }
        } catch (e) { console.error('Erro ao carregar categorias reais', e); }
    }


    // 3. CARREGA OS CENTROS DE CUSTO FILTRADOS POR "RECEITA"
    async function carregarDropdownCentrosReceita() {
        const select = document.getElementById('selectCentroCusto');
        if (!select) return; // Evita erros se o campo não estiver no HTML ainda
        try {
            const response = await fetch('http://localhost:8080/api/centros-custo/filtrar?fluxo=RECEITA', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const centros = await response.json();
                select.innerHTML = '<option value="">-- Selecione o Centro de Receita --</option>';
                centros.forEach(centro => {
                    select.innerHTML += `<option value="${centro.id}">${centro.nome}</option>`;
                });
            }
        } catch (e) { console.error('Erro ao carregar centros de receita', e); }
    }

    // 4. SALVA O NOVO LANÇAMENTO DE RECEITA (POST VINCULANDO AMBOS OS CAMPOS)
    document.getElementById('formReceber').addEventListener('submit', async (event) => {
        event.preventDefault();

        const descricao = document.getElementById('descricao').value;
        const valor = parseFloat(document.getElementById('valor').value);
        const dataVencimento = document.getElementById('dataVencimento').value;
        const contaId = document.getElementById('selectConta').value;
        const categoriaId = document.getElementById('selectCategoria').value;
        
        // Captura o ID do Centro de Custo/Receita se ele existir na tela
        const selectCentro = document.getElementById('selectCentroCusto');
        const centroCustoId = selectCentro ? selectCentro.value : '';
        
        const pago = document.getElementById('recebido').checked; 
        const alerta = document.getElementById('mensagemAlerta');

        alerta.classList.add('d-none');

        const payload = {
            descricao,
            valor,
            dataVencimento,
            pago,
            tipoLancamento: "RECEITA", 
            conta: { id: parseInt(contaId) },
            categoria: { id: parseInt(categoriaId) }
        };

        // Se houver um Centro de Receita selecionado, anexa no JSON
        if (centroCustoId) {
            payload.centroCusto = { id: parseInt(centroCustoId) };
        }

        try {
            const response = await fetch('http://localhost:8080/api/lancamentos', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alerta.textContent = 'Receita cadastrada com sucesso!';
                alerta.classList.remove('d-none', 'alert-danger');
                alerta.classList.add('alert-success');
                document.getElementById('formReceber').reset();
                listarLancamentosReceber(); 
            } else {
                const err = await response.json();
                alerta.textContent = err.mensagem || 'Erro ao salvar receita.';
                alerta.classList.remove('d-none');
                alerta.classList.add('alert-danger');
            }
        } catch (error) { console.error(error); }
    });

    // 5. LISTA AS RECEITAS NA TABELA EXIBINDO CATEGORIA E CENTRO
    async function listarLancamentosReceber() {
        const tabela = document.getElementById('tabelaReceber');
        try {
            const response = await fetch('http://localhost:8080/api/lancamentos', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const lancamentos = await response.json();
                tabela.innerHTML = '';
                
                const receitas = lancamentos.filter(l => l.tipoLancamento === 'RECEITA');

                if (receitas.length === 0) {
                    tabela.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Nenhuma receita lançada.</td></tr>`;
                    return;
                }

                receitas.forEach(l => {
                    const statusBadge = l.pago ? '<span class="badge bg-success">Recebida</span>' : '<span class="badge bg-warning text-dark">A Receber</span>';
                    const categoriaNome = l.categoria ? l.categoria.nome : 'N/A';
                    const centroNome = l.centroCusto ? l.centroCusto.nome : 'Padrão';

                    const linha = document.createElement('tr');
                    linha.innerHTML = `
                        <td>${new Date(l.dataVencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                        <td class="fw-bold">
                            ${l.descricao}
                            <br><small class="text-muted fw-normal">📁 ${categoriaNome} | 🏢 ${centroNome}</small>
                        </td>
                        <td><span class="badge bg-light text-dark border">${l.conta ? l.conta.nome : 'N/A'}</span></td>
                        <td>${statusBadge}</td>
                        <td class="text-end fw-bold text-success">+ R$ ${l.valor.toFixed(2)}</td>
                    `;
                    tabela.appendChild(linha);
                });
            }
        } catch (e) { console.error(e); }
    }

    document.getElementById('btnSair').addEventListener('click', () => {
        localStorage.removeItem('token_financas');
        window.location.href = 'index.html';
    });
});

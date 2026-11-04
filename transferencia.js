document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token_financas');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Define a data de hoje como padrão no campo de data
    document.getElementById('inputData').value = new Date().toISOString().split('T')[0];

    // Inicializa a tela buscando as contas do usuário para os seletores
    carregarContasNosSelects();

    // Ouvinte do formulário de transferência
    document.getElementById('formTransferencia').addEventListener('submit', async (e) => {
        e.preventDefault();
        executarTransferencia();
    });

    // Botão Cancelar redireciona para o Dashboard
    document.getElementById('btnCancelar').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });

    // 1. BUSCA AS CONTAS DO USUÁRIO E PREENCHE OS SELETORES DE ORIGEM E DESTINO
    async function carregarContasNosSelects() {
        const selectOrigem = document.getElementById('selectContaOrigem');
        const selectDestino = document.getElementById('selectContaDestino');

        try {
            const response = await fetch(`${API_BASE_URL}/contas`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const contas = await response.json();
                
                // Limpa e preenche o select de Origem
                selectOrigem.innerHTML = '<option value="">-- Selecione a Origem --</option>';
                // Limpa e preenche o select de Destino
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

        // 2. DISPARA O POST DE TRANSFERÊNCIA PARA O BACKEND JAVA
    async function executarTransferencia() {
        const contaOrigemId = document.getElementById('selectContaOrigem').value;
        const contaDestinoId = document.getElementById('selectContaDestino').value;
        const valor = parseFloat(document.getElementById('inputValor').value);
        const data = document.getElementById('inputData').value;
        const observacao = document.getElementById('inputObservacao').value;

        // Validação comercial básica
        if (contaOrigemId === contaDestinoId) {
            exibirAlerta('⚠️ A conta de destino não pode ser igual à conta de origem.', 'warning');
            return;
        }

        // 🌟 SINTONIZADO COM O SEU MODEL JAVA: Aninhando os IDs dentro de sub-objetos de Conta
        const dadosTransferencia = {
            descricao: observacao || "Transferência entre Contas", // Mapeado para 'descricao' no Java
            valor: valor,                                         // Mapeado para 'valor' no Java
            dataTransferencia: data,                              // Mapeado para 'dataTransferencia' no Java
            contaOrigem: { id: parseInt(contaOrigemId) },         // Mapeado para a entidade 'contaOrigem'
            contaDestino: { id: parseInt(contaDestinoId) }        // Mapeado para a entidade 'contaDestino'
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
                exibirAlerta('✅ Transferência executada com sucesso absoluto!', 'success');
                document.getElementById('formTransferencia').reset();
                document.getElementById('inputData').value = new Date().toISOString().split('T')[0];
                carregarContasNosSelects();
            } else {
                const erroTexto = await response.text();
                exibirAlerta(`Erro do servidor (Status ${response.status}): ${erroTexto || 'Falha na operação.'}`, 'danger');
            }
        } catch (error) {
            console.error('Erro na transferência:', error);
            exibirAlerta('Erro de conexão com o backend.', 'danger');
        }
    }


    // FUNÇÃO AUXILIAR: Exibe alertas dinâmicos na tela
    function exibirAlerta(mensagem, tipo) {
        const alerta = document.getElementById('alertaFeedback');
        alerta.className = `alert alert-${tipo}`;
        alerta.innerText = mensagem;
        alerta.classList.remove('d-none');
        
        // Rola a página suavemente para o topo do formulário para ver o aviso no celular
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.getElementById('btnSair').addEventListener('click', () => {
        localStorage.removeItem('token_financas');
        window.location.href = 'index.html';
    });
});

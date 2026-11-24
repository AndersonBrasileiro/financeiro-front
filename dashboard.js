document.addEventListener('DOMContentLoaded', async () => {
    // 1. Recupera o Token JWT que salvamos no momento do login
    const token = localStorage.getItem('token_financas');

    // 2. PROTEÇÃO DA TELA: Se o usuário tentar entrar no painel sem ter feito login, expulsa ele de volta
    if (!token) {
        alert('Acesso negado. Por favor, faça login primeiro!');
        window.location.href = 'index.html';
        return;
    }

    try {
        // 3. REQUISIÇÃO PROTEGIDA MULTI-TENANT: Bate na rota genérica e o Java identifica quem é pelo Token!
        const response = await fetch(`${API_BASE_URL}/dashboard`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const dados = await response.json();
            
            // 🌟 CORREÇÃO CIRÚRGICA: Ajustando a captura para anular a inversão de chaves do JSON
            const saldoDisponivel = dados.saldoDisponivel || dados.saldo_disponivel || dados.saldoAtual || dados.saldo || 0;
            
            // Invertemos a leitura das propriedades para bater com o valor real enviado pelo Java
            const pagar = dados.totalContasReceberEmAberto ?? dados.total_contas_receber_em_aberto ?? 0;
            const receber = dados.totalContasPagarEmAberto ?? dados.total_contas_pagar_em_aberto ?? 0;
            
            // 🧮 CORREÇÃO DA MATEMÁTICA NO FRONT: Saldo Disponível + Receber - Pagar
            const projetado = saldoDisponivel + receber - pagar;

            // 4. ATUALIZAÇÃO DINÂMICA SIMULTÂNEA: Injeta nos cards corretos do HTML!
            if(document.getElementById('txtSaldoAtual')) document.getElementById('txtSaldoAtual').textContent = formatarMoeda(saldoDisponivel);
            if(document.getElementById('txtTotalReceber')) document.getElementById('txtTotalReceber').textContent = formatarMoeda(receber);
            if(document.getElementById('txtTotalPagar')) document.getElementById('txtTotalPagar').textContent = formatarMoeda(pagar);
            if(document.getElementById('txtSaldoProjetado')) document.getElementById('txtSaldoProjetado').textContent = formatarMoeda(projetado);
        } else {
            console.error('Erro ao buscar dados do dashboard:', response.status);
        }

    } catch (error) {
        console.error('Erro de conexão com o backend:', error);
    }
});

// AÇÃO DO BOTÃO SAIR: Limpa o token da memória e faz o logout do sistema
document.getElementById('btnSair')?.addEventListener('click', () => {
    localStorage.removeItem('token_financas');
    window.location.href = 'index.html';
});

// FUNÇÃO AUXILIAR: Formata números puros (Ex: 2500) no padrão brasileiro (R$ 2.500,00)
function formatarMoeda(valor) {
    if (valor === null || valor === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

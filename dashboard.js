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
            
            // Rastreador preventivo para imprimir os dados no console
            console.log("Dados recebidos do Java com sucesso:", dados);

            // Tenta mapear pelas nomes longos ou curtos do DTO de forma 100% segura
            const saldoDisponivel = dados.saldoDisponivel || dados.saldoAtual || dados.saldo || 0;
            const receber = dados.totalContasReceberEmAberto ?? dados.totalReceber ?? dados.receber ?? 0;
            const pagar = dados.totalContasPagarEmAberto ?? dados.totalPagar ?? dados.pagar ?? 0;
            const projetado = dados.saldoProjetadoFuturo ?? dados.saldoProjetado ?? dados.projetado ?? 0;

            // 4. ATUALIZAÇÃO DINÂMICA SINCROIZADA: Substitui os valores nas tags HTML corretas!
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

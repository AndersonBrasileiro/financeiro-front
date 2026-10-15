// Executa o código automaticamente assim que a página terminar de carregar na tela
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
        // 3. 🌟 ATUALIZADO: Ajustado para o ID 1, que é o seu usuário real cadastrado na tela agora!
        // (Nota: Se o seu backend já aceitar a rota genérica '/api/dashboard' sem ID na URL, pode mudar para ela)
        const response = await fetch('http://localhost:8080/api/dashboard/usuario/1', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`, // Injeta o passaporte de letrinhas na catraca!
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const dados = await response.json();

            // 4. ATUALIZAÇÃO DINÂMICA: Substitui o "R\$ 0,00" do HTML pelos valores reais calculados pelo banco Java!
            document.getElementById('totalReceber').textContent = formatarMoeda(dados.totalContasReceberEmAberto);
            document.getElementById('totalPagar').textContent = formatarMoeda(dados.totalContasPagarEmAberto);
            document.getElementById('saldoProjetado').textContent = formatarMoeda(dados.saldoProjetadoFuturo);
        } else {
            console.error('Erro ao buscar dados do dashboard:', response.status);
        }

    } catch (error) {
        console.error('Erro de conexão com o backend:', error);
    }
});

// AÇÃO DO BOTÃO SAIR: Limpa o token da memória e faz o logout do sistema
document.getElementById('btnSair').addEventListener('click', () => {
    localStorage.removeItem('token_financas');
    window.location.href = 'index.html';
});

// FUNÇÃO AUXILIAR: Formata números puros (Ex: 2500) no padrão brasileiro (R\$ 2.500,00)
function formatarMoeda(valor) {
    if (valor === null || valor === undefined) return 'R\$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

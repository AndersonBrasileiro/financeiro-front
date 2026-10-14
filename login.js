// Captura o evento de envio do formulário HTML
document.getElementById('formLogin').addEventListener('submit', async (event) => {
    event.preventDefault(); // Impede a página de recarregar na hora do clique

    // 1. Coleta os dados digitados na tela pelo usuário
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const msgErro = document.getElementById('mensagemErro');

    // Limpa mensagens de erro de tentativas anteriores
    msgErro.classList.add('d-none');
    msgErro.textContent = '';

    try {
        // 2. Dispara a requisição HTTP contra o nosso endpoint Java local
        const response = await fetch('http://localhost:8080/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, senha }) // Transforma os dados em JSON comercial
        });

        // 3. ANALISA A RESPOSTA: Se der sucesso (Status 200)
        if (response.ok) {
            const data = await response.json();
            
            // 4. PERSISTÊNCIA LOCA: Guarda o token JWT na memória secreta do navegador
            localStorage.setItem('token_financas', data.token);

            // Redireciona o usuário para a tela principal (Dashboard) que criaremos a seguir
            window.location.href = 'dashboard.html';
        } else {
            // 5. SE DEU ERRO (400 ou 403): Captura o nosso JSON amigável do GlobalExceptionHandler!
            const erroData = await response.json();
            msgErro.textContent = erroData.mensagem || 'E-mail ou senha inválidos.';
            msgErro.classList.remove('d-none'); // Exibe o alerta vermelho na tela
        }

    } catch (error) {
        // Trata quedas de conexão (Ex: se o Spring Boot estiver desligado)
        msgErro.textContent = 'Erro ao conectar com o servidor. Certifique-se de que o backend está rodando!';
        msgErro.classList.remove('d-none');
    }
});

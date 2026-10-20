document.getElementById('formRegistrar').addEventListener('submit', async (event) => {
    event.preventDefault(); // Impede a página de recarregar

    // 1. Coleta os valores dos campos da tela
    const nome = document.getElementById('nome').value;
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const alerta = document.getElementById('mensagemAlerta');

    // Limpa estados anteriores do alerta
    alerta.classList.add('d-none');
    alerta.classList.remove('alert-danger', 'alert-success');
    alerta.textContent = '';

    try {
        // 2. Dispara a requisição de cadastro para o endpoint público do Java
        const response = await fetch(`${API_BASE_URL}/auth/registrar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nome, email, senha })
        });

        // 3. Verifica o sucesso do cadastro (Status 201 Created)
        if (response.ok) {
            alerta.textContent = 'Cadastro realizado com sucesso! Redirecionando para o login...';
            alerta.classList.remove('d-none');
            alerta.classList.add('alert-success');

            // Aguarda 2 segundos para o usuário ler a mensagem e joga ele para a tela de login
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);

        } else {
            // 4. Captura o erro tratado pelo nosso GlobalExceptionHandler do Backend
            const erroData = await response.json();
            alerta.textContent = erroData.mensagem || 'Erro ao realizar o cadastro. Tente novamente.';
            alerta.classList.remove('d-none');
            alerta.classList.add('alert-danger');
        }

    } catch (error) {
        alerta.textContent = 'Não foi possível conectar ao servidor. Certifique-se de que o backend está rodando!';
        alerta.classList.remove('d-none');
        alerta.classList.add('alert-danger');
    }
});

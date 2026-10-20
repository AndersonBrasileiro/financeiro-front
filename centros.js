document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token_financas');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    listarCentros();

    // 1. ADICIONAR NOVO CENTRO (POST) - CENTRALIZADO
    document.getElementById('formCentro').addEventListener('submit', async (event) => {
        event.preventDefault();

        const nome = document.getElementById('nomeCentro').value;
        const valorSelecionado = document.getElementById('fluxoCentro').value;
        const alerta = document.getElementById('mensagemAlerta');

        alerta.classList.add('d-none');

        try {
            const response = await fetch(`${API_BASE_URL}/centros-custo`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nome: nome,
                    fluxo: valorSelecionado,
                    tipo: valorSelecionado
                })
            });

            if (response.ok) {
                alerta.textContent = 'Centro cadastrado com sucesso!';
                alerta.classList.remove('d-none', 'alert-danger');
                alerta.classList.add('alert-success');
                document.getElementById('formCentro').reset();
                listarCentros(); 
            } else {
                const err = await response.json();
                alerta.textContent = err.mensagem || 'Erro ao salvar o centro.';
                alerta.classList.remove('d-none');
                alerta.classList.add('alert-danger');
            }
        } catch (error) {
            alerta.textContent = 'Erro de conexão com o servidor.';
            alerta.classList.remove('d-none');
            alerta.classList.add('alert-danger');
        }
    });

    // 2. LISTAR CENTROS ATIVOS (GET) - CENTRALIZADO
    async function listarCentros() {
        const tabela = document.getElementById('tabelaCentros');
        try {
            tabela.innerHTML = ''; 

            // Bate no seu endpoint Java da Render pedindo os Custos (DESPESA)
            const resCustos = await fetch(`${API_BASE_URL}/centros-custo/filtrar?fluxo=DESPESA`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // Bate no seu endpoint Java da Render pedindo as Receitas (RECEITA)
            const resReceitas = await fetch(`${API_BASE_URL}/centros-custo/filtrar?fluxo=RECEITA`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            let listaCompleta = [];

            if (resCustos.ok) {
                const custos = await resCustos.json();
                listaCompleta = listaCompleta.concat(custos);
            }
            if (resReceitas.ok) {
                const receitas = await resReceitas.json();
                listaCompleta = listaCompleta.concat(receitas);
            }

            if (!resCustos.ok && !resReceitas.ok) {
                tabela.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Erro de autorização no servidor (403).</td></tr>`;
                return;
            }

            if (listaCompleta.length === 0) {
                tabela.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-3">Nenhum centro cadastrado.</td></tr>`;
                return;
            }

            listaCompleta.sort((a, b) => a.id - b.id);

            listaCompleta.forEach(c => {
                const valorFluxo = c.fluxo || c.tipo || 'DESPESA';
                const tipoTexto = (valorFluxo.toString().toUpperCase() === 'RECEITA') ? 'Receita' : 'Custo';
                const badgeCor = tipoTexto === 'Receita' ? 'bg-success' : 'bg-danger';

                const linha = document.createElement('tr');
                linha.innerHTML = `
                    <td><span class="badge bg-secondary">${c.id}</span></td>
                    <td class="fw-bold text-dark">${c.nome || 'Sem Nome'}</td>
                    <td><span class="badge ${badgeCor}">${tipoTexto}</span></td>
                `;
                tabela.appendChild(linha);
            });

        } catch (e) {
            console.error('Erro de rede ou processamento:', e);
            tabela.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Erro ao renderizar a tabela na tela.</td></tr>`;
        }
    }

    document.getElementById('btnSair').addEventListener('click', () => {
        localStorage.removeItem('token_financas');
        window.location.href = 'index.html';
    });
});
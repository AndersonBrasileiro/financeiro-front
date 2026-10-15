document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token_financas');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    listarCategorias();
    carregarDropdownCategoriasPai();

    // 1. ADICIONAR NOVA CATEGORIA / SUBCATEGORIA (POST)
    document.getElementById('formCategoria').addEventListener('submit', async (event) => {
        event.preventDefault();

        const nome = document.getElementById('nomeCategoria').value;
        const valorSelecionado = document.getElementById('tipoCategoria').value;
        const categoriaPaiId = document.getElementById('selectCategoriaPai').value;
        const alerta = document.getElementById('mensagemAlerta');

        alerta.classList.add('d-none');

        // Mapeamento triplo preventivo para casar com qualquer nome de atributo da sua Entidade Java
        const payload = {
            nome: nome,
            fluxo: valorSelecionado,
            tipo: valorSelecionado
        };

        // Se o usuário escolheu um pai no seletor, anexa o objeto relacional
        if (categoriaPaiId) {
            const objRelacional = { id: parseInt(categoriaPaiId) };
            payload.categoriaPai = objRelacional;
            payload.pai = objRelacional;
            payload.categoriaPrincipal = objRelacional;
        }

        try {
            const response = await fetch('http://localhost:8080/api/categorias', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alerta.textContent = 'Categoria cadastrada com sucesso!';
                alerta.classList.remove('d-none', 'alert-danger');
                alerta.classList.add('alert-success');
                document.getElementById('formCategoria').reset();
                listarCategorias(); 
                carregarDropdownCategoriasPai(); // Atualiza o seletor com a nova pai
            } else {
                const err = await response.json();
                alerta.textContent = err.mensagem || 'Erro ao salvar a categoria.';
                alerta.classList.remove('d-none');
                alerta.classList.add('alert-danger');
            }
        } catch (error) {
            alerta.textContent = 'Erro de conexão com o servidor.';
            alerta.classList.remove('d-none');
            alerta.classList.add('alert-danger');
        }
    });

    // 2. LISTAR TODAS AS CATEGORIAS NA TABELA
    async function listarCategorias() {
        const tabela = document.getElementById('tabelaCategorias');
        try {
            const response = await fetch('http://localhost:8080/api/categorias', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const categorias = await response.json();
                tabela.innerHTML = ''; 

                if (!categorias || categorias.length === 0) {
                    tabela.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-3">Nenhuma categoria cadastrada.</td></tr>`;
                    return;
                }

                categorias.forEach(c => {
                    const valorFluxo = c.fluxo || c.tipo || 'DESPESA';
                    const tipoTexto = (valorFluxo.toString().toUpperCase() === 'RECEITA') ? 'Receita' : 'Custo';
                    const badgeCor = tipoTexto === 'Receita' ? 'bg-success' : 'bg-danger';

                    // Verifica de forma segura se há um objeto pai associado em qualquer nomenclatura
                    const objetoPai = c.categoriaPai || c.pai || c.categoriaPrincipal;
                    
                    const nomeExibicao = objetoPai 
                        ? `${c.nome} <small class="text-muted">(Sub de ${objetoPai.nome})</small>` 
                        : `📁 <b>${c.nome}</b>`;

                    const linha = document.createElement('tr');
                    linha.innerHTML = `
                        <td><span class="badge bg-secondary">${c.id}</span></td>
                        <td>${nomeExibicao}</td>
                        <td><span class="badge ${badgeCor}">${tipoTexto}</span></td>
                    `;
                    tabela.appendChild(linha);
                });
            } else {
                tabela.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Erro de resposta do servidor (${response.status}).</td></tr>`;
            }
        } catch (e) {
            console.error(e);
            tabela.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Erro ao renderizar a tabela na tela.</td></tr>`;
        }
    }

        // 3. CORRIGIDO: Carrega dinamicamente as categorias pai direto da API unificada
    async function carregarDropdownCategoriasPai() {
        const select = document.getElementById('selectCategoriaPai');
        if (!select) return;

        try {
            // Bate na rota principal unificada que criamos no CategoriaController
            const response = await fetch('http://localhost:8080/api/categorias', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const todasCategorias = await response.json();
                select.innerHTML = '<option value="">-- Nenhuma (Esta será uma Categoria Pai) --</option>';
                
                // Filtra no front-end: só vira opção no dropdown se for uma Categoria Nível 1 (Pai é null)
                todasCategorias.forEach(cat => {
                    const objetoPai = cat.categoriaPai || cat.pai || cat.categoriaPrincipal;
                    
                    if (!objetoPai) { // Se não tem pai, ela é uma categoria principal legítima!
                        const valorFluxo = cat.tipo || cat.fluxo || 'DESPESA';
                        const tipoTexto = valorFluxo.toString().toUpperCase() === 'RECEITA' ? 'Receita' : 'Custo';
                        select.innerHTML += `<option value="${cat.id}">${cat.nome} (${tipoTexto})</option>`;
                    }
                });
            }
        } catch (e) { console.error('Erro ao carregar seletor de categorias principais:', e); }
    }


    document.getElementById('btnSair').addEventListener('click', () => {
        localStorage.removeItem('token_financas');
        window.location.href = 'index.html';
    });
});


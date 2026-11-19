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

        const nome = document.getElementById('nomeCategoria').value.trim();
        const valorSelecionado = document.getElementById('tipoCategoria').value;
        const categoriaPaiId = document.getElementById('selectCategoriaPai').value;
        const alerta = document.getElementById('mensagemAlerta');

        alerta.classList.add('d-none');

        const payload = {
            nome: nome,
            fluxo: valorSelecionado,
            tipo: valorSelecionado
        };

        if (categoriaPaiId) {
            const objRelacional = { id: parseInt(categoriaPaiId) };
            payload.categoriaPai = objRelacional;
            payload.pai = objRelacional;
            payload.categoriaPrincipal = objRelacional;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/categorias`, {
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
                carregarDropdownCategoriasPai();
            } else {
                const err = await response.json().catch(() => ({}));
                alerta.textContent = err.mensagem || err.message || 'Erro ao salvar a categoria.';
                alerta.classList.remove('d-none', 'alert-success');
                alerta.classList.add('alert-danger');
            }
        } catch (error) {
            alerta.textContent = 'Erro de conexão com o servidor.';
            alerta.classList.remove('d-none', 'alert-success');
            alerta.classList.add('alert-danger');
        }
    });

    // Helper para identificar o objeto pai em qualquer nomenclatura da API
    function obterCategoriaPai(categoria) {
        return categoria.categoriaPai || categoria.pai || categoria.categoriaPrincipal || null;
    }

    // Ordena em árvore: Pais em ordem alfabética e suas Filhas logo abaixo em ordem alfabética
    function organizarCategoriasEmArvore(listaCategorias) {
        const pais = listaCategorias
            .filter(c => !obterCategoriaPai(c))
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

        const arvore = [];

        pais.forEach(pai => {
            arvore.push({ ...pai, ehFilha: false });

            const filhas = listaCategorias
                .filter(c => {
                    const objPai = obterCategoriaPai(c);
                    return objPai && objPai.id === pai.id;
                })
                .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

            filhas.forEach(filha => {
                arvore.push({ ...filha, ehFilha: true, nomePai: pai.nome });
            });
        });

        // Garante que eventuais categorias órfãs apareçam ao final em ordem alfabética
        const idsProcessados = new Set(arvore.map(item => item.id));
        listaCategorias
            .filter(c => !idsProcessados.has(c.id))
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
            .forEach(orfa => {
                const objPai = obterCategoriaPai(orfa);
                arvore.push({ ...orfa, ehFilha: Boolean(objPai), nomePai: objPai ? objPai.nome : '' });
            });

        return arvore;
    }

    // 2. LISTAR TODAS AS CATEGORIAS NA TABELA EM ÁRVORE ALFABÉTICA
    async function listarCategorias() {
        const tabela = document.getElementById('tabelaCategorias');
        try {
            const response = await fetch(`${API_BASE_URL}/categorias`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token_financas');
                window.location.href = 'index.html';
                return;
            }

            if (response.ok) {
                const categorias = await response.json();
                tabela.innerHTML = '';

                if (!categorias || categorias.length === 0) {
                    tabela.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-3">Nenhuma categoria cadastrada.</td></tr>`;
                    return;
                }

                const categoriasOrdenadas = organizarCategoriasEmArvore(categorias);

                categoriasOrdenadas.forEach(c => {
                    const valorFluxo = c.fluxo || c.tipo || 'DESPESA';
                    const tipoTexto = (valorFluxo.toString().toUpperCase() === 'RECEITA') ? 'Receita' : 'Custo';
                    const badgeCor = tipoTexto === 'Receita' ? 'bg-success' : 'bg-danger';

                    const nomeExibicao = c.ehFilha
                        ? `<span class="ms-4 text-secondary">↳ ${c.nome}</span>`
                        : `📁 <strong class="text-dark">${c.nome}</strong>`;

                    const linha = document.createElement('tr');
                    if (!c.ehFilha) {
                        linha.classList.add('table-light');
                    }

                    linha.innerHTML = `
                        <td><span class="badge ${c.ehFilha ? 'bg-light text-secondary border' : 'bg-secondary'}">${c.id}</span></td>
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

    // 3. CARREGA AS CATEGORIAS PAI EM ORDEM ALFABÉTICA FILTRANDO PELO TIPO
    async function carregarDropdownCategoriasPai() {
        const select = document.getElementById('selectCategoriaPai');
        if (!select) return;

        const tipoSelecionado = document.getElementById('tipoCategoria').value;

        try {
            const response = await fetch(`${API_BASE_URL}/categorias`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const todasCategorias = await response.json();
                select.innerHTML = '<option value="">-- Nenhuma (Esta será uma Categoria Pai) --</option>';

                const paisFiltrados = todasCategorias
                    .filter(cat => {
                        if (obterCategoriaPai(cat)) return false;
                        const valorFluxo = cat.tipo || cat.fluxo || 'DESPESA';
                        return valorFluxo.toString().toUpperCase() === tipoSelecionado.toString().toUpperCase();
                    })
                    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

                paisFiltrados.forEach(cat => {
                    const valorFluxo = cat.tipo || cat.fluxo || 'DESPESA';
                    const tipoTexto = valorFluxo.toString().toUpperCase() === 'RECEITA' ? 'Receita' : 'Custo';
                    select.innerHTML += `<option value="${cat.id}">${cat.nome} (${tipoTexto})</option>`;
                });
            }
        } catch (e) {
            console.error('Erro ao carregar seletor de categorias principais:', e);
        }
    }

    document.getElementById('tipoCategoria').addEventListener('change', () => {
        carregarDropdownCategoriasPai();
    });

    document.getElementById('btnSair')?.addEventListener('click', () => {
        localStorage.removeItem('token_financas');
        window.location.href = 'index.html';
    });
});

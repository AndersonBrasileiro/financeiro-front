document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token_financas');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    let categoriasCache = [];
    let idEmEdicao = null;

    const formCategoria = document.getElementById('formCategoria');
    const btnSubmit = formCategoria.querySelector('button[type="submit"]');
    const textoOriginalBtn = btnSubmit ? btnSubmit.innerHTML : 'Salvar Registro';

    // Cria botão dinâmico de cancelar edição ao lado do submit
    const btnCancelarEdicao = document.createElement('button');
    btnCancelarEdicao.type = 'button';
    btnCancelarEdicao.className = 'btn btn-outline-secondary ms-2 d-none';
    btnCancelarEdicao.textContent = 'Cancelar Edição';
    if (btnSubmit) {
        btnSubmit.insertAdjacentElement('afterend', btnCancelarEdicao);
    }

    btnCancelarEdicao.addEventListener('click', resetarModoEdicao);

    listarCategorias();

    function resetarModoEdicao() {
        idEmEdicao = null;
        formCategoria.reset();
        if (btnSubmit) btnSubmit.innerHTML = textoOriginalBtn;
        btnCancelarEdicao.classList.add('d-none');
        carregarDropdownCategoriasPai();
    }

    // 1. SALVAR OU ATUALIZAR CATEGORIA / SUBCATEGORIA (POST / PUT)
    formCategoria.addEventListener('submit', async (event) => {
        event.preventDefault();

        const nome = document.getElementById('nomeCategoria').value.trim();
        const valorSelecionado = document.getElementById('tipoCategoria').value;
        const categoriaPaiId = document.getElementById('selectCategoriaPai').value;
        const alerta = document.getElementById('mensagemAlerta');

        alerta.classList.add('d-none');

        const payload = {
            nome: nome,
            fluxo: valorSelecionado,
            tipo: valorSelecionado,
            categoriaPai: null,
            pai: null,
            categoriaPrincipal: null
        };

        if (categoriaPaiId) {
            const objRelacional = { id: parseInt(categoriaPaiId) };
            payload.categoriaPai = objRelacional;
            payload.pai = objRelacional;
            payload.categoriaPrincipal = objRelacional;
        }

        const url = idEmEdicao
            ? `${API_BASE_URL}/categorias/${idEmEdicao}`
            : `${API_BASE_URL}/categorias`;
        const metodo = idEmEdicao ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: metodo,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alerta.textContent = idEmEdicao
                    ? 'Categoria atualizada com sucesso!'
                    : 'Categoria cadastrada com sucesso!';
                alerta.classList.remove('d-none', 'alert-danger');
                alerta.classList.add('alert-success');
                resetarModoEdicao();
                listarCategorias();
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

    function obterCategoriaPai(categoria) {
        return categoria.categoriaPai || categoria.pai || categoria.categoriaPrincipal || null;
    }

    function ehReceita(categoria) {
        const valorFluxo = categoria.fluxo || categoria.tipo || 'DESPESA';
        return valorFluxo.toString().toUpperCase() === 'RECEITA';
    }
    // Ordena: Primeiro todas de CUSTO (Pai A-Z -> Filhas A-Z), depois todas de RECEITA (Pai A-Z -> Filhas A-Z)
    function organizarCategoriasEmArvore(listaCategorias) {
        const ordenarBlocoPorTipo = (apenasReceitas) => {
            const filtradas = listaCategorias.filter(c => ehReceita(c) === apenasReceitas);

            const pais = filtradas
                .filter(c => !obterCategoriaPai(c))
                .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

            const resultadoBloco = [];

            pais.forEach(pai => {
                resultadoBloco.push({ ...pai, ehFilha: false });

                const filhas = filtradas
                    .filter(c => {
                        const objPai = obterCategoriaPai(c);
                        return objPai && objPai.id === pai.id;
                    })
                    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

                filhas.forEach(filha => {
                    resultadoBloco.push({ ...filha, ehFilha: true, nomePai: pai.nome });
                });
            });

            const idsNoBloco = new Set(resultadoBloco.map(item => item.id));
            filtradas
                .filter(c => !idsNoBloco.has(c.id))
                .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
                .forEach(orfa => {
                    const objPai = obterCategoriaPai(orfa);
                    resultadoBloco.push({ ...orfa, ehFilha: Boolean(objPai), nomePai: objPai ? objPai.nome : '' });
                });

            return resultadoBloco;
        };

        return [
            ...ordenarBlocoPorTipo(false), // 1º: Todas de Custo (Despesa)
            ...ordenarBlocoPorTipo(true)   // 2º: Todas de Receita
        ];
    }

    // 2. LISTAR TODAS AS CATEGORIAS NA TABELA
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
                categoriasCache = await response.json();
                carregarDropdownCategoriasPai();
                tabela.innerHTML = '';

                if (!categoriasCache || categoriasCache.length === 0) {
                    tabela.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">Nenhuma categoria cadastrada.</td></tr>`;
                    return;
                }

                const categoriasOrdenadas = organizarCategoriasEmArvore(categoriasCache);

                categoriasOrdenadas.forEach(c => {
                    const tipoReceita = ehReceita(c);
                    const tipoTexto = tipoReceita ? 'Receita' : 'Custo';
                    const badgeCor = tipoReceita ? 'bg-success' : 'bg-danger';

                    const nomeExibicao = c.ehFilha
                        ? `<span class="ms-4 text-secondary">↳ ${c.nome}</span>`
                        : `📁 <strong class="text-dark">${c.nome}</strong>`;

                    // Exclusão habilitada apenas para categorias filhas
                    const botaoExcluir = c.ehFilha
                        ? `<button class="btn btn-sm btn-outline-danger btn-excluir-cat" data-id="${c.id}" data-nome="${c.nome}" title="Excluir subcategoria">🗑️</button>`
                        : `<button class="btn btn-sm btn-outline-secondary" disabled title="Categorias Pai não podem ser excluídas" style="opacity: 0.35; cursor: not-allowed;">🗑️</button>`;

                    const linha = document.createElement('tr');
                    if (!c.ehFilha) {
                        linha.classList.add('table-light');
                    }

                    linha.innerHTML = `
                        <td><span class="badge ${c.ehFilha ? 'bg-light text-secondary border' : 'bg-secondary'}">${c.id}</span></td>
                        <td>${nomeExibicao}</td>
                        <td><span class="badge ${badgeCor}">${tipoTexto}</span></td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-outline-primary me-1 btn-editar-cat" data-id="${c.id}" title="Editar categoria">✏️</button>
                            ${botaoExcluir}
                        </td>
                    `;
                    tabela.appendChild(linha);
                });

                document.querySelectorAll('.btn-editar-cat').forEach(btn => {
                    btn.addEventListener('click', () => iniciarEdicao(parseInt(btn.dataset.id)));
                });

                document.querySelectorAll('.btn-excluir-cat').forEach(btn => {
                    btn.addEventListener('click', () => excluirCategoria(parseInt(btn.dataset.id), btn.dataset.nome));
                });
            } else {
                tabela.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Erro de resposta do servidor (${response.status}).</td></tr>`;
            }
        } catch (e) {
            console.error(e);
            tabela.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Erro ao renderizar a tabela na tela.</td></tr>`;
        }
    }

    function iniciarEdicao(id) {
        const cat = categoriasCache.find(item => item.id === id);
        if (!cat) return;

        idEmEdicao = id;
        document.getElementById('nomeCategoria').value = cat.nome;

        const tipoSelect = document.getElementById('tipoCategoria');
        const valorFluxo = (cat.fluxo || cat.tipo || 'CUSTO').toString().toUpperCase();
        // Ajusta conforme o value exato das options do seu select (CUSTO ou DESPESA)
        const opcaoCompativel = Array.from(tipoSelect.options).find(opt => {
            const v = opt.value.toUpperCase();
            return valorFluxo === 'RECEITA' ? v === 'RECEITA' : (v === 'CUSTO' || v === 'DESPESA');
        });
        if (opcaoCompativel) {
            tipoSelect.value = opcaoCompativel.value;
        }

        carregarDropdownCategoriasPai();

        const objPai = obterCategoriaPai(cat);
        document.getElementById('selectCategoriaPai').value = objPai ? objPai.id : '';

        if (btnSubmit) btnSubmit.innerHTML = 'Atualizar Categoria';
        btnCancelarEdicao.classList.remove('d-none');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function excluirCategoria(id, nome) {
        if (!confirm(`Deseja realmente excluir a subcategoria "${nome}"?\n\nObservação: A exclusão só será concluída se não houver nenhum lançamento vinculado a ela.`)) {
            return;
        }

        const alerta = document.getElementById('mensagemAlerta');
        alerta.classList.add('d-none');

        try {
            const response = await fetch(`${API_BASE_URL}/categorias/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                alerta.textContent = `Subcategoria "${nome}" excluída com sucesso!`;
                alerta.classList.remove('d-none', 'alert-danger');
                alerta.classList.add('alert-success');
                listarCategorias();
            } else {
                const err = await response.json().catch(() => ({}));
                alerta.textContent = err.mensagem || err.message || 'Não é possível excluir: esta categoria possui lançamentos vinculados.';
                alerta.classList.remove('d-none', 'alert-success');
                alerta.classList.add('alert-danger');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (error) {
            alerta.textContent = 'Erro de conexão ao tentar excluir a categoria.';
            alerta.classList.remove('d-none', 'alert-success');
            alerta.classList.add('alert-danger');
        }
    }

    // 3. CARREGA AS CATEGORIAS PAI EM ORDEM ALFABÉTICA FILTRANDO PELO TIPO
    function carregarDropdownCategoriasPai() {
        const select = document.getElementById('selectCategoriaPai');
        if (!select) return;

        const tipoSelecionado = document.getElementById('tipoCategoria').value.toString().toUpperCase();
        const selecionouReceita = tipoSelecionado === 'RECEITA';

        select.innerHTML = '<option value="">-- Nenhuma (Esta será uma Categoria Pai) --</option>';

        const paisFiltrados = categoriasCache
            .filter(cat => {
                if (obterCategoriaPai(cat)) return false;
                if (idEmEdicao && cat.id === idEmEdicao) return false;
                return ehReceita(cat) === selecionouReceita;
            })
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

        paisFiltrados.forEach(cat => {
            const tipoTexto = ehReceita(cat) ? 'Receita' : 'Custo';
            select.innerHTML += `<option value="${cat.id}">${cat.nome} (${tipoTexto})</option>`;
        });
    }

    document.getElementById('tipoCategoria').addEventListener('change', () => {
        carregarDropdownCategoriasPai();
    });

    document.getElementById('btnSair')?.addEventListener('click', () => {
        localStorage.removeItem('token_financas');
        window.location.href = 'index.html';
    });
});

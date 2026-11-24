document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token_financas');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    let centrosCache = [];
    let idEmEdicao = null;

    const formCentro = document.getElementById('formCentro');
    const btnSubmit = formCentro.querySelector('button[type="submit"]');
    const textoOriginalBtn = btnSubmit ? btnSubmit.innerHTML : 'Salvar Centro';

    const btnCancelarEdicao = document.createElement('button');
    btnCancelarEdicao.type = 'button';
    btnCancelarEdicao.className = 'btn btn-outline-secondary ms-2 d-none';
    btnCancelarEdicao.textContent = 'Cancelar Edição';
    if (btnSubmit) {
        btnSubmit.insertAdjacentElement('afterend', btnCancelarEdicao);
    }

    btnCancelarEdicao.addEventListener('click', resetarModoEdicao);

    listarCentros();

    function resetarModoEdicao() {
        idEmEdicao = null;
        formCentro.reset();
        if (btnSubmit) btnSubmit.innerHTML = textoOriginalBtn;
        btnCancelarEdicao.classList.add('d-none');
    }

    // 1. ADICIONAR OU ATUALIZAR CENTRO (POST / PUT)
    formCentro.addEventListener('submit', async (event) => {
        event.preventDefault();

        const nome = document.getElementById('nomeCentro').value.trim();
        const valorSelecionado = document.getElementById('fluxoCentro').value;
        const alerta = document.getElementById('mensagemAlerta');

        alerta.classList.add('d-none');

        const url = idEmEdicao ? `${API_BASE_URL}/centros-custo/${idEmEdicao}` : `${API_BASE_URL}/centros-custo`;
        const metodo = idEmEdicao ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: metodo,
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
                alerta.textContent = idEmEdicao
                    ? 'Centro de custo atualizado com sucesso!'
                    : 'Centro cadastrado com sucesso!';
                alerta.classList.remove('d-none', 'alert-danger');
                alerta.classList.add('alert-success');
                resetarModoEdicao();
                listarCentros();
            } else {
                const err = await response.json().catch(() => ({}));
                alerta.textContent = err.mensagem || err.message || `Erro ao salvar o centro (HTTP ${response.status}).`;
                alerta.classList.remove('d-none', 'alert-success');
                alerta.classList.add('alert-danger');
            }
        } catch (error) {
            alerta.textContent = 'Erro de conexão com o servidor.';
            alerta.classList.remove('d-none', 'alert-success');
            alerta.classList.add('alert-danger');
        }
    });
    // 2. LISTAR CENTROS (ATIVOS E INATIVOS)
    async function listarCentros() {
        const tabela = document.getElementById('tabelaCentros');
        try {
            const response = await fetch(`${API_BASE_URL}/centros-custo`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token_financas');
                window.location.href = 'index.html';
                return;
            }

            if (response.ok) {
                centrosCache = await response.json();
                tabela.innerHTML = '';

                if (!centrosCache || centrosCache.length === 0) {
                    tabela.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Nenhum centro cadastrado.</td></tr>`;
                    return;
                }

                // Ordena: Primeiro Custo (DESPESA) A-Z, depois Receita (RECEITA) A-Z
                centrosCache.sort((a, b) => {
                    const tipoA = (a.fluxo || a.tipo || 'DESPESA').toUpperCase() === 'RECEITA' ? 1 : 0;
                    const tipoB = (b.fluxo || b.tipo || 'DESPESA').toUpperCase() === 'RECEITA' ? 1 : 0;
                    if (tipoA !== tipoB) return tipoA - tipoB;
                    return (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' });
                });

                centrosCache.forEach(c => {
                    const valorFluxo = c.fluxo || c.tipo || 'DESPESA';
                    const tipoTexto = (valorFluxo.toString().toUpperCase() === 'RECEITA') ? 'Receita' : 'Custo';
                    const badgeCor = tipoTexto === 'Receita' ? 'bg-success' : 'bg-danger';

                    const estaAtivo = (c.ativo === null || c.ativo === undefined) ? true : Boolean(c.ativo);
                    const badgeStatus = estaAtivo
                        ? `<span class="badge bg-primary">Ativo</span>`
                        : `<span class="badge bg-secondary">Inativo</span>`;

                    const btnStatus = estaAtivo
                        ? `<button class="btn btn-sm btn-outline-warning me-1 btn-status-centro" data-id="${c.id}" title="Desativar centro">⏸️</button>`
                        : `<button class="btn btn-sm btn-outline-success me-1 btn-status-centro" data-id="${c.id}" title="Reativar centro">▶️</button>`;

                    const linha = document.createElement('tr');
                    if (!estaAtivo) {
                        linha.classList.add('table-secondary', 'text-muted');
                    }

                    linha.innerHTML = `
                        <td><span class="badge bg-secondary">${c.id}</span></td>
                        <td class="fw-bold ${estaAtivo ? 'text-dark' : 'text-muted text-decoration-line-through'}">${c.nome || 'Sem Nome'}</td>
                        <td><span class="badge ${badgeCor}">${tipoTexto}</span></td>
                        <td>${badgeStatus}</td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-outline-primary me-1 btn-editar-centro" data-id="${c.id}" title="Editar centro">✏️</button>
                            ${btnStatus}
                            <button class="btn btn-sm btn-outline-danger btn-excluir-centro" data-id="${c.id}" data-nome="${c.nome}" title="Excluir centro">🗑️</button>
                        </td>
                    `;
                    tabela.appendChild(linha);
                });

                document.querySelectorAll('.btn-editar-centro').forEach(btn => {
                    btn.addEventListener('click', () => iniciarEdicao(parseInt(btn.dataset.id)));
                });

                document.querySelectorAll('.btn-status-centro').forEach(btn => {
                    btn.addEventListener('click', () => alternarStatusCentro(parseInt(btn.dataset.id)));
                });

                document.querySelectorAll('.btn-excluir-centro').forEach(btn => {
                    btn.addEventListener('click', () => excluirCentro(parseInt(btn.dataset.id), btn.dataset.nome));
                });
            } else {
                tabela.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Erro ao carregar centros (${response.status}).</td></tr>`;
            }
        } catch (e) {
            console.error('Erro de rede ou processamento:', e);
            tabela.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Erro ao renderizar a tabela na tela.</td></tr>`;
        }
    }

    function iniciarEdicao(id) {
        const centro = centrosCache.find(item => item.id === id);
        if (!centro) return;

        idEmEdicao = id;
        document.getElementById('nomeCentro').value = centro.nome;

        const fluxoSelect = document.getElementById('fluxoCentro');
        const valorFluxo = (centro.fluxo || centro.tipo || 'DESPESA').toString().toUpperCase();
        const opcaoCompativel = Array.from(fluxoSelect.options).find(opt => {
            const v = opt.value.toUpperCase();
            return valorFluxo === 'RECEITA' ? v === 'RECEITA' : (v === 'CUSTO' || v === 'DESPESA');
        });
        if (opcaoCompativel) {
            fluxoSelect.value = opcaoCompativel.value;
        }

        if (btnSubmit) btnSubmit.innerHTML = 'Atualizar Centro';
        btnCancelarEdicao.classList.remove('d-none');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function alternarStatusCentro(id) {
        const alerta = document.getElementById('mensagemAlerta');
        alerta.classList.add('d-none');

        try {
            const response = await fetch(`${API_BASE_URL}/centros-custo/${id}/status`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const atualizado = await response.json();
                alerta.textContent = atualizado.ativo
                    ? `Centro "${atualizado.nome}" reativado com sucesso!`
                    : `Centro "${atualizado.nome}" desativado com sucesso!`;
                alerta.classList.remove('d-none', 'alert-danger');
                alerta.classList.add('alert-success');
                listarCentros();
            } else {
                const err = await response.json().catch(() => ({}));
                alerta.textContent = err.mensagem || `Erro ao alterar status (HTTP ${response.status}).`;
                alerta.classList.remove('d-none', 'alert-success');
                alerta.classList.add('alert-danger');
            }
        } catch (error) {
            alerta.textContent = 'Erro de conexão ao alterar status do centro.';
            alerta.classList.remove('d-none', 'alert-success');
            alerta.classList.add('alert-danger');
        }
    }

    async function excluirCentro(id, nome) {
        if (!confirm(`Deseja realmente excluir o centro "${nome}"?\n\nObservação: Centros com lançamentos vinculados não podem ser excluídos (mas podem ser desativados).`)) {
            return;
        }

        const alerta = document.getElementById('mensagemAlerta');
        alerta.classList.add('d-none');

        try {
            const response = await fetch(`${API_BASE_URL}/centros-custo/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                alerta.textContent = `Centro "${nome}" excluído com sucesso!`;
                alerta.classList.remove('d-none', 'alert-danger');
                alerta.classList.add('alert-success');
                listarCentros();
            } else {
                const err = await response.json().catch(() => ({}));
                alerta.textContent = err.mensagem || err.message || `Não foi possível excluir o centro (HTTP ${response.status}).`;
                alerta.classList.remove('d-none', 'alert-success');
                alerta.classList.add('alert-danger');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (error) {
            alerta.textContent = 'Erro de conexão ao tentar excluir o centro.';
            alerta.classList.remove('d-none', 'alert-success');
            alerta.classList.add('alert-danger');
        }
    }

    document.getElementById('btnSair')?.addEventListener('click', () => {
        localStorage.removeItem('token_financas');
        window.location.href = 'index.html';
    });
});

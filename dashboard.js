document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token_financas');

    if (!token) {
        alert('Acesso negado. Por favor, faça login primeiro!');
        window.location.href = 'index.html';
        return;
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        await garantirChartJs();

        const [respDashboard, respDespesas, respReceitas] = await Promise.all([
            fetch(`${API_BASE_URL}/dashboard`, { method: 'GET', headers }),
            fetch(`${API_BASE_URL}/lancamentos/filtrar?tipo=DESPESA`, { method: 'GET', headers }),
            fetch(`${API_BASE_URL}/lancamentos/filtrar?tipo=RECEITA`, { method: 'GET', headers })
        ]);

        if (respDashboard.status === 401 || respDashboard.status === 403) {
            localStorage.removeItem('token_financas');
            window.location.href = 'index.html';
            return;
        }

        if (respDashboard.ok) {
            const dados = await respDashboard.json();

            const saldoDisponivel = dados.saldoDisponivel || dados.saldo_disponivel || dados.saldoAtual || dados.saldo || 0;
            const pagar = dados.totalContasReceberEmAberto ?? dados.total_contas_receber_em_aberto ?? 0;
            const receber = dados.totalContasPagarEmAberto ?? dados.total_contas_pagar_em_aberto ?? 0;
            const projetado = saldoDisponivel + receber - pagar;

            if (document.getElementById('txtSaldoAtual')) document.getElementById('txtSaldoAtual').textContent = formatarMoeda(saldoDisponivel);
            if (document.getElementById('txtTotalReceber')) document.getElementById('txtTotalReceber').textContent = formatarMoeda(receber);
            if (document.getElementById('txtTotalPagar')) document.getElementById('txtTotalPagar').textContent = formatarMoeda(pagar);
            if (document.getElementById('txtSaldoProjetado')) document.getElementById('txtSaldoProjetado').textContent = formatarMoeda(projetado);
        }

        const despesasRaw = respDespesas.ok ? await respDespesas.json() : [];
        const receitasRaw = respReceitas.ok ? await respReceitas.json() : [];

        // Normaliza dataVencimento para "YYYY-MM-DD" mesmo se vier como array [2026, 10, 15]
        const despesas = despesasRaw.map(l => ({ ...l, dataVencimento: normalizarDataISO(l.dataVencimento) }));
        const receitas = receitasRaw.map(l => ({ ...l, dataVencimento: normalizarDataISO(l.dataVencimento) }));

        const mesReferencia = descobrirMesReferencia([...receitas, ...despesas]);
        renderizarGraficoMensal(receitas, despesas, mesReferencia);
        inicializarSeletorEGraficoCategorias(despesas, mesReferencia);

    } catch (error) {
        console.error('Erro ao montar dashboard:', error);
    }
});

function garantirChartJs() {
    if (typeof Chart !== 'undefined') return Promise.resolve();
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://jsdelivr.net';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function normalizarDataISO(data) {
    if (!data) return '';
    if (Array.isArray(data) && data.length >= 3) {
        return `${data}-${String(data).padStart(2, '0')}-${String(data).padStart(2, '0')}`;
    }
    return String(data);
}

function descobrirMesReferencia(todosLancamentos) {
    const hoje = new Date();
    const chaveHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    const datasValidas = todosLancamentos
        .map(l => l.dataVencimento)
        .filter(d => typeof d === 'string' && d.length >= 7)
        .sort();

    if (datasValidas.length === 0) return chaveHoje;

    const temNoMesAtual = datasValidas.some(d => d.startsWith(chaveHoje));
    return temNoMesAtual ? chaveHoje : datasValidas[datasValidas.length - 1].substring(0, 7);
}

// GRÁFICO 1: BARRAS AGRUPADAS (RECEITAS X DESPESAS - JANELA DE 6 MESES)
function renderizarGraficoMensal(receitas, despesas, mesReferencia) {
    const canvas = document.getElementById('graficoMensal');
    if (!canvas) return;

    const [anoRef, mesRef] = mesReferencia.split('-').map(Number);
    const dataBase = new Date(anoRef, mesRef - 1, 1);
    const meses = [];
    const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    for (let i = 5; i >= 0; i--) {
        const d = new Date(dataBase.getFullYear(), dataBase.getMonth() - i, 1);
        const ano = d.getFullYear();
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        meses.push({
            chave: `${ano}-${mes}`,
            label: `${nomesMeses[d.getMonth()]}/${String(ano).slice(-2)}`,
            receitas: 0,
            despesas: 0
        });
    }

    receitas.forEach(l => {
        if (!l.dataVencimento) return;
        const mesAlvo = meses.find(m => m.chave === l.dataVencimento.substring(0, 7));
        if (mesAlvo) mesAlvo.receitas += Number(l.valor || 0);
    });

    despesas.forEach(l => {
        if (!l.dataVencimento) return;
        const mesAlvo = meses.find(m => m.chave === l.dataVencimento.substring(0, 7));
        if (mesAlvo) mesAlvo.despesas += Number(l.valor || 0);
    });

    new Chart(canvas, {
        type: 'bar',
        data: {
            labels: meses.map(m => m.label),
            datasets: [
                {
                    label: 'Receitas',
                    data: meses.map(m => m.receitas),
                    backgroundColor: 'rgba(25, 135, 84, 0.85)',
                    borderRadius: 6,
                    maxBarThickness: 28
                },
                {
                    label: 'Despesas',
                    data: meses.map(m => m.despesas),
                    backgroundColor: 'rgba(220, 53, 69, 0.85)',
                    borderRadius: 6,
                    maxBarThickness: 28
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${formatarMoeda(ctx.parsed.y)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => formatarMoeda(value)
                    }
                }
            }
        }
    });
}

// GRÁFICO 2: ROSCA COM SELETOR DE MÊS (DESPESAS POR CATEGORIA)
let chartCategoriasInstance = null;

function inicializarSeletorEGraficoCategorias(despesas, mesInicial) {
    const subtitulo = document.getElementById('subtituloCategoriaMes');
    const mesesDisponiveis = [...new Set(
        despesas
            .filter(d => typeof d.dataVencimento === 'string' && d.dataVencimento.length >= 7)
            .map(d => d.dataVencimento.substring(0, 7))
    )].sort().reverse();

    if (mesesDisponiveis.length === 0) {
        renderizarGraficoCategorias(despesas, mesInicial);
        return;
    }

    const mesSelecionado = mesesDisponiveis.includes(mesInicial) ? mesInicial : mesesDisponiveis;

    if (subtitulo && subtitulo.parentElement && subtitulo.parentElement.parentElement) {
        const headerCard = subtitulo.parentElement.parentElement;
        const selectMes = document.createElement('select');
        selectMes.className = 'form-select form-select-sm w-auto';
        selectMes.style.fontSize = '0.8rem';

        const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        mesesDisponiveis.forEach(chave => {
            const [ano, mes] = chave.split('-');
            const opt = document.createElement('option');
            opt.value = chave;
            opt.textContent = `${nomesMeses[parseInt(mes, 10) - 1]}/${ano}`;
            if (chave === mesSelecionado) opt.selected = true;
            selectMes.appendChild(opt);
        });

        selectMes.addEventListener('change', () => {
            renderizarGraficoCategorias(despesas, selectMes.value);
        });

        headerCard.appendChild(selectMes);
        subtitulo.textContent = 'Distribuição por categoria';
    }

    renderizarGraficoCategorias(despesas, mesSelecionado);
}

function renderizarGraficoCategorias(despesas, chaveMes) {
    const canvas = document.getElementById('graficoCategorias');
    const msgVazio = document.getElementById('msgSemDespesasGrafico');
    if (!canvas) return;

    const agrupado = {};
    despesas.forEach(l => {
        if (!l.dataVencimento || !l.dataVencimento.startsWith(chaveMes)) return;

        const nomeCategoria = l.categoria ? l.categoria.nome : 'Sem Categoria';
        agrupado[nomeCategoria] = (agrupado[nomeCategoria] || 0) + Number(l.valor || 0);
    });

    const entradas = Object.entries(agrupado).sort((a, b) => b - a);

    if (chartCategoriasInstance) {
        chartCategoriasInstance.destroy();
    }

    if (entradas.length === 0) {
        canvas.parentElement.classList.add('d-none');
        if (msgVazio) msgVazio.classList.remove('d-none');
        return;
    }

    canvas.parentElement.classList.remove('d-none');
    if (msgVazio) msgVazio.classList.add('d-none');

    const paletaCores = [
        '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
        '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
        '#6366f1', '#84cc16'
    ];

    chartCategoriasInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: entradas.map(e => e),
            datasets: [{
                data: entradas.map(e => e),
                backgroundColor: entradas.map((_, idx) => paletaCores[idx % paletaCores.length]),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 14, font: { size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const percentual = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                            return ` ${ctx.label}: ${formatarMoeda(ctx.parsed)} (${percentual}%)`;
                        }
                    }
                }
            }
        }
    });
}

document.getElementById('btnSair')?.addEventListener('click', () => {
    localStorage.removeItem('token_financas');
    window.location.href = 'index.html';
});

function formatarMoeda(valor) {
    if (valor === null || valor === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

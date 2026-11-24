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

        if (typeof Chart !== 'undefined') {
            const despesas = respDespesas.ok ? await respDespesas.json() : [];
            const receitas = respReceitas.ok ? await respReceitas.json() : [];

            renderizarGraficoMensal(receitas, despesas);
            renderizarGraficoCategorias(despesas);
        } else {
            console.error('Biblioteca Chart.js não foi carregada no dashboard.html.');
        }

    } catch (error) {
        console.error('Erro de conexão com o backend:', error);
    }
});

// GRÁFICO 1: BARRAS AGRUPADAS (RECEITAS X DESPESAS DOS ÚLTIMOS 6 MESES)
function renderizarGraficoMensal(receitas, despesas) {
    const canvas = document.getElementById('graficoMensal');
    if (!canvas) return;

    const hoje = new Date();
    const meses = [];
    const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
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

// GRÁFICO 2: ROSCA (DESPESAS POR CATEGORIA NO MÊS ATUAL)
function renderizarGraficoCategorias(despesas) {
    const canvas = document.getElementById('graficoCategorias');
    const msgVazio = document.getElementById('msgSemDespesasGrafico');
    if (!canvas) return;

    const hoje = new Date();
    const chaveMesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    const agrupado = {};
    despesas.forEach(l => {
        if (!l.dataVencimento || !l.dataVencimento.startsWith(chaveMesAtual)) return;

        const nomeCategoria = l.categoria ? l.categoria.nome : 'Sem Categoria';
        agrupado[nomeCategoria] = (agrupado[nomeCategoria] || 0) + Number(l.valor || 0);
    });

    const entradas = Object.entries(agrupado).sort((a, b) => b[1] - a[1]);

    if (entradas.length === 0) {
        canvas.parentElement.classList.add('d-none');
        if (msgVazio) msgVazio.classList.remove('d-none');
        return;
    }

    const paletaCores = [
        '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
        '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
        '#6366f1', '#84cc16'
    ];

    new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: entradas.map(e => e[0]),
            datasets: [{
                data: entradas.map(e => e[1]),
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

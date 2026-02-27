window.Router.register('homemaster', async () => {
    const db = window.db;
    const { collection, query, where, onSnapshot, getDocs } = window.fsMethods;
    const corMaster = "#1e293b"; // Um tom de azul quase preto para diferenciar do professor
    const corDestaque = "#004b87";

    const carregarDadosMaster = async () => {
        try {
            // 1. Monitoramento Global de Usuários (Alunos + Professores)
            onSnapshot(collection(db, "usuarios"), (snap) => {
                const dados = snap.docs.map(d => d.data());
                const totalAlunos = dados.filter(u => u.perfil === "Aluno").length;
                const totalProfs = dados.filter(u => u.perfil === "Professor").length;
                const pendentes = dados.filter(u => u.status === "pendente").length;

                if (document.getElementById('master-total-alunos')) 
                    document.getElementById('master-total-alunos').innerText = totalAlunos;
                if (document.getElementById('master-total-profs')) 
                    document.getElementById('master-total-profs').innerText = totalProfs;
                if (document.getElementById('master-pendentes')) 
                    document.getElementById('master-pendentes').innerText = pendentes;
                
                const cardPendente = document.getElementById('card-master-pendentes');
                if (pendentes > 0) cardPendente.classList.add('blink-master');
                else cardPendente.classList.remove('blink-master');
            });

            // 2. Monitoramento de Turmas e Atividades (Volume Geral)
            onSnapshot(collection(db, "turmas"), (snap) => {
                if (document.getElementById('master-total-turmas'))
                    document.getElementById('master-total-turmas').innerText = snap.size;
            });

            onSnapshot(collection(db, "atividades_enviadas"), (snap) => {
                if (document.getElementById('master-total-atividades'))
                    document.getElementById('master-total-atividades').innerText = snap.size;
            });

            // 3. Log de Atividades Recentes (Simulação de Monitoramento)
            const qLogs = query(collection(db, "atividades_enviadas"));
            const snapLogs = await getDocs(qLogs);
            const containerLogs = document.getElementById('master-logs-container');
            if (containerLogs) {
                containerLogs.innerHTML = snapLogs.docs.slice(0, 5).map(doc => {
                    const atv = doc.data();
                    return `
                        <div class="log-item">
                            <span><strong>${atv.tipo.toUpperCase()}</strong> enviada para turma <strong>${atv.turma || 'Geral'}</strong></span>
                            <small>${new Date().toLocaleDateString()}</small>
                        </div>
                    `;
                }).join('');
            }

        } catch (e) { console.error("Erro na Home Master:", e); }
    };

    setTimeout(carregarDadosMaster, 200);

    return `
        <style>
            .header-master { margin-bottom: 30px; border-left: 8px solid ${corMaster}; padding-left: 20px; }
            .header-master h1 { color: ${corMaster}; font-size: 2rem; font-weight: 900; }
            
            .grid-master { 
                display: grid; 
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); 
                gap: 20px; 
                margin-bottom: 30px; 
            }

            .card-master { 
                background: #fff; 
                padding: 25px; 
                border-radius: 15px; 
                box-shadow: 0 10px 25px rgba(0,0,0,0.05); 
                transition: 0.3s;
                border-bottom: 4px solid #e2e8f0;
            }

            .card-master:hover { transform: translateY(-5px); }
            .card-master span { color: #64748b; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
            .card-master h2 { color: ${corMaster}; font-size: 2.2rem; font-weight: 800; margin-top: 5px; }

            .blink-master { animation: pulse-master 2s infinite; border-bottom-color: #ef4444 !important; }
            @keyframes pulse-master { 0% { background: #fff; } 50% { background: #fef2f2; } 100% { background: #fff; } }

            .section-title { color: ${corMaster}; font-weight: 800; text-transform: uppercase; font-size: 0.9rem; margin-bottom: 15px; display: flex; align-items: center; gap: 10px; }
            
            .master-dashboard { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
            .panel-logs { background: #fff; padding: 20px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
            
            .log-item { 
                display: flex; 
                justify-content: space-between; 
                padding: 12px; 
                border-bottom: 1px solid #f1f5f9; 
                font-size: 0.9rem; 
            }
            .log-item:last-child { border: none; }
            
            .btn-master {
                background: ${corMaster};
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                width: 100%;
                margin-top: 10px;
            }

            @media (max-width: 900px) { .master-dashboard { grid-template-columns: 1fr; } }
        </style>

        <div class="header-master">
            <h1>PAINEL DE CONTROLE MASTER</h1>
            <p>Visão Geral de toda a Plata4Four</p>
        </div>

        <div class="grid-master">
            <div class="card-master"><span>Total de Alunos</span><h2 id="master-total-alunos">...</h2></div>
            <div class="card-master"><span>Professores</span><h2 id="master-total-profs">...</h2></div>
            <div class="card-master" id="card-master-pendentes"><span>Acessos Pendentes</span><h2 id="master-pendentes">...</h2></div>
            <div class="card-master"><span>Turmas Ativas</span><h2 id="master-total-turmas">...</h2></div>
        </div>

        <div class="master-dashboard">
            <div class="panel-logs">
                <div class="section-title"><i class="fa-solid fa-chart-line"></i> Fluxo Global de Atividades</div>
                <div id="master-logs-container">Carregando fluxo...</div>
                <div class="card-master" style="margin-top:20px; border:none; background:#f8fafc;">
                    <span>Volume Total de Dados</span>
                    <h2 id="master-total-atividades" style="font-size: 1.5rem;">...</h2>
                    <small>Atividades processadas no sistema</small>
                </div>
            </div>

            <div class="panel-control">
                <div class="section-title"><i class="fa-solid fa-gears"></i> Gestão do Sistema</div>
                <div class="card-master">
                    <button class="btn-master" onclick="window.location.hash='#alunos'">Aprovar Usuários</button>
                    <button class="btn-master" onclick="window.location.hash='#turmas'" style="background:#475569;">Configurar Turmas</button>
                    <button class="btn-master" style="background:#94a3b8; cursor:not-allowed;">Relatório Financeiro</button>
                </div>
            </div>
        </div>
    `;
});
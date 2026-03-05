window.Router.register('homemaster', async () => {
    const db = window.db;
    const { doc, getDoc, collection, query, where, onSnapshot } = window.fsMethods;
    const azulPadrao = "#003058";

    const carregarDadosMaster = async () => {
        try {
            const auth = window.authMethods.getAuth();
            const user = auth.currentUser;
            if (!user) return;

            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const elBoasVindas = document.getElementById('boas-vindas-master');
                
                const exibirNomeFormatado = (nomeBruto) => {
                    if (!elBoasVindas) return;
                    const nomes = (nomeBruto || "Usuário Master").trim().split(/\s+/);
                    const nomeExibicao = nomes.slice(0, 2).join(" ");
                    elBoasVindas.innerText = `Olá, ${nomeExibicao}!`;
                };

                // 1. Carrega o que já existe no Firestore imediatamente
                exibirNomeFormatado(userData.nome);

                // 2. Se houver link do Storage, atualiza em segundo plano
                if (userData.nomeCompletoUrl) {
                    fetch(userData.nomeCompletoUrl)
                        .then(r => {
                            if (!r.ok) throw new Error();
                            return r.text();
                        })
                        .then(nomeLongo => {
                            exibirNomeFormatado(nomeLongo);
                        })
                        .catch(() => console.warn("Usando nome do Firestore (Storage inacessível)"));
                }
            }

            const verificarAlerta = (cardId, totalAtual, storageKeyPrefix) => {
                const storageKey = `${storageKeyPrefix}_${user.uid}`;
                const ultimoVisto = parseInt(localStorage.getItem(storageKey) || "0");
                const cardEl = document.getElementById(cardId);
                if (cardEl) {
                    if (totalAtual > ultimoVisto) cardEl.classList.add('blink-verde-master');
                    else cardEl.classList.remove('blink-verde-master');
                }
            };

            const monitorar = (colecao, queries, elId, cardId, storagePrefix) => {
                onSnapshot(query(collection(db, colecao), ...queries), (snap) => {
                    const total = snap.size;
                    const el = document.getElementById(elId);
                    if (el) el.innerText = total;
                    verificarAlerta(cardId, total, storagePrefix);
                });
            };

            monitorar("usuarios", [where("status", "==", "pendente")], "count-convites", "card-convites", "visto_master_convites");
            onSnapshot(query(collection(db, "usuarios"), where("perfil", "==", "Diretor")), (snap) => {
            const todos = [];
            snap.forEach(d => {
                todos.push({ id: d.id, ...d.data() });
            });

            const unicos = {};
            todos.forEach(u => {
                if (!unicos[u.codigoAcesso] || (u.nome !== "")) {
                    unicos[u.codigoAcesso] = u;
                }
            });

            const totalFiltrado = Object.values(unicos).length;
            const el = document.getElementById("count-diretores");
            if (el) el.innerText = totalFiltrado;
            verificarAlerta("card-diretores", totalFiltrado, "visto_master_diretores");
        });
            onSnapshot(query(collection(db, "usuarios"), where("perfil", "==", "Coordenador")), (snap) => {
            const todos = [];
            snap.forEach(d => {
                todos.push({ id: d.id, ...d.data() });
            });

            const unicos = {};
            todos.forEach(u => {
                if (!unicos[u.codigoAcesso] || (u.nome !== "")) {
                    unicos[u.codigoAcesso] = u;
                }
            });

            const totalFiltrado = Object.values(unicos).length;
            const el = document.getElementById("count-coordenadores");
            if (el) el.innerText = totalFiltrado;
            verificarAlerta("card-coordenadores", totalFiltrado, "visto_master_coord");
        });
            onSnapshot(query(collection(db, "usuarios"), where("perfil", "==", "Professor")), (snap) => {
            const todos = [];
            snap.forEach(d => {
                todos.push({ id: d.id, ...d.data() });
            });

            const unicos = {};
            todos.forEach(u => {
                if (!unicos[u.codigoAcesso] || (u.nome !== "")) {
                    unicos[u.codigoAcesso] = u;
                }
            });

            const totalFiltrado = Object.values(unicos).length;
            const el = document.getElementById("count-professores");
            if (el) el.innerText = totalFiltrado;
            verificarAlerta("card-professores", totalFiltrado, "visto_master_profs");
                    });
                        onSnapshot(query(collection(db, "usuarios"), where("perfil", "==", "Aluno")), (snap) => {
                const totalAlunos = snap.size;
                const el = document.getElementById("count-alunos");
                if (el) el.innerText = totalAlunos;
                verificarAlerta("card-alunos", totalAlunos, "visto_master_alunos");
            });
            monitorar("usuarios", [where("perfil", "==", "Pai")], "count-pais", "card-pais", "visto_master_pais");
            monitorar("atividades", [], "count-atividades", "card-atividades", "visto_master_ativ");

        } catch (e) { console.error("Erro Master:", e); }
    };

    window.limparAlertaMaster = (cardId, storagePrefix, rota) => {
        const total = document.getElementById(cardId.replace('card-', 'count-'))?.innerText || "0";
        const user = window.authMethods.getAuth().currentUser;
        localStorage.setItem(`${storagePrefix}_${user.uid}`, total);
        document.getElementById(cardId)?.classList.remove('blink-verde-master');
        window.location.hash = rota;
    };

    setTimeout(carregarDadosMaster, 200);

    return `
        <style>
            .header-prof { width: 100%; margin-bottom: 25px; }
            .grid-master { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px; }
            .card-master { 
                background: #fff; padding: 20px; border-radius: 18px; 
                box-shadow: 0 4px 20px rgba(0,0,0,0.05); display: flex; 
                flex-direction: column; height: 140px; border-top: 6px solid ${azulPadrao}; 
                transition: 0.3s; position: relative; overflow: hidden;
            }
            .card-master.clickable { cursor: pointer; }
            .card-master.clickable:hover { transform: translateY(-3px); }
            .card-master span { font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
            .card-master .count { font-size: 2rem; color: ${azulPadrao}; margin-top: 5px; font-weight: 800; }
            
            .blink-verde-master { animation: pulse-verde 1s infinite !important; border-top-color: #22c55e !important; background-color: #f0fdf4 !important; }
            @keyframes pulse-verde { 0% { opacity: 1; } 50% { opacity: 0.8; } 100% { opacity: 1; } }

            @media (max-width: 1024px) { .grid-master { grid-template-columns: repeat(2, 1fr); } }
            @media (max-width: 600px) { .grid-master { grid-template-columns: 1fr; } }
        </style>

        <div class="header-prof">
            <h1 id="boas-vindas-master" style="text-transform: uppercase; font-weight: 800; color: ${azulPadrao}; margin:0;">CARREGANDO...</h1>
            <p style="color: #64748b; font-weight: 500; font-size: 1.1rem; margin: 5px 0;">Painel de Controle Geral</p>
        </div>

        <hr style="border:0; border-top:2px solid #f1f5f9; margin: 20px 0 30px 0;">

        <div class="grid-master">
            <div class="card-master clickable" id="card-convites" onclick="window.limparAlertaMaster('card-convites', 'visto_master_convites', '#usuariosmaster')">
                <span>Convites Pendentes</span>
                <div id="count-convites" class="count">0</div>
            </div>
            <div class="card-master clickable" id="card-diretores" onclick="window.limparAlertaMaster('card-diretores', 'visto_master_diretores', '#usuariosmaster')">
                <span>Diretores</span>
                <div id="count-diretores" class="count">0</div>
            </div>
            <div class="card-master clickable" id="card-coordenadores" onclick="window.limparAlertaMaster('card-coordenadores', 'visto_master_coord', '#usuariosmaster')">
                <span>Coordenadores</span>
                <div id="count-coordenadores" class="count">0</div>
            </div>
            <div class="card-master clickable" id="card-professores" onclick="window.limparAlertaMaster('card-professores', 'visto_master_profs', '#usuariosmaster')">
                <span>Professores</span>
                <div id="count-professores" class="count">0</div>
            </div>
        </div>

        <div class="grid-master">
            <div class="card-master clickable" id="card-alunos" onclick="window.limparAlertaMaster('card-alunos', 'visto_master_alunos', '#usuariosmaster')">
                <span>Alunos</span>
                <div id="count-alunos" class="count">0</div>
            </div>
            <div class="card-master clickable" id="card-pais" onclick="window.limparAlertaMaster('card-pais', 'visto_master_pais', '#usuariosmaster')">
                <span>Pais</span>
                <div id="count-pais" class="count">0</div>
            </div>
            <div class="card-master clickable" id="card-atividades" onclick="window.limparAlertaMaster('card-atividades', 'visto_master_ativ', '#usuariosmaster')">
                <span>Atividades Criadas</span>
                <div id="count-atividades" class="count">0</div>
            </div>
        </div>
    `;
});
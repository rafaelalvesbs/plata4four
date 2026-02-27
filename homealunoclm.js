window.Router.register('homealunoclm', async () => {
    const db = window.db;
    const { doc, getDoc, collection, query, where, onSnapshot, getDocs } = window.fsMethods;
    const azulPadrao = "#003058";
    const verdeAlerta = "#22c55e";

    // GARANTIR VARIÁVEIS NO WINDOW
    if (typeof window.countEscrita === 'undefined') window.countEscrita = null;
    if (typeof window.countOral === 'undefined') window.countOral = null;
    if (typeof window.countGramatica === 'undefined') window.countGramatica = null;
    if (typeof window.countAuditiva === 'undefined') window.countAuditiva = null;
    if (typeof window.avisoCount === 'undefined') window.avisoCount = null;
    if (typeof window.msgCount === 'undefined') window.msgCount = null;
    if (typeof window.feedbackCount === 'undefined') window.feedbackCount = null;
    
    const carregarDadosHomeAluno = async () => {
        try {
            const auth = window.authMethods.getAuth();
            const user = auth.currentUser;
            if (!user) return;

            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (!userDoc.exists()) return;
            
            const dadosUsuario = userDoc.data();
            
            // CORREÇÃO: Pega o vínculo correto (turma ou codigoAcesso)
            const turmaAluno = (dadosUsuario.turma || dadosUsuario.codigoAcesso || "").toString().trim();
            
            let semestreAluno = "";
            if (turmaAluno) {
                const qTurma = query(collection(db, "turmas"), where("senha", "==", turmaAluno));
                const snapTurma = await getDocs(qTurma);
                semestreAluno = !snapTurma.empty ? snapTurma.docs[0].data().semestre : "";
            }

            const nomes = (dadosUsuario.nome || "").split(" ");
            const nomeExibicao = nomes.slice(0, 2).join(" ");
            
            const elBoasVindas = document.getElementById('boas-vindas-aluno');
            if (elBoasVindas) {
                elBoasVindas.innerText = `Olá, ${nomeExibicao}!`;
            }

            const verificarAlertaPersistent = (cardId, totalAtual) => {
                const storageKey = `visto_${cardId}_${user.uid}`;
                const ultimoVisto = parseInt(localStorage.getItem(storageKey) || "0");
                const cardEl = document.getElementById(cardId);
                if (cardEl) {
                    if (totalAtual > ultimoVisto) cardEl.classList.add('blink-alerta');
                    else cardEl.classList.remove('blink-alerta');
                }
            };

            // --- MONITORAMENTO DE ATIVIDADES PENDENTES ---
            // --- MONITORAMENTO DE ATIVIDADES PENDENTES ---
            const monitorarAtividadesSync = (tipo, elId, cardId, globalVar) => {
                const qAtv = query(collection(db, "atividades_enviadas"), where("tipo", "==", tipo));

                onSnapshot(qAtv, (snapAtv) => {
                    const colecaoResp = (tipo === 'escrita') ? "redacoes" : "respostas_alunos";
                    const qFeitas = query(collection(db, colecaoResp), where("alunoId", "==", user.uid));

                    onSnapshot(qFeitas, (snapFeitas) => {
                        const idsFeitos = new Set();
                        snapFeitas.forEach(d => {
                            const data = d.data();
                            const idRef = data.atividadeId || data.idAtividade || data.docIdAtividade;
                            if (idRef) idsFeitos.add(idRef);
                        });

                        let pendentes = 0;
                        snapAtv.forEach(docAtv => {
                            const dataAtv = docAtv.data();
                            const tRaiz = dataAtv.turma || "";
                            const sRaiz = dataAtv.semestre || "";
                            const tArray = dataAtv.turmasSelecionadas || [];
                            const tQuestao = (dataAtv.questoes && dataAtv.questoes[0]) ? dataAtv.questoes[0].turma : "";

                            const pertenceAosEstudosDoAluno = 
                                (turmaAluno !== "" && (tRaiz === turmaAluno || tArray.includes(turmaAluno) || tQuestao === turmaAluno)) ||
                                (semestreAluno !== "" && (tRaiz === semestreAluno || sRaiz === semestreAluno || tQuestao === semestreAluno));

                            if (pertenceAosEstudosDoAluno && !idsFeitos.has(docAtv.id)) {
                                pendentes++;
                            }
                        });

                        const el = document.getElementById(elId);
                        if (el) el.innerText = pendentes;

                        // Lógica para forçar o brilho se o número aumentar durante a sessão
                        if (window[globalVar] !== null && pendentes > window[globalVar]) {
                            const card = document.getElementById(cardId);
                            if (card) {
                                card.classList.remove('blink-alerta');
                                void card.offsetWidth; 
                                card.classList.add('blink-alerta');
                            }
                        }

                        window[globalVar] = pendentes;
                        verificarAlertaPersistent(cardId, pendentes);
                    });
                });
            };

            monitorarAtividadesSync("escrita", "count-escrita", "card-escrita", "countEscrita");
            monitorarAtividadesSync("oral", "count-oral", "card-oral", "countOral");
            monitorarAtividadesSync("gramatica", "count-gramatica", "card-gramatica", "countGramatica");
            
            // Monitoramento específico para Auditiva garantindo o efeito visual
            const monitorarAuditivaComBlink = () => {
                monitorarAtividadesSync("auditiva", "count-auditiva", "card-auditiva", "countAuditiva");
            };
            monitorarAuditivaComBlink();

            const monitorarFeedbacksHome = () => {
                const qRed = query(collection(db, "redacoes"), where("alunoId", "==", user.uid));
                const qResp = query(collection(db, "respostas_alunos"), where("alunoId", "==", user.uid));
                const qForum = query(collection(db, "forum_comentarios"), where("citacao.nome", "==", nomeExibicao));
                
                let cRed = 0;
                let cResp = 0;
                let cForum = 0;

                const atualizarCardFeedback = () => {
                    const total = cRed + cResp + cForum;
                    const elFeedback = document.getElementById('card-feedback-count');
                    if (elFeedback) elFeedback.innerText = total;

                    if (window.feedbackCount !== null && total > window.feedbackCount) {
                        const card = document.getElementById('card-feedback');
                        if (card) {
                            card.classList.remove('blink-alerta');
                            void card.offsetWidth;
                            card.classList.add('blink-alerta');
                        }
                    }
                    window.feedbackCount = total;
                    verificarAlertaPersistent('card-feedback', total);
                };

                onSnapshot(qRed, (snap) => {
                    // Lógica idêntica à tela de feedbacks: status corrigida ou tem feedbackProfessor
                    cRed = snap.docs.filter(d => {
                        const data = d.data();
                        return data.status === 'corrigida' || data.feedbackProfessor;
                    }).length;
                    atualizarCardFeedback();
                });

                onSnapshot(qResp, (snap) => {
                    // Lógica idêntica à tela de feedbacks: avaliado true ou (escrita corrigida)
                    cResp = snap.docs.filter(d => {
                        const data = d.data();
                        const corrigido = (data.tipo === 'escrita' && (data.status === 'corrigida' || data.feedbackProfessor)) || (data.tipo === 'oral' && data.avaliated === true) || data.avaliado === true;
                        return corrigido;
                    }).length;
                    atualizarCardFeedback();
                });

                onSnapshot(qForum, (snap) => {
                    cForum = snap.docs.filter(d => d.data().autorId !== user.uid).length;
                    atualizarCardFeedback();
                });
            };
            monitorarFeedbacksHome();

            onSnapshot(query(collection(db, "mensagens_diretas"), where("destinatarioId", "==", user.uid)), (snap) => {
                const total = snap.size;
                const el = document.getElementById('card-msg-count');
                if (el) el.innerText = total;
                window.msgCount = total;
                verificarAlertaPersistent('card-msg', total);
            });

            // --- NOVO MONITORAMENTO DO FÓRUM ---
            const monitorarForumHome = () => {
                const qForum = query(collection(db, "forum_topicos"));
                
                onSnapshot(qForum, (snap) => {
                    const topicosVisiveis = snap.docs.filter(docSnap => {
                        const t = docSnap.data();
                        const destinoID = String(t.destinoID || "").trim();
                        // Aqui ele usa as variáveis turmaAluno e semestreAluno que já existem no topo do seu código
                        const minhaTurma = turmaAluno; 
                        const meuSemestre = semestreAluno; 

                        if (t.destinoTipo === 'turma') return destinoID === minhaTurma;
                        if (t.destinoTipo === 'semestre') return destinoID === meuSemestre;
                        return false;
                    }).length;

                    const el = document.getElementById('card-forum-count');
                    if (el) el.innerText = topicosVisiveis;
                    
                    verificarAlertaPersistent('card-forum', topicosVisiveis);
                });
            };
            monitorarForumHome();

           const monitorarMinhasParticipacoes = () => {
                const qParticipacoes = query(collection(db, "forum_comentarios"), where("autorId", "==", user.uid));
                onSnapshot(qParticipacoes, (snap) => {
                    const total = snap.size;
                    const el = document.getElementById('count-participacao-forum');
                    if (el) el.innerText = total;
                });
            };
            monitorarMinhasParticipacoes();

            // --- MONITORAMENTO DO PRÓXIMO EVENTO (FIRESTORE) ---
            const monitorarProximoEventoAluno = async () => {
                const elTitulo = document.getElementById('prox-evento-titulo');
                const elData = document.getElementById('prox-evento-data');
                if (!elTitulo || !turmaAluno) return;

                try {
                    // 1. Localiza a turma para achar o ID do professor
                    const qTurma = query(collection(db, "turmas"), where("senha", "==", turmaAluno));
                    const snapTurma = await getDocs(qTurma);
                    
                    if (snapTurma.empty) return;
                    const professorId = snapTurma.docs[0].data().professorResponsavelId;

                    // 2. Monitora os eventos desse professor
                    const qEventos = query(collection(db, "eventos"), where("professorResponsavelId", "==", professorId));
                    
                    onSnapshot(qEventos, (snapEv) => {
                        const hoje = new Date().setHours(0, 0, 0, 0);
                        const eventos = snapEv.docs
                            .map(d => d.data())
                            .filter(e => new Date(e.data + 'T00:00:00') >= hoje)
                            .sort((a, b) => a.data.localeCompare(b.data));

                        if (eventos.length > 0) {
                            const prox = eventos[0];
                            const [ano, mes, dia] = prox.data.split('-');
                            elTitulo.innerText = prox.titulo;
                            elData.innerText = `${dia}/${mes}/${ano}`;
                        } else {
                            elTitulo.innerText = "Nenhum";
                            elData.innerText = "--/--/--";
                        }
                    });
                } catch (err) {
                    console.error("Erro ao monitorar evento no home:", err);
                }
            };
            monitorarProximoEventoAluno();

        } catch (e) { 
            console.error("Erro na Home Aluno:", e); 
            const elBoasVindas = document.getElementById('boas-vindas-aluno');
            if (elBoasVindas) elBoasVindas.innerText = "ERRO AO CARREGAR";
        }
    };

    window.acaoAtividadeTipo = (cardId, tipo) => {
        const total = document.getElementById(`count-${tipo}`)?.innerText || "0";
        const user = window.authMethods.getAuth().currentUser;
        localStorage.setItem(`visto_${cardId}_${user.uid}`, total);
        document.getElementById(cardId)?.classList.remove('blink-alerta');
        window.location.hash = (tipo === 'gramatica' || tipo === 'auditiva' || tipo === 'oral') ? `#${tipo}alunoclm` : `#atividadesclm?tipo=${tipo}`;
    };

    window.acaoEscrita = () => {
        const total = document.getElementById('count-escrita')?.innerText || "0";
        const user = window.authMethods.getAuth().currentUser;
        localStorage.setItem(`visto_card-escrita_${user.uid}`, total);
        document.getElementById('card-escrita')?.classList.remove('blink-alerta');
        window.location.hash = '#escritaalunoclm';
    };

    window.acaoMensagens = () => {
        const total = document.getElementById('card-msg-count')?.innerText || "0";
        const user = window.authMethods.getAuth().currentUser;
        localStorage.setItem(`visto_card-msg_${user.uid}`, total);
        document.getElementById('card-msg')?.classList.remove('blink-alerta');
        window.location.hash = '#mensagensclm';
    };

    window.acaoFeedbacks = () => {
        const total = document.getElementById('card-feedback-count')?.innerText || "0";
        const user = window.authMethods.getAuth().currentUser;
        localStorage.setItem(`visto_card-feedback_${user.uid}`, total);
        document.getElementById('card-feedback')?.classList.remove('blink-alerta');
        window.location.hash = '#feedbackdoalunoclm';
    };

    window.acaoFeedbacks = () => {
        const total = document.getElementById('card-feedback-count')?.innerText || "0";
        const user = window.authMethods.getAuth().currentUser;
        localStorage.setItem(`visto_card-feedback_${user.uid}`, total);
        document.getElementById('card-feedback')?.classList.remove('blink-alerta');
        window.location.hash = '#feedbackdoalunoclm';
    };

    window.acaoForum = () => {
        const total = document.getElementById('card-forum-count')?.innerText || "0";
        const auth = window.authMethods.getAuth();
        const user = auth.currentUser;
        if (user) {
            localStorage.setItem(`visto_card-forum_${user.uid}`, total);
        }
        document.getElementById('card-forum')?.classList.remove('blink-alerta');
        // CORREÇÃO AQUI: O destino correto é forumalunoclm
        window.location.hash = '#forumalunoclm';
    };

   window.acaoParticipacoes = () => {
        window.location.hash = '#forumalunoclm';
    };

    setTimeout(carregarDadosHomeAluno, 200);

    return `
        <style>
            .header-prof { width: 100%; margin-bottom: 25px; }
            .stats-grid { 
                display: grid; 
                grid-template-columns: repeat(4, 1fr); 
                gap: 20px; 
                margin-bottom: 20px; 
            }
            .stat-card { 
                background: #fff; 
                padding: 20px; 
                border-radius: 18px; 
                box-shadow: 0 4px 20px rgba(0,0,0,0.05); 
                display: flex; 
                flex-direction: column; 
                height: 140px; 
                width: 100%;
                box-sizing: border-box; 
                border-top: 6px solid ${azulPadrao}; 
                transition: 0.3s; 
                position: relative;
                overflow: hidden;
            }
            .stat-card.clickable { cursor: pointer; }
            .stat-card.clickable:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
            
            .stat-card span { font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
            .stat-card .count { font-size: 1.8rem; color: ${azulPadrao}; margin-top: 5px; font-weight: 800; }
            .stat-card .event-date { font-size: 0.85rem; color: #004b87; font-weight: 600; margin-top: 5px; }

            .blink-alerta { animation: pulse-verde-aluno 1s infinite !important; border-top-color: ${verdeAlerta} !important; box-shadow: 0 0 15px rgba(34, 197, 94, 0.4) !important; }
            @keyframes pulse-verde-aluno { 0% { background-color: #ffffff; } 50% { background-color: #f0fdf4; } 100% { background-color: #ffffff; } }

            @media (max-width: 1024px) { 
                .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } 
            }
            @media (max-width: 600px) { 
                .stats-grid { grid-template-columns: 1fr; }
                .stat-card { height: 120px; }
            }
        </style>

        <div class="header-prof">
            <h1 id="boas-vindas-aluno" style="text-transform: uppercase; font-weight: 800; color: ${azulPadrao}; margin:0;">CARREGANDO...</h1>
            <p id="subtitulo-aluno" style="color: #64748b; font-weight: 500; font-size: 1.1rem; margin: 5px 0;">Bons estudos hoje!</p>
        </div>

        <hr style="border:0; border-top:2px solid #f1f5f9; margin: 20px 0 30px 0;">

        <div class="stats-grid">
            <div class="stat-card clickable" id="card-escrita" onclick="window.acaoEscrita()">
                <span>Escritas recebidas</span>
                <div id="count-escrita" class="count">0</div>
            </div>
            <div class="stat-card clickable" id="card-oral" onclick="window.acaoAtividadeTipo('card-oral', 'oral')">
                <span>Orais recebidas</span>
                <div id="count-oral" class="count">0</div>
            </div>
            <div class="stat-card clickable" id="card-gramatica" onclick="window.acaoAtividadeTipo('card-gramatica', 'gramatica')">
                <span>Gramáticas recebidas</span>
                <div id="count-gramatica" class="count">0</div>
            </div>
            <div class="stat-card clickable" id="card-auditiva" onclick="window.acaoAtividadeTipo('card-auditiva', 'auditiva')">
                <span>Auditivas recebidas</span>
                <div id="count-auditiva" class="count">0</div>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card clickable" id="card-eventos" onclick="window.location.hash = '#calendarioclm'">
                <span>Próximo Evento</span>
                <div id="prox-evento-titulo" class="count" style="font-size: 1.1rem; line-height: 1.2; margin-bottom: 5px;">Nenhum</div>
                <div id="prox-evento-data" class="event-date">--/--/--</div>
            </div>
            <div class="stat-card clickable" id="card-feedback" onclick="window.acaoFeedbacks()">
                <span>Feedbacks Recebidos</span>
                <div id="card-feedback-count" class="count">0</div>
            </div>
            <div class="stat-card clickable" id="card-forum" onclick="window.acaoForum()">
                <span>Fórum</span>
                <div id="card-forum-count" class="count">0</div>
            </div>
            <div class="stat-card clickable" id="card-participacao-forum" onclick="window.acaoParticipacoes()">
                <span>Participações nos fóruns</span>
                <div id="count-participacao-forum" class="count">0</div>
            </div>
        </div>
    `;
});
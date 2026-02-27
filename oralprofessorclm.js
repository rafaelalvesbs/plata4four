window.Router.register('oralprofessorclm', async () => {
    const db = window.db;
    const { collection, getDocs, addDoc, serverTimestamp, query, where, doc, deleteDoc, updateDoc, getDoc, setDoc } = window.fsMethods;

    // Bloqueio Mobile Reforçado
    if (window.innerWidth < 1024 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        setTimeout(() => {
            const containerPrincipal = document.getElementById('render-content') || document.querySelector('#app') || document.body;
            if (containerPrincipal) {
                containerPrincipal.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:80vh; padding:20px; text-align:center; font-family:sans-serif; background:#f8fafc; position:fixed; top:0; left:0; width:100%; z-index:99999;">
                        <div style="background:#fff1f1; color:#ef4444; width:80px; height:80px; border-radius:20px; display:flex; align-items:center; justify-content:center; margin-bottom:20px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                            <i class="fa-solid fa-laptop" style="font-size:40px;"></i>
                        </div>
                        <h2 style="color:#003058; margin:0 0 15px 0; font-weight:900; font-size:24px;">Painel Exclusivo para Desktop</h2>
                        <p style="color:#64748b; line-height:1.6; max-width:320px; margin:0 0 30px 0; font-size:16px;">
                            A criação de atividades de <strong>Oral</strong> requer uma tela maior para melhor organização e visualização. Por favor, acesse através de um computador.
                        </p>
                        <button onclick="window.location.hash='#home'; window.location.reload();" style="background:#003058; color:white; border:none; padding:16px 40px; border-radius:12px; font-weight:800; cursor:pointer; width:100%; max-width:250px; text-transform:uppercase; letter-spacing:1px;">Voltar ao Início</button>
                    </div>
                `;
            }
        }, 50);
        return; // Interrompe a execução para mobile
    }

    // --- VARIÁVEIS DE ESTADO ---
    let enviadasCache = [];
    let recebidasCache = []; 
    let corrigidasCache = [];
    let idEditandoOral = null; 
    let timeoutAutoSave = null;
    const azulCLM = "#003058";

    // --- PAGINAÇÃO ---
    const CARDS_POR_PAGINA = 8;
    let paginaEnviadas = 1;
    let paginaRecebidas = 1;
    let paginaCorrigidas = 1;

    // --- SISTEMA DE ALERTAS ---
    window.showAlertOral = (titulo, mensagem, tipo = 'info') => {
        const modal = document.getElementById('modal-alert-oral');
        const titleEl = document.getElementById('alert-title-oral');
        const msgEl = document.getElementById('alert-msg-oral');
        const iconEl = document.getElementById('alert-icon-oral');
        if(!modal) return;
        titleEl.innerText = titulo;
        msgEl.innerHTML = mensagem;
        iconEl.innerHTML = tipo === 'error' ? '<i class="fa-solid fa-circle-xmark" style="color:#ef4444; font-size:40px;"></i>' : '<i class="fa-solid fa-circle-check" style="color:#003058; font-size:40px;"></i>';
        modal.style.display = 'flex';
    };

    window.closeAlertOral = () => { document.getElementById('modal-alert-oral').style.display = 'none'; };

    window.showConfirmOral = (titulo, mensagem, onConfirm) => {
        const modal = document.getElementById('modal-confirm-oral');
        document.getElementById('confirm-title-oral').innerText = titulo;
        document.getElementById('confirm-msg-oral').innerText = mensagem;
        modal.style.display = 'flex';
        window.pendingConfirmActionOral = () => { onConfirm(); modal.style.display = 'none'; };
    };

    // --- VISUALIZAR ATIVIDADE CRIADA (MODAL BONITO) ---
    window.visualizarAtividadeOral = (id) => {
        const item = enviadasCache.find(atv => atv.id === id);
        if(!item) return;
        
        const modal = document.getElementById('modal-view-oral');
        const content = document.getElementById('view-content-oral');
        document.getElementById('view-title-oral').innerText = item.titulo;
        document.getElementById('view-subtitle-oral').innerText = `Turma: ${item.turma} | Prazo: ${item.prazo}`;

        content.innerHTML = item.questoes.map((q, idx) => `
            <div class="view-q-card">
                <div class="view-q-badge">QUESTÃO ${idx + 1}</div>
                <div class="view-q-text">${q.enunciado}</div>
            </div>
        `).join('');
        
        modal.style.display = 'flex';
    };

    window.closeViewOral = () => { document.getElementById('modal-view-oral').style.display = 'none'; };

    // --- SISTEMA DE FEEDBACK ---
    window.abrirFeedbackOral = (idResposta) => {
        const resposta = recebidasCache.find(r => r.id === idResposta) || corrigidasCache.find(r => r.id === idResposta);
        if(!resposta) return;

        const modal = document.getElementById('modal-feedback-oral');
        const content = document.getElementById('feedback-content-oral');
        document.getElementById('feedback-aluno-nome').innerText = `Avaliar: ${resposta.nomeAluno}`;
        
        const listaRespostas = resposta.questoes || resposta.respostas || [];

        content.innerHTML = listaRespostas.map((q, idx) => `
            <div style="margin-bottom:20px; padding:15px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
                <div style="font-size:11px; font-weight:800; color:${azulCLM}; margin-bottom:8px;">QUESTÃO ${idx + 1}: ${q.enunciado || ''}</div>
                ${q.audioUrl ? `<audio controls src="${q.audioUrl}" style="width:100%; margin-bottom:10px;"></audio>` : '<p style="color:#ef4444; font-size:10px; font-weight:bold;">[Áudio não encontrado ou falha no envio]</p>'}
                <label class="label-sutil">Sua Avaliação / Feedback:</label>
                <textarea id="feedback-text-${idx}" class="input-premium" style="height:60px; resize:none;" placeholder="Comente sobre a pronúncia..." autocomplete="off">${q.feedbackProf || ''}</textarea>
            </div>
        `).join('');

        const footer = document.getElementById('feedback-footer-oral');
        footer.innerHTML = `
            <button class="btn-publish-oral" onclick="window.enviarFeedbackOral('${idResposta}')">
                ENVIAR FEEDBACK AO ALUNO
            </button>
        `;
        modal.style.display = 'flex';
    };

    window.enviarFeedbackOral = async (idResposta) => {
        const resposta = recebidasCache.find(r => r.id === idResposta) || corrigidasCache.find(r => r.id === idResposta);
        const listaOrigem = resposta.questoes || resposta.respostas || [];
        
        const novasQuestoes = listaOrigem.map((q, i) => ({
            ...q,
            feedbackProf: document.getElementById(`feedback-text-${i}`).value
        }));

        try {
            // Salva o feedback mantendo a estrutura da nova coleção
            await updateDoc(doc(db, "respostas_alunos", idResposta), { 
                questoes: novasQuestoes,
                avaliado: true,
                status: "corrigida",
                dataAvaliacao: serverTimestamp()
            });

            window.showAlertOral("Sucesso", "Feedback enviado com sucesso!");
            document.getElementById('modal-feedback-oral').style.display = 'none';
            window.carregarRecebidasOral();
        } catch (e) {
            window.showAlertOral("Erro", "Falha ao salvar feedback.", "error");
        }
    };

    // --- AUTO SAVE ---
    window.triggerAutoSaveOral = () => {
        if (!idEditandoOral) return;
        clearTimeout(timeoutAutoSave);
        const statusElement = document.getElementById('save-status-oral');
        if(statusElement) statusElement.innerText = "Pendentes...";
        timeoutAutoSave = setTimeout(async () => {
            await window.enviarAtividadeOral(true);
            if(statusElement) { statusElement.innerText = "Salvo!"; setTimeout(() => { statusElement.innerText = ""; }, 2000); }
        }, 2000);
    };

    // --- NAVEGAÇÃO ---
    window.switchMainTabOral = (tab) => {
        document.querySelectorAll('.main-tab-btn-oral').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane-oral').forEach(pane => pane.style.display = 'none');
        document.getElementById(`tab-btn-oral-${tab}`).classList.add('active');
        document.getElementById(`pane-oral-${tab}`).style.display = 'block';

        if(tab === 'enviadas') window.carregarAtividadesEnviadasOral();
        if(tab === 'recebidas' || tab === 'corrigidas') window.carregarRecebidasOral();
    };

    window.switchQuestaoOral = (num) => {
        document.querySelectorAll('.o-btn-pill').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.o-content-box').forEach(c => c.style.display = 'none');
        document.getElementById(`btn-oral-${num}`).classList.add('active');
        document.getElementById(`content-oral-${num}`).style.display = 'block';
    };

    // --- PAGINAÇÃO ---
    const renderPaginacao = (totalItems, paginaAtual, storageVar) => {
        const totalPaginas = Math.ceil(totalItems / CARDS_POR_PAGINA);
        if (totalPaginas <= 1) return '';
        
        return `
            <div class="pagination-container" style="display:flex; justify-content:center; align-items:center; gap:15px; margin-top:15px; padding:10px;">
                <button class="btn-icon-circle" ${paginaAtual === 1 ? 'disabled style="opacity:0.3;"' : `onclick="window.mudarPaginaOral('${storageVar}', ${paginaAtual - 1})"`}>
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <span style="font-size:11px; font-weight:800; color:${azulCLM}">PÁGINA ${paginaAtual} DE ${totalPaginas}</span>
                <button class="btn-icon-circle" ${paginaAtual === totalPaginas ? 'disabled style="opacity:0.3;"' : `onclick="window.mudarPaginaOral('${storageVar}', ${paginaAtual + 1})"`}>
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>
        `;
    };

    window.mudarPaginaOral = (storageVar, novaPagina) => {
        if (storageVar === 'enviadas') { paginaEnviadas = novaPagina; window.carregarAtividadesEnviadasOral(); }
        if (storageVar === 'recebidas') { paginaRecebidas = novaPagina; window.carregarRecebidasOral(); }
        if (storageVar === 'corrigidas') { paginaCorrigidas = novaPagina; window.carregarRecebidasOral(); }
    };

    // --- CARREGAMENTO DE LISTAS ---
    window.carregarAtividadesEnviadasOral = async () => {
        const container = document.getElementById('lista-enviadas-oral-content');
        const userAtual = window.authMethods.getAuth().currentUser;
        if (!userAtual) return;

        container.innerHTML = '<p style="padding:15px; color:#64748b;">Carregando suas atividades...</p>';
        try {
            const q = query(
                collection(db, "atividades_enviadas"), 
                where("tipo", "==", "oral"),
                where("professorId", "==", userAtual.uid)
            );
            const snap = await getDocs(q);
            enviadasCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            const inicio = (paginaEnviadas - 1) * CARDS_POR_PAGINA;
            const itemsPagina = enviadasCache.slice(inicio, inicio + CARDS_POR_PAGINA);

            const htmlCards = itemsPagina.map(data => `
                <div class="card-premium-list" style="border-left:4px solid ${azulCLM};">
                    <div style="display:flex; align-items:center; flex:1; gap:25px; overflow:hidden;">
                        <div style="min-width: 65px; flex-shrink:0;">
                            <span style="font-size:9px; padding:3px 7px; background:${azulCLM}; color:white; border-radius:4px; font-weight:800;">${data.turma}</span>
                        </div>
                        <div style="flex:2; overflow:hidden;">
                            <h3 style="margin:0; color:${azulCLM}; font-size:13px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${data.titulo}</h3>
                        </div>
                        <div style="flex:1; min-width:110px; flex-shrink:0;">
                            <div style="font-size:10px; color:#94a3b8; font-weight:600; display:flex; align-items:center; gap:5px;">
                                <i class="fa-regular fa-calendar"></i> Prazo: ${data.prazo}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; margin-left:20px; flex-shrink:0;">
                        <button onclick="window.visualizarAtividadeOral('${data.id}')" title="Visualizar" style="background:#e0f2fe; color:#0369a1; border:none; border-radius:50%; width:30px; height:30px; cursor:pointer;"><i class="fa-solid fa-eye"></i></button>
                        <button onclick="window.prepararEdicaoOral('${data.id}')" title="Editar" style="background:#f1f5f9; color:${azulCLM}; border:none; border-radius:50%; width:30px; height:30px; cursor:pointer;"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="window.excluirAtividadeOral('${data.id}')" title="Excluir" style="background:#fee2e2; color:#ef4444; border:none; border-radius:50%; width:30px; height:30px; cursor:pointer;"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            `).join('');

            container.innerHTML = htmlCards + renderPaginacao(enviadasCache.length, paginaEnviadas, 'enviadas');
        } catch (e) { 
            console.error(e);
            container.innerHTML = '<p style="padding:15px; color:red;">Erro ao carregar atividades.</p>'; 
        }
    };

    window.carregarRecebidasOral = async () => {
        const contRecebidas = document.getElementById('lista-recebidas-oral-content');
        const contCorrigidas = document.getElementById('lista-corrigidas-oral-content');
        const userAtual = window.authMethods.getAuth().currentUser;
        if (!userAtual) return;

        contRecebidas.innerHTML = '<p style="padding:15px; color:#64748b;">Buscando respostas...</p>';
        contCorrigidas.innerHTML = '<p style="padding:15px; color:#64748b;">Buscando histórico...</p>';
        
        try {
            const q = query(
                collection(db, "respostas_alunos"), 
                where("tipo", "==", "oral"),
                where("professorId", "==", userAtual.uid)
            );
            const snap = await getDocs(q);
            const todosDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            recebidasCache = todosDocs.filter(d => d.avaliado === false || !d.avaliado);
            corrigidasCache = todosDocs.filter(d => d.avaliado === true);

            const renderCard = (data) => {
                return `
                <div class="card-premium-list" style="border-left:4px solid ${azulCLM};">
                    <div style="display:flex; align-items:center; flex:1; gap:25px; overflow:hidden;">
                        <div style="min-width: 85px; flex-shrink:0;">
                            <span style="font-size:9px; padding:3px 7px; background:${azulCLM}; color:white; border-radius:4px; font-weight:800; text-transform:uppercase;">
                                ${data.avaliado ? 'CORRIGIDO' : 'PENDENTE'}
                            </span>
                        </div>
                        <div style="flex:1.5; overflow:hidden;">
                            <h3 style="margin:0; color:${azulCLM}; font-size:13px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${data.nomeAluno}</h3>
                        </div>
                        <div style="flex:1.5; overflow:hidden;">
                            <div style="font-size:10px; color:#64748b; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:6px;">
                                <i class="fa-solid fa-file-signature" style="opacity:0.5;"></i> ${data.atividadeTitulo || data.titulo}
                            </div>
                        </div>
                    </div>
                    <button onclick="window.abrirFeedbackOral('${data.id}')" style="background:#f1f5f9; color:${azulCLM}; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; display:flex; align-items:center; gap:8px; flex-shrink:0; margin-left:20px;">
                        <i class="fa-solid fa-microphone-lines" style="font-size:12px;"></i>
                        <span style="font-size:11px; font-weight:800; text-transform:uppercase;">${data.avaliado ? 'Revisar' : 'Ouvir'}</span>
                    </button>
                </div>`;
            };

            const itemsRecebidas = recebidasCache.slice((paginaRecebidas - 1) * CARDS_POR_PAGINA, paginaRecebidas * CARDS_POR_PAGINA);
            contRecebidas.innerHTML = itemsRecebidas.length ? itemsRecebidas.map(renderCard).join('') + renderPaginacao(recebidasCache.length, paginaRecebidas, 'recebidas') : '<p style="padding:10px; color:#94a3b8; font-size:11px;">Nenhuma pendente.</p>';

            const itemsCorrigidas = corrigidasCache.slice((paginaCorrigidas - 1) * CARDS_POR_PAGINA, paginaCorrigidas * CARDS_POR_PAGINA);
            contCorrigidas.innerHTML = itemsCorrigidas.length ? itemsCorrigidas.map(renderCard).join('') + renderPaginacao(corrigidasCache.length, paginaCorrigidas, 'corrigidas') : '<p style="padding:10px; color:#94a3b8; font-size:11px;">Nenhuma corrigida.</p>';
            
        } catch (e) { 
            contRecebidas.innerHTML = '<p>Erro.</p>';
            contCorrigidas.innerHTML = '<p>Erro.</p>';
        }
    };

    // --- SALVAMENTO ---
    window.enviarAtividadeOral = async (isAutoSave = false) => {
        const turmaBtn = document.querySelector('#turma-pills-oral .btn-turma-pill.active');
        const titulo = document.getElementById('titulo-oral').value;
        const prazo = document.getElementById('prazo-oral').value;
        if(!isAutoSave) {
            if(!turmaBtn || !titulo || !prazo) {
                return window.showAlertOral("Atenção", "Campos obrigatórios vazios!", "error");
            }

            const dataHoje = new Date();
            dataHoje.setHours(0, 0, 0, 0);
            const dataPrazo = new Date(prazo + 'T00:00:00');

            if (dataPrazo < dataHoje) {
                return window.showAlertOral("Data Inválida", "O prazo não pode ser uma data que já passou!", "error");
            }
        }
        
        let questoes = [];
        for(let i=1; i<=10; i++) {
            const enunc = document.getElementById(`enunciado-oral-${i}`).value;
            if(enunc.trim()) questoes.push({ enunciado: enunc });
        }

        const userAtual = window.authMethods.getAuth().currentUser;
        if (!userAtual) return window.showAlertOral("Erro", "Você precisa estar logado.", "error");

        const dados = { 
            tipo: 'oral', 
            titulo, 
            turma: turmaBtn?.dataset.nome, 
            prazo, 
            questoes, 
            dataCriacao: serverTimestamp(),
            professorId: userAtual.uid 
        };

       const btnPublicar = document.querySelector('.btn-publish-oral');

    if (!isAutoSave && btnPublicar) {
        btnPublicar.disabled = true;
        btnPublicar.innerText = "ENVIANDO...";
        btnPublicar.style.opacity = "0.7";
        btnPublicar.style.cursor = "not-allowed";
    }

    try {
        if (idEditandoOral) {
            await updateDoc(doc(db, "atividades_enviadas", idEditandoOral), dados);
            if (!isAutoSave) {
                window.showAlertOral("Sucesso", "Atividade atualizada!");
                window.switchMainTabOral('enviadas');
            }
        } else if (!isAutoSave) {
            await addDoc(collection(db, "atividades_enviadas"), dados);
            window.showAlertOral("Sucesso", "Atividade publicada com sucesso!");
            window.switchMainTabOral('enviadas');
        }
    } catch (e) {
        console.error("Erro ao salvar:", e);
        window.showAlertOral("Erro", "Falha ao salvar no banco de dados.", "error");
    } finally {
        if (!isAutoSave && btnPublicar) {
            btnPublicar.disabled = false;
            btnPublicar.innerText = idEditandoOral ? "ATUALIZAR ATIVIDADE" : "PUBLICAR AGORA";
            btnPublicar.style.opacity = "1";
            btnPublicar.style.cursor = "pointer";
        }
    }
    };

    window.prepararEdicaoOral = (id) => {
        const item = enviadasCache.find(atv => atv.id === id);
        if(!item) return;
        idEditandoOral = id;
        window.switchMainTabOral('criar');
        document.getElementById('titulo-oral').value = item.titulo || "";
        document.getElementById('prazo-oral').value = item.prazo || "";
        for(let i=1; i<=10; i++) document.getElementById(`enunciado-oral-${i}`).value = "";
        item.questoes.forEach((q, idx) => { document.getElementById(`enunciado-oral-${idx + 1}`).value = q.enunciado; });
    };

    window.excluirAtividadeOral = (id) => {
        window.showConfirmOral("Excluir?", "Apagar para sempre?", async () => {
            await deleteDoc(doc(db, "atividades_enviadas", id));
            window.carregarAtividadesEnviadasOral();
        });
    };

    // --- CARREGAMENTO DE TURMAS (LÓGICA IDÊNTICA À GRAMÁTICA) ---
    setTimeout(async () => {
        const div = document.getElementById('turma-pills-oral');
        if (!div) return;
        
        try {
            const auth = window.authMethods.getAuth();
            const userAtual = auth.currentUser;

            if (!userAtual) {
                div.innerHTML = "<p style='font-size:11px; color:red;'>Erro: Usuário não logado.</p>";
                return;
            }

            // Busca apenas turmas vinculadas a este professor
            const q = query(
                collection(db, "turmas"), 
                where("professorResponsavelId", "==", userAtual.uid)
            );
            
            const snap = await getDocs(q);
            const mapaUnico = new Map();

            snap.forEach(d => {
                const data = d.data();
                if (data.semestre && data.senha) {
                    mapaUnico.set(data.semestre.trim(), data.senha);
                }
            });

            const turmasLimpas = Array.from(mapaUnico, ([semestre, senha]) => ({ semestre, senha }));
            
            turmasLimpas.sort((a, b) => {
                const getVal = (s) => s.toLowerCase().includes('inter') ? 99 : (parseInt(s.replace(/\D/g,'')) || 0);
                return getVal(a.semestre) - getVal(b.semestre);
            });

            div.innerHTML = '';
            
            if (turmasLimpas.length === 0) {
                div.innerHTML = '<p style="font-size:11px; color:#94a3b8; padding:10px;">Nenhuma turma vinculada ao seu perfil.</p>';
                return;
            }

            turmasLimpas.forEach(t => {
                const btn = document.createElement('button');
                btn.className = 'btn-turma-pill';
                btn.innerText = t.semestre.toUpperCase();
                btn.dataset.nome = t.semestre;
                btn.dataset.senha = t.senha;
                btn.onclick = function () {
                    div.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    if(window.triggerAutoSaveOral) window.triggerAutoSaveOral();
                };
                div.appendChild(btn);
            });

            if (div.firstChild) div.firstChild.classList.add('active');

        } catch (erro) {
            console.error("Erro ao carregar semestres para oral:", erro);
            div.innerHTML = '<p style="font-size:11px; color:red;">Erro ao carregar turmas.</p>';
        }
    }, 800);

    return `
    <style>
        .oral-container { padding:15px; font-family:'Inter',sans-serif; }
        .card-oral { background:#fff; border-radius:15px; padding:20px; box-shadow:0 4px 15px rgba(0,0,0,0.05); border:1px solid #eef2f6; }
        .input-premium { width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:10px; font-size:13px; background:#f8fafc; margin-bottom:10px; box-sizing:border-box; }
        .label-sutil { font-size:10px; font-weight:800; color:#94a3b8; text-transform:uppercase; display:block; margin-bottom:4px; }
        
        .card-premium-list { 
            background:#fff; 
            border-radius:10px; 
            box-shadow:0 2px 6px rgba(0,0,0,0.04); 
            display: flex; 
            align-items: center; 
            margin-bottom: 8px; 
            padding: 10px 15px !important; 
            box-sizing: border-box;
            transition: 0.2s;
        }

        .badge-semestre { font-size:8px; padding:1px 5px; background:${azulCLM}; color:white; border-radius:3px; font-weight:800; }
        
        .btn-icon-circle { width:26px; height:26px; border-radius:50%; border:none; background:#f1f5f9; color:${azulCLM}; cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center; }
        .btn-icon-circle.delete { color:#ef4444; background:#fee2e2; }
        
        .btn-ouvir { background:#e0f2fe; color:#0369a1; border:none; border-radius:6px; padding:5px 10px; cursor:pointer; font-weight:800; font-size:9px; }
        
        .o-btn-pill { width:35px; height:35px; border-radius:10px; border:1px solid #e2e8f0; background:#fff; cursor:pointer; font-weight:800; color:#64748b; }
        .o-btn-pill.active { background:${azulCLM}; color:#fff; border-color:${azulCLM}; }
        
        .btn-turma-pill { padding:6px 15px; border:1px solid #e2e8f0; background:#fff; border-radius:20px; cursor:pointer; font-size:11px; font-weight:700; margin-right:6px; margin-bottom:5px; }
        .btn-turma-pill.active { background:${azulCLM}; color:#fff; border-color:${azulCLM}; }
        
        .main-tab-btn-oral { padding:10px 12px; border:none; background:none; cursor:pointer; font-weight:800; color:#94a3b8; border-bottom:3px solid transparent; font-size:11px; text-transform: uppercase; }
        .main-tab-btn-oral.active { color:${azulCLM}; border-bottom:3px solid ${azulCLM}; }
        
        .btn-publish-oral { background:${azulCLM}; color:#fff; border:none; padding:14px; width:100%; border-radius:12px; font-weight:800; cursor:pointer; margin-top:15px; transition:0.3s; }
        .btn-publish-oral:hover { filter: brightness(1.2); }

        /* MODAL VISUALIZAÇÃO MODERNO */
        .modal-view-modern { position:fixed; inset:0; background:rgba(0,15,30,0.6); backdrop-filter:blur(8px); display:none; justify-content:center; align-items:center; z-index:99999; padding:20px; }
        .view-card-container { background:#fff; width:100%; max-width:600px; border-radius:24px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); }
        .view-header { background:${azulCLM}; padding:25px; color:#fff; }
        .view-body { padding:20px; max-height:60vh; overflow-y:auto; background:#f1f5f9; }
        .view-q-card { background:#fff; border-radius:16px; padding:15px; margin-bottom:12px; border:1px solid #e2e8f0; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); }
        .view-q-badge { font-size:9px; font-weight:900; color:${azulCLM}; background:#e0f2fe; padding:4px 8px; border-radius:6px; display:inline-block; margin-bottom:8px; }
        .view-q-text { font-size:14px; color:#334155; line-height:1.5; font-weight:500; }
        .btn-close-view { background:#fff; color:${azulCLM}; border:none; padding:12px; font-weight:900; cursor:pointer; width:100%; border-top:1px solid #e2e8f0; }

        .modal-oral { position:fixed; inset:0; background:rgba(0,48,88,0.4); backdrop-filter:blur(5px); display:none; justify-content:center; align-items:center; z-index:9999; padding:20px; }
        .modal-oral-content { background:#fff; width:100%; max-width:450px; border-radius:25px; padding:30px; position:relative; box-sizing:border-box; }

        @media (max-width: 600px) {
            .main-tab-btn-oral { font-size: 10px; padding: 10px 5px; }
            .card-premium-list > div:first-child { flex-direction: column !important; align-items: flex-start !important; gap: 5px !important; }
            .card-premium-list { min-height: auto; padding: 15px !important; }
        }
    </style>

    <div class="oral-container">
        <div id="modal-alert-oral" class="modal-oral"><div class="modal-oral-content" style="text-align:center;"><div id="alert-icon-oral"></div><h3 id="alert-title-oral"></h3><p id="alert-msg-oral"></p><button class="btn-publish-oral" onclick="window.closeAlertOral()">OK</button></div></div>
        <div id="modal-confirm-oral" class="modal-oral"><div class="modal-oral-content" style="text-align:center;"><h3 id="confirm-title-oral"></h3><p id="confirm-msg-oral"></p><div style="display:flex; gap:10px;"><button class="btn-publish-oral" style="background:#ef4444" onclick="window.pendingConfirmActionOral()">SIM</button><button class="btn-publish-oral" style="background:#f1f5f9; color:#64748b" onclick="document.getElementById('modal-confirm-oral').style.display='none'">NÃO</button></div></div></div>
        <div id="modal-feedback-oral" class="modal-oral"><div class="modal-oral-content" style="max-width:550px;"><h3 id="feedback-aluno-nome" style="color:${azulCLM}; margin-top:0;"></h3><div id="feedback-content-oral" style="max-height:400px; overflow-y:auto; padding-right:10px;"></div><div id="feedback-footer-oral"></div><button class="btn-publish-oral" style="background:#f1f5f9; color:#64748b; margin-top:8px;" onclick="document.getElementById('modal-feedback-oral').style.display='none'">FECHAR</button></div></div>

        <div id="modal-view-oral" class="modal-view-modern">
            <div class="view-card-container">
                <div class="view-header">
                    <h2 id="view-title-oral" style="margin:0; font-size:18px; font-weight:900;"></h2>
                    <p id="view-subtitle-oral" style="margin:5px 0 0 0; font-size:11px; opacity:0.8; font-weight:600; text-transform:uppercase;"></p>
                </div>
                <div id="view-content-oral" class="view-body"></div>
                <button class="btn-close-view" onclick="window.closeViewOral()">FECHAR VISUALIZAÇÃO</button>
            </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap: wrap; gap:10px; margin-bottom: 30px;">
            <div>
                <h1 style="color:${azulCLM}; font-weight:900; margin:0; line-height:1;">Oral</h1>
            </div>
            <div id="save-status-oral" style="font-size:11px; color:${azulCLM}; font-weight:800;"></div>
        </div>

        <div class="main-tabs" style="display:flex; gap:2px; border-bottom:2px solid #e2e8f0; margin-bottom:20px; overflow-x:auto; white-space: nowrap;">
            <button id="tab-btn-oral-criar" class="main-tab-btn-oral active" onclick="window.switchMainTabOral('criar')">CRIAR</button>
            <button id="tab-btn-oral-enviadas" class="main-tab-btn-oral" onclick="window.switchMainTabOral('enviadas')">ENVIADAS</button>
            <button id="tab-btn-oral-recebidas" class="main-tab-btn-oral" onclick="window.switchMainTabOral('recebidas')">RECEBIDAS</button>
            <button id="tab-btn-oral-corrigidas" class="main-tab-btn-oral" onclick="window.switchMainTabOral('corrigidas')">CORRIGIDAS</button>
        </div>

        <div id="pane-oral-criar" class="tab-pane-oral">
            <div class="card-oral">
                <div style="display:grid; grid-template-columns: 1fr 140px; gap:12px;" class="grid-inputs">
                    <div><label class="label-sutil">Título da Atividade:</label><input type="text" id="titulo-oral" class="input-premium" placeholder="Escreva aqui dentro o título da atividade" oninput="window.triggerAutoSaveOral()" autocomplete="off"></div>
<div><label class="label-sutil">Prazo Final:</label><input type="date" id="prazo-oral" class="input-premium" onchange="window.triggerAutoSaveOral()" onfocus="this.min = new Date().toISOString().split('T')[0]" autocomplete="off"></div>
                </div>
                <label class="label-sutil">Semestre:</label><div id="turma-pills-oral" style="display:flex; flex-wrap:wrap; margin-bottom:15px;"></div>
                <label class="label-sutil">Questões:</label>
                <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:15px;">
                    ${[1,2,3,4,5,6,7,8,9,10].map(n => `<button id="btn-oral-${n}" class="o-btn-pill ${n===1?'active':''}" onclick="window.switchQuestaoOral(${n})">${n}</button>`).join('')}
                </div>
                <div style="background:#f8fafc; padding:20px; border-radius:15px; border:1px solid #e2e8f0;">
                    ${[1,2,3,4,5,6,7,8,9,10].map(n => `<div id="content-oral-${n}" class="o-content-box" style="${n===1?'':'display:none;'}"><label class="label-sutil">Enunciado da Questão ${n}:</label><textarea id="enunciado-oral-${n}" class="input-premium" style="height:100px; resize:none;" placeholder="Escreva aqui a pergunta que o aluno deve responder gravando a voz dele no idioma que você está trabalhado..." oninput="window.triggerAutoSaveOral()" autocomplete="off"></textarea></div>`).join('')}
                </div>
                <button class="btn-publish-oral" onclick="window.enviarAtividadeOral(false)">PUBLICAR AGORA</button>
            </div>
        </div>

        <div id="pane-oral-enviadas" class="tab-pane-oral" style="display:none;"><div id="lista-enviadas-oral-content"></div></div>
        <div id="pane-oral-recebidas" class="tab-pane-oral" style="display:none;"><div id="lista-recebidas-oral-content"></div></div>
        <div id="pane-oral-corrigidas" class="tab-pane-oral" style="display:none;"><div id="lista-corrigidas-oral-content"></div></div>
    </div>
    `;
});
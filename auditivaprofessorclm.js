window.Router.register('auditivaprofessorclm', async () => {
    // BLOQUEIO MOBILE
    if (window.innerWidth < 1024) {
        return `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh; text-align: center; padding: 30px; font-family: 'Inter', sans-serif;">
                <div style="background: #fff1f2; width: 70px; height: 70px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; border: 2px solid #e11d48;">
                    <i class="fa-solid fa-laptop" style="color:#e11d48; font-size: 1.8rem;"></i>
                </div>
                <h2 style="color: #0f172a; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.5px;">Painel Exclusivo para Desktop</h2>
                <p style="color: #64748b; max-width: 320px; line-height: 1.6; font-size: 0.95rem;">
                    A criação de atividades de <strong>Auditiva</strong> requer uma tela maior para melhor organização dos campos e visualização. Por favor, acesse através de um computador.
                </p>
                <button onclick="window.location.hash = '#home'" style="margin-top: 30px; padding: 14px 30px; background: #003058; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: 0.2s;">
                    Voltar ao Início
                </button>
            </div>
        `;
    }

    const db = window.db;
    const { 
        collection, getDocs, addDoc, doc, updateDoc, deleteDoc, 
        serverTimestamp, query, where, orderBy, getDoc 
    } = window.fsMethods;

    // --- VARIÁVEIS DE ESTADO ---
    let idEditandoAud = null;
    let enviadasCache = [];
    let recebidasCache = []; 
    let timeoutAutoSave = null;
    let paginaAtualEnviadas = 1;
    let paginaAtualRecebidas = 1;
    const itensPorPagina = 10;

    // --- SISTEMA DE ALERTAS ---
    window.showAlertAud = (titulo, mensagem, tipo = 'info') => {
        const modal = document.getElementById('modal-alert-aud');
        const titleEl = document.getElementById('alert-title-aud');
        const msgEl = document.getElementById('alert-msg-aud');
        const iconEl = document.getElementById('alert-icon-aud');
        if (!modal) return;
        titleEl.innerText = titulo;
        msgEl.innerHTML = mensagem;
        iconEl.innerHTML = tipo === 'error' ? 
            '<i class="fa-solid fa-circle-xmark" style="color:#ef4444; font-size:40px;"></i>' : 
            '<i class="fa-solid fa-circle-check" style="color:#003058; font-size:40px;"></i>';
        modal.style.display = 'flex';
    };

    window.closeAlertAud = () => { 
        const modal = document.getElementById('modal-alert-aud');
        if(modal) modal.style.display = 'none'; 
    };

    window.showConfirmAud = (titulo, mensagem, onConfirm) => {
        const modal = document.getElementById('modal-confirm-aud');
        document.getElementById('confirm-title-aud').innerText = titulo;
        document.getElementById('confirm-msg-aud').innerText = mensagem;
        modal.style.display = 'flex';
        window.pendingConfirmActionAud = async () => { 
            await onConfirm(); 
            modal.style.display = 'none'; 
        };
    };

    // --- AUTO SAVE ---
    window.triggerAutoSaveAud = () => {
        if (!idEditandoAud) return;
        clearTimeout(timeoutAutoSave);
        const statusElement = document.getElementById('save-status-aud');
        if(statusElement) statusElement.innerText = "Alterações pendentes...";
        timeoutAutoSave = setTimeout(async () => {
            await window.enviarAtividadeAuditiva(true);
            if(statusElement) { 
                statusElement.innerText = "Salvo!"; 
                setTimeout(() => { statusElement.innerText = ""; }, 2000); 
            }
        }, 2000);
    };

    // --- NAVEGAÇÃO ---
    window.switchMainTabAud = (tab) => {
        document.querySelectorAll('.main-tab-btn-aud').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane-aud').forEach(pane => pane.style.display = 'none');
        
        const btnAtivo = document.getElementById(`tab-btn-aud-${tab}`);
        const paneAtivo = document.getElementById(`pane-aud-${tab}`);
        
        if(btnAtivo) btnAtivo.classList.add('active');
        if(paneAtivo) paneAtivo.style.display = 'block';

        if(tab === 'enviadas') window.carregarAtividadesEnviadasAud();
        if(tab === 'recebidas') window.carregarRecebidasAud();
        
        if(tab !== 'criar') {
            idEditandoAud = null;
            const btnPub = document.querySelector('.btn-publish-aud');
            if(btnPub) btnPub.innerText = "PUBLICAR ATIVIDADE AUDITIVA";
        }
    };

    window.switchQuestaoAud = (num) => {
        document.querySelectorAll('.aud-btn-pill').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.aud-content-box').forEach(c => c.style.display = 'none');
        const targetBtn = document.getElementById(`btn-aud-${num}`);
        const targetContent = document.getElementById(`content-aud-${num}`);
        if(targetBtn) targetBtn.classList.add('active');
        if(targetContent) targetContent.style.display = 'block';
    };

    // --- PROCESSAMENTO DE ARQUIVOS ---
    window.handleAudioQuestao = async (input, n) => {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const statusElement = document.getElementById('save-status-aud');
        
        try {
            const modalUpload = document.getElementById('modal-upload-loading-aud');
            if (modalUpload) modalUpload.style.display = 'flex';
            
            const downloadURL = await window.uploadFile(file, 'audios_atividades');
            
            const player = document.getElementById(`audio-player-aud-${n}`);
            const source = document.getElementById(`audio-src-aud-${n}`);
            
            if (source && player) {
                source.src = downloadURL;
                player.load();
                document.getElementById(`audio-wrapper-aud-${n}`).style.display = 'block';
                if (modalUpload) modalUpload.style.display = 'none';
                window.triggerAutoSaveAud();
            }
        } catch (error) {
            console.error("Erro no upload:", error);
            if (statusElement) statusElement.innerText = "Erro no upload";
            alert("Falha ao enviar o áudio. Verifique sua conexão.");
        }
    }
};

    window.removerAudioQuestao = (n) => {
        const wrapper = document.getElementById(`audio-wrapper-aud-${n}`);
        const source = document.getElementById(`audio-src-aud-${n}`);
        if (wrapper && source) {
            wrapper.style.display = 'none';
            source.src = "";
            window.triggerAutoSaveAud();
        }
    };

    // --- SALVAMENTO E CARREGAMENTO ---
    window.enviarAtividadeAuditiva = async (isAutoSave = false) => {
        const semestreBtn = document.querySelector('#turma-pills-aud .btn-turma-pill.active');
        const titulo = document.getElementById('titulo-aud').value;
        const prazo = document.getElementById('prazo-aud').value;
        const btnPub = document.querySelector('.btn-publish-aud');
        const originalText = btnPub ? btnPub.innerHTML : "PUBLICAR ATIVIDADE AUDITIVA";

        if(!isAutoSave) {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const dataSelecionada = new Date(prazo + 'T00:00:00');

            if(!semestreBtn || !titulo || !prazo) {
                return window.showAlertAud("Atenção", "Preencha o título, o prazo e selecione o semestre!", "error");
            }

            if(dataSelecionada < hoje) {
                return window.showAlertAud("Erro de Prazo", "Não é permitido selecionar uma data retroativa!", "error");
            }

            btnPub.disabled = true;
            btnPub.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ENVIANDO...';
        }

        try {
            let questoes = [];
            for (let i = 1; i <= 10; i++) {
                const enunc = document.getElementById(`enunc-aud-${i}`).value.trim();
                const optA = document.getElementById(`opt-a-aud-${i}`).value.trim();
                const optB = document.getElementById(`opt-b-aud-${i}`).value.trim();
                const optC = document.getElementById(`opt-c-aud-${i}`).value.trim();
                const audioSrc = document.getElementById(`audio-src-aud-${i}`).src;

                // Verifica se a questão tem QUALQUER texto preenchido
                const temTexto = enunc !== "" || optA !== "" || optB !== "" || optC !== "";
                // Verifica se existe um link de áudio válido (diferente da URL da página e não vazio)
                const temAudio = audioSrc && audioSrc.startsWith('http') && !audioSrc.includes(window.location.hostname);

                if (temTexto || temAudio) {
                    if (!isAutoSave) {
                        // Se ele preencheu texto mas não pôs áudio OU pôs áudio mas não terminou o texto
                        if (!temTexto || !temAudio) {
                            btnPub.disabled = false;
                            btnPub.innerHTML = originalText;
                            const msg = !temAudio ? "anexar o áudio" : "preencher o enunciado e opções";
                            return window.showAlertAud("Questão " + i, `Para validar a questão ${i}, você precisa ${msg}.`, "error");
                        }
                    }

                    questoes.push({
                        enunciado: enunc,
                        opcoes: { A: optA, B: optB, C: optC },
                        correta: document.getElementById(`correct-aud-${i}`).value,
                        audioQuestao: audioSrc
                    });
                }
            }

            if(!isAutoSave && questoes.length === 0) {
                btnPub.disabled = false;
                btnPub.innerHTML = originalText;
                return window.showAlertAud("Atenção", "Adicione pelo menos uma questão!", "error");
            }

            const authInstancia = window.auth || (window.authMethods && window.authMethods.getAuth ? window.authMethods.getAuth() : null);
            const currentUser = authInstancia ? authInstancia.currentUser : null;

            if (!currentUser) {
                if(!isAutoSave) window.showAlertAud("Erro", "Usuário não autenticado. Recarregue a página.", "error");
                return;
            }

                const dados = {
                tipo: 'auditiva',
                titulo: titulo.trim(),
                semestre: semestreBtn ? semestreBtn.dataset.nome : "",
                prazo: prazo,
                questoes: questoes,
                dataEnvio: serverTimestamp(),
                professorResponsavelId: currentUser.uid
            };

            if(idEditandoAud) {
                await updateDoc(doc(db, "atividades_enviadas", idEditandoAud), dados);
                if(!isAutoSave) { 
                    window.showAlertAud("Sucesso", "Atividade atualizada!"); 
                    window.switchMainTabAud('enviadas'); 
                }
            } else if(!isAutoSave) {
                const ref = await addDoc(collection(db, "atividades_enviadas"), dados);
                idEditandoAud = ref.id;
                window.showAlertAud("Sucesso", "Publicado com sucesso!");
                window.switchMainTabAud('enviadas');
            }
        } catch (e) { 
            console.error("Erro ao salvar:", e); 
            if(!isAutoSave) window.showAlertAud("Erro", "Falha ao salvar a atividade no banco de dados.", "error"); 
        } finally {
            if(!isAutoSave && btnPub) {
                btnPub.disabled = false;
                btnPub.innerHTML = originalText;
            }
        }
    };

    window.carregarAtividadesEnviadasAud = async () => {
        const container = document.getElementById('lista-enviadas-aud');
        if(!container) return;
        container.innerHTML = '<p style="padding:15px; color:#64748b;">Buscando...</p>';
        try {
            const auth = window.auth || window.authMethods?.getAuth();
            const currentUser = auth?.currentUser;
            
            if (!currentUser) {
                // Se não houver usuário, aguarda um pouco e tenta novamente uma vez
                setTimeout(window.carregarAtividadesEnviadasAud, 1000);
                return;
            }

            const profId = currentUser.uid;
            const q = query(
                collection(db, "atividades_enviadas"), 
                where("tipo", "==", "auditiva"),
                where("professorResponsavelId", "==", profId)
            );
            
            const snap = await getDocs(q);
            enviadasCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            enviadasCache.sort((a,b) => (b.dataEnvio?.seconds || 0) - (a.dataEnvio?.seconds || 0));
            
            const renderizarEnviadas = () => {
                const inicio = (paginaAtualEnviadas - 1) * itensPorPagina;
                const fim = inicio + itensPorPagina;
                const itensExibidos = enviadasCache.slice(inicio, fim);
                const totalPaginas = Math.ceil(enviadasCache.length / itensPorPagina);

                let html = itensExibidos.map(data => `
                    <div class="card-premium-list" style="margin-bottom:7px; padding:6px 12px; border-left:4px solid #003058; background:#fff; border-radius:8px; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div style="flex:1">
                            <span style="font-size:9px; padding:2px 6px; background:#003058; color:white; border-radius:4px; font-weight:700;">${data.semestre}</span>
                            <h3 style="margin:0 0 0 6px; color:#003058; font-size:13px; display:inline-block;">${data.titulo}</h3>
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button onclick="window.prepararEdicaoAuditiva('${data.id}')" style="background:#f1f5f9; color:#003058; border:none; border-radius:6px; padding:6px 10px; cursor:pointer;"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="window.excluirAtividadeAud('${data.id}')" style="background:#fee2e2; color:#ef4444; border:none; border-radius:6px; padding:6px 10px; cursor:pointer;"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </div>
                `).join('');

                if (totalPaginas > 1) {
                    html += `<div style="display:flex; justify-content:center; gap:10px; margin-top:15px;">`;
                    for (let i = 1; i <= totalPaginas; i++) {
                        html += `<button onclick="window.mudarPaginaEnviadas(${i})" style="padding:5px 10px; border-radius:5px; border:1px solid #003058; background:${i === paginaAtualEnviadas ? '#003058' : '#fff'}; color:${i === paginaAtualEnviadas ? '#fff' : '#003058'}; cursor:pointer; font-weight:bold;">${i}</button>`;
                    }
                    html += `</div>`;
                }
                container.innerHTML = enviadasCache.length === 0 ? '<p style="padding:20px; text-align:center; color:#94a3b8;">Vazio.</p>' : html;
            };

            window.mudarPaginaEnviadas = (p) => { paginaAtualEnviadas = p; renderizarEnviadas(); };
            renderizarEnviadas();
        } catch (e) { 
            console.error("Erro no Firestore:", e);
            container.innerHTML = '<p style="padding:15px; color:#ef4444;">Erro ao carregar do banco de dados.</p>'; 
        }
    };

    window.prepararEdicaoAuditiva = (id) => {
        const item = enviadasCache.find(atv => atv.id === id);
        if(!item) return;
        idEditandoAud = id;
        window.switchMainTabAud('criar');
        document.getElementById('titulo-aud').value = item.titulo || "";
        document.getElementById('prazo-aud').value = item.prazo || "";
        
        document.querySelectorAll('#turma-pills-aud .btn-turma-pill').forEach(btn => {
            btn.classList.remove('active');
            if(btn.dataset.nome === item.semestre) btn.classList.add('active');
        });

        for(let n=1; n<=10; n++) {
            const q = item.questoes && item.questoes[n-1] ? item.questoes[n-1] : null;
            const enunc = document.getElementById(`enunc-aud-${n}`);
            const wrapper = document.getElementById(`audio-wrapper-aud-${n}`);
            const source = document.getElementById(`audio-src-aud-${n}`);
            const player = document.getElementById(`audio-player-aud-${n}`);

            if(q) {
                enunc.value = q.enunciado || "";
                document.getElementById(`opt-a-aud-${n}`).value = q.opcoes.A || "";
                document.getElementById(`opt-b-aud-${n}`).value = q.opcoes.B || "";
                document.getElementById(`opt-c-aud-${n}`).value = q.opcoes.C || "";
                document.getElementById(`correct-aud-${n}`).value = q.correta || "A";
                
                if(q.audioQuestao) {
                    source.src = q.audioQuestao;
                    player.load();
                    wrapper.style.display = 'block';
                } else {
                    wrapper.style.display = 'none';
                    source.src = "";
                }
            } else {
                enunc.value = "";
                document.getElementById(`opt-a-aud-${n}`).value = "";
                document.getElementById(`opt-b-aud-${n}`).value = "";
                document.getElementById(`opt-c-aud-${n}`).value = "";
                wrapper.style.display = 'none';
                source.src = "";
            }
        }
        document.querySelector('.btn-publish-aud').innerText = "ATUALIZAR ATIVIDADE AUDITIVA";
    };

    window.excluirAtividadeAud = (id) => {
        window.showConfirmAud("Excluir?", "Apagar permanentemente?", async () => {
            try {
                await deleteDoc(doc(db, "atividades_enviadas", id));
                await window.carregarAtividadesEnviadasAud();
            } catch(e) { console.error(e); }
        });
    };

   window.carregarRecebidasAud = async () => {
        const containerBase = document.getElementById('lista-recebidas-aud');
        if (!containerBase) return;

        if (!document.getElementById('filtro-recebidas-aud-turma')) {
            containerBase.innerHTML = `
                <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-bottom: 15px; padding: 0 5px;">
                    <label style="font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Filtrar Turma:</label>
                    <select id="filtro-recebidas-aud-turma" class="input-premium" style="width: 160px; margin:0; height: 32px; font-size: 11px;" onchange="window.carregarRecebidasAud()">
                        <option value="todos">TODAS AS TURMAS</option>
                    </select>
                </div>
                <div id="lista-recebidas-aud-dados"></div>`;
        }

        const containerDados = document.getElementById('lista-recebidas-aud-dados');
        const filtroElement = document.getElementById('filtro-recebidas-aud-turma');
        const valorFiltro = filtroElement.value;
        containerDados.innerHTML = '<p style="padding:15px; color:#64748b;">Buscando entregas...</p>';

        try {
            const authInstancia = window.auth || (window.authMethods && window.authMethods.getAuth ? window.authMethods.getAuth() : null);
            const userAtu = authInstancia ? authInstancia.currentUser : null;
            if(!userAtu) return;

            const qTurmasProf = query(collection(db, "turmas"), where("professorResponsavelId", "==", userAtu.uid));
            const snapTurmas = await getDocs(qTurmasProf);
            const senhasAutorizadas = snapTurmas.docs.map(d => d.data().senha);

            if (senhasAutorizadas.length === 0) {
                containerDados.innerHTML = '<p style="padding:20px; text-align:center; color:#94a3b8;">Nenhuma turma encontrada.</p>';
                return;
            }

            const qRespostas = query(
                collection(db, "respostas_alunos"), 
                where("tipo", "==", "auditiva"),
                where("turma", "in", senhasAutorizadas)
            );
            const snapRes = await getDocs(qRespostas);
            
            const promessas = snapRes.docs.map(async (d) => {
                const res = d.data();
                const alunoDoc = await getDoc(doc(db, "usuarios", res.alunoId));
                const dadosAluno = alunoDoc.exists() ? alunoDoc.data() : {};
                const codigoTurma = res.turma || "";
                
                let nomeExibicaoTurma = codigoTurma;
                const qT = query(collection(db, "turmas"), where("senha", "==", codigoTurma));
                const snapT = await getDocs(qT);
                if(!snapT.empty) nomeExibicaoTurma = snapT.docs[0].data().nomeCustomizado || codigoTurma;

                return {
                    id: d.id,
                    nomeAluno: dadosAluno.nome || "Aluno Excluído",
                    nomeTurma: nomeExibicaoTurma,
                    ...res
                };
            });

            const todasRecebidas = await Promise.all(promessas);

            if (filtroElement.options.length <= 1) {
                const turmasUnicas = [...new Set(todasRecebidas.map(r => r.nomeTurma))].filter(t => t);
                turmasUnicas.sort().forEach(turma => {
                    const opt = document.createElement('option');
                    opt.value = turma; opt.innerText = turma;
                    filtroElement.appendChild(opt);
                });
            }

            let filtrados = valorFiltro === "todos" ? todasRecebidas : todasRecebidas.filter(r => r.nomeTurma === valorFiltro);
            filtrados.sort((a, b) => (b.dataEntrega?.seconds || 0) - (a.dataEntrega?.seconds || 0));

            containerDados.innerHTML = filtrados.length === 0 ? '<p style="padding:20px; text-align:center; color:#94a3b8;">Nenhuma entrega encontrada.</p>' : 
                filtrados.map(data => `
                    <div class="card-premium-list" style="margin-bottom:7px; padding:8px 12px; border-left:4px solid #003058; background:#fff; border-radius:8px; display:flex; align-items:center; gap:12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); font-size:12px;">
                        <div style="width:100px; font-weight:800; color:#003058; text-transform:uppercase;">${data.nomeTurma}</div>
                        <div style="width:160px; font-weight:700; color:#003058;">${data.nomeAluno}</div>
                        <div style="flex:1; color:#64748b;">${data.titulo}</div>
                        <div style="width:100px; padding:5px; background:#003058; color:white; border-radius:4px; font-weight:800; text-align:center;">NOTA: ${data.nota}</div>
                    </div>
                `).join('');
        } catch (e) { 
            console.error(e); 
            containerDados.innerHTML = '<p style="padding:15px; color:red;">Erro ao carregar entregas.</p>';
        }
    };

    // --- CARREGAR SEMESTRES ---
    setTimeout(async () => {
        const div = document.getElementById('turma-pills-aud');
        if(!div) return;

        try {
            const authInstancia = window.auth || (window.authMethods && window.authMethods.getAuth ? window.authMethods.getAuth() : null);
            const userAtual = authInstancia ? authInstancia.currentUser : null;

            if (!userAtual) {
                div.innerHTML = "<p style='font-size:11px; color:#94a3b8;'>Aguardando login...</p>";
                return;
            }

            const q = query(collection(db, "turmas"), where("professorResponsavelId", "==", userAtual.uid));
            const snap = await getDocs(q);
            
            const semestresUnicos = new Set();
            const mapaSenhas = {};

            snap.forEach(docSnap => {
                const dados = docSnap.data();
                if(dados.semestre) {
                    const nome = dados.semestre.trim();
                    semestresUnicos.add(nome);
                    mapaSenhas[nome] = dados.senha;
                }
            });

            const lista = Array.from(semestresUnicos).sort();

            if (lista.length === 0) {
                div.innerHTML = '<p style="font-size:11px; color:#94a3b8; padding:10px;">Crie uma turma primeiro.</p>';
            } else {
                div.innerHTML = lista.map(nome => `
                    <button class="btn-turma-pill" data-nome="${nome}" data-senha="${mapaSenhas[nome]}" onclick="this.parentNode.querySelectorAll('button').forEach(b=>b.classList.remove('active')); this.classList.add('active'); window.triggerAutoSaveAud();">
                        ${nome.toUpperCase()}
                    </button>
                `).join('');
                if(div.firstChild) div.firstChild.classList.add('active');
            }
            
            window.carregarAtividadesEnviadasAud();
            window.carregarRecebidasAud();
            
        } catch (e) {
            console.error("Erro ao carregar:", e);
        }
    }, 1500);

    return `
    <style>
        .auditiva-container { width:100%; font-family:'Inter',sans-serif; padding:10px 15px; box-sizing:border-box; min-height: 100vh; }
        .card-aud { background:#fff; border-radius:12px; padding:18px; box-shadow:0 4px 12px rgba(0,0,0,0.05); border:1px solid #eef2f6; }
        .input-premium { width:100%; padding:9px; border:1px solid #e2e8f0; border-radius:8px; font-size:13px; background:#f8fafc; margin-bottom:10px; font-family:inherit; box-sizing:border-box; }
        .aud-btn-pill { min-width:32px; height:32px; border-radius:8px; border:1px solid #e2e8f0; background:#fff; cursor:pointer; font-weight:700; font-size:11px; color:#64748b; }
        .aud-btn-pill.active { background:#003058; color:#fff; border-color:#003058; }
        .btn-turma-pill { padding:6px 12px; border:1px solid #e2e8f0; background:#fff; border-radius:20px; cursor:pointer; font-size:11px; font-weight:700; margin-right:5px; white-space:nowrap; }
        .btn-turma-pill.active { background:#003058; color:#fff; }
        .main-tab-btn-aud { padding:7px 15px; border:none; background:none; cursor:pointer; font-weight:700; color:#64748b; }
        .main-tab-btn-aud.active { color:#003058; border-bottom:3px solid #003058; }
        .btn-publish-aud { background:#003058; color:#fff; border:none; padding:12px; width:100%; border-radius:10px; font-weight:700; cursor:pointer; margin-top:10px; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .modal-aud { position:fixed; inset:0; background:rgba(0,48,88,0.4); backdrop-filter:blur(4px); display:none; justify-content:center; align-items:center; z-index:9999; padding:20px; }
        .modal-aud-content { background:#fff; width:100%; max-width:400px; border-radius:20px; padding:25px; text-align:center; }
        .btn-icon-upload { background:#f1f5f9; color:#003058; border:1px solid #e2e8f0; width:42px; height:42px; border-radius:10px; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center; }
    </style>

    <div class="auditiva-container">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h1 style="color:#003058; font-weight:800; margin:0; font-size:24px;">AUDITIVA</h1>
            <div id="save-status-aud" style="font-size:10px; color:#003058; font-weight:700;"></div>
        </div>

        <div class="main-tabs" style="display:flex; gap:10px; border-bottom:2px solid #e2e8f0; margin-bottom:15px;">
            <button id="tab-btn-aud-criar" class="main-tab-btn-aud active" onclick="window.switchMainTabAud('criar')">CRIAR</button>
            <button id="tab-btn-aud-enviadas" class="main-tab-btn-aud" onclick="window.switchMainTabAud('enviadas')">ENVIADAS</button>
            <button id="tab-btn-aud-recebidas" class="main-tab-btn-aud" onclick="window.switchMainTabAud('recebidas')">RECEBIDAS</button>
        </div>

        <div id="pane-aud-criar" class="tab-pane-aud">
            <div class="card-aud">
                <label style="font-size:10px; font-weight:700; color:#94a3b8;">SEMESTRE:</label>
                <div id="turma-pills-aud" style="display:flex; overflow-x:auto; margin-bottom:10px; padding-bottom:5px;"></div>
                
                <div style="display:flex; gap:10px;">
                    <input type="text" id="titulo-aud" class="input-premium" placeholder="Título da Atividade" style="flex:1" oninput="window.triggerAutoSaveAud()" autocomplete="off">
                    <input type="date" id="prazo-aud" class="input-premium" style="width:140px" onchange="window.triggerAutoSaveAud()" onclick="this.min = new Date().toISOString().split('T')[0]">
                </div>
                <div style="display:flex; gap:5px; overflow-x:auto; padding-bottom:5px; margin-bottom:10px;">
                    ${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button id="btn-aud-${n}" class="aud-btn-pill ${n===1?'active':''}" onclick="window.switchQuestaoAud(${n})">${n}</button>`).join('')}
                </div>

                <div id="questoes-aud-container" style="background:#fbfcfd; padding:15px; border-radius:12px; border:1px solid #f1f5f9; min-height:180px;">
                    ${[1,2,3,4,5,6,7,8,9,10].map(n=>`
                        <div id="content-aud-${n}" class="aud-content-box" style="display:${n===1?'block':'none'};">
                            <textarea id="enunc-aud-${n}" class="input-premium" placeholder="Pergunta ${n} sobre o áudio..." oninput="window.triggerAutoSaveAud()" autocomplete="off"></textarea>
                            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px;">
                                <input type="text" id="opt-a-aud-${n}" class="input-premium" placeholder="A" oninput="window.triggerAutoSaveAud()" autocomplete="off">
<input type="text" id="opt-b-aud-${n}" class="input-premium" placeholder="B" oninput="window.triggerAutoSaveAud()" autocomplete="off">
<input type="text" id="opt-c-aud-${n}" class="input-premium" placeholder="C" oninput="window.triggerAutoSaveAud()" autocomplete="off">
                            </div>
                            <div style="display:flex; flex-direction:column; gap:15px; margin-top:15px;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <label style="font-size:10px; font-weight:700; color:#94a3b8;">CORRETA:</label>
                                    <select id="correct-aud-${n}" class="input-premium" style="width:60px; margin:0;" onchange="window.triggerAutoSaveAud()">
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="C">C</option>
                                    </select>
                                </div>
                                
                                <div style="display:flex; flex-direction:column; gap:5px; width:100%; padding-top:10px; border-top: 1px dashed #e2e8f0;">
                                    <div id="audio-wrapper-aud-${n}" style="display:none; background:#f8fafc; padding:8px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:5px;">
                                        <audio id="audio-player-aud-${n}" controls style="width:100%; height:30px;"><source id="audio-src-aud-${n}" src=""></audio>
                                        <button onclick="window.removerAudioQuestao(${n})" style="border:none; background:none; color:#ef4444; font-size:10px; cursor:pointer; font-weight:700;">REMOVER ÁUDIO DA QUESTÃO</button>
                                    </div>
                                    <button class="btn-icon-upload" onclick="document.getElementById('file-aud-q-${n}').click()" title="Anexar Áudio nesta Questão" style="width:100%; height:36px; font-size:13px;">
                                        <i class="fa-solid fa-microphone-lines" style="margin-right:8px;"></i> ADICIONAR ÁUDIO À QUESTÃO ${n}
                                    </button>
                                    <input type="file" id="file-aud-q-${n}" accept="audio/*" style="display:none" onchange="window.handleAudioQuestao(this, ${n})" autocomplete="off">
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-publish-aud" onclick="window.enviarAtividadeAuditiva(false)">PUBLICAR ATIVIDADE AUDITIVA</button>
            </div>
        </div>

        <div id="pane-aud-enviadas" class="tab-pane-aud" style="display:none;"><div id="lista-enviadas-aud"></div></div>
        <div id="pane-aud-recebidas" class="tab-pane-aud" style="display:none;"><div id="lista-recebidas-aud"></div></div>

        <div id="modal-upload-loading-aud" class="modal-aud">
            <div class="modal-aud-content" style="width: auto; padding: 40px;">
                <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 40px; color: #003058; margin-bottom: 20px;"></i>
                <h3 style="margin: 0; color: #003058;">Fazendo upload...</h3>
                <p style="color: #64748b; font-size: 14px; margin-top: 10px;">Aguarde a conclusão do processamento.</p>
            </div>
        </div>
        <div id="modal-alert-aud" class="modal-aud"><div class="modal-aud-content"><div id="alert-icon-aud" style="margin-bottom:10px;"></div><h3 id="alert-title-aud"></h3><p id="alert-msg-aud"></p><button class="btn-publish-aud" onclick="window.closeAlertAud()">OK</button></div></div><div id="modal-alert-aud" class="modal-aud"><div class="modal-aud-content"><div id="alert-icon-aud" style="margin-bottom:10px;"></div><h3 id="alert-title-aud"></h3><p id="alert-msg-aud"></p><button class="btn-publish-aud" onclick="window.closeAlertAud()">OK</button></div></div>
        <div id="modal-confirm-aud" class="modal-aud"><div class="modal-aud-content"><h3 id="confirm-title-aud">Confirmar?</h3><p id="confirm-msg-aud"></p><div style="display:flex; gap:10px;"><button class="btn-publish-aud" style="background:#ef4444" onclick="window.pendingConfirmActionAud()">SIM</button><button class="btn-publish-aud" style="background:#f1f5f9; color:#64748b" onclick="document.getElementById('modal-confirm-aud').style.display='none'">NÃO</button></div></div></div>
    </div>`;
});
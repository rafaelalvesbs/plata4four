window.Router.register('oralalunoclm', async () => {
    const db = window.db;
    const { collection, onSnapshot, query, where, getDoc, doc, addDoc, serverTimestamp } = window.fsMethods;
    const auth = window.authMethods.getAuth();
    const azulPadrao = "#003058"; 

    let atividadesRecebidas = [];
    let atividadesEnviadas = [];
    let dadosTurmaAluno = null;
    let atividadeSelecionada = null;
    let questaoAtualIdx = 0;
    let respostasGravadas = {};
    let mediaRecorder;
    let audioChunks = [];
    let intervaloTimerGravacao;
    let tempoGravacao = 0;
    let intervaloCronometroAtividade;
    let tempoTotalAtividade = 0;

    // Variáveis de Paginação
    let paginaAtualRecebidas = 1;
    let paginaAtualEnviadas = 1;
    const itensPorPagina = window.innerWidth <= 600 ? 5 : 7;

    let unsubRecebidas = null;
    let unsubEnviadas = null;

    const buscarDadosContexto = async () => {
        const userRef = auth.currentUser;
        if (!userRef) return;
        try {
            const alunoDoc = await getDoc(doc(db, "usuarios", userRef.uid));
            if (alunoDoc.exists()) {
                const dadosUser = alunoDoc.data();
                const qTurma = query(collection(db, "turmas"), where("senha", "==", dadosUser.turma));
                const { getDocs } = window.fsMethods;
                const snapTurma = await getDocs(qTurma);
                
                if (!snapTurma.empty) {
                    const dadosT = snapTurma.docs[0].data();
                    dadosTurmaAluno = { 
                        alunoId: userRef.uid, 
                        semestre: dadosT.semestre, 
                        turmaCodigo: dadosUser.turma,
                        nomeAluno: dadosUser.nome || 'Aluno'
                    };
                    window.switchTabOral('recebidas');
                }
            }
        } catch (e) { console.error("Erro no contexto:", e); }
    };

    window.formatarTempoOral = (segundos) => {
        const min = Math.floor(segundos / 60).toString().padStart(2, '0');
        const sec = (segundos % 60).toString().padStart(2, '0');
        return `${min}:${sec}`;
    };

    window.switchTabOral = async (tab) => {
        document.querySelectorAll('.tab-btn-aluno').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`btn-tab-oral-${tab}`);
        if(btn) btn.classList.add('active');
        
        document.getElementById('pane-oral-recebidas').style.display = tab === 'recebidas' ? 'block' : 'none';
        document.getElementById('pane-oral-enviadas').style.display = tab === 'enviadas' ? 'block' : 'none';
        
        if (tab === 'recebidas') carregarRecebidasRealtime();
        if (tab === 'enviadas') carregarEnviadasRealtime();
    };

    // Funções de Renderização com Paginação
    const renderizarListaPaginada = (tipo) => {
        const isRecebidas = tipo === 'recebidas';
        const listaCompleta = isRecebidas ? atividadesRecebidas : atividadesEnviadas;
        const paginaAtual = isRecebidas ? paginaAtualRecebidas : paginaAtualEnviadas;
        const container = document.getElementById(isRecebidas ? 'lista-oral-recebidas' : 'lista-oral-enviadas');
        const paginacaoContainer = document.getElementById(isRecebidas ? 'paginacao-recebidas' : 'paginacao-enviadas');

        if (listaCompleta.length === 0) {
            container.innerHTML = `<div class="empty-state">Nenhuma atividade ${isRecebidas ? 'pendente' : 'enviada'}.</div>`;
            paginacaoContainer.innerHTML = '';
            return;
        }

        const inicio = (paginaAtual - 1) * itensPorPagina;
        const fim = inicio + itensPorPagina;
        const itensPagina = listaCompleta.slice(inicio, fim);
        const totalPaginas = Math.ceil(listaCompleta.length / itensPorPagina);

        container.innerHTML = itensPagina.map(atv => {
            if (isRecebidas) {
                return `
                <div class="card-premium-list" onclick="window.prepararInicioOral('${atv.id}')">
                    <div style="flex:1">
                        <h3 class="atv-titulo-list">${atv.titulo || 'Atividade Oral'}</h3>
                        <div class="atv-sub-list">
                            <span><i class="fa-solid fa-calendar-day"></i> Semestre: ${atv.semestre || atv.turma}</span> | 
                            <span><i class="fa-solid fa-microphone"></i> ${atv.questoes?.length || 0} questões</span>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-right" style="color:${azulPadrao}"></i>
                </div>`;
            } else {
                return `
                <div class="card-premium-list enviada">
                    <div style="flex:1">
                        <h3 class="atv-titulo-list">${atv.atividadeTitulo || atv.titulo}</h3>
                        <div class="atv-sub-list">
                            <span><i class="fa-solid fa-clock"></i> ${atv.tempoTotalFormatado || '00:00'}</span> | 
                            <span><i class="fa-solid fa-check"></i> Enviado</span>
                        </div>
                    </div>
                    <i class="fa-solid fa-circle-check" style="color:${azulPadrao}"></i>
                </div>`;
            }
        }).join('');

        // Renderizar Controles de Página
        if (totalPaginas > 1) {
            let pagHTML = `<div class="pagination-controls">`;
            for (let i = 1; i <= totalPaginas; i++) {
                pagHTML += `<button class="page-num ${i === paginaAtual ? 'active' : ''}" onclick="window.mudarPaginaOral('${tipo}', ${i})">${i}</button>`;
            }
            pagHTML += `</div>`;
            paginacaoContainer.innerHTML = pagHTML;
        } else {
            paginacaoContainer.innerHTML = '';
        }
    };

    window.mudarPaginaOral = (tipo, novaPagina) => {
        if (tipo === 'recebidas') paginaAtualRecebidas = novaPagina;
        else paginaAtualEnviadas = novaPagina;
        renderizarListaPaginada(tipo);
    };

    const carregarRecebidasRealtime = () => {
        const container = document.getElementById('lista-oral-recebidas');
        if (!container || unsubRecebidas) return;

        const qResp = query(collection(db, "respostas_alunos"), where("alunoId", "==", dadosTurmaAluno.alunoId));
        
        unsubRecebidas = onSnapshot(qResp, (snapResp) => {
            const respondidasIds = snapResp.docs.map(d => d.data().atividadeId);
            const qAtv = query(collection(db, "atividades_enviadas"), where("tipo", "==", "oral"));
            
            onSnapshot(qAtv, (snapAtv) => {
                atividadesRecebidas = snapAtv.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(atv => {
                        const matchesSemestre = (atv.semestre === dadosTurmaAluno.semestre || atv.turma === dadosTurmaAluno.semestre || atv.turmasSelecionadas?.includes(dadosTurmaAluno.turmaCodigo));
                        return matchesSemestre && !respondidasIds.includes(atv.id);
                    });
                renderizarListaPaginada('recebidas');
            });
        });
    };

    const carregarEnviadasRealtime = () => {
        const container = document.getElementById('lista-oral-enviadas');
        if (!container || unsubEnviadas) return;

        const q = query(collection(db, "respostas_alunos"), 
            where("alunoId", "==", dadosTurmaAluno.alunoId),
            where("tipo", "==", "oral")
        );

        unsubEnviadas = onSnapshot(q, (snap) => {
            atividadesEnviadas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderizarListaPaginada('enviadas');
        });
    };

    window.prepararInicioOral = (id) => {
        atividadeSelecionada = atividadesRecebidas.find(a => a.id === id);
        document.getElementById('modal-aviso-oral').style.display = 'flex';
    };

    window.comecarOralDeVez = () => {
        document.getElementById('modal-aviso-oral').style.display = 'none';
        questaoAtualIdx = 0; respostasGravadas = {}; tempoTotalAtividade = 0;
        document.getElementById('main-view-oral').style.display = 'none';
        document.getElementById('view-resolver-oral').style.display = 'block';
        document.getElementById('header-oral-titulo').innerText = atividadeSelecionada.titulo;
        
       if (intervaloCronometroAtividade) {
            clearInterval(intervaloCronometroAtividade);
            intervaloCronometroAtividade = null;
        }
        tempoTotalAtividade = 0;
        document.getElementById('tempo-total-display').innerText = "00:00";
        intervaloCronometroAtividade = setInterval(() => {
            tempoTotalAtividade++;
            const display = document.getElementById('tempo-total-display');
            if (display) {
                display.innerText = window.formatarTempoOral(tempoTotalAtividade);
            }
        }, 1000);
        window.renderQuestaoOral();
    };

    window.voltarParaListaOral = () => {
        document.getElementById('modal-confirm-saida-oral').style.display = 'flex';
    };

    window.confirmarSaidaOral = () => {
        clearInterval(intervaloCronometroAtividade);
        window.pararGravacao();
        document.getElementById('modal-confirm-saida-oral').style.display = 'none';
        document.getElementById('view-resolver-oral').style.display = 'none';
        document.getElementById('main-view-oral').style.display = 'block';
    };

    window.renderQuestaoOral = () => {
        const q = atividadeSelecionada.questoes[questaoAtualIdx];
        let navHtml = atividadeSelecionada.questoes.map((_, i) => `
            <button class="g-btn-pill ${i === questaoAtualIdx ? 'active' : ''} ${respostasGravadas[i] ? 'respondida' : ''}" 
                    style="flex: 0 0 calc(20% - 8px); min-width: 40px;" 
                    onclick="window.mudarQuestaoOralPara(${i})">${i + 1}</button>
        `).join('');
        document.getElementById('nav-questoes-oral').innerHTML = navHtml;
        
        document.getElementById('render-pergunta-oral').innerHTML = `
            <div class="box-enunciado-render"><div class="texto-enunciado-render">${q.enunciado}</div></div>
            <div class="oral-recording-area">
                <div id="rec-circle" class="rec-circle-modern ${respostasGravadas[questaoAtualIdx] ? 'gravado' : ''}">
                    <i class="fa-solid ${respostasGravadas[questaoAtualIdx] ? 'fa-check' : 'fa-microphone'}"></i>
                </div>
                <h2 id="timer-oral" class="timer-text">00:00</h2>
                <div class="rec-controls">
                    <button id="btn-start-rec" class="btn-acao-enviar" onclick="window.iniciarGravacao()">GRAVAR RESPOSTA</button>
                    <button id="btn-stop-rec" class="btn-acao-enviar" style="background:#ef4444; display:none;" onclick="window.pararGravacao()">PARAR</button>
                </div>
                <audio id="audio-preview" controls style="${respostasGravadas[questaoAtualIdx] ? 'display:block' : 'display:none'}; margin-top:20px; width:100%; max-width:300px;"></audio>
            </div>
            <div class="container-navegacao-setas">
                <button class="btn-seta-nav" onclick="window.mudarQuestaoOral(-1)" ${questaoAtualIdx === 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>
                <button class="btn-seta-nav" onclick="window.mudarQuestaoOral(1)" ${questaoAtualIdx === atividadeSelecionada.questoes.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>
            </div>
            <div class="container-acoes-rodape">
                ${questaoAtualIdx === atividadeSelecionada.questoes.length - 1 ? `<button class="btn-acao-enviar" onclick="window.prepararFinalizarOral()">FINALIZAR E ENVIAR</button>` : ''}
            </div>`;

        if (respostasGravadas[questaoAtualIdx]) {
            document.getElementById('audio-preview').src = URL.createObjectURL(respostasGravadas[questaoAtualIdx]);
        }
    };

    window.mudarQuestaoOralPara = (idx) => { 
        window.pararGravacao();
        questaoAtualIdx = idx; 
        window.renderQuestaoOral(); 
    };
    
    window.mudarQuestaoOral = (dir) => { 
        window.pararGravacao();
        questaoAtualIdx += dir; 
        window.renderQuestaoOral(); 
    };

    window.iniciarGravacao = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                respostasGravadas[questaoAtualIdx] = new Blob(audioChunks, { type: 'audio/webm' });
                window.renderQuestaoOral();
            };
            mediaRecorder.start();
            tempoGravacao = 0;
            document.getElementById('rec-circle').classList.add('recording-pulse');
            document.getElementById('btn-start-rec').style.display = 'none';
            document.getElementById('btn-stop-rec').style.display = 'block';
            intervaloTimerGravacao = setInterval(() => {
                tempoGravacao++;
                document.getElementById('timer-oral').innerText = `00:${tempoGravacao.toString().padStart(2, '0')}`;
                if(tempoGravacao >= 60) window.pararGravacao();
            }, 1000);
        } catch (e) { alert('Microfone não encontrado.'); }
    };

    window.pararGravacao = () => {
        if(mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(t => t.stop());
            clearInterval(intervaloTimerGravacao);
        }
    };

    window.prepararFinalizarOral = () => {
        if(Object.keys(respostasGravadas).length < atividadeSelecionada.questoes.length) {
            document.getElementById('alerta-oral-msg').innerText = "Grave todas as respostas antes de enviar.";
            document.getElementById('modal-alerta-oral').style.display = 'flex';
            return;
        }
        document.getElementById('modal-confirm-envio-oral').style.display = 'flex';
    };

    window.enviarDadosFinaisOral = async () => {
        const btnEnvio = document.getElementById('btn-final-enviar-oral');
        const spinner = document.getElementById('spinner-envio-oral');
        const textoBtn = document.getElementById('txt-enviar-oral');
        const btnRevisar = document.getElementById('btn-revisar-oral');

        if (btnEnvio) {
            btnEnvio.disabled = true;
            if (btnRevisar) btnRevisar.style.display = 'none'; // Esconde o botão revisar para não clicar
            if (spinner) spinner.style.display = 'block';
            if (textoBtn) textoBtn.innerText = 'ENVIANDO...';
            btnEnvio.style.opacity = "0.8";
        }
        
        try {
            const { ref, uploadBytes, getDownloadURL } = window.storageMethods;
            const storage = window.storage;
            const questoesComAudio = [];
            
            for (let i = 0; i < atividadeSelecionada.questoes.length; i++) {
                const blobAudio = respostasGravadas[i];
                if (!blobAudio) continue;

                const caminho = `oral/${dadosTurmaAluno.alunoId}/${atividadeSelecionada.id}_q${i}_${Date.now()}.webm`;
                const storageRef = ref(storage, caminho);
                const snapshot = await uploadBytes(storageRef, blobAudio);
                const downloadUrl = await getDownloadURL(snapshot.ref);

                questoesComAudio.push({
                    enunciado: atividadeSelecionada.questoes[i].enunciado,
                    audioUrl: downloadUrl,
                    feedbackProf: "",
                    avaliado: false
                });
            }

            if (intervaloCronometroAtividade) {
                clearInterval(intervaloCronometroAtividade);
                intervaloCronometroAtividade = null;
            }

            const tempoFinal = document.getElementById('tempo-total-display').innerText;

            await addDoc(collection(db, "respostas_alunos"), {
                alunoId: dadosTurmaAluno.alunoId,
                nomeAluno: dadosTurmaAluno.nomeAluno,
                turma: dadosTurmaAluno.semestre,
                turmaCodigo: dadosTurmaAluno.turmaCodigo || "",
                atividadeId: atividadeSelecionada.id,
                atividadeTitulo: atividadeSelecionada.titulo,
                professorId: atividadeSelecionada.professorId || atividadeSelecionada.uidProfessor || "",
                tipo: "oral",
                questoes: questoesComAudio,
                tempoTotalFormatado: tempoFinal,
                dataEnvio: serverTimestamp(),
                avaliado: false,
                status: "pendente"
            });

            respostasGravadas = {};
            document.getElementById('modal-confirm-envio-oral').style.display = 'none';
            document.getElementById('res-tempo-oral').innerText = tempoFinal;
            document.getElementById('modal-resultado-oral').style.display = 'flex';

        } catch (error) {
            console.error("Erro no envio:", error);
            if (document.getElementById('modal-resultado-oral').style.display !== 'flex') {
                alert("Erro ao enviar áudios. Verifique sua conexão.");
                if (btnEnvio) {
                    btnEnvio.disabled = false;
                    if (btnRevisar) btnRevisar.style.display = 'block';
                    if (spinner) spinner.style.display = 'none';
                    if (textoBtn) textoBtn.innerText = 'ENVIAR';
                    btnEnvio.style.opacity = "1";
                }
            }
        }
    };

   window.fecharTudoOral = () => {
        if (intervaloCronometroAtividade) { 
            clearInterval(intervaloCronometroAtividade); 
            intervaloCronometroAtividade = null; 
        }
        respostasGravadas = {};
        atividadeSelecionada = null;
        document.getElementById('modal-resultado-oral').style.display = 'none';
        document.getElementById('view-resolver-oral').style.display = 'none';
        document.getElementById('main-view-oral').style.display = 'block';
        window.switchTabOral('enviadas');
    };

    setTimeout(buscarDadosContexto, 300);

    return `
    <style>
        .gram-aluno-wrapper { padding: 12px; font-family: 'Inter', sans-serif; }
        .card-premium-list { background:#fff; padding:15px; border-radius:12px; margin-bottom:10px; display:flex; align-items:center; border-left:5px solid ${azulPadrao}; box-shadow:0 2px 5px rgba(0,0,0,0.05); cursor:pointer; }
        .atv-titulo-list { margin:0; font-size:14px; color:${azulPadrao}; font-weight:700; }
        .atv-sub-list { font-size:11px; color:#64748b; margin-top:5px; }
        .tab-btn-aluno { padding:10px 15px; border:none; background:none; font-weight:700; color:#94a3b8; cursor:pointer; border-bottom:3px solid transparent; transition: 0.3s; }
        .tab-btn-aluno.active { color:${azulPadrao}; border-bottom:3px solid ${azulPadrao}; }
        .header-resolver-top { display:flex; align-items:center; background:${azulPadrao}; padding:10px 15px; border-radius:12px; margin-bottom:12px; color:#fff; gap:15px; }
        .btn-voltar-topo { background: rgba(255,255,255,0.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .cronometro-box { font-size:12px; background:rgba(255,255,255,0.2); padding:5px 10px; border-radius:8px; font-weight: 700; }
        .box-enunciado-render { background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:15px; margin-bottom:12px; }
        .texto-enunciado-render { color:#1e293b; font-weight:600; font-size:14px; line-height:1.5; }
        .oral-recording-area { background:#fff; border-radius:12px; padding:30px; display:flex; flex-direction:column; align-items:center; border:1px solid #f1f5f9; }
        .rec-circle-modern { width:80px; height:80px; border-radius:50%; background:#f8fafc; border:2px solid #e2e8f0; display:flex; align-items:center; justify-content:center; font-size:30px; color:${azulPadrao}; transition: 0.3s; }
        .rec-circle-modern.gravado { background: #f0fdf4; border-color: #bbf7d0; color: #16a34a; }
        .recording-pulse { background:#fee2e2; color:#ef4444; border-color:#fca5a5; animation: pulse-red 1.5s infinite; }
        @keyframes pulse-red { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        .timer-text { font-size:32px; font-weight:900; color:${azulPadrao}; margin:15px 0; }
        .btn-acao-enviar { background:${azulPadrao}; color:#fff; border:none; height:46px; border-radius:12px; font-weight:700; cursor:pointer; padding: 0 25px; box-shadow: 0 4px 6px rgba(0,48,88,0.2); }
        .nav-questoes-container { 
            display: flex; 
            flex-wrap: wrap; 
            gap: 8px; 
            padding: 5px 2px 15px 2px; 
            justify-content: flex-start;
        }
        .nav-questoes-container::-webkit-scrollbar { display: none; }
        .g-btn-pill { min-width:34px; height:34px; border-radius:8px; border:1px solid #e2e8f0; background:#fff; font-weight:700; cursor:pointer; }
        .g-btn-pill.active { background:${azulPadrao}; color:#fff; border-color: ${azulPadrao}; }
        .g-btn-pill.respondida:not(.active) { background:#e2e8f0; color: #64748b; }
        .container-navegacao-setas { display: flex; justify-content: center; gap: 40px; margin-top: 15px; }
        .btn-seta-nav { background: #fff; border: 1px solid #e2e8f0; width: 45px; height: 45px; border-radius: 50%; color: ${azulPadrao}; cursor: pointer; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .modal-aluno { position:fixed; inset:0; background:rgba(0,48,88,0.4); backdrop-filter: blur(6px); display:none; align-items:center; justify-content:center; padding:20px; z-index:9999; }
        .modal-content-aluno { background:#fff; width:100%; max-width:380px; border-radius:24px; padding:30px; text-align:center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
        .container-acoes-rodape { display: flex; justify-content: flex-end; margin-top: 20px; width: 100%; }
        
        /* Estilos Paginação */
        .pagination-controls { display: flex; justify-content: center; gap: 8px; margin-top: 15px; padding-bottom: 20px; }
        .page-num { width: 30px; height: 30px; border-radius: 6px; border: 1px solid #e2e8f0; background: #fff; color: ${azulPadrao}; font-weight: bold; cursor: pointer; }
        .page-num.active { background: ${azulPadrao}; color: #fff; border-color: ${azulPadrao}; }

        @media (max-width: 600px) {
            .header-resolver-top { justify-content: space-between; gap: 10px; padding: 10px; }
            #header-oral-titulo { font-size: 12px; flex: 1; }
            .nav-questoes-container { justify-content: center; }
            .g-btn-pill { min-width: 38px; height: 38px; font-size: 14px; }
            .oral-recording-area { padding: 15px; width: 100%; box-sizing: border-box; }
            .container-acoes-rodape { justify-content: center; }
            .rec-circle-modern { width: 60px; height: 60px; font-size: 24px; }
        }
        
        .pagination-controls { 
        display: flex !important; 
        flex-wrap: wrap; 
        justify-content: center; 
        gap: 5px; 
        margin-top: 15px; 
        padding-bottom: 20px; 
        }
        .page-num {
        min-width: 30px;
        height: 30px;
        padding: 0 5px;
        }

    </style>

    <div class="gram-aluno-wrapper">
        <div id="modal-aviso-oral" class="modal-aluno">
            <div class="modal-content-aluno">
                <div style="font-size:35px; color:${azulPadrao}; margin-bottom:15px;"><i class="fa-solid fa-stopwatch"></i></div>
                <h2 style="color:${azulPadrao}; font-size:20px; margin-bottom:10px; font-weight:800;">Tudo pronto?</h2>
                <p style="color:#64748b; font-size:14px; margin-bottom:25px; line-height:1.5;">Ao iniciar, seu tempo de resolução será contabilizado.</p>
                <button class="btn-acao-enviar" style="width:100%;" onclick="window.comecarOralDeVez()">INICIAR ATIVIDADE</button>
                <button onclick="document.getElementById('modal-aviso-oral').style.display='none'" style="background:none; border:none; color:#94a3b8; margin-top:15px; font-weight:600; cursor:pointer;">Agora não</button>
            </div>
        </div>

        <div id="modal-confirm-saida-oral" class="modal-aluno">
            <div class="modal-content-aluno">
                <div style="font-size:35px; color:${azulPadrao}; margin-bottom:15px;"><i class="fa-solid fa-circle-question"></i></div>
                <h2 style="color:${azulPadrao}; font-size:18px; margin-bottom:10px; font-weight:800;">Deseja sair?</h2>
                <p style="color:#64748b; font-size:14px; margin-bottom:25px; line-height:1.5;">Seu progresso nesta tentativa será perdido.</p>
                <div style="display:flex; gap:10px;">
                    <button onclick="document.getElementById('modal-confirm-saida-oral').style.display='none'" style="flex:1; background:#f1f5f9; color:#64748b; border:none; height:46px; border-radius:12px; font-weight:700; cursor:pointer;">VOLTAR</button>
                    <button onclick="window.confirmarSaidaOral()" style="flex:1; background:#ef4444; color:#fff; border:none; height:46px; border-radius:12px; font-weight:700; cursor:pointer;">SAIR</button>
                </div>
            </div>
        </div>

        <div id="modal-alerta-oral" class="modal-aluno">
            <div class="modal-content-aluno">
                <div style="font-size:35px; color:${azulPadrao}; margin-bottom:15px;"><i class="fa-solid fa-circle-exclamation"></i></div>
                <h2 style="color:${azulPadrao}; font-size:18px; margin-bottom:10px; font-weight:800;">Atenção</h2>
                <p id="alerta-oral-msg" style="color:#64748b; font-size:14px; margin-bottom:25px; line-height:1.5;"></p>
                <button onclick="document.getElementById('modal-alerta-oral').style.display='none'" style="width:100%; background:${azulPadrao}; color:#fff; border:none; height:46px; border-radius:12px; font-weight:700; cursor:pointer;">ENTENDI</button>
            </div>
        </div>

        <div id="modal-confirm-envio-oral" class="modal-aluno">
            <div class="modal-content-aluno">
                <style>
                    @keyframes spinOral { to { transform: rotate(360deg); } }
                    .spinner-oral { width: 18px; height: 18px; border: 3px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: spinOral 0.8s linear infinite; display: none; }
                </style>
                <div style="font-size:35px; color:${azulPadrao}; margin-bottom:15px;"><i class="fa-solid fa-paper-plane"></i></div>
                <h2 style="color:${azulPadrao}; font-size:18px; margin-bottom:10px; font-weight:800;">Enviar agora?</h2>
                <p style="color:#64748b; font-size:14px; margin-bottom:25px; line-height:1.5;">Deseja finalizar e enviar suas gravações?</p>
                <div style="display:flex; gap:10px;">
                    <button id="btn-revisar-oral" onclick="document.getElementById('modal-confirm-envio-oral').style.display='none'" style="flex:1; background:#f1f5f9; color:#64748b; border:none; height:46px; border-radius:12px; font-weight:700; cursor:pointer;">REVISAR</button>
                    <button id="btn-final-enviar-oral" onclick="window.enviarDadosFinaisOral()" style="flex:1; background:${azulPadrao}; color:#fff; border:none; height:46px; border-radius:12px; font-weight:700; cursor:pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <div id="spinner-envio-oral" class="spinner-oral"></div>
                        <span id="txt-enviar-oral">ENVIAR</span>
                    </button>
                </div>
            </div>
        </div>

        <div id="modal-resultado-oral" class="modal-aluno">
            <div class="modal-content-aluno">
                <div style="font-size:40px; color:${azulPadrao}; margin-bottom:10px;"><i class="fa-solid fa-circle-check"></i></div>
                <h2 style="color:${azulPadrao}; font-size:22px; margin-bottom:5px; font-weight:800;">Enviado!</h2>
                <p style="color:#64748b; font-size:13px; margin-bottom:20px;">Sua atividade oral foi entregue com sucesso.</p>
                <div style="width:100px; height:100px; border-radius:50%; background:#f0f7ff; border:5px solid ${azulPadrao}; display:flex; flex-direction:column; align-items:center; justify-content:center; margin:0 auto 20px auto;">
                    <span style="font-size: 24px; font-weight: 900; color: ${azulPadrao};" id="res-tempo-oral">00:00</span>
                    <span style="font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700;">Tempo</span>
                </div>
                <button onclick="window.fecharTudoOral()" style="width:100%; background:${azulPadrao}; color:#fff; border:none; height:50px; border-radius:15px; font-weight:700; cursor:pointer; font-size:15px;">OK</button>
            </div>
        </div>

        <div id="main-view-oral">
            <h1 style="color:${azulPadrao}; font-size:24px; font-weight:900;">Oral</h1>
            <p style="color:#94a3b8; font-size:14px; margin-bottom: 20px;">Pratique sua pronúncia e conversação</p>
            <div style="display:flex; border-bottom:1px solid #e2e8f0; margin-bottom:15px;">
                <button id="btn-tab-oral-recebidas" class="tab-btn-aluno" onclick="window.switchTabOral('recebidas')">Recebidas</button>
                <button id="btn-tab-oral-enviadas" class="tab-btn-aluno" onclick="window.switchTabOral('enviadas')">Enviadas</button>
            </div>
            <div id="pane-oral-recebidas">
                <div id="lista-oral-recebidas"></div>
                <div id="paginacao-recebidas"></div>
            </div>
            <div id="pane-oral-enviadas" style="display:none;">
                <div id="lista-oral-enviadas"></div>
                <div id="paginacao-enviadas"></div>
            </div>
        </div>

        <div id="view-resolver-oral" style="display:none;">
            <div class="header-resolver-top">
                <button class="btn-voltar-topo" onclick="window.voltarParaListaOral()"><i class="fa-solid fa-arrow-left"></i></button>
                <div id="header-oral-titulo" style="font-size:14px; font-weight:700; flex:1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
                <div class="cronometro-box"><span id="tempo-total-display">00:00</span></div>
            </div>
            <div id="nav-questoes-oral" class="nav-questoes-container"></div>
            <div id="render-pergunta-oral"></div>
        </div>
    </div>`;
});
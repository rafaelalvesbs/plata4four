window.Router.register('gramaticaprofessorclm', async () => {
    // BLOQUEIO MOBILE
    if (window.innerWidth < 1024) {
        return `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh; text-align: center; padding: 30px; font-family: 'Inter', sans-serif;">
                <div style="background: #fff1f2; width: 70px; height: 70px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; border: 2px solid #e11d48;">
                    <i class="fa-solid fa-laptop" style="color:#e11d48; font-size: 1.8rem;"></i>
                </div>
                <h2 style="color: #0f172a; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.5px;">Painel Exclusivo para Desktop</h2>
                <p style="color: #64748b; max-width: 320px; line-height: 1.6; font-size: 0.95rem;">
                    A criação de atividades de <strong>Gramática</strong> requer uma tela maior para melhor organização dos campos e visualização. Por favor, acesse através de um computador.
                </p>
                <button onclick="window.location.hash = '#home'" style="margin-top: 30px; padding: 14px 30px; background: #003058; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: 0.2s;">
                    Voltar ao Início
                </button>
            </div>
        `;
    }

    const db = window.db;
    const { collection, getDocs, addDoc, serverTimestamp, query, where, doc, deleteDoc, updateDoc, getDoc } = window.fsMethods;

    // --- VARIÁVEIS DE ESTADO ---
    let enviadasCache = [];
    let recebidasCache = []; 
    let idEditandoGram = null; 
    let timeoutAutoSave = null;

    // --- SISTEMA DE ALERTAS ---
    window.showAlertGram = (titulo, mensagem, tipo = 'info') => {
        const modal = document.getElementById('modal-alert-gram');
        const titleEl = document.getElementById('alert-title-gram');
        const msgEl = document.getElementById('alert-msg-gram');
        const iconEl = document.getElementById('alert-icon-gram');
        titleEl.innerText = titulo;
        msgEl.innerHTML = mensagem;
        iconEl.innerHTML = tipo === 'error' ? '<i class="fa-solid fa-circle-xmark" style="color:#ef4444; font-size:40px;"></i>' : '<i class="fa-solid fa-circle-check" style="color:#003058; font-size:40px;"></i>';
        modal.style.display = 'flex';
    };

    window.closeAlertGram = () => { document.getElementById('modal-alert-gram').style.display = 'none'; };

    window.showConfirmGram = (titulo, mensagem, onConfirm) => {
        const modal = document.getElementById('modal-confirm-gram');
        document.getElementById('confirm-title-gram').innerText = titulo;
        document.getElementById('confirm-msg-gram').innerText = mensagem;
        modal.style.display = 'flex';
        window.pendingConfirmAction = async () => { 
            await onConfirm(); 
            modal.style.display = 'none'; 
        };
    };

    // --- AUTO SAVE ---
    window.triggerAutoSave = () => {
        if (!idEditandoGram) return;
        clearTimeout(timeoutAutoSave);
        const statusElement = document.getElementById('save-status');
        if(statusElement) statusElement.innerText = "Alterações pendentes...";
        timeoutAutoSave = setTimeout(async () => {
            await window.enviarAtividadeGramatica(true);
            if(statusElement) { statusElement.innerText = "Salvo!"; setTimeout(() => { statusElement.innerText = ""; }, 2000); }
        }, 2000);
    };

    // --- NAVEGAÇÃO ---
    window.switchMainTabGram = (tab) => {
        document.querySelectorAll('.main-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane-gram').forEach(pane => pane.style.display = 'none');
        document.getElementById(`tab-btn-${tab}`).classList.add('active');
        document.getElementById(`pane-${tab}`).style.display = 'block';

        if(tab === 'enviadas') { 
            window.paginaAtualEnviadas = 1; 
            window.carregarAtividadesEnviadasGram(); 
        }
        if(tab === 'recebidas') { 
            window.paginaAtualRecebidas = 1; 
            window.carregarRecebidasGram(); 
        }
        if(tab !== 'criar') {
            idEditandoGram = null;
            const btnPub = document.querySelector('.btn-publish-gram');
            if(btnPub) btnPub.innerText = "OK";
        }
        if(tab !== 'recebidas') {
            const containerBase = document.getElementById('lista-recebidas-content');
            if(containerBase) {
                containerBase.innerHTML = '';
                recebidasCache = [];
            }
        }
    };

    window.switchQuestaoGram = (target) => {
        document.querySelectorAll('.g-btn-pill').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.g-content-box').forEach(c => c.style.display = 'none');
        document.getElementById(`btn-gram-${target}`).classList.add('active');
        document.getElementById(`content-gram-${target}`).style.display = 'block';
    };

    // --- IMAGENS ---
   // Cache temporário para arquivos de imagem antes do upload final
    let gramImagesFiles = {};

    const uploadImageGram = async (file, path) => {
        const { ref, uploadBytes, getDownloadURL } = window.storageMethods;
        const storageRef = ref(window.storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        return await getDownloadURL(snapshot.ref);
    };

    window.handleGrammarImage = async (input, qNum) => {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById(`img-prev-gram-${qNum}`).src = e.target.result;
                document.getElementById(`img-wrapper-gram-${qNum}`).style.display = 'block';
                gramImagesFiles[qNum] = file; 
                window.triggerAutoSave();
            };
            reader.readAsDataURL(file);
            input.value = "";
        }
    };

    window.removerFotoGram = (qNum, shouldSave = true) => {
        document.getElementById(`img-wrapper-gram-${qNum}`).style.display = 'none';
        document.getElementById(`img-prev-gram-${qNum}`).src = "";
        if(shouldSave) window.triggerAutoSave();
    };

    // --- CARREGAMENTO ENVIADAS ---
    window.paginaAtualEnviadas = 1;
    window.carregarAtividadesEnviadasGram = async () => {
        const container = document.getElementById('lista-enviadas-content');
        container.innerHTML = '<p style="padding:15px; color:#64748b;">Buscando atividades...</p>';
        try {
            const auth = window.authMethods.getAuth();
            const q = query(
                collection(db, "atividades_enviadas"), 
                where("tipo", "==", "gramatica"),
                where("professorId", "==", auth.currentUser.uid)
            );
            const snap = await getDocs(q);
            enviadasCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            enviadasCache.sort((a,b) => (b.dataEnvio?.seconds || 0) - (a.dataEnvio?.seconds || 0));
            
            if (enviadasCache.length === 0) {
                container.innerHTML = '<p style="padding:20px; text-align:center; color:#94a3b8;">Vazio.</p>';
                return;
            }

            const itensPorPagina = 8;
            const totalPaginas = Math.ceil(enviadasCache.length / itensPorPagina);
            const inicio = (window.paginaAtualEnviadas - 1) * itensPorPagina;
            const fim = inicio + itensPorPagina;
            const itensPagina = enviadasCache.slice(inicio, fim);

            let htmlAtividades = itensPagina.map(data => `
                <div class="card-premium-list" style="margin-bottom:10.5px; padding:0 15px; border-left:4px solid #003058; background:#fff; border-radius:8px; display:flex; align-items:center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); height: 45px; box-sizing: border-box;">
                    <div style="flex: 1; display: flex; align-items: center; overflow: hidden;">
                        <span style="font-size:9px; padding:2px 6px; background:#003058; color:white; border-radius:4px; font-weight:700; white-space:nowrap;">${data.semestre}</span>
                    </div>
                    <div style="flex: 2; display: flex; justify-content: center; align-items: center; overflow: hidden; padding: 0 10px;">
                        <h3 style="margin:0; color:#003058; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align: center;">${data.titulo}</h3>
                    </div>
                    <div style="flex: 1; display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
                        <span style="font-size:10px; color:#94a3b8; white-space:nowrap;">${data.prazo}</span>
                        <div style="display: flex; gap: 5px;">
                            <button onclick="window.visualizarAtividadeGram('${data.id}')" style="background:#e0f2fe; color:#0369a1; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; height:30px;"><i class="fa-solid fa-eye"></i></button>
                            <button onclick="window.prepararEdicaoGramatica('${data.id}')" style="background:#f1f5f9; color:#003058; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; height:30px;"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="window.excluirAtividadeGram('${data.id}')" style="background:#fee2e2; color:#ef4444; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; height:30px;"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </div>
                </div>`).join('');

            const totalHtml = htmlAtividades + '<div style="height: 52.5px;"></div>' + (totalPaginas > 1 ? `
                <div style="display:flex; justify-content:center; gap:10px; margin-top:15px; align-items:center;">
                    <button onclick="window.mudarPaginaGram(${window.paginaAtualEnviadas - 1})" ${window.paginaAtualEnviadas === 1 ? 'disabled' : ''} style="padding:5px 10px; border-radius:5px; border:1px solid #ccc; cursor:pointer; background:#fff; opacity:${window.paginaAtualEnviadas === 1 ? '0.5' : '1'}">Anterior</button>
                    <span style="font-size:12px; font-weight:bold; color:#003058;">Pág. ${window.paginaAtualEnviadas} de ${totalPaginas}</span>
                    <button onclick="window.mudarPaginaGram(${window.paginaAtualEnviadas + 1})" ${window.paginaAtualEnviadas === totalPaginas ? 'disabled' : ''} style="padding:5px 10px; border-radius:5px; border:1px solid #ccc; cursor:pointer; background:#fff; opacity:${window.paginaAtualEnviadas === totalPaginas ? '0.5' : '1'}">Próxima</button>
                </div>` : '');
            container.innerHTML = totalHtml;
        } catch (e) { container.innerHTML = '<p>Erro ao carregar.</p>'; }
    };

    window.mudarPaginaGram = (novaPagina) => {
        window.paginaAtualEnviadas = novaPagina;
        window.carregarAtividadesEnviadasGram();
    };

    // --- CARREGAMENTO RECEBIDAS COM FILTRO ---
    window.paginaAtualRecebidas = 1;
    window.carregarRecebidasGram = async () => {
        const containerBase = document.getElementById('lista-recebidas-content');
        if (!document.getElementById('filtro-recebidas-turma')) {
            containerBase.innerHTML = `
                <div id="container-filtro-recebidas" style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-bottom: 15px; padding: 0 15px;">
                    <label class="label-sutil" style="margin:0;">Filtrar Turma:</label>
                    <select id="filtro-recebidas-turma" class="input-premium" style="width: 160px; margin:0; height: 32px; font-size: 11px;" onchange="window.carregarRecebidasGram()">
                        <option value="todos">TODAS AS TURMAS</option>
                    </select>
                </div>
                <div id="lista-recebidas-dados"></div>`;
        }

        const containerDados = document.getElementById('lista-recebidas-dados');
        const filtroElement = document.getElementById('filtro-recebidas-turma');
        const valorFiltro = filtroElement.value;
        containerDados.innerHTML = '<p style="padding:15px; color:#64748b;">Buscando entregas...</p>';

       try {
            const auth = window.authMethods.getAuth();
            const userAtual = auth.currentUser;

            const qMinhasTurmas = query(collection(db, "turmas"), where("professorResponsavelId", "==", userAtual.uid));
            const snapMinhasTurmas = await getDocs(qMinhasTurmas);
            const senhasDasMinhasTurmas = snapMinhasTurmas.docs.map(t => t.data().senha);

            const q = query(collection(db, "respostas_alunos"));
            const snap = await getDocs(q);
            
            const promessas = snap.docs.map(async (d) => {
                const data = d.data();
                const alunoDoc = await getDoc(doc(db, "usuarios", data.alunoId));
                const alunoData = alunoDoc.exists() ? alunoDoc.data() : {};
                
                const senhaTurmaAluno = (alunoData.turma || "").trim();
                if (!senhasDasMinhasTurmas.includes(senhaTurmaAluno)) return null;

                let nomeTurmaReal = "-", semestreReal = "-";
                const qTurma = query(collection(db, "turmas"), where("senha", "==", senhaTurmaAluno));
                const snapTurma = await getDocs(qTurma);
                if (!snapTurma.empty) {
                    const dTurma = snapTurma.docs[0].data();
                    nomeTurmaReal = dTurma.nomeCustomizado || dTurma.nome || senhaTurmaAluno;
                    semestreReal = dTurma.semestre || "-";
                }
                
                return { id: d.id, nomeAluno: alunoData.nome || "Aluno", turmaExibicao: nomeTurmaReal, semestreExibicao: semestreReal, ...data };
            });
            
            const resultadosTotos = await Promise.all(promessas);
            const todasRecebidas = resultadosTotos.filter(r => r !== null);
            
            if (filtroElement.options.length <= 1) {
                const turmasUnicas = [...new Set(todasRecebidas.map(r => r.turmaExibicao))].filter(t => t !== "-" && t !== "N/A");
                turmasUnicas.sort().forEach(turma => {
                    const opt = document.createElement('option');
                    opt.value = turma; opt.innerText = turma;
                    filtroElement.appendChild(opt);
                });
            }

            recebidasCache = valorFiltro === "todos" ? todasRecebidas : todasRecebidas.filter(r => r.turmaExibicao === valorFiltro);
            recebidasCache.sort((a,b) => (b.dataEntrega?.seconds || 0) - (a.dataEntrega?.seconds || 0));

            if (recebidasCache.length === 0) {
                containerDados.innerHTML = '<p style="padding:20px; text-align:center; color:#94a3b8;">Nenhuma resposta encontrada.</p>';
                return;
            }

            const itensPorPagina = 8;
            const totalPaginas = Math.ceil(recebidasCache.length / itensPorPagina);
            const inicio = (window.paginaAtualRecebidas - 1) * itensPorPagina;
            const fim = inicio + itensPorPagina;
            const itensPagina = recebidasCache.slice(inicio, fim);

            containerDados.innerHTML = itensPagina.map(data => `
                <div class="card-premium-list" style="margin-bottom:10.5px; padding:0 15px; border-left:4px solid #003058; background:#fff; border-radius:8px; display:flex; align-items:center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); height: 45px; box-sizing: border-box;">
                    <div style="flex: 1.5; display: flex; align-items: center; gap: 8px; overflow: hidden;">
                        <h3 style="margin:0; color:#003058; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width: 120px;">${data.nomeAluno}</h3>
                        <span style="font-size:9px; padding:2px 5px; background:#f1f5f9; color:#64748b; border-radius:4px; font-weight:700; white-space:nowrap;">${data.turmaExibicao} | ${data.semestreExibicao}</span>
                    </div>
                    <div style="flex: 1.5; display: flex; justify-content: center; align-items: center; overflow: hidden; padding: 0 10px;">
                        <div style="font-size:11px; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align: center;">${data.titulo}</div>
                    </div>
                    <div style="flex: 0.8; display: flex; justify-content: flex-end; align-items: center;">
                        <span style="font-size:10px; padding:3px 8px; background:#003058; color:white; border-radius:4px; font-weight:800; white-space:nowrap;">NOTA: ${data.nota}</span>
                    </div>
                </div>`).join('') + `
                <div style="height: 52.5px;"></div>
                ${totalPaginas > 1 ? `
                <div style="display:flex; justify-content:center; gap:10px; margin-top:15px; align-items:center;">
                    <button onclick="window.mudarPaginaRecebidas(${window.paginaAtualRecebidas - 1})" ${window.paginaAtualRecebidas === 1 ? 'disabled' : ''} style="padding:5px 10px; border-radius:5px; border:1px solid #ccc; cursor:pointer; background:#fff; opacity:${window.paginaAtualRecebidas === 1 ? '0.5' : '1'}">Anterior</button>
                    <span style="font-size:12px; font-weight:bold; color:#003058;">Pág. ${window.paginaAtualRecebidas} de ${totalPaginas}</span>
                    <button onclick="window.mudarPaginaRecebidas(${window.paginaAtualRecebidas + 1})" ${window.paginaAtualRecebidas === totalPaginas ? 'disabled' : ''} style="padding:5px 10px; border-radius:5px; border:1px solid #ccc; cursor:pointer; background:#fff; opacity:${window.paginaAtualRecebidas === totalPaginas ? '0.5' : '1'}">Próxima</button>
                </div>` : ''}`;
        } catch (e) { containerDados.innerHTML = '<p>Erro ao carregar.</p>'; }
    };

    window.mudarPaginaRecebidas = (novaPagina) => {
        window.paginaAtualRecebidas = novaPagina;
        window.carregarRecebidasGram();
    };

    // --- VISUALIZAÇÃO ---
    window.visualizarAtividadeGram = (id) => {
        const item = enviadasCache.find(atv => atv.id === id);
        if(!item) return;
        const modal = document.getElementById('modal-preview-gram');
        const content = document.getElementById('modal-preview-content');
        let questHtml = item.questoes.map((q, i) => `
            <div style="margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
                <p style="font-weight:700; color:#003058; font-size:13px;">${i+1}. ${q.enunciado}</p>
                ${q.imagem ? `<img src="${q.imagem}" style="width:120px; height:120px; object-fit:cover; border-radius:8px; margin-bottom:10px; display:block;">` : ''}
                <div style="font-size:12px;">
                    <div style="${q.correta === 'A' ? 'color:#003058; font-weight:700' : ''}">A) ${q.opcoes.A}</div>
                    <div style="${q.correta === 'B' ? 'color:#003058; font-weight:700' : ''}">B) ${q.opcoes.B}</div>
                    <div style="${q.correta === 'C' ? 'color:#003058; font-weight:700' : ''}">C) ${q.opcoes.C}</div>
                </div>
            </div>`).join('');
        content.innerHTML = `
            <h2 style="font-size:18px; color:#003058;">${item.titulo}</h2>
            ${item.textoContexto ? `<div style="background:#f8fafc; padding:10px; border-radius:8px; margin:10px 0; font-size:12px; border-left:4px solid #003058;"><strong>${item.tituloTextoContexto || 'Texto Base'}:</strong><br>${item.textoContexto}</div>` : ''}
            ${item.fotoTextoContexto ? `<img src="${item.fotoTextoContexto}" style="width:120px; height:120px; object-fit:cover; border-radius:8px; margin-bottom:15px;">` : ''}
            <div style="max-height:40vh; overflow-y:auto;">${questHtml}</div>`;
        modal.style.display = 'flex';
    };
    window.closePreviewGram = () => { document.getElementById('modal-preview-gram').style.display = 'none'; };

    // --- EDIÇÃO ---
    window.prepararEdicaoGramatica = (id) => {
        const item = enviadasCache.find(atv => atv.id === id);
        if(!item) return;
        idEditandoGram = id;
        window.switchMainTabGram('criar');
        document.getElementById('titulo-gram').value = item.titulo || "";
        document.getElementById('prazo-gram').value = item.prazo || "";
        document.getElementById('titulo-contexto-gram').value = item.tituloTextoContexto || "";
        document.getElementById('texto-contexto-gram').value = item.textoContexto || "";
        if(item.fotoTextoContexto) {
            document.getElementById('img-prev-gram-texto').src = item.fotoTextoContexto;
            document.getElementById('img-wrapper-gram-texto').style.display = 'block';
        } else { window.removerFotoGram('texto', false); }
        document.querySelectorAll('#turma-pills-gram .btn-turma-pill').forEach(btn => {
            btn.classList.remove('active');
            if(btn.dataset.nome === item.semestre) btn.classList.add('active');
        });
        for(let i=1; i<=10; i++) {
            document.getElementById(`enunc-gram-${i}`).value = "";
            document.getElementById(`opt-a-${i}`).value = "";
            document.getElementById(`opt-b-${i}`).value = "";
            document.getElementById(`opt-c-${i}`).value = "";
            window.removerFotoGram(i, false);
        }
        item.questoes.forEach((q, idx) => {
            const n = idx + 1;
            document.getElementById(`enunc-gram-${n}`).value = q.enunciado;
            document.getElementById(`opt-a-${n}`).value = q.opcoes.A;
            document.getElementById(`opt-b-${n}`).value = q.opcoes.B;
            document.getElementById(`opt-c-${n}`).value = q.opcoes.C;
            document.getElementById(`correct-${n}`).value = q.correta;
            if(q.imagem) {
                document.getElementById(`img-prev-gram-${n}`).src = q.imagem;
                document.getElementById(`img-wrapper-gram-${n}`).style.display = 'block';
            }
        });
        document.querySelector('.btn-publish-gram').innerText = "ATUALIZAR ATIVIDADE AGORA";
    };

    // --- SALVAMENTO ---
   window.enviarAtividadeGramatica = async (isAutoSave = false) => {
        const btnPublish = document.querySelector('.btn-publish-gram');
        let textoOriginal = "";

        if (!isAutoSave && btnPublish) {
            textoOriginal = btnPublish.innerText;
            btnPublish.disabled = true;
            btnPublish.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ENVIANDO...';
        }

        const semestreBtn = document.querySelector('.btn-turma-pill.active');
        const titulo = document.getElementById('titulo-gram')?.value || "";
        const prazoInput = document.getElementById('prazo-gram')?.value || "";

        if (!isAutoSave) {
            // Pausa de 3.5 segundos para garantir a percepção visual
            await new Promise(r => setTimeout(r, 3500));

            if (!semestreBtn || !titulo || !prazoInput) {
                if (btnPublish) { btnPublish.disabled = false; btnPublish.innerText = textoOriginal; }
                return window.showAlertGram("Atenção", "Preencha o título, prazo e selecione o semestre!", "error");
            }
            
            const dataHoje = new Date(); dataHoje.setHours(0,0,0,0);
            if (new Date(prazoInput + 'T00:00:00') < dataHoje) {
                if (btnPublish) { btnPublish.disabled = false; btnPublish.innerText = textoOriginal; }
                return window.showAlertGram("Data Inválida", "O prazo não pode ser uma data retroativa!", "error");
            }

            let temQuestaoValida = false;
            for (let i = 1; i <= 10; i++) {
                const enunc = (document.getElementById(`enunc-gram-${i}`)?.value || "").trim();
                const optA = (document.getElementById(`opt-a-${i}`)?.value || "").trim();
                const optB = (document.getElementById(`opt-b-${i}`)?.value || "").trim();
                const optC = (document.getElementById(`opt-c-${i}`)?.value || "").trim();
                if (enunc && optA && optB && optC) { temQuestaoValida = true; break; }
            }

            if (!temQuestaoValida) {
                if (btnPublish) { btnPublish.disabled = false; btnPublish.innerText = textoOriginal; }
                return window.showAlertGram("Atividade Vazia", "Crie pelo menos uma questão completa antes de publicar.", "error");
            }
        }

        try {
            const auth = window.authMethods.getAuth();
            const profId = auth.currentUser.uid;
            
            let fotoTextoUrl = null;
            const wrapperTexto = document.getElementById('img-wrapper-gram-texto');
            if (wrapperTexto.style.display === 'block') {
                const srcAtual = document.getElementById('img-prev-gram-texto').src;
                if (gramImagesFiles['texto']) {
                    fotoTextoUrl = await uploadImageGram(gramImagesFiles['texto'], `gramatica/${profId}/ctx_${Date.now()}.jpg`);
                    delete gramImagesFiles['texto'];
                } else if (srcAtual.startsWith('http')) {
                    fotoTextoUrl = srcAtual;
                }
            }

            let questoes = [];
            for(let i=1; i<=10; i++) {
                const enunc = document.getElementById(`enunc-gram-${i}`).value;
                if(enunc.trim()) {
                    let imgQuestaoUrl = null;
                    const wrapperImg = document.getElementById(`img-wrapper-gram-${i}`);
                    
                    if (wrapperImg.style.display === 'block') {
                        const srcQuestao = document.getElementById(`img-prev-gram-${i}`).src;
                        if (gramImagesFiles[i]) {
                            imgQuestaoUrl = await uploadImageGram(gramImagesFiles[i], `gramatica/${profId}/q${i}_${Date.now()}.jpg`);
                            delete gramImagesFiles[i];
                        } else if (srcQuestao.startsWith('http')) {
                            imgQuestaoUrl = srcQuestao;
                        }
                    }

                    questoes.push({
                        enunciado: enunc,
                        opcoes: { 
                            A: document.getElementById(`opt-a-${i}`).value, 
                            B: document.getElementById(`opt-b-${i}`).value, 
                            C: document.getElementById(`opt-c-${i}`).value 
                        },
                        correta: document.getElementById(`correct-${i}`).value,
                        imagem: imgQuestaoUrl
                    });
                }
            }

            const dados = { 
                tipo: 'gramatica', 
                professorId: profId,
                titulo, 
                tituloTextoContexto: document.getElementById('titulo-contexto-gram').value, 
                textoContexto: document.getElementById('texto-contexto-gram').value, 
                fotoTextoContexto: fotoTextoUrl, 
                semestre: semestreBtn ? semestreBtn.dataset.nome : "", 
                turma: semestreBtn ? semestreBtn.dataset.senha : "", 
                prazo: prazoInput, 
                questoes, 
                dataEnvio: serverTimestamp() 
            };

            if(idEditandoGram) {
                await updateDoc(doc(db, "atividades_enviadas", idEditandoGram), dados);
                if(!isAutoSave) { 
                    window.showAlertGram("Sucesso", "Atividade atualizada!"); 
                    window.switchMainTabGram('enviadas'); 
                }
            } else if(!isAutoSave) {
                const ref = await addDoc(collection(db, "atividades_enviadas"), dados);
                idEditandoGram = ref.id; 
                window.showAlertGram("Sucesso", "Atividade publicada!"); 
                window.switchMainTabGram('enviadas');
            }
        } catch(e) { 
            console.error(e);
            if(!isAutoSave) window.showAlertGram("Erro", "Falha ao salvar no servidor.", "error"); 
        } finally {
            if(!isAutoSave) {
                btnPublish.disabled = false;
                btnPublish.innerText = idEditandoGram ? "ATUALIZAR ATIVIDADE AGORA" : "OK";
            }
        }
    };

    // --- EXCLUSÃO ---
    window.excluirAtividadeGram = (id) => {
        window.showConfirmGram("Excluir?", "Apagar a atividade e todas as imagens vinculadas?", async () => {
            try {
                const { ref, deleteObject } = window.storageMethods;
                const item = enviadasCache.find(atv => atv.id === id);
                
                if (item) {
                    // 1. Apagar foto do contexto se existir
                    if (item.fotoTextoContexto && item.fotoTextoContexto.includes('firebasestorage')) {
                        try {
                            const refCtx = ref(window.storage, item.fotoTextoContexto);
                            await deleteObject(refCtx);
                        } catch (e) { console.warn("Erro ao apagar foto de contexto no Storage", e); }
                    }

                    // 2. Apagar fotos das questões se existirem
                    if (item.questoes) {
                        for (let q of item.questoes) {
                            if (q.imagem && q.imagem.includes('firebasestorage')) {
                                try {
                                    const refQ = ref(window.storage, q.imagem);
                                    await deleteObject(refQ);
                                } catch (e) { console.warn("Erro ao apagar foto de questão no Storage", e); }
                            }
                        }
                    }
                }

                // 3. Apagar o documento no Firestore
                await deleteDoc(doc(db, "atividades_enviadas", id));
                await window.carregarAtividadesEnviadasGram();
                window.showAlertGram("Sucesso", "Atividade e arquivos removidos!");
            }
            catch (err) { 
                console.error(err);
                window.showAlertGram("Erro", "Não foi possível excluir totalmente.", "error"); 
            }
        });
    };

    // --- CARREGAR SEMESTRES CRIAR ---
    // --- CARREGAR TURMAS DO PROFESSOR (MESMA LÓGICA DA ESCRITA) ---
    setTimeout(async () => {
        const div = document.getElementById('turma-pills-gram');
        if (!div) return;
        
        try {
            const auth = window.authMethods.getAuth();
            const userAtual = auth.currentUser;

            if (!userAtual) {
                div.innerHTML = "<p style='font-size:11px; color:red;'>Erro: Usuário não logado.</p>";
                return;
            }

            // 1. Busca as turmas onde o professorResponsavelId é o ID do usuário atual
            const q = query(
                collection(db, "turmas"), 
                where("professorResponsavelId", "==", userAtual.uid)
            );
            
            const snap = await getDocs(q);
            const mapaUnico = new Map();

            snap.forEach(d => {
                const data = d.data();
                // Usamos 'semestre' para o texto do botão e 'senha' para o filtro da atividade
                if (data.semestre && data.senha) {
                    mapaUnico.set(data.semestre.trim(), data.senha);
                }
            });

            // 2. Converte para Array e ordena logicamente
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

            // 3. Renderiza os botões (Pills)
            turmasLimpas.forEach(t => {
                const btn = document.createElement('button');
                btn.className = 'btn-turma-pill';
                btn.innerText = t.semestre.toUpperCase();
                btn.dataset.nome = t.semestre; // Nome para exibição/salvamento
                btn.dataset.senha = t.senha;   // ID técnico da turma
                btn.onclick = function () {
                    div.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    // Se você tiver uma função de carregamento automático ao trocar de turma:
                    if(window.triggerAutoSave) window.triggerAutoSave();
                };
                div.appendChild(btn);
            });

            // 4. Ativa o primeiro botão automaticamente
            if (div.firstChild) div.firstChild.classList.add('active');

        } catch (erro) {
            console.error("Erro ao carregar semestres para gramática:", erro);
            div.innerHTML = '<p style="font-size:11px; color:red;">Erro ao carregar turmas.</p>';
        }
    }, 800);

    return `
    <style>
        .gramatica-container { width:100%; font-family:'Inter',sans-serif; padding:15px; box-sizing:border-box; }
        .card-gram { background:#fff; border-radius:12px; padding:18px; box-shadow:0 4px 12px rgba(0,0,0,0.05); border:1px solid #eef2f6; }
        .input-premium { width:100%; padding:9px; border:1px solid #e2e8f0; border-radius:8px; font-size:13px; background:#f8fafc; margin-bottom:10px; font-family:inherit; }
        .label-sutil { font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; display:block; margin-bottom:3px; }
        .g-btn-pill { min-width:32px; height:32px; border-radius:8px; border:1px solid #e2e8f0; background:#fff; cursor:pointer; font-weight:700; font-size:11px; color:#64748b; }
        .g-btn-pill.active { background:#003058; color:#fff; border-color:#003058; }
        .btn-texto-apoio { background:#f1f5f9; color:#003058; border:1px dashed #003058; padding:0 10px; width:auto; }
        .btn-turma-pill { padding:6px 12px; border:1px solid #e2e8f0; background:#fff; border-radius:20px; cursor:pointer; font-size:11px; font-weight:700; margin-right:5px; white-space:nowrap; }
        .btn-turma-pill.active { background:#003058; color:#fff; }
        .main-tab-btn { padding:7px 15px; border:none; background:none; cursor:pointer; font-weight:700; color:#64748b; }
        .main-tab-btn.active { color:#003058; border-bottom:3px solid #003058; }
        .btn-publish-gram { background:#003058; color:#fff; border:none; padding:12px; width:100%; border-radius:10px; font-weight:700; cursor:pointer; margin-top:10px; }
        .img-fixed-size { width:120px; height:120px; object-fit:cover; border-radius:8px; border:1px solid #eee; margin-top:10px; display:block; }
        .img-wrapper { position:relative; width:120px; height:120px; margin-top:5px; }
        .btn-del-img { position:absolute; top:-5px; right:-5px; background:#ef4444; color:#fff; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center; }
        .modal-gram { position:fixed; inset:0; background:rgba(0,48,88,0.4); backdrop-filter:blur(4px); display:none; justify-content:center; align-items:center; z-index:9999; padding:20px; }
        .modal-gram-content { background:#fff; width:100%; max-width:450px; border-radius:20px; padding:25px; position:relative; text-align:center; }
    </style>

    <div class="gramatica-container">
        <div id="modal-alert-gram" class="modal-gram"><div class="modal-gram-content"><div id="alert-icon-gram" style="margin-bottom:10px;"></div><h3 id="alert-title-gram" style="color:#003058"></h3><div id="alert-msg-gram"></div><button class="btn-publish-gram" onclick="window.closeAlertGram()">OK</button></div></div>
        <div id="modal-preview-gram" class="modal-gram" onclick="if(event.target===this)window.closePreviewGram()"><div class="modal-gram-content" style="text-align:left;"><button onclick="window.closePreviewGram()" style="float:right; border:none; background:none; cursor:pointer;">✕</button><div id="modal-preview-content"></div></div></div>
        <div id="modal-confirm-gram" class="modal-gram"><div class="modal-gram-content"><h3 id="confirm-title-gram" style="color:#003058"></h3><p id="confirm-msg-gram"></p><div style="display:flex; gap:10px;"><button class="btn-publish-gram" style="background:#ef4444" onclick="window.pendingConfirmAction()">SIM</button><button class="btn-publish-gram" style="background:#f1f5f9; color:#64748b" onclick="this.closest('.modal-gram').style.display='none'">NÃO</button></div></div></div>

        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h1 style="color:#003058; font-weight:800; margin:0;">GRAMÁTICA</h1>
            <div id="save-status" style="font-size:10px; color:#003058; font-weight:700;"></div>
        </div>

        <div class="main-tabs" style="display:flex; gap:10px; border-bottom:2px solid #e2e8f0; margin:15px 0;">
            <button id="tab-btn-criar" class="main-tab-btn active" onclick="window.switchMainTabGram('criar')">CRIAR</button>
            <button id="tab-btn-enviadas" class="main-tab-btn" onclick="window.switchMainTabGram('enviadas')">ENVIADAS</button>
            <button id="tab-btn-recebidas" class="main-tab-btn" onclick="window.switchMainTabGram('recebidas')">RECEBIDAS</button>
        </div>

        <div id="pane-criar" class="tab-pane-gram" style="display:block;">
            <div class="card-gram">
                <label class="label-sutil">Semestre:</label>
                <div id="turma-pills-gram" style="display:flex; overflow-x:auto; margin-bottom:10px; padding-bottom:5px;"></div>
<div style="display:flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <input type="text" id="titulo-gram" class="input-premium" placeholder="Título da Atividade" style="width: 70%; margin-bottom:0;" oninput="window.triggerAutoSave()" autocomplete="off">
                    <input type="date" id="prazo-gram" class="input-premium" style="width:130px; margin-bottom:0;" onchange="window.triggerAutoSave()" onfocus="this.min = new Date().toISOString().split('T')[0]" autocomplete="off">
                </div>
                <div style="margin:10px 0;">
                    <div style="display:flex; gap:5px; overflow-x:auto; padding-bottom:5px;">
                        <button id="btn-gram-texto" class="g-btn-pill btn-texto-apoio active" onclick="window.switchQuestaoGram('texto')">TEXTO</button>
                        ${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button id="btn-gram-${n}" class="g-btn-pill" onclick="window.switchQuestaoGram(${n})">${n}</button>`).join('')}
                    </div>
                </div>
                <div style="background:#fbfcfd; padding:15px; border-radius:12px; border:1px solid #f1f5f9; min-height:200px;">
                    <div id="content-gram-texto" class="g-content-box">
                        <input type="text" id="titulo-contexto-gram" class="input-premium" placeholder="Título do Texto" oninput="window.triggerAutoSave()" autocomplete="off">
<textarea id="texto-contexto-gram" class="input-premium" style="height:100px; resize:none;" placeholder="Texto base..." oninput="window.triggerAutoSave()" autocomplete="off"></textarea>
                        <button class="btn-turma-pill" onclick="document.getElementById('file-gram-texto').click()">FOTO</button>
                        <input type="file" id="file-gram-texto" accept="image/*" style="display:none" onchange="window.handleGrammarImage(this, 'texto')">
                        <div id="img-wrapper-gram-texto" class="img-wrapper" style="display:none;"><button class="btn-del-img" onclick="window.removerFotoGram('texto')">✕</button><img id="img-prev-gram-texto" class="img-fixed-size"></div>
                    </div>
                    ${[1,2,3,4,5,6,7,8,9,10].map(n=>`
                        <div id="content-gram-${n}" class="g-content-box" style="display:none;">
                            <textarea id="enunc-gram-${n}" class="input-premium" placeholder="Questão ${n}..." oninput="window.triggerAutoSave()" autocomplete="off"></textarea>
                            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
    <div style="flex: 1; position: relative;">
        <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 13px; font-weight: 600;">A</span>
        <input type="text" id="opt-a-${n}" class="input-premium" style="padding-left: 30px; margin-bottom: 0; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;" oninput="window.triggerAutoSave()" autocomplete="off">
    </div>
    <div style="flex: 1; position: relative;">
        <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 13px; font-weight: 600;">B</span>
        <input type="text" id="opt-b-${n}" class="input-premium" style="padding-left: 30px; margin-bottom: 0; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;" oninput="window.triggerAutoSave()" autocomplete="off">
    </div>
    <div style="flex: 1; position: relative;">
        <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 13px; font-weight: 600;">C</span>
        <input type="text" id="opt-c-${n}" class="input-premium" style="padding-left: 30px; margin-bottom: 0; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;" oninput="window.triggerAutoSave()" autocomplete="off">
    </div>
</div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <select id="correct-${n}" class="input-premium" style="width:60px; margin:0;" onchange="window.triggerAutoSave()"><option value="A">A</option><option value="B">B</option><option value="C">C</option></select>
                                <button class="btn-turma-pill" onclick="document.getElementById('file-gram-${n}').click()">FOTO</button>
                                <input type="file" id="file-gram-${n}" accept="image/*" style="display:none" onchange="window.handleGrammarImage(this, ${n})">
                            </div>
                            <div id="img-wrapper-gram-${n}" class="img-wrapper" style="display:none;"><button class="btn-del-img" onclick="window.removerFotoGram(${n})">✕</button><img id="img-prev-gram-${n}" class="img-fixed-size"></div>
                        </div>`).join('')}
                </div>
                <button class="btn-publish-gram" onclick="window.enviarAtividadeGramatica(false)">PUBLICAR ATIVIDADE AGORA</button>
            </div>
        </div>
        <div id="pane-enviadas" class="tab-pane-gram"><div id="lista-enviadas-content"></div></div>
        <div id="pane-recebidas" class="tab-pane-gram"><div id="lista-recebidas-content"></div></div>
    </div>`;
});
window.Router.register('gramaticaalunoclm', async () => {
    const db = window.db;
    const { collection, getDocs, query, where, addDoc, serverTimestamp, getDoc, doc } = window.fsMethods;
    const auth = window.authMethods.getAuth();

    let atividadesRecebidas = [];
    let atividadesEnviadas = [];
    let atividadeSelecionada = null;
    let respostasAluno = {};
    let dadosTurmaAluno = null;
    let modoVisualizacao = false;
    let tempoInicio = null;
    let intervaloCronometro = null;
    let questaoAtualIndex = 0;

    let paginaAtualRecebidas = 1;
    let paginaAtualEnviadas = 1;
    const itensPorPagina = window.innerWidth <= 600 ? 5 : 6;

    const bloquearAcoes = (e) => { e.preventDefault(); return false; };
    document.addEventListener('copy', bloquearAcoes);
    document.addEventListener('paste', bloquearAcoes);
    document.addEventListener('contextmenu', bloquearAcoes);
    document.addEventListener('selectstart', bloquearAcoes);
    document.addEventListener('dragstart', bloquearAcoes);
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'a' || e.key === 'p')) e.preventDefault();
    });

    const buscarDadosContexto = async () => {
        window.addEventListener('resize', () => {
            itensPorPagina = window.innerWidth <= 600 ? 5 : 6;
        });
        const userRef = auth.currentUser;
        if (!userRef) return;
        try {
            const alunoDoc = await getDoc(doc(db, "usuarios", userRef.uid));
            if (alunoDoc.exists()) {
                const dadosUser = alunoDoc.data();
                const qTurma = query(collection(db, "turmas"), where("senha", "==", dadosUser.turma));
                const snapTurma = await getDocs(qTurma);
                if (!snapTurma.empty) {
                    const dadosT = snapTurma.docs[0].data();
                    dadosTurmaAluno = { alunoId: userRef.uid, semestre: dadosT.semestre };
                    window.switchTabAluno('recebidas');
                }
            }
        } catch (e) { console.error("Erro ao carregar perfil:", e); }
    };

    window.confirmarAcao = (mensagem, callback) => {
        const modal = document.getElementById('modal-confirmacao-moderno');
        document.getElementById('confirm-msg').innerText = mensagem;
        modal.style.display = 'flex';
        window.confirmCallback = () => {
            modal.style.display = 'none';
            callback();
        };
    };

    window.exibirAlertaMensagem = (titulo, msg) => {
        const modal = document.getElementById('modal-alerta-simples');
        document.getElementById('alerta-titulo').innerText = titulo;
        document.getElementById('alerta-msg').innerText = msg;
        modal.style.display = 'flex';
    };

    window.voltarParaLista = () => {
        if (modoVisualizacao) {
            executarSaida();
        } else {
            window.confirmarAcao("Deseja realmente sair? Seu progresso nesta tentativa será perdido.", executarSaida);
        }
    };

    const executarSaida = () => {
        if (intervaloCronometro) clearInterval(intervaloCronometro);
        document.getElementById('view-resolver').style.display = 'none';
        document.getElementById('main-view-aluno').style.display = 'block';
        if (modoVisualizacao) carregarEnviadas(); else carregarRecebidas();
    };

    window.switchTabAluno = async (tab) => {
        document.querySelectorAll('.tab-btn-aluno').forEach(b => b.classList.remove('active'));
        document.getElementById(`btn-tab-${tab}`).classList.add('active');
        document.getElementById('pane-recebidas').style.display = tab === 'recebidas' ? 'block' : 'none';
        document.getElementById('pane-enviadas').style.display = tab === 'enviadas' ? 'block' : 'none';
        if (tab === 'recebidas') carregarRecebidas();
        else carregarEnviadas();
    };

    const renderizarPaginacao = (totalItens, paginaAtual, tab) => {
        const totalPaginas = Math.ceil(totalItens / itensPorPagina);
        if (totalPaginas <= 1) return '';
        return `
            <div class="pagination-container">
                <button class="btn-pag" ${paginaAtual === 1 ? 'disabled' : ''} onclick="window.mudarPagina('${tab}', ${paginaAtual - 1})"><i class="fa-solid fa-angle-left"></i></button>
                <span class="pag-info">${paginaAtual} / ${totalPaginas}</span>
                <button class="btn-pag" ${paginaAtual === totalPaginas ? 'disabled' : ''} onclick="window.mudarPagina('${tab}', ${paginaAtual + 1})"><i class="fa-solid fa-angle-right"></i></button>
            </div>`;
    };

    window.mudarPagina = (tab, novaPagina) => {
        if (tab === 'recebidas') { paginaAtualRecebidas = novaPagina; exibirCardsRecebidas(); } 
        else { paginaAtualEnviadas = novaPagina; exibirCardsEnviadas(); }
    };

    const carregarRecebidas = async () => {
        const container = document.getElementById('lista-recebidas');
        container.innerHTML = '<div class="loader-container"><div class="spinner-modern"></div></div>';
        try {
            const qAtv = query(collection(db, "atividades_enviadas"), 
                where("semestre", "==", dadosTurmaAluno.semestre), 
                where("tipo", "==", "gramatica")
            );
            const snapAtv = await getDocs(qAtv);
            
            const qResp = query(collection(db, "respostas_alunos"), 
                where("alunoId", "==", String(dadosTurmaAluno.alunoId).trim())
            );
            const snapResp = await getDocs(qResp);
            const respondidasIds = snapResp.docs.map(d => String(d.data().atividadeId).trim());
            
            atividadesRecebidas = snapAtv.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(atv => !respondidasIds.includes(String(atv.id).trim()));
            
            exibirCardsRecebidas();
        } catch (e) { 
            console.error("Erro ao carregar recebidas:", e);
            container.innerHTML = '<div class="empty-state">Erro ao carregar atividades.</div>'; 
        }
    };

    const exibirCardsRecebidas = () => {
        const container = document.getElementById('lista-recebidas');
        const inicio = (paginaAtualRecebidas - 1) * itensPorPagina;
        const fim = inicio + itensPorPagina;
        const itensExibidos = atividadesRecebidas.slice(inicio, fim);
        const agora = new Date();

        container.innerHTML = itensExibidos.length ? itensExibidos.map(atv => {
            const dataLimite = atv.prazo ? new Date(atv.prazo + "T23:59:59") : null;
            const expirada = dataLimite && agora > dataLimite;
            
            let dataFmt = 'Sem prazo';
            if (atv.prazo) {
                const [ano, mes, dia] = atv.prazo.split('-');
                dataFmt = `${dia}/${mes}/${ano}`;
            }

            return `
            <div class="card-premium-list ${expirada ? 'expirada' : ''}" style="background:#fff; padding:15px; border-radius:12px; margin-bottom:10px; display:flex; align-items:center; border-left:5px solid ${expirada ? '#cbd5e1' : '#003058'}; box-shadow:0 2px 5px rgba(0,0,0,0.05); cursor:pointer;" onclick="${expirada ? "window.exibirAlertaMensagem('Prazo Encerrado', 'Esta atividade expirou.')" : `window.confirmarInicioAtividade('${atv.id}')`}">
                <div style="flex:1">
                    <h3 class="atv-titulo-list">${atv.titulo || 'Atividade'}</h3>
                    <div class="atv-sub-list">
                        <span><i class="fa-solid fa-calendar-day"></i> Semestre: ${atv.semestre}</span> |
                        <span style="color: ${expirada ? '#ef4444' : '#64748b'}">
                            <i class="fa-solid fa-clock"></i> Prazo: ${dataFmt}
                        </span>
                    </div>
                </div>
                <i class="fa-solid ${expirada ? 'fa-lock' : 'fa-chevron-right'}" style="color:#003058"></i>
            </div>`;
        }).join('') + renderizarPaginacao(atividadesRecebidas.length, paginaAtualRecebidas, 'recebidas') 
        : '<div class="empty-state">Nenhuma atividade pendente.</div>';
    };

    const carregarEnviadas = async () => {
        const container = document.getElementById('lista-enviadas');
        container.innerHTML = '<div class="loader-container"><div class="spinner-modern"></div></div>';
        try {
            const q = query(collection(db, "respostas_alunos"), where("alunoId", "==", dadosTurmaAluno.alunoId));
            const snap = await getDocs(q);
            atividadesEnviadas = [];
            
            for(let docSnap of snap.docs) {
                const data = docSnap.data();
                const refOrig = await getDoc(doc(db, "atividades_enviadas", data.atividadeId));
                
                if (refOrig.exists()) {
                    const dadosOriginais = refOrig.data();
                    // Filtra para mostrar apenas atividades de gramática
                    if (dadosOriginais.tipo === "gramatica") {
                        atividadesEnviadas.push({ 
                            ...data, 
                            idResp: docSnap.id, 
                            dadosOriginais: dadosOriginais 
                        });
                    }
                }
            }
            exibirCardsEnviadas();
        } catch (e) { 
            console.error(e);
            container.innerHTML = '<div class="empty-state">Erro ao carregar histórico.</div>'; 
        }
    };

    const exibirCardsEnviadas = () => {
        const container = document.getElementById('lista-enviadas');
        const inicio = (paginaAtualEnviadas - 1) * itensPorPagina;
        const fim = inicio + itensPorPagina;
        const itensExibidos = atividadesEnviadas.slice(inicio, fim);
        container.innerHTML = itensExibidos.length ? itensExibidos.map(atv => {
            const dataFmt = atv.dataEntrega ? new Date(atv.dataEntrega.seconds * 1000).toLocaleDateString('pt-BR') : '---';
            return `
            <div class="card-premium-list enviada">
                <div style="flex:1">
                    <h3 class="atv-titulo-list">${atv.titulo || 'Atividade'}</h3>
                    <div class="atv-sub-list">
                        <span><i class="fa-regular fa-calendar"></i> ${dataFmt}</span> | 
                        <span><i class="fa-regular fa-clock"></i> ${window.formatarTempoExterno(atv.tempoGasto)}</span>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <button class="btn-olho-revisao" onclick="window.revisarAtividade('${atv.idResp}')" title="Revisar">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <div class="nota-badge-circular">${atv.nota}</div>
                </div>
            </div>`;
        }).join('') + renderizarPaginacao(atividadesEnviadas.length, paginaAtualEnviadas, 'enviadas')
        : '<div class="empty-state">Sem histórico de atividades.</div>';
    };

    window.formatarTempoExterno = (segundosTotal) => {
        const mins = Math.floor(segundosTotal / 60);
        const segs = segundosTotal % 60;
        return `${mins.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
    };

    const iniciarCronometroVisual = () => {
        if (intervaloCronometro) clearInterval(intervaloCronometro);
        const display = document.getElementById('tempo-cronometro');
        intervaloCronometro = setInterval(() => {
            const decorrido = Math.floor((Date.now() - tempoInicio) / 1000);
            if(display) display.innerText = window.formatarTempoExterno(decorrido);
        }, 1000);
    };

    window.confirmarInicioAtividade = (id) => {
        const atv = atividadesRecebidas.find(a => a.id === id);
        if (!atv) return;

        if (atv.prazo) {
            const dataLimite = new Date(atv.prazo + "T23:59:59");
            if (new Date() > dataLimite) {
                window.exibirAlertaMensagem("Atenção", "Esta atividade expirou e não pode mais ser iniciada.");
                return;
            }
        }

        atividadeSelecionada = atv;
        document.getElementById('modal-aviso-cronometro').style.display = 'flex';
    };

    window.começarDeVez = () => {
        document.getElementById('modal-aviso-cronometro').style.display = 'none';
        respostasAluno = {}; modoVisualizacao = false; tempoInicio = Date.now();
        document.getElementById('main-view-aluno').style.display = 'none';
        document.getElementById('view-resolver').style.display = 'block';
        document.getElementById('header-atv-titulo').innerText = atividadeSelecionada.titulo;
        document.getElementById('cronometro-container').style.display = 'block';
        iniciarCronometroVisual();
        window.irParaQuestao(0);
    };

    window.mostrarTextoAtividade = () => {
        const modal = document.getElementById('modal-texto-aluno');
        document.getElementById('m-texto-titulo').innerText = atividadeSelecionada.tituloTextoContexto || "Texto Base";
        document.getElementById('m-texto-body').innerText = atividadeSelecionada.textoContexto || "";
        const imgC = document.getElementById('m-texto-img');
        if(atividadeSelecionada.fotoTextoContexto) {
            imgC.innerHTML = `<img src="${atividadeSelecionada.fotoTextoContexto}" style="display: block; margin: 0 auto 15px auto; max-width: 150px; width: 100%; border-radius: 8px;">`;
            imgC.style.display = 'block';
        } else imgC.style.display = 'none';
        modal.style.display = 'flex';
    };

    window.fecharTextoAtividade = () => document.getElementById('modal-texto-aluno').style.display = 'none';

    window.irParaQuestao = (idx) => {
        questaoAtualIndex = idx;
        const q = atividadeSelecionada.questoes[idx];
        let navHtml = `<button onclick="window.mostrarTextoAtividade()" class="g-btn-pill btn-olho-texto-nav"><i class="fa-solid fa-eye"></i></button>`;
        navHtml += atividadeSelecionada.questoes.map((_, i) => `
            <button onclick="window.irParaQuestao(${i})" class="g-btn-pill ${i === idx ? 'active' : ''} ${respostasAluno[i] ? 'respondida' : ''}">${i + 1}</button>
        `).join('');
        document.getElementById('nav-questoes').innerHTML = navHtml;

        const midiaHtml = q.imagem ? `<div class="col-foto-questao"><img src="${q.imagem}" class="img-questao-render"></div>` : '';

        document.getElementById('render-pergunta').innerHTML = `
            <div class="box-enunciado-render">
                <div class="texto-enunciado-render">${q.enunciado}</div>
            </div>
            <div class="container-questao-corpo ${q.imagem ? 'layout-com-foto' : 'layout-sem-foto'}">
                <div class="col-opcoes-questao">
                    <div class="opcoes-lista">
                        ${['A', 'B', 'C'].map(letra => {
                            let extra = '';
                            if (modoVisualizacao) {
                                if (letra === q.correta) extra = 'correta-view';
                                if (respostasAluno[idx] === letra && letra !== q.correta) extra = 'errada-view';
                            } else if (respostasAluno[idx] === letra) extra = 'selected';
                            return `
                                <div class="opcao-card ${extra}" onclick="${modoVisualizacao ? '' : `window.setResp(${idx}, '${letra}')`}">
                                    <div class="letra-indicador">${letra}</div>
                                    <div class="texto-opcao">${q.opcoes[letra]}</div>
                                </div>`;
                        }).join('')}
                    </div>
                </div>
                ${midiaHtml}
            </div>
            
            <div class="container-navegacao-setas">
                <button class="btn-seta-nav" onclick="window.questaoAnterior()" ${idx === 0 ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <button class="btn-seta-nav" onclick="window.proximaQuestao()" ${idx === atividadeSelecionada.questoes.length - 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>

            <div class="container-acoes-rodape">
                <div style="flex:1"></div>
                ${!modoVisualizacao && idx === atividadeSelecionada.questoes.length - 1 ? `
                    <button class="btn-acao-enviar" onclick="window.finalizarAtividade()">ENVIAR ATIVIDADE</button>
                ` : ''}
            </div>`;
    };

    window.questaoAnterior = () => { if(questaoAtualIndex > 0) window.irParaQuestao(questaoAtualIndex - 1); };
    window.proximaQuestao = () => { if(questaoAtualIndex < atividadeSelecionada.questoes.length - 1) window.irParaQuestao(questaoAtualIndex + 1); };

    window.revisarAtividade = (idResp) => {
        const atv = atividadesEnviadas.find(a => a.idResp === idResp);
        if(!atv || !atv.dadosOriginais) return;
        atividadeSelecionada = atv.dadosOriginais; respostasAluno = atv.respostas; modoVisualizacao = true;
        document.getElementById('main-view-aluno').style.display = 'none';
        document.getElementById('view-resolver').style.display = 'block';
        document.getElementById('header-atv-titulo').innerText = "Revisão";
        document.getElementById('cronometro-container').style.display = 'none';
        window.irParaQuestao(0);
    };

    window.setResp = (idx, letra) => { respostasAluno[idx] = letra; window.irParaQuestao(idx); };

    window.finalizarAtividade = () => {
        const respondidas = Object.keys(respostasAluno).length;
        const total = atividadeSelecionada.questoes.length;
        
        if (respondidas < total) {
            window.exibirAlertaMensagem("Atenção", `Você respondeu ${respondidas} de ${total} questões. Responda todas antes de enviar.`);
            return;
        }

        window.confirmarAcao("Deseja finalizar e enviar suas respostas?", enviarDadosFinais);
    };

    const enviarDadosFinais = async () => {
        if (intervaloCronometro) clearInterval(intervaloCronometro);
        const tempoSegundos = Math.floor((Date.now() - tempoInicio) / 1000);
        const tempoFormatado = window.formatarTempoExterno(tempoSegundos);
        
        let acertos = 0;
        atividadeSelecionada.questoes.forEach((q, i) => { 
            if(respostasAluno[i] === q.correta) acertos++; 
        });
        
        const notaFinal = ((acertos / atividadeSelecionada.questoes.length) * 10).toFixed(1);
        
        try {
            const loader = document.querySelector('.btn-acao-enviar');
            if(loader) {
                loader.disabled = true;
                loader.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ENVIANDO...';
            }

            await addDoc(collection(db, "respostas_alunos"), {
                alunoId: String(dadosTurmaAluno.alunoId).trim(),
                atividadeId: String(atividadeSelecionada.id).trim(),
                titulo: String(atividadeSelecionada.titulo || "Atividade de Gramática").trim(),
                tipo: "gramatica", 
                tipoAtividade: "gramatica",
                nota: notaFinal,
                tempoGasto: tempoSegundos, 
                semestre: dadosTurmaAluno.semestre,
                respostas: respostasAluno,
                dataEntrega: serverTimestamp()
            });

            document.getElementById('resultado-nota-valor').innerText = notaFinal;
            document.getElementById('resultado-tempo-valor').innerText = tempoFormatado;
            document.getElementById('modal-resultado-nota').style.display = 'flex';

        } catch (e) {
            console.error("Erro ao salvar respostas:", e);
            window.exibirAlertaMensagem("Erro", "Não conseguimos entregar sua atividade. Verifique sua conexão.");
            const loader = document.querySelector('.btn-acao-enviar');
            if(loader) {
                loader.disabled = false;
                loader.innerText = 'ENVIAR ATIVIDADE';
            }
        }
    };

    window.fecharEIrParaEnviadas = () => {
        document.getElementById('modal-resultado-nota').style.display = 'none';
        document.getElementById('view-resolver').style.display = 'none';
        document.getElementById('main-view-aluno').style.display = 'block';
        window.switchTabAluno('enviadas');
    };

    setTimeout(buscarDadosContexto, 300);

    return `
    <style>
        .gram-aluno-wrapper { padding: 12px; font-family: 'Inter', sans-serif; background: transparent; }
        .card-premium-list.expirada { opacity: 0.6; cursor: not-allowed !important; border-left-color: #cbd5e1; }
        .atv-titulo-list { margin:0; font-size:14px; color:#003058; font-weight:700; }
        .atv-sub-list { font-size:11px; color:#64748b; margin-top:5px; }
        
        .loader-container { display: flex; justify-content: center; padding: 40px; }
        .spinner-modern { width: 40px; height: 40px; border: 4px solid #f1f5f9; border-top: 4px solid #003058; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .pagination-container { display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 15px; }
        .btn-pag { background: #fff; border: 1px solid #cbd5e1; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; color: #003058; display: flex; align-items: center; justify-content: center; }
        .btn-pag:disabled { opacity: 0.5; cursor: not-allowed; }
        .pag-info { font-size: 13px; color: #003058; font-weight: 700; }

        .header-resolver-top { display:flex; align-items:center; background:#003058; padding:10px 15px; border-radius:12px; margin-bottom:12px; color:#fff; gap:15px; }
        .btn-voltar-topo { background: rgba(255,255,255,0.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .btn-voltar-topo:hover { background: rgba(255,255,255,0.25); }
        .header-resolver-titulo { font-size:14px; font-weight:700; flex:1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cronometro-box { font-size:12px; background:rgba(255,255,255,0.2); padding:5px 10px; border-radius:8px; font-weight: 700; }
        
        .box-enunciado-render { background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:15px; margin-bottom:12px; }
        .texto-enunciado-render { color:#1e293b; font-weight:600; font-size:14px; line-height:1.5; white-space:pre-wrap; }
        
        .container-questao-corpo { display:flex; gap:12px; }
        .col-opcoes-questao { flex:1.2; width:100%; }
        .col-foto-questao { flex:0.8; }
        .img-questao-render { width:100%; max-height:220px; border-radius:8px; object-fit:contain; border:1px solid #e2e8f0; background:#fff; }
        
        .opcoes-lista { display:flex; flex-direction:column; gap:8px; }
        .opcao-card { display:flex; align-items:center; padding:12px; background:#fff; border:2px solid #f1f5f9; border-radius:10px; cursor:pointer; font-size:13px; }
        .opcao-card.selected { border-color:#003058; background:#f0f7ff; }
        .opcao-card.correta-view { border-color:#003058; background:#f0f7ff; }
        .opcao-card.errada-view { border-color:#ef4444; background:#fef2f2; }
        .letra-indicador { font-weight:900; background:#f1f5f9; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-right:10px; font-size:11px; color:#003058; border:1px solid #e2e8f0; flex-shrink:0; }

        .nav-questoes-container { display:flex; gap:6px; margin-bottom:12px; overflow-x:auto; padding-bottom:5px; align-items: center; }
        .g-btn-pill { min-width:34px; height:34px; border-radius:8px; border:1px solid #e2e8f0; background:#fff; font-weight:700; cursor:pointer; }
        .g-btn-pill.active { background:#003058; color:#fff; }
        .g-btn-pill.respondida:not(.active) { background:#e2e8f0; }

        .container-navegacao-setas { display: flex; justify-content: center; align-items: center; gap: 40px; margin-top: 15px; }
        .btn-seta-nav { background: #fff; border: 1px solid #e2e8f0; width: 45px; height: 45px; border-radius: 50%; color: #003058; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .btn-seta-nav:disabled { opacity: 0.3; cursor: not-allowed; }

        .container-acoes-rodape { display:flex; justify-content:flex-end; margin-top:15px; }
        .btn-acao-enviar { background:#003058; color:#fff; border:none; height:46px; border-radius:12px; font-weight:700; cursor:pointer; padding: 0 25px; box-shadow: 0 4px 6px rgba(0,48,88,0.2); }

        .modal-aluno { position:fixed; inset:0; background:rgba(0,48,88,0.4); backdrop-filter: blur(6px); display:none; align-items:center; justify-content:center; padding:20px; z-index:9999; }
        .modal-content-aluno { background:#fff; width:100%; max-width:380px; border-radius:24px; padding:30px; text-align:center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
        .tab-btn-aluno { padding:10px 15px; border:none; background:none; font-weight:700; color:#94a3b8; cursor:pointer; }
        .tab-btn-aluno.active { color:#003058; border-bottom:3px solid #003058; }
       .card-premium-list.enviada {
        background: #fff; padding: 15px; border-radius: 12px; margin-bottom: 10px; display: flex; align-items: center; border-left: 5px solid #003058;box-shadow: 0 2px 5px rgba(0,0,0,0.05);}
        .btn-olho-revisao {background: #f1f5f9; border: none; width: 38px; height: 38px;border-radius: 10px;color: #003058;cursor: pointer;display: flex;align-items: center;justify-content: center; transition: 0.2s;}
        .btn-olho-revisao:hover {background: #e2e8f0;}
        .nota-badge-circular {width: 38px; height: 38px; border-radius: 50%;background: #003058;color: #fff;display: flex;align-items: center;justify-content: center;font-size: 13px;font-weight: 900;box-shadow: 0 2px 4px rgba(0,48,88,0.2);}

        .resultado-score-circle { width: 100px; height: 100px; border-radius: 50%; background: #f0f7ff; border: 5px solid #003058; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto 20px auto; }
        .score-num { font-size: 32px; font-weight: 900; color: #003058; line-height: 1; }
        .score-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; }

        @media (max-width: 600px) { 
            .container-questao-corpo.layout-com-foto { flex-direction: column-reverse; } 
            .btn-acao-enviar { width: 100%; }
        }
    </style>

    <div class="gram-aluno-wrapper">
        <div id="modal-confirmacao-moderno" class="modal-aluno" style="z-index: 10000;">
            <div class="modal-content-aluno">
                <div style="font-size:35px; color:#003058; margin-bottom:15px;"><i class="fa-solid fa-circle-question"></i></div>
                <h2 style="color:#003058; font-size:18px; margin-bottom:10px; font-weight:800;">Confirmação</h2>
                <p id="confirm-msg" style="color:#64748b; font-size:14px; margin-bottom:25px; line-height:1.5;"></p>
                <div style="display:flex; gap:10px;">
                    <button onclick="document.getElementById('modal-confirmacao-moderno').style.display='none'" style="flex:1; background:#f1f5f9; color:#64748b; border:none; height:46px; border-radius:12px; font-weight:700; cursor:pointer;">CANCELAR</button>
                    <button onclick="window.confirmCallback()" style="flex:1; background:#003058; color:#fff; border:none; height:46px; border-radius:12px; font-weight:700; cursor:pointer;">CONFIRMAR</button>
                </div>
            </div>
        </div>

        <div id="modal-alerta-simples" class="modal-aluno" style="z-index: 10001;">
            <div class="modal-content-aluno">
                <div style="font-size:35px; color:#003058; margin-bottom:15px;"><i class="fa-solid fa-circle-exclamation"></i></div>
                <h2 id="alerta-titulo" style="color:#003058; font-size:18px; margin-bottom:10px; font-weight:800;">Aviso</h2>
                <p id="alerta-msg" style="color:#64748b; font-size:14px; margin-bottom:25px; line-height:1.5;"></p>
                <button onclick="document.getElementById('modal-alerta-simples').style.display='none'" style="width:100%; background:#003058; color:#fff; border:none; height:46px; border-radius:12px; font-weight:700; cursor:pointer;">ENTENDI</button>
            </div>
        </div>

        <div id="modal-resultado-nota" class="modal-aluno" style="z-index: 10002;">
            <div class="modal-content-aluno">
                <div style="font-size:40px; color:#003058; margin-bottom:10px;"><i class="fa-solid fa-trophy"></i></div>
                <h2 style="color:#003058; font-size:22px; margin-bottom:5px; font-weight:800;">Atividade Concluída!</h2>
                <p style="color:#64748b; font-size:13px; margin-bottom:20px;">Suas respostas foram enviadas com sucesso.</p>
                
                <div class="resultado-score-circle">
                    <span class="score-num" id="resultado-nota-valor">0.0</span>
                    <span class="score-label">Sua Nota</span>
                </div>

                <div style="background:#f8fafc; padding:10px; border-radius:12px; margin-bottom:25px;">
                    <span style="color:#64748b; font-size:12px;">Tempo de resolução: </span>
                    <strong style="color:#003058; font-size:12px;" id="resultado-tempo-valor">00:00</strong>
                </div>

                <button onclick="window.fecharEIrParaEnviadas()" style="width:100%; background:#003058; color:#fff; border:none; height:50px; border-radius:15px; font-weight:700; cursor:pointer; font-size:15px;">VER MEU HISTÓRICO</button>
            </div>
        </div>

        <div id="modal-aviso-cronometro" class="modal-aluno">
            <div class="modal-content-aluno">
                <div style="font-size:35px; color:#003058; margin-bottom:15px;"><i class="fa-solid fa-stopwatch"></i></div>
                <h2 style="color:#003058; font-size:20px; margin-bottom:10px; font-weight:800;">Tudo pronto?</h2>
                <p style="color:#64748b; font-size:14px; margin-bottom:25px; line-height:1.5;">Ao iniciar, seu tempo de resolução será contabilizado para o professor.</p>
                <button class="btn-acao-enviar" style="width:100%;" onclick="window.começarDeVez()">INICIAR ATIVIDADE</button>
                <button onclick="document.getElementById('modal-aviso-cronometro').style.display='none'" style="background:none; border:none; color:#94a3b8; margin-top:15px; font-weight:600; cursor:pointer;">Agora não</button>
            </div>
        </div>

        <div id="modal-texto-aluno" class="modal-aluno" onclick="if(event.target===this) window.fecharTextoAtividade()">
            <div class="modal-content-aluno" style="max-height:85vh; overflow-y:auto; text-align:left; max-width:550px;">
                <h3 id="m-texto-titulo" style="color:#003058; margin-bottom:15px; text-align: center;"></h3>
                <div id="m-texto-img"></div>
                <div id="m-texto-body" style="font-size:14px; line-height:1.6; color:#475569; white-space:pre-wrap;"></div>
                <button class="btn-acao-enviar" style="width:100%; margin-top:20px; background:#f1f5f9; color:#003058; border: 1px solid #cbd5e1; box-shadow:none;" onclick="window.fecharTextoAtividade()">VOLTAR À QUESTÃO</button>
            </div>
        </div>

        <div id="main-view-aluno">
            <h1 style="color:#003058; font-size:24px; font-weight:900; margin-bottom: 2px;">Gramática</h1>
            <p style="color:#94a3b8; font-size:14px; margin-bottom: 20px;">Pratique seus conhecimentos gramaticais</p>
            <div style="display:flex; border-bottom:1px solid #e2e8f0; margin-bottom:15px;">
                <button id="btn-tab-recebidas" class="tab-btn-aluno" onclick="window.switchTabAluno('recebidas')">Recebidas</button>
                <button id="btn-tab-enviadas" class="tab-btn-aluno" onclick="window.switchTabAluno('enviadas')">Enviadas</button>
            </div>
            <div id="pane-recebidas"><div id="lista-recebidas"></div></div>
            <div id="pane-enviadas" style="display:none;"><div id="lista-enviadas"></div></div>
        </div>

        <div id="view-resolver" style="display:none;">
            <div class="header-resolver-top">
                <button class="btn-voltar-topo" onclick="window.voltarParaLista()"><i class="fa-solid fa-arrow-left"></i></button>
                <div id="header-atv-titulo" class="header-resolver-titulo"></div>
                <div class="cronometro-box" id="cronometro-container"><span id="tempo-cronometro">00:00</span></div>
            </div>
            <div id="nav-questoes" class="nav-questoes-container"></div>
            <div id="render-pergunta"></div>
        </div>
    </div>`;
});
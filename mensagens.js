window.Router.register('mensagens', async () => {
    let todasAsMensagens = [];
    let paginaAtual = 1;
    const mensagensPorPagina = 5; 
    // Verifica se deve iniciar na aba enviadas
    let filtroAtual = localStorage.getItem('filtro_inicial_mensagens') || 'recebidas';
    localStorage.removeItem('filtro_inicial_mensagens');

    // Função global para ser chamada pela Home
    window.alternarAbasMensagens = (tipo) => {
        window.setFiltroMensagem(tipo);
    };

    // --- FUNÇÕES DE INTERFACE ---

   window.mostrarFeedback = (mensagem, tipo = 'sucesso') => {
    const existente = document.getElementById('feedback-sistema');
    if (existente) existente.remove();

    const corPill = tipo === 'sucesso' ? "#003058" : "#dc2626";
    const icone = tipo === 'sucesso' ? 'fa-circle-check' : 'fa-circle-exclamation';

    const html = `
        <div id="feedback-sistema" style="position:fixed; top:20px; right:20px; z-index:99999; pointer-events:none;">
            <div style="background:white; padding:8px 20px; border-radius:10px; box-shadow:0 10px 25px rgba(0,0,0,0.15); display:flex; align-items:center; gap:12px; border-left: 5px solid ${corPill}; animation: slideInSlim 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;">
                <i class="fa-solid ${icone}" style="color:${corPill}; font-size:1.1rem;"></i>
                <span style="font-size:0.85rem; font-weight:700; color:#0f172a; white-space:nowrap; text-transform:uppercase;">${mensagem}</span>
            </div>
            <style>
                @keyframes slideInSlim { from { transform: translateX(120%); opacity:0; } to { transform: translateX(0); opacity:1; } }
                @keyframes slideOutSlim { from { transform: translateX(0); opacity:1; } to { transform: translateX(120%); opacity:0; } }
            </style>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    setTimeout(() => {
        const el = document.getElementById('feedback-sistema');
        if (el) {
            const inner = el.querySelector('div');
            if (inner) inner.style.animation = 'slideOutSlim 0.4s forwards';
            setTimeout(() => el.remove(), 400);
        }
    }, 3000);
};

    window.abrirLeituraMensagem = async (titulo, conteudo, interlocutor, data, remetenteId, mensagemId, statusLida) => {
    const chatWindow = document.getElementById('chat-window');
    const controles = document.getElementById('paginacao-controles');
    const corApp = "#003058";

    if (filtroAtual === 'recebidas' && !statusLida) {
        try {
            await window.fsMethods.updateDoc(window.fsMethods.doc(window.db, "mensagens_diretas", mensagemId), {
                lida: true
            });
            if (typeof todasAsMensagens !== 'undefined') {
                const msgLocal = todasAsMensagens.find(m => m.id === mensagemId);
                if (msgLocal) msgLocal.lida = true;
            }
        } catch (e) {
            console.error("Erro ao atualizar status:", e);
        }
    }

    const exibirBotaoResposta = filtroAtual === 'recebidas';
    const exibirBotaoExcluir = true;

    if (controles) controles.style.visibility = 'hidden';
    chatWindow.style.padding = "0"; 

    const layoutMensagemAberta = `
        <div id="mensagem-expandida" style="display:flex; flex-direction:column; height:100%; animation: fadeIn 0.2s ease; background: white; border-radius: 20px; overflow: hidden;">
            <div style="padding: 20px 25px; border-bottom: 1px solid #f1f5f9; background: white; flex-shrink: 0;">
                <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom: 5px;">
                    <span style="font-size:0.65rem; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Assunto</span>
                    <span style="font-size:0.65rem; color:#94a3b8; font-weight:700; text-transform:uppercase;">${data}</span>
                </div>
                <h2 style="margin:0 0 12px 0; font-size:1.1rem; color:${corApp}; text-transform:uppercase; font-weight:800; letter-spacing:-0.5px;">${titulo}</h2>
                <div style="display:flex; align-items:center; background: #f8fafc; padding: 10px 15px; border-radius: 10px; border: 1px solid #f1f5f9;">
                    <span style="font-size:0.8rem; color:#64748b; font-weight:600; margin-right:8px;">${filtroAtual === 'recebidas' ? 'De:' : 'Para:'}</span>
                    <span style="font-size:0.8rem; color:${corApp}; font-weight:800;">${interlocutor}</span>
                </div>
            </div>
            <div class="no-scrollbar" style="flex:1; overflow-y:auto; padding:25px; color:#334155;">
                <div style="font-size:0.95rem; line-height:1.6; margin-bottom: 20px; min-height: 40px;">${conteudo}</div>
                <div id="area-resposta" style="display:none; border-top: 1px dashed #cbd5e1; padding-top: 20px; margin-top:10px;">
                    <textarea id="texto-resposta" autocomplete="off" placeholder="Escreva sua resposta..." style="width:100%; border-radius:12px; border:1px solid #cbd5e1; padding:15px; height:100px; resize:none; font-family:inherit; margin-bottom: 12px; outline:none; font-size:0.9rem;"></textarea>
                    <button onclick="window.enviarResposta('${remetenteId}', '${interlocutor}', '${titulo}')" style="width:100%; padding:15px; background:${corApp}; color:white; border:none; border-radius:12px; font-weight:800; font-size:0.8rem; text-transform:uppercase; cursor:pointer;">Enviar Resposta Agora</button>
                </div>
            </div>
            <div id="footer-acoes" style="padding:15px 25px; border-top: 1px solid #f1f5f9; display:flex; gap:10px; background:#f8fafc; flex-shrink: 0;">
                <button onclick="window.excluirMensagem('${mensagemId}')" style="flex:1; padding:12px; background:#fee2e2; color:#dc2626; border:none; border-radius:10px; cursor:pointer; font-weight:800; font-size:0.7rem; text-transform:uppercase;">Excluir</button>
                <button onclick="window.fecharLeitura()" style="flex:1; padding:12px; background:white; color:#64748b; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; font-weight:800; font-size:0.7rem; text-transform:uppercase;">Fechar</button>
                ${exibirBotaoResposta ? `<button id="btn-abrir-resposta" onclick="window.mostrarCaixaResposta()" style="flex:1; padding:12px; background:${corApp}; color:white; border:none; border-radius:10px; cursor:pointer; font-weight:800; font-size:0.7rem; text-transform:uppercase;">Responder</button>` : ''}
            </div>
        </div>
    `;
    chatWindow.innerHTML = layoutMensagemAberta;
};

    window.mostrarCaixaResposta = () => {
        const area = document.getElementById('area-resposta');
        const btnResponder = document.getElementById('btn-abrir-resposta');
        area.style.display = 'block';
        if(btnResponder) btnResponder.style.display = 'none';
        document.getElementById('texto-resposta').focus();
    };

    window.fecharLeitura = () => {
        const chatWindow = document.getElementById('chat-window');
        const controles = document.getElementById('paginacao-controles');
        if(chatWindow) chatWindow.style.padding = "20px";
        if (controles) controles.style.visibility = 'visible';
        window.renderizarPagina();
    };

    window.carregarChatAluno = async () => {
        const chatWindow = document.getElementById('chat-window');
        if (!chatWindow) return;
        
        chatWindow.innerHTML = `<div style="text-align:center; padding:50px;"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:2rem; color:#003058;"></i></div>`;
        
        try {
            const auth = window.authMethods.getAuth();
            const meuId = auth.currentUser.uid;
            
            const alunoDoc = await window.fsMethods.getDoc(window.fsMethods.doc(window.db, "usuarios", meuId));
            const meuDados = alunoDoc.data() || {};
            const codigoTurma = String(meuDados.turma || meuDados.codigoAcesso || "");

            const qMsgs = window.fsMethods.query(
                window.fsMethods.collection(window.db, "mensagens_diretas"), 
                window.fsMethods.orderBy("dataEnvio", "desc")
            );
            
            const snapMsgs = await window.fsMethods.getDocs(qMsgs);
            
            todasAsMensagens = snapMsgs.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    remetente: data.remetenteNome || data.remetente || "Usuário"
                };
            }).filter(msg => {
                const dId = String(msg.destinatarioId || "");
                const rId = String(msg.remetenteId || "");
                const pertenceAoUsuario = (dId === meuId || rId === meuId || dId === codigoTurma || dId === "Geral");

                if (!pertenceAoUsuario) return false;

                // Esconde se eu deletei (como remetente ou destinatário)
                if (rId === meuId && msg.excluidoRemetente) return false;
                if (dId === meuId && msg.excluidoDestinatario) return false;

                return true;
            });

            window.renderizarPagina();
        } catch (e) { 
            console.error("Erro ao carregar chat:", e);
            chatWindow.innerHTML = `<p style="text-align:center; color:#dc2626; padding:20px;">Erro ao carregar mensagens.</p>`; 
        }
    };

    // Inicialização
    setTimeout(() => {
        window.carregarChatAluno();
    }, 200);

    window.enviarResposta = async (destId, destNome, assuntoOriginal) => {
        const conteudo = document.getElementById('texto-resposta').value;
        if(!conteudo) return window.mostrarFeedback("Digite sua resposta.", "erro");
        try {
            const auth = window.authMethods.getAuth();
            const alunoSnap = await window.fsMethods.getDoc(window.fsMethods.doc(window.db, "usuarios", auth.currentUser.uid));
            const dadosAluno = alunoSnap.data();

            await window.fsMethods.addDoc(window.fsMethods.collection(window.db, "mensagens_diretas"), {
                titulo: "Re: " + assuntoOriginal,
                conteudo: conteudo,
                remetenteNome: `${dadosAluno.nome} (${dadosAluno.codigoAcesso || dadosAluno.turma})`,
                remetente: `${dadosAluno.nome} (${dadosAluno.codigoAcesso || dadosAluno.turma})`,
                remetenteId: auth.currentUser.uid,
                destinatarioId: destId,
                destinatarioNome: destNome,
                dataEnvio: new Date(),
                tipo: "direta_privada",
                lida: false,
                excluidoRemetente: false,
                excluidoDestinatario: false
            });
            window.mostrarFeedback("enviada");
            window.fecharLeitura();
            window.carregarChatAluno();
        } catch (e) { window.mostrarFeedback("Erro ao responder.", "erro"); }
    };

    window.renderizarPagina = () => {
        const chatWindow = document.getElementById('chat-window');
        const controles = document.getElementById('paginacao-controles');
        if (!chatWindow || !controles) return;

        const corApp = "#003058";
        chatWindow.style.padding = "20px";

        const auth = window.authMethods.getAuth();
        const meuId = auth.currentUser?.uid;

        const mensagensFiltradas = todasAsMensagens.filter(msg => 
            filtroAtual === 'recebidas' ? msg.remetenteId !== meuId : msg.remetenteId === meuId
        );

        const isMobile = window.innerWidth <= 768;
        const itensPorPagina = isMobile ? 5 : 7;
        const totalPaginas = Math.ceil(mensagensFiltradas.length / itensPorPagina);
        const mensagensExibidas = mensagensFiltradas.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);

        chatWindow.innerHTML = mensagensExibidas.length ? mensagensExibidas.map(msg => {
            const dataObj = msg.dataEnvio?.toDate() || new Date();
            const dataFormatada = dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const nomeExibicao = filtroAtual === 'recebidas' ? (msg.remetente) : (msg.destinatarioNome || "Destinatário");
            const tituloEscapado = (msg.titulo || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const conteudoEscapado = (msg.conteudo || '').replace(/`/g, "\\`").replace(/\n/g, "<br>");
            const classeStatus = (filtroAtual === 'recebidas' && !msg.lida) ? 'status-nova' : 'status-lida';

            return `
                <div class="card-mensagem-aluno ${classeStatus}" 
                     onclick="window.abrirLeituraMensagem('${tituloEscapado}', \`${conteudoEscapado}\`, '${nomeExibicao}', '${dataFormatada}', '${msg.remetenteId}', '${msg.id}', ${msg.lida})">
                    <span class="pill-tipo" style="flex: 0 0 80px; text-align: center; font-size: 0.6rem; font-weight: 900; padding: 4px 8px; border-radius: 6px; background: ${filtroAtual === 'recebidas' ? '#e0f2fe' : '#f1f5f9'}; color: ${filtroAtual === 'recebidas' ? '#0369a1' : '#64748b'}; text-transform: uppercase;">
                        ${filtroAtual === 'recebidas' ? 'RECEBIDA' : 'ENVIADA'}
                    </span>
                    <div style="flex: 1; display: flex; align-items: center; gap: 10px; overflow: hidden;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: #94a3b8; text-transform: uppercase;">${filtroAtual === 'recebidas' ? 'DE:' : 'PARA:'}</span>
                        <span class="nome-aluno-texto" style="font-size: 0.9rem; font-weight: 700; color: #334155;">${nomeExibicao}</span>
                        <span style="color: #cbd5e1;">|</span>
                        <h4 style="margin: 0; font-size: 0.9rem; color: ${corApp}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">${msg.titulo || 'SEM ASSUNTO'}</h4>
                    </div>
                    <div style="flex: 0 0 100px; text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 5px;">
                        ${(filtroAtual === 'recebidas' && !msg.lida) ? `<i class="fa-solid fa-circle" style="font-size:0.4rem; color:${corApp};"></i>` : ''}
                        <span class="data-card" style="font-size: 0.75rem; font-weight: 600; color: #94a3b8; white-space: nowrap;">${dataFormatada}</span>
                    </div>
                </div>`;
        }).join('') : `<p style="text-align:center; padding:40px; color:#94a3b8;">Nenhuma mensagem nesta aba.</p>`;

        let botoesHTML = '';
        if (totalPaginas > 1) {
            for (let i = 1; i <= totalPaginas; i++) {
                botoesHTML += `<button class="pagination-item ${i === paginaAtual ? 'active' : ''}" onclick="window.setPaginaDireta(${i})">${i}</button>`;
            }
        }
        controles.innerHTML = botoesHTML;
    };

    window.renderizarPagina = () => {
    const chatWindow = document.getElementById('chat-window');
    const controles = document.getElementById('paginacao-controles');
    if (!chatWindow) return;

    const corApp = "#003058";
    chatWindow.style.padding = "20px";

    const auth = window.authMethods.getAuth();
    const meuId = auth.currentUser.uid;

    // Ajuste da lógica de filtro:
    const mensagensFiltradas = todasAsMensagens.filter(msg => {
        if (filtroAtual === 'recebidas') {
            // Sou o destinatário e não fui eu quem mandou
            return msg.remetenteId !== meuId;
        } else {
            // Sou o remetente
            return msg.remetenteId === meuId;
        }
    });

    const isMobile = window.innerWidth <= 768;
    const itensPorPagina = isMobile ? 5 : 7;
    const totalPaginas = Math.ceil(mensagensFiltradas.length / itensPorPagina);
    const mensagensExibidas = mensagensFiltradas.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);

    chatWindow.innerHTML = mensagensExibidas.length ? mensagensExibidas.map(msg => {
        const dataObj = msg.dataEnvio?.toDate() || new Date();
        const dataFormatada = dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        
        const nomeExibicao = filtroAtual === 'recebidas'
            ? (msg.remetenteTipo === "professor" ? `Professor ${msg.remetente}` : msg.remetente)
            : (msg.destinatarioNome || "Destinatário");

        const tituloEscapado = (msg.titulo || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const conteudoEscapado = (msg.conteudo || '').replace(/`/g, "\\`").replace(/\n/g, "<br>");
        const classeStatus = (filtroAtual === 'recebidas' && !msg.lida) ? 'status-nova' : 'status-lida';

        return `
            <div class="card-mensagem-aluno ${classeStatus}" 
                 onclick="window.abrirLeituraMensagem('${tituloEscapado}', \`${conteudoEscapado}\`, '${nomeExibicao}', '${dataFormatada}', '${msg.remetenteId}', '${msg.id}', ${msg.lida})"
                 style="display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 0 20px; height: 50px; border-radius: 12px; cursor: pointer; border: 1px solid #f1f5f9; border-left: 6px solid ${corApp}; margin-bottom: 8px;">
                <span class="pill-tipo" style="flex: 0 0 80px; text-align: center;">${filtroAtual === 'recebidas' ? 'RECEBIDA' : 'ENVIADA'}</span>
                <div style="flex: 1; display: flex; align-items: center; gap: 10px; overflow: hidden;">
                    <span style="font-size: 0.75rem; font-weight: 800; color: #94a3b8; text-transform: uppercase;">${filtroAtual === 'recebidas' ? 'DE:' : 'PARA:'}</span>
                    <span style="font-size: 0.9rem; font-weight: 700; color: #334155;">${nomeExibicao}</span>
                    <span style="color: #cbd5e1;">|</span>
                    <h4 style="margin: 0; font-size: 0.9rem; color: ${corApp}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">${msg.titulo || 'SEM ASSUNTO'}</h4>
                </div>
                <div style="flex: 0 0 100px; text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 5px;">
                    ${(filtroAtual === 'recebidas' && !msg.lida) ? `<i class="fa-solid fa-circle" style="font-size:0.4rem; color:${corApp};"></i>` : ''}
                    <span class="data-card" style="white-space: nowrap;">${dataFormatada}</span>
                </div>
            </div>`;
    }).join('') : `<p style="text-align:center; padding:40px; color:#94a3b8;">Nenhuma mensagem nesta aba.</p>`;

    let botoesPagina = '';
    if (totalPaginas > 1) {
        for (let i = 1; i <= totalPaginas; i++) {
            const isAtiva = i === paginaAtual;
            botoesPagina += `
                <button onclick="window.setPaginaDireta(${i})" 
                    style="padding: 8px 12px; border-radius: 8px; border: 1px solid ${isAtiva ? corApp : '#e2e8f0'}; 
                    background: ${isAtiva ? corApp : 'white'}; color: ${isAtiva ? 'white' : '#64748b'}; 
                    font-weight: 800; cursor: pointer; transition: 0.2s;">
                    ${i}
                </button>`;
        }
    }
    controles.innerHTML = botoesPagina ? `<div style="display:flex; justify-content:center; gap:5px; padding:15px;">${botoesPagina}</div>` : '';
};

    window.mudarPaginaMensagem = (dir) => { paginaAtual += dir; window.renderizarPagina(); };
    window.setPaginaDireta = (num) => { paginaAtual = num; window.renderizarPagina(); };
    window.setFiltroMensagem = (tipo) => {
        filtroAtual = tipo;
        paginaAtual = 1;
        window.renderizarPagina();
        document.querySelectorAll('.pill-filtro').forEach(p => p.classList.toggle('pill-active', p.dataset.tipo === tipo));
    };



    window.excluirMensagem = (mensagemId) => {
        const corApp = "#003058";
        const modalConfirmHtml = `
            <div id="modal-confirm-excluir" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.7); backdrop-filter:blur(8px); z-index:20000; display:flex; justify-content:center; align-items:center;">
                <div style="background:white; padding:35px; border-radius:30px; width:90%; max-width:400px; text-align:center;">
                    <h3 style="color:${corApp}; font-weight:900; margin-bottom:10px; text-transform:uppercase;">Excluir Mensagem?</h3>
                    <div style="display:flex; gap:12px; margin-top:20px;">
                        <button onclick="document.getElementById('modal-confirm-excluir').remove()" style="flex:1; padding:14px; border-radius:15px; cursor:pointer; border:1px solid #e2e8f0; background:white;">Cancelar</button>
                        <button onclick="window.confirmarExclusaoFinal('${mensagemId}')" style="flex:1; padding:14px; border-radius:15px; cursor:pointer; background:#dc2626; color:white; border:none; font-weight:800;">Sim, Excluir</button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalConfirmHtml);
    };

    window.confirmarExclusaoFinal = async (mensagemId) => {
        const modal = document.getElementById('modal-confirm-excluir');
        if (modal) modal.remove();
        
        try {
            const auth = window.authMethods.getAuth();
            const meuId = String(auth.currentUser.uid);
            const msgRef = window.fsMethods.doc(window.db, "mensagens_diretas", mensagemId);
            const msgSnap = await window.fsMethods.getDoc(msgRef);

            if (msgSnap.exists()) {
                const dados = msgSnap.data();
                const rId = String(dados.remetenteId || "");

                if (rId === meuId) {
                    await window.fsMethods.updateDoc(msgRef, { excluidoRemetente: true });
                } else {
                    await window.fsMethods.updateDoc(msgRef, { excluidoDestinatario: true });
                }
            }

            window.mostrarFeedback("Mensagem excluída!");
            window.fecharLeitura();
            await window.carregarChatAluno();
        } catch (e) { 
            console.error(e);
            window.mostrarFeedback("Erro ao excluir.", "erro"); 
        }
    };

    window.processarEnvioNovaMensagem = async () => {
    const campoDestinatario = document.getElementById('novo-destinatario');
    const campoAssunto = document.getElementById('novo-assunto');
    const campoConteudo = document.getElementById('novo-conteudo');
    const modal = document.getElementById('modal-novo');

    const destId = campoDestinatario.value;
    const assunto = campoAssunto.value;
    const conteudo = campoConteudo.value;
    const nomeDest = campoDestinatario.options[campoDestinatario.selectedIndex]?.text;

    if (!destId || destId === "" || campoDestinatario.disabled) {
        window.mostrarFeedback("Selecione um aluno.", "erro");
        return;
    }
    if (!assunto.trim() || !conteudo.trim()) {
        window.mostrarFeedback("Preencha todos os campos.", "erro");
        return;
    }

    try {
        const auth = window.authMethods.getAuth();
        const profSnap = await window.fsMethods.getDoc(window.fsMethods.doc(window.db, "usuarios", auth.currentUser.uid));
        const dadosProf = profSnap.data();
        
        await window.fsMethods.addDoc(window.fsMethods.collection(window.db, "mensagens_diretas"), {
            titulo: assunto.toUpperCase(),
            conteudo: conteudo,
            remetenteNome: "Professor " + dadosProf.nome,
            remetenteId: auth.currentUser.uid,
            remetenteTipo: "professor",
            destinatarioId: destId,
            destinatarioNome: nomeDest,
            dataEnvio: new Date(),
            tipo: "direta_privada",
            lida: false
        });

        if (modal) modal.remove();
        window.mostrarFeedback("Mensagem enviada");
        
        if (typeof window.carregarChatAluno === 'function') {
            window.carregarChatAluno();
        }
    } catch (e) { 
        console.error("Erro ao enviar:", e);
        window.mostrarFeedback("Erro ao gravar no banco de dados.", "erro"); 
    }
};

window.atualizarListaAlunosNovo = async (senhaTurma) => {
    const selectDest = document.getElementById('novo-destinatario');
    if (!senhaTurma) {
        selectDest.innerHTML = '<option value="">Aguardando turma</option>';
        selectDest.disabled = true;
        return;
    }
    try {
        const q = window.fsMethods.query(window.fsMethods.collection(window.db, "usuarios"), window.fsMethods.where("status", "==", "aprovado"));
        const snap = await window.fsMethods.getDocs(q);
        const alunosDaTurma = snap.docs.filter(doc => {
            const d = doc.data();
            return (d.codigoAcesso || d.turma || "").toString().trim() === senhaTurma.toString().trim();
        });
        
        let options = alunosDaTurma.length ? '<option value="">Selecione o aluno</option>' : '<option value="">Nenhum aluno nesta turma</option>';
        alunosDaTurma.forEach(doc => { 
            options += `<option value="${doc.id}" data-nome="${doc.data().nome}">${doc.data().nome}</option>`; 
        });
        selectDest.innerHTML = options;
        selectDest.disabled = alunosDaTurma.length === 0;
    } catch (e) { console.error(e); }
};

window.abrirModalNovoMensagem = async () => {
    const corBotao = "#003058"; 
    try {
        const auth = window.authMethods.getAuth();
        const qTurmas = window.fsMethods.query(
            window.fsMethods.collection(window.db, "turmas"), 
            window.fsMethods.where("professorResponsavelId", "==", auth.currentUser.uid)
        );
        const snapTurmas = await window.fsMethods.getDocs(qTurmas);
        let opcoesTurmas = snapTurmas.docs.map(doc => {
            const d = doc.data();
            return `<option value="${d.senha}">${d.nomeCustomizado || d.nome || d.senha}</option>`;
        }).join('');
        
        const modalNovoHTML = `
          <div id="modal-novo" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.75); display:flex; justify-content:center; align-items:center; z-index:9999; backdrop-filter: blur(6px);">
            <div style="background:white; border-radius:20px; max-width:500px; width:90%; overflow:hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.2);">
              <div style="padding:20px; background:${corBotao}; color:white; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:1rem; text-transform:uppercase; font-weight:800;">Nova Mensagem</h3>
                <button onclick="document.getElementById('modal-novo').remove()" style="background:none; border:none; color:white; cursor:pointer; font-size:1.5rem; line-height:1;">&times;</button>
              </div>
              <div style="padding:25px; display:flex; flex-direction:column; gap:15px;">
                <label style="font-size:0.75rem; font-weight:700; color:#64748b; margin-bottom:-10px;">PARA QUAL TURMA?</label>
                <select id="nova-turma-msg" onchange="window.atualizarListaAlunosNovo(this.value)" style="padding:12px; border-radius:10px; border:1px solid #e2e8f0; width:100%; background:#f8fafc;">
                    <option value="">Selecione a turma</option>
                    ${opcoesTurmas}
                </select>
                <label style="font-size:0.75rem; font-weight:700; color:#64748b; margin-bottom:-10px;">PARA QUAL ALUNO?</label>
                <select id="novo-destinatario" disabled style="padding:12px; border-radius:10px; border:1px solid #e2e8f0; width:100%; background:#f8fafc;">
                    <option value="">Aguardando turma</option>
                </select>
                <input type="text" id="novo-assunto" placeholder="Assunto da mensagem" autocomplete="off" style="padding:12px; border-radius:10px; border:1px solid #e2e8f0; width:100%; box-sizing:border-box;">
                <textarea id="novo-conteudo" placeholder="Escreva sua mensagem aqui..." autocomplete="off" style="padding:12px; border-radius:10px; border:1px solid #e2e8f0; min-height:120px; font-family:inherit; width:100%; box-sizing:border-box; resize:none;"></textarea>
                <button onclick="window.processarEnvioNovaMensagem()" style="padding:15px; background:${corBotao}; color:white; border:none; border-radius:12px; font-weight:800; cursor:pointer; text-transform:uppercase; margin-top:10px;">Enviar Mensagem</button>
              </div>
            </div>
          </div>`;
        document.body.insertAdjacentHTML('beforeend', modalNovoHTML);
    } catch (e) { 
        console.error(e);
        if(typeof window.mostrarFeedback === 'function') window.mostrarFeedback("Erro ao carregar o formulário.", "erro"); 
    }
};
    const htmlPrincipal = `
    <style>
    /* Scrollbars e Animações */
    #chat-window::-webkit-scrollbar, .sidebar-canais::-webkit-scrollbar, #mensagem-expandida div::-webkit-scrollbar, .no-scrollbar::-webkit-scrollbar { display: none; }
    #chat-window, .sidebar-canais, #mensagem-expandida div, .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    @keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { to { transform: translateX(120%); opacity: 0; } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* Layout Principal */
    .UPPERCASE-TITLE { font-size: 1.8rem; color: #003058; font-weight: 800; margin-bottom: 5px; text-transform: uppercase; letter-spacing: -1px; }
    .container-mensagens { display: grid; grid-template-columns: 280px 1fr; gap: 20px; width: 100%; min-height: 522px; }
    .sidebar-canais { background: #f8fafc; border-radius: 20px; padding: 20px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 10px; }
    .chat-principal { background: white; border-radius: 20px; border: 1px solid #f1f5f9; box-shadow: 0 10px 25px rgba(0,0,0,0.04); display: flex; flex-direction: column; overflow: hidden; position: relative; min-height: 400px; }

    /* Elementos de Interface */
    .btn-escrever { background: #003058; color: white; padding: 15px; border-radius: 12px; border: none; font-weight: 800; text-transform: uppercase; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 10px; transition: 0.3s; }
    .pill-filtro { display: flex; align-items: center; gap: 12px; padding: 12px 15px; border-radius: 12px; cursor: pointer; transition: 0.2s; color: #64748b; font-weight: 600; }
    .pill-active { background: white; border-color: #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.08); color: #003058; font-weight: 800; }

    /* Cards de Mensagem Desktop */
    .card-mensagem-aluno { height: 50px; border-radius: 12px; cursor: pointer; transition: 0.2s; border: 1px solid #f1f5f9; border-left: 6px solid #003058; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 8px; display: flex; align-items: center; box-sizing: border-box; overflow: hidden; background: white; padding: 0 20px !important; }
    .status-nova { background: #f0f7ff !important; }
    .status-lida { background: white !important; }

    /* Paginação Quadrada */
    #paginacao-controles { display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 15px; padding: 10px; border-top: 1px solid #f1f5f9; flex-wrap: wrap; background: white; }
    .pagination-item { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 10px; border: 1px solid #e2e8f0; background: white; color: #003058; font-weight: 800; font-size: 14px; cursor: pointer; transition: 0.2s; }
    .pagination-item.active { background: #003058; color: white; border-color: #003058; }

    /* Responsividade */
    @media (min-width: 769px) {
        #paginacao-controles { margin-top: 6px; } 
    }

    @media (max-width: 768px) {
        .container-mensagens { grid-template-columns: 1fr; height: auto; }
        /* Container das abas mobile */
            .sidebar-canais { 
                flex-direction: row !important; 
                padding: 0 !important; 
                background: transparent !important; 
                border: none !important; 
                border-bottom: 1px solid #e2e8f0 !important; 
                border-radius: 0 !important;
                gap: 0 !important;
                overflow-x: auto;
                scrollbar-width: none;
            }

            /* Estilo base das abas (Texto) */
            .btn-escrever, .pill-filtro { 
                background: transparent !important; 
                color: #64748b !important; 
                border: none !important; 
                border-radius: 0 !important; 
                margin: 0 !important; 
                padding: 15px 20px !important; 
                font-size: 0.8rem !important; 
                font-weight: 800 !important; 
                text-transform: uppercase !important; 
                flex: 1;
                text-align: center;
                box-shadow: none !important;
                position: relative;
                white-space: nowrap;
            }

            /* Aba Ativa: Linha azul inferior grossa */
            .pill-active, .btn-escrever:active { 
                color: #003058 !important; 
            }

            .pill-active::after, .btn-escrever:active::after {
                content: "";
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                height: 4px;
                background: #003058;
            }

            .pill-active::after {
                content: "";
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                height: 4px;
                background: #003058;
            }

            /* Remove ícones no mobile para focar no texto das abas */
            .sidebar-canais i { display: none !important; }
        .UPPERCASE-TITLE { font-size: 1.4rem; }

        .card-mensagem-aluno { height: 55px !important; padding: 0 12px !important; gap: 8px !important; }
        
        /* Esconde a pill RECEBIDA/ENVIADA e o Assunto (h4) no mobile para dar espaço */
        .card-mensagem-aluno .pill-tipo, 
        .card-mensagem-aluno h4,
        .card-mensagem-aluno div span:nth-child(3) { display: none !important; }

        /* Container do Nome e Rótulo (DE/PARA) */
        .card-mensagem-aluno div:nth-child(2) { 
            display: flex !important; 
            flex: 1 !important; 
            align-items: center !important; 
            gap: 5px !important; 
            overflow: hidden !important;
        }

        /* Garante que o DE: ou PARA: apareça */
        .card-mensagem-aluno div span:first-child { 
            display: inline-block !important; 
            font-size: 0.7rem !important; 
            font-weight: 800 !important; 
            color: #94a3b8 !important; 
            flex-shrink: 0 !important;
        }

        .nome-aluno-texto { 
            font-size: 0.85rem !important; 
            font-weight: 700 !important; 
            color: #334155 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            max-width: 150px !important;
        }

        /* Container da Data */
        .card-mensagem-aluno div:last-child { 
            margin-left: auto !important; 
            flex: 0 0 auto !important; 
        }

        .data-card { font-size: 0.7rem !important; color: #94a3b8 !important; white-space: nowrap !important; }
    }
</style>
    <div class="cabecalho-secao">
        <h1 class="UPPERCASE-TITLE">Mensagens</h1>
        <p style="color: #64748b; margin-bottom: 20px;">Mensagens privadas e avisos da turma.</p>
    </div>
    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 25px;">
    <div class="container-mensagens">
        <div class="sidebar-canais">
            <button class="btn-escrever" onclick="window.abrirModalNovoMensagem()">Escrever</button>
            <div class="pill-filtro ${filtroAtual === 'recebidas' ? 'pill-active' : ''}" data-tipo="recebidas" onclick="window.setFiltroMensagem('recebidas')">Recebidas</div>
            <div class="pill-filtro ${filtroAtual === 'enviadas' ? 'pill-active' : ''}" data-tipo="enviadas" onclick="window.setFiltroMensagem('enviadas')">Enviadas</div>
        </div>
        <div class="chat-principal">
            <div id="chat-window"></div>
            <div id="paginacao-controles"></div>
        </div>
    </div>
    `;

    setTimeout(() => {
        if (typeof window.carregarChatAluno === 'function') {
            window.carregarChatAluno();
        }
    }, 200);

    return htmlPrincipal;
});
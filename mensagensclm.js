window.Router.register('mensagensclm', async () => {
    // IMPORTAÇÕES DINÂMICAS
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
    const { getFirestore, doc, getDoc, addDoc, collection, query, where, getDocs, updateDoc, deleteDoc, orderBy } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

    const firebaseConfig = {
        apiKey: "AIzaSyDhbzne_klt9ba1B_I04JXykvpslX2aD0k",
        authDomain: "plata4form.firebaseapp.com",
        projectId: "plata4form",
        storageBucket: "plata4form.firebasestorage.app",
        messagingSenderId: "833502821958",
        appId: "1:833502821958:web:2d8899b12ca4bd97b01447"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    let todasAsMensagens = [];
    let mensagensCache = {}; 
    let filtroAtual = 'recebidas'; 
    let paginaAtual = 1;
    const mensagensPorPagina = 5; 
    const azulPadrao = "#003058";
    const azulClaro = "#004aad";

    window.mostrarFeedback = (mensagem, tipo = 'sucesso') => {
        const existente = document.getElementById('feedback-sistema');
        if (existente) existente.remove();
        const corPill = tipo === 'sucesso' ? azulClaro : '#dc2626';
        const html = `
            <div id="feedback-sistema" style="position:fixed; top:20px; right:20px; z-index:10005; animation: slideIn 0.4s forwards;">
                <div style="background:white; padding:15px 25px; border-radius:15px; box-shadow:0 15px 30px rgba(0,0,0,0.15); display:flex; align-items:center; gap:15px; border-left: 6px solid ${corPill};">
                    <i class="fa-solid ${tipo === 'sucesso' ? 'fa-circle-check' : 'fa-circle-exclamation'}" style="color:${corPill};"></i>
                    <p style="margin:0; font-size:0.95rem; font-weight:700; color:${azulPadrao};">${mensagem}</p>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        setTimeout(() => { document.getElementById('feedback-sistema')?.remove(); }, 3000);
    };

    window.abrirMensagemPorId = async (id) => {
        const msg = mensagensCache[id];
        if (!msg) return;

        const container = document.getElementById('chat-principal-container');
        const user = auth.currentUser;

        if (msg.destinatarioId === user.uid && !msg.lida) {
            try {
                await updateDoc(doc(db, "mensagens_diretas", id), { lida: true });
                msg.lida = true;
            } catch (e) { console.error("Erro ao marcar lida:", e); }
        }

        const dataFormatada = msg.dataEnvio?.toDate().toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'2-digit'});
        const interlocutorBruto = msg.remetenteId === user.uid ? (msg.destinatarioNome || "Destinatário") : (msg.remetente || msg.remetenteNome || "Remetente");
const interlocutor = interlocutorBruto.split(' (')[0];

        container.innerHTML = `
            <div class="mensagem-expandida-view">
                <div class="header-expandida">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                        <div>
                            <span style="font-size:0.65rem; font-weight:800; color:#94a3b8; text-transform:uppercase;">Assunto</span>
                            <h2 style="margin:2px 0 10px 0; color:${azulPadrao}; font-size:1.1rem; text-transform:uppercase; font-weight:900;">${msg.titulo || 'SEM ASSUNTO'}</h2>
                        </div>
                        <span style="color:#94a3b8; font-size:0.7rem; font-weight:700;">${dataFormatada}</span>
                    </div>
                    <div style="background:#f8fafc; padding:12px 18px; border-radius:12px; border:1px solid #f1f5f9;">
                        <span style="color:#64748b; font-size:0.8rem; font-weight:600;">${msg.remetenteId === user.uid ? 'Para:' : 'De:'}</span>
                        <span style="font-weight:800; color:${azulPadrao}; font-size:0.85rem; margin-left:5px;">${interlocutor}</span>
                    </div>
                </div>

                <div class="conteudo-scroll">
                    <div id="corpo-texto-msg">
                        ${(msg.conteudo || '').replace(/\n/g, '<br>')}
                    </div>

                    <div id="container-resposta-interna" style="display:none; margin-top:25px; padding-top:20px; border-top:2px dashed #e2e8f0;">
                        <textarea id="texto-resposta-interna" autocomplete="off" placeholder="Escreva sua resposta..." style="width:100%; min-height:120px; border-radius:12px; border:1px solid #cbd5e1; padding:15px; font-family:inherit; resize:none; font-size:0.95rem;"></textarea>
                        <button onclick="window.enviarRespostaExpandida('${id}')" style="width:100%; background:${azulPadrao}; color:white; border:none; padding:15px; border-radius:12px; font-weight:800; margin-top:10px; cursor:pointer; text-transform:uppercase;">Enviar Resposta Agora</button>
                    </div>
                </div>

                <div class="footer-expandida">
                    <div style="display:flex; gap:10px; width:100%; justify-content: space-between;">
                        <button onclick="window.confirmarExclusaoDireta('${id}')" style="background:#fee2e2; color:#dc2626; border:none; padding:12px; flex:1; border-radius:12px; font-weight:800; cursor:pointer; font-size:0.7rem; text-transform:uppercase;">Excluir</button>
                        <button onclick="window.renderizarPagina()" style="background:#f1f5f9; color:#64748b; border:none; padding:12px; flex:1; border-radius:12px; font-weight:800; cursor:pointer; font-size:0.7rem; text-transform:uppercase;">Fechar</button>
                        <button id="btn-abrir-resposta" onclick="window.mostrarAreaResposta()" style="display: ${msg.remetenteId !== user.uid ? 'block' : 'none'}; background:${azulPadrao}; color:white; border:none; padding:12px; flex:1; border-radius:12px; font-weight:800; cursor:pointer; font-size:0.7rem; text-transform:uppercase;">Responder</button>
                    </div>
                </div>
            </div>
        `;
    };

    window.mostrarAreaResposta = () => {
        const area = document.getElementById('container-resposta-interna');
        if (area) {
            area.style.display = 'block';
            document.getElementById('btn-abrir-resposta').style.display = 'none';
            document.getElementById('texto-resposta-interna').focus();
        }
    };

    window.enviarRespostaExpandida = async (idOriginal) => {
        const msgOriginal = mensagensCache[idOriginal];
        const textoArea = document.getElementById('texto-resposta-interna');
        const texto = textoArea.value.trim();
        if(!texto) return window.mostrarFeedback("Digite uma mensagem", "erro");
        try {
            const user = auth.currentUser;
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            const d = userDoc.data();
            
            const nomeRemetente = d.perfil === 'Professor' ? "Prof. " + d.nome : d.nome;
            const tipoRemetente = d.perfil === 'Professor' ? "professor" : "aluno";

            await addDoc(collection(db, "mensagens_diretas"), {
                titulo: "Re: " + (msgOriginal.titulo || "Sem Assunto"),
                conteudo: texto,
                remetente: nomeRemetente,
                remetenteNome: nomeRemetente,
                remetenteId: user.uid,
                remetenteTipo: tipoRemetente,
                destinatarioId: msgOriginal.remetenteId,
                destinatarioNome: msgOriginal.remetenteNome || msgOriginal.remetente,
                dataEnvio: new Date(),
                tipo: "direta_privada",
                lida: false
            });
            window.mostrarFeedback("enviada!");
            window.carregarChatAluno(); 
        } catch (e) { 
            console.error(e);
            window.mostrarFeedback("Erro ao enviar", "erro"); 
        }
    };

    window.confirmarExclusaoDireta = (id) => {
        const modalHtml = `
            <div id="modal-confirm-exclusao" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.7); backdrop-filter:blur(8px); z-index:20000; display:flex; justify-content:center; align-items:center;">
                <div style="background:white; padding:35px; border-radius:30px; width:90%; max-width:400px; text-align:center;">
                    <h3 style="color:${azulPadrao}; font-weight:900; margin-bottom:10px; text-transform:uppercase;">Excluir?</h3>
                    <div style="display:flex; gap:12px;">
                        <button onclick="document.getElementById('modal-confirm-exclusao').remove()" style="flex:1; padding:14px; border-radius:15px; font-weight:800; cursor:pointer; background:#f1f5f9; color:#64748b;">CANCELAR</button>
                        <button onclick="window.executarExclusao('${id}')" style="flex:1; padding:14px; border-radius:15px; font-weight:800; cursor:pointer; background:#dc2626; color:white;">EXCLUIR</button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    window.executarExclusao = async (id) => {
        const modal = document.getElementById('modal-confirm-exclusao');
        if (modal) modal.remove();
        
        try {
            const user = auth.currentUser;
            const msgRef = doc(db, "mensagens_diretas", id);
            const msgSnap = await getDoc(msgRef);

            if (msgSnap.exists()) {
                const dados = msgSnap.data();
                const meuId = user.uid;

                if (dados.remetenteId === meuId) {
                    await updateDoc(msgRef, { 
                        excluidoRemetente: true 
                    });
                } else {
                    await updateDoc(msgRef, { 
                        excluidoDestinatario: true 
                    });
                }
            }

            window.mostrarFeedback("Excluída!");
            window.renderizarPagina(); 
            window.carregarChatAluno();
        } catch (e) { 
            console.error(e);
            window.mostrarFeedback("Erro ao excluir", "erro"); 
        }
    };

    window.abrirModalNovoMensagem = async () => {
    const user = auth.currentUser;
    const alunoDoc = await getDoc(doc(db, "usuarios", user.uid));
    if (!alunoDoc.exists()) return;
    
    const dadosUser = alunoDoc.data();
    // Pega o código (senha) da turma do aluno logado
    const codigoTurmaDoAluno = (dadosUser.turma || dadosUser.codigoAcesso || "").toString().trim();

    if (!codigoTurmaDoAluno) {
        alert("Você não está vinculado a uma turma.");
        return;
    }

    // 1. Buscar a turma para descobrir quem é o ID do professor responsável
    const turmasRef = collection(db, "turmas");
    const qTurma = query(turmasRef, where("senha", "==", codigoTurmaDoAluno));
    const snapTurma = await getDocs(qTurma);
    
    let idProfessorResponsavel = null;
    if (!snapTurma.empty) {
        idProfessorResponsavel = snapTurma.docs[0].data().professorResponsavelId;
    }

    // 2. Buscar todos os usuários aprovados
    const snapTodos = await getDocs(collection(db, "usuarios"));
    let contatosArr = [];
    
    snapTodos.forEach(d => {
        const data = d.data();
        // Ignora o próprio usuário logado e não aprovados
        if (d.id === user.uid || data.status !== 'aprovado') return;

        const vInterlocutor = (data.turma || data.codigoAcesso || "").toString().trim();

        // Regra para ser Colega: Perfil Aluno E mesmo código de turma
        const eColegaDeTurma = data.perfil === 'Aluno' && vInterlocutor === codigoTurmaDoAluno;
        
        // Regra para ser Professor: ID ser o mesmo que o cadastrado na turma
        const eMeuProfessor = data.perfil === 'Professor' && d.id === idProfessorResponsavel;

        if (eColegaDeTurma || eMeuProfessor) {
            contatosArr.push({ id: d.id, ...data });
        }
    });

    // 3. Montar as opções do Select (removido o parêntese com a turma conforme solicitado)
    const contatosHTML = contatosArr.map(u => {
        const exibicao = u.perfil === 'Professor' ? "Prof. " + u.nome : u.nome;
        return `<option value="${u.id}" data-nome="${exibicao}">${exibicao}</option>`;
    }).join('');

    document.body.insertAdjacentHTML('beforeend', `
        <div id="modal-novo" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.8); z-index:10000; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
            <div style="background:white; padding:30px; border-radius:24px; width:90%; max-width:500px;">
                <h3 style="color:${azulPadrao}; font-weight:800; text-transform:uppercase; margin-bottom:20px;">Nova Mensagem</h3>
                <select id="novo-dest" style="width:100%; padding:12px; border-radius:10px; margin-bottom:15px; border:1px solid #e2e8f0;">
                    <option value="">Para quem?</option>
                    ${contatosHTML}
                </select>
                <input type="text" id="novo-ass" autocomplete="off" placeholder="Assunto" style="width:100%; padding:12px; border-radius:10px; margin-bottom:15px; border:1px solid #e2e8f0;">
                <textarea id="novo-cont" autocomplete="off" placeholder="Sua mensagem..." style="width:100%; min-height:120px; border-radius:10px; padding:12px; border:1px solid #e2e8f0; resize:none; font-family:inherit;"></textarea>
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button onclick="document.getElementById('modal-novo').remove()" style="flex:1; padding:15px; border-radius:12px; font-weight:700; background:#f1f5f9; color:#64748b;">CANCELAR</button>
                    <button onclick="window.enviarNovaMensagem()" style="flex:1; padding:15px; border-radius:12px; font-weight:800; background:${azulPadrao}; color:white;">ENVIAR</button>
                </div>
            </div>
        </div>
    `);
};

    window.enviarNovaMensagem = async () => {
        const campoDestino = document.getElementById('novo-dest');
        const campoAssunto = document.getElementById('novo-ass');
        const campoConteudo = document.getElementById('novo-cont');

        const destId = campoDestino.value;
        const destNome = campoDestino.options[campoDestino.selectedIndex]?.getAttribute('data-nome');
        const ass = campoAssunto.value.trim();
        const cont = campoConteudo.value.trim();
        
        if (!destId || !ass || !cont) {
            window.mostrarFeedback("Preencha todos os campos", "erro");
            return;
        }
        
        try {
            const user = auth.currentUser;
            const userSnap = await getDoc(doc(db, "usuarios", user.uid));
            if (!userSnap.exists()) throw new Error("Usuário não encontrado");
            
            const d = userSnap.data();
            const nomeRemetente = d.perfil === 'Professor' ? "Prof. " + d.nome : d.nome;
            const tipoRemetente = d.perfil === 'Professor' ? "professor" : "aluno";

            await addDoc(collection(db, "mensagens_diretas"), {
                titulo: ass,
                conteudo: cont,
                remetente: nomeRemetente,
                remetenteNome: nomeRemetente,
                remetenteId: user.uid,
                remetenteTipo: tipoRemetente,
                destinatarioId: destId,
                destinatarioNome: destNome,
                dataEnvio: new Date(),
                tipo: "direta_privada",
                lida: false
            });

            const modal = document.getElementById('modal-novo');
            if (modal) modal.remove();
            
            window.mostrarFeedback("Enviada!");
            window.carregarChatAluno();
        } catch (e) {
            console.error("Erro detalhado:", e);
            window.mostrarFeedback("Erro técnico ao enviar", "erro");
        }
    };

    window.renderizarPagina = () => {
        const container = document.getElementById('chat-principal-container');
        if (!container) return;
        const user = auth.currentUser;
        const filtradas = todasAsMensagens.filter(m => filtroAtual === 'recebidas' ? m.remetenteId !== user.uid : m.remetenteId === user.uid);
        const totalPaginas = Math.ceil(filtradas.length / mensagensPorPagina);
        const exibidas = filtradas.slice((paginaAtual - 1) * mensagensPorPagina, paginaAtual * mensagensPorPagina);

        let html = `<div style="padding:20px; display:flex; flex-direction:column; gap:6px; animation: fadeIn 0.3s forwards; padding-bottom: 80px;">`;
        if (exibidas.length === 0) {
            html += `<p style="text-align:center; color:#94a3b8; padding:40px;">Nenhuma mensagem.</p>`;
        } else {
            exibidas.forEach(msg => {
                const data = msg.dataEnvio?.toDate().toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
                const interlocutorBruto = filtroAtual === 'recebidas' ? (msg.remetente || msg.remetenteNome || "Usuário") : (msg.destinatarioNome || "Destinatário");
const interlocutor = interlocutorBruto.split(' (')[0];
                const classeLida = (filtroAtual === 'recebidas' && !msg.lida) ? 'status-nova' : 'status-lida';
                html += `
                    <div class="card-mensagem-aluno ${classeLida}" onclick="window.abrirMensagemPorId('${msg.id}')">
                        <div class="meta-card">
                            <span class="pill-tipo">${filtroAtual.toUpperCase()}</span>
                            <span class="data-card">${(filtroAtual==='recebidas'&&!msg.lida) ? `<i class="fa-solid fa-circle" style="color:${azulClaro}; font-size:0.4rem; margin-right:5px;"></i>` : ''}${data}</span>
                        </div>
                        <h4 class="titulo-card">${msg.titulo || 'SEM ASSUNTO'}</h4>
                        <p class="subtitulo-card">${filtroAtual === 'recebidas' ? 'De: ' : 'Para: '}${interlocutor}</p>
                    </div>`;
            });
        }
        html += `</div>`;
        if (totalPaginas > 1) {
            html += `<div style="display:flex; justify-content:center; align-items:center; gap:20px; padding:15px; border-top:1px solid #f1f5f9; background:white; position:absolute; bottom:0; width:100%; left:0; z-index:5;">
                <button onclick="window.mudarPaginaMsg(-1)" ${paginaAtual===1 ? 'disabled style="opacity:0.3"' : ''} class="btn-pag"><i class="fa-solid fa-chevron-left"></i></button>
                <span style="font-weight:800; font-size:0.8rem; color:${azulPadrao}">${paginaAtual} / ${totalPaginas}</span>
                <button onclick="window.mudarPaginaMsg(1)" ${paginaAtual===totalPaginas ? 'disabled style="opacity:0.3"' : ''} class="btn-pag"><i class="fa-solid fa-chevron-right"></i></button>
            </div>`;
        }
        container.innerHTML = html;
    };

    window.carregarChatAluno = async () => {
        const container = document.getElementById('chat-principal-container');
        if (!container) return;
        container.innerHTML = `<div style="text-align:center; padding:50px;"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:2rem; color:${azulPadrao};"></i></div>`;
        try {
            const user = auth.currentUser;
            const snap = await getDocs(query(collection(db, "mensagens_diretas"), orderBy("dataEnvio", "desc")));
            
            todasAsMensagens = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                .filter(m => {
                    const souRemetente = m.remetenteId === user.uid;
                    const souDestinatario = m.destinatarioId === user.uid;
                    
                    if (souRemetente && m.excluidoRemetente === true) return false;
                    if (souDestinatario && m.excluidoDestinatario === true) return false;
                    
                    return souRemetente || souDestinatario;
                });

            mensagensCache = {};
            todasAsMensagens.forEach(m => mensagensCache[m.id] = m);
            window.renderizarPagina();
        } catch (e) { 
            console.error(e);
            container.innerHTML = "Erro ao carregar."; 
        }
    };

    window.mudarPaginaMsg = (d) => { paginaAtual += d; window.renderizarPagina(); };
    window.setFiltroMensagem = (t) => {
        filtroAtual = t; paginaAtual = 1; window.renderizarPagina();
        document.querySelectorAll('.pill-filtro').forEach(p => p.classList.toggle('pill-active', p.dataset.tipo === t));
    };

    setTimeout(window.carregarChatAluno, 200);

    return `
    <style>
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .container-mensagens { display: grid; grid-template-columns: 280px 1fr; gap: 20px; width: 100%; margin-top: 20px; height: 580px; overflow: hidden; box-sizing: border-box; }
        .sidebar-canais { background: #f8fafc; border-radius: 24px; padding: 20px; border: 1px solid #e2e8f0; height: 100%; box-sizing: border-box; }
        .chat-principal { background: white; border-radius: 24px; border: 1px solid #f1f5f9; height: 100%; position: relative; overflow: hidden; box-sizing: border-box; }
        .mensagem-expandida-view { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: white; z-index: 10; display: flex; flex-direction: column; animation: fadeIn 0.3s ease-out; }
        .header-expandida { padding: 25px 30px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0; }
        .conteudo-scroll { flex-grow: 1; overflow-y: auto; padding: 30px; color: #334155; line-height: 1.8; scrollbar-width: thin; }
        .footer-expandida { padding: 20px 30px; border-top: 1px solid #f1f5f9; background: #f8fafc; flex-shrink: 0; }
        .btn-escrever { background: ${azulPadrao}; color: white; padding: 16px; border-radius: 14px; border: none; font-weight: 800; cursor: pointer; width: 100%; margin-bottom: 15px; }
        .pill-filtro { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-radius: 14px; cursor: pointer; color: #64748b; font-weight: 700; margin-bottom: 8px; font-size: 0.85rem; }
        .pill-active { background: white; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); color: ${azulPadrao}; border: 1px solid #f1f5f9; }
        .card-mensagem-aluno { border-radius: 16px; padding: 17px 18px; cursor: pointer; border: 1px solid #f1f5f9; transition: 0.2s; border-left: 6px solid ${azulPadrao}; margin-bottom:2.5px; overflow: hidden; }
        .status-nova { background: #f0f7ff; } /* Azul claro bem suave no fundo */
        .titulo-card { margin: 3px 0; font-size: 0.9rem; color: ${azulPadrao}; font-weight: 800; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .subtitulo-card { margin: 0; font-size: 0.75rem; color: #64748b; font-weight: 600; }
        .btn-pag { background: none; border: none; color: ${azulPadrao}; font-size: 1.1rem; cursor: pointer; }
        @media (max-width: 850px) {
            .container-mensagens { grid-template-columns: 1fr; height: auto; display: flex; flex-direction: column; }
            .sidebar-canais { width: 100%; height: auto; }
            .chat-principal { width: 100%; min-height: 500px; height: 600px; }
        }
    </style>
    <div class="header-prof-msg">
        <h1 style="text-transform:uppercase; color:${azulPadrao}; font-weight:900; font-size:1.8rem; margin:0;">Mensagens</h1>
    </div>
    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
    <div class="container-mensagens">
        <div class="sidebar-canais">
            <button class="btn-escrever" onclick="window.abrirModalNovoMensagem()"><i class="fa-solid fa-pen-to-square"></i> Escrever</button>
            <div class="pill-filtro pill-active" data-tipo="recebidas" onclick="window.setFiltroMensagem('recebidas')"><i class="fa-solid fa-inbox"></i> Recebidas</div>
            <div class="pill-filtro" data-tipo="enviadas" onclick="window.setFiltroMensagem('enviadas')"><i class="fa-solid fa-paper-plane"></i> Enviadas</div>
        </div>
        <div class="chat-principal" id="chat-principal-container"></div>
    </div>
    `;
});
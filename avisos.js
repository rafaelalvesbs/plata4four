window.Router.register('avisos', async () => {
    let paginaAtual = 0;
    const isMobile = window.innerWidth <= 600;
    const avisosPorPagina = isMobile ? 6 : 7;
    let todosOsAvisos = [];
    const azulPadrao = "#003058";

    window.switchTabAvisos = (tabId) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const btn = document.getElementById('btn-' + tabId);
        const tab = document.getElementById('tab-' + tabId);
        if (btn) btn.classList.add('tab-active');
        if (tab) tab.classList.add('active');
        if(tabId === 'recentes') renderizarPaginaAvisos();
    };

    const mostrarToast = (mensagem, sucesso = true) => {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 15px 25px; 
            background: ${sucesso ? azulPadrao : '#334155'}; color: white; 
            border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); 
            z-index: 10001; font-size: 0.9rem; font-weight: 700;
            animation: slideInTop 0.5s ease forwards;
        `;
        toast.innerText = mensagem;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.5s ease forwards';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    };

    const carregarDadosFirebase = async () => {
        try {
            const auth = window.authMethods.getAuth();
            if (!auth.currentUser) return;
            const usuarioLogadoId = auth.currentUser.uid;

            // Carregar Turmas
            const qTurmas = window.fsMethods.query(
                window.fsMethods.collection(window.db, "turmas"), 
                window.fsMethods.where("professorResponsavelId", "==", usuarioLogadoId)
            );
            const snapTurmas = await window.fsMethods.getDocs(qTurmas);
            const select = document.getElementById('select-turma');
            if (select) {
                const opcoes = snapTurmas.docs.map(doc => {
                    const d = doc.data();
                    return `<option value="${d.nomeCustomizado}">${d.nomeCustomizado}</option>`;
                }).join('');
                select.innerHTML = '<option value="Todas as turmas">Para todas as turmas</option>' + opcoes;
            }

            // Carregar Avisos - Mudança aqui: removemos o orderBy da query para evitar erro de Index
            const qAvisos = window.fsMethods.query(
                window.fsMethods.collection(window.db, "avisos"), 
                window.fsMethods.where("autorId", "==", usuarioLogadoId)
            );
            
            const snapAvisos = await window.fsMethods.getDocs(qAvisos);
            
            // Ordenamos manualmente aqui no JS por data de criação descrescente
            todosOsAvisos = snapAvisos.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            todosOsAvisos.sort((a, b) => {
                const dataA = a.dataCriacao?.seconds || 0;
                const dataB = b.dataCriacao?.seconds || 0;
                return dataB - dataA;
            });

            renderizarPaginaAvisos();
        } catch (e) { console.error("Erro ao carregar:", e); }
    };

    const renderizarPaginaAvisos = () => {
        const listaDiv = document.getElementById('render-avisos');
        const controlesDiv = document.getElementById('controles-paginacao');
        if (!listaDiv) return;

        if (todosOsAvisos.length === 0) {
            listaDiv.innerHTML = '<p style="font-size:0.8rem; color:#64748b; text-align:center; padding: 20px;">Nenhum aviso postado.</p>';
            controlesDiv.innerHTML = '';
            return;
        }

        const inicio = paginaAtual * avisosPorPagina;
        const fim = inicio + avisosPorPagina;
        const avisosExibidos = todosOsAvisos.slice(inicio, fim);

        listaDiv.innerHTML = avisosExibidos.map(av => {
            let dataFormatada = "";
            if (av.dataCriacao && av.dataCriacao.seconds) {
                const d = new Date(av.dataCriacao.seconds * 1000);
                dataFormatada = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            }

            return `
                <div class="card-fixo-mural" style="border-left: 5px solid ${azulPadrao};">
                  <span class="tag-turma-estilo">${av.turma || 'Geral'}</span>
                  <h4 class="titulo-card">${av.titulo}</h4>
                  <div class="acoes-botoes">
                    <span style="font-size: 0.7rem; color: #94a3b8; font-weight: 700; margin-right: 5px;">${dataFormatada}</span>
                    <button title="Visualizar" class="btn-visualizar" onclick="window.verAvisoCompleto('${av.id}')">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button title="Excluir" class="btn-excluir" onclick="window.confirmarExclusao('${av.id}')">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  </div>
                </div>`;
        }).join('');

        if (todosOsAvisos.length > avisosPorPagina) {
            const totalPaginas = Math.ceil(todosOsAvisos.length / avisosPorPagina);
            let botoesHTML = "";
            
            for (let i = 0; i < totalPaginas; i++) {
                botoesHTML += `
                    <div class="pag-item ${i === paginaAtual ? 'pag-item-active' : ''}" 
                         onclick="window.mudarParaPagina(${i})">
                        ${i + 1}
                    </div>`;
            }

            controlesDiv.innerHTML = `<div class="pag-container">${botoesHTML}</div>`;
        }
    };

    window.mudarPagina = (direcao) => { paginaAtual += direcao; renderizarPaginaAvisos(); };
    window.mudarParaPagina = (numero) => { paginaAtual = numero; renderizarPaginaAvisos(); };

    window.postarNovoAviso = async () => {
        const titulo = document.getElementById('input-titulo').value;
        const texto = document.getElementById('input-texto').innerHTML;
        const turma = document.getElementById('select-turma').value;
        const enviarEmail = document.getElementById('check-email').checked;

        if (!titulo || texto.trim() === "" || texto === "<br>") {
            mostrarToast("Preencha todos os campos!", false);
            return;
        }
        try {
            await window.fsMethods.addDoc(window.fsMethods.collection(window.db, "avisos"), {
                titulo, 
                conteudo: texto, 
                turma,
                dispararEmail: enviarEmail,
                autorId: window.authMethods.getAuth().currentUser.uid,
                dataCriacao: window.fsMethods.serverTimestamp()
            });

            mostrarToast(enviarEmail ? "Aviso publicado e e-mails agendados!" : "Aviso publicado!");
            
            // Limpar campos
            document.getElementById('input-titulo').value = '';
            document.getElementById('input-texto').innerHTML = '';
            document.getElementById('check-email').checked = false;
            paginaAtual = 0;
            
            await carregarDadosFirebase();
            window.switchTabAvisos('recentes');
        } catch (e) { 
            console.error(e);
            mostrarToast("Erro ao salvar o aviso.", false); 
        }
    };

    window.confirmarExclusao = (id) => {
        if(!confirm("Deseja realmente excluir este aviso?")) return;
        executarExclusao(id);
    };

    const executarExclusao = async (id) => {
        await window.fsMethods.deleteDoc(window.fsMethods.doc(window.db, "avisos", id));
        mostrarToast("Aviso removido!");
        carregarDadosFirebase();
    };

    window.verAvisoCompleto = (id) => {
        const aviso = todosOsAvisos.find(a => a.id === id);
        if (!aviso) return;

        const modalHTML = `
          <div id="modal-aviso" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; z-index:9999; padding:20px; backdrop-filter: blur(4px);">
            <div style="background:white; padding:30px; border-radius:15px; max-width:600px; width:100%; max-height:80vh; overflow-y:auto;">
              <h2 style="color:${azulPadrao}; margin-top:0; font-size:1.4rem; font-weight:800;">${aviso.titulo}</h2>
              <div style="color:#475569; line-height:1.6; font-size:1rem; margin-top:15px;">${aviso.conteudo}</div>
              <button onclick="document.getElementById('modal-aviso').remove()" style="margin-top:25px; width:100%; padding:14px; background:${azulPadrao}; color:white; border:none; border-radius:10px; cursor:pointer; font-weight:700;">FECHAR</button>
            </div>
          </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    };

    setTimeout(carregarDadosFirebase, 100);

    return `
    <style>
        @keyframes slideInTop { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        .tabs-nav { display: flex; gap: 30px; margin-bottom: 25px; border-bottom: 1px solid #e2e8f0; padding-left: 10px; }
        .tab-btn { padding: 12px 5px; border: none; background: none; cursor: pointer; font-weight: 700; color: #5c7f92; font-size: 0.85rem; text-transform: uppercase; position: relative; }
        .tab-active { color: #003058 !important; }
        .tab-active::after { content: ""; position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background-color: #003058; }
        .tab-content { display: none; width: 100%; }
        .tab-content.active { display: block; }
        .card-editor { background: #fff; padding: 25px; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); max-width: 600px; margin: 0 auto; border: 1px solid #f1f5f9; box-sizing: border-box;}
        .input-aviso { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 0.9rem; margin-bottom: 15px; outline: none; box-sizing: border-box; }
        .card-fixo-mural { background: #fff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 12px 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-bottom: 10px; box-sizing: border-box; }
        .tag-turma-estilo { background: #f1f5f9; color: ${azulPadrao}; padding: 5px 10px; border-radius: 6px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
        .titulo-card { margin: 0; font-size: 0.9rem; color: ${azulPadrao}; font-weight: 800; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .acoes-botoes { display: flex; gap: 8px; align-items: center; }
        .btn-visualizar { background:${azulPadrao}; border:none; color:white; width:32px; height:32px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .btn-excluir { background:#fef2f2; border:none; color:#ef4444; width:32px; height:32px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .pag-container { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 16px; }
        
        @media (max-width: 600px) {
            .pag-container { margin-top: 20px; }
        }
        .pag-item { 
            width: 38px; 
            height: 38px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            border-radius: 10px; 
            font-weight: 800; 
            font-size: 0.9rem; 
            cursor: pointer; 
            transition: all 0.2s;
            border: 1px solid #e2e8f0;
            background: white;
            color: #475569;
        }
        .pag-item-active { 
            background: #003058 !important; 
            color: white !important; 
            border-color: #003058 !important; 
        }
        .pag-item:hover:not(.pag-item-active) { background: #f8fafc; border-color: #cbd5e1; }

        @media (max-width: 600px) {
            .card-fixo-mural { 
                flex-direction: row; 
                align-items: center; 
                padding: 10px; 
                gap: 8px;
            }
            .tag-turma-estilo { 
                font-size: 0.55rem; 
                padding: 4px 6px; 
                flex-shrink: 0;
            }
            .titulo-card { 
                font-size: 0.75rem; 
                margin: 0; 
                flex: 1; 
                min-width: 0; 
                white-space: nowrap; 
                overflow: hidden; 
                text-overflow: ellipsis; 
            }
            .acoes-botoes { 
                gap: 5px; 
                flex-shrink: 0;
            }
            .btn-visualizar, .btn-excluir { 
                width: 28px; 
                height: 28px; 
            }
            .tabs-nav { 
                gap: 10px; 
                overflow-x: auto; 
                padding-bottom: 5px;
            }
            .tab-btn { 
                font-size: 0.7rem; 
                white-space: nowrap; 
                padding: 8px 4px;
            }
        }
    </style>

   <div class="header-prof">
        <h1 style="font-size: 1.6rem; margin-bottom: 5px; text-transform: uppercase; font-weight: 900; color: #003058;">Avisos</h1>
        <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 0;">Comunicação direta com suas turmas.</p>
    </div>
    <hr style="border:0; border-top:2px solid #f1f5f9; margin: 8px 0 10px 0;">

    <div class="tabs-nav">
        <button id="btn-criar" class="tab-btn tab-active" onclick="window.switchTabAvisos('criar')">CRIAR NOVO</button>
        <button id="btn-recentes" class="tab-btn" onclick="window.switchTabAvisos('recentes')">RECENTES</button>
    </div>

    <div id="tab-criar" class="tab-content active">
        <div class="card-editor">
            <label style="font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 5px;">Assunto</label>
            <input type="text" id="input-titulo" class="input-aviso" placeholder="Título do aviso" maxlength="86" autocomplete="off">
            <label style="font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 5px;">Mensagem</label>
            <div id="input-texto" contenteditable="true" style="height: 150px; overflow-y: auto; padding: 15px; border: 1px solid #e2e8f0; border-radius: 10px; background: white; font-size: 0.9rem; margin-bottom: 15px; outline: none;"></div>
           <label style="font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 5px;">Turma</label>
            <select id="select-turma" class="input-aviso"></select>
            
            <label style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; background: #f1f5f9; padding: 15px; border-radius: 12px; cursor: pointer; user-select: none;">
                <input type="checkbox" id="check-email" style="width: 20px; height: 20px; cursor: pointer; accent-color: #003058;">
                <span style="font-size: 0.85rem; font-weight: 700; color: #003058; cursor: pointer;">Enviar cópia para o e-mail dos alunos</span>
            </label>

            <button style="width:100%; padding: 15px; background:#003058; color:white; border:none; border-radius:10px; font-weight:800; cursor:pointer;" onclick="window.postarNovoAviso()">PUBLICAR AGORA</button>
        </div>
    </div>

    <div id="tab-recentes" class="tab-content">
        <div id="render-avisos"></div>
        <div id="controles-paginacao"></div>
    </div>
    `;
});
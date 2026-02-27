window.Router.register('feedbackdoalunoclm', async () => {
    const db = window.db;
    const { collection, query, where, onSnapshot } = window.fsMethods;

    let todosFeedbacks = [];
    let paginaAtual = 1;
    const itensPorPagina = 5;
    const azulPadrao = "#003058";

    // --- MODAL DE DETALHES ---
    window.abrirModalFeedbackCompleto = (id) => {
        const item = todosFeedbacks.find(f => f.id === id);
        if (!item) return;

        const data = item.dataExibicao || '---';
        const isEscrita = item.tipo === 'escrita';
        const tipoLabel = isEscrita ? 'Feedback de Escrita' : 'Feedback Oral';
        const iconeTipo = isEscrita ? 'fa-file-pen' : 'fa-microphone-lines';
        const titulo = item.tituloAtividade || item.atividadeTitulo || item.titulo || 'Atividade';

        let corpoModal = '';

        if (isEscrita) {
            const feedbackText = item.feedbackProfessor || item.feedbackGeral || 'O professor não deixou um comentário em texto.';
            const notaAtv = item.nota ? `<div style="margin-top:15px; padding-top:15px; border-top:1px solid #eee; font-weight:800; color:${azulPadrao};">NOTA: ${item.nota}</div>` : '';
            
            corpoModal = `
                <div style="background:white; padding:20px; border-radius:18px; border:1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                    <h4 style="margin:0 0 12px 0; font-size: 0.7rem; color:${azulPadrao}; text-transform:uppercase; font-weight:800; letter-spacing:0.5px;">Feedback da Redação:</h4>
                    <div style="font-size: 0.95rem; color:#334155; line-height:1.7; background:#f8fafc; padding:15px; border-radius:12px;">${feedbackText.replace(/\n/g, '<br>')}</div>
                    ${notaAtv}
                </div>`;
        } else {
            const lista = item.questoes || item.respostas || [];
            corpoModal = lista.map((q, idx) => `
                <div style="background:white; padding:18px; border-radius:18px; margin-bottom:15px; border:1px solid #e2e8f0;">
                    <div style="font-size:10px; font-weight:900; color:${azulPadrao}; margin-bottom:10px; text-transform:uppercase;">Questão ${idx + 1}</div>
                    <div style="font-size:13px; color:#64748b; margin-bottom:12px; font-style:italic; border-left:3px solid #cbd5e1; padding-left:10px;">"${q.enunciado || '...'}"</div>
                    
                    <div style="background:#f8fafc; padding:10px; border-radius:12px; margin-bottom:12px; border:1px solid #f1f5f9;">
                        <span style="font-size:9px; color:#94a3b8; font-weight:800; display:block; margin-bottom:5px;">SUA RESPOSTA:</span>
                        <audio src="${q.audioUrl}" controls style="width:100%; height:35px;"></audio>
                    </div>

                    <div style="background:#f1f5f9; padding:15px; border-radius:12px; border-left:4px solid ${azulPadrao};">
                        <span style="font-size:9px; color:${azulPadrao}; font-weight:900; display:block; margin-bottom:5px; text-transform:uppercase;">Avaliação do Professor:</span>
                        <div style="font-size:13px; color:#1e293b; line-height:1.5;">${q.feedbackProf || 'Sem comentários específicos.'}</div>
                    </div>
                </div>`).join('');
        }

        const modalHTML = `
            <div id="modal-feedback-view" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0, 48, 88, 0.4); display:flex; justify-content:center; align-items:center; z-index:10000; padding:15px; backdrop-filter: blur(6px); animation: fadeInFB 0.3s ease; box-sizing: border-box;">
                <div style="background:white; border-radius:28px; max-width:600px; width:100%; max-height:92vh; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.3); display:flex; flex-direction:column; animation: slideUpFB 0.3s ease;">
                    <div style="padding:25px; background:${azulPadrao}; color:white; position:relative;">
                        <span style="font-size:0.65rem; text-transform:uppercase; font-weight:800; opacity:0.8; letter-spacing:1px; display:block; margin-bottom:5px;"><i class="fa-solid ${iconeTipo}"></i> ${tipoLabel}</span>
                        <h2 style="margin:0; font-size:1.1rem; text-transform: uppercase; line-height:1.2; padding-right:40px;">${titulo}</h2>
                        <button onclick="document.getElementById('modal-feedback-view').remove()" style="position:absolute; top:20px; right:20px; background:rgba(255,255,255,0.1); border:none; color:white; width:35px; height:35px; border-radius:10px; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div style="padding:12px 25px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                         <span style="font-size:10px; color:#64748b; font-weight:700;"><i class="fa-regular fa-calendar-check"></i> Concluído em ${data}</span>
                    </div>
                    <div style="padding:20px; overflow-y:auto; flex-grow:1; background:#f8fafc;">
                        ${corpoModal}
                    </div>
                    <div style="padding:15px 25px; background:white; border-top:1px solid #f1f5f9;">
                        <button onclick="document.getElementById('modal-feedback-view').remove()" style="padding:12px; background:${azulPadrao}; color:white; border:none; border-radius:12px; cursor:pointer; font-weight:800; font-size:0.7rem; width: 100%; letter-spacing:1px;">OK</button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    };

    window.mudarPaginaFeedback = (direcao) => {
        const totalPaginas = Math.ceil(todosFeedbacks.length / itensPorPagina);
        if (direcao === 'proxima' && paginaAtual < totalPaginas) paginaAtual++;
        else if (direcao === 'anterior' && paginaAtual > 1) paginaAtual--;
        renderizarListaFeedbacks();
    };

    const renderizarListaFeedbacks = () => {
        const container = document.getElementById('lista-feedbacks-container');
        if (!container) return;
        
        container.innerHTML = "";

        if (todosFeedbacks.length === 0) {
            container.innerHTML = `<div style="padding:50px; text-align:center; color:#94a3b8;"><i class="fa-solid fa-folder-open" style="font-size:2rem; opacity:0.3; margin-bottom:10px;"></i><p style="font-size:0.9rem;">Nenhum feedback disponível.</p></div>`;
            return;
        }

        const totalPaginas = Math.ceil(todosFeedbacks.length / itensPorPagina);
        const exibidos = todosFeedbacks.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);

        exibidos.forEach(item => {
            const isEscrita = item.tipo === 'escrita';
            const icone = isEscrita ? 'fa-file-pen' : 'fa-microphone-lines';

            const card = document.createElement('div');
            card.style.cssText = `background:#fff; border-radius:18px; padding:18px; margin-bottom:12px; display:flex; gap:15px; justify-content:space-between; align-items:center; box-shadow:0 4px 12px rgba(0,0,0,0.04); border:1px solid #f1f5f9; border-left:6px solid ${azulPadrao}; animation: fadeInFB 0.3s ease;`;

            card.innerHTML = `
                <div style="flex:1; overflow:hidden;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                        <div style="width:28px; height:28px; background:#f1f5f9; border-radius:8px; display:flex; align-items:center; justify-content:center; color:${azulPadrao}; font-size:12px;">
                            <i class="fa-solid ${icone}"></i>
                        </div>
                        <h3 style="margin:0; color:${azulPadrao}; font-size:13px; font-weight:800; text-transform: uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${item.tituloAtividade || item.atividadeTitulo || item.titulo || 'Atividade'}
                        </h3>
                    </div>
                    <div style="font-size:10px; color:#94a3b8; font-weight:700; margin-left:38px;">
                        <i class="fa-regular fa-clock"></i> ${item.dataExibicao} • ${isEscrita ? 'Escrita' : 'Oral'}
                    </div>
                </div>
                <button onclick="window.abrirModalFeedbackCompleto('${item.id}')" style="background:${azulPadrao}; color:white; border:none; padding:10px 18px; border-radius:12px; font-size:9px; font-weight:800; cursor:pointer; text-transform: uppercase; letter-spacing:0.5px;">Ver Feedback</button>`;
            container.appendChild(card);
        });

        if (totalPaginas > 1) {
            const pag = document.createElement('div');
            pag.style.cssText = `display:flex; justify-content:center; align-items:center; gap:20px; margin-top:15px;`;
            pag.innerHTML = `
                <button onclick="window.mudarPaginaFeedback('anterior')" ${paginaAtual === 1 ? 'disabled style="opacity:0.2"' : ''} style="background:none; border:none; color:${azulPadrao}; cursor:pointer; font-size:1.5rem;"><i class="fa-solid fa-circle-chevron-left"></i></button>
                <span style="font-weight:800; color:${azulPadrao}; font-size:0.9rem;">${paginaAtual} / ${totalPaginas}</span>
                <button onclick="window.mudarPaginaFeedback('proxima')" ${paginaAtual === totalPaginas ? 'disabled style="opacity:0.2"' : ''} style="background:none; border:none; color:${azulPadrao}; cursor:pointer; font-size:1.5rem;"><i class="fa-solid fa-circle-chevron-right"></i></button>`;
            container.appendChild(pag);
        }
    };

    const carregarTudo = () => {
        const user = window.authMethods.getAuth().currentUser;
        if (!user) return;

        const qResp = query(collection(db, "respostas_alunos"), where("alunoId", "==", user.uid));
        const qRed = query(collection(db, "redacoes"), where("alunoId", "==", user.uid));

        let cacheRespostas = [];
        let cacheRedacoes = [];

        const atualizarGeral = () => {
            todosFeedbacks = [...cacheRespostas, ...cacheRedacoes].sort((a, b) => b.dataOrdenacao - a.dataOrdenacao);
            renderizarListaFeedbacks();
        };

        onSnapshot(qResp, (snap) => {
            cacheRespostas = snap.docs.map(d => {
                const data = d.data();
                const corrigido = (data.tipo === 'escrita' && (data.status === 'corrigida' || data.feedbackProfessor)) || (data.tipo === 'oral' && data.avaliado === true);
                if (!corrigido) return null;
                return { id: d.id, ...data, dataOrdenacao: data.timestamp?.seconds || data.dataEnvio?.seconds || 0, dataExibicao: data.dataEntrega || (data.timestamp?.toDate ? data.timestamp.toDate().toLocaleDateString('pt-BR') : '---') };
            }).filter(i => i !== null);
            atualizarGeral();
        });

        onSnapshot(qRed, (snap) => {
            cacheRedacoes = snap.docs.map(d => {
                const data = d.data();
                if (data.status !== 'corrigida' && !data.feedbackProfessor) return null;
                return { id: d.id, ...data, tipo: 'escrita', dataOrdenacao: data.timestamp?.seconds || 0, dataExibicao: data.dataEntrega || (data.timestamp?.toDate ? data.timestamp.toDate().toLocaleDateString('pt-BR') : '---') };
            }).filter(i => i !== null);
            atualizarGeral();
        });
    };

    // FUNÇÃO PARA INICIALIZAR APÓS RENDERIZAR O HTML
    setTimeout(() => {
        carregarTudo();
    }, 100);

    return `
        <style>
            @keyframes fadeInFB { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUpFB { from { transform: translateY(15px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        </style>
        <div style="padding: 15px; font-family:'Inter', sans-serif;">
            <div style="margin-bottom:20px;">
                <h1 style="text-transform:uppercase; color:${azulPadrao}; font-weight:900; font-size:1.6rem; margin:0;">Meus Feedbacks</h1>
                <p style="color:#94a3b8; margin:5px 0 0 0; font-size: 0.85rem; font-weight:500;">Acompanhe o retorno das suas atividades práticas.</p>
            </div>
            <div id="lista-feedbacks-container">
                <div style="text-align:center; padding:50px;"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:2rem; color:${azulPadrao}"></i></div>
            </div>
        </div>`;
});
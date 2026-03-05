window.Router.register('forumalunoclm', async () => {
  const { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, deleteDoc, doc, updateDoc, getDocs } = window.fsMethods;
  const db = window.db;
  const auth = window.authMethods.getAuth();

  let todosTopicos = [];
  let unsubscribeComentarios = null;
  let paginaAtual = 1;
  
  const itensPorPagina = window.innerWidth < 768 ? 6 : 7;

  const Toast = (tipo, mensagem) => {
    const existente = document.getElementById('feedback-sistema-forum');
    if (existente) existente.remove();
    const corPill = tipo === 'success' ? "#003058" : "#dc2626";
    const icone = tipo === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    const html = `
        <div id="feedback-sistema-forum" style="position:fixed; top:20px; right:20px; z-index:99999; pointer-events:none;">
            <div style="background:white; padding:8px 20px; border-radius:10px; box-shadow:0 10px 25px rgba(0,0,0,0.15); display:flex; align-items:center; gap:12px; border-left: 5px solid ${corPill}; animation: slideInSlim 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;">
                <i class="fa-solid ${icone}" style="color:${corPill}; font-size:1.1rem;"></i>
                <span style="font-size:0.85rem; font-weight:700; color:#0f172a; white-space:nowrap; text-transform:uppercase;">${mensagem}</span>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => {
        const el = document.getElementById('feedback-sistema-forum');
        if (el) {
            const inner = el.querySelector('div');
            if (inner) inner.style.animation = 'slideOutSlim 0.4s forwards';
            setTimeout(() => el.remove(), 400);
        }
    }, 3000);
  };

  window.excluirMensagemAluno = (id) => {
    const modalHtml = `
        <div id="modal-confirm-forum" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.7); backdrop-filter:blur(8px); z-index:20000; display:flex; justify-content:center; align-items:center; animation: fadeInModal 0.2s ease;">
            <div style="background:white; padding:35px; border-radius:30px; width:90%; max-width:400px; text-align:center; box-shadow: 0 20px 50px rgba(0,0,0,0.2);">
                <div style="background:#fee2e2; width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin: 0 auto 20px auto;">
                    <i class="fa-solid fa-trash-can" style="color:#dc2626; font-size:1.5rem;"></i>
                </div>
                <h3 style="color:#003058; font-weight:900; margin-bottom:10px; text-transform:uppercase;">Remover?</h3>
                <p style="color:#64748b; font-size:0.9rem; margin-bottom:25px;">Sua participação será excluída permanentemente.</p>
                <div style="display:flex; gap:12px;">
                    <button onclick="document.getElementById('modal-confirm-forum').remove()" style="flex:1; padding:14px; border-radius:15px; cursor:pointer; border:1px solid #e2e8f0; background:white; font-weight:700; color:#64748b;">CANCELAR</button>
                    <button id="btn-confirm-del-forum" style="flex:1; padding:14px; border-radius:15px; cursor:pointer; background:#dc2626; color:white; border:none; font-weight:800; text-transform:uppercase;">EXCLUIR</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('btn-confirm-del-forum').onclick = async () => {
        try {
            await deleteDoc(doc(db, "forum_comentarios", id));
            document.getElementById('modal-confirm-forum').remove();
            Toast('success', 'Participação removida!');
        } catch (e) { Toast('error', 'Erro ao excluir.'); }
    };
  };

  window.editarMensagemAluno = (id, textoAntigo) => {
    const modalEditHtml = `
        <div id="modal-edit-forum" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.75); display:flex; justify-content:center; align-items:center; z-index:9999; backdrop-filter: blur(6px); animation: fadeInModal 0.2s ease;">
            <div style="background:white; border-radius:25px; max-width:500px; width:90%; overflow:hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.2);">
                <div style="padding:20px; background:#003058; color:white; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:0.9rem; text-transform:uppercase; font-weight:800;">Editar Resposta</h3>
                    <button onclick="document.getElementById('modal-edit-forum').remove()" style="background:none; border:none; color:white; cursor:pointer; font-size:1.5rem;">&times;</button>
                </div>
                <div style="padding:25px; display:flex; flex-direction:column; gap:15px;"><textarea id="novo-texto-forum" autocomplete="off" 
            style="padding:15px; border-radius:15px; border:1px solid #e2e8f0; min-height:150px; font-family:inherit; width:100%; box-sizing:border-box; resize:none; font-size:0.95rem; outline:none;"
            onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); document.getElementById('btn-save-edit-forum').click(); }">${textoAntigo}</textarea><textarea id="novo-texto-forum" autocomplete="off" style="padding:15px; border-radius:15px; border:1px solid #e2e8f0; min-height:150px; font-family:inherit; width:100%; box-sizing:border-box; resize:none; font-size:0.95rem; outline:none;">${textoAntigo}</textarea>
                    <button id="btn-save-edit-forum" style="padding:16px; background:#003058; color:white; border:none; border-radius:15px; font-weight:800; cursor:pointer; text-transform:uppercase;">Salvar Alterações</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalEditHtml);
    const campo = document.getElementById('novo-texto-forum');
    campo.focus();
    document.getElementById('btn-save-edit-forum').onclick = async () => {
        const novoTexto = campo.value.trim();
        if (novoTexto && novoTexto !== textoAntigo) {
            try {
                const { getStorage, ref, uploadBytes, getDownloadURL } = window.storageMethods;
                const storage = getStorage();
                const blob = new Blob([novoTexto], { type: 'text/plain' });
                const caminho = `forum_comentarios/${auth.currentUser.uid}_${id}_edit.txt`;
                const storageRef = ref(storage, caminho);
                
                await uploadBytes(storageRef, blob);
                const urlEdicao = await getDownloadURL(storageRef);

                await updateDoc(doc(db, "forum_comentarios", id), { 
                  texto: novoTexto.substring(0, 500),
                  textoUrl: urlEdicao,
                  editado: true, 
                  dataEdicao: serverTimestamp() 
                });
                document.getElementById('modal-edit-forum').remove();
                Toast('success', 'Resposta atualizada!');
            } catch (e) { Toast('error', 'Erro ao salvar.'); }
        } else { document.getElementById('modal-edit-forum').remove(); }
    };
  };

  let idsComentadosPeloAluno = [];

  const iniciarEscutaForumAluno = () => {
    const usuario = window.usuarioLogado;
    if (!usuario) return;

    const qTopicos = query(collection(db, "forum_topicos"), orderBy("dataCriacao", "desc"));
    const qMeusComentarios = query(collection(db, "forum_comentarios"), where("autorId", "==", auth.currentUser.uid));

    // Escuta em tempo real as participações para atualizar as cores dos cards instantaneamente
    onSnapshot(qMeusComentarios, (snapComents) => {
      idsComentadosPeloAluno = snapComents.docs.map(d => d.data().topicoId);
      
      onSnapshot(qTopicos, (snapTopicos) => {
        const docs = snapTopicos.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
          data: docSnap.data().dataCriacao?.toDate().toLocaleString('pt-BR') || '...',
          validadeRaw: docSnap.data().dataValidade || ""
        }));

        todosTopicos = docs.filter(t => {
          const destinoID = String(t.destinoID || "").trim();
          const minhaTurma = String(usuario.turma || "").trim();
          const meuSemestre = String(usuario.semestre || "").trim();

          if (t.destinoTipo === 'turma') {
            return destinoID === minhaTurma;
          } else if (t.destinoTipo === 'semestre') {
            return destinoID === meuSemestre;
          }
          return false;
        });

        renderizarListaAluno();
      });
    });
  };

  window.mudarPaginaAluno = (p) => {
    paginaAtual = p;
    renderizarListaAluno();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.renderizarListaAluno = () => {
    const container = document.getElementById('lista-topicos-area-aluno');
    const paginacaoContainer = document.getElementById('paginacao-aluno');
    if (!container) return;

    if (todosTopicos.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:40px; font-weight:600;">Nenhuma discussão disponível para sua turma ou semestre.</p>';
      paginacaoContainer.innerHTML = '';
      return;
    }

    const totalPaginas = Math.ceil(todosTopicos.length / itensPorPagina);
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const itensExibidos = todosTopicos.slice(inicio, fim);

    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "10px";

    container.innerHTML = itensExibidos.map((t) => {
      const jaComentei = idsComentadosPeloAluno.includes(t.id);
      const bgCard = jaComentei ? '#ffffff' : '#fee2e2';
      const corTx = '#003058';
      const bgTag = '#003058';
      const txTag = '#ffffff';
      const corPrazo = '#64748b';
      const corData = '#dc2626';

      return `
            <div class="card-list-premium compact" 
                 style="background:${bgCard}; border: 1px solid ${jaComentei ? '#eef2f6' : '#fecaca'}; width: 100%; display: flex; flex-wrap: nowrap; align-items: center; justify-content: space-between; padding: 10px 15px; border-radius: 12px; cursor: pointer; box-sizing: border-box; min-height: 60px; gap: 10px;" 
                 onclick="window.abrirChatAluno('${t.id}')">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                    <span class="tag-pill-clm" style="background:${bgTag}; color:${txTag}; flex-shrink: 0; font-size: 8px; padding: 3px 8px; border-radius: 5px; font-weight: 800; text-transform: uppercase;">${t.categoria}</span>
                    <h4 style="margin: 0; flex: 1; color:${corTx}; font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;">${t.titulo}</h4>
                </div>
                <div style="text-align: right; flex-shrink: 0; display: flex; flex-direction: column; justify-content: center;">
                    <div style="font-size: 7px; font-weight: 900; color:${corPrazo}; text-transform: uppercase; line-height: 1;">Expira</div>
                    <div style="font-size: 10px; font-weight: 800; color:${corData}; white-space: nowrap;">${t.validadeRaw.split('-').reverse().join('/')}</div>
                </div>
            </div>`;
    }).join('');

   let htmlPaginacao = '';
    if (totalPaginas > 1) {
        for (let i = 1; i <= totalPaginas; i++) {
            // Renderiza apenas os números das páginas, sem setas de navegação
            if (i === 1 || i === totalPaginas || (i >= paginaAtual - 1 && i <= paginaAtual + 1)) {
                htmlPaginacao += `
                    <button class="btn-paginacao ${i === paginaAtual ? 'ativo' : ''}" onclick="window.mudarPaginaAluno(${i})">
                        ${i}
                    </button>`;
            } else if (i === paginaAtual - 2 || i === paginaAtual + 2) {
                htmlPaginacao += `<span style="color:#003058; font-weight:800; width: 20px; text-align: center;">...</span>`;
            }
        }
    }
    paginacaoContainer.innerHTML = htmlPaginacao;
  };

  window.abrirChatAluno = async (id) => {
    const topico = todosTopicos.find(t => t.id === id);
    if (!topico) return;

    let conteudoDesc = "Carregando conteúdo...";
    if (topico.descricaoUrl) {
        try {
            const response = await fetch(topico.descricaoUrl, { mode: 'cors' });
            conteudoDesc = response.ok ? await response.text() : "Erro ao carregar descrição.";
        } catch (e) { 
            conteudoDesc = "Erro de conexão ao carregar conteúdo do Storage."; 
        }
    } else {
        conteudoDesc = topico.descricao || "Sem descrição disponível.";
    }

    document.getElementById('mural-lista-container-aluno').style.display = 'none';
    document.getElementById('discussao-foco-container-aluno').style.display = 'block';
    
    document.getElementById('foco-cabecalho-aluno').innerHTML = `
      <div style="margin-bottom:15px;">
        <button onclick="window.voltarMuralAluno()" class="btn-voltar-premium">
          <i class="fa-solid fa-arrow-left"></i> VOLTAR AO MURAL
        </button>
      </div>
      <div class="pergunta-prof-discreta">
        <div class="header-pergunta">
          <span class="tag-pill-discreta">POSTADO POR: ${topico.autor.toUpperCase()}</span>
          <h2 class="titulo-foco">${topico.titulo}</h2>
        </div>
        <div class="descricao-foco">${conteudoDesc}</div>
        <div class="footer-foco">
           <span class="data-foco">Publicado em: ${topico.data}</span>
           <button class="btn-responder-principal" onclick="window.exibirInputRespostaAluno('main')">
             <i class="fa-solid fa-reply"></i> RESPONDER
           </button>
        </div>
        <div id="input-direto-main-aluno" class="reply-input-container">
          <input type="text" id="campo-main-aluno" placeholder="Escreva seu comentário..." autocomplete="off" 
            onkeydown="if(event.key === 'Enter') { const b=this.nextElementSibling.dataset; window.enviarMsgAluno(b.topico, 'main', b.autor, b.info); }">
          <button 
              data-topico="${id}" 
              data-autor="${topico.autor}" 
              data-info="${topico.titulo.replace(/"/g, '&quot;')}" 
              onclick="const b=this.dataset; window.enviarMsgAluno(b.topico, 'main', b.autor, b.info)">
              <i class="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    `;

    const q = query(collection(db, "forum_comentarios"), where("topicoId", "==", id), orderBy("data", "asc"));
    if (unsubscribeComentarios) unsubscribeComentarios();

    unsubscribeComentarios = onSnapshot(q, (snap) => {
      const box = document.getElementById('foco-mensagens-box-aluno');
      if (!box) return;

      box.innerHTML = snap.docs.map(d => {
        const c = d.data();
        const cid = d.id;
        const souEu = c.autorId === auth.currentUser.uid;
        const eProfessor = c.autorId === topico.autorId; 
        const dtStr = c.data ? c.data.toDate().toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '...';
        
        return `
          <div class="msg-wrapper-clm ${souEu ? 'minha-msg' : 'aluno'}" id="msg-${cid}">
            <div class="bubble-clm ${eProfessor ? 'bubble-prof' : ''}">
                ${c.citacao ? `<div class="citacao-clm"><b>Em resposta a ${c.citacao.nome}:</b> <i>"${c.citacao.texto}"</i></div>` : ''}
                <div class="msg-meta-header">
                  <small class="msg-autor-txt">${c.autor} ${souEu ? '<span class="me-badge">VOCÊ</span>' : ''} ${eProfessor ? '<span class="me-badge" style="background:#475569; color:#FFFFFF; font-weight:900;">PROFESSOR</span>' : ''}</small>
                  <div class="msg-acoes-area">
                    <span class="msg-data-txt">${dtStr}</span>
                    <div class="msg-icons">
                        ${souEu ? `
                          <i class="fa-solid fa-pen btn-reply-clm" onclick="window.editarMensagemAluno('${cid}', '${c.texto.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')"></i>
                          <i class="fa-solid fa-trash btn-reply-clm" onclick="window.excluirMensagemAluno('${cid}')"></i>
                        ` : `
                          <i class="fa-solid fa-reply btn-reply-clm" onclick="window.exibirInputRespostaAluno('${cid}')"></i>
                        `}
                    </div>
                  </div>
                </div>
                <p class="msg-conteudo-txt">${c.texto}</p>
                <div id="input-direto-${cid}" class="reply-input-container">
                <input type="text" id="campo-${cid}" placeholder="Responder..." autocomplete="off"
                  onkeydown="if(event.key === 'Enter') { const b=this.nextElementSibling.dataset; window.enviarMsgAluno(b.topico, b.msgid, b.autor, b.info); }">
                <button 
                    data-topico="${id}" 
                    data-msgid="${cid}" 
                    data-autor="${c.autor}" 
                    data-info="${c.texto.replace(/"/g, '&quot;')}" 
                    onclick="const b=this.dataset; window.enviarMsgAluno(b.topico, b.msgid, b.autor, b.info)">
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </div>
            </div>
          </div>
        `;
      }).join('');
      box.scrollTop = box.scrollHeight;
    });
  };

  window.exibirInputRespostaAluno = (msgId) => {
    const suf = msgId === 'main' ? '-aluno' : '';
    const div = document.getElementById(`input-direto-${msgId}${suf}`);
    if (!div) return;
    const isVisible = div.style.display === 'flex';
    document.querySelectorAll('.reply-input-container').forEach(el => el.style.display = 'none');
    div.style.display = isVisible ? 'none' : 'flex';
    if(!isVisible) document.getElementById(`campo-${msgId}${suf}`).focus();
  };

  window.enviarMsgAluno = async (topicoId, msgId, nome, texto) => {
    const fieldId = msgId === 'main' ? 'campo-main-aluno' : `campo-${msgId}`;
    const input = document.getElementById(fieldId);
    const containerId = msgId === 'main' ? 'input-direto-main-aluno' : `input-direto-${msgId}`;
    const btnEnviar = document.querySelector(`#${containerId} button`);

    if (!input || !input.value.trim() || (btnEnviar && btnEnviar.disabled)) return;
    
    const textoCompleto = input.value.trim();
    const citacaoFinal = msgId === 'main' ? null : { nome, texto: texto.substring(0, 50) + (texto.length > 50 ? '...' : '') };
    
    try {
      if (btnEnviar) {
        btnEnviar.disabled = true;
        btnEnviar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      }

      await addDoc(collection(db, "forum_comentarios"), {
        topicoId, 
        texto: textoCompleto, 
        autor: window.usuarioLogado.nome || "Aluno",
        autorId: auth.currentUser.uid, 
        data: serverTimestamp(), 
        citacao: citacaoFinal
      });

      input.value = '';
      document.getElementById(containerId).style.display = 'none';
      Toast('success', 'Participação enviada!');
    } catch(e) {
      console.error("Erro ao enviar:", e);
      Toast('error', 'Erro ao enviar.');
    } finally {
      if (btnEnviar) {
        btnEnviar.disabled = false;
        btnEnviar.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
      }
    }
  };

  window.voltarMuralAluno = () => {
    if (unsubscribeComentarios) unsubscribeComentarios();
    document.getElementById('mural-lista-container-aluno').style.display = 'block';
    document.getElementById('discussao-foco-container-aluno').style.display = 'none';
  };


  setTimeout(iniciarEscutaForumAluno, 300);

  return `
    <style>
      .forum-container { width:100%; font-family:'Inter',sans-serif; padding:5px 12px; box-sizing: border-box; }
      .header-divider { height: 2px; background: #003058; margin: 8px 0 12px 0; border-radius: 2px; opacity: 0.15; }
      .card-list-premium.compact { background:#fff; padding:0 15px; border-radius:10px; border:1px solid #eef2f6; border-left:4px solid #003058; margin-bottom:6px; cursor:pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.02); height: 50px; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; overflow: hidden; gap: 15px; }
      .card-info-main { display: flex; flex-direction: column; justify-content: center; flex: 1; min-width: 0; }
      .card-meta-side { display: flex; flex-direction: column; align-items: flex-end; justify-content: center; flex-shrink: 0; text-align: right; }
      .prazo-txt { font-size:8px; color:#94a3b8; font-weight:800; line-height: 1; text-transform: uppercase; }
      .prazo-data { font-size:10px; color:#dc2626; font-weight:800; margin-top: 2px; }
      .topico-titulo { margin:0; color:#003058; font-size:13px; font-weight:900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .topico-resumo { font-size:10px; color:#94a3b8; margin:0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
      .tag-pill-clm { font-size: 9px; font-weight: 800; color: #fff; background: #003058; padding: 2px 8px; border-radius: 4px; }
      .btn-voltar-premium { background: #f1f5f9; border: 1px solid #e2e8f0; color: #003058; padding: 8px 16px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; }
      .pergunta-prof-discreta { background: #fff; padding: 18px; border-radius: 12px; border: 1px solid #e2e8f0; border-top: 6px solid #003058; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); margin-bottom:20px; }
      .titulo-foco { margin:5px 0; color:#003058; font-size:16px; font-weight:800; }
      .descricao-foco { color:#475569; font-size:13px; margin-top:5px; line-height:1.5; }
      .footer-foco { margin-top:15px; display:flex; justify-content:space-between; align-items:center; }
      .btn-responder-principal { background: #003058; border: none; color: #fff; padding: 8px 20px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; }
      .msg-wrapper-clm { display:flex; margin-bottom:12px; width: 100%; }
      .msg-wrapper-clm.minha-msg { justify-content: flex-end; }
      .bubble-clm { max-width: 95%; padding: 12px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; color: #1e293b; position: relative; }
      @media (min-width: 768px) { .bubble-clm { max-width: 85%; padding: 12px 16px; } }
      .bubble-prof { border-left: 5px solid #475569 !important; background: #f8fafc !important; }
      .minha-msg .bubble-clm { background: #003058; color: white; border: none; }
      .reply-input-container { display:none; gap:8px; margin-top:10px; padding:10px; background:rgba(0,0,0,0.03); border-radius:8px; border: 1px dashed #cbd5e1; }
      .reply-input-container input { flex:1; border:none; background:transparent; outline:none; font-size:12px; color:inherit; }
      .reply-input-container button { background:#003058; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; }
      .paginacao-wrapper { display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 15px; padding: 10px 0 30px 0; border-top: 1px solid #f1f5f9; width: 100%; }
      .btn-paginacao { border: 1px solid #e2e8f0; background: white; color: #003058; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 12px; appearance: none; -webkit-appearance: none; -moz-appearance: none; }
      .btn-paginacao.ativo { background: #003058; color: white; border-color: #003058; }
      /* Remove setas de incremento em campos numéricos se houver no mobile */
      .btn-paginacao::-webkit-inner-spin-button, .btn-paginacao::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      .msg-meta-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 10px; }
      .msg-acoes-area { display: flex; align-items: center; gap: 8px; }
      .msg-icons { display: flex; gap: 5px; }
      .btn-reply-clm { cursor: pointer; opacity: 0.7; font-size: 11px; }
      .btn-reply-clm:hover { opacity: 1; }
      .me-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.2); margin-left: 4px; vertical-align: middle; text-transform: uppercase; }
      .minha-msg .msg-data-txt { color: rgba(255,255,255,0.7); font-size: 9px; }
      .aluno .msg-data-txt { color: #94a3b8; font-size: 9px; }

      @keyframes slideInSlim { from { transform: translateX(120%); opacity:0; } to { transform: translateX(0); opacity:1; } }
      @keyframes slideOutSlim { from { transform: translateX(0); opacity:1; } to { transform: translateX(120%); opacity:0; } }
      @keyframes fadeInModal { from { opacity: 0; } to { opacity: 1; } }
    </style>

    <div class="forum-container">
      <h1 style="color:#003058; font-weight:900; font-size:22px; margin:0;">FÓRUM</h1>
      <p style="color:#94a3b8; font-size:11px; font-weight:600; text-transform:uppercase; margin-bottom:5px;">Mural de Discussões</p>
      <div class="header-divider"></div>
      <div id="mural-lista-container-aluno">
        <div id="lista-topicos-area-aluno"></div>
        <div id="paginacao-aluno" class="paginacao-wrapper"></div>
      </div>
      <div id="discussao-foco-container-aluno" style="display:none;">
        <div id="foco-cabecalho-aluno"></div>
        <div id="foco-mensagens-box-aluno" style="margin-top:20px; display: flex; flex-direction: column; gap: 10px;"></div>
      </div>
    </div>
  `;
});
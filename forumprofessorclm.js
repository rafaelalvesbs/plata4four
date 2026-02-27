window.Router.register('forumprofessorclm', async () => {
  const { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, getDocs, where, updateDoc } = window.fsMethods;
  const db = window.db;
  const auth = window.authMethods.getAuth();

  let todosTopicos = [];
  let unsubComentarios = null;
  let topicoAtivoId = null;
  let paginaAtual = 1;
  const itensPorPagina = window.innerWidth <= 768 ? 5 : 9;

  const mostrarAvisoErro = (mensagem) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:sans-serif;';
    overlay.innerHTML = `
        <div style="background:white;padding:30px;border-radius:20px;max-width:350px;width:90%;text-align:center;box-shadow:0 20px 25px rgba(0,0,0,0.2);">
            <i class="fa-solid fa-circle-exclamation" style="font-size:3rem;color:#dc2626;margin-bottom:15px;"></i>
            <h3 style="margin:0 0 10px 0;color:#003058;">Atenção</h3>
            <p style="color:#64748b;font-size:14px;margin-bottom:20px;">${mensagem}</p>
            <button onclick="this.closest('div').parentElement.remove()" style="padding:10px 20px;border-radius:8px;border:none;background:#003058;color:white;cursor:pointer;font-weight:600;width:100%;">OK</button>
        </div>
    `;
    document.body.appendChild(overlay);
  };

  const confirmarExclusaoModal = (callback) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:sans-serif;';
    overlay.innerHTML = `
        <div style="background:white;padding:30px;border-radius:20px;max-width:350px;width:90%;text-align:center;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 40px; color: #ef4444; margin-bottom: 15px;"></i>
            <h3 style="color:#003058; margin:0;">Tem certeza?</h3>
            <p style="color:#64748b; font-size:14px; margin: 10px 0 20px 0;">Esta ação não pode ser desfeita.</p>
            <div style="display:flex; gap:10px;">
                <button style="flex:1; padding:10px; border-radius:8px; border:1px solid #e2e8f0; background:white; cursor:pointer;" onclick="this.closest('div').parentElement.parentElement.remove()">CANCELAR</button>
                <button id="btn-confirma-forum" style="flex:1; padding:10px; border-radius:8px; border:none; background:#ef4444; color:white; cursor:pointer; font-weight:600;">EXCLUIR</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    document.getElementById('btn-confirma-forum').onclick = () => { overlay.remove(); callback(); };
  };

  const iniciarEscutaForum = () => {
    const usuarioLogado = auth.currentUser;
    if (!usuarioLogado) return;

    const qTopicos = query(collection(db, "forum_topicos"), where("autorId", "==", usuarioLogado.uid));
    const qComents = query(collection(db, "forum_comentarios"));

    onSnapshot(qTopicos, (snapTopicos) => {
      onSnapshot(qComents, (snapComents) => {
        todosTopicos = snapTopicos.docs.map(docSnap => {
          const d = docSnap.data();
          const totalComents = snapComents.docs.filter(c => c.data().topicoId === docSnap.id).length;
          return {
            id: docSnap.id,
            ...d,
            contagemComentarios: totalComents,
            data: d.dataCriacao ? d.dataCriacao.toDate().toLocaleString('pt-BR') : 'Recente',
            validadeRaw: d.dataValidade || ""
          };
        }).sort((a, b) => (b.dataCriacao?.seconds || 0) - (a.dataCriacao?.seconds || 0));

if (!topicoAtivoId) {
          window.renderizarListaMural();
        }      });
    });
  };

  window.mudarAbaForum = (aba) => {
    document.querySelectorAll('.forum-aba-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`aba-${aba}`).style.display = 'block';
    document.getElementById(`tab-btn-${aba}`).classList.add('active');

    if (aba === 'criar') {
      const inputData = document.getElementById('forum-validade');
      if (inputData) {
        inputData.min = new Date().toISOString().split('T')[0];
      }
      // Garante que o botão esteja resetado ao entrar na aba
      const btnPublicar = document.getElementById('btn-publicar-forum');
      if (btnPublicar) {
        btnPublicar.disabled = false;
        btnPublicar.style.opacity = '1';
        btnPublicar.style.cursor = 'pointer';
        btnPublicar.innerHTML = 'PUBLICAR AGORA';
      }
    }
    
    if(aba === 'mural') window.voltarMural();
  };

  const carregarTurmasDoProfessor = async () => {
    const select = document.getElementById('forum-turma-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Buscando turmas...</option>';
    
    try {
      const usuarioLogado = auth.currentUser;
      if (!usuarioLogado) return;

      // Importante: buscando por professorResponsavelId para bater com a tela de turmas
      const q = query(collection(db, "turmas"), where("professorResponsavelId", "==", usuarioLogado.uid));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        select.innerHTML = '<option value="">Nenhuma turma vinculada a você</option>';
        return;
      }

      let html = '<option value="">Escolha a Turma...</option>';
      snap.forEach(docSnap => {
        const d = docSnap.data();
        html += `<option value="${d.senha}">${d.nomeCustomizado || d.nome}</option>`;
      });
      select.innerHTML = html;

    } catch (e) {
      console.error("Erro ao carregar turmas:", e);
      select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
  };

 window.criarTopicoForum = async () => {
    const titulo = document.getElementById('forum-titulo').value;
    const desc = document.getElementById('forum-desc').value;
    const validade = document.getElementById('forum-validade').value;
    const selT = document.getElementById('forum-turma-select');
    const dID = selT.value;
    const dNome = selT.options[selT.selectedIndex]?.text || "";
    const tipoD = "turma";

    if (!titulo.trim() || !desc.trim() || !dID || !validade) {
        return mostrarAvisoErro("Preencha todos os campos!");
    }

   const btnPublicar = document.getElementById('btn-publicar-forum');
    const originalTexto = btnPublicar.innerText;

    try {
      btnPublicar.disabled = true;
      btnPublicar.style.opacity = '0.7';
      btnPublicar.style.cursor = 'not-allowed';
      btnPublicar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PUBLICANDO...';

      const { getStorage, ref, uploadBytes, getDownloadURL } = window.storageMethods;
      const storage = getStorage();
      const blob = new Blob([desc], { type: 'text/html' });
      const caminho = `forum_descricois/${Date.now()}.html`;
      const storageRef = ref(storage, caminho);
      
      await uploadBytes(storageRef, blob);
      const urlDesc = await getDownloadURL(storageRef);

      await addDoc(collection(db, "forum_topicos"), {
        titulo, 
        descricaoUrl: urlDesc,
        descricaoPath: caminho,
        categoria: document.getElementById('forum-categoria').value,
        destinoTipo: tipoD, 
        destinoID: String(dID).trim(), 
        turmaNome: dNome, 
        dataValidade: validade,
        autor: window.usuarioLogado.nome || "Professor", 
        autorId: auth.currentUser.uid,
        dataCriacao: serverTimestamp()
      });
      
      if(window.mostrarToastSucesso) window.mostrarToastSucesso("Tópico publicado!");
      sessionStorage.removeItem('forum_rascunho_clm');
      document.getElementById('forum-titulo').value = '';
      document.getElementById('forum-desc').value = '';
      document.getElementById('forum-validade').value = '';
      document.getElementById('forum-turma-select').value = '';
      
      // Resetar o botão para o estado original
      btnPublicar.disabled = false;
      btnPublicar.style.opacity = '1';
      btnPublicar.style.cursor = 'pointer';
      btnPublicar.innerText = originalTexto;
      
      window.mudarAbaForum('mural');
    } catch (e) {
      console.error(e);
      btnPublicar.disabled = false;
      btnPublicar.style.opacity = '1';
      btnPublicar.style.cursor = 'pointer';
      btnPublicar.innerText = originalTexto;
      mostrarAvisoErro("Erro ao publicar tópico. Verifique sua conexão.");
    }
  };

  window.renderizarListaMural = () => {
    const container = document.getElementById('lista-topicos-area');
    if(!container) return;
    const paginados = todosTopicos.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);
    const totalPaginas = Math.ceil(todosTopicos.length / itensPorPagina);

    if(todosTopicos.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:40px;">Nenhum tópico.</p>';
        return;
    }

    let h = paginados.map(t => {
      const storageKey = `visto_forum_coments_${t.id}_${auth.currentUser.uid}`;
      const vistoCount = parseInt(localStorage.getItem(storageKey) || "0");
      const totalAtual = t.contagemComentarios || 0;
      const temNovo = totalAtual > vistoCount;
      const corFundo = temNovo ? '#e0f2fe' : '#fff';

      return `
        <div class="card-list-premium compact" onclick="window.abrirDiscussao('${t.id}', ${totalAtual})" style="position:relative; display:flex; align-items:center; justify-content:space-between; background:${corFundo}; padding:8px 15px; border-radius:8px; border:1px solid ${temNovo ? '#003058' : '#e2e8f0'}; border-left: 5px solid #003058; margin-bottom:4px; cursor:pointer; min-height:50px; width:100%; box-sizing:border-box;">
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="background:${temNovo ? '#003058' : '#e0f2fe'}; color:${temNovo ? '#fff' : '#0369a1'}; border: 1px solid #bae6fd; font-size:9px; padding:1px 6px; border-radius:4px; font-weight:700; white-space:nowrap;">${t.turmaNome}</span>
            <h4 style="margin:0; color:#003058; font-size:13px; font-weight:900; line-height:1.2;">${t.titulo.toUpperCase()}</h4>
            ${temNovo ? '<span style="background:#22c55e; color:#fff; font-size:8px; padding:2px 5px; border-radius:10px; font-weight:900;">NOVO</span>' : ''}
          </div>
          <div style="text-align:right; display:flex; flex-direction:column; justify-content:center;">
             <span style="font-size:7px; color:#94a3b8; font-weight:800; line-height:1;">EXPIRA EM</span>
             <span style="font-size:10px; color:#ef4444; font-weight:800;">${t.validadeRaw.split('-').reverse().join('/')}</span>
          </div>
        </div>
      `;
    }).join('');

    if(totalPaginas > 1) {
      let botoesPaginas = '';
      for (let i = 1; i <= totalPaginas; i++) {
        botoesPaginas += `<button class="pagination-item ${i === paginaAtual ? 'active' : ''}" onclick="window.mudarPaginaForum(${i})">${i}</button>`;
      }
      h += `<div class="pagination-area">
        ${botoesPaginas}
      </div>`;
    }
    container.innerHTML = h;
  };

  window.mudarPaginaForum = (p) => { paginaAtual = p; window.renderizarListaMural(); };

 window.abrirDiscussao = async (id, totalComentarios) => {
    topicoAtivoId = id;
    const usuarioLogado = auth.currentUser;
    if (usuarioLogado && totalComentarios !== undefined) {
      localStorage.setItem(`visto_forum_coments_${id}_${usuarioLogado.uid}`, totalComentarios);
    }
    const topico = todosTopicos.find(t => t.id === id);
    
    let textoDescricao = "Carregando...";
    if (topico.descricaoUrl) {
      try {
        const res = await fetch(topico.descricaoUrl, { mode: 'cors' });
        textoDescricao = await res.text();
      } catch (e) { textoDescricao = "Erro ao carregar descrição."; }
    } else {
      textoDescricao = topico.descricao || "Sem descrição.";
    }

    document.getElementById('mural-lista-container').style.display = 'none';
    document.getElementById('discussao-foco-container').style.display = 'block';
    
    document.getElementById('foco-cabecalho').innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <button onclick="window.voltarMural()" style="background:#f1f5f9; border:none; color:#003058; padding:5px 12px; border-radius:6px; font-size:10px; font-weight:800; cursor:pointer;"><i class="fa-solid fa-arrow-left"></i> VOLTAR</button>
        <div style="display:flex; gap:6px;">
          <button style="background:#e0f2fe; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; color:#0369a1; font-size:12px;" onclick="window.prepararEdicaoTopico('${id}')"><i class="fa-solid fa-pen-to-square"></i></button>
          <button style="background:#fee2e2; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; color:#ef4444; font-size:12px;" onclick="window.excluirTopicoForum('${id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div style="background:#fff; padding:10px 15px; border-radius:8px; border:1px solid #e2e8f0; border-left:5px solid #003058; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:5px;">
          <span style="background:#003058; color:white; font-size:9px; font-weight:800; padding:2px 6px; border-radius:4px;">${topico.turmaNome}</span>
          <h2 style="margin:0; color:#003058; font-size:15px; font-weight:900;">${topico.titulo.toUpperCase()}</h2>
        </div>
        <div style="color:#475569; font-size:12px; margin:0 0 8px 0; line-height:1.3;">${textoDescricao}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding-top:6px; border-top:1px solid #f1f5f9;">
          <div style="display:flex; align-items:center; gap:6px;">
            <div style="width:20px; height:20px; background:#e2e8f0; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#003058; font-weight:800; font-size:9px;">${topico.autor.charAt(0)}</div>
            <span style="font-size:11px; color:#1e293b; font-weight:700;">${topico.autor}</span>
          </div>
          <span style="font-size:10px; color:#94a3b8; font-weight:600;"><i class="fa-regular fa-clock"></i> ${topico.data}</span>
        </div>
      </div>
    `;
    window.escutarMensagensFoco(id);
  };

  window.voltarMural = () => {
    topicoAtivoId = null;
    if(unsubComentarios) unsubComentarios();
    document.getElementById('mural-lista-container').style.display = 'block';
    document.getElementById('discussao-foco-container').style.display = 'none';
    window.renderizarListaMural();
  };

  window.escutarMensagensFoco = (topicoId) => {
    const q = query(collection(db, "forum_comentarios"), where("topicoId", "==", topicoId), orderBy("data", "asc"));
    unsubComentarios = onSnapshot(q, (snap) => {
      const box = document.getElementById('foco-mensagens-box');
      if(!box) return;
      box.innerHTML = snap.docs.map(d => {
        const c = d.data();
        const msgId = d.id;
        const souEu = c.autorId === auth.currentUser.uid;
        const dt = c.data ? c.data.toDate().toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '...';
        
        return `
          <div class="msg-wrapper-clm ${souEu ? 'prof' : 'aluno'}" id="msg-${msgId}">
            <div class="bubble-clm">
              ${c.citacao ? `<div class="citacao-clm"><b>Em resposta a ${c.citacao.nome}:</b> <i>"${c.citacao.texto}"</i></div>` : ''}
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:15px;">
                <small style="font-weight:700; font-size:11px; color:${souEu ? '#fff' : '#003058'}">${c.autor} ${souEu ? '<span class="me-badge">VOCÊ</span>' : ''}</small>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:9px; color:${souEu ? 'rgba(255,255,255,0.7)' : '#94a3b8'};">${dt}</span>
                  <i class="fa-solid fa-reply btn-reply-clm" style="color:${souEu ? '#fff' : '#94a3b8'}" onclick="window.exibirInputResposta('${msgId}')"></i>
                </div>
              </div>
              <p style="margin:0; font-size:13px; line-height:1.4;">${c.texto}</p>
              <div id="input-direto-${msgId}" class="reply-input-container">
                <input type="text" id="campo-${msgId}" autocomplete="off" placeholder="Responder..." onkeyup="if(event.key==='Enter') window.enviarRespostaInline('${topicoId}', '${msgId}', '${c.autor}', '${c.texto.replace(/'/g, "\\'")}')">
                <button onclick="window.enviarRespostaInline('${topicoId}', '${msgId}', '${c.autor}', '${c.texto.replace(/'/g, "\\'")}')"><i class="fa-solid fa-paper-plane"></i></button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    });
  };

  window.exibirInputResposta = (msgId) => {
    const div = document.getElementById(`input-direto-${msgId}`);
    const isVisible = div.style.display === 'flex';
    document.querySelectorAll('.reply-input-container').forEach(el => el.style.display = 'none');
    div.style.display = isVisible ? 'none' : 'flex';
    if(!isVisible) document.getElementById(`campo-${msgId}`).focus();
  };

  window.enviarRespostaInline = async (topicoId, msgId, nome, texto) => {
    const input = document.getElementById(`campo-${msgId}`);
    const btnEnviar = document.querySelector(`#input-direto-${msgId} button`);
    if(!input.value.trim() || btnEnviar.disabled) return;
    
    const citacaoFinal = msgId === 'main' ? null : { nome, texto: texto.substring(0, 50) + (texto.length > 50 ? '...' : '') };

    btnEnviar.disabled = true;
    btnEnviar.style.opacity = '0.5';
    btnEnviar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    // Identifica o tópico atual para pegar o número de comentários
    const topicoRef = todosTopicos.find(t => t.id === topicoId);
    if (topicoRef) {
      // Soma +1 ao contador local para marcar como lido imediatamente
      const novoTotal = (topicoRef.contagemComentarios || 0) + 1;
      localStorage.setItem(`visto_forum_coments_${topicoId}_${auth.currentUser.uid}`, novoTotal);
    }

    try {
      await addDoc(collection(db, "forum_comentarios"), {
        topicoId, 
        texto: input.value, 
        autor: window.usuarioLogado.nome || "Professor",
        autorId: auth.currentUser.uid, 
        data: serverTimestamp(), 
        citacao: citacaoFinal
      });

      input.value = '';
      document.getElementById(`input-direto-${msgId}`).style.display = 'none';
    } catch (e) {
      console.error(e);
      window.mostrarToastErro?.("Erro ao enviar mensagem.");
    } finally {
      btnEnviar.disabled = false;
      btnEnviar.style.opacity = '1';
      btnEnviar.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
    }
  };

  window.excluirTopicoForum = (id) => {
    confirmarExclusaoModal(async () => {
        const topico = todosTopicos.find(t => t.id === id);
        if (topico?.descricaoPath) {
          try {
            const { getStorage, ref, deleteObject } = window.storageMethods;
            await deleteObject(ref(getStorage(), topico.descricaoPath));
          } catch (e) { console.error("Erro ao deletar arquivo do Storage", e); }
        }
        await deleteDoc(doc(db, "forum_topicos", id));
        if(window.mostrarToastSucesso) window.mostrarToastSucesso("Excluído!");
        window.voltarMural();
    });
  };

  let idEdicaoAtivo = null;

  window.prepararEdicaoTopico = async (id) => {
    const topico = todosTopicos.find(t => t.id === id);
    if (!topico) return;

    idEdicaoAtivo = id;
    
    // Preenche os campos
    document.getElementById('forum-titulo').value = topico.titulo;
    document.getElementById('forum-validade').value = topico.validadeRaw;
    document.getElementById('forum-categoria').value = topico.categoria;
    document.getElementById('forum-turma-select').value = topico.destinoID;
    
    // Carrega a descrição do Storage para o textarea
    if (topico.descricaoUrl) {
      try {
        const res = await fetch(topico.descricaoUrl);
        document.getElementById('forum-desc').value = await res.text();
      } catch (e) { console.error("Erro ao carregar texto para edição", e); }
    }

    // Altera o visual do botão e muda de aba
    const btn = document.getElementById('btn-publicar-forum');
    btn.innerText = "SALVAR ALTERAÇÕES";
    btn.style.background = "#0369a1";
    
    window.mudarAbaForum('criar');
  };

  // Ajuste na função de criar para suportar edição
  const originalCriar = window.criarTopicoForum;
  window.criarTopicoForum = async () => {
    if (!idEdicaoAtivo) {
      await originalCriar();
      return;
    }

    const titulo = document.getElementById('forum-titulo').value;
    const desc = document.getElementById('forum-desc').value;
    const validade = document.getElementById('forum-validade').value;
    const selT = document.getElementById('forum-turma-select');
    
    if (!titulo.trim() || !desc.trim() || !validade || !selT.value) {
      return mostrarAvisoErro("Preencha todos os campos!");
    }

    const btn = document.getElementById('btn-publicar-forum');
    try {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> SALVANDO...';

      // Atualiza o arquivo no Storage (ou cria novo se preferir manter histórico)
      const { getStorage, ref, uploadBytes, getDownloadURL } = window.storageMethods;
      const blob = new Blob([desc], { type: 'text/html' });
      const topicoOriginal = todosTopicos.find(t => t.id === idEdicaoAtivo);
      const caminho = topicoOriginal.descricaoPath || `forum_descricois/${Date.now()}.html`;
      
      await uploadBytes(ref(getStorage(), caminho), blob);
      const urlDesc = await getDownloadURL(ref(getStorage(), caminho));

      await updateDoc(doc(db, "forum_topicos", idEdicaoAtivo), {
        titulo,
        descricaoUrl: urlDesc,
        categoria: document.getElementById('forum-categoria').value,
        destinoID: selT.value,
        turmaNome: selT.options[selT.selectedIndex].text,
        dataValidade: validade
      });

      if(window.mostrarToastSucesso) window.mostrarToastSucesso("Tópico atualizado!");
      
      // Reset de estado
      idEdicaoAtivo = null;
      btn.innerText = "PUBLICAR AGORA";
      btn.style.background = "#003058";
      btn.disabled = false;
      
      document.getElementById('forum-titulo').value = '';
      document.getElementById('forum-desc').value = '';
      document.getElementById('forum-validade').value = '';
      window.mudarAbaForum('mural');
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      btn.innerText = "SALVAR ALTERAÇÕES";
      mostrarAvisoErro("Erro ao atualizar tópico.");
    }
  };

 setTimeout(() => { 
    iniciarEscutaForum(); 
    carregarTurmasDoProfessor(); 
    
    // Recuperar rascunho ao carregar
    const rascunho = JSON.parse(sessionStorage.getItem('forum_rascunho_clm') || '{}');
    if (rascunho.titulo) document.getElementById('forum-titulo').value = rascunho.titulo;
    if (rascunho.desc) document.getElementById('forum-desc').value = rascunho.desc;
    if (rascunho.validade) document.getElementById('forum-validade').value = rascunho.validade;
    if (rascunho.turma) document.getElementById('forum-turma-select').value = rascunho.turma;

    // Salvar rascunho automaticamente ao digitar
    const salvarRascunho = () => {
      const dados = {
        titulo: document.getElementById('forum-titulo').value,
        desc: document.getElementById('forum-desc').value,
        validade: document.getElementById('forum-validade').value,
        turma: document.getElementById('forum-turma-select').value
      };
      sessionStorage.setItem('forum_rascunho_clm', JSON.stringify(dados));
    };

    ['forum-titulo', 'forum-desc', 'forum-validade', 'forum-turma-select'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', salvarRascunho);
    });
  }, 500);

  return `
    <style>
      .forum-container { width:100%; font-family:'Inter',sans-serif; padding:5px 10px; box-sizing: border-box; }
      .main-tabs-clm { display:flex; gap:10px; margin-bottom:15px; border-bottom:2px solid #f1f5f9; }
      .main-tab-btn { padding:10px 15px; border:none; background:none; cursor:pointer; font-weight:800; color:#94a3b8; font-size:11px; text-transform:uppercase; }
      .main-tab-btn.active { color:#003058; border-bottom:3px solid #003058; }
      .btn-voltar-premium { background: #f1f5f9; border: 1px solid #e2e8f0; color: #003058; padding: 8px 16px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; }
      .card-premium-clm { background:#fff; border-radius:10px; padding:15px; border:1px solid #eef2f6; }
      .input-clm { width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; font-size:13px; background:#f8fafc; margin-bottom:12px; outline:none; box-sizing: border-box; }
      .label-clm { font-size:10px; font-weight:800; color:#94a3b8; text-transform:uppercase; display:block; margin-bottom:4px; }
     .grid-resp-clm { display: grid; grid-template-columns: 1fr; gap: 10px; }
      @media (min-width: 768px) { .grid-resp-clm { grid-template-columns: 1fr 1fr; gap: 15px; } }

      @media (max-width: 600px) {
        .forum-container { padding: 5px; }
        .card-list-premium.compact { 
          flex-direction: column !important; 
          height: auto !important; 
          align-items: flex-start !important; 
          gap: 10px !important;
          padding: 12px !important;
        }
        .card-list-premium.compact div:last-child {
          width: 100%;
          text-align: left !important;
          border-top: 1px solid #f1f5f9;
          padding-top: 5px;
          flex-direction: row !important;
          justify-content: space-between !important;
        }
        .pagination-area { flex-wrap: wrap; gap: 10px; }
        .pagination-area { justify-content: center; gap: 15px; margin-top: 25px; }
        .pagination-item { width: 45px; height: 45px; font-size: 18px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
      }
      .bubble-clm { max-width: 95%; padding: 12px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; }
      @media (min-width: 768px) { .bubble-clm { max-width: 85%; padding: 12px 16px; } }
      .prof .bubble-clm { background: #003058; color: white; border: none; }
      .msg-wrapper-clm { display:flex; margin-bottom:12px; }
      .msg-wrapper-clm.prof { justify-content: flex-end; }
      .reply-input-container { display:none; gap:8px; margin-top:10px; padding:10px; background:rgba(0,0,0,0.03); border-radius:8px; border: 1px dashed #cbd5e1; }
      .reply-input-container input { flex:1; border:none; background:transparent; outline:none; font-size:12px; color:inherit; }
      .reply-input-container button { background:#0ea5e9; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; }
.card-list-premium.compact { transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.card-list-premium.compact:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border-color: #003058; }
      .tag-pill-clm { font-size: 9px; font-weight: 800; color: #fff; background: #003058; padding: 2px 8px; border-radius: 4px; }
      input[type="date"]::-webkit-calendar-picker-indicator {
  cursor: pointer;
}
input[type="date"]:invalid {
  color: #cbd5e1;
}
input[type="date"] {
  accent-color: #003058;
  cursor: pointer;
  user-select: none;
}

.msg-wrapper-clm { display:flex; margin-bottom:15px; width:100%; }
.bubble-clm { background:#fff; border:1px solid #e2e8f0; border-radius:15px; padding:15px; box-shadow:0 2px 4px rgba(0,0,0,0.02); position:relative; }
.citacao-clm { background:#f8fafc; border-left:3px solid #003058; padding:8px 12px; border-radius:6px; margin-bottom:10px; font-size:12px; color:#64748b; }

.pagination-area { display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 15px; padding-top: 10px; border-top: 1px solid #f1f5f9; flex-wrap: wrap; }

@media (min-width: 769px) {
    .pagination-area { margin-top: 6px; }
}
.pagination-item { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; color: #475569; font-weight: 600; font-size: 16px; cursor: pointer; transition: 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
.pagination-item.active { background: #003058; color: #fff; border-color: #003058; font-weight: 700; }
.pagination-item:hover:not(.active) { background: #f8fafc; border-color: #cbd5e1; }
    </style>

    <div class="forum-container">
      <h1 style="color:#003058; font-weight:900; font-size:32px; margin:0;">FÓRUM</h1>
      <div style="margin-bottom: 20px;"></div>

      <div class="main-tabs-clm">
        <button id="tab-btn-criar" class="main-tab-btn" onclick="window.mudarAbaForum('criar')">CRIAR TÓPICO</button>
        <button id="tab-btn-mural" class="main-tab-btn active" onclick="window.mudarAbaForum('mural')">MURAL</button>
      </div>

      <div id="aba-criar" class="forum-aba-content" style="display:none;">
        <div class="card-premium-clm">
          <div class="grid-resp-clm">
            <div>
              <label class="label-clm">Selecione a Turma</label>
              <select id="forum-turma-select" class="input-clm">
                <option value="">Carregando...</option>
              </select>
            </div>
            <div>
              <label class="label-clm">Prazo de Validade</label>
              <input type="date" id="forum-validade" class="input-clm" 
                onkeydown="return false" 
                onpaste="return false" 
                onclick="this.showPicker()"
                onfocus="this.min=new Date().toISOString().split('T')[0]">
            </div>
          </div>
          <div class="grid-resp-clm">
            <div><label class="label-clm">Título</label><input type="text" id="forum-titulo" class="input-clm" autocomplete="off" placeholder="Assunto..."></div>
            <div><label class="label-clm">Categoria</label><select id="forum-categoria" class="input-clm"><option>Dúvida</option><option>Debate</option></select></div>
          </div>
          <label class="label-clm">Conteúdo Principal</label>
          <textarea id="forum-desc" class="input-clm" autocomplete="off" rows="4" style="resize:none;" placeholder="O que os alunos devem discutir?"></textarea>
          <button id="btn-publicar-forum" onclick="window.criarTopicoForum()" style="background:#003058; color:#fff; border:none; padding:15px; width:100%; border-radius:10px; font-weight:800; cursor:pointer;">PUBLICAR AGORA</button>
        </div>
      </div>

      <div id="aba-mural" class="forum-aba-content" style="display:block;">
        <div id="mural-lista-container"><div id="lista-topicos-area"></div></div>
        <div id="discussao-foco-container" style="display:none;">
          <div id="foco-cabecalho"></div>
          <div id="foco-mensagens-box" style="margin-top:20px; display: flex; flex-direction: column;"></div>
        </div>
      </div>
    </div>
  `;
});
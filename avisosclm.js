window.Router.register('avisosclm', async () => {
  let todosOsAvisos = [];
  let paginaAtual = 0;
  const itensPorPagina = 3;
  const db = window.db;
  const { doc, getDoc, collection, query, where, getDocs, orderBy, deleteDoc } = window.fsMethods;
  const azulPadrao = "#003058";

  const carregarDadosFirebase = async () => {
    const listaDiv = document.getElementById('render-avisos');
    if (!listaDiv) return;

    try {
      const auth = window.authMethods.getAuth();
      const userRef = auth.currentUser;
      if (!userRef) return;

      const alunoDoc = await getDoc(doc(db, "usuarios", userRef.uid));
      if (!alunoDoc.exists()) return;
      
      const dadosAluno = alunoDoc.data();
      const codigoTurmaDoAluno = dadosAluno.turma; 

      let nomeCustomizadoTurma = "";

      if (codigoTurmaDoAluno) {
        const turmasRef = collection(db, "turmas");
        const qTurma = query(turmasRef, where("senha", "==", codigoTurmaDoAluno));
        const querySnapshotTurma = await getDocs(qTurma);

        if (!querySnapshotTurma.empty) {
          nomeCustomizadoTurma = querySnapshotTurma.docs[0].data().nomeCustomizado;
        }
      }

      const qAvisos = query(
        collection(db, "avisos"), 
        orderBy("dataCriacao", "desc")
      );
      
      const snapAvisos = await getDocs(qAvisos);
      const todosAvisosBanco = snapAvisos.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      todosOsAvisos = todosAvisosBanco.filter(av => {
        const turmaDoAviso = String(av.turma || "").trim();
        return turmaDoAviso === "Todas as turmas" || (nomeCustomizadoTurma && turmaDoAviso === nomeCustomizadoTurma.trim());
      });

      renderizarPaginaAvisos();
    } catch (e) {
      console.error("Erro ao carregar avisos:", e);
      listaDiv.innerHTML = '<p style="color:#ef4444; text-align:center; font-size:0.8rem;">Erro ao carregar o mural.</p>';
    }
  };

  const renderizarPaginaAvisos = () => {
    const listaDiv = document.getElementById('render-avisos');
    const btnPrev = document.getElementById('btn-prev-avisos');
    const btnNext = document.getElementById('btn-next-avisos');
    const contadorPagina = document.getElementById('contador-pagina-avisos');
    
    if (!listaDiv) return;

    if (todosOsAvisos.length === 0) {
      listaDiv.innerHTML = '<p style="font-size:0.8rem; color:#64748b; text-align:center; padding:20px;">Nenhum aviso para sua turma no momento.</p>';
      if(contadorPagina) contadorPagina.parentElement.style.display = 'none';
      return;
    }

    const totalPaginas = Math.ceil(todosOsAvisos.length / itensPorPagina);
    const inicio = paginaAtual * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const avisosExibidos = todosOsAvisos.slice(inicio, fim);

    listaDiv.innerHTML = avisosExibidos.map(av => {
      const idAviso = av.id;
      
      let dataFormatada = "--/--/----";
      if (av.dataCriacao) {
        const d = av.dataCriacao.toDate ? av.dataCriacao.toDate() : new Date(av.dataCriacao);
        dataFormatada = d.toLocaleDateString('pt-BR');
      }

      return `
        <div class="card-compacto" style="border-left: 4px solid ${azulPadrao}; margin-bottom: 12px; padding: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); background: #fff; border-radius: 12px; display: flex; flex-direction: column; position: relative;">
        
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 6px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase;">
              ${av.turma || 'Geral'}
            </span>
            <span style="color: #94a3b8; font-size: 0.7rem; font-weight: 600;">
               <i class="fa-regular fa-calendar" style="margin-right: 3px;"></i>${dataFormatada}
            </span>
          </div>

          <h4 style="margin: 0 0 8px 0; font-size: 0.9rem; color: ${azulPadrao}; font-weight: 700; line-height: 1.2; word-break: break-word;">${av.titulo}</h4>
          
          <div style="color: #64748b; font-size: 0.8rem; line-height: 1.5; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; border-top: 1px solid #f1f5f9; padding-top: 8px;">
            ${av.conteudo}
          </div>

          <button onclick="window.prepararVerAviso('${idAviso}')" style="background:none; border:none; color:#0369a1; font-size:0.75rem; font-weight:800; cursor:pointer; padding: 8px 0 0 0; text-align: left; width: fit-content;">
          Ver mais
        </button>
        </div>`;
    }).join('');

    if (contadorPagina) {
        contadorPagina.innerText = `${paginaAtual + 1} de ${totalPaginas}`;
    }

    if(btnPrev && btnNext) {
        btnPrev.style.opacity = paginaAtual === 0 ? "0.3" : "1";
        btnPrev.style.pointerEvents = paginaAtual === 0 ? "none" : "auto";
        btnNext.style.opacity = fim >= todosOsAvisos.length ? "0.3" : "1";
        btnNext.style.pointerEvents = fim >= todosOsAvisos.length ? "none" : "auto";
    }
  };
  
window.prepararVerAviso = (id) => {
  const aviso = todosOsAvisos.find(a => a.id === id);
  if (aviso) {
    window.verAvisoCompleto(aviso.titulo, aviso.conteudo);
  }
};

  window.verAvisoCompleto = (titulo, conteudo) => {
    const modalHTML = `
      <div id="modal-aviso" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,48,88,0.4); display:flex; justify-content:center; align-items:center; z-index:9999; padding:20px; backdrop-filter: blur(6px);">
        <div style="background:white; padding:35px; border-radius:20px; max-width:600px; width:100%; max-height:85vh; overflow-y:auto; box-shadow:0 20px 50px rgba(0,0,0,0.3);">
          <h2 style="color:${azulPadrao}; margin-top:0; font-weight:800; line-height:1.2;">${titulo}</h2>
          <hr style="border:0; border-top:1px solid #f1f5f9; margin:20px 0;">
          <div style="color:#475569; line-height:1.7; font-size:1rem;">${conteudo}</div>
          <button onclick="document.getElementById('modal-aviso').remove()" style="margin-top:25px; width:100%; padding:14px; background:${azulPadrao}; color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700; font-size:1rem; box-shadow:0 5px 15px rgba(0,48,88,0.2);">OK</button>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  };

  window.mudarPaginaAvisos = (direcao) => {
    if (direcao === 1 && (paginaAtual + 1) * itensPorPagina < todosOsAvisos.length) {
      paginaAtual++;
      renderizarPaginaAvisos();
    } else if (direcao === -1 && paginaAtual > 0) {
      paginaAtual--;
      renderizarPaginaAvisos();
    }
  };

  setTimeout(carregarDadosFirebase, 100);

  return `
    <div class="header-prof">
      <h1 style="font-size: 1.8rem; margin-bottom: 5px; color:${azulPadrao}; font-weight:800;">MURAL DE AVISOS</h1>
      <p style="font-size: 0.9rem; color: #64748b;">Confira as últimas atualizações sobre a sua turma ou sobre o Centro de Línguas.</p>
    </div>
    
    <hr class="divisor" style="margin: 15px 0 25px 0; border-color:#e2e8f0;">
    
    <div id="render-avisos" style="width: 100%; display: flex; flex-direction: column; gap: 5px; min-height: 380px;">
      <p style="text-align:center; color:#64748b; padding: 20px;">Buscando avisos...</p>
    </div>

    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; margin-top: 25px; padding-top: 20px; border-top: 1px solid #edf2f7;">
        <span id="contador-pagina-avisos" style="font-size: 0.75rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Carregando...</span>
        <div style="display: flex; gap: 20px;">
            <button id="btn-prev-avisos" onclick="window.mudarPaginaAvisos(-1)" style="border: none; background: ${azulPadrao}; color: white; width: 40px; height: 40px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.3s; box-shadow: 0 4px 10px rgba(0,48,88,0.2);">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <button id="btn-next-avisos" onclick="window.mudarPaginaAvisos(1)" style="border: none; background: ${azulPadrao}; color: white; width: 40px; height: 40px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.3s; box-shadow: 0 4px 10px rgba(0,48,88,0.2);">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>
    </div>
  `;
});
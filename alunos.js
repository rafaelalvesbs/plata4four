window.Router.register('alunos', async () => {
  let abaAtiva = localStorage.getItem('aba_inicial_alunos') || 'solicitacoes';
  localStorage.removeItem('aba_inicial_alunos');
  let paginaAtual = 1;
  const itensPorPagina = 7;
  let dadosOriginais = [];
  let turmaSelecionada = 'TODAS AS TURMAS';

  window.filtrarPorTurma = (turma) => {
    turmaSelecionada = turma;
    paginaAtual = 1;
    window.renderizarPaginaAlunos();
  };

  window.setAbaAlunos = (aba) => {
    abaAtiva = aba;
    paginaAtual = 1;
    turmaSelecionada = 'TODAS AS TURMAS';

    const selectFiltro = document.getElementById('filtroTurmaAlunos');
    if (selectFiltro) selectFiltro.value = 'TODAS AS TURMAS';

    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === aba);
    });

    window.renderizarPaginaAlunos();
  };

  window.renderizarPaginaAlunos = () => {
    const container = document.getElementById('lista-conteudo-dinamico');
    const areaFiltro = document.getElementById('filtroTurmaAlunos')?.parentElement;
    if (!container) return;

    // Esconde o filtro na aba de solicitações e mostra na de ativos
    if (areaFiltro) {
      areaFiltro.style.display = abaAtiva === 'solicitacoes' ? 'none' : 'flex';
    }

    let filtrados = dadosOriginais.filter(item => item.status === (abaAtiva === 'solicitacoes' ? 'pendente' : 'aprovado'));
    
    if (abaAtiva === 'ativos' && turmaSelecionada !== 'TODAS AS TURMAS') {
      filtrados = filtrados.filter(item => item.nomeDaTurma === turmaSelecionada);
    }
    
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const exibidos = filtrados.slice(inicio, fim);
    const totalPaginas = Math.ceil(filtrados.length / itensPorPagina);

    if (exibidos.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:40px; color:#64748b;">Nenhum registro encontrado nesta aba.</div>`;
      return;
    }

    let html = `<div class="lista-vertical">`;
    exibidos.forEach(aluno => {
      const partesNome = (aluno.nome || "Sem Nome").split(" ");
      const nomeExibicao = partesNome.length > 1 ? `${partesNome[0]} ${partesNome[1]}` : partesNome[0];

      if (abaAtiva === 'solicitacoes') {
        html += `
          <div class="card-item-horizontal">
            <div class="info-linha">
              <div style="flex: 1.5; display: flex; align-items: center; gap: 10px;">
              <strong style="color: #1e293b; text-transform: uppercase; white-space: nowrap;">${nomeExibicao}</strong>
              <span style="font-size: 0.75rem; color: #64748b; white-space: nowrap;">(${aluno.email})</span>
            </div>
              <div style="flex: 1.2; color: #004b87; font-weight: 700; font-size: 0.85rem;">${aluno.nomeDaTurma}</div>
              <div style="flex: 0.8; color: #94a3b8; font-size: 0.75rem; text-align:right; margin-right: 15px;">
              <i class="fa-regular fa-calendar"></i> ${aluno.dataF}
            </div>
            </div>
            <div class="card-acoes">
                <button class="btn-aprovar-blue" onclick="window.aprovarAluno('${aluno.id}')">Aprovar</button>
                <button class="btn-recusar" onclick="window.recusarAluno('${aluno.id}')">Recusar</button>
            </div>
          </div>`;
      } else {
        html += `
          <div class="card-item-horizontal">
            <div class="info-linha">
              <div style="flex: 1.2;">
                <strong style="color: #1e293b; text-transform: uppercase;">${nomeExibicao}</strong>
              </div>
              <div style="flex: 1; color: #004b87; font-weight: 700; font-size: 0.85rem;">
                <i class="fa-solid fa-users-rectangle" style="margin-right:5px; opacity:0.5;"></i>${aluno.nomeDaTurma}
              </div>
              <div style="flex: 1.5; color: #64748b; font-size: 0.85rem; word-break: break-all;">
                ${aluno.email}
              </div>
              <div style="flex: 0.8; color: #94a3b8; font-size: 0.75rem; text-align: right;">
                <i class="fa-regular fa-calendar"></i> ${aluno.dataF}
              </div>
            </div>
          </div>`;
      }
    });
    html += `</div>`;

    if (totalPaginas > 1) {
      html += `<div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:30px; margin-bottom: 20px;">`;
      
      for (let i = 1; i <= totalPaginas; i++) {
        const estaAtiva = i === paginaAtual;
        html += `
          <button onclick="window.irParaPaginaAlunos(${i})" style="
            width: 40px; 
            height: 40px; 
            border-radius: 10px; 
            border: 1px solid ${estaAtiva ? '#003058' : '#e2e8f0'}; 
            background: ${estaAtiva ? '#003058' : 'white'}; 
            color: ${estaAtiva ? 'white' : '#64748b'}; 
            font-weight: 700; 
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
          ">${i}</button>`;
      }
      
      html += `</div>`;
    }
    container.innerHTML = html;
  };

  window.mudarPaginaSolicitacao = (dir) => { paginaAtual += dir; window.renderizarPaginaAlunos(); };

  window.carregarSolicitacoes = async () => {
    const container = document.getElementById('lista-conteudo-dinamico');
    const selectFiltro = document.getElementById('filtroTurmaAlunos');
    if (!container) return;
    try {
      const auth = window.authMethods?.getAuth();
      const userLogado = auth?.currentUser;
      if (!userLogado) return;

      const qTurmas = window.fsMethods.query(window.fsMethods.collection(window.db, "turmas"), window.fsMethods.where("professorResponsavelId", "==", userLogado.uid));
      const snapTurmas = await window.fsMethods.getDocs(qTurmas);
      
      const senhasProfessor = [];
      const mapaTurmas = {};
      
      if (selectFiltro) {
        selectFiltro.innerHTML = '<option value="TODAS AS TURMAS">Todas as turmas</option>';
      }

      snapTurmas.forEach(tDoc => {
        const d = tDoc.data();
        const nomeT = d.nomeCustomizado || d.curso || d.nome || "Turma";
        const senhaLimpa = (d.senha || "").toString().trim().toUpperCase();
        senhasProfessor.push(senhaLimpa);
        mapaTurmas[senhaLimpa] = nomeT;

        // Se a turma tiver nome longo no Storage, baixa e atualiza o mapa e o select
        if (d.nomeCompletoUrl) {
          fetch(d.nomeCompletoUrl)
            .then(r => r.text())
            .then(textoCompleto => {
              mapaTurmas[senhaLimpa] = textoCompleto;
              // Atualiza o texto no select de filtros se ele já existir
              if (selectFiltro) {
                const options = selectFiltro.options;
                for (let i = 0; i < options.length; i++) {
                  if (options[i].value === nomeT) {
                    options[i].text = textoCompleto;
                    options[i].value = textoCompleto;
                  }
                }
              }
              // Força uma nova renderização para mostrar o nome completo na lista
              window.renderizarPaginaAlunos();
            })
            .catch(err => console.error("Erro ao baixar nome longo da turma:", err));
        }

        if (selectFiltro) {
          const opt = document.createElement('option');
          opt.value = nomeT;
          opt.textContent = nomeT;
          selectFiltro.appendChild(opt);
        }
      });

      const snapAlunos = await window.fsMethods.getDocs(window.fsMethods.collection(window.db, "usuarios"));
      const listaGeral = [];
      snapAlunos.forEach(docSnap => {
        const aluno = docSnap.data();
        const codAcesso = (aluno.codigoAcesso || aluno.turma || "").toString().trim().toUpperCase();
        if (senhasProfessor.includes(codAcesso)) {
          const dataObj = aluno.dataCriacao?.seconds ? new Date(aluno.dataCriacao.seconds * 1000) : new Date();
          listaGeral.push({ id: docSnap.id, ...aluno, nomeDaTurma: mapaTurmas[codAcesso], dataF: dataObj.toLocaleDateString('pt-BR') });
        }
      });
      dadosOriginais = listaGeral;
      window.renderizarPaginaAlunos();

      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === abaAtiva);
      });
    } catch (e) { console.error(e); }
  };

  window.irParaPaginaAlunos = (num) => { 
    paginaAtual = num; 
    window.renderizarPaginaAlunos(); 
  };

  // 3. FUNÇÕES DE APROVAÇÃO
  window.fecharModalAprovar = () => { document.getElementById('modalAprovarAluno').style.display = 'none'; };
  window.aprovarAluno = (id) => {
    const modal = document.getElementById('modalAprovarAluno');
    modal.style.display = 'flex';
    document.getElementById('btnConfirmarAprovar').onclick = async () => {
      try {
        await window.fsMethods.updateDoc(window.fsMethods.doc(window.db, "usuarios", id), {
          status: 'aprovado',
          dataAprovacao: new Date()
        });
        window.fecharModalAprovar();
        window.carregarSolicitacoes();
      } catch (e) { alert("Erro ao aprovar."); }
    };
  };

  // 4. FUNÇÕES DE RECUSA
  window.fecharModalRecusar = () => { document.getElementById('modalRecusarAluno').style.display = 'none'; };
  window.recusarAluno = (id) => {
    const modal = document.getElementById('modalRecusarAluno');
    modal.style.display = 'flex';
    document.getElementById('btnConfirmarRecusar').onclick = async () => {
      try {
        await window.fsMethods.deleteDoc(window.fsMethods.doc(window.db, "usuarios", id));
        window.fecharModalRecusar();
        window.carregarSolicitacoes();
      } catch (e) { alert("Erro ao recusar."); }
    };
  };

  // Inicia o carregamento respeitando a prontidão do Auth
  const checarAuth = setInterval(() => {
    const auth = window.authMethods?.getAuth() || (window.firebaseAuth && window.firebaseAuth.getAuth ? window.firebaseAuth.getAuth() : null);
    if (auth?.currentUser) {
      window.carregarSolicitacoes();
      clearInterval(checarAuth);
    }
  }, 500);

  return `
    <style>
      .tabs-alunos {
        display: flex;
        gap: 45px;
        margin-top: 25px;
        margin-bottom: 30px;
        border-bottom: 1px solid #d1d9e0;
        padding-left: 5px;
      }
      .tab-btn {
        background: none;
        border: none;
        color: #576b81;
        cursor: pointer;
        font-size: 1.05rem;
        font-weight: 700;
        padding: 12px 0;
        position: relative;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        transition: color 0.2s ease;
      }
      .tab-btn.active {
        color: #003b6f;
      }
      .tab-btn.active::after {
        content: "";
        position: absolute;
        bottom: -1px;
        left: 0;
        width: 100%;
        height: 3px;
        background: #003b6f;
      }
      .tab-btn:hover:not(.active) {
        color: #003b6f;
      }
      .lista-vertical { display: flex; flex-direction: column; gap: 10px; }
      .card-item-horizontal { 
        background: white; padding: 8px 25px; border-radius: 12px; border: 1px solid #e2e8f0; border-left: 6px solid #003058;
        display: flex; align-items: center; justify-content: space-between; transition: transform 0.2s; min-height: 45px;
      }
      .card-item-horizontal:hover { transform: translateX(5px); }
      .info-linha { display: flex; align-items: center; flex: 1; gap: 25px; }
      .card-acoes { display: flex; align-items: center; gap: 12px; }
      .btn-aprovar-blue { background: #003058; color: white; border: none; padding: 10px 18px; border-radius: 10px; cursor: pointer; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; }
      .btn-recusar { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 10px 18px; border-radius: 10px; cursor: pointer; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; }
      /* Ajustes Responsivos Melhores */
      @media (max-width: 850px) {
        .tabs-alunos { 
          gap: 20px; 
          overflow-x: auto; 
          white-space: nowrap; 
          scrollbar-width: none; 
          padding-bottom: 0;
        }
        .tabs-alunos::-webkit-scrollbar { display: none; }
        
        .tab-btn { font-size: 0.9rem; }

        .card-item-horizontal { 
          flex-direction: column; 
          align-items: flex-start; 
          padding: 15px; 
          gap: 15px;
          height: auto;
        }

        .info-linha { 
          flex-direction: column; 
          align-items: flex-start; 
          gap: 8px; 
          width: 100%;
        }

        .info-linha div { 
          width: 100%; 
          text-align: left !important; 
          justify-content: flex-start !important;
          min-width: unset !important;
        }

        .info-linha strong {
            font-size: 0.95rem !important;
            white-space: normal !important;
        }

        .info-linha span {
            white-space: normal !important;
            display: block;
        }

        .card-acoes { 
          width: 100%; 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 10px; 
        }

        .btn-aprovar-blue, .btn-recusar { 
          width: 100%; 
          padding: 12px 5px; 
          font-size: 0.7rem; 
        }

        #container-filtro-turma {
          flex-direction: column;
          align-items: stretch !important;
        }
        
        #filtroTurmaAlunos {
          width: 100%;
        }
      }
    </style>

    <div class="header-prof">
      <h1 style="color: #003058; font-weight: 900; text-transform: uppercase; margin: 0;">Alunos</h1>
    </div>

    <div class="tabs-alunos">
      <button class="tab-btn active" data-tab="solicitacoes" onclick="window.setAbaAlunos('solicitacoes')">Solicitações</button>
      <button class="tab-btn" data-tab="ativos" onclick="window.setAbaAlunos('ativos')">Alunos Ativos</button>
    </div>

    <div id="container-filtro-turma" style="display: none; justify-content: flex-end; align-items: center; gap: 10px; margin-bottom: 20px; font-family: sans-serif;">
      <label style="color: #64748b; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Filtrar Turma:</label>
      <select id="filtroTurmaAlunos" onchange="window.filtrarPorTurma(this.value)" style="padding: 8px 15px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; color: #003058; font-weight: 700; font-size: 0.8rem; cursor: pointer; outline: none; text-transform: uppercase;">
        <option value="TODAS AS TURMAS">Todas as turmas</option>
      </select>
    </div>

    <div id="lista-conteudo-dinamico"></div>

    <div id="modalAprovarAluno" style="display:none; position:fixed; inset:0; background:rgba(15, 23, 42, 0.7); z-index:10002; align-items:center; justify-content:center; backdrop-filter: blur(6px);">
      <div style="background:white; width:90%; max-width:380px; padding:32px; border-radius:28px; text-align:center;">
        <h3 style="color:#0f172a; margin-bottom:10px; font-weight:800;">Aprovar Aluno?</h3>
        <p style="color:#64748b; font-size:0.95rem; margin-bottom:28px;">O aluno terá acesso aos conteúdos da turma.</p>
        <div style="display:flex; flex-direction:column; gap:12px;">
          <button id="btnConfirmarAprovar" style="width:100%; padding:15px; border-radius:16px; border:none; background:#003058; color:white; font-weight:700; cursor:pointer;">Confirmar Aprovação</button>
          <button onclick="window.fecharModalAprovar()" style="width:100%; padding:14px; border-radius:16px; border:1px solid #e2e8f0; background:#f8fafc; color:#64748b; font-weight:600; cursor:pointer;">Agora não</button>
        </div>
      </div>
    </div>

    <div id="modalRecusarAluno" style="display:none; position:fixed; inset:0; background:rgba(15, 23, 42, 0.7); z-index:10002; align-items:center; justify-content:center; backdrop-filter: blur(6px);">
      <div style="background:white; width:90%; max-width:380px; padding:32px; border-radius:28px; text-align:center;">
        <h3 style="color:#0f172a; margin-bottom:10px; font-weight:800;">Excluir Registro?</h3>
        <p style="color:#64748b; font-size:0.95rem; margin-bottom:28px;">Esta ação removerá o aluno permanentemente.</p>
        <div style="display:flex; flex-direction:column; gap:12px;">
          <button id="btnConfirmarRecusar" style="width:100%; padding:15px; border-radius:16px; border:none; background:#dc2626; color:white; font-weight:700; cursor:pointer;">Confirmar Exclusão</button>
          <button onclick="window.fecharModalRecusar()" style="width:100%; padding:14px; border-radius:16px; border:1px solid #e2e8f0; background:#f8fafc; color:#64748b; font-weight:600; cursor:pointer;">Cancelar</button>
        </div>
      </div>
    </div>
  `;
});
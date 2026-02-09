window.Router.register('turmas', async () => {
  
  // 1. NAVEGAÇÃO
  window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    document.getElementById('btn-' + tabId).classList.add('tab-active');
    document.getElementById('content-' + tabId).style.display = 'block';
    
    // Controla a exibição do botão Voltar cinza
    const containerVoltar = document.getElementById('container-voltar-dinamico');
    if(tabId === 'lista') {
        containerVoltar.style.display = 'block';
        window.carregarListaTurmas();
    } else {
        containerVoltar.style.display = 'none';
    }
  };

  // 2. BUSCAR ALUNOS DA TURMA + EXPORTAR EXCEL
  window.verAlunos = async (senhaTurma, identificacaoTurma) => {
    document.getElementById('container-voltar-dinamico').style.display = 'none';
    const container = document.getElementById('lista-turmas-unificada');
    container.innerHTML = `
      <div style="padding:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <button onclick="window.carregarListaTurmas()" style="background:#f1f5f9; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:600; color:#475569;">
            <i class="fa-solid fa-chevron-left"></i> Voltar
          </button>
          <button id="btnExportarExcel" style="display:none; background:#003058; color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.75rem;">
            <i class="fa-solid fa-file-excel"></i> Exportar Excel
          </button>
        </div>
        <h3 style="color:#003058; margin-bottom: 10px; font-size:1.1rem;"><i class="fa-solid fa-graduation-cap"></i> Alunos: ${identificacaoTurma}</h3>
        <div id="lista-alunos-turma">Carregando alunos...</div>
      </div>`;

    try {
      const q = window.fsMethods.query(
        window.fsMethods.collection(window.db, "usuarios"), 
        window.fsMethods.where("status", "==", "aprovado")
      );
      const snapFull = await window.fsMethods.getDocs(q);
      
      const docsFiltrados = snapFull.docs.filter(docAlu => {
        const d = docAlu.data();
        const vinculo = (d.codigoAcesso || d.turma || "").toString().trim();
        return vinculo === senhaTurma.toString().trim();
      });

      const listaAlunos = document.getElementById('lista-alunos-turma');
      const btnExportar = document.getElementById('btnExportarExcel');

      if (docsFiltrados.length === 0) {
        listaAlunos.innerHTML = `<div style="text-align:center; padding:20px; color:#64748b; background:#f8fafc; border-radius:12px;">Nenhum aluno matriculado ou aprovado nesta turma.</div>`;
        return;
      }

      const dadosParaExportar = [];
      let htmlTabela = `<table class="tabela-estilizada"><thead><tr><th>Nome</th><th>E-mail</th><th style="text-align:center;">Ação</th></tr></thead><tbody>`;
      
      docsFiltrados.forEach(doc => {
        const aluno = doc.data();
        dadosParaExportar.push({ nome: aluno.nome, email: aluno.email });
        htmlTabela += `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding:12px;"><i class="fa-solid fa-user" style="color:#003058; margin-right:8px;"></i>${aluno.nome}</td>
            <td style="padding:12px; color:#64748b;">${aluno.email}</td>
            <td style="padding:12px; text-align:center;">
              <button onclick="window.excluirAluno('${doc.id}', '${aluno.nome}', '${senhaTurma}', '${identificacaoTurma}')" style="background: #fee2e2; color: #dc2626; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#fecaca'" onmouseout="this.style.background='#fee2e2'">
  <i class="fa-solid fa-trash-can"></i>
</button>
            </td>
          </tr>`;
      });

      listaAlunos.innerHTML = htmlTabela + `</tbody></table>`;

      btnExportar.style.display = "block";
      btnExportar.onclick = () => {
        let csv = "\uFEFFNome;E-mail\n";
        dadosParaExportar.forEach(a => csv += `"${a.nome}";"${a.email}"\n`);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Alunos_${identificacaoTurma.replace(/\s+/g, '_')}.csv`;
        link.click();
      };

    } catch (e) { 
      console.error(e);
      alert("Erro ao carregar alunos."); 
    }
  };

  // 3. EXCLUSÃO DE ALUNO
  window.fecharConfirmacaoAluno = () => {
    document.getElementById('modalConfirmacaoAluno').style.display = 'none';
  };

  window.excluirAluno = (idAluno, nomeAluno, senhaTurma, identificacaoTurma) => {
    document.getElementById('modalConfirmacaoAlunoTexto').innerHTML = `Deseja remover o aluno <strong>${nomeAluno}</strong> desta turma?`;
    const btn = document.getElementById('btnConfirmarRemocaoAluno');
    btn.onclick = async () => {
      try {
        const referenciaAluno = window.fsMethods.doc(window.db, "usuarios", idAluno);
        await window.fsMethods.deleteDoc(referenciaAluno);
        window.fecharConfirmacaoAluno();
        window.verAlunos(senhaTurma, identificacaoTurma);
      } catch (e) {
        console.error(e);
        alert("Erro ao remover aluno.");
      }
    };
    document.getElementById('modalConfirmacaoAluno').style.display = 'flex';
  };

  // 4. EXCLUIR TURMA
  window.excluirTurma = async (idDocumento, identificacaoTurma, event) => {
    if (event) event.stopPropagation();
    window.abrirConfirmacaoExclusaoTurma(idDocumento, identificacaoTurma);
  };

  window.abrirConfirmacaoExclusaoTurma = (idDocumento, identificacaoTurma) => {
    document.getElementById('modalConfirmacaoTexto').innerText = `Deseja realmente excluir a turma "${identificacaoTurma}"?`;
    document.getElementById('btnConfirmarExclusao').onclick = async () => {
      try {
        await window.fsMethods.deleteDoc(window.fsMethods.doc(window.db, "turmas", idDocumento));
        window.fecharConfirmacaoTurma();
        window.carregarListaTurmas();
      } catch (e) { console.error(e); }
    };
    document.getElementById('modalConfirmacaoTurma').style.display = 'flex';
  };

  window.fecharConfirmacaoTurma = () => {
    document.getElementById('modalConfirmacaoTurma').style.display = 'none';
  };

  // 5. CARREGAR LISTA DE TURMAS
  window.carregarListaTurmas = async () => {
    document.getElementById('container-voltar-dinamico').style.display = 'block';
    const container = document.getElementById('lista-turmas-unificada');
    container.innerHTML = "<p style='padding:10px;'>Carregando...</p>";
    try {
      const auth = window.authMethods.getAuth();
      const userAtual = auth.currentUser;

      if (!userAtual) {
        container.innerHTML = "<p style='padding:10px;'>Erro: Usuário não identificado.</p>";
        return;
      }

      const q = window.fsMethods.query(
        window.fsMethods.collection(window.db, "turmas"), 
        window.fsMethods.where("professorResponsavelId", "==", userAtual.uid),
        window.fsMethods.orderBy("dataCriacao", "desc")
      );

      const snap = await window.fsMethods.getDocs(q);
      
      if (snap.empty) { 
        container.innerHTML = "<p style='padding:10px;'>Nenhuma turma encontrada para o seu perfil.</p>"; 
        return; 
      }

      let htmlLista = `<div class="lista-turmas-vertical">`;
      snap.forEach(doc => {
        const t = doc.data();
        const identificacao = t.nomeCustomizado || t.nome;
        htmlLista += `
          <div class="card-turma-item">
            <div class="card-info-linha">
              <div class="info-item" style="flex:0.5; font-weight:800; color:#1e293b; font-size:0.85rem;">${t.nomeCustomizado || 'S/N'}</div>
              <div class="info-item" style="flex:1; font-weight:600; color:#004b87; font-size:0.85rem;">${t.curso}</div>
              <div class="info-item" style="flex:0.8; color:#64748b; font-size:0.8rem;">${t.semestre}</div>
              <div class="info-item" style="flex:1.2; color:#64748b; font-size:0.8rem;">
                <i class="fa-regular fa-clock"></i> ${t.periodo} — ${t.horario || 'N/A'}
              </div>
              <div class="info-item" style="flex:0.7;">
                <code class="codigo-turma-box" onclick="window.mostrarSenhaTurma('${identificacao}', '${t.senha}')" style="font-size:0.75rem; cursor:pointer; border:1px dashed #003058;" title="Clique para ver detalhes"> ${t.senha}</code>
              </div>
            </div>
            <div class="card-acoes">
              <button onclick="window.verAlunos('${t.senha}', '${identificacao}')" style="background:#003058; color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer;">
  <i class="fa-solid fa-eye"></i>
</button>
              <button class="btn-excluir-red-icon" onclick="window.excluirTurma('${doc.id}', '${identificacao}', event)" style="font-size:1rem; background:none; border:none; color:#ef4444; cursor:pointer; margin-left:10px;"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </div>`;
      });
      container.innerHTML = htmlLista + `</div>`;
    } catch (e) { 
      console.error("Erro ao carregar turmas:", e);
      container.innerHTML = "<p style='padding:10px; color:red;'>Erro ao carregar turmas. Verifique o console para criar o índice.</p>"; 
    }
  };

  // 6. SENHA E HORÁRIOS
  window.gerarSenha = () => {
    const input = document.getElementById('senhaTurma');
    const btn = document.querySelector('.btn-gen-key');
    const caracteresValidos = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
    let pass = '';
    for (let i = 0; i < 6; i++) {
      pass += caracteresValidos.charAt(Math.floor(Math.random() * caracteresValidos.length));
    }
    input.value = pass;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-lock"></i>';
  };

  window.atualizarHorarios = () => {
    const turno = document.getElementById('periodoTurma').value;
    const selectHorario = document.getElementById('horarioTurma');
    const opcoes = {
      "Manhã": ["7:30 às 8:45", "9:00 às 10:15", "10:15 às 11:30"],
      "Tarde": ["13:00 às 14:15", "14:15 às 15:30", "15:45 às 17:00"],
      "Noite": ["18:30 às 21:00"]
    };
    selectHorario.innerHTML = '<option value="">Selecione...</option>';
    if (turno && opcoes[turno]) {
      opcoes[turno].forEach(h => { selectHorario.innerHTML += `<option value="${h}">${h}</option>`; });
      selectHorario.disabled = false;
    } else {
      selectHorario.disabled = true; 
      selectHorario.innerHTML = '<option value="">Selecione o turno primeiro...</option>';
    }
  };

  // 7. SALVAR TURMA NO FIREBASE
  window.salvarTurmaNoFirebase = async (e) => {
    e.preventDefault();
    const campos = {
      nome: document.getElementById('nomeCustomizado').value,
      curso: document.getElementById('nomeTurma').value,
      turno: document.getElementById('periodoTurma').value,
      horario: document.getElementById('horarioTurma').value,
      semestre: document.getElementById('serieTurma').value,
      codigo: document.getElementById('senhaTurma').value,
      dias: document.querySelectorAll('#diasGrupo input:checked').length
    };

    if (Object.values(campos).some(v => !v || v === "" || v === 0) || campos.codigo.includes("Gere o código")) {
      alert("⚠️ Atenção: Preencha todos os campos e gere o código antes de salvar!");
      return;
    }

    try {
      const userAtual = window.authMethods.getAuth().currentUser;
      const qLimpar = window.fsMethods.query(
        window.fsMethods.collection(window.db, "turmas"),
        window.fsMethods.where("professorResponsavelId", "==", userAtual.uid)
      );
      const snapLimpar = await window.fsMethods.getDocs(qLimpar);
      
      if (snapLimpar.size >= 9) {
        window.mostrarAlertaLimite();
        return;
      }

      const dadosParaSalvar = {
        nomeCustomizado: campos.nome,
        curso: campos.curso,
        periodo: campos.turno,
        horario: campos.horario,
        senha: campos.codigo,
        semestre: campos.semestre,
        dias: Array.from(document.querySelectorAll('#diasGrupo input:checked')).map(cb => cb.value).join(', '),
        dataCriacao: window.fsMethods.serverTimestamp(),
        professorResponsavelId: userAtual.uid
      };

      await window.fsMethods.addDoc(window.fsMethods.collection(window.db, "turmas"), dadosParaSalvar);
      window.mostrarToastTurmaCriada();
      e.target.reset();
      document.querySelector('.btn-gen-key').disabled = false;
      document.querySelector('.btn-gen-key').innerHTML = '<i class="fa-solid fa-key"></i>';
      window.switchTab('lista');
    } catch (err) { alert("Erro ao salvar."); }
  };

  // 8. UTILITÁRIOS E MODAIS
  window.mostrarToastTurmaCriada = () => {
    const toast = document.getElementById('toastTurmaCriada');
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
    }, 2000);
  };

  window.mostrarAlertaLimite = () => {
    document.getElementById('modalLimiteTurmas').style.display = 'flex';
  };

  window.fecharAlertaLimite = () => {
    document.getElementById('modalLimiteTurmas').style.display = 'none';
  };

  window.mostrarSenhaTurma = (identificacao, senha) => {
    document.getElementById('modalTitulo').innerText = identificacao;
    document.getElementById('modalCodigo').innerText = senha;
    document.getElementById('modalSenha').style.display = 'flex';
  };

  window.fecharModal = () => {
    document.getElementById('modalSenha').style.display = 'none';
  };

  window.copiarSenhaModal = () => {
    const senha = document.getElementById('modalCodigo').innerText;
    const btn = document.getElementById('btnCopiarModal');
    navigator.clipboard.writeText(senha).then(() => {
      const textoOriginal = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
      btn.style.background = "#004b87";
      setTimeout(() => {
        btn.innerHTML = textoOriginal;
        btn.style.background = "#003058";
      }, 2000);
    });
  };

  setTimeout(() => { window.switchTab('cadastro'); }, 0);

  return `
    <style>
      .header-prof { margin-top: 0px; }
      .header-prof h1 { font-size: 1.8rem; margin-bottom: 2px; }
      .header-prof p { font-size: 0.85rem; }
      .tabs-nav { display: flex; gap: 30px; border-bottom: 1px solid #e2e8f0; padding-left: 10px; margin-top: 12px; }
      .tab-btn { padding: 12px 0px; border: none; background: none; cursor: pointer; font-weight: 700; color: #5c7f92; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; position: relative; transition: color 0.2s;}
      .tab-active { color: #004b87 !important; }
      .tab-active::after { content: ""; position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background-color: #004b87; }
      .form-grid-turmas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .form-group { display: flex; flex-direction: column; margin-bottom: 8px; }
      .form-group.full { grid-column: span 2; }
      .form-group label { font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 3px; }
      .form-group input, .form-group select { padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; width: 100%; box-sizing: border-box; }
      #senhaTurma { background: #e0f2fe !important; font-weight: bold; padding-right: 40px; }
      .pass-wrapper { position: relative; width: 100%; display: flex; align-items: center; }
      .btn-gen-key { position: absolute; right: 4px; background: #003058; color: white; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
      .checkbox-group { display: flex; flex-wrap: wrap; gap: 6px; }
      .check-item { display: flex; align-items: center; gap: 5px; background: #f8fafc; padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 0.75rem; cursor: pointer; }
      .card { padding: 15px !important; margin-bottom: 0 !important; }
      .card-turma-item { background: white; padding: 2px 15px; border-radius: 8px; border: 1px solid #e2e8f0; border-left: 5px solid #003058; display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; min-height: 40px; }
      .card-info-linha { display: flex; align-items: center; flex: 1; gap: 10px; }
      .codigo-turma-box { background: #f1f5f9; padding: 4px 8px; border-radius: 5px; font-family: monospace; font-weight: bold; }
      .btn-ver-turma-green { background: #003058; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; transition: 0.2s; white-space: nowrap; }
      .btn-excluir-red-icon { background: none; color: #ef4444; border: none; cursor: pointer; margin-left: 10px; }
      .tabela-estilizada { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; font-size: 0.85rem; }
      .tabela-estilizada th { background: #003058; color: white; padding: 8px; text-align: left; }

      @media (max-width: 768px) {
        .form-grid-turmas { grid-template-columns: 1fr; }
        .form-group.full { grid-column: span 1; }
        .card-turma-item { flex-direction: column; align-items: flex-start; padding: 15px; gap: 12px; }
        .card-info-linha { flex-direction: column; align-items: flex-start; width: 100%; gap: 8px; }
        .info-item { width: 100%; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
        .card-acoes { width: 100%; display: flex; justify-content: flex-end; margin-top: 10px; }
        .tabs-nav { gap: 15px; }
        .tab-btn { font-size: 0.75rem; }
        .tabela-estilizada { display: block; overflow-x: auto; }
      }

    </style>

    <div class="header-prof">
      <h1>Turmas</h1>
      <p style="color: #64748b;">Organize suas turmas.</p>
    </div>

    <div class="tabs-nav">
        <button id="btn-cadastro" class="tab-btn tab-active" onclick="window.switchTab('cadastro')">CRIAR</button>
        <button id="btn-lista" class="tab-btn" onclick="window.switchTab('lista')">TURMAS ATIVAS</button>
    </div>

    <div id="container-voltar-dinamico" style="display:none; margin: 20px 0 10px 0;">
        <button onclick="window.location.hash = '#home'" style="background:#f1f5f9; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:600; color:#475569; display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-chevron-left"></i> Voltar
        </button>
    </div>

    <div id="content-cadastro" class="tab-content" style="margin-top: 20px;">
      <div class="card" style="margin-top: 20px;">
       <form onsubmit="window.salvarTurmaNoFirebase(event)" autocomplete="off" role="presentation">
          <div class="form-grid-turmas">
            <div class="form-group full">
              <label>Nome da turma:</label>
             <input type="text" id="nomeCustomizado" placeholder="Ex: F1/1" required oninput="this.value = this.value.toUpperCase()" autocomplete="new-password">
            </div>
            <div class="form-group">
              <label>Curso:</label>
              <select id="nomeTurma" required>
                <option value="">Selecione...</option>
                <option value="Inglês">Inglês</option>
                <option value="Espanhol">Espanhol</option>
                <option value="Libras">Libras</option>
              </select>
            </div>
            <div class="form-group">
              <label>Turno:</label>
              <select id="periodoTurma" required onchange="window.atualizarHorarios()">
                <option value="">Selecione...</option>
                <option>Manhã</option>
                <option>Tarde</option>
                <option>Noite</option>
              </select>
            </div>
            <div class="form-group">
              <label>Horário:</label>
              <select id="horarioTurma" required disabled>
                <option value="">Selecione o turno primeiro...</option>
              </select>
            </div>
            <div class="form-group">
              <label>Código da turma:</label>
              <div class="pass-wrapper">
                <input type="text" id="senhaTurma" placeholder="Gere o código da turma aqui ----> " readonly required>
                <button type="button" class="btn-gen-key" onclick="window.gerarSenha()"><i class="fa-solid fa-key"></i></button>
              </div>
            </div>
            <div class="form-group">
              <label>Semestre:</label>
              <select id="serieTurma" required>
                <option value="">Selecione...</option>
                <option>1º Semestre</option>
                <option>2º Semestre</option>
                <option>3º Semestre</option>
                <option>4º Semestre</option>
                <option>5º Semestre</option>
                <option>6º Semestre</option>
                <option>7º Semestre</option>
                <option>Intermediário</option>
              </select>
            </div>
            <div class="form-group full">
              <label>Dias de aula:</label>
              <div class="checkbox-group" id="diasGrupo">
                <label class="check-item"><input type="checkbox" value="Seg"> Seg</label>
                <label class="check-item"><input type="checkbox" value="Ter"> Ter</label>
                <label class="check-item"><input type="checkbox" value="Qua"> Qua</label>
                <label class="check-item"><input type="checkbox" value="Qui"> Qui</label>
              </div>
            </div>
          </div>
          <button type="submit" id="btnSalvar" class="btn-padrao" style="background:#003058; color:white; width:100%; margin-top:10px; padding:12px; cursor:pointer; border:none; border-radius:8px; font-weight:800;">Finalizar cadastro</button>
        </form>
      </div>
    </div>

    <div id="content-lista" class="tab-content" style="display:none; margin-top: 20px;">
      <div id="lista-turmas-unificada"></div>
    </div>

    <div id="modalSenha" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; align-items:center; justify-content:center; backdrop-filter: blur(2px);">
      <div style="background:white; width:90%; max-width:400px; padding:25px; border-radius:20px; box-shadow: 0 20px 25px rgba(0,0,0,0.1); text-align:center;">
        <div style="background:#f8fafc; border-radius:15px; padding:15px; margin-bottom:20px;">
            <h3 id="modalTitulo" style="color:#003058; margin:0; font-size:1.1rem; text-transform:UPPERCASE; font-weight:800;"></h3>
            <p style="font-size:0.8rem; color:#64748b; margin-top:5px;">Código de acesso dos alunos</p>
        </div>
        <div id="modalCodigo" style="font-family:monospace; font-size:2.5rem; font-weight:900; color:#003058; margin:20px 0; letter-spacing:8px;"></div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <button onclick="window.copiarSenhaModal()" id="btnCopiarModal" style="width:100%; background:#003058; color:white; border:none; padding:12px; border-radius:50px; font-weight:700; cursor:pointer;">
            <i class="fa-solid fa-copy"></i> Copiar Código
          </button>
          <button onclick="window.fecharModal()" style="width:100%; background:white; color:#003058; border:2px solid #003058; padding:12px; border-radius:50px; font-weight:800; cursor:pointer; margin-top:5px;">SAIR</button>
        </div>
      </div>
    </div>

    <div id="modalConfirmacaoTurma" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9999; align-items:center; justify-content:center;">
      <div style="background:white; width:90%; max-width:420px; padding:25px; border-radius:18px; text-align:center;">
        <h3 style="color:#003058; margin-bottom:10px;"><i class="fa-solid fa-triangle-exclamation"></i> Atenção</h3>
        <p id="modalConfirmacaoTexto" style="color:#475569; font-size:0.9rem; margin-bottom:20px;"></p>
        <div style="display:flex; gap:10px;">
          <button onclick="window.fecharConfirmacaoTurma()" style="flex:1; padding:12px; border-radius:30px; border:2px solid #003058; background:white; color:#003058; font-weight:700;">Cancelar</button>
          <button id="btnConfirmarExclusao" style="flex:1; padding:12px; border-radius:30px; border:none; background:#ef4444; color:white; font-weight:800;">Excluir</button>
        </div>
      </div>
    </div>

    <div id="modalConfirmacaoAluno" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:10001; align-items:center; justify-content:center; backdrop-filter: blur(4px);">
      <div style="background:white; width:90%; max-width:380px; padding:30px; border-radius:24px; text-align:center;">
        <div style="background:#fff1f2; width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin: 0 auto 15px;"><i class="fa-solid fa-user-minus" style="color:#e11d48; font-size:1.5rem;"></i></div>
        <h3 style="color:#0f172a; margin-bottom:8px; font-size:1.25rem; font-weight:800;">Remover Aluno?</h3>
        <p id="modalConfirmacaoAlunoTexto" style="color:#64748b; font-size:0.95rem; line-height:1.5; margin-bottom:25px;"></p>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <button id="btnConfirmarRemocaoAluno" style="width:100%; padding:14px; border-radius:12px; border:none; background:#e11d48; color:white; font-weight:700; font-size:0.9rem;">Sim, remover aluno</button>
          <button onclick="window.fecharConfirmacaoAluno()" style="width:100%; padding:12px; border-radius:12px; border:1px solid #e2e8f0; background:white; color:#64748b; font-weight:600; font-size:0.9rem;">Cancelar</button>
        </div>
      </div>
    </div>
    <div id="toastTurmaCriada" style="position:fixed; bottom:25px; right:25px; background:#003058; color:white; padding:14px 22px; border-radius:14px; font-weight:800; font-size:0.9rem; box-shadow:0 10px 20px rgba(0,0,0,0.15); opacity:0; transform:translateY(20px); transition:0.3s; z-index:9999; pointer-events:none;">
      <i class="fa-solid fa-circle-check" style="margin-right:8px; color:#ffffff;"></i> Turma criada com sucesso!
    </div>

    <div id="modalLimiteTurmas" style="display:none; position:fixed; inset:0; background:rgba(15, 23, 42, 0.8); z-index:10005; align-items:center; justify-content:center; backdrop-filter: blur(8px);">
      <div style="background:white; width:90%; max-width:400px; padding:35px; border-radius:30px; text-align:center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); border: 1px solid #f1f5f9;">
        <div style="background:#fff7ed; width:70px; height:70px; border-radius:22px; display:flex; align-items:center; justify-content:center; margin: 0 auto 20px; transform: rotate(-5deg); border: 2px solid #f97316;">
          <i class="fa-solid fa-triangle-exclamation" style="color:#f97316; font-size:2rem;"></i>
        </div>
        <h3 style="color:#1e293b; margin-bottom:12px; font-size:1.5rem; font-weight:900; letter-spacing:-0.5px;">Limite Atingido!</h3>
        <p style="color:#64748b; font-size:1rem; line-height:1.6; margin-bottom:30px;">Você alcançou o máximo de <strong>9 turmas</strong> permitidas.</p>
        <button onclick="window.fecharAlertaLimite()" style="width:100%; padding:16px; border-radius:18px; border:none; background:#1e293b; color:white; font-weight:800; font-size:1rem; cursor:pointer; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
          OK
        </button>
      </div>
    </div>
  `;
});
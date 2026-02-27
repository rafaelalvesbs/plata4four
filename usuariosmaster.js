window.Router.register('usuariosmaster', async () => {
  const db = window.db;
  const { collection, query, where, getDocs, addDoc, serverTimestamp, doc, deleteDoc } = window.fsMethods;

  let usuariosFiltrados = [];
  let paginaAtual = 1;
  const itensPorPagina = 8;

  // --- MODAIS CUSTOMIZADOS ---
  window.showModalMaster = (titulo, mensagem, tipo = 'sucesso') => {
    const modal = document.getElementById('modalCustomMaster');
    const icon = document.getElementById('modalIconMaster');
    icon.innerHTML = tipo === 'sucesso' ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>';
    icon.style.color = tipo === 'sucesso' ? '#003058' : '#ef4444';
    document.getElementById('modalTitleMaster').innerText = titulo;
    document.getElementById('modalTextMaster').innerText = mensagem;
    modal.style.display = 'flex';
  };

  window.closeModalMaster = () => { document.getElementById('modalCustomMaster').style.display = 'none'; };

  // --- MODAL DE CÓPIA DE CÓDIGO ---
  window.abrirModalCodigo = (codigo) => {
    const modal = document.getElementById('modalCodigoMaster');
    document.getElementById('displayCodigoMaster').innerText = codigo;
    modal.style.display = 'flex';
    
    document.getElementById('btnCopiarCodigoFinal').onclick = () => {
      navigator.clipboard.writeText(codigo);
      window.showModalMaster("Copiado!", "Código de acesso copiado com sucesso.");
      modal.style.display = 'none';
    };
  };

  window.copiarEmailMaster = (email) => {
    if(!email) return;
    navigator.clipboard.writeText(email);
    window.showModalMaster("Copiado!", "E-mail copiado com sucesso.");
  };

  // --- NAVEGAÇÃO ---
  window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    document.getElementById('btn-' + tabId).classList.add('tab-active');
    document.getElementById('content-' + tabId).style.display = 'block';
    if(tabId === 'lista') window.carregarListaUsuariosMaster();
  };

  window.gerarSenha = () => {
    const perfil = document.getElementById('perfilUsuario').value;
    if (!perfil) {
      window.showModalMaster("Atenção", "Selecione um perfil primeiro!", "erro");
      return;
    }
    const input = document.getElementById('codigoUsuario');
    const prefixos = { "Diretor": "DIR", "Coordenador": "COO", "Professor": "PRO" };
    const caracteresValidos = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
    let pass = '';
    for (let i = 0; i < 4; i++) pass += caracteresValidos.charAt(Math.floor(Math.random() * caracteresValidos.length));
    input.value = `${prefixos[perfil]}-${pass}`;
  };

  window.salvarUsuarioNoFirebase = async (e) => {
    e.preventDefault();
    const perfil = document.getElementById('perfilUsuario').value;
    const codigo = document.getElementById('codigoUsuario').value;

    try {
      await addDoc(collection(db, "usuarios"), {
        perfil: perfil,
        codigoAcesso: codigo,
        status: "pendente",
        nome: "",
        email: "",
        dataCriacao: serverTimestamp()
      });
      window.showModalMaster("Sucesso", "Acesso gerado com sucesso!");
      e.target.reset();
      window.switchTab('lista');
    } catch (err) { window.showModalMaster("Erro", "Erro ao salvar.", "erro"); }
  };

  // --- LISTAGEM E PAGINAÇÃO ---
  window.renderizarPaginaMaster = () => {
    const container = document.getElementById('lista-usuarios-unificada');
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const itensExibir = usuariosFiltrados.slice(inicio, fim);

    let htmlLista = `<div class="lista-turmas-vertical">`;
    itensExibir.forEach(u => {
      const emailUser = u.email || "Sem e-mail";
      htmlLista += `
        <div class="card-turma-item">
          <div class="card-info-linha" style="display: flex; align-items: center; width: 100%; gap: 15px;">
            <div class="info-item" style="flex: 1.5; font-weight: 800; color: #1e293b; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${(() => {
                  if (!u.nome) return "Aguardando Cadastro...";
                  const partes = u.nome.trim().split(/\s+/);
                  return partes.length > 1 ? `${partes[0]} ${partes[1]}` : partes[0];
                })()}
            </div>
            <div class="info-item" style="flex: 1.5; font-weight: 400; color: #64748b; font-size: 0.75rem; display: flex; align-items: center; gap: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${emailUser} 
                ${u.email ? `<button onclick="window.copiarEmailMaster('${u.email}')" style="background:none; border:none; cursor:pointer; color:#94a3b8; font-size:0.7rem;"><i class="fa-regular fa-copy"></i></button>` : ''}
            </div>
            <div class="info-item" style="flex: 0.8; font-weight: 600; color: #004b87; font-size: 0.85rem; text-align: center;">
                ${u.perfil}
            </div>
            <div class="info-item" style="flex: 0.8; color: #64748b; font-size: 0.8rem; text-align: center;">
                ${u.status}
            </div>
            <div class="info-item" style="flex: 0.7; text-align: center;">
              <code class="codigo-turma-box" onclick="window.abrirModalCodigo('${u.codigoAcesso}')" style="font-size: 0.75rem; border: 1px dashed #003058; cursor: pointer; transition: 0.2s;"> ${u.codigoAcesso}</code>
            </div>
          </div>
          <div class="card-acoes">
            <button class="btn-excluir-red-icon" onclick="window.confirmarExclusaoMaster('${u.id}')" style="font-size:1rem;"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>`;
    });
    container.innerHTML = htmlLista + `</div>`;
    window.renderizarPaginacaoMaster();
  };

  window.renderizarPaginacaoMaster = () => {
    const totalPaginas = Math.ceil(usuariosFiltrados.length / itensPorPagina);
    const paginacaoCont = document.getElementById('paginacaoMaster');
    let html = "";
    for (let i = 1; i <= totalPaginas; i++) {
      html += `<button class="page-btn ${i === paginaAtual ? 'active' : ''}" onclick="window.mudarPaginaMaster(${i})">${i}</button>`;
    }
    paginacaoCont.innerHTML = html;
  };

  window.mudarPaginaMaster = (p) => { paginaAtual = p; window.renderizarPaginaMaster(); };

  window.carregarListaUsuariosMaster = async () => {
    const filtro = document.getElementById('filtroPerfilMaster').value;
    try {
      const snap = await getDocs(collection(db, "usuarios"));
      const todos = [];
      
      snap.forEach(d => {
        const uData = { id: d.id, ...d.data() };
        
        if (uData.perfil !== "Master") {
          todos.push(uData);
        }

        if (uData.nomeCompletoUrl) {
          fetch(uData.nomeCompletoUrl)
            .then(r => r.text())
            .then(nomeReal => {
              const index = usuariosFiltrados.findIndex(user => user.id === uData.id);
              if (index !== -1) {
                usuariosFiltrados[index].nome = nomeReal;
                window.renderizarPaginaMaster();
              }
            })
            .catch(err => console.error("Erro nome longo:", err));
        }
      });

      usuariosFiltrados = todos.filter(u => !filtro || u.perfil === filtro);

      usuariosFiltrados.sort((a, b) => {
        if ((a.nome === "" || !a.nome) && (b.nome !== "" && b.nome)) return -1;
        if ((b.nome === "" || !b.nome) && (a.nome !== "" && a.nome)) return 1;
        return 0;
      });

      paginaAtual = 1;
      window.renderizarPaginaMaster();
    } catch (e) { 
      console.error("Erro ao carregar lista Master:", e); 
    }
  };

  window.confirmarExclusaoMaster = (id) => {
    const modal = document.getElementById('modalConfirmMaster');
    modal.style.display = 'flex';
    document.getElementById('btnConfirmDelMaster').onclick = async () => {
      await deleteDoc(doc(db, "usuarios", id));
      modal.style.display = 'none';
      window.carregarListaUsuariosMaster();
    };
  };

  setTimeout(() => { window.switchTab('cadastro'); }, 0);

  return `
    <style>
      .header-prof { margin-top: -10px; }
      .header-prof h1 { font-size: 1.8rem; margin-bottom: 2px; }
      .divisor { margin: 10px 0; }
      .tabs-nav { display: flex; gap: 30px; border-bottom: 1px solid #e2e8f0; padding-left: 10px;}
      .tab-btn { padding: 12px 0px; border: none; background: none; cursor: pointer; font-weight: 700; color: #5c7f92; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; position: relative; transition: color 0.2s;}
      .tab-active { color: #004b87 !important; }
      .tab-active::after { content: ""; position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background-color: #004b87; }
      .form-grid-turmas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .form-group { display: flex; flex-direction: column; margin-bottom: 8px; }
      .form-group label { font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 3px; }
      .form-group input, .form-group select { padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; width: 100%; box-sizing: border-box; }
      .pass-wrapper { position: relative; width: 100%; display: flex; align-items: center; }
      .btn-gen-key { position: absolute; right: 4px; background: #003058; color: white; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
      .card { padding: 15px !important; margin-bottom: 0 !important; }
      .card-turma-item { background: white; padding: 12px 15px; border-radius: 10px; border: 1px solid #e2e8f0; border-left: 5px solid #003058; display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
      .card-info-linha { display: flex; align-items: center; flex: 1; gap: 10px; overflow: hidden; }
      .codigo-turma-box { background: #f1f5f9; padding: 4px 8px; border-radius: 5px; font-family: monospace; font-weight: bold; }
      .codigo-turma-box:hover { background: #e0f2fe; }
      .btn-excluir-red-icon { background: none; color: #ef4444; border: none; cursor: pointer; margin-left: 10px; }
      
      .paginacao-container { display: flex; justify-content: center; gap: 8px; margin-top: 20px; }
      .page-btn { padding: 8px 14px; border: 1px solid #e2e8f0; background: white; border-radius: 8px; cursor: pointer; font-weight: 700; color: #003058; }
      .page-btn.active { background: #003058; color: white; border-color: #003058; }
      .modal-overlay { position: fixed; inset: 0; background: rgba(0,48,88,0.4); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 10000; }
      .modal-box { background: white; width: 90%; max-width: 400px; padding: 30px; border-radius: 20px; text-align: center; }
      .display-codigo { background: #f8fafc; border: 2px dashed #003058; padding: 15px; font-size: 1.5rem; font-weight: 900; color: #003058; margin: 20px 0; border-radius: 10px; font-family: monospace; }
    </style>

    <div class="header-prof">
      <h1>Usuários</h1>
      <p style="color: #64748b;">Gerencie os acessos administrativos.</p>
    </div>
    <hr class="divisor">

    <div class="tabs-nav">
        <button id="btn-cadastro" class="tab-btn tab-active" onclick="window.switchTab('cadastro')">CRIAR USUÁRIOS</button>
        <button id="btn-lista" class="tab-btn" onclick="window.switchTab('lista')">LISTA DE USUÁRIOS</button>
    </div>

    <div id="content-cadastro" class="tab-content" style="margin-top: 20px;">
      <div class="card" style="margin-top: 20px;">
        <form onsubmit="window.salvarUsuarioNoFirebase(event)" autocomplete="off">
          <div class="form-grid-turmas">
            <div class="form-group">
              <label>Perfil:</label>
              <select id="perfilUsuario" required>
                <option value="">Selecione...</option>
                <option value="Diretor">Diretor</option>
                <option value="Coordenador">Coordenador</option>
                <option value="Professor">Professor</option>
              </select>
            </div>
            <div class="form-group">
              <label>Código do usuário:</label>
              <div class="pass-wrapper">
                <input type="text" id="codigoUsuario" placeholder="Gere o código aqui ----> " readonly required style="background: #e0f2fe; font-weight: bold;">
                <button type="button" class="btn-gen-key" onclick="window.gerarSenha()"><i class="fa-solid fa-key"></i></button>
              </div>
            </div>
          </div>
          <button type="submit" class="btn-padrao" style="background:#003058; color:white; width:100%; margin-top:10px; padding:12px; cursor:pointer; border:none; border-radius:8px; font-weight:800;">Finalizar cadastro</button>
        </form>
      </div>
    </div>

    <div id="content-lista" class="tab-content" style="display:none; margin-top: 20px;">
      <div style="margin-bottom: 15px; text-align: right;">
        <select id="filtroPerfilMaster" onchange="window.carregarListaUsuariosMaster()" style="padding:8px; border-radius:8px; border:1px solid #e2e8f0; font-size:0.8rem; font-weight:600;">
          <option value="">TODOS OS PERFIS</option>
          <option value="Diretor">DIRETOR</option>
          <option value="Coordenador">COORDENADOR</option>
          <option value="Professor">PROFESSOR</option>
        </select>
      </div>
      <div id="lista-usuarios-unificada"></div>
      <div id="paginacaoMaster" class="paginacao-container"></div>
    </div>

    <div id="modalCodigoMaster" class="modal-overlay">
      <div class="modal-box">
        <h2 style="color:#003058;">Código de Acesso</h2>
        <p style="color:#64748b; font-size:0.85rem;">Utilize o código abaixo para realizar o cadastro.</p>
        <div id="displayCodigoMaster" class="display-codigo"></div>
        <div style="display:flex; gap:10px;">
          <button style="flex:1; padding:12px; border-radius:10px; border:1px solid #e2e8f0; background:white; font-weight:800; color:#64748b; cursor:pointer;" onclick="document.getElementById('modalCodigoMaster').style.display='none'">FECHAR</button>
          <button id="btnCopiarCodigoFinal" style="flex:1; padding:12px; border-radius:10px; border:none; background:#003058; color:white; font-weight:800; cursor:pointer;">COPIAR</button>
        </div>
      </div>
    </div>

    <div id="modalCustomMaster" class="modal-overlay">
      <div class="modal-box">
        <div id="modalIconMaster" style="font-size:3rem; margin-bottom:15px;"></div>
        <h2 id="modalTitleMaster" style="color:#003058; margin-bottom:10px;"></h2>
        <p id="modalTextMaster" style="color:#64748b; font-size:0.9rem;"></p>
        <button style="width:100%; padding:12px; border:none; border-radius:10px; background:#003058; color:white; font-weight:800; margin-top:20px; cursor:pointer;" onclick="window.closeModalMaster()">OK</button>
      </div>
    </div>

    <div id="modalConfirmMaster" class="modal-overlay">
      <div class="modal-box">
        <div style="font-size:3rem; color:#ef4444; margin-bottom:15px;"><i class="fa-solid fa-trash-can"></i></div>
        <h2 style="color:#003058; margin-bottom:10px;">Excluir Acesso?</h2>
        <div style="display:flex; gap:10px; margin-top:20px;">
          <button style="flex:1; padding:12px; border-radius:10px; border:1px solid #e2e8f0; background:white; font-weight:800; color:#64748b; cursor:pointer;" onclick="document.getElementById('modalConfirmMaster').style.display='none'">CANCELAR</button>
          <button id="btnConfirmDelMaster" style="flex:1; padding:12px; border-radius:10px; border:none; background:#ef4444; color:white; font-weight:800; cursor:pointer;">EXCLUIR</button>
        </div>
      </div>
    </div>
  `;
});
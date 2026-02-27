window.Router.register('escritaprofessorclm', async () => {
    const db = window.db;
   const { 
    collection, getDocs, addDoc, deleteDoc, doc, updateDoc,
    query, where, orderBy, serverTimestamp, limit
    } = window.fsMethods;

    let paginaAtualEscrita = 1;
    const itensPorPagina = 7;
    let propostasCache = [];
    let idEditando = null;
    let paginaAtualRecebidas = 1;
    let recebidasCache = [];
    let paginaAtualCorrigidas = 1;
    let corrigidasCache = [];
    const itensPorPaginaCorrigidas = 4;

    // Bloqueio Mobile Reforçado
    setTimeout(() => {
        if (window.innerWidth < 1024 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            const containerPrincipal = document.getElementById('render-content') || document.querySelector('#app') || document.body;
            if (containerPrincipal) {
                containerPrincipal.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:80vh; padding:20px; text-align:center; font-family:sans-serif; background:#f8fafc; position:fixed; top:0; left:0; width:100%; z-index:99999;">
                        <div style="background:#fff1f1; color:#ef4444; width:80px; height:80px; border-radius:20px; display:flex; align-items:center; justify-content:center; margin-bottom:20px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                            <i class="fa-solid fa-laptop" style="font-size:40px;"></i>
                        </div>
                        <h2 style="color:#003058; margin:0 0 15px 0; font-weight:900; font-size:24px;">Painel Exclusivo para Desktop</h2>
                        <p style="color:#64748b; line-height:1.6; max-width:320px; margin:0 0 30px 0; font-size:16px;">
                            A criação de atividades de <strong>Escrita</strong> requer uma tela maior para melhor organização e visualização. Por favor, acesse através de um computador.
                        </p>
                        <button onclick="window.location.hash='#home'; window.location.reload();" style="background:#003058; color:white; border:none; padding:16px 40px; border-radius:12px; font-weight:800; cursor:pointer; width:100%; max-width:250px; text-transform:uppercase; letter-spacing:1px;">Voltar ao Início</button>
                    </div>
                `;
            }
        }
    }, 50);

    window.mostrarAvisoErro = (mensagem) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:sans-serif;';
    
    overlay.innerHTML = `
        <div style="background:white;padding:30px;border-radius:20px;max-width:350px;width:90%;text-align:center;box-shadow:0 20px 25px rgba(0,0,0,0.2);">
            <i class="fa-solid fa-circle-exclamation" style="font-size:3rem;color:#dc2626;margin-bottom:15px;"></i>
            <h3 style="margin:0 0 10px 0;color:#003058;">Atenção</h3>
            <p style="color:#64748b;font-size:14px;margin-bottom:20px;">${mensagem}</p>
            <button onclick="this.closest('div').parentElement.remove()" style="padding:10px 20px;border-radius:8px;border:none;background:#003058;color:white;cursor:pointer;font-weight:600;width:100%;">ENTENDIDO</button>
        </div>
    `;
    document.body.appendChild(overlay);
};

    window.confirmarExclusaoModal = (callback) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-card">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 40px; color: #ef4444; margin-bottom: 15px;"></i>
            <h3 style="color:#003058; margin:0;">Tem certeza?</h3>
            <p style="color:#64748b; font-size:14px; margin: 10px 0 0 0;">Esta ação não pode ser desfeita.</p>
            <div class="confirm-buttons">
                <button class="btn-cancel" onclick="this.closest('.confirm-overlay').remove()">CANCELAR</button>
                <button class="btn-confirm-del" id="btn-confirma-agora">EXCLUIR</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    document.getElementById('btn-confirma-agora').onclick = () => {
        overlay.remove();
        callback();
    };
};
    
    // --- NAVEGAÇÃO PRINCIPAL ---
    window.switchMainTabEscrita = (tabId) => {
        document.querySelectorAll('.main-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane-escrita').forEach(pane => pane.style.display = 'none');
        const btnAtivo = document.getElementById(`tab-btn-${tabId}`);
        if(btnAtivo) btnAtivo.classList.add('active');
        const pane = document.getElementById(`pane-${tabId}`);
        if(pane) pane.style.display = 'block';

        if(tabId === 'lista') { paginaAtualEscrita = 1; window.carregarRedacoesEnviadasProf(); }
        if(tabId === 'recebidas') { window.carregarTodasRedacoesRecebidas(); }
        if(tabId === 'corrigidas') { window.carregarRedacoesCorrigidas(); }
        
        if(tabId !== 'criar') {
            idEditando = null;
            document.querySelector('.btn-publish').innerText = "PUBLICAR AGORA";
        } else {
            // Trava o calendário para não aceitar datas passadas
            const hoje = new Date().toISOString().split('T')[0];
            const campoData = document.getElementById('prazo-escrita-prof');
            if(campoData) campoData.setAttribute('min', hoje);
        }
    };

    // --- LÓGICA DE CRIAÇÃO / EDIÇÃO (ABA 1) ---
    window.triggerClickInputFile = () => {
    const input = document.getElementById('file-escrita-img');
    if (input) {
        input.value = ''; // Limpa o arquivo anterior para permitir selecionar a mesma foto de novo
        input.click();
    }
};

    window.handleImagePreview = (input) => {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Define o limite máximo de 800px para largura ou altura
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Converte para JPEG com qualidade de 0.7 (70%)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                
                const preview = document.getElementById('preview-img-escrita');
                const container = document.getElementById('container-preview-img');
                
                if (preview && container) {
                    preview.src = dataUrl;
                    container.style.display = 'flex';
                }
            };
        };
        reader.readAsDataURL(file);
    }
};

    window.carregarRedacoesEnviadasProf = async () => {
    const container = document.getElementById('lista-propostas-content');
    container.innerHTML = '<p style="padding:20px; color:#64748b;">Buscando suas propostas...</p>';
    
    try {
        const userAtual = window.authMethods.getAuth().currentUser;
        if (!userAtual) return;

        // FILTRO: Busca apenas propostas onde o professorId é igual ao ID do usuário logado
        const q = query(
            collection(db, "atividades_enviadas"), 
            where("tipo", "==", "escrita"),
            where("professorId", "==", userAtual.uid)
        );
        
        const snap = await getDocs(q);
        propostasCache = [];
        
        snap.forEach(d => {
            propostasCache.push({ id: d.id, ...d.data() });
        });

        // Ordenação manual (caso o índice composto do Firebase ainda não esteja pronto)
        propostasCache.sort((a, b) => (b.dataEnvio?.seconds || 0) - (a.dataEnvio?.seconds || 0));

        if (propostasCache.length === 0) {
            container.innerHTML = '<p style="padding:20px; color:#64748b;">Você ainda não criou nenhuma proposta.</p>';
            return;
        }

        window.renderizarListaPropostas();
    } catch (e) {
        console.error("Erro ao carregar propostas:", e);
        container.innerHTML = '<p style="color:red; padding:20px;">Erro ao carregar sua lista de propostas.</p>';
    }
};
    
    window.enviarRedacaoProfessor = async () => {
    const tInput = document.getElementById('titulo-escrita-prof');
    const aInput = document.querySelector('#pane-criar textarea');
    const pInput = document.getElementById('prazo-escrita-prof');
    const imgEl = document.getElementById('preview-img-escrita');
    const contImg = document.getElementById('container-preview-img');
    const btnAtivo = document.querySelector('#turma-pills-escrita .btn-turma-pill.active');
    
    const userAtual = window.authMethods.getAuth().currentUser;

    if (!userAtual) {
        window.mostrarAvisoErro("S Wood. Faça login novamente.");
        return;
    }

    const semestreNome = btnAtivo ? btnAtivo.getAttribute('data-nome') : null;
    const senhaTurma = btnAtivo ? btnAtivo.getAttribute('data-senha') : null;

    if (!tInput.value.trim()) {
        window.mostrarAvisoErro("A proposta precisa de um título!");
        return;
    }
    if (!aInput.value.trim()) {
        window.mostrarAvisoErro("O corpo do texto da proposta não pode estar vazio!");
        return;
    }
    if (!pInput.value) {
        window.mostrarAvisoErro("Você precisa definir um prazo de entrega!");
        return;
    }
    if (!semestreNome || !senhaTurma) {
        window.mostrarAvisoErro("Selecione uma turma válida!");
        return;
    }

   try {
        const btnPublicar = document.querySelector('.btn-publish');
        const originalText = btnPublicar.innerText;
        btnPublicar.disabled = true;
        btnPublicar.innerText = "ENVIANDO PROPOSTA...";
        btnPublicar.style.opacity = "0.7";
        btnPublicar.style.cursor = "not-allowed";

        let urlFinalImagem = "";
        
        // Usa as referências globais exatas que você criou no index.html
        const storage = window.storage;
        const { ref, getDownloadURL } = window.storageMethods;
        const { uploadString } = window.stMethods || {}; 

        if (contImg && contImg.style.display !== 'none' && imgEl.src) {
            if (imgEl.src.startsWith('data:image')) {
                // Criando a referência do arquivo no Storage
                const caminhoStorage = `propostas/${userAtual.uid}_${Date.now()}.jpg`;
                const storageRef = ref(storage, caminhoStorage);
                
                // Importação dinâmica do método de upload para garantir que não falhe
                const { uploadString: upStr } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
                
                await upStr(storageRef, imgEl.src, 'data_url');
                urlFinalImagem = await getDownloadURL(storageRef);
            } else if (imgEl.src.startsWith('http')) {
                urlFinalImagem = imgEl.src;
            }
        }

        const dados = {
            tipo: "escrita",
            titulo: tInput.value.trim(),
            conteudo: aInput.value.trim(),
            prazo: pInput.value,
            semestre: semestreNome,
            turmasSelecionadas: [senhaTurma], 
            turma: senhaTurma, 
            imagemApoio: urlFinalImagem,
            dataEnvio: window.fsMethods.serverTimestamp(),
            professorId: userAtual.uid
        };

        if (idEditando) {
            await window.fsMethods.updateDoc(window.fsMethods.doc(window.db, "atividades_enviadas", idEditando), dados);
        } else {
            await window.fsMethods.addDoc(window.fsMethods.collection(window.db, "atividades_enviadas"), dados);
        }

        window.mostrarToastSucesso(idEditando ? "Proposta atualizada!" : "Publicado com sucesso!");
        
        tInput.value = ""; 
        aInput.value = ""; 
        pInput.value = "";
        idEditando = null;
        document.querySelector('.btn-publish').innerText = "PUBLICAR AGORA";
        window.removerFotoEscrita();
        
        await window.carregarRedacoesEnviadasProf();
        window.switchMainTabEscrita('lista');

    } catch (e) {
        console.error("Erro ao publicar:", e);
        window.mostrarAvisoErro("Erro ao salvar no banco de dados.");
    } finally {
        const btnPublicar = document.querySelector('.btn-publish');
        if (btnPublicar) {
            btnPublicar.disabled = false;
            btnPublicar.innerText = idEditando ? "ATUALIZAR PROPOSTA" : "PUBLICAR AGORA";
            btnPublicar.style.opacity = "1";
            btnPublicar.style.cursor = "pointer";
        }
    }
};

    window.renderizarListaPropostas = () => {
        const container = document.getElementById('lista-propostas-content');
        if(propostasCache.length === 0) {
            container.innerHTML = '<p style="padding:20px; color:#64748b;">Nenhuma proposta.</p>';
            return;
        }
        const totalPaginas = Math.ceil(propostasCache.length / itensPorPagina);
        const inicio = (paginaAtualEscrita - 1) * itensPorPagina;
        const itensPagina = propostasCache.slice(inicio, inicio + itensPorPagina);

        let html = '';
        itensPagina.forEach(data => {
            const dataEx = data.dataEnvio?.toDate ? data.dataEnvio.toDate().toLocaleDateString('pt-BR') : '...';
            html += `
                <div class="card-premium" style="margin-bottom: 10px; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #003058;">
                    <div style="flex:1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; padding-right: 5px; min-width: 0;">
                        <span class="tag-turma-simple" style="font-size: 9px; padding: 2px 6px; background: #003058; color: white; border-radius: 4px;">${data.semestre || 'Geral'}</span>
                        <h3 style="margin: 2px 0; color:#003058; font-size:13px; display: inline-block; margin-left: 8px;">${data.titulo || data.conteudo}</h3>
                        <div style="font-size: 10px; color:#94a3b8; margin-top: 2px;">Data: ${dataEx} | Prazo: ${new Date(data.prazo.includes('T') ? data.prazo : data.prazo + "T23:59:59").toLocaleDateString('pt-BR')}</div>
                    </div>
                    <div style="display:flex; gap:5px;">
                    <button onclick="window.visualizarProposta('${data.id}')" style="background:#003058; color:white; border:none; border-radius:6px; padding:6px 10px; cursor:pointer;">
                <i class="fa-solid fa-eye"></i>
                    </button>

                    <button onclick="window.prepararEdicaoEscrita('${data.id}')" style="background:#f1f5f9; color:#003058; border:none; border-radius:6px; padding:6px 10px; cursor:pointer;">
                <i class="fa-solid fa-pen-to-square"></i>
                    </button>

                    <button onclick="window.excluirRedacaoProf('${data.id}')" style="background:#ef4444; color:white; border:none; border-radius:6px; padding:6px 10px; cursor:pointer;">
                <i class="fa-solid fa-trash-can"></i>
                    </button>
                    </div>
                </div>`;
        });

        if (totalPaginas > 1) {
            html += `
                <div style="display: flex; justify-content: center; align-items: center; gap: 20px; margin-top: 20px;">
                    <button onclick="window.mudarPaginaEscrita(-1)" ${paginaAtualEscrita === 1 ? 'disabled style="opacity:0.3"' : ''} style="background:none; border:none; color:#003058; font-size: 22px; cursor:pointer;"><i class="fa-solid fa-circle-arrow-left"></i></button>
                    <span style="font-weight:700; color:#003058;">${paginaAtualEscrita} de ${totalPaginas}</span>
                    <button onclick="window.mudarPaginaEscrita(1)" ${paginaAtualEscrita === totalPaginas ? 'disabled style="opacity:0.3"' : ''} style="background:none; border:none; color:#003058; font-size: 22px; cursor:pointer;"><i class="fa-solid fa-circle-arrow-right"></i></button>
                </div>`;
        }
        container.innerHTML = html;
    };

    window.prepararEdicaoEscrita = (id) => {
        const p = propostasCache.find(item => item.id === id);
        if (!p) return;

        idEditando = id;
        window.switchMainTabEscrita('criar');
        
        document.getElementById('titulo-escrita-prof').value = (p.titulo || "").substring(0, 100);
        document.querySelector('#pane-criar textarea').value = p.conteudo || "";
        document.getElementById('prazo-escrita-prof').value = p.prazo || "";
        const hojeEdicao = new Date().toISOString().split('T')[0];
        document.getElementById('prazo-escrita-prof').setAttribute('min', hojeEdicao);
        
        document.querySelectorAll('.btn-turma-pill').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.nome === p.semestre || btn.dataset.nome === p.turma) {
                btn.classList.add('active');
            }
        });

        if (p.imagemApoio) {
            const preview = document.getElementById('preview-img-escrita');
            preview.src = p.imagemApoio;
            document.getElementById('container-preview-img').style.display = 'flex';
        } else {
            document.getElementById('container-preview-img').style.display = 'none';
        }

        document.querySelector('.btn-publish').innerText = "ATUALIZAR PROPOSTA";
    };

    window.mudarPaginaEscrita = (dir) => { paginaAtualEscrita += dir; window.renderizarListaPropostas(); };

    window.excluirRedacaoProf = (id) => {
    window.confirmarExclusaoModal(async () => {
        try {
            const { doc, deleteDoc } = window.fsMethods;
            await deleteDoc(doc(window.db, "atividades_enviadas", id));
            window.mostrarToastSucesso("Proposta excluída!");
            window.carregarRedacoesEnviadasProf();
        } catch (e) {
            alert("Erro ao excluir.");
        }
    });
};

window.removerFotoEscrita = () => {
    const preview = document.getElementById('preview-img-escrita');
    const container = document.getElementById('container-preview-img');
    const input = document.getElementById('file-escrita-img');
    
    preview.src = "";
    container.style.display = 'none';
    if(input) input.value = ""; // Limpa o arquivo selecionado
};
    setTimeout(async () => {
        const div = document.getElementById('turma-pills-escrita');
        if (!div) return;
        
        try {
            const auth = window.authMethods.getAuth();
            const userAtual = auth.currentUser;

            if (!userAtual) {
                div.innerHTML = "<p style='font-size:11px; color:red;'>Erro: Usuário não logado.</p>";
                return;
            }

            // 1. Busca apenas as turmas que pertencem a este professor
            const q = query(
                collection(db, "turmas"), 
                where("professorResponsavelId", "==", userAtual.uid)
            );
            
            const snap = await getDocs(q);
            const mapaUnico = new Map();

            snap.forEach(d => {
                const data = d.data();
                if (data.semestre && data.senha) {
                    // O Map garante que se houver dois "1º Semestre", ele mostre apenas um botão
                    mapaUnico.set(data.semestre.trim(), data.senha);
                }
            });

            // 2. Converte para Array e ordena (1º, 2º... Intermediário)
            const turmasLimpas = Array.from(mapaUnico, ([semestre, senha]) => ({ semestre, senha }));
            
            turmasLimpas.sort((a, b) => {
                const getVal = (s) => s.toLowerCase().includes('inter') ? 99 : (parseInt(s.replace(/\D/g,'')) || 0);
                return getVal(a.semestre) - getVal(b.semestre);
            });

            div.innerHTML = '';
            
            if (turmasLimpas.length === 0) {
                div.innerHTML = '<p style="font-size:11px; color:#94a3b8; padding:10px;">Nenhuma turma vinculada ao seu perfil.</p>';
                return;
            }

            turmasLimpas.forEach(t => {
                const btn = document.createElement('button');
                btn.className = 'btn-turma-pill';
                btn.innerText = t.semestre.toUpperCase();
                btn.dataset.nome = t.semestre;
                btn.dataset.senha = t.senha;
                btn.onclick = function () {
                    div.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                };
                div.appendChild(btn);
            });

            // 3. Ativa o primeiro botão automaticamente
            if (div.firstChild) div.firstChild.classList.add('active');

        } catch (erro) {
            console.error("Erro ao carregar semestres para escrita:", erro);
            div.innerHTML = '<p style="font-size:11px; color:red;">Erro ao carregar turmas.</p>';
        }
    }, 800);

    window.carregarTodasRedacoesRecebidas = async () => {
    const grid = document.getElementById('grid-turmas-escrita');
    grid.innerHTML = '<p style="padding:20px; color:#64748b;">Buscando turmas com pendências...</p>';
    
    try {
        const userAtual = window.authMethods.getAuth().currentUser;
        if (!userAtual) return;

        // 1. Busca apenas as turmas que pertencem a este professor
        const qTurmas = query(
            collection(db, "turmas"), 
            where("professorResponsavelId", "==", userAtual.uid)
        );
        const snapTurmas = await getDocs(qTurmas);
        
        const mapaTurmas = {};
        const senhasAutorizadas = [];
        
        snapTurmas.forEach(tDoc => {
            const tData = tDoc.data();
            mapaTurmas[tData.senha] = tData.nomeCustomizado || tData.semestre;
            senhasAutorizadas.push(tData.senha);
        });

        if (senhasAutorizadas.length === 0) {
            grid.innerHTML = '<p style="padding:20px; color:#64748b;">Você ainda não possui turmas criadas.</p>';
            return;
        }

       // 2. Busca as respostas enviadas pelos alunos destinadas a este professor
        const qRed = query(
            collection(db, "respostas_alunos"), 
            where("status", "==", "pendente"),
            where("professorResponsavelId", "==", userAtual.uid),
            where("tipo", "==", "escrita")
        );
        const snapRed = await getDocs(qRed);

        const grupos = {};
        snapRed.forEach(d => {
            const red = d.data();
            // Usa o campo 'turma' ou 'senhaTurma' que o aluno gravou
            const codTurma = red.turma || red.senhaTurma;
            
            if (codTurma && senhasAutorizadas.includes(codTurma)) {
                if (!grupos[codTurma]) grupos[codTurma] = [];
                grupos[codTurma].push({ id: d.id, ...red });
            }
        });

        let html = '';
        const chavesTurmas = Object.keys(grupos);

        if (chavesTurmas.length === 0) {
            grid.innerHTML = '<p style="padding:20px; color:#64748b;">Nenhuma redação das suas turmas aguardando correção.</p>';
            return;
        }

        chavesTurmas.forEach(cod => {
            const nomeTurma = mapaTurmas[cod] || "Turma: " + cod;
            const qtd = grupos[cod].length;

            html += `
                <div class="card-premium" style="margin-bottom: 15px; padding: 20px; border-left: 6px solid #003058; cursor:pointer;" 
                     onclick="window.verAlunosDaTurma('${cod}', '${nomeTurma}')">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h3 style="margin:0; color:#003058;">${nomeTurma}</h3>
                            <span style="font-size:12px; color:#64748b;">Código de Acesso: ${cod}</span>
                        </div>
                        <div style="background:#003058; color:white; padding:10px 20px; border-radius:10px; font-weight:900;">
                            ${qtd} ${qtd === 1 ? 'PENDENTE' : 'PENDENTES'}
                        </div>
                    </div>
                </div>`;
        });
        
        grid.innerHTML = html;
        recebidasCache = []; 
    } catch(e) {
        console.error(e);
        grid.innerHTML = '<p style="color:red; padding:20px;">Erro ao processar suas turmas.</p>';
    }
};

window.verAlunosDaTurma = async (codTurma, nomeTurma) => {
    const grid = document.getElementById('grid-turmas-escrita');
    grid.innerHTML = '<p>Carregando alunos...</p>';
    try {
        const userAtual = window.authMethods.getAuth().currentUser;
        const q = query(
            collection(db, "respostas_alunos"), 
            where("status", "==", "pendente"), 
            where("turma", "==", codTurma),
            where("professorResponsavelId", "==", userAtual.uid)
        );
        const snap = await getDocs(q);
        recebidasCache = [];
        snap.forEach(d => {
            const data = d.data();
            data.nomeTurmaReal = nomeTurma;
            // Garante que o campo texto seja lido corretamente (o aluno salva como 'resposta' ou 'texto')
            data.texto = data.texto || data.resposta || ""; 
            recebidasCache.push({ id: d.id, ...data });
        });

        paginaAtualRecebidas = 1;
        window.renderizarListaRecebidasInterna(nomeTurma);
    } catch(e) {
        console.error(e);
        alert("Erro ao carregar entregas desta turma.");
    }
};

window.renderizarListaRecebidasInterna = (nomeTurma) => {
    const container = document.getElementById('grid-turmas-escrita');
    const itensPorPaginaAlunos = 5;
    const totalPaginas = Math.ceil(recebidasCache.length / itensPorPaginaAlunos);
    const inicio = (paginaAtualRecebidas - 1) * itensPorPaginaAlunos;
    const itensPagina = recebidasCache.slice(inicio, inicio + itensPorPaginaAlunos);

    let htmlCabecalho = `
        <div style="width:100%; margin-bottom:15px;">
            <button onclick="window.carregarTodasRedacoesRecebidas()" style="background:#f1f5f9; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:700; color:#003058;">
                <i class="fa-solid fa-chevron-left"></i> VOLTAR PARA TURMAS
            </button>
            <h2 style="margin:15px 0; font-size:18px; color:#003058;">Redações da turma: ${nomeTurma}</h2>
        </div>`;

    let htmlLista = '';
    itensPagina.forEach(red => {
        const textoSeguro = (red.texto || '').replace(/`/g, "'").replace(/\$/g, "\\$");
        const dataEx = red.timestamp?.toDate ? red.timestamp.toDate().toLocaleDateString('pt-BR') : '---';
        
        htmlLista += `
            <div class="card-premium" style="margin-bottom: 10px; padding: 15px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #003058;">
                <div style="flex:1;">
                    <strong style="color:#003058;">${red.alunoNome || 'Estudante'}</strong>
                    <div style="font-size:11px; color:#64748b;">Tarefa: ${red.tituloAtividade || 'Sem título'} | Enviado: ${dataEx}</div>
                </div>
                <button onclick="window.abrirModalTexto('${red.id}', '${red.alunoNome || ''}', '${red.tituloAtividade || ''}', '${dataEx}', '${textoSeguro}')" 
                        style="background: #003058; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: 700;">
                    AVALIAR
                </button>
            </div>`;
    });

    let htmlPaginacao = '';
    if (totalPaginas > 1) {
        htmlPaginacao = `
            <div style="display: flex; justify-content: center; align-items: center; gap: 20px; margin-top: 20px;">
                <button onclick="window.mudarPaginaRecebidasInterna(-1, '${nomeTurma}')" ${paginaAtualRecebidas === 1 ? 'disabled style="opacity:0.3"' : ''} style="background:none; border:none; color:#003058; font-size: 22px; cursor:pointer;"><i class="fa-solid fa-circle-arrow-left"></i></button>
                <span style="font-weight:700; color:#003058;">${paginaAtualRecebidas} de ${totalPaginas}</span>
                <button onclick="window.mudarPaginaRecebidasInterna(1, '${nomeTurma}')" ${paginaAtualRecebidas === totalPaginas ? 'disabled style="opacity:0.3"' : ''} style="background:none; border:none; color:#003058; font-size: 22px; cursor:pointer;"><i class="fa-solid fa-circle-arrow-right"></i></button>
            </div>`;
    }

    container.innerHTML = htmlCabecalho + htmlLista + htmlPaginacao;
};

window.mudarPaginaRecebidasInterna = (dir, nomeTurma) => {
    paginaAtualRecebidas += dir;
    window.renderizarListaRecebidasInterna(nomeTurma);
};

window.renderizarListaRecebidas = () => {
    const grid = document.getElementById('grid-turmas-escrita');
    if (recebidasCache.length === 0) {
        grid.innerHTML = '<p style="padding:20px; color:#64748b;">Nenhuma redação recebida.</p>';
        return;
    }

    const totalPaginas = Math.ceil(recebidasCache.length / itensPorPagina);
    const inicio = (paginaAtualRecebidas - 1) * itensPorPagina;
    const itensPagina = recebidasCache.slice(inicio, inicio + itensPorPagina);

    let html = '';
    itensPagina.forEach(red => {
        const textoSeguro = (red.texto || '').replace(/`/g, "'").replace(/\$/g, "\\$");
        const dataEx = red.timestamp?.toDate ? red.timestamp.toDate().toLocaleDateString('pt-BR') : '---';
        
        html += `
            <div class="card-premium" style="margin-bottom: 10px; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #003058; position: relative;">
                <div style="flex:1; display:flex; align-items:center; gap:15px; flex-wrap:wrap;">
                    <strong style="color:#003058; font-size:14px;">${red.alunoNome || 'Estudante'}</strong>
                    <span style="font-size:12px; color:#64748b;">Turma: ${red.nomeTurmaReal || '---'}</span>
                    <span style="font-size:12px; color:#64748b;">Atividade: ${red.tituloAtividade || '---'}</span>
                    <span style="font-size:12px; color:#64748b;">Data: ${dataEx}</span>
                </div>
                <div style="display:flex; gap:8px;">
                 <button onclick="window.abrirModalTexto('${red.id}', '${red.alunoNome || ''}', '${red.tituloAtividade || ''}', '${dataEx}', '${textoSeguro}')" 
                style="background: #003058; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 11px; text-transform: uppercase;">
                ABRIR TEXTO
                </button>
                <button onclick="window.excluirRedacaoRecebida('${red.id}')" 
                style="background: #ef4444; color: white; border: none; width: 35px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content:center;">
                <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
            </div>`;
    });

    if (totalPaginas > 1) {
        html += `
            <div style="display: flex; justify-content: center; align-items: center; gap: 5px; margin-top: 20px;">
                <button onclick="window.mudarPaginaRecebidas(-1)" ${paginaAtualRecebidas === 1 ? 'disabled style="opacity:0.3"' : ''} style="background:none; border:none; color:#003058; font-size: 22px; cursor:pointer;"><i class="fa-solid fa-circle-arrow-left"></i></button>
                <span style="font-weight:700; color:#003058;">${paginaAtualRecebidas} de ${totalPaginas}</span>
                <button onclick="window.mudarPaginaRecebidas(1)" ${paginaAtualRecebidas === totalPaginas ? 'disabled style="opacity:0.3"' : ''} style="background:none; border:none; color:#003058; font-size: 22px; cursor:pointer;"><i class="fa-solid fa-circle-arrow-right"></i></button>
            </div>`;
    }
    grid.innerHTML = html;
};

window.mudarPaginaRecebidas = (dir) => {
    paginaAtualRecebidas += dir;
    window.renderizarListaRecebidas();
};

   window.abrirModalTexto = (id, alunoNome, tituloAtividade, data, texto) => {
    let modal = document.getElementById('modal-redacao-texto');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-redacao-texto';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;justify-content:center;align-items:center;z-index:9999;';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div style="background:#f8fafc; border-radius:16px; width:95%; max-width:850px; max-height:95vh; overflow-y:auto; padding:25px; position:relative; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
            <button onclick="this.closest('#modal-redacao-texto').style.display='none'" style="position:absolute; top:15px; right:15px; background:#e2e8f0; border:none; width:35px; height:35px; border-radius:50%; cursor:pointer; color:#003058; font-weight:bold; z-index:10;">✕</button>
            
            <div style="margin-bottom:20px; border-left: 5px solid #003058; padding-left: 15px;">
                <h2 style="color:#003058; margin:0; font-size:22px; text-transform: uppercase; font-weight:900;">${alunoNome}</h2>
                <p style="color:#64748b; margin:5px 0; font-size:13px; font-weight:600;">${tituloAtividade} • ENVIADO EM: ${data}</p>
            </div>

            <div class="folha-caderno-view">
                <div class="linha-pautada-view">
                    <div class="margem-numerica-view">
                    ${Array.from({ length: 25 }, (_, i) => `<div style="height: 30px;">${(i + 1)}</div>`).join('')}
                </div>
                    <div class="margem-vermelha-view"></div>
                    <div id="texto-para-copiar" class="texto-aluno-display">${texto}</div>
                </div>
            </div>

            <div style="display:flex; gap:10px; margin-top:20px;">
                <button onclick="window.copiarTextoRedacao()" style="flex:1; background:#fff; color:#003058; border:1px solid #003058; padding:12px; border-radius:8px; cursor:pointer; font-weight:700; font-size:13px;"><i class="fa-regular fa-copy"></i> COPIAR TEXTO</button>
                <button onclick="document.getElementById('area-comentario').style.display='block'; this.style.display='none'" style="flex:2; background:#003058; color:white; border:none; padding:12px; border-radius:8px; cursor:pointer; font-weight:700; font-size:13px;"><i class="fa-regular fa-comment-dots"></i> Enviar Feedback</button>
            </div>

            <div id="area-comentario" style="display:none; margin-top:20px; padding:20px; background:#fff; border-radius:12px; border:1px solid #e2e8f0; animation: fadeIn 0.3s ease;">
                <label style="font-size:11px; font-weight:800; color:#003058; display:block; margin-bottom:10px; text-transform:uppercase;">Feedback do Professor:</label>
                <textarea id="input-feedback-prof" style="width:100%; min-height:100px; border:1px solid #cbd5e1; border-radius:8px; padding:12px; font-family:inherit; margin-bottom:15px; outline:none; resize:vertical;" placeholder="Escreva aqui os pontos positivos e o que o aluno precisa melhorar..." autocomplete="off" spellcheck="false"></textarea>
                <button id="btn-finalizar-correcao" onclick="window.enviarFeedbackRedacao('${id}')" style="width:100%; background:#003058; color:white; border:none; padding:15px; border-radius:8px; cursor:pointer; font-weight:800; text-transform:uppercase; box-shadow: 0 4px 12px rgba(0,48,88,0.2);">FINALIZAR CORREÇÃO</button>
            </div>
        </div>`;
    modal.style.display = 'flex';
};

window.copiarTextoRedacao = () => {
    const texto = document.getElementById('texto-para-copiar').innerText;
    navigator.clipboard.writeText(texto);
    window.mostrarToastSucesso("Texto copiado para a área de transferência!");
};

window.enviarFeedbackRedacao = async (redacaoId) => {
    const btn = document.getElementById('btn-finalizar-correcao');
    const comentario = document.getElementById('input-feedback-prof').value;
    const userAtual = window.authMethods.getAuth().currentUser;

    if (!comentario.trim()) {
        window.mostrarAvisoErro("Escreva um comentário antes de enviar."); 
        return;
    }

    if (!userAtual) {
        window.mostrarAvisoErro("Sessão expirada. Refaça o login.");
        return;
    }

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ENVIANDO...';
            btn.style.opacity = "0.7";
            btn.style.cursor = "not-allowed";
        }

        const redRef = doc(db, "respostas_alunos", redacaoId);
        await updateDoc(redRef, {
            feedbackProfessor: comentario,
            status: 'corrigida',
            dataCorrecao: serverTimestamp(),
            professorId: userAtual.uid
        });

        window.mostrarToastSucesso("Feedback enviado com sucesso!");
        
        const modal = document.getElementById('modal-redacao-texto');
        if(modal) modal.style.display = 'none';
        
        await window.carregarTodasRedacoesRecebidas(); 
        
    } catch (e) {
        console.error("Erro ao enviar feedback:", e);
        window.mostrarAvisoErro("Não foi possível salvar a correção.");
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'FINALIZAR CORREÇÃO';
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";
        }
    }
};

window.carregarRedacoesCorrigidas = async () => {
    const container = document.getElementById('lista-corrigidas-content');
    container.innerHTML = '<p style="padding:20px; color:#64748b;">Buscando suas correções...</p>';
    try {
        const userAtual = window.authMethods.getAuth().currentUser;
        if (!userAtual) return;

        const q = query(
            collection(db, "respostas_alunos"), 
            where("status", "==", "corrigida"),
            where("professorId", "==", userAtual.uid),
            where("tipo", "==", "escrita"),
            orderBy("dataCorrecao", "desc")
        );
        
        const snap = await getDocs(q);
        corrigidasCache = [];
        
        snap.forEach(d => {
            corrigidasCache.push({ id: d.id, ...d.data() });
        });

        if (corrigidasCache.length === 0) {
            container.innerHTML = '<p style="padding:20px; color:#64748b;">Você ainda não possui redações corrigidas.</p>';
            return;
        }

        paginaAtualCorrigidas = 1;
        window.renderizarListaCorrigidas();
    } catch (e) { 
        console.error("Erro ao carregar corrigidas:", e);
        container.innerHTML = '<p style="color:red; padding:20px;">Erro ao carregar corrigidas. Se for a primeira vez, clique no link do console para gerar o índice do Firebase.</p>'; 
    }
};

window.excluirRedacaoRecebida = (id) => {
    window.confirmarExclusaoModal(async () => {
        try {
            const { doc, deleteDoc } = window.fsMethods;
            await deleteDoc(doc(window.db, "redacoes", id));
            window.mostrarToastSucesso("Redação removida com sucesso!");
            window.carregarTodasRedacoesRecebidas();
        } catch (e) {
            alert("Erro ao excluir redação.");
        }
    });
};

window.renderizarListaCorrigidas = () => {
    const container = document.getElementById('lista-corrigidas-content');
    if (corrigidasCache.length === 0) {
        container.innerHTML = '<p style="padding:20px; color:#64748b;">Nenhuma redação corrigida ainda.</p>';
        return;
    }

    const totalPaginas = Math.ceil(corrigidasCache.length / itensPorPaginaCorrigidas);
    const inicio = (paginaAtualCorrigidas - 1) * itensPorPaginaCorrigidas;
    const itensPagina = corrigidasCache.slice(inicio, inicio + itensPorPaginaCorrigidas);

    let html = '';
    itensPagina.forEach(red => {
        const dataEx = red.dataCorrecao?.toDate ? red.dataCorrecao.toDate().toLocaleDateString('pt-BR') : '---';
        html += `
            <div class="card-premium" style="margin-bottom: 5px; padding: 15px; border-left: 4px solid #003058;">
    <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
            <strong style="color:#003058;">${red.alunoNome}</strong>
            <div style="font-size:11px; color:#64748b;">Corrigida em: ${dataEx}</div>
        </div>
        <span style="background:#e2e8f0; color:#003058; font-size:10px; padding:4px 8px; border-radius:4px; font-weight:800;">CORRIGIDA</span>
    </div>
                <div style="margin-top:5px; font-style:italic; color:#475569; font-size:13px; background:#f8fafc; padding:10px; border-radius:6px;">
                    " ${red.feedbackProfessor} "
                </div>
            </div>`;
    });

    if (totalPaginas > 1) {
        html += `
            <div style="display: flex; justify-content: center; align-items: center; gap: 20px; margin-top: 20px;">
                <button onclick="window.mudarPaginaCorrigidas(-1)" ${paginaAtualCorrigidas === 1 ? 'disabled style="opacity:0.3"' : ''} style="background:none; border:none; color:#003058; font-size: 22px; cursor:pointer;"><i class="fa-solid fa-circle-arrow-left"></i></button>
                <span style="font-weight:700; color:#003058;">${paginaAtualCorrigidas} de ${totalPaginas}</span>
                <button onclick="window.mudarPaginaCorrigidas(1)" ${paginaAtualCorrigidas === totalPaginas ? 'disabled style="opacity:0.3"' : ''} style="background:none; border:none; color:#003058; font-size: 22px; cursor:pointer;"><i class="fa-solid fa-circle-arrow-right"></i></button>
            </div>`;
    }
    container.innerHTML = html;
};

window.mudarPaginaCorrigidas = (dir) => {
    paginaAtualCorrigidas += dir;
    window.renderizarListaCorrigidas();
};

window.mostrarToastSucesso = (mensagem) => {
    const toast = document.createElement('div');
    toast.className = 'toast-sucesso';
    toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${mensagem}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.5s ease-in reverse';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

window.visualizarProposta = (id) => {
    const data = propostasCache.find(item => item.id === id);
    if (!data) return;

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(5px);';
    
    const prazoF = data.prazo ? new Date(data.prazo).toLocaleDateString('pt-BR') : '--/--/--';
    const displayImg = data.imagemApoio ? 'block' : 'none';

    modal.innerHTML = `
        <div style="background:white; border-radius:20px; max-width:850px; width:100%; padding:30px; position:relative; animation: slideUp 0.3s ease; font-family: 'Inter', sans-serif; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            <button onclick="this.parentElement.parentElement.remove()" style="position:absolute; top:15px; right:15px; border:none; background:#f1f5f9; width:35px; height:35px; border-radius:50%; font-size:20px; cursor:pointer; color:#64748b; display:flex; align-items:center; justify-content:center;">&times;</button>
            
            <div style="background: white; padding: 20px; border-radius: 16px; border: 1px solid #edf2f7; border-left: 6px solid #003058; margin-bottom:0; text-align:left;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                    <div>
                        <span style="font-size:10px; background:#003058; color:white; padding:2px 8px; border-radius:4px; font-weight:800; text-transform:uppercase;">Visualização da Proposta</span>
                        <h2 style="color:#003058; font-size:1.4rem; margin:5px 0 0 0; font-weight:900;">${data.titulo || 'SEM TÍTULO'}</h2>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:11px; font-weight:800; color:#e67e22; display:block;">PRAZO DE ENTREGA</span>
                        <span style="font-size:14px; font-weight:700; color:#334155;">${prazoF}</span>
                    </div>
                </div>

                <div style="display:flex; gap:20px; margin-top:15px; align-items: flex-start;">
                    <div style="flex: 1; font-size:15px; color:#475569; white-space:pre-line; line-height:1.6; max-height:400px; overflow-y:auto; text-align:left;">
                        ${data.conteudo.trim()}
                    </div>

                    ${data.imagemApoio ? `
                    <div style="flex: 0 0 200px; max-width: 200px;">
                        <p style="font-size:9px; font-weight:800; color:#94a3b8; margin-bottom:5px; text-transform:uppercase;">Imagem de Apoio:</p>
                        <img src="${data.imagemApoio}" style="width:100%; height:auto; border-radius:10px; border:1px solid #e2e8f0; display:block; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    </div>` : ''}
                </div>
            </div>
            
            <div style="margin-top:25px; display:flex; gap:10px;">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="flex:1; padding:15px; background:#003058; color:white; border:none; border-radius:12px; font-weight:800; cursor:pointer; text-transform:uppercase; letter-spacing:1px;">FECHAR JANELA</button>
            </div>
        </div>
        <style>
            @keyframes slideUp { from { transform:translateY(30px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        </style>
    `;
    document.body.appendChild(modal);
};

    return `
    <style>
        .escrita-container { width: 100%; font-family: 'Inter', sans-serif; padding: 20px; box-sizing: border-box; }
        .header-prof h1 { font-size: 28px; font-weight: 800; color: #003058; text-transform: uppercase; margin-bottom: 20px; }
        .main-tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
        .main-tab-btn { padding: 10px 20px; border: none; background: none; cursor: pointer; font-weight: 700; color: #64748b; font-size: 13px; }
        .main-tab-btn.active { color: #003058; border-bottom: 3px solid #003058; }
        .card-premium { background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #eef2f6; width: 100%; box-sizing: border-box; }
        .input-premium { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; margin-bottom: 15px; box-sizing: border-box; font-family: inherit; }
        .btn-turma-pill { padding: 8px 16px; border: 1px solid #e2e8f0; background: #fff; border-radius: 20px; cursor: pointer; font-size: 11px; font-weight: 700; margin-right: 5px; margin-bottom: 5px;}
        .btn-turma-pill.active { background: #003058; color: white; border-color: #003058; }
        .btn-publish { background: #003058; color: white; border: none; padding: 15px; border-radius: 10px; font-weight: 700; cursor: pointer; flex: 1; }
        .btn-photo { background: #f1f5f9; color: #003058; border: none; width: 50px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; }
        .tag-turma-simple { font-size: 10px; font-weight: 800; color: #003058; background: #e2e8f0; border-radius: 4px; text-transform: uppercase; }
        .tab-pane-escrita { display: none; }

        @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Estilo da Folha de Caderno para o Professor */
.folha-caderno-view { 
    background: #fff; 
    border-radius: 4px; 
    box-shadow: 0 5px 15px rgba(0,0,0,0.1); 
    border: 1px solid #d1d5db; 
    position: relative; 
    width: 100%; 
    margin: 15px 0; 
    overflow: hidden; 
}
.linha-pautada-view { 
    position: relative; 
    background: #fff; 
    padding-left: 55px; 
    /* O gradiente cria as linhas. 30px é a altura de cada linha */
    background-image: linear-gradient(#e5e7eb 1px, transparent 1px); 
    background-size: 100% 30px; 
    line-height: 30px; 
    /* 25 linhas x 30px = 750px de altura fixa */
    height: 750px; 
}
.texto-aluno-display { 
    width: 100%; 
    height: 750px; /* Mesma altura da folha */
    background: transparent; 
    border: none; 
    font-family: 'Kalam', cursive; 
    font-size: 18px; 
    color: #2c3e50; 
    padding: 0 15px; 
    line-height: 30px; 
    white-space: pre-wrap; 
    word-wrap: break-word;
    display: block; 
    box-sizing: border-box; 
}
.margem-numerica-view { 
    position: absolute; left: 0; top: 0; bottom: 0; width: 40px; 
    text-align: center; color: #94a3b8; font-family: monospace; 
    font-size: 11px; border-right: 1px solid #fca5a5; 
}
.margem-vermelha-view { 
    position: absolute; left: 50px; top: 0; bottom: 0; width: 1px; 
    background: #fca5a5; opacity: 0.5; 
}
    /* Estilo do Toast Moderno */
.toast-sucesso {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #003058;
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 10000;
    animation: slideIn 0.5s ease-out;
    font-weight: 600;
}

@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

/* Estilo do Modal de Confirmação */
.confirm-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
    display: flex; justify-content: center; align-items: center; z-index: 10001;
}
.confirm-card {
    background: white; padding: 25px; border-radius: 16px; width: 90%; max-width: 350px;
    text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);
}
.confirm-buttons { display: flex; gap: 10px; margin-top: 20px; }
.btn-cancel { flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-weight: 700; background: #fff; }
.btn-confirm-del { flex: 1; padding: 12px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; }

    </style>

    <div class="escrita-container">
        <div class="header-prof"><h1>ESCRITA</h1></div>
        <div class="main-tabs">
    <button id="tab-btn-criar" class="main-tab-btn active" onclick="window.switchMainTabEscrita('criar')">FAZER PROPOSTA</button>
    <button id="tab-btn-lista" class="main-tab-btn" onclick="window.switchMainTabEscrita('lista')">ENVIADAS</button>
    <button id="tab-btn-recebidas" class="main-tab-btn" onclick="window.switchMainTabEscrita('recebidas')">RECEBIDAS</button>
    <button id="tab-btn-corrigidas" class="main-tab-btn" onclick="window.switchMainTabEscrita('corrigidas')">CORRIGIDAS</button>
</div>

        <div id="pane-criar" class="tab-pane-escrita" style="display:block;">
            <div class="card-premium" style="padding: 25px;">
                <label style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Selecione o semestre:</label>
                <div id="turma-pills-escrita" style="display:flex; flex-wrap:wrap; gap:5px; margin: 10px 0 20px 0;"></div>
                
                <div style="display: flex; gap: 15px; width: 100%;">
                    <div style="flex: 2;">
                        <label style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Título da Atividade:</label>
                        <input type="text" id="titulo-escrita-prof" class="input-premium" placeholder="Ex: Minha família" maxlength="100" autocomplete="off">
                    </div>
                    <div style="flex: 1;">
                    <label style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Prazo:</label>
                    <input type="date" id="prazo-escrita-prof" class="input-premium" onfocus="this.min=new Date().toISOString().split('T')[0]">
                    </div>
                </div>

                <label style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Instruções / Tema:</label>
                <textarea class="input-premium" style="min-height: 120px;" placeholder="Digite aqui o tema..." autocomplete="off" spellcheck="false"></textarea>

                <div id="container-preview-img" style="display:none; margin-bottom:15px; background:#f8fafc; padding:10px; border-radius:8px; align-items:center; gap:10px; position: relative; width: fit-content;">
                <img id="preview-img-escrita" onclick="window.triggerClickInputFile()" title="Clique para trocar a foto" style="width:60px; height:60px; border-radius:6px; object-fit:cover; border:2px solid #003058; cursor:pointer;">
                <button onclick="window.removerFotoEscrita()" style="position:absolute; top:-5px; right:-5px; background:#ef4444; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center;">×</button>
                <span style="font-size:11px; color:#64748b;">Clique na foto para trocar</span>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button class="btn-photo" onclick="window.triggerClickInputFile()"><i class="fa-solid fa-camera"></i></button>
                    <input type="file" id="file-escrita-img" style="display:none" accept="image/*" onchange="window.handleImagePreview(this)">
                    <button class="btn-publish" onclick="window.enviarRedacaoProfessor()">PUBLICAR AGORA</button>
                </div>
            </div>
        </div>

        <div id="pane-lista" class="tab-pane-escrita">
            <div id="lista-propostas-content"></div>
        </div>

       <div id="pane-recebidas" class="tab-pane-escrita">
    <div id="grid-turmas-escrita" style="display: flex; flex-direction: column; width: 100%;"></div>
</div>

<div id="pane-corrigidas" class="tab-pane-escrita">
    <div id="lista-corrigidas-content" style="display: flex; flex-direction: column; width: 100%;"></div>
</div>

    </div>`;
});
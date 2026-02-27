window.Router.register('escritaalunoclm', async () => {
    const db = window.db;
    const fs = window.fsMethods;
    const auth = window.authMethods.getAuth();

    // Bloqueio de interface (Anti-Plágio)
    document.addEventListener('copy', (e) => e.preventDefault());
    document.addEventListener('paste', (e) => e.preventDefault());
    document.addEventListener('cut', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    let propostaAtiva = null;
    let paginaAtualEnviadas = 1; 
    const itensPorPaginaEnviadas = 6; 
    let paginaRecebidas = 1; 
    const itensPorPaginaRecebidas = 6; 

    const obterUsuario = () => {
        return new Promise((resolve) => {
            const unsubscribe = auth.onAuthStateChanged(user => {
                unsubscribe();
                resolve(user);
            });
        });
    };

    const user = await obterUsuario();
    if (!user) return `<div style="padding:20px;text-align:center;">Sessão expirada. Refaça o login.</div>`;

    // --- FUNÇÃO PARA ALERTAS MODERNOS ---
    window.mostrarAviso = (titulo, mensagem, tipo = 'sucesso', callback = null) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:Inter,sans-serif;padding:20px;box-sizing:border-box;';
        
        const corPrimaria = tipo === 'pergunta' ? '#e67e22' : (tipo === 'erro' ? '#dc2626' : '#003058');
        const icone = tipo === 'pergunta' ? 'fa-circle-question' : (tipo === 'erro' ? 'fa-circle-xmark' : 'fa-circle-check');

        overlay.innerHTML = `
            <div style="background:white;padding:30px;border-radius:20px;max-width:400px;width:100%;text-align:center;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);animation: zoomIn 0.3s ease;">
                <i class="fa-solid ${icone}" style="font-size:3rem;color:${corPrimaria};margin-bottom:15px;"></i>
                <h3 style="margin:0 0 10px 0;color:#003058;">${titulo}</h3>
                <p style="color:#64748b;font-size:14px;margin-bottom:20px;line-height:1.5;">${mensagem}</p>
                <div style="display:flex;gap:10px;justify-content:center;">
                    ${tipo === 'pergunta' ? `<button id="btn-cancel" style="padding:10px 20px;border-radius:8px;border:1px solid #e2e8f0;background:white;cursor:pointer;font-weight:600;">Cancelar</button>` : ''}
                    <button id="btn-confirm" style="padding:10px 20px;border-radius:8px;border:none;background:#003058;color:white;cursor:pointer;font-weight:600;">${tipo === 'pergunta' ? 'Confirmar' : 'Entendido'}</button>
                </div>
            </div>
            <style>
                @keyframes zoomIn { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }
            </style>
        `;

        document.body.appendChild(overlay);
        const fechar = () => overlay.remove();
        overlay.querySelector('#btn-confirm').onclick = () => {
            fechar();
            if (callback) callback();
        };
        if (tipo === 'pergunta') {
            overlay.querySelector('#btn-cancel').onclick = fechar;
        }
    };

    // --- LÓGICA DE NAVEGAÇÃO ---
    window.switchTabEscrita = (tab) => {
        const tabs = ['recebidas', 'escrever', 'enviadas'];
        
        if (tab === 'escrever' && !propostaAtiva) {
            // Tenta recuperar do rascunho se não houver proposta ativa (abertura direta)
            const rascunho = localStorage.getItem(`rascunho_redacao_${user.uid}`);
            document.getElementById('texto-redacao').value = rascunho || "";
            document.getElementById('tema-dinamico').innerText = "Selecione uma atividade para começar...";
            document.getElementById('prazo-dinamico').innerText = "--/--/--";
            document.getElementById('container-img-apoio').style.display = 'none';
            document.getElementById('contador-palavras').innerText = rascunho ? rascunho.trim().split(/\s+/).length : "0";
        }

        tabs.forEach(t => {
            const content = document.getElementById(`tab-${t}`);
            const btn = document.getElementById(`btn-tab-${t}`);
            if (content) content.style.display = (t === tab) ? 'block' : 'none';
            if (btn) {
                btn.className = (t === tab) ? 'pill-tab pill-active' : 'pill-tab pill-inactive';
            }
        });
        if (tab === 'enviadas') carregarEnviadas();
        if (tab === 'recebidas') carregarPropostasDisponiveis();
    };

    // --- BUSCAR PROPOSTAS (RECEBIDAS) ---
    async function carregarPropostasDisponiveis() {
        const container = document.getElementById('lista-propostas-recebidas');
        if (!container) return;
        container.innerHTML = '<p style="padding:20px;color:#64748b;">Buscando atividades...</p>';
        try {
            const alunoSnap = await fs.getDoc(fs.doc(db, "usuarios", user.uid));
            const turmaAluno = alunoSnap.exists() ? alunoSnap.data().turma : null;
            if (!turmaAluno) return container.innerHTML = '<p style="padding:20px;">Turma não identificada.</p>';

            const qEnviadas = fs.query(fs.collection(db, "respostas_alunos"), fs.where("alunoId", "==", user.uid));
            const enviadasSnap = await fs.getDocs(qEnviadas);
            const idsFeitos = new Set();
            enviadasSnap.forEach(doc => {
                const data = doc.data();
                if (data.atividadeId) idsFeitos.add(data.atividadeId);
            });

            const qAtv = fs.query(fs.collection(db, "atividades_enviadas"), fs.where("turma", "==", turmaAluno), fs.where("tipo", "==", "escrita"));
            const snap = await fs.getDocs(qAtv);
            
            let todasPropostas = [];
            snap.forEach(docSnap => {
                const data = { id: docSnap.id, ...docSnap.data() };
                if (!idsFeitos.has(data.id)) todasPropostas.push(data);
            });

            if (todasPropostas.length === 0) {
                container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Nenhuma proposta pendente.</div>';
                return;
            }

            const totalPaginas = Math.ceil(todasPropostas.length / itensPorPaginaRecebidas);
            const inicio = (paginaRecebidas - 1) * itensPorPaginaRecebidas;
            const propostasPagina = todasPropostas.slice(inicio, inicio + itensPorPaginaRecebidas);

            container.innerHTML = "";
            propostasPagina.forEach(data => {
                const prazoF = data.prazo ? new Date(data.prazo).toLocaleDateString('pt-BR') : 'Sem prazo';
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0); // Zera as horas para comparar apenas os dias
                const dataPrazo = data.prazo ? new Date(data.prazo) : null;
                const prazoVencido = dataPrazo && hoje > dataPrazo;
                const card = document.createElement('div');
                card.className = 'card-aluno-atv';
                card.style.marginBottom = "10px";
                card.innerHTML = `
                    <div style="min-width: 0; flex: 1;">
                        <strong style="color: #003058; display: block; font-size: 14px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${data.titulo || "Sem Título"}</strong>
                        <p style="font-size: 11px; color: ${prazoVencido ? '#dc2626' : '#64748b'}; margin-top: 4px; margin-bottom: 0;">
                            <i class="fa-regular fa-calendar"></i> Prazo: ${prazoF} ${prazoVencido ? '<strong>(VENCIDO)</strong>' : ''}
                        </p>
                    </div>
                    <button class="btn-acao-card" style="margin-left: auto;">ESCREVER</button>
                `;
                if (prazoVencido) {
                card.style.opacity = '0.6';
                card.style.cursor = 'not-allowed';
                card.querySelector('.btn-acao-card').innerText = 'PRAZO ENCERRADO';
                card.querySelector('.btn-acao-card').style.background = '#94a3b8';
    
                card.onclick = (e) => {
                e.stopPropagation();
                window.mostrarAviso("Prazo Encerrado", "Esta atividade expirou e não pode mais ser iniciada.", "erro");
                };
                } else {
                card.onclick = () => abrirEditorComProposta(data);
            }
                container.appendChild(card);
            });

            if (totalPaginas > 1) {
                const nav = document.createElement('div');
                nav.style.cssText = "display:flex; justify-content:center; align-items:center; gap:20px; margin-top:15px; padding:10px; width:100%;";
                nav.innerHTML = `
                    <button id="prev-rec" style="background:none; border:none; color:#003058; cursor:pointer; font-size:1.5rem; opacity:${paginaRecebidas === 1 ? '0.2' : '1'}">
                        <i class="fa-solid fa-circle-arrow-left"></i>
                    </button>
                    <span style="font-weight:800; color:#003058; font-size:14px;">${paginaRecebidas} de ${totalPaginas}</span>
                    <button id="next-rec" style="background:none; border:none; color:#003058; cursor:pointer; font-size:1.5rem; opacity:${paginaRecebidas === totalPaginas ? '0.2' : '1'}">
                        <i class="fa-solid fa-circle-arrow-right"></i>
                    </button>
                `;
                container.appendChild(nav);
                nav.querySelector('#prev-rec').onclick = (e) => { e.stopPropagation(); if (paginaRecebidas > 1) { paginaRecebidas--; carregarPropostasDisponiveis(); } };
                nav.querySelector('#next-rec').onclick = (e) => { e.stopPropagation(); if (paginaRecebidas < totalPaginas) { paginaRecebidas++; carregarPropostasDisponiveis(); } };
            }
        } catch (e) { container.innerHTML = '<p style="padding:20px;">Erro ao carregar.</p>'; }
    }

    // --- ABRIR EDITOR ---
    function abrirEditorComProposta(proposta) {
        propostaAtiva = proposta;
        window.switchTabEscrita('escrever');
        
        // Verifica se há rascunho salvo para ESTA atividade específica ou carrega o texto original
        const rascunhoSalvo = localStorage.getItem(`rascunho_${proposta.id || proposta.idOriginal}_${user.uid}`);
        
        document.getElementById('texto-redacao').value = rascunhoSalvo || proposta.textoOriginal || "";
        document.getElementById('tema-dinamico').innerText = proposta.conteudo || proposta.titulo || "Redação";
        
        const prazoElement = document.getElementById('prazo-dinamico');
        if (proposta.prazo) {
            prazoElement.innerText = new Date(proposta.prazo).toLocaleDateString('pt-BR');
        } else {
            prazoElement.innerText = '--/--/--';
        }
        
        const imgCont = document.getElementById('container-img-apoio');
        const imgTag = document.getElementById('img-apoio-dinamica');
        
        if (proposta.imagemApoio && proposta.imagemApoio !== "") { 
            imgTag.src = proposta.imagemApoio; 
            imgCont.style.display = 'block'; 
        } else { 
            imgCont.style.display = 'none'; 
            imgTag.src = "";
        }
        
        window.scrollTo(0, 0);
        inicializarLogicaEditor();
    }

    function inicializarLogicaEditor() {
        const textarea = document.getElementById('texto-redacao');
        const wordCountSpan = document.getElementById('contador-palavras');
        const saveIndicator = document.getElementById('salvamento-status');

        if (!textarea) return;

        /* ===============================
   LÓGICA DO EDITOR — MOBILE
   LIMITE ATÉ O FINAL DA LINHA 25
   =============================== */

textarea.onkeydown = function(e) {
    if (window.innerWidth >= 768) return;

    // Bloqueio de Atalhos de Teclado (Ctrl+C, Ctrl+V, etc) no Mobile
    if (e.ctrlKey || e.metaKey) {
        const proibidas = ['c', 'v', 'x', 'a'];
        if (proibidas.includes(e.key.toLowerCase())) {
            e.preventDefault();
            return false;
        }
    }

    const linhas = textarea.value.split('\n');
    const linhaAtual = linhas.length;
    const textoLinhaAtual = linhas[linhaAtual - 1] || '';

    const teclasPermitidas = [
        'Backspace', 'Delete',
        'ArrowLeft', 'ArrowRight',
        'ArrowUp', 'ArrowDown'
    ];

    if (linhaAtual > 25) {
        e.preventDefault();
        return false;
    }

    if (e.key === 'Enter' && linhaAtual >= 25) {
        e.preventDefault();
        return false;
    }

    if (linhaAtual === 25 && textoLinhaAtual.length >= 72 && !teclasPermitidas.includes(e.key)) {
        e.preventDefault();
        return false;
    }
};

    /* ===============================
   LÓGICA DO EDITOR — DESKTOP
   LIMITE ATÉ O FINAL DA LINHA 25
   =============================== */

/* ===============================
   LÓGICA DO EDITOR — DESKTOP
   LIMITE REAL DE 25 LINHAS VISÍVEIS
   (ENTER + QUEBRA AUTOMÁTICA)
   =============================== */

textarea.addEventListener('input', function () {
    if (window.innerWidth < 768) return;

    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight);
    const maxLinhas = 25;
    const maxAltura = lineHeight * maxLinhas;

    // Enquanto o conteúdo ultrapassar 25 linhas visuais, corta
    while (textarea.scrollHeight > maxAltura) {
        textarea.value = textarea.value.slice(0, -1);
    }

    const textoLimpo = textarea.value.trim();
    wordCountSpan.innerText = textoLimpo ? textoLimpo.split(/\s+/).length : 0;

    if (propostaAtiva) {
        const idKey = propostaAtiva.idOriginal || propostaAtiva.id;
        localStorage.setItem(`rascunho_${idKey}_${user.uid}`, textarea.value);

        if (saveIndicator) {
            saveIndicator.style.opacity = "1";
            clearTimeout(window.saveTimeout);
            window.saveTimeout = setTimeout(() => {
                saveIndicator.style.opacity = "0";
            }, 2000);
        }
    }
});



/* ===============================
   LÓGICA DO EDITOR — MOBILE
   LIMITE ATÉ O FINAL DA LINHA 25
   =============================== */

const MAX_LINHAS = 25;
const MAX_COLUNAS_ULTIMA = 72;

/* BLOQUEIO ANTES DE DIGITAR */
textarea.addEventListener('beforeinput', function (e) {
    if (window.innerWidth >= 768) return;

    const linhas = textarea.value.split('\n');

    /* Bloqueia ENTER após a linha 25 */
    if (e.inputType === 'insertLineBreak' && linhas.length >= MAX_LINHAS) {
        e.preventDefault();
        return;
    }

    /* Bloqueia texto após o fim da linha 25 */
    if (linhas.length === MAX_LINHAS) {
        const ultimaLinha = linhas[MAX_LINHAS - 1];

        if (
            e.inputType === 'insertText' &&
            ultimaLinha.length >= MAX_COLUNAS_ULTIMA
        ) {
            e.preventDefault();
            return;
        }
    }
});

/* GARANTIA (COLAR / BUG DE NAVEGADOR) */
textarea.addEventListener('input', function () {
    if (window.innerWidth >= 768) return;

    let linhas = textarea.value.split('\n');

    if (linhas.length > MAX_LINHAS) {
        linhas = linhas.slice(0, MAX_LINHAS);
    }

    if (linhas.length === MAX_LINHAS) {
        linhas[MAX_LINHAS - 1] =
            linhas[MAX_LINHAS - 1].slice(0, MAX_COLUNAS_ULTIMA);
    }

    textarea.value = linhas.join('\n');

    const textoLimpo = textarea.value.trim();
    wordCountSpan.innerText = textoLimpo
        ? textoLimpo.split(/\s+/).length
        : 0;

    if (propostaAtiva) {
        const idKey = propostaAtiva.idOriginal || propostaAtiva.id;
        localStorage.setItem(
            `rascunho_${idKey}_${user.uid}`,
            textarea.value
        );

        if (saveIndicator) {
            saveIndicator.style.opacity = "1";
            clearTimeout(window.saveTimeout);
            window.saveTimeout = setTimeout(() => {
                saveIndicator.style.opacity = "0";
            }, 2000);
        }
    }
});



        const inicial = textarea.value.trim();
        wordCountSpan.innerText = inicial ? inicial.split(/\s+/).length : 0;
    }

    // --- ENVIAR REDAÇÃO ---
    window.enviarRedacaoFinal = async () => {
        const textarea = document.getElementById('texto-redacao');
        const texto = textarea.value;
        
        if (!texto.trim()) {
            return window.mostrarAviso("Atenção", "A folha está vazia!", "pergunta");
        }
        
        try {
            const alunoSnap = await fs.getDoc(fs.doc(db, "usuarios", user.uid));
            const dadosAluno = alunoSnap.data();
            
            const idAtvBusca = propostaAtiva?.atividadeId || propostaAtiva?.id;
            const atvDoc = await fs.getDoc(fs.doc(db, "atividades_enviadas", idAtvBusca));
            const dadosAtv = atvDoc.exists() ? atvDoc.data() : {};
            const professorId = dadosAtv.professorId || null;

            const payload = {
                alunoId: user.uid,
                alunoNome: dadosAluno.nome || "Estudante",
                atividadeId: idAtvBusca,
                dataEntrega: new Date().toLocaleDateString('pt-BR'),
                timestamp: fs.serverTimestamp(),
                nota: "",
                professorResponsavelId: professorId,
                respostas: [texto],
                texto: texto,
                semestre: dadosAtv.semestre || "1º Semestre",
                status: "pendente",
                tipo: "escrita",
                tipoAtividade: "escrita",
                tituloAtividade: propostaAtiva?.titulo || propostaAtiva?.tituloAtividade || "Redação",
                turma: dadosAluno.turma || "Sem Turma",
                fotoRedacao: "" 
            };

            const idReferencia = propostaAtiva?.idOriginal || null;

            if (idReferencia) {
                await fs.updateDoc(fs.doc(db, "respostas_alunos", idReferencia), payload);
                window.mostrarAviso("Atualizado!", "Sua redação foi atualizada.", "sucesso");
            } else {
                await fs.addDoc(fs.collection(db, "respostas_alunos"), payload);
                window.mostrarAviso("Enviado!", "Sua redação foi entregue.", "sucesso");
            }
            
            const idKey = idReferencia || idAtvBusca;
            localStorage.removeItem(`rascunho_${idKey}_${user.uid}`);
            
            textarea.value = "";
            propostaAtiva = null;
            
            // Atualiza ambas as listas para garantir que saia de uma e entre na outra
            await carregarPropostasDisponiveis();
            await carregarEnviadas();
            
            window.switchTabEscrita('enviadas');
        } catch (e) { 
            console.error(e);
            window.mostrarAviso("Erro ao enviar", "Não foi possível entregar sua atividade. Tente novamente.", "erro"); 
        }
    };

    // --- CARREGAR ENVIADAS ---
        async function carregarEnviadas() {
        const container = document.getElementById('lista-redacoes-enviadas');
        if (!container) return;
        container.innerHTML = '<p style="padding:20px;color:#64748b;">Carregando...</p>';
        try {
            const q = fs.query(
                fs.collection(db, "respostas_alunos"), 
                fs.where("alunoId", "==", user.uid), 
                fs.where("tipo", "==", "escrita")
            );
            const snap = await fs.getDocs(q);
            if(snap.empty) {
                container.innerHTML = '<p style="padding:20px;color:#94a3b8;">Nenhuma enviada.</p>';
                return;
            }
            const todas = [];
            snap.forEach(d => todas.push({ id: d.id, ...d.data() }));
            todas.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            const totalPaginas = Math.ceil(todas.length / itensPorPaginaEnviadas);
            const inicio = (paginaAtualEnviadas - 1) * itensPorPaginaEnviadas;
            const redaçõesPagina = todas.slice(inicio, inicio + itensPorPaginaEnviadas);
            container.innerHTML = "";
            redaçõesPagina.forEach(red => {
                const podeEditar = red.status === 'pendente';
                const statusBadge = red.status === 'corrigida' ? 
                    '<span style="color:#003058; font-size:10px; font-weight:800;">[ FINALIZADA / CORRIGIDA ]</span>' : 
                    (red.status === 'em_correcao' ? '<span style="color:#e67e22; font-size:10px; font-weight:800;">[ EM AVALIAÇÃO ]</span>' : '');
                const card = document.createElement('div');
                card.className = 'card-aluno-atv';
                card.style.marginBottom = "10px";
                card.innerHTML = `
                    <div style="flex:1; min-width: 200px;">
                        <strong style="color:#003058;">${red.tituloAtividade}</strong>
                        <p style="font-size:11px; color:#64748b; margin-top:4px;">Enviado em: ${red.dataEntrega || '---'} ${statusBadge}</p>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        ${podeEditar ? `<button class="btn-acao-card btn-editar" style="background:#003058;">EDITAR</button>` : `<i class="fa-solid fa-lock" style="color:#94a3b8; font-size:1.2rem;"></i>`}
                    </div>
                `;
                if(podeEditar) {
                    card.querySelector('.btn-editar').onclick = () => {
                        abrirEditorComProposta({
                            idOriginal: red.id,
                            atividadeId: red.atividadeId,
                            tituloAtividade: red.tituloAtividade,
                            textoOriginal: red.texto,
                            prazo: red.prazo || null,
                            conteudo: red.tituloAtividade,
                            imagemApoio: null
                        });
                    };
                }
                container.appendChild(card);
            });

            if (totalPaginas > 1) {
                const nav = document.createElement('div');
                nav.style.cssText = "display:flex; justify-content:center; align-items:center; gap:20px; margin-top:10px; padding:10px;";
                nav.innerHTML = `
                    <button id="prev-pag" style="background:none; border:none; color:#003058; cursor:pointer; font-size:1.5rem; opacity:${paginaAtualEnviadas === 1 ? '0.2' : '1'}"><i class="fa-solid fa-circle-arrow-left"></i></button>
                    <span style="font-weight:800; color:#003058;">${paginaAtualEnviadas} de ${totalPaginas}</span>
                    <button id="next-pag" style="background:none; border:none; color:#003058; cursor:pointer; font-size:1.5rem; opacity:${paginaAtualEnviadas === totalPaginas ? '0.2' : '1'}"><i class="fa-solid fa-circle-arrow-right"></i></button>
                `;
                container.appendChild(nav);
                nav.querySelector('#prev-pag').onclick = () => { if (paginaAtualEnviadas > 1) { paginaAtualEnviadas--; carregarEnviadas(); } };
                nav.querySelector('#next-pag').onclick = () => { if (paginaAtualEnviadas < totalPaginas) { paginaAtualEnviadas++; carregarEnviadas(); } };
            }
        } catch (e) { container.innerHTML = '<p style="padding:20px;">Erro ao carregar lista.</p>'; }
    }

    setTimeout(carregarPropostasDisponiveis, 300);

    setTimeout(() => {
        const checkDOM = setInterval(() => {
            if (document.getElementById('lista-propostas-recebidas')) {
                carregarPropostasDisponiveis();
                clearInterval(checkDOM);
            }
        }, 100);
    }, 200);

    return `
    <style>
/* ===============================
   BASE (COMUM)
   =============================== */

.container-escrita{width:100%;box-sizing:border-box;font-family:'Inter',sans-serif;padding:15px;margin:0;}
.header-prof h1{text-transform:uppercase;color:#003058;font-weight:900;margin:0;font-size:clamp(1.5rem,6vw,2rem);}

.pill-tab-container{display:flex;gap:30px;margin-bottom:25px;width:100%;border-bottom:1px solid #e2e8f0;}
.pill-tab{padding:12px 5px;border:none;background:none;font-weight:700;font-size:14px;cursor:pointer;transition:.2s;color:#94a3b8;position:relative;}
.pill-active{color:#003058;}
.pill-active::after{content:"";position:absolute;bottom:-1px;left:0;width:100%;height:3px;background:#003058;}
.pill-inactive{color:#94a3b8;}

#tab-escrever,#tab-recebidas,#tab-enviadas{width:100%;max-width:none;margin:0;animation:fadeIn .4s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}

#tema-dinamico{flex:1;font-size:14px;color:#475569;white-space:pre-wrap;overflow-wrap:break-word;line-height:1.5;}
.layout-proposta-flex{display:flex;flex-direction:column;gap:15px;margin-top:10px;}
#container-img-apoio{width:100%;display:none;}
#img-apoio-dinamica{width:100px;height:100px;object-fit:cover;border-radius:10px;border:1px solid #e2e8f0;}

.folha-caderno{background:#fff;border-radius:4px;box-shadow:0 10px 30px rgba(0,0,0,.15);border:1px solid #c1c5cb;width:100%;max-width:800px;margin:0 auto;position:relative;overflow:hidden;height:835px;display:flex;flex-direction:column;}
.linha-pautada{position:relative;flex:1;background:#fff;overflow:hidden;}

.scroll-content{position:relative;width:100%;height:100%;background-image:linear-gradient(#e5e7eb 1px,transparent 1px);background-size:100% 32px;padding-left:55px;box-sizing:border-box;}

.margem-numerica{position:absolute;left:0;top:0;width:45px;height:100%;background:#fff;z-index:2;border-right:1px solid #fca5a5;display:flex;flex-direction:column;}
.margem-numerica div{height:32px;line-height:32px;text-align:center;color:#94a3b8;font-size:11px;}
.margem-vermelha{position:absolute;left:55px;top:0;bottom:0;width:1px;background:#fca5a5;opacity:.5;z-index:1;}

#texto-redacao{width:100%;height:100%;background:transparent;border:none;outline:none;resize:none;font-family:'Kalam',cursive;font-size:19px;color:#2c3e50;padding:0 15px;line-height:32px;box-sizing:border-box;overflow:hidden;white-space:pre-wrap;word-wrap:break-word;}

#texto-redacao::-webkit-scrollbar{height:8px;}
#texto-redacao::-webkit-scrollbar-track{background:#f1f1f1;}
#texto-redacao::-webkit-scrollbar-thumb{background:#003058;border-radius:4px;}

.btn-enviar-final{width:100%;margin:20px auto;display:block;background:#003058;color:#fff;padding:18px;border:none;border-radius:12px;font-weight:800;cursor:pointer;transition:.3s;}
.btn-acao-card{background:#003058;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;transition:.3s;text-transform:uppercase;white-space:nowrap;}

.card-aluno-atv{background:#fff;padding:16px;border-radius:16px;border:1px solid #edf2f7;display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:12px;box-shadow:0 2px 4px rgba(0,0,0,.02);}

/* ===============================
   MOBILE
   =============================== */

@media (max-width:600px){
.container-escrita { padding: 15px 0; overflow-x: hidden; }
.header-prof, .pill-tab-container, #tab-recebidas, #tab-enviadas, .card-topo-proposta { padding: 0 15px; }
.folha-caderno{height:835px; border-radius:0; width: 170vw; max-width: 170vw; margin-left: 0; border-left: none; border-right: none; overflow:hidden;}
.linha-pautada{height:calc(835px - 35px); width:100%;}
.scroll-content{width:100%; height:100%; padding-left:55px;}
#texto-redacao{
    font-size:18px; 
    padding-right:15px; 
    overflow:hidden; 
    width: 100%;
    /* Desativa menus contextuais e lupas de seleção no mobile */
    -webkit-user-select: none; 
    -webkit-touch-callout: none;
    /* Força o estilo de escrita manual sem sugestões visuais */
    text-decoration: none;
}
.margem-numerica{display:block; height:100%; position:absolute;}
.card-aluno-atv{flex-direction:row; align-items:center; flex-wrap: nowrap; gap: 15px;}
.layout-proposta-flex{display:flex; flex-direction:row; align-items:center; gap:15px; margin-top:10px;}
#container-img-apoio{display:block; width:80px; height:80px; flex-shrink:0;}
#img-apoio-dinamica{width:80px; height:80px; object-fit:cover; border-radius:10px; border:1px solid #e2e8f0;}
.btn-acao-card{width:100%; padding:14px;}
.btn-enviar-final { width: calc(100% - 30px); margin: 20px 15px; padding: 25px; font-size: 18px; border-radius: 16px; }
}

/* ===============================
   DESKTOP
   =============================== */

@media (min-width:768px){
.layout-proposta-flex{flex-direction:row;align-items:flex-start;}
#container-img-apoio{flex:0 0 180px;order:2;display:block;}
#tema-dinamico{order:1;}
.btn-enviar-final{max-width:800px;}
.card-topo-proposta{max-width:800px;margin:0 auto 20px auto;}
}
</style>

<div class="container-escrita">

    <!-- ===============================
         CABEÇALHO — MOBILE + DESKTOP
         =============================== -->
    <div class="header-prof">
        <h1>ESCRITA</h1>
        <p style="color:#64748b;">Pratique suas redações</p>
    </div>

    <!-- ===============================
         ABAS DE NAVEGAÇÃO — MOBILE + DESKTOP
         =============================== -->
    <div class="pill-tab-container">
        <button id="btn-tab-recebidas" class="pill-tab pill-active" onclick="window.switchTabEscrita('recebidas')">Recebidas</button>
        <button id="btn-tab-escrever" class="pill-tab pill-inactive" onclick="window.switchTabEscrita('escrever')">Escrever Agora</button>
        <button id="btn-tab-enviadas" class="pill-tab pill-inactive" onclick="window.switchTabEscrita('enviadas')">Enviadas</button>
    </div>

    <!-- ===============================
         ABA RECEBIDAS — MOBILE + DESKTOP
         =============================== -->
    <div id="tab-recebidas">
        <div id="lista-propostas-recebidas"></div>
    </div>

    <!-- ===============================
         ABA ESCREVER
         =============================== -->
    <div id="tab-escrever" style="display:none;">

        <!-- ===============================
             PROPOSTA — MOBILE + DESKTOP
             =============================== -->
        <div class="card-aluno-atv card-topo-proposta" style="display:block; border-left: 6px solid #003058; width: 100%; box-sizing: border-box;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <h2 style="color:#003058; font-size:1.2rem; margin:0;">PROPOSTA:</h2>
                <span style="font-size:11px; font-weight:800; color:#e67e22;">
                    PRAZO: <span id="prazo-dinamico">--/--/--</span>
                </span>
            </div>

            <div class="layout-proposta-flex">
                <!-- IMAGEM — DESKTOP -->
                <div id="container-img-apoio">
                    <img id="img-apoio-dinamica" src="" style="width:100%; border-radius:8px;">
                </div>

                <!-- TEXTO — MOBILE + DESKTOP -->
                <p id="tema-dinamico">Selecione uma atividade para começar...</p>
            </div>
        </div>

        <!-- ===============================
             EDITOR DE TEXTO — MOBILE + DESKTOP
             =============================== -->
        <div class="folha-caderno">

            <!-- TOPO DO EDITOR -->
            <div style="background:#f1f5f9; padding:8px 20px; font-size:11px; font-weight:800; color:#64748b; display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #c1c5cb; position: relative; z-index: 10; height: 35px; box-sizing: border-box;">
                <div>
                    PALAVRAS: <span id="contador-palavras">0</span> | LIMITE: 25 LINHAS
                </div>
                <div id="salvamento-status" style="font-size:10px; color:#003058; font-weight:700; opacity:0; transition:0.3s;">
                    Alterações salvas automaticamente
                </div>
            </div>

            <!-- ÁREA PAUTADA -->
            <div class="linha-pautada">
                <div class="scroll-content">

                    <!-- NUMERAÇÃO DE LINHAS -->
                    <div class="margem-numerica">
                        <div>01</div><div>02</div><div>03</div><div>04</div><div>05</div>
                        <div>06</div><div>07</div><div>08</div><div>09</div><div>10</div>
                        <div>11</div><div>12</div><div>13</div><div>14</div><div>15</div>
                        <div>16</div><div>17</div><div>18</div><div>19</div><div>20</div>
                        <div>21</div><div>22</div><div>23</div><div>24</div><div>25</div>
                    </div>

                    <!-- MARGEM VERMELHA -->
                    <div class="margem-vermelha"></div>

                    <!-- TEXTAREA -->
                    <textarea
                        id="texto-redacao"
                        rows="25"
                        wrap="off"
                        spellcheck="false"
                        autocorrect="off"
                        autocapitalize="none"
                        autocomplete="off"
                        data-gramm="false"
                        data-enable-gramm="false"
                        placeholder="Inicie sua escrita aqui...">
                    </textarea>

                </div>
            </div>
        </div>

        <!-- ===============================
             BOTÃO — MOBILE + DESKTOP
             =============================== -->
        <button class="btn-enviar-final" onclick="window.enviarRedacaoFinal()">
            ENVIAR REDAÇÃO
        </button>
    </div>

    <!-- ===============================
         ABA ENVIADAS — MOBILE + DESKTOP
         =============================== -->
    <div id="tab-enviadas" style="display:none;">
        <div id="lista-redacoes-enviadas"></div>
    </div>

</div>`;
});
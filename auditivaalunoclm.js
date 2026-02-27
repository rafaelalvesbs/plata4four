window.Router.register('auditivaalunoclm', async () => {
    const db = window.db;
    const { 
        collection, getDocs, addDoc, doc, query, where, serverTimestamp, getDoc 
    } = window.fsMethods;
    const auth = window.authMethods.getAuth();

    let atividadeAtual = null;
    let respostasAlun = {};
    let cachePendentes = [];
    let dadosTurmaAluno = null;
    let paginaAtualRecebidas = 1;
    let paginaAtualEnviadas = 1;
    const itensPorPagina = 5;
    
    // Controle de Navegação das Questões
    let indiceQuestaoAtiva = 0;

    // Variáveis do Cronômetro
    let tempoInicio = null;
    let intervaloCronometro = null;

    const buscarDadosContexto = async () => {
        const userRef = auth.currentUser;
        if (!userRef) return;
        try {
            const alunoDoc = await getDoc(doc(db, "usuarios", userRef.uid));
            if (alunoDoc.exists()) {
                const dadosUser = alunoDoc.data();
                const qTurma = query(collection(db, "turmas"), where("senha", "==", dadosUser.turma));
                const snapTurma = await getDocs(qTurma);
                if (!snapTurma.empty) {
                    dadosTurmaAluno = snapTurma.docs[0].data();
                    window.carregarAtividadesAluno();
                }
            }
        } catch (e) { console.error("Erro ao carregar perfil:", e); }
    };

    window.exibirAlertaAud = (titulo, msg, tipo = 'info') => {
        const modal = document.getElementById('modal-alerta-aud');
        const icon = document.getElementById('alerta-aud-icon');
        if(!modal) return;
        document.getElementById('alerta-aud-titulo').innerText = titulo;
        document.getElementById('alerta-aud-msg').innerText = msg;
        icon.innerHTML = tipo === 'sucesso' ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
        icon.style.color = '#003058';
        modal.style.display = 'flex';
    };

    window.fecharAlertaAud = () => {
        const modal = document.getElementById('modal-alerta-aud');
        if(modal) modal.style.display = 'none';
    };

    window.formatarTempoExterno = (segundosTotal) => {
        const mins = Math.floor(segundosTotal / 60);
        const segs = segundosTotal % 60;
        return `${mins.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
    };

    window.switchTabAlunoAud = (tab) => {
        document.querySelectorAll('.tab-btn-aluno').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`btn-tab-${tab}`);
        if(btn) btn.classList.add('active');
        
        paginaAtualRecebidas = 1;
        paginaAtualEnviadas = 1;

        if(tab === 'recebidas') {
            document.getElementById('view-lista-recebidas').style.display = 'block';
            document.getElementById('view-lista-enviadas').style.display = 'none';
            window.carregarAtividadesAluno();
        } else {
            document.getElementById('view-lista-recebidas').style.display = 'none';
            document.getElementById('view-lista-enviadas').style.display = 'block';
            window.carregarMinhasRespostas();
        }
    };

    window.carregarAtividadesAluno = async () => {
        const container = document.getElementById('lista-recebidas-aud');
        container.innerHTML = '<div class="loader-aud"><div class="spinner-aud"></div></div>';
        try {
            const idAluno = auth.currentUser?.uid;

            // 1. Busca todas as atividades auditivas
            const qAtividades = query(collection(db, "atividades_enviadas"), where("tipo", "==", "auditiva"));
            const snapAtividades = await getDocs(qAtividades);
            const todasAtividades = snapAtividades.docs.map(d => ({ id: d.id, ...d.data() }));

            // 2. Busca o que o aluno já respondeu
            const qRespondidas = query(collection(db, "respostas_alunos"), where("alunoId", "==", idAluno), where("tipo", "==", "auditiva"));
            const snapRespondidas = await getDocs(qRespondidas);
            const idsRespondidos = snapRespondidas.docs.map(d => String(d.data().atividadeId).trim());

            // 3. Filtra e Ordena: Mesmo semestre, não respondida e mais recentes primeiro
            cachePendentes = todasAtividades
                .filter(atv => {
                    const semAtv = String(atv.semestre).trim();
                    const semAlu = String(dadosTurmaAluno?.semestre || "").trim();
                    const jaRespondeu = idsRespondidos.includes(String(atv.id).trim());
                    return semAtv === semAlu && !jaRespondeu;
                })
                .sort((a, b) => {
                    // Ordena por prazo (mais recente/próximo primeiro) ou por data de criação se disponível
                    const dataA = a.prazo ? new Date(a.prazo) : new Date(0);
                    const dataB = b.prazo ? new Date(b.prazo) : new Date(0);
                    return dataB - dataA;
                });

            const totalPaginas = Math.ceil(cachePendentes.length / itensPorPagina);
            const inicio = (paginaAtualRecebidas - 1) * itensPorPagina;
            const fim = inicio + itensPorPagina;
            const itensPagina = cachePendentes.slice(inicio, fim);

            if (cachePendentes.length === 0) {
                container.innerHTML = '<p class="status-msg">Nenhuma atividade pendente para seu semestre.</p>';
                return;
            }

            let html = itensPagina.map(atv => {
                const expirada = atv.prazo && (new Date() > new Date(atv.prazo + 'T23:59:59'));
                return `
                <div class="card-atv-aluno ${expirada ? 'atv-expirada' : ''}" onclick="window.confirmarInicioAtividadeAud('${atv.id}')">
                    <div style="flex:1; display: flex; align-items: center; gap: 15px; min-height: 56px;">
                        <span class="tag-semestre" style="${expirada ? 'background:#94a3b8;' : ''}">
                            ${atv.prazo ? atv.prazo.split('-').reverse().join('/') : 'Sem prazo'}
                        </span>
                        <h3 class="atv-title" style="${expirada ? 'color:#94a3b8;' : ''}">${atv.titulo}</h3>
                    </div>
                    <i class="fa-solid ${expirada ? 'fa-circle-xmark' : 'fa-circle-play'} play-icon-aud" style="${expirada ? 'color:#94a3b8;' : ''}"></i>
                </div>`;
            }).join('');

            html += window.renderPaginacao(totalPaginas, paginaAtualRecebidas, 'Recebidas');
            container.innerHTML = html;
        } catch(e) { console.error(e); }
    };

    window.carregarMinhasRespostas = async () => {
        const container = document.getElementById('lista-enviadas-aluno');
        container.innerHTML = '<div class="loader-aud"><div class="spinner-aud"></div></div>';
        try {
            const idAluno = auth.currentUser?.uid;
            const q = query(collection(db, "respostas_alunos"), where("alunoId", "==", idAluno), where("tipo", "==", "auditiva"));
            const snap = await getDocs(q);
            const dados = snap.docs.map(d => d.data());

            const totalPaginas = Math.ceil(dados.length / itensPorPagina);
            const inicio = (paginaAtualEnviadas - 1) * itensPorPagina;
            const fim = inicio + itensPorPagina;
            const itensPagina = dados.slice(inicio, fim);

            if (dados.length === 0) {
                container.innerHTML = '<p class="status-msg">Nenhuma atividade enviada ainda.</p>';
                return;
            }

            let html = itensPagina.map(r => `
                <div class="card-atv-aluno enviada-aud">
                    <div style="flex:1; display: flex; align-items: center; min-height: 56px;">
                        <h3 class="atv-title">${r.titulo}</h3>
                    </div>
                   <div class="status-nota-wrap">
                        <div class="tempo-tag-card" style="margin-right: 5px;">
                            <i class="fa-regular fa-clock"></i> ${r.tempoGasto || '00:00'}
                        </div>
                        <span class="nota-tag">NOTA: ${r.nota}</span>
                        <i class="fa-solid fa-circle-check check-icon-aud"></i>
                    </div>
                </div>`).join('');

            html += window.renderPaginacao(totalPaginas, paginaAtualEnviadas, 'Enviadas');
            container.innerHTML = html;
        } catch(e) { console.error(e); }
    };

    window.confirmarInicioAtividadeAud = (id) => {
        atividadeAtual = cachePendentes.find(a => a.id === id);
        if (!atividadeAtual) return;

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataPrazo = new Date(atividadeAtual.prazo + 'T23:59:59');

        if (hoje > dataPrazo) {
            window.exibirAlertaAud("Prazo Encerrado", "Esta atividade expirou.");
            return;
        }

        document.getElementById('modal-aviso-cronometro').style.display = 'flex';
    };

    window.começarDeVezAud = async () => {
        const modalAviso = document.getElementById('modal-aviso-cronometro');
        const modalContent = modalAviso.querySelector('.modal-content-aud');
        const conteudoOriginal = modalContent.innerHTML;

        modalContent.innerHTML = `
            <div class="loader-aud">
                <div class="spinner-aud"></div>
            </div>
            <p id="status-load-aud" style="color:#003058; font-weight:700; margin-top:10px;">Carregando áudios...</p>
        `;

        try {
            respostasAlun = {};
            indiceQuestaoAtiva = 0;

            const audiosParaCarregar = atividadeAtual.questoes
                .filter(q => q.audioQuestao)
                .map(q => q.audioQuestao);

            if (audiosParaCarregar.length > 0) {
                let carregados = 0;
                const total = audiosParaCarregar.length;
                const statusTxt = document.getElementById('status-load-aud');

                const promessas = audiosParaCarregar.map(url => {
                    return new Promise((resolve, reject) => {
                        const a = new Audio();
                        a.src = url;
                        a.preload = "auto";
                        
                        a.oncanplaythrough = () => {
                            carregados++;
                            if(statusTxt) statusTxt.innerText = `Carregando áudios (${carregados}/${total})`;
                            resolve();
                        };
                        
                        a.onerror = () => {
                            console.warn("Falha ao carregar um dos áudios:", url);
                            resolve(); // Resolve para não travar a atividade, mas loga o erro
                        };

                        // Timeout de segurança para não travar o aluno se a rede oscilar
                        setTimeout(resolve, 10000);
                    });
                });

                await Promise.all(promessas);
            }

            modalAviso.style.display = 'none';
            modalContent.innerHTML = conteudoOriginal;

            tempoInicio = Date.now();
            document.getElementById('atv-titulo-exec').innerText = atividadeAtual.titulo;

            if (intervaloCronometro) clearInterval(intervaloCronometro);
            const display = document.getElementById('tempo-cronometro');
            intervaloCronometro = setInterval(() => {
                const decorrido = Math.floor((Date.now() - tempoInicio) / 1000);
                if(display) display.innerText = window.formatarTempoExterno(decorrido);
            }, 1000);

            window.renderizarQuestaoAtualAud();
            document.getElementById('tela-listagem').style.display = 'none';
            document.getElementById('tela-execucao').style.display = 'block';
            window.scrollTo(0,0);

        } catch (error) {
            console.error("Erro no pre-load:", error);
            modalAviso.style.display = 'none';
            modalContent.innerHTML = conteudoOriginal;
            window.exibirAlertaAud("Erro", "Falha ao preparar mídia. Verifique sua internet.");
        }
    };

    window.renderizarQuestaoAtualAud = () => {
        const q = atividadeAtual.questoes[indiceQuestaoAtiva];
        
        const player = document.getElementById('player-aluno');
        const headerAudio = document.querySelector('.header-fixo-aud');

        if (q && q.audioQuestao) {
            headerAudio.style.display = 'block';
            // AJUSTE DE SEGURANÇA: Definir o src direto no player.src
            // Isso garante que o link do Storage carregue em qualquer celular.
            player.src = q.audioQuestao; 
            player.load();
        } else {
            if(headerAudio) headerAudio.style.display = 'none';
            player.pause();
            player.src = ""; // Limpa para não sobrar resquício da questão anterior
        }

        // Renderizar Nav Pills (Bolinhas de navegação)
        const nav = document.getElementById('nav-questoes-aud');
        if(nav) {
            nav.innerHTML = atividadeAtual.questoes.map((_, i) => `
                <button class="g-btn-pill ${i === indiceQuestaoAtiva ? 'active' : ''} ${respostasAlun[i] ? 'respondida' : ''}" 
                        onclick="window.irParaQuestaoAud(${i})">${i + 1}</button>
            `).join('');
        }

        // Renderizar Conteúdo
        const container = document.getElementById('questoes-render');
        container.innerHTML = `
            <div class="box-enunciado-render">
                <div class="texto-enunciado-render"><strong>Questão ${indiceQuestaoAtiva + 1}:</strong> ${q.enunciado}</div>
            </div>
            <div class="container-questao-corpo ${q.imagem ? 'layout-com-foto' : ''}">
                <div class="col-opcoes-questao">
                    <div class="opcoes-lista">
                        ${['A','B','C'].map(L => q.opcoes[L] ? `
                            <div class="opcao-card ${respostasAlun[indiceQuestaoAtiva] === L ? 'selected' : ''}" onclick="window.setRespAud('${L}')">
                                <div class="letra-indicador">${L}</div>
                                <div>${q.opcoes[L]}</div>
                            </div>
                        ` : '').join('')}
                    </div>
                </div>
                ${q.imagem ? `<div class="col-foto-questao"><img src="${q.imagem}" class="img-questao-render"></div>` : ''}
            </div>
        `;

        const totalQuestoes = atividadeAtual.questoes.length;
        document.getElementById('btn-prev-aud').disabled = (indiceQuestaoAtiva === 0);
        
        const containerSetas = document.querySelector('.container-navegacao-setas');
        if (containerSetas) {
            containerSetas.style.display = totalQuestoes > 1 ? 'flex' : 'none';
        }

        const isUltima = (indiceQuestaoAtiva === totalQuestoes - 1);
        document.getElementById('btn-next-aud').style.display = isUltima ? 'none' : 'flex';
        document.getElementById('area-botao-finalizar').style.display = isUltima ? 'block' : 'none';
    };

    window.irParaQuestaoAud = (i) => {
        indiceQuestaoAtiva = i;
        window.renderizarQuestaoAtualAud();
    };

    window.navegarAud = (dir) => {
        indiceQuestaoAtiva += dir;
        window.renderizarQuestaoAtualAud();
    };

    window.setRespAud = (letra) => {
        respostasAlun[indiceQuestaoAtiva] = letra;
        window.renderizarQuestaoAtualAud();
    };

    window.finalizarEResponder = async () => {
        if (!atividadeAtual) return;
        const numQuestoes = atividadeAtual.questoes.length;
        if(Object.keys(respostasAlun).length < numQuestoes) {
            window.exibirAlertaAud("Atenção", "Por favor, responda todas as perguntas antes de enviar.");
            return;
        }

        // Para o áudio imediatamente ao enviar
        const player = document.getElementById('player-aluno');
        if (player) {
            player.pause();
            player.currentTime = 0;
        }

        try {
            if (intervaloCronometro) clearInterval(intervaloCronometro);
            const tempoGastoSegundos = Math.floor((Date.now() - tempoInicio) / 1000);
            const tempoFinalFormatado = window.formatarTempoExterno(tempoGastoSegundos);

            let acertos = 0;
            atividadeAtual.questoes.forEach((q, i) => {
                if(respostasAlun[i] === q.correta) acertos++;
            });
            const notaFinal = ((acertos / numQuestoes) * 10).toFixed(1);

            const dados = {
                atividadeId: String(atividadeAtual.id).trim(),
                alunoId: String(auth.currentUser.uid).trim(),
                titulo: String(atividadeAtual.titulo).trim(),
                tipo: "auditiva", 
                nota: notaFinal,
                tempoGasto: tempoFinalFormatado,
                semestre: String(dadosTurmaAluno?.semestre || "").trim(),
                turma: String(dadosTurmaAluno?.senha || "").trim(), // Campo crucial para o professor
                respostas: respostasAlun,
                dataEntrega: serverTimestamp()
            };

            await addDoc(collection(db, "respostas_alunos"), dados);
            const mensagemSucesso = `
                Parabéns! Você concluiu a atividade.
                
                ⏱️ Tempo: ${tempoFinalFormatado}
                🎯 Nota: ${notaFinal}
            `;
            window.exibirAlertaAud("Atividade Finalizada!", mensagemSucesso, "sucesso");
            
            atividadeAtual = null;
            respostasAlun = {};
            document.getElementById('tela-execucao').style.display = 'none';
            document.getElementById('tela-listagem').style.display = 'block';
            await window.carregarAtividadesAluno();
            window.switchTabAlunoAud('enviadas');
        } catch (e) {
            console.error("Erro ao salvar:", e);
            window.exibirAlertaAud("Erro", "Falha na conexão. Tente novamente.");
        }
    };

    window.renderPaginacao = (total, atual, tipo) => {
        if (total <= 1) return '';
        let botoes = '';
        for (let i = 1; i <= total; i++) {
            botoes += `<button class="page-btn ${i === atual ? 'active' : ''}" onclick="window.mudarPagina${tipo}(${i})">${i}</button>`;
        }
        return `<div class="paginacao-wrap">${botoes}</div>`;
    };

    window.mudarPaginaRecebidas = (p) => { paginaAtualRecebidas = p; window.carregarAtividadesAluno(); };
    window.mudarPaginaEnviadas = (p) => { paginaAtualEnviadas = p; window.carregarMinhasRespostas(); };

    setTimeout(buscarDadosContexto, 300);

    return `
    <style>
    /* ============================================================
       ESTILO UNIFICADO AUDITIVA (BASEADO NA GRAMÁTICA)
       ============================================================ */
    
    .aud-aluno-wrap { padding: 12px; font-family: 'Inter', sans-serif; background: transparent; }

    /* --- LISTAGEM DE ATIVIDADES --- */
    .card-atv-aluno { 
        background: #fff; 
        padding: 15px; 
        border-radius: 12px; 
        margin-bottom: 10px; 
        display: flex; 
        align-items: center; 
        border-left: 5px solid #003058; 
        box-shadow: 0 2px 5px rgba(0,0,0,0.05); 
        cursor: pointer; 
        transition: 0.2s;
        width: 100%;
        box-sizing: border-box;
    }
    .card-atv-aluno:hover { transform: translateY(-2px); }
    .card-atv-aluno.atv-expirada { opacity: 0.6; cursor: not-allowed !important; border-left-color: #cbd5e1; }
    .card-atv-aluno.enviada-aud { cursor: default; }

    .atv-title { margin: 0; font-size: 14px; color: #003058; font-weight: 700; flex: 1; }
    .tag-semestre { font-size: 11px; background: #003058; color: #ffffff; padding: 5px 10px; border-radius: 6px; font-weight: 700; white-space: nowrap; margin-right: 15px; }
    .atv-expirada .tag-semestre { background: #94a3b8 !important; }

    /* --- TABS --- */
    .tabs-header { display: flex; gap: 20px; border-bottom: 1px solid #e2e8f0; margin-bottom: 25px; width: 100%; }
    .tab-btn-aluno { padding: 10px 15px; border: none; background: none; font-weight: 700; color: #94a3b8; cursor: pointer; position: relative; transition: 0.2s; }
    .tab-btn-aluno.active { color: #003058; }
    .tab-btn-aluno.active::after { content: ""; position: absolute; bottom: -1px; left: 0; width: 100%; height: 3px; background: #003058; }

    /* --- HEADER DA EXECUÇÃO (CRONÔMETRO E PLAYER) --- */
    .header-fixo-aud { background: #fff; padding: 20px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 20px; border: 1px solid #f1f5f9; }
    .header-resolver-top { display: flex; align-items: center; background: #003058; padding: 10px 15px; border-radius: 12px; margin-bottom: 12px; color: #fff; gap: 15px; }
    .header-resolver-titulo { font-size: 14px; font-weight: 700; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cronometro-box { font-size: 12px; background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 8px; font-weight: 700; }
    
    #player-aluno { width: 100%; height: 40px; border-radius: 8px; background: #f1f5f9; }

    /* --- NAVEGAÇÃO POR QUESTÕES (PILLS) --- */
    .nav-questoes-container { display: flex; gap: 6px; margin-bottom: 12px; overflow-x: auto; padding-bottom: 5px; align-items: center; }
    .g-btn-pill { min-width: 34px; height: 34px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; font-weight: 700; cursor: pointer; transition: 0.2s; }
    .g-btn-pill.active { background: #003058; color: #fff; border-color: #003058; }
    .g-btn-pill.respondida:not(.active) { background: #e2e8f0; color: #003058; }

    /* --- RENDERIZAÇÃO DA QUESTÃO --- */
    .box-enunciado-render { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px; margin-bottom: 12px; }
    .texto-enunciado-render { color: #1e293b; font-weight: 600; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
    
    .container-questao-corpo { display: flex; gap: 12px; }
    .col-opcoes-questao { flex: 1.2; width: 100%; }
    .col-foto-questao { flex: 0.8; }
    .img-questao-render { width: 100%; max-height: 220px; border-radius: 8px; object-fit: contain; border: 1px solid #e2e8f0; background: #fff; }
    
    .opcoes-lista { display: flex; flex-direction: column; gap: 8px; }
    .opcao-card { display: flex; align-items: center; padding: 12px; background: #fff; border: 2px solid #f1f5f9; border-radius: 10px; cursor: pointer; font-size: 13px; transition: 0.2s; }
    .opcao-card:hover { border-color: #cbd5e1; background: #f8fafc; }
    .opcao-card.selected { border-color: #003058; background: #f0f7ff; }
    
    .letra-indicador { font-weight: 900; background: #f1f5f9; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 11px; color: #003058; border: 1px solid #e2e8f0; flex-shrink: 0; }
    .selected .letra-indicador { background: #003058; color: #fff; border-color: #003058; }

    /* --- BOTÕES DE AÇÃO (INICIAR/FINALIZAR/MODAL) --- */
    .btn-finalizar-atv-aud { 
        width: 100%; 
        background: #003058; 
        color: #fff; 
        border: none; 
        height: 48px; 
        border-radius: 12px; 
        font-weight: 800; 
        font-size: 15px; 
        cursor: pointer; 
        transition: 0.3s; 
        box-shadow: 0 4px 12px rgba(0,48,88,0.2); 
        display: flex; 
        align-items: center; 
        justify-content: center;
        gap: 10px;
    }
    .btn-finalizar-atv-aud:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(0,48,88,0.3); background: #004075; }

    .btn-modal-aud { width: 100%; padding: 14px; background: #003058; color: #fff; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; margin-top: 20px; }

    /* --- NAVEGAÇÃO SETAS --- */
    .container-navegacao-setas { display: flex; justify-content: center; align-items: center; gap: 40px; margin-top: 15px; }
    .btn-seta-nav { background: #fff; border: 1px solid #e2e8f0; width: 45px; height: 45px; border-radius: 50%; color: #003058; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: 0.2s; }
    .btn-seta-nav:disabled { opacity: 0.3; cursor: not-allowed; }
    .btn-seta-nav:hover:not(:disabled) { background: #f1f5f9; }

   @media (min-width: 769px) {
        .col-opcoes-questao {
            margin-bottom: 16px;
        }
        .container-navegacao-setas {
            margin-bottom: 16px;
        }
        .area-botao-finalizar {
            margin-top: 0;
        }
    }

    /* --- STATUS E NOTAS (LISTA ENVIADAS) --- */
    .status-nota-wrap { 
        display: flex; 
        align-items: center; 
        gap: 12px; 
        margin-left: auto;
    }
    .nota-tag { background: #003058; color: #fff; font-size: 10px; padding: 4px 10px; border-radius: 6px; font-weight: 800; }
    .tempo-tag-card { font-size: 10px; color: #64748b; font-weight: 700; display: flex; align-items: center; gap: 4px; }
    .play-icon-aud { color: #003058; font-size: 24px; }
    .check-icon-aud { color: #003058; font-size: 20px; }

    /* --- MODAIS --- */
    .modal-aud { position: fixed; inset: 0; background: rgba(0,48,88,0.4); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
    .modal-content-aud { background: #fff; padding: 30px; border-radius: 24px; text-align: center; width: 100%; max-width: 380px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }

    /* --- PAGINAÇÃO --- */
    .paginacao-wrap { display: flex; justify-content: center; gap: 8px; margin-top: 20px; padding-bottom: 20px; }
    .page-btn { padding: 8px 14px; border: 1px solid #e2e8f0; background: #fff; border-radius: 8px; cursor: pointer; font-weight: 700; color: #003058; transition: 0.2s; }
    .page-btn.active { background: #003058; color: #fff; border-color: #003058; }

    /* --- LOADERS --- */
    .loader-aud { display: flex; justify-content: center; padding: 50px; }
    .spinner-aud { width: 40px; height: 40px; border: 4px solid #f1f5f9; border-top: 4px solid #003058; border-radius: 50%; animation: spinAud 1s linear infinite; }
    @keyframes spinAud { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    /* --- MOBILE --- */
    @media (max-width: 768px) {
        .container-questao-corpo.layout-com-foto { flex-direction: column-reverse; }
        .col-foto-questao { width: 100%; }
        .img-questao-render { max-height: 180px; }
        
        /* Gap entre as setas e o botão enviar no mobile */
        .container-navegacao-setas {
            margin-bottom: 16px;
        }
    }
.header-fixo-aud { transition: all 0.3s ease; }
    .btn-voltar-topo { background: none; border: none; color: #fff; cursor: pointer; font-size: 18px; }
    
</style>

    <div class="aud-aluno-wrap">
    <div id="modal-aviso-cronometro" class="modal-aud" style="display:none;">
        <div class="modal-content-aud">
            <div style="font-size:35px; color:#003058; margin-bottom:15px;"><i class="fa-solid fa-stopwatch"></i></div>
            <h2 style="color:#003058; font-size:20px; margin-bottom:10px; font-weight:800;">Tudo pronto?</h2>
            <p style="color:#64748b; font-size:14px; margin-bottom:25px; line-height:1.5;">Ao iniciar, seu tempo de resolução será contabilizado para o professor.</p>
            <button class="btn-finalizar-atv-aud" onclick="window.começarDeVezAud()">INICIAR ATIVIDADE</button>
            <button onclick="document.getElementById('modal-aviso-cronometro').style.display='none'" style="background:none; border:none; color:#94a3b8; margin-top:15px; font-weight:600; cursor:pointer;">Agora não</button>
        </div>
    </div>

    <div id="modal-alerta-aud" class="modal-aud" style="display:none;">
        <div class="modal-content-aud">
            <div id="alerta-aud-icon" style="font-size:40px; margin-bottom:15px;"></div>
            <h2 id="alerta-aud-titulo" style="color:#003058; font-size:20px; font-weight:800;"></h2>
            <p id="alerta-aud-msg" style="color:#64748b; font-size:14px; margin-top:10px;"></p>
            <button class="btn-modal-aud" onclick="window.fecharAlertaAud()">OK</button>
        </div>
    </div>

    <div id="tela-listagem">
        <h1 style="color:#003058; font-size:24px; font-weight:900; margin-bottom: 2px;">AUDITIVAS</h1>
        <p style="color:#94a3b8; font-size:14px; margin-bottom: 20px;">Pratique sua compreensão auditiva e conversação</p>
        
        <div class="tabs-header">
            <button id="btn-tab-recebidas" class="tab-btn-aluno active" onclick="window.switchTabAlunoAud('recebidas')">Recebidas</button>
            <button id="btn-tab-enviadas" class="tab-btn-aluno" onclick="window.switchTabAlunoAud('enviadas')">Enviadas</button>
        </div>

        <div id="view-lista-recebidas">
            <div id="lista-recebidas-aud"></div>
        </div>

        <div id="view-lista-enviadas" style="display:none;">
            <div id="lista-enviadas-aluno"></div>
        </div>
    </div>

    <div id="tela-execucao" style="display:none;">
        <div class="header-resolver-top">
            <button class="btn-voltar-topo" onclick="location.reload()"><i class="fa-solid fa-arrow-left"></i></button>
            <div id="atv-titulo-exec" class="header-resolver-titulo"></div>
            <div class="cronometro-box"><i class="fa-regular fa-clock"></i> <span id="tempo-cronometro">00:00</span></div>
        </div>

        <div class="header-fixo-aud">
            <p style="margin:0 0 10px 0; font-size:11px; color:#64748b; font-weight:700; text-transform:uppercase;">Áudio da Atividade</p>
            <audio id="player-aluno" controls style="width:100%;">
                <source id="player-aluno-src" src="">
            </audio>
        </div>

        <div id="nav-questoes-aud" class="nav-questoes-container"></div>
        
        <div id="questoes-render"></div>

        <div class="container-navegacao-setas">
            <button id="btn-prev-aud" class="btn-seta-nav" onclick="window.navegarAud(-1)"><i class="fa-solid fa-chevron-left"></i></button>
            <button id="btn-next-aud" class="btn-seta-nav" onclick="window.navegarAud(1)"><i class="fa-solid fa-chevron-right"></i></button>
        </div>

        <div id="area-botao-finalizar" style="display:none;">
            <button onclick="window.finalizarEResponder()" class="btn-finalizar-atv-aud">
                FINALIZAR E ENVIAR RESPOSTAS
            </button>
        </div>
    </div>
</div>
    `;
});
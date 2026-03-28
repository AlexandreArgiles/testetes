// ========================================================
// MÓDULO DE ALERTAS CUSTOMIZADOS (CONTRA BUG DE FOCO WINDOWS)
// ========================================================
function showAlert(msg) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
        const box = document.createElement('div');
        box.style.cssText = 'background:white;padding:25px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.2);max-width:350px;width:90%;text-align:center;font-family:sans-serif;';
        box.innerHTML = `<h3 style="margin-top:0;color:#ef4444;font-size:1.2rem;">Aviso</h3><p style="margin-bottom:20px;color:#4b5563;font-size:1rem;">${msg}</p><button id="btn-ok" style="background:#2563eb;color:white;border:none;padding:12px 24px;border-radius:8px;font-weight:bold;cursor:pointer;width:100%;">OK</button>`;
        overlay.appendChild(box); document.body.appendChild(overlay);
        document.getElementById('btn-ok').onclick = () => { document.body.removeChild(overlay); resolve(); };
    });
}
function showConfirm(msg) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
        const box = document.createElement('div');
        box.style.cssText = 'background:white;padding:25px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.2);max-width:350px;width:90%;text-align:center;font-family:sans-serif;';
        box.innerHTML = `<h3 style="margin-top:0;color:#f59e0b;font-size:1.2rem;">Confirmação</h3><p style="margin-bottom:20px;color:#4b5563;font-size:1rem;">${msg}</p><div style="display:flex;gap:10px;"><button id="btn-no" style="background:#e5e7eb;color:#374151;border:none;padding:12px;border-radius:8px;font-weight:bold;cursor:pointer;flex:1;">Cancelar</button><button id="btn-yes" style="background:#10b981;color:white;border:none;padding:12px;border-radius:8px;font-weight:bold;cursor:pointer;flex:1;">Confirmar</button></div>`;
        overlay.appendChild(box); document.body.appendChild(overlay);
        document.getElementById('btn-yes').onclick = () => { document.body.removeChild(overlay); resolve(true); };
        document.getElementById('btn-no').onclick = () => { document.body.removeChild(overlay); resolve(false); };
    });
}
window.alert = showAlert; 

const API = '/api';
const fmt = (v) => (Number(v) || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
let userRole = '';

(async function checkLogin() {
    try {
        const res = await fetch(`${API}/check-session`);
        const data = await res.json();
        if (!data.logged) window.location.href = 'login.html';
        else {
            userRole = data.user.perfil;
            document.getElementById('user-display').innerText = `Usuário: ${data.user.login} (${userRole.toUpperCase()})`;
            applyRole(); loadDash();
        }
    } catch(e) { window.location.href = 'login.html'; }
})();

function applyRole() {
    const adminElements = document.querySelectorAll('.admin-only');
    if (userRole === 'admin') adminElements.forEach(el => el.style.display = 'block');
    else adminElements.forEach(el => el.style.display = 'none');
}

async function logout() { await fetch(`${API}/logout`, {method:'POST'}); window.location.href='login.html'; }

function navTo(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    const targetSection = document.getElementById(id);
    if(targetSection) targetSection.classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(event && event.target) event.target.classList.add('active');
    
    if(id==='dashboard') loadDash(); if(id==='clientes') loadCli(); if(id==='nova-lavagem') prepLav(); 
    if(id==='financeiro') loadExt(); if(id==='patio') loadPatio(); if(id==='agenda') loadAgenda();
    if(userRole === 'admin') {
        if(id==='despesas') loadDesp(); if(id==='servicos') loadServ(); 
        if(id==='funcionarios') loadFunc(); if(id==='usuarios') loadUsuarios(); if(id==='rh') loadRH(); 
    }
}

// ================== PÁTIO E LAVAGEM ==================
async function loadPatio(){
    const r1=await fetch(`${API}/patio/andamento`); const a=await r1.json();
    const d=document.getElementById('lista-andamento'); d.innerHTML='';
    if(!a.length) d.innerHTML='<p style="color:#888">Vazio</p>';
   a.forEach(t=>{
        const obsHtml = t.obs ? `<p style="font-size:0.8rem; color:#d97706; background:#fef3c7; padding:4px; border-radius:4px; margin-top:5px;">⚠️ ${t.obs}</p>` : '';
        const escObs = t.obs ? String(t.obs).replace(/'/g, "\\'") : ''; 
        const servicoExtraHtml = t.servico_extra ? `<p>➕ ${t.servico_extra} (R$ ${t.valor_extra || 0})</p>` : '';
        const valorTotal = Number(t.valor_cobrado) + Number(t.valor_extra || 0);
        
        d.innerHTML+=`<div class="patio-card">
            <div class="patio-header">
                <span class="patio-placa">${t.placa_registrada}</span>
                <small>${new Date(t.data_hora).toLocaleTimeString().slice(0,5)}</small>
            </div>
            <div class="patio-body">
                <p><strong>${t.modelo||'S/ Modelo'}</strong></p>
                <p>👤 ${t.cliente}</p>
                <p>🛠️ ${t.servico} (R$ ${t.valor_cobrado})</p>
                ${servicoExtraHtml}
                <p style="font-weight:bold; font-size:1.1rem;">💰 Total: ${fmt(valorTotal)}</p>
                ${obsHtml}
            </div>
            <div style="display:flex; gap:10px; margin-top:15px; flex-wrap: wrap;">
                <button class="btn-secondary" style="flex:1; min-width:80px; border:none; border-radius:8px; font-weight:bold; background:#e5e7eb; color:#374151; padding: 10px 0;" onclick="abrirEditPatio(${t.id}, ${t.servico_id}, ${t.valor_cobrado}, '${escObs}', '${t.servico_extra || ''}', ${t.valor_extra || 0})">✏️ Editar</button>
                <button class="btn-primary" style="flex:2; min-width:120px; padding: 10px 0;" onclick="concluirLavagem(${t.id},'${t.cliente}','${t.telefone}','${t.placa_registrada}',${valorTotal})">✅ Concluir</button>
                <button style="flex:1; min-width:100px; border:none; border-radius:8px; font-weight:bold; background:#fee2e2; color:#ef4444; padding: 10px 0; cursor:pointer;" onclick="cancelarPatio(${t.id}, '${t.placa_registrada}')">🗑️ Cancelar</button>
            </div>
        </div>`;
    });
    const r2=await fetch(`${API}/patio/concluidos-hoje`); const c=await r2.json();
    const tb=document.querySelector('#tabela-patio-concluidos tbody'); tb.innerHTML='';
    c.forEach(t=>tb.innerHTML+=`<tr><td>${new Date(t.data_conclusao).toLocaleTimeString().slice(0,5)}</td><td>${t.placa_registrada} (${t.modelo||''})</td><td>${t.cliente}</td><td>${t.servico}</td><td><span style="color:var(--success)">Concluído</span></td></tr>`);
}
async function concluirLavagem(id, n, t, p, v) {
    if (!await showConfirm(`Concluir veículo ${p}?`)) return;
    const r = await fetch(`${API}/concluir-servico/${id}`, {method: 'PUT'});
    if (r.ok) {
        if (await showConfirm('Avisar cliente pelo WhatsApp?')) {
            const mensagem = `Olá ${n}! \n\nBoas notícias: o seu veículo (${p}) acabou de receber aquele talento e já está a brilhar aqui na *SpumaCar*! \n\nO valor do serviço ficou em *R$ ${fmt(v)}*.\n\nJá pode vir buscar o seu veículo! Qualquer dúvida, estamos à disposição. Um abraço da equipa SpumaCar! `;
            enviarZap(t, mensagem);
        }
        loadPatio();
    } else {
        showAlert('Erro ao concluir');
    }
}
function enviarZap(tel, msg) { if(!tel) { showAlert('Cliente sem telefone'); return; } let num = tel.replace(/\D/g, ''); if(num.length === 10 || num.length === 11) num = '55' + num; window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank'); }

let sCache=[], cCache=[];
// ================== PREPARAÇÃO DA TELA DE NOVO SERVIÇO ==================
async function prepLav() {
    try {
        const [sR, fR] = await Promise.all([fetch(`${API}/servicos`), fetch(`${API}/funcionarios`)]);
        sCache = await sR.json();
        const f = await fR.json();
        
        const selectServico = document.getElementById('reg-servico');
        if (selectServico) {
            selectServico.innerHTML = '<option value="">Selecione um serviço...</option>';
            sCache.forEach(s => { selectServico.innerHTML += `<option value="${s.id}">${s.nome} (R$ ${s.preco})</option>`; });
        }
        
        const selectFunc = document.getElementById('reg-func');
        if (selectFunc) {
            selectFunc.innerHTML = '<option value="">Selecione um funcionário...</option>';
            f.forEach(x => { selectFunc.innerHTML += `<option value="${x.id}">${x.nome}</option>`; });
        }
        
        const dlServicos = document.getElementById('lista-servicos');
        if (dlServicos) {
            dlServicos.innerHTML = '';
            sCache.forEach(s => dlServicos.innerHTML += `<option value="${s.nome}">`);
        }
    } catch (erro) { console.error("Erro ao carregar listas:", erro); }
    resetLav();
}

function resetLav(){
    ['reg-placa','reg-cliente','reg-tel','reg-modelo','reg-valor','reg-obs', 'reg-servico-extra', 'reg-valor-extra'].forEach(id=> { if(document.getElementById(id)) document.getElementById(id).value=''; });
    if(document.getElementById('reg-placa')) document.getElementById('reg-placa').classList.remove('hidden');
    if(document.getElementById('reg-placa-select')) document.getElementById('reg-placa-select').classList.add('hidden');
    if(document.getElementById('reg-modelo')) document.getElementById('reg-modelo').disabled=false;
    if(document.getElementById('reg-cliente')) document.getElementById('reg-cliente').disabled=false;
}
function atualizarPreco(){const i=sCache.find(x=>x.id==document.getElementById('reg-servico').value);if(i)document.getElementById('reg-valor').value=i.preco}
async function buscarPlaca(){const p=document.getElementById('reg-placa').value.toUpperCase();if(p.length<5)return;const r=await fetch(`${API}/buscar-placa/${p}`);const d=await r.json();if(d){document.getElementById('reg-modelo').value=d.modelo||'';document.getElementById('reg-cliente').value=d.nome;document.getElementById('reg-tel').value=d.telefone||'';document.getElementById('reg-cliente').disabled=true;document.getElementById('reg-modelo').disabled=true}else{document.getElementById('reg-cliente').disabled=false;document.getElementById('reg-modelo').disabled=false}}
async function buscarClienteNome(){
    const inputs=['reg-cliente','agd-cli'];
    const act=inputs.find(id=>document.activeElement.id===id);
    if(!act)return;
    const t=document.getElementById(act).value;
    if(t.length<3)return;
    
    const r=await fetch(`${API}/clientes/autocomplete?q=${t}`);
    cCache=await r.json();
    
    const dl=document.getElementById('sug-cli');
    if(dl) {
        dl.innerHTML='';
        cCache.forEach(c=>{const o=document.createElement('option');o.value=c.nome;dl.appendChild(o)});
    }
    
    const sel=cCache.find(c=>c.nome===t);
    if(!sel) return;

    if(act==='reg-cliente'){
        document.getElementById('reg-tel').value=sel.telefone||'';
        const ip=document.getElementById('reg-placa');
        const sp=document.getElementById('reg-placa-select');
        ip.classList.add('hidden');
        sp.classList.remove('hidden');
        sp.innerHTML='<option value="">Selecione o veículo...</option>';
        sel.veiculos.forEach(v=>sp.innerHTML+=`<option value="${v.placa}" data-m="${v.modelo}">${v.placa} - ${v.modelo||''}</option>`);
        sp.innerHTML+='<option value="NOVO">Novo Carro</option>';
    } else if (act==='agd-cli') {
        document.getElementById('agd-tel').value=sel.telefone||'';
        const ip=document.getElementById('agd-placa');
        const sp=document.getElementById('agd-placa-select');
        ip.classList.add('hidden');
        sp.classList.remove('hidden');
        sp.innerHTML='<option value="">Selecione o veículo...</option>';
        sel.veiculos.forEach(v=>sp.innerHTML+=`<option value="${v.placa}" data-m="${v.modelo}">${v.placa} - ${v.modelo||''}</option>`);
        sp.innerHTML+='<option value="NOVO">Novo Carro</option>';
    }
}
function selCarroAgd(){
    const s=document.getElementById('agd-placa-select');
    const v=s.value;
    if(v==='NOVO'){
        s.classList.add('hidden');
        document.getElementById('agd-placa').classList.remove('hidden');
        document.getElementById('agd-placa').value='';
        document.getElementById('agd-modelo').value='';
        document.getElementById('agd-modelo').disabled=false;
    }else if(v){
        document.getElementById('agd-placa').value=v;
        document.getElementById('agd-modelo').value=s.options[s.selectedIndex].getAttribute('data-m')||'';
        document.getElementById('agd-modelo').disabled=true;
    }
}
function selCarro(){const s=document.getElementById('reg-placa-select');const v=s.value;if(v==='NOVO'){s.classList.add('hidden');document.getElementById('reg-placa').classList.remove('hidden');document.getElementById('reg-modelo').disabled=false}else if(v){document.getElementById('reg-placa').value=v;document.getElementById('reg-modelo').value=s.options[s.selectedIndex].getAttribute('data-m')||'';document.getElementById('reg-modelo').disabled=true}}

async function finalizarLavagem(){
    let p=document.getElementById('reg-placa').value.toUpperCase(); const s=document.getElementById('reg-placa-select');
    if(!s.classList.contains('hidden')&&s.value&&s.value!=='NOVO') p=s.value;
    const pl={
        placa:p,modelo:document.getElementById('reg-modelo').value,nome:document.getElementById('reg-cliente').value,
        telefone:document.getElementById('reg-tel').value,servico_id:document.getElementById('reg-servico').value,
        funcionario_id:document.getElementById('reg-func').value,valor:document.getElementById('reg-valor').value,
        pgto:document.getElementById('reg-pgto').value,obs:document.getElementById('reg-obs').value,
        servico_extra:document.getElementById('reg-servico-extra').value,
        valor_extra:document.getElementById('reg-valor-extra').value
    };    if(!pl.placa||!pl.nome||!pl.servico_id||!pl.valor){ showAlert('Preencha os campos obrigatórios!'); return; }
    const r=await fetch(`${API}/lavagem-rapida`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pl)});
    if(r.ok){await showAlert('Veículo registrado no pátio!');navTo('patio')}else showAlert('Erro ao registrar entrada')
}

// ================== AGENDA (CORRIGIDA E UNIFICADA) ==================
window.listaAgendamentos = [];
const agendaNotificada = new Set();

// Botão de chamar manual
function chamarAgendaZap(telefone, cliente, hora, placa) {
    const msg = `Olá ${cliente}! Tudo bem? \n\nAqui é da *SpumaCar*. \nPassando para lembrar do seu horário das *${hora}* para o veículo *${placa}*. \n\nEstamos à sua espera!`;
    enviarZap(telefone, msg);
}

// Carregar Lista
async function loadAgenda() {
    try {
        const r = await fetch(`${API}/agenda?t=${Date.now()}`);
        const d = await r.json();
        
        window.listaAgendamentos = d;
        const v = document.getElementById('lista-agenda');
        v.innerHTML = '';

        if (!d || d.length === 0) {
            v.innerHTML = '<p style="color:#888; text-align:center; width:100%; padding: 20px;">Nenhum agendamento pendente.</p>';
            return;
        }

        d.forEach(a => {
            const dt = new Date(a.data_agendada);
            const servicoExtraHtml = a.servico_extra ? `<p style="color:#0369a1; margin: 3px 0;">➕ ${a.servico_extra} (R$ ${a.valor_extra || 0})</p>` : '';

            // Proteções contra erros de aspas no HTML
            const escObs = a.obs ? String(a.obs).replace(/'/g, "\\'") : '';
            const escServExtra = a.servico_extra ? String(a.servico_extra).replace(/'/g, "\\'") : '';
            const escCliente = a.cliente ? String(a.cliente).replace(/'/g, "\\'") : '';
            const horaStr = dt.toLocaleTimeString().slice(0,5);

            v.innerHTML += `<div class="patio-card" style="border-color:#bbf7d0">
                <div class="patio-header">
                    <span class="patio-placa" style="background:#dcfce7;color:#15803d">${horaStr} - ${dt.toLocaleDateString()}</span>
                    
                    <div style="display: flex; gap: 5px;">
                        <button class="btn-action" style="padding: 5px 10px; font-weight:bold; border-radius:6px; background:#f59e0b; color:white; border:none; cursor:pointer;" onclick="abrirEditAgenda(${a.id}, '${a.data_agendada}', ${a.servico_id || 'null'}, '${escObs}', '${escServExtra}', ${a.valor_extra || 0})">✏️ Editar</button>
                        <button class="btn-action btn-delete" style="padding: 5px 10px; font-weight:bold; border-radius:6px;" onclick="cancelarAgenda(${a.id})">🗑️ Cancelar</button>
                    </div>
                </div>
                
                <div class="patio-body">
                    <p><strong>${a.placa}</strong> (${a.modelo || ''})</p>
                    <p>👤 ${a.cliente}</p>
                    <p>🛠️ ${a.servico || 'Sem serviço definido'}</p>
                    ${servicoExtraHtml}
                    <p style="font-style:italic;font-size:0.8rem;color:#d97706">${a.obs || ''}</p>
                </div>
                
                <div style="display:flex; gap:10px; margin-top:15px; flex-wrap: wrap;">
                    <button class="btn-primary" style="flex:2; background:#15803d; min-width: 150px; padding: 10px 0;" onclick="iniciarServicoAgendado(${a.id},'${a.placa}')">▶️ Receber Veículo</button>
                    <button style="flex:1; background:#25D366; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; min-width: 100px; padding: 10px 0;" onclick="chamarAgendaZap('${a.telefone}', '${escCliente}', '${horaStr}', '${a.placa}')">📱 Chamar</button>
                </div>
            </div>`;
        });
    } catch (erro) {
        console.error("Erro ao carregar a agenda:", erro);
    }
}

// Salvar Novo Agendamento (Versão Única)
async function salvarAgendamento() {
    let placaFinal = document.getElementById('agd-placa').value.toUpperCase();
    const selectPlaca = document.getElementById('agd-placa-select');
    
    if (selectPlaca && !selectPlaca.classList.contains('hidden') && selectPlaca.value && selectPlaca.value !== 'NOVO') {
        placaFinal = selectPlaca.value;
    }

    const p = {
        data_agendada: document.getElementById('agd-data').value,
        nome: document.getElementById('agd-cli').value,
        telefone: document.getElementById('agd-tel').value,
        placa: placaFinal,
        modelo: document.getElementById('agd-modelo').value,
        servico_id: document.getElementById('agd-servico').value,
        obs: document.getElementById('agd-obs').value,
        servico_extra: document.getElementById('agd-servico-extra').value,
        valor_extra: document.getElementById('agd-valor-extra').value
    };

    if (!p.data_agendada || !p.nome || !p.placa || !p.servico_id) {
        showAlert('Preencha os dados obrigatórios (Data, Cliente, Placa e Serviço)!');
        return;
    }

    try {
        const r = await fetch(`${API}/agenda`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p)
        });

        if (r.ok) {
            await showAlert('Agendado com sucesso!');
            fecharAgenda();
            await loadAgenda(); 
        } else {
            showAlert('Erro ao agendar no servidor.');
        }
    } catch (e) {
        showAlert('Erro de ligação! O agendamento falhou.');
    }
}

// Vigia Automático (Lembrete 10 mins + Notificação do Windows)
setInterval(async () => {
    try {
        const res = await fetch(`${API}/agenda`);
        if (!res.ok) return;
        
        const agendamentos = await res.json();
        if (!agendamentos || agendamentos.length === 0) return;

        let agora = new Date();

        agendamentos.forEach(async (a) => {
            const dt = new Date(a.data_agendada);
            const difMinutos = (agora.getTime() - dt.getTime()) / 1000 / 60;
            
            if (difMinutos >= -10 && difMinutos <= 15 && !agendaNotificada.has(a.id)) {
                agendaNotificada.add(a.id);
                
                const horaStr = dt.toLocaleTimeString().slice(0,5);
                
                // 1. DISPARA A NOTIFICAÇÃO NATIVA DO WINDOWS (Para quando o app está minimizado)
                if (Notification.permission === "granted") {
                    new Notification("⏰ Lembrete SpumaCar", {
                        body: `O horário de ${a.cliente} (${a.placa}) é às ${horaStr}! Abra o sistema para confirmar.`,
                        icon: "logo.png"
                    });
                }

                // 2. MOSTRA O POP-UP NA TELA (Para você clicar e enviar o zap)
                const txtConfirm = `⏰ Lembrete Automático! \nFaltam cerca de 10 minutos para o horário de ${a.cliente} (Placa: ${a.placa}) - marcado para as ${horaStr}.\n\nDeseja enviar um lembrete no WhatsApp?`;
                
                if (await showConfirm(txtConfirm)) {
                    const msgZap = `Olá ${a.cliente}! Tudo bem?\n\nAqui é da *SpumaCar*.\n\nPassando para lembrar que o seu horário para o veículo *${a.placa}* é daqui a pouco, às *${horaStr}*.\n\nEstamos à sua espera! Qualquer imprevisto, é só avisar.`;
                    enviarZap(a.telefone, msgZap);
                }
            }
        });
    } catch (erro) {
        console.error("Erro no vigia da agenda:", erro);
    }
}, 30000);

// Ações Básicas da Agenda
async function abrirModalAgenda() {
    document.getElementById('agendaModal').style.display = 'flex';
    try {
        const sR = await fetch(`${API}/servicos`);
        sCache = await sR.json();
        
        const selectServico = document.getElementById('agd-servico');
        if (selectServico) {
            selectServico.innerHTML = '<option value="">Selecione um serviço...</option>';
            sCache.forEach(s => {
                selectServico.innerHTML += `<option value="${s.id}">${s.nome} (R$ ${s.preco})</option>`;
            });
        }
        const dlServicos = document.getElementById('lista-servicos');
        if (dlServicos) {
            dlServicos.innerHTML = '';
            sCache.forEach(s => { dlServicos.innerHTML += `<option value="${s.nome}">`; });
        }
    } catch (erro) {
        console.error("Erro ao carregar os serviços na agenda:", erro);
    }
    ['agd-data', 'agd-cli', 'agd-tel', 'agd-placa', 'agd-modelo', 'agd-obs', 'agd-servico-extra', 'agd-valor-extra'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    document.getElementById('agd-placa').classList.remove('hidden');
    const spAgd = document.getElementById('agd-placa-select');
    if(spAgd) spAgd.classList.add('hidden');
    document.getElementById('agd-modelo').disabled = false;
    const resetServico = document.getElementById('agd-servico');
    if(resetServico) resetServico.value = '';
}
function fecharAgenda(){document.getElementById('agendaModal').style.display='none'}
async function iniciarServicoAgendado(id,p){if(!await showConfirm(`Receber veículo ${p} no pátio?`))return;const r=await fetch(`${API}/agenda/${id}/iniciar`,{method:'POST'});if(r.ok){await showAlert('Veículo movido para o Pátio!');navTo('patio')}else showAlert('Erro ao iniciar')}
async function cancelarAgenda(id){if(!await showConfirm('Cancelar este agendamento?'))return;await fetch(`${API}/agenda/${id}`,{method:'DELETE'});loadAgenda()}

// ================== EDIÇÃO DA AGENDA ==================
async function abrirEditAgenda(id, data_agendada, servico_id, obs, serv_extra, val_extra) {
    document.getElementById('ea-id').value = id;
    document.getElementById('ea-data').value = data_agendada;
    document.getElementById('ea-obs').value = obs !== 'undefined' && obs ? obs : '';
    document.getElementById('ea-servico-extra').value = serv_extra !== 'undefined' && serv_extra ? serv_extra : '';
    document.getElementById('ea-valor-extra').value = val_extra;
    
    if(!sCache || sCache.length === 0) {
        const sR = await fetch(`${API}/servicos`);
        sCache = await sR.json();
    }
    
    const sel = document.getElementById('ea-servico');
    sel.innerHTML = '<option value="">Sem serviço definido</option>';
    sCache.forEach(s => {
        sel.innerHTML += `<option value="${s.id}" ${s.id == servico_id ? 'selected' : ''}>${s.nome} (R$ ${s.preco})</option>`;
    });
    
    document.getElementById('editAgendaModal').style.display = 'flex';
}

function fecharEditAgenda() {
    document.getElementById('editAgendaModal').style.display = 'none';
}

async function salvarEditAgenda() {
    const id = document.getElementById('ea-id').value;
    const body = {
        data_agendada: document.getElementById('ea-data').value,
        servico_id: document.getElementById('ea-servico').value,
        obs: document.getElementById('ea-obs').value,
        servico_extra: document.getElementById('ea-servico-extra').value,
        valor_extra: document.getElementById('ea-valor-extra').value
    };
    
    if(!body.data_agendada) {
        showAlert('A data e hora são obrigatórias!');
        return;
    }

    const r = await fetch(`${API}/agenda/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });
    
    if(r.ok) {
        await showAlert('Agendamento atualizado com sucesso!');
        fecharEditAgenda();
        loadAgenda();
    } else {
        showAlert('Erro ao atualizar o agendamento.');
    }
}

// ================== RESTANTE (RH, DASH, CLIENTES, EXTRATO, MODAIS) ==================
function toggleCalcRH() {
    const tipo = document.getElementById('rh-tipo').value;
    const calcFields = document.querySelectorAll('.rh-calc');
    const desc = document.getElementById('rh-desc');
    const valor = document.getElementById('rh-valor');
    
    if(tipo === 'CREDITO') {
        calcFields.forEach(el => el.classList.remove('hidden'));
        valor.readOnly = true;
        valor.style.backgroundColor = '#f3f4f6';
        desc.placeholder = "Preenchimento automático...";
    } else {
        calcFields.forEach(el => el.classList.add('hidden'));
        valor.readOnly = false;
        valor.style.backgroundColor = '';
        valor.value = '';
        document.getElementById('rh-dias').value = '';
        document.getElementById('rh-diaria').value = '';
        desc.value = '';
        desc.placeholder = "Ex: Vale almoço, Adiantamento...";
    }
}

function calcRH() {
    const dias = document.getElementById('rh-dias').value || 0;
    const diaria = document.getElementById('rh-diaria').value || 0;
    if(dias && diaria) {
        document.getElementById('rh-valor').value = (dias * diaria).toFixed(2);
        document.getElementById('rh-desc').value = `${dias} diária(s) a R$ ${diaria}`;
    } else {
        document.getElementById('rh-valor').value = '';
        document.getElementById('rh-desc').value = '';
    }
}

async function loadRH() {
    if(!document.getElementById('rh-data').value) document.getElementById('rh-data').valueAsDate = new Date();
    if(!document.getElementById('rh-mes-filtro').value) document.getElementById('rh-mes-filtro').value = new Date().toISOString().slice(0,7);
    const mes = document.getElementById('rh-mes-filtro').value;
    const resFunc = await fetch(`${API}/funcionarios`); const funcs = await resFunc.json();
    const select = document.getElementById('rh-func'); select.innerHTML = ''; funcs.forEach(f => select.innerHTML += `<option value="${f.id}">${f.nome}</option>`);
    const resSaldos = await fetch(`${API}/rh/saldos?mes=${mes}`); const saldos = await resSaldos.json();
    const tbSaldos = document.querySelector('#tabela-rh-saldos tbody'); tbSaldos.innerHTML = '';
    saldos.forEach(s => { const final = (s.creditos||0) - (s.debitos||0); tbSaldos.innerHTML += `<tr><td><strong>${s.nome}</strong></td><td style="color:var(--success)">${fmt(s.creditos||0)}</td><td style="color:var(--danger)">-${fmt(s.debitos||0)}</td><td style="color:${final>=0?'var(--success)':'var(--danger)'}; font-weight:bold;">${fmt(final)}</td></tr>`; });
    const resExtrato = await fetch(`${API}/rh/extrato?mes=${mes}`); const extrato = await resExtrato.json();
    const tbExtrato = document.querySelector('#tabela-rh-extrato tbody'); tbExtrato.innerHTML = '';
    extrato.forEach(e => { const isC = e.tipo==='CREDITO'; tbExtrato.innerHTML += `<tr><td>${e.data_evento.split('-').reverse().join('/')}</td><td>${e.funcionario}</td><td>${e.descricao}</td><td><span style="background:${isC?'#dcfce7':'#fee2e2'};color:${isC?'#15803d':'#ef4444'};padding:2px 6px;border-radius:4px;font-size:0.8rem;">${e.tipo}</span></td><td>${isC?'':'-'}${fmt(e.valor)}</td><td><button class="btn-action btn-delete" onclick="delRH(${e.id})">X</button></td></tr>`; });
}
async function salvarRH() {
    const obj = { funcionario_id: document.getElementById('rh-func').value, tipo: document.getElementById('rh-tipo').value, descricao: document.getElementById('rh-desc').value, valor: document.getElementById('rh-valor').value, data_evento: document.getElementById('rh-data').value };
    if(!obj.funcionario_id || !obj.descricao || !obj.valor) { showAlert('Preencha funcionário, descrição e valor!'); return; }
    const res = await fetch(`${API}/rh`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    if(res.ok) { document.getElementById('rh-desc').value = ''; document.getElementById('rh-valor').value = ''; loadRH(); } else showAlert('Erro.');
}
async function delRH(id) { if(!await showConfirm('Excluir lançamento de RH?')) return; await fetch(`${API}/rh/${id}`, {method: 'DELETE'}); loadRH(); }

async function loadUsuarios() { const res = await fetch(`${API}/usuarios`); const data = await res.json(); const tb = document.querySelector('#tabela-usuarios tbody'); tb.innerHTML = ''; data.forEach(u => { tb.innerHTML += `<tr><td>${u.login}</td><td>${u.perfil}</td><td><button class="btn-action btn-delete" onclick="delUsuario(${u.id})">X</button></td></tr>`; }); }
async function salvarUsuario() { const login = document.getElementById('usu-login').value; const senha = document.getElementById('usu-senha').value; const perfil = document.getElementById('usu-perfil').value; if(!login || !senha) { showAlert('Preencha login e senha'); return; } const res = await fetch(`${API}/usuarios`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({login, senha, perfil}) }); if(res.ok) { await showAlert('Criado!'); document.getElementById('usu-login').value=''; document.getElementById('usu-senha').value=''; loadUsuarios(); } else showAlert('Erro ao criar'); }
async function delUsuario(id) { if(!await showConfirm('Excluir utilizador?')) return; const res = await fetch(`${API}/usuarios/${id}`, {method:'DELETE'}); if(res.ok) loadUsuarios(); else showAlert('Erro'); }

async function loadDash() { const res = await fetch(`${API}/dashboard`); if(res.status==401) return logout(); const d = await res.json(); document.getElementById('dash-count').innerText = d.hoje.qtd; document.getElementById('dash-patio').innerText = d.em_andamento; document.getElementById('dash-fat-hoje').innerText = fmt(d.hoje.total); if(userRole === 'admin') { document.getElementById('dash-mes-fat').innerText = fmt(d.mes.faturamento); document.getElementById('dash-mes-custo').innerText = fmt(d.mes.custos); document.getElementById('dash-mes-lucro').innerText = fmt(d.mes.lucro); } loadGraficos(); }
async function restaurarBackup(input) { if (!input.files || !input.files[0]) return; if (!await showConfirm('ATENÇÃO: Substituir TODOS os dados?')) return; const formData = new FormData(); formData.append('backupFile', input.files[0]); const res = await fetch(`${API}/restore`, { method: 'POST', body: formData }); if (res.ok) { await showAlert('Restaurado com sucesso!'); location.reload(); } else showAlert('Erro na restauração.'); }

let dadosReciboAtual = {};
function abrirModalImpressao(d) { dadosReciboAtual = d; document.getElementById('recibo-obs').value = d.obs||''; document.getElementById('printModal').style.display = 'flex'; }
function fecharPrint() { document.getElementById('printModal').style.display = 'none'; }
function realizarImpressao() { const obs = document.getElementById('recibo-obs').value; const d = dadosReciboAtual; const janela = window.open('', 'PRINT', 'height=600,width=400'); if(janela){janela.document.write(`<html><head><style>body{font-family:'Arial',sans-serif;font-size:12px;color:#000;margin:0;padding:5px;width:100%;max-width:300px}h1{text-align:center;font-size:18px;font-weight:bold;text-transform:uppercase}p{margin:2px 0}.center{text-align:center}.linha{border-bottom:1px dashed #000;margin:10px 0}.item{display:flex;justify-content:space-between;font-weight:bold}.total{font-weight:bold;font-size:16px;text-align:right;margin-top:5px}.obs{font-style:italic;font-size:11px;margin-top:5px;display:block;border:1px solid #ccc;padding:5px}@media print{body{margin:0}button{display:none}}</style></head><body><h1>SpumaCar</h1><p class="center">ESTÉTICA AUTOMOTIVA</p><div class="linha"></div><p>Data: ${new Date().toLocaleString()}</p><p>Cliente: ${d.nome}</p><p>Veículo: ${d.placa} ${d.modelo||''}</p><div class="linha"></div><div class="item"><span>${d.servico}</span><span>${fmt(d.valor)}</span></div>${obs?`<p class="obs">Obs: ${obs}</p>`:''}<div class="linha"></div><div class="total">TOTAL: ${fmt(d.valor)}</div><p style="text-align:right">Pgto: ${d.pgto}</p><br><p class="center">Obrigado pela preferência!</p><script>window.onload=function(){window.focus();setTimeout(function(){window.print();window.close();},500);}</script></body></html>`); janela.document.close();}else{showAlert('Popup bloqueado');} fecharPrint(); }
function impJanela(h) { const w=window.open('','','height=600,width=800'); if(w){w.document.write(`<html><head><style>body{font-family:'Courier New',monospace;font-size:14px;padding:20px}h2{text-align:center;border-bottom:2px solid #000;padding-bottom:10px}.linha{border-bottom:1px dashed #000;margin:10px 0}.item{display:flex;justify-content:space-between}.total{font-weight:bold;font-size:16px;text-align:right}@media print{body{margin:0}}</style></head><body>${h}<script>window.onload=function(){window.focus();setTimeout(function(){window.print();window.close();},500);}</script></body></html>`);w.document.close();}else showAlert('Popup bloqueado'); }
function abrirRelatorio(){document.getElementById('relModal').style.display='flex';document.getElementById('rdd').valueAsDate=new Date();document.getElementById('rdm').value=new Date().toISOString().slice(0,7);mRel('dia')}
function fecharRel(){document.getElementById('relModal').style.display='none'}
function mRel(t){document.getElementById('rd').className=t==='dia'?'':'hidden';document.getElementById('rm').className=t==='mes'?'':'hidden'}
async function impDia(){const d=document.getElementById('rdd').value;if(!d)return;const r=await fetch(`${API}/relatorios/fechamento-dia?data=${d}`);const j=await r.json();let h=`<h2>FECHAMENTO CAIXA</h2><p>Data:${d}</p><div class="linha"></div>`;j.vendas.forEach(v=>h+=`<div class="item"><span>${v.forma_pagamento} (${v.qtd})</span><span>${fmt(v.total)}</span></div>`);h+=`<div class="linha"></div><div class="total">TOTAL: ${fmt(j.resumo.total_vendas)}</div>`;if(j.despesas.length){h+=`<div class="linha"></div><p>SAÍDAS:</p>`;j.despesas.forEach(d=>h+=`<div class="item"><span>${d.descricao}</span><span>-${fmt(d.valor)}</span></div>`);}h+=`<div class="linha"></div><p>GAVETA: ${fmt(j.resumo.total_dinheiro)}</p>`;impJanela(h)}
async function impMes(){const m=document.getElementById('rdm').value;if(!m)return;const r=await fetch(`${API}/relatorios/fechamento-mes?mes=${m}`);const j=await r.json();let h=`<h2>BALANÇO</h2><p>${m}</p><div class="linha"></div><div class="item"><span>Faturamento:</span><span>${fmt(j.faturamento)}</span></div><div class="item"><span>Custos:</span><span>-${fmt(j.custo_produtos)}</span></div><div class="item"><span>Despesas:</span><span>-${fmt(j.total_despesas)}</span></div><div class="linha"></div><div class="total">LUCRO: ${fmt(j.lucro_liquido)}</div>`;impJanela(h)}
async function loadGraficos(){const r=await fetch(`${API}/dashboard/graficos`);const d=await r.json();const b=document.getElementById('grafico-semana');b.innerHTML='';const m=Math.max(...d.faturamento_semanal.map(x=>x.total),10);d.faturamento_semanal.forEach(x=>b.innerHTML+=`<div class="chart-bar" style="height:${(x.total/m)*100}%"><span>${Math.round(x.total)}</span><div class="chart-label">${x.data.split('-').slice(1).reverse().join('/')}</div></div>`);if(!d.faturamento_semanal.length)b.innerHTML='<p style="margin:auto;color:#999">Sem dados</p>';const l=document.getElementById('grafico-pgto');l.innerHTML='';const t=d.formas_pagamento.reduce((a,c)=>a+c.qtd,0);d.formas_pagamento.forEach(p=>l.innerHTML+=`<div class="list-chart-item"><span style="font-size:0.8rem;width:70px">${p.forma_pagamento}</span><div class="list-bar-bg"><div class="list-bar-fill" style="width:${(p.qtd/t)*100}%"></div></div><span style="font-weight:bold;font-size:0.9rem">${p.qtd}</span></div>`)}

// ================== GESTÃO DE CLIENTES ==================
async function loadCli() {
    const r = await fetch(`${API}/clientes`);
    const d = await r.json();
    const t = document.querySelector('#tabela-clientes tbody');
    t.innerHTML = '';
    
    d.forEach(c => {
        // Proteção caso o nome tenha aspas (ex: D'Artagnan)
        const escNome = c.nome ? c.nome.replace(/'/g, "\\'") : '';
        
        t.innerHTML += `<tr>
            <td>${c.nome}</td>
            <td>${c.telefone || ''}</td>
            <td>${c.veiculos_info || '-'}</td>
            <td>
                <div style="display: flex; gap: 5px;">
                    <button class="btn-action btn-whatsapp" onclick="enviarZap('${c.telefone}','Olá')">📱</button>
                    <button class="btn-action btn-edit" onclick="modalCli(${c.id})">📋</button>
                    <button class="btn-action btn-delete" onclick="delCli(${c.id}, '${escNome}')">🗑️</button>
                </div>
            </td>
        </tr>`;
    });
}

// CORREÇÃO: Função delCli implementada e código backend (app.delete) removido do frontend
async function delCli(id, nome) {
    if(await showConfirm(`Excluir cliente ${nome}? Isso apagará todo o histórico dele.`)) {
        const res = await fetch(`${API}/clientes/${id}`, { method: 'DELETE' });
        if(res.ok) loadCli();
        else showAlert('Erro ao excluir cliente.');
    }
}

function abrirNovoCli(){document.getElementById('newClientModal').style.display='flex';document.getElementById('ncn').value=''}
function fecharNewClientModal(){document.getElementById('newClientModal').style.display='none'}
async function salvarNovoCli(){const n=document.getElementById('ncn').value;const t=document.getElementById('nct').value;if(n){await fetch(`${API}/clientes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome:n,telefone:t})});fecharNewClientModal();loadCli()}}
async function modalCli(id){const m=document.getElementById('clientModal');const b=document.getElementById('clientModalBody');m.style.display='flex';b.innerHTML='...';const r=await fetch(`${API}/clientes/${id}/detalhes`);const c=await r.json();let l='';c.veiculos.forEach(v=>l+=`<li>${v.placa} - ${v.modelo||''}<button onclick="delV(${v.id},${c.id})">X</button></li>`);b.innerHTML=`<input id="ecn" value="${c.nome}"><input id="ect" value="${c.telefone||''}"><button onclick="saveCli(${c.id})">Salvar</button><hr><input id="np" placeholder="Placa"><input id="nm" placeholder="Mod"><button onclick="addV(${c.id})">+</button><ul>${l}</ul>`}
function fecharClientModal(){document.getElementById('clientModal').style.display='none'}
async function saveCli(id){await fetch(`${API}/clientes/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome:document.getElementById('ecn').value,telefone:document.getElementById('ect').value})});loadCli()}
async function addV(id){const p=document.getElementById('np').value;const m=document.getElementById('nm').value;if(p){await fetch(`${API}/veiculos`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({placa:p,modelo:m,cliente_id:id})});modalCli(id)}}
async function delV(vid,cid){if(await showConfirm('Excluir veículo?')){await fetch(`${API}/veiculos/${vid}`,{method:'DELETE'});modalCli(cid)}}

async function loadExt() {
    try {
        const campoMes = document.getElementById('extrato-mes');
        if (campoMes && !campoMes.value) {
            const hoje = new Date();
            campoMes.value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        }
        const mes = campoMes ? campoMes.value : '';
        const r = await fetch(`${API}/extrato?mes=${mes}`);
        const d = await r.json();
        
        const t = document.querySelector('#extrato tbody') || document.querySelector('#tabela-extrato tbody');
        if (!t) return;
        t.innerHTML = '';
        
        if(!d || d.length === 0) {
            t.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888; padding: 30px;">Nenhuma lavagem encontrada neste mês.</td></tr>';
            return;
        }
        
        d.forEach(x => {
            const dataLimpa = x.data_hora ? (isNaN(new Date(x.data_hora).getTime()) ? x.data_hora.split(' ')[0] : new Date(x.data_hora).toLocaleDateString()) : '-';
            t.innerHTML += `<tr>
                <td>${dataLimpa}</td>
                <td>${x.placa_registrada}<br><small>${x.modelo||''}</small></td>
                <td>${x.servico || 'Excluído'}</td>
                <td>${fmt(x.valor_cobrado)}</td>
                <td>${x.status==='CONCLUIDO'?'✅':'⏳'}</td>
                <td>
                    <button class="btn-action btn-delete admin-only" onclick="delItem('transacoes',${x.id},loadExt)">🗑️</button>
                </td>
            </tr>`;
        });
        applyRole();
    } catch (erro) { console.error("Erro no extrato:", erro); }
}
async function loadDesp() {
    try {
        const r = await fetch(`${API}/despesas`);
        const d = await r.json();
        const t = document.querySelector('#despesas-list tbody') || document.querySelector('#tabela-despesas tbody');
        if (!t) return;
        t.innerHTML = '';
        if(!d || d.length === 0) {
            t.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#888; padding: 30px;">Nenhuma despesa.</td></tr>';
            return;
        }
        d.forEach(x => {
            const dataLimpa = x.data_despesa ? (isNaN(new Date(x.data_despesa).getTime()) ? x.data_despesa.split(' ')[0] : new Date(x.data_despesa).toLocaleDateString()) : '-';
            t.innerHTML += `<tr><td>${dataLimpa}</td><td>${x.descricao}</td><td>${fmt(x.valor)}</td><td>${x.categoria || '-'}</td><td><button class="btn-action btn-delete admin-only" onclick="delItem('despesas',${x.id},loadDesp)">🗑️</button></td></tr>`;
        });
        applyRole();
    } catch (erro) { console.error("Erro nas despesas:", erro); }
}
async function salvarDesp(){const d=document.getElementById('dd').value;const v=document.getElementById('dv').value;const c=document.getElementById('dc').value;if(d){await fetch(`${API}/despesas`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({descricao:d,valor:v,categoria:c})});loadDesp();document.getElementById('dd').value=''}}
async function loadServ() {
    try {
        const r = await fetch(`${API}/servicos`);
        const d = await r.json();
        const t = document.querySelector('#servicos-list tbody') || document.querySelector('#tabela-servicos tbody');
        if (!t) return;
        t.innerHTML = '';
        if(!d || d.length === 0) {
            t.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#888; padding: 30px;">Nenhum serviço.</td></tr>';
            return;
        }
        d.forEach(x => {
            t.innerHTML += `<tr><td>${x.nome}</td><td>${fmt(x.preco)}</td><td>${x.comissao ? x.comissao + '%' : '-'}</td><td><button class="btn-action btn-delete admin-only" onclick="delItem('servicos',${x.id},loadServ)">🗑️</button></td></tr>`;
        });
        applyRole();
    } catch (erro) { console.error("Erro nos serviços:", erro); }
}
async function salvarServ(){const n=document.getElementById('sn').value;const p=document.getElementById('sp').value;const c=document.getElementById('sc').value;if(n){await fetch(`${API}/servicos`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome:n,preco:p,custo:c})});loadServ();document.getElementById('sn').value=''}}
async function loadFunc(){const r=await fetch(`${API}/funcionarios`);const d=await r.json();const t=document.querySelector('#tabela-funcs tbody');t.innerHTML='';d.forEach(x=>t.innerHTML+=`<tr><td>${x.nome}</td><td><button onclick="delItem('funcionarios',${x.id},loadFunc)">X</button></td></tr>`)}
async function salvarFunc(){const n=document.getElementById('fn').value;if(n){await fetch(`${API}/funcionarios`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome:n})});loadFunc();document.getElementById('fn').value=''}}
async function delItem(r,i,cb){if(await showConfirm('Apagar registo?')){await fetch(`${API}/${r}/${i}`,{method:'DELETE'});cb()}}

let ec={};
function abrirModal(t,i,...a){const m=document.getElementById('editModal');const b=document.getElementById('modalBody');ec={t,i};m.style.display='flex';if(t==='servico')b.innerHTML=`<label>Nome</label><input id="en" value="${a[0]}"><label>Preço</label><input id="ep" value="${a[1]}"><label>Custo</label><input id="ec" value="${a[2]}">`;if(t==='funcionario')b.innerHTML=`<label>Nome</label><input id="en" value="${a[0]}">`;if(t==='despesa')b.innerHTML=`<label>Desc</label><input id="ed" value="${a[0]}"><label>Valor</label><input id="ev" value="${a[1]}"><label>Cat</label><select id="ec"><option ${a[2]==='Fixa'?'selected':''}>Fixa</option><option ${a[2]==='Variável'?'selected':''}>Variável</option><option ${a[2]==='Pessoal'?'selected':''}>Pessoal</option></select>`;if(t==='transacao')b.innerHTML=`<label>Valor</label><input id="ev" value="${a[0]}"><label>Pgto</label><select id="ep"><option ${a[1]==='Dinheiro'?'selected':''}>Dinheiro</option><option ${a[1]==='PIX'?'selected':''}>PIX</option><option ${a[1]==='Cartão'?'selected':''}>Cartão</option></select>`;}
function fecharModal(){document.getElementById('editModal').style.display='none'}
async function confirmarEdicao(){const{t,i}=ec;let b={},r='',cb=null;if(t==='servico'){b={nome:document.getElementById('en').value,preco:document.getElementById('ep').value,custo:document.getElementById('ec').value};r=`/api/servicos/${i}`;cb=loadServ;}if(t==='funcionario'){b={nome:document.getElementById('en').value};r=`/api/funcionarios/${i}`;cb=loadFunc;}if(t==='despesa'){b={descricao:document.getElementById('ed').value,valor:document.getElementById('ev').value,categoria:document.getElementById('ec').value};r=`/api/despesas/${i}`;cb=loadDesp;}if(t==='transacao'){b={valor_cobrado:document.getElementById('ev').value,forma_pagamento:document.getElementById('ep').value};r=`/api/transacoes/${i}`;cb=loadExt;}await fetch(r,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});fecharModal();cb();}

async function carregarIpRede() {
    try {
        const res = await fetch(`${API}/rede`);
        const data = await res.json();
        document.getElementById('ip-display').innerText = `http://${data.ip}:${data.porta}`;
    } catch(e) {
        document.getElementById('ip-display').innerText = "Indisponível";
    }
}

// INICIALIZAÇÃO DA PÁGINA COM PEDIDO DE NOTIFICAÇÃO DO WINDOWS
document.addEventListener('DOMContentLoaded', () => { 
    loadDash(); 
    carregarIpRede(); 
    
    // Pede permissão ao Windows para mostrar notificações caso ainda não tenha
    if (Notification.permission !== "denied" && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
});

// ================== CONTROLO DO MENU MOBILE ==================
function toggleMenu() {
    document.querySelector('.sidebar').classList.toggle('show');
}

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if(window.innerWidth <= 768) {
            document.querySelector('.sidebar').classList.remove('show');
        }
    });
});

// ================== EDIÇÃO NO PÁTIO ==================
async function abrirEditPatio(id, servico_id, valor, obs, serv_extra, val_extra) {
    document.getElementById('ep-id').value = id;
    document.getElementById('ep-valor').value = valor;
    document.getElementById('ep-obs').value = (obs !== 'undefined' && obs) ? obs : '';
    document.getElementById('ep-servico-extra').value = (serv_extra !== 'undefined' && serv_extra) ? serv_extra : '';
    document.getElementById('ep-valor-extra').value = val_extra;
    
    if(sCache.length === 0) {
        const sR = await fetch(`${API}/servicos`);
        sCache = await sR.json();
    }
    
    const dlServicos = document.getElementById('lista-servicos');
    if(dlServicos && dlServicos.innerHTML === '') {
        sCache.forEach(s => dlServicos.innerHTML += `<option value="${s.nome}">`);
    }

    const sel = document.getElementById('ep-servico');
    sel.innerHTML = '';
    sCache.forEach(s => {
        sel.innerHTML += `<option value="${s.id}" ${s.id == servico_id ? 'selected' : ''}>${s.nome}</option>`;
    });
    
    document.getElementById('editPatioModal').style.display = 'flex';
}

function fecharEditPatio() {
    document.getElementById('editPatioModal').style.display = 'none';
}

function atualizarPrecoPatio() {
    const i = sCache.find(x => x.id == document.getElementById('ep-servico').value);
    if(i) document.getElementById('ep-valor').value = i.preco;
}

async function salvarEditPatio() {
    const id = document.getElementById('ep-id').value;
    const body = {
        servico_id: document.getElementById('ep-servico').value,
        valor_cobrado: document.getElementById('ep-valor').value,
        obs: document.getElementById('ep-obs').value,
        servico_extra: document.getElementById('ep-servico-extra').value,
        valor_extra: document.getElementById('ep-valor-extra').value
    };
    
    const r = await fetch(`${API}/patio/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });
    
    if(r.ok) {
        fecharEditPatio();
        loadPatio();
    } else {
        showAlert('Erro ao atualizar o serviço!');
    }
}
// ================== CANCELAMENTO NO PÁTIO ==================
async function cancelarPatio(id, placa) {
    if(!await showConfirm(`Tem certeza que deseja CANCELAR a entrada do veículo ${placa}? O registo será apagado do sistema.`)) return;
    
    const r = await fetch(`${API}/patio/${id}`, { method: 'DELETE' });
    
    if(r.ok) {
        await showAlert('Entrada cancelada com sucesso!');
        loadPatio();
    } else {
        showAlert('Erro ao cancelar o registo.');
    }
}

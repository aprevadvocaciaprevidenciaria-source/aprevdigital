/*!
 * Widget de agendamento online - SEO Local Brasil.
 * Uso: <div data-agendamento-slug="sos-car" data-agendamento-accent="#c9a24b"
 *      data-agendamento-servicos="Troca de óleo,Revisão geral,Outro"></div>
 *      <script src="https://painel.seolocalbrasil.com/embed/agendamento.js" defer></script>
 *
 * Casca (HTML/CSS por cliente) fica livre pra variar; este script é o motor
 * único e compartilhado - toda a lógica de disponibilidade/criação do
 * agendamento mora aqui, não no site gerado por cliente.
 */
(function () {
  'use strict';

  var DIAS_SEMANA_LABEL = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  var MESES_LABEL = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  function pad2(n) { return String(n).padStart(2, '0'); }
  function toDateStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function toIsoWeekday(d) { var w = d.getDay(); return w === 0 ? 7 : w; }
  function nowStr() { var d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

  function injectStyles() {
    if (document.getElementById('ag-widget-styles')) return;
    var style = document.createElement('style');
    style.id = 'ag-widget-styles';
    style.textContent =
      '.ag-widget{--ag-accent:#c9a24b;--ag-radius:12px;font-family:inherit;color:#111;}' +
      '.ag-widget *{box-sizing:border-box;}' +
      '.ag-week{display:flex;gap:6px;overflow-x:auto;margin:12px 0;}' +
      '.ag-day{flex:1 0 auto;min-width:52px;text-align:center;padding:10px 6px;border:1px solid #e2e2e2;border-radius:var(--ag-radius);cursor:pointer;background:#fff;}' +
      '.ag-day[disabled]{opacity:.35;cursor:not-allowed;}' +
      '.ag-day.ag-selected{background:var(--ag-accent);border-color:var(--ag-accent);color:#111;}' +
      '.ag-day .ag-day-label{display:block;font-size:11px;text-transform:uppercase;color:#888;}' +
      '.ag-day.ag-selected .ag-day-label{color:#111;}' +
      '.ag-day .ag-day-num{display:block;font-weight:700;font-size:16px;}' +
      '.ag-nav{display:flex;align-items:center;justify-content:center;gap:12px;font-weight:600;margin-bottom:4px;}' +
      '.ag-nav button{background:none;border:none;cursor:pointer;font-size:18px;line-height:1;padding:4px 8px;}' +
      '.ag-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px;margin:12px 0;}' +
      '.ag-slot{padding:10px 6px;border:1px solid #e2e2e2;border-radius:var(--ag-radius);background:#fff;cursor:pointer;font-weight:600;text-align:center;}' +
      '.ag-slot.ag-selected{background:var(--ag-accent);border-color:var(--ag-accent);}' +
      '.ag-empty{font-size:13px;color:#888;padding:8px 0;}' +
      '.ag-form{margin-top:16px;border-top:1px solid #eee;padding-top:16px;display:grid;gap:10px;}' +
      '.ag-form label{font-size:12px;font-weight:600;display:block;margin-bottom:4px;}' +
      '.ag-form input,.ag-form select,.ag-form textarea{width:100%;padding:9px 10px;border:1px solid #ddd;border-radius:8px;font-size:14px;font-family:inherit;}' +
      '.ag-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}' +
      '.ag-submit{margin-top:6px;width:100%;padding:12px;border:none;border-radius:var(--ag-radius);background:var(--ag-accent);color:#111;font-weight:700;font-size:15px;cursor:pointer;}' +
      '.ag-submit[disabled]{opacity:.6;cursor:wait;}' +
      '.ag-msg{font-size:13px;margin-top:8px;}' +
      '.ag-msg.ag-error{color:#c0392b;}' +
      '.ag-msg.ag-success{color:#1a7f4e;}' +
      '.ag-success-box{text-align:center;padding:24px 8px;}' +
      '.ag-loading{text-align:center;padding:24px 8px;color:#888;font-size:14px;}';
    document.head.appendChild(style);
  }

  function gerarSlotsDoDia(cliente) {
    function paraMin(h) { if (!h) return null; var p = h.split(':'); return Number(p[0]) * 60 + Number(p[1] || 0); }
    var abertura = paraMin(cliente.horario_abertura || cliente.horarioAbertura);
    var fechamento = paraMin(cliente.horario_fechamento || cliente.horarioFechamento);
    return abertura === null || fechamento === null ? null : { abertura: abertura, fechamento: fechamento };
  }

  function Widget(container) {
    this.el = container;
    this.slug = container.getAttribute('data-agendamento-slug');
    this.api = container.getAttribute('data-agendamento-api') || '';
    this.accent = container.getAttribute('data-agendamento-accent') || '#c9a24b';
    var servicosAttr = container.getAttribute('data-agendamento-servicos');
    this.servicos = servicosAttr ? servicosAttr.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : null;

    this.cursor = new Date();
    this.cursor.setHours(0, 0, 0, 0);
    this.selectedDate = toDateStr(this.cursor);
    this.selectedTime = null;
    this.horariosPadrao = [];
    this.ocupados = {};
    this.diasFuncionamento = [];

    this.el.classList.add('ag-widget');
    this.el.style.setProperty('--ag-accent', this.accent);
    this.render();
    this.load();
  }

  Widget.prototype.load = function () {
    var self = this;
    var mes = self.cursor.getFullYear() + '-' + pad2(self.cursor.getMonth() + 1);
    fetch(self.api + '/api/public/agendamento/' + encodeURIComponent(self.slug) + '?mes=' + mes)
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json.error) { self.el.innerHTML = '<p class="ag-msg ag-error">' + json.error + '</p>'; return; }
        self.horariosPadrao = json.horariosPadrao || [];
        self.ocupados = json.ocupados || {};
        self.diasFuncionamento = (json.cliente && json.cliente.diasFuncionamento) || [];
        self.render();
      })
      .catch(function () {
        self.el.innerHTML = '<p class="ag-msg ag-error">Não foi possível carregar os horários agora. Tente novamente em instantes.</p>';
      });
  };

  Widget.prototype.diaAberto = function (dataStr) {
    var d = new Date(dataStr + 'T00:00:00');
    return this.diasFuncionamento.indexOf(toIsoWeekday(d)) !== -1;
  };

  Widget.prototype.slotsLivres = function (dataStr) {
    var ocupadosNoDia = this.ocupados[dataStr] || [];
    var hoje = toDateStr(new Date());
    var horaAtual = nowStr();
    return this.horariosPadrao.filter(function (h) {
      if (ocupadosNoDia.indexOf(h) !== -1) return false;
      if (dataStr === hoje && h <= horaAtual) return false;
      return true;
    });
  };

  Widget.prototype.render = function () {
    var self = this;
    injectStyles();

    var weekStart = new Date(this.cursor);
    var offset = toIsoWeekday(weekStart) - 1;
    weekStart.setDate(weekStart.getDate() - offset);

    var html = '';
    html += '<div class="ag-nav">';
    html += '<button type="button" data-ag-prev>&#8249;</button>';
    html += '<span>' + MESES_LABEL[this.cursor.getMonth()] + ' ' + this.cursor.getFullYear() + '</span>';
    html += '<button type="button" data-ag-next>&#8250;</button>';
    html += '</div>';

    html += '<div class="ag-week">';
    for (var i = 0; i < 7; i++) {
      var d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      var dataStr = toDateStr(d);
      var passado = dataStr < toDateStr(new Date());
      var aberto = this.diasFuncionamento.length === 0 || this.diasFuncionamento.indexOf(toIsoWeekday(d)) !== -1;
      var selecionado = dataStr === this.selectedDate;
      html += '<button type="button" class="ag-day' + (selecionado ? ' ag-selected' : '') + '" data-ag-day="' + dataStr + '"' + (passado || !aberto ? ' disabled' : '') + '>';
      html += '<span class="ag-day-label">' + DIAS_SEMANA_LABEL[i] + '</span>';
      html += '<span class="ag-day-num">' + pad2(d.getDate()) + '</span>';
      html += '</button>';
    }
    html += '</div>';

    if (this.horariosPadrao.length === 0 && this.diasFuncionamento.length === 0) {
      html += '<div class="ag-loading">Carregando horários...</div>';
    } else if (!this.diaAberto(this.selectedDate)) {
      html += '<p class="ag-empty">Fechado nesse dia.</p>';
    } else {
      var livres = this.slotsLivres(this.selectedDate);
      if (livres.length === 0) {
        html += '<p class="ag-empty">Nenhum horário livre nesse dia.</p>';
      } else {
        html += '<div class="ag-slots">';
        livres.forEach(function (h) {
          html += '<button type="button" class="ag-slot' + (h === self.selectedTime ? ' ag-selected' : '') + '" data-ag-slot="' + h + '">' + h + '</button>';
        });
        html += '</div>';
      }
    }

    if (this.selectedTime) {
      html += this.formHtml();
    }

    this.el.innerHTML = html;
    this.bind();
  };

  Widget.prototype.formHtml = function () {
    var servicoField;
    if (this.servicos) {
      servicoField = '<select name="servico"><option value="">Selecione um serviço</option>' +
        this.servicos.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('') +
        '</select>';
    } else {
      servicoField = '<input type="text" name="servico" placeholder="Ex: Revisão geral" />';
    }

    return (
      '<form class="ag-form" data-ag-form>' +
      '<div><label>Nome completo *</label><input type="text" name="nome" required /></div>' +
      '<div><label>WhatsApp *</label><input type="text" name="whatsapp" placeholder="(00) 00000-0000" required /></div>' +
      '<div class="ag-row2">' +
      '<div><label>Veículo</label><input type="text" name="veiculo" placeholder="Ex: Honda Civic 2020" /></div>' +
      '<div><label>Placa</label><input type="text" name="placa" placeholder="ABC-1234" /></div>' +
      '</div>' +
      '<div><label>Serviço desejado</label>' + servicoField + '</div>' +
      '<div><label>Observações</label><textarea name="observacoes" rows="2"></textarea></div>' +
      '<button type="submit" class="ag-submit">Confirmar agendamento</button>' +
      '<div class="ag-msg" data-ag-msg></div>' +
      '</form>'
    );
  };

  Widget.prototype.bind = function () {
    var self = this;

    var prev = this.el.querySelector('[data-ag-prev]');
    var next = this.el.querySelector('[data-ag-next]');
    if (prev) prev.addEventListener('click', function () { self.moverSemana(-7); });
    if (next) next.addEventListener('click', function () { self.moverSemana(7); });

    var dias = this.el.querySelectorAll('[data-ag-day]');
    dias.forEach(function (btn) {
      btn.addEventListener('click', function () {
        self.selectedDate = btn.getAttribute('data-ag-day');
        self.selectedTime = null;
        self.render();
      });
    });

    var slots = this.el.querySelectorAll('[data-ag-slot]');
    slots.forEach(function (btn) {
      btn.addEventListener('click', function () {
        self.selectedTime = btn.getAttribute('data-ag-slot');
        self.render();
      });
    });

    var form = this.el.querySelector('[data-ag-form]');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        self.submeter(form);
      });
    }
  };

  Widget.prototype.moverSemana = function (dias) {
    this.cursor.setDate(this.cursor.getDate() + dias);
    this.selectedDate = toDateStr(this.cursor);
    this.selectedTime = null;
    this.load();
  };

  Widget.prototype.submeter = function (form) {
    var self = this;
    var msg = form.querySelector('[data-ag-msg]');
    var submitBtn = form.querySelector('.ag-submit');
    var payload = {
      nome: form.nome.value,
      whatsapp: form.whatsapp.value,
      veiculo: form.veiculo.value,
      placa: form.placa.value,
      servico: form.servico.value,
      observacoes: form.observacoes.value,
      data: self.selectedDate,
      horario: self.selectedTime,
    };

    submitBtn.disabled = true;
    msg.textContent = '';
    msg.className = 'ag-msg';

    fetch(self.api + '/api/public/agendamento/' + encodeURIComponent(self.slug), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (json) { return { ok: r.ok, json: json }; }); })
      .then(function (res) {
        if (!res.ok) {
          submitBtn.disabled = false;
          msg.textContent = res.json.error || 'Não foi possível confirmar. Tente novamente.';
          msg.className = 'ag-msg ag-error';
          if (r_status_is_conflict(res)) self.load();
          return;
        }
        self.el.innerHTML =
          '<div class="ag-success-box">' +
          '<p style="font-size:17px;font-weight:700;margin-bottom:6px;">Agendamento confirmado! ✅</p>' +
          '<p style="font-size:14px;color:#555;">Você vai receber a confirmação no WhatsApp em instantes.</p>' +
          '</div>';
      })
      .catch(function () {
        submitBtn.disabled = false;
        msg.textContent = 'Falha de conexão. Tente novamente.';
        msg.className = 'ag-msg ag-error';
      });

    function r_status_is_conflict(res) { return res.json && res.json.error && res.json.error.indexOf('reservado') !== -1; }
  };

  function init() {
    var containers = document.querySelectorAll('[data-agendamento-slug]');
    containers.forEach(function (el) {
      if (el.getAttribute('data-ag-mounted')) return;
      el.setAttribute('data-ag-mounted', '1');
      new Widget(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

(() => {
  "use strict";

  const funnelState = {};
  let currentStep = 0;
  const totalSteps = 6;

  const qs = (s, p = document) => p.querySelector(s);
  const qsa = (s, p = document) => Array.from(p.querySelectorAll(s));
  const campaignKeys = [
    'source', 'campaign', 'adset', 'ad', 'placement', 'fbclid',
    'utm_source', 'utm_campaign', 'utm_medium', 'utm_content'
  ];

  async function loadConfig() {
    try {
      const res = await fetch('assets/data/config.json', { cache: 'no-store' });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { leadsApiUrl: 'https://maple-leaf-inventory.sal96wpg.workers.dev/leads' };
  }

  function showError(msg) {
    const box = qs('#funnelError');
    if (!box) return;
    box.textContent = msg;
    box.classList.add('show');
  }

  function clearError() {
    const box = qs('#funnelError');
    if (!box) return;
    box.textContent = '';
    box.classList.remove('show');
  }


  function isStepComplete(showMessages = false) {
    const step = qs(`.funnel-step[data-step="${currentStep}"]`);
    if (!step) return true;

    const group = qs('.funnel-options[data-name]', step);
    if (group) {
      const name = group.dataset.name;
      if (!funnelState[name]) {
        if (showMessages) showError('Please choose one option to continue.');
        return false;
      }
    }

    const required = qsa('input[required], select[required], textarea[required]', step);
    for (const field of required) {
      if (field.type === 'checkbox') {
        if (!field.checked) {
          if (showMessages) showError('Please confirm the consent checkbox to continue.');
          return false;
        }
      } else if (!String(field.value || '').trim()) {
        if (showMessages) {
          if (field.closest('.funnel-conditional-detail')) {
            showError('Please add a short explanation before continuing.');
          } else {
            showError('Please complete the required fields.');
          }
          field.focus();
        }
        return false;
      }
    }

    if (showMessages) clearError();
    return true;
  }

  function updateContinueState() {
    const next = qs('#nextStep');
    const submit = qs('#submitFunnel');
    const complete = isStepComplete(false);

    if (next && currentStep !== totalSteps - 1) {
      next.disabled = !complete;
      next.classList.toggle('is-disabled', !complete);
      next.setAttribute('aria-disabled', String(!complete));
    }

    if (submit && currentStep === totalSteps - 1) {
      submit.disabled = !complete;
      submit.classList.toggle('is-disabled', !complete);
      submit.setAttribute('aria-disabled', String(!complete));
    }
  }


  function updateProgress() {
    const pct = Math.round(((currentStep + 1) / totalSteps) * 100);
    const stepLabel = qs('#stepLabel');
    const progressPercent = qs('#progressPercent');
    const progressBar = qs('#progressBar');
    const prev = qs('#prevStep');
    const next = qs('#nextStep');
    const submit = qs('#submitFunnel');

    if (stepLabel) stepLabel.textContent = `Step ${currentStep + 1} of ${totalSteps}`;
    if (progressPercent) progressPercent.textContent = `${pct}%`;
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (prev) prev.disabled = currentStep === 0;
    if (next) next.style.display = currentStep === totalSteps - 1 ? 'none' : '';
    if (submit) submit.style.display = currentStep === totalSteps - 1 ? '' : 'none';
    updateContinueState();
  }

  function showStep(index) {
    clearError();
    currentStep = Math.max(0, Math.min(totalSteps - 1, index));
    qsa('.funnel-step').forEach(step => {
      step.classList.toggle('active', Number(step.dataset.step) === currentStep);
    });
    updateProgress();
    updateAllConditionalDetails();
    // On mobile the form card is below the hero panel, so scroll to the form card
    // rather than the page top so the user stays in context.
    const formCard = qs('.funnel-form-card') || qs('.funnel-shell');
    if (formCard && window.innerWidth < 960) {
      const top = formCard.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function setOption(group, btn) {
    const name = group.dataset.name;
    const value = btn.dataset.value || btn.textContent.trim();
    funnelState[name] = value;

    qsa('.funnel-option', group).forEach(x => {
      x.classList.remove('selected', 'is-selected', 'active');
      x.setAttribute('aria-pressed', 'false');
    });

    btn.classList.add('selected', 'is-selected');
    btn.setAttribute('aria-pressed', 'true');
    clearError();
    updateConditionalDetail(group);
    updateContinueState();
  }

  function restoreSelectedOptions() {
    qsa('.funnel-options').forEach(group => {
      const value = funnelState[group.dataset.name];
      if (!value) {
        updateConditionalDetail(group);
        return;
      }
      const btn = qsa('.funnel-option', group).find(x => (x.dataset.value || x.textContent.trim()) === value);
      if (btn) setOption(group, btn);
      else updateConditionalDetail(group);
    });
  }


  function conditionalDetailConfig(value, groupName = '') {
    const v = String(value || '').toLowerCase();
    const group = String(groupName || '').toLowerCase();

    const examples = {
      vehicleType: {
        other: 'Example: I am looking for a camper, motorcycle, work van, luxury vehicle, boat, or something specific.',
        notSure: 'Tell us what you are thinking — for example, “I need something reliable for winter,” “I need a family SUV,” or “I want the lowest payment possible.”'
      },
      creditSituation: {
        other: 'Example: I have a cosigner, I am rebuilding after collections, I am new to credit, or I am not sure what my credit looks like.',
        notSure: 'Tell us what you know — for example, “I have never checked my credit,” “I missed payments before,” or “I think my credit is okay but I am not sure.”'
      },
      incomeType: {
        other: 'Example: I receive child tax, seasonal income, cash income, contract work, EI, assistance, or multiple income sources.',
        notSure: 'Tell us how you are paid — for example, “I work part time,” “I just started a job,” or “my income changes every month.”'
      },
      budget: {
        other: 'Example: I have a down payment, trade-in, or I want to stay under a specific monthly amount.',
        notSure: 'Tell us what feels comfortable — for example, “I want the lowest payment possible,” “I can do around $500/month,” or “I need help figuring out a budget.”'
      }
    };

    const groupExamples = examples[groupName] || {};

    if (v === 'other' || v.includes('other')) {
      return {
        key: 'other',
        label: group === 'incometype' ? 'Tell us about your income' : group === 'vehicletype' ? 'Tell us what you are looking for' : 'Tell us more',
        placeholder: groupExamples.other || 'Example: Tell us the details that best explain your situation.'
      };
    }

    if (v === 'not sure' || v.includes('not sure')) {
      return {
        key: 'notSure',
        label: group === 'budget' ? 'Tell us what payment feels comfortable' : group === 'creditsituation' ? 'Tell us what you know about your credit' : 'Tell us what you are thinking',
        placeholder: groupExamples.notSure || 'Tell us what you are thinking so we can guide you better.'
      };
    }

    return null;
  }

  function detailFieldName(groupName, key) {
    return `${groupName}_${key}Details`;
  }

  function updateConditionalDetail(group) {
    if (!group) return;
    const name = group.dataset.name;
    const value = funnelState[name];
    const step = group.closest('.funnel-step');
    if (!step || !name) return;

    let wrap = qs(`.funnel-conditional-detail[data-for="${name}"]`, step);
    const config = conditionalDetailConfig(value, name);

    if (!config) {
      if (wrap) wrap.remove();
      return;
    }

    const fieldName = detailFieldName(name, config.key);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'funnel-conditional-detail';
      wrap.dataset.for = name;
      group.insertAdjacentElement('afterend', wrap);
    }

    wrap.innerHTML = `
      <label>
        <span>${config.label}</span>
        <textarea name="${fieldName}" rows="3" required placeholder="${config.placeholder}">${funnelState[fieldName] || ''}</textarea>
      </label>
    `;

    const textarea = qs('textarea', wrap);
    if (textarea) {
      textarea.addEventListener('input', () => {
        funnelState[fieldName] = textarea.value;
        clearError();
        updateContinueState();
      });
      textarea.addEventListener('change', () => {
        funnelState[fieldName] = textarea.value;
        clearError();
        updateContinueState();
      });
    }
  }

  function updateAllConditionalDetails() {
    qsa('.funnel-options[data-name]').forEach(updateConditionalDetail);
  }


  function validateStep() {
    return isStepComplete(true);
  }

  function collectFormData() {
    const form = qs('#financeFunnelForm');
    if (!form) return { ...funnelState };

    const fd = new FormData(form);
    for (const [k, v] of fd.entries()) {
      if (k !== 'consent') funnelState[k] = v;
    }

    const params = new URLSearchParams(location.search);
    funnelState.consent = !!form.elements.consent?.checked;
    funnelState.source = params.get('source') || 'website';
    funnelState.campaign = params.get('campaign') || '';
    funnelState.adset = params.get('adset') || '';
    funnelState.ad = params.get('ad') || '';
    funnelState.placement = params.get('placement') || '';
    funnelState.fbclid = params.get('fbclid') || '';
    funnelState.utm_source = params.get('utm_source') || '';
    funnelState.utm_campaign = params.get('utm_campaign') || '';
    funnelState.utm_medium = params.get('utm_medium') || '';
    funnelState.utm_content = params.get('utm_content') || '';
    funnelState.search = params.get('search') || '';
    funnelState.budgetMax = params.get('budgetMax') || '';
    funnelState.pageUrl = location.href;
    funnelState.submittedAt = new Date().toISOString();

    return { ...funnelState };
  }

  async function submitLead(e) {
    e.preventDefault();
    if (!validateStep()) return;

    const lead = collectFormData();
    const submit = qs('#submitFunnel');

    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Submitting...';
    }

    try {
      const config = await loadConfig();
      const res = await fetch(config.leadsApiUrl || 'https://maple-leaf-inventory.sal96wpg.workers.dev/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || 'Could not submit lead');

      const form = qs('#financeFunnelForm');
      const success = qs('#funnelSuccess');

      // Populate personalized summary
      const summary = qs('#funnelSuccessSummary');
      if (summary) {
        const parts = [];
        if (lead.vehicleType)      parts.push(`<span class="success-pill">${lead.vehicleType}</span>`);
        if (lead.creditSituation)  parts.push(`<span class="success-pill">${lead.creditSituation}</span>`);
        if (lead.incomeType)       parts.push(`<span class="success-pill">${lead.incomeType}</span>`);
        if (lead.budget)           parts.push(`<span class="success-pill">${lead.budget}</span>`);
        if (lead.city && lead.province) parts.push(`<span class="success-pill">${lead.city}, ${lead.province}</span>`);
        if (parts.length) {
          summary.innerHTML = `<p class="success-summary-label">Here's what we received:</p><div class="success-pills">${parts.join('')}</div>`;
        }
      }

      if (form) form.style.display = 'none';
      if (success) success.classList.add('active');
    } catch (err) {
      showError('Could not submit right now. Please call or text Maple Leaf Motors at 204-509-2668, or try again shortly.');
      console.error(err);
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Submit request';
      }
    }
  }

  function initFunnel() {
    const params = new URLSearchParams(location.search);
    const vehicleParam = params.get('vehicle');
    if (vehicleParam) funnelState.vehicleId = vehicleParam;
    if (params.get('type')) funnelState.vehicleType = params.get('type');
    if (params.get('search')) funnelState.vehicleSearch = params.get('search');
    if (params.get('budgetMax')) funnelState.budgetMax = params.get('budgetMax');
    campaignKeys.forEach(key => {
      if (params.get(key)) funnelState[key] = params.get(key);
    });

    qsa('.funnel-options').forEach(group => {
      group.addEventListener('click', e => {
        const btn = e.target.closest('.funnel-option');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        setOption(group, btn);
      });
    });

    qsa('#financeFunnelForm input, #financeFunnelForm select, #financeFunnelForm textarea').forEach(field => {
      field.addEventListener('input', updateContinueState);
      field.addEventListener('change', updateContinueState);
    });

    const next = qs('#nextStep');
    const prev = qs('#prevStep');
    const form = qs('#financeFunnelForm');

    if (next) {
      next.addEventListener('click', e => {
        e.preventDefault();
        if (!validateStep()) return;
        collectFormData();
        showStep(currentStep + 1);
        restoreSelectedOptions();
        updateContinueState();
      });
    }

    if (prev) {
      prev.addEventListener('click', e => {
        e.preventDefault();
        collectFormData();
        showStep(currentStep - 1);
        restoreSelectedOptions();
        updateContinueState();
      });
    }

    if (form) form.addEventListener('submit', submitLead);

    qsa('.funnel-consent').forEach(label => {
      const checkbox = qs('input[type="checkbox"]', label);
      if (!checkbox) return;

      label.addEventListener('click', e => {
        // Let direct checkbox clicks work normally.
        if (e.target === checkbox) return;

        e.preventDefault();
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        clearError();
      });

      checkbox.addEventListener('change', () => {
        funnelState.consent = checkbox.checked;
        label.classList.toggle('checked', checkbox.checked);
        clearError();
        updateContinueState();
      });
    });

    updateProgress();
    restoreSelectedOptions();
    updateContinueState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFunnel);
  } else {
    initFunnel();
  }
})();

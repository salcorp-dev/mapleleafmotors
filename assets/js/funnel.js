(() => {
  "use strict";

  const funnelState = {};
  let currentStep = 0;
  const totalSteps = 6;

  const qs = (s, p = document) => p.querySelector(s);
  const qsa = (s, p = document) => Array.from(p.querySelectorAll(s));

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
  }

  function showStep(index) {
    clearError();
    currentStep = Math.max(0, Math.min(totalSteps - 1, index));
    qsa('.funnel-step').forEach(step => {
      step.classList.toggle('active', Number(step.dataset.step) === currentStep);
    });
    updateProgress();
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
  }

  function restoreSelectedOptions() {
    qsa('.funnel-options').forEach(group => {
      const value = funnelState[group.dataset.name];
      if (!value) return;
      const btn = qsa('.funnel-option', group).find(x => (x.dataset.value || x.textContent.trim()) === value);
      if (btn) setOption(group, btn);
    });
  }

  function validateStep() {
    const step = qs(`.funnel-step[data-step="${currentStep}"]`);
    if (!step) return true;

    const group = qs('.funnel-options[data-name]', step);
    if (group) {
      const name = group.dataset.name;
      if (!funnelState[name]) {
        showError('Please choose one option to continue.');
        return false;
      }
    }

    const required = qsa('input[required], select[required], textarea[required]', step);
    for (const field of required) {
      if (field.type === 'checkbox') {
        if (!field.checked) {
          showError('Please confirm the consent checkbox to continue.');
          return false;
        }
      } else if (!field.value.trim()) {
        showError('Please complete the required fields.');
        field.focus();
        return false;
      }
    }

    clearError();
    return true;
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
    funnelState.placement = params.get('placement') || '';
    funnelState.fbclid = params.get('fbclid') || '';
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
      showError('Could not submit right now. Please call or text Maple Leaf Motors at (204) 963-0348, or try again shortly.');
      console.error(err);
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Submit request';
      }
    }
  }

  function initFunnel() {
    // Capture vehicle ID from URL if coming from a vehicle detail page
    const vehicleParam = new URLSearchParams(location.search).get('vehicle');
    if (vehicleParam) funnelState.vehicleId = vehicleParam;

    qsa('.funnel-options').forEach(group => {
      group.addEventListener('click', e => {
        const btn = e.target.closest('.funnel-option');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        setOption(group, btn);
      });
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
      });
    }

    if (prev) {
      prev.addEventListener('click', e => {
        e.preventDefault();
        collectFormData();
        showStep(currentStep - 1);
        restoreSelectedOptions();
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
      });
    });

    updateProgress();
    restoreSelectedOptions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFunnel);
  } else {
    initFunnel();
  }
})();

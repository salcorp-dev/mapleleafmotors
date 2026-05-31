const funnelState = {};
let currentStep = 0;
const totalSteps = 6;

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

async function loadConfig() {
  try {
    const res = await fetch('assets/data/config.json', { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch (e) {}
  return { leadsApiUrl: 'https://maple-leaf-inventory.sal96wpg.workers.dev/leads' };
}

function showError(msg) {
  const box = $('#funnelError');
  if (!box) return;
  box.textContent = msg;
  box.classList.add('show');
}

function clearError() {
  const box = $('#funnelError');
  if (!box) return;
  box.textContent = '';
  box.classList.remove('show');
}

function updateProgress() {
  const pct = Math.round(((currentStep + 1) / totalSteps) * 100);
  const stepLabel = $('#stepLabel');
  const progressPercent = $('#progressPercent');
  const progressBar = $('#progressBar');
  const prev = $('#prevStep');
  const next = $('#nextStep');
  const submit = $('#submitFunnel');

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
  $$('.funnel-step').forEach(step => {
    step.classList.toggle('active', Number(step.dataset.step) === currentStep);
  });
  updateProgress();
}

function setOption(group, btn) {
  const name = group.dataset.name;
  const value = btn.dataset.value || btn.textContent.trim();

  funnelState[name] = value;

  $$('.funnel-option', group).forEach(x => {
    x.classList.remove('selected', 'is-selected', 'active');
    x.setAttribute('aria-pressed', 'false');
  });

  btn.classList.add('selected', 'is-selected');
  btn.setAttribute('aria-pressed', 'true');
  clearError();
}

function restoreSelectedOptions() {
  $$('.funnel-options').forEach(group => {
    const value = funnelState[group.dataset.name];
    if (!value) return;
    const btn = $$('.funnel-option', group).find(x => (x.dataset.value || x.textContent.trim()) === value);
    if (btn) setOption(group, btn);
  });
}

function validateStep() {
  const step = $(`.funnel-step[data-step="${currentStep}"]`);
  if (!step) return true;

  const group = $('.funnel-options[data-name]', step);
  if (group) {
    const name = group.dataset.name;
    if (!funnelState[name]) {
      showError('Please choose one option to continue.');
      return false;
    }
  }

  const required = $$('input[required], select[required], textarea[required]', step);
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
  const form = $('#financeFunnelForm');
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
  const submit = $('#submitFunnel');

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

    $('#financeFunnelForm').style.display = 'none';
    $('#funnelSuccess').classList.add('active');
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

document.addEventListener('DOMContentLoaded', () => {
  $$('.funnel-options').forEach(group => {
    group.addEventListener('click', e => {
      const btn = e.target.closest('.funnel-option');
      if (!btn) return;
      e.preventDefault();
      setOption(group, btn);
    });
  });

  const next = $('#nextStep');
  const prev = $('#prevStep');
  const form = $('#financeFunnelForm');

  if (next) {
    next.addEventListener('click', () => {
      if (!validateStep()) return;
      collectFormData();
      showStep(currentStep + 1);
      restoreSelectedOptions();
    });
  }

  if (prev) {
    prev.addEventListener('click', () => {
      collectFormData();
      showStep(currentStep - 1);
      restoreSelectedOptions();
    });
  }

  if (form) form.addEventListener('submit', submitLead);

  updateProgress();
  restoreSelectedOptions();
});

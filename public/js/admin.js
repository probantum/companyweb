// Generic create/edit modal wiring, shared by the blog/portfolio/cards admin screens.
// Usage: setupCrudModal({ overlayId, formId, titleId, submitLabelId, addButtonId, editGroup, addTitle, addSubmitLabel, editTitle, editSubmitLabel })
function setupCrudModal(config) {
  const overlay = document.getElementById(config.overlayId);
  const form = document.getElementById(config.formId);
  const title = document.getElementById(config.titleId);
  const submitLabel = config.submitLabelId ? document.getElementById(config.submitLabelId) : null;
  const addButton = document.getElementById(config.addButtonId);
  const createAction = form.dataset.createAction;

  function openModal() {
    overlay.classList.add('is-open');
  }

  function closeModal() {
    overlay.classList.remove('is-open');
  }

  function setFieldValues(record) {
    Object.keys(record).forEach((key) => {
      const field = form.elements.namedItem(key);
      if (!field || field.type === 'file') return;
      const value = record[key];
      field.value = Array.isArray(value) ? value.join(', ') : value ?? '';
    });
  }

  addButton.addEventListener('click', () => {
    form.reset();
    form.action = createAction;
    title.textContent = config.addTitle || 'Add';
    if (submitLabel) submitLabel.textContent = config.addSubmitLabel || 'Create';
    if (config.onReset) config.onReset();
    openModal();
  });

  overlay.querySelectorAll('[data-modal-dismiss]').forEach((el) => {
    el.addEventListener('click', closeModal);
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
  });

  document.querySelectorAll(`[data-edit-trigger="${config.editGroup}"]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      form.reset();
      form.action = btn.dataset.action;
      title.textContent = config.editTitle || 'Edit';
      if (submitLabel) submitLabel.textContent = config.editSubmitLabel || 'Save changes';
      const record = JSON.parse(btn.dataset.record);
      setFieldValues(record);
      if (config.onPopulate) config.onPopulate(record);
      openModal();
    });
  });

  // Full-page form POST — the button stays disabled/spinning until the
  // response navigates the page away, so there's no matching re-enable step.
  form.addEventListener('submit', () => {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn || submitBtn.disabled) return;
    submitBtn.disabled = true;
    submitBtn.insertAdjacentHTML('afterbegin', '<span class="btn-spinner"></span>');
  });

  return { openModal, closeModal };
}

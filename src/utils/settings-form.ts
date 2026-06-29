/**
 * SettingsForm — declarative schema-driven settings popover for panels.
 * Replaces hand-written getSettingsPopover() implementations.
 */

import { escapeHtml } from '@/utils';

// ─── Base types ────────────────────────────────────────────────────────────

export interface SettingOption {
  value: string;
  label: string;
  hint?: string;
}

interface BaseSchema {
  label: string;
  hint?: string;
}

// ─── Simple field types ────────────────────────────────────────────────────

interface CheckboxSchema<T> extends BaseSchema {
  type: 'checkbox';
  key: keyof T;
  dependsOn?: { key: keyof T; value: any };
}

interface SelectSchema<T> extends BaseSchema {
  type: 'select';
  key: keyof T;
  options: SettingOption[];
  dependsOn?: { key: keyof T; value: any };
}

interface TextSchema<T> extends BaseSchema {
  type: 'text';
  key: keyof T;
  placeholder?: string;
  dependsOn?: { key: keyof T; value: any };
}

interface NumberSchema<T> extends BaseSchema {
  type: 'number';
  key: keyof T;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  dependsOn?: { key: keyof T; value: any };
}

interface PasswordSchema<T> extends BaseSchema {
  type: 'password';
  key: keyof T;
  placeholder?: string;
  dependsOn?: { key: keyof T; value: any };
}

interface TextareaSchema<T> extends BaseSchema {
  type: 'textarea';
  key: keyof T;
  placeholder?: string;
  dependsOn?: { key: keyof T; value: any };
}

interface ColorSchema<T> extends BaseSchema {
  type: 'color';
  key: keyof T;
  dependsOn?: { key: keyof T; value: any };
}

interface RangeSchema<T> extends BaseSchema {
  type: 'range';
  key: keyof T;
  min?: number;
  max?: number;
  step?: number;
  dependsOn?: { key: keyof T; value: any };
}

interface RadioGroupSchema<T> extends BaseSchema {
  type: 'radio-group';
  key: keyof T;
  options: SettingOption[];
  dependsOn?: { key: keyof T; value: any };
}

// ─── Complex field types ───────────────────────────────────────────────────

interface TagListSchema<T> extends BaseSchema {
  type: 'tag-list';
  key: keyof T;
  placeholder?: string;
  dependsOn?: { key: keyof T; value: any };
}

interface CheckGroupSchema<T> extends BaseSchema {
  type: 'check-group';
  key: keyof T;
  options: SettingOption[];
  dependsOn?: { key: keyof T; value: any };
}

interface TrackedListSchema<T> extends BaseSchema {
  type: 'tracked-list';
  key: keyof T;
  platforms?: string[];
  placeholder?: string;
  dependsOn?: { key: keyof T; value: any };
}

interface StringListSchema<T> extends BaseSchema {
  type: 'string-list';
  key: keyof T;
  placeholder?: string;
  dependsOn?: { key: keyof T; value: any };
}

interface SortableItemField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'color';
  options?: SettingOption[];
  placeholder?: string;
  min?: number;
  max?: number;
  width?: number;
}

interface SortableListSchema<T> extends BaseSchema {
  type: 'sortable-list';
  key: keyof T;
  itemFields: SortableItemField[];
  dependsOn?: { key: keyof T; value: any };
}

// ─── Union type ────────────────────────────────────────────────────────────

export type SettingSchema<T extends Record<string, any> = Record<string, any>> =
  | CheckboxSchema<T>
  | SelectSchema<T>
  | TextSchema<T>
  | NumberSchema<T>
  | PasswordSchema<T>
  | TextareaSchema<T>
  | ColorSchema<T>
  | RangeSchema<T>
  | RadioGroupSchema<T>
  | TagListSchema<T>
  | CheckGroupSchema<T>
  | TrackedListSchema<T>
  | StringListSchema<T>
  | SortableListSchema<T>;

export interface SettingsFormOptions<T extends Record<string, any>> {
  title: string;
  schema: SettingSchema<T>[];
  initialValues: T;
  onChange: (values: T) => void;
  onClose?: () => void;
}

// ─── Implementation ────────────────────────────────────────────────────────

export function createSettingsForm<T extends Record<string, any>>(
  opts: SettingsFormOptions<T>
): HTMLElement {
  const { title, schema, initialValues, onChange } = opts;
  const values: T = { ...initialValues };
  const elements = new Map<keyof T, HTMLElement>();

  const container = document.createElement('div');
  container.className = 'settings-form';

  const header = document.createElement('div');
  header.className = 'settings-form-header';
  header.textContent = title;
  container.appendChild(header);

  function emitChange() {
    onChange(values);
  }

  for (const field of schema) {
    const row = document.createElement('div');
    row.className = 'settings-form-row';
    row.dataset.key = String(field.key as string);

    const isFullWidth =
      field.type === 'tag-list' ||
      field.type === 'check-group' ||
      field.type === 'tracked-list' ||
      field.type === 'string-list' ||
      field.type === 'sortable-list';

    if (isFullWidth) {
      row.classList.add('settings-form-row--full');
    }

    if (!isFullWidth) {
      const label = document.createElement('label');
      label.className = 'settings-form-label';
      label.textContent = field.label;
      if ('hint' in field && field.hint) {
        const hint = document.createElement('span');
        hint.className = 'settings-form-hint';
        hint.textContent = field.hint;
        label.appendChild(hint);
      }
      row.appendChild(label);
    }

    const input = createInput(field, values[field.key], val => {
      values[field.key] = val;
      emitChange();
      updateDependents(field.key, val);
    });

    if (isFullWidth) {
      const label = document.createElement('div');
      label.className = 'settings-form-full-label';
      label.textContent = field.label;
      if ('hint' in field && field.hint) {
        const hint = document.createElement('span');
        hint.className = 'settings-form-hint';
        hint.textContent = field.hint;
        label.appendChild(hint);
      }
      row.appendChild(label);
    }

    row.appendChild(input);
    elements.set(field.key, row);
    container.appendChild(row);
  }

  // ─── Field renderers ─────────────────────────────────────────────────────

  function createInput(
    field: SettingSchema<T>,
    initial: any,
    onInput: (val: any) => void
  ): HTMLElement {
    switch (field.type) {
      case 'checkbox':
        return renderCheckbox(field, initial, onInput);
      case 'select':
        return renderSelect(field, initial, onInput);
      case 'radio-group':
        return renderRadioGroup(field, initial, onInput);
      case 'range':
        return renderRange(field, initial, onInput);
      case 'textarea':
        return renderTextarea(field, initial, onInput);
      case 'number':
        return renderNumber(field, initial, onInput);
      case 'color':
        return renderColor(field, initial, onInput);
      case 'tag-list':
        return renderTagList(field, initial, onInput);
      case 'check-group':
        return renderCheckGroup(field, initial, onInput);
      case 'tracked-list':
        return renderTrackedList(field, initial, onInput);
      case 'string-list':
        return renderStringList(field, initial, onInput);
      case 'sortable-list':
        return renderSortableList(field, initial, onInput);
      case 'password':
      case 'text':
      default:
        return renderText(field, initial, onInput);
    }
  }

  function renderCheckbox(
    _field: CheckboxSchema<T>,
    initial: any,
    onInput: (val: boolean) => void
  ): HTMLElement {
    const wrap = document.createElement('label');
    wrap.className = 'settings-form-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!initial;
    input.addEventListener('change', () => onInput(input.checked));
    const slider = document.createElement('span');
    slider.className = 'settings-form-toggle-slider';
    wrap.append(input, slider);
    return wrap;
  }

  function renderSelect(
    field: SelectSchema<T>,
    initial: any,
    onInput: (val: string) => void
  ): HTMLElement {
    const select = document.createElement('select');
    select.className = 'settings-form-select';
    for (const opt of field.options) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      select.appendChild(o);
    }
    select.value = String(initial ?? '');
    select.addEventListener('change', () => onInput(select.value));
    return select;
  }

  function renderRadioGroup(
    field: RadioGroupSchema<T>,
    initial: any,
    onInput: (val: string) => void
  ): HTMLElement {
    const group = document.createElement('div');
    group.className = 'settings-form-radio-group';
    for (const opt of field.options) {
      const wrap = document.createElement('label');
      wrap.className = 'settings-form-radio';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `sf-${String(field.key)}`;
      input.value = opt.value;
      input.checked = initial === opt.value;
      input.addEventListener('change', () => onInput(opt.value));
      wrap.append(input, document.createTextNode(opt.label));
      group.appendChild(wrap);
    }
    return group;
  }

  function renderRange(
    field: RangeSchema<T>,
    initial: any,
    onInput: (val: number) => void
  ): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'settings-form-range-wrap';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(field.min ?? 0);
    input.max = String(field.max ?? 100);
    input.step = String(field.step ?? 1);
    input.value = String(initial ?? field.min ?? 0);
    input.className = 'settings-form-range';
    const val = document.createElement('span');
    val.className = 'settings-form-range-value';
    val.textContent = input.value;
    input.addEventListener('input', () => {
      val.textContent = input.value;
      onInput(Number(input.value));
    });
    wrap.append(input, val);
    return wrap;
  }

  function renderTextarea(
    field: TextareaSchema<T>,
    initial: any,
    onInput: (val: string) => void
  ): HTMLElement {
    const ta = document.createElement('textarea');
    ta.className = 'settings-form-textarea';
    ta.placeholder = field.placeholder || '';
    ta.value = String(initial ?? '');
    ta.addEventListener('input', () => onInput(ta.value));
    return ta;
  }

  function renderNumber(
    field: NumberSchema<T>,
    initial: any,
    onInput: (val: number) => void
  ): HTMLElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'settings-form-input';
    input.placeholder = field.placeholder || '';
    input.value = String(initial ?? '');
    if (field.min !== undefined) input.min = String(field.min);
    if (field.max !== undefined) input.max = String(field.max);
    if (field.step !== undefined) input.step = String(field.step);
    input.addEventListener('input', () => onInput(Number(input.value)));
    return input;
  }

  function renderColor(
    _field: ColorSchema<T>,
    initial: any,
    onInput: (val: string) => void
  ): HTMLElement {
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'settings-form-input';
    input.value = String(initial ?? '#000000');
    input.addEventListener('input', () => onInput(input.value));
    return input;
  }

  function renderText(
    field: TextSchema<T> | PasswordSchema<T>,
    initial: any,
    onInput: (val: string) => void
  ): HTMLElement {
    const input = document.createElement('input');
    input.type = field.type === 'password' ? 'password' : 'text';
    input.className = 'settings-form-input';
    input.placeholder = field.placeholder || '';
    input.value = String(initial ?? '');
    input.addEventListener('input', () => onInput(input.value));
    return input;
  }

  // ─── Complex field renderers ─────────────────────────────────────────────

  function renderTagList(
    field: TagListSchema<T>,
    initial: any,
    onInput: (val: string[]) => void
  ): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'settings-form-tag-list';

    const tags: string[] = Array.isArray(initial) ? [...initial] : [];

    const renderTags = () => {
      const display = wrap.querySelector('.settings-form-tag-list-tags');
      if (!display) return;
      display.innerHTML = '';
      if (tags.length === 0) {
        display.innerHTML = '<span class="settings-form-tag-list-empty">No tags</span>';
        return;
      }
      for (let i = 0; i < tags.length; i++) {
        const tag = document.createElement('span');
        tag.className = 'settings-form-tag';
        tag.innerHTML = `${escapeHtml(tags[i])}<button class="settings-form-tag-remove" data-idx="${i}">&times;</button>`;
        display.appendChild(tag);
      }
      display.querySelectorAll<HTMLButtonElement>('.settings-form-tag-remove').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          tags.splice(parseInt(btn.dataset.idx!, 10), 1);
          onInput([...tags]);
          renderTags();
        });
      });
    };

    const inputRow = document.createElement('div');
    inputRow.className = 'settings-form-tag-list-input';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'settings-form-input';
    input.placeholder = field.placeholder || 'Add tags (comma-separated)';

    const addBtn = document.createElement('button');
    addBtn.className = 'settings-form-btn';
    addBtn.textContent = 'Add';
    addBtn.addEventListener('click', () => {
      const raw = input.value.trim();
      if (!raw) return;
      const newTags = raw
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
      for (const t of newTags) {
        if (!tags.includes(t)) tags.push(t);
      }
      input.value = '';
      onInput([...tags]);
      renderTags();
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addBtn.click();
      }
    });

    inputRow.append(input, addBtn);

    const display = document.createElement('div');
    display.className = 'settings-form-tag-list-tags';

    wrap.append(display, inputRow);
    renderTags();
    return wrap;
  }

  function renderCheckGroup(
    field: CheckGroupSchema<T>,
    initial: any,
    onInput: (val: string[]) => void
  ): HTMLElement {
    const group = document.createElement('div');
    group.className = 'settings-form-check-group';

    const selected: string[] = Array.isArray(initial) ? [...initial] : [];

    for (const opt of field.options) {
      const wrap = document.createElement('label');
      wrap.className = 'settings-form-check-group-item';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = selected.includes(opt.value);
      input.addEventListener('change', () => {
        if (input.checked) {
          if (!selected.includes(opt.value)) selected.push(opt.value);
        } else {
          const idx = selected.indexOf(opt.value);
          if (idx >= 0) selected.splice(idx, 1);
        }
        onInput([...selected]);
      });
      const label = document.createElement('span');
      label.textContent = opt.label;
      if (opt.hint) {
        label.style.color = opt.hint;
      }
      wrap.append(input, label);
      group.appendChild(wrap);
    }

    return group;
  }

  function renderTrackedList(
    field: TrackedListSchema<T>,
    initial: any,
    onInput: (val: Array<{ name: string; platform: string }>) => void
  ): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'settings-form-tracked-list';

    const platforms = field.platforms || ['twitter', 'reddit'];
    const items: Array<{ name: string; platform: string }> = Array.isArray(initial)
      ? initial.map((a: any) => ({ ...a }))
      : [];

    const renderItems = () => {
      const list = wrap.querySelector('.settings-form-tracked-list-items');
      if (!list) return;
      list.innerHTML = '';
      if (items.length === 0) {
        list.innerHTML = '<div class="settings-form-tracked-list-empty">No tracked accounts</div>';
        return;
      }
      for (let i = 0; i < items.length; i++) {
        const item = document.createElement('div');
        item.className = 'settings-form-tracked-list-item';
        item.innerHTML = `
          <span class="settings-form-tracked-list-name">${escapeHtml(items[i].name)}</span>
          <span class="settings-form-tracked-list-platform">${escapeHtml(items[i].platform)}</span>
          <button class="settings-form-tracked-list-remove" data-idx="${i}" title="Remove">&times;</button>
        `;
        list.appendChild(item);
      }
      list
        .querySelectorAll<HTMLButtonElement>('.settings-form-tracked-list-remove')
        .forEach(btn => {
          btn.addEventListener('click', e => {
            e.stopPropagation();
            items.splice(parseInt(btn.dataset.idx!, 10), 1);
            onInput(items.map(a => ({ ...a })));
            renderItems();
          });
        });
    };

    const addRow = document.createElement('div');
    addRow.className = 'settings-form-tracked-list-add';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'settings-form-input';
    nameInput.placeholder = field.placeholder || '@username or r/subreddit';

    const platformSelect = document.createElement('select');
    platformSelect.className = 'settings-form-select';
    for (const p of platforms) {
      const o = document.createElement('option');
      o.value = p;
      o.textContent = p.charAt(0).toUpperCase() + p.slice(1);
      platformSelect.appendChild(o);
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'settings-form-btn';
    addBtn.textContent = 'Add';
    addBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) return;
      const platform = platformSelect.value;

      let normalizedName = name;
      if (platform === 'twitter' && !name.startsWith('@')) normalizedName = '@' + name;
      if (platform === 'reddit' && !name.startsWith('r/')) normalizedName = 'r/' + name;

      if (!items.some(a => a.name === normalizedName && a.platform === platform)) {
        items.push({ name: normalizedName, platform });
        onInput(items.map(a => ({ ...a })));
      }

      nameInput.value = '';
      renderItems();
    });

    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addBtn.click();
      }
    });

    addRow.append(nameInput, platformSelect, addBtn);

    const list = document.createElement('div');
    list.className = 'settings-form-tracked-list-items';

    wrap.append(list, addRow);
    renderItems();
    return wrap;
  }

  function renderStringList(
    field: StringListSchema<T>,
    initial: any,
    onInput: (val: string[]) => void
  ): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'settings-form-string-list';

    const items: string[] = Array.isArray(initial) ? [...initial] : [];

    const renderItems = () => {
      const list = wrap.querySelector('.settings-form-string-list-items');
      if (!list) return;
      list.innerHTML = '';
      if (items.length === 0) {
        list.innerHTML = '<div class="settings-form-string-list-empty">No items</div>';
        return;
      }
      for (let i = 0; i < items.length; i++) {
        const item = document.createElement('div');
        item.className = 'settings-form-string-list-item';
        item.innerHTML = `
          <span class="settings-form-string-list-name">${escapeHtml(items[i])}</span>
          <button class="settings-form-string-list-remove" data-idx="${i}" title="Remove">&times;</button>
        `;
        list.appendChild(item);
      }
      list.querySelectorAll<HTMLButtonElement>('.settings-form-string-list-remove').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          items.splice(parseInt(btn.dataset.idx!, 10), 1);
          onInput([...items]);
          renderItems();
        });
      });
    };

    const addRow = document.createElement('div');
    addRow.className = 'settings-form-string-list-add';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'settings-form-input';
    input.placeholder = field.placeholder || 'Add item';

    const addBtn = document.createElement('button');
    addBtn.className = 'settings-form-btn';
    addBtn.textContent = 'Add';
    addBtn.addEventListener('click', () => {
      const val = input.value.trim();
      if (!val) return;
      if (!items.includes(val)) {
        items.push(val);
        onInput([...items]);
      }
      input.value = '';
      renderItems();
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addBtn.click();
      }
    });

    addRow.append(input, addBtn);

    const list = document.createElement('div');
    list.className = 'settings-form-string-list-items';

    wrap.append(list, addRow);
    renderItems();
    return wrap;
  }

  function renderSortableList(
    field: SortableListSchema<T>,
    initial: any,
    onInput: (val: any[]) => void
  ): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'settings-form-sortable-list';

    const items: any[] = Array.isArray(initial) ? initial.map((a: any) => ({ ...a })) : [];

    const renderItems = () => {
      const list = wrap.querySelector('.settings-form-sortable-list-items');
      if (!list) return;
      list.innerHTML = '';
      if (items.length === 0) {
        list.innerHTML = '<div class="settings-form-sortable-list-empty">No items</div>';
        return;
      }
      for (let i = 0; i < items.length; i++) {
        const item = document.createElement('div');
        item.className = 'settings-form-sortable-list-item';
        item.dataset.idx = String(i);
        item.setAttribute('draggable', 'true');

        const drag = document.createElement('span');
        drag.className = 'settings-form-sortable-list-drag';
        drag.textContent = '\u2630';
        drag.title = 'Drag to reorder';

        const fields = document.createElement('div');
        fields.className = 'settings-form-sortable-list-fields';
        for (const f of field.itemFields) {
          const val = items[i][f.key];
          const span = document.createElement('span');
          span.className = `settings-form-sortable-list-field settings-form-sortable-list-field--${f.type}`;
          if (f.type === 'color') {
            span.innerHTML = `<span class="settings-form-sortable-list-color-dot" style="background:${val || '#3b82f6'}"></span>`;
          } else {
            span.textContent = String(val ?? '');
          }
          fields.appendChild(span);
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'settings-form-sortable-list-remove';
        removeBtn.dataset.idx = String(i);
        removeBtn.title = 'Remove';
        removeBtn.textContent = '\u00d7';

        item.append(drag, fields, removeBtn);
        list.appendChild(item);
      }

      list
        .querySelectorAll<HTMLButtonElement>('.settings-form-sortable-list-remove')
        .forEach(btn => {
          btn.addEventListener('click', e => {
            e.stopPropagation();
            items.splice(parseInt(btn.dataset.idx!, 10), 1);
            onInput(items.map(a => ({ ...a })));
            renderItems();
          });
        });

      let dragIdx: number | null = null;
      list.querySelectorAll<HTMLElement>('.settings-form-sortable-list-item').forEach(el => {
        el.addEventListener('dragstart', () => {
          dragIdx = parseInt(el.dataset.idx!, 10);
          el.classList.add('dragging');
        });
        el.addEventListener('dragend', () => {
          dragIdx = null;
          el.classList.remove('dragging');
        });
        el.addEventListener('dragover', e => {
          e.preventDefault();
          const targetIdx = parseInt(el.dataset.idx!, 10);
          if (dragIdx === null || dragIdx === targetIdx) return;
          const dragged = items.splice(dragIdx, 1)[0];
          items.splice(targetIdx, 0, dragged);
          dragIdx = targetIdx;
          onInput(items.map(a => ({ ...a })));
          renderItems();
        });
      });
    };

    const addRow = document.createElement('div');
    addRow.className = 'settings-form-sortable-list-add';
    addRow.style.display = 'flex';
    addRow.style.gap = '4px';
    addRow.style.flexWrap = 'wrap';
    addRow.style.alignItems = 'center';

    const fieldInputs: HTMLInputElement[] = [];

    for (const f of field.itemFields) {
      if (f.type === 'select') {
        const select = document.createElement('select');
        select.className = 'settings-form-select';
        select.style.flex = '1';
        select.style.minWidth = '80px';
        select.style.fontSize = '11px';
        select.style.padding = '4px 6px';
        for (const opt of f.options || []) {
          const o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          select.appendChild(o);
        }
        fieldInputs.push(select as any);
        addRow.appendChild(select);
      } else if (f.type === 'color') {
        const input = document.createElement('input');
        input.type = 'color';
        input.className = 'settings-form-input';
        input.style.width = '32px';
        input.style.minWidth = '32px';
        input.style.padding = '2px';
        input.value = '#3b82f6';
        fieldInputs.push(input);
        addRow.appendChild(input);
      } else {
        const input = document.createElement('input');
        input.type = f.type === 'number' ? 'number' : 'text';
        input.className = 'settings-form-input';
        input.placeholder = f.placeholder || f.label;
        input.style.flex = '1';
        input.style.minWidth = '60px';
        input.style.fontSize = '11px';
        input.style.padding = '4px 6px';
        if (f.min !== undefined) input.min = String(f.min);
        if (f.max !== undefined) input.max = String(f.max);
        fieldInputs.push(input);
        addRow.appendChild(input);
      }
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'settings-form-btn';
    addBtn.textContent = '+';
    addBtn.style.fontWeight = '700';
    addBtn.style.padding = '4px 8px';
    addBtn.addEventListener('click', () => {
      const newItem: any = {};
      let hasValue = false;
      for (let i = 0; i < field.itemFields.length; i++) {
        const f = field.itemFields[i];
        const el = fieldInputs[i];
        const val = f.type === 'color' ? el.value : el.value.trim();
        if (val) hasValue = true;
        if (f.type === 'number') {
          newItem[f.key] = val ? Number(val) : undefined;
        } else {
          newItem[f.key] = val;
        }
      }
      if (!hasValue) return;
      items.push(newItem);
      onInput(items.map(a => ({ ...a })));
      for (const el of fieldInputs) {
        if (el instanceof HTMLSelectElement) {
          el.selectedIndex = 0;
        } else {
          el.value = '';
        }
      }
      renderItems();
    });

    addRow.appendChild(addBtn);

    const list = document.createElement('div');
    list.className = 'settings-form-sortable-list-items';

    wrap.append(list, addRow);
    renderItems();
    return wrap;
  }

  // ─── Dependent field visibility ──────────────────────────────────────────

  function updateDependents(changedKey: keyof T, changedValue: any) {
    for (const field of schema) {
      if (
        field.type === 'checkbox' ||
        field.type === 'select' ||
        field.type === 'text' ||
        field.type === 'number' ||
        field.type === 'password' ||
        field.type === 'textarea' ||
        field.type === 'color' ||
        field.type === 'range' ||
        field.type === 'radio-group' ||
        field.type === 'tag-list' ||
        field.type === 'check-group' ||
        field.type === 'tracked-list' ||
        field.type === 'string-list' ||
        field.type === 'sortable-list'
      ) {
        if (field.dependsOn?.key === changedKey) {
          const row = elements.get(field.key);
          if (row) {
            row.style.display = field.dependsOn.value === changedValue ? '' : 'none';
          }
        }
      }
    }
  }

  for (const field of schema) {
    if ('dependsOn' in field && field.dependsOn) {
      updateDependents(field.dependsOn.key, values[field.dependsOn.key]);
    }
  }

  return container;
}

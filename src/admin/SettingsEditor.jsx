import { settingsGroups, eventRange, dayCount, validDate, validImage, validDocument } from "../../shared/site-settings.js";
import { pageDefinitions } from "../../shared/site-pages.js";

function SettingField({ field, value, name, onChange, onUpload }) {
  const type = field.type || "text";
  if (type === "image" || type === "document") {
    const image = type === "image";
    return (
      <div className="cms-settings-file">
        <label>
          {field.label}
          <input name={name} type="file" accept={image ? "image/jpeg,image/png,image/webp" : ".pdf,.docx"}
            onChange={event => {
              const file = event.target.files[0];
              event.target.value = "";
              if (file) onUpload(file, type, onChange);
            }} />
        </label>
        {image && validImage(value) && <img src={value} className="cms-settings-image" alt={field.label} />}
        {!image && validDocument(value) && <a href={value} target="_blank" rel="noreferrer">Открыть текущее положение</a>}
        <small>{image ? "JPG, PNG или WebP, до 2 МБ." : "PDF или DOCX, до 10 МБ. После сохранения заменит все ссылки на положение."}</small>
      </div>
    );
  }
  const attributes = {
    name, required: !field.optional, value,
    maxLength: field.maxLength || (type === "email" ? 254 : type === "tel" ? 40 : 2048),
    onChange: event => onChange(type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value),
  };
  return <label className={type === "textarea" ? "cms-settings-wide" : undefined}>
    {field.label}
    {type === "textarea" ? <textarea {...attributes} rows={field.rows || 4} /> : <input {...attributes} type={type}
      min={type === "date" ? "2000-01-01" : field.min}
      max={type === "date" ? "2099-12-31" : field.max} step={type === "number" ? 1 : undefined} />}
  </label>;
}

export default function SettingsEditor({ record, dirty, busy, onChange, onSave, onReload, onUpload }) {
  if (!record) return <div className="cms-panel"><p>Загружаем настройки сайта…</p><button className="cms-button" disabled={busy} onClick={onReload}>Повторить загрузку</button></div>;
  const settings = record.settings;
  const updateField = (group, key, value) => onChange({ ...settings, [group]: { ...settings[group], [key]: value } });
  const updateItem = (group, index, values) => onChange({ ...settings, [group]: settings[group].map((item, i) => i === index ? { ...item, ...values } : item) });
  const updatePage = (key, values) => onChange({ ...settings, pages: { ...settings.pages, [key]: { ...settings.pages[key], ...values } } });
  const updateSection = (key, index, values) => updatePage(key, { sections: settings.pages[key].sections.map((section, i) => i === index ? { ...section, ...values } : section) });
  const moveSection = (key, from, to) => {
    const sections = [...settings.pages[key].sections];
    [sections[from], sections[to]] = [sections[to], sections[from]];
    updatePage(key, { sections });
  };
  const moveJury = (from, to) => {
    const jury = [...settings.jury];
    [jury[from], jury[to]] = [jury[to], jury[from]];
    onChange({ ...settings, jury });
  };
  return <form className="cms-settings" onSubmit={event => { event.preventDefault(); onSave(); }}>
    <aside className="cms-settings-nav">
      <nav aria-label="Разделы настроек">
        {settingsGroups.map(group => <a key={group.key} href={`#settings-${group.key}`}>{group.title}</a>)}
        <a href="#settings-program">Программа</a>
        <a href="#settings-jury">Жюри</a>
        {pageDefinitions.map(page => <a key={page.key} href={`#settings-${page.key}`}>{page.label}</a>)}
      </nav>
      <div className="cms-panel cms-save">
        <p className="cms-muted" role="status">{busy ? "Выполняем запрос…" : dirty ? "Есть несохранённые изменения" : "Все изменения сохранены"}</p>
        <button className="cms-button cms-button--primary" disabled={busy || !dirty}>Сохранить настройки</button>
        <button className="cms-text-button" type="button" onClick={onReload} disabled={busy}>Загрузить сохранённую версию</button>
        <small>Изменения появятся на сайте после обновления страницы.</small>
      </div>
    </aside>
    <fieldset className="cms-settings-content" disabled={busy}>
      <div className="cms-settings-summary cms-panel">
        <h2>{validDate(settings.event.startDate) && validDate(settings.event.endDate) ? eventRange(settings.event.startDate, settings.event.endDate) : "Укажите даты конкурса"}</h2>
        <p>{settings.event.city} · {settings.venue.name}</p>
        <small>Даты программы, длительность проживания и год на сайте обновляются автоматически. Тексты программы и содержимое положения редактируются отдельно.</small>
      </div>
      {settingsGroups.map(group => <section className="cms-panel" id={`settings-${group.key}`} key={group.key}>
        <h2>{group.title}</h2>
        <div className="cms-settings-fields">
          {group.fields.map(field => <SettingField key={field.key} field={field} name={`${group.key}.${field.key}`}
            value={settings[group.key][field.key]} onChange={value => updateField(group.key, field.key, value)} onUpload={onUpload} />)}
        </div>
      </section>)}
      <section className="cms-panel" id="settings-program">
        <h2>Программа</h2>
        <p className="cms-muted">{validDate(settings.event.arrivalDate) && validDate(settings.event.departureDate) ? `${dayCount(settings.event.arrivalDate, settings.event.departureDate)} с проживанием. ` : ""}Даты этапов берутся из раздела «Даты и город». Каждое событие пишите с новой строки — на сайте оно станет отдельным пунктом.</p>
        {settings.program.map((item, index) => <div className="cms-settings-item" key={index}>
          <h3>{["Заезд", "Начало конкурса", "Финал и награждение", "Выезд"][index]}</h3>
          <SettingField field={{label: "Название этапа", maxLength: 80}} name={`program.${index}.title`} value={item.title} onChange={title => updateItem("program", index, {title})} />
          <SettingField field={{label: "Описание этапа", type: "textarea", maxLength: 1000, rows: 8}} name={`program.${index}.text`} value={item.text} onChange={text => updateItem("program", index, {text})} />
          <SettingField field={{label: "Важное примечание (необязательно)", type: "textarea", maxLength: 500, optional: true}} name={`program.${index}.note`} value={item.note ?? ""} onChange={note => updateItem("program", index, {note})} />
        </div>)}
      </section>
      <section className="cms-panel" id="settings-jury">
        <h2>Жюри</h2>
        <p className="cms-muted">Порядок карточек соответствует этому списку. Описание можно добавить позже. Вместо отсутствующей фотографии показывается силуэт секретного гостя.</p>
        {settings.jury.map((person, index) => <div className="cms-settings-item" key={index}>
          <div className="cms-settings-item__heading">
            <h3>Член жюри {index + 1}</h3>
            <div>
              <button type="button" className="cms-text-button" disabled={index === 0} onClick={() => moveJury(index, index - 1)}>Выше</button>
              <button type="button" className="cms-text-button" disabled={index === settings.jury.length - 1} onClick={() => moveJury(index, index + 1)}>Ниже</button>
              <button type="button" className="cms-text-button cms-danger" disabled={settings.jury.length === 1} onClick={() => onChange({...settings, jury: settings.jury.filter((_, i) => i !== index)})}>Убрать</button>
            </div>
          </div>
          <div className="cms-settings-fields">
            {[{key:"name",label:"Имя",maxLength:120},{key:"role",label:"Должность",maxLength:180},{key:"bio",label:"Описание (необязательно)",type:"textarea",maxLength:1000,optional:true}].map(field =>
              <SettingField key={field.key} field={field} name={`jury.${index}.${field.key}`} value={person[field.key]} onChange={value => updateItem("jury", index, {[field.key]: value})} />)}
            <SettingField field={{label:"Фотография",type:"image"}} name={`jury.${index}.image`} value={person.image || "/assets/hidden.png"} onUpload={onUpload} onChange={image => updateItem("jury", index, {image, spriteIndex:null})} />
          </div>
          {(person.image || person.spriteIndex !== null) && <button type="button" className="cms-text-button" onClick={() => updateItem("jury", index, {image:"",spriteIndex:null})}>Убрать фотографию</button>}
        </div>)}
        <button type="button" className="cms-button" disabled={settings.jury.length >= 12} onClick={() => onChange({...settings, jury:[...settings.jury,{name:"",role:"",bio:"",image:"",spriteIndex:null}]})}>Добавить члена жюри</button>
      </section>
      {pageDefinitions.map(({ key, label }) => {
        const page = settings.pages[key];
        return <section className="cms-panel" id={`settings-${key}`} key={key}>
          <h2>{label}</h2>
          <p className="cms-muted">Пустая строка разделяет абзацы. Почта и телефон из раздела «Контакты» подставляются вместо {"{email}"} и {"{phone}"}. {"{privacy}"} — ссылка на политику, {"{regulations}"} — на положение.</p>
          <p><a href={`/${key}`} target="_blank" rel="noreferrer">Открыть опубликованную страницу</a></p>
          <SettingField field={{ label: "Заголовок страницы", maxLength: 160 }} name={`pages.${key}.title`} value={page.title} onChange={title => updatePage(key, { title })} />
          <SettingField field={{ label: "Вступление", type: "textarea", maxLength: 2000 }} name={`pages.${key}.lead`} value={page.lead} onChange={lead => updatePage(key, { lead })} />
          {page.sections.map((section, index) => <div className="cms-settings-item" key={index}>
            <div className="cms-settings-item__heading">
              <h3>Раздел {index + 1}</h3>
              <div>
                <button type="button" className="cms-text-button" disabled={index === 0} onClick={() => moveSection(key, index, index - 1)}>Выше</button>
                <button type="button" className="cms-text-button" disabled={index === page.sections.length - 1} onClick={() => moveSection(key, index, index + 1)}>Ниже</button>
                <button type="button" className="cms-text-button cms-danger" disabled={page.sections.length === 1} onClick={() => updatePage(key, { sections: page.sections.filter((_, i) => i !== index) })}>Убрать</button>
              </div>
            </div>
            <SettingField field={{ label: "Название раздела", maxLength: 160 }} name={`pages.${key}.sections.${index}.heading`} value={section.heading} onChange={heading => updateSection(key, index, { heading })} />
            <SettingField field={{ label: "Текст раздела", type: "textarea", rows: 6, maxLength: 3000 }} name={`pages.${key}.sections.${index}.text`} value={section.text} onChange={text => updateSection(key, index, { text })} />
          </div>)}
          <button type="button" className="cms-button" disabled={page.sections.length >= 20} onClick={() => updatePage(key, { sections: [...page.sections, { heading: "", text: "" }] })}>Добавить раздел</button>
        </section>;
      })}
    </fieldset>
  </form>;
}
